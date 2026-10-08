const text = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';

// History must never look up today's catalog to reconstruct an old purchase.
export function orderItemPresentation(item) {
  const match = item.name.match(/\s+(\d+(?:[.,]\d+)?)\s*(g|ml)$/i);
  const details = item.details || {};
  const storedSize = text(details.sizeLabel, 30);
  return {
    name: text(details.name, 200) || (match ? item.name.slice(0, match.index).trim() : item.name),
    brand: text(details.brand, 100),
    sizeLabel: /^\d+(?:[.,]\d+)?(?:g|ml)$/i.test(storedSize) ? storedSize : match ? `${match[1]}${match[2].toLowerCase()}` : '',
    product: { id: item.id, name: item.name, image: text(details.image, 2048), imageAlt: text(details.imageAlt, 250) || item.name, icon: text(details.icon, 16) || '📦', color: text(details.color, 30) },
  };
}
