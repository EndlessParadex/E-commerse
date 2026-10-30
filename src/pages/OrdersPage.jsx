import { useState } from 'react';
import PackagingSummary from '../components/shop/PackagingSummary';
import { orderItemPresentation } from '../data/orderItemPresentation';
import {
  orderCardStages,
  orderExtraFilters,
  orderPrimaryFilters,
} from '../data/orderListPresentation';
import { orderStatus, orderStatusLabel, cancellationReason } from '../state/orderModel';
import useOrderSearch from '../state/useOrderSearch';
import { dateLabel, rupiah } from '../components/shop/shopPresentation';
import ProductImage from '../components/shop/ProductImage';
import './OrdersPage.css';
import '../components/shop/OrderItem.css';
import CancelOrderDialog from '../components/shop/CancelOrderDialog';

export default function OrdersPage() {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [showExtraFilters, setShowExtraFilters] = useState(false);
  const {
    orders,
    failed,
    loading,
    server,
    owner,
    error,
    nextCursor,
    total,
    loadMore,
    moreBusy,
    pageError,
    retry,
  } = useOrderSearch('own', query, filter);
  const [cancelTarget, setCancelTarget] = useState(null);
  const visibleOrders = orders;
  const extraFilterActive = orderExtraFilters.some((item) => item.id === filter);
  const filterButton = (item) => (
    <button
      type="button"
      key={item.id}
      aria-pressed={filter === item.id}
      onClick={() => setFilter(item.id)}
    >
      {item.label}
    </button>
  );

  return (
    <div className="orders-page">
      <nav className="shop-breadcrumb" aria-label="Breadcrumb">
        <a href="#/">Beranda</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Pesanan saya</span>
      </nav>
      <header className="orders-heading">
        <div>
          <span className="section-eyebrow">Aktivitas belanja</span>
          <h1>Pesanan saya</h1>
          <p>
            {loading
              ? 'Memuat…'
              : `${total ?? orders.length} ${server ? 'pesanan' : 'pesanan simulasi'}`}
          </p>
        </div>
        <a className="orders-shopping-link" href="#/">
          Lanjut berbelanja →
        </a>
      </header>
      <p className="orders-notice">
        <span className="orders-notice-icon" aria-hidden="true">
          ⓘ
        </span>
        <span>
          {server
            ? 'Pesanan tersimpan di akun Anda dan dapat diakses dari perangkat lain setelah login.'
            : 'Pesanan simulasi hanya tersimpan di tab browser ini, belum terhubung ke akun atau toko. Menutup tab dapat menghapus riwayat.'}
        </span>
      </p>
      {(server ? owner !== 'guest' : Boolean(orders.length || query || filter !== 'all')) && (
        <section className="orders-toolbar" aria-label="Cari dan filter pesanan">
          <div className="orders-filter-primary" role="group" aria-label="Filter status utama">
            {orderPrimaryFilters.map(filterButton)}
          </div>
          <div className="orders-search-field">
            <label htmlFor="buyer-order-search">Cari pesanan</label>
            <div className="orders-search-input-wrap">
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m16 16 5 5" />
              </svg>
              <input
                id="buyer-order-search"
                type="search"
                maxLength={200}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nomor pesanan, penerima, produk, atau SKU"
              />
            </div>
          </div>
          <div className="orders-extra-controls">
            <button
              type="button"
              className="orders-more-filters-toggle"
              aria-expanded={showExtraFilters || extraFilterActive}
              aria-controls="orders-extra-filters"
              onClick={() => setShowExtraFilters((current) => !current)}
            >
              Filter status lainnya
              {extraFilterActive
                ? ': ' + orderExtraFilters.find((item) => item.id === filter).label
                : ''}
              <span aria-hidden="true">{showExtraFilters || extraFilterActive ? '−' : '+'}</span>
            </button>
            {(filter !== 'all' || query.trim()) && (
              <button
                type="button"
                className="orders-reset-filters"
                onClick={() => {
                  setFilter('all');
                  setQuery('');
                  setShowExtraFilters(false);
                }}
              >
                Reset filter
              </button>
            )}
          </div>
          {(showExtraFilters || extraFilterActive) && (
            <div
              id="orders-extra-filters"
              className="orders-filter-extra"
              role="group"
              aria-label="Filter status lainnya"
            >
              {orderExtraFilters.map(filterButton)}
            </div>
          )}
        </section>
      )}
      {loading ? (
        <section className="orders-empty" role="status">
          <h2>Memuat pesanan…</h2>
        </section>
      ) : server && owner === 'guest' ? (
        <section className="orders-empty">
          <h2>Masuk untuk melihat pesanan</h2>
          <a className="shop-primary" href="#/login">
            Masuk ke akun
          </a>
        </section>
      ) : failed ? (
        <section className="orders-empty" role="alert">
          <h2>Riwayat belum dapat dibuka</h2>
          <p>
            {server
              ? error || 'Server belum dapat dihubungi. Coba muat ulang halaman.'
              : 'Penyimpanan browser tidak tersedia. Coba muat ulang halaman atau periksa pengaturan browser.'}
          </p>
          <button
            className="shop-primary"
            type="button"
            onClick={server ? retry : () => window.location.reload()}
          >
            Coba lagi
          </button>
        </section>
      ) : orders.length === 0 && !query.trim() && filter === 'all' ? (
        <section className="orders-empty">
          <span aria-hidden="true">📦</span>
          <h2>Belum ada pesanan</h2>
          <p>Pesanan yang dibuat melalui checkout akan muncul di sini.</p>
          <a className="shop-primary" href="#/">
            Mulai berbelanja
          </a>
        </section>
      ) : !visibleOrders.length ? (
        <section className="orders-empty">
          <h2>Belum ada pesanan pada pilihan ini</h2>
          <button
            type="button"
            className="bam-button-secondary"
            onClick={() => {
              setFilter('all');
              setQuery('');
            }}
          >
            Lihat semua pesanan
          </button>
        </section>
      ) : (
        <ul className="orders-list">
          {visibleOrders.map((order) => (
            <li key={order.id} className="orders-card">
              <div className="orders-card-header">
                <div className="orders-card-identity">
                  <strong className="orders-number">{order.id}</strong>
                  <time dateTime={new Date(order.createdAt).toISOString()}>
                    {dateLabel(order.createdAt)}
                  </time>
                </div>
                <span className={'orders-status status-' + orderStatus(order)}>
                  {orderStatusLabel(order)}
                  {order.simulation || !server ? ' · Simulasi' : ''}
                </span>
              </div>
              <div className="orders-card-recipient">
                <span className="orders-card-store-icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    width="22"
                    height="22"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 10v11h16V10M3 5h18l1 5a4 4 0 0 1-7 2 4 4 0 0 1-6 0 4 4 0 0 1-7-2l1-5Z" />
                    <path d="M9 21v-7h6v7" />
                  </svg>
                </span>
                <div>
                  <span className="orders-card-recipient-label">
                    {order.b2b ? 'Toko tujuan' : 'Penerima pesanan'}
                  </span>
                  <strong>{order.b2b?.storeName || order.recipient || 'Belum dicatat'}</strong>
                  {order.b2b?.storeCode && <small>{order.b2b.storeCode}</small>}
                </div>
                <a
                  href={'#/pesanan/' + encodeURIComponent(order.id)}
                  className="orders-card-recipient-arrow"
                  aria-label={'Buka pesanan ' + order.id}
                >
                  <span aria-hidden="true">→</span>
                </a>
              </div>
              {orderCardStages(orderStatus(order)).length > 0 && (
                <ol className="orders-card-progress" aria-label={'Tahap pesanan ' + order.id}>
                  {orderCardStages(orderStatus(order)).map((stage) => (
                    <li
                      key={stage.label}
                      className={'orders-card-progress-step is-' + stage.state}
                      aria-current={stage.state === 'current' ? 'step' : undefined}
                    >
                      <span className="orders-card-progress-dot" aria-hidden="true">
                        {stage.state === 'done' ? '✓' : '●'}
                      </span>
                      <span>{stage.label}</span>
                    </li>
                  ))}
                </ol>
              )}
              <div className="orders-card-preview">
                <ul className="orders-preview-products" aria-label="Pratinjau barang pesanan">
                  {order.items.slice(0, 3).map((item) => {
                    const display = orderItemPresentation(item);
                    return (
                      <li key={item.id} title={display.name}>
                        <ProductImage product={display.product} variant="thumbnail" />
                      </li>
                    );
                  })}
                  {order.items.length > 3 && (
                    <li className="orders-preview-more">+{order.items.length - 3}</li>
                  )}
                </ul>
                <div className="orders-card-preview-details">
                  <p className="orders-card-preview-summary">
                    {order.items.length} SKU ·{' '}
                    {order.items.reduce((sum, item) => sum + item.quantity, 0)} kemasan
                  </p>
                  <ul className="orders-preview-packaging" aria-label="Ringkasan jenis kemasan">
                    {order.items.slice(0, 3).map((item) => {
                      const display = orderItemPresentation(item);
                      return display.packaging ? (
                        <li key={item.id}>
                          <PackagingSummary
                            packaging={display.packaging}
                            quantity={item.quantity}
                          />
                        </li>
                      ) : null;
                    })}
                  </ul>
                </div>
              </div>
              <div className="orders-card-footer">
                <div className="orders-card-total">
                  <span>
                    {['cancelled', 'expired'].includes(orderStatus(order))
                      ? 'Total pesanan'
                      : 'Total pembayaran'}
                  </span>
                  <strong>{rupiah(order.total)}</strong>
                  <small>{order.codFixedTotal ? 'Gratis ongkir' : 'Termasuk ongkir'}</small>
                </div>
                <div className="orders-card-actions">
                  <a
                    className="shop-primary"
                    href={'#/pesanan/' + encodeURIComponent(order.id)}
                    aria-label={'Lihat detail pesanan ' + order.id}
                  >
                    Lihat detail <span aria-hidden="true">→</span>
                  </a>
                  {orderStatus(order) === 'awaiting_payment' && (
                    <a
                      className="bam-button-secondary"
                      href={'#/pesanan/' + encodeURIComponent(order.id) + '/pembayaran'}
                    >
                      Lanjutkan pembayaran
                    </a>
                  )}
                  {!order.b2b && !cancellationReason(order) && (
                    <button
                      className="bam-button-danger"
                      type="button"
                      onClick={() => setCancelTarget(order)}
                    >
                      Batalkan pesanan
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!loading && !failed && server && (
        <p className="orders-notice">
          Menampilkan {orders.length} dari {total ?? orders.length} pesanan
          {query.trim() || filter !== 'all' ? ' yang sesuai filter' : ''}.
        </p>
      )}
      {pageError && (
        <p className="shop-warning" role="alert">
          {pageError}
        </p>
      )}
      {nextCursor && (
        <button
          className="shop-primary"
          type="button"
          disabled={moreBusy || loading}
          onClick={loadMore}
        >
          {moreBusy ? 'Memuat…' : 'Muat pesanan lebih lama'}
        </button>
      )}
      {cancelTarget && (
        <CancelOrderDialog
          order={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onCancelled={() => {}}
        />
      )}
    </div>
  );
}
