import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../server/app.js';
import { products } from './products.js';
import { productDraft, buildVariants, validateDraft } from './adminEditor.js';
import { draftProductPhotos } from './productPhotos.js';
import { initializeCatalog, saveProduct } from './adminStore.js';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9i0AAAAASUVORK5CYII=';
const second = 'data:image/png;base64,' + Buffer.concat([Buffer.from(png.split(',')[1], 'base64'), Buffer.from([0])]).toString('base64');
const legacyReply = (snapshot) => {
  const value = structuredClone(snapshot); delete value.capabilities.gallery;
  for (const draft of value.edits) { delete draft.gallery; for (const variant of draft.variants) delete variant.gallery; }
  return value;
};

test('foto lama masuk editor, galeri mengikuti SKU sendiri, dan batas foto diperiksa sebelum penyimpanan', () => {
  const items = products.filter((entry) => entry.groupId === 'snack-pedas').map((entry, index) => ({ ...entry, image: index === 1 ? second : png, gallery: [] }));
  const draft = productDraft('snack-pedas', items);
  assert.equal(draft.gallery[0].src, png);
  assert.equal(draft.variants[1].gallery[0].src, second);
  const rebuilt = buildVariants(draft, items);
  assert.equal(rebuilt[0].image, png); assert.equal(rebuilt[1].image, second);
  assert.equal(draftProductPhotos(draft, draft.variants[1])[0].src, second);
  draft.variants[1].gallery = []; assert.deepEqual(draftProductPhotos(draft, draft.variants[1]), []);
  assert.equal(buildVariants(draft, items)[1].image, '');
  draft.gallery = Array.from({ length: 9 }, () => ({ src: png, alt: '' }));
  assert.match(validateDraft(draft, items).gallery, /Maksimal 8/);
  draft.gallery = [{ src: 'data:image/svg+xml;base64,AAA', alt: '' }];
  assert.match(validateDraft(draft, items).gallery, /JPG, PNG/);
});

test('server lama tidak menerima beberapa foto; restart dan muat ulang menyimpan semua foto sesuai urutan', async () => {
  const app = createApp({ dbPath: ':memory:' }); let legacy = true; let writes = 0;
  const transport = async (_url, options = {}) => {
    if (options.method === 'PUT') { writes += 1; assert.equal(legacy, false); return new Response(JSON.stringify(app.catalog.save(JSON.parse(options.body)))); }
    return new Response(JSON.stringify(legacy ? legacyReply(app.catalog.snapshot()) : app.catalog.snapshot()));
  };
  try {
    await initializeCatalog(transport);
    const draft = productDraft('snack-pedas'); draft.image = png; draft.gallery = [{ src: png, alt: '' }, { src: second, alt: '' }];
    const before = JSON.stringify(products);
    const rejected = await saveProduct(draft);
    assert.match(rejected.storageError, /belum mendukung beberapa foto/); assert.equal(writes, 0); assert.equal(JSON.stringify(products), before);
    legacy = false; await initializeCatalog(transport);
    assert.ok((await saveProduct(draft)).groupId); assert.equal(writes, 1);
    await initializeCatalog(transport);
    assert.deepEqual(productDraft('snack-pedas').gallery, draft.gallery);
    assert.ok(products.filter((entry) => entry.groupId === 'snack-pedas').every((entry) => entry.gallery.length === 2));
  } finally { app.db.close(); }
});

test('balasan yang kehilangan foto tambahan tidak dianggap berhasil dan tidak mengganti katalog pembeli', async () => {
  const app = createApp({ dbPath: ':memory:' });
  const transport = async (_url, options = {}) => {
    const snapshot = options.method === 'PUT' ? app.catalog.save(JSON.parse(options.body)) : app.catalog.snapshot();
    return new Response(JSON.stringify(options.method === 'PUT' ? legacyReply(snapshot) : snapshot));
  };
  try {
    await initializeCatalog(transport);
    const draft = productDraft('snack-pedas'); draft.image = second; draft.gallery = [{ src: second, alt: '' }, { src: png, alt: '' }];
    const before = JSON.stringify(products); const result = await saveProduct(draft);
    assert.match(result.storageError, /foto produk yang berbeda/); assert.equal(result.groupId, undefined);
    assert.equal(JSON.stringify(products), before);
  } finally { app.db.close(); }
});
