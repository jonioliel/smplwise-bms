# AUDIT30-COMBINED-2435: the round-30 audit branches merged for one entry check

Branch `pilot/AUDIT30-COMBINED-2435`, cut from `origin/main` = v2.43.4 (`665ec8f24`). Purpose: one runner entry check for all
round-30 audit branches (about 80 minutes per branch in the entry queue; six branches had come back NOT RUN at the 12-hour queue
limit, four RED). Frontend and tests only: no backend, migration, dependency or lockfile change (`git diff origin/main --
smplwise_vms/backend frontend/package*.json` is empty).

## 1. Merged heads (in this order, `git merge --no-ff`)

| # | Branch | Head |
|---|---|---|
| 1 | pilot/NOSCROLL-1366-2437 | `5b9bb0413` |
| 2 | pilot/SYS-AUDIT-QUICKFIX-2437 | `dd16b8409` |
| 3 | pilot/AUDIT30-A-GLASS-BRIDGE | `b3bd2602d` |
| 4 | pilot/AUDIT30-B-SHARED | `cfff3be25` |
| 5 | pilot/AUDIT30-B2-PAGE-ACTION | `44ae099d2` |
| 6 | pilot/AUDIT30-C-TICKETS | `603f9ed98` (new fix, section 2) |
| 7 | pilot/AUDIT30-D-MULTIMEDIA | `88ddaee9b` (new fix, section 2) |
| 8 | pilot/AUDIT30-E-INFRA | `857eac0ab` |
| 9 | pilot/AUDIT30-F-CALENDARS | `25966cef5` |
| 10 | pilot/AUDIT30-G-VIDEO | `438e15ee1` |
| 11 | pilot/AUDIT30-H-WISKEY | `ff42df2a7` |
| 12 | pilot/AUDIT30-H2-WISKEY | `e045f35b3` |
| 13 | pilot/AUDIT30-I-DEVICES | `2fbc06afb` |
| 14 | pilot/AUDIT30-WK-COMPONENTS | `67969db5d` |

C through WK were cut from `pilot/AUDIT30-BASE` (`2a6430586`), which carries the earlier NOSCROLL-1366-2437 commits (without the
entry-check fix `5b9bb0413`) and SYS-AUDIT-QUICKFIX-2437; merging NOSCROLL at its fixed head first brings that fix in.

## 2. Fixes on the RED branches (committed on the branches, then merged)

- **C** `603f9ed98` - `layout-a11y-295.spec.ts:112 [mobile]` (CLS 0.159). On a phone the frame's actions row (view switch, "+")
  first fitted beside the title, then wrapped under it when the meta added the manager-only views, pushing the list down 36 px.
  `screens/tickets-list.ts`: on a phone the actions take their own row from the first frame. CLS now 0.000.
- **D** `88ddaee9b` - `layout-dd-click.spec.ts:66` placement 4 on `#/devices/schedules` (desktop, tablet, mobile: fallback instead
  of placement 4). D rewrote `styles/media-page.ts` for the sw-page frame; the screens that still drew a plain `div.page` lost the
  page padding and the title style, and `:host .page .dh .dh-row { padding-inline-start: 0 }` outranked the shell's lead reserve, so
  the chip collided. The sw-page rule is scoped to `sw-page.page`; the old frame's rules come back for `div.page`;
  `measureHeaderBar` keeps the old phone measure when the bar holds the title.
- **E / H** (inherited set from AUDIT30-BASE: WisKey station-media / station-ops / door-tech / talk-dial, evidence-camera-card,
  evidence-warmup-polish-2421 at 1024x768): fixed by `5b9bb0413` on NOSCROLL-1366-2437, merged first. `electricity-accounts.spec.ts:159
  [mobile]` (E only, dev server) did not reproduce locally (section 4).

## 3. Conflict resolutions

No text conflicts. Binary conflicts only, all in `*-linux.png` baselines and evidence shots:

| Merge | Files | Resolution |
|---|---|---|
| SYS-AUDIT-QUICKFIX | `pixel-wiskey-stations` `stations-classic-settings-1440-desktop`; `visual-matrix` `multimedia-screens-ready-{light,dark}-{desktop,tablet}` | NOSCROLL side kept provisionally, then checked on the runner (section 4): they pass on the merged UI (D's re-take wins for multimedia-screens below). |
| C | same `stations-classic-settings` and `multimedia-screens-ready-dark-{desktop,tablet}` | kept ours provisionally; pass on the runner. |
| D | `multimedia-screens-ready-dark-{desktop,tablet}` | D's re-take (the branch that owns the screen); pass on the runner. |
| H | `pixel-round4-leftovers-2390` `wk-overview-classic-{light,dark}-{1440-desktop,390-mobile}` (B's selected chip vs H's re-take) | H's side, then re-taken on the merged UI. |
| I | `docs/design/evidence/SYS-AUDIT-QUICKFIX-2437/{dark,light}-badges-incidents.png`, `dark-notifications-severity.png` | the quick-fix branch's own evidence shots kept. |

Intent kept on both sides where two branches met: the tickets screens (C) and devices schedules / automations (I) are on
`<sw-page class="page">` and now take D's sw-page page styles; the screens still on `div.page` keep the old frame.

Baselines re-taken on the merged UI (runner, `run_smart.py preview ... -u --workers=1 -g`, @ `94a0a25d4`, 23 files, commit
`35fc69a53`): `pixel-audit30a-glass-bridge` tickets board dark (3 projects), `pixel-audit30g-video` camera health light / dark
(desktop, mobile), `pixel-round4-leftovers-2390` wk-overview light / dark (desktop, mobile), `visual-matrix` devices-schedules and
settings-notifications ready light / dark (3 projects). The actual images were looked at before the re-take (merged frame, no
broken layout). The `-u` output landed in the main checkout and was moved here; the main checkout was restored.

## 4. Test receipts

Local (Windows workstation, Node 24, Playwright on `vite preview` of `npm run build` unless noted):

| What | Result |
|---|---|
| `tsc --noEmit` (combined) | exit 0 |
| `vite build` (combined) | exit 0 |
| backend tests | none touched (no backend file differs from main): NOT_RUN |
| C branch: `layout-a11y-295` desktop/tablet/mobile | 11 passed, 10 skipped |
| C branch: evidence-audit30c-tickets, evidence-tickets-polish-2331, layout-tickets-table, evidence-tickets-ui4 (3 projects) | 55 passed, 32 skipped |
| D branch: `layout-dd-click` (3 projects) | 27 passed |
| D branch: D's specs + layout-dd-place, layout-schedules-parity, evidence-schedules-list, layout-noscroll-297 (3 projects, 3 workers) | 533 passed, 69 skipped, 1 failed (layout-dd-place areas/living desktop placement 3; passed alone) |
| combined: every spec file added or changed by the 14 branches + layout-a11y-295, layout-dd-click, evidence-warmup-polish-2421 (64 files, 3 projects, 4 workers; pixel and the fixture-only evidence-camera-card excluded) | 2002 passed, 690 skipped, 92 unexpected: 87 are electricity-bills / electricity-wizard, which are dev-server specs (time out on preview, rerun below); 5 mobile (evidence-media-players:351, evidence-schedules-list:802, evidence-sys-audit-quickfix-2437:128, evidence-wiskey-people-native:544, evidence-wiskey-station-media:149) passed when rerun alone (7 passed) |
| combined, vite dev server: electricity-bills, electricity-wizard, electricity-accounts, electricity-meters (3 projects) | 209 passed, 1 skipped |
| evidence-camera-card (fixture backend) | NOT_RUN locally; runner entry check |

Runner (`run_smart.py preview`, one worker, the load checked before each job):

| Job | Result |
|---|---|
| proof run of all `pixel-*` specs + `visual-matrix`, no `-u`, @ `94a0a25d4` | 474 passed, 23 failed, 367 skipped (the 23 re-taken above) |
| re-take, `-u -g` scoped, @ `94a0a25d4` | 39 passed, 23 files written |
| proof run, same scope, no `-u`, @ `35fc69a53` | 39 passed, 12 skipped |

Entry check: see section 5.

## 5. Entry check

Queued with `ENTRY_TOTAL_SECS=10800 ~/gate2/branch_check.sh pilot/AUDIT30-COMBINED-2435 --max-wait 0`. Verdict file:
`~/smplwise-results/entry_pilot-AUDIT30-COMBINED-2435_<sha>.md`.

### Round 1 - `1549f0b60`: RED (queued 347 min, ran 98 min; 28 failures outside the quarantine)

Counts: preview 12769 passed / 22 failed / 3 flaky, dev 848 / 1, fixture 28 / 0, visual 72 / 0, pixel 344 / 4 / 1 flaky,
backend 2818 / 0, tsc, build, release check and add-on build passed; spec lint 1. Every failure was reproduced locally and
classified real except where noted; fixes in `7b3a90ee8`, baselines in `21abe3c5b`.

| Failure | Branch | Class | Fix |
|---|---|---|---|
| spec lint `evidence-audit30i-devices:167` | I | real (test) | `settle(page)` before the geometry read |
| `evidence-kavarnit:85` [desktop] strip 21 px lower on schedules | I + D | real | the header actions row's class `tr` was also the schedule table row (padding 10px 16px); renamed `hdact` in schedules and automations |
| `unit-lead-reserve:58` (3 projects) | I, G | real | explore-presence and investigate-incidents are on sw-page; the dead `leadReserveStyles` import removed |
| `layout-incidents:50` [mobile] doors part 9 px over | G (fails on G alone) | real | door rows one step denser on a phone (gap 4, padding-block 3, still 44 px) |
| `evidence-polish2-295:200` (3 screens x 3 projects) chosen chip 1.28:1 from its track | D, I (Blue Wash) | contradiction | owner Q3 option 1 makes the chosen chip the soft accent fill; the 3:1 key-vs-track rule now applies to segment keys only (as C already did in `evidence-sys-audit-quickfix-2437` finding 3); labels keep 4.5:1. **Recorded contradiction:** the old WCAG 1.4.11 key rule vs the owner's chip look. |
| `unit-devices-tiles:330` (3 projects) dark panel white | A | real (test) | the test faked a dark device scheme on a light product without the `data-devices-own-backdrop` flag the screen sets; A's bridge applies only without it |
| `unit-menu-surfaces:100` (3 projects) | A | real (test) | the bridge's `--dv-surface-solid: var(--sw-surface-solid)` is a reference to the product's opaque token, not a literal; the test checks literals and that the only reference is that one |
| `electricity-accounts:159` [mobile, dev] | E | real (test, timing) | "next" is an sw-button; a press on the host while the inner button is disabled is dropped; the phone steps wait for the key and each step |
| `evidence-pwa-push:139` [desktop] | none (main) | pre-existing | fails 3 of 3 on main `665ec8f24` locally; the notice can show before the waiting worker settles; the test presses once `waiting.state === 'installed'` |
| pixel `evidence-audit30c-tickets` board / settings, `layout-audit30h-wiskey:97` | C, H on the merged frame | stale baselines | re-taken (below) |

Flaky in round 1 (passed alone): layout-overlay-no-shift:125, evidence-wiskey-stations:674, evidence-calendars-settings-2310:105,
pixel-access-s12:72.

Local receipts for round 1: tsc 0, vite build 0; the failing specs plus layout-dd-click, layout-dd-place, evidence-schedules-list,
evidence-automations-list, evidence-audit30g-video and A's specs, three projects, 3 workers: 792 passed, 33 skipped, 3 failed
(evidence-pwa-push:139 tablet / mobile and layout-dd-place:248 tablet under load; alone: tablet passes, the pwa test still times out
on mobile locally - on the runner only desktop had failed). electricity-accounts on vite dev, three projects: 60 passed. Spec lint
`--new-since origin/main`: 0 findings.

Runner re-take @ `7b3a90ee8` (`-u -g`, one worker): 11 passed, 4 skipped, 11 files - visual-matrix devices-schedules desktop /
tablet, AUDIT30-C board desktop / phone and settings desktop, AUDIT30-H entry center classic light 1440.

Proof run @ `21abe3c5b`, no `-u`, one worker: every `pixel-*` spec, the visual matrix and the screenshot tests of the audit
specs (audit30-f-calendars, evidence-audit30b-shared, evidence-audit30b2-page-action, evidence-audit30c-tickets,
layout-audit30-e-infra, layout-audit30h-wiskey, layout-audit30h2-wiskey), `-g "pixel|vm "`: 527 passed, 391 skipped, 0 failed.

### Round 2 - `3c29dec28`: RED (queued 517 min, ran 99 min; 1 failure outside the quarantine)

Counts: preview 12767 passed / 1 failed / 5 flaky, dev 785 / 0, fixture 28 / 0, visual 72 / 0, pixel 349 / 0, backend 2818 / 0;
tsc, build, release check, add-on build and spec lint passed. Every round-1 failure is gone.

- `evidence-pwa-push.spec.ts:139` [desktop] "a new release: update notice, new worker, old cache deleted" - test timeout 180 s,
  failed again alone. **Classified real for this branch, cause not found:** the main nightly on the runner (`gate_main_0a8fb55e1`)
  passes it in 12 s, so the round-1 reading "pre-existing on main" (3 of 3 failures on a local main build) does not hold on the
  runner; the wait for the waiting worker added in `7b3a90ee8` did not change the runner result. Locally on the combined build the
  click on "רענון" lands on the toast's sw-button (hit test checked) but no navigation follows; with Playwright's API trace on it
  passes. Next step: a runner `preview` job of this one test with `--trace on`, and a bisect over the merged heads on the runner
  (the home screen behind the notice, `#/devices/building`, is the first suspect: A's glass bridge and B2's page action touch it).
- Flaky (passed alone): evidence-tickets-costs:106 [mobile], evidence-calendars-settings-2310:363 [mobile],
  evidence-frigate-f2b-skins-2405:75 [mobile], home-v3-followup-a:79 [desktop], pixel-notice-tv-portrait-chips:121 [desktop].

Stopped after two RED rounds, as instructed. Note: `origin/main` moved to 2.43.5 (`0a8fb55e1`) while round 2 ran; this branch is
cut from `665ec8f24` and needs a merge of main before it boards the next train.
