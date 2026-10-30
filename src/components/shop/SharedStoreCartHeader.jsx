import SharedDeliveryCalendar from './SharedDeliveryCalendar';

function HeaderIcon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === 'store' ? (
        <>
          <path d="M4 10v11h16V10M3 5h18l1 5a4 4 0 0 1-7 2 4 4 0 0 1-6 0 4 4 0 0 1-7-2l1-5Z" />
          <path d="M9 21v-7h6v7" />
        </>
      ) : name === 'code' ? (
        <>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </>
      ) : name === 'calendar' ? (
        <>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M7 3v4M17 3v4M3 10h18" />
        </>
      ) : name === 'package' ? (
        <>
          <path d="m12 2 9 5-9 5-9-5 9-5ZM3 7v10l9 5 9-5V7M12 12v10" />
        </>
      ) : (
        <path d="M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7" />
      )}
    </svg>
  );
}

export default function SharedStoreCartHeader({
  cart,
  quantity,
  frozen,
  selectingStore,
  onSwitchStore,
  onRefresh,
  onChooseDate,
  dateLabel,
}) {
  const status =
    cart.status === 'open'
      ? cart.reviewRequested
        ? 'Menunggu pemeriksaan Admin'
        : 'Draft terbuka'
      : cart.status === 'locked'
        ? 'Diperiksa Admin'
        : 'Pesanan final';

  return (
    <section
      className="shared-cart-heading shared-store-header-card"
      data-revision={cart.revision}
      aria-label="Identitas toko dan periode keranjang bersama"
    >
      <div className="shared-store-header-top">
        <div className="shared-store-header-identity">
          <span className="shared-store-header-icon">
            <HeaderIcon name="store" />
          </span>
          <div className="shared-store-header-title">
            <span className="shared-store-header-eyebrow">Toko aktif</span>
            <h2>{cart.store.storeName}</h2>
          </div>
        </div>
        <button
          type="button"
          className="bam-button-secondary shared-switch-store"
          disabled={frozen || selectingStore}
          onClick={onSwitchStore}
        >
          <HeaderIcon name="store" />
          Ganti Toko
        </button>
      </div>

      <div className="shared-store-header-facts">
        <div className="shared-store-header-fact">
          <span className="shared-store-header-fact-icon">
            <HeaderIcon name="code" />
          </span>
          <div>
            <span className="shared-store-header-label">Kode Toko</span>
            <strong>{cart.store.storeCode}</strong>
          </div>
        </div>
        <div className="shared-store-header-fact shared-store-header-period">
          <span className="shared-store-header-fact-icon">
            <HeaderIcon name="calendar" />
          </span>
          <div className="shared-store-header-period-copy">
            <span className="shared-store-header-label">Periode Pengiriman</span>
            <strong>{dateLabel(cart.date)}</strong>
            {cart.overdue && <span className="shared-overdue-label">Lewat jadwal</span>}
          </div>
          <SharedDeliveryCalendar
            compact
            date={cart.date}
            schedule={cart.store.deliverySchedule}
            disabled={frozen}
            onChoose={onChooseDate}
          />
        </div>
        <div className="shared-store-header-fact">
          <span className="shared-store-header-fact-icon">
            <HeaderIcon name="package" />
          </span>
          <div>
            <span className="shared-store-header-label">Isi Keranjang</span>
            <strong>
              {cart.items.length} SKU · {quantity} kemasan
            </strong>
          </div>
        </div>
        <div className="shared-store-header-status-group">
          <span className={'shared-cart-status status-' + cart.status}>{status}</span>
          <button
            type="button"
            className="shared-store-header-refresh"
            disabled={frozen}
            onClick={onRefresh}
            aria-label="Muat terbaru"
            title="Muat terbaru"
          >
            <HeaderIcon name="refresh" />
            <span className="shared-quantity-submit-sr">Muat terbaru</span>
          </button>
        </div>
      </div>
    </section>
  );
}
