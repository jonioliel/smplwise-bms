# WISKEY-WA-QUEUE-2400 - WhatsApp messaging completion on the installed WisKey client (plan T12)

Branch `pilot/WISKEY-WA-QUEUE-2400`, cut from `origin/release/2382-train` @ `2d5238efe`. Target release: 2.40.0. Not merged, no tag,
no version bump, **no migration**. Fakes and mocks only: no lab, WisKey, station, Home Assistant, phone or message.

Source of the task: `private/planning/WISKEY_FULL_INTEGRATION_PLAN_2026-11-03.md` T12 and messaging rows 72-75. WisKey reference:
`C:\hik intercom` @ `origin/codex/wiskey-mac-m12-policy-b-2026-11-02` (`2834aa5e`, component 2.0.1-rc.10) - read only:
`native_installation_api.py`, `native_template_jobs.py`, `whatsapp_template_api_v2.send_v3`, `whatsapp_api.py`
(`send_pacing_v1`, `_send_outcome`, `_pacing_error`, `pacing_status_v1`), `direct_bridge_discovery.py`, `native_auto_installation.py`,
`manual_upgrade_profile.py`; and the rc.10 extract on this train (`docs/integrations/wiskey/catalog/rc10-extract/commands.static.json`
lists `whatsapp/send_pacing_v1`).

## 1. What already existed (re-used, not duplicated)

| Piece | Where | State before this branch |
|---|---|---|
| Signed registry merge | `wiskey_auto_install.sync_native_templates` | ran only from the hourly reconcile, behind `wiskey.auto_install` |
| Queue journal + job reader | `wiskey_installed_features.TemplateJobs`, `read_job` | written and tested, no caller |
| v3 reader | `wiskey_auto_install.read_template_outcome_v3` | written and tested, no caller |
| v2 send flow + admission | `wa_template_send.TemplateSender.send_v2`, `routers/access_control_template_v2.py` | the only template route |
| WisKey pacing envelope | `wa_pacing` + `intercom_messaging_adapter.refresh_pacing` (`pacing_status_v1`, PACING channel) | live (row 73 = D) |
| Free-text send | `intercom_messaging_adapter.MessagingAdapter.send` (`whatsapp/preview` + `whatsapp/send`) | live |

## 2. What this branch adds

### 2.1 Backend

- `services/wiskey_wa_queue.py` (new): the transport rule (`port_for`: the direct join's signed port, only while the join SELECTS the
  command now), `PortClient` (TemplateJobs' client over the sync port; WisKey's pre-effect refusals of `template_enqueue_v1` are
  `not_sent`, anything that may come after the job was saved stays `unknown`), the registry view + refresh, the two explicit sender
  transports (`QueueTransport`, `V3Transport`), job -> message outcome mapping, WisKey slowdown -> Arx budget, the journal view, and the
  paced-send opt-in setting (`messaging.wa_installed` {send_pacing_v1}, default OFF).
- `routers/access_control_wa_queue.py` (new), six routes:

| Route | Gate | What |
|---|---|---|
| GET `/access-control/messaging/installed` | system.configure | gates, what the join selects now, registry by source, queue journal |
| PUT `/access-control/messaging/installed` | system.configure | `send_pacing_v1` (boolean, audited) |
| POST `/access-control/messaging/installed/registry-sync` | system.configure | refresh from `whatsapp/template_registry_v1` (audited) |
| POST `/access-control/people/{id}/messages/template-installed` | access.people.message + the person | ONE template, `mode`: `queue` / `now` (v3) |
| GET `.../template-installed/{operation_id}` | the same | the job from `whatsapp/template_job_v1`; settles the record once |
| POST `.../template-installed/{operation_id}/cancel` | the same | `whatsapp/template_cancel_v1` (WisKey decides; audited) |

- `routers/access_control_template_v2.py`: the admission of the v2 send is extracted UNCHANGED into `admit_and_record(act, body,
  before_record=None)`; the v2 route and the new route both call it, so both refuse exactly alike (confirmation, messaging switch, send
  hours, template switch AND code permit, reference + WisKey pair, person revision, account rule incl. the native-account rule,
  opt-out list, preview token, attempt row BEFORE the hand-over). The new route's `before_record` only adds "the join selects the
  command" (409 `template_installed_unavailable`, nothing recorded).
- `services/wiskey_installed_features.TemplateJobs`: also accepts the application's `Database` (one short `write_aside` per write, a
  read connection per read; no transaction or write lock is held while WisKey answers). With a raw sqlite3 connection it behaves exactly
  as before (its existing tests pass unchanged).
- `services/intercom_messaging_adapter.py`: `paced_listed(settings)`, `_paced_answer` (closed `whatsapp_send_outcome_v1` reader),
  `_preview_and_send_paced`; `MessagingAdapter.send(..., paced_v1=False)` uses `whatsapp/send_pacing_v1` only when the administrator
  opted in AND WisKey's discovery lists it; a WisKey `rate_limited` carries WisKey's own ledger delay instead of the generic 5 s.
  Callers pass the opt-in: `routers/access_control_messaging.py` (free text / template text, consent request) and
  `services/intercom_consent.py` (held-message release).
- `services/intercom_sync.py`: `message_send(..., channel="messaging")` - the message lane accepts `messaging` or `messaging_paced` only.
- **New channel (additive) in `services/wiskey_channels.py`: `messaging_paced` = {`whatsapp/preview`, `whatsapp/send_pacing_v1`}**,
  in `ADAPTER_CHANNELS` and `UNPINNED_CHANNELS` (the command post-dates the rc.37 pin; it is an rc.10 command). No existing list
  changed. `tests/test_pwclean_295.py` catalog hash recomputed (`0fdcbd37...` -> `63741829...`); `tests/test_wiskey_channels.py`
  updated for the sixth adapter channel.
- `main.py`: the new router on its own line. `contracts/API_INVENTORY.md` regenerated: 1728 -> 1734 routes (+6).

### 2.2 Frontend

- `frontend/src/screens/wa-installed-card.ts` (new), mounted at the end of Settings > access control > messages
  (`system-access-messaging.ts`, below the form's save bar): blockers in the server's order, the six commands and whether the join
  selects each now, the template list by source with "refresh from WisKey", the newest five jobs with their honest word, the TTL, the
  "no delivery receipts" line, the paced-send toggle (ON only while WisKey lists the command; OFF always possible), and "the
  conversation history stays in WisKey". Hebrew, RTL, no "Home Assistant".
- `src/api/wa-installed.ts` (REST + demo), `src/messaging/wa-installed-model.ts` (pure logic), `src/i18n/wa-installed.ts` (he/en/ar/ru;
  ar/ru dev-marked).
- Tests: `tests/unit-wa-installed.spec.ts`, `tests/evidence-wa-installed-2400.spec.ts` (desktop + mobile), mock
  `tests/wa-installed-mock.ts`; `tests/wiskey-messaging-settings.ts` now also installs that mock so the existing messaging-settings specs
  see a ready card.

## 3. Rules kept (nothing loosened)

- Code permit `TEMPLATE_SEND_SUPPORTED` stays **False**; the template switch, people messaging and the paced-send opt-in stay owner
  steps. With the production permit every new send path refuses 409 before anything is recorded or sent (test
  `test_with_the_production_permit_closed_nothing_reaches_wiskey_in_either_mode`).
- A WisKey-owned template row is still sendable only while `wiskey.auto_install` is on and its account is in the last signed sync
  (`_context`, unchanged). The manual registry refresh merges rows but does not make them sendable (`native_sendable` shows it).
- The hourly reconcile path is unchanged (still behind `wiskey.auto_install`). The manual refresh is a read + local merge by
  `system.configure`, through the same `sync_native_templates` (administrator rows kept, empty / malformed replies refused).
- One enqueue per operation, ever (TemplateJobs' row first); a recorded terminal outcome is never downgraded; an unknown is never
  retried or relabelled; a provider ACK is "accepted by the provider", delivery stays unknown.
- Message history stays out (row 75 "X"): `whatsapp/history`, `whatsapp/media`, `whatsapp/templates_get/update` are on no allow-list
  and sent by nothing (test scans every allow-list and every backend module).
- Records / audit rows carry ids, codes and outcomes only - no phone, parameter value, template body or WisKey template reference.

## 4. Honest outcomes

| WisKey says | Message record | HTTP |
|---|---|---|
| job queued / dispatching | `pending` | 202 + job |
| job completed `accepted` + `provider_accepted: true`; v3 accepted | `sent` (delivery unknown) | 200 |
| job `not_sent` (`cancelled_before_dispatch`, `queue_expired`, `source_changed_before_dispatch`, ...) | `refused` + reason | 502 at send / via job read |
| `rate_limited` (v3 `pacing_outcome` or job's) | `refused`, reason `rate_limited`; Arx account slowdown (`note_slowdown`, WisKey's delay) | 429 `message_paced_wiskey` + `retry_after_s` |
| pre-effect refusal frame (`installation_unavailable`, ...) | `refused` + code | 502 |
| nothing written (`not_sent` port error) | removed (never left Arx) | 409 |
| timeout, late refusal, malformed reply, `replay_available: true` | `unknown` | 504, never retried |

## 5. WisKey gaps found (rc.10, policy-B branch)

1. **Policy B disables the whole installed queue.** With the manual-upgrade profile (`manual_upgrade_profile.enabled`, the lab's state
   since 03.11), `setup_auto_installation` returns None, so `hass.data[DOMAIN]["native_auto_installation"]` is absent and every one of
   `template_registry_v1 / enqueue_v1 / job_v1 / cancel_v1 / send_v3` answers `installation_unavailable`. They are still registered and
   listed in `direct/capabilities`, so Arx's join SELECTS them and gets a refusal. Arx reports it honestly (`refused`
   `installation_unavailable`; registry sync `refused`), but on the lab nothing of T12 can work until WisKey serves these commands under
   the manual / managed profile or WISKEY-MANAGED-INSTALL-2382 lands a profile with the automatic authority.
2. **No delivery receipt.** rc.10 has no `delivered` state anywhere (template v2/v3 `delivery` is always `unknown`; jobs carry the v2
   result). The task's "sent / delivered / failed" therefore maps to "accepted by the provider / not sent with reason / unknown";
   "delivered" is NOT shown. Needs a WisKey receipt contract.
3. **`whatsapp/send_pacing_v1` never answers `accepted: true`.** After a dispatch it always returns `send_state: unknown`
   (`whatsapp_send_uncertain`, "HA service completion is not provider acceptance"). With the opt-in ON every successfully dispatched
   free-text message is recorded `unknown`. That is why the opt-in is OFF by default and the card says so. Useful today only for WisKey's
   closed `not_sent` + `retry_after_s`.
4. **Enqueue refusal after save.** `native_template_jobs.enqueue` saves the job and then calls `principal.check()`; a refusal from that
   check means "queued but refused". Arx treats every refusal it cannot place before the save as `unknown` (only the codes in
   `PRE_EFFECT_ENQUEUE` are `not_sent`). A closed "not enqueued" marker on the refusal would remove the ambiguity.
5. **Job pacing companion shape.** A completed job may carry `pacing_outcome` inside `result` (not part of `wiskey-template-jobs.v1`'s
   documented job document). Arx reads it leniently (`pacing_of_job`) and only for the budget slowdown.
6. **No job list command.** Arx can read a job only by `operation_id`; there is no WisKey-side listing to reconcile Arx's journal.

## 6. Tests and receipts

Backend (Windows workstation, repo venv `C:\cloude\smplwisebms\.venv`, Python 3.12, fakes only):

- `pytest tests/test_wiskey_wa_queue_2400.py` - 49 passed (queue, pacing, cancel, outcomes, permit refusal, registry, paced send,
  channels, exclusions, TemplateJobs over Database).
- `pytest tests/test_wiskey_channels.py tests/test_pwclean_295.py tests/test_wiskey_adopt_2272_features.py tests/test_tplv2_295.py
  tests/test_wa_pacing_coverage_295.py tests/test_eccact_readback_295.py tests/test_wiskey_rc10_pin.py tests/test_wa_template_send_w11.py
  tests/test_wiskey_wa_queue_2400.py` - 396 passed, 4 skipped.
- `pytest tests/test_intercom_messaging.py tests/test_intercom_messaging_review265.py tests/test_intercom_consent_link.py
  tests/test_wiskey_contract.py tests/test_wiskey_adopt_2272_contrib.py tests/test_wiskey_owner26_callers_297.py tests/test_db_gate.py
  tests/test_wkjoin_295.py` - 387 passed.
- `pytest tests/test_wiskey_wa_queue_2400.py tests/test_release_check.py` - 52 passed (after the API inventory regeneration).

Frontend (workstation, Node 24): `npx tsc --noEmit` - exit 0. `npx playwright test -c playwright.unit.config.ts
tests/unit-wa-installed.spec.ts` - 7 passed; the source-scanning unit specs (a11y lint, dark polish, date format, empty-state icons, menu
lint, page background, token lint, uxfix RTL, messaging strings, messaging pacing) - 71 passed.

Runner browser specs: see section 7.

## 7. Runner receipts

(filled in after the runner run - see the commit that adds them)

## 8. NOT_RUN

- Anything against the lab, a real WisKey, station or phone (no lab access by instruction).
- The full backend suite (the train gate covers it; coordinator 04.11: targeted files only).
- Pixel baselines: no new pixel spec was added. The card sits below the form, outside the viewport of the existing
  `pixel-wiskey-messaging.spec.ts` settings shots; whether those baselines are untouched is checked on the runner (section 7).

## 9. Rollback

Revert the branch's commits. No migration, no stored data beyond two settings keys (`messaging.wa_installed`,
`wiskey.installation.registry_sync` - the latter never exported) and rows in the existing 0194 table `wiskey_template_jobs`.
