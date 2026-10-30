"""Constants for the SMPLWISE bridge."""
DOMAIN = "smplwise_bridge"
VERSION = "0.10.1"
# 0.10.1 (WISKEY-ADOPT-2272 review M6): the native intercom setup only for an automatic-install entry, started as a task (review H4) -
# bumped so an existing installation's copy is refreshed (bridge_install.install copies when the installed version differs).
# 0.9.6 (EXTID-295, Fable security review 4 of 2026-10-21): V-01 - the impact check refuses a step that carries more than one type key
# (runnable.ACTION_TYPE_KEYS: a device action with a decoy `action` key was judged as the decoy). Needs one Home Assistant restart (by the owner).
# also 0.9.6 (LEASEBR-295, combined with EXTID-295 in release 2.12.0 into ONE bridge 0.9.6, slice L4 of the capture lease, docs/contracts/wiskey-capture-lease/): two NEW signed services, `lease_event` and `lease_request`
# (lease_contract.py, lease_answers.py, lease_service.py). They verify the contract's stages 1-7 with the key set (KeySet.verify: rotation and key id
# keep working) and relay an immutable DTO to the WisKey consumer that registers itself (lease_service.async_register_consumer); with no consumer they
# fail and answer nothing. Nothing else changes, and nothing on the Arx side switches on by itself (the capture-lease route stays off until the owner's
# separate permit). The v1 wire is exactly the closed lease.schema.json (no kid); a lease signed by a rotated key still verifies. Needs one Home Assistant restart (by the owner) - the same single restart that loads 0.9.5 when 0.9.5 has not been loaded yet.
# 0.9.5 (HMACACT-295, the activation slice of CR-WISKEY-HMAC-ROTATION-295): the bridge holds a key set (keyset.py) instead of the bare pairing secret
# and answers the add-on's key-rotation control messages (the `rotate` service; signature v2 with a key id). Until the add-on starts a rotation
# everything is byte-identical to 0.9.4 (kid-less, the pairing secret), so an add-on updated before or after this bridge keeps working. Needs one
# Home Assistant restart (by the owner) - the same single restart that loads 0.9.4 when 0.9.4 has not been loaded yet.
# 0.9.4 (EXTID-295, CR-USR2 12.4 item 4 / 12.3 item 3): the runnable allowlist is picked in the options flow (a multi-entity picker of
# scripts / scenes / automations) instead of typed; the stored list and every check are unchanged. The options-flow text states the
# entity-policy residual risk. 0.9.3 stays reserved for the key-rotation branch (WXROT). Needs one Home Assistant restart (by the owner).
# 0.9.2 (SVCIDENT3, the 2.7.0 security review S1 / S2): the options-flow allowlist `local_identity_runnable` (empty by default) of the scripts /
# scenes / automations an Arx-only person may run, the impact check of each run (runnable.py) and the service user's entity policy on every
# entity of a message screened on behalf of an Arx-only person. Nothing changes for a Home Assistant user's own message.
# 0.9.1 (SVCIDENT2, owner decisions 2026-10-17): the options-flow switch `local_identity_extended` (off by default) - with it on, Arx-only users
# may open doors, run scripts / scenes, bypass alarm zones and read a camera stream source through the service identity (service_identity.py).
# 0.9.0 (USR2 phase 3): the service identity - an Arx-only (local) user acts through ONE configured non-administrator HA user (options flow),
# named with `on_behalf_of` and judged by service_identity.py (per-feature allow-list; automations never; admin ids refused).
# 0.8.0: no new service; the allow-list gained valve.open_valve, valve.close_valve, vacuum.pause, water_heater.turn_on / turn_off (equipment cards, add-on 2.4.0).
CONF_ADDON_URL = "addon_url"
CONF_PAIRING_CODE = "pairing_code"
# WISKEY-ADOPT-2272 review H4: written into the entry ONLY by the add-on's automatic-install discovery; without it the bridge never sets
# up the native intercom component itself
CONF_WISKEY_AUTO_INSTALL = "wiskey_auto_install"
DEFAULT_ADDON_URL = "http://0b8c26d5-smplwise-vms:8099"
SERVICE_EXECUTE = "execute"
SERVICE_SYNC = "sync_directory"
# 0.9.5 (HMACACT-295): the add-on's signed key-rotation control messages (keyset.py).
SERVICE_ROTATE = "rotate"
# 0.9.6 (LEASEBR-295): the capture lease's two services. The names are FINAL (WisKey, 2026-10-21); this is the one place that spells them (plus the two
# keys of services.yaml / strings.json, which a test pins to these constants).
SERVICE_LEASE_EVENT = "lease_event"
SERVICE_LEASE_REQUEST = "lease_request"
# 0.9.6 (LEASELIFE-295): the key of hass.data under which the bridge keeps its native lease capability (lease_service.LeaseCapability); WisKey's
# consumer registers through lease_service.async_register_consumer, never by writing this key. A foreign object found here is never trusted.
LEASE_CAPABILITY_KEY = f"{DOMAIN}_lease_capability"
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
# 0.9.2 (SVCIDENT3): the scripts / scenes / automations Arx-only users may run (entity ids), set by an HA administrator in the options flow; empty by default.
CONF_LOCAL_IDENTITY_RUNNABLE = "local_identity_runnable"
DIRECTORY_INTERVAL_S = 60
SIGNATURE_WINDOW_S = 60
