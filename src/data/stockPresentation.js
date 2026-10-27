import { packagingErrors, packagingValues } from './productPackaging.js';

// The overview divides a single shared unit balance; SKU rows remain alternatives.
export function stockBreakdown(available, variants) {
  if (!Number.isSafeInteger(available) || available < 0)
    throw new RangeError('Stok harus berupa bilangan bulat, minimal 0.');
  const choices = variants
    .filter((variant) => !Object.keys(packagingErrors(variant)).length)
    .map(packagingValues);
  const bySize = (a, b) => b.unitsPerPackage - a.unitsPerPackage;
  const box = choices.filter((entry) => entry.packagingType === 'dus').sort(bySize)[0];
  const packs = choices.filter((entry) => entry.packagingType === 'pack').sort(bySize);
  // A declared inner pack belongs to this box even if it has no separate sale SKU.
  const packChoice =
    packs.find((entry) => !box || entry.unitsPerPackage < box.unitsPerPackage) || packs[0];
  const packUnits = box?.packsPerBox
    ? box.unitsPerPackage / box.packsPerBox
    : packChoice?.unitsPerPackage || 0;
  const boxUnits = box?.unitsPerPackage || 0;
  const extra = ['box', 'renceng'].filter((type) =>
    choices.some((entry) => entry.packagingType === type),
  );
  const factors = { dus: boxUnits, pack: packUnits };
  for (const type of extra)
    factors[type] = Math.max(
      ...choices
        .filter((entry) => entry.packagingType === type)
        .map((entry) => entry.unitsPerPackage),
    );
  const order = [
    'dus',
    ...(extra.includes('box') ? ['box'] : []),
    'pack',
    ...(extra.includes('renceng') ? ['renceng'] : []),
  ];
  let remaining = available;
  const counts = {};
  for (const type of [...order].sort((a, b) => factors[b] - factors[a])) {
    counts[type] = factors[type] ? Math.floor(remaining / factors[type]) : 0;
    remaining -= counts[type] * factors[type];
  }
  const names = { dus: 'Dus', box: 'Box', pack: 'Pack', renceng: 'Renceng' };
  return {
    totalUnits: available,
    items: [
      ...order.map((type) => ({
        type,
        name: names[type],
        quantity: counts[type],
        unitsPerPackage: factors[type],
      })),
      { type: 'satuan', name: 'Satuan', quantity: remaining, unitsPerPackage: 1 },
    ],
  };
}
