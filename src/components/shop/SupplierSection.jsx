import { suppliers, supplierHref } from '../../data/suppliers';
import { products, groupProducts } from '../../data/products';
import { searchHref } from '../../data/catalog';
import ProductImage from './ProductImage';
import './SupplierSection.css';
import { supplierColorStyle, avatarColorStyle } from '../../data/catalogColors';

export default function SupplierSection() {
  return <section className="bam-suppliers" id="catalog" aria-labelledby="bam-suppliers-title">
    <header className="section-heading"><div><span className="section-eyebrow">Jelajahi berdasarkan pemasok</span><h2 id="bam-suppliers-title">Mitra pemasok</h2></div><a className="view-all-link" href={searchHref('')}>Lihat semua produk →</a></header>
    <p className="bam-suppliers-note">Nama PT dan pembagian produk berikut adalah data contoh untuk pratinjau.</p>
    <ul className="bam-supplier-grid">{suppliers.map((supplier) => {
      const items = groupProducts(products.filter((product) => supplier.productIds.includes(product.id)));
      const categories = [...new Set(items.map((product) => product.category))];
      return <li key={supplier.id}><a href={supplierHref(supplier.id)} className={'bam-supplier-card bam-supplier--' + supplier.color} style={supplierColorStyle(supplier.color)}>
        <div className="bam-supplier-top"><div className="bam-supplier-logo" style={avatarColorStyle(supplier.color)}><ProductImage product={{ name: supplier.name, image: supplier.logo, imageAlt: 'Logo ' + supplier.name, icon: supplier.initials }} variant="promo" /></div><span className="bam-supplier-demo">Contoh</span></div>
        <h3>{supplier.name}</h3><p>{categories.join(' · ') || 'Produk belum tersedia'}</p>
        <div className="bam-supplier-bottom"><span>{items.length} produk</span><strong>Lihat produk <span aria-hidden="true">↗</span></strong></div>
      </a></li>;
    })}</ul>
  </section>;
}
