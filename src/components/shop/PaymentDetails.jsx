import CommercePayment from './CommercePayment';
import { paymentInstructions, paymentMethod } from '../../state/paymentMethods';
import { rupiah } from './shopPresentation';
import './PaymentPicker.css';
import { dateLabel } from './shopPresentation';

export default function PaymentDetails({ order, showContinue = true }) {
  if (order.commerceVersion === 31) return <CommercePayment key={order.id} order={order} />;
  const server = order.storage === 'server';
  const cancelled = order.status === 'cancelled';
  const expired = order.status === 'expired';
  const paid = order.payment.status === 'paid';
  const failed = order.payment.status === 'failed';
  const cashOnDelivery =
    order.payment.groupId === 'cod' || /^(cod|bayar di tempat)$/i.test(order.payment.label);
  const canContinue =
    order.status === 'awaiting_payment' && Boolean(paymentMethod(order.payment.id));
  const waitingCOD = order.status === 'awaiting_confirmation';
  const status = cancelled
    ? 'Dibatalkan'
    : expired
      ? 'Kedaluwarsa'
      : paid
        ? 'Sudah dibayar'
        : failed
          ? 'Pembayaran gagal'
          : cashOnDelivery
            ? 'Bayar di tempat'
            : order.payment.id
              ? 'Belum dibayar'
              : 'Metode tercatat';
  const statusClass = cancelled
    ? 'is-cancelled'
    : expired
      ? 'is-expired'
      : paid
        ? 'is-paid'
        : failed
          ? 'is-failed'
          : cashOnDelivery
            ? 'is-cod'
            : '';
  return (
    <section className="confirmation-card payment-details" aria-labelledby="payment-details-title">
      <div className="payment-details-heading">
        <h2 id="payment-details-title">Pembayaran</h2>
        <span className={'payment-status' + (statusClass ? ' ' + statusClass : '')}>{status}</span>
      </div>
      <strong className="payment-method-name">{order.payment.label}</strong>
      <div className="payment-details-total">
        <span>Total pesanan</span>
        <strong>{rupiah(order.total)}</strong>
      </div>
      {cancelled ? (
        <p>Pesanan ini telah dibatalkan. Tidak ada pembayaran yang perlu dilakukan.</p>
      ) : expired ? (
        <p>
          {cashOnDelivery
            ? 'Batas konfirmasi COD telah berakhir.'
            : order.review && order.review.approvedAt === undefined
              ? 'Batas pemeriksaan pesanan telah berakhir.'
              : 'Batas pembayaran telah berakhir.'}{' '}
          {server
            ? order.inventoryReleased
              ? 'Stok telah dikembalikan di server.'
              : 'Permintaan ini tidak menahan stok.'
            : 'Stok simulasi telah dilepas.'}{' '}
          Buat pesanan baru jika ingin melanjutkan belanja.
        </p>
      ) : order.status === 'awaiting_review' ? (
        <p role="status">
          Toko sedang memeriksa permintaan pesanan. Stok belum ditahan dan instruksi pembayaran
          belum dikonfirmasi. Tunggu persetujuan toko sebelum membayar.
        </p>
      ) : paid ? (
        <p role="status">
          Pembayaran{' '}
          {server && !order.payment.simulation
            ? 'manual telah dicatat oleh admin.'
            : 'simulasi berhasil dicatat.'}{' '}
          {order.payment.paidAt ? dateLabel(order.payment.paidAt) : ''}
        </p>
      ) : (
        <>
          {server && !cashOnDelivery ? (
            <p>
              Instruksi pembayaran belum diterbitkan oleh aplikasi. Hubungi pengelola toko untuk
              instruksi resmi yang sudah dikonfirmasi.
            </p>
          ) : (
            <ol>
              {paymentInstructions(order.payment).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}
          {failed && (
            <p className="workflow-error" role="alert">
              Percobaan pembayaran gagal. Anda dapat mencoba kembali sebelum batas pembayaran.
            </p>
          )}
          {canContinue && order.payment.expiresAt && (
            <p>
              Batas pembayaran: <strong>{dateLabel(order.payment.expiresAt)}</strong>
            </p>
          )}
          {canContinue && showContinue && (
            <a
              className="shop-primary payment-continue"
              href={'#/pesanan/' + encodeURIComponent(order.id) + '/pembayaran'}
            >
              {failed ? 'Coba pembayaran kembali' : 'Lanjutkan pembayaran'}
            </a>
          )}
        </>
      )}
      <p className="payment-preview-note">
        {server
          ? 'Pesanan tersimpan di server. Aplikasi belum memproses pembayaran otomatis.'
          : 'Pesanan dan pembayaran ini masih simulasi. Tidak ada dana yang diproses.'}
      </p>
      {waitingCOD && (
        <p className="workflow-preview" role="status">
          Pesanan menunggu konfirmasi toko hingga{' '}
          <strong>{dateLabel(order.codConfirmation.expiresAt)}</strong>. Stok baru ditahan setelah
          konfirmasi toko. Pembayaran dilakukan saat barang diterima.
        </p>
      )}
      {order.status === 'awaiting_payment' && !canContinue && (
        <p className="workflow-error" role="status">
          Metode pembayaran lama ini tidak lagi tersedia. Batalkan pesanan dan pilih metode lain
          pada checkout.
        </p>
      )}
    </section>
  );
}
