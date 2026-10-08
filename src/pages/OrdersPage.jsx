import { useState } from 'react';
import { orderItemPresentation } from '../data/orderItemPresentation';
import { readOrders } from '../state/orderModel';
import { dateLabel, rupiah } from '../components/shop/shopPresentation';
import ProductImage from '../components/shop/ProductImage';
import './OrdersPage.css';
import '../components/shop/OrderItem.css';

export default function OrdersPage() {
  const [{ orders, failed }] = useState(() => {
    try { return { orders: readOrders(window.sessionStorage), failed: false }; }
    catch { return { orders: [], failed: true }; }
  });

  return <div className="orders-page">
    <nav className="shop-breadcrumb" aria-label="Breadcrumb"><a href="#/">Beranda</a><span aria-hidden="true">/</span><span aria-current="page">Pesanan saya</span></nav>
    <header className="orders-heading"><div><span className="section-eyebrow">Aktivitas belanja</span><h1>Pesanan saya</h1><p>{orders.length} pesanan simulasi</p></div><a className="orders-shopping-link" href="#/">Lanjut berbelanja →</a></header>
    <p className="orders-notice">Riwayat simulasi hanya tersedia di tab browser ini, belum terhubung ke akun atau toko. Menutup tab dapat menghapus riwayat. Semua pesanan berstatus awal Diproses; pratinjau status di halaman detail tidak disimpan.</p>
    {failed ? <section className="orders-empty" role="alert"><h2>Riwayat belum dapat dibuka</h2><p>Penyimpanan browser tidak tersedia. Coba muat ulang halaman atau periksa pengaturan browser.</p><button className="shop-primary" type="button" onClick={() => window.location.reload()}>Coba lagi</button></section>
      : orders.length === 0 ? <section className="orders-empty"><span aria-hidden="true">📦</span><h2>Belum ada pesanan</h2><p>Pesanan yang dibuat melalui checkout akan muncul di sini.</p><a className="shop-primary" href="#/">Mulai berbelanja</a></section>
        : <ul className="orders-list">{orders.map((order) => <li key={order.id} className="orders-card">
          <div className="orders-card-header"><div><strong className="orders-number">{order.id}</strong><time dateTime={new Date(order.createdAt).toISOString()}>{dateLabel(order.createdAt)}</time></div><span className="orders-status">Diproses · Simulasi</span></div>
          <ul className="orders-products">{order.items.slice(0, 2).map((item) => {
            const display = orderItemPresentation(item);
            return <li key={item.id}><ProductImage product={display.product} variant="thumbnail" /><div>{display.brand && <span className="order-item-brand">{display.brand}</span>}<strong>{display.name}</strong><span className="order-item-size">{display.sizeLabel ? `Ukuran ${display.sizeLabel}` : 'Ukuran belum tercatat'}</span><span>{item.quantity} × {rupiah(item.price)}</span><strong className="order-item-subtotal">Subtotal {rupiah(item.price * item.quantity)}</strong></div></li>;
          })}</ul>
          {order.items.length > 2 && <p className="orders-more">+{order.items.length - 2} pilihan produk/ukuran lainnya</p>}
          <div className="orders-card-footer"><div><span>Total pembayaran</span><strong>{rupiah(order.total)}</strong><small>Termasuk ongkir · {order.items.reduce((sum, item) => sum + item.quantity, 0)} barang</small></div><a className="shop-primary" href={'#/pesanan/' + encodeURIComponent(order.id)} aria-label={'Lihat detail pesanan ' + order.id}>Lihat detail <span aria-hidden="true">→</span></a></div>
        </li>)}</ul>}
  </div>;
}
