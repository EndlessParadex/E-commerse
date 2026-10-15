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
