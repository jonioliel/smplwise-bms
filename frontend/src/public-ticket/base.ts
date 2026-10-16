/**
 * TK255: where the handler page lives. The public listener serves itself under one path segment (`/support/`, or the old `/t/`);
 * the page learns it from the path it was opened on, so its own calls and its address bar follow whichever prefix the vendor's link
 * used - no build-time constant, no value injected by the server. The shape is the server's (public_prefix.py): `t`, or 2-32
 * characters of [a-z0-9_-]; anything else falls back to `/t` (and the server answers its uniform 404 to a path it does not serve).
 */
const FIRST_SEGMENT = /^\/(t|[a-z0-9][a-z0-9_-]{1,31})(?:\/|$)/;

/** `/support` for `/support/`, `/support/r/<rid>`; `/t` for `/t/` or anything unrecognised. */
export function publicBase(pathname: string): string {
  const m = FIRST_SEGMENT.exec(pathname);
  return m ? `/${m[1]}` : '/t';
}

/** Maps an internal route (`/t/api/ticket`) to the prefix of the page that is open. Only `/t/...` routes are accepted. */
export function withBase(route: string, pathname: string = typeof window !== 'undefined' ? window.location.pathname : '/t/'): string {
  if (!route.startsWith('/t/')) throw new Error('not a public route');
  return publicBase(pathname) + route.slice(2);
}

/** The address the page keeps in the bar after the token left it (`/support/`). */
export function homePath(pathname: string = typeof window !== 'undefined' ? window.location.pathname : '/t/'): string {
  return `${publicBase(pathname)}/`;
}
