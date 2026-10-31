import { nextStoreDelivery } from '../../data/b2bDeliverySchedule';
import { products } from '../../data/products';
import { storeBuyerSelections } from '../../data/storeBuyerSelections';
import { productGallery } from '../../data/productGallery';
import { suppliers, supplierHref } from '../../data/suppliers';
import { rupiah } from './shopPresentation';
import ProductImage from './ProductImage';
import './StoreBuyerDashboard.css';

const weekdays = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const wibToday = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
};
const displayDate = (value) => {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value || '')) return null;
  const date = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};
const cartStatus = (cart) => {
  if (!cart) return 'Belum ada keranjang';
  if (cart.status === 'finalized') return 'Sudah difinalisasi';
  if (cart.status === 'locked') return 'Sedang diperiksa Admin';
  if (cart.reviewRequested) return 'Menunggu pemeriksaan Admin';
  return cart.status === 'open' ? 'Draft terbuka' : 'Lihat detail keranjang';
};

function StoreIcon({ name, size = 20 }) {
  const strokes = {
    shop: (
      <>
        <path d="M3 9h18l-2-5H5L3 9ZM4 9v11h16V9M9 20v-7h6v7" />
      </>
    ),
    cart: (
      <>
        <path d="M2 4h3l3 12h11l3-9H6" />
        <circle cx="10" cy="21" r="1" />
        <circle cx="19" cy="21" r="1" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
      </>
    ),
    orders: (
      <>
        <path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3ZM9 8h6M9 12h6" />
      </>
    ),
    catalog: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    tag: (
      <>
        <path d="M3 12V4h8l10 10-8 8L3 12Z" />
        <circle cx="8" cy="9" r="1" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2" />
      </>
    ),
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    box: (
      <>
        <path d="m12 2 9 5-9 5-9-5 9-5ZM3 7v10l9 5 9-5V7M12 12v10" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {strokes[name] || strokes.shop}
    </svg>
  );
}

function StoreProductCard({ entry, featured = false }) {
  const { product, discounted, discount } = entry;
  const photo = productGallery(product).find((item) => !item.demo);
  const preview = photo ? { ...product, image: photo.src, imageAlt: photo.alt } : product;
  const href = '#/produk/' + encodeURIComponent(product.id);
  const name = product.baseName || product.name;
  return (
    <article
      className={'bam-buyer-product-card' + (featured ? ' is-promo' : '')}
      key={product.groupId || product.id}
    >
      <a
        className={'bam-buyer-product-photo color-' + (product.color || 'sky')}
        href={href}
        aria-label={'Lihat ' + name}
      >
        {discounted && <span className="bam-buyer-discount">−{discount}%</span>}
        <ProductImage product={preview} variant="promo" />
      </a>
      <div className="bam-buyer-product-copy">
        <a href={href} className="bam-buyer-product-title">
          {name}
        </a>
        <small>{product.sizeLabel || 'Pilih kemasan'}</small>
      </div>
      <div className="bam-buyer-product-bottom">
        <span>
          <strong>{rupiah(product.price)}</strong>
          {discounted && <del>{rupiah(product.oldPrice)}</del>}
        </span>
        <a
          href={href}
          className="bam-buyer-product-cart"
          aria-label={'Lihat pilihan kemasan ' + name}
        >
          <StoreIcon name="cart" size={20} />
        </a>
      </div>
    </article>
  );
}

export default function StoreBuyerDashboard({ shared, onCartMode }) {
  const assigned = Array.isArray(shared.stores?.stores) ? shared.stores.stores : [];
  const count = shared.stores?.total ?? assigned.length;
  const cart = shared.cart;
  const store =
    cart?.store ||
    assigned.find((entry) => entry.id === shared.selection?.storeId) ||
    (count === 1 ? assigned[0] : null);
  const schedule = store?.deliverySchedule;
  const period = cart?.store && store && cart.store.id === store.id ? cart.date : null;
  const deliveryDate = displayDate(period) || displayDate(nextStoreDelivery(schedule, wibToday()));
  const packages = (cart?.items || []).reduce(
    (total, item) => total + (Number(item.quantity) || 0),
    0,
  );
  const scheduleText = schedule
    ? `Setiap ${weekdays[schedule.weekday] || 'hari terjadwal'} · ${schedule.intervalWeeks === 2 ? 'dua mingguan' : 'mingguan'}`
    : 'Jadwal ditentukan Admin';
  const status = cartStatus(cart);
  const { promos, recommendations } = storeBuyerSelections(products);
  const bannerProducts = (promos.length ? promos : recommendations).slice(0, 3);
  const canOpenStoreCart = Boolean(store || count > 0);
  const setStoreMode = () => onCartMode?.('store');
  const setPersonalMode = () => onCartMode?.('personal');

  const menu = [
    { title: 'Keranjang bersama', href: '#/keranjang', icon: 'cart', action: setStoreMode },
    { title: 'Jadwal pengiriman', href: '#/akun/kalender', icon: 'calendar' },
    { title: 'Pesanan toko', href: '#/pesanan', icon: 'orders' },
    { title: 'Katalog produk', href: '#/cari?q=', icon: 'catalog' },
    { title: 'Promo & penawaran', href: '#/cari?q=', icon: 'tag' },
    { title: 'Pengaturan akun', href: '#/akun', icon: 'settings' },
  ];

  return (
    <div className="bam-buyer-storefront" aria-label="Beranda Pembeli Toko BAM">
      <aside className="bam-buyer-storefront-sidebar" aria-label="Informasi toko dan menu cepat">
        <section className="bam-buyer-side-card bam-buyer-store-profile">
          <h2>Toko aktif</h2>
          <div className="bam-buyer-profile-row">
            <span className="bam-buyer-profile-symbol">
              <StoreIcon name="shop" size={26} />
            </span>
            <div>
              <h1 id="bam-buyer-dashboard-title">
                {store?.storeName || (count > 1 ? 'Pilih toko aktif' : 'Toko belum terhubung')}
              </h1>
              <small>{store?.storeCode || 'Hubungi Admin BAM'}</small>
            </div>
          </div>
          <a className="bam-buyer-profile-button" href="#/akun">
            Lihat profil toko <StoreIcon name="arrow" size={16} />
          </a>
        </section>
        <section className="bam-buyer-side-card bam-buyer-cart-card">
          <h2>Keranjang bersama</h2>
          <div className="bam-buyer-cart-overview">
            <span className="bam-buyer-cart-symbol">
              <StoreIcon name="cart" size={25} />
            </span>
            <div>
              <strong>{cart ? `${packages} kemasan` : 'Belum tersedia'}</strong>
              <span className="bam-buyer-cart-status">{status}</span>
              {cart && <small>{cart.items.length} SKU</small>}
            </div>
          </div>
          <a
            className="bam-buyer-cart-open"
            href={canOpenStoreCart ? '#/keranjang' : '#/akun'}
            onClick={canOpenStoreCart ? setStoreMode : undefined}
          >
            {store
              ? 'Lanjutkan keranjang'
              : count > 0
                ? 'Pilih toko untuk belanja'
                : 'Periksa akun toko'}{' '}
            <StoreIcon name="arrow" size={17} />
          </a>
        </section>
        <section
          className="bam-buyer-side-card bam-buyer-side-facts"
          aria-label="Jadwal dan pesanan"
        >
          <a href="#/akun/kalender" className="bam-buyer-side-fact">
            <span className="bam-buyer-side-fact-icon">
              <StoreIcon name="calendar" />
            </span>
            <span>
              <small>Jadwal pengiriman</small>
              <strong>{deliveryDate || 'Belum ditetapkan'}</strong>
              <small>{scheduleText}</small>
            </span>
            <span className="bam-buyer-side-chevron">›</span>
          </a>
          <a href="#/pesanan" className="bam-buyer-side-fact">
            <span className="bam-buyer-side-fact-icon">
              <StoreIcon name="orders" />
            </span>
            <span>
              <small>Pesanan toko</small>
              <strong>Lihat riwayat pesanan</strong>
              <small>Status dan detail pesanan</small>
            </span>
            <span className="bam-buyer-side-chevron">›</span>
          </a>
          <a href="#/cari?q=" className="bam-buyer-side-fact">
            <span className="bam-buyer-side-fact-icon">
              <StoreIcon name="box" />
            </span>
            <span>
              <small>Kebutuhan toko</small>
              <strong>Jelajahi katalog</strong>
              <small>Produk yang tersedia</small>
            </span>
            <span className="bam-buyer-side-chevron">›</span>
          </a>
        </section>
        <nav className="bam-buyer-side-card bam-buyer-side-menu" aria-label="Menu cepat toko">
          <h2>Menu cepat</h2>
          {menu.map((item) => (
            <a key={item.title} href={item.href} onClick={item.action}>
              <StoreIcon name={item.icon} size={18} />
              <span>{item.title}</span>
              <span className="bam-buyer-side-chevron">›</span>
            </a>
          ))}
          <a className="bam-buyer-personal-link" href="#/cari?q=" onClick={setPersonalMode}>
            <StoreIcon name="cart" size={18} />
            <span>Belanja pribadi</span>
            <span className="bam-buyer-side-chevron">›</span>
          </a>
        </nav>
      </aside>

      <main className="bam-buyer-storefront-main">
        <section className="bam-buyer-promo-hero" aria-labelledby="bam-buyer-promo-title">
          <div className="bam-buyer-promo-copy">
            <span className="bam-buyer-promo-eyebrow">PENAWARAN UNTUK TOKO</span>
            <h2 id="bam-buyer-promo-title">
              {promos.length ? 'Harga khusus untuk tokomu' : 'Temukan kebutuhan tokomu'}
            </h2>
            <p>Temukan promo dan harga dari katalog pemasok BAM.</p>
            <a href="#/cari?q=" >
              Lihat semua promo <StoreIcon name="arrow" size={19} />
            </a>
          </div>
          <div className="bam-buyer-promo-art" aria-hidden="true">
            <span className="bam-buyer-promo-halo" />
            <span className="bam-buyer-promo-package">
              {bannerProducts.map(({ product }, index) => (
                <span key={product.id} className={'bam-buyer-promo-visual is-' + index}>
                  <ProductImage product={product} variant="promo" />
                </span>
              ))}
            </span>
            {promos.length > 0 && <span className="bam-buyer-promo-tag">%</span>}
          </div>
        </section>

        {promos.length > 0 && (
          <section className="bam-buyer-promo-products" aria-labelledby="bam-buyer-deals-title">
            <header className="bam-buyer-section-heading">
              <div className="bam-buyer-promo-section-title">
                <span className="bam-buyer-deals-kicker">Diskon dari katalog</span>
                <h2 id="bam-buyer-deals-title">Produk Promo</h2>
              </div>
              <a href="#/cari?q=" >
                Lihat semua <StoreIcon name="arrow" size={16} />
              </a>
            </header>
            <div className="bam-buyer-promo-product-grid">
              {promos.map((entry) => (
                <StoreProductCard
                  key={entry.product.groupId || entry.product.id}
                  entry={entry}
                  featured
                  />
              ))}
            </div>
          </section>
        )}

        <section
          className="bam-buyer-recommendations"
          aria-labelledby="bam-buyer-recommendations-title"
        >
          <header className="bam-buyer-section-heading">
            <h2 id="bam-buyer-recommendations-title">Rekomendasi untuk toko kamu</h2>
            <a href="#/cari?q=" >
              Lihat semua <StoreIcon name="arrow" size={16} />
            </a>
          </header>
          <div className="bam-buyer-product-grid">
            {recommendations.map((entry) => (
              <StoreProductCard
                key={entry.product.groupId || entry.product.id}
                entry={entry}
              />
            ))}
          </div>
          {!recommendations.length && (
            <p className="bam-buyer-products-empty">Belum ada produk katalog yang tersedia.</p>
          )}
        </section>

        <section className="bam-buyer-supplier-section" aria-labelledby="bam-buyer-supplier-title">
          <header className="bam-buyer-section-heading">
            <h2 id="bam-buyer-supplier-title">Mitra pemasok</h2>
            <a href="#/cari?q=" >
              Lihat semua <StoreIcon name="arrow" size={16} />
            </a>
          </header>
          <div className="bam-buyer-supplier-grid">
            {suppliers.slice(0, 4).map((supplier) => (
              <a
                className={'bam-buyer-supplier-card is-' + supplier.color}
                href={supplierHref(supplier.id)}
                key={supplier.id}
              >
                <span className="bam-buyer-supplier-emblem">{supplier.initials}</span>
                <strong>{supplier.name}</strong>
                <small>Lihat produk</small>
              </a>
            ))}
          </div>
        </section>
        <div className="bam-buyer-mode-footnote">
          <span>
            Belanja untuk: <strong>{shared.personal ? 'Pribadi' : 'Toko'}</strong>
          </span>
          <button type="button" onClick={shared.personal ? setStoreMode : setPersonalMode}>
            Beralih ke {shared.personal ? 'keranjang toko' : 'belanja pribadi'}
          </button>
        </div>
      </main>
    </div>
  );
}
