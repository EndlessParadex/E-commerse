import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Navbar from './components/layout/Navbar';
import Home from './pages/Home';
import { parseCatalogRoute } from './data/catalog';
import { catalogNavigationKey, shouldResetRouteScroll } from './data/catalogNavigation';
import ShopProvider from './state/ShopProvider';
import ShopPage from './components/shop/ShopPage';
import AuthPage from './components/account/AuthPage';
import DeliveryProvider from './state/DeliveryProvider';
import ProductDetailPage from './components/shop/ProductDetailPage';
import FavoritesPage from './pages/FavoritesPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderConfirmationPage from './pages/OrderConfirmationPage';
import AccountPage from './pages/AccountPage';
import OrdersPage from './pages/OrdersPage';
import AdminPage from './pages/AdminPage';
import { subscribeCatalog, catalogRevision, initializeCatalog } from './data/adminStore';
import AdminAccess from './components/account/AdminAccess';

const subscribe = (callback) => {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
};
const getRoute = () => window.location.hash.slice(1) || '/';

function App() {
  const [catalogState, setCatalogState] = useState('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    initializeCatalog().then(() => { if (active) setCatalogState('ready'); }).catch(() => { if (active) setCatalogState('error'); });
    return () => { active = false; };
  }, [loadAttempt]);
  useSyncExternalStore(subscribeCatalog, catalogRevision, () => 0);
  const route = useSyncExternalStore(subscribe, getRoute, () => '/');
  const contentRef = useRef(null);
  const previousRoute = useRef(route);
  const adminView = { '/admin': 'overview', '/admin/produk': 'products', '/admin/pemasok': 'suppliers', '/admin/merek': 'brands', '/admin/kategori': 'categories' }[route];
  const isAdmin = Boolean(adminView);
  const productMatch = route.match(/^\/produk\/([^/?#]+)/);
  const orderMatch = route.match(/^\/pesanan\/([^/?#]+)/);
  const catalog = parseCatalogRoute(route);
  const title = isAdmin ? ({ overview: 'Admin · Ringkasan', products: 'Admin · Daftar Produk', suppliers: 'Admin · PT Pemasok', brands: 'Admin · Merek', categories: 'Admin · Kategori' }[adminView]) : productMatch ? 'Detail Produk' : orderMatch ? 'Pesanan Berhasil' : catalog ? 'Katalog' : { '/': 'Beranda', '/pesanan': 'Pesanan Saya', '/keranjang': 'Keranjang', '/checkout': 'Checkout', '/notifikasi': 'Notifikasi', '/favorit': 'Favorit Saya', '/akun': 'Akun Saya', '/login': 'Masuk', '/daftar': 'Daftar' }[route] || 'Halaman tidak ditemukan';

  useEffect(() => {
    document.title = `${title} | BAM.`;
    if (previousRoute.current !== route) {
      if (shouldResetRouteScroll(previousRoute.current, route)) {
        window.scrollTo(0, 0);
        contentRef.current?.focus({ preventScroll: true });
      }
      previousRoute.current = route;
    }
  }, [route, title]);

  if (catalogState !== 'ready') return <main className="shop-page" role="status"><h1>{catalogState === 'loading' ? 'Memuat katalog…' : 'Katalog belum dapat dimuat'}</h1>{catalogState === 'error' && <><p>Periksa koneksi dan pastikan server BAM sudah berjalan.</p><button className="shop-primary" onClick={() => { setCatalogState('loading'); setLoadAttempt((value) => value + 1); }}>Coba lagi</button></>}</main>;
  return <ShopProvider><DeliveryProvider>
    {!isAdmin && <Navbar />}
    <main ref={contentRef} tabIndex={-1} className="page-main">
      {isAdmin ? <AdminAccess><AdminPage view={adminView} /></AdminAccess> : route === '/pesanan' ? <OrdersPage /> : route === '/keranjang' ? <ShopPage type="cart" /> : route === '/checkout' ? <CheckoutPage /> : route === '/notifikasi' ? <ShopPage type="notifications" /> : route === '/favorit' ? <FavoritesPage /> : route === '/akun' ? <AccountPage /> : route === '/login' ? <AuthPage key="login" mode="login" /> : route === '/daftar' ? <AuthPage key="register" mode="register" /> : orderMatch ? <OrderConfirmationPage orderId={orderMatch[1]} key={orderMatch[1]} /> : productMatch ? <ProductDetailPage productId={productMatch[1]} key={productMatch[1]} /> : catalog && catalog.kind !== 'invalid' ? <Home key={catalogNavigationKey(route)} catalog={catalog} /> : route === '/' ? <Home /> : <div className="shop-page"><h1>Halaman tidak ditemukan</h1><a href="#/">Kembali ke beranda</a></div>}
    </main>
  </DeliveryProvider></ShopProvider>;
}

export default App;
