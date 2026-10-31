import useCompany from '../../state/useCompany';
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import './Navbar.css';
import ShopActions from '../shop/ShopActions';
import { useDelivery } from '../../state/useDelivery';
import { useShop } from '../../state/useShop';
import { normalizeDelivery } from '../../state/deliveryModel';
import { filterCatalogProducts as filterProducts, searchHref } from '../../data/catalog';
import CompanyBrand from './CompanyBrand';
import CatalogMenu from './CatalogMenu';
import NavigationIcon from './NavigationIcon';
import { productVariants } from '../../data/products';
import { roleNavigation, roleNavigationActive } from '../../data/roleNavigation';

const Navbar = () => {
  const { profile: companyProfile } = useCompany();
  const navigationRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let frame = null;
    const update = () => {
      frame = null;
      setScrolled(
        window.scrollY > 0 && window.getComputedStyle(navigationRef.current).position === 'sticky',
      );
    };
    const schedule = () => {
      if (frame === null) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);
  useLayoutEffect(() => {
    const navigation = navigationRef.current;
    const page = document.documentElement;
    const property = '--store-navigation-height';
    const previous = page.style.getPropertyValue(property);
    const priority = page.style.getPropertyPriority(property);
    const updateHeight = () =>
      page.style.setProperty(property, `${Math.ceil(navigation.getBoundingClientRect().height)}px`);
    updateHeight();
    const observer = window.ResizeObserver ? new window.ResizeObserver(updateHeight) : null;
    observer?.observe(navigation);
    window.addEventListener('resize', updateHeight);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateHeight);
      if (previous) page.style.setProperty(property, previous, priority);
      else page.style.removeProperty(property);
    };
  }, []);
  // Deliver To State
  const [showDeliverPopup, setShowDeliverPopup] = useState(false);
  const { user } = useDelivery();
  const { shared, cartMode, setCartMode } = useShop();
  const [mobileRoute, setMobileRoute] = useState(
    () => window.location.hash.slice(1).split('?')[0] || '/',
  );
  useEffect(() => {
    const updateRoute = () => setMobileRoute(window.location.hash.slice(1).split('?')[0] || '/');
    window.addEventListener('hashchange', updateRoute);
    return () => window.removeEventListener('hashchange', updateRoute);
  }, []);
  const isAccountRoute = mobileRoute === '/akun' || mobileRoute.startsWith('/akun/');
  const isAccountDetailRoute = mobileRoute.startsWith('/akun/');
  const b2bCart = shared?.status === 'ready' && ['sales', 'buyer', 'owner'].includes(shared.role);
  const activeB2BStore = shared?.cart?.store?.storeName || 'Pilih toko';
  const activeB2BDate = shared?.cart?.date || '';
  const b2bPackages = shared?.cart?.items?.reduce((total, item) => total + item.quantity, 0) || 0;
  const navRole = b2bCart
    ? shared.role === 'owner' ? 'buyer' : shared.role
    : user?.role === 'admin'
      ? 'admin'
      : user
        ? 'personal'
        : 'guest';
  const navigationLinks = roleNavigation(navRole);
  const bottomLinks = navigationLinks
    .filter((link) => link.mobile !== false)
    .map((link) => ({
      ...link,
      active: roleNavigationActive(link, mobileRoute),
    }));
  const goToRoleDestination = (link) => {
    if (b2bCart && link.href === '#/order-cepat') setCartMode?.('store');
    setShowDeliverPopup(false);
    setShowSearchSuggestions(false);
  };
  const accountLocation = user
    ? normalizeDelivery({ namaToko: user.name, namaJalan: user.address })
    : null;
  const deliveryTitle = user ? user.storeName || 'Alamat saya' : 'Masuk';
  const deliverRef = useRef(null);
  const [compactDelivery, setCompactDelivery] = useState(
    () => window.matchMedia('(max-width: 600px)').matches,
  );
  const searchRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const matchingProducts = filterProducts({ query: searchQuery }).slice(0, 8);
  const formatPrice = (value) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(value);
  const highlightQuery = (name) => {
    const query = searchQuery.trim();
    if (!query) return name;
    const parts = name.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <strong key={`${part}-${index}`}>{part}</strong>
      ) : (
        part
      ),
    );
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
      const elements = Array.from(
        popup?.querySelectorAll('a[href], button:not(:disabled), input, textarea') || [],
      );
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    popup?.addEventListener('keydown', trapFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      popup?.removeEventListener('keydown', trapFocus);
    };
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
      if (searchRef.current && !searchRef.current.contains(e.target))
        setShowSearchSuggestions(false);
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
    const routeClose = () => {
      setShowSearchSuggestions(false);
      setShowDeliverPopup(false);
    };
    window.addEventListener('hashchange', routeClose);
    return () => {
      window.removeEventListener('hashchange', routeClose);
    };
  }, []);

  return (
    <div
      className={
        'store-navigation' +
        (scrolled ? ' is-scrolled' : '') +
        (isAccountRoute ? ' is-account-route' : '') +
        (isAccountDetailRoute ? ' is-account-detail-route' : '') +
        (b2bCart ? ' is-b2b-context' : '')
      }
      ref={navigationRef}
    >
      <header className="navbar">
        <div className="navbar-container">
          {/* Kiri: Logo */}
          <div className="navbar-left">
            <a
              className="navbar-logo"
              href="#/"
              aria-label={`${companyProfile.shortName}. Beranda`}
            >
              <span id="logo-text">
                <CompanyBrand />
              </span>
              <span className="navbar-brand-subtitle">Grosir &amp; Kebutuhan Toko</span>
            </a>
          </div>

          {b2bCart && (
            <a
              className="b2b-active-store"
              href="#/keranjang"
              onClick={() => setCartMode('store')}
              title="Buka keranjang untuk mengganti toko dan periode"
            >
              <span className="b2b-active-store-icon" aria-hidden="true">
                ▣
              </span>
              <span className="b2b-active-store-copy">
                <strong>{activeB2BStore}</strong>
                <small>
                  {activeB2BDate ? 'Kirim: ' + activeB2BDate : 'Pilih toko dan periode'}
                </small>
              </span>
              <span aria-hidden="true">⌄</span>
            </a>
          )}

          {/* Tengah: Search */}
          <form
            className={`navbar-search${showSearchSuggestions ? ' is-active' : ''}`}
            ref={searchRef}
            onSubmit={(event) => {
              event.preventDefault();
              setShowSearchSuggestions(false);
              const storeSearch = b2bCart && cartMode !== 'personal';
              if (storeSearch) setCartMode?.('store');
              window.location.hash = storeSearch
                ? '/order-cepat?q=' + encodeURIComponent(searchQuery)
                : searchHref(searchQuery);
            }}
          >
            <div className="search-icon-left">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onFocus={() => setShowSearchSuggestions(true)}
              placeholder={
                b2bCart ? 'Cari produk atau SKU...' : `Cari di ${companyProfile.shortName}.`
              }
              aria-label="Cari produk"
              onKeyDown={(event) => {
                if (event.key === 'Escape') setShowSearchSuggestions(false);
              }}
            />

            {showSearchSuggestions && (
              <div className="search-suggestions" aria-label="Saran pencarian">
                <div className="search-suggestion-list">
                  {matchingProducts.map((product) => (
                    <button
                      type="button"
                      className="search-suggestion"
                      key={product.id}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setSearchQuery(product.name);
                        setShowSearchSuggestions(false);
                        window.location.hash = `/produk/${product.id}`;
                      }}
                    >
                      <svg
                        className="suggestion-search-icon"
                        aria-hidden="true"
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-4-4" />
                      </svg>
                      <span className="suggestion-product">
                        <span>{highlightQuery(product.baseName || product.name)}</span>
                        <small>
                          {product.category} · Mulai{' '}
                          {formatPrice(
                            Math.min(...productVariants(product.id).map((item) => item.price)),
                          )}
                        </small>
                      </span>
                    </button>
                  ))}
                  {matchingProducts.length === 0 && (
                    <p className="search-no-result">
                      Produk dengan kata “{searchQuery}” belum tersedia.
                    </p>
                  )}
                </div>
                <div className="search-tip">
                  <span>Tips pencarian</span>
                  <a href="#/bantuan" onClick={() => setShowSearchSuggestions(false)}>
                    Pelajari →
                  </a>
                </div>
              </div>
            )}
          </form>

          {/* Kanan: Actions */}
          <div className="navbar-actions">
            {b2bCart && (
              <>
                <a
                  className="b2b-header-search"
                  href="#/order-cepat"
                  aria-label="Cari barang di Order Cepat"
                >
                  <svg
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-4-4" />
                  </svg>
                </a>
                <a
                  className="b2b-header-cart"
                  href="#/keranjang"
                  onClick={() => setCartMode?.('store')}
                  aria-label={`Keranjang toko, ${b2bPackages} kemasan`}
                >
                  <NavigationIcon name="cart" />
                  <span>{b2bPackages} kemasan</span>
                </a>
              </>
            )}
            {/* Kirim Ke dengan Pop-Up */}
            <div
              className="deliver-to"
              ref={deliverRef}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setShowDeliverPopup(false);
                  deliverRef.current?.querySelector('.delivery-trigger')?.focus();
                }
              }}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setShowDeliverPopup(false);
              }}
            >
              <button
                type="button"
                className="delivery-trigger"
                onClick={toggleDeliveryPopup}
                aria-expanded={showDeliverPopup}
                aria-controls={showDeliverPopup ? 'delivery-popup' : undefined}
                aria-label={
                  'Kirim ke, ' + (user ? deliveryTitle : 'masuk untuk memakai alamat akun')
                }
              >
                <span className="deliver-label">Kirim ke</span>

                <div className="deliver-country">
                  <span>🇮🇩</span>

                  <span className="deliver-code" title={deliveryTitle}>
                    {deliveryTitle}
                  </span>
                </div>

                {accountLocation && (
                  <span className="deliver-address" title={accountLocation.namaJalan}>
                    {accountLocation.namaJalan}
                  </span>
                )}
              </button>

              {/* Pop-up Kirim Ke */}
              {showDeliverPopup && (
                <>
                  {compactDelivery && (
                    <button
                      type="button"
                      className="delivery-backdrop"
                      tabIndex={-1}
                      aria-label="Tutup pilihan alamat"
                      onClick={() => {
                        setShowDeliverPopup(false);
                        deliverRef.current?.querySelector('.delivery-trigger')?.focus();
                      }}
                    />
                  )}
                  <div
                    className="deliver-popup"
                    id="delivery-popup"
                    role="dialog"
                    aria-modal={compactDelivery || undefined}
                    aria-labelledby="delivery-popup-title"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="deliver-popup-content">
                      <button
                        type="button"
                        className="delivery-close"
                        aria-label="Tutup pilihan alamat"
                        onClick={() => {
                          setShowDeliverPopup(false);
                          deliverRef.current?.querySelector('.delivery-trigger')?.focus();
                        }}
                      >
                        ×
                      </button>
                      <h3 className="deliver-popup-title" id="delivery-popup-title">
                        Alamat pengiriman
                      </h3>

                      <p className="deliver-popup-sub">
                        {user
                          ? 'Alamat pengiriman mengikuti data akun Anda.'
                          : 'Masuk untuk melihat alamat pengiriman akun Anda.'}
                      </p>
                      {user ? (
                        <>
                          {accountLocation ? (
                            <div className="delivery-account-preview">
                              <span className="delivery-account-label">Alamat utama</span>
                              <strong>{deliveryTitle}</strong>
                              <span className="accounts-secondary">
                                Penerima: {accountLocation.namaToko}
                              </span>
                              <p>{accountLocation.namaJalan}</p>
                              <span className="delivery-account-country">🇮🇩 Indonesia</span>
                            </div>
                          ) : (
                            <div className="delivery-account-empty">
                              <strong>Alamat akun belum lengkap</strong>
                              <p>Lengkapi nama penerima dan alamat melalui halaman akun.</p>
                            </div>
                          )}
                          <a
                            className="deliver-login-btn"
                            href="#/akun"
                            onClick={() => setShowDeliverPopup(false)}
                          >
                            {accountLocation ? 'Kelola alamat di akun' : 'Lengkapi alamat'}
                          </a>
                        </>
                      ) : (
                        <>
                          <a
                            className="deliver-login-btn"
                            href="#/login"
                            onClick={() => setShowDeliverPopup(false)}
                          >
                            Masuk untuk memakai alamat akun
                          </a>
                          <a
                            className="delivery-register-link"
                            href="#/daftar"
                            onClick={() => setShowDeliverPopup(false)}
                          >
                            Belum punya akun? Daftar
                          </a>
                        </>
                      )}
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
      <nav className="secondary-navbar" aria-label="Navigasi belanja">
        <div className="secondary-navbar-container">
          <div className="secondary-nav-left">
            {!b2bCart && <CatalogMenu />}
            {navigationLinks
              .filter((link) => link.desktop)
              .map((link) => (
                <a
                  key={link.href}
                  className="navbar-role-link"
                  href={link.href}
                  aria-current={roleNavigationActive(link, mobileRoute) ? 'page' : undefined}
                  onClick={() => goToRoleDestination(link)}
                >
                  <NavigationIcon name={link.icon} />
                  <span>{link.label}</span>
                </a>
              ))}
          </div>
          <div className="secondary-nav-right">
            {!b2bCart && (
              <a className="navbar-about-link" href="#/tentang">
                Tentang {companyProfile.shortName}
              </a>
            )}
          </div>
        </div>
      </nav>
      <nav
        className="mobile-bottom-navigation"
        aria-label="Navigasi utama mobile"
        style={{ '--nav-items': bottomLinks.length }}
      >
        {bottomLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            aria-current={link.active ? 'page' : undefined}
            onClick={() => {
              goToRoleDestination(link);
            }}
          >
            <NavigationIcon name={link.icon} />
            <span>{link.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
};

export default Navbar;
