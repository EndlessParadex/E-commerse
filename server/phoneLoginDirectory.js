import { CatalogError } from './catalog.js';
import { normalizeWhatsApp } from '../src/state/whatsappModel.js';

/**
 * Index phone aliases without changing legacy contacts or OTP verification evidence.
 * Historical duplicates deliberately remain ambiguous and cannot be used for login.
 */
export class PhoneLoginDirectory {
  constructor(db) {
    this.db = db;
    db.exec(`CREATE TABLE IF NOT EXISTS phone_login_numbers (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      phone TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS phone_login_phone ON phone_login_numbers(phone);`);
    // Rebuild on startup to include legacy numbers saved before this feature.
    db.exec('DELETE FROM phone_login_numbers');
    const insert = db.prepare('INSERT INTO phone_login_numbers(user_id,phone) VALUES(?,?)');
    for (const row of db.prepare('SELECT user_id,phone FROM user_contact_phones').all()) {
      const phone = normalizeWhatsApp(row.phone);
      if (phone) insert.run(row.user_id, phone);
    }
  }
  find(phone) {
    const rows = this.db.prepare(
      'SELECT user_id FROM phone_login_numbers WHERE phone=? LIMIT 2',
    ).all(phone);
    return rows.length === 1 ? rows[0].user_id : null;
  }
  claim(userId, phone) {
    if (!phone) {
      this.db.prepare('DELETE FROM phone_login_numbers WHERE user_id=?').run(userId);
      return;
    }
    if (normalizeWhatsApp(phone) !== phone)
      throw new CatalogError('Nomor HP Indonesia tidak valid.', 422, 'validation_error');
    const conflict = this.db.prepare(
      'SELECT 1 FROM phone_login_numbers WHERE phone=? AND user_id<>? LIMIT 1',
    ).get(phone, userId);
    if (conflict)
      throw new CatalogError(
        'Nomor HP tidak dapat digunakan. Periksa nomor atau hubungi Admin BAM.',
        409, 'phone_unavailable',
      );
    this.db.prepare(
      'INSERT INTO phone_login_numbers(user_id,phone) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET phone=excluded.phone',
    ).run(userId, phone);
  }
}
