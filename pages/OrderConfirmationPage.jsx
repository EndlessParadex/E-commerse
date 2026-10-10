import { useState } from 'react';
import PackagingSummary from '../components/shop/PackagingSummary';
import { orderItemPresentation } from '../data/orderItemPresentation';
import { cancellationReason, orderStatus, orderStatusLabel } from '../state/orderModel';
import useWorkflow from '../state/useWorkflow';
import { dateLabel } from '../components/shop/shopPresentation';
import { rupiah } from '../components/shop/shopPresentation';
import ProductImage from '../components/shop/ProductImage';
import OrderTracking from '../components/shop/OrderTracking';
import './OrderConfirmationPage.css';
import '../components/shop/OrderItem.css';
import CancelOrderDialog from '../components/shop/CancelOrderDialog';
import PaymentDetails from '../components/shop/PaymentDetails';

export default function OrderConfirmationPage({ orderId }) {
  const { orders, failed } = useWorkflow();
  const order = orders.find((entry) => entry.id === orderId);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (!order) return <div className="order-confirmation-page"><div className="order-missing"><span aria-hidden="true">?</span><h1>{failed ? 'Detail pesanan belum dapat dibuka' : 'Pesanan tidak ditemukan'}</h1><p>{failed ? 'Penyimpanan browser tidak tersedia. Coba muat ulang halaman.' : 'Detail pesanan simulasi hanya tersedia selama tersimpan di tab browser yang digunakan saat checkout.'}</p><a className="shop-primary" href="#/pesanan">Lihat pesanan saya</a></div></div>;

  const cancelled = orderStatus(order) === 'cancelled';
  const expired = orderStatus(order) === 'expired';
  const cancelBlocked = cancellationReason(order);
  return <div className="order-confirmation-page">
    <nav className="shop-breadcrumb" aria-label="Breadcrumb"><a href="#/">Beranda</a><span aria-hidden="true">/</span><a href="#/pesanan">Pesanan saya</a><span aria-hidden="true">/</span><span aria-current="page">Detail pesanan</span></nav>
    <div className={'confirmation-hero' + (cancelled || expired ? ' is-cancelled' : '')}><div className="confirmation-check" aria-hidden="true">{cancelled || expired ? '×' : '✓'}</div><span className="section-eyebrow">{orderStatusLabel(order)}</span><h1>{cancelled ? 'Pesanan Anda telah dibatalkan.' : expired ? 'Batas pembayaran pesanan telah berakhir.' : orderStatus(order) === 'awaiting_payment' ? 'Pesanan dibuat, metode pembayaran tercatat.' : orderStatus(order) === 'shipped' ? 'Pesanan Anda sedang dikirim.' : orderStatus(order) === 'completed' ? 'Pesanan Anda telah selesai.' : 'Terima kasih, pesanan Anda diterima.'}</h1><p>Nomor pesanan <strong>{order.id}</strong> telah tercatat di browser ini.</p>{cancelled && <p className="confirmation-cancel-reason">Alasan: {order.cancellationReason || 'Berubah pikiran'}</p>}</div>
    {order.whatsapp?.optedIn && <p className="shop-warning" role="status">Pilihan WhatsApp untuk {order.whatsapp.number} tercatat pada pesanan simulasi ini. Belum ada pesan yang dikirim.</p>}
    <OrderTracking status={orderStatus(order)} />
    <div className="confirmation-layout">
      <section className="confirmation-card" aria-labelledby="confirmation-items-title"><div className="confirmation-card-heading"><h2 id="confirmation-items-title">Barang yang dipesan</h2><time dateTime={new Date(order.createdAt).toISOString()}>{dateLabel(order.createdAt)}</time></div><p className="confirmation-item-count">{order.items.reduce((sum, item) => sum + item.quantity, 0)} kemasan · {order.items.length} pilihan produk/kemasan</p><ul className="confirmation-items">{order.items.map((item) => { const display = orderItemPresentation(item); return <li key={item.id}><div className={'confirmation-item-image ' + (display.product.color || '')}><ProductImage product={display.product} variant="thumbnail" /></div><div className="confirmation-item-copy">{display.brand && <span className="order-item-brand">{display.brand}</span>}<strong>{display.name}</strong><span className="order-item-size">{display.sizeLabel ? `Ukuran ${display.sizeLabel}` : 'Ukuran belum tercatat'}</span><PackagingSummary packaging={display.packaging} quantity={item.quantity} /><span>{item.quantity} × {rupiah(item.price)}</span></div><div className="confirmation-line-total"><span>Subtotal barang</span><strong>{rupiah(item.price * item.quantity)}</strong></div></li>; })}</ul><div className="confirmation-totals"><div><span>Subtotal</span><strong>{rupiah(order.subtotal)}</strong></div><div><span>Ongkir</span><strong>{rupiah(order.shipping.cost)}</strong></div><div className="confirmation-total"><span>{cancelled ? 'Total pesanan' : 'Total pembayaran'}</span><strong>{rupiah(order.total)}</strong></div></div></section>
      <aside className="confirmation-side">
        {typeof order.note === 'string' && order.note.trim() && <section className="confirmation-card confirmation-order-note" aria-labelledby="confirmation-note-title"><h2 id="confirmation-note-title">Catatan untuk penjual</h2><p>{order.note}</p></section>}
        <section className="confirmation-card confirmation-info"><h2>Pengiriman</h2><p><strong>{order.recipient}</strong><br />{order.address}</p><div className="confirmation-info-row"><span>Metode</span><strong>{order.shipping.label}</strong></div><div className="confirmation-info-row"><span>Pembayaran</span><strong>{order.payment.label}</strong></div></section>
        <PaymentDetails order={order} />
        {order.shipping.trackingNumber && <section className="confirmation-card workflow-shipment"><h2>Resi pengiriman</h2><dl><div><dt>Kurir</dt><dd>{order.shipping.courier}</dd></div><div><dt>Nomor resi</dt><dd>{order.shipping.trackingNumber}</dd></div><div><dt>Dikirim</dt><dd>{dateLabel(order.shipping.shippedAt)}</dd></div>{order.shipping.deliveredAt && <div><dt>Diterima</dt><dd>{dateLabel(order.shipping.deliveredAt)}</dd></div>}</dl><p>Resi dan status pengiriman pratinjau. Belum terhubung ke kurir.</p></section>}
        {!cancelled && !expired && <section className="confirmation-card cancellation-card"><h2>Perlu membatalkan?</h2><p>{cancelBlocked || 'Anda dapat membatalkan pesanan percobaan ini sebelum dikirim atau pembayaran tercatat.'}</p><button className="bam-button-danger" type="button" disabled={Boolean(cancelBlocked)} onClick={() => setCancelOpen(true)}>Batalkan pesanan</button>{cancelBlocked && <a href="#/bantuan">Lihat bantuan pembatalan →</a>}</section>}
        <a className="confirmation-home" href="#/pesanan">Lihat semua pesanan</a>
        <a className="confirmation-home" href="#/">Kembali berbelanja</a>
      </aside>
    </div>
    {cancelOpen && <CancelOrderDialog order={order} onClose={() => setCancelOpen(false)} onCancelled={() => {}} />}
  </div>;
}
