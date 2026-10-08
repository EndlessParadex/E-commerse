import { useState } from 'react';
import { orderItemPresentation } from '../data/orderItemPresentation';
import { readOrder } from '../state/orderModel';
import { dateLabel } from '../components/shop/shopPresentation';
import { rupiah } from '../components/shop/shopPresentation';
import ProductImage from '../components/shop/ProductImage';
import OrderTracking from '../components/shop/OrderTracking';
import './OrderConfirmationPage.css';
import '../components/shop/OrderItem.css';

export default function OrderConfirmationPage({ orderId }) {
  const [order] = useState(() => {
    try { return readOrder(decodeURIComponent(orderId), window.sessionStorage); }
    catch { return null; }
  });

  if (!order) return <div className="order-confirmation-page"><div className="order-missing"><span aria-hidden="true">?</span><h1>Pesanan tidak ditemukan</h1><p>Detail pesanan simulasi hanya tersedia selama tersimpan di tab browser yang digunakan saat checkout.</p><a className="shop-primary" href="#/pesanan">Lihat pesanan saya</a></div></div>;

  return <div className="order-confirmation-page">
    <nav className="shop-breadcrumb" aria-label="Breadcrumb"><a href="#/">Beranda</a><span aria-hidden="true">/</span><a href="#/pesanan">Pesanan saya</a><span aria-hidden="true">/</span><span aria-current="page">Detail pesanan</span></nav>
    <div className="confirmation-hero"><div className="confirmation-check" aria-hidden="true">✓</div><span className="section-eyebrow">Pesanan berhasil dibuat</span><h1>Terima kasih, pesanan Anda diterima.</h1><p>Nomor pesanan <strong>{order.id}</strong> telah tercatat di browser ini.</p></div>
    {order.whatsapp?.optedIn && <p className="shop-warning" role="status">Pilihan WhatsApp untuk {order.whatsapp.number} tercatat pada pesanan simulasi ini. Belum ada pesan yang dikirim.</p>}
    <OrderTracking />
    <div className="confirmation-layout">
      <section className="confirmation-card" aria-labelledby="confirmation-items-title"><div className="confirmation-card-heading"><h2 id="confirmation-items-title">Barang yang dipesan</h2><time dateTime={new Date(order.createdAt).toISOString()}>{dateLabel(order.createdAt)}</time></div><p className="confirmation-item-count">{order.items.reduce((sum, item) => sum + item.quantity, 0)} barang · {order.items.length} pilihan produk/ukuran</p><ul className="confirmation-items">{order.items.map((item) => { const display = orderItemPresentation(item); return <li key={item.id}><div className={'confirmation-item-image ' + (display.product.color || '')}><ProductImage product={display.product} variant="thumbnail" /></div><div className="confirmation-item-copy">{display.brand && <span className="order-item-brand">{display.brand}</span>}<strong>{display.name}</strong><span className="order-item-size">{display.sizeLabel ? `Ukuran ${display.sizeLabel}` : 'Ukuran belum tercatat'}</span><span>{item.quantity} × {rupiah(item.price)}</span></div><div className="confirmation-line-total"><span>Subtotal barang</span><strong>{rupiah(item.price * item.quantity)}</strong></div></li>; })}</ul><div className="confirmation-totals"><div><span>Subtotal</span><strong>{rupiah(order.subtotal)}</strong></div><div><span>Ongkir</span><strong>{rupiah(order.shipping.cost)}</strong></div><div className="confirmation-total"><span>Total pembayaran</span><strong>{rupiah(order.total)}</strong></div></div></section>
      <aside className="confirmation-side">
        {typeof order.note === 'string' && order.note.trim() && <section className="confirmation-card confirmation-order-note" aria-labelledby="confirmation-note-title"><h2 id="confirmation-note-title">Catatan untuk penjual</h2><p>{order.note}</p></section>}
        <section className="confirmation-card confirmation-info"><h2>Pengiriman</h2><p><strong>{order.recipient}</strong><br />{order.address}</p><div className="confirmation-info-row"><span>Metode</span><strong>{order.shipping.label}</strong></div><div className="confirmation-info-row"><span>Pembayaran</span><strong>{order.payment.label}</strong></div></section>
        <a className="confirmation-home" href="#/pesanan">Lihat semua pesanan</a>
        <a className="confirmation-home" href="#/">Kembali berbelanja</a>
      </aside>
    </div>
  </div>;
}
