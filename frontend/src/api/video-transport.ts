/**
 * VIDEO-TRANSPORT-2400: the viewer's live-video transport as the server decides it (GET /media/video-policy, backend
 * services/video_transport.py) - the personal `video.transport` (/me/prefs, "החשבון שלי › וידאו") when set, else the installation's
 * `media.transport_default`, else `auto`. Every player follows `policy.choice`; nothing overrides an explicit choice.
 *
 * Read with the product settings (api/prefs.ts `productSettings`, the same 60 s freshness) so `effectiveTransport()` stays synchronous
 * for the screens. When the server has no such route (an older server) or the read fails, the screens fall back to the installation's
 * setting (api/prefs.ts) - never to a choice of their own.
 *
 * The old per-browser override (`localStorage sw.transport`, before 2.40.0) is read ONCE: when the server holds no personal choice yet
 * it seeds `video.transport`, and in every case the key is removed afterwards and never consulted again.
 */
import { get } from './client';
import { putMyPrefs } from './me-prefs';
import { normalizeChoice, type TransportChoice, type VideoPolicy } from './video-policy';

export const LEGACY_TRANSPORT_KEY = 'sw.transport';

let cached: VideoPolicy | null = null;
let inflight: Promise<VideoPolicy | null> | null = null;
let migrated = false;

type Store = Pick<Storage, 'getItem' | 'removeItem'>;

function localStore(): Store | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The pre-2.40.0 per-browser choice, if this browser still holds one (read for the one-time seed only). */
export function legacyTransport(store: Store | null = localStore()): TransportChoice | null {
  try {
    return normalizeChoice(store?.getItem(LEGACY_TRANSPORT_KEY));
  } catch {
    return null;
  }
}

function dropLegacy(store: Store | null = localStore()): void {
  try {
    store?.removeItem(LEGACY_TRANSPORT_KEY);
  } catch {
    /* private mode: nothing was stored either */
  }
}

/** The policy as the server answered it, with the server's shape checked (anything unreadable is null: the settings decide). */
export function parsePolicy(raw: unknown): VideoPolicy | null {
  const r = raw as Partial<VideoPolicy> | null;
  const choice = normalizeChoice(r?.choice);
  if (!r || typeof r !== 'object' || !choice) return null;
  const order = Array.isArray(r.order) ? r.order.filter((t): t is 'webrtc' | 'mse' => t === 'webrtc' || t === 'mse') : [];
  return {
    choice,
    source: r.source === 'personal' || r.source === 'installation' ? r.source : 'default',
    explicit: choice !== 'auto',
    installation: normalizeChoice(r.installation) ?? 'auto',
    personal: normalizeChoice(r.personal),
    channel: r.channel === 'remote' ? 'remote' : 'local',
    order: order.length ? order : choice === 'auto' ? ['webrtc', 'mse'] : [choice],
    label: typeof r.label === 'string' ? r.label : undefined,
    remote: r.remote && typeof r.remote === 'object' ? { default_profile: r.remote.default_profile === 'sub' ? 'sub' : 'main', mse_fallback: r.remote.mse_fallback !== false } : null,
  };
}

/** The one-time seed from the old per-browser key (exported for the unit spec; `deps` are the network calls). */
export async function seedFromLegacy(policy: VideoPolicy, deps: { put: (v: TransportChoice) => Promise<unknown>; reload: () => Promise<VideoPolicy | null> }, store: Store | null = localStore()): Promise<VideoPolicy> {
  const legacy = legacyTransport(store);
  if (!legacy) return policy;
  dropLegacy(store); // read once: from here on only the server's choice counts, whatever the seed's outcome
  if (policy.personal) return policy; // the server already holds a personal choice: it wins
  try {
    await deps.put(legacy);
    return (await deps.reload()) ?? policy;
  } catch {
    return policy; // a refused or failed seed: the installation's choice stands (the user can set it in "החשבון שלי")
  }
}

async function fetchPolicy(): Promise<VideoPolicy | null> {
  try {
    let p = parsePolicy(await get<unknown>('media/video-policy'));
    if (p && !migrated) {
      migrated = true;
      p = await seedFromLegacy(p, {
        put: (v) => putMyPrefs({ 'video.transport': v }),
        reload: async () => parsePolicy(await get<unknown>('media/video-policy')),
      });
    }
    return p;
  } catch {
    return null;
  }
}

/** Reads the policy again (shared while one read is in flight); null when the server does not answer one. */
export function loadVideoPolicy(): Promise<VideoPolicy | null> {
  if (!inflight) {
    inflight = fetchPolicy()
      .then((p) => {
        cached = p;
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('sw-video-policy', { detail: p }));
        return p;
      })
      .finally(() => (inflight = null));
  }
  return inflight;
}

/** The last policy read (null before the first read, or when the server has none). */
export function cachedVideoPolicy(): VideoPolicy | null {
  return cached;
}

/** The viewer's own choice (null = follow the installation): saved on the server, then the policy is read again. */
export async function setPersonalTransport(choice: TransportChoice | null): Promise<VideoPolicy | null> {
  await putMyPrefs({ 'video.transport': choice });
  return loadVideoPolicy();
}

/** Tests: forget the cached policy and the one-time seed. */
export function resetVideoPolicy(): void {
  cached = null;
  inflight = null;
  migrated = false;
}
