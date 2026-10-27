import test from 'node:test';
import assert from 'node:assert/strict';
import { b2bPackingList } from './b2bPackingList.js';
import { stockBreakdown } from './stockPresentation.js';
import { stockEditorFactors, stockEditorCounts, previewStockEditor } from './stockEditorModel.js';
const item = (type, units, quantity = 2) => ({
  id: type,
  name: 'Nama lama',
  price: 987654321,
  quantity,
  details: {
    name: 'Barang snapshot',
    brand: 'Merek',
    sizeLabel: '100g',
    packaging: { packagingType: type, unitsPerPackage: units, sizeLabel: '100g' },
  },
});
test('packing list prints only order snapshots and quantities, without any monetary/contact fields', () => {
  const order = {
    b2b: { storeName: 'Toko contoh', sales: [{ name: 'Sales snapshot' }] },
    address: 'ALAMAT_RAHASIA',
    total: 999888777,
    payment: { groupId: 'cod' },
    seller: { phone: '081234567890' },
    items: [
      item('satuan', 1),
      item('pack', 6),
      item('box', 24),
      item('dus', 120),
      item('renceng', 12),
    ],
  };
  const printed = b2bPackingList(order);
  assert.equal(printed.storeName, 'Toko contoh');
  assert.deepEqual(printed.totals, { satuan: 2, pack: 2, box: 2, dus: 2, renceng: 2 });
  assert.equal(printed.rows[2].contents, '1 box = 24 satuan');
  assert.equal(printed.productCount, 1);
  assert.doesNotMatch(
    JSON.stringify(printed),
    /987654321|999888777|ALAMAT_RAHASIA|081234567890|payment|price|discount/,
  );
  assert.throws(
    () => b2bPackingList({ ...order, items: [{ id: 'legacy', name: 'Old', quantity: 1 }] }),
    /Snapshot kemasan/,
  );
  assert.throws(() => b2bPackingList({ ...order, b2b: null }), /difinalisasi/);
});
test('Box and Renceng share unit inventory without double counting or guessed factors', () => {
  const variants = [
    item('satuan', 1),
    item('pack', 6),
    item('box', 24),
    item('dus', 120),
    item('renceng', 12),
  ].map((row) => row.details.packaging);
  const factors = stockEditorFactors(variants);
  assert.equal(factors.box, 24);
  assert.equal(factors.renceng, 12);
  for (const available of [0, 1, 119, 157, 1000000000]) {
    const counts = stockEditorCounts(available, variants);
    assert.equal(
      previewStockEditor({ mode: 'replace', counts, factors, available }).finalStock,
      available,
    );
    assert.equal(
      stockBreakdown(available, variants).items.reduce(
        (sum, row) => sum + row.quantity * row.unitsPerPackage,
        0,
      ),
      available,
    );
  }
});
