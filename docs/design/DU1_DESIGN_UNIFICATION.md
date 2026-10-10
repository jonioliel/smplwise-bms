# DU1 - design unification (audit, decisions, token layer) - 2026-10-09

Branch `pilot/DU1-design-unification`. Owner direction (2026-09-30): one visual language for the whole system, Domus-style,
light AND dark, built at the token / theme layer so a designer adds skins without touching screens. This record is the
Design ADR for the intentional visual changes of DU1 (DESIGN_CONTRACT: "intentional visual changes get a Design ADR").

Invariants kept: the floors / areas tree with per-floor collapse on every design; clean operator screens; no platform
branding outside the settings; list / table views next to cards; Hebrew RTL first; video, map, 3D and timeline never
mirrored. No behaviour, API contract, setting or migration changed.

## 1. Audit

Method: a literal scan of the CSS of every Lit screen and component (`font-size`, `border-radius`, `box-shadow`, hex and
rgba colours, `var(--sw-x, <literal>)` fallbacks), plus demo-mode screenshots of 20 routes in the classic skin, light and
dark, at 1440 and 390 (origin/main 31fe5d7c = `docs/design/evidence/du1/before/`, this branch = `.../after/`). Numbers
before: 2,414 literals in 133 files - 684 px font sizes on 40 distinct values (9 ... 68 px, the shell's scale has 7 tiers),
467 radii on 29 values, 638 hex colours (198 x `#fff`, the Tailwind state greens / ambers / reds repeated in 30 files),
454 rgba, 49 ad-hoc shadows.

### 1.1 Three visual languages (the screenshots)

| | Where | Look | Dark mode |
|---|---|---|---|
| A. classic shell | rail, home dashboard, security (live, events, playback, cases, alarm), settings, lists | v2 tokens: 12 px radii, `#2767ed` accent, flat white cards, 11-26 px type | follows `ui.scheme` |
| B. glass / iOS | devices (glass style), **schedules, automations, multimedia, notifications, remote** - "always glass" by CR-014/15/17/18 | 44 px titles, 22-28 px radii, iOS blue `#007aff`, green toggles `#34c759`, pill chips, blurred glass | **stayed light** - resolved from `devices.scheme` (default light), so under `ui.scheme=dark` a white glass page sat inside the dark shell (`before/schedules-classic-dark-desktop.png`, `before/automations-classic-dark-desktop.png`, `before/notifications-classic-dark-desktop.png`, `before/multimedia-classic-dark-desktop.png`) |
| C. per-screen one-offs | schedule grid colours, home weather / alarm washes, HUDs over video, toasts | their own hex values | half of them light-only (toasts: `background: var(--sw-text); color: #fff` = light on light in dark) |

### 1.2 Screen by screen (classic skin unless noted)

| Screen | Inconsistencies found | Fixed in DU1 |
|---|---|---|
| Shell (`sw-app`) | brand tile shadow literal, search panel shadow literal, bottom-nav 10 / 10.5 px labels, rail 10 px radii, toast `--sw-text` / `--sw-surface`, system banner in Tailwind reds | tokens; toast tokens; banner on `--sw-danger-soft` / `-text` |
| Home (`devices-building`, `home-widgets`) | weather icon colours `#e58e0b` / `#7b8aa6` / `#3d6fd8`, alarm wash `rgba(255,59,48)`, warning borders `rgba(255,159,10)`, candle `#a15c00`, 13 / 13.5 px type | state tokens + `color-mix`, type tiers |
| Area (`devices-area`) | glass knobs iOS accent / green toggle next to the shell's blue | default palette = product colours (§2.4) |
| Schedules (list, editor, week view, `sw-schedule-grid`, `sw-schedule-bar`) | light under dark; the 24 h kind colours as hex in three files (`#16a34a`, `#d97706`, `#2767ed`, `#0d9488`, `#7c3aed`, `#64748b`) each with its own rgba fill; tooltip light-on-light in dark; banner borders `#fde3b0` / `#f6c7c7` | scheme rule (§2.3); the `--sc-*` knobs and the editor legend on the state tokens with `color-mix` fills; toast tokens |
| Automations (list, builder, drawer) | light under dark; 28 px literal sheet radius; glyphs `color: #fff` on accent; `#8e8e93` | scheme rule; `--sw-r-2xl`; `--sw-text-inverse` / `--sw-text-3` |
| Multimedia (players, screens, groups, remote) | light under dark; `--mm-*` / `--mr-*` knob sets with literal colours and 43 px sizes | scheme rule only; the knob sets are documented layers (left, see §4) |
| Notifications (center, rows, detail, settings) | light under dark; `--nt-*` knobs | scheme rule; knobs left (§4) |
| Live overview / wall / camera / views | HUD on video: `#fff`, `rgba(17,24,39,.6)`, `rgba(0,0,0,.55)`, `#0f1729` tile backgrounds, 10-11.5 px labels, zone editor colours | on-video family (§2.2), `--sw-video-bg`, type tiers |
| Events / event detail / cases / playback / sync / history map | thumbnail HUDs as above, state text `#15803d` / `#b45309` inline, bookmark colours, 9-14 px radii | on-video family, `-text` tokens, radius tiers; timeline / scrubber HUD left (allow-listed) |
| Alarm | keypad with its own material, toast as above | toast tokens; keypad left |
| Settings (all `system-*`) | inline `color:#15803d` messages, style previews with literal swatches, 13 px type | `--sw-success-text`; swatches left on purpose (documented) |
| Access / entities / cameras (`system-access`, `explore-entities`, `system-devices`, `nvr-*`) | 12.5 / 13 px type, 6-10 px radii, `var(--sw-text-4, #9aa3b2)` (a token that never existed) | tiers; `--sw-text-3` |
| Shared components | `sw-button` 8 / 7 px radii, 26 / 30 / 36 px heights, `.45` disabled vs `.5` (`sw-toggle`) vs `.7` (`sw-chip`), primary shadow literal; `sw-badge` on-image white; `sw-chip` selected marks white; `sw-toggle` thumb `#fff`; `sw-drawer` backdrop `rgba(15,23,42,.38)`; 78 focus rings each saying `2px solid` | control tokens (§2.1), one focus rule |
| Kiosk wall, printable bill, offline page, plan canvas / 3D, isometric glyphs | their own documents / neutrals | left (listed in the lint's allow list with reasons) |

After the pass: 1,160 literals remain, of which 304 sit in the three documented knob layers (`--dv-*`, `--mm-*`,
`--mr-*`), 58 in the kiosk wall, 36 in the printable bill, 21 in the plan canvas; the rest are HUD gradients, mask
colours and the static swatches of the settings previews, every one behind an allow-list entry with its reason
(`frontend/tests/unit-token-lint.spec.ts`).

## 2. Decisions (ADR)

### 2.1 The scale is the token table (`frontend/src/design/tokens.ts`)

- **Type**: `--sw-fs-2xs` 10 · `xs` 11 · `sm` 12.5 · **`base` 13 (new)** · `md` 14 · `lg` 15 · `xl` 17 · `2xl` 20 · `3xl` 26 (+ `--sw-h1`).
  Every screen font size in 9-27 px snapped to the nearest tier (0.5-1 px moves: 13.5 → base, 16 → lg, 11.5 → xs, 10.5 → 2xs).
  Display numbers (the clock, the keypad, big readings) stay literal.
- **Radii**: `--sw-r-2xs` 4 · `xs` 6 · `sm` 8 · `md` 12 · `lg` 14 · `xl` 14 · **`2xl` 22 (new)** · `pill`. Every 4-24 px radius snapped
  (9 → sm, 10 / 11 → md, 16 → lg, 18 / 20 / 24 → 2xl). 1-3 px marks stay literal. Domus 5/8/10/16/24/28/32, Tesla 2/3/4/6/8/8/10,
  Bubble 6/8/12/18/28/42/48; the Bubble radius dial bundles carry the new tiers.
- **Control states** (group `control`): `--sw-ctl-h-sm/md/lg` 26/30/36, `--sw-disabled-opacity` .5 (one fade for button, chip,
  toggle), `--sw-hover-wash`, `--sw-pressed-wash`, `--sw-focus-w` / `--sw-focus-offset` (the focus policy and the 78
  component rings read them), `--sw-skeleton` / `--sw-skeleton-shine`, `--sw-shadow-primary`, `--sw-toggle-thumb`.
- **Toast / inverted surface**: `--sw-toast-bg` / `-text` / `-action` (light: slate on white; dark: a lifted slate) - the
  `background: var(--sw-text); color: #fff` pattern was light-on-light in dark mode.

### 2.2 The on-video family (group `video`, the same in both schemes)

`--sw-on-video`, `--sw-on-video-2`, `--sw-video-scrim`, `--sw-video-scrim-strong`, `--sw-video-line`, `--sw-video-hover`,
`--sw-on-image-bg` (a badge on a thumbnail; `--sw-text` on it). Video is dark in both schemes, so white text on it is not
`--sw-text-inverse` (which Domus-dark makes dark); the two were conflated in 95 places.

### 2.3 The glass surfaces are never lighter than the shell (`screens/devices-style.ts`)

`applyDevicesScheme` resolves `data-devices-scheme="dark"` when `devices.scheme` says so (`dark`, or `auto` on a dark OS)
**or when the product is dark** (`ui.scheme`, `<html data-theme>`), and re-resolves on every design change. A dark OS alone
still changes nothing while `ui.scheme` is light; the 6a decision (no black device area inside a white shell) is kept and
its mirror image is now also impossible. `devices.scheme` keeps its meaning and its setting.

### 2.4 The glass default palette takes the product's interaction colours (`styles/devices-themes.ts`)

`--dv-accent` & co., `--dv-focus`, `--dv-toggle-on`, `--dv-success` / `-warning` / `-danger` (+ `-soft`) of the **default**
palette read the never-bridged `--sw-product-*` aliases (tokens.ts group `product`: the product values resolved on `:root`,
so no cycle with the host's `--sw-* ← --dv-*` bridge). Classic therefore shows one blue and blue toggles on every screen,
Domus its blue and green toggles, light and dark. The sand / forest / graphite palettes and the remote's `--mr-*` set keep
their own values. **Reviewable with one block**: restore the twelve literals in the two `default` blocks to return to the
mockup's iOS values.

### 2.5 Drift guard (`frontend/tests/unit-token-lint.spec.ts`)

The CSS of `components/sw-*`, `shell/*` and `screens/*` may not carry px font sizes in 9-27, 4-24 px radii, token fallbacks
or hex colours on text / fill properties unless the file is in `ALLOW_HEX` with a reason; a stale allow entry fails too.
Node-only, 6 s.

## 3. Evidence

`docs/design/evidence/du1/before/` (origin/main) and `docs/design/evidence/du1/after/` (this branch): `<screen>-<skin>-<scheme>-<width>.png`
for home, schedules, automations, map, live, wall, views, events, playback, cases, rules, alarm, multimedia, settings,
settings-devices, access, notifications, entities, cameras; classic light + dark at 1440 and 390, Domus light + dark at 1440
(after only). Demo mode, fixed clock, `?design=a&look=performance:full`.

## 4. Not done / next

- The `--mm-*` (media material), `--mr-*` (remote), `--nt-*` (notifications) and `--ab-*` (automation builder) knob sets still
  declare their own colours and sizes; they follow the scheme now (§2.3) and the product accent through `--dv-*` (§2.4), but a
  designer re-tuning them edits those files. Folding them onto `--sw-*` is per-screen work (the Frigate and activity-window
  screens were deliberately untouched: another agent polishes them).
- The glass **radii** (`--dv-radius-*` 14/22/28) stay the mockup's; classic cards are 12 px. Unifying them means choosing one
  structure for the home / area screens - a design decision for the owner, not a token swap.
- Structural unification of language A and B (big titles, pill chips, section grids on the security and settings screens) is
  the Domus skin's job (`skins/domus.ts`, 28 of 50 rules used); DU1 made every screen read the tokens the skin sets.
- Empty / error states: 56 screens use `sw-state-panel`; 10 draw their own `.empty` block (scene editor, schedule panels,
  week view, table view) - candidates for the shared panel.
- Visual baselines (`tests/evidence-design-foundation.spec.ts-snapshots/classic-*`) are pixel checks of the classic skin
  from before the foundation; DU1's 0.5-1 px type / radius snaps change them by design. They were NOT regenerated on this
  machine (see the closing report: runner command).
