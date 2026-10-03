import React from 'react';
import './Home.css';

const Home = () => {
  return (
    <div className="home-container">
      {/* Banner Promosi Utama (Sebagai ganti menu kategori yang sudah dipindah ke Navbar) */}
      <div className="main-banner">
        <div className="banner-content">
          <h1>Super September Sale!</h1>
          <p>Diskon hingga 50% untuk produk Kosmetik & Snack</p>
          <button className="btn-banner">Belanja Sekarang</button>
        </div>
      </div>
    </div>
  );
};

export default Home;
