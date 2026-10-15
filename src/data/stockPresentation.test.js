import test from 'node:test';
import assert from 'node:assert/strict';
import { stockBreakdown } from './stockPresentation.js';

const unit = { packagingType: 'satuan', unitsPerPackage: 1 };
const pack = (units) => ({ packagingType: 'pack', unitsPerPackage: units });
const box = (units, packsPerBox = 0) => ({
  packagingType: 'dus',
  unitsPerPackage: units,
  packsPerBox,
});
const quantities = (result) => result.items.map((item) => item.quantity);

test('stok 119 dibagi menjadi 2 dus, 3 pack, dan 9 satuan; batas kemasan tetap tepat', () => {
  const variants = [unit, pack(10), box(40, 4)];
  for (const [available, expected] of [
    [119, [2, 3, 9]],
    [120, [3, 0, 0]],
    [40, [1, 0, 0]],
    [39, [0, 3, 9]],
    [10, [0, 1, 0]],
    [9, [0, 0, 9]],
    [0, [0, 0, 0]],
  ]) {
    const result = stockBreakdown(available, variants);
    assert.deepEqual(quantities(result), expected);
    assert.equal(result.totalUnits, available);
    assert.equal(
      result.items.reduce((sum, item) => sum + item.quantity * item.unitsPerPackage, 0),
      available,
    );
  }
});

test('ringkasan mengikuti isi kemasan nyata, pack dalam dus, dan katalog tanpa jenis tertentu', () => {
  assert.deepEqual(quantities(stockBreakdown(119, [unit])), [0, 0, 119]);
  assert.deepEqual(quantities(stockBreakdown(119, [pack(10)])), [0, 11, 9]);
  assert.deepEqual(quantities(stockBreakdown(119, [box(40)])), [2, 0, 39]);
  const inferred = stockBreakdown(119, [box(40, 4)]);
  assert.deepEqual(quantities(inferred), [2, 3, 9]);
  assert.equal(inferred.items[1].unitsPerPackage, 10);
  assert.equal(
    stockBreakdown(119, [pack(6), box(40, 4)]).items[1].unitsPerPackage,
    10,
    'explicit contents of the selected box define its inner packs',
  );
  const choices = [box(24, 4), pack(6), box(40), pack(10), unit];
  assert.deepEqual(quantities(stockBreakdown(119, choices)), [2, 3, 9]);
  assert.deepEqual(
    stockBreakdown(119, choices),
    stockBreakdown(119, [...choices].reverse()),
    'catalog order does not change the breakdown',
  );
  assert.equal(
    stockBreakdown(119, [pack(100), box(40)]).items[1].unitsPerPackage,
    100,
    'a configured pack is not mislabeled as absent even when it is larger than the box',
  );
  assert.deepEqual(
    quantities(
      stockBreakdown(119, [pack(0), box(40, 3), { packagingType: 'unknown', unitsPerPackage: 10 }]),
    ),
    [0, 0, 119],
  );
});

test('jumlah ringkasan selalu sama dengan stok asal, termasuk angka besar dan konfigurasi berbeda', () => {
  for (const variants of [
    [unit],
    [pack(10)],
    [box(24, 4)],
    [pack(6), box(40)],
    [pack(100), box(40)],
    [pack(10), box(40, 4)],
  ]) {
    for (const available of [...Array.from({ length: 241 }, (_, value) => value), 1_000_000_000]) {
      const result = stockBreakdown(available, variants);
      assert.equal(
        result.items.reduce((sum, item) => sum + item.quantity * item.unitsPerPackage, 0),
        available,
      );
      assert.ok(
        result.items.every((item) => Number.isSafeInteger(item.quantity) && item.quantity >= 0),
      );
    }
  }
  for (const invalid of [-1, 1.5, NaN, Infinity, '119', Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => stockBreakdown(invalid, [unit]), RangeError);
});
