import { compareVariants } from './productPackaging.js';

/**
 * SKUs grouped into their products, in catalog order. Each group keeps its SKUs ordered
 * from the smallest size and packaging up, plus the price range and the PT names involved.
 */
export function groupAdminProducts(skus) {
  const groups = new Map();
  for (const sku of skus) {
    let group = groups.get(sku.groupId);
    if (!group) {
      group = { groupId: sku.groupId, baseName: sku.baseName, brand: sku.brand, skus: [] };
      groups.set(sku.groupId, group);
    }
    group.skus.push(sku);
  }
  return [...groups.values()].map((group) => {
    const ordered = [...group.skus].sort(compareVariants);
    const prices = ordered.map((sku) => sku.price);
    return {
      ...group,
      skus: ordered,
      first: group.skus[0],
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      suppliers: [...new Set(ordered.map((sku) => sku.supplier?.name).filter(Boolean))],
    };
  });
}

/**
 * Page numbers to show around the current page: always the first and last page, the
 * neighbours of the current page, and null where a run of pages is skipped.
 */
export function pageNumbers(page, pages) {
  const wanted = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((value) => wanted.add(value));
  if (page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((value) => wanted.add(value));
  const list = [...wanted].filter((value) => value >= 1 && value <= pages).sort((a, b) => a - b);
  const result = [];
  list.forEach((value, index) => {
    if (index && value - list[index - 1] > 1) result.push(null);
    result.push(value);
  });
  return result;
}
