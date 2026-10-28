# Motion rules (as implemented, R5 2.27.1 assembly)

Status: descriptive. This records what the code and the design-system docs already do; it decides nothing new.
Where code and docs disagree, see "Open questions". Paths are relative to the repository root.
`DS` = `private/design-system-2026-10-27/docs/` (private design-system pack: `DESIGN.md`, `TOKENS.md`, `COMPONENT_RULES.md`).

## 1. Tokens

All motion is driven by CSS custom properties declared once in `frontend/src/design/tokens.ts` (group `motion`). Their base
values are neutral (120-200 ms, plain curve, no press scale, no entrance), so a skin that sets nothing draws what it always drew.

| Token | infra / soft (`skins/arx-motion.ts`) | classic / domus (`skins/polish-motion.ts`) | Use |
|---|---|---|---|
| `--sw-t-press` | 140 ms | 120 ms | pointer-down transform |
| `--sw-t-hover` / `--sw-t-fast` | 160 / 160 ms | 150 ms / base 120 ms | hover colour, chips |
| `--sw-t-med`, `--sw-t-state` | 220 ms | base 200 ms | state fills, toggle track |
| `--sw-t-slow` | 280 ms | base 200 ms | scrim, page pushed back |
| `--sw-t-sheet` | 220 ms | base 200 ms | sheet/dialog opening |
| `--sw-t-exit` | 160 ms | 140 ms | closing (never slower than `--sw-t-sheet`) |
| `--sw-t-toast` | 400 ms | 260 ms | toast |
| `--sw-enter-ms` / `--sw-enter-y` / `--sw-stagger` | 240 ms / 6 px / 40 ms | 220 ms / 6 px / 30 ms | entrance cascade |
| `--sw-press-scale` | 0.97 | 0.96 | pressed control |

Easing tokens (`tokens.ts`, `design/semantic.ts` `MOTION_EASINGS`): `--sw-ease` `cubic-bezier(.23,1,.32,1)` (strong ease-out,
enter and state), `--sw-ease-in-out` `(.77,0,.175,1)` (on-screen movement), `--sw-ease-drawer` `(.32,.72,0,1)`,
`--sw-ease-color` `ease` (hover/colour). Rule stated in `arx-motion.ts`: "never ease-in on UI".
Springs are sampled `linear()` curves with a paired `-ms` duration: toggle 385 ms (320 ms in classic/domus), tab 438 ms,
dialog 375 ms (300 ms), drawer 630 ms, kpi 350 ms (`arx-motion.ts`; `polish-motion.ts` reuses the toggle and dialog curves,
tab becomes the plain strong ease-out). Base (non-Arx) skins keep plain curves at 120/200 ms.
Validation: `design/semantic.ts` (`validateSkinTable`) enforces `<n>ms` / `<n>px` units and `exit <= sheet`.

## 2. What may animate

Composite-only: `transform` and `opacity`, plus colour on the hover curve (`background`, `border-color`, `color`,
`box-shadow` in the button/chip rule). No `transition: all`; every duration is a token (`arx-motion.ts` rule header).
`polish-motion.ts` states "Only `opacity` and `transform` move" for entrances (animation-performance skill).
`will-change` is not used by the design layer.

## 3. Press and hover

- Buttons and chips: `transform: scale(var(--sw-press-scale))` on `:active:not(:disabled)`, transition `--sw-t-press` with `--sw-ease`
  (`skins/arx-motion.ts`, rule "arx motion 1").
- Switch: track fades on `--sw-t-med`; thumb rides `--sw-spring-toggle` for `--sw-spring-toggle-ms` (rule "arx motion 2").
- Hover lift (`--sw-hover-lift`): `0px` by default; `-2px` in `soft` (`skins/soft.ts`). Hover is gated to
  `(hover: hover) and (pointer: fine)` (`DS/COMPONENT_RULES.md` section 1 table, "Hover"; `DS/DESIGN.md` Cards: tappable card scales 0.99 on press).
- Hover colour changes use `--sw-t-hover` with `--sw-ease-color`.

## 4. Entrance cascades

`ENTER_RULES` in `skins/polish-motion.ts` (classic and domus only): keyframes `sw-enter` (fade + `translateY(var(--sw-enter-y))`),
applied to `sw-card`, `sw-kpi`, `sw-table`, `sw-state-panel`, home widgets and device tiles, `both` fill, `--sw-ease`.
Stagger by sibling: 2nd = 1x, 3rd = 2x, 4th and later = 3x `--sw-stagger`. Intent in the file header: frequency gate, near-imperceptible,
under the 300 ms UI ceiling, never blocks input. infra/soft carry the entrance tokens but no `sw-enter` rule (see Open questions).

## 5. Status and alert motion

- Live dot pulse: `sw-badge` (`kind='live'`, keyframes `pulse`, opacity 1 to .35) in `frontend/src/components/sw-badge.ts`; camera-tile live dot
  `breathe` 2.4 s, opacity 1 to .45 in `frontend/src/components/sw-camera-tile.ts`. Opacity only; the stale state sets `animation: none`.
- Skeleton: shimmer `shine` 1.4 s, `translateX` of a pseudo-element (`frontend/src/components/sw-skeleton.ts`).
- State panel: `state-in` fade + `scale(.97)`; loading spinner `spin` (rotate) (`frontend/src/components/sw-state-panel.ts`).
- Sheet/dialog: spring open on `--sw-t-sheet`, close on `--sw-ease-out`; content "focuses in" (`frontend/src/components/sw-sheet.ts`).
- Toast: rises 8 px; dialog lands from scale .96 + fade; drawer slides from its edge (`DS/DESIGN.md` "Motion").

## 6. What never animates

From `DS/DESIGN.md` ("Motion", "Cheap Wall Rule"): no page-load choreography (but see Open questions), no hover lifts on touch,
nothing on keyboard-triggered actions, nothing on camera tiles ("no shadow, no blur, no animation", 32 tiles must stay cheap).
Hover is off on coarse pointers (`DS/COMPONENT_RULES.md`). Layout properties (width, height, top, left, margin) are not animated.

## 7. Reduced motion

Two inputs, one result (`frontend/src/design/css.ts`, `design/apply.ts`, `design/semantic.ts`):
1. Setting `ui.motion` = `auto | full | reduced` (MOTIONSETTING-297; type in `frontend/src/api/media.ts`, applied as `<html data-motion>`; UI in system design settings).
2. OS `prefers-reduced-motion: reduce`.

- `auto`: the OS query applies. `full`: the query is excluded via `:root:not([data-motion="full"])`. `reduced`: the same declarations
  always apply via `:root[data-motion="reduced"]`. The two blocks are byte-identical (`REDUCED_MOTION_DECLS`), `!important`, and cover every skin
  light and dark.
- Effect: all durations in `MOTION_DURATIONS` go to `0ms` (including spring `-ms`, `--sw-stagger`, `--sw-enter-ms`), `--sw-hover-lift` and
  `--sw-enter-y` to `0px`, `--sw-press-scale` to `1`. Colour/opacity feedback stays; travel, springs and scale go
  (`semantic.ts` header, `DS/DESIGN.md`).
- Tests: `frontend/tests/unit-motionsetting-297.spec.ts` (CSS contract), `frontend/tests/smoke-motionsetting-297.spec.ts` (setting, `data-motion`, tokens),
  `frontend/tests/unit-designtokens-297.spec.ts` (generated block).
- Component-local fallbacks under the OS query only: skeleton shimmer off, live dots off, state panel fades 160 ms instead of scaling, spinner
  slows to 2.4 s, sheet transitions `none` (`sw-skeleton.ts`, `sw-badge.ts`, `sw-camera-tile.ts`, `sw-state-panel.ts`, `sw-sheet.ts` under `frontend/src/components/`).

## 8. Per-skin differences

Only four skins set motion values. `infra` and `soft` take `ARX_MOTION_TOKENS` + `ARX_MOTION_RULES` (`skins/infra.ts`, `skins/soft.ts`);
`soft` additionally has `--sw-hover-lift: -2px`. `classic` and `domus` take `POLISH_MOTION_TOKENS` + `ENTER_RULES`. All other skins
(bubble, crystal, tesla, and any further) keep the neutral base values. No skin writes a `data-motion` rule (asserted in `unit-motionsetting-297.spec.ts`).

## Open questions

1. Press scale: `DS/DESIGN.md` says .97; classic/domus use .96 (`polish-motion.ts`), infra/soft .97. Intentional per-skin split?
2. Durations: `DS/DESIGN.md` and `DS/TOKENS.md` list fast 120 / medium 200 / slow 280 ms; code in infra/soft is 160 / 220 / 280 (press 140, hover 160).
3. Entrance: `DS/DESIGN.md` says "no page-load choreography", but `ENTER_RULES` (classic/domus) animates panels on entry, and `polish-motion.ts`
   cites an owner decision (P7). infra/soft define `--sw-enter-*` tokens (non-zero) yet no `sw-enter` rule consumes them there. Which is the rule?
4. Camera tiles: `DS/DESIGN.md` says no animation on camera tiles, yet `sw-camera-tile.ts` animates the live dot (`breathe`), and its comment says
   "still under reduced motion" while the CSS sets `animation: none` under the OS query.
5. Component-level `@media (prefers-reduced-motion)` blocks ignore `ui.motion`: with `data-motion="reduced"` on a non-reduced OS, shimmer, pulses and
   spinner keep running; with `data-motion="full"` on a reduced OS they still stop. `sw-sheet.ts` also reads the OS query through `matchMedia`.
6. `DS/DESIGN.md` says "keyframe animations stop (the spinner may keep turning)"; code slows the spinner to 2.4 s rather than leaving it unchanged, and the
   skeleton still shimmers under `data-motion="reduced"` (see 5).
7. `sw-sheet.ts` `focus-in` keyframes animate `filter: blur(6px)`, not composite-only; the sheet also hardcodes 180/200/240/250/260 ms
   in places instead of tokens.
8. `DS/DESIGN.md` toast rises 8 px; toast duration is token-driven (400 ms infra/soft vs 260 ms classic/domus) with no documented rule for the difference.
9. `frontend/src/screens/area-quick-sheet.ts` uses `will-change: transform`; no written rule on `will-change` exists.
10. `private/design-system-2026-10-27/` is gitignored in this repository; the DS citations above are not reviewable from a clean checkout.
