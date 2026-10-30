"""Arx-owned projection and signed restart executor, never a generation decision maker.

The SQLite setting wiskey.installation.generation belongs to Arx. The projection
is invalidated BEFORE source replacement and published only from committed Arx
state. Missing/changed projection fails closed; R2 history is never overwritten.
"""

import hashlib
import json
import re
from pathlib import Path

from homeassistant.util.file import write_utf8_file_atomic

from .access.native_sqlite_backup import read_private
from .installation_files import locked_generation
from .trusted_actions.validation import Refusal

PROJECTION = ".storage/hikvision_intercom.arx_installation/controller.v1.json"
EXECUTIONS = ".storage/hikvision_intercom.arx_installation/restart_executions.v1.json"
NAMES = {"smplwise_bridge", "hikvision_intercom"}
STATES = {"staged", "restart_claimed", "restart_requested", "restart_unknown"}


def _ref(value):
    return (
        type(value) is str
        and 1 <= len(value) <= 128
        and not any(ord(c) < 32 or ord(c) == 127 for c in value)
    )


def component_map(value, *, full=False):
    if type(value) is not dict or set(value) - NAMES or full and set(value) != NAMES:
        raise ValueError("controller_projection_invalid")
    if any(type(v) is not str or re.fullmatch("[0-9a-f]{64}", v) is None for v in value.values()):
        raise ValueError("controller_projection_invalid")
    return value


def projection(value):
    fields = {
        "format",
        "schema_version",
        "controller",
        "generation_id",
        "source_digest",
        "claim_id",
        "state",
        "phase",
        "expected",
        "staged",
        "installed",
        "restart_boot_id",
    }
    if (
        type(value) is not dict
        or set(value) != fields
        or value["format"] != "wiskey-arx-generation-projection.v1"
        or type(value["schema_version"]) is not int
        or value["schema_version"] != 1
        or value["controller"] != "arx-sqlite:wiskey.installation.generation"
        or not _ref(value["generation_id"])
        or not _ref(value["source_digest"])
        or value["claim_id"] is not None
        and not _ref(value["claim_id"])
        or type(value["state"]) is not str
        or value["state"] not in STATES
        or value["phase"] not in ("staging", "installing", "installed")
        or value["restart_boot_id"] is not None
        and not _ref(value["restart_boot_id"])
    ):
        raise ValueError("controller_projection_invalid")
    for key in ["expected", "staged", "installed"]:
        component_map(value[key], full=key == "expected")
    if (
        value["phase"] == "installed"
        and not value["expected"] == value["staged"] == value["installed"]
    ):
        raise ValueError("controller_projection_invalid")
    if value["state"] != "staged" and value["claim_id"] is None:
        raise ValueError("controller_projection_invalid")
    return value


def read_projection(config_root):
    return projection(json.loads(read_private(Path(config_root) / PROJECTION, limit=1048576)))


def executions(config_root):
    try:
        value = json.loads(read_private(Path(config_root) / EXECUTIONS, limit=16777216))
    except FileNotFoundError:
        return {"format": "wiskey-restart-executions.v1", "schema_version": 1, "records": {}}
    if (
        type(value) is not dict
        or set(value) != {"format", "schema_version", "records"}
        or value["format"] != "wiskey-restart-executions.v1"
        or type(value["schema_version"]) is not int
        or value["schema_version"] != 1
        or type(value["records"]) is not dict
    ):
        raise Refusal("restart_execution_history_invalid")
    for key, row in value["records"].items():
        if (
            type(key) is not str
            or re.fullmatch("[0-9a-f]{64}", key) is None
            or type(row) is not dict
            or set(row)
            != {"generation_id", "claim_id", "request_digest", "boot_id", "process_id", "state"}
            or not all(_ref(row[k]) for k in ["generation_id", "claim_id", "boot_id"])
            or type(row["request_digest"]) is not str
            or re.fullmatch("[0-9a-f]{64}", row["request_digest"]) is None
            or type(row["process_id"]) is not int
            or row["process_id"] < 1
            or row["state"] not in ("accepted", "failed")
        ):
            raise Refusal("restart_execution_history_invalid")
    return value


def execution_key(generation, claim):
    return hashlib.sha256(
        json.dumps([generation, claim], separators=(",", ":")).encode()
    ).hexdigest()


def validate_request(params):
    if (
        type(params) is not dict
        or set(params)
        != {"schema_version", "generation_id", "claim_id", "source_digest", "expected"}
        or type(params["schema_version"]) is not int
        or params["schema_version"] != 2
        or not all(_ref(params[k]) for k in ["generation_id", "claim_id", "source_digest"])
    ):
        raise Refusal("invalid_fields")
    try:
        component_map(params["expected"], full=True)
    except ValueError:
        raise Refusal("invalid_fields") from None
    return params


async def execute_restart(hass, principal, params):
    """Execute one signed Arx claim. Persistence is dedup evidence, not policy."""
    from . import LOADED_BOOT_ID, LOADED_PROCESS_ID
    from .installation_files import digest

    params = validate_request(params)
    root = Path(hass.config.config_dir)
    request_hash = hashlib.sha256(
        json.dumps(params, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    key = execution_key(params["generation_id"], params["claim_id"])

    def accept():
        with locked_generation(root):
            current = read_projection(root)
            if (
                current["generation_id"] != params["generation_id"]
                or current["claim_id"] != params["claim_id"]
                or current["source_digest"] != params["source_digest"]
                or current["expected"] != params["expected"]
            ):
                raise Refusal("restart_claim_stale")
            history = executions(root)
            row = history["records"].get(key)
            if row is not None:
                if row["request_digest"] != request_hash:
                    raise Refusal("restart_claim_conflict")
                return False, row
            if current["state"] != "restart_claimed" or current["phase"] != "installed":
                raise Refusal("restart_claim_not_pending")
            if any(
                digest(root / "custom_components" / name) != sha
                for name, sha in current["expected"].items()
            ):
                raise Refusal("distribution_digest_mismatch")
            # A second read fences concurrent Arx invalidation/publication.
            if read_projection(root) != current:
                raise Refusal("restart_claim_stale")
            row = {
                "generation_id": params["generation_id"],
                "claim_id": params["claim_id"],
                "request_digest": request_hash,
                "boot_id": LOADED_BOOT_ID,
                "process_id": LOADED_PROCESS_ID,
                "state": "accepted",
            }
            history["records"][key] = row
            data = json.dumps(history, sort_keys=True)
            if len(data.encode()) > 16777216:
                raise Refusal("restart_execution_history_full")
            write_utf8_file_atomic(str(root / EXECUTIONS), data, private=True)
            return True, row

    accepted, row = await hass.async_add_executor_job(accept)
    principal.check()
    admitted_entry = principal.owner_key[0].entry
    from .const import DOMAIN

    admitted_authority = hass.data[DOMAIN]["native_auto_installation"]
    admitted_grant = admitted_authority.grant(admitted_entry)
    if accepted:

        async def restart():
            try:
                # Recheck the authoritative projection immediately before the
                # original service; superseded claims never decide a new policy.
                current = await hass.async_add_executor_job(read_projection, root)
                if (
                    current["generation_id"] != params["generation_id"]
                    or current["claim_id"] != params["claim_id"]
                ):
                    return
                # The admitted operation survives a normal socket close, but
                # installation authority must still be current at execution.
                if admitted_authority.grant(admitted_entry) != admitted_grant:
                    raise Refusal("installation_identity_changed")
                await hass.services.async_call("homeassistant", "restart", {}, blocking=True)
            except Exception as exc:

                def failed():
                    with locked_generation(root):
                        history = executions(root)
                        original = history["records"].get(key)
                        if original is not None and original["request_digest"] == request_hash:
                            original["state"] = "failed"
                            write_utf8_file_atomic(
                                str(root / EXECUTIONS),
                                json.dumps(history, sort_keys=True),
                                private=True,
                            )

                await hass.async_add_executor_job(failed)
                if isinstance(exc, Refusal):
                    return
                raise

        hass.loop.call_later(
            0.2, lambda: hass.async_create_task(restart(), "WisKey claimed Arx restart")
        )
    return {
        "contract": "wiskey-installation-restart.v2",
        "schema_version": 2,
        "state": "accepted" if accepted else "already_recorded",
        "generation_id": params["generation_id"],
        "claim_id": params["claim_id"],
        "request_boot_id": row["boot_id"],
        "execution_state": row["state"],
        "replay_available": False,
    }
