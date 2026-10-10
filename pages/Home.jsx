import { useState } from 'react';
import { useShop } from '../state/useShop';
import { availableBrands, categories, categoryBy, catalogHref, filterCatalogProducts, searchHref } from '../data/catalog';
import ProductCard from '../components/shop/ProductCard';
import PromoCarousel from '../components/shop/PromoCarousel';
import PromotionSection from '../components/shop/PromotionSection';
import SupplierSection from '../components/shop/SupplierSection';
import { suppliers, supplierBy } from '../data/suppliers';
import './Home.css';

export default function Home({ catalog = null }) {
  const { addItem, favoriteIds, toggleFavorite } = useShop();
  const [filterOpen, setFilterOpen] = useState(false);
  if (!catalog) return <div className="home-container"><PromoCarousel /><PromotionSection /><SupplierSection /></div>;
  const category = categoryBy(catalog.categoryId);
  const sub = category?.children.find((item) => item.id === catalog.subcategoryId);
  const query = catalog.query || '';
  const supplier = supplierBy(catalog.supplierId);
  const brands = availableBrands(supplier?.id || '');
  const brand = brands.find((item) => item.id === catalog.brandId);
  const scopes = { query, supplierId: supplier?.id || '', brandId: catalog.brandId || '', categoryId: category?.id || '', subcategoryId: sub?.id || '', sort: ['low', 'high'].includes(catalog.sort) ? catalog.sort : 'popular' };
  const href = (next = {}) => catalogHref({ ...scopes, ...next });
  const setFilter = (next) => { window.location.assign(href(next)); };
  const resetHref = catalogHref({ query, sort: scopes.sort });
  const visible = filterCatalogProducts(scopes);
  const title = query ? `Hasil pencarian “${query}”` : supplier?.name || sub?.name || category?.name || 'Semua produk';
  const count = (next) => filterCatalogProducts({ ...scopes, ...next }).length;
  const chips = [
    ...(supplier ? [{ id: 'supplier', name: supplier.name, next: { supplierId: '' } }] : []),
    ...(category ? [{ id: 'category', name: category.name, next: { categoryId: '', subcategoryId: '' } }] : []),
    ...(sub ? [{ id: 'sub', name: sub.name, next: { subcategoryId: '' } }] : []),
    ...(brand ? [{ id: 'brand', name: brand.name, next: { brandId: '' } }] : []),
  ];
  return <div className="home-container category-page">
    <nav className="shop-breadcrumb" aria-label="Breadcrumb"><a href="#/">Beranda</a><span aria-hidden="true">/</span><span aria-current="page">{title}</span></nav>
    <section className="catalog-section" id="catalog" aria-labelledby="catalog-title">
      <div className="section-heading"><div><span className="section-eyebrow">Temukan pilihanmu</span><h1 id="catalog-title">{title}</h1></div><a href={searchHref('')} className="view-all-link">Seluruh katalog →</a></div>
      <div className="category-layout">
        <aside className={'category-filter' + (filterOpen ? ' is-expanded' : '')} aria-label="Filter produk">
          <h2 className="supplier-filter-desktop-title">Filter produk</h2>
          <div className="supplier-filter-mobile-header"><button type="button" className="supplier-filter-toggle" aria-expanded={filterOpen} aria-controls="catalog-filter-options" onClick={() => setFilterOpen((value) => !value)}><span>Filter produk</span><span className="supplier-filter-toggle-action">{filterOpen ? 'Tutup' : 'Ubah'}</span><span aria-hidden="true">⌄</span></button><div className="supplier-filter-summary">{chips.length ? chips.map((chip) => chip.name).join(' · ') : 'Semua kategori dan pemasok'}</div></div>
          <div className="filter-group" id="catalog-filter-options">
            <label className="catalog-select-filter">Kategori<select value={category?.id || ''} onChange={(event) => setFilter({ categoryId: event.target.value, subcategoryId: '' })}><option value="">Semua kategori</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name} ({count({ categoryId: item.id, subcategoryId: '' })})</option>)}</select></label>
            {category && <label className="catalog-select-filter">Subkategori<select value={sub?.id || ''} onChange={(event) => setFilter({ subcategoryId: event.target.value })}><option value="">Semua subkategori</option>{category.children.map((item) => <option value={item.id} key={item.id}>{item.name} ({count({ subcategoryId: item.id })})</option>)}</select></label>}
            <label className="catalog-select-filter">PT pemasok<select value={supplier?.id || ''} onChange={(event) => { const nextSupplier = event.target.value; const keepBrand = availableBrands(nextSupplier).some((item) => item.id === scopes.brandId); setFilter({ supplierId: nextSupplier, brandId: keepBrand ? scopes.brandId : '' }); }}><option value="">Semua pemasok</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name} ({count({ supplierId: item.id, brandId: '' })})</option>)}</select></label>
            <label className="catalog-select-filter">Merek<select value={brand?.id || ''} onChange={(event) => setFilter({ brandId: event.target.value })}><option value="">Semua merek</option>{brands.map((item) => <option key={item.id} value={item.id}>{item.name} ({count({ brandId: item.id })})</option>)}</select></label>
            <a className="catalog-clear-filters" href={resetHref}>Hapus seluruh filter</a>
          </div>
        </aside>
        <div className="category-results">
          <div className="catalog-toolbar"><p role="status"><strong>{visible.length}</strong> produk ditemukan</p><label>Urutkan<select value={scopes.sort} onChange={(event) => setFilter({ sort: event.target.value })}><option value="popular">Rating tertinggi</option><option value="low">Harga terendah</option><option value="high">Harga tertinggi</option></select></label></div>
          {!!chips.length && <div className="catalog-filter-chips" aria-label="Filter aktif">{chips.map((chip) => <a key={chip.id} href={href(chip.next)} aria-label={'Hapus filter ' + chip.name}>{chip.name}<span aria-hidden="true">×</span></a>)}</div>}
          {visible.length ? <div className="product-grid">{visible.map((product) => <ProductCard key={product.id} product={product} onAdd={addItem} isFavorite={favoriteIds.includes(product.id)} onToggleFavorite={toggleFavorite} />)}</div> : <div className="catalog-empty"><span aria-hidden="true">🔎</span><h2>Produk tidak ditemukan</h2><p>Coba kata kunci lain atau hapus filter yang sedang dipilih.</p><a className="view-all-link" href={resetHref}>Hapus filter →</a><a className="catalog-empty-all" href={searchHref('')}>Lihat seluruh katalog</a></div>}
        </div>
      </div>
    </section>
  </div>;
}
