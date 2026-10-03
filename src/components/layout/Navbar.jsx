import React, { useState, useRef, useEffect } from 'react';
import './Navbar.css';

const Navbar = () => {
  // Mega Menu State
  const [activeMegaCategory, setActiveMegaCategory] = useState("Categories for you");

  // Deliver To State
  const [showDeliverPopup, setShowDeliverPopup] = useState(false);
  const [namaToko, setNamaToko] = useState("");
  const [namaJalan, setNamaJalan] = useState("");
  const [savedLocation, setSavedLocation] = useState(null);
  const deliverRef = useRef(null);

  // Tutup popup jika klik di luar
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (deliverRef.current && !deliverRef.current.contains(e.target)) {
        setShowDeliverPopup(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveLocation = () => {
    if (namaToko.trim() || namaJalan.trim()) {
      setSavedLocation({ namaToko, namaJalan });
    }

    setShowDeliverPopup(false);
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

  return (
    <>
      <header className="navbar">
        <div className="navbar-container">

          {/* Kiri: Logo */}
          <div className="navbar-left">
            <div className="navbar-logo">
              <img
                src="/logo-placeholder.png"
                alt="Logo"
                className="logo-image"
                onError={(e) => {
                  e.target.style.display = 'none';
                  document.getElementById('logo-text').style.display = 'block';
                }}
              />

              <h1
                id="logo-text"
                style={{ display: 'none' }}
              >
                BAM<span className="logo-accent">.</span>
              </h1>
            </div>
          </div>

          {/* Tengah: Search */}
          <div className="navbar-search">
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
              placeholder="Cari kosmetik, snack, atau bumbu..."
            />

            <button className="search-button">
              Cari
            </button>
          </div>

          {/* Kanan: Actions */}
          <div className="navbar-actions">

            {/* Kirim Ke dengan Pop-Up */}
            <div
              className="deliver-to"
              ref={deliverRef}
              onClick={() => setShowDeliverPopup(!showDeliverPopup)}
            >
              <span className="deliver-label">
                Kirim ke
              </span>

              <div className="deliver-country">
                <span>🇮🇩</span>

                <span className="deliver-code">
                  {savedLocation?.namaToko || "ID"}
                </span>
              </div>

              {/* Pop-up Kirim Ke */}
              {showDeliverPopup && (
                <div
                  className="deliver-popup"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="deliver-popup-title">
                    Tentukan lokasi Anda
                  </h3>

                  <p className="deliver-popup-sub">
                    Jasa pengiriman dan biaya kirim bervariasi sesuai lokasi Anda
                  </p>

                  {/* Tombol Masuk */}
                  <button className="deliver-login-btn">
                    Masuk untuk menambahkan alamat
                  </button>

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

                  {/* Input Nama Jalan */}
                  <div className="deliver-form">
                    <input
                      type="text"
                      placeholder="Nama Toko / Penerima"
                      value={namaToko}
                      onChange={(e) => setNamaToko(e.target.value)}
                    />
                  </div>

                  <div className="deliver-form">
                    <input
                      type="text"
                      placeholder="Nama Jalan / Alamat"
                      value={namaJalan}
                      onChange={(e) => setNamaJalan(e.target.value)}
                    />
                  </div>

                  <button
                    className="deliver-save-btn"
                    onClick={handleSaveLocation}
                  >
                    Simpan
                  </button>
                </div>
              )}

            </div>

            <div className="icon-group">

              <div className="action-icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="9" cy="21" r="1"></circle>
                  <circle cx="20" cy="21" r="1"></circle>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
              </div>

              <div className="action-icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
              </div>

            </div>

            <div className="divider"></div>

            <div className="user-profile">
              <div className="avatar">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>

              <span>Log In</span>
            </div>

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

                      <span className="browse-all">
                        Lihat Semua
                      </span>
                    </div>

                    <div className="mega-grid">
                      {currentMegaSub.map((cat, idx) => (
                        <div
                          className="mega-card"
                          key={idx}
                        >
                          <div className="mega-circle">
                            {cat.icon}
                          </div>

                          <span className="mega-name">
                            {cat.name}
                          </span>
                        </div>
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