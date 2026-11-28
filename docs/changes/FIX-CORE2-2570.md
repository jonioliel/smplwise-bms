# FIX-CORE2-2570 - second deep review (core / data / release), non-gate non-automation findings

Source: `docs/review/DEEP-REVIEW-2570-CORE-DATA-RELEASE.md` (branch `origin/review/DEEP2-2570-CORE-DATA-RELEASE`).
Base: `origin/release/2570-train` = v2.56.0 (`6ea807b2e`). Branch `pilot/FIX-CORE2-2570`.
Every finding was re-located at the base and still existed there.

## What changed

| Finding | Change | Files |
|---|---|---|
| CD2-06 (medium) | E-mail rows left `queued` by a restart (or a crashing hand-over) were never sent and never failed. A handed-over row is now in the live set of this process until its outcome is recorded; the orphan sweep covers `queued` and `retry`. A `queued` orphan is failed as `interrupted` (it may have been mid-SMTP: never re-sent), a `retry` orphan as `unavailable` (unchanged). A hand-over that raises gives its unsettled rows back to the sweep; a replaced worker's queued hand-overs and heap jobs leave the live set. | `services/notify_email.py`, comment in `services/notify_channels.py` |
| CD2-12 (low) | The sweep's write is conditional (`WHERE id = ? AND status = <the status it read>`), so a row settled meanwhile is never overwritten and gets no `delivery_failed` event. | `services/notify_email.py` |
| CD2-13 (low) | A retry / digest job that raises leaves the live set (`_job_failed`); the sweep then fails its rows instead of leaving them `retry` for good. The digest records which rows it took. | `services/notify_email.py` |
| CD2-14 (low) | The rate window counts mails: a notification takes one slot per address (`GATE.allow(n)` / `force(n)`), the digest one per address. A notification to more addresses than the whole window passes only on an empty window (never held for ever). | `services/notify_email.py` |
| CD2-17 (low) | `smtp_send` resolves the host and refuses (`invalid`, no connection) when any address is loopback, link-local, unspecified or multicast - a NAME pointing at this machine no longer passes. The SMTP test has one overall deadline (`TEST_DEADLINE_S` = 30 s). The LAN port-probe aspect for an administrator with `notify.manage` remains by design (a LAN mail server must stay allowed). | `services/notify_email.py` |
| CD2-15 (low) | Planned monthly-report rows are settled `skipped` when the delivery is off (`delivery_off`), their channel is off (`channel_off`) or a WhatsApp user is no longer chosen (`not_chosen`) - not kept, so a later enable never sends an old month. | `services/insights_delivery.py` |
| CD2-18 (low) | The weekly access digest's start is the previous scheduled LOCAL instant (`period_bounds`), not `end - 7 x 24 h`: a DST week is 167 / 169 hours. | `services/access_external.py` |
| CD2-08 (medium) | The Dockerfile default is the multi-arch HA base `ghcr.io/home-assistant/base-python:3.12-alpine3.22` (checked on the runner: its index holds exactly the linux/amd64 and linux/arm64 images of `amd64-` / `aarch64-base-python:3.12-alpine3.22`, same digests). Supervisors from 2026.04 pass no `BUILD_FROM` (HA contributor docs, "Build the container image"), so an aarch64 host no longer gets the amd64 image. `build.yaml` keeps the per-arch names for older Supervisors. `release_check.py` now requires the multi-arch default with build.yaml's tag (it used to require build.yaml's amd64 image - the bug itself). | `smplwise_vms/Dockerfile`, `scripts/release_check.py` |
| CD2-20 (low) | Comment-only `-- Rollback:` note on 0215 (the statement is unchanged), and the old header sentence that claimed the older admin page "simply drops" unknown names is corrected: 2.43.0 refuses them with a 422 when that person's list is edited. | `migrations/0215_home_v3_categories.sql` |
| CD2-21 (low) | `migrate_legacy.py --apply-aliases`: each camera is judged on its own (HTTP / network error = a `failed` row with the status or error class, never a body; Ctrl+C = the rest `not_attempted`), the report (JSON / Markdown, new "Alias writes" section with the alias before) is always written, exit 1 (130 on interrupt) when incomplete. The legacy "auto" offset is derived from `--zone` (default `Asia/Jerusalem`) on `--date` (default today) with the IANA rules; the device quirk (KNOWN_QUIRKS T1: the NVR reports the standard offset) is a separate function; `--nvr-utc-offset-minutes` stays as an explicit override. | `scripts/migrate_legacy.py` |

Paths under `services/` and `migrations/` are relative to `smplwise_vms/backend/smplwise/`.

Not in this row (owned elsewhere): CD2-01, CD2-03, CD2-09, CD2-10 (gate / test tooling - FIX-GATE-2570); CD2-02, CD2-04, CD2-05, CD2-07,
CD2-11, CD2-16, CD2-19 (automation / schedules - FIX-AUTOMATION-2570); CD2-22 (`ha_sync` - FIX-CORE-DATA-2570).

## Tests

All on the runner (`~/work/p2570_fixcore2`, slot B, one pytest process per group, `-o addopts= -q -p no:cacheprovider`).

New tests BEFORE the fix (base sources at `6ea807b2e`, new tests) and AFTER (branch):

| Test | Before | After |
|---|---|---|
| `test_notify_email.py::test_queued_rows_left_by_a_restart_are_failed_as_interrupted_and_never_sent` (CD2-06) | FAILED | passed |
| `test_notify_email.py::test_a_live_queued_hand_over_is_never_taken_for_an_orphan` (CD2-06 guard) | passed (guard: the old code also left it alone) | passed |
| `test_notify_email.py::test_the_orphan_sweep_never_overwrites_a_row_that_was_settled_meanwhile` (CD2-12) | FAILED | passed |
| `test_notify_email.py::test_a_retry_job_that_raises_gives_its_rows_to_the_orphan_sweep` (CD2-13) | FAILED | passed |
| `test_notify_email.py::test_the_rate_limit_counts_mails_not_notifications` (CD2-14) | FAILED | passed |
| `test_notify_email.py::test_a_notification_to_more_addresses_than_the_window_passes_on_an_empty_window` (CD2-14) | FAILED | passed |
| `test_notify_email.py::test_a_name_that_resolves_to_this_machine_is_refused_at_send_time` (CD2-17) | FAILED | passed |
| `test_notify_email.py::test_the_test_button_has_one_overall_deadline` (CD2-17) | FAILED | passed |
| `test_insight215_slice3.py::test_a_delivery_switched_off_or_a_channel_dropped_after_the_plan_sends_nothing_and_never_later` (CD2-15) | FAILED | passed |
| `test_access_digest_dst_2570.py` (2 tests, CD2-18) | 2 FAILED | 2 passed |
| `test_migrate_legacy.py::test_a_failing_alias_write_is_a_failed_row_the_others_are_still_written_and_the_report_is_written` (CD2-21) | FAILED | passed |
| `test_migrate_legacy.py::test_an_interrupt_stops_the_writes_and_still_reports_what_was_written` (CD2-21) | interrupted (the KeyboardInterrupt escaped `apply_aliases` and stopped pytest) | passed |
| `test_migrate_legacy.py::test_the_legacy_auto_offset_comes_from_the_zone_and_the_date_not_a_fixed_120` (CD2-21) | FAILED | passed |
| `test_supervisor_build_check.py::test_dockerfile_default_must_be_the_multi_arch_base_of_the_build_yaml_tag` (CD2-08) | FAILED | passed |
| `test_supervisor_build_check.py::test_the_shipped_dockerfile_default_is_the_multi_arch_base` (CD2-08) | FAILED | passed |
| `test_migration_downgrade_check.py::test_a_rollback_to_2_43_0_is_judged_0215_carries_its_rollback_note` (CD2-20) | FAILED | passed |

After, whole files (branch):
- `test_notify_email`, `test_notify_recipient_lang_2520`, `test_notify_whatsapp`, `test_delayed_worker_2440`: 191 passed, 1 failed on the first run
  (`test_connect_dns_and_timeout_classes`: its `monkeypatch.undo()` also reverted the fixture's `ALLOW_LOOPBACK_HOST`, and `smtp_send` now
  re-checks the target - the test re-arms the switch after `undo()`); re-run `test_notify_email` + `test_supervisor_build_check`: 75 passed.
- `test_insight215_slice3`, `test_access_digest_dst_2570`, `test_elevator_alert_recipients_295`: 47 passed.
- `test_migrate_legacy`, `test_legacy_import_2550`, `test_legacy_parity_t070`, `test_supervisor_build_check`, `test_gate_addon_build`,
  `test_release_check`, `test_release_check_green_2560`: 84 passed.
- `test_migration_downgrade_check`, `test_migrations`, `test_home_v3_followup_a`, `test_singletons_registered`: 45 passed.

Other checks:
- `docker buildx build --check --platform linux/arm64 smplwise_vms` and `--platform linux/amd64` with NO build args (what a Supervisor
  that passes no `BUILD_FROM` does): "Check complete, no warnings found" for both; the default resolves to
  `base-python:3.12-alpine3.22@sha256:c21c674f...` on linux/arm64 (= `aarch64-base-python:3.12-alpine3.22`) and `@sha256:d3253dc4...` on
  linux/amd64 (= `amd64-base-python:3.12-alpine3.22`, the image every amd64 build used so far).
- `scripts/migration_downgrade_check.py --chain v2.43.0,v2.43.9,v2.56.0,HEAD`: v2.43.0 -> HEAD PASS (0215 with its note), v2.43.9 -> v2.56.0
  PASS, v2.56.0 -> HEAD PASS; the historical step v2.43.0 -> v2.43.9 still FAILS because it compares two old tags whose 0215 text has no
  note (cannot change; the range to this tree is what a rollback meets).
- ruff (backend config) on the changed backend files: only the 2 findings already present at the base in `test_notify_email.py`.

NOT_RUN: an actual aarch64 image build (the runner has no qemu-aarch64 binfmt; a `RUN` step cannot execute for arm64 there), a
Supervisor install on aarch64, Playwright (no UI change), any lab / HA / NVR / go2rtc contact, a real `--apply-aliases` against a VMS.
