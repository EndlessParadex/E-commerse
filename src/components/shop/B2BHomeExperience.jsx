import { useState } from 'react';
import { nextStoreDelivery } from '../../data/b2bDeliverySchedule';
import StoreCardsSelector, { storeCartTarget } from './StoreCardsSelector';
import './B2BHomeExperience.css';

const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const dayLabel = (iso) => {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(iso || '')) return '';
  const [year, month, day] = iso.split('-').map(Number);
  const timestamp = new Date(Date.UTC(year, month - 1, day));
  if (timestamp.toISOString().slice(0, 10) !== iso) return '';
  return timestamp.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

function RoleIcon({ name }) {
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
        <path d="M7 3v4M17 3v4M3 10h18M8 14h3M14 14h3" />
      </>
    ),
    catalog: (
      <>
        <rect x="4" y="4" width="7" height="7" rx="1" />
        <rect x="13" y="4" width="7" height="7" rx="1" />
        <rect x="4" y="13" width="7" height="7" rx="1" />
        <rect x="13" y="13" width="7" height="7" rx="1" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] || paths.store}
    </svg>
  );
}

/** All store names and assigned shops below come from server-filtered shared cart context. */
export default function B2BHomeExperience({ shared, onCartMode, onDirectoryChange }) {
  const sales = shared.role === 'sales';
  const [showStores, setShowStores] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const stores = Array.isArray(shared.stores?.stores) ? shared.stores.stores : [];
  const count = shared.stores?.total ?? stores.length;
  const selected =
    stores.find((store) => store.id === shared.selection?.storeId) ||
    (count === 1 ? stores[0] : null);
  const schedule = selected?.deliverySchedule;
  const selectedDate =
    schedule && shared.selection?.storeId === selected?.id
      ? nextStoreDelivery(schedule, shared.selection.date)
      : null;
  const scheduleLabel = schedule
    ? `Setiap ${days[schedule.weekday]} · ${schedule.intervalWeeks === 2 ? '2 minggu' : '1 minggu'}`
    : 'Jadwal belum ditetapkan';
  const shopName =
    selected?.storeName || (count > 1 ? `${count} toko terhubung` : 'Belum ada toko');
  // Kotak Sales: tepat dua, "List Toko" (keranjang toko) dan "Belanja biasa" (keranjang pribadi).
  const cards = sales
    ? [
        {
          id: 'stores',
          icon: 'store',
          title: 'List Toko',
          description: count
            ? `${count} toko yang ditugaskan — isi keranjang bersama`
            : 'Belum ada toko yang ditugaskan',
          href: '#/keranjang',
          cta: 'Buka daftar toko',
          mode: 'store',
        },
        {
          id: 'personal',
          icon: 'cart',
          title: 'Belanja biasa',
          description: 'Belanja pribadi menggunakan keranjang dan checkout terpisah',
          href: '#/cari?q=',
          cta: 'Mulai belanja pribadi',
          mode: 'personal',
        },
      ]
    : [
        {
          id: 'store',
          icon: 'store',
          title: 'Toko Saya',
          description: count
            ? `${shopName} · ${scheduleLabel}${selectedDate ? ' · ' + dayLabel(selectedDate) : ''}`
            : 'Akun belum terhubung ke toko',
          href: '#/keranjang',
          cta: 'Buka keranjang toko',
          mode: 'store',
        },
        {
          id: 'personal',
          icon: 'cart',
          title: 'Belanja pribadi',
          description: 'Keranjang pribadi dan checkout sendiri, terpisah dari pesanan toko',
          href: '#/cari?q=',
          cta: 'Mulai belanja pribadi',
          mode: 'personal',
        },
      ];
  const selectStore = async (store) => {
    if (selecting || shared.busy || shared.uncertain || shared.reading) return;
    setSelecting(true);
    try {
      const target = storeCartTarget(store, shared.selection?.date);
      const chosen = await shared.choose(target);
      if (!chosen) return;
      onCartMode?.('store');
      window.location.hash = '/keranjang';
    } finally {
      setSelecting(false);
    }
  };
  if (sales && showStores)
    return (
      <div className="bam-role-store-list">
        <StoreCardsSelector
          shared={shared}
          variant="page"
          disabled={selecting}
          onChoose={selectStore}
          onClose={() => {
            setShowStores(false);
            onDirectoryChange?.(false);
          }}
        />
      </div>
    );
  return (
    <div className={'bam-role-home bam-role-home--' + (sales ? 'sales' : 'buyer')}>
      <section className="bam-role-home-hero" aria-labelledby="bam-role-home-title">
        <div className="bam-role-home-copy">
          <span className="bam-role-home-kicker">
            {sales ? 'AREA SALES BAM' : 'BELANJA TOKO BAM'}
          </span>
          <h1 id="bam-role-home-title">
            {sales ? 'Lengkapi kebutuhan toko pelanggan Anda' : 'Belanja mudah untuk tokomu'}
          </h1>
          <p>
            {sales
              ? 'Pilih toko yang ditugaskan, lihat katalog, dan bantu isi keranjang bersama.'
              : 'Temukan kebutuhan toko dan isi keranjang bersama sesuai jadwal yang ditetapkan.'}
          </p>
          <a
            className="bam-role-home-primary"
            href={sales && count ? '#/' : count ? '#/keranjang' : '#/cari?q='}
            onClick={(event) => {
              if (sales && count) {
                event.preventDefault();
                setShowStores(true);
                onDirectoryChange?.(true);
                onDirectoryChange?.(true);
              } else onCartMode?.(count ? 'store' : 'personal');
            }}
          >
            {sales
              ? count
                ? 'Buka List Toko'
                : 'Jelajahi Produk'
              : count
                ? 'Buka Toko Saya'
                : 'Jelajahi Produk'}
            <span aria-hidden="true">→</span>
          </a>
          {shared.cart?.store && shared.canEdit && shared.cart.status === 'open' && (
            <a
              className="bam-role-home-quick"
              href="#/order-cepat"
              onClick={() => onCartMode?.('store')}
            >
              Order Cepat · {shared.cart.store.storeName}
              <span aria-hidden="true">→</span>
            </a>
          )}
        </div>
        <div className="bam-role-home-art" aria-hidden="true">
          <div className="bam-role-home-art-halo" />
          <div className="bam-role-home-art-shop">
            <RoleIcon name="store" />
          </div>
          <div className="bam-role-home-art-cart">
            <RoleIcon name="cart" />
          </div>
          <div className="bam-role-home-art-grid">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} />
            ))}
          </div>
        </div>
      </section>
      <nav
        className="bam-role-home-actions"
        aria-label={sales ? 'Akses cepat Sales' : 'Akses cepat toko'}
      >
        {cards.map((card) => (
          <a
            key={card.id}
            className={'bam-role-home-card is-' + card.id}
            href={card.id === 'stores' ? '#/' : card.href}
            onClick={(event) => {
              if (card.id === 'stores') {
                event.preventDefault();
                setShowStores(true);
              } else onCartMode?.(card.mode);
            }}
          >
            <span className="bam-role-home-card-icon">
              <RoleIcon name={card.icon} />
            </span>
            <span className="bam-role-home-card-body">
              <strong>{card.title}</strong>
              <small>{card.description}</small>
              {card.id === 'schedule' && selectedDate && (
                <small className="bam-role-home-next-date">
                  Periode berikutnya: {dayLabel(selectedDate)}
                </small>
              )}
              <span className="bam-role-home-card-cta">
                {card.cta} <span aria-hidden="true">→</span>
              </span>
            </span>
          </a>
        ))}
      </nav>
      <p className="bam-role-home-footnote">
        Keranjang toko difinalisasi oleh Admin BAM. Belanja pribadi memakai checkout dan riwayat
        pesanan akun sendiri.
      </p>
    </div>
  );
}
