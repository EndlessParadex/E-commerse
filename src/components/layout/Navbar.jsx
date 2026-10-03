import React, { useState, useRef, useEffect } from 'react';
import './Navbar.css';
import ShopActions from '../shop/ShopActions';
import { useDelivery } from '../../state/useDelivery';
import { validateDelivery } from '../../state/deliveryModel';
import { products } from '../../data/products';

const Navbar = () => {
  // Mega Menu State
  const [activeMegaCategory, setActiveMegaCategory] = useState("Categories for you");

  // Deliver To State
  const [showDeliverPopup, setShowDeliverPopup] = useState(false);
  const [namaToko, setNamaToko] = useState("");
  const [namaJalan, setNamaJalan] = useState("");
  const { savedLocation, saveLocation, storageError } = useDelivery();
  const [addressErrors, setAddressErrors] = useState({});
  const deliverRef = useRef(null);
  const searchRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const matchingProducts = products.filter((product) => !searchQuery.trim() || `${product.name} ${product.category}`.toLowerCase().includes(searchQuery.trim().toLowerCase())).slice(0, 8);
  const formatPrice = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
  const highlightQuery = (name) => {
    const query = searchQuery.trim();
    if (!query) return name;
    const parts = name.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'));
    return parts.map((part, index) => part.toLowerCase() === query.toLowerCase() ? <strong key={`${part}-${index}`}>{part}</strong> : part);
  };

  // Tutup popup jika klik di luar
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (deliverRef.current && !deliverRef.current.contains(e.target)) {
        setShowDeliverPopup(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    const handleSearchOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearchSuggestions(false);
    };
    document.addEventListener('mousedown', handleSearchOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('mousedown', handleSearchOutside);
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
  }, [showDeliverPopup, savedLocation]);

  const toggleDeliveryPopup = () => {
    if (!showDeliverPopup) {
      setNamaToko(savedLocation?.namaToko || '');
      setNamaJalan(savedLocation?.namaJalan || '');
      setAddressErrors({});
    }
    setShowDeliverPopup((current) => !current);
  };

  const handleSaveLocation = () => {
    const nextErrors = validateDelivery({ namaToko, namaJalan });
    setAddressErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      deliverRef.current?.querySelector(nextErrors.namaToko ? '#delivery-name' : '#delivery-address')?.focus();
      return;
    }
    saveLocation({ namaToko, namaJalan }).then((result) => {
      if (result.persisted) setShowDeliverPopup(false);
    });
  };

  const categoryData = {
    "Categories for you": [
      { name: "Snack Pedas", icon: "🌶️" },
      { name: "Snack Manis", icon: "🍫" },
      { name: "Bumbu Instan", icon: "🍲" },
      { name: "Skincare Wajah", icon: "✨" },
      { name: "Lipstik Matte", icon: "💄" },
      { name: "Parfum Wanita", icon: "🌸" },
    ],

    "Snack & Makanan": [
      { name: "Keripik Kentang", icon: "🥔" },
      { name: "Cokelat Impor", icon: "🍫" },
      { name: "Biskuit", icon: "🍪" },
      { name: "Kue Kering", icon: "🥮" },
      { name: "Permen Manis", icon: "🍬" },
      { name: "Kacang Almond", icon: "🥜" },
    ],

    "Bumbu Masakan": [
      { name: "Garam & Merica", icon: "🧂" },
      { name: "Saus & Kecap", icon: "🍾" },
      { name: "Kaldu Jamur", icon: "🍲" },
      { name: "Rempah Bubuk", icon: "🌿" },
      { name: "Bumbu Rendang", icon: "🍛" },
    ],

    "Kosmetik & Beauty": [
      { name: "Lipstik", icon: "💄" },
      { name: "Skincare Set", icon: "✨" },
      { name: "Sabun Mandi", icon: "🧼" },
      { name: "Parfum Pria", icon: "👔" },
    ],

    "Perlengkapan Rumah": [
      { name: "Sapu & Pel", icon: "🧹" },
      { name: "Sabun Cuci", icon: "🧼" },
      { name: "Pewangi Ruangan", icon: "🕯️" },
    ],

    "Fashion & Pakaian": [
      { name: "Kaos Pria", icon: "👕" },
      { name: "Gaun Wanita", icon: "👗" },
      { name: "Sepatu Sneakers", icon: "👟" },
    ],

    "Elektronik & Gadget": [
      { name: "Smartphone", icon: "📱" },
      { name: "Laptop", icon: "💻" },
      { name: "Smartwatch", icon: "⌚" },
    ],

    "Kesehatan & Obat": [
      { name: "Vitamin C", icon: "💊" },
      { name: "Masker Medis", icon: "😷" },
    ],

    "Olahraga & Hobi": [
      { name: "Bola Sepak", icon: "⚽" },
      { name: "Raket Tenis", icon: "🎾" },
    ],

    "Otomotif": [
      { name: "Aksesoris Mobil", icon: "🚗" },
      { name: "Helm Motor", icon: "🛵" },
    ]
  };

  const sidebarMenus = [
    {
      id: "Categories for you",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
      )
    },

    {
      id: "Snack & Makanan",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
        </svg>
      )
    },

    {
      id: "Bumbu Masakan",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 8v4"></path>
          <path d="M12 16h.01"></path>
        </svg>
      )
    },

    {
      id: "Kosmetik & Beauty",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path>
          <line x1="16" y1="8" x2="2" y2="22"></line>
          <line x1="17.5" y1="15" x2="9" y2="6.5"></line>
        </svg>
      )
    },

    {
      id: "Perlengkapan Rumah",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      )
    },

    {
      id: "Fashion & Pakaian",
      icon: <span style={{ fontSize: '16px' }}>👕</span>
    },

    {
      id: "Elektronik & Gadget",
      icon: <span style={{ fontSize: '16px' }}>📱</span>
    },

    {
      id: "Kesehatan & Obat",
      icon: <span style={{ fontSize: '16px' }}>💊</span>
    },

    {
      id: "Olahraga & Hobi",
      icon: <span style={{ fontSize: '16px' }}>⚽</span>
    },

    {
      id: "Otomotif",
      icon: <span style={{ fontSize: '16px' }}>🚗</span>
    }
  ];

  const currentMegaSub = categoryData[activeMegaCategory] || [];
  const categoryHref = (category) => category === 'Categories for you' ? '#/' : `#/kategori/${encodeURIComponent(category)}`;

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
          <form className={`navbar-search${showSearchSuggestions ? ' is-active' : ''}`} ref={searchRef} onSubmit={(event) => { event.preventDefault(); setShowSearchSuggestions(false); }}>
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
            />

            {showSearchSuggestions && <div className="search-suggestions" role="listbox" aria-label="Saran pencarian">
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
              onClick={toggleDeliveryPopup}
            >
              <span className="deliver-label">
                Kirim ke
              </span>

              <div className="deliver-country">
                <span>🇮🇩</span>

                <span className="deliver-code" title={savedLocation?.namaToko}>
                  {savedLocation?.namaToko || "ID"}
                </span>
              </div>

              {savedLocation && <span className="deliver-address" title={savedLocation.namaJalan}>{savedLocation.namaJalan}</span>}

              {/* Pop-up Kirim Ke */}
              {showDeliverPopup && (
                <div
                  className="deliver-popup"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="deliver-popup-content">
                    <h3 className="deliver-popup-title">
                      Tentukan lokasi Anda
                    </h3>

                    <p className="deliver-popup-sub">
                      Jasa pengiriman dan biaya kirim bervariasi sesuai lokasi Anda
                    </p>

                    {/* Tombol Masuk */}
                    <a className="deliver-login-btn" href="#/login" onClick={() => setShowDeliverPopup(false)}>
                      Masuk untuk menambahkan alamat
                    </a>

                    {/* Pemisah */}
                    <div className="deliver-divider">
                      Atau
                    </div>

                    {/* Baris negara - fixed Indonesia */}
                    <div className="deliver-country-row">
                      <div className="deliver-country-left">
                        <span>🇮🇩</span>
                        <span>Indonesia</span>
                      </div>

                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#888"
                        strokeWidth="2"
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </div>

                    {storageError && <p className="delivery-warning" role="status">Alamat diperbarui sementara. Penyimpanan browser gagal; perubahan dapat hilang setelah refresh.</p>}

                    {/* Nama penerima dan alamat dari data pengiriman bersama. */}
                    <div className="deliver-form">
                      <label htmlFor="delivery-name">Nama penerima</label>
                      <input
                        id="delivery-name"
                        type="text"
                        autoComplete="shipping name"
                        maxLength={100}
                        aria-invalid={Boolean(addressErrors.namaToko)}
                        aria-describedby={addressErrors.namaToko ? 'delivery-name-error' : undefined}
                        placeholder="Nama Toko / Penerima"
                        value={namaToko}
                        onChange={(e) => { setNamaToko(e.target.value); setAddressErrors((current) => ({ ...current, namaToko: undefined })); }}
                      />
                      {addressErrors.namaToko && <p id="delivery-name-error" className="delivery-error">{addressErrors.namaToko}</p>}
                    </div>

                    <div className="deliver-form">
                      <label htmlFor="delivery-address">Alamat lengkap</label>
                      <textarea
                        id="delivery-address"
                        rows={3}
                        autoComplete="shipping street-address"
                        maxLength={500}
                        aria-invalid={Boolean(addressErrors.namaJalan)}
                        aria-describedby={addressErrors.namaJalan ? 'delivery-address-error' : undefined}
                        placeholder="Nama Jalan / Alamat"
                        value={namaJalan}
                        onChange={(e) => { setNamaJalan(e.target.value); setAddressErrors((current) => ({ ...current, namaJalan: undefined })); }}
                      />
                      {addressErrors.namaJalan && <p id="delivery-address-error" className="delivery-error">{addressErrors.namaJalan}</p>}
                    </div>

                    <button
                      className="deliver-save-btn"
                      onClick={handleSaveLocation}
                    >
                      Simpan
                    </button>
                  </div>
                </div>
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

            <div className="dropdown-container">

              <div className="dropdown-trigger">
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
                  <line
                    x1="3"
                    y1="12"
                    x2="21"
                    y2="12"
                  ></line>

                  <line
                    x1="3"
                    y1="6"
                    x2="21"
                    y2="6"
                  ></line>

                  <line
                    x1="3"
                    y1="18"
                    x2="21"
                    y2="18"
                  ></line>
                </svg>

                <span>Semua Kategori</span>
              </div>

              {/* MEGA MENU POPUP (Gaya Alibaba) */}
              <div className="dropdown-popup mega-menu-popup">

                <div className="mega-menu-container">

                  {/* Kiri: Sidebar Mega Menu */}
                  <div className="mega-menu-sidebar">
                    <ul>
                      {sidebarMenus.map((menu) => (
                        <li
                          key={menu.id}
                          className={
                            activeMegaCategory === menu.id
                              ? "active"
                              : ""
                          }
                          onMouseEnter={() =>
                            setActiveMegaCategory(menu.id)
                          }
                          onClick={() => { window.location.hash = categoryHref(menu.id); }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px'
                            }}
                          >
                            {menu.icon}
                            <span>{menu.id}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Kanan: Content Grid Mega Menu */}
                  <div className="mega-menu-content">

                    <div className="mega-content-header">
                      <h3>{activeMegaCategory}</h3>

                      <a className="browse-all" href={categoryHref(activeMegaCategory)}>
                        Lihat Semua
                      </a>
                    </div>

                    <div className="mega-grid">
                      {currentMegaSub.map((cat, idx) => (
                        <a
                          className="mega-card"
                          key={idx}
                          href={categoryHref(activeMegaCategory)}
                        >
                          <div className="mega-circle">
                            {cat.icon}
                          </div>

                          <span className="mega-name">
                            {cat.name}
                          </span>
                        </a>
                      ))}
                    </div>

                  </div>
                </div>
              </div>

            </div>
          </div>

          <div className="secondary-nav-right">

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
