import { useCallback, useEffect, useState } from 'react';
import { useShop } from '../../state/useShop';
import ProductImage from './ProductImage';
import { products } from '../../data/products';
import { rupiah } from './shopPresentation';
import { cartItemPresentation } from '../../data/cartItemPresentation';
import './SharedCartPage.css';
import AdminCartProcessing, { AdminB2BBanks, AdminCartQueue } from './AdminCartProcessing';
import { nextStoreDelivery } from '../../data/b2bDeliverySchedule';
import { packagingLabel } from '../../data/productPackaging';
import { sharedDraftWhatsAppUrl } from '../../data/sharedDraftWhatsApp';
import SharedDeliveryCalendar from './SharedDeliveryCalendar';
import SharedStoreCartHeader from './SharedStoreCartHeader';
import StoreCardsSelector from './StoreCardsSelector';
import { storeCartTarget } from '../../data/storeCartTarget';
import {
  dateLabel,
  timeLabel,
  roles,
  todayID,
  weekdays,
  eventLabel,
} from '../../data/sharedCartPresentation';
import { AdminCartAdd, CartRemove, CartQuantity } from './SharedCartItemControls';
import AdminCartWorkspace from './AdminCartWorkspace';

export function SharedCartBar() {
  const { shared, setCartMode } = useShop();
  if (shared?.personal)
    return (
      <aside className="shared-cart-bar" aria-label="Mode belanja pribadi">
        <span>
          <strong>Belanja pribadi</strong>
          {' · pesanan atas nama Anda sendiri, terpisah dari keranjang toko'}
        </span>
        <a href="#/keranjang" onClick={() => setCartMode('store')}>
          Ke keranjang toko →
        </a>
      </aside>
    );
  if (!shared?.enabled) return null;
  return (
    <aside className="shared-cart-bar" aria-label="Toko keranjang aktif">
      <span>
        <strong>Keranjang bersama</strong>
        {shared.cart
          ? ` · ${shared.cart.store.storeName} · ${dateLabel(shared.cart.date)}`
          : shared.status === 'loading'
            ? ' · Memeriksa akun…'
            : ' · Pilih toko dan periode'}
      </span>
      <span>
        <a href="#/keranjang">{shared.cart ? 'Buka / ganti toko →' : 'Pilih toko →'}</a>
        {shared.canChooseCart && (
          <>
            {' · '}
            <a href="#/cari?q=" onClick={() => setCartMode('personal')}>
              Belanja pribadi →
            </a>
          </>
        )}
      </span>
    </aside>
  );
}

export default function SharedCartPage({ adminView = false }) {
  const shop = useShop();
  const { shared } = shop;
  const [query, setQuery] = useState('');
  const [storeId, setStoreId] = useState(shared.selection.storeId);
  const [date, setDate] = useState(shared.selection.date);
  const [clearRevision, setClearRevision] = useState(null);
  const [adminSection, setAdminSection] = useState('queue');
  const [storeModalOpen, setStoreModalOpen] = useState(false);
  const [selectingStore, setSelectingStore] = useState(false);
  const closeStoreModal = useCallback(() => setStoreModalOpen(false), []);
  const chooseStoreCard = async (store) => {
    if (frozen || selectingStore) return;
    if (cart && store.id !== cart.store.id) {
      const unsaved = Array.from(document.querySelectorAll('.shared-item-compact')).some(
        (row, index) => {
          const input = row.querySelector('.shared-quantity input');
          return (
            input && cart.items[index] && input.value.trim() !== String(cart.items[index].quantity)
          );
        },
      );
      if (
        unsaved &&
        !window.confirm(
          'Ada jumlah barang yang belum disimpan. Ganti toko dan batalkan isian tersebut?',
        )
      )
        return;
    }
    setSelectingStore(true);
    try {
      const selected = await shared.choose(storeCartTarget(store, shared.selection.date));
      if (selected) closeStoreModal();
    } finally {
      setSelectingStore(false);
    }
  };
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setStoreId(shared.selection.storeId);
    setDate(shared.selection.date);
    setClearRevision(null);
  }, [shared.selection.storeId, shared.selection.date]);
  const frozen = shared.busy || shared.uncertain || shared.reading;
  const { cart, stores, cycles } = shared;
  const selectedNotListed = cart && !stores.stores.some((store) => store.id === cart.store.id);
  const buyerStore =
    stores.stores.find((store) => store.id === storeId) ||
    (cart?.store.id === storeId ? cart.store : null);
  const buyerSchedule = buyerStore?.deliverySchedule;
  const buyerFixedDate = nextStoreDelivery(buyerSchedule, todayID());
  const isAdmin = adminView && ['admin', 'owner'].includes(shared.role);
  const showSelection = !isAdmin || adminSection === 'history';
  const showCart = !isAdmin || adminSection === 'cart';
  const sections = [
    {
      id: 'queue',
      label: 'Antrean',
      description: 'Cari toko dan buka keranjang yang perlu diproses.',
    },
    {
      id: 'cart',
      label: 'Isi Keranjang',
      description: 'Pilih toko, kelola barang, dan lakukan finalisasi.',
    },
    {
      id: 'history',
      label: 'Riwayat',
      description: 'Lihat catatan perubahan dan periode keranjang toko.',
    },
    ...(shared.role === 'owner'
      ? [
          {
            id: 'banks',
            label: 'Rekening Transfer',
            description: 'Atur rekening resmi BCA, BRI, dan Mandiri.',
          },
        ]
      : []),
  ];
  const activeSection = sections.find((section) => section.id === adminSection);
  const storePicker = (
    <details
      className="shared-cart-selection shared-selection-panel"
      key={cart ? 'active:' + cart.store.id + ':' + cart.date : 'choose-store'}
      open={!cart}
    >
      <summary className="shared-selection-trigger">
        <span className="shared-selection-label">
          <strong id="shared-selection-title">Toko dan periode</strong>
          <small>
            {cart
              ? cart.store.storeName + ' · ' + dateLabel(cart.date)
              : 'Pilih toko dan rencana pengiriman'}
          </small>
        </span>
        <span className="shared-selection-action">
          {cart ? 'Ganti toko / periode' : 'Pilih toko'}
        </span>
      </summary>
      <div className="shared-selection-content">
        <form
          className="shared-open-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (storeId && (buyerFixedDate || date))
              void shared.choose({ storeId, date: buyerFixedDate || date });
          }}
        >
          <label htmlFor="shared-store">
            Toko
            <select
              id="shared-store"
              required
              value={storeId}
              disabled={frozen}
              onChange={(event) => {
                const id = event.target.value;
                setStoreId(id);
                const match = stores.stores.find((store) => store.id === id);
                if (match?.deliverySchedule)
                  setDate(nextStoreDelivery(match.deliverySchedule, todayID()));
              }}
            >
              <option value="">Pilih toko</option>
              {selectedNotListed && (
                <option value={cart.store.id}>
                  {cart.store.storeName} · {cart.store.storeCode}
                </option>
              )}
              {stores.stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.storeName} · {store.storeCode}
                </option>
              ))}
            </select>
          </label>
          {buyerSchedule ? (
            <div className="shared-admin-fixed-delivery">
              <strong>
                Jadwal: {weekdays[buyerSchedule.weekday]} · setiap {buyerSchedule.intervalWeeks}{' '}
                minggu
              </strong>
              <span>Berikutnya: {dateLabel(buyerFixedDate)}</span>
            </div>
          ) : (
            <label htmlFor="shared-date">
              Tanggal rencana pengiriman
              <input
                id="shared-date"
                type="date"
                required
                min="2000-01-01"
                max="2099-12-31"
                value={date}
                disabled={frozen}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
          )}
          <button
            className="shop-primary"
            disabled={frozen || !storeId || !(buyerFixedDate || date)}
          >
            Buka keranjang
          </button>
        </form>

        <details className="shared-store-search-details">
          <summary>
            Cari toko lain <span>{stores.total} toko tersedia</span>
          </summary>
          <div className="shared-store-search-body">
            <form
              className="shared-store-search"
              onSubmit={(event) => {
                event.preventDefault();
                void shared.findStores(query);
              }}
            >
              <label htmlFor="shared-store-query">Cari toko yang dapat Anda akses</label>
              <div>
                <input
                  id="shared-store-query"
                  type="search"
                  maxLength="200"
                  value={query}
                  disabled={frozen}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Nama atau kode toko"
                />
                <button className="bam-button-secondary" disabled={frozen}>
                  Cari
                </button>
              </div>
            </form>

            <div className="shared-pagination">
              <span>
                {stores.total} toko · Halaman {stores.page}/{stores.pages}
              </span>
              <button
                type="button"
                disabled={frozen || stores.page <= 1}
                onClick={() => shared.findStores(query, stores.page - 1)}
              >
                Sebelumnya
              </button>
              <button
                type="button"
                disabled={frozen || stores.page >= stores.pages}
                onClick={() => shared.findStores(query, stores.page + 1)}
              >
                Berikutnya
              </button>
            </div>
            {!stores.total && (
              <p>
                Belum ada toko pada daftar ini. Untuk akun pembeli/Sales, Pemilik BAM perlu
                menghubungkan akun melalui menu Toko &amp; Sales.
              </p>
            )}
          </div>
        </details>
      </div>
    </details>
  );
  return (
    <div className="shop-page shared-cart-page">
      {!adminView && (
        <>
          <nav className="shop-breadcrumb" aria-label="Breadcrumb">
            <a href="#/">Beranda</a>
            <span>/</span>
            <span>Keranjang bersama</span>
          </nav>
          <header className="shop-page-header">
            <h1>Keranjang bersama toko</h1>
            <p>Atur jumlah kemasan; Admin memeriksa dan memfinalisasi pesanan.</p>
          </header>
        </>
      )}
      {!isAdmin && storeModalOpen && shared.status === 'ready' && (
        <StoreCardsSelector
          variant="modal"
          shared={shared}
          activeId={cart?.store.id}
          disabled={frozen || selectingStore}
          onChoose={chooseStoreCard}
          onClose={closeStoreModal}
        />
      )}
      {shared.status === 'loading' && <p role="status">Memuat toko dan keranjang…</p>}
      {shared.status === 'ready' && isAdmin && (
        <div className="shared-admin-navigation">
          <div className="shared-admin-tabs" role="tablist" aria-label="Submenu keranjang bersama">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                id={'shared-tab-' + section.id}
                role="tab"
                aria-selected={adminSection === section.id}
                aria-controls={'shared-panel-' + section.id}
                className={'shared-admin-tab' + (adminSection === section.id ? ' is-active' : '')}
                onClick={() => setAdminSection(section.id)}
              >
                {section.label}
              </button>
            ))}
          </div>
          <p className="shared-admin-tab-description">{activeSection?.description}</p>
        </div>
      )}
      {shared.status === 'ready' && isAdmin && adminSection === 'queue' && (
        <div id="shared-panel-queue" role="tabpanel" aria-labelledby="shared-tab-queue">
          <AdminCartQueue
            shared={shared}
            onOpenCart={async (target) => {
              const chosen = await shared.choose(target);
              if (chosen) setAdminSection('cart');
            }}
          />
        </div>
      )}
      {shared.status === 'ready' && isAdmin && adminSection === 'banks' && (
        <div id="shared-panel-banks" role="tabpanel" aria-labelledby="shared-tab-banks">
          <AdminB2BBanks />
        </div>
      )}
      {shared.status === 'ready' && isAdmin && adminSection === 'cart' && (
        <AdminCartWorkspace
          shop={shop}
          shared={shared}
          query={query}
          setQuery={setQuery}
          storeId={storeId}
          setStoreId={setStoreId}
          date={date}
          setDate={setDate}
          stores={stores}
          cart={cart}
          frozen={frozen}
          selectedNotListed={selectedNotListed}
          clearRevision={clearRevision}
          setClearRevision={setClearRevision}
        />
      )}
      {shared.status === 'legacy' && (
        <p className="shop-warning">
          Halaman ini memerlukan server B2B terbaru. Pembeli perlu dihubungkan ke toko oleh Pemilik
          BAM.
        </p>
      )}
      {shared.error && (
        <div className="shop-warning" role="alert">
          <p>{shared.error}</p>
          <button
            type="button"
            className="bam-button-secondary"
            disabled={shared.busy}
            onClick={
              shared.uncertain
                ? shared.retryPending
                : shared.status === 'error'
                  ? shared.retry
                  : shared.refresh
            }
          >
            {shared.uncertain ? 'Pastikan penyimpanan' : 'Coba lagi / muat terbaru'}
          </button>
        </div>
      )}
      {shared.status === 'ready' && showSelection && (
        <div
          id={isAdmin ? 'shared-panel-' + adminSection : undefined}
          role={isAdmin ? 'tabpanel' : undefined}
          aria-labelledby={isAdmin ? 'shared-tab-' + adminSection : undefined}
        >
          {(!cart || isAdmin) && storePicker}
          {shared.reading && <p role="status">Memuat keranjang terbaru…</p>}
          {shared.notice && (
            <p className="shared-save-notice" role="status">
              ✓ {shared.notice}
            </p>
          )}
          {cart && (
            <>
              {isAdmin ? (
                <section className="shared-cart-heading" data-revision={cart.revision}>
                  <div>
                    <h2>{cart.store.storeName}</h2>
                    {!isAdmin && (
                      <button
                        type="button"
                        className="bam-button-secondary shared-switch-store"
                        disabled={frozen || selectingStore}
                        onClick={() => setStoreModalOpen(true)}
                      >
                        Ganti Toko
                      </button>
                    )}
                    <div className="shared-cart-dateline">
                      <span>
                        {cart.store.storeCode} · {dateLabel(cart.date)}
                        {cart.overdue && (
                          <strong className="shared-overdue-label"> · Lewat jadwal</strong>
                        )}
                      </span>
                      {!isAdmin && (
                        <SharedDeliveryCalendar
                          compact
                          date={cart.date}
                          schedule={cart.store.deliverySchedule}
                          disabled={frozen}
                          onChoose={(selected) =>
                            void shared.choose({ storeId: cart.store.id, date: selected })
                          }
                        />
                      )}
                    </div>
                    <p className="shared-cart-overview">
                      {cart.items.length} SKU · {shop.quantity} kemasan
                      <span className={'shared-cart-status status-' + cart.status}>
                        {cart.status === 'open'
                          ? cart.reviewRequested
                            ? 'Menunggu pemeriksaan Admin'
                            : 'Draft terbuka'
                          : cart.status === 'locked'
                            ? 'Diperiksa Admin'
                            : 'Pesanan final'}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    className="bam-button-secondary"
                    disabled={frozen}
                    onClick={shared.refresh}
                    aria-label="Muat terbaru"
                    title="Muat terbaru"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7" />
                    </svg>
                    <span className="shared-quantity-submit-sr">Muat terbaru</span>
                  </button>
                </section>
              ) : (
                <SharedStoreCartHeader
                  cart={cart}
                  quantity={shop.quantity}
                  frozen={frozen}
                  selectingStore={selectingStore}
                  onSwitchStore={() => setStoreModalOpen(true)}
                  onRefresh={shared.refresh}
                  onChooseDate={(selected) =>
                    void shared.choose({ storeId: cart.store.id, date: selected })
                  }
                  dateLabel={dateLabel}
                />
              )}
              {showCart && (
                <>
                  {!cart.canEdit && (
                    <p className="shop-warning">
                      {shared.role === 'admin' || shared.role === 'owner'
                        ? cart.status === 'finalized'
                          ? 'Keranjang sudah menjadi pesanan. Perubahan berikutnya dikelola pada Pesanan toko.'
                          : 'Keranjang dikunci. Buka kembali melalui Pemrosesan Admin untuk memperbaiki barang.'
                        : cart.status === 'finalized'
                          ? 'Keranjang ini sudah menjadi pesanan dan hanya dapat dilihat.'
                          : 'Keranjang dikunci untuk pemeriksaan Admin dan hanya dapat dilihat.'}
                    </p>
                  )}
                  {cart.orderId && (
                    <p className="shared-save-notice">
                      <a href={'#/pesanan/' + encodeURIComponent(cart.orderId)}>
                        Lihat pesanan toko →
                      </a>
                    </p>
                  )}
                  {['admin', 'owner'].includes(shared.role) && (
                    <AdminCartProcessing key={cart.store.id + cart.date} shared={shared} />
                  )}
                  {shared.busy && <p role="status">Menyimpan perubahan…</p>}
                  {shop.cartReview.issues.length > 0 && (
                    <section className="shop-warning" aria-label="Perubahan katalog">
                      <p>Katalog berubah. Periksa SKU berikut sebelum diproses:</p>
                      <ul>
                        {shop.cartReview.issues.map((issue) => (
                          <li key={issue.id}>
                            {issue.name}:{' '}
                            {issue.type === 'unavailable'
                              ? 'tidak lagi tersedia; hapus barang ini'
                              : 'informasi atau harga berubah'}
                          </li>
                        ))}
                      </ul>
                      {shop.cartReview.issues.some((issue) => issue.type === 'changed') &&
                        cart.canEdit && (
                          <button
                            type="button"
                            className="bam-button-secondary"
                            disabled={!shared.canEdit}
                            onClick={() => shared.mutate('refresh')}
                          >
                            Gunakan informasi dan harga terbaru
                          </button>
                        )}
                    </section>
                  )}
                  <div className="shared-cart-layout">
                    <div>
                      {cart.items.length ? (
                        <ul className="shared-items">
                          {cart.items.map((item) => {
                            const display = cartItemPresentation(item);
                            const current = products.find((product) => product.id === item.id);
                            return (
                              <li
                                key={item.id}
                                className={
                                  'shared-item shared-item-compact shared-product-card' +
                                  (!cart.canEdit ? ' is-readonly' : '')
                                }
                              >
                                <div className="shared-item-identity">
                                  <div
                                    className={'shared-item-photo ' + (display.product.color || '')}
                                  >
                                    <ProductImage product={display.product} variant="thumbnail" />
                                  </div>
                                  <div className="shared-item-copy">
                                    <h3>
                                      {display.detailHref ? (
                                        <a href={display.detailHref}>
                                          {display.name} {display.sizeLabel}
                                        </a>
                                      ) : (
                                        [display.name, display.sizeLabel].filter(Boolean).join(' ')
                                      )}
                                    </h3>
                                    <div className="shared-item-meta">
                                      <span className="shared-sku">SKU: {item.id}</span>
                                      {item.packageOptions?.length > 1 && cart.canEdit ? (
                                        <select
                                          className="shared-item-pkg-select"
                                          aria-label={'Jenis kemasan ' + display.name}
                                          value={item.id}
                                          disabled={!shared.canEdit}
                                          onChange={async (event) => {
                                            const input = event.currentTarget;
                                            const targetProductId = input.value;
                                            if (targetProductId === item.id) return;
                                            const saved = await shared.mutate(
                                              'switch_package',
                                              item.id,
                                              undefined,
                                              cart.revision,
                                              { targetProductId },
                                            );
                                            if (!saved) input.value = item.id;
                                          }}
                                        >
                                          {item.packageOptions.map((option) => (
                                            <option value={option.id} key={option.id}>
                                              {option.label} · {rupiah(option.price)}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <span className="shared-item-pkg-label">
                                          {packagingLabel(item.packaging || {})}
                                        </span>
                                      )}
                                    </div>
                                    <span className="shared-item-price">
                                      <strong>{rupiah(item.price)}</strong> /{' '}
                                      {item.packaging?.packagingType || 'kemasan'}
                                    </span>
                                  </div>
                                </div>
                                <div className="shared-item-controls">
                                  <div className="shared-product-quantity-panel">
                                    <span className="shared-product-panel-label">
                                      Jumlah kemasan
                                    </span>
                                    {cart.canEdit ? (
                                      <CartQuantity item={item} shared={shared} />
                                    ) : (
                                      <span className="shared-item-readonly-quantity">
                                        {item.quantity} kemasan
                                      </span>
                                    )}
                                  </div>
                                  <div className="shared-product-subtotal-panel">
                                    <span className="shared-product-panel-label">Subtotal</span>
                                    <span className="shared-line-total">
                                      <strong>{rupiah(item.price * item.quantity)}</strong>
                                    </span>
                                  </div>
                                </div>
                                {cart.canEdit && <CartRemove item={item} shared={shared} />}
                                {!current && !item.packageOptions?.length && (
                                  <p className="shop-warning">
                                    SKU ini sudah tidak tersedia di katalog.
                                  </p>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <div className="shop-empty">
                          <h3>Keranjang periode ini kosong</h3>
                          <p>Tambahkan barang dari katalog setelah memilih toko ini.</p>
                        </div>
                      )}
                      {cart.canEdit &&
                        (adminView ? (
                          <AdminCartAdd key={cart.store.id + cart.date} shared={shared} />
                        ) : (
                          <a className="shop-primary shared-browse" href="#/cari?q=">
                            Pilih barang dari katalog →
                          </a>
                        ))}
                    </div>
                    <aside className="shared-cart-summary">
                      <h2>Ringkasan keranjang</h2>
                      <p>
                        {cart.items.length} SKU · {shop.quantity} kemasan
                      </p>
                      <p>
                        Subtotal barang <strong>{rupiah(shop.subtotal)}</strong>
                      </p>
                      {!isAdmin && cart.status === 'open' && (
                        <div className="shared-cart-actions">
                          {cart.reviewRequested ? (
                            <p className="shared-review-message" role="status">
                              Permintaan pemeriksaan telah dicatat. Admin dapat mengunci dan
                              memfinalisasi. Jika isi keranjang berubah, ajukan kembali.
                            </p>
                          ) : (
                            <button
                              type="button"
                              className="shop-primary shared-request-review"
                              disabled={!shared.canEdit || !cart.items.length}
                              onClick={() => void shared.mutate('request_review')}
                            >
                              Ajukan keranjang ke Admin →
                            </button>
                          )}
                          {shared.role === 'sales' && sharedDraftWhatsAppUrl(cart) && (
                            <a
                              className="bam-button-secondary shared-whatsapp-link"
                              href={sharedDraftWhatsAppUrl(cart)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Buka rekap draft di WhatsApp
                            </a>
                          )}
                          {shared.role === 'sales' && (
                            <small>
                              Rekap WhatsApp belum final. Periksa nomor penerima dan pastikan toko
                              setuju menerima pesan. Pengiriman dilakukan di WhatsApp.
                            </small>
                          )}
                        </div>
                      )}

                      <section
                        className="shared-cart-payment shared-cart-payment-compact"
                        aria-labelledby="shared-payment-title"
                      >
                        <div className="shared-payment-description">
                          <h2 id="shared-payment-title">Pembayaran toko</h2>
                          <p>Berlaku untuk seluruh keranjang periode ini.</p>
                        </div>
                        <div className="shared-payment-field">
                          {['buyer', 'sales'].includes(shared.role) && cart.status === 'open' ? (
                            <label htmlFor="shared-cart-payment">
                              Metode pembayaran
                              <select
                                id="shared-cart-payment"
                                value={cart.paymentId || 'cod'}
                                disabled={!shared.canEdit}
                                onChange={(event) =>
                                  void shared.mutate('payment', event.target.value)
                                }
                              >
                                <option value="cod">COD — Bayar di Tempat</option>
                                <option value="transfer-bca">Transfer BCA</option>
                                <option value="transfer-bri">Transfer BRI</option>
                                <option value="transfer-mandiri">Transfer Mandiri</option>
                              </select>
                            </label>
                          ) : (
                            <p className="shared-payment-readonly">
                              <strong>{cart.payment?.label || 'COD — Bayar di Tempat'}</strong>
                            </p>
                          )}
                        </div>
                        <p className="shared-payment-help">
                          {cart.payment?.groupId === 'transfer'
                            ? 'Rekening dan unggah bukti tersedia setelah finalisasi Admin, pada Detail Pesanan.'
                            : 'Bayar saat barang diterima; pelunasan dicatat Admin.'}
                        </p>
                        {['admin', 'owner'].includes(shared.role) && (
                          <small className="shared-payment-admin-note">
                            Admin hanya memeriksa pilihan pembayaran pembeli toko atau Sales.
                          </small>
                        )}
                      </section>

                      <details className="shared-summary-help">
                        <summary>Catatan harga dan stok</summary>
                        <p>
                          {cart.status === 'finalized'
                            ? 'Harga dan barang sudah dicatat pada pesanan final.'
                            : 'Harga dapat berubah sampai finalisasi Admin. Persediaan diperiksa saat finalisasi.'}
                        </p>
                        <p>Isi diperiksa berkala setiap 5 detik saat halaman aktif.</p>
                      </details>
                      {cart.updatedAt && (
                        <p className="shared-summary-update">
                          Disimpan: {timeLabel(cart.updatedAt)} WIB
                        </p>
                      )}
                      {cart.canEdit && cart.items.length > 0 && (
                        <button
                          type="button"
                          className="bam-button-danger"
                          disabled={!shared.canEdit}
                          onClick={() => setClearRevision(cart.revision)}
                        >
                          Kosongkan keranjang
                        </button>
                      )}
                      {clearRevision !== null && (
                        <div
                          className="shared-clear-confirm"
                          role="group"
                          aria-label="Konfirmasi kosongkan keranjang"
                        >
                          <p>
                            Hapus semua barang dari keranjang toko dan periode ini? Pembeli dan
                            Sales akan melihat keranjang kosong.
                          </p>
                          <button
                            type="button"
                            className="bam-button-danger"
                            disabled={!shared.canEdit}
                            onClick={async () => {
                              await shared.mutate('clear', undefined, undefined, clearRevision);
                              setClearRevision(null);
                            }}
                          >
                            Ya, kosongkan
                          </button>
                          <button
                            type="button"
                            className="bam-button-secondary"
                            disabled={frozen}
                            onClick={() => setClearRevision(null)}
                          >
                            Kembali
                          </button>
                        </div>
                      )}
                    </aside>
                  </div>
                </>
              )}
              {(!isAdmin || adminSection === 'history') && (
                <div
                  className="shared-cart-activity-grid"
                  aria-label="Aktivitas dan periode keranjang"
                >
                  <details
                    key={'activity:' + cart.store.id + ':' + cart.date}
                    className="shared-history shared-history-panel"
                    open={isAdmin && adminSection === 'history'}
                  >
                    <summary className="shared-activity-heading">
                      <span className="shared-activity-heading-text">
                        <strong>Riwayat perubahan</strong>
                        <small>Catatan barang, pembayaran, dan akun yang mengubahnya</small>
                      </span>
                      <span className="shared-activity-counter">
                        {cart.events.length}
                        {cart.hasMore ? '+' : ''} aktivitas
                      </span>
                      <span className="shared-activity-chevron" aria-hidden="true" />
                    </summary>
                    <div className="shared-activity-body">
                      {cart.events.length ? (
                        <ol className="shared-activity-timeline">
                          {cart.events.map((event) => (
                            <li className="shared-activity-item" key={event.revision}>
                              <div className="shared-activity-item-head">
                                <strong>{event.actorName}</strong>
                                <span className="shared-activity-role">
                                  {roles[event.actorRole] || 'Pengguna'}
                                </span>
                              </div>
                              <p className="shared-activity-description">{eventLabel(event)}</p>
                              <div className="shared-activity-item-meta">
                                <small>{timeLabel(event.createdAt)} WIB</small>
                                <small>Versi {event.revision}</small>
                              </div>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="shared-activity-empty">
                          Belum ada perubahan pada periode ini.
                        </p>
                      )}
                      {cart.hasMore && (
                        <button
                          type="button"
                          className="bam-button-secondary"
                          disabled={shared.reading}
                          onClick={shared.olderEvents}
                        >
                          Lihat riwayat lebih lama
                        </button>
                      )}
                    </div>
                  </details>
                  <details
                    key={'cycles:' + cart.store.id + ':' + cart.date}
                    className="shared-history shared-cycle-panel"
                    open={isAdmin && adminSection === 'history'}
                  >
                    <summary className="shared-activity-heading">
                      <span className="shared-activity-heading-text">
                        <strong>Periode keranjang</strong>
                        <small>Lihat keranjang toko pada periode lainnya</small>
                      </span>
                      <span className="shared-activity-chevron" aria-hidden="true" />
                    </summary>
                    <div className="shared-activity-body">
                      <ul className="shared-cycle-list">
                        {cycles.cycles.map((cycle) => (
                          <li key={cycle.date}>
                            <button
                              type="button"
                              aria-current={cycle.date === cart.date ? 'date' : undefined}
                              disabled={frozen || cycle.date === cart.date}
                              onClick={() =>
                                shared.choose({ storeId: cart.store.id, date: cycle.date })
                              }
                            >
                              <span>{dateLabel(cycle.date)}</span>
                              <small>
                                {cycle.itemCount} SKU ·{' '}
                                {cycle.status === 'open' ? 'Terbuka' : 'Dikunci'}
                              </small>
                            </button>
                          </li>
                        ))}
                      </ul>
                      <div className="shared-pagination">
                        <span>
                          Halaman {cycles.page}/{cycles.pages}
                        </span>
                        <button
                          type="button"
                          disabled={frozen || cycles.page <= 1}
                          onClick={() => shared.loadCycles(cycles.page - 1)}
                        >
                          Sebelumnya
                        </button>
                        <button
                          type="button"
                          disabled={frozen || cycles.page >= cycles.pages}
                          onClick={() => shared.loadCycles(cycles.page + 1)}
                        >
                          Berikutnya
                        </button>
                      </div>
                    </div>
                  </details>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
