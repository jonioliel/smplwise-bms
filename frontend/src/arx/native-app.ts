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

/**
 * SX-09 / SX-10: why the page says nobody is signed in - `signedOut({reason})`. A CLOSED vocabulary (client contract v2.2):
 * - `user`    the user's own sign-out; sent only after `DELETE /auth/session` answered 2xx or 401;
 * - `expired` the server said the session is gone (`401 remote_login_required`) without any sign-out intent - the only reason
 *             that permits the shell's single silent re-exchange;
 * - `unknown` every other cause (a revoked sign-in, the remote-access policy, the idle lock, a failed or unanswered sign-out
 *             request) - no silent re-exchange.
 * The list is fixed by the shells (contract v2.2): nothing else is ever sent. A shell treats an absent argument as `unknown`.
 */
export type NativeSignOutReason = 'user' | 'expired' | 'unknown';
export const NATIVE_SIGN_OUT_REASONS: readonly NativeSignOutReason[] = ['user', 'expired', 'unknown'];

/** Pure: the value itself when it is in the closed vocabulary, else `unknown`. */
export function nativeSignOutReason(v: unknown): NativeSignOutReason {
  return NATIVE_SIGN_OUT_REASONS.includes(v as NativeSignOutReason) ? (v as NativeSignOutReason) : 'unknown';
}

let lastSent: string | null | undefined;
let held = false;

function sendSignedOut(b: NativeBridge, reason: NativeSignOutReason): void {
  const fn = b.signedOut as Fn;
  try {
    fn.call(b, { reason });
  } catch {
    // an older shell whose bridge function takes no argument and refuses one (a strict-arity native bridge): call it as before
    fn.call(b);
  }
}

/**
 * Tells the shell who is signed in (`signedIn({user_id})`) or that nobody is (`signedOut({reason})`), once per change. The value
 * is a hint: the shell verifies the identity with the server itself. While a sign-out is in flight (`holdNativeSession`) nothing
 * is sent, so a background 401 can never reach the shell as `expired` before the user's own `user`.
 */
export function syncNativeSession(userId: string | null, w: BridgeHost | null = here(), reason: NativeSignOutReason = 'unknown'): void {
  if (held) return;
  const b = nativeBridge(w);
  if (!b) return;
  if (userId === lastSent) return;
  try {
    if (userId) {
      if (!hasFunction(b, 'signedIn')) return;
      (b.signedIn as Fn).call(b, { user_id: userId });
    } else {
      if (!hasFunction(b, 'signedOut')) return;
      sendSignedOut(b, nativeSignOutReason(reason));
    }
    lastSent = userId;
  } catch {
    /* the shell is not the page's business */
  }
}

/** `signedOut({reason})` once (no-op when the shell was already told nobody is signed in). */
export function notifyNativeSignedOut(reason: NativeSignOutReason, w: BridgeHost | null = here()): void {
  syncNativeSession(null, w, reason);
}

/** A sign-out started: hold every bridge sign-in hint until `releaseNativeSession` reports its outcome. */
export function holdNativeSession(): void {
  held = true;
}

/** The sign-out finished: tell the shell, with the reason its outcome supports. */
export function releaseNativeSession(reason: NativeSignOutReason, w: BridgeHost | null = here()): void {
  held = false;
  notifyNativeSignedOut(reason, w);
}

/** Tests only. */
export function resetNativeSessionForTests(): void {
  lastSent = undefined;
  held = false;
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
