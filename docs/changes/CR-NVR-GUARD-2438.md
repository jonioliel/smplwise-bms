# CR-NVR-GUARD-2438 - one guard for the recorder's "allow settings changes" switch

Branch `pilot/CR-NVR-GUARD-2438` (from `origin/main` @ 0a8fb55e1, v2.43.5). No version bump, no merge, no tag.
Code and tests only: no NVR, camera or go2rtc was contacted (fake NVR via `httpx.MockTransport` only).

## Why

Code review 2026-11-13, report 03 finding F06 (MASTER_PLAN entry `CR-NVR-GUARD`): the per-recorder switch
`nvr.writes_enabled:<id>` ("אפשר שינויי הגדרות ב־NVR") gated stream encoding, camera reboot and NVR reboot only. About twelve
settings-write routes reached the recorder with the switch off.

Owner decision O2 / Q-SEC-3 (14.11), option **b**: the switch covers EVERY settings change (notifications, motion, time, NTP, OSD,
schedules, smart rules, undo, any other configuration write) and NOT the operational actions (manual record start / stop, output
pulse, disk test).

## What

- New `services/nvr_write_guard.py`: one table `KINDS` (the kind recorded in `nvr_changes.kind` -> `settings` / `operational`) and
  one `guard(settings, conn, principal, kind)`. Switch off + settings kind -> **409 `nvr_writes_off`**, Hebrew message "שינויי
  הגדרות ב־NVR כבויים עבור המקליט הזה. אפשר להפעיל אותם בהגדרות החיבור של ה־NVR.", details `{recorder_id, kind}`, one audit row
  `nvr.write` / `denied` / reason `nvr_writes_off`, nothing sent (not even a read), no `nvr_changes` row. An unknown kind is a
  settings change (fail closed).
- The guard is called at the choke points - `nvr_write.apply_change` (every settings write), `nvr_write.rollback` (with the
  switch of the recorder the change was made on, before the privacy-mask hand-off), `nvr_privacy.write_camera` - and up front in
  every settings route after its permission checks, so a refused request makes no device probe either:
  `PUT /nvr/notify`, `PUT /cameras/{id}/motion`, `PUT /nvr/time`, `PUT /nvr/ntp`, `PUT /cameras/{id}/osd`,
  `POST /cameras/{id}/osd/name`, `PUT /cameras/{id}/schedules/{kind}`, `PUT /cameras/{id}/record-schedule`,
  `PUT /cameras/{id}/smart`, `POST /nvr/changes/{id}/rollback`, `POST /nvr/privacy-masks/apply` (per camera: `skipped`,
  reason `nvr_writes_off`; added to the privacy `SKIP_CODES`) and `/preview` (the same row, nothing read).
- Not changed: `POST /cameras/{id}/record/start|stop`, `POST /nvr/outputs/{id}/pulse`, `POST /nvr/storage/{id}/smart-test`
  (operational). Stream encoding and the two reboots keep the checks they already had (listed in the table as `settings`).
- Vendor: the guarded writes are Hikvision ISAPI documents, so the guard decides for a Hikvision recorder (no vendor = Hikvision).
  Provision-ISR keeps its existing first refusal `vendor_unsupported` on these routes (security review 2026-10-04,
  `test_provision_vendor_guard.py`); its encoding writes stay gated by its adapter, which reads the same switch.
- Read routes tell the screens (the `can*` flags now include the switch, plus `writes_enabled` so a screen can say why):
  `GET /nvr/notify` (`can_write`, `writes_enabled`), `GET /nvr/system` (`can.time`, `can.osd` like `can.reboot` already;
  `can.storage` / `can.alarm` unchanged), `GET /cameras/{id}/osd`, `GET /cameras/{id}/schedules` (`can.events`, `can.schedule`),
  `GET /cameras/{id}/smart`, `GET /cameras/{id}/zones` (`can_edit_motion`), `GET /cameras/{id}/privacy-mask`
  (`nvr_writes_enabled`, next to the feature switch `write_enabled`), `GET /nvr/changes` (per row `writes_enabled` of the row's
  recorder: the undo needs it).
- UI (no file of `AUDIT30-COMBINED-2435`'s Appendix A list touched):
  - Settings > system, NVR system card: with the switch off the clock / NTP section and the reboot section show a lock hint
    "שינויי הגדרות ב־NVR כבויים ... אפשר להפעיל אותם בהגדרות החיבור של ה־NVR." (`data-nvr-writes-off="time" | "reboot"`) instead of
    the misleading permission hint; disk test and output pulse keep their buttons.
  - NVR notifications card: the same hint (`data-nvr-writes-off="notify"`) instead of the enable buttons; in the recent changes list
    an applied change whose recorder has the switch off shows "החזר כבוי" (`data-nvr-rollback-off`) instead of the undo button.
  - Privacy masks screen: a new view-only reason `off_nvr_writes` (he / en / ar / ru) after `off_perm`.
  - Live camera screen (`screens/live-camera.ts`, held by `AUDIT30-COMBINED-2435`): NOT edited. Its OSD, schedule, smart-rule and
    motion editors already follow `can_write` / `can.*` / `can_edit_motion`, which now include the switch, so their write controls
    are hidden while it is off; a press that still gets through receives the 409 with the Hebrew message. A short hint there is a
    follow-up for after AUDIT30 merges.
- `services/nvr_write_switch.py` module text updated (it said the switch covers encoding only).
- API inventory regenerated (`scripts/api_inventory.py`): no route added or removed; the `GET /nvr/changes` line now reads "fields is an object" (a stray form-feed character in that docstring had eaten the "f").

## Tests

New `smplwise_vms/backend/tests/test_nvr_write_guard_2438.py` (10 tests): the table equals the owner decision; every `kind="..."`
recorded by an NVR writer is in the table (grep-driven); the guard unit (settings kinds refused and audited, operational kinds
allowed, `apply_change` refuses before its first GET); vendor rule; all ten settings-write requests answer 409 `nvr_writes_off`
with the message, zero device requests, one audit row each, no change row; the same routes work again after the switch is on;
pulse, S.M.A.R.T. test and manual record start / stop work with the switch off; the undo is refused while the change's recorder
is off and works after; privacy preview / apply give `skipped` / `nvr_writes_off` with zero device requests; every read route
reports the switch in its flags.

Run locally (workstation, shared `.venv`, Python 3.12, `-p no:xdist`): see the receipts below.

- `python -m pytest -p no:cacheprovider -p no:xdist -o addopts="" -q tests/test_nvr_write_guard_2438.py tests/test_nvr_write.py
  tests/test_nvr_system.py tests/test_nvr_privacy_mask.py tests/test_camera_reboot_2407.py tests/test_nvr_schedule.py
  tests/test_mask_copy.py tests/test_multi_nvr.py tests/test_nvr_stream_rollback.py tests/test_provision_vendor_guard.py
  tests/test_zones_nvr.py tests/test_zones.py tests/test_nvr_less.py tests/test_nvr_h264_bulk_2341.py tests/test_rbac_camera_scope.py`
  -> **274 passed** in 1761 s (workstation under load). Only comment / docstring edits came after this run.
- `npx tsc --noEmit` (frontend) -> exit 0 (run again after the last i18n edit: exit 0).
- `npx playwright test -c playwright.unit.config.ts unit-privacy-mask --workers=1` -> **10 passed** (every key in all four languages).

NOT_RUN locally: the full backend suite, Playwright / pixel runs (the runner entry check does them). No pixel change is expected on
the default fixtures (the switch is on by default for Hikvision); the new hints render only with the switch off.
