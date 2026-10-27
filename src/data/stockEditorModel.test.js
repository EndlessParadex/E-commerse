import test from 'node:test';
import assert from 'node:assert/strict';
import {
  maxStockUnits,
  stockEditorFactors,
  stockEditorCounts,
  stockEditorEmpty,
  previewStockEditor,
} from './stockEditorModel.js';

const unit = { packagingType: 'satuan', unitsPerPackage: 1 };
const pack = { packagingType: 'pack', unitsPerPackage: 10 };
const dus = { packagingType: 'dus', unitsPerPackage: 40, packsPerBox: 4 };
const variants = [unit, pack, dus];
const factors = stockEditorFactors(variants);
const preview = (mode, available, counts, usedFactors = factors) =>
  previewStockEditor({ mode, available, counts, factors: usedFactors });

test('stok kemasan memakai faktor katalog, bukan asumsi, dan merinci stok awal tanpa duplikasi', () => {
  assert.deepEqual(factors, { dus: 40, karton: 0, box: 0, pack: 10, renceng: 0, satuan: 1 });
  assert.deepEqual(stockEditorCounts(119, variants), {
    dus: '2',
    karton: '0',
    box: '0',
    pack: '3',
    renceng: '0',
    satuan: '9',
  });
  assert.deepEqual(preview('replace', 119, stockEditorCounts(119, variants)), {
    units: 119,
    finalStock: 119,
    error: '',
  });
  assert.deepEqual(stockEditorFactors([unit]), {
    dus: 0,
    karton: 0,
    box: 0,
    pack: 0,
    renceng: 0,
    satuan: 1,
  });
  assert.deepEqual(stockEditorCounts(15, [unit]), {
    dus: '0',
    karton: '0',
    box: '0',
    pack: '0',
    renceng: '0',
    satuan: '15',
  });
});

test('tetapkan stok dan tambah stok memakai jumlah kemasan tanpa menggandakan isi dus', () => {
  const counts = { dus: '1', karton: '0', pack: '2', satuan: '4' };
  assert.deepEqual(preview('replace', 119, counts), {
    units: 64,
    finalStock: 64,
    error: '',
  });
  assert.deepEqual(preview('add', 119, counts), {
    units: 64,
    finalStock: 183,
    error: '',
  });
  assert.deepEqual(preview('add', 119, stockEditorEmpty()), {
    units: 0,
    finalStock: 119,
    error: '',
  });
});

test('pengisian kemasan tidak dikenal, pecahan, negatif, tak hingga, overflow ditolak', () => {
  const base = { dus: '0', karton: '0', pack: '0', satuan: '0' };
  for (const [type, value] of [
    ['karton', '1'],
    ['dus', '-1'],
    ['satuan', '1.5'],
    ['pack', ''],
    ['satuan', 'x'],
    ['satuan', '1000000001'],
  ]) {
    const valueInput = { ...base, [type]: value };
    assert.ok(preview('replace', 119, valueInput).error);
    assert.equal(preview('replace', 119, valueInput).finalStock, null);
  }
  assert.match(
    preview('replace', 119, { ...base, dus: '1' }, stockEditorFactors([unit])).error,
    /belum tersedia/,
  );
  assert.match(preview('add', maxStockUnits, { ...base, satuan: '1' }).error, /melebihi/);
  assert.match(preview('replace', 0, { ...base, dus: '25000001' }).error, /melebihi/);
  assert.ok(preview('invalid', 100, base).error);
});
