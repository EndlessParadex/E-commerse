import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../server/app.js';
import { productDraft } from './adminEditor.js';
import { products } from './products.js';
import { initializeCatalog, saveProduct } from './adminStore.js';

const legacyReply = (snapshot) => {
  const value = structuredClone(snapshot); delete value.capabilities;
  for (const draft of value.edits) for (const variant of draft.variants) { delete variant.packagingType; delete variant.unitsPerPackage; delete variant.packsPerBox; }
  return value;
};
test('server lama menolak penyimpanan pack sebelum dikirim; setelah restart pilihan Pack isi 12 tersimpan', async () => {
  const app = createApp({ dbPath: ':memory:' }); let oldServer = true; let writes = 0;
  const transport = async (_url, options = {}) => {
    if (options.method === 'PUT') {
      writes += 1; assert.equal(oldServer, false, 'must never write bundle contents to the legacy server');
      return new Response(JSON.stringify(app.catalog.save(JSON.parse(options.body))));
    }
    const snapshot = app.catalog.snapshot(); return new Response(JSON.stringify(oldServer ? legacyReply(snapshot) : snapshot));
  };
  try {
    await initializeCatalog(transport);
    const draft = productDraft('snack-pedas'); Object.assign(draft.variants[0], { packagingType: 'pack', unitsPerPackage: '12', price: '250000', oldPrice: '' });
    const before = JSON.stringify(products);
    const rejected = await saveProduct(draft);
    assert.match(rejected.storageError, /Server yang berjalan belum mendukung Pack\/Dus/);
    assert.equal(writes, 0); assert.equal(app.catalog.snapshot().revision, 0); assert.equal(JSON.stringify(products), before);
    assert.equal(draft.variants[0].packagingType, 'pack'); assert.equal(draft.variants[0].unitsPerPackage, '12');
    oldServer = false; await initializeCatalog(transport);
    assert.ok((await saveProduct(draft)).groupId); assert.equal(writes, 1);
    const saved = app.catalog.snapshot().edits.find((entry) => entry.groupId === draft.groupId).variants[0];
    assert.equal(saved.packagingType, 'pack'); assert.equal(saved.unitsPerPackage, '12'); assert.equal(saved.price, '250000');
    assert.match(products.find((entry) => entry.id === saved.id).name, /Pack isi 12 satuan/);
  } finally { app.db.close(); }
});
test('balasan sukses yang kehilangan informasi kemasan tidak dianggap berhasil atau mengganti katalog browser', async () => {
  const app = createApp({ dbPath: ':memory:' }); let writes = 0;
  const transport = async (_url, options = {}) => {
    if (options.method === 'PUT') { writes += 1; return new Response(JSON.stringify(legacyReply(app.catalog.save(JSON.parse(options.body))))); }
    return new Response(JSON.stringify(app.catalog.snapshot()));
  };
  try {
    await initializeCatalog(transport);
    const draft = productDraft('snack-pedas'); Object.assign(draft.variants[0], { packagingType: 'pack', unitsPerPackage: '18', price: '250000', oldPrice: '' });
    const before = JSON.stringify(products); const result = await saveProduct(draft);
    assert.match(result.storageError, /Hasil penyimpanan perlu diperiksa/); assert.equal(result.groupId, undefined);
    assert.equal(writes, 1); assert.equal(JSON.stringify(products), before); assert.equal(draft.variants[0].unitsPerPackage, '18');
  } finally { app.db.close(); }
});
