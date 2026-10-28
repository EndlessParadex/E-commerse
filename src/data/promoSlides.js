import { companySnapshot } from './companyStore.js';
import { products, groupProducts } from './products.js';
import { categories } from './catalog.js';

const themes = { snack: 'snack', beauty: 'beauty', bumbu: 'spice', rumah: 'home' };
const copy = {
  snack: {
    title: 'Stok camilan,\ntoko makin lengkap.',
    description:
      'Lengkapi rak tokomu dengan pilihan camilan, ukuran, dan kemasan dari katalog BAM.',
  },
  beauty: {
    title: 'Produk perawatan\nuntuk kebutuhan toko.',
    description: 'Jelajahi kategori perawatan dan kecantikan untuk melengkapi kebutuhan pelanggan.',
  },
  bumbu: {
    title: 'Lengkapi pilihan\nbumbu dan dapur.',
    description: 'Pilih bumbu, ukuran, dan kemasan sesuai kebutuhan usaha dan rumah tangga.',
  },
  rumah: {
    title: 'Kebutuhan rumah,\ntersedia di BAM.',
    description:
      'Temukan perlengkapan rumah serta kebutuhan harian dalam berbagai pilihan kemasan.',
  },
};
export function promoSlides(catalog = products, categoryList = categories) {
  const { profile } = companySnapshot();
  const slides = categoryList.flatMap((category) => {
    const scoped = catalog.filter((product) => product.categoryId === category.id);
    if (!scoped.length) return [];
    const featured = groupProducts(scoped)
      .slice(0, 2)
      .map((group) =>
        scoped
          .filter((item) => (item.groupId || item.id) === (group.groupId || group.id))
          .reduce((minimum, item) => (item.price < minimum.price ? item : minimum)),
      );
    return [
      {
        id: category.id,
        theme: themes[category.id] || 'snack',
        category: category.name,
        label: `PILIHAN DARI KATALOG ${profile.shortName.toUpperCase()}`,
        title: copy[category.id]?.title || `Temukan produk\n${category.name}.`,
        description:
          copy[category.id]?.description?.replace('BAM', profile.shortName) ||
          'Pilih produk, ukuran, dan kemasan yang sesuai kebutuhan Anda.',
        cta: 'Jelajahi kategori',
        href: `#/kategori/${encodeURIComponent(category.id)}`,
        decoration: '✦',
        featured,
      },
    ];
  });
  return slides.length
    ? slides
    : [
        {
          id: 'all',
          theme: 'snack',
          category: `Katalog ${profile.shortName}`,
          label: profile.legalName.toUpperCase(),
          title: catalog.length
            ? 'Semua kebutuhan\ndalam satu katalog.'
            : 'Katalog sedang\ndipersiapkan.',
          description: catalog.length
            ? `Jelajahi seluruh produk yang tersedia di ${profile.shortName}.`
            : 'Produk akan tampil di sini setelah tersedia dalam katalog.',
          cta: 'Lihat katalog',
          href: '#/cari?q=',
          decoration: '✦',
          featured: groupProducts(catalog).slice(0, 2),
        },
      ];
}
