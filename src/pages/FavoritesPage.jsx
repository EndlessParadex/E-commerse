import { products } from '../data/products';
import { useShop } from '../state/useShop';
import ProductCard from '../components/shop/ProductCard';
import './Home.css';

export default function FavoritesPage() {
  const { favoriteIds, toggleFavorite, addItem } = useShop();
  const favorites = favoriteIds.map((id) => products.find((product) => product.id === id)).filter(Boolean);
  return <div className="home-container favorites-page">
    <nav className="shop-breadcrumb" aria-label="Breadcrumb"><a href="#/">Beranda</a><span aria-hidden="true">/</span><span aria-current="page">Favorit Saya</span></nav>
    <section className="catalog-section" aria-labelledby="favorites-title">
      <div className="section-heading"><div><span className="section-eyebrow">Tersimpan untuk nanti</span><h1 id="favorites-title">Favorit Saya</h1></div><span className="favorites-count">{favorites.length} produk</span></div>
      {favorites.length ? <div className="product-grid">{favorites.map((product) => <ProductCard key={product.id} product={product} onAdd={addItem} isFavorite onToggleFavorite={toggleFavorite} />)}</div> : <div className="catalog-empty favorites-empty"><span aria-hidden="true">♡</span><h3>Belum ada produk favorit</h3><p>Tekan ikon love pada produk yang ingin Anda simpan.</p><a className="shop-primary" href="#/">Jelajahi produk</a></div>}
    </section>
  </div>;
}
