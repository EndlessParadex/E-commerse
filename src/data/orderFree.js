// Free promotion units recorded on an order line (see server/workflow.js applyPromotions).
// They cost nothing but are packed, delivered and taken from stock like paid units.

export const freeOf = (item) =>
  Number.isSafeInteger(item?.freeQuantity) && item.freeQuantity > 0 ? item.freeQuantity : 0;

/** Packages to pick and deliver: paid plus free. */
export const orderUnits = (order) =>
  (order?.items || []).reduce((sum, item) => sum + item.quantity + freeOf(item), 0);

/** "+ 1 gratis · Beli 2 gratis 1", or '' when the line has no free units. */
export function freeNote(item) {
  const free = freeOf(item);
  if (!free) return '';
  const label = typeof item.promotion?.label === 'string' ? item.promotion.label : '';
  return `+ ${free} gratis` + (label ? ` · ${label}` : '');
}
