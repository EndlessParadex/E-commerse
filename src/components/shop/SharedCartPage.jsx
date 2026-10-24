import { useEffect, useState } from 'react';
import { useShop } from '../../state/useShop';
import ProductImage from './ProductImage';
import { products } from '../../data/products';
import { rupiah } from './shopPresentation';
import { cartItemPresentation } from '../../data/cartItemPresentation';
import PackagingSummary from './PackagingSummary';
import './SharedCartPage.css';
import AdminCartProcessing, { AdminB2BBanks, AdminCartQueue } from './AdminCartProcessing';
import { paymentMethod } from '../../state/paymentMethods';
import { nextStoreDelivery } from '../../data/b2bDeliverySchedule';

const dateLabel = (value) =>
  new Date(value + 'T00:00:00+07:00').toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });
const timeLabel = (value) => new Date(value).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
const roles = { owner: 'Pemilik BAM', admin: 'Admin', sales: 'Sales', buyer: 'Pembeli' };
const todayID = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const value = (type) => parts.find((entry) => entry.type === type)?.value;
  return value('year') + '-' + value('month') + '-' + value('day');
};
const weekdays = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
function eventLabel(event) {
  const { name, before, after } = event.details;
  if (event.action === 'payment')
    return `Mengubah pembayaran: ${paymentMethod(event.details.before)?.label || 'Belum dipilih'} → ${paymentMethod(event.details.after)?.label || 'Belum dipilih'}`;
  if (event.action === 'clear')
    return event.details.clearedItems
      ? `Mengosongkan keranjang (${event.details.clearedItems.length} SKU)`
      : 'Mengosongkan keranjang';
  if (event.action === 'refresh') return 'Memperbarui informasi dan harga dari katalog';
  if (event.action === 'lock') return 'Mengunci keranjang untuk pemeriksaan Admin';
  if (event.action === 'unlock') return 'Membuka kembali keranjang: ' + event.details.reason;
  if (event.action === 'finalize') return 'Memfinalisasi pesanan ' + event.details.orderId;
  if (event.action === 'remove') return `Menghapus ${name} (${before} kemasan)`;
  return `${name}: ${before} → ${after} kemasan`;
}
function AdminCartAdd({ shared }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState('1');
  const categories = [...new Set(products.map((product) => product.category).filter(Boolean))].sort();
  const search = query.trim().toLocaleLowerCase('id');
  const options = products
    .filter((product) =>
      (!category || product.category === category) &&
      [product.baseName, product.name, product.brand, product.id, product.sizeLabel]
        .join(' ')
        .toLocaleLowerCase('id')
        .includes(search),
    )
    .slice(0, 50);
  const selected = options.find((product) => product.id === sku);
  const valid = /^\d+$/.test(quantity) && Number(quantity) >= 1 && Number(quantity) <= 99;

  return (
    <form
      className="shared-admin-add"
      aria-label="Tambah barang ke keranjang toko sebagai Admin"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!shared.canEdit || !selected || !valid) return;
        const saved = await shared.mutate('add', selected.id, Number(quantity));
        if (saved) setQuantity('1');
      }}
    >
      <div className="shared-admin-card-heading">
        <h3>Tambah barang</h3>
        <span className="shared-admin-hint">Tersimpan langsung di keranjang bersama</span>
      </div>
      <p>Pilih produk, tentukan kemasan dan jumlah, lalu tambahkan ke keranjang toko.</p>
      <div className="shared-admin-add-fields">
        <label htmlFor="shared-admin-search">
          Cari barang atau SKU
          <input
            id="shared-admin-search"
            type="search"
            maxLength={100}
            value={query}
            disabled={!shared.canEdit}
            onChange={(event) => {
              setQuery(event.target.value);
              setSku('');
            }}
            placeholder="Nama produk, merek, ukuran, atau SKU"
          />
        </label>
        <label htmlFor="shared-admin-category">
          Kategori
          <select
            id="shared-admin-category"
            value={category}
            disabled={!shared.canEdit}
            onChange={(event) => {
              setCategory(event.target.value);
              setSku('');
            }}
          >
            <option value="">Semua kategori</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label htmlFor="shared-admin-sku">
          Produk dan kemasan
          <select
            id="shared-admin-sku"
            value={sku}
            disabled={!shared.canEdit}
            onChange={(event) => setSku(event.target.value)}
            required
          >
            <option value="">Pilih SKU</option>
            {options.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} · {product.id}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="shared-admin-quantity">
          Jumlah kemasan
          <input
            id="shared-admin-quantity"
            type="number"
            min="1"
            max="99"
            step="1"
            inputMode="numeric"
            value={quantity}
            disabled={!shared.canEdit}
            onChange={(event) => setQuantity(event.target.value)}
            required
          />
        </label>
        <button
          type="submit"
          className="shop-primary"
          disabled={!shared.canEdit || !selected || !valid}
        >
          + Tambah barang
        </button>
      </div>
      {selected && (
        <p>
          {selected.sizeLabel} · {selected.packagingType || 'satuan'} · {rupiah(selected.price)} per
          kemasan
        </p>
      )}
      {search && options.length === 50 && (
        <p>Hasil dibatasi 50 SKU. Persempit pencarian untuk memilih barang yang tepat.</p>
      )}
    </form>
  );
}

function CartQuantity({ item, shared }) {
  const [draft, setDraft] = useState(null);
  const value = draft?.value ?? String(item.quantity);
  const valid = /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 99;
  return (
    <form
      className="shared-quantity"
      onSubmit={async (event) => {
        event.preventDefault();
        if (valid) {
          await shared.mutate('set', item.id, Number(value), draft?.revision);
          setDraft(null);
        }
      }}
    >
      <label>
        Jumlah kemasan
        <input
          type="number"
          min="1"
          max="99"
          step="1"
          inputMode="numeric"
          aria-label={'Jumlah ' + item.name}
          value={value}
          disabled={!shared.canEdit}
          onChange={(event) =>
            setDraft({
              value: event.target.value,
              revision: draft?.revision ?? shared.cart.revision,
            })
          }
        />
      </label>
      {['admin', 'owner'].includes(shared.role) && (
        <div className="shared-admin-quantity-stepper" role="group" aria-label={'Penyesuaian cepat ' + item.name}>
          <button type="button" aria-label={'Kurangi ' + item.name}
            disabled={!shared.canEdit || draft !== null || item.quantity <= 1}
            onClick={() => void shared.mutate('set', item.id, item.quantity - 1)}>−</button>
          <button type="button" aria-label={'Tambah ' + item.name}
            disabled={!shared.canEdit || draft !== null || item.quantity >= 99}
            onClick={() => void shared.mutate('set', item.id, item.quantity + 1)}>+</button>
        </div>
      )}
      <button
        className="bam-button-secondary"
        disabled={!shared.canEdit || !valid || Number(value) === item.quantity}
      >
        Simpan jumlah
      </button>
      <button
        type="button"
        className="bam-button-danger"
        disabled={!shared.canEdit}
        onClick={() => shared.mutate('remove', item.id)}
      >
        Hapus
      </button>
      {draft && draft.revision !== shared.cart.revision && (
        <p role="status">
          Keranjang berubah saat Anda mengisi. Periksa isian terbaru sebelum menyimpan.
        </p>
      )}
    </form>
  );
}

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


function AdminCartWorkspace({
  shop, shared, query, setQuery, storeId, setStoreId, date, setDate,
  stores, cart, frozen, selectedNotListed, clearRevision, setClearRevision,
}) {
  const activeStore = stores.stores.find((store) => store.id === storeId) ||
    (cart?.store.id === storeId ? cart.store : null);
  const fixedDate = nextStoreDelivery(activeStore?.deliverySchedule, todayID());
  const chosenDate = fixedDate || date;
  const steps = ['Pilih toko', 'Kelola barang', 'Periksa', 'Finalisasi'];
  const stage = !cart ? 0 : cart.status === 'open' ? 1 : cart.status === 'locked' ? 2 : 3;
  return (
    <div id="shared-panel-cart" role="tabpanel" aria-labelledby="shared-tab-cart" className="shared-admin-workflow">
      <ol className="shared-admin-steps" aria-label="Tahapan pengelolaan pesanan toko">
        {steps.map((step, index) => (
          <li key={step} className={index === stage ? 'is-current' : index < stage ? 'is-complete' : ''}>
            <span aria-hidden="true">{index + 1}</span>
            <strong>{step}</strong>
          </li>
        ))}
      </ol>
      <div className="shared-admin-workspace">
        <div className="shared-admin-main">
          <section className="shared-cart-selection shared-admin-work-card" aria-labelledby="shared-selection-title">
            <div className="shared-admin-card-heading">
              <h2 id="shared-selection-title"><span className="shared-admin-step-number">1</span> Pilih toko dan periode</h2>
              {cart && <span className="shared-admin-hint">Toko aktif: {cart.store.storeCode}</span>}
            </div>
            <form
              className="shared-open-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (storeId && chosenDate) void shared.choose({ storeId, date: chosenDate });
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
                    <option value={cart.store.id}>{cart.store.storeName} · {cart.store.storeCode}</option>
                  )}
                  {stores.stores.map((store) => (
                    <option key={store.id} value={store.id}>{store.storeName} · {store.storeCode}</option>
                  ))}
                </select>
              </label>
              {activeStore?.deliverySchedule ? (
                <div className="shared-admin-fixed-delivery">
                  <strong>Jadwal otomatis</strong>
                  <span>{weekdays[activeStore.deliverySchedule.weekday]} · setiap {activeStore.deliverySchedule.intervalWeeks} minggu</span>
                  <span>Pengiriman berikutnya: {dateLabel(fixedDate)}</span>
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
              <button className="shop-primary" disabled={frozen || !storeId || !chosenDate}>
                Buka keranjang
              </button>
            </form>
            <div className="shared-admin-selection-bottom">
              <span>{stores.total} toko tersedia · Halaman {stores.page}/{stores.pages}</span>
              <details className="shared-admin-store-search">
                <summary>Cari toko lain</summary>
                <form
                  className="shared-store-search"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void shared.findStores(query);
                  }}
                >
                  <label htmlFor="shared-store-query">Nama atau kode toko</label>
                  <div>
                    <input
                      id="shared-store-query"
                      type="search"
                      maxLength={200}
                      value={query}
                      disabled={frozen}
                      placeholder="Cari nama atau kode toko"
                      onChange={(event) => setQuery(event.target.value)}
                    />
                    <button className="bam-button-secondary" disabled={frozen}>Cari</button>
                  </div>
                </form>
                <div className="shared-pagination">
                  <button type="button" disabled={frozen || stores.page <= 1}
                    onClick={() => shared.findStores(query, stores.page - 1)}>Sebelumnya</button>
                  <button type="button" disabled={frozen || stores.page >= stores.pages}
                    onClick={() => shared.findStores(query, stores.page + 1)}>Berikutnya</button>
                </div>
              </details>
            </div>
            <p className="shared-admin-small-note">
              {activeStore?.deliverySchedule
                ? 'Tanggal sesuai jadwal tetap toko dan tidak bisa diubah.'
                : 'Jadwal toko belum ditetapkan. Pemilik perlu menetapkannya melalui Toko & Sales.'}
            </p>
          </section>
          {shared.reading && <p role="status">Memuat keranjang terbaru…</p>}
          {shared.notice && <p className="shared-save-notice" role="status">✓ {shared.notice}</p>}
          {cart ? (
            <>
              <section className="shared-cart-heading shared-admin-active-store">
                <div>
                  <h2>{cart.store.storeName}</h2>
                  <p>{cart.store.storeCode} · {dateLabel(cart.date)}</p>
                  <p>{shop.quantity} kemasan · {cart.items.length} SKU · Versi {cart.revision}</p>
                </div>
                <button type="button" className="bam-button-secondary" disabled={frozen}
                  onClick={shared.refresh}>Muat terbaru</button>
              </section>
              {!cart.canEdit && (
                <p className="shop-warning">
                  {cart.status === 'finalized'
                    ? 'Keranjang sudah difinalisasi. Lihat pesanan toko untuk tindak lanjut.'
                    : 'Keranjang dikunci. Buka kembali melalui Pemrosesan Admin sebelum mengubah barang.'}
                </p>
              )}
              {cart.orderId && (
                <p className="shared-save-notice">
                  <a href={'#/pesanan/' + encodeURIComponent(cart.orderId)}>Lihat pesanan toko →</a>
                </p>
              )}
              <section className="shared-admin-products shared-admin-work-card" aria-label="Kelola barang toko">
                <div className="shared-admin-card-heading">
                  <h2><span className="shared-admin-step-number">2</span> Kelola barang</h2>
                  <span className="shared-admin-hint">{cart.items.length} SKU dalam keranjang</span>
                </div>
                {cart.canEdit && (
                  <AdminCartAdd key={cart.store.id + cart.date} shared={shared} />
                )}
                <h3 className="shared-admin-list-title">Daftar barang dalam keranjang</h3>
                  {cart.items.length ? (
                    <ul className="shared-items">
                      {cart.items.map((item) => {
                        const display = cartItemPresentation(item);
                        const current = products.find((product) => product.id === item.id);
                        return (
                          <li key={item.id} className="shared-item">
                            <div className="shared-item-identity">
                              <div className={'shared-item-photo ' + (display.product.color || '')}>
                                <ProductImage product={display.product} variant="thumbnail" />
                              </div>
                              <div>
                                <h3>
                                  {display.detailHref ? (
                                    <a href={display.detailHref}>{display.name}</a>
                                  ) : (
                                    display.name
                                  )}
                                </h3>
                                <p className="shared-sku">SKU: {item.id}</p>
                                <p>{display.sizeLabel}</p>
                                <PackagingSummary
                                  packaging={item.packaging}
                                  quantity={item.quantity}
                                />
                                <p>
                                  {rupiah(item.price)} /{' '}
                                  {item.packaging?.packagingType || 'kemasan'}
                                </p>
                              </div>
                            </div>
                            {cart.canEdit ? (
                              <CartQuantity item={item} shared={shared} />
                            ) : (
                              <p>
                                <strong>
                                  {item.quantity} {item.packaging?.packagingType || 'kemasan'}
                                </strong>
                              </p>
                            )}
                            {!current && (
                              <p className="shop-warning">
                                SKU ini sudah tidak tersedia di katalog.
                              </p>
                            )}
                            <p className="shared-line-total">
                              Subtotal: <strong>{rupiah(item.price * item.quantity)}</strong>
                            </p>
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

              </section>
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

              <div className="shared-admin-payment-card shared-admin-work-card">
                <div className="shared-admin-card-heading">
                  <h2><span className="shared-admin-step-number">3</span> Metode pembayaran</h2>
                  <span className="shared-admin-hint">Dipilih pembeli toko atau Sales</span>
                </div>
              <section className="shared-cart-payment shared-cart-payment-compact"
                aria-labelledby="shared-payment-title">
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
                        onChange={(event) => void shared.mutate('payment', event.target.value)}
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
                    ? 'Rekening tujuan dan unggah bukti tersedia setelah finalisasi Admin, pada Detail Pesanan.'
                    : 'Bayar saat barang diterima; pelunasan dicatat Admin.'}
                </p>
                {['admin', 'owner'].includes(shared.role) && (
                  <small className="shared-payment-admin-note">
                    Admin hanya memeriksa pilihan pembayaran pembeli toko atau Sales.
                  </small>
                )}
              </section>
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
                          <li key={item.id} className="shared-item">
                            <div className="shared-item-identity">
                              <div className={'shared-item-photo ' + (display.product.color || '')}>
                                <ProductImage product={display.product} variant="thumbnail" />
                              </div>
                              <div>
                                <h3>
                                  {display.detailHref ? (
                                    <a href={display.detailHref}>{display.name}</a>
                                  ) : (
                                    display.name
                                  )}
                                </h3>
                                <p className="shared-sku">SKU: {item.id}</p>
                                <p>{display.sizeLabel}</p>
                                <PackagingSummary
                                  packaging={item.packaging}
                                  quantity={item.quantity}
                                />
                                <p>
                                  {rupiah(item.price)} /{' '}
                                  {item.packaging?.packagingType || 'kemasan'}
                                </p>
                              </div>
                            </div>
                            {cart.canEdit ? (
                              <CartQuantity item={item} shared={shared} />
                            ) : (
                              <p>
                                <strong>
                                  {item.quantity} {item.packaging?.packagingType || 'kemasan'}
                                </strong>
                              </p>
                            )}
                            {!current && (
                              <p className="shop-warning">
                                SKU ini sudah tidak tersedia di katalog.
                              </p>
                            )}
                            <p className="shared-line-total">
                              Subtotal: <strong>{rupiah(item.price * item.quantity)}</strong>
                            </p>
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
                    <p className="shared-summary-update">Disimpan: {timeLabel(cart.updatedAt)} WIB</p>
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
                        Hapus semua barang dari keranjang toko dan periode ini? Pembeli dan Sales
                        akan melihat keranjang kosong.
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
                <div className="shared-cart-activity-grid" aria-label="Aktivitas dan periode keranjang">
                  <details
                    key={'activity:' + cart.store.id + ':' + cart.date}
                    className="shared-history shared-history-panel"
                    defaultOpen={isAdmin && adminSection === 'history'}
                  >
                    <summary className="shared-activity-heading">
                      <span className="shared-activity-heading-text">
                        <strong>Riwayat perubahan</strong>
                        <small>Catatan barang, pembayaran, dan akun yang mengubahnya</small>
                      </span>
                      <span className="shared-activity-counter">
                        {cart.events.length}{cart.hasMore ? '+' : ''} aktivitas
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
                        <p className="shared-activity-empty">Belum ada perubahan pada periode ini.</p>
                      )}
                      {cart.hasMore && (
                        <button type="button" className="bam-button-secondary"
                          disabled={shared.reading} onClick={shared.olderEvents}>
                          Lihat riwayat lebih lama
                        </button>
                      )}
                    </div>
                  </details>
                  <details
                    key={'cycles:' + cart.store.id + ':' + cart.date}
                    className="shared-history shared-cycle-panel"
                    defaultOpen={isAdmin && adminSection === 'history'}
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
                            <button type="button"
                              aria-current={cycle.date === cart.date ? 'date' : undefined}
                              disabled={frozen || cycle.date === cart.date}
                              onClick={() => shared.choose({ storeId: cart.store.id, date: cycle.date })}>
                              <span>{dateLabel(cycle.date)}</span>
                              <small>{cycle.itemCount} SKU ·{' '}
                                {cycle.status === 'open' ? 'Terbuka' : 'Dikunci'}</small>
                            </button>
                          </li>
                        ))}
                      </ul>
                      <div className="shared-pagination">
                        <span>Halaman {cycles.page}/{cycles.pages}</span>
                        <button type="button" disabled={frozen || cycles.page <= 1}
                          onClick={() => shared.loadCycles(cycles.page - 1)}>Sebelumnya</button>
                        <button type="button" disabled={frozen || cycles.page >= cycles.pages}
                          onClick={() => shared.loadCycles(cycles.page + 1)}>Berikutnya</button>
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
