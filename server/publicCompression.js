import { brotliCompressSync, gzipSync, constants } from 'node:zlib';

// Prefer Brotli on equal quality; an explicit q=0 overrides wildcard support.
export function publicEncoding(header = '') {
  const values = new Map(
    String(header)
      .toLowerCase()
      .split(',')
      .map((part) => {
        const [name, ...parameters] = part.trim().split(';');
        const parameter = parameters.find((value) => value.trim().startsWith('q='));
        const quality = parameter ? Number(parameter.trim().slice(2)) : 1;
        return [
          name.trim(),
          Number.isFinite(quality) && quality >= 0 && quality <= 1 ? quality : 0,
        ];
      }),
  );
  const quality = (name) => values.get(name) ?? values.get('*') ?? 0;
  const identity = values.get('identity') ?? 0;
  return ['br', 'gzip']
    .filter((name) => quality(name) > 0 && quality(name) >= identity)
    .sort((a, b) => quality(b) - quality(a))[0];
}

export function compressPublic(body, encoding) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
  if (encoding === 'br')
    return brotliCompressSync(bytes, {
      params: { [constants.BROTLI_PARAM_QUALITY]: 6 },
    });
  return encoding === 'gzip' ? gzipSync(bytes) : bytes;
}
