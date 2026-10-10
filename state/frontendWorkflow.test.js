import test from 'node:test';
import assert from 'node:assert/strict';
import { products } from '../data/products.js';
import { packagingSnapshot } from '../data/productPackaging.js';
import { cancelOrder, readOrders, ORDER_HISTORY_KEY, saveOrder } from './orderModel.js';
import { availableStock, setAvailableStock, placePreviewOrder, updatePreviewOrder, reviewStock, cartStockLimit, STOCK_KEY, PAYMENT_WINDOW } from './frontendWorkflow.js';

const storage = () => { const map = new Map(); return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) }; };
const unit = products.find((product) => product.id === 'snack-pedas');
const pack = { ...unit, id: 'WORKFLOW-PACK', name: unit.name + ' pack', packagingType: 'pack', unitsPerPackage: 6, price: 90000 };
const box = { ...unit, id: 'WORKFLOW-DUS', name: unit.name + ' dus', packagingType: 'dus', unitsPerPackage: 24, packsPerBox: 4, price: 350000 };
const input = (cart, paymentId = 'va-bca') => ({ cart: cart.map(([product, quantity]) => ({ id: product.id, name: product.name, price: product.price, quantity, packaging: packagingSnapshot(product) })), recipient: 'Pembeli', address: 'Alamat lengkap untuk pengujian', shipping: { label: 'Reguler', cost: 10000 }, payment: { id: paymentId } });
function withVariants(run) { products.push(pack, box); try { run(); } finally { products.splice(products.indexOf(pack), 2); } }

test('stok bersama menghitung satuan, pack, dus, ukuran lain, dan checkout ulang', () => withVariants(() => {
  const target = storage(); setAvailableStock(unit, 38, target);
  const cart = input([[unit, 2], [pack, 2], [box, 1]]).cart;
  assert.deepEqual(reviewStock(cart, target), []);
  assert.equal(cartStockLimit(pack, cart, target), 2);
  const order = placePreviewOrder(input([[unit, 2], [pack, 2], [box, 1]]), target);
  assert.equal(availableStock(unit, target), 0);
  assert.equal(availableStock(pack, target), 0);
  assert.equal(availableStock(products.find((product) => product.id === 'snack-pedas-23g'), target), 120);
  assert.equal(order.inventory.reduce((sum, row) => sum + row.units, 0), 38);
  assert.throws(() => placePreviewOrder(input([[unit, 1]]), target), /Stok tidak cukup/);
  assert.equal(readOrders(target).length, 1);
  assert.equal(cancelOrder(order.id, 'Berubah pikiran', target).order.status, 'cancelled');
  assert.equal(availableStock(pack, target), 38);
  assert.ok(cancelOrder(order.id, 'Lagi', target).error);
  assert.equal(availableStock(pack, target), 38, 'cancellation never restores stock twice');
}));

test('pembayaran gagal dapat dicoba kembali; berhasil terkunci dan stok tetap dialokasikan', () => withVariants(() => {
  const target = storage(); setAvailableStock(unit, 12, target);
  const order = placePreviewOrder(input([[pack, 2]]), target);
  assert.ok(updatePreviewOrder(order.id, 'ship', target, { courier: 'Kurir', trackingNumber: 'RESI' }).error);
  assert.equal(updatePreviewOrder(order.id, 'failed', target).order.payment.status, 'failed');
  assert.equal(availableStock(unit, target), 0);
  assert.equal(updatePreviewOrder(order.id, 'retry', target).order.payment.status, 'pending');
  assert.equal(updatePreviewOrder(order.id, 'paid', target).order.status, 'processing');
  assert.ok(updatePreviewOrder(order.id, 'paid', target).error);
  assert.ok(updatePreviewOrder(order.id, 'expire', target).error);
  assert.ok(cancelOrder(order.id, 'Berubah pikiran', target).error);
  assert.equal(availableStock(unit, target), 0);
}));

test('batas pembayaran otomatis kedaluwarsa saat dibaca; callback lama tidak dapat membayar', () => {
  const target = storage(); const now = Date.now();
  const order = placePreviewOrder(input([[unit, 2]]), target, now);
  const later = now + PAYMENT_WINDOW;
  const expired = readOrders(target, later);
  assert.equal(expired[0].status, 'expired');
  assert.equal(availableStock(unit, target, expired), 120);
  assert.ok(updatePreviewOrder(order.id, 'paid', target, {}, later).error);
  assert.equal(updatePreviewOrder(order.id, 'expire', target).order.status, 'expired');
  assert.equal(availableStock(unit, target), 120);
  assert.ok(updatePreviewOrder(order.id, 'retry', target).error);
});

test('COD, resi wajib, pengiriman, dan selesai menjaga total serta stok', () => {
  const target = storage(); const order = placePreviewOrder(input([[unit, 2]], 'cod'), target);
  assert.equal(order.payment.expiresAt, undefined);
  assert.ok(updatePreviewOrder(order.id, 'complete', target).error);
  assert.ok(updatePreviewOrder(order.id, 'ship', target, { courier: 'Kurir' }).error);
  const shipped = updatePreviewOrder(order.id, 'ship', target, { courier: ' Kurir Uji ', trackingNumber: ' RESI-UJI ' }).order;
  assert.equal(shipped.shipping.trackingNumber, 'RESI-UJI');
  assert.equal(shipped.shipping.courier, 'Kurir Uji');
  assert.ok(cancelOrder(order.id, 'Tidak jadi', target).error);
  const completed = updatePreviewOrder(order.id, 'complete', target).order;
  assert.equal(completed.status, 'completed'); assert.equal(completed.payment.status, 'paid');
  assert.equal(completed.total, order.total); assert.equal(availableStock(unit, target), 118);
  assert.ok(updatePreviewOrder(order.id, 'ship', target, { courier: 'Lagi', trackingNumber: 'Lagi' }).error);
});

test('mengubah stok tersedia tidak menghapus alokasi pesanan; pembatalan melepas alokasi', () => {
  const target = storage(); const order = placePreviewOrder(input([[unit, 2]]), target);
  assert.ok(setAvailableStock(unit, 0, target).saved); assert.equal(availableStock(unit, target), 0);
  cancelOrder(order.id, 'Tidak jadi', target); assert.equal(availableStock(unit, target), 2);
  assert.ok(setAvailableStock(unit, -1, target).error); assert.ok(setAvailableStock(unit, 1.5, target).error);
});

test('penyimpanan gagal tidak membuat pesanan atau mengurangi stok; data stok rusak memblokir checkout', () => {
  const target = storage(); const before = availableStock(unit, target);
  target.setItem = () => { throw new Error('quota'); };
  assert.throws(() => placePreviewOrder(input([[unit, 1]]), target), /belum tersimpan/);
  assert.equal(readOrders(target).length, 0); assert.equal(availableStock(unit, target), before);
  const broken = storage(); broken.setItem(STOCK_KEY, '{bad');
  assert.throws(() => placePreviewOrder(input([[unit, 1]]), broken)); assert.equal(broken.getItem(ORDER_HISTORY_KEY), null);
});

test('stok pesanan lama tanpa alokasi tetap dapat dibaca; metadata alokasi invalid ditolak', () => {
  const target = storage(); const order = placePreviewOrder(input([[unit, 1]]), target);
  delete order.inventory; assert.ok(saveOrder(order, target)); assert.equal(availableStock(unit, target), 120);
  assert.equal(saveOrder({ ...order, inventory: [{ key: 'x', units: -1 }] }, target), false);
});

test('pesanan kartu lama tetap terbaca tetapi metode yang dihapus tidak dapat dilanjutkan', () => {
  const target = storage(); const order = placePreviewOrder(input([[unit, 1]]), target);
  order.payment = { ...order.payment, id: 'card-visa', groupId: 'card', label: 'Visa' };
  assert.ok(saveOrder(order, target)); assert.equal(readOrders(target)[0].payment.label, 'Visa');
  assert.ok(updatePreviewOrder(order.id, 'paid', target).error);
  assert.ok(updatePreviewOrder(order.id, 'retry', target).error);
  assert.equal(cancelOrder(order.id, 'Metode tidak tersedia', target).order.status, 'cancelled');
});
