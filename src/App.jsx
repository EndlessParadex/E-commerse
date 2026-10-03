import { useEffect, useRef, useSyncExternalStore } from 'react';
import Navbar from './components/layout/Navbar';
import Home from './pages/Home';
import ShopProvider from './state/ShopProvider';
import ShopPage from './components/shop/ShopPage';
import AuthPage from './components/account/AuthPage';
import DeliveryProvider from './state/DeliveryProvider';
import ProductDetailPage from './components/shop/ProductDetailPage';

const subscribe = (callback) => {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
};
const getRoute = () => window.location.hash.slice(1) || '/';

function App() {
  const route = useSyncExternalStore(subscribe, getRoute, () => '/');
  const contentRef = useRef(null);
  const previousRoute = useRef(route);
  const productMatch = route.match(/^\/produk\/([^/?#]+)/);
  const categoryMatch = route.match(/^\/kategori\/(.+)$/);
  const title = productMatch ? 'Detail Produk' : categoryMatch ? 'Kategori' : { '/': 'Beranda', '/keranjang': 'Keranjang', '/notifikasi': 'Notifikasi', '/login': 'Masuk', '/daftar': 'Daftar' }[route] || 'Halaman tidak ditemukan';

  useEffect(() => {
    document.title = `${title} | BAM.`;
    if (previousRoute.current !== route) {
      window.scrollTo(0, 0);
      contentRef.current?.focus({ preventScroll: true });
      previousRoute.current = route;
    }
  }, [route, title]);

  return <ShopProvider><DeliveryProvider>
    <Navbar />
    <main ref={contentRef} tabIndex={-1} className="page-main">
      {route === '/keranjang' ? <ShopPage type="cart" /> : route === '/notifikasi' ? <ShopPage type="notifications" /> : route === '/login' ? <AuthPage key="login" mode="login" /> : route === '/daftar' ? <AuthPage key="register" mode="register" /> : productMatch ? <ProductDetailPage productId={decodeURIComponent(productMatch[1])} /> : categoryMatch ? <Home key={categoryMatch[1]} initialCategory={decodeURIComponent(categoryMatch[1])} /> : route === '/' ? <Home /> : <div className="shop-page"><h1>Halaman tidak ditemukan</h1><a href="#/">Kembali ke beranda</a></div>}
    </main>
  </DeliveryProvider></ShopProvider>;
}

export default App;
