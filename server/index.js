import { loadLocalEnv } from './loadEnv.js';
import { createApp } from './app.js';
import { logUnexpectedError } from './errorLogging.js';

loadLocalEnv();

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';
const { server, db, workflow, identity, messages, refreshMailSettings } = createApp();
const expiryTimer = setInterval(() => {
  try {
    workflow.tick();
  } catch (error) {
    logUnexpectedError((entry) => console.error(entry), error, { operation: 'order_expiry' });
  }
}, 30000);
expiryTimer.unref();
let sending = false,
  stopping = false,
  emailWork = Promise.resolve();
const emailTimer = setInterval(() => {
  if (sending) return;
  sending = true;
  emailWork = (async () => {
    try {
      refreshMailSettings();
      await identity.flushMail();
      await messages.flush();
    } catch (error) {
      logUnexpectedError((entry) => console.error(entry), error, {
        operation: 'account_email_worker',
      });
    } finally {
      sending = false;
    }
  })();
}, 5000);
emailTimer.unref();
server.once('error', (error) => {
  clearInterval(expiryTimer);
  clearInterval(emailTimer);
  if (error.code === 'EADDRINUSE')
    console.error(
      `Port ${port} masih dipakai server lain. Hentikan server lama dengan Ctrl+C, lalu jalankan kembali dari folder proyek yang sudah diperbarui.`,
    );
  else logUnexpectedError((entry) => console.error(entry), error, { operation: 'server_start' });
  db.close();
  process.exitCode = 1;
});
server.listen(port, host, () => console.log(`BAM API listening on http://${host}:${port}`));
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    setTimeout(() => process.exit(1), 30000).unref();
    clearInterval(expiryTimer);
    clearInterval(emailTimer);
    server.close(async () => {
      await emailWork;
      db.close();
      process.exit(0);
    });
  });
