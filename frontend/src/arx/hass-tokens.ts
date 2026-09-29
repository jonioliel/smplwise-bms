/**
 * CR-008 (owner decision D6): seed Home Assistant's own token store so the embedded WisKey panel (`/hikvision-intercom`,
 * an HA frontend page on the same origin) opens signed in as the same user, with no second login.
 *
 * Verified against HA's frontend (src/common/auth/token_storage.ts, 2026-09-29): `loadTokens()` reads
 * `localStorage["hassTokens"]` as JSON and, when it finds tokens, turns writing back on (`writeEnabled = true`), so the
 * tokens HA itself refreshes later are stored there again. `getAuth()` (home-assistant-js-websocket lib/auth.ts) uses
 * stored tokens only when `data.hassUrl === hassUrl` (`${location.protocol}//${location.host}`, no trailing slash) and
 * refreshes with `data.clientId`. The shape is home-assistant-js-websocket's `AuthData`:
 *   { hassUrl, clientId, expires, refresh_token, access_token, expires_in }   (expires = ms since epoch)
 * With our client id the refresh works (HA ties a refresh token to the client id it was issued to).
 *
 * Only localStorage: HA never reads sessionStorage. In the `browser_session` mode the seed is removed at sign-out and at
 * the next Arx start without a session (auth.ts).
 */
export const HASS_TOKENS_KEY = 'hassTokens';

export interface HassAuthData {
  hassUrl: string;
  clientId: string | null;
  expires: number;
  refresh_token: string;
  access_token: string;
  expires_in: number;
}

export function readHassTokens(): HassAuthData | null {
  try {
    const raw = window.localStorage.getItem(HASS_TOKENS_KEY);
    return raw ? (JSON.parse(raw) as HassAuthData) : null;
  } catch {
    return null;
  }
}

/** Write HA's entry. `onlyIfOurs`: keep an entry of another sign-in (a different refresh token) untouched - used by the
 * refresh loop, so a later login in HA's own UI in this browser is never overwritten by Arx. */
export function seedHassTokens(t: { access_token: string; refresh_token: string; expires: number; expires_in: number; clientId: string }, onlyIfOurs = false): void {
  const hassUrl = `${window.location.protocol}//${window.location.host}`;
  if (onlyIfOurs) {
    const cur = readHassTokens();
    if (cur && cur.refresh_token !== t.refresh_token) return;
  }
  const data: HassAuthData = { hassUrl, clientId: t.clientId, expires: t.expires, refresh_token: t.refresh_token, access_token: t.access_token, expires_in: t.expires_in };
  try {
    window.localStorage.setItem(HASS_TOKENS_KEY, JSON.stringify(data));
  } catch {
    /* private mode / full storage: WisKey then asks for HA's own login inside the frame */
  }
}

/** Remove HA's entry when it is ours (our client id, or our refresh token); another sign-in's entry stays. */
export function clearHassTokens(clientId: string, refreshToken?: string): void {
  const cur = readHassTokens();
  if (!cur) return;
  if (cur.clientId === clientId || (refreshToken && cur.refresh_token === refreshToken)) {
    try {
      window.localStorage.removeItem(HASS_TOKENS_KEY);
    } catch {
      /* ignore */
    }
  }
}
