"""Versioned distribution readiness on the original authenticated native transport.

Bootstrap manifest v1 remains unchanged. Loaded snapshots are captured once by
both package loaders, then compared with the complete installed distributions.
"""

import sys
from pathlib import Path

from . import LOADED_BOOT_ID, LOADED_DISTRIBUTION, LOADED_PROCESS_ID
from .access.models import AccessError
from .installation_files import digest, locked_generation

RELATIVE = ".storage/hikvision_intercom.arx_installation/generation.json"


def _inspect_locked(hass):
    base = {
        "contract": "wiskey-installation-readiness.v1",
        "schema_version": 1,
        "state": "not_ready",
        "reason": "generation_missing",
        "generation_id": None,
        "boot_id": LOADED_BOOT_ID,
        "process_id": LOADED_PROCESS_ID,
        "expected": {},
        "staged": {},
        "installed": {},
        "loaded": {},
        "bridge_boot_id": None,
        "restart": None,
    }
    try:
        from .installation_controller import read_projection

        controller = read_projection(hass.config.config_dir)
        state = {
            "generation_id": controller["generation_id"],
            "expected": controller["expected"],
            "staged": controller["staged"],
            "state": controller["phase"],
            "restart": {
                "state": "not_requested"
                if controller["state"] == "staged"
                else "unknown"
                if controller["state"] == "restart_unknown"
                else "requested",
                "boot_id": controller["restart_boot_id"],
            },
        }
        base.update(
            generation_id=state["generation_id"],
            expected=state["expected"],
            staged=state["staged"],
            restart=state["restart"],
        )
        if state["state"] != "installed":
            base["reason"] = "generation_not_installed"
            return base
        if type(state["expected"]) is not dict or set(state["expected"]) != {
            "hikvision_intercom",
            "smplwise_bridge",
        }:
            base["reason"] = "generation_invalid"
            return base
        root = Path(hass.config.path("custom_components"))
        base["installed"] = {name: digest(root / name) for name in state["expected"]}
        bridge = sys.modules.get("custom_components.smplwise_bridge")
        base["loaded"] = {
            "hikvision_intercom": LOADED_DISTRIBUTION,
            "smplwise_bridge": getattr(bridge, "LOADED_DISTRIBUTION", None),
        }
        base["bridge_boot_id"] = getattr(bridge, "LOADED_BOOT_ID", None)
        from .installation_controller import execution_key, executions

        receipt = (
            executions(hass.config.config_dir)["records"].get(
                execution_key(controller["generation_id"], controller["claim_id"])
            )
            if controller["claim_id"]
            else None
        )
        if receipt is not None and receipt["boot_id"] == LOADED_BOOT_ID:
            base["reason"] = (
                "restart_request_failed" if receipt["state"] == "failed" else "restart_pending"
            )
        elif getattr(bridge, "LOADED_PROCESS_ID", None) != LOADED_PROCESS_ID:
            base["reason"] = "bridge_not_loaded"
        elif set(state["expected"]) != {"hikvision_intercom", "smplwise_bridge"}:
            base["reason"] = "generation_invalid"
        elif not all(base[k] == state["expected"] for k in ["staged", "installed", "loaded"]):
            base["reason"] = "distribution_digest_mismatch"
        else:
            if read_projection(hass.config.config_dir) != controller:
                base["reason"] = "generation_not_installed"
            else:
                base.update(state="ready", reason=None)
        return base
    except FileNotFoundError:
        return base
    except (OSError, ValueError, KeyError, TypeError, AccessError):
        base["reason"] = "generation_or_distribution_unavailable"
        return base


async def request_restart(hass, principal):
    """Explicit v1 adapter: consumes an existing Arx claim, never creates one."""
    from .installation_controller import execute_restart, read_projection
    from .trusted_actions.validation import Refusal

    try:
        value = await hass.async_add_executor_job(read_projection, hass.config.config_dir)
    except (OSError, ValueError):
        raise Refusal("arx_restart_claim_required") from None
    if value["claim_id"] is None:
        raise Refusal("arx_restart_claim_required")
    result = await execute_restart(
        hass,
        principal,
        {
            "schema_version": 2,
            "generation_id": value["generation_id"],
            "claim_id": value["claim_id"],
            "source_digest": value["source_digest"],
            "expected": value["expected"],
        },
    )
    return {
        "contract": "wiskey-installation-restart.v1",
        "schema_version": 1,
        "state": "requested" if result["state"] == "accepted" else "already_recorded",
        "replay_available": False,
        "generation_id": result["generation_id"],
        "request_boot_id": result["request_boot_id"],
    }


def inspect(hass):
    """Read one generation image under the same lock as paired activation."""
    with locked_generation(Path(hass.config.path("."))):
        return _inspect_locked(hass)
