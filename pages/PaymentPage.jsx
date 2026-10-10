import { useState } from 'react';
import useWorkflow from '../state/useWorkflow';
import { updatePreviewOrder } from '../state/frontendWorkflow';
import PaymentDetails from '../components/shop/PaymentDetails';
import { paymentMethod } from '../state/paymentMethods';
import '../styles/workflow.css';

export default function PaymentPage({ orderId }) {
  const { orders, failed } = useWorkflow();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const order = orders.find((entry) => entry.id === orderId);
  const act = (action) => {
    const result = updatePreviewOrder(order.id, action, window.sessionStorage);
    setError(result.error || '');
    setNotice(result.error ? '' : ({ paid: 'Pembayaran simulasi berhasil. Pesanan siap diproses.', failed: 'Percobaan pembayaran simulasi gagal.', retry: 'Anda dapat mencoba pembayaran simulasi lagi.', expire: 'Pembayaran simulasi kedaluwarsa. Stok telah dilepas.' })[action]);
  };
  if (!order) return <div className="shop-page"><h1>{failed ? 'Pembayaran belum dapat dibuka' : 'Pesanan tidak ditemukan'}</h1><p>{failed ? 'Penyimpanan browser tidak tersedia. Coba muat ulang halaman.' : 'Pesanan pratinjau hanya tersedia pada tab tempat checkout dilakukan.'}</p><a className="shop-primary" href="#/pesanan">Lihat pesanan saya</a></div>;
  const pending = order.status === 'awaiting_payment' && Boolean(paymentMethod(order.payment.id));
  return <div className="shop-page workflow-payment-page">
    <nav className="shop-breadcrumb" aria-label="Breadcrumb"><a href="#/">Beranda</a><span aria-hidden="true">/</span><a href="#/pesanan">Pesanan saya</a><span aria-hidden="true">/</span><span aria-current="page">Pembayaran</span></nav>
    <a className="product-back-link" href={'#/pesanan/' + encodeURIComponent(order.id)}>← Kembali ke detail pesanan</a>
    <header className="shop-page-header"><h1>Pembayaran pesanan</h1><p className="workflow-order-id">{order.id}</p></header>
    {error && <p className="shop-warning" role="alert">{error}</p>}{notice && <p className="workflow-notice" role="status">{notice}</p>}
    <PaymentDetails order={order} showContinue={false} />
    {pending && <section className="confirmation-card workflow-payment-demo"><h2>Coba alur pembayaran</h2><p>Pratinjau frontend. Pilih hasil untuk melihat tampilan pembayaran dan perubahan status pesanan. Tidak ada transfer, nomor VA, atau QR pembayaran nyata.</p>
      {order.payment.status === 'failed' ? <button className="shop-primary" type="button" onClick={() => act('retry')}>Coba pembayaran simulasi kembali</button> : <div className="workflow-actions"><button className="shop-primary" type="button" onClick={() => act('paid')}>Simulasikan pembayaran berhasil</button><button className="bam-button-secondary" type="button" onClick={() => act('failed')}>Simulasikan pembayaran gagal</button><button className="bam-button-secondary" type="button" onClick={() => act('expire')}>Simulasikan kedaluwarsa</button></div>}
    </section>}
    <a className="confirmation-home" href={'#/pesanan/' + encodeURIComponent(order.id)}>Lihat status pesanan</a>
    {!pending && order.payment.status !== 'paid' && <a className="confirmation-home" href="#/cari?q=">Kembali berbelanja</a>}
  </div>;
}
