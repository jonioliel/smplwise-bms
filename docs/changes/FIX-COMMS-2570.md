# FIX-COMMS-2570 - comms / utilities findings left open by the 2.56 deep review

Base: v2.56.0 (release/2570-train). Review: docs/review/DEEP-REVIEW-2560-COMMS-UTILITIES.md.

- CU-01 generator mute delays event alerts too. An event (test failed, mains restored, ...) raised while its type is muted is stored
  with a `_muted` snapshot marker and no notification; once the mute is over `_tell_event_late` tells it once and removes the marker.
  The marker is never returned by the alert detail API. SCR-22 (one-click "mute 24 h") is unchanged.
- CU-02 `_tell_late` / `_tell_event_late` skip an alert that already has `acked_at`.
- CU-03 `set_battery_nominal(None)` (the administrator chooses "automatic") clears the learned 24 V latch and fences the stored
  history (`history_from`); changing the `battery_v` mapping (PUT /generator/devices/{id}/roles) does the same. The history read for
  the latch only counts samples from `history_from` on.
- CU-04 the far conflict expansion (`spans_past_window`, `_series_beyond_cache`) uses `FAR_MAX_OCCURRENCES` (50,000) instead of 2,000; if
  even that is exceeded the booking is refused with 422 `series_check_failed` (never "no conflict"). Other callers of `occ.blockers`
  (decisions, sync engine, free slots) keep the old tolerant behaviour (`strict=False`), only with the larger cap.

Tests: tests/test_comms_utilities_fix_2570.py, tests/test_calendar_far_series_fail_closed_2570.py (results in the report / below).
