import { useEffect, useRef, useState } from 'react';
import { products, productVariants } from '../../data/products';
import { categoryBy, categoryHref } from '../../data/catalog';
import { suppliers, supplierHref } from '../../data/suppliers';
import { productDescriptions } from '../../data/productDescriptions';
import { useShop } from '../../state/useShop';
import './ProductDetailPage.css';
import ProductGallery from './ProductGallery';
import { rupiah } from './shopPresentation';

const heartPath = 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z';

export default function ProductDetailPage({ productId }) {
  const [selectedId, setSelectedId] = useState(productId);
  const product = products.find((item) => item.id === selectedId);
  const variants = productVariants(productId);
  const { addItem, cart, favoriteIds, toggleFavorite } = useShop();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const feedbackTimer = useRef(null);
  useEffect(() => () => window.clearTimeout(feedbackTimer.current), []);

  if (!product) return <div className="shop-page"><h1>Produk tidak ditemukan</h1><p>Produk yang kamu cari tidak tersedia.</p><a className="shop-primary" href="#/">Kembali ke katalog</a></div>;

  const cartItem = cart.find((item) => item.id === product.id);
  const remaining = Math.max(0, 99 - (cartItem?.quantity || 0));
  const isFavorite = favoriteIds.includes(product.id);
  const supplier = suppliers.find((item) => item.productIds.includes(product.id));
  const description = product.description || productDescriptions[product.groupId] || 'Informasi produk akan dilengkapi dari pemasok.';
  const subcategory = categoryBy(product.categoryId)?.children.find((sub) => sub.id === product.subcategoryId);
  const favoriteLabel = (isFavorite ? 'Hapus' : 'Tambah') + ' ' + product.name + ' ' + (isFavorite ? 'dari' : 'ke') + ' favorit';

  const addToCart = (goToCart = false) => {
    if (remaining < 1) return;
    const amount = Math.min(quantity, remaining);
    for (let index = 0; index < amount; index += 1) addItem(product);
    setAdded(true);
    window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setAdded(false), 1800);
    if (goToCart) window.location.assign('#/keranjang');
  };

  return <div className="product-detail-page">
    <nav className="shop-breadcrumb" aria-label="Breadcrumb"><a href="#/">Beranda</a><span aria-hidden="true">/</span><a href={categoryHref(product.categoryId)}>{product.category}</a><span aria-hidden="true">/</span><a href={categoryHref(product.categoryId, product.subcategoryId)}>{subcategory?.name}</a><span aria-hidden="true">/</span><span aria-current="page">{product.name}</span></nav>
    <div className="product-detail-card">
      <ProductGallery key={product.id} product={product} />
      <section className="detail-info" aria-labelledby="product-detail-title">
        <div className="detail-heading-row"><p className="detail-category">{product.brand || product.category}</p><button type="button" className={'detail-favorite' + (isFavorite ? ' is-favorite' : '')} aria-label={favoriteLabel} aria-pressed={isFavorite} onClick={() => toggleFavorite(product.id)}><svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d={heartPath} /></svg></button></div>
        <h1 id="product-detail-title">{product.name}</h1>
        <div className="detail-rating"><strong>★ {product.rating}</strong><span>•</span><span>{product.sold} terjual</span><span className="detail-demo-stock">Stok simulasi</span></div>
        <dl className="detail-product-meta">
          <div className="detail-meta-supplier"><dt>PT pemasok</dt><dd>{supplier ? <a href={supplierHref(supplier.id)}>{supplier.name} <span aria-hidden="true">↗</span></a> : 'Belum ditentukan'}</dd></div>
          <div><dt>Merek</dt><dd>{supplier ? <a href={supplierHref(supplier.id, { brandId: product.brandId })}>{product.brand}</a> : product.brand || 'Belum ditentukan'}</dd></div>
          <div><dt>Ukuran terpilih</dt><dd className="detail-meta-size" aria-live="polite">{product.sizeLabel}</dd></div>
        </dl>
        <div className="detail-price" aria-live="polite" aria-atomic="true"><strong>{rupiah(product.price)}</strong>{product.oldPrice > product.price && <><del>{rupiah(product.oldPrice)}</del><span>Hemat {rupiah(product.oldPrice - product.price)}</span></>}</div>
        <div className="detail-divider" />
        {variants.length > 1 && <fieldset className="detail-variants"><legend>{product.sizeUnit === 'g' ? 'Gramasi' : 'Ukuran'} <span>{product.sizeLabel}</span></legend><div className="detail-variant-options">{variants.map((variant) => <label key={variant.id} className={'detail-variant' + (selectedId === variant.id ? ' is-selected' : '')}><input type="radio" name="product-size" value={variant.id} checked={selectedId === variant.id} onChange={() => { setSelectedId(variant.id); setQuantity(1); setAdded(false); window.clearTimeout(feedbackTimer.current); }} /><span>{variant.sizeLabel}</span></label>)}</div><p>Pilih ukuran kemasan. Harga mengikuti ukuran yang dipilih.</p></fieldset>}
        <div className="detail-option"><span className="detail-label">Jumlah</span><div className="detail-quantity"><button type="button" disabled={quantity <= 1} aria-label="Kurangi jumlah" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button><output aria-live="polite">{quantity}</output><button type="button" disabled={!remaining || quantity >= Math.min(99, remaining)} aria-label="Tambah jumlah" onClick={() => setQuantity((value) => Math.min(Math.max(1, remaining), value + 1))}>+</button></div><span className="detail-stock">{remaining ? `Dapat ditambah ${remaining} lagi (demo)` : 'Batas jumlah di keranjang tercapai'}</span></div>
        <div className="detail-actions"><button type="button" className="detail-add" disabled={!remaining} onClick={() => addToCart()}>{added ? '✓ Berhasil ditambahkan' : 'Tambah ke keranjang'}</button><button type="button" className="detail-buy" disabled={!remaining} onClick={() => addToCart(true)}>Beli sekarang</button></div>
        <p className="detail-feedback" role="status" aria-live="polite">{added ? 'Produk sudah masuk ke keranjang.' : ''}</p>
        <div className="detail-benefits"><div><span aria-hidden="true">🚚</span><p><strong>Pengiriman aman</strong><small>Alamat dikirim sesuai profil kamu</small></p></div><div><span aria-hidden="true">🛡️</span><p><strong>Belanja lebih tenang</strong><small>Produk pilihan BAM.</small></p></div></div>
      </section>
    </div>
    <section className="detail-description" aria-labelledby="detail-description-title"><header className="detail-description-heading"><h2 id="detail-description-title">Deskripsi produk</h2><span className="detail-demo-label">Data contoh</span></header><p>{description}</p><dl className="detail-description-specs"><div><dt>Kategori produk</dt><dd>{product.category}{subcategory ? ` · ${subcategory.name}` : ''}</dd></div><div><dt>Pilihan kemasan</dt><dd>{variants.map((variant) => variant.sizeLabel).join(' · ')}</dd></div></dl><p className="detail-description-note">Nama pemasok, merek, harga, dan deskripsi masih berupa contoh. Ketersediaan stok belum terhubung ke data toko.</p></section>
  </div>;
}
