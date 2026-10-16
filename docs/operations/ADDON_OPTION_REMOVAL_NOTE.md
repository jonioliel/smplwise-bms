# Add-on option removal: nvr_password (TKSECRETS1)

Home Assistant flagged "Insecure secrets detected in app configuration" because `nvr_password` could match a pwned password.
The NVR password already lives encrypted (AES-256-GCM) in `recorder_connections` and is managed from the in-app NVR connection
screen, so the option was only a legacy one-time import. It is removed from `smplwise_vms/config.yaml` (options and schema)
and from the self-update schema allow-list. `load_settings` no longer reads it from options.json (the `NVR_PASSWORD` environment
variable still works for dev runs) and never lists it in `nvr_option_keys`, so a missing option never raises and an existing
stored connection is untouched. No migration.

## Supervisor behaviour on a removed option key: NOT VERIFIED

What the Supervisor does with a stale `nvr_password` value already saved in an installed add-on's options when the new version
no longer declares it (dropped silently, kept as an unknown key, or a validation error on the next options save/start) has NOT
been verified. It must be checked on a real install (upgrade from a build that still has the option, with a value set) before
release. Do not rely on a guess.

Related, not in scope here (TKSECRETS2): go2rtc_api_password, wiskey_password, openai_api_key, push_relay_key.
