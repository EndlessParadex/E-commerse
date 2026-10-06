import { products } from '../../data/products';
import { useShop } from '../../state/useShop';
import { rupiah, dateLabel } from './shopPresentation';
import { ActionIcon } from './ShopIcon';
import ProductImage from './ProductImage';
import './ShopActions.css';

const fallbackProduct = (item) => products.find((product) => product.id === item.id) || {
  id: item.id,
  name: item.name,
  price: item.price,
  image: '',
  imageAlt: item.name,
  icon: '🛒',
  color: 'sand',
};

export default function ShopPage({ type }) {
  const shop = useShop();
  const isCart = type === 'cart';
  const loadDemo = () => {
    shop.addItem({ id: 'demo-snack', name: '[Contoh] Keripik Kentang', price: 18000 });
    shop.addItem({ id: 'demo-bumbu', name: '[Contoh] Bumbu Rendang', price: 12000 });
  };

  return <div className="shop-page">
    <nav className="shop-breadcrumb" aria-label="Breadcrumb"><a href="#/">Beranda</a><span aria-hidden="true">/</span><span aria-current="page">{isCart ? 'Keranjang' : 'Notifikasi'}</span></nav>
    <header className="shop-page-header"><h1>{isCart ? 'Keranjang belanja' : 'Notifikasi'}</h1><p>{isCart ? shop.quantity + ' barang • ' + shop.cart.length + ' jenis produk' : shop.notifications.length + ' notifikasi • ' + shop.unreadCount + ' belum dibaca'}</p></header>
    <div className={'shop-page-layout' + (isCart && shop.cart.length ? ' with-summary' : '')}>
      <div className="shop-panel-body">
        {shop.storageError && <p className="shop-warning" role="status">Penyimpanan browser tidak tersedia. Perubahan dapat hilang setelah refresh.</p>}
        {isCart ? <>
          {shop.cart.length === 0 ? <div className="shop-empty"><ActionIcon /><h3>Keranjang masih kosong</h3><p>Produk yang ditambahkan dari katalog akan muncul di sini.</p><a className="shop-primary" href="#/">Kembali ke beranda</a></div> : <ul className="shop-list">
            {shop.cart.map((item) => {
              const cartProduct = fallbackProduct(item);
              return <li className="cart-item" key={item.id}>
                <div className="cart-product-row"><div className={'cart-product-media ' + (cartProduct.color || '')}><ProductImage product={cartProduct} variant="promo" /></div><div className="cart-product"><h3>{item.name}</h3><p>{rupiah(item.price)} / barang</p></div></div>
                <strong className="cart-line-total">{rupiah(item.price * item.quantity)}</strong>
                <div className="cart-quantity" role="group" aria-label={'Jumlah ' + item.name}>
                  <button type="button" disabled={item.quantity <= 1} aria-label={'Kurangi ' + item.name} onClick={() => shop.dispatch({ type: 'quantity', id: item.id, quantity: item.quantity - 1 })}>−</button>
                  <output aria-live="polite">{item.quantity}</output>
                  <button type="button" disabled={item.quantity >= 99} aria-label={'Tambah ' + item.name} onClick={() => shop.dispatch({ type: 'quantity', id: item.id, quantity: item.quantity + 1 })}>+</button>
                </div>
                <button type="button" className="shop-delete" aria-label={'Hapus ' + item.name} onClick={() => shop.dispatch({ type: 'remove', id: item.id })}>Hapus</button>
              </li>;
            })}
          </ul>}
        </> : <>
          {shop.notifications.length > 0 && <div className="notification-toolbar"><button type="button" className="shop-text-button" disabled={shop.unreadCount === 0} onClick={() => shop.dispatch({ type: 'readAll' })}>Tandai semua sudah dibaca</button>{shop.unreadCount === 0 && <span className="notification-all-read" role="status">Semua notifikasi sudah dibaca</span>}</div>}
          {shop.notifications.length === 0 ? <div className="shop-empty"><ActionIcon notification /><h3>Belum ada notifikasi</h3><p>Pembaruan aktivitas belanja akan muncul di sini.</p></div> : <ul className="shop-list">
            {shop.notifications.map((item) => <li className={'notification-item' + (item.read ? '' : ' is-unread')} key={item.id}>
              <div className="notification-heading"><h3>{item.title}</h3>{!item.read && <span className="notification-status">Baru</span>}</div>
              <p>{item.message}</p><time dateTime={new Date(item.createdAt).toISOString()}>{dateLabel(item.createdAt)}</time>
              <div className="notification-actions">{!item.read && <button type="button" className="shop-text-button" onClick={() => shop.dispatch({ type: 'read', id: item.id })}>Tandai dibaca</button>}<button type="button" className="shop-delete" aria-label={'Hapus notifikasi ' + item.title} onClick={() => shop.dispatch({ type: 'removeNotification', id: item.id })}>Hapus</button></div>
            </li>)}
          </ul>}
        </>}
        {import.meta.env.DEV && <div className="shop-demo"><p>Mode pengembangan: gunakan dua produk contoh untuk mencoba keranjang dan notifikasi.</p><button type="button" className="shop-text-button" onClick={loadDemo}>Tambah produk contoh</button></div>}
      </div>

      {isCart && shop.cart.length > 0 && <footer className="shop-panel-footer"><div className="cart-subtotal" aria-live="polite"><span>Subtotal</span><strong>{rupiah(shop.subtotal)}</strong></div><p>Belum termasuk ongkir.</p><a className="shop-primary" href="#/checkout">Lanjut ke checkout <span aria-hidden="true">→</span></a></footer>}
    </div>
  </div>;
}
