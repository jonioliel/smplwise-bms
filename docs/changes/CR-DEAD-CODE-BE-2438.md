# CR-DEAD-CODE-BE-2438 - backend dead code: delete only what nothing references

Branch `pilot/CR-DEAD-CODE-BE-2438` (from `origin/main` @ 0a8fb55e1). No version bump, no merge, no tag. Backend (Python) only:
the frontend items of MASTER_PLAN section 5.4 / 5.5 wait for `AUDIT30-COMBINED-2435`. No device, NVR, go2rtc or HA was contacted.

## Why

Code review 2026-11-13, MASTER_PLAN section 5 (dead-code list; findings 01:F-12, 01:F-22, 02:P2-11, 02:P2-12, 02:P3-6, 03:F24,
04:F13, 04:F19, 04:F23). Owner decisions 14.11 (round 32):

- **Q-CODE-1 / O10 a** - delete ONLY code verified to have no reference at all; code used only by tests stays.
- **Q-CODE-2 / O15 a** - code built ahead for a feature without a screen stays and gets a comment naming the task that will use it.

## How each candidate was verified (on the current tree, not on the review's v2.43.4)

1. `git grep -w <name> origin/main` over the WHOLE repository (`smplwise_vms/` incl. `backend/tests`, `integration/`,
   `custom_components/`, `scripts/`, `management/`, `docs/` incl. `docs/api`, templates, JSON / YAML) except `legacy/` and
   `private/`. A word match also finds string uses (`getattr(x, "name")`, registry dicts, route names). The dynamic lookups that
   exist in the backend (`getattr(self, f"_op_{op}")`, `"_h_" + command`, `importlib.import_module(f"smplwise.services.{name}")`
   in `startup_warmup`) were checked: none can reach a deleted name.
2. Mentions only in `docs/changes/*` / `docs/superpowers/plans/*` / `docs/design/*` (history and plans of the time) were not counted
   as references.
3. Every pending branch (`git branch -r --no-merged origin/main`, all `*-2435` ... `*-2438` incl. `CR-WAVE1B-COMBINED-2436`,
   `AUDIT30-COMBINED-2435`, `release/2436-train`): the added AND removed lines of `git diff origin/main...<branch>` were searched
   for every name; no pending branch starts (or stops) using any of them. Pending branches that edit the same files touch other
   hunks (nearest: `BACKEND-SAFETY-2435` edits `recorders/provision_events.py` 3 lines below the removed `push_states`;
   `CR-RBAC-EVAL-2438` / `TICKETS-PERF-ERASE-2435` edit `tickets/store.py` / `store_rfq.py`, `CR-WK-LIMITS-2438`
   `wiskey_schedule_writes.py`, `CR-BILL-LEDGER-A-2436` / `OWNER-R32-BACKEND-2438` / `CR-WAVE1B-COMBINED-2436` `energy_billing.py`
   and `cast_sessions.py` - all far from the removed lines).
4. After deleting, imports and module constants that only the deleted code used were removed too (ruff F401, and a word count of
   every name the deleted lines used that is defined in the touched file).

## Table

Paths are relative to `smplwise_vms/backend/smplwise/services/` (`tickets/` = `services/tickets/`).

### Section 5.1 - "no reference anywhere"

| Name | File | Verdict |
|---|---|---|
| `parse_key` | `tickets/assignees.py` | deleted |
| `with_subject` | `tickets/channel_email.py` | deleted (+ the now unused `dataclasses.replace` import) |
| `WhatsAppChannel.account_connected` | `tickets/channel_whatsapp.py` | deleted (+ unused `CONNECTED` import) |
| `png_scan` | `tickets/image_intake.py` | deleted (`png_layout` stays, used) |
| `is_whatsapp` | `tickets/rfq_inbound.py` | deleted |
| `has_event_since` | `tickets/store.py` | deleted |
| `pending_count_for_link` | `tickets/store_costs.py` | deleted (`pending_usage_for_link` stays, used) |
| `access_counts` | `tickets/store_links.py` | deleted |
| `vendors_of_contact`, `quotes_of_rfq`, `outbox_count_of_rfq` | `tickets/store_rfq.py` | deleted |
| `visits_of_vendor` | `tickets/store_visits.py` | deleted |
| `kinds_in` | `tickets/stuck.py` | deleted (+ unused `Iterable` import) |
| `floor_cameras` | `access.py` | deleted |
| `_doors_of` | `access_grant_engine.py` | deleted |
| `_revocation_pending` | `access_station_permissions.py` | deleted (+ unused `inspect` import) |
| `_door_label` | `door_window_triggers.py` | deleted |
| `shares_from_floor`, `shared_zone_floors`, `anchor_in_room`, `editor_placement` | `shared_spaces.py` | deleted |
| `try_parse` | `wiskey_access_state.py` | deleted |
| `send_installed_template_v3` | `wiskey_auto_install.py` | deleted (superseded: `wiskey_wa_queue` sends `template_send_v3` itself; `read_template_outcome_v3` stays, used) |
| `project_object` | `wiskey_media_contract.py` | deleted |
| `bindings_ok` | `wiskey_schedule_writes.py` | deleted (the route validates bindings with its pydantic `Bindings` model) |
| `forget_bearer_user`, `_bearer_principal` | `ha_user_auth.py` | deleted (shims whose callers are gone) |
| `failures_blocked` | `app_refresh.py` | deleted |
| `count_attempt`, `bridge_text` | `capture_lease.py` | deleted (+ `MAX_BRIDGE_TEXT`, `BRIDGE_TEXT`, used only by `bridge_text`) |
| `paused_jobs` | `exports.py` | deleted |
| `rebuild_from` | `media_store.py` | deleted |
| `polyline_length_px` | `plan_geometry.py` | deleted |
| `FrigateAdapter.review_summary`, `FrigateAdapter.recording_snapshot` | `recorders/frigate.py` | deleted |
| `push_states` | `recorders/provision_events.py` | deleted |
| `find_zone` | `alarm.py` | deleted |
| `Access.wide_manage_all` | `automation_scope.py` | deleted |
| `has_tags` | `building_presence.py` | deleted |
| `_index_put` | `cast_sessions.py` | deleted |
| `is_activity_domain` | `device_activity.py` | deleted |
| `set_ocr_reader` | `docread/service.py` | **kept: built-ahead** - CR-OCR119 tier 2 (OCR reader slice; `docs/changes/CR-SUPPLIERDOCS-297.md` q53); comment added |
| `_days_text` | `emergency/engine.py` | deleted |
| `ComputeError` | `energy_billing.py` | deleted |
| `iso_to_epoch` | `energy_meters.py` | deleted |
| `Definition.day_type_name`, `Definition.season_index` | `energy_tou.py` | deleted |
| `Account.account_value` | `messaging_accounts.py` | deleted |
| `janitor_stats` | `mobile_push.py` | deleted (`relay_health` stays, used by `GET notify/stats`) |
| `audience_of` | `notices/display.py` | deleted (+ unused `audience as aud` import) |
| `source_info` | `notify_policy.py` | deleted |
| `clear_tmp` | `offbox_runtime.py` | deleted (+ unused `shutil` import) |
| `to_hex` | `palettes.py` | deleted |
| `as_provider` | `transit/provider.py` | deleted |
| `conn_registry` | `wa_template_v2_flow.py` | deleted |
| `last_hello` | `wall.py` | deleted |
| unused import `files as distribution_files` | `bridge_install.py` | deleted |
| `_DeadlineBackend.connect_unix_socket` | `connection_probe.py` | kept: interface method httpcore calls by name (plan's keep list) |
| `OAuthFlow` | `offbox_gdrive.py` | kept: Protocol documenting the flow's interface (plan's keep list) |
| `unused_uuid` | `rules.py` | kept: plan's keep list (no reference, named so on purpose; lead to decide) |
| `urllib_transport` | `transit_realtime/stride.py` | deleted (second Stride client; production uses `transit/stride.http_fetch`; + unused `json` / `urllib` imports) |
| `enqueue_fired` | `push.py` | deleted (no caller at all; its docstring named a `rules.deliver_pending` call that does not exist) |
| `notice_from_fired` | `push.py` | deleted (its only user was `enqueue_fired`; no test uses it); module docstring updated |
| `plan`, `PushNotifier.enqueue` | `push.py` | kept: test-only (`tests/test_push.py`) |
| `_push` payload | `rules.py:179`, popped `:231-232` | kept: referenced (built and popped by `rules.py`; `tests/test_push.py:257`, `:375` assert it never leaves the delivery). Its last reader was `notice_from_fired`; dropping it is a behaviour edit for a later branch, not dead-code removal |
| `if False` arm | `emergency/service.py:149` | deleted: `X if False else Y` is now `Y` (same value; `merged_thresholds` stays, used 7 times) |
| second `ssid_hash` | `presence.py:940` | deleted: identical body redefined the first (`:436`, ruff F811); its contract reference moved into the first docstring |
| refusal branch behind a constant | `routers/access_grants.py:333-337` | kept (owner O9 a) |
| re-exports `POLICY_KEYS`, `PRESENCES`, `REMOVAL_QUEUES`, `ROW_KEYS`, `SCHEDULE_KEYS`, `SYNC_STATES` | `wiskey_acr5.py` | deleted from the import (no reader through `wiskey_acr5`, no test) |
| re-exports `QUEUES`, `AccessState`, `Assignment`, `PendingQueues`, `policy_ok`, `schedule_ok` | `wiskey_acr5.py` | kept: used in the module (and tests read `AccessState`, `PendingQueues`, `schedule_ok` through it) |
| `old_lines` parameter of `resend` | `tickets/rfq_orders.py:406-410` | kept: referenced (`rfq_terms.py` passes it at 3 call sites) |
| seven "commented-out" lines | `tickets/channel.py:84`, `messaging.py:683`, `:848`, `phone_verify.py:222`, `public_claims.py:68`, `staff_links.py:148`, `store_costs.py:74` | kept: all are prose (section headers / comments), not code |

### Section 5.2 - "referenced by tests only" (re-verified: all kept)

| Name | File | Verdict |
|---|---|---|
| `ChannelRegistry` | `tickets/channel.py` | kept: test-only |
| `MemoryOutboxStore`, `assignment_code_check`, `code_request_check` | `tickets/outbox.py` | kept: test-only |
| `MemoryDedupe` | `tickets/inbound.py` | kept: test-only |
| `OutboxCodeSender` | `tickets/messaging.py` | **deleted**: the list said test-only, but no test and no code uses it (only the module docstring and a comment saying it "stays unused"; slice 7's `code_flow.SqlCodeSender` replaced it); docstring and comment updated |
| `NoCodeChannel` | `tickets/public_store.py` | kept: test-only |
| `assemble_documents` | `tickets/cost_files.py` | kept: test-only |
| `signal_severity` | `tickets/hours.py` | kept: test-only |
| `whatsapp_on` | `tickets/intake.py` | kept: test-only |
| `verify_token` | `tickets/links.py` | kept: test-only |
| `has_tokens` | `tickets/naming.py` | kept: test-only |
| `sanitized_rfq` | `tickets/portal_more.py` | kept: test-only |
| `ticket_rows_left` / `rfq_rows_left` | `tickets/store.py` / `tickets/store_rfq.py` | kept: test-only |
| `hidden_characters`, `csv_row` | `tickets/text_hygiene.py` | kept: test-only |
| `may_share_history` | `tickets/policy.py` | kept: test-only |
| `resolve_share_history` | `tickets/device_context.py` | kept: test-only |
| `capability_ok`, `access_state_request`, `revocation_evidence_at` | `wiskey_acr5.py` | kept: test-only |
| `presence_diagnostic` | `wiskey_acr5.py` | kept: built-ahead - ACR5-03 ("externally deleted person" acknowledgement, decision (a) open); comment added |
| `normalize_request`, `grant_policy_proven` | `wiskey_acr5.py` | kept: built-ahead - ACR5-02 in `access_grants._policy_is`; comment added |
| `parse_feature_plan` | `wiskey_acr5.py` | kept: built-ahead - ACR5-04 feature dry plans; comment added |
| `read_installation`, `installation_state` | `wiskey_auto_install.py` | kept: test-only |
| `write_resources`, `read_resources` | `wiskey_auto_install.py` | kept: built-ahead - SOURCE-CLOUD-EXPORT (BLOCKED, `docs/changes/WISKEY-ADOPT-2272.md`); comment added |
| `intent_state`, `set_feature_enabled`, `record_host_registration` | `wiskey_feature_exec.py` | kept: test-only |
| `resolve_intent` | `wiskey_intents.py` | kept: built-ahead - W-010 recovery caller of an UNKNOWN intent (`ADOPTR6-295-ADOPTION-RECEIPT.md`); comment added |
| `peer_result_class` | `wiskey_peer.py` | kept: test-only |
| `encode_pin` | `wiskey_peer_registry.py` | kept: test-only |
| `read_capabilities_v2` | `wiskey_installed_features.py` | kept: test-only |
| `DirectJoin.registry_or_none`, `DirectJoin.resolve_or_none` | `wiskey_direct_join.py` | kept: built-ahead - W-010 (peer binding allocation / recovery caller); comments added |
| `handoff_export` | `wiskey_write_lineage.py` | kept: test-only |
| `username_in_use` | `ha_user_admin.py` | kept: test-only |
| `live_engine_built` | `door_windows_engine.py` | kept: test-only (called by `live_ready`; `door_emergency.py` only uses the same word as a dict key) |
| `live_ready` | `door_windows_engine.py` | kept: test-only (legacy compatibility; WisKey team question L16 still open) |
| `ProvisionPlayback.zone_report`, `.snapshot_at` | `recorders/provision_playback.py` | kept: test-only |
| `is_transcode_stream` | `live_codec.py` | kept: test-only |
| `stream_element_etag` | `nvr.py` | kept: test-only |
| `case_table` | `video_transport.py` | kept: test-only |
| `export_version` | `plan_schema.py` | kept: test-only |
| `auto_divide` | `plan_glass.py` | kept: test-only |
| `rollback_body` | `recorders/frigate_perm_restream.py` | kept: test-only |
| `yaml_snippet`, `load_plan`, `verify_after_restart` | `recorders/frigate_perm_restream.py` | kept: used by `scripts/frigate_permanent_restream.py` |
| "41 further symbols" (04 section 2.2, not itemised) | - | not touched: they are test-only by the review's own count, so they stay under O10 a |

### Found during verification, NOT on the list (left for the lead)

| Name | File | Note |
|---|---|---|
| `parse_lease`, `parse_talk_open` | `wiskey_media_contract.py` | no reference at all (the v11 readers `parse_lease_v11` / `parse_talk_open_v11` replaced them; the deleted `project_object` docstring was their last mention). Not deleted here: not on the lead's list and they take constants with them. |
| unused imports `json` (`alarm.py`, `emergency/engine.py:348`), `time` (`emergency/engine.py:469`), `os` (`exports.py`), `INSTALLATION` / `authorize` / `.alarm` (`automation_scope.py`); unused local `st` (`push.py:557`) | - | pre-existing ruff F401 / F841 findings in touched files, not on the list; left untouched |

### Out of scope

Section 5.3 (sqlite_master probes, "older database" shims, run-time DDL, read/write dependency twins) needs upgrade tests and
is not dead code by the owner's rule (each has a reference); not touched.

## Tests (actually run, workstation, `-p no:xdist`)

- `ruff check --select F,E9` on every touched file: only the 8 pre-existing findings listed above remain (origin/main had 10 in
  the same files; the removed two were `bridge_install` F401 and `presence` F811).
- Import of all 56 touched modules (`importlib`, workstation venv): 56 imported, 0 failed.
- Focused pytest, 44 files (`-p no:xdist`, workstation venv, at fb17a08ce): **1469 passed, 4 skipped, 0 failed**
  (2 h 15 min on a loaded workstation). Files: `test_push`, `test_emergency_readiness_295`, `test_presence`,
  `test_presence_contract_v22`, `test_wkv2_295`, `test_wkpeer_295`, `test_f3a_acr5_gate_295`, `test_stationperm_295`,
  `test_tickets_msg_whatsapp`, `test_tickets_msg_outbox`, `test_tickets_stuck`, `test_transit_realtime`, `test_bustimes_rt_295`,
  `test_messaging_accounts`, `test_offbox_api`, `test_docread_297`, `test_shared_spaces`, `test_capture_lease_ledger`,
  `test_capture_lease_review_fixes`, `test_cast_sessions`, `test_frigate_adapter`, `test_provision_push_addon`,
  `test_automations_notify`, `test_alarm`, `test_energy_tou_engine`, `test_energy_billing_engine`, `test_mobile_push`,
  `test_wiskey_schedule_writes`, `test_wiskey_adopt_2272_contrib`, `test_adoptr6_295`, `test_bridge_install`, `test_exports`,
  `test_tickets_image_intake`, `test_tickets_assignees`, `test_tickets_rfq_inbound`, `test_tickets_costs`, `test_tickets_visits`,
  `test_wall`, `test_palettes`, `test_plan_geometry_model`, `test_device_activity`, `test_building_presence_2271`,
  `test_board_mgmt_2381`, `test_access_grants`.

## NOT_RUN

- The full backend suite and the gate: the runner entry check (queued after the push).
- Frontend, pixels: nothing in `frontend/` changed.
