import { useLayoutEffect, useRef } from 'react';
import ProductImage from './ProductImage';
import { productGallery } from '../../data/productGallery';
import { purchasePackagingLabel } from '../../data/packagingPresentation';
import { rupiah } from './shopPresentation';
import { purchaseStockLabel } from '../../data/productStockPresentation';

export default function ProductPurchasePanel({
  product,
  productName,
  packaging,
  stock,
  remaining,
  quantity,
  onQuantity,
  onAdd,
  added,
  error,
  sharedCart,
  cartMode,
  onCartMode,
}) {
  const panel = useRef(null);
  useLayoutEffect(() => {
    const element = panel.current;
    const update = () => {
      const navigation =
        parseFloat(
          window
            .getComputedStyle(document.documentElement)
            .getPropertyValue('--store-navigation-height'),
        ) || 0;
      const fits = element.getBoundingClientRect().height + navigation + 32 <= window.innerHeight;
      element.style.setProperty('--purchase-sticky-position', fits ? 'sticky' : 'static');
    };
    update();
    const resize = window.ResizeObserver ? new window.ResizeObserver(update) : null;
    resize?.observe(element);
    const attributes = window.MutationObserver ? new window.MutationObserver(update) : null;
    attributes?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'data-text-size'],
    });
    window.addEventListener('resize', update);
    return () => {
      resize?.disconnect();
      attributes?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);
  const photo = productGallery(product)[0];
  return (
    <section ref={panel} className="detail-purchase-panel" aria-labelledby="detail-purchase-title">
      {sharedCart?.canChooseCart && (
        <div className="detail-cart-destination" role="group" aria-label="Tujuan keranjang">
          <span>Belanja untuk</span>
          <div className="detail-cart-mode-buttons">
            <button
              type="button"
              aria-pressed={cartMode === 'personal'}
              onClick={() => onCartMode?.('personal')}
              disabled={sharedCart.busy}
            >
              Keranjang Pribadi
            </button>
            <button
              type="button"
              aria-pressed={cartMode === 'store'}
              onClick={() => onCartMode?.('store')}
              disabled={sharedCart.busy}
            >
              Keranjang Toko
            </button>
          </div>
        </div>
      )}
      <h2 id="detail-purchase-title">
        {sharedCart?.enabled
          ? 'Atur keranjang toko'
          : sharedCart?.canChooseCart
            ? 'Atur keranjang pribadi'
            : 'Atur pembelian'}
      </h2>
      {sharedCart?.canChooseCart && !sharedCart.enabled && (
        <p className="detail-personal-context">
          Produk ditambahkan ke keranjang pribadi dan tidak masuk ke keranjang bersama toko.
        </p>
      )}
      {sharedCart?.enabled && (
        <p className="detail-shared-context">
          {sharedCart.cart
            ? `Untuk ${sharedCart.cart.store.storeName}. Stok diperiksa saat finalisasi Admin.`
            : 'Pilih toko dan periode sebelum menambahkan barang.'}{' '}
          <a href="#/keranjang">Buka keranjang bersama →</a>
        </p>
      )}
      <div className="detail-purchase-product">
        <div className="detail-purchase-photo">
          <ProductImage
            product={{ ...product, image: photo.src, imageAlt: photo.alt }}
            variant="thumbnail"
          />
        </div>
        <div>
          <strong>{productName}</strong>
          <span>
            {product.sizeLabel} · {purchasePackagingLabel(product)}
          </span>
        </div>
      </div>
      <div className="detail-option">
        <span className="detail-label">
          {packaging.packagingType === 'satuan'
            ? 'Jumlah barang'
            : `Jumlah ${packaging.packagingType}`}
        </span>
        <div className="detail-quantity">
          <button
            type="button"
            disabled={quantity <= 1}
            aria-label="Kurangi jumlah"
            onClick={() => onQuantity(Math.max(1, quantity - 1))}
          >
            −
          </button>
          <output aria-live="polite">{quantity}</output>
          <button
            type="button"
            disabled={!remaining || quantity >= remaining}
            aria-label="Tambah jumlah"
            onClick={() => onQuantity(Math.min(Math.max(1, remaining), quantity + 1))}
          >
            +
          </button>
        </div>
        {!sharedCart?.enabled && (
          <div
            className={
              'detail-stock-summary' + (!stock.failed && stock.inStock === false ? ' is-empty' : '')
            }
            role="status"
            aria-live="polite"
          >
            <span>Sisa stok</span>
            <strong className="detail-stock-remaining">{purchaseStockLabel(product, stock)}</strong>
          </div>
        )}
      </div>
      <p className="detail-stock" role="status">
        {sharedCart?.enabled
          ? sharedCart.busy
            ? 'Menyimpan perubahan…'
            : sharedCart.canEdit
              ? `Dapat ditambah ${purchasePackagingLabel(product, remaining)} (batas keranjang, belum mencadangkan stok).`
              : 'Buka keranjang bersama untuk memilih toko atau memeriksa statusnya.'
          : stock.failed
            ? 'Stok belum dapat diperiksa'
            : stock.inStock === false
              ? 'Stok kemasan ini habis'
              : remaining
                ? `Dapat ditambah ${purchasePackagingLabel(product, remaining)} ke keranjang`
                : 'Stok tersedia sudah masuk keranjang atau batas jumlah tercapai'}
      </p>
      {!stock.failed && stock.reservedUnits > 0 && (
        <p className="detail-stock-reserved">
          {stock.reservedUnits.toLocaleString('id-ID')} satuan sedang dalam pesanan yang belum
          selesai.
        </p>
      )}
      {packaging.packagingType !== 'satuan' && (
        <p className="detail-package-total" role="status">
          {purchasePackagingLabel(product, quantity)}
        </p>
      )}
      <div className="detail-subtotal" aria-live="polite" aria-atomic="true">
        <span>Subtotal</span>
        {product.oldPrice > product.price && <del>{rupiah(product.oldPrice * quantity)}</del>}
        <strong>{rupiah(product.price * quantity)}</strong>
      </div>
      <div className="detail-actions">
        <button
          type="button"
          className="detail-add"
          disabled={!remaining}
          onClick={() => onAdd(false)}
        >
          {added ? '✓ Berhasil ditambahkan' : 'Tambah ke keranjang'}
        </button>
        <button
          type="button"
          className="detail-buy"
          disabled={!remaining}
          onClick={() => onAdd(true)}
        >
          {sharedCart?.enabled ? 'Tambah dan buka keranjang' : 'Beli sekarang'}
        </button>
      </div>
      <p
        className={'detail-feedback' + (error ? ' is-error' : '')}
        role="status"
        aria-live="polite"
      >
        {error || (added ? 'Produk sudah masuk ke keranjang.' : '')}
      </p>
    </section>
  );
}
