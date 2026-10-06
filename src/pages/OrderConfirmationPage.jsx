import { useState } from 'react';
import { products } from '../data/products';
import { readOrder } from '../state/orderModel';
import { dateLabel } from '../components/shop/shopPresentation';
import { rupiah } from '../components/shop/shopPresentation';
import ProductImage from '../components/shop/ProductImage';
import OrderTracking from '../components/shop/OrderTracking';
import './OrderConfirmationPage.css';

export default function OrderConfirmationPage({ orderId }) {
  const [order] = useState(() => {
    try { return readOrder(decodeURIComponent(orderId), window.sessionStorage); }
    catch { return null; }
  });

  if (!order) return <div className="order-confirmation-page"><div className="order-missing"><span aria-hidden="true">?</span><h1>Pesanan tidak ditemukan</h1><p>Detail pesanan hanya tersedia pada browser yang digunakan saat checkout.</p><a className="shop-primary" href="#/">Kembali ke beranda</a></div></div>;

  return <div className="order-confirmation-page">
    <div className="confirmation-hero"><div className="confirmation-check" aria-hidden="true">✓</div><span className="section-eyebrow">Pesanan berhasil dibuat</span><h1>Terima kasih, pesanan Anda diterima.</h1><p>Nomor pesanan <strong>{order.id}</strong> telah tercatat di browser ini.</p></div>
    {order.whatsapp?.optedIn && <p className="shop-warning" role="status">Pilihan WhatsApp untuk {order.whatsapp.number} tercatat pada pesanan simulasi ini. Belum ada pesan yang dikirim.</p>}
    <OrderTracking />
    <div className="confirmation-layout">
      <section className="confirmation-card" aria-labelledby="confirmation-items-title"><div className="confirmation-card-heading"><h2 id="confirmation-items-title">Detail pesanan</h2><time dateTime={new Date(order.createdAt).toISOString()}>{dateLabel(order.createdAt)}</time></div><ul className="confirmation-items">{order.items.map((item) => { const product = products.find((entry) => entry.id === item.id); return <li key={item.id}><div className={'confirmation-item-image ' + (product?.color || '')}><ProductImage product={product || { ...item, image: '', imageAlt: item.name, icon: '🛒' }} variant="promo" /></div><div className="confirmation-item-copy"><strong>{item.name}</strong><span>{item.quantity} × {rupiah(item.price)}</span></div><strong>{rupiah(item.price * item.quantity)}</strong></li>; })}</ul><div className="confirmation-totals"><div><span>Subtotal</span><strong>{rupiah(order.subtotal)}</strong></div><div><span>Ongkir</span><strong>{rupiah(order.shipping.cost)}</strong></div><div className="confirmation-total"><span>Total pembayaran</span><strong>{rupiah(order.total)}</strong></div></div></section>
      <aside className="confirmation-side">
        <section className="confirmation-card confirmation-info"><h2>Pengiriman</h2><p><strong>{order.recipient}</strong><br />{order.address}</p><div className="confirmation-info-row"><span>Metode</span><strong>{order.shipping.label}</strong></div><div className="confirmation-info-row"><span>Pembayaran</span><strong>{order.payment.label}</strong></div></section>
        <a className="confirmation-home" href="#/">Kembali berbelanja</a>
      </aside>
    </div>
  </div>;
}
