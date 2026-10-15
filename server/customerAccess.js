import { isStoreOwner } from './emailSettings.js';

export const customerAccessSchema = `CREATE TABLE IF NOT EXISTS store_customer_viewers (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('chair','deputy','trusted')),
  granted_by TEXT NOT NULL,updated_at INTEGER NOT NULL
);`;

export function customerAccess(db, user) {
  const row =
    user &&
    db
      .prepare(
        `
    SELECT v.role FROM store_customer_viewers v
    JOIN users u ON u.id=v.user_id
    JOIN auth_account_state s ON s.user_id=u.id
    LEFT JOIN account_access a ON a.user_id=u.id
    WHERE u.id=? AND a.disabled_at IS NULL AND s.verified_at IS NOT NULL
  `,
      )
      .get(user.id);
  return {
    customerRole: row?.role || '',
    canViewCustomers: Boolean(row || isStoreOwner(db, user)),
  };
}
