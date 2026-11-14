"""Authenticated Arx relay facts, staged evidence and quiescent startup writer.

Uses the original pairing/nonce principal, selected ECC UUID and effect journal.
It never creates ECC, a grant, a counter, an execution policy or a restart.
The one projection file retains observed upstream facts; it decides no Arx
installation generation. Preparing startup is not loaded/selected/ready.
"""

from __future__ import annotations

import asyncio
import hashlib
import os
import stat
import weakref
from contextlib import AsyncExitStack
from pathlib import Path

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntryState

from .access.ecc_storage import EccStorageSelection, _selection
from .access.models import AccessError
from .access.native_sqlite_backup import joined_thread, read_private, write_exclusive
from .bridge_command_auth import VerifiedBridgePrincipal, host_for, send_bridge_result
from .configuration import managed_locks
from .const import DOMAIN
from .relay_export_contract import (
    MAX_BYTES,
    canonical_json,
    fields,
    project,
    read_record,
    require_forward,
)
from .trusted_actions.validation import Refusal, strict_json

COMMANDS = (
    "installation/relay_map_source_v1",
    "installation/relay_map_stage_v1",
    "installation/relay_map_prepare_v1",
    "installation/relay_map_prepare_v2",
    "installation/relay_map_stage_v2",
    "installation/relay_map_prepare_v3",
)
CONTRACT = "wiskey-relay-map-transfer.v1"
DIRECTORY = "hikvision_intercom.relay_export"
FILENAME = "projection.v1.json"
_LOCKS = weakref.WeakKeyDictionary()
_REGISTERED = weakref.WeakKeyDictionary()


def inventory(hass):
    """Original entry identity and API/physical facts before display projection."""
    result = {}
    for entry in hass.config_entries.async_entries(DOMAIN):
        if type(entry.unique_id) is not str or not entry.unique_id:
            raise Refusal("relay_export_station_identity_unavailable")
        result[entry.entry_id] = {
            "identity": entry.unique_id,
            "relays": sorted(
                [lock.api_id, lock.physical_index] for lock in managed_locks(entry.data)
            ),
        }
    return result


async def selected_uuid(hass, principal):
    """Resolve original lifecycle issuance. This read never creates a UUID."""
    owner = hass.data[DOMAIN].get("ecc_storage")
    if type(owner) is not EccStorageSelection:
        if owner is not None:
            raise Refusal("relay_export_repository_mismatch")
        from .ecc_host_storage import selection_directory
        from .repository_identity import resolve

        if await joined_thread(os.path.lexists, selection_directory(hass)):
            raise Refusal("relay_export_repository_mismatch")
        return await resolve(hass, principal.repository)
    roots = _selection(owner)
    from .access.native_sqlite_persistence import NativeSqlitePersistence, _check_owned_files

    backend = roots[0]
    owned = NativeSqlitePersistence._stable_labels(backend)
    # The original backend worker/close owns this mutex. Never inspect its
    # live SQLite connection concurrently from the HA event loop.
    async with owned.lock:

        def inspect_owned():
            _check_owned_files(NativeSqlitePersistence._stable(backend))

        await joined_thread(inspect_owned)
    if hass.data[DOMAIN].get("ecc_storage") is not owner or _selection(owner) is not roots:
        raise Refusal("relay_export_repository_mismatch")
    repository = principal.repository
    if (
        getattr(repository._save, "__self__", None) is not owner
        or getattr(repository._save, "__func__", None) is not EccStorageSelection.async_save
    ):
        raise Refusal("relay_export_repository_mismatch")
    return roots[1]


async def source_binding(hass, principal):
    from . import LOADED_BOOT_ID
    from .installation_controller import read_projection
    from .trusted_actions.direct_bridge_origin import check_connection

    if type(principal) is not VerifiedBridgePrincipal or principal.command not in COMMANDS:
        raise Refusal("Unauthorized")
    principal.check()
    _epoch, entry, user, connection = principal.owner_key
    try:
        current = await joined_thread(read_projection, hass.config.config_dir)
    except FileNotFoundError:
        current = None
    except (OSError, ValueError, Refusal):
        raise Refusal("relay_export_controller_unavailable") from None
    controller = (
        None
        if current is None
        else {
            "generation_id": current["generation_id"],
            "claim_id": current["claim_id"],
            "source_digest": current["source_digest"],
        }
    )
    return {
        "repository_id": await selected_uuid(hass, principal),
        "bridge_entry_id": entry,
        "query_owner_id": user.id,
        "descriptor_epoch": principal.descriptor_epoch,
        "boot_id": LOADED_BOOT_ID,
        "connection_ref": check_connection(connection).challenge,
        "controller": controller,
    }


def _directory(root, *, create=False):
    directory = Path(root) / ".storage" / DIRECTORY
    if create and not os.path.lexists(directory):
        directory.mkdir(mode=0o700)
    info = directory.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise Refusal("relay_export_private_path_required")
    if directory.parent.is_symlink():
        raise Refusal("relay_export_private_path_required")
    return directory, (info.st_dev, info.st_ino)


def read_projection(root):
    """Local evidence only; never interpreted as a bridge principal or grant."""
    try:
        directory, before = _directory(root)
    except FileNotFoundError:
        return None
    raw = read_private(directory / FILENAME, limit=MAX_BYTES * 2)
    value = strict_json(raw, limit=MAX_BYTES * 2)
    fields(value, {"format", "schema_version", "binding", "record", "inventory"})
    if (
        value["format"] != CONTRACT
        or type(value["schema_version"]) is not int
        or value["schema_version"] != 1
    ):
        raise Refusal("relay_export_projection_invalid")
    read_record(value["record"])
    fields(
        value["binding"],
        {
            "repository_id",
            "bridge_entry_id",
            "query_owner_id",
            "descriptor_epoch",
            "boot_id",
            "connection_ref",
            "controller",
        },
    )
    if type(value["inventory"]) is not dict:
        raise Refusal("relay_export_projection_invalid")
    for sid, item in value["inventory"].items():
        if type(sid) is not str:
            raise Refusal("relay_export_projection_invalid")
        fields(item, {"identity", "relays"})
        if type(item["identity"]) is not str or type(item["relays"]) is not list:
            raise Refusal("relay_export_projection_invalid")
        if any(
            type(row) is not list
            or len(row) != 2
            or any(type(n) is not int or n not in (1, 2) for n in row)
            for row in item["relays"]
        ):
            raise Refusal("relay_export_projection_invalid")
    if _directory(root)[1] != before:
        raise Refusal("relay_export_private_path_required")
    return value


def _publish(path, raw):
    """Original private exclusive writer, atomic replace, fsync directory."""
    directory = path.parent
    before = directory.lstat()
    if not stat.S_ISDIR(before.st_mode) or before.st_uid != os.getuid() or before.st_mode & 0o077:
        raise Refusal("relay_export_private_path_required")
    if os.path.lexists(path):
        read_private(path, limit=MAX_BYTES * 2)
    temporary = path.with_name("." + path.name + "." + os.urandom(16).hex())
    try:
        write_exclusive(temporary, raw.decode("utf-8"))
        after = directory.lstat()
        if (before.st_dev, before.st_ino) != (after.st_dev, after.st_ino):
            raise Refusal("relay_export_private_path_required")
        os.replace(temporary, path)
        fd = os.open(directory, os.O_RDONLY | os.O_NOFOLLOW)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
    finally:
        temporary.unlink(missing_ok=True)


def _stable_binding(value):
    return {
        k: value[k] for k in ("repository_id", "bridge_entry_id", "query_owner_id", "controller")
    }


def _save_stage(root, binding, record, actual, *, controller_handoff=False):
    old = read_projection(root)
    if old is not None:
        before, after = _stable_binding(old["binding"]), _stable_binding(binding)
        if controller_handoff:
            before.pop("controller")
            after.pop("controller")
        if before != after:
            raise Refusal("relay_export_source_binding_changed")
        require_forward(old["record"], record)
        if (
            old["record"] == record
            and old["inventory"] == actual
            and _stable_binding(old["binding"]) == _stable_binding(binding)
        ):
            return old, False
    directory, _identity = _directory(root, create=True)
    value = {
        "format": CONTRACT,
        "schema_version": 1,
        "binding": binding,
        "record": record,
        "inventory": actual,
    }
    _publish(directory / FILENAME, canonical_json(value))
    return value, True


def _projection_result(value, *, state, code=None):
    return {
        "contract": "wiskey-relay-map-ack.v1",
        "schema_version": 1,
        "state": state,
        "code": code,
        "seq": value["record"]["seq"],
        "content_digest": value["record"]["content_digest"],
        "repository_id": value["binding"]["repository_id"],
        "projection_sha256": hashlib.sha256(canonical_json(value)).hexdigest(),
        "activation": "not_performed",
        "loaded": False,
        "ready": False,
    }


def _current_controller(root, expected, *, require_claim=False):
    from .installation_controller import read_projection as read_controller

    try:
        current = read_controller(root)
    except FileNotFoundError:
        current = None
    except (OSError, ValueError, Refusal):
        raise Refusal("relay_export_controller_unavailable") from None
    actual = (
        None
        if current is None
        else {k: current[k] for k in ("generation_id", "claim_id", "source_digest")}
    )
    if actual != expected:
        raise Refusal("relay_export_source_binding_changed")
    if require_claim and (
        current is None
        or current["claim_id"] is None
        or current["state"] != "restart_claimed"
        or current["phase"] != "installed"
    ):
        raise Refusal("relay_export_original_claim_required")
    return current


def _save_stage_v2(root, binding, record, actual):
    from .installation_files import locked_generation

    try:
        with locked_generation(root, timeout=2.0):
            _current_controller(root, binding["controller"], require_claim=True)
            return _save_stage(root, binding, record, actual, controller_handoff=True)
    except TimeoutError:
        raise Refusal("relay_export_controller_busy") from None


async def stage(hass, principal, params, *, version=1):
    fields(params, {"contract", "schema_version", "binding", "record"})
    if (
        params["contract"] != (CONTRACT if version == 1 else "wiskey-relay-map-activation.v2")
        or type(params["schema_version"]) is not int
        or params["schema_version"] != version
    ):
        raise Refusal("relay_export_invalid")
    binding = await source_binding(hass, principal)
    if params["binding"] != binding:
        raise Refusal("relay_export_source_binding_changed")
    record = read_record(params["record"])
    # A rollback export republishes old facts; it never requests map rollback.
    if record["stale"] or not record["current"] or record["kind"] == "rollback":
        raise Refusal("relay_export_not_current")
    actual = inventory(hass)
    # Valid inactive/partial facts are retained as staged evidence only. They
    # cannot erase a selected startup map, journal or original recovery claims.
    try:
        project(record["snapshot"], actual, include_inactive=version == 2)
        blocked = None
    except Refusal as error:
        if error.code not in {
            "relay_export_inventory_incomplete",
            "relay_export_inventory_mismatch",
            "relay_export_inactive_mapping_requires_versioned_activation",
        }:
            raise
        blocked = error.code
    value, changed = await joined_thread(
        _save_stage if version == 1 else _save_stage_v2,
        hass.config.config_dir,
        binding,
        record,
        actual,
    )
    principal.check()
    if await source_binding(hass, principal) != binding or inventory(hass) != actual:
        raise Refusal("relay_export_source_binding_changed")
    return _projection_result(value, state="staged" if changed else "unchanged", code=blocked)


def _prepare_storage(root, value, stations, original_journal=None, *, startup_version=2):
    from .access.arx_execution_journal import (
        EffectJournalProfile,
        FeatureExecutionJournal,
    )
    from .native_emergency_recovery_host import (
        BOUNDED_FORMAT,
        CONFIG_NAME,
        _read_binding,
    )
    from .native_emergency_recovery_host import (
        DIRECTORY as RECOVERY_DIRECTORY,
    )

    directory = Path(root) / ".storage" / RECOVERY_DIRECTORY
    previous = _read_binding(directory)
    identity = value["binding"]["repository_id"]
    if previous is not None and previous.repository_id != identity:
        raise Refusal("relay_export_repository_mismatch")
    if not stations:
        raise Refusal("relay_export_no_managed_relays")
    if previous is None and original_journal is None:
        raise Refusal("relay_export_original_journal_unavailable")
    path = previous.journal_path if previous is not None else original_journal[0]
    profile = previous.profile if previous is not None else original_journal[2]
    if original_journal is not None and (
        original_journal[0] != path
        or original_journal[1] != identity
        or (original_journal[2] is None) != (profile is None)
        or profile is not None
        and original_journal[2].metadata() != profile.metadata()
    ):
        raise Refusal("relay_export_repository_mismatch")
    journal = FeatureExecutionJournal(
        path, repository_id=identity, expect_existing=True, profile=profile
    )
    try:
        history = None
        if startup_version == 3:
            from .recovery_startup_v3 import transition

            history = transition(previous, stations, journal)
        elif previous is not None and previous.active is not None:
            raise Refusal("relay_export_startup_version_required")
        if previous is None and journal.db.execute("SELECT COUNT(*) FROM effects").fetchone()[0]:
            raise Refusal("relay_export_existing_history_requires_original_binding")
        if previous is not None and startup_version != 3:
            original_rows = [
                {
                    "entry_id": sid,
                    "identity": device,
                    "relays": [
                        {"api_relay": g[1], "physical_relay": g[2], "mapping_revision": g[3]}
                        for g in rows
                    ],
                }
                for sid, device, rows in previous.stations
            ]
            # No reinterpretation of ANY prior attempt, even a terminal one.
            # startup.v2 cannot represent multiple mapping revisions at once.
            if (
                original_rows != stations
                and journal.db.execute("SELECT COUNT(*) FROM effects").fetchone()[0]
            ):
                raise Refusal("relay_export_recovery_history_transition_unsupported_v1")
        info = path.lstat()
        candidate = {
            "format": BOUNDED_FORMAT
            if profile is not None
            else "wiskey-native-emergency-recovery-startup.v1",
            "repository_id": identity,
            "journal": {
                "path": str(path),
                "identity": [info.st_dev, info.st_ino, info.st_uid, stat.S_IMODE(info.st_mode)],
            },
            "stations": stations,
        }
        if profile is not None:
            candidate["journal"]["profile"] = EffectJournalProfile.metadata(profile)
        if startup_version == 3:
            from .recovery_startup_v3 import FORMAT as V3_FORMAT
            from .recovery_startup_v3 import parse

            candidate["format"] = V3_FORMAT
            candidate["journal"]["profile"] = (
                EffectJournalProfile.metadata(profile) if profile is not None else None
            )
            candidate["history"] = history
            parse(candidate)
        raw = canonical_json(candidate)
        if len(raw) > MAX_BYTES:
            raise Refusal("relay_export_history_capacity")
        target = directory / CONFIG_NAME
        if previous is None:
            directory.mkdir(mode=0o700, exist_ok=False)
        if previous is not None:
            old = read_private(target, limit=MAX_BYTES)
            if strict_json(old) == candidate:
                return False
            backup = directory / ("startup-before-" + hashlib.sha256(old).hexdigest() + ".json")
            if os.path.lexists(backup):
                if read_private(backup, limit=MAX_BYTES) != old:
                    raise Refusal("relay_export_backup_conflict")
            else:
                write_exclusive(backup, old.decode("utf-8"))
        _publish(target, raw)
        _read_binding(directory)
        return True
    finally:
        FeatureExecutionJournal.close(journal)


def _guard_original_history(binding, stations, journal, *, startup_version=2):
    """Reject an unrepresentable transition BEFORE retiring the original host."""
    from .access.arx_execution_journal import FeatureExecutionJournal

    if type(journal) is not FeatureExecutionJournal:
        raise Refusal("relay_export_original_journal_unavailable")
    FeatureExecutionJournal._stable(journal)
    if startup_version == 3:
        from .recovery_startup_v3 import transition

        transition(binding, stations, journal)
        return
    if not journal.db.execute("SELECT COUNT(*) FROM effects").fetchone()[0]:
        return
    if binding is None:
        raise Refusal("relay_export_existing_history_requires_original_binding")
    if binding.journal_path != journal.path or binding.repository_id != journal.repository_id:
        raise Refusal("relay_export_repository_mismatch")
    old = [
        {
            "entry_id": sid,
            "identity": identity,
            "relays": [
                {"api_relay": g[1], "physical_relay": g[2], "mapping_revision": g[3]} for g in rows
            ],
        }
        for sid, identity, rows in binding.stations
    ]
    if old != stations:
        raise Refusal("relay_export_recovery_history_transition_unsupported_v1")


def _prepare_storage_fenced(
    root, value, stations, original, *, startup_version=2, commit_guard=None
):
    """Linearize startup publication with the ORIGINAL controller publisher.

    Both Arx publish/invalidate and this worker hold the existing generation.lock
    through their atomic replacements. No await, Arx DB access, generation
    decision or principal transfer occurs in this filesystem critical section.
    The Arx writer contribution is required for that shared protocol.
    """
    from .installation_files import locked_generation

    try:
        with locked_generation(root, timeout=2.0):
            _current_controller(
                root,
                value["binding"]["controller"],
                require_claim=startup_version == 3 and commit_guard is None,
            )
            if commit_guard is not None:
                commit_guard()
            # The writer cannot publish B between this check and startup's
            # rename/fsync. A check after an unprotected write cannot do this.
            return _prepare_storage(
                root, value, stations, original, startup_version=startup_version
            )
    except TimeoutError:
        raise Refusal("relay_export_controller_busy") from None


async def _prepare_quiesced(hass, principal, params, *, version=1, commit_guard=None):
    if version == 3:
        from .relay_maintenance import request

        request(params)
    else:
        fields(
            params,
            {"contract", "schema_version", "binding", "seq", "content_digest", "projection_sha256"},
        )
    if version != 3 and (
        params["contract"] != (CONTRACT if version == 1 else "wiskey-relay-map-activation.v2")
        or type(params["schema_version"]) is not int
        or params["schema_version"] != version
    ):
        raise Refusal("relay_export_invalid")
    binding = await source_binding(hass, principal)
    if params["binding"] != binding:
        raise Refusal("relay_export_source_binding_changed")
    value = await hass.async_add_executor_job(read_projection, hass.config.config_dir)
    if value is None or _stable_binding(value["binding"]) != _stable_binding(binding):
        raise Refusal("relay_export_projection_unavailable")
    for key in ("seq", "content_digest"):
        if (
            type(params[key]) is not type(value["record"][key])
            or params[key] != value["record"][key]
        ):
            raise Refusal("relay_export_projection_changed")
    if params["projection_sha256"] != hashlib.sha256(canonical_json(value)).hexdigest():
        raise Refusal("relay_export_projection_changed")
    actual = inventory(hass)
    if actual != value["inventory"]:
        raise Refusal("relay_export_inventory_mismatch")
    stations = project(value["record"]["snapshot"], actual, include_inactive=version >= 2)
    startup_version = 2 if version == 1 else 3
    if any(
        entry.state is not ConfigEntryState.NOT_LOADED
        or getattr(entry, "runtime_data", None) is not None
        for entry in hass.config_entries.async_entries(DOMAIN)
    ):
        raise Refusal("relay_export_original_quiesce_required")
    # All station writers are unloaded. Join original effects before touching
    # their startup binding. No HA stop/restart/install or lease is requested.
    from .arx_native_feature_runtime import (
        close_native_feature_runtime,
        original_effects_for_recovery,
    )
    from .native_emergency_recovery_host import close_native_emergency_recovery

    original = original_effects_for_recovery(hass, principal.repository)
    if original is not None:
        from .native_emergency_recovery_host import _read_binding, configuration_directory

        binding = await joined_thread(_read_binding, configuration_directory(hass))
        current = original_effects_for_recovery(hass, principal.repository)
        if current is None or current[3] is not original[3]:
            raise Refusal("relay_export_original_journal_unavailable")
        _guard_original_history(binding, stations, original[3], startup_version=startup_version)
        principal.check()
    await close_native_feature_runtime(hass, principal.repository)
    await close_native_emergency_recovery(hass, principal.repository)
    principal.check()
    from functools import partial

    changed = await joined_thread(
        partial(
            _prepare_storage_fenced,
            hass.config.config_dir,
            value,
            stations,
            original,
            startup_version=startup_version,
            commit_guard=commit_guard,
        )
    )
    principal.check()
    return _projection_result(value, state="prepared" if changed else "unchanged")


async def prepare(hass, principal, params, *, version=1, commit_guard=None, maintenance_owner=None):
    """Hold original HA entry setup locks; prevent new Native loads during commit."""
    from .manual_upgrade_profile import enabled as manual_profile

    if version >= 2 and manual_profile(hass):
        # Arx's generation claim never overrides an owner-manual deployment.
        # The existing explicitly quiesced v1 maintenance path is unchanged.
        raise Refusal("relay_export_manual_maintenance_required")
    namespace = hass.data[DOMAIN]
    if (
        namespace.get("relay_export_maintenance") is not None
        and namespace["relay_export_maintenance"] is not maintenance_owner
    ):
        raise Refusal("relay_export_original_quiesce_required")
    entries = tuple(sorted(hass.config_entries.async_entries(DOMAIN), key=lambda e: e.entry_id))
    if version == 2:
        # Arx alone chose/claimed this generation. Native performs the original
        # HA unloads, without deciding a new generation, restart or authority.
        fields(
            params,
            {"contract", "schema_version", "binding", "seq", "content_digest", "projection_sha256"},
        )
        if (
            params["contract"] != "wiskey-relay-map-activation.v2"
            or type(params["schema_version"]) is not int
            or params["schema_version"] != 2
        ):
            raise Refusal("relay_export_invalid")
        binding = await source_binding(hass, principal)
        if params["binding"] != binding:
            raise Refusal("relay_export_source_binding_changed")
        from functools import partial

        await joined_thread(
            partial(
                _current_controller,
                hass.config.config_dir,
                binding["controller"],
                require_claim=True,
            )
        )
        for entry in entries:
            principal.check()
            if entry.state is ConfigEntryState.LOADED:
                if not await hass.config_entries.async_unload(entry.entry_id):
                    raise Refusal("relay_export_original_quiesce_required")
            elif entry.state is not ConfigEntryState.NOT_LOADED:
                raise Refusal("relay_export_original_quiesce_required")
    async with AsyncExitStack() as stack:
        try:
            async with asyncio.timeout(2.0):
                for entry in entries:
                    await stack.enter_async_context(entry.setup_lock)
        except TimeoutError:
            raise Refusal("relay_export_original_quiesce_required") from None
        token = maintenance_owner if maintenance_owner is not None else object()
        namespace["relay_export_maintenance"] = token
        try:
            if (
                tuple(sorted(hass.config_entries.async_entries(DOMAIN), key=lambda e: e.entry_id))
                != entries
            ):
                raise Refusal("relay_export_inventory_mismatch")
            return await _prepare_quiesced(
                hass, principal, params, version=version, commit_guard=commit_guard
            )
        finally:
            if maintenance_owner is None and namespace.get("relay_export_maintenance") is token:
                del namespace["relay_export_maintenance"]


async def dispatch(hass, connection, message, command):
    try:
        principal = await host_for(hass).admit(connection, message, command)
        async with _LOCKS.setdefault(hass, asyncio.Lock()):
            if command == COMMANDS[0]:
                if principal.parameters:
                    raise Refusal("relay_export_invalid")
                result = {
                    "contract": CONTRACT,
                    "schema_version": 1,
                    "binding": await source_binding(hass, principal),
                    "inventory": inventory(hass),
                    "anti_rollback_scope": "surviving_native_projection",
                    "full_restore_continuity": "not_proven",
                }
            elif command == COMMANDS[5]:
                from .relay_maintenance import prepare as maintenance_prepare

                result = await maintenance_prepare(hass, principal, principal.parameters)
            elif command in (COMMANDS[1], COMMANDS[4]):
                result = await stage(
                    hass,
                    principal,
                    principal.parameters,
                    version=2 if command == COMMANDS[4] else 1,
                )
            else:
                result = await prepare(
                    hass,
                    principal,
                    principal.parameters,
                    version=2 if command == COMMANDS[3] else 1,
                )
            principal.check()
            send_bridge_result(connection, message["id"], result)
    except (Refusal, AccessError, OSError, ValueError) as error:
        code = (
            error.code
            if isinstance(error, (Refusal, AccessError))
            else "relay_export_storage_unavailable"
        )
        connection.send_error(message["id"], code, "Relay source request refused")


def register(hass):
    originals = {}
    for command in COMMANDS:

        def handler_for(name):
            @websocket_api.websocket_command(
                vol.All(vol.Schema({"type": DOMAIN + "/" + name}, extra=vol.ALLOW_EXTRA))
            )
            @websocket_api.async_response
            async def handler(hass, connection, message):
                await dispatch(hass, connection, message, name)

            return handler

        websocket_api.async_register_command(hass, handler_for(command))
        originals[command] = hass.data[websocket_api.DOMAIN][DOMAIN + "/" + command]
    _REGISTERED[hass] = originals


def registered(hass):
    return tuple(
        name
        for name, original in _REGISTERED.get(hass, {}).items()
        if hass.data[websocket_api.DOMAIN].get(DOMAIN + "/" + name) is original
    )
