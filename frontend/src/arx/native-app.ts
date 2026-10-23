/**
 * MOBILE214: the page's side of the native shells' bridge (Android and iOS apps).
 *
 * Nothing here invents a shared API: the page recognises `window.ArxApp` only in the top-level original page (never in a
 * frame, so an embedded page cannot pose as the shell), reads `platform`, and then feature-detects every function and
 * capability it wants to use. A shell that lacks one simply gets no UI for it. The `?app=android` query parameter says
 * nothing about the platform (the iOS app sends it too); the bridge, when present, is the authority.
 */
export type NativePlatform = 'android' | 'ios';
type Fn = (...a: unknown[]) => unknown;
export const NATIVE_PLATFORMS: readonly NativePlatform[] = ['android', 'ios'];

export interface NativeBridge {
  readonly platform: NativePlatform;
  readonly shell?: string;
  readonly version?: string;
  readonly capabilities?: readonly string[];
  readonly [member: string]: unknown;
}

interface BridgeHost {
  ArxApp?: unknown;
  top?: unknown;
}

/** Pure: the injected bridge when it is a plausible one and this is the top-level page; otherwise null. */
export function nativeBridge(w: BridgeHost | null | undefined): NativeBridge | null {
  if (!w || w.top !== w) return null; // a frame is never trusted
  const b = w.ArxApp as Partial<NativeBridge> | null | undefined;
  if (!b || typeof b !== 'object') return null;
  if (!NATIVE_PLATFORMS.includes(b.platform as NativePlatform)) return null;
  return b as NativeBridge;
}

/** Pure: does the bridge offer a function of this name? */
export function hasFunction(b: NativeBridge | null, name: string): boolean {
  return !!b && typeof b[name] === 'function';
}

/** Pure: does the bridge list this capability? */
export function hasCapability(b: NativeBridge | null, name: string): boolean {
  return !!b && Array.isArray(b.capabilities) && b.capabilities.includes(name);
}

const here = (): BridgeHost | null => (typeof window === 'undefined' ? null : (window as unknown as BridgeHost));

export function inNativeApp(): boolean {
  return nativeBridge(here()) !== null;
}

export function appPlatform(): NativePlatform | null {
  return nativeBridge(here())?.platform ?? null;
}

export function nativeCan(fn: string): boolean {
  return hasFunction(nativeBridge(here()), fn);
}

/** Calls a bridge function when it exists; a throwing shell never breaks the page. */
export function callNative(fn: string, ...args: unknown[]): unknown {
  const b = nativeBridge(here());
  if (!b || !hasFunction(b, fn)) return undefined;
  try {
    return (b[fn] as Fn).apply(b, args);
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------- sign-in state (a hint to the shell)

let lastSent: string | null | undefined;

/**
 * Tells the shell who is signed in (`signedIn({user_id})`) or that nobody is (`signedOut()`), once per change. The value
 * is a hint: the shell verifies the identity with the server itself.
 */
export function syncNativeSession(userId: string | null, w: BridgeHost | null = here()): void {
  const b = nativeBridge(w);
  if (!b) return;
  if (userId === lastSent) return;
  try {
    if (userId) {
      if (!hasFunction(b, 'signedIn')) return;
      (b.signedIn as Fn).call(b, { user_id: userId });
    } else {
      if (!hasFunction(b, 'signedOut')) return;
      (b.signedOut as Fn).call(b);
    }
    lastSent = userId;
  } catch {
    /* the shell is not the page's business */
  }
}

/** Tests only. */
export function resetNativeSessionForTests(): void {
  lastSent = undefined;
}

// ---------------------------------------------------------------- device status

export interface DeviceStatus {
  registered: boolean;
  name: string | null;
  location_auth: string | null;
  precise: boolean | null;
  last_event_at: string | null;
  /** Null on a shell that does not report it (Android today). */
  sensors: Record<string, string> | null;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

/** Pure: whatever the shell answered, as a DeviceStatus (anything unreadable is "not registered"). */
export function normalizeDeviceStatus(raw: unknown): DeviceStatus {
  let o: unknown = raw;
  if (typeof o === 'string') {
    try {
      o = JSON.parse(o);
    } catch {
      o = null;
    }
  }
  const r = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>;
  let sensors: Record<string, string> | null = null;
  if (r.sensors && typeof r.sensors === 'object' && !Array.isArray(r.sensors)) {
    sensors = {};
    for (const [k, v] of Object.entries(r.sensors as Record<string, unknown>)) sensors[k] = typeof v === 'string' ? v : String(v);
  }
  return {
    registered: r.registered === true,
    name: str(r.name),
    location_auth: str(r.location_auth),
    precise: typeof r.precise === 'boolean' ? r.precise : null,
    last_event_at: str(r.last_event_at),
    sensors,
  };
}

/** The shell's `deviceStatus()` (a value or a promise); null when the shell has none. Never rejects, never hangs. */
export async function readDeviceStatus(timeoutMs = 8000, w: BridgeHost | null = here()): Promise<DeviceStatus | null> {
  const b = nativeBridge(w);
  if (!b || !hasFunction(b, 'deviceStatus')) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<unknown>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    const answer = Promise.resolve((b.deviceStatus as Fn).call(b));
    return normalizeDeviceStatus(await Promise.race([answer, timeout]));
  } catch {
    return normalizeDeviceStatus(null);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
