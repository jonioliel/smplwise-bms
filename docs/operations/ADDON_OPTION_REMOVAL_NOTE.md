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
