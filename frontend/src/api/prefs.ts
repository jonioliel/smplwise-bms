/** Product settings cache + effective transport (VIDEO-TRANSPORT-2400: the server's decision - the viewer's own choice, else the
 * installation's; api/video-transport.ts). */
import { getSettings, type ProductSettings, type Transport } from './media';
import { isApi } from './session';
import { cachedVideoPolicy, loadVideoPolicy } from './video-transport';
import { normalizeChoice } from './video-policy';

let cached: ProductSettings | null = null;
let cachedAt = 0;
let inflight: Promise<ProductSettings> | null = null;

/** Owner bug 2026-10-01: a page left open (a phone, a second tab) kept the settings it read first for good, so a transport
 * changed elsewhere (הגדרות › וידאו ומדיה) never reached its players until a reload. A screen that loads after this long
 * reads them again; within it, the screens of one visit share one request. */
export const SETTINGS_TTL_MS = 60 * 1000;

/** Owner decision 2026-10-05: the installation default is `auto` (WebRTC first, MSE only when WebRTC cannot be used); it
 * supersedes the MSE default of 2026-09-14. The server's DEFAULTS (routers/settings.py) say the same; this copy covers the
 * demo mode and a settings read that failed. */
export const TRANSPORT_DEFAULT: Transport = 'auto';

const DEFAULTS: ProductSettings = { 'media.transport_default': TRANSPORT_DEFAULT, 'media.max_live_sessions': 16, 'media.wall_profile': 'sub', 'snapshots.max_age_s': 60 };

/** TOPPILL-295: may this user use the global search (the pill's search button, Ctrl/Cmd+K)? The server decides (`ui.global_search`
 * plus the user's roles) and answers with GET /settings; off until that answer says otherwise. GET /search enforces it too. */
let searchOk = false;
export const searchAllowed = (): boolean => searchOk;

export async function productSettings(force = false): Promise<ProductSettings> {
  if (!isApi()) return DEFAULTS;
  if (cached && !force && Date.now() - cachedAt < SETTINGS_TTL_MS) return cached;
  if (!inflight) {
    // VIDEO-TRANSPORT-2400: the transport policy is read with the settings (same freshness, in parallel) so effectiveTransport() knows
    // it when the settings arrive; its own failure never fails the settings (loadVideoPolicy resolves null)
    inflight = Promise.all([getSettings(), loadVideoPolicy()])
      .then(([r]) => {
        cachedAt = Date.now();
        searchOk = r.search_allowed === true;
        return (cached = r.settings);
      })
      .finally(() => (inflight = null));
  }
  return inflight;
}

export function invalidateSettings() {
  cached = null;
}

/** The transport a player opens with (VIDEO-TRANSPORT-2400): the server's policy for this viewer and channel - the personal choice
 * (/me/prefs `video.transport`), else the installation's - and, before it is read or from a server without it, the installation's
 * setting, else `auto`. The pre-2.40.0 per-browser override (`localStorage sw.transport`) is never consulted here. */
export function effectiveTransport(settings: ProductSettings | null): Transport {
  return cachedVideoPolicy()?.choice ?? normalizeChoice(settings?.['media.transport_default']) ?? TRANSPORT_DEFAULT;
}

/** The installation's choice as the settings screen and the camera page name it (owner 2026-10-05: "MSE בלבד" is a deliberate choice). */
export function transportLabel(t: Transport | null | undefined): string {
  return t === 'webrtc' ? 'WebRTC בלבד' : t === 'mse' ? 'MSE בלבד' : 'אוטומטי (WebRTC, ואם אינו זמין MSE)';
}
