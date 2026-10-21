import useCompany from '../state/useCompany';
import { useEffect, useRef, useState } from 'react';
import PackagingSummary from '../components/shop/PackagingSummary';
import { cartItemPresentation } from '../data/cartItemPresentation';
import { validateDelivery } from '../state/deliveryModel';
import { useDelivery } from '../state/useDelivery';
import { ORDER_NOTE_MAX_LENGTH } from '../state/orderModel';
import { placePreviewOrder } from '../state/frontendWorkflow';
import { useShop } from '../state/useShop';
import { rupiah } from '../components/shop/shopPresentation';
import ProductImage from '../components/shop/ProductImage';
import PaymentPicker from '../components/shop/PaymentPicker';
import { paymentMethod, livePaymentMethods } from '../state/paymentMethods';
import CancelShoppingDialog from '../components/shop/CancelShoppingDialog';
import CartReview from '../components/shop/CartReview';
import { initializeCatalog, catalogUsesServer } from '../data/adminStore';
import { reviewCart } from '../data/cartValidation';
import { workflowUsesServer } from '../data/adminStore';
import { createServerOrder } from '../state/serverWorkflow';
import { shippingOptions } from '../data/shippingOptions';
import './CheckoutPage.css';

const emptyForm = { namaToko: '', namaJalan: '' };

export default function CheckoutPage() {
  const shop = useShop();
  const company = useCompany();
  const live = workflowUsesServer && company.commerce?.version === 31;
  const codOnly = live && company.commerce?.codOnly === true;
  const { savedLocation, user, authLoading } = useDelivery();
  const [form, setForm] = useState(() => savedLocation || emptyForm);
  const [addressEditing, setAddressEditing] = useState(
    () => Object.keys(validateDelivery(savedLocation || emptyForm)).length > 0,
  );
  const nameRef = useRef(null);
  const addressRef = useRef(null);
  const submitErrorRef = useRef(null);
  const [edited, setEdited] = useState(false);
  const [shippingId, setShippingId] = useState('regular');
  const [paymentId, setPaymentId] = useState('cod');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitLock = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  useEffect(() => {
    if (savedLocation && !edited) {
      // oxlint-disable-next-line react/set-state-in-effect
      setForm(savedLocation);
    }
  }, [savedLocation, edited]);

  const offeredShipping = live
    ? codOnly
      ? [
          {
            id: 'regular',
            label: 'Pengiriman gratis',
            description: 'Tanpa biaya ongkos kirim.',
            cost: 0,
          },
        ]
      : [
          {
            id: 'regular',
            label: 'Ongkir dikonfirmasi toko',
            description:
              'Toko menghitung ongkir sesuai barang, tujuan, dan kurir. Anda menyetujui total akhir sebelum membayar.',
            cost: 0,
          },
        ]
    : shippingOptions;
  const shipping = codOnly
    ? { id: 'regular', label: 'Pengiriman gratis', description: 'Tanpa ongkir', cost: 0 }
    : offeredShipping.find((option) => option.id === shippingId) || shippingOptions[0];
  const availableMethods = live
    ? codOnly
      ? [paymentMethod('cod')]
      : livePaymentMethods(company.profile)
    : null;
  const effectivePaymentId = codOnly
    ? 'cod'
    : live
      ? availableMethods.find((m) => m.id === paymentId)?.id || availableMethods[0]?.id
      : paymentId;
  const payment = paymentMethod(effectivePaymentId);
  const total = shop.subtotal + shipping.cost;
  const itemProducts = shop.cart.map((item) => ({ item, display: cartItemPresentation(item) }));

  if (shop.shared?.enabled)
    return (
      <div className="checkout-page">
        <h1>Keranjang bersama toko</h1>
        <p>
          Barang B2B disimpan dalam keranjang bersama. Admin memeriksa dan memfinalisasi pesanan
          toko. Anda dapat memantau hasilnya di Pesanan saya.
        </p>
        <a className="shop-primary" href="#/keranjang">
          Buka keranjang bersama
        </a>
      </div>
    );

  if (!shop.cart.length)
    return (
      <div className="checkout-page">
        <nav className="shop-breadcrumb" aria-label="Breadcrumb">
          <a href="#/">Beranda</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Checkout</span>
        </nav>
        <div className="checkout-empty">
          <span aria-hidden="true">🛍️</span>
          <h1>Belum ada produk untuk checkout</h1>
          <p>Tambahkan produk ke keranjang sebelum melanjutkan.</p>
          <a className="shop-primary" href="#/">
            Kembali ke katalog
          </a>
        </div>
      </div>
    );
  if (workflowUsesServer && authLoading)
    return (
      <div className="checkout-page" role="status">
        Memeriksa akun untuk checkout…
      </div>
    );
  if (workflowUsesServer && !user)
    return (
      <div className="checkout-page">
        <h1>Masuk sebelum membuat pesanan</h1>
        <p>
          Pesanan akan tersimpan pada akun Anda dan dapat dibuka dari perangkat lain. Barang tetap
          tersedia di keranjang.
        </p>
        <a className="shop-primary" href="#/login">
          Masuk ke akun
        </a>
        <a className="checkout-back" href="#/keranjang">
          Kembali ke keranjang
        </a>
      </div>
    );

  if (live && user && !user.emailVerified)
    return (
      <div className="checkout-page">
        <h1>Konfirmasi email sebelum memesan</h1>
        <p>
          Barang tetap tersedia di keranjang. Buka Keamanan akun untuk mengirim tautan verifikasi.{' '}
          {company.commerce.emailReady
            ? 'Periksa kotak masuk dan folder spam.'
            : 'Layanan email toko belum diaktifkan; hubungi pengelola toko.'}
        </p>
        <a className="shop-primary" href="#/akun">
          Buka akun saya
        </a>
      </div>
    );

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
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      if (nextErrors.namaToko || nextErrors.namaJalan) setAddressEditing(true);
      window.requestAnimationFrame(() => {
        const field = nextErrors.namaToko ? nameRef.current : addressRef.current;
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
      if (!reviewCart(shop.cart).ready) {
        setSubmitError(
          'Katalog telah berubah. Periksa barang dan gunakan harga terbaru sebelum membuat pesanan.',
        );
        window.requestAnimationFrame(() => submitErrorRef.current?.focus());
        return;
      }
      const input = {
        cart: shop.cart,
        recipient: form.namaToko,
        address: form.namaJalan,
        shipping,
        payment,
        note: orderNote,
      };
      const order = workflowUsesServer
        ? await createServerOrder(input)
        : placePreviewOrder(input, window.sessionStorage);
      if (!active.current) return;
      shop.completeOrder(order);
      window.location.assign('#/pesanan/' + encodeURIComponent(order.id));
    } catch (error) {
      if (!active.current) return;
      setSubmitError(
        error instanceof Error &&
          (workflowUsesServer || /Stok|Pesanan belum tersimpan/.test(error.message))
          ? error.message
          : 'Pesanan belum dibuat. Pastikan server dapat dihubungi dan penyimpanan browser tersedia, lalu coba lagi.',
      );
      window.requestAnimationFrame(() => submitErrorRef.current?.focus());
    } finally {
      submitLock.current = false;
      if (active.current) setBusy(false);
    }
  };

  return (
    <div className="checkout-page">
      <nav className="shop-breadcrumb" aria-label="Breadcrumb">
        <a href="#/">Beranda</a>
        <span aria-hidden="true">/</span>
        <a href="#/keranjang">Keranjang</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Checkout</span>
      </nav>
      <header className="checkout-header">
        <div>
          <span className="section-eyebrow">
            {live && !codOnly ? 'Permintaan pesanan' : 'Langkah terakhir'}
          </span>
          <h1>{live && !codOnly ? 'Kirim permintaan pesanan' : 'Checkout COD'}</h1>
          <p>
            {live
              ? codOnly
                ? 'Harga final, ongkir gratis, dan COD saat barang diterima. Pesanan langsung diproses setelah berhasil dibuat.'
                : 'Periksa barang dan alamat. Toko akan mengirimkan ongkir serta total akhir untuk Anda setujui.'
              : 'Periksa alamat dan pilihan pengiriman sebelum membuat pesanan.'}
          </p>
        </div>
        <div className="checkout-header-actions">
          <a className="checkout-back" href="#/keranjang">
            ← Kembali ke keranjang
          </a>
          <button
            className="bam-button-danger"
            type="button"
            disabled={busy}
            onClick={() => setCancelOpen(true)}
          >
            Batalkan checkout
          </button>
        </div>
      </header>
      <CartReview />
      <form
        id="checkout-form"
        className="checkout-layout"
        onSubmit={submit}
        noValidate
        aria-busy={busy}
      >
        <fieldset className="checkout-main" disabled={busy}>
          <section className="checkout-card" aria-labelledby="delivery-title">
            <div className="checkout-card-heading">
              <span className="checkout-step">1</span>
              <div>
                <h2 id="delivery-title">Alamat pengiriman</h2>
                <p>Pesanan akan dikirim ke alamat berikut.</p>
              </div>
              <button
                type="button"
                className="checkout-address-edit"
                aria-expanded={addressEditing || Boolean(errors.namaToko || errors.namaJalan)}
                aria-controls="checkout-address-fields"
                onClick={() => {
                  if (addressEditing) {
                    const nextErrors = validateDelivery(form);
                    setErrors((current) => ({
                      ...current,
                      namaToko: nextErrors.namaToko,
                      namaJalan: nextErrors.namaJalan,
                    }));
                    if (!Object.keys(nextErrors).length) setAddressEditing(false);
                    else
                      window.requestAnimationFrame(() =>
                        (nextErrors.namaToko ? nameRef.current : addressRef.current)?.focus(),
                      );
                  } else {
                    setAddressEditing(true);
                    window.requestAnimationFrame(() => nameRef.current?.focus());
                  }
                }}
              >
                {addressEditing ? 'Selesai' : 'Ubah'}
              </button>
            </div>
            <div className="checkout-address-preview">
              <strong>{form.namaToko.trim() || 'Nama penerima belum diisi'}</strong>
              <p>{form.namaJalan.trim() || 'Lengkapi alamat pengiriman.'}</p>
            </div>
            <div
              className="checkout-fields"
              id="checkout-address-fields"
              hidden={!addressEditing && !errors.namaToko && !errors.namaJalan}
            >
              <div className="checkout-field">
                <label htmlFor="checkout-name">Nama penerima</label>
                <input
                  id="checkout-name"
                  ref={nameRef}
                  type="text"
                  autoComplete="shipping name"
                  maxLength={100}
                  value={form.namaToko}
                  onChange={(event) => updateField('namaToko', event.target.value)}
                  aria-invalid={Boolean(errors.namaToko)}
                  aria-describedby={errors.namaToko ? 'checkout-name-error' : undefined}
                  placeholder="Nama lengkap penerima"
                />
                {errors.namaToko && (
                  <p id="checkout-name-error" className="checkout-error">
                    {errors.namaToko}
                  </p>
                )}
              </div>
              <div className="checkout-field">
                <label htmlFor="checkout-address">Alamat lengkap</label>
                <textarea
                  id="checkout-address"
                  ref={addressRef}
                  rows={4}
                  maxLength={500}
                  autoComplete="shipping street-address"
                  value={form.namaJalan}
                  onChange={(event) => updateField('namaJalan', event.target.value)}
                  aria-invalid={Boolean(errors.namaJalan)}
                  aria-describedby={errors.namaJalan ? 'checkout-address-error' : undefined}
                  placeholder="Nama jalan, nomor rumah, kecamatan, kota, dan kode pos"
                />
                {errors.namaJalan && (
                  <p id="checkout-address-error" className="checkout-error">
                    {errors.namaJalan}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section
            className="checkout-card checkout-products-card"
            aria-labelledby="checkout-products-title"
          >
            <div className="checkout-card-heading">
              <span className="checkout-step">2</span>
              <div>
                <h2 id="checkout-products-title">Barang yang dipesan</h2>
                <p>
                  {shop.quantity} kemasan · {shop.cart.length} pilihan produk/kemasan
                </p>
              </div>
              <a className="checkout-address-edit" href="#/keranjang">
                Ubah
              </a>
            </div>
            <ul className="checkout-items">
              {itemProducts.map(({ item, display }) => (
                <li key={item.id}>
                  <div className={'checkout-item-image ' + (display.product.color || '')}>
                    <ProductImage product={display.product} variant="thumbnail" />
                  </div>
                  <div className="checkout-item-copy">
                    {display.brand && <span className="checkout-item-brand">{display.brand}</span>}
                    <strong>{display.name}</strong>
                    <span className="checkout-size-label">
                      {display.sizeLabel ? `Ukuran ${display.sizeLabel}` : 'Ukuran belum tercatat'}
                    </span>
                    <PackagingSummary packaging={display.packaging} quantity={item.quantity} />
                    <span>
                      {item.quantity} × {rupiah(item.price)}
                    </span>
                  </div>
                  <strong className="checkout-item-subtotal">
                    {rupiah(item.price * item.quantity)}
                  </strong>
                </li>
              ))}
            </ul>
            <div className="checkout-field checkout-order-note">
              <label htmlFor="checkout-order-note">
                Catatan untuk penjual <span>(opsional)</span>
              </label>
              <textarea
                id="checkout-order-note"
                rows={3}
                maxLength={ORDER_NOTE_MAX_LENGTH}
                value={orderNote}
                onChange={(event) =>
                  setOrderNote(event.target.value.slice(0, ORDER_NOTE_MAX_LENGTH))
                }
                aria-describedby="checkout-order-note-hint checkout-order-note-count"
                placeholder="Contoh: Tolong kemas dengan aman."
              />
              <div className="checkout-order-note-footer">
                <p id="checkout-order-note-hint">Catatan hanya berlaku untuk pesanan ini.</p>
                <span id="checkout-order-note-count">
                  {orderNote.length}/{ORDER_NOTE_MAX_LENGTH} karakter
                </span>
              </div>
            </div>
          </section>

          <section className="checkout-card" aria-labelledby="shipping-title">
            <div className="checkout-card-heading">
              <span className="checkout-step">3</span>
              <div>
                <h2 id="shipping-title">{codOnly ? 'Pengiriman gratis' : 'Pilihan pengiriman'}</h2>
                <p>
                  {codOnly
                    ? 'Ongkos kirim selalu Rp0.'
                    : 'Pilih estimasi yang sesuai kebutuhan Anda.'}
                </p>
              </div>
            </div>
            <div className="checkout-options">
              {offeredShipping.map((option) => (
                <label
                  className={'checkout-option' + (shippingId === option.id ? ' is-selected' : '')}
                  key={option.id}
                >
                  <input
                    type="radio"
                    name="shipping"
                    value={option.id}
                    checked={shippingId === option.id}
                    onChange={() => setShippingId(option.id)}
                  />
                  <span className="checkout-radio" />
                  <span className="checkout-option-copy">
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                  <strong className="checkout-option-price">
                    {codOnly ? 'GRATIS' : live ? 'Belum ditetapkan' : rupiah(option.cost)}
                  </strong>
                </label>
              ))}
            </div>
          </section>

          <section className="checkout-card" aria-labelledby="payment-title">
            <div className="checkout-card-heading">
              <span className="checkout-step">4</span>
              <div>
                <h2 id="payment-title">Metode pembayaran</h2>
                <p>
                  {codOnly
                    ? 'Metode pembayaran toko hanya COD.'
                    : 'Pilih layanan yang ingin digunakan.'}
                </p>
              </div>
            </div>
            {codOnly ? (
              <p className="workflow-preview">
                COD (Bayar di Tempat) — bayar saat barang diterima.
              </p>
            ) : (
              <PaymentPicker value={effectivePaymentId} onChange={setPaymentId} disabled={busy} />
            )}
            {workflowUsesServer && (
              <p className="workflow-preview">
                {codOnly
                  ? 'Harga sudah final. Tidak ada konfirmasi tambahan; bayar COD saat barang diterima.'
                  : 'Permintaan pesanan perlu disetujui toko. Stok baru ditahan setelah persetujuan. Batas pemeriksaan akan terlihat pada detail pesanan. Tunggu instruksi resmi toko untuk pembayaran; COD dibayar saat barang diterima.'}
              </p>
            )}
          </section>
        </fieldset>

        <aside className="checkout-summary" aria-labelledby="summary-title">
          <h2 id="summary-title">Ringkasan pesanan</h2>
          <p className="checkout-summary-count">
            {shop.quantity} kemasan · {shop.cart.length} pilihan produk/kemasan
          </p>
          <p className="checkout-selected-payment">
            Pembayaran <strong>{payment?.label || 'Belum tersedia'}</strong>
          </p>
          <div className="checkout-totals">
            <div>
              <span>Subtotal</span>
              <strong>{rupiah(shop.subtotal)}</strong>
            </div>
            <div>
              <span>Ongkir</span>
              <strong>
                {codOnly ? 'GRATIS' : live ? 'Dikonfirmasi toko' : rupiah(shipping.cost)}
              </strong>
            </div>
            <div className="checkout-total">
              <span>{live && !codOnly ? 'Subtotal sementara' : 'Total pembayaran'}</span>
              <strong>{rupiah(total)}</strong>
            </div>
          </div>
          {submitError && (
            <p className="checkout-submit-error" ref={submitErrorRef} tabIndex={-1} role="alert">
              {submitError}
            </p>
          )}
          <button
            type="submit"
            className="checkout-submit checkout-desktop-submit"
            disabled={busy || !shop.cartReview.ready || (live && !availableMethods.length)}
          >
            {busy
              ? 'Memeriksa pesanan…'
              : `${live && !codOnly ? 'Kirim permintaan' : 'Buat pesanan COD'} · ${rupiah(total)}`}
          </button>
          {!shop.cartReview.ready && (
            <p className="checkout-note" role="status">
              Perbaiki barang pada keranjang untuk melanjutkan.
            </p>
          )}
          <p className="checkout-note">
            {workflowUsesServer
              ? codOnly
                ? 'Harga final saat checkout. Gratis ongkir dan bayar COD saat barang diterima.'
                : 'Permintaan belum menjamin stok. Toko menetapkan ongkir dan total akhir; Anda menyetujuinya sebelum pembayaran. Pembaruan pesanan dikirim melalui email.'
              : 'Pesanan dan pembayaran masih simulasi. Tidak ada pembayaran yang diproses.'}
          </p>
        </aside>
        <div className="checkout-action-bar">
          <div className="checkout-action-total">
            <span>{live && !codOnly ? 'Subtotal sementara' : 'Total pembayaran'}</span>
            <strong aria-live="polite">{rupiah(total)}</strong>
            <small>
              {codOnly ? 'Gratis ongkir · COD' : live ? 'Belum termasuk ongkir' : 'Termasuk ongkir'}
            </small>
          </div>
          <button
            type="submit"
            className="checkout-submit"
            disabled={busy || !shop.cartReview.ready || (live && !availableMethods.length)}
          >
            {busy ? 'Memeriksa…' : live && !codOnly ? 'Kirim permintaan' : 'Buat pesanan COD'}
          </button>
        </div>
      </form>
      {cancelOpen && <CancelShoppingDialog checkout onClose={() => setCancelOpen(false)} />}
    </div>
  );
}
