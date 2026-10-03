import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyShop, normalizeShop, shopReducer, cartTotals } from './shopModel.js';

const product = { id: 'snack', name: 'Keripik', price: 18000 };
const add = (id = 'note-1') => ({ type: 'add', product, notification: { id, title: 'Ditambahkan', message: 'Keripik ditambahkan', createdAt: 1000, read: false } });

test('barang yang sama digabung dan subtotal mengikuti jumlah', () => {
  const state = shopReducer(shopReducer(emptyShop(), add()), add('note-2'));
  assert.equal(state.cart.length, 1);
  assert.deepEqual(cartTotals(state.cart), { quantity: 2, subtotal: 36000 });
  assert.equal(state.notifications.filter((item) => !item.read).length, 2);
});

test('batas jumlah tidak menerima nol, pecahan, negatif atau lebih dari 99', () => {
  const state = shopReducer(emptyShop(), add());
  for (const quantity of [0, -1, 1.5, 100, NaN]) {
    assert.equal(shopReducer(state, { type: 'quantity', id: product.id, quantity }), state);
  }
  const capped = shopReducer(state, { type: 'quantity', id: product.id, quantity: 99 });
  assert.equal(shopReducer(capped, add('note-2')), capped);
});

test('hapus barang terakhir mengembalikan total ke nol tanpa menghapus riwayat', () => {
  const state = shopReducer(shopReducer(emptyShop(), add()), { type: 'remove', id: product.id });
  assert.deepEqual(cartTotals(state.cart), { quantity: 0, subtotal: 0 });
  assert.equal(state.notifications.length, 1);
});

test('notifikasi dapat dibaca satu per satu, seluruhnya, dan dihapus', () => {
  let state = shopReducer(shopReducer(emptyShop(), add()), add('note-2'));
  state = shopReducer(state, { type: 'read', id: 'note-1' });
  assert.equal(state.notifications.filter((item) => !item.read).length, 1);
  state = shopReducer(state, { type: 'readAll' });
  assert.equal(state.notifications.filter((item) => !item.read).length, 0);
  state = shopReducer(state, { type: 'removeNotification', id: 'note-1' });
  assert.deepEqual(state.notifications.map((item) => item.id), ['note-2']);
});

test('data valid tetap sama setelah disimpan sebagai JSON dan dimuat ulang', () => {
  const state = shopReducer(emptyShop(), add());
  assert.deepEqual(normalizeShop(JSON.parse(JSON.stringify(state))), state);
});

test('data rusak, duplikat, harga negatif dan tanggal tidak valid disaring', () => {
  assert.deepEqual(normalizeShop(null), emptyShop());
  const validItem = { ...product, quantity: 1 };
  const state = normalizeShop({ cart: [null, validItem, validItem, { ...validItem, id: 'bad', price: -1 }], notifications: [null, { ...add().notification, createdAt: 1e30 }] });
  assert.deepEqual(state, { cart: [validItem], notifications: [] });
  assert.equal(shopReducer(emptyShop(), { type: 'add', product: { ...product, price: -1 } }).cart.length, 0);
});

test('riwayat dibatasi 100 notifikasi terbaru', () => {
  const notifications = Array.from({ length: 150 }, (_, i) => ({ ...add().notification, id: `note-${i}` }));
  const state = normalizeShop({ notifications });
  assert.equal(state.notifications.length, 100);
  assert.equal(state.notifications.at(-1).id, 'note-99');
});
