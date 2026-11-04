# WISKEY-SCHED-WRITE-2390 — device schedule library writes from Arx (plan T7)

Branch `pilot/WISKEY-SCHED-WRITE-2390` from `origin/main` (`efc12d0e3`, v2.38.0). Target 2.39.0 / 2.40.0. Not merged, no tag, no
version bump. No lab, device, station, Home Assistant or WisKey contact: everything below ran against fakes and mocks.

Source of the task: `private/planning/WISKEY_FULL_INTEGRATION_PLAN_2026-11-03.md` rows 48-49 and task T7; owner decision 03.11 Q4 "a"
(full editing of device schedules in Arx).

## Scope

The device schedule LIBRARY of WisKey and its deployment: library create / edit / delete / import / export, the station reads that
must come before an apply (readiness, dependencies, assess), comparison baselines, deployment proposals ("plans"), responsibility
claims and deployment jobs. NOT here: the per-door technical hold-open schedules, public codes and door programs
(`stations/technical_*`, task T6, branch `pilot/WISKEY-DOOR-TECH-2390`); the read-only library / plans / operations lists stay where
they were (`routers/access_control_reads.py`, the `read` channel).

## WisKey contract (verified in source)

WisKey `C:\hik intercom`, ref `origin/codex/wiskey-mac-m12-policy-b-2026-11-02` @ `2834aa5e8830f55e270dc5c99b8313f3c05fe3de`
(rc.10), extracted read-only with `git archive`: `websocket.py` (COMMANDS and the `schedules/*` dispatcher), `schedule_plan_api.py`,
`schedule_operations_api.py`, `access/schedules.py`, `access/schedule_plans.py`, `access/schedule_operations.py`,
`access/schedule_work_queue.py`, `access/schedule_baselines.py`, `access/schedule_assessment.py`, `access/schedule_compiler.py`,
`client/schedule_readiness.py`, `client/schedule_inventory.py`, `client/schedule_dependencies.py`, `client/schedule_plan_inspection.py`,
`panel_permissions.py`. Request keys and permissions were also compared with the static rc.10 extract
(`pilot/WISKEY-RC10-PIN-2382:docs/integrations/wiskey/catalog/rc10-extract/commands.static.json`) and the pinned
`rc37-contract.4`: identical for all 28 `schedules/*` commands of both.

| Arx action | WisKey command | WisKey grant | READ class | Arx kind |
|---|---|---|---|---|
| `check` | `schedules/preview` `{data, date, time}` | management: manage | no | read (validation preview) |
| `create` | `schedules/create` `{data}` | manage | no | write |
| `update` | `schedules/update` `{schedule_id, revision, data}` | manage | no | write (CAS) |
| `delete` | `schedules/delete` `{schedule_id, revision}` | manage | no | write (CAS) |
| `export` | `schedules/export` `{}` | view | yes | read |
| `import_preview` | `schedules/import_preview` `{document}` | manage | no | read (token) |
| `import_apply` | `schedules/import_apply` `{token}` | manage | no | write |
| `readiness` | `schedules/readiness` `{station_id}` | view | no | device read (<= 70 s) |
| `dependencies` | `schedules/dependencies` `{station_id}` | view | no | device read (<= 130 s) |
| `assess` | `schedules/assess` `{station_id, data}` | view | no | device read (<= 70 s, baseline token) |
| `baseline_save` | `schedules/baseline_save` `{station_id, token}` | manage | no | write |
| `baseline_clear` | `schedules/baseline_clear` `{station_id, revision}` | manage | no | write (CAS) |
| `plan_preview` | `schedules/plan_preview` `{station_id, schedule_id, revision, bindings}` | manage | no | device read (<= 130 s, token) |
| `plan_save` | `schedules/plan_save` `{token}` | manage | no | write |
| `plan_recheck` | `schedules/plan_recheck` `{plan_id, revision}` | manage | no | device read + write |
| `plan_delete` | `schedules/plan_delete` `{plan_id, revision}` | manage | no | write |
| `plan_detail` | `schedules/plan_export` `{plan_id, revision}` | view | yes | read |
| `claim_preview` | `schedules/operations_claim_preview` `{plan_id, revision}` | manage | no | device read (token) |
| `claim_confirm` | `schedules/operations_claim_confirm` `{token}` | manage | no | write |
| `claim_release` | `schedules/operations_claim_release` `{claim_id, revision}` | manage | no | write |
| `deploy` (1/2) | `schedules/operations_create` `{plan_id, revision}` | manage | no | write |
| `deploy` (2/2), `job_check` | `schedules/operations_check` `{job_id, revision}` | manage | no | write (queues the preflight) |
| `job_cancel` | `schedules/operations_cancel` `{job_id, revision}` | manage | no | write |
| `job_archive` | `schedules/operations_archive` `{job_id, revision}` | manage | no | write |

24 commands on the new channel. Not used: `schedules/operations_export` (the same answer as `operations_list`),
`schedules/normalize_user` (the readback channel, ACR5-02). `list` / `plan_list` / `operations_list` stay on `read`.

Error codes used (all present in the rc.10 `errors.static.json`): `revision_conflict`, `schedule_not_found`, `schedule_limit`,
`schedule_invalid_time`, `schedule_overlap`, `schedule_period_limit`, `schedule_invalid_week`, `schedule_invalid_date`,
`schedule_holiday_limit`, `schedule_holiday_overlap`, `invalid_text`, `invalid_fields`, `schedule_transfer_invalid`,
`schedule_import_expired`, `schedule_plan_expired`, `schedule_claim_expired`, `schedule_baseline_expired`, `schedule_plan_not_found`,
`schedule_plan_limit`, `schedule_plan_resource_reserved`, `schedule_plan_device_changed`, `schedule_source_changed`,
`schedule_binding_invalid`, `schedule_binding_out_of_range`, `schedule_compilation_unknown`, `schedule_compilation_limit`,
`schedule_claim_conflict`, `schedule_claim_in_use`, `schedule_claim_not_found`, `schedule_operation_exists`,
`schedule_operation_limit`, `schedule_operation_not_found`, `schedule_operation_retained`, `schedule_operation_failed`,
`schedule_operations_unavailable`, `schedule_plan_storage_unavailable`, `schedule_baseline_unavailable`, `schedule_baseline_limit`,
`schedule_read_busy`, `schedule_writes_unverified`, the plan blockers (`schedule_ownership_unknown`, `schedule_inventory_incomplete`,
`schedule_plan_*`), `station_offline`, `station_unloaded`, `connection_failed`, `authentication_failed`, `unauthorized`.

## What was built

Backend (`smplwise_vms/backend/smplwise/`):

- `services/wiskey_schedule_writes.py` (new): the operations table (command, kind, READ class, audit action), the frames
  (`api_contract` only on non-READ commands), the answer classification (refused / unknown), closed projections of every answer,
  WisKey's `normalize` mirrored (Arx refuses a draft WisKey would refuse, with WisKey's own code and the field path, before sending),
  the server-side preview store (PREVIEWS), Arx's own limits and the reasons in Hebrew.
- `routers/access_control_schedule_writes.py` (new): `POST /access-control/schedules/actions/{action}` (closed set), `GET
  /access-control/schedules/jobs?ids=` (deploy progress, fresh `operations_list`), `GET /access-control/schedules/claims` (with
  revisions), `GET /access-control/schedules/export`, `GET /access-control/schedules/plans/{plan_id}?revision=`.
- Shared edits (minimal): `services/wiskey_channels.py` - the closed `schedules` channel (+ ADAPTER_CHANNELS, HA_FRAMES, describe);
  `main.py` - one router line; `tests/test_wiskey_channels.py` / `tests/test_pwclean_295.py` - the new channel in two expectations
  (the same two lines the station-maintenance branch changes for its `maintenance` channel: a trivial merge conflict, keep both).

Rules applied on every write:

1. Permission: the schedules administrator - `access.schedules.manage` UNRESTRICTED (installation, no deny at a covering scope) or
   `system.configure` at the installation; checked before the body is read; a refusal is an audited 403 (`access.schedules.manage`,
   reason `schedules_admin_required`). A station-scoped holder of the permission is refused (WisKey's library is installation-wide).
2. Preview before apply: `create` / `update` need the `check_id` of a successful `check` (WisKey's `schedules/preview`) of exactly
   the same draft by the same user; `import_apply`, `plan_save`, `claim_confirm`, `baseline_save` need their preview's `preview_id`.
   One use, the same Arx user, 280 s. WisKey's tokens stay on the server (WisKey binds them to its actor, and every Arx operator is
   the same WisKey actor). Deploy: the plan was previewed and saved first (its report), and WisKey's own preflight runs per job.
3. Confirmation: `confirmed: true` + the command envelope (`client_request_id`, `expires_at` <= 60 s, duplicate refused).
4. Audit: an attempt row committed before the send, an outcome row after (`intercom.schedule_<action>`, `intercom.schedule_deploy`
   per plan and for the batch), refusals before sending as `phase: refused / outcome: not_sent`. Rows carry ids, revisions, statuses,
   counts and WisKey's code; never a token, a window or a name.
5. Rate limits: 30 writes per operator per minute; one device read at a time; 10 s per station between device reads; plus
   intercom_sync's read slots / buckets (the `schedules` lane maps to them).
6. Honest result: 200 = WisKey's success; else `details.outcome` `refused` ("WisKey סירב - <reason> (<code>). לא נשמר דבר."),
   `not_sent` (and why) or `unknown` (sent, no clear answer; "may have been stored - refresh and check"). Never retried.

Deploy and progress: `deploy {plans: [...]}` runs per plan `operations_create` then `operations_check` and answers per plan (queued
with the job, refused with WisKey's code, not sent, unknown); the screen follows the job ids with `GET .../jobs?ids=` every 2 s until
every job is final (max 3 min) - WisKey offers no push for jobs. In rc.10 every job ends `blocked` (`schedule_writes_unverified`):
nothing is written to a station, and Arx says so.

Impact shown before an apply: the station (name, online) and its doors (relays) from Arx's served copy, and WisKey's anonymous device
user counts (`read`, `explicit` = own schedule references, `implicit` = device default, `malformed`) - served to the schedules
administrator only; resource conflicts (device state differs, externally referenced, active) and the blockers.

Frontend (`frontend/src/`):

- `screens/wiskey-schedules.ts` (shared, small): a header button "ניהול ספריית לוחות הזמנים" for the schedules administrator and the
  management view at `#/wiskey/schedules?manage=1` (the door view unchanged otherwise).
- `components/wk-schedule-library.ts` (new): library rows (edit / deploy / delete), import / export, the editor drawer (with the
  WisKey check, the station assessment and baseline save / clear), the deploy drawer (stations, slots per station with the advertised
  ranges, per-station preview with impact, confirmation, progress), proposals (recheck / claim / release / delete) and jobs (check /
  cancel / archive) - every write behind a confirmation dialog, every result line honest.
- `components/wk-schedule-draft-form.ts` (new): name, week grid (hour painting, desktop) + exact per-day windows (time fields; the
  phone's way), copy Sunday to the workdays, special dates (holidays) with their windows, faults at their field.
- `access-control/schedule-editor-logic.ts`, `api/schedule-writes.ts`, `i18n/schedule-editor.ts` (new).
- Design: the existing tokens and components (`sw-card`, `sw-drawer` modal = side panel / phone bottom sheet, `sw-dialog`,
  `wk-action-button`), 44 px targets in touch layouts, 16 px inputs (no zoom on phones), press feedback via `--sw-press-scale`, hover
  only under a fine pointer, the progress spinner off under reduced motion (emil-design-eng rules).

No migration (nothing stored in Arx's database except audit rows).

## Tests

- `smplwise_vms/backend/tests/test_wiskey_schedule_writes.py` (new, 24 tests): a fake WisKey keeping rc.10's library, imports,
  plans, claims, baselines and jobs statefully; per command family: frames, gate, preview -> apply, refusals ("WisKey סירב"),
  not-sent refusals, unknown outcome, import, station reads + impact, baselines, plans, claims, deploy with a partial failure
  (one blocked by WisKey, one failing at the station, one stale), jobs, rate limit, audit rows without tokens or windows.
- `frontend/tests/unit-schedule-editor-logic.spec.ts` (new), `frontend/tests/evidence-wiskey-schedule-writes.spec.ts` (new, desktop
  + mobile), `frontend/tests/pixel-wiskey-schedule-writes.spec.ts` (new, "pixel-stable" titles, desktop 1440 + phone 390), mocks
  `frontend/tests/schedule-writes-mocks.ts`. Evidence images: `docs/design/evidence/wiskey-schedule-writes/`.

Receipts: see the section at the end.

## WisKey gaps (for the WisKey team)

1. **Deploy never writes in rc.10.** `ReadOnlySnapshot.write` raises `schedule_writes_unverified`; `operations_list.writes_enabled`
   is false; every plan report / assessment carries `schedule_writes_unverified` + `schedule_ownership_unknown`; jobs end `blocked`.
   Arx's deploy is therefore "create the job + WisKey's preflight"; it will start writing only when WisKey enables its writer.
2. **One pending preview per WisKey actor.** WisKey keeps one import / plan / claim / baseline preview per actor; every Arx operator
   is the same actor (the add-on's identity), so a second operator's preview replaces the first one's -> `schedule_*_expired` on
   apply (Arx says "WisKey סירב: the check expired or was replaced"). Ask: key previews by token only, or accept an opaque
   caller sub-id.
3. **Device reads outlast Arx's call limit.** `dependencies`, `plan_preview`, `plan_recheck`, `claim_preview` may take up to 130 s
   (`readiness` / `assess` 70 s) inside WisKey; Arx's HA WebSocket client stops waiting at 60 s (Arx waits 58 s). A slow station
   reads as "still reading / unknown - try again"; `plan_recheck` may then have stored a new report without Arx seeing it. Ask: an
   async job id for the reads, like the operations queue.
4. **No push for jobs.** Progress is polled (`operations_list`, every 2 s while a deploy dialog is open). Ask: a `refresh` kind or a
   job event.
5. **Service-identity permission unconfirmed** (WisKey prompt section 8): every write needs WisKey `management: manage` for the
   add-on's HA user. If WisKey refuses, Arx shows "WisKey סירב: לחשבון השירות של Arx אין הרשאת ניהול לוחות זמנים" (`unauthorized`).
6. **Slot allocation is the operator's.** WisKey never allocates device slots ("never allocate from absence"); the deploy dialog
   proposes the previous proposal's slots or the top of the advertised range, and WisKey's preview reports conflicts.
7. **People impact is anonymous counts only.** WisKey's dependency read never exports users; Arx cannot say WHICH people a
   schedule affects, only how many device users carry their own references or the default.
8. **Holiday group membership** is unknown to WisKey (`schedule_plan_holiday_membership_unknown`, always a blocker with holidays).

## NOT_RUN

- Any lab / device / WisKey contact (forbidden for this task): the 24 commands have never been sent to a real WisKey.
- The full backend suite: started on the runner @ `e5217b126`, then STOPPED by me on the coordinator's disk instruction (runner at 90 %);
  its pytest temp (15.7 GB) deleted. Only the targeted backend set below ran. The full preview suite was not run either.
- The tablet project of the new specs (desktop and phone, as asked).
- The station-maintenance branch's `maintenance` channel together with this `schedules` channel (two different branches; the merge of
  `wiskey_channels.py` / `test_wiskey_channels.py` / `test_pwclean_295.py` must keep both).

## Receipts

All on the runner (`private/runner/run_smart.py ... --machine runner`), gate idle before each job; nothing on a device.

| What | Command | Commit | Result |
|---|---|---|---|
| Backend, local (Windows venv) | `pytest tests/test_wiskey_schedule_writes.py` | working tree | 24 passed |
| Backend, local | `pytest tests/test_wiskey_channels.py tests/test_pwclean_295.py tests/test_wiskey_contract.py tests/test_eccact_readback_295.py tests/test_wkdirect_295.py` | working tree | exit 0 |
| Backend, local | `pytest tests/test_capabilities.py tests/test_plan_routes_unique.py tests/test_secfix2_pub07_guard_first.py tests/test_wiskey_channels.py tests/test_pwclean_295.py tests/test_intercom_adapter.py tests/test_db_gate.py` | working tree | exit 0 |
| Backend, runner | `backend <b> tests/test_wiskey_schedule_writes.py tests/test_wiskey_channels.py tests/test_pwclean_295.py tests/test_intercom_adapter.py tests/test_wiskey_contract.py tests/test_access_control_wire.py` | `9bd85c9de` | 180 passed, 2 skipped |
| tsc, runner | `tsc <b>` | `e5217b126` | ok (EXIT=0) |
| Specs, runner | `preview <b> tests/unit-schedule-editor-logic.spec.ts tests/evidence-wiskey-schedule-writes.spec.ts tests/pixel-wiskey-schedule-writes.spec.ts tests/pixel-access-schedules.spec.ts --project=desktop --project=mobile --workers=1 --repeat-each=2` | `df85fd8f2` | 86 passed, 14 skipped, 0 failed |
| Specs, runner (final) | `preview <b> tests/unit-schedule-editor-logic.spec.ts tests/evidence-wiskey-schedule-writes.spec.ts tests/pixel-wiskey-schedule-writes.spec.ts tests/pixel-access-schedules.spec.ts tests/evidence-access-schedules.spec.ts tests/layout-access-schedules.spec.ts --project=desktop --project=mobile --workers=1` | `e5217b126` | 77 passed, 43 skipped, 0 failed |
| Baselines | `preview <b> tests/pixel-wiskey-schedule-writes.spec.ts tests/pixel-access-schedules.spec.ts --project=desktop --project=mobile --update-snapshots` (+ the phone door view regenerated in the steady state) | `5080807ed`, `402cae32d`, `899184312` | 8 new (editor) + 16 refreshed (schedules screen: the admin header carries the new button) |

Skips: the unit spec runs on the desktop project only; the tablet project is skipped by design. Pixel notes: the editor's baselines
mask the shell's top tab strip (its scroll position after load varied on the phone for the first test of a worker - 588 px, the
strip only); the existing `pixel-access-schedules` phone baselines show the same shell variance (`schedules-classic-empty-390`
flip-flopped once while regenerating) - pre-existing, not from this change.

Evidence images (runner, `e5217b126`): `docs/design/evidence/wiskey-schedule-writes/` - manage view, editor checked / confirm /
fault / refused, import preview, deploy impact / progress, claim confirm; desktop and mobile (18 files).
