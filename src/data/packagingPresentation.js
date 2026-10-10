import { packagingTypes, packagingValues, sizeKey } from './productPackaging.js';

// Buyer labels count the packages being purchased. Contents remain in the
// catalog and order snapshots so prices and shared stock still use each SKU.
export function purchasePackagingLabel(variant, quantity = 1) {
  const { packagingType } = packagingValues(variant);
  return `${quantity} ${packagingType === 'satuan' ? 'buah' : packagingType}`;
}

function choiceContents(variant, variants) {
  const value = packagingValues(variant);
  const alternatives = variants.filter((entry) => sizeKey(entry) === sizeKey(variant)
    && packagingValues(entry).packagingType === value.packagingType);
  // Two different pack sizes must remain distinguishable when both are sold.
  const contents = new Set(alternatives.map((entry) => packagingValues(entry).unitsPerPackage));
  return contents.size > 1 ? ` (isi ${value.unitsPerPackage})` : '';
}

export function purchasePackagingChoice(variant, variants = []) {
  return purchasePackagingLabel(variant) + choiceContents(variant, variants);
}

export function packagingOptionLabel(variant, variants = []) {
  const { packagingType } = packagingValues(variant);
  const name = packagingTypes.find((entry) => entry.id === packagingType)?.name || 'Satuan';
  return name + choiceContents(variant, variants);
}

export function purchaseProductName(product, variants = []) {
  if (packagingValues(product).packagingType === 'satuan' || !product.baseName) return product.name;
  return `${product.baseName} ${product.sizeLabel} · ${purchasePackagingChoice(product, variants)}`;
}
