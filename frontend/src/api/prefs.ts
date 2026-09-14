/** Product settings cache + effective transport (product default overridden per browser). */
import { getSettings, transportOverride, type ProductSettings, type Transport } from './media';
import { isApi } from './session';

let cached: ProductSettings | null = null;
let inflight: Promise<ProductSettings> | null = null;

const DEFAULTS: ProductSettings = { 'media.transport_default': 'mse', 'media.max_live_sessions': 8, 'media.wall_profile': 'sub', 'snapshots.max_age_s': 60 };

export async function productSettings(force = false): Promise<ProductSettings> {
  if (!isApi()) return DEFAULTS;
  if (cached && !force) return cached;
  if (!inflight) {
    inflight = getSettings()
      .then((r) => (cached = r.settings))
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
