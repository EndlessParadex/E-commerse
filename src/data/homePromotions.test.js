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
  assert.deepEqual(result.items.map((entry) => entry.product.id), ['c', 'a-small', 'b']);
  assert.equal(result.discountedCount, 2);
  assert.equal(result.items[0].discount, 50);
  assert.equal(result.items[1].discount, 25);
  assert.ok(result.items.every((entry) => entry.discounted || entry.discount === 0));
});

test('home promo rail has a truthful fallback when no discount is configured', () => {
  const result = homePromotions([
    { id: 'a', price: 1900 }, { id: 'b', price: 2500, oldPrice: 1000 },
  ]);
  assert.equal(result.discountedCount, 0);
  assert.equal(result.items.length, 2);
  assert.ok(result.items.every((entry) => !entry.discounted));
  assert.deepEqual(homePromotions([], 4).items, []);
  assert.deepEqual(homePromotions(null, 4).items, []);
});
