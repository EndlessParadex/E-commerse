import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appearanceAccents,
  appearanceTextSizes,
  appearanceOwner,
  appearanceStorageKey,
  defaultAppearance,
  normalizeAppearance,
  readAppearance,
  resolveAppearanceMode,
  writeAppearance,
} from './appearanceModel.js';

test('preferensi tampilan: data lama/rusak kembali ke nilai yang aman, pilihan valid tetap dipakai', () => {
  for (const value of [null, false, 'dark', [], { mode: 'invalid', background: '<script>' }])
    assert.deepEqual(normalizeAppearance(value), defaultAppearance);
  assert.deepEqual(
    normalizeAppearance({ mode: 'dark', background: 'invalid', email: 'private@example.com' }),
    { ...defaultAppearance, mode: 'dark' },
  );
  assert.deepEqual(normalizeAppearance({ mode: 'invalid', background: 'mint' }), {
    ...defaultAppearance,
    background: 'mint',
  });
  assert.deepEqual(readAppearance({ getItem: () => '{invalid json' }, 'user:1'), defaultAppearance);
});

test('preferensi tampilan: disimpan per ID akun, tamu terpisah, hanya pilihan tampilan yang disimpan', () => {
  const entries = new Map();
  const storage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  };
  const first = appearanceOwner({ id: 'a', email: 'same@example.com' });
  const second = appearanceOwner({ id: 'b', email: 'same@example.com' });
  const guest = appearanceOwner(null);
  assert.equal(
    writeAppearance(storage, first, {
      mode: 'dark',
      background: 'lavender',
      name: 'Private name',
      email: 'same@example.com',
      address: 'Private address',
    }),
    true,
  );
  assert.equal(writeAppearance(storage, second, { mode: 'system', background: 'mint' }), true);
  assert.deepEqual(readAppearance(storage, first), {
    ...defaultAppearance,
    mode: 'dark',
    background: 'lavender',
  });
  assert.deepEqual(readAppearance(storage, second), {
    ...defaultAppearance,
    mode: 'system',
    background: 'mint',
  });
  assert.deepEqual(readAppearance(storage, guest), defaultAppearance);
  assert.deepEqual(JSON.parse(entries.get(appearanceStorageKey(first))), {
    ...defaultAppearance,
    mode: 'dark',
    background: 'lavender',
  });
  assert.equal(appearanceOwner({ id: 0 }), 'user:0');
});

test('preferensi tampilan: penyimpanan tidak tersedia tetap bisa ditangani tanpa crash', () => {
  const blocked = {
    getItem() {
      throw new Error('Blocked');
    },
    setItem() {
      throw new Error('Quota');
    },
  };
  for (const storage of [null, blocked]) {
    assert.deepEqual(readAppearance(storage, 'user:1'), defaultAppearance);
    assert.equal(writeAppearance(storage, 'user:1', { mode: 'dark', background: 'sky' }), false);
  }
});

test('preferensi tampilan: hanya mode mengikuti perangkat yang mengikuti perubahan sistem', () => {
  assert.equal(resolveAppearanceMode('system', true), 'dark');
  assert.equal(resolveAppearanceMode('system', false), 'light');
  assert.equal(resolveAppearanceMode('light', true), 'light');
  assert.equal(resolveAppearanceMode('dark', false), 'dark');
});

test('ukuran teks dan aksen: data lama tetap dipakai, pilihan tersimpan per akun, nilai di luar pilihan ditolak', () => {
  const entries = new Map();
  const storage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  };
  entries.set(
    appearanceStorageKey('user:old'),
    JSON.stringify({ mode: 'dark', background: 'lavender' }),
  );
  assert.deepEqual(readAppearance(storage, 'user:old'), {
    ...defaultAppearance,
    mode: 'dark',
    background: 'lavender',
  });
  for (const size of appearanceTextSizes)
    for (const accent of appearanceAccents) {
      const preferences = { ...defaultAppearance, textSize: size.id, accent: accent.id };
      assert.equal(
        writeAppearance(storage, 'user:new', { ...preferences, color: '#ffffff', name: 'Private' }),
        true,
      );
      assert.deepEqual(readAppearance(storage, 'user:new'), preferences);
      assert.deepEqual(JSON.parse(entries.get(appearanceStorageKey('user:new'))), preferences);
      assert.equal(readAppearance(storage, 'user:old').textSize, 'normal');
    }
  assert.deepEqual(
    normalizeAppearance({ textSize: '10000%', accent: '<style>', color: '#ffffff' }),
    defaultAppearance,
  );
});
