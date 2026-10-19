import { catalogHref, filterCatalogProducts, filterProducts, searchHref } from '../data/catalog';
import { brandsForSupplier } from '../data/catalogMasters';
import { supplierColorStyle } from '../data/catalogColors';
import { productGallery } from '../data/productGallery';
import ProductImage from '../components/shop/ProductImage';
import './SupplierBrandsPage.css';

export default function SupplierBrandsPage({ supplier, catalog }) {
  const brands = brandsForSupplier(supplier.id);
  const scope = {
    supplierId: supplier.id,
    query: catalog.query || '',
    categoryId: catalog.categoryId || '',
    subcategoryId: catalog.subcategoryId || '',
    sort: catalog.sort || 'popular',
  };
  const filtered = Boolean(scope.query || scope.categoryId || scope.subcategoryId);
  return (
    <div className="home-container category-page supplier-brands-page">
      <nav className="shop-breadcrumb" aria-label="Breadcrumb">
        <a href="#/">Beranda</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{supplier.name}</span>
      </nav>
      <section className="catalog-section" id="catalog" aria-labelledby="supplier-brands-title">
        <header className="section-heading">
          <div>
            <span className="section-eyebrow">Jelajahi merek pemasok</span>
            <h1 id="supplier-brands-title">{supplier.name}</h1>
          </div>
          <a className="view-all-link" href={searchHref('')}>
            Seluruh katalog →
          </a>
        </header>
        <div className="supplier-brands-intro">
          <div>
            <h2>Pilih merek</h2>
            <p>Pilih salah satu merek untuk melihat produknya dari {supplier.name}.</p>
          </div>
          <p className="supplier-brands-count" role="status">
            {brands.length} merek tersedia
          </p>
        </div>
        {filtered && (
          <p className="supplier-brands-filter-note">
            Jumlah produk mengikuti filter yang dipilih
            {scope.query ? ` dan pencarian “${scope.query}”` : ''}.{' '}
            <a href={catalogHref({ supplierId: supplier.id })}>Hapus filter</a>
          </p>
        )}
        {brands.length ? (
          <ul className="supplier-brand-grid" aria-label={'Merek dari ' + supplier.name}>
            {brands.map((brand) => {
              const options = { ...scope, brandId: brand.id };
              const items = filterProducts(options);
              const count = filterCatalogProducts(options).length;
              const featured = items.find((product) =>
                productGallery(product).some((photo) => !photo.demo),
              );
              const photo = featured && productGallery(featured)[0];
              const preview = brand.logo
                ? { name: brand.name, image: brand.logo, imageAlt: `Foto merek ${brand.name}` }
                : featured
                  ? { ...featured, image: photo.src, imageAlt: photo.alt }
                  : { name: brand.name, icon: brand.name.slice(0, 2).toLocaleUpperCase('id') };
              return (
                <li key={brand.id}>
                  <a
                    className="supplier-brand-card"
                    href={catalogHref(options)}
                    data-brand-id={brand.id}
                  >
                    <span
                      className="supplier-brand-visual"
                      style={supplierColorStyle(supplier.color)}
                      aria-hidden="true"
                    >
                      <ProductImage product={preview} variant="brand" />
                    </span>
                    <span className="supplier-brand-copy">
                      <strong>{brand.name}</strong>
                      <span>
                        {count
                          ? `${count} produk`
                          : filtered
                            ? 'Tidak ada produk sesuai filter'
                            : 'Produk belum tersedia'}
                      </span>
                    </span>
                    <span className="supplier-brand-action">
                      Lihat produk <span aria-hidden="true">→</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="catalog-empty">
            <h2>Belum ada merek untuk PT ini</h2>
            <p>Pilihan merek dari PT ini belum tersedia. Silakan pilih PT pemasok lainnya.</p>
            <a className="view-all-link" href="#/">
              Kembali ke daftar PT →
            </a>
          </div>
        )}
      </section>
    </div>
  );
}
