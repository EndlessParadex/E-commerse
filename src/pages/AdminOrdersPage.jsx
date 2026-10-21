import CommerceReadiness from './CommerceReadiness';
import useCompany from '../state/useCompany';
import { useRef, useState } from 'react';
import { changeServerOrder } from '../state/serverWorkflow';
import useUnsavedChanges from '../state/useUnsavedChanges';
import useOrderSearch from '../state/useOrderSearch';
import { cancellationReason, orderStatusLabel } from '../state/orderModel';
import { isCOD, updatePreviewOrder } from '../state/frontendWorkflow';
import { paymentMethod } from '../state/paymentMethods';
import { dateLabel, rupiah } from '../components/shop/shopPresentation';
import { orderItemPresentation } from '../data/orderItemPresentation';
import ProductImage from '../components/shop/ProductImage';
import PackagingSummary from '../components/shop/PackagingSummary';
import ConfirmDialog from '../components/shop/ConfirmDialog';
import CancelOrderDialog from '../components/shop/CancelOrderDialog';
import '../styles/workflow.css';

const ORDER_FILTERS = [
  { id: 'awaiting_acceptance', label: 'Menunggu persetujuan total' },
  { id: 'all', label: 'Semua' },
  { id: 'awaiting_payment', label: 'Menunggu pembayaran' },
  { id: 'awaiting_confirmation', label: 'Menunggu konfirmasi COD' },
  { id: 'awaiting_review', label: 'Menunggu pemeriksaan toko' },
  { id: 'processing', label: 'Diproses' },
  { id: 'shipped', label: 'Dikirim' },
  { id: 'completed', label: 'Selesai' },
  { id: 'cancelled', label: 'Dibatalkan' },
  { id: 'expired', label: 'Kedaluwarsa' },
];

export default function AdminOrdersPage() {
  const company = useCompany();
  const [shippingCost, setShippingCost] = useState(''),
    [rejectionReason, setRejectionReason] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [reference, setReference] = useState('');
  useUnsavedChanges(false, undefined, busy);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const {
    orders,
    failed,
    loading,
    server,
    nextCursor,
    total,
    loadMore,
    moreBusy,
    pageError,
    error: loadError,
    retry,
  } = useOrderSearch('admin', query, filter);
  const [target, setTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [courier, setCourier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const visible = orders;
  const openAction = (order, action) => {
    setTarget({ order, action });
    setCourier(order.shipping.courier || '');
    setShippingCost('');
    setRejectionReason('');
    setTrackingNumber('');
    setReference('');
    setError('');
  };
  const confirm = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    const result = server
      ? await changeServerOrder(
          target.order.id,
          target.action,
          {
            courier,
            trackingNumber,
            reference,
            shippingCost: shippingCost === '' ? null : Number(shippingCost),
            reason: rejectionReason,
          },
          target.order.revision,
        )
      : updatePreviewOrder(target.order.id, target.action, window.sessionStorage, {
          courier,
          trackingNumber,
        });
    pending.current = false;
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setNotice(
      `Pesanan ${result.order.id}: ${orderStatusLabel(result.order)}. ${server ? 'Perubahan tersimpan di server.' : 'Perubahan simulasi tersimpan.'}`,
    );
    setTarget(null);
  };
  return (
    <section className="admin-panel workflow-admin-orders">
      <div className="admin-panel-heading">
        <div>
          <h2>Pesanan toko</h2>
          <p>
            {server
              ? 'Kelola pesanan pelanggan, catatan pembayaran, dan resi pengiriman.'
              : 'Kelola status pesanan, pembayaran, dan resi pada pratinjau frontend.'}
          </p>
        </div>
        <span className="admin-result-pill">
          {loading ? 'Memuat…' : `${total ?? orders.length} pesanan`}
        </span>
      </div>
      {!loading && !failed && (
        <p className="workflow-preview">
          Menampilkan {orders.length} dari {total ?? orders.length} pesanan
          {query.trim() || filter !== 'all' ? ' yang sesuai filter' : ''}.
        </p>
      )}
      <p className="workflow-preview">
        {server
          ? 'Pesanan tersimpan di database dan terhubung ke akun pelanggan. Pembayaran dicatat admin setelah diperiksa; layanan pembayaran dan kurir belum terhubung otomatis.'
          : 'Simulasi di tab browser ini. Pesanan belum tersimpan ke server. Perubahan di sini langsung terlihat pada detail pesanan pembeli di tab yang sama.'}
      </p>
      {company.commerce?.version === 31 && <CommerceReadiness />}
      <div className="workflow-filters">
        <div className="admin-field">
          <label htmlFor="admin-order-search">Cari pesanan</label>
          <input
            id="admin-order-search"
            type="search"
            maxLength={200}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nomor pesanan, penerima, produk, atau SKU"
          />
        </div>
        <div className="admin-field">
          <label htmlFor="admin-order-status">Status pesanan</label>
          <select
            id="admin-order-status"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            {ORDER_FILTERS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {notice && (
        <p className="workflow-notice" role="status">
          {notice}
        </p>
      )}
      {failed || loading ? (
        <div className="admin-empty" role="alert">
          <h3>{loading ? 'Memuat pesanan…' : 'Pesanan belum dapat dibuka'}</h3>
          <p>
            {server
              ? loadError || 'Periksa koneksi server dan coba lagi.'
              : 'Penyimpanan browser tidak tersedia. Coba muat ulang halaman.'}
          </p>
          {!loading && server && (
            <button type="button" className="admin-secondary" onClick={retry}>
              Coba lagi
            </button>
          )}
        </div>
      ) : !visible.length ? (
        <div className="admin-empty">
          <h3>
            {query.trim() || filter !== 'all' ? 'Pesanan tidak ditemukan' : 'Belum ada pesanan'}
          </h3>
          <p>
            {query.trim() || filter !== 'all'
              ? 'Ubah kata pencarian atau status pesanan.'
              : 'Buat pesanan melalui checkout untuk mencoba halaman ini.'}
          </p>
          {query.trim() || filter !== 'all' ? (
            <button
              className="admin-secondary"
              onClick={() => {
                setQuery('');
                setFilter('all');
              }}
            >
              Reset filter
            </button>
          ) : (
            <a className="admin-primary" href="#/cari?q=">
              Buka katalog toko
            </a>
          )}
        </div>
      ) : (
        <ul className="workflow-order-list">
          {visible.map((order) => (
            <li key={order.id} className="workflow-order-card">
              <header>
                <div>
                  <h3>{order.id}</h3>
                  <p>
                    {dateLabel(order.createdAt)} · {order.recipient}
                  </p>
                </div>
                <span className={'workflow-badge status-' + order.status}>
                  {orderStatusLabel(order)}
                </span>
              </header>
              <div className="workflow-order-summary">
                <span>
                  {order.items.reduce((sum, item) => sum + item.quantity, 0)} kemasan ·{' '}
                  {order.payment.label}
                </span>
                <strong>{rupiah(order.total)}</strong>
              </div>
              {order.codFixedTotal && order.status === 'processing' && (
                <p className="workflow-preview">
                  Harga final sejak checkout · Gratis ongkir · COD saat diterima. Stok sudah
                  dicadangkan.
                </p>
              )}
              {order.status === 'awaiting_confirmation' && (
                <p className="workflow-preview">
                  {order.codConfirmation?.legacyReview
                    ? 'Pesanan COD lama perlu diperiksa kembali. '
                    : 'Periksa alamat dan kesiapan pesanan sebelum konfirmasi. '}
                  Batas konfirmasi: <strong>{dateLabel(order.codConfirmation.expiresAt)}</strong>.
                  Stok belum ditahan. Stok diperiksa dan ditahan ketika pesanan dikonfirmasi.
                </p>
              )}
              <details className="workflow-order-details">
                <summary>Lihat barang dan pengiriman</summary>
                <ul>
                  {order.items.map((item) => {
                    const display = orderItemPresentation(item);
                    return (
                      <li key={item.id}>
                        <ProductImage product={display.product} variant="thumbnail" />
                        <div>
                          <strong>{display.name}</strong>
                          <small>
                            {item.id} · {display.sizeLabel || 'Ukuran belum tercatat'}
                          </small>
                          <PackagingSummary
                            packaging={display.packaging}
                            quantity={item.quantity}
                          />
                          <span>
                            {item.quantity} × {rupiah(item.price)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p>
                  <strong>Penerima:</strong> {order.recipient}
                  <br />
                  <strong>Alamat:</strong> {order.address}
                  <br />
                  <strong>Pengiriman:</strong> {order.shipping.label}
                </p>
                {order.note && (
                  <p>
                    <strong>Catatan:</strong> {order.note}
                  </p>
                )}
                {order.shipping.trackingNumber && (
                  <p>
                    <strong>Kurir:</strong> {order.shipping.courier}
                    <br />
                    <strong>Resi:</strong> {order.shipping.trackingNumber}
                  </p>
                )}
                {order.cancellationReason && (
                  <p>
                    <strong>Alasan pembatalan:</strong> {order.cancellationReason}
                  </p>
                )}
              </details>
              {order.status === 'awaiting_review' && (
                <p className="workflow-preview">
                  Stok belum ditahan. Periksa permintaan pelanggan sebelum menyetujui dan memberikan
                  instruksi pembayaran. Batas pemeriksaan: {dateLabel(order.review.expiresAt)}.
                </p>
              )}
              <div className="workflow-actions">
                <a className="admin-secondary" href={'#/pesanan/' + encodeURIComponent(order.id)}>
                  Detail di toko
                </a>
                {server && order.status === 'awaiting_confirmation' && (
                  <button
                    className="admin-primary"
                    onClick={() => openAction(order, 'confirm_cod')}
                  >
                    Konfirmasi COD
                  </button>
                )}
                {server && order.status === 'awaiting_review' && (
                  <button
                    className="admin-primary"
                    onClick={() => openAction(order, 'approve_payment')}
                  >
                    Setujui untuk pembayaran
                  </button>
                )}
                {order.whatsapp?.optedIn && (
                  <a
                    className="admin-secondary"
                    href={
                      'https://wa.me/' +
                      order.whatsapp.number.replace(/\D/g, '') +
                      '?text=' +
                      encodeURIComponent(
                        'Informasi pesanan ' +
                          order.id +
                          ': silakan periksa detail pesanan dan email dari ' +
                          company.profile.shortName,
                      )
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Hubungi pembeli via WhatsApp
                  </a>
                )}
                {order.payment.proof && (
                  <a
                    className="admin-secondary"
                    href={order.payment.proof.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Periksa bukti transfer
                  </a>
                )}
                {order.payment.status === 'proof_submitted' && (
                  <button
                    className="bam-button-danger"
                    onClick={() => openAction(order, 'reject_proof')}
                  >
                    Minta perbaikan bukti
                  </button>
                )}
                {order.status === 'awaiting_payment' && paymentMethod(order.payment.id) && (
                  <button className="admin-primary" onClick={() => openAction(order, 'paid')}>
                    {server ? 'Catat pembayaran manual' : 'Catat pembayaran simulasi'}
                  </button>
                )}
                {(order.status || 'processing') === 'processing' &&
                  (isCOD(order) || order.payment.status === 'paid') && (
                    <button className="admin-primary" onClick={() => openAction(order, 'ship')}>
                      {server ? 'Catat pengiriman' : 'Kirim pesanan simulasi'}
                    </button>
                  )}
                {order.status === 'shipped' && (
                  <button className="admin-primary" onClick={() => openAction(order, 'complete')}>
                    {server ? 'Selesaikan pesanan' : 'Selesaikan pesanan simulasi'}
                  </button>
                )}
                {!cancellationReason(order) && (
                  <button className="bam-button-danger" onClick={() => setCancelTarget(order)}>
                    Batalkan pesanan
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {pageError && (
        <p className="shop-warning" role="alert">
          {pageError}
        </p>
      )}
      {nextCursor && (
        <button
          type="button"
          className="admin-secondary"
          disabled={moreBusy || loading}
          onClick={loadMore}
        >
          {moreBusy ? 'Memuat…' : 'Muat pesanan lebih lama'}
        </button>
      )}
      {target && (
        <ConfirmDialog
          busy={busy}
          danger={false}
          title={
            target.order.commerceVersion === 31 &&
            ['approve_payment', 'confirm_cod'].includes(target.action)
              ? 'Tetapkan total dan kirim penawaran?'
              : target.action === 'reject_proof'
                ? 'Minta perbaikan bukti pembayaran?'
                : target.action === 'approve_payment'
                  ? 'Setujui dan tahan stok untuk pembayaran?'
                  : target.action === 'confirm_cod'
                    ? 'Konfirmasi pesanan COD?'
                    : target.action === 'ship'
                      ? server
                        ? 'Catat pengiriman'
                        : 'Catat pengiriman simulasi'
                      : target.action === 'complete'
                        ? 'Selesaikan pesanan?'
                        : server
                          ? 'Catat pembayaran manual?'
                          : 'Catat pembayaran simulasi?'
          }
          confirmLabel={server ? 'Simpan perubahan' : 'Simpan status simulasi'}
          onConfirm={confirm}
          onClose={() => setTarget(null)}
          error={error}
        >
          <p>
            Pesanan {target.order.id}.{' '}
            {target.action === 'approve_payment'
              ? 'Periksa alamat, stok, ongkir dan rekening toko. Pelanggan akan menerima total akhir untuk disetujui sebelum pembayaran dimulai.'
              : target.action === 'confirm_cod'
                ? 'Pastikan alamat dan pesanan sudah diperiksa. Setelah dikonfirmasi, toko bertanggung jawab menyiapkan atau membatalkan pesanan. Pembayaran tetap dilakukan saat barang diterima.'
                : server
                  ? 'Pastikan informasi pembayaran atau pengiriman telah diperiksa sebelum mencatatnya.'
                  : 'Perubahan ini hanya untuk pratinjau, tanpa pembayaran atau pengiriman nyata.'}
          </p>
          {target.order.commerceVersion === 31 &&
            ['approve_payment', 'confirm_cod'].includes(target.action) && (
              <>
                <label htmlFor="quote-shipping-cost">
                  Ongkir akhir (Rp)
                  <input
                    id="quote-shipping-cost"
                    type="number"
                    min="0"
                    max="1000000000"
                    step="1"
                    value={shippingCost}
                    onChange={(event) => setShippingCost(event.target.value)}
                  />
                </label>
                <label htmlFor="quote-courier">
                  Kurir atau metode penyerahan
                  <input
                    id="quote-courier"
                    maxLength={100}
                    value={courier}
                    onChange={(event) => setCourier(event.target.value)}
                  />
                </label>
                <p>
                  Pelanggan menyetujui total akhir sebelum pembayaran. Reservasi penawaran awal
                  berlaku paling lama 24 jam.
                </p>
              </>
            )}
          {target.action === 'reject_proof' && (
            <label htmlFor="proof-rejection-reason">
              Alasan dan petunjuk perbaikan
              <input
                id="proof-rejection-reason"
                maxLength={200}
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
              />
            </label>
          )}
          {server && target.action === 'paid' && (
            <label htmlFor="payment-reference">
              Referensi pembayaran yang sudah diperiksa
              <input
                id="payment-reference"
                maxLength={100}
                value={reference}
                disabled={busy}
                onChange={(event) => {
                  setReference(event.target.value);
                  setError('');
                }}
              />
            </label>
          )}
          {target.action === 'ship' && (
            <>
              <label htmlFor="shipment-courier">
                Nama kurir
                <input
                  id="shipment-courier"
                  maxLength={100}
                  value={courier}
                  aria-invalid={Boolean(error) && !courier.trim()}
                  onChange={(event) => {
                    setCourier(event.target.value);
                    setError('');
                  }}
                />
              </label>
              <label htmlFor="shipment-tracking">
                Nomor resi
                <input
                  id="shipment-tracking"
                  maxLength={100}
                  value={trackingNumber}
                  aria-invalid={Boolean(error) && !trackingNumber.trim()}
                  onChange={(event) => {
                    setTrackingNumber(event.target.value);
                    setError('');
                  }}
                />
              </label>
            </>
          )}
        </ConfirmDialog>
      )}
      {cancelTarget && (
        <CancelOrderDialog
          order={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onCancelled={() =>
            setNotice(
              server
                ? 'Pesanan dibatalkan. Stok dikembalikan di server.'
                : 'Pesanan dibatalkan. Stok simulasi telah dilepas.',
            )
          }
        />
      )}
    </section>
  );
}
