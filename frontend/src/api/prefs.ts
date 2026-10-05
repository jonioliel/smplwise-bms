/** Product settings cache + effective transport (product default overridden per browser). */
import { getSettings, transportOverride, type ProductSettings, type Transport } from './media';
import { isApi } from './session';

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

export async function productSettings(force = false): Promise<ProductSettings> {
  if (!isApi()) return DEFAULTS;
  if (cached && !force && Date.now() - cachedAt < SETTINGS_TTL_MS) return cached;
  if (!inflight) {
    inflight = getSettings()
      .then((r) => {
        cachedAt = Date.now();
        return (cached = r.settings);
      })
      .finally(() => (inflight = null));
  }
  return inflight;
}

export function invalidateSettings() {
  cached = null;
}

/** The transport a player opens with: the viewer's own per-browser override, else the installation's choice, else `auto`. */
export function effectiveTransport(settings: ProductSettings | null): Transport {
  return transportOverride() || settings?.['media.transport_default'] || TRANSPORT_DEFAULT;
}

/** The installation's choice as the settings screen and the camera page name it (owner 2026-10-05: "MSE בלבד" is a deliberate choice). */
export function transportLabel(t: Transport | null | undefined): string {
  return t === 'webrtc' ? 'WebRTC בלבד' : t === 'mse' ? 'MSE בלבד' : 'אוטומטי (WebRTC, ואם אינו זמין MSE)';
}
