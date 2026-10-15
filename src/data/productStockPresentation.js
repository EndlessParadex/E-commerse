import { stockKey } from '../state/frontendWorkflow.js';
import { packagingValues } from './productPackaging.js';
export function purchaseStockLabel(product, stock) {
  if (stock.failed) return 'Belum dapat diperiksa';
  if (stock.available === null && typeof stock.inStock === 'boolean')
    return stock.inStock ? 'Tersedia' : 'Habis';
  if (!Number.isSafeInteger(stock.available) || stock.available < 0) return 'Belum dapat diperiksa';
  return `${Math.floor(stock.available / packagingValues(product).unitsPerPackage).toLocaleString('id-ID')} ${packagingValues(product).packagingType}`;
}
export function soldStockLabel(stock) {
  if (stock.failed) return null;
  if (Number.isSafeInteger(stock.soldUnits))
    return `${stock.soldUnits.toLocaleString('id-ID')} satuan terjual`;
  if (Number.isSafeInteger(stock.publishedSoldMinimum))
    return stock.publishedSoldMinimum === 0
      ? 'Belum ada penjualan'
      : `${stock.publishedSoldMinimum.toLocaleString('id-ID')}+ terjual`;
  return null;
}
export function groupSoldStockLabel(variants, stockFor) {
  const stocks = [...new Map(variants.map((v) => [stockKey(v), v])).values()].map(stockFor);
  if (!stocks.length || stocks.some((s) => s.failed)) return null;
  if (stocks.every((s) => Number.isSafeInteger(s.soldUnits)))
    return soldStockLabel({ soldUnits: stocks.reduce((n, s) => n + s.soldUnits, 0) });
  return soldStockLabel(stocks[0]);
}
