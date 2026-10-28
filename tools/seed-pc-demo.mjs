/**
 * One-time, isolated BAM PC demonstration installer.
 * Never targets data/bam.sqlite, and refuses to modify an existing file.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hashPassword, createApp } from '../server/app.js';
import { loadLocalEnv } from '../server/loadEnv.js';

export const defaultPcDemoPath = join('data', 'bam-pc-demo.sqlite');
const accountSpecs = [
  { key: 'owner', name: 'Owner BAM Demo PC', email: 'owner.pc-demo@bam.test', role: 'admin' },
  {
    key: 'admin',
    name: 'Admin Operasional Demo PC',
    email: 'admin.pc-demo@bam.test',
    role: 'admin',
  },
  { key: 'sales', name: 'Sales Demo PC', email: 'sales.pc-demo@bam.test', role: 'user' },
  {
    key: 'buyer1',
    name: 'Pembeli Toko Ice and Fire Demo',
    email: 'toko.ice.pc-demo@bam.test',
    role: 'user',
  },
  {
    key: 'buyer2',
    name: 'Pembeli Toko Nusantara Demo',
    email: 'toko.nusantara.pc-demo@bam.test',
    role: 'user',
  },
  {
    key: 'personal',
    name: 'Pembeli Pribadi Demo PC',
    email: 'pribadi.pc-demo@bam.test',
    role: 'user',
  },
];

const wibToday = (now) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
const nextWeekday = (date, weekday) => {
  const start = Date.parse(date + 'T00:00:00Z');
  const diff = (weekday - new Date(start).getUTCDay() + 7) % 7;
  return new Date(start + diff * 86400000).toISOString().slice(0, 10);
};

export async function seedPcDemo({
  dbPath = defaultPcDemoPath,
  password = randomBytes(18).toString('base64url'),
  now = new Date(),
} = {}) {
  if (typeof dbPath !== 'string' || !dbPath.trim() || dbPath === ':memory:')
    throw new Error('Lokasi database dummy harus berupa path berkas lokal.');
  const filename = isAbsolute(dbPath) ? dbPath : resolve(dbPath);
  if (filename === resolve('data/bam.sqlite'))
    throw new Error('Database utama BAM tidak boleh dipakai untuk seeding dummy.');
  if (existsSync(filename) || existsSync(filename + '-wal') || existsSync(filename + '-shm'))
    throw new Error(
      'Database dummy sudah ada. Seeding dibatalkan agar tidak menimpa data: ' + filename,
    );
  if (typeof password !== 'string' || password.length < 8 || password.length > 128)
    throw new Error('Kata sandi demo harus memiliki 8–128 karakter.');
  if (!(now instanceof Date) || Number.isNaN(now.getTime()))
    throw new Error('Tanggal setup database demo tidak valid.');

  mkdirSync(dirname(filename), { recursive: true });
  const app = createApp({
    dbPath: filename,
    installMode: 'demo',
    b2bCutoff: null,
    now: () => now.getTime(),
  });
  try {
    const { db, b2bStores, sharedCarts, catalog } = app;
    const passHash = await hashPassword(password);
    const userIds = {};
    const insertUser = db.prepare(
      'INSERT INTO users(id,name,email,address,password_hash,created_at,role) VALUES(?,?,?,?,?,?,?)',
    );
    const verify = db.prepare(
      'INSERT INTO auth_account_state(user_id,verified_at,credential_revision) VALUES(?,?,0)',
    );
    const approve = db.prepare(
      'INSERT INTO account_approvals(user_id,status,revision) VALUES(?, ?, 0)',
    );
    for (const spec of accountSpecs) {
      const id = randomUUID();
      userIds[spec.key] = id;
      insertUser.run(
        id,
        spec.name,
        spec.email,
        'Alamat fiktif pengujian BAM PC',
        passHash,
        now.toISOString(),
        spec.role,
      );
      verify.run(id, now.getTime());
      approve.run(id, 'approved');
    }
    db.prepare('INSERT INTO store_owners(user_id,granted_at) VALUES(?,?)').run(
      userIds.owner,
      now.toISOString(),
    );

    const owner = { id: userIds.owner, role: 'admin' };
    const firstDate = nextWeekday(wibToday(now), 1);
    const secondDate = nextWeekday(wibToday(now), 4);
    const first = b2bStores.create(owner, {
      storeName: 'Toko Ice and Fire (Demo)',
      phone: '081234567890',
      address: 'Jalan Contoh Nomor 11, Kota Demo',
      ownerUserId: userIds.buyer1,
      deliverySchedule: { weekday: 1, intervalWeeks: 1, anchorDate: firstDate },
    });
    const second = b2bStores.create(owner, {
      storeName: 'Toko Nusantara (Demo)',
      phone: '081234567891',
      address: 'Jalan Contoh Nomor 22, Kota Demo',
      ownerUserId: userIds.buyer2,
      deliverySchedule: { weekday: 4, intervalWeeks: 2, anchorDate: secondDate },
    });
    b2bStores.appointSales(owner, userIds.sales);
    b2bStores.assignSales(owner, first.id, userIds.sales);
    b2bStores.assignSales(owner, second.id, userIds.sales);

    const skuIds = catalog.snapshot().edits.flatMap((draft) => draft.variants.map((v) => v.id));
    if (skuIds.length < 2) throw new Error('Katalog demo tidak berisi cukup produk contoh.');
    const sampleCarts = [
      { id: first.id, date: firstDate, buyer: 'buyer1', product: skuIds[0] },
      { id: second.id, date: secondDate, buyer: 'buyer2', product: skuIds[1] },
    ];
    for (const item of sampleCarts) {
      sharedCarts.mutate({ id: userIds[item.buyer], role: 'user' }, item.id, {
        date: item.date,
        revision: 0,
        requestId: randomUUID(),
        action: 'add',
        productId: item.product,
        quantity: 2,
      });
    }
    return {
      path: filename,
      password,
      accounts: accountSpecs.map(({ key, name, email }) => ({ key, name, email })),
      stores: [
        {
          name: first.storeName,
          code: first.storeCode,
          delivery: firstDate,
          frequency: 'Mingguan',
        },
        {
          name: second.storeName,
          code: second.storeCode,
          delivery: secondDate,
          frequency: 'Dua mingguan',
        },
      ],
      products: skuIds.length,
    };
  } finally {
    app.db.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadLocalEnv();
  seedPcDemo()
    .then((created) => {
      console.log('DATABASE DUMMY BAM PC BERHASIL DIBUAT');
      console.log('Lokasi:', created.path);
      console.log('Produk demo:', created.products);
      for (const store of created.stores)
        console.log(
          'Toko:',
          store.name,
          '(' + store.code + ')',
          '|',
          store.frequency,
          '|',
          store.delivery,
        );
      console.log('\nAkun login (email):');
      for (const user of created.accounts) console.log(' ', user.name + ':', user.email);
      console.log('\nKata sandi SEMUA akun demo:', created.password);
      console.log(
        'Gunakan hanya untuk pengujian di localhost. Jangan bagikan kata sandi tersebut.',
      );
      console.log('\nUntuk menjalankan server di PowerShell pada terminal yang sama:');
      console.log('  $env:BAM_DB_PATH = "data/bam-pc-demo.sqlite"');
      console.log('  npm run dev:full');
    })
    .catch((error) => {
      console.error('Setup database demo gagal:', error.message);
      process.exitCode = 1;
    });
}
