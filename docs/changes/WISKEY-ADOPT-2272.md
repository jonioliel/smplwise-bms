# WISKEY-ADOPT-2272 - version 2.27.2: Arx adoption of the WisKey owner28 automatic-installation delivery

Branch `pilot/WISKEY-ADOPT-2272`, cut from `release/2270-r5` (`213fc7705`), with `pilot/WISKEY-MAC-ADOPT-297` (`8713a96ee`, the
`wiskey-native-service-write.v1` client, writer disabled) merged first (`8be92821c`). Not merged to `main`, not tagged, not released,
not installed. No WisKey release. Tests use synthetic data and fakes only: no lab host, no WhatsApp, no door, microphone or speaker, no
real Home Assistant user, no restart of a real platform.

## Inputs (read-only)

- Windows intake `FORWARD_TO_ARX_WITH_GIT_HE.txt` (28.10): the binding execution order for Arx.
- Mac delivery, git export `docs/owner-development-2026-10-28/mac-auto-install-completion/` (delivery CODE `ac30174f...`, product CODE
  `0a099c53d359a1bffdf9e63f31d2433f1c9445a4`): `00_summary` (FINAL_REPORT_HE, EXTERNAL_REMAINDERS), `01_installation`
  (INSTALLATION_CONTRACT, SYNTHETIC_MANIFEST, SERVICE_WRITE_FINAL_V1), `02_inventory`, `03_templates_queue`, `04_pacing`, `05_events`,
  `06_media`, `07`-`09` (already-delivered items, references only), `10_delivery` (ARX_CONTRIBUTION_FILES.json, owner28-auto-install.patch
  sha256 `617849411aaf...`, native-integration-source.zip sha256 `cc78ca07912b...` 1 700 169 bytes, arx-contribution copies).
- Mac hand-off folder `mac-owner-auto-install-handoff-2026-10-28` (the Windows -> Mac prompt and its audit), read for context.
- The contribution's Arx base `83a7c795` is an ancestor of this branch; the 15 files were re-applied on the current source (semantic
  adoption), never as a blind patch.

## Status per step (states reported separately; NOT_MEASURED = not measured)

| Step | Implemented | Registered | Wired | Tested | Installed | Live |
|---|---|---|---|---|---|---|
| 0 merge 297 (service write v1) | yes (`8be92821c`) | as 297 | as 297 (writer disabled) | 298 suites re-run (below) | NOT_PERFORMED | NOT_MEASURED |
| 1 native bundle in `smplwise_vms/integration` + image | yes (`f71a0cf8b`) | n/a | Dockerfile `COPY integration /app/integration` carries it | unit (byte-exact to pin) | NOT_PERFORMED | NOT_MEASURED |
| 2 the 15 contribution files | yes (`a5e0f55f2`, `69dcce9ba`) | catalog owner28 adopted | see table 2 | unit + browser (synthetic) | NOT_PERFORMED | NOT_MEASURED |
| 3 manifest reader, resources, InstalledWiskeyClient, service write v2 | yes (`9fa48d7fd`) | v2 contract constant | reader used by steps 4/5; v2 writer NOT wired (no production client) | unit | NOT_PERFORMED | NOT_MEASURED |
| 4 template queue, pacing v3, event cursor, media | yes (`f12eafccb`; pacing v3 + media in step 2) | catalog lists the commands | consumers only, no caller at boot / no screen | unit | NOT_PERFORMED | NOT_MEASURED |
| 5 installer: staging, config discovery, auto bridge, restart by digest | yes (`287d99a2f`) | n/a | `bridge_install.install`, `announce_discovery`, `main.py` janitor + start-up - all behind `wiskey.auto_install` (default OFF) | unit | NOT_PERFORMED | NOT_MEASURED |
| SOURCE-CLOUD-EXPORT | BLOCKED | - | - | - | - | - |

### The one switch

Every installation EFFECT is behind the setting `wiskey.auto_install` (value `on`; default off, no screen). It is kept out of backups
(review H2: `services/backup.py` `SETTINGS_KEEP` - never exported, never restored - together with `wiskey.events.cursor` and every
`wiskey.installation.*` key: the restart claim, the staged-tree digest, the native account list). With it off the
add-on behaves exactly as before this branch: no WisKey bundle is copied into the owner's config directory, no platform restart, no
`wiskey_auto_install` discovery flag, no setting changes, no registry sync. Reading / validating the manifest is always allowed (read-only).
The code-level template permit `intercom_messaging_adapter.TEMPLATE_SEND_SUPPORTED` stays False in every case (the delivery set it True at
start-up). Turning the switch on is an owner decision for the joint session (owner28 OWNER-JOINT-LIVE).

## 1. Native integration package (step 1)

- `smplwise_vms/integration/hikvision_intercom/` = the delivered zip extracted byte-exact: 370 files, component version `2.0.0-rc.38`.
- `smplwise_vms/integration/hikvision_intercom.pin.json`: product CODE, archive sha256 / bytes, per-file sha256 and the tree hash
  `b44bdfcf601f4984a253a6ccdf046a9dca0705a32d3d35e38974b49b5af67eee`. `.gitattributes`: the bundle is `-text` (no EOL normalisation).
- The bridge mirror is untouched by it (`scripts/sync_integration.py` only owns `integration/smplwise_bridge`); the Dockerfile already
  copies `integration/` to `/app/integration`, so the image carries both integrations (comment added).
- Scan: no private address, token or key pattern in the bundle.

## 2. The 15 contribution files (step 2)

| Delivered path | Adoption | Deviation from the delivery |
|---|---|---|
| `custom_components/smplwise_bridge/__init__.py` | `_async_setup_native`: sets up a staged `hikvision_intercom` after the bridge entry | a failed / missing native setup is logged, never raised (the delivery raised `wiskey_automatic_setup_failed`, which would take the bridge down); review H4: only for an entry carrying `wiskey_auto_install: true` (written only by the automatic-install discovery), only when the component is not loaded, started with `hass.async_create_task` (never awaited) |
| `custom_components/smplwise_bridge/config_flow.py` | `wiskey_auto_install: true` in the Supervisor discovery pairs (signed ping) and creates the entry without the form | abort texts added (en/he); mirror synced |
| `frontend/owner28-harness.html`, `owner28-playwright.config.ts`, `tests/owner28-playback.spec.ts` | moved to `frontend/tests/owner28/` + `frontend/playwright.owner28.config.ts`, spec renamed `*.owner28.ts` | outside the product build and the main suite; outputs under `test-results/owner28`; clip = delivered `synthetic-video.mp4` (sha256 `08a75da5...`) |
| `smplwise_vms/backend/smplwise/main.py` | janitor `reconcile_due` (hourly) + start-up `activate_software` | both gated by the switch; wired in step 5 |
| `routers/access_control_template_v2.py` | a native-registry reference uses its own account | none |
| `routers/intercom_media.py`, `services/intercom_media.py` | already adopted by 298 item A (terminal re-check after `lease.confirm`, no await before `send_bytes`) | 298's finer rule kept: a natural end keeps its admitted tail (the delivery's `publication_current` ended on any pump end) |
| `services/wiskey_listen_adapter.py` | the listen channel also fences on the talk channel's own `publication_current` | none |
| `services/wa_template_send.py` | `REGISTRY_MAX` 128, optional `account`, uniqueness by (account, name, language) | the `window_open` removal was already 298 item B |
| `services/wiskey_direct_catalog.py` | `OWNER_EXCLUDED_WRITES` kept (review M2), lifted only while `wiskey.auto_install` is on | **contradiction recorded**: the earlier owner decision excluded `jobs/approval_decide` / `jobs/approval_request`; the owner28 instruction says "no artificial allowlist"; review M2: the exclusion holds unless the switch is on, and the owner must confirm in writing before turning it on; Arx has no caller of either write |
| `services/wiskey_direct_discovery.py` | not changed: 298 M3 already reads the three optional blocks (a superset of the delivery's looser key check) | v1 reader unchanged |
| `services/bridge_install.py` | step 5 | step 5 |
| `services/wiskey_auto_install.py` | adopted; hardened in steps 3 and 5 | `activate_software` fills only UNSET settings and never opens the send permit; the delivered `read_installation` used `os.O_NOFOLLOW` (absent on Windows) - kept POSIX-strict, Windows dev skips mode bits only |

Catalog: the runtime catalog is the trim of the owner28 `CATALOG-FINAL-08/catalog/COMMAND_CATALOG.jsonl` (source sha256
`15ad9de70fd5929053d1aeba60b0c33e723ef8197624e0f43544db4571e589bf`): 282 registered + 4 direct-only = 286 names, 43 families; it adds
`events/resume_v1`, `whatsapp/template_registry_v1` / `_enqueue_v1` / `_job_v1` / `_cancel_v1`, `whatsapp/template_send_v3`,
`direct/capabilities_v2`. The new catalog dropped the `direct_dispatch_available` column; `scripts/wiskey_r5_catalog_trim.py` derives it
from the wire schema (HA body = not direct). The five HA-only aliases `audio/start|send|receive|mute|diagnostics` keep their HA protocol.
`docs/integrations/wiskey/r5/CALLER_MAP.json` regenerated.

### Before / after (first 16 hex of sha256; before = `release/2270-r5` `213fc7705`, after = branch head)

| Delivered path | Arx path | Delivery after | Before | After |
|---|---|---|---|---|
| `custom_components/smplwise_bridge/__init__.py` | same | `da7a19986c4b5f9e` | `ab2165306719ee8c` | `07e5de0d5ea0df8c` |
| `custom_components/smplwise_bridge/config_flow.py` | same | `c8ab86fb171a68da` | `b0c02ec83ee707ef` | `1d9d0dc33fa2ec05` |
| `frontend/owner28-harness.html` | `frontend/tests/owner28/owner28-harness.html` | `55d6bb156df2be15` | absent | `436e7a4b156e14ec` |
| `frontend/owner28-playwright.config.ts` | `frontend/playwright.owner28.config.ts` | `c0e11ff6e2d99876` | absent | `c76b088fc55b0338` |
| `frontend/tests/owner28-playback.spec.ts` | `frontend/tests/owner28/owner28-playback.owner28.ts` | `d9e5f724f7d2e60e` | absent | `cd05c22ec7cdd826` |
| `smplwise_vms/backend/smplwise/main.py` | same | `180d8fe59311748c` | `742fb7884c78c45f` | `067071076623152f` |
| `.../routers/access_control_template_v2.py` | same | `1a330f126a1bf4d6` | `d642780e4925f9d8` | `1a19cdeace877bcc` |
| `.../routers/intercom_media.py` | same | `e86ed1771dd50920` | `71236168096443d5` | `6f4d0df7bcce93f1` |
| `.../services/bridge_install.py` | same | `e5aa1698fe3674d3` | `b7ee10ecac77f699` | `66c7dacf024b7934` |
| `.../services/intercom_media.py` | same | `0552d31af6e82f68` | `1895b103e4989e61` | `d378bf745394d09f` |
| `.../services/wa_template_send.py` | same | `a23a1b485696623d` | `be5ac851fc27e3b7` | `51b521e5d4883196` |
| `.../services/wiskey_auto_install.py` | same | `f4210bb62075c902` | absent | `3ffd6e9f7ce504e4` |
| `.../services/wiskey_direct_catalog.py` | same | `2e69428cb2cb6cf4` | `8e620bbe07954b29` | `261859f291f17ec8` |
| `.../services/wiskey_direct_discovery.py` | same | `71ade4d3dfcddd3e` | `eaae1e2a692f3dff` | `350eb48a230da0ad` (298 M3) |
| `.../services/wiskey_listen_adapter.py` | same | `71f0c0ba9ea97d84` | `88242820268bb8ca` | `e060c713f3e4e098` |

Integrations (sha256 of the sorted `git ls-tree -r` lines, first 16 hex; file count): `integration/smplwise_bridge` `73755808d65aa2f9` (27)
-> `7e4bba35385a9c78` (27) = mirror of `custom_components/smplwise_bridge` `afaeba5c253af4b4` -> `6362dd36d79df8bd`;
`integration/hikvision_intercom` absent -> `c0fa9ed015442093` (370; content = product `0a099c53`, see the pin).

## 3. Installation contract reader, resources, client, service write v2 (step 3)

- `wiskey_auto_install.check_manifest` / `read_checked_installation`: the full closed `wiskey-local-installation.v1` document as WisKey's
  `native_auto_installation.reconcile` writes it (top fields, entry fields, GrantRef fields typed; `authority_mode =
  permanent_full_installation`, `expires_at = null`, `service_contract = wiskey-native-service-write.v2`, `query_owner_id =
  arx-service:<entry_id>`; `ready` = exactly one entry, `waiting_for_arx_bridge` = none; two entries refused). The file must be private
  (regular, one link, no symlink, no group/other bits on POSIX), at most 1 MiB, strict JSON. Path: `<ha config>/.storage/
  hikvision_intercom.arx_installation/manifest.json`, config dir from the existing `bridge_install.ha_config_dir` (no owner input).
- `installation_state()`: secret-free status (state, counts, commands relied on). `ready` means local authority / transport bootstrap
  ready - not cloud approval and not hardware.
- `ManifestGrantSource`: the GrantRef read from the manifest on every call, None while the switch is off. **Arx never creates, renews or
  edits a grant**; there is no manifest writer in Arx.
- `resources.json` (`wiskey-local-template-resources.v1`): closed checker, atomic private writer (dir 0700, file 0600, same-filesystem
  replace), reader. No production caller (SOURCE-CLOUD-EXPORT).
- `InstalledWiskeyClient`: Arx's `DirectApiTransport` -> `DirectLink.call_command`; identity = the authenticated connect's query owner
  and repository must equal the manifest's; the manifest is re-read before every call and a changed entry refuses
  (`installation_changed_reconnect_required`, no replay). The delivery called `peer_identity/get` for the same check.
- `wiskey_service_write`: `CONTRACT_V2` - the same 13 metadata keys with `contract = v2`; a write result must echo the request's
  contract (WisKey echoes it), `users/service_write_status_v1` stays v1; journal, CAS, UNKNOWN-no-replay, PIN rules unchanged.
  `FinalServiceWriter.from_installation(join, grant=ManifestGrantSource(...), actor_id=<manifest query owner>)`.
  **Not wired**: `access_service_writer.writer_for` still builds the v1 writer without a client (as 297). A production v2 writer needs
  a `ServiceWriteClient` over the direct join's port with its own journal connection - not built (next steps).
- `DATA_FIELDS` (the native business model fields) is kept for v2 as well: it mirrors WisKey's validators, it is not an owner allowlist.

## 4. Template queue, pacing v3, event cursor, media (step 4)

- Template queue (`wiskey_installed_features.TemplateJobs`, `read_job`): closed job document; `queued` / `dispatching` = pending,
  `completed` accepted only with `provider_accepted: true` (ACK only, delivery unknown), proven `not_sent`, `cancelled_before_dispatch`;
  everything else UNKNOWN (never not_sent). Arx records the operation BEFORE the enqueue leaves: a lost answer or a restart never enqueues
  it again. Stored: ids, states, codes only.
- Pacing v3 (`wiskey_auto_install.read_template_outcome_v3`, step 2): `wiskey-template-outcome.v3` with the ORIGINAL closed v2 reader;
  `rate_limited -> not_sent` only with a not_sent v2 result, `retry_after_s` relative to `observed_at` (aware), `retry_after_source =
  original_local_ledger`, `prior_unknown_retry = false`; `automatic_retry = false`. v2 not extended.
- Event cursor (`EventCursor`, `read_page`): `wiskey-event-cursor.v1`; at-least-once with de-duplication by event id (last 4096 ids);
  the cursor is stored only after the handler returned; `reset_required` (`source_replaced`, `cursor_ahead`, `retention_gap`) is a
  recorded gap, never all-delivered, and nothing is read past it until `acknowledge_reset()` adopts the reset cursor explicitly.
- Discovery v2 (`read_capabilities_v2`): its own reader (`event_cursor_resume = true`, closed `native_installation` block, GrantRef must
  equal the manifest's); the v1 reader is unchanged and still refuses a v2 document.
- Media: terminal re-check after the awaited `lease.confirm` (298 item A) and the listen fence (step 2); `window_open` (298 item B).
  Audio stays PCM/G.711 -> WebAudio beside MSE video (browser spec below). `_fence`, idle / mute / expiry / slot rules unchanged; no
  artificial keepalive; `downlink_pending` is not on the listen path.
- Wired: none of these consumers is started at boot or used by a screen (they need an installed client, i.e. the switch).

## 5. Installer (step 5)

- `bridge_install.install` -> `wiskey_auto_install.installer_step` after the bridge copy: switch off -> `off`; on -> the bundle must be
  byte-exact to its pin (else `native_pin_mismatch`, nothing copied), staged into `<config>/custom_components/hikvision_intercom` only
  when the target is missing or is exactly the tree Arx staged last (`wiskey.installation.staged_digest`, review H3); an installed
  component with a newer semantic version is refused (`native_newer_installed`, never downgraded), any other tree Arx did not stage is
  refused (`native_foreign_installed`, left as it is); the previous tree is kept as `hikvision_intercom.smplwise-backup` (one rollback
  copy). Never blocks the bridge copy or its announcement.
  `status()` carries `wiskey_native` (state / code / version / restart, no path).
- Restart by digest: one `homeassistant.restart` request per staged source digest, claimed durably (`wiskey.installation.restart_digest`)
  before the call; a failed / lost answer is `restart_unknown`; the same digest is never requested again.
- Discovery: `announce_discovery` adds `wiskey_auto_install: true` with the switch on (the bridge then pairs without its form).
- `main.py`: hourly `reconcile_due` (template registry sync over the direct join when it selects `whatsapp/template_registry_v1`; while
  the manifest is not ready, re-announce) and start-up `activate_software` (review M1: only `access.station_media_provider = auto`
  when unset - the direct join needs it - with one audit row `wiskey.installation.activate` per filled key).

### Owner steps after the automatic installation (review M1)

The delivery's `activate_software` also switched these on; Arx leaves each one to the owner (joint session, settings screens):
video + talk (`access.station_media = video_talk`), listen (`access.station_listen = on`), the template switch
(`messaging.template_send`), people messaging (`access.messaging.enabled`), and - only if the owner wants other values than the
conservative default that already applies - the pacing configuration. The code-level template permit stays False in every case.
- Bridge version: 0.10.0 -> 0.10.1 (review M6; manifest, `const.VERSION`, the card, the mirror and the version pins of the bridge
  tests). `bridge_install.install` copies whenever the installed version differs from the source, so an existing 0.10.0 copy is
  refreshed (one platform restart by the owner loads it, as for every bridge release).
- Not done: a screen for the switch; creating a real HA user (never - none is needed).

## SOURCE-CLOUD-EXPORT (mapped, BLOCKED)

Searched this repository for the source of real WhatsApp Cloud accounts and approved templates (`phone_number_id`, `business_id`, Graph
API version, token, approved body / `template_id`, a `custom_components/whatsapp` source). Result: Arx sends WhatsApp only through the
platform's `whatsapp` integration service (`services/tickets/channel_whatsapp.py`, `messaging_accounts.py`: account KEYS = integration
entry ids or a manual value; no credential, no Graph identifiers) and keeps only logical template references
(`wa_template_send.TemplateRef`: name, language, slots). The only Cloud parsers in the tree are WisKey's own, inside the native bundle.
No export source exists here, and labels / logical refs are not a substitute.

- Status: **BLOCKED**. Exact ABI needed: a reader of the installed WhatsApp integration (its config entry / source, outside this
  repository) that yields per account `{account, api_version, business_id, phone_number_id, token}` and per approved template
  `{reference, revision, account, ui_language, template_id, name, language, body, parameter_fields}` exactly as
  `03_templates_queue/RESOURCE_EXPORT_CONTRACT.json`; Arx then calls `wiskey_auto_install.write_resources(doc)` (ready, tested).
- Technical owner: the supplier of the installed WhatsApp integration source (owner28: "Arx installer / original WhatsApp source
  adapter"); Arx lead wires the call once the source exists. No owner key / ref / YAML step, no invented account or template.
- Effect: the registry, queue and send paths are adopted; a missing resource file leaves WisKey's template installation `blocked_...`
  without resetting a valid registry or any other capability.

## Tests actually run (synthetic; workstation = `.venv` pytest unless noted; runs are not summed)

| Run | Scope | Code | Result |
|---|---|---|---|
| W1 | `test_wiskey_native_bundle_2272.py`, `test_bridge_install.py` | step 1 tree | 10 PASS |
| W2 | `test_wkr5_295.py` (after catalog update) | step 2 tree | 31 PASS |
| W3 | step-2 file + `test_wkr5_295`, `test_wa_template_send_w11`, `test_tplv2_295`, `test_wk4adopt_295`, `test_bridge_install`, `test_bridge_keyrot_harness_295`, `test_bridge_media_policy` | step 2 tree | 328 PASS, 0 FAIL |
| W4 | `test_wiskey_adopt_2272_install.py`, `test_wiskey_mac_adopt_298.py`, `test_wiskey_mac_adopt_298_review.py` | step 3 tree | first run 1 FAIL (`test_e_the_runtime_catalog_is_the_final_one` pinned the 27.10 catalog - updated in `69dcce9ba`); re-run 124 PASS, 2 SKIP (POSIX-only mode / symlink tests on Windows) |
| W5 | `test_wiskey_adopt_2272_features.py`, `test_wkjoin_295.py` | step 4 tree | 61 PASS (JUnit) |
| W6 | `test_wiskey_adopt_2272_installer.py`, `test_bridge_install.py` | step 5 tree | 14 PASS (JUnit) |
| B1 | `npx playwright test -c playwright.owner28.config.ts` (bundled Chromium, `--mute-audio`, synthetic sockets) | `287d99a2f` | 2 PASS (desktop, mobile): MSE frame + WebAudio RMS, mute / unmute, AudioContext closed on expiry |
| R1 | `run_smart.py tsc` (runner) | `287d99a2f` | tsc ok |
| R2 | `run_smart.py backend` (runner, full backend suite, started 28.10 22:45) | `287d99a2f` | FAILED: exit 1 after ~2 h, both shard summaries EMPTY (no test counts, no failure names reported back) - cause NOT_DIAGNOSED (could be a runner / shard timeout or real failures); re-run before relying on it |

Not run: the delivery's `reproduce_isolated.py` (WisKey-side recipe; needs a WisKey checkout at `0a099c53` and a HA python): NOT_RUN.
Full frontend Playwright suite, add-on image build (`npm run build:addon`), any live / device test: NOT_RUN.

## Owner-side and open items

- Installation at the owner: NOT_PERFORMED. Live / device: NOT_MEASURED. Door / microphone / speaker / real WhatsApp / new HA user: not
  touched (joint session with the owner present, with notices).
- Decision for the owner: turning `wiskey.auto_install` on (it stages WisKey rc.38 over whatever `hikvision_intercom` the platform runs
  and requests one platform restart) - only in the joint session.
- Contradiction recorded: `OWNER_EXCLUDED_WRITES` (earlier owner decision) vs owner28 "no allowlist" - review M2: the exclusion holds
  unless `wiskey.auto_install` is on; **the owner must confirm in writing** (before the switch is turned on) that Arx may write
  `jobs/approval_decide` / `jobs/approval_request`.
- `management/tasks.json` / test catalog rows not added (lead's call); `scripts/project_status.py --write` not run.

## Next steps (for whoever continues)

1. Read R2's result (runner output of the job started 28.10 22:45, or re-run `run_smart.py backend pilot/WISKEY-ADOPT-2272`); fix any red that this branch caused (`git diff 213fc7705..HEAD`).
2. Production v2 service writer: build a `ServiceWriteClient` over `wiskey_direct_join.JOIN.capture_port.call` with a dedicated journal
   connection and the install key (`load_or_create_key(settings.data_dir)`), and return
   `FinalServiceWriter.from_installation(join, grant=ManifestGrantSource(db), actor_id=...)` from `access_service_writer.writer_for` when
   the switch is on; keep the v1 path otherwise. Add a test that the switch off keeps it unavailable.
3. Use `TemplateJobs` / `EventCursor` from a background worker once the owner turns the switch on (an `InstalledWiskeyClient` per
   process, reconnect on `installation_changed_reconnect_required`); persist nothing but ids / cursors.
4. SOURCE-CLOUD-EXPORT: when the WhatsApp source exists, map it to the resources ABI above and call `write_resources`.
5. Release round only with owner approval: build the add-on image (bridge already 0.10.1), record the full merged SHA + artifact hash.
