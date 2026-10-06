import { useState } from 'react';
import './ProductImage.css';

function ImageContent({ src, product, loading }) {
  const [failed, setFailed] = useState(false);
  return src && !failed
    ? <img src={src} alt={product.imageAlt || product.name} loading={loading} decoding="async" onError={() => setFailed(true)} />
    : <span className="bam-product-fallback" role="img" aria-label={product.name}>{product.icon || '📦'}</span>;
}

export default function ProductImage({ product, variant = 'card', loading = 'lazy' }) {
  const path = typeof product.image === 'string' ? product.image.trim() : '';
  // Local assets are relative to Vite's base, including deployments in a subfolder.
  const src = path && !/^(https?:|data:|blob:|\/\/)/i.test(path)
    ? `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
    : path;
  return <div className={`bam-product-media bam-product-media--${variant}`}>
    <ImageContent key={src} src={src} product={product} loading={loading} />
  </div>;
}
