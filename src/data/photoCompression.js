import { MAX_PRODUCT_PHOTO_BYTES } from './productPhotos.js';

// Admin and buyers may pick a phone photo up to 5 MB; it is shrunk in the browser before
// saving. Saved photos stay small because photos and logos travel inside the catalog and
// account data that every page load fetches.
export const MAX_PHOTO_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_PRODUCT_UPLOAD_BYTES = MAX_PHOTO_UPLOAD_BYTES;
export const PRODUCT_PHOTO_MAX_SIDE = 1200;
// About 300 KB of image data, well under the 1 MB server limit per photo.
export const PRODUCT_PHOTO_TARGET_LENGTH = 400_000;
// Profile photos and logos are shown small; 512 px and about 150 KB are plenty.
export const SMALL_PHOTO_MAX_SIDE = 512;
export const SMALL_PHOTO_TARGET_LENGTH = 200_000;

const QUALITIES = [0.85, 0.78, 0.7, 0.62];

const loadImage = (src, ImageClass) =>
  new Promise((resolve, reject) => {
    const image = new ImageClass();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

// A 1 MB file grows to about 1.4 million characters as a base64 data URL.
const SERVER_LENGTH = Math.floor((MAX_PRODUCT_PHOTO_BYTES * 4) / 3) + 32;

/**
 * Return a data URL that fits the saved-photo limits, or null when the photo is too large
 * and the browser cannot shrink it.
 * - Small photos are kept as they are.
 * - Larger photos are resized so the long side is at most `maxSide`.
 * - By default they are re-encoded as JPEG on white. With `keepTransparency` (logos), PNG and
 *   WebP keep their transparent background: WebP when the browser can encode it, else PNG.
 */
export async function shrinkPhoto(
  dataUrl,
  {
    maxSide = PRODUCT_PHOTO_MAX_SIDE,
    targetLength = PRODUCT_PHOTO_TARGET_LENGTH,
    keepTransparency = false,
    ImageClass = globalThis.Image,
    documentRef = globalThis.document,
  } = {},
) {
  const image = await loadImage(dataUrl, ImageClass);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const longest = Math.max(width, height);
  if (dataUrl.length <= targetLength && longest <= maxSide) return dataUrl;

  const canvas = documentRef?.createElement?.('canvas');
  const context = canvas?.getContext?.('2d');
  if (!context || !longest) return dataUrl.length <= SERVER_LENGTH ? dataUrl : null;

  const transparent = keepTransparency && /^data:image\/(png|webp)/.test(dataUrl);
  const encode = (quality) => {
    if (!transparent) return canvas.toDataURL('image/jpeg', quality);
    const webp = canvas.toDataURL('image/webp', quality);
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
  };
  const valid = (result) => /^data:image\/(jpeg|png|webp);base64,/.test(result);

  let scale = Math.min(1, maxSide / longest);
  let last = '';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    context.clearRect?.(0, 0, canvas.width, canvas.height);
    if (!transparent) {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of QUALITIES) {
      last = encode(quality);
      if (valid(last) && last.length <= targetLength) return last;
    }
    scale *= 0.75;
  }
  return valid(last) && last.length <= SERVER_LENGTH ? last : null;
}

/** Product photos: up to 1200 px, JPEG on white. */
export const shrinkProductPhoto = (dataUrl, options = {}) => shrinkPhoto(dataUrl, options);
