import { stockBreakdown } from './stockPresentation.js';

export const maxStockUnits = 1_000_000_000;
export const stockEditorTypes = [
  { id: 'dus', label: 'Dus' },
  { id: 'karton', label: 'Karton' },
  { id: 'pack', label: 'Pack' },
  { id: 'satuan', label: 'Satuan' },
];

export function stockEditorFactors(variants) {
  const items = stockBreakdown(0, variants).items;
  // Karton is not a catalog packaging type yet. Never assume it means Dus.
  return {
    dus: items.find((item) => item.type === 'dus')?.unitsPerPackage || 0,
    karton: 0,
    pack: items.find((item) => item.type === 'pack')?.unitsPerPackage || 0,
    satuan: 1,
  };
}

export function stockEditorCounts(available, variants) {
  const items = stockBreakdown(available, variants).items;
  return {
    dus: String(items.find((item) => item.type === 'dus')?.quantity || 0),
    karton: '0',
    pack: String(items.find((item) => item.type === 'pack')?.quantity || 0),
    satuan: String(items.find((item) => item.type === 'satuan')?.quantity || 0),
  };
}

export function stockEditorEmpty() {
  return { dus: '0', karton: '0', pack: '0', satuan: '0' };
}

export function previewStockEditor({ mode, counts, available, factors }) {
  const invalid = (message) => ({ units: null, finalStock: null, error: message });
  if (mode !== 'replace' && mode !== 'add') return invalid('Jenis perubahan stok tidak valid.');
  if (!Number.isSafeInteger(available) || available < 0 || available > maxStockUnits)
    return invalid('Stok saat ini belum dapat diperiksa.');
  let units = 0;
  for (const { id, label } of stockEditorTypes) {
    const text = counts?.[id];
    if (typeof text !== 'string' || !/^\d+$/.test(text))
      return invalid(`Jumlah ${label} harus bilangan bulat, minimal 0.`);
    const quantity = Number(text);
    if (!Number.isSafeInteger(quantity) || quantity > maxStockUnits)
      return invalid(`Jumlah ${label} terlalu besar.`);
    const multiplier = factors?.[id];
    if (!Number.isSafeInteger(multiplier) || multiplier < 0)
      return invalid('Konversi kemasan tidak valid.');
    if (!multiplier && quantity > 0)
      return invalid(`Kemasan ${label} belum tersedia pada katalog produk ini.`);
    const contribution = quantity * multiplier;
    if (!Number.isSafeInteger(contribution) || units + contribution > maxStockUnits)
      return invalid('Total stok tidak boleh melebihi 1.000.000.000 satuan.');
    units += contribution;
  }
  const finalStock = mode === 'add' ? available + units : units;
  if (finalStock > maxStockUnits)
    return invalid('Stok setelah penambahan tidak boleh melebihi 1.000.000.000 satuan.');
  return { units, finalStock, error: '' };
}
