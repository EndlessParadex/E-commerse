import { products, groupProducts } from '../../data/products';
import { useShop } from '../../state/useShop';
import ProductCard from './ProductCard';

/** Products come from the active catalog. This is not an invented sales ranking. */
export default function FeaturedProducts() {
  const { addItem, favoriteIds, toggleFavorite } = useShop();
  const featured = groupProducts(products).slice(0, 8);
  return (
    <section className="store-featured-products" aria-labelledby="store-featured-title">
      <header className="section-heading">
        <div>
          <span className="section-eyebrow">Langsung dari katalog BAM</span>
          <h2 id="store-featured-title">Produk untuk kebutuhan tokomu</h2>
          <p className="store-featured-caption">
            Pilih produk dan kemasan yang sesuai kebutuhan belanjamu.
          </p>
        </div>
        <a className="view-all-link" href="#/cari?q=">
          Lihat seluruh produk →
        </a>
      </header>
      {featured.length ? (
        <div className="product-grid">
          {featured.map((product) => (
            <ProductCard
              key={product.groupId || product.id}
              product={product}
              onAdd={addItem}
              isFavorite={favoriteIds.includes(product.id)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      ) : (
        <div className="catalog-empty">
          <h3>Belum ada produk tersedia</h3>
          <p>Produk akan tampil setelah katalog BAM memiliki barang.</p>
        </div>
      )}
    </section>
  );
}
