import { useRef, useState } from 'react';
import { changeServerOrder, loadMoreOrders } from '../state/serverWorkflow';
import useUnsavedChanges from '../state/useUnsavedChanges';
import useWorkflow from '../state/useWorkflow';
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
  { id: 'all', label: 'Semua' }, { id: 'awaiting_payment', label: 'Menunggu pembayaran' },
  { id: 'processing', label: 'Diproses' }, { id: 'shipped', label: 'Dikirim' },
  { id: 'completed', label: 'Selesai' }, { id: 'cancelled', label: 'Dibatalkan' }, { id: 'expired', label: 'Kedaluwarsa' },
];

export default function AdminOrdersPage() {
  const { orders, failed, loading, server, nextCursor } = useWorkflow('admin');
  const [busy, setBusy] = useState(false); const pending = useRef(false); const [reference, setReference] = useState('');
  useUnsavedChanges(false, undefined, busy);
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('all');
  const [target, setTarget] = useState(null); const [cancelTarget, setCancelTarget] = useState(null);
  const [courier, setCourier] = useState(''); const [trackingNumber, setTrackingNumber] = useState('');
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const visible = orders.filter((order) => (filter === 'all' || (order.status || 'processing') === filter) && `${order.id} ${order.recipient} ${order.items.map((item) => `${item.name} ${item.id}`).join(' ')}`.toLocaleLowerCase('id').includes(query.trim().toLocaleLowerCase('id')));
  const openAction = (order, action) => { setTarget({ order, action }); setCourier(''); setTrackingNumber(''); setReference(''); setError(''); };
  const confirm = async () => {
    if (pending.current) return; pending.current = true; setBusy(true);
    const result = server ? await changeServerOrder(target.order.id, target.action, { courier, trackingNumber, reference }, target.order.revision) : updatePreviewOrder(target.order.id, target.action, window.sessionStorage, { courier, trackingNumber });
    pending.current = false; setBusy(false);
    if (result.error) { setError(result.error); return; }
    setNotice(`Pesanan ${result.order.id}: ${orderStatusLabel(result.order)}. ${server ? 'Perubahan tersimpan di server.' : 'Perubahan simulasi tersimpan.'}`); setTarget(null);
  };
  return <section className="admin-panel workflow-admin-orders">
    <div className="admin-panel-heading"><div><h2>Pesanan toko</h2><p>{server ? 'Kelola pesanan pelanggan, catatan pembayaran, dan resi pengiriman.' : 'Kelola status pesanan, pembayaran, dan resi pada pratinjau frontend.'}</p></div><span className="admin-result-pill">{orders.length} pesanan</span></div>
    <p className="workflow-preview">{server ? 'Pesanan tersimpan di database dan terhubung ke akun pelanggan. Pembayaran dicatat admin setelah diperiksa; layanan pembayaran dan kurir belum terhubung otomatis.' : 'Simulasi di tab browser ini. Pesanan belum tersimpan ke server. Perubahan di sini langsung terlihat pada detail pesanan pembeli di tab yang sama.'}</p>
    <div className="workflow-filters"><div className="admin-field"><label htmlFor="admin-order-search">Cari pesanan</label><input id="admin-order-search" type="search" maxLength={200} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nomor pesanan, penerima, produk, atau SKU" /></div><div className="admin-field"><label htmlFor="admin-order-status">Status pesanan</label><select id="admin-order-status" value={filter} onChange={(event) => setFilter(event.target.value)}>{ORDER_FILTERS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div></div>
    {notice && <p className="workflow-notice" role="status">{notice}</p>}
    {failed || loading ? <div className="admin-empty" role="alert"><h3>{loading ? 'Memuat pesanan…' : 'Pesanan belum dapat dibuka'}</h3><p>{server ? 'Periksa koneksi server dan muat ulang halaman.' : 'Penyimpanan browser tidak tersedia. Coba muat ulang halaman.'}</p></div> : !visible.length ? <div className="admin-empty"><h3>{orders.length ? 'Pesanan tidak ditemukan' : 'Belum ada pesanan'}</h3><p>{orders.length ? 'Ubah kata pencarian atau status pesanan.' : 'Buat pesanan melalui checkout untuk mencoba halaman ini.'}</p>{orders.length ? <button className="admin-secondary" onClick={() => { setQuery(''); setFilter('all'); }}>Reset filter</button> : <a className="admin-primary" href="#/cari?q=">Buka katalog toko</a>}</div> : <ul className="workflow-order-list">{visible.map((order) => <li key={order.id} className="workflow-order-card">
      <header><div><h3>{order.id}</h3><p>{dateLabel(order.createdAt)} · {order.recipient}</p></div><span className={'workflow-badge status-' + order.status}>{orderStatusLabel(order)}</span></header>
      <div className="workflow-order-summary"><span>{order.items.reduce((sum, item) => sum + item.quantity, 0)} kemasan · {order.payment.label}</span><strong>{rupiah(order.total)}</strong></div>
      <details className="workflow-order-details"><summary>Lihat barang dan pengiriman</summary><ul>{order.items.map((item) => { const display = orderItemPresentation(item); return <li key={item.id}><ProductImage product={display.product} variant="thumbnail" /><div><strong>{display.name}</strong><small>{item.id} · {display.sizeLabel || 'Ukuran belum tercatat'}</small><PackagingSummary packaging={display.packaging} quantity={item.quantity} /><span>{item.quantity} × {rupiah(item.price)}</span></div></li>; })}</ul><p><strong>Penerima:</strong> {order.recipient}<br /><strong>Alamat:</strong> {order.address}<br /><strong>Pengiriman:</strong> {order.shipping.label}</p>{order.note && <p><strong>Catatan:</strong> {order.note}</p>}{order.shipping.trackingNumber && <p><strong>Kurir:</strong> {order.shipping.courier}<br /><strong>Resi:</strong> {order.shipping.trackingNumber}</p>}{order.cancellationReason && <p><strong>Alasan pembatalan:</strong> {order.cancellationReason}</p>}</details>
      <div className="workflow-actions"><a className="admin-secondary" href={'#/pesanan/' + encodeURIComponent(order.id)}>Detail di toko</a>
        {order.status === 'awaiting_payment' && paymentMethod(order.payment.id) && <button className="admin-primary" onClick={() => openAction(order, 'paid')}>{server ? 'Catat pembayaran manual' : 'Catat pembayaran simulasi'}</button>}
        {(order.status || 'processing') === 'processing' && (isCOD(order) || order.payment.status === 'paid') && <button className="admin-primary" onClick={() => openAction(order, 'ship')}>{server ? 'Catat pengiriman' : 'Kirim pesanan simulasi'}</button>}
        {order.status === 'shipped' && <button className="admin-primary" onClick={() => openAction(order, 'complete')}>{server ? 'Selesaikan pesanan' : 'Selesaikan pesanan simulasi'}</button>}
        {!cancellationReason(order) && <button className="bam-button-danger" onClick={() => setCancelTarget(order)}>Batalkan pesanan</button>}
      </div>
    </li>)}</ul>}
    {nextCursor && <button type="button" className="admin-secondary" onClick={async () => { const result = await loadMoreOrders(true); if (result.error) setNotice(result.error); }}>Muat pesanan lebih lama</button>}
    {target && <ConfirmDialog busy={busy} danger={false} title={target.action === 'ship' ? server ? 'Catat pengiriman' : 'Catat pengiriman simulasi' : target.action === 'complete' ? 'Selesaikan pesanan?' : server ? 'Catat pembayaran manual?' : 'Catat pembayaran simulasi?'} confirmLabel={server ? 'Simpan perubahan' : 'Simpan status simulasi'} onConfirm={confirm} onClose={() => setTarget(null)} error={error}><p>Pesanan {target.order.id}. {server ? 'Pastikan informasi pembayaran atau pengiriman telah diperiksa sebelum mencatatnya.' : 'Perubahan ini hanya untuk pratinjau, tanpa pembayaran atau pengiriman nyata.'}</p>{server && target.action === 'paid' && <label htmlFor="payment-reference">Referensi pembayaran yang sudah diperiksa<input id="payment-reference" maxLength={100} value={reference} disabled={busy} onChange={(event) => { setReference(event.target.value); setError(''); }} /></label>}{target.action === 'ship' && <><label htmlFor="shipment-courier">Nama kurir<input id="shipment-courier" maxLength={100} value={courier} aria-invalid={Boolean(error) && !courier.trim()} onChange={(event) => { setCourier(event.target.value); setError(''); }} /></label><label htmlFor="shipment-tracking">Nomor resi<input id="shipment-tracking" maxLength={100} value={trackingNumber} aria-invalid={Boolean(error) && !trackingNumber.trim()} onChange={(event) => { setTrackingNumber(event.target.value); setError(''); }} /></label></>}</ConfirmDialog>}
    {cancelTarget && <CancelOrderDialog order={cancelTarget} onClose={() => setCancelTarget(null)} onCancelled={() => setNotice(server ? 'Pesanan dibatalkan. Stok dikembalikan di server.' : 'Pesanan dibatalkan. Stok simulasi telah dilepas.')} />}
  </section>;
}
