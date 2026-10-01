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

const DEFAULTS: ProductSettings = { 'media.transport_default': 'mse', 'media.max_live_sessions': 16, 'media.wall_profile': 'sub', 'snapshots.max_age_s': 60 };

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

export function effectiveTransport(settings: ProductSettings | null): Transport {
  return transportOverride() || settings?.['media.transport_default'] || 'mse';
}
