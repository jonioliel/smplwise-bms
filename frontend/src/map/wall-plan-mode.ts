/**
 * Plan Studio 6, slice S5-B (CR-029 sections 3.3 / 7, CR-030 section 4, docs/changes/CR-029-ST7-S5B-NOTES.md): how a wall display
 * decides what its plan shows - live 3D or the baked stills, at which quality, and after how long it idles into the still.
 * Pure: the three layers come in as arguments, the answer says which layer won each dial.
 *
 *   the screen's own setting (the wall profile's `plan` block, CR-030)      - this display, set in Settings > wall screens
 *   > this browser's pin (localStorage, set by ?display=wall&plan=...)      - a wall browser with no profile (S3 notes)
 *   > the installation's dials (plan.view: wall_display, quality, kiosk_idle_s)
 *
 * `follow` in the screen's setting hands the dial to the next layer. The person's own look dials (a desk user's default view or
 * quality) are NOT a layer here: a wall tablet has no person (S0 notes P7), and the screen's setting must hold whatever the
 * signed-in user prefers - the `quality` answer is therefore a value the 3D element FORCES over the viewer's own choice, or
 * null when nothing forces it and the usual precedence applies.
 */
import { asMode, MODES, WALL_DISPLAY_KEY, type QualityMode } from './quality-ladder';
import type { PlanViewDials } from '../api/plan-view';

export type WallPlanMode = 'follow' | 'live' | 'stills';
export type WallPlanQuality = 'follow' | QualityMode;
export type WallPlanIdle = 'follow' | 0 | 10 | 30 | 120 | 600;
/** The wall profile's `plan` block (backend services/wall.py `Plan`). */
export interface WallPlanSetting {
  mode: WallPlanMode;
  quality: WallPlanQuality;
  idle_s: WallPlanIdle;
}
export const FOLLOW_PLAN: WallPlanSetting = { mode: 'follow', quality: 'follow', idle_s: 'follow' };
export const WALL_PLAN_MODES: readonly WallPlanMode[] = ['follow', 'live', 'stills'];
export const WALL_PLAN_IDLE: readonly Exclude<WallPlanIdle, 'follow'>[] = [0, 10, 30, 120, 600];

export const WALL_QUALITY_KEY = 'sw.plan3d.wall_quality';
export const WALL_IDLE_KEY = 'sw.plan3d.wall_idle_s';

export type PlanSource = 'screen' | 'browser' | 'installation';
export interface WallPlan {
  mode: 'live' | 'stills';
  /** Forced over the viewer's own choice, or null: nothing forces it. */
  quality: QualityMode | null;
  idleS: number;
  from: { mode: PlanSource; quality: PlanSource | null; idleS: PlanSource };
}

/** This browser's own pins. */
export interface WallPins {
  mode: 'live' | 'stills' | null;
  quality: QualityMode | null;
  idleS: number | null;
}
export const NO_PINS: WallPins = { mode: null, quality: null, idleS: null };

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const defaultStore = (): Store | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

/** A stored or typed setting as a clean value (anything else is "not set"). */
export function planModeOf(v: unknown): 'live' | 'stills' | null {
  return v === 'live' || v === 'stills' ? v : null;
}
export function idleOf(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return (WALL_PLAN_IDLE as readonly number[]).includes(n) ? n : null;
}
export function qualityOf(v: unknown): QualityMode | null {
  return typeof v === 'string' && (MODES as readonly string[]).includes(v) ? (v as QualityMode) : asMode(v);
}

/** The pins of this browser (storage unavailable or empty = none). */
export function readWallPins(store: Store | null = defaultStore()): WallPins {
  if (!store) return NO_PINS;
  const get = (k: string): string | null => {
    try {
      return store.getItem(k);
    } catch {
      return null;
    }
  };
  return { mode: planModeOf(get(WALL_DISPLAY_KEY)), quality: qualityOf(get(WALL_QUALITY_KEY)), idleS: idleOf(get(WALL_IDLE_KEY)) };
}

/**
 * The route's wall parameters: `?display=wall&plan=stills&quality=schematic&idle=120` pins this browser (remembered, like
 * `display=wall` itself); a value of `-` or `follow` removes one pin; `display=desk` removes all of them. Unknown values are
 * ignored. Returns the pins in force afterwards.
 */
export function applyWallParams(search: string, store: Store | null = defaultStore()): WallPins {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (store) {
    const put = (key: string, raw: string | null, ok: (v: unknown) => boolean): void => {
      if (raw === null) return;
      try {
        if (raw === '-' || raw === 'follow') store.removeItem(key);
        else if (ok(raw)) store.setItem(key, raw);
      } catch {
        /* storage blocked: the route still applies for this page through the returned pins */
      }
    };
    if (q.get('display') === 'desk') {
      for (const k of [WALL_DISPLAY_KEY, WALL_QUALITY_KEY, WALL_IDLE_KEY]) {
        try {
          store.removeItem(k);
        } catch {
          /* nothing to clear */
        }
      }
    } else if (q.get('display') === 'wall') {
      put(WALL_DISPLAY_KEY, q.get('plan'), (v) => planModeOf(v) !== null);
      put(WALL_QUALITY_KEY, q.get('quality'), (v) => qualityOf(v) !== null);
      put(WALL_IDLE_KEY, q.get('idle'), (v) => idleOf(v) !== null);
    }
  }
  return readWallPins(store);
}

/** The effective plan of a wall display from its three layers. `setting` may be absent (an older configuration, a display with
 * no profile); `pins` the browser's own. */
export function resolveWallPlan(setting: Partial<WallPlanSetting> | null | undefined, pins: WallPins | null | undefined, dials: Pick<PlanViewDials, 'wall_display' | 'quality' | 'kiosk_idle_s'>): WallPlan {
  const p = pins ?? NO_PINS;
  const sMode = planModeOf(setting?.mode);
  const sQuality = setting?.quality && setting.quality !== 'follow' ? qualityOf(setting.quality) : null;
  const sIdle = setting?.idle_s !== undefined && setting.idle_s !== 'follow' ? idleOf(setting.idle_s) : null;
  const mode = sMode ?? p.mode ?? planModeOf(dials.wall_display) ?? 'live';
  const modeFrom: PlanSource = sMode ? 'screen' : p.mode ? 'browser' : 'installation';
  const quality = sQuality ?? p.quality;
  const qualityFrom: PlanSource | null = sQuality ? 'screen' : p.quality ? 'browser' : null;
  const idleS = sIdle ?? p.idleS ?? idleOf(dials.kiosk_idle_s) ?? 0;
  const idleFrom: PlanSource = sIdle !== null ? 'screen' : p.idleS !== null ? 'browser' : 'installation';
  return { mode, quality, idleS, from: { mode: modeFrom, quality: qualityFrom, idleS: idleFrom } };
}
