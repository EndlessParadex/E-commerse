import { randomUUID } from 'node:crypto';
import { logUnexpectedError } from './errorLogging.js';
import { invoiceFilename, invoicePaymentStatus, renderInvoicePdf } from './invoicePdf.js';

const finalized = (order) => order.commerceVersion !== 31 || order.shipping?.quoted === true;
const invoiceStage = (order, kind) => {
  if (kind === 'paymentReceived') return 'paid';
  return ['orderCreated', 'orderApproved', 'codConfirmed'].includes(kind) && finalized(order)
    ? 'issued'
    : '';
};
// Events that already deliver an invoice do not also send a separate update.
const updates = {
  quoteReady: (order) => 'Total akhir ' + money(order.total) + ' siap Anda setujui.',
  paymentReminder: () => 'Batas waktu pesanan segera berakhir.',
  proofRejected: (order) =>
    'Bukti pembayaran perlu diperbaiki. ' + (order.payment.proof?.reason || ''),
  orderShipped: (order) =>
    order.shipping.driverName
      ? `Pesanan sedang diantar oleh sopir ${order.shipping.driverName}.`
      : `Pesanan dikirim dengan ${order.shipping.courier}, nomor resi ${order.shipping.trackingNumber}.`,
  orderCompleted: () => 'Pesanan telah selesai.',
  orderCancelled: (order) => 'Pesanan dibatalkan. ' + (order.cancellationReason || ''),
  paymentExpired: () => 'Batas pembayaran berakhir.',
  quoteExpired: () => 'Batas persetujuan total berakhir.',
};
const money = (value) => 'Rp ' + value.toLocaleString('id-ID');

export class OrderDelivery {
  constructor(db, { identity, company, phones, sender, now, logger }) {
    Object.assign(this, { db, identity, company, phones, sender, now, logger });
    db.exec(
      "CREATE TABLE IF NOT EXISTS order_delivery(id TEXT PRIMARY KEY,order_id TEXT NOT NULL,channel TEXT NOT NULL,kind TEXT NOT NULL,recipient_id TEXT NOT NULL,created_at INTEGER NOT NULL,status TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL,leased_until INTEGER NOT NULL DEFAULT 0,sent_at INTEGER,skip_reason TEXT NOT NULL DEFAULT ''); CREATE INDEX IF NOT EXISTS order_delivery_due ON order_delivery(status,next_attempt,leased_until)",
    );
  }
  recipients(order) {
    return order.b2b ? this.b2bBuyers?.(order.b2b.storeId) || [] : [{ id: order.userId }];
  }
  whatsappAllowed(userId) {
    const contact = this.phones.contact(userId);
    return contact.phoneVerified && contact.whatsappNotifications;
  }
  insert(order, channel, kind, key, recipientId, time) {
    this.db
      .prepare(
        "INSERT OR IGNORE INTO order_delivery(id,order_id,channel,kind,recipient_id,created_at,status,next_attempt) VALUES(?,?,?,?,?,?,'queued',?)",
      )
      .run(
        [order.id, channel, key, recipientId].join(':'),
        order.id,
        channel,
        kind,
        recipientId,
        time,
        time,
      );
  }
  // Runs inside the order transaction so a delivery is recorded only with its order change.
  enqueue(order, kind, time) {
    const stage = invoiceStage(order, kind);
    for (const { id } of this.recipients(order)) {
      if (stage) {
        this.insert(order, 'invoice_email', 'invoice_' + stage, stage, id, time);
        if (this.sender.invoiceReady && this.whatsappAllowed(id))
          this.insert(order, 'invoice_whatsapp', 'invoice_' + stage, stage, id, time);
      } else if (updates[kind] && this.sender.updateReady && this.whatsappAllowed(id)) {
        const key = kind === 'paymentReminder' ? order.payment.remindedFor : order.revision;
        this.insert(order, 'update_whatsapp', kind, kind + ':' + key, id, time);
      }
    }
  }
  channels() {
    return [
      this.identity.ready && 'invoice_email',
      this.sender.invoiceReady && 'invoice_whatsapp',
      this.sender.updateReady && 'update_whatsapp',
    ].filter(Boolean);
  }
  transaction(work) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  claim(channels) {
    return this.transaction(() => {
      this.db
        .prepare(
          "UPDATE order_delivery SET status='skipped',skip_reason='too_old',leased_until=0 WHERE status IN ('queued','sending') AND created_at<? AND leased_until<=?",
        )
        .run(this.now() - 7 * 86400000, this.now());
      const item = this.db
        .prepare(
          `SELECT * FROM order_delivery WHERE status IN ('queued','sending') AND channel IN (${channels.map(() => '?').join(',')}) AND next_attempt<=? AND leased_until<=? ORDER BY created_at LIMIT 1`,
        )
        .get(...channels, this.now(), this.now());
      if (item)
        this.db
          .prepare("UPDATE order_delivery SET status='sending',leased_until=? WHERE id=?")
          .run(this.now() + 60000, item.id);
      return item;
    });
  }
  skipReason(row, order, user) {
    if (!order) return 'order_missing';
    if (!user) return 'recipient_missing';
    if (order.b2b && !this.b2bCanRead?.({ id: row.recipient_id }, order.b2b.storeId))
      return 'store_access_changed';
    if (row.channel === 'invoice_email') {
      if (!this.identity.verified(row.recipient_id)) return 'email_unverified';
    } else if (!this.whatsappAllowed(row.recipient_id)) return 'whatsapp_not_allowed';
    if (row.kind.startsWith('invoice_') && ['cancelled', 'expired'].includes(order.status))
      return 'order_changed';
    if (
      ['quoteReady', 'paymentReminder'].includes(row.kind) &&
      !['awaiting_acceptance', 'awaiting_payment'].includes(order.status)
    )
      return 'order_changed';
    return '';
  }
  async send(row, order, user) {
    const name = order.b2b?.storeName || order.recipient;
    if (row.channel === 'update_whatsapp')
      return this.sender.sendUpdate({
        phone: this.phones.contact(row.recipient_id).phone,
        parameters: [name, order.id, updates[row.kind](order)],
      });
    const pdf = await renderInvoicePdf(order),
      filename = invoiceFilename(order),
      status = invoicePaymentStatus(order);
    if (row.channel === 'invoice_whatsapp')
      return this.sender.sendInvoice({
        phone: this.phones.contact(row.recipient_id).phone,
        pdf,
        filename,
        parameters: [name, order.id, money(order.total), status],
      });
    const shortName = this.company.snapshot().profile.shortName;
    return this.identity.mailer.send({
      to: user.email,
      subject: `${shortName} · Faktur pesanan ${order.id}`,
      text: [
        'Faktur pesanan terlampir.',
        order.id,
        'Total pembayaran: ' + money(order.total),
        'Status: ' + status,
      ].join('\n'),
      attachments: [{ filename, content: pdf, contentType: 'application/pdf' }],
    });
  }
  async flush(limit = 8) {
    const channels = this.channels();
    if (!channels.length) return 0;
    let sent = 0;
    for (let i = 0; i < limit; i++) {
      const row = this.claim(channels);
      if (!row) break;
      const data = this.db.prepare('SELECT data FROM orders WHERE id=?').get(row.order_id),
        user = this.db.prepare('SELECT email FROM users WHERE id=?').get(row.recipient_id),
        order = data && JSON.parse(data.data),
        skipReason = this.skipReason(row, order, user);
      if (skipReason) {
        this.db
          .prepare(
            "UPDATE order_delivery SET status='skipped',skip_reason=?,leased_until=0 WHERE id=?",
          )
          .run(skipReason, row.id);
        continue;
      }
      try {
        await this.send(row, order, user);
        this.db
          .prepare("UPDATE order_delivery SET status='sent',sent_at=?,leased_until=0 WHERE id=?")
          .run(this.now(), row.id);
        sent++;
      } catch (error) {
        this.db
          .prepare(
            'UPDATE order_delivery SET status=?,attempts=attempts+1,next_attempt=?,leased_until=0 WHERE id=?',
          )
          .run(
            row.attempts >= 9 ? 'failed' : 'queued',
            this.now() + Math.min(3600000, 60000 * 2 ** Math.min(row.attempts, 6)),
            row.id,
          );
        logUnexpectedError(this.logger, error, {
          operation: 'order_document_delivery',
          requestId: randomUUID(),
        });
      }
    }
    return sent;
  }
  summary() {
    return this.db
      .prepare(
        'SELECT channel,status,COUNT(*) AS count FROM order_delivery GROUP BY channel,status',
      )
      .all();
  }
  failedMessages() {
    return this.db
      .prepare(
        "SELECT id,order_id,channel||':'||kind AS kind,status,attempts,leased_until FROM order_delivery WHERE status IN ('failed','queued') AND attempts>0 ORDER BY created_at DESC LIMIT 20",
      )
      .all()
      .map(({ leased_until, ...row }) => ({ ...row, canRetry: leased_until <= this.now() }));
  }
  retry(id) {
    return (
      this.db
        .prepare(
          "UPDATE order_delivery SET status='queued',next_attempt=?,leased_until=0,attempts=0 WHERE id=? AND status IN ('failed','queued') AND attempts>0 AND leased_until<=?",
        )
        .run(this.now(), id, this.now()).changes === 1
    );
  }
}
