import { useState } from 'react';
import { useShop } from '../state/useShop';
import {
  availableBrands,
  categories,
  categoryBy,
  catalogHref,
  filterCatalogProducts,
  searchHref,
} from '../data/catalog';
import ProductCard from '../components/shop/ProductCard';
import PromoCarousel from '../components/shop/PromoCarousel';
import VerticalPromoPanel from '../components/shop/VerticalPromoPanel';
import PromotionSection from '../components/shop/PromotionSection';
import SupplierSection from '../components/shop/SupplierSection';
import CategoryShortcuts from '../components/shop/CategoryShortcuts';
import FeaturedProducts from '../components/shop/FeaturedProducts';
import B2BHomeExperience from '../components/shop/B2BHomeExperience';
import CatalogSearchDropdown from '../components/shop/CatalogSearchDropdown';
import SupplierBrandsPage from './SupplierBrandsPage';
import { brandsForSupplier } from '../data/catalogMasters';
import { suppliers, supplierBy } from '../data/suppliers';
import './Home.css';
import './StorefrontDesign2.css';
import './StorefrontFeatureRail.css';

export default function Home({ catalog = null }) {
  const { addItem, favoriteIds, toggleFavorite, shared, setCartMode } = useShop();
  const b2bHome =
    !catalog && shared?.status === 'ready' && ['sales', 'buyer'].includes(shared.role);
  const buyerDashboard = b2bHome && shared.role === 'buyer';
  const [filterOpen, setFilterOpen] = useState(false);
  const [storeDirectory, setStoreDirectory] = useState(false);
  if (!catalog && shared?.enabled && shared.status === 'loading')
    return (
      <div className="home-container" role="status">
        Memuat pilihan belanja akun…
      </div>
    );
  if (!catalog && shared?.enabled && shared.status === 'error')
    return (
      <div className="home-container" role="alert">
        <h1>Data toko belum dapat dimuat</h1>
        <p>{shared.error || 'Periksa koneksi server dan coba lagi.'}</p>
        <button type="button" className="shop-primary" onClick={shared.retry}>
          Coba lagi
        </button>
      </div>
    );
  if (!catalog)
    return (
      <div
        className={
          'home-container home-landing' +
          (b2bHome ? ' home-landing--role' : '') +
          (buyerDashboard ? ' home-landing--buyer-dashboard' : '') +
          (storeDirectory && b2bHome && shared?.role === 'sales' ? ' is-store-directory' : '')
        }
      >
        {buyerDashboard ? (
          <B2BHomeExperience shared={shared} onCartMode={setCartMode} />
        ) : (
          <>
            <div className="home-feature-rail" aria-label="Banner dan pilihan promo BAM">
              {b2bHome ? (
                <B2BHomeExperience
                  shared={shared}
                  onCartMode={setCartMode}
                  onDirectoryChange={setStoreDirectory}
                />
              ) : (
                <PromoCarousel />
              )}
              <VerticalPromoPanel />
            </div>
            <div className="home-discovery-row" aria-label="Kategori dan mitra pemasok BAM">
              <CategoryShortcuts />
              <SupplierSection />
            </div>
            <PromotionSection />
            <FeaturedProducts />
          </>
        )}
      </div>
    );
  const category = categoryBy(catalog.categoryId);
  const sub = category?.children.find((item) => item.id === catalog.subcategoryId);
  const query = catalog.query || '';
  const supplier = supplierBy(catalog.supplierId);
  if (supplier && !catalog.brandId)
    return <SupplierBrandsPage supplier={supplier} catalog={catalog} />;
  const brands = supplier ? brandsForSupplier(supplier.id) : availableBrands('');
  const brand = brands.find((item) => item.id === catalog.brandId);
  const scopes = {
    query,
    supplierId: supplier?.id || '',
    brandId: catalog.brandId || '',
    categoryId: category?.id || '',
    subcategoryId: sub?.id || '',
    sort: ['low', 'high'].includes(catalog.sort) ? catalog.sort : 'popular',
  };
  const href = (next = {}) => catalogHref({ ...scopes, ...next });
  const setFilter = (next) => {
    window.location.assign(href(next));
  };
  const resetHref = catalogHref({ query, sort: scopes.sort });
  const visible = filterCatalogProducts(scopes);
  const title = query
    ? `Hasil pencarian “${query}”`
    : brand?.name || supplier?.name || sub?.name || category?.name || 'Semua produk';
  const count = (next) => filterCatalogProducts({ ...scopes, ...next }).length;
  const chips = [
    ...(supplier ? [{ id: 'supplier', name: supplier.name, next: { supplierId: '' } }] : []),
    ...(category
      ? [{ id: 'category', name: category.name, next: { categoryId: '', subcategoryId: '' } }]
      : []),
    ...(sub ? [{ id: 'sub', name: sub.name, next: { subcategoryId: '' } }] : []),
    ...(brand ? [{ id: 'brand', name: brand.name, next: { brandId: '' } }] : []),
  ];
  return (
    <div className="home-container category-page">
      <nav className="shop-breadcrumb" aria-label="Breadcrumb">
        <a href="#/">Beranda</a>
        <span aria-hidden="true">/</span>
        {supplier && catalog.brandId && (
          <>
            <a href={href({ brandId: '' })}>{supplier.name}</a>
            <span aria-hidden="true">/</span>
          </>
        )}
        <span aria-current="page">{title}</span>
      </nav>
      <section className="catalog-section" id="catalog" aria-labelledby="catalog-title">
        {supplier && catalog.brandId && (
          <a className="supplier-back-to-brands" href={href({ brandId: '' })}>
            ← Kembali ke merek {supplier.name}
          </a>
        )}
        <div className="store-category-intro">
          <div className="store-category-intro-copy">
            <span className="section-eyebrow">Katalog BAM / Belanja sesuai kebutuhan</span>
            <h1 id="catalog-title">{title}</h1>
            <p>
              {visible.length
                ? 'Temukan pilihan produk, ukuran, dan kemasan dari katalog BAM.'
                : 'Coba pilih kategori atau hapus filter untuk menemukan produk lainnya.'}
            </p>
            <span className="store-category-intro-count">{visible.length} produk ditampilkan</span>
          </div>
          <div className="store-category-intro-symbol" aria-hidden="true">
            <span>{category?.icon || '✦'}</span>
            <span>BAM.</span>
          </div>
        </div>
        {category && category.children.length > 0 && (
          <nav className="store-subcategory-nav" aria-label={'Subkategori ' + category.name}>
            <a
              className={!sub ? 'is-current' : ''}
              aria-current={!sub ? 'page' : undefined}
              href={href({ subcategoryId: '' })}
            >
              Semua {category.name}
            </a>
            {category.children.map((item) => (
              <a
                key={item.id}
                className={sub?.id === item.id ? 'is-current' : ''}
                aria-current={sub?.id === item.id ? 'page' : undefined}
                href={href({ subcategoryId: item.id })}
              >
                {item.name}
              </a>
            ))}
          </nav>
        )}
        <div className="category-layout">
          <aside
            className={'category-filter' + (filterOpen ? ' is-expanded' : '')}
            aria-label="Filter produk"
          >
            <h2 className="supplier-filter-desktop-title">Filter produk</h2>
            <div className="supplier-filter-mobile-header">
              <button
                type="button"
                className="supplier-filter-toggle"
                aria-expanded={filterOpen}
                aria-controls="catalog-filter-options"
                onClick={() => setFilterOpen((value) => !value)}
              >
                <span>Filter & Urutkan</span>
                <span className="supplier-filter-toggle-action">
                  {filterOpen ? 'Tutup' : 'Ubah'}
                </span>
                <span aria-hidden="true">⌄</span>
              </button>
              <div className="supplier-filter-summary">
                {chips.length
                  ? chips.map((chip) => chip.name).join(' · ')
                  : 'Semua kategori dan pemasok'}
              </div>
            </div>
            <div className="filter-group" id="catalog-filter-options">
              <CatalogSearchDropdown
                label="Kategori"
                value={category?.id || ''}
                placeholder="Cari kategori..."
                options={[
                  {
                    id: '',
                    name: 'Semua kategori',
                    icon: '▦',
                    count: count({ categoryId: '', subcategoryId: '' }),
                  },
                  ...categories.map((item) => ({
                    id: item.id,
                    name: item.name,
                    icon: item.icon,
                    count: count({ categoryId: item.id, subcategoryId: '' }),
                  })),
                ]}
                onChange={(categoryId) => setFilter({ categoryId, subcategoryId: '' })}
              />
              {category && (
                <CatalogSearchDropdown
                  label="Subkategori"
                  value={sub?.id || ''}
                  placeholder="Cari subkategori..."
                  options={[
                    {
                      id: '',
                      name: 'Semua subkategori',
                      icon: '▦',
                      count: count({ subcategoryId: '' }),
                    },
                    ...category.children.map((item) => ({
                      id: item.id,
                      name: item.name,
                      icon: category.icon,
                      count: count({ subcategoryId: item.id }),
                    })),
                  ]}
                  onChange={(subcategoryId) => setFilter({ subcategoryId })}
                />
              )}
              <CatalogSearchDropdown
                label="PT pemasok"
                value={supplier?.id || ''}
                placeholder="Cari pemasok..."
                options={[
                  {
                    id: '',
                    name: 'Semua pemasok',
                    icon: '▦',
                    count: count({ supplierId: '', brandId: '' }),
                  },
                  ...suppliers.map((item) => ({
                    id: item.id,
                    name: item.name,
                    icon: '▣',
                    count: count({ supplierId: item.id, brandId: '' }),
                  })),
                ]}
                onChange={(nextSupplier) => {
                  const keepBrand = availableBrands(nextSupplier).some(
                    (item) => item.id === scopes.brandId,
                  );
                  setFilter({
                    supplierId: nextSupplier,
                    brandId: keepBrand ? scopes.brandId : '',
                  });
                }}
              />
              <CatalogSearchDropdown
                label="Merek"
                value={brand?.id || ''}
                placeholder="Cari merek..."
                options={[
                  { id: '', name: 'Semua merek', icon: '✦', count: count({ brandId: '' }) },
                  ...brands.map((item) => ({
                    id: item.id,
                    name: item.name,
                    icon: item.name.slice(0, 2).toUpperCase(),
                    count: count({ brandId: item.id }),
                  })),
                ]}
                onChange={(brandId) => setFilter({ brandId })}
              />
              <a className="catalog-clear-filters" href={resetHref}>
                Hapus seluruh filter
              </a>
            </div>
          </aside>
          <div className="category-results">
            <div className="catalog-toolbar">
              <p role="status">
                <strong>{visible.length}</strong> produk ditemukan
              </p>
              <CatalogSearchDropdown
                label="Urutkan"
                value={scopes.sort}
                compact
                searchable={false}
                showCounts={false}
                options={[
                  { id: 'popular', name: 'Pilihan katalog', icon: '✦' },
                  { id: 'low', name: 'Harga terendah', icon: '↑' },
                  { id: 'high', name: 'Harga tertinggi', icon: '↓' },
                ]}
                onChange={(sort) => setFilter({ sort })}
              />
            </div>
            {!!chips.length && (
              <div className="catalog-filter-chips" aria-label="Filter aktif">
                {chips.map((chip) => (
                  <a key={chip.id} href={href(chip.next)} aria-label={'Hapus filter ' + chip.name}>
                    {chip.name}
                    <span aria-hidden="true">×</span>
                  </a>
                ))}
              </div>
            )}
            {visible.length ? (
              <div className="product-grid">
                {visible.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAdd={addItem}
                    isFavorite={favoriteIds.includes(product.id)}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
            ) : (
              <div className="catalog-empty">
                <span aria-hidden="true">🔎</span>
                <h2>Produk tidak ditemukan</h2>
                <p>Coba kata kunci lain atau hapus filter yang sedang dipilih.</p>
                <a className="view-all-link" href={resetHref}>
                  Hapus filter →
                </a>
                <a className="catalog-empty-all" href={searchHref('')}>
                  Lihat seluruh katalog
                </a>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
