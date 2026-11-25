import test from 'node:test';
import assert from 'node:assert/strict';
import { products } from './products.js';
import { masterSnapshot } from './catalogMasters.js';
import { moveProducts } from './adminStore.js';

test('moveProducts: beberapa produk pindah kategori dalam satu simpan; tujuan harus valid', () => {
  let saves = 0;
  const storage = {
    setItem() {
      saves += 1;
    },
  };
  const groups = [...new Set(products.map((product) => product.groupId))].slice(0, 2);
  const target = masterSnapshot().categories.find((category) =>
    products.some(
      (product) => groups.includes(product.groupId) && product.categoryId !== category.id,
    ),
  );
  const child = target.children[0];
  assert.match(
    moveProducts(groups, target.id, 'tidak-ada', storage).storageError,
    /kategori dan subkategori/,
  );
  assert.equal(saves, 0, 'an invalid target saves nothing');
  assert.equal(moveProducts(groups, target.id, child.id, storage).moved, 2);
  assert.equal(saves, 1, 'one save for all selected products');
  for (const product of products.filter((entry) => groups.includes(entry.groupId))) {
    assert.equal(product.categoryId, target.id);
    assert.equal(product.subcategoryId, child.id);
  }
});
