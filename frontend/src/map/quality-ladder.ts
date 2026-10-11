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
