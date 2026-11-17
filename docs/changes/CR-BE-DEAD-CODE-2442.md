# CR-BE-DEAD-CODE-2442 - backend dead code, closing chain step BE-2: re-verification, two leftovers removed, markers

Branch `pilot/CR-BE-DEAD-CODE-2442`, from `origin/pilot/CR-ROUTER-COMMON-TAIL-2442` at 382b52e1d (BE-1). Code-review master
plan (`private/code-review-2026-11-13/MASTER_PLAN.md`) section 3.5, wave 3B, row BE-2 (named `CR-BE-DEAD-CODE-2436` there) and
section 5 (5.1, 5.2, 5.3). Findings 01:F-12, 01:F-22, 02:P2-11, 02:P2-12, 02:P3-6, 03:F24, 04:F13, 04:F23. Owner decisions
(round 32, 14.11): Q-CODE-1 = O10 a (delete only verified-unused code; test-used code stays), Q-CODE-2 = O15 a (code built
ahead stays, tagged with its task). No version bump, no migration, no route change, no frontend change, no pixel change.
No device, recorder, go2rtc or Home Assistant was contacted. No runner job, no entry check (as instructed).

## What this step found

Most of row BE-2 was already carried out in wave 2 by `CR-DEAD-CODE-BE-2438` (`docs/changes/CR-DEAD-CODE-BE-2438.md`), which
is part of this base. This step therefore (1) re-verified every symbol of section 5.1 on THIS head, (2) removed the two
leftovers of 5.1 that wave 2 had postponed, (3) put the `# test-only:` marker on every symbol that only tests reference
(the 5.2 list plus the "41 further symbols" the plan asked to list first - 194 symbols), (4) gave the built-ahead comments one
searchable form `# built ahead for <task id>`, and (5) lists the 5.3 shims: none has a test that proves its state cannot exist,
so none was removed.

Counts: **deleted 2** (one dict member with its builder, one parameter chain); **kept and marked test-only 194**;
**kept and tagged built-ahead 10**; 5.1 names already absent on this head: 59; 5.1 items still present and kept for another
reason: 8 rows of the table below; 5.3: **0 deleted**, all listed; **found but not on the list, not touched: 20 names** (for
the lead).

## Verification used

- V1 (reference search): `git grep -n -I -w -F <name>` over the whole tracked tree of this head (backend, tests, `frontend/`,
  `scripts/`, `custom_components/`, `smplwise_vms/integration/`, `mobile/`, `management/`, `contracts/`, `docs/`, YAML / JSON,
  `config.yaml`, `run.sh`, the Dockerfile), excluding only the built bundles (`smplwise_vms/www*`, `*.map`). A word search also
  finds string uses (`getattr(x, "name")`, registries, `__all__`). Mentions in `docs/changes/*`, `docs/superpowers/plans/*`
  and `docs/design/*` (history of the time) do not count as references.
- V2 (word index, for 5.2): every `def` / `class` of `smplwise/**` (syntax tree; route / validator / registration decorators,
  dunder names and the dynamic prefixes `_op_`, `_h_`, `visit_`, `do_` skipped). A name is "test-only" when the code of
  `smplwise/**` holds it exactly as often as it is defined (comments and docstrings not counted, every other string counted),
  it appears nowhere in `scripts/`, `custom_components/`, the integration, `frontend/`, `mobile/`, `contracts/`, YAML / JSON /
  shell, and `tests/` reads it. Names defined in more than one module say "the name is read only by tests" instead of naming
  one user. Overrides of a foreign base class were taken out by hand (`PublicServer.capture_signals` is called by uvicorn).
- Dynamic lookups in the backend (`getattr(self, f"_op_{op}")`, `"_h_" + command`,
  `importlib.import_module(f"smplwise.services.{name}")` in `startup_warmup`): none can reach a removed name (the two removed
  things are a dict key and a keyword parameter).
- Migrations (`smplwise/migrations*`), `config.yaml`, `run.sh`: no reference to either removed name (covered by V1).

## Section 5.1 - "no reference anywhere"

59 names of the list have **no definition on this head** (V1: zero hits outside history documents): they were deleted by
`CR-DEAD-CODE-BE-2438` and nothing brought them back. They are, by module: tickets (`parse_key`, `with_subject`,
`account_connected`, `png_scan`, `is_whatsapp`, `has_event_since`, `pending_count_for_link`, `access_counts`,
`vendors_of_contact`, `quotes_of_rfq`, `outbox_count_of_rfq`, `visits_of_vendor`, `kinds_in`); access / intercom
(`floor_cameras`, `_doors_of`, `_revocation_pending`, `_door_label`, `shares_from_floor`, `shared_zone_floors`, `anchor_in_room`,
`editor_placement`, `try_parse`, `send_installed_template_v3`, `project_object`, `bindings_ok`, `forget_bearer_user`,
`_bearer_principal`); media / plan (`failures_blocked`, `count_attempt`, `bridge_text`, `paused_jobs`, `rebuild_from`,
`polyline_length_px`, `review_summary`, `recording_snapshot`, `push_states`); other services (`find_zone`, `wide_manage_all`,
`has_tags`, `_index_put`, `is_activity_domain`, `_days_text`, `ComputeError`, `iso_to_epoch`, `day_type_name`, `season_index`,
`account_value`, `janitor_stats`, `audience_of`, `source_info`, `clear_tmp`, `to_hex`, `as_provider`, `conn_registry`,
`last_hello`, the import `distribution_files`, `urllib_transport`, `notice_from_fired`, `enqueue_fired`).

What is still there, and what this step did:

| Symbol | File (under `smplwise/`) | Result | Verification |
|---|---|---|---|
| `_push` member of a fired item, its builder dict and the local `details` that only fed it; the `pop("_push")` loop | `services/rules.py` | **deleted** | V1: the key is written and popped only in `rules.py`; its last reader (`push.notice_from_fired`) went in wave 2. `tests/test_push.py:257`, `:375` assert the key never leaves the delivery - still true. Every caller that evaluates with `deliver=False` (`events_ingest`, `ha_sync`, `frigate_events` x2) only hands the list to `deliver_pending` |
| `old_lines` parameter of `resend`, of `rfq_terms._resend`, and the two `old_lines = order_lines(...)` reads that only fed it | `services/tickets/rfq_orders.py`, `services/tickets/rfq_terms.py` | **deleted** | V1: `resend` never read it ("accepted and unused since TKGATEFIX8"); the only caller chain is `rfq_terms` (2 sites -> `_resend` -> `resend`); no test names it. The two removed `order_lines` calls were reads whose result went nowhere else (`resend` computes the lines itself through `refresh_order_lines`) |
| `set_ocr_reader` | `services/docread/service.py` | kept: built ahead for CR-OCR119 (tag) | V1: definition only, plus the change note that names it |
| `_DeadlineBackend.connect_unix_socket` | `services/connection_probe.py` | kept: interface method httpcore calls by name (plan's keep list) | - |
| `OAuthFlow` | `services/offbox_gdrive.py` | kept: Protocol documenting the flow (plan's keep list) | V1: definition only |
| `unused_uuid` | `services/rules.py` | kept: plan's keep list ("named so on purpose"); not proven otherwise | V1: definition only |
| `plan`, `PushNotifier.enqueue` | `services/push.py` | kept: test-only (marked) | V1: `enqueue` is called only by `tests/test_push.py`; `plan` only by the queue `enqueue` feeds |
| `if False` arm | `services/emergency/service.py` | already gone (wave 2) | grep |
| second `ssid_hash` | `services/presence.py` | already gone (one definition left) | grep |
| refusal branch behind an always-true constant | `routers/access_grants.py` | kept (owner decision O9 a: kill switch) | - |
| re-exports `QUEUES`, `AccessState`, `Assignment`, `PendingQueues`, `policy_ok`, `schedule_ok` | `services/wiskey_acr5.py` | kept: used in the module and read through it by tests (the six unused ones went in wave 2) | V1 |
| seven "commented-out" lines | `tickets/channel.py`, `messaging.py` (2), `phone_verify.py`, `public_claims.py`, `staff_links.py`, `store_costs.py` | kept: prose, not code (wave 2 read each; not re-read here) | - |
| write-connection twins (02:P3-5) | `routers/access_control*.py`, `routers/access_groups.py` | nothing to delete: `_reader` went in `CR-READCONN-A-2436`; in `access_groups` `_assign_holder`, `_assign_gate_ro` and `_manager` each still guard routes | grep of every `Depends(...)` |

The one behaviour note: the two removed `order_lines` reads ran before the date change was written. They were pure reads; a
database error there would now surface a few lines later (inside `resend`, which reads the same rows) instead.

## Section 5.2 - referenced by tests only: kept, marked `# test-only: <why>`

One comment line directly above the definition (above its decorators), in the form
`# test-only: <why>; used by tests/<file>[, ...]. Kept (owner decision O10 a, CR-BE-DEAD-CODE-2442).`
The reasons are: "test seam / test double" (a reset, a setter the tests install, an in-memory or fake implementation),
"interface member that no product code calls" (Protocol members), a hand-written reason for three legacy names
(`live_engine_built`, `push.plan`, `PushNotifier.enqueue`), else "no product caller". 194 symbols in 126 files - this is the
plan's named 5.2 list (all re-verified as still test-only) together with the "41 further symbols" it left un-itemised; the
index found more than 41 because it covers the whole backend, not one reviewer's files.

Named in 5.2 and NOT marked test-only: `yaml_snippet`, `load_plan`, `verify_after_restart`
(`recorders/frigate_perm_restream.py`: used by `scripts/frigate_permanent_restream.py`, so they are referenced), and the
built-ahead names below.

| File (under `smplwise/`) | Marked |
|---|---|
| `db.py` | `forget_schema_cache` |
| `errors.py` | `ServiceInvalid.to_api_error` |
| `services/access_external.py` | `reset_export_rate` |
| `services/access_grants.py` | `Worker.holds_lease` |
| `services/announce_translate.py` | `FakeTranslator` |
| `services/app_download.py` | `reset_cache_for_tests` |
| `services/automation_blueprints.py` | `validate_definition` |
| `services/automation_ext.py` | `set_listener` |
| `services/automation_model.py` | `dumps_exact`, `find_block`, `save_profile`, `steps_of_draft`, `block_is_sensitive`, `config_has_mask`, `issues_by_uid` |
| `services/automation_policy.py` | `grant_of` |
| `services/backup_offbox.py` | `FakeDestination` |
| `services/bill_pdf.py` | `_child_env` |
| `services/bridge_keys.py` | `new_material` |
| `services/bridge_rotation_peer.py` | `set_peer_for_tests` |
| `services/building_report_pdf.py` | `set_renderer` |
| `services/building_scope.py` | `building_areas` |
| `services/calendar/attendee_notices.py` | `register_channel` |
| `services/calendar/notices.py` | `pending_for` |
| `services/calendar_sync/fake.py` | `FakeAdapter.add_calendar`, `FakeAdapter.invalidate_tokens`, `FakeAdapter.user_create`, `FakeAdapter.user_edit` |
| `services/camera_sources.py` | `reset_health` |
| `services/compliance_export.py` | `reset_rate` |
| `services/delayed_worker.py` | `DelayedWorker.make_due` |
| `services/docread/pdftext.py` | `run_capped` |
| `services/docread/ports.py` | `NullTextReader` |
| `services/docread/service.py` | `set_text_reader` |
| `services/door_emergency.py` | `reset_rate` |
| `services/door_run_guard.py` | `set_conversion_source` |
| `services/door_window_triggers.py` | `reset_budget` |
| `services/door_windows_engine.py` | `live_ready`, `live_engine_built` |
| `services/energy_billing.py` | `_prev_bill` |
| `services/energy_billing_pdf.py` | `set_renderer` |
| `services/energy_billing_provider.py` | `BillingReadings.get_meter`, `NullReadings.get_meter`, `set_provider` |
| `services/energy_provider.py` | `EnergyReadingsProvider`, `EnergyReadingsProvider.get_meter`, `EnergyReadingsProvider.find_meters`, `EnergyReadingsProvider.meter_status`, `EnergyReadingsProvider.consumption_many`, `EnergyReadingsProvider.history_windows`, `EnergyProvider.get_meter`, `EnergyProvider.find_meters`, `EnergyProvider.meter_status`, `EnergyProvider.consumption_many`, `EnergyProvider.history_windows` |
| `services/energy_store.py` | `EnergyStore.forget_ids` |
| `services/events_cache.py` | `WindowCache.reset_stats` |
| `services/frigate_control_svc.py` | `clear_leases` |
| `services/ha_client.py` | `reset_rest_session` |
| `services/ha_user_admin.py` | `username_in_use` |
| `services/home_interface.py` | `reset_state_for_tests` |
| `services/intercom_authority.py` | `Authority.visible_stations`, `lookup_allowed` |
| `services/intercom_calls.py` | `CallBook.open_call` |
| `services/intercom_media.py` | `set_provider` |
| `services/intercom_sync.py` | `IntercomSync.late_results`, `IntercomSync.tts_status` |
| `services/live_codec.py` | `is_transcode_stream` |
| `services/local_passkeys.py` | `all_challenges`, `live_challenges` |
| `services/local_reset.py` | `Sender.make_due` |
| `services/messaging_accounts.py` | `MemorySendLedger` |
| `services/mobile_push.py` | `reset_health` |
| `services/notify.py` | `register_rule` |
| `services/notify_channels.py` | `process_outbox_now` |
| `services/notify_email.py` | `reset_state` |
| `services/notify_whatsapp.py` | `reset_state` |
| `services/nvr.py` | `stream_element_etag` |
| `services/offbox_sftp.py` | `host_key_line` |
| `services/palettes.py` | `failing_pairs`, `describe_failures` |
| `services/plan_glass.py` | `auto_divide` |
| `services/plan_schema.py` | `export_version` |
| `services/platform_restart.py` | `note_component_manifest` |
| `services/process_stats.py` | `reset_cache` |
| `services/push.py` | `plan`, `PushNotifier.enqueue` |
| `services/recorders/frigate_io.py` | `clear_stills` |
| `services/recorders/frigate_perm_restream.py` | `rollback_body` |
| `services/recorders/hikvision.py` | `HikvisionAdapter.cached_options` |
| `services/recorders/provision_events.py` | `push_target`, `stop_push` |
| `services/recorders/provision_isr.py` | `ProvisionIsrAdapter.configure_push`, `ProvisionIsrAdapter.pull_subscription` |
| `services/recorders/provision_playback.py` | `clear_caches`, `ProvisionPlayback.zone_report`, `ProvisionPlayback.snapshot_at` |
| `services/revocation.py` | `revoked_since` |
| `services/shared_spaces.py` | `floor_mirrored` |
| `services/temperature_pdf.py` | `set_renderer` |
| `services/tickets/channel.py` | `TicketChannel.can_reach`, `TicketChannel.parse_inbound`, `ChannelRegistry` |
| `services/tickets/channel_email.py` | `EmailChannel.can_reach`, `EmailChannel.parse_inbound` |
| `services/tickets/channel_whatsapp.py` | `outcome_from_api_error`, `WhatsAppChannel.can_reach`, `WhatsAppChannel.parse_inbound` |
| `services/tickets/cost_files.py` | `assemble_documents` |
| `services/tickets/costs_report.py` | `reset_rate` |
| `services/tickets/deletion.py` | `reset_rate` |
| `services/tickets/device_context.py` | `resolve_share_history` |
| `services/tickets/export.py` | `reset_rate` |
| `services/tickets/hours.py` | `signal_severity` |
| `services/tickets/inbound.py` | `MemoryDedupe` |
| `services/tickets/intake.py` | `whatsapp_on` |
| `services/tickets/links.py` | `verify_token` |
| `services/tickets/naming.py` | `has_tokens` |
| `services/tickets/out_documents.py` | `escape_text` |
| `services/tickets/outbox.py` | `MemoryOutboxStore`, `assignment_code_check`, `code_request_check` |
| `services/tickets/policy.py` | `may_share_history` |
| `services/tickets/portal_more.py` | `sanitized_rfq` |
| `services/tickets/public_portal.py` | `worker_started`, `reset_workers_for_tests` |
| `services/tickets/public_ports.py` | `CachedSwitch.refreshed_at` |
| `services/tickets/public_store.py` | `NoCodeChannel` |
| `services/tickets/ratelimit.py` | `client_network` |
| `services/tickets/sla.py` | `due_kind` |
| `services/tickets/store.py` | `ticket_rows_left` |
| `services/tickets/store_rfq.py` | `rfq_rows_left` |
| `services/tickets/text_hygiene.py` | `hidden_characters`, `csv_row` |
| `services/transit_realtime/delay.py` | `crossing_time` |
| `services/transit_realtime/mot_siri.py` | `MotSiriSource` |
| `services/transit_realtime/stride.py` | `StrideScheduleProvider` |
| `services/trusted_door.py` | `reset_status_rate` |
| `services/values.py` | `object_with_keys` |
| `services/video_transport.py` | `case_table` |
| `services/wa_pacing.py` | `MemoryPacerStore` |
| `services/wa_template_send.py` | `FakeTemplateTransport`, `NoWindowProbe` |
| `services/wall_path.py` | `bulge_for_radius`, `ring_area`, `wall_faces` |
| `services/water_billing.py` | `WaterReadings.get_meter`, `set_now`, `_prev_bill` |
| `services/wiskey_access_state.py` | `Negotiated.can_prove_revocation` |
| `services/wiskey_acr5.py` | `capability_ok`, `access_state_request`, `revocation_pending_at`, `revocation_evidence_at`, `stations_synced_verdict`, `visible_pending`, `is_cleanup_proof`, `consume_plan` |
| `services/wiskey_auto_install.py` | `read_installation`, `installation_state` |
| `services/wiskey_capture_map.py` | `announced_commands`, `Provenance.replay_permitted` |
| `services/wiskey_event_resume.py` | `set_clock_for_tests` |
| `services/wiskey_feature_exec.py` | `intent_state`, `LiveFeatureTransport`, `set_feature_enabled`, `record_host_registration` |
| `services/wiskey_installed_features.py` | `EventCursor`, `EventCursor.acknowledge_reset`, `read_capabilities_v2` |
| `services/wiskey_intents.py` | `settle_update` |
| `services/wiskey_live_validation.py` | `set_probes` |
| `services/wiskey_media_caps.py` | `set_opener_for_tests` |
| `services/wiskey_native_projection.py` | `fence_supported` |
| `services/wiskey_native_write.py` | `WriteOutcome.replay_permitted` |
| `services/wiskey_pairing.py` | `set_opener_for_tests` |
| `services/wiskey_peer.py` | `refuse_as_peer`, `ReceiptVerdict.proves_create`, `ReceiptVerdict.device_attested`, `ResolutionVerdict.replay_permitted`, `ResolutionVerdict.proves_create`, `ResolutionVerdict.device_attested`, `peer_result_class`, `PeerReadReceipt.replay_permitted` |
| `services/wiskey_peer_registry.py` | `encode_pin` |
| `services/wiskey_r2_contracts.py` | `read_event_retention`, `outcome_known` |
| `services/wiskey_relay_map_native.py` | `prepare_quiesced` |
| `services/wiskey_service_write.py` | `ServiceWriteClient.settle_unknown`, `FinalServiceWriter.from_installation` |
| `services/wiskey_versions.py` | `known_trees` |
| `services/wiskey_write_limits.py` | `WriteLimits.cooldown_raw` |
| `services/wiskey_write_lineage.py` | `WriteLineage.handoff_export` |
| `test_reset.py` | `reset_all` |

## Built ahead (O15 a): kept, tagged `# built ahead for <task id>`

Wave 2 had written these comments as "Built ahead, no product caller yet ...: kept for <task>". They now start with the
searchable form (`grep -rn "built ahead for"`); the rest of each comment is unchanged. Only tasks the plan / wave-2 note names.

| Symbol | File | Task |
|---|---|---|
| `set_ocr_reader` | `services/docread/service.py` | CR-OCR119 |
| `presence_diagnostic` | `services/wiskey_acr5.py` | ACR5-03 |
| `normalize_request`, `grant_policy_proven` | `services/wiskey_acr5.py` | ACR5-02 |
| `parse_feature_plan` | `services/wiskey_acr5.py` | ACR5-04 |
| `write_resources`, `read_resources` | `services/wiskey_auto_install.py` | SOURCE-CLOUD-EXPORT |
| `DirectJoin.registry_or_none`, `DirectJoin.resolve_or_none` | `services/wiskey_direct_join.py` | W-010 |
| `resolve_intent` | `services/wiskey_intents.py` | W-010 |

## Section 5.3 - shims and probes: nothing deleted; the list

Rule of this step: a shim goes only when an upgrade test proves its state cannot exist. I found no such test for any site.
The upgrade suites (`test_migrations`, `test_migrations_263_upgrade`, `test_smoke_after_upgrade`, `test_tickets_migration`,
`test_tickets_template_migration`, `test_vendorq_294_migration`, `test_wiskey_s5_migration_upgrade`,
`test_switch_protection_migration`, `test_migrate_legacy`) were looked at by name and purpose only, not read line by line:
they show that an upgrade works, not that no code runs on a database before its migration. `CR-SCHEMA-PROBES-2440` already
recorded one site that is reachable (`audit.py`: an upgrade from below 0032 can audit before `migrate()`). So every item stays:

| Group | State on this head | Why kept |
|---|---|---|
| "does this table / column exist" probes (the plan's 14 ticket sites + 42 backend-wide) | 39 calls of `db.has_table` / `db.has_column` in 16 files: `tickets/store.py` 13, `tickets/out_documents.py` 4, `tickets/store_links.py` 4, `tickets/store_rfq.py` 4, `tickets/vendor_documents.py` 1, `autosync.py` 3, and one each in `bridge_rotation`, `capture_lease`, `energy_calibration`, `events_ingest`, `fleet_report`, `local_identity`, `local_reset`, `media_store`, `plan_bakes`, `water_billing`. They are cached per database file and schema version since `CR-CORE-HELPERS-2438` / `CR-SCHEMA-PROBES-2440` | no test proves the table is always there when the code runs |
| direct `sqlite_master` reads left | 9 files: `db.py` (the helper and the temp schema), `backup.py`, `demo_mode.py`, `energy_store.py`, `local_privacy.py` (they list another database or the whole table set - not an existence shim); `energy_sampler.py:131`, `ha_user_auth.py:1060`, `health_report.py:225` (existence probes `CR-SCHEMA-PROBES-2440` left for 3B because other branches held the files); `shared_spaces.py:107`, `:113` (the start-up repair) | the three existence probes can move to `db.has_table` in a later row (same answer); that is not a deletion and not in this row |
| "database before migration N" shims in tickets | `tickets/vendor_portal.py:114`, `:433`, `:547`, `:559`; `tickets/map_element.py:249-250`, `:275`; `tickets/public_runtime.py:76`, `:81`, `:205`; `tickets/channel_email.py` and `tickets/notify_sources.py` (not re-located on this head) | no proof |
| "older database" fallbacks backend-wide (plan: 59) | 91 lines that say so in a comment, in 56 files on this head (a text count, not a reading of each; most: `tickets/vendor_portal.py` 5, `ha_user_auth.py` 4, `app_refresh.py` 4); `audit.py:65-71` is marked "kept, verify" in place | no proof; `audit.py` is known reachable |
| run-time DDL outside migrations | `db.ensure_migration_objects`, `shared_spaces.ensure_schema`, `wiskey_service_write.py` (journal table on first use), `wiskey_write_lineage.py` (its own database file) | reasons recorded in `CR-SCHEMA-PROBES-2440`; unchanged |
| read / write dependency twins (02:P3-5) | none left without a user (5.1 table) | - |

What a later row needs to delete any of these: a test that starts the application on a database stopped just below the
migration in question and shows that the guarded code cannot run before `migrate()` finishes (or that it does - then the shim is
alive). One such test per migration, not per site, would cover most of the ticket probes.

## Found during verification, NOT on the plan's list - not touched (for the lead)

V2 finds these with no reference at all outside their definition (V1 confirmed: definition only, or mentions in comments /
docstrings). The row says "exactly the symbols of section 5 ... nothing else", so they are only listed:

| Symbol | File | Note |
|---|---|---|
| `_control_holder`, `_bypass_holder`, `_alarm_actor` | `routers/alarm.py` | dependency functions no route uses any more |
| `_configure_holder_early`, `_bulk_holder` | `routers/devices.py` | same |
| `_any` | `routers/door_windows.py` | no user |
| `need_role` | `services/calendar/access.py` | no user |
| `janitor_due` | `services/calendar/guests.py` | no user |
| `_check_version`, `_due_periods`, `_record_run` | `services/energy_billing.py`, and the same three names in `services/water_billing.py` | no user in either |
| `redeem_token` | `services/notify.py` | only a docstring of the function after it names it |
| `record_door_arrival` | `services/tickets/visits.py` | reads as built ahead ("when external grants go live"); the plan names no task, so not tagged |
| `parse_lease`, `parse_talk_open` | `services/wiskey_media_contract.py` | already reported by wave 2 (the v11 readers replaced them) |
| `HealthReader`, `WindowProbe` | `services/recorders/base.py`, `services/wa_template_send.py` | Protocols used as documentation (like `OAuthFlow`) |

Not dead although the index shows no caller (a framework calls them): `PosixTz.fromutc`, `PublicH11Protocol.send_400_response`,
`PublicConfig.configure_logging`, `PublicServer.capture_signals`, and the route functions of `routers/local_identity.py` /
`routers/local_passkeys.py` (registered by `public_post`).

For BE-3 (`CR-PYFLAKES-ENFORCE`): the ruff counts are unchanged by this step (below); no import became unused.

## Commits

- 03d64a71d - the `# test-only:` markers and the `# built ahead for` tags (comments only, 127 files).
- e9d32588a - `services/rules.py`: the `_push` member.
- e7c3e0582 - `services/tickets/rfq_orders.py` + `rfq_terms.py`: the `old_lines` parameter chain (one change across callee and caller).
- this note.

## Proof (actually run, workstation, Windows, Python 3.12 venv, `-p no:xdist`)

- `python -c "import smplwise.main"`: ok. Import of each of the 130 touched modules (`importlib`): 130 imported, 0 failed.
- ruff (0.17.5, the project's `select = ["F"]`), before / after: backend directory 3127 / 3127, `smplwise/` alone 109 / 109 -
  the `--statistics` output is identical line for line.
- `python scripts/api_inventory.py`: 1908 routes, `contracts/API_INVENTORY.md` has no diff (also none at the base).
- `services/rules.py`: `tests/test_push.py`, `tests/test_rules.py`, `tests/test_notify_channels.py` on the finished tree:
  **34 passed, 0 failed** (6 min 19 s). An earlier, wider run with the `rules.py` change (`test_push`, `test_rules`,
  `test_announcements`, `test_announce_extras`, `test_frigate_events`, `test_p2_batch`, `test_zonecount107_295`,
  `test_db_locking`, `test_notify_channels`, `-x`) ran to the end and printed no failure, but its count line was not captured
  (the project's `-q` plus mine hid it), so it is not claimed as a number.
- `services/tickets/rfq_orders.py` / `rfq_terms.py`: `tests/test_tickets_rfq_terms.py`, `test_tickets_rfq_instalments.py`,
  `test_costinst291_ticket_instalments.py`, `test_harden271_ticket_demands.py`, `test_tickets_claim_instalments.py`,
  `test_tickets_rfq_award_notice.py`, `test_tickets_mgrdash_payments.py`, `test_tickets_rfq_order.py`: **155 passed, 0 failed** (counted from the
  progress line - 155 dots, no `F` / `E`; the count line was hidden as above).
- Comment-only files (126 + 5): no behaviour to test; what a comment can break is a test that reads the sources. The 69 tests
  (in 53 files) that walk the package's `*.py` files / modules were selected by a syntax-tree scan of `tests/` and run:
  **69 passed, 0 failed** (6 min 52 s).

## NOT_RUN

- The full backend suite (1071 test files): not run. On this workstation today a file of ~20 tests took minutes; the suite
  belongs to the runner, and this step was told not to use the runner and not to queue an entry check.
- The module tests of the 126 files that only received a comment (beyond the 69 source-reading tests above): not run.
- The upgrade suites named in section 5.3: not run (nothing they cover was changed).
- Frontend, pixels: nothing in `frontend/` changed.
