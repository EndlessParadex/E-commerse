import { workflowUsesServer } from '../../data/adminStore';
import AccountCenterIcon from './AccountCenterIcon';
import { useDelivery } from '../../state/useDelivery';
import './AccountMenu.css';
import { canLeaveRoute, approveNextRoute } from '../../state/routeGuards';

export default function AccountMenu({ onNavigate, profileActive = false, hideProfile = false }) {
  const { user, logout, loggingOut, logoutError } = useDelivery();
  const exit = async () => {
    if (!canLeaveRoute('/')) return;
    if (await logout()) {
      approveNextRoute('/');
      onNavigate?.();
      window.location.hash = '/';
    }
  };

  return (
    <>
      <nav className="account-menu" aria-label="Menu akun">
        {!hideProfile && (
          <a
            href={user ? '#/akun' : '#/login'}
            aria-current={user && profileActive ? 'page' : undefined}
            onClick={onNavigate}
          >
            <AccountCenterIcon name="user" />
            <span><strong>Profil</strong>
              <small>{user ? 'Nama dan alamat' : 'Masuk untuk mengelola profil'}</small></span>
          </a>
        )}
        {user?.role === 'admin' && (
          <a href="#/admin" onClick={onNavigate}>
            <AccountCenterIcon name="admin" />
            <span><strong>Ruang admin</strong>
              <small>Kelola katalog dan pemasok</small></span>
          </a>
        )}
        {user?.canViewCustomers && (
          <a href="#/pelanggan" onClick={onNavigate}>
            <AccountCenterIcon name="user" />
            <span><strong>Daftar pembeli</strong>
              <small>Lihat akun dan status pendaftaran</small></span>
          </a>
        )}
        <a href="#/pesanan" onClick={onNavigate}>
          <AccountCenterIcon name="orders" />
          <span><strong>Pesanan saya</strong>
            <small>{workflowUsesServer ? 'Riwayat pesanan akun Anda' : 'Riwayat simulasi di tab ini'}</small></span>
        </a>
        <a href="#/favorit" onClick={onNavigate}>
          <AccountCenterIcon name="favorite" />
          <span><strong>Favorit</strong><small>Produk tersimpan di browser</small></span>
        </a>
        {user && (
          <button type="button" disabled={loggingOut} onClick={exit}>
            <AccountCenterIcon name="logout" />
            <span><strong>{loggingOut ? 'Keluar…' : 'Keluar'}</strong>
              <small>Akhiri sesi akun</small></span>
          </button>
        )}
      </nav>
      {logoutError && user && (
        <p className="account-menu-error" role="alert">
          {logoutError}
        </p>
      )}
    </>
  );
}
