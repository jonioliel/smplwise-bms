# AUDIT30-D-MULTIMEDIA - round-30 consistency audit, branch D (multimedia)

Branch `pilot/AUDIT30-D-MULTIMEDIA`, cut from `origin/pilot/AUDIT30-BASE` @ `2a6430586` (main v2.43.2 + SYS-AUDIT-QUICKFIX-2437 +
NOSCROLL-1366-2437). Plan: `private/design-system-2026-10-27/round30/system-audit/FIXES.md` sections 0, 1, 5, 13. Frontend only; no
device, lab or backend change. Only files branch D owns were edited (`screens/multimedia-*.ts`, `components/media-*.ts` except
`media-remote-css.ts`, `styles/media-page.ts`) plus tests.

## Owner gates (assumed option a, the audit page's recommendation; the lead rewrites an item if the owner answers otherwise)

| Gate | Question | Assumed |
|---|---|---|
| Q3 | how a selected chip looks | a: light blue fill, blue text (the design document's Blue Wash pair) |
| Q7 | control screens that scroll | a: fix all of them, only an inner panel may scroll |

## Changes

| Item | Finding | Files | Change |
|---|---|---|---|
| D1 | #4 | `styles/media-page.ts`, `screens/multimedia-screens.ts` | `.rc[aria-pressed='true']` (the room chips of screens and players) was a black pill (`--dv-text` fill, `--mm-text-inverse` ink, control shadow); now `--sw-accent-soft` fill, `--sw-accent-text` ink, no border, no shadow, semibold. The chip is `--sw-ctl-h-md` high (34 px classic, was 38) and keeps 44 px on `(pointer: coarse)` / phone. The screens page's chips got the focus ring the players page already had. No other `media-*` file copied the black rule (the remaining dark fills are the play / pause keys, not a selected state). |
| D2 | #17 | `styles/media-page.ts`, `screens/multimedia-screens.ts` | `.sh h2` (floor heading on screens and players, section heading on groups) `--sw-fs-3xl` / 800 -> `--sw-fs-xl` / `--sw-fw-semibold`. One `<h1>` per screen (now sw-page's). |
| D3 | #6 | `screens/multimedia-{screens,players,groups}.ts`, `styles/media-page.ts` | Each screen is framed by `<sw-page class="page" wide heading=...>`: the title is sw-page's `<h1>`, the counts line ("4 פועלים מתוך 8", "7 מנגנים מתוך 16", "2 קבוצות פועלות · 3 שמורות") is its `subheading` (not on the phone, as before), the floor menu (groups: the pager) sits in `slot="actions"` at the end of the title row. The local `<h1>` and its CSS are gone. The filter bar (room chips, pager, state filter, search) is one row under the title, still sticky and compacting while the page scrolls (tablet / phone); on the phone the room row is what stays stuck (it used to be the title and the floor menu). Page padding now comes from `--sw-page-pad` (sw-page) instead of a local 36 px. Groups lost its sticky header (it only held the title and the counts). |
| D4 | #5 (Q7 a) | same | Kept from NOSCROLL-1366-2437: from 1024 x 560 the screen takes the window height and the cards region pages (`sw-pager`) instead of scrolling; the region bleed follows `--sw-page-pad`. Not done: "the floor chip filters to one floor by default" (see open questions). |
| D5 | literals | 13 `media-*` / `multimedia-*` files | Every raw-ms duration in a transition / animation became a token: press `var(--sw-t-press)` (the `, 120ms` fallbacks removed), hover `--sw-t-hover`, colour / fades `--sw-t-med`, the remote's own `--mr-motion`, spinners `calc(var(--sw-t-med) * 4)` (800 ms), blinks `calc(var(--sw-t-med) * 8)`; reduced-motion `transition-duration: 0.01ms` -> `transition: none`. Every px border radius became `--sw-r-pill` / `--sw-r-xl` / `--sw-r-2xl` (pill shapes, hairlines and progress tracks -> pill). The sticky bar's literal shadow -> `--dv-shadow-1`. |

No new colour, radius, font-size or duration literal; no new `<select>`, `<table>`, `<dialog>`, `<h1>`.

## Measurements

Static counts (`tools/source-counts.mjs`, group "מולטימדיה", which also counts branch A's `media-remote-css.ts`):
before = `C:/cloude/smplwise-audit30base` (`2a6430586`, this branch's base), after = this branch.

| Count | Before | After | Note |
|---|---|---|---|
| raw-ms durations | 54 | 24 | the 24 left are all in `media-remote-css.ts` (branch A) |
| token durations (`var(--sw-t-`) | 12 | 32 | |
| px border radii | 61 | 31 | the 31 left are all in `media-remote-css.ts` |
| hex / rgba literals | 127 / 155 | 127 / 154 | see known limits |
| `<h1` | 3 | 0 | |
| `<sw-page` | 0 | 9 (3 screens) | |

The audit's probe (`tools/shoot.mjs` + `tools/analyze.mjs`, run from a scratch copy of `tools/` and `data/`): this branch's
`vite build` served by `vite preview` on 127.0.0.1:4394, routes `mm-screens,mm-players,mm-groups`, every viewport and scheme plus
`--vps contract --schemes light` (1366x768). Before = the audit's own `data/summary.json` (v2.43.1, `ab7894837`; the base of this branch
already carried NOSCROLL-1366-2437, which had taken the page scroll to 0).

| Screen | Metric | Before (v2.43.1) | After |
|---|---|---|---|
| מסכים (`mm-screens`) | `<h1>` host / size | `multimedia-screens` 30/800 x1 | `multimedia-screens>sw-page` 30/800 x1 |
| | uses `sw-page` (`pg`) | 0 | 1 |
| | page scroll 1366x768 / 1440x900 | 549 / 446 | 0 / 0 |
| | page scroll tablet / phone (allowed below 1024) | 2712 / 1242 | 2602 / 1004 |
| | off-scale buttons / off-scale radii | 11 / 12 | 2 / 6 |
| | contrast failures light / dark | 0 / 0 | 0 / 0 |
| | touch targets < 44 px (phone) | 3 | 3 (the shell's search pill, the shared floor dropdown 32 px, the search input 29 px) |
| נגנים ורמקולים (`mm-players`) | `<h1>` host | `multimedia-players` | `multimedia-players>sw-page` |
| | uses `sw-page` | 0 | 1 |
| | scroll 1366x768 (panel) / 1440x900 | 1537 / 1009 | 0 / 0 |
| | off-scale buttons / radii | 15 / 8 | 2 / 3 |
| | contrast light / dark | 0 / 0 | 0 / 0 |
| | touch < 44 px (phone) | 4 | 4 |
| קבוצות (`mm-groups`) | `<h1>` host | `multimedia-groups` | `multimedia-groups>sw-page` |
| | uses `sw-page` | 0 | 1 |
| | scroll 1366x768 / 1440x900 | 960 / 828 | 0 / 0 |
| | off-scale radii | 11 | 12 (`--dv-*` radii of the member rows, 28 px: branch A's knobs) |
| | contrast light / dark | 0 / 0 | 0 / 0 |
| | touch < 44 px (phone) | 1 | 0 |

Selected room chip: black pill (`--dv-text` fill) -> the soft accent pair, checked by computed style in light and dark against
`--sw-accent-soft` / `--sw-accent-text` (34 px high). Floor heading 26 px / 800 -> 18 px / 600 (classic `--sw-fs-xl`).
The probe reports no non-Heebo family on the three screens (before: `-apple-system`). Screenshots: `evidence/AUDIT30-D-MULTIMEDIA/before/`
(the audit's) and `after/` (1440 desktop, 768 tablet, 375 phone, light and dark; `contract` = 1366x768).
Design skills: `evidence/AUDIT30-D-MULTIMEDIA/inspect/` (ui-ux-pro-max search output, emil-design-eng table, impeccable detector on
the sources and on the page: it returned `[]` both times - it does not read Lit shadow roots, so it is reported, not counted).
ui-ux-pro-max: taken - chips stay native buttons with `aria-pressed` and a visible focus ring (added on the screens page); rejected -
"wrap the chip collection": the owner's no-scroll rule keeps the room row one line that scrolls sideways (drag + fade), wrapping would
take a row of cards off every page.

## Tests

| Command | Where | Outcome |
|---|---|---|
| `tsc --noEmit` (`run_smart.py tsc`) @ `31284be6c` | runner | `tsc ok` |
| `vite build` | workstation | built (6 m 56 s) |
| `run_smart.py preview <branch> audit30-d-multimedia unit-uxfix-nav-295 unit-lead-reserve layout-noscroll-1366 evidence-media-screens evidence-media-players evidence-mobile-scroll evidence-mobile-scroll-players evidence-tabs-pair-scroll evidence-tabs-dropdown --project=desktop --project=mobile --workers=1` @ `31284be6c` | runner (vite preview of the build) | 192 passed, 27 failed, 53 skipped. New spec 13 / 0 / 5 (phone-only skips), unit-uxfix-nav-295 14 / 0, unit-lead-reserve 8 / 0, layout-noscroll-1366 26 / 0, evidence-media-screens 50 / 0, evidence-media-players 57 / 1. Of the 27: 24 are the four specs that import `/src/...` modules and only run on a dev server ("Failed to fetch dynamically imported module", harness, see the next rows); 2 were the groups case of `evidence-mobile-scroll-players` (it read the groups' sticky bar, which D3 removed: test adapted in `d77fdb6c6`); 1 was `evidence-media-players` "the editor of saved groups" on mobile (60 s timeout on the loaded runner). |
| `evidence-media-players -g "editor of saved groups" --project=mobile` | workstation, vite preview of the build | 1 passed |
| `evidence-mobile-scroll-players --project=mobile` (after the adaptation) | workstation, vite preview | 4 passed |
| `evidence-mobile-scroll evidence-mobile-scroll-players evidence-tabs-dropdown evidence-tabs-pair-scroll --project=desktop --project=mobile --workers=2` @ `d77fdb6c6` | workstation, Vite dev server | 50 passed, 0 failed, 22 skipped (project skips by design) |
| `run_smart.py preview <branch> visual-matrix.spec.ts -g multimedia-screens -u --workers=1` @ `d77fdb6c6` | runner | 5 passed (re-taken), 1 failed: desktop light, `waitForSelector('sw-app')` 60 s timeout on the overloaded runner (load > 70) |
| same, `-g "multimedia-screens ready light" --project=desktop -u` | runner | 1 passed (re-taken); the six baselines committed in `56c526d04`; the main checkout stayed clean |
| proof run of the six without `-u` | runner | NOT_RUN: runner load average 161 (lead rule: start only below 30); left to the entry check (`~/gate2/branch_check.sh`, queued) |
| `audit30-d-multimedia.spec.ts` after the last code commit | - | ran on the runner at `31284be6c` (13 passed / 5 skipped); `d77fdb6c6` and later change only tests, docs and baselines |

## Known limits

- Hex / rgba: most are in `media-remote-css.ts` (branch A). In this branch's files the rest are (a) the art-layer whites and blacks drawn
  over artwork (sheen, scrim, spinner veil on the screen / player cards, the same in both schemes; no `--dv-*` knob matches them and
  the plan says not to add knobs), (b) the per-content art tints in `media-now.ts`, `media-player-now.ts`, `media-remote-keys.ts`,
  `media-remote.ts` (data passed as `--a1` / `--a2`, not CSS rules), (c) `#000` in mask gradients (alpha only). They need knobs in
  `styles/media-glass.ts` (branch A's) if they are to move.
- Two glyph font sizes stay px (`media-now-hero.ts` 56 px, `media-player-css.ts` 38 px: icon glyphs above the type scale).
- The filter bar is a row under the title now, so the cards region is ~30-40 px shorter at 1366x768 than on the base; the pager
  absorbs it (more pages, never scroll).
- D4 "the floor chip filters to one floor by default" is not done: the base's paging already keeps the screens from scrolling, and a
  default floor changes what every operator sees first and the address of the page (open question for the lead / owner).
- The floor menu moved from the room row to the end of the title row (sw-page `actions`); at 1366 px it sits beside the shell's floating
  search corner (the shell's `--sw-float-reserve` keeps them apart).
- The selected chip and the section heading rules exist twice (`styles/media-page.ts` and the screens page's own copy, as before);
  the spec checks both.

## Rollback

Revert the merge commit. No data, settings or API changes.
