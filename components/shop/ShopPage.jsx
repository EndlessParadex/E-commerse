import { products } from '../../data/products';
import { useShop } from '../../state/useShop';
import { rupiah, dateLabel } from './shopPresentation';
import { ActionIcon } from './ShopIcon';
import ProductImage from './ProductImage';
import { cartItemPresentation } from '../../data/cartItemPresentation';
import './ShopActions.css';
import './CartPage.css';
import { useEffect, useState } from 'react';
import CancelShoppingDialog from './CancelShoppingDialog';
import CartReview from './CartReview';
import PackagingSummary from './PackagingSummary';
import { initializeCatalog, catalogUsesServer } from '../../data/adminStore';

export default function ShopPage({ type }) {
  const shop = useShop();
  const isCart = type === 'cart';
  const [cancelOpen, setCancelOpen] = useState(false);
  const [catalogError, setCatalogError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true); setCatalogError(false);
    try { if (catalogUsesServer) await initializeCatalog(); }
    catch { setCatalogError(true); }
    finally { setRefreshing(false); }
  };
  useEffect(() => {
    if (!isCart || !catalogUsesServer) return;
    let active = true;
    initializeCatalog().catch(() => { if (active) setCatalogError(true); });
    return () => { active = false; };
  }, [isCart]);
  const loadDemo = () => {
    for (const id of ['snack-pedas-23g', 'snack-pedas', 'bumbu-rendang']) {
      const product = products.find((item) => item.id === id);
      if (product) shop.addItem(product);
    }
  };

  return <div className={'shop-page' + (isCart ? ' cart-page' : '')}>
    <nav className="shop-breadcrumb" aria-label="Breadcrumb"><a href="#/">Beranda</a><span aria-hidden="true">/</span><span aria-current="page">{isCart ? 'Keranjang' : 'Notifikasi'}</span></nav>
    <header className="shop-page-header"><h1>{isCart ? 'Keranjang belanja' : 'Notifikasi'}</h1><p>{isCart ? shop.quantity + ' kemasan • ' + shop.cart.length + ' pilihan produk/kemasan' : shop.notifications.length + ' notifikasi • ' + shop.unreadCount + ' belum dibaca'}</p>{isCart && shop.cart.length > 0 && <a className="cart-continue-shopping" href="#/cari?q=">Lanjut belanja →</a>}</header>
    {isCart && <><CartReview />{catalogError && <p className="shop-warning" role="alert">Katalog terbaru belum dapat diperiksa. <button type="button" className="shop-text-button" disabled={refreshing} onClick={refresh}>{refreshing ? 'Memeriksa…' : 'Coba lagi'}</button></p>}</>}
    <div className={'shop-page-layout' + (isCart && shop.cart.length ? ' with-summary' : '')}>
      <div className="shop-panel-body">
        {shop.storageError && <p className="shop-warning" role="status">Penyimpanan browser tidak tersedia. Perubahan dapat hilang setelah refresh.</p>}
        {isCart ? <>
          {shop.cart.length === 0 ? <div className="shop-empty"><ActionIcon /><h3>Keranjang masih kosong</h3><p>Produk yang ditambahkan dari katalog akan muncul di sini.</p><a className="shop-primary" href="#/">Kembali ke beranda</a></div> : <ul className="shop-list">
            {shop.cart.map((item) => {
              const display = cartItemPresentation(item);
              const cartProduct = display.product;
              const MediaTag = display.detailHref ? 'a' : 'div';
              const current = products.find((product) => product.id === item.id);
              const maximum = current ? shop.stockFor(current).maximum : 0;
              return <li className="cart-item" key={item.id}>
                <div className="cart-product-row"><MediaTag className={'cart-product-media ' + (cartProduct.color || '')} href={display.detailHref || undefined} aria-label={display.detailHref ? 'Lihat detail ' + item.name : undefined}><ProductImage product={cartProduct} variant="thumbnail" /></MediaTag><div className="cart-product">{display.brand && <p className="cart-brand">{display.brand}</p>}<h3>{display.detailHref ? <a href={display.detailHref}>{display.name}</a> : display.name}</h3><div className="cart-size-row"><span className={'cart-size-badge' + (display.sizeLabel ? '' : ' is-legacy')}>{display.sizeLabel ? `Ukuran ${display.sizeLabel}` : 'Ukuran belum tercatat'}</span></div><PackagingSummary packaging={display.packaging} quantity={item.quantity} /><p className="cart-unit-price"><strong>{rupiah(item.price)}</strong><span> / {display.packaging?.packagingType || 'barang'}</span></p></div></div>
                <div className="cart-item-footer"><div className="cart-item-controls"><div className="cart-quantity-block"><span className="cart-quantity-label">Jumlah {display.packaging?.packagingType || 'barang'}</span><div className="cart-quantity" role="group" aria-label={'Jumlah ' + item.name}>
                  <button type="button" disabled={item.quantity <= 1} aria-label={'Kurangi ' + item.name} onClick={() => shop.dispatch({ type: 'quantity', id: item.id, quantity: item.quantity - 1 })}>−</button>
                  <output aria-live="polite">{item.quantity}</output>
                  <button type="button" disabled={item.quantity >= maximum} aria-label={'Tambah ' + item.name} onClick={() => shop.dispatch({ type: 'quantity', id: item.id, quantity: item.quantity + 1 })}>+</button>
                </div></div>
                <button type="button" className="shop-delete" aria-label={'Hapus ' + item.name} onClick={() => shop.dispatch({ type: 'remove', id: item.id })}>Hapus</button>
                </div><div className="cart-line-summary"><span>Subtotal barang</span><strong className="cart-line-total" aria-live="polite">{rupiah(item.price * item.quantity)}</strong></div></div>
              </li>;
            })}
          </ul>}
        </> : <>
          {shop.notifications.length > 0 && <div className="notification-toolbar"><button type="button" className="shop-text-button" disabled={shop.unreadCount === 0} onClick={() => shop.dispatch({ type: 'readAll' })}>Tandai semua sudah dibaca</button>{shop.unreadCount === 0 && <span className="notification-all-read" role="status">Semua notifikasi sudah dibaca</span>}</div>}
          {shop.notifications.length === 0 ? <div className="shop-empty"><ActionIcon notification /><h3>Belum ada notifikasi</h3><p>Notifikasi akan muncul setelah Anda membuat pesanan melalui checkout.</p><a className="shop-primary" href="#/pesanan">Lihat pesanan saya</a></div> : <ul className="shop-list">
            {shop.notifications.map((item) => <li className={'notification-item' + (item.read ? '' : ' is-unread')} key={item.id}>
              <div className="notification-heading"><h3>{item.title}</h3>{!item.read && <span className="notification-status">Baru</span>}</div>
              <p>{item.message}</p><time dateTime={new Date(item.createdAt).toISOString()}>{dateLabel(item.createdAt)}</time>
              {['orderCreated', 'orderCancelled'].includes(item.kind) && <div className="notification-order-link"><span className="notification-simulation">Simulasi</span><a className="shop-text-button" href={'#/pesanan/' + encodeURIComponent(item.orderId)} onClick={() => shop.dispatch({ type: 'read', id: item.id })}>Lihat detail pesanan →</a></div>}
              <div className="notification-actions">{!item.read && <button type="button" className="shop-text-button" onClick={() => shop.dispatch({ type: 'read', id: item.id })}>Tandai dibaca</button>}<button type="button" className="shop-delete" aria-label={'Hapus notifikasi ' + item.title} onClick={() => shop.dispatch({ type: 'removeNotification', id: item.id })}>Hapus</button></div>
            </li>)}
          </ul>}
        </>}
        {import.meta.env.DEV && <details className="shop-demo"><summary>Produk uji untuk pratinjau</summary><p>Tambahkan produk contoh untuk mencoba alur belanja.</p><button type="button" className="shop-text-button" onClick={loadDemo}>Tambah produk contoh</button></details>}
      </div>

      {isCart && shop.cart.length > 0 && <footer className="shop-panel-footer"><h2 className="cart-summary-title">Ringkasan belanja</h2><div className="cart-summary-count"><span>Total kemasan</span><strong>{shop.quantity}</strong></div><div className="cart-subtotal" aria-live="polite"><span>Subtotal barang</span><strong>{rupiah(shop.subtotal)}</strong></div><p>Ongkos kirim dihitung saat checkout.</p>{shop.cartReview.ready && !catalogError ? <a className="shop-primary" href="#/checkout">Lanjut ke checkout <span aria-hidden="true">→</span></a> : <p className="shop-warning">Periksa kembali keranjang sebelum checkout.</p>}<button type="button" className="bam-button-danger cart-cancel" onClick={() => setCancelOpen(true)}>Batalkan belanja</button></footer>}
    </div>
    {cancelOpen && <CancelShoppingDialog onClose={() => setCancelOpen(false)} />}
  </div>;
}
