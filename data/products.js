const baseProducts = [
  { id: 'snack-pedas', name: 'Keripik Singkong Balado', categoryId: 'snack', subcategoryId: 'keripik', category: 'Snack & Makanan', price: 18000, oldPrice: 24000, rating: 4.9, sold: '1,2 rb', image: '', imageAlt: '', icon: '🌶️', color: 'coral', tag: 'Terlaris' },
  { id: 'skincare-glow', name: 'Glow Hydrating Serum', categoryId: 'beauty', subcategoryId: 'wajah', category: 'Kosmetik & Beauty', price: 79000, oldPrice: 99000, rating: 4.8, sold: '856', image: '', imageAlt: '', icon: '✨', color: 'lilac', tag: 'Diskon' },
  { id: 'bumbu-rendang', name: 'Bumbu Rendang Premium', categoryId: 'bumbu', subcategoryId: 'siap-pakai', category: 'Bumbu Masakan', price: 12000, oldPrice: 15000, rating: 4.9, sold: '2,4 rb', image: '', imageAlt: '', icon: '🍛', color: 'amber', tag: 'Terlaris' },
  { id: 'parfum-floral', name: 'Parfum Floral Eau de Parfum', categoryId: 'beauty', subcategoryId: 'parfum', category: 'Kosmetik & Beauty', price: 125000, oldPrice: 159000, rating: 4.7, sold: '642', image: '', imageAlt: '', icon: '🌸', color: 'rose', tag: 'Baru' },
  { id: 'cokelat-import', name: 'Dark Chocolate Almond', categoryId: 'snack', subcategoryId: 'cokelat', category: 'Snack & Makanan', price: 35000, oldPrice: 42000, rating: 4.8, sold: '987', image: '', imageAlt: '', icon: '🍫', color: 'brown', tag: '' },
  { id: 'sabun-natural', name: 'Natural Body Wash', categoryId: 'rumah', subcategoryId: 'tubuh', category: 'Perlengkapan Rumah', price: 45000, oldPrice: 55000, rating: 4.6, sold: '413', image: '', imageAlt: '', icon: '🧼', color: 'mint', tag: 'Pilihan' },
  { id: 'lipstik-matte', name: 'Velvet Matte Lip Cream', categoryId: 'beauty', subcategoryId: 'makeup', category: 'Kosmetik & Beauty', price: 56000, oldPrice: 72000, rating: 4.9, sold: '1,8 rb', image: '', imageAlt: '', icon: '💄', color: 'red', tag: 'Terlaris' },
  { id: 'kacang-almond', name: 'Almond Panggang Madu', categoryId: 'snack', subcategoryId: 'kacang', category: 'Snack & Makanan', price: 29000, oldPrice: 36000, rating: 4.7, sold: '721', image: '', imageAlt: '', icon: '🥜', color: 'sand', tag: '' },
];

// Data merek, gramasi, dan harga di bawah adalah contoh, bukan data pemasok asli.
const demoBrands = {
  'snack-pedas': ['rasa-contoh', 'Rasa Contoh', 180],
  'cokelat-import': ['cokelat-contoh', 'Cokelat Contoh', 130],
  'kacang-almond': ['kacang-contoh', 'Kacang Contoh', 62],
  'bumbu-rendang': ['dapur-contoh', 'Dapur Contoh', 23],
  'skincare-glow': ['glow-contoh', 'Glow Contoh', null],
  'lipstik-matte': ['velvet-contoh', 'Velvet Contoh', 4],
  'parfum-floral': ['floral-contoh', 'Floral Contoh', null],
  'sabun-natural': ['natural-contoh', 'Natural Contoh', null],
};
// [ukuran, harga, harga sebelum diskon]; seluruhnya data dummy.
const demoVariants = {
  'snack-pedas': { unit: 'g', defaultSize: 180, sizes: [[23, 3500, 4500], [62, 7500, 9000], [130, 14000, 17000], [180, 18000, 24000]] },
  'cokelat-import': { unit: 'g', defaultSize: 130, sizes: [[35, 10000, 12000], [65, 19000, 23000], [130, 35000, 42000]] },
  'kacang-almond': { unit: 'g', defaultSize: 62, sizes: [[23, 12000, 15000], [62, 29000, 36000], [130, 55000, 68000]] },
  'bumbu-rendang': { unit: 'g', defaultSize: 23, sizes: [[23, 12000, 15000], [62, 28000, 34000], [130, 49000, 59000]] },
  'skincare-glow': { unit: 'ml', defaultSize: 30, sizes: [[10, 29000, 35000], [30, 79000, 99000], [50, 119000, 149000]] },
  'parfum-floral': { unit: 'ml', defaultSize: 50, sizes: [[30, 85000, 109000], [50, 125000, 159000], [100, 215000, 269000]] },
  'sabun-natural': { unit: 'ml', defaultSize: 250, sizes: [[100, 22000, 27000], [250, 45000, 55000], [500, 79000, 99000]] },
  'lipstik-matte': { unit: 'g', defaultSize: 4, sizes: [[2, 32000, 39000], [4, 56000, 72000], [6, 76000, 95000]] },
};
// Isi foto asli per ID SKU, misalnya 'snack-pedas-23g'. Galeri kosong memakai demo.
const productPhotos = {};
const makeVariant = (product, [sizeValue, price, oldPrice]) => {
  const config = demoVariants[product.id];
  const [brandId, brand] = demoBrands[product.id];
  const sizeLabel = `${sizeValue}${config.unit}`;
  const isDefault = sizeValue === config.defaultSize;
  const id = isDefault ? product.id : `${product.id}-${sizeLabel}`;
  return { ...product, groupId: product.id, baseName: product.name, brandId, brand,
    sizeValue, sizeUnit: config.unit, sizeLabel, grams: config.unit === 'g' ? sizeValue : null,
    id, gallery: productPhotos[id] || [], name: `${product.name} ${sizeLabel}`,
    price, oldPrice, tag: isDefault ? product.tag : 'Contoh' };
};
// Keep existing IDs and default SKUs first so old links and catalog cards remain valid.
export const products = [
  ...baseProducts.map((product) => makeVariant(product, demoVariants[product.id].sizes.find(([size]) => size === demoVariants[product.id].defaultSize))),
  ...baseProducts.flatMap((product) => demoVariants[product.id].sizes.filter(([size]) => size !== demoVariants[product.id].defaultSize).map((variant) => makeVariant(product, variant))),
];

export function productVariants(id) {
  const product = products.find((item) => item.id === id);
  return product ? products.filter((item) => item.groupId === product.groupId).sort((a, b) => a.sizeValue - b.sizeValue) : [];
}
export function groupProducts(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.groupId || item.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
