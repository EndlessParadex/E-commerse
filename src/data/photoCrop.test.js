import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FRAME,
  MAX_ZOOM,
  clampCrop,
  drawRect,
  drawnSize,
  initialCrop,
  minZoom,
  outputSide,
  panCrop,
  zoomCrop,
} from './photoCrop.js';

const near = (actual, expected, label) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: ${actual} != ${expected}`);

test('cover memenuhi bingkai dan berada di tengah; contain menampilkan seluruh foto', () => {
  // A landscape phone photo, 4000 × 3000.
  const cover = initialCrop(4000, 3000, 'cover');
  assert.equal(cover.zoom, 1);
  const drawn = drawnSize(4000, 3000, 1);
  near(drawn.height, FRAME, 'short side fills the frame');
  near(cover.x, (FRAME - drawn.width) / 2, 'centred horizontally');
  near(cover.y, 0, 'no vertical margin');

  const contain = initialCrop(4000, 3000, 'contain');
  near(contain.zoom, 0.75, 'whole photo fits');
  const fitted = drawnSize(4000, 3000, contain.zoom);
  near(fitted.width, FRAME, 'long side touches the edges');
  near(contain.y, (FRAME - fitted.height) / 2, 'white margin split top and bottom');
  assert.equal(minZoom(500, 500), 1);
});

test('geser dibatasi: foto besar tidak meninggalkan tepi kosong, foto kecil tidak keluar bingkai', () => {
  const start = initialCrop(4000, 3000, 'cover');
  const far = panCrop(start, 10_000, 10_000, 4000, 3000);
  assert.deepEqual([far.x, far.y], [0, 0]);
  const other = panCrop(start, -10_000, -10_000, 4000, 3000);
  near(other.x, FRAME - drawnSize(4000, 3000, 1).width, 'right edge stays on the frame');
  near(other.y, 0, 'height already exactly fills');

  const small = initialCrop(4000, 3000, 'contain');
  const moved = panCrop(small, 0, 10_000, 4000, 3000);
  near(moved.y, FRAME - drawnSize(4000, 3000, small.zoom).height, 'stays inside at the bottom');
  near(panCrop(small, 0, -10_000, 4000, 3000).y, 0, 'stays inside at the top');
});

test('perbesar menjaga titik di bawah jari/kursor dan dibatasi antara contain dan MAX_ZOOM', () => {
  const start = initialCrop(3000, 3000, 'cover');
  // Zoom 2× around the top-left quarter point: that photo point must stay at (250, 250).
  const zoomed = zoomCrop(start, 2, 3000, 3000, 250, 250);
  assert.equal(zoomed.zoom, 2);
  near(zoomed.x, -250, 'x keeps the focus point');
  near(zoomed.y, -250, 'y keeps the focus point');
  assert.equal(zoomCrop(start, 99, 3000, 3000).zoom, MAX_ZOOM);
  near(zoomCrop(start, 0.01, 4000, 3000).zoom, minZoom(4000, 3000), 'not below contain');
  // Zooming out again re-clamps so no empty edge appears on a covering photo.
  const back = zoomCrop(zoomed, 1, 3000, 3000, 0, 0);
  assert.deepEqual([back.x, back.y], [0, 0]);
});

test('ukuran simpan mengikuti piksel foto yang terlihat, maksimal sesuai batas', () => {
  // 4000 × 3000 at cover shows 3000 photo pixels across the frame.
  assert.equal(outputSide(initialCrop(4000, 3000), 4000, 3000, 512), 512);
  // A 300 px photo is never enlarged.
  assert.equal(outputSide(initialCrop(300, 300), 300, 300, 1200), 300);
  // Zoomed 4× into a 1200 px photo shows 300 px: save 300, not a blurry 1200.
  const close = zoomCrop(initialCrop(1200, 1200), 4, 1200, 1200);
  assert.equal(outputSide(close, 1200, 1200, 1200), 300);
});

test('posisi gambar pada hasil sebanding dengan bingkai', () => {
  const crop = clampCrop({ zoom: 2, x: -500, y: -250 }, 1000, 1000);
  const rect = drawRect(crop, 1000, 1000, 500);
  assert.deepEqual(rect, { x: -250, y: -125, width: 1000, height: 1000 });
  // Missing size from a test double does not produce NaN.
  const fallback = initialCrop(undefined, undefined);
  assert.ok([fallback.zoom, fallback.x, fallback.y].every(Number.isFinite));
});
