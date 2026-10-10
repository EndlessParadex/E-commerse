import { categories } from './catalog.js';
import { products } from './products.js';
import { suppliers } from './suppliers.js';
import { productDescriptions } from './productDescriptions.js';
import { brands } from './catalogMasters.js';
import { validCatalogColor } from './catalogColors.js';
import { packagingValues, packagingErrors, packagingLabel, variantKey } from './productPackaging.js';

export const CATALOG_STORAGE_KEY = 'bam.admin.catalog.v1';
export const slug = (value) => value.trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const emptyVariant = () => ({ id: '', sizeValue: '', sizeUnit: 'g', packagingType: 'satuan', unitsPerPackage: '1', packsPerBox: '', price: '', oldPrice: '' });
export function productDraft(groupId, items = products) {
  const variants = items.filter((item) => item.groupId === groupId);
  const first = variants[0];
  return first ? {
    groupId, baseName: first.baseName, brand: first.brand, brandId: first.brandId, supplierId: suppliers.find((supplier) => supplier.productIds.includes(first.id))?.id || '',
    categoryId: first.categoryId, subcategoryId: first.subcategoryId,
    description: first.description ?? productDescriptions[groupId] ?? '',
    image: first.image || '', imageAlt: first.imageAlt || '', color: first.color || 'sky',
    variants: variants.map((variant) => { const { id, sizeValue, sizeUnit, price, oldPrice } = variant; const pack = packagingValues(variant); return { id, sizeValue: String(sizeValue), sizeUnit, ...pack, unitsPerPackage: String(pack.unitsPerPackage), packsPerBox: pack.packsPerBox ? String(pack.packsPerBox) : '', price: String(price), oldPrice: oldPrice ? String(oldPrice) : '' }; }),
  } : { groupId: '', baseName: '', brand: '', brandId: '', supplierId: '', categoryId: '', subcategoryId: '', description: '', image: '', imageAlt: '', color: 'sky', variants: [emptyVariant()] };
}
export function validateDraft(draft, items = products) {
  const errors = {};
  if (draft.color && !validCatalogColor(draft.color)) errors.color = 'Pilih warna kartu.';
  if (!draft.baseName.trim() || draft.baseName.length > 120) errors.baseName = 'Isi nama produk, maksimal 120 karakter.';
  if (!draft.brand.trim() || !slug(draft.brand) || draft.brand.length > 80) { errors.brand = 'Isi merek dengan huruf atau angka, maksimal 80 karakter.'; errors.brandId = 'Pilih merek.'; }
  if (draft.brandId && !brands.some((brand) => brand.id === draft.brandId && brand.supplierIds.includes(draft.supplierId))) errors.brandId = 'Pilih merek yang terhubung dengan PT pemasok ini.';
  if (!suppliers.some((supplier) => supplier.id === draft.supplierId)) errors.supplierId = 'Pilih PT pemasok.';
  const category = categories.find((entry) => entry.id === draft.categoryId);
  if (!category) errors.categoryId = 'Pilih kategori.';
  if (!category?.children.some((entry) => entry.id === draft.subcategoryId)) errors.subcategoryId = 'Pilih subkategori.';
  if (!draft.description.trim() || draft.description.length > 3000) errors.description = 'Isi deskripsi produk, maksimal 3.000 karakter.';
  if (draft.image && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(draft.image)) errors.image = 'Gunakan foto JPG, PNG, atau WebP.';
  if (!draft.variants.length) errors.variants = 'Tambahkan minimal satu varian.';
  if (draft.variants.length > 20) errors.variants = 'Maksimal 20 varian per produk.';
  if (items.some((item) => item.groupId === draft.groupId && !draft.variants.some((variant) => variant.id === item.id))) errors.variants = 'SKU yang sudah ada harus dipertahankan.';
  const seenIds = new Set(); const seenSizes = new Set();
  draft.variants.forEach((variant, index) => {
    const key = `variants.${index}`;
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(variant.id)) errors[`${key}.id`] = 'SKU wajib diisi, maksimal 64 karakter: huruf, angka, - atau _.';
    else if (seenIds.has(variant.id.toLowerCase()) || items.some((item) => item.groupId !== draft.groupId && item.id.toLowerCase() === variant.id.toLowerCase())) errors[`${key}.id`] = 'SKU sudah digunakan.';
    seenIds.add(variant.id.toLowerCase());
    const size = Number(variant.sizeValue);
    if (!Number.isFinite(size) || size <= 0 || size > 1000000 || !['g', 'ml', 'pcs'].includes(variant.sizeUnit)) errors[`${key}.sizeValue`] = 'Ukuran harus lebih dari 0, maksimal 1.000.000.';
    for (const [field, message] of Object.entries(packagingErrors(variant))) errors[`${key}.${field}`] = message;
    const combination = variantKey(variant);
    if (seenSizes.has(combination)) errors[`${key}.sizeValue`] = 'Kombinasi ukuran, jenis, dan isi kemasan ini sudah ditambahkan.';
    seenSizes.add(combination);
    const price = Number(variant.price); const oldPrice = Number(variant.oldPrice);
    if (!Number.isSafeInteger(price) || price <= 0 || price > 1000000000) errors[`${key}.price`] = 'Harga harus berupa rupiah bulat, antara 1 dan 1.000.000.000.';
    if (variant.oldPrice && (!Number.isSafeInteger(oldPrice) || oldPrice <= price || oldPrice > 1000000000)) errors[`${key}.oldPrice`] = 'Harga sebelum diskon harus lebih besar dari harga jual.';
  });
  return errors;
}
export function buildVariants(draft, items = products) {
  const existing = items.filter((item) => item.groupId === draft.groupId);
  const groupId = draft.groupId || `local-${draft.variants[0].id}`;
  const category = categories.find((entry) => entry.id === draft.categoryId);
  return draft.variants.map((variant) => {
    const original = existing.find((item) => item.id === variant.id) || existing[0] || {};
    const sizeValue = Number(variant.sizeValue); const sizeLabel = `${sizeValue}${variant.sizeUnit}`;
    const changedImage = draft.image !== (existing[0]?.image || '');
    const packaging = packagingValues(variant);
    return { ...original, id: variant.id, groupId, baseName: draft.baseName.trim(), name: `${draft.baseName.trim()} ${sizeLabel}${packaging.packagingType === 'satuan' ? '' : ` · ${packagingLabel(variant)}`}`,
      brand: brands.find((brand) => brand.id === draft.brandId)?.name || draft.brand.trim(), brandId: draft.brandId || slug(draft.brand), categoryId: draft.categoryId, subcategoryId: draft.subcategoryId, category: category.name,
      description: draft.description.trim(), image: draft.image, imageAlt: draft.imageAlt.trim() || draft.baseName.trim(), gallery: changedImage ? [] : (original.gallery || []),
      sizeValue, sizeUnit: variant.sizeUnit, sizeLabel, ...packaging, grams: variant.sizeUnit === 'g' ? sizeValue : null,
      price: Number(variant.price), oldPrice: Number(variant.oldPrice) || 0, rating: original.rating ?? 0, sold: original.sold ?? '0', icon: original.icon || '📦', color: draft.color || original.color || 'sky', tag: original.tag || '',
    };
  });
}
