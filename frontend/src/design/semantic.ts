/**
 * DESIGNTOKENS-297 (version 2.25.0 foundations): the SEMANTIC CONTRACT of the design-variables layer.
 *
 * tokens.ts declares every `--sw-*` variable once (`{ light, dark }`) and each skin (skins/*.ts) overrides names of it. This file does
 * NOT add variables and does not change a value: it names the roles the existing variables play - surface levels, text levels, the
 * border, the accent, the status colours, and the radius / elevation / spacing / type / motion scales - so that
 *   - every skin is checked against the same contract (validateSkinTable below; tests/unit-designtokens-297.spec.ts runs it for every
 *     registered skin in both schemes),
 *   - a new skin written as data (skins/define.ts defineSkin) is checked before it can be registered, and
 *   - the reduced-motion block of css.ts is generated from the motion roles instead of two hand-kept lists.
 * Design rule (impeccable "extract": no token for every value, reuse the names the screens already read): a role points at an
 * existing name; it never introduces a parallel `--sw-sem-*` alias that the screens would then have to learn.
 */
import type { TokenTable } from './tokens';

/** Ordered from the page up: the canvas, then the three panel levels (a card, a nested block, a well / pressed area). */
export const SURFACE_LEVELS = ['--sw-bg', '--sw-surface', '--sw-surface-2', '--sw-surface-3'] as const;
/** The opaque twin of each panel level (floating layers and the no-transparency fallback). */
export const SURFACE_SOLID = { '--sw-surface': '--sw-surface-solid', '--sw-surface-2': '--sw-surface-2-solid', '--sw-surface-3': '--sw-surface-3-solid' } as const;
/** Ordered from the strongest ink down: heading, body, secondary, muted. Plus the ink on an accent fill. */
export const TEXT_LEVELS = ['--sw-heading', '--sw-text', '--sw-text-2', '--sw-text-3'] as const;
export const TEXT_INVERSE = '--sw-text-inverse';
/** The hairline and the stronger divider / control outline; the menu hairline is its own (always opaque) pair. */
export const BORDER_LEVELS = ['--sw-border', '--sw-border-strong'] as const;
/** The ONE interaction colour of a skin and its companions. Never a status colour (see STATUS below). */
export const ACCENT_ROLES = ['--sw-accent', '--sw-accent-hover', '--sw-accent-soft', '--sw-accent-text', '--sw-focus', '--sw-nav'] as const;

/**
 * The status colours. Each status has the bare colour (dot, bar, icon), a `-soft` fill and a `-text` ink on that fill. They are reserved
 * for status: a status is always shape + word, never colour alone (ui-ux-pro-max ux "Color Only"), and the accent of a skin never takes
 * a status value (validateSkinTable: rule `accent-is-status`), so "blue = can press, red = alarm" never blurs.
 */
export const STATUS_NAMES = ['live', 'recorded', 'offline', 'stale', 'unknown', 'danger', 'warning', 'success', 'forbidden'] as const;
export type StatusName = (typeof STATUS_NAMES)[number];
export const statusTokens = (s: StatusName) => ({ base: `--sw-${s}`, soft: `--sw-${s}-soft`, text: `--sw-${s}-text` });
/** The statuses whose colour must never double as the accent (alarm / ok / attention): the hues a person reads as meaning. */
export const ALARM_STATUSES: readonly StatusName[] = ['danger', 'warning', 'success', 'live', 'stale', 'forbidden'];

/** Radius scale, small to large (pill is the "fully round" end, outside the ordering). */
export const RADIUS_SCALE = ['--sw-r-2xs', '--sw-r-xs', '--sw-r-sm', '--sw-r-md', '--sw-r-lg', '--sw-r-xl', '--sw-r-2xl'] as const;
export const RADIUS_PILL = '--sw-r-pill';
/** Elevation scale: level 0 is "no shadow" (a flat surface); 1 resting card, 2 hover / raised, 3 floating (dialog, popover, toast). */
export const ELEVATION_SCALE = ['--sw-shadow-1', '--sw-shadow-2', '--sw-shadow-3'] as const;
/** Spacing scale (the 4 px grid; the half steps of the pill family are density helpers, not part of the ordered scale). */
export const SPACING_SCALE = ['--sw-s-1', '--sw-s-2', '--sw-s-3', '--sw-s-4', '--sw-s-5', '--sw-s-6', '--sw-s-8', '--sw-s-10'] as const;
/** Type scale, small to large. A screen never writes a px font size of its own. */
export const TYPE_SCALE = ['--sw-fs-2xs', '--sw-fs-xs', '--sw-fs-sm', '--sw-fs-base', '--sw-fs-md', '--sw-fs-lg', '--sw-fs-xl', '--sw-fs-2xl', '--sw-fs-3xl', '--sw-fs-4xl'] as const;
export const TYPE_WEIGHTS = ['--sw-fw-regular', '--sw-fw-medium', '--sw-fw-semibold', '--sw-fw-bold'] as const;

/**
 * Motion. Three kinds of name, because reduced motion treats them differently (apple-design §14 / emil-design-eng "Accessibility":
 * reduced motion keeps colour and opacity feedback and drops travel, springs and scale):
 *   - durations: become 0ms;
 *   - travel: distances become 0px;
 *   - scale: the press scale becomes 1.
 * The ORDER of the lists is the order of the declarations in the generated reduced-motion block (css.ts) and is kept equal to the
 * block that was written by hand before (DESIGNTOKENS-297 changed no byte of the generated CSS).
 */
export const MOTION_DURATIONS_CORE = ['--sw-t-fast', '--sw-t-med', '--sw-t-sheet', '--sw-t-state'] as const;
export const MOTION_TRAVEL_CORE = ['--sw-hover-lift'] as const;
/** The Arx motion layer (SKINFOUND-297, tokens.ts motion group). */
export const MOTION_DURATIONS_ARX = [
  '--sw-t-press',
  '--sw-t-hover',
  '--sw-t-slow',
  '--sw-t-exit',
  '--sw-t-toast',
  '--sw-spring-toggle-ms',
  '--sw-spring-tab-ms',
  '--sw-spring-dialog-ms',
  '--sw-spring-drawer-ms',
  '--sw-spring-kpi-ms',
  '--sw-stagger',
] as const;
export const MOTION_TRAVEL_ARX = ['--sw-enter-y'] as const;
export const MOTION_DURATIONS_ARX_TAIL = ['--sw-enter-ms'] as const;
export const MOTION_SCALE = ['--sw-press-scale'] as const;
export const MOTION_DURATIONS = [...MOTION_DURATIONS_CORE, ...MOTION_DURATIONS_ARX, ...MOTION_DURATIONS_ARX_TAIL] as const;
export const MOTION_TRAVEL = [...MOTION_TRAVEL_CORE, ...MOTION_TRAVEL_ARX] as const;
export const MOTION_EASINGS = ['--sw-ease', '--sw-ease-thumb', '--sw-ease-dialog', '--sw-ease-out', '--sw-ease-in-out', '--sw-ease-drawer', '--sw-ease-color'] as const;

const reduce = (names: readonly string[], value: string) => names.map((n) => `${n}:${value} !important;`).join('');
/** The reduced-motion declarations of the core names (durations 0, no hover lift). */
export const reducedMotionCore = (): string => reduce(MOTION_DURATIONS_CORE, '0ms') + reduce(MOTION_TRAVEL_CORE, '0px');
/** The reduced-motion declarations of the Arx motion layer (durations 0, no rise, no press scale). */
export const reducedMotionArx = (): string =>
  reduce(MOTION_DURATIONS_ARX, '0ms') + reduce(MOTION_TRAVEL_ARX, '0px') + reduce(MOTION_DURATIONS_ARX_TAIL, '0ms') + reduce(MOTION_SCALE, '1');

/** Every role name, flat (the contract a skin table must satisfy: all of these exist). */
export const SEMANTIC_NAMES: readonly string[] = [
  ...SURFACE_LEVELS,
  ...Object.values(SURFACE_SOLID),
  ...TEXT_LEVELS,
  TEXT_INVERSE,
  ...BORDER_LEVELS,
  '--sw-menu-surface',
  '--sw-menu-border',
  ...ACCENT_ROLES,
  ...STATUS_NAMES.flatMap((s) => Object.values(statusTokens(s))),
  ...RADIUS_SCALE,
  RADIUS_PILL,
  ...ELEVATION_SCALE,
  ...SPACING_SCALE,
  ...TYPE_SCALE,
  ...TYPE_WEIGHTS,
  ...MOTION_DURATIONS,
  ...MOTION_TRAVEL,
  ...MOTION_SCALE,
  ...MOTION_EASINGS,
];

export interface ContractProblem {
  rule: 'missing' | 'both-columns' | 'scale-order' | 'accent-is-status' | 'motion-unit' | 'exit-slower-than-enter' | 'menu-translucent';
  scheme?: 'light' | 'dark';
  detail: string;
}

/** A plain px / ms number of a value, or null when the value is not a bare `<n>px` / `<n>ms` (a var(), a calc(), a keyword). */
const num = (v: string, unit: 'px' | 'ms'): number | null => {
  const m = new RegExp(`^\\s*(-?\\d+(?:\\.\\d+)?)${unit}\\s*$`).exec(v);
  return m ? Number(m[1]) : null;
};
const norm = (v: string) => v.replace(/\s+/g, '').toLowerCase();

/**
 * Check a MERGED table (base + a skin's overrides, css.ts skinTable) against the contract. Returns the problems (empty = conforms).
 * Ordering rules compare only values that are plain px / ms numbers, so a skin that writes calc() or var() is not flagged for it.
 */
export function validateSkinTable(t: TokenTable): ContractProblem[] {
  const out: ContractProblem[] = [];
  for (const n of SEMANTIC_NAMES) {
    if (!t[n]) out.push({ rule: 'missing', detail: n });
    else if (!t[n].light.trim() || !t[n].dark.trim()) out.push({ rule: 'both-columns', detail: n });
  }
  if (out.length) return out;
  for (const scheme of ['light', 'dark'] as const) {
    const v = (n: string) => t[n][scheme];
    // scales never step backwards (a "larger" step smaller than the one before reads as a mistake on every screen)
    for (const [label, scale] of [
      ['radius', RADIUS_SCALE],
      ['spacing', SPACING_SCALE],
      ['type', TYPE_SCALE],
    ] as const) {
      let prev: number | null = null;
      let prevName = '';
      for (const n of scale) {
        const x = num(v(n), 'px');
        if (x === null) continue;
        if (prev !== null && x < prev) out.push({ rule: 'scale-order', scheme, detail: `${label}: ${n} (${x}px) < ${prevName} (${prev}px)` });
        prev = x;
        prevName = n;
      }
    }
    // status colours are kept for status: the interaction colours never take an alarm / ok / attention value
    const statusValues = new Map(ALARM_STATUSES.map((s) => [norm(v(statusTokens(s).base)), s]));
    for (const n of ['--sw-accent', '--sw-accent-hover', '--sw-nav', '--sw-focus']) {
      const hit = statusValues.get(norm(v(n)));
      if (hit) out.push({ rule: 'accent-is-status', scheme, detail: `${n} = --sw-${hit} (${v(n)})` });
    }
    // every duration is a time, every travel a length
    for (const n of MOTION_DURATIONS) if (num(v(n), 'ms') === null) out.push({ rule: 'motion-unit', scheme, detail: `${n}: ${v(n)} is not <n>ms` });
    for (const n of MOTION_TRAVEL) if (num(v(n), 'px') === null) out.push({ rule: 'motion-unit', scheme, detail: `${n}: ${v(n)} is not <n>px` });
    // closing is never slower than opening (emil-design-eng: "exit faster than enter"; ui-ux-pro-max exit-faster-than-enter)
    const exit = num(v('--sw-t-exit'), 'ms');
    const sheet = num(v('--sw-t-sheet'), 'ms');
    if (exit !== null && sheet !== null && exit > sheet) out.push({ rule: 'exit-slower-than-enter', scheme, detail: `--sw-t-exit ${exit}ms > --sw-t-sheet ${sheet}ms` });
    // a menu is never see-through (owner 2026-10-13, SKIN_AUTHORING_HE.md §4)
    for (const n of ['--sw-menu-surface', '--sw-menu-border']) if (/rgba|hsla|transparent|color-mix/i.test(v(n))) out.push({ rule: 'menu-translucent', scheme, detail: `${n}: ${v(n)}` });
  }
  return out;
}
