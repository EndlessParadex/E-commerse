/** Apply to every response, including API errors and static assets. */
export function responseHeaders(https = false) {
  return {
    'x-content-type-options': 'nosniff',
    'content-security-policy': "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    ...(https ? { 'strict-transport-security': 'max-age=31536000' } : {}),
  };
}
