# FIX-HOME-MAPS-2570

Fixes the open findings MH-02, MH-03, MH-04 of docs/review/DEEP-REVIEW-2560-MAPS-HOME.md.

- MH-02: `home/home-target.ts` (new, pure) keeps, per A/C, the newest target and the turn-on in flight. A setpoint that waited for the
  mode command is sent only by the newest tap, with the newest value; a failed turn-on sends no setpoint. `home-actions.ts setTarget` uses it.
- MH-03: `home-logic.ts` `DoorPhase` (`jammed` / `locking` / `unlocking`, set from `home-api.ts`): never `doorOpen`; jammed reads
  "תקועה" with the warn tone, transitions read "ננעלת…" / "נפתחת…". Server `services/devices.py count_into`: these states join
  `locks_unknown` instead of "not locked" (additive, no new wire field; a dedicated `locks_jammed` count would need `wire/devices.py`).
- MH-04: the map keeps one batch at a time (one action line); a tap while another runs now sends nothing AND says so on the room card
  (`sw-room-card` `bulkBusy`, `map-room-bulk.ts bulkBusyKind`). No queue, no retry.
- Texts: Hebrew + English (these modules have no ar / ru files).

Tests: see the report; status NOT_RUN on the PC (runner only).

## Tests (runner, slot B)

- Python `test_area_honest_count_2540.py` + `test_area_row.py`: before the change the 3 new jammed / locking / unlocking cases failed; after: pass.
- `unit-fix-home-maps-2570`, `unit-medium-rest-2540`, `unit-lows-frontend-2550-screens`, `unit-home-simple-logic`: 49 passed; `tsc --noEmit` clean.
- Not run: the full Playwright suites and pixel baselines (no baseline covers these states).

## Compare page

`private/planning/fix_home_maps_2570_compare_2026-11-28.html` (Hebrew): runner screenshots before (v2.56.0) / after, desktop + phone, light + dark,
of the home doors screen (jammed, locking, unlocking) and the floor-map room card's new "another room's turn-off is still running" line.
Made by `frontend/tests/evidence-fix-home-maps-2570.spec.ts` (runs only with `SHOTS_DIR` set).
