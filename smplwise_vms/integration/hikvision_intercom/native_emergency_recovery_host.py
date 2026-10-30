"""Compose original durable emergency refusals before any HA station starts.

The private, versioned binding supplies mapping revisions that HA's ordinary
confirmed lock configuration does not store. It grants no execution authority,
creates no journal and never sends a device command. An absent directory is an
explicitly unconfigured installation; any present invalid directory refuses.
"""

from __future__ import annotations

import asyncio
import os
import stat
import weakref
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID

from homeassistant.config_entries import ConfigEntryState
from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.core import CoreState, HomeAssistant

from .access.arx_execution_authority import StationGrant
from .access.arx_execution_journal import (
    EffectJournalProfile,
    FeatureExecutionJournal,
    ecc_effects_profile,
)
from .access.commit_tasks import finish_owned_commit
from .access.ecc_storage import EccStorageSelection, _selection
from .access.native_emergency_recovery import NativeEmergencyRecovery, RecoveryStation
from .access.native_sqlite_backup import joined_thread, read_private
from .access.native_sqlite_persistence import NativeSqlitePersistence, _check_owned_files
from .access.repository import AccessRepository
from .configuration import managed_locks
from .const import DOMAIN
from .trusted_actions.validation import Refusal, reference, strict_json

FORMAT = "wiskey-native-emergency-recovery-startup.v1"
BOUNDED_FORMAT = "wiskey-native-emergency-recovery-startup.v2"
DIRECTORY = f"{DOMAIN}.native_recovery"
CONFIG_NAME = "startup.json"
KEY = "native_emergency_recovery_host"
MAX_CONFIG_BYTES = 262144
# Separate from the PERSON image budget; not an aggregate or lifetime quota.
MAX_EFFECTS_JOURNAL_OPEN_BYTES = 32 * 1024**2
MAX_REVISION = 9007199254740991
_OWNERS = weakref.WeakKeyDictionary()
_INSTALLED = weakref.WeakKeyDictionary()
_LOCKS = weakref.WeakKeyDictionary()


def configuration_directory(hass: HomeAssistant) -> Path:
    return Path(hass.config.path(".storage", DIRECTORY)).absolute()


def _identity(path: Path, *, directory=False):
    try:
        info = path.lstat()
    except OSError:
        raise Refusal("recovery_path_changed") from None
    if (
        not (stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode))
        or info.st_uid != os.getuid()
        or info.st_mode & 0o077
        or not directory
        and info.st_nlink != 1
    ):
        raise Refusal("recovery_path_changed")
    return info.st_dev, info.st_ino, info.st_uid, stat.S_IMODE(info.st_mode)


def _file_version(path):
    identity = _identity(path)
    info = path.lstat()
    if identity != (info.st_dev, info.st_ino, info.st_uid, stat.S_IMODE(info.st_mode)):
        raise Refusal("recovery_path_changed")
    return (*identity, info.st_size, info.st_mtime_ns, info.st_ctime_ns)


@dataclass(frozen=True, repr=False)
class _Binding:
    directory: Path
    directory_identity: tuple
    file_version: tuple
    repository_id: str
    journal_path: Path
    journal_identity: tuple
    stations: tuple
    profile: EffectJournalProfile | None = None


def _read_binding(directory):
    # lexists detects a broken symlink as a configured, invalid installation.
    if not os.path.lexists(directory):
        return None
    directory_identity = _identity(directory, directory=True)
    path = directory / CONFIG_NAME
    before = _file_version(path)
    value = strict_json(read_private(path, limit=MAX_CONFIG_BYTES), limit=MAX_CONFIG_BYTES)
    if _file_version(path) != before or _identity(directory, directory=True) != directory_identity:
        raise Refusal("recovery_path_changed")
    if (
        set(value) != {"format", "repository_id", "journal", "stations"}
        or type(value["format"]) is not str
        or value["format"] not in {FORMAT, BOUNDED_FORMAT}
    ):
        raise Refusal("recovery_configuration_invalid")
    identity = value["repository_id"]
    try:
        if type(identity) is not str or str(UUID(identity)) != identity:
            raise ValueError
    except (ValueError, AttributeError):
        raise Refusal("durable_repository_uuid_required") from None
    journal = value["journal"]
    bounded = value["format"] == BOUNDED_FORMAT
    keys = {"path", "identity", "profile"} if bounded else {"path", "identity"}
    if type(journal) is not dict or set(journal) != keys:
        raise Refusal("recovery_configuration_invalid")
    profile = None
    if bounded:
        profile = ecc_effects_profile()
        expected = EffectJournalProfile.metadata(profile)
        supplied = journal["profile"]
        if (
            type(supplied) is not dict
            or set(supplied) != set(expected)
            or any(
                type(supplied[k]) is not type(v) or supplied[k] != v for k, v in expected.items()
            )
        ):
            raise Refusal("recovery_configuration_invalid")
    raw_path, raw_identity = journal["path"], journal["identity"]
    if (
        type(raw_path) is not str
        or not 1 <= len(raw_path) <= 4096
        or "\x00" in raw_path
        or not Path(raw_path).is_absolute()
        or str(Path(raw_path)) != raw_path
        or ".." in Path(raw_path).parts
        or type(raw_identity) is not list
        or len(raw_identity) != 4
        or any(type(v) is not int or v < 0 for v in raw_identity)
        or raw_identity[2] != os.getuid()
        or raw_identity[3] != 0o600
    ):
        raise Refusal("recovery_configuration_invalid")
    records = value["stations"]
    if type(records) is not list or not 1 <= len(records) <= 200:
        raise Refusal("recovery_configuration_invalid")
    stations = []
    for row in records:
        if type(row) is not dict or set(row) != {"entry_id", "identity", "relays"}:
            raise Refusal("recovery_configuration_invalid")
        sid, device, relays = reference(row["entry_id"]), row["identity"], row["relays"]
        if (
            type(device) is not str
            or not 1 <= len(device) <= 256
            or type(relays) is not list
            or not 1 <= len(relays) <= 2
        ):
            raise Refusal("recovery_configuration_invalid")
        try:
            device.encode("utf-8", errors="strict")
        except UnicodeError:
            raise Refusal("recovery_configuration_invalid") from None
        grants = []
        for relay in relays:
            if type(relay) is not dict or set(relay) != {
                "api_relay",
                "physical_relay",
                "mapping_revision",
            }:
                raise Refusal("recovery_configuration_invalid")
            api, physical, revision = (
                relay["api_relay"],
                relay["physical_relay"],
                relay["mapping_revision"],
            )
            if (
                type(api) is not int
                or api not in {1, 2}
                or type(physical) is not int
                or physical not in {1, 2}
                or type(revision) is not int
                or not 1 <= revision <= MAX_REVISION
            ):
                raise Refusal("recovery_configuration_invalid")
            grants.append((sid, api, physical, revision))
        if len({g[1] for g in grants}) != len(grants) or len({g[2] for g in grants}) != len(grants):
            raise Refusal("recovery_configuration_invalid")
        stations.append((sid, device, tuple(grants)))
    if len({row[0] for row in stations}) != len(stations):
        raise Refusal("recovery_configuration_invalid")
    return _Binding(
        directory,
        directory_identity,
        before,
        identity,
        Path(raw_path),
        tuple(raw_identity),
        tuple(stations),
        profile,
    )


def _check_binding(binding):
    if (
        _identity(binding.directory, directory=True) != binding.directory_identity
        or _file_version(binding.directory / CONFIG_NAME) != binding.file_version
        or _identity(binding.journal_path) != binding.journal_identity
    ):
        raise Refusal("recovery_path_changed")


def _journal_bytes(binding):
    """Bound the separate original DB/WAL/SHM at startup; never prune rows."""
    total = 0
    _identity(binding.journal_path.parent, directory=True)
    for suffix in ("", "-wal", "-shm"):
        target = Path(str(binding.journal_path) + suffix)
        if suffix and not os.path.lexists(target):
            continue
        before = _identity(target)
        info = target.lstat()
        if before != (info.st_dev, info.st_ino, info.st_uid, stat.S_IMODE(info.st_mode)):
            raise Refusal("recovery_path_changed")
        total += info.st_size
        if total > MAX_EFFECTS_JOURNAL_OPEN_BYTES:
            raise Refusal("effects_journal_startup_capacity")
    _check_binding(binding)
    return total


def _context(hass, repository, selection):
    if (
        type(hass) is not HomeAssistant
        or type(repository) is not AccessRepository
        or hass.state in {CoreState.stopping, CoreState.final_write, CoreState.stopped}
    ):
        raise Refusal("recovery_host_unavailable")
    from .ecc_host_storage import selection_directory

    installed = hass.data.get(DOMAIN, {}).get("ecc_storage")
    if installed is not None and installed is not selection:
        raise Refusal("recovery_host_unavailable")
    if selection is None and os.path.lexists(selection_directory(hass)):
        raise Refusal("recovery_host_unavailable")
    if selection is not None:
        if type(selection) is not EccStorageSelection:
            raise Refusal("recovery_host_unavailable")
        roots = _selection(selection)
        backend_owner = NativeSqlitePersistence._stable(roots[0])
        _check_owned_files(backend_owner)
        if (
            getattr(repository._save, "__self__", None) is not selection
            or getattr(repository._save, "__func__", None) is not EccStorageSelection.async_save
        ):
            raise Refusal("recovery_host_unavailable")
        return roots
    return None


def _stations(hass, binding):
    entries = tuple(hass.config_entries.async_entries(DOMAIN))
    if {entry.entry_id for entry in entries} != {s[0] for s in binding.stations}:
        raise Refusal("emergency_recovery_unbound")
    result = []
    for sid, identity, rows in binding.stations:
        entry = hass.config_entries.async_get_entry(sid)
        if (
            entry is None
            or entry.domain != DOMAIN
            or entry.unique_id != identity
            or entry.state is not ConfigEntryState.NOT_LOADED
            or getattr(entry, "runtime_data", None) is not None
            or {(lock.physical_index, lock.api_id) for lock in managed_locks(entry.data)}
            != {(g[2], g[1]) for g in rows}
        ):
            raise Refusal("emergency_recovery_unbound")
        result.append(RecoveryStation(entry, identity, tuple(StationGrant(*g) for g in rows)))
    return tuple(result)


def _claims_bound(journal, binding):
    if (
        getattr(journal.pending_secure_claims, "__self__", None) is not journal
        or getattr(journal.pending_secure_claims, "__func__", None)
        is not FeatureExecutionJournal.pending_secure_claims
    ):
        raise Refusal("binding_denied")
    expected = {
        (*grant, identity) for _sid, identity, grants in binding.stations for grant in grants
    }
    claims = FeatureExecutionJournal.pending_secure_claims(journal)
    if any(claim["target_signature"] not in expected for claim in claims):
        raise Refusal("emergency_recovery_unbound")


def _journal_profile_matches(journal, binding):
    original = FeatureExecutionJournal._stable(journal).configuration
    actual, expected = original[4], binding.profile
    if (actual is None) != (expected is None) or (
        actual is not None
        and (
            type(actual) is not EffectJournalProfile
            or EffectJournalProfile.metadata(actual) != EffectJournalProfile.metadata(expected)
        )
    ):
        raise Refusal("binding_denied")


@dataclass(repr=False)
class _Owner:
    hass: weakref.ReferenceType
    repository: weakref.ReferenceType
    selection: weakref.ReferenceType | None
    selection_roots: tuple | None
    binding: _Binding
    journal: weakref.ReferenceType
    owns_journal: bool
    recovery: weakref.ReferenceType
    close_task: weakref.ReferenceType | None = None
    close_failed: bool = False
    closed: bool = False
    stop: weakref.ReferenceType | None = None


class NativeEmergencyRecoveryHost:
    """Original startup journal owner; never an execution-policy provider."""

    @property
    def storage_accounting(self):
        owner = NativeEmergencyRecoveryHost._current(self)
        result = {
            "effects_journal_physical_bytes": _journal_bytes(owner.binding),
            "effects_journal_startup_open_limit_bytes": MAX_EFFECTS_JOURNAL_OPEN_BYTES,
            "effects_journal_runtime_growth_bounded": False,
            "native_person_image_accounted_here": False,
        }
        if owner.binding.profile is not None:
            status = FeatureExecutionJournal.storage_status(owner.journal())
            result.update(
                {
                    "effects_journal_runtime_growth_bounded": True,
                    "effects_journal_profile": EffectJournalProfile.metadata(owner.binding.profile),
                    "effects_journal_record_limit": status["max_records"],
                    "effects_journal_records": status["records"],
                }
            )
        return result

    @property
    def journal(self):
        owner = NativeEmergencyRecoveryHost._current(self)
        return owner.journal()

    def _current(self):
        owner = _OWNERS.get(self)
        if owner is None or owner.closed or owner.close_task is not None:
            raise Refusal("recovery_host_unavailable")
        hass, repository = owner.hass(), owner.repository()
        selection = owner.selection() if owner.selection is not None else None
        if (
            hass is None
            or repository is None
            or owner.selection is not None
            and selection is None
            or _context(hass, repository, selection) is not owner.selection_roots
            or _INSTALLED.get(hass) is None
            or _INSTALLED[hass]() is not self
            or hass.data.get(DOMAIN, {}).get(KEY) is not self
            or getattr(self, "_recovery", None) is not owner.recovery()
            or owner.journal() is None
            or getattr(self, "_journal", None) is not owner.journal()
        ):
            raise Refusal("recovery_host_unavailable")
        _check_binding(owner.binding)
        FeatureExecutionJournal._stable(owner.journal())
        _journal_profile_matches(owner.journal(), owner.binding)
        recovery = owner.recovery()
        if recovery is None:
            raise Refusal("recovery_host_unavailable")
        # Existing recovery owns the exact HA entry/connection/relay snapshots.
        from .access.native_emergency_recovery import _issued

        NativeEmergencyRecovery._current(recovery, _issued(recovery))
        return owner

    async def close(self):
        # Cleanup uses original issuance, even after aliases/config/labels change.
        owner = _OWNERS.get(self)
        if owner is None:
            raise Refusal("recovery_host_unavailable")
        task = owner.close_task() if owner.close_task is not None else None
        if task is None and owner.close_failed:
            # A lost weak task never turns failed cleanup into a fresh attempt.
            raise Refusal("recovery_cleanup_unknown")
        if task is None and owner.closed:
            return
        if task is None:

            async def finish():
                hass, repository = owner.hass(), owner.repository()
                try:
                    if hass is None or repository is None:
                        raise Refusal("recovery_cleanup_unknown")
                    from .access.arx_feature_host import close_native_feature_hosts

                    await close_native_feature_hosts(hass, repository)
                    if owner.owns_journal:
                        original = owner.journal()
                        if original is None:
                            raise Refusal("recovery_cleanup_unknown")
                        FeatureExecutionJournal.close(original)
                    stop = owner.stop() if owner.stop is not None else None
                    if stop is not None:
                        stop()
                    if hass.data.get(DOMAIN, {}).get(KEY) is self:
                        del hass.data[DOMAIN][KEY]
                except BaseException:
                    # A refused feature join cannot retire its durable source.
                    # Keep the original journal, listener and namespace owned;
                    # current/source/rebind guards still refuse this close task.
                    owner.close_failed = True
                    raise
                owner.closed = True

            task = asyncio.create_task(finish())
            owner.close_task = weakref.ref(task)
            # HA owns the host/task graph. Module issuance cannot retain HA via
            # a task context or a failed cleanup's original traceback.
            self._close_task = task
        await finish_owned_commit(task)


async def async_setup_native_emergency_recovery(
    hass: HomeAssistant,
    *,
    repository: AccessRepository,
    selection: EccStorageSelection | None = None,
    journal: FeatureExecutionJournal | None = None,
) -> NativeEmergencyRecoveryHost | None:
    """Call after repository open and before ANY DOMAIN entry setup.

    The returned ``host.journal`` is the exact original journal for subsequent
    NativeFeatureHost installation. A supplied matching journal stays caller
    owned. An internally opened journal is closed after all original feature
    hosts finish. A missing configuration directory returns None, never success.
    """
    initial = _context(hass, repository, selection)
    lock = _LOCKS.setdefault(hass, asyncio.Lock())
    async with lock:
        registered = _INSTALLED.get(hass)
        if registered is not None:
            host = registered()
            if host is None:
                raise Refusal("recovery_host_unavailable")
            owner = NativeEmergencyRecoveryHost._current(host)
            if (
                owner.repository() is not repository
                or (owner.selection() if owner.selection is not None else None) is not selection
                or journal is not None
                and journal is not owner.journal()
            ):
                raise Refusal("recovery_host_unavailable")
            return host
        binding = await joined_thread(_read_binding, configuration_directory(hass))
        if _context(hass, repository, selection) is not initial:
            raise Refusal("recovery_host_unavailable")
        if binding is None:
            return None
        if initial is not None and binding.repository_id != initial[1]:
            raise Refusal("binding_denied")
        stations = _stations(hass, binding)
        _check_binding(binding)
        _journal_bytes(binding)
        owns_journal = journal is None
        if journal is not None and type(journal) is not FeatureExecutionJournal:
            raise Refusal("binding_denied")
        opened = journal
        try:
            if opened is None:
                # Never construct against an absent/replaced database. The
                # existing journal independently rechecks original path/inode.
                opened = FeatureExecutionJournal(
                    binding.journal_path,
                    repository_id=binding.repository_id,
                    expect_existing=True,
                    profile=binding.profile,
                )
            original = FeatureExecutionJournal._stable(opened).configuration
            if original[1] != binding.repository_id or original[2] != binding.journal_path:
                raise Refusal("binding_denied")
            _check_binding(binding)
            _journal_profile_matches(opened, binding)
            _claims_bound(opened, binding)
            _journal_bytes(binding)
            _stations(hass, binding)
            if _context(hass, repository, selection) is not initial:
                raise Refusal("recovery_host_unavailable")
            if KEY in hass.data.setdefault(DOMAIN, {}):
                raise Refusal("recovery_host_unavailable")
            recovery = NativeEmergencyRecovery(hass, opened, stations)
            host = NativeEmergencyRecoveryHost()
            host._recovery, host._journal = recovery, opened
            owner = _Owner(
                weakref.ref(hass),
                weakref.ref(repository),
                weakref.ref(selection) if selection is not None else None,
                initial,
                binding,
                weakref.ref(opened),
                owns_journal,
                weakref.ref(recovery),
            )
            _OWNERS[host] = owner
            hass.data[DOMAIN][KEY] = host
            _INSTALLED[hass] = weakref.ref(host)

            async def stop(_event, original_journal=opened):
                # HA owns this closure, which retains the original journal even
                # if every public host resource label is grafted. Module issuance
                # remains weak, so journal leases cannot globally root HA.
                await NativeEmergencyRecoveryHost.close(host)

            host._stop = hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, stop)
            owner.stop = weakref.ref(host._stop)
            return host
        except BaseException:
            if owns_journal and opened is not None:
                FeatureExecutionJournal.close(opened)
            raise


async def close_native_emergency_recovery(hass, repository):
    """Join original feature effects before the original recovery journal closes."""
    first = None
    for host, owner in tuple(_OWNERS.items()):
        if owner.hass() is hass and owner.repository() is repository:
            try:
                await NativeEmergencyRecoveryHost.close(host)
            except (Exception, asyncio.CancelledError) as error:
                if first is None:
                    first = error
    if first is not None:
        raise first


def _execution_recovery_context(hass, journal):
    if type(hass) is not HomeAssistant:
        raise Refusal("emergency_recovery_unavailable")
    registered = _INSTALLED.get(hass)
    host = registered() if registered is not None else None
    if host is None or type(journal) is not FeatureExecutionJournal:
        raise Refusal("emergency_recovery_unavailable")
    owner = NativeEmergencyRecoveryHost._current(host)
    from .access.manager import AccessManager

    manager = hass.data.get(DOMAIN, {}).get("access")
    if (
        type(manager) is not AccessManager
        or manager.repository is not owner.repository()
        or manager._closed
    ):
        raise Refusal("emergency_recovery_unavailable")
    if owner.hass() is not hass or owner.journal() is not journal:
        raise Refusal("emergency_recovery_unavailable")
    return host, owner, manager


def _fresh_execution_recovery_context(hass, journal):
    original = _execution_recovery_context(hass, journal)
    _claims_bound(journal, original[1].binding)
    _journal_bytes(original[1].binding)
    current = _execution_recovery_context(hass, journal)
    if any(a is not b for a, b in zip(original, current, strict=True)):
        raise Refusal("emergency_recovery_unavailable")
    return current


def native_emergency_recovery_ready(hass, journal) -> bool:
    """Current original startup binding only; no grants/authority are constructed."""
    try:
        _fresh_execution_recovery_context(hass, journal)
    except Exception:
        # Status must fail closed even for corrupt/closed/rebound native storage.
        # Cancellation is not converted to successful readiness.
        return False
    return True


def require_native_emergency_recovery(
    hass: HomeAssistant, journal: FeatureExecutionJournal, grants: tuple[StationGrant, ...]
) -> None:
    """Require original restart refusals; this grants no command permission.

    The production feature host must ALSO check its current signed lease/source
    and actual native targets. Every complete typed grant must match this boot's
    explicit private mapping revision; raw JSON or partial relay labels refuse.
    """
    if (
        type(grants) is not tuple
        or not 1 <= len(grants) <= 400
        or any(type(grant) is not StationGrant for grant in grants)
    ):
        raise Refusal("emergency_recovery_unavailable")
    original = _execution_recovery_context(hass, journal)
    host, owner, manager = original
    expected = {grant for _sid, _identity, rows in owner.binding.stations for grant in rows}
    values = []
    for grant in grants:
        StationGrant.__post_init__(grant)
        values.append(
            (
                grant.station_id,
                grant.api_relay,
                grant.physical_relay,
                grant.mapping_revision,
            )
        )
    if len({(g[0], g[2]) for g in values}) != len(values) or any(
        value not in expected for value in values
    ):
        raise Refusal("emergency_recovery_unbound")
    current = _fresh_execution_recovery_context(hass, journal)
    if any(a is not b for a, b in zip(original, current, strict=True)) or values != [
        (g.station_id, g.api_relay, g.physical_relay, g.mapping_revision) for g in grants
    ]:
        raise Refusal("emergency_recovery_unavailable")
