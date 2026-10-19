import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';

export function seedSharedCart(app) {
  const actors = {};
  for (const [id, role] of [
    ['owner', 'admin'],
    ['operator', 'admin'],
    ['buyer', 'user'],
    ['buyer2', 'user'],
    ['sales', 'user'],
    ['other', 'user'],
  ]) {
    app.db
      .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
      .run(
        id,
        'Akun ' + id,
        id + '@fixture.test',
        'Alamat lengkap pengujian B2B',
        'unused',
        '2026-10-19',
        role,
      );
    app.db
      .prepare(
        'INSERT INTO auth_account_state(user_id,verified_at,credential_revision) VALUES(?,?,0)',
      )
      .run(id, Date.now());
    app.db
      .prepare('INSERT INTO sessions VALUES(?,?,?)')
      .run(createHash('sha256').update(id.padEnd(43, 'x')).digest('hex'), id, Date.now() + 3600000);
    actors[id] = { id, role };
  }
  app.db
    .prepare('INSERT INTO store_owners(user_id,granted_at) VALUES(?,?)')
    .run('owner', '2026-10-19');
  const first = app.b2bStores.create(actors.owner, {
    storeName: 'Toko Bersama',
    phone: '081234567890',
    address: 'Jalan Pengujian Bersama Nomor 1',
  });
  const second = app.b2bStores.create(actors.owner, {
    storeName: 'Toko Lain',
    phone: '081234567891',
    address: 'Jalan Pengujian Lain Nomor 2',
  });
  app.b2bStores.addMember(actors.owner, first.id, 'buyer');
  app.b2bStores.addMember(actors.owner, first.id, 'buyer2');
  app.b2bStores.addMember(actors.owner, second.id, 'other');
  app.b2bStores.appointSales(actors.owner, 'sales');
  app.b2bStores.assignSales(actors.owner, first.id, 'sales');
  return { actors, first, second };
}
export async function sharedRequest(
  app,
  method,
  path,
  actor,
  body,
  origin = 'http://fixture.test',
) {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  Object.assign(req, {
    method,
    url: path,
    socket: { remoteAddress: '192.0.2.1' },
    headers: {
      host: 'fixture.test',
      origin,
      'content-type': 'application/json',
      ...(actor ? { cookie: 'bam_session=' + actor.padEnd(43, 'x') } : {}),
    },
  });
  let result;
  await app.handler(req, {
    writeHead(status, headers) {
      result = { status, headers };
    },
    end(value) {
      result.body = JSON.parse(value);
    },
  });
  return result;
}
