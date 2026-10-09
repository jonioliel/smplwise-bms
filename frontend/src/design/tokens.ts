/**
 * THE token table of the product (design foundation, 2026-10-01). Every colour, radius, shadow, blur, type and motion token
 * is declared here ONCE, as `{ name: { light, dark } }`, and nowhere else. `css.ts` turns the table into the CSS custom
 * properties on `:root`; nothing else in the app declares a `--sw-*` token (the `--dv-*` glass knobs of the device screens
 * are a separate family that bridges onto these names inside those screens, see styles/devices-themes.ts).
 *
 * The values below are the "classic" skin: the light column is exactly the look the product had before the foundation
 * (the effective values of the old styles/tokens.css), the dark column is the new dark set of the whole shell. A skin
 * (design/skins/*.ts) overrides names from this table - always BOTH columns - and adds a bounded set of component rules.
 *
 * Rules for this file (docs/design/SKIN_AUTHORING_HE.md):
 *  - semantic names (`--sw-accent`, never `--sw-blue`); a state colour has a `-soft` fill and a `-text` companion;
 *  - a name is declared here before a skin may override it (an unknown name in a skin is an error, see skins/index.ts);
 *  - sizes in px, alphas as rgba(); RGB triplets only where the code composes an alpha.
 */

export interface TokenValue {
  light: string;
  dark: string;
}
export type TokenTable = Record<string, TokenValue>;
export interface TokenGroup {
  id: string;
  title: string;
  tokens: TokenTable;
}

/** One value for both schemes (sizes, fonts, motion). */
export const same = (v: string): TokenValue => ({ light: v, dark: v });
/** A light and a dark value. */
export const lt = (light: string, dark: string): TokenValue => ({ light, dark });

export const TOKEN_GROUPS: TokenGroup[] = [
  {
    id: 'surface',
    title: 'Canvas and surfaces',
    tokens: {
      '--sw-bg': lt('#f5f7fb', '#0d1220'),
      // what the page is painted with; a skin may make it a gradient with blooms (the glass sits on it)
      '--sw-canvas': same('linear-gradient(var(--sw-bg), var(--sw-bg))'),
      '--sw-surface': lt('#ffffff', '#151c2c'),
      '--sw-surface-2': lt('#f7f9fc', '#1a2336'),
      '--sw-surface-3': lt('#eef2f8', '#222d44'),
      // the opaque twins of the three levels: floating layers (dialog, popover, drawer) and the no-transparency fallback
      '--sw-surface-solid': lt('#ffffff', '#151c2c'),
      '--sw-surface-2-solid': lt('#f7f9fc', '#1a2336'),
      '--sw-surface-3-solid': lt('#eef2f8', '#222d44'),
      '--sw-border': lt('#e7ebf2', '#232e45'),
      '--sw-border-strong': lt('#e1e6ef', '#2f3c58'),
      '--sw-highlight': same('transparent'), // glass: the 1px light line along a panel's top edge
      '--sw-overlay': lt('rgba(17, 24, 39, 0.45)', 'rgba(0, 0, 0, 0.62)'),
      '--sw-video-bg': lt('#0f1729', '#05070c'),
    },
  },
  {
    id: 'text',
    title: 'Text',
    tokens: {
      '--sw-text': lt('#22314c', '#e6ebf5'),
      '--sw-heading': lt('#1e2e47', '#f3f6fc'),
      '--sw-text-2': lt('#5b6a85', '#a9b4ca'),
      '--sw-text-3': lt('#8a97ae', '#8190aa'),
      '--sw-text-inverse': lt('#ffffff', '#ffffff'), // text on an accent fill
    },
  },
  {
    id: 'accent',
    title: 'Accent and focus',
    tokens: {
      '--sw-accent': lt('#2767ed', '#3a6ce0'),
      '--sw-accent-hover': lt('#1f57d1', '#5a88f2'),
      '--sw-accent-soft': lt('#edf3ff', 'rgba(91, 140, 255, 0.18)'),
      '--sw-accent-text': lt('#2767ed', '#8fb2ff'),
      '--sw-focus': lt('#2767ed', '#7aa2ff'),
      '--sw-nav': lt('#2868ef', '#3a6ce0'),
    },
  },
  {
    id: 'state',
    title: 'State colours (always paired with text or a shape)',
    tokens: {
      '--sw-live': lt('#22c55e', '#3ddc84'),
      '--sw-live-soft': lt('#e8f8ee', 'rgba(61, 220, 132, 0.18)'),
      '--sw-recorded': lt('#2f6bff', '#6ea2ff'),
      '--sw-recorded-soft': lt('#eaf0ff', 'rgba(110, 162, 255, 0.2)'),
      '--sw-offline': lt('#9aa3b5', '#8b96a8'),
      '--sw-offline-soft': lt('#f1f3f7', 'rgba(139, 150, 168, 0.2)'),
      '--sw-stale': lt('#f59e0b', '#f5b043'),
      '--sw-stale-soft': lt('#fff4e0', 'rgba(245, 176, 67, 0.2)'),
      '--sw-unknown': lt('#b3bac7', '#6b7686'),
      '--sw-unknown-soft': lt('#f4f6f9', 'rgba(107, 118, 134, 0.22)'),
      '--sw-danger': lt('#ef4444', '#ff6b62'),
      '--sw-danger-soft': lt('#fdecec', 'rgba(255, 107, 98, 0.2)'),
      '--sw-warning': lt('#f59e0b', '#f5b043'),
      '--sw-warning-soft': lt('#fff4e0', 'rgba(245, 176, 67, 0.2)'),
      '--sw-success': lt('#22c55e', '#3ddc84'),
      '--sw-success-soft': lt('#e8f8ee', 'rgba(61, 220, 132, 0.18)'),
      '--sw-forbidden': lt('#dc2626', '#ff7a70'),
      '--sw-forbidden-soft': lt('#fdecec', 'rgba(255, 122, 112, 0.2)'),
      '--sw-purple': lt('#8b5cf6', '#a78bfa'),
      // the text colour of a state on its own -soft fill (badge, chip, KPI detail); the bare colour stays for dots, bars, icons
      '--sw-live-text': lt('#15803d', '#3ddc84'),
      '--sw-recorded-text': lt('#1f5ae6', '#8fb8ff'),
      '--sw-offline-text': lt('#6b7280', '#b4bdcc'),
      '--sw-stale-text': lt('#b45309', '#f5b043'),
      '--sw-unknown-text': lt('#6b7280', '#aab5c9'),
      '--sw-danger-text': lt('#b91c1c', '#ff8a82'),
      '--sw-warning-text': lt('#b45309', '#f5b043'),
      '--sw-success-text': lt('#16a34a', '#3ddc84'),
      '--sw-forbidden-text': lt('#b91c1c', '#ff8a82'),
      '--sw-toggle-on': lt('#2767ed', '#3a6ce0'),
      '--sw-toggle-thumb': same('#ffffff'), // the switch's knob (white on the track in both schemes; a skin may tint it)
      // Investigation timeline kinds (owner 2026-10-01): the defaults; the installation setting `timeline.colors` (api/timeline-colors.ts)
      // overrides them on the document root. Mid-tones that read on the light surface and on a dark one.
      '--sw-tl-recording': same('var(--sw-accent)'),
      '--sw-tl-motion': same('#ef4444'),
      '--sw-tl-person': same('#ea580c'),
      '--sw-tl-vehicle': same('#22c55e'),
      '--sw-tl-door': same('#8b5cf6'),
      '--sw-tl-line': same('#f59e0b'),
      '--sw-tl-offline': same('#6b7280'),
    },
  },
  {
    id: 'canvas',
    title: 'Plan, 3D and object colours (the map neutrals)',
    tokens: {
      '--sw-map-bg': lt('#f7f9fc', '#0f141d'),
      '--sw-map-wall': lt('#c5cfdd', '#4a5568'),
      '--sw-map-room-fill': lt('#ffffff', '#161c28'),
      '--sw-map-furniture': lt('#eaeff6', '#1f2736'),
      '--sw-map-furniture-line': lt('#d3dbe7', '#3a4457'),
      '--sw-map-structure': lt('#56617a', '#9aa6bb'),
      '--sw-map-glass': lt('#7fb2ff', '#6ea2ff'),
      '--sw-map-candidate': lt('#2767ed', '#6ea2ff'),
      '--sw-map-label': lt('#8a97ae', '#8391a8'),
      '--sw-map-glow': lt('#ffd166', '#ffc857'),
      '--sw-map-sky': lt('#dbe7f8', '#0b1a33'),
      '--sw-map-sky-horizon': lt('#f5f8fc', '#1a2b47'),
      '--sw-map-wall-3d': lt('#d7dde6', '#2b3547'),
      '--sw-map-lit': lt('#ffc857', '#ffb547'),
      '--sw-map-presence': lt('#2767ed', '#6ea2ff'),
      '--sw-map-temp': lt('#1e3a63', '#cfe0ff'),
      '--sw-fov': lt('rgba(39, 103, 237, 0.12)', 'rgba(110, 162, 255, 0.16)'),
      '--sw-obj-object': lt('#7b8794', '#9aa5b4'),
      '--sw-obj-structure': lt('#4b5567', '#aab4c5'),
      '--sw-obj-circulation': lt('#6b7f99', '#8fa4c2'),
      '--sw-obj-furniture': lt('#9aa7b8', '#7f8b9c'),
      '--sw-obj-light': lt('#f2b544', '#f2b544'),
      '--sw-obj-electrical': lt('#e07a2f', '#f08a45'),
      '--sw-obj-safety': lt('#e0443c', '#ff6b62'),
      '--sw-obj-medical': lt('#2fa7b3', '#4fc3ce'),
      '--sw-obj-sport': lt('#3fa25b', '#5cc47a'),
      '--sw-obj-sanitary': lt('#5b9bd5', '#7fb2ff'),
      '--sw-obj-security': lt('#7a5cc7', '#a78bfa'),
      '--sw-obj-outdoor': lt('#5c9e4f', '#7cc26e'),
      '--sw-circuit-1': lt('#2f6bff', '#6ea2ff'),
      '--sw-circuit-2': lt('#f59e0b', '#f5b043'),
      '--sw-circuit-3': lt('#22c55e', '#3ddc84'),
      '--sw-circuit-4': lt('#a855f7', '#c084fc'),
      '--sw-circuit-5': lt('#ef4444', '#ff6b62'),
      '--sw-circuit-6': lt('#14b8a6', '#2dd4bf'),
    },
  },
  {
    id: 'type',
    title: 'Typography',
    tokens: {
      '--sw-font': same('"Heebo", "Inter", "Segoe UI", -apple-system, BlinkMacSystemFont, "Noto Sans Hebrew", Roboto, Arial, sans-serif'),
      '--sw-font-mono': same('ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace'),
      // DU1 (2026-10-09): the type scale the screens snap to - 2xs captions / xs / sm / base (13: dense rows, secondary lines) / md body /
      // lg / xl / 2xl / 3xl. A screen never writes a px font size of its own; the skins re-tune the tiers.
      '--sw-fs-2xs': same('10px'),
      '--sw-fs-xs': same('11px'),
      '--sw-fs-sm': same('12.5px'),
      '--sw-fs-base': same('13px'),
      '--sw-fs-md': same('14px'),
      '--sw-fs-lg': same('15px'),
      '--sw-fs-xl': same('17px'),
      '--sw-fs-2xl': same('20px'),
      '--sw-fs-3xl': same('26px'),
      '--sw-lh': same('1.5'),
      '--sw-fw-regular': same('400'),
      '--sw-fw-medium': same('500'),
      '--sw-fw-semibold': same('600'),
      '--sw-fw-bold': same('700'),
      '--sw-h1': same('26px'),
      '--sw-h1-weight': same('700'),
      '--sw-h1-tracking': same('-0.6px'),
    },
  },
  {
    id: 'space',
    title: 'Spacing and layout',
    tokens: {
      '--sw-s-1': same('4px'),
      '--sw-s-2': same('8px'),
      '--sw-s-3': same('12px'),
      '--sw-s-4': same('16px'),
      '--sw-s-5': same('20px'),
      '--sw-s-6': same('24px'),
      '--sw-s-8': same('32px'),
      '--sw-s-10': same('40px'),
      '--sw-page-pad': same('30px'),
      '--sw-rail-w': same('70px'),
      '--sw-rail-w-wide': same('70px'),
      '--sw-topbar-h': same('0px'),
      '--sw-bottomnav-h': same('50px'),
      '--sw-drawer-w': same('360px'),
      '--sw-touch': same('36px'),
      '--sw-content-max': same('none'),
    },
  },
  {
    id: 'shape',
    title: 'Radii, elevation and glass',
    tokens: {
      // DU1 (2026-10-09): the radius scale - 2xs (small marks, thumbs) / xs (inputs, small chips, inner rows) / sm (buttons, chips, tiles) /
      // md (cards, panels) / lg (large panels) / xl (dialog, drawer) / 2xl (sheets, hero media) / pill
      '--sw-r-2xs': same('4px'),
      '--sw-r-xs': same('6px'),
      '--sw-r-sm': same('8px'),
      '--sw-r-md': same('12px'),
      '--sw-r-lg': same('14px'),
      '--sw-r-xl': same('14px'), // a dialog / large panel (new; classic = r-lg)
      '--sw-r-2xl': same('22px'),
      '--sw-r-pill': same('999px'),
      '--sw-shadow-1': lt('0 1px 2px rgba(16, 24, 40, 0.04)', '0 1px 2px rgba(0, 0, 0, 0.35)'),
      '--sw-shadow-2': lt('0 6px 18px rgba(34, 49, 76, 0.06)', '0 6px 18px rgba(0, 0, 0, 0.4)'),
      '--sw-shadow-3': lt('0 14px 36px rgba(34, 49, 76, 0.14)', '0 14px 36px rgba(0, 0, 0, 0.55)'),
      '--sw-shadow-thumb': lt('0 1px 3px rgba(0, 0, 0, 0.18)', '0 1px 3px rgba(0, 0, 0, 0.45)'),
      '--sw-glass-blur': same('none'), // backdrop-filter of a panel (L1); `none` = no glass
      '--sw-glass-blur-nav': same('none'), // rail, bottom bar, corner pill
      '--sw-glass-blur-sheet': same('none'), // dialog, drawer, popover
      '--sw-glass-sheen': same('linear-gradient(transparent, transparent)'), // light catching the top of a glass panel
    },
  },
  {
    // DU1 (2026-10-09): the states every control shares, so hover / pressed / disabled / focus / loading look the same on every
    // screen and a skin tunes them once. The classic values are the ones the shared components used as literals before.
    id: 'control',
    title: 'Controls and interaction states',
    tokens: {
      '--sw-ctl-h-sm': same('26px'), // the small button / chip / input height
      '--sw-ctl-h-md': same('30px'), // the default control height
      '--sw-ctl-h-lg': same('36px'), // the large control height (and the phone minimum before the touch rules)
      '--sw-disabled-opacity': same('0.5'), // a disabled control keeps its shape and fades
      '--sw-hover-wash': lt('rgba(20, 30, 50, 0.05)', 'rgba(255, 255, 255, 0.06)'), // a hovered row / tile on any surface
      '--sw-pressed-wash': lt('rgba(20, 30, 50, 0.09)', 'rgba(255, 255, 255, 0.1)'), // the same control while pressed
      '--sw-focus-w': same('2px'), // the focus ring (styles/focus-policy.ts reads it with a fallback)
      '--sw-focus-offset': same('2px'),
      '--sw-skeleton': lt('#eef2f8', '#222d44'), // a loading placeholder block
      '--sw-skeleton-shine': lt('rgba(255, 255, 255, 0.65)', 'rgba(255, 255, 255, 0.08)'), // the shimmer that crosses it
      '--sw-shadow-primary': lt('0 1px 2px rgba(39, 103, 237, 0.25)', '0 1px 2px rgba(0, 0, 0, 0.4)'), // the primary button's resting shadow
      // the inverted surface: toasts, the undo bar, a tooltip over the 24 h grid, the placing hint on the plan. Dark on light, a lifted
      // slate in dark (a "background: var(--sw-text); color: #fff" pair broke in dark mode: light on light)
      '--sw-toast-bg': lt('#1e2e47', '#2c3a57'),
      '--sw-toast-text': lt('#ffffff', '#f3f6fc'),
      '--sw-toast-action': lt('#8db4ff', '#9cc0ff'),
    },
  },
  {
    // DU1 (2026-10-09): what sits ON a video frame, a thumbnail or a plan image - the HUD. Video is dark in both schemes, so these are
    // the same in light and dark; a skin may soften them but never make the text dark.
    id: 'video',
    title: 'On-video HUD (same in both schemes)',
    tokens: {
      '--sw-on-video': same('#ffffff'), // text and icons over video
      '--sw-on-video-2': same('rgba(255, 255, 255, 0.72)'), // secondary text over video
      '--sw-video-scrim': same('rgba(0, 0, 0, 0.55)'), // a HUD pill's backdrop
      '--sw-video-scrim-strong': same('rgba(0, 0, 0, 0.72)'), // a HUD panel's backdrop (controls bar, the error card)
      '--sw-video-line': same('rgba(255, 255, 255, 0.18)'), // a hairline on video (tile borders, dividers in the HUD)
      '--sw-video-hover': same('rgba(255, 255, 255, 0.14)'), // a hovered HUD button
      '--sw-on-image-bg': lt('rgba(255, 255, 255, 0.92)', 'rgba(21, 28, 44, 0.88)'), // a badge sitting on a thumbnail (text = --sw-text)
    },
  },
  {
    id: 'z',
    title: 'Z-index scale (fixed by engineering)',
    tokens: {
      '--sw-z-map': same('1'),
      '--sw-z-map-ui': same('5'),
      '--sw-z-drawer': same('20'),
      '--sw-z-topbar': same('30'),
      '--sw-z-modal': same('50'),
      '--sw-z-toast': same('60'),
    },
  },
  {
    id: 'motion',
    title: 'Motion (reduced motion zeroes the durations, see css.ts)',
    tokens: {
      '--sw-t-fast': same('120ms'),
      '--sw-t-med': same('200ms'),
      '--sw-ease': same('cubic-bezier(0.2, 0, 0, 1)'),
      '--sw-ease-thumb': same('cubic-bezier(0.2, 0, 0, 1)'),
      '--sw-ease-dialog': same('cubic-bezier(0.16, 1, 0.3, 1)'), // NEW (bubble): a centred pop-up landing
      '--sw-ease-out': same('cubic-bezier(0.4, 0, 1, 1)'), // NEW (bubble): closing
      '--sw-t-sheet': same('200ms'), // NEW (bubble): the pop-up's opening spring (bubble 460 ms)
      '--sw-t-state': same('200ms'), // NEW (bubble): a state fill fading in (bubble 900 ms)
      '--sw-hover-lift': same('0px'),
    },
  },
  {
    // Bubble foundation (2026-10-02). Every name here is NEW. The base values are neutral: the classic skin draws nothing with
    // them that it did not draw before (a sheet is opaque, a pill is a plain surface, the hues are the accent). The bubble skin
    // gives them their values; a PALETTE (later phase) is a set of values for the colour names of this group and of
    // `accent` / `state` - never a rule.
    id: 'bubble',
    title: 'Pills, sheets and the look dials',
    tokens: {
      // the sheet (translucent pop-up): colour as a triplet so the transparency dial can compose the alpha
      '--sw-sheet-rgb': lt('255, 255, 255', '21, 28, 44'),
      '--sw-sheet-alpha': same('1'), // the look dial `transparency` sets this on <html> (design/look.ts); 1 = opaque
      '--sw-layer': lt('rgba(255, 255, 255, 0.55)', 'rgba(255, 255, 255, 0.08)'), // a pill sitting ON a translucent sheet
      '--sw-layer-2': lt('rgba(255, 255, 255, 0.8)', 'rgba(255, 255, 255, 0.14)'),
      '--sw-nav-glass': lt('#ffffff', '#151c2c'), // rail, tree panel, phone dock
      '--sw-backdrop-blur': same('none'), // the live page behind a sheet
      // the lite tier of the performance dial (design/look.ts PERFORMANCE_BUNDLE): `initial` = no override, the component's own blur and fill apply
      '--sw-perf-blur': same('initial'), // `none` in lite: components read var(--sw-perf-blur, blur(..)) for cards, pills, rows, chips and lists
      '--sw-perf-glass-bg': same('initial'), // lite: the sheet colour at --sw-lite-alpha, replacing a translucent glass fill
      '--sw-lite-alpha': same('0.9'), // computed from the contrast floor (design/contrast.ts liteAlpha), set on <html>
      // the "lit" fill of a light's pill and the text on it (bubble: the lamp's warm colour)
      '--sw-lit': lt('#ffc857', '#ffb547'),
      '--sw-lit-cool': lt('#ece4c9', '#e3e0cf'),
      '--sw-lit-soft': lt('rgba(255, 200, 87, 0.32)', 'rgba(255, 181, 71, 0.34)'),
      '--sw-on-lit': same('#2b1a05'),
      '--sw-fill-edge': same('transparent'), // a 3px mark at the slider fill's end; a palette sets it where fill and track are under 3:1 (design/palette.ts)
      // eight decorative hues for icon rings and the gradient surface (decoration only, never meaning); a palette replaces them
      '--sw-hue-1': lt('#7b84eb', '#7b84eb'),
      '--sw-hue-2': lt('#e8456f', '#ef3464'),
      '--sw-hue-3': lt('#2fa37c', '#34a57f'),
      '--sw-hue-4': lt('#1f6f94', '#2a7ea3'),
      '--sw-hue-5': lt('#c4508f', '#c4479a'),
      '--sw-hue-6': lt('#e07a2f', '#e8762c'),
      '--sw-hue-7': lt('#5a6fd8', '#4f68d8'),
      '--sw-hue-8': lt('#7a9a2f', '#7d9b2a'),
      '--sw-ring-on-hue': same('#ffffff'),
      // the gradient surface's washes (sw-pill): accent share at the start / end of the wash and of the lit part; a palette lowers them where its text would not read (design/palette.ts washShares)
      '--sw-wash-start': same('40%'),
      '--sw-wash-end': same('24%'),
      '--sw-wash-lit': same('70%'),
      '--sw-cool': lt('#2f8fb8', '#4aa8d8'),
      '--sw-heat': lt('#e0662f', '#ff7a45'),
      // the pill family's sizes: the density dial rewrites them (design/look.ts DENSITY bundles)
      '--sw-pill-h': same('56px'),
      '--sw-icon-ring': same('40px'),
      '--sw-sub': same('36px'),
      '--sw-fs-name': same('13px'),
      '--sw-fs-state': same('12px'),
      '--sw-gap': same('8px'),
      '--sw-gap-grid': same('14px'),
      '--sw-grid-min': same('280px'),
      '--sw-s-1h': same('6px'),
      '--sw-s-3h': same('14px'),
      '--sw-s-4h': same('18px'),
      '--sw-r-media': same('12px'), // art and video: the modest radius tier (never the pill radius)
      '--sw-tree-w': same('286px'),
      '--sw-sheet-w': same('560px'),
      '--sw-sheet-w-wide': same('760px'),
      // the look dials the components read directly (set on <html> by design/look.ts; these are the resting values)
      '--sw-look-scale': same('1'),
      '--sw-touch-desktop': same('44px'),
      // MD1 material dials (owner 2026-10-03, built from docs/design/compare/material-dials): ONE formula in styles/material.ts, driven by
      // these numbers. The presets (`material` dial, MATERIAL_BUNDLE) write them, `--sw-m-depth` and `--sw-m-tint` (the depth / tint dials)
      // multiply them. The resting values are the "none" preset with depth 0 and tint 0: every layer is invisible, today's pixels stay.
      '--sw-m-depth': same('0'), // depth dial: 0 off, 1 normal, 1.8 strong (multiplies sheen, shade, rim, lift)
      '--sw-m-tint': same('0'), // tint dial: 0 off, 1 soft, 1.8 strong (multiplies the wash; a tile sets --sw-m-on: 1 when its state carries a tone)
      '--sw-m-sheen': same('0'), // alpha of the top-left white radial
      '--sw-m-shade': same('0'), // alpha of the bottom-right dark radial
      '--sw-m-rim': same('1'), // the 1 px bevel rim (inset top highlight, inner light edge, inner dark edge)
      '--sw-m-lift': same('0.45'), // the outer drop shadow's alpha
      '--sw-m-wash': same('28%'), // the state tone's share in the 135deg wash (before the tint multiplier and the contrast cap)
      '--sw-m-wash-cap': same('50%'), // the highest wash share at which text still reads at 4.5:1 on every tone (design/contrast.ts, set on <html>)
      '--sw-m-blur': same('16px'), // the glass pill's blur in the full tier (frosted 20, paper 0, neon 14); chrome keeps --sw-glass-blur-nav
      '--sw-m-glow': same('0px'), // neon: the outer bloom's radius
      '--sw-m-glowa': same('0'), // neon: the bloom's presence (0 / 1); a tile switches it off when its tone is a state colour
      '--sw-m-grain': same('none'), // frosted: a 160 px fractal-noise SVG at ~5 % alpha
      '--sw-m-border': same('transparent'), // paper: a faint ink outline (an inset 1 px ring)
    },
  },
];

/** Every token of the product, flat. */
export const TOKENS: TokenTable = Object.assign({}, ...TOKEN_GROUPS.map((g) => g.tokens));
export const TOKEN_NAMES: string[] = Object.keys(TOKENS);
