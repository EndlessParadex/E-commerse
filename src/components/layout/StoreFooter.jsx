import './StoreFooter.css';
const copyrightYear = new Date().getFullYear();

export default function StoreFooter() {
  return <footer className="store-footer"><div className="store-footer-inner"><div><a className="store-footer-brand" href="#/">BAM<span>.</span></a><p>CV. Belitung Arta Mandiri</p><p>Katalog produk dari berbagai pemasok, dengan pilihan ukuran dan harga yang jelas.</p></div><nav aria-label="Informasi toko"><h2>Informasi BAM</h2><a href="#/tentang">Profil BAM</a><a href="#/privasi">Informasi privasi</a><a href="#/pengiriman">Pengiriman</a><a href="#/pembatalan">Pembatalan dan retur</a></nav><nav aria-label="Bantuan belanja"><h2>Belanja dengan mudah</h2><a href="#/bantuan">Pusat bantuan</a><a href="#/cari?q=">Seluruh katalog</a><a href="#/keranjang">Keranjang belanja</a><a href="#/pesanan">Pesanan saya</a></nav><div><h2>Layanan pelanggan</h2><p>Kontak resmi belum tersedia.</p><a href="#/bantuan">Lihat panduan belanja →</a></div></div><div className="store-footer-bottom"><span>© {copyrightYear} BAM.</span><span>Pembelian dan pembayaran masih simulasi.</span></div></footer>;
}
