import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, unlinkSync, rmdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from './app.js';

test('migrasi database lama mempertahankan SKU, foto, akun, revisi; pack/dus tersimpan setelah server dibuka kembali', () => {
  const directory = mkdtempSync(join(tmpdir(), 'bam-packaging-')); const path = join(directory, 'catalog.sqlite'); let app; let legacy;
  try {
    app = createApp({ dbPath: path });
    const draft = app.catalog.snapshot(); draft.edits[0].baseName = 'Produk tersimpan lama';
    draft.edits[0].image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9i0AAAAASUVORK5CYII=';
    const before = app.catalog.save(draft);
    app.db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)').run('legacy-user', 'User lama', 'lama@test.id', 'Alamat lama', 'hash-only-fixture', '2026-10-09', 'admin');
    app.db.close(); app = null;
    // Reproduce the schema distributed before packaging, with the saved data.
    legacy = new DatabaseSync(path);
    legacy.exec(`PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;
      CREATE TABLE old_variants (id TEXT PRIMARY KEY COLLATE NOCASE, product_id TEXT REFERENCES catalog_products(id), size_value REAL NOT NULL, size_unit TEXT NOT NULL, price INTEGER NOT NULL CHECK(price>0), old_price INTEGER NOT NULL CHECK(old_price>=0), position INTEGER NOT NULL, UNIQUE(product_id,size_value,size_unit));
      INSERT INTO old_variants SELECT id,product_id,size_value,size_unit,price,old_price,position FROM catalog_variants;
      DROP TABLE catalog_variants; ALTER TABLE old_variants RENAME TO catalog_variants; COMMIT;`);
    legacy.close(); legacy = null;
    app = createApp({ dbPath: path });
    assert.deepEqual(app.catalog.snapshot(), before); assert.deepEqual(app.db.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal(app.db.prepare('SELECT role FROM users WHERE id=?').get('legacy-user').role, 'admin');
    const next = app.catalog.snapshot(); const single = next.edits[0].variants[0];
    next.edits[0].variants.push({ ...single, id: 'MIGRATE-PACK', packagingType: 'pack', unitsPerPackage: '6', price: '90000', oldPrice: '' },
      { ...single, id: 'MIGRATE-DUS', packagingType: 'dus', unitsPerPackage: '24', packsPerBox: '4', price: '350000', oldPrice: '' });
    let saved = app.catalog.save(next); assert.equal(saved.revision, before.revision + 1);
    const olderClient = structuredClone(saved);
    for (const draft of olderClient.edits) for (const variant of draft.variants) { delete variant.packagingType; delete variant.unitsPerPackage; delete variant.packsPerBox; }
    saved = app.catalog.save(olderClient);
    assert.equal(saved.edits[0].variants.at(-2).unitsPerPackage, '6'); assert.equal(saved.edits[0].variants.at(-1).packsPerBox, '4');
    for (const mutate of [
      (value) => { value.edits[0].variants.at(-1).unitsPerPackage = '1.5'; },
      (value) => { value.edits[0].variants.at(-1).packsPerBox = '5'; },
      (value) => { value.edits[0].variants.at(-1).packagingType = 'pallet'; },
      (value) => { value.edits[0].variants.push({ ...value.edits[0].variants.at(-2), id: 'DUPLICATE-COMBINATION' }); },
      (value) => { value.edits[0].variants.at(-1).id = 'migrate-pack'; },
    ]) {
      const invalid = structuredClone(saved); mutate(invalid); assert.throws(() => app.catalog.save(invalid), { status: 422 });
      assert.deepEqual(app.catalog.snapshot(), saved);
    }
    app.db.close(); app = createApp({ dbPath: path });
    assert.deepEqual(app.catalog.snapshot(), saved); assert.deepEqual(app.db.prepare('PRAGMA foreign_key_check').all(), []);
    // A second startup keeps the migrated schema and values unchanged.
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM catalog_variants').get().n, 27);
  } finally {
    legacy?.close(); app?.db.close();
    for (const suffix of ['', '-wal', '-shm']) if (existsSync(path + suffix)) unlinkSync(path + suffix);
    rmdirSync(directory);
  }
});
