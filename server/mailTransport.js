import nodemailer from 'nodemailer';

export function mailTransportFromEnv(env = process.env) {
  const needed = ['BAM_SMTP_HOST', 'BAM_SMTP_USER', 'BAM_SMTP_PASSWORD', 'BAM_MAIL_FROM'];
  const configured = needed.filter((key) => env[key]);
  if (!configured.length) return { enabled: false };
  if (configured.length !== needed.length) throw new Error('SMTP configuration is incomplete.');
  const port = Number(env.BAM_SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid SMTP port.');
  if (/[\r\n]/.test(env.BAM_MAIL_FROM)) throw new Error('Invalid sender.');
  const transport = nodemailer.createTransport({
    host: env.BAM_SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: env.BAM_SMTP_USER, pass: env.BAM_SMTP_PASSWORD },
    tls: { rejectUnauthorized: true },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  });
  return {
    enabled: true,
    send: (message) => transport.sendMail({ ...message, from: env.BAM_MAIL_FROM }),
  };
}
