import { packagingErrors, packagingValues } from './productPackaging.js';

// The overview divides a single shared unit balance; SKU rows remain alternatives.
export function stockBreakdown(available, variants) {
  if (!Number.isSafeInteger(available) || available < 0) throw new RangeError('Stok harus berupa bilangan bulat, minimal 0.');
  const choices = variants.filter((variant) => !Object.keys(packagingErrors(variant)).length).map(packagingValues);
  const bySize = (a, b) => b.unitsPerPackage - a.unitsPerPackage;
  const box = choices.filter((entry) => entry.packagingType === 'dus').sort(bySize)[0];
  const packs = choices.filter((entry) => entry.packagingType === 'pack').sort(bySize);
  // A declared inner pack belongs to this box even if it has no separate sale SKU.
  const packChoice = packs.find((entry) => !box || entry.unitsPerPackage < box.unitsPerPackage) || packs[0];
  const packUnits = box?.packsPerBox ? box.unitsPerPackage / box.packsPerBox : packChoice?.unitsPerPackage || 0;
  const boxUnits = box?.unitsPerPackage || 0;
  const boxes = boxUnits ? Math.floor(available / boxUnits) : 0;
  const afterBoxes = available - boxes * boxUnits;
  const packCount = packUnits ? Math.floor(afterBoxes / packUnits) : 0;
  return {
    totalUnits: available,
    items: [
      { type: 'dus', name: 'Dus', quantity: boxes, unitsPerPackage: boxUnits },
      { type: 'pack', name: 'Pack', quantity: packCount, unitsPerPackage: packUnits },
      { type: 'satuan', name: 'Satuan', quantity: afterBoxes - packCount * packUnits, unitsPerPackage: 1 },
    ],
  };
}
