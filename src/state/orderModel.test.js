import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrder, readOrder, saveOrder } from './orderModel.js';

const storage = () => {
  const values = new Map();
  return { setItem: (key, value) => values.set(key, value), getItem: (key) => values.get(key) || null };
};

test('order menghitung subtotal, ongkir, dan total dari cart', () => {
  const order = createOrder({
    cart: [{ id: 'snack', name: 'Keripik', price: 18000, quantity: 2 }],
    recipient: 'Endless',
    address: 'Jl. Contoh nomor 10, Tangerang',
    shipping: { label: 'Reguler', cost: 10000 },
    payment: { label: 'COD' },
  });
  assert.equal(order.subtotal, 36000);
  assert.equal(order.total, 46000);
  assert.equal(order.shipping.label, 'Reguler');
});

test('order dapat disimpan dan dibaca kembali berdasarkan id', () => {
  const target = storage();
  const order = createOrder({ cart: [], recipient: 'Endless', address: 'Jl. Contoh nomor 10', shipping: { cost: 0 }, payment: {} });
  assert.equal(saveOrder(order, target), true);
  assert.deepEqual(readOrder(order.id, target), order);
  assert.equal(readOrder('BAM-NOT-FOUND', target), null);
});
