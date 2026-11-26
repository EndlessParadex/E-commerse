import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.js';

const seedUser = (app, id, role, createdAt, status) => {
  app.db
    .prepare(
      'INSERT INTO users(id,name,email,address,password_hash,created_at,role) VALUES(?,?,?,?,?,?,?)',
    )
    .run(id, 'Nama ' + id, id + '@fixture.test', 'Alamat lengkap', 'x', createdAt, role);
  if (status)
    app.db.prepare('INSERT INTO account_approvals(user_id,status) VALUES(?,?)').run(id, status);
};

test('admin mendapat email saat ada pendaftar baru, sekali per pendaftar', async () => {
  let clock = Date.parse('2026-11-26T10:00:00Z');
  const app = createApp({
    dbPath: ':memory:',
    mailer: { enabled: false },
    mailConfig: {},
    logger: () => {},
    now: () => clock,
  });
  try {
    seedUser(app, 'pemilik', 'admin', '2026-01-01T00:00:00Z');
    seedUser(app, 'operator', 'admin', '2026-01-01T00:00:00Z');
    seedUser(app, 'pembeli-lama', 'user', '2026-01-01T00:00:00Z', 'approved');
    seedUser(app, 'toko-baru', 'user', '2026-11-26T09:58:00Z', 'pending');
    const sent = [];
    const notices = app.registrationNotices;
    notices.identity = {
      mailer: { enabled: true, send: async (message) => sent.push(message) },
      publicUrl: 'https://bam.example/',
    };

    assert.equal(await notices.flush(), 1);
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].to.sort(), ['operator@fixture.test', 'pemilik@fixture.test']);
    assert.match(sent[0].subject, /1 pendaftar baru menunggu persetujuan/);
    assert.match(sent[0].text, /Nama toko-baru/);
    assert.match(sent[0].text, /26 Nov 2026/);
    assert.match(sent[0].text, /https:\/\/bam\.example\/#\/admin\/persetujuan/);
    assert.doesNotMatch(sent[0].text, /pembeli-lama/, 'akun yang sudah disetujui tidak dikirim');

    assert.equal(await notices.flush(), 0, 'pendaftar yang sama tidak dikirim dua kali');

    seedUser(app, 'toko-kedua', 'user', '2026-11-26T10:01:00Z', 'pending');
    seedUser(app, 'toko-ketiga', 'user', '2026-11-26T10:02:00Z', 'pending');
    assert.equal(await notices.flush(), 0, 'paling cepat satu email tiap 5 menit');
    clock += 5 * 60 * 1000;
    assert.equal(await notices.flush(), 2, 'pendaftar yang menumpuk dikirim dalam satu email');
    assert.match(sent[1].subject, /2 pendaftar baru/);

    seedUser(app, 'toko-gagal', 'user', '2026-11-26T10:06:00Z', 'pending');
    clock += 5 * 60 * 1000;
    notices.identity.mailer.send = async () => {
      throw new Error('smtp down');
    };
    assert.equal(await notices.flush(), 0);
    notices.identity.mailer.send = async (message) => sent.push(message);
    clock += 10 * 60 * 1000;
    assert.equal(await notices.flush(), 1, 'gagal kirim dicoba lagi nanti');

    notices.identity.mailer.enabled = false;
    seedUser(app, 'tanpa-email', 'user', '2026-11-26T10:30:00Z', 'pending');
    clock += 10 * 60 * 1000;
    assert.equal(await notices.flush(), 0, 'tanpa layanan email tidak ada yang dikirim');
  } finally {
    app.db.close();
  }
});

test('pendaftar yang sudah menunggu sebelum fitur ini aktif tidak dikirim ulang', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'bam-notice-'));
  const dbPath = join(dir, 'bam.sqlite');
  const options = { dbPath, mailer: { enabled: false }, mailConfig: {}, logger: () => {} };
  try {
    const before = createApp(options);
    seedUser(before, 'pemilik', 'admin', '2026-01-01T00:00:00Z');
    seedUser(before, 'menunggu-lama', 'user', '2026-11-20T08:00:00Z', 'pending');
    // Simulate a database from before this feature: the table does not exist yet.
    before.db.exec('DROP TABLE registration_notices');
    before.db.close();

    const after = createApp(options);
    try {
      const sent = [];
      after.registrationNotices.identity = {
        mailer: { enabled: true, send: async (message) => sent.push(message) },
        publicUrl: 'https://bam.example/',
      };
      assert.equal(await after.registrationNotices.flush(), 0);
      assert.equal(sent.length, 0);
    } finally {
      after.db.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
