"""Startup/lifetime composition of original ECC feature source and journals.

The default schema16 installation is not promoted. A selected original ECC
engine supplies the durable registry. Native journals use their existing private
path/identity/profile checks; no external policy or physical target is invented.
Structural composition remains inactive until signed current Arx policy arrives.
"""

from __future__ import annotations

import asyncio
import json
import os
import stat
import weakref
from dataclasses import dataclass
from pathlib import Path

from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.core import callback

from .access.arx_execution_authority import DurableFeaturePeerRegistry, FeatureAuthoritySource
from .access.arx_execution_journal import FeatureExecutionJournal, ecc_effects_profile
from .access.arx_feature_execution_contract import FeatureBoundary
from .access.arx_feature_host import NativeFeatureHost, install_native_feature_host
from .access.arx_validation_execution import ValidationExecutionJournal
from .access.ecc_storage import EccStorageSelection
from .access.manager import AccessManager
from .access.native_sqlite_backup import (
    joined_thread,
    private_directory,
    read_private,
    write_exclusive,
)
from .arx_native_feature_source import NativeBridgeFeatureSource
from .arx_policy_heads import NativePolicyHeads
from .const import DOMAIN
from .media_lifetime import join_owned
from .native_emergency_recovery_host import KEY as RECOVERY_KEY
from .native_emergency_recovery_host import NativeEmergencyRecoveryHost
from .storage import AccessStore
from .trusted_actions.native_peer_source import NativePeerRegistry
from .trusted_actions.validation import Refusal, strict_json

KEY = "native_feature_runtime"
FORMAT = "wiskey-native-feature-runtime.v1"
DIRECTORY = DOMAIN + ".feature_effects"
_RUNTIMES = weakref.WeakKeyDictionary()


class NativeFeatureRuntime:
    """Opaque installation handle; public labels cannot redirect native cleanup."""

    __slots__ = ("__weakref__",)


def _identity(path, *, directory=False):
    info = path.lstat()
    if (
        not (stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode))
        or info.st_uid != os.getuid()
        or info.st_mode & 0o077
        or not directory
        and info.st_nlink != 1
    ):
        raise Refusal("feature_journal_path_changed")
    return info.st_dev, info.st_ino, info.st_uid, stat.S_IMODE(info.st_mode)


def _prepare(path):
    private_directory(path)
    identity = _identity(path, directory=True)
    manifest = path / "host.json"
    if not os.path.lexists(manifest):
        if any(path.iterdir()):
            raise Refusal("feature_journal_installation_incomplete")
        return identity, None
    value = strict_json(read_private(manifest, limit=16384), limit=16384)
    if (
        type(value) is not dict
        or set(value) != {"format", "repository_id", "effects", "validation"}
        or value["format"] != FORMAT
    ):
        raise Refusal("feature_journal_manifest_invalid")
    return identity, value


def _metadata(journal, origin):
    profile = journal.profile
    return {
        "origin": origin,
        "identity": list(_identity(journal.path)),
        "profile": profile.metadata() if profile is not None else None,
    }


def _check_manifest(value, *, identity, path, repository_id, effects, validation):
    if _identity(path, directory=True) != identity:
        raise Refusal("feature_journal_path_changed")
    expected = {
        "format": FORMAT,
        "repository_id": repository_id,
        "effects": effects,
        "validation": validation,
    }
    if value is not None and value != expected:
        raise Refusal("feature_journal_manifest_invalid")
    return expected


def _write_manifest(path, identity, value):
    if _identity(path, directory=True) != identity:
        raise Refusal("feature_journal_path_changed")
    write_exclusive(path / "host.json", json.dumps(value, sort_keys=True))


@dataclass(repr=False)
class _Runtime:
    hass: object
    namespace: dict
    repository: object
    source: object
    boundary: object
    authority: object
    host: object
    effects: object
    validation: object
    owns_effects: bool
    handle: object
    closing: object = None
    stop_remove: object = None


def _context(hass):
    namespace = hass.data[DOMAIN]
    selection = namespace.get("ecc_storage")
    registry = namespace.get("native_peer_registry")
    if selection is None and registry is None:
        return None
    manager = namespace.get("access")
    if (
        hass.is_stopping
        or type(selection) is not EccStorageSelection
        or type(registry) is not NativePeerRegistry
        or type(manager) is not AccessManager
        or manager.repository is not registry.repository
        or registry.repository_id != selection.repository_id
        or getattr(manager.repository._save, "__self__", None) is not selection
        or getattr(manager.repository._save, "__func__", None) is not EccStorageSelection.async_save
        or manager._closed
    ):
        raise Refusal("feature_runtime_source_changed")
    registry._stable()
    return namespace, manager.repository, selection, registry


def _same_context(hass, original):
    current = _context(hass)
    return current is not None and all(a is b for a, b in zip(current, original, strict=True))


async def async_setup_native_feature_runtime(hass):
    context = _context(hass)
    if context is None:
        return None
    namespace, repository, selection, registry = context
    if (
        hass in _RUNTIMES
        or namespace.get(KEY) is not None
        or namespace.get("arx_feature_host") is not None
        or namespace.get("arx_native_feature_source") is not None
    ):
        raise Refusal("feature_runtime_already_installed")
    recovery = namespace.get(RECOVERY_KEY)
    if recovery is not None and type(recovery) is not NativeEmergencyRecoveryHost:
        raise Refusal("feature_runtime_source_changed")
    borrowed = recovery.journal if recovery is not None else None
    path = Path(hass.config.path(".storage", DIRECTORY))
    if not path.is_absolute():
        raise Refusal("feature_journal_path_changed")
    directory_identity, manifest = await joined_thread(_prepare, path)
    if not _same_context(hass, context):
        raise Refusal("feature_runtime_source_changed")
    effects = validation = source = boundary = authority = host = None
    try:
        expected_origin = "recovery" if borrowed is not None else "owned"
        if manifest is not None:
            if (
                manifest["repository_id"] != registry.repository_id
                or type(manifest["effects"]) is not dict
                or manifest["effects"].get("origin") != expected_origin
                or type(manifest["validation"]) is not dict
            ):
                raise Refusal("feature_journal_manifest_invalid")
            # Refuse a substituted main DB before opening/changing its WAL.
            effect_path = borrowed.path if borrowed is not None else path / "effects.sqlite"
            if list(_identity(effect_path)) != manifest["effects"].get("identity") or list(
                _identity(path / "validation.sqlite")
            ) != manifest["validation"].get("identity"):
                raise Refusal("feature_journal_path_changed")
        # SQLite objects stay on HA's original loop thread, as required by the
        # existing journal. Only file preparation is offloaded; no thread hop
        # opens a connection that native coordinators later use on this loop.
        effects = borrowed or FeatureExecutionJournal(
            path / "effects.sqlite",
            repository_id=registry.repository_id,
            expect_existing=manifest is not None,
            profile=ecc_effects_profile(),
        )
        validation = ValidationExecutionJournal(
            path / "validation.sqlite",
            repository_id=registry.repository_id,
            expect_existing=manifest is not None,
            profile=ecc_effects_profile(),
        )
        effects._stable()
        validation._stable()
        expected = _check_manifest(
            manifest,
            identity=directory_identity,
            path=path,
            repository_id=registry.repository_id,
            effects=_metadata(effects, expected_origin),
            validation=_metadata(validation, "owned"),
        )
        if manifest is None:
            await joined_thread(_write_manifest, path, directory_identity, expected)
        if not _same_context(hass, context):
            raise Refusal("feature_runtime_source_changed")
        store = AccessStore(hass, key=DOMAIN + ".feature_authority_heads")
        heads = NativePolicyHeads(store, registry.repository_id, await store.async_load())
        if not _same_context(hass, context):
            raise Refusal("feature_runtime_source_changed")
        source = NativeBridgeFeatureSource(hass, registry, heads)
        boundary = FeatureBoundary(
            verify=source.verify,
            is_current=source.is_current,
            clock=source.clock,
            repository_id=registry.repository_id,
            bridge_source=source,
        )
        authority = FeatureAuthoritySource(
            DurableFeaturePeerRegistry(registry),
            resolve=source.resolve,
            is_current=source.policy_current,
        )
        host = install_native_feature_host(
            hass,
            boundary=boundary,
            authority=authority,
            journal=effects,
            validation_journal=validation,
        )
        runtime = _Runtime(
            hass,
            namespace,
            repository,
            source,
            boundary,
            authority,
            host,
            effects,
            validation,
            borrowed is None,
            NativeFeatureRuntime(),
        )
        _RUNTIMES[hass] = runtime
        namespace[KEY] = runtime.handle

        @callback
        def stop(_event):
            runtime.stop_remove = None
            hass.async_create_task(close_native_feature_runtime(hass, repository))

        runtime.stop_remove = hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, stop)
        return runtime.handle
    except BaseException:
        if host is not None:
            # A failed original cleanup must retain its complete composition.
            # Never close its journals or discard its source beneath it.
            try:
                await NativeFeatureHost.close(host)
            except BaseException:
                raise
        if authority is not None:
            authority.closed = True
            authority._issued.clear()
        if boundary is not None:
            boundary.close()
        if source is not None:
            source.close()
        if validation is not None:
            FeatureExecutionJournal.close(validation)
        if effects is not None and borrowed is None:
            FeatureExecutionJournal.close(effects)
        raise


async def close_native_feature_runtime(hass, repository):
    runtime = _RUNTIMES.get(hass)
    if runtime is None:
        return
    if runtime.repository is not repository:
        raise Refusal("feature_runtime_source_changed")
    if runtime.closing is None:

        async def finish():
            await NativeFeatureHost.close(runtime.host)
            runtime.authority.closed = True
            runtime.authority._issued.clear()
            runtime.boundary.close()
            runtime.source.close()
            FeatureExecutionJournal.close(runtime.validation)
            if runtime.owns_effects:
                FeatureExecutionJournal.close(runtime.effects)
            if runtime.stop_remove is not None:
                runtime.stop_remove()
                runtime.stop_remove = None
            if runtime.namespace.get(KEY) is runtime.handle:
                runtime.namespace.pop(KEY)
            _RUNTIMES.pop(hass, None)

        runtime.closing = asyncio.create_task(finish())
    _result, cancelled = await join_owned(runtime.closing)
    if cancelled:
        raise asyncio.CancelledError
