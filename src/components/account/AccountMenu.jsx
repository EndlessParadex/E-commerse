import { workflowUsesServer } from '../../data/adminStore';
import AccountCenterIcon from './AccountCenterIcon';
import { useDelivery } from '../../state/useDelivery';
import './AccountMenu.css';
import { canLeaveRoute, approveNextRoute } from '../../state/routeGuards';

function AccountMenuEntry({ icon, title, description, kind, children }) {
  return (
    <>
      <span className={'account-menu-icon is-' + kind}>
        <AccountCenterIcon name={icon} size={21} />
      </span>
      <span className="account-menu-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <AccountCenterIcon name="chevron" size={18} className="account-menu-chevron" />
      {children}
    </>
  );
}

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
          <a className="account-menu-link" href={user ? '#/akun' : '#/login'}
            aria-current={user && profileActive ? 'page' : undefined}
            onClick={onNavigate}>
            <AccountMenuEntry icon="user" kind="profile" title="Profil"
              description={user ? 'Nama dan alamat' : 'Masuk untuk mengelola profil'} />
          </a>
        )}
        {user?.role === 'admin' && (
          <a className="account-menu-link" href="#/admin" onClick={onNavigate}>
            <AccountMenuEntry icon="admin" kind="admin" title="Ruang admin"
              description="Kelola katalog dan pemasok" />
          </a>
        )}
        {user?.canViewCustomers && (
          <a className="account-menu-link" href="#/pelanggan" onClick={onNavigate}>
            <AccountMenuEntry icon="users" kind="customers" title="Daftar pembeli"
              description="Lihat akun dan status pendaftaran" />
          </a>
        )}
        <a className="account-menu-link" href="#/pesanan" onClick={onNavigate}>
          <AccountMenuEntry icon="orders" kind="orders" title="Pesanan saya"
            description={workflowUsesServer ? 'Riwayat pesanan akun Anda' : 'Riwayat simulasi di tab ini'} />
        </a>
        <a className="account-menu-link" href="#/favorit" onClick={onNavigate}>
          <AccountMenuEntry icon="favorite" kind="favorite" title="Favorit"
            description="Produk tersimpan di browser" />
        </a>
        {user && (
          <button className="account-menu-link account-menu-logout" type="button"
            disabled={loggingOut} onClick={exit}>
            <AccountMenuEntry icon="logout" kind="logout"
              title={loggingOut ? 'Keluar…' : 'Keluar'} description="Akhiri sesi akun" />
          </button>
        )}
      </nav>
      {logoutError && user && (
        <p className="account-menu-error" role="alert">{logoutError}</p>
      )}
    </>
  );
}
