import { createHash } from 'node:crypto';
import { CatalogError } from './catalog.js';

// Home page banners, edited by Admin/Pemilik. Stored as one document with a revision, so two
// admins cannot silently overwrite each other. Until the first save the store shows the
// automatic per-category banners.

export const MAX_BANNERS = 12;
export const BANNER_THEMES = ['snack', 'beauty', 'spice', 'home'];
export const BANNER_TARGETS = ['catalog', 'category', 'supplier', 'brand', 'product'];
export const BANNER_PHOTO_PATH = /^\/api\/home\/banners\/photos\/([a-f0-9]{64})\.(jpg|png|webp)$/;
const PHOTO_DATA = /^data:(image\/(png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
const PHOTO_EXTENSION = { png: 'png', jpeg: 'jpg', webp: 'webp' };
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const fail = (message, status = 422, code = 'validation_error') => {
  throw new CatalogError(message, status, code);
};
const text = (value, max, label, { min = 0 } = {}) => {
  const result = typeof value === 'string' ? value.trim() : '';
  if (result.length < min || result.length > max)
    fail(
      min
        ? `${label} wajib diisi, maksimal ${max} karakter.`
        : `${label} maksimal ${max} karakter.`,
    );
  return result;
};
const validDate = (value) => {
  if (!DATE.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
/** Today in Indonesia (WIB), as YYYY-MM-DD: schedules follow the store's calendar. */
export const jakartaDate = (time) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(time));

function photoAsset(dataUrl) {
  const match = PHOTO_DATA.exec(dataUrl);
  if (!match) return null;
  const bytes = Buffer.from(match[3], 'base64');
  const hash = createHash('sha256').update(bytes).digest('hex');
  return {
    hash,
    bytes,
    contentType: match[1],
    path: `/api/home/banners/photos/${hash}.${PHOTO_EXTENSION[match[2]]}`,
  };
}

/** Shown when the visitor's date is within the schedule and the banner is not hidden. */
export function bannerVisible(banner, today) {
  return (
    banner.active &&
    (!banner.startsOn || today >= banner.startsOn) &&
    (!banner.endsOn || today <= banner.endsOn)
  );
}

export class BannerRepository {
  constructor(db, { now = Date.now } = {}) {
    Object.assign(this, { db, now });
    db.exec(`CREATE TABLE IF NOT EXISTS home_banners (
      id INTEGER PRIMARY KEY CHECK(id=1),
      revision INTEGER NOT NULL,
      configured INTEGER NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT,
      updated_by TEXT
    )`);
    db.prepare(
      "INSERT OR IGNORE INTO home_banners(id,revision,configured,data) VALUES(1,0,0,'[]')",
    ).run();
  }
  stored() {
    const row = this.db.prepare('SELECT * FROM home_banners WHERE id=1').get();
    return {
      revision: row.revision,
      configured: row.configured === 1,
      banners: JSON.parse(row.data),
    };
  }
  /** Stored photos are data URLs; responses carry their cacheable URL instead. */
  withPhotoPaths(banners) {
    return banners.map((banner) =>
      banner.image ? { ...banner, image: photoAsset(banner.image)?.path || '' } : banner,
    );
  }
  admin() {
    const state = this.stored();
    return {
      ...state,
      today: jakartaDate(this.now()),
      banners: this.withPhotoPaths(state.banners),
    };
  }
  /** What the store shows today: hidden and out-of-schedule banners never leave the server. */
  public() {
    const state = this.stored();
    const today = jakartaDate(this.now());
    return {
      configured: state.configured,
      banners: this.withPhotoPaths(state.banners.filter((banner) => bannerVisible(banner, today))),
    };
  }
  photo(hash) {
    for (const banner of this.stored().banners) {
      const asset = banner.image && photoAsset(banner.image);
      if (asset?.hash === hash) return asset;
    }
    return null;
  }
  normalize(input, index, existing, ids) {
    const label = `Banner ${index + 1}`;
    if (!input || typeof input !== 'object') fail(`${label} tidak valid.`);
    const id = typeof input.id === 'string' ? input.id : '';
    if (!/^[a-z0-9-]{1,40}$/.test(id)) fail(`${label}: kode banner tidak valid.`);
    if (ids.has(id)) fail(`${label}: kode banner ganda.`);
    ids.add(id);
    const title = text(input.title, 90, `${label}: judul`, { min: 1 });
    if (title.split('\n').length > 2) fail(`${label}: judul paling banyak 2 baris.`);
    const startsOn = typeof input.startsOn === 'string' ? input.startsOn : '';
    const endsOn = typeof input.endsOn === 'string' ? input.endsOn : '';
    if ((startsOn && !validDate(startsOn)) || (endsOn && !validDate(endsOn)))
      fail(`${label}: tanggal jadwal tidak valid.`);
    if (startsOn && endsOn && endsOn < startsOn)
      fail(`${label}: tanggal selesai harus sama atau setelah tanggal mulai.`);
    const target = input.target && typeof input.target === 'object' ? input.target : {};
    if (!BANNER_TARGETS.includes(target.type)) fail(`${label}: tujuan tombol tidak valid.`);
    const targetId = target.type === 'catalog' ? '' : text(target.id, 120, `${label}: tujuan`);
    if (target.type !== 'catalog' && !targetId) fail(`${label}: pilih tujuan tombol.`);
    if (!BANNER_THEMES.includes(input.theme)) fail(`${label}: warna tema tidak valid.`);
    const media = input.media === 'image' ? 'image' : 'products';
    const productIds = Array.isArray(input.productIds) ? input.productIds : [];
    if (
      productIds.length > 2 ||
      productIds.some((id) => typeof id !== 'string' || !id || id.length > 120)
    )
      fail(`${label}: pilih paling banyak 2 produk.`);
    let image = '';
    if (typeof input.image === 'string' && input.image) {
      // An unchanged photo comes back as its URL; keep the stored data behind it.
      const kept = existing.find((photo) => photo.path === input.image);
      if (kept) image = kept.dataUrl;
      else {
        const asset = photoAsset(input.image);
        if (!asset) fail(`${label}: gambar harus JPG, PNG, atau WebP.`);
        if (asset.bytes.length > MAX_PHOTO_BYTES) fail(`${label}: gambar maksimal 3 MB.`);
        image = input.image;
      }
    }
    if (media === 'image' && !image)
      fail(`${label}: unggah gambar banner atau pilih kartu produk.`);
    return {
      id,
      active: input.active !== false,
      startsOn,
      endsOn,
      label: text(input.label, 60, `${label}: label kecil`),
      title,
      description: text(input.description, 220, `${label}: deskripsi`),
      cta: text(input.cta, 30, `${label}: teks tombol`, { min: 1 }),
      target: { type: target.type, id: targetId },
      theme: input.theme,
      media,
      productIds: [...new Set(productIds)],
      image: media === 'image' ? image : '',
      imageAlt: media === 'image' ? text(input.imageAlt, 150, `${label}: keterangan gambar`) : '',
    };
  }
  save(body, actor) {
    const db = this.db;
    db.exec('BEGIN IMMEDIATE');
    try {
      const current = this.stored();
      if (!Number.isSafeInteger(body?.revision) || body.revision !== current.revision)
        fail(
          'Banner telah diubah di tempat lain. Muat ulang halaman sebelum menyimpan lagi.',
          409,
          'banner_conflict',
        );
      if (!Array.isArray(body.banners) || body.banners.length > MAX_BANNERS)
        fail(`Simpan paling banyak ${MAX_BANNERS} banner.`);
      const existing = current.banners
        .filter((banner) => banner.image)
        .map((banner) => ({ ...photoAsset(banner.image), dataUrl: banner.image }));
      const ids = new Set();
      const banners = body.banners.map((entry, index) =>
        this.normalize(entry, index, existing, ids),
      );
      db.prepare(
        'UPDATE home_banners SET revision=revision+1,configured=1,data=?,updated_at=?,updated_by=? WHERE id=1',
      ).run(JSON.stringify(banners), new Date(this.now()).toISOString(), actor.id);
      db.exec('COMMIT');
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK');
      throw error;
    }
    return this.admin();
  }
}
