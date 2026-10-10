import React, { useState, useRef, useEffect } from 'react';
import './Navbar.css';
import ShopActions from '../shop/ShopActions';
import { useDelivery } from '../../state/useDelivery';
import { normalizeDelivery } from '../../state/deliveryModel';
import { filterCatalogProducts as filterProducts, searchHref } from '../../data/catalog';
import CatalogMenu from './CatalogMenu';
import { productVariants } from '../../data/products';

const Navbar = () => {
  // Deliver To State
  const [showDeliverPopup, setShowDeliverPopup] = useState(false);
  const { user } = useDelivery();
  const accountLocation = user ? normalizeDelivery({ namaToko: user.name, namaJalan: user.address }) : null;
  const deliverRef = useRef(null);
  const [compactDelivery, setCompactDelivery] = useState(() => window.matchMedia('(max-width: 600px)').matches);
  const searchRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const matchingProducts = filterProducts({ query: searchQuery }).slice(0, 8);
  const formatPrice = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
  const highlightQuery = (name) => {
    const query = searchQuery.trim();
    if (!query) return name;
    const parts = name.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'));
    return parts.map((part, index) => part.toLowerCase() === query.toLowerCase() ? <strong key={`${part}-${index}`}>{part}</strong> : part);
  };

  useEffect(() => {
    const media = window.matchMedia('(max-width: 600px)');
    const update = () => setCompactDelivery(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!showDeliverPopup || !compactDelivery) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const popup = deliverRef.current?.querySelector('.deliver-popup');
    popup?.querySelector('.delivery-close')?.focus();
    const trapFocus = (event) => {
      if (event.key !== 'Tab') return;
      const elements = Array.from(popup?.querySelectorAll('a[href], button:not(:disabled), input, textarea') || []);
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    popup?.addEventListener('keydown', trapFocus);
    return () => { document.body.style.overflow = previousOverflow; popup?.removeEventListener('keydown', trapFocus); };
  }, [showDeliverPopup, compactDelivery]);

  // Tutup popup jika klik di luar
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (deliverRef.current && !deliverRef.current.contains(e.target)) {
        setShowDeliverPopup(false);
      }
    };

    document.addEventListener('pointerdown', handleClickOutside);
    const handleSearchOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearchSuggestions(false);
    };
    document.addEventListener('pointerdown', handleSearchOutside);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('pointerdown', handleSearchOutside);
    };
  }, []);

  // Sejajarkan panah dengan tombol, termasuk saat popup dipusatkan di ponsel.
  useEffect(() => {
    if (!showDeliverPopup) return;

    const updateArrowPosition = () => {
      const trigger = deliverRef.current;
      const popup = trigger?.querySelector('.deliver-popup');
      if (!popup) return;
      const triggerRect = trigger.getBoundingClientRect();
      const popupRect = popup.getBoundingClientRect();
      const center = triggerRect.left + triggerRect.width / 2 - popupRect.left;
      const arrowLeft = Math.max(20, Math.min(popupRect.width - 20, center));
      popup.style.setProperty('--popup-arrow-left', `${arrowLeft}px`);
    };

    updateArrowPosition();
    window.addEventListener('resize', updateArrowPosition);
    return () => window.removeEventListener('resize', updateArrowPosition);
  }, [showDeliverPopup, user]);

  const toggleDeliveryPopup = () => setShowDeliverPopup((current) => !current);

  useEffect(() => {
    const routeClose = () => { setShowSearchSuggestions(false); setShowDeliverPopup(false); };
    window.addEventListener('hashchange', routeClose);
    return () => { window.removeEventListener('hashchange', routeClose); };
  }, []);

  return (
    <>
      <header className="navbar">
        <div className="navbar-container">

          {/* Kiri: Logo */}
          <div className="navbar-left">
            <a className="navbar-logo" href="#/" aria-label="BAM. Beranda">
              <span id="logo-text">
                BAM<span className="logo-accent">.</span>
              </span>
            </a>
          </div>

          {/* Tengah: Search */}
          <form className={`navbar-search${showSearchSuggestions ? ' is-active' : ''}`} ref={searchRef} onSubmit={(event) => { event.preventDefault(); setShowSearchSuggestions(false); window.location.hash = searchHref(searchQuery); }}>
            <div className="search-icon-left">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#64748B"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line
                  x1="21"
                  y1="21"
                  x2="16.65"
                  y2="16.65"
                ></line>
              </svg>
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onFocus={() => setShowSearchSuggestions(true)}
              placeholder="Cari di BAM."
              aria-label="Cari produk"
              onKeyDown={(event) => { if (event.key === 'Escape') setShowSearchSuggestions(false); }}
            />

            {showSearchSuggestions && <div className="search-suggestions" aria-label="Saran pencarian">
              <div className="search-suggestion-list">
                {matchingProducts.map((product) => <button type="button" className="search-suggestion" key={product.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { setSearchQuery(product.name); setShowSearchSuggestions(false); window.location.hash = `/produk/${product.id}`; }}>
                  <svg className="suggestion-search-icon" aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
                  <span className="suggestion-product"><span>{highlightQuery(product.baseName || product.name)}</span><small>{product.category} · Mulai {formatPrice(Math.min(...productVariants(product.id).map((item) => item.price)))}</small></span>
                </button>)}
                {matchingProducts.length === 0 && <p className="search-no-result">Produk dengan kata “{searchQuery}” belum tersedia.</p>}
              </div>
              <div className="search-tip"><span>Tips pencarian</span><a href="#/bantuan" onClick={() => setShowSearchSuggestions(false)}>Pelajari →</a></div>
            </div>}
          </form>

          {/* Kanan: Actions */}
          <div className="navbar-actions">

            {/* Kirim Ke dengan Pop-Up */}
            <div
              className="deliver-to"
              ref={deliverRef}
              onKeyDown={(event) => { if (event.key === 'Escape') { setShowDeliverPopup(false); deliverRef.current?.querySelector('.delivery-trigger')?.focus(); } }}
              onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setShowDeliverPopup(false); }}
            >
              <button type="button" className="delivery-trigger" onClick={toggleDeliveryPopup} aria-expanded={showDeliverPopup} aria-controls={showDeliverPopup ? 'delivery-popup' : undefined} aria-label={'Kirim ke, ' + (accountLocation?.namaToko || (user ? 'lengkapi alamat akun' : 'masuk untuk memakai alamat akun'))}>
              <span className="deliver-label">
                Kirim ke
              </span>

              <div className="deliver-country">
                <span>🇮🇩</span>

                <span className="deliver-code" title={accountLocation?.namaToko || user?.name}>
                  {accountLocation?.namaToko || user?.name || "Masuk"}
                </span>
              </div>

              {accountLocation && <span className="deliver-address" title={accountLocation.namaJalan}>{accountLocation.namaJalan}</span>}
              </button>

              {/* Pop-up Kirim Ke */}
              {showDeliverPopup && (
                <>
                {compactDelivery && <button type="button" className="delivery-backdrop" tabIndex={-1} aria-label="Tutup pilihan alamat" onClick={() => { setShowDeliverPopup(false); deliverRef.current?.querySelector('.delivery-trigger')?.focus(); }} />}
                <div
                  className="deliver-popup"
                  id="delivery-popup"
                  role="dialog"
                  aria-modal={compactDelivery || undefined}
                  aria-labelledby="delivery-popup-title"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="deliver-popup-content">
                    <button type="button" className="delivery-close" aria-label="Tutup pilihan alamat" onClick={() => { setShowDeliverPopup(false); deliverRef.current?.querySelector('.delivery-trigger')?.focus(); }}>×</button>
                    <h3 className="deliver-popup-title" id="delivery-popup-title">
                      Alamat pengiriman
                    </h3>

                    <p className="deliver-popup-sub">{user ? 'Alamat pengiriman mengikuti data akun Anda.' : 'Masuk untuk melihat alamat pengiriman akun Anda.'}</p>
                    {user ? <>
                      {accountLocation ? <div className="delivery-account-preview"><span className="delivery-account-label">Alamat utama</span><strong>{accountLocation.namaToko}</strong><p>{accountLocation.namaJalan}</p><span className="delivery-account-country">🇮🇩 Indonesia</span></div> : <div className="delivery-account-empty"><strong>Alamat akun belum lengkap</strong><p>Lengkapi nama penerima dan alamat melalui halaman akun.</p></div>}
                      <a className="deliver-login-btn" href="#/akun" onClick={() => setShowDeliverPopup(false)}>{accountLocation ? 'Kelola alamat di akun' : 'Lengkapi alamat'}</a>
                    </> : <>
                      <a className="deliver-login-btn" href="#/login" onClick={() => setShowDeliverPopup(false)}>Masuk untuk memakai alamat akun</a>
                      <a className="delivery-register-link" href="#/daftar" onClick={() => setShowDeliverPopup(false)}>Belum punya akun? Daftar</a>
                    </>}

                  </div>
                </div>
                </>
              )}

            </div>

            <ShopActions onOpen={() => setShowDeliverPopup(false)} />


          </div>
        </div>
      </header>

      {/* Secondary Navbar */}
      <div className="secondary-navbar">
        <div className="secondary-navbar-container">

          <div className="secondary-nav-left">

            <CatalogMenu />
          </div>

          <div className="secondary-nav-right">
            <a className="navbar-orders-link" href="#/pesanan">Pesanan saya</a>

            <a className="navbar-about-link" href="#/tentang">Tentang BAM</a>

          </div>

        </div>
      </div>
    </>
  );
};

export default Navbar;
