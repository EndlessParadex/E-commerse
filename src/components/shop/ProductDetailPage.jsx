import { useEffect, useRef, useState } from 'react';
import { products, productVariants } from '../../data/products';
import { categoryBy, categoryHref } from '../../data/catalog';
import { suppliers, supplierHref } from '../../data/suppliers';
import { productDescriptions } from '../../data/productDescriptions';
import { useShop } from '../../state/useShop';
import './ProductDetailPage.css';
import ProductGallery from './ProductGallery';
import { rupiah } from './shopPresentation';
import { packagingTypes, packagingValues, sizeKey, variantForSize } from '../../data/productPackaging';
import { packagingOptionLabel, purchasePackagingLabel, purchasePackagingChoice, purchaseProductName } from '../../data/packagingPresentation';

const heartPath = 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z';

export default function ProductDetailPage({ productId, returnTo = '/cari?q=' }) {
  const [selectedId, setSelectedId] = useState(productId);
  const product = products.find((item) => item.id === selectedId);
  const variants = productVariants(productId);
  const { addItem, cart, favoriteIds, toggleFavorite, stockFor } = useShop();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState('');
  const feedbackTimer = useRef(null);
  useEffect(() => () => window.clearTimeout(feedbackTimer.current), []);

  if (!product) return <div className="shop-page"><h1>Produk tidak ditemukan</h1><p>Produk yang kamu cari tidak tersedia.</p><a className="shop-primary" href="#/">Kembali ke katalog</a></div>;

  const cartItem = cart.find((item) => item.id === product.id);
  const stock = stockFor(product);
  const remaining = stock.failed ? 0 : Math.max(0, stock.maximum - (cartItem?.quantity || 0));
  const isFavorite = favoriteIds.includes(product.id);
  const supplier = suppliers.find((item) => item.productIds.includes(product.id));
  const description = product.description || productDescriptions[product.groupId] || 'Informasi produk akan dilengkapi dari pemasok.';
  const subcategory = categoryBy(product.categoryId)?.children.find((sub) => sub.id === product.subcategoryId);
  const productName = purchaseProductName(product, variants);
  const favoriteLabel = (isFavorite ? 'Hapus' : 'Tambah') + ' ' + productName + ' ' + (isFavorite ? 'dari' : 'ke') + ' favorit';
  const packaging = packagingValues(product);
  const sizes = [...new Map(variants.map((variant) => [sizeKey(variant), variant])).values()];
  const packages = variants.filter((variant) => sizeKey(variant) === sizeKey(product)).sort((a, b) => {
    const first = packagingValues(a); const second = packagingValues(b);
    return packagingTypes.findIndex((entry) => entry.id === first.packagingType) - packagingTypes.findIndex((entry) => entry.id === second.packagingType)
      || first.unitsPerPackage - second.unitsPerPackage;
  });
  const selectVariant = (variant) => { setSelectedId(variant.id); setQuantity(1); setAdded(false); setAddError(''); window.clearTimeout(feedbackTimer.current); };

  const addToCart = (goToCart = false) => {
    if (remaining < 1) return;
    if (quantity > remaining) { setAddError('Stok atau isi keranjang berubah. Kurangi jumlah sebelum menambahkan barang.'); return; }
    if (!addItem(product, quantity)) { setAddError('Barang belum dapat ditambahkan. Periksa stok, penyimpanan browser, dan batas 100 pilihan barang di keranjang.'); return; }
    setAddError('');
    setAdded(true);
    window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setAdded(false), 1800);
    if (goToCart) window.location.assign('#/keranjang');
  };

  return <div className="product-detail-page">
    <nav className="shop-breadcrumb" aria-label="Breadcrumb"><a href="#/">Beranda</a><span aria-hidden="true">/</span><a href={categoryHref(product.categoryId)}>{product.category}</a><span aria-hidden="true">/</span><a href={categoryHref(product.categoryId, product.subcategoryId)}>{subcategory?.name}</a><span aria-hidden="true">/</span><span aria-current="page">{productName}</span></nav>
    <a className="product-back-link" href={'#' + returnTo}><span aria-hidden="true">←</span> Kembali ke halaman sebelumnya</a>
    <div className="product-detail-card">
      <ProductGallery key={product.id} product={product} />
      <section className="detail-info" aria-labelledby="product-detail-title">
        <div className="detail-heading-row"><p className="detail-category">{product.brand || product.category}</p><button type="button" className={'detail-favorite' + (isFavorite ? ' is-favorite' : '')} aria-label={favoriteLabel} aria-pressed={isFavorite} onClick={() => toggleFavorite(product.id)}><svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d={heartPath} /></svg></button></div>
        <h1 id="product-detail-title">{productName}</h1>
        <div className="detail-rating"><strong>{product.rating > 0 ? `★ ${product.rating}` : 'Belum ada ulasan'}</strong><span>•</span><span>{product.sold} terjual</span><span className="detail-demo-stock">Stok simulasi</span></div>
        <dl className="detail-product-meta">
          <div className="detail-meta-supplier"><dt>PT pemasok</dt><dd>{supplier ? <a href={supplierHref(supplier.id)}>{supplier.name} <span aria-hidden="true">↗</span></a> : 'Belum ditentukan'}</dd></div>
          <div><dt>Merek</dt><dd>{supplier ? <a href={supplierHref(supplier.id, { brandId: product.brandId })}>{product.brand}</a> : product.brand || 'Belum ditentukan'}</dd></div>
          <div><dt>Ukuran terpilih</dt><dd className="detail-meta-size" aria-live="polite">{product.sizeLabel}</dd></div>
          <div><dt>Kemasan terpilih</dt><dd aria-live="polite">{purchasePackagingChoice(product, packages)}</dd></div>
        </dl>
        <div className="detail-price" aria-live="polite" aria-atomic="true"><strong>{rupiah(product.price)}</strong>{product.oldPrice > product.price && <><del>{rupiah(product.oldPrice)}</del><span>Hemat {rupiah(product.oldPrice - product.price)}</span></>}</div>
        <p className="detail-package-price">Harga untuk {purchasePackagingLabel(product)}</p>
        <div className="detail-divider" />
        <div className="detail-selection" role="group" aria-label="Pilihan ukuran dan kemasan">
          <fieldset className="detail-variants detail-sizes"><legend>{product.sizeUnit === 'g' ? 'Gramasi' : 'Ukuran'}</legend><div className="detail-variant-options">{sizes.map((size) => { const variant = variantForSize(variants, size, product); const selected = sizeKey(size) === sizeKey(product); return <label key={sizeKey(size)} className={'detail-variant' + (selected ? ' is-selected' : '')}><input type="radio" name="product-size" value={variant.id} checked={selected} onChange={() => selectVariant(variant)} /><span>{size.sizeLabel}</span></label>; })}</div></fieldset>
          <fieldset className="detail-variants detail-packages"><legend>Kemasan</legend><div className="detail-variant-options">{packages.map((variant) => <label key={variant.id} className={'detail-variant' + (selectedId === variant.id ? ' is-selected' : '')}><input type="radio" name="product-packaging" value={variant.id} checked={selectedId === variant.id} onChange={() => selectVariant(variant)} /><span>{packagingOptionLabel(variant, packages)}</span></label>)}</div></fieldset>
          <p className="detail-selection-hint">Harga mengikuti {product.sizeUnit === 'g' ? 'gramasi' : 'ukuran'} dan kemasan yang dipilih.</p>
        </div>
        <div className="detail-option"><span className="detail-label">{packaging.packagingType === 'satuan' ? 'Jumlah barang' : `Jumlah ${packaging.packagingType}`}</span><div className="detail-quantity"><button type="button" disabled={quantity <= 1} aria-label="Kurangi jumlah" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button><output aria-live="polite">{quantity}</output><button type="button" disabled={!remaining || quantity >= remaining} aria-label="Tambah jumlah" onClick={() => setQuantity((value) => Math.min(Math.max(1, remaining), value + 1))}>+</button></div><span className="detail-stock" role="status">{stock.failed ? 'Stok belum dapat diperiksa' : stock.available < packaging.unitsPerPackage ? 'Stok kemasan ini habis' : remaining ? `Dapat ditambah ${purchasePackagingLabel(product, remaining)}` : 'Stok tersedia sudah masuk keranjang atau batas jumlah tercapai'}</span></div>
        {packaging.packagingType !== 'satuan' && <p className="detail-package-total" role="status">{purchasePackagingLabel(product, quantity)}</p>}
        <div className="detail-actions"><button type="button" className="detail-add" disabled={!remaining} onClick={() => addToCart()}>{added ? '✓ Berhasil ditambahkan' : 'Tambah ke keranjang'}</button><button type="button" className="detail-buy" disabled={!remaining} onClick={() => addToCart(true)}>Beli sekarang</button></div>
        <p className="detail-feedback" role="status" aria-live="polite">{addError || (added ? 'Produk sudah masuk ke keranjang.' : '')}</p>
        <div className="detail-benefits"><div><span aria-hidden="true">🚚</span><p><strong>Pengiriman aman</strong><small>Alamat dikirim sesuai profil kamu</small></p></div><div><span aria-hidden="true">🛡️</span><p><strong>Belanja lebih tenang</strong><small>Produk pilihan BAM.</small></p></div></div>
      </section>
    </div>
    <section className="detail-description" aria-labelledby="detail-description-title"><header className="detail-description-heading"><h2 id="detail-description-title">Deskripsi produk</h2></header><p>{description}</p><dl className="detail-description-specs"><div><dt>Kategori produk</dt><dd>{product.category}{subcategory ? ` · ${subcategory.name}` : ''}</dd></div><div><dt>Pilihan ukuran dan kemasan</dt><dd>{variants.map((variant) => `${variant.sizeLabel} — ${purchasePackagingChoice(variant, variants)}`).join(' · ')}</dd></div></dl><p className="detail-description-note">Ketersediaan stok dan proses pembelian masih berupa simulasi.</p></section>
  </div>;
}
