import useCompany from '../state/useCompany';
import { useContext, useRef, useState } from 'react';
import { DeliveryContext } from '../state/useDelivery';
import AdminEmailPage from './AdminEmailPage';
import AdminAccountsPage from './AdminAccountsPage';
import AdminApprovalsPage from './AdminApprovalsPage';
import AdminB2BStoresPage from './AdminB2BStoresPage';
import SharedCartPage from '../components/shop/SharedCartPage';
import { suppliers } from '../data/suppliers';
import { adminProducts, adminBrands, filterAdminProducts } from '../data/adminCatalog';
import { rupiah } from '../components/shop/shopPresentation';
import ProductImage from '../components/shop/ProductImage';
import AdminIcon from '../components/admin/AdminIcon';
import AdminSectionIcon from '../components/admin/AdminSectionIcon';
import AdminPageGuide from '../components/admin/AdminPageGuide';
import { paginateAdminList } from '../data/adminPagination';
import AdminProductFilters from '../components/admin/AdminProductFilters';
import AdminProductForm from './AdminProductForm';
import {
  catalogLoadError,
  catalogUsesServer,
  workflowUsesServer,
  pendingLocalImport,
  importLocalCatalog,
  deleteProduct,
} from '../data/adminStore';
import { brands as managedBrands } from '../data/catalogMasters';
import AdminMasterPage from './AdminMasterPage';
import useUnsavedChanges from '../state/useUnsavedChanges';
import { packagingLabel } from '../data/productPackaging';
import { productColorStyle, supplierColorStyle, avatarColorStyle } from '../data/catalogColors';
import AdminOrdersPage from './AdminOrdersPage';
import AdminCompanyPage from './AdminCompanyPage';
import CompanyBrand from '../components/layout/CompanyBrand';
import AdminStockPage from './AdminStockPage';
import AdminOpsOverview from './AdminOpsOverview';
import useAdminWorkCounts from './useAdminWorkCounts';
import { approveNextRoute } from '../state/routeGuards';
// Load the final shared layer after every admin view's styles.
import './AdminPage.css';
import './AdminDesign2.css';
import './AdminUnifiedUI.css';

const getMetrics = () => [
  {
    label: 'Produk utama',
    icon: 'products',
    value: new Set(adminProducts.map((product) => product.groupId)).size,
    hint: 'Setiap produk memiliki pilihan ukuran',
  },
  {
    label: 'Varian produk',
    icon: 'stock',
    value: adminProducts.length,
    hint: 'Satu baris untuk setiap SKU',
  },
  {
    label: 'PT pemasok',
    icon: 'suppliers',
    value: suppliers.length,
    hint: 'PT pemasok yang sudah terdaftar',
  },
  {
    label: 'Merek',
    icon: 'brands',
    value: managedBrands.length,
    hint: 'Merek yang sudah terdaftar',
  },
];

const navigationGroups = [
  {
    id: 'daily',
    label: 'Utama',
    items: [
      { view: 'overview', label: 'Dashboard', href: '#/admin' },
      { view: 'orders', label: 'Pesanan', href: '#/admin/pesanan' },
      { view: 'stock', label: 'Stok', href: '#/admin/stok' },
    ],
  },
  {
    id: 'catalog',
    label: 'Katalog',
    items: [
      { view: 'products', label: 'Daftar produk', href: '#/admin/produk' },
      { view: 'suppliers', label: 'PT pemasok', href: '#/admin/pemasok' },
      { view: 'brands', label: 'Merek', href: '#/admin/merek' },
      { view: 'categories', label: 'Kategori', href: '#/admin/kategori' },
    ],
  },
  {
    id: 'b2b',
    label: 'B2B',
    items: [
      { view: 'b2bStores', label: 'Toko & Sales', href: '#/admin/toko-sales' },
      { view: 'sharedCarts', label: 'Keranjang bersama', href: '#/admin/keranjang' },
    ],
  },
  {
    id: 'settings',
    label: 'Pengaturan',
    items: [
      { view: 'company', label: 'Pengaturan perusahaan', href: '#/admin/perusahaan' },
      { view: 'approvals', label: 'Persetujuan akun', href: '#/admin/persetujuan' },
      { view: 'accounts', label: 'Kelola akun', href: '#/admin/akun', ownerOnly: true },
      { view: 'email', label: 'Pengaturan email', href: '#/admin/email', ownerOnly: true },
    ],
  },
];

function ProductIdentity({ product }) {
  return (
    <div className="admin-product-identity">
      <div
        className={'admin-product-image ' + product.color}
        style={productColorStyle(product.color)}
      >
        <ProductImage product={product} variant="thumbnail" />
      </div>
      <div>
        <strong>{product.baseName}</strong>
        <small>{product.id}</small>
      </div>
    </div>
  );
}

export default function AdminPage({ view = 'overview' }) {
  const delivery = useContext(DeliveryContext);
  const { profile: companyProfile } = useCompany();
  const [query, setQuery] = useState(() => {
    try {
      return window.sessionStorage.getItem('bam.admin.catalog-search') || '';
    } catch {
      return '';
    }
  });
  const [supplierId, setSupplierId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editor, setEditor] = useState(null);
  const [notice, setNotice] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [deleting, setDeleting] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const deletePending = useRef(false);
  useUnsavedChanges(false, undefined, Boolean(deleting || importing));
  const removeProduct = async (product) => {
    if (deletePending.current) return;
    const count = adminProducts.filter((entry) => entry.groupId === product.groupId).length;
    if (
      !window.confirm(
        `Hapus produk "${product.baseName}" beserta seluruh ${count} SKU? Produk akan hilang dari katalog toko. Riwayat pesanan yang sudah dibuat tetap tersedia.`,
      )
    )
      return;
    deletePending.current = true;
    setDeleting(product.groupId);
    setDeleteError('');
    setNotice('');
    try {
      const result = await deleteProduct(product.groupId);
      if (result.storageError) setDeleteError(result.storageError);
      else setNotice(`Produk ${product.baseName} beserta ${count} SKU berhasil dihapus.`);
    } finally {
      deletePending.current = false;
      setDeleting('');
    }
  };
  const importPreview = async () => {
    if (importing) return;
    setImporting(true);
    setImportError('');
    const result = await importLocalCatalog();
    setImporting(false);
    if (result.storageError) setImportError(result.storageError);
    else setNotice('Data pratinjau berhasil diimpor ke database.');
  };
  const metrics = getMetrics();
  const workCounts = useAdminWorkCounts(view);
  const navBadges = {
    orders: workCounts.orders,
    stock: workCounts.stockEmpty,
    approvals: workCounts.approvals,
  };
  const brands = adminBrands(supplierId);
  const filtered = filterAdminProducts({ query, supplierId, brandId });
  const productPagination = paginateAdminList(filtered, productPage, 24);
  const hasFilters = Boolean(query || supplierId || brandId);
  const reset = () => {
    setProductPage(1);
    setQuery('');
    try {
      window.sessionStorage.removeItem('bam.admin.catalog-search');
    } catch {
      /* Private browsing may prevent storage. */
    }
    setSupplierId('');
    setBrandId('');
  };
  const isProducts = view === 'products';
  const masterType = { suppliers: 'suppliers', brands: 'brands', categories: 'categories' }[view];
  const workflowView = view === 'orders' || view === 'stock';
  const b2bView = view === 'b2bStores' || view === 'sharedCarts';
  const ownerSettingsView = ['company', 'email', 'accounts', 'approvals'].includes(view);
  // Storage notes matter only while data can be lost; database-backed pages go straight to the work.
  const previewStorage = workflowView
    ? !workflowUsesServer
    : !b2bView && !ownerSettingsView && !catalogUsesServer;
  const areaLabel =
    view === 'overview'
      ? 'Dashboard'
      : b2bView
        ? 'Pengelolaan toko B2B'
        : workflowView
          ? 'Operasional pesanan & stok'
          : ownerSettingsView
            ? 'Pengaturan & akses'
            : 'Pengelolaan katalog';
  const areaDescription = {
    company: 'Perbarui identitas perusahaan, alamat, dan pengaturan toko.',
    email: 'Atur pengiriman email verifikasi, pemulihan akun, dan pembaruan pesanan.',
    accounts: 'Kelola akses akun pembeli dan admin operasional.',
    approvals: 'Periksa dan putuskan permohonan pendaftaran akun.',
    suppliers: 'Kelola perusahaan pemasok dan relasinya dengan produk.',
    brands: 'Kelola merek dan perusahaan pemasok yang terhubung.',
    categories: 'Susun kategori dan subkategori katalog toko.',
    stock: workflowUsesServer
      ? 'Periksa dan perbarui stok setiap ukuran produk.'
      : 'Kelola stok produk pada pratinjau frontend.',
    orders: workflowUsesServer
      ? 'Proses pesanan pelanggan dari masuk sampai selesai.'
      : 'Kelola pesanan pelanggan pada pratinjau frontend.',
  };
  const pageTitle = {
    overview: 'Dashboard Admin',
    products: 'Daftar produk',
    suppliers: 'PT pemasok',
    brands: 'Merek',
    categories: 'Kategori & subkategori',
    orders: 'Pesanan toko',
    stock: 'Stok produk',
    company: 'Pengaturan perusahaan',
    email: 'Pengaturan email',
    accounts: 'Kelola akun',
    approvals: 'Persetujuan akun',
    b2bStores: 'Toko & Sales',
    sharedCarts: 'Keranjang bersama toko',
  }[view];
  // The form's capture listener confirms unsaved changes before this handler runs.
  // Close explicitly even when the selected link points to the current hash.
  const leaveEditor = () => {
    setEditor(null);
    setMenuOpen(false);
  };
  const startEdit = (groupId = '') => {
    setEditor({ groupId });
    setNotice('');
    setDeleteError('');
    window.scrollTo(0, 0);
  };
  const finishEdit = (groupId) => {
    approveNextRoute('/admin/produk');
    setEditor(null);
    reset();
    setNotice(
      `Produk berhasil disimpan ${catalogUsesServer ? 'ke database' : 'di browser ini'}. ${adminProducts.find((product) => product.groupId === groupId)?.baseName || ''}`,
    );
    window.location.hash = '/admin/produk';
    window.scrollTo(0, 0);
  };
  const actions = (product) => (
    <div className="admin-row-actions">
      <button
        type="button"
        className="admin-text-button"
        disabled={Boolean(deleting)}
        onClick={() => startEdit(product.groupId)}
        aria-label={`Edit ${product.baseName} ukuran ${product.sizeLabel}${packagingLabel(product) === 'Satuan' ? '' : ` · ${packagingLabel(product)}`}`}
      >
        Edit produk
      </button>
      <button
        type="button"
        className="admin-danger"
        disabled={Boolean(deleting)}
        onClick={() => removeProduct(product)}
        aria-label={`Hapus produk ${product.baseName} beserta semua SKU`}
      >
        {deleting === product.groupId ? 'Menghapus…' : 'Hapus produk'}
      </button>
      <a
        className="admin-view-product"
        href={'#/produk/' + encodeURIComponent(product.id)}
        aria-label={`Lihat ${product.baseName} ukuran ${product.sizeLabel}${packagingLabel(product) === 'Satuan' ? '' : ` · ${packagingLabel(product)}`} di toko`}
      >
        Lihat produk ↗
      </a>
    </div>
  );

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a
          className="admin-logo"
          href="#/admin"
          aria-label={`Dashboard admin ${companyProfile.shortName}`}
          onClick={leaveEditor}
        >
          <CompanyBrand />
          <small>Admin Panel</small>
        </a>
        <button
          className="admin-menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="admin-navigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          Menu admin <span aria-hidden="true">{menuOpen ? '−' : '+'}</span>
        </button>
        <nav
          id="admin-navigation"
          className={'admin-navigation' + (menuOpen ? ' is-open' : '')}
          aria-label="Navigasi admin"
        >
          {navigationGroups.map((group) => (
            <div
              className="admin-nav-group"
              role="group"
              aria-labelledby={'admin-group-' + group.id}
              key={group.id}
            >
              <p className="admin-nav-heading" id={'admin-group-' + group.id}>
                {group.label}
              </p>
              {group.items
                .filter((item) => !item.ownerOnly || delivery?.user?.isOwner)
                .map((item) => (
                  <a
                    key={item.view}
                    href={item.href}
                    aria-current={view === item.view ? 'page' : undefined}
                    onClick={leaveEditor}
                  >
                    <AdminIcon name={item.view} />
                    <span className="admin-nav-label">{item.label}</span>
                    {navBadges[item.view] > 0 && (
                      <span
                        className="admin-nav-badge"
                        aria-label={navBadges[item.view] + ' perlu ditindak'}
                      >
                        {navBadges[item.view]}
                      </span>
                    )}
                  </a>
                ))}
            </div>
          ))}
          <a className="admin-store-link" href="#/" onClick={leaveEditor}>
            <AdminIcon name="store" />
            Lihat toko
          </a>
        </nav>
        <div className="admin-sidebar-footer">
          <span className="admin-access-role">
            {delivery?.user?.isOwner ? 'Pemilik BAM' : 'Admin operasional'}
          </span>
          <p className="admin-sidebar-caption">{companyProfile.legalName}</p>
        </div>
      </aside>
      <div className="admin-content">
        <div className="admin-topbar">
          <form
            className="admin-topbar-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              try {
                window.sessionStorage.setItem('bam.admin.catalog-search', query);
              } catch {
                /* Search still works in the current page. */
              }
              if (window.location.hash !== '#/admin/produk')
                window.location.hash = '#/admin/produk';
            }}
          >
            <AdminIcon name="products" />
            <label htmlFor="admin-global-search" className="admin-visually-hidden">
              Cari produk di katalog
            </label>
            <input
              id="admin-global-search"
              type="search"
              maxLength={200}
              placeholder="Cari nama produk, merek, atau SKU..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="submit">Cari katalog</button>
          </form>
          <div className="admin-topbar-profile">
            <span className="admin-topbar-avatar" aria-hidden="true">
              {(delivery?.user?.name || 'A').slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{delivery?.user?.name || 'Admin BAM'}</strong>
              <small>{delivery?.user?.isOwner ? 'Pemilik BAM' : 'Admin operasional'}</small>
            </div>
          </div>
        </div>
        <header className="admin-header">
          <div>
            <span className="admin-eyebrow">
              {companyProfile.shortName} · {areaLabel}
            </span>
            <h1>
              <span className="admin-page-title-icon">
                <AdminIcon
                  name={
                    view === 'approvals' ? 'accounts' : view === 'sharedCarts' ? 'orders' : view
                  }
                />
              </span>
              <span className="admin-page-title-text">{pageTitle}</span>
            </h1>
            <p>
              {b2bView
                ? view === 'sharedCarts'
                  ? 'Kelola keranjang per toko dan periode, edit barang yang masih terbuka, lalu periksa riwayat perubahan.'
                  : 'Kelola toko pelanggan, akun pembeli, dan penugasan Sales.'
                : areaDescription[view] ||
                  (isProducts
                    ? 'Telusuri produk berdasarkan pemasok, merek, dan ukuran.'
                    : view === 'overview'
                      ? 'Pekerjaan yang perlu ditindak hari ini.'
                      : `Gambaran produk dan pemasok dalam katalog ${companyProfile.shortName}.`)}
            </p>
          </div>
          {previewStorage && (
            <span className="admin-demo-badge">
              {workflowView ? 'Pratinjau · Simulasi' : 'Pratinjau · Data dummy'}
            </span>
          )}
        </header>
        {previewStorage && (
          <p className="admin-preview-notice">
            {workflowView
              ? 'Pesanan, stok, pembayaran, dan pengiriman pada halaman ini masih pratinjau frontend. Katalog menggunakan penyimpanan yang sudah tersedia.'
              : 'Pratinjau katalog. Perubahan produk disimpan di browser ini dan terlihat di toko pada browser yang sama. Data belum tersimpan ke server.'}
          </p>
        )}
        {!editor && view !== 'b2bStores' && <AdminPageGuide view={view} />}
        {pendingLocalImport && view === 'overview' && !editor && (
          <section className="admin-next">
            <h2>Data pratinjau sebelumnya ditemukan</h2>
            <p>
              Database masih berisi katalog awal. Anda dapat mengimpor katalog dari browser ini,
              termasuk foto dan produk uji. Salinan di browser tetap tersimpan.
            </p>
            <button
              className="admin-primary"
              type="button"
              disabled={importing}
              onClick={importPreview}
            >
              {importing ? 'Mengimpor…' : 'Impor katalog dari browser'}
            </button>
          </section>
        )}
        {importError && (
          <p className="admin-form-alert" role="alert">
            {importError}
          </p>
        )}
        {deleteError && (
          <p className="admin-form-alert" role="alert">
            {deleteError}
          </p>
        )}
        {catalogLoadError && (
          <p className="admin-form-alert" role="alert">
            {catalogLoadError}
          </p>
        )}
        {notice && (
          <p className="admin-save-notice" role="status">
            ✓ {notice}
          </p>
        )}
        {view === 'sharedCarts' ? (
          <SharedCartPage key={delivery?.user?.id} adminView />
        ) : view === 'b2bStores' ? (
          <AdminB2BStoresPage key={delivery?.user?.id} />
        ) : view === 'approvals' ? (
          <AdminApprovalsPage />
        ) : view === 'accounts' ? (
          <AdminAccountsPage />
        ) : view === 'email' ? (
          <AdminEmailPage />
        ) : editor ? (
          <AdminProductForm
            key={editor.groupId || 'new'}
            groupId={editor.groupId}
            onNavigate={leaveEditor}
            onClose={() => {
              leaveEditor();
              window.location.hash = '/admin/produk';
            }}
            onSaved={finishEdit}
          />
        ) : view === 'company' ? (
          <AdminCompanyPage />
        ) : view === 'orders' ? (
          <AdminOrdersPage />
        ) : view === 'stock' ? (
          <AdminStockPage />
        ) : masterType ? (
          <AdminMasterPage key={masterType} type={masterType} />
        ) : !isProducts ? (
          <>
            {!adminProducts.length && (
              <section className="admin-next company-onboarding">
                <h2>Siapkan katalog perusahaan Anda</h2>
                <p>Mulai dari identitas toko, lalu tambahkan data milik perusahaan.</p>
                <ol>
                  <li>
                    <a href="#/admin/perusahaan">Isi identitas dan kontak perusahaan</a>
                  </li>
                  <li>
                    <a href="#/admin/pemasok">Tambahkan PT pemasok</a>
                  </li>
                  <li>
                    <a href="#/admin/kategori">Tambahkan kategori dan subkategori</a>
                  </li>
                  <li>
                    <a href="#/admin/merek">Tambahkan merek dan hubungkan ke pemasok</a>
                  </li>
                  <li>
                    <a href="#/admin/produk">Tambahkan produk, foto, ukuran, dan harga</a>
                  </li>
                </ol>
                <p>
                  {workflowUsesServer
                    ? 'Stok awal perusahaan adalah 0. Isi stok sebelum menerima pesanan.'
                    : 'Stok dan pesanan masih simulasi. Stok awal pada instalasi perusahaan adalah 0.'}
                </p>
              </section>
            )}
            <AdminOpsOverview
              counts={workCounts}
              user={delivery?.user}
              disabled={Boolean(deleting || importing)}
              onProductSaved={finishEdit}
              onLeave={leaveEditor}
            />
            <section className="admin-metrics" aria-label="Ringkasan katalog">
              {metrics.map((metric) => (
                <article className="admin-metric" key={metric.label}>
                  <span className="admin-metric-label">
                    {metric.label}
                    <AdminIcon name={metric.icon} />
                  </span>
                  <strong>{metric.value}</strong>
                  <p>{metric.hint}</p>
                </article>
              ))}
            </section>
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <AdminSectionIcon name="suppliers" />
                <div>
                  <h2>PT pemasok</h2>
                  <p>Sebaran produk utama dan varian pada setiap pemasok.</p>
                </div>
                <a className="admin-primary" href="#/admin/pemasok">
                  Kelola PT pemasok →
                </a>
              </div>
              <div className="admin-suppliers">
                {suppliers.map((supplier) => {
                  const items = adminProducts.filter(
                    (product) => product.supplier?.id === supplier.id,
                  );
                  return (
                    <article
                      className="admin-supplier"
                      key={supplier.id}
                      style={supplierColorStyle(supplier.color)}
                    >
                      <span
                        className="admin-supplier-avatar"
                        style={avatarColorStyle(supplier.color)}
                        aria-hidden="true"
                      >
                        {supplier.initials}
                      </span>
                      <div>
                        <h3>{supplier.name}</h3>
                        <p>
                          {new Set(items.map((product) => product.groupId)).size} produk utama ·{' '}
                          {items.length} varian produk
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        ) : (
          <section className="admin-panel admin-products-panel">
            <div className="admin-panel-heading">
              <AdminSectionIcon name="products" />
              <div>
                <h2>Katalog produk</h2>
                <p>
                  Setiap kombinasi ukuran dan kemasan ditampilkan sebagai SKU terpisah. Hapus produk
                  menghapus seluruh SKU produk tersebut.
                </p>
              </div>
              <div className="admin-heading-actions">
                <span className="admin-result-pill">{adminProducts.length} SKU</span>
                <button
                  type="button"
                  className="admin-primary"
                  disabled={Boolean(deleting || importing)}
                  onClick={() => startEdit()}
                >
                  + Tambah produk
                </button>
              </div>
            </div>
            <AdminProductFilters
              activeCount={Number(Boolean(supplierId)) + Number(Boolean(brandId))}
            >
              <div className="admin-field admin-search">
                <label htmlFor="admin-search">Cari produk</label>
                <input
                  id="admin-search"
                  type="search"
                  maxLength={200}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setProductPage(1);
                  }}
                  placeholder="Nama, merek, ukuran, atau SKU"
                />
              </div>
              <div className="admin-field">
                <label htmlFor="admin-supplier">PT pemasok</label>
                <select
                  id="admin-supplier"
                  value={supplierId}
                  onChange={(event) => {
                    setSupplierId(event.target.value);
                    setBrandId('');
                    setProductPage(1);
                  }}
                >
                  <option value="">Semua pemasok</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="admin-field">
                <label htmlFor="admin-brand">Merek</label>
                <select
                  id="admin-brand"
                  value={brandId}
                  onChange={(event) => {
                    setBrandId(event.target.value);
                    setProductPage(1);
                  }}
                >
                  <option value="">Semua merek</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>
            </AdminProductFilters>
            <div className="admin-results">
              <p role="status">
                Menampilkan <strong>{productPagination.items.length}</strong> dari {filtered.length}{' '}
                hasil ({adminProducts.length} SKU tersedia)
              </p>
              {hasFilters && (
                <button type="button" className="admin-text-button" onClick={reset}>
                  Reset filter
                </button>
              )}
            </div>
            {filtered.length ? (
              <>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <caption className="admin-sr-only">
                      Daftar produk, pemasok, merek, ukuran, dan harga
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Produk / SKU</th>
                        <th scope="col">PT pemasok</th>
                        <th scope="col">Merek</th>
                        <th scope="col">Ukuran / kemasan</th>
                        <th scope="col">Harga</th>
                        <th scope="col">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productPagination.items.map((product) => (
                        <tr key={product.id}>
                          <td>
                            <ProductIdentity product={product} />
                          </td>
                          <td>{product.supplier?.name || 'Belum ditentukan'}</td>
                          <td>{product.brand}</td>
                          <td>
                            <span className="admin-size">{product.sizeLabel}</span>
                            <small className="admin-packaging">{packagingLabel(product)}</small>
                          </td>
                          <td className="admin-price">{rupiah(product.price)}</td>
                          <td>{actions(product)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="admin-mobile-products">
                  {productPagination.items.map((product) => (
                    <li key={product.id}>
                      <ProductIdentity product={product} />
                      <dl>
                        <div>
                          <dt>PT pemasok</dt>
                          <dd>{product.supplier?.name || 'Belum ditentukan'}</dd>
                        </div>
                        <div>
                          <dt>Merek</dt>
                          <dd>{product.brand}</dd>
                        </div>
                        <div>
                          <dt>Ukuran / kemasan</dt>
                          <dd>
                            <span className="admin-size">{product.sizeLabel}</span>
                            <small className="admin-packaging">{packagingLabel(product)}</small>
                          </dd>
                        </div>
                        <div>
                          <dt>Harga</dt>
                          <dd className="admin-price">{rupiah(product.price)}</dd>
                        </div>
                      </dl>
                      {actions(product)}
                    </li>
                  ))}
                </ul>
                {productPagination.pages > 1 && (
                  <nav className="admin-list-pagination" aria-label="Halaman katalog produk">
                    <button
                      type="button"
                      className="admin-secondary"
                      disabled={productPagination.page <= 1}
                      onClick={() => setProductPage(productPagination.page - 1)}
                    >
                      Sebelumnya
                    </button>
                    <span role="status">
                      Halaman {productPagination.page} dari {productPagination.pages}
                    </span>
                    <button
                      type="button"
                      className="admin-secondary"
                      disabled={productPagination.page >= productPagination.pages}
                      onClick={() => setProductPage(productPagination.page + 1)}
                    >
                      Berikutnya
                    </button>
                  </nav>
                )}
              </>
            ) : (
              <div className="admin-empty">
                <h3>Produk tidak ditemukan</h3>
                <p>Coba kata pencarian lain atau reset filter untuk melihat seluruh produk.</p>
                <button className="admin-primary" type="button" onClick={reset}>
                  Reset filter
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
