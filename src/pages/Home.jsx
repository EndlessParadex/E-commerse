import { useState } from 'react';
import { useShop } from '../state/useShop';
import { availableBrands, categoryBy, categoryHref, filterCatalogProducts as filterProducts, searchHref } from '../data/catalog';
import ProductCard from '../components/shop/ProductCard';
import PromoCarousel from '../components/shop/PromoCarousel';
import PromotionSection from '../components/shop/PromotionSection';
import SupplierSection from '../components/shop/SupplierSection';
import { suppliers, supplierBy, supplierHref } from '../data/suppliers';
import './Home.css';

export default function Home({ catalog = null }) {
  const { addItem, favoriteIds, toggleFavorite } = useShop();
  const [sort, setSort] = useState('popular');
  const [filterOpen, setFilterOpen] = useState(false);
  const category = categoryBy(catalog?.categoryId);
  const sub = category?.children.find((item) => item.id === catalog?.subcategoryId);
  const searching = catalog?.kind === 'search';
  const query = catalog?.query || '';
  const supplier = supplierBy(catalog?.supplierId);
  const brands = supplier ? availableBrands(supplier.id) : [];
  const brand = brands.find((item) => item.id === catalog?.brandId);
  const brandHref = (brandId = '') => supplierHref(supplier.id, { query, brandId });
  const visible = filterProducts({ categoryId: catalog?.categoryId, subcategoryId: catalog?.subcategoryId, supplierId: supplier?.id, brandId: catalog?.brandId, query, sort });
  const title = supplier ? supplier.name : searching ? (query ? `Hasil pencarian “${query}”` : 'Semua produk') : sub?.name || category?.name || 'Produk pilihan';
  const filterHref = (categoryId = '', subcategoryId = '') => supplier ? supplierHref(supplier.id, { categoryId, subcategoryId, query, brandId: brand?.id }) : searching
    ? `${searchHref(query)}${categoryId ? `&kategori=${encodeURIComponent(categoryId)}` : ''}${subcategoryId ? `&sub=${encodeURIComponent(subcategoryId)}` : ''}`
    : categoryId ? categoryHref(categoryId, subcategoryId) : searchHref('');
  if (!catalog) return <div className="home-container"><PromoCarousel /><PromotionSection /><SupplierSection /></div>;
  return <div className="home-container category-page">
    {catalog && <nav className="shop-breadcrumb" aria-label="Breadcrumb"><a href="#/">Beranda</a><span aria-hidden="true">/</span>
      {supplier ? <><span aria-current={category ? undefined : 'page'}>{supplier.name}</span>{category && <><span aria-hidden="true">/</span><span aria-current="page">{category.name}{sub ? ' / ' + sub.name : ''}</span></>}</> : searching ? <span aria-current="page">Pencarian</span> : <>{sub ? <a href={categoryHref(category.id)}>{category.name}</a> : <span aria-current="page">{category?.name}</span>}{sub && <><span aria-hidden="true">/</span><span aria-current="page">{sub.name}</span></>}</>}
    </nav>}
    <section className="catalog-section" id="catalog" aria-labelledby="catalog-title">
      <div className="section-heading"><div><span className="section-eyebrow">{supplier ? 'Katalog pemasok' : 'Temukan pilihanmu'}</span><h2 id="catalog-title">{title}</h2></div><a href={supplier ? '#/' : searchHref('')} className="view-all-link">{supplier ? 'Mitra pemasok →' : 'Semua produk →'}</a></div>
      {supplier && <p className="supplier-catalog-note">Data pemasok contoh. Produk di halaman ini dikelompokkan berdasarkan {supplier.name}; nama PT dan pembagiannya dapat diganti dengan data toko.</p>}
      <div className={catalog ? 'category-layout' : ''}>
        {catalog && <aside className={`category-filter${filterOpen ? ' is-expanded' : ''}`} aria-label="Filter PT pemasok">
          <h2 className="supplier-filter-desktop-title">Filter pemasok</h2>
          <div className="supplier-filter-mobile-header">
            <button type="button" className="supplier-filter-toggle" aria-expanded={filterOpen} aria-controls="supplier-filter-options" onClick={() => setFilterOpen((open) => !open)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2" fill="white" /><circle cx="15" cy="17" r="2" fill="white" /></svg>
              <span>Filter pemasok</span><span className="supplier-filter-toggle-action">{filterOpen ? 'Tutup' : 'Ubah'}</span>
              <svg className="supplier-filter-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            <div className="supplier-filter-summary"><span>{supplier?.name || 'Semua pemasok'}</span>{brand && <span className="supplier-filter-summary-category">{brand.name}</span>}{category && <span className="supplier-filter-summary-category">{category.name}{sub ? ` · ${sub.name}` : ''}</span>}</div>
            {(supplier || category) && <a className="supplier-filter-reset" href={searchHref(query)}>Hapus semua filter</a>}
          </div>
          <div className="filter-group" id="supplier-filter-options">
          <a className="catalog-filter-link" href={searchHref(query)} aria-current={!supplier && !category ? 'page' : undefined}>Semua pemasok</a>
          {suppliers.map((item) => <div key={item.id} className="catalog-filter-category"><a className="catalog-filter-link supplier-filter-main" href={supplierHref(item.id, { query })} aria-current={supplier?.id === item.id && !category && !brand ? 'page' : undefined}><span className="supplier-filter-initials" aria-hidden="true">{item.initials}</span><span>{item.name}</span><small>{filterProducts({ supplierId: item.id, query }).length}</small></a>
            {supplier?.id === item.id && <div className="supplier-brand-filters"><p className="supplier-filter-step">Merek barang</p>{brands.map((entry) => <div key={entry.id}><a className="catalog-filter-link catalog-filter-sub" href={brandHref(entry.id)} aria-current={brand?.id === entry.id ? 'page' : undefined}>{entry.name}<small>{filterProducts({ supplierId: item.id, brandId: entry.id, query }).length}</small></a></div>)}</div>}

          </div>)}
        </div></aside>}
        <div className="category-results">
          {supplier && <section className="supplier-brand-picker" aria-label="Pilih merek"><p className="supplier-filter-step">Pilih merek</p><div className="supplier-gram-options"><a href={brandHref()} aria-current={!brand ? 'page' : undefined}>Semua merek</a>{brands.map((entry) => <a key={entry.id} href={brandHref(entry.id)} aria-current={brand?.id === entry.id ? 'page' : undefined}>{entry.name}</a>)}</div></section>}

          <div className="catalog-toolbar"><p role="status"><strong>{visible.length}</strong> produk ditemukan{category ? ` di ${category.name}` : ''}</p><label htmlFor="sort-products">Urutkan <select id="sort-products" value={sort} onChange={(event) => setSort(event.target.value)}><option value="popular">Rating tertinggi</option><option value="low">Harga terendah</option><option value="high">Harga tertinggi</option></select></label></div>
          {catalog && (category || sub) && <div className="catalog-active-filters"><span>{category?.name}{sub ? ` / ${sub.name}` : ''}</span><a href={filterHref()}>Hapus filter ×</a></div>}
          {visible.length ? <div className="product-grid">{visible.map((product) => <ProductCard key={product.id} product={product} onAdd={addItem} isFavorite={favoriteIds.includes(product.id)} onToggleFavorite={toggleFavorite} />)}</div> : <div className="catalog-empty"><span aria-hidden="true">🔎</span><h3>Produk tidak ditemukan</h3><p>Coba kata kunci lain atau hapus filter kategori.</p><a className="view-all-link" href={supplier ? supplierHref(supplier.id) : category ? filterHref() : searchHref('')}>{supplier ? 'Lihat semua produk pemasok ini' : category ? 'Hapus filter kategori' : 'Lihat semua produk'}</a></div>}
        </div>
      </div>
    </section>
  </div>;
}
