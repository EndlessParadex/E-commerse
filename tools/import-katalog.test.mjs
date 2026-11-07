import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { importKatalog, readKatalog, ImportError } from './import-katalog.mjs';

// JPEG terkecil yang lolos pemeriksaan tanda tangan file di server/catalog.js.
const jpeg = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0xff, 0xd9,
]);

function setup(produk) {
  const root = mkdtempSync(join(tmpdir(), 'bam-impor-'));
  const folder = join(root, 'katalog-lokal');
  mkdirSync(join(folder, 'foto'), { recursive: true });
  writeFileSync(join(folder, 'foto', 'a.jpg'), jpeg);
  writeFileSync(join(folder, 'foto', 'b.jpg'), jpeg);
  writeFileSync(
    join(folder, 'katalog.json'),
    JSON.stringify({
      versi: 1,
      pemasok: { id: 'pt-uji', nama: 'PT Uji Pemasok', singkatan: 'UJI' },
      kategori: {
        id: 'snack',
        nama: 'Snack & Makanan',
        subkategori: [
          { id: 'keripik', nama: 'Keripik & Snack' },
          { id: 'biskuit', nama: 'Biskuit' },
        ],
      },
      produk,
    }),
  );
  const dbPath = join(root, 'uji.sqlite');
  createApp({ dbPath, logger: () => {} }).db.close();
  return { root, folder, dbPath };
}
const produkUji = (override = {}) => ({
  id: 'stik-uji',
  nama: 'Stik Uji',
  merek: 'Merek Uji',
  subkategori: 'biskuit',
  deskripsi: 'Produk uji impor.',
  varian: [
    {
      sku: 'STIK-20G-DUS60',
      ukuran: 20,
      satuan: 'g',
      kemasan: 'dus',
      isi: 60,
      packDalamDus: 6,
      harga: 108000,
      foto: [],
    },
    {
      sku: 'STIK-70G-DUS20',
      ukuran: 70,
      satuan: 'g',
      kemasan: 'dus',
      isi: 20,
      harga: 128000,
      foto: ['foto/a.jpg', 'foto/b.jpg'],
    },
  ],
  ...override,
});
const quiet = { log: () => {}, backup: false };
const snapshot = (dbPath) => {
  const app = createApp({ dbPath, logger: () => {} });
  try {
    return app.catalog.snapshot();
  } finally {
    app.db.close();
  }
};

test('pemeriksaan tanpa --tulis tidak mengubah database', async () => {
  const { root, folder, dbPath } = setup([produkUji()]);
  try {
    const before = snapshot(dbPath);
    const result = await importKatalog({ folder, dbPath, ...quiet });
    assert.equal(result.written, false);
    assert.deepEqual(result.newProducts, ['Stik Uji']);
    assert.equal(snapshot(dbPath).revision, before.revision);
    assert.equal(
      snapshot(dbPath).edits.some((draft) => draft.groupId === 'stik-uji'),
      false,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('--tulis membuat pemasok, merek, subkategori, varian dus, dan foto', async () => {
  const { root, folder, dbPath } = setup([produkUji()]);
  try {
    const result = await importKatalog({ folder, dbPath, tulis: true, ...quiet });
    assert.equal(result.written, true);
    const saved = snapshot(dbPath);
    assert.ok(saved.masters.suppliers.some((entry) => entry.id === 'pt-uji'));
    const brand = saved.masters.brands.find((entry) => entry.name === 'Merek Uji');
    assert.deepEqual(brand.supplierIds, ['pt-uji']);
    const snack = saved.masters.categories.find((entry) => entry.id === 'snack');
    assert.ok(snack.children.some((child) => child.id === 'biskuit'));
    const draft = saved.edits.find((entry) => entry.groupId === 'stik-uji');
    assert.equal(draft.supplierId, 'pt-uji');
    assert.equal(draft.gallery.length, 2);
    const [small, large] = draft.variants;
    assert.equal(small.packagingType, 'dus');
    assert.equal(small.unitsPerPackage, '60');
    assert.equal(small.packsPerBox, '6');
    assert.equal(small.price, '108000');
    // Varian pertama yang punya foto menjadi galeri produk, tidak disimpan dua kali.
    assert.equal(large.gallery, undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('produk yang sudah ada ditolak kecuali --perbarui, dan SKU lama wajib tetap ada', async () => {
  const { root, folder, dbPath } = setup([produkUji()]);
  try {
    await importKatalog({ folder, dbPath, tulis: true, ...quiet });
    await assert.rejects(importKatalog({ folder, dbPath, tulis: true, ...quiet }), /sudah ada/);
    const data = JSON.parse(readFileSync(join(folder, 'katalog.json'), 'utf8'));
    data.produk[0].varian[1].harga = 130000;
    writeFileSync(join(folder, 'katalog.json'), JSON.stringify(data));
    await importKatalog({ folder, dbPath, tulis: true, perbarui: true, ...quiet });
    const draft = snapshot(dbPath).edits.find((entry) => entry.groupId === 'stik-uji');
    assert.equal(draft.variants[1].price, '130000');
    data.produk[0].varian.pop();
    writeFileSync(join(folder, 'katalog.json'), JSON.stringify(data));
    await assert.rejects(
      importKatalog({ folder, dbPath, tulis: true, perbarui: true, ...quiet }),
      /SKU lama/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('--hapus-contoh membuang produk dan master contoh yang tidak terpakai', async () => {
  const { root, folder, dbPath } = setup([produkUji()]);
  try {
    assert.ok(snapshot(dbPath).edits.length > 1);
    const result = await importKatalog({
      folder,
      dbPath,
      tulis: true,
      hapusContoh: true,
      ...quiet,
    });
    assert.ok(result.removed.length > 0);
    const saved = snapshot(dbPath);
    assert.deepEqual(
      saved.edits.map((draft) => draft.groupId),
      ['stik-uji'],
    );
    assert.deepEqual(
      saved.masters.categories.map((entry) => entry.id),
      ['snack'],
    );
    assert.deepEqual(
      saved.masters.suppliers.map((entry) => entry.id),
      ['pt-uji'],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('isian salah dihentikan sebelum database dibuka', async () => {
  const cases = [
    [{ varian: [{ ...produkUji().varian[0], harga: 0 }] }, /harga/],
    [{ subkategori: 'tidak-ada' }, /subkategori/],
    [{ varian: [{ ...produkUji().varian[1], foto: ['../rahasia.jpg'] }] }, /di dalam folder/],
    [{ varian: [{ ...produkUji().varian[0], isi: 61, packDalamDus: 6 }] }, /./],
  ];
  for (const [override, message] of cases) {
    const { root, folder, dbPath } = setup([produkUji(override)]);
    try {
      await assert.rejects(importKatalog({ folder, dbPath, ...quiet }), message);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
  assert.throws(() => readKatalog(join(tmpdir(), 'folder-yang-tidak-ada')), ImportError);
});

test('memakai pemasok, merek, subkategori, dan produk yang dibuat lewat Admin', async () => {
  const { root, folder, dbPath } = setup([produkUji()]);
  try {
    // Tiru data yang diketik manual di Admin: ID berawalan dan produk dengan SKU yang sama.
    const app = createApp({ dbPath, logger: () => {} });
    try {
      const current = app.catalog.snapshot();
      const masters = structuredClone(current.masters);
      masters.suppliers.push({
        id: 'suppliers-pt-uji-pemasok',
        name: 'PT Uji Pemasok',
        initials: 'UJI',
        color: 'red',
        logo: '',
      });
      masters.brands.push({
        id: 'brands-merek-uji',
        name: 'Merek Uji',
        supplierIds: ['suppliers-pt-uji-pemasok'],
        logo: '',
      });
      masters.categories
        .find((entry) => entry.id === 'snack')
        .children.push({ id: 'sub-biskuit', name: 'Biskuit' });
      const manual = {
        groupId: 'produk-manual-1',
        baseName: 'Stik Uji',
        brandId: 'brands-merek-uji',
        brand: 'Merek Uji',
        supplierId: 'suppliers-pt-uji-pemasok',
        color: 'sky',
        categoryId: 'snack',
        subcategoryId: 'sub-biskuit',
        description: 'Diketik manual.',
        image: '',
        imageAlt: '',
        gallery: [],
        variants: [
          {
            id: 'STIK-70G-DUS20',
            sizeValue: '70',
            sizeUnit: 'g',
            packagingType: 'dus',
            unitsPerPackage: '20',
            packsPerBox: '',
            price: '125000',
            oldPrice: '',
          },
        ],
      };
      app.catalog.save({
        version: 1,
        revision: current.revision,
        masters,
        edits: [...current.edits, manual],
      });
    } finally {
      app.db.close();
    }
    await assert.rejects(importKatalog({ folder, dbPath, ...quiet }), /sudah ada/);
    await importKatalog({ folder, dbPath, tulis: true, perbarui: true, ...quiet });
    const saved = snapshot(dbPath);
    assert.equal(
      saved.masters.suppliers.filter((entry) => entry.name === 'PT Uji Pemasok').length,
      1,
    );
    assert.equal(saved.masters.brands.filter((entry) => entry.name === 'Merek Uji').length, 1);
    const draft = saved.edits.find((entry) => entry.baseName === 'Stik Uji');
    assert.equal(draft.groupId, 'produk-manual-1');
    assert.equal(draft.supplierId, 'suppliers-pt-uji-pemasok');
    assert.equal(draft.brandId, 'brands-merek-uji');
    assert.equal(draft.subcategoryId, 'sub-biskuit');
    assert.deepEqual(
      draft.variants.map((variant) => [variant.id, variant.price]),
      [
        ['STIK-20G-DUS60', '108000'],
        ['STIK-70G-DUS20', '128000'],
      ],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
