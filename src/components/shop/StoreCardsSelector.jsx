import { useEffect, useRef, useState } from 'react';
import { nextStoreDelivery } from '../../data/b2bDeliverySchedule';
import './StoreCardsSelector.css';

const weekdays = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const wibToday = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type) => parts.find((entry) => entry.type === type)?.value;
  return part('year') + '-' + part('month') + '-' + part('day');
};
const formatted = (iso) =>
  iso
    ? new Date(iso + 'T00:00:00+07:00').toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Jakarta',
      })
    : '';

export function storeCartTarget(store, previousDate) {
  const date = nextStoreDelivery(store.deliverySchedule, wibToday());
  return { storeId: store.id, date: date || previousDate || wibToday() };
}

/**
 * The same server-scoped store cards appear on Sales home and as a cart modal.
 * Access control remains on /api/b2b/stores and shared.choose(), not in this UI.
 */
export default function StoreCardsSelector({
  shared,
  variant = 'page',
  onChoose,
  onClose,
  activeId = shared.selection?.storeId,
}) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const rootRef = useRef(null);
  const busy = loading || shared.busy || shared.reading || shared.uncertain;
  const { stores = [], page = 1, pages = 1, total = 0 } = shared.stores || {};
  useEffect(() => {
    if (variant !== 'modal') return;
    const previouslyFocused = document.activeElement;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    rootRef.current?.querySelector('input[type="search"]')?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = Array.from(
        rootRef.current?.querySelectorAll(
          'input:not(:disabled), button:not(:disabled), a[href]',
        ) || [],
      );
      const first = elements[0];
      const last = elements.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = priorOverflow;
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [variant, onClose]);

  const search = async (pageNumber = 1) => {
    if (busy) return;
    setLoading(true);
    try {
      await shared.findStores(query.trim(), pageNumber);
    } finally {
      setLoading(false);
    }
  };
  const content = (
    <section className={'bam-store-selector is-' + variant} aria-labelledby="bam-store-selector-title">
      <header className="bam-store-selector-heading">
        <div>
          <p className="bam-store-selector-kicker">KERANJANG BERSAMA BAM</p>
          <h2 id="bam-store-selector-title">{variant === 'modal' ? 'Ganti Toko' : 'Pilih Toko'}</h2>
          <p>Pilih toko yang ditugaskan, kemudian buka keranjang toko tersebut.</p>
        </div>
        {onClose && (
          <button type="button" className="bam-store-selector-close" onClick={onClose}>
            {variant === 'modal' ? '✕ Tutup' : '← Kembali'}
          </button>
        )}
      </header>
      <form
        className="bam-store-selector-search"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <label htmlFor="bam-store-query">Cari toko berdasarkan nama atau kode</label>
        <div>
          <input
            id="bam-store-query"
            type="search"
            maxLength="200"
            placeholder="Contoh: Nusantara atau TKB-000002"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={busy}
          />
          <button type="submit" disabled={busy}>
            {loading ? 'Mencari…' : 'Cari Toko'}
          </button>
        </div>
      </form>
      <p className="bam-store-selector-count" role="status">
        {total} toko tersedia · Halaman {page} dari {pages}
      </p>
      <div className="bam-store-selector-grid">
        {stores.map((store) => {
          const active = store.id === activeId;
          const schedule = store.deliverySchedule;
          const next = nextStoreDelivery(schedule, wibToday());
          return (
            <button
              key={store.id}
              type="button"
              className={'bam-store-card' + (active ? ' is-active' : '')}
              aria-label={'Buka keranjang ' + store.storeName + ', ' + store.storeCode}
              disabled={busy}
              onClick={() => void onChoose(store)}
            >
              <span className="bam-store-card-icon" aria-hidden="true">▣</span>
              <span className="bam-store-card-copy">
                <strong>{store.storeName}</strong>
                <small>{store.storeCode}</small>
                <span>
                  {schedule
                    ? weekdays[schedule.weekday] + ' · ' + (schedule.intervalWeeks === 2 ? 'Dua mingguan' : 'Mingguan')
                    : 'Jadwal belum ditetapkan'}
                </span>
                {next && <small>Pengiriman berikutnya: {formatted(next)}</small>}
              </span>
              <span className="bam-store-card-end">
                {active && <span className="bam-store-card-active">Aktif</span>}
                <span aria-hidden="true">→</span>
              </span>
            </button>
          );
        })}
      </div>
      {!stores.length && (
        <p className="bam-store-selector-empty">
          {query
            ? 'Tidak ada toko untuk pencarian ini. Coba nama atau kode lain.'
            : 'Belum ada toko yang ditugaskan. Hubungi Admin atau Owner BAM.'}
        </p>
      )}
      {pages > 1 && (
        <div className="bam-store-selector-pagination">
          <button type="button" disabled={busy || page <= 1} onClick={() => void search(page - 1)}>
            Sebelumnya
          </button>
          <span>Halaman {page}/{pages}</span>
          <button type="button" disabled={busy || page >= pages} onClick={() => void search(page + 1)}>
            Berikutnya
          </button>
        </div>
      )}
      {shared.error && <p className="shop-warning" role="alert">{shared.error}</p>}
    </section>
  );
  if (variant !== 'modal') return content;
  return (
    <div
      className="bam-store-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={rootRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bam-store-selector-title"
        className="bam-store-modal"
      >
        {content}
      </div>
    </div>
  );
}
