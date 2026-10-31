import test from 'node:test';
import assert from 'node:assert/strict';
import { products } from './products.js';
import { storeBuyerSelections } from './storeBuyerSelections.js';

test('store buyer homepage separates actual catalog discounts from recommendations', () => {
  const { promos, recommendations } = storeBuyerSelections(products);
  assert.equal(promos.length, 2);
  assert.equal(recommendations.length, 6);
  assert.ok(
    promos.every(
      ({ discounted, product, discount }) =>
        discounted && discount > 0 && product.oldPrice > product.price,
    ),
  );
  const ids = [...promos, ...recommendations].map(({ product }) => product.groupId || product.id);
  assert.equal(new Set(ids).size, ids.length, 'no product group is repeated across sections');
});

test('store buyer promotions never infer discounts or make duplicate entries', () => {
  const sample = [
    { id: 'a-1', groupId: 'a', price: 100, oldPrice: 200 },
    { id: 'a-2', groupId: 'a', price: 150, oldPrice: 200 },
    { id: 'b', price: 80, oldPrice: 60 },
    { id: 'c', price: 40 },
  ];
  const result = storeBuyerSelections(sample, 2, 6);
  assert.deepEqual(
    result.promos.map(({ product }) => product.id),
    ['a-1'],
  );
  assert.deepEqual(
    result.recommendations.map(({ product }) => product.id),
    ['b', 'c'],
  );
  assert.equal(result.promos[0].discount, 50);
  const noDiscount = storeBuyerSelections([{ id: 'x', price: 20 }]);
  assert.deepEqual(noDiscount.promos, []);
  assert.deepEqual(
    noDiscount.recommendations.map(({ product }) => product.id),
    ['x'],
  );
  assert.deepEqual(storeBuyerSelections([]), { promos: [], recommendations: [] });
});
