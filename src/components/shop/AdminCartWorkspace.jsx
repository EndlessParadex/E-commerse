import ProductImage from './ProductImage';
import { products } from '../../data/products';
import { rupiah } from './shopPresentation';
import { cartItemPresentation } from '../../data/cartItemPresentation';
import PackagingSummary from './PackagingSummary';
import AdminCartProcessing from './AdminCartProcessing';
import { nextStoreDelivery } from '../../data/b2bDeliverySchedule';
import { dateLabel, timeLabel, todayID, weekdays } from '../../data/sharedCartPresentation';
import { AdminCartAdd, AdminCartQuantity } from './SharedCartItemControls';

export default function AdminCartWorkspace({
  shop,
  shared,
  query,
  setQuery,
  storeId,
  setStoreId,
  date,
  setDate,
  stores,
  cart,
  frozen,
  selectedNotListed,
  clearRevision,
  setClearRevision,
}) {
  const activeStore =
    stores.stores.find((store) => store.id === storeId) ||
    (cart?.store.id === storeId ? cart.store : null);
  const fixedDate = nextStoreDelivery(activeStore?.deliverySchedule, todayID());
  const chosenDate = fixedDate || date;
  const steps = ['Pilih toko', 'Kelola barang', 'Periksa', 'Finalisasi'];
  const stage = !cart ? 0 : cart.status === 'open' ? 1 : cart.status === 'locked' ? 2 : 3;
  return (
    <div
      id="shared-panel-cart"
      role="tabpanel"
      aria-labelledby="shared-tab-cart"
      className="shared-admin-workflow"
    >
      <ol className="shared-admin-steps" aria-label="Tahapan pengelolaan pesanan toko">
        {steps.map((step, index) => (
          <li
            key={step}
            className={index === stage ? 'is-current' : index < stage ? 'is-complete' : ''}
          >
            <span aria-hidden="true">{index + 1}</span>
            <strong>{step}</strong>
          </li>
        ))}
      </ol>
      <div className="shared-admin-workspace">
        <div className="shared-admin-main">
          <section
            className="shared-cart-selection shared-admin-work-card"
            aria-labelledby="shared-selection-title"
          >
            <div className="shared-admin-card-heading">
              <h2 id="shared-selection-title">
                <span className="shared-admin-step-number">1</span> Pilih toko dan periode
              </h2>
              {cart && (
                <span className="shared-admin-hint">Toko aktif: {cart.store.storeCode}</span>
              )}
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
              {activeStore?.deliverySchedule ? (
                <div className="shared-admin-fixed-delivery">
                  <strong>Jadwal otomatis</strong>
                  <span>
                    {weekdays[activeStore.deliverySchedule.weekday]} · setiap{' '}
                    {activeStore.deliverySchedule.intervalWeeks} minggu
                  </span>
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
              <span>
                {stores.total} toko tersedia · Halaman {stores.page}/{stores.pages}
              </span>
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
                    <button className="bam-button-secondary" disabled={frozen}>
                      Cari
                    </button>
                  </div>
                </form>
                <div className="shared-pagination">
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
              </details>
            </div>
            <p className="shared-admin-small-note">
              {activeStore?.deliverySchedule
                ? 'Tanggal sesuai jadwal tetap toko dan tidak bisa diubah.'
                : 'Jadwal toko belum ditetapkan. Pemilik perlu menetapkannya melalui Toko & Sales.'}
            </p>
          </section>
          {shared.reading && <p role="status">Memuat keranjang terbaru…</p>}
          {shared.notice && (
            <p className="shared-save-notice" role="status">
              ✓ {shared.notice}
            </p>
          )}
          {cart ? (
            <>
              <section
                className="shared-cart-heading shared-admin-active-store"
                data-revision={cart.revision}
              >
                <div>
                  <h2>{cart.store.storeName}</h2>
                  <p>
                    {cart.store.storeCode} · {dateLabel(cart.date)}
                    {cart.overdue && (
                      <strong className="shared-overdue-label"> · Lewat jadwal</strong>
                    )}
                  </p>
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
              <section
                className="shared-admin-products shared-admin-work-card"
                aria-label="Kelola barang toko"
              >
                <div className="shared-admin-card-heading">
                  <h2>
                    <span className="shared-admin-step-number">2</span> Kelola barang
                  </h2>
                  <span className="shared-admin-hint">{cart.items.length} SKU dalam keranjang</span>
                </div>
                {cart.canEdit && <AdminCartAdd key={cart.store.id + cart.date} shared={shared} />}
                <h3 className="shared-admin-list-title">Daftar barang dalam keranjang</h3>
                {cart.items.length ? (
                  <ul className="shared-items">
                    {cart.items.map((item) => {
                      const display = cartItemPresentation(item);
                      const current = products.find((product) => product.id === item.id);
                      return (
                        <li key={item.id} className="shared-item">
                          <div className="shared-item-identity">
                            <div className="shared-item-photo">
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
                                {rupiah(item.price)} / {item.packaging?.packagingType || 'kemasan'}
                              </p>
                            </div>
                          </div>
                          {cart.canEdit ? (
                            <AdminCartQuantity item={item} shared={shared} />
                          ) : (
                            <p>
                              <strong>
                                {item.quantity} {item.packaging?.packagingType || 'kemasan'}
                              </strong>
                            </p>
                          )}
                          {!current && (
                            <p className="shop-warning">SKU ini sudah tidak tersedia di katalog.</p>
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
                  <h2>
                    <span className="shared-admin-step-number">3</span> Metode pembayaran
                  </h2>
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
                    <p>
                      <strong>{cart.payment?.label || 'COD — Bayar di Tempat'}</strong>
                    </p>
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
              <p>
                Pilih toko dan tanggal di atas, lalu tekan Buka keranjang untuk mulai mengelola
                barang.
              </p>
            </div>
          )}
        </div>
        <div className="shared-admin-sidebar">
          {cart && (
            <>
              <aside className="shared-cart-summary">
                <h2>Ringkasan keranjang</h2>
                <p className="shared-admin-summary-store">
                  {cart.store.storeName}
                  <small>
                    {cart.store.storeCode} · {dateLabel(cart.date)}
                  </small>
                </p>
                <div className="shared-admin-summary-stats">
                  <div>
                    <span>Status</span>
                    <strong className={'shared-admin-status status-' + cart.status}>
                      {cart.status === 'open'
                        ? 'Terbuka'
                        : cart.status === 'locked'
                          ? 'Dikunci'
                          : 'Difinalisasi'}
                    </strong>
                  </div>
                  <div>
                    <span>Total SKU</span>
                    <strong>{cart.items.length}</strong>
                  </div>
                  <div>
                    <span>Kemasan</span>
                    <strong>{shop.quantity}</strong>
                  </div>
                  <div>
                    <span>Versi</span>
                    <strong>{cart.revision}</strong>
                  </div>
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
                      Hapus semua barang dari keranjang toko dan periode ini? Pembeli dan Sales akan
                      melihat keranjang kosong.
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
