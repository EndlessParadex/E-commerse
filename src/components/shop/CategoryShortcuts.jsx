import { categories, categoryHref, searchHref } from '../../data/catalog';
import { products, groupProducts } from '../../data/products';
import { productGallery } from '../../data/productGallery';
import { supplierColorStyle } from '../../data/catalogColors';
import ProductImage from './ProductImage';
import './CategoryShortcuts.css';

const categoryColors = { snack: 'coral', beauty: 'lilac', bumbu: 'amber', rumah: 'mint' };

export default function CategoryShortcuts() {
  if (!categories.length) return null;
  return (
    <section className="home-categories" aria-labelledby="home-categories-title">
      <header className="section-heading">
        <div>
          <span className="section-eyebrow">Mulai dari kebutuhanmu</span>
          <h2 id="home-categories-title">Mau belanja apa?</h2>
        </div>
        <a className="view-all-link" href={searchHref('')}>
          Lihat semua produk <span aria-hidden="true">→</span>
        </a>
      </header>
      <ul className="home-category-grid">
        {categories.map((category) => {
          const items = products.filter((product) => product.categoryId === category.id);
          const featured = items.find((product) =>
            productGallery(product).some((photo) => !photo.demo),
          );
          const photo = featured && productGallery(featured)[0];
          const preview = featured
            ? { ...featured, image: photo.src, imageAlt: photo.alt }
            : { name: category.name, icon: category.icon || '📦' };
          const count = groupProducts(items).length;
          return (
            <li key={category.id}>
              <a className="home-category-card" href={categoryHref(category.id)}>
                <span
                  className="home-category-visual"
                  style={supplierColorStyle(categoryColors[category.id] || featured?.color)}
                  aria-hidden="true"
                >
                  <ProductImage product={preview} variant="shortcut" />
                </span>
                <span className="home-category-copy">
                  <strong>{category.name}</strong>
                  <span>{count ? `${count} produk` : 'Produk belum tersedia'}</span>
                  {category.children?.length > 0 && (
                    <small className="home-category-subcategories">
                      {category.children.slice(0, 2).map((child) => child.name).join(' · ')}
                    </small>
                  )}
                </span>
                <span className="home-category-arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
