import { accountIsActive } from './accountAccess.js';
import { randomUUID, createHash } from 'node:crypto';
import { CatalogError } from './catalog.js';
import { packagingValues, sizeKey, packagingLabel } from '../src/data/productPackaging.js';
import { paymentMethod } from '../src/state/paymentMethods.js';
import { shippingOptions } from '../src/data/shippingOptions.js';
import { normalizeWhatsApp } from '../src/state/whatsappModel.js';
import { withNotificationEvent } from '../src/state/orderNotifications.js';
import { normalizeReservationPolicy } from './securityPolicy.js';

const fail = (message, status = 422, code = 'validation_error') => {
  throw new CatalogError(message, status, code);
};
const keyOf = (groupId, variant) => `${groupId}:${sizeKey(variant)}`;
const isCOD = (order) => order.payment.groupId === 'cod';
const text = (value, min, max, label) => {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max)
    fail(`${label} tidak valid.`);
  return value.trim();
};
const copy = (value) => JSON.parse(JSON.stringify(value));
export class WorkflowRepository {
  constructor(db, catalog, company, now = () => Date.now(), policy = {}, messages = null) {
    this.db = db;
    this.messages = messages;
    this.catalog = catalog;
    this.company = company;
    this.now = now;
    this.policy = normalizeReservationPolicy(policy);
    db.exec(`CREATE TABLE IF NOT EXISTS inventory (stock_key TEXT PRIMARY KEY, available INTEGER NOT NULL CHECK(available>=0), revision INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), request_key TEXT NOT NULL, request_hash TEXT NOT NULL, created_at INTEGER NOT NULL, status TEXT NOT NULL, revision INTEGER NOT NULL, data TEXT NOT NULL, UNIQUE(user_id,request_key));
      CREATE TABLE IF NOT EXISTS inventory_events (id INTEGER PRIMARY KEY, stock_key TEXT NOT NULL, actor_id TEXT, order_id TEXT, action TEXT NOT NULL, delta INTEGER NOT NULL, available_after INTEGER NOT NULL, created_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS orders_owner_date ON orders(user_id,created_at DESC,id DESC);
      CREATE INDEX IF NOT EXISTS orders_status ON orders(status);
      CREATE TABLE IF NOT EXISTS workflow_migrations(id INTEGER PRIMARY KEY CHECK(id=1), actor_id TEXT NOT NULL, created_at INTEGER NOT NULL);`);
    db.exec(
      'CREATE TABLE IF NOT EXISTS order_images (hash TEXT PRIMARY KEY, content_type TEXT NOT NULL, bytes BLOB NOT NULL); CREATE TABLE IF NOT EXISTS workflow_meta (id INTEGER PRIMARY KEY CHECK(id=1)); CREATE TABLE IF NOT EXISTS workflow_security_migrations (id INTEGER PRIMARY KEY CHECK(id=1), applied_at INTEGER NOT NULL)',
    );
    db.exec(
      'CREATE TABLE IF NOT EXISTS inventory_stats (stock_key TEXT PRIMARY KEY REFERENCES inventory(stock_key), sold_units INTEGER NOT NULL DEFAULT 0 CHECK(sold_units>=0), reserved_units INTEGER NOT NULL DEFAULT 0 CHECK(reserved_units>=0)); CREATE TABLE IF NOT EXISTS workflow_v30_migrations (id INTEGER PRIMARY KEY CHECK(id=1))',
    );
    this.transaction(() => {
      const first = !db.prepare('SELECT id FROM workflow_meta WHERE id=1').get();
      this.ensureInventory(first && company.snapshot().mode === 'demo' ? 120 : 0);
      if (first) db.prepare('INSERT INTO workflow_meta VALUES(1)').run();
      this.migrateCOD();
      this.migrateReservations();
      this.expireInside();
    });
  }
  transaction(callback, readOnly = false) {
    this.db.exec(readOnly ? 'BEGIN DEFERRED' : 'BEGIN IMMEDIATE');
    try {
      const result = callback();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  catalogItems() {
    return this.catalog
      .snapshot()
      .edits.flatMap((draft) =>
        draft.variants.map((variant) => ({ draft, variant, key: keyOf(draft.groupId, variant) })),
      );
  }
  ensureInventory(initial = 0) {
    const insert = this.db.prepare(
      'INSERT OR IGNORE INTO inventory(stock_key,available) VALUES(?,?)',
    );
    for (const entry of this.catalogItems()) insert.run(entry.key, initial);
    this.db.exec(
      'INSERT OR IGNORE INTO inventory_stats(stock_key) SELECT stock_key FROM inventory',
    );
  }
  event(key, delta, action, actor = null, order = null) {
    const row = this.db.prepare('SELECT available FROM inventory WHERE stock_key=?').get(key);
    this.db
      .prepare(
        'INSERT INTO inventory_events(stock_key,actor_id,order_id,action,delta,available_after,created_at) VALUES(?,?,?,?,?,?,?)',
      )
      .run(key, actor, order, action, delta, row.available, this.now());
  }
  writeOrder(order) {
    this.db
      .prepare('UPDATE orders SET status=?,revision=?,data=? WHERE id=?')
      .run(order.status, order.revision, JSON.stringify(order), order.id);
  }
  release(order, action, actor) {
    if (order.inventoryReleased || order.inventoryReserved === false) return;
    for (const row of order.inventory) {
      this.db
        .prepare('UPDATE inventory SET available=available+?,revision=revision+1 WHERE stock_key=?')
        .run(row.units, row.key);
      this.event(row.key, row.units, action, actor, order.id);
      if (!this.metricsRebuilding) this.adjustStats(row.key, -row.units, 0);
    }
    order.inventoryReleased = true;
    order.inventoryReserved = false;
  }
  migrateCOD() {
    if (this.db.prepare('SELECT id FROM workflow_security_migrations WHERE id=1').get()) return;
    const time = this.now();
    for (const row of this.db.prepare("SELECT data FROM orders WHERE status='processing'").all()) {
      let order = JSON.parse(row.data);
      if (
        !isCOD(order) ||
        order.codConfirmation ||
        order.payment.status === 'paid' ||
        order.shipping.shippedAt
      )
        continue;
      order.status = 'awaiting_confirmation';
      order.revision++;
      order.codConfirmation = {
        expiresAt: time + this.policy.codConfirmationWindowMs,
        legacyReview: true,
      };
      order = withNotificationEvent(order, 'codConfirmationRequired', time);
      this.writeOrder(order);
    }
    this.db.prepare('INSERT INTO workflow_security_migrations VALUES(1,?)').run(time);
  }
  expireInside() {
    for (const row of this.db
      .prepare(
        "SELECT data FROM orders WHERE status IN ('awaiting_payment','awaiting_confirmation','awaiting_review','awaiting_acceptance')",
      )
      .all()) {
      let order = JSON.parse(row.data);
      if (order.payment.status === 'proof_submitted') continue;
      const deadline =
        order.status === 'awaiting_acceptance'
          ? order.quote.expiresAt
          : order.status === 'awaiting_confirmation'
            ? order.codConfirmation?.expiresAt
            : order.status === 'awaiting_review'
              ? order.review?.expiresAt
              : order.payment.expiresAt;
      if (!Number.isSafeInteger(deadline) || deadline > this.now()) continue;
      const kind =
        order.status === 'awaiting_acceptance'
          ? 'quoteExpired'
          : order.status === 'awaiting_confirmation'
            ? 'codConfirmationExpired'
            : order.status === 'awaiting_review'
              ? 'orderReviewExpired'
              : 'paymentExpired';
      this.release(order, 'expire', null);
      order.status = 'expired';
      order.payment.status = 'expired';
      order.revision++;
      order = withNotificationEvent(order, kind, deadline);
      this.writeOrder(order);
      this.messages?.enqueue(order, kind, deadline);
    }
    this.paymentReminders?.();
  }
  checkReservations(user, allocations) {
    const pending = this.db
      .prepare(
        "SELECT data FROM orders WHERE user_id=? AND status IN ('awaiting_payment','awaiting_confirmation','awaiting_review','awaiting_acceptance','processing','shipped')",
      )
      .all(user.id)
      .map((row) => JSON.parse(row.data))
      .filter((order) =>
        ['awaiting_payment', 'awaiting_confirmation', 'awaiting_review', 'awaiting_acceptance'].includes(
          order.status,
        ) || (order.codFixedTotal && order.inventoryReserved === true),
      );
    const held = new Map();
    for (const order of pending)
      for (const allocation of order.inventory)
        held.set(allocation.key, (held.get(allocation.key) || 0) + allocation.units);
    for (const [key, units] of allocations) held.set(key, (held.get(key) || 0) + units);
    if (
      pending.length >= this.policy.maxOpenOrders ||
      [...held.values()].reduce((sum, units) => sum + units, 0) > this.policy.maxReservedUnits ||
      [...held.values()].some((units) => units > this.policy.maxUnitsPerStock)
    )
      fail(
        'Batas pesanan atau stok yang belum dikonfirmasi telah tercapai. Selesaikan atau batalkan pesanan sebelumnya, kurangi jumlah barang, atau hubungi toko untuk pesanan besar.',
        409,
        'reservation_limit',
      );
  }
  tick() {
    return this.transaction(() => this.expireInside());
  }
  stock({ publicRead = false } = {}) {
    return this.transaction(() => {
      const result = {},
        skuAvailability = {},
        groups = new Map();
      const rows = new Map(
        this.db
          .prepare(
            'SELECT inventory.stock_key,available,revision,sold_units,reserved_units FROM inventory LEFT JOIN inventory_stats USING(stock_key)',
          )
          .all()
          .map((row) => [row.stock_key, row]),
      );
      const profile = this.company.snapshot().profile;
      for (const entry of this.catalogItems()) {
        const row = rows.get(entry.key);
        if (!row) throw new Error('Missing inventory row');
        skuAvailability[entry.variant.id] =
          row.available >= packagingValues(entry.variant).unitsPerPackage;
        result[entry.key] = publicRead
          ? {
              revision: row.revision,
              ...(profile.showExactStock === false
                ? { inStock: row.available > 0 }
                : { available: row.available }),
            }
          : {
              available: row.available,
              revision: row.revision,
              soldUnits: row.sold_units || 0,
              reservedUnits: row.reserved_units || 0,
            };
        groups.set(entry.draft.groupId, 0);
      }
      if (publicRead) {
        const publishedSales = {};
        if (profile.showSoldCount === true) {
          for (const [stockKey, row] of rows) {
            const group = stockKey.slice(0, stockKey.indexOf(':'));
            if (groups.has(group)) groups.set(group, groups.get(group) + (row.sold_units || 0));
          }
          for (const [group, units] of groups)
            publishedSales[group] =
              units === 0 ? 0 : units < 10 ? 1 : 10 ** Math.floor(Math.log10(units));
        }
        return { version: 1, stock: result, skuAvailability, publishedSales };
      }
      return {
        version: 1,
        stock: result,
        canImportPreview:
          !this.db.prepare('SELECT id FROM workflow_migrations WHERE id=1').get() &&
          !this.db.prepare('SELECT id FROM orders LIMIT 1').get() &&
          !this.db.prepare('SELECT stock_key FROM inventory WHERE revision>0 LIMIT 1').get(),
      };
    }, true);
  }
  adjustStats(key, reserved, sold) {
    this.db
      .prepare(
        'UPDATE inventory_stats SET reserved_units=reserved_units+?,sold_units=sold_units+? WHERE stock_key=?',
      )
      .run(reserved, sold, key);
  }
  reserve(order, actor) {
    if (order.inventoryReserved) return;
    for (const row of order.inventory) {
      if (
        !this.db
          .prepare(
            'UPDATE inventory SET available=available-?,revision=revision+1 WHERE stock_key=? AND available>=?',
          )
          .run(row.units, row.key, row.units).changes
      )
        fail(
          'Stok tidak cukup untuk menyetujui pesanan. Periksa persediaan dan hubungi pelanggan.',
          409,
          'insufficient_stock',
        );
      this.event(row.key, -row.units, 'reserve', actor, order.id);
      this.adjustStats(row.key, row.units, 0);
    }
    order.inventoryReserved = true;
    order.inventoryReleased = false;
  }
  migrateReservations() {
    if (this.db.prepare('SELECT id FROM workflow_v30_migrations WHERE id=1').get()) return;
    this.metricsRebuilding = true;
    try {
      this.db.exec('UPDATE inventory_stats SET reserved_units=0,sold_units=0');
      for (const row of this.db.prepare('SELECT data FROM orders').all()) {
        const order = JSON.parse(row.data);
        order.inventoryReserved =
          order.inventoryReserved ??
          (!order.inventoryReleased &&
            ['awaiting_payment', 'awaiting_confirmation', 'processing', 'shipped'].includes(
              order.status,
            ));
        if (order.status === 'awaiting_confirmation' && order.inventoryReserved) {
          this.release(order, 'review_release', null);
          order.inventoryReleased = false;
        }
        if (order.status === 'completed')
          for (const allocation of order.inventory)
            this.adjustStats(allocation.key, 0, allocation.units);
        else if (order.inventoryReserved)
          for (const allocation of order.inventory)
            this.adjustStats(allocation.key, allocation.units, 0);
        order.revision++;
        this.writeOrder(order);
      }
      this.db.prepare('INSERT INTO workflow_v30_migrations VALUES(1)').run();
    } finally {
      this.metricsRebuilding = false;
    }
  }
  setStock(user, body) {
    if (user.role !== 'admin') fail('Hanya admin yang dapat mengubah stok.', 403, 'forbidden');
    if (
      typeof body?.key !== 'string' ||
      !Number.isSafeInteger(body.available) ||
      body.available < 0 ||
      body.available > 1_000_000_000 ||
      !Number.isSafeInteger(body.revision)
    )
      fail('Isi jumlah stok dan versi data yang valid.');
    this.transaction(() => {
      if (!accountIsActive(this.db, user.id))
        fail('Akun ini dinonaktifkan. Hubungi pemilik toko.', 403, 'account_disabled');
      this.ensureInventory();
      this.expireInside();
      if (!this.catalogItems().some((entry) => entry.key === body.key))
        fail('Ukuran produk tidak ditemukan.', 404, 'not_found');
      const before = this.db
        .prepare('SELECT available,revision FROM inventory WHERE stock_key=?')
        .get(body.key);
      if (before.revision !== body.revision)
        fail(
          'Stok berubah sejak form dibuka. Muat data terbaru dan periksa jumlahnya kembali.',
          409,
          'revision_conflict',
        );
      this.db
        .prepare('UPDATE inventory SET available=?,revision=revision+1 WHERE stock_key=?')
        .run(body.available, body.key);
      this.event(body.key, body.available - before.available, 'adjust', user.id);
    });
    return this.stock();
  }
  importStock(user, body) {
    if (user.role !== 'admin') fail('Akses admin diperlukan.', 403, 'forbidden');
    if (!Array.isArray(body?.rows) || !body.rows.length || body.rows.length > 5000)
      fail('Daftar stok impor tidak valid.');
    this.transaction(() => {
      if (!accountIsActive(this.db, user.id))
        fail('Akun ini dinonaktifkan. Hubungi pemilik toko.', 403, 'account_disabled');
      this.ensureInventory();
      if (
        this.db.prepare('SELECT id FROM workflow_migrations WHERE id=1').get() ||
        this.db.prepare('SELECT id FROM orders LIMIT 1').get() ||
        this.db.prepare('SELECT stock_key FROM inventory WHERE revision>0 LIMIT 1').get()
      )
        fail(
          'Impor awal sudah ditutup karena stok atau pesanan server telah digunakan.',
          409,
          'import_closed',
        );
      const keys = new Set(this.catalogItems().map((entry) => entry.key));
      const seen = new Set();
      for (const row of body.rows) {
        if (
          !keys.has(row?.key) ||
          seen.has(row.key) ||
          !Number.isSafeInteger(row.available) ||
          row.available < 0 ||
          row.available > 1_000_000_000 ||
          row.revision !== 0
        )
          fail('Periksa ukuran produk dan angka stok impor.');
        seen.add(row.key);
        const previous = this.db
          .prepare('SELECT available FROM inventory WHERE stock_key=?')
          .get(row.key).available;
        this.db
          .prepare('UPDATE inventory SET available=?,revision=revision+1 WHERE stock_key=?')
          .run(row.available, row.key);
        this.event(row.key, row.available - previous, 'preview_import', user.id);
      }
      this.db.prepare('INSERT INTO workflow_migrations VALUES(1,?,?)').run(user.id, this.now());
    });
    return this.stock();
  }
  publicOrder(order) {
    const value = copy(order);
    if (!value.requestKey)
      value.requestKey = this.db
        .prepare('SELECT request_key FROM orders WHERE id=?')
        .get(order.id)?.request_key;
    if (value.commerceVersion === 31 && this.messages)
      value.emailUpdates = this.db
        .prepare(
          'SELECT kind,status,created_at AS createdAt,sent_at AS sentAt FROM order_mail WHERE order_id=? AND recipient_id=? AND admin=0 ORDER BY created_at DESC LIMIT 12',
        )
        .all(value.id, value.userId);
    value.items.forEach((item, index) => {
      if (item.details.image)
        item.details.image = `/api/orders/${encodeURIComponent(order.id)}/images/${index}`;
    });
    return value;
  }
  owned(user, id) {
    const row = this.db.prepare('SELECT user_id,data FROM orders WHERE id=?').get(id);
    if (!row || (row.user_id !== user.id && user.role !== 'admin'))
      fail('Pesanan tidak ditemukan pada akun Anda.', 404, 'not_found');
    return JSON.parse(row.data);
  }
  get(user, id) {
    this.tick();
    return this.publicOrder(this.owned(user, id));
  }
  image(user, id, index) {
    const order = this.owned(user, id);
    const image = order.items[index]?.details.image;
    if (!image) fail('Foto pesanan tidak ditemukan.', 404, 'not_found');
    if (/^[a-f\d]{64}$/.test(image)) {
      const asset = this.db
        .prepare('SELECT content_type,bytes FROM order_images WHERE hash=?')
        .get(image);
      if (!asset) fail('Foto pesanan tidak tersedia.', 404, 'not_found');
      return { contentType: asset.content_type, bytes: Buffer.from(asset.bytes) };
    }
    const match = image.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
    if (!match) fail('Foto pesanan tidak tersedia.', 404, 'not_found');
    return { contentType: match[1], bytes: Buffer.from(match[2], 'base64') };
  }
  saveImage(image) {
    if (!image) return '';
    const match = image.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
    if (!match) return '';
    const bytes = Buffer.from(match[2], 'base64');
    const hash = createHash('sha256').update(bytes).digest('hex');
    this.db.prepare('INSERT OR IGNORE INTO order_images VALUES(?,?,?)').run(hash, match[1], bytes);
    return hash;
  }
  list(user, { admin = false, before = '' } = {}) {
    if (admin && user.role !== 'admin') fail('Akses admin diperlukan.', 403, 'forbidden');
    this.tick();
    const where = [];
    const params = [];
    if (!admin) {
      where.push('user_id=?');
      params.push(user.id);
    }
    if (before) {
      const cursor = this.db
        .prepare('SELECT created_at,id,user_id FROM orders WHERE id=?')
        .get(before);
      if (!cursor || (!admin && cursor.user_id !== user.id))
        fail('Batas halaman tidak ditemukan pada akun Anda.', 404, 'not_found');
      where.push('(created_at<? OR (created_at=? AND id<?))');
      params.push(cursor.created_at, cursor.created_at, cursor.id);
    }
    const rows = this.db
      .prepare(
        `SELECT data FROM orders${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC,id DESC LIMIT 51`,
      )
      .all(...params);
    return {
      version: 1,
      orders: rows.slice(0, 50).map((row) => this.publicOrder(JSON.parse(row.data))),
      nextCursor: rows.length > 50 ? JSON.parse(rows[49].data).id : null,
    };
  }
  create(user, body, ip = user.id) {
    const requestKey = text(body?.requestKey, 36, 36, 'Nomor permintaan');
    if (!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(requestKey))
      fail('Nomor permintaan tidak valid.');
    const recipient = text(body.recipient, 2, 100, 'Nama penerima');
    const address = text(body.address, 10, 500, 'Alamat');
    const note = text(body.note ?? '', 0, 300, 'Catatan');
    const payment = paymentMethod(body.paymentId);
    const shipping = shippingOptions.find((entry) => entry.id === body.shippingId);
    if (!payment || !shipping) fail('Pilih metode pembayaran dan pengiriman yang tersedia.');
    if (!Array.isArray(body.items) || !body.items.length || body.items.length > 100)
      fail('Isi keranjang tidak valid.');
    const seen = new Set();
    const requested = body.items
      .map((row) => {
        if (
          !row ||
          typeof row.id !== 'string' ||
          seen.has(row.id.toLowerCase()) ||
          !Number.isSafeInteger(row.quantity) ||
          row.quantity < 1 ||
          row.quantity > 99 ||
          !Number.isSafeInteger(row.expectedPrice) ||
          row.expectedPrice <= 0
        )
          fail('SKU, harga, atau jumlah barang tidak valid.');
        seen.add(row.id.toLowerCase());
        return { id: row.id, quantity: row.quantity, expectedPrice: row.expectedPrice };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
    const whatsapp = {
      optedIn: body.whatsappOptIn === true,
      number: body.whatsappOptIn === true ? normalizeWhatsApp(body.whatsappNumber) : '',
      simulation: true,
    };
    if (whatsapp.optedIn && !whatsapp.number) fail('Nomor WhatsApp tidak valid.');
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          recipient,
          address,
          note,
          paymentId: payment.id,
          shippingId: shipping.id,
          requested,
          whatsapp,
        }),
      )
      .digest('hex');
    return this.transaction(() => {
      if (!accountIsActive(this.db, user.id))
        fail('Akun ini dinonaktifkan. Hubungi pemilik toko.', 403, 'account_disabled');
      this.ensureInventory();
      this.expireInside();
      const previous = this.db
        .prepare('SELECT request_hash,data FROM orders WHERE user_id=? AND request_key=?')
        .get(user.id, requestKey);
      if (previous) {
        if (previous.request_hash !== requestHash)
          fail('Nomor permintaan sudah digunakan untuk isian berbeda.', 409, 'request_conflict');
        return this.publicOrder(JSON.parse(previous.data));
      }
      this.validateCheckout?.(user, body, payment);
      this.checkCheckoutSource?.(user, ip);
      const catalog = this.catalogItems();
      const allocations = new Map();
      const items = requested.map((entry) => {
        const found = catalog.find(({ variant }) => variant.id === entry.id);
        if (!found)
          fail(
            'Barang pada keranjang sudah tidak tersedia. Periksa katalog kembali.',
            409,
            'catalog_changed',
          );
        const { draft, variant, key } = found;
        const price = Number(variant.price);
        if (price !== entry.expectedPrice)
          fail(
            'Harga produk berubah. Periksa keranjang dan gunakan harga terbaru.',
            409,
            'price_changed',
          );
        const pack = packagingValues(variant);
        const sizeLabel = `${Number(variant.sizeValue)}${variant.sizeUnit}`;
        allocations.set(key, (allocations.get(key) || 0) + entry.quantity * pack.unitsPerPackage);
        const photos = variant.gallery ?? draft.gallery ?? [];
        const image = photos[0]?.src || (variant.gallery ? '' : draft.image) || '';
        const name = `${draft.baseName} ${sizeLabel}${pack.packagingType === 'satuan' ? '' : ' · ' + packagingLabel(variant)}`;
        return {
          id: variant.id,
          name,
          price,
          quantity: entry.quantity,
          details: {
            name: draft.baseName,
            brand: draft.brand,
            sizeLabel,
            packaging: { ...pack, sizeLabel },
            image: this.saveImage(image),
            imageAlt: photos[0]?.alt || draft.imageAlt || draft.baseName,
            icon: '📦',
            color: draft.color,
          },
        };
      });
      this.checkReservations(user, allocations);
      const id = 'BAM-' + randomUUID().toUpperCase();
      const time = this.now();
      for (const [key, units] of allocations)
        if (
          (this.db.prepare('SELECT available FROM inventory WHERE stock_key=?').get(key)
            ?.available || 0) < units
        )
          fail(
            'Jumlah yang diminta melebihi persediaan saat ini. Kurangi jumlah atau hubungi toko.',
            409,
            'insufficient_stock',
          );
      const subtotal = items.reduce((sum, entry) => sum + entry.price * entry.quantity, 0);
      let order = {
        id,
        requestKey,
        userId: user.id,
        createdAt: time,
        recipient,
        address,
        note,
        items,
        subtotal,
        total: subtotal + shipping.cost,
        revision: 0,
        storage: 'server',
        simulation: false,
        shipping: { id: shipping.id, label: shipping.label, cost: shipping.cost, simulation: true },
        payment: {
          ...payment,
          status: payment.groupId === 'cod' ? 'pay_on_delivery' : 'pending',
          simulation: true,
          ...(payment.groupId !== 'cod' ? { status: 'pending_review' } : {}),
        },
        status: payment.groupId === 'cod' ? 'awaiting_confirmation' : 'awaiting_review',
        ...(payment.groupId !== 'cod'
          ? { review: { expiresAt: time + this.policy.codConfirmationWindowMs } }
          : {}),
        ...(payment.groupId === 'cod'
          ? { codConfirmation: { expiresAt: time + this.policy.codConfirmationWindowMs } }
          : {}),
        whatsapp,
        inventory: [...allocations].map(([key, units]) => ({ key, units })),
        inventoryReleased: false,
        inventoryReserved: false,
      };
      order = this.prepareOrder ? this.prepareOrder(order) : order;
      if (order.codFixedTotal) this.reserve(order, user.id);
      order = withNotificationEvent(order, 'orderCreated', time);
      this.db
        .prepare('INSERT INTO orders VALUES(?,?,?,?,?,?,?,?)')
        .run(
          id,
          user.id,
          requestKey,
          requestHash,
          time,
          order.status,
          order.revision,
          JSON.stringify(order),
        );
      this.messages?.enqueue(order, 'orderCreated', time);
      return this.publicOrder(order);
    });
  }
  update(user, id, body) {
    return this.transaction(() => {
      if (!accountIsActive(this.db, user.id))
        fail('Akun ini dinonaktifkan. Hubungi pemilik toko.', 403, 'account_disabled');
      this.expireInside();
      let order = this.owned(user, id);
      const action = body?.action;
      if (!Number.isSafeInteger(body?.revision) || body.revision !== order.revision)
        fail('Pesanan berubah. Muat data terbaru sebelum melanjutkan.', 409, 'revision_conflict');
      const time = this.now();
      const special = this.updateCommerce?.(user, order, body, time);
      if (special) {
        order = special.order;
        order.revision++;
        order = withNotificationEvent(order, special.kind, time);
        this.writeOrder(order);
        this.messages?.enqueue(order, special.kind, time);
        return this.publicOrder(order);
      }
      let kind;
      if (action === 'cancel') {
        if (
          ['cancelled', 'expired', 'shipped', 'completed'].includes(order.status) ||
          ['paid', 'proof_submitted'].includes(order.payment.status)
        )
          fail('Pesanan ini tidak dapat dibatalkan.', 409, 'invalid_status');
        order.cancellationReason = text(
          body.reason || 'Berubah pikiran',
          2,
          200,
          'Alasan pembatalan',
        );
        this.release(order, 'cancel', user.id);
        order.status = 'cancelled';
        order.cancelledAt = time;
        order.payment.status = 'cancelled';
        kind = 'orderCancelled';
      } else {
        if (user.role !== 'admin')
          fail('Hanya admin yang dapat mencatat pembayaran dan pengiriman.', 403, 'forbidden');
        if (action === 'confirm_cod') {
          if (
            !isCOD(order) ||
            order.status !== 'awaiting_confirmation' ||
            order.codConfirmation?.expiresAt <= time
          )
            fail('Pesanan COD tidak lagi menunggu konfirmasi.', 409, 'invalid_status');
          this.reserve(order, user.id);
          order.codConfirmation = {
            ...order.codConfirmation,
            confirmedAt: time,
            confirmedBy: user.id,
          };
          order.status = 'processing';
          kind = 'codConfirmed';
        } else if (action === 'approve_payment') {
          if (isCOD(order) || order.status !== 'awaiting_review')
            fail('Pesanan tidak lagi menunggu pemeriksaan toko.', 409, 'invalid_status');
          this.reserve(order, user.id);
          order.status = 'awaiting_payment';
          order.payment.status = 'pending';
          order.payment.expiresAt = time + this.policy.paymentHoldWindowMs;
          order.review = { ...order.review, approvedAt: time, approvedBy: user.id };
          kind = 'orderApproved';
        } else if (action === 'paid') {
          if (order.status !== 'awaiting_payment' || isCOD(order))
            fail('Status pembayaran sudah berubah.', 409, 'invalid_status');
          order.payment.reference = text(body.reference, 3, 100, 'Referensi pembayaran manual');
          order.payment.status = 'paid';
          if (order.payment.proof)
            order.payment.proof = {
              ...order.payment.proof,
              status: 'accepted',
              reviewedAt: time,
              reviewedBy: user.id,
            };
          order.payment.paidAt = time;
          order.payment.recordedBy = user.id;
          order.payment.simulation = false;
          order.status = 'processing';
          kind = 'paymentReceived';
        } else if (action === 'ship') {
          if (order.status !== 'processing' || (!isCOD(order) && order.payment.status !== 'paid'))
            fail('Pesanan belum siap dikirim.', 409, 'invalid_status');
          order.shipping.courier = text(body.courier, 2, 100, 'Kurir');
          order.shipping.trackingNumber = text(body.trackingNumber, 2, 100, 'Nomor resi');
          order.shipping.shippedAt = time;
          order.shipping.recordedBy = user.id;
          order.status = 'shipped';
          kind = 'orderShipped';
        } else if (action === 'complete') {
          if (order.status !== 'shipped')
            fail('Pesanan harus dikirim terlebih dahulu.', 409, 'invalid_status');
          for (const row of order.inventory) this.adjustStats(row.key, -row.units, row.units);
          order.inventoryReserved = false;
          order.status = 'completed';
          order.shipping.deliveredAt = time;
          if (isCOD(order)) {
            order.payment.status = 'paid';
            order.payment.paidAt = time;
            order.payment.recordedBy = user.id;
            order.payment.simulation = false;
          }
          kind = 'orderCompleted';
        } else fail('Tindakan tidak tersedia.');
      }
      order.revision++;
      if (kind) order = withNotificationEvent(order, kind, time);
      this.writeOrder(order);
      if (kind) this.messages?.enqueue(order, kind, time);
      return this.publicOrder(order);
    });
  }
}
