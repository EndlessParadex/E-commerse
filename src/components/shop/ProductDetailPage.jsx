import { useState } from 'react';
import { products } from '../../data/products';
import { useShop } from '../../state/useShop';
import './ProductDetailPage.css';

const rupiah = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

export default function ProductDetailPage({ productId }) {
  const product = products.find((item) => item.id === productId);
  const { addItem } = useShop();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  if (!product) return <div className="shop-page"><h1>Produk tidak ditemukan</h1><p>Produk yang kamu cari tidak tersedia.</p><a className="shop-primary" href="#/">Kembali ke katalog</a></div>;

  const addToCart = () => {
    for (let index = 0; index < quantity; index += 1) addItem(product);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  return <div className="product-detail-page">
    <nav className="shop-breadcrumb" aria-label="Breadcrumb"><a href="#/">Beranda</a><span aria-hidden="true">/</span><a href={`#/kategori/${encodeURIComponent(product.category)}`}>{product.category}</a><span aria-hidden="true">/</span><span aria-current="page">{product.name}</span></nav>
    <div className="product-detail-card">
      <div className={`detail-image ${product.color}`}><span role="img" aria-label={product.name}>{product.icon}</span>{product.tag && <span className="detail-tag">{product.tag}</span>}</div>
      <section className="detail-info" aria-labelledby="product-detail-title">
        <p className="detail-category">{product.category}</p>
        <h1 id="product-detail-title">{product.name}</h1>
        <div className="detail-rating"><strong>★ {product.rating}</strong><span>•</span><span>{product.sold} terjual</span><span>•</span><span>Stok tersedia</span></div>
        <div className="detail-price"><strong>{rupiah(product.price)}</strong><del>{rupiah(product.oldPrice)}</del><span>Hemat {rupiah(product.oldPrice - product.price)}</span></div>
        <div className="detail-divider" />
        <div className="detail-option"><span className="detail-label">Jumlah</span><div className="detail-quantity"><button type="button" disabled={quantity <= 1} aria-label="Kurangi jumlah" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button><output aria-live="polite">{quantity}</output><button type="button" disabled={quantity >= 99} aria-label="Tambah jumlah" onClick={() => setQuantity((value) => Math.min(99, value + 1))}>+</button></div><span className="detail-stock">Tersisa banyak</span></div>
        <div className="detail-actions"><button type="button" className="detail-add" onClick={addToCart}>{added ? '✓ Berhasil ditambahkan' : 'Tambah ke keranjang'}</button><button type="button" className="detail-buy" onClick={addToCart}>Beli sekarang</button></div>
        <div className="detail-benefits"><div><span>🚚</span><p><strong>Pengiriman aman</strong><small>Alamat dikirim sesuai profil kamu</small></p></div><div><span>🛡️</span><p><strong>Belanja lebih tenang</strong><small>Produk pilihan BAM.</small></p></div></div>
      </section>
    </div>
    <section className="detail-description"><h2>Deskripsi produk</h2><p>{product.name} pilihan BAM. Cocok untuk kebutuhan harian dengan kualitas yang kami pilih untuk pengalaman belanja yang lebih nyaman.</p></section>
  </div>;
}
