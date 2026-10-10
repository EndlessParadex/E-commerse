import { useEffect, useRef, useState } from 'react';
import { products, groupProducts } from '../../data/products';
import { useShop } from '../../state/useShop';
import ProductCard from './ProductCard';
import './PromotionSection.css';

export default function PromotionSection() {
  const { addItem, favoriteIds, toggleFavorite } = useShop();
  const track = useRef(null);
  const [canPrevious, setCanPrevious] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const promos = groupProducts(products.filter((product) => Number.isFinite(product.oldPrice) && product.oldPrice > product.price && product.price >= 0));
  const maximumDiscount = Math.max(0, ...promos.map((product) => Math.floor((product.oldPrice - product.price) * 100 / product.oldPrice)));

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const update = () => {
      setCanPrevious(element.scrollLeft > 2);
      setCanNext(element.scrollLeft + element.clientWidth < element.scrollWidth - 2);
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener('scroll', update, { passive: true });
    update();
    return () => { observer.disconnect(); element.removeEventListener('scroll', update); };
  }, []);

  const move = (direction) => {
    const element = track.current;
    if (!element) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollBy({ left: direction * element.clientWidth * .85, behavior: reduced ? 'instant' : 'smooth' });
  };

  if (!promos.length) return null;
  return <section className="bam-promotions" aria-labelledby="bam-promotions-title">
    <header className="bam-promotions-heading"><div><span className="section-eyebrow">Pilihan hemat untukmu</span><h2 id="bam-promotions-title">Promo pilihan BAM</h2></div><span className="bam-promotions-count">{promos.length} produk promo</span></header>
    <div className="bam-promotions-layout">
      <aside className="bam-promotions-intro">
        <span className="bam-promotions-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h8l10 10-8 8L3 11Z" /><circle cx="7.5" cy="7.5" r="1" /><path d="m11 15 4-4" /></svg></span>
        <span className="bam-promotions-kicker">Harga pilihan</span>
        <h3>Belanja hemat,<br />pilihan lengkap.</h3>
        <p className="bam-promotions-saving">Hemat hingga <strong>{maximumDiscount}%</strong></p>
        <p>Temukan pilihan promo dari produk yang tersedia di katalog BAM.</p>
        <a href="#catalog" onClick={(event) => { event.preventDefault(); document.getElementById('catalog')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }}>Jelajahi katalog <span aria-hidden="true">→</span></a>
      </aside>
      <div className="bam-promotions-products">
        <div className="bam-promotions-navigation"><p>Geser untuk melihat pilihan lainnya</p><div><button type="button" disabled={!canPrevious} onClick={() => move(-1)} aria-label="Lihat produk promo sebelumnya" aria-controls="bam-promotions-track">‹</button><button type="button" disabled={!canNext} onClick={() => move(1)} aria-label="Lihat produk promo berikutnya" aria-controls="bam-promotions-track">›</button></div></div>
        <ul ref={track} id="bam-promotions-track" className="bam-promotions-track" tabIndex={0} aria-label="Daftar produk promo, bisa digeser">
          {promos.map((product) => <li key={product.id}><ProductCard product={product} showDiscount onAdd={addItem} isFavorite={favoriteIds.includes(product.id)} onToggleFavorite={toggleFavorite} /></li>)}
        </ul>
      </div>
    </div>
  </section>;
}
