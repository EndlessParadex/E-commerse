const demoViews = [
  { view: 'front', label: 'Depan' },
  { view: 'back', label: 'Belakang' },
  { view: 'side', label: 'Samping' },
  { view: 'detail', label: 'Detail' },
];

export function productGallery(product) {
  const entries = Array.isArray(product.gallery) ? product.gallery : [];
  const photos = entries.filter((entry) => entry && typeof entry.src === 'string' && entry.src.trim()).map((entry, index) => {
    const label = typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : `Foto ${index + 1}`;
    return { src: entry.src.trim(), label, alt: typeof entry.alt === 'string' && entry.alt.trim() ? entry.alt.trim() : `${product.name} — ${label}`, demo: false };
  });
  if (photos.length) return photos;
  if (typeof product.image === 'string' && product.image.trim()) return [{ src: product.image.trim(), label: 'Depan', alt: product.imageAlt || product.name, demo: false }];
  return demoViews.map((view) => ({ ...view, src: '', alt: `Ilustrasi contoh ${product.name} — ${view.label}`, demo: true }));
}
