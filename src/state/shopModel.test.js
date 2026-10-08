import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyShop, normalizeShop, shopReducer, cartTotals, orderNotification } from './shopModel.js';

const product = { id: 'snack', name: 'Keripik', price: 18000 };
const add = (id = 'note-1') => ({ type: 'add', product, notification: { id, title: 'Ditambahkan', message: 'Keripik ditambahkan', createdAt: 1000, read: false } });
const notes = () => normalizeShop({ notifications: [add().notification, add('note-2').notification] });

test('pesan pesanan lama diringkas tanpa mengubah ID tautan dan status dibaca', () => {
  const order = { id: 'BAM-71B010C8-B35F-4944-A0AF-321CB09725AE', createdAt: 1000 };
  const notification = { ...orderNotification(order), message: 'Pesan lama dengan nomor lengkap ' + order.id, read: true };
  const saved = normalizeShop({ notifications: [notification] }).notifications[0];
  assert.equal(saved.message, 'Pesanan #B09725AE berhasil dibuat. Lihat detail pesanan Anda.');
  assert.equal(saved.orderId, order.id);
  assert.equal(saved.read, true);
});

test('barang yang sama digabung dan subtotal mengikuti jumlah', () => {
  const state = shopReducer(shopReducer(emptyShop(), add()), add('note-2'));
  assert.equal(state.cart.length, 1);
  assert.deepEqual(cartTotals(state.cart), { quantity: 2, subtotal: 36000 });
  assert.equal(state.notifications.length, 0);
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
  const state = shopReducer(shopReducer(notes(), add()), { type: 'remove', id: product.id });
  assert.deepEqual(cartTotals(state.cart), { quantity: 0, subtotal: 0 });
  assert.equal(state.notifications.length, 2);
});

test('checkout dapat mengosongkan keranjang tanpa menghapus favorit atau notifikasi', () => {
  let state = shopReducer(notes(), add());
  state = shopReducer(state, { type: 'toggleFavorite', id: 'snack' });
  state = shopReducer(state, { type: 'clearCart' });
  assert.deepEqual(state.cart, []);
  assert.deepEqual(state.favoriteIds, ['snack']);
  assert.equal(state.notifications.length, 2);
});

test('notifikasi dapat dibaca satu per satu, seluruhnya, dan dihapus', () => {
  let state = notes();
  state = shopReducer(state, { type: 'read', id: 'note-1' });
  assert.equal(state.notifications.filter((item) => !item.read).length, 1);
  state = shopReducer(state, { type: 'readAll' });
  assert.equal(state.notifications.filter((item) => !item.read).length, 0);
  state = shopReducer(state, { type: 'removeNotification', id: 'note-1' });
  assert.deepEqual(state.notifications.map((item) => item.id), ['note-2']);
});

test('notifikasi keranjang lama dibersihkan tanpa menghapus keranjang, favorit, atau notifikasi lain', () => {
  const oldCartNote = { ...add().notification, id: 'cart-note', title: 'Ditambahkan ke keranjang' };
  const orderNote = orderNotification({ id: 'BAM-EXAMPLE', createdAt: 1000 });
  const state = normalizeShop({ cart: [{ ...product, quantity: 2 }], favoriteIds: [product.id], notifications: [oldCartNote, { ...oldCartNote, id: 'cart-kind', title: 'Keranjang', kind: 'cartAdded' }, orderNote, add('other').notification] });
  assert.equal(state.cart[0].quantity, 2);
  assert.deepEqual(state.favoriteIds, [product.id]);
  assert.deepEqual(state.notifications.map((item) => item.id), [orderNote.id, 'other']);
});

test('checkout membuat satu notifikasi tertaut dan tetap menjaga favorit', () => {
  const order = { id: 'BAM-EXAMPLE', createdAt: 1000 };
  let state = shopReducer(emptyShop(), add());
  state = shopReducer(state, { type: 'toggleFavorite', id: product.id });
  state = shopReducer(state, { type: 'completeOrder', order });
  assert.deepEqual(state.cart, []);
  assert.deepEqual(state.favoriteIds, [product.id]);
  assert.deepEqual(state.notifications, [orderNotification(order)]);
  state = shopReducer(state, { type: 'read', id: state.notifications[0].id });
  state = shopReducer(state, { type: 'completeOrder', order });
  assert.equal(state.notifications.length, 1);
  assert.equal(state.notifications[0].read, true);
  assert.deepEqual(normalizeShop(JSON.parse(JSON.stringify(state))), state);
});

test('pesanan invalid tidak membersihkan keranjang atau membuat notifikasi', () => {
  const state = shopReducer(emptyShop(), add());
  for (const order of [null, { id: '', createdAt: 100 }, { id: 'x', createdAt: 1e30 }]) {
    assert.equal(shopReducer(state, { type: 'completeOrder', order }), state);
  }
});

test('penambahan dan perubahan jumlah tidak membuat notifikasi baru', () => {
  let state = shopReducer(notes(), add());
  state = shopReducer(state, { type: 'quantity', id: product.id, quantity: 3 });
  assert.deepEqual(state.notifications, notes().notifications);
});

test('data valid tetap sama setelah disimpan sebagai JSON dan dimuat ulang', () => {
  const state = shopReducer(emptyShop(), add());
  assert.deepEqual(normalizeShop(JSON.parse(JSON.stringify(state))), state);
});

test('data rusak, duplikat, harga negatif dan tanggal tidak valid disaring', () => {
  assert.deepEqual(normalizeShop(null), emptyShop());
  const validItem = { ...product, quantity: 1 };
  const state = normalizeShop({ cart: [null, validItem, validItem, { ...validItem, id: 'bad', price: -1 }], notifications: [null, { ...add().notification, createdAt: 1e30 }] });
  assert.deepEqual(state, { cart: [validItem], notifications: [], favoriteIds: [] });
  assert.equal(shopReducer(emptyShop(), { type: 'add', product: { ...product, price: -1 } }).cart.length, 0);
});

test('riwayat dibatasi 100 notifikasi terbaru', () => {
  const notifications = Array.from({ length: 150 }, (_, i) => ({ ...add().notification, id: `note-${i}` }));
  const state = normalizeShop({ notifications });
  assert.equal(state.notifications.length, 100);
  assert.equal(state.notifications.at(-1).id, 'note-99');
});

test('favorit dapat ditambah, dihapus, disimpan, dan dibatasi', () => {
  let state = shopReducer(emptyShop(), { type: 'toggleFavorite', id: product.id });
  assert.deepEqual(state.favoriteIds, [product.id]);
  state = shopReducer(state, { type: 'toggleFavorite', id: product.id });
  assert.deepEqual(state.favoriteIds, []);
  const saved = normalizeShop({ favoriteIds: [product.id, product.id, '', 'x'.repeat(101)] });
  assert.deepEqual(saved.favoriteIds, [product.id]);
});
