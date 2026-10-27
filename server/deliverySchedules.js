import { randomUUID } from 'node:crypto';
import { CatalogError } from './catalog.js';
import { isStoreOwner } from './emailSettings.js';
import { accountIsActive, accountIsApproved } from './accountAccess.js';
import {
  todayWIB,
  validDeliverySchedule,
  upcomingDeliveries,
} from '../src/data/deliverySchedule.js';
const fail = (message, status = 422, code = 'validation_error') => {
  throw new CatalogError(message, status, code);
};
export class DeliveryScheduleRepository {
  constructor(db, stores, now = () => Date.now()) {
    Object.assign(this, { db, stores, now });
    db.exec(`CREATE TABLE IF NOT EXISTS delivery_regions (
      id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE COLLATE NOCASE,weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
      interval_weeks INTEGER NOT NULL CHECK(interval_weeks IN (1,2)),anchor_date TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),revision INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS delivery_region_memberships (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,region_id TEXT REFERENCES delivery_regions(id),
        revision INTEGER NOT NULL,assigned_by TEXT NOT NULL,updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS delivery_schedule_events (
        id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,action TEXT NOT NULL,data TEXT NOT NULL,created_at INTEGER NOT NULL);`);
  }
  owner(actor) {
    if (!isStoreOwner(this.db, actor))
      fail('Pengaturan wilayah memerlukan Pemilik BAM.', 403, 'forbidden');
  }
  transaction(work) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const value = work();
      this.db.exec('COMMIT');
      return value;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  event(actor, action, data) {
    this.db
      .prepare('INSERT INTO delivery_schedule_events VALUES(?,?,?,?,?)')
      .run(randomUUID(), actor.id, action, JSON.stringify(data), this.now());
  }
  regions(actor) {
    this.owner(actor);
    return {
      regions: this.db
        .prepare(
          `SELECT r.id,r.name,r.weekday,r.interval_weeks AS intervalWeeks,r.anchor_date AS anchorDate,r.active,r.revision,
      (SELECT COUNT(*) FROM delivery_region_memberships m WHERE m.region_id=r.id) AS assignedCount
      FROM delivery_regions r ORDER BY r.name LIMIT 200`,
        )
        .all(),
    };
  }
  saveRegion(actor, body) {
    this.owner(actor);
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const schedule = validDeliverySchedule(body);
    if (
      name.length < 2 ||
      name.length > 100 ||
      !schedule ||
      typeof body.active !== 'boolean' ||
      !Number.isSafeInteger(body.revision) ||
      body.revision < 0 ||
      (body.id != null && typeof body.id !== 'string')
    )
      fail('Isi nama wilayah, hari, interval 1/2 minggu dan tanggal acuan yang sesuai.');
    return this.transaction(() => {
      this.owner(actor);
      const previous = body.id
        ? this.db.prepare('SELECT * FROM delivery_regions WHERE id=?').get(body.id)
        : null;
      if (body.id && !previous) fail('Wilayah tidak ditemukan.', 404, 'not_found');
      if (body.revision !== (previous?.revision || 0))
        fail('Wilayah berubah. Muat ulang sebelum menyimpan.', 409, 'revision_conflict');
      if (!previous && this.db.prepare('SELECT COUNT(*) AS n FROM delivery_regions').get().n >= 200)
        fail('Batas 200 wilayah tercapai. Perbarui wilayah yang tersedia.');
      const duplicate = this.db
        .prepare('SELECT id FROM delivery_regions WHERE name=? COLLATE NOCASE')
        .get(name);
      if (duplicate && duplicate.id !== previous?.id) fail('Nama wilayah sudah digunakan.');
      const id = previous?.id || randomUUID();
      this.db
        .prepare(
          `INSERT INTO delivery_regions VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,weekday=excluded.weekday,interval_weeks=excluded.interval_weeks,anchor_date=excluded.anchor_date,active=excluded.active,revision=excluded.revision`,
        )
        .run(
          id,
          name,
          schedule.weekday,
          schedule.intervalWeeks,
          schedule.anchorDate,
          Number(body.active),
          (previous?.revision ?? -1) + 1,
        );
      this.event(actor, previous ? 'region_updated' : 'region_created', {
        id,
        name,
        ...schedule,
        active: body.active,
      });
      return this.regions(actor);
    });
  }
  accounts(actor, params) {
    this.owner(actor);
    const q = (params.get('q') || '').trim().toLowerCase();
    const page = Number(params.get('page') || 1);
    if (q.length > 200 || !Number.isSafeInteger(page) || page < 1 || page > 100000)
      fail('Filter akun wilayah tidak valid.');
    const from = `FROM users u LEFT JOIN account_access a ON a.user_id=u.id
      LEFT JOIN account_approvals approval ON approval.user_id=u.id
      LEFT JOIN delivery_region_memberships m ON m.user_id=u.id LEFT JOIN delivery_regions r ON r.id=m.region_id
      WHERE u.role='user' AND a.disabled_at IS NULL AND COALESCE(approval.status,'approved')='approved' AND instr(lower(u.name||' '||u.email),?)>0`;
    const total = this.db.prepare('SELECT COUNT(*) AS n ' + from).get(q).n;
    const pages = Math.max(1, Math.ceil(total / 25));
    const actual = Math.min(page, pages);
    const accounts = this.db
      .prepare(
        `SELECT u.id,u.name,u.email,m.region_id AS regionId,r.name AS regionName,COALESCE(m.revision,0) AS revision ${from} ORDER BY u.name,u.id LIMIT 25 OFFSET ?`,
      )
      .all(q, (actual - 1) * 25);
    return { accounts, total, page: actual, pages };
  }
  assign(actor, body) {
    this.owner(actor);
    if (
      typeof body?.userId !== 'string' ||
      typeof body.regionId !== 'string' ||
      !Number.isSafeInteger(body.revision) ||
      body.revision < 0
    )
      fail('Penugasan wilayah tidak valid.');
    return this.transaction(() => {
      this.owner(actor);
      const target = this.db.prepare('SELECT id,role FROM users WHERE id=?').get(body.userId);
      if (
        target?.role !== 'user' ||
        !accountIsActive(this.db, target.id) ||
        !accountIsApproved(this.db, target.id)
      )
        fail('Akun pembeli aktif yang disetujui tidak ditemukan.', 404, 'not_found');
      const region = body.regionId
        ? this.db
            .prepare('SELECT * FROM delivery_regions WHERE id=? AND active=1')
            .get(body.regionId)
        : null;
      if (body.regionId && !region) fail('Wilayah aktif tidak ditemukan.');
      const previous = this.db
        .prepare('SELECT * FROM delivery_region_memberships WHERE user_id=?')
        .get(target.id);
      if (body.revision !== (previous?.revision || 0))
        fail('Penugasan wilayah berubah. Muat ulang akun.', 409, 'revision_conflict');
      this.db
        .prepare(
          `INSERT INTO delivery_region_memberships VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET
        region_id=excluded.region_id,revision=excluded.revision,assigned_by=excluded.assigned_by,updated_at=excluded.updated_at`,
        )
        .run(target.id, region?.id || null, (previous?.revision || 0) + 1, actor.id, this.now());
      this.event(actor, 'region_assigned', {
        userId: target.id,
        from: previous?.region_id || null,
        to: region?.id || null,
      });
      return { saved: true };
    });
  }
  personal(user) {
    return (
      this.db
        .prepare(
          `SELECT r.id,r.name,r.weekday,r.interval_weeks AS intervalWeeks,r.anchor_date AS anchorDate,r.active,r.revision
      FROM delivery_region_memberships m JOIN delivery_regions r ON r.id=m.region_id WHERE m.user_id=?`,
        )
        .get(user.id) || null
    );
  }
  snapshot(user) {
    const region = this.personal(user);
    if (!region) return null;
    if (!region.active)
      fail(
        'Wilayah pengiriman akun dinonaktifkan. Hubungi Pemilik BAM.',
        409,
        'delivery_unavailable',
      );
    return {
      regionId: region.id,
      regionName: region.name,
      deliverySchedule: validDeliverySchedule(region),
      plannedDate: upcomingDeliveries(region, todayWIB(this.now()), 1)[0],
    };
  }
  calendar(actor, params) {
    if (!accountIsActive(this.db, actor.id)) fail('Akses akun tidak tersedia.', 403, 'forbidden');
    const today = todayWIB(this.now());
    const page = this.stores.page(actor, params);
    const schedules = page.stores
      .filter((store) => store.deliverySchedule)
      .map((store) => ({
        id: store.id,
        kind: 'store',
        label: store.storeName,
        code: store.storeCode,
        schedule: store.deliverySchedule,
        dates: upcomingDeliveries(store.deliverySchedule, today),
      }));
    const personal = this.personal(actor);
    if (personal?.active)
      schedules.unshift({
        id: personal.id,
        kind: 'region',
        label: personal.name,
        schedule: validDeliverySchedule(personal),
        dates: upcomingDeliveries(personal, today),
      });
    return {
      today,
      schedules,
      personalRegion: personal?.active ? { id: personal.id, name: personal.name } : null,
      page: page.page,
      pages: page.pages,
      totalStores: page.total,
      unscheduledStores: page.stores.filter((store) => !store.deliverySchedule).length,
    };
  }
}
