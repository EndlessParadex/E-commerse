import test from 'node:test';
import assert from 'node:assert/strict';
import { groupAdminProducts, pageNumbers } from './adminProductGroups.js';

const sku = (groupId, id, sizeValue, packagingType, price, supplier = 'PT A') => ({
  groupId,
  id,
  baseName: groupId.toUpperCase(),
  brand: 'Merek',
  sizeUnit: 'g',
  sizeValue,
  packagingType,
  unitsPerPackage: packagingType === 'satuan' ? '1' : '10',
  price,
  supplier: { name: supplier },
});

test('groupAdminProducts: satu grup per produk, varian urut, rentang harga, daftar PT', () => {
  const groups = groupAdminProducts([
    sku('ff', 'FF-24G-DUS', '24', 'dus', 211200),
    sku('ff', 'FF-24G', '24', 'satuan', 4400),
    sku('gp', 'GP-14G', '14', 'pack', 9000),
    sku('ff', 'FF-15G-RCG', '15', 'renceng', 18000, 'PT B'),
  ]);
  assert.deepEqual(
    groups.map((group) => group.groupId),
    ['ff', 'gp'],
  );
  assert.deepEqual(
    groups[0].skus.map((entry) => entry.id),
    ['FF-15G-RCG', 'FF-24G', 'FF-24G-DUS'],
  );
  assert.equal(groups[0].minPrice, 4400);
  assert.equal(groups[0].maxPrice, 211200);
  assert.deepEqual(groups[0].suppliers, ['PT B', 'PT A']);
  assert.equal(groups[0].first.id, 'FF-24G-DUS');
});

test('pageNumbers: awal, akhir, tetangga halaman aktif, dan celah', () => {
  assert.deepEqual(pageNumbers(1, 3), [1, 2, 3]);
  assert.deepEqual(pageNumbers(1, 24), [1, 2, 3, 4, null, 24]);
  assert.deepEqual(pageNumbers(7, 24), [1, null, 6, 7, 8, null, 24]);
  assert.deepEqual(pageNumbers(24, 24), [1, null, 21, 22, 23, 24]);
});
