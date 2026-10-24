# WKCAP-295 - capture, six feature adapters, emergency v2 and the template hook on WisKey's direct transport (round 4, items 10-14)

Branch `pilot/WKCAP-295`, from `origin/main` (v2.15.0, 16bc3926b). No migration (0174 / 0175 are NOT used: the emergency attempt chain lives in the existing
`wiskey_feature_intents` table - request_id / operation_id unique, `parameter_reference` = event_ref, `scope_ref` = `emg:<command>:<hash of station+relay>` - and a new table
would also break the contiguous-numbering check `tests/test_migrations_263_upgrade.py` on this branch).

Everything below is real code against FAKES built from WisKey's published contracts (`tests/wkcap_fakes.py`). Nothing is installed, live or run against a WisKey, HA, a station or
a door. No switch, permit or capability was changed (see "Not changed").

## The port (what the transport owner must provide)

`smplwise/services/wiskey_capture_port.py` - `WiskeyDirectPort` (Protocol, synchronous):

| member | contract |
|---|---|
| `identity() -> PortIdentity(entry_id, query_owner_id, repository_id, connection_ref)` | the direct connect result (service identity, never an HA user) |
| `call(command, parameters, *, timeout_s) -> Mapping` | one pairing-signed command (`wiskey-bridge-command.v1`, exact service `query_owner_id`, fresh nonce); returns the `result` of a reply frame whose `wiskey-direct-reply.v1` MAC and `connection_ref` the transport verified. Error frame -> `PortError(code, "refused")`; provably never sent -> `PortError(code, "not_sent")`; timeout / closed socket / failed MAC -> `PortError(code, "unknown")` |
| `media_ingress_header(*, ticket, preparation_ref) -> str` | the pairing-signed `features/media_ingress_v1` body (parameters exactly ticket, preparation_ref, connection_ref) for `X-WisKey-Bridge` |
| `open_media(*, path, headers, timeout_s)` | opens the anonymous WebSocket of the original media plane |

Join: one adapter class from Agent A's transport (or Agent B's generic command port) to this four-member surface.

## Item 10 - capture (Q04)
`services/wiskey_capture_direct.py` - `DirectLeaseTransport` is a `lease_events.LeaseTransport`; `install(port)` sets `lease_events.TRANSPORT`, the one seam used by the lease worker
(revoke / heartbeat / stream reset), `routers/access_control.py` (start / confirm / cancel) and `capture_lease_route.tick` (status). `event()` -> `capture/lease_event`, `request()` ->
`capture/lease_request`, parameters exactly `{signed_message_json: <the original text of lease_events.sign, same string>}`, at most 8192 UTF-8 bytes. No kid, no digest, no new field,
no `await` (AST-tested), no retry in the transport (the worker's bounded retry with a NEW envelope is unchanged). Not-sent / unknown mapping onto the routes' existing rule
(`access_control._NOT_SENT_CODES` gained `wiskey_direct_not_connected`, `capture_source_unavailable`; `capture_outcome_unknown` and every timeout stay UNKNOWN).
Operator RBAC / scope / current / the lease ledger are Arx's real modules and were not touched: `routers/access_control._lease_redecide`, `services/intercom_authority.Authority`,
`services/capture_lease` (issue, epochs, ceiling, revoke triggers). The actor is the Arx Principal that signs the ORIGINAL inner message; the pairing entry is never an actor.
Missing real source: none on the Arx side. WisKey's collector/CAS/native paths and an actual card read are WisKey side and not proven.

## Item 11 - six adapters, media, completion read
`services/wiskey_feature_direct.py`: `build_policy_snapshot` (WisKey's closed 18-field snapshot, built from `wiskey_feature_exec.resolve_policy` = Arx RBAC + relay map),
`DirectFeatureClient` (`start`, `result`, `cancel`, `status`, `prepare_media`, `media_ingress_request`, `open_media`), closed readers, `FeatureAdapters` + `SPECS` (door_windows,
emergency_buttons, door_automations, people_csv, live_media, live_validation: allowed actor kinds, targets, row grants, media). Intent first (`admit_request`, committed with
`db.commit_now` before any I/O, so no network call runs inside a write transaction), then `mark_feature_sent`; a request/operation id is never admitted twice; UNKNOWN is never resent.
`features/result` carries only `operation_ref`, never a request or snapshot, never touches the intent row, works after the execution lease ended, and a host refusal of the READ settles
nothing. `cancel` -> `cleanup_joined` with `no_effect` always False. Media: only `/api/hikvision_intercom/arx_bridge/v1/media/{ticket}` (no query string, legacy HA path refused),
authenticated by `X-WisKey-Bridge` signed by the port on the same connection; a ticket is presented once; no bearer, no HA user.
`wiskey_feature_exec.build_request` now allows an automation actor for `emergency_buttons` (fire) as WisKey's parser does (still refused for the other four non-automation features).
Missing real sources (named): (1) people/CSV row grants (`source_line`, `user_id`, `revision`, `origin_ref`, `change_digest`) - no Arx module produces them; `RowGrantInput` is caller
supplied and a people_csv request without rows is refused; (2) `actor_session_active` and the Arx session fact come from the caller.

## Item 12 - emergency / fire (Q07)
`services/wiskey_emergency_direct.py` - `DirectEmergencyEngine` (`door_windows_engine.EmergencyEngine`) over `features/start` with `wiskey-emergency-event.v2`: new OPEN attempt after
UNKNOWN on the same event_ref with a NEW request_id/operation_id and `retry_of` = the old operation_id (old row untouched); a live attempt is never retried (`attempt_live`); a host
refusal for a live parent changes nothing (`retry_parent_live`); a durable release wins (`superseded_by_release`, nothing sent); a release addresses the door's latest hold event, none
on record -> refused `no_hold_record`; `lock_secure` is `not_implemented` for apply and release (no LOCK-as-release alias); fire needs an automation actor with the original lineage and
both creator and approver permissions. `incident_context` resolves the MANUAL actor from `door_emergency_incidents`. Missing real source (named): the automation lineage producer for
fire (automation_id, run_id, trigger_id, creator, approver, grant_revision) - Arx has no module that produces it (`door_emergency.check_actor` refuses non-person actors and
`doors.emergency.automations` cannot be on); the resolver seam `ContextResolver` is where it plugs in. Source/current/ACK-loss evidence: tests with the fake host
(ack_loss, crash window, live parent, release-wins, fire, receipts); SIMULATION ONLY.

## Items 13-14 - WhatsApp (Q05)
Search (working trees of every checkout under `C:\cloude`, the whole WisKey repo at product CODE `d2579588b0b8bda710656cfeb1eb9507f6b9df3a`): the six names do NOT exist in Arx or in
any Arx branch's source. They are WisKey (HA integration) objects at `custom_components/hikvision_intercom/`: `whatsapp_cloud_templates.py` (`ApprovedTextTemplate` l.325,
`CloudTemplateProvider` l.366), `whatsapp_pacing_queue.py` (`PacingQueue` l.446, `native_template_queue_port` l.407), `whatsapp_pacing_runtime.py` (`HostPacingPort` l.498),
`access/pin_quarantine.py` (`NativePinDeliveryPolicy` l.274), `whatsapp_template_composition.py` (`install_native_template_composition` l.127). Callers of
`install_native_template_composition` in the product: NONE (only its own retire path in `whatsapp_template_api_v1.py`); no site constructs `CloudTemplateProvider(`,
`ApprovedTextTemplate(` or `NativePinDeliveryPolicy(`. So the missing callsite is WisKey's private native installer inside Home Assistant, which must pass actual configured
`entry, bridge_entry, providers, templates, queue[, pin_delivery_policy]` (provider credentials and approved template catalog come from the owner's HA configuration). Arx cannot
build them (different process) and this branch builds none. Wired: `services/wiskey_template_direct.py` - `DirectTemplateTransport.send_template(request)` (structural
`wa_template_send.TemplateTransport`) -> `whatsapp/template_send_v1` with `request.wire()` verbatim, answer returned unchanged, any error RAISES (the sender maps a raise to UNKNOWN:
no not_sent, no retry, no refund); `send_v2(parameters)` passes the closed v2 object. JOIN with `pilot/WKB3-295` (not merged): install `DirectTemplateTransport` where WKB3's
`wa_template_send` expects `TemplateTransport`; WKB3's `read_answer(raw, version=...)` readers then judge the unchanged result. No consent, queue, provider or ledger invented.

## Not changed (deliberately)
`access.capture_lease` stays off; `capture_lease.GO_LIVE_PERMITTED` False and `MIN_BRIDGE_FOR_CAPTURE_LEASE` None; `door_emergency.DW09_OPEN_RETRY_AFTER_UNKNOWN` False (the dispatcher's
own retry still repeats one request id; flipping it is the lead's one-constant decision now that the v2 attempt rules exist - the engine itself turns a repeated call into a proper
new attempt); `door_windows_engine.LIVE_ENGINE_BUILT` False (also governs the window factory); `doors.emergency.*` switches. Nothing was returned to OFF.
Tests: `tests/test_wkcap_295.py` (+ `tests/wkcap_fakes.py`).
