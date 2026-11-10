import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { invoiceFilename, renderInvoicePdf } from './invoicePdf.js';
import { createWhatsAppBusinessSender } from './whatsappBusiness.js';

const admin = { id: 'operator', role: 'admin' },
  buyer = { id: 'buyer', role: 'user' };
const phone = '+6281234567890';

function fixture({ codOnly = true, sender = {} } = {}) {
  let time = Date.now();
  const mail = [],
    whatsapp = [];
  const app = createApp({
    dbPath: ':memory:',
    legacyCommerceFixture: !codOnly,
    now: () => time,
    mailer: { enabled: true, send: async (message) => mail.push(message) },
    mailConfig: { publicUrl: 'https://fixture.test', queueKey: 'f'.repeat(64) },
    logger: () => {},
    whatsappBusinessSender: {
      invoiceReady: true,
      updateReady: true,
      sendInvoice: async (message) => whatsapp.push({ type: 'invoice', ...message }),
      sendUpdate: async (message) => whatsapp.push({ type: 'update', ...message }),
      ...sender,
    },
  });
  for (const user of [admin, buyer]) {
    app.db
      .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
      .run(
        user.id,
        user.id,
        user.id + '@fixture.test',
        'Alamat fixture lengkap',
        'unused',
        new Date(time).toISOString(),
        user.role,
      );
    app.db.prepare('INSERT INTO auth_account_state VALUES(?,?,0)').run(user.id, time);
  }
  const settings = app.company.snapshot();
  app.company.save({
    ...settings,
    profile: {
      ...settings.profile,
      bankName: 'Bank Fixture',
      bankAccount: '12345678',
      bankHolder: 'Perusahaan Fixture',
    },
  });
  return { app, mail, whatsapp, advance: (ms) => (time += ms) };
}
const confirmPhone = (app, consent = true) => {
  app.db
    .prepare('INSERT INTO user_contact_phones(user_id,phone,revision,verified_at) VALUES(?,?,?,?)')
    .run(buyer.id, phone, randomUUID(), Date.now());
  if (consent) app.phoneVerification.setWhatsAppNotifications(buyer.id, true);
};
const input = (paymentId = 'cod') => ({
  requestKey: randomUUID(),
  recipient: 'Pembeli fixture',
  address: 'Alamat fixture lengkap',
  shippingId: 'regular',
  paymentId,
  items: [{ id: 'snack-pedas', quantity: 1, expectedPrice: 18000 }],
});
const statuses = (app) =>
  app.db
    .prepare('SELECT channel,kind,status,skip_reason AS reason FROM order_delivery ORDER BY rowid')
    .all()
    .map((row) => ({ ...row }));

test('invoice PDF: valid file with paging and text outside the built-in font range', async () => {
  const order = {
    id: 'BAM-1',
    createdAt: Date.now(),
    seller: { shortName: 'BAM', legalName: 'CV Fixture', address: 'Jalan 🌶️' },
    recipient: 'Toko 🌸',
    address: 'Alamat',
    payment: { groupId: 'cod', status: 'pay_on_delivery' },
    shipping: { cost: 0 },
    subtotal: 800000,
    total: 800000,
    items: Array.from({ length: 80 }, (_, index) => ({
      id: String(index),
      name: 'Produk ' + index,
      price: 10000,
      oldPrice: 12000,
      quantity: 1,
    })),
  };
  const pdf = await renderInvoicePdf(order);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.match(pdf.toString('latin1'), /\/Count [2-9]/);
  assert.equal(invoiceFilename({ id: 'BAM/1 x' }), 'Faktur-BAM-1-x.pdf');
});

test('WhatsApp sender: uploads the PDF, sends a template, and hides provider errors', async () => {
  const calls = [];
  const sender = createWhatsAppBusinessSender(
    {
      BAM_WHATSAPP_TOKEN: 'fixture-token',
      BAM_WHATSAPP_PHONE_ID: '12345',
      BAM_WHATSAPP_API_VERSION: 'v99.0',
      BAM_WHATSAPP_INVOICE_TEMPLATE: 'order_invoice',
      BAM_WHATSAPP_ORDER_TEMPLATE: 'order_update',
    },
    async (url, options) => {
      calls.push({ url, options });
      return new Response(
        JSON.stringify(url.endsWith('/media') ? { id: 'media-1' } : { messages: [{ id: 'm' }] }),
      );
    },
  );
  assert.equal(sender.invoiceReady && sender.updateReady, true);
  await sender.sendInvoice({
    phone,
    pdf: Buffer.from('%PDF-'),
    filename: 'Faktur-1.pdf',
    parameters: ['Nama\nBaru', 'BAM-1', 'Rp 1', ''],
  });
  assert.match(calls[0].url, /\/v99\.0\/12345\/media$/);
  assert.equal(calls[0].options.body.get('file').type, 'application/pdf');
  const { template, to } = JSON.parse(calls[1].options.body);
  assert.equal(to, phone.slice(1));
  assert.equal(template.name, 'order_invoice');
  assert.deepEqual(template.components[0].parameters[0].document, {
    id: 'media-1',
    filename: 'Faktur-1.pdf',
  });
  // Meta rejects line breaks and empty values in template parameters.
  assert.deepEqual(
    template.components[1].parameters.map((item) => item.text),
    ['Nama Baru', 'BAM-1', 'Rp 1', '-'],
  );

  const failing = createWhatsAppBusinessSender(
    {
      BAM_WHATSAPP_TOKEN: 'fixture-token',
      BAM_WHATSAPP_PHONE_ID: '12345',
      BAM_WHATSAPP_API_VERSION: 'v99.0',
      BAM_WHATSAPP_ORDER_TEMPLATE: 'order_update',
    },
    async () => new Response(JSON.stringify({ error: 'fixture-token leaked' }), { status: 400 }),
  );
  await assert.rejects(failing.sendUpdate({ phone, parameters: ['a'] }), (error) => {
    assert.doesNotMatch(error.message, /fixture-token/);
    return true;
  });
});

test('WhatsApp sender: stays off without credentials and rejects invalid configuration', () => {
  const off = createWhatsAppBusinessSender({ BAM_WHATSAPP_INVOICE_TEMPLATE: 'order_invoice' });
  assert.equal(off.invoiceReady, false);
  assert.equal(off.updateReady, false);
  assert.throws(() =>
    createWhatsAppBusinessSender({
      BAM_WHATSAPP_TOKEN: 'x',
      BAM_WHATSAPP_PHONE_ID: 'not-a-number',
      BAM_WHATSAPP_API_VERSION: 'v99.0',
      BAM_WHATSAPP_INVOICE_TEMPLATE: 'order_invoice',
    }),
  );
});

test('fixed-total COD order: invoice goes to email and consented WhatsApp once', async () => {
  const { app, mail, whatsapp } = fixture();
  confirmPhone(app);
  const order = app.workflow.create(buyer, input());
  assert.equal(await app.delivery.flush(), 2);
  assert.equal(await app.delivery.flush(), 0);
  const invoice = mail.find((message) => message.attachments);
  assert.equal(invoice.to, 'buyer@fixture.test');
  assert.equal(invoice.attachments[0].content.subarray(0, 5).toString(), '%PDF-');
  assert.equal(whatsapp.length, 1);
  assert.equal(whatsapp[0].phone, phone);
  // The message shows the same short number as the website, never the long internal ID.
  assert.match(order.id, /^BAM-[0-9A-F]{8}-/);
  assert.equal(invoice.subject.endsWith('Faktur pesanan ' + order.id.slice(0, 12)), true);
  assert.deepEqual(whatsapp[0].parameters, [
    'Pembeli fixture',
    order.id.slice(0, 12),
    'Rp ' + order.total.toLocaleString('id-ID'),
    'Bayar saat barang diterima',
  ]);
});

test('WhatsApp requires consent on a verified number, and a new number clears consent', async () => {
  const { app, whatsapp } = fixture();
  assert.throws(() => app.phoneVerification.setWhatsAppNotifications(buyer.id, true), {
    code: 'phone_unverified',
  });
  confirmPhone(app, false);
  app.workflow.create(buyer, input());
  await app.delivery.flush();
  assert.equal(whatsapp.length, 0, 'verified phone without consent receives nothing');
  assert.deepEqual(
    statuses(app).map((row) => row.channel),
    ['invoice_email'],
  );

  app.phoneVerification.setWhatsAppNotifications(buyer.id, true);
  assert.equal(app.phoneVerification.contact(buyer.id).whatsappNotifications, true);
  app.db
    .prepare("INSERT OR IGNORE INTO account_approvals(user_id,status) VALUES(?,'approved')")
    .run(buyer.id);
  app.phoneVerification.save(buyer.id, '081299998888');
  const contact = app.phoneVerification.contact(buyer.id);
  assert.equal(contact.phoneVerified, false);
  assert.equal(contact.whatsappNotifications, false);
});

test('consent withdrawn before sending skips a queued WhatsApp message', async () => {
  const { app, whatsapp } = fixture();
  confirmPhone(app);
  app.workflow.create(buyer, input());
  app.phoneVerification.setWhatsAppNotifications(buyer.id, false);
  await app.delivery.flush();
  assert.equal(whatsapp.length, 0);
  assert.equal(
    statuses(app).find((row) => row.channel === 'invoice_whatsapp').reason,
    'whatsapp_not_allowed',
  );
});

test('reviewed transfer: invoice waits for the final total, then a paid invoice and updates', async () => {
  const { app, mail, whatsapp } = fixture({ codOnly: false });
  confirmPhone(app);
  let order = app.workflow.create(buyer, input('manual-transfer'));
  await app.delivery.flush();
  assert.equal(statuses(app).length, 0, 'unquoted total must not produce an invoice');

  order = app.workflow.update(admin, order.id, {
    action: 'approve_payment',
    revision: order.revision,
    shippingCost: 35000,
    courier: 'Kurir toko',
  });
  await app.delivery.flush();
  assert.deepEqual(
    whatsapp.map((item) => item.type),
    ['update'],
  );
  assert.equal(mail.filter((message) => message.attachments).length, 0);

  order = app.workflow.update(buyer, order.id, {
    action: 'accept_quote',
    revision: order.revision,
  });
  await app.delivery.flush();
  assert.equal(whatsapp.at(-1).type, 'invoice');
  assert.equal(whatsapp.at(-1).parameters[3], 'Menunggu pembayaran');

  order = app.workflow.update(admin, order.id, {
    action: 'paid',
    revision: order.revision,
    reference: 'REF-123',
  });
  await app.delivery.flush();
  assert.equal(whatsapp.at(-1).parameters[3], 'Lunas');
  assert.equal(mail.filter((message) => message.attachments).length, 2);

  app.workflow.update(admin, order.id, {
    action: 'ship',
    revision: order.revision,
    courier: 'Kurir toko',
    trackingNumber: 'RESI-1',
  });
  await app.delivery.flush();
  assert.equal(whatsapp.at(-1).type, 'update');
  assert.match(whatsapp.at(-1).parameters[2], /RESI-1/);
});

test('a queued invoice is not sent after its order is cancelled', async () => {
  const { app, mail } = fixture();
  const order = app.workflow.create(buyer, input());
  app.workflow.update(buyer, order.id, {
    action: 'cancel',
    revision: order.revision,
    reason: 'Berubah pikiran',
  });
  await app.delivery.flush();
  assert.equal(mail.filter((message) => message.attachments).length, 0);
  assert.equal(statuses(app)[0].reason, 'order_changed');
});

test('failed delivery retries with backoff, reaches admin readiness, and can be retried', async () => {
  let down = true;
  const { app, whatsapp, advance } = fixture({
    sender: {
      sendInvoice: async (message) => {
        if (down) throw new Error('offline');
        whatsapp.push(message);
      },
    },
  });
  confirmPhone(app);
  app.workflow.create(buyer, input());
  await app.delivery.flush();
  const [failed] = app.messages.failedMessages();
  assert.match(failed.kind, /^invoice_whatsapp:/);
  assert.equal(failed.attempts, 1);
  assert.equal(await app.delivery.flush(), 0, 'backoff delays the next attempt');
  down = false;
  assert.equal(app.messages.retry(failed.id), true);
  advance(1);
  assert.equal(await app.delivery.flush(), 1);
  assert.equal(whatsapp.length, 1);
  assert.equal(app.messages.failedMessages().length, 0);
});

test('unconfigured WhatsApp keeps email invoices working and queues nothing for WhatsApp', async () => {
  const { app, mail } = fixture({ sender: { invoiceReady: false, updateReady: false } });
  confirmPhone(app);
  app.workflow.create(buyer, input());
  await app.delivery.flush();
  assert.equal(mail.filter((message) => message.attachments).length, 1);
  assert.deepEqual(
    statuses(app).map((row) => row.channel),
    ['invoice_email'],
  );
});

test('invoices for a store order use store buyers, not assigned Sales', async () => {
  const { app } = fixture();
  app.delivery.b2bBuyers = () => [{ id: buyer.id }];
  assert.deepEqual(app.delivery.recipients({ b2b: { storeId: 's' }, userId: 'sales' }), [
    { id: buyer.id },
  ]);
  assert.deepEqual(app.delivery.recipients({ userId: buyer.id }), [{ id: buyer.id }]);
});
