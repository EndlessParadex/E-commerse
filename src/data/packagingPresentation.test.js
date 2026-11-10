import test from 'node:test';
import assert from 'node:assert/strict';
import { unitPrice } from './packagingPresentation.js';

test('harga per satuan dihitung dari isi kemasan; satuan dan data rusak tidak ditampilkan', () => {
  const dus = { packagingType: 'dus', unitsPerPackage: 20 };
  assert.deepEqual(unitPrice(dus, 128000), { value: 6400, exact: true });
  // Dus berisi pack: unitsPerPackage sudah total satuan.
  assert.deepEqual(
    unitPrice({ packagingType: 'dus', unitsPerPackage: 120, packsPerBox: 12 }, 141000),
    { value: 1175, exact: true },
  );
  // Tidak habis dibagi: dibulatkan dan ditandai.
  assert.deepEqual(unitPrice({ packagingType: 'pack', unitsPerPackage: 6 }, 10000), {
    value: 1667,
    exact: false,
  });
  assert.equal(unitPrice({ packagingType: 'satuan', unitsPerPackage: 1 }, 5000), null);
  assert.equal(unitPrice({}, 5000), null);
  assert.equal(unitPrice(undefined, 5000), null);
  assert.equal(unitPrice(dus, 0), null);
  assert.equal(unitPrice(dus, 'abc'), null);
});
