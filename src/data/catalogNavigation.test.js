import test from 'node:test';
import assert from 'node:assert/strict';
import {
  catalogNavigationKey,
  isFastOrderRoute,
  shouldResetRouteScroll,
} from './catalogNavigation.js';

test('route Order Cepat mendukung pencarian melalui URL tanpa merender 404', () => {
  for (const route of ['/order-cepat', '/order-cepat?q=balado', '/order-cepat?q=180g%20dus']) {
    assert.equal(isFastOrderRoute(route), true, route);
  }
  for (const route of ['/order-cepat/extra', '/order-cepat-other?q=test', '/cari?q=test']) {
    assert.equal(isFastOrderRoute(route), false, route);
  }
});

test('filter produk dan merek mempertahankan posisi pada pencarian yang sama', () => {
  for (const [previous, next] of [
    ['/cari?q=', '/pemasok/demo-pangan?merek=rasa-contoh'],
    ['/pemasok/demo-pangan?merek=rasa-contoh', '/pemasok/demo-pangan?merek=cokelat-contoh'],
    ['/pemasok/demo-pangan?merek=rasa-contoh', '/cari?q='],
    ['/cari?q=almond', '/pemasok/demo-pangan?q=almond&merek=rasa-contoh'],
    ['/kategori/snack', '/pemasok/demo-pangan?merek=rasa-contoh'],
  ]) {
    assert.equal(shouldResetRouteScroll(previous, next), false);
    assert.equal(catalogNavigationKey(previous), catalogNavigationKey(next));
  }
});

test('halaman baru, pencarian baru dan route invalid tetap memulai dari atas', () => {
  for (const [previous, next] of [
    ['/', '/pemasok/demo-pangan'],
    ['/cari?q=', '/pemasok/demo-pangan'],
    ['/pemasok/demo-pangan', '/pemasok/demo-beauty'],
    ['/pemasok/demo-pangan', '/pemasok/demo-pangan?merek=rasa-contoh'],
    ['/pemasok/demo-pangan?merek=rasa-contoh', '/pemasok/demo-pangan'],
    ['/cari?q=almond', '/pemasok/demo-pangan?q=almond'],
    ['/kategori/snack', '/pemasok/demo-pangan'],
    ['/pemasok/demo-pangan', '/produk/snack-pedas'],
    ['/pemasok/demo-pangan', '/keranjang'],
    ['/produk/snack-pedas', '/pemasok/demo-pangan'],
    ['/cari?q=almond', '/cari?q=serum'],
    ['/pemasok/demo-pangan', '/pemasok/unknown'],
  ])
    assert.equal(shouldResetRouteScroll(previous, next), true);
  assert.equal(catalogNavigationKey('/pemasok/unknown'), null);
  assert.equal(shouldResetRouteScroll('/keranjang', '/keranjang'), false);
});
