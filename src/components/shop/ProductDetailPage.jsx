import { workflowUsesServer } from '../../data/adminStore';
import useCompany from '../../state/useCompany';
import { useEffect, useRef, useState } from 'react';
import { products, productVariants } from '../../data/products';
import { categoryBy, categoryHref } from '../../data/catalog';
import { suppliers } from '../../data/suppliers';
import { productDescriptions } from '../../data/productDescriptions';
import { useShop } from '../../state/useShop';
import './ProductDetailPage.css';
import ProductGallery from './ProductGallery';
import ProductPurchasePanel from './ProductPurchasePanel';
import ProductInformation from './ProductInformation';
import { rupiah } from './shopPresentation';
import { purchaseStockLabel, soldStockLabel } from '../../data/productStockPresentation';
import {
  packagingTypes,
  packagingValues,
  sizeKey,
  variantForSize,
} from '../../data/productPackaging';
import {
  packagingOptionLabel,
  purchasePackagingLabel,
  purchaseProductName,
} from '../../data/packagingPresentation';

const heartPath =
  'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z';

export default function ProductDetailPage({ productId, returnTo = '/cari?q=' }) {
  const { profile: companyProfile, commerce } = useCompany();
  const [selectedId, setSelectedId] = useState(productId);
  const product = products.find((item) => item.id === selectedId);
  const variants = productVariants(productId);
  const { addItem, cart, favoriteIds, toggleFavorite, stockFor, shared, cartMode, setCartMode } =
    useShop();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const share = async () => {
    const url = window.location.origin + '/produk/' + encodeURIComponent(selectedId);
    try {
      if (navigator.share) await navigator.share({ title: product?.name || 'Produk', url });
      else {
        await navigator.clipboard.writeText(url);
        setShareMessage('Tautan produk disalin.');
      }
    } catch (error) {
      if (error.name !== 'AbortError') setShareMessage('Salin tautan: ' + url);
    }
  };
  const [addError, setAddError] = useState('');
  const feedbackTimer = useRef(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(feedbackTimer.current);
    };
  }, []);

  if (!product)
    return (
      <div className="shop-page">
        <h1>Produk tidak ditemukan</h1>
        <p>Produk yang kamu cari tidak tersedia.</p>
        <a className="shop-primary" href="#/">
          Kembali ke katalog
        </a>
      </div>
    );

  const cartItem = cart.find((item) => item.id === product.id);
  const stock = stockFor(product);
  const remaining = stock.failed ? 0 : Math.max(0, stock.maximum - (cartItem?.quantity || 0));
  const isFavorite = favoriteIds.includes(product.id);
  const supplier = suppliers.find((item) => item.productIds.includes(product.id));
  const description =
    product.description ||
    productDescriptions[product.groupId] ||
    'Informasi produk akan dilengkapi dari pemasok.';
  const subcategory = categoryBy(product.categoryId)?.children.find(
    (sub) => sub.id === product.subcategoryId,
  );
  const productName = purchaseProductName(product, variants);
  const favoriteLabel =
    (isFavorite ? 'Hapus' : 'Tambah') +
    ' ' +
    productName +
    ' ' +
    (isFavorite ? 'dari' : 'ke') +
    ' favorit';
  const packaging = packagingValues(product);
  const sizes = [...new Map(variants.map((variant) => [sizeKey(variant), variant])).values()];
  const packages = variants
    .filter((variant) => sizeKey(variant) === sizeKey(product))
    .sort((a, b) => {
      const first = packagingValues(a);
      const second = packagingValues(b);
      return (
        packagingTypes.findIndex((entry) => entry.id === first.packagingType) -
          packagingTypes.findIndex((entry) => entry.id === second.packagingType) ||
        first.unitsPerPackage - second.unitsPerPackage
      );
    });
  const selectVariant = (variant) => {
    setSelectedId(variant.id);
    setQuantity(1);
    setAdded(false);
    setAddError('');
    window.clearTimeout(feedbackTimer.current);
  };

  const chooseCartMode = (mode) => {
    setCartMode(mode);
    setAdded(false);
    setAddError('');
    window.clearTimeout(feedbackTimer.current);
  };

  const addToCart = (goToCart = false) => {
    if (remaining < 1) return;
    if (quantity > remaining) {
      setAddError('Stok atau isi keranjang berubah. Kurangi jumlah sebelum menambahkan barang.');
      return;
    }
    const finish = (success) => {
      if (!mounted.current) return;
      if (!success) {
        setAddError(
          shared?.enabled
            ? 'Perubahan belum tersimpan. Buka keranjang bersama untuk memeriksa status penyimpanan dan isian terbaru.'
            : 'Barang belum dapat ditambahkan. Periksa stok, penyimpanan browser, dan batas 100 pilihan barang di keranjang.',
        );
        return;
      }
      setAddError('');
      setAdded(true);
      window.clearTimeout(feedbackTimer.current);
      feedbackTimer.current = window.setTimeout(() => setAdded(false), 1800);
      if (goToCart) window.location.assign('#/keranjang');
    };
    const result = addItem(product, quantity);
    if (result && typeof result.then === 'function') void result.then(finish);
    else finish(result);
  };

  return (
    <div className="product-detail-page">
      <nav className="shop-breadcrumb" aria-label="Breadcrumb">
        <a href="#/">Beranda</a>
        <span aria-hidden="true">/</span>
        <a href={categoryHref(product.categoryId)}>{product.category}</a>
        <span aria-hidden="true">/</span>
        <a href={categoryHref(product.categoryId, product.subcategoryId)}>{subcategory?.name}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{productName}</span>
      </nav>
      <a className="product-back-link" href={'#' + returnTo}>
        <span aria-hidden="true">←</span> Kembali ke halaman sebelumnya
      </a>
      <div className="product-detail-layout">
        <div className="detail-main">
          <div className="product-detail-card">
            <ProductGallery key={product.id} product={product} />
            <section className="detail-info" aria-labelledby="product-detail-title">
              <div className="detail-heading-row">
                <p className="detail-category">{product.brand || product.category}</p>
                <button
                  type="button"
                  className={'detail-favorite' + (isFavorite ? ' is-favorite' : '')}
                  aria-label={favoriteLabel}
                  aria-pressed={isFavorite}
                  onClick={() => toggleFavorite(product.id)}
                >
                  <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                    <path d={heartPath} />
                  </svg>
                </button>
              </div>
              <h1 id="product-detail-title">{productName}</h1>
              <div className="detail-rating">
                <strong>{product.rating > 0 ? `★ ${product.rating}` : 'Belum ada ulasan'}</strong>
                {(workflowUsesServer ? soldStockLabel(stock) : `${product.sold} terjual`) && (
                  <>
                    <span>•</span>
                    <span
                      className="detail-sold-count"
                      title="Angka penjualan yang ditampilkan toko"
                    >
                      {workflowUsesServer ? soldStockLabel(stock) : `${product.sold} terjual`}
                    </span>
                  </>
                )}
                <span
                  className="detail-demo-stock"
                  title={
                    workflowUsesServer
                      ? 'Stok tersedia mengikuti server.'
                      : 'Stok pratinjau pada tab browser.'
                  }
                >
                  Stok {purchaseStockLabel(product, stock)}
                  {!workflowUsesServer && ' · simulasi'}
                </span>
                <a
                  className="detail-reviews-link"
                  href="#detail-reviews"
                  onClick={(event) => {
                    event.preventDefault();
                    document.getElementById('detail-reviews')?.scrollIntoView({
                      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                        ? 'instant'
                        : 'smooth',
                    });
                  }}
                >
                  Lihat penilaian
                </a>
              </div>
              <div className="detail-price" aria-live="polite" aria-atomic="true">
                <strong>{rupiah(product.price)}</strong>
                {product.oldPrice > product.price && (
                  <>
                    <del>{rupiah(product.oldPrice)}</del>
                    <span>Hemat {rupiah(product.oldPrice - product.price)}</span>
                  </>
                )}
              </div>
              <p className="detail-package-price">Harga untuk {purchasePackagingLabel(product)}</p>
              <div className="detail-divider" />
              <div
                className="detail-selection"
                role="group"
                aria-label="Pilihan ukuran dan kemasan"
              >
                <fieldset className="detail-variants detail-sizes">
                  <legend>{product.sizeUnit === 'g' ? 'Gramasi' : 'Ukuran'}</legend>
                  <div className="detail-variant-options">
                    {sizes.map((size) => {
                      const variant = variantForSize(variants, size, product);
                      const selected = sizeKey(size) === sizeKey(product);
                      return (
                        <label
                          key={sizeKey(size)}
                          className={'detail-variant' + (selected ? ' is-selected' : '')}
                        >
                          <input
                            type="radio"
                            name="product-size"
                            value={variant.id}
                            checked={selected}
                            onChange={() => selectVariant(variant)}
                          />
                          <span>{size.sizeLabel}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <fieldset className="detail-variants detail-packages">
                  <legend>Kemasan</legend>
                  <div className="detail-variant-options">
                    {packages.map((variant) => (
                      <label
                        key={variant.id}
                        className={
                          'detail-variant' + (selectedId === variant.id ? ' is-selected' : '')
                        }
                      >
                        <input
                          type="radio"
                          name="product-packaging"
                          value={variant.id}
                          checked={selectedId === variant.id}
                          onChange={() => selectVariant(variant)}
                        />
                        <span>{packagingOptionLabel(variant, packages)}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <p className="detail-selection-hint">
                  Harga mengikuti {product.sizeUnit === 'g' ? 'gramasi' : 'ukuran'} dan kemasan yang
                  dipilih.
                </p>
              </div>
              <ProductInformation
                product={product}
                variants={variants}
                packages={packages}
                supplier={supplier}
                subcategory={subcategory}
                description={description}
                companyProfile={companyProfile}
                sharedCart={shared}
                codOnly={commerce?.codOnly === true}
              />
            </section>
          </div>
          <button className="bam-button-secondary commerce-share" type="button" onClick={share}>
            Bagikan produk
          </button>
          {shareMessage && <p role="status">{shareMessage}</p>}

          <section
            className="detail-reviews"
            id="detail-reviews"
            aria-labelledby="detail-reviews-title"
          >
            <h2 id="detail-reviews-title">Penilaian dan ulasan</h2>
            {product.rating > 0 && (
              <p className="detail-review-score">
                <strong>★ {product.rating}</strong>
                <span>Penilaian dari katalog</span>
              </p>
            )}
            <p>
              {product.rating > 0
                ? 'Ulasan tertulis belum tersedia untuk produk ini.'
                : 'Belum ada ulasan untuk produk ini.'}
            </p>
          </section>
        </div>
        <aside className="detail-purchase-rail">
          <ProductPurchasePanel
            product={product}
            productName={productName}
            packaging={packaging}
            stock={stock}
            remaining={remaining}
            quantity={quantity}
            onQuantity={setQuantity}
            onAdd={addToCart}
            added={added}
            error={addError}
            sharedCart={shared}
            cartMode={cartMode}
            onCartMode={chooseCartMode}
          />
        </aside>
      </div>
      <div className="detail-mobile-purchase" aria-label="Pembelian cepat">
        <div>
          <span>{purchasePackagingLabel(product, quantity)}</span>
          <strong>{rupiah(product.price * quantity)}</strong>
        </div>
        <button
          type="button"
          className="detail-mobile-buy"
          disabled={!remaining}
          onClick={() => addToCart(true)}
        >
          {shared?.enabled ? 'Tambah dan buka keranjang' : 'Beli sekarang'}
        </button>
      </div>
    </div>
  );
}
