import { useEffect, useRef, useState } from 'react';
import { useShop } from '../state/useShop';
import { products } from '../data/products';
import ProductImage from '../components/shop/ProductImage';
import { rupiah } from '../components/shop/shopPresentation';
import { sharedDraftWhatsAppUrl } from '../data/sharedDraftWhatsApp';
import { fastOrderGroups, fastOrderPackaging, fastOrderTotals } from '../data/fastOrder';
import './FastOrderPage.css';

function QuantityEditor({ product, quantity, disabled, onQuantityChange }) {
  const inputRef = useRef(null);
  const commit = () => {
    if (disabled || !inputRef.current) return;
    const input = inputRef.current;
    const raw = input.value.trim();
    if (!/^(?:0|[1-9][0-9]?)$/.test(raw)) {
      input.value = String(quantity);
      return;
    }
    const next = Number(raw);
    if (next === quantity) return;
    void onQuantityChange(product, next).then((saved) => {
      if (!saved && input.isConnected) input.value = String(quantity);
    });
  };
  return (
    <div className="bam-fast-stepper" role="group" aria-label={product.name}>
      <button
        type="button"
        aria-label={'Kurangi ' + product.name}
        disabled={disabled || quantity <= 0}
        onClick={() => onQuantityChange(product, quantity - 1)}
      >
        −
      </button>
      <input
        key={quantity}
        ref={inputRef}
        type="number"
        inputMode="numeric"
        min="0"
        max="99"
        step="1"
        aria-label={'Jumlah ' + product.name}
        defaultValue={quantity}
        disabled={disabled}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            event.currentTarget.value = String(quantity);
            event.currentTarget.blur();
          }
        }}
      />
      <button
        type="button"
        aria-label={'Tambah ' + product.name}
        disabled={disabled || quantity >= 99}
        onClick={() => onQuantityChange(product, quantity + 1)}
      >
        +
      </button>
    </div>
  );
}

export default function FastOrderPage() {
  const { shared, setCartMode } = useShop();
  const queryFromRoute = () =>
    new URLSearchParams(window.location.hash.split('?')[1] || '').get('q') || '';
  const [search, setSearch] = useState(() => ({ query: queryFromRoute(), limit: 40 }));
  const query = search.query;
  useEffect(() => {
    const syncQuery = () => setSearch({ query: queryFromRoute(), limit: 40 });
    window.addEventListener('hashchange', syncQuery);
    return () => window.removeEventListener('hashchange', syncQuery);
  }, []);
  const validRole = ['sales', 'buyer'].includes(shared?.role);
  const cart = shared?.cart;
  const totals = fastOrderTotals(cart);
  const matches = fastOrderGroups(products, cart?.items, query, Infinity);
  const rows = matches.slice(0, search.limit);
  const editable = Boolean(shared?.canEdit && cart?.status === 'open');
  const isBusy = Boolean(shared?.busy || shared?.reading || shared?.uncertain);

  const change = (product, next) => {
    if (!editable || isBusy || !Number.isSafeInteger(next) || next < 0 || next > 99)
      return Promise.resolve(false);
    const current = cart?.items.find((item) => item.id === product.id);
    if (next === (current?.quantity || 0)) return Promise.resolve(true);
    const action = next === 0 ? 'remove' : current ? 'set' : 'add';
    return shared.mutate(action, product.id, next);
  };

  if (!validRole || shared?.status !== 'ready') {
    return (
      <div className="shop-page bam-fast-order">
        <h1>Order Cepat</h1>
        <p>
          {shared?.status === 'loading'
            ? 'Memeriksa akun dan penugasan toko…'
            : 'Order Cepat hanya tersedia untuk Sales dan Pembeli Toko yang telah terhubung.'}
        </p>
        <a className="bam-button-secondary" href="#/keranjang">
          Buka keranjang
        </a>
      </div>
    );
  }
  if (!cart) {
    return (
      <div className="shop-page bam-fast-order">
        <h1>Order Cepat</h1>
        <p>Pilih toko dan periode pengiriman sebelum mulai memasukkan barang.</p>
        <a className="shop-primary" href="#/keranjang" onClick={() => setCartMode('store')}>
          Pilih toko aktif →
        </a>
      </div>
    );
  }

  const wa = sharedDraftWhatsAppUrl(cart);
  return (
    <div className="shop-page bam-fast-order">
      <div className="bam-fast-head">
        <div>
          <span className="bam-fast-kicker">MODE LAPANGAN · KERANJANG BERSAMA</span>
          <h1>Order Cepat</h1>
          <p>
            <strong>{cart.store.storeName}</strong>
            {' · Kirim: ' + cart.date}
          </p>
        </div>
        <a
          href="#/keranjang"
          className="bam-fast-change-store"
          onClick={() => setCartMode('store')}
        >
          Ganti toko
        </a>
      </div>

      <label className="bam-fast-search">
        <span>Cari produk, ukuran, merek, atau SKU</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setSearch({ query: event.target.value, limit: 40 })}
          placeholder="Contoh: balado, 180g, dus, SKU..."
          maxLength={100}
        />
      </label>
      <p className="bam-fast-intro">
        SKU yang sudah ada di keranjang tampil lebih dulu. Setiap Dus, Pack, Box, Renceng, dan
        Satuan memiliki jumlah serta harga sendiri.
      </p>

      {shared.error && (
        <div className="shop-warning" role="alert">
          {shared.error}
          <button
            type="button"
            className="bam-button-secondary"
            onClick={shared.uncertain ? shared.retryPending : shared.refresh}
          >
            {shared.uncertain ? 'Pastikan penyimpanan' : 'Muat terbaru'}
          </button>
        </div>
      )}
      {isBusy && (
        <p role="status" className="bam-fast-sync">
          Menyimpan atau menyinkronkan…
        </p>
      )}
      {!isBusy && shared.notice && (
        <p role="status" className="bam-fast-sync">
          {shared.notice}
        </p>
      )}
      {!editable && (
        <p className="shop-warning" role="status">
          Keranjang tidak dapat diedit saat dikunci, difinalisasi, atau melewati batas waktu.
        </p>
      )}
      <section className="bam-fast-results" aria-label="Daftar produk dan kemasan">
        {rows.map((group) => (
          <article className="bam-fast-row" key={group.key}>
            <div className="bam-fast-product">
              <ProductImage product={group.imageProduct} variant="thumbnail" />
              <div>
                <h2>{group.name}</h2>
                <span>{group.size}</span>
                {group.inCart && <small>Sudah dalam keranjang</small>}
              </div>
            </div>
            <div className="bam-fast-packages">
              {group.variants.map((product) => {
                const current = cart.items.find((item) => item.id === product.id);
                const quantity = current?.quantity || 0;
                const packaging = fastOrderPackaging(product);
                const unitPrice = current?.price ?? product.price;
                return (
                  <div className="bam-fast-variant" key={product.id}>
                    <div className="bam-fast-variant-copy">
                      <strong>{packaging.label}</strong>
                      <small>
                        {packaging.units > 1 ? 'Isi ' + packaging.units + ' satuan · ' : ''}
                        {rupiah(unitPrice)}
                      </small>
                    </div>
                    <QuantityEditor
                      product={product}
                      quantity={quantity}
                      disabled={!editable || isBusy}
                      onQuantityChange={change}
                    />
                  </div>
                );
              })}
            </div>
          </article>
        ))}
        {rows.length === 0 && (
          <p className="bam-fast-empty">Produk tidak ditemukan. Coba kata kunci lain.</p>
        )}
      </section>
      <p className="bam-fast-result-count" role="status">
        Menampilkan {rows.length} dari {matches.length} kelompok produk.
      </p>
      {rows.length < matches.length && (
        <button
          type="button"
          className="bam-button-secondary bam-fast-more"
          onClick={() => setSearch((current) => ({ ...current, limit: current.limit + 40 }))}
        >
          Tampilkan 40 produk berikutnya
        </button>
      )}

      <footer className="bam-fast-actionbar" aria-label="Aksi order cepat">
        {shared.role === 'sales' && wa && (
          <a href={wa} className="bam-fast-wa" target="_blank" rel="noopener noreferrer">
            Rekap draft WA
          </a>
        )}
        <a href="#/keranjang" className="bam-fast-cart-link" onClick={() => setCartMode('store')}>
          Keranjang · {rupiah(totals.amount)} <span aria-hidden="true">→</span>
        </a>
        <small>
          {totals.sku} SKU · {totals.packages} kemasan · Harga sementara, pesanan final oleh Admin
        </small>
      </footer>
    </div>
  );
}
