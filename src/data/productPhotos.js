export const MAX_PRODUCT_PHOTOS = 8;
export const MAX_PRODUCT_PHOTO_BYTES = 1024 * 1024;
export const MAX_PRODUCT_PHOTO_LENGTH = 1400000;
// Saved catalog photos arrive from the server as cacheable URLs; new uploads are data URLs.
export const CATALOG_PHOTO_URL = /^\/api\/catalog\/photos\/[a-f0-9]{64}\.(jpg|png|webp)$/;
const PHOTO_DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const PHOTO_PARTS = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const PHOTO_EXTENSION = { png: 'png', jpeg: 'jpg', webp: 'webp' };
/**
 * The address the server gives a photo: a new upload (data URL) becomes
 * /api/catalog/photos/<sha256>.<ext>, exactly as server/catalog.js names it. Lets the admin
 * form confirm that the photo it sent is the photo the server saved.
 */
export async function photoIdentity(src) {
  const match = typeof src === 'string' ? PHOTO_PARTS.exec(src) : null;
  if (!match) return src || '';
  const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0));
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
  const hash = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `/api/catalog/photos/${hash}.${PHOTO_EXTENSION[match[1]]}`;
}
export const isProductPhotoSource = (value) =>
  typeof value === 'string' &&
  value.length <= MAX_PRODUCT_PHOTO_LENGTH &&
  (CATALOG_PHOTO_URL.test(value) || PHOTO_DATA_URL.test(value));

// Keep real photos only; the storefront's demo images never become saved uploads.
export function savedProductPhotos(product) {
  const gallery = Array.isArray(product.gallery) ? product.gallery : [];
  const photos = gallery
    .filter((entry) => entry && typeof entry.src === 'string' && entry.src.trim())
    .map((entry) => ({
      src: entry.src.trim(),
      alt: typeof entry.alt === 'string' ? entry.alt.trim() : '',
    }));
  if (photos.length) return photos;
  return typeof product.image === 'string' && product.image.trim()
    ? [{ src: product.image.trim(), alt: product.imageAlt || '' }]
    : [];
}

export function draftProductPhotos(draft, variant = {}) {
  if (Array.isArray(variant.gallery))
    return savedProductPhotos({ gallery: variant.gallery, image: '' });
  return savedProductPhotos({ ...draft, gallery: variant.gallery ?? draft.gallery });
}

export function galleryError(value) {
  if (!Array.isArray(value) || value.length > MAX_PRODUCT_PHOTOS)
    return `Maksimal ${MAX_PRODUCT_PHOTOS} foto per produk.`;
  if (
    value.some(
      (entry) =>
        !entry ||
        !isProductPhotoSource(entry.src) ||
        (entry.alt !== undefined && (typeof entry.alt !== 'string' || entry.alt.length > 160)),
    )
  ) {
    return 'Gunakan foto JPG, PNG, atau WebP, maksimal 1 MB per foto.';
  }
  return '';
}
