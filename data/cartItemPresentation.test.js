import test from 'node:test';
import assert from 'node:assert/strict';
import { products } from './products.js';
import { cartItemPresentation } from './cartItemPresentation.js';

test('semua SKU memisahkan nama merek dan ukuran tanpa mencampur pilihan detail', () => {
  for (const product of products) {
    const item = { id: product.id, name: product.name, price: product.price, quantity: 2 };
    const display = cartItemPresentation(item);
    assert.equal(display.name, product.baseName);
    assert.equal(display.sizeLabel, product.sizeLabel);
    assert.equal(display.brand, product.brand);
    assert.equal(display.detailHref, `#/produk/${product.id}`);
    assert.equal(display.product.id, product.id);
  }
});

test('nama harga dan jumlah snapshot lama tidak ditimpa data katalog', () => {
  const item = { id: 'snack-pedas', name: 'Keripik versi lama', price: 17000, quantity: 3 };
  const original = { ...item };
  const display = cartItemPresentation(item);
  assert.equal(display.name, item.name);
  assert.equal(display.sizeLabel, '');
  assert.deepEqual(item, original);
  const custom = cartItemPresentation({ ...item, name: 'Nama tersimpan 180g' });
  assert.equal(custom.name, 'Nama tersimpan');
  assert.equal(custom.sizeLabel, '180g');
});

test('produk dihapus/produk demo lama tetap dapat ditampilkan tanpa tautan rusak', () => {
  const display = cartItemPresentation({ id: 'removed', name: 'Sabun lama 100 ml', price: 20000, quantity: 1 });
  assert.equal(display.name, 'Sabun lama');
  assert.equal(display.sizeLabel, '100ml');
  assert.equal(display.detailHref, '');
  assert.equal(display.brand, '');
  assert.equal(display.product.icon, '🛒');
  assert.equal(cartItemPresentation({ id: 'demo-snack', name: '[Contoh] Keripik Kentang', price: 18000, quantity: 1 }).sizeLabel, '');
});
