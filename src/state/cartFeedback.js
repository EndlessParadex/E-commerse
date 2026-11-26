// A tiny window event so any "add to cart" button can show the shared popup
// without threading callbacks through every page.
export const CART_ADDED_EVENT = 'bam:cart-added';

/**
 * Tell the storefront that an item was added.
 * @param {{product: object, quantity?: number, source?: Element|null}} detail
 */
export function announceCartAdd({ product, quantity = 1, source = null }) {
  if (typeof window === 'undefined' || !product) return;
  let rect = null;
  try {
    const box = source?.getBoundingClientRect?.();
    if (box && box.width > 0 && box.height > 0)
      rect = { left: box.left, top: box.top, width: box.width, height: box.height };
  } catch {
    rect = null;
  }
  // Feedback only: a failure here must never break adding to the cart.
  try {
    const Event = window.CustomEvent || CustomEvent;
    window.dispatchEvent(new Event(CART_ADDED_EVENT, { detail: { product, quantity, rect } }));
  } catch {
    /* ignore */
  }
}
