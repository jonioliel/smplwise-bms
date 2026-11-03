"""Explicit ECC storage selection within the unchanged total32MiB budget."""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import stat
import weakref
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID, uuid4

from ..trusted_actions.peer_boundary import counter
from ..trusted_actions.validation import Refusal, strict_json
from .commit_tasks import finish_owned_commit
from .models import AccessError
from .native_image_copy import copy_image
from .native_sqlite_backup import joined_thread, private_directory, read_private, write_exclusive
from .native_sqlite_migration import migrate_candidate
from .native_sqlite_persistence import NativeSqlitePersistence, NativeSqliteProfile, _same_json
from .storage_envelope import ACTIVE_IMAGE_MAX_BYTES, ENVELOPE_FORMAT, encode_envelope

ECC_PROFILE_REF = "wiskey-ecc-32mib.v1"
SELECTION_FORMAT = "wiskey-ecc-storage-selection.v2"
DATABASE_NAME = "engine.sqlite"
BACKUP_NAME = "legacy-backup.json"
MANIFEST_NAME = "selection.json"
_SELECTIONS = weakref.WeakKeyDictionary()


def ecc_profile() -> NativeSqliteProfile:
    """Conservative original WAL reserve; capacity never promises10k people."""
    return NativeSqliteProfile(
        profile_ref=ECC_PROFILE_REF,
        revision=1,
        receipt_limit=4096,
        node_limit=32768,
        logical_budget_bytes=6 * 1024**2,
        disk_budget_bytes=ACTIVE_IMAGE_MAX_BYTES,
        layout_revision=2,
        image_limit_bytes=ACTIVE_IMAGE_MAX_BYTES,
        image_format=ENVELOPE_FORMAT,
    )


@dataclass(frozen=True, eq=False)
class EccStorageSelection:
    """Host composes the actual native repository with this exact save/load port."""

    backend: NativeSqlitePersistence
    repository_id: str
    profile: NativeSqliteProfile
    directory: Path
    initial_generation: int

    @property
    def receipt_limit(self):
        return _selection(self)[2].receipt_limit

    @property
    def database_path(self):
        return _selection(self)[3] / DATABASE_NAME

    async def async_save(self, image):
        backend = _selection(self)[0]
        # Once admitted, join the ORIGINAL save normally so native RAM can
        # publish even if the caller is canceled or public labels are grafted.
        await NativeSqlitePersistence.save(backend, image)

    async def async_load(self):
        return await NativeSqlitePersistence.load(_selection(self)[0])

    async def close(self):
        if type(self) is not EccStorageSelection:
            raise Refusal("binding_denied")
        roots = _SELECTIONS.get(self)
        if roots is not None:
            await NativeSqlitePersistence.close(roots[0])


def _selection(value):
    if type(value) is not EccStorageSelection:
        raise Refusal("binding_denied")
    roots = _SELECTIONS.get(value)
    if roots is None or (
        value.backend is not roots[0] or type(value.repository_id) is not str
        or value.repository_id != roots[1]
        or value.profile is not roots[2] or value.directory is not roots[3]
        or type(value.initial_generation) is not int
        or value.initial_generation != roots[4]
    ):
        raise Refusal("binding_denied")
    return roots


async def _open_backend(path, *, repository_id, profile):
    constructing = asyncio.create_task(asyncio.to_thread(
        NativeSqlitePersistence, path, repository_id=repository_id, profile=profile,
    ))
    try:
        await finish_owned_commit(constructing)
        return constructing.result()
    except BaseException:
        if (
            constructing.done() and not constructing.cancelled()
            and constructing.exception() is None
        ):
            backend = constructing.result()
            await finish_owned_commit(asyncio.create_task(NativeSqlitePersistence.close(backend)))
        raise


def _manifest(directory, repository_id, profile):
    value = strict_json(read_private(directory / MANIFEST_NAME, limit=16384), limit=16384)
    if (
        set(value) != {
            "format", "repository_id", "profile", "database", "initial_generation",
            "source_schema", "source_backup_sha256",
            "storage_origin",
        }
        or value["format"] != SELECTION_FORMAT or value["repository_id"] != repository_id
        or value["profile"] != profile.metadata() or value["database"] != DATABASE_NAME
        or type(value["source_schema"]) is not int or value["source_schema"] != 16
    ):
        raise AccessError("ecc_storage_selection_mismatch")
    counter(value["initial_generation"])
    original_backup = read_private(directory / BACKUP_NAME)
    if hashlib.sha256(original_backup).hexdigest() != value["source_backup_sha256"]:
        raise AccessError("ecc_storage_backup_changed")
    _storage_origin(directory, value["storage_origin"])
    return value


def _storage_origin(directory, expected):
    if type(expected) is not dict or set(expected) != {
        "database_identity", "directory_identity", "image_sha256"
    }:
        raise AccessError("ecc_storage_selection_mismatch")
    if (
        any(
            type(expected[key]) is not list or len(expected[key]) != 4
            or any(type(value) is not int or value < 0 for value in expected[key])
            for key in ("database_identity", "directory_identity")
        )
        or type(expected["image_sha256"]) is not str
        or len(expected["image_sha256"]) != 64
        or set(expected["image_sha256"]) - set("0123456789abcdef")
    ):
        raise AccessError("ecc_storage_selection_mismatch")
    database = (directory / DATABASE_NAME).lstat()
    parent = directory.lstat()
    if (
        list((database.st_dev, database.st_ino, database.st_uid, stat.S_IMODE(database.st_mode)))
        != expected["database_identity"]
        or list((parent.st_dev, parent.st_ino, parent.st_uid, stat.S_IMODE(parent.st_mode)))
        != expected["directory_identity"]
    ):
        raise AccessError("storage_path_rebound")


def _source_current(source_guard, original, owned):
    try:
        return (
            (source_guard is None or source_guard() is True)
            and _same_json(original, owned)
        )
    except Exception:
        return False


def _unselect_manifest(directory, artifact):
    source = directory / MANIFEST_NAME
    directory_fd = os.open(directory, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        parent = os.fstat(directory_fd)
        info = os.stat(MANIFEST_NAME, dir_fd=directory_fd, follow_symlinks=False)
        if (
            (parent.st_dev, parent.st_ino) != (artifact.parent_device, artifact.parent_inode)
            or (info.st_dev, info.st_ino) != (artifact.device, artifact.inode)
            or hashlib.sha256(read_private(source, limit=16384)).hexdigest() != artifact.sha256
        ):
            raise AccessError("selection_publication_uncertain")
        rejected = f"selection.source-changed.{uuid4().hex}.json"
        os.link(
            MANIFEST_NAME, rejected, src_dir_fd=directory_fd, dst_dir_fd=directory_fd,
            follow_symlinks=False,
        )
        current = os.stat(MANIFEST_NAME, dir_fd=directory_fd, follow_symlinks=False)
        retained = os.stat(rejected, dir_fd=directory_fd, follow_symlinks=False)
        if (
            (current.st_dev, current.st_ino) != (artifact.device, artifact.inode)
            or (retained.st_dev, retained.st_ino) != (artifact.device, artifact.inode)
        ):
            raise AccessError("selection_publication_uncertain")
        os.unlink(MANIFEST_NAME, dir_fd=directory_fd)
        os.fsync(directory_fd)
    finally:
        os.close(directory_fd)


def _publish_manifest(directory, value, original, owned, source_guard):
    if not _source_current(source_guard, original, owned):
        raise AccessError("migration_source_changed")
    _storage_origin(directory, value["storage_origin"])
    text = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    if len(text.encode()) > 16384:
        raise AccessError("ecc_storage_selection_mismatch")
    artifact = write_exclusive(directory / MANIFEST_NAME, text)
    if not _source_current(source_guard, original, owned):
        # This artifact was created exclusively by THIS operation. Preserve it
        # as failed evidence and leave no active selection after a changed input.
        _unselect_manifest(directory, artifact)
        raise AccessError("migration_source_changed")
    return artifact


async def open_ecc_storage(
    directory, *, repository_id, legacy_image=None, create=False, source_guard=None,
):
    """Explicit host-only adoption after actual ECC/config verification.

    Caller must quiesce the old repository during first migration. The original
    HA file is never changed. Missing/corrupt selections and orphan candidates
    never silently become a new installation. UUID comes from durable existing
    registry/config, never regenerated on boot. No HA user is created here.
    """
    if type(create) is not bool:
        raise ValueError("explicit ECC storage creation selection required")
    if source_guard is not None and not callable(source_guard):
        raise ValueError("original synchronous source guard required")
    try:
        if type(repository_id) is not str or str(UUID(repository_id)) != repository_id:
            raise ValueError
    except (ValueError, AttributeError):
        raise AccessError("durable_repository_uuid_required") from None
    profile = ecc_profile()
    directory = await joined_thread(private_directory, directory, create=create)
    published = None
    try:
        manifest = await joined_thread(_manifest, directory, repository_id, profile)
    except FileNotFoundError:
        if not create:
            raise AccessError("ecc_storage_not_selected") from None
        if (directory / DATABASE_NAME).exists() or (directory / BACKUP_NAME).exists():
            raise AccessError("unselected_storage_exists") from None
        if type(legacy_image) is not dict or legacy_image.get("schema") != 16:
            raise AccessError("ecc_migration_requires_schema16") from None
        owned = copy_image(legacy_image)
        encoded = encode_envelope(
            owned, key="hikvision_intercom.users", version=1, minor_version=1,
            limit=ACTIVE_IMAGE_MAX_BYTES, canonical=True,
        )
        source_artifact = await joined_thread(write_exclusive, directory / BACKUP_NAME, encoded)
        if not _same_json(legacy_image, owned):
            raise AccessError("migration_source_changed") from None
        report = await migrate_candidate(
            legacy_image, directory / DATABASE_NAME, repository_id=repository_id,
            profile=profile, dry_run=False,
        )
        manifest = {
            "format": SELECTION_FORMAT, "repository_id": repository_id,
            "profile": profile.metadata(), "database": DATABASE_NAME,
            "initial_generation": report["save"]["generation"],
            "source_schema": 16, "source_backup_sha256": source_artifact.sha256,
            "storage_origin": report["storage_origin"],
        }
        published = await joined_thread(
            _publish_manifest, directory, manifest, legacy_image, owned, source_guard
        )
    await joined_thread(_storage_origin, directory, manifest["storage_origin"])
    backend = await _open_backend(
        directory / DATABASE_NAME, repository_id=repository_id, profile=profile,
    )
    try:
        image, generation = await NativeSqlitePersistence.snapshot(backend)
        if (
            type(image) is not dict or image.get("schema") != 17
            or generation < manifest["initial_generation"]
        ):
            raise AccessError("ecc_storage_selection_mismatch")
        await joined_thread(_storage_origin, directory, manifest["storage_origin"])
        if published is not None:
            from .native_sqlite_backup import image_digest

            if image_digest(image) != manifest["storage_origin"]["image_sha256"]:
                await joined_thread(_unselect_manifest, directory, published)
                raise AccessError("ecc_storage_initial_image_changed")
        if published is not None and not await joined_thread(
            _source_current, source_guard, legacy_image, owned
        ):
            await joined_thread(_unselect_manifest, directory, published)
            raise AccessError("migration_source_changed")
    except BaseException:
        await finish_owned_commit(asyncio.create_task(NativeSqlitePersistence.close(backend)))
        raise
    result = EccStorageSelection(
        backend, repository_id, profile, directory, manifest["initial_generation"]
    )
    _SELECTIONS[result] = (
        backend, repository_id, profile, directory, manifest["initial_generation"]
    )
    return result
