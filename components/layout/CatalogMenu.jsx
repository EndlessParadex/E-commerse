import { useEffect, useRef, useState } from 'react';
import { categories, categoryHref, availableBrands, filterCatalogProducts, filterProducts, searchHref } from '../../data/catalog';
import { suppliers, supplierHref } from '../../data/suppliers';
import { avatarColorStyle, productColorStyle } from '../../data/catalogColors';
import { productGallery } from '../../data/productGallery';
import ProductImage from '../shop/ProductImage';
import './CatalogMenu.css';

function CatalogMenuCard({ name, href, options, icon = '📦' }) {
  const matches = filterProducts(options);
  // Prefer an uploaded photo within the selected scope, including size variants.
  const featured = matches.find((product) => productGallery(product).some((photo) => !photo.demo)) || matches[0];
  const photo = featured && productGallery(featured)[0];
  const preview = featured ? { ...featured, image: photo.src, imageAlt: photo.alt } : { name, icon };
  return <a href={href}>
    <span className="bam-catalog-card-image" style={featured ? productColorStyle(featured.color) : undefined} aria-hidden="true"><ProductImage product={preview} variant="menu" /></span>
    <span className="bam-catalog-card-copy"><strong>{name}</strong><span>{filterCatalogProducts(options).length} produk</span></span>
  </a>;
}

export default function CatalogMenu() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('categories');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const ref = useRef(null);
  const category = categories.find((item) => item.id === categoryId) || categories[0];
  const supplier = suppliers.find((item) => item.id === supplierId) || suppliers[0];
  useEffect(() => {
    const outside = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener('pointerdown', outside); window.addEventListener('hashchange', close);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('hashchange', close); };
  }, []);
  const count = (options) => filterCatalogProducts(options).length;
  const selectTab = (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault(); const next = view === 'categories' ? 'suppliers' : 'categories';
    setView(next); ref.current.querySelector(`[data-view="${next}"]`)?.focus();
  };
  return <div className="bam-catalog-menu" ref={ref} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={(event) => { if (event.key === 'Escape') { setOpen(false); ref.current.querySelector('.bam-category-trigger')?.focus(); } }}>
    <button type="button" className="bam-category-trigger" aria-expanded={open} aria-controls="bam-catalog-panel" onClick={() => setOpen((value) => !value)}>☰ Semua Kategori</button>
    {open && <div className="bam-catalog-panel" id="bam-catalog-panel">
      <div className="bam-catalog-tabs" role="tablist" aria-label="Jelajahi katalog">{[{ id: 'categories', label: 'Kategori' }, { id: 'suppliers', label: 'PT pemasok' }].map((tab) => <button type="button" role="tab" key={tab.id} id={'catalog-tab-' + tab.id} data-view={tab.id} aria-selected={view === tab.id} aria-controls="catalog-menu-content" tabIndex={view === tab.id ? 0 : -1} onKeyDown={selectTab} onClick={() => setView(tab.id)}>{tab.label}</button>)}</div>
      <div className="bam-catalog-body" role="tabpanel" id="catalog-menu-content" aria-labelledby={'catalog-tab-' + view}>
        <div className="bam-catalog-sidebar" aria-label={view === 'categories' ? 'Pilih kategori' : 'Pilih PT pemasok'}>
          {(view === 'categories' ? categories : suppliers).map((item) => <button type="button" key={item.id} aria-pressed={(view === 'categories' ? category?.id : supplier?.id) === item.id} onClick={() => view === 'categories' ? setCategoryId(item.id) : setSupplierId(item.id)}><span className="bam-catalog-icon" style={view === 'suppliers' ? avatarColorStyle(item.color) : undefined} aria-hidden="true">{item.icon || item.initials}</span><span>{item.name}</span><small>{count(view === 'categories' ? { categoryId: item.id } : { supplierId: item.id })}</small></button>)}
          <a href={searchHref('')}>Lihat seluruh katalog →</a>
        </div>
        <div className="bam-catalog-content">{view === 'categories' ? category ? <><header><span className="section-eyebrow">Kategori produk</span><h2>{category.name}</h2><a href={categoryHref(category.id)}>Semua produk kategori ini →</a></header><div className="bam-catalog-grid">{category.children.map((child) => <CatalogMenuCard key={child.id} name={child.name} href={categoryHref(category.id, child.id)} options={{ categoryId: category.id, subcategoryId: child.id }} icon={category.icon} />)}</div></> : <p>Belum ada kategori tersedia.</p> : supplier ? <><header><span className="section-eyebrow">Mitra pemasok</span><h2>{supplier.name}</h2><a href={supplierHref(supplier.id)}>Semua produk PT ini →</a></header><div className="bam-catalog-grid">{availableBrands(supplier.id).map((brand) => <CatalogMenuCard key={brand.id} name={brand.name} href={supplierHref(supplier.id, { brandId: brand.id })} options={{ supplierId: supplier.id, brandId: brand.id }} />)}</div>{!availableBrands(supplier.id).length && <p>Belum ada produk untuk pemasok ini.</p>}</> : <p>Belum ada pemasok tersedia.</p>}</div>
      </div>
    </div>}
  </div>;
}
