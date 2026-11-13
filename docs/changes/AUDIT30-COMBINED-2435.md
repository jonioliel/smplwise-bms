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

Queued once: `ENTRY_TOTAL_SECS=10800 ~/gate2/branch_check.sh pilot/AUDIT30-COMBINED-2435 --max-wait 0`. Verdict file:
`~/smplwise-results/entry_pilot-AUDIT30-COMBINED-2435_<sha>.md`.
