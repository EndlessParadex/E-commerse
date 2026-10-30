/**
 * Presentation-only order list metadata. Do not infer timestamps for stages
 * that are not explicitly represented in the order snapshot.
 */
export const orderPrimaryFilters = [
  { id: 'all', label: 'Semua' },
  { id: 'active', label: 'Aktif' },
  { id: 'processing', label: 'Diproses' },
  { id: 'shipped', label: 'Dikirim' },
  { id: 'completed', label: 'Selesai' },
];

export const orderExtraFilters = [
  { id: 'awaiting_acceptance', label: 'Menunggu persetujuan total' },
  { id: 'awaiting_payment', label: 'Menunggu pembayaran' },
  { id: 'awaiting_confirmation', label: 'Menunggu konfirmasi COD' },
  { id: 'awaiting_review', label: 'Menunggu pemeriksaan toko' },
  { id: 'cancelled', label: 'Dibatalkan' },
  { id: 'expired', label: 'Kedaluwarsa' },
];

export function orderCardStages(status) {
  const stage = { processing: 1, shipped: 2, completed: 3 }[status];
  if (stage === undefined) return [];
  return ['Dibuat', 'Diproses', 'Dikirim', 'Selesai'].map((label, index) => ({
    label,
    state: index < stage ? 'done' : index === stage ? 'current' : 'pending',
  }));
}
