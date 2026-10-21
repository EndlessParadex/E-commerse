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

const dateLabel = (value) =>
  new Date(value + 'T00:00:00+07:00').toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });
const timeLabel = (value) => new Date(value).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
const roles = { owner: 'Pemilik BAM', admin: 'Admin', sales: 'Sales', buyer: 'Pembeli' };
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
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState('1');
  const search = query.trim().toLocaleLowerCase('id');
  const options = products
    .filter((product) =>
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
      <h3>Tambah barang ke keranjang toko</h3>
      <p>
        Admin dan Pemilik dapat menambahkan barang pada keranjang terbuka. Semua perubahan
        dicatat dan harus diperiksa sebelum finalisasi.
      </p>
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
          Tambah ke keranjang toko
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

export default function SharedCartPage({ adminView = false }) {
  const shop = useShop();
  const { shared } = shop;
  const [query, setQuery] = useState('');
  const [storeId, setStoreId] = useState(shared.selection.storeId);
  const [date, setDate] = useState(shared.selection.date);
  const [clearRevision, setClearRevision] = useState(null);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setStoreId(shared.selection.storeId);
    setDate(shared.selection.date);
    setClearRevision(null);
  }, [shared.selection.storeId, shared.selection.date]);
  const frozen = shared.busy || shared.uncertain || shared.reading;
  const { cart, stores, cycles } = shared;
  const selectedNotListed = cart && !stores.stores.some((store) => store.id === cart.store.id);
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
      {shared.status === 'ready' && ['admin', 'owner'].includes(shared.role) && (
        <AdminCartQueue shared={shared} />
      )}
      {shared.status === 'ready' && shared.role === 'owner' && <AdminB2BBanks />}
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
      {shared.status === 'ready' && (
        <>
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
                if (storeId && date) void shared.choose({ storeId, date });
              }}
            >
              <label htmlFor="shared-store">
                Toko
                <select
                  id="shared-store"
                  required
                  value={storeId}
                  disabled={frozen}
                  onChange={(event) => setStoreId(event.target.value)}
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
              <button className="shop-primary" disabled={frozen || !storeId || !date}>
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
  );
}
