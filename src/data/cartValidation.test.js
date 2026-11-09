import test from 'node:test';
import assert from 'node:assert/strict';
import { availableCartItems, cartCounts } from './cartValidation.js';
import { cartTotals } from '../state/shopModel.js';
import { fastOrderTotals } from './fastOrder.js';

const catalog = [{ id: 'ADA-70G' }, { id: 'ADA-20G' }];
const cart = [
  { id: 'ADA-70G', price: 128000, quantity: 1 },
  { id: 'HILANG', price: 18000, quantity: 2 },
  { id: 'ADA-20G', price: 108000, quantity: 2 },
];

test('SKU yang sudah dihapus tidak ikut dihitung di total keranjang', () => {
  assert.deepEqual(
    availableCartItems(cart, catalog).map((item) => item.id),
    ['ADA-70G', 'ADA-20G'],
  );
  assert.deepEqual(cartTotals(availableCartItems(cart, catalog)), {
    quantity: 3,
    subtotal: 344000,
  });
  assert.deepEqual(availableCartItems(null, catalog), []);
});

test('Order Cepat menghitung total tanpa SKU yang sudah dihapus', () => {
  const totals = fastOrderTotals({ items: cart }, catalog);
  assert.equal(totals.sku, 2);
  assert.equal(totals.packages, 3);
});

test('jumlah SKU dan kemasan di header dan ringkasan memakai definisi yang sama', () => {
  assert.deepEqual(cartCounts(cart, catalog), { lines: 2, packages: 3, unavailable: 1 });
  assert.deepEqual(cartCounts(undefined, catalog), { lines: 0, packages: 0, unavailable: 0 });
});
