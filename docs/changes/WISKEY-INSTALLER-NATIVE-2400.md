# WISKEY-INSTALLER-NATIVE-2400 - WisKey's installer tools, natively in Arx

Owner decision 03.11 (plan `private/planning/WISKEY_FULL_INTEGRATION_PLAN_2026-11-03.md`, Q7 "ג"): every WisKey installer tool lives
in Arx - rows 47 (station technical settings), 50 (platform), 51 (clock / NTP) and 82 (capacity). Branch
`pilot/WISKEY-INSTALLER-NATIVE-2400` from `origin/main` (v2.38.0, `efc12d0e3`), target 2.40.0. Delivered in phases, one commit (plus
fixes) per phase, each closed with green tests before the next.

Verified against WisKey `C:\hik intercom`, ref `origin/codex/wiskey-mac-m12-policy-b-2026-11-02` (`2834aa5e`, manifest
2.0.1-rc.10), read with `git archive` into the scratchpad; the frames are validated in tests against the static rc.10 extract
`docs/integrations/wiskey/catalog/rc10-extract/` (byte-identical copy of the files on `pilot/WISKEY-RC10-PIN-2382`, so the two branches
merge without a conflict).

## Where it lives

- UI: הגדרות › **התקנה ותחזוקת מערכת האינטרקום** - `#/system/intercom-installer/<tool>` (tab "התקנת האינטרקום" of the settings row,
  settings index group "מערכת ותשתית"). system.configure at the installation; installation-only href.
- API: `/api/v1/access-control/installer/...` (routers `wiskey_installer*.py`), every route system.configure at the installation.
- WisKey channel: a new closed channel `installer` in `services/wiskey_channels.py` (same socket and identity as `service`, its own
  guard). **Shared edit:** `INSTALLER`, `ALLOWLISTS`, `ADAPTER_CHANNELS`, `HA_FRAMES`, `describe()` - the same five spots
  `pilot/WISKEY-STATION-OPS-2390` edits for its `maintenance` channel; when both merge, the second one keeps both entries (a trivial
  textual conflict). The tests `test_wiskey_channels.py` (channel tuple) and `test_pwclean_295.py` (pre-cleanup catalog excludes the new
  channel) are adjusted the same way.
- `main.py`: one include line (after the bulk-people router, not next to station-ops' line).

## Deep links (pilot/WISKEY-DEEPLINKS-2382 is NOT merged)

Native routes to register in the deep-link map once it merges (capability -> native route):

| Capability (plan row) | Native route |
|---|---|
| clock / NTP (51) | `#/system/intercom-installer/clock` |
| station technical settings (47) | `#/system/intercom-installer/technical` |
| station lifecycle: add / re-onboard / remove / replace (50) | `#/system/intercom-installer/lifecycle` |
| platform config, import / export, webhooks, maintenance queue, retention, integrity, capacity (50, 82) | `#/system/intercom-installer/platform` |

## Rules for every write

- system.configure at the installation, checked before the body is read (audited 403).
- Command envelope (`client_request_id`, `expires_at` <= 60 s; expired / duplicate refused), `confirmed: true` from the confirmation
  dialog; dangerous writes also need `typed_confirmation` equal to the phrase the server names (the station's name, or the operation's
  Hebrew word).
- Arx limits (`services/wiskey_installer.Limits`): one installer write at a time installation-wide, 12 per operator per minute, a
  cool-down per operation and target counted only after a send; 429 with `retry_after_s`.
- Audit: attempt (committed before sending) + outcome rows; the real actor, the operation, the target, WisKey's code and a summary
  without secrets.
- Honest results: `completed` (with WisKey's own verification facts), `refused` (WisKey's code; nothing changed), `unknown` (sent, no
  clear answer, incl. WisKey's `readback_mismatch` / `ambiguous_write`), `not_sent`. Never retried, never queued; the dialog stays locked
  while a call is out and shows the elapsed time against WisKey's own limit.

## Phase 1 - clock / NTP

| Arx | WisKey command (rc.10) | Keys | Notes |
|---|---|---|---|
| `GET installer/clock` | `clock/settings_get`, `clock/host_status` | - | + every station's last measured clock from the served copy (no device read); each part has its own state |
| `GET installer/clock/stations/{id}` | `health/get` (READ channel) | `station_id` | WisKey's last measurement; cached 15 s |
| `PUT installer/clock/settings` | `clock/settings_update` | `revision`, `values{server,port,interval}` | confirm; validated with WisKey's own rules first; WisKey: "saving never changes a device" |
| `POST installer/clock/host-apply` | `clock/host_apply` | `revision` | typed "שעון השרת"; WisKey refuses unless the host advertises NTP and the port is 123 |
| `POST installer/clock/stations/{id}/sync` | `clock/station_sync` | `station_id`, `revision`, `copy_system` | typed = station name; online only; 58 s wait (WisKey caps at 50 s); result carries `configuration_verified` / `clock_verified` |

Not duplicated: a fresh device read of one station's clock is station-ops' `stations/clock_refresh` (`maintenance` channel).

Tests: `tests/test_wiskey_installer_clock.py` (20, fake WisKey on the rc.10 extract), `frontend/tests/unit-wiskey-installer.spec.ts`,
`frontend/tests/evidence-wiskey-installer.spec.ts` (desktop + mobile, two pixel-stable baselines).

## Phase 2 - station technical settings

| Arx | WisKey command (rc.10) | Keys | Notes |
|---|---|---|---|
| `GET installer/technical/stations/{id}[?fresh=true]` | `stations/technical_get` | `station_id` | device read (identity, capability flags, password PRESENCE booleans, both doors with bounds, relay selection); cached 15 s |
| `PUT installer/technical/stations/{id}/doors/{door}` | `stations/technical_update` | `station_id`, `door`, `expected`, `changes`, `confirmed` | confirm; a `relayReverseEnabled` change needs the typed station name; online only; only doors of the confirmed relay mapping (WisKey refuses others) |

Tests: `tests/test_wiskey_installer_technical.py` (9), unit + browser specs (two pixel-stable baselines).

## Phase 3 - add, re-onboard, remove, replace

Adding / re-onboarding is WisKey's config-entry flow (rc.10 keeps onboarding there), driven through Home Assistant's flow REST API
(`POST /api/config/config_entries/flow` with `handler: hikvision_intercom` and, for re-onboarding, `entry_id`; `POST .../flow/{id}`;
`DELETE .../flow/{id}`) with the add-on's identity. Closed step keys per step (`user`/`reconfigure`, `confirm_device`, `locks`, `mapping`,
`confirm_mapping`); only flows Arx started, by their owner, at the waiting step; at most two at once; 15-minute TTL. Credentials go to
the flow only (no store, log, audit, reply; the form drops the password once sent). `mapping` (WisKey pulses the relay) needs the typed
phrase "פתיחת דלת לבדיקה"; `locks` / `confirm_mapping` (they save) get the confirmation dialog.

| Arx | WisKey | Notes |
|---|---|---|
| `POST installer/onboarding` / `.../{flow}/steps/{step}` / `.../{flow}/abort` | config flow (REST) | audit: step id, result type, error codes, created entry id/title - never an input |
| `GET installer/lifecycle` | `platform/lifecycle_jobs` (READ) | job states = progress |
| `GET installer/lifecycle/review` | `platform/lifecycle_review` (READ) | counts and blocker codes only; WisKey's per-person rows are dropped |
| `GET installer/lifecycle/jobs/{id}/plan` | `platform/lifecycle_plan` (READ) | |
| `POST installer/lifecycle/prepare` | `platform/lifecycle_prepare` | confirm; refused by WisKey while a blocker stands |
| `POST installer/lifecycle/jobs/{id}/apply` | `platform/lifecycle_apply` | typed = the source station's name, read from WisKey's own job |
| `POST installer/lifecycle/jobs/{id}/verify` | `platform/lifecycle_verify` | confirm |
| `POST installer/lifecycle/jobs/{id}/remove` | `platform/lifecycle_remove` | typed = the source station's name |

Tests: `tests/test_wiskey_installer_lifecycle.py` (11), unit + browser specs (two pixel-stable baselines).

## Phase 4 - the rest of the platform

| Arx | WisKey command | Notes |
|---|---|---|
| `GET installer/platform` | `platform/get`, `capacity`, `integrity`, `maintenance_jobs`, `demo` (READ) | each part its own state; no key in the view |
| `GET installer/platform/export` | `platform/export` | no-store; WisKey's preferences file (no users, rights, keys, destinations) |
| `PUT installer/platform/stations/{id}` | `platform/save` (`collection: stations`) | confirm; metadata, alert thresholds, maintenance window |
| `PUT installer/platform/webhook` | `platform/webhook_save` | confirm; https only (validated before sending); audit without the URL |
| `POST installer/platform/webhook/key` | `platform/webhook_key` | typed "הצגת המפתח"; the key reaches the caller once (no-store), never an audit row or a log |
| `POST installer/platform/import/preview` -> `.../import/apply` | `platform/import_preview` / `import_apply` | typed "ייבוא תצורה"; station mapping required |
| `POST installer/platform/retention/preview` -> `.../retention/apply` | `platform/retention_preview` / `retention_apply` | typed "מחיקת אירועים"; shows how many records go |
| `POST installer/platform/config/read` / `.../config/preview` -> `.../config/apply` | `platform/config_read` / `config_preview` / `config_apply` | typed "החלה על העמדות"; 1-12 stations; a receipt per station (partial failure shown per station) |
| `POST installer/platform/maintenance/preview` -> `.../maintenance/enqueue` | `platform/maintenance_preview` / `maintenance_enqueue` | typed "תזמון תחזוקה"; WisKey writes inside each station's window; queue states = progress |
| `POST installer/platform/maintenance/jobs/{id}/cancel` | `platform/maintenance_cancel` | confirm; current fingerprint required |

Not driven (decisions recorded in `services/wiskey_installer_platform.py`): `config_pending|config_review|config_decide`,
`maintenance_decide`, `lifecycle_decide` (WisKey dual approval needs a second WisKey administrator), `maintenance_resume_v1` (native
owner, policy B), `archive` / `report` (event history with person data), `delete` (WisKey panel objects).

Tests: `tests/test_wiskey_installer_platform.py` (8), unit + browser specs (one pixel-stable baseline).

## WisKey gaps found

- (phase 1) `clock/station_sync` has no dry-run / preview: Arx shows the saved values and the station's last measurement instead.
- (phase 1) `clock/host_apply` replaces the host's server list with ONE server and clears the fallbacks; there is no way to keep them.
- (phase 2) `stations/technical_update` answers both the pre-write "changed, reload" check and the post-write readback mismatch as
  `device_unavailable` (websocket.py HikvisionError branch) - Arx must treat it as UNKNOWN. Ask: distinct codes (`stale_expected` /
  `readback_mismatch`). `stations/technical_update` has no preview / dry run; Arx shows its own before / after.
- (phase 3) Adding a station has no WebSocket command; it exists only as the HA config flow, so Arx needs the HA flow API (admin
  token) - not the WisKey channel and not the bridge. HA's `entry_id` start of a reconfigure flow is assumed from HA core (verify in the lab).
- (phase 3) The `mapping` step physically pulses the door with no separate "test only" command; the relay test cannot be done without
  the onboarding flow.
- (phase 3/4) Dual approval (`*_decide`): Arx has one WisKey identity, so with WisKey's dual approval on, lifecycle apply / remove and
  fleet config apply are refused (`approval_required`) - the second approval must be done in WisKey's panel.
- (phase 4) `platform/config_apply` writes up to 12 stations sequentially in ONE call (up to 40 s each); beyond ha_client's 60 s Arx
  reports an unknown outcome while WisKey continues; the receipts in `platform/get` are the record. Ask: a job id + receipt query, like
  the maintenance queue.
- (phase 4) `platform/webhook_key` reveals the key in plain text; no rotation command exists.

## Migration

None (no table). Process memory only for the limits and the 15 s check cache.

## Rollback

Revert the branch's commits; nothing persists outside the audit log.
