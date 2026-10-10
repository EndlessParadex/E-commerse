import { useCallback, useId, useRef, useState } from 'react';
import { creatorProfile } from '../../data/creatorProfile';
import { goToHome } from '../../state/shopNavigation';
import CreatorProfileDialog from './CreatorProfileDialog';
import './StoreFooter.css';
const copyrightYear = new Date().getFullYear();

export default function StoreFooter() {
  const [profileOpen, setProfileOpen] = useState(false);
  const creditRef = useRef(null);
  const profileId = useId();
  const closeProfile = useCallback(() => setProfileOpen(false), []);
  const openHome = (event) => {
    if (event.defaultPrevented || event.button > 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    goToHome();
  };

  return <><footer className="store-footer">
    <div className="store-footer-inner">
      <div className="store-footer-identity"><a className="store-footer-brand" href="#/" onClick={openHome} aria-label="BAM, kembali ke atas beranda">BAM<span>.</span></a><p className="store-footer-company">CV. Belitung Arta Mandiri</p><p>Katalog produk dari berbagai pemasok, dengan pilihan ukuran dan harga yang jelas.</p></div>
      <nav aria-label="Informasi toko"><h2>Informasi BAM</h2><a href="#/tentang">Profil BAM</a><a href="#/privasi">Informasi privasi</a><a href="#/pengiriman">Pengiriman</a><a href="#/pembatalan">Pembatalan dan retur</a></nav>
      <nav aria-label="Bantuan belanja"><h2>Belanja dengan mudah</h2><a href="#/bantuan">Pusat bantuan</a><a href="#/cari?q=">Seluruh katalog</a><a href="#/keranjang">Keranjang belanja</a><a href="#/pesanan">Pesanan saya</a></nav>
    </div>
    <div className="store-footer-bottom">
      <div className="store-footer-credit"><span>© {copyrightYear} BAM.</span><span className="store-footer-creator">Dikembangkan oleh <button ref={creditRef} type="button" aria-label={`Lihat profil ${creatorProfile.name}`} aria-haspopup="dialog" aria-controls={profileOpen ? profileId : undefined} aria-expanded={profileOpen} onClick={() => setProfileOpen(true)}>{creatorProfile.name}</button></span></div>
      <span className="store-footer-simulation">Pembelian dan pembayaran masih simulasi.</span>
    </div>
  </footer>
    {profileOpen && <CreatorProfileDialog id={profileId} onClose={closeProfile} returnFocusRef={creditRef} />}
  </>;
}
