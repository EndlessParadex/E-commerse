import { useState } from 'react';
import { useShop } from '../state/useShop';
import { availableCategories, categoryBy, categoryHref, filterProducts, searchHref } from '../data/catalog';
import ProductCard from '../components/shop/ProductCard';
import PromoCarousel from '../components/shop/PromoCarousel';
import './Home.css';

export default function Home({ catalog = null }) {
  const { addItem, favoriteIds, toggleFavorite } = useShop();
  const [sort, setSort] = useState('popular');
  const category = categoryBy(catalog?.categoryId);
  const sub = category?.children.find((item) => item.id === catalog?.subcategoryId);
  const searching = catalog?.kind === 'search';
  const query = catalog?.query || '';
  const menu = availableCategories();
  const visible = filterProducts({ categoryId: catalog?.categoryId, subcategoryId: catalog?.subcategoryId, query, sort });
  const title = searching ? (query ? `Hasil pencarian “${query}”` : 'Semua produk') : sub?.name || category?.name || 'Produk pilihan';
  const filterHref = (categoryId = '', subcategoryId = '') => searching
    ? `${searchHref(query)}${categoryId ? `&kategori=${encodeURIComponent(categoryId)}` : ''}${subcategoryId ? `&sub=${encodeURIComponent(subcategoryId)}` : ''}`
    : categoryHref(categoryId, subcategoryId);
  return <div className={catalog ? 'home-container category-page' : 'home-container'}>
    {!catalog && <PromoCarousel />}
    {catalog && <nav className="shop-breadcrumb" aria-label="Breadcrumb"><a href="#/">Beranda</a><span aria-hidden="true">/</span>
      {searching ? <span aria-current="page">Pencarian</span> : <>{sub ? <a href={categoryHref(category.id)}>{category.name}</a> : <span aria-current="page">{category?.name}</span>}{sub && <><span aria-hidden="true">/</span><span aria-current="page">{sub.name}</span></>}</>}
    </nav>}
    <section className="catalog-section" id="catalog" aria-labelledby="catalog-title">
      <div className="section-heading"><div><span className="section-eyebrow">{catalog ? 'Temukan pilihanmu' : 'Pilihan terbaik untukmu'}</span><h2 id="catalog-title">{title}</h2></div>{catalog ? <a href="#/" className="view-all-link">Semua produk →</a> : <div className="heading-actions"><a href="#/favorit" className="view-all-link">♡ Favorit saya</a><a href="#/" className="view-all-link">Lihat semua →</a></div>}</div>
      {!catalog && <div className="category-pills" aria-label="Kategori"><a href="#/" className="category-pill active" aria-current="page">Semua</a>{menu.map((item) => <a className="category-pill" key={item.id} href={categoryHref(item.id)}>{item.name}</a>)}</div>}
      <div className={catalog ? 'category-layout' : ''}>
        {catalog && <aside className="category-filter" aria-label="Filter kategori"><h2>Filter kategori</h2><div className="filter-group">
          <a className="catalog-filter-link" href={filterHref()} aria-current={!category ? 'page' : undefined}>Semua kategori</a>
          {menu.map((item) => <div key={item.id} className="catalog-filter-category"><a className="catalog-filter-link" href={filterHref(item.id)} aria-current={category?.id === item.id && !sub ? 'page' : undefined}>{item.icon} {item.name}<small>{filterProducts({ categoryId: item.id, query }).length}</small></a>
            {(category?.id === item.id || !category) && item.children.map((child) => <a className="catalog-filter-link catalog-filter-sub" key={child.id} href={filterHref(item.id, child.id)} aria-current={category?.id === item.id && sub?.id === child.id ? 'page' : undefined}>{child.name}<small>{filterProducts({ categoryId: item.id, subcategoryId: child.id, query }).length}</small></a>)}
          </div>)}
        </div></aside>}
        <div className="category-results">
          <div className="catalog-toolbar"><p role="status"><strong>{visible.length}</strong> produk ditemukan{category ? ` di ${category.name}` : ''}</p><label htmlFor="sort-products">Urutkan <select id="sort-products" value={sort} onChange={(event) => setSort(event.target.value)}><option value="popular">Rating tertinggi</option><option value="low">Harga terendah</option><option value="high">Harga tertinggi</option></select></label></div>
          {catalog && (category || sub) && <div className="catalog-active-filters"><span>{category?.name}{sub ? ` / ${sub.name}` : ''}</span><a href={filterHref()}>Hapus filter ×</a></div>}
          {visible.length ? <div className="product-grid">{visible.map((product) => <ProductCard key={product.id} product={product} onAdd={addItem} isFavorite={favoriteIds.includes(product.id)} onToggleFavorite={toggleFavorite} />)}</div> : <div className="catalog-empty"><span aria-hidden="true">🔎</span><h3>Produk tidak ditemukan</h3><p>Coba kata kunci lain atau hapus filter kategori.</p><a className="view-all-link" href={category ? filterHref() : '#/'}>{category ? 'Hapus filter kategori' : 'Lihat semua produk'}</a></div>}
        </div>
      </div>
    </section>
  </div>;
}
