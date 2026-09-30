"""Constants for the SMPLWISE bridge."""
DOMAIN = "smplwise_bridge"
VERSION = "0.4.0"
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
DIRECTORY_INTERVAL_S = 60
SIGNATURE_WINDOW_S = 60
