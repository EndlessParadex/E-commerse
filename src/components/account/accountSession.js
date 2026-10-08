export async function requestLogout(request = fetch) {
  try {
    const response = await request('/api/auth/logout', { method: 'POST', credentials: 'include' });
    if (!response.ok) return false;
    const payload = await response.json();
    return payload?.ok === true;
  } catch { return false; }
}
