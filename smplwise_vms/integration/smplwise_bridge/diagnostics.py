"""0.10.3 (BRIDGE-STALE-DISCOVERY-2383): the entry's diagnostics (Settings > Devices & services > SMPLWISE Bridge > Download diagnostics).

Only the state of the bridge's signed pushes to the add-on (push_health.py) and whether the entry holds a pairing code. Never the code, a
key, a signature, the add-on's address or a user."""
from __future__ import annotations

from typing import Any

from .const import CONF_PAIRING_CODE, DOMAIN, VERSION


async def async_get_config_entry_diagnostics(hass: Any, entry: Any) -> dict[str, Any]:
    health = hass.data.get(f"{DOMAIN}_push_health", {}).get(entry.entry_id)
    return {"version": VERSION, "pairing_code_in_entry": bool((entry.data or {}).get(CONF_PAIRING_CODE)),
            "directory_push": health.state() if health is not None else {"reason": "not_loaded"}}
