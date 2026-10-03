import test from 'node:test';
import assert from 'node:assert/strict';
import { DELIVERY_STORAGE_KEY, normalizeDelivery, validateDelivery, readDelivery, writeDelivery } from './deliveryModel.js';

const location = { namaToko: 'Nama Contoh', namaJalan: 'Jalan Contoh No. 10, Tangerang, Banten 15810' };
const memoryStorage = () => {
  const items = new Map();
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) };
};

test('hanya nama dan alamat yang disimpan, tanpa email atau password', () => {
  const storage = memoryStorage();
  assert.equal(writeDelivery({ ...location, email: 'contoh@example.com', password: 'secret', confirmPassword: 'secret' }, storage), true);
  assert.deepEqual(JSON.parse(storage.getItem(DELIVERY_STORAGE_KEY)), location);
});

test('alamat yang disimpan dapat dimuat ulang dan diedit', () => {
  const storage = memoryStorage();
  writeDelivery(location, storage);
  assert.deepEqual(readDelivery(storage), location);
  const updated = { ...location, namaJalan: 'Jalan Baru nomor 20, Jakarta 12345' };
  writeDelivery(updated, storage);
  assert.deepEqual(readDelivery(storage), updated);
});

test('spasi luar dibersihkan dan baris alamat dipertahankan', () => {
  const value = { namaToko: '  Nama Contoh  ', namaJalan: '  Jalan Contoh No. 10\nTangerang 15810  ' };
  assert.deepEqual(normalizeDelivery(value), { namaToko: 'Nama Contoh', namaJalan: 'Jalan Contoh No. 10\nTangerang 15810' });
});

test('data tidak valid dan JSON rusak tidak menyebabkan crash atau menimpa alamat valid', () => {
  const storage = memoryStorage();
  writeDelivery(location, storage);
  assert.equal(writeDelivery({ namaToko: 'A', namaJalan: '' }, storage), false);
  assert.deepEqual(readDelivery(storage), location);
  assert.equal(normalizeDelivery(null), null);
  assert.ok(validateDelivery({ ...location, namaJalan: 'x'.repeat(501) }).namaJalan);
  storage.setItem(DELIVERY_STORAGE_KEY, '{bad-json');
  assert.equal(readDelivery(storage), null);
});

test('kegagalan penyimpanan dapat ditangani tanpa menganggap data tersimpan', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(readDelivery(blocked), null);
  assert.equal(writeDelivery(location, blocked), false);
});
