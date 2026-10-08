import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createApp, hashPassword } from '../../server/app.js';
import { products } from './products.js';
import { productDraft } from './adminEditor.js';
import { brands } from './catalogMasters.js';
import * as store from './adminStore.js';

test('browser memakai API, impor preview sekali, simpan master/produk, konflik dan sesi habis tidak mengubah katalog', async () => {
  const app = createApp({ dbPath: ':memory:' });
  let cookie = ''; let stored = null;
  const storage = { getItem: () => stored, setItem(_key, value) { stored = value; } };
  globalThis.localStorage = storage;
  const bridge = async (url, options = {}) => {
    const req = Readable.from(options.body ? [options.body] : []);
    req.method = options.method || 'GET'; req.url = url; req.headers = { host: 'bam.test', origin: 'http://bam.test', cookie, ...options.headers };
    let status; let headers; let body;
    await app.handler(req, { writeHead(s, h) { status = s; headers = h; }, end(b) { body = b; } });
    return new Response(body, { status, headers });
  };
  try {
    app.db.prepare('INSERT INTO users(id,name,email,address,password_hash,created_at,role) VALUES(?,?,?,?,?,?,?)').run('admin', 'Admin Uji', 'admin@test.id', 'Alamat lengkap admin', await hashPassword('password-test'), new Date().toISOString(), 'admin');
    const login = await bridge('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@test.id', password: 'password-test' }) });
    cookie = login.headers.get('set-cookie').split(';')[0];
    const local = productDraft(products[0].groupId); local.baseName = 'Nama dari preview';
    assert.ok(store.saveProduct(local, storage).groupId); const originalLocalData = stored;
    await store.initializeCatalog(bridge);
    assert.equal(store.catalogUsesServer, true); assert.equal(store.pendingLocalImport, true);
    assert.notEqual(products[0].baseName, 'Nama dari preview');
    assert.equal((await store.importLocalCatalog()).imported, true);
    assert.equal(products[0].baseName, 'Nama dari preview'); assert.equal(stored, originalLocalData);
    assert.equal(store.pendingLocalImport, false); assert.ok((await store.importLocalCatalog()).storageError);
    const updated = productDraft(products[0].groupId); updated.baseName = 'Nama dari server';
    assert.ok((await store.saveProduct(updated)).groupId);
    assert.equal(app.catalog.snapshot().edits.find((entry) => entry.groupId === updated.groupId).baseName, 'Nama dari server');
    const brand = brands.find((entry) => entry.id === updated.brandId);
    assert.ok((await store.saveMaster('brands', { ...brand, name: 'Merek dari server' })).id);
    assert.equal(products[0].brand, 'Merek dari server');
    const remoteEdit = app.catalog.snapshot(); remoteEdit.edits.find((entry) => entry.groupId === updated.groupId).baseName = 'Perubahan sesi lain'; app.catalog.save(remoteEdit);
    const before = JSON.stringify(products); updated.baseName = 'Perubahan stale';
    assert.match((await store.saveProduct(updated)).storageError, /server sudah berubah/);
    assert.equal(JSON.stringify(products), before); assert.equal(app.catalog.snapshot().edits.find((entry) => entry.groupId === updated.groupId).baseName, 'Perubahan sesi lain');
    await store.initializeCatalog(bridge); assert.equal(products[0].baseName, 'Perubahan sesi lain');
    const groupId = products[0].groupId; const brandId = products[0].brandId; const beforeCount = products.length;
    assert.equal((await store.deleteProduct(groupId)).deleted, true);
    assert.ok(products.length < beforeCount); assert.ok(!products.some((entry) => entry.groupId === groupId));
    await store.initializeCatalog(bridge); assert.ok(!products.some((entry) => entry.groupId === groupId));
    assert.equal((await store.deleteMaster('brands', brandId)).deleted, true);
    await store.initializeCatalog(bridge); assert.ok(!brands.some((entry) => entry.id === brandId));
    cookie = '';
    assert.match((await store.saveProduct(productDraft(products[0].groupId))).storageError, /Sesi sudah berakhir/);
    await assert.rejects(store.initializeCatalog(async () => { throw new Error('offline'); }));
    assert.match((await store.saveProduct(productDraft(products[0].groupId))).storageError, /Periksa koneksi/);
  } finally { app.db.close(); delete globalThis.localStorage; }
});
