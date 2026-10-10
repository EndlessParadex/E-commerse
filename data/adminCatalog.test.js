import test from 'node:test';
import assert from 'node:assert/strict';
import { adminProducts, adminBrands, filterAdminProducts } from './adminCatalog.js';

test('admin menampilkan setiap SKU dan pemasok yang tepat tanpa menggabungkan ukuran', () => {
  assert.equal(adminProducts.length, 25);
  assert.equal(new Set(adminProducts.map((product) => product.id)).size, 25);
  assert.equal(new Set(adminProducts.map((product) => product.groupId)).size, 8);
  assert.ok(adminProducts.every((product) => product.supplier?.productIds.includes(product.id)));
  assert.equal(filterAdminProducts({ query: '  KERIPIK  ' }).length, 4);
});

test('filter admin menggabungkan PT merek dan pencarian SKU/ukuran', () => {
  const matches = filterAdminProducts({ supplierId: 'demo-pangan', brandId: 'rasa-contoh', query: '23g' });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'snack-pedas-23g');
  assert.equal(filterAdminProducts({ supplierId: 'demo-beauty', brandId: 'rasa-contoh' }).length, 0);
  assert.equal(filterAdminProducts({ query: 'produk tidak ada' }).length, 0);
  assert.equal(filterAdminProducts({ query: 'snack-pedas-23g' }).length, 1);
  assert.equal(filterAdminProducts().length, 25);
});

test('pilihan merek admin hanya berasal dari PT terpilih', () => {
  assert.equal(adminBrands().length, 8);
  assert.deepEqual(adminBrands('demo-rumah').map((brand) => brand.id), ['natural-contoh']);
  assert.equal(adminBrands('demo-beauty').length, 2);
  assert.deepEqual(adminBrands('tidak-ada'), []);
});
