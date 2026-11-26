import { css, html, type TemplateResult } from 'lit';
import type { StateKind } from '../components/sw-badge';
import { CARD_IDS, type CardId, type DeviceArea, type DeviceAreaDetail, type DeviceRow, type DeviceTree, type EntityRow } from '../api/devices';
import type { HaPush, HaSyncState } from '../api/ha';
import type { AreaLineView } from '../api/building-presence-logic';
import { BP } from '../i18n/building-presence';
import { ltrNum } from '../i18n/bidi';

/**
 * CR-G1-HOME-AREA-2440 (code review 06:DUP-10, 06:PERF-6): the small pieces the home screen (devices-building.ts), the area screen
 * (devices-area.ts) and the area quick sheet (area-quick-sheet.ts) each carried a copy of - the refetch throttle, the fit step, the push
 * routing, the sensor value text, the presence line's names, the loading skeleton's CSS - and the per-render lookups they now memoise.
 *
 * The area screen used to import five of these from the 220 KB home module; it imports this file instead. Nothing here reads the DOM at
 * import time, so node unit specs load it (tests/unit-g1-home-area-2440.spec.ts).
 */

// ------------------------------------------------------------------------------------------------ constants and DOM helpers (moved)

/** The packed layout is for a desktop-width screen; a phone scrolls. */
export const FIT_MIN_WIDTH = 900;

/** Refetches are throttled, not debounced: the first push starts a window, every push inside it rides the same
 * refetch, and a push during the fetch itself queues exactly one more (loadAgain). A screen full of sensors updating
 * several times a second therefore refreshes about every REFRESH_WINDOW_MS instead of never (a resetting debounce
 * would starve - review finding). */
export const REFRESH_WINDOW_MS = 400;

/** How long "מבנה עודכן" stays up after a structure change refetched the screen (CR-007 HA refresh). */
export const STRUCTURE_FLASH_MS = 4000;

/** The nearest ancestor that scrolls vertically (crossing shadow roots) - the shell's page area. */
export function scrollParentOf(el: Element): HTMLElement | null {
  let node: Node | null = el;
  while (node) {
    const parent: Node | null = (node as Element).assignedSlot ?? node.parentNode ?? (node as ShadowRoot).host ?? null;
    if (parent instanceof HTMLElement && ['auto', 'scroll'].includes(getComputedStyle(parent).overflowY)) return parent;
    node = parent;
  }
  return null;
}

export function alarmTone(state: string | null): StateKind {
  if (!state) return 'neutral';
  if (state === 'triggered') return 'error';
  if (state === 'disarmed') return 'neutral';
  if (state === 'unavailable' || state === 'unknown') return 'offline';
  return 'live';
}

// ------------------------------------------------------------------------------------------------ the fit step (06:DUP-10)

/** How tight a control screen is packed so it fits the viewport without a vertical scroll: 0 = as designed, 1 / 2 = tighter. */
export type FitLevel = 0 | 1 | 2;

/**
 * One measuring step of the fit packing, shared by the home and the area screens (each measured it with its own copy). `key` describes
 * what the packing depends on (viewport, view, shape); when it differs from `lastKey` the packing restarts from the loosest level - a
 * level above 0 drops to 0 and is measured again after that render. Otherwise, while `overflowing()` the level goes one step tighter
 * (at most 2). `settled` = nothing changed: the level holds (the area screen then measures its pages).
 */
export function fitStep(fit: FitLevel, key: string, lastKey: string, overflowing: () => boolean): { fit: FitLevel; lastKey: string; settled: boolean } {
  if (key !== lastKey && fit !== 0) return { fit: 0, lastKey: key, settled: false };
  if (fit < 2 && overflowing()) return { fit: (fit + 1) as FitLevel, lastKey: key, settled: false };
  return { fit, lastKey: key, settled: true };
}

// ------------------------------------------------------------------------------------------------ the refetch throttle (06:DUP-10)

/** The timer source of the throttle (the window's by default; node specs pass a fake clock). */
export interface TimerEnv {
  set(run: () => void, ms: number): number;
  clear(handle: number): void;
}

const windowTimers: TimerEnv = {
  set: (run, ms) => window.setTimeout(run, ms),
  clear: (handle) => window.clearTimeout(handle),
};

/**
 * The push-driven refetch of the home screen, the area screen and the area quick sheet: a throttle, not a resetting debounce (that
 * starves while pushes keep coming). The first `schedule()` opens a window of `ms`; every call inside it rides the same run; the run
 * happens once when the window ends. `cancel()` (disconnect, close) drops a pending run and `schedule()` works again afterwards.
 */
export class ReloadThrottle {
  private handle = 0;

  constructor(
    private readonly ms: number,
    private readonly run: () => void,
    private readonly env: TimerEnv = windowTimers,
  ) {}

  /** A run is booked (the window is open). */
  get pending(): boolean {
    return this.handle !== 0;
  }

  readonly schedule = (): void => {
    if (this.handle) return; // a refetch is already on its way: this push rides it
    this.handle = this.env.set(() => {
      this.handle = 0;
      this.run();
    }, this.ms);
  };

  cancel(): void {
    if (!this.handle) return;
    this.env.clear(this.handle);
    this.handle = 0;
  }
}

// ------------------------------------------------------------------------------------------------ the push routing (06:DUP-10)

/** What a devices screen does with each kind of push (a missing handler = that kind is ignored). */
interface DevicePushHandlers {
  entity?: (entityId: string) => void;
  structure?: (reason?: string) => void;
  /** The HA link went up or down (ha_sync_state). */
  connected?: (connected: boolean) => void;
  heartbeat?: (sync: HaSyncState) => void;
}

/** One push to the screen's handlers - the switch the home screen, the area screen and the quick sheet each wrote out. */
export function routeDevicePush(m: HaPush, h: DevicePushHandlers): void {
  if (m.type === 'entity_state_changed') h.entity?.(m.entity.entity_id);
  else if (m.type === 'structure_changed') h.structure?.(m.reason); // LOWS-BACKEND-2550: `resync` = a refetch after the socket's queue overflowed, no change
  else if (m.type === 'ha_sync_state') h.connected?.(m.connected);
  else if (m.type === 'heartbeat') h.heartbeat?.(m.sync);
}

/** The sync line after an ha_sync_state push: the same answer with the new link state (null stays null - nothing is invented). */
export function withConnected(sync: HaSyncState | null, connected: boolean): HaSyncState | null {
  return sync ? { ...sync, connected } : sync;
}

// ------------------------------------------------------------------------------------------------ memoised lookups (06:PERF-6, 06:DUP-10)

/** The identity of a set of layout grids: their ids and keys in order (the layout controller's prepare() rebuilds its view only when this
 * or another of its inputs changes). */
export function gridsKey(grids: readonly { id: string; keys: readonly string[] }[]): string {
  return grids.map((g) => `${g.id}=${g.keys.join(',')}`).join('|');
}

/** A deep copy of a JSON value (the six `JSON.parse(JSON.stringify(x))` of the home and layout code: same semantics - undefined drops). */
export function jsonClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const areaIndexes = new WeakMap<DeviceTree, Map<string, DeviceArea>>();

/** Every area of a tree by id, built once per tree object (the home screen looked an area up by walking the floors in five places). */
export function areaIndex(tree: DeviceTree): Map<string, DeviceArea> {
  let out = areaIndexes.get(tree);
  if (!out) {
    out = new Map();
    for (const f of tree.floors) for (const a of f.areas) if (!out.has(a.area_id)) out.set(a.area_id, a); // the first wins, as find() did
    areaIndexes.set(tree, out);
  }
  return out;
}

/** An area of the tree by id (undefined = not in this tree). */
export function findArea(tree: DeviceTree | null | undefined, id: string): DeviceArea | undefined {
  return tree ? areaIndex(tree).get(id) : undefined;
}

export type RowIndex = Map<string, { row: DeviceRow; card: CardId }>;

/** No extra rows (the quick sheet draws the area's own cards only). */
export const NO_EXTRA: ReadonlyMap<string, EntityRow> = new Map();

/**
 * Remembers the last answer for the last two inputs (by identity). The area screen rebuilt its row index and its entity-id set up to six
 * times per render and once per push; both depend only on the loaded detail and the extra rows, which are replaced, never mutated.
 */
export class Memo2<A, B, R> {
  private last: { a: A; b: B; out: R } | null = null;

  constructor(private readonly fn: (a: A, b: B) => R) {}

  get(a: A, b: B): R {
    const l = this.last;
    if (l && l.a === a && l.b === b) return l.out;
    const out = this.fn(a, b);
    this.last = { a, b, out };
    return out;
  }
}

/** Every row of the area by entity id with its card; the layout's devices of other areas (`extra`) after the area's own. */
export function rowIndexOf(d: DeviceAreaDetail | null, extra: ReadonlyMap<string, EntityRow>): RowIndex {
  const out: RowIndex = new Map();
  if (!d) return out;
  for (const id of CARD_IDS) for (const r of d.cards[id]?.entities ?? []) out.set(r.entity_id, { row: r, card: id }); // P6 item 13: a missing card never blanks the screen
  for (const [id, r] of extra) if (!out.has(id)) out.set(id, { row: r, card: r.card }); // devices of other areas the layout lists
  return out;
}

/** The entity ids of a loaded area (every card) plus the extra rows' ids - the push filter of the area screen and the quick sheet. */
export function areaEntityIds(d: DeviceAreaDetail | null, extra?: ReadonlyMap<string, unknown>): Set<string> {
  if (!d) return new Set();
  const out = new Set<string>();
  for (const id of CARD_IDS) for (const r of d.cards[id]?.entities ?? []) out.add(r.entity_id);
  for (const id of extra?.keys() ?? []) out.add(id);
  return out;
}

// ------------------------------------------------------------------------------------------------ shared text (06:DUP-10)

/** How a sensor value meets its unit: `spaced` = always a space ("21.5 °C"), `tight` = no space before a degree sign or a percent
 * ("21.5°C", "40%") and a space before any other unit. Kept as a parameter so the screens draw exactly what they drew before. */
type UnitSpacing = 'spaced' | 'tight';

/** A sensor's number (an integer as is, else one decimal; marked left-to-right) and its unit - written three times before. */
export function sensorValueText(value: number, unit: string | null | undefined, spacing: UnitSpacing): string {
  const n = ltrNum(Number.isInteger(value) ? value : value.toFixed(1));
  if (!unit) return n;
  return spacing === 'tight' && (unit.startsWith('°') || unit === '%') ? `${n}${unit}` : `${n} ${unit}`;
}

/** The people part of the area presence line: the names the server sent (each isolated) and "ועוד N", or the count text. */
export function presenceWho(v: AreaLineView): TemplateResult | string {
  return v.names.length ? html`${v.names.map((n, i) => html`${i ? ', ' : ''}<bdi>${n}</bdi>`)}${v.rest > 0 ? ` ${BP.andMore(v.rest)}` : ''}` : v.people;
}

// ------------------------------------------------------------------------------------------------ shared CSS (06:DUP-10)

/** The loading skeleton's blocks and shimmer (HOME polish 2026-10-10), the same rules in the home and the area screens. The shimmer
 * stops under reduced motion. Each screen adds the shape of its own skeleton (bands, strips, cards). */
export const SKELETON_CSS = css`
  .skeleton {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-inline-size: 0;
  }
  .skl {
    position: relative;
    overflow: hidden;
    border-radius: var(--sw-r-md);
    background: var(--sw-skeleton);
  }
  .skl::after {
    content: '';
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, var(--sw-skeleton-shine), transparent);
  }
  @media (prefers-reduced-motion: no-preference) {
    .skl::after {
      animation: skl-shine 1.4s var(--sw-ease) infinite;
    }
  }
  @keyframes skl-shine {
    to {
      transform: translateX(100%);
    }
  }
`;
