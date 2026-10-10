import { products } from './products.js';
import { productGallery } from './productGallery.js';
import { readPackagingSnapshot, packagingLabel } from './productPackaging.js';

export function cartItemPresentation(item) {
  const product = products.find((entry) => entry.id === item.id);
  // Keep the name and price saved in the cart, including legacy/removed products.
  const match = item.name.match(/\s+(\d+(?:[.,]\d+)?)\s*(g|ml|pcs)$/i);
  const packaging = readPackagingSnapshot(item.packaging);
  const sizeLabel = packaging?.sizeLabel || (match ? `${match[1]}${match[2].toLowerCase()}` : '');
  const suffix = packaging ? ` ${sizeLabel}${packaging.packagingType === 'satuan' ? '' : ` · ${packagingLabel(packaging)}`}` : '';
  const name = suffix && item.name.endsWith(suffix) ? item.name.slice(0, -suffix.length) : match ? item.name.slice(0, match.index).trim() : item.name;
  const photo = product ? productGallery(product)[0] : null;
  return {
    name, sizeLabel, packaging, brand: product?.brand || '',
    detailHref: product ? `#/produk/${encodeURIComponent(product.id)}` : '',
    product: product ? { ...product, image: photo?.src || product.image, imageAlt: photo?.alt || product.imageAlt } : {
      id: item.id, name: item.name, image: '', imageAlt: item.name, icon: '🛒', color: 'sand',
    },
  };
}
