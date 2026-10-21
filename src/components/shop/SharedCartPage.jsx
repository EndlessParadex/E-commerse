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
  const shared = useShop().shared;
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
      <a href="#/keranjang">{shared.cart ? 'Buka / ganti toko →' : 'Pilih toko →'}</a>
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
              <section className="shared-cart-payment" aria-labelledby="shared-payment-title">
                <h2 id="shared-payment-title">Metode pembayaran toko</h2>
                <p>Pilihan berlaku untuk seluruh keranjang toko pada periode ini.</p>
                {['buyer', 'sales'].includes(shared.role) && cart.status === 'open' ? (
                  <label htmlFor="shared-cart-payment">
                    Pilih COD atau bank transfer
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
                  <p><strong>{cart.payment?.label || 'COD — Bayar di Tempat'}</strong></p>
                )}
                <p>
                  {cart.payment?.groupId === 'transfer'
                    ? 'Setelah Admin memfinalisasi pesanan, rekening tujuan dan unggah bukti tersedia pada Detail Pesanan. Bukti diperiksa Admin sebelum dinyatakan lunas.'
                    : 'Pembayaran dilakukan ketika barang diterima. Admin mencatat pelunasan.'}
                </p>
                <small>Admin hanya memeriksa pilihan pembayaran pembeli toko atau Sales.</small>
              </section>
              </div>
            </>
          ) : (
            <div className="shared-admin-empty-state">
              <h2>Belum ada keranjang dipilih</h2>
              <p>Pilih toko dan tanggal di atas, lalu tekan Buka keranjang untuk mulai mengelola barang.</p>
            </div>
          )}
        </div>
        <div className="shared-admin-sidebar">
          {cart && (
            <>
                <aside className="shared-cart-summary">
                  <h2>Ringkasan keranjang</h2>
                  <p className="shared-admin-summary-store">{cart.store.storeName}
                    <small>{cart.store.storeCode} · {dateLabel(cart.date)}</small>
                  </p>
                  <div className="shared-admin-summary-stats">
                    <div><span>Status</span><strong className={'shared-admin-status status-' + cart.status}>
                      {cart.status === 'open' ? 'Terbuka' : cart.status === 'locked' ? 'Dikunci' : 'Difinalisasi'}
                    </strong></div>
                    <div><span>Total SKU</span><strong>{cart.items.length}</strong></div>
                    <div><span>Kemasan</span><strong>{shop.quantity}</strong></div>
                    <div><span>Versi</span><strong>{cart.revision}</strong></div>
                  </div>
                  <p>
                    Subtotal barang <strong>{rupiah(shop.subtotal)}</strong>
                  </p>
                  <p>
                    {cart.status === 'finalized'
                      ? 'Harga dan barang sudah dicatat pada pesanan final.'
                      : 'Harga dapat berubah sampai finalisasi Admin. Persediaan diperiksa saat finalisasi.'}
                  </p>
                  <p>Isi diperiksa berkala setiap 5 detik saat halaman aktif.</p>
                  {cart.updatedAt && <p>Terakhir disimpan: {timeLabel(cart.updatedAt)} WIB</p>}
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

              <AdminCartProcessing key={cart.store.id + cart.date} shared={shared} />
            </>
          )}
          <section className="shared-admin-help" aria-label="Panduan untuk Admin baru">
            <h2>Petunjuk untuk Admin</h2>
            <ol>
              <li>Pilih toko dan periode yang akan diproses.</li>
              <li>Periksa dan tambahkan barang selama keranjang terbuka.</li>
              <li>Pastikan metode pembayaran pembeli/Sales sesuai.</li>
              <li>Kunci keranjang, periksa stok, lalu finalisasi.</li>
            </ol>
            <p>Pemrosesan pesanan toko hanya dapat difinalisasi melalui Admin.</p>
          </section>
        </div>
      </div>
    </div>
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
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setStoreId(shared.selection.storeId);
    setDate(shared.selection.date);
    setClearRevision(null);
  }, [shared.selection.storeId, shared.selection.date]);
  const frozen = shared.busy || shared.uncertain || shared.reading;
  const { cart, stores, cycles } = shared;
  const selectedNotListed = cart && !stores.stores.some((store) => store.id === cart.store.id);
  const buyerStore = stores.stores.find((store) => store.id === storeId) ||
    (cart?.store.id === storeId ? cart.store : null);
  const buyerSchedule = buyerStore?.deliverySchedule;
  const buyerFixedDate = nextStoreDelivery(buyerSchedule, todayID());
  const isAdmin = adminView && ['admin', 'owner'].includes(shared.role);
  const showSelection = !isAdmin || adminSection === 'history';
  const showCart = !isAdmin || adminSection === 'cart';
  const sections = [
    { id: 'queue', label: 'Antrean', description: 'Cari toko dan buka keranjang yang perlu diproses.' },
    { id: 'cart', label: 'Isi Keranjang', description: 'Pilih toko, kelola barang, dan lakukan finalisasi.' },
    { id: 'history', label: 'Riwayat', description: 'Lihat catatan perubahan dan periode keranjang toko.' },
    ...(shared.role === 'owner'
      ? [{ id: 'banks', label: 'Rekening Transfer', description: 'Atur rekening resmi BCA, BRI, dan Mandiri.' }]
      : []),
  ];
  const activeSection = sections.find((section) => section.id === adminSection);
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
            <p>Pembeli dan Sales yang ditugaskan mengisi daftar barang yang sama.</p>
          </header>
          <p className="shared-cart-explanation">
            Perubahan disimpan di server. Tanggal di bawah adalah rencana pengiriman, belum
            merupakan jadwal yang dikonfirmasi. Stok dicadangkan setelah Admin berhasil
            memfinalisasi pesanan.
          </p>
        </>
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
          <section className="shared-cart-selection" aria-labelledby="shared-selection-title">
            <h2 id="shared-selection-title">Toko dan periode</h2>
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
            <form
              className="shared-open-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (storeId && (buyerFixedDate || date)) void shared.choose({ storeId, date: buyerFixedDate || date });
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
                  }
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
                  <strong>Jadwal tetap: {weekdays[buyerSchedule.weekday]} · setiap {buyerSchedule.intervalWeeks} minggu</strong>
                  <span>Periode berikutnya: {dateLabel(buyerFixedDate)}</span>
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
              <button className="shop-primary" disabled={frozen || !storeId || !(buyerFixedDate || date)}>
                Buka keranjang
              </button>
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
          </section>
          {shared.reading && <p role="status">Memuat keranjang terbaru…</p>}
          {shared.notice && (
            <p className="shared-save-notice" role="status">
              ✓ {shared.notice}
            </p>
          )}
          {cart && (
            <>
              <section className="shared-cart-heading">
                <div>
                  <h2>{cart.store.storeName}</h2>
                  <p>
                    {cart.store.storeCode} · {dateLabel(cart.date)}
                  </p>
                  <p>
                    {shop.quantity} kemasan · {cart.items.length} SKU · Versi {cart.revision}
                  </p>
                </div>
                <button
                  type="button"
                  className="bam-button-secondary"
                  disabled={frozen}
                  onClick={shared.refresh}
                >
                  Muat terbaru
                </button>
              </section>
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
                  <a href={'#/pesanan/' + encodeURIComponent(cart.orderId)}>Lihat pesanan toko →</a>
                </p>
              )}
              <section className="shared-cart-payment" aria-labelledby="shared-payment-title">
                <h2 id="shared-payment-title">Metode pembayaran toko</h2>
                <p>Pilihan berlaku untuk seluruh keranjang toko pada periode ini.</p>
                {['buyer', 'sales'].includes(shared.role) && cart.status === 'open' ? (
                  <label htmlFor="shared-cart-payment">
                    Pilih COD atau bank transfer
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
                  <p><strong>{cart.payment?.label || 'COD — Bayar di Tempat'}</strong></p>
                )}
                <p>
                  {cart.payment?.groupId === 'transfer'
                    ? 'Setelah Admin memfinalisasi pesanan, rekening tujuan dan unggah bukti tersedia pada Detail Pesanan. Bukti diperiksa Admin sebelum dinyatakan lunas.'
                    : 'Pembayaran dilakukan ketika barang diterima. Admin mencatat pelunasan.'}
                </p>
                {['admin', 'owner'].includes(shared.role) && (
                  <small>Admin hanya memeriksa pilihan pembayaran pembeli toko atau Sales.</small>
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
                  <p>
                    {cart.status === 'finalized'
                      ? 'Harga dan barang sudah dicatat pada pesanan final.'
                      : 'Harga dapat berubah sampai finalisasi Admin. Persediaan diperiksa saat finalisasi.'}
                  </p>
                  <p>Isi diperiksa berkala setiap 5 detik saat halaman aktif.</p>
                  {cart.updatedAt && <p>Terakhir disimpan: {timeLabel(cart.updatedAt)} WIB</p>}
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
                <>
              <section className="shared-history">
                <h2>Riwayat perubahan</h2>
                {cart.events.length ? (
                  <ol>
                    {cart.events.map((event) => (
                      <li key={event.revision}>
                        <strong>
                          {event.actorName} · {roles[event.actorRole]}
                        </strong>
                        <p>{eventLabel(event)}</p>
                        <small>
                          {timeLabel(event.createdAt)} WIB · Versi {event.revision}
                        </small>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>Belum ada perubahan tersimpan pada periode ini.</p>
                )}
                {cart.hasMore && (
                  <button
                    type="button"
                    className="bam-button-secondary"
                    onClick={shared.olderEvents}
                  >
                    Lihat riwayat lebih lama
                  </button>
                )}
              </section>
              <section className="shared-history">
                <h2>Periode keranjang toko ini</h2>
                <ul className="shared-cycle-list">
                  {cycles.cycles.map((cycle) => (
                    <li key={cycle.date}>
                      <button
                        type="button"
                        disabled={frozen || cycle.date === cart.date}
                        onClick={() => shared.choose({ storeId: cart.store.id, date: cycle.date })}
                      >
                        {dateLabel(cycle.date)} · {cycle.itemCount} SKU ·{' '}
                        {cycle.status === 'open' ? 'Terbuka' : 'Dikunci'}
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
              </section>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
