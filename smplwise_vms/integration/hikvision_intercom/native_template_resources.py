"""Read original private installer resources, no owner YAML/ref/key step.

The joint Arx installer exports its already provisioned Cloud accounts and
approved template definitions. Missing provider assets are an external dependency,
never permission to fabricate an approved template or credential.
"""

from pathlib import Path

from homeassistant.config_entries import ConfigEntryState

from .access.native_sqlite_backup import read_private
from .const import DOMAIN
from .trusted_actions.validation import strict_json

RELATIVE_PATH = f".storage/{DOMAIN}.arx_installation/resources.json"
FORMAT = "wiskey-local-template-resources.v1"


async def discover(hass):
    from .native_template_installation import configuration

    def load():
        try:
            return strict_json(
                read_private(Path(hass.config.path(RELATIVE_PATH)), limit=1048576), limit=1048576
            )
        except FileNotFoundError:
            return None

    try:
        value = await hass.async_add_executor_job(load)
        if value is None:
            return None, "blocked_original_cloud_resources_unavailable"
        if (
            type(value) is not dict
            or set(value) != {"format", "accounts", "templates"}
            or value["format"] != FORMAT
        ):
            return None, "blocked_original_cloud_resource_schema"
        stations = [
            entry
            for entry in hass.config_entries.async_entries(DOMAIN)
            if entry.state is ConfigEntryState.LOADED
        ]
        bridges = [
            entry
            for entry in hass.config_entries.async_entries("smplwise_bridge")
            if entry.state is ConfigEntryState.LOADED
        ]
        if not stations or len(bridges) != 1:
            return None, "waiting_for_original_entries"
        station = sorted(stations, key=lambda entry: entry.entry_id)[0]
        return configuration(
            {
                "schema_version": 1,
                "station_id": station.entry_id,
                "bridge_entry_id": bridges[0].entry_id,
                "accounts": value["accounts"],
                "templates": value["templates"],
            }
        ), "discovered_original_resources"
    except Exception:
        return None, "blocked_original_cloud_resource_schema"


async def migrate_existing_configuration(hass, value):
    """Automatically preserve an already configured original native resource source."""
    import json

    from homeassistant.util.file import write_utf8_file_atomic

    from .access.native_sqlite_backup import private_directory
    from .native_template_installation import configuration

    if value is None:
        return
    try:
        configuration(value)  # Validate with the original account/template parser.
    except Exception:
        # The existing installer reports this source blocker. An invalid legacy
        # resource must not prevent independent access/event/authority setup.
        return
    data = {"format": FORMAT, "accounts": value["accounts"], "templates": value["templates"]}

    def write():
        path = Path(hass.config.path(RELATIVE_PATH))
        private_directory(path.parent)
        write_utf8_file_atomic(str(path), json.dumps(data), private=True)

    await hass.async_add_executor_job(write)
