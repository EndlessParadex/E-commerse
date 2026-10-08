import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { products } from './products.js';
import { suppliers } from './suppliers.js';
import { adminProducts, filterAdminProducts } from './adminCatalog.js';
import { filterCatalogProducts, filterProducts } from './catalog.js';
import { productDraft, validateDraft } from './adminEditor.js';
import { saveProduct, saveMaster, subscribeCatalog } from './adminStore.js';
import { brands } from './catalogMasters.js';

const validDraft = () => ({ ...productDraft(), baseName: 'Keripik Uji', brand: 'Merek Uji', supplierId: 'demo-pangan', categoryId: 'snack', subcategoryId: 'keripik', description: 'Deskripsi produk uji.', variants: [{ id: 'UJI-62G', sizeValue: '62', sizeUnit: 'g', price: '7500', oldPrice: '9000' }, { id: 'UJI-130G', sizeValue: '130', sizeUnit: 'g', price: '14000', oldPrice: '' }] });

test('SKU lintas produk dan ukuran duplikat ditolak sebelum penyimpanan', () => {
  const draft = validDraft();
  draft.variants[0].id = 'SNACK-PEDAS'; draft.variants[1].sizeValue = '62';
  const errors = validateDraft(draft);
  assert.match(errors['variants.0.id'], /sudah digunakan/);
  assert.match(errors['variants.1.sizeValue'], /sudah ditambahkan/);
  draft.variants[0].id = 'UJI-62G'; draft.variants[1].id = 'uji-62g';
  assert.match(validateDraft(draft)['variants.1.id'], /sudah digunakan/);
});
test('harga pecahan, diskon terbalik, kategori salah dan ukuran nol ditolak', () => {
  const draft = validDraft(); draft.subcategoryId = 'wajah';
  draft.variants[0] = { ...draft.variants[0], price: '7500.5', oldPrice: '100', sizeValue: '0' };
  const errors = validateDraft(draft);
  for (const key of ['subcategoryId', 'variants.0.price', 'variants.0.oldPrice', 'variants.0.sizeValue']) assert.ok(errors[key]);
});
test('gagal menyimpan tidak mengubah katalog atau menyiarkan keberhasilan', () => {
  const original = JSON.stringify(products); let notifications = 0;
  const unsubscribe = subscribeCatalog(() => { notifications += 1; });
  const result = saveProduct(validDraft(), { setItem() { throw new Error('quota'); } });
  unsubscribe();
  assert.ok(result.storageError); assert.equal(notifications, 0); assert.equal(JSON.stringify(products), original);
});
test('tambah dan edit memperbarui semua ukuran, pemetaan PT, deskripsi dan pratinjau toko; muat ulang tetap sama', () => {
  let stored; const storage = { setItem(_key, value) { stored = value; } };
  const draft = validDraft(); const result = saveProduct(draft, storage);
  assert.ok(result.groupId);
  assert.equal(filterAdminProducts({ query: 'UJI-' }).length, 2);
  assert.equal(filterCatalogProducts({ query: 'Keripik Uji' }).length, 1);
  assert.equal(filterProducts({ supplierId: 'demo-pangan', brandId: 'merek-uji' }).length, 2);
  const registeredBrand = brands.find((brand) => brand.id === 'merek-uji');
  assert.ok(saveMaster('brands', { ...registeredBrand, supplierIds: ['demo-pangan', 'demo-rumah'] }, storage).id);
  const edited = productDraft(result.groupId); edited.baseName = 'Keripik Revisi'; edited.description = 'Deskripsi baru'; edited.supplierId = 'demo-rumah'; edited.variants[0].price = '8000';
  assert.ok(saveProduct(edited, storage).groupId);
  assert.equal(products.find((item) => item.id === 'UJI-62G').price, 8000);
  assert.ok(products.filter((item) => item.groupId === result.groupId).every((item) => item.description === 'Deskripsi baru'));
  assert.ok(!suppliers.find((entry) => entry.id === 'demo-pangan').productIds.includes('UJI-62G'));
  assert.equal(adminProducts.find((item) => item.id === 'UJI-62G').supplier.id, 'demo-rumah');
  const script = `globalThis.window = { localStorage: { getItem: () => process.env.TEST_CATALOG } }; await import('./src/data/adminStore.js'); const { products } = await import('./src/data/products.js'); const { suppliers } = await import('./src/data/suppliers.js'); console.log(JSON.stringify({ items: products.filter(p => p.groupId === ${JSON.stringify(result.groupId)}), supplier: suppliers.find(s => s.productIds.includes('UJI-62G')).id }));`;
  const loaded = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', env: { ...process.env, TEST_CATALOG: stored } });
  assert.equal(loaded.status, 0, loaded.stderr);
  const value = JSON.parse(loaded.stdout); assert.equal(value.items.length, 2); assert.equal(value.items[0].price, 8000); assert.equal(value.supplier, 'demo-rumah');
});
test('katalog tersimpan yang rusak menampilkan kesalahan tanpa menghapus penyimpanan', () => {
  const script = `globalThis.window = { localStorage: { getItem: () => '{broken', setItem: () => { throw new Error('must not write'); } } }; const { catalogLoadError } = await import('./src/data/adminStore.js'); const { products } = await import('./src/data/products.js'); console.log(JSON.stringify({ error: catalogLoadError, count: products.length }));`;
  const loaded = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(loaded.status, 0, loaded.stderr); const value = JSON.parse(loaded.stdout); assert.ok(value.error); assert.equal(value.count, 25);
});
