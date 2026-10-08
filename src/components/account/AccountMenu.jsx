import { useDelivery } from '../../state/useDelivery';
import './AccountMenu.css';

export default function AccountMenu({ onNavigate, profileActive = false }) {
  const { user, logout, loggingOut, logoutError } = useDelivery();
  const exit = async () => {
    if (await logout()) {
      onNavigate?.();
      window.location.hash = '/';
    }
  };

  return <>
    <nav className="account-menu" aria-label="Menu akun">
      <a href={user ? '#/akun' : '#/login'} aria-current={user && profileActive ? 'page' : undefined} onClick={onNavigate}><strong>Profil</strong><small>{user ? 'Nama dan alamat' : 'Masuk untuk mengelola profil'}</small></a>
      {user?.role === 'admin' && <a href="#/admin" onClick={onNavigate}><strong>Ruang admin</strong><small>Kelola katalog dan pemasok</small></a>}
      <a href="#/pesanan" onClick={onNavigate}><strong>Pesanan saya</strong><small>Riwayat simulasi di tab ini</small></a>
      <a href="#/favorit" onClick={onNavigate}><strong>Favorit</strong><small>Produk tersimpan di browser</small></a>
      {user && <button type="button" disabled={loggingOut} onClick={exit}><strong>{loggingOut ? 'Keluar…' : 'Keluar'}</strong><small>Akhiri sesi akun</small></button>}
    </nav>
    {logoutError && user && <p className="account-menu-error" role="alert">{logoutError}</p>}
  </>;
}
