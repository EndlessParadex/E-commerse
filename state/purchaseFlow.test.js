import test from 'node:test';
import assert from 'node:assert/strict';
import { products } from '../data/products.js';
import { cartItemPresentation } from '../data/cartItemPresentation.js';
import { orderItemPresentation } from '../data/orderItemPresentation.js';
import { emptyShop, shopReducer, cartTotals, normalizeShop } from './shopModel.js';
import { validateDelivery } from './deliveryModel.js';
import { validateWhatsApp } from './whatsappModel.js';
import { createOrder, saveOrder, readOrder, readOrders } from './orderModel.js';

test('alur beberapa varian dari cart sampai riwayat mempertahankan ukuran jumlah harga dan notifikasi', () => {
  let state = emptyShop();
  for (const id of ['snack-pedas-23g', 'snack-pedas', 'skincare-glow-10ml', 'snack-pedas-23g']) {
    state = shopReducer(state, { type: 'add', product: products.find((item) => item.id === id) });
  }
  state = normalizeShop(JSON.parse(JSON.stringify(state)));
  assert.equal(state.cart.length, 3);
  assert.deepEqual(cartTotals(state.cart), { quantity: 4, subtotal: 54000 });
  for (const item of state.cart) assert.ok(cartItemPresentation(item).detailHref.endsWith(item.id));
  const address = { namaToko: 'Pembeli Contoh', namaJalan: 'Jalan Contoh Nomor 10, Belitung' };
  assert.deepEqual(validateDelivery(address), {});
  assert.equal(validateWhatsApp('', false), '');
  const order = createOrder({ cart: state.cart, recipient: address.namaToko, address: address.namaJalan, shipping: { label: 'Reguler', cost: 10000 }, payment: { label: 'Bayar di tempat' } });
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  assert.equal(saveOrder(order, storage), true);
  const saved = readOrder(order.id, storage);
  assert.equal(saved.total, 64000);
  assert.equal(readOrders(storage).length, 1);
  assert.deepEqual(saved.items.map((item) => orderItemPresentation(item).sizeLabel), ['23g', '180g', '10ml']);
  for (const item of saved.items) {
    const before = state.cart.find((entry) => entry.id === item.id);
    assert.equal(item.price, before.price);
    assert.equal(item.quantity, before.quantity);
  }
  state = shopReducer(state, { type: 'completeOrder', order: saved });
  assert.equal(state.cart.length, 0);
  assert.equal(state.notifications.length, 1);
  assert.equal(state.notifications[0].orderId, order.id);
});

test('kondisi kosong, data wajib invalid dan penyimpanan gagal ditangani model tanpa menghilangkan cart', () => {
  assert.deepEqual(cartTotals([]), { quantity: 0, subtotal: 0 });
  assert.ok(validateDelivery({ namaToko: '', namaJalan: '' }).namaToko);
  assert.ok(validateDelivery({ namaToko: 'Pembeli', namaJalan: '' }).namaJalan);
  assert.ok(validateWhatsApp('', true));
  const state = shopReducer(emptyShop(), { type: 'add', product: products[0] });
  const order = createOrder({ cart: state.cart, recipient: 'Pembeli', address: 'Alamat contoh lengkap', shipping: { cost: 10000 }, payment: {} });
  const before = JSON.stringify(state);
  const blocked = { getItem: () => null, setItem: () => { throw new Error('storage blocked'); } };
  assert.equal(saveOrder(order, blocked), false);
  assert.equal(JSON.stringify(state), before);
  const legacy = cartItemPresentation({ id: 'removed', name: 'Nama produk panjang yang tetap harus terlihat utuh pada keranjang lama 130g', price: 18000, quantity: 1 });
  assert.equal(legacy.sizeLabel, '130g');
  assert.equal(legacy.detailHref, '');
  assert.ok(legacy.name.includes('tetap harus terlihat utuh'));
});
