import { useEffect, useState } from 'react';
import { products } from '../../data/products';
import './PromoCarousel.css';
import ProductImage from './ProductImage';

const slides = [
  { theme: 'snack', category: 'Snack & Makanan', label: 'TEMAN WAKTU SANTAI', title: 'Camilan favorit,\nharga lebih manis.', description: 'Dari pedas sampai manis, pilih teman ngemilmu hari ini.', ids: ['snack-pedas', 'cokelat-import'], cta: 'Jelajahi snack', decoration: '✦' },
  { theme: 'beauty', category: 'Kosmetik & Beauty', label: 'YOUR EVERYDAY GLOW', title: 'Sentuhan kecil,\npercaya diri lebih.', description: 'Lengkapi rutinitasmu dengan pilihan beauty dari BAM.', ids: ['skincare-glow', 'lipstik-matte'], cta: 'Temukan beauty favorit', decoration: '✧' },
  { theme: 'spice', category: 'Bumbu Masakan', label: 'RASA RUMAH, SETIAP HARI', title: 'Masak lebih praktis,\nrasa tetap istimewa.', description: 'Temukan bumbu pilihan untuk menu favorit keluarga.', ids: ['bumbu-rendang'], cta: 'Lihat pilihan bumbu', decoration: '✳' },
];
const rupiah = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

export default function PromoCarousel() {
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
    if (!playing) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % slides.length), 6000);
    return () => window.clearInterval(timer);
  }, [playing]);
  const goTo = (next) => { setIndex((next + slides.length) % slides.length); setPaused(true); };
  const slide = slides[index];
  const featured = slide.ids.map((id) => products.find((product) => product.id === id)).filter(Boolean);
  return <section className={`bam-promo bam-promo--${slide.theme}`} aria-label="Pilihan promo BAM" aria-roledescription="carousel"
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocus={() => setFocused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <div className="bam-promo-slide" key={slide.theme} role="group" aria-roledescription="slide" aria-label={`${index + 1} dari ${slides.length}: ${slide.category}`} aria-live={playing ? 'off' : 'polite'}>
      <div className="bam-promo-copy">
        <span className="bam-promo-eyebrow"><b>BAM.</b> / {slide.label}</span>
        <h1>{slide.title}</h1><p>{slide.description}</p>
        <a className="bam-promo-cta" href={`#/kategori/${encodeURIComponent(slide.category)}`}>{slide.cta}<span aria-hidden="true">↗</span></a>
      </div>
      <div className="bam-promo-products">
        <span className="bam-promo-spark" aria-hidden="true">{slide.decoration}</span>
        {featured.map((product) => <a className="bam-promo-product" href={`#/produk/${product.id}`} key={product.id}>
          <ProductImage product={product} variant="promo" loading="eager" />
          <span className="bam-promo-product-name">{product.name}</span>
          <del>{rupiah(product.oldPrice)}</del><strong>{rupiah(product.price)}</strong>
        </a>)}
      </div>
    </div>
    <button type="button" className="bam-promo-arrow bam-promo-prev" aria-label="Promo sebelumnya" onClick={() => goTo(index - 1)}>‹</button>
    <button type="button" className="bam-promo-arrow bam-promo-next" aria-label="Promo berikutnya" onClick={() => goTo(index + 1)}>›</button>
    <div className="bam-promo-controls"><div className="bam-promo-dots" aria-label="Pilih promo">{slides.map((item, i) => <button type="button" key={item.theme} aria-label={`Tampilkan promo ${item.category}`} aria-current={i === index ? 'true' : undefined} onClick={() => goTo(i)}><span /></button>)}</div>
      {!reducedMotion && <button className="bam-promo-pause" type="button" onClick={() => setPaused((current) => !current)} aria-label={paused ? 'Aktifkan pergantian otomatis' : 'Jeda pergantian otomatis'}>{paused ? 'Putar otomatis' : 'Jeda'}</button>}
    </div>
    <a className="bam-promo-all" href="#catalog" onClick={(event) => { event.preventDefault(); document.getElementById('catalog')?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth' }); }}>Lihat produk lainnya <span aria-hidden="true">→</span></a>
  </section>;
}
