import { useRef, useState } from 'react';
import { suppliers } from '../data/suppliers';
import { adminProducts, adminBrands, filterAdminProducts } from '../data/adminCatalog';
import { rupiah } from '../components/shop/shopPresentation';
import ProductImage from '../components/shop/ProductImage';
import './AdminPage.css';
import AdminProductForm from './AdminProductForm';
import { catalogLoadError, catalogUsesServer, pendingLocalImport, importLocalCatalog, deleteProduct } from '../data/adminStore';
import { brands as managedBrands } from '../data/catalogMasters';
import AdminMasterPage from './AdminMasterPage';
import useUnsavedChanges from '../state/useUnsavedChanges';
import { packagingLabel } from '../data/productPackaging';
import { productColorStyle, supplierColorStyle, avatarColorStyle } from '../data/catalogColors';
import AdminOrdersPage from './AdminOrdersPage';
import AdminStockPage from './AdminStockPage';
import { approveNextRoute } from '../state/routeGuards';

const getMetrics = () => [
  { label: 'Produk utama', value: new Set(adminProducts.map((product) => product.groupId)).size, hint: 'Setiap produk memiliki pilihan ukuran' },
  { label: 'Varian produk', value: adminProducts.length, hint: 'Satu baris untuk setiap SKU' },
  { label: 'PT pemasok', value: suppliers.length, hint: 'PT pemasok yang sudah terdaftar' },
  { label: 'Merek', value: managedBrands.length, hint: 'Merek yang sudah terdaftar' },
];

function ProductIdentity({ product }) {
  return <div className="admin-product-identity"><div className={'admin-product-image ' + product.color} style={productColorStyle(product.color)}><ProductImage product={product} variant="thumbnail" /></div><div><strong>{product.baseName}</strong><small>{product.id}</small></div></div>;
}

export default function AdminPage({ view = 'overview' }) {
  const [query, setQuery] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [editor, setEditor] = useState(null);
  const [notice, setNotice] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [deleting, setDeleting] = useState('');
  const [deleteError, setDeleteError] = useState(''); const deletePending = useRef(false);
  useUnsavedChanges(false, undefined, Boolean(deleting || importing));
  const removeProduct = async (product) => {
    if (deletePending.current) return;
    const count = adminProducts.filter((entry) => entry.groupId === product.groupId).length;
    if (!window.confirm(`Hapus produk "${product.baseName}" beserta seluruh ${count} SKU? Produk akan hilang dari katalog toko. Riwayat pesanan yang sudah dibuat tetap tersedia.`)) return;
    deletePending.current = true; setDeleting(product.groupId); setDeleteError(''); setNotice('');
    try {
      const result = await deleteProduct(product.groupId);
      if (result.storageError) setDeleteError(result.storageError);
      else setNotice(`Produk ${product.baseName} beserta ${count} SKU berhasil dihapus.`);
    } finally { deletePending.current = false; setDeleting(''); }
  };
  const importPreview = async () => {
    if (importing) return;
    setImporting(true); setImportError('');
    const result = await importLocalCatalog();
    setImporting(false);
    if (result.storageError) setImportError(result.storageError);
    else setNotice('Data pratinjau berhasil diimpor ke database.');
  };
  const metrics = getMetrics();
  const brands = adminBrands(supplierId);
  const filtered = filterAdminProducts({ query, supplierId, brandId });
  const hasFilters = Boolean(query || supplierId || brandId);
  const reset = () => { setQuery(''); setSupplierId(''); setBrandId(''); };
  const isProducts = view === 'products';
  const masterType = { suppliers: 'suppliers', brands: 'brands', categories: 'categories' }[view];
  const workflowView = view === 'orders' || view === 'stock';
  const pageTitle = { overview: 'Ringkasan katalog', products: 'Daftar produk', suppliers: 'PT pemasok', brands: 'Merek', categories: 'Kategori & subkategori', orders: 'Pesanan toko', stock: 'Stok produk' }[view];
  // The form's capture listener confirms unsaved changes before this handler runs.
  // Close explicitly even when the selected link points to the current hash.
  const leaveEditor = () => { setEditor(null); setMenuOpen(false); };
  const startEdit = (groupId = '') => { setEditor({ groupId }); setNotice(''); setDeleteError(''); window.scrollTo(0, 0); };
  const finishEdit = (groupId) => {
    approveNextRoute('/admin/produk');
    setEditor(null); reset();
    setNotice(`Produk berhasil disimpan ${catalogUsesServer ? 'ke database' : 'di browser ini'}. ${adminProducts.find((product) => product.groupId === groupId)?.baseName || ''}`);
    window.location.hash = '/admin/produk';
    window.scrollTo(0, 0);
  };
  const actions = (product) => <div className="admin-row-actions"><button type="button" className="admin-text-button" disabled={Boolean(deleting)} onClick={() => startEdit(product.groupId)} aria-label={`Edit ${product.baseName} ukuran ${product.sizeLabel}${packagingLabel(product) === 'Satuan' ? '' : ` · ${packagingLabel(product)}`}`}>Edit produk</button><button type="button" className="admin-danger" disabled={Boolean(deleting)} onClick={() => removeProduct(product)} aria-label={`Hapus produk ${product.baseName} beserta semua SKU`}>{deleting === product.groupId ? 'Menghapus…' : 'Hapus produk'}</button><a className="admin-view-product" href={'#/produk/' + encodeURIComponent(product.id)} aria-label={`Lihat ${product.baseName} ukuran ${product.sizeLabel}${packagingLabel(product) === 'Satuan' ? '' : ` · ${packagingLabel(product)}`} di toko`}>Lihat produk ↗</a></div>;

  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <a className="admin-logo" href="#/admin" aria-label="Dashboard admin BAM" onClick={leaveEditor}>BAM<span>.</span><small>Ruang admin</small></a>
      <button className="admin-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={() => setMenuOpen(!menuOpen)}>Menu admin <span aria-hidden="true">{menuOpen ? '−' : '+'}</span></button>
      <nav id="admin-navigation" className={'admin-navigation' + (menuOpen ? ' is-open' : '')} aria-label="Navigasi admin">
        <a href="#/admin" aria-current={view === 'overview' ? 'page' : undefined} onClick={leaveEditor}><span aria-hidden="true">▦</span>Ringkasan</a>
        <a href="#/admin/produk" aria-current={isProducts ? 'page' : undefined} onClick={leaveEditor}><span aria-hidden="true">▤</span>Daftar produk</a>
        <a href="#/admin/pesanan" aria-current={view === 'orders' ? 'page' : undefined} onClick={leaveEditor}><span aria-hidden="true">▧</span>Pesanan</a>
        <a href="#/admin/stok" aria-current={view === 'stock' ? 'page' : undefined} onClick={leaveEditor}><span aria-hidden="true">▥</span>Stok</a>
        <a href="#/admin/pemasok" aria-current={view === 'suppliers' ? 'page' : undefined} onClick={leaveEditor}><span aria-hidden="true">▣</span>PT pemasok</a>
        <a href="#/admin/merek" aria-current={view === 'brands' ? 'page' : undefined} onClick={leaveEditor}><span aria-hidden="true">◇</span>Merek</a>
        <a href="#/admin/kategori" aria-current={view === 'categories' ? 'page' : undefined} onClick={leaveEditor}><span aria-hidden="true">≡</span>Kategori</a>
        <a className="admin-store-link" href="#/" onClick={leaveEditor}><span aria-hidden="true">↗</span>Lihat toko</a>
      </nav>
      <p className="admin-sidebar-caption">CV. Belitung Arta Mandiri</p>
    </aside>
    <div className="admin-content">
      <header className="admin-header"><div><span className="admin-eyebrow">BAM · Pengelolaan katalog</span><h1>{pageTitle}</h1><p>{workflowView ? 'Kelola alur pesanan dan persediaan pada pratinjau frontend.' : isProducts ? 'Telusuri produk berdasarkan pemasok, merek, dan ukuran.' : 'Gambaran produk dan pemasok dalam katalog BAM.'}</p></div><span className="admin-demo-badge">{workflowView ? 'Pratinjau · Simulasi' : catalogUsesServer ? 'Katalog · Database' : 'Pratinjau · Data dummy'}</span></header>
      <p className="admin-preview-notice">{workflowView ? 'Pesanan, stok, pembayaran, dan pengiriman pada halaman ini masih pratinjau frontend. Katalog menggunakan penyimpanan yang sudah tersedia.' : catalogUsesServer ? 'Katalog tersimpan di database. Perubahan yang berhasil disimpan tersedia bagi pengunjung toko setelah halaman dimuat ulang.' : 'Pratinjau katalog. Perubahan produk disimpan di browser ini dan terlihat di toko pada browser yang sama. Data belum tersimpan ke server.'}</p>
      {pendingLocalImport && view === 'overview' && !editor && <section className="admin-next"><h2>Data pratinjau sebelumnya ditemukan</h2><p>Database masih berisi katalog awal. Anda dapat mengimpor katalog dari browser ini, termasuk foto dan produk uji. Salinan di browser tetap tersimpan.</p><button className="admin-primary" type="button" disabled={importing} onClick={importPreview}>{importing ? 'Mengimpor…' : 'Impor katalog dari browser'}</button></section>}
      {importError && <p className="admin-form-alert" role="alert">{importError}</p>}
      {deleteError && <p className="admin-form-alert" role="alert">{deleteError}</p>}
      {catalogLoadError && <p className="admin-form-alert" role="alert">{catalogLoadError}</p>}
      {notice && <p className="admin-save-notice" role="status">✓ {notice}</p>}
      {editor ? <AdminProductForm key={editor.groupId || 'new'} groupId={editor.groupId} onNavigate={leaveEditor} onClose={() => { leaveEditor(); window.location.hash = '/admin/produk'; }} onSaved={finishEdit} /> : view === 'orders' ? <AdminOrdersPage /> : view === 'stock' ? <AdminStockPage /> : masterType ? <AdminMasterPage key={masterType} type={masterType} /> : !isProducts ? <>
        <section className="admin-metrics" aria-label="Ringkasan katalog">{metrics.map((metric) => <article className="admin-metric" key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><p>{metric.hint}</p></article>)}</section>
        <section className="admin-panel"><div className="admin-panel-heading"><div><h2>PT pemasok</h2><p>Sebaran produk utama dan varian pada setiap pemasok.</p></div><a className="admin-primary" href="#/admin/pemasok">Kelola PT pemasok →</a></div><div className="admin-suppliers">{suppliers.map((supplier) => { const items = adminProducts.filter((product) => product.supplier?.id === supplier.id); return <article className="admin-supplier" key={supplier.id} style={supplierColorStyle(supplier.color)}><span className="admin-supplier-avatar" style={avatarColorStyle(supplier.color)} aria-hidden="true">{supplier.initials}</span><div><h3>{supplier.name}</h3><p>{new Set(items.map((product) => product.groupId)).size} produk utama · {items.length} varian produk</p></div></article>; })}</div></section>
        <section className="admin-next"><h2>Kelola katalog produk</h2><p>Tambahkan produk baru atau perbarui foto, informasi, dan harga setiap ukuran.</p><button type="button" className="admin-primary" disabled={Boolean(deleting || importing)} onClick={() => startEdit()}>+ Tambah produk</button></section>
      </> : <section className="admin-panel">
        <div className="admin-panel-heading"><div><h2>Katalog produk</h2><p>Setiap kombinasi ukuran dan kemasan ditampilkan sebagai SKU terpisah. Hapus produk menghapus seluruh SKU produk tersebut.</p></div><div className="admin-heading-actions"><span className="admin-result-pill">{adminProducts.length} SKU</span><button type="button" className="admin-primary" disabled={Boolean(deleting || importing)} onClick={() => startEdit()}>+ Tambah produk</button></div></div>
        <div className="admin-filters">
          <div className="admin-field admin-search"><label htmlFor="admin-search">Cari produk</label><input id="admin-search" type="search" maxLength={200} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nama, merek, ukuran, atau SKU" /></div>
          <div className="admin-field"><label htmlFor="admin-supplier">PT pemasok</label><select id="admin-supplier" value={supplierId} onChange={(event) => { setSupplierId(event.target.value); setBrandId(''); }}><option value="">Semua pemasok</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div>
          <div className="admin-field"><label htmlFor="admin-brand">Merek</label><select id="admin-brand" value={brandId} onChange={(event) => setBrandId(event.target.value)}><option value="">Semua merek</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></div>
        </div>
        <div className="admin-results"><p role="status">Menampilkan <strong>{filtered.length}</strong> dari {adminProducts.length} varian produk</p>{hasFilters && <button type="button" className="admin-text-button" onClick={reset}>Reset filter</button>}</div>
        {filtered.length ? <>
          <div className="admin-table-wrap"><table className="admin-table"><caption className="admin-sr-only">Daftar produk, pemasok, merek, ukuran, dan harga</caption><thead><tr><th scope="col">Produk / SKU</th><th scope="col">PT pemasok</th><th scope="col">Merek</th><th scope="col">Ukuran / kemasan</th><th scope="col">Harga</th><th scope="col">Tindakan</th></tr></thead><tbody>{filtered.map((product) => <tr key={product.id}><td><ProductIdentity product={product} /></td><td>{product.supplier?.name || 'Belum ditentukan'}</td><td>{product.brand}</td><td><span className="admin-size">{product.sizeLabel}</span><small className="admin-packaging">{packagingLabel(product)}</small></td><td className="admin-price">{rupiah(product.price)}</td><td>{actions(product)}</td></tr>)}</tbody></table></div>
          <ul className="admin-mobile-products">{filtered.map((product) => <li key={product.id}><ProductIdentity product={product} /><dl><div><dt>PT pemasok</dt><dd>{product.supplier?.name || 'Belum ditentukan'}</dd></div><div><dt>Merek</dt><dd>{product.brand}</dd></div><div><dt>Ukuran / kemasan</dt><dd><span className="admin-size">{product.sizeLabel}</span><small className="admin-packaging">{packagingLabel(product)}</small></dd></div><div><dt>Harga</dt><dd className="admin-price">{rupiah(product.price)}</dd></div></dl>{actions(product)}</li>)}</ul>
        </> : <div className="admin-empty"><h3>Produk tidak ditemukan</h3><p>Coba kata pencarian lain atau reset filter untuk melihat seluruh produk.</p><button className="admin-primary" type="button" onClick={reset}>Reset filter</button></div>}
      </section>}
    </div>
  </div>;
}
