import { orderItemPresentation } from './orderItemPresentation.js';

export const packingColumns = [
  ['satuan', 'Satuan'],
  ['pack', 'Pack'],
  ['box', 'Box'],
  ['dus', 'Dus'],
  ['renceng', 'Renceng'],
];

// Whitelist print fields from the immutable order snapshot. Never use today's catalog.
export function b2bPackingList(order) {
  if (!order?.b2b?.storeName || !Array.isArray(order.items) || !order.items.length)
    throw new Error('Dokumen memerlukan pesanan toko yang sudah difinalisasi.');
  const totals = Object.fromEntries(packingColumns.map(([key]) => [key, 0]));
  const types = new Set();
  const rows = order.items.map((item) => {
    if (!item || typeof item.name !== 'string')
      throw new Error('Snapshot barang pesanan ini belum lengkap. Dokumen tidak dapat dicetak.');
    const shown = orderItemPresentation(item);
    if (
      !shown.packaging ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 99
    )
      throw new Error(
        'Snapshot kemasan pesanan ini belum lengkap. Dokumen tidak dapat dicetak dengan konversi perkiraan.',
      );
    const { packagingType, unitsPerPackage } = shown.packaging;
    if (!Object.hasOwn(totals, packagingType))
      throw new Error('Jenis kemasan pesanan belum dikenali.');
    totals[packagingType] += item.quantity;
    types.add(`${shown.brand}\u0000${shown.name}\u0000${shown.sizeLabel}`);
    return {
      name: shown.name,
      size: shown.sizeLabel,
      contents: packagingType === 'satuan' ? '' : `1 ${packagingType} = ${unitsPerPackage} satuan`,
      quantities: { [packagingType]: item.quantity },
    };
  });
  return {
    storeName: order.b2b.storeName,
    salesNames:
      [...new Set((order.b2b.sales || []).map((person) => person.name).filter(Boolean))].join(
        ', ',
      ) || '—',
    rows,
    totals,
    productCount: types.size,
  };
}
