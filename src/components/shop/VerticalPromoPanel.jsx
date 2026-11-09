import { products } from '../../data/products';
import { homePromotions } from '../../data/homePromotions';
import { productGallery } from '../../data/productGallery';
import { rupiah } from './shopPresentation';
import ProductImage from './ProductImage';
import './VerticalPromoPanel.css';

export default function VerticalPromoPanel({ storefront = false, personal = false } = {}) {
  const { items, discountedCount } = homePromotions(products, storefront ? 3 : 4);
  return (
    <section
      className={
        'bam-vertical-promos' +
        (storefront ? ' is-storefront' : '') +
        (personal ? ' is-personal' : '')
      }
      aria-labelledby="bam-vertical-promos-title"
    >
      <header className="bam-vertical-promos-heading">
        <div>
          <span className="bam-vertical-promos-kicker">
            {personal && discountedCount
              ? 'Harga khusus untuk belanjamu'
              : discountedCount
                ? 'Harga khusus di katalog'
                : 'Pilihan dari katalog BAM'}
          </span>
          <h2 id="bam-vertical-promos-title">
            {discountedCount
              ? 'Promo & Penawaran'
              : personal
                ? 'Rekomendasi Belanja'
                : 'Pilihan untuk Tokomu'}
          </h2>
        </div>
        <a href="#/cari?q=">
          Lihat semua <span aria-hidden="true">→</span>
        </a>
      </header>
      <div className="bam-vertical-promos-list">
        {items.length ? (
          items.map(({ product, discounted, discount }) => {
            const photo = productGallery(product).find((entry) => !entry.demo);
            const preview = photo
              ? { ...product, image: photo.src, imageAlt: photo.alt }
              : { ...product, image: '' };
            const href = '#/produk/' + encodeURIComponent(product.id);
            return (
              <article className="bam-vertical-promo-item" key={product.groupId || product.id}>
                <a
                  className="bam-vertical-promo-photo"
                  href={href}
                  aria-label={'Lihat ' + (product.baseName || product.name)}
                >
                  <ProductImage product={preview} variant="promo" />
                </a>
                {/* Name, size and price only: the photo and name already open the product. */}
                <div className="bam-vertical-promo-detail">
                  <h3>
                    <a href={href}>{product.baseName || product.name}</a>
                  </h3>
                  <p className="bam-vertical-promo-package">
                    {product.sizeLabel || 'Pilihan kemasan tersedia'}
                  </p>
                  <div className="bam-vertical-promo-prices">
                    <strong>{rupiah(product.price)}</strong>
                    {discounted && <del>{rupiah(product.oldPrice)}</del>}
                  </div>
                </div>
                {discounted && (
                  <div className="bam-vertical-promo-action">
                    <span className="bam-vertical-promo-discount">−{discount}%</span>
                  </div>
                )}
              </article>
            );
          })
        ) : (
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
