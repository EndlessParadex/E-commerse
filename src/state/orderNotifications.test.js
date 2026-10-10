import test from 'node:test';
import assert from 'node:assert/strict';
import { products } from '../data/products.js';
import { placePreviewOrder, updatePreviewOrder, PAYMENT_WINDOW } from './frontendWorkflow.js';
import { cancelOrder, readOrders, ORDER_HISTORY_KEY } from './orderModel.js';
import { emptyShop, normalizeShop, shopReducer, orderNotification } from './shopModel.js';
import { readNotificationEvents, withNotificationEvent } from './orderNotifications.js';

const storage = () => { const values = new Map(); return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; };
const input = (paymentId = 'va-bca') => ({ cart: [{ id: products[0].id, name: products[0].name, price: products[0].price, quantity: 1 }], recipient: 'Pembeli Uji', address: 'Alamat untuk pengujian', shipping: { label: 'Reguler', cost: 10000 }, payment: { id: paymentId } });
const sync = (state, target, now) => shopReducer(state, { type: 'syncOrderNotifications', orders: readOrders(target, now) });

test('notifikasi mengikuti perubahan yang tersimpan; refresh tidak menggandakan atau memulihkan yang dihapus', () => {
  const target = storage(); const now = Date.now();
  const order = placePreviewOrder(input(), target, now);
  let state = shopReducer(emptyShop(), { type: 'completeOrder', order });
  state = sync(state, target, now);
  assert.equal(state.notifications.length, 1);
  updatePreviewOrder(order.id, 'failed', target, {}, now + 10);
  state = sync(state, target, now + 10);
  assert.deepEqual(state.notifications.map((item) => item.kind), ['paymentFailed', 'orderCreated']);
  updatePreviewOrder(order.id, 'failed', target, {}, now + 11);
  assert.equal(sync(state, target, now + 11), state, 'repeated failure without retry is not a new event');
  updatePreviewOrder(order.id, 'retry', target, {}, now + 12);
  updatePreviewOrder(order.id, 'failed', target, {}, now + 13);
  state = sync(state, target, now + 13);
  assert.equal(state.notifications.filter((item) => item.kind === 'paymentFailed').length, 2, 'a distinct failed attempt is a new event');
  updatePreviewOrder(order.id, 'retry', target, {}, now + 14);
  updatePreviewOrder(order.id, 'paid', target, {}, now + 15);
  updatePreviewOrder(order.id, 'ship', target, { courier: 'Kurir Uji', trackingNumber: 'RESI' }, now + 16);
  updatePreviewOrder(order.id, 'complete', target, {}, now + 17);
  state = sync(state, target, now + 17);
  assert.deepEqual(state.notifications.slice(0, 3).map((item) => item.kind), ['orderCompleted', 'orderShipped', 'paymentReceived']);
  assert.ok(state.notifications.every((item) => item.orderId === order.id));
  const receipt = state.notificationReceipts[0].sequence;
  state = shopReducer(state, { type: 'readAll' });
  const removed = state.notifications[0];
  state = shopReducer(state, { type: 'removeNotification', id: removed.id });
  state = normalizeShop(JSON.parse(JSON.stringify(state)));
  assert.equal(sync(state, target, now + 18), state);
  assert.ok(state.notifications.every((item) => item.read));
  assert.ok(!state.notifications.some((item) => item.id === removed.id));
  assert.equal(state.notificationReceipts[0].sequence, receipt);
  state = shopReducer(state, { type: 'restoreNotification', notification: removed });
  assert.equal(state.notifications[0].id, removed.id);
  assert.equal(state.notifications[0].read, true);
  state = shopReducer(state, { type: 'removeReadNotifications' });
  assert.equal(state.notifications.length, 0);
  assert.equal(sync(normalizeShop(JSON.parse(JSON.stringify(state))), target, now + 19).notifications.length, 0);
  assert.equal(readOrders(target, now + 19)[0].status, 'completed', 'deleting notifications never deletes orders');
});

test('kedaluwarsa otomatis muncul sekali saat tab kembali dibuka; pembatalan tidak tertukar dengan kedaluwarsa', () => {
  const target = storage(); const now = Date.now();
  const expired = placePreviewOrder(input(), target, now);
  let state = sync(emptyShop(), target, now);
  state = normalizeShop(JSON.parse(JSON.stringify(state)));
  state = sync(state, target, now + PAYMENT_WINDOW);
  assert.equal(state.notifications[0].kind, 'paymentExpired');
  assert.equal(state.notifications[0].createdAt, now + PAYMENT_WINDOW);
  assert.equal(sync(state, target, now + PAYMENT_WINDOW + 1), state);
  const cancelled = placePreviewOrder(input(), target, now);
  cancelOrder(cancelled.id, 'Berubah pikiran', target);
  state = sync(state, target, now + PAYMENT_WINDOW + 1);
  assert.equal(state.notifications.filter((item) => item.kind === 'orderCancelled').length, 1);
  assert.equal(state.notifications.filter((item) => item.kind === 'paymentExpired').length, 1);
  assert.equal(readOrders(target, now + PAYMENT_WINDOW)[0].items[0].price, expired.items[0].price);
});

test('gagal menyimpan dan tindakan tidak valid tidak menambah notifikasi keberhasilan', () => {
  const target = storage(); const order = placePreviewOrder(input(), target);
  const before = target.getItem(ORDER_HISTORY_KEY); const state = sync(emptyShop(), target);
  const failing = { getItem: target.getItem, setItem: () => { throw new Error('quota'); } };
  assert.ok(updatePreviewOrder(order.id, 'paid', failing).error);
  assert.ok(cancelOrder(order.id, 'Tidak jadi', failing).error);
  assert.ok(updatePreviewOrder(order.id, 'ship', target, { courier: 'Kurir', trackingNumber: 'RESI' }).error);
  assert.equal(target.getItem(ORDER_HISTORY_KEY), before);
  assert.equal(sync(state, target), state);
});

test('notifikasi lama mempertahankan status baca; data rusak disaring dan urutan terbaru benar', () => {
  let order = { id: 'BAM-LEGACY', createdAt: 1000 };
  const legacy = { ...orderNotification(order), read: true };
  order = withNotificationEvent(order, 'orderCreated', 1000);
  order = withNotificationEvent(order, 'orderShipped', 2000);
  let state = normalizeShop({ notifications: [legacy], favoriteIds: ['favorite'], cart: [{ id: 'item', name: 'Barang', price: 1000, quantity: 1 }] });
  state = shopReducer(state, { type: 'syncOrderNotifications', orders: [order] });
  assert.equal(state.notifications.at(-1).read, true);
  assert.equal(state.notifications[0].kind, 'orderShipped');
  assert.equal(state.cart.length, 1); assert.deepEqual(state.favoriteIds, ['favorite']);
  assert.deepEqual(readNotificationEvents({ notificationEvents: [null, { kind: { toString: null }, sequence: 1, createdAt: 1000 }, { kind: 'constructor', sequence: 1, createdAt: 1000 }, { kind: 'paymentFailed', sequence: -1, createdAt: 1000 }, { kind: 'paymentFailed', sequence: 1, createdAt: Infinity }] }), []);
  const sorted = normalizeShop({ notifications: [{ ...legacy, id: 'older', createdAt: 100 }, { ...legacy, id: 'newer', createdAt: 300 }] });
  assert.deepEqual(sorted.notifications.map((item) => item.id), ['newer', 'older']);
});

test('batas 100 notifikasi tidak membuat kejadian lama muncul lagi saat sinkronisasi', () => {
  const orders = Array.from({ length: 110 }, (_, index) => withNotificationEvent({ id: 'BAM-LIMIT-' + index, createdAt: index }, 'orderCreated', index));
  let state = shopReducer(emptyShop(), { type: 'syncOrderNotifications', orders });
  assert.equal(state.notifications.length, 100);
  assert.equal(state.notifications[0].createdAt, 109);
  assert.equal(state.notifications.at(-1).createdAt, 10);
  assert.equal(state.notificationReceipts.length, 110);
  state = normalizeShop(JSON.parse(JSON.stringify(state)));
  assert.equal(shopReducer(state, { type: 'syncOrderNotifications', orders }), state);
  state = shopReducer(state, { type: 'readAll' });
  state = shopReducer(state, { type: 'removeReadNotifications' });
  assert.equal(shopReducer(state, { type: 'syncOrderNotifications', orders }).notifications.length, 0);
});

test('COD tidak menghasilkan pemberitahuan pembayaran di muka; hapus massal menjaga yang belum dibaca', () => {
  const target = storage(); const order = placePreviewOrder(input('cod'), target);
  updatePreviewOrder(order.id, 'ship', target, { courier: 'Kurir', trackingNumber: 'RESI' });
  updatePreviewOrder(order.id, 'complete', target);
  let state = sync(emptyShop(), target);
  assert.deepEqual(new Set(state.notifications.map((item) => item.kind)), new Set(['orderCreated', 'orderShipped', 'orderCompleted']));
  state = shopReducer(state, { type: 'read', id: 'order-' + order.id });
  state = shopReducer(state, { type: 'removeReadNotifications' });
  assert.equal(state.notifications.length, 2); assert.ok(state.notifications.every((item) => !item.read));
  assert.equal(sync(state, target), state);
});
