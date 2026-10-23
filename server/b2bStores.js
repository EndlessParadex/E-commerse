import { randomUUID } from 'node:crypto';
import { CatalogError } from './catalog.js';
import { isStoreOwner } from './emailSettings.js';
import { accountIsActive, accountIsApproved } from './accountAccess.js';

const fail = (message, status = 422, code = 'validation_error') => {
  throw new CatalogError(message, status, code);
};
const required = (value, name, min, max) => {
  if (typeof value !== 'string') fail(name + ' tidak valid.');
  const result = value.trim();
  if (result.length < min || result.length > max)
    fail(name + ' harus berisi ' + min + '–' + max + ' karakter.');
  return result;
};
const phoneNumber = (value) => {
  const trimmed = typeof value === 'string' ? value.replace(/[\s().-]/g, '') : '';
  const normalized = trimmed.startsWith('0')
    ? '+62' + trimmed.slice(1)
    : trimmed.startsWith('62')
      ? '+' + trimmed
      : trimmed;
  if (!/^\+62[1-9]\d{7,12}$/.test(normalized))
    fail('Nomor HP toko tidak valid. Gunakan nomor Indonesia, misalnya 08xxxxxxxxxx.');
  return normalized;
};
const validUser = (db, id) => {
  const user =
    typeof id === 'string' && id.length <= 100
      ? db.prepare('SELECT id,role FROM users WHERE id=?').get(id)
      : null;
  if (!user || !accountIsActive(db, user.id) || !accountIsApproved(db, user.id))
    fail('Akun tujuan tidak ditemukan atau belum aktif.', 404, 'user_not_found');
  return user;
};
const pageFilter = (params) => {
  const query = (params.get('q') || '').trim().toLowerCase();
  const page = Number(params.get('page') || 1);
  if (query.length > 200 || !Number.isSafeInteger(page) || page < 1 || page > 100000)
    fail('Pencarian atau halaman tidak valid.');
  return { query, page, pageSize: 25 };
};


const validSchedule = (value) => {
  const day = value?.weekday;
  const weeks = value?.intervalWeeks;
  const anchor = value?.anchorDate;
  if (!Number.isInteger(day) || day < 0 || day > 6 || ![1, 2].includes(weeks) ||
      typeof anchor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(anchor))
    fail('Isi hari (Minggu=0 s.d. Sabtu=6), frekuensi 1/2 minggu, dan tanggal acuan.');
  const parsed = new Date(anchor + 'T00:00:00Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== anchor ||
      parsed.getUTCDay() !== day)
    fail('Tanggal acuan harus tanggal valid dan sesuai hari pengiriman.');
  return { weekday: day, intervalWeeks: weeks, anchorDate: anchor };
};

export class B2BStoreRepository {
  constructor(db, now = () => Date.now()) {
    Object.assign(this, { db, now });
    db.exec(`CREATE TABLE IF NOT EXISTS b2b_store_sequences (
      id INTEGER PRIMARY KEY AUTOINCREMENT
    );
    CREATE TABLE IF NOT EXISTS b2b_stores (
      id TEXT PRIMARY KEY,
      store_code TEXT NOT NULL UNIQUE,
      store_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
    );
    CREATE TABLE IF NOT EXISTS b2b_delivery_schedules (
      store_id TEXT PRIMARY KEY REFERENCES b2b_stores(id) ON DELETE CASCADE,
      weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
      interval_weeks INTEGER NOT NULL CHECK(interval_weeks IN (1,2)),
      anchor_date TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS b2b_store_members (
      store_id TEXT NOT NULL REFERENCES b2b_stores(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL,
      PRIMARY KEY(store_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS b2b_store_owners (
      store_id TEXT PRIMARY KEY REFERENCES b2b_stores(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      assigned_by TEXT NOT NULL REFERENCES users(id),
      assigned_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS b2b_store_owner_user ON b2b_store_owners(user_id,store_id);
    CREATE TABLE IF NOT EXISTS b2b_sales_agents (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      appointed_by TEXT NOT NULL REFERENCES users(id),
      appointed_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS b2b_sales_assignments (
      store_id TEXT NOT NULL REFERENCES b2b_stores(id) ON DELETE CASCADE,
      sales_user_id TEXT NOT NULL REFERENCES b2b_sales_agents(user_id) ON DELETE CASCADE,
      assigned_by TEXT NOT NULL REFERENCES users(id),
      assigned_at INTEGER NOT NULL,
      PRIMARY KEY(store_id,sales_user_id)
    );
    CREATE TABLE IF NOT EXISTS b2b_store_audit (
      id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id),
      store_id TEXT REFERENCES b2b_stores(id),
      target_user_id TEXT REFERENCES users(id),
      action TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS b2b_member_user ON b2b_store_members(user_id,store_id);
    CREATE INDEX IF NOT EXISTS b2b_sales_user ON b2b_sales_assignments(sales_user_id,store_id);`);
    this.transaction(() => {
      if (
        !db
          .prepare('PRAGMA table_info(b2b_stores)')
          .all()
          .some((column) => column.name === 'revision')
      )
        db.exec(
          'ALTER TABLE b2b_stores ADD COLUMN revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0)',
        );
    });
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  requireOwner(actor) {
    if (actor?.role !== 'admin' || !isStoreOwner(this.db, actor))
      fail('Hanya Pemilik BAM yang dapat mengelola toko dan penugasan Sales.', 403, 'forbidden');
  }
  requireStaff(actor) {
    if (actor?.role !== 'admin') fail('Akses Admin diperlukan.', 403, 'forbidden');
  }
  isSales(userId) {
    return Boolean(this.db.prepare('SELECT 1 FROM b2b_sales_agents WHERE user_id=?').get(userId));
  }
  role(actor) {
    return isStoreOwner(this.db, actor)
      ? 'owner'
      : actor.role === 'admin'
        ? 'admin'
        : this.isSales(actor.id)
          ? 'sales'
          : 'buyer';
  }
  record(actor, action, storeId = null, targetUserId = null) {
    this.db
      .prepare('INSERT INTO b2b_store_audit VALUES(?,?,?,?,?,?)')
      .run(randomUUID(), actor.id, storeId, targetUserId, action, this.now());
  }
  checkRevision(storeId, revision, required = false) {
    const store = this.store(storeId);
    if (
      (required || revision !== undefined) &&
      (!Number.isSafeInteger(revision) || revision !== store.revision)
    )
      fail(
        'Data toko atau penugasan sudah berubah. Muat ulang, periksa, lalu ulangi perubahan.',
        409,
        'revision_conflict',
      );
    return store;
  }
  bump(storeId) {
    this.db.prepare('UPDATE b2b_stores SET revision=revision+1 WHERE id=?').run(storeId);
  }
  storeOwner(storeId) {
    return this.db.prepare(`SELECT u.id,u.name,u.email,
      CASE WHEN access.disabled_at IS NULL AND COALESCE(approval.status,'approved')='approved'
      THEN 1 ELSE 0 END AS active
      FROM b2b_store_owners link JOIN users u ON u.id=link.user_id
      LEFT JOIN account_access access ON access.user_id=u.id
      LEFT JOIN account_approvals approval ON approval.user_id=u.id
      WHERE link.store_id=?`).get(storeId) || null;
  }
  validateBuyer(userId) {
    const user = validUser(this.db, userId);
    if (user.role !== 'user' || this.isSales(userId))
      fail('Pilih akun pembeli aktif yang bukan Sales atau Admin.', 422, 'invalid_buyer_account');
    return user;
  }
  linkStoreOwner(actor, storeId, userId) {
    this.db.prepare('INSERT OR IGNORE INTO b2b_store_members VALUES(?,?,?,?)')
      .run(storeId, userId, actor.id, this.now());
    this.db.prepare(`INSERT INTO b2b_store_owners(store_id,user_id,assigned_by,assigned_at)
      VALUES(?,?,?,?) ON CONFLICT(store_id) DO UPDATE SET
      user_id=excluded.user_id,assigned_by=excluded.assigned_by,assigned_at=excluded.assigned_at`)
      .run(storeId, userId, actor.id, this.now());
  }
  setOwner(actor, storeId, body) {
    this.requireOwner(actor);
    const userId = required(body?.userId, 'Akun pemilik toko', 1, 100);
    const user = this.validateBuyer(userId);
    if (body?.keepPreviousMember !== undefined && typeof body.keepPreviousMember !== 'boolean')
      fail('Pilihan akses pemilik sebelumnya tidak valid.');
    return this.transaction(() => {
      const store = this.checkRevision(storeId, body?.revision, true);
      const previous = this.storeOwner(store.id);
      if (previous?.id === user.id) return this.store(store.id);
      this.linkStoreOwner(actor, store.id, user.id);
      if (previous && !body.keepPreviousMember) {
        this.db.prepare('DELETE FROM b2b_store_members WHERE store_id=? AND user_id=?')
          .run(store.id, previous.id);
        this.record(actor, 'previous_owner_unlinked', store.id, previous.id);
      }
      this.bump(store.id);
      this.record(actor, previous ? 'store_owner_transferred' : 'store_owner_assigned', store.id, user.id);
      return this.store(store.id);
    });
  }
  schedule(storeId) {
    const row = this.db.prepare(
      'SELECT weekday,interval_weeks AS intervalWeeks,anchor_date AS anchorDate FROM b2b_delivery_schedules WHERE store_id=?',
    ).get(storeId);
    return row ? { ...row } : null;
  }
  deliveryDate(storeId, fromDate) {
    const schedule = this.schedule(storeId);
    if (!schedule) return null;
    const anchor = Date.parse(schedule.anchorDate + 'T00:00:00Z');
    const start = Date.parse(fromDate + 'T00:00:00Z');
    if (!Number.isFinite(start)) fail('Tanggal awal tidak valid.');
    const cycle = schedule.intervalWeeks * 7;
    const elapsed = Math.ceil((start - anchor) / 86400000);
    const steps = Math.max(0, Math.ceil(elapsed / cycle));
    return new Date(anchor + steps * cycle * 86400000).toISOString().slice(0, 10);
  }
  setSchedule(actor, storeId, body) {
    this.requireOwner(actor);
    const schedule = validSchedule(body);
    return this.transaction(() => {
      this.checkRevision(storeId, body.revision, true);
      if (this.schedule(storeId))
        fail('Jadwal toko sudah ditetapkan dan tidak dapat diubah.', 409, 'schedule_locked');
      this.db.prepare(
        'INSERT INTO b2b_delivery_schedules(store_id,weekday,interval_weeks,anchor_date,created_by,created_at) VALUES(?,?,?,?,?,?)',
      ).run(storeId, schedule.weekday, schedule.intervalWeeks, schedule.anchorDate, actor.id, this.now());
      this.bump(storeId);
      this.record(actor, 'schedule_assigned', storeId);
      return this.store(storeId);
    });
  }
  store(id) {
    const row = this.db
      .prepare(
        'SELECT id,store_code AS storeCode,store_name AS storeName,phone,address,active,revision,created_at AS createdAt FROM b2b_stores WHERE id=?',
      )
      .get(id);
    if (!row || !row.active) fail('Toko tidak ditemukan.', 404, 'store_not_found');
    return { ...row, deliverySchedule: this.schedule(row.id), owner: this.storeOwner(row.id) };
  }
  list(actor) {
    if (actor.role === 'admin')
      return this.db
        .prepare(
          'SELECT id,store_code AS storeCode,store_name AS storeName,phone,address,active,created_at AS createdAt FROM b2b_stores WHERE active=1 ORDER BY store_name,store_code LIMIT 500',
        )
        .all().map((row) => ({ ...row, deliverySchedule: this.schedule(row.id), owner: this.storeOwner(row.id) }));
    return this.db
      .prepare(
        `SELECT s.id,s.store_code AS storeCode,s.store_name AS storeName,
      s.phone,s.address,s.active,s.created_at AS createdAt
      FROM b2b_stores s WHERE s.active=1 AND
      (EXISTS(SELECT 1 FROM b2b_store_members m WHERE m.store_id=s.id AND m.user_id=?)
      OR EXISTS(SELECT 1 FROM b2b_sales_assignments a WHERE a.store_id=s.id AND a.sales_user_id=?))
      ORDER BY s.store_name,s.store_code LIMIT 500`,
      )
      .all(actor.id, actor.id)
      .map((row) => ({ ...row, deliverySchedule: this.schedule(row.id), owner: this.storeOwner(row.id) }));
  }
  page(actor, params) {
    const { query, page: requestedPage, pageSize } = pageFilter(params);
    const where = ['s.active=1'];
    const args = [];
    if (actor.role !== 'admin') {
      where.push(`(EXISTS(SELECT 1 FROM b2b_store_members m WHERE m.store_id=s.id AND m.user_id=?)
        OR EXISTS(SELECT 1 FROM b2b_sales_assignments a WHERE a.store_id=s.id AND a.sales_user_id=?))`);
      args.push(actor.id, actor.id);
    }
    if (query) {
      where.push("instr(lower(s.store_name||' '||s.store_code||' '||s.phone),?)>0");
      args.push(query);
    }
    const from = 'FROM b2b_stores s WHERE ' + where.join(' AND ');
    const total = this.db.prepare('SELECT COUNT(*) AS n ' + from).get(...args).n;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, pages);
    const stores = this.db
      .prepare(
        `SELECT s.id,s.store_code AS storeCode,s.store_name AS storeName,
      s.phone,s.address,s.active,s.created_at AS createdAt ${from}
      ORDER BY s.store_name,s.store_code LIMIT ? OFFSET ?`,
      )
      .all(...args, pageSize, (page - 1) * pageSize);
    return {
      stores: stores.map((row) => ({ ...row, deliverySchedule: this.schedule(row.id), owner: this.storeOwner(row.id) })),
      total,
      page,
      pageSize,
      pages,
      role: this.role(actor),
    };
  }
  details(actor, storeId) {
    this.requireStaff(actor);
    const store = this.store(storeId);
    const accountFields = `u.id,u.name,u.email,
      CASE WHEN access.disabled_at IS NULL AND COALESCE(approval.status,'approved')='approved'
      THEN 1 ELSE 0 END AS active`;
    const joins = `JOIN users u ON u.id=link.user_id
      LEFT JOIN account_access access ON access.user_id=u.id
      LEFT JOIN account_approvals approval ON approval.user_id=u.id`;
    const members = this.db
      .prepare(
        `SELECT ${accountFields} FROM b2b_store_members link ${joins}
      WHERE link.store_id=? ORDER BY u.name,u.id`,
      )
      .all(store.id);
    const sales = this.db
      .prepare(
        `SELECT ${accountFields} FROM
      (SELECT store_id,sales_user_id AS user_id FROM b2b_sales_assignments) link ${joins}
      WHERE link.store_id=? ORDER BY u.name,u.id`,
      )
      .all(store.id);
    return { store, members: members.map((member) =>
      ({ ...member, isStoreOwner: store.owner?.id === member.id })), sales };
  }
  candidates(actor, params) {
    this.requireOwner(actor);
    const { query, page: requestedPage, pageSize } = pageFilter(params);
    const from = `FROM users u
      LEFT JOIN account_access access ON access.user_id=u.id
      LEFT JOIN account_approvals approval ON approval.user_id=u.id
      WHERE u.role='user' AND access.disabled_at IS NULL
      AND COALESCE(approval.status,'approved')='approved'
      AND NOT EXISTS(SELECT 1 FROM b2b_sales_agents a WHERE a.user_id=u.id)
      AND instr(lower(u.name||' '||u.email),?)>0`;
    const total = this.db.prepare('SELECT COUNT(*) AS n ' + from).get(query).n;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, pages);
    const users = this.db
      .prepare(
        `SELECT u.id,u.name,u.email,
      (SELECT COUNT(*) FROM b2b_store_members m WHERE m.user_id=u.id) AS memberStores,
      (SELECT COUNT(*) FROM b2b_store_owners o WHERE o.user_id=u.id) AS ownedStores,
      CASE WHEN EXISTS(SELECT 1 FROM auth_account_state v WHERE v.user_id=u.id AND v.verified_at IS NOT NULL)
      THEN 1 ELSE 0 END AS emailVerified
      ${from} ORDER BY u.name,u.id LIMIT ? OFFSET ?`,
      )
      .all(query, pageSize, (page - 1) * pageSize);
    return { users, total, page, pageSize, pages };
  }
  create(actor, body) {
    this.requireOwner(actor);
    const name = required(body?.storeName, 'Nama toko', 2, 100);
    const phone = phoneNumber(body?.phone);
    const address = required(body?.address, 'Alamat toko', 10, 500);
    // Older API callers can still create a store without an owner; the Admin UI
    // requires one. Never infer an owner from pre-existing membership.
    const ownerUserId = body?.ownerUserId;
    if (ownerUserId !== undefined && ownerUserId !== null && ownerUserId !== '')
      this.validateBuyer(ownerUserId);
    return this.transaction(() => {
      const codeNumber = Number(
        this.db.prepare('INSERT INTO b2b_store_sequences DEFAULT VALUES').run().lastInsertRowid,
      );
      const id = randomUUID();
      const storeCode = 'TKB-' + String(codeNumber).padStart(6, '0');
      this.db
        .prepare(
          'INSERT INTO b2b_stores(id,store_code,store_name,phone,address,created_by,created_at) VALUES(?,?,?,?,?,?,?)',
        )
        .run(id, storeCode, name, phone, address, actor.id, this.now());
      if (body?.deliverySchedule) {
        const schedule = validSchedule(body.deliverySchedule);
        this.db.prepare(
          'INSERT INTO b2b_delivery_schedules(store_id,weekday,interval_weeks,anchor_date,created_by,created_at) VALUES(?,?,?,?,?,?)',
        ).run(id, schedule.weekday, schedule.intervalWeeks, schedule.anchorDate, actor.id, this.now());
        this.record(actor, 'schedule_assigned', id);
      }
      this.record(actor, 'store_created', id);
      if (ownerUserId) {
        this.linkStoreOwner(actor, id, ownerUserId);
        this.record(actor, 'store_owner_assigned', id, ownerUserId);
      }
      return this.store(id);
    });
  }
  appointSales(actor, userId) {
    this.requireOwner(actor);
    const user = validUser(this.db, userId);
    if (user.role !== 'user')
      fail('Akun Sales harus merupakan akun staf non-Admin.', 422, 'invalid_sales_account');
    if (this.db.prepare('SELECT 1 FROM b2b_store_members WHERE user_id=? LIMIT 1').get(user.id))
      fail('Akun masih terhubung sebagai pembeli. Lepas hubungan toko sebelum mengangkatnya menjadi Sales.',
        409, 'buyer_still_linked');
    return this.transaction(() => {
      this.db
        .prepare('INSERT OR IGNORE INTO b2b_sales_agents VALUES(?,?,?)')
        .run(user.id, actor.id, this.now());
      this.record(actor, 'sales_appointed', null, user.id);
      return { userId: user.id, sales: true };
    });
  }
  update(actor, storeId, body) {
    this.requireOwner(actor);
    const name = required(body?.storeName, 'Nama toko', 2, 100);
    const phone = phoneNumber(body?.phone);
    const address = required(body?.address, 'Alamat toko', 10, 500);
    return this.transaction(() => {
      this.checkRevision(storeId, body.revision, true);
      this.db
        .prepare(
          'UPDATE b2b_stores SET store_name=?,phone=?,address=?,revision=revision+1 WHERE id=?',
        )
        .run(name, phone, address, storeId);
      this.record(actor, 'store_updated', storeId);
      return this.store(storeId);
    });
  }
  assignSales(actor, storeId, userId, { revision, replaceUserId } = {}) {
    this.requireOwner(actor);
    if (!this.isSales(userId)) fail('Akun belum terdaftar sebagai Sales.', 422, 'sales_required');
    validUser(this.db, userId);
    return this.transaction(() => {
      const store = this.checkRevision(storeId, revision, replaceUserId !== undefined);
      if (replaceUserId !== undefined) {
        if (replaceUserId === userId || typeof replaceUserId !== 'string')
          fail('Pilih Sales pengganti yang berbeda.');
        const removed = this.db
          .prepare('DELETE FROM b2b_sales_assignments WHERE store_id=? AND sales_user_id=?')
          .run(store.id, replaceUserId);
        if (!removed.changes)
          fail('Penugasan Sales sudah berubah. Muat ulang data.', 409, 'revision_conflict');
        this.record(actor, 'sales_unassigned', store.id, replaceUserId);
      }
      const inserted = this.db
        .prepare('INSERT OR IGNORE INTO b2b_sales_assignments VALUES(?,?,?,?)')
        .run(store.id, userId, actor.id, this.now());
      if (inserted.changes) this.record(actor, 'sales_assigned', store.id, userId);
      if (inserted.changes || replaceUserId !== undefined) this.bump(store.id);
      return { storeId: store.id, salesUserId: userId, assigned: true };
    });
  }
  removeLink(actor, storeId, kind, body) {
    this.requireOwner(actor);
    if (!['sales', 'members'].includes(kind)) fail('Jenis hubungan akun tidak valid.');
    const userId = required(body?.userId, 'Akun tujuan', 1, 100);
    return this.transaction(() => {
      this.checkRevision(storeId, body.revision, true);
      if (kind === 'members' && this.storeOwner(storeId)?.id === userId)
        fail('Pindahkan pemilik toko terlebih dahulu sebelum melepas akunnya.',
          409, 'store_owner_required');
      const removed = this.db
        .prepare(
          kind === 'sales'
            ? 'DELETE FROM b2b_sales_assignments WHERE store_id=? AND sales_user_id=?'
            : 'DELETE FROM b2b_store_members WHERE store_id=? AND user_id=?',
        )
        .run(storeId, userId);
      if (!removed.changes)
        fail('Hubungan akun sudah berubah. Muat ulang data.', 409, 'revision_conflict');
      this.bump(storeId);
      this.record(actor, kind === 'sales' ? 'sales_unassigned' : 'buyer_unlinked', storeId, userId);
      return { storeId, userId, removed: true };
    });
  }
  addMember(actor, storeId, userId, { revision } = {}) {
    this.requireOwner(actor);
    const user = this.validateBuyer(userId);
    return this.transaction(() => {
      const store = this.checkRevision(storeId, revision);
      const inserted = this.db
        .prepare('INSERT OR IGNORE INTO b2b_store_members VALUES(?,?,?,?)')
        .run(store.id, user.id, actor.id, this.now());
      if (inserted.changes) {
        this.bump(store.id);
        this.record(actor, 'buyer_linked', store.id, user.id);
      }
      return { storeId: store.id, userId: user.id, linked: true };
    });
  }
  salesList(actor) {
    this.requireStaff(actor);
    return this.db
      .prepare(
        `SELECT u.id,u.name,u.email,COUNT(a.store_id) AS assignedStores
      FROM b2b_sales_agents s JOIN users u ON u.id=s.user_id
      LEFT JOIN account_access access ON access.user_id=u.id
      LEFT JOIN account_approvals approval ON approval.user_id=u.id
      LEFT JOIN b2b_sales_assignments a ON a.sales_user_id=u.id
      WHERE access.disabled_at IS NULL AND COALESCE(approval.status,'approved')='approved'
      GROUP BY u.id ORDER BY u.name,u.id`,
      )
      .all();
  }
}
