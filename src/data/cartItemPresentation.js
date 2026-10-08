import { products } from './products.js';
import { productGallery } from './productGallery.js';

export function cartItemPresentation(item) {
  const product = products.find((entry) => entry.id === item.id);
  // Keep the name and price saved in the cart, including legacy/removed products.
  const match = item.name.match(/\s+(\d+(?:[.,]\d+)?)\s*(g|ml|pcs)$/i);
  const sizeLabel = match ? `${match[1]}${match[2].toLowerCase()}` : '';
  const name = match ? item.name.slice(0, match.index).trim() : item.name;
  const photo = product ? productGallery(product)[0] : null;
  return {
    name, sizeLabel, brand: product?.brand || '',
    detailHref: product ? `#/produk/${encodeURIComponent(product.id)}` : '',
    product: product ? { ...product, image: photo?.src || product.image, imageAlt: photo?.alt || product.imageAlt } : {
      id: item.id, name: item.name, image: '', imageAlt: item.name, icon: '🛒', color: 'sand',
    },
  };
}
