import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrder, readOrder, readOrders, saveOrder, ORDER_HISTORY_KEY, ORDER_STORAGE_KEY } from './orderModel.js';
import { products } from '../data/products.js';
import { orderItemPresentation } from '../data/orderItemPresentation.js';

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

const sampleOrder = (overrides = {}) => ({ ...createOrder({ cart: [{ id: 'snack', name: 'Keripik', price: 18000, quantity: 1 }], recipient: 'Pembeli', address: 'Alamat contoh', shipping: { label: 'Reguler', cost: 10000 }, payment: {} }), ...overrides });

test('semua SKU menyimpan merek ukuran dan harga saat pesan tanpa menggabungkan varian', () => {
  const cart = products.map((product) => ({ id: product.id, name: product.name, price: product.price, quantity: 2 }));
  const order = createOrder({ cart, recipient: 'Pembeli', address: 'Alamat contoh', shipping: { cost: 10000 }, payment: {} });
  const target = storage();
  assert.equal(saveOrder(order, target), true);
  const saved = readOrder(order.id, target);
  assert.equal(saved.items.length, 25);
  for (const item of saved.items) {
    const product = products.find((entry) => entry.id === item.id);
    const display = orderItemPresentation(item);
    assert.equal(display.name, product.baseName);
    assert.equal(display.brand, product.brand);
    assert.equal(display.sizeLabel, product.sizeLabel);
    assert.equal(item.price, product.price);
    assert.equal(item.quantity, 2);
  }
});

test('perubahan katalog tidak mengubah snapshot pesanan yang sudah tersimpan', () => {
  const product = products.find((item) => item.id === 'snack-pedas-23g');
  const original = { ...product };
  const order = createOrder({ cart: [{ id: product.id, name: product.name, price: product.price, quantity: 2 }], recipient: 'Pembeli', address: 'Alamat contoh', shipping: { cost: 10000 }, payment: {} });
  const target = storage();
  saveOrder(order, target);
  try {
    Object.assign(product, { name: 'Produk katalog berubah', brand: 'Merek baru', price: 99999, sizeLabel: '999g', image: 'foto-baru.jpg' });
    const saved = readOrder(order.id, target);
    const display = orderItemPresentation(saved.items[0]);
    assert.equal(display.brand, original.brand);
    assert.equal(display.sizeLabel, '23g');
    assert.equal(display.name, original.baseName);
    assert.equal(saved.items[0].price, 3500);
    assert.equal(saved.total, 17000);
    assert.notEqual(display.product.image, 'foto-baru.jpg');
  } finally { Object.assign(product, original); }
});

test('pesanan lama tanpa metadata tetap dibaca dari nama/harga historis', () => {
  const order = sampleOrder({ items: [{ id: 'snack-pedas', name: 'Keripik lama 62g', price: 6500, quantity: 1 }], subtotal: 6500, total: 16500 });
  const target = storage();
  assert.equal(saveOrder(order, target), true);
  const display = orderItemPresentation(readOrder(order.id, target).items[0]);
  assert.equal(display.name, 'Keripik lama');
  assert.equal(display.sizeLabel, '62g');
  assert.equal(display.brand, '');
  assert.equal(display.product.image, '');
  assert.equal(orderItemPresentation({ id: 'removed', name: 'Produk dihapus', price: 1000, quantity: 1 }).sizeLabel, '');
});

test('checkout kedua mempertahankan detail pesanan pertama dan urutan terbaru', () => {
  const target = storage();
  const first = sampleOrder({ createdAt: 100 });
  const second = sampleOrder({ createdAt: 200 });
  assert.notEqual(first.id, second.id);
  assert.equal(saveOrder(first, target), true);
  assert.equal(saveOrder(second, target), true);
  assert.deepEqual(readOrders(target).map((order) => order.id), [second.id, first.id]);
  assert.deepEqual(readOrder(first.id, target), first);
  assert.deepEqual(readOrder(second.id, target), second);
});

test('pesanan terakhir versi lama dibaca dan dibawa ke riwayat baru', () => {
  const target = storage();
  const legacy = sampleOrder({ id: 'BAM-LEGACY', createdAt: 100 });
  target.setItem(ORDER_STORAGE_KEY, JSON.stringify(legacy));
  assert.deepEqual(readOrders(target), [legacy]);
  const next = sampleOrder({ createdAt: 200 });
  assert.equal(saveOrder(next, target), true);
  assert.deepEqual(readOrders(target).map((order) => order.id), [next.id, legacy.id]);
  saveOrder(next, target);
  assert.equal(readOrders(target).length, 2);
});

test('data rusak, tanggal invalid, total salah, dan duplikat disaring', () => {
  const target = storage();
  target.setItem(ORDER_HISTORY_KEY, '{invalid');
  assert.deepEqual(readOrders(target), []);
  const valid = sampleOrder();
  target.setItem(ORDER_HISTORY_KEY, JSON.stringify([valid, valid, { id: 'broken' }, sampleOrder({ total: -1 }), sampleOrder({ createdAt: 1e20 })]));
  assert.deepEqual(readOrders(target), [valid]);
  assert.equal(saveOrder({ id: 'broken' }, target), false);
});

test('gagal menyimpan tidak menghilangkan riwayat; gagal membaca tidak menulis', () => {
  const target = storage();
  const order = sampleOrder();
  saveOrder(order, target);
  const before = target.getItem(ORDER_HISTORY_KEY);
  target.setItem = () => { throw new Error('quota'); };
  assert.equal(saveOrder(sampleOrder(), target), false);
  assert.equal(target.getItem(ORDER_HISTORY_KEY), before);
  let wrote = false;
  const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { wrote = true; } };
  assert.equal(saveOrder(sampleOrder(), blocked), false);
  assert.equal(wrote, false);
  assert.throws(() => readOrders(blocked));
  assert.equal(readOrder(order.id, blocked), null);
});

test('order dapat disimpan dan dibaca kembali berdasarkan id', () => {
  const target = storage();
  const order = createOrder({ cart: [], recipient: 'Endless', address: 'Jl. Contoh nomor 10', shipping: { cost: 0 }, payment: {} });
  assert.equal(saveOrder(order, target), true);
  assert.deepEqual(readOrder(order.id, target), order);
  assert.equal(readOrder('BAM-NOT-FOUND', target), null);
});


test('catatan opsional tersimpan per pesanan dan tetap terbaca setelah muat ulang', () => {
  const target = storage();
  const first = sampleOrder();
  first.note = 'Tolong kemas dengan aman.\nJangan dilipat.';
  const second = sampleOrder();
  assert.equal(second.note, '');
  assert.equal(saveOrder(first, target), true);
  assert.equal(saveOrder(second, target), true);
  assert.equal(readOrder(first.id, target).note, first.note);
  assert.equal(readOrder(second.id, target).note, '');
  assert.equal(readOrder(first.id, target).total, first.total);
});

test('catatan dinormalisasi dan dibatasi 300 karakter tanpa mengubah total', () => {
  const input = { cart: [{ id: 'snack', name: 'Keripik', price: 18000, quantity: 1 }], recipient: 'Pembeli', address: 'Alamat contoh', shipping: { cost: 10000 }, payment: {} };
  assert.equal(createOrder({ ...input, note: '  Pesan khusus\nBaris kedua  ' }).note, 'Pesan khusus\nBaris kedua');
  assert.equal(createOrder({ ...input, note: '   ' }).note, '');
  const order = createOrder({ ...input, note: 'a'.repeat(301) });
  assert.equal(order.note.length, 300);
  assert.equal(order.total, 28000);
  assert.equal(saveOrder({ ...order, note: 'a'.repeat(301) }, storage()), false);
  assert.equal(saveOrder({ ...order, note: {} }, storage()), false);
});

test('pesanan lama tanpa catatan tetap dapat dibaca', () => {
  const target = storage();
  const legacy = sampleOrder();
  delete legacy.note;
  target.setItem(ORDER_HISTORY_KEY, JSON.stringify([legacy]));
  assert.deepEqual(readOrder(legacy.id, target), legacy);
});
