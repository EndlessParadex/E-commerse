import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, unlinkSync, rmdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from './app.js';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9i0AAAAASUVORK5CYII=';
const second = 'data:image/png;base64,' + Buffer.concat([Buffer.from(png.split(',')[1], 'base64'), Buffer.from([0])]).toString('base64');

test('beberapa foto dan foto khusus SKU tersimpan setelah server dibuka ulang; klien lama tidak menghapus galeri', () => {
  const directory = mkdtempSync(join(tmpdir(), 'bam-gallery-')); const path = join(directory, 'catalog.sqlite'); let app;
  try {
    app = createApp({ dbPath: path });
    const input = app.catalog.snapshot(); const draft = input.edits[0];
    draft.image = png; draft.gallery = [{ src: png, alt: '' }, { src: second, alt: '' }];
    draft.variants[1].gallery = [{ src: second, alt: 'Foto ukuran lain' }];
    let saved = app.catalog.save(input);
    assert.equal(saved.capabilities.gallery, true);
    assert.deepEqual(saved.edits[0].gallery, draft.gallery);
    assert.deepEqual(saved.edits[0].variants[1].gallery, draft.variants[1].gallery);
    app.db.close(); app = createApp({ dbPath: path });
    assert.deepEqual(app.catalog.snapshot(), saved);
    const older = structuredClone(saved);
    for (const entry of older.edits) { delete entry.gallery; for (const variant of entry.variants) delete variant.gallery; }
    older.edits[0].variants[0].price = '19000';
    saved = app.catalog.save(older);
    assert.deepEqual(saved.edits[0].gallery, draft.gallery);
    assert.deepEqual(saved.edits[0].variants[1].gallery, draft.variants[1].gallery);
    for (const mutate of [
      (value) => { value.edits[0].gallery = Array.from({ length: 9 }, () => ({ src: png })); },
      (value) => { value.edits[0].gallery[0].src = 'data:image/png;base64,SGVsbG8gd29ybGQsIHNwb29mZWQ='; },
      (value) => { value.edits[0].gallery[0].src = 'https://example.com/image.png'; },
      (value) => { value.edits[0].gallery[0].src = 'data:image/png;base64,' + 'A'.repeat(1400000); },
      (value) => { value.edits[0].gallery[0].alt = 'x'.repeat(161); },
      (value) => { value.edits[0].variants[1].gallery = [{ src: '' }]; },
    ]) {
      const invalid = structuredClone(saved); mutate(invalid);
      assert.throws(() => app.catalog.save(invalid), { status: 422 });
      assert.deepEqual(app.catalog.snapshot(), saved, 'invalid photos never change stored catalog');
    }
    const removed = structuredClone(saved); removed.edits[0].image = ''; removed.edits[0].gallery = [];
    removed.edits[0].variants.forEach((variant) => { variant.gallery = null; });
    saved = app.catalog.save(removed);
    assert.deepEqual(saved.edits[0].gallery, []);
    assert.ok(saved.edits[0].variants.every((variant) => !Object.hasOwn(variant, 'gallery')));
    app.db.close(); app = createApp({ dbPath: path });
    assert.deepEqual(app.catalog.snapshot(), saved);
    assert.deepEqual(app.db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    app?.db.close();
    for (const suffix of ['', '-wal', '-shm']) if (existsSync(path + suffix)) unlinkSync(path + suffix);
    rmdirSync(directory);
  }
});
