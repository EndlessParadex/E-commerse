import useCompany from '../../state/useCompany';
import { useState } from 'react';
import { productGallery } from '../../data/productGallery';
import ProductImage from './ProductImage';
import './ProductGallery.css';
import { purchaseProductName } from '../../data/packagingPresentation';

function GalleryMedia({ product, entry, thumbnail = false }) {
  const { profile: companyProfile } = useCompany();
  if (!entry.demo)
    return (
      <ProductImage
        product={{ ...product, image: entry.src, imageAlt: entry.alt }}
        variant={thumbnail ? 'thumbnail' : 'detail'}
        loading={thumbnail ? 'lazy' : 'eager'}
      />
    );
  return (
    <div
      className={`gallery-demo gallery-demo--${entry.view}${thumbnail ? ' gallery-demo--thumbnail' : ''}`}
      aria-hidden="true"
    >
      <div className="gallery-demo-package">
        {entry.view === 'back' ? (
          <>
            <span className="gallery-demo-brand">{companyProfile.shortName}</span>
            <div className="gallery-demo-lines">
              <i />
              <i />
              <i />
            </div>
            <div className="gallery-demo-barcode" />
          </>
        ) : (
          <>
            <span className="gallery-demo-icon">{product.icon || '📦'}</span>
            {!thumbnail && <span className="gallery-demo-name">{product.baseName}</span>}
          </>
        )}
        <span className="gallery-demo-size">{product.sizeLabel}</span>
      </div>
    </div>
  );
}

export default function ProductGallery({ product }) {
  const allEntries = productGallery(product);
  const photos = allEntries.filter((entry) => !entry.demo);
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Without real photos, one neutral placeholder replaces the drawn package mock-ups.
  if (!photos.length)
    return (
      <section className="product-gallery" aria-label="Galeri gambar produk">
        <div className="detail-image is-placeholder">
          <ProductImage product={{ ...product, image: '' }} variant="detail" />
          {product.tag && <span className="detail-tag">{product.tag}</span>}
        </div>
      </section>
    );
  const entries = photos;
  const activeIndex = Math.min(selectedIndex, entries.length - 1);
  const selected = entries[activeIndex];
  return (
    <section className="product-gallery" aria-label="Galeri gambar produk">
      {/* Real photos are packshots on white; the colour gradient is only for placeholders. */}
      <div className={'detail-image has-photo ' + product.color}>
        <GalleryMedia product={product} entry={selected} />
        {product.tag && <span className="detail-tag">{product.tag}</span>}
      </div>
      <span className="gallery-status" role="status">
        {selected.demo ? 'Ilustrasi produk' : 'Foto'} {activeIndex + 1} dari {entries.length}
      </span>
      {entries.length > 1 && (
        <div className="gallery-thumbnails" aria-label="Pilih foto produk">
          {entries.map((entry, index) => (
            <button
              type="button"
              key={index}
              className={'gallery-thumbnail' + (activeIndex === index ? ' is-selected' : '')}
              aria-label={`Lihat ${entry.demo ? 'ilustrasi' : 'foto'} ${index + 1} ${purchaseProductName(product)}`}
              aria-pressed={activeIndex === index}
              onClick={(event) => {
                setSelectedIndex(index);
                const button = event.currentTarget;
                const track = button.parentElement;
                if (button.offsetLeft < track.scrollLeft) track.scrollLeft = button.offsetLeft;
                else if (
                  button.offsetLeft + button.offsetWidth >
                  track.scrollLeft + track.clientWidth
                )
                  track.scrollLeft = button.offsetLeft + button.offsetWidth - track.clientWidth;
              }}
            >
              <span className={'gallery-thumbnail-image has-photo ' + product.color}>
                <GalleryMedia product={product} entry={entry} thumbnail />
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
