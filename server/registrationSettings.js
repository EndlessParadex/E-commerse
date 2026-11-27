import { registrationSettingsSchema } from './accountAccess.js';
import { CatalogError } from './catalog.js';

const conflict = () =>
  new CatalogError(
    'Pengaturan baru saja diubah dari perangkat lain. Muat ulang lalu coba lagi.',
    409,
    'revision_conflict',
  );

/** The owner's switch between manual and automatic approval of new registrations. */
export class RegistrationSettings {
  constructor(db, { now = Date.now } = {}) {
    Object.assign(this, { db, now });
    db.exec(registrationSettingsSchema);
    db.prepare('INSERT OR IGNORE INTO registration_settings(id) VALUES(1)').run();
  }
  snapshot() {
    const row = this.db
      .prepare(
        `SELECT r.auto_approve AS autoApprove,r.revision,r.updated_at AS updatedAt,u.name AS updatedByName
         FROM registration_settings r LEFT JOIN users u ON u.id=r.updated_by WHERE r.id=1`,
      )
      .get();
    return {
      autoApprove: row.autoApprove === 1,
      revision: row.revision,
      updatedAt: row.updatedAt ?? null,
      updatedByName: row.updatedByName || '',
    };
  }
  save(owner, body) {
    if (typeof body?.autoApprove !== 'boolean' || !Number.isInteger(body?.revision))
      throw new CatalogError('Pilih Manual atau Otomatis.', 400, 'invalid_settings');
    const result = this.db
      .prepare(
        'UPDATE registration_settings SET auto_approve=?,revision=revision+1,updated_by=?,updated_at=? WHERE id=1 AND revision=?',
      )
      .run(body.autoApprove ? 1 : 0, owner.id, this.now(), body.revision);
    if (result.changes !== 1) throw conflict();
    return this.snapshot();
  }
}
