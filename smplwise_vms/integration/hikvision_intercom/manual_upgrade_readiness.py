"""Existing HA-authenticated READ adapter. No new grant/pair or device reads."""

import hashlib
import json
from pathlib import Path

from .const import DOMAIN, VERSION


def fingerprint(value):
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def report(hass):
    from . import LOADED_BOOT_ID, LOADED_DISTRIBUTION, LOADED_PROCESS_ID
    from .installation_files import digest
    from .installation_readiness import inspect
    from .manual_upgrade_profile import enabled

    rows = []
    for entry in sorted(hass.config_entries.async_entries(DOMAIN), key=lambda e: e.entry_id):
        runtime = getattr(entry, "runtime_data", None)
        rows.append(
            {
                "entry_id": entry.entry_id,
                "unique_id": entry.unique_id,
                "title": entry.title,
                "version": entry.version,
                "minor_version": entry.minor_version,
                "disabled_by": entry.disabled_by,
                "state": entry.state.value,
                "loaded": runtime is not None and not runtime.is_closed,
                "data_sha256": fingerprint(dict(entry.data)),
                "options_sha256": fingerprint(dict(entry.options)),
            }
        )
    return {
        "contract": "wiskey-manual-upgrade-readiness.v1",
        "schema_version": 1,
        "profile": "owner_manual_existing" if enabled(hass) else "managed",
        "native": {
            "version": VERSION,
            "boot_id": LOADED_BOOT_ID,
            "process_id": LOADED_PROCESS_ID,
            "loaded_digest": LOADED_DISTRIBUTION,
            "installed_digest": digest(Path(__file__).parent),
        },
        "managed_installation": {
            "command": "installation/readiness_v1",
            "availability": "unavailable" if enabled(hass) else "use_original_signed_command",
            "reason": "manual_profile_no_installation_grant" if enabled(hass) else None,
            "inspection_scope": "original inspect only; not signed result envelope",
            "inspection": inspect(hass),
        },
        "entry_count": len(rows),
        "entries": rows,
        "physical": "NOT_MEASURED",
        "scope": "cached software inventory; not preservation or global HA health",
    }
