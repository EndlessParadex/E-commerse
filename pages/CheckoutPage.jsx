import { useEffect, useRef, useState } from 'react';
import PackagingSummary from '../components/shop/PackagingSummary';
import { cartItemPresentation } from '../data/cartItemPresentation';
import { validateDelivery } from '../state/deliveryModel';
import { useDelivery } from '../state/useDelivery';
import { ORDER_NOTE_MAX_LENGTH } from '../state/orderModel';
import { placePreviewOrder } from '../state/frontendWorkflow';
import { validateWhatsApp } from '../state/whatsappModel';
import { useShop } from '../state/useShop';
import { rupiah } from '../components/shop/shopPresentation';
import ProductImage from '../components/shop/ProductImage';
import PaymentPicker from '../components/shop/PaymentPicker';
import { paymentMethod } from '../state/paymentMethods';
import CancelShoppingDialog from '../components/shop/CancelShoppingDialog';
import CartReview from '../components/shop/CartReview';
import { initializeCatalog, catalogUsesServer } from '../data/adminStore';
import { reviewCart } from '../data/cartValidation';
import './CheckoutPage.css';

const shippingOptions = [
  { id: 'regular', label: 'Reguler', description: '2–4 hari kerja', cost: 10000 },
  { id: 'express', label: 'Express', description: '1–2 hari kerja', cost: 20000 },
];

const emptyForm = { namaToko: '', namaJalan: '' };

export default function CheckoutPage() {
  const shop = useShop();
  const { savedLocation } = useDelivery();
  const [form, setForm] = useState(() => savedLocation || emptyForm);
  const [addressEditing, setAddressEditing] = useState(() => Object.keys(validateDelivery(savedLocation || emptyForm)).length > 0);
  const nameRef = useRef(null);
  const addressRef = useRef(null);
  const whatsappRef = useRef(null);
  const submitErrorRef = useRef(null);
  const [edited, setEdited] = useState(false);
  const [shippingId, setShippingId] = useState('regular');
  const [paymentId, setPaymentId] = useState('cod');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [whatsappNumber, setWhatsAppNumber] = useState('');
  const [whatsappOptIn, setWhatsAppOptIn] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitLock = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  useEffect(() => {
    if (savedLocation && !edited) {
      // oxlint-disable-next-line react/set-state-in-effect
      setForm(savedLocation);
    }
  }, [savedLocation, edited]);

  const shipping = shippingOptions.find((option) => option.id === shippingId) || shippingOptions[0];
  const payment = paymentMethod(paymentId);
  const total = shop.subtotal + shipping.cost;
  const itemProducts = shop.cart.map((item) => ({ item, display: cartItemPresentation(item) }));

  if (!shop.cart.length) return <div className="checkout-page"><nav className="shop-breadcrumb" aria-label="Breadcrumb"><a href="#/">Beranda</a><span aria-hidden="true">/</span><span aria-current="page">Checkout</span></nav><div className="checkout-empty"><span aria-hidden="true">🛍️</span><h1>Belum ada produk untuk checkout</h1><p>Tambahkan produk ke keranjang sebelum melanjutkan.</p><a className="shop-primary" href="#/">Kembali ke katalog</a></div></div>;

  const updateField = (field, value) => {
    setEdited(true);
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submitLock.current) return;
    const nextErrors = validateDelivery(form);
    const phoneError = validateWhatsApp(whatsappNumber, whatsappOptIn);
    if (phoneError) nextErrors.whatsapp = phoneError;
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      if (nextErrors.namaToko || nextErrors.namaJalan) setAddressEditing(true);
      window.requestAnimationFrame(() => {
        const field = nextErrors.namaToko ? nameRef.current : nextErrors.namaJalan ? addressRef.current : whatsappRef.current;
        field?.focus();
      });
      return;
    }
    submitLock.current = true;
    setBusy(true);
    setSubmitError('');
    try {
      if (catalogUsesServer) await initializeCatalog();
      if (!active.current) return;
      if (!reviewCart(shop.cart).ready) { setSubmitError('Katalog telah berubah. Periksa barang dan gunakan harga terbaru sebelum membuat pesanan.'); window.requestAnimationFrame(() => submitErrorRef.current?.focus()); return; }
      const order = placePreviewOrder({ cart: shop.cart, recipient: form.namaToko, address: form.namaJalan, shipping, payment, whatsappNumber, whatsappOptIn, note: orderNote }, window.sessionStorage);
      shop.completeOrder(order);
      window.location.assign('#/pesanan/' + encodeURIComponent(order.id));
    } catch (error) {
      if (!active.current) return;
      setSubmitError(error instanceof Error && /Stok|Pesanan belum tersimpan/.test(error.message) ? error.message : 'Pesanan belum dibuat. Pastikan server dapat dihubungi dan penyimpanan browser tersedia, lalu coba lagi.');
      window.requestAnimationFrame(() => submitErrorRef.current?.focus());
    } finally {
      submitLock.current = false;
      if (active.current) setBusy(false);
    }
  };

  return <div className="checkout-page">
    <nav className="shop-breadcrumb" aria-label="Breadcrumb"><a href="#/">Beranda</a><span aria-hidden="true">/</span><a href="#/keranjang">Keranjang</a><span aria-hidden="true">/</span><span aria-current="page">Checkout</span></nav>
    <header className="checkout-header"><div><span className="section-eyebrow">Langkah terakhir</span><h1>Checkout</h1><p>Periksa alamat dan pilihan pengiriman sebelum membuat pesanan.</p></div><div className="checkout-header-actions"><a className="checkout-back" href="#/keranjang">← Kembali ke keranjang</a><button className="bam-button-danger" type="button" disabled={busy} onClick={() => setCancelOpen(true)}>Batalkan checkout</button></div></header>
    <CartReview />
    <form id="checkout-form" className="checkout-layout" onSubmit={submit} noValidate aria-busy={busy}>
      <fieldset className="checkout-main" disabled={busy}>
        <section className="checkout-card" aria-labelledby="delivery-title">
          <div className="checkout-card-heading"><span className="checkout-step">1</span><div><h2 id="delivery-title">Alamat pengiriman</h2><p>Pesanan akan dikirim ke alamat berikut.</p></div><button type="button" className="checkout-address-edit" aria-expanded={addressEditing || Boolean(errors.namaToko || errors.namaJalan)} aria-controls="checkout-address-fields" onClick={() => {
            if (addressEditing) {
              const nextErrors = validateDelivery(form);
              setErrors((current) => ({ ...current, namaToko: nextErrors.namaToko, namaJalan: nextErrors.namaJalan }));
              if (!Object.keys(nextErrors).length) setAddressEditing(false);
              else window.requestAnimationFrame(() => (nextErrors.namaToko ? nameRef.current : addressRef.current)?.focus());
            } else { setAddressEditing(true); window.requestAnimationFrame(() => nameRef.current?.focus()); }
          }}>{addressEditing ? 'Selesai' : 'Ubah'}</button></div>
          <div className="checkout-address-preview"><strong>{form.namaToko.trim() || 'Nama penerima belum diisi'}</strong><p>{form.namaJalan.trim() || 'Lengkapi alamat pengiriman.'}</p></div>
          <div className="checkout-fields" id="checkout-address-fields" hidden={!addressEditing && !errors.namaToko && !errors.namaJalan}>
            <div className="checkout-field"><label htmlFor="checkout-name">Nama penerima</label><input id="checkout-name" ref={nameRef} type="text" autoComplete="shipping name" maxLength={100} value={form.namaToko} onChange={(event) => updateField('namaToko', event.target.value)} aria-invalid={Boolean(errors.namaToko)} aria-describedby={errors.namaToko ? 'checkout-name-error' : undefined} placeholder="Nama lengkap penerima" />{errors.namaToko && <p id="checkout-name-error" className="checkout-error">{errors.namaToko}</p>}</div>
            <div className="checkout-field"><label htmlFor="checkout-address">Alamat lengkap</label><textarea id="checkout-address" ref={addressRef} rows={4} maxLength={500} autoComplete="shipping street-address" value={form.namaJalan} onChange={(event) => updateField('namaJalan', event.target.value)} aria-invalid={Boolean(errors.namaJalan)} aria-describedby={errors.namaJalan ? 'checkout-address-error' : undefined} placeholder="Nama jalan, nomor rumah, kecamatan, kota, dan kode pos" />{errors.namaJalan && <p id="checkout-address-error" className="checkout-error">{errors.namaJalan}</p>}</div>
          </div>
        </section>



        <section className="checkout-card checkout-products-card" aria-labelledby="checkout-products-title">
          <div className="checkout-card-heading"><span className="checkout-step">2</span><div><h2 id="checkout-products-title">Barang yang dipesan</h2><p>{shop.quantity} kemasan · {shop.cart.length} pilihan produk/kemasan</p></div><a className="checkout-address-edit" href="#/keranjang">Ubah</a></div>
          <ul className="checkout-items">{itemProducts.map(({ item, display }) => <li key={item.id}><div className={'checkout-item-image ' + (display.product.color || '')}><ProductImage product={display.product} variant="thumbnail" /></div><div className="checkout-item-copy">{display.brand && <span className="checkout-item-brand">{display.brand}</span>}<strong>{display.name}</strong><span className="checkout-size-label">{display.sizeLabel ? `Ukuran ${display.sizeLabel}` : 'Ukuran belum tercatat'}</span><PackagingSummary packaging={display.packaging} quantity={item.quantity} /><span>{item.quantity} × {rupiah(item.price)}</span></div><strong className="checkout-item-subtotal">{rupiah(item.price * item.quantity)}</strong></li>)}</ul>
          <div className="checkout-field checkout-order-note">
            <label htmlFor="checkout-order-note">Catatan untuk penjual <span>(opsional)</span></label>
            <textarea id="checkout-order-note" rows={3} maxLength={ORDER_NOTE_MAX_LENGTH} value={orderNote} onChange={(event) => setOrderNote(event.target.value.slice(0, ORDER_NOTE_MAX_LENGTH))} aria-describedby="checkout-order-note-hint checkout-order-note-count" placeholder="Contoh: Tolong kemas dengan aman." />
            <div className="checkout-order-note-footer"><p id="checkout-order-note-hint">Catatan hanya berlaku untuk pesanan ini.</p><span id="checkout-order-note-count">{orderNote.length}/{ORDER_NOTE_MAX_LENGTH} karakter</span></div>
          </div>
        </section>

        <section className="checkout-card" aria-labelledby="shipping-title">
          <div className="checkout-card-heading"><span className="checkout-step">3</span><div><h2 id="shipping-title">Pilihan pengiriman</h2><p>Pilih estimasi yang sesuai kebutuhan Anda.</p></div></div>
          <div className="checkout-options">{shippingOptions.map((option) => <label className={'checkout-option' + (shippingId === option.id ? ' is-selected' : '')} key={option.id}><input type="radio" name="shipping" value={option.id} checked={shippingId === option.id} onChange={() => setShippingId(option.id)} /><span className="checkout-radio" /><span className="checkout-option-copy"><strong>{option.label}</strong><small>{option.description}</small></span><strong className="checkout-option-price">{rupiah(option.cost)}</strong></label>)}</div>
        </section>

        <section className="checkout-card" aria-labelledby="payment-title">
          <div className="checkout-card-heading"><span className="checkout-step">4</span><div><h2 id="payment-title">Metode pembayaran</h2><p>Pilih layanan yang ingin digunakan.</p></div></div>
          <PaymentPicker value={paymentId} onChange={setPaymentId} disabled={busy} />
        </section>

        <section className="checkout-card" aria-labelledby="whatsapp-title">
          <h2 id="whatsapp-title">Pembaruan melalui WhatsApp</h2>
          <label className="checkout-whatsapp-consent"><input type="checkbox" checked={whatsappOptIn} onChange={(event) => { setWhatsAppOptIn(event.target.checked); setErrors((current) => ({ ...current, whatsapp: undefined })); }} /><span>Saya ingin menerima pembaruan pesanan ini melalui WhatsApp.</span></label>
          {whatsappOptIn && <div className="checkout-field"><label htmlFor="checkout-whatsapp">Nomor WhatsApp</label><input id="checkout-whatsapp" ref={whatsappRef} type="tel" inputMode="tel" autoComplete="tel" maxLength={25} value={whatsappNumber} onChange={(event) => { setWhatsAppNumber(event.target.value); setErrors((current) => ({ ...current, whatsapp: undefined })); }} placeholder="081234567890" aria-invalid={Boolean(errors.whatsapp)} aria-describedby={'whatsapp-hint' + (errors.whatsapp ? ' whatsapp-error' : '')} />{errors.whatsapp && <p id="whatsapp-error" className="checkout-error" role="alert">{errors.whatsapp}</p>}</div>}
          <p id="whatsapp-hint" className="checkout-note">Opsional dan hanya untuk pesanan ini, bukan promosi. Ini masih simulasi: nomor disimpan sementara di tab browser, tidak dikirim ke WhatsApp.</p>
        </section>

      </fieldset>

      <aside className="checkout-summary" aria-labelledby="summary-title">
        <h2 id="summary-title">Ringkasan pesanan</h2>
        <p className="checkout-summary-count">{shop.quantity} kemasan · {shop.cart.length} pilihan produk/kemasan</p>
        <p className="checkout-selected-payment">Pembayaran <strong>{payment.label}</strong></p>
        <div className="checkout-totals"><div><span>Subtotal</span><strong>{rupiah(shop.subtotal)}</strong></div><div><span>Ongkir</span><strong>{rupiah(shipping.cost)}</strong></div><div className="checkout-total"><span>Total pembayaran</span><strong>{rupiah(total)}</strong></div></div>
        {submitError && <p className="checkout-submit-error" ref={submitErrorRef} tabIndex={-1} role="alert">{submitError}</p>}
        <button type="submit" className="checkout-submit checkout-desktop-submit" disabled={busy || !shop.cartReview.ready}>{busy ? 'Memeriksa pesanan…' : `Buat pesanan · ${rupiah(total)}`}</button>
        {!shop.cartReview.ready && <p className="checkout-note" role="status">Perbaiki barang pada keranjang untuk melanjutkan.</p>}
        <p className="checkout-note">Pesanan dan pembayaran masih simulasi. Tidak ada pembayaran yang diproses.</p>
      </aside>
      <div className="checkout-action-bar"><div className="checkout-action-total"><span>Total pembayaran</span><strong aria-live="polite">{rupiah(total)}</strong><small>Termasuk ongkir</small></div><button type="submit" className="checkout-submit" disabled={busy || !shop.cartReview.ready}>{busy ? 'Memeriksa…' : 'Buat pesanan'}</button></div>
    </form>
    {cancelOpen && <CancelShoppingDialog checkout onClose={() => setCancelOpen(false)} />}
  </div>;
}
