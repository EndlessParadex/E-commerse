import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtempSync, unlinkSync, rmdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createApp, hashPassword } from './app.js';

const password = 'test-password-2026';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9i0AAAAASUVORK5CYII=';
async function request(app, method, url, body, cookie = '', extra = {}) {
  const req = Readable.from(body === undefined ? [] : [typeof body === 'string' ? body : JSON.stringify(body)]);
  req.method = method; req.url = url; req.headers = { host: 'bam.test', origin: 'http://bam.test', 'content-type': 'application/json', cookie, ...extra };
  let result;
  const res = { writeHead(status, headers) { result = { status, headers }; }, end(value) { result.body = JSON.parse(value); } };
  await app.handler(req, res); return result;
}
const cookieOf = (response) => response.headers['set-cookie'].split(';')[0];
async function adminCookie(app) {
  app.db.prepare('INSERT INTO users(id,name,email,address,password_hash,created_at,role) VALUES(?,?,?,?,?,?,?)').run('admin-test', 'Admin Test', 'admin@test.id', 'Alamat lengkap admin', await hashPassword(password), new Date().toISOString(), 'admin');
  const login = await request(app, 'POST', '/api/auth/login', { email: 'admin@test.id', password });
  assert.equal(login.status, 200); return cookieOf(login);
}

test('registrasi, peran admin, cookie dan logout ditegakkan oleh server', async () => {
  const app = createApp({ dbPath: ':memory:' });
  try {
    const registration = await request(app, 'POST', '/api/auth/register', { name: 'User Test', address: 'Alamat pengguna contoh', email: 'user@test.id', password, role: 'admin' });
    assert.equal(registration.status, 201); assert.equal(registration.body.user.role, 'user'); assert.equal(registration.body.user.password_hash, undefined);
    assert.match(registration.headers['set-cookie'], /HttpOnly; SameSite=Lax/);
    const userCookie = cookieOf(registration);
    assert.equal((await request(app, 'GET', '/api/auth/me', undefined, userCookie)).body.user.role, 'user');
    assert.equal((await request(app, 'GET', '/api/admin/users', undefined, userCookie)).status, 403);
    assert.equal((await request(app, 'PUT', '/api/admin/catalog', {}, userCookie)).status, 403);
    assert.equal((await request(app, 'PUT', '/api/admin/catalog', {})).status, 401);
    assert.equal((await request(app, 'PUT', '/api/admin/users/admin-test', {}, userCookie)).status, 403);
    assert.equal((await request(app, 'POST', '/api/auth/register', { name: 'User Test', address: 'Alamat pengguna contoh', email: 'USER@test.id', password })).status, 409);
    const cookie = await adminCookie(app);
    assert.equal((await request(app, 'GET', '/api/auth/me', undefined, cookie)).body.user.role, 'admin');
    const users = await request(app, 'GET', '/api/admin/users', undefined, cookie);
    assert.equal(users.status, 200); assert.ok(users.body.users.every((user) => !Object.hasOwn(user, 'password_hash')));
    const profile = await request(app, 'PUT', '/api/profile', { name: 'User Baru', address: 'Alamat pengguna baru', role: 'admin' }, userCookie);
    assert.equal(profile.body.user.role, 'user');
    assert.equal((await request(app, 'POST', '/api/auth/logout', {}, cookie)).status, 200);
    assert.equal((await request(app, 'PUT', '/api/admin/catalog', {}, cookie)).status, 401);
    app.db.prepare('UPDATE sessions SET expires_at=0').run();
    assert.equal((await request(app, 'GET', '/api/auth/me', undefined, userCookie)).status, 401);
  } finally { app.db.close(); }
});

test('katalog relasional: simpan valid, tolak SKU/harga/relasi salah dan konflik tanpa perubahan parsial', async () => {
  const app = createApp({ dbPath: ':memory:' });
  try {
    const cookie = await adminCookie(app); const initial = (await request(app, 'GET', '/api/catalog')).body;
    assert.equal(initial.edits.length, 8); assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM catalog_variants').get().n, 25);
    const candidate = structuredClone(initial); candidate.edits[0].baseName = 'Produk dari database'; candidate.edits[0].image = png;
    candidate.masters.suppliers.push({ id: 'pt-test', name: 'PT Test', initials: 'TT', color: 'sky', logo: '' });
    candidate.masters.brands.push({ id: 'brand-test', name: 'Brand Test', supplierIds: ['pt-test'] });
    candidate.masters.categories.push({ id: 'category-test', name: 'Kategori Test', icon: '💻', children: [{ id: 'sub-test', name: 'Subkategori Test' }] });
    candidate.edits.push({ ...structuredClone(candidate.edits[0]), groupId: 'product-test', baseName: 'Produk Baru', supplierId: 'pt-test', brandId: 'brand-test', categoryId: 'category-test', subcategoryId: 'sub-test', variants: [{ id: 'SKU-TEST-1', sizeValue: '1', sizeUnit: 'pcs', price: '100000', oldPrice: '' }] });
    const saved = await request(app, 'PUT', '/api/admin/catalog', candidate, cookie);
    assert.equal(saved.status, 200); assert.equal(saved.body.revision, 1); assert.equal(saved.body.edits.length, 9);
    const publicCatalog = (await request(app, 'GET', '/api/catalog')).body;
    assert.equal(publicCatalog.edits[0].baseName, 'Produk dari database'); assert.equal(publicCatalog.edits[0].image, png);
    assert.equal((await request(app, 'PUT', '/api/admin/catalog', candidate, cookie)).status, 409);
    const invalids = [
      (value) => { value.edits[1].variants[0].id = value.edits[0].variants[0].id.toUpperCase(); },
      (value) => { value.edits[0].variants[0].price = '-1'; },
      (value) => { value.edits[0].supplierId = 'pt-test'; },
      (value) => { value.edits[0].subcategoryId = 'not-real'; },
      (value) => { value.edits[0].image = 'data:image/png;base64,SGVsbG8gd29ybGQsIHNwb29mZWQ='; },
      (value) => { value.edits[0].variants.shift(); },
      (value) => { value.masters.brands = value.masters.brands.filter((brand) => brand.id !== value.edits[0].brandId); },
      (value) => { value.edits[0].color = 'unknown-color'; },
      (value) => { value.masters.suppliers[0].color = 'unknown-color'; },
    ];
    for (const mutate of invalids) {
      const invalid = structuredClone(publicCatalog); mutate(invalid);
      const rejected = await request(app, 'PUT', '/api/admin/catalog', invalid, cookie);
      assert.equal(rejected.status, 422, JSON.stringify(rejected.body));
      assert.deepEqual(app.catalog.snapshot(), publicCatalog);
    }
    // A database failure midway through writing must restore all catalog tables.
    app.db.exec("CREATE TRIGGER fail_catalog BEFORE INSERT ON catalog_products BEGIN SELECT RAISE(ABORT,'test write failure'); END;");
    assert.equal((await request(app, 'PUT', '/api/admin/catalog', publicCatalog, cookie)).status, 500);
    assert.deepEqual(app.catalog.snapshot(), publicCatalog);
  } finally { app.db.close(); }
});

test('katalog dan foto tetap ada setelah database dibuka kembali', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bam-catalog-test-')); const path = join(directory, 'test.sqlite'); let app;
  try {
    app = createApp({ dbPath: path }); const cookie = await adminCookie(app); const next = app.catalog.snapshot();
    next.edits[0].image = png; next.edits[0].variants[0].price = '19000'; next.edits[0].color = 'sky'; next.masters.suppliers[0].color = 'rose';
    assert.equal((await request(app, 'PUT', '/api/admin/catalog', next, cookie)).status, 200);
    app.db.close(); app = createApp({ dbPath: path });
    const publicCatalog = await request(app, 'GET', '/api/catalog');
    assert.equal(publicCatalog.body.revision, 1); assert.equal(publicCatalog.body.edits[0].image, png); assert.equal(publicCatalog.body.edits[0].variants[0].price, '19000');
    assert.equal(publicCatalog.body.edits[0].color, 'sky'); assert.equal(publicCatalog.body.masters.suppliers[0].color, 'rose');
    assert.equal((await request(app, 'GET', '/api/auth/me', undefined, cookie)).body.user.role, 'admin');
  } finally {
    app?.db.close();
    for (const suffix of ['', '-wal', '-shm']) if (existsSync(path + suffix)) unlinkSync(path + suffix);
    rmdirSync(directory);
  }
});

test('hapus seluruh produk/SKU, tolak master yang dipakai, master kosong dapat dihapus dan katalog kosong valid', async () => {
  const app = createApp({ dbPath: ':memory:' });
  try {
    const cookie = await adminCookie(app); const initial = app.catalog.snapshot();
    for (const type of ['suppliers', 'brands', 'categories']) {
      const invalid = structuredClone(initial); invalid.masters[type].shift();
      assert.equal((await request(app, 'PUT', '/api/admin/catalog', invalid, cookie)).status, 422);
      assert.deepEqual(app.catalog.snapshot(), initial);
    }
    const group = initial.edits[0]; const next = structuredClone(initial); next.edits = next.edits.filter((entry) => entry.groupId !== group.groupId);
    assert.equal((await request(app, 'PUT', '/api/admin/catalog', next)).status, 401);
    const deleted = await request(app, 'PUT', '/api/admin/catalog', next, cookie);
    assert.equal(deleted.status, 200);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM catalog_variants WHERE product_id=?').get(group.groupId).n, 0);
    assert.ok(!deleted.body.edits.some((entry) => entry.groupId === group.groupId));
    assert.equal((await request(app, 'PUT', '/api/admin/catalog', next, cookie)).status, 409);
    const unusedBrand = structuredClone(deleted.body); unusedBrand.masters.brands = unusedBrand.masters.brands.filter((entry) => entry.id !== group.brandId);
    assert.equal((await request(app, 'PUT', '/api/admin/catalog', unusedBrand, cookie)).status, 200);
    const empty = app.catalog.snapshot(); empty.edits = []; empty.masters = { suppliers: [], brands: [], categories: [] };
    assert.equal((await request(app, 'PUT', '/api/admin/catalog', empty, cookie)).status, 200);
    assert.deepEqual((await request(app, 'GET', '/api/catalog')).body.edits, []);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM catalog_suppliers').get().n, 0);
  } finally { app.db.close(); }
});

test('asal permintaan, JSON, batas ukuran dan percobaan login diperiksa', async () => {
  const app = createApp({ dbPath: ':memory:', secureCookies: true });
  try {
    const fields = { name: 'User Test', email: 'test@test.id', address: 'Alamat lengkap test', password };
    assert.equal((await request(app, 'POST', '/api/auth/register', fields, '', { origin: 'https://evil.test' })).status, 403);
    assert.equal((await request(app, 'POST', '/api/auth/register', '{')).status, 400);
    assert.equal((await request(app, 'POST', '/api/auth/register', fields, '', { 'content-type': 'text/plain' })).status, 415);
    assert.equal((await request(app, 'POST', '/api/auth/register', 'x'.repeat(100001))).status, 413);
    const registration = await request(app, 'POST', '/api/auth/register', fields);
    assert.match(registration.headers['set-cookie'], /; Secure$/);
    for (let index = 0; index < 10; index += 1) assert.equal((await request(app, 'POST', '/api/auth/login', { email: fields.email, password: 'incorrect' })).status, 401);
    assert.equal((await request(app, 'POST', '/api/auth/login', { email: fields.email, password })).status, 429);
  } finally { app.db.close(); }
});

test('pembuatan admin melalui perintah lokal menghasilkan akun yang bisa masuk', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bam-admin-test-')); const path = join(directory, 'test.sqlite'); let app;
  try {
    const result = spawnSync(process.execPath, ['server/create-admin.js', 'admin-cli@test.id', 'Admin CLI', 'Alamat lengkap admin CLI'], { encoding: 'utf8', env: { ...process.env, BAM_DB_PATH: path, BAM_ADMIN_PASSWORD: password } });
    assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /Admin siap/);
    app = createApp({ dbPath: path });
    const login = await request(app, 'POST', '/api/auth/login', { email: 'admin-cli@test.id', password });
    assert.equal(login.status, 200); assert.equal(login.body.user.role, 'admin');
  } finally {
    app?.db.close(); for (const suffix of ['', '-wal', '-shm']) if (existsSync(path + suffix)) unlinkSync(path + suffix); rmdirSync(directory);
  }
});
