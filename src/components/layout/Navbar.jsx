import React, { useState, useRef, useEffect } from 'react';
import './Navbar.css';
import ShopActions from '../shop/ShopActions';
import { useDelivery } from '../../state/useDelivery';
import { normalizeDelivery } from '../../state/deliveryModel';
import { availableBrands, filterCatalogProducts as filterProducts, searchHref } from '../../data/catalog';
import { suppliers, supplierHref } from '../../data/suppliers';

const Navbar = () => {
  // Mega Menu State
  const [activeMegaSupplier, setActiveMegaSupplier] = useState(suppliers[0]?.id || '');

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

  const selectedSupplier = suppliers.find((item) => item.id === activeMegaSupplier) || suppliers[0];
  const supplierBrands = availableBrands(selectedSupplier?.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    const close = (event) => { if (!menuRef.current?.contains(event.target)) setMenuOpen(false); };
    const routeClose = () => { setMenuOpen(false); setShowSearchSuggestions(false); setShowDeliverPopup(false); };
    document.addEventListener('pointerdown', close);
    window.addEventListener('hashchange', routeClose);
    return () => { document.removeEventListener('pointerdown', close); window.removeEventListener('hashchange', routeClose); };
  }, []);

  return (
    <>
      <header className="navbar">
        <div className="navbar-container">

          {/* Kiri: Logo */}
          <div className="navbar-left">
            <a className="navbar-logo" href="#/" aria-label="BAM. Beranda">
              <h1 id="logo-text">
                BAM<span className="logo-accent">.</span>
              </h1>
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
                  <span className="suggestion-product"><span>{highlightQuery(product.name)}</span><small>{product.category} · {formatPrice(product.price)}</small></span>
                </button>)}
                {matchingProducts.length === 0 && <p className="search-no-result">Produk dengan kata “{searchQuery}” belum tersedia.</p>}
              </div>
              <div className="search-tip"><span className="search-tip-icon" aria-hidden="true"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6" /><path d="M10 22h4" /><path d="M8.5 14.5A6 6 0 1 1 15.6 14c-.9.7-1.4 1.4-1.6 2H10c-.2-.7-.7-1.2-1.5-1.5Z" /><path d="M12 2v1" /><path d="m4.9 4.9.7.7" /><path d="m19.1 4.9-.7.7" /></svg></span><span>Tips &amp; Trik Pencarian</span><button type="button" onClick={() => setShowSearchSuggestions(false)}>Pelajari</button></div>
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

            <div className="bam-category-menu" ref={menuRef} onPointerEnter={(event) => { if (event.pointerType === 'mouse') setMenuOpen(true); }} onPointerLeave={(event) => { if (event.pointerType === 'mouse') setMenuOpen(false); }}
              onKeyDown={(event) => { if (event.key === 'Escape') { setMenuOpen(false); menuRef.current?.querySelector('button')?.focus(); } }}
              onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false); }}>
              <button type="button" className="bam-category-trigger" aria-expanded={menuOpen} aria-controls="bam-category-panel" onClick={() => setMenuOpen((value) => !value)}>☰ Semua Kategori</button>
              {menuOpen && <div className="bam-category-panel" id="bam-category-panel">
                <div className="bam-category-sidebar" aria-label="Pilih PT pemasok">
                  <p className="bam-menu-supplier-label">PT pemasok · Data contoh</p>
                  {suppliers.map((item) => <button type="button" key={item.id} aria-pressed={selectedSupplier?.id === item.id} onMouseEnter={() => setActiveMegaSupplier(item.id)} onFocus={() => setActiveMegaSupplier(item.id)} onClick={() => setActiveMegaSupplier(item.id)}><span className="bam-menu-supplier-initials" aria-hidden="true">{item.initials}</span><span className="bam-menu-supplier-name">{item.name}</span><span aria-hidden="true">›</span></button>)}
                  <a className="bam-menu-all-suppliers" href={searchHref('')} onClick={() => setMenuOpen(false)}>Semua pemasok dan produk →</a>
                </div>
                {selectedSupplier && <div className="bam-category-content">
                  <header><div><small>KATALOG PEMASOK · CONTOH</small><h2>{selectedSupplier.name}</h2></div><a href={supplierHref(selectedSupplier.id)} onClick={() => setMenuOpen(false)}>Semua produk PT ini →</a></header>
                  <div className="bam-subcategory-grid">{supplierBrands.map((brand) => <div className="bam-menu-supplier-category" key={brand.id}><a href={supplierHref(selectedSupplier.id, { brandId: brand.id })} onClick={() => setMenuOpen(false)}><strong>{brand.name}</strong><span>{filterProducts({ supplierId: selectedSupplier.id, brandId: brand.id }).length} pilihan produk <b aria-hidden="true">↗</b></span></a></div>)}</div>
                  {!supplierBrands.length && <p>Belum ada produk untuk pemasok ini.</p>}
                </div>}
              </div>}
            </div>
          </div>

          <div className="secondary-nav-right">
            <a className="navbar-orders-link" href="#/pesanan">Pesanan saya</a>

            <div className="dropdown-container">

              <span className="dropdown-trigger">
                Tentang Kami
              </span>

              <div className="dropdown-popup regular-popup">
                <ul>
                  <li>Profil BAM.</li>
                  <li>Kebijakan Privasi</li>
                  <li>Pusat Resolusi</li>
                </ul>
              </div>

            </div>

          </div>

        </div>
      </div>
    </>
  );
};

export default Navbar;
