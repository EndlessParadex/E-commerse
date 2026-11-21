import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { pindahKategori, MoveError } from './pindah-kategori.mjs';

const quiet = { log: () => {}, backup: false };

test('pindah kategori: produk pindah dengan subkategori, kategori asal hilang, isian lain tetap', async () => {
  const root = mkdtempSync(join(tmpdir(), 'bam-pindah-'));
  const dbPath = join(root, 'uji.sqlite');
  try {
    // A second snack category, as an import with an older category id would create.
    let app = createApp({ dbPath, logger: () => {} });
    const value = app.catalog.snapshot();
    const target = value.masters.categories[0];
    value.masters.categories.push({
      id: 'snack-lama',
      name: 'Snack Lama',
      icon: target.icon,
      children: [
        { id: 'keripik-lama', name: 'Keripik Lama' },
        { id: 'rumput-laut', name: 'Rumput Laut' },
      ],
    });
    const [first, second] = value.edits;
    Object.assign(first, { categoryId: 'snack-lama', subcategoryId: 'keripik-lama' });
    Object.assign(second, { categoryId: 'snack-lama', subcategoryId: 'rumput-laut' });
    app.catalog.save(value);
    const before = app.catalog.snapshot();
    app.db.close();

    const options = { dbPath, from: 'snack-lama', to: target.id, ...quiet };
    await assert.rejects(
      pindahKategori({ ...options, subs: { 'keripik-lama': 'tidak-ada' } }),
      MoveError,
    );
    const dry = await pindahKategori({
      ...options,
      subs: { 'keripik-lama': target.children[0].id },
    });
    assert.equal(dry.written, false);
    assert.equal(dry.moved.length, 2);
    const result = await pindahKategori({
      ...options,
      subs: { 'keripik-lama': target.children[0].id },
      tulis: true,
    });
    assert.equal(result.written, true);

    app = createApp({ dbPath, logger: () => {} });
    const after = app.catalog.snapshot();
    app.db.close();
    assert.equal(
      after.masters.categories.some((entry) => entry.id === 'snack-lama'),
      false,
    );
    const moved = (id) => after.edits.find((entry) => entry.groupId === id);
    assert.equal(moved(first.groupId).categoryId, target.id);
    assert.equal(moved(first.groupId).subcategoryId, target.children[0].id);
    assert.equal(
      moved(second.groupId).subcategoryId,
      'rumput-laut',
      'unmapped child is carried over',
    );
    assert.ok(
      after.masters.categories
        .find((entry) => entry.id === target.id)
        .children.some((child) => child.id === 'rumput-laut'),
    );
    // Everything else about the products is unchanged.
    const strip = (draft) => {
      const rest = { ...draft };
      delete rest.categoryId;
      delete rest.subcategoryId;
      return rest;
    };
    assert.deepEqual(strip(moved(first.groupId)), strip(before.edits[0]));
    assert.equal(after.edits.length, before.edits.length);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
