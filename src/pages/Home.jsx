import { useMemo, useState } from 'react';
import { useShop } from '../state/useShop';
import { products } from '../data/products';
import './Home.css';
import PromoCarousel from '../components/shop/PromoCarousel';

const categories = ['Semua', 'Snack & Makanan', 'Kosmetik & Beauty', 'Bumbu Masakan', 'Perlengkapan Rumah'];
const categorySidebar = {
  'Snack & Makanan': ['Keripik & Snack', 'Cokelat & Permen', 'Biskuit & Kue Kering', 'Kacang & Buah Kering'],
  'Kosmetik & Beauty': ['Perawatan Wajah', 'Makeup', 'Parfum', 'Perawatan Tubuh'],
  'Bumbu Masakan': ['Rempah Bubuk', 'Saus & Kecap', 'Kaldu', 'Bumbu Siap Pakai'],
  'Perlengkapan Rumah': ['Kebersihan Rumah', 'Perawatan Tubuh', 'Dapur', 'Organisasi Rumah'],
};
const rupiah = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

const Home = ({ initialCategory = 'Semua' }) => {
  const { addItem } = useShop();
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('popular');
  const [addedId, setAddedId] = useState(null);
  const isCategoryPage = initialCategory !== 'Semua';
  const sidebarItems = categorySidebar[category] || [];
  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = products.filter((product) => (category === 'Semua' || product.category === category) && (!normalized || `${product.name} ${product.category}`.toLowerCase().includes(normalized)));
    return [...filtered].sort((a, b) => sort === 'low' ? a.price - b.price : sort === 'high' ? b.price - a.price : b.rating - a.rating);
  }, [category, query, sort]);

  const addProduct = (product) => {
    addItem(product);
    setAddedId(product.id);
    window.setTimeout(() => setAddedId((current) => current === product.id ? null : current), 1600);
  };

  return (
    <div className={`home-container${isCategoryPage ? ' category-page' : ''}`}>
      {!isCategoryPage && <PromoCarousel />}

      <section className="catalog-section" id="catalog" aria-labelledby="catalog-title">
        {!isCategoryPage && <div className="section-heading"><div><span className="section-eyebrow">Pilihan terbaik untukmu</span><h2 id="catalog-title">Produk pilihan</h2></div><a href="#/" className="view-all-link">Lihat semua <span aria-hidden="true">→</span></a></div>}
        {!isCategoryPage && <div className="category-pills" aria-label="Filter kategori">
          {categories.map((item) => <button type="button" key={item} className={category === item ? 'category-pill active' : 'category-pill'} onClick={() => setCategory(item)}>{item}</button>)}
        </div>}
        {isCategoryPage ? <div className="category-layout">
          <aside className="category-filter" aria-label={`Filter ${category}`}>
            <h2>Filter</h2>
            <div className="filter-group"><strong>{category}</strong>{sidebarItems.map((item) => <button type="button" key={item} onClick={() => setQuery(item.split(' & ')[0])}>{item}<span aria-hidden="true">⌄</span></button>)}</div>
          </aside>
          <div className="category-results">
            <div className="category-results-heading"><p>Menampilkan <strong>{visibleProducts.length}</strong> produk untuk <strong>“{category}”</strong></p><label htmlFor="sort-products">Urutkan: <select id="sort-products" value={sort} onChange={(event) => setSort(event.target.value)}><option value="popular">Paling Sesuai</option><option value="low">Harga terendah</option><option value="high">Harga tertinggi</option></select></label></div>
            {visibleProducts.length > 0 ? <div className="product-grid">
              {visibleProducts.map((product) => <article className="product-card" key={product.id}>
                <a className={`product-image ${product.color}`} href={`#/produk/${product.id}`} aria-label={`Lihat detail ${product.name}`}><span className="product-emoji" role="img" aria-label={product.name}>{product.icon}</span>{product.tag && <span className="product-tag">{product.tag}</span>}<span className="favorite-button" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" /></svg></span></a>
                <div className="product-card-body"><p className="product-category">{product.category}</p><h3><a href={`#/produk/${product.id}`}>{product.name}</a></h3><div className="product-rating"><span aria-label={`Rating ${product.rating} dari 5`}>★ {product.rating}</span><span>•</span><span>{product.sold} terjual</span></div><div className="product-price"><strong>{rupiah(product.price)}</strong><del>{rupiah(product.oldPrice)}</del></div><button type="button" className={`add-product-button${addedId === product.id ? ' added' : ''}`} onClick={() => addProduct(product)}>{addedId === product.id ? '✓ Ditambahkan' : '+ Keranjang'}</button></div>
              </article>)}
            </div> : <div className="catalog-empty"><span>🔎</span><h3>Produk tidak ditemukan</h3><p>Coba filter kategori lain.</p><button type="button" onClick={() => setQuery('')}>Reset filter</button></div>}
          </div>
        </div> : <><div className="catalog-toolbar"><p><strong>{visibleProducts.length}</strong> produk ditemukan</p><label htmlFor="sort-products">Urutkan <select id="sort-products" value={sort} onChange={(event) => setSort(event.target.value)}><option value="popular">Paling populer</option><option value="low">Harga terendah</option><option value="high">Harga tertinggi</option></select></label></div>
          {visibleProducts.length > 0 ? <div className="product-grid">
            {visibleProducts.map((product) => <article className="product-card" key={product.id}>
              <a className={`product-image ${product.color}`} href={`#/produk/${product.id}`} aria-label={`Lihat detail ${product.name}`}><span className="product-emoji" role="img" aria-label={product.name}>{product.icon}</span>{product.tag && <span className="product-tag">{product.tag}</span>}<span className="favorite-button" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" /></svg></span></a>
              <div className="product-card-body"><p className="product-category">{product.category}</p><h3><a href={`#/produk/${product.id}`}>{product.name}</a></h3><div className="product-rating"><span aria-label={`Rating ${product.rating} dari 5`}>★ {product.rating}</span><span>•</span><span>{product.sold} terjual</span></div><div className="product-price"><strong>{rupiah(product.price)}</strong><del>{rupiah(product.oldPrice)}</del></div><button type="button" className={`add-product-button${addedId === product.id ? ' added' : ''}`} onClick={() => addProduct(product)}>{addedId === product.id ? '✓ Ditambahkan' : '+ Keranjang'}</button></div>
            </article>)}
          </div> : <div className="catalog-empty"><span>🔎</span><h3>Produk tidak ditemukan</h3><p>Coba kata kunci atau kategori lain.</p><button type="button" onClick={() => { setQuery(''); setCategory('Semua'); }}>Reset filter</button></div>}</>}
      </section>
    </div>
  );
};

export default Home;
