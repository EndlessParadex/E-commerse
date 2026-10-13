import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { createApp, hashPassword } from './app.js';
import { companyEnvironment } from '../tools/company-command.cjs';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9i0AAAAASUVORK5CYII=';
async function request(app, method, url, body, cookie = '', headers = {}) {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]); req.method = method; req.url = url;
  req.headers = { host: 'test.local', origin: 'http://test.local', 'content-type': 'application/json', cookie, ...headers };
  let result; const res = { writeHead(status, replyHeaders) { result = { status, headers: replyHeaders }; }, end(value) { result.body = JSON.parse(value); } };
  await app.handler(req, res); return result;
}
async function admin(app) {
  app.db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)').run('admin-test', 'Admin Perusahaan', 'admin@test.id', 'Alamat admin perusahaan', await hashPassword('company-test-password'), new Date().toISOString(), 'admin');
  const login = await request(app, 'POST', '/api/auth/login', { email: 'admin@test.id', password: 'company-test-password' });
  return login.headers['set-cookie'].split(';')[0];
}
test('instalasi perusahaan kosong; identitas, katalog pertama dan mode tetap tersimpan setelah server dibuka lagi', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'bam-company-')); const dbPath = join(dir, 'company.sqlite');
  let app = createApp({ dbPath, installMode: 'company' });
  try {
    const first = app.catalog.snapshot(); assert.deepEqual(first.edits, []); assert.deepEqual(first.masters, { suppliers: [], brands: [], categories: [] });
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 0); assert.equal(first.company.mode, 'company');
    const cookie = await admin(app);
    const draft = { version: 1, revision: 0, profile: { ...first.company.profile, shortName: 'Toko Contoh', legalName: 'PT Contoh Mandiri', logo: png, address: 'Jl. Usaha No. 10', email: 'info@contoh.id', phone: '+62 812-3456-7890' } };
    const saved = await request(app, 'PUT', '/api/admin/company', draft, cookie); assert.equal(saved.status, 200); assert.equal(saved.body.revision, 1);
    const catalog = { version: 1, revision: 0, masters: { suppliers: [{ id: 'pt-sendiri', name: 'PT Pemasok Sendiri', initials: 'PS', color: 'sky', logo: '' }], brands: [{ id: 'merek-sendiri', name: 'Merek Sendiri', supplierIds: ['pt-sendiri'] }], categories: [{ id: 'kategori-sendiri', name: 'Kategori Sendiri', icon: '📦', children: [{ id: 'umum', name: 'Umum' }] }] }, edits: [{ groupId: 'produk-sendiri', baseName: 'Produk Perusahaan', brandId: 'merek-sendiri', supplierId: 'pt-sendiri', categoryId: 'kategori-sendiri', subcategoryId: 'umum', description: 'Deskripsi produk milik perusahaan.', color: 'sky', image: '', imageAlt: '', gallery: [], variants: [{ id: 'SKU-PERTAMA', sizeValue: '1', sizeUnit: 'pcs', price: '5000', oldPrice: '', packagingType: 'satuan', unitsPerPackage: '1', packsPerBox: '' }] }] };
    assert.equal((await request(app, 'PUT', '/api/admin/catalog', catalog, cookie)).status, 200);
    const before = app.catalog.snapshot(); app.db.close(); app = createApp({ dbPath, installMode: 'demo' });
    assert.deepEqual(app.catalog.snapshot(), before); assert.equal(app.catalog.snapshot().edits.length, 1);
    assert.equal(companyEnvironment({ BAM_DB_PATH: dbPath }).BAM_INSTALL_MODE, 'company');
    const other = createApp({ dbPath: join(dir, 'other.sqlite'), installMode: 'company' });
    try { assert.equal(other.catalog.snapshot().edits.length, 0); assert.notEqual(other.company.snapshot().instanceId, before.company.instanceId); assert.equal(other.company.snapshot().profile.shortName, 'Toko Anda'); }
    finally { other.db.close(); }
  } finally { app.db.close(); rmSync(dir, { recursive: true, force: true }); }
});
test('admin saja dapat menyimpan; konflik, origin, logo palsu dan field tidak valid tidak merusak data perusahaan', async () => {
  const app = createApp({ dbPath: ':memory:', installMode: 'company' });
  try {
    const initial = app.company.snapshot(); const body = { version: 1, revision: 0, profile: { ...initial.profile, shortName: 'Toko Test' } };
    assert.equal((await request(app, 'PUT', '/api/admin/company', body)).status, 401);
    const registration = await request(app, 'POST', '/api/auth/register', { name: 'Pelanggan', email: 'user@test.id', password: 'test-password', address: 'Alamat pelanggan lengkap', role: 'admin' });
    assert.equal(registration.body.user.role, 'user');
    assert.equal((await request(app, 'PUT', '/api/admin/company', body, registration.headers['set-cookie'].split(';')[0])).status, 403);
    const cookie = await admin(app);
    assert.equal((await request(app, 'PUT', '/api/admin/company', body, cookie, { origin: 'https://other.test' })).status, 403);
    for (const patch of [{ shortName: '' }, { email: 'bad-address' }, { logo: 'data:image/png;base64,QUFBQUFBQUFBQUFB' }, { address: 'x'.repeat(501) }]) {
      assert.equal((await request(app, 'PUT', '/api/admin/company', { ...body, profile: { ...body.profile, ...patch } }, cookie)).status, 422);
      assert.deepEqual(app.company.snapshot(), initial);
    }
    assert.equal((await request(app, 'PUT', '/api/admin/company', { ...body, mode: 'demo', instanceId: 'changed' }, cookie)).status, 200);
    const before = app.company.snapshot(); assert.equal(before.mode, 'company'); assert.equal(before.instanceId, initial.instanceId);
    assert.equal((await request(app, 'PUT', '/api/admin/company', body, cookie)).status, 409); assert.deepEqual(app.company.snapshot(), before);
    assert.deepEqual((await request(app, 'GET', '/api/company')).body, before); assert.deepEqual(app.catalog.snapshot().edits, []);
  } finally { app.db.close(); }
});
test('database BAM lama tetap utuh dan tidak boleh dipakai oleh peluncur perusahaan', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bam-legacy-company-')); const dbPath = join(dir, 'bam.sqlite');
  let app = createApp({ dbPath });
  try {
    const original = app.catalog.snapshot(); app.db.exec('DROP TABLE company_settings'); app.db.close();
    app = createApp({ dbPath, installMode: 'company' }); const result = app.catalog.snapshot();
    assert.equal(result.company.mode, 'demo'); assert.deepEqual(result.edits, original.edits); assert.deepEqual(result.masters, original.masters); assert.equal(result.revision, original.revision);
    assert.throws(() => companyEnvironment({ BAM_DB_PATH: dbPath }), /Tidak ada data yang dihapus/);
    app.catalog.save({ ...result, edits: [] }); app.db.close(); app = createApp({ dbPath, installMode: 'company' });
    assert.equal(app.catalog.snapshot().edits.length, 0, 'katalog yang sengaja dikosongkan tidak diisi lagi');
  } finally { app.db.close(); rmSync(dir, { recursive: true, force: true }); }
});
