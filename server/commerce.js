import { CatalogError, photo } from './catalog.js';
import { createHash } from 'node:crypto';
import { livePaymentMethods } from '../src/state/paymentMethods.js';
import { withNotificationEvent } from '../src/state/orderNotifications.js';
const fail = (message, status = 422, code = 'validation_error') => {
  throw new CatalogError(message, status, code);
};
const money = (value) => Number.isSafeInteger(value) && value >= 0 && value <= 1000000000;
const field = (value, label, max = 100) => {
  if (typeof value !== 'string' || value.trim().length < 2 || value.length > max)
    fail(label + ' tidak valid.');
  return value.trim();
};
export function installCommerce(workflow, identity, messages, { codOnly = true } = {}) {
  const w = workflow,
    db = w.db;
  w.messages = messages;
  db.exec(
    'CREATE TABLE IF NOT EXISTS checkout_limits(bucket TEXT PRIMARY KEY,attempts INTEGER NOT NULL,expires_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS payment_proofs(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),mime TEXT NOT NULL,bytes BLOB NOT NULL,created_at INTEGER NOT NULL);',
  );
  w.validateCheckout = (user, body, payment) => {
    if (!identity.verified(user.id))
      fail(
        'Konfirmasi email akun sebelum membuat pesanan. Buka Akun saya → Keamanan.',
        403,
        'email_verification_required',
      );
    if (codOnly && payment.id !== 'cod')
      fail('BAM hanya menerima pembayaran COD saat barang diterima.', 422, 'payment_unavailable');
    if (codOnly && body.shippingId !== 'regular')
      fail('Pengiriman BAM selalu gratis. Pilih pengiriman reguler.', 422, 'shipping_unavailable');
    if (!codOnly && !livePaymentMethods(w.company.snapshot().profile).some((m) => m.id === payment.id))
      fail(
        'Metode pembayaran ini belum diaktifkan toko. Pilih COD atau transfer yang tersedia.',
        422,
        'payment_unavailable',
      );
  };
  w.checkCheckoutSource = (user, ip) => {
    const time = w.now();
    db.prepare('DELETE FROM checkout_limits WHERE expires_at<=?').run(time);
    const buckets = [
      ['account', user.id, 20, 86400000],
      ['source', ip, 30, 3600000],
    ].map(([kind, id, max, duration]) => ({
      key: kind + ':' + createHash('sha256').update(id).digest('hex'),
      max,
      duration,
    }));
    const read = db.prepare('SELECT attempts FROM checkout_limits WHERE bucket=?');
    if (buckets.some((b) => (read.get(b.key)?.attempts || 0) >= b.max))
      fail(
        'Batas permintaan pesanan tercapai. Periksa pesanan yang sudah dibuat atau hubungi toko.',
        429,
        'checkout_rate_limit',
      );
    if (
      db.prepare('SELECT COUNT(*) AS n FROM checkout_limits').get().n +
        buckets.filter((b) => !read.get(b.key)).length >
      10000
    )
      fail('Antrean permintaan sedang penuh. Coba kembali nanti.', 503, 'checkout_busy');
    for (const b of buckets)
      db.prepare(
        'INSERT INTO checkout_limits VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1',
      ).run(b.key, time + b.duration);
  };
  w.prepareOrder = (order, { historical = false } = {}) => {
    order.commerceVersion = 31;
    order.seller = {
      shortName: w.company.snapshot().profile.shortName,
      legalName: w.company.snapshot().profile.legalName,
      address: w.company.snapshot().profile.address,
      phone: w.company.snapshot().profile.phone,
      email: w.company.snapshot().profile.email,
    };
    if (codOnly && !historical) {
      // Harga pada checkout sudah final; stok ditahan ketika pesanan dibuat.
      order.codFixedTotal = true;
      order.shipping = {
        id: 'regular',
        label: 'Pengiriman gratis',
        cost: 0,
        quoted: true,
        simulation: false,
      };
      order.total = order.subtotal;
      order.payment.simulation = false;
      order.payment.status = 'pay_on_delivery';
      order.status = 'processing';
      delete order.codConfirmation;
      delete order.review;
      order.whatsapp.simulation = false;
      order.whatsapp.deliveryMode = 'manual';
      return order;
    }
    order.shipping = {
      id: order.shipping.id,
      label: 'Ongkir dikonfirmasi toko',
      cost: 0,
      quoted: false,
      simulation: false,
    };
    order.total = order.subtotal;
    order.payment.simulation = false;
    const deadline = w.now() + w.policy.reviewWindowMs;
    if (order.review) order.review.expiresAt = deadline;
    if (order.codConfirmation) order.codConfirmation.expiresAt = deadline;
    order.whatsapp.simulation = false;
    order.whatsapp.deliveryMode = 'manual';
    return order;
  };
  w.updateCommerce = (user, order, body, time) => {
    const action = body.action;
    if (order.commerceVersion !== 31) return null;
    if (['confirm_cod', 'approve_payment'].includes(action)) {
      if (user.role !== 'admin')
        fail('Hanya admin yang dapat menetapkan penawaran.', 403, 'forbidden');
      if (!['awaiting_confirmation', 'awaiting_review'].includes(order.status))
        fail('Pesanan tidak lagi menunggu pemeriksaan.', 409, 'invalid_status');
      if (!money(body.shippingCost))
        fail('Isi ongkir akhir dalam rupiah, termasuk 0 untuk pengambilan gratis.');
      const courier = field(body.courier, 'Kurir atau metode penyerahan');
      // Check every item before writing any reservation, under the same writer transaction.
      if (
        order.inventory.some(
          (row) =>
            (db.prepare('SELECT available FROM inventory WHERE stock_key=?').get(row.key)
              ?.available || 0) < row.units,
        )
      ) {
        order.status = 'cancelled';
        order.payment.status = 'cancelled';
        order.cancelledAt = time;
        order.cancellationReason =
          'Stok tidak cukup saat diperiksa toko. Silakan pilih jumlah lain atau hubungi toko.';
        order.reviewOutcome = 'stock_unavailable';
        return { order, kind: 'orderCancelled' };
      }
      const profile = w.company.snapshot().profile;
      if (order.payment.groupId !== 'cod') {
        if (!profile.bankName || !profile.bankAccount || !profile.bankHolder)
          fail('Lengkapi rekening tujuan di Pengaturan perusahaan sebelum menyetujui transfer.');
        order.payment.destination = {
          bank: profile.bankName,
          account: profile.bankAccount,
          holder: profile.bankHolder,
          instructions: profile.bankInstructions,
        };
      }
      w.reserve(order, user.id);
      order.shipping = {
        ...order.shipping,
        cost: body.shippingCost,
        courier,
        label: courier,
        quoted: true,
      };
      order.total = order.subtotal + body.shippingCost;
      order.quote = {
        createdAt: time,
        createdBy: user.id,
        expiresAt: time + w.policy.quoteHoldWindowMs,
      };
      order.status = 'awaiting_acceptance';
      order.payment.status = 'pending_acceptance';
      delete order.payment.expiresAt;
      if (order.review) order.review = { ...order.review, approvedAt: time, approvedBy: user.id };
      if (order.codConfirmation)
        order.codConfirmation = {
          ...order.codConfirmation,
          confirmedAt: time,
          confirmedBy: user.id,
        };
      return { order, kind: 'quoteReady' };
    }
    if (action === 'accept_quote') {
      if (user.id !== order.userId)
        fail('Hanya pemilik pesanan yang dapat menyetujui total.', 403, 'forbidden');
      if (!identity.verified(user.id))
        fail(
          'Konfirmasi email akun sebelum menyetujui penawaran.',
          403,
          'email_verification_required',
        );
      if (order.status !== 'awaiting_acceptance' || order.quote.expiresAt <= time)
        fail('Penawaran tidak lagi tersedia.', 409, 'invalid_status');
      order.quote.acceptedAt = time;
      if (order.payment.groupId === 'cod') {
        order.status = 'processing';
        order.payment.status = 'pay_on_delivery';
      } else {
        order.status = 'awaiting_payment';
        order.payment.status = 'pending';
        order.payment.expiresAt = Math.min(
          time + w.policy.paymentHoldWindowMs,
          order.quote.expiresAt,
        );
      }
      return { order, kind: order.payment.groupId === 'cod' ? 'codConfirmed' : 'orderApproved' };
    }
    if (action === 'submit_proof') {
      if (order.b2b
        ? user.role === 'admin' || !w.b2bCanRead?.(user, order.b2b.storeId)
        : user.id !== order.userId)
        fail('Hanya pembeli toko atau Sales berizin yang dapat mengunggah bukti.', 403, 'forbidden');
      if (
        (order.b2b ? order.status !== 'processing' : order.status !== 'awaiting_payment') ||
        order.payment.groupId === 'cod' ||
        order.payment.status === 'proof_submitted' ||
        order.payment.status === 'paid' ||
        (!order.b2b && order.payment.expiresAt <= time)
      )
        fail('Pesanan tidak menerima bukti pembayaran saat ini.', 409, 'invalid_status');
      if ((order.payment.proofAttempts || 0) >= 3)
        fail(
          'Batas unggah bukti tercapai. Hubungi toko untuk pemeriksaan lanjutan.',
          409,
          'proof_limit',
        );
      const value = photo(body.image);
      if (!value) fail('Pilih bukti JPG, PNG, atau WebP maksimal 1 MB.');
      const [, mime, encoded] = value.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
      const bytes = Buffer.from(encoded, 'base64');
      const hash = createHash('sha256').update(order.id).update(bytes).digest('hex');
      db.prepare('INSERT OR IGNORE INTO payment_proofs VALUES(?,?,?,?,?)').run(
        hash,
        order.id,
        mime,
        bytes,
        time,
      );
      order.payment.proof = {
        id: hash,
        url: '/api/orders/' + encodeURIComponent(order.id) + '/proof/' + hash,
        submittedAt: time,
        status: 'pending',
      };
      order.payment.proofAttempts = (order.payment.proofAttempts || 0) + 1;
      order.payment.status = 'proof_submitted';
      return { order, kind: 'proofSubmitted' };
    }
    if (action === 'reject_proof') {
      if (user.role !== 'admin') fail('Hanya admin yang dapat memeriksa bukti.', 403, 'forbidden');
      if ((order.b2b ? order.status !== 'processing' : order.status !== 'awaiting_payment') || order.payment.status !== 'proof_submitted')
        fail('Tidak ada bukti menunggu pemeriksaan.', 409, 'invalid_status');
      order.payment.proof = {
        ...order.payment.proof,
        status: 'rejected',
        reason: field(body.reason, 'Alasan penolakan', 200),
      };
      order.payment.status = 'pending';
      if (!order.b2b) order.payment.expiresAt = time + w.policy.paymentHoldWindowMs;
      delete order.payment.remindedAt;
      return { order, kind: 'proofRejected' };
    }
    return null;
  };
  // Existing unpaid requests receive a usable new quote rather than an unusable VA instruction.
  db.exec('CREATE TABLE IF NOT EXISTS commerce_v31_migrations(id INTEGER PRIMARY KEY CHECK(id=1))');
  if (!db.prepare('SELECT id FROM commerce_v31_migrations WHERE id=1').get())
    w.transaction(() => {
      for (const row of db
        .prepare(
          "SELECT data FROM orders WHERE status IN ('awaiting_payment','awaiting_review','awaiting_confirmation')",
        )
        .all()) {
        let order = JSON.parse(row.data);
        if (order.commerceVersion === 31 || order.payment.status === 'paid') continue;
        const previous = { payment: order.payment.label, total: order.total };
        w.release(order, 'quote_migration', null);
        if (order.payment.groupId !== 'cod') {
          order.payment = {
            id: 'manual-transfer',
            groupId: 'transfer',
            provider: 'BANK',
            label: 'Transfer bank toko',
            status: 'pending_review',
            simulation: false,
          };
          order.status = 'awaiting_review';
          order.review = { expiresAt: w.now() + w.policy.reviewWindowMs };
        } else {
          order.status = 'awaiting_confirmation';
          order.payment.status = 'pay_on_delivery';
          order.codConfirmation = { expiresAt: w.now() + w.policy.reviewWindowMs };
        }
        order.inventoryReserved = false;
        order.inventoryReleased = false;
        // Historical unpaid VA/transfer orders retain their original review workflow.
        // Applying the new COD-only checkout policy here would silently change an old order.
        order = w.prepareOrder(order, { historical: true });
        order.migratedQuote = { ...previous, at: w.now() };
        order.revision++;
        order = withNotificationEvent(order, 'orderCreated', w.now());
        w.writeOrder(order);
        messages.enqueue(order, 'orderCreated', w.now());
      }
      db.prepare('INSERT INTO commerce_v31_migrations VALUES(1)').run();
    });
  w.proof = (user, id, hash) => {
    w.owned(user, id);
    const row = db
      .prepare('SELECT mime,bytes FROM payment_proofs WHERE order_id=? AND id=?')
      .get(id, hash);
    if (!row) fail('Bukti pembayaran tidak ditemukan.', 404, 'not_found');
    return row;
  };
  w.paymentReminders = () => {
    for (const row of db
      .prepare("SELECT data FROM orders WHERE status IN ('awaiting_payment','awaiting_acceptance')")
      .all()) {
      let order = JSON.parse(row.data);
      if (order.commerceVersion !== 31 || order.payment.status === 'proof_submitted') continue;
      const deadline =
        order.status === 'awaiting_acceptance' ? order.quote.expiresAt : order.payment.expiresAt;
      if (
        deadline - w.now() > 300000 ||
        deadline <= w.now() ||
        order.payment.remindedFor === deadline
      )
        continue;
      order.payment.remindedFor = deadline;
      order = withNotificationEvent(order, 'paymentReminder', w.now());
      w.writeOrder(order);
      messages.enqueue(order, 'paymentReminder', w.now());
    }
  };
}
