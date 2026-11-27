export const accountAccessSchema = `CREATE TABLE IF NOT EXISTS account_access (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 0,
  disabled_at INTEGER,disabled_by TEXT,reason TEXT NOT NULL DEFAULT ''
);`;
export function accountIsActive(db, id) {
  return Boolean(
    db
      .prepare(
        `SELECT u.id FROM users u LEFT JOIN account_access a ON a.user_id=u.id
    WHERE u.id=? AND a.disabled_at IS NULL`,
      )
      .get(id),
  );
}

export const approvalSchema = `CREATE TABLE IF NOT EXISTS account_approvals (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),
  revision INTEGER NOT NULL DEFAULT 0,
  decided_by TEXT,decided_at INTEGER
);`;
// Owner switch: new registrations wait for approval (manual) or become active at once.
export const registrationSettingsSchema = `CREATE TABLE IF NOT EXISTS registration_settings (
  id INTEGER PRIMARY KEY CHECK(id=1),
  auto_approve INTEGER NOT NULL DEFAULT 0 CHECK(auto_approve IN (0,1)),
  revision INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT,updated_at INTEGER
);`;
// Marks an approval made by the switch above rather than by a person.
export const AUTO_APPROVER = 'system:auto';
export function registrationAutoApprove(db) {
  return (
    db.prepare('SELECT auto_approve FROM registration_settings WHERE id=1').get()?.auto_approve ===
    1
  );
}
export function accountApprovalStatus(db, id) {
  return (
    db.prepare('SELECT status FROM account_approvals WHERE user_id=?').get(id)?.status || 'approved'
  );
}
export function accountIsApproved(db, id) {
  return accountApprovalStatus(db, id) === 'approved';
}
