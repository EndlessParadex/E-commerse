import { useEffect, useRef, useState } from 'react';
import { changeServerOrder, uploadServerProof } from '../../state/serverWorkflow';
import { useDelivery } from '../../state/useDelivery';
import { dateLabel, rupiah } from './shopPresentation';
import './Commerce.css';
export default function CommercePayment({ order }) {
  const { user } = useDelivery();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const active = useRef(true),
    pending = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const perform = async (work) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await work();
      if (active.current && result.error) setError(result.error);
    } catch {
      if (active.current)
        setError('Perubahan belum dapat dipastikan. Muat status pesanan sebelum mencoba kembali.');
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  };
  const own = user?.id === order.userId,
    destination = order.payment.destination,
    proof = order.payment.proof,
    ended = ['cancelled', 'expired'].includes(order.status);
  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 1048576 ||
      !file.size
    ) {
      setError('Pilih JPG, PNG, atau WebP maksimal 1 MB.');
      return;
    }
    await perform(async () => {
      const image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('File belum dapat dibaca'));
        reader.readAsDataURL(file);
      });
      return uploadServerProof(order.id, image, order.revision);
    });
  };
  return (
    <section
      className="confirmation-card commerce-payment payment-details"
      aria-label="Pembayaran dan persetujuan total"
    >
      {order.migratedQuote && (
        <p className="shop-warning">
          Metode sebelumnya: {order.migratedQuote.payment}. Toko menyiapkan penawaran baru dengan
          metode yang tersedia. Periksa dan setujui total akhir sebelum melanjutkan.
        </p>
      )}
      <h2>{order.status === 'awaiting_acceptance' ? 'Setujui total akhir' : 'Pembayaran'}</h2>
      <strong>{order.payment.label}</strong>
      <dl className="commerce-summary">
        <div>
          <dt>Subtotal barang</dt>
          <dd>{rupiah(order.subtotal)}</dd>
        </div>
        <div>
          <dt>Ongkir</dt>
          <dd>{order.codFixedTotal ? 'GRATIS' : order.shipping.quoted ? rupiah(order.shipping.cost) : 'Dikonfirmasi toko'}</dd>
        </div>
        <div>
          <dt>{order.shipping.quoted ? 'Total akhir' : 'Subtotal sementara'}</dt>
          <dd>
            <strong>{rupiah(order.total)}</strong>
          </dd>
        </div>
      </dl>
      {ended ? (
        <p role="status">
          {order.status === 'cancelled'
            ? 'Pesanan dibatalkan. ' + (order.cancellationReason || '')
            : 'Batas waktu pesanan berakhir. Hubungi toko jika sudah melakukan transfer.'}
        </p>
      ) : order.status === 'awaiting_acceptance' ? (
        <>
          <p>
            Pengiriman: <strong>{order.shipping.courier}</strong>. Periksa total dan tujuan
            pengiriman sebelum melanjutkan.
          </p>
          <p>
            Stok ditahan sampai <strong>{dateLabel(order.quote.expiresAt)}</strong>.{' '}
            {order.payment.groupId === 'cod'
              ? 'Bayar saat barang diterima.'
              : 'Waktu pembayaran dimulai setelah Anda menyetujui total ini, paling lama 30 menit dan tetap dibatasi akhir reservasi.'}
          </p>
          {own && (
            <button
              type="button"
              className="shop-primary"
              disabled={busy}
              onClick={() =>
                perform(() => changeServerOrder(order.id, 'accept_quote', {}, order.revision))
              }
            >
              {busy
                ? 'Menyimpan…'
                : order.payment.groupId === 'cod'
                  ? 'Setujui total COD'
                  : 'Setujui dan lanjutkan pembayaran'}
            </button>
          )}
        </>
      ) : ['awaiting_review', 'awaiting_confirmation'].includes(order.status) ? (
        <p>
          Toko memeriksa stok dan ongkir. Permintaan ini belum menjamin ketersediaan atau menahan
          stok. Anda akan diberi tahu melalui email setelah toko menetapkan total akhir.
        </p>
      ) : order.payment.status === 'paid' ? (
        <p role="status">
          Pembayaran telah diperiksa dan dicatat toko.{' '}
          {order.payment.reference && 'Referensi: ' + order.payment.reference}
        </p>
      ) : order.payment.groupId === 'cod' ? (
        <p>Bayar {rupiah(order.total)} saat barang diterima. Harga final sejak checkout.</p>
      ) : (
        <>
          {destination && (
            <div className="commerce-bank">
              <h3>Rekening tujuan</h3>
              <p>
                {destination.bank}
                <br />
                <strong className="commerce-account-number">{destination.account}</strong>
                <br />
                a.n. {destination.holder}
              </p>
              {destination.instructions && <p>{destination.instructions}</p>}
              <p>
                Transfer tepat {rupiah(order.total)}. Toko memeriksa dana sebelum menyatakan
                pembayaran diterima.
              </p>
            </div>
          )}
          {proof?.status === 'pending' ? (
            <p role="status">
              Bukti pembayaran sedang diperiksa toko. Pesanan tidak dibatalkan otomatis selama
              pemeriksaan bukti. Unggah bukti bukan konfirmasi bahwa pembayaran diterima.
            </p>
          ) : (
            <>
              <p>
                Batas pembayaran: <strong>{dateLabel(order.payment.expiresAt)}</strong>. Jika sudah
                mentransfer tetapi mengalami kendala, hubungi toko dan simpan buktinya.
              </p>
              {proof?.status === 'rejected' && (
                <p className="workflow-error" role="alert">
                  Bukti perlu diperbaiki: {proof.reason}
                </p>
              )}
              {own && destination && (
                <label className="commerce-upload">
                  Unggah bukti transfer (JPG, PNG, WebP · maks. 1 MB)
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={busy}
                    onChange={upload}
                  />
                </label>
              )}
            </>
          )}
          {proof && (
            <a href={proof.url} target="_blank" rel="noopener noreferrer">
              Lihat bukti pembayaran
            </a>
          )}
        </>
      )}
      {error && (
        <p className="workflow-error" role="alert">
          {error}
        </p>
      )}
      <p className="commerce-help">
        Periksa email dan folder spam untuk pembaruan. Status terbaru juga tersedia pada Pesanan
        saya.
      </p>
    </section>
  );
}
