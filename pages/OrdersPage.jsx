import { useState } from 'react';
import PackagingSummary from '../components/shop/PackagingSummary';
import { orderItemPresentation } from '../data/orderItemPresentation';
import { orderStatus, orderStatusLabel, cancellationReason } from '../state/orderModel';
import useWorkflow from '../state/useWorkflow';
import { dateLabel, rupiah } from '../components/shop/shopPresentation';
import ProductImage from '../components/shop/ProductImage';
import './OrdersPage.css';
import '../components/shop/OrderItem.css';
import CancelOrderDialog from '../components/shop/CancelOrderDialog';

export default function OrdersPage() {
  const { orders, failed } = useWorkflow();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const visibleOrders = orders.filter((order) => (filter === 'all' || (filter === 'active' ? ['awaiting_payment', 'processing', 'shipped'].includes(orderStatus(order)) : orderStatus(order) === filter)) && `${order.id} ${order.items.map((item) => item.name).join(' ')}`.toLocaleLowerCase('id').includes(query.trim().toLocaleLowerCase('id')));

  return <div className="orders-page">
    <nav className="shop-breadcrumb" aria-label="Breadcrumb"><a href="#/">Beranda</a><span aria-hidden="true">/</span><span aria-current="page">Pesanan saya</span></nav>
    <header className="orders-heading"><div><span className="section-eyebrow">Aktivitas belanja</span><h1>Pesanan saya</h1><p>{orders.length} pesanan simulasi</p></div><a className="orders-shopping-link" href="#/">Lanjut berbelanja →</a></header>
    <p className="orders-notice">Pesanan masih simulasi dan tersimpan sementara di tab browser ini. Riwayat dan pembatalan bertahan setelah muat ulang, tetapi belum terhubung ke akun atau toko. Menutup tab dapat menghapus riwayat.</p>
    {!!orders.length && <><div className="admin-field"><label htmlFor="buyer-order-search">Cari pesanan</label><input id="buyer-order-search" type="search" maxLength={200} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nomor pesanan atau nama barang" /></div><div className="orders-filter" role="group" aria-label="Filter status pesanan">{[{ id: 'all', label: 'Semua' }, { id: 'active', label: 'Aktif' }, { id: 'awaiting_payment', label: 'Menunggu pembayaran' }, { id: 'processing', label: 'Diproses' }, { id: 'shipped', label: 'Dikirim' }, { id: 'completed', label: 'Selesai' }, { id: 'cancelled', label: 'Dibatalkan' }, { id: 'expired', label: 'Kedaluwarsa' }].map((item) => <button type="button" key={item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div></>}
    {failed ? <section className="orders-empty" role="alert"><h2>Riwayat belum dapat dibuka</h2><p>Penyimpanan browser tidak tersedia. Coba muat ulang halaman atau periksa pengaturan browser.</p><button className="shop-primary" type="button" onClick={() => window.location.reload()}>Coba lagi</button></section>
      : orders.length === 0 ? <section className="orders-empty"><span aria-hidden="true">📦</span><h2>Belum ada pesanan</h2><p>Pesanan yang dibuat melalui checkout akan muncul di sini.</p><a className="shop-primary" href="#/">Mulai berbelanja</a></section>
        : !visibleOrders.length ? <section className="orders-empty"><h2>Belum ada pesanan pada pilihan ini</h2><button type="button" className="bam-button-secondary" onClick={() => { setFilter('all'); setQuery(''); }}>Lihat semua pesanan</button></section> : <ul className="orders-list">{visibleOrders.map((order) => <li key={order.id} className="orders-card">
          <div className="orders-card-header"><div><strong className="orders-number">{order.id}</strong><time dateTime={new Date(order.createdAt).toISOString()}>{dateLabel(order.createdAt)}</time></div><span className={'orders-status status-' + orderStatus(order)}>{orderStatusLabel(order)} · Simulasi</span></div>
          <ul className="orders-products">{order.items.slice(0, 2).map((item) => {
            const display = orderItemPresentation(item);
            return <li key={item.id}><ProductImage product={display.product} variant="thumbnail" /><div>{display.brand && <span className="order-item-brand">{display.brand}</span>}<strong>{display.name}</strong><span className="order-item-size">{display.sizeLabel ? `Ukuran ${display.sizeLabel}` : 'Ukuran belum tercatat'}</span><PackagingSummary packaging={display.packaging} quantity={item.quantity} /><span>{item.quantity} × {rupiah(item.price)}</span><strong className="order-item-subtotal">Subtotal {rupiah(item.price * item.quantity)}</strong></div></li>;
          })}</ul>
          {order.items.length > 2 && <p className="orders-more">+{order.items.length - 2} pilihan produk/kemasan lainnya</p>}
          <div className="orders-card-footer"><div><span>{['cancelled', 'expired'].includes(orderStatus(order)) ? 'Total pesanan' : 'Total pembayaran'}</span><strong>{rupiah(order.total)}</strong><small>Termasuk ongkir · {order.items.reduce((sum, item) => sum + item.quantity, 0)} kemasan</small></div><div className="orders-card-actions"><a className="shop-primary" href={'#/pesanan/' + encodeURIComponent(order.id)} aria-label={'Lihat detail pesanan ' + order.id}>Lihat detail <span aria-hidden="true">→</span></a>{orderStatus(order) === 'awaiting_payment' && <a className="bam-button-secondary" href={'#/pesanan/' + encodeURIComponent(order.id) + '/pembayaran'}>Lanjutkan pembayaran</a>}{!cancellationReason(order) && <button className="bam-button-danger" type="button" onClick={() => setCancelTarget(order)}>Batalkan pesanan</button>}</div></div>
        </li>)}</ul>}
    {cancelTarget && <CancelOrderDialog order={cancelTarget} onClose={() => setCancelTarget(null)} onCancelled={() => {}} />}
  </div>;
}
