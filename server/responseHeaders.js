import { createHash } from 'node:crypto';
import { allPrintPageCss } from '../src/data/printPaper.js';

// The only inline styles the site renders: the @page rule of each print view.
const PRINT_STYLE_HASHES = allPrintPageCss()
  .map((css) => "'sha256-" + createHash('sha256').update(css).digest('base64') + "'")
  .join(' ');

// Everything the site loads comes from itself: built scripts and styles, self-hosted fonts,
// catalog photos, and data: URLs for photo previews and saved logos. There are no inline
// scripts; the only <style> tags are the hashed print rules above. No frames, no plugins.
// Links to wa.me or Google are navigation, which CSP does not restrict. Over HTTPS, stray
// http:// subresources are upgraded instead of blocked.
export function contentSecurityPolicy(https = false) {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' " + PRINT_STYLE_HASHES,
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

/** Apply to every response, including API errors and static assets. */
export function responseHeaders(https = false) {
  return {
    'x-content-type-options': 'nosniff',
    'content-security-policy': contentSecurityPolicy(https),
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    ...(https ? { 'strict-transport-security': 'max-age=31536000' } : {}),
  };
}
