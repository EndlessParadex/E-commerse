// Makes saving shop photos less casual: no "Save image" menu on right-click or long-press,
// and no dragging a photo out of the page. A determined visitor can still take a screenshot;
// this only stops the one-click copy. Form fields and the admin area are left alone.
export function guardStoreImages(root = document) {
  const isGuarded = (target) =>
    target instanceof Element &&
    target.tagName === 'IMG' &&
    Boolean(target.closest('.page-main--store, .cart-added-region, .cart-flyer'));
  const block = (event) => {
    if (isGuarded(event.target)) event.preventDefault();
  };
  root.addEventListener('contextmenu', block);
  root.addEventListener('dragstart', block);
  return () => {
    root.removeEventListener('contextmenu', block);
    root.removeEventListener('dragstart', block);
  };
}
