import { useRef, useState } from 'react';
import CompanyBrand from './CompanyBrand';
import NavigationIcon from './NavigationIcon';

const daily = [
  { view: 'overview', href: '#/admin', label: 'Ringkasan' },
  { view: 'products', href: '#/admin/produk', label: 'Produk' },
  { view: 'orders', href: '#/admin/pesanan', label: 'Pesanan' },
  { view: 'stock', href: '#/admin/stok', label: 'Stok' },
];
const groups = [
  {
    name: 'Data katalog',
    items: [
      { view: 'suppliers', href: '#/admin/pemasok', label: 'PT pemasok' },
      { view: 'brands', href: '#/admin/merek', label: 'Merek' },
      { view: 'categories', href: '#/admin/kategori', label: 'Kategori' },
    ],
  },
  {
    name: 'Toko',
    items: [
      { view: 'company', href: '#/admin/perusahaan', label: 'Pengaturan perusahaan' },
      { view: 'store', href: '#/', label: 'Lihat toko' },
    ],
  },
];

export default function AdminNavigation({ view, profile, onNavigate }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef(null);
  const leave = () => {
    setOpen(false);
    onNavigate();
  };
  const link = (item) => (
    <a
      key={item.view}
      className={item.view === 'store' ? 'admin-store-link' : undefined}
      href={item.href}
      aria-current={view === item.view ? 'page' : undefined}
      onClick={leave}
    >
      <NavigationIcon name={item.view} />
      <span>{item.label}</span>
    </a>
  );
  const current =
    [...daily, ...groups.flatMap((group) => group.items)].find((item) => item.view === view)
      ?.label || 'Ringkasan';
  return (
    <aside
      className={'admin-sidebar' + (open ? ' is-expanded' : '')}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <a
        className="admin-logo"
        href="#/admin"
        aria-label={`Dashboard admin ${profile.shortName}`}
        onClick={leave}
      >
        <CompanyBrand />
        <small>Ruang admin</small>
      </a>
      <button
        ref={toggle}
        className="admin-menu-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="admin-secondary-navigation"
        onClick={() => setOpen((value) => !value)}
      >
        <span>{open ? 'Tutup menu' : 'Menu lainnya'}</span>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      <nav id="admin-navigation" className="admin-navigation" aria-label="Navigasi admin">
        <div className="admin-nav-group admin-nav-daily">
          <p className="admin-nav-group-title">Menu utama</p>
          <div className="admin-nav-links">{daily.map(link)}</div>
        </div>
        <div
          id="admin-secondary-navigation"
          className={'admin-nav-secondary' + (open ? ' is-open' : '')}
        >
          {groups.map((group) => (
            <div className="admin-nav-group" key={group.name}>
              <p className="admin-nav-group-title">{group.name}</p>
              <div className="admin-nav-links">{group.items.map(link)}</div>
            </div>
          ))}
        </div>
      </nav>
      <p className="admin-mobile-current">
        Halaman: <strong>{current}</strong>
      </p>
      <p className="admin-sidebar-caption">{profile.legalName}</p>
    </aside>
  );
}
