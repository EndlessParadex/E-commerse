import { useEffect, useState } from 'react';
import { promoSlides } from '../../data/promoSlides';
import './PromoCarousel.css';
import ProductImage from './ProductImage';
import { productVariants } from '../../data/products';
import { purchaseProductName } from '../../data/packagingPresentation';

const rupiah = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

export default function PromoCarousel() {
  const slides = promoSlides();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [hidden, setHidden] = useState(() => document.hidden);
  const playing = !paused && !hovered && !focused && !reducedMotion && !hidden;
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(media.matches);
    const updateVisibility = () => setHidden(document.hidden);
    media.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => { media.removeEventListener('change', updateMotion); document.removeEventListener('visibilitychange', updateVisibility); };
  }, []);
  useEffect(() => {
    if (!playing || slides.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % slides.length), 6000);
    return () => window.clearInterval(timer);
  }, [playing, slides.length]);
  const goTo = (next) => { setIndex((next + slides.length) % slides.length); setPaused(true); };
  const currentIndex = index % slides.length;
  const slide = slides[currentIndex];
  const featured = slide.featured;
  return <section className={`bam-promo bam-promo--${slide.theme}`} aria-label="Pilihan promo CV. Belitung Arta Mandiri" aria-roledescription="carousel"
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocus={() => setFocused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <div className="bam-promo-slide" key={slide.id} role="group" aria-roledescription="slide" aria-label={`${currentIndex + 1} dari ${slides.length}: ${slide.category}`} aria-live={playing ? 'off' : 'polite'}>
      <div className="bam-promo-copy">
        <div className="bam-promo-brand">CV. Belitung Arta Mandiri</div>
        <span className="bam-promo-eyebrow">{slide.label}</span>
        <h1>{slide.title}</h1><p>{slide.description}</p>
        <a className="bam-promo-cta" href={slide.href}>{slide.cta}<span aria-hidden="true">↗</span></a>
      </div>
      <div className="bam-promo-products">
        <span className="bam-promo-spark" aria-hidden="true">{slide.decoration}</span>
        {featured.map((product) => <a className="bam-promo-product" href={`#/produk/${encodeURIComponent(product.id)}`} key={product.id}>
          <ProductImage product={product} variant="promo" loading="eager" />
          <span className="bam-promo-product-name">{purchaseProductName(product, productVariants(product.id))}</span>
          {product.oldPrice > product.price && <del>{rupiah(product.oldPrice)}</del>}<strong>{rupiah(product.price)}</strong>
        </a>)}
      </div>
    </div>
    {slides.length > 1 && <><button type="button" className="bam-promo-arrow bam-promo-prev" aria-label="Promo sebelumnya" onClick={() => goTo(currentIndex - 1)}>‹</button><button type="button" className="bam-promo-arrow bam-promo-next" aria-label="Promo berikutnya" onClick={() => goTo(currentIndex + 1)}>›</button></>}
    <div className="bam-promo-controls"><div className="bam-promo-dots" aria-label="Pilih promo">{slides.map((item, i) => <button type="button" key={item.id} aria-label={`Tampilkan promo ${item.category}`} aria-current={i === currentIndex ? 'true' : undefined} onClick={() => goTo(i)}><span /></button>)}</div>
      {!reducedMotion && slides.length > 1 && <button className="bam-promo-pause" type="button" onClick={() => setPaused((current) => !current)} aria-label={paused ? 'Aktifkan pergantian otomatis' : 'Jeda pergantian otomatis'}>{paused ? 'Putar otomatis' : 'Jeda'}</button>}
    </div>
    <a className="bam-promo-all" href="#catalog" onClick={(event) => { event.preventDefault(); document.getElementById('catalog')?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth' }); }}>Lihat produk lainnya <span aria-hidden="true">→</span></a>
  </section>;
}
