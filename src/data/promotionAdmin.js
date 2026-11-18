import { products } from './products.js';
import { packagingValues } from './productPackaging.js';
import { promotionLabel } from './promotions.js';

// Helpers for the admin "Promo" page. The server checks the same rules when saving.

const dateLabel = (value) =>
  new Date(value + 'T00:00:00').toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export function promotionStatus(promotion, today) {
  if (!promotion.active) return { id: 'hidden', label: 'Disembunyikan' };
  if (promotion.startsOn && today < promotion.startsOn)
    return { id: 'scheduled', label: 'Mulai ' + dateLabel(promotion.startsOn) };
  if (promotion.endsOn && today > promotion.endsOn)
    return { id: 'ended', label: 'Berakhir ' + dateLabel(promotion.endsOn) };
  return {
    id: 'live',
    label: promotion.endsOn ? 'Berjalan s.d. ' + dateLabel(promotion.endsOn) : 'Berjalan',
  };
}

/** Packaging word of a SKU: "dus", "pack", … or "buah" for satuan. */
export const skuUnit = (variant) => {
  const type = packagingValues(variant || {}).packagingType;
  return !type || type === 'satuan' ? 'buah' : type;
};
/** "Keripik Singkong Balado 180g · dus isi 24" */
export function skuLabel(variant) {
  const { packagingType, unitsPerPackage } = packagingValues(variant || {});
  return (
    variant.name +
    ' · ' +
    (packagingType && packagingType !== 'satuan'
      ? `${packagingType} isi ${unitsPerPackage}`
      : 'satuan')
  );
}
export const skuById = (id) => products.find((product) => product.id === id) || null;

/** SKUs grouped by brand for the select. */
export function skuGroups(list = products) {
  const groups = new Map();
  for (const product of list) {
    const key = product.brand || 'Tanpa merek';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(product);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'id'))
    .map(([brand, items]) => [brand, items.sort((a, b) => a.name.localeCompare(b.name, 'id'))]);
}

const overlaps = (a, b) =>
  (!a.endsOn || !b.startsOn || b.startsOn <= a.endsOn) &&
  (!b.endsOn || !a.startsOn || a.startsOn <= b.endsOn);

/** Form check: field → message. `others` are the other saved promotions. */
export function promotionErrors(draft, others = []) {
  const errors = {};
  const whole = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
  if (!draft.variantId || !skuById(draft.variantId)) errors.variantId = 'Pilih SKU produk.';
  if (!whole(draft.buy, 1, 100)) errors.buy = 'Isi jumlah beli 1–100.';
  if (!whole(draft.free, 1, 100)) errors.free = 'Isi jumlah gratis 1–100.';
  if (!whole(draft.maxFree, 0, 10000)) errors.maxFree = 'Isi 0 (tanpa batas) sampai 10.000.';
  if (draft.startsOn && draft.endsOn && draft.endsOn < draft.startsOn)
    errors.endsOn = 'Tanggal selesai harus sama atau setelah tanggal mulai.';
  if (
    !errors.variantId &&
    !errors.endsOn &&
    draft.active &&
    others.some(
      (other) =>
        other.id !== draft.id &&
        other.active &&
        other.variantId === draft.variantId &&
        overlaps(other, draft),
    )
  )
    errors.variantId =
      'SKU ini sudah punya promo aktif pada tanggal yang sama. Ubah jadwal atau sembunyikan promo lainnya.';
  return errors;
}

/** "Pembeli bayar 2 dus, terima 3 dus." */
export const promotionExample = (promotion, unit) =>
  `${promotionLabel(promotion)}: pembeli bayar ${promotion.buy} ${unit}, terima ${
    promotion.buy + promotion.free
  } ${unit}.`;
