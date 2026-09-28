import { css } from 'lit';

/**
 * CR-007 slice 6a: THE one place where the device-control screens' looks are defined (חשמל והתקנים: the building
 * screen, the area screen, the bulk popover and dialog). Documented in docs/design/DEVICE_THEMES.md.
 *
 * Two attributes on a device screen's host select what applies:
 * - `data-devices-style` (setting `devices.style`): the STRUCTURE - which element rules are active.
 *   "smplwise" = the product's own look (the v2 tokens of styles/tokens.css, no rule here matches it);
 *   "glass"    = the approved mockup's look; its element rules live next to each screen's template and read ONLY the
 *                `--dv-*` knobs below - never a literal colour, radius, shadow or size.
 * - `data-devices-theme` (setting `devices.theme`): the PALETTE - the values of those knobs. One palette today,
 *   "default"; each palette sets light values, dark values (`prefers-color-scheme: dark`) and, where it wants to,
 *   phone values (max-width 767px). Adding a palette = copying the "default" blocks under a new id and registering it
 *   (DEVICE_THEMES here, THEMES in routers/settings.py) - no screen changes.
 *
 * Layers, in order:
 *   1. the BRIDGE: the glass style maps its knobs onto the v2 `--sw-*` tokens on the host, so every nested shared
 *      component (sw-page, sw-card, sw-kpi, sw-button, sw-badge, sw-toggle, sw-chip, sw-dialog ...) follows by plain
 *      CSS inheritance;
 *   2. the PALETTES (knob values);
 *   3. the FALLBACK: without `backdrop-filter`, or with `prefers-reduced-transparency: reduce`, the surfaces turn
 *      solid (`--dv-surface-solid`, `--dv-surface-2-solid`) and the blur is off - same layout.
 * Motion: the only movement (the tile hover lift, `--dv-hover-lift`) is applied by the screens under
 * `prefers-reduced-motion: no-preference` only.
 */

/** The registered palettes (keep in step with THEMES in smplwise_vms/backend/smplwise/routers/settings.py). */
export const DEVICE_THEMES = ['default'] as const;
export type DeviceThemeId = (typeof DEVICE_THEMES)[number];

/** Every knob a palette sets, with its role (the same list, with screenshots, is in docs/design/DEVICE_THEMES.md). */
export const DEVICE_THEME_KNOBS: Record<string, string> = {
  '--dv-color-scheme': 'light | dark - native form controls and scrollbars inside the screens',
  '--dv-backdrop': 'the page backdrop behind the glass (gradient); carried by the screen\'s sw-page, grows with the content',
  '--dv-surface': 'panel surface: cards, KPIs, floor cards, tree panel, area tiles, popover, dialog (translucent)',
  '--dv-surface-2': 'inner surface: device tiles and rows inside a card, area rows inside a floor card, empty cards',
  '--dv-surface-3': 'tracks: segmented-control groove, progress bars, sliders\' rails',
  '--dv-surface-solid': '--dv-surface when transparency is off (no backdrop-filter / reduced transparency)',
  '--dv-surface-2-solid': '--dv-surface-2 when transparency is off',
  '--dv-surface-blur': 'the glass material (backdrop-filter value) of every panel on the backdrop',
  '--dv-border': 'hairlines: panel edges, row separators',
  '--dv-border-strong': 'stronger edges: buttons, inputs, hover',
  '--dv-overlay': 'the dimmed layer behind the bulk dialog',
  '--dv-font': 'font stack of the device screens',
  '--dv-text': 'primary text and headings',
  '--dv-text-2': 'secondary text (states, values)',
  '--dv-text-3': 'tertiary text (captions, counts)',
  '--dv-accent': 'interaction colour: selected chip, primary button, slider fill, links',
  '--dv-accent-hover': 'accent on hover',
  '--dv-accent-soft': 'soft accent fill: selected tree row, card badge ring',
  '--dv-accent-text': 'accent-coloured text on a soft accent fill',
  '--dv-focus': 'keyboard focus ring',
  '--dv-success': 'online / confirmed / locked-ok',
  '--dv-success-soft': 'soft success fill (badges)',
  '--dv-warning': 'warm "something is on" colour (lit counts, stale)',
  '--dv-warning-soft': 'soft warm fill (climate chips, warm rows)',
  '--dv-danger': 'danger text and outlines ("כבה הכל")',
  '--dv-danger-soft': 'soft danger fill',
  '--dv-neutral-soft': 'soft grey fill (offline / unknown badges)',
  '--dv-offline': 'offline grey',
  '--dv-radius-sm': 'radius of inner tiles, rows, inputs',
  '--dv-radius-md': 'radius of panels: cards, KPIs, area tiles, popover',
  '--dv-radius-lg': 'radius of the dialog',
  '--dv-radius-control': 'radius of pill controls: segmented control, tree rows',
  '--dv-shadow-1': 'resting panel shadow (with the top highlight)',
  '--dv-shadow-2': 'raised / hover shadow',
  '--dv-shadow-3': 'floating shadow: popover, dialog',
  '--dv-shadow-control': 'the selected segment\'s thumb',
  '--dv-tile-on-warm': 'RGB triplet: glow of an area tile where something is on (building screen)',
  '--dv-tile-on-cool': 'RGB triplet: glow of a lit light tile (area screen)',
  '--dv-tile-on-switch': 'RGB triplet: glow of a running switch tile (area screen)',
  '--dv-glow-fill-start': 'alpha of the "on" glow gradient at its start corner',
  '--dv-glow-fill-end': 'alpha of the "on" glow gradient at its end corner',
  '--dv-glow-border': 'alpha of an "on" tile\'s border',
  '--dv-glow-halo': 'alpha of an "on" tile\'s outer halo',
  '--dv-icon-ring-size': 'the round icon badge of a device tile (area screen)',
  '--dv-icon-ring-size-lg': 'the round icon badge of an area tile (building screen)',
  '--dv-icon-ring-pad': 'space between the badge edge and the icon (the icon is the rest)',
  '--dv-icon-ring-bg': 'badge fill at rest',
  '--dv-icon-ring-on-bg': 'badge fill on an "on" tile',
  '--dv-icon-ring-fg': 'icon colour inside the badge',
  '--dv-card-badge-size': 'the round domain icon at a card\'s header end (area screen)',
  '--dv-toggle-on': 'colour of a switched-on toggle',
  '--dv-fs-title': 'floor-card, floor and card titles',
  '--dv-fs-tile-name': 'area tile name (building screen)',
  '--dv-fs-item-name': 'device tile name (area screen)',
  '--dv-fs-value-big': 'big readings (climate current temperature)',
  '--dv-fw-title': 'weight of those titles',
  '--dv-gap-lg': 'gap between floor cards and between the tree and the cards',
  '--dv-gap': 'gap between KPIs, area tiles, area-screen cards',
  '--dv-gap-sm': 'gap between device tiles and rows inside a card',
  '--dv-card-pad-block': 'panel padding, top and bottom',
  '--dv-card-pad-inline': 'panel padding, start and end',
  '--dv-item-pad-block': 'device tile / row / area row padding, top and bottom',
  '--dv-item-pad-inline': 'device tile / row / area row padding, start and end',
  '--dv-tile-pad-block': 'area tile padding, top and bottom',
  '--dv-tile-pad-inline': 'area tile padding, start and end',
  '--dv-tile-min-block': 'area tile minimum height',
  '--dv-item-min-block': 'device tile minimum height',
  '--dv-area-tile-min': 'minimum width of an area tile column',
  '--dv-floor-card-min': 'minimum width of a floor-card column',
  '--dv-area-card-min': 'minimum width of an area-screen card column',
  '--dv-entity-tile-min': 'minimum width of a device tile column inside a card',
  '--dv-tree-inline': 'width of the building tree panel',
  '--dv-hover-lift': 'how far an area tile rises on hover (motion allowed only)',
};

export const devicesThemes = css`
  /* ---- 1. the bridge: glass knobs -> the v2 tokens every nested component reads ---- */
  :host([data-devices-style='glass']) {
    --sw-glass-blur: var(--dv-surface-blur);
    --sw-bg: transparent;
    --sw-surface: var(--dv-surface);
    --sw-surface-2: var(--dv-surface-2);
    --sw-surface-3: var(--dv-surface-3);
    --sw-border: var(--dv-border);
    --sw-border-strong: var(--dv-border-strong);
    --sw-overlay: var(--dv-overlay);
    --sw-text: var(--dv-text);
    --sw-heading: var(--dv-text);
    --sw-text-2: var(--dv-text-2);
    --sw-text-3: var(--dv-text-3);
    --sw-accent: var(--dv-accent);
    --sw-accent-hover: var(--dv-accent-hover);
    --sw-accent-soft: var(--dv-accent-soft);
    --sw-accent-text: var(--dv-accent-text);
    --sw-focus: var(--dv-focus);
    --sw-live: var(--dv-success);
    --sw-live-soft: var(--dv-success-soft);
    --sw-success: var(--dv-success);
    --sw-success-soft: var(--dv-success-soft);
    --sw-warning: var(--dv-warning);
    --sw-warning-soft: var(--dv-warning-soft);
    --sw-stale: var(--dv-warning);
    --sw-stale-soft: var(--dv-warning-soft);
    --sw-danger: var(--dv-danger);
    --sw-danger-soft: var(--dv-danger-soft);
    --sw-offline: var(--dv-offline);
    --sw-offline-soft: var(--dv-neutral-soft);
    --sw-unknown-soft: var(--dv-neutral-soft);
    --sw-recorded-soft: var(--dv-accent-soft);
    --sw-r-sm: var(--dv-radius-sm);
    --sw-r-md: var(--dv-radius-md);
    --sw-r-lg: var(--dv-radius-lg);
    --sw-r-pill: var(--dv-radius-control);
    --sw-shadow-1: var(--dv-shadow-1);
    --sw-shadow-2: var(--dv-shadow-2);
    --sw-shadow-3: var(--dv-shadow-3);
    --sw-font: var(--dv-font);
    color-scheme: var(--dv-color-scheme);
    color: var(--dv-text);
    font-family: var(--dv-font);
  }
  /* the backdrop rides on the page frame, which grows with the content (the host is only as tall as the view) */
  :host([data-devices-style='glass']) sw-page {
    background: var(--dv-backdrop);
  }

  /* ---- 2. palette "default" (the approved mockup): light ---- */
  :host([data-devices-style='glass'][data-devices-theme='default']) {
    --dv-color-scheme: light;
    --dv-backdrop: radial-gradient(1100px 560px at 85% -12%, rgba(255, 184, 86, 0.2), transparent 60%),
      radial-gradient(900px 520px at 8% 112%, rgba(10, 132, 255, 0.16), transparent 60%), linear-gradient(180deg, #eef2f9, #e5eaf4);
    --dv-surface: rgba(255, 255, 255, 0.64);
    --dv-surface-2: rgba(255, 255, 255, 0.5);
    --dv-surface-3: rgba(120, 120, 128, 0.14);
    --dv-surface-solid: #fbfcfe;
    --dv-surface-2-solid: #f2f5fa;
    --dv-surface-blur: blur(28px) saturate(1.7);
    --dv-border: rgba(60, 60, 67, 0.12);
    --dv-border-strong: rgba(60, 60, 67, 0.22);
    --dv-overlay: rgba(15, 23, 42, 0.38);
    --dv-font: -apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', 'Noto Sans Hebrew', 'Heebo', Roboto, Arial, sans-serif;
    --dv-text: #1c1c1e;
    --dv-text-2: #4c4c50;
    --dv-text-3: #6e6e73;
    --dv-accent: #007aff;
    --dv-accent-hover: #0066d6;
    --dv-accent-soft: rgba(0, 122, 255, 0.13);
    --dv-accent-text: #0062cc;
    --dv-focus: #007aff;
    --dv-success: #34c759;
    --dv-success-soft: rgba(52, 199, 89, 0.16);
    --dv-warning: #ff9f0a;
    --dv-warning-soft: rgba(255, 159, 10, 0.16);
    --dv-danger: #d70015;
    --dv-danger-soft: rgba(255, 59, 48, 0.13);
    --dv-neutral-soft: rgba(120, 120, 128, 0.14);
    --dv-offline: #8e8e93;
    --dv-radius-sm: 14px;
    --dv-radius-md: 22px;
    --dv-radius-lg: 28px;
    --dv-radius-control: 999px;
    --dv-shadow-1: 0 10px 30px rgba(31, 45, 80, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.65);
    --dv-shadow-2: 0 18px 44px rgba(31, 45, 80, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.65);
    --dv-shadow-3: 0 24px 64px rgba(15, 23, 42, 0.26);
    --dv-shadow-control: 0 1px 4px rgba(0, 0, 0, 0.18);
    --dv-tile-on-warm: 255 159 10;
    --dv-tile-on-cool: 61 90 254;
    --dv-tile-on-switch: 52 199 89;
    --dv-glow-fill-start: 0.3;
    --dv-glow-fill-end: 0.07;
    --dv-glow-border: 0.4;
    --dv-glow-halo: 0.22;
    --dv-icon-ring-size: 36px;
    --dv-icon-ring-size-lg: 40px;
    --dv-icon-ring-pad: 9px;
    --dv-icon-ring-bg: rgba(120, 120, 128, 0.14);
    --dv-icon-ring-on-bg: rgba(255, 255, 255, 0.34);
    --dv-icon-ring-fg: #1c1c1e;
    --dv-card-badge-size: 34px;
    --dv-toggle-on: #34c759;
    --dv-fs-title: 16px;
    --dv-fs-tile-name: 14px;
    --dv-fs-item-name: 12.5px;
    --dv-fs-value-big: 24px;
    --dv-fw-title: 700;
    --dv-gap-lg: 18px;
    --dv-gap: 14px;
    --dv-gap-sm: 10px;
    --dv-card-pad-block: 18px;
    --dv-card-pad-inline: 20px;
    --dv-item-pad-block: 12px;
    --dv-item-pad-inline: 14px;
    --dv-tile-pad-block: 16px;
    --dv-tile-pad-inline: 18px;
    --dv-tile-min-block: 116px;
    --dv-item-min-block: 64px;
    --dv-area-tile-min: 210px;
    --dv-floor-card-min: 360px;
    --dv-area-card-min: 320px;
    --dv-entity-tile-min: 220px;
    --dv-tree-inline: 270px;
    --dv-hover-lift: -2px;
  }
  /* palette "default": dark (the mockup's own board 6) */
  @media (prefers-color-scheme: dark) {
    :host([data-devices-style='glass'][data-devices-theme='default']) {
      --dv-color-scheme: dark;
      --dv-backdrop: radial-gradient(1200px 600px at 80% -10%, rgba(255, 184, 86, 0.22), transparent 60%),
        radial-gradient(900px 500px at 10% 110%, rgba(10, 132, 255, 0.25), transparent 60%), #0a0a0c;
      --dv-surface: rgba(28, 28, 30, 0.72);
      --dv-surface-2: rgba(44, 44, 46, 0.62);
      --dv-surface-3: rgba(235, 235, 245, 0.14);
      --dv-surface-solid: #1c1c1e;
      --dv-surface-2-solid: #2c2c2e;
      --dv-border: rgba(255, 255, 255, 0.13);
      --dv-border-strong: rgba(255, 255, 255, 0.24);
      --dv-overlay: rgba(0, 0, 0, 0.55);
      --dv-text: #f5f5f7;
      --dv-text-2: rgba(235, 235, 245, 0.72);
      --dv-text-3: rgba(235, 235, 245, 0.56);
      --dv-accent: #0a84ff;
      --dv-accent-hover: #409cff;
      --dv-accent-soft: rgba(10, 132, 255, 0.26);
      --dv-accent-text: #64d2ff;
      --dv-focus: #64d2ff;
      --dv-success: #30d158;
      --dv-success-soft: rgba(48, 209, 88, 0.2);
      --dv-warning-soft: rgba(255, 159, 10, 0.2);
      --dv-danger: #ff453a;
      --dv-danger-soft: rgba(255, 69, 58, 0.2);
      --dv-neutral-soft: rgba(142, 142, 147, 0.2);
      --dv-shadow-1: 0 18px 48px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      --dv-shadow-2: 0 22px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
      --dv-shadow-3: 0 26px 70px rgba(0, 0, 0, 0.6);
      --dv-shadow-control: 0 1px 4px rgba(0, 0, 0, 0.35);
      --dv-icon-ring-bg: rgba(235, 235, 245, 0.12);
      --dv-icon-ring-on-bg: rgba(255, 255, 255, 0.18);
      --dv-icon-ring-fg: #f5f5f7;
      --dv-toggle-on: #30d158;
    }
  }
  /* palette "default": phone (sizes only; colours as above) */
  @media (max-width: 767px) {
    :host([data-devices-style='glass'][data-devices-theme='default']) {
      --dv-gap: 10px;
      --dv-gap-lg: 12px;
      --dv-card-pad-block: 14px;
      --dv-card-pad-inline: 14px;
      --dv-tile-pad-block: 12px;
      --dv-tile-pad-inline: 14px;
      --dv-tile-min-block: 100px;
      --dv-area-tile-min: 150px;
    }
  }

  /* ---- 3. fallback: no backdrop-filter, or the viewer asked for less transparency - solid panels, same layout ---- */
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    :host([data-devices-style='glass']) {
      --sw-glass-blur: none;
      --sw-surface: var(--dv-surface-solid);
      --sw-surface-2: var(--dv-surface-2-solid);
    }
  }
  @media (prefers-reduced-transparency: reduce) {
    :host([data-devices-style='glass']) {
      --sw-glass-blur: none;
      --sw-surface: var(--dv-surface-solid);
      --sw-surface-2: var(--dv-surface-2-solid);
    }
  }
`;
