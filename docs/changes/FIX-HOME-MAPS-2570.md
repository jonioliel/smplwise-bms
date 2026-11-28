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
