import { logUnexpectedError } from './errorLogging.js';
import { accountIsActive } from './accountAccess.js';
import { randomUUID } from 'node:crypto';
const labels = {
  orderCreated: 'Permintaan pesanan baru',
  quoteReady: 'Total akhir siap disetujui',
  orderApproved: 'Pembayaran dapat dilanjutkan',
  paymentReminder: 'Batas waktu pesanan segera berakhir',
  orderShipped: 'Pesanan dikirim',
  orderCancelled: 'Pesanan dibatalkan',
  orderCompleted: 'Pesanan selesai',
  codConfirmed: 'COD diproses',
  paymentReceived: 'Pembayaran diterima',
  paymentExpired: 'Batas pembayaran berakhir',
  quoteExpired: 'Batas persetujuan total berakhir',
  orderReviewExpired: 'Batas pemeriksaan berakhir',
  codConfirmationExpired: 'Batas pemeriksaan COD berakhir',
  proofSubmitted: 'Bukti pembayaran menunggu pemeriksaan',
  proofRejected: 'Bukti pembayaran perlu diperbaiki',
};
export class OrderMessages {
  constructor(db, identity, company, now, logger) {
    Object.assign(this, { db, identity, company, now, logger });
    db.exec(
      'CREATE TABLE IF NOT EXISTS order_mail(id TEXT PRIMARY KEY,order_id TEXT NOT NULL,kind TEXT NOT NULL,recipient_id TEXT NOT NULL,admin INTEGER NOT NULL,created_at INTEGER NOT NULL,status TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL,leased_until INTEGER NOT NULL DEFAULT 0,sent_at INTEGER); CREATE INDEX IF NOT EXISTS order_mail_due ON order_mail(status,next_attempt,leased_until)',
    );
    this.transaction(() => {
      if (
        !db
          .prepare('PRAGMA table_info(order_mail)')
          .all()
          .some((column) => column.name === 'skip_reason')
      )
        db.exec("ALTER TABLE order_mail ADD COLUMN skip_reason TEXT NOT NULL DEFAULT ''");
    });
  }
  enqueue(order, kind, time) {
    if (!labels[kind]) return;
    const recipients = order.b2b
      ? (this.b2bRecipients?.(order.b2b.storeId) || []).map((user) => ({ id: user.id, admin: 0 }))
      : [{ id: order.userId, admin: 0 }];
    if (['orderCreated', 'proofSubmitted', 'orderCancelled'].includes(kind))
      for (const u of this.db
        .prepare(
          "SELECT u.id FROM users u LEFT JOIN account_access a ON a.user_id=u.id WHERE u.role='admin' AND a.disabled_at IS NULL",
        )
        .all())
        recipients.push({ id: u.id, admin: 1 });
    for (const recipient of recipients) {
      const id = [
        order.id,
        kind,
        kind === 'paymentReminder' ? order.payment.remindedFor : order.revision,
        recipient.id,
        recipient.admin,
      ].join(':');
      this.db
        .prepare(
          'INSERT OR IGNORE INTO order_mail(id,order_id,kind,recipient_id,admin,created_at,status,next_attempt) VALUES(?,?,?,?,?,?,?,?)',
        )
        .run(
          id,
          order.id,
          kind,
          recipient.id,
          recipient.admin,
          time,
          this.identity.ready ? 'queued' : 'configuration_required',
          time,
        );
    }
  }
  transaction(work) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      this.db.exec('COMMIT');
      return result;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  async flush(limit = 8) {
    if (!this.identity.ready) return 0;
    let sent = 0;
    for (let i = 0; i < limit; i++) {
      const row = this.transaction(() => {
        this.db
          .prepare(
            "UPDATE order_mail SET status='skipped',skip_reason='too_old',leased_until=0 WHERE status IN ('queued','configuration_required','sending') AND created_at<? AND leased_until<=?",
          )
          .run(this.now() - 7 * 86400000, this.now());
        const item = this.db
          .prepare(
            "SELECT * FROM order_mail WHERE status IN ('queued','configuration_required','sending') AND next_attempt<=? AND leased_until<=? ORDER BY created_at LIMIT 1",
          )
          .get(this.now(), this.now());
        if (item)
          this.db
            .prepare("UPDATE order_mail SET status='sending',leased_until=? WHERE id=?")
            .run(this.now() + 60000, item.id);
        return item;
      });
      if (!row) break;
      const data = this.db.prepare('SELECT data FROM orders WHERE id=?').get(row.order_id),
        user = this.db.prepare('SELECT email,role FROM users WHERE id=?').get(row.recipient_id);
      const order = data && JSON.parse(data.data);
      let skipReason = '';
      if (!order) skipReason = 'order_missing';
      else if (!user) skipReason = 'recipient_missing';
      else if (order.b2b && !this.b2bCanRead?.({ id: row.recipient_id }, order.b2b.storeId))
        skipReason = 'store_access_changed';
      else if (row.admin && !accountIsActive(this.db, row.recipient_id))
        skipReason = 'recipient_inactive';
      else if (!row.admin && !this.identity.verified(row.recipient_id))
        skipReason = 'email_unverified';
      else if (row.admin && user.role !== 'admin') skipReason = 'recipient_role_changed';
      else if (
        (row.kind === 'proofSubmitted' && order.payment.status !== 'proof_submitted') ||
        (row.kind === 'proofRejected' && order.payment.proof?.status !== 'rejected') ||
        (['quoteReady', 'paymentReminder', 'orderApproved'].includes(row.kind) &&
          !['awaiting_acceptance', 'awaiting_payment'].includes(order.status)) ||
        (row.kind === 'orderCreated' &&
          row.admin &&
          !['awaiting_confirmation', 'awaiting_review'].includes(order.status) &&
          !(order.codFixedTotal && order.status === 'processing'))
      )
        skipReason = 'order_changed';
      if (skipReason) {
        this.db
          .prepare("UPDATE order_mail SET status='skipped',skip_reason=?,leased_until=0 WHERE id=?")
          .run(skipReason, row.id);
        continue;
      }
      const url = new URL(this.identity.publicUrl);
      url.hash = row.admin ? '/admin/pesanan' : '/pesanan/' + encodeURIComponent(order.id);
      const text = [
        labels[row.kind],
        order.id,
        'Subtotal: Rp ' + order.subtotal.toLocaleString('id-ID'),
        order.shipping.quoted
          ? 'Ongkir: Rp ' + order.shipping.cost.toLocaleString('id-ID')
          : 'Ongkir belum ditetapkan toko.',
        order.shipping.quoted
          ? 'Total akhir: Rp ' + order.total.toLocaleString('id-ID')
          : 'Total sementara belum termasuk ongkir.',
        order.cancellationReason || '',
        order.shipping.trackingNumber
          ? 'Kurir: ' + order.shipping.courier + '; resi: ' + order.shipping.trackingNumber
          : '',
        row.kind === 'proofRejected' ? order.payment.proof?.reason : '',
        order.status === 'awaiting_acceptance'
          ? 'Setujui total akhir pada detail pesanan. Batas reservasi: ' +
            new Date(order.quote.expiresAt).toISOString()
          : '',
        order.status === 'awaiting_payment' && order.payment.status !== 'proof_submitted'
          ? 'Batas pembayaran: ' + new Date(order.payment.expiresAt).toISOString()
          : '',
        url.href,
      ]
        .filter(Boolean)
        .join('\n');
      try {
        await this.identity.mailer.send({
          to: user.email,
          subject: this.company.snapshot().profile.shortName + ' · ' + labels[row.kind],
          text,
        });
        this.db
          .prepare("UPDATE order_mail SET status='sent',sent_at=?,leased_until=0 WHERE id=?")
          .run(this.now(), row.id);
        sent++;
      } catch (error) {
        this.db
          .prepare(
            'UPDATE order_mail SET status=?,attempts=attempts+1,next_attempt=?,leased_until=0 WHERE id=?',
          )
          .run(
            row.attempts >= 9 ? 'failed' : 'queued',
            this.now() + Math.min(3600000, 60000 * 2 ** Math.min(row.attempts, 6)),
            row.id,
          );
        logUnexpectedError(this.logger, error, {
          operation: 'order_email_delivery',
          requestId: randomUUID(),
        });
      }
    }
    return sent;
  }
  summary() {
    return this.db.prepare('SELECT status,COUNT(*) AS count FROM order_mail GROUP BY status').all();
  }
  skippedSummary() {
    return this.db
      .prepare(
        "SELECT skip_reason AS reason,COUNT(*) AS count FROM order_mail WHERE status='skipped' GROUP BY skip_reason ORDER BY count DESC,skip_reason",
      )
      .all();
  }
  failedMessages() {
    return this.db
      .prepare(
        "SELECT id,order_id,kind,status,attempts,leased_until FROM order_mail WHERE status IN ('failed','queued') AND attempts>0 ORDER BY created_at DESC LIMIT 20",
      )
      .all()
      .map(({ leased_until, ...row }) => ({ ...row, canRetry: leased_until <= this.now() }));
  }
  retry(id) {
    return (
      this.db
        .prepare(
          "UPDATE order_mail SET status='queued',next_attempt=?,leased_until=0,attempts=0 WHERE id=? AND status IN ('failed','queued') AND attempts>0 AND leased_until<=?",
        )
        .run(this.now(), id, this.now()).changes === 1
    );
  }
}
