import { products } from '../../data/products';
import { homePromotions } from '../../data/homePromotions';
import { productGallery } from '../../data/productGallery';
import { rupiah } from './shopPresentation';
import ProductImage from './ProductImage';
import './VerticalPromoPanel.css';

export default function VerticalPromoPanel() {
  const { items, discountedCount } = homePromotions(products, 4);
  return (
    <section className="bam-vertical-promos" aria-labelledby="bam-vertical-promos-title">
      <header className="bam-vertical-promos-heading">
        <div>
          <span className="bam-vertical-promos-kicker">
            {discountedCount ? 'Harga khusus di katalog' : 'Pilihan dari katalog BAM'}
          </span>
          <h2 id="bam-vertical-promos-title">
            {discountedCount ? 'Promo & Penawaran' : 'Pilihan untuk Tokomu'}
          </h2>
        </div>
        <a href="#/cari?q=">Lihat semua <span aria-hidden="true">→</span></a>
      </header>
      <div className="bam-vertical-promos-list">
        {items.length ? items.map(({ product, discounted, discount }) => {
          const photo = productGallery(product).find((entry) => !entry.demo);
          const preview = photo
            ? { ...product, image: photo.src, imageAlt: photo.alt }
            : product;
          const href = '#/produk/' + encodeURIComponent(product.id);
          return (
            <article className="bam-vertical-promo-item" key={product.groupId || product.id}>
              <a className="bam-vertical-promo-photo" href={href}
                aria-label={'Lihat ' + (product.baseName || product.name)}>
                {photo ? (
                  <ProductImage product={preview} variant="promo" />
                ) : (
                  <span className="bam-vertical-promo-monogram"
                    role="img" aria-label={'Foto ' + (product.baseName || product.name) + ' belum tersedia'}>
                    {(product.brand || product.baseName || 'BAM').slice(0, 2).toUpperCase()}
                  </span>
                )}
              </a>
              <div className="bam-vertical-promo-detail">
                <span className="bam-vertical-promo-brand">{product.brand || product.category}</span>
                <h3><a href={href}>{product.baseName || product.name}</a></h3>
                <p className="bam-vertical-promo-package">{product.sizeLabel || 'Pilihan kemasan tersedia'}</p>
                <div className="bam-vertical-promo-prices">
                  <strong>{rupiah(product.price)}</strong>
                  {discounted && <del>{rupiah(product.oldPrice)}</del>}
                </div>
              </div>
              <div className="bam-vertical-promo-action">
                {discounted && <span className="bam-vertical-promo-discount">−{discount}%</span>}
                <a href={href} aria-label={'Lihat pilihan ' + (product.baseName || product.name)}>
                  Lihat <span aria-hidden="true">→</span>
                </a>
              </div>
            </article>
          );
        }) : (
          <div className="bam-vertical-promos-empty">
            Produk pilihan akan ditampilkan setelah katalog tersedia.
          </div>
        )}
      </div>
      <p className="bam-vertical-promos-disclaimer">
        {discountedCount
          ? 'Potongan harga mengikuti data katalog. Periksa detail produk dan kemasannya.'
          : 'Pilihan produk dari katalog BAM. Belum ada diskon khusus yang berlaku.'}
      </p>
    </section>
  );
}
