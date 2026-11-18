// Which pages a visitor without an account may open, and where to go after signing in.
export const RETURN_KEY = 'bam-after-login';
const OPEN_ROUTES = new Set([
  '/',
  '/login',
  '/daftar',
  '/tentang',
  '/privasi',
  '/pengiriman',
  '/pembatalan',
  '/bantuan',
]);

/** Pages a visitor without an account may open: the home page, sign-in and store information. */
export const guestAllowed = (route) =>
  OPEN_ROUTES.has(route) ||
  /^\/(forgot-password|reset-password|verifikasi-email)(?:\?|$)/.test(route);

/** Where a visitor wanted to go before signing in; read once. */
export function takeReturnRoute() {
  try {
    const route = globalThis.sessionStorage?.getItem(RETURN_KEY) || '';
    globalThis.sessionStorage?.removeItem(RETURN_KEY);
    return route.startsWith('/') && !guestAllowed(route) ? route : '';
  } catch {
    return '';
  }
}
