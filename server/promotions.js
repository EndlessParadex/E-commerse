import { CatalogError } from './catalog.js';
import { jakartaDate, promotionRunning } from '../src/data/promotions.js';

// "Beli X gratis Y" promotions, edited by Admin/Pemilik as one revisioned list (two admins
// cannot silently overwrite each other). Orders read the list when they are created.

export const MAX_PROMOTIONS = 100;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const fail = (message, status = 422, code = 'validation_error') => {
  throw new CatalogError(message, status, code);
};
const validDate = (value) => {
  if (!DATE.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const whole = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
// Two date ranges (empty = open-ended) share at least one day.
const overlaps = (a, b) =>
  (!a.endsOn || !b.startsOn || b.startsOn <= a.endsOn) &&
  (!b.endsOn || !a.startsOn || a.startsOn <= b.endsOn);

export class PromotionRepository {
  constructor(db, { catalog, now = Date.now } = {}) {
    Object.assign(this, { db, catalog, now });
    db.exec(`CREATE TABLE IF NOT EXISTS promotions (
      id INTEGER PRIMARY KEY CHECK(id=1),
      revision INTEGER NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT,
      updated_by TEXT
    )`);
    db.prepare("INSERT OR IGNORE INTO promotions(id,revision,data) VALUES(1,0,'[]')").run();
  }
  stored() {
    const row = this.db.prepare('SELECT revision,data FROM promotions WHERE id=1').get();
    return { revision: row.revision, promotions: JSON.parse(row.data) };
  }
  today() {
    return jakartaDate(this.now());
  }
  /** What orders and store pages use today. */
  running() {
    const today = this.today();
    return this.stored().promotions.filter((promotion) => promotionRunning(promotion, today));
  }
  public() {
    return {
      today: this.today(),
      promotions: this.running().map(({ id, variantId, buy, free, maxFree, endsOn }) => ({
        id,
        variantId,
        buy,
        free,
        maxFree,
        endsOn,
        active: true,
      })),
    };
  }
  /** Free units already given per promotion, in orders that were not cancelled or expired. */
  given() {
    const rows = this.db
      .prepare(
        `SELECT json_extract(value,'$.promotion.id') AS id, SUM(json_extract(value,'$.freeQuantity')) AS units,
          COUNT(DISTINCT orders.id) AS orders
        FROM orders, json_each(orders.data,'$.items')
        WHERE json_extract(value,'$.freeQuantity')>0 AND status NOT IN ('cancelled','expired')
        GROUP BY 1`,
      )
      .all();
    return Object.fromEntries(
      rows.map((row) => [row.id, { units: row.units, orders: row.orders }]),
    );
  }
  admin() {
    return { ...this.stored(), today: this.today(), given: this.given() };
  }
  normalize(input, index, ids, variants) {
    const label = `Promo ${index + 1}`;
    if (!input || typeof input !== 'object') fail(`${label} tidak valid.`);
    const id = typeof input.id === 'string' ? input.id : '';
    if (!/^[a-z0-9-]{1,40}$/.test(id)) fail(`${label}: kode promo tidak valid.`);
    if (ids.has(id)) fail(`${label}: kode promo ganda.`);
    ids.add(id);
    if (typeof input.variantId !== 'string' || !variants.has(input.variantId))
      fail(`${label}: pilih SKU produk yang ada di katalog.`);
    if (!whole(input.buy, 1, 100)) fail(`${label}: jumlah beli harus 1–100.`);
    if (!whole(input.free, 1, 100)) fail(`${label}: jumlah gratis harus 1–100.`);
    const maxFree = input.maxFree ?? 0;
    if (!whole(maxFree, 0, 10000)) fail(`${label}: batas gratis per pesanan tidak valid.`);
    const startsOn = typeof input.startsOn === 'string' ? input.startsOn : '';
    const endsOn = typeof input.endsOn === 'string' ? input.endsOn : '';
    if ((startsOn && !validDate(startsOn)) || (endsOn && !validDate(endsOn)))
      fail(`${label}: tanggal tidak valid.`);
    if (startsOn && endsOn && endsOn < startsOn)
      fail(`${label}: tanggal selesai harus sama atau setelah tanggal mulai.`);
    const note = typeof input.note === 'string' ? input.note.trim() : '';
    if (note.length > 200) fail(`${label}: catatan maksimal 200 karakter.`);
    return {
      id,
      variantId: input.variantId,
      buy: input.buy,
      free: input.free,
      maxFree,
      startsOn,
      endsOn,
      active: input.active !== false,
      note,
    };
  }
  save(body, actor) {
    const db = this.db;
    db.exec('BEGIN IMMEDIATE');
    try {
      const current = this.stored();
      if (!Number.isSafeInteger(body?.revision) || body.revision !== current.revision)
        fail(
          'Promo telah diubah di tempat lain. Muat ulang halaman sebelum menyimpan lagi.',
          409,
          'promotion_conflict',
        );
      if (!Array.isArray(body.promotions) || body.promotions.length > MAX_PROMOTIONS)
        fail(`Simpan paling banyak ${MAX_PROMOTIONS} promo.`);
      const variants = new Map(
        this.catalog
          .snapshot()
          .edits.flatMap((draft) => draft.variants.map((variant) => [variant.id, draft.baseName])),
      );
      const ids = new Set();
      const promotions = body.promotions.map((entry, index) =>
        this.normalize(entry, index, ids, variants),
      );
      // One SKU, one running promotion per day: otherwise the free units would be ambiguous.
      promotions.forEach((a, i) =>
        promotions.slice(i + 1).forEach((b) => {
          if (a.active && b.active && a.variantId === b.variantId && overlaps(a, b))
            fail(
              `${variants.get(a.variantId)}: SKU ini sudah punya promo aktif pada tanggal yang sama. Ubah jadwal atau sembunyikan salah satu.`,
            );
        }),
      );
      db.prepare(
        'UPDATE promotions SET revision=revision+1,data=?,updated_at=?,updated_by=? WHERE id=1',
      ).run(JSON.stringify(promotions), new Date(this.now()).toISOString(), actor.id);
      db.exec('COMMIT');
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK');
      throw error;
    }
    return this.admin();
  }
}
