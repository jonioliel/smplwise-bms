# PIXEL-DRIFT-2405 - pixel baseline drift, and the quarantined installer wizard shot

Branch `chore/PIXEL-DRIFT-2405`, cut from `origin/main` at `eab715e53` (v2.40.4). Tests and baselines only: no product source change,
no merge, no version bump, no changelog entry, no tag. No lab, Home Assistant, NVR, go2rtc, WisKey or station contact: mocks only.

| Commit | What |
|---|---|
| `ee2c826fd` | `evidence-wiskey-installer.spec.ts`: the wizard's connection-step shot is deterministic (§2) |
| `c3d4a547e` | `pixel-wiskey-people-writes.spec.ts`: the "saved" shot waits for the list refetch it raced (§1.4) |
| `a0d1c401b` | 97 baselines re-taken on the runner (§1.3) |
| this doc | the record |

## 1. Task 1 - drifted baselines

### 1.1 Method

The pixel specs compare with tolerances (`maxDiffPixels: 40` and the default per-pixel `threshold: 0.2`; the visual matrix allows
`maxDiffPixelRatio: 0.002`, about 2 600 px at 1440 x 900). A change painted in a soft colour, or under a dialog's scrim, stays under
`threshold` and passes, so the baselines drift without a red gate. A strict listing needs the images themselves:

1. Every spec with `toHaveScreenshot(` (32 files) was run on the runner with `--update-snapshots=all`, desktop + mobile + tablet,
   `--workers=1`, against `vite preview` of the built UI (the gate's pixel server), **twice** (`run_smart.py preview ... @ ee2c826fd`).
   Run 1: 504 passed, 356 skipped, 1 failed (`visual-matrix` devices-home dialog light, mobile: `Page.captureScreenshot: Unable to
   capture screenshot`, a Chromium protocol error; it passed in run 2). Run 2: 505 passed, 356 skipped, 0 failed.
2. Each rewritten image was compared with the committed one (a pixel counts when any channel moves by more than 16 levels), and run 1
   with run 2. Helper scripts in the branch's own worktree (`.tmp_pdtools/`, not committed), PIL on the runner.
3. Every cluster was looked at as old / new / difference (crops and side-by-side images in `private-evidence/pixdrift/`, gitignored).

Result, over the 194 images either run rewrote:

| Class | Images | Done |
|---|---|---|
| Identical in pixels to the committed image (only the PNG bytes differ) | 87 | nothing |
| **Stable drift**: run 1 = run 2, both differ from the committed image | 98 | 97 re-taken (§1.3); 1 was a race in its spec (§1.4) |
| **Unstable**: run 1 differs from run 2 | 9 | left as they are (§1.5) |

### 1.2 Verdict

**No product regression was found.** Every stable drift traces to a shipped, intended change, or is 1-5 px of anti-aliasing that the
same build renders the same way every time. Two drifts were races in the tests themselves (the people "saved" shot, §1.4, and the
installer wizard, §2) and one is a race in the shell that is reported, not fixed (§1.5).

### 1.3 Re-taken (97), by cause

The new images are run 2's (identical in pixels to run 1's). Differing px = pixels moved by more than 16 levels.

| | Cause | Images (differing px) |
|---|---|---|
| A | **TV-FIT-2380** (02.11): the bus-times board's default footer now names the place ("עודכן · הכניסה הראשית 09:12", was "· לוח הלובי"), and the portrait footer is two rows. TV-FIT-2380.md §5 asked for all 12 to be regenerated; the commit never landed. | `pixel-bustimes-295`: all 12 (1 697-1 704; portrait 6 542) |
| B | **DARK-SEG-ALL-2380** (03.11): in dark, the chosen segment of the top selector is the light pill (white), where the baseline has the old dark-blue one. Its own branch refreshed only the baselines that failed. | `visual-matrix` dark: devices-building desktop / tablet (1 914), devices-home ready desktop / tablet and dialog desktop / mobile / tablet (1 945-1 988), devices-schedules desktop / tablet (5 192 / 1 646, also the synoptic tab of C), live-wall desktop (2 534), map-floor desktop (2 460), settings-diagnostics tablet (1 286), settings-notifications desktop / tablet (2 302 / 2 264, also the tab arrow of J) |
| C | **The synoptic map** (SYNOPTIC-MOBILE-2342 and its train, 02.11): the home selector has a third segment "מפה סינופטית". | `visual-matrix` light: devices-schedules desktop / tablet / mobile (3 611 / 3 611 / 3 923; mobile also the 16 px field of D), devices-home ready mobile (593) |
| D | **16 px fields on a phone** (POLISH-PHONE-297, the phone input type token in `9aeee0405`): search fields and pickers are drawn at 16 px. | `visual-matrix` mobile: settings-notifications light (4 806, also the tab arrow of J), multimedia-screens light / dark (907 / 905) |
| E | **WISKEY-PEOPLE-COMPLETE-2390** (03.11): the people toolbar gained the station-only button, and on a phone a second row, so the search field moved down behind the drawer. The same images hold the classic dark primary key (SKIN-QA-FOLLOWUP-2404 Q6), which is why SKIN-QA-FOLLOWUP left them. | `pixel-wiskey-people` drawer-classic-dark-390 (594); `pixel-wiskey-messaging` tab-classic-dark-390 (1 976); `pixel-wiskey-people-writes` writes-cards / writes-menu classic-dark-1440 (439 each) |
| F | **WISKEY-DEEPLINKS-2382**: the deep-link icon beside the "מחובר" badge. | `pixel-wiskey-station-media` classic drawer-dark / talking-dark 1440 (502 each) |
| G | **SKIN-QA-FOLLOWUP-2404 Q6**: the deeper classic dark primary key ("אתר חדש"), the region SKIN-QA-FOLLOWUP left because the image also had other drift. | `visual-matrix` sites-ready-dark-desktop (435) |
| H | **SETTINGS-CARDS-ACCORDION-2402**: the new setting row "כרטיסים: נפתחים במקום" changes the truncated summary line. | `pixel-settings-intercom-cards-2401` cards-announce / cards-display-1366 / cards-screens (57 each) |
| I | **POLISH4-WP1 D1** (`8a7fb96bf`): the floating pill's status dot for a user without the settings right (the pill is wider). | `pixel-access-events` events-classic-forbidden-390, `pixel-access-schedules` schedules-classic-forbidden-390 (680 each) |
| J | **Scrolling tab strips** (SETTINGS-TABS-SCROLL-2331 and the sw-tabs tablist, `78ba99658`): a strip that overflows shows its arrow knob at the edge. | `evidence-intercom-ops` overview-390 (20); `pixel-access-events` classic drawer / export / period-390 (74-77), domus drawer-390 (521); `visual-matrix` settings-notifications light desktop / tablet (492 / 435) |
| K | **The side rail's active-area bar**: the 2 px blue bar beside the active area (here WisKey or the current area) sits 1-2 px differently. 4 px per image (12 on map-floor). | `pixel-access-events` 8 images 1440; `pixel-access-schedules` forbidden-1440; `pixel-wiskey-people` state-error / forbidden / loading-1440; `pixel-wiskey-stations` forbidden-1440; `visual-matrix` live-wall light desktop / tablet, map-floor light desktop, multimedia-screens light / dark desktop / tablet |
| L | **The "unassigned" row of the area card** now carries the "⋯" menu like the other rows. | `visual-matrix` devices-home ready / dialog light desktop / tablet (68-74) |
| M | **Skin tokens after 28-30.10**: the access-events table body text is a little darker, and the photo HUD's "דמו" chip on the site cards is more opaque. Small colour moves, inside every tolerance. | `pixel-access-events` events-classic-table-1440 (7 763, text tone only); `visual-matrix` sites-ready light desktop / tablet / mobile (883-1 336) |
| N | **The darker OFF switch track** of the 2380 train (DARK-SEG-ALL-2380.md "Light baselines" names the tablet image; the mobile one has the same track). | `visual-matrix` security-alarm-ready-light-mobile (784) |
| O | **Anti-aliasing and edges, same in both runs**: rounded corners of the call still, the wall plan's dark edges, a label under the door-tech scrim, the sheet's edge, the refresh glyph, 1-5 px of text. | `pixel-incoming-call` call-ringing-dark 1440 / 390 (50); `pixel-wall-plan` band dark x3 (98-115); `pixel-wiskey-door-tech` confirm / hold-390 (182 / 244); `pixel-wiskey-people-writes` editor-timing-390 (74), cards-light-390 / remove-ask-390 (1); `pixel-wiskey-people` state-loading-390 (85), msg-bulk-390 (2); `pixel-wiskey-messaging` msg-bulk-form-390 / msg-form-1440 / msg-credential-1440 (2-5); `pixel-wiskey-stations` sent-390 (2) |

Total 97 (A 12, B 14, C 4, D 3, E 4, F 2, G 1, H 3, I 2, J 7, K 20, L 4, M 4, N 1, O 16).

Not traced to one commit: K, L, M (each is a small, consistent design move visible in the pictures; nothing points at a defect).

### 1.4 A race in the "saved" shot (fixed in the spec, baseline kept)

`pixel-wiskey-people-writes.spec.ts` "a question, the answer ... is pixel-stable", image `writes-saved-1440`: 176 px, same in both runs.
Behind the dialog, the row of the person whose temporary access was just ended (p8, תומר אדר) shows "פעיל"; the committed baseline
shows "מושבת". The drawer itself says "מושבת" in both.

Cause: after a saved write, `wiskey-people.ts` reads the rows again through `scheduleRefresh()`, 800 ms later (`NOTICE_COALESCE_MS`,
one refetch for a burst of WisKey notices). The shot is taken after `settlePage` (400 ms of quiet), so it lands before or after the
refetch depending on the machine. The baseline caught the refreshed row; a quiet runner today catches the stale one. Under the scrim
the difference stays inside the tolerance, so it never failed. The product is right (the row is refreshed shortly after); the test
was not deterministic.

Fix (`c3d4a547e`): wait for `[data-person-row="p8"] sw-badge[label="מושבת"]` before the shot. The baseline is unchanged.

### 1.5 Unstable images (left as they are)

| Image | Run 1 / run 2 vs committed | What |
|---|---|---|
| `evidence-wiskey-installer` installer-lifecycle-1440 (desktop) | **10 933** / 0 | **Finding, not fixed.** In run 1 the Settings section tab strip in the top bar was drawn scrolled, with both arrow knobs, and a different window of tabs; run 2 matched the baseline. `sw-tabs.revealActive()` scrolls the active tab into view on every resize / font event, and the strip's width depends on where the shell places it (`sw-app.updated()`: chips on the title row from 1100 px). Which layout the reveal sees first is a timing matter. This would fail the gate (40 px allowed) when it happens; it has not been seen in a gate report. Proposed ticket: make the shell's top tab strip settle before `revealActive()`, or reveal again after the placement changes. |
| `pixel-wiskey-deeplinks` stations-menu-1440, `pixel-wiskey-messaging` msg-bulk-form-1440 / msg-uncertain-1440, `pixel-wiskey-station-media` drawer-light-1024 / talking-1440, `pixel-wiskey-stations` sent-1440, `visual-matrix` map-floor ready dark / light tablet | 0-8 px | anti-aliasing noise; inside every tolerance |

### 1.6 Observations (no action taken)

- On a 390 px phone the WisKey people toolbar wraps and leaves one icon button alone on its second row (see
  `pixel-wiskey-people` list-classic-dark-390, committed 04.11). It is the accepted baseline; noted for a design pass.
- Under the artificial load of §2.2 (the whole pixel set at 10 workers beside the probe, load average up to 31 on 16 cores) other pixel
  shots also failed (`pixel-wiskey-stations` door settings 1440, `pixel-access-s12` domus display 390, `pixel-access-schedules`
  error/forbidden 390, `pixel-wiskey-messaging` hourly limit 390, `pixel-wiskey-people` skeleton 390, `pixel-wiskey-station-media`
  push-to-talk dark 390, a `visual-matrix` dark mobile shot). That load is far above the gate's (the gate runs the pixel specs one file
  and one worker at a time). Not investigated here.

## 2. Task 2 - `evidence-wiskey-installer.spec.ts:324 [mobile]`, the wizard's connection step

Quarantine entry on the runner: `match "evidence-wiskey-installer.spec.ts:324"`, ticket INSTALLER-WIZARD-PIXEL-2404, until 12.11.

### 2.1 What the gate saw

The 2.40.4 gate log (`gate_release-2404-train_8c8797f22.logs/pw_pixel_1.log` and `pw_pixel_1_retry_mobile.log`) has the same
failure on the first run and on the retry alone: `952 pixels (ratio 0.01 of all image pixels) are different`. The same count twice is a
second stable picture, not noise.

### 2.2 Reproduced, artifacts kept

A script in the branch's runner worktree built the UI, served it with `vite preview`, ran the whole pixel set (31 files) at
`--workers=10` in a loop as load, and ran the wizard test (`--project=mobile --workers=1 --repeat-each=3`) eight times beside it, each
with its own `--output` directory, so actual / expected / diff were kept. It took `~/.smplwise-tests.lock` shared, as the visual and
fixture jobs do.

- On `eab715e53`, under load (load average 10-26): **21 of 24 failed**, every one with 952 px.
- On a quiet runner: 1 of 3, and then 2 of 6 failed. Not only a load problem; load makes it likely.

The kept images (`private-evidence/pixdrift/probe_*/`) show the whole card **77-78 px lower** in the failing shot: its top (the title
"הוספת עמדה" and the step list) is hidden under the shell's header band, and the floating shell pill sits 78 px lower on the card.

### 2.3 Cause

An instrumented copy of the test (never committed) logged the shell's scrolling `<main>` and the card before every step, with
`DEBUG=pw:api`:

| Step | Passing run | Failing run |
|---|---|---|
| page open | `scrollTop 0` | `scrollTop 0` |
| click "הוספת עמדה" | "element is visible, enabled and stable" at once, no scroll, `scrollTop 0` | "element is not stable" x3 (the screen still settling), then "scrolling into view", **`scrollTop 794`** |
| fill the host | `scrollTop 0` | `scrollTop 533` (the field scrolled into view from below) |
| screenshot | `<main>` scrolled to 315: the card's top at the top | `<main>` scrolled to 393: the card's top 77 px above `<main>` |

- On the phone the wizard card is ~785 px tall and the shell's scrolling `<main>` is 781 px: the card never fits. The element
  screenshot's "scroll into view if needed" therefore depends on where `<main>` starts: from above the card it aligns the card's top
  edge (the baseline), from below it aligns the bottom edge, and the card's top 77 px end up under the header.
- Where `<main>` starts came from the click on "add a station". When Playwright finds the button still moving, it retries the action,
  and **a retried action forces a scroll alignment** even for an element already in view. That left `<main>` at 794.
- Under load the click is more often made while the screen is still settling, hence the gate failures and the clean single runs.
- Not the cause: fonts (the shot waits for them and `settlePage` re-resolves them), animations (disabled), the pill (it only moves with
  the scroll position).

### 2.4 Fix (`ee2c826fd`, the test only)

1. `settlePage(page)` before the click, so it is made on a settled screen and is not retried.
2. After filling the host, `<main>` is put back at its top (`scrollTo({ top: 0, behavior: 'instant' })`) before `settlePage` and the
   shot, so the screenshot always scrolls from the place the baseline was taken from.

The baseline is unchanged. Desktop is not affected (the card fits there).

### 2.5 Verified

- Under the same load, on `a0d1c401b`: **24 of 24 passed** (load average 17-31, heavier than the run that failed 21 of 24).
- The confirmation run of §3.

### 2.6 Removing the quarantine entry (for the lead; this branch does not edit `~/gate2/gate2_quarantine.json`)

After this branch is merged into a train, the test's title line moves from **324 to 331**, so the entry's match
`evidence-wiskey-installer.spec.ts:324` no longer matches anything (it would not explain a failure of the new line either). Remove it
with the validated tool on the runner, which moves it to `history`:

```
python3 ~/gate2/gate_quarantine.py remove --match "evidence-wiskey-installer.spec.ts:324" --category pixel \
  --reason "fixed in PIXEL-DRIFT-2405 (ee2c826fd): forced scroll from a retried click; settle + main reset; 24/24 under load"
python3 ~/gate2/gate_quarantine.py check
```

Do it once the train with this branch has passed its gate (the entry expires on 12.11 anyway). The repository copy
`scripts/gate/gate2_quarantine.json` has no entry for it and is untouched.

## 3. Tests

| Check | Where / SHA | Result |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.json` | workstation @ `ee2c826fd` | exit 0 |
| `scripts/gate/lint_spec_waits.py` on the installer spec | workstation | 0 findings |
| `preview` installer spec, `-g pixel-stable`, desktop + mobile (gate shape) | runner @ `eab715e53` | 14 passed (the flake does not show on every run) |
| Probe under load (§2.2) | runner @ `eab715e53` | **21 / 24 failed**, 952 px each, artifacts kept |
| Instrumented probe, quiet | runner @ `eab715e53` | 1 / 3 and 2 / 6 failed; the scroll log of §2.3 |
| 32 pixel specs, `--update-snapshots=all`, desktop + mobile + tablet, workers 1, run 1 | runner `preview` @ `ee2c826fd` | 504 passed, 356 skipped, 1 failed (Chromium capture error, see §1.1); 184 PNG rewritten |
| The same, run 2 | runner `preview` @ `ee2c826fd` | 505 passed, 356 skipped, 0 failed; 178 PNG rewritten |
| Probe under load (§2.5) | runner @ `a0d1c401b` | **24 / 24 passed** |
| 32 pixel specs, **without** refresh, desktop + mobile + tablet, workers 1 | runner `preview` @ `a0d1c401b` | **505 passed, 356 skipped, 0 failed** |
| `scripts/release_check.py` | workstation @ `a0d1c401b` + this doc | every item `[ok]` (version 2.40.4, tag `v2.40.4` exists); RESULT: ready for the owner's approval |

Runner: before every job `~/smplwise-results/gate_status.json` was read (state `pass`, phase `done`, no gate process); one job of this
branch at a time; other agents' jobs (a fixture job, a `main` job) were running beside some of them. This branch's helpers lived in its
own worktrees (`.tmp_pdtools/` on the workstation, `.tmp_pixdrift*` on the runner), never in the lead's scratchpad; the runner ones
were removed at the end.

## 4. NOT_RUN

- The release gate, the full unit sweep, the backend suite (nothing outside `frontend/tests` changed), `build:addon`.
- Windows pixel baselines; browsers other than Chromium; a physical phone.
- The installer desktop flake of §1.5 was seen once in two runs and not reproduced on purpose.

## 5. Rollback

Revert the three commits. The re-taken baselines go back with the revert; the two spec changes only add waits / a scroll reset.
