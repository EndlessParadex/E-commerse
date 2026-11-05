import { randomUUID } from 'node:crypto';
import { CatalogError } from './catalog.js';

const fail = (message, status = 422, code = 'validation_error') => {
  throw new CatalogError(message, status, code);
};
const COMMENT_LIMIT = 500;

/**
 * Product reviews written by buyers after an order is completed.
 *
 * - One review per order line (order + SKU); buyers can edit it later.
 * - Personal orders: only the account that placed the order.
 *   Store (B2B) orders: members of that store, not Sales or Admin. The review
 *   is shown under the store name.
 * - Ratings are grouped by product (all sizes and packs of one product).
 * - Admin can hide a review; hidden reviews leave the public average.
 */
export class ReviewRepository {
  constructor(db, workflow, now = () => Date.now()) {
    this.db = db;
    this.workflow = workflow;
    this.now = now;
    db.exec(`CREATE TABLE IF NOT EXISTS product_reviews (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      author_name TEXT NOT NULL,
      product_name TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment TEXT NOT NULL DEFAULT '' CHECK(length(comment) <= ${COMMENT_LIMIT}),
      hidden_at INTEGER,
      hidden_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(order_id, product_id)
    );
    CREATE INDEX IF NOT EXISTS product_reviews_group ON product_reviews(group_id, hidden_at, updated_at);`);
  }

  /** Average and count of visible reviews per product group. */
  summary() {
    const rows = this.db
      .prepare(
        'SELECT group_id, AVG(rating) AS average, COUNT(*) AS count FROM product_reviews WHERE hidden_at IS NULL GROUP BY group_id',
      )
      .all();
    return Object.fromEntries(
      rows.map((row) => [
        row.group_id,
        { average: Math.round(row.average * 10) / 10, count: row.count },
      ]),
    );
  }

  /** Visible reviews of one product, newest first. */
  forProduct(groupId, limit = 20) {
    if (typeof groupId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(groupId))
      fail('Produk tidak valid.', 404, 'not_found');
    const summary = this.summary()[groupId] || { average: 0, count: 0 };
    const reviews = this.db
      .prepare(
        `SELECT id, author_name, product_name, rating, comment, created_at, updated_at
         FROM product_reviews WHERE group_id=? AND hidden_at IS NULL
         ORDER BY updated_at DESC, id DESC LIMIT ?`,
      )
      .all(groupId, Math.min(Math.max(Number(limit) || 20, 1), 50))
      .map((row) => ({
        id: row.id,
        authorName: row.author_name,
        productName: row.product_name,
        rating: row.rating,
        comment: row.comment,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    return { ...summary, reviews };
  }

  /** The order a buyer may review, or an error explaining why not. */
  reviewableOrder(user, orderId) {
    if (typeof orderId !== 'string' || !orderId || orderId.length > 100)
      fail('Pesanan tidak ditemukan.', 404, 'not_found');
    const row = this.db.prepare('SELECT user_id, data FROM orders WHERE id=?').get(orderId);
    if (!row) fail('Pesanan tidak ditemukan pada akun Anda.', 404, 'not_found');
    const order = JSON.parse(row.data);
    const buyer = order.b2b
      ? Boolean(
          this.db
            .prepare(
              `SELECT 1 FROM b2b_store_members m JOIN b2b_stores s ON s.id=m.store_id
               WHERE m.store_id=? AND m.user_id=? AND s.active=1`,
            )
            .get(order.b2b.storeId, user.id),
        )
      : row.user_id === user.id;
    if (!buyer) fail('Hanya pembeli pesanan ini yang dapat memberi ulasan.', 403, 'forbidden');
    return order;
  }

  /** Reviews already written for one order, keyed by SKU. */
  forOrder(user, orderId) {
    const order = this.reviewableOrder(user, orderId);
    const rows = this.db
      .prepare(
        'SELECT product_id, rating, comment, hidden_at, updated_at FROM product_reviews WHERE order_id=?',
      )
      .all(order.id);
    return {
      orderId: order.id,
      canReview: order.status === 'completed',
      reviews: Object.fromEntries(
        rows.map((row) => [
          row.product_id,
          {
            rating: row.rating,
            comment: row.comment,
            hidden: row.hidden_at != null,
            updatedAt: row.updated_at,
          },
        ]),
      ),
    };
  }

  save(user, orderId, body) {
    const order = this.reviewableOrder(user, orderId);
    if (order.status !== 'completed')
      fail('Ulasan dapat diberikan setelah pesanan selesai.', 409, 'order_not_completed');
    const productId = typeof body?.productId === 'string' ? body.productId : '';
    const item = order.items?.find((entry) => entry.id === productId);
    if (!item) fail('Barang ini tidak ada di pesanan.', 404, 'not_found');
    const rating = body?.rating;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      fail('Pilih 1 sampai 5 bintang.', 422, 'validation_error');
    if (body?.comment != null && typeof body.comment !== 'string') fail('Komentar tidak valid.');
    const comment = (body?.comment || '').replace(/\s+/g, ' ').trim();
    if (comment.length > COMMENT_LIMIT)
      fail(`Komentar paling banyak ${COMMENT_LIMIT} karakter.`, 422, 'validation_error');
    // Group by product when the SKU still exists; an old SKU keeps its own group.
    const groupId =
      this.db
        .prepare('SELECT product_id FROM catalog_variants WHERE id=? COLLATE NOCASE')
        .get(productId)?.product_id || productId;
    const authorName = order.b2b?.storeName || user.name;
    const productName = item.name || item.details?.name || productId;
    const at = this.now();
    const existing = this.db
      .prepare('SELECT id FROM product_reviews WHERE order_id=? AND product_id=?')
      .get(order.id, productId);
    if (existing)
      this.db
        .prepare(
          'UPDATE product_reviews SET rating=?, comment=?, user_id=?, author_name=?, updated_at=? WHERE id=?',
        )
        .run(rating, comment, user.id, authorName, at, existing.id);
    else
      this.db
        .prepare(
          `INSERT INTO product_reviews
           (id, order_id, product_id, group_id, user_id, author_name, product_name, rating, comment, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          randomUUID(),
          order.id,
          productId,
          groupId,
          user.id,
          authorName,
          productName,
          rating,
          comment,
          at,
          at,
        );
    return this.forOrder(user, order.id);
  }

  /** Every review, including hidden ones, for the Admin page. */
  adminList(params = new URLSearchParams()) {
    const filter = params.get('filter') || 'all';
    if (!['all', 'visible', 'hidden'].includes(filter)) fail('Filter ulasan tidak valid.');
    const where =
      filter === 'visible'
        ? 'WHERE hidden_at IS NULL'
        : filter === 'hidden'
          ? 'WHERE hidden_at IS NOT NULL'
          : '';
    const reviews = this.db
      .prepare(
        `SELECT id, order_id, product_id, group_id, author_name, product_name, rating, comment, hidden_at, created_at, updated_at
         FROM product_reviews ${where} ORDER BY updated_at DESC, id DESC LIMIT 200`,
      )
      .all()
      .map((row) => ({
        id: row.id,
        orderId: row.order_id,
        productId: row.product_id,
        groupId: row.group_id,
        authorName: row.author_name,
        productName: row.product_name,
        rating: row.rating,
        comment: row.comment,
        hidden: row.hidden_at != null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    const counts = this.db
      .prepare(
        'SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN hidden_at IS NULL THEN 0 ELSE 1 END),0) AS hidden FROM product_reviews',
      )
      .get();
    return { reviews, total: counts.total, hidden: counts.hidden };
  }

  setHidden(admin, id, body) {
    if (typeof id !== 'string' || !id || id.length > 100)
      fail('Ulasan tidak ditemukan.', 404, 'not_found');
    if (typeof body?.hidden !== 'boolean') fail('Status tampil ulasan tidak valid.');
    const result = this.db
      .prepare('UPDATE product_reviews SET hidden_at=?, hidden_by=? WHERE id=?')
      .run(body.hidden ? this.now() : null, body.hidden ? admin.id : null, id);
    if (!result.changes) fail('Ulasan tidak ditemukan.', 404, 'not_found');
    return this.adminList();
  }
}
