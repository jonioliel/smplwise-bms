# PIXEL-RETAKE-2406 - 52 baselines that moved with the tab-strip reveal (FOLLOWUPS-2406 item 4)

Branch `release/2406-train`, on top of `216421eac` (the 2.40.6 UI rebuild). Baselines and this record only: no product source change,
no spec change, no version bump, no changelog entry, no tag. No lab, Home Assistant, NVR, go2rtc, WisKey or station contact: the pixel
specs run against `vite preview` of the built UI with no backend (demo mode), as in the gate.

## 1. What the gate saw

The 2.40.6 L gate (`~/smplwise-results/gate_release-2406-train_216421eac.gate2.md`, section "Test failures") had 36 pixel tests that
"failed again alone", every one by a small count (about 1 % of the image):

| Spec | Tests (project) |
|---|---|
| `evidence-wiskey-installer.spec.ts` | :138 :220 :318 :428 (desktop + mobile) |
| `pixel-access-s12.spec.ts` | :62 (mobile) |
| `pixel-access-status.spec.ts` | :48 classic + domus, :60, :71, :96 (mobile) |
| `pixel-wiskey-access-diag.spec.ts` | :53 :62 :73 :79 (mobile) |
| `pixel-wiskey-messaging.spec.ts` | :91 :100 :118 :136 :155, :207 classic + domus, :214 (mobile) |
| `pixel-wiskey-people.spec.ts` | :55 light + dark, :66 :74 :82 :89 :97 :111 :117 :128 (mobile) |

## 2. Cause

FOLLOWUPS-2406 item 4 (`frontend/src/components/sw-tabs.ts`): until the person scrolls a tab strip, the automatic reveal starts from the
start edge every time and then brings the active tab into view, so the scroll depends only on the final width. The shell's top tab strip
(the Settings sections on the desktop title row, the area tabs on a 390 px phone) therefore now opens at a different, deterministic scroll:
the active tab sits at the end edge of the strip, with the arrow knobs where the strip overflows. The old baselines held the scroll the
earlier, path-dependent reveal happened to reach. FOLLOWUPS-2406.md says the UI was not rebuilt there, so the train's rebuild (`216421eac`)
is the first build whose pixels show it.

## 3. Method (no release gate)

On the runner, with no gate, nightly or entry check running (`gate_status.json` = finished, `pgrep` empty), in a fresh worktree
`~/work/pixfix-2406` of `216421eac`: `npm ci` (the train's lock differs from the base checkout's: vite 6.4.5), `npx vite build`,
`vite preview` on a free port with `SW_API_PORT` on a dead port, then `npx playwright test <file:line ...> --workers=1 -g pixel-stable`,
the installer lines with `--project=desktop --project=mobile`, the rest with `--project=mobile` (the projects that failed). The tests lock
(`~/.smplwise-tests.lock`) was taken shared only while Playwright ran (about 2.5 minutes per run).

| Run | Mode | Result |
|---|---|---|
| 1 | `--update-snapshots=changed` | 8 + 29 passed; 52 images rewritten |
| 2 | plain compare against run 1's images | **8 + 29 passed, 0 failed** (stable) |
| 3 | plain compare against the committed (old) images, run 1's set aside and restored after | 36 failed, as in the gate (2 033 / 712 / 587 / 390 / 135 px), diff images kept |

## 4. Check of every image

Each of the 52 new images was compared with the committed one (a pixel counts when any channel moves by more than 16 levels; same
size in every case). **Every difference lies inside the top tab strip** (rows 8-47 of the image, nothing below):

| Images | Differing px | Box (x, y) |
|---|---|---|
| `evidence-wiskey-installer` clock / lifecycle / platform / technical-1440 (desktop) | 11 071 each | x 303-1279, y 17-47 |
| `evidence-wiskey-installer` clock / lifecycle / platform / technical-390 (mobile) | 3 170 each | x 140-349, y 10-40 |
| `pixel-access-s12` s12-classic-audit-person-390; `pixel-access-status` classic audit / busy / empty / groups / list / not-connected / policy / stale-390, domus-list-390; `pixel-wiskey-messaging` settings-classic / -classic-service-down / -domus-390 | 4 710-4 711 | x 142-349, y 10-40 |
| `pixel-wiskey-messaging` settings-classic-dark-390 | 4 677 | x 142-348, y 9-38 |
| `pixel-wiskey-access-diag` audit / compare-people / lifecycle / reviews-list-390; `pixel-wiskey-people` cards / list-classic-light / operator-list / selection / state-empty / -error / -loading / -stale-390 | 914 | x 140-348, y 11-37 |
| `pixel-wiskey-people` list-classic-dark-390 | 1 011 | x 140-348, y 10-37 |
| `pixel-wiskey-people` state-forbidden-390 | 832 | x 141-348, y 20-30 |
| `pixel-wiskey-access-diag` review-dialog-390; `pixel-wiskey-messaging` msg-credential / -declined / -form / -quota / -sent / -uncertain-390; `pixel-wiskey-people` msg-quota-390 | 785-788 | x 140-348, y 18-36 |
| `pixel-wiskey-messaging` msg-bulk-running-390 | 785 | x 140-348, y 8-26 |
| `pixel-wiskey-messaging` tab-classic-light / tab-empty / tab-error / tab-optout-390; `pixel-wiskey-people` drawer-access / drawer-classic-light / operator-drawer-390 | 619 | x 141-348, y 18-36 |

Looked at as images (Playwright's `-diff.png` of run 3, and old / new side by side): installer-clock-1440 (desktop), status-classic-list-390,
msg-form-390, list-classic-dark-390. In each the only change is the window of tabs in the top strip (and its arrow knobs); the page body,
fonts, colours, the dialogs and the side rail are identical. No other change (layout, content or fonts after the vite 6.4.3 -> 6.4.5 bump)
was found, so nothing was rejected.

## 5. Re-taken (52)

`frontend/tests/<spec>-snapshots/`:

- `evidence-wiskey-installer.spec.ts`: installer-clock / -lifecycle / -platform / -technical, 1440 desktop and 390 mobile (8)
- `pixel-access-s12.spec.ts`: s12-classic-audit-person-390 (1)
- `pixel-access-status.spec.ts`: status-classic-audit / -busy / -empty / -groups / -list / -not-connected / -policy / -stale-390,
  status-domus-list-390 (9)
- `pixel-wiskey-access-diag.spec.ts`: diag-audit / -compare-people / -lifecycle / -review-dialog / -reviews-list-390 (5)
- `pixel-wiskey-messaging.spec.ts`: msg-bulk-running / -credential / -declined / -form / -quota / -sent / -uncertain-390,
  settings-classic / -classic-dark / -classic-service-down / -domus-390, tab-classic-light / -empty / -error / -optout-390 (15)
- `pixel-wiskey-people.spec.ts`: cards, drawer-access, drawer-classic-light, list-classic-dark, list-classic-light, msg-quota,
  operator-drawer, operator-list, selection, state-empty / -error / -forbidden / -loading / -stale, all -390 (14)

52 images for 36 failing tests: a test with several shots stops at its first failing one, so the later shots of the same test were only
seen (and rewritten) in run 1.

## 6. Receipts

- Runner worktree `~/work/pixfix-2406` (detached at `216421eac`); logs `~/work/pixfix-2406-out/pw_{1,2,3}_{both,mob}.log` and JSON
  reports beside them; run 3's diff / actual / expected images in `~/work/pixfix-2406-out/res_3_*`.
- Run 2: `pw_2_both.log` "8 passed (13.0s)", `pw_2_mob.log` "29 passed (2.0m)".
- NOT_RUN: the full pixel set and a release gate (the next 2.40.6 gate re-checks everything); the desktop project of the mobile-only specs
  (it passed in the gate).
