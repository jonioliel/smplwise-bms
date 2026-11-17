# AUDIT30-H-WISKEY: WisKey native screens (design audit round 30, branch H)

Branch `pilot/AUDIT30-H-WISKEY`, cut from `origin/pilot/AUDIT30-BASE` (`2a6430586` = main v2.43.2 + SYS-AUDIT-QUICKFIX-2437 +
NOSCROLL-1366-2437). Plan: `private/design-system-2026-10-27/round30/system-audit/FIXES.md` sections 0, 1, 9 (H1-H6) and 13.
Frontend only: no WisKey backend, no door / intercom device, no go2rtc stream, no home screen was touched.

**Owner gates:** every GATE item was built on the recommended option **א** (FIXES.md rule 0.3): Q4 (KPI tile variants, H1) and
Q10 (English / technical terms on operator screens, H3). If the owner picks another option the lead rewrites that item.

**Files (all inside branch H's ownership):** `frontend/src/screens/wiskey-overview.ts`, `wiskey-format.ts`, `wiskey-people.ts`,
`wiskey-schedules-css.ts`. Tests: new `frontend/tests/layout-audit30h-wiskey.spec.ts`; `evidence-wiskey-people{,-native,-writes}.spec.ts`
now drive the people filters through `sw-dropdown`. Pixel baselines refreshed on the runner (section 4).

## 1. Changes

| Item | Finding | Before | After |
|---|---|---|---|
| H1 | #7 KPI tiles | `wiskey-overview`: two `<sw-kpi>` in the tall "cards" layout, 108 px each, grid columns 140-240 px | `layout="compact"` (DESIGN.md "KPI tile", 60 px), grid `minmax(var(--sw-kpi-compact-col-min, 168px), 240px)` (COMPONENT_RULES §3 compact minimum) |
| H2 | #12 ringing badge | the ringing door's `<sw-badge kind="stale">`: amber wash with a **dashed** amber edge | `kind="stale" filled`: the solid amber-ink field of the shared filled badge (SYS-AUDIT-QUICKFIX-2437 contrast pair), **solid** edge. `sw-badge` has no `warning` kind; `stale` is its only amber kind, and `sw-badge.ts` belongs to branch B, so no new kind was added |
| H3 | #15 terms | title "WisKey · מרכז הכניסה" (also "WisKey" + subheading on the loading / forbidden states); last-seen and last-received times as `26.9.2026, 19:02:00 · UTC+03:00` | title "מרכז הכניסה" on every state; new `formatLocalTime()` in `wiskey-format.ts` (same zone arithmetic, no offset label) for the two operator times of the entry center. `formatTime()` with the offset stays for the event's technical details (`wiskey-event-drawer`), the installer and the system screens |
| H4 | #14 list selection | schedules door list: chosen door = `--sw-accent` fill, white, 700 | Blue Wash `--sw-accent-soft` + Blue Ink `--sw-accent-text` + `--sw-fw-semibold`, no border (DESIGN.md selected row); hover still only under a fine pointer, press `scale(var(--sw-press-scale))` kept |
| H5 | #16 native controls | `wiskey-people`: six native `<select>` inside pill labels (group, station, state, rights, credential, sort) plus the two profile selects when profile fields exist | all eight are `<sw-dropdown tall>` (opaque listbox, 44 px options, keys, search from 8 options) as on the activity screen; the "any" option names its filter ("מצב: הכול") and an icon per filter tells them apart; demo mode keeps them non-interactive (`inert`, `aria-disabled`). On the phone the chips keep their width in the one scrolling line |
| H6 | #5 no scroll | stations grid overflowed 98 px at 1366x768 (audit v2.43.1) | already fixed on the base by NOSCROLL-1366-2437 (cards paged from 1100 px); kept as is, re-measured 0 px |

Tokens only: no new colour, radius, font size or duration literal. No new `<select>`, `<table>`, `<dialog>`, `class="kpi"`,
`class="chip"` or `<h1>`. The only px value added is the documented fallback `168px` of `--sw-kpi-compact-col-min` (replacing `140px`).

## 2. Before / after measurements

Demo data (every `/api/v1` call aborted), classic skin. Base build = `origin/pilot/AUDIT30-BASE`, after = this branch; both
`vite build` + `vite preview` on the workstation.

**Audit probe** (`tools/shoot.mjs` + `tools/analyze.mjs`, run from copies of the audit folder; routes wk-overview, wk-events,
wk-people, wk-devices, wk-schedules; desktop/tablet/phone light+dark, plus 1366x768 light):

| Screen | Before (base) | After |
|---|---|---|
| wk-overview | h1 "WisKey · מרכז הכניסה"; phone page scroll 397 | h1 "מרכז הכניסה"; phone page scroll 349 (phone pages may scroll, COMPONENT_RULES §5) |
| wk-people | native `select` 6 (desktop, tablet), 2 (phone); `table` 1; phone page scroll 0 | native `select` 0; `table` 1 (the people table, not in H's list); phone page scroll 0 (a first cut let the dropdowns shrink to a letter column on 375 px, page +50 px; fixed with `flex-shrink: 0` and re-measured) |
| wk-devices | 1366x768: doc 0, main 0 | 1366x768: doc 0, main 0 (unchanged; tablet 821 / phone 532 page scroll as before, allowed) |
| wk-schedules, wk-events | no finding | unchanged (contrast L0 D0 everywhere) |

**Targeted probe** (Playwright, 1440x900, light / dark):

| Check | Before | After |
|---|---|---|
| entry center KPI tile height | 108 / 108 px | 60 / 60 px |
| ringing badge edge, fill / ink (light) | dashed, `rgb(255,244,224)` / `rgb(180,83,9)` | solid, `rgb(180,83,9)` / `rgb(255,255,255)` |
| ringing badge (dark) | dashed, amber 20 % wash / amber | solid, `rgb(245,176,67)` / `rgb(19,26,42)` |
| "UTC+" text on the entry center | present | absent |
| schedules chosen door (light) | `rgb(35,96,232)` fill, white, 700 | `rgb(228,236,255)` fill, `rgb(26,79,214)` ink, 600 |
| schedules chosen door (dark) | `rgb(59,111,230)` fill, white, 700 | `rgba(91,140,255,.2)` fill, `rgb(143,178,255)` ink, 600 |
| people: native select / sw-dropdown | 6 / 0 | 0 / 6 |
| stations 1366x768 main / doc overflow | 0 / 0 | 0 / 0 |

## 3. Design skills (SKILLS_BRIEF.md)

| Skill | Invoked | Command | Finding | Change / rejected |
|---|---|---|---|---|
| ui-ux-pro-max | yes | `search.py "access control entry dashboard filter dropdown selected list row" --domain ux`; `search.py "status badge color only selected state contrast" --domain ux` | "Color Only: use icons/text in addition to color"; "Minimum 4.5:1"; "Essential Text Truncation" | the ringing badge keeps its word ("מצלצל") and gets a shape change (solid field) besides colour; each dropdown carries its filter name in the "any" option plus an icon; nothing essential is clamped. Rejected: its bulk-action advice (out of scope) |
| impeccable | yes | `impeccable.cmd detect --json wiskey-overview.ts wiskey-people.ts wiskey-schedules-css.ts wiskey-format.ts` | `[]` (no anti-pattern found in the changed sources; the detector does not pierce our shadow DOM on URLs, so source files only) | none needed |
| emil-design-eng | yes (Skill tool) | review of: selected row, ringing badge, select -> dropdown, compact tiles | selected row: transition only `background` and `transform`, hover gated by `(hover: hover) and (pointer: fine)`, press scale kept; no new animation added (filters and lists are used tens of times a day) | kept the existing `--sw-t-fast` / `--sw-t-press` transitions; no motion added |

## 4. Tests (only what actually ran)

| Where | Command | Outcome |
|---|---|---|
| workstation | `npx tsc --noEmit -p .` (frontend) | exit 0 |
| workstation | `npx vite build` (frontend) | exit 0 |
| workstation, branch preview :4392 | `npx playwright test tests/layout-audit30h-wiskey.spec.ts --project=desktop --workers=1` | 5 passed (the pixel case skipped its compare: no win32 baseline, annotated) |
| workstation, branch preview | `npx playwright test tests/evidence-wiskey-people-native.spec.ts tests/evidence-wiskey-people-writes.spec.ts tests/layout-wiskey-people.spec.ts tests/layout-wiskey-people-writes.spec.ts tests/evidence-access-schedules.spec.ts tests/layout-access-schedules.spec.ts tests/layout-audit30h-wiskey.spec.ts --project=desktop --project=mobile --workers=1` | 141 passed, 107 skipped (project / live gates), 0 failed |
| workstation, branch preview | `NOSCROLL_QUICK=1 npx playwright test tests/layout-noscroll-1366.spec.ts --project=desktop -g wk-devices` | 2 passed (1366x768, 1440x900) |
| runner (Ubuntu), `ed10ca66b` | `run_smart.py preview pilot/AUDIT30-H-WISKEY tests/layout-audit30h-wiskey.spec.ts tests/pixel-wiskey-people.spec.ts tests/pixel-wiskey-people-writes.spec.ts tests/pixel-wiskey-messaging.spec.ts tests/pixel-access-schedules.spec.ts tests/pixel-wiskey-schedule-writes.spec.ts tests/pixel-round4-leftovers-2390.spec.ts tests/pixel-wiskey-stations.spec.ts --project=desktop --project=mobile -u --workers=1 --machine runner` | 127 passed, 9 skipped; 80 `*-linux.png` baselines written (79 changed, 1 new), committed in `650a3588f`; includes `pixel-wiskey-stations ... stations-classic-settings-1440-desktop-linux.png` (the base's binary merge conflict) |
| runner | the same specs plus `tests/layout-noscroll-1366.spec.ts`, without `-u` | NOT_FINISHED at commit time: started on `650a3588f`, still running after 90 min on the overloaded runner (the 2.43.3 gate has priority); the runner entry check is the verdict |
| - | `evidence-wiskey-people.spec.ts` (needs `SW_LIVE=1` and a backend) | NOT_RUN |

The local functional run rewrote evidence screenshots under `docs/design/evidence/CR-036-S9/` (written by
`evidence-access-schedules.spec.ts`); `docs/design/**` belongs to branch J, so they were reverted, not committed.

Screenshots: `docs/changes/evidence/AUDIT30-H-WISKEY/<route>-<viewport>-<scheme>-{before,after}.jpg` (desktop 1440x900, tablet
768x1024, phone 375x812, light and dark) and `<route>-1366-light-after.jpg`, from the audit probe (demo data).

## 6. After branch B (follow-ups, not done here)

- **#7 (B3):** once `sw-kpi` has `secondary` and `tone="warn"`, the online tile reads `3` with secondary "מתוך 4" instead of the
  `3 / 4` value, and the ringing tile uses `tone="warn"` (soft fill + hairline) instead of `tone="stale"`.
- **#16 (B5):** the entry center's and the people screen's own search inputs (`.search` label + `<input type="search">`) move to the
  `sw-field type="search"` variant when B ships it; `sw-field.ts` is B's file.
- **#12:** if B adds a `warning` kind to `sw-badge`, the ringing badge switches from `stale filled` to `warning filled` (same look).

## 7. Known limits

- The attention card's count badge on the entry center stays `kind="stale"` (dashed): it counts stations needing attention, it is not
  the ringing state, and FIXES.md H2 names only the ringing badge.
- Other WisKey screens still have native `<select>` (bulk import, person editor, access diagnostics, profiles, card capture, relay map,
  station permissions, events export, person actions); FIXES.md H5 names only the people screen's six. `wiskey-access-diag.ts` still
  has local `class="kpi"` blocks (not listed for H). Both are candidates for a later round.
- Loading / empty / error states were not forced per screen (as in the audit).
- `evidence-wiskey-people.spec.ts` runs only with `SW_LIVE=1` against a backend: updated, NOT_RUN.

## 8. Rollback

Revert the merge commit. No data, settings or migration is involved.
