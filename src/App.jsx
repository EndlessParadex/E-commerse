import { products } from './data/products';
import AppErrorBoundary from './components/AppErrorBoundary';
import { useEffect, useRef, useState, useSyncExternalStore, lazy, Suspense } from 'react';
import useCompany from './state/useCompany';
import Navbar from './components/layout/Navbar';
import Home from './pages/Home';
import { parseCatalogRoute } from './data/catalog';
import { catalogNavigationKey, isFastOrderRoute, shouldResetRouteScroll } from './data/catalogNavigation';
import ShopProvider from './state/ShopProvider';
import WorkflowProvider from './state/WorkflowProvider';
import ShopPage from './components/shop/ShopPage';
import { SharedCartBar } from './components/shop/SharedCartPage';
const AuthPage = lazy(() => import('./components/account/AuthPage'));
import DeliveryProvider from './state/DeliveryProvider';
import AppearanceProvider from './state/AppearanceProvider';
import ProductDetailPage from './components/shop/ProductDetailPage';
const FavoritesPage = lazy(() => import('./pages/FavoritesPage'));
const FastOrderPage = lazy(() => import('./pages/FastOrderPage'));
import CheckoutPage from './pages/CheckoutPage';
import OrderConfirmationPage from './pages/OrderConfirmationPage';
const AccountPage = lazy(() => import('./pages/AccountPage'));
import OrdersPage from './pages/OrdersPage';
const AdminPage = lazy(() => import('./pages/AdminPage'));
const CustomerDirectoryPage = lazy(() => import('./pages/CustomerDirectoryPage'));
const AccountRecoveryPage = lazy(() => import('./pages/AccountRecoveryPage'));
import { subscribeCatalog, catalogRevision, initializeCatalog } from './data/adminStore';
import AdminAccess from './components/account/AdminAccess';
import StoreFooter from './components/layout/StoreFooter';
import StoreInfoPage from './pages/StoreInfoPage';
import PaymentPage from './pages/PaymentPage';
import CatalogStatus from './components/shop/CatalogStatus';
import { subscribeShopRoute, shopRouteSnapshot } from './state/shopNavigation';
import './styles/storefront.css';
import './styles/workflow.css';

const decodeId = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
};

function App() {
  const { profile: companyProfile } = useCompany();
  const [catalogState, setCatalogState] = useState('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    initializeCatalog()
      .then(() => {
        if (active) setCatalogState('ready');
      })
      .catch(() => {
        if (active) setCatalogState('error');
      });
    return () => {
      active = false;
    };
  }, [loadAttempt]);
  useSyncExternalStore(subscribeCatalog, catalogRevision, () => 0);
  const { route, productReturnTo, restoreY } = useSyncExternalStore(
    subscribeShopRoute,
    shopRouteSnapshot,
    shopRouteSnapshot,
  );
  const contentRef = useRef(null);
  const previousRoute = useRef(route);
  const adminView = {
    '/admin': 'overview',
    '/admin/produk': 'products',
    '/admin/pemasok': 'suppliers',
    '/admin/merek': 'brands',
    '/admin/kategori': 'categories',
    '/admin/pesanan': 'orders',
    '/admin/stok': 'stock',
    '/admin/perusahaan': 'company',
    '/admin/email': 'email',
    '/admin/akun': 'accounts',
    '/admin/persetujuan': 'approvals',
    '/admin/toko-sales': 'b2bStores',
    '/admin/keranjang': 'sharedCarts',
  }[route];
  const isAdmin = Boolean(adminView);
  const fastOrderRoute = isFastOrderRoute(route);
  const accountRoute = /^\/akun(?:\/(profil|alamat|keamanan|kalender|tampilan))?$/.exec(route);
  const isAccountRoute = Boolean(accountRoute);
  const accountSection =
    {
      profil: 'profile',
      alamat: 'address',
      keamanan: 'security',
      kalender: 'calendar',
      tampilan: 'appearance',
    }[accountRoute?.[1]] || null;
  const recoveryMatch = route.match(
    /^\/(forgot-password|reset-password|verifikasi-email)(?:\?[^#]*)?$/,
  );
  const productMatch = route.match(/^\/produk\/([^/?#]+)$/);
  const orderMatch = route.match(/^\/pesanan\/([^/?#]+)$/);
  const paymentMatch = route.match(/^\/pesanan\/([^/?#]+)\/pembayaran$/);
  const catalog = parseCatalogRoute(route);
  const infoPage = {
    '/tentang': 'tentang',
    '/privasi': 'privasi',
    '/pengiriman': 'pengiriman',
    '/pembatalan': 'pembatalan',
    '/bantuan': 'bantuan',
  }[route];
  const title = isAdmin
    ? {
        overview: 'Admin · Ringkasan',
        products: 'Admin · Daftar Produk',
        suppliers: 'Admin · PT Pemasok',
        brands: 'Admin · Merek',
        categories: 'Admin · Kategori',
        orders: 'Admin · Pesanan',
        stock: 'Admin · Stok',
        company: 'Admin · Pengaturan Perusahaan',
        accounts: 'Admin · Kelola Akun',
        email: 'Admin · Pengaturan Email',
        approvals: 'Admin · Persetujuan Akun',
        b2bStores: 'Admin · Toko & Sales',
        sharedCarts: 'Admin · Keranjang Bersama',
      }[adminView]
    : recoveryMatch
      ? 'Pemulihan dan verifikasi akun'
      : paymentMatch
        ? 'Pembayaran Pesanan'
        : productMatch
          ? products.find((p) => p.id === decodeId(productMatch[1]))?.name || 'Detail Produk'
          : orderMatch
            ? 'Detail Pesanan'
            : catalog
              ? 'Katalog'
              : {
                  '/': 'Beranda',
                  '/pelanggan': 'Daftar Pembeli',
                  '/pesanan': 'Pesanan Saya',
                  '/keranjang': 'Keranjang',
                  '/checkout': 'Checkout',
                  '/notifikasi': 'Notifikasi',
                  '/favorit': 'Favorit Saya',
                  '/akun': 'Akun Saya',
                  '/order-cepat': 'Order Cepat',
                  '/akun/profil': 'Profil',
                  '/akun/alamat': 'Alamat Pengiriman',
                  '/akun/keamanan': 'Keamanan Akun',
                  '/akun/kalender': 'Jadwal Pengiriman',
                  '/akun/tampilan': 'Tampilan Akun',
                  '/login': 'Masuk',
                  '/daftar': 'Daftar',
                  '/tentang': `Tentang ${companyProfile.shortName}`,
                  '/privasi': 'Informasi Privasi',
                  '/pengiriman': 'Pengiriman',
                  '/pembatalan': 'Pembatalan dan Retur',
                  '/bantuan': 'Pusat Bantuan',
                }[fastOrderRoute ? '/order-cepat' : route] || 'Halaman tidak ditemukan';

  useEffect(() => {
    document.title = `${title} | ${companyProfile.shortName}`;
    if (previousRoute.current !== route) {
      if (shouldResetRouteScroll(previousRoute.current, route)) {
        window.scrollTo(0, restoreY ?? 0);
        contentRef.current?.focus({ preventScroll: true });
      }
      previousRoute.current = route;
    }
  }, [route, title, restoreY, companyProfile.shortName]);

  // Account recovery and help must remain reachable when catalog loading fails.
  const catalogIndependentRoute =
    Boolean(recoveryMatch || infoPage) || route === '/login' || route === '/daftar';
  if (catalogState !== 'ready' && !catalogIndependentRoute)
    return (
      <CatalogStatus
        error={catalogState === 'error'}
        onRetry={() => {
          setCatalogState('loading');
          setLoadAttempt((value) => value + 1);
        }}
      />
    );
  return (
    <DeliveryProvider>
      <WorkflowProvider>
        <ShopProvider>
          <AppearanceProvider>
            {!isAdmin && <Navbar />}
            {!isAdmin && !isAccountRoute && !fastOrderRoute && route !== '/keranjang' && (
              <SharedCartBar />
            )}
            <a
              className="skip-to-content"
              href="#main-content"
              onClick={(event) => {
                event.preventDefault();
                contentRef.current?.focus();
              }}
            >
              Lewati ke isi halaman
            </a>
            <main ref={contentRef} id="main-content" tabIndex={-1} className="page-main">
              <Suspense
                fallback={
                  <div className="shop-page" role="status">
                    Memuat halaman…
                  </div>
                }
              >
                {isAdmin ? (
                  <Suspense fallback={<div role="status">Memuat ruang admin…</div>}>
                    <AdminAccess>
                      <AdminPage view={adminView} />
                    </AdminAccess>
                  </Suspense>
                ) : route === '/pelanggan' ? (
                  <Suspense
                    fallback={
                      <div className="shop-page" role="status">
                        Memuat daftar pembeli…
                      </div>
                    }
                  >
                    <CustomerDirectoryPage />
                  </Suspense>
                ) : recoveryMatch ? (
                  <AccountRecoveryPage
                    mode={recoveryMatch[1]}
                    route={route}
                    key={recoveryMatch[1]}
                  />
                ) : infoPage ? (
                  <StoreInfoPage page={infoPage} />
                ) : route === '/pesanan' ? (
                  <OrdersPage />
                ) : route === '/keranjang' ? (
                  <ShopPage type="cart" />
                ) : fastOrderRoute ? (
                  <FastOrderPage />
                ) : route === '/checkout' ? (
                  <CheckoutPage />
                ) : route === '/notifikasi' ? (
                  <ShopPage type="notifications" />
                ) : route === '/favorit' ? (
                  <FavoritesPage />
                ) : isAccountRoute ? (
                  <AccountPage key={route} section={accountSection} />
                ) : route === '/login' ? (
                  <AuthPage key="login" mode="login" />
                ) : route === '/daftar' ? (
                  <AuthPage key="register" mode="register" />
                ) : paymentMatch ? (
                  <PaymentPage orderId={decodeId(paymentMatch[1])} key={paymentMatch[1]} />
                ) : orderMatch ? (
                  <OrderConfirmationPage orderId={decodeId(orderMatch[1])} key={orderMatch[1]} />
                ) : productMatch ? (
                  <ProductDetailPage
                    productId={decodeId(productMatch[1])}
                    returnTo={productReturnTo}
                    key={productMatch[1]}
                  />
                ) : catalog && catalog.kind !== 'invalid' ? (
                  <Home key={catalogNavigationKey(route)} catalog={catalog} />
                ) : route === '/' ? (
                  <Home />
                ) : (
                  <div className="shop-page">
                    <h1>Halaman tidak ditemukan</h1>
                    <a href="#/">Kembali ke beranda</a>
                  </div>
                )}
              </Suspense>
            </main>
            {!isAdmin && <StoreFooter />}
          </AppearanceProvider>
        </ShopProvider>
      </WorkflowProvider>
    </DeliveryProvider>
  );
}

export default function ProtectedApp() {
  return (
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
}
