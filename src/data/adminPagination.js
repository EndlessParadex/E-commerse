// Render only a bounded slice of the full filtered result on every screen.
export function paginateAdminList(items, requestedPage = 1, pageSize = 24) {
  if (!Array.isArray(items)) throw new TypeError('Expected an array of items.');
  if (!Number.isSafeInteger(pageSize) || pageSize < 1)
    throw new RangeError('Page size must be a positive integer.');
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Number.isSafeInteger(requestedPage)
    ? Math.min(Math.max(1, requestedPage), pages)
    : 1;
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    page,
    pages,
  };
}
