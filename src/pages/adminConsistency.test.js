import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('admin consistency patch keeps order context optional and database messages accurate', async () => {
  const [orders, admin, theme] = await Promise.all([
    readFile(new URL('./AdminOrdersPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./AdminPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./AdminUnifiedUI.css', import.meta.url), 'utf8'),
  ]);
  assert.match(orders, /<details className="admin-order-help">/);
  assert.match(orders, /<summary>Informasi pembayaran dan pengiriman<\/summary>/);
  assert.match(orders, /className="admin-order-results" role="status"/);
  assert.doesNotMatch(orders, /<p className="workflow-preview">\s*Menampilkan/);
  assert.match(admin, /view === 'approvals'[\s\S]*Administrasi · Database/);
  assert.match(admin, /view === 'company'/);
  assert.match(theme, /\.admin-products-panel \.admin-row-actions/);
  assert.match(theme, /@media \(max-width: 650px\)/);
});
