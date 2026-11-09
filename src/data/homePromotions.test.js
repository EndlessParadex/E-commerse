import test from 'node:test';
import assert from 'node:assert/strict';
import { homePromotions } from './homePromotions.js';

test('home promo rail selects distinct catalog products, prioritizing only validated savings', () => {
  const catalog = [
    { id: 'a-small', groupId: 'a', price: 300, oldPrice: 400 },
    { id: 'a-large', groupId: 'a', price: 450, oldPrice: 500 },
    { id: 'b', price: 200, oldPrice: 0 },
    { id: 'c', price: 250, oldPrice: 500 },
    { id: 'd', price: 100, oldPrice: 100 },
  ];
  const result = homePromotions(catalog, 3);
  assert.deepEqual(
    result.items.map((entry) => entry.product.id),
    ['c', 'a-small', 'b'],
  );
  assert.equal(result.discountedCount, 2);
  assert.equal(result.items[0].discount, 50);
  assert.equal(result.items[1].discount, 25);
  assert.ok(result.items.every((entry) => entry.discounted || entry.discount === 0));
});

test('home promo rail has a truthful fallback when no discount is configured', () => {
  const result = homePromotions([
    { id: 'a', price: 1900 },
    { id: 'b', price: 2500, oldPrice: 1000 },
  ]);
  assert.equal(result.discountedCount, 0);
  assert.equal(result.items.length, 2);
  assert.ok(result.items.every((entry) => !entry.discounted));
  assert.deepEqual(homePromotions([], 4).items, []);
  assert.deepEqual(homePromotions(null, 4).items, []);
});

test('produk berfoto tampil lebih dulu di daftar dan rekomendasi', async () => {
  const { groupProducts } = await import('./products.js');
  const photo = [{ src: 'data:image/png;base64,iVBORw0KGgo=', alt: '' }];
  const items = [
    { id: 'A-1', groupId: 'a', price: 10 },
    { id: 'B-1', groupId: 'b', price: 20, gallery: photo },
    { id: 'C-1', groupId: 'c', price: 30 },
    { id: 'C-2', groupId: 'c', price: 35, gallery: photo },
    { id: 'D-1', groupId: 'd', price: 40 },
  ];
  assert.deepEqual(
    groupProducts(items).map((item) => item.groupId),
    ['b', 'c', 'a', 'd'],
    'groups with a photo on any SKU first, original order kept inside each half',
  );
  assert.deepEqual(
    homePromotions(items, 4).items.map(({ product }) => product.groupId || product.id),
    ['b', 'c', 'a', 'd'],
  );
});
