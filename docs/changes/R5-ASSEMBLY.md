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

## OPEN: `screens/investigate-history-map.ts` (INVESTIGATE x MAPS)

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

## Fix after the MAPS merge: `screens/plan-studio-panel.ts`

MAPS added a side-effect `import '../components/sw-icon'` to `plan-studio-panel.ts`. That module is a render-helper module, and
three Node-side unit specs import plain helpers from it (`unit-geometry` reads `fmtArea` / `fmtMetres`; `unit-curve-fit` and
`unit-glass-wall` reach it transitively). Loading the decorated Lit component in Node fails at collection
("Unsupported decorator location: field"), which aborts the whole `unit-*` run. Both hosts of the panel
(`explore-floor-map.ts`, `explore-plan-editor.ts`) already register `sw-icon`, as does the shell, so the import was removed;
no runtime or visual change.

## Verification

See the assembly report for exact counts: `npx tsc --noEmit`, `npx vite build`, `tests/unit-*.spec.ts` (Playwright, desktop project,
private preview port), including `unit-token-lint.spec.ts`. Browser / pixel suites of the gate were not run here.
