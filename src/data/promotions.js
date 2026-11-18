// "Beli X gratis Y" promotions, shared by the server (which decides) and the store pages
// (which show the same numbers before ordering).
//
// A promotion belongs to one SKU, so it counts that SKU's own packaging: a promotion on the
// "Satuan" SKU counts satuan, one on the "Dus" SKU counts dus. The buyer pays for what is in
// the cart and receives the free units on top ("bayar 2, terima 3").

/** Today in Indonesia (WIB), YYYY-MM-DD: promotion dates follow the store's calendar. */
export const jakartaDate = (time = Date.now()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(time));

export const promotionLabel = (promotion) => `Beli ${promotion.buy} gratis ${promotion.free}`;

/** Switched on and within its dates (both inclusive). */
export function promotionRunning(promotion, today) {
  return Boolean(
    promotion?.active &&
    (!promotion.startsOn || today >= promotion.startsOn) &&
    (!promotion.endsOn || today <= promotion.endsOn),
  );
}

/** The promotion running today for a SKU, or null. */
export function promotionFor(promotions, variantId, today) {
  return (
    (promotions || []).find(
      (promotion) => promotion.variantId === variantId && promotionRunning(promotion, today),
    ) || null
  );
}

/** Free units for `paid` units: every full `buy` earns `free`, up to the per-order limit. */
export function freeQuantity(promotion, paid) {
  if (!promotion || !Number.isSafeInteger(paid) || paid < promotion.buy) return 0;
  const earned = Math.floor(paid / promotion.buy) * promotion.free;
  return promotion.maxFree ? Math.min(earned, promotion.maxFree) : earned;
}

/**
 * Free units a cart line will receive: the promotion's count, limited by the stock left after
 * the paid units (`maximum` = most packages that can be ordered). The server applies the same
 * limit when the order is made.
 */
export function lineFree(promotion, quantity, maximum) {
  const free = freeQuantity(promotion, quantity);
  return Number.isFinite(maximum) ? Math.max(0, Math.min(free, maximum - quantity)) : free;
}

/** How many more to add for the next free unit; 0 when the limit is reached. */
export function unitsToNextFree(promotion, paid) {
  if (!promotion) return 0;
  if (promotion.maxFree && freeQuantity(promotion, paid) >= promotion.maxFree) return 0;
  const remainder = paid % promotion.buy;
  return promotion.buy - remainder;
}

/** Short terms shown with the badge, e.g. "Maks. 3 gratis per pesanan · s.d. 31 Des 2026". */
export function promotionTerms(promotion) {
  const parts = [];
  if (promotion.maxFree) parts.push(`Maks. ${promotion.maxFree} gratis per pesanan`);
  if (promotion.endsOn)
    parts.push(
      's.d. ' +
        new Date(promotion.endsOn + 'T00:00:00').toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
    );
  parts.push('selama stok tersedia');
  return parts.join(' · ');
}
