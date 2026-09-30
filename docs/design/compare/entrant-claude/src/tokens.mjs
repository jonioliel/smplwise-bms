// Token access for the generator: reads the current skin (src/skin.mjs). Names follow TOKEN_CONTRACT.md §1;
// new product-wide names join --sw-. The mapping onto the old --sw-*/--dv-* names is in TOKEN_MAP.md.
// Values: px for sizes, rgba() for alphas, RGB triplets where the code composes the alpha.
import { current, currentAll } from './skin.mjs';

export const getGroups = () => current().groups;
export const getAll = () => currentAll();

export function cssBlock(scheme) {
  return Object.entries(getAll()).map(([k, v]) => `  ${k}: ${v[scheme]};`).join('\n');
}

export function tokensJson() {
  return JSON.stringify(Object.fromEntries(Object.entries(getAll()).map(([k, v]) => [k, { light: v.light, dark: v.dark }])), null, 2);
}

// new name -> old names (both families). Engineering aliases the old names onto these. Shared by every skin.
export const tokenMap = [
  ['--sw-bg', '--sw-bg · --dv-backdrop (base colour)'], ['--sw-canvas', '--dv-backdrop (gradient layer) · new'],
  ['--sw-surface', '--sw-surface · --dv-surface'], ['--sw-surface-solid', '--dv-surface-solid · new for --sw-'],
  ['--sw-surface-2', '--sw-surface-2 · --dv-surface-2'], ['--sw-surface-2-solid', '--dv-surface-2-solid'],
  ['--sw-surface-3', '--sw-surface-3 · --dv-surface-3 · --dv-neutral-soft · --dv-icon-ring-bg'], ['--sw-surface-3-solid', 'new'],
  ['--sw-border', '--sw-border · --dv-border'], ['--sw-border-strong', '--sw-border-strong · --dv-border-strong'],
  ['--sw-highlight', 'new (glass top hairline; the inset line inside --dv-shadow-1/2; transparent in the iOS and Tesla skins)'], ['--sw-overlay', '--sw-overlay · --dv-overlay'],
  ['--sw-video-bg', '--sw-video-bg'],
  ['--sw-text', '--sw-text · --dv-text · --dv-icon-ring-fg'], ['--sw-heading', '--sw-heading'], ['--sw-text-2', '--sw-text-2 · --dv-text-2'], ['--sw-text-3', '--sw-text-3 · --dv-text-3'], ['--sw-text-inverse', '--sw-text-inverse'],
  ['--sw-accent', '--sw-accent · --dv-accent'], ['--sw-accent-hover', '--sw-accent-hover · --dv-accent-hover'], ['--sw-accent-soft', '--sw-accent-soft · --dv-accent-soft'],
  ['--sw-accent-text', '--sw-accent-text · --dv-accent-text'], ['--sw-nav', '--sw-nav'], ['--sw-focus', '--sw-focus · --dv-focus'], ['--sw-focus-w / --sw-focus-offset', 'new (one focus rule)'],
  ['--sw-live / -soft', '--sw-live · --sw-live-soft'], ['--sw-recorded / -soft', '--sw-recorded · --sw-recorded-soft'], ['--sw-offline / -soft', '--sw-offline · --sw-offline-soft · --dv-offline'],
  ['--sw-stale / -soft', '--sw-stale · --sw-stale-soft'], ['--sw-unknown / -soft', '--sw-unknown · --sw-unknown-soft'], ['--sw-danger / -soft', '--sw-danger · --sw-danger-soft · --dv-danger · --dv-danger-soft'],
  ['--sw-warning / -soft', '--sw-warning · --sw-warning-soft · --dv-warning · --dv-warning-soft'], ['--sw-success / -soft', '--sw-success · --sw-success-soft · --dv-success · --dv-success-soft'],
  ['--sw-forbidden / -soft', '--sw-forbidden · --sw-forbidden-soft'], ['--sw-purple', '--sw-purple'],
  ['--sw-<state>-text (×10)', 'new: the text colour of a state on its -soft fill (badge, chip, KPI detail); the bare state colour stays for dots, bars and icons'], ['--sw-toggle-on', '--dv-toggle-on'],
  ['--sw-on-warm / -cool / -switch', '--dv-tile-on-warm · --dv-tile-on-cool · --dv-tile-on-switch (one accent triplet for all three in the Tesla skin)'],
  ['--sw-glow-fill-start / -end / --sw-glow-border / --sw-glow-halo', '--dv-glow-fill-start · --dv-glow-fill-end · --dv-glow-border · --dv-glow-halo (iOS: flat tint, no halo; Tesla: rule only)'],
  ['--sw-role-<role> / -fg / --sw-role-fill-a / --sw-role-border-a', '--dv-role-<role>-bg · -border · -fg (bg = rgb(triplet / fill-a), border = rgb(triplet / border-a))'],
  ['--sw-map-* · --sw-obj-* · --sw-circuit-* · --sw-fov', 'same names (dark values added)'],
  ['--sw-font', '--sw-font · --dv-font (Heebo leads in every skin)'], ['--sw-font-mono', '--sw-font-mono'],
  ['--sw-fs-xs … --sw-fs-3xl', '--sw-fs-* ; --dv-fs-item-name = --sw-fs-sm, --dv-fs-tile-name = --sw-fs-md, --dv-fs-title = --sw-fs-section, --dv-fs-value-big = --sw-fs-3xl'],
  ['--sw-h1 / --sw-h1-phone / -weight / -tracking / -lh', '--sw-h1 · --sw-h1-weight · --sw-h1-tracking (phone value new)'], ['--sw-h2 / --sw-h2-tracking', 'new'],
  ['--sw-fs-section / --sw-fw-section', '--dv-fs-title · --dv-fw-title'], ['--sw-fs-reading / -phone / --sw-fw-reading / --sw-reading-tracking', 'new (clock, temperature)'],
  ['--sw-lh / --sw-lh-tight', '--sw-lh'], ['--sw-fw-*', '--sw-fw-*'], ['--sw-nums', 'new (font-variant-numeric)'],
  ['--sw-s-1 … --sw-s-10', '--sw-s-*'], ['--sw-page-pad / -tablet / -phone', '--sw-page-pad'], ['--sw-touch', '--sw-touch (36 → 44)'],
  ['--sw-control-h / -sm / -lg', 'new: visual heights of controls (targets padded to --sw-touch)'],
  ['--sw-rail-w / --sw-rail-w-wide / --sw-rail-gap', '--sw-rail-w · --sw-rail-w-wide ; --nav-item-h/--nav-icon/--nav-label stay computed from the preset'],
  ['--sw-topbar-h', '--sw-topbar-h (0)'], ['--sw-bottomnav-h', '--sw-bottomnav-h · --nav-bar-h (preset l: 62)'], ['--sw-drawer-w / --sw-drawer-modal-w / --sw-dialog-w', '--sw-drawer-w · --sw-drawer-modal-w · new'],
  ['--sw-content-max', '--sw-content-max'], ['--sw-tile-gap / --sw-card-gap', '--dv-gap · --dv-gap-lg · --dv-gap-sm'], ['--sw-card-pad / --sw-tile-pad', '--dv-card-pad-* · --dv-tile-pad-* · --dv-item-pad-*'],
  ['--sw-row-h / --sw-row-h-compact', '--dv-item-min-block · --dv-kpi-compact-min-block'], ['--sw-icon-ring / -lg', '--dv-icon-ring-size · --dv-icon-ring-size-lg · --dv-card-badge-size'],
  ['--sw-r-sm', '--sw-r-sm (8 → 10 domus · 8 ios · 4 tesla)'], ['--sw-r-md', '--sw-r-md · --dv-radius-sm (16 · 12 · 6)'], ['--sw-r-lg', '--sw-r-lg · --dv-radius-md (24 · 16 · 8)'], ['--sw-r-xl', '--dv-radius-lg (28 · 20 · 8)'], ['--sw-r-pill', '--sw-r-pill · --dv-radius-control (999 · 999 · 6)'],
  ['--sw-shadow-1/2/3', '--sw-shadow-1/2/3 · --dv-shadow-1/2/3 (top highlight moved to --sw-highlight)'], ['--sw-shadow-thumb', '--dv-shadow-control'],
  ['--sw-glass-blur / -nav / -sheet / --sw-glass-nested / --sw-glass-contrast-a', '--dv-surface-blur (+ new; "none" in the skins without glass)'],
  ['--sw-glass-sheen', 'new: top sheen gradient layered over --sw-surface on L1 (flat transparent gradient in iOS / Tesla)'],
  ['--sw-kpi-compact-pad-block / -pad-inline / -gap / -icon / -value-fs / -col-min / -cols-phone / -grid-gap', '--dv-kpi-compact-* and --lv-tile-compact-* of the same suffix; --sw-kpi-compact-* (min-block = --sw-row-h-compact)'],
  ['--sw-tree-inline / -inline-max / -count-w / -menu-w', '--dv-tree-inline · --dv-tree-inline-max · --dv-tree-count-w · --dv-tree-menu-w'],
  ['--sw-area-tile-min / --sw-area-card-min / --sw-floor-card-min / --sw-entity-tile-min', '--dv-area-tile-min · --dv-area-card-min · --dv-floor-card-min · --dv-entity-tile-min'],
  ['--sw-tile-min-block', '--dv-tile-min-block (the compact area tile; --dv-item-min-block = --sw-row-h)'],
  ['--sw-icon-ring-pad / --sw-icon-ring-on-bg', '--dv-icon-ring-pad · --dv-icon-ring-on-bg (--dv-icon-ring-bg = --sw-surface-3, --dv-icon-ring-fg = --sw-text)'],
  ['color-scheme (emitted with every scheme block)', '--dv-color-scheme: the CSS color-scheme value is written at the top of tokens-light.css / tokens-dark.css; engineering aliases --dv-color-scheme to it'],
  ['--sw-t-fast / -med / -slow', '--sw-t-fast · --sw-t-med (+ slow)'], ['--sw-ease / -enter / -exit / -thumb', '--sw-ease (+ new)'], ['--sw-hover-lift', '--dv-hover-lift'],
  ['--sw-z-*', '--sw-z-*'],
];

// Explicit coverage of every non---sw- name in TOKEN_CONTRACT.md §4–§5 (one row per name, no wildcards), so an automated
// name check passes: contract name → the token (or expression of tokens) engineering aliases it to. Checked by
// contract-check.mjs. Coverage discipline inspired by entrant A's 228/228 tokens.json.
const roles = ['accent', 'warm', 'cool', 'success', 'warning', 'danger', 'neutral'];
export const contractAliases = [
  ['--dv-color-scheme', 'the `color-scheme` declaration at the top of tokens*-light.css / tokens*-dark.css'],
  ['--dv-backdrop', '--sw-canvas layered over --sw-bg'], ['--dv-surface', '--sw-surface'], ['--dv-surface-2', '--sw-surface-2'], ['--dv-surface-3', '--sw-surface-3'],
  ['--dv-surface-solid', '--sw-surface-solid'], ['--dv-surface-2-solid', '--sw-surface-2-solid'], ['--dv-surface-3-solid', '--sw-surface-3-solid'],
  ['--dv-surface-blur', '--sw-glass-blur'], ['--dv-border', '--sw-border'], ['--dv-border-strong', '--sw-border-strong'], ['--dv-overlay', '--sw-overlay'],
  ['--dv-font', '--sw-font'], ['--dv-text', '--sw-text'], ['--dv-text-2', '--sw-text-2'], ['--dv-text-3', '--sw-text-3'],
  ['--dv-accent', '--sw-accent'], ['--dv-accent-hover', '--sw-accent-hover'], ['--dv-accent-soft', '--sw-accent-soft'], ['--dv-accent-text', '--sw-accent-text'], ['--dv-focus', '--sw-focus'],
  ['--dv-success', '--sw-success'], ['--dv-success-soft', '--sw-success-soft'], ['--dv-warning', '--sw-warning'], ['--dv-warning-soft', '--sw-warning-soft'],
  ['--dv-danger', '--sw-danger'], ['--dv-danger-soft', '--sw-danger-soft'], ['--dv-neutral-soft', '--sw-surface-3'], ['--dv-offline', '--sw-offline'], ['--dv-toggle-on', '--sw-toggle-on'],
  ['--dv-radius-sm', '--sw-r-md (tiles, rows, inputs)'], ['--dv-radius-md', '--sw-r-lg (panels)'], ['--dv-radius-lg', '--sw-r-xl (dialog)'], ['--dv-radius-control', '--sw-r-pill'],
  ['--dv-shadow-1', '--sw-shadow-1 + inset 0 1px 0 --sw-highlight'], ['--dv-shadow-2', '--sw-shadow-2 + inset 0 1px 0 --sw-highlight'], ['--dv-shadow-3', '--sw-shadow-3'], ['--dv-shadow-control', '--sw-shadow-thumb'], ['--dv-hover-lift', '--sw-hover-lift'],
  ['--dv-tile-on-warm', '--sw-on-warm'], ['--dv-tile-on-cool', '--sw-on-cool'], ['--dv-tile-on-switch', '--sw-on-switch'],
  ['--dv-glow-fill-start', '--sw-glow-fill-start'], ['--dv-glow-fill-end', '--sw-glow-fill-end'], ['--dv-glow-border', '--sw-glow-border'], ['--dv-glow-halo', '--sw-glow-halo'],
  ['--dv-icon-ring-size', '--sw-icon-ring'], ['--dv-icon-ring-size-lg', '--sw-icon-ring-lg'], ['--dv-icon-ring-pad', '--sw-icon-ring-pad'],
  ['--dv-icon-ring-bg', '--sw-surface-3'], ['--dv-icon-ring-on-bg', '--sw-icon-ring-on-bg'], ['--dv-icon-ring-fg', '--sw-text'], ['--dv-card-badge-size', '--sw-icon-ring'],
  ['--dv-fs-title', '--sw-fs-section'], ['--dv-fw-title', '--sw-fw-section'], ['--dv-fs-tile-name', '--sw-fs-md'], ['--dv-fs-item-name', '--sw-fs-sm'], ['--dv-fs-value-big', '--sw-fs-3xl'],
  ['--dv-gap-lg', '--sw-card-gap'], ['--dv-gap', '--sw-tile-gap'], ['--dv-gap-sm', '--sw-s-2'],
  ['--dv-card-pad-block', '--sw-card-pad'], ['--dv-card-pad-inline', '--sw-card-pad'], ['--dv-item-pad-block', '--sw-s-3'], ['--dv-item-pad-inline', '--sw-s-4'], ['--dv-tile-pad-block', '--sw-tile-pad'], ['--dv-tile-pad-inline', '--sw-tile-pad'],
  ['--dv-tile-min-block', '--sw-tile-min-block'], ['--dv-item-min-block', '--sw-row-h'],
  ['--dv-area-tile-min', '--sw-area-tile-min'], ['--dv-floor-card-min', '--sw-floor-card-min'], ['--dv-area-card-min', '--sw-area-card-min'], ['--dv-entity-tile-min', '--sw-entity-tile-min'],
  ['--dv-tree-inline', '--sw-tree-inline'], ['--dv-tree-inline-max', '--sw-tree-inline-max'], ['--dv-tree-count-w', '--sw-tree-count-w'], ['--dv-tree-menu-w', '--sw-tree-menu-w'],
  ...['min-block', 'pad-block', 'pad-inline', 'gap', 'icon', 'value-fs', 'col-min', 'cols-phone', 'grid-gap'].flatMap((s) => {
    const to = s === 'min-block' ? '--sw-row-h-compact' : `--sw-kpi-compact-${s}`;
    return [[`--dv-kpi-compact-${s}`, to], [`--lv-tile-compact-${s}`, to], ...(s === 'min-block' ? [['--sw-kpi-compact-min-block', to]] : [])];
  }),
  ...roles.flatMap((r) => [[`--dv-role-${r}-bg`, `rgb(--sw-role-${r} / --sw-role-fill-a)`], [`--dv-role-${r}-border`, `rgb(--sw-role-${r} / --sw-role-border-a)`], [`--dv-role-${r}-fg`, `--sw-role-${r}-fg`]]),
  ['--nav-icon', 'rail preset (l: 25px); the design fixes the look, not the numbers'], ['--nav-label', 'rail preset (l: 12px = --sw-fs-xs)'], ['--nav-item-h', 'rail preset (l: 64px)'],
  ['--nav-item-w', '--sw-rail-w − 2 × --sw-rail-gap − 12px (item fills the rail panel)'], ['--nav-avatar', '--sw-icon-ring (36px)'], ['--nav-bar-h', '--sw-bottomnav-h'],
  ['--nav-p-label', '--sw-fs-xs'], ['--nav-pill-w', '52px (bar pill; fixed by nav-size.ts)'], ['--nav-pill-h', '30px (bar pill; fixed by nav-size.ts)'], ['--nav-p-icon', '22px (bar icon; fixed by nav-size.ts)'],
  ['--sw-tab-min-h', '--sw-control-h (desktop) / --sw-touch (phone underline tabs)'], ['--sw-icon-size', '20px = --sw-icon-ring − 2 × --sw-icon-ring-pad + 2px'],
];
