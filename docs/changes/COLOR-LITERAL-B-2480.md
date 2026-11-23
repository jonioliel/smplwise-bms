# COLOR-LITERAL-B-2480 - colour literals to tokens outside components/, styles/, screens/ (pixel-neutral)

Row of 2.48.0 (two agents; COLOR-LITERAL-A owns `components/`, `styles/`, `screens/`). Base: `origin/release/2470-train`
`2c211966d`, merged again at `092bbc9a1` (2.47.0, HOME-V3-SEGMENTS). Branch `pilot/COLOR-LITERAL-B-2480`.

## Rule followed

A literal is replaced only by a token whose computed value is identical wherever the rule renders. Two kinds of
replacement were used:

1. **An existing global token with the same text, set by no skin**: `sw-plan-3d`'s night sky
   `linear-gradient(180deg, #060b18 0%, #152442 100%)` is exactly `--sw-map-stack-night` (`same(...)` in `design/tokens.ts`,
   overridden nowhere, already read by `room-pill-view` on the same host).
2. **A module-scoped token, declared once in the module's own sheet** (on the sheet's `:host`, or on `:root` for the two
   pages without the token sheet, `notice-tv` and `public-ticket`) for a literal that the module's RULES repeat. The
   names are fresh (no other sheet, theme or skin block declares them), so every theme / scheme / skin resolves the literal
   it had. A fallback literal becomes `var(--sw-x, var(--module-y))`, which resolves exactly as before whether `--sw-x` is set
   or not.

Left alone on purpose:

- **Palette tables** (custom-property declarations that ARE a module's palette: the home themes `--hs-*` x 14 theme / scheme
  blocks, the TV skins' `--bg` / `--ink` / ..., public-ticket's light / dark `--sw-*` table, calendars, pwa, wall, electricity
  chart). They are the module's token definitions; pointing one table entry at another would only hide the value. About 830 of
  the counted literals in this scope are such declarations.
- **JavaScript colour data**: canvas / three.js / WebGL colours (`map/skin-control.ts`, `scene-real.ts`, `look-style.ts`,
  `room-glow-mesh.ts`, `floor-finish.ts`, `still-bake.ts`, `plan-wizard/wizard-draw.ts`, `notice-tv/skin-board.ts`), user palette
  data (`api/timeline-colors.ts`, `calendars` colours) and the wall artwork gradients (`home/home-wall.ts`). A `var()` cannot
  stand there.
- **`::selection`** (home): highlight pseudos keep their literal.
- **Single literals** (one occurrence in a sheet): a token would replace one literal by one literal.

## What changed

| Module | Tokens (declared once) | Literals |
| --- | --- | --- |
| `home/` (home-styles, -v3, -p3, -extra; one `:host` in home-styles.ts, the other three sheets are only adopted with it) | `--hs-white`, `--hs-black`, `--hs-scrim`, `--hs-cam-black`, `--hs-cam-off-ink`, `--hs-hover-light`, `--hs-thumb-shadow` | -36 |
| `notice-tv/` (tv, tv-v2, tv-hitech, tv-luxury, tv-skins; all imported by main.ts into the one page; `:root` in tv.css) | `--tv-white`, `--tv-black`, `--tv-clear`, `--tv-saver-*`, `--tv-alert-red-1..3`, `--tv-alert-ink`, `--tv-darkplate`, `--tv-prism-*`, `--tv-stone-scrim*`, `--tv-sign-ink-2` | -43 |
| `map/` | `--sw-map-stack-night` (existing); `--p3d-night-navy`, `--p3d-chip-shade`; `--pc-white`; `--ps-blue`, `--ps-red` | -12 |
| `electricity/elec-bill-paper.ts` | `--bp-white`, `--bp-ink`, `--bp-ink-2`, `--bp-rule` | -11 |
| `elevators/styles.ts` | `--el-white`, `--el-ink`, `--el-shade`, `--el-door`, `--el-door-off` | -10 |
| `xsection/` (both fire-bar components, the tile sheet) | `--fb-*`, `--fbb-*`, `--xt-white` | -8 |
| `temperature/`, `wall/`, `maintenance/` tags, `plan-wizard/`, `public-ticket/` | `--tc-on-solid`, `--tc-solid-edge`, `--wl-text-shade`, `--tg-ink-2`, `--wz-paper`, `--pt-white` | -6 |

`color-literal`: 2497 -> **2372** (-125). Merge note: the train's HOME-V3-SEGMENTS replaced the `.seg` group in home-styles.ts by
`sw-segmented` host rules; the chosen key's light fill (`--sw-seg-on-bg: #fff`) reads `--hs-white` like the rule it replaced.

## Proof of "no pixel change"

- **Static, per file**: `verify.py` (scratchpad, not committed) puts every `var(--token)` back to the token's value, removes
  the inserted definitions and compares with the base file after normalising colour literals (`#fff` = `#ffffff`,
  `rgba(0, 0, 0, 0.6)` = `rgba(0,0,0,.6)`): EQUIVALENT for all 21 touched files (home files re-checked against the train after the
  merge). It also asserts that no token name is declared a second time in the file.
- **Pixel specs on the runner, no `-u`**: see "Tests".

## Tests

Run on the PC:

- `npx tsc --noEmit`: PASS (exit 0) before and after the train merge.
- `pytest smplwise_vms/backend/tests/test_build_guards_2438.py` (the ratchet's own tests): 10 passed.
- `py -3.12 scripts/design_ratchet.py`: no count above the baseline; `--update` lowered `color-literal` 2497 -> 2372 (the
  only metric that moved; the train's other numbers are unchanged).
- Static equivalence (`verify.py`): EQUIVALENT, 21 / 21 files.

Runner (pixel specs, no `-u`): the full set of spec files with Linux baselines (1347 tests) was started at `a8764a50e` in
`~/work/colb` (output `~/work/colb-head-out/`, script `~/work/colb-px.sh`, port 4593, `nice -n 19`, 2 workers) at 09:15 while
no gate was running; the build passed (`build rc=0`). The 2.47.0 gate then started beside it, the runner overloaded, and
on the lead's instruction the run was stopped (`kill -TERM` of its Playwright leader, then its orphaned `vite preview`;
nothing of it is left) after **771 of 1347 tests (the whole `desktop` project and the start of `tablet`)**: **PARTIAL**.
In those 771 there is **no screenshot difference** (no "pixels (ratio ...)" message in the log); 5 tests failed, all on a
5 s screenshot-stabilisation timeout or a 180 s browser-launch timeout under the load (`evidence-wiskey-installer` :318,
`pixel-bustimes-295` :39, `pixel-dialog-toplayer-2381` :51, `pixel-wiskey-station-media` :111, `pixel-wiskey-stations` :153),
none a pixel mismatch. The specs reaching the touched modules that ran on desktop: `pixel-home-auditfix-2437`,
`pixel-home-fb-2431`, `pixel-home-gaps-2436`, `pixel-notice-tv-portrait-chips`, `pixel-bustimes-295` (timeout, above),
`pixel-plan3d-r28-ui`, `evidence-replay-3d`, `pixel-plan-wizard-2433` / `-2434`, `pixel-wall-plan`, `pixel-wall-followups-2390`,
`evidence-audit30c-tickets` (part of the same list also on tablet). The `tablet` / `mobile` rest and the five
timeouts are **NOT_RUN** and wait for the gate verdict (re-run with `gatewait` first: `~/work/colb-px.sh head <sha> 4593`).
Any pixel difference that the train itself does not have = revert.

No pixel baseline is changed, no PNG is committed. No comparison page: the change is meant to be invisible (pixel-neutral).
