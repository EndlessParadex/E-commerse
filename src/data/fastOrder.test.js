import test from 'node:test';
import assert from 'node:assert/strict';
import { fastOrderGroups, fastOrderPackaging, fastOrderTotals } from './fastOrder.js';

const product = (id, packagingType, unitsPerPackage = 1) => ({
  id,
  groupId: 'balado',
  baseName: 'Keripik Balado',
  sizeLabel: '180g',
  price: unitsPerPackage * 1000,
  packagingType,
  unitsPerPackage,
});

test('fast order groups only matching sizes and retains distinct package SKUs', () => {
  const rows = [
    product('snack-pcs', 'satuan'),
    product('snack-dus', 'dus', 12),
    product('snack-pack', 'pack', 6),
    { ...product('snack-62g', 'satuan'), sizeLabel: '62g' },
  ];
  const groups = fastOrderGroups(rows, [{ id: 'snack-dus', quantity: 2 }]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].size, '180g');
  assert.equal(groups[0].inCart, true);
  assert.deepEqual(groups[0].variants.map((v) => v.id), [
    'snack-dus',
    'snack-pack',
    'snack-pcs',
  ]);
  assert.equal(fastOrderGroups(rows, [], 'snack-dus')[0].variants.length, 1);
  assert.equal(fastOrderGroups(rows, [], 'tidak-ada').length, 0);
  assert.deepEqual(fastOrderPackaging(rows[1]), { label: 'Dus', units: 12 });
  assert.deepEqual(fastOrderPackaging(rows[0]), { label: 'Satuan', units: 1 });
});

test('fast order totals only count the authoritative cart snapshot', () => {
  assert.deepEqual(fastOrderTotals(null), { sku: 0, packages: 0, amount: 0 });
  assert.deepEqual(
    fastOrderTotals({
      items: [
        { id: 'a', quantity: 2, price: 12000 },
        { id: 'b', quantity: 5, price: 3000 },
      ],
    }),
    { sku: 2, packages: 7, amount: 39000 },
  );
});
