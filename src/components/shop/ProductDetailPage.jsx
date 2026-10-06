import { useState } from 'react';
import { products } from '../../data/products';
import { categoryBy, categoryHref } from '../../data/catalog';
import { useShop } from '../../state/useShop';
import './ProductDetailPage.css';
import ProductImage from './ProductImage';
import { rupiah } from './shopPresentation';

const heartPath = 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z';

export default function ProductDetailPage({ productId }) {
  const product = products.find((item) => item.id === productId);
  const { addItem, cart, favoriteIds, toggleFavorite } = useShop();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  if (!product) return <div className="shop-page"><h1>Produk tidak ditemukan</h1><p>Produk yang kamu cari tidak tersedia.</p><a className="shop-primary" href="#/">Kembali ke katalog</a></div>;

  const cartItem = cart.find((item) => item.id === product.id);
  const remaining = Math.max(0, 99 - (cartItem?.quantity || 0));
  const isFavorite = favoriteIds.includes(product.id);
  const subcategory = categoryBy(product.categoryId)?.children.find((sub) => sub.id === product.subcategoryId);
  const favoriteLabel = (isFavorite ? 'Hapus' : 'Tambah') + ' ' + product.name + ' ' + (isFavorite ? 'dari' : 'ke') + ' favorit';

  const addToCart = (goToCart = false) => {
    if (remaining < 1) return;
    const amount = Math.min(quantity, remaining);
    for (let index = 0; index < amount; index += 1) addItem(product);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
    if (goToCart) window.location.assign('#/keranjang');
  };

  return <div className="product-detail-page">
    <nav className="shop-breadcrumb" aria-label="Breadcrumb"><a href="#/">Beranda</a><span aria-hidden="true">/</span><a href={categoryHref(product.categoryId)}>{product.category}</a><span aria-hidden="true">/</span><a href={categoryHref(product.categoryId, product.subcategoryId)}>{subcategory?.name}</a><span aria-hidden="true">/</span><span aria-current="page">{product.name}</span></nav>
    <div className="product-detail-card">
      <div className={'detail-image ' + product.color}><ProductImage product={product} variant="detail" loading="eager" />{product.tag && <span className="detail-tag">{product.tag}</span>}</div>
      <section className="detail-info" aria-labelledby="product-detail-title">
        <div className="detail-heading-row"><p className="detail-category">{product.category}</p><button type="button" className={'detail-favorite' + (isFavorite ? ' is-favorite' : '')} aria-label={favoriteLabel} aria-pressed={isFavorite} onClick={() => toggleFavorite(product.id)}><svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d={heartPath} /></svg></button></div>
        <h1 id="product-detail-title">{product.name}</h1>
        <div className="detail-rating"><strong>★ {product.rating}</strong><span>•</span><span>{product.sold} terjual</span><span>•</span><span>Stok tersedia</span></div>
        <div className="detail-price"><strong>{rupiah(product.price)}</strong>{product.oldPrice > product.price && <><del>{rupiah(product.oldPrice)}</del><span>Hemat {rupiah(product.oldPrice - product.price)}</span></>}</div>
        <div className="detail-divider" />
        <div className="detail-option"><span className="detail-label">Jumlah</span><div className="detail-quantity"><button type="button" disabled={quantity <= 1} aria-label="Kurangi jumlah" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button><output aria-live="polite">{quantity}</output><button type="button" disabled={!remaining || quantity >= Math.min(99, remaining)} aria-label="Tambah jumlah" onClick={() => setQuantity((value) => Math.min(Math.max(1, remaining), value + 1))}>+</button></div><span className="detail-stock">{remaining ? 'Tersisa banyak' : 'Batas jumlah di keranjang tercapai'}</span></div>
        <div className="detail-actions"><button type="button" className="detail-add" disabled={!remaining} onClick={() => addToCart()}>{added ? '✓ Berhasil ditambahkan' : 'Tambah ke keranjang'}</button><button type="button" className="detail-buy" disabled={!remaining} onClick={() => addToCart(true)}>Beli sekarang</button></div>
        <p className="detail-feedback" role="status" aria-live="polite">{added ? 'Produk sudah masuk ke keranjang.' : ''}</p>
        <div className="detail-benefits"><div><span aria-hidden="true">🚚</span><p><strong>Pengiriman aman</strong><small>Alamat dikirim sesuai profil kamu</small></p></div><div><span aria-hidden="true">🛡️</span><p><strong>Belanja lebih tenang</strong><small>Produk pilihan BAM.</small></p></div></div>
      </section>
    </div>
    <section className="detail-description"><h2>Deskripsi produk</h2><p>{product.name} pilihan BAM. Cocok untuk kebutuhan harian dengan kualitas yang kami pilih untuk pengalaman belanja yang lebih nyaman.</p></section>
  </div>;
}
