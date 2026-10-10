/**
 * The quality ladder of the plan view (CR-029 section 3.4, LOOK_SPEC section 4, S3 notes section 6) as pure decisions, so the
 * 3D element, the floor-map host, the wall display and the tests agree:
 *
 *   realistic -> lite -> full -> schematic -> stills (only with a current bake of the level) -> 2D
 *
 * - `ladderNext`: one rung down after a failed frame-budget probe. The walk never drops to stills (a still cannot be walked).
 * - `viewMode`: what a host shows now - the live 3D, the stills or the 2D map - from the WebGL check, the wall-display dial,
 *   the kiosk idle state and whether the live ladder was exhausted on this device.
 * - `wallDisplayMode`: the effective live / stills choice of a wall display (the installation dial; a wall browser may pin its
 *   own value - S0 notes P7).
 */
export type Rung = 'realistic' | 'lite' | 'full' | 'schematic' | 'stills' | '2d';
export const LADDER: readonly Rung[] = ['realistic', 'lite', 'full', 'schematic', 'stills', '2d'];
/** The live rungs of SceneView: 3 = realistic / lite (level 3, S1), 2 = full, 1 = schematic. */
export const RUNG_LEVEL: Partial<Record<Rung, number>> = { realistic: 3, lite: 3, full: 2, schematic: 1 };

/** The rung below `current` after a failed probe; `hasStills` = the level has a current still set; a walk stops at schematic. */
export function ladderNext(current: Rung, hasStills: boolean, walking = false): Rung {
  const i = LADDER.indexOf(current);
  for (let j = i + 1; j < LADDER.length; j++) {
    const r = LADDER[j];
    if (r === 'stills' && (!hasStills || walking)) continue;
    if (r === '2d' && walking) return current; // the walk keeps its last live rung; it never leaves to a picture
    return r;
  }
  return current;
}

export interface ViewInputs {
  /** The 3D view could start (WebGL); false = no context at all. */
  webgl: boolean;
  /** The host shows the plan on a wall display (kiosk). */
  wallDisplay: boolean;
  /** The effective wall-display dial (wallDisplayMode). */
  wallMode: 'live' | 'stills';
  /** A kiosk idle swap is due (kiosk_idle_s elapsed with no change; S5 owns the timer). */
  idle: boolean;
  /** The live ladder failed on this device (the 3D element's `stills-fallback` event). */
  exhausted: boolean;
  /** The level has a current still set (the bundle's bakes part). */
  hasStills: boolean;
  /** The person asked for 3D (the host's own 2D / 3D toggle). */
  want3d: boolean;
}
export type ViewMode = 'live' | 'stills' | '2d';

/** What to draw: the person's 2D stays 2D; a wall display set to stills shows stills; otherwise live 3D while it works, the
 * stills when WebGL is missing, the ladder is exhausted or the kiosk is idle - and 2D when no current still exists. */
export function viewMode(i: ViewInputs): ViewMode {
  if (!i.want3d) return '2d';
  const stillsWanted = (i.wallDisplay && (i.wallMode === 'stills' || i.idle)) || !i.webgl || i.exhausted;
  if (stillsWanted) return i.hasStills ? 'stills' : i.webgl && !i.exhausted ? 'live' : '2d';
  return 'live';
}

export const WALL_DISPLAY_KEY = 'sw.plan3d.wall_display';
export const WALL_FLAG_KEY = 'sw.plan3d.wall';

function readLocal(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** The wall display's live / stills choice: this browser's pinned value (`sw.plan3d.wall_display`), else the installation's. */
export function wallDisplayMode(installation: 'live' | 'stills'): 'live' | 'stills' {
  const own = readLocal(WALL_DISPLAY_KEY);
  return own === 'live' || own === 'stills' ? own : installation;
}

/** Whether this browser is a wall display: `?display=wall` in the route (remembered in this browser), or the remembered flag. */
export function isWallDisplay(search: string): boolean {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const v = q.get('display');
  if (v === 'wall' || v === 'desk') {
    try {
      if (v === 'wall') globalThis.localStorage?.setItem(WALL_FLAG_KEY, '1');
      else globalThis.localStorage?.removeItem(WALL_FLAG_KEY);
    } catch {
      /* storage blocked: the route still says it */
    }
    return v === 'wall';
  }
  return readLocal(WALL_FLAG_KEY) === '1';
}
