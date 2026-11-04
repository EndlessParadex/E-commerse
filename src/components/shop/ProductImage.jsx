import { useState } from 'react';
import './ProductImage.css';

/**
 * One neutral placeholder for every product without a photo, so cards,
 * banners and promo lists look the same instead of mixing emoji and initials.
 */
export function ProductPlaceholderIcon() {
  return (
    <svg
      className="bam-product-placeholder-icon"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M24 5 41 14v20L24 43 7 34V14z" />
      <path d="m7 14 17 9 17-9M24 23v20" />
      <path d="m15.5 9.5 17 9" />
    </svg>
  );
}

function ImageContent({ src, product, loading }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <img
      src={src}
      alt={product.imageAlt || product.name}
      loading={loading}
      decoding="async"
      onError={() => setFailed(true)}
    />
  ) : (
    <span
      className="bam-product-fallback"
      role="img"
      aria-label={'Foto ' + (product.baseName || product.name) + ' belum tersedia'}
    >
      <ProductPlaceholderIcon />
    </span>
  );
}

export default function ProductImage({ product, variant = 'card', loading = 'lazy' }) {
  const path = typeof product.image === 'string' ? product.image.trim() : '';
  // Local assets are relative to Vite's base, including deployments in a subfolder.
  const src =
    path && !/^(https?:|data:|blob:|\/\/)/i.test(path)
      ? `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
      : path;
  return (
    <div className={`bam-product-media bam-product-media--${variant}`}>
      <ImageContent key={src} src={src} product={product} loading={loading} />
    </div>
  );
}
