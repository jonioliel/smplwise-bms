# WISKEY-PIXEL-QUAR-2431 - the quarantined stations door-settings pixel shot (WKWATER-POLISH-2331-pixel)

Branch `pilot/WISKEY-PIXEL-QUAR-2431`, cut from `origin/main` at `a5618fad6` (2.42.1). Test-only: one spec changed
(`frontend/tests/pixel-wiskey-stations.spec.ts`), **no baseline rewritten, no product code changed**.

## 1. Why

The runner's `~/gate2/gate2_quarantine.json` held `pixel-wiskey-stations.spec.ts:87` (ticket WKWATER-POLISH-2331-pixel, added
2026-11-02, expired 2026-11-09). Since the expiry every entry check counts it as a failure. The entry is runner-only (the repository
copy `scripts/gate/gate2_quarantine.json` never had it).

History (runner reports): FLAKY "failed in the full run, passed alone" in gate_fix-STATION-WS-PATH-2381 (desktop + mobile, 03.11),
gate_fix-BRIDGE-STALE-DISCOVERY-2383, release-2400, 2402, 2403, 2404 trains (desktop, 04-05.11); green in the later gates and in the
five nightlies 07.11-11.11 (lower load), which is why it looked "fixed".

## 2. Root cause (reproduced)

`run_smart.py preview main tests/pixel-wiskey-stations.spec.ts:87 --project=desktop --project=mobile --repeat-each=8 --workers=6`
on the runner, main @ a5618fad6: **6 failed / 10 passed** - every failure desktop, every one `stations-classic-settings-1440.png`
with exactly **20,872 px**. The diff: the drawer identical; every card behind the scrim **7 px higher** than in the baseline (the
toolbar and the alert band above the grid unchanged).

WKWATER-POLISH-2331 (52a8f1364, 01.11) made the desktop screen fit the window: from 768 px up the card grid is its own scroll box
(`wiskey-stations-css.ts`, `.main > .grid { overflow-y: auto }`); the shell's `main` no longer scrolls there. The spec's `pinLobby`
(STATIONS-FLAKE-2270) still pinned only `sw-app` `main`, so the grid kept whatever scroll the click on the lobby card's "open"
button left. Under load the card is still in its entrance (6 px low), the button is clipped by the grid's edge and Playwright's
click scrolls the grid by 7 px. Alone the entrance is over before the click and nothing scrolls - hence "passes alone".

## 3. Fix

- `pinLobby` also pins the grid's own scroll (when the grid is a scroll box) at its top - the state every desktop baseline was taken
  in (release / announce / settings 1440 all show the cards at the same y). On a phone the grid does not scroll; unchanged there.
- The door-settings shot aligns the drawer's own scroll box after `settlePage` (it was aligned right after the codes row appeared),
  in `pinSettingsEnd`; then the page behind is pinned as before.

The test moved from line 87 to line 115 (the helper comments grew); the old quarantine match `pixel-wiskey-stations.spec.ts:87` no
longer matches any test.

## 4. Runs (runner, preview build of this branch, no `-u`)

| Run | Result |
|---|---|
| main @ a5618fad6, `:87` desktop + mobile, `--repeat-each=8 --workers=6` (before) | **6 failed** / 10 passed (desktop 20,872 px x6) |
| branch @ 3414624c1, whole spec, desktop + mobile, `--repeat-each=8 --workers=6`, runner load 37.8 on 16 cores | **136 passed**, 8 skipped (the phone-only places sheet on desktop), 0 failed |
| branch, `:115` desktop + mobile, `--repeat-each=12 --workers=6`, runner load 40 | **24 passed**, 0 failed |
| branch, whole spec, desktop + mobile, `--workers=1` (as the gate) | **17 passed**, 1 skipped (by design), 0 failed |

NOT_RUN: a full gate; the entry check is queued on the runner (`~/pre/entry_wkpix.log`).

## 5. Quarantine

Nothing to change in the repository. The runner entry `pixel-wiskey-stations.spec.ts:87` (WKWATER-POLISH-2331-pixel) should be
moved to `history` by the lead with `removed_reason` "root cause fixed on pilot/WISKEY-PIXEL-QUAR-2431 (grid scroll pin)".
