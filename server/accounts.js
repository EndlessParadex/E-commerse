import { randomUUID } from 'node:crypto';
import { CatalogError } from './catalog.js';
import { isStoreOwner } from './emailSettings.js';
import { customerAccess, customerAccessSchema } from './customerAccess.js';
import { customerRoles } from '../src/data/customerRoles.js';
import { accountIsActive, accountIsApproved } from './accountAccess.js';

const fail = (message, status = 422, code = 'validation_error') => {
  throw new CatalogError(message, status, code);
};
const fields = `u.id,u.name,u.email,u.address,u.role,u.created_at AS createdAt,
  COALESCE(v.role,'') AS customerRole,
  COALESCE(a.revision,0) AS revision,a.disabled_at AS disabledAt,
  COALESCE(a.reason,'') AS reason,COALESCE(approval.status,'approved') AS approvalStatus,
  CASE WHEN o.user_id IS NOT NULL THEN 1 ELSE 0 END AS owner,
  CASE WHEN s.verified_at IS NOT NULL THEN 1 ELSE 0 END AS verified,
  (SELECT COUNT(*) FROM orders t WHERE t.user_id=u.id) AS orderCount,
  (SELECT COUNT(*) FROM store_email_settings e WHERE e.updated_by=u.id) AS settingsReferences`;
const joins = `FROM users u LEFT JOIN account_access a ON a.user_id=u.id
  LEFT JOIN store_customer_viewers v ON v.user_id=u.id
  LEFT JOIN store_owners o ON o.user_id=u.id LEFT JOIN auth_account_state s ON s.user_id=u.id
  LEFT JOIN account_approvals approval ON approval.user_id=u.id`;
export class AccountRepository {
  constructor(db, now) {
    Object.assign(this, { db, now });
    db.exec(customerAccessSchema);
    db.exec(`CREATE TABLE IF NOT EXISTS account_management_audit(
      id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,target_id TEXT NOT NULL,
      action TEXT NOT NULL,reason TEXT NOT NULL,created_at INTEGER NOT NULL
    );`);
  }
  requireOwner(actor) {
    if (!isStoreOwner(this.db, actor))
      fail('Kelola akun hanya tersedia untuk pemilik toko.', 403, 'forbidden');
  }
  present(row, actor) {
    if (!row) return null;
    const protectedReason =
      row.id === actor.id
        ? 'Akun yang sedang digunakan.'
        : row.owner
          ? 'Akun pemilik toko dilindungi.'
          : '';
    const deleteBlockedReason =
      protectedReason ||
      (row.orderCount
        ? 'Akun memiliki riwayat pesanan. Gunakan Nonaktifkan agar riwayat tetap tersedia.'
        : row.settingsReferences
          ? 'Akun tercatat dalam pengaturan toko. Gunakan Nonaktifkan.'
          : '');
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      address: row.address,
      role: row.owner ? 'owner' : row.role,
      customerRole: row.customerRole,
      createdAt: row.createdAt,
      revision: row.revision,
      active: row.disabledAt == null && row.approvalStatus === 'approved',
      approvalStatus: row.approvalStatus,
      disabledAt: row.disabledAt,
      reason: row.reason,
      emailVerified: Boolean(row.verified),
      orderCount: row.orderCount,
      protectedReason,
      deleteBlockedReason,
      canDisable: !protectedReason && row.disabledAt == null && row.approvalStatus === 'approved',
      canReactivate: !protectedReason && row.disabledAt != null,
      canDelete: !deleteBlockedReason,
      canSetCustomerAccess: !protectedReason,
    };
  }
  get(id, actor) {
    return this.present(this.db.prepare(`SELECT ${fields} ${joins} WHERE u.id=?`).get(id), actor);
  }
  list(actor, params) {
    this.requireOwner(actor);
    const query = (params.get('q') || '').trim().toLocaleLowerCase('id'),
      status = params.get('status') || 'all',
      role = params.get('role') || 'all',
      page = Number(params.get('page') || 1);
    if (
      query.length > 200 ||
      !['all', 'active', 'disabled', 'pending', 'rejected'].includes(status) ||
      !['all', 'user', 'admin', 'owner', 'chair', 'deputy', 'trusted'].includes(role) ||
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 100000
    )
      fail('Filter akun tidak valid.');
    const where = [],
      args = [];
    if (query) {
      where.push("instr(lower(u.name||' '||u.email),?)>0");
      args.push(query);
    }
    if (status !== 'all') {
      if (status === 'active') where.push("a.disabled_at IS NULL AND COALESCE(approval.status,'approved')='approved'");
      else if (status === 'disabled') where.push('a.disabled_at IS NOT NULL');
      else { where.push('approval.status=?'); args.push(status); }
    }
    if (role === 'owner') where.push('o.user_id IS NOT NULL');
    else if (['chair', 'deputy', 'trusted'].includes(role)) {
      where.push('v.role=? AND o.user_id IS NULL');
      args.push(role);
    } else if (role !== 'all') {
      where.push('u.role=? AND o.user_id IS NULL AND v.user_id IS NULL');
      args.push(role);
    }
    const filter = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const total = this.db.prepare(`SELECT COUNT(*) AS n ${joins}${filter}`).get(...args).n;
    const pageSize = 25;
    const users = this.db
      .prepare(
        `SELECT ${fields} ${joins}${filter} ORDER BY u.created_at DESC,u.id LIMIT ? OFFSET ?`,
      )
      .all(...args, pageSize, (page - 1) * pageSize)
      .map((row) => this.present(row, actor));
    return { users, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
  }
  requireApprover(actor) {
    if (actor?.role !== 'admin' || !accountIsActive(this.db, actor.id) || !accountIsApproved(this.db, actor.id))
      fail('Hanya Admin atau Pemilik yang dapat memeriksa pendaftaran.', 403, 'forbidden');
  }
  listApprovals(actor, params) {
    this.requireApprover(actor);
    const status = params.get('status') || 'pending';
    const query = (params.get('q') || '').trim().toLocaleLowerCase('id');
    const page = Number(params.get('page') || 1);
    if (!['pending', 'rejected', 'all'].includes(status) || query.length > 200 ||
      !Number.isSafeInteger(page) || page < 1 || page > 100000)
      fail('Filter persetujuan tidak valid.');
    const where = ["u.role='user'", "a.status IN ('pending','rejected')"];
    const args = [];
    if (status !== 'all') { where.push('a.status=?'); args.push(status); }
    if (query) { where.push("instr(lower(u.name||' '||u.email),?)>0"); args.push(query); }
    const clause = ' WHERE ' + where.join(' AND ');
    const from = 'FROM account_approvals a JOIN users u ON u.id=a.user_id LEFT JOIN auth_account_state s ON s.user_id=u.id';
    const total = this.db.prepare('SELECT COUNT(*) AS n ' + from + clause).get(...args).n;
    const pageSize = 25;
    const users = this.db.prepare(
      'SELECT u.id,u.name,u.email,u.created_at AS createdAt,a.status AS approvalStatus,a.revision,s.verified_at AS verifiedAt ' +
      from + clause + ' ORDER BY u.created_at DESC,u.id LIMIT ? OFFSET ?',
    ).all(...args, pageSize, (page - 1) * pageSize).map(row => ({
      id: row.id, name: row.name, email: row.email, createdAt: row.createdAt,
      approvalStatus: row.approvalStatus, revision: row.revision,
      emailVerified: row.verifiedAt != null,
    }));
    return { users, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
  }
  reviewApproval(actor, id, body) {
    this.requireApprover(actor);
    if (!['approve', 'reject'].includes(body?.action) || !Number.isSafeInteger(body.revision))
      fail('Tindakan persetujuan atau revisi akun tidak valid.');
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (reason.length < 5 || reason.length > 300)
      fail('Isi alasan sepanjang 5–300 karakter.');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.requireApprover(actor);
      const target = this.db.prepare(
        'SELECT u.role,a.status,a.revision FROM account_approvals a JOIN users u ON u.id=a.user_id WHERE a.user_id=?',
      ).get(id);
      if (!target || target.role !== 'user')
        fail('Pendaftaran tidak ditemukan.', 404, 'not_found');
      if (target.revision !== body.revision)
        fail('Status pendaftaran berubah. Muat ulang daftar.', 409, 'approval_conflict');
      if (!['pending', 'rejected'].includes(target.status) ||
          (body.action === 'reject' && target.status !== 'pending'))
        fail('Pendaftaran tidak lagi menunggu tindakan ini.', 409, 'approval_conflict');
      const next = body.action === 'approve' ? 'approved' : 'rejected';
      this.db.prepare(
        'UPDATE account_approvals SET status=?,revision=revision+1,decided_by=?,decided_at=? WHERE user_id=?',
      ).run(next, actor.id, this.now(), id);
      if (body.action === 'reject')
        this.revoke(id, this.db.prepare('SELECT email FROM users WHERE id=?').get(id).email);
      this.db.prepare('INSERT INTO account_management_audit VALUES(?,?,?,?,?,?)').run(
        randomUUID(), actor.id, id, 'registration:' + body.action, reason, this.now(),
      );
      this.db.exec('COMMIT');
      return { ok: true, message: next === 'approved'
        ? 'Akun disetujui. Pelanggan kini dapat masuk; email tetap harus dikonfirmasi sebelum memesan.'
        : 'Pendaftaran ditolak. Akun tidak dapat masuk.', status: next };
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  change(actor, id, body) {
    this.requireOwner(actor);
    const action = body?.action,
      reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    if (
      !['disable', 'reactivate', 'delete', 'customer-access'].includes(action) ||
      !Number.isSafeInteger(body?.revision) ||
      reason.length < 5 ||
      reason.length > 300
    )
      fail('Pilih tindakan dan isi alasan sepanjang 5–300 karakter.');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.requireOwner(actor);
      const target = this.get(id, actor);
      if (!target) fail('Akun tidak ditemukan. Muat ulang daftar akun.', 404, 'account_not_found');
      if (target.protectedReason) fail(target.protectedReason, 403, 'protected_account');
      if (target.revision !== body.revision)
        fail(
          'Status akun telah berubah. Muat ulang daftar sebelum melanjutkan.',
          409,
          'account_conflict',
        );
      if (action === 'customer-access') {
        const role = body.customerRole;
        if (typeof role !== 'string' || !Object.hasOwn(customerRoles, role))
          fail('Pilih Ketua, Wakil, Staf terpercaya, atau tanpa akses daftar pembeli.');
        if (role && (!target.active || !target.emailVerified))
          fail('Akun harus aktif dan emailnya dikonfirmasi sebelum diberi akses daftar pembeli.');
        if (role === target.customerRole)
          fail('Izin akun belum berubah. Pilih izin baru atau tutup dialog.');
        if (role) {
          this.db
            .prepare(
              `INSERT INTO store_customer_viewers(user_id,role,granted_by,updated_at)
            VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role,
            granted_by=excluded.granted_by,updated_at=excluded.updated_at`,
            )
            .run(id, role, actor.id, this.now());
        } else this.db.prepare('DELETE FROM store_customer_viewers WHERE user_id=?').run(id);
        this.db
          .prepare(
            `INSERT INTO account_access(user_id,revision) VALUES(?,?)
          ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision`,
          )
          .run(id, target.revision + 1);
      } else if (action === 'delete') {
        if (target.deleteBlockedReason)
          fail(target.deleteBlockedReason, 409, 'account_has_history');
        if (
          typeof body.confirmEmail !== 'string' ||
          body.confirmEmail.trim().toLowerCase() !== target.email.toLowerCase()
        )
          fail('Ketik alamat email akun yang akan dihapus untuk mengonfirmasi.');
        this.revoke(id, target.email);
        this.db.prepare('DELETE FROM auth_account_state WHERE user_id=?').run(id);
        this.db.prepare('DELETE FROM store_email_test_limits WHERE user_id=?').run(id);
        this.db
          .prepare(
            "UPDATE order_mail SET status='skipped',skip_reason='recipient_deleted',leased_until=0 WHERE recipient_id=? AND status NOT IN ('sent','skipped')",
          )
          .run(id);
        this.db.prepare('DELETE FROM users WHERE id=?').run(id);
      } else {
        if ((action === 'disable' && !target.active) || (action === 'reactivate' && target.active))
          fail(
            'Status akun telah berubah. Muat ulang daftar sebelum melanjutkan.',
            409,
            'account_conflict',
          );
        this.db
          .prepare(
            `INSERT INTO account_access(user_id,revision,disabled_at,disabled_by,reason) VALUES(?,?,?,?,?)
          ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,disabled_at=excluded.disabled_at,disabled_by=excluded.disabled_by,reason=excluded.reason`,
          )
          .run(id, target.revision + 1, action === 'disable' ? this.now() : null, actor.id, reason);
        this.revoke(id, target.email);
        this.db
          .prepare(
            'INSERT INTO auth_account_state(user_id,credential_revision) VALUES(?,1) ON CONFLICT(user_id) DO UPDATE SET credential_revision=credential_revision+1',
          )
          .run(id);
      }
      this.db
        .prepare('INSERT INTO account_management_audit VALUES(?,?,?,?,?,?)')
        .run(
          randomUUID(),
          actor.id,
          id,
          action === 'customer-access'
            ? 'customer-access:' + (body.customerRole || 'none')
            : action,
          reason,
          this.now(),
        );
      this.db.exec('COMMIT');
      return {
        ok: true,
        message:
          action === 'customer-access'
            ? body.customerRole
              ? 'Akses melihat daftar pembeli diberikan. Rekan dapat memuat ulang halaman atau masuk kembali untuk melihat menunya.'
              : 'Akses daftar pembeli dicabut. Akun tetap dapat digunakan untuk berbelanja.'
            : action === 'delete'
              ? 'Akun berhasil dihapus.'
              : action === 'disable'
                ? 'Akun dinonaktifkan dan sesi lamanya diakhiri.'
                : 'Akun diaktifkan kembali. Pemilik akun dapat masuk dengan kata sandinya.',
        user: action === 'delete' ? null : this.get(id, actor),
      };
    } catch (error) {
      this.db.exec('ROLLBACK');
      if (String(error.code).startsWith('ERR_SQLITE') && /foreign key/i.test(error.message))
        fail(
          'Akun masih terhubung dengan data toko. Gunakan Nonaktifkan.',
          409,
          'account_has_history',
        );
      throw error;
    }
  }
  customers(actor, params) {
    if (!customerAccess(this.db, actor).canViewCustomers)
      fail('Izin melihat daftar pembeli diperlukan. Hubungi pemilik toko.', 403, 'forbidden');
    const query = (params.get('q') || '').trim().toLowerCase();
    const status = params.get('status') || 'all';
    const verification = params.get('verification') || 'all';
    const page = Number(params.get('page') || 1);
    if (
      query.length > 200 ||
      !['all', 'active', 'disabled'].includes(status) ||
      !['all', 'verified', 'unverified'].includes(verification) ||
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 100000
    )
      fail('Filter pembeli tidak valid.');
    const where = ["u.role='user'", 'o.user_id IS NULL', 'v.user_id IS NULL'];
    const args = [];
    if (query) {
      where.push("instr(lower(u.name||' '||u.email),?)>0");
      args.push(query);
    }
    if (status !== 'all')
      where.push(status === 'active' ? 'a.disabled_at IS NULL' : 'a.disabled_at IS NOT NULL');
    if (verification !== 'all')
      where.push(
        verification === 'verified' ? 's.verified_at IS NOT NULL' : 's.verified_at IS NULL',
      );
    const filter = ' WHERE ' + where.join(' AND ');
    const total = this.db.prepare(`SELECT COUNT(*) AS n ${joins}${filter}`).get(...args).n;
    const pageSize = 25;
    const users = this.db
      .prepare(
        `SELECT u.id,u.name,u.email,u.created_at AS createdAt,
      a.disabled_at AS disabledAt,s.verified_at AS verifiedAt ${joins}${filter}
      ORDER BY u.created_at DESC,u.id LIMIT ? OFFSET ?`,
      )
      .all(...args, pageSize, (page - 1) * pageSize)
      .map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        createdAt: row.createdAt,
        active: row.disabledAt == null && accountIsApproved(this.db, row.id),
        emailVerified: row.verifiedAt != null,
      }));
    return { users, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
  }
  revoke(id, email) {
    this.db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
    this.db.prepare('DELETE FROM auth_tokens WHERE user_id=? OR email=?').run(id, email);
  }
}
