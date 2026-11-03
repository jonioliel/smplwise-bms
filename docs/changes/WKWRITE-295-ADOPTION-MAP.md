# WKWRITE-295 - adoption map of WisKey's 42 families / 275 commands (round 4, item 4)

Source: WisKey `reference/ADOPTION_MATRIX.json` at intake commit 3707f97fb (product CODE d2579588b0b8, owner delivery 36708274977c).
Generated on branch pilot/WKWRITE-295 from that matrix, an Arx family -> engine table and a text search of
`smplwise_vms/backend/smplwise/**/*.py` for each command name. A file listed in the last column MENTIONS the command (usually the
old Home Assistant WebSocket path through services/intercom_client.py / services/wiskey_channels.py); it is not a direct-transport
caller. Nothing in this map is installed or live.

Status values:
- **WIRED here (fakes)** - called by `services/wiskey_native_write.py` through the `WiskeyCommandPort`; tested against the fake in
  tests/test_wkwrite_295*.py. Not yet joined to the direct transport (pilot/WKDIRECT-295) and not called by a router.
- **existing Arx caller (old HA-WS path), direct NOT wired** - Arx already uses the command over the old path; moving it to the direct
  transport belongs to the engine named for its family.
- **REMAINING** - no Arx caller yet; the named engine must call it. No family is excluded because Arx has no screen for it.
- **EXCLUDED** - `jobs/approval_decide`, `jobs/approval_request`: approval writes deferred by the owner; the read `jobs/approval_review` stays available.
  WISKEY-ADOPT-2272 review M2: the exclusion holds on every installation unless the automatic installation switch `wiskey.auto_install`
  is on (`wiskey_direct_catalog.INSTALLATION_SWITCH`); the owner must confirm IN WRITING that Arx may write job approvals before that
  switch is turned on. Arx has no caller of either write.
- **ALIAS** - the five old `audio/*` commands are legacy panel aliases; the audio engine is reached through the signed W10
  `media/talk_*` commands (services/wiskey_media_contract.py). Arx never calls the aliases.

No alternative SDK, registry or queue is built: every family is called through the one command port with the original command
names and the original signed envelopes.

Totals: ALIAS (served by W10): 5, EXCLUDED (owner: approval writes deferred): 2, REMAINING: 203, WIRED here (fakes): 15, existing Arx caller (old HA-WS path), direct NOT wired: 50 (sum 275).

### acceptance (2)

Engine / module: WisKey settings (technical channel): services/intercom_adapter.py + routers/access_control.py settings screens

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `acceptance/get` | yes | REMAINING | - |
| `acceptance/update` | yes | REMAINING | - |

### appearance (2)

Engine / module: WisKey settings (technical channel): services/intercom_adapter.py

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `appearance/settings_get` | yes | REMAINING | - |
| `appearance/settings_update` | yes | REMAINING | - |

### audio (5)

Engine / module: NOT called: legacy panel aliases; the audio engine is reached through signed W10 media/talk_* (services/wiskey_media_contract.py)

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `audio/diagnostics` | no | ALIAS (served by W10) | - |
| `audio/mute` | no | ALIAS (served by W10) | - |
| `audio/receive` | no | ALIAS (served by W10) | - |
| `audio/send` | no | ALIAS (served by W10) | - |
| `audio/start` | no | ALIAS (served by W10) | - |

### audit (2)

Engine / module: read channel: services/intercom_adapter.py (audit/list); export via the same adapter

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `audit/export` | yes | REMAINING | - |
| `audit/list` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_adapter.py, services/wiskey_channels.py |

### authorization (4)

Engine / module: session/authorization: services/wiskey_channels.py + the direct transport (pilot/WKDIRECT-295)

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `authorization/preview` | yes | REMAINING | - |
| `authorization/session` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_client.py, services/wiskey_background_feed.py, services/wiskey_channels.py, services/wiskey_diagnostics.py |
| `authorization/settings_get` | yes | REMAINING | - |
| `authorization/settings_update` | yes | REMAINING | - |

### backups (3)

Engine / module: WisKey maintenance: services/intercom_adapter.py admin screen; backups/apply must also mark open lineage intents unknown (services/wiskey_write_lineage.py)

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `backups/apply` | yes | REMAINING | - |
| `backups/export` | yes | REMAINING | - |
| `backups/preview` | yes | REMAINING | - |

### capture (2)

Engine / module: capture lease client (round-4 item 10, CAPTURE_COMPOSITION_V1.md) - not this branch

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `capture/lease_event` | yes | REMAINING | - |
| `capture/lease_request` | yes | REMAINING | - |

### cards (7)

Engine / module: cards/add + cards/remove: services/wiskey_native_write.py (THIS branch); capture_*: card capture flow (services/intercom_writes.py + capture lease); reader_capabilities: read adapter

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `cards/add` | yes | WIRED here (fakes) | routers/access_control_writes.py, services/intercom_client.py, services/intercom_writes.py, services/wiskey_channels.py |
| `cards/capture_cancel` | yes | existing Arx caller (old HA-WS path), direct NOT wired | routers/access_control.py, services/intercom_authority.py, services/intercom_client.py, services/intercom_writes.py |
| `cards/capture_confirm` | yes | existing Arx caller (old HA-WS path), direct NOT wired | routers/access_control.py, services/intercom_authority.py, services/intercom_client.py, services/intercom_writes.py |
| `cards/capture_start` | yes | existing Arx caller (old HA-WS path), direct NOT wired | routers/access_control.py, services/intercom_authority.py, services/intercom_client.py, services/intercom_writes.py |
| `cards/capture_status` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_authority.py, services/intercom_client.py, services/wiskey_channels.py |
| `cards/reader_capabilities` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_client.py, services/wiskey_channels.py |
| `cards/remove` | yes | WIRED here (fakes) | routers/access_control_writes.py, services/intercom_client.py, services/intercom_writes.py, services/wiskey_channels.py |

### clock (5)

Engine / module: WisKey technical settings: services/intercom_adapter.py

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `clock/host_apply` | yes | REMAINING | - |
| `clock/host_status` | yes | REMAINING | - |
| `clock/settings_get` | yes | REMAINING | - |
| `clock/settings_update` | yes | REMAINING | - |
| `clock/station_sync` | yes | REMAINING | - |

### conflicts (4)

Engine / module: people conflicts: services/intercom_adapter.py (list); resolve/resolve_deletion/review are person mutations for the people engine (bulk_people_engine / a future native-write extension)

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `conflicts/list` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_adapter.py, services/wiskey_channels.py |
| `conflicts/resolve` | yes | REMAINING | - |
| `conflicts/resolve_deletion` | yes | REMAINING | - |
| `conflicts/review` | yes | REMAINING | - |

### events (10)

Engine / module: events read model: services/intercom_adapter.py, services/access_denied.py, services/wiskey_background_feed.py

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `events/detail` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_adapter.py, services/wiskey_channels.py |
| `events/export` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_adapter.py, services/wiskey_channels.py |
| `events/history_inspect` | yes | REMAINING | - |
| `events/list` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/access_denied.py, services/intercom_adapter.py, services/intercom_parity.py, services/wiskey_channels.py |
| `events/print` | yes | REMAINING | - |
| `events/report` | yes | REMAINING | - |
| `events/support` | yes | REMAINING | - |
| `events/trace_get` | yes | REMAINING | - |
| `events/trace_start` | yes | REMAINING | - |
| `events/trace_stop` | yes | REMAINING | - |

### features (5)

Engine / module: six native feature adapters: services/wiskey_feature_exec.py (round-4 item 11) - not this branch

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `features/cancel` | yes | REMAINING | - |
| `features/prepare_media` | yes | REMAINING | - |
| `features/result` | yes | REMAINING | - |
| `features/start` | yes | REMAINING | - |
| `features/status` | yes | REMAINING | - |

### fleet (3)

Engine / module: fleet/health: services/intercom_adapter.py, services/intercom_parity.py

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `fleet/alerts` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_adapter.py, services/intercom_parity.py, services/wiskey_channels.py |
| `fleet/alerts_action` | yes | REMAINING | - |
| `fleet/inventory_export` | yes | REMAINING | - |

### guest_templates (3)

Engine / module: visitor / external access: services/access_external.py

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `guest_templates/delete` | yes | REMAINING | - |
| `guest_templates/get` | yes | REMAINING | - |
| `guest_templates/upsert` | yes | REMAINING | - |

### health (3)

Engine / module: health: services/intercom_adapter.py, routers/access_control_reads.py

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `health/get` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_adapter.py, services/wiskey_channels.py |
| `health/history` | yes | existing Arx caller (old HA-WS path), direct NOT wired | routers/access_control_reads.py, services/intercom_adapter.py, services/wiskey_channels.py |
| `health/refresh` | yes | REMAINING | - |

### investigations (1)

Engine / module: events investigations: services/intercom_adapter.py

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `investigations/query` | yes | REMAINING | - |

### jobs (8)

Engine / module: background operations engine: services/wiskey_background.py (NATIVE_BACKGROUND_OPERATIONS_V1.md); approval_decide/approval_request EXCLUDED by the owner, approval_review read available

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `jobs/action` | yes | REMAINING | - |
| `jobs/approval_decide` | no | EXCLUDED (owner: approval writes deferred) | - |
| `jobs/approval_request` | no | EXCLUDED (owner: approval writes deferred) | - |
| `jobs/approval_review` | yes | REMAINING | - |
| `jobs/bulk_create` | yes | REMAINING | - |
| `jobs/csv_create` | yes | REMAINING | - |
| `jobs/errors` | yes | REMAINING | - |
| `jobs/list` | yes | REMAINING | - |

### media (12)

Engine / module: W10 shared video + per-call talk: services/wiskey_media_contract.py (round-4 items 5-7) - not this branch

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `media/call` | yes | REMAINING | - |
| `media/provider_check` | yes | REMAINING | - |
| `media/provider_discover` | yes | REMAINING | - |
| `media/settings_get` | yes | REMAINING | - |
| `media/settings_update` | yes | REMAINING | - |
| `media/signal` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_client.py, services/wiskey_channels.py |
| `media/station_descriptor` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/wiskey_media_contract.py |
| `media/stream_lease` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/wiskey_media_contract.py |
| `media/talk_close` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/wiskey_media_contract.py |
| `media/talk_floor` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/wiskey_media_contract.py |
| `media/talk_frame` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/wiskey_media_contract.py |
| `media/talk_open` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/wiskey_media_contract.py |

### operations (1)

Engine / module: operations report: services/intercom_adapter.py

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `operations/query` | yes | REMAINING | - |

### overview (2)

Engine / module: overview: services/intercom_client.py, services/intercom_sync.py

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `overview` | yes | existing Arx caller (old HA-WS path), direct NOT wired | routers/access_control.py, routers/tickets_admin.py, services/intercom_client.py, services/intercom_sync.py |
| `overview/summary` | yes | REMAINING | - |

### peer_bindings (2)

Engine / module: peer registry: services/wiskey_peer_registry.py; peer_bindings/get (initialize) as the CURRENT read binding of the resolve: services/wiskey_native_write.py (THIS branch)

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `peer_bindings/get` | yes | WIRED here (fakes) | services/wiskey_peer_registry.py |
| `peer_bindings/history` | yes | REMAINING | - |

### peer_protocol (1)

Engine / module: peer registry: services/wiskey_peer_registry.py

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `peer_protocol/get` | yes | REMAINING | - |

### peer_receipts (1)

Engine / module: exact-original resolve: services/wiskey_native_write.py (THIS branch)

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `peer_receipts/resolve` | yes | WIRED here (fakes) | services/wiskey_peer.py |

### peer_writes (1)

Engine / module: write source: services/wiskey_native_write.py (THIS branch)

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `peer_writes/source_v1` | yes | WIRED here (fakes) | - |

### permissions (1)

Engine / module: station permissions directory: services/access_station_permissions.py

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `permissions/directory` | yes | REMAINING | - |

### platform (36)

Engine / module: WisKey platform maintenance / config / lifecycle / retention / webhooks: services/wiskey_background.py + admin screens

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `platform/archive` | yes | REMAINING | - |
| `platform/capacity` | yes | REMAINING | - |
| `platform/config_apply` | yes | REMAINING | - |
| `platform/config_decide` | yes | REMAINING | - |
| `platform/config_pending` | yes | REMAINING | - |
| `platform/config_preview` | yes | REMAINING | - |
| `platform/config_read` | yes | REMAINING | - |
| `platform/config_review` | yes | REMAINING | - |
| `platform/delete` | yes | REMAINING | - |
| `platform/demo` | yes | REMAINING | - |
| `platform/export` | yes | REMAINING | - |
| `platform/get` | yes | REMAINING | - |
| `platform/import_apply` | yes | REMAINING | - |
| `platform/import_preview` | yes | REMAINING | - |
| `platform/integrity` | yes | REMAINING | - |
| `platform/lifecycle_apply` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_adapter.py |
| `platform/lifecycle_decide` | yes | REMAINING | - |
| `platform/lifecycle_jobs` | yes | REMAINING | - |
| `platform/lifecycle_plan` | yes | REMAINING | - |
| `platform/lifecycle_prepare` | yes | REMAINING | - |
| `platform/lifecycle_remove` | yes | REMAINING | - |
| `platform/lifecycle_review` | yes | REMAINING | - |
| `platform/lifecycle_verify` | yes | REMAINING | - |
| `platform/maintenance_cancel` | yes | REMAINING | - |
| `platform/maintenance_decide` | yes | REMAINING | - |
| `platform/maintenance_enqueue` | yes | REMAINING | - |
| `platform/maintenance_jobs` | yes | REMAINING | - |
| `platform/maintenance_plan` | yes | REMAINING | - |
| `platform/maintenance_preview` | yes | REMAINING | - |
| `platform/maintenance_resume_v1` | yes | REMAINING | - |
| `platform/report` | yes | REMAINING | - |
| `platform/retention_apply` | yes | REMAINING | - |
| `platform/retention_preview` | yes | REMAINING | - |
| `platform/save` | yes | REMAINING | - |
| `platform/webhook_key` | yes | REMAINING | - |
| `platform/webhook_save` | yes | REMAINING | - |

### profiles (6)

Engine / module: access profiles: services/intercom_adapter.py

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `profiles/settings_apply` | yes | REMAINING | - |
| `profiles/settings_get` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_adapter.py, services/intercom_parity.py, services/wiskey_channels.py |
| `profiles/settings_preview` | yes | REMAINING | - |
| `profiles/settings_update` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_adapter.py |
| `profiles/versions` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_adapter.py, services/wiskey_channels.py |
| `profiles/versions_compare` | yes | REMAINING | - |

### renewal (5)

Engine / module: personal renewal: background engine services/wiskey_background.py (NATIVE_BACKGROUND_OPERATIONS_V1.md)

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `renewal/binding_update` | yes | REMAINING | - |
| `renewal/bindings` | yes | REMAINING | - |
| `renewal/cancel` | yes | REMAINING | - |
| `renewal/request` | yes | REMAINING | - |
| `renewal/self` | yes | REMAINING | - |

### schedules (29)

Engine / module: schedules: services/intercom_adapter.py, routers/schedules.py, services/wiskey_acr5.py

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `schedules/assess` | yes | REMAINING | - |
| `schedules/baseline_clear` | yes | REMAINING | - |
| `schedules/baseline_save` | yes | REMAINING | - |
| `schedules/create` | yes | REMAINING | - |
| `schedules/delete` | yes | REMAINING | - |
| `schedules/dependencies` | yes | REMAINING | - |
| `schedules/export` | yes | REMAINING | - |
| `schedules/import_apply` | yes | REMAINING | - |
| `schedules/import_preview` | yes | REMAINING | - |
| `schedules/list` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_adapter.py, services/intercom_parity.py, services/wiskey_channels.py |
| `schedules/normalize_user` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/wiskey_acr5.py, services/wiskey_channels.py, services/wiskey_readback.py |
| `schedules/operations_archive` | yes | REMAINING | - |
| `schedules/operations_cancel` | yes | REMAINING | - |
| `schedules/operations_check` | yes | REMAINING | - |
| `schedules/operations_claim_confirm` | yes | REMAINING | - |
| `schedules/operations_claim_preview` | yes | REMAINING | - |
| `schedules/operations_claim_release` | yes | REMAINING | - |
| `schedules/operations_create` | yes | REMAINING | - |
| `schedules/operations_export` | yes | REMAINING | - |
| `schedules/operations_list` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_adapter.py, services/wiskey_channels.py |
| `schedules/plan_delete` | yes | REMAINING | - |
| `schedules/plan_export` | yes | REMAINING | - |
| `schedules/plan_list` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_adapter.py, services/wiskey_channels.py |
| `schedules/plan_preview` | yes | REMAINING | - |
| `schedules/plan_recheck` | yes | REMAINING | - |
| `schedules/plan_save` | yes | REMAINING | - |
| `schedules/preview` | yes | existing Arx caller (old HA-WS path), direct NOT wired | routers/schedules.py |
| `schedules/readiness` | yes | REMAINING | - |
| `schedules/update` | yes | REMAINING | - |

### search (1)

Engine / module: people/events search: services/intercom_adapter.py

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `search/query` | yes | REMAINING | - |

### security (5)

Engine / module: session security (lock/reauth/touch): the direct transport session (pilot/WKDIRECT-295)

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `security/lock` | yes | REMAINING | - |
| `security/reauth_start` | yes | REMAINING | - |
| `security/reauth_step` | yes | REMAINING | - |
| `security/session` | yes | REMAINING | - |
| `security/touch` | yes | REMAINING | - |

### stations (18)

Engine / module: stations + technical: services/intercom_adapter.py; stations/test_unlock is a door action (owner per-action approval, services/door_authority.py)

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `stations/clock_refresh` | yes | REMAINING | - |
| `stations/get` | yes | REMAINING | - |
| `stations/inventory` | yes | REMAINING | - |
| `stations/list` | yes | REMAINING | - |
| `stations/permission_audit` | yes | REMAINING | - |
| `stations/rescan` | yes | REMAINING | - |
| `stations/technical_codes_get` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_adapter.py, services/wiskey_channels.py |
| `stations/technical_codes_write` | yes | REMAINING | - |
| `stations/technical_get` | yes | REMAINING | - |
| `stations/technical_hold_delete` | yes | REMAINING | - |
| `stations/technical_hold_get` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_adapter.py, services/wiskey_channels.py |
| `stations/technical_hold_save` | yes | REMAINING | - |
| `stations/technical_program_action` | yes | REMAINING | - |
| `stations/technical_program_list` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_adapter.py, services/wiskey_channels.py |
| `stations/technical_program_save` | yes | REMAINING | - |
| `stations/technical_relays` | yes | REMAINING | - |
| `stations/technical_update` | yes | REMAINING | - |
| `stations/test_unlock` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_authority.py, services/intercom_client.py, services/wiskey_channels.py |

### subscribe (1)

Engine / module: event subscription: services/wiskey_background_feed.py over the direct transport

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `subscribe` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_client.py, services/intercom_sync.py, services/recorders/provision_isr.py, services/wiskey_background_feed.py |

### support (1)

Engine / module: diagnostics: services/wiskey_diagnostics.py

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `support/bundle` | yes | REMAINING | - |

### sync (5)

Engine / module: sync: services/intercom_sync.py

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `sync/all` | yes | REMAINING | - |
| `sync/diagnostics` | yes | REMAINING | - |
| `sync/station` | yes | REMAINING | - |
| `sync/status` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_adapter.py, services/wiskey_channels.py |
| `sync/user` | yes | REMAINING | - |

### tts (2)

Engine / module: tts: services/intercom_client.py

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `tts/engines` | yes | existing Arx caller (old HA-WS path), direct NOT wired | routers/access_control.py, services/intercom_client.py, services/wiskey_channels.py |
| `tts/start` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_client.py, services/wiskey_channels.py |

### upgrade (1)

Engine / module: diagnostics / readiness: services/wiskey_diagnostics.py

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `upgrade/readiness` | yes | REMAINING | - |

### users (39)

Engine / module: people writes (9 native actions) + name_ref + bulk_receipt: services/wiskey_native_write.py (THIS branch); access reads: services/wiskey_access_state.py; bulk/CSV: services/bulk_people_engine.py + people_csv feature; lifecycle/quality/duplicates: read adapter

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `users/access_compare` | yes | REMAINING | - |
| `users/access_compare_options` | yes | REMAINING | - |
| `users/access_review_decide` | yes | REMAINING | - |
| `users/access_review_preview` | yes | REMAINING | - |
| `users/access_reviews` | yes | REMAINING | - |
| `users/access_scenario` | yes | REMAINING | - |
| `users/access_state` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/wiskey_access_state.py, services/wiskey_channels.py |
| `users/access_state_v2` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/wiskey_access_state.py, services/wiskey_channels.py |
| `users/adopt` | yes | REMAINING | - |
| `users/archive` | yes | WIRED here (fakes) | routers/access_control_writes.py, services/intercom_client.py, services/intercom_writes.py, services/wiskey_channels.py |
| `users/bulk_apply` | yes | REMAINING | - |
| `users/bulk_preview` | yes | REMAINING | - |
| `users/bulk_receipt` | yes | WIRED here (fakes) | - |
| `users/bulk_receipts` | yes | REMAINING | - |
| `users/bulk_renewal_preview` | yes | REMAINING | - |
| `users/create` | yes | WIRED here (fakes) | routers/access_control.py, services/intercom_authority.py, services/intercom_client.py, services/intercom_writes.py |
| `users/csv_apply` | yes | REMAINING | - |
| `users/csv_export` | yes | REMAINING | - |
| `users/csv_inspect` | yes | REMAINING | - |
| `users/csv_preview` | yes | REMAINING | - |
| `users/data_quality` | yes | REMAINING | - |
| `users/delete` | yes | WIRED here (fakes) | routers/access_control.py, services/intercom_authority.py, services/intercom_client.py, services/intercom_writes.py |
| `users/delete_unmanaged` | yes | REMAINING | - |
| `users/duplicate_check` | yes | REMAINING | - |
| `users/get` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_adapter.py, services/intercom_client.py, services/wiskey_channels.py |
| `users/group_suggestions` | yes | REMAINING | - |
| `users/ignore` | yes | REMAINING | - |
| `users/lifecycle` | yes | REMAINING | - |
| `users/list` | yes | REMAINING | - |
| `users/name_ref_apply_v1` | yes | WIRED here (fakes) | - |
| `users/name_ref_prepare_v1` | yes | WIRED here (fakes) | - |
| `users/photo_get` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_adapter.py, services/wiskey_channels.py |
| `users/pin_check` | yes | REMAINING | - |
| `users/pin_generate` | yes | existing Arx caller (old HA-WS path), direct NOT wired | routers/access_control.py, services/intercom_client.py, services/intercom_writes.py, services/wiskey_channels.py |
| `users/query` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_adapter.py, services/intercom_parity.py, services/wiskey_channels.py |
| `users/set_active` | yes | WIRED here (fakes) | routers/access_control_writes.py, services/intercom_client.py, services/intercom_writes.py, services/wiskey_channels.py |
| `users/temporary_cancel` | yes | WIRED here (fakes) | routers/access_control_writes.py, services/intercom_client.py, services/intercom_writes.py, services/wiskey_channels.py |
| `users/unarchive` | yes | WIRED here (fakes) | routers/access_control_writes.py, services/intercom_client.py, services/intercom_writes.py, services/wiskey_channels.py |
| `users/update` | yes | WIRED here (fakes) | routers/access_control.py, routers/access_control_writes.py, services/intercom_authority.py, services/intercom_client.py |

### visits (5)

Engine / module: visits: services/access_external.py

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `visits/create` | yes | REMAINING | - |
| `visits/decide` | yes | REMAINING | - |
| `visits/list` | yes | REMAINING | - |
| `visits/operators` | yes | REMAINING | - |
| `visits/request` | yes | REMAINING | - |

### whatsapp (11)

Engine / module: messaging: services/wa_pacing.py, services/wa_template_send.py, services/intercom_messaging_adapter.py (round-4 items 13-14) - not this branch

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `whatsapp/history` | yes | REMAINING | - |
| `whatsapp/media` | yes | REMAINING | - |
| `whatsapp/pacing_status_v1` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/wa_pacing.py, services/wiskey_channels.py |
| `whatsapp/preview` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_messaging_adapter.py, services/wiskey_channels.py |
| `whatsapp/send` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_messaging_adapter.py, services/wiskey_channels.py |
| `whatsapp/send_pacing_v1` | yes | REMAINING | - |
| `whatsapp/status` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/intercom_messaging_adapter.py, services/wiskey_channels.py |
| `whatsapp/template_send_v1` | yes | existing Arx caller (old HA-WS path), direct NOT wired | services/wa_template_send.py |
| `whatsapp/template_send_v2` | yes | REMAINING | - |
| `whatsapp/templates_get` | yes | REMAINING | - |
| `whatsapp/templates_update` | yes | REMAINING | - |

### workflows (19)

Engine / module: workflows (inventory, renewal, transfer, reminders): background engine services/wiskey_background.py

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `workflows/apply` | yes | REMAINING | - |
| `workflows/decide` | yes | REMAINING | - |
| `workflows/get` | yes | REMAINING | - |
| `workflows/inventory_issue` | yes | REMAINING | - |
| `workflows/inventory_return` | yes | REMAINING | - |
| `workflows/inventory_save` | yes | REMAINING | - |
| `workflows/reminder_action` | yes | REMAINING | - |
| `workflows/renew_decide` | yes | REMAINING | - |
| `workflows/renew_request` | yes | REMAINING | - |
| `workflows/settings_update` | yes | REMAINING | - |
| `workflows/submit` | yes | REMAINING | - |
| `workflows/template_delete` | yes | REMAINING | - |
| `workflows/template_save` | yes | REMAINING | - |
| `workflows/transfer_begin` | yes | REMAINING | - |
| `workflows/transfer_finish` | yes | REMAINING | - |
| `workflows/transfer_recheck` | yes | REMAINING | - |
| `workflows/transfer_review` | yes | REMAINING | - |
| `workflows/transfer_start` | yes | REMAINING | - |
| `workflows/withdraw` | yes | REMAINING | - |

### peer_identity (1)

Engine / module: direct service identity: the direct transport (pilot/WKDIRECT-295)

| command | WisKey direct | Arx status | existing Arx files mentioning it |
|---|---|---|---|
| `peer_identity/get` | yes | REMAINING | - |
