# Token contract (designer handoff, 2026-09-30)

> **Status 2026-10-09 - DU1 (branch `pilot/DU1-design-unification`, `docs/design/DU1_DESIGN_UNIFICATION.md`):** the screens now read the
> table for every font size and radius (new tiers `--sw-fs-2xs` / `--sw-fs-base`, `--sw-r-2xs` / `--sw-r-xs` / `--sw-r-2xl`), the control
> states (`--sw-ctl-h-*`, `--sw-disabled-opacity`, `--sw-focus-w`, `--sw-hover-wash`, ...), the toast surface and the on-video HUD family;
> the glass knobs' default palette takes the product accent / toggle / state colours through `--sw-product-*`, and the glass surfaces
> follow `ui.scheme`. A lint (`frontend/tests/unit-token-lint.spec.ts`) keeps literals out of the screens.
>
> **Status 2026-10-01 - the foundation is implemented (branch `pilot/design-foundation`).** The decisions this contract left open are
> closed: (1) ONE table of `{name:{light,dark}}` in `frontend/src/design/tokens.ts` replaces `styles/tokens.css` (`--sw-*`, 145 names, the
> light column = the previous look, the dark column new for the whole shell); (2) the switch is `<html data-skin data-theme>` (§1 rule 3);
> (3) skins are token overrides + <= 50 component rules (`frontend/src/design/skins/`, guide: `docs/design/SKIN_AUTHORING_HE.md`), chosen per
> installation (`ui.skin`, `ui.scheme`); Domus and Tesla ship, iOS is not implemented yet. Still open: the `--dv-*` family is unchanged and
> still bridges onto `--sw-*` inside the device screens (aliasing it to the new names is per-screen work); `--sw-role-*`, `--sw-on-*`,
> `--sw-glow-*`, the compact-tile and tree knobs of the approved package are not in the table yet (they belong to the per-screen structure work);
> the touch size (`--sw-touch` 44) and the type scale of the skins are token values only until the screens consume them. The text below is the
> original brief and is kept as written.

What the design must come back with, as named values. The names are engineering's; the values are the designer's. The current values
are listed so the designer knows the starting point and can decide what to keep. Everything here is read from
`frontend/src/styles/tokens.css` (the `--sw-*` family, "v2 / SW A"), `frontend/src/styles/devices-themes.ts` and `devices-palettes.ts`
(the `--dv-*` glass knobs, `docs/design/DEVICE_THEMES.md`), `frontend/src/styles/tile-knobs.ts` and `frontend/src/shell/nav-size.ts`.

## 0. Summary of what is missing today (the gaps the design fills)

| Gap | Fact |
|---|---|
| **No dark mode for the shell and 90 % of the screens.** | `tokens.css` sets `color-scheme: light` and has one value per token. Only the device screens in the glass style have a dark palette (`--dv-*`, switched by an attribute, never by the OS). The owner wants light AND dark from day one for the whole system. |
| **Two token families** | The shell speaks `--sw-*`; the device glass style speaks `--dv-*` and bridges onto `--sw-*` inside its screens. The design should produce ONE semantic set that both can be mapped to (engineering will do the mapping; the designer must name each value once). |
| **Touch target** | `--sw-touch` is 36 px; buttons are 26 / 30 / 36 px; the owner's constraint for operator controls is 44 px. The design must state the minimum target and the visual size separately. |
| **No motion spec beyond two durations** | `--sw-t-fast` 120 ms, `--sw-t-med` 200 ms, one easing; the glass has a −2 px hover lift. Enter / exit of drawers, sheets, dialogs, tab changes, tile state changes are undesigned. |
| **Focus ring** | One colour (`--sw-focus`); thickness / offset / radius are per component. Needs one rule. |
| **Glass material** | Defined only for the device screens (`blur(28px) saturate(1.7)`, alpha surfaces, solid fallbacks). The direction extends it to the whole system, so every surface needs a glass value AND a solid fallback, light and dark. |
| **Type scale** | Two scales in practice: `--sw-fs-*` (11–26 px) for the shell and `--dv-fs-*` (12.5–24 px) for device tiles; DomusUI-style big titles (2–3 rem) exist nowhere yet. |

## 1. Naming rules (fixed by engineering)

1. Tokens are CSS custom properties. Family prefixes stay: `--sw-` (product-wide), `--dv-` (device-control screens), `--lv-tile-`
   (live overview tiles), `--nav-` (shell sizes, computed from the nav-size setting). New product-wide tokens join `--sw-`.
2. Semantic names, never colour names: `--sw-accent`, not `--sw-blue`. A state colour always has a `-soft` companion for fills.
3. One name, two values: **light** and **dark**. The design file exports both; engineering decides the switching mechanism
   (attribute on the host today for `--dv-*`; a product-wide `data-scheme` is the planned shape - **UNKNOWN** until the design lands).
4. Sizes in px (the product does not use rem); alphas as `rgba()` or an RGB triplet where the code composes the alpha (the "on" glows and
   the card-colour roles use triplets: `255 159 10`).
5. Logical directions only (start / end), never left / right, in every spec note.
6. A token that only one component reads is a **knob** (`--sw-kpi-compact-*`, `--dv-tree-*`); it may be added, but the designer should
   prefer the shared token when one fits.

## 2. Fixed by engineering (do not redesign; design around them)

| Item | Value | Why fixed |
|---|---|---|
| Breakpoints | phone `≤ 767px`, tablet `768–1023px`, desktop `≥ 1024px`; tile-layout auto switches at 600 px; Playwright viewports 1440×900 / 1024×768 / 390×844 | code, tests |
| Rail presets | s 46 px item / 18 icon / 10 label · m 52/20/10.5 · l 64/25/12 · xl 76/30/13.5; free: icon 14–40, label 0 or 9–16, item 36–96; rail width = widest label; the owner's requested default is "large"; phone bar height = item − 2, clamped 44–94 | setting with server validation |
| Densities | `devices.density` comfortable / compact; `ui.tile_layout` auto / cards / compact; `sw-table dense` | settings |
| Layout grid (editors) | 12 columns desktop, 4 phone, rows of 8 px, column gap `--dv-gap` | stored layouts |
| Z-index scale | map 1 · map-ui 5 · drawer 20 · topbar 30 · modal 50 · toast 60 | code |
| Time and geometry direction | LTR always (video, map, 3D, timeline, 24 h axis, week grid hours) | product rule |
| Glass fallback | must exist: no `backdrop-filter` support and `prefers-reduced-transparency` switch to solid surfaces, layout unchanged | accessibility |
| Reduced motion | durations become 0; the hover lift is off | accessibility |
| Font loading | Heebo is bundled; system fonts are the fallback; the glass style leads with the system stack | performance |
| Live wall counts | 1 · 2 · 4 · 6 · 8 · 9 · 12 · 16 · 20 · 25 · 32 tiles; kiosk 2×2 … 6×4 | streams budget |
| Icon set | `sw-icon` stroke set (86 names, 24 px grid, 1.8 px stroke); new icons follow it | code |

## 3. `--sw-*` product tokens: current (light) values, dark values to deliver

122 tokens. "SW A override" = the value the 50-screen handoff set on top of the base; the effective value is shown. Every colour row needs a
**dark** value; sizes and motion may stay or change.

| Token | Current effective value | Note |
|---|---|---|
| `--sw-bg` | `#f5f7fb` | (SW A override)
| `--sw-surface` | `#ffffff` | (SW A override)
| `--sw-surface-2` | `#f7f9fc` | (SW A override)
| `--sw-surface-3` | `#eef2f8` | (SW A override)
| `--sw-border` | `#e7ebf2` | (SW A override)
| `--sw-border-strong` | `#e1e6ef` | (SW A override)
| `--sw-overlay` | `rgba(17, 24, 39, 0.45)` |
| `--sw-text` | `#22314c` | (SW A override)
| `--sw-text-2` | `#5b6a85` | (SW A override)
| `--sw-text-3` | `#8a97ae` | (SW A override)
| `--sw-text-inverse` | `#ffffff` |
| `--sw-accent` | `#2767ed` | (SW A override)
| `--sw-accent-hover` | `#1f57d1` | (SW A override)
| `--sw-accent-soft` | `#edf3ff` | (SW A override)
| `--sw-accent-text` | `#2767ed` | (SW A override)
| `--sw-focus` | `#2767ed` | (SW A override)
| `--sw-live` | `#22c55e` |
| `--sw-live-soft` | `#e8f8ee` |
| `--sw-recorded` | `#2f6bff` |
| `--sw-recorded-soft` | `#eaf0ff` |
| `--sw-offline` | `#9aa3b5` |
| `--sw-offline-soft` | `#f1f3f7` |
| `--sw-stale` | `#f59e0b` |
| `--sw-stale-soft` | `#fff4e0` |
| `--sw-unknown` | `#b3bac7` |
| `--sw-unknown-soft` | `#f4f6f9` |
| `--sw-danger` | `#ef4444` |
| `--sw-danger-soft` | `#fdecec` |
| `--sw-warning` | `#f59e0b` |
| `--sw-warning-soft` | `#fff4e0` |
| `--sw-success` | `#22c55e` |
| `--sw-success-soft` | `#e8f8ee` |
| `--sw-forbidden` | `#dc2626` |
| `--sw-forbidden-soft` | `#fdecec` |
| `--sw-purple` | `#8b5cf6` |
| `--sw-video-bg` | `#0f1729` |
| `--sw-map-bg` | `#f7f9fc` | (SW A override)
| `--sw-map-wall` | `#c5cfdd` | (SW A override)
| `--sw-map-room-fill` | `#ffffff` | (SW A override)
| `--sw-map-furniture` | `#eaeff6` | (SW A override)
| `--sw-map-furniture-line` | `#d3dbe7` | (SW A override)
| `--sw-map-structure` | `#56617a` | (SW A override)
| `--sw-map-glass` | `#7fb2ff` | (SW A override)
| `--sw-map-candidate` | `#2767ed` | (SW A override)
| `--sw-map-label` | `#8a97ae` | (SW A override)
| `--sw-obj-object` | `#7b8794` |
| `--sw-obj-structure` | `#4b5567` |
| `--sw-obj-circulation` | `#6b7f99` |
| `--sw-obj-furniture` | `#9aa7b8` |
| `--sw-obj-light` | `#f2b544` |
| `--sw-obj-electrical` | `#e07a2f` |
| `--sw-obj-safety` | `#e0443c` |
| `--sw-obj-medical` | `#2fa7b3` |
| `--sw-obj-sport` | `#3fa25b` |
| `--sw-obj-sanitary` | `#5b9bd5` |
| `--sw-obj-security` | `#7a5cc7` |
| `--sw-obj-outdoor` | `#5c9e4f` |
| `--sw-circuit-1` | `#2f6bff` |
| `--sw-circuit-2` | `#f59e0b` |
| `--sw-circuit-3` | `#22c55e` |
| `--sw-circuit-4` | `#a855f7` |
| `--sw-circuit-5` | `#ef4444` |
| `--sw-circuit-6` | `#14b8a6` |
| `--sw-map-glow` | `#ffd166` |
| `--sw-map-sky` | `#dbe7f8` | (SW A override)
| `--sw-map-sky-horizon` | `#f5f8fc` | (SW A override)
| `--sw-map-wall-3d` | `#d7dde6` | (SW A override)
| `--sw-map-lit` | `#ffc857` | (SW A override)
| `--sw-map-presence` | `#2767ed` | (SW A override)
| `--sw-map-temp` | `#1e3a63` | (SW A override)
| `--sw-fov` | `rgba(39, 103, 237, 0.12)` | (SW A override)
| `--sw-font` | `"Heebo", "Inter", "Segoe UI", -apple-system, BlinkMacSystemFont, "Noto Sans Hebrew", Roboto, Arial, sans-serif` |
| `--sw-font-mono` | `ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace` |
| `--sw-fs-xs` | `11px` | (SW A override)
| `--sw-fs-sm` | `12.5px` | (SW A override)
| `--sw-fs-md` | `14px` | (SW A override)
| `--sw-fs-lg` | `15px` | (SW A override)
| `--sw-fs-xl` | `17px` | (SW A override)
| `--sw-fs-2xl` | `20px` | (SW A override)
| `--sw-fs-3xl` | `26px` | (SW A override)
| `--sw-lh` | `1.5` | (SW A override)
| `--sw-fw-regular` | `400` |
| `--sw-fw-medium` | `500` |
| `--sw-fw-semibold` | `600` |
| `--sw-fw-bold` | `700` |
| `--sw-s-1` | `4px` |
| `--sw-s-2` | `8px` |
| `--sw-s-3` | `12px` |
| `--sw-s-4` | `16px` |
| `--sw-s-5` | `20px` |
| `--sw-s-6` | `24px` |
| `--sw-s-8` | `32px` |
| `--sw-s-10` | `40px` |
| `--sw-r-sm` | `8px` | (SW A override)
| `--sw-r-md` | `12px` | (SW A override)
| `--sw-r-lg` | `14px` | (SW A override)
| `--sw-r-pill` | `999px` |
| `--sw-shadow-1` | `0 1px 2px rgba(16, 24, 40, 0.04)` |
| `--sw-shadow-2` | `0 6px 18px rgba(34, 49, 76, 0.06)` | (SW A override)
| `--sw-shadow-3` | `0 14px 36px rgba(34, 49, 76, 0.14)` | (SW A override)
| `--sw-rail-w` | `70px` | (SW A override)
| `--sw-rail-w-wide` | `70px` | (SW A override)
| `--sw-topbar-h` | `0px` | (SW A override)
| `--sw-bottomnav-h` | `50px` | (SW A override)
| `--sw-drawer-w` | `360px` |
| `--sw-touch` | `36px` |
| `--sw-content-max` | `none` | (SW A override)
| `--sw-z-map` | `1` |
| `--sw-z-map-ui` | `5` |
| `--sw-z-drawer` | `20` |
| `--sw-z-topbar` | `30` |
| `--sw-z-modal` | `50` |
| `--sw-z-toast` | `60` |
| `--sw-t-fast` | `120ms` |
| `--sw-t-med` | `200ms` |
| `--sw-ease` | `cubic-bezier(0.2, 0, 0, 1)` |
| `--sw-heading` | `#1e2e47` | (SW A only)
| `--sw-nav` | `#2868ef` | (SW A only)
| `--sw-h1` | `26px` | (SW A only)
| `--sw-h1-weight` | `700` | (SW A only)
| `--sw-h1-tracking` | `-0.6px` | (SW A only)
| `--sw-page-pad` | `30px` | (SW A only)

Groups, for the design file's "foundations" pages: surfaces (`bg`, `surface`, `surface-2`, `surface-3`, `border`, `border-strong`,
`overlay`), text (`text`, `heading`, `text-2`, `text-3`, `text-inverse`), accent (`accent`, `accent-hover`, `accent-soft`, `accent-text`,
`focus`, `nav`), state colours (`live`, `recorded`, `offline`, `stale`, `unknown`, `danger`, `warning`, `success`, `forbidden`, each
with `-soft`, plus `purple`), canvas (`video-bg`, `map-*`, `fov`, `obj-*` 12 object classes, `circuit-1..6`, `map-glow`, 3D `map-sky`,
`map-sky-horizon`, `map-wall-3d`, state layer `map-lit`, `map-presence`, `map-temp`), typography (`font`, `font-mono`, `fs-xs..3xl`,
`lh`, `fw-*`, `h1*`), spacing (`s-1..10`, `page-pad`), radii (`r-sm/md/lg/pill`), elevation (`shadow-1..3`), layout (`rail-w*`,
`topbar-h` = 0, `bottomnav-h`, `drawer-w`, `touch`, `content-max`), z-index, motion (`t-fast`, `t-med`, `ease`).

## 4. `--dv-*` glass knobs (device screens): current default palette, light / dark

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

## 5. Other knob families

| Family | Names | Where |
|---|---|---|
| `--lv-tile-compact-*` (9) | `min-block`, `pad-block`, `pad-inline`, `gap`, `icon`, `value-fs`, `col-min`, `cols-phone`, `grid-gap` | live overview tiles (`tile-knobs.ts`), same roles as `--dv-kpi-compact-*` |
| `--sw-kpi-compact-*` (7) | `min-block`, `pad-block`, `pad-inline`, `gap`, `icon`, `value-fs`, plus grid knobs on the screen | what `sw-kpi` reads (bridged from the two families above) |
| `--nav-*` (10) | `icon`, `label`, `item-h`, `item-w`, `avatar`, `bar-h`, `p-label`, `pill-w`, `pill-h` (+ `p-icon`) | computed by `nav-size.ts`; not designed as values, but the design's rail geometry must map onto them |
| `--sw-tab-min-h`, `--sw-drawer-modal-w`, `--sw-icon-size` | component-local | `sw-tabs`, `sw-drawer`, `sw-icon` |

## 6. What the design must deliver, token by token

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
