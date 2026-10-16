# Add-on option removal: nvr_password (TKSECRETS1) and the remaining secrets (TKSECRETS2)

Home Assistant flagged "Insecure secrets detected in app configuration" because `nvr_password` could match a pwned password.
The NVR password already lives encrypted (AES-256-GCM) in `recorder_connections` and is managed from the in-app NVR connection
screen, so the option was only a legacy one-time import. It is removed from `smplwise_vms/config.yaml` (options and schema)
and from the self-update schema allow-list. `load_settings` no longer reads it from options.json (the `NVR_PASSWORD` environment
variable still works for dev runs) and never lists it in `nvr_option_keys`, so a missing option never raises and an existing
stored connection is untouched. No migration.

## TKSECRETS2: go2rtc_api_password, wiskey_password, wiskey_background_token, openai_api_key, push_relay_key

Every remaining add-on option of type `password` left the manifest (config.yaml options + schema, self_update.OPTION_TYPES):

| Former option | Consumer | Applies after a change in Settings |
|---|---|---|
| `go2rtc_api_password` | services/go2rtc.py (every go2rtc call), cast relay | request handlers at once; background stream sync at the next start |
| `wiskey_password` | services/wiskey_camera.py (station stills / video through go2rtc) | request handlers at once; workers at the next start |
| `wiskey_background_token` | services/wiskey_background_feed.py (started once at start-up) | the next start |
| `openai_api_key` | routers/skins.py, services/skins/provider.py | at once |
| `push_relay_key` | services/mobile_push.py (reads `SW_PUSH_RELAY_KEY`) | at once |

`wiskey_background_token` was not in the original list of four, but it was also `password?` in the schema and would keep the
warning alive, so it moved with the others. `go2rtc_api_username` and `wiskey_username` stay plain `str?` options (a user name
is not a secret, and only `password` fields are flagged).

- **Store:** the `app_secrets` table (migration 0093, provisional number), one row per secret name; the value is sealed with
  the per-install key of `recorder_connections` (`<data>/keys/connections.key`), associated data `app_secret|<name>|value`,
  `v1:` format. Not a backup table. A row that cannot be decrypted is `unreadable` and treated as not configured (fail closed).
- **Screen:** הגדרות › חיבורים › סודות (`system.configure`, local sessions only): set / replace / clear; the API answers only
  `configured`, `state`, `updated_at`, `updated_by` (+ display name) and `source`; "test connection" for the go2rtc password
  (GET `/api` of go2rtc) and the WisKey password (one station still through go2rtc) answers an outcome code only. Audit rows:
  `secret.update`, `secret.clear`, `secret.test`, `secret.import` - the secret NAME only, never a value.
- **Read order (config.py + services/secrets_store.py):** a store row decides (set = its value, cleared = none); with no row,
  the legacy option still present in options.json, then the developer environment variable (`GO2RTC_API_PASSWORD`,
  `WISKEY_PASSWORD`, `WISKEY_BACKGROUND_TOKEN`, `OPENAI_API_KEY`, `SW_PUSH_RELAY_KEY`). `load_settings` reads the old keys with
  `.get`, so an options.json without them never raises.
- **One-time migration (start-up, after the database migrations):** for each name, when options.json still carries a value
  and the store has NO row, the value is sealed into the store (`source = addon_import`) and one INFO line names the secret.
  Environment variables are never imported. Idempotent: a second start finds the row and does nothing; a row cleared by an
  administrator is never refilled from a lingering option. A key failure skips that name with one WARN line (the option keeps
  working until the next start).

## Supervisor behaviour on a removed option key: NOT VERIFIED

What the Supervisor does with a stale value already saved in an installed add-on's options (`nvr_password`, and since
TKSECRETS2 the five keys above) when the new version no longer declares it (dropped silently, kept as an unknown key, or a
validation error on the next options save/start) has NOT been verified. It must be checked on a real install (upgrade from a
build that still has the options, with values set) before release. Do not rely on a guess. The product side is written to be
safe either way: if the stale values stay in options.json they are imported once and then ignored; if they are dropped before
the first start of the new version, nothing is imported and the administrator enters the secrets in Settings (go2rtc video
behind a protected API, WisKey stills, AI skins and phone push stay off until then).

Also check on that install: whether the "Insecure secrets detected" repair issue clears by itself after the upgrade, or only
after the options are saved once.

## 2.6.3: transitional compatibility for ONE version (delta review S-1, lead decision 2026-10-16)

Because the Supervisor may drop option keys the new schema no longer declares at the first start of the new version (then the
one-time import would find nothing and every secret would become `not_set` - with a password-protected go2rtc API that is an
outage of live video), 2.6.3 declares the six former secret options again, as DEPRECATED optional `password?` options with empty
defaults: `nvr_password`, `go2rtc_api_password`, `wiskey_password`, `wiskey_background_token`, `openai_api_key`, `push_relay_key`
(config.yaml options + schema; `self_update.OPTION_TYPES` kind `cleared`, which lets an options write carry them ONLY empty).

- At start-up, after the migrations, `secrets_store.apply_at_startup` imports a lingering value into the store exactly as before
  (only when the store has no row for that name). `nvr_password` is still NOT imported (TKSECRETS1: the NVR password lives in the
  NVR connection screen).
- Then `secrets_store.clear_lingering_options` empties, through the one self-options writer (`self_update.call`,
  `POST /addons/self/options`, the whole options document written back with only those keys emptied), every deprecated option that
  still holds a value whose value is no longer needed: the store has a row for it (set or cleared), or - for `nvr_password` - the
  stored NVR connection holds a password. While any lingering value is still needed (its import failed), nothing is written.
- If the write is not possible (no Supervisor API, refused, an unknown key in options.json, a value still needed), nothing changes:
  one WARN line naming the options (never a value) and the system report (`/health/report`, system administrators) shows
  "סוד ישן עדיין שמור בהגדרות התוסף: יש להסיר אותו (<names>)". Home Assistant's "Insecure secrets" warning disappears once the
  options are empty.
- `load_settings()` no longer writes the legacy `push_relay_key` into `SW_PUSH_RELAY_KEY` (delta review S-2: it also runs at
  runtime, so a key rotated or cleared in the store came back). Without a store row the legacy value is applied once at start-up by
  the store's overlay.

Backups (delta review S-6): the statement "the key is never in a backup" holds for ARX backups only (`services/backup`, `keys/` is not
part of them). A Home Assistant add-on backup (`backup: hot`, no `backup_exclude`) contains BOTH `/data/keys/connections.key` and the
database, so encryption at rest does not protect the secrets (or the NVR password) inside an HA backup, which is often synced
off-site. Excluding the key from HA backups is an owner trade-off: a restore would then lose every stored secret. Not changed in 2.6.x.

Connection test of the WisKey password (delta review S-4): runs on a throwaway stream `smplwise_wiskey_probe_<random>` that is deleted
right after the test; the live station stream is never re-pointed. go2rtc older than 1.9.14 logs the whole source URL when a stream is
created, so on those versions a CANDIDATE password still appears once in go2rtc's own log per test (Arx cannot avoid giving go2rtc the
source). Arx's logs never carry it.

Frigate restream (delta review F-2): `restream_auth` = `account` sends the Frigate account password over RTSP (go2rtc may use Basic,
cleartext on the LAN) and stores it in go2rtc's in-memory stream source (readable via go2rtc's `GET /api/streams`, logged by go2rtc
< 1.9.14 on create) - the same model as the NVR sources; default off.

FOLLOW-UP (next version): remove the six keys from config.yaml (options + schema), from `self_update.OPTION_TYPES` (kind
`cleared`), `config.DEPRECATED_SECRET_OPTIONS` and `secrets_store.clear_lingering_options`.

STILL NOT VERIFIED - check on the first install of 2.6.3 (upgrade from a build whose options carry values): (1) what the Supervisor
does with the old values (kept because the keys are declared again - expected - or dropped); (2) that the import log lines name the
secrets and the store shows them `set`; (3) that the options are empty afterwards (Arx's options write was accepted) and the
"Insecure secrets" repair issue cleared; (4) if not, that the system report lists the names.
