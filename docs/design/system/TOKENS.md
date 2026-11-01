# Token map: the new design system onto the existing skin layer (DESIGNSYS-297, 2026-10-27)

Companion of `DESIGN.md`. Every value of the three directions, keyed by the **existing** names of `frontend/src/design/tokens.ts`
(the `--sw-*` table) so that the build task after the owner's choice is a skin (`frontend/src/design/skins/<id>.ts`: token overrides,
both columns, plus ≤ 50 component rules) and not a new token family. The `--dv-*` glass knobs of the device screens keep bridging
onto these names (`docs/design/DEVICE_THEMES.md` §2); nothing here renames them. Names marked **NEW** do not exist in the table yet
and have to be declared there first (`skins/index.ts` refuses an unknown name).

Conventions (unchanged from `docs/design/handoff/TOKEN_CONTRACT.md` §1): semantic names, px, `rgba()` alphas, one name = light + dark,
logical directions. `same` = one value for both schemes.

## 1. Direction A - "Arx Infra" (recommended)

Most values equal the `classic` skin as it is today; the deltas are marked **Δ**. A is therefore implementable as a small skin on top of
`classic` (or as the new `classic` itself), with the component rules of `COMPONENT_RULES.md`.

### 1.1 Surfaces and text
| Token | Light | Dark | Note |
|---|---|---|---|
| `--sw-bg` | `#f5f7fb` | `#0d1220` | |
| `--sw-canvas` | `linear-gradient(var(--sw-bg), var(--sw-bg))` | same | flat |
| `--sw-surface` / `-solid` | `#ffffff` | `#151c2c` | |
| `--sw-surface-2` / `-solid` | `#f7f9fc` | `#1a2336` | |
| `--sw-surface-3` / `-solid` | `#eef2f8` | `#222d44` | |
| `--sw-menu-surface` / `--sw-menu-border` | `#ffffff` / `#e7ebf2` | `#151c2c` / `#232e45` | opaque, always |
| `--sw-border` | `#e7ebf2` | `#232e45` | |
| `--sw-border-strong` | **Δ** `#d9dfe9` (was `#e1e6ef`: too close to `--sw-border`) | `#2f3c58` | buttons, inputs, HUD panels |
| `--sw-highlight` | `transparent` | `transparent` | |
| `--sw-overlay` | `rgba(17,24,39,.45)` | `rgba(0,0,0,.62)` | |
| `--sw-video-bg` | `#0f1729` | `#05070c` | |
| `--sw-text` / `--sw-heading` | `#22314c` / `#1e2e47` | `#e6ebf5` / `#f3f6fc` | |
| `--sw-text-2` | `#4b5976` | `#a9b4ca` | 7.4:1 / 9.1:1 on the panel |
| `--sw-text-3` | `#5e6d88` | `#98a4ba` | 5.1:1 / 5.6:1 - the floor for words |
| `--sw-text-inverse` | `#ffffff` | `#ffffff` | |

### 1.2 Accent, rail, states
| Token | Light | Dark |
|---|---|---|
| `--sw-accent` / `-hover` | `#2767ed` / `#1f57d1` | `#3a6ce0` / `#3465d6` |
| `--sw-accent-soft` | `#edf3ff` | `rgba(91,140,255,.18)` |
| `--sw-accent-text` / `--sw-focus` / `--sw-nav` | `#2062ec` / `#2767ed` / `#2868ef` | `#8fb2ff` / `#7aa2ff` / `#3a6ce0` |
| **NEW** `--sw-rail-bg` / `--sw-rail-text` / `--sw-rail-active` / `--sw-rail-active-bg` / `--sw-rail-border` | `#ffffff` / `#4b5976` / `#2062ec` / `#edf3ff` / `#e7ebf2` | `#0f1526` / `#a9b4ca` / `#8fb2ff` / `rgba(91,140,255,.18)` / `#232e45` |
| `--sw-live` / `-soft` / `-text` (= success) | `#22c55e` / `#e8f8ee` / `#15803d` | `#3ddc84` / `rgba(61,220,132,.18)` / `#3ddc84` |
| `--sw-recorded` / `-soft` / `-text` | `#2f6bff` / `#eaf0ff` / `#1f5ae6` | `#6ea2ff` / `rgba(110,162,255,.2)` / `#8fb8ff` |
| `--sw-offline` / `-soft` / `-text` | `#9aa3b5` / `#f1f3f7` / **Δ** `#5c6573` | `#8b96a8` / `rgba(139,150,168,.2)` / `#b4bdcc` |
| `--sw-stale` / `-soft` / `-text` (= warning) | `#f59e0b` / `#fff4e0` / **Δ** `#a04a06` (4.6:1 on the soft fill) | `#f5b043` / `rgba(245,176,67,.2)` / `#f5b043` |
| `--sw-unknown` / `-soft` / `-text` | `#b3bac7` / `#f4f6f9` / **Δ** `#5c6573` | `#6b7686` / `rgba(107,118,134,.22)` / `#aab5c9` |
| `--sw-danger` / `-soft` / `-text` | `#ef4444` / `#fdecec` / `#b91c1c` | `#ff6b62` / `rgba(255,107,98,.2)` / `#ff8a82` |
| `--sw-forbidden` / `-soft` / `-text` | `#dc2626` / `#fdecec` / `#b91c1c` | `#ff7a70` / `rgba(255,122,112,.2)` / `#ff8a82` |
| `--sw-toggle-on` / `--sw-toggle-thumb` | `#2767ed` / `#ffffff` | `#3a6ce0` / `#ffffff` |
| `--sw-lit` / `--sw-lit-soft` | `#ffc857` / `rgba(255,200,87,.3)` | `#ffb547` / `rgba(255,181,71,.3)` |
| `--sw-badge-bg` / `--sw-badge-fg` | `#b91c1c` / `#ffffff` | `#ff6b62` / `#2a0b09` |
| **NEW** `--sw-el-wait` / `-act` / `-trav` / `-fault` / `-off` / `-fire` / `-unk` | `#15803d` / `#1d4ed8` / `#0e7490` / `#c81e1e` / `#c2410c` / `#881337` / `#667085` | same (today literals in `elevators/styles.ts`; promoted to tokens so a skin can tune them) |

### 1.3 Type, space, shape, motion
| Token | Value (A) | Note |
|---|---|---|
| `--sw-font` / `--sw-font-heading` | Heebo stack (unchanged) | one face |
| `--sw-fs-2xs … 3xl` | 10 / 11 / 12.5 / 13 / 14 / 15 / 17 / 20 / 26 | unchanged |
| **NEW** `--sw-fs-4xl` | `32px` | display readings (clock, kWh, temperature) - today `--dv-fs-value-big` 24 and ad-hoc 32s |
| `--sw-h1` / `-weight` / `-tracking` / `-phone` | 26 / 700 / **Δ** `-0.4px` / `var(--sw-fs-2xl)` | phone H1 20 (was 17) |
| `--sw-lh` / **NEW** `--sw-lh-tight` | 1.5 / 1.2 | |
| `--sw-s-1 … 10` | 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 | unchanged |
| `--sw-page-pad` / **NEW** `--sw-page-pad-phone` | **Δ** `24px` (was 30) / `14px` | |
| **NEW** `--sw-gap` / `--sw-gap-lg` | `12px` / `16px` | tiles / cards (today `--dv-gap` 14 / `--dv-gap-lg` 18 inside glass only) |
| `--sw-rail-w` | **Δ** `72px` | preset m; the nav-size presets still compute `--nav-*` |
| `--sw-bottomnav-h` | **Δ** `56px` (was 50) | ≥ 44 + label |
| `--sw-tree-w` | `260px` | the bubble group's name, now product-wide |
| `--sw-touch` | **Δ** `44px` (was 36) | the touch target; `--sw-touch-desktop` stays 44 |
| `--sw-ctl-h-sm` / `-md` / `-lg` | **Δ** 28 / 34 / 40 (were 26 / 30 / 36) | visual heights; the phone raises every control to 44 |
| `--sw-r-2xs … pill` | 4 / 6 / 8 / 12 / 14 / **Δ** xl `16` / 22 / 999 | dialog radius one step above the card |
| `--sw-shadow-1` | `0 1px 2px rgba(16,24,40,.04)` · dark `rgba(0,0,0,.35)` | rest |
| `--sw-shadow-2` | **Δ** `0 6px 18px rgba(34,49,76,.08)` · dark `rgba(0,0,0,.4)` | hover |
| `--sw-shadow-3` | `0 14px 36px rgba(34,49,76,.14)` · dark `rgba(0,0,0,.55)` | floating |
| `--sw-shadow-thumb` / `--sw-shadow-primary` | unchanged | |
| `--sw-glass-blur` / `-nav` / `-sheet` / `--sw-glass-sheen` | `none` / `none` / `none` / none | A has no glass |
| `--sw-t-fast` / `-med` / **NEW** `--sw-t-slow` | 120 / 200 / 280 ms | |
| `--sw-ease` | **Δ** `cubic-bezier(.23,1,.32,1)` (was `(.2,0,0,1)`: stronger ease-out) | enter / state |
| **NEW** `--sw-ease-in-out` / `--sw-ease-drawer` | `cubic-bezier(.77,0,.175,1)` / `cubic-bezier(.32,.72,0,1)` | movement / drawers; `--sw-ease-dialog` and `--sw-ease-out` stay |
| `--sw-ease-thumb` | `var(--sw-ease)` | |
| `--sw-hover-lift` | `0px` | A never lifts |
| `--sw-focus-w` / `--sw-focus-offset` / `--sw-disabled-opacity` | 2 / 2 / .5 | unchanged |
| `--sw-hover-wash` / `--sw-pressed-wash` / `--sw-skeleton*` / `--sw-toast-*` | unchanged | |
| On-video family `--sw-on-video*`, `--sw-video-scrim*`, `--sw-video-line` | unchanged, same in both schemes | |
| Canvas family `--sw-map-*`, `--sw-obj-*`, `--sw-circuit-*`, `--sw-fov` | unchanged | out of this round's scope; already light + dark |

### 1.4 Settings this system expects (every option changeable, none hard-coded)
| Setting | Values | Reads |
|---|---|---|
| `ui.skin` | `arx-infra` (A) · `arx-ops` (B) · `arx-soft` (C) · the existing ids | the skin registry |
| `ui.scheme` | `light` · `dark` · `auto` | `<html data-theme>` (today) |
| **new** `ui.rail_tone` | `auto` (the skin's) · `light` · `dark` | `--sw-rail-*` |
| `ui.density` / `devices.density` | `comfortable` · `compact` | row heights, gaps (compact = `--sw-gap` 8, rows 36) |
| `ui.tile_layout` | `auto` · `cards` · `compact` | `sw-kpi` (unchanged) |
| `ui.look.performance` | `auto` · `full` · `lite` | glass blur on / off (C only in practice) |
| `ui.look.material` / `depth` / `tint` | existing dials | C only |
| **new** `ui.motion` | `auto` · `full` · `reduced` | durations (reduced = 0) |
| `ui.nav_size` | s / m / l / xl / free | `--nav-*` (unchanged) |
| `home.widgets.elevators.mode` / `rows` | combined · cards · both / 1-12 | the elevators widget |

## 2. Direction B - "Arx Ops" (deltas from A)

| Token | Light | Dark |
|---|---|---|
| `--sw-bg` | `#eef1f6` | `#0f1216` |
| `--sw-surface` / `-2` / `-3` | `#ffffff` / `#f4f6fa` / `#e9edf3` | `#171b21` / `#1d222a` / `#252b35` |
| `--sw-menu-surface` / `--sw-menu-border` | `#ffffff` / `#d7dde7` | `#1d222a` / `#2f3742` |
| `--sw-border` / `-strong` | `#dfe4ec` / `#c9d1dd` | `#2a313b` / `#3a4350` |
| `--sw-text` / `-heading` / `-2` / `-3` | `#1b2537` / `#131c2c` / `#4a5569` / `#5f6a7e` | `#e4e8ee` / `#f4f6f9` / `#a3acba` / `#8690a1` |
| `--sw-accent` / `-hover` / `-soft` / `-text` / `--sw-focus` | `#1a5fe0` / `#164fbd` / `#e6eefc` / `#1552c7` / `#1a5fe0` | `#4d8dff` / `#6a9fff` / `rgba(77,141,255,.16)` / `#8fb8ff` / `#8fb8ff` |
| `--sw-rail-bg` / `-text` / `-active` / `-active-bg` / `-border` | **`#141b2b`** / `#aab6cc` / `#ffffff` / `rgba(255,255,255,.1)` / `#141b2b` | `#0a0d11` / `#98a3b5` / `#ffffff` / `rgba(255,255,255,.1)` / `#1d222a` |
| states | live `#1fa75a` / `#e3f5ea` / `#176f3f` · recorded `#2563eb` / `#e4ecfd` / `#1d4fc4` · offline `#8b94a6` / `#eef0f4` / `#596274` · stale/warning `#d97706` / `#fdf1df` / `#9a4f05` · unknown `#a7afbd` / `#f1f3f6` / `#596274` · danger `#dc2626` / `#fcebeb` / `#a81c1c` · forbidden `#b91c1c` / `#fcebeb` / `#a81c1c` | live `#34d073` / 16 % / `#5ee08f` · recorded `#6ea2ff` / 18 % / `#9ec0ff` · offline `#7f8899` / 18 % / `#b1bac8` · stale `#f2a93b` / 18 % / `#f5b95c` · unknown `#5f6878` / 22 % / `#aab3c2` · danger `#ff6464` / 18 % / `#ff8c8c` · forbidden `#ff7070` / 18 % / `#ff8c8c` |
| `--sw-toggle-on` / `--sw-lit` | `#1a5fe0` / `#f5b942` | `#4d8dff` / `#f5b942` |
| `--sw-r-2xs … 2xl` | 3 / 4 / 6 / 8 / 10 / 12 / 14 | squarer |
| `--sw-shadow-1` / `-2` / `-3` / `-primary` | `none` / `0 4px 14px rgba(19,28,44,.1)` / `0 12px 32px rgba(19,28,44,.18)` / `none` | `none` / `rgba(0,0,0,.45)` / `rgba(0,0,0,.6)` / `none` |
| `--sw-fs-md` / `--sw-fs-3xl` / `--sw-h1` / `-weight` / `-tracking` | 13.5 / 22 / 22 / 600 / `-0.2px` | |
| `--sw-gap` / `--sw-gap-lg` / `--sw-page-pad` | 10 / 12 / 20 | denser |
| Component rules (≤ 50) | badges outlined (transparent fill, hairline at 45 % of the state colour, 4 px radius); toggle 40 × 22 with a 4 px radius; KPI 54 px with an 8 px dot and no halo; table rows 40 px; chips 6 px radius; rail items white-on-navy | |

## 3. Direction C - "Arx Soft" (deltas from A)

| Token | Light | Dark |
|---|---|---|
| `--sw-bg` | `#eef2f9` | `#0b1020` |
| `--sw-canvas` | `radial-gradient(900px 500px at 85% -10%, rgba(255,196,120,.35), transparent 60%), radial-gradient(900px 600px at 10% 110%, rgba(110,162,255,.3), transparent 60%), linear-gradient(#eef2f9, #f3f1ec)` | the same shape with `rgba(255,159,10,.14)` and `rgba(58,108,224,.25)` over `#0b1020 → #0e1220` |
| `--sw-surface` / `-solid` | `rgba(255,255,255,.76)` / `#fdfdfe` | `rgba(24,30,48,.72)` / `#1a2032` |
| `--sw-surface-2` / `-solid` | `rgba(255,255,255,.62)` / `#f4f6fa` | `rgba(44,52,76,.6)` / `#232a40` |
| `--sw-surface-3` | `rgba(120,120,128,.12)` | `rgba(235,235,245,.12)` |
| `--sw-menu-surface` / `--sw-menu-border` | `#fdfdfe` / `#dde2ec` | `#1a2032` / `#2b3450` |
| `--sw-border` / `-strong` / `--sw-highlight` | `rgba(30,41,59,.09)` / `.18` / `rgba(255,255,255,.75)` | `rgba(255,255,255,.1)` / `.2` / `rgba(255,255,255,.08)` |
| `--sw-text` / `-heading` / `-2` / `-3` | `#1f2a3d` / `#16203a` / `#4d5a72` / `#5f6c84` | `#eef2fa` / `#f8faff` / `#aeb8cc` / `#8d99b2` |
| `--sw-accent` / `-hover` / `-soft` / `-text` / `--sw-focus` | `#2f6df6` / `#255ddb` / `rgba(47,109,246,.12)` / `#2158d4` / `#2f6df6` | `#5b8dff` / `#7aa2ff` / `rgba(91,141,255,.2)` / `#9ec0ff` / `#9ec0ff` |
| `--sw-rail-bg` / `-text` / `-active` / `-active-bg` / `-border` | `rgba(255,255,255,.6)` / `#4d5a72` / `#2158d4` / `rgba(47,109,246,.12)` / `rgba(30,41,59,.08)` | `rgba(16,21,38,.6)` / `#aeb8cc` / `#9ec0ff` / `rgba(91,141,255,.2)` / `rgba(255,255,255,.08)` |
| states (iOS-leaning) | live `#22c55e` / 14 % / `#15803d` · recorded `#2f6bff` / 14 % / `#1f5ae6` · offline `#8e8e93` / 14 % / `#5c6573` · stale/warning `#ff9f0a` / 16 % / `#a04a06` · unknown `#aeaeb2` / 10 % / `#5c6573` · danger `#e5484d` / 13 % / `#b91c1c` · forbidden `#d70015` / 12 % / `#b91c1c` | live `#30d158` / 20 % / `#7ee29a` · recorded `#6ea2ff` / 20 % / `#9ec0ff` · offline `#8e8e93` / 20 % / `#c0c4cc` · stale `#ff9f0a` / 20 % / `#ffc46b` · unknown `#636366` / 16 % / `#b7bcc8` · danger `#ff453a` / 20 % / `#ff8a80` · forbidden `#ff453a` / 20 % / `#ff8a80` |
| `--sw-toggle-on` / `--sw-lit` | `#34c759` / `#ffb13b` | `#30d158` / `#ffb547` |
| `--sw-r-2xs … 2xl` | 6 / 8 / 12 / 18 / 22 / 24 / 28 | rounder |
| `--sw-shadow-1` / `-2` / `-3` | `0 8px 24px rgba(31,45,80,.08), inset 0 1px 0 var(--sw-highlight)` / `0 16px 40px rgba(31,45,80,.14), inset …` / `0 24px 64px rgba(15,23,42,.24)` | `0 10px 30px rgba(0,0,0,.35), inset …` / `0 18px 48px rgba(0,0,0,.45), inset …` / `0 26px 70px rgba(0,0,0,.6)` |
| `--sw-shadow-primary` | `0 4px 12px rgba(47,109,246,.3)` | `0 4px 12px rgba(0,0,0,.4)` |
| `--sw-glass-blur` / `-nav` / `-sheet` | `blur(20px) saturate(1.5)` / `blur(16px) saturate(1.4)` / `none` (sheets are opaque) | same |
| `--sw-glass-sheen` | `linear-gradient(180deg, rgba(255,255,255,.5), transparent 40%)` | `rgba(255,255,255,.08)` |
| `--sw-h1` / `-tracking` / `-phone` / `--sw-gap` / `--sw-gap-lg` / `--sw-page-pad` | 30 / `-0.6px` / 24 / 14 / 18 / 28 | roomier |
| `--sw-hover-lift` | `-2px` | fine pointers, motion allowed |
| Fallbacks | `prefers-reduced-transparency`, no `backdrop-filter` support, or `ui.look.performance = lite` → surfaces take their `-solid` twins and the blur is `none` (the existing `--sw-perf-blur` / `--sw-perf-glass-bg` switches, `TOKEN_CONTRACT.md` §7); layout unchanged | |
| Component rules | pill buttons; 51 × 31 toggle; round icon boxes in card headers; the lit tile gets a 24 px warm glow; cards paint the sheen | |

## 4. Contrast evidence (computed, not measured in a browser)

Text pairs checked with the WCAG 2 formula on the opaque surfaces (for C: on the solid twins, the worst case under glass is the lite
tier which is ≥ 0.86 alpha of the solid colour): A light `--sw-text-2` 7.4:1, `--sw-text-3` 5.1:1, `--sw-accent-text` 5.1:1,
`--sw-stale-text` on `--sw-stale-soft` 4.6:1, `--sw-offline-text` on `--sw-offline-soft` 5.4:1, white on `--sw-accent` 4.9:1,
white on every `--sw-el-*` ≥ 4.6:1; A dark `--sw-text-2` 9.1:1, `--sw-text-3` 5.6:1, `--sw-accent-text` 7.8:1, every `-text` twin
≥ 4.5:1 on its fill composited over the panel. B and C follow the same pairs with their own values (B light `--sw-text-3`
5.9:1, C light `--sw-text-3` 5.5:1 on `#fdfdfe`). These must be re-proved by `frontend/tests/unit-muted-contrast.spec.ts` (and the
HUD / menu specs) when the skin is built; the mockups' values are the proposal, the test is the proof.
