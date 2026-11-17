import { unsafeCSS, type CSSResult } from 'lit';

/**
 * CR-ICONS-PALETTE-2440 (review finding 08:F12, step 1): the fixed status colours, written once.
 *
 * Three home widgets declared the same four hex values as private custom properties (`--sw-gw-*`, `--sw-dw-*`, `--tc-*-solid`), each
 * typing the literal again. They are FIXED colours on purpose today: they do not follow the theme tokens (`--sw-danger`,
 * `--sw-warning`, `--sw-success`), so they do not change with the chosen palette. This module only removes the repetition - the same
 * hex values, so no pixel moves. Mapping them onto the theme tokens is a visible change and the owner's decision (O19); it is NOT
 * done here.
 *
 * `STATUS_HEX` is the value as text (an SVG attribute, a canvas); `statusCss` is the same value for a `css` template:
 *
 *     :host { --sw-dw-err: ${statusCss.fault}; }
 */
export const STATUS_HEX = {
  /** all is well */
  ok: '#15803d',
  /** needs attention */
  warn: '#c2410c',
  /** a fault / an alarm */
  fault: '#c81e1e',
  /** unknown / switched off */
  unknown: '#667085',
} as const;

type StatusTone = keyof typeof STATUS_HEX;

const asCss = <K extends string>(hex: Record<K, string>): Record<K, CSSResult> =>
  Object.fromEntries(Object.entries<string>(hex).map(([k, v]) => [k, unsafeCSS(v)])) as Record<K, CSSResult>;

/** The same values for a `css` template (constants of this file, hence `unsafeCSS`). */
export const statusCss: Record<StatusTone, CSSResult> = asCss(STATUS_HEX);

/**
 * The dots of the tickets' "pick on the plan" stage (tickets/map-element.ts). The plan is drawn for a white ground in both schemes
 * (TKMAP1), so these are fixed too; they were literals inside the SVG markup.
 */
export const MAP_PICK_HEX = {
  camera: '#2f6bff',
  entity: '#16a34a',
  other: '#7b8794',
  chosen: '#e0443c',
  ring: '#fff',
} as const;
