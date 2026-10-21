export async function accountApi(path, body, timeoutMs = 15000, method) {
  const response = await fetch(path, {
    method: method || (body === undefined ? 'GET' : 'POST'),
    credentials: 'include',
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
    ...(body === undefined
      ? {}
      : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const payload = await response.json();
  if (!response.ok)
    throw new Error(
      payload.errors?.form || 'Layanan akun belum dapat memproses permintaan. Coba kembali.',
    );
  return payload;
}
