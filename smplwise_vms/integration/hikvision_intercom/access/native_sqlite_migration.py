"""Explicit schema16 -> new private schema17 SQLite candidate, never adoption.

The original HA image is read/copied only. No active file, registry, principal,
admission, caller or worker is changed. A legacy native operation receipt is
never upgraded into a claimed authenticated peer receipt.
"""

from __future__ import annotations

import asyncio
import hashlib
from copy import deepcopy
from pathlib import Path

from .commit_tasks import finish_owned_commit
from .models import AccessError
from .native_peer_storage import defaults
from .native_sqlite_persistence import (
    NativeSqlitePersistence,
    NativeSqliteProfile,
    _same_json,
    accounting,
)
from .repository import AccessRepository
from .storage_envelope import encode_envelope


async def prepare_candidate(image, *, profile: NativeSqliteProfile):
    if type(image) is not dict or image.get("schema") != 16:
        raise AccessError("candidate_migration_requires_schema16")

    async def no_save(_):
        raise AccessError("migration_source_save_refused")

    # Run the actual native strict historical loader on an owned copy. It may
    # reset transient syncing views exactly as a normal native restart does.
    source = AccessRepository(no_save)
    await source.async_load(deepcopy(image))
    candidate = source.snapshot()
    candidate["schema"] = 17
    candidate["peer_source"] = defaults(receipt_limit=profile.receipt_limit)
    target = AccessRepository(no_save, peer_receipts=True, peer_receipt_limit=profile.receipt_limit)
    await target.async_load(candidate)
    result = target.snapshot()
    return result, {
        "source_schema": 16,
        "candidate_schema": 17,
        "active_source_modified": False,
        "peer_receipts_invented": False,
        "runtime_adopted": False,
        "transient_restart_normalization": candidate
        != {
            **deepcopy(image),
            "schema": 17,
            "peer_source": defaults(receipt_limit=profile.receipt_limit),
        },
        "accounting": accounting(result, profile),
    }


def _destination(destination):
    path = Path(destination).absolute()
    if (
        path.exists()
        or path.is_symlink()
        or any(Path(str(path) + suffix).exists() for suffix in ("-wal", "-shm"))
    ):
        raise AccessError("candidate_destination_exists")
    return path


async def migrate_candidate(image, destination, *, repository_id, profile, dry_run=True):
    if type(dry_run) is not bool:
        raise ValueError("explicit candidate dry-run selection required")
    owned = deepcopy(image)
    candidate, report = await prepare_candidate(owned, profile=profile)
    if not _same_json(image, owned):
        raise AccessError("migration_source_changed")
    report = await _write_candidate(
        candidate, report, destination, repository_id=repository_id, profile=profile,
        dry_run=dry_run,
    )
    if not _same_json(image, owned):
        raise AccessError("migration_source_changed")
    return report


async def repack_candidate(
    image, destination, *, repository_id, profile, dry_run=True,
    pin_quarantine=None, quarantine_clock=None,
):
    """Explicit schema17 -> NEW private physical-profile candidate only.

    A caller supplies the target profile and any existing owner PIN policy;
    disk data never selects authority. All original receipt/create/registry
    fences are preserved through the actual native restart loader.
    """
    if type(dry_run) is not bool:
        raise ValueError("explicit candidate dry-run selection required")
    if type(image) is not dict or image.get("schema") != 17:
        raise AccessError("candidate_repack_requires_schema17")
    owned = deepcopy(image)

    async def no_save(_):
        raise AccessError("migration_source_save_refused")

    target = AccessRepository(
        no_save, peer_receipts=True, peer_receipt_limit=profile.receipt_limit,
        pin_quarantine=pin_quarantine, quarantine_clock=quarantine_clock,
    )
    await target.async_load(owned)
    candidate = target.snapshot()
    if not _same_json(candidate["peer_source"], owned["peer_source"]):
        raise AccessError("candidate_verification_failed")
    if not _same_json(image, owned):
        raise AccessError("migration_source_changed")
    report = {
        "source_schema": 17,
        "candidate_schema": 17,
        "explicit_physical_repack": True,
        "active_source_modified": False,
        "peer_receipts_invented": False,
        "original_peer_fences_preserved": True,
        "runtime_adopted": False,
        "transient_restart_normalization": candidate != image,
        "accounting": accounting(candidate, profile),
    }
    report = await _write_candidate(
        candidate, report, destination, repository_id=repository_id, profile=profile,
        dry_run=dry_run,
    )
    # This final check includes destination, constructor, save/load AND cleanup
    # awaits. A private candidate may exist, but a changed source never gets a
    # verified unchanged-source report and is never adopted automatically.
    if not _same_json(image, owned):
        raise AccessError("migration_source_changed")
    return report


async def _write_candidate(
    candidate, report, destination, *, repository_id, profile, dry_run,
):
    report["dry_run"] = dry_run
    path = await asyncio.to_thread(_destination, destination)
    if dry_run:
        return report
    constructing = asyncio.create_task(
        asyncio.to_thread(
            NativeSqlitePersistence,
            path,
            repository_id=repository_id,
            profile=profile,
            expect_new=True,
        )
    )
    try:
        await finish_owned_commit(constructing)
        backend = constructing.result()
    except FileExistsError:
        raise AccessError("candidate_destination_exists") from None
    except BaseException:
        if (
            constructing.done()
            and not constructing.cancelled()
            and constructing.exception() is None
        ):
            backend = constructing.result()
            await finish_owned_commit(asyncio.create_task(backend.close()))
        raise
    try:
        await backend.save(candidate)
        restored = await backend.load()
        if restored != candidate:
            raise AccessError("candidate_verification_failed")
        report["persisted"] = True
        report["disk_bytes"] = backend.disk_bytes()
        report["save"] = backend.last_save
        if profile.image_limit_bytes is not None:
            owner = NativeSqlitePersistence._stable(backend)
            report["storage_origin"] = {
                "database_identity": list(owner.files["db"]),
                "directory_identity": list(owner.parent),
                "image_sha256": hashlib.sha256(encode_envelope(
                    candidate, key="hikvision_intercom.users", version=1, minor_version=1,
                    limit=profile.image_limit_bytes, canonical=True,
                ).encode()).hexdigest(),
            }
        return report
    finally:
        await finish_owned_commit(asyncio.create_task(backend.close()))
