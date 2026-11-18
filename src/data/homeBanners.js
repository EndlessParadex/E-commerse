import { products, groupProducts } from './products.js';
import { categories, categoryBy } from './catalog.js';
import { supplierBy } from './suppliers.js';
import { brands } from './catalogMasters.js';
import { promoSlides } from './promoSlides.js';

// Banners saved by Admin/Pemilik (server), turned into carousel slides. Until banners are saved
// (or when none is showing today) the automatic per-category slides are used.

export const BANNER_THEMES = [
  { id: 'snack', label: 'Biru' },
  { id: 'beauty', label: 'Merah muda' },
  { id: 'spice', label: 'Jingga' },
  { id: 'home', label: 'Hijau' },
];
export const BANNER_TARGETS = [
  { id: 'category', label: 'Kategori' },
  { id: 'supplier', label: 'PT pemasok' },
  { id: 'brand', label: 'Merek' },
  { id: 'product', label: 'Produk' },
  { id: 'catalog', label: 'Seluruh katalog' },
];

let state = { loaded: false, configured: false, banners: [] };
const listeners = new Set();
let loading = null;
export const subscribeBanners = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const bannerState = () => state;
export function setBanners(next) {
  state = { loaded: true, configured: next.configured === true, banners: next.banners || [] };
  listeners.forEach((listener) => listener());
}
/** Loads what the store shows today. A failure keeps the automatic banners. */
// fetch must be called on the window, never as a detached function ("Illegal invocation").
export function loadBanners(request = (...args) => globalThis.fetch(...args)) {
  loading ??= request('/api/home/banners', { credentials: 'include', cache: 'no-store' })
    .then((response) => (response.ok ? response.json() : null))
    .then((value) => {
      if (value && Array.isArray(value.banners)) setBanners(value);
    })
    .catch(() => {})
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** Link for the banner button. */
export function targetHref(target) {
  const id = encodeURIComponent(target?.id || '');
  switch (target?.type) {
    case 'category':
      return categoryBy(target.id) ? `#/kategori/${id}` : '#/cari?q=';
    case 'supplier':
      return supplierBy(target.id) ? `#/pemasok/${id}` : '#/cari?q=';
    case 'brand':
      return brands.some((brand) => brand.id === target.id) ? `#/cari?q=&merek=${id}` : '#/cari?q=';
    case 'product':
      return products.some((product) => product.id === target.id) ? `#/produk/${id}` : '#/cari?q=';
    default:
      return '#/cari?q=';
  }
}
/** Name of what the banner points to, used when no small label was written. */
export function targetName(target, catalog = products) {
  switch (target?.type) {
    case 'category':
      return categoryBy(target.id)?.name || '';
    case 'supplier':
      return supplierBy(target.id)?.name || '';
    case 'brand':
      return brands.find((brand) => brand.id === target.id)?.name || '';
    case 'product': {
      const product = catalog.find((item) => item.id === target.id);
      return product ? product.baseName || product.name : '';
    }
    default:
      return 'Seluruh katalog';
  }
}
/** Products the banner's button leads to; the automatic picks come from here. */
export function targetProducts(target, catalog = products) {
  switch (target?.type) {
    case 'category':
      return catalog.filter((product) => product.categoryId === target.id);
    case 'supplier': {
      const ids = new Set(supplierBy(target.id)?.productIds || []);
      return catalog.filter((product) => ids.has(product.id));
    }
    case 'brand':
      return catalog.filter((product) => product.brandId === target.id);
    case 'product': {
      const chosen = catalog.find((product) => product.id === target.id);
      const group = chosen?.groupId || chosen?.id;
      return chosen ? catalog.filter((product) => (product.groupId || product.id) === group) : [];
    }
    default:
      return catalog;
  }
}
// The cheapest size of a product (prices may be hidden for visitors: keep the first then).
const cheapest = (catalog, group) =>
  catalog
    .filter((item) => (item.groupId || item.id) === (group.groupId || group.id))
    .reduce((minimum, item) =>
      Number.isFinite(item.price) && item.price < (minimum.price ?? Infinity) ? item : minimum,
    );
/** Up to two products for a product-card banner: the chosen ones, or picked automatically. */
export function bannerProducts(banner, catalog = products) {
  const chosen = (banner.productIds || [])
    .map((id) => catalog.find((product) => product.id === id))
    .filter(Boolean);
  if (chosen.length) return chosen.slice(0, 2);
  const scoped = targetProducts(banner.target, catalog);
  return groupProducts(scoped)
    .slice(0, 2)
    .map((group) => cheapest(scoped, group));
}

export function bannerSlide(banner, catalog = products) {
  const image = banner.media === 'image' && banner.image;
  return {
    id: banner.id,
    theme: banner.theme,
    category: banner.label || targetName(banner.target, catalog) || 'Pilihan katalog',
    title: banner.title,
    description: banner.description,
    cta: banner.cta,
    href: targetHref(banner.target),
    image: image || '',
    imageAlt: image ? banner.imageAlt || banner.title.replace(/\n/g, ' ') : '',
    featured: image ? [] : bannerProducts(banner, catalog),
  };
}

/** Slides for the home carousel: saved banners shown today, else the automatic ones. */
export function homeSlides(catalog = products, categoryList = categories, current = state) {
  if (current.configured && current.banners.length)
    return current.banners.map((banner) => bannerSlide(banner, catalog));
  return promoSlides(catalog, categoryList);
}
