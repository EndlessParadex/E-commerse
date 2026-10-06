import { useEffect, useMemo, useState } from 'react';
import { products } from '../data/products';
import { validateDelivery } from '../state/deliveryModel';
import { useDelivery } from '../state/useDelivery';
import { createOrder, saveOrder } from '../state/orderModel';
import { validateWhatsApp } from '../state/whatsappModel';
import { useShop } from '../state/useShop';
import { rupiah } from '../components/shop/shopPresentation';
import ProductImage from '../components/shop/ProductImage';
import './CheckoutPage.css';

const shippingOptions = [
  { id: 'regular', label: 'Reguler', description: '2–4 hari kerja', cost: 10000 },
  { id: 'express', label: 'Express', description: '1–2 hari kerja', cost: 20000 },
];

const paymentOptions = [
  { id: 'cod', label: 'Bayar di tempat', description: 'Bayar saat pesanan sampai' },
  { id: 'transfer', label: 'Transfer bank', description: 'Simulasi pembayaran melalui bank' },
  { id: 'wallet', label: 'E-wallet', description: 'Simulasi pembayaran digital' },
];

const emptyForm = { namaToko: '', namaJalan: '' };

export default function CheckoutPage() {
  const shop = useShop();
  const { savedLocation } = useDelivery();
  const [form, setForm] = useState(() => savedLocation || emptyForm);
  const [edited, setEdited] = useState(false);
  const [shippingId, setShippingId] = useState('regular');
  const [paymentId, setPaymentId] = useState('cod');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [whatsappNumber, setWhatsAppNumber] = useState('');
  const [whatsappOptIn, setWhatsAppOptIn] = useState(false);

  useEffect(() => {
    if (savedLocation && !edited) {
      // oxlint-disable-next-line react/set-state-in-effect
      setForm(savedLocation);
    }
  }, [savedLocation, edited]);

  const shipping = shippingOptions.find((option) => option.id === shippingId) || shippingOptions[0];
  const payment = paymentOptions.find((option) => option.id === paymentId) || paymentOptions[0];
  const total = shop.subtotal + shipping.cost;
  const itemProducts = useMemo(() => shop.cart.map((item) => ({ item, product: products.find((product) => product.id === item.id) })), [shop.cart]);

  if (!shop.cart.length) return <div className="checkout-page"><nav className="shop-breadcrumb" aria-label="Breadcrumb"><a href="#/">Beranda</a><span aria-hidden="true">/</span><span aria-current="page">Checkout</span></nav><div className="checkout-empty"><span aria-hidden="true">🛍️</span><h1>Belum ada produk untuk checkout</h1><p>Tambahkan produk ke keranjang sebelum melanjutkan.</p><a className="shop-primary" href="#/">Kembali ke katalog</a></div></div>;

  const updateField = (field, value) => {
    setEdited(true);
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError('');
  };

  const submit = (event) => {
    event.preventDefault();
    const nextErrors = validateDelivery(form);
    const phoneError = validateWhatsApp(whatsappNumber, whatsappOptIn);
    if (phoneError) nextErrors.whatsapp = phoneError;
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    const order = createOrder({ cart: shop.cart, recipient: form.namaToko, address: form.namaJalan, shipping, payment, whatsappNumber, whatsappOptIn });
    try {
      if (!saveOrder(order, window.sessionStorage)) {
        setSubmitError('Pesanan belum dapat disimpan di browser. Coba lagi.');
        return;
      }
    } catch {
      setSubmitError('Penyimpanan browser tidak tersedia. Pesanan belum dibuat.');
      return;
    }
    shop.clearCart();
    window.location.assign('#/pesanan/' + encodeURIComponent(order.id));
  };

  return <div className="checkout-page">
    <nav className="shop-breadcrumb" aria-label="Breadcrumb"><a href="#/">Beranda</a><span aria-hidden="true">/</span><a href="#/keranjang">Keranjang</a><span aria-hidden="true">/</span><span aria-current="page">Checkout</span></nav>
    <header className="checkout-header"><div><span className="section-eyebrow">Langkah terakhir</span><h1>Checkout</h1><p>Periksa alamat dan pilihan pengiriman sebelum membuat pesanan.</p></div><a className="checkout-back" href="#/keranjang">← Kembali ke keranjang</a></header>
    <form className="checkout-layout" onSubmit={submit} noValidate>
      <div className="checkout-main">
        <section className="checkout-card" aria-labelledby="delivery-title">
          <div className="checkout-card-heading"><span className="checkout-step">1</span><div><h2 id="delivery-title">Alamat pengiriman</h2><p>Pesanan akan dikirim ke alamat berikut.</p></div></div>
          <div className="checkout-fields">
            <div className="checkout-field"><label htmlFor="checkout-name">Nama penerima</label><input id="checkout-name" type="text" autoComplete="shipping name" maxLength={100} value={form.namaToko} onChange={(event) => updateField('namaToko', event.target.value)} aria-invalid={Boolean(errors.namaToko)} aria-describedby={errors.namaToko ? 'checkout-name-error' : undefined} placeholder="Nama lengkap penerima" />{errors.namaToko && <p id="checkout-name-error" className="checkout-error">{errors.namaToko}</p>}</div>
            <div className="checkout-field"><label htmlFor="checkout-address">Alamat lengkap</label><textarea id="checkout-address" rows={4} maxLength={500} autoComplete="shipping street-address" value={form.namaJalan} onChange={(event) => updateField('namaJalan', event.target.value)} aria-invalid={Boolean(errors.namaJalan)} aria-describedby={errors.namaJalan ? 'checkout-address-error' : undefined} placeholder="Nama jalan, nomor rumah, kecamatan, kota, dan kode pos" />{errors.namaJalan && <p id="checkout-address-error" className="checkout-error">{errors.namaJalan}</p>}</div>
          </div>
        </section>

        <section className="checkout-card" aria-labelledby="whatsapp-title">
          <h2 id="whatsapp-title">Pembaruan melalui WhatsApp</h2>
          <label className="checkout-whatsapp-consent"><input type="checkbox" checked={whatsappOptIn} onChange={(event) => { setWhatsAppOptIn(event.target.checked); setErrors((current) => ({ ...current, whatsapp: undefined })); }} /><span>Saya ingin menerima pembaruan pesanan ini melalui WhatsApp.</span></label>
          {whatsappOptIn && <div className="checkout-field"><label htmlFor="checkout-whatsapp">Nomor WhatsApp</label><input id="checkout-whatsapp" type="tel" inputMode="tel" autoComplete="tel" maxLength={25} value={whatsappNumber} onChange={(event) => { setWhatsAppNumber(event.target.value); setErrors((current) => ({ ...current, whatsapp: undefined })); }} placeholder="081234567890" aria-invalid={Boolean(errors.whatsapp)} aria-describedby={'whatsapp-hint' + (errors.whatsapp ? ' whatsapp-error' : '')} />{errors.whatsapp && <p id="whatsapp-error" className="checkout-error" role="alert">{errors.whatsapp}</p>}</div>}
          <p id="whatsapp-hint" className="checkout-note">Opsional dan hanya untuk pesanan ini, bukan promosi. Ini masih simulasi: nomor disimpan sementara di tab browser, tidak dikirim ke WhatsApp.</p>
        </section>

        <section className="checkout-card" aria-labelledby="shipping-title">
          <div className="checkout-card-heading"><span className="checkout-step">2</span><div><h2 id="shipping-title">Pilihan pengiriman</h2><p>Pilih estimasi yang sesuai kebutuhan Anda.</p></div></div>
          <div className="checkout-options">{shippingOptions.map((option) => <label className={'checkout-option' + (shippingId === option.id ? ' is-selected' : '')} key={option.id}><input type="radio" name="shipping" value={option.id} checked={shippingId === option.id} onChange={() => setShippingId(option.id)} /><span className="checkout-radio" /><span className="checkout-option-copy"><strong>{option.label}</strong><small>{option.description}</small></span><strong className="checkout-option-price">{rupiah(option.cost)}</strong></label>)}</div>
        </section>

        <section className="checkout-card" aria-labelledby="payment-title">
          <div className="checkout-card-heading"><span className="checkout-step">3</span><div><h2 id="payment-title">Metode pembayaran</h2><p>Pilihan pembayaran ini masih berupa simulasi frontend.</p></div></div>
          <div className="checkout-options">{paymentOptions.map((option) => <label className={'checkout-option' + (paymentId === option.id ? ' is-selected' : '')} key={option.id}><input type="radio" name="payment" value={option.id} checked={paymentId === option.id} onChange={() => setPaymentId(option.id)} /><span className="checkout-radio" /><span className="checkout-option-copy"><strong>{option.label}</strong><small>{option.description}</small></span></label>)}</div>
        </section>
      </div>

      <aside className="checkout-summary" aria-labelledby="summary-title">
        <h2 id="summary-title">Ringkasan pesanan</h2>
        <ul className="checkout-items">{itemProducts.map(({ item, product }) => <li key={item.id}><div className={'checkout-item-image ' + (product?.color || '')}><ProductImage product={product || { ...item, image: '', imageAlt: item.name, icon: '🛒' }} variant="promo" /></div><div className="checkout-item-copy"><strong>{item.name}</strong><span>{item.quantity} × {rupiah(item.price)}</span></div><strong>{rupiah(item.price * item.quantity)}</strong></li>)}</ul>
        <div className="checkout-totals"><div><span>Subtotal</span><strong>{rupiah(shop.subtotal)}</strong></div><div><span>Ongkir</span><strong>{rupiah(shipping.cost)}</strong></div><div className="checkout-total"><span>Total pembayaran</span><strong>{rupiah(total)}</strong></div></div>
        {submitError && <p className="checkout-submit-error" role="alert">{submitError}</p>}
        <button type="submit" className="checkout-submit">Buat pesanan · {rupiah(total)}</button>
        <p className="checkout-note">Dengan melanjutkan, Anda menyetujui detail pesanan contoh ini.</p>
      </aside>
    </form>
  </div>;
}
