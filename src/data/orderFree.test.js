import test from 'node:test';
import assert from 'node:assert/strict';
import { freeNote, freeOf, orderUnits } from './orderFree.js';

test('free units: only safe positive counts, added to packages to deliver', () => {
  const line = { quantity: 4, freeQuantity: 2, promotion: { label: 'Beli 2 gratis 1' } };
  assert.equal(freeOf(line), 2);
  assert.equal(freeNote(line), '+ 2 gratis · Beli 2 gratis 1');
  for (const bad of [undefined, 0, -1, 1.5, '2'])
    assert.equal(freeOf({ quantity: 1, freeQuantity: bad }), 0, String(bad));
  assert.equal(freeNote({ quantity: 1 }), '');
  assert.equal(orderUnits({ items: [line, { quantity: 3 }] }), 9);
});
