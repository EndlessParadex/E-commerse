import { useRef, useState } from 'react';
import { workflowUsesServer } from '../../data/adminStore';
import { supplierHref } from '../../data/suppliers';
import { purchasePackagingChoice } from '../../data/packagingPresentation';
import './ProductInformation.css';

const tabs = [
  { id: 'detail', label: 'Detail Produk' },
  { id: 'specifications', label: 'Spesifikasi' },
];

export default function ProductInformation({
  product,
  variants,
  packages,
  supplier,
  subcategory,
  description,
  companyProfile,
  sharedCart,
  codOnly,
}) {
  const [active, setActive] = useState('detail');
  const [expanded, setExpanded] = useState(false);
  const buttons = useRef({});
  const canExpand = description.length > 200 || description.split('\n').length > 4;
  const handleKeys = (event) => {
    const index = tabs.findIndex((tab) => tab.id === active);
    const next = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const id = tabs[next].id;
    setActive(id);
    buttons.current[id]?.focus();
  };
  return (
    <section className="detail-information" aria-label="Informasi produk">
      <div
        className="detail-information-tabs"
        role="tablist"
        aria-label="Detail dan spesifikasi produk"
      >
        {tabs.map((tab) => (
          <button
            ref={(element) => {
              buttons.current[tab.id] = element;
            }}
            type="button"
            role="tab"
            key={tab.id}
            id={'product-tab-' + tab.id}
            aria-selected={active === tab.id}
            aria-controls={'product-panel-' + tab.id}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => setActive(tab.id)}
            onKeyDown={handleKeys}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        className="detail-information-panel"
        id="product-panel-detail"
        role="tabpanel"
        aria-labelledby="product-tab-detail"
        tabIndex={0}
        hidden={active !== 'detail'}
      >
        <h2>Deskripsi produk</h2>
        <p
          id="product-description-text"
          className={
            'detail-information-description' + (canExpand && !expanded ? ' is-collapsed' : '')
          }
        >
          {description}
        </p>
        {canExpand && (
          <button
            className="detail-information-expand"
            type="button"
            aria-expanded={expanded}
            aria-controls="product-description-text"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'Tampilkan lebih sedikit' : 'Lihat selengkapnya'}
          </button>
        )}
      </div>
      <div
        className="detail-information-panel"
        id="product-panel-specifications"
        role="tabpanel"
        aria-labelledby="product-tab-specifications"
        tabIndex={0}
        hidden={active !== 'specifications'}
      >
        <h2>Info produk</h2>
        <dl className="detail-information-specs">
          <div>
            <dt>Merek</dt>
            <dd>
              {supplier && product.brand ? (
                <a href={supplierHref(supplier.id, { brandId: product.brandId })}>
                  {product.brand}
                </a>
              ) : (
                product.brand || 'Belum ditentukan'
              )}
            </dd>
          </div>
          <div>
            <dt>Kategori produk</dt>
            <dd>
              {product.category}
              {subcategory ? ` · ${subcategory.name}` : ''}
            </dd>
          </div>
          <div>
            <dt>Ukuran terpilih</dt>
            <dd className="detail-meta-size" aria-live="polite">
              {product.sizeLabel}
            </dd>
          </div>
          <div>
            <dt>Kemasan terpilih</dt>
            <dd className="detail-meta-packaging" aria-live="polite">
              {purchasePackagingChoice(product, packages)}
            </dd>
          </div>
          <div>
            <dt>SKU</dt>
            <dd>{product.id}</dd>
          </div>
        </dl>
        <details className="detail-information-variants">
          <summary>Pilihan ukuran dan kemasan</summary>
          <ul>
            {variants.map((variant) => (
              <li key={variant.id}>
                {variant.sizeLabel} · {purchasePackagingChoice(variant, variants)}
              </li>
            ))}
          </ul>
        </details>
      </div>
      <div className="detail-supplier-summary">
        <span className="detail-supplier-avatar" aria-hidden="true">
          {supplier?.initials || 'PT'}
        </span>
        <div>
          <span>PT pemasok</span>
          {supplier ? (
            <a href={supplierHref(supplier.id)}>
              {supplier.name} <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <strong>Belum ditentukan</strong>
          )}
        </div>
      </div>
      <section className="detail-information-delivery" aria-labelledby="detail-delivery-title">
        <h3 id="detail-delivery-title">Pengiriman</h3>
        <p>
          {workflowUsesServer
            ? sharedCart?.enabled
              ? 'Barang disiapkan dari keranjang toko setelah Admin memeriksa harga dan stok lalu memfinalisasi pesanan. Pengiriman gratis, pembayaran COD saat barang diterima. Tanggal keranjang adalah rencana pengiriman.'
              : codOnly
                ? 'Pengiriman gratis. Harga checkout sudah final; pembayaran COD dilakukan saat barang diterima.'
                : 'Toko menetapkan ongkir sesuai barang, tujuan, dan kurir. Anda menyetujui total akhir sebelum membayar.'
            : 'Pilihan pengiriman dan ongkir ditampilkan saat checkout.'}
        </p>
        <p className="detail-description-note">
          {workflowUsesServer
            ? 'Stok mengikuti data server. Pesanan terhubung ke akun; pembayaran dan kurir belum terhubung otomatis.'
            : 'Ketersediaan stok dan proses pembelian masih berupa simulasi.'}
        </p>
        <div className="detail-benefits">
          <div>
            <span aria-hidden="true">🚚</span>
            <p>
              <strong>Pengiriman aman</strong>
              <small>Alamat dikirim sesuai profil kamu</small>
            </p>
          </div>
          <div>
            <span aria-hidden="true">🛡️</span>
            <p>
              <strong>Belanja lebih tenang</strong>
              <small>Produk pilihan {companyProfile.shortName}.</small>
            </p>
          </div>
        </div>
      </section>
    </section>
  );
}
