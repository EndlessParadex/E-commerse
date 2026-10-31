import { suppliers, supplierHref } from '../../data/suppliers';
import { products, groupProducts } from '../../data/products';
import { searchHref } from '../../data/catalog';
import ProductImage from './ProductImage';
import './SupplierSection.css';
import { supplierColorStyle, avatarColorStyle } from '../../data/catalogColors';
import { brandsForSupplier } from '../../data/catalogMasters';

export default function SupplierSection({ page = 1, pageSize, directory = false, compact = false } = {}) {
  const limit = pageSize ?? (compact ? 4 : suppliers.length);
  const visible = suppliers.slice((page - 1) * limit, page * limit);
  return (
    <section className={"bam-suppliers" + (compact ? " is-compact" : "")} id="catalog" aria-labelledby="bam-suppliers-title">
      <header className="section-heading">
        <div>
          <span className="section-eyebrow">Jelajahi berdasarkan pemasok</span>
          <h2 id="bam-suppliers-title">Mitra pemasok</h2>
        </div>
        <a className="view-all-link" href={directory ? searchHref('') : '#/pemasok'}>
          {directory ? 'Jelajahi katalog' : 'Lihat semua pemasok'} <span aria-hidden="true">→</span>
        </a>
      </header>
      <p className="bam-suppliers-note">
        Temukan produk berdasarkan PT pemasok dan merek yang tersedia di katalog.
      </p>
      <ul className="bam-supplier-grid">
        {visible.map((supplier) => {
          const items = groupProducts(
            products.filter((product) => supplier.productIds.includes(product.id)),
          );
          const categories = [...new Set(items.map((product) => product.category))];
          return (
            <li key={supplier.id}>
              <a
                href={supplierHref(supplier.id)}
                className={'bam-supplier-card bam-supplier--' + supplier.color + (compact ? ' is-compact' : '')}
                style={supplierColorStyle(supplier.color)}
              >
                <div className="bam-supplier-top">
                  <div className="bam-supplier-logo" style={avatarColorStyle(supplier.color)}>
                    <ProductImage
                      product={{
                        name: supplier.name,
                        image: supplier.logo,
                        imageAlt: 'Logo ' + supplier.name,
                        icon: supplier.initials,
                      }}
                      variant="promo"
                    />
                  </div>
                </div>
                {compact ? (
                  <div className="bam-supplier-copy">
                    <h3>{supplier.name}</h3>
                    <p>{categories.join(' · ') || 'Produk belum tersedia'}</p>
                    <small>{brandsForSupplier(supplier.id).length} merek</small>
                  </div>
                ) : (
                  <>
                    <h3>{supplier.name}</h3>
                    <p>{categories.join(' · ') || 'Produk belum tersedia'}</p>
                    <div className="bam-supplier-bottom">
                      <span>{brandsForSupplier(supplier.id).length} merek</span>
                      <strong>
                        Lihat merek <span aria-hidden="true">↗</span>
                      </strong>
                    </div>
                  </>
                )}
                {compact && <span className="bam-supplier-card-arrow" aria-hidden="true">›</span>}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
