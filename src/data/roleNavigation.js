/**
 * Navigation destinations are presentation only. Authorisation remains enforced by
 * the existing server, account and shared-cart route guards.
 * Only assign Sales/Buyer after the server confirms shared-cart membership.
 */
const home = { label: 'Beranda', href: '#/', icon: 'home', desktop: true };
const catalog = { label: 'Katalog', href: '#/cari?q=', icon: 'products', desktop: true };
const orders = { label: 'Pesanan', href: '#/pesanan', icon: 'orders', desktop: true };
const account = { label: 'Akun', href: '#/akun', icon: 'account', desktop: false };
const personalCart = { label: 'Keranjang', href: '#/keranjang', icon: 'cart', desktop: true };
const storeCart = {
  label: 'Keranjang', href: '#/keranjang', icon: 'cart', desktop: true, cartMode: 'store',
};
const quickOrder = {
  label: 'Order Cepat', href: '#/order-cepat', icon: 'bolt', desktop: true, cartMode: 'store',
};
const schedule = {
  label: 'Jadwal', href: '#/akun/kalender', icon: 'calendar', desktop: true,
};

export function roleNavigation(role) {
  switch (role) {
    case 'sales':
      return [home, quickOrder, storeCart, orders, account];
    case 'buyer':
      return [home, catalog, storeCart, schedule, account, { ...orders, mobile: false }];
    case 'admin':
      return [
        { label: 'Dashboard', href: '#/admin', icon: 'overview', desktop: true },
        catalog, orders, account,
      ];
    case 'personal':
      return [home, catalog, personalCart, orders, account];
    default:
      return [home, catalog, personalCart, { ...account, href: '#/login' }];
  }
}

export function roleNavigationActive(link, route) {
  const path = (route || '/').split('?')[0];
  if (link.href === '#/') return path === '/';
  if (link.href === '#/cari?q=')
    return ['/cari', '/kategori', '/produk', '/pemasok'].some(
      (prefix) => path === prefix || path.startsWith(prefix + '/'),
    );
  if (link.href === '#/akun/kalender') return path === '/akun/kalender';
  if (link.href === '#/akun') return path === '/akun' || (path.startsWith('/akun/') && path !== '/akun/kalender');
  if (link.href === '#/login')
    return path === '/login' || path === '/daftar' || path === '/akun' || path.startsWith('/akun/');
  if (link.href === '#/pesanan')
    return path === '/pesanan' || path.startsWith('/pesanan/');
  if (link.href === '#/keranjang')
    return path === '/keranjang' || path === '/checkout';
  if (link.href === '#/order-cepat') return path === '/order-cepat';
  if (link.href === '#/admin') return path === '/admin' || path.startsWith('/admin/');
  return path === link.href.slice(1);
}
