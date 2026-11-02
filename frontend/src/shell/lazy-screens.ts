/**
 * PERF-HOME-DEVICES-2342: the route screens as lazy chunks of their own.
 *
 * The shell imported all ~90 screens eagerly, so the first load of ANY address - the home screen (#/devices/building)
 * included - downloaded, parsed and evaluated one ~11 MB entry chunk. Now only the home screen (devices-building, imported
 * by the shell for its demo tree and as the landing page) and what the shell itself draws stay in the entry chunk; every
 * other screen below is fetched when the shell first renders its tag. The tags are rendered exactly as before
 * (sw-app renderRoute): an element whose definition has not arrived is an unupgraded custom element.
 *
 * GATE2342-A: such an element must NOT be upgraded in place. An in-place upgrade runs the constructor and then
 * connectedCallback at once, and Lit's constructor moves the properties the template set on the plain element
 * (`.floorId`, `.initialTab`, ...) aside until the FIRST UPDATE - so every screen that reads one in connectedCallback saw
 * its default instead (the plan editor loaded floor f0 whatever floor was asked, #/investigate/rules?tab=alerts opened on
 * the rules tab). So `loadPendingScreens(root)` takes each undefined element of a listed tag out of the DOM (a comment
 * keeps its place) before its chunk arrives - a definition only upgrades connected elements - and when the chunk landed
 * upgrades it while detached, sets the properties again through the now defined accessors and puts it back: its
 * connectedCallback runs with the template's values, exactly as for an element created after its definition. If the
 * render moved on meanwhile (another route), the comment is gone and so is the element.
 *
 * `loadPendingScreens(root)` runs after each render of the shell (and of the home screen, for its plan view's map) and
 * starts the chunk of each tag listed here; `pendingScreens()` says how many are still in flight (the shell keeps
 * `data-shell-ready` off until they landed, so nothing that waits for it sees a screen that is not there yet).
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

/** tag -> its chunk in flight: settles `true` once the tag is defined, `false` when the fetch failed (never rejects). Dropped
 * when it settled, so a failed chunk is asked again by the next render. One fetch per tag, whoever asked first (the home's
 * warm-up of the area screen and a tap on an area share it). */
const chunks = new Map<string, Promise<boolean>>();
let inFlight = 0;

/** How many screen chunks a rendered route is still waiting for (a background warm-up is not counted). */
export function pendingScreens(): number {
  return inFlight;
}

function chunkOf(tag: string): Promise<boolean> | null {
  const load = LAZY_SCREENS[tag];
  if (!load || customElements.get(tag)) return null;
  let p = chunks.get(tag);
  if (!p) {
    p = load().then(
      () => {
        chunks.delete(tag);
        return true;
      },
      (err: unknown) => {
        chunks.delete(tag);
        console.warn(`screen chunk for <${tag}> failed to load`, err);
        return false;
      },
    );
    chunks.set(tag, p);
  }
  return p;
}

/** Fetch the chunk of `tag` unless it is defined (a fetch already in flight is shared; a failed one - offline, a release swapped
 * under an open tab - is retried by the next call). `done` runs when it settled, either way. `background`: nothing on the screen
 * waits for it - not counted by pendingScreens and never reloads the page when it fails. Returns whether there is a chunk to
 * wait for. */
export function loadScreen(tag: string, done?: () => void, background = false): boolean {
  const p = chunkOf(tag);
  if (!p) return false;
  if (!background) inFlight += 1;
  void p.then((ok) => {
    if (!background) {
      inFlight -= 1;
      if (!ok) reloadOnceForNewRelease();
    }
    done?.();
  });
  return true;
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
  if (customElements.get(el.localName) && !el.matches(':defined')) {
    // the properties the template set on the plain element - including ones it set again while the element was parked
    const props = Object.keys(el).map((k) => [k, (el as unknown as Record<string, unknown>)[k]] as const);
    customElements.upgrade(el); // detached: the constructor runs now, connectedCallback only when it is back in the document
    for (const [k, v] of props) (el as unknown as Record<string, unknown>)[k] = v; // through the defined accessors
  }
  mark.replaceWith(el);
}

/** Every undefined custom element under `root` whose tag is a lazy screen: park it, start its chunk, and put it back upgraded
 * when the chunk landed (the header says why it is not upgraded in place). `done` runs after each one is back. `background`:
 * as for loadScreen - the caller is not the shell's route, so `data-shell-ready` does not wait for it. */
export function loadPendingScreens(root: ParentNode, done?: () => void, background = false): number {
  let n = 0;
  for (const el of [...root.querySelectorAll(':not(:defined)')]) {
    if (!LAZY_SCREENS[el.localName] || customElements.get(el.localName)) continue;
    const mark = document.createComment(` ${el.localName} `);
    el.replaceWith(mark);
    const waiting = loadScreen(
      el.localName,
      () => {
        unpark(el, mark);
        done?.();
      },
      background,
    );
    if (waiting) n += 1;
    else unpark(el, mark);
  }
  return n;
}
