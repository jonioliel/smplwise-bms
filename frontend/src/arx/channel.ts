/**
 * CR-008 SmplWise Arx: which entry channel this page was opened through.
 *
 * - Home Assistant Ingress: `/api/hassio_ingress/<token>/` - identity comes from HA (nothing to do here).
 * - The remote channel: `https://<HA hostname>/<remote_path>/` (default `/arx/`) through a Cloudflare tunnel route -
 *   our own sign-in page, HA tokens kept by this page, the Arx session cookie.
 * - Anything served at the origin root (`/`, the dev server, the static preview, a Playwright preview) is local.
 *
 * The remote path is an add-on option, so the base is taken from the address itself: the first path segment. The server
 * confirms the channel (an unauthenticated call there answers 401 `remote_login_required`).
 */
const INGRESS_PREFIX = '/api/hassio_ingress/';

export function remoteBase(path: string = window.location.pathname): string | null {
  if (path.startsWith(INGRESS_PREFIX)) return null;
  const m = /^\/([a-z0-9][a-z0-9_-]{0,31})\//.exec(path);
  if (!m) return null;
  return `/${m[1]}/`;
}

export function isRemoteChannel(): boolean {
  return remoteBase() !== null;
}

/** The OAuth client id HA sees for this sign-in: `<origin>/<remote_path>/` (HA shows it under Profile › Security). */
export function clientId(): string {
  return `${window.location.origin}${remoteBase() ?? '/'}`;
}

/** Where HA's login flow may send the browser back to (same host as the client id; never actually followed). */
export function redirectUri(): string {
  return `${clientId()}?auth_callback=1`;
}
