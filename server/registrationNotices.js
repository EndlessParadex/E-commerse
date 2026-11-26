// Email the shop's admins when someone registers, so a new buyer is not left waiting
// until somebody happens to open the admin page. One email can list several
// registrations; a failed send is retried by the email worker.

const MIN_GAP_MS = 5 * 60 * 1000;
const RETRY_MS = 10 * 60 * 1000;

const timeLabel = (value) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return (
    date.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    }) + ' WIB'
  );
};

export class RegistrationNotices {
  constructor(db, { identity, company, now = Date.now, logger = console } = {}) {
    Object.assign(this, { db, identity, company, now, logger, lastSent: 0, retryAt: 0 });
    const exists = db
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='registration_notices'")
      .get();
    db.exec(`CREATE TABLE IF NOT EXISTS registration_notices(
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      notified_at INTEGER NOT NULL)`);
    // First start after this feature ships: registrations already waiting are visible in the
    // admin, so do not mail an old backlog; only registrations from now on send an email.
    if (!exists)
      db.prepare(
        `INSERT OR IGNORE INTO registration_notices(user_id,notified_at)
         SELECT user_id,? FROM account_approvals WHERE status='pending'`,
      ).run(this.now());
  }

  waiting(limit = 20) {
    return this.db
      .prepare(
        `SELECT u.id,u.name,COALESCE(u.email,'') AS email,u.created_at AS createdAt,p.phone
         FROM account_approvals a JOIN users u ON u.id=a.user_id
         LEFT JOIN user_contact_phones p ON p.user_id=u.id
         LEFT JOIN registration_notices n ON n.user_id=u.id
         WHERE a.status='pending' AND u.role='user' AND n.user_id IS NULL
         ORDER BY u.created_at,u.id LIMIT ?`,
      )
      .all(limit);
  }

  recipients() {
    return this.db
      .prepare(
        `SELECT DISTINCT lower(u.email) AS email FROM users u
         LEFT JOIN account_access a ON a.user_id=u.id
         WHERE u.role='admin' AND a.disabled_at IS NULL AND COALESCE(u.email,'')<>''`,
      )
      .all()
      .map((row) => row.email)
      .filter((email) => /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email));
  }

  message(rows) {
    const shortName = this.company?.snapshot().profile.shortName || 'BAM';
    const link = this.identity.publicUrl
      ? new URL('#/admin/persetujuan', this.identity.publicUrl).href
      : '';
    const lines = rows.map((row, index) =>
      [
        `${index + 1}. ${row.name}`,
        `   Daftar: ${timeLabel(row.createdAt)}`,
        `   Kontak: ${[row.email, row.phone].filter(Boolean).join(' · ') || '-'}`,
      ].join('\n'),
    );
    const count = rows.length;
    return {
      subject: `${shortName} · ${count} pendaftar baru menunggu persetujuan`,
      text: [
        count === 1
          ? 'Ada pendaftar baru yang menunggu persetujuan akun:'
          : `Ada ${count} pendaftar baru yang menunggu persetujuan akun:`,
        '',
        ...lines,
        '',
        link ? 'Tinjau sekarang: ' + link : 'Tinjau di Admin › Persetujuan akun.',
        '',
        'Email ini dikirim otomatis ke semua admin aktif.',
      ].join('\n'),
    };
  }

  async flush() {
    const mailer = this.identity?.mailer;
    const time = this.now();
    if (!mailer?.enabled || time < this.retryAt || time - this.lastSent < MIN_GAP_MS) return 0;
    const rows = this.waiting();
    if (!rows.length) return 0;
    const to = this.recipients();
    if (!to.length) return 0;
    try {
      await mailer.send({ to, ...this.message(rows) });
    } catch (error) {
      this.retryAt = time + RETRY_MS;
      this.logger.error?.({ operation: 'registration_notice', message: error?.message });
      return 0;
    }
    this.lastSent = time;
    const mark = this.db.prepare(
      'INSERT OR IGNORE INTO registration_notices(user_id,notified_at) VALUES(?,?)',
    );
    for (const row of rows) mark.run(row.id, time);
    return rows.length;
  }
}
