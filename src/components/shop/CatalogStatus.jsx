import './CatalogStatus.css';

export default function CatalogStatus({ error = false, onRetry }) {
  return (
    <main
      className={'home-container catalog-status' + (error ? ' is-error' : '')}
      role={error ? 'alert' : 'status'}
      aria-busy={!error}
    >
      <header className="catalog-status-heading">
        <span className="catalog-status-brand" aria-hidden="true">
          ◈
        </span>
        <div>
          <h1>{error ? 'Katalog belum dapat dimuat' : 'Memuat katalog…'}</h1>
          <p>
            {error
              ? 'Periksa koneksi Anda, lalu coba lagi.'
              : 'Menyiapkan pilihan produk untuk Anda.'}
          </p>
        </div>
      </header>
      {error ? (
        <div className="catalog-status-error">
          <span className="catalog-status-symbol" aria-hidden="true">
            !
          </span>
          <p>Produk akan ditampilkan setelah katalog berhasil dimuat.</p>
          <button type="button" className="shop-primary" onClick={onRetry}>
            Coba lagi
          </button>
        </div>
      ) : (
        <div className="catalog-skeleton" aria-hidden="true">
          <div className="catalog-skeleton-banner">
            <span />
            <span />
            <span />
          </div>
          <div className="catalog-skeleton-cards">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="catalog-skeleton-card" key={index}>
                <div className="catalog-skeleton-photo" />
                <div className="catalog-skeleton-copy">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
