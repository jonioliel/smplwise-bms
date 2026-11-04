/**
 * PERF-HOME-DEVICES-2342: the route screens as lazy chunks of their own.
 *
 * The shell imported all ~90 screens eagerly, so the first load of ANY address - the home screen (#/devices/building)
 * included - downloaded, parsed and evaluated one ~11 MB entry chunk. Now only the home screen (devices-building, imported
 * by the shell for its demo tree and as the landing page) and what the shell itself draws stay in the entry chunk; every
 * other screen below is fetched when the shell first renders its tag. The tags are rendered exactly as before
 * (sw-app renderRoute): an element whose definition has not arrived is an unupgraded custom element, and Lit carries the
 * properties set on it over when it upgrades (the same path tickets-overview has used since MGRDASH).
 *
 * GATE2342-B: the shell does NOT render a route screen's tag before its chunk landed (`waitingScreenTags` - an element upgraded in
 * place gets its properties back only after connectedCallback, see there); it starts the chunk and draws nothing in its place until it
 * lands. `loadPendingScreens(root)` stays as the safety net: it looks for undefined custom elements under the shell's render root
 * after each render and starts the chunk of each tag listed here; `pendingScreens()` says how many are still in flight (the shell keeps
 * `data-shell-ready` off until they landed, so nothing that waits for it sees a screen that is not there yet).
 *
 * GATE2342-A: the safety net must not upgrade in place either (a lazy tag the route template does not show - the embedded floor map
 * of the shell, the home screen's plan view, which calls it for its own render root). It takes each undefined element of a listed
 * tag out of the DOM (a comment keeps its place) before its chunk arrives - a definition upgrades only connected elements - and when
 * the chunk landed upgrades it while detached, sets the properties again through the now defined accessors and puts it back, so
 * its connectedCallback runs with the template's values. If the render moved on meanwhile, the comment is gone and so is the element.
 *
 * Not listed: schedule-editor (components/device-activity, the long-press popup of every device, imports it eagerly). A screen
 * module listed here must not be imported eagerly by the shell (it would land in the entry chunk again), and a tag
 * a lazy screen renders must be defined by a module it imports itself or by the entry chunk: scripts/lazy-tags-check.mjs
 * checks both statically (it is part of the frontend gate, tests/unit/lazy-screens.spec.ts).
 */

type Loader = () => Promise<unknown>;

export const LAZY_SCREENS: Readonly<Record<string, Loader>> = {
  'explore-floor-map': () => import('../screens/explore-floor-map'),
  'explore-sites': () => import('../screens/explore-sites'),
  'explore-presence': () => import('../screens/explore-presence'),
  'explore-floors': () => import('../screens/explore-floors'),
  'explore-plan-import': () => import('../screens/explore-plan-import'),
  'explore-plan-editor': () => import('../screens/explore-plan-editor'),
  'explore-entities': () => import('../screens/explore-entities'),
  'wiskey-overview': () => import('../screens/wiskey-overview'),
  'wiskey-events': () => import('../screens/wiskey-events'),
  'wiskey-people': () => import('../screens/wiskey-people'),
  'wiskey-stations': () => import('../screens/wiskey-stations'),
  'wiskey-schedules': () => import('../screens/wiskey-schedules'),
  'wiskey-embed': () => import('../screens/wiskey-embed'),
  'access-external-screen': () => import('../screens/access-external'),
  'door-windows-screen': () => import('../screens/door-windows'),
  'devices-area': () => import('../screens/devices-area'),
  'devices-schedules': () => import('../screens/devices-schedules'),
  'system-schedules': () => import('../screens/system-schedules'),
  'devices-automations': () => import('../screens/devices-automations'),
  'system-automations': () => import('../screens/system-automations'),
  'multimedia-screens': () => import('../screens/multimedia-screens'),
  'multimedia-players': () => import('../screens/multimedia-players'),
  'multimedia-groups': () => import('../screens/multimedia-groups'),
  'system-multimedia': () => import('../screens/system-multimedia'),
  'infra-generator': () => import('../screens/infra-generator'),
  'infra-elevators': () => import('../screens/infra-elevators'),
  'infra-temperature': () => import('../screens/infra-temperature'),
  'infra-report': () => import('../screens/infra-report'),
  'insights-doors': () => import('../screens/insights-doors'),
  'insights-waste': () => import('../screens/insights-waste'),
  'infra-electricity': () => import('../screens/infra-electricity'),
  'infra-water': () => import('../screens/infra-water'),
  'system-infra': () => import('../screens/system-infra'),
  'tickets-list': () => import('../screens/tickets-list'),
  'tickets-detail': () => import('../screens/tickets-detail'),
  'tickets-board': () => import('../screens/tickets-board'),
  'tickets-handlers': () => import('../screens/tickets-handlers'),
  'tickets-rfqs': () => import('../screens/tickets-rfqs'),
  'tickets-maintenance': () => import('../screens/tickets-maintenance'),
  'tickets-overview': () => import('../screens/tickets-overview'),
  'calendars-page': () => import('../calendars/cal-page'),
  'system-calendars': () => import('../screens/system-calendars'),
  'system-calendar-sync': () => import('../screens/system-calendar-sync'),
  'tickets-vendor-accounts': () => import('../tickets/vendor-accounts'),
  'system-tickets': () => import('../screens/system-tickets'),
  'system-fleet-report': () => import('../screens/system-fleet-report'),
  'system-intercom-ops': () => import('../screens/system-intercom-ops'), // WISKEY-OPS-VIEWS-2400
  'system-messaging-accounts': () => import('../screens/system-messaging-accounts'),
  'security-alarm': () => import('../screens/security-alarm'),
  'live-overview': () => import('../screens/live-overview'),
  'live-wall': () => import('../screens/live-wall'),
  'live-camera': () => import('../screens/live-camera'),
  'live-views': () => import('../screens/live-views'),
  'kiosk-wall': () => import('../screens/kiosk-wall'),
  'devices-synoptic': () => import('../screens/devices-synoptic'),
  'system-wall': () => import('../screens/system-wall'),
  'system-notices': () => import('../screens/system-notices'),
  'system-transit': () => import('../screens/system-transit'),
  'devices-notices': () => import('../screens/devices-notices'),
  'devices-announce': () => import('../screens/devices-announce'),
  'system-access-control': () => import('../screens/system-access-control'),
  'investigate-playback': () => import('../screens/investigate-playback'),
  'investigate-sync': () => import('../screens/investigate-sync'),
  'investigate-history-map': () => import('../screens/investigate-history-map'),
  'investigate-events': () => import('../screens/investigate-events'),
  'investigate-ha-events': () => import('../screens/investigate-ha-events'),
  'investigate-event-detail': () => import('../screens/investigate-event-detail'),
  'investigate-incidents': () => import('../screens/investigate-incidents'),
  'investigate-reviews': () => import('../screens/investigate-reviews'),
  'investigate-cases': () => import('../screens/investigate-cases'),
  'investigate-case-detail': () => import('../screens/investigate-cases'),
  'investigate-exports': () => import('../screens/investigate-exports'),
  'investigate-search': () => import('../screens/investigate-search'),
  'investigate-rules': () => import('../screens/investigate-rules'),
  'investigate-rule-editor': () => import('../screens/investigate-rules'),
  'system-access': () => import('../screens/system-access'),
  'system-audit': () => import('../screens/system-audit'),
  'system-setup': () => import('../screens/system-setup'),
  'system-wizard': () => import('../screens/system-wizard'),
  'system-readiness': () => import('../screens/system-readiness'),
  'system-devices': () => import('../screens/system-devices'),
  'system-diagnostics': () => import('../screens/system-diagnostics'),
  'system-security': () => import('../screens/system-security'),
  'system-storage': () => import('../screens/system-storage'),
  'system-update': () => import('../screens/system-update'),
  'system-notifications': () => import('../screens/system-notifications'),
  'screens-index': () => import('../screens/screens-index'),
  'styleguide-screen': () => import('../screens/styleguide-screen'),
  'bubble-demo': () => import('../screens/bubble-demo'),
};

/** The chunk fetch of each tag, while it is in flight (a settled one is dropped: a failed fetch may be retried by the next render). */
const loads = new Map<string, Promise<void>>();
/** The tags a rendered route waits for (a background warm-up alone is not in here). */
const awaited = new Set<string>();
/** Chunks that loaded: a tag whose module landed is never waited for again (were it not defined by its module, the shell renders it
 * as before instead of waiting in a loop). */
const landed = new Set<string>();
const RETRY_MS = 3000;

/** How many screen chunks a rendered route is still waiting for (a background warm-up is not counted). */
export function pendingScreens(): number {
  return awaited.size;
}

const isDefined = (tag: string): boolean => typeof customElements !== 'undefined' && !!customElements.get(tag);

/** Start the chunk of `tag` once (a failed fetch - offline, a release swapped under an open tab - may be retried by the next
 * render). `done` runs when it settled, either way - also when the fetch was already in flight (a background warm-up the route
 * now waits for). `background`: a warm-up nothing on the screen waits for - not counted by pendingScreens and never reloads the
 * page when it fails. Returns whether a fetch started now. */
export function loadScreen(tag: string, done?: () => void, background = false): boolean {
  const load = LAZY_SCREENS[tag];
  if (!load || isDefined(tag)) return false;
  let p = loads.get(tag);
  const fresh = !p;
  if (!p) {
    p = load().then(
      () => {
        landed.add(tag);
      },
      async (err: unknown) => {
        console.warn(`screen chunk for <${tag}> failed to load`, err);
        if (awaited.has(tag)) reloadOnceForNewRelease();
        // the render that follows tries again: not at once (offline, every render would fetch again in a tight loop)
        await new Promise((r) => setTimeout(r, RETRY_MS));
      },
    );
    const settled = p;
    void settled.finally(() => {
      if (loads.get(tag) === settled) loads.delete(tag);
    });
    loads.set(tag, p);
  }
  if (!background && !awaited.has(tag)) {
    awaited.add(tag);
    void p.finally(() => awaited.delete(tag));
  }
  if (done) void p.finally(done);
  return fresh;
}

const TAG_RE = /<([a-z][a-z0-9]*-[a-z0-9-]*)/g;

/** GATE2342-B: the lazy screen tags a route's template renders whose chunk has not landed yet. `result` is what the shell's
 * renderRoute returns: a Lit TemplateResult ({strings, values}), a directive result such as keyed() ({values}), an array or
 * `nothing`; nested templates in the values are searched too.
 *
 * Why the shell waits for these instead of rendering the tag at once: an element rendered BEFORE its definition is upgraded in place
 * when the chunk lands, and Lit gives back the properties set on it (`.floorId`, `.areaId`, `.route`, ...) only at its first update -
 * AFTER connectedCallback. A screen that reads a property in connectedCallback (explore-plan-editor loads `this.floorId || 'f0'`
 * there) then works on the default value. Created after its definition, the element gets its properties before it is connected,
 * exactly as when every screen was in the entry chunk. */
export function waitingScreenTags(result: unknown): string[] {
  const out = new Set<string>();
  const walk = (v: unknown, depth: number): void => {
    if (depth > 12 || v === null || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      for (const x of v) walk(x, depth + 1);
      return;
    }
    const r = v as { strings?: unknown; values?: unknown };
    if (Array.isArray(r.strings)) {
      for (const m of (r.strings as string[]).join('').matchAll(TAG_RE)) {
        const tag = m[1]!;
        if (Object.prototype.hasOwnProperty.call(LAZY_SCREENS, tag) && !isDefined(tag) && !landed.has(tag)) out.add(tag);
      }
    }
    if (Array.isArray(r.values)) for (const x of r.values) walk(x, depth + 1);
  };
  walk(result, 0);
  return [...out];
}

const RELOAD_KEY = 'arx-screen-chunk-reload';
const RELOAD_GAP_MS = 60_000;

/** A tab left open across a release still runs the old entry chunk, whose lazy chunk names the server no longer has (every
 * release replaces the add-on's www folder; the service worker caches only what was fetched). The screen would stay blank, so
 * the page loads again once - the new release's entry chunk - unless it already did so within the last minute (a chunk that
 * fails for another reason, offline for one, never loops). */
function reloadOnceForNewRelease(): void {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_GAP_MS) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    location.reload();
  } catch {
    /* no session storage (a locked-down browser): stay on the page */
  }
}

let warmed = false;

/** After the home screen is up: fetch the chunk of its own drill-down (one area's screen) while the browser is idle, so the first
 * tap on an area does not wait for the network. Once per page; nothing renders from it. */
export function warmHomeDrillDown(): void {
  if (warmed) return;
  warmed = true;
  const run = () => void loadScreen('devices-area', undefined, true);
  const idle = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(run, { timeout: 4000 });
  else setTimeout(run, 1500);
}

/** Put a parked element back where its comment is, upgraded first when its chunk defined it (see the header). */
function unpark(el: Element, mark: Comment): void {
  if (!mark.isConnected) return; // the render moved on (another route, another floor): the element went with its place
  if (isDefined(el.localName) && !el.matches(':defined')) {
    // the properties the template set on the plain element - including ones it set again while the element was parked
    const props = Object.keys(el).map((k) => [k, (el as unknown as Record<string, unknown>)[k]] as const);
    customElements.upgrade(el); // detached: the constructor runs now, connectedCallback only when it is back in the document
    for (const [k, v] of props) (el as unknown as Record<string, unknown>)[k] = v; // through the defined accessors
  }
  mark.replaceWith(el);
}

/** Every undefined custom element under `root` whose tag is a lazy screen: park it, start (or join) its chunk, and put it back
 * upgraded when the chunk settled (the header says why it is not upgraded in place). `done` runs after each one is back.
 * `background`: as for loadScreen - the caller is not the shell's route, so `data-shell-ready` does not wait for it.
 * Returns how many elements were parked. */
export function loadPendingScreens(root: ParentNode, done?: () => void, background = false): number {
  let n = 0;
  for (const el of [...root.querySelectorAll(':not(:defined)')]) {
    const tag = el.localName;
    if (!Object.prototype.hasOwnProperty.call(LAZY_SCREENS, tag) || isDefined(tag) || landed.has(tag)) continue;
    const mark = document.createComment(` ${tag} `);
    el.replaceWith(mark);
    loadScreen(
      tag,
      () => {
        unpark(el, mark);
        done?.();
      },
      background,
    );
    n += 1;
  }
  return n;
}
