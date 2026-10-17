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
    CREATE TABLE IF NOT EXISTS b2b_store_members (
      store_id TEXT NOT NULL REFERENCES b2b_stores(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL,
      PRIMARY KEY(store_id,user_id)
    );
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
  store(id) {
    const row = this.db
      .prepare(
        'SELECT id,store_code AS storeCode,store_name AS storeName,phone,address,active,created_at AS createdAt FROM b2b_stores WHERE id=?',
      )
      .get(id);
    if (!row || !row.active) fail('Toko tidak ditemukan.', 404, 'store_not_found');
    return row;
  }
  list(actor) {
    if (actor.role === 'admin')
      return this.db
        .prepare(
          'SELECT id,store_code AS storeCode,store_name AS storeName,phone,address,active,created_at AS createdAt FROM b2b_stores WHERE active=1 ORDER BY store_name,store_code LIMIT 500',
        )
        .all();
    return this.db
      .prepare(
        `SELECT s.id,s.store_code AS storeCode,s.store_name AS storeName,
      s.phone,s.address,s.active,s.created_at AS createdAt
      FROM b2b_stores s WHERE s.active=1 AND
      (EXISTS(SELECT 1 FROM b2b_store_members m WHERE m.store_id=s.id AND m.user_id=?)
      OR EXISTS(SELECT 1 FROM b2b_sales_assignments a WHERE a.store_id=s.id AND a.sales_user_id=?))
      ORDER BY s.store_name,s.store_code LIMIT 500`,
      )
      .all(actor.id, actor.id);
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
      stores,
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
    return { store, members, sales };
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
      (SELECT COUNT(*) FROM b2b_store_members m WHERE m.user_id=u.id) AS memberStores
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
      this.record(actor, 'store_created', id);
      return this.store(id);
    });
  }
  appointSales(actor, userId) {
    this.requireOwner(actor);
    const user = validUser(this.db, userId);
    if (user.role !== 'user')
      fail('Akun Sales harus merupakan akun staf non-Admin.', 422, 'invalid_sales_account');
    return this.transaction(() => {
      this.db
        .prepare('INSERT OR IGNORE INTO b2b_sales_agents VALUES(?,?,?)')
        .run(user.id, actor.id, this.now());
      this.record(actor, 'sales_appointed', null, user.id);
      return { userId: user.id, sales: true };
    });
  }
  assignSales(actor, storeId, userId) {
    this.requireOwner(actor);
    const store = this.store(storeId);
    if (!this.isSales(userId)) fail('Akun belum terdaftar sebagai Sales.', 422, 'sales_required');
    validUser(this.db, userId);
    return this.transaction(() => {
      this.db
        .prepare('INSERT OR IGNORE INTO b2b_sales_assignments VALUES(?,?,?,?)')
        .run(store.id, userId, actor.id, this.now());
      this.record(actor, 'sales_assigned', store.id, userId);
      return { storeId: store.id, salesUserId: userId, assigned: true };
    });
  }
  addMember(actor, storeId, userId) {
    this.requireOwner(actor);
    const store = this.store(storeId);
    const user = validUser(this.db, userId);
    if (user.role !== 'user' || this.isSales(userId))
      fail(
        'Pemilik toko harus memakai akun pembeli yang bukan Sales.',
        422,
        'invalid_buyer_account',
      );
    return this.transaction(() => {
      this.db
        .prepare('INSERT OR IGNORE INTO b2b_store_members VALUES(?,?,?,?)')
        .run(store.id, user.id, actor.id, this.now());
      this.record(actor, 'buyer_linked', store.id, user.id);
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
