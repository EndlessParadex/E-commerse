import { products } from './products.js';
import { suppliers } from './suppliers.js';
import { categories } from './catalog.js';
import { validCatalogColor } from './catalogColors.js';

export const brands = [...new Map(products.map((product) => [product.brandId, {
  id: product.brandId, name: product.brand,
  supplierIds: suppliers.filter((supplier) => supplier.productIds.some((id) => products.some((item) => item.id === id && item.brandId === product.brandId))).map((supplier) => supplier.id),
}])).values()];
export const brandsForSupplier = (supplierId) => brands.filter((brand) => brand.supplierIds.includes(supplierId));
export const masterSnapshot = () => ({
  suppliers: suppliers.map(({ id, name, initials, color, logo }) => ({ id, name, initials, color, logo })),
  brands: brands.map((brand) => ({ ...brand, supplierIds: [...brand.supplierIds] })),
  categories: categories.map((category) => ({ ...category, children: category.children.map((child) => ({ ...child })) })),
});
const normalized = (name) => name.trim().toLocaleLowerCase('id').replace(/\s+/g, ' ');
export function validateMaster(type, draft, snapshot = masterSnapshot(), checkUsage = true) {
  const errors = {};
  const entries = snapshot[type];
  if (!entries) return { name: 'Jenis data tidak dikenal.' };
  const limit = type === 'brands' ? 80 : 100;
  if (!draft.name.trim() || draft.name.length > limit) errors.name = `Isi nama, maksimal ${limit} karakter.`;
  if (entries.some((entry) => entry.id !== draft.id && normalized(entry.name) === normalized(draft.name))) errors.name = 'Nama sudah digunakan.';
  if (type === 'suppliers') {
    if (!draft.initials.trim() || draft.initials.length > 4) errors.initials = 'Isi singkatan, maksimal 4 karakter.';
    if (!validCatalogColor(draft.color)) errors.color = 'Pilih warna.';
  }
  if (type === 'brands') {
    if (!/[a-z0-9]/i.test(draft.name.normalize('NFKD'))) errors.name = 'Nama merek perlu memuat huruf atau angka.';
    if (!draft.supplierIds.length || draft.supplierIds.some((id) => !snapshot.suppliers.some((supplier) => supplier.id === id))) errors.supplierIds = 'Pilih minimal satu PT pemasok.';
    const used = suppliers.filter((supplier) => supplier.productIds.some((id) => products.some((product) => product.id === id && product.brandId === draft.id)));
    if (checkUsage && used.some((supplier) => !draft.supplierIds.includes(supplier.id))) errors.supplierIds = 'PT yang masih memiliki produk dengan merek ini harus tetap dipilih.';
  }
  if (type === 'categories') {
    if (!['📦', '🍫', '✨', '🍛', '🧼', '💻', '👕'].includes(draft.icon)) errors.icon = 'Pilih ikon.';
    if (!draft.children.length || draft.children.length > 30) errors.children = 'Isi 1–30 subkategori.';
    const seen = new Set();
    draft.children.forEach((child, index) => {
      const name = normalized(child.name);
      if (!name || child.name.length > 80 || seen.has(name)) errors[`children.${index}`] = 'Isi nama subkategori yang unik, maksimal 80 karakter.';
      seen.add(name);
    });
    if (checkUsage && products.some((product) => product.categoryId === draft.id && !draft.children.some((child) => child.id === product.subcategoryId))) errors.children = 'Subkategori yang masih dipakai produk harus dipertahankan.';
  }
  return errors;
}
export function applyMasters(snapshot) {
  suppliers.splice(0, suppliers.length, ...snapshot.suppliers.map((supplier) => ({ ...supplier, productIds: suppliers.find((entry) => entry.id === supplier.id)?.productIds || [] })));
  brands.splice(0, brands.length, ...snapshot.brands.map((brand) => ({ ...brand, supplierIds: [...brand.supplierIds] })));
  categories.splice(0, categories.length, ...snapshot.categories.map((category) => ({ ...category, children: category.children.map((child) => ({ ...child })) })));
  products.forEach((product) => {
    product.brand = brands.find((brand) => brand.id === product.brandId)?.name || product.brand;
    product.category = categories.find((category) => category.id === product.categoryId)?.name || product.category;
  });
}
export function validMasterSnapshot(snapshot, { retainExisting = true, checkUsage = true } = {}) {
  try {
    for (const type of ['suppliers', 'brands', 'categories']) {
      const entries = snapshot[type];
      if (!Array.isArray(entries) || new Set(entries.map((entry) => entry.id)).size !== entries.length) return false;
      for (const entry of entries) {
        if (typeof entry.id !== 'string' || !/^[a-z0-9_-]{1,100}$/.test(entry.id) || Object.keys(validateMaster(type, entry, snapshot, checkUsage)).length) return false;
        if (type === 'categories' && (new Set(entry.children.map((child) => child.id)).size !== entry.children.length || entry.children.some((child) => !/^[a-z0-9_-]{1,100}$/.test(child.id)))) return false;
      }
    }
    // Built-in IDs are retained to keep existing catalog routes valid.
    return !retainExisting || (suppliers.every((entry) => snapshot.suppliers.some((supplier) => supplier.id === entry.id))
      && categories.every((entry) => snapshot.categories.some((category) => category.id === entry.id)));
  } catch { return false; }
}
