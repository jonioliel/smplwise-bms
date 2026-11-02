# CAM-H264-VERIFY-2361 - verify a bulk encoding change at the camera, report it per channel, skip a refused camera

Branch `pilot/CAM-H264-VERIFY-2361` (from `origin/release/2342-train`), target release 2.36.1. No version bump, no merge. Code and
tests only: no NVR, go2rtc, Home Assistant or runner device was contacted (fake NVR / fake go2rtc fixtures only).

## Owner decisions (2026-11-02, round 14)

Source: `private/planning/CAMERA_DIRECT_ENCODING_PLAN_2026-11-02.md`, option (a) approved now.

1. After each bulk encoding apply (the H.264 preset and the general bulk encoding apply, and the undo of both), verify per channel:
   (i) the NVR read-back (exists), (ii) the media layer - what codec the camera really sends (go2rtc's producer codec, read-only probes,
   within the existing limits), (iii) whether a reboot / reconnect is needed.
2. A per-channel Hebrew report kept with the job and reopenable: "המקליט קיבל" / "המצלמה אישרה (H.264)" / "עדיין H.265" / "צריך
   אתחול" / "נכשל: סיבה", plus a worklist "מצלמות שלא השתנו" with a read-only re-check.
3. New setting for a refusal on one camera during a batch: "לעצור את כל ההמרה" / "לדלג ולהמשיך". **Default: skip and continue.**
   This changes the CR-020 S2C stop-at-first-failure rule for encoding batches (documented below).
4. No new device write paths. Writes stay exactly the existing approved NVR paths behind the existing switches; nothing here turns a
   write switch on.

Recorded for a later phase - NOT built here: direct camera writes would use ONE shared camera account for all cameras; the joint live
session may include the main stream.

## Behaviour

### Verification (`smplwise/services/nvr_verify.py`)

- Runs in the batch runner's own thread right after the batch ends (`nvr_batch._run` -> `nvr_verify.after_batch`), for encoding
  batches (`mode: encoding`) and their rollback batches. An SVC batch has no verification (`verify: null`).
- (i) NVR: the item's existing S2A outcome (`applied` / `no_effect` / `diverged` / refused / failed / not attempted). A re-check also
  reads the recorder's stream list once (one LIST, read-only) and uses what the NVR shows now.
- (ii) Media: for every stream whose change touched the codec and that the NVR accepted, after a settle wait (`SETTLE_S` = 10 s, the
  camera restarts its encoder), one probe per stream: `GET /api/streams?src=smplwise_<recorder>_ch<N>_<main|sub>&video=all`
  (`Go2rtc.probe_video_codec`). Only our stream NAME is sent - never a source - and a plain name is only looked up by go2rtc, so the
  probe cannot create, re-point or delete a stream; names outside `smplwise_` (and the Home Assistant `smplwise_ha_` namespace) are
  refused before any request. go2rtc opens the recorder's RTSP session for that channel for about a second.
  Limits: one probe at a time in the process (shared by every pass), 1 s between probes, and no probe while the live sessions are at
  `media.max_live_sessions` (wait up to 20 s, then "busy" = not checked). A probe that cannot answer (go2rtc not configured / down /
  stream unknown / no codec reported / busy) is `not_checked`, never a confirmation.
- (iii) Restart: the NVR's own "reboot required" answer (Hikvision statusCode 7, already stored in `nvr_changes.reboot_required`), and
  `reconnect` - the stream already had a live producer reporting a codec before the probe (somebody watching; the session may predate
  the change) and it still shows the old codec.
- Outcome per stream: `confirmed` ("המצלמה אישרה (H.264)"), `nvr_accepted` ("המקליט קיבל" - camera not checked, with the reason),
  `still_old` ("עדיין H.265"), `restart_needed` ("צריך אתחול", reason `reboot_required` / `reconnect`), `failed` ("נכשל: <reason>",
  skipped ones included, with "דולג, וההמרה המשיכה לשאר המצלמות"), `unchanged` ("כבר מוגדר"). A change that did not touch the codec is
  `nvr_accepted` (or `restart_needed` when the NVR asked for a reboot) without a probe.
- Storage without a migration: one more key of the batch in `settings`, `nvr.batch.<id>.verify` (beside the batch record
  `nvr.batch.<id>`; `services/backup.py` already keeps every `nvr.batch.` key out of a restore). Written item by item. No address,
  device user, password, serial or MAC - stream refs, codec names, reason codes and Hebrew lines only.
- `GET /nvr/stream-batches/{id}` now answers `on_refusal`, `skipped` (count), `verify` (state `pending|running|done|interrupted|none`,
  counts per outcome, `worklist`, `skipped`, `can_recheck`, `checked_at`) and per item `skipped` and `verify` (label, detail, codecs,
  media reason, reboot / reconnect). Items and lists honour the caller's `nvr.configure` camera scope as before.
- Re-check: `POST /nvr/stream-batches/{id}/verify` (202). `nvr.configure` at installation (read connection, before anything) and on
  every camera re-checked (a deny = 403, audited). Encoding batches only (409 `verify_not_available`), not while the batch or a pass
  runs (409 `verify_in_progress`), at most every 30 s (429 `verify_too_soon`), only when something is left (409 `nothing_to_verify`:
  re-checks the worklist and the `nvr_accepted` streams). Local channel only (404 on the remote channel, like the encoding routes).
  Audit `nvr.stream.batch.verify` (allowed / denied, batch id and item count). Read-only: one NVR LIST and the probes; a stream the NVR
  now shows with the target codec and the camera confirms becomes `confirmed` (e.g. changed in the camera's own UI meanwhile).

### Refusal policy (CR-020 S2C rule changed for encoding batches)

- Setting `nvr.batch_on_refusal` = `skip` (default) | `stop` (`PATCH /settings`, `system.configure`; הגדרות › וידאו ומדיה ›
  "מצלמה שה־NVR מסרב לשנות"). The encoding start takes an optional `on_refusal` that wins for that batch (the preview's confirmation
  offers both, preselected from the setting - the preview now answers `on_refusal`). The policy is fixed in the batch record at start.
- `skip` steps over ONE kind of failure only - the NVR refused or ignored THIS stream: `nvr_not_supported`, `nvr_rejected`,
  `nvr_no_effect` / `no_effect`, `capabilities_unreadable`, `stale`, `not_found`, `validation`, `not_rollbackable`, `device_refused`.
  The item keeps its refused / failed / no_effect row, its id goes into `meta.skipped`, an audit row `nvr.stream.batch` `phase: skip`
  (denied, with the code) is written, and the runner takes the next stream. The batch ends `completed`; the result says "דולג ב־N".
- Always stops, whatever the setting: a permission loss (`forbidden`), the recorder's write switch turned off (also when the refusal
  came from the adapter: the switch is read again before a skip), a busy NVR (`nvr_busy`), an unreachable NVR / deadline, an unknown
  outcome (the existing unknown-outcome rule with its single read-only check), a partial change (`diverged`).
- SVC batches (phase C) keep the stop rule unchanged (`on_refusal` reads `stop`).

### Rollback per channel

- Unchanged mechanics: the undo is a new reversed batch of single undos of the source's `applied` rows. A skipped stream never got an
  `applied` row, so the undo never touches it.
- The undo of an encoding batch carries the policy too (taken from the setting when the undo starts). A refused undo of one stream is
  skipped; its source row stays `applied`, the source keeps `can_rollback`, and a second undo of the same batch retries exactly the
  streams still changed (tested).
- The undo is verified like the apply ("המצלמה אישרה (H.265)" when the camera is back on H.265).

### UI (Hebrew)

- `screens/nvr-verify-report.ts` (new dialog "דוח בדיקה"): summary line, tabs "כל הזרמים" / "מצלמות שלא השתנו" / "דולגו", a row per
  stream (camera · role, channel, the outcome chip, one explaining line), "בדוק שוב" (read-only re-check; hint says nothing changes),
  "סגור". It keeps reading the batch every 2 s while the server still checks. Server lines are rendered as text only.
- Opens by itself when an encoding change (or its undo) completes in front of the person (next to the existing toast); a stopped /
  failed batch keeps the progress dialog, which now has "דוח בדיקה". Earlier reports: "דוחות בדיקה קודמים" in the H.264 preset box
  of "שינוי קידוד לכמה מצלמות" (the latest encoding batches, newest first).
- Preview step: "אם ה־NVR מסרב לשנות מצלמה: לדלג ולהמשיך / לעצור את כל ההמרה" with a one-line hint (shown when more than one stream
  changes and the server names its default); the confirmation lead says what a refused camera does and that a check follows.
- Settings › וידאו ומדיה: new row "מצלמה שה־NVR מסרב לשנות".
- Result dialog / toast: a completed batch with skipped streams reads as a warning with "דולג ב־N".

## Tests

Backend (`smplwise_vms/backend/tests/test_cam_h264_verify_2361.py`, fake NVR + fake go2rtc, single process): **27 passed**
- accepted by the NVR but the camera still sends H.265 (`still_old`, worklist, one probe per changed stream, zero go2rtc writes, PUTs
  only the plan); probe without codec / go2rtc down -> `nvr_accepted` + `not_checked`, never confirmed; no go2rtc -> `media_not_configured`;
  live-session cap -> `busy`, zero probes;
- reboot required (statusCode 7) and a pre-existing live session -> `restart_needed` (`reboot_required` / `reconnect`);
- refusal skipped by default (batch continues, item marked, skip audit row, policy in the attempt audit); `stop` from the setting and
  from the start body; invalid `on_refusal` 422; busy NVR and the switch turned off mid-batch still stop;
- rollback after a partial batch: only changed streams undone in reverse, a refused undo skipped, the source still undoable, the
  second undo retries exactly that stream, the undo verified ("המצלמה אישרה (H.265)");
- the report persisted in `settings` (no credential / address in it), reopened by GET and listed; re-check read-only (no PUT, no
  go2rtc write, NVR LIST read, only the worklist probed), result updated, `nothing_to_verify`, audit row; rate limit 429; SVC batch 409;
  bad / unknown ids 404;
- permissions: `system.configure`-only role 403 on status and re-check (nothing probed); `nvr.configure` role 202;
- setting default `skip`, validation 422, preview names the default;
- pure: `assess` outcomes (12 cases), `role_of`, probe refuses foreign / HA / odd names, the probe sends a name only and never creates.

Fixture changes (`tests/fixtures/fake_devices.py`): fake go2rtc answers the probe (`GET /api/streams?src=`; codec follows the fake
NVR, overrides `media_codec`, `probe` False, `viewers`, `probes` log); fake NVR `put_by_stream` (one stream's own PUT answer).

Backend regression (single process, workstation): `test_live_h265`, `test_nvr_encoding_batch`, `test_nvr_encoding_plan`,
`test_nvr_h264_bulk_2341`, `test_ui_settings` - 127 passed; `test_nvr_stream_batch`, `_rbac`, `_recovery`, `_review_fixes` - 76 passed;
`test_provision_encoding_write`, `test_nvr_stream_write`, `test_media` - 84 passed after one intended update:
`test_provision_encoding_write.py::test_bulk_batch_stops_at_a_refusing_camera_and_the_next_preview_skips_it` asserted the old
stop-at-first-refusal default; it now runs with both settings (`stop`: the old assertions unchanged; `skip`: the batch completes, the
refusing channel written once, skipped, never retried).

Runner (pushed `7be140fb3`, `run_smart.py preview ... --workers=1 --machine runner`): `evidence-nvr-h264-bulk`,
`evidence-nvr-encoding-batch`, `layout-nvr-encoding-batch`, `pixel-nvr-encoding-batch`, `evidence-nvr-cameras-batch` - 102 passed,
6 skipped (project-specific skips inside the specs), 0 failed. The mocked preview carries no `on_refusal`, so the new refusal row is
not drawn there (the pixel baselines stay valid).

Frontend: `tsc --noEmit` clean; unit specs (`--workers=1`): `tests/unit-nvr-verify-report.spec.ts` (new, 11) and
`unit-nvr-h264-preset` - 20 passed; `unit-nvr-batch-logic`, `unit-nvr-encoding-logic`, `unit-nvr-provision-encoding`, `unit-token-lint`,
`unit-a11y-polished-lint`, `unit-dark-polish-beds`, `unit-uxfix-nav-295`, `unit-video-policy-webrtc-first`, `unit-wxmedset`,
`unit-access-parity-logic` - 88 passed.

## NOT_RUN

- Runner: full backend suite, full unit run, release gate. Browser: the preview step WITH the refusal row (a mock that answers
  `on_refusal`), the new report dialog (no evidence / layout spec written yet), Settings › וידאו ומדיה (new row: its pixel baselines may
  need a refresh on the runner). `npm run build:addon` not run (the `www` bundle is not rebuilt in this branch).
- `contracts/API_INVENTORY.md`: the new route `POST /nvr/stream-batches/{batch_id}/verify` and the `on_refusal` body field are added by
  `scripts/api_inventory.py` at train assembly.
- Lab (owner approval needed for anything beyond read-only): confirm on the lab go2rtc version that `GET /api/streams?src=<name>&video=all`
  answers the producer's `receivers[].codec` while the probe consumer is attached (the parser also reads `medias`; a version without the
  probe gives "not checked", never a false confirmation); confirm the NVR re-streams the camera's codec unchanged (no NVR transcoding);
  measure the settle time a camera needs after a codec change (default 10 s).

## Rollback of this change

- Code: revert the branch's commits. No migration, no new table. Left-over `nvr.batch.<id>.verify` keys in `settings` are inert for
  older code (it reads only `nvr.batch.<id>` / `.beat` / `nvr.batch.active.*`); `nvr.batch_on_refusal` is ignored by older code (which
  always stops). An older frontend ignores the new fields; an older server ignores nothing it does not know except `on_refusal` in the
  start body, which the new frontend sends only when the preview named a default (i.e. the server supports it).
- Behaviour: to get the old stop-at-first-failure rule without a code change, set "מצלמה שה־NVR מסרב לשנות" to "לעצור את כל ההמרה".

## Open points for the owner

1. The settle wait (10 s) and the gap between probes (1 s) are constants, not settings. Make them settings after the lab measurement?
2. The report's worklist does not include "המקליט קיבל" (not checked at the camera) streams; the re-check does include them. Keep it so?
3. ANSWERED (owner 2B, 2026-11-02): the undo follows the same skip/stop setting, as built - kept. (Question was: the skip policy also
   applies to the undo of an encoding batch, a refused undo is skipped and can be retried; keep, or should the undo always stop?)
