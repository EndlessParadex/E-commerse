import { useEffect, useState } from 'react';
import { promoSlides } from '../../data/promoSlides';
import './PromoCarousel.css';
import ProductImage from './ProductImage';
import { productVariants } from '../../data/products';
import { packagingOptionLabel } from '../../data/packagingPresentation';
import { productGallery } from '../../data/productGallery';
import snackArtwork from '../../assets/banner-snack-v2.webp';
import spiceArtwork from '../../assets/banner-spice-v2.webp';
import beautyArtwork from '../../assets/banner-beauty-v2.webp';
import homeArtwork from '../../assets/banner-home-v2.webp';

const categoryArtwork = { snack: snackArtwork, bumbu: spiceArtwork, beauty: beautyArtwork, rumah: homeArtwork };
const rupiah = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
const priceNumber = (value) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);
const positionLabel = (value) => String(value).padStart(2, '0');
const firstPhoto = (product) => productGallery(product).find((photo) => !photo.demo);
function Arrow({ back = false }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={back ? 'm14 6-6 6 6 6M8 12h12' : 'm10 6 6 6-6 6M4 12h12'} /></svg>;
}

export default function PromoCarousel({ catalog, categoryList } = {}) {
  const slides = promoSlides(catalog, categoryList);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [hidden, setHidden] = useState(() => document.hidden);
  const playing = !paused && !hovered && !reducedMotion && !hidden;
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
  // Give uploaded photos the spotlight, while retaining the actual featured SKUs.
  const featured = [...slide.featured].sort((a, b) => Number(Boolean(firstPhoto(b))) - Number(Boolean(firstPhoto(a))));
  const titleLines = slide.title.split('\n');
  return <section className={`bam-promo bam-promo--${slide.theme}`} aria-label="Pilihan katalog CV. Belitung Arta Mandiri" aria-roledescription="carousel"
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(true); }}>
    <div className="bam-promo-slide" key={slide.id} role="group" aria-roledescription="slide" aria-label={`${currentIndex + 1} dari ${slides.length}: ${slide.category}`} aria-live={playing ? 'off' : 'polite'}>
      <div className="bam-promo-copy">
        <div className="bam-promo-brand"><span aria-hidden="true">BAM<span className="bam-promo-brand-dot">.</span></span><span>CV. Belitung Arta Mandiri</span></div>
        <span className="bam-promo-eyebrow"><span aria-hidden="true" />{slide.category}</span>
        <h1>{titleLines.map((line, i) => <span key={i}>{line}{i < titleLines.length - 1 && <br />}</span>)}</h1><p>{slide.description}</p>
        <div className="bam-promo-copy-actions"><a className="bam-promo-cta" href={slide.href}>{slide.cta}<Arrow /></a><a className="bam-promo-all" href="#/cari?q=">Lihat semua produk <Arrow /></a></div>
      </div>
      <div className={'bam-promo-showcase' + (!slide.featured.length ? ' is-empty' : '')}>
        {featured.length > 0 ? <><div className={'bam-promo-products' + (featured.length === 1 ? ' is-single' : '')}>
          {featured.map((product, i) => {
            const variants = productVariants(product.id);
            const name = product.baseName || product.name;
            const packaging = packagingOptionLabel(product, variants);
            const discounted = product.oldPrice > product.price;
            const saving = discounted ? Math.round((product.oldPrice - product.price) / product.oldPrice * 100) : 0;
            const photo = firstPhoto(product);
            const artwork = i === 0 && !photo ? categoryArtwork[slide.id] : null;
            return <a className={'bam-promo-product' + (i === 0 ? ' is-spotlight' : ' is-secondary')} href={`#/produk/${encodeURIComponent(product.id)}`} key={product.id} aria-label={`Lihat ${name}${product.sizeLabel ? ', ' + product.sizeLabel : ''}, ${packaging}, ${rupiah(product.price)}${artwork ? '. Gambar adalah ilustrasi kategori' : ''}`}>
              <div className={'bam-promo-product-visual' + (photo ? ' has-photo' : '')}>
                {i === 0 && <div className="bam-promo-stage-decoration" aria-hidden="true"><span className="bam-promo-orbit" /><span className="bam-promo-star">✦</span><span className="bam-promo-spark">✧</span></div>}
                {i === 0 && discounted && <span className="bam-promo-discount">{saving > 0 ? `Hemat ${saving}%` : 'Harga promo'}</span>}
                {artwork ? <div className="bam-product-media bam-product-media--hero"><img src={artwork} alt={`Ilustrasi kategori ${slide.category}`} loading="eager" decoding="async" /></div> : <ProductImage product={photo ? { ...product, image: photo.src, imageAlt: photo.alt } : product} variant={i === 0 ? 'hero' : 'promo'} loading="eager" />}
              </div>
              <div className="bam-promo-product-info"><div className="bam-promo-product-description">{product.brand && <span className="bam-promo-product-brand">{product.brand}</span>}<h2 className="bam-promo-product-name" title={name}>{name}</h2><span className="bam-promo-product-size">{product.sizeLabel && <span>{product.sizeLabel}</span>}<span>{packaging}</span></span></div>
                <div className="bam-promo-product-pricing"><div className="bam-promo-old-price">{discounted && <del>{rupiah(product.oldPrice)}</del>}</div><span className={'bam-promo-price' + (product.price >= 10_000_000 ? ' is-long' : '')}><span>Rp</span><strong>{priceNumber(product.price)}</strong></span></div>
                <span className="bam-promo-product-link"><span>Lihat produk</span><Arrow /></span>
              </div>
            </a>;
          })}
        </div>{categoryArtwork[slide.id] && !firstPhoto(featured[0]) && <p className="bam-promo-artwork-note">Gambar contoh kategori</p>}</> : <div className="bam-promo-empty"><span aria-hidden="true">BAM<span>.</span></span><p>Pilihan produk akan hadir di sini.</p></div>}
      </div>
    </div>
    {slides.length > 1 && <footer className="bam-promo-footer"><div className="bam-promo-controls"><button type="button" className="bam-promo-arrow" aria-label="Pilihan sebelumnya" onClick={() => goTo(currentIndex - 1)}><Arrow back /></button><div className="bam-promo-dots" role="group" aria-label="Pilih kategori banner">{slides.map((item, i) => <button type="button" key={item.id} aria-label={`Tampilkan pilihan ${item.category}`} aria-current={i === currentIndex ? 'true' : undefined} onClick={() => goTo(i)}><span /></button>)}</div><button type="button" className="bam-promo-arrow" aria-label="Pilihan berikutnya" onClick={() => goTo(currentIndex + 1)}><Arrow /></button></div>
      <div className="bam-promo-playback"><span className="bam-promo-position" aria-label={`Pilihan ${currentIndex + 1} dari ${slides.length}`}><strong>{positionLabel(currentIndex + 1)}</strong><span aria-hidden="true">/</span>{positionLabel(slides.length)}</span>{!reducedMotion && <button className="bam-promo-pause" type="button" onClick={() => setPaused((current) => !current)} aria-label={paused ? 'Aktifkan pergantian otomatis' : 'Jeda pergantian otomatis'}><span aria-hidden="true">{paused ? '▷' : 'Ⅱ'}</span>{paused ? 'Putar otomatis' : 'Jeda'}</button>}</div>
    </footer>}
  </section>;
}
