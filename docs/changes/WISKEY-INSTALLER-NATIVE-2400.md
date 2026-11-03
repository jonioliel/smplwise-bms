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

(Each later phase adds its rows below.)

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

## WisKey gaps found

- (phase 1) `clock/station_sync` has no dry-run / preview: Arx shows the saved values and the station's last measurement instead.
- (phase 1) `clock/host_apply` replaces the host's server list with ONE server and clears the fallbacks; there is no way to keep them.

## Migration

None (no table). Process memory only for the limits and the 15 s check cache.

## Rollback

Revert the branch's commits; nothing persists outside the audit log.
