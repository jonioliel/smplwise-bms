# FLAKY-S12-FIX-2441 - the cause of the flaky phone pixels of CR-036 S12

Branch `pilot/FLAKY-S12-FIX-2441`, base `origin/release/2437-train` (d849af79c). Ticket FLAKY-S12-PIXEL-2412.

## State found on the base

The quarantine entry `[mobile] pixel: CR-036 S12` is already gone on this base (and on origin/main): a7d7dde5c removed it on
2026-11-11 after 9323daaa5 ("the display card waits for a stable layout"). `gate_quarantine.py check`: 0 active, 0 expired. Only the
old local `main` checkout still shows the entry. Nothing to remove and nothing to renew.

The explanation recorded on 11.11 (the engine list and the readiness line land late and the lines wrap) does not hold: measured here,
the card WITHOUT the engine list is 168 px SHORTER (1090 against 1258), not 15-23 px taller, and the readiness row is not drawn at all
in this state (video and talk are off in the mock). The wait added then did no harm, but it did not address the cause.

## The cause (reproduced locally, deterministic)

Playwright 1.63, Chromium, the `mobile` project (Pixel 7: `isMobile`, `hasTouch`). For an element that is TALLER than the viewport, the
element screenshot enlarges the viewport for the shot and puts it back afterwards. Putting it back drops the touch emulation of the
page: `(pointer: coarse)` and `(hover: none)` turn false, `navigator.maxTouchPoints` goes 1 -> 10, and it stays that way. A plain
`page.setViewportSize()` does not do this, and neither does a shot of an element that fits.

The phone layer (`design/mobile-polish-css.ts`, `@media (max-width: 767px) and (pointer: coarse)`) puts every text field at the xl tier
so that iOS does not zoom on focus. When the coarse pointer goes, the five-line phrase box of the display card falls from 18 px text
to its desktop size:

| skin | phone state (true) | after the emulation is dropped | difference |
| --- | --- | --- | --- |
| classic | 366x1259 | 366x1244 | 15 px |
| domus | 366x1267 | 366x1244 | 23 px |

Those are exactly the sizes of the ticket: baseline 366x1244, failures 366x1259 and 366x1267, "15-23 px taller".

Four element shots in a row of the classic card, measured here (also under CPU throttling x6 and x20): `1259 -> 1244 -> 1244 -> 1244`.
`toHaveScreenshot()` shoots until two shots in a row are equal, so on a quiet machine it compares the second state - and that is what
the committed baselines hold: a 390 px page WITHOUT its phone rules, seen through the 781 px scroll area (276 px of empty background
on top, the bottom bar drawn across the card). In a full gate the page had not re-laid itself out by the second shot, two equal shots
of the phone state made a "stable" picture, and it was 15 / 23 px taller than the baseline. Alone: green. Under load: red.

Honest limit: the failing ORDER (two phone-state shots in a row) was not reproduced on this PC - renderer CPU throttling alone does
not produce it. The two states, their sizes and the trigger are reproduced exactly; the order under gate load is inferred from them.

Reach in the suite: of 273 phone baselines (`*-mobile-linux.png`), 7 are taller than 844 px, all 7 in `pixel-access-s12`. No other
spec takes a phone picture of an element taller than the viewport today.

## What changed

- `frontend/tests/helpers/phone-tall-shot.ts` (new): `phoneRoom(page, target)` grows the viewport with `setViewportSize` until the
  element is whole inside its scroll area, so the shot needs no enlargement and the page stays a phone; it returns the way back to the
  viewport the test had. `stillAPhone(page, when)` fails the moment the touch emulation is gone.
- `frontend/tests/pixel-access-s12.spec.ts`: `compare()` gives a phone element room before the shot, checks `stillAPhone` after every
  phone picture and restores the viewport. The 20-frame height loop of 11.11 is gone. Two waits that do not guess replace it: the
  spec counts the open `/api/v1/` requests itself (`apiIdle`, fails loudly with the list of open requests), and waits for the new
  marker of the card.
- `frontend/src/screens/system-access-display.ts`: the ready card carries `data-access-display-settled="true|false"` - false while
  the readiness read or the engine list is still on its way. An attribute only; nothing drawn changes.

## Pixels to refresh (lead, on the runner)

The phone pictures of this spec now show the real phone state and the whole element, so all of them change. Until they are re-taken the
`mobile` project of `pixel-access-s12` is red deterministically (not flaky):

`frontend/tests/pixel-access-s12.spec.ts-snapshots/` - `s12-classic-display-390`, `s12-domus-display-390`, `s12-classic-parity-390`,
`s12-domus-parity-390`, `s12-classic-parity-operator-390`, `s12-classic-checklist-390`, `s12-classic-audit-person-390`
(`-mobile-linux.png`, 7 files). Expected sizes from the Windows run: display 366x1259 (classic) and 366x1267 (domus).

`~/run_remote.sh spec pilot/FLAKY-S12-FIX-2441 tests/pixel-access-s12.spec.ts --project=mobile --update-snapshots`

Desktop pictures (`-1440-desktop-linux.png`): no change expected - desktop has no touch emulation and `phoneRoom` is not used there.
Two stale files can go at the same time: `s12-bubble-display-390-mobile-linux.png`, `s12-bubble-parity-390-mobile-linux.png` (and
their 1440 twins) belong to a skin that has no pixel case any more.

## Tests actually run (this PC, Windows, preview of this branch's build on its own port)

Windows has no committed baselines, so each series first wrote local Windows baselines with `--update-snapshots` (deleted afterwards,
never committed) and the repeats were real pixel compares against them.

- `npx tsc --noEmit`: clean.
- `pixel-access-s12 --project=mobile --workers=1 --repeat-each=4`: 20 passed.
- `pixel-access-s12 --project=mobile --project=desktop --workers=1 --update-snapshots`: 10 passed.
- Under load: `pixel-access-s12 --project=mobile --project=desktop --workers=1 --repeat-each=2` while a second process ran
  `pixel-wiskey-stations` + `pixel-settings-intercom-cards-2401` (desktop + mobile, twice): 20 passed. The second process: 40 passed,
  8 skipped (its pictures are not compared on Windows; it shows that the card's other spec still runs with the new attribute).
- Probes (temporary spec, deleted): card height against late engines / late readiness / blocked and late fonts / CPU throttling;
  media features around small and tall element shots; four consecutive tall shots at CPU x1, x6, x20 (twice each).

## NOT_RUN

- Linux pixel compare, the runner, the entry check: not allowed in this batch (the 2.43.7 gate is running). The seven phone baselines
  are therefore NOT refreshed and the phone project of the spec is red on Linux until they are.
- Unit specs: none touched, none run.

## For the lead

- `management/tasks.json` still says READY and "quarantined until 2026-11-16" for FLAKY-S12-PIXEL-2412; not touched here (many
  branches edit it today). Its acceptance asks for two green full gates after the fix.
- `pixel-settings-intercom-cards-2401` waits only for the engine ROW of the same card, which exists while the list is still loading;
  `[data-access-display-settled="true"]` is the wait it should use. Not changed here.
- Any new phone pixel case of an element taller than 844 px needs `phoneRoom`; `stillAPhone` in a shared after-hook would catch the
  next one.

## Phone baselines refreshed on the runner (17.11)

`origin/main` (2.43.7, cc69447f1) merged first (be6e7ff10, no conflicts). All runs: `private/runner/run_smart.py preview
pilot/FLAKY-S12-FIX-2441 tests/pixel-access-s12.spec.ts ... --machine runner`.

| Run | Commit | Result |
|---|---|---|
| `--project=mobile -u --workers=1` | be6e7ff10 | 5 passed; 6 phone baselines rewritten, `s12-classic-audit-person-390` unchanged (within tolerance, not rewritten); committed 172049f16 |
| `--project=mobile --project=desktop --workers=1 --repeat-each=2`, no `-u` | 172049f16 | 20 passed |

Sizes: `s12-classic-display-390` 366x1244 -> 366x1259, `s12-domus-display-390` 366x1244 -> 366x1267 (as expected for the phone state);
`classic-parity` 366x1774, `classic-parity-operator` 366x1903, `classic-checklist` 366x918, `domus-parity` 366x1773 keep their size.
No desktop baseline changed. Not run: the full entry check (queued after this commit).
