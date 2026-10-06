import { useEffect, useRef, useState } from 'react';
import ProductImage from './ProductImage';
import { rupiah } from './shopPresentation';
import './ProductCard.css';

export default function ProductCard({ product, onAdd, isFavorite = false, onToggleFavorite }) {
  const [added, setAdded] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const add = () => {
    onAdd(product);
    setAdded(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAdded(false), 1600);
  };

  const discounted = Number.isFinite(product.oldPrice) && product.oldPrice > product.price;
  const favoriteLabel = (isFavorite ? 'Hapus' : 'Tambah') + ' ' + product.name + ' ' + (isFavorite ? 'dari' : 'ke') + ' favorit';

  return <article className="product-card">
    <div className={'product-image-wrap ' + (product.color || '')}>
      <a className={'product-image ' + (product.color || '')} href={'#/produk/' + product.id} aria-label={'Lihat detail ' + product.name}>
        <ProductImage product={product} />
        {product.tag && <span className="product-tag">{product.tag}</span>}
      </a>
      <button type="button" className={'favorite-button' + (isFavorite ? ' is-favorite' : '')} aria-label={favoriteLabel} aria-pressed={isFavorite} onClick={() => onToggleFavorite?.(product.id)}>
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" /></svg>
      </button>
    </div>
    <div className="product-card-body">
      <p className="product-category">{product.category}</p>
      <h3><a href={'#/produk/' + product.id}>{product.name}</a></h3>
      <div className="product-rating"><span aria-label={'Rating ' + product.rating + ' dari 5'}>★ {product.rating}</span><span>•</span><span>{product.sold} terjual</span></div>
      <div className="product-price"><strong>{rupiah(product.price)}</strong>{discounted && <del>{rupiah(product.oldPrice)}</del>}</div>
      <button type="button" className={'add-product-button' + (added ? ' added' : '')} onClick={add} aria-label={'Tambah ' + product.name + ' ke keranjang'}><span role="status">{added ? '✓ Ditambahkan' : '+ Keranjang'}</span></button>
    </div>
  </article>;
}
