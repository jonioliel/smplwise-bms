# HOME-SPEC-STABLE-2540 - evidence-home-screen.spec.ts, the release gate's home spec, stable

Branch `pilot/HOME-SPEC-STABLE-2540` from `origin/pilot/HOME-SCROLL-3-2530` (2bf0b098b). Target 2.54. Follow-up of HOME-SCROLL-3-2530
open question 4 (answer a). Base for the comparison runs: the train head HOME-SCROLL-3 branched from, `aeb05ad3d`.

## Problem

`frontend/tests/evidence-home-screen.spec.ts` (`"gate": true` in the fixture lane) failed now and then on the runner, on the branch and on
its base alike, in three places: (1) edit mode, the order by drag (the quick actions dropped onto the clock; HOME-SCROLL-3's runs 2 and 4),
(2) direction b at 1366x768 in "the three directions" ("main 962/768"), (3) the weather card's temperature from a sensor (still "31°C"
20 s after the sensor was set to 18.2).

## Root causes (measured on the runner; the instrumentation was a diagnostic copy, never committed)

Each case was instrumented in place (a 30-40 ms sampler of the screen's fit attributes, the page area's overflow and the cards' boxes;
every drag / mouse event with the card it hit; every API request / response and socket frame with its time) and run both in isolation
(`--repeat-each=12`, branch and base, 48 tests each) and as the whole file (its real context, 5 + 5 + 5 runs).

### (3) The weather sensor: the fixture's state push left before its commit - a defect of the fake Home Assistant feed

`POST /api/v1/ha/dev/states` (developer identity mode only - the fixtures' fake Home Assistant feed) published `entity_state_changed`
inside the request, BEFORE the request's transaction committed (`get_conn` commits when the request ends). The home screen refetches the
tree on that push (throttled, 400 ms window); a refetch that reached the server before the commit read the OLD state and no further push
came, so the card kept 31 °C until its 5-minute fallback poll. The real path (`ha_sync.on_state_changed`) stores first and pushes second.
Captured (base, isolated, rep 3; times in ms from the reload): `1268 post> | 1307 ws push sensor=18.2 | 1665 tree> | 1738 tree< 31.4 |
1752 post<` - the push came 445 ms before the POST answered, the refetch read 31.4. The same sequence in every failure: base isolated 2 of
8, branch whole-file 3 of 5, base clean whole-file 1 of 3.

Fix: the push is a background task now (`routers/ha.py`, `dev_states`), which runs after the commit; the media frames keep their place
after the pushes. `smplwise_vms/backend/tests/test_dev_states_push_order_2540.py` reads the stored state from another connection at the
moment of the push: before the fix it read `31.4` (FAILED), after it `18.2` (passed).

### (2) Direction b at 1366x768: read once while the screen was still packing

The screen packs one step per render (fit 0 -> 1 -> 2, b's fold, the squeeze), restarts from fit 0 when a late read changes what is
drawn, and - for growth that does not resize `.page-body` (the shell's setup hint above it, a child's own data) - measures again on its
recheck timers (600 / 1500 / 3000 ms, HOME-SCROLL-2-2530). This test read the scroll ONCE, right after `open()`'s fixed 1200 ms pause.
Captured (branch, whole file, run 5; page time): `693 fit 0 over 142 | 720 fit 0 over 194 (the setup state answered) | 2197 fit 1 over 162
| 2437 fit 2 + fold, over 0` - the reading "main 962/768" is exactly fit 0's 194 px; the screen fitted 1.7 s later by itself. Fix: the
check is polled (8 s), as the newer fit tests in the same file already were, and the boxes are measured after it.

### (1) The drag reorder: HOME-SCROLL-3 changes nothing in edit mode

- Code: `measureFit` treats the layout editor as not fit-eligible (`!this.lay.editing`): it resets `fit`, `fitFold` and `fitSqueeze`, so
  `home-widgets` never gets `data-squeeze` while editing; HOME-SCROLL-3's CSS keys only on `:host([layout='hero'][data-squeeze])`.
- Measured: in all 24 isolated edit sessions (12 branch, 12 base) the sampler (every 40 ms from page load to the drop) never saw
  `data-squeeze` on the band or the page body, and `data-fit` stayed 0 for the whole page; the geometry was identical on both (quick at
  1101,526; mousedown 1142,556; dragenter / drop on the clock at 1060,290).
- So the failure is not HOME-SCROLL-3's: reproduced on the base as often as on the branch (below), and fixed in the spec, not in the
  product.

The real cause - the drag never started. `locator.dragTo` hovers the source, presses, then hovers the TARGET, and that hover runs the
target's actionability (scroll into view, hit check; a retried hit check scrolls with another alignment) - after the button is already
down on the source. The recorder saw the page area scroll back by 39 px between the press and the release with no page-script scroll or
focus call, i.e. by that hover's own scrolling (the 39 px came from the "add" click's own scroll a moment before). Chromium picks the drag source at the press point only on the first move; once the page area had scrolled, the press
point lay in the gap between the band's two rows, so no `dragstart` fired and the drop was a plain click. Captured (a recorder of every
programmatic scroll / focus call, the page area's `scrollTop`, the active element; base, rep 0; page time):

```
3438 mousedown on alarm's "hide"        3519 page area scrollTop 0 -> 39 (no page script call: the next click's own scroll)
3612 mousedown on alarm's ghost "add"   3709 focus -> weather's grip (the keyboard steps)
3886 mousedown on "quick" (1142,517)    4112 page area scrollTop 39 -> 0 (the target hover; the cards move down 39 px)
4192 mouseup on "clock" (1060,290)      - no dragstart, no drop: the order stays
```

How often (the edit-mode steps alone, `--repeat-each`, three rounds; the commit message of 83afb8ca5 quotes the first two rounds' counts,
these are the final ones): an idle runner 8 of 28 on the branch head (2296fae12, the old drag), 9 of 28 on the base; CPU throttled x4 /
x8 (CDP `Emulation.setCPUThrottlingRate`) 0 of 32 on both - a slow page has already finished the earlier click's scroll and the target needs no retry, which is why the whole
file under the release gate's load failed this test rarely. Fix (`dragCard` in the spec): wait until every card's box (which also moves
with the page area's scroll) is unchanged over five animation frames, assert that both points are inside the viewport, and drag with the
plain mouse (`page.mouse`), which never scrolls.

### (4) Seen once while proving: HOME-SCROLL-3's own fold check under load

The first loaded proof run (4 whole-file runs in parallel at 83afb8ca5) failed once in HOME-SCROLL-3's new test: "a tiles 1280x800:
folded band" read `rows: 2` on a squeezed page (the page did not scroll). The check read the page's squeeze and the band's state in two
calls, once, right after the scroll poll. Not reproduced in 200 more checks of that test (4 runs in parallel, x3 and x7, a recorder on
every squeezed reading). Fix (spec only): one `evaluate` reads both in the same frame and returns a verdict, polled for 8 s like the scroll
check above it; a band that stays on two rows still fails, with the rows / headings / cards read. Root cause NOT proven (most likely a
frame between a re-render and the packing's next measure) - said so in the spec comment.

## Files

| File | Change |
|---|---|
| `smplwise_vms/backend/smplwise/routers/ha.py` | `dev_states`: the push after the commit (background task) |
| `smplwise_vms/backend/tests/test_dev_states_push_order_2540.py` | new: the push reads the committed state; several states push in order |
| `frontend/tests/evidence-home-screen.spec.ts` | the three directions: the no-scroll check polled before the boxes are measured; edit mode: the drag through `dragCard` (the band at rest, the plain mouse); the cards info style (HOME-SCROLL-3's test): the page's step and the band's fold read in one frame and polled |
| `docs/changes/HOME-SPEC-STABLE-2540.md` | this note |

No product UI change (no screen looks different; no pixel baseline touched). `routers/ha.py` is product code, but the changed route
exists only in developer identity mode (`_dev_only`) - it is the fixtures' fake Home Assistant feed, refused in an installation.

## Tests run (real results)

All on the runner (slot B via `~/work/slotb.sh`, job scripts `p2520_hss_*`). "Whole file" = `scripts/fixture_job.py
evidence-home-screen --no-build` (desktop + mobile, as the gate's fixture lane; 25 tests run and 23 skipped per run on the branch, 24 run
on the base, which has no HOME-SCROLL-3 test). UI built once per worktree (`npm run build`, rc 0); no frontend source changed here.

| What | Where / command | Result |
|---|---|---|
| The new backend test BEFORE the fix | 2bf0b098b + the test file, `pytest tests/test_dev_states_push_order_2540.py` | rc 1: 1 failed (`[('sensor.outdoor', '31.4')]`), 1 passed |
| The same AFTER the fix | + the `routers/ha.py` change | rc 0: 2 passed |
| Backend, final | e612b2af4: `test_dev_states_push_order_2540.py`, `test_ha.py`, `test_devices.py` (one process each); `ruff check` on the two backend files | rc 0 each: 2 / 5 / 64 passed; ruff: all checks passed |
| Tests typecheck / lint | e612b2af4: `npx tsc --noEmit -p tsconfig.tests.json`; `npx eslint tests/evidence-home-screen.spec.ts` | rc 0; rc 0 (1 warning: the file is on the eslint ignore list, as before) |
| The edit-mode test alone, idle runner | 83afb8ca5: `-g "edit mode: the direction" --repeat-each=20`, desktop | 20 of 20 passed (the old drag failed 8 of 28 like this) |
| **10 consecutive whole-file runs, final head** | e612b2af4, sequential, load 5-8 | **10 of 10 green** (25 passed, 0 failed each) |
| **Loaded: 4 whole-file runs in parallel, twice** | e612b2af4, 4 worktrees at once, load 13-17 | round 1: 3 of 4 green - 1 failed: the settings direction picker (line 948, "המסך הראשי נשמר" not shown within 5 s; see Q2); round 2: 4 of 4 green |
| 10 consecutive whole-file runs, previous heads | 2296fae12 (the weather + b fixes, the old drag): 10 of 10 green, run under a release gate's load (load 21-42); 83afb8ca5 (+ the drag): 10 of 10 green (load 6-17) | 20 of 20 green |
| Loaded, 83afb8ca5 | 4 whole-file runs in parallel | 3 of 4 green - 1 failed: the cards-info fold check (see (4); fixed in e612b2af4) |
| **The base, for comparison** | aeb05ad3d, 3 whole-file runs (beside the 2296fae12 runs, under the gate's load) | 2 of 3 green - run 1 failed: the weather sensor reading ("31°C") |
| Diagnostics (instrumented copies, never committed) | isolated `--repeat-each` and whole-file runs on the branch (2bf0b098b) and the base, under load and idle; CPU-throttled drags | as quoted in the root causes above; the branch's whole-file instrumented runs failed the weather test 3 of 5, the base's 0 of 5 |

NOT_RUN: Playwright / tsc on the PC (PC rule); the release gate itself; the tablet project (not in this spec's project list); a
fix for the one settings-picker failure (root cause not found, Q2).

## Open questions (recommendation first)

1. The home screen picks up growth that does not resize its page body (the shell's setup hint above it, a widget's own late data) only on
   its recheck timers, so on a slow device the page can scroll for up to about 1.5-3 s after it opens (measured 1.7 s on the loaded
   runner): (a) a follow-up row that also watches the page area's own size (a ResizeObserver on the scroll container) so such growth
   re-packs at once [recommended - small, and the owner's wall tablets are slow]; (b) leave it - it settles by itself.
2. The settings direction picker test (הגדרות › חשמל והתקנים › מסך ראשי, line 948) failed once in 8 loaded whole-file runs at the final head
   (the "saved" message did not appear within 5 s after choosing b); never in the 30 sequential whole-file runs here, nor in 48 isolated
   repeats of that test 4-in-parallel (the save took 0.3-1.0 s there). The trace of that run was overwritten by the next round, so the
   cause is not known: (a) a follow-up row that runs that test instrumented (the save's request / response, the button, whether the card
   element is replaced) in loaded whole-file runs until it is caught, and fixes it at its cause [recommended - no blind wait]; (b) accept
   the rate (1 of 32 whole-file runs at this branch's last two heads, 1 of 42 with 2296fae12) for now.
3. In edit mode a click's own scroll can leave the page area scrolled (39 px here) and a later action scrolls it back: invisible to a user,
   it only broke the test's drag. No action proposed: (a) none [recommended]; (b) a row to keep the band's position steady in edit mode.

## Rollback

Revert the branch's commits. No data, setting or API change.
