# Token map — new semantic name → old names

Generated from `src/tokens.mjs`. One semantic palette under `--sw-*`, the same names in every skin (`skins/*.mjs`); engineering aliases the old `--sw-*` and `--dv-*` names onto it. Every name below has a light and a dark value in `tokens.json` (domus), `tokens-ios.json` and `tokens-tesla.json`.

| New name | Old names / note |
|---|---|
| `--sw-bg` | --sw-bg · --dv-backdrop (base colour) |
| `--sw-canvas` | --dv-backdrop (gradient layer) · new |
| `--sw-surface` | --sw-surface · --dv-surface |
| `--sw-surface-solid` | --dv-surface-solid · new for --sw- |
| `--sw-surface-2` | --sw-surface-2 · --dv-surface-2 |
| `--sw-surface-2-solid` | --dv-surface-2-solid |
| `--sw-surface-3` | --sw-surface-3 · --dv-surface-3 · --dv-neutral-soft · --dv-icon-ring-bg |
| `--sw-surface-3-solid` | new |
| `--sw-border` | --sw-border · --dv-border |
| `--sw-border-strong` | --sw-border-strong · --dv-border-strong |
| `--sw-highlight` | new (glass top hairline; the inset line inside --dv-shadow-1/2; transparent in the iOS and Tesla skins) |
| `--sw-overlay` | --sw-overlay · --dv-overlay |
| `--sw-video-bg` | --sw-video-bg |
| `--sw-text` | --sw-text · --dv-text · --dv-icon-ring-fg |
| `--sw-heading` | --sw-heading |
| `--sw-text-2` | --sw-text-2 · --dv-text-2 |
| `--sw-text-3` | --sw-text-3 · --dv-text-3 |
| `--sw-text-inverse` | --sw-text-inverse |
| `--sw-accent` | --sw-accent · --dv-accent |
| `--sw-accent-hover` | --sw-accent-hover · --dv-accent-hover |
| `--sw-accent-soft` | --sw-accent-soft · --dv-accent-soft |
| `--sw-accent-text` | --sw-accent-text · --dv-accent-text |
| `--sw-nav` | --sw-nav |
| `--sw-focus` | --sw-focus · --dv-focus |
| `--sw-focus-w / --sw-focus-offset` | new (one focus rule) |
| `--sw-live / -soft` | --sw-live · --sw-live-soft |
| `--sw-recorded / -soft` | --sw-recorded · --sw-recorded-soft |
| `--sw-offline / -soft` | --sw-offline · --sw-offline-soft · --dv-offline |
| `--sw-stale / -soft` | --sw-stale · --sw-stale-soft |
| `--sw-unknown / -soft` | --sw-unknown · --sw-unknown-soft |
| `--sw-danger / -soft` | --sw-danger · --sw-danger-soft · --dv-danger · --dv-danger-soft |
| `--sw-warning / -soft` | --sw-warning · --sw-warning-soft · --dv-warning · --dv-warning-soft |
| `--sw-success / -soft` | --sw-success · --sw-success-soft · --dv-success · --dv-success-soft |
| `--sw-forbidden / -soft` | --sw-forbidden · --sw-forbidden-soft |
| `--sw-purple` | --sw-purple |
| `--sw-<state>-text (×10)` | new: the text colour of a state on its -soft fill (badge, chip, KPI detail); the bare state colour stays for dots, bars and icons |
| `--sw-toggle-on` | --dv-toggle-on |
| `--sw-on-warm / -cool / -switch` | --dv-tile-on-warm · --dv-tile-on-cool · --dv-tile-on-switch (one accent triplet for all three in the Tesla skin) |
| `--sw-glow-fill-start / -end / --sw-glow-border / --sw-glow-halo` | --dv-glow-fill-start · --dv-glow-fill-end · --dv-glow-border · --dv-glow-halo (iOS: flat tint, no halo; Tesla: rule only) |
| `--sw-role-<role> / -fg / --sw-role-fill-a / --sw-role-border-a` | --dv-role-<role>-bg · -border · -fg (bg = rgb(triplet / fill-a), border = rgb(triplet / border-a)) |
| `--sw-map-* · --sw-obj-* · --sw-circuit-* · --sw-fov` | same names (dark values added) |
| `--sw-font` | --sw-font · --dv-font (Heebo leads in every skin) |
| `--sw-font-mono` | --sw-font-mono |
| `--sw-fs-xs … --sw-fs-3xl` | --sw-fs-* ; --dv-fs-item-name = --sw-fs-sm, --dv-fs-tile-name = --sw-fs-md, --dv-fs-title = --sw-fs-section, --dv-fs-value-big = --sw-fs-3xl |
| `--sw-h1 / --sw-h1-phone / -weight / -tracking / -lh` | --sw-h1 · --sw-h1-weight · --sw-h1-tracking (phone value new) |
| `--sw-h2 / --sw-h2-tracking` | new |
| `--sw-fs-section / --sw-fw-section` | --dv-fs-title · --dv-fw-title |
| `--sw-fs-reading / -phone / --sw-fw-reading / --sw-reading-tracking` | new (clock, temperature) |
| `--sw-lh / --sw-lh-tight` | --sw-lh |
| `--sw-fw-*` | --sw-fw-* |
| `--sw-nums` | new (font-variant-numeric) |
| `--sw-s-1 … --sw-s-10` | --sw-s-* |
| `--sw-page-pad / -tablet / -phone` | --sw-page-pad |
| `--sw-touch` | --sw-touch (36 → 44) |
| `--sw-control-h / -sm / -lg` | new: visual heights of controls (targets padded to --sw-touch) |
| `--sw-rail-w / --sw-rail-w-wide / --sw-rail-gap` | --sw-rail-w · --sw-rail-w-wide ; --nav-item-h/--nav-icon/--nav-label stay computed from the preset |
| `--sw-topbar-h` | --sw-topbar-h (0) |
| `--sw-bottomnav-h` | --sw-bottomnav-h · --nav-bar-h (preset l: 62) |
| `--sw-drawer-w / --sw-drawer-modal-w / --sw-dialog-w` | --sw-drawer-w · --sw-drawer-modal-w · new |
| `--sw-content-max` | --sw-content-max |
| `--sw-tile-gap / --sw-card-gap` | --dv-gap · --dv-gap-lg · --dv-gap-sm |
| `--sw-card-pad / --sw-tile-pad` | --dv-card-pad-* · --dv-tile-pad-* · --dv-item-pad-* |
| `--sw-row-h / --sw-row-h-compact` | --dv-item-min-block · --dv-kpi-compact-min-block |
| `--sw-icon-ring / -lg` | --dv-icon-ring-size · --dv-icon-ring-size-lg · --dv-card-badge-size |
| `--sw-r-sm` | --sw-r-sm (8 → 10 domus · 8 ios · 4 tesla) |
| `--sw-r-md` | --sw-r-md · --dv-radius-sm (16 · 12 · 6) |
| `--sw-r-lg` | --sw-r-lg · --dv-radius-md (24 · 16 · 8) |
| `--sw-r-xl` | --dv-radius-lg (28 · 20 · 8) |
| `--sw-r-pill` | --sw-r-pill · --dv-radius-control (999 · 999 · 6) |
| `--sw-shadow-1/2/3` | --sw-shadow-1/2/3 · --dv-shadow-1/2/3 (top highlight moved to --sw-highlight) |
| `--sw-shadow-thumb` | --dv-shadow-control |
| `--sw-glass-blur / -nav / -sheet / --sw-glass-nested / --sw-glass-contrast-a` | --dv-surface-blur (+ new; "none" in the skins without glass) |
| `--sw-t-fast / -med / -slow` | --sw-t-fast · --sw-t-med (+ slow) |
| `--sw-ease / -enter / -exit / -thumb` | --sw-ease (+ new) |
| `--sw-hover-lift` | --dv-hover-lift |
| `--sw-z-*` | --sw-z-* |
