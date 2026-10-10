export async function requestLogout(request = fetch) {
  try {
    const response = await request('/api/auth/logout', { method: 'POST', credentials: 'include', signal: AbortSignal.timeout(15000) });
    if (!response.ok) return false;
    const payload = await response.json();
    return payload?.ok === true;
  } catch { return false; }
}
