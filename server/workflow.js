import { randomUUID, createHash } from 'node:crypto';
import { CatalogError } from './catalog.js';
import { packagingValues, sizeKey, packagingLabel } from '../src/data/productPackaging.js';
import { paymentMethod } from '../src/state/paymentMethods.js';
import { shippingOptions } from '../src/data/shippingOptions.js';
import { normalizeWhatsApp } from '../src/state/whatsappModel.js';
import { withNotificationEvent } from '../src/state/orderNotifications.js';

const fail = (message, status = 422, code = 'validation_error') => { throw new CatalogError(message, status, code); };
const keyOf = (groupId, variant) => `${groupId}:${sizeKey(variant)}`;
const isCOD = (order) => order.payment.groupId === 'cod';
const text = (value, min, max, label) => { if (typeof value !== 'string' || value.trim().length < min || value.length > max) fail(`${label} tidak valid.`); return value.trim(); };
const copy = (value) => JSON.parse(JSON.stringify(value));
export class WorkflowRepository {
  constructor(db, catalog, company, now = () => Date.now()) {
    this.db = db; this.catalog = catalog; this.company = company; this.now = now;
    db.exec(`CREATE TABLE IF NOT EXISTS inventory (stock_key TEXT PRIMARY KEY, available INTEGER NOT NULL CHECK(available>=0), revision INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), request_key TEXT NOT NULL, request_hash TEXT NOT NULL, created_at INTEGER NOT NULL, status TEXT NOT NULL, revision INTEGER NOT NULL, data TEXT NOT NULL, UNIQUE(user_id,request_key));
      CREATE TABLE IF NOT EXISTS inventory_events (id INTEGER PRIMARY KEY, stock_key TEXT NOT NULL, actor_id TEXT, order_id TEXT, action TEXT NOT NULL, delta INTEGER NOT NULL, available_after INTEGER NOT NULL, created_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS orders_owner_date ON orders(user_id,created_at DESC,id DESC);
      CREATE INDEX IF NOT EXISTS orders_status ON orders(status);
      CREATE TABLE IF NOT EXISTS workflow_migrations(id INTEGER PRIMARY KEY CHECK(id=1), actor_id TEXT NOT NULL, created_at INTEGER NOT NULL);`);
    db.exec('CREATE TABLE IF NOT EXISTS order_images (hash TEXT PRIMARY KEY, content_type TEXT NOT NULL, bytes BLOB NOT NULL); CREATE TABLE IF NOT EXISTS workflow_meta (id INTEGER PRIMARY KEY CHECK(id=1))');
    this.transaction(() => {
      const first = !db.prepare('SELECT id FROM workflow_meta WHERE id=1').get();
      this.ensureInventory(first && company.snapshot().mode === 'demo' ? 120 : 0);
      if (first) db.prepare('INSERT INTO workflow_meta VALUES(1)').run();
      this.expireInside();
    });
  }
  transaction(callback) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = callback(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  catalogItems() {
    return this.catalog.snapshot().edits.flatMap((draft) => draft.variants.map((variant) => ({ draft, variant, key: keyOf(draft.groupId, variant) })));
  }
  ensureInventory(initial = 0) {
    const insert = this.db.prepare('INSERT OR IGNORE INTO inventory(stock_key,available) VALUES(?,?)');
    for (const entry of this.catalogItems()) insert.run(entry.key, initial);
  }
  event(key, delta, action, actor = null, order = null) {
    const row = this.db.prepare('SELECT available FROM inventory WHERE stock_key=?').get(key);
    this.db.prepare('INSERT INTO inventory_events(stock_key,actor_id,order_id,action,delta,available_after,created_at) VALUES(?,?,?,?,?,?,?)').run(key, actor, order, action, delta, row.available, this.now());
  }
  writeOrder(order) {
    this.db.prepare('UPDATE orders SET status=?,revision=?,data=? WHERE id=?').run(order.status, order.revision, JSON.stringify(order), order.id);
  }
  release(order, action, actor) {
    if (order.inventoryReleased) return;
    for (const row of order.inventory) {
      this.db.prepare('UPDATE inventory SET available=available+?,revision=revision+1 WHERE stock_key=?').run(row.units, row.key);
      this.event(row.key, row.units, action, actor, order.id);
    }
    order.inventoryReleased = true;
  }
  expireInside() {
    for (const row of this.db.prepare("SELECT data FROM orders WHERE status='awaiting_payment'").all()) {
      let order = JSON.parse(row.data);
      if (order.payment.expiresAt > this.now()) continue;
      this.release(order, 'expire', null); order.status = 'expired'; order.payment.status = 'expired'; order.revision++;
      order = withNotificationEvent(order, 'paymentExpired', order.payment.expiresAt); this.writeOrder(order);
    }
  }
  tick() { return this.transaction(() => this.expireInside()); }
  stock() {
    return this.transaction(() => {
      this.ensureInventory(); this.expireInside(); const result = {};
      for (const key of new Set(this.catalogItems().map((entry) => entry.key))) {
        const row = this.db.prepare('SELECT available,revision FROM inventory WHERE stock_key=?').get(key); result[key] = { ...row };
      }
      return { version: 1, stock: result, canImportPreview: !this.db.prepare('SELECT id FROM workflow_migrations WHERE id=1').get() && !this.db.prepare('SELECT id FROM orders LIMIT 1').get() && !this.db.prepare('SELECT stock_key FROM inventory WHERE revision>0 LIMIT 1').get() };
    });
  }
  setStock(user, body) {
    if (user.role !== 'admin') fail('Hanya admin yang dapat mengubah stok.', 403, 'forbidden');
    if (typeof body?.key !== 'string' || !Number.isSafeInteger(body.available) || body.available < 0 || body.available > 1_000_000_000 || !Number.isSafeInteger(body.revision)) fail('Isi jumlah stok dan versi data yang valid.');
    this.transaction(() => {
      this.ensureInventory(); this.expireInside();
      if (!this.catalogItems().some((entry) => entry.key === body.key)) fail('Ukuran produk tidak ditemukan.', 404, 'not_found');
      const before = this.db.prepare('SELECT available,revision FROM inventory WHERE stock_key=?').get(body.key);
      if (before.revision !== body.revision) fail('Stok berubah sejak form dibuka. Muat data terbaru dan periksa jumlahnya kembali.', 409, 'revision_conflict');
      this.db.prepare('UPDATE inventory SET available=?,revision=revision+1 WHERE stock_key=?').run(body.available, body.key);
      this.event(body.key, body.available - before.available, 'adjust', user.id);
    });
    return this.stock();
  }
  importStock(user, body) {
    if (user.role !== 'admin') fail('Akses admin diperlukan.', 403, 'forbidden');
    if (!Array.isArray(body?.rows) || !body.rows.length || body.rows.length > 5000) fail('Daftar stok impor tidak valid.');
    this.transaction(() => {
      this.ensureInventory();
      if (this.db.prepare('SELECT id FROM workflow_migrations WHERE id=1').get() || this.db.prepare('SELECT id FROM orders LIMIT 1').get() || this.db.prepare('SELECT stock_key FROM inventory WHERE revision>0 LIMIT 1').get()) fail('Impor awal sudah ditutup karena stok atau pesanan server telah digunakan.', 409, 'import_closed');
      const keys = new Set(this.catalogItems().map((entry) => entry.key)); const seen = new Set();
      for (const row of body.rows) {
        if (!keys.has(row?.key) || seen.has(row.key) || !Number.isSafeInteger(row.available) || row.available < 0 || row.available > 1_000_000_000 || row.revision !== 0) fail('Periksa ukuran produk dan angka stok impor.');
        seen.add(row.key);
        const previous = this.db.prepare('SELECT available FROM inventory WHERE stock_key=?').get(row.key).available;
        this.db.prepare('UPDATE inventory SET available=?,revision=revision+1 WHERE stock_key=?').run(row.available, row.key);
        this.event(row.key, row.available - previous, 'preview_import', user.id);
      }
      this.db.prepare('INSERT INTO workflow_migrations VALUES(1,?,?)').run(user.id, this.now());
    });
    return this.stock();
  }
  publicOrder(order) {
    const value = copy(order);
    if (!value.requestKey) value.requestKey = this.db.prepare('SELECT request_key FROM orders WHERE id=?').get(order.id)?.request_key;
    value.items.forEach((item, index) => { if (item.details.image) item.details.image = `/api/orders/${encodeURIComponent(order.id)}/images/${index}`; });
    return value;
  }
  owned(user, id) {
    const row = this.db.prepare('SELECT user_id,data FROM orders WHERE id=?').get(id);
    if (!row || (row.user_id !== user.id && user.role !== 'admin')) fail('Pesanan tidak ditemukan pada akun Anda.', 404, 'not_found');
    return JSON.parse(row.data);
  }
  get(user, id) { this.tick(); return this.publicOrder(this.owned(user, id)); }
  image(user, id, index) {
    const order = this.owned(user, id); const image = order.items[index]?.details.image;
    if (!image) fail('Foto pesanan tidak ditemukan.', 404, 'not_found');
    if (/^[a-f\d]{64}$/.test(image)) {
      const asset = this.db.prepare('SELECT content_type,bytes FROM order_images WHERE hash=?').get(image);
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
    const bytes = Buffer.from(match[2], 'base64'); const hash = createHash('sha256').update(bytes).digest('hex');
    this.db.prepare('INSERT OR IGNORE INTO order_images VALUES(?,?,?)').run(hash, match[1], bytes);
    return hash;
  }
  list(user, { admin = false, before = '' } = {}) {
    if (admin && user.role !== 'admin') fail('Akses admin diperlukan.', 403, 'forbidden');
    this.tick();
    const where = []; const params = [];
    if (!admin) { where.push('user_id=?'); params.push(user.id); }
    if (before) {
      const cursor = this.db.prepare('SELECT created_at,id,user_id FROM orders WHERE id=?').get(before);
      if (!cursor || (!admin && cursor.user_id !== user.id)) fail('Batas halaman tidak ditemukan pada akun Anda.', 404, 'not_found');
      where.push('(created_at<? OR (created_at=? AND id<?))'); params.push(cursor.created_at, cursor.created_at, cursor.id);
    }
    const rows = this.db.prepare(`SELECT data FROM orders${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC,id DESC LIMIT 51`).all(...params);
    return { version: 1, orders: rows.slice(0, 50).map((row) => this.publicOrder(JSON.parse(row.data))), nextCursor: rows.length > 50 ? JSON.parse(rows[49].data).id : null };
  }
  create(user, body) {
    const requestKey = text(body?.requestKey, 36, 36, 'Nomor permintaan');
    if (!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(requestKey)) fail('Nomor permintaan tidak valid.');
    const recipient = text(body.recipient, 2, 100, 'Nama penerima'); const address = text(body.address, 10, 500, 'Alamat');
    const note = text(body.note ?? '', 0, 300, 'Catatan'); const payment = paymentMethod(body.paymentId); const shipping = shippingOptions.find((entry) => entry.id === body.shippingId);
    if (!payment || !shipping) fail('Pilih metode pembayaran dan pengiriman yang tersedia.');
    if (!Array.isArray(body.items) || !body.items.length || body.items.length > 100) fail('Isi keranjang tidak valid.');
    const seen = new Set();
    const requested = body.items.map((row) => {
      if (!row || typeof row.id !== 'string' || seen.has(row.id.toLowerCase()) || !Number.isSafeInteger(row.quantity) || row.quantity < 1 || row.quantity > 99 || !Number.isSafeInteger(row.expectedPrice) || row.expectedPrice <= 0) fail('SKU, harga, atau jumlah barang tidak valid.');
      seen.add(row.id.toLowerCase()); return { id: row.id, quantity: row.quantity, expectedPrice: row.expectedPrice };
    }).sort((a, b) => a.id.localeCompare(b.id));
    const whatsapp = { optedIn: body.whatsappOptIn === true, number: body.whatsappOptIn === true ? normalizeWhatsApp(body.whatsappNumber) : '', simulation: true };
    if (whatsapp.optedIn && !whatsapp.number) fail('Nomor WhatsApp tidak valid.');
    const requestHash = createHash('sha256').update(JSON.stringify({ recipient, address, note, paymentId: payment.id, shippingId: shipping.id, requested, whatsapp })).digest('hex');
    return this.transaction(() => {
      this.ensureInventory(); this.expireInside();
      const previous = this.db.prepare('SELECT request_hash,data FROM orders WHERE user_id=? AND request_key=?').get(user.id, requestKey);
      if (previous) { if (previous.request_hash !== requestHash) fail('Nomor permintaan sudah digunakan untuk isian berbeda.', 409, 'request_conflict'); return this.publicOrder(JSON.parse(previous.data)); }
      const catalog = this.catalogItems(); const allocations = new Map();
      const items = requested.map((entry) => {
        const found = catalog.find(({ variant }) => variant.id === entry.id);
        if (!found) fail('Barang pada keranjang sudah tidak tersedia. Periksa katalog kembali.', 409, 'catalog_changed');
        const { draft, variant, key } = found; const price = Number(variant.price);
        if (price !== entry.expectedPrice) fail('Harga produk berubah. Periksa keranjang dan gunakan harga terbaru.', 409, 'price_changed');
        const pack = packagingValues(variant); const sizeLabel = `${Number(variant.sizeValue)}${variant.sizeUnit}`;
        allocations.set(key, (allocations.get(key) || 0) + entry.quantity * pack.unitsPerPackage);
        const photos = variant.gallery ?? draft.gallery ?? []; const image = photos[0]?.src || (variant.gallery ? '' : draft.image) || '';
        const name = `${draft.baseName} ${sizeLabel}${pack.packagingType === 'satuan' ? '' : ' · ' + packagingLabel(variant)}`;
        return { id: variant.id, name, price, quantity: entry.quantity, details: { name: draft.baseName, brand: draft.brand, sizeLabel, packaging: { ...pack, sizeLabel }, image: this.saveImage(image), imageAlt: photos[0]?.alt || draft.imageAlt || draft.baseName, icon: '📦', color: draft.color } };
      });
      const id = 'BAM-' + randomUUID().toUpperCase(); const time = this.now();
      for (const [key, units] of allocations) {
        if (!this.db.prepare('UPDATE inventory SET available=available-?,revision=revision+1 WHERE stock_key=? AND available>=?').run(units, key, units).changes) fail('Stok tidak cukup. Periksa jumlah barang sebelum mencoba lagi.', 409, 'insufficient_stock');
        this.event(key, -units, 'reserve', user.id, id);
      }
      const subtotal = items.reduce((sum, entry) => sum + entry.price * entry.quantity, 0);
      let order = { id, requestKey, userId: user.id, createdAt: time, recipient, address, note, items, subtotal, total: subtotal + shipping.cost, revision: 0, storage: 'server', simulation: false,
        shipping: { id: shipping.id, label: shipping.label, cost: shipping.cost, simulation: true }, payment: { ...payment, status: payment.groupId === 'cod' ? 'pay_on_delivery' : 'pending', simulation: true, ...(payment.groupId !== 'cod' ? { expiresAt: time + 86400000 } : {}) },
        status: payment.groupId === 'cod' ? 'processing' : 'awaiting_payment', whatsapp, inventory: [...allocations].map(([key, units]) => ({ key, units })), inventoryReleased: false };
      order = withNotificationEvent(order, 'orderCreated', time);
      this.db.prepare('INSERT INTO orders VALUES(?,?,?,?,?,?,?,?)').run(id, user.id, requestKey, requestHash, time, order.status, order.revision, JSON.stringify(order));
      return this.publicOrder(order);
    });
  }
  update(user, id, body) {
    return this.transaction(() => {
      this.expireInside(); let order = this.owned(user, id); const action = body?.action;
      if (!Number.isSafeInteger(body?.revision) || body.revision !== order.revision) fail('Pesanan berubah. Muat data terbaru sebelum melanjutkan.', 409, 'revision_conflict');
      const time = this.now(); let kind;
      if (action === 'cancel') {
        if (['cancelled', 'expired', 'shipped', 'completed'].includes(order.status) || order.payment.status === 'paid') fail('Pesanan ini tidak dapat dibatalkan.', 409, 'invalid_status');
        order.cancellationReason = text(body.reason || 'Berubah pikiran', 2, 200, 'Alasan pembatalan'); this.release(order, 'cancel', user.id);
        order.status = 'cancelled'; order.cancelledAt = time; order.payment.status = 'cancelled'; kind = 'orderCancelled';
      } else {
        if (user.role !== 'admin') fail('Hanya admin yang dapat mencatat pembayaran dan pengiriman.', 403, 'forbidden');
        if (action === 'paid') {
          if (order.status !== 'awaiting_payment' || isCOD(order)) fail('Status pembayaran sudah berubah.', 409, 'invalid_status');
          order.payment.reference = text(body.reference, 3, 100, 'Referensi pembayaran manual');
          order.payment.status = 'paid'; order.payment.paidAt = time; order.payment.recordedBy = user.id; order.payment.simulation = false; order.status = 'processing'; kind = 'paymentReceived';
        } else if (action === 'ship') {
          if (order.status !== 'processing' || (!isCOD(order) && order.payment.status !== 'paid')) fail('Pesanan belum siap dikirim.', 409, 'invalid_status');
          order.shipping.courier = text(body.courier, 2, 100, 'Kurir'); order.shipping.trackingNumber = text(body.trackingNumber, 2, 100, 'Nomor resi');
          order.shipping.shippedAt = time; order.shipping.recordedBy = user.id; order.status = 'shipped'; kind = 'orderShipped';
        } else if (action === 'complete') {
          if (order.status !== 'shipped') fail('Pesanan harus dikirim terlebih dahulu.', 409, 'invalid_status');
          order.status = 'completed'; order.shipping.deliveredAt = time;
          if (isCOD(order)) { order.payment.status = 'paid'; order.payment.paidAt = time; order.payment.recordedBy = user.id; order.payment.simulation = false; }
          kind = 'orderCompleted';
        } else fail('Tindakan tidak tersedia.');
      }
      order.revision++; if (kind) order = withNotificationEvent(order, kind, time); this.writeOrder(order); return this.publicOrder(order);
    });
  }
}
