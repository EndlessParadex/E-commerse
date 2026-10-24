import { createHash, randomUUID } from 'node:crypto';
import { CatalogError } from './catalog.js';
import { accountIsActive, accountIsApproved } from './accountAccess.js';
import { packagingLabel, packagingSnapshot } from '../src/data/productPackaging.js';
import { paymentMethod } from '../src/state/paymentMethods.js';
import { cutoffTime, isPastCutoff, isPastDeliveryDate } from './b2bCutoff.js';

const fail = (message, status = 422, code = 'validation_error') => {
  throw new CatalogError(message, status, code);
};
export function cartDate(value) {
  if (
    typeof value !== 'string' ||
    !/^20\d{2}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value + 'T00:00:00Z')) ||
    new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value
  )
    fail('Pilih tanggal periode keranjang yang valid.');
  return value;
}

export class SharedCartRepository {
  constructor(db, catalog, stores, now = () => Date.now(), cutoff = null) {
    Object.assign(this, { db, catalog, stores, now, cutoff });
    db.exec(`CREATE TABLE IF NOT EXISTS cart_cycles (
      id TEXT PRIMARY KEY, store_id TEXT NOT NULL REFERENCES b2b_stores(id),
      delivery_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','locked','finalized')),
      revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      UNIQUE(store_id,delivery_date)
    );
    CREATE TABLE IF NOT EXISTS cart_items (
      cart_id TEXT NOT NULL REFERENCES cart_cycles(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 99),
      snapshot TEXT NOT NULL, PRIMARY KEY(cart_id,product_id)
    );
    CREATE TABLE IF NOT EXISTS cart_events (
      id TEXT PRIMARY KEY, cart_id TEXT NOT NULL REFERENCES cart_cycles(id),
      actor_id TEXT NOT NULL REFERENCES users(id), actor_role TEXT NOT NULL,
      request_id TEXT NOT NULL, request_hash TEXT NOT NULL,
      revision INTEGER NOT NULL, action TEXT NOT NULL, product_id TEXT,
      details TEXT NOT NULL, created_at INTEGER NOT NULL,
      UNIQUE(cart_id,request_id), UNIQUE(cart_id,revision)
    );
    CREATE INDEX IF NOT EXISTS cart_cycle_store_date ON cart_cycles(store_id,delivery_date DESC);
    CREATE INDEX IF NOT EXISTS cart_event_revision ON cart_events(cart_id,revision DESC);
    CREATE TABLE IF NOT EXISTS b2b_cycle_lifecycle_events (
      id TEXT PRIMARY KEY, cart_id TEXT NOT NULL REFERENCES cart_cycles(id),
      action TEXT NOT NULL CHECK(action IN ('auto_lock','reschedule')),
      actor_id TEXT REFERENCES users(id), details TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS b2b_cycle_lifecycle_cart
      ON b2b_cycle_lifecycle_events(cart_id,created_at DESC);`);
    if (!db.prepare('PRAGMA table_info(cart_cycles)').all().some((column) => column.name === 'payment_id'))
      db.exec("ALTER TABLE cart_cycles ADD COLUMN payment_id TEXT NOT NULL DEFAULT 'cod'");
  }
  actor(actor) {
    const user = actor?.id && this.db.prepare('SELECT id,role FROM users WHERE id=?').get(actor.id);
    if (!user || !accountIsActive(this.db, user.id) || !accountIsApproved(this.db, user.id))
      fail('Sesi akun tidak tersedia. Masuk kembali.', 401, 'unauthorized');
    return user;
  }
  participates(actor) {
    return (
      this.stores.isSales(actor.id) ||
      Boolean(
        this.db
          .prepare(
            `SELECT 1 FROM b2b_store_members WHERE user_id=?
          UNION ALL SELECT 1 FROM b2b_store_audit WHERE target_user_id=? AND action IN ('buyer_linked','buyer_unlinked') LIMIT 1`,
          )
          .get(actor.id, actor.id),
      )
    );
  }
  context(actor) {
    const user = this.actor(actor);
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(this.now());
    return {
      enabled: user.role === 'admin' || this.participates(user),
      role: this.stores.role(user),
      today,
    };
  }
  access(actor, storeId) {
    const user = this.actor(actor);
    if (
      user.role !== 'admin' &&
      !this.db
        .prepare(
          `SELECT 1 FROM b2b_stores s
      WHERE s.id=? AND s.active=1 AND
      (EXISTS(SELECT 1 FROM b2b_store_members m WHERE m.store_id=s.id AND m.user_id=?)
       OR EXISTS(SELECT 1 FROM b2b_sales_assignments a WHERE a.store_id=s.id AND a.sales_user_id=?))`,
        )
        .get(storeId, user.id, user.id)
    )
      fail('Toko tidak ditemukan atau akses sudah berubah.', 404, 'store_not_found');
    const store = this.stores.store(storeId);
    return { user, store };
  }
  cycle(storeId, date) {
    return this.db
      .prepare('SELECT * FROM cart_cycles WHERE store_id=? AND delivery_date=?')
      .get(storeId, date);
  }
  /** SAVEPOINT is valid inside Admin transactions and on independent reads. */
  enforceCutoff(storeId, date, cycle = this.cycle(storeId, date)) {
    if (!cycle || cycle.status !== 'open' ||
        !isPastCutoff(date, this.cutoff, this.now())) return cycle;
    this.db.exec('SAVEPOINT b2b_auto_cutoff');
    try {
      const changed = this.db.prepare(
        "UPDATE cart_cycles SET status='locked',revision=revision+1,updated_at=? WHERE id=? AND status='open'",
      ).run(this.now(), cycle.id);
      if (changed.changes) {
        this.db.prepare(
          'INSERT INTO b2b_cycle_lifecycle_events VALUES(?,?,?,?,?,?)',
        ).run(randomUUID(), cycle.id, 'auto_lock', null,
          JSON.stringify({ date, cutoffAt: new Date(this.now()).toISOString() }), this.now());
      }
      this.db.exec('RELEASE SAVEPOINT b2b_auto_cutoff');
    } catch (error) {
      this.db.exec('ROLLBACK TO SAVEPOINT b2b_auto_cutoff');
      this.db.exec('RELEASE SAVEPOINT b2b_auto_cutoff');
      throw error;
    }
    return this.cycle(storeId, date);
  }
  enforceAllCutoffs(storeId = null) {
    if (!this.cutoff) return;
    const rows = storeId
      ? this.db.prepare("SELECT store_id,delivery_date FROM cart_cycles WHERE status='open' AND store_id=?").all(storeId)
      : this.db.prepare("SELECT store_id,delivery_date FROM cart_cycles WHERE status='open'").all();
    for (const row of rows) this.enforceCutoff(row.store_id, row.delivery_date);
  }
  products() {
    return this.catalog.snapshot().edits.flatMap((draft) =>
      draft.variants.map((variant) => {
        const sizeLabel = `${Number(variant.sizeValue)}${variant.sizeUnit}`;
        return {
          id: variant.id,
          name: `${draft.baseName} ${sizeLabel}${variant.packagingType === 'satuan' ? '' : ' · ' + packagingLabel(variant)}`,
          price: Number(variant.price),
          packaging: packagingSnapshot({ ...variant, sizeLabel }),
        };
      }),
    );
  }
  eventsFor(cycle, before = Number.MAX_SAFE_INTEGER) {
    if (!cycle) return { events: [], hasMore: false };
    const rows = this.db
      .prepare(
        `SELECT e.revision,e.action,e.product_id AS productId,
      e.details,e.created_at AS createdAt,e.actor_role AS actorRole,u.name AS actorName
      FROM cart_events e JOIN users u ON u.id=e.actor_id WHERE e.cart_id=? AND e.revision<?
      ORDER BY e.revision DESC LIMIT 31`,
      )
      .all(cycle.id, before);
    return {
      events: rows.slice(0, 30).map((row) => ({ ...row, details: JSON.parse(row.details) })),
      hasMore: rows.length > 30,
    };
  }
  read(actor, storeId, date) {
    date = cartDate(date);
    const { store } = this.access(actor, storeId);
    const cycle = this.enforceCutoff(store.id, date);
    const overdue = isPastDeliveryDate(date, this.now()) && cycle?.status !== 'finalized';
    return {
      store,
      date,
      overdue,
      cutoffPassed: isPastCutoff(date, this.cutoff, this.now()),
      cutoffAt: this.cutoff ? new Date(cutoffTime(date, this.cutoff)).toISOString() : null,
      id: cycle?.id || null,
      revision: cycle?.revision || 0,
      status: cycle?.status || 'open',
      paymentId: cycle?.payment_id || 'cod',
      payment: paymentMethod(cycle?.payment_id || 'cod'),
      orderId: cycle ? this.orderFor?.(cycle.id) || null : null,
      canEdit: (!cycle || cycle.status === 'open') && !isPastCutoff(date, this.cutoff, this.now()),
      updatedAt: cycle?.updated_at || null,
      items: cycle
        ? this.db
            .prepare(
              'SELECT product_id AS id,quantity,snapshot FROM cart_items WHERE cart_id=? ORDER BY rowid',
            )
            .all(cycle.id)
            .map((row) => ({ ...JSON.parse(row.snapshot), id: row.id, quantity: row.quantity }))
        : [],
      ...this.eventsFor(cycle),
    };
  }
  events(actor, storeId, params) {
    this.access(actor, storeId);
    const date = cartDate(params.get('date'));
    const before = Number(params.get('before') || Number.MAX_SAFE_INTEGER);
    if (!Number.isSafeInteger(before) || before < 1) fail('Halaman riwayat tidak valid.');
    return this.eventsFor(this.cycle(storeId, date), before);
  }
  list(actor, storeId, params) {
    this.access(actor, storeId);
    this.enforceAllCutoffs(storeId);
    const page = Number(params.get('page') || 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000) fail('Halaman tidak valid.');
    const total = this.db
      .prepare('SELECT COUNT(*) AS n FROM cart_cycles WHERE store_id=?')
      .get(storeId).n;
    const pages = Math.max(1, Math.ceil(total / 25));
    const actual = Math.min(page, pages);
    const cycles = this.db
      .prepare(
        `SELECT c.delivery_date AS date,c.revision,c.status,c.updated_at AS updatedAt,
      (SELECT COUNT(*) FROM cart_items i WHERE i.cart_id=c.id) AS itemCount
      FROM cart_cycles c WHERE c.store_id=? ORDER BY c.delivery_date DESC LIMIT 25 OFFSET ?`,
      )
      .all(storeId, (actual - 1) * 25);
    return { cycles, total, page: actual, pages };
  }
  mutate(actor, storeId, body) {
    const date = cartDate(body?.date);
    if (
      !Number.isSafeInteger(body.revision) ||
      body.revision < 0 ||
      typeof body.requestId !== 'string' ||
      !/^[a-zA-Z0-9_-]{16,100}$/.test(body.requestId) ||
      !['add', 'set', 'remove', 'clear', 'refresh', 'payment'].includes(body.action)
    )
      fail('Perubahan keranjang tidak valid. Muat ulang keranjang.');
    const { action } = body;
    const selectedPayment =
      action === 'payment' &&
      ['cod', 'transfer-bca', 'transfer-bri', 'transfer-mandiri'].includes(body.paymentId)
        ? paymentMethod(body.paymentId)
        : null;
    if (action === 'payment' && !selectedPayment)
      fail('Pilih COD atau transfer BCA, BRI, atau Mandiri.', 422, 'invalid_payment');
    const productId = ['add', 'set', 'remove'].includes(action) ? body.productId : null;
    if (
      productId !== null &&
      (typeof productId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(productId))
    )
      fail('SKU tidak valid.');
    const quantity = ['add', 'set'].includes(action) ? body.quantity : null;
    if (quantity !== null && (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99))
      fail('Jumlah harus antara 1 dan 99 kemasan per SKU.');
    const hash = createHash('sha256')
      .update(JSON.stringify({ date, action, productId, quantity, paymentId: selectedPayment?.id || null, revision: body.revision }))
      .digest('hex');
    return this.stores.transaction(() => {
      const { user } = this.access(actor, storeId);
      if (action === 'payment' && user.role === 'admin')
        fail('Metode pembayaran dipilih pembeli toko atau Sales.', 403, 'payment_read_only');
      let cycle = this.enforceCutoff(storeId, date);
      const prior =
        cycle &&
        this.db
          .prepare('SELECT request_hash FROM cart_events WHERE cart_id=? AND request_id=?')
          .get(cycle.id, body.requestId);
      if (prior) {
        if (prior.request_hash !== hash)
          fail('Kode perubahan sudah digunakan untuk isian berbeda.', 409, 'request_reused');
        return this.read(user, storeId, date);
      }
      if (isPastCutoff(date, this.cutoff, this.now()))
        fail('Batas waktu pemesanan terlewati. Hubungi Admin BAM.', 409, 'cart_cutoff_passed');
      if (cycle && cycle.status !== 'open')
        fail('Keranjang sudah dikunci dan tidak dapat diubah.', 409, 'cart_locked');
      if ((cycle?.revision || 0) !== body.revision)
        fail(
          'Keranjang telah diubah pengguna lain. Isian terbaru dimuat; periksa lalu ulangi perubahan Anda.',
          409,
          'cart_conflict',
        );
      if (!cycle && this.stores.schedule(storeId) &&
          this.stores.deliveryDate(storeId, date) !== date)
        fail(
          'Tanggal bukan jadwal pengiriman tetap toko. Pilih periode pengiriman yang berlaku.',
          422,
          'invalid_delivery_schedule',
        );
      if (!cycle) {
        this.db
          .prepare(
            'INSERT INTO cart_cycles(id,store_id,delivery_date,created_at,updated_at) VALUES(?,?,?,?,?)',
          )
          .run(randomUUID(), storeId, date, this.now(), this.now());
        cycle = this.cycle(storeId, date);
      }
      const previous =
        productId &&
        this.db
          .prepare('SELECT quantity,snapshot FROM cart_items WHERE cart_id=? AND product_id=?')
          .get(cycle.id, productId);
      const clearedItems =
        action === 'clear'
          ? this.db
              .prepare('SELECT product_id AS productId,quantity FROM cart_items WHERE cart_id=?')
              .all(cycle.id)
          : [];
      const products = ['add', 'set', 'refresh'].includes(action) ? this.products() : [];
      const current = products.find((product) => product.id === productId);
      const after =
        action === 'add' ? (previous?.quantity || 0) + quantity : action === 'set' ? quantity : 0;
      if (after > 99) fail('Maksimal 99 kemasan per SKU.');
      if (action === 'payment') {
        this.db.prepare('UPDATE cart_cycles SET payment_id=? WHERE id=?').run(selectedPayment.id, cycle.id);
      } else if (['add', 'set'].includes(action)) {
        if (!current && (!previous || after > previous.quantity))
          fail(
            'Produk sudah tidak tersedia. Hapus SKU ini dari keranjang.',
            409,
            'product_unavailable',
          );
        if (action === 'set' && !previous)
          fail('Barang tidak lagi ada di keranjang.', 409, 'cart_conflict');
        if (
          !previous &&
          this.db.prepare('SELECT COUNT(*) AS n FROM cart_items WHERE cart_id=?').get(cycle.id).n >=
            100
        )
          fail('Maksimal 100 SKU dalam satu keranjang.');
        this.db
          .prepare(
            `INSERT INTO cart_items VALUES(?,?,?,?) ON CONFLICT(cart_id,product_id)
          DO UPDATE SET quantity=excluded.quantity`,
          )
          .run(cycle.id, productId, after, previous?.snapshot || JSON.stringify(current));
      } else if (action === 'remove') {
        this.db
          .prepare('DELETE FROM cart_items WHERE cart_id=? AND product_id=?')
          .run(cycle.id, productId);
      } else if (action === 'clear') {
        this.db.prepare('DELETE FROM cart_items WHERE cart_id=?').run(cycle.id);
      } else {
        const update = this.db.prepare(
          'UPDATE cart_items SET snapshot=? WHERE cart_id=? AND product_id=?',
        );
        for (const product of products) update.run(JSON.stringify(product), cycle.id, product.id);
      }
      const revision = cycle.revision + 1;
      this.db
        .prepare('UPDATE cart_cycles SET revision=?,updated_at=? WHERE id=?')
        .run(revision, this.now(), cycle.id);
      const details =
        action === 'payment'
          ? { before: cycle.payment_id || 'cod', after: selectedPayment.id }
          : action === 'clear'
          ? { clearedItems, before: clearedItems.length, after: 0 }
          : {
              name: current?.name || (previous ? JSON.parse(previous.snapshot).name : ''),
              before: previous?.quantity || 0,
              after,
            };
      this.db
        .prepare('INSERT INTO cart_events VALUES(?,?,?,?,?,?,?,?,?,?,?)')
        .run(
          randomUUID(),
          cycle.id,
          user.id,
          this.stores.role(user),
          body.requestId,
          hash,
          revision,
          action,
          productId,
          JSON.stringify(details),
          this.now(),
        );
      return this.read(user, storeId, date);
    });
  }
}
