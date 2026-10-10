export const packagingTypes = [
  { id: 'satuan', name: 'Satuan' }, { id: 'pack', name: 'Pack' }, { id: 'dus', name: 'Dus' },
];

// Missing fields belong to the catalog before packaging variants were introduced.
export function packagingValues(variant) {
  return {
    packagingType: variant.packagingType ?? 'satuan',
    unitsPerPackage: Number(variant.unitsPerPackage ?? 1),
    packsPerBox: Number(variant.packsPerBox ?? 0),
  };
}
export function packagingErrors(variant) {
  const value = packagingValues(variant); const errors = {};
  if (!packagingTypes.some((entry) => entry.id === value.packagingType)) errors.packagingType = 'Pilih Satuan, Pack, atau Dus.';
  if (!Number.isSafeInteger(value.unitsPerPackage) || value.unitsPerPackage > 1000000
    || (value.packagingType === 'satuan' ? value.unitsPerPackage !== 1 : value.unitsPerPackage < 2)) {
    errors.unitsPerPackage = value.packagingType === 'satuan' ? 'Kemasan satuan harus berisi 1 satuan.' : 'Isi kemasan harus bilangan bulat, antara 2 dan 1.000.000 satuan.';
  }
  if (!Number.isSafeInteger(value.packsPerBox) || value.packsPerBox < 0 || value.packsPerBox > 1000000
    || (value.packagingType !== 'dus' && value.packsPerBox !== 0)
    || (value.packsPerBox && (value.packsPerBox < 2 || value.unitsPerPackage % value.packsPerBox !== 0 || value.unitsPerPackage / value.packsPerBox < 2))) {
    errors.packsPerBox = 'Jumlah pack harus membagi isi dus secara tepat, minimal 2 pack dengan isi minimal 2 satuan per pack.';
  }
  return errors;
}
export const sizeKey = (variant) => `${Number(variant.sizeValue)}-${variant.sizeUnit}`;
export const packagingKey = (variant) => { const value = packagingValues(variant); return `${value.packagingType}-${value.unitsPerPackage}`; };
export const variantKey = (variant) => `${sizeKey(variant)}-${packagingKey(variant)}`;
export function packagingLabel(variant) {
  const value = packagingValues(variant);
  const label = packagingTypes.find((entry) => entry.id === value.packagingType)?.name || 'Satuan';
  return value.packagingType === 'satuan' ? label : `${label} isi ${value.unitsPerPackage} satuan`;
}
export function packagingContents(variant) {
  const value = packagingValues(variant);
  if (value.packagingType === 'satuan') return `1 satuan${variant.sizeLabel ? ` berukuran ${variant.sizeLabel}` : ''}`;
  const count = value.packsPerBox ? `${value.packsPerBox} pack × ${value.unitsPerPackage / value.packsPerBox} satuan = ${value.unitsPerPackage} satuan` : `${value.unitsPerPackage} satuan`;
  return `1 ${value.packagingType} = ${count}${variant.sizeLabel ? ` (${variant.sizeLabel} per satuan)` : ''}`;
}
export function packagingQuantity(variant, quantity) {
  const value = packagingValues(variant);
  return value.packagingType === 'satuan' ? '' : `${quantity} ${value.packagingType} = ${quantity * value.unitsPerPackage} satuan`;
}
export function packagingSnapshot(product) {
  return { ...packagingValues(product), sizeLabel: product.sizeLabel || `${product.sizeValue}${product.sizeUnit}` };
}
export function readPackagingSnapshot(value) {
  if (!value || Object.keys(packagingErrors(value)).length || typeof value.sizeLabel !== 'string' || !/^\d+(?:[.,]\d+)?(?:g|ml|pcs)$/i.test(value.sizeLabel) || value.sizeLabel.length > 30) return null;
  return { ...packagingValues(value), sizeLabel: value.sizeLabel };
}

// Preserve the closest available packaging when changing size. Never invent a SKU.
export function variantForSize(variants, size, current) {
  const available = variants.filter((variant) => sizeKey(variant) === sizeKey(size));
  return available.find((variant) => packagingKey(variant) === packagingKey(current))
    || available.find((variant) => packagingValues(variant).packagingType === packagingValues(current).packagingType) || available[0];
}
