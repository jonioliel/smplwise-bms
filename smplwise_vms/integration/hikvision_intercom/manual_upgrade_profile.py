"""Scoped owner-initiated manual deployment; never an authorization bypass.

The verified manual artifact carries BUNDLE_MARKER. The offline owner tool also
preserves this nonsecret deployment boundary at CONFIG_MARKER for future HACS
code updates. Neither marker is a grant or user-entered configuration.
"""

import json
from pathlib import Path

KEY = "manual_existing_upgrade_profile"
BUNDLE_MARKER = "_manual_upgrade_profile.json"
CONFIG_MARKER = "hikvision_intercom_manual_upgrade.json"
PROFILE = {
    "format": "wiskey-manual-existing-upgrade.v1",
    "schema_version": 1,
    "mode": "owner_manual_existing",
    "automatic_authority": False,
    "parallel_arx_installation": False,
}


def read(root, component=None):
    paths = [Path(root) / CONFIG_MARKER]
    paths.append(
        (Path(component) if component is not None else Path(__file__).parent) / BUNDLE_MARKER
    )
    found = False
    for path in paths:
        if path.is_symlink():
            raise ValueError("manual_upgrade_profile_invalid")
        try:
            raw = path.read_bytes()
        except FileNotFoundError:
            continue
        if len(raw) > 4096:
            raise ValueError("manual_upgrade_profile_invalid")
        value = json.loads(raw)
        if value != PROFILE or type(value.get("schema_version")) is not int:
            raise ValueError("manual_upgrade_profile_invalid")
        found = True
    if found and (paths[1]).exists() and not paths[0].exists():
        from homeassistant.util.file import write_utf8_file_atomic

        # Operational deployment boundary, not entry-schema/authority migration.
        write_utf8_file_atomic(str(paths[0]), json.dumps(PROFILE), private=True)
    return found


async def initialize(hass):
    from .const import DOMAIN

    namespace = hass.data.setdefault(DOMAIN, {})
    if KEY not in namespace:
        # Fail before storage/admission startup if a deployment boundary is bad.
        namespace[KEY] = await hass.async_add_executor_job(read, hass.config.config_dir)
    return namespace[KEY]


def enabled(hass):
    from .const import DOMAIN

    return hass.data.get(DOMAIN, {}).get(KEY) is True
