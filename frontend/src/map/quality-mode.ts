/**
 * The 3D view mode and its frame-rate decision (owner bug 2026-10-10: a chosen "מלא" jumped back to "סכמטי" by itself).
 * Pure: no Lit, no three, no DOM - a node spec pins every rule.
 *
 * Three modes (the names follow the realistic-3D port's `plan.view.quality` rungs: auto / full / schematic):
 * - `auto`      - the full level, dropping to the schematic one after a SUSTAINED low frame rate (the old behaviour);
 * - `full`      - the full level, kept even when the device is slow: a non-blocking hint offers the switch, never forces it;
 * - `schematic` - the schematic level.
 * The mode that applies: the user's own choice (the toolbar or the settings row, /me/prefs `plan.quality`, cached in this
 * browser) <- the installation's default (`plan.quality`, system.configure) <- `auto`.
 * The wire value of both layers is the settings' string: "auto" | "2" | "1".
 */
import type { QualityLevel } from './scene-three';
import type { QualityMode as LadderMode } from './quality-ladder';

export type QualityMode = 'auto' | 'full' | 'schematic';
export type QualityWire = 'auto' | '1' | '2';
/** The order the settings and the toolbar list them in. */
export const QUALITY_MODES: readonly QualityMode[] = ['auto', 'full', 'schematic'];
/** The short label of a mode (toolbar chip, settings option). */
export const QUALITY_MODE_LABEL: Record<QualityMode, string> = { auto: 'אוטומטי', full: 'מלא', schematic: 'סכמטי' };
/** One line per mode for the settings rows and the chips' titles. */
export const QUALITY_MODE_HINT: Record<QualityMode, string> = {
  auto: 'מלא, ויורד לסכמטי כשקצב הפריימים נמוך לאורך זמן',
  full: 'צללים, חומרים וחיתוך קירות - נשאר גם במכשיר איטי',
  schematic: 'חומרים שטוחים, בלי צללים - הקל ביותר',
};

/** "auto" | "2" | "1" (also the numbers and the mode names themselves); anything else is null = not set. */
export function modeFromWire(v: unknown): QualityMode | null {
  if (v === 'auto') return 'auto';
  if (v === '2' || v === 2 || v === 'full') return 'full';
  if (v === '1' || v === 1 || v === 'schematic') return 'schematic';
  return null;
}

export function modeToWire(m: QualityMode): QualityWire {
  return m === 'full' ? '2' : m === 'schematic' ? '1' : 'auto';
}

/**
 * The personal mode (/me/prefs `plan.quality` and this browser's cache) also names the realistic rungs of Plan Studio 6
 * (map/quality-ladder.ts): the installation's wire ("auto" | "2" | "1") plus "realistic" and "lite". The installation's
 * default (`plan.quality` setting) keeps the three values above (integration 2.4.7: the sticky choice of the hotfix kept
 * for every rung of the ladder).
 */
export type OwnWire = QualityWire | 'realistic' | 'lite';
/** The order the personal settings row lists them in. */
export const OWN_MODES: readonly LadderMode[] = ['auto', 'full', 'schematic', 'lite', 'realistic'];

/** A personal wire value as a ladder mode ("3" reads as realistic); anything else is null = not set. */
export function ownModeFromWire(v: unknown): LadderMode | null {
  const m = modeFromWire(v);
  if (m) return m;
  if (v === 'realistic' || v === '3' || v === 3) return 'realistic';
  if (v === 'lite') return 'lite';
  return null;
}

export function ownModeToWire(m: LadderMode): OwnWire {
  return m === 'realistic' || m === 'lite' ? m : modeToWire(m);
}

/** The user's own choice, else the installation's default, else auto. */
export function resolveMode(own: QualityMode | null | undefined, installation: QualityMode | null | undefined): QualityMode {
  return own ?? installation ?? 'auto';
}

/** The level that draws: only `auto` honours a fallback; a manual mode is never downgraded. */
export function levelFor(mode: QualityMode, fellBack: boolean): QualityLevel {
  if (mode === 'schematic') return 1;
  if (mode === 'full') return 2;
  return fellBack ? 1 : 2;
}

/** What a sustained low frame rate does in a mode: `auto` drops to schematic, `full` only shows the hint. */
export function lowFpsAction(mode: QualityMode): 'downgrade' | 'hint' | 'none' {
  return mode === 'auto' ? 'downgrade' : mode === 'full' ? 'hint' : 'none';
}

/** The upper edge of the hysteresis band: a rate at or above it clears a low streak; between `low` and it the streak holds. */
export const recoverFps = (low: number): number => Math.ceil(low * 1.2);

/**
 * The sustained-low detector with hysteresis. Feed it measured intervals (`fps` over [start, end] in ms):
 * - under `low`: a low streak starts at the interval's start (or continues);
 * - at or above `high`: the streak is cleared (a good second proves the device can draw it);
 * - in between: nothing changes (no start, no clear) - a borderline device neither drops nor recovers on noise.
 * `sample` answers true once a streak has lasted `sustainMs` (its end minus its start), so one slow interval - a
 * shader compile, a tab switch - is never a verdict.
 */
export class FpsWatch {
  private streakFrom: number | null = null;

  constructor(readonly low: number, readonly high: number, readonly sustainMs: number) {}

  sample(fps: number, start: number, end: number): boolean {
    if (fps < this.low) {
      if (this.streakFrom === null) this.streakFrom = start;
    } else if (fps >= this.high) {
      this.streakFrom = null;
    }
    return this.streakFrom !== null && end - this.streakFrom >= this.sustainMs;
  }

  reset(): void {
    this.streakFrom = null;
  }

  get inStreak(): boolean {
    return this.streakFrom !== null;
  }
}
