/**
 * WisKey embed API v1 connector (WisKey 2.0.0-rc.19+; contract `docs/integrations/wiskey/embed-api-v1/WISKEY_EMBED_API_V1.md`).
 *
 * A typed port of the WisKey developers' reference adapter (`embed-api-v1/examples/wiskey-embed-client.mjs`), kept
 * behaviour-for-behaviour identical so the two can be compared line by line:
 * - the `message` listener is registered BEFORE `iframe.src` is assigned (a fast `wiskey:ready` is not missed);
 * - a message counts only when `event.origin === location.origin` AND `event.source === iframe.contentWindow`;
 * - `wiskey:ready` negotiates the version: only `version === 1` is accepted, anything else is `onUnsupported`; a second
 *   ready is ignored until a deliberate `refresh()` clears the catalog;
 * - the catalog keeps `{id, label}` strings only - nothing else a message carries is kept;
 * - `navigate()` posts only after ready, only for ids in the catalog, to the explicit same-origin target (never `'*'`);
 *   before ready the latest request is queued and sent once the catalog arrives;
 * - `wiskey:location` is the CONFIRMED location (it may be the old one: a declined unsaved-change prompt); nothing is
 *   ever confirmed optimistically;
 * - `wiskey:title` is handed over as a plain string - the caller renders it as text, never as HTML;
 * - without a handshake 12 s after a frame load, discovery walks open shadow roots only to find the public panel root
 *   and read its `data-embed-api` marker: marker "1" = waiting (loading / authentication), no marker = an older WisKey
 *   (`onLegacy`), another value = unsupported, no root at all = waiting (never proof of an older, authorised build);
 * - `refresh()` reopens the panel from the last confirmed tab/tool with `embed=1`; `dispose()` detaches everything.
 *
 * The panel URL is built from the ORIGIN (`new URL('/hikvision-intercom', origin)`), never from the Ingress path. There
 * is deliberately no check here beyond `version === 1` and the message shapes: the contract version changes only for
 * breaking changes, and additions (new message types, new fields, new ids) must keep working.
 *
 * `host` defaults to `window`; the unit spec passes a fake window with a manual clock.
 */

/** The WisKey panel's address on the Home Assistant origin (hikvision_intercom panel.py `frontend_url_path`). */
export const WISKEY_PANEL_PATH = '/hikvision-intercom';
/** The only contract version this connector speaks. */
export const WISKEY_EMBED_VERSION = 1;
/** How long after a frame load without a handshake the public marker is looked for (the reference's 12 s). */
export const WISKEY_DISCOVERY_MS = 12000;
/** The public panel root WisKey marks with `data-embed-api`. */
export const WISKEY_PANEL_TAG = 'hikvision-intercom-panel';

export interface WiskeyNavItem {
  readonly id: string;
  readonly label: string;
}

export interface WiskeyCatalog {
  readonly tabs: readonly WiskeyNavItem[];
  readonly tools: readonly WiskeyNavItem[];
}

export interface WiskeyLocation {
  readonly tab: string;
  readonly tool: string | null;
}

/** What a navigation request may look like (`tool` omitted or null = the top-level tab). */
export interface WiskeyTarget {
  readonly tab: string;
  readonly tool?: string | null;
}

/** The parts of `window` the connector uses. */
export interface WiskeyHost {
  readonly location: { readonly origin: string };
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  setTimeout(handler: () => void, timeout: number): number;
  clearTimeout(id: number | undefined): void;
}

/** The frame's window as far as the connector touches it: post to it, and (discovery only) read its origin. */
export interface WiskeyFrameWindow {
  postMessage(message: unknown, targetOrigin: string): void;
  readonly location: { readonly origin: string };
}

/** The parts of an `HTMLIFrameElement` the connector uses. */
export interface WiskeyFrame {
  src: string;
  readonly contentWindow: WiskeyFrameWindow | null;
  readonly contentDocument: Document | null;
  addEventListener(type: 'load', listener: () => void): void;
  removeEventListener(type: 'load', listener: () => void): void;
}

export interface WiskeyConnectorOptions {
  /** The location the frame opens on (default: overview). */
  initial?: WiskeyLocation;
  onReady?(catalog: WiskeyCatalog): void;
  onLocation?(location: WiskeyLocation): void;
  onTitle?(text: string): void;
  /** No marker after discovery: an older WisKey build - the caller may run its previous adapter. */
  onLegacy?(): void;
  /** Loading / authentication: the marker is there (or the root is not found yet) but no handshake came. */
  onWaiting?(): void;
  /** A handshake or marker of another contract version. */
  onUnsupported?(version: unknown): void;
}

export interface WiskeyConnector {
  /** Send `wiskey:navigate` (after ready, ids from the catalog); before ready the request is queued. True when posted. */
  navigate(target: WiskeyTarget): boolean;
  /** Reopen the panel on the last confirmed tab/tool (clears the catalog; a fresh handshake follows). */
  refresh(): void;
  dispose(): void;
  /** The catalog of the current handshake, or null before ready (and after refresh / dispose). */
  readonly catalog: WiskeyCatalog | null;
  /** The last confirmed location (the initial one until WisKey reports another). */
  readonly confirmed: WiskeyLocation;
}

/** The panel address on `origin`: `/hikvision-intercom?embed=1&tab=<tab>[&tool=<tool>]`; `embed: false` = the normal
 * (top-level) deep link, which WisKey rc.19 honours as well. */
export function wiskeyPanelUrl(origin: string, location: WiskeyTarget, embed = true): string {
  const url = new URL(WISKEY_PANEL_PATH, origin);
  if (embed) url.searchParams.set('embed', '1');
  url.searchParams.set('tab', location.tab);
  if (location.tool) url.searchParams.set('tool', location.tool);
  return url.href;
}

function validList(items: unknown): items is { id: string; label: string }[] {
  return (
    Array.isArray(items) &&
    items.every((item) => !!item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string' && typeof (item as { label?: unknown }).label === 'string')
  );
}

/** Copy `{id, label}` and nothing else out of a validated list. */
function keepIdsAndLabels(items: { id: string; label: string }[]): readonly WiskeyNavItem[] {
  return Object.freeze(items.map((item) => Object.freeze({ id: item.id, label: item.label })));
}

/** Depth-first through open shadow roots, for the public panel root only (never its state). */
function findPublicRoot(container: Document | ShadowRoot | null | undefined): Element | null {
  if (!container) return null;
  const panel = container.querySelector(WISKEY_PANEL_TAG);
  if (panel) return panel;
  for (const element of Array.from(container.querySelectorAll('*'))) {
    const root = (element as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
    if (!root) continue;
    const nested = findPublicRoot(root);
    if (nested) return nested;
  }
  return null;
}

export function attachWiskey(iframe: WiskeyFrame, options: WiskeyConnectorOptions = {}, host: WiskeyHost = window as unknown as WiskeyHost): WiskeyConnector {
  const origin = host.location.origin;
  if (origin === 'null') throw new Error('WisKey requires a same-origin document');
  let confirmed: WiskeyLocation = options.initial ? { tab: options.initial.tab, tool: options.initial.tool || null } : { tab: 'overview', tool: null };
  let queued: WiskeyTarget | null = null;
  let catalog: WiskeyCatalog | null = null;
  let timer: number | undefined;
  let disposed = false;

  const known = ({ tab, tool }: WiskeyTarget): boolean =>
    !!catalog && catalog.tabs.some((item) => item.id === tab) && (!tool || (tab === 'tools' && catalog.tools.some((item) => item.id === tool)));

  function navigate(target: WiskeyTarget): boolean {
    if (disposed || !target || typeof target.tab !== 'string' || (target.tool != null && typeof target.tool !== 'string')) return false;
    if (!catalog) {
      queued = target;
      return false;
    }
    if (!known(target)) return false;
    iframe.contentWindow?.postMessage({ type: 'wiskey:navigate', tab: target.tab, tool: target.tool || null }, origin);
    return true;
  }

  function receive(event: MessageEvent) {
    if (disposed || event.origin !== origin || (event.source as unknown) !== iframe.contentWindow) return;
    const message = event.data as Record<string, unknown> | null;
    if (!message || typeof message !== 'object') return;
    if (message.type === 'wiskey:ready') {
      if (message.version !== WISKEY_EMBED_VERSION) {
        host.clearTimeout(timer);
        options.onUnsupported?.(message.version);
        return;
      }
      if (!validList(message.tabs) || !validList(message.tools)) return;
      if (catalog) return; // once per mounting: a second ready waits for a deliberate refresh
      host.clearTimeout(timer);
      catalog = Object.freeze({ tabs: keepIdsAndLabels(message.tabs), tools: keepIdsAndLabels(message.tools) });
      options.onReady?.(catalog);
      if (queued) {
        const target = queued;
        queued = null;
        navigate(target);
      }
    } else if (catalog && message.type === 'wiskey:location' && typeof message.tab === 'string' && (message.tool === null || typeof message.tool === 'string')) {
      confirmed = { tab: message.tab, tool: message.tool };
      options.onLocation?.(confirmed);
    } else if (catalog && message.type === 'wiskey:title' && typeof message.text === 'string') {
      options.onTitle?.(message.text);
    }
  }

  function loaded() {
    if (catalog || disposed) return;
    host.clearTimeout(timer);
    timer = host.setTimeout(() => {
      if (catalog || disposed) return;
      // Only after a missing handshake: discover the public root through open infrastructure shadow roots. Never
      // inspect panel state or call its methods.
      let root: Element | null;
      try {
        if (iframe.contentWindow?.location.origin !== origin) {
          options.onWaiting?.();
          return;
        }
        root = findPublicRoot(iframe.contentDocument);
      } catch {
        options.onWaiting?.();
        return;
      }
      const marker = root?.hasAttribute('data-embed-api') ? root : null;
      if (!root) options.onWaiting?.();
      else if (!marker) options.onLegacy?.();
      else if (marker.getAttribute('data-embed-api') !== '1') options.onUnsupported?.(marker.getAttribute('data-embed-api'));
      else options.onWaiting?.();
    }, WISKEY_DISCOVERY_MS);
  }

  function refresh() {
    if (disposed) return;
    host.clearTimeout(timer);
    catalog = null;
    iframe.src = wiskeyPanelUrl(origin, confirmed);
  }

  // Listener ordering is intentional: the child may initialise before the iframe's load event.
  host.addEventListener('message', receive);
  iframe.addEventListener('load', loaded);
  refresh();
  return {
    navigate,
    refresh,
    dispose() {
      disposed = true;
      host.clearTimeout(timer);
      host.removeEventListener('message', receive);
      iframe.removeEventListener('load', loaded);
      catalog = null;
      queued = null;
    },
    get catalog() {
      return catalog;
    },
    get confirmed() {
      return confirmed;
    },
  };
}
