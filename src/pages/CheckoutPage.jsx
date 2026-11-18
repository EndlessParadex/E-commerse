import useCompany from '../state/useCompany';
import { useEffect, useRef, useState } from 'react';
import PackagingSummary from '../components/shop/PackagingSummary';
import DeliveryPlan from '../components/account/DeliveryPlan';
import { cartItemPresentation } from '../data/cartItemPresentation';
import {
  formAddress,
  shippingForm,
  usesLegacyAddress,
  validateShipping,
} from '../state/deliveryModel';
import { products } from '../data/products';
import { loadPromotions, promotionOf, usePromotions } from '../data/promotionStore';
import { lineFree, promotionLabel } from '../data/promotions';
import BelitungAddressFields from '../components/account/BelitungAddressFields';
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

// Old accounts may keep their free-text address until they edit it (allowLegacy).
const check = (form) => validateShipping(form, { allowLegacy: true });

export default function CheckoutPage() {
  const shop = useShop();
  const company = useCompany();
  const live = workflowUsesServer && company.commerce?.version === 31;
  const codOnly = live && company.commerce?.codOnly === true;
  const { savedLocation, user, authLoading } = useDelivery();
  const [form, setForm] = useState(() => shippingForm(savedLocation));
  const [addressEditing, setAddressEditing] = useState(
    () => Object.keys(check(shippingForm(savedLocation))).length > 0,
  );
  const nameRef = useRef(null);
  const streetRef = useRef(null);
  const villageRef = useRef(null);
  const focusAddressError = (nextErrors) =>
    window.requestAnimationFrame(() =>
      (nextErrors.namaToko
        ? nameRef.current
        : nextErrors.jalan
          ? streetRef.current
          : villageRef.current
      )?.focus(),
    );
  const submitErrorRef = useRef(null);
  const [edited, setEdited] = useState(false);
  const [shippingId, setShippingId] = useState('regular');
  const [paymentId, setPaymentId] = useState('cod');
  const [errors, setErrors] = useState({});
  const addressInvalid = Boolean(errors.namaToko || errors.jalan || errors.desa);
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
      setForm(shippingForm(savedLocation));
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
  const promotions = usePromotions();
  const freeFor = (item) => {
    const current = products.find((product) => product.id === item.id);
    return lineFree(
      promotionOf(item.id, promotions),
      item.quantity,
      current ? shop.stockFor(current).maximum : item.quantity,
    );
  };
  const itemProducts = shop.cart.map((item) => ({
    item,
    display: cartItemPresentation(item),
    free: freeFor(item),
  }));
  const freeUnits = itemProducts.reduce((sum, entry) => sum + entry.free, 0);

  if (shop.shared?.enabled && shop.cartMode === 'store')
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

  if (live && user && !(user.orderReady ?? user.emailVerified))
    return (
      <div className="checkout-page">
        <h1>Konfirmasi nomor WhatsApp sebelum memesan</h1>
        <p>
          Barang tetap tersedia di keranjang. Buka Profil akun, lalu kirim kode ke nomor WhatsApp
          Anda dan masukkan kodenya.
          {user.email && !user.emailVerified && company.commerce.emailReady
            ? ' Atau konfirmasi email lewat tautan di Keamanan akun.'
            : ''}
        </p>
        <a className="shop-primary" href="#/akun/profil">
          Buka Profil akun
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
    const nextErrors = check(form);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setAddressEditing(true);
      focusAddressError(nextErrors);
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
        // Promotions loaded: tell the server what the buyer saw as free.
        cart: promotions.loaded
          ? shop.cart.map((item) => ({ ...item, expectedFree: freeFor(item) }))
          : shop.cart,
        recipient: form.namaToko,
        address: formAddress(form),
        ...(usesLegacyAddress(form) ? {} : { street: form.jalan, villageCode: form.desa }),
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
      // A promotion or its stock changed: show the current free units before trying again.
      if (error?.code === 'promotion_changed' || /promo/i.test(error?.message || ''))
        loadPromotions();
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
      {live && <DeliveryPlan key={user?.id} />}
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
                aria-expanded={addressEditing || addressInvalid}
                aria-controls="checkout-address-fields"
                onClick={() => {
                  if (addressEditing) {
                    const nextErrors = check(form);
                    setErrors((current) => ({
                      ...current,
                      namaToko: nextErrors.namaToko,
                      jalan: nextErrors.jalan,
                      desa: nextErrors.desa,
                    }));
                    if (!Object.keys(nextErrors).length) setAddressEditing(false);
                    else focusAddressError(nextErrors);
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
              <p>{formAddress(form) || 'Lengkapi alamat pengiriman.'}</p>
              {usesLegacyAddress(form) && (
                <p className="checkout-legacy-address">
                  Alamat ini belum memakai pilihan kelurahan/desa. Pesanan tetap bisa dibuat; pilih
                  Ubah untuk melengkapinya.
                </p>
              )}
            </div>
            <div
              className="checkout-fields"
              id="checkout-address-fields"
              hidden={!addressEditing && !addressInvalid}
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
              <BelitungAddressFields
                idPrefix="checkout"
                value={form}
                errors={errors}
                disabled={busy}
                onChange={updateField}
                streetRef={streetRef}
                villageRef={villageRef}
                classes={{
                  field: 'checkout-field',
                  error: 'checkout-error',
                  hint: 'checkout-hint',
                }}
              />
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
              {itemProducts.map(({ item, display, free }) => (
                <li key={item.id}>
                  <div className="checkout-item-image">
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
                    {free > 0 && (
                      <span className="checkout-item-free">
                        🎁 + {free} {display.packaging?.packagingType || 'barang'} gratis ·{' '}
                        {promotionLabel(promotionOf(item.id, promotions))}
                      </span>
                    )}
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
                    ? 'Pembayaran hanya COD (bayar di tempat).'
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
            {freeUnits > 0 && (
              <div className="checkout-free-total">
                <span>Barang gratis promo</span>
                <strong>{freeUnits} kemasan</strong>
              </div>
            )}
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
