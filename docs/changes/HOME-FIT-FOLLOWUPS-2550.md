# HOME-FIT-FOLLOWUPS-2550 - the home screen's fit: page-area growth at once, a building switch without an overflow frame; the picker test

Branch `pilot/HOME-FIT-FOLLOWUPS-2550` from `origin/release/2540-train` (f9217db8a). Target 2.55. Follow-up of HOME-SPEC-STABLE-2540
open questions 1 and 2 (both answered a - the owner rule: unanswered = the recommendation), plus item (3) from the lead (the 2.54 train's
finding B, RELEASE-2540-TRAIN section 6 on `bba451a5f`).

## (1) Growth in the page area is packed at once

**Problem.** The home screen packs itself to fit the viewport one step per measure (fit 0 -> 1 -> 2, b's fold, the squeeze). It measured
on its own renders, on a ResizeObserver of its page body (`.page-body`, DOMUS-DEFAULT-2439) and on three recheck timers (0.6 / 1.5 / 3 s
after a settle, HOME-SCROLL-2-2530). Growth in the page area that does not resize the page body - the shell's setup hint arriving above
the screen, a banner - was seen only by those timers (the loaded runner scrolled for 1.7 s, HOME-SPEC-STABLE-2540 root cause (2)), and
once the three timers were spent it was not seen at all until the screen rendered again.

**Fix** (`frontend/src/screens/devices-building.ts`, `watchPageArea` / `onPageArea`). One more ResizeObserver, on the page area (the
shell's scroll container, `scrollParentOf`) and on each of its direct children. The screen's wrapper (`main > .screen`, `flex: 1;
min-block-size: 0`) shrinks when something above it arrives, so its box changes although the page body's does not; a child that grows is
seen itself; a child that arrives later is observed on the next notification or render. A notification only asks for the usual measure
through the shared animation-frame handle (`fitTimer`): at most one per frame. Bounded: an observer reports only real size changes (a page
at rest gets none), and the measure only packs tighter for a given fit key (four steps at most), so the notifications its own steps cause
end when the packing settles. No timer, no new state, no loosening. Disconnected with the screen; moved when the scroll container changes.

## (2) The settings direction picker test (two causes, both in the test)

`evidence-home-screen.spec.ts`, "הגדרות › חשמל והתקנים › מסך ראשי" (line 948 on the base) failed once in 32 loaded whole-file runs.

**(2a) The "saved" message within 5 s - the save's durable commit.** The card shows "המסך הראשי נשמר" only after the PATCH /settings
answer, and that answer follows a durable commit (`synchronous=FULL`). The backend log of that one failure (still on the runner,
`/tmp/fixture_job_l6f2405q`) has `write lock held 5.1 s by PATCH /api/v1/settings` at 16:55:04.137; the test gave up at 16:55:04.19
(start 16:54:56.484 + 7709 ms) - 50 ms earlier. The 5 s default measured the runner's disk, not the card. Fix: the test waits for the
save's own answer (status 200, bounded by 30 s) and then expects the message; the side choice reads the stored value once its save
answered (was a 5 s poll). Reproduced on purpose: every PATCH answer held back 5.5 s (a diagnostic `page.route`, never committed) fails
the old test 2 of 2 and passes the new one 2 of 2. Not seen again naturally in 66 loaded runs of the old test (the largest save hold logged
there: 1.9 s; the 5.1 s came during a release gate, load ~35).

**(2b) The edit link clicked while still disabled - caught with a trace.** The stress (3 whole-file runs at a time, trace kept on failure)
failed the old test once, in its 22nd round (runs 64-66; load 32-46, a second release gate had started): "עריכת המסך הראשי" was clicked
and the edit panel never came (30 s). The trace: "locator resolved to `<sw-button disabled ...>`", the input snapshot (taken just before
the click) still shows `disabled`, the card's own GET /settings answered only about then, no navigation followed. The link is disabled
until the card's settings read says this user may edit (`ro`); Playwright counts a custom element's `disabled` attribute as enabled, so
the click went to the inner `<button disabled>`, which swallowed it. Fix (test): wait until the link has no `disabled` attribute, then
click. No product change - the link is right to wait for the permission. Reproduced on purpose: the page's GET /settings answers held back
3 s fail the old test 2 of 2 (the same "home-edit-panel not visible"), the new one passes 2 of 2.

## (3) A building switch never paints an overflow frame

**Problem** (RELEASE-2540-TRAIN section 6, B; since v2.53.0). On a multi-building site every building switch is a new fit key, so the
packing restarted from its loosest step, and every step waited for the next animation frame: the new building was painted once or twice
at fit 0 and the page overflowed by 5-9 px before it settled.

**Fix** (`devices-building.ts`, `measureFit` and `packNow`), reached in three measured steps:
- a building switch (the level changed; the viewport, the view, the tree's shape, the direction, the side and the phone layout did not)
  keeps the step the screen is on: a new building that fits there stays, one that does not packs tighter from there by the usual steps (a
  looser step cannot fit where this one does not, so the restart only ever drew the overflow);
- after a render that changed the level, the measure runs in a microtask once that render's children have drawn too (three microtask
  hops), and a step it takes renders and measures again the same way - before the next paint. Bounded: at most `FIT_SYNC_STEPS` (4)
  measures per switch, ending at the first measure that changes nothing; then the frames, the observers and the rechecks take over as
  before. Not used for the level the screen opens at.
- How it was reached: the first commit (`6af65fc30`, "keep the step when the new building fits in it", as the lead proposed) still failed
  7 of 8 on the tablet - building ג was at fit 0 and the shared building needs fit 1, so a step had to be taken, a frame late. With the
  pre-paint measure (`6dcd0c373`) 8 of 8 passed, but an instrumented run (every measure and DOM change, tablet x20) still failed 2 of 20:
  building ג had been at fit 2, the switch's first read of the half-drawn shared building said 9 px over, so the "when it fits" condition
  restarted it from fit 0, and it overflowed 5 px a frame later. `d2cb38812` drops the condition (never restart on a switch): 40 of 40
  and an instrumented 30 of 30 (building ג starting at fit 0, 1 and 2) with no reading over 1 px.
- What a user sees: a building that fits at a looser step than the previous building's stays at the previous step after a switch (see Q1).

## Files

| File | Change |
|---|---|
| `frontend/src/screens/devices-building.ts` | (1) `watchPageArea` / `onPageArea`; (3) the building-switch rule in `measureFit` (`fitRest`, `fitLevel`), `packNow`, `FIT_SYNC_STEPS` |
| `frontend/tests/evidence-home-screen.spec.ts` | (1) new desktop test: growth in the page area after the recheck timers ran out - the first step within 4 frames, then no measure while idle, no ResizeObserver / page error; (2) the picker test waits for its saves' answers and for the edit link to be enabled |
| `frontend/tests/evidence-multibuilding-home-2330.spec.ts` | (3) new test: building ג -> "משותף", the page area's overflow read on every animation frame and on every re-pack for 1.5 s; none over 1 px |
| `docs/changes/HOME-FIT-FOLLOWUPS-2550.md` | this note |

No look changes at rest (no token, size or colour; `scripts/design_ratchet.py` rc 0, no count above the baseline). The committed Linux
pixel baselines of the home screen still match (visual-matrix home cases, below), so none was refreshed. `evidence-multibuilding-home-2330`
is also changed on the 2.54 train (`7accbe97d`, the polled check in "the shared building" test); this branch only appends a test at the
end of the file.

## Tests run (real results)

All on the runner (slot B / priority slot via `~/work/slotb.sh`, job scripts `p2520_hff_*`); "whole file" = `scripts/fixture_job.py
evidence-home-screen --no-build` (desktop + mobile, the gate's fixture lane). Backend holds were logged from 0.2 s (`SW_DB_SLOW_HOLD_S`).

| What | Where / command | Result |
|---|---|---|
| Typecheck / build | `npm run build` (tsc + vite) at 71a857f97, 6af65fc30, 6dcd0c373, d2cb38812; `npx tsc --noEmit -p tsconfig.tests.json` (71a857f97, 6af65fc30) | rc 0 each |
| eslint | `devices-building.ts` + the two specs | rc 0, 0 errors (warnings: the spec files are on the eslint ignore list) |
| design ratchet | PC, `py -3.12 scripts/design_ratchet.py` | rc 0, no count above the baseline |
| (1) the new fit test BEFORE | base UI f9217db8a + the branch spec, `-g "growth in the page area" --repeat-each=3`, desktop | **3 of 3 failed**: "fit 0 -> fit 0, 60 frames, ~1 s" (never stepped) |
| (1) AFTER | 71a857f97: `--repeat-each=10`; 6af65fc30, 6dcd0c373, d2cb38812: `--repeat-each=5` each | **10 of 10, 5 of 5, 5 of 5, 5 of 5 passed** |
| (2a) the save held back 5.5 s | `page.route` diagnostic, `-g "direction picker" --repeat-each=2` | old test 2 of 2 failed (the message), new test 2 of 2 passed |
| (2b) the settings read held back 3 s | same, GET /settings | old test (71a857f97) 2 of 2 failed ("home-edit-panel" not visible), new test (6af65fc30) 2 of 2 passed |
| (2) stress A - the OLD picker test | base spec, whole-file runs 3 at a time, trace on failure, 22 rounds (load 8-46; a release gate ran from round 19) | **66 runs, 1 picker failure** (round 22: the edit link, (2b)); the message failure (2a) not seen; other tests failed 5 times, all in rounds 19 and 22 under the gate's load (the cards info style test x4: three times the page did not load in 30 s, once "a tiles 1180x820" still scrolling after the 8 s poll; the edit-mode drag x1: the band not at rest in 10 s) |
| (2) stress B / C - the NEW picker test | B: 71a857f97, 1 round; C: 6af65fc30 (both picker fixes), 10 rounds (load 5-12) | B: 3 of 3 green; **C: 30 of 30 whole-file runs green** (26 passed each) |
| (3) the frame test BEFORE | UI of 71a857f97 + the new spec, `-g "never overflows" --repeat-each=8`, desktop + tablet, twice | **tablet 8 of 8 failed both times** (9 px over at fit 0, once 5 px; one frame and one re-pack each); desktop 8 of 8 passed |
| (3) intermediate heads | 6af65fc30 (keep when it fits): x8; 6dcd0c373 (+ pre-paint): x8, then instrumented tablet x20 | tablet 7 of 8 failed; 8 of 8 passed; instrumented **2 of 20 failed** (5 px; the restart from fit 0) |
| (3) AFTER, final | d2cb38812: `--repeat-each=20` desktop + tablet; instrumented tablet x30 | **40 of 40 passed; 30 of 30 passed**, every reading <= 1 px |
| `evidence-multibuilding-home-2330` all projects | 6af65fc30 / 6dcd0c373 / d2cb38812 | 1 failed each of the first two (the new test, resp. the old single read of "the shared building": 5 px); **d2cb38812: 23 passed, 1 skipped** (the old single read passes too) |
| whole file | 71a857f97 / 6af65fc30 / 6dcd0c373 / **d2cb38812**: 26 passed, 0 failed, 0 flaky each | rc 0 each |
| visual-matrix home cases, desktop + tablet | 71a857f97, 6af65fc30, 6dcd0c373, d2cb38812 builds | 12 passed each - the committed baselines match |

NOT_RUN: Playwright / tsc on the PC (PC rule); the release gate; tests typecheck and eslint after 6af65fc30 (the specs changed after it
only in comments; the product file is typechecked by every build); the tablet project of `evidence-home-screen` (not in its project list);
the area screen (its fit is untouched).

## Open questions (recommendation first)

1. A building switch keeps the tighter step when the new building also fits there, so a small building opened after a large one can stay
   one step tighter (smaller tiles) than when it is opened directly: (a) keep - no frame jumps, and the screen still fits [recommended];
   (b) a follow-up that tries the looser step once before the paint and keeps it when it fits (more measures per switch).
2. Under a release gate's load other tests of `evidence-home-screen` failed in the stress (the page not loaded in 30 s x3, a tiles
   1180x820 still scrolling after 8 s x1, the drag band not at rest in 10 s x1): (a) leave - they are timeouts of a starved runner, not seen without the gate [recommended]; (b) a row for them.

## Rollback

Revert the branch's commits. No data, setting or API change.
