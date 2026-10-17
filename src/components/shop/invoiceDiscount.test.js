import test from 'node:test';
import assert from 'node:assert/strict';
import { invoiceDiscount } from './invoiceDiscount.js';

test('discount invoice uses saved original and sale prices, not current catalog', () => {
  assert.deepEqual(invoiceDiscount({ oldPrice: 20000, price: 18000, quantity: 10 }), {
    oldPrice: 20000, price: 18000, percentage: '10', savings: 20000, subtotal: 180000,
  });
  assert.equal(invoiceDiscount({ price: 18000, quantity: 10 }), null);
  assert.equal(invoiceDiscount({ oldPrice: 18000, price: 18000, quantity: 10 }), null);
  assert.equal(invoiceDiscount({ oldPrice: 14000, price: 18000, quantity: 1 }), null);
  assert.equal(invoiceDiscount({ oldPrice: '20000', price: 18000, quantity: 1 }), null);
});
