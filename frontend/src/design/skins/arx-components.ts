/**
 * SKINCOMP-297 (owner 2026-10-27): the component rules of the Arx design system that SKINFOUND-297 left out, for the two Arx skins
 * (`infra`, `soft`) only - private/design-system-2026-10-27/docs/DESIGN.md (KPI tile, rail), TOKENS.md §1.2 / §3 (rail tokens, the C
 * component rules) and round 2 (round2/r2.css §5 / §7: no icon box on the KPI tile, the lit glow). Every rule reads tokens; no other
 * skin adopts them (the skin sheet holds the active skin's rules only), so classic / domus / tesla / crystal draw what they drew.
 *
 * Not touched here, on purpose: the SmplWise mark in the rail (`.brand-tile`), the corner strip, the lead row, the phone home head and
 * the installation logo slot (`sw-brand`); the header positions and the dropdown (DD) areas.
 */

/** Both Arx skins: the KPI tile is "dot · number · word" (round 2: the coloured icon box is dropped from every tile). */
export const ARX_KPI_RULES = `
/* arx kpi 1 - the icon box becomes a 10 px dot in the tile's tone with a 14 % halo; the glyph leaves the layout (round 2, r2.css §5) */
:host(sw-kpi) .icon.icon { inline-size: 10px; block-size: 10px; border-radius: 50%; background: currentColor; box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 14%, transparent); }
:host(sw-kpi) .icon > sw-icon { visibility: hidden; position: absolute; }
/* arx kpi 2 - the tall tile: the dot sits beside the number and the word, not above them */
:host(sw-kpi:not([layout='compact'])) { flex-direction: row; align-items: center; gap: 10px; }
/* arx kpi 3 - COMPONENT_RULES.md §3 (KPI tile, cards): the word is one line with an ellipsis (the host's title carries the full text), so a
   long label never grows a three-line tile with the dot adrift beside it (break-ui); the number never truncates */
:host(sw-kpi:not([layout='compact'])) .txt { flex: 1; }
:host(sw-kpi:not([layout='compact'])) .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
:host(sw-kpi:not([layout='compact'])) .value { white-space: nowrap; }
`;

/**
 * Both Arx skins: the rail items, the user button in the rail and the phone bar read the rail tokens (`--sw-rail-*`, tokens.ts group
 * `rail`). The fill of the rail itself is a per-skin rule (infra: the token; soft: the token under the glass sheen).
 */
export const ARX_RAIL_RULES = `
/* arx rail 1 - labels and icons in the rail's text colour; the current item takes the rail's active pill and mark */
:host(sw-app) a.item.a, :host(sw-app) a.item.a sw-icon, :host(sw-app) button.me.rail { color: var(--sw-rail-text); }
:host(sw-app) a.item.a.active, :host(sw-app) button.me.rail.active { background: var(--sw-rail-active-bg); color: var(--sw-rail-active); }
:host(sw-app) a.item.a.active sw-icon { color: var(--sw-rail-active); }
:host(sw-app) a.item.a.active::after { background: var(--sw-rail-active); }
:host(sw-app) button.me.rail.open:not(.active) { background: color-mix(in srgb, var(--sw-rail-text) 14%, transparent); color: var(--sw-rail-text); }
@media (hover: hover) and (pointer: fine) { :host(sw-app) a.item.a:not(.active):hover { background: color-mix(in srgb, var(--sw-rail-text) 12%, transparent); color: var(--sw-rail-text); } }
/* arx rail 1b - press feedback on a rail item (emil: a pressable answers the press; the press scale is 1 under reduced motion) */
:host(sw-app) a.item.a { transition: transform var(--sw-t-press) var(--sw-ease), background-color var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color); }
:host(sw-app) a.item.a:active { transform: scale(var(--sw-press-scale)); }
/* arx rail 2 - the phone bar shares the rail's colours */
:host(sw-app) nav.bottom a, :host(sw-app) nav.bottom button { color: var(--sw-rail-text); }
:host(sw-app) nav.bottom a.active, :host(sw-app) nav.bottom button.active { color: var(--sw-rail-active); }
`;

/** Arx Infra: the rail and the phone bar paint the rail tokens (the optional dark rail rewrites the tokens, never the rules). */
export const INFRA_RAIL_FILL_RULES = `
/* infra rail - the fill and the hairline of the rail and the phone bar */
:host(sw-app) nav.rail.rail { background: var(--sw-rail-bg); border-inline-end-color: var(--sw-rail-border); }
:host(sw-app) nav.bottom.bottom { background: var(--sw-rail-bg); border-block-start-color: var(--sw-rail-border); }
`;

/** Arx Soft only (TOKENS.md §3 "Component rules"): pill buttons, the 51 x 31 switch, the lit glow. */
export const SOFT_COMPONENT_RULES = `
/* soft 6 - pill buttons, every size (the [size] form outranks the component's own size rules) */
:host(sw-button) button, :host(sw-button[size]) button, :host(sw-button[round]) button { border-radius: var(--sw-r-pill); }
/* soft 7 - the switch is 51 x 31 with a 27 px knob on the thumb shadow (iOS proportions); the knob travels 20 px */
:host(sw-toggle) button { inline-size: 51px; block-size: 31px; }
:host(sw-toggle) button::after { inset-block-start: 2px; inset-inline-start: 2px; inline-size: 27px; block-size: 27px; box-shadow: var(--sw-shadow-thumb); }
:host(sw-toggle[checked]) button::after { transform: translateX(-20px); }
:host(sw-toggle[checked][dir='ltr']) button::after { transform: translateX(20px); }
/* soft 8 - a lit light glows warm: the tile is tinted by the lamp colour and carries a 24 px warm glow (the glass device style keeps its own) */
:host(devices-area:not([data-devices-style='glass'])) sw-card[data-card='lighting'] .tile.on { background: color-mix(in srgb, var(--sw-lit) 16%, var(--sw-surface-solid)); border-color: color-mix(in srgb, var(--sw-lit) 40%, transparent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--sw-lit) 40%, transparent), 0 8px 24px color-mix(in srgb, var(--sw-lit) 28%, transparent); }
/* soft 8b - the glow fades in with the fill (emil: properties of one state change move together; the base fades only fill and border) */
:host(devices-area:not([data-devices-style='glass'])) sw-card[data-card='lighting'] .tile { transition: background-color var(--sw-t-state) var(--sw-ease), border-color var(--sw-t-state) var(--sw-ease), box-shadow var(--sw-t-state) var(--sw-ease), color var(--sw-t-state) var(--sw-ease), opacity var(--sw-t-state) var(--sw-ease); }
@media (prefers-contrast: more) { :host(devices-area:not([data-devices-style='glass'])) sw-card[data-card='lighting'] .tile.on { box-shadow: none; border-color: var(--sw-border-strong); } }
`;
