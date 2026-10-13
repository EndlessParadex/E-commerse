import { useLayoutEffect, useRef } from 'react';
import ProductImage from './ProductImage';
import { productGallery } from '../../data/productGallery';
import { purchasePackagingLabel } from '../../data/packagingPresentation';
import { rupiah } from './shopPresentation';

export default function ProductPurchasePanel({ product, productName, packaging, stock, remaining, quantity, onQuantity, onAdd, added, error }) {
  const panel = useRef(null);
  useLayoutEffect(() => {
    const element = panel.current;
    const update = () => {
      const navigation = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue('--store-navigation-height')) || 0;
      const fits = element.getBoundingClientRect().height + navigation + 32 <= window.innerHeight;
      element.style.setProperty('--purchase-sticky-position', fits ? 'sticky' : 'static');
    };
    update();
    const resize = window.ResizeObserver ? new window.ResizeObserver(update) : null;
    resize?.observe(element);
    const attributes = window.MutationObserver ? new window.MutationObserver(update) : null;
    attributes?.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-text-size'] });
    window.addEventListener('resize', update);
    return () => { resize?.disconnect(); attributes?.disconnect(); window.removeEventListener('resize', update); };
  }, []);
  const photo = productGallery(product)[0];
  return <section ref={panel} className="detail-purchase-panel" aria-labelledby="detail-purchase-title">
    <h2 id="detail-purchase-title">Atur pembelian</h2>
    <div className="detail-purchase-product"><div className="detail-purchase-photo"><ProductImage product={{ ...product, image: photo.src, imageAlt: photo.alt }} variant="thumbnail" /></div><div><strong>{productName}</strong><span>{product.sizeLabel} · {purchasePackagingLabel(product)}</span></div></div>
    <div className="detail-option"><span className="detail-label">{packaging.packagingType === 'satuan' ? 'Jumlah barang' : `Jumlah ${packaging.packagingType}`}</span><div className="detail-quantity"><button type="button" disabled={quantity <= 1} aria-label="Kurangi jumlah" onClick={() => onQuantity(Math.max(1, quantity - 1))}>−</button><output aria-live="polite">{quantity}</output><button type="button" disabled={!remaining || quantity >= remaining} aria-label="Tambah jumlah" onClick={() => onQuantity(Math.min(Math.max(1, remaining), quantity + 1))}>+</button></div></div>
    <p className="detail-stock" role="status">{stock.failed ? 'Stok belum dapat diperiksa' : stock.available < packaging.unitsPerPackage ? 'Stok kemasan ini habis' : remaining ? `Dapat ditambah ${purchasePackagingLabel(product, remaining)}` : 'Stok tersedia sudah masuk keranjang atau batas jumlah tercapai'}</p>
    {packaging.packagingType !== 'satuan' && <p className="detail-package-total" role="status">{purchasePackagingLabel(product, quantity)}</p>}
    <div className="detail-subtotal" aria-live="polite" aria-atomic="true"><span>Subtotal</span>{product.oldPrice > product.price && <del>{rupiah(product.oldPrice * quantity)}</del>}<strong>{rupiah(product.price * quantity)}</strong></div>
    <div className="detail-actions"><button type="button" className="detail-add" disabled={!remaining} onClick={() => onAdd(false)}>{added ? '✓ Berhasil ditambahkan' : 'Tambah ke keranjang'}</button><button type="button" className="detail-buy" disabled={!remaining} onClick={() => onAdd(true)}>Beli sekarang</button></div>
    <p className={'detail-feedback' + (error ? ' is-error' : '')} role="status" aria-live="polite">{error || (added ? 'Produk sudah masuk ke keranjang.' : '')}</p>
  </section>;
}
