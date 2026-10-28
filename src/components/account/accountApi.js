const errorsByStatus = {
  400: 'Permintaan tidak valid. Periksa data yang dikirim.',
  401: 'Sesi login telah berakhir. Masuk kembali lalu ulangi tindakan.',
  403: 'Akun ini tidak memiliki izin untuk tindakan tersebut.',
  404: 'Data atau layanan yang diminta tidak ditemukan. Muat ulang halaman.',
  409: 'Data telah berubah atau bertentangan. Muat ulang sebelum menyimpan.',
  422: 'Data belum valid. Periksa isian sebelum menyimpan.',
  429: 'Terlalu banyak permintaan. Coba lagi nanti.',
  500: 'Terjadi kesalahan server. Periksa log backend BAM.',
  503: 'Layanan sementara tidak tersedia. Periksa backend BAM dan coba lagi.',
};

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
  // Reverse proxies and interrupted requests can return non-JSON responses.
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.errors?.form;
    const message =
      typeof detail === 'string' && detail.trim()
        ? detail
        : errorsByStatus[response.status] ||
          'Layanan akun belum dapat memproses permintaan. Coba kembali.';
    const failure = new Error(message);
    failure.status = response.status;
    failure.code = payload?.error || null;
    throw failure;
  }
  if (!payload || typeof payload !== 'object')
    throw new Error('Respons layanan akun tidak valid. Muat ulang halaman.');
  return payload;
}
