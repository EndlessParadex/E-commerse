import { CatalogError } from './catalog.js';
import { normalizeShop } from '../src/state/shopModel.js';

// Personal cart and favourites per account, so they follow the buyer across devices.
// Prices in the cart are display copies; checkout always re-reads the catalog.
export class PersonalCartRepository {
  constructor(db, now = () => Date.now()) {
    this.db = db;
    this.now = now;
    db.exec(`CREATE TABLE IF NOT EXISTS user_shop_state (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK(revision >= 0),
      updated_at INTEGER NOT NULL
    )`);
  }
  read(userId) {
    const row = this.db
      .prepare('SELECT data,revision,updated_at FROM user_shop_state WHERE user_id=?')
      .get(userId);
    const value = normalizeShop(row ? JSON.parse(row.data) : {});
    return {
      version: 1,
      revision: row?.revision || 0,
      updatedAt: row?.updated_at || null,
      cart: value.cart,
      favoriteIds: value.favoriteIds,
    };
  }
  save(userId, body) {
    if (
      !body ||
      typeof body !== 'object' ||
      !Number.isSafeInteger(body.revision) ||
      body.revision < 0 ||
      !Array.isArray(body.cart) ||
      !Array.isArray(body.favoriteIds)
    )
      throw new CatalogError('Data keranjang tidak valid.', 422, 'validation_error');
    const value = normalizeShop({ cart: body.cart, favoriteIds: body.favoriteIds });
    this.db.exec('BEGIN IMMEDIATE');
    let conflict = false;
    try {
      const current = this.db
        .prepare('SELECT revision FROM user_shop_state WHERE user_id=?')
        .get(userId);
      conflict = (current?.revision || 0) !== body.revision;
      if (!conflict)
        this.db
          .prepare(
            'INSERT INTO user_shop_state(user_id,data,revision,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,revision=excluded.revision,updated_at=excluded.updated_at',
          )
          .run(
            userId,
            JSON.stringify({ cart: value.cart, favoriteIds: value.favoriteIds }),
            body.revision + 1,
            this.now(),
          );
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    if (conflict) {
      const error = new CatalogError(
        'Keranjang diubah dari perangkat lain. Isi terbaru sudah dimuat.',
        409,
        'cart_conflict',
      );
      error.current = this.read(userId);
      throw error;
    }
    return this.read(userId);
  }
}
