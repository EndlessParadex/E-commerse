import { createSite } from './site.js';
import { installCommerce } from './commerce.js';
import { OrderMessages } from './orderMessages.js';
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { CatalogRepository, CatalogError } from './catalog.js';
import { CompanyRepository } from './company.js';
import { WorkflowRepository } from './workflow.js';
import {
  AuthRateLimiter,
  DUMMY_PASSWORD_HASH,
  validPasswordHash,
  verifyPassword,
} from './authSecurity.js';
import { reservationPolicyFromEnv } from './securityPolicy.js';
import { logUnexpectedError } from './errorLogging.js';
import { PasswordQueue } from './authSecurity.js';
import { clientIpResolver } from './clientIp.js';
import { EmailSettingsRepository, isStoreOwner } from './emailSettings.js';
import { IdentityRepository } from './identity.js';
import { accountIsActive, accountIsApproved } from './accountAccess.js';
import { AccountRepository } from './accounts.js';
import { customerAccess } from './customerAccess.js';

const scrypt = promisify(scryptCallback);
const digest = (token) => createHash('sha256').update(token).digest('hex');
const json = (res, status, body, headers = {}) => {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...headers,
  });
  res.end(JSON.stringify(body));
};
const sendError = (res, status, code, errors, headers) =>
  json(res, status, { error: code, ...(errors ? { errors } : {}) }, headers);
export function readBody(req, limit = 100000) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on('data', (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > limit) {
        if (!failed)
          reject(new CatalogError('Ukuran permintaan terlalu besar.', 413, 'payload_too_large'));
        failed = true;
      } else if (!failed) chunks.push(Buffer.from(chunk));
    });
    req.on('end', () => {
      if (failed) return;
      try {
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
        if (!body || typeof body !== 'object' || Array.isArray(body))
          return reject(new CatalogError('JSON harus berupa objek.', 400, 'invalid_json'));
        resolveBody(body);
      } catch {
        reject(new CatalogError('JSON tidak valid.', 400, 'invalid_json'));
      }
    });
    req.on('error', reject);
  });
}
function authFields(body, registration) {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const address = typeof body?.address === 'string' ? body.address.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const errors = {};
  if (registration && (name.length < 2 || name.length > 100))
    errors.name = 'Nama harus berisi 2–100 karakter.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    errors.email = 'Email tidak valid.';
  if (!password || password.length > 128 || (registration && password.length < 8))
    errors.password = registration ? 'Kata sandi harus 8–128 karakter.' : 'Kata sandi tidak valid.';
  if (registration && (address.length < 10 || address.length > 500))
    errors.address = 'Alamat harus berisi 10–500 karakter.';
  return { errors, name, email, address, password };
}
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `${salt.toString('hex')}:${Buffer.from(key).toString('hex')}`;
}
const userView = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  address: user.address,
  role: user.role || 'user',
});

export function createApp({
  dbPath = process.env.BAM_DB_PATH || 'data/bam.sqlite',
  appOrigin = process.env.BAM_APP_ORIGIN || '',
  secureCookies = process.env.NODE_ENV === 'production',
  installMode = process.env.BAM_INSTALL_MODE || 'demo',
  now = () => Date.now(),
  reservationPolicy = reservationPolicyFromEnv(),
  authLimits,
  trustedProxies,
  mailer,
  mailConfig,
  mailTransportFactory,
  passwordQueueOptions,
  passwordCheck = verifyPassword,
  logger = (entry) => console.error(entry),
  siteIndexHtml,
} = {}) {
  const filename = dbPath === ':memory:' ? dbPath : resolve(dbPath);
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, address TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);`);
  db.exec(`CREATE TABLE IF NOT EXISTS user_store_names (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    store_name TEXT NOT NULL CHECK(length(store_name) BETWEEN 2 AND 100)
  );`);
  if (
    !db
      .prepare('PRAGMA table_info(users)')
      .all()
      .some((entry) => entry.name === 'role')
  )
    db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
  const company = new CompanyRepository(db, installMode);
  const catalog = new CatalogRepository(db, {
    seedDemo: company.snapshot().mode === 'demo',
    companySnapshot: () => company.snapshot(),
  });
  const limiter = new AuthRateLimiter(db, now, authLimits);
  const passwordQueue = new PasswordQueue(passwordQueueOptions);
  const clientIp = clientIpResolver(trustedProxies);
  const emailSettings = new EmailSettingsRepository(db, {
    filename,
    now,
    mailer,
    mailConfig,
    transportFactory: mailTransportFactory,
    logger,
  });
  const initialMail = emailSettings.runtime();
  const identity = new IdentityRepository(db, {
    now,
    mailer: initialMail.mailer,
    config: initialMail.config,
    queue: passwordQueue,
    limiter,
    passwordCheck,
    hashPassword,
    logger,
  });
  emailSettings.appliedRevision = initialMail.revision;
  const rawCompanySnapshot = company.snapshot.bind(company);
  company.snapshot = () => ({
    ...rawCompanySnapshot(),
    commerce: { version: 31, emailReady: identity.ready, verificationRequired: true },
  });
  const messages = new OrderMessages(db, identity, company, now, logger);
  const publicUser = (user) => ({
    ...userView(user),
    storeName: db.prepare('SELECT store_name FROM user_store_names WHERE user_id=?').get(user.id)?.store_name || '',
    emailVerified: identity.verified(user.id),
    isOwner: isStoreOwner(db, user),
    ...customerAccess(db, user),
  });
  const workflow = new WorkflowRepository(db, catalog, company, now, reservationPolicy, messages);
  installCommerce(workflow, identity, messages);
  const accounts = new AccountRepository(db, now);
  let site = createSite(catalog, company, {
    publicUrl: identity.publicUrl?.href || '',
    indexHtml: siteIndexHtml,
  });
  const refreshMailSettings = () => {
    if (emailSettings.sync(identity))
      site = createSite(catalog, company, {
        publicUrl: identity.publicUrl?.href || '',
        indexHtml: siteIndexHtml,
      });
  };
  catalog.workflowEnabled = true;
  catalog.afterWrite = () => workflow.ensureInventory();
  const token = (req) =>
    req.headers.cookie?.match(/(?:^|;\s*)bam_session=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1];
  const currentUser = (req) => {
    const value = token(req);
    if (!value) return null;
    return (
      db
        .prepare(
          'SELECT u.id,u.name,u.email,u.address,u.role FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN account_access a ON a.user_id=u.id WHERE s.token_hash=? AND s.expires_at>? AND a.disabled_at IS NULL AND COALESCE((SELECT status FROM account_approvals WHERE user_id=u.id),\'approved\')=\'approved\'',
        )
        .get(digest(value), Date.now()) || null
    );
  };
  const sessionHeaders = (userId) => {
    const value = randomBytes(32).toString('base64url');
    db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(
      digest(value),
      userId,
      Date.now() + 2592000000,
    );
    return {
      'set-cookie': `bam_session=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secureCookies ? '; Secure' : ''}`,
    };
  };
  const checkOrigin = (req) => {
    if (req.headers['sec-fetch-site'] === 'cross-site') return false;
    if (!req.headers.origin) return true;
    try {
      const origin = new URL(req.headers.origin);
      return appOrigin ? origin.origin === appOrigin : origin.host === req.headers.host;
    } catch {
      return false;
    }
  };
  const confirmOwnerPassword = async (owner, value, ip) => {
    if (!isStoreOwner(db, owner))
      throw new CatalogError('Akses pemilik diperlukan.', 403, 'forbidden');
    if (typeof value !== 'string' || !value || value.length > 128)
      throw new CatalogError(
        'Masukkan kata sandi akun pemilik untuk melanjutkan.',
        422,
        'validation_error',
      );
    const stored = db.prepare('SELECT password_hash FROM users WHERE id=?').get(owner.id);
    const matches = await passwordQueue.run(ip, async () => {
      const delay = limiter.loginDelay(ip, owner.email);
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      return passwordCheck(value, stored.password_hash);
    });
    if (!matches) {
      const allowed = limiter.take('login', ip, owner.email);
      throw new CatalogError(
        'Kata sandi akun pemilik tidak sesuai. Periksa kembali atau coba beberapa saat lagi.',
        allowed ? 401 : 429,
        allowed ? 'invalid_credentials' : 'rate_limited',
      );
    }
    if (
      !isStoreOwner(db, owner) ||
      db.prepare('SELECT password_hash FROM users WHERE id=?').get(owner.id)?.password_hash !==
        stored.password_hash
    )
      throw new CatalogError('Akses pemilik telah berubah. Masuk kembali.', 403, 'forbidden');
  };
  const confirmApprovalPassword = async (actor, value, ip) => {
    if (actor.role !== 'admin' || !accountIsApproved(db, actor.id))
      throw new CatalogError('Akses Admin atau Pemilik diperlukan.', 403, 'forbidden');
    if (typeof value !== 'string' || !value || value.length > 128)
      throw new CatalogError('Masukkan kata sandi akun pengelola.', 422, 'validation_error');
    const stored = db.prepare('SELECT password_hash,role FROM users WHERE id=?').get(actor.id);
    if (stored?.role !== 'admin') throw new CatalogError('Akses pengelola berubah.', 403, 'forbidden');
    const matches = await passwordQueue.run(ip, async () => {
      const delay = limiter.loginDelay(ip, actor.email);
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      return passwordCheck(value, stored.password_hash);
    });
    if (!matches) {
      const allowed = limiter.take('login', ip, actor.email);
      throw new CatalogError('Kata sandi pengelola tidak sesuai.', allowed ? 401 : 429,
        allowed ? 'invalid_credentials' : 'rate_limited');
    }
    const latest = db.prepare('SELECT password_hash,role FROM users WHERE id=?').get(actor.id);
    if (latest?.role !== 'admin' || latest.password_hash !== stored.password_hash ||
      !accountIsActive(db, actor.id) || !accountIsApproved(db, actor.id))
      throw new CatalogError('Akses pengelola telah berubah. Masuk kembali.', 403, 'forbidden');
  };
  const handler = async (req, res) => {
    const requestId = randomUUID();
    let path = '';
    try {
      refreshMailSettings();
      path = new URL(req.url, 'http://bam.local').pathname;
      if (!path.startsWith('/api/')) {
        if (site.respond(req, res, path)) return;
        return sendError(res, 404, 'not_found');
      }
      const publicProductMatch = path.match(/^\/api\/public\/products\/([^/]+)(\/image)?$/);
      if (publicProductMatch && req.method === 'GET') {
        const item = site.product(decodeURIComponent(publicProductMatch[1]));
        if (!item) return sendError(res, 404, 'not_found');
        if (publicProductMatch[2]) {
          const image = item.imageData.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
          if (!image) return sendError(res, 404, 'not_found');
          res.writeHead(200, {
            'content-type': image[1],
            'cache-control': 'public, max-age=300',
            'x-content-type-options': 'nosniff',
          });
          res.end(Buffer.from(image[2], 'base64'));
          return;
        }
        return json(res, 200, { ...item, imageData: Boolean(item.imageData) });
      }
      const mutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
      if (mutation && !checkOrigin(req))
        return sendError(res, 403, 'invalid_origin', {
          form: 'Permintaan berasal dari situs yang tidak diizinkan.',
        });
      if (
        mutation &&
        path !== '/api/auth/logout' &&
        !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')
      )
        return sendError(res, 415, 'unsupported_media_type');
      if (req.method === 'GET' && path === '/api/inventory')
        return json(res, 200, workflow.stock({ publicRead: true }));
      if (path === '/api/team/customers') {
        const user = currentUser(req);
        if (!user) return sendError(res, 401, 'unauthorized');
        if (!customerAccess(db, user).canViewCustomers)
          return sendError(res, 403, 'forbidden', {
            form: 'Izin melihat daftar pembeli diperlukan. Hubungi pemilik toko.',
          });
        if (req.method !== 'GET') return sendError(res, 405, 'method_not_allowed');
        return json(
          res,
          200,
          accounts.customers(user, new URL(req.url, 'http://bam.local').searchParams),
        );
      }
      const approvalMatch = path.match(/^\/api\/admin\/approvals(?:\/([^/]+))?$/);
      if (approvalMatch) {
        const admin = currentUser(req);
        if (!admin) return sendError(res, 401, 'unauthorized');
        if (admin.role !== 'admin') return sendError(res, 403, 'forbidden');
        if (req.method === 'GET' && !approvalMatch[1])
          return json(res, 200, accounts.listApprovals(admin, new URL(req.url, 'http://bam.local').searchParams));
        if (req.method === 'POST' && approvalMatch[1]) {
          const body = await readBody(req, 12000);
          await confirmApprovalPassword(admin, body?.currentPassword, clientIp(req));
          return json(res, 200, accounts.reviewApproval(admin, decodeURIComponent(approvalMatch[1]), body));
        }
        return sendError(res, 405, 'method_not_allowed');
      }
      const accountMatch = path.match(/^\/api\/admin\/accounts(?:\/([^/]+))?$/);
      if (accountMatch) {
        const owner = currentUser(req);
        if (!owner) return sendError(res, 401, 'unauthorized');
        if (!isStoreOwner(db, owner))
          return sendError(res, 403, 'forbidden', {
            form: 'Kelola akun hanya tersedia untuk pemilik toko.',
          });
        if (req.method === 'GET' && !accountMatch[1])
          return json(
            res,
            200,
            accounts.list(owner, new URL(req.url, 'http://bam.local').searchParams),
          );
        if (req.method === 'POST' && accountMatch[1]) {
          const body = await readBody(req, 12000);
          await confirmOwnerPassword(owner, body?.currentPassword, clientIp(req));
          return json(res, 200, accounts.change(owner, decodeURIComponent(accountMatch[1]), body));
        }
        return sendError(res, 405, 'method_not_allowed');
      }
      if (path === '/api/admin/email-settings' || path === '/api/admin/email-settings/test') {
        const owner = currentUser(req);
        if (!owner) return sendError(res, 401, 'unauthorized');
        if (!isStoreOwner(db, owner))
          return sendError(res, 403, 'forbidden', {
            form: 'Pengaturan email hanya dapat dibuka oleh pemilik toko.',
          });
        if (req.method === 'GET' && path === '/api/admin/email-settings')
          return json(res, 200, emailSettings.snapshot());
        if (req.method === 'POST') {
          const body = await readBody(req, 12000),
            ip = clientIp(req);
          await confirmOwnerPassword(owner, body?.currentPassword, ip);
          const result = path.endsWith('/test')
            ? await emailSettings.sendTest(owner, body.revision)
            : emailSettings.save(owner, body);
          refreshMailSettings();
          return json(res, 200, result);
        }
        return sendError(res, 405, 'method_not_allowed');
      }
      if (
        path === '/api/orders' ||
        path.startsWith('/api/orders/') ||
        path === '/api/admin/orders' ||
        path === '/api/admin/readiness' ||
        path.startsWith('/api/admin/notifications/') ||
        path === '/api/admin/inventory' ||
        path === '/api/admin/inventory/import'
      ) {
        const user = currentUser(req);
        if (!user) return sendError(res, 401, 'unauthorized');
        if (path.startsWith('/api/admin/') && user.role !== 'admin')
          return sendError(res, 403, 'forbidden');
        if (path === '/api/admin/readiness' && req.method === 'GET')
          return json(res, 200, {
            emailReady: identity.ready,
            canManageEmail: isStoreOwner(db, user),
            verificationRequired: true,
            transferReady: Boolean(company.snapshot().profile.bankAccount),
            delivery: messages.summary(),
            skippedReasons: messages.skippedSummary(),
            accountDelivery: db
              .prepare(
                'SELECT COUNT(*) AS queued,COALESCE(SUM(CASE WHEN attempts>0 THEN 1 ELSE 0 END),0) AS retrying FROM auth_mail_outbox',
              )
              .get(),
            failedMessages: messages.failedMessages(),
            pendingOrders: db
              .prepare(
                "SELECT COUNT(*) AS n FROM orders WHERE status IN ('awaiting_confirmation','awaiting_review')",
              )
              .get().n,
          });
        const retryMatch = path.match(/^\/api\/admin\/notifications\/(.+)\/retry$/);
        if (retryMatch && req.method === 'POST')
          return json(res, 200, { retried: messages.retry(decodeURIComponent(retryMatch[1])) });
        const proofMatch = path.match(/^\/api\/orders\/([^/]+)\/proof\/([a-f0-9]{64})$/);
        if (proofMatch && req.method === 'GET') {
          const proof = workflow.proof(user, decodeURIComponent(proofMatch[1]), proofMatch[2]);
          res.writeHead(200, {
            'content-type': proof.mime,
            'cache-control': 'private, no-store',
            'x-content-type-options': 'nosniff',
            'content-security-policy': "default-src 'none'; sandbox",
          });
          res.end(Buffer.from(proof.bytes));
          return;
        }
        const uploadMatch = path.match(/^\/api\/orders\/([^/]+)\/proof$/);
        if (uploadMatch && req.method === 'POST') {
          const body = await readBody(req, 1500000);
          return json(res, 200, {
            order: workflow.update(user, decodeURIComponent(uploadMatch[1]), {
              ...body,
              action: 'submit_proof',
            }),
          });
        }
        if (path === '/api/admin/inventory' && req.method === 'GET')
          return json(res, 200, workflow.stock());
        if (path === '/api/admin/inventory/import' && req.method === 'POST')
          return json(res, 200, workflow.importStock(user, await readBody(req, 500000)));
        if (path === '/api/admin/inventory' && req.method === 'PUT')
          return json(res, 200, workflow.setStock(user, await readBody(req)));
        if (req.method === 'GET' && ['/api/orders', '/api/admin/orders'].includes(path))
          return json(
            res,
            200,
            workflow.list(user, {
              admin: path === '/api/admin/orders',
              before: new URL(req.url, 'http://bam.local').searchParams.get('before') || '',
            }),
          );
        if (req.method === 'POST' && path === '/api/orders')
          return json(res, 201, {
            order: workflow.create(user, await readBody(req), clientIp(req)),
          });
        const imageMatch = path.match(/^\/api\/orders\/([^/]+)\/images\/(\d+)$/);
        if (imageMatch && req.method === 'GET') {
          const picture = workflow.image(
            user,
            decodeURIComponent(imageMatch[1]),
            Number(imageMatch[2]),
          );
          res.writeHead(200, {
            'content-type': picture.contentType,
            'cache-control': 'private, no-store',
            'x-content-type-options': 'nosniff',
          });
          res.end(picture.bytes);
          return;
        }
        const orderMatch = path.match(/^\/api\/orders\/([^/]+)$/);
        if (orderMatch && req.method === 'GET')
          return json(res, 200, { order: workflow.get(user, decodeURIComponent(orderMatch[1])) });
        if (orderMatch && req.method === 'PUT')
          return json(res, 200, {
            order: workflow.update(user, decodeURIComponent(orderMatch[1]), await readBody(req)),
          });
        return sendError(res, 404, 'not_found');
      }
      if (req.method === 'GET' && path === '/api/company')
        return json(res, 200, company.snapshot());
      if (path === '/api/admin/company' && req.method === 'PUT') {
        const user = currentUser(req);
        if (!user) return sendError(res, 401, 'unauthorized');
        if (user.role !== 'admin') return sendError(res, 403, 'forbidden');
        return json(res, 200, company.save(await readBody(req, 1500000)));
      }
      if (req.method === 'GET' && path === '/api/catalog')
        return json(res, 200, catalog.snapshot());
      if (path === '/api/admin/catalog' && req.method === 'PUT') {
        const user = currentUser(req);
        if (!user) return sendError(res, 401, 'unauthorized');
        if (user.role !== 'admin') return sendError(res, 403, 'forbidden');
        return json(res, 200, catalog.save(await readBody(req, 20 * 1024 * 1024)));
      }
      if (req.method === 'GET' && path === '/api/auth/me') {
        const user = currentUser(req);
        return user
          ? json(res, 200, { user: publicUser(user) })
          : sendError(res, 401, 'unauthorized');
      }
      if (req.method === 'GET' && path === '/api/auth/features')
        return json(res, 200, {
          emailReady: identity.ready,
          newRegistrationsRequireVerification: true,
          registrationUsesOriginalPassword: true,
          registrationRequiresApproval: true,
        });
      if (
        req.method === 'POST' &&
        [
          '/api/auth/forgot-password',
          '/api/auth/reset-password',
          '/api/auth/verify-email',
          '/api/auth/verification/request',
          '/api/auth/verification/resend',
          '/api/auth/change-password',
        ].includes(path)
      ) {
        const user = currentUser(req);
        if (['/api/auth/verification/request', '/api/auth/change-password'].includes(path) && !user)
          return sendError(res, 401, 'unauthorized');
        if (path === '/api/auth/change-password' && user.role !== 'admin')
          return sendError(res, 403, 'forbidden', {
            form: 'Pengaturan kata sandi di halaman akun hanya tersedia untuk admin.',
          });
        const body = await readBody(req);
        const ip = clientIp(req);
        const result =
          path === '/api/auth/forgot-password'
            ? await identity.forgot(body.email, ip)
            : path === '/api/auth/reset-password'
              ? await identity.reset(body.token, body.password, ip)
              : path === '/api/auth/verify-email'
                ? await identity.verify(body.token, body.password, ip)
                : path === '/api/auth/verification/request'
                  ? identity.requestVerification(user, ip)
                  : path === '/api/auth/verification/resend'
                    ? await identity.resendRegistrationVerification(body.email, ip)
                    : await identity.changePassword(user, body.currentPassword, body.password, ip);
        return json(
          res,
          path === '/api/auth/forgot-password' || path === '/api/auth/verification/request' ||
            path === '/api/auth/verification/resend'
            ? 202
            : 200,
          result,
        );
      }
      if (req.method === 'POST' && path === '/api/auth/register') {
        const fields = authFields(await readBody(req), true);
        if (Object.keys(fields.errors).length)
          return sendError(res, 422, 'validation_error', fields.errors);
        return json(res, 202, await identity.register(fields, clientIp(req)));
      }
      if (req.method === 'POST' && path === '/api/auth/login') {
        const fields = authFields(await readBody(req), false);
        if (Object.keys(fields.errors).length)
          return sendError(res, 422, 'validation_error', fields.errors);
        const user = db.prepare('SELECT * FROM users WHERE email=?').get(fields.email);
        const storedHashValid = validPasswordHash(user?.password_hash);
        const ip = clientIp(req);
        const matches = await passwordQueue.run(ip, async () => {
          // Slow a source after repeated failures; a correct password still works.
          // The bounded queue also bounds delayed work and its concurrency per IP.
          const delay = limiter.loginDelay(ip, fields.email);
          if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
          return passwordCheck(
            fields.password,
            storedHashValid ? user.password_hash : DUMMY_PASSWORD_HASH,
          );
        });
        if (
          !user ||
          !storedHashValid ||
          !matches ||
          db.prepare('SELECT password_hash FROM users WHERE id=?').get(user.id)?.password_hash !==
            user.password_hash
        ) {
          const allowed = limiter.take('login', ip, fields.email);
          return sendError(
            res,
            allowed ? 401 : 429,
            allowed ? 'invalid_credentials' : 'too_many_attempts',
            {
              form: allowed
                ? 'Email atau kata sandi salah.'
                : 'Terlalu banyak percobaan gagal dari koneksi ini. Coba kembali nanti atau gunakan pemulihan akun.',
            },
          );
        }
        if (!accountIsActive(db, user.id))
          return sendError(res, 403, 'account_disabled', {
            form: 'Akun ini dinonaktifkan. Hubungi pemilik toko.',
          });
        if (!accountIsApproved(db, user.id))
          return sendError(res, 403, 'approval_required', {
            form: 'Akun belum dapat masuk karena persetujuan pengelola masih diperlukan. Jika Anda sudah mendaftar, periksa email verifikasi dan hubungi Admin atau Pemilik toko untuk bantuan.',
          });
        limiter.clearLoginPair(ip, fields.email);
        return json(res, 200, { user: publicUser(user) }, sessionHeaders(user.id));
      }
      if (req.method === 'POST' && path === '/api/auth/logout') {
        const value = token(req);
        if (value) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(value));
        return json(
          res,
          200,
          { ok: true },
          {
            'set-cookie': `bam_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureCookies ? '; Secure' : ''}`,
          },
        );
      }
      if (path.startsWith('/api/admin/users')) {
        const admin = currentUser(req);
        if (!admin) return sendError(res, 401, 'unauthorized');
        if (!isStoreOwner(db, admin)) return sendError(res, 403, 'forbidden');
        if (req.method === 'GET' && path === '/api/admin/users')
          return json(res, 200, {
            users: db
              .prepare(
                'SELECT id,name,email,address,role,created_at AS createdAt FROM users ORDER BY created_at DESC',
              )
              .all(),
          });
      }
      if (
        (req.method === 'PUT' && path === '/api/profile') ||
        (req.method === 'PUT' && path.startsWith('/api/admin/users/'))
      ) {
        const actor = currentUser(req);
        if (!actor) return sendError(res, 401, 'unauthorized');
        if (path !== '/api/profile' && !isStoreOwner(db, actor))
          return sendError(res, 403, 'forbidden');
        const userId = path === '/api/profile' ? actor.id : path.slice('/api/admin/users/'.length);
        const body = await readBody(req);
        const name = typeof body?.name === 'string' ? body.name.trim() : '';
        const address = typeof body?.address === 'string' ? body.address.trim() : '';
        if (name.length < 2 || name.length > 100 || address.length < 10 || address.length > 500)
          return sendError(res, 422, 'validation_error', { form: 'Nama atau alamat tidak valid.' });
        const canEditStoreName = path === '/api/profile' && Object.hasOwn(body, 'storeName');
        const storeName = canEditStoreName && typeof body.storeName === 'string'
          ? body.storeName.trim()
          : '';
        if (canEditStoreName && (typeof body.storeName !== 'string' ||
          (storeName.length > 0 && storeName.length < 2) || storeName.length > 100))
          return sendError(res, 422, 'validation_error', {
            form: 'Nama toko harus kosong atau berisi 2–100 karakter.',
          });
        const user = db
          .prepare('SELECT id,name,email,address,role FROM users WHERE id=?')
          .get(userId);
        if (!user) return sendError(res, 404, 'user_not_found');
        db.exec('BEGIN IMMEDIATE');
        try {
          db.prepare('UPDATE users SET name=?,address=? WHERE id=?').run(name, address, userId);
          if (canEditStoreName) {
            if (storeName)
              db.prepare('INSERT INTO user_store_names(user_id,store_name) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET store_name=excluded.store_name')
                .run(userId, storeName);
            else db.prepare('DELETE FROM user_store_names WHERE user_id=?').run(userId);
          }
          db.exec('COMMIT');
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
        return json(res, 200, { user: publicUser({ ...user, name, address }) });
      }
      return sendError(res, 404, 'not_found');
    } catch (error) {
      if (error instanceof CatalogError)
        return sendError(res, error.status, error.code, { form: error.message });
      if (error?.code === 'auth_busy')
        return sendError(res, 503, 'auth_busy', { form: error.message });
      logUnexpectedError(logger, error, {
        requestId,
        method: req.method,
        path: path.replace(/(\/api\/(?:orders|admin\/users))\/[^/]+/, '$1/:id'),
      });
      return sendError(
        res,
        500,
        'server_error',
        { form: 'Server belum dapat menyimpan perubahan. Coba kembali.' },
        { 'x-request-id': requestId },
      );
    }
  };
  return {
    server: createServer(handler),
    handler,
    db,
    catalog,
    company,
    workflow,
    identity,
    messages,
    emailSettings,
    accounts,
    refreshMailSettings,
  };
}
