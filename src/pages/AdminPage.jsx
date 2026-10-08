import { useState } from 'react';
import { suppliers } from '../data/suppliers';
import { adminProducts, adminBrands, filterAdminProducts } from '../data/adminCatalog';
import { rupiah } from '../components/shop/shopPresentation';
import ProductImage from '../components/shop/ProductImage';
import './AdminPage.css';

const metrics = [
  { label: 'Produk utama', value: new Set(adminProducts.map((product) => product.groupId)).size, hint: 'Setiap produk memiliki pilihan ukuran' },
  { label: 'Varian ukuran', value: adminProducts.length, hint: 'Satu baris untuk setiap SKU' },
  { label: 'PT pemasok', value: suppliers.length, hint: 'Pemasok pada katalog contoh' },
  { label: 'Merek', value: adminBrands().length, hint: 'Merek yang tersedia di katalog' },
];

function ProductIdentity({ product }) {
  return <div className="admin-product-identity"><div className={'admin-product-image ' + product.color}><ProductImage product={product} variant="thumbnail" /></div><div><strong>{product.baseName}</strong><small>{product.id}</small></div></div>;
}

export default function AdminPage({ view = 'overview' }) {
  const [query, setQuery] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const brands = adminBrands(supplierId);
  const filtered = filterAdminProducts({ query, supplierId, brandId });
  const hasFilters = Boolean(query || supplierId || brandId);
  const reset = () => { setQuery(''); setSupplierId(''); setBrandId(''); };
  const isProducts = view === 'products';

  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <a className="admin-logo" href="#/admin" aria-label="Dashboard admin BAM">BAM<span>.</span><small>Ruang admin</small></a>
      <button className="admin-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={() => setMenuOpen(!menuOpen)}>Menu admin <span aria-hidden="true">{menuOpen ? '−' : '+'}</span></button>
      <nav id="admin-navigation" className={'admin-navigation' + (menuOpen ? ' is-open' : '')} aria-label="Navigasi admin">
        <a href="#/admin" aria-current={!isProducts ? 'page' : undefined} onClick={() => setMenuOpen(false)}><span aria-hidden="true">▦</span>Ringkasan</a>
        <a href="#/admin/produk" aria-current={isProducts ? 'page' : undefined} onClick={() => setMenuOpen(false)}><span aria-hidden="true">▤</span>Daftar produk</a>
        <a className="admin-store-link" href="#/"><span aria-hidden="true">↗</span>Lihat toko</a>
      </nav>
      <p className="admin-sidebar-caption">CV. Belitung Arta Mandiri</p>
    </aside>
    <div className="admin-content">
      <header className="admin-header"><div><span className="admin-eyebrow">BAM · Pengelolaan katalog</span><h1>{isProducts ? 'Daftar produk' : 'Ringkasan katalog'}</h1><p>{isProducts ? 'Telusuri produk berdasarkan pemasok, merek, dan ukuran.' : 'Gambaran produk dan pemasok dalam katalog BAM.'}</p></div><span className="admin-demo-badge">Pratinjau · Data dummy</span></header>
      <p className="admin-preview-notice">Pratinjau frontend admin. Data mengikuti katalog contoh; pengelolaan akun dan penyimpanan ke server belum terhubung.</p>
      {!isProducts ? <>
        <section className="admin-metrics" aria-label="Ringkasan katalog">{metrics.map((metric) => <article className="admin-metric" key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><p>{metric.hint}</p></article>)}</section>
        <section className="admin-panel"><div className="admin-panel-heading"><div><h2>PT pemasok</h2><p>Sebaran produk utama dan varian pada setiap pemasok.</p></div><a className="admin-primary" href="#/admin/produk">Lihat daftar produk →</a></div><div className="admin-suppliers">{suppliers.map((supplier) => { const items = adminProducts.filter((product) => product.supplier?.id === supplier.id); return <article className="admin-supplier" key={supplier.id}><span className="admin-supplier-avatar" aria-hidden="true">{supplier.initials}</span><div><h3>{supplier.name}</h3><p>{new Set(items.map((product) => product.groupId)).size} produk utama · {items.length} varian ukuran</p></div></article>; })}</div></section>
        <section className="admin-next"><h2>Pengelolaan berikutnya</h2><p>Form tambah dan edit produk, foto, serta ukuran akan ditambahkan pada tahap berikutnya.</p></section>
      </> : <section className="admin-panel">
        <div className="admin-panel-heading"><div><h2>Katalog produk</h2><p>Setiap ukuran ditampilkan sebagai SKU terpisah agar harga tidak tertukar.</p></div><span className="admin-result-pill">{adminProducts.length} SKU</span></div>
        <div className="admin-filters">
          <div className="admin-field admin-search"><label htmlFor="admin-search">Cari produk</label><input id="admin-search" type="search" maxLength={200} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nama, merek, ukuran, atau SKU" /></div>
          <div className="admin-field"><label htmlFor="admin-supplier">PT pemasok</label><select id="admin-supplier" value={supplierId} onChange={(event) => { setSupplierId(event.target.value); setBrandId(''); }}><option value="">Semua pemasok</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div>
          <div className="admin-field"><label htmlFor="admin-brand">Merek</label><select id="admin-brand" value={brandId} onChange={(event) => setBrandId(event.target.value)}><option value="">Semua merek</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></div>
        </div>
        <div className="admin-results"><p role="status">Menampilkan <strong>{filtered.length}</strong> dari {adminProducts.length} varian ukuran</p>{hasFilters && <button type="button" className="admin-text-button" onClick={reset}>Reset filter</button>}</div>
        {filtered.length ? <>
          <div className="admin-table-wrap"><table className="admin-table"><caption className="admin-sr-only">Daftar produk, pemasok, merek, ukuran, dan harga</caption><thead><tr><th scope="col">Produk / SKU</th><th scope="col">PT pemasok</th><th scope="col">Merek</th><th scope="col">Ukuran</th><th scope="col">Harga</th><th scope="col">Tindakan</th></tr></thead><tbody>{filtered.map((product) => <tr key={product.id}><td><ProductIdentity product={product} /></td><td>{product.supplier?.name || 'Belum ditentukan'}</td><td>{product.brand}</td><td><span className="admin-size">{product.sizeLabel}</span></td><td className="admin-price">{rupiah(product.price)}</td><td><a className="admin-view-product" href={'#/produk/' + encodeURIComponent(product.id)} aria-label={`Lihat ${product.baseName} ukuran ${product.sizeLabel} di toko`}>Lihat produk ↗</a></td></tr>)}</tbody></table></div>
          <ul className="admin-mobile-products">{filtered.map((product) => <li key={product.id}><ProductIdentity product={product} /><dl><div><dt>PT pemasok</dt><dd>{product.supplier?.name || 'Belum ditentukan'}</dd></div><div><dt>Merek</dt><dd>{product.brand}</dd></div><div><dt>Ukuran</dt><dd><span className="admin-size">{product.sizeLabel}</span></dd></div><div><dt>Harga</dt><dd className="admin-price">{rupiah(product.price)}</dd></div></dl><a className="admin-view-product" href={'#/produk/' + encodeURIComponent(product.id)} aria-label={`Lihat ${product.baseName} ukuran ${product.sizeLabel} di toko`}>Lihat produk ↗</a></li>)}</ul>
        </> : <div className="admin-empty"><h3>Produk tidak ditemukan</h3><p>Coba kata pencarian lain atau reset filter untuk melihat seluruh produk.</p><button className="admin-primary" type="button" onClick={reset}>Reset filter</button></div>}
      </section>}
    </div>
  </div>;
}
