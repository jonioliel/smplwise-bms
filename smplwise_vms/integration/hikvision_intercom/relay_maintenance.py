"""Versioned consumer of Arx's proposed original-controller maintenance intent.

This is execution evidence, not a generation journal. The producer extension is
an Arx adoption proposal; an absent producer never authorizes an operation.
v1/v2 activation, the immutable export and the original history stay unchanged.
"""

import hashlib
import time
from contextvars import ContextVar
from pathlib import Path

from .access.native_sqlite_backup import read_private
from .relay_export_contract import canonical_json, fields
from .trusted_actions.validation import Refusal, strict_json

CONTRACT = "wiskey-relay-map-maintenance.v1"
PROJECTION = ".storage/hikvision_intercom.arx_installation/maintenance.v1.json"
PRODUCER = "arx-sqlite:wiskey.installation.generation/maintenance.v1"
STATES = {"intent", "invalidated", "dispatched", "cancelled", "prepared", "refused", "unknown"}
RELOADING = ContextVar("wiskey_original_maintenance_reload", default=None)
INTENT_FIELDS = {
    "contract",
    "schema_version",
    "producer",
    "generation_id",
    "source_digest",
    "token",
    "actor",
    "repository_id",
    "bridge_entry_id",
    "query_owner_id",
    "seq",
    "content_digest",
    "projection_sha256",
    "native_boot_id",
    "deadline_unix_ms",
    "state",
    "witness",
}


def _text(value):
    return type(value) is str and 1 <= len(value) <= 128 and all(32 <= ord(c) != 127 for c in value)


def parse(value):
    fields(value, INTENT_FIELDS)
    if (
        value["contract"] != CONTRACT
        or type(value["schema_version"]) is not int
        or value["schema_version"] != 1
        or value["producer"] != PRODUCER
        or type(value["state"]) is not str
        or value["state"] not in STATES
        or any(
            not _text(value[k])
            for k in (
                "generation_id",
                "source_digest",
                "token",
                "actor",
                "repository_id",
                "bridge_entry_id",
                "query_owner_id",
                "native_boot_id",
            )
        )
        or type(value["seq"]) is not int
        or not 1 <= value["seq"] <= 9007199254740991
        or type(value["deadline_unix_ms"]) is not int
        or not 1 <= value["deadline_unix_ms"] <= 9007199254740991
    ):
        raise Refusal("relay_maintenance_invalid")
    for name, prefix in (("content_digest", "sha256:"), ("projection_sha256", "")):
        raw = value[name]
        if (
            type(raw) is not str
            or not raw.startswith(prefix)
            or len(raw) != len(prefix) + 64
            or any(c not in "0123456789abcdef" for c in raw[len(prefix) :])
        ):
            raise Refusal("relay_maintenance_invalid")
    return value


def intent_digest(value):
    # State is mutable delivery lifecycle; facts and token are immutable.
    return hashlib.sha256(
        canonical_json({k: v for k, v in value.items() if k != "state"})
    ).hexdigest()


def request(params):
    fields(
        params,
        {
            "contract",
            "schema_version",
            "binding",
            "seq",
            "content_digest",
            "projection_sha256",
            "token",
            "intent_sha256",
        },
    )
    if (
        params["contract"] != CONTRACT
        or type(params["schema_version"]) is not int
        or params["schema_version"] != 1
        or not _text(params["token"])
        or type(params["intent_sha256"]) is not str
        or len(params["intent_sha256"]) != 64
        or any(c not in "0123456789abcdef" for c in params["intent_sha256"])
        or type(params["seq"]) is not int
        or not 1 <= params["seq"] <= 9007199254740991
    ):
        raise Refusal("relay_maintenance_invalid")
    for name, prefix in (("content_digest", "sha256:"), ("projection_sha256", "")):
        value = params[name]
        if (
            type(value) is not str
            or not value.startswith(prefix)
            or len(value) != len(prefix) + 64
            or any(c not in "0123456789abcdef" for c in value[len(prefix) :])
        ):
            raise Refusal("relay_maintenance_invalid")
    return params


def current(root, params, *, clock=time.time):
    """Read/recheck under generation.lock, including the startup commit itself."""
    from . import LOADED_BOOT_ID
    from .installation_controller import read_projection
    from .relay_restore_witness import check_horizon, validate

    try:
        value = parse(strict_json(read_private(Path(root) / PROJECTION, limit=32768)))
        controller = read_projection(root)
    except (OSError, ValueError):
        raise Refusal("relay_maintenance_source_unavailable") from None
    if (
        controller["generation_id"] != value["generation_id"]
        or controller["source_digest"] != value["source_digest"]
        or controller["phase"] != "installed"
        or controller["state"] != "restart_requested"
        or value["state"] != "dispatched"
        or value["native_boot_id"] != LOADED_BOOT_ID
        or value["token"] != params["token"]
        or intent_digest(value) != params["intent_sha256"]
    ):
        raise Refusal("relay_maintenance_stale")
    if value["deadline_unix_ms"] <= int(clock() * 1000):
        raise Refusal("relay_maintenance_deadline")
    binding = params["binding"]
    if (
        binding["controller"]
        != {k: controller[k] for k in ("generation_id", "claim_id", "source_digest")}
        or any(
            value[k] != binding[k] for k in ("repository_id", "bridge_entry_id", "query_owner_id")
        )
        or any(value[k] != params[k] for k in ("seq", "content_digest", "projection_sha256"))
    ):
        raise Refusal("relay_maintenance_source_changed")
    validate(value["witness"], binding=binding, intent=value)
    check_horizon(root, value["witness"])
    return value


async def prepare(hass, principal, params):
    """One deadline; HA unload/join/commit/reload, no restart or new authority.

    After an unload is attempted any error is an UNKNOWN effect outcome, even
    a signed error. The caller must not retry. Existing history is read-only.
    """
    import asyncio

    from . import relay_export_api as api
    from .access.native_sqlite_backup import joined_thread
    from .const import DOMAIN
    from .installation_files import locked_generation
    from .installation_readiness import inspect
    from .manual_upgrade_profile import enabled

    request(params)
    if enabled(hass):
        raise Refusal("relay_export_manual_maintenance_required")
    principal.check()
    binding = await api.source_binding(hass, principal)
    if canonical_json(binding) != canonical_json(params["binding"]):
        raise Refusal("relay_maintenance_source_changed")

    def admitted():
        with locked_generation(hass.config.config_dir, timeout=2.0):
            intent = current(hass.config.config_dir, params)
            from .installation_readiness import _inspect_locked

            if _inspect_locked(hass)["state"] != "ready":
                raise Refusal("relay_maintenance_pair_not_loaded")
            return intent

    intent = await joined_thread(admitted)
    # Wall-clock expiry travels across processes; local monotonic time is the
    # single remaining execution budget, never reset after an await.
    remaining = (intent["deadline_unix_ms"] / 1000) - time.time()
    if not 0 < remaining <= 30:
        raise Refusal("relay_maintenance_deadline")
    entries = tuple(sorted(hass.config_entries.async_entries(DOMAIN), key=lambda e: e.entry_id))
    from homeassistant.config_entries import ConfigEntryState

    # Restore exactly the prior loaded set. Disabled/not-loaded entries must
    # not be enabled or force-loaded by maintenance.
    loaded_entries = tuple(e for e in entries if e.state is ConfigEntryState.LOADED)
    attempted = False
    prepared = False
    namespace = hass.data[DOMAIN]
    if namespace.get("relay_export_maintenance") is not None:
        raise Refusal("relay_export_original_quiesce_required")
    owner = object()
    from .native_emergency_recovery_host import KEY as RECOVERY_KEY

    # Keep the original predecessor strongly through its successful join and
    # explicit successor validation. No dependency on collection of old hosts.
    predecessor = namespace.get(RECOVERY_KEY)
    namespace["relay_export_maintenance"] = owner
    try:
        async with asyncio.timeout(remaining):
            for entry in entries:
                principal.check()
                await joined_thread(current, hass.config.config_dir, params)
                if entry.state is ConfigEntryState.LOADED:
                    attempted = True
                    if not await hass.config_entries.async_unload(entry.entry_id):
                        raise Refusal("relay_maintenance_unload_failed")
                elif entry.state is not ConfigEntryState.NOT_LOADED:
                    raise Refusal("relay_maintenance_unload_failed")
            # Original prepare owns the original setup locks, joins the worker
            # and rechecks this intent under the original publication fence.
            attempted = True

            def commit_guard():
                from .relay_restore_witness import record_observed

                active = current(hass.config.config_dir, params)
                record_observed(hass.config.config_dir, active["witness"])

            result = await api.prepare(
                hass,
                principal,
                params,
                version=3,
                commit_guard=commit_guard,
                maintenance_owner=owner,
            )
            prepared = True
            # Reuse original composition, with the SAME repository/selection
            # and already-created journal. No open/new ECC, peer, UUID or grant.
            from .arx_native_feature_runtime import async_setup_native_feature_runtime
            from .native_emergency_recovery_host import async_setup_native_emergency_recovery

            recovered = await async_setup_native_emergency_recovery(
                hass,
                repository=principal.repository,
                selection=namespace.get("ecc_storage"),
                predecessor=predecessor,
            )
            if recovered is None:
                raise Refusal("relay_maintenance_recovery_unavailable")
            if await async_setup_native_feature_runtime(hass) is None:
                raise Refusal("relay_maintenance_recovery_unavailable")
            reload_scope = RELOADING.set(owner)
            try:
                for entry in loaded_entries:
                    principal.check()
                    await joined_thread(current, hass.config.config_dir, params)
                    attempted = True
                    if not await hass.config_entries.async_setup(entry.entry_id):
                        raise Refusal("relay_maintenance_reload_failed")
            finally:
                RELOADING.reset(reload_scope)
            loaded = await joined_thread(inspect, hass)
            if loaded["state"] != "ready":
                raise Refusal("relay_maintenance_pair_not_loaded")
            principal.check()
            return {
                "contract": "wiskey-relay-maintenance-result.v1",
                "schema_version": 1,
                "generation_id": intent["generation_id"],
                "token": intent["token"],
                "intent_sha256": params["intent_sha256"],
                "state": "prepared",
                "startup_committed": True,
                "entries_reloaded": True,
                "ack": result,
                "replay_available": False,
            }
    except (Exception, asyncio.CancelledError) as error:
        if attempted or prepared:
            raise Refusal("relay_maintenance_outcome_unknown") from error
        raise
    finally:
        if namespace.get("relay_export_maintenance") is owner:
            del namespace["relay_export_maintenance"]
