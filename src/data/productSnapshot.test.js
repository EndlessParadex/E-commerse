import test from 'node:test';
import assert from 'node:assert/strict';
import { products } from './products.js';
import { cartItemPresentation } from './cartItemPresentation.js';
import { orderItemPresentation } from './orderItemPresentation.js';
import { createOrder, saveOrder, readOrder } from '../state/orderModel.js';
import { snapshotImage, SNAPSHOT_IMAGE_MAX_LENGTH } from './productSnapshot.js';

test('satuan pcs terbaca di keranjang dan pesanan lama tanpa metadata ukuran', () => {
  const item = { id: 'PCS-UJI', name: 'Rien Rice 1pcs', price: 100000000, quantity: 1 };
  assert.equal(cartItemPresentation(item).sizeLabel, '1pcs');
  assert.equal(cartItemPresentation(item).name, 'Rien Rice');
  assert.equal(orderItemPresentation({ ...item, details: { name: item.name, sizeLabel: '' } }).sizeLabel, '1pcs');
  for (const suffix of ['2pcs', '3 PCS', '1,5g', '30 ml']) assert.ok(orderItemPresentation({ ...item, name: `Produk ${suffix}` }).sizeLabel);
});
test('pesanan baru menyimpan ukuran pcs dan foto unggahan; perubahan katalog tidak mengubah riwayat', () => {
  const image = 'data:image/png;base64,' + 'A'.repeat(3000);
  const product = { ...products[0], id: 'PCS-FOTO-UJI', groupId: 'pcs-foto', baseName: 'Rien Rice', name: 'Rien Rice 1pcs', sizeLabel: '1pcs', sizeUnit: 'pcs', image, gallery: [] };
  products.push(product);
  try {
    const item = { id: product.id, name: product.name, price: 100000000, quantity: 1 };
    const order = createOrder({ cart: [item], recipient: 'Pembeli', address: 'Alamat uji', shipping: { label: 'Reguler', cost: 10000 }, payment: { label: 'Bayar di tempat' } });
    const values = new Map(); const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
    assert.equal(saveOrder(order, storage), true); product.image = ''; product.sizeLabel = '2pcs';
    const saved = readOrder(order.id, storage); const display = orderItemPresentation(saved.items[0]);
    assert.equal(display.sizeLabel, '1pcs'); assert.equal(display.product.image, image); assert.equal(saved.total, 100010000);
  } finally { products.pop(); }
});
test('batas foto tidak memotong URL dan menolak data di atas batas', () => {
  const image = 'x'.repeat(SNAPSHOT_IMAGE_MAX_LENGTH);
  assert.equal(snapshotImage(image), image); assert.equal(snapshotImage(image + 'x'), '');
});
