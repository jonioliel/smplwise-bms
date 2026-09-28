# WisKey next screens — build brief: Person editor (+ card capture) and Door/station technical settings

Prepared 2026-09-28 for the implementer starting tomorrow. Research only; nothing in the repo was changed.

Sources (line numbers are approximate; `X:` = `docs/integrations/wiskey/WISKEY_SOURCE_EXTRACTION.md`,
`R:` = the read-only WisKey clone `scratchpad/wiskey-ref/repo` at HEAD `2f902aa`, `B:` = `R/custom_components/hikvision_intercom/`):
- Person editor X:893-1024; card capture X:1028-1063 and X:3221-3275 (verified against B:access/enrollment.py, B:client/capture.py);
  timing X:2534-2596, X:3532-3612; photo X:2600-2645, X:3523-3528; USB wedge X:2649-2678; `build_user` rules X:2969-2991;
  repository collisions X:3057-3080; WS dispatch X:3084-3137; group permissions X:3433-3451; types X:1256-1376.
- Devices/stations X:1130-1175; station technical X:4618-4668; door programs X:4671-4720; `technical_api.py` X:4965-4995
  (verified against B:technical_api.py); `client/technical.py` X:4999-5009 (verified); hold-open executor X:5032-5058 (verified
  against B:access/hold_programs.py, B:access_runtime.py:156-183); Part E capability rows X:5283-5330, open questions X:5334-5347.
- SMPLWISE side read: `routers/access_control.py` (physical-action section note, `ReleaseBody`, `_Action`, `_parse`, `_envelope`,
  `_perform`, `_RelayGuard`), `services/intercom_client.py` (`PRE_DISPATCH`, `PRE_DEVICE`, `_action_result`, `UnclearAnswer`),
  `services/intercom_sync.py` (`command`, `action`, `_execute`, lanes/buckets, `project_person`, `_station`),
  `frontend/src/screens/wiskey-overview.ts` (release `sw-dialog` + two-tap arming), `frontend/src/api/intercom.ts` (`envelope()`,
  `serverNow()`), CR-005 (all recorded deviations/decisions), `routers/access.py` PERMISSION_LABELS note.

---------------------------------------------------------------------------------------------------------------------

## 0. Rules that apply to both screens

### 0.1 The refused-vs-unknown rule, restated for writes that are not immediate actuations
The 0.1.106 reviews established: a `success:false` code is "refused" ONLY if the code can be proven to be raised before the
command's effect could happen; anything else (including every code the allow-list does not know, `action_failed`,
`device_unavailable`, an answer of unexpected shape, a timeout, a dropped session) is "outcome unknown". The allow-list fails
toward unknown. For the new commands the "effect" is one of:
- **device effect** (capture_start puts a reader in collection mode; technical_update PUTs DoorParam; program action sends `close`),
- **storage effect** (users/create|update|delete, capture_confirm, program_save): once WisKey's store is written, WisKey's own
  reconciliation / 15-s timer will carry it to the device with no further command from us.
So each new command gets a `PRE_EFFECT` allow-list in `intercom_client.py` (generalise `PRE_DEVICE`), built from the tables below.

Source facts that drive the tables (all verified in R):
- `AccessError(code)` → error `code`; any `HikvisionError` → `device_unavailable`; any other exception, including an
  `asyncio.timeout` expiry → `action_failed` (X:4607; B:websocket.py:1053-1070). `device_unavailable`/`action_failed` can arise
  anywhere, so they are never "refused" for a write.
- WisKey persists via `_commit` (B:access/repository.py:264-296): the candidate state is validated (`_validate_collisions`) BEFORE
  `_save`; memory is published only after the save. `AccessStore.async_save` raises `storage_stopping` before writing, and
  `storage_write_failed` from inside `write_utf8_file_atomic` (B:storage.py:69-96) — whether the file was replaced before that
  exception is not provable → `storage_write_failed` = unknown.
- `dispatch_technical` raises `station_unloaded` at entry AND again AFTER the command's work (B:technical_api.py:21-23 and the
  final check before `return result`) → `station_unloaded` is **unknown** for every `stations/technical_*` write (same conclusion
  T054 reached for `media/signal`). `device_busy` is raised only at entry (per-station `technical_busy` set, ≥3 stations busy) →
  pre-effect.

### 0.2 WisKey envelope facts the client must respect
- `api_contract: 1` is required on every command NOT in `READ_COMMANDS` (B:api_contract.py:34-84). Reads that are NOT in that set
  and therefore need it: `users/pin_check`, `users/pin_generate`, `cards/reader_capabilities`, `stations/technical_get`,
  `stations/technical_program_list`. `cards/capture_status` and `cards/capture_cancel` ARE in the set (sending `api_contract`
  anyway is accepted: it is an optional int in the schema). Unknown top-level keys → `invalid_fields`; `int`/`bool` fields are
  checked with `type(x) is` (bool is not int).
- WisKey authorizes per HA user; SMPLWISE uses one add-on HA user. It must hold `users:manage` and `stations:manage` (or be an HA
  admin) or every write here is `unauthorized` (pre-dispatch, refused). UNVERIFIED for the lab: read `overview.access` /
  `overview.api.commands` once and assert the new commands are listed before enabling the UI.
- Capture sessions are owned by the WisKey **actor** = the add-on's HA user (B:enrollment.py `_get`: `session.actor != actor` →
  `capture_not_found`). Every SMPLWISE user therefore looks like the same actor to WisKey: SMPLWISE must bind each `session_id` to
  the SMPLWISE user itself (server-side map), or one SMPLWISE editor could poll/confirm/cancel another's capture.

### 0.3 Timeouts and lanes (SMPLWISE side) — must change before these screens work reliably
- `intercom_sync.COMMAND_TIMEOUT_S = 25` (reads), `ACTION_TIMEOUT_S = 35` (actions), `ha_client.ws_session` call limit 60 s
  (`ha_client.py:118`). WisKey budgets: `stations/technical_*` whole command `asyncio.timeout(75)`; `update_door` 40 s; DoorParam
  read up to 2×(caps+values) + identity; client timeouts in WisKey's own UI: technical_get 80 s, technical_update 50 s, program
  pause/remove 70 s (R:frontend/src/station-technical.ts:140,175; door-programs.ts:184,282); `cards/reader_capabilities` 35 s.
  → `_execute` needs a per-command timeout argument (read: 80 s for `technical_get`, 40 s for `reader_capabilities`; write: 60 s
  for `technical_update` / program action). Anything WisKey takes longer than 60 s is cut by ha_client and becomes "unknown" —
  acceptable, but say so in the UI copy for technical writes.
- Action lane has only `ACTION_INFLIGHT = 2` slots shared by release/call/TTS. A relay-reversal or program action can hold a slot
  for up to 60 s. Recommendation: a third **config lane** (1 slot, own buckets) for people saves, technical writes and program
  saves, so a stuck technical write can never block a door release. Totals then 4 read + 2 action + 1 config (+ feed) stay under
  WisKey's AdminLimiter of 8 concurrent handlers per HA user (X:71-76).
- Capture status polling (WisKey's panel: every 1000 ms while `preparing`/`waiting`) would spend 1 read token/s per open dialog
  against `USER_RATE = 1.0`. Recommendation: poll WisKey from the SMPLWISE backend (one poller per session, 1.5 s) and push
  `intercom_capture` notices on `/intercom/ws`, exactly the pattern already used for TTS progress (`_on_tts` / `intercom_tts`);
  keep a GET fallback.

### 0.4 Permissions (policy decision for the owner — see §4 Q1-Q4)
CR-005 §3 already names `access.people.manage`, `access.doors.manage`, `access.release`; it put card capture under
`access.release`. Recommended (all installation scope, default ONLY site_admin + system_admin like `access.release`; the physical
ones added to `roles.json` `sensitive_permissions_not_implied`; labels + reasoning at `routers/access.py` PERMISSION_LABELS):

| Permission | Covers | Class |
|---|---|---|
| `access.people.manage` (CR-005 §3 name; preferred over a new `access.people.write`) | editor projection read, create/update/delete person, PIN set/remove/check/generate, typed + USB cards, groups/profile, validity/timing, duplicate check | CONFIG-WRITE (grants/revokes physical access after WisKey sync) |
| `access.cards.capture` (NEW; splits capture out of `access.release`) | reader capabilities, capture start/status/cancel; confirm additionally requires `access.people.manage` | PHYSICAL (reader mode) + CONFIG-WRITE on confirm |
| `access.doors.manage` (CR-005 §3 name) | read technical settings, `doorName` / `openDuration`, save a program WITHOUT activation, delete legacy saved drafts | CONFIG-WRITE (device DoorParam / WisKey storage) |
| `access.doors.physical` (NEW) | activate a door program, pause/remove a program (may send `close`), `relayReverseEnabled` | PHYSICAL (scheduled / immediate) |

Rationale for splitting capture out of `access.release`: `access.release` is the guard-desk permission the owner may later give to
`operator` (CR-005 recorded decision); card enrollment should not ride along with door release.

### 0.5 Audit/envelope pattern to reuse (from `routers/access_control.py` physical-actions section)
Every write endpoint below reuses `_Action` / `_parse` / `_envelope` / `_perform` with its own action name (`intercom.person.save`,
`.person.delete`, `.card_capture.start`, `.card_capture.confirm`, `.door.settings`, `.door.relay_reverse`, `.door.program.save`,
`.door.program.pause`, `.door.program.remove`):
- permission checked as a dependency BEFORE the body is read; JSON-only (`_is_json`, 415 otherwise); a pre-send refusal = one
  `denied` row; a sent command = attempt row committed BEFORE sending + best-effort outcome row (`ok|not_sent|refused|unknown`).
- `client_request_id` + `expires_at` on every write (dedupe via the attempt rows; `EXPIRY_MAX_S = 60`, `SEND_WITHIN_S = 15`, the
  `not_after` re-check on the feed loop). Server-clock expiry: the browser computes `expires_at` with `serverNow()`
  (`frontend/src/api/intercom.ts`), as for release.
- **Audit details must never contain a PIN, a card number (not even last-4), a phone, profile values or a photo.** Record changed
  field NAMES and counts only, mirroring WisKey's own audit summaries (`{pin_configured, card_count, enabled_cards, assignments
  {sid:{enabled, allowed_locks}}}`, X:3036-3040). This differs from TTS, whose audit keeps the spoken text.
- PIN values travel only in JSON bodies of POST requests (never a query string, never logged). `pin_check` must therefore be POST.

---------------------------------------------------------------------------------------------------------------------

## 1. Screen A — Person editor (home of card capture)

### A.1 Purpose, entry points, layout
Create/edit one WisKey person: identity, phone, active, custom profile fields/groups/template (+ photo), validity/timing, PIN,
cards (typed, USB wedge, station capture), per-station door permissions (X:893-897).
Entry points to port: "Add person" on the people directory; row "Edit"; "Edit" in person details (the read-only people screen now
being built, `pilot/T054-wiskey-people-screen`); later the permission directory. Route suggestion `#/wiskey/people/:id/edit` and
`#/wiskey/people/new` (a full screen, not a modal: the WisKey dialog has 7 fieldsets).
Layout (X:913-955), ported onto `sw-*` components:
1. Person: name (`required`, maxlength 32), employee id (`^[A-Za-z0-9_-]{1,32}$`, disabled when `identity_locked` + note
   `employee_locked`), phone (`type=tel`, maxlength 32, `05X-xxx-xxxx` display via `mobileDisplay`), active.
2. Profile (only when `profile_settings` has fields/groups/photo): onboarding template (new person only; applies `profile` +
   `group_ids`, clears overrides), one control per enabled field (select incl. legacy value; text maxlength 100; `type=date` for
   date; decimal for number; `required` only for new person), group checkboxes, photo.
3. More actions (existing person, unmodified draft only, else `profile_save_first`): change history (→ our audit/activity), delete.
4. Validity: mode `always | period | weekly | dates` (weekly/dates need capability `user_timing_draft`); enforcement `ha | native`
   (needs `user_timing_enforcement`); per-station `timing_readbacks`; `period` → zone basis select (UTC / HA zone / station zone),
   single-day helper (2000-01-01..2037-12-30), `valid_from`/`valid_until` `datetime-local`.
5. PIN: "configured / not configured"; `pin_mode_blocked` when any enabled assignment's station has `capabilities.pin_writable
   === false`; new + confirm (`type=password inputmode=numeric`, `[0-9]*`, maxlength 128); live status `pin_checking | pin_available
   | pin_conflict | pin_check_failed` (debounce 350 ms, stale results ignored); "generate unique PIN"; "remove PIN" / "keep PIN".
6. Cards: saved cards show `masked_number` read-only + label (64) + active + remove; new rows require `card_no`
   `^[A-Za-z0-9_-]+$` maxlength 32; "+ add card"; "Read card from station" (existing + unmodified person only; hint
   `capture_save_user_first` otherwise); USB wedge `<details>` (password-type input, Enter = review, shows `•••• last4 · length`,
   "Use" adds to draft, auto-clears after 60 s / tab hidden / lock).
7. Assignments: select all / clear / reset overrides, counter; per station: checkbox (disabled if `!lock_enabled`), online badge,
   source label `permission_denied | permission_personal | permission_inherited · <groups> | permission_none`, "reset to
   inherited", per-lock checkboxes when the station has >1 lock (unchecking the last lock = deny), sync badge.
Footer: Cancel, **Save**, **Save & sync** (primary; `sync_now=true`); both disabled while busy or PIN status `in_use`.

### A.2 Behaviour to port exactly
- Draft construction `edit(user?)` (X:901-911): new person gets a random 9-digit `employee_no` (100000000 + uint32 % 900000000,
  `crypto.getRandomValues`), `active true`, `cards []`; existing = clone + `confirm_pin ""`, `timed = !!valid_from`;
  `permission_overrides ??=` from assignments (`enabled → allow`, else `deny`); `_editorPolicyRevision =
  profile_settings.revision`; baseline JSON for unsaved-change detection.
- Permission model (X:957-958; B:access/group_permissions.py, X:3433-3451): station enabled iff override `allow`, or (no `deny`
  and an enabled group in `group_ids` grants it); enabled assignments default `allowed_locks: [1]`. Personal deny beats everything.
- Validation order in `save()` (X:960-971): (1) `readValidity()` → `clock_invalid_local | clock_ambiguous | clock_nonexistent`;
  (2) `pin_mismatch`; (3) `pin_conflict` if status in_use; (4) `invalid_validity` (missing or from ≥ until); (5) `profileError` →
  `profile_required | profile_value_invalid` (only changed values for existing persons); (6) duplicate check (capability
  `identity_lifecycle`): `blocking` → `lifecycle_employee_conflict`, else confirm `lifecycle_duplicate_confirm {count}`;
  (7) native `required`/`pattern` constraints.
- Save payload (X:973-999, verbatim keys): `employee_no, phone ("" allowed), display_name, active, valid_from|null,
  valid_until|null`, `access_timing_draft` (only with `user_timing_draft`), `access_timing_policy` (only with
  `user_timing_enforcement`; `{mode, schedule, bindings}` with bindings carried over only if the mode is unchanged, else `{}`;
  mode `ha` requires `{}`), then EITHER (profile_settings present) `permission_overrides`, `door_permissions {sid: allowed_locks}`
  (enabled only), `access_policy_revision` OR (no profile_settings) legacy `assignments`; `cards: [{id,label,card_type,enabled}]`
  for saved cards (no `card_no` → WisKey keeps the stored secret) and `[{card_no,label,card_type:"normalCard",enabled}]` for new;
  `pin` only when changed (`null` = remove); `profile`, `group_ids`, `photo` only with profile_settings. Unknown keys →
  `invalid_fields` (`USER_FIELDS` B:websocket.py:45-64; `CARD_FIELDS = {id, card_no, label, card_type, enabled}`).
  Recommendation: the SMPLWISE backend fills `bindings` itself from a fresh `users/get` at the same revision instead of
  round-tripping it through the browser.
- Success notices `saved_sync` / `saved`; "Save" without sync still leaves WisKey's periodic reconciliation (~300 s) active
  (X:1540-1541); `sync_now` on update only queues when device-relevant fields changed (B:access/manager.py:738-757).
- `refreshValidityZone()` re-expresses a typed range when zone rules change (X:1021) — port or drop (zone basis is a quirk; see Q7).

### A.3 WisKey commands used by the editor

| Command | Payload (types) | Reply | Class | WisKey perm | Error codes (from source) |
|---|---|---|---|---|---|
| `users/get` | `user_id:str` | `ManagedUser.public()` (no `timing_readbacks`) | READ | users:view | `user_not_found` |
| `overview` (already polled by the feed) | — | `profile_settings`, stations `capabilities`, `integrated_locks`, `users[].timing_readbacks`, `api.capabilities` | READ | any view | — |
| `users/photo_get` | `user_id:str` | `{photo: "data:image/jpeg;base64,…"\|null}` | READ | users:view | `user_not_found` |
| `users/pin_check` | `user_id:str` ("" new), `pin:str` `^\d{1,128}$`, `api_contract:1` | `{available:bool}` | READ (PIN oracle) | users:manage | `invalid_pin`, `user_not_found` |
| `users/pin_generate` | `user_id:str`, `api_contract:1` | `{pin:"NNNNNN"}` (not reserved) | READ | users:manage | `pin_generation_failed`, `user_not_found` |
| `users/duplicate_check` | `user_id:str`, `data:{employee_no≤32, display_name≤64, phone, card_suffixes:[4 digits]≤255}` | `{matches:[row+reasons+card_matches], total, truncated, blocking, privacy}` | READ | users:view | `invalid_fields`, `invalid_phone` |
| `users/create` | `data:dict`, `sync_now?:bool=true`, `api_contract:1` | person public | CONFIG-WRITE (storage; device via reconciliation) | users:manage | see A.4 |
| `users/update` | `user_id:str`, `revision:int`, `data:dict` (patch), `sync_now?:bool`, `api_contract:1` | person public | CONFIG-WRITE | users:manage | see A.4 |
| `users/delete` | `user_id:str`, `revision:int`, `api_contract:1` | `{accepted:true}` | CONFIG-WRITE (tombstone + device deletions queued) | users:manage | `revision_conflict`, `user_not_found`, storage codes, `manager_closed` |
| capture commands | see A.7 | | | | |

Not used by WisKey's editor (no screen; X:3723): `cards/add`, `cards/remove`, `users/set_active`. Do not use them either.

### A.4 Refused vs unknown for `users/create` / `users/update` / `users/delete` (effect = WisKey storage written)
Order in source: handler profile checks (B:websocket.py:844-868) → `manager._validate(build_user(permission_data(...)))`
(B:manager.py:725-757, cached capabilities only, no device I/O) → `repository._commit` (collisions validated, then save) →
`request_user()` (may raise `manager_closed`) → `_changed()`.
- **Refused (proven pre-storage)**: `PRE_DISPATCH` set; `profile_settings_unavailable`, `photo_disabled`, `invalid_fields`;
  all `build_user` codes (`invalid_identifier, invalid_text, invalid_boolean, unsupported_user_type, invalid_validity,
  invalid_pin, invalid_cards, invalid_id, unsupported_card_type, duplicate_card, invalid_assignments, unmanaged_lock,
  schedule_unverified, invalid_photo, invalid_phone, invalid_timing_policy, schedule_binding_invalid, invalid_user_timing,
  schedule_period_limit, schedule_invalid_time, schedule_overlap, schedule_invalid_date`); `group_policy_changed`;
  `_validate`: `station_not_found, station_has_no_managed_lock, person_exceeds_capabilities, pin_device_managed,
  pin_exceeds_capabilities, card_capacity, card_exceeds_capabilities`; `_commit`/collisions: `revision_conflict, user_not_found,
  employee_conflict, pin_conflict, card_conflict, pin_removal_pending, card_removal_pending, photo_storage_full,
  identity_migration_required`; `storage_stopping`.
- **Unknown**: `storage_write_failed` (atomic write, unprovable), `manager_closed` (raised by `request()` AFTER the commit →
  saved but not queued), `action_failed`, `device_unavailable` (no device I/O expected in this path — unproven), timeout, lost
  session, unexpected reply shape. After an unknown, the UI must re-read the person (`users/get`) and compare `revision` before
  anything else; never auto-retry. Replay safety: update is CAS on `revision`; create is protected by the client-generated
  `employee_no` (`employee_conflict` on replay) plus our `client_request_id` dedupe.
- Delete: `revision_conflict`, `user_not_found`, `storage_stopping` refused; `storage_write_failed`, `manager_closed` (from
  `request()` after the tombstone commit), `action_failed` unknown.

### A.5 Privacy: the editor needs its own projection (NOT a widening of `access.read`)
0.1.105 decision: the read projection (`project_person`, `PERSON_KEYS`) strips phones, cards, PIN flags, profile values, photo,
overrides, timing, readbacks, identity_locked, assignment errors. The editor legitimately needs, and a new endpoint gated on
`access.people.manage` returns (never cached, never broadcast, never served under `access.read`):
- `phone` (edit field) · `pin_configured` (flag only — WisKey never returns a PIN value; `pin_generate` output is shown once in
  the form) · `cards[{id, masked_number, label, card_type, enabled}]` — **full card numbers are never available from WisKey after
  save** (`ManagedCard.public()` masks to `"•••• " + last4`, X:2941-2943); the only full numbers an editor ever sees are the ones
  they type or scan into the form themselves · `profile` values · `group_ids` · `photo_configured` (+ `users/photo_get` on demand,
  if Q6 allows) · `permission_overrides` · `access_timing_draft`, `access_timing_policy` (without `bindings`, see A.2) ·
  `timing_readbacks` (from the feed's overview copy; `users/get` lacks them) · `identity_locked` · `revision` · assignments with
  `enabled, allowed_locks, sync_state, last_error, desired_revision, applied_revision`.
- Editor context (same endpoint or a sibling): `profile_settings {revision, fields, groups, photo_enabled, templates}`; stations
  `{id, name, online, lock_enabled, integrated_locks[{physical_index, name}], capabilities.pin_writable}`; `api.capabilities`
  (`user_timing_draft`, `user_timing_enforcement`, `identity_lifecycle`). `intercom_sync._station` / `project_overview` currently
  drop all of these; extend a SEPARATE editor projection rather than the public one.
- `duplicate_check` replies contain other people's phones and card suffixes: project to `{total, truncated, blocking,
  matches:[{id, display_name, employee_no, reasons}]}`.
- `pin_check` is a PIN oracle (WisKey has the same exposure; X:1552): see Q8.

### A.6 Proposed SMPLWISE endpoints (Screen A)

| Method + path | Body model (JSON only) | Permission | Confirmation / guard |
|---|---|---|---|
| GET `/intercom/people/{id}/editor` | — | `access.people.manage` | read; returns A.5 projection |
| GET `/intercom/people/editor-context` | — | `access.people.manage` | read |
| GET `/intercom/people/{id}/photo` | — | `access.people.manage` (Q6) | read |
| POST `/intercom/people/pin-check` | `{user_id:str≤128\|"" , pin:^\d{1,128}$}` | `access.people.manage` | own tight bucket (Q8); never audited with the value |
| POST `/intercom/people/pin-generate` | `{user_id}` | `access.people.manage` | read |
| POST `/intercom/people/duplicate-check` | `{user_id, employee_no, display_name, phone, card_suffixes[]}` | `access.people.manage` | read |
| POST `/intercom/people` | `PersonSaveBody{data, sync_now:StrictBool, client_request_id, expires_at}` | `access.people.manage` | form submit; attempt/outcome audit; config lane |
| PUT `/intercom/people/{id}` | `PersonSaveBody + revision:StrictInt` | `access.people.manage` | same |
| DELETE→POST `/intercom/people/{id}/delete` | `{revision, confirmed, client_request_id, expires_at}` | `access.people.manage` | `sw-dialog` showing "removes from N stations" (assigned + pending revocations); server refuses without `confirmed:true`; draft must be unmodified |

`PersonSaveBody.data` is validated by SMPLWISE with a pydantic model mirroring `USER_FIELDS` / `CARD_FIELDS` exactly (extra keys
forbidden, `StrictInt`/`StrictBool`), so malformed drafts are refused locally (`not_sent`) instead of reaching WisKey.

### A.7 Card capture — the complete real flow (first long-running physical interaction)
Verified in B:access/enrollment.py and B:client/capture.py.

**Preconditions (WisKey side)**: person already saved and the editor draft unmodified (panel.ts:4109-4120); the chosen station
must be in WisKey's manager, have a driver (online) and a managed lock with `enabled_doors` (`_driver`: `station_offline`,
`station_has_no_managed_lock`); WisKey's UI offers only `lock_enabled && online` stations, first one pre-selected. The station must
advertise exactly one `isSupportCaptureCardInfo == true` and `CaptureCardInfo/capabilities` (`CardInfoCap`), else
`capture_unsupported`. No live subscription is needed on WisKey's side: sessions live in WisKey memory, polled by id.

**Steps**
1. `cards/reader_capabilities {station_id, api_contract:1}` (READ, device GETs: identity, `GET /ISAPI/AccessControl/capabilities`,
   `GET /ISAPI/AccessControl/CaptureCardInfo/capabilities?format=json`; 35 s) → `{readers:[int], card_min, card_max}`. `readerID`
   bounds 1-8 → `range(min,max+1)`; absent → `[0]` (0 = omit readerID, "Station default reader"). Card length default 1-32.
   Errors: `manager_closed, station_not_found, station_offline, station_has_no_managed_lock, capture_unsupported,
   device_unavailable, action_failed`.
2. `cards/capture_start {station_id, user_id, revision:int, reader_id:int 0..8, api_contract:1}` — PHYSICAL. Synchronous checks
   then a background collector task; reply = session `{session_id, station_id, user_id, revision, state:"preparing", error:null,
   card:null}`. Limits: session TTL **120 s** (`SESSION_SECONDS`, expiry timer drops it unless `applying`), **one session per
   station** (`capture_station_busy`), **3 sessions total across ALL WisKey users** (`capture_limit`) — shared with people using
   WisKey's own panel.
3. Collector (`_collect`, overall **70 s**): re-reads capabilities (`capture_reader_invalid` if the reader vanished), sets
   `waiting`, then issues `GET /ISAPI/AccessControl/CaptureCardInfo?format=json[&readerID=N]` on a separate HTTP lane with a
   **30 s** deadline — the station's reader waits for ONE card to be presented. Validates `CardInfo.cardNo`
   (card_min..card_max, `[A-Za-z0-9_-]`), `cardType ∈ {TypeA_M1, TypeA_CPU, TypeB, ID_125K, FelicaCard, DesfireCard}`,
   `readerID` 1-8 and equal to the requested one. Success → `captured` (number kept in WisKey memory only). Failure → `error` with
   `capture_timeout | capture_unsupported | <AccessError code> | capture_failed` (raw device text never kept).
4. `cards/capture_status {session_id}` (READ; in READ_COMMANDS) → session with `card: null | {masked_number "•••• NNNN",
   technology, reader_id}`. States: `preparing → waiting → captured | error`; `applying` during confirm. Unknown/foreign/expired
   id → `capture_not_found`.
5. `cards/capture_confirm {session_id, label:str≤64 (may be empty), api_contract:1}` — CONFIG-WRITE: requires `captured`
   (`capture_not_ready`), label via `text_field` (`invalid_text`), user still at the session revision (`revision_conflict`,
   session dropped), number not already on the user (`card_conflict`, dropped); then `manager.async_update(user, {"cards": [...
   existing {id,label,enabled}..., {card_no, label, card_type:"normalCard", enabled:true}]}, revision=session.revision)` with
   `sync_now` default **true** → immediate reconciliation queue → the card is written to the person's assigned stations and
   **grants physical access** there. Session always dropped afterwards. Returns person public. WisKey audit action
   `cards/capture_confirm`.
6. `cards/capture_cancel {session_id}` → `{cancelled:true}`; unknown id = no-op; during confirm → `capture_applying`. It drops the
   session and cancels the collector (aborting the HA-side GET). Also triggered in WisKey's UI on close / station change /
   "collect again". Sessions are also dropped when a station detaches.

**What the device and the door do meanwhile** — facts and gaps:
- WisKey sends NO relay command in capture; nothing in the capture path opens a door. The door stays under the station's normal
  rules. WisKey's own copy (`capture_hint`, i18n.ts:1403): "An already authorized card may still operate the lock under the
  station's existing rules." Whether presenting an ALREADY enrolled card during collection both gets captured and opens the door:
  **UNVERIFIED**.
- "Closing stops HA collection; the device's reader timeout is firmware-controlled." (`capture_limits`, i18n.ts:1411) — after
  cancel/timeout the reader may stay in collection mode until its own firmware timeout: **UNVERIFIED duration**.
- The same string ends "Physical collection still needs commissioning." — i.e. WisKey's author has not verified capture on real
  hardware. **UNVERIFIED end-to-end; a lab test with the owner is mandatory before release** (CLAUDE.md device rule: task-specific
  approval for the live test).

**Refused vs unknown**
- `cards/reader_capabilities`: READ — errors are plain read failures.
- `cards/capture_start`: everything in `start()` runs BEFORE the collector task is created (B:enrollment.py:71-92), so
  **refused (pre-device)**: `PRE_DISPATCH`, `unauthorized` (empty actor), `manager_closed`, `station_not_found`, `station_offline`,
  `station_has_no_managed_lock`, `user_not_found`, `revision_conflict`, `invalid_fields`, `capture_station_busy`, `capture_limit`.
  **Unknown**: `action_failed`, `device_unavailable` (not raised by `start()` — unproven), timeout, lost session, reply without a
  string `session_id`. Consequence of unknown: a session we cannot see may exist and block that station for up to 120 s (the
  next start there answers `capture_station_busy`); UI: "outcome unknown — the reader may be waiting for up to 2 minutes; no card
  will be added without your approval".
- `cards/capture_confirm` (effect = storage): **refused**: `PRE_DISPATCH`, `capture_not_found`, `capture_not_ready`,
  `invalid_text`, `user_not_found`, `revision_conflict`, `card_conflict`, plus every pre-storage code of `users/update` (A.4:
  `card_removal_pending`, `card_capacity`, `card_exceeds_capabilities`, `invalid_cards`, `duplicate_card`, `station_*`,
  `storage_stopping`…). **Unknown**: `storage_write_failed`, `manager_closed`, `action_failed`, timeout → re-read the person and
  look for revision+1 and a new card whose masked suffix equals the captured one. WisKey's own UI state for this is
  `unconfirmed` ("The save result is unconfirmed… inspect the user and Sync before starting again").
- `cards/capture_cancel`: cleanup; never refused by SMPLWISE's own permission once the session belongs to the caller; audit one
  row. `capture_applying` = "confirm in progress".

**SMPLWISE endpoints for capture**

| Method + path | Body | Permission | Guard |
|---|---|---|---|
| GET `/intercom/stations/{sid}/card-readers` | — | `access.cards.capture` | read (40 s) |
| POST `/intercom/people/{id}/card-capture` | `{station_id, reader_id:StrictInt 0..8, revision:StrictInt, confirmed, client_request_id, expires_at}` | `access.cards.capture` + `access.people.manage` | the capture dialog's Start button is the confirmation (`confirmed:true` server-enforced, like `ReleaseBody`); station must be in the served copy, online, `lock_enabled`; attempt/outcome audit; action lane; SMPLWISE records `session_id → (smplwise_user, station, person, started_at)` |
| GET `/intercom/card-capture/{session_id}` | — | same, and session owned by caller (else 404) | read; mostly superseded by `intercom_capture` ws notices from a backend poller (0.3) |
| POST `/intercom/card-capture/{session_id}/confirm` | `{label≤64, confirmed, client_request_id, expires_at}` | `access.cards.capture` + `access.people.manage` | `sw-dialog`: "Add the collected card (•••• NNNN) to {name} and synchronize their existing assignments?"; config lane; the audit row records only `cards_added: 1`, never digits |
| POST `/intercom/card-capture/{session_id}/cancel` | `{}` | owner of the session | also sent by the backend when the owning browser's ws closes or the dialog is left; audit one row |

UI states to port (X:1037-1043; i18n `capture_state_*`): `choose` (client) → `preparing` → `waiting` ("Present one card to the
selected station now.") → `captured` (masked number + technology, label input, "Existing station assignments" list) →
`applying` → done; `error` (+ "Collect another card" re-reads capabilities); `unconfirmed` (client, after a confirm with unknown
outcome). Show a countdown (70 s collection / 120 s session). Station select disabled once started. `capture_revision_changed`
alert when the person's revision moved (compare with the feed's refresh). Missing WisKey translations to add ourselves:
`capture_state_applying`, `capture_state_expired`, `capture_state_cancelled`, `manager_closed` (X:1530-1536).

### A.8 Suggested slicing
- **A1 editor core**: projection + context, identity/phone/active, validity `always|period`, PIN (set/remove/generate/check),
  typed + USB cards, assignments/overrides/locks, profile fields/groups/templates (no photo), create/update/delete, duplicate
  check, audit + envelope + config lane.
- **A2 card capture** (PHYSICAL, own review cycle + lab session).
- **A3 optional**: weekly/dates timing with `ha`/`native` enforcement + readbacks (`hikvision-user-timing` port, X:2534-2596);
  photo (Q6/Q7).

---------------------------------------------------------------------------------------------------------------------

## 2. Screen B — Door / station technical settings (home of door programs and relay reversal)

### B.1 Purpose, entry points, layout
Per-station management page (X:1130-1175) with station tabs `overview | programs | public_codes | settings` (he: סקירה / תוכניות
פתיחה / קודים ציבוריים / הגדרות). Entry: the entry center's station card ("station details") and a WisKey sub-nav "Doors"
(`#/wiskey/doors/:stationId/:tab`). One station at a time (WisKey 04 behaviour).
- **overview**: identity (model/firmware/host are stations-area data — keep them out of `access.read` unless the owner wants
  them), relays 1-2 configured/not + name · API id, per-relay release (already built: reuse the release dialog), counts, clock
  and capability details (read), rescan / sync station (config; optional, not requested).
- **programs**: port `wiskey-door-programs` (X:4671-4720).
- **settings**: port `hikvision-station-technical` mode `settings` (X:4618-4668): "Read settings" button (no auto-read), relay
  editor (see Q9), one door editor per DoorParam door.
- **public_codes**: out of scope for this brief (Q9).

### B.2 Station technical settings — behaviour to port
- Read (`technical_get`) is manual; the whole report and all drafts are discarded after ANY write failure (`technical_write_unknown`
  "Change not confirmed. Read the station before retrying."). State resets on station change.
- Door editor fields are generated from `door.constraints`: `doorName` text (min..max ≤64, no control chars), `openDuration`
  integer (min..max ≤255 s), `relayReverseEnabled` boolean (only if `@opt` is `true,false`). Editable only if the door's API id is
  in `integrated_locks[].api_id`; else `technical_unmanaged`. Managed door: confirmation checkbox `technical_confirm` ("Apply these
  settings. Reversing the relay may change the physical lock state.") + Save; any edit resets that door's confirmation.
- Door read errors per door (`{door, error}`) and `password_error` are shown, not fatal. Unmanaged doors are still read.

### B.3 WisKey commands used by Screen B

| Command | Payload | Reply | Class | WisKey perm | Errors |
|---|---|---|---|---|---|
| `stations/technical_get` | `station_id`, `api_contract:1` | `{checked_at, doors:[{door:1\|2, values:{doorName?, openDuration?, relayReverseEnabled?}, constraints:{…}} \| {door, error}], passwords: null\|{states, public_pin_state}, password_error, features:[{family,name,supported}], relay_selection:<entry.data.locks: [{physical_index, api_id, confirmed, name?}]>}` | READ (device; holds technical busy slot; ≤75 s) | stations:view | `station_unloaded, device_busy, device_unavailable, action_failed` |
| `stations/technical_update` | `station_id, door:int` (**API id**, must be a managed `api_id`), `expected:dict` (ALL values as read, deep-equal), `changes:dict` (non-empty ⊆ doorName/openDuration/relayReverseEnabled), `confirmed:bool` (must be true), `api_contract:1` | `{door, values, constraints}` (fresh readback) | CONFIG-WRITE device (`PUT /ISAPI/AccessControl/Door/param/{door}` XML with only changed nodes); `relayReverseEnabled` = PHYSICAL | stations:manage | below |
| `stations/technical_program_list` | `station_id`, `api_contract:1` | `{programs:[{station_id, door, api_id, revision, policy, enabled, removing, execution:{owned, attempted, status}, error, checked_at}], saved:[legacy drafts], timezone:<HA tz>, native_supported:false}` | READ (storage only, but takes the technical busy slot) | stations:view | `station_unloaded, device_busy` |
| `stations/technical_program_save` | `station_id, door:int` (**physical_index**), `revision:int` (0 new / current), `policy:{timezone:IANA≤64, schedule:{name≤32, weekly:{Monday..Sunday:[{start,end}]} (exactly 7 keys), holidays:[{name≤32 non-blank, start, end, periods}] ≤64}}`, `enabled:bool`, `api_contract:1` | `{programs:[…]}` | `enabled:true` PHYSICAL (scheduled); `false` CONFIG-WRITE storage | stations:manage | below |
| `stations/technical_program_action` | `station_id, door:int` (physical), `revision:int`, `action:"pause"\|"remove"`, `api_contract:1` | `{programs:[…]}` | PHYSICAL (immediate `close` if the program owns a hold) + storage | stations:manage | below |
| `stations/technical_hold_delete` | `station_id, door, revision` | `{deleted:true}` | CONFIG-WRITE storage (legacy draft) | stations:manage | `revision_conflict, operation_unsupported, invalid_storage` |
| `stations/technical_relays` | `station_id, expected:list (== entry.data.locks), locks:[{physical_index, api_id, confirmed:true, name?}]` | `{reload_required:true}` | CONFIG-WRITE HA config entry + **integration reload** | stations:manage | `revision_conflict, operation_unsupported, hold_pause_before_edit, access_removal_pending` — deferred (Q9) |

Policy validation (B:access/hold_open.py `policy`, B:access/schedules.py `normalize`/`periods`): keys exactly `{timezone,
schedule}` / `{name, weekly, holidays}`; periods ≤8 per day, `HH:MM`, end may be `24:00`, start<end, sorted, no overlap
(touching allowed); dates `YYYY-MM-DD` 2000-2037, holiday ranges non-overlapping. Errors `invalid_fields, invalid_timezone,
invalid_text, schedule_invalid_week, schedule_period_limit, schedule_invalid_time, schedule_overlap, schedule_invalid_date,
schedule_holiday_limit, schedule_holiday_overlap`. UI quirks to keep/fix: Sunday-first UI order; end `00:00` entered = `24:00`;
"all day" = 00:00-24:00; date exceptions named "Date" by WisKey (backend needs non-blank ≤32 — we may let the user name them).

**Id pitfall**: `technical_update` uses the **API door id**; `technical_program_*` and `test_unlock` use the **physical index**.
SMPLWISE's station projection currently keeps only `physical_index` + name; this screen needs `api_id` too (from
`integrated_locks` or `relay_selection`).

### B.4 Refused vs unknown for Screen B writes (verified in B:technical_api.py, B:client/technical.py, B:access/hold_programs.py)
- `stations/technical_update` (effect = DoorParam PUT): **refused**: `PRE_DISPATCH`, `device_busy` (entry only),
  `operation_unsupported` (door not a managed api_id — checked before `update_door`), `invalid_fields` (`confirmed` not true;
  schema). **Unknown**: `station_unloaded` (also raised after the PUT), `device_unavailable` (covers BOTH pre-PUT validation —
  `expected` mismatch "Door parameters changed; reload before saving", field not advertised, out of bounds, empty changes — AND
  PUT failure AND "Technical change not confirmed by readback"), `action_failed` (40/75 s timeouts), lost session. To keep
  "unknown" rare, SMPLWISE pre-validates `changes` against the constraints it served and refuses locally (`not_sent`). After ANY
  unknown: discard drafts and require a fresh `technical_get` (WisKey does the same).
- `stations/technical_program_save` (effect = program stored; with `enabled:true` the 15-s timer then actuates): **refused**:
  `PRE_DISPATCH`, `device_busy`, `operation_unsupported` (no runtime lock with that physical index, or `verify_hold_support`
  failed — both before `programs.update`), all policy-validation codes above, `revision_conflict` and `hold_pause_before_edit`
  and `schedule_limit` (checked under the program lock before `persist`), `device_unavailable` (only the pre-persist identity /
  RemoteControl-capability reads touch the device when `enabled:true`; nothing device-side follows `persist`), `storage_stopping`.
  Note: a post-persist `revision_conflict` could only come from deleting a legacy hold draft, and every `technical_*` command for
  the station is serialised by the `technical_busy` set, so it cannot race — reviewer should re-confirm this reading.
  **Unknown**: `station_unloaded` (exit check), `storage_write_failed`, `action_failed`, timeout. After unknown → re-read
  `technical_program_list`.
- `stations/technical_program_action` (effect = `enabled:false` stored, then an immediate tick that sends `close` if owned):
  **refused**: `PRE_DISPATCH`, `device_busy`, `invalid_fields` (action not pause/remove), `revision_conflict` (before persist).
  **Unknown**: `station_unloaded`, `storage_write_failed`, `action_failed`, timeout.
  **Critical**: the tick's failures are SWALLOWED (B:hold_programs.py `tick_key`: `except Exception` → persists
  `error:"technical_write_unknown"` and returns), so the command replies `success:true` even when the `close` failed. SMPLWISE's
  projection must inspect the returned program for that door: record gone (remove + not owned) → closed/acknowledged; `enabled:false,
  execution.owned:false, status:"idle"` → restore acknowledged (physical state unverified); `error:"technical_write_unknown"` or
  `status ∈ {"unknown","restoring"}` or `removing:true` still present → **restore outcome unknown** (WisKey retries `close` every
  15 s while `removing`; a paused program with an unknown close is NOT retried — re-reading shows it). Never report a pause as
  "door locked".

### B.5 What scheduled door programs physically do
- Stored in WisKey (`.storage/hikvision_intercom.hold_programs`, one per station/physical door) and executed by an HA timer every
  **15 s** (`async_track_time_interval`, B:access_runtime.py:156-183; overlapping ticks skipped; Semaphore 3). No device-side
  schedule is written (`native_supported:false`).
- Each tick, for an enabled program: compute the window token `YYYY-MM-DD/start/end` in the program's time zone (holiday entry
  overrides the weekday). Entering a window → persist intent (`owned:true, status:"opening"`) BEFORE I/O → `PUT
  /ISAPI/AccessControl/RemoteControl/door/{api_id}` `<RemoteControlDoor><cmd>alwaysOpen</cmd></RemoteControlDoor>` (identity
  confirmed, `verify_hold_support` requires `cmd@opt ⊇ {alwaysOpen, close}`; every `statusCode` must be "1" else
  `ambiguous_write`) → `held_acknowledged`. The door is **held unlocked** for the whole window. Leaving the window, pause, remove,
  lock-mapping/identity change, or HA restart while owned → `close` (`restoring` → `idle`). "close" vs "resume": WisKey uses only
  `alwaysOpen`/`close`; whether `close` returns the door to the station's own normal schedule or forces it locked is
  **UNVERIFIED** (WisKey doc: `resume` semantics not assumed, X:5009).
- Timing: `program_save` with `enabled:true` does NOT tick immediately — first `alwaysOpen` ≤15 s later if now is in a window
  (X:5338). `program_action` ticks immediately.
- Failure semantics (from source, X:5039-5043): a failed/unknown open is followed by `close` on the next tick and NOT re-opened in
  the same window; after an HA restart while owned the first tick sends `close` and the door is not re-held until the next
  window; back-to-back windows produce `close` then `alwaysOpen` ~15 s later. **If HA or the network is down at the window end
  the door stays held open** (`hold_dependency`: "During an outage the door may remain unlocked until communication returns").
- WisKey's confirmation = ISAPI statusCode "1" only; UI text "Hold-open command acknowledged; physical state not verified."
- Safe read-back: `technical_program_list` (storage only, no device I/O) → `execution.status ∈ idle | opening |
  held_acknowledged | restoring | unknown`, `owned`, `error`, `checked_at` ("Last transition recorded"). Plus our camera still.
  No WisKey command reads the door's actual hold state from the device (**UNVERIFIED** whether the HA `lock` entity reflects it).
- Edit rules: an enabled / owned / removing program cannot be saved (`hold_pause_before_edit`); WisKey's edit flow = confirm
  `program_edit_pause` → `action:"pause"` → open editor with the returned (paused) program → "Save and activate" or "Save without
  activation". There is no resume action: reactivation = save with `enabled:true`. One program per door.

### B.6 What relay reversal physically does
- `relayReverseEnabled` is a Hikvision DoorParam boolean that inverts the relay's rest state (normally-open ↔ normally-closed
  logic). It is applied by `PUT /ISAPI/AccessControl/Door/param/{door}` and WisKey then reads DoorParam back and requires the
  values to equal the desired set (otherwise `device_unavailable`, i.e. unknown). The change is expected to act **immediately**
  on the relay output: depending on how the lock is wired (fail-safe vs fail-secure, NO vs NC contact) the door can become
  **continuously unlocked** or continuously locked until reversed back, and every later release inverts too. Exact effect on the
  lab station: **UNVERIFIED** — WisKey only warns "Reversing the relay may change the physical lock state."
- How WisKey confirms it: the readback of the stored parameter only (not the physical relay).
- Safe read-back: `stations/technical_get` → `doors[].values.relayReverseEnabled` (READ). Plus a camera still of the door.
- `openDuration` changes the length of every future release (config, not an actuation); `doorName` is cosmetic.
- Recommendation: never send `relayReverseEnabled` in the same `changes` as `doorName`/`openDuration`; a separate endpoint,
  permission and dialog.

### B.7 Proposed SMPLWISE endpoints (Screen B)

| Method + path | Body | Permission | Confirmation / guard |
|---|---|---|---|
| GET `/intercom/stations/{sid}/technical` | — | `access.doors.manage` | read, 80 s; projection keeps `features`, `passwords.public_pin_state` + slot booleans, doors, `relay_selection` |
| POST `/intercom/stations/{sid}/doors/{api_id}/settings` | `{expected:{…}, changes:{doorName?, openDuration?}, confirmed, client_request_id, expires_at}` | `access.doors.manage` | per-door confirm checkbox → `confirmed:true` (WisKey requires it too); local constraint check; refuse `relayReverseEnabled` here; config lane; audit old/new values (non-secret) |
| POST `/intercom/stations/{sid}/doors/{api_id}/relay-reverse` | `{expected:{…}, value:StrictBool, confirmed, client_request_id, expires_at}` | `access.doors.physical` | `sw-dialog` (danger): "The relay's rest state will be inverted immediately. The door may stay unlocked (or locked) until you reverse it back. Check the camera."; server-enforced `confirmed:true`; station online in the served copy; per-station guard like `_RelayGuard` (one technical write per station, held 10 s after unknown); attempt/outcome audit; reply includes the readback `values` |
| GET `/intercom/stations/{sid}/programs` | — | `access.read` (Q3) | read; takes WisKey's busy slot → handle `device_busy` as "station busy, retry" |
| PUT `/intercom/stations/{sid}/programs/{door}` | `{revision:StrictInt, policy, enabled:StrictBool, confirmed, client_request_id, expires_at}` | `enabled:false` → `access.doors.manage`; `enabled:true` → `access.doors.physical` | activation dialog lists the windows + time zone + `hold_dependency` + "starts within 15 s if now is inside a window"; `confirmed:true` required only when `enabled:true`; local policy validation (same rules as WisKey); audit the policy (not secret) |
| POST `/intercom/stations/{sid}/programs/{door}/pause` | `{revision, confirmed, client_request_id, expires_at}` | `access.doors.physical` (Q4) | dialog `program_pause_confirm`; reply projected per B.4 "Critical" |
| POST `/intercom/stations/{sid}/programs/{door}/remove` | same | same | dialog `program_remove_confirm` |
| POST `/intercom/stations/{sid}/programs/{door}/legacy-draft/delete` | `{revision, confirmed}` | `access.doors.manage` | dialog `program_delete_saved_confirm` ("No station command will be sent.") |

UI copy to carry (i18n he exists in R:frontend/src/i18n.ts ~1910-2076): `program_active`, `program_inactive`, `program_removing`,
`program_idle`, `program_opening`, `program_held_acknowledged`, `program_restoring`, `program_unknown`, `program_end_hint`,
`hold_dependency`, `technical_intro`, `technical_confirm`, `technical_unmanaged`, `technical_write_unknown`. Execution status
changes only on refresh (WisKey has no push for them; `changed()` is not called by the timer) — poll `programs` every 15 s while
the tab is open and a program is enabled/owned, within the read budget.

### B.8 Suggested slicing
- **B1** station page shell + settings read + `doorName`/`openDuration` write (config).
- **B2** relay reversal (PHYSICAL, lab test).
- **B3** door programs list/editor/activate/pause/remove (scheduled PHYSICAL; lab test across a real window boundary).

---------------------------------------------------------------------------------------------------------------------

## 3. Cross-cutting implementation notes
- `intercom_client.py`: one typed function per command above; writes use a new `_write_result(frame, command)` = the same shape
  as `_action_result` with a per-command `PRE_EFFECT` allow-list (tables A.4, A.7, B.4). Keep `PRE_DEVICE` for the three existing
  commands unchanged.
- `intercom_sync.py`: per-command timeout on `_execute`; config lane; capture poller + `intercom_capture` notices; editor
  projections kept out of `project_person` / `project_overview`; add `api_id` to the station data only where Screen B needs it.
- Tests: extend `frontend/tests/fixtures/wiskey_fake_ha.py` (today it only fakes `overview`/`subscribe` + actions) with the new
  commands and their error codes, including the "success:true but program.error = technical_write_unknown" case and capture state
  progression; backend tests in `smplwise_vms/backend/tests/test_intercom.py`.
- CR-005 needs recorded deviations for: the new permission names (if the owner picks them), capture moving out of
  `access.release`, the editor projection (privacy), and any feature cut (timing/photo/public codes/relay mapping).
- Out of scope here: two-way audio (own task), WhatsApp (lives in person details; separate slice), public codes, relay mapping,
  CSV/bulk/import, schedule library/deployment.

## 4. Open questions for the owner
1. Who may edit people (create/edit/delete, PINs, cards)? (a) new/CR-005 `access.people.manage`, site_admin + system_admin only
   (recommended); (b) also `editor`; (c) also `operator`.
2. Card capture permission: (a) its own `access.cards.capture` + people.manage (recommended); (b) under `access.release` as CR-005
   §3 wrote; (c) people.manage alone.
3. Door physical permission: (a) one `access.doors.physical` for program activation/pause/remove + relay reversal (recommended);
   (b) two separate permissions (programs / relay); and may every `access.read` holder see the programs list? (c) yes (d) no,
   doors.manage only.
4. Pausing/removing a program sends `close` (restores the door): (a) same permission as activation; (b) also allowed to
   `access.release` holders, so a guard can stop a hold-open.
5. Card numbers: WisKey never returns full numbers after save. For the editor: (a) show masked `•••• 1234` (recommended);
   (b) show only label/count, no digits at all.
6. Photos: (a) out of scope, show only "has photo" (recommended for now); (b) show the stored photo read-only; (c) full camera
   capture (needs HTTPS/secure context on the SMPLWISE page).
7. Access timing: (a) first slice = permanent / date-range only (recommended); (b) + weekly/dates enforced by HA; (c) full incl.
   station-native schedules.
8. Live PIN availability check (`pin_check` reveals whether a PIN is used by someone): (a) keep it with a tight per-user limit
   and audit; (b) drop it, rely on save-time `pin_conflict` + "generate unique PIN" (recommended).
9. Relay mapping (`technical_relays`, reloads WisKey) and public codes on the same station page: (a) read-only for now
   (recommended); (b) build their writes now.
10. First live tests of capture, relay reversal and program activation on the real station: (a) owner physically at the door
    for each (recommended); (b) camera-still verification from SMPLWISE only.

## 5. Size estimate (in review rounds; tonight: 1-2 reviews ≈ 1.5-3 h per screen; first physical release = 5 rounds)

| Slice | Class | Review rounds | Time |
|---|---|---|---|
| A1 editor core | config-write, PII projection, large form port (~480 lines of panel.ts render + 100 of save/validation) | 3-4 | 6-8 h |
| A2 card capture | first long-running physical interaction (sessions, poller, ownership map, unknown states) | 4-5 | 6-9 h + lab |
| A3 timing weekly/dates + photo (optional) | config-write | 2-3 | 3-5 h |
| B1 station page + DoorParam name/duration | config-write device | 2 | 2.5-3.5 h |
| B2 relay reversal | physical | 2-3 (reuses A2/B1 patterns) | 2.5-4 h + lab |
| B3 door programs | scheduled physical, swallowed-error reply | 3-4 | 5-7 h + lab |
| **Total** | | **16-21** | **~25-36 h** (≈ 3-4 working sessions) |

Owner priority order means A1 → A2 first (≈ 12-17 h), then B1 → B3 → B2 (programs before relay if the owner prefers; the order
inside B is free).

## 6. UNVERIFIED items (must not be smoothed over)
1. The add-on HA user holds WisKey `users:manage` + `stations:manage` (else every write = `unauthorized`).
2. Capture on real hardware — WisKey's own string says "Physical collection still needs commissioning".
3. Whether an already-enrolled card presented during capture also opens the door; reader state after cancel (firmware timeout).
4. Electrical effect of `relayReverseEnabled` on the lab door (unlock vs lock at rest) and that it acts immediately.
5. `close` vs station "normal control" after a hold-open; whether the HA lock entity shows the held state.
6. `storage_write_failed` atomicity (treated as unknown).
7. Post-persist `revision_conflict` impossibility in `technical_program_save` (argued from the `technical_busy` serialisation).
8. Round-trip times of `technical_get` / `technical_update` on the lab stations vs ha_client's 60 s limit.
