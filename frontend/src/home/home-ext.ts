// HOME-V3-P1-2430: the extension point of the home interface (mockup v3). Each added screen lives in its own file and registers itself
// here; sw-home.ts only wires the registry in (routing, the delegated click handler, overlays, the back target, the nav item). Phases 2
// and 3 add their screens the same way, in their own files, so the merges stay small.
//
// A screen module gets the sw-home element itself as its host (the shared pieces: head, seg, pager, empty, toast, href, the data, the
// overlay) and returns plain lit templates. Actions are `data-act="<name>"` exactly as in sw-home: a module's `acts` are looked up when
// sw-home has no `a_<name>` of its own, so action names must be unique across modules (prefix them).
import type { SwHome } from './sw-home';

export type HomeHost = SwHome;

/** An overlay a module opens: `{ type: 'ext', mod: '<module id>', ...its own fields }` (closed by sw-home like every other overlay). */
export interface ExtOvl {
  type: 'ext';
  mod: string;
  [k: string]: unknown;
}

export interface HomeScreen {
  /** module id (overlays name it) */
  id: string;
  /** the route names this module renders (#/home/<name>/<arg>) */
  names: string[];
  render(name: string, arg: string): unknown;
  /** called when the route enters one of `names` (load data here) */
  enter?(name: string, arg: string): void;
  /** called when the route leaves this module (release players, timers) */
  leave?(): void;
  ovl?(o: ExtOvl): unknown;
  acts?: Record<string, (el: HTMLElement) => boolean | void>;
  /** where the strip's back arrow goes from this screen ('more', 'cameras', ...); default: the current room */
  back?(name: string): string | null;
  /** which nav item is current on this screen ('more' for the hub's children) */
  navCur?(name: string): string | null;
}

type Factory = (h: HomeHost) => HomeScreen;
const FACTORIES: Factory[] = [];

export function registerScreen(f: Factory): void {
  FACTORIES.push(f);
}

export function buildScreens(h: HomeHost): HomeScreen[] {
  return FACTORIES.map((f) => f(h));
}
