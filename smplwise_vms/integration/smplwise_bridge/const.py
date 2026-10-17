"""Constants for the SMPLWISE bridge."""
DOMAIN = "smplwise_bridge"
VERSION = "0.9.1"
# 0.9.1 (SVCIDENT2, owner decisions 2026-10-17): the options-flow switch `local_identity_extended` (off by default) - with it on, Arx-only users
# may open doors, run scripts / scenes, bypass alarm zones and read a camera stream source through the service identity (service_identity.py).
# 0.9.0 (USR2 phase 3): the service identity - an Arx-only (local) user acts through ONE configured non-administrator HA user (options flow),
# named with `on_behalf_of` and judged by service_identity.py (per-feature allow-list; automations never; admin ids refused).
# 0.8.0: no new service; the allow-list gained valve.open_valve, valve.close_valve, vacuum.pause, water_heater.turn_on / turn_off (equipment cards, add-on 2.4.0).
CONF_ADDON_URL = "addon_url"
CONF_PAIRING_CODE = "pairing_code"
DEFAULT_ADDON_URL = "http://0b8c26d5-smplwise-vms:8099"
SERVICE_EXECUTE = "execute"
SERVICE_SYNC = "sync_directory"
# 0.2.5 (CR-007 slice 4): the one registry (config) write this product ever makes - move an entity to an HA area.
SERVICE_SET_AREA = "set_entity_area"
# 0.3.0 (CR-014): signed writes to the Scheduler component (docs/architecture/SCHEDULER_API.md section 8).
SERVICE_SCHEDULE = "schedule"
# 0.3.1: a signed READ-ONLY question - the stream source of ONE camera entity the owner chose to show live (stream_source_service.py).
SERVICE_STREAM_SOURCE = "stream_source"
# 0.5.0 (CR-016): a signed READ-ONLY question about the music layer of a speaker - its queue, or the library (media_query_service.py).
SERVICE_MEDIA_QUERY = "media_query"
# 0.6.0 (CR-017): signed writes to the automations, scripts and scenes of the installation (config_policy.py, config_store.py, config_service.py) and the runtime ops on them.
SERVICE_CONFIG_ITEM = "config_item"
# 0.6.0: the owner-approved delegation switch (CR-017 section 8.3), in the options flow: off by default; an HA administrator turns it on inside Home Assistant.
# 0.6.1 (schedules: more actions): the schedule allow-list (schedule_policy.ACTION_ARGS) gains scripts with their variables, scenes, helpers,
# humidifiers, vacuums, cover tilt and climate swing / humidity - each still checked by shape and range here, by capability in the add-on.
# 0.6.2 (0.1.163; 0.6.1 shipped in 0.1.162 without them), owner decisions of 2026-10-04: sirens (sensitive), media players (on / off,
# play / pause / stop, volume, source) and number / select values join the schedule allow-list.
# 0.7.0 (CR-028 phase 1, "שדר למסך"): ONE narrow service that plays the add-on's cast-relay URL on a Google Cast media_player (and stops /
# switches it off), re-checked by cast_policy.py: the URL's origin must be the one the paired add-on announced (signed) and an address of
# this host. The CR-015 refusal of every other `play_media` URL on `execute` is unchanged.
SERVICE_CAST_STREAM = "cast_stream"
CONF_DELEGATED_AUTHORING = "delegated_authoring"
CONF_DELEGATED_CHANGED_AT = "delegated_changed_at"
# 0.9.0 (USR2 phase 3): the service identity's HA user id (32 hex), set by an HA administrator in the options flow; never an administrator.
CONF_SERVICE_USER_ID = "service_user_id"
# 0.9.1 (SVCIDENT2): the extended mode of the service identity, set by an HA administrator in the options flow; off by default.
CONF_LOCAL_IDENTITY_EXTENDED = "local_identity_extended"
DIRECTORY_INTERVAL_S = 60
SIGNATURE_WINDOW_S = 60
