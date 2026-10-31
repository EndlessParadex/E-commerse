import { nextStoreDelivery } from '../../data/b2bDeliverySchedule';
import './StoreBuyerDashboard.css';

const weekdays = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function todayWIB() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function displayDate(value) {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value || '')) return null;
  const date = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function StorefrontIcon({ name }) {
  const paths = {
    store: (
      <>
        <path d="M3 9h18l-2-5H5L3 9Z" />
        <path d="M4 9v11h16V9M9 20v-7h6v7" />
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
        <path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z" />
        <path d="M9 8h6M9 12h6" />
      </>
    ),
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.store}
    </svg>
  );
}

function cartStatus(cart) {
  if (!cart) return 'Belum ada keranjang aktif';
  if (cart.status === 'finalized') return 'Sudah difinalisasi';
  if (cart.status === 'locked') return 'Sedang diperiksa Admin';
  if (cart.reviewRequested) return 'Menunggu pemeriksaan Admin';
  return cart.status === 'open' ? 'Draft terbuka' : 'Lihat status di keranjang';
}

export default function StoreBuyerDashboard({ shared, onCartMode }) {
  const list = Array.isArray(shared.stores?.stores) ? shared.stores.stores : [];
  const total = shared.stores?.total ?? list.length;
  const cart = shared.cart;
  const store =
    cart?.store ||
    list.find((item) => item.id === shared.selection?.storeId) ||
    (total === 1 ? list[0] : null);
  const schedule = store?.deliverySchedule;
  const period = cart?.store && store && cart.store.id === store.id ? cart.date : null;
  const upcoming = nextStoreDelivery(schedule, todayWIB());
  const shownDate = displayDate(period) || displayDate(upcoming);
  const packages = (cart?.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const skuCount = cart?.items?.length ?? 0;
  const status = cartStatus(cart);
  const scheduleSummary = schedule
    ? `${weekdays[schedule.weekday] || 'Hari terjadwal'} · ${schedule.intervalWeeks === 2 ? 'dua mingguan' : 'mingguan'}`
    : 'Jadwal ditentukan Admin BAM';
  const storeCart = () => onCartMode?.('store');

  return (
    <div className="bam-buyer-dashboard" aria-labelledby="bam-buyer-dashboard-title">
      <section className="bam-buyer-store-summary">
        <div className="bam-buyer-store-heading">
          <span className="bam-buyer-store-symbol">
            <StorefrontIcon name="store" />
          </span>
          <div className="bam-buyer-store-identity">
            <span className="bam-buyer-store-eyebrow">TOKO AKTIF</span>
            <h1 id="bam-buyer-dashboard-title">
              {store?.storeName || (total > 1 ? 'Pilih toko aktif' : 'Toko belum terhubung')}
            </h1>
            <p>
              {store
                ? [store.storeCode, scheduleSummary].filter(Boolean).join(' · ')
                : 'Hubungi Admin BAM untuk menghubungkan akun dengan toko.'}
            </p>
          </div>
          {cart && <span className={'bam-buyer-store-status status-' + cart.status}>{status}</span>}
        </div>
        <div className="bam-buyer-store-facts" aria-label="Informasi keranjang dan pengiriman toko">
          <span className="bam-buyer-store-fact">
            <StorefrontIcon name="cart" />
            <span>
              {cart ? `${skuCount} SKU · ${packages} kemasan` : 'Keranjang belum tersedia'}
            </span>
          </span>
          <span className="bam-buyer-store-fact">
            <StorefrontIcon name="calendar" />
            <span>
              {shownDate
                ? `${period && displayDate(period) ? 'Periode keranjang' : 'Pengiriman berikutnya'}: ${shownDate}`
                : 'Jadwal pengiriman belum ditetapkan'}
            </span>
          </span>
        </div>
      </section>

      <nav className="bam-buyer-primary-actions" aria-label="Akses cepat Pembeli Toko">
        <a
          className="bam-buyer-primary-card is-cart"
          href={store ? '#/keranjang' : '#/akun'}
          onClick={store ? storeCart : undefined}
        >
          <span className="bam-buyer-primary-icon">
            <StorefrontIcon name="cart" />
          </span>
          <span className="bam-buyer-primary-copy">
            <strong>Keranjang Toko</strong>
            <small>
              {!store
                ? 'Periksa akun dan akses toko'
                : cart?.status === 'open' && !cart.reviewRequested
                  ? 'Lanjutkan pengisian keranjang bersama'
                  : 'Lihat barang dan status keranjang'}
            </small>
          </span>
          <span className="bam-buyer-primary-arrow">
            <StorefrontIcon name="arrow" />
          </span>
        </a>
        <a className="bam-buyer-primary-card is-orders" href="#/pesanan">
          <span className="bam-buyer-primary-icon">
            <StorefrontIcon name="orders" />
          </span>
          <span className="bam-buyer-primary-copy">
            <strong>Pesanan Saya</strong>
            <small>Periksa riwayat dan status pesanan akun</small>
          </span>
          <span className="bam-buyer-primary-arrow">
            <StorefrontIcon name="arrow" />
          </span>
        </a>
      </nav>
    </div>
  );
}
