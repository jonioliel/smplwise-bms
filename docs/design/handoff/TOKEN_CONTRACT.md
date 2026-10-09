# Token contract (designer handoff; refreshed 2026-10-09 for product 2.4.2)

> **Refresh 2026-10-09.** Rewritten from the code of `main` @ `31fe5d7c` (product 2.4.2). In 0.1.148 the tokens lived in
> `frontend/src/styles/tokens.css` (122 `--sw-*` names, light only); that file is **deleted**. Today there is ONE table of
> `{ name: { light, dark } }` in `frontend/src/design/tokens.ts` (**214** `--sw-*` names in 11 groups; **92 are NEW** since 0.1.148, none
> was removed or renamed), four skins, a light / dark / auto scheme for the whole product, ten ready palettes plus custom palettes, the
> look dials (`ui.look`), a performance tier and a material layer. The `--dv-*` glass knobs of the device screens (§4) and the
> `--lv-*` / `--nav-*` knob families (§5) did not change. Section numbers 4-8 are kept from the previous edition; §0-§3 and §9-§10 are
> new or rewritten. **The code is the source of truth**: `tokens.ts`, `skins/*.ts`, `frontend/tests/unit-design-tokens.spec.ts`.
> Hebrew authoring guide for a new skin: `docs/design/SKIN_AUTHORING_HE.md`.

## 0. The token architecture today (**NEW** since 0.1.148)

| Piece | What it is | Source |
|---|---|---|
| The table | Every colour, radius, shadow, blur, type, spacing, z-index and motion token is declared ONCE as `{ light, dark }` (`same(v)` = one value for both, `lt(l, d)` = two). Groups: `surface`, `text`, `accent`, `state`, `canvas`, `type`, `space`, `shape`, `z`, `motion`, `bubble` (§3). The values are the **classic** skin: the light column is exactly the 0.1.148 look, the dark column is the dark set of the whole shell. | `frontend/src/design/tokens.ts` |
| CSS generation | The table becomes custom properties: light on `:root`, dark on `:root[data-theme="dark"]` (and on the OS query when the scheme is `auto`), one block set per skin, `prefers-reduced-motion` zeroes the durations. | `design/css.ts` |
| Runtime | `skin` = `?skin=` (page view only) > installation `ui.skin` > `classic`. `scheme` = `?scheme=` > this browser's own choice (localStorage `sw.ui.scheme`) > installation `ui.scheme` > `light`; `auto` follows the OS live. Output: `<html data-skin="…" data-theme="light|dark">`, the token `<style>`, and the skin's component rules as ONE constructable stylesheet adopted into every Lit shadow root (replacing its text re-skins every live component without a re-render). | `design/apply.ts`, `design/boot.ts` |
| Skins | A skin = token overrides (always BOTH columns, only names that exist in `tokens.ts`) + at most **50** component rule blocks written for shadow roots (`:host(sw-card) .x { }`). Registry: `SKIN_IDS = ['classic','domus','tesla','bubble']`, `DEFAULT_SKIN = 'classic'`, `SKIN_RULE_BUDGET = 50`. A new skin = one file + one line in `skins/index.ts` + one id in the server validation of `ui.skin` (`smplwise_vms/backend/smplwise/routers/settings.py`). §9. | `design/skins/*.ts` |
| Structure per skin | A screen that changes STRUCTURE for a skin (bubble: pill rows, sheets, the phone dock) reads the skin through `SkinController` (mirrors `data-skin` onto the host) instead of CSS alone; the rule budget keeps skins to "dress what is there". | `design/skin.ts` |
| Palettes | Ten ready palettes (`calm-blue`, `purple-rose`, `teal-green`, `amber-sand`, `graphite`, `deep-ocean`, `forest`, `sunset`, `rose-quartz`, `high-contrast`) plus installation custom palettes (`custom-<slug>`), chosen by the look dial `palette` (`default` = the skin's own colours). A palette is data only: `paletteTokens()` maps it onto ~60 `--sw-*` colour names inline on `<html>`, **applied only in the bubble skin**, chosen by the installation admin only (a personal override is ignored); custom palettes up to 12 in `ui.palettes`; contrast below 4.5:1 is a warning with an auto-fix, not a refusal (owner 2026-10-02). | `design/palettes.json`, `design/palette.ts`, `screens/system-palette-editor.ts` |
| Look dials | `ui.look` (installation default, every dial present) + a personal partial override (`/me/prefs` `ui.look`) + `?look=` for the page view. Dials: `density` wide / regular / compact / row · `surface` flat / glass / gradient / fill / none · `popup` sheet / centred / inline · `radius` pill / soft / square · `slider` horizontal / vertical · `transparency` % · `scale` % · `touch` 32 / 44 · `palette` · `performance` auto / full / lite · `material` none / frosted / paper / neon · `depth` 0/1/2 · `tint` 0/1/2. Output: `data-bubble-*` attributes on `<html>` (or on a preview box) and the numeric tokens `--sw-sheet-alpha`, `--sw-look-scale`, `--sw-touch-desktop`. The bubble skin draws all dials; domus takes the material layer; classic and tesla ignore the attributes. Server twin with the same lists: `services/look.py` (422 on unknown values). | `design/look.ts`, `design/performance.ts` (§7), `styles/material.ts` (§8) |
| Contrast engine | Computes the alpha floor of translucent sheets, the lite-tier alpha and the material wash cap so every text stays ≥ 4.5:1 over the worst content behind it, per skin × scheme × palette. | `design/contrast.ts` |
| The gate | `frontend/tests/unit-design-tokens.spec.ts` (Playwright, project `desktop`): every token has light + dark and a `--sw-` name, declared once; shell colours exist for both schemes; skins are registered, overrides carry both columns and name existing tokens, rules inside the budget; look-dial defaults and bundles; sheet alpha floor; generated CSS (light / dark / OS query / per skin / reduced motion); text contrast ≥ 4.5:1 (body, secondary, tertiary, accent text, text on accent, every state text on its soft fill); performance dial and lite contrast; material dials, layer budget and wash cap. | the spec |

Per-area style layers that sit on top of the table (they read `--sw-*`, they do not declare new families): `styles/bubble-chrome.ts`
(the bubble rail, dock and tab pills), `styles/automations-glass.ts` (the automations / scenes / scripts screens), `styles/media-glass.ts`
and `styles/media-page.ts` (the multimedia area), `styles/material.ts` (§8), `components/dd-style.ts` (dropdown styles: `ui.dd_style` auto / pill / field / underline / text / prefix / tonal / capsule, plus
`ui.dd_size`, `ui.dd_ring`, `ui.dd_panel`, `ui.dd_phone`, `ui.dd_search`, `ui.dd_picker`, each with per-group overrides for home / area /
multimedia / security / settings; backend `services/dd_style.py`), `shell/tabs-mode.ts` (`ui.tabs_mode` tabs / hybrid / dropdown, per group,
every width since 0.1.157; backend `services/tabs_mode.py`), `timeline.colors` (overrides `--sw-tl-*`),
`styles/focus-policy.ts` (one focus-ring rule). All **NEW** since 0.1.148 except `focus-policy.ts` and the device-theme files.

### 0.1 Gaps of 0.1.148 and where they stand now

| Gap in 0.1.148 | Now (2.4.2) |
|---|---|
| No dark mode for the shell and 90 % of the screens | **Closed.** Every `--sw-*` token has a dark value; scheme light / dark / auto per installation and per browser. |
| Two token families (`--sw-*` and `--dv-*`) | **Open.** `--dv-*` still bridges onto `--sw-*` inside the device screens (§4); aliasing is per-screen work. |
| Touch target 36 px | **Partly.** `--sw-touch` is still 36 px in classic; `--sw-touch-desktop` (**NEW**, 44 px) is driven by the `touch` dial (32 / 44); the bubble skin sets `--sw-touch` to 44 px and sizes buttons, chips and tab rows to `--sw-touch-desktop`. The acceptance rule for a new skin is 44 px on the phone. |
| Motion: two durations, one easing | **Partly.** Added `--sw-ease-thumb`, `--sw-ease-dialog`, `--sw-ease-out`; durations still `--sw-t-fast` 120 ms / `--sw-t-med` 200 ms. Enter / exit choreography is still undesigned. |
| Glass only on the device screens | **Closed for the shell**: surfaces have `-solid` twins (`--sw-surface-solid`, `-2-solid`, `-3-solid`), glass blur tokens (`--sw-glass-blur*`), the performance tier (§7) and the material layer (§8). |
| Type scale split (`--sw-fs-*` 11–26 px vs `--dv-fs-*`) | **Partly.** Added `--sw-fs-name` 13 px and `--sw-fs-state` 12 px for tiles. `--sw-fs-xs` is still **11 px** in classic. Note: the Astra brief (2026-10-08, §6 item 4) says the smallest step is 12 px; that is true for the bubble skin's tile text, not for classic's `--sw-fs-xs` - recorded here as a contradiction for the owner, the code wins. |

## 1. Naming rules (fixed by engineering)

1. Tokens are CSS custom properties. Families: `--sw-` (product-wide, the table), `--dv-` (device-control glass knobs, §4), `--lv-tile-`
   (live overview tiles), `--nav-` (shell sizes computed from the nav-size setting), `--sw-m-*` per-element material variables (§8).
   A new product-wide token joins `--sw-` **and must be declared in `tokens.ts` first**; a skin may not invent names (the gate fails).
2. Semantic names, never colour names: `--sw-accent`, not `--sw-blue`. A state colour has a `-soft` fill and a `-text` companion.
   Exception by design: `--sw-hue-1 … -8` are decorative hues for icon rings of areas and devices (`hueOf(id)` in `design/skin.ts`) and
   never carry meaning.
3. One name, two values: **light** and **dark**, always both, also in a skin override. The switch is `<html data-theme>`; the skin is
   `<html data-skin>`.
4. Sizes in px (no rem); alphas as `rgba()`; RGB triplets only where the code composes an alpha (`--sw-sheet-rgb`, the `--dv-tile-on-*`
   glows, the `--dv-role-*` roles).
5. Logical directions only (start / end), never left / right.
6. A token that only one component reads is a **knob**; prefer a shared token when one fits.
7. A component that draws glass never writes a bare `backdrop-filter`: `var(--sw-perf-blur, blur(..))` and `var(--sw-perf-glass-bg, ..)` (§7).

## 2. Fixed by engineering (do not redesign; design around them)

| Item | Value | Why fixed |
|---|---|---|
| Breakpoints | phone `≤ 767px`, tablet `768–1023px`, desktop `≥ 1024px`; tile-layout auto switches at 600 px; Playwright viewports 1440×900 / 1024×768 / 390×844 | code, tests |
| Rail presets | s 46 px item / 18 icon / 10 label · m 52/20/10.5 · l 64/25/12 · xl 76/30/13.5; free: icon 14–40, label 0 or 9–16, item 36–96; rail width = widest label; phone bar height = item − 2, clamped 44–94 (`shell/nav-size.ts`, unchanged) | setting with server validation |
| Tab presentation | `tabs` / `dropdown` / `hybrid` per width class (**NEW**, `shell/tabs-mode.ts`, `docs/architecture/TABS_CONFIG.md`); six dropdown styles (`components/dd-style.ts`) | settings |
| Densities | `devices.density` comfortable / compact; `ui.tile_layout` auto / cards / compact; `sw-table dense`; look dial `density` wide / regular / compact / row (**NEW**) | settings |
| Layout grid (editors) | 12 columns desktop, 4 phone, rows of 8 px | stored layouts |
| Z-index scale | `--sw-z-map` 1 · `-map-ui` 5 · `-drawer` 20 · `-topbar` 30 · `-modal` 50 · `-toast` 60 (group `z`) | code |
| Time and geometry direction | LTR always (video, map, 3D, timeline, 24 h axis, week grid hours, charts of electricity and generator) | product rule |
| Glass fallback | no `backdrop-filter` support and `prefers-reduced-transparency` switch to the `-solid` surfaces, layout unchanged; lite tier (§7) | accessibility, performance |
| Reduced motion | durations become 0 (generated by `css.ts`); hover lifts off | accessibility |
| Font loading | Heebo bundled; system fonts are the fallback; licences required for any new font | performance, licence |
| Live wall counts | 1 · 2 · 4 · 6 · 8 · 9 · 12 · 16 · 20 · 25 · 32 tiles; kiosk 2×2 … 6×4 | streams budget |
| Icon set | `sw-icon` stroke set (24 px grid, 1.8 px stroke); new icons follow it (count: see `COMPONENT_INVENTORY.md`) | code |
| Contrast | ≥ 4.5:1 for every text token pair, every skin × scheme × palette (the gate) | accessibility |
| Rule budget | ≤ 50 rule blocks per skin; the material layer has its own budget (bubble, domus only) | maintainability |

## 3. `--sw-*` product tokens: the full table (classic values, light and dark)

Generated on 2026-10-09 from `frontend/src/design/tokens.ts` @ `31fe5d7c` (214 names). "= light" means the same value for both schemes.
**NEW** = absent from the 0.1.148 `tokens.css`. A new skin overrides any subset of these names, always with both columns; it may not add
names. Each skin's overrides: §9.

### Canvas and surfaces (`surface`)

| Token | Light (classic) | Dark (classic) | Since 0.1.148 |
|---|---|---|---|
| `--sw-bg` | `#f5f7fb` | `#0d1220` |  |
| `--sw-canvas` | `linear-gradient(var(--sw-bg), var(--sw-bg))` | = light | **NEW** |
| `--sw-surface` | `#ffffff` | `#151c2c` |  |
| `--sw-surface-2` | `#f7f9fc` | `#1a2336` |  |
| `--sw-surface-3` | `#eef2f8` | `#222d44` |  |
| `--sw-surface-solid` | `#ffffff` | `#151c2c` | **NEW** |
| `--sw-surface-2-solid` | `#f7f9fc` | `#1a2336` | **NEW** |
| `--sw-surface-3-solid` | `#eef2f8` | `#222d44` | **NEW** |
| `--sw-border` | `#e7ebf2` | `#232e45` |  |
| `--sw-border-strong` | `#e1e6ef` | `#2f3c58` |  |
| `--sw-highlight` | `transparent` | = light | **NEW** |
| `--sw-overlay` | `rgba(17, 24, 39, 0.45)` | `rgba(0, 0, 0, 0.62)` |  |
| `--sw-video-bg` | `#0f1729` | `#05070c` |  |

### Text (`text`)

| Token | Light (classic) | Dark (classic) | Since 0.1.148 |
|---|---|---|---|
| `--sw-text` | `#22314c` | `#e6ebf5` |  |
| `--sw-heading` | `#1e2e47` | `#f3f6fc` |  |
| `--sw-text-2` | `#5b6a85` | `#a9b4ca` |  |
| `--sw-text-3` | `#8a97ae` | `#8190aa` |  |
| `--sw-text-inverse` | `#ffffff` | = light |  |

### Accent and focus (`accent`)

| Token | Light (classic) | Dark (classic) | Since 0.1.148 |
|---|---|---|---|
| `--sw-accent` | `#2767ed` | `#3a6ce0` |  |
| `--sw-accent-hover` | `#1f57d1` | `#5a88f2` |  |
| `--sw-accent-soft` | `#edf3ff` | `rgba(91, 140, 255, 0.18)` |  |
| `--sw-accent-text` | `#2767ed` | `#8fb2ff` |  |
| `--sw-focus` | `#2767ed` | `#7aa2ff` |  |
| `--sw-nav` | `#2868ef` | `#3a6ce0` |  |

### State colours (always paired with text or a shape) (`state`)

| Token | Light (classic) | Dark (classic) | Since 0.1.148 |
|---|---|---|---|
| `--sw-live` | `#22c55e` | `#3ddc84` |  |
| `--sw-live-soft` | `#e8f8ee` | `rgba(61, 220, 132, 0.18)` |  |
| `--sw-recorded` | `#2f6bff` | `#6ea2ff` |  |
| `--sw-recorded-soft` | `#eaf0ff` | `rgba(110, 162, 255, 0.2)` |  |
| `--sw-offline` | `#9aa3b5` | `#8b96a8` |  |
| `--sw-offline-soft` | `#f1f3f7` | `rgba(139, 150, 168, 0.2)` |  |
| `--sw-stale` | `#f59e0b` | `#f5b043` |  |
| `--sw-stale-soft` | `#fff4e0` | `rgba(245, 176, 67, 0.2)` |  |
| `--sw-unknown` | `#b3bac7` | `#6b7686` |  |
| `--sw-unknown-soft` | `#f4f6f9` | `rgba(107, 118, 134, 0.22)` |  |
| `--sw-danger` | `#ef4444` | `#ff6b62` |  |
| `--sw-danger-soft` | `#fdecec` | `rgba(255, 107, 98, 0.2)` |  |
| `--sw-warning` | `#f59e0b` | `#f5b043` |  |
| `--sw-warning-soft` | `#fff4e0` | `rgba(245, 176, 67, 0.2)` |  |
| `--sw-success` | `#22c55e` | `#3ddc84` |  |
| `--sw-success-soft` | `#e8f8ee` | `rgba(61, 220, 132, 0.18)` |  |
| `--sw-forbidden` | `#dc2626` | `#ff7a70` |  |
| `--sw-forbidden-soft` | `#fdecec` | `rgba(255, 122, 112, 0.2)` |  |
| `--sw-purple` | `#8b5cf6` | `#a78bfa` |  |
| `--sw-live-text` | `#15803d` | `#3ddc84` | **NEW** |
| `--sw-recorded-text` | `#1f5ae6` | `#8fb8ff` | **NEW** |
| `--sw-offline-text` | `#6b7280` | `#b4bdcc` | **NEW** |
| `--sw-stale-text` | `#b45309` | `#f5b043` | **NEW** |
| `--sw-unknown-text` | `#6b7280` | `#aab5c9` | **NEW** |
| `--sw-danger-text` | `#b91c1c` | `#ff8a82` | **NEW** |
| `--sw-warning-text` | `#b45309` | `#f5b043` | **NEW** |
| `--sw-success-text` | `#16a34a` | `#3ddc84` | **NEW** |
| `--sw-forbidden-text` | `#b91c1c` | `#ff8a82` | **NEW** |
| `--sw-toggle-on` | `#2767ed` | `#3a6ce0` | **NEW** |
| `--sw-tl-recording` | `var(--sw-accent)` | = light | **NEW** |
| `--sw-tl-motion` | `#ef4444` | = light | **NEW** |
| `--sw-tl-person` | `#ea580c` | = light | **NEW** |
| `--sw-tl-vehicle` | `#22c55e` | = light | **NEW** |
| `--sw-tl-door` | `#8b5cf6` | = light | **NEW** |
| `--sw-tl-line` | `#f59e0b` | = light | **NEW** |
| `--sw-tl-offline` | `#6b7280` | = light | **NEW** |

### Plan, 3D and object colours (the map neutrals) (`canvas`)

| Token | Light (classic) | Dark (classic) | Since 0.1.148 |
|---|---|---|---|
| `--sw-map-bg` | `#f7f9fc` | `#0f141d` |  |
| `--sw-map-wall` | `#c5cfdd` | `#4a5568` |  |
| `--sw-map-room-fill` | `#ffffff` | `#161c28` |  |
| `--sw-map-furniture` | `#eaeff6` | `#1f2736` |  |
| `--sw-map-furniture-line` | `#d3dbe7` | `#3a4457` |  |
| `--sw-map-structure` | `#56617a` | `#9aa6bb` |  |
| `--sw-map-glass` | `#7fb2ff` | `#6ea2ff` |  |
| `--sw-map-candidate` | `#2767ed` | `#6ea2ff` |  |
| `--sw-map-label` | `#8a97ae` | `#8391a8` |  |
| `--sw-map-glow` | `#ffd166` | `#ffc857` |  |
| `--sw-map-sky` | `#dbe7f8` | `#0b1a33` |  |
| `--sw-map-sky-horizon` | `#f5f8fc` | `#1a2b47` |  |
| `--sw-map-wall-3d` | `#d7dde6` | `#2b3547` |  |
| `--sw-map-lit` | `#ffc857` | `#ffb547` |  |
| `--sw-map-presence` | `#2767ed` | `#6ea2ff` |  |
| `--sw-map-temp` | `#1e3a63` | `#cfe0ff` |  |
| `--sw-fov` | `rgba(39, 103, 237, 0.12)` | `rgba(110, 162, 255, 0.16)` |  |
| `--sw-obj-object` | `#7b8794` | `#9aa5b4` |  |
| `--sw-obj-structure` | `#4b5567` | `#aab4c5` |  |
| `--sw-obj-circulation` | `#6b7f99` | `#8fa4c2` |  |
| `--sw-obj-furniture` | `#9aa7b8` | `#7f8b9c` |  |
| `--sw-obj-light` | `#f2b544` | = light |  |
| `--sw-obj-electrical` | `#e07a2f` | `#f08a45` |  |
| `--sw-obj-safety` | `#e0443c` | `#ff6b62` |  |
| `--sw-obj-medical` | `#2fa7b3` | `#4fc3ce` |  |
| `--sw-obj-sport` | `#3fa25b` | `#5cc47a` |  |
| `--sw-obj-sanitary` | `#5b9bd5` | `#7fb2ff` |  |
| `--sw-obj-security` | `#7a5cc7` | `#a78bfa` |  |
| `--sw-obj-outdoor` | `#5c9e4f` | `#7cc26e` |  |
| `--sw-circuit-1` | `#2f6bff` | `#6ea2ff` |  |
| `--sw-circuit-2` | `#f59e0b` | `#f5b043` |  |
| `--sw-circuit-3` | `#22c55e` | `#3ddc84` |  |
| `--sw-circuit-4` | `#a855f7` | `#c084fc` |  |
| `--sw-circuit-5` | `#ef4444` | `#ff6b62` |  |
| `--sw-circuit-6` | `#14b8a6` | `#2dd4bf` |  |

### Typography (`type`)

| Token | Light (classic) | Dark (classic) | Since 0.1.148 |
|---|---|---|---|
| `--sw-font` | `"Heebo", "Inter", "Segoe UI", -apple-system, BlinkMacSystemFont, "Noto Sans Hebrew", Roboto, Arial, sans-serif` | = light |  |
| `--sw-font-mono` | `ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace` | = light |  |
| `--sw-fs-xs` | `11px` | = light |  |
| `--sw-fs-sm` | `12.5px` | = light |  |
| `--sw-fs-md` | `14px` | = light |  |
| `--sw-fs-lg` | `15px` | = light |  |
| `--sw-fs-xl` | `17px` | = light |  |
| `--sw-fs-2xl` | `20px` | = light |  |
| `--sw-fs-3xl` | `26px` | = light |  |
| `--sw-lh` | `1.5` | = light |  |
| `--sw-fw-regular` | `400` | = light |  |
| `--sw-fw-medium` | `500` | = light |  |
| `--sw-fw-semibold` | `600` | = light |  |
| `--sw-fw-bold` | `700` | = light |  |
| `--sw-h1` | `26px` | = light |  |
| `--sw-h1-weight` | `700` | = light |  |
| `--sw-h1-tracking` | `-0.6px` | = light |  |

### Spacing and layout (`space`)

| Token | Light (classic) | Dark (classic) | Since 0.1.148 |
|---|---|---|---|
| `--sw-s-1` | `4px` | = light |  |
| `--sw-s-2` | `8px` | = light |  |
| `--sw-s-3` | `12px` | = light |  |
| `--sw-s-4` | `16px` | = light |  |
| `--sw-s-5` | `20px` | = light |  |
| `--sw-s-6` | `24px` | = light |  |
| `--sw-s-8` | `32px` | = light |  |
| `--sw-s-10` | `40px` | = light |  |
| `--sw-page-pad` | `30px` | = light |  |
| `--sw-rail-w` | `70px` | = light |  |
| `--sw-rail-w-wide` | `70px` | = light |  |
| `--sw-topbar-h` | `0px` | = light |  |
| `--sw-bottomnav-h` | `50px` | = light |  |
| `--sw-drawer-w` | `360px` | = light |  |
| `--sw-touch` | `36px` | = light |  |
| `--sw-content-max` | `none` | = light |  |

### Radii, elevation and glass (`shape`)

| Token | Light (classic) | Dark (classic) | Since 0.1.148 |
|---|---|---|---|
| `--sw-r-sm` | `8px` | = light |  |
| `--sw-r-md` | `12px` | = light |  |
| `--sw-r-lg` | `14px` | = light |  |
| `--sw-r-xl` | `14px` | = light | **NEW** |
| `--sw-r-pill` | `999px` | = light |  |
| `--sw-shadow-1` | `0 1px 2px rgba(16, 24, 40, 0.04)` | `0 1px 2px rgba(0, 0, 0, 0.35)` |  |
| `--sw-shadow-2` | `0 6px 18px rgba(34, 49, 76, 0.06)` | `0 6px 18px rgba(0, 0, 0, 0.4)` |  |
| `--sw-shadow-3` | `0 14px 36px rgba(34, 49, 76, 0.14)` | `0 14px 36px rgba(0, 0, 0, 0.55)` |  |
| `--sw-shadow-thumb` | `0 1px 3px rgba(0, 0, 0, 0.18)` | `0 1px 3px rgba(0, 0, 0, 0.45)` | **NEW** |
| `--sw-glass-blur` | `none` | = light | **NEW** |
| `--sw-glass-blur-nav` | `none` | = light | **NEW** |
| `--sw-glass-blur-sheet` | `none` | = light | **NEW** |
| `--sw-glass-sheen` | `linear-gradient(transparent, transparent)` | = light | **NEW** |

### Z-index scale (fixed by engineering) (`z`)

| Token | Light (classic) | Dark (classic) | Since 0.1.148 |
|---|---|---|---|
| `--sw-z-map` | `1` | = light |  |
| `--sw-z-map-ui` | `5` | = light |  |
| `--sw-z-drawer` | `20` | = light |  |
| `--sw-z-topbar` | `30` | = light |  |
| `--sw-z-modal` | `50` | = light |  |
| `--sw-z-toast` | `60` | = light |  |

### Motion (reduced motion zeroes the durations, see css.ts) (`motion`)

| Token | Light (classic) | Dark (classic) | Since 0.1.148 |
|---|---|---|---|
| `--sw-t-fast` | `120ms` | = light |  |
| `--sw-t-med` | `200ms` | = light |  |
| `--sw-ease` | `cubic-bezier(0.2, 0, 0, 1)` | = light |  |
| `--sw-ease-thumb` | `cubic-bezier(0.2, 0, 0, 1)` | = light | **NEW** |
| `--sw-ease-dialog` | `cubic-bezier(0.16, 1, 0.3, 1)` | = light | **NEW** |
| `--sw-ease-out` | `cubic-bezier(0.4, 0, 1, 1)` | = light | **NEW** |
| `--sw-t-sheet` | `200ms` | = light | **NEW** |
| `--sw-t-state` | `200ms` | = light | **NEW** |
| `--sw-hover-lift` | `0px` | = light | **NEW** |

### Pills, sheets and the look dials (`bubble`)

| Token | Light (classic) | Dark (classic) | Since 0.1.148 |
|---|---|---|---|
| `--sw-sheet-rgb` | `255, 255, 255` | `21, 28, 44` | **NEW** |
| `--sw-sheet-alpha` | `1` | = light | **NEW** |
| `--sw-layer` | `rgba(255, 255, 255, 0.55)` | `rgba(255, 255, 255, 0.08)` | **NEW** |
| `--sw-layer-2` | `rgba(255, 255, 255, 0.8)` | `rgba(255, 255, 255, 0.14)` | **NEW** |
| `--sw-nav-glass` | `#ffffff` | `#151c2c` | **NEW** |
| `--sw-backdrop-blur` | `none` | = light | **NEW** |
| `--sw-perf-blur` | `initial` | = light | **NEW** |
| `--sw-perf-glass-bg` | `initial` | = light | **NEW** |
| `--sw-lite-alpha` | `0.9` | = light | **NEW** |
| `--sw-lit` | `#ffc857` | `#ffb547` | **NEW** |
| `--sw-lit-cool` | `#ece4c9` | `#e3e0cf` | **NEW** |
| `--sw-lit-soft` | `rgba(255, 200, 87, 0.32)` | `rgba(255, 181, 71, 0.34)` | **NEW** |
| `--sw-on-lit` | `#2b1a05` | = light | **NEW** |
| `--sw-fill-edge` | `transparent` | = light | **NEW** |
| `--sw-hue-1` | `#7b84eb` | = light | **NEW** |
| `--sw-hue-2` | `#e8456f` | `#ef3464` | **NEW** |
| `--sw-hue-3` | `#2fa37c` | `#34a57f` | **NEW** |
| `--sw-hue-4` | `#1f6f94` | `#2a7ea3` | **NEW** |
| `--sw-hue-5` | `#c4508f` | `#c4479a` | **NEW** |
| `--sw-hue-6` | `#e07a2f` | `#e8762c` | **NEW** |
| `--sw-hue-7` | `#5a6fd8` | `#4f68d8` | **NEW** |
| `--sw-hue-8` | `#7a9a2f` | `#7d9b2a` | **NEW** |
| `--sw-ring-on-hue` | `#ffffff` | = light | **NEW** |
| `--sw-wash-start` | `40%` | = light | **NEW** |
| `--sw-wash-end` | `24%` | = light | **NEW** |
| `--sw-wash-lit` | `70%` | = light | **NEW** |
| `--sw-cool` | `#2f8fb8` | `#4aa8d8` | **NEW** |
| `--sw-heat` | `#e0662f` | `#ff7a45` | **NEW** |
| `--sw-pill-h` | `56px` | = light | **NEW** |
| `--sw-icon-ring` | `40px` | = light | **NEW** |
| `--sw-sub` | `36px` | = light | **NEW** |
| `--sw-fs-name` | `13px` | = light | **NEW** |
| `--sw-fs-state` | `12px` | = light | **NEW** |
| `--sw-gap` | `8px` | = light | **NEW** |
| `--sw-gap-grid` | `14px` | = light | **NEW** |
| `--sw-grid-min` | `280px` | = light | **NEW** |
| `--sw-s-1h` | `6px` | = light | **NEW** |
| `--sw-s-3h` | `14px` | = light | **NEW** |
| `--sw-s-4h` | `18px` | = light | **NEW** |
| `--sw-r-media` | `12px` | = light | **NEW** |
| `--sw-tree-w` | `286px` | = light | **NEW** |
| `--sw-sheet-w` | `560px` | = light | **NEW** |
| `--sw-sheet-w-wide` | `760px` | = light | **NEW** |
| `--sw-look-scale` | `1` | = light | **NEW** |
| `--sw-touch-desktop` | `44px` | = light | **NEW** |
| `--sw-m-depth` | `0` | = light | **NEW** |
| `--sw-m-tint` | `0` | = light | **NEW** |
| `--sw-m-sheen` | `0` | = light | **NEW** |
| `--sw-m-shade` | `0` | = light | **NEW** |
| `--sw-m-rim` | `1` | = light | **NEW** |
| `--sw-m-lift` | `0.45` | = light | **NEW** |
| `--sw-m-wash` | `28%` | = light | **NEW** |
| `--sw-m-wash-cap` | `50%` | = light | **NEW** |
| `--sw-m-blur` | `16px` | = light | **NEW** |
| `--sw-m-glow` | `0px` | = light | **NEW** |
| `--sw-m-glowa` | `0` | = light | **NEW** |
| `--sw-m-grain` | `none` | = light | **NEW** |
| `--sw-m-border` | `transparent` | = light | **NEW** |


Removed or renamed since 0.1.148: **none** (all 122 names of the old `tokens.css` are still in the table with the same light value).

## 4. `--dv-*` glass knobs (device screens): current default palette, light / dark (unchanged since 0.1.148)

87 named knobs plus 21 role knobs. The light block is the default; the dark block lists only what differs (the rest inherits light); the
phone block changes sizes only. Four palettes exist (`default` blue, `sand`, `forest`, `graphite`), each light + dark, in
`devices-palettes.ts`. The designer delivers at least the **default** palette in the new direction; other palettes are optional.

### 4.1 Material and surfaces

| Knob | Light | Dark |
|---|---|---|
| `--dv-color-scheme` | `light` | `dark` |
| `--dv-backdrop` | amber + blue radial gradients over `#eef2f9` | the same gradients over `#0a0a0c` |
| `--dv-surface` | `rgba(255,255,255,.64)` | `rgba(28,28,30,.72)` |
| `--dv-surface-2` | `rgba(255,255,255,.5)` | `rgba(44,44,46,.62)` |
| `--dv-surface-3` | `rgba(120,120,128,.14)` | `rgba(235,235,245,.14)` |
| `--dv-surface-solid` / `--dv-surface-2-solid` | `#fbfcfe` / `#f2f5fa` | `#1c1c1e` / `#2c2c2e` |
| `--dv-surface-blur` | `blur(28px) saturate(1.7)` | same |
| `--dv-border` / `--dv-border-strong` | `rgba(60,60,67,.12)` / `.22` | `rgba(255,255,255,.13)` / `.24` |
| `--dv-overlay` | `rgba(15,23,42,.38)` | `rgba(0,0,0,.55)` |

### 4.2 Text, accent, states

| Knob | Light | Dark |
|---|---|---|
| `--dv-font` | `-apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', 'Noto Sans Hebrew', 'Heebo', Roboto, Arial, sans-serif` | same |
| `--dv-text` / `-2` / `-3` | `#1c1c1e` / `#4c4c50` / `#6e6e73` | `#f5f5f7` / `rgba(235,235,245,.72)` / `.56` |
| `--dv-accent` / `-hover` / `-soft` / `-text` | `#007aff` / `#0066d6` / `rgba(0,122,255,.13)` / `#0062cc` | `#0a84ff` / `#409cff` / `rgba(10,132,255,.26)` / `#64d2ff` |
| `--dv-focus` | `#007aff` | `#64d2ff` |
| `--dv-success` / `-soft` | `#34c759` / `rgba(52,199,89,.16)` | `#30d158` / `.2` |
| `--dv-warning` / `-soft` | `#ff9f0a` / `rgba(255,159,10,.16)` | same / `.2` |
| `--dv-danger` / `-soft` | `#d70015` / `rgba(255,59,48,.13)` | `#ff453a` / `rgba(255,69,58,.2)` |
| `--dv-neutral-soft` | `rgba(120,120,128,.14)` | `rgba(142,142,147,.2)` |
| `--dv-offline` | `#8e8e93` | same |
| `--dv-toggle-on` | `#34c759` | `#30d158` |

### 4.3 Shape, depth, motion

| Knob | Value |
|---|---|
| `--dv-radius-sm` / `-md` / `-lg` / `-control` | 14 px (tiles, rows, inputs) / 22 px (panels) / 28 px (dialog) / 999 px (pills) |
| `--dv-shadow-1` | light `0 10px 30px rgba(31,45,80,.1), inset 0 1px 0 rgba(255,255,255,.65)`; dark `0 18px 48px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.08)` |
| `--dv-shadow-2` | light `0 18px 44px rgba(31,45,80,.16)` + top highlight; dark `0 22px 60px rgba(0,0,0,.5)` + highlight |
| `--dv-shadow-3` | light `0 24px 64px rgba(15,23,42,.26)`; dark `0 26px 70px rgba(0,0,0,.6)` |
| `--dv-shadow-control` | light `0 1px 4px rgba(0,0,0,.18)`; dark `.35` |
| `--dv-hover-lift` | `-2px` (only with motion allowed) |

### 4.4 "On" glows, icon rings, typography, sizes

| Knob | Light / default (phone) | Dark |
|---|---|---|
| `--dv-tile-on-warm` / `-cool` / `-switch` (RGB triplets) | `255 159 10` / `61 90 254` / `52 199 89` | same |
| `--dv-glow-fill-start` / `-end` / `--dv-glow-border` / `--dv-glow-halo` (alphas) | `.3` / `.07` / `.4` / `.22` | same |
| `--dv-icon-ring-size` / `-size-lg` / `-pad` | 36 / 40 / 9 px | same |
| `--dv-icon-ring-bg` / `-on-bg` / `-fg` | `rgba(120,120,128,.14)` / `rgba(255,255,255,.34)` / `#1c1c1e` | `rgba(235,235,245,.12)` / `rgba(255,255,255,.18)` / `#f5f5f7` |
| `--dv-card-badge-size` | 34 px | |
| `--dv-fs-title` / `--dv-fw-title` | 16 px / 700 | |
| `--dv-fs-tile-name` / `--dv-fs-item-name` / `--dv-fs-value-big` | 14 / 12.5 / 24 px | |
| `--dv-gap-lg` / `--dv-gap` / `--dv-gap-sm` | 18 (12) / 14 (10) / 10 px | |
| `--dv-card-pad-block` / `-inline` | 18 / 20 px (14 / 14) | |
| `--dv-item-pad-block` / `-inline` | 12 / 14 px | |
| `--dv-tile-pad-block` / `-inline` | 16 / 18 px (12 / 14) | |
| `--dv-tile-min-block` / `--dv-item-min-block` | 116 (100) / 64 px | |
| `--dv-area-tile-min` / `--dv-floor-card-min` / `--dv-area-card-min` / `--dv-entity-tile-min` | 210 (150) / 360 / 320 / 220 px | |
| `--dv-tree-inline` / `--dv-tree-inline-max` / `--dv-tree-count-w` / `--dv-tree-menu-w` | 270 / 340 / 44 / 30 px | |
| `--dv-kpi-compact-min-block` / `-pad-block` / `-pad-inline` / `-gap` / `-icon` / `-value-fs` / `-col-min` / `-cols-phone` / `-grid-gap` | 60 / 8 / 12 / 10 / 32 / 17 / 168 px / 2 / 8 px | |

### 4.5 Card-colour roles (both styles; the only colours the layout editor offers)

`--dv-role-<role>-bg`, `--dv-role-<role>-border`, `--dv-role-<role>-fg` for `accent`, `warm`, `cool`, `success`, `warning`, `danger`,
`neutral`. A role is an RGB triplet per palette and scheme; the fill is 14 % (dark 26 %), the border 50 % (dark 60 %).

| Role | Light rgb / fg | Dark rgb / fg |
|---|---|---|
| accent | `0 122 255` / `#0062cc` | `10 132 255` / `#64d2ff` |
| warm | `255 149 0` / `#a35a00` | `255 159 10` / `#ffc46b` |
| cool | `50 173 230` / `#0b6a91` | `100 210 255` / `#9be3ff` |
| success | `52 199 89` / `#1d7a37` | `48 209 88` / `#7ee29a` |
| warning | `230 180 0` / `#7d5f00` | `255 214 10` / `#ffe066` |
| danger | `255 59 48` / `#c0170f` | `255 69 58` / `#ff8a80` |
| neutral | `120 120 128` / `#3a3a3c` | `142 142 147` / `#d1d1d6` |

## 5. Other knob families (unchanged since 0.1.148; the NEW media / automations knob families are in §9)

| Family | Names | Where |
|---|---|---|
| `--lv-tile-compact-*` (9) | `min-block`, `pad-block`, `pad-inline`, `gap`, `icon`, `value-fs`, `col-min`, `cols-phone`, `grid-gap` | live overview tiles (`tile-knobs.ts`), same roles as `--dv-kpi-compact-*` |
| `--sw-kpi-compact-*` (7) | `min-block`, `pad-block`, `pad-inline`, `gap`, `icon`, `value-fs`, plus grid knobs on the screen | what `sw-kpi` reads (bridged from the two families above) |
| `--nav-*` (10) | `icon`, `label`, `item-h`, `item-w`, `avatar`, `bar-h`, `p-label`, `pill-w`, `pill-h` (+ `p-icon`) | computed by `nav-size.ts`; not designed as values, but the design's rail geometry must map onto them |
| `--sw-tab-min-h`, `--sw-drawer-modal-w`, `--sw-icon-size` | component-local | `sw-tabs`, `sw-drawer`, `sw-icon` |

## 6. What the design must deliver, token by token (0.1.148 brief; for the Astra round see §10)

1. **Colour, light + dark**, for every `--sw-*` colour (§3) and every `--dv-*` colour knob (§4), or - preferred - ONE semantic palette
   with a mapping table "new name → old names" so engineering can alias both families. Contrast: body text ≥ 4.5:1 on its surface,
   large text and icons ≥ 3:1, state colours distinguishable and always paired with text or shape.
2. **Type scale**: family (Hebrew-first; Heebo or a proposal with a licence note), sizes and weights for H1 / H2 / section title / body /
   caption / tabular numbers / big readings (temperature, clock), line heights, letter-spacing for large titles; the mapping onto
   `--sw-fs-xs..3xl`, `--sw-h1*`, `--dv-fs-*`.
3. **Radii** (small control / tile / panel / dialog / pill) with the mapping onto `--sw-r-*` and `--dv-radius-*`.
4. **Elevation**: 3 shadow levels + the control thumb shadow, light and dark, with the glass top highlight if used.
5. **Glass material**: blur, saturation, surface alphas for 3 surface levels, the solid fallback of each, borders / hairlines on glass,
   the overlay scrim; nested-glass rule (blur off inside blur).
6. **Motion**: durations and easings for fast / medium / slow, enter / exit of drawer, sheet, dialog, popover, tab thumb, toggle, tile
   glow, list reorder; hover lift; the reduced-motion behaviour (everything instant).
7. **Focus ring**: colour, width, offset, radius rule, on light / dark / glass / over video.
8. **Targets and densities**: minimum target 44 px for operator controls (visual size may be smaller with padding), comfortable /
   compact densities for tiles and rows.
9. **Layout constants**: rail geometry for the four presets, phone bar height, drawer width, page padding per viewport, content max
   width (today none), gaps.
10. **Canvas colours** for the plan (walls, rooms, furniture, labels, FOV, candidate, glass, glow, lit, presence, temperature chip),
    the 3D sky and wall, the 12 object classes and 6 circuit colours - light and dark.
11. **Export**: a JSON (`{ "name": { "light": v, "dark": v } }`) and a CSS-variables file for light and for dark, using the names of
    this document or the mapping table of item 1.

## 7. Performance tier (added 2026-10-02, bubble skin, branch `pilot/bubble-performance`)

Wall tablets and weak phones must not pay for `backdrop-filter` on cards, pills, rows and scrolling lists. The look dial
`performance` switches those surfaces between two tiers, **full** (the glass as designed) and **lite** (no blur, a near-solid tinted
fill). A skin or a component that draws glass reads the switches below instead of hard-coding a blur. Sources:
`frontend/src/design/performance.ts` (how `auto` decides), `design/look.ts` (the dial, `PERFORMANCE_BUNDLE`), `design/contrast.ts`
(the lite alpha), `design/tokens.ts` (the defaults).

### 7.1 Tokens

| Token | Full | Lite | Meaning |
|---|---|---|---|
| `--sw-perf-blur` | `initial` | `none` | A switch, not a design value. A component writes `backdrop-filter: var(--sw-perf-blur, blur(16px) saturate(150%))` (and the `-webkit-` twin): in full the variable is the guaranteed-invalid value `initial`, so the fallback (the component's own blur) applies; in lite it is `none`. |
| `--sw-perf-glass-bg` | `initial` | `rgba(var(--sw-sheet-rgb), var(--sw-lite-alpha))` | The translucent fill that replaces a glass fill in lite: `background: var(--sw-perf-glass-bg, <own translucent fill>)`. It is the sheet colour at the lite alpha, so it follows light / dark. |
| `--sw-lite-alpha` | `0.9` (token default) | computed | The alpha of the lite fill. Set on `<html>` (and on a settings preview box) by `applyLook()`: `max(LITE_MIN_ALPHA = 0.86, liteAlphaFloor)`. |

Both `--sw-perf-*` tokens are the same in light and dark (`same('initial')` in `tokens.ts`); the dark/light difference comes from
`--sw-sheet-rgb`. Rule for designers: **never write a bare `backdrop-filter: blur(..)` on a card, pill, row, chip or list** - wrap it in
`var(--sw-perf-blur, ..)`, and give a translucent fill a `var(--sw-perf-glass-bg, ..)` wrapper, or the lite tier will not reach it.

How the lite alpha is computed (`contrast.ts`): without a blur nothing averages what is behind the layer, and there is no dimming
scrim under it, so the worst case is a single extreme pixel. `liteLayerModel` takes the sheet model (sheet colour, texts
`--sw-text` / `--sw-text-2` / `--sw-heading`, backdrops `--sw-bg`, `--sw-lit`, `--sw-accent`, `--sw-hue-2`, `--sw-surface`, white and
near-black), removes the overlay and adds pure red, blue, green and yellow as candidates behind. `liteAlphaFloor` is the lowest alpha at
which every text still reads at WCAG 4.5:1 over every candidate; `liteAlpha` = `max(0.86, floor)`, so lite is always near-solid.

### 7.2 The attribute

`<html data-bubble-performance="full|lite">` is the resolved tier (never `auto`). `design/look.ts` writes it in `applyLook()`, and a
settings preview box carries its own attribute (`lookAttributes`), so one page can show both tiers. The bundle is emitted as CSS for
the bubble skin only: `:root[data-skin="bubble"][data-bubble-performance="lite"], :root[data-skin="bubble"] [data-bubble-performance="lite"] { ... }`
(`lookBundlesCss`); the `full` bundle resets both tokens to `initial` so a lite page does not leak into a full preview inside it.

Not switched by the tier (they keep their blur in lite): the dock, rail and tree (`--sw-glass-blur-nav`), the sheet scrim
(`--sw-backdrop-blur`) and the open pop-up (`--sw-glass-blur-sheet`).

### 7.3 The dial `ui.look.performance`

`auto` (default) | `full` | `lite`, part of the `ui.look` value: set for the installation (`ui.look` setting, every dial present) and
optionally overridden per user (`ui.look` in my prefs, a partial object). Labels: auto "אוטומטי", full "מלא", lite "קל". The backend
validates it (`services/look.py`, unknown values refused); presentation only, no permission depends on it. `full` and `lite` are taken
as chosen; `auto` is resolved on the device by `performance.ts`.

### 7.4 How `auto` decides (client side, `design/performance.ts`)

1. **Weak-signal check** (synchronous, free; the first match wins, no probe): `prefers-reduced-transparency`, `prefers-reduced-motion`,
   `hardwareConcurrency <= 4`, `deviceMemory <= 2` GB (when the browser reports it). Any one => lite.
2. **Cached verdict**: otherwise the stored verdict is used if it is fresh and belongs to this device class (below).
3. **Probe**: with nothing cached the page starts as full and, once per page view at idle (after load), measures ~700 ms of
   `requestAnimationFrame` with a nearly invisible blurred test layer over a moving backdrop. The first 3 frames are dropped; fewer than 12
   usable frames (hidden or throttled tab) is no verdict and nothing is cached; a median frame interval above 24 ms (under about 42 fps)
   => lite, else full. The verdict is cached and the look is re-applied, so a probed-lite device flips once and then starts lite on every load.

Cache key: **`sw.ui.performance`** in `localStorage`, value `{ tier, sig, at }`; `sig` = `cores/memoryGb/devicePixelRatio` (a different
device class invalidates it), valid for 30 days (and not dated in the future). Storage that is unavailable only means the verdict lasts
for the page view. Thresholds live in `PERF_THRESHOLDS`; they are engineering values, not design values.

## 8. Material layer (added 2026-10-03, MD1 phase 2, branch `pilot/material-dials-build`)

Built from the approved mockups `docs/design/compare/material-dials` (owner decision: everything except the Chalk preset). One
formula (`frontend/src/styles/material.ts`) appended to the sheets of the glass-capable skins (bubble, domus); the numbers are tokens,
the dials `material` / `depth` / `tint` of `ui.look` write and multiply them. Defaults OFF: every layer transparent, every shadow at alpha
0, the 0.1.156 pixels unchanged. Hebrew detail and the preset table: `docs/design/SKIN_AUTHORING_HE.md` §6ב.

### 8.1 Tokens (`design/tokens.ts`, bubble group; resting value = the `none` preset at depth 0 / tint 0)

| Token | Resting | Written by | Meaning |
|---|---|---|---|
| `--sw-m-depth` | `0` | depth dial (`0` / `1` / `1.8`) | multiplies sheen, shade, rim, lift |
| `--sw-m-tint` | `0` | tint dial (`0` / `1` / `1.8`) | multiplies the wash (x the tile's own `--sw-m-on`) |
| `--sw-m-sheen` / `--sw-m-shade` | `0` / `0` | preset | alpha of the top-left white / bottom-right dark radial |
| `--sw-m-rim` | `1` | preset | the 1 px bevel (inset top highlight .22, inner light edge .5, inner dark edge .12, each x rim x depth) |
| `--sw-m-lift` | `0.45` | preset | alpha of the outer drop shadow `0 10px 30px -16px` |
| `--sw-m-wash` | `28%` | preset | the tone's share at the start of the 135deg wash |
| `--sw-m-wash-cap` | `50%` | `applyLook()` (computed, `design/contrast.ts washCap`) | the highest share at which text and muted text keep 4.5:1 on every tone over the surface; the wash is `min(wash x tint, cap)` |
| `--sw-m-blur` | `16px` | preset | the glass pill's full-tier blur radius (frosted 20, paper 0, neon 14); never applied in lite |
| `--sw-m-glow` / `--sw-m-glowa` | `0px` / `0` | preset (neon 16px / 1) | the bloom's radius / presence |
| `--sw-m-grain` | `none` | preset (frosted: an SVG data URI) | 160 px fractal noise at ~5 % alpha |
| `--sw-m-border` | `transparent` | preset (paper: text at 10 %) | an inset 1 px ink ring |

Per element, not tokens: `--sw-m-tone` (the tile's state tone), `--sw-m-on` (1 when the state carries a tone, else unset), `--sw-m-glow-on`
and `--sw-m-glow-c` (set by the material rules only for decorative tones: never a state colour, never in a list).

### 8.2 Attributes and the dial

`<html data-bubble-material="none|frosted|paper|neon" data-bubble-depth="0|1|2" data-bubble-tint="0|1|2">`, written by `applyLook()`;
a settings preview box carries the same attributes and the numbers inline (`lookAttributes`). The bundles are emitted for
`:root[data-skin="bubble"]` and `:root[data-skin="domus"]` (`lookBundlesCss`). `ui.look.depth`, `ui.look.tint`, `ui.look.material`: part of
the `ui.look` value (installation default, every dial present; personal partial override in `/me/prefs`); validated by `services/look.py`
(`0 | 1 | 2`, `none | frosted | paper | neon`; unknown values 422). A preset chosen in the settings card is a macro (`materialMacro`): it
also writes depth 1 and tint 1 when they were off and the suggested transparency (frosted 62, paper 96, neon 56); the stored value is
the preset's name only.

### 8.3 Rules for designers

- Add a material host by adding its selector to `styles/material.ts` (bubble or domus list), never by writing the layers by hand.
- A new tile with a state tone sets `--sw-m-tone` and `--sw-m-on: 1` for the toned states only; the word and the dot stay.
- Lists take the tone in the side stripe, tables nothing; the chrome takes the rim and the lift only.
- No bare `backdrop-filter` (§7); the material never adds one.

## 9. The skins (**NEW** since 0.1.148)

Counts measured on 2026-10-09 (`'--sw-…':` keys in the file; rule blocks with the gate's `ruleCount`, `/\{[^{}]*\}/`).

| Skin | Names | Overrides / rules | What it changes | Dials that apply | Default |
|---|---|---|---|---|---|
| `classic` | Classic / קלאסי, "המראה הנוכחי של המערכת" | 0 / 0 | Nothing: the table as is (pixel-stable, `evidence-design-foundation.spec.ts`), with the dark column | none (no look dials, no palettes, no material) | **yes** (`DEFAULT_SKIN`, server default `ui.skin=classic`) |
| `domus` | hi-tech Domus / הייטק Domus, "זכוכית על רקע צבעוני, פינות עגולות, כותרות גדולות" | 98 / 28 | Canvas with warm and cool blooms, translucent surfaces, accent `#2a63f0` / `#6ea2ff`, H1 44 px (−1 px tracking), radii 10/16/24/28, two-layer shadows, glass blur 24 / nav 20 / sheet 32 with a sheen, hover lift −2 px, green toggle; rules: floating glass rail, glass cards / KPI / tiles / tree, pill tree rows, soft buttons, opaque floating layers | material / depth / tint (§8) | no |
| `tesla` | Tesla clean hi-tech / הייטק נקי (Tesla), "משטחים שטוחים, קווי 1px, פינות חדות, מבטא אחד" | 99 / 33 | Flat opaque surfaces (bg `#fff` / `#000`), one cold accent, larger type (xs 12 … 3xl 30, H1 48 / 500), radii 4/6/8, pill 6, no shadows, faster motion; rules: hairline rail, outlined controls, inverted segmented control, ruled tables with uppercase headings | none | no |
| `bubble` | Bubble, "חלונות קופצים שקופים, כמוסות, פס צף בטלפון; צפיפות, משטח ופינות לבחירה" | 84 / **49** (budget 50) | Approved from `docs/design/mockups/bubble-taste`: tinted canvas with two blooms, borderless, fs-xs 12 / sm 13, H1 24, rail 92 px, `--sw-touch` 44, radii 12/18/28/42, flat cards, blurred nav / sheet / backdrop, slower springy motion (sheet 460 ms, state 900 ms); rules: rail, phone dock, tree, cards and controls at `--sw-touch-desktop`, translucent sheets with `@supports` / reduced-transparency fallbacks, tab pair, dropdown chip / pop, security sections pill track. Screens also restructure for it (`SkinController`): home, area, multimedia, and the chrome of ~48 list / settings screens via `styles/bubble-chrome.ts` | **every** look dial, palettes, performance tier, material | no |

Selection: `ui.skin` (installation, `system.configure`, הגדרות › כללי › מראה המערכת, `screens/system-design.ts` / `system-look.ts`) or
`?skin=` for one page view. Scheme: `ui.scheme` light / dark / auto plus the browser's own choice.

Device screens: the `--dv-*` glass (§4) is still selected separately by `devices.style` smplwise (default) / glass, `devices.theme`
default / sand / forest / graphite, `devices.scheme` light / dark / auto, `devices.density` (unchanged since 0.1.148). **CHANGED in effect:**
the multimedia and automations areas are always glass (they read `--dv-*` and `devices.scheme` whatever `devices.style` says); in the
bubble skin `mediaBubbleKnobs` undoes that bridge and they follow the skin's tokens and `data-theme`. Their local knob families
(`--mm-*` ≈33 in `styles/media-glass.ts` `MEDIA_KNOBS`, `--mr-*` ≈40 in `components/media-remote-css.ts`, `--au-*` 4 in
`styles/automations-glass.ts`) are **NEW** and are knobs, not contract tokens. Other screen-local prefixes (`--nt-`, `--sc-`, `--ab-`,
`--gen-`, `--dvb-`, `--lay-`, `--pill-`, `--wall-`, `--sev-`, `--al-`) exist; whether they are stable is **UNKNOWN** - a skin must not
target them.

Not in the table yet (planned in the 0.1.148 package, still absent): `--sw-role-*`, `--sw-on-*`, `--sw-glow-*`.

## 10. What a new skin must come back with (supersedes §6 for the Astra round)

The format the Astra brief asks for (`astra/ASTRA_DESIGN_BRIEF_2026-10-08_HE.md` §5-§6), restated against the code:

1. `skins/<id>.ts` in the shape of `tesla.ts` / `bubble.ts`: `id`, `name`, `nameHe`, `noteHe`, `tokens` (any subset of the 214 names of §3,
   each with `light` AND `dark`), `rules` (≤ 50 blocks, shadow-root selectors `:host(sw-x) …`, only `var(--sw-*)` - no literal colour,
   radius, shadow or size).
2. `tokens.json` mirror `{ name: { light, dark } }` and a contrast report: every pair the gate checks (text, text-2, text-3, accent-text,
   heading on `surface-solid`, `surface-2-solid` and `bg`; text-inverse on accent; every state `-text` on its `-soft`) ≥ 4.5:1 in both
   schemes. Classic has six whitelisted light failures (text-3 on surface / surface-2 / bg; offline-, unknown-, success-text on their soft
   fills); a new skin should have none.
3. Translucent material: the `-solid` surfaces set, glass written through `--sw-perf-blur` / `--sw-perf-glass-bg` (§7), reduced
   transparency and no-`backdrop-filter` fallbacks.
4. If the skin wants the look dials or the material layer, say so: today they are emitted only for `bubble` (dials) and `bubble` + `domus`
   (material); extending them to a new skin is an engineering change (one list in `look.ts` / `styles/material.ts`).
5. Everything structural (new layout, new component) is a tier-B proposal, not a skin rule.
6. Acceptance: `npx playwright test tests/unit-design-tokens.spec.ts --project=desktop`, plus `evidence-design-foundation.spec.ts` with the
   skin added to its list; then layout sweeps and visual review on every screen of `SCREEN_INVENTORY.md`.
