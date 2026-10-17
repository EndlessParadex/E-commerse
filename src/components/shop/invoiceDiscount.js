// Invoice discounts are calculated only from price snapshots stored on the order.
// Never consult the current catalog: its prices may have changed since checkout.
export function invoiceDiscount(item) {
  const price = item?.price;
  const oldPrice = item?.oldPrice;
  const quantity = item?.quantity;
  if (
    !Number.isSafeInteger(price) || price < 0 ||
    !Number.isSafeInteger(oldPrice) || oldPrice <= price ||
    !Number.isSafeInteger(quantity) || quantity <= 0
  ) return null;
  const savings = (oldPrice - price) * quantity;
  if (!Number.isSafeInteger(savings)) return null;
  const percentage = ((oldPrice - price) / oldPrice) * 100;
  return {
    oldPrice,
    price,
    percentage: percentage < 1 ? percentage.toFixed(1) : String(Math.round(percentage)),
    savings,
    subtotal: price * quantity,
  };
}
