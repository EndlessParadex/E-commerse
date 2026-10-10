export const DELIVERY_STORAGE_KEY = 'bam.delivery.v1';

export function validateDelivery(value) {
  const errors = {};
  const name = typeof value?.namaToko === 'string' ? value.namaToko.trim() : '';
  const address = typeof value?.namaJalan === 'string' ? value.namaJalan.trim() : '';
  if (name.length < 2 || name.length > 100) errors.namaToko = 'Nama penerima harus berisi 2–100 karakter.';
  if (address.length < 10 || address.length > 500) errors.namaJalan = 'Isi alamat lengkap sepanjang 10–500 karakter.';
  return errors;
}

export function normalizeDelivery(value) {
  if (Object.keys(validateDelivery(value)).length) return null;
  // Only shipping fields are retained; credentials must never be persisted here.
  return { namaToko: value.namaToko.trim(), namaJalan: value.namaJalan.trim() };
}

export function readDelivery(storage) {
  try { return normalizeDelivery(JSON.parse(storage.getItem(DELIVERY_STORAGE_KEY))); }
  catch { return null; }
}

export function writeDelivery(value, storage) {
  const normalized = normalizeDelivery(value);
  if (!normalized) return false;
  try { storage.setItem(DELIVERY_STORAGE_KEY, JSON.stringify(normalized)); return true; }
  catch { return false; }
}
