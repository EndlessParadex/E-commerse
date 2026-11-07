import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRODUCT_PHOTO_MAX_SIDE,
  PRODUCT_PHOTO_TARGET_LENGTH,
  shrinkProductPhoto,
} from './photoCompression.js';

const imageOf = (width, height) =>
  class {
    naturalWidth = width;
    naturalHeight = height;
    set src(value) {
      this.value = value;
      queueMicrotask(() => this.onload?.());
    }
  };

// Fake canvas: encoded size grows with pixel count and quality, like real JPEG output.
function documentWith(calls) {
  return {
    createElement: () => {
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({
          fillRect: () => calls.push(['fill', canvas.width, canvas.height]),
          drawImage: () => calls.push(['draw', canvas.width, canvas.height]),
          set fillStyle(value) {
            calls.push(['fillStyle', value]);
          },
        }),
        toDataURL: (type, quality) => {
          calls.push(['encode', type, quality]);
          return (
            `data:${type};base64,` +
            'A'.repeat(Math.round(canvas.width * canvas.height * quality * 0.4))
          );
        },
      };
      return canvas;
    },
  };
}

test('foto kecil disimpan apa adanya', async () => {
  const calls = [];
  const src = 'data:image/png;base64,' + 'A'.repeat(1000);
  const result = await shrinkProductPhoto(src, {
    ImageClass: imageOf(800, 600),
    documentRef: documentWith(calls),
  });
  assert.equal(result, src);
  assert.equal(calls.length, 0);
});

test('foto HP besar dikecilkan ke sisi 1200 px, JPEG di atas latar putih', async () => {
  const calls = [];
  const src = 'data:image/jpeg;base64,' + 'A'.repeat(4_000_000);
  const result = await shrinkProductPhoto(src, {
    ImageClass: imageOf(4000, 3000),
    documentRef: documentWith(calls),
  });
  assert.ok(result.startsWith('data:image/jpeg;base64,'));
  assert.ok(result.length <= PRODUCT_PHOTO_TARGET_LENGTH);
  const draw = calls.find((entry) => entry[0] === 'draw');
  assert.equal(Math.max(draw[1], draw[2]), PRODUCT_PHOTO_MAX_SIDE);
  assert.deepEqual(
    calls.find((entry) => entry[0] === 'fillStyle'),
    ['fillStyle', '#ffffff'],
  );
});

test('tanpa canvas, foto besar ditolak dan foto di bawah 1 MB tetap diterima', async () => {
  const noCanvas = { createElement: () => ({ getContext: () => null }) };
  const large = 'data:image/jpeg;base64,' + 'A'.repeat(2_000_000);
  assert.equal(
    await shrinkProductPhoto(large, { ImageClass: imageOf(4000, 3000), documentRef: noCanvas }),
    null,
  );
  const medium = 'data:image/jpeg;base64,' + 'A'.repeat(600_000);
  assert.equal(
    await shrinkProductPhoto(medium, { ImageClass: imageOf(2000, 1500), documentRef: noCanvas }),
    medium,
  );
});

test('gambar rusak menolak janji supaya form menampilkan pesan foto tidak terbaca', async () => {
  const Broken = class {
    set src(_value) {
      queueMicrotask(() => this.onerror?.(new Error('decode')));
    }
  };
  await assert.rejects(shrinkProductPhoto('data:image/png;base64,AAAA', { ImageClass: Broken }));
});

test('foto profil dikecilkan ke 512 px', async () => {
  const { shrinkPhoto, SMALL_PHOTO_MAX_SIDE, SMALL_PHOTO_TARGET_LENGTH } =
    await import('./photoCompression.js');
  const calls = [];
  const src = 'data:image/jpeg;base64,' + 'A'.repeat(3_000_000);
  const result = await shrinkPhoto(src, {
    maxSide: SMALL_PHOTO_MAX_SIDE,
    targetLength: SMALL_PHOTO_TARGET_LENGTH,
    ImageClass: imageOf(3000, 4000),
    documentRef: documentWith(calls),
  });
  assert.ok(result.startsWith('data:image/jpeg;base64,'));
  assert.ok(result.length <= SMALL_PHOTO_TARGET_LENGTH);
  const draw = calls.find((entry) => entry[0] === 'draw');
  assert.equal(Math.max(draw[1], draw[2]), SMALL_PHOTO_MAX_SIDE);
});

test('logo PNG tetap transparan: tidak diberi latar putih dan disimpan sebagai WebP/PNG', async () => {
  const { shrinkPhoto } = await import('./photoCompression.js');
  const calls = [];
  const src = 'data:image/png;base64,' + 'A'.repeat(1_500_000);
  const result = await shrinkPhoto(src, {
    maxSide: 512,
    targetLength: 200_000,
    keepTransparency: true,
    ImageClass: imageOf(2000, 2000),
    documentRef: documentWith(calls),
  });
  assert.match(result, /^data:image\/(webp|png);base64,/);
  assert.equal(
    calls.some((entry) => entry[0] === 'fillStyle'),
    false,
  );
});
