/** Home banner requests for the admin page. */
async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    cache: 'no-store',
    ...options,
    headers: options.body ? { 'content-type': 'application/json' } : undefined,
    signal: AbortSignal.timeout(30000),
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
        : response.status === 403
          ? 'Hanya Admin atau Pemilik yang dapat mengubah banner.'
          : payload.errors?.form || 'Banner belum dapat dimuat atau disimpan. Coba lagi.',
    );
    error.status = response.status;
    throw error;
  }
  return payload;
}

export const fetchAdminBanners = () => api('/api/admin/banners');
export const saveAdminBanners = (revision, banners) =>
  api('/api/admin/banners', { method: 'PUT', body: JSON.stringify({ revision, banners }) });
