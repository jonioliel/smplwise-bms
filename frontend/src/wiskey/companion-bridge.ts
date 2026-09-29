/**
 * Experimental (T054 follow-up, owner request 2026-09-29; setting `access.phone_embed`, default off): lets the
 * Home Assistant frontend nested in the WisKey frame sign in inside the Companion app.
 *
 * Why it does not work by itself (home-assistant/frontend `dev` @ 73451bb, fetched 2026-09-29):
 * - `src/data/external.ts` 1-5: `isExternal` is fixed when the entrypoint loads - `window.externalAppV2 ||
 *   window.externalApp || window.webkit?.messageHandlers?.getExternalAuth || location.search.includes("external_auth=1")`;
 *   `src/entrypoints/core.ts` 69-80 then picks the external auth instead of stored tokens.
 * - `src/external_app/external_auth.ts` 61-65 throws at module load without one of those bridges; 102-120 sets
 *   `window.externalAuthSetToken` on ITS OWN window and asks the bridge for a token; 154-164 attaches the external bus
 *   (`externalApp.externalBus` / `externalAppV2` / `webkit.messageHandlers.externalBus`) and waits for the app's answer to
 *   `config/get` (`external_messaging.ts` 429-440) before anything else.
 * - The app answers by evaluating `externalAuthSetToken(...)` / `externalBus(...)` in the TOP document only. A nested
 *   frontend therefore waits forever (bridge visible in the frame, as on Android) or goes to `/auth/authorize`.
 *
 * What this does, per frame:
 * 1. On Home Assistant's top window (same origin under Ingress; the window holding the bridge), `externalAuthSetToken`,
 *    `externalAuthRevokeToken` and `externalBus` become accessors: the top frontend's own assignments are kept and
 *    called first, unchanged, and the same call (same arguments) is then delivered to each registered frame's own
 *    callback. `externalBus` fans out only `result` messages, and only to frames still using a native bridge (commands
 *    from the app stay with the top frontend).
 * 2. On the frame's window, before Home Assistant's entrypoint runs (see timing), `externalApp` becomes a proxy:
 *    `getExternalAuth` forwards the unchanged payload to the top's bridge (the app answers into the top, step 1 relays
 *    it); `revokeExternalAuth` is NOT forwarded - the frame must never sign the app out - and is answered as failed;
 *    there is no `externalBus`, and `externalAppV2` / `webkit.messageHandlers` are hidden, so the nested frontend runs
 *    without the app's message bus (no `config/get`, no app commands, no id collisions with the top frontend).
 * 3. The frame is opened with `external_auth=1`, so `isExternal` is true however late step 2 lands.
 *
 * Timing: a property set on the frame's initial about:blank window does not survive the navigation (measured in
 * Chromium: a new global). There is no event between the commit of the new document and its scripts, so the frame is
 * polled (setTimeout 0, bounded) from the moment its address is assigned and whenever its document unloads; the new
 * document is caught while it is still parsing. Home Assistant reads the bridge in modules it loads with `import()`
 * (`index.html.template`: `import("<core entry>")` in the last inline script), i.e. after at least one network or cache
 * round trip - after the poll. Inline scripts of the page itself run before it (not used by Home Assistant for this).
 * If the poll loses anyway, the frontend either uses the app's native bridge in the frame (then step 1's bus fan-out
 * lets it start) or never connects - `wiskey-embed` then falls back to the 0.1.123 screen (`login_required`).
 *
 * Nothing here reads a token: the payloads pass through untouched. Unverified on a device (the owner's lab check):
 * whether the Android / iOS apps accept a bridge call made from a nested document's script on the top window's
 * object, and whether iOS exposes `webkit.messageHandlers` in subframes.
 */

type Fn = (...args: unknown[]) => unknown;

type BridgeWindow = Window & {
  externalApp?: { getExternalAuth?: (p: string) => void; revokeExternalAuth?: (p: string) => void; externalBus?: (p: string) => void };
  externalAppV2?: { postMessage?: (p: string) => void };
  webkit?: { messageHandlers?: Record<string, { postMessage?: (p: unknown) => void } | undefined> };
} & Record<string, unknown>;

/** The callbacks the app evaluates in the top document (external_auth.ts 19-20, external_messaging.ts 4). */
export const RELAYED_CALLBACKS = ['externalAuthSetToken', 'externalAuthRevokeToken', 'externalBus'] as const;
type Relayed = (typeof RELAYED_CALLBACKS)[number];

const REGISTRY_KEY = '__smplwiseCompanionRelay';
const PROXY_MARK = '__smplwiseBridgeProxy';
const POLL_MS = 0;
const POLL_LIMIT_MS = 30000;

/** Where the shim was installed for the frame's current document, for the evidence specs and the diagnostics. */
export type ShimState = '' | 'early' | 'late' | 'native' | 'failed';

interface Relay {
  own: Partial<Record<Relayed, unknown>>;
  frames: Set<HTMLIFrameElement>;
  /** Frames whose current document uses our proxy (no native bus there). */
  proxied: WeakSet<Window>;
}

function hasBridge(w: BridgeWindow | null | undefined): boolean {
  try {
    return !!w && !!(w.externalAppV2 || w.externalApp || w.webkit?.messageHandlers?.getExternalAuth);
  } catch {
    return false;
  }
}

/** The window holding the app's bridge: Home Assistant's top document (same origin under Ingress), else this one. */
export function bridgeWindow(win: Window = window): BridgeWindow | null {
  try {
    const top = win.top as BridgeWindow | null;
    if (top && top !== win && hasBridge(top)) return top;
  } catch {
    /* a cross-origin top: not Home Assistant's frontend */
  }
  return hasBridge(win as BridgeWindow) ? (win as BridgeWindow) : null;
}

function relayOf(top: BridgeWindow): Relay {
  const existing = top[REGISTRY_KEY] as Relay | undefined;
  if (existing) return existing;
  const relay: Relay = { own: {}, frames: new Set(), proxied: new WeakSet() };
  for (const name of RELAYED_CALLBACKS) {
    relay.own[name] = top[name];
    const dispatch = (...args: unknown[]) => {
      let out: unknown;
      const own = relay.own[name];
      try {
        if (typeof own === 'function') out = (own as Fn).apply(top, args);
      } finally {
        deliver(relay, name, args);
      }
      return out;
    };
    try {
      Object.defineProperty(top, name, {
        configurable: true,
        enumerable: true,
        get: () => dispatch,
        set: (v: unknown) => {
          relay.own[name] = v; // the top frontend's own (re)assignment: kept and called first
        },
      });
    } catch {
      /* a non-configurable property: that callback is not relayed */
    }
  }
  Object.defineProperty(top, REGISTRY_KEY, { value: relay, configurable: true });
  return relay;
}

function deliver(relay: Relay, name: Relayed, args: unknown[]) {
  const msg = args[0] as { type?: unknown } | null | undefined;
  for (const frame of relay.frames) {
    try {
      const w = frame.contentWindow as BridgeWindow | null;
      if (!w) continue;
      // the bus: only answers, and only to a frame whose frontend talks to the app's native bus itself
      if (name === 'externalBus' && (relay.proxied.has(w) || !msg || msg.type !== 'result')) continue;
      const fn = w[name];
      if (typeof fn === 'function') (fn as Fn).apply(w, args);
    } catch {
      /* the frame navigated away or went cross-origin mid-call */
    }
  }
}

/** Forward the nested frontend's token request, payload unchanged, to the top's bridge in the form it offers. */
function askTop(top: BridgeWindow, payload: string) {
  if (top.externalAppV2?.postMessage) {
    let parsed: unknown = payload;
    try {
      parsed = JSON.parse(payload);
    } catch {
      /* forward as given */
    }
    top.externalAppV2.postMessage(JSON.stringify({ type: 'getExternalAuth', payload: parsed }));
  } else if (top.externalApp?.getExternalAuth) {
    top.externalApp.getExternalAuth(payload);
  } else {
    top.webkit?.messageHandlers?.getExternalAuth?.postMessage?.(JSON.parse(payload));
  }
}

function define(w: BridgeWindow, name: string, value: unknown): boolean {
  try {
    Object.defineProperty(w, name, { value, configurable: true, writable: true, enumerable: true });
    return w[name] === value;
  } catch {
    return false;
  }
}

/** Step 2: the proxies on the frame's window. False when a native bridge property could not be shadowed. */
function installProxies(w: BridgeWindow, top: BridgeWindow): boolean {
  if ((w.externalApp as Record<string, unknown> | undefined)?.[PROXY_MARK]) return true;
  const proxy = {
    [PROXY_MARK]: true,
    getExternalAuth: (payload: string) => askTop(top, payload),
    revokeExternalAuth: () => {
      // never forwarded: signing the app out is the app's own frontend's business, not a nested frame's
      w.setTimeout(() => {
        try {
          (w.externalAuthRevokeToken as Fn | undefined)?.(false, { message: 'not available in an embedded frame' });
        } catch {
          /* nothing waits */
        }
      }, 0);
    },
  };
  let ok = define(w, 'externalApp', proxy);
  if (ok && w.externalAppV2 !== undefined) ok = define(w, 'externalAppV2', undefined);
  if (ok && w.webkit?.messageHandlers) ok = define(w, 'webkit', { messageHandlers: {} });
  return ok;
}

export interface CompanionBridge {
  /** Where the shim went for the frame's current document. */
  readonly state: ShimState;
  dispose(): void;
}

/** Attach before the frame's address is assigned (the embed connector assigns it right after). `onState` reports
 * each document's outcome. Returns null when there is no bridge to relay (not the Companion app). */
export function attachCompanionBridge(iframe: HTMLIFrameElement, onState?: (s: ShimState) => void, host: Window = window): CompanionBridge | null {
  const top = bridgeWindow(host);
  if (!top) return null;
  const relay = relayOf(top);
  relay.frames.add(iframe);
  let state: ShimState = '';
  let doc: Document | null = null;
  let timer = 0;
  let until = 0;
  let disposed = false;

  const set = (s: ShimState) => {
    state = s;
    onState?.(s);
  };

  const onUnload = () => arm(); // the frame's document is going: a new one is coming

  function check(): boolean {
    let w: BridgeWindow | null = null;
    let d: Document | null = null;
    try {
      w = iframe.contentWindow as BridgeWindow | null;
      d = w?.document ?? null;
      if (!w || !d || d === doc || d.URL === 'about:blank' || w.location.origin !== host.location.origin) return false;
    } catch {
      return false; // not readable (yet): keep looking
    }
    doc = d;
    const early = d.readyState === 'loading';
    if (installProxies(w, top!)) {
      relay.proxied.add(w);
      set(early ? 'early' : 'late');
    } else {
      set(hasBridge(w) ? 'native' : 'failed');
    }
    try {
      w.addEventListener('pagehide', onUnload);
    } catch {
      /* gone already */
    }
    return true;
  }

  function poll() {
    timer = 0;
    if (disposed) return;
    if (check()) return;
    if (Date.now() < until) timer = host.setTimeout(poll, POLL_MS);
  }

  function arm() {
    if (disposed) return;
    until = Date.now() + POLL_LIMIT_MS;
    if (!timer) timer = host.setTimeout(poll, POLL_MS);
  }

  const onLoad = () => {
    check(); // a document the poll missed (a load without a pagehide first): late, but recorded
  };
  iframe.addEventListener('load', onLoad);
  arm();

  return {
    get state() {
      return state;
    },
    dispose() {
      disposed = true;
      host.clearTimeout(timer);
      iframe.removeEventListener('load', onLoad);
      relay.frames.delete(iframe);
    },
  };
}
