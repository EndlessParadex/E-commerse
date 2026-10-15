import assert from 'node:assert/strict';
import { createApp } from './app.js';
export function createTestApp(options = {}) {
  const messages = [];
  const app = createApp({
    mailer: { enabled: true, send: async (message) => messages.push(message) },
    mailConfig: { publicUrl: 'https://fixture.test', queueKey: 'f'.repeat(64) },
    ...options,
  });
  app.testMailbox = messages;
  return app;
}
export async function finishRegistration(app, request, fields) {
  await app.identity.flushMail(100);
  const message = app.testMailbox.findLast((item) => item.to === fields.email.toLowerCase());
  assert.ok(message, 'fixture verification email must be queued');
  const token = message.text.match(/token=([A-Za-z0-9_-]+)/)[1];
  assert.equal(
    (await request(app, 'POST', '/api/auth/verify-email', { token, password: fields.password }))
      .status,
    200,
  );
  const account = app.db.prepare('SELECT id FROM users WHERE email=?').get(fields.email);
  app.db.prepare("UPDATE account_approvals SET status='approved',revision=revision+1 WHERE user_id=?").run(account.id);
  return request(app, 'POST', '/api/auth/login', {
    email: fields.email,
    password: fields.password,
  });
}
