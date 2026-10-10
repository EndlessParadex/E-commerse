import test from 'node:test';
import assert from 'node:assert/strict';
import { products } from '../data/products.js';
import { reviewCart, updateCartPrices } from '../data/cartValidation.js';
import { catalogHref, parseCatalogRoute, filterCatalogProducts } from '../data/catalog.js';
import { promoSlides } from '../data/promoSlides.js';
import { productReturnRoute } from './shopNavigation.js';
import { PAYMENT_METHODS, paymentMethod } from './paymentMethods.js';
import { createCheckoutOrder, cancelOrder, saveOrder, readOrder, readOrders, ORDER_HISTORY_KEY } from './orderModel.js';

const storage = () => { const values = new Map(); return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; };
const cartItem = () => ({ id: products[0].id, name: products[0].name, price: products[0].price, quantity: 2 });
const input = (method = 'cod') => ({ cart: [cartItem()], recipient: 'Pembeli Uji', address: 'Alamat untuk pengujian', shipping: { label: 'Reguler', cost: 10000 }, payment: paymentMethod(method) });

test('checkout menolak SKU dihapus, harga berubah, jumlah invalid, keranjang kosong, dan metode palsu', () => {
  const current = input();
  assert.throws(() => createCheckoutOrder({ ...current, cart: [{ ...cartItem(), id: 'SKU-DIHAPUS' }] }));
  assert.throws(() => createCheckoutOrder({ ...current, cart: [{ ...cartItem(), price: 1 }] }));
  assert.throws(() => createCheckoutOrder({ ...current, cart: [] }));
  for (const quantity of [0, -1, 1.5, 100]) assert.throws(() => createCheckoutOrder({ ...current, cart: [{ ...cartItem(), quantity }] }));
  assert.throws(() => createCheckoutOrder({ ...current, payment: { id: 'unsupported' } }));
  for (const id of ['card-visa', 'card-mastercard', 'card-jcb']) assert.throws(() => createCheckoutOrder({ ...current, payment: { id } }), /metode pembayaran yang tersedia/);
  const oldCart = [{ ...cartItem(), price: 1 }, { id: 'SKU-DIHAPUS', name: 'Barang lama', price: 2000, quantity: 1 }];
  assert.deepEqual(reviewCart(oldCart).issues.map((issue) => issue.type), ['changed', 'unavailable']);
  const updated = updateCartPrices(oldCart);
  assert.equal(updated[0].price, products[0].price);
  assert.deepEqual(updated[1], oldCart[1]);
  assert.equal(reviewCart(updated).ready, false);
  assert.equal(reviewCart(updated.slice(0, 1)).ready, true);
});

test('semua layanan pembayaran menyimpan pilihan, total, dan status yang benar', () => {
  const target = storage();
  assert.equal(new Set(PAYMENT_METHODS.map((method) => method.id)).size, PAYMENT_METHODS.length);
  for (const method of PAYMENT_METHODS) {
    const order = createCheckoutOrder(input(method.id));
    assert.equal(saveOrder(order, target), true);
    const saved = readOrder(order.id, target);
    assert.equal(saved.payment.id, method.id);
    assert.equal(saved.payment.label, method.label);
    assert.equal(saved.total, products[0].price * 2 + 10000);
    assert.equal(saved.status, method.groupId === 'cod' ? 'processing' : 'awaiting_payment');
  }
  const forged = createCheckoutOrder({ ...input('va-bca'), payment: { id: 'va-bca', groupId: 'cod', label: 'Metode palsu' } });
  assert.equal(forged.payment.label, 'BCA Virtual Account');
  assert.equal(forged.status, 'awaiting_payment');
});

test('pembatalan tersimpan setelah reload, mempertahankan snapshot, dan tidak menghapus pesanan lain', () => {
  const target = storage();
  const first = createCheckoutOrder(input('wallet-dana'));
  const second = createCheckoutOrder(input('cod'));
  saveOrder(first, target); saveOrder(second, target);
  const result = cancelOrder(first.id, 'Ingin mengganti metode pembayaran', target);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(result.order.payment.status, 'cancelled');
  const reloaded = readOrder(first.id, target);
  assert.equal(reloaded.cancellationReason, 'Ingin mengganti metode pembayaran');
  assert.deepEqual(reloaded.items, first.items);
  assert.equal(reloaded.total, first.total);
  assert.equal(readOrders(target).length, 2);
  assert.deepEqual(readOrder(second.id, target), second);
  const before = target.getItem(ORDER_HISTORY_KEY);
  assert.ok(cancelOrder(first.id, '', target).error);
  assert.equal(target.getItem(ORDER_HISTORY_KEY), before);
});

test('pembatalan gagal menyimpan tidak mengubah pesanan; status dibayar/dikirim/selesai ditolak', () => {
  for (const patch of [{ status: 'shipped' }, { status: 'completed' }, { payment: { ...paymentMethod('va-bri'), status: 'paid' } }]) {
    const target = storage(); const order = { ...createCheckoutOrder(input()), ...patch };
    saveOrder(order, target);
    const before = target.getItem(ORDER_HISTORY_KEY);
    assert.ok(cancelOrder(order.id, 'Berubah pikiran', target).error);
    assert.equal(target.getItem(ORDER_HISTORY_KEY), before);
  }
  const target = storage(); const order = createCheckoutOrder(input()); saveOrder(order, target);
  const before = target.getItem(ORDER_HISTORY_KEY);
  const failing = { getItem: target.getItem, setItem: () => { throw new Error('quota'); } };
  assert.ok(cancelOrder(order.id, '', failing).error);
  assert.equal(target.getItem(ORDER_HISTORY_KEY), before);
  assert.ok(cancelOrder('missing', '', target).error);
});

test('kombinasi filter, pencarian, urutan dan tombol kembali tetap dalam lingkup yang sama', () => {
  const options = { query: 'balado', supplierId: 'demo-pangan', brandId: 'rasa-contoh', categoryId: 'snack', subcategoryId: 'keripik', sort: 'low' };
  const route = catalogHref(options).slice(1);
  assert.equal(productReturnRoute(route), route);
  const parsed = parseCatalogRoute(route);
  for (const [key, value] of Object.entries(options)) assert.equal(parsed[key], value);
  assert.equal(filterCatalogProducts(parsed).length, 1);
  const global = parseCatalogRoute(catalogHref({ ...options, supplierId: '' }).slice(1));
  assert.equal(global.categoryId, 'snack'); assert.equal(global.brandId, 'rasa-contoh'); assert.equal(global.query, 'balado');
  assert.equal(productReturnRoute('https://example.com'), '/cari?q=');
  assert.equal(productReturnRoute('/admin'), '/cari?q=');
  assert.equal(filterCatalogProducts({ query: products[0].id })[0].id, products[0].id);
});

test('banner menggunakan ID kategori tetap dan produk yang masih tersedia, termasuk katalog kosong', () => {
  const sample = [{ id: 'SKU-BARU', groupId: 'group-baru', name: 'Produk baru', price: 1000, categoryId: 'custom' }];
  const list = [{ id: 'custom', name: 'Kategori diganti namanya', children: [] }];
  const slides = promoSlides(sample, list);
  assert.equal(slides[0].href, '#/kategori/custom');
  assert.equal(slides[0].category, list[0].name);
  assert.equal(slides[0].featured[0].id, 'SKU-BARU');
  assert.deepEqual(promoSlides([], list)[0].featured, []);
  assert.equal(promoSlides([], [])[0].href, '#/cari?q=');
});
