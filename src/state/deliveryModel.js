import { companyStorageKey } from '../data/companyStore.js';
import { composeAddress, findVillage, validateArea } from '../data/belitungRegions.js';
export const DELIVERY_STORAGE_KEY = 'bam.delivery.v1';

export function validateDelivery(value) {
  const errors = {};
  const name = typeof value?.namaToko === 'string' ? value.namaToko.trim() : '';
  const address = typeof value?.namaJalan === 'string' ? value.namaJalan.trim() : '';
  if (name.length < 2 || name.length > 100)
    errors.namaToko = 'Nama penerima harus berisi 2–100 karakter.';
  if (address.length < 10 || address.length > 500)
    errors.namaJalan = 'Isi alamat lengkap sepanjang 10–500 karakter.';
  return errors;
}

export function normalizeDelivery(value) {
  if (Object.keys(validateDelivery(value)).length) return null;
  // Only shipping fields are retained; credentials must never be persisted here.
  const area =
    typeof value.jalan === 'string' && findVillage(value.desa)
      ? { jalan: value.jalan.trim(), desa: value.desa }
      : {};
  return { namaToko: value.namaToko.trim(), namaJalan: value.namaJalan.trim(), ...area };
}

/** Delivery fields of a signed-in account; `jalan`/`desa` are empty for a pre-picker address. */
export const accountDelivery = (user) =>
  user
    ? normalizeDelivery({
        namaToko: user.name,
        namaJalan: user.address,
        jalan: user.street || '',
        desa: user.villageCode || '',
      })
    : null;

/**
 * Form check for recipient + Belitung address. An untouched old free-text address is accepted
 * only where `allowLegacy` (checkout keeps working until the buyer edits the address).
 */
export function validateShipping(form, { allowLegacy = false } = {}) {
  const errors = {};
  const name = typeof form?.namaToko === 'string' ? form.namaToko.trim() : '';
  if (name.length < 2 || name.length > 100)
    errors.namaToko = 'Nama penerima harus berisi 2–100 karakter.';
  if (!(allowLegacy && usesLegacyAddress(form)))
    Object.assign(errors, validateArea({ jalan: form?.jalan, desa: form?.desa }));
  return errors;
}
/** An old free-text address that has not been replaced by street + desa. */
export const usesLegacyAddress = (form) =>
  Boolean(form?.legacy) && !form?.jalan?.trim() && !form?.desa;
/** Address line for a form: composed when complete, else the old free text. */
export const formAddress = (form) =>
  composeAddress(form?.jalan, form?.desa) || (usesLegacyAddress(form) ? form.legacy : '');
/** Form values from a saved delivery: old free-text addresses go to `legacy`. */
export const shippingForm = (location) => ({
  namaToko: location?.namaToko || '',
  jalan: location?.jalan || '',
  desa: location?.desa || '',
  legacy: location && !location.desa ? location.namaJalan : '',
});

export function readDelivery(storage) {
  try {
    return normalizeDelivery(JSON.parse(storage.getItem(companyStorageKey(DELIVERY_STORAGE_KEY))));
  } catch {
    return null;
  }
}

export function writeDelivery(value, storage) {
  const normalized = normalizeDelivery(value);
  if (!normalized) return false;
  try {
    storage.setItem(companyStorageKey(DELIVERY_STORAGE_KEY), JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}
