/**
 * Plan Studio 6 (CR-029 section 3.4, LOOK_SPEC section 4 / 10): the quality ladder of the 3D view as pure rules.
 *
 * Rungs, top to bottom: realistic (level 3: textures, IBL, sun shadow 2048, GTAO + bloom, physical glass) -> realistic
 * lite (level 3 without GTAO / transmission, DPR 1, shadow 1024) -> full (level 2) -> schematic (level 1) -> stills (S3,
 * when the floor has a bake) -> 2D (the host). The view itself draws the first four.
 *
 * The owner's rule (2026-10-10, a live bug report: "מלא" dropped to schematic after ~30 s): a mode the person CHOSE sticks -
 * the frame-budget probe never changes it, it may only offer a one-tap "switch to simpler" hint. The automatic fallback
 * runs only in the `auto` mode. The mode comes from the browser's own choice, else the person's / installation's
 * `plan.view.quality` dial (auto or a fixed rung).
 */
export type Rung = 'realistic' | 'lite' | 'full' | 'schematic';
export type QualityMode = 'auto' | Rung;
export type ViewLevel = 1 | 2 | 3;

export const RUNGS: readonly Rung[] = ['realistic', 'lite', 'full', 'schematic'];
export const MODES: readonly QualityMode[] = ['auto', ...RUNGS];
export const RUNG_HE: Record<QualityMode, string> = { auto: 'אוטומטי', realistic: 'ריאליסטי', lite: 'ריאליסטי קל', full: 'מלא', schematic: 'סכמטי' };

export const rungLevel = (r: Rung): ViewLevel => (r === 'schematic' ? 1 : r === 'full' ? 2 : 3);
export const levelRung = (l: number): Rung => (l >= 3 ? 'realistic' : l === 2 ? 'full' : 'schematic');
/** The next rung down (null: below schematic the host's stills / 2D take over). */
export const nextDown = (r: Rung): Rung | null => RUNGS[RUNGS.indexOf(r) + 1] ?? null;
/** Under this rate during the probe window a rung is too heavy (CR-029 section 3.4); the walk has its own floor. */
export const MIN_FPS = 30;
export const WALK_MIN_FPS = 24;

/** A stored value as a mode: the new names, or the legacy level digits of `sw.plan3d.quality` ('1' / '2'). */
export function asMode(v: unknown): QualityMode | null {
  if (v === 1 || v === '1') return 'schematic';
  if (v === 2 || v === '2') return 'full';
  if (v === 3 || v === '3') return 'realistic';
  return typeof v === 'string' && (MODES as readonly string[]).includes(v) ? (v as QualityMode) : null;
}

/** The mode in force: the browser's own choice, else the dial (auto or a rung). */
export function effectiveMode(chosen: QualityMode | null, dial: QualityMode | null | undefined): QualityMode {
  return chosen ?? dial ?? 'auto';
}

/** Where `auto` starts: realistic when the person's default view is realistic (owner Q11: a personal choice), else the
 * installation's level (plan.quality 1 / 2). */
export function autoStart(defaultView: 'schematic' | 'realistic', installLevel: ViewLevel | null): Rung {
  if (defaultView === 'realistic') return 'realistic';
  return levelRung(installLevel ?? 1);
}

/** The rung that draws: a fixed mode is itself (never lowered); `auto` is its start, or the session's fallback when the
 * probe lowered it (never above the start). */
export function drawnRung(mode: QualityMode, start: Rung, fallback: Rung | null): Rung {
  if (mode !== 'auto') return mode;
  if (fallback && RUNGS.indexOf(fallback) > RUNGS.indexOf(start)) return fallback;
  return start;
}

/** What a probe result does: in `auto` it lowers the rung one step (`fallback`); in a fixed mode it only offers the hint
 * (`hint`: the rung a tap would switch to); a rate at or above the floor does nothing. */
export function probeVerdict(mode: QualityMode, drawn: Rung, fps: number, minFps = MIN_FPS): { fallback: Rung | null; hint: Rung | null } {
  if (!(fps < minFps)) return { fallback: null, hint: null };
  const down = nextDown(drawn);
  if (!down) return { fallback: null, hint: null };
  return mode === 'auto' ? { fallback: down, hint: null } : { fallback: null, hint: down };
}

/** The probe runs on every rung above schematic (level 1 is the floor; there is nothing to fall to inside the view). */
export const probes = (r: Rung): boolean => r !== 'schematic';

/** The dial `plan.view.dpr_cap` as shipped (api/plan-view.ts DEFAULT_VIEW; unit-plan-3d-pixel-ratio.spec.ts holds the two together):
 * the cap of a view that was never told one. */
export const DEFAULT_DPR_CAP = 1.25;

/**
 * The device pixel ratio each rung draws at (CR-029 section 3.5, LOOK_SPEC section 10) - one rule for every moment it can change:
 * the first build of a view, a rung or level change, a change of the dial. Schematic and full draw at the device's own ratio
 * (`base`, already limited to 2 by the view): their pictures are the committed baselines and do not move with the dial. The lite
 * rung is pinned at 1 (the phone / integrated-GPU rung). The realistic rung draws at the person's `dpr_cap` and never above the
 * device's own ratio. A cap that is not a positive finite number is the dial's default; a device ratio that is not, 1.
 */
export function pixelRatioFor(rung: Rung, base: number, cap: number): number {
  const device = Number.isFinite(base) && base > 0 ? base : 1;
  if (rung === 'lite') return Math.min(device, 1);
  if (rung === 'realistic') return Math.min(device, Number.isFinite(cap) && cap > 0 ? cap : DEFAULT_DPR_CAP);
  return device;
}

// ---- CR-029 S3 (stills): the ladder below the live view, the host's view mode and the wall display's choice
/*
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
/** The whole ladder of the S3 notes: the live rungs above, then the stills (only with a current bake of the level), then 2D. */
export type StillRung = Rung | 'stills' | '2d';
export const LADDER: readonly StillRung[] = ['realistic', 'lite', 'full', 'schematic', 'stills', '2d'];
/** The live rungs of SceneView: 3 = realistic / lite (level 3, S1), 2 = full, 1 = schematic. */
export const RUNG_LEVEL: Partial<Record<StillRung, number>> = { realistic: 3, lite: 3, full: 2, schematic: 1 };

/** The rung below `current` after a failed probe; `hasStills` = the level has a current still set; a walk stops at schematic. */
export function ladderNext(current: StillRung, hasStills: boolean, walking = false): StillRung {
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
