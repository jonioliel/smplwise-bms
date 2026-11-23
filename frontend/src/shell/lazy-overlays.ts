/**
 * PERF-2490: the shell's event-opened overlays as chunks of their own.
 *
 * The shell mounts two elements that draw nothing until a window event opens them: the device activity popup (`<device-activity>`,
 * opened by a long press / the ticket count chip through OPEN_EVENT) and the plan-closing prompt (`<maint-close-prompt>`, opened by
 * the tickets API's `sw:ticket-closed`). Both used to be in the entry chunk (~140 KB raw with what only they import). Now this module
 * - a few lines in the entry chunk - listens for their events instead: the first event starts the element's chunk, and once it landed
 * the waiting events are sent again, in order, to the element that now listens for them.
 *
 * The shell keeps rendering both tags exactly where it did. Until the chunk lands they are plain unupgraded elements; the definition
 * upgrades them in place, which is safe here (unlike the route screens of lazy-screens.ts, GATE2342-B): the shell sets no property on
 * them, so there is nothing an upgrade could hand over late, and they draw nothing while closed. The popup's chunk is also fetched
 * ahead while the browser is idle after the first screen is up (warmOverlays, the same conditions as the screens' warm-up), so a first
 * long press rarely waits for the network; the prompt's is not (a closed request asks the server first anyway).
 * scripts/lazy-tags-check.mjs keeps both modules out of the entry chunk (NOT_IN_ENTRY).
 */
import { OPEN_EVENT } from '../components/device-activity-press';
import { screenWarmupAllowed } from './lazy-screens';

interface Overlay {
  tag: string;
  event: string;
  load: () => Promise<unknown>;
}

export const LAZY_OVERLAYS: readonly Overlay[] = [
  { tag: 'device-activity', event: OPEN_EVENT, load: () => import('../components/device-activity') },
  { tag: 'maint-close-prompt', event: 'sw:ticket-closed', load: () => import('../maintenance/close-prompt') },
];

const defined = (tag: string): boolean => typeof customElements !== 'undefined' && !!customElements.get(tag);
const loads = new Map<string, Promise<boolean>>();

/** Fetch the chunk of an overlay once (a failed fetch may be retried by the next event). Settles true when the element is defined. */
function loadOverlay(o: Overlay): Promise<boolean> {
  if (defined(o.tag)) return Promise.resolve(true);
  let p = loads.get(o.tag);
  if (!p) {
    p = o.load().then(
      () => defined(o.tag),
      (err: unknown) => {
        console.warn(`overlay chunk for <${o.tag}> failed to load`, err);
        loads.delete(o.tag);
        return false;
      },
    );
    loads.set(o.tag, p);
  }
  return p;
}

/** Hold the events of an overlay whose element is not defined yet and send them again once it is (see the header). This listener is
 * registered when the entry chunk runs - before the element can listen - so it hears each event first: an event it holds is stopped
 * there (the element, once defined, would otherwise hear a later event before the held ones are sent again) and sent again in order. */
function relay(o: Overlay): void {
  const held: CustomEvent[] = [];
  const replaying = new WeakSet<Event>();
  let pending = false;
  const onEvent = (e: Event): void => {
    if (replaying.has(e)) return;
    if (!pending && defined(o.tag)) {
      window.removeEventListener(o.event, onEvent); // the element listens by now: nothing to hold any more
      return;
    }
    e.stopImmediatePropagation();
    held.push(e as CustomEvent);
    if (pending) return;
    pending = true;
    void loadOverlay(o).then((ok) => {
      pending = false;
      if (!ok) {
        held.length = 0; // offline / a release swapped under the tab: the next event tries again, as an open did before
        return;
      }
      window.removeEventListener(o.event, onEvent);
      for (const h of held.splice(0)) {
        const again = new CustomEvent(o.event, { detail: h.detail });
        replaying.add(again);
        window.dispatchEvent(again);
      }
    });
  };
  window.addEventListener(o.event, onEvent);
}

if (typeof window !== 'undefined') for (const o of LAZY_OVERLAYS) relay(o);

let warmed = false;

/** After the first screen is up: fetch the device popup's chunk while the browser is idle (once per page; nothing renders from it). */
export function warmOverlays(): void {
  if (warmed || !screenWarmupAllowed()) return;
  warmed = true;
  const run = (): void => {
    if (screenWarmupAllowed()) void loadOverlay(LAZY_OVERLAYS[0]!);
  };
  const idle = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(run, { timeout: 4000 });
  else setTimeout(run, 1500);
}
