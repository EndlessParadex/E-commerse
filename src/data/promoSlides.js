import { products, groupProducts } from './products.js';
import { categories } from './catalog.js';

const themes = { snack: 'snack', beauty: 'beauty', bumbu: 'spice', rumah: 'home' };
const copy = {
  snack: { title: 'Camilan favorit.\nSaatnya santai.', description: 'Dari renyah hingga manis. Pilih camilan, ukuran, dan kemasan untuk menemani harimu.' },
  beauty: { title: 'Rawat diri.\nNikmati harimu.', description: 'Temukan pilihan perawatan dan kecantikan untuk rutinitas sehari-harimu.' },
  bumbu: { title: 'Bumbu pilihan.\nRasa istimewa.', description: 'Lengkapi dapurmu dengan pilihan bumbu. Sesuaikan ukuran dan kemasannya.' },
  rumah: { title: 'Rumah nyaman.\nPilihanmu di sini.', description: 'Jelajahi perlengkapan rumah dan kebutuhan sehari-hari dari katalog BAM.' },
};
export function promoSlides(catalog = products, categoryList = categories) {
  const slides = categoryList.flatMap((category) => {
    const scoped = catalog.filter((product) => product.categoryId === category.id);
    if (!scoped.length) return [];
    const featured = groupProducts(scoped).slice(0, 2).map((group) => scoped.filter((item) => (item.groupId || item.id) === (group.groupId || group.id)).reduce((minimum, item) => item.price < minimum.price ? item : minimum));
    return [{ id: category.id, theme: themes[category.id] || 'snack', category: category.name, label: 'PILIHAN DARI KATALOG BAM', title: copy[category.id]?.title || `Temukan pilihan\n${category.name}.`, description: copy[category.id]?.description || 'Pilih produk, ukuran, dan kemasan yang sesuai kebutuhan Anda.', cta: 'Jelajahi kategori', href: `#/kategori/${encodeURIComponent(category.id)}`, decoration: '✦', featured }];
  });
  return slides.length ? slides : [{ id: 'all', theme: 'snack', category: 'Katalog BAM', label: 'CV. BELITUNG ARTA MANDIRI', title: catalog.length ? 'Temukan pilihan\nuntuk kebutuhanmu.' : 'Katalog sedang\ndipersiapkan.', description: catalog.length ? 'Jelajahi seluruh produk yang tersedia di BAM.' : 'Produk akan tampil di sini setelah tersedia dalam katalog.', cta: 'Lihat katalog', href: '#/cari?q=', decoration: '✦', featured: groupProducts(catalog).slice(0, 2) }];
}
