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

RESULTS_PLACEHOLDER
