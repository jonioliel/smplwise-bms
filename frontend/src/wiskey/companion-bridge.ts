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
 * 1. On Home Assistant's top window (same origin under Ingress; the window holding the bridge), `externalAuthSetToken`
 *    and `externalAuthRevokeToken` become accessors while at least one frame is attached: the top frontend's own
 *    assignments are kept and called first, unchanged, and the same call (same arguments) is then delivered to each
 *    attached frame that is on this origin and uses our proxy. When the last frame detaches (or SMPLWISE's page goes
 *    away) plain properties holding the top frontend's own callbacks are put back and the registry is removed.
 * 2. On the frame's window - only on the WisKey panel path or HA's `/auth/` pages - before Home Assistant's entrypoint
 *    runs (see timing), `externalApp` becomes a proxy: `getExternalAuth` forwards the unchanged payload to the top's
 *    bridge (the app answers into the top, step 1 relays it); `revokeExternalAuth` is NOT forwarded (a nested frame
 *    never asks the app to revoke its sign-in) and is answered as failed; there is no `externalBus`, and `externalAppV2` /
 *    `webkit.messageHandlers` are hidden, so the nested frontend runs without the app's message bus (no `config/get`,
 *    no app commands, no id collisions with the top frontend).
 * 3. The frame is opened with `external_auth=1`, so `isExternal` is true however late step 2 lands.
 * The guarantee "no bus, no revoke" holds only for a document caught while still parsing with every property replaced
 * (`early`). Any other outcome - a native property that cannot be shadowed (`native`), a document caught after it began
 * running (`late`), another path or origin (`failed`) - is reported, and `wiskey-embed` drops the frame at once and shows
 * the 0.1.123 screen: a frame is never kept with the app's real bridge in it.
 *
 * Timing: a property set on the frame's initial about:blank window does not survive the navigation (measured in
 * Chromium: a new global). There is no event between the commit of the new document and its scripts, so the frame is
 * polled (setTimeout 0, bounded) from the moment its address is assigned and whenever its document unloads; the new
 * document is caught while it is still parsing. Home Assistant reads the bridge in modules it loads with `import()`
 * (`index.html.template`: `import("<core entry>")` in the last inline script), i.e. after at least one network or cache
 * round trip - after the poll. Inline scripts of the page itself run before it (not used by Home Assistant for this).
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

/** The sign-in callbacks the app evaluates in the top document (external_auth.ts 19-20). The bus is not relayed: a
 * kept frame never has one. */
export const RELAYED_CALLBACKS = ['externalAuthSetToken', 'externalAuthRevokeToken'] as const;
type Relayed = (typeof RELAYED_CALLBACKS)[number];

export const RELAY_REGISTRY_KEY = '__smplwiseCompanionRelay';
const PROXY_MARK = '__smplwiseBridgeProxy';
const PANEL_PATH = '/hikvision-intercom';
const POLL_MS = 0;
const POLL_LIMIT_MS = 30000;

/** How the relay went for the frame's current document. Only `early` may keep the frame (see the header). */
export type ShimState = '' | 'early' | 'late' | 'native' | 'failed';

interface Relay {
  own: Partial<Record<Relayed, unknown>>;
  /** Whether the top window had its own property for that name before the relay (restored as it was). */
  had: Partial<Record<Relayed, boolean>>;
  frames: Set<HTMLIFrameElement>;
  /** Frame windows whose current document uses our proxy: the only ones a call is delivered to. */
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

function sameOrigin(a: Window, b: Window): boolean {
  try {
    return a.location.origin === b.location.origin;
  } catch {
    return false; // another origin: its location is not readable
  }
}

function relayOf(top: BridgeWindow): Relay {
  const existing = top[RELAY_REGISTRY_KEY] as Relay | undefined;
  if (existing) return existing;
  const relay: Relay = { own: {}, had: {}, frames: new Set(), proxied: new WeakSet() };
  for (const name of RELAYED_CALLBACKS) {
    relay.had[name] = Object.prototype.hasOwnProperty.call(top, name);
    relay.own[name] = top[name];
    const dispatch = (...args: unknown[]) => {
      let out: unknown;
      const own = relay.own[name];
      try {
        if (typeof own === 'function') out = (own as Fn).apply(top, args);
      } finally {
        deliver(top, relay, name, args);
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
  Object.defineProperty(top, RELAY_REGISTRY_KEY, { value: relay, configurable: true });
  return relay;
}

/** The last frame detached: plain properties with the top frontend's own callbacks again, and no registry. */
function restore(top: BridgeWindow, relay: Relay) {
  if (top[RELAY_REGISTRY_KEY] !== relay) return;
  for (const name of RELAYED_CALLBACKS) {
    try {
      const d = Object.getOwnPropertyDescriptor(top, name);
      if (!d || !d.get) continue; // not ours (we could not wrap it)
      if (relay.had[name] || relay.own[name] !== undefined) {
        Object.defineProperty(top, name, { value: relay.own[name], writable: true, configurable: true, enumerable: true });
      } else {
        delete top[name];
      }
    } catch {
      /* the top document is going away */
    }
  }
  try {
    delete top[RELAY_REGISTRY_KEY];
  } catch {
    /* ditto */
  }
}

function deliver(top: BridgeWindow, relay: Relay, name: Relayed, args: unknown[]) {
  for (const frame of relay.frames) {
    try {
      const w = frame.contentWindow as BridgeWindow | null;
      // explicit checks, not a thrown error: the frame's current document is on this origin and uses our proxy
      if (!w || !sameOrigin(w, top) || !relay.proxied.has(w)) continue;
      const fn = w[name];
      if (typeof fn === 'function') (fn as Fn).apply(w, args);
    } catch {
      /* the frame navigated away mid-call */
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

/** Step 2: the proxies on the frame's window. False when any native bridge property could not be shadowed (a partial
 * install counts as a failure: the caller drops the frame). */
function installProxies(w: BridgeWindow, top: BridgeWindow): boolean {
  if ((w.externalApp as Record<string, unknown> | undefined)?.[PROXY_MARK]) return true;
  const proxy = {
    [PROXY_MARK]: true,
    getExternalAuth: (payload: string) => askTop(top, payload),
    revokeExternalAuth: () => {
      // never forwarded: a nested frame does not ask the app to revoke its sign-in
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

/** The frame documents the relay serves: WisKey's panel and Home Assistant's sign-in pages. */
function servedPath(w: Window): boolean {
  const p = w.location.pathname;
  return p === PANEL_PATH || p.startsWith(`${PANEL_PATH}/`) || p.startsWith('/auth/');
}

export interface CompanionBridge {
  /** How the relay went for the frame's current document. */
  readonly state: ShimState;
  dispose(): void;
}

/** Attach before the frame's address is assigned (the embed connector assigns it right after). `onState` reports
 * each document's outcome (anything but `early` means: drop the frame). Returns null when there is no bridge to relay
 * (not the Companion app). */
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

  const onUnload = () => arm(); // the frame's document is going: a new one is coming

  function check(): boolean {
    let w: BridgeWindow | null = null;
    let d: Document | null = null;
    try {
      w = iframe.contentWindow as BridgeWindow | null;
      d = w?.document ?? null;
      if (!w || !d || d === doc || d.URL === 'about:blank') return false;
    } catch {
      return false; // not readable (yet, or another origin): keep looking; the embed's probe judges another origin
    }
    doc = d;
    let next: ShimState;
    if (!sameOrigin(w, host) || !servedPath(w)) next = 'failed';
    else if (d.readyState !== 'loading') next = installProxies(w, top!) ? 'late' : hasBridge(w) ? 'native' : 'failed';
    else if (installProxies(w, top!)) next = 'early';
    else next = hasBridge(w) ? 'native' : 'failed';
    if (next === 'early' || next === 'late') relay.proxied.add(w);
    state = next;
    try {
      w.addEventListener('pagehide', onUnload);
    } catch {
      /* gone already */
    }
    onState?.(next); // may dispose this bridge (the embed drops the frame)
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
    if (!disposed) check(); // a document the poll missed (a load without a pagehide first): reported as late
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    host.clearTimeout(timer);
    iframe.removeEventListener('load', onLoad);
    host.removeEventListener('pagehide', dispose);
    relay.frames.delete(iframe);
    if (!relay.frames.size) restore(top, relay);
  };
  iframe.addEventListener('load', onLoad);
  host.addEventListener('pagehide', dispose); // SMPLWISE's page goes away: HA's top window gets its callbacks back
  arm();

  return {
    get state() {
      return state;
    },
    dispose,
  };
}
