import { nextStoreDelivery } from '../../data/b2bDeliverySchedule';
import './StoreBuyerDashboard.css';

const weekdays = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function dateID() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return value('year') + '-' + value('month') + '-' + value('day');
}

function displayDate(date) {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(date || '')) return null;
  const parsed = new Date(date + 'T00:00:00Z');
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
  return parsed.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function DashboardIcon({ name }) {
  const paths = {
    store: <><path d="M3 9h18l-2-5H5L3 9Z" /><path d="M4 9v11h16V9M9 20v-7h6v7" /></>,
    cart: <><path d="M2 4h3l3 12h11l3-9H6" /><circle cx="10" cy="21" r="1" /><circle cx="19" cy="21" r="1" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M8 14h3M14 14h3" /></>,
    orders: <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z" /><path d="M9 8h6M9 12h6" /></>,
    catalog: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  };
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] || paths.store}
    </svg>
  );
}

function cartStatus(cart) {
  if (!cart) return 'Belum ada keranjang aktif';
  if (cart.status === 'finalized') return 'Sudah difinalisasi';
  if (cart.status === 'locked') return 'Sedang diperiksa Admin';
  if (cart.reviewRequested) return 'Menunggu pemeriksaan Admin';
  return cart.status === 'open' ? 'Draft terbuka' : 'Status keranjang tersedia di detail';
}

export default function StoreBuyerDashboard({ shared, onCartMode }) {
  // The authenticated B2B context scopes both store list and cart to this buyer.
  const list = Array.isArray(shared.stores?.stores) ? shared.stores.stores : [];
  const total = shared.stores?.total ?? list.length;
  const cart = shared.cart;
  const store = cart?.store ||
    list.find((item) => item.id === shared.selection?.storeId) ||
    (total === 1 ? list[0] : null);
  const schedule = store?.deliverySchedule;
  const nextDate = nextStoreDelivery(schedule, dateID());
  const period = cart?.store && store && cart.store.id === store.id ? cart.date : null;
  const items = cart?.items || [];
  const packages = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const allowed = Boolean(store);
  const activateStoreCart = () => onCartMode?.('store');
  const activatePersonalCart = () => onCartMode?.('personal');
  const scheduleSummary = schedule
    ? `${weekdays[schedule.weekday] || 'Hari terjadwal'} · setiap ${schedule.intervalWeeks} minggu`
    : 'Jadwal ditentukan Admin BAM';
  const links = [
    {
      id: 'cart',
      icon: 'cart',
      title: 'Keranjang bersama',
      description: 'Lanjutkan atau periksa barang toko',
      href: '#/keranjang',
      action: activateStoreCart,
      disabled: !allowed,
    },
    {
      id: 'orders',
      icon: 'orders',
      title: 'Riwayat pesanan',
      description: 'Lihat status pesanan akun',
      href: '#/pesanan',
    },
    {
      id: 'schedule',
      icon: 'calendar',
      title: 'Jadwal pengiriman',
      description: 'Lihat jadwal yang ditetapkan',
      href: '#/akun/kalender',
    },
    {
      id: 'catalog',
      icon: 'catalog',
      title: 'Katalog produk',
      description: 'Cari barang untuk keranjang toko',
      href: '#/cari?q=',
      action: activateStoreCart,
    },
  ];

  return (
    <div className="bam-buyer-dashboard" aria-labelledby="bam-buyer-dashboard-title">
      <section className="bam-buyer-dashboard-hero">
        <div className="bam-buyer-dashboard-heading">
          <span className="bam-buyer-dashboard-symbol"><DashboardIcon name="store" /></span>
          <div className="bam-buyer-dashboard-heading-copy">
            <span className="bam-buyer-dashboard-eyebrow">DASHBOARD TOKO</span>
            <h1 id="bam-buyer-dashboard-title">
              {store?.storeName || (total > 1 ? 'Pilih toko aktif' : 'Toko belum terhubung')}
            </h1>
            <p>
              {store
                ? [store.storeCode, scheduleSummary].filter(Boolean).join(' · ')
                : 'Hubungi Admin BAM untuk menghubungkan akun dengan toko.'}
            </p>
          </div>
          <span className="bam-buyer-dashboard-role">Akun Pembeli Toko</span>
        </div>
        <p className="bam-buyer-dashboard-intro">
          Lengkapi keranjang bersama sesuai periode pengiriman. Admin BAM memeriksa dan
          memfinalisasi pesanan toko.
        </p>
        <div className="bam-buyer-dashboard-buttons">
          <a
            className={'bam-buyer-dashboard-main-action' + (!allowed ? ' is-disabled' : '')}
            href={allowed ? '#/keranjang' : '#/akun'}
            onClick={allowed ? activateStoreCart : undefined}
          >
            <DashboardIcon name="cart" />
            {allowed ? 'Lanjutkan keranjang toko' : 'Periksa akun toko'}
            <DashboardIcon name="arrow" />
          </a>
          <a className="bam-buyer-dashboard-secondary-action" href="#/pesanan">
            Lihat pesanan <DashboardIcon name="arrow" />
          </a>
        </div>
      </section>
      <div className="bam-buyer-dashboard-stats" aria-label="Ringkasan operasional toko">
        <div className="bam-buyer-dashboard-stat">
          <span className="bam-buyer-dashboard-stat-icon"><DashboardIcon name="cart" /></span>
          <span className="bam-buyer-dashboard-stat-label">Keranjang bersama</span>
          <strong>{cart ? `${packages} kemasan` : 'Belum tersedia'}</strong>
          <small>{cart ? `${items.length} SKU · ${cartStatus(cart)}` : 'Buka keranjang toko untuk memulai'}</small>
        </div>
        <div className="bam-buyer-dashboard-stat">
          <span className="bam-buyer-dashboard-stat-icon"><DashboardIcon name="calendar" /></span>
          <span className="bam-buyer-dashboard-stat-label">Jadwal pengiriman</span>
          <strong>{displayDate(nextDate) || 'Belum ditetapkan'}</strong>
          <small>{scheduleSummary}</small>
        </div>
        <div className="bam-buyer-dashboard-stat">
          <span className="bam-buyer-dashboard-stat-icon"><DashboardIcon name="orders" /></span>
          <span className="bam-buyer-dashboard-stat-label">Periode keranjang aktif</span>
          <strong>{displayDate(period) || 'Belum dipilih'}</strong>
          <small>{cart ? cartStatus(cart) : 'Atur periode pada keranjang toko'}</small>
        </div>
      </div>
      <section className="bam-buyer-dashboard-activities" aria-labelledby="bam-buyer-dashboard-actions-title">
        <div className="bam-buyer-dashboard-section-heading">
          <div>
            <h2 id="bam-buyer-dashboard-actions-title">Aktivitas Toko</h2>
            <p>Akses cepat ke kegiatan pemesanan toko.</p>
          </div>
        </div>
        <nav className="bam-buyer-dashboard-shortcuts" aria-label="Aksi cepat toko">
          {links.map((link) => (
            <a
              key={link.id}
              href={link.disabled ? '#/akun' : link.href}
              className={'bam-buyer-dashboard-shortcut is-' + link.id}
              onClick={link.disabled ? undefined : link.action}
            >
              <span className="bam-buyer-dashboard-shortcut-icon"><DashboardIcon name={link.icon} /></span>
              <span className="bam-buyer-dashboard-shortcut-copy">
                <strong>{link.title}</strong>
                <small>{link.description}</small>
              </span>
              <span className="bam-buyer-dashboard-shortcut-arrow"><DashboardIcon name="arrow" /></span>
            </a>
          ))}
        </nav>
      </section>
      <div className="bam-buyer-dashboard-personal">
        <div>
          <strong>Ingin belanja untuk kebutuhan pribadi?</strong>
          <p>Keranjang dan checkout pribadi terpisah dari keranjang bersama toko.</p>
        </div>
        <a href="#/cari?q=" onClick={activatePersonalCart}>
          Belanja pribadi <DashboardIcon name="arrow" />
        </a>
      </div>
    </div>
  );
}
