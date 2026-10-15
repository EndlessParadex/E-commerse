export const MAX_PRODUCT_PHOTOS = 8;
export const MAX_PRODUCT_PHOTO_BYTES = 1024 * 1024;
export const MAX_PRODUCT_PHOTO_LENGTH = 1400000;

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
        typeof entry.src !== 'string' ||
        entry.src.length > MAX_PRODUCT_PHOTO_LENGTH ||
        !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(entry.src) ||
        (entry.alt !== undefined && (typeof entry.alt !== 'string' || entry.alt.length > 160)),
    )
  ) {
    return 'Gunakan foto JPG, PNG, atau WebP, maksimal 1 MB per foto.';
  }
  return '';
}
