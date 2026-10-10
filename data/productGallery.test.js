import test from 'node:test';
import assert from 'node:assert/strict';
import { productGallery } from './productGallery.js';
import { products } from './products.js';

test('semua SKU tanpa foto mendapat empat ilustrasi berlabel contoh', () => {
  for (const product of products) {
    const entries = productGallery(product);
    assert.deepEqual(entries.map((entry) => entry.label), ['Depan', 'Belakang', 'Samping', 'Detail']);
    assert.ok(entries.every((entry) => entry.demo && entry.alt.includes(product.name)));
  }
});
test('foto varian sendiri menggantikan demo dan tidak bocor ke varian lain', () => {
  const first = { ...products[0], gallery: [{ src: ' products/23g-front.jpg ', label: 'Depan' }, { src: 'products/23g-back.jpg', label: 'Belakang', alt: 'Kemasan belakang 23g' }] };
  const other = { ...products[0], gallery: [{ src: 'products/180g-front.jpg', label: 'Depan' }] };
  assert.equal(productGallery(first)[0].src, 'products/23g-front.jpg');
  assert.equal(productGallery(first)[1].alt, 'Kemasan belakang 23g');
  assert.ok(productGallery(first).every((entry) => !entry.demo));
  assert.equal(productGallery(other).length, 1);
  assert.equal(productGallery(other)[0].src, 'products/180g-front.jpg');
});
test('satu foto lama tetap dipakai; data galeri invalid tidak menyebabkan crash', () => {
  const product = { ...products[0], image: 'products/front.jpg', gallery: [null, {}, { src: ' ' }] };
  assert.equal(productGallery(product).length, 1);
  assert.equal(productGallery(product)[0].src, product.image);
  assert.equal(productGallery({ ...product, image: '', gallery: false }).length, 4);
  const entries = productGallery({ ...product, gallery: [{ src: 'products/detail.jpg', label: 123, alt: false }] });
  assert.equal(entries[0].label, 'Foto 1');
  assert.ok(entries[0].alt.includes(product.name));
});
