import { useEffect, useRef, useState } from 'react';
import ProductImage from './ProductImage';
import { rupiah } from './shopPresentation';
import './ProductCard.css';
import { productVariants } from '../../data/products';
import { productColorStyle } from '../../data/catalogColors';
import { packagingValues } from '../../data/productPackaging';
import { purchaseProductName } from '../../data/packagingPresentation';
import { useShop } from '../../state/useShop';
import { productGallery } from '../../data/productGallery';
import { workflowUsesServer } from '../../data/adminStore';
import { groupSoldStockLabel } from '../../data/productStockPresentation';

export default function ProductCard({
  product,
  onAdd,
  isFavorite = false,
  onToggleFavorite,
  showDiscount = false,
}) {
  const [added, setAdded] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const pending = useRef(false);
  const mounted = useRef(false);
  const timer = useRef(null);
  const variants = productVariants(product.id);
  const productName = purchaseProductName(product, variants);
  const shop = useShop();
  const stocks = variants.map((variant) => shop.stockFor(variant));
  const stockFailed = stocks.some((stock) => stock.failed);
  const shared = shop.shared;
  const chooseStore = shared?.enabled && !shared.selection.storeId && shared.status === 'ready';
  const cartBlocked = shared?.enabled && !shared.canEdit;
  const stockAvailable = variants.some((variant, index) => {
    const stock = stocks[index];
    return (
      !stock.failed &&
      (stock.inStock ?? stock.available >= packagingValues(variant).unitsPerPackage)
    );
  });
  const hasVariants = variants.length > 1;
  const hasPackaging = variants.some(
    (variant) => packagingValues(variant).packagingType !== 'satuan',
  );
  const sizeAction = hasPackaging
    ? 'Pilih kemasan'
    : product.sizeUnit === 'g'
      ? 'Pilih gramasi'
      : 'Pilih ukuran';
  const minimumPrice = hasVariants
    ? Math.min(...variants.map((item) => item.price))
    : product.price;
  const priceLabel = rupiah(minimumPrice);
  const photo = productGallery(product)[0];
  const preview = { ...product, image: photo.src, imageAlt: photo.alt };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(timer.current);
    };
  }, []);

  const add = async () => {
    if (pending.current) return;
    if (chooseStore || (cartBlocked && !hasVariants)) {
      window.location.assign('#/keranjang');
      return;
    }
    if (hasVariants) {
      window.location.assign('#/produk/' + product.id);
      return;
    }
    pending.current = true;
    setSaving(true);
    setSaveError('');
    setAdded(false);
    setLimitReached(false);
    window.clearTimeout(timer.current);
    try {
      const result = await onAdd(product);
      if (!mounted.current) return;
      if (result === false) {
        if (shared?.enabled)
          setSaveError(
            'Belum tersimpan. Buka keranjang untuk memeriksa dan memastikan penyimpanan.',
          );
        else setLimitReached(true);
        return;
      }
      setAdded(true);
      timer.current = window.setTimeout(() => setAdded(false), 1600);
    } catch {
      if (mounted.current)
        setSaveError('Belum dapat menyimpan. Periksa keranjang sebelum mencoba kembali.');
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const discounted =
    !hasVariants && Number.isFinite(product.oldPrice) && product.oldPrice > product.price;
  const badge = hasVariants
    ? `${variants.length} ${hasPackaging ? 'varian' : 'ukuran'}`
    : showDiscount && discounted
      ? `Hemat ${Math.floor(((product.oldPrice - product.price) * 100) / product.oldPrice)}%`
      : product.tag;
  const favoriteLabel =
    (isFavorite ? 'Hapus' : 'Tambah') +
    ' ' +
    productName +
    ' ' +
    (isFavorite ? 'dari' : 'ke') +
    ' favorit';

  return (
    <article className="product-card">
      <div
        className={
          'product-image-wrap ' + (product.color || '') + (!photo.demo ? ' has-photo' : '')
        }
        style={productColorStyle(product.color)}
      >
        <a
          className={'product-image ' + (product.color || '')}
          style={productColorStyle(product.color)}
          href={'#/produk/' + product.id}
          aria-label={'Lihat detail ' + productName}
        >
          <ProductImage product={preview} />
          {badge && <span className="product-tag">{badge}</span>}
        </a>
        <button
          type="button"
          className={'favorite-button' + (isFavorite ? ' is-favorite' : '')}
          aria-label={favoriteLabel}
          aria-pressed={isFavorite}
          onClick={() => onToggleFavorite?.(product.id)}
        >
          <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" />
          </svg>
        </button>
      </div>
      <div className="product-card-body">
        <p className="product-category" title={product.brand || product.category}>
          {product.brand || product.category}
        </p>
        <h3>
          <a href={'#/produk/' + product.id} title={hasVariants ? product.baseName : productName}>
            {hasVariants ? product.baseName : productName}
          </a>
        </h3>
        <div className="product-rating">
          {!workflowUsesServer && (
            <span
              aria-label={
                product.rating > 0 ? 'Rating ' + product.rating + ' dari 5' : 'Belum ada ulasan'
              }
            >
              {product.rating > 0 ? `★ ${product.rating}` : 'Belum ada ulasan'}
            </span>
          )}
          {(workflowUsesServer
            ? groupSoldStockLabel(variants, shop.stockFor)
            : `${product.sold} terjual`) && (
            <>
              <span>•</span>
              <span className="product-sold-count" title="Angka penjualan yang ditampilkan toko">
                {workflowUsesServer
                  ? groupSoldStockLabel(variants, shop.stockFor)
                  : `${product.sold} terjual`}
              </span>
            </>
          )}
        </div>
        <div className={'product-price' + (priceLabel.length > 14 ? ' is-long-price' : '')}>
          <strong>
            {hasVariants && <span className="product-price-prefix">Mulai </span>}
            <span className="product-price-amount">{priceLabel}</span>
          </strong>
          {discounted && <del>{rupiah(product.oldPrice)}</del>}
        </div>
        <button
          type="button"
          className={'add-product-button' + (added ? ' added' : '')}
          disabled={saving || shared?.busy || (!chooseStore && (stockFailed || !stockAvailable))}
          aria-busy={saving}
          onClick={add}
          aria-label={
            chooseStore
              ? 'Pilih toko sebelum menambah ' + productName
              : cartBlocked && !hasVariants
                ? 'Periksa keranjang untuk ' + productName
                : hasVariants
                  ? sizeAction + ' ' + product.baseName
                  : 'Tambah ' + productName + ' ke keranjang'
          }
        >
          <span role="status">
            {saving
              ? 'Menyimpan…'
              : chooseStore
                ? 'Pilih toko dahulu'
                : stockFailed
                  ? 'Stok belum dapat dimuat'
                  : !stockAvailable
                    ? 'Stok belum tersedia'
                    : hasVariants
                      ? sizeAction
                      : cartBlocked
                        ? 'Periksa keranjang'
                        : limitReached
                          ? 'Jumlah tersedia sudah di keranjang'
                          : added
                            ? '✓ Ditambahkan'
                            : '+ Keranjang'}
          </span>
        </button>
        {saveError && (
          <p className="product-cart-error" role="alert">
            {saveError} <a href="#/keranjang">Buka keranjang</a>
          </p>
        )}
      </div>
    </article>
  );
}
