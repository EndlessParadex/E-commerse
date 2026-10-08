import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { suppliers } from './suppliers.js';
import { products } from './products.js';
import { categories, parseCatalogRoute, filterProducts } from './catalog.js';
import { brands, brandsForSupplier, validateMaster, masterSnapshot } from './catalogMasters.js';
import { saveMaster, saveProduct } from './adminStore.js';
import { productDraft } from './adminEditor.js';
import { filterAdminProducts } from './adminCatalog.js';
import { emptyShop, shopReducer, cartTotals } from '../state/shopModel.js';
import { createOrder, saveOrder, readOrder } from '../state/orderModel.js';

test('nama duplikat dan PT yang tidak dikenal ditolak tanpa mengubah data', () => {
  assert.ok(validateMaster('suppliers', { name: ' PT PANGAN CONTOH ', initials: 'PC', color: 'sky' }).name);
  assert.ok(validateMaster('brands', { name: 'Merek Baru', supplierIds: ['tidak-ada'] }).supplierIds);
  assert.ok(validateMaster('categories', { name: 'Baru', icon: '📦', children: [{ name: ' Sama ' }, { name: 'sama' }] })['children.1']);
});
test('penyimpanan master yang gagal mempertahankan katalog sebelumnya', () => {
  const before = JSON.stringify(masterSnapshot());
  const result = saveMaster('suppliers', { id: '', name: 'PT Gagal Uji', initials: 'GU', color: 'mint', logo: '' }, { setItem() { throw new Error('quota'); } });
  assert.ok(result.storageError); assert.equal(JSON.stringify(masterSnapshot()), before);
});
test('tambah PT, merek, kategori dan produk; rename tetap terhubung sesudah reload', () => {
  let stored; const storage = { setItem(_key, value) { stored = value; } };
  const pt = saveMaster('suppliers', { id: '', name: 'PT Teknologi Uji', initials: 'TU', color: 'violet', logo: '' }, storage);
  assert.ok(pt.id);
  const brand = saveMaster('brands', { id: '', name: 'Komputer Uji', supplierIds: [pt.id] }, storage); assert.ok(brand.id);
  const category = saveMaster('categories', { id: '', name: 'Elektronik Uji', icon: '💻', children: [{ id: '', name: 'Laptop Uji' }] }, storage); assert.ok(category.id);
  assert.equal(brandsForSupplier(pt.id)[0].id, brand.id);
  const child = categories.find((entry) => entry.id === category.id).children[0];
  const draft = { ...productDraft(), baseName: 'Laptop Integrasi', brandId: brand.id, brand: 'Komputer Uji', supplierId: pt.id, categoryId: category.id, subcategoryId: child.id, description: 'Laptop pengujian integrasi.', variants: [{ id: 'MASTER-LAPTOP-1', sizeValue: '1', sizeUnit: 'pcs', price: '1000000', oldPrice: '' }] };
  const saved = saveProduct(draft, storage); assert.ok(saved.groupId);
  let shop = shopReducer(emptyShop(), { type: 'add', product: products.find((entry) => entry.id === 'MASTER-LAPTOP-1') });
  shop = shopReducer(shop, { type: 'add', product: products.find((entry) => entry.id === 'MASTER-LAPTOP-1') });
  assert.deepEqual(cartTotals(shop.cart), { quantity: 2, subtotal: 2000000 });
  const order = createOrder({ cart: shop.cart, recipient: 'Pembeli Uji', address: 'Alamat Uji Nomor 10', shipping: { label: 'Reguler', cost: 10000 }, payment: { label: 'Bayar di tempat' } });
  const orderValues = new Map(); const orderStorage = { getItem: (key) => orderValues.get(key) || null, setItem: (key, value) => orderValues.set(key, value) };
  assert.equal(saveOrder(order, orderStorage), true); assert.equal(readOrder(order.id, orderStorage).total, 2010000);
  shop = shopReducer(shop, { type: 'completeOrder', order }); assert.equal(shop.cart.length, 0);
  assert.equal(filterProducts({ supplierId: pt.id, brandId: brand.id }).length, 1);
  assert.ok(saveMaster('suppliers', { ...suppliers.find((entry) => entry.id === pt.id), name: 'PT Teknologi Revisi' }, storage).id);
  assert.ok(saveMaster('brands', { ...brands.find((entry) => entry.id === brand.id), name: 'Komputer Revisi' }, storage).id);
  const editedCategory = categories.find((entry) => entry.id === category.id);
  assert.ok(saveMaster('categories', { ...editedCategory, name: 'Elektronik Revisi', children: [{ ...child, name: 'Laptop Revisi' }] }, storage).id);
  assert.equal(products.find((entry) => entry.id === 'MASTER-LAPTOP-1').brand, 'Komputer Revisi');
  assert.equal(filterAdminProducts({ query: 'PT Teknologi Revisi' }).length, 1);
  assert.equal(parseCatalogRoute(`/kategori/${category.id}/${child.id}`).kind, 'category');
  const script = `globalThis.window = { localStorage: { getItem: () => process.env.TEST_CATALOG } }; await import('./src/data/adminStore.js'); const { productDraft } = await import('./src/data/adminEditor.js'); const { suppliers } = await import('./src/data/suppliers.js'); const { categories } = await import('./src/data/catalog.js'); console.log(JSON.stringify({ draft: productDraft(${JSON.stringify(saved.groupId)}), supplier: suppliers.find(s => s.id === ${JSON.stringify(pt.id)}).name, category: categories.find(c => c.id === ${JSON.stringify(category.id)}).name }));`;
  const loaded = spawnSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, TEST_CATALOG: stored }, encoding: 'utf8' });
  assert.equal(loaded.status, 0, loaded.stderr); const value = JSON.parse(loaded.stdout);
  assert.equal(value.draft.brand, 'Komputer Revisi'); assert.equal(value.draft.brandId, brand.id); assert.equal(value.supplier, 'PT Teknologi Revisi'); assert.equal(value.category, 'Elektronik Revisi');
  assert.equal(value.draft.variants[0].id, 'MASTER-LAPTOP-1');
});
test('hubungan pemasok dan subkategori yang masih digunakan tidak dapat diputus', () => {
  const brand = brands.find((entry) => entry.id === 'rasa-contoh');
  assert.ok(validateMaster('brands', { ...brand, supplierIds: ['demo-rumah'] }).supplierIds);
  const category = categories.find((entry) => entry.id === 'snack');
  assert.ok(validateMaster('categories', { ...category, children: category.children.filter((child) => child.id !== 'keripik') }).children);
});
test('data produk tahap 2 tanpa daftar master tetap terbaca dan merek lamanya tersedia', () => {
  const oldDraft = { ...productDraft(), groupId: 'local-OLD-LAPTOP', baseName: 'Laptop Lama', brand: 'Merek Lama', supplierId: 'demo-rumah', categoryId: 'rumah', subcategoryId: 'tubuh', description: 'Produk tersimpan dari tahap sebelumnya.', variants: [{ id: 'OLD-LAPTOP', sizeValue: '1', sizeUnit: 'pcs', price: '1500000', oldPrice: '' }] };
  delete oldDraft.brandId;
  const script = `globalThis.window = { localStorage: { getItem: () => process.env.TEST_CATALOG } }; const { catalogLoadError } = await import('./src/data/adminStore.js'); const { brandsForSupplier } = await import('./src/data/catalogMasters.js'); const { products } = await import('./src/data/products.js'); console.log(JSON.stringify({ error: catalogLoadError, name: products.find(p => p.id === 'OLD-LAPTOP')?.baseName, brands: brandsForSupplier('demo-rumah').map(b => b.name) }));`;
  const loaded = spawnSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, TEST_CATALOG: JSON.stringify({ version: 1, edits: [oldDraft] }) }, encoding: 'utf8' });
  assert.equal(loaded.status, 0, loaded.stderr); const value = JSON.parse(loaded.stdout);
  assert.equal(value.error, ''); assert.equal(value.name, 'Laptop Lama'); assert.ok(value.brands.includes('Merek Lama'));
});
