# GATE-ONEPROJECT-2480 - the "one project" marker counts only in header comments

Branch `pilot/GATE-ONEPROJECT-2480`, cut from `main` at `619f94d04`. Test-infrastructure only: no product module, no tag, no version bump,
nothing deployed. The live gate (`~/gate2`) was not touched.

## 1. Finding

`classify()` in `scripts/gate/release_gate.py` ran `re.search(r"one project", header, re.I)` over the first 70 lines of a spec, code included.
A skip message such as `test.skip(info.project.name !== 'desktop', 'one project runs the whole sweep')` therefore limited the whole file to
the first project (desktop). `evidence-readiness-96` on mobile never ran in any gate because of this.

Repo vs runner: `scripts/gate/release_gate.py` at `619f94d04` and `~/gate2/release_gate.py` on the runner are byte-identical (same md5,
2578 lines), so there is nothing else to reconcile before deploying.

## 2. Change

- `release_gate.py`: new `header_comments(header)` keeps only `//` lines and `/* ... */` blocks (code lines are dropped); `classify()` searches
  "one project" there. Nothing else in the classifier changed (the `--project=` flag scan, `DEV_HDR`, `SRC_IMPORT` still read the whole header).
- `selftest_gate.py` (the gate's self-test, `python3 scripts/gate/selftest_gate.py`, runs on the runner): five cases - marker only in code
  (all three projects), in a `//` comment (desktop), in a `/* */` block (desktop), dev spec with the marker in code only (`one` False), dev spec
  with the marker in a comment (`one` True). Run on the runner against the changed engine: all OK, `SELFTEST PASSED`.
- `frontend/tests/evidence-readiness-96.spec.ts`: the hand-over test now opens the third pane first when the segmented pane switcher is visible
  (a phone shows one pane at a time).

## 3. Specs whose classification changes (old vs new, checked on the real tree at `619f94d04`, tier L)

1189 top-level specs classified with the old and the new engine; 49 differ.

### 38 specs on the preview server (`rest`): they now also run on the added projects

| spec | old projects | new projects | added |
|---|---|---|---|
| `evidence-announce-297.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `evidence-announceb-295.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `evidence-cast-ui.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `evidence-kiosk-polish.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `evidence-mobile-layers.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `evidence-mobile-touch.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `evidence-mobile-wall-kiosk.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `evidence-mobile.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `evidence-playback-controls-below.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `evidence-playback-stall.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `evidence-readiness-96.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `evidence-wall-plan.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `evidence-wiskey-deeplinks.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `evidence-wiskey-messaging-settings.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `evidence-wiskey-messaging.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `evidence-wiskey-people-native.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `layout-a11y-295.spec.ts` | mobile | desktop, tablet, mobile | desktop, tablet |
| `layout-compare-dropdown.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `layout-entity-id-scan.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `layout-media-floor-dropdown.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `layout-messaging-accounts.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `layout-multi-nvr.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `layout-playback-stall.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `layout-secrets-card.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `layout-setup-wizard.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `layout-st7-ui.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `layout-sync-dropdown.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `layout-tickets-board.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `layout-tickets-calendar.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `layout-tickets-delete.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `layout-tickets-table.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `layout-tickets.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `layout-wall-plan.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `layout-wiskey-station-media.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `layout-wxsch.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |
| `pixel-wall-followups-2390.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile (pixel spec) |
| `pixel-wall-plan.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile (pixel spec) |
| `unit-schedule-editor-logic.spec.ts` | desktop | desktop, tablet, mobile | tablet, mobile |

(`layout-a11y-295` carried `--project=mobile` in its header and was mobile-only; it now runs on all three. The two pixel specs are skipped on
tablet/mobile by their own tests, see below.)

### 11 dev-server specs: only the internal `one` flag changes, the project list is the same (desktop)

`evidence-access-events.spec.ts`, `evidence-access-s12.spec.ts`, `evidence-access-schedules.spec.ts`, `evidence-electricity-skins.spec.ts`, `evidence-wxmedset.spec.ts`, `evidence-wxsch.spec.ts`, `evidence-wxunblk.spec.ts`, `layout-access-s12.spec.ts`, `layout-access-schedules.spec.ts`, `layout-access-status.spec.ts`, `layout-update-screens.spec.ts`

## 4. Results on the runner (main `619f94d04`, preview build, slot B, `--workers=2`, `--retries=0`, only the added projects)

Own folder `~/work/gatecls`, `~/work/slotb.sh`, the gate was not running, no `-u`.

| run | projects | result |
|---|---|---|
| 37 specs | tablet + mobile | **99 passed, 1 failed, 588 skipped** (1.5 min) |
| `layout-a11y-295` | desktop + tablet | 8 passed, 12 skipped (14 s) |
| `evidence-readiness-96` after the test fix | desktop + tablet + mobile | **34 passed, 0 failed, 20 skipped** |

The one failure: `[mobile] evidence-readiness-96 > the hand-over is recorded below the advice`. Cause: on a phone the side column is one pane at
a time (`data-panes` tabs: checks / steps / hand-over); `[data-below-advice]` is in the hand-over pane, which is hidden until its tab is clicked.
A stale test, not a product bug; fixed in the spec (a click on the third tab when the switcher is visible), now green on all three projects.

Reading the numbers: most of the 588 skipped are in-test skips by design (`test.skip(info.project.name !== 'desktop', ...)`), including every test
of the two pixel specs and of 28 `layout-*`/`evidence-*` files, so for them the added projects are executed and skipped, and the gate's
no-run accounting (`norun` = skipped without a skip annotation) is not affected. Files with real new tablet/mobile coverage (tests that ran and
passed): evidence-cast-ui, evidence-kiosk-polish (mobile), evidence-mobile-layers, evidence-mobile-touch (mobile), evidence-mobile-wall-kiosk
(mobile), evidence-playback-controls-below (mobile), evidence-readiness-96, evidence-wiskey-deeplinks (mobile),
evidence-wiskey-messaging-settings, evidence-wiskey-people-native, layout-a11y-295 (tablet). No other failure: the 2.48.0 gate gains this coverage
at no new red apart from the readiness test fixed here.

Not run: the 11 dev-server specs (project list unchanged, nothing new to run); the pixel specs' screenshot comparison on tablet/mobile (their
tests skip there).

## 5. Deploying the classifier to `~/gate2` (lead, after review)

Only when no gate is running (never stop a running gate):

```
ssh runner 'python3 -c "import json,sys;sys.exit(0 if json.load(open(\"/home/sw/smplwise-results/gate_status.json\")).get(\"state\")==\"running\" else 1)" && echo RUNNING-DO-NOT-DEPLOY'
ssh runner 'cp -p ~/gate2/release_gate.py ~/gate2/release_gate.py.bak-oneproject2480'
scp scripts/gate/release_gate.py runner:~/gate2/release_gate.py      # from the merged main
ssh runner 'md5sum ~/gate2/release_gate.py'                           # must equal the repository file
ssh runner 'cd ~/gate2 && python3 selftest_gate.py | tail -3'         # copy selftest_gate.py next to it first; SELFTEST PASSED
```

The nightly copy (`~/nightly-gate/release_gate.py`, see NIGHTLY-2250) should get the same file. The cost is higher gate time for the 38 specs (about
1.5 min of worker time on the runner for the added projects, mostly skips). The branch must be merged to main together with
`evidence-readiness-96.spec.ts`, otherwise the 2.48.0 gate would see the mobile hand-over test red.
