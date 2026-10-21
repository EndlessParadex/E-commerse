import { createHash, randomUUID } from 'node:crypto';
import { CatalogError } from './catalog.js';
import { cartDate } from './sharedCarts.js';
import { paymentMethod } from '../src/state/paymentMethods.js';
import { withNotificationEvent } from '../src/state/orderNotifications.js';

const fail = (message, status = 422, code = 'validation_error') => {
  throw new CatalogError(message, status, code);
};
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export class B2BFinalizationRepository {
  constructor(db, carts, workflow, messages) {
    Object.assign(this, { db, carts, workflow, messages });
    db.exec(`CREATE TABLE IF NOT EXISTS b2b_cart_orders (
      cart_id TEXT PRIMARY KEY REFERENCES cart_cycles(id),
      order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
      actor_id TEXT NOT NULL REFERENCES users(id), request_id TEXT NOT NULL,
      request_hash TEXT NOT NULL, created_at INTEGER NOT NULL,
      UNIQUE(actor_id,request_id)
    );`);
    carts.orderFor = (cartId) =>
      db.prepare('SELECT order_id FROM b2b_cart_orders WHERE cart_id=?').get(cartId)?.order_id ||
      null;
    workflow.b2bCanRead = (actor, storeId) => this.canRead(actor, storeId);
    workflow.b2bOrderScope = (actor) => ({
      sql: `((json_type(data,'$.b2b') IS NULL AND user_id=?) OR
        EXISTS(SELECT 1 FROM b2b_stores s WHERE s.id=json_extract(orders.data,'$.b2b.storeId') AND s.active=1 AND
        (EXISTS(SELECT 1 FROM b2b_store_members m WHERE m.store_id=s.id AND m.user_id=?) OR
         EXISTS(SELECT 1 FROM b2b_sales_assignments a WHERE a.store_id=s.id AND a.sales_user_id=?))))`,
      params: [actor.id, actor.id, actor.id],
    });
    messages.b2bRecipients = (storeId) => this.recipients(storeId);
    messages.b2bCanRead = (actor, storeId) => this.canRead(actor, storeId);
  }
  canRead(actor, storeId) {
    try {
      this.carts.access(actor, storeId);
      return true;
    } catch {
      return false;
    }
  }
  recipients(storeId) {
    return this.db
      .prepare(
        `SELECT user_id AS id FROM b2b_store_members WHERE store_id=?
      UNION SELECT sales_user_id AS id FROM b2b_sales_assignments WHERE store_id=?`,
      )
      .all(storeId, storeId)
      .filter((user) => this.canRead(user, storeId));
  }
  admin(actor) {
    const user = this.carts.actor(actor);
    if (user.role !== 'admin')
      fail('Hanya Admin BAM yang dapat memproses keranjang toko.', 403, 'admin_required');
    return user;
  }
  event(cycle, user, body, hash, details) {
    const revision = cycle.revision + 1;
    this.db
      .prepare('UPDATE cart_cycles SET revision=?,updated_at=? WHERE id=?')
      .run(revision, this.carts.now(), cycle.id);
    this.db
      .prepare('INSERT INTO cart_events VALUES(?,?,?,?,?,?,?,?,?,?,?)')
      .run(
        randomUUID(),
        cycle.id,
        user.id,
        this.carts.stores.role(user),
        body.requestId,
        hash,
        revision,
        body.action,
        null,
        JSON.stringify(details),
        this.carts.now(),
      );
  }
  validate(body) {
    cartDate(body?.date);
    if (
      !Number.isSafeInteger(body.revision) ||
      body.revision < 0 ||
      typeof body.requestId !== 'string' ||
      !/^[a-zA-Z0-9_-]{16,100}$/.test(body.requestId) ||
      !['lock', 'unlock', 'finalize'].includes(body.action)
    )
      fail('Permintaan pemrosesan keranjang tidak valid.');
    if (
      body.action === 'unlock' &&
      (typeof body.reason !== 'string' || body.reason.trim().length < 5 || body.reason.length > 200)
    )
      fail('Isi alasan membuka kembali keranjang, minimal 5 dan maksimal 200 karakter.');
    if (
      body.action === 'finalize' &&
      (!/^[a-f0-9]{64}$/.test(body.reviewToken || '') || body.accepted !== true)
    )
      fail('Periksa rincian barang, harga dan stok, lalu centang persetujuan finalisasi.');
  }
  reviewInside(actor, storeId, date) {
    this.admin(actor);
    const cart = this.carts.read(actor, storeId, cartDate(date));
    if (cart.status !== 'locked')
      fail('Kunci keranjang sebelum memeriksa finalisasi.', 409, 'cart_not_locked');
    const catalog = new Map(this.carts.products().map((product) => [product.id, product]));
    const keys = new Map(
      this.workflow.catalogItems().map((entry) => [entry.variant.id, entry.key]),
    );
    const allocations = new Map();
    const items = cart.items.map((item) => {
      const current = catalog.get(item.id);
      const unavailable = !current;
      const changed = Boolean(
        current &&
        (item.name !== current.name ||
          item.price !== current.price ||
          JSON.stringify(item.packaging) !== JSON.stringify(current.packaging)),
      );
      if (current)
        allocations.set(
          keys.get(item.id),
          (allocations.get(keys.get(item.id)) || 0) +
            item.quantity * current.packaging.unitsPerPackage,
        );
      return {
        ...item,
        stockKey: keys.get(item.id) || '',
        current: current || null,
        changed,
        unavailable,
        total: current ? current.price * item.quantity : 0,
      };
    });
    const stock = [...allocations].map(([key, required]) => {
      const row = this.db
        .prepare('SELECT available,revision FROM inventory WHERE stock_key=?')
        .get(key);
      return {
        key,
        required,
        available: row?.available || 0,
        revision: row?.revision ?? 0,
        sufficient: Boolean(row && row.available >= required),
      };
    });
    const sales = this.carts.stores
      .details(actor, storeId)
      .sales.map(({ id, name }) => ({ id, name }));
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const review = {
      store: cart.store,
      date,
      revision: cart.revision,
      cartId: cart.id,
      items,
      stock,
      sales,
      subtotal,
      total: subtotal,
      shippingCost: 0,
      payment: 'COD saat diterima',
      ready:
        items.length > 0 &&
        !items.some((item) => item.unavailable) &&
        stock.every((row) => row.sufficient),
    };
    return {
      ...review,
      token: digest({
        ...review,
        catalogRevision: this.carts.catalog.snapshot().revision,
        companyRevision: this.workflow.company.snapshot().revision,
      }),
    };
  }
  review(actor, storeId, date) {
    this.admin(actor);
    this.workflow.tick();
    return this.workflow.transaction(() => this.reviewInside(actor, storeId, date), true);
  }
  change(actor, storeId, body) {
    this.admin(actor);
    this.validate(body);
    const hash = digest({
      action: body.action,
      date: body.date,
      revision: body.revision,
      ...(body.action === 'unlock' ? { reason: body.reason.trim() } : {}),
      ...(body.action === 'finalize' ? { reviewToken: body.reviewToken, accepted: true } : {}),
    });
    return this.workflow.transaction(() => {
      const user = this.admin(actor);
      this.carts.access(user, storeId);
      const cycle = this.carts.cycle(storeId, body.date);
      if (!cycle) fail('Keranjang belum berisi barang.', 409, 'empty_cart');
      const prior = this.db
        .prepare('SELECT request_hash FROM cart_events WHERE cart_id=? AND request_id=?')
        .get(cycle.id, body.requestId);
      if (prior) {
        if (prior.request_hash !== hash)
          fail('Kode permintaan sudah digunakan untuk perubahan berbeda.', 409, 'request_reused');
        return this.result(user, storeId, body.date);
      }
      if (cycle.status === 'finalized') {
        if (body.action === 'finalize') return this.result(user, storeId, body.date);
        fail(
          'Keranjang sudah menjadi pesanan dan tidak dapat dibuka kembali.',
          409,
          'cart_finalized',
        );
      }
      if (cycle.revision !== body.revision)
        fail(
          'Keranjang berubah. Muat terbaru dan periksa kembali sebelum memproses.',
          409,
          'cart_conflict',
        );
      if (body.action === 'lock') {
        if (cycle.status !== 'open') fail('Keranjang sudah dikunci.', 409, 'cart_locked');
        if (!this.db.prepare('SELECT 1 FROM cart_items WHERE cart_id=?').get(cycle.id))
          fail('Keranjang kosong tidak dapat dikunci.', 409, 'empty_cart');
        this.db.prepare("UPDATE cart_cycles SET status='locked' WHERE id=?").run(cycle.id);
        this.event(cycle, user, body, hash, {});
      } else if (body.action === 'unlock') {
        if (cycle.status !== 'locked')
          fail('Keranjang tidak sedang dikunci.', 409, 'cart_not_locked');
        this.db.prepare("UPDATE cart_cycles SET status='open' WHERE id=?").run(cycle.id);
        this.event(cycle, user, body, hash, { reason: body.reason.trim() });
      } else {
        // Review and reservation share the same SQLite write transaction.
        this.workflow.ensureInventory();
        this.workflow.expireInside();
        const review = this.reviewInside(user, storeId, body.date);
        if (review.token !== body.reviewToken)
          fail(
            'Harga, stok, toko atau penugasan berubah sejak pemeriksaan. Muat pemeriksaan terbaru.',
            409,
            'review_changed',
          );
        if (!review.ready)
          fail(
            'Barang atau stok belum memenuhi pemeriksaan. Perbaiki sebelum finalisasi.',
            409,
            'review_not_ready',
          );
        const collision = this.db
          .prepare('SELECT 1 FROM b2b_cart_orders WHERE actor_id=? AND request_id=?')
          .get(user.id, body.requestId);
        if (collision)
          fail('Kode finalisasi telah dipakai untuk keranjang lain.', 409, 'request_reused');
        const { items, allocations } = this.workflow.snapshotItems(
          review.items.map((item) => ({
            id: item.id,
            quantity: item.quantity,
            expectedPrice: item.current.price,
          })),
        );
        const time = this.carts.now();
        const profile = this.workflow.company.snapshot().profile;
        const finalizedBy = this.db.prepare('SELECT id,name FROM users WHERE id=?').get(user.id);
        let order = {
          id: 'BAM-' + randomUUID().toUpperCase(),
          requestKey: randomUUID(),
          userId: user.id,
          createdAt: time,
          recipient: review.store.storeName,
          address: review.store.address,
          note: '',
          items,
          subtotal: review.subtotal,
          total: review.total,
          revision: 0,
          storage: 'server',
          simulation: false,
          commerceVersion: 31,
          codFixedTotal: true,
          status: 'processing',
          seller: {
            shortName: profile.shortName,
            legalName: profile.legalName,
            address: profile.address,
            phone: profile.phone,
            email: profile.email,
          },
          shipping: {
            id: 'regular',
            label: 'Pengiriman gratis',
            cost: 0,
            quoted: true,
            simulation: false,
            plannedDate: body.date,
          },
          payment: { ...paymentMethod('cod'), status: 'pay_on_delivery', simulation: false },
          whatsapp: { optedIn: false, number: '', simulation: false, deliveryMode: 'manual' },
          inventory: [...allocations].map(([key, units]) => ({ key, units })),
          inventoryReleased: false,
          inventoryReserved: false,
          b2b: {
            storeId,
            storeCode: review.store.storeCode,
            storeName: review.store.storeName,
            phone: review.store.phone,
            cartId: cycle.id,
            date: body.date,
            finalizedAt: time,
            finalizedBy,
            sales: review.sales,
          },
        };
        this.workflow.reserve(order, user.id);
        order = withNotificationEvent(order, 'orderCreated', time);
        this.db
          .prepare('INSERT INTO orders VALUES(?,?,?,?,?,?,?,?)')
          .run(
            order.id,
            user.id,
            order.requestKey,
            hash,
            time,
            order.status,
            order.revision,
            JSON.stringify(order),
          );
        this.db
          .prepare('INSERT INTO b2b_cart_orders VALUES(?,?,?,?,?,?)')
          .run(cycle.id, order.id, user.id, body.requestId, hash, time);
        const snapshots = this.db.prepare(
          'UPDATE cart_items SET snapshot=? WHERE cart_id=? AND product_id=?',
        );
        for (const item of review.items)
          snapshots.run(JSON.stringify(item.current), cycle.id, item.id);
        this.db.prepare("UPDATE cart_cycles SET status='finalized' WHERE id=?").run(cycle.id);
        this.event(cycle, user, body, hash, {
          orderId: order.id,
          changes: review.items
            .filter((item) => item.changed)
            .map((item) => ({
              id: item.id,
              previous: { name: item.name, price: item.price, packaging: item.packaging },
              current: item.current,
            })),
        });
        this.messages.enqueue(order, 'orderCreated', time);
      }
      return this.result(user, storeId, body.date);
    });
  }
  result(actor, storeId, date) {
    const cart = this.carts.read(actor, storeId, date);
    return {
      cart,
      ...(cart.orderId
        ? { order: this.workflow.publicOrder(this.workflow.owned(actor, cart.orderId)) }
        : {}),
    };
  }
  queue(actor, params) {
    this.admin(actor);
    const status = params.get('status') || 'pending';
    const q = (params.get('q') || '').trim().toLowerCase();
    const page = Number(params.get('page') || 1);
    if (
      !['pending', 'open', 'locked', 'finalized', 'all'].includes(status) ||
      q.length > 200 ||
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 100000
    )
      fail('Pencarian antrean tidak valid.');
    const where = [
      's.active=1',
      "instr(lower(s.store_name||' '||s.store_code||' '||c.delivery_date),?)>0",
    ];
    const args = [q];
    if (status !== 'all') {
      where.push(status === 'pending' ? "c.status IN ('open','locked')" : 'c.status=?');
      if (status !== 'pending') args.push(status);
    }
    const from = `FROM cart_cycles c JOIN b2b_stores s ON s.id=c.store_id WHERE ${where.join(' AND ')}`;
    const total = this.db.prepare('SELECT COUNT(*) AS n ' + from).get(...args).n;
    const pages = Math.max(1, Math.ceil(total / 25));
    const actual = Math.min(page, pages);
    const carts = this.db
      .prepare(
        `SELECT c.store_id AS storeId,s.store_name AS storeName,s.store_code AS storeCode,
      c.delivery_date AS date,c.status,c.revision,c.updated_at AS updatedAt,
      (SELECT COUNT(*) FROM cart_items i WHERE i.cart_id=c.id) AS itemCount ${from}
      ORDER BY CASE c.status WHEN 'locked' THEN 0 ELSE 1 END,c.updated_at DESC,c.id DESC LIMIT 25 OFFSET ?`,
      )
      .all(...args, (actual - 1) * 25);
    return { carts, total, page: actual, pages };
  }
}
