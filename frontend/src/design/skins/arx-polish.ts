/**
 * POLISH-SKINS-297 (owner round 4, 2026-10-27: polish, the structure frozen): the state rules both Arx skins (`infra`, `soft`) append to
 * their component rules - 12 blocks of their 50. Colour, depth and type only: nothing moves, nothing is added or hidden.
 *
 *  - A device that is ON no longer borrows the WARNING colour (audit: "status colour as decoration"): a lamp takes the lit tint, any
 *    other device the accent tint; the warning / danger / live colours stay for what they mean.
 *  - A lit lamp carries `--sw-lit-glow` (`none` unless the skin or its "glow" option sets it - Arx Soft).
 *  - Status chips: the pale tint with a hairline of their own hue (taste-skill app-screens §7.6), semibold, never squeezed.
 *  - KPI tiles: the icon box is neutral unless the tile's tone carries meaning (taste-skill: no icon in a tinted square as decoration).
 *  - Tables: quiet 12 px headers, tabular figures, the row hover only where a pointer hovers (mobile-native: no sticky hover).
 */
export const ARX_STATE_RULES = `
/* arx state 1 - a device that is on: a lamp takes the lit tint (and the skin's glow), anything else the accent tint; never the warning colour */
:host(devices-area) sw-card[data-card='lighting'] :is(.tile, .row).on { background: color-mix(in srgb, var(--sw-lit) 14%, var(--sw-surface-solid)); border-color: color-mix(in srgb, var(--sw-lit) 48%, transparent); box-shadow: var(--sw-lit-glow); }
:host(devices-area) sw-card[data-card='lighting'] .tile.on .t sw-icon { color: color-mix(in srgb, var(--sw-lit) 55%, var(--sw-text)); }
:host(devices-area) sw-card:not([data-card='lighting']) :is(.tile, .row).on { background: color-mix(in srgb, var(--sw-accent) 8%, var(--sw-surface-solid)); border-color: color-mix(in srgb, var(--sw-accent) 34%, transparent); }
:host(devices-area) sw-card:not([data-card='lighting']) .tile.on .t sw-icon { color: var(--sw-accent-text); }
/* arx state 1b - the glow arrives with the warm fill (animate: state indication, a CSS transition on the state curve; nothing moves) */
@media (prefers-reduced-motion: no-preference) { :host(devices-area) sw-card[data-card='lighting'] :is(.tile, .row) { transition: background-color var(--sw-t-state) var(--sw-ease), border-color var(--sw-t-state) var(--sw-ease), color var(--sw-t-state) var(--sw-ease), opacity var(--sw-t-state) var(--sw-ease), box-shadow var(--sw-t-state) var(--sw-ease); } }
/* arx state 2 - the home's lamp button and a lit lamp pill carry the glow */
:host(devices-building) .qb[aria-pressed='true'].l { box-shadow: var(--sw-lit-glow); }
:host(sw-pill[on][fill-color='var(--sw-lit)']) { box-shadow: var(--sw-lit-glow); }
/* arx state 3 - status chips: a hairline of their own hue on the pale tint (the dashed stale / unknown keep their dashes), never squeezed */
:host(sw-badge:not([onimage]):not([kind='stale']):not([kind='partial']):not([kind='unknown'])) { box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 22%, transparent); }
:host(sw-badge) { font-weight: var(--sw-fw-semibold); flex: none; }
/* arx state 4 - a KPI's icon box is neutral unless the tile's tone carries meaning */
:host(sw-kpi:not([tone='error']):not([tone='offline']):not([tone='stale']):not([tone='partial']):not([tone='live'])) .icon { background: var(--sw-surface-3); color: var(--sw-text-2); }
/* arx state 5 - tables: quiet headers, tabular figures, the hover only where a pointer hovers */
:host(sw-table) th { font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); color: var(--sw-text-3); }
:host(sw-table) td { font-variant-numeric: tabular-nums; }
@media (hover: hover) and (pointer: fine) { :host(sw-table) tbody tr:hover { background: var(--sw-surface-2); } }
`;
