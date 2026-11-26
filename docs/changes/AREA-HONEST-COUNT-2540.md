# AREA-HONEST-COUNT-2540 - the full interface's area row and summary tell an unknown lock / alarm apart

Branch `pilot/AREA-HONEST-COUNT-2540` from `origin/pilot/HONEST-STATES-2540` (df8285ae8). Target 2.54. Follow-up of HONEST-STATES-2540
open question 3 (recommendation a) - the same truth as the home interface, now in the FULL interface (deep review SCR-10 / SCR-09).
Backend counts additive (ADR-015), no migration, no setting; nothing was run against the lab, a device or Home Assistant.
`frontend/src/home/*` and `sw-toggle.ts` are not touched.

## What was wrong (confirmed at the base)

- `services/devices.py count_into`: a lock counted only `locks` / `locks_locked`; the area row (`api/area-row.ts`) drew
  `locks - locks_locked` as "not locked" - an offline lock (or one answering `unknown`) was a warm "unlocked" indicator, and an offline
  lock whose stale state still said `locked` was counted as locked.
- The area `alarm` summary: the FIRST panel set it and only a `disarmed` value could be replaced. So `[unavailable, armed_away]` said
  "unavailable" (the armed panel was hidden) and `[disarmed, unavailable]` said "unavailable" (a known disarmed turned into "not
  available"). The floor / building sums (`_sum_counts`) and the client's multi-building sum (`api/home-site.ts sumCounts`: "triggered,
  else the first present") had the same flaw. The area row and the floor chip drew any state other than `disarmed` warm - an
  unavailable / unknown panel looked like an armed one.

## The rule (exact)

Lock (one entity): **known** = `available` is not false AND the state is one of `locked, unlocked, open, opening, locking, unlocking,
jammed` (the home interface's `LOCK_STATES`). A known lock counts in `locks_locked` when `locked`; an unknown lock counts in
`locks_unknown` and never in `locks_locked`. Invariant: `locks_locked + locks_unknown <= locks`; "not locked" = `locks - locks_locked -
locks_unknown`.

Alarm summary (several panels of a scope, and the same for floor / building / several buildings): each panel's state is read as
`unavailable` when the entity is offline (`available` false, whatever its stale state), `unknown` when it has no state, else its state.
The summary is the state with the highest rank; equal ranks keep the first panel (the stable domain / name order):

| rank | state |
|---|---|
| 7 | `triggered` |
| 6 | `pending` (entry delay) |
| 5 | `armed_home` / `armed_away` / `armed_night` / `armed_vacation` / `armed_custom_bypass`, and any state the table does not name |
| 4 | `arming` |
| 3 | `disarming` |
| 2 | `disarmed` |
| 1 | `unknown` (or no state) |
| 0 | `unavailable` (or offline) |

So one unreadable panel never hides a known state of another, and "unknown" / "unavailable" is the summary only when NO panel's state
is known ("unknown" before "unavailable", like the home chip). `alarms_unknown` counts the panels of rank < 2, so a "disarmed" beside an
unreadable panel is never the whole truth: the row's title and the area popover say "N לא ידוע".

## What the screen shows now

- Area row, item "locks": the warm unlock indicator `locked/total` only for known open locks; an unknown lock is its own grey (dimmed)
  indicator "לא ידוע" (all the area's locks) or "N לא ידוע", title "מנעולים במצב לא ידוע: N מתוך M", `data-ind-unknown`. It is drawn
  whenever there is one ("only when active" does not hide it - it is not an idle state).
- Area row, item "alarm": an `unknown` / `unavailable` summary is grey (dim, `data-ind-unknown`), never warm; a known summary beside
  unreadable panels keeps its text and says "אזעקה · לוח אחד במצב לא ידוע" / "אזעקה · N לוחות במצב לא ידוע" in its title.
- The floor header's alarm chip is warm only for a known non-disarmed state (`alarmWarm`).
- The building's "מנעולים נעולים" tile: "יש מנעול פתוח" (stale tone) only for a known open lock; only unknown ones -> "מצב N
  מנעולים לא ידוע" / "מצב מנעול אחד לא ידוע" (offline tone); all known and locked -> "הכול נעול" (live). It said "a lock is open"
  for any lock not counted as locked.
- The area summary popover (`devices-bulk-menu` chips): a grey "מצב לא ידוע N" chip (`data-chip="locks_unknown"`) beside "נעולים
  x/y", and "אזעקה: {state} · N לא ידוע" when panels are unreadable.
- Default area row (climate, lights, switches, media) is unchanged: locks and alarm are opt-in items, so a site that did not choose them
  sees nothing new. An older server (no new fields) reads as 0 unknown - today's row.

## Files

- `smplwise_vms/backend/smplwise/services/devices.py` - `empty_counts` (+`locks_unknown`, `alarms_unknown`), `LOCK_KNOWN_STATES`,
  `lock_known`, `ALARM_RANKS`, `alarm_rank`, `alarm_state_of`, `merge_alarm`; `count_into` and `_sum_counts` use them
- `smplwise_vms/backend/smplwise/wire/devices.py` - `DeviceCounts.locks_unknown`, `.alarms_unknown`; `frontend/src/api/generated/wire-devices.ts` regenerated
- `frontend/src/api/devices.ts` - `DeviceCounts` keeps the two new fields optional; `alarmRank`, `alarmKnown`, `alarmWarm`, `mergeAlarm`
- `frontend/src/api/area-row.ts` - `Indicator.unknown`, the locks / alarm indicators, `lockUnknown`, `alarmsUnknown`
- `frontend/src/api/home-site.ts` - `sumCounts` uses `mergeAlarm` and adds the unknown counts when present
- `frontend/src/screens/devices-building.ts` - `data-ind-unknown`, the floor alarm chip, the locks tile (`lockKpi`), the demo sum
- `frontend/src/screens/devices-bulk.ts` - the popover chips
- `frontend/src/i18n/lang/en/i18n/msg/api-home.ts`, `.../devices.ts` - English of the nine new texts
- tests: `smplwise_vms/backend/tests/test_area_honest_count_2540.py`; `frontend/tests/unit-area-honest-count-2540.spec.ts`,
  `evidence-area-honest-count-2540.spec.ts`, `pixel-area-honest-count-2540.spec.ts` (+ Linux baselines), `area-honest-count-2540-mocks.ts`,
  `area-honest-count-2540-shots.spec.ts` (compare captures, SW_SHOTS only)

## Tests

Runner jobs (slot B, mocked backends only): `~/work/p2520_ahc_run.sh` (v1) / `p2520_ahc_run2.sh` (v2) at b23f38ca3, `p2520_ahc_fix.sh`
and `p2520_ahc_be.sh` at 6fd16f46a; base = `pilot/HONEST-STATES-2540` (df8285ae8 for v1/v2, 3e73e2d00 for the fix job - it differs only
by two `export` keywords in `src/home/*`). 1c66ec80b merges 3e73e2d00 in; nothing else changed after 6fd16f46a.

Fails before / passes after (the same test files run against the base code):

| Check | Base | Branch |
|---|---|---|
| `tests/test_area_honest_count_2540.py` (pytest, one process) | exit 1, 32 failed | exit 0, 32 passed (also on the PC: 32 passed) |
| `unit-area-honest-count-2540.spec.ts` (Node unit) | exit 1 - `devices` has no export `alarmKnown` | exit 0, 6 passed (also on the PC: 6 passed) |
| `evidence-area-honest-count-2540.spec.ts` desktop + mobile (preview build) | exit 1, 8 failed, 4 passed (the 4 = no sideways scroll and "a really open lock says so", true before too) | exit 0, 12 passed |

Other checks on the branch:

| Check | Command | Exit | Result |
|---|---|---|---|
| wire types | `scripts/gen_wire_types.py --check` | 0 | - |
| wire / design ratchets | `scripts/wire_ratchet.py`, `scripts/design_ratchet.py` | 0 / 0 | no count above the baseline |
| backend lint | `scripts/gate/lint_backend.py --strict`; ruff on the changed files | 0 / 0 | 0 findings |
| API inventory | `scripts/api_inventory.py` | 0 | `contracts/` unchanged |
| build | `npm run build` (tsc + vite) | 0 | 0 TS errors |
| typecheck tests + scripts | `npm run typecheck` | 0 | (first run 2 at b23f38ca3: one TS2352 in the new mock file, fixed in 2c5f22c84) |
| lint | `npx eslint src --pass-on-unpruned-suppressions` | 0 | - |
| unused exports | `node scripts/unused-exports.mjs --enforce` | 0 at 1c66ec80b (PC) | 1 at 6fd16f46a: the base's `DoorTone` / `AlarmLook` (src/home/*), fixed by the base row in 3e73e2d00 and merged |
| unit (targeted) | unit-area-honest-count-2540, unit-area-row, unit-home-site-2330 | 0 | 30 passed |
| Node unit suite | `playwright -c playwright.unit.config.ts` (all) | 1 | 5352 passed, 13 skipped, 3 failed: `unit-mfa-passkeys-2490` (3 cases) - the same 3 fail on the base when that file runs alone, not this row |
| new pixel baselines | `pixel-area-honest-count-2540.spec.ts` desktop + mobile `--update-snapshots`, then compare (twice: b23f38ca3 and 6fd16f46a) | 0 | 4 written; 4 passed against the committed baselines |
| building-screen / home regression | evidence-area-row, evidence-home-screen, evidence-home-295, evidence-devices-tiles, evidence-home-quickcard-295, pixel-honest-states-2540; desktop + mobile | 0 | 47 passed, 129 skipped (their own project / live skips), twice |
| backend, targeted | every test file that reads the devices tree / counts / alarm summary + all `test_wire*.py` (45 files, 3 processes) | 0 / 0 / 0 | 184 + 198 + 712 = 1094 passed |
| compare captures | `area-honest-count-2540-shots.spec.ts` SW_SHOTS, base build with the base server's counts (before) and the branch (after) | 0 / 0 | 20 pictures: `private/planning/area_honest_count_2540_compare_2026-11-26.html` |

NOT_RUN: the FULL backend suite - started twice (10 shards), stopped by me in shard 1 at 4 % after 64 min (a release gate of
2530-train was running, runner load 30-46, 1.5 GB free); the targeted 45 files above ran instead. The full release gate; the lab
(forbidden for this row). The compare "after" pictures were taken at b23f38ca3, before the locks-tile fix - for this house the tile
says "יש מנעול פתוח" both before and after (the office lock is really open).

## Open questions

1. A setting to hide the grey "לא ידוע" lock indicator? (a) no - an offline lock shown as open, or hidden, is a wrong answer, not a
   preference (recommended); (b) a setting.
2. The area screen's own lock rows (devices-area cards) already show the entity's state ("לא זמין"); give them the same grey tone?
   (a) leave as is - they already say the state in words (recommended); (b) a small follow-up row.
