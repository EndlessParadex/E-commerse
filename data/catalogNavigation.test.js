import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogNavigationKey, shouldResetRouteScroll } from './catalogNavigation.js';

test('PT, merek dan hapus filter mempertahankan posisi pada pencarian yang sama', () => {
  for (const [previous, next] of [
    ['/cari?q=', '/pemasok/demo-pangan'],
    ['/pemasok/demo-pangan', '/pemasok/demo-beauty'],
    ['/pemasok/demo-pangan', '/pemasok/demo-pangan?merek=rasa-contoh'],
    ['/pemasok/demo-pangan?merek=rasa-contoh', '/cari?q='],
    ['/cari?q=almond', '/pemasok/demo-pangan?q=almond'],
    ['/kategori/snack', '/pemasok/demo-pangan'],
  ]) {
    assert.equal(shouldResetRouteScroll(previous, next), false);
    assert.equal(catalogNavigationKey(previous), catalogNavigationKey(next));
  }
});

test('halaman baru, pencarian baru dan route invalid tetap memulai dari atas', () => {
  for (const [previous, next] of [
    ['/', '/pemasok/demo-pangan'],
    ['/pemasok/demo-pangan', '/produk/snack-pedas'],
    ['/pemasok/demo-pangan', '/keranjang'],
    ['/produk/snack-pedas', '/pemasok/demo-pangan'],
    ['/cari?q=almond', '/cari?q=serum'],
    ['/pemasok/demo-pangan', '/pemasok/unknown'],
  ]) assert.equal(shouldResetRouteScroll(previous, next), true);
  assert.equal(catalogNavigationKey('/pemasok/unknown'), null);
  assert.equal(shouldResetRouteScroll('/keranjang', '/keranjang'), false);
});
