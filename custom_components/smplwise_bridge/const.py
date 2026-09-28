"""Constants for the SMPLWISE bridge."""
DOMAIN = "smplwise_bridge"
VERSION = "0.2.5"
CONF_ADDON_URL = "addon_url"
CONF_PAIRING_CODE = "pairing_code"
DEFAULT_ADDON_URL = "http://0b8c26d5-smplwise-vms:8099"
SERVICE_EXECUTE = "execute"
SERVICE_SYNC = "sync_directory"
# 0.2.5 (CR-007 slice 4): the one registry (config) write this product ever makes - move an entity to an HA area.
SERVICE_SET_AREA = "set_entity_area"
DIRECTORY_INTERVAL_S = 60
SIGNATURE_WINDOW_S = 60
