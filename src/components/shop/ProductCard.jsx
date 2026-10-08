import { useEffect, useRef, useState } from 'react';
import ProductImage from './ProductImage';
import { rupiah } from './shopPresentation';
import './ProductCard.css';
import { productVariants } from '../../data/products';

export default function ProductCard({ product, onAdd, isFavorite = false, onToggleFavorite, showDiscount = false }) {
  const [added, setAdded] = useState(false);
  const timer = useRef(null);
  const variants = productVariants(product.id);
  const hasVariants = variants.length > 1;
  const sizeAction = product.sizeUnit === 'g' ? 'Pilih gramasi' : 'Pilih ukuran';
  const minimumPrice = hasVariants ? Math.min(...variants.map((item) => item.price)) : product.price;
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const add = () => {
    if (hasVariants) { window.location.assign('#/produk/' + product.id); return; }
    onAdd(product);
    setAdded(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAdded(false), 1600);
  };

  const discounted = !hasVariants && Number.isFinite(product.oldPrice) && product.oldPrice > product.price;
  const badge = hasVariants ? `${variants.length} ukuran` : showDiscount && discounted ? `Hemat ${Math.floor((product.oldPrice - product.price) * 100 / product.oldPrice)}%` : product.tag;
  const favoriteLabel = (isFavorite ? 'Hapus' : 'Tambah') + ' ' + product.name + ' ' + (isFavorite ? 'dari' : 'ke') + ' favorit';

  return <article className="product-card">
    <div className={'product-image-wrap ' + (product.color || '')}>
      <a className={'product-image ' + (product.color || '')} href={'#/produk/' + product.id} aria-label={'Lihat detail ' + product.name}>
        <ProductImage product={product} />
        {badge && <span className="product-tag">{badge}</span>}
      </a>
      <button type="button" className={'favorite-button' + (isFavorite ? ' is-favorite' : '')} aria-label={favoriteLabel} aria-pressed={isFavorite} onClick={() => onToggleFavorite?.(product.id)}>
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" /></svg>
      </button>
    </div>
    <div className="product-card-body">
      <p className="product-category">{product.brand || product.category}</p>
      <h3><a href={'#/produk/' + product.id}>{hasVariants ? product.baseName : product.name}</a></h3>
      <div className="product-rating"><span aria-label={'Rating ' + product.rating + ' dari 5'}>★ {product.rating}</span><span>•</span><span>{product.sold} terjual</span></div>
      <div className="product-price"><strong>{hasVariants ? 'Mulai ' : ''}{rupiah(minimumPrice)}</strong>{discounted && <del>{rupiah(product.oldPrice)}</del>}</div>
      <button type="button" className={'add-product-button' + (added ? ' added' : '')} onClick={add} aria-label={hasVariants ? sizeAction + ' ' + product.baseName : 'Tambah ' + product.name + ' ke keranjang'}><span role="status">{hasVariants ? sizeAction : added ? '✓ Ditambahkan' : '+ Keranjang'}</span></button>
    </div>
  </article>;
}
