/** Product review requests: buyer reviews per order, public lists, Admin moderation. */
async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    cache: 'no-store',
    ...options,
    headers: options.body ? { 'content-type': 'application/json' } : undefined,
    signal: AbortSignal.timeout(15000),
  });
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (!response.ok) {
    const error = new Error(
      response.status === 401
        ? 'Sesi berakhir. Masuk kembali ke akun Anda.'
        : payload.errors?.form || 'Ulasan belum dapat dimuat atau disimpan. Coba lagi.',
    );
    error.status = response.status;
    throw error;
  }
  return payload;
}

const orderPath = (orderId) => '/api/orders/' + encodeURIComponent(orderId) + '/reviews';

export const fetchOrderReviews = (orderId) => api(orderPath(orderId));

export const saveOrderReview = (orderId, { productId, rating, comment }) =>
  api(orderPath(orderId), {
    method: 'PUT',
    body: JSON.stringify({ productId, rating, comment }),
  });

export const fetchProductReviews = (groupId) =>
  api('/api/products/' + encodeURIComponent(groupId) + '/reviews');

export const fetchAdminReviews = (filter = 'all') =>
  api('/api/admin/reviews?filter=' + encodeURIComponent(filter));

export const setReviewHidden = (id, hidden) =>
  api('/api/admin/reviews/' + encodeURIComponent(id), {
    method: 'PUT',
    body: JSON.stringify({ hidden }),
  });
