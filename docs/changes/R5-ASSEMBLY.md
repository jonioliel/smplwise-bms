# R5 design round: assembly record (release/2270-r5)

Date: 2026-10-28. Base: `pilot/HOMEFABLE-297` @ `e4e67daa9`. Real `--no-ff` merges (no rebase, no squash), in this order:

| # | Branch | Head | Result |
|---|--------|------|--------|
| 1 | `pilot/AREAPOPUP-297` | `03e371f88` | Already up to date: the branch is an ancestor of HOMEFABLE (0 commits ahead). No merge commit. |
| 2 | `pilot/R5-SYSTEM-297` | `d264d226d` | Clean merge `f3d28c2df` (19 files). |
| 3 | `pilot/R5-LIVE-297` | `92bfbd392` | Clean merge `a3ad7c789` (13 files). |
| 4 | `pilot/R5-INVESTIGATE-297` | `8da3a3b2e` | Clean merge `78da4d0c8` (16 files). |
| 5 | `pilot/R5-MEDIA-ENERGY-297` | `888478907` | Clean merge `10c7116b1` (23 files). |
| 6 | `pilot/R5-DEVICES-297` | `227de1df1` | Clean merge `d12d4cda7` (18 files). |
| - | base defect fix | `c23a94a4a` | `devices-building.ts` floor title `font-size: 20px` -> `var(--sw-fs-2xl)` (the token is exactly 20px: pixel-neutral). |
| 7 | `pilot/R5-MAPS-297` | `610634505` | Textually clean merge `344ad9a49` (9 files); one semantic overlap, see below. |

Not merged (still in progress or out of scope): `pilot/R5-SECURITY-WISKEY-297`, `pilot/WISKEY-MAC-ADOPT-297`.

## Shared files

Every group branched from the same HOMEFABLE head and no two of the first five groups touched the same file, so each shared
file below was merged exactly once, with its single owner's intent kept as-is (no hand edits during assembly):

- `components/sw-camera-tile.ts` (LIVE): the disconnected-tile fix, seen on the wall and kiosk screens.
- `components/sw-badge.ts` (INVESTIGATE): new additive `filled` attribute; without it the badge is unchanged.
- `components/sw-table.ts` (INVESTIGATE): two CSS hooks `--sw-table-cell-pad` / `--sw-table-fs` whose defaults equal the old values
  (9px 14px, fs-sm), so no other table moves.
- `components/sw-state-panel.ts`, `styles/settings.ts`, `shell/sw-app.ts` (SYSTEM).
- `components/media-player-card.ts`, `components/media-screen-card.ts` (MEDIA-ENERGY, title size).
- `components/sw-automation-row.ts`, `components/sw-automation-card.ts`, `styles/automations-glass.ts` (DEVICES).

## RESOLVED: `screens/investigate-history-map.ts` (INVESTIGATE x MAPS)

Owner decision 2026-10-28: option (a), the MAPS look. The base `.bar` / `.time` rules went back to their pre-R5 form (the rules
the MAPS block was written over), so the time bar renders exactly as on `pilot/R5-MAPS-297` @ `610634505`: the recorded-tone
status field with the 26 px recorded-tone time. Both rule pairs were compared with that branch and are identical. INVESTIGATE's
other changes to the file stay: `dl` / `dt` / `dd`, the event-row wells, the press feedback, hover only under a fine pointer, and
the `INVESTIGATE_R5` sheet, which has no `.bar` / `.time` rules. The analysis that led to the decision follows.

### Analysis at merge time

Both groups restyled the same history-map screen, in different hunks, so git merged it without a conflict. The cascade result is
a hybrid neither group designed:

- INVESTIGATE edited the base rules: `.bar` became a neutral raised strip (`--sw-surface`, `--sw-border`, radius lg, shadow 2);
  `.time` 20px / 800 in `--sw-heading`; `dt`/`dd` and `.evl a` resized; hover gated to fine pointers; `INVESTIGATE_R5` appended.
- MAPS appended a later override block: `.bar` keeps the "recorded" tone (it relied on the old `--sw-recorded-soft` background)
  with a `--sw-recorded` border; `.time` 26px / 700 in `--sw-recorded-text`; `h1` 26/700; `.stage`, `.chip`, `.hist`, `.evl a.hit`.

Effective now: the MAPS block wins where both set a property (time 26px recorded ink, recorded border, `dt` in text-2), while the bar
background is INVESTIGATE's neutral surface (MAPS did not restate it). So the bar has a recorded-tone border on a neutral surface
and a 26px recorded-ink time. The intent conflict (neutral control strip vs recorded status field) is a design call, not a merge
call, so it was left as merged and not hand-resolved. Decision needed: (a) MAPS look (restore `background: var(--sw-recorded-soft)`
in the MAPS block), (b) INVESTIGATE look (drop `.bar` / `.time` from the MAPS block), or (c) keep the hybrid.

## Merge of `main` (v2.25.0, `83a7c795f`) into the branch

`main` was 66 commits (240 files) ahead, and the branch was 61 commits ahead (merge base `b03730a1b`). A real merge of `main`
(`2bde44771`) gave no textual conflicts. Ten files changed on both sides. Each was read on both sides, and none clashes, because
main changed behaviour or layout while R5 changed the visual styling in other rules:

- `design/tokens.ts`: main adds the `rail` and `elevator` token groups (SKINCOMP-297); HOMEFABLE adds `--sw-popup-blur` and tunes the
  dark `--sw-lit-soft`. Different lines.
- `elevators/styles.ts`: main moves the `--sw-el-*` literals from `:host` to the tokens with the same values; MEDIA-ENERGY restyles
  the badge, the sensor lights and the bar, and still reads the same variables.
- `elevators/home-widget.ts`: main fixes the container width (WIDGETFIX-298); the branch restyles the title, rows and alert cards.
- `screens/home-widgets.ts`: main adds the row-band rules (WIDGETFIX-298) at the end of the sheet; the branch's edits are earlier.
- `screens/door-windows.ts`: main adds the emergency engine switch and its confirm dialog (SPLITSWITCH2-297); the branch changes CSS only.
- `screens/automation-drawer.ts`: main's XSECFIX-297 `addressAction` rule (logic) is kept; DEVICES changes styles only.
- `screens/electricity/page-meters.ts`: main's GATEFIX2240 grid rows (`max-content`, `align-content: start`) apply together with
  MEDIA-ENERGY's card styling.
- `screens/system-design.ts`: main adds the motion and rail-tone settings (logic and markup); SYSTEM restyles the skin cards.
- `shell/sw-app.ts`: main passes `ui.motion` / `ui.rail_tone` to `setInstallationDesign`; SYSTEM and POLISH restyle the phone bar
  and the rail pill.
- `backend/.../routers/settings.py`: main adds `ui.motion`, `ui.rail_tone` and `docread.enabled`; the branch adds the
  POLISH-CONTROL `home.*` / `ui.long_lists` keys. Different keys.

One clash showed up only in the tests. Main's `tests/unit-skincomp-297.spec.ts` asserted `SKINS.classic.tokens` `{}` and
`SKINS.classic.rules` `''`. The owner-approved polish rounds already in the HOMEFABLE base (POLISH-CLASSIC-DOMUS-297,
POLISH-BOLD-297) give classic its own tokens and rules, so those two lines were stale. They were removed. The guard the spec
exists for still runs for classic in the loop above them: no rail or elevator override, no dark rail, no Arx rule. No product
code changed (the spec passes 6/6).

`git merge-base --is-ancestor main release/2270-r5` returns 0. `smplwise_vms/www` is identical to main: the UI rebuild into
`www` is left for the runner.

## Fix after the MAPS merge: `screens/plan-studio-panel.ts`

MAPS added a side-effect `import '../components/sw-icon'` to `plan-studio-panel.ts`. That module is a render-helper module, and
three Node-side unit specs import plain helpers from it (`unit-geometry` reads `fmtArea` / `fmtMetres`; `unit-curve-fit` and
`unit-glass-wall` reach it transitively). Loading the decorated Lit component in Node fails at collection
("Unsupported decorator location: field"), which aborts the whole `unit-*` run. Both hosts of the panel
(`explore-floor-map.ts`, `explore-plan-editor.ts`) already register `sw-icon`, as does the shell, so the import was removed;
no runtime or visual change.

## Verification

Run on the assembled tree (with the plan-studio-panel fix), Windows workstation, 2026-10-28:

- `npx tsc --noEmit`: exit 0.
- `npx vite build`: exit 0 (only the usual chunk-size warning).
- `npx playwright test tests/unit- --project=desktop` (all 349 `unit-*` files, preview on a private port 4791):
  3372 passed, 2 failed, 8 skipped. `unit-token-lint.spec.ts` passed.
  - The 2 failures are `unit-plan-3d-determinism` (3D pixel baselines, 1.15 % vs 0.2 % allowed, "on the renderer that drew
    them") and `unit-plan-3d-odd` test 5 (export button background transparent). Both fail the same way on the untouched base
    `pilot/HOMEFABLE-297` @ `e4e67daa9` (checked with the same command), and no R5 branch touches the 3D sources: pre-existing,
    not caused by the assembly.
- Not run here: the gate, the browser / evidence / layout / pixel suites (runner only).
