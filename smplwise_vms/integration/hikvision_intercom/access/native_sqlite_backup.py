"""Private bounded backups and NEW restores, never stale live authorization rollback."""

from __future__ import annotations

import asyncio
import hashlib
import os
import stat
from dataclasses import dataclass
from pathlib import Path

from ..trusted_actions.peer_boundary import counter
from ..trusted_actions.validation import Refusal, strict_json
from .commit_tasks import finish_owned_commit
from .models import AccessError
from .native_sqlite_persistence import (
    NativeSqlitePersistence,
    NativeSqliteProfile,
    _same_json,
    accounting,
)
from .storage_envelope import ACTIVE_IMAGE_MAX_BYTES, encode_envelope

BACKUP_FORMAT = "wiskey-native-sqlite-backup.v1"
BACKUP_KEY = "hikvision_intercom.native_backup"
_ORIGINAL_CLOSE = NativeSqlitePersistence.close


@dataclass(frozen=True)
class PrivateArtifact:
    sha256: str
    device: int
    inode: int
    parent_device: int
    parent_inode: int


async def joined_thread(function, *args, **kwargs):
    task = asyncio.create_task(asyncio.to_thread(function, *args, **kwargs))
    await finish_owned_commit(task)
    return task.result()


def private_directory(path, *, create=True):
    path = Path(path).absolute()
    if create:
        path.mkdir(mode=0o700, parents=True, exist_ok=True)
    info = path.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise AccessError("private_storage_directory_required")
    return path


def write_exclusive(path, encoded):
    """One new private artifact; never overwrite history or another file."""
    path = Path(path).absolute()
    parent = private_directory(path.parent)
    before = parent.stat()
    directory_fd = os.open(parent, os.O_RDONLY | os.O_NOFOLLOW)
    opened = os.fstat(directory_fd)
    if (before.st_dev, before.st_ino) != (opened.st_dev, opened.st_ino):
        os.close(directory_fd)
        raise AccessError("storage_path_rebound")
    try:
        fd = os.open(
            path.name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600,
            dir_fd=directory_fd,
        )
    except BaseException:
        os.close(directory_fd)
        raise
    try:
        info = os.fstat(fd)
        if info.st_nlink != 1 or info.st_uid != os.getuid() or info.st_mode & 0o077:
            raise AccessError("private_storage_file_required")
        with os.fdopen(fd, "w", encoding="utf-8", closefd=False) as stream:
            stream.write(encoded)
            stream.flush()
            os.fsync(fd)
        after = parent.stat()
        current = os.stat(path.name, dir_fd=directory_fd, follow_symlinks=False)
        if (
            (before.st_dev, before.st_ino) != (after.st_dev, after.st_ino)
            or (info.st_dev, info.st_ino) != (current.st_dev, current.st_ino)
            or stat.S_IMODE(current.st_mode) != 0o600 or current.st_nlink != 1
        ):
            raise AccessError("storage_path_rebound")
        os.fsync(directory_fd)
    finally:
        os.close(fd)
        os.close(directory_fd)
    return PrivateArtifact(
        hashlib.sha256(encoded.encode()).hexdigest(), info.st_dev, info.st_ino,
        opened.st_dev, opened.st_ino,
    )


def read_private(path, *, limit=ACTIVE_IMAGE_MAX_BYTES):
    path = Path(path).absolute()
    parent = private_directory(path.parent, create=False)
    before = parent.stat()
    directory_fd = os.open(parent, os.O_RDONLY | os.O_NOFOLLOW | os.O_DIRECTORY | os.O_NONBLOCK)
    opened = os.fstat(directory_fd)
    if (before.st_dev, before.st_ino) != (opened.st_dev, opened.st_ino):
        os.close(directory_fd)
        raise AccessError("storage_path_rebound")
    try:
        fd = os.open(path.name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory_fd)
    except BaseException:
        os.close(directory_fd)
        raise
    try:
        info = os.fstat(fd)
        if (
            not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid()
            or info.st_mode & 0o077 or info.st_nlink != 1 or info.st_size > limit
        ):
            raise AccessError("invalid_private_backup")
        with os.fdopen(fd, "rb", closefd=False) as stream:
            encoded = stream.read(limit + 1)
        current = os.stat(path.name, dir_fd=directory_fd, follow_symlinks=False)
        after = parent.stat()
        if (
            len(encoded) > limit
            or (info.st_dev, info.st_ino) != (current.st_dev, current.st_ino)
            or stat.S_IMODE(current.st_mode) != stat.S_IMODE(info.st_mode)
            or current.st_nlink != 1
            or (before.st_dev, before.st_ino) != (after.st_dev, after.st_ino)
        ):
            raise AccessError("invalid_private_backup")
        return encoded
    finally:
        os.close(fd)
        os.close(directory_fd)


def image_digest(image):
    encoded = encode_envelope(
        image, key="hikvision_intercom.users", version=1, minor_version=1,
        limit=ACTIVE_IMAGE_MAX_BYTES, canonical=True,
    )
    return hashlib.sha256(encoded.encode()).hexdigest()


async def backup_native(backend, destination):
    if type(backend) is not NativeSqlitePersistence:
        raise ValueError("original native persistence required")
    owner = NativeSqlitePersistence._stable(backend)
    profile = owner.roots[3]
    if profile.image_limit_bytes is None:
        raise AccessError("bounded_backup_profile_required")
    image, generation = await NativeSqlitePersistence.snapshot(backend)
    if type(image) is not dict or image.get("schema") != 17 or generation < 1:
        raise AccessError("storage_image_not_initialized")
    payload = {
        "format": BACKUP_FORMAT,
        "repository_id": owner.roots[2],
        "profile": profile.metadata(),
        "generation": generation,
        "image_sha256": image_digest(image),
        "image": image,
    }
    encoded = encode_envelope(
        payload, key=BACKUP_KEY, version=1, minor_version=1,
        limit=ACTIVE_IMAGE_MAX_BYTES, canonical=True,
    )
    artifact = await joined_thread(write_exclusive, destination, encoded)
    return {
        "format": BACKUP_FORMAT, "generation": generation,
        "backup_bytes": len(encoded.encode()), "backup_sha256": artifact.sha256,
        "whole_image_included": True, "runtime_adopted": False,
    }


def read_backup(path):
    encoded = read_private(path)
    envelope = strict_json(encoded, limit=ACTIVE_IMAGE_MAX_BYTES)
    if (
        set(envelope) != {"version", "minor_version", "key", "data"}
        or type(envelope["version"]) is not int or envelope["version"] != 1
        or type(envelope["minor_version"]) is not int or envelope["minor_version"] != 1
        or envelope["key"] != BACKUP_KEY or type(envelope["data"]) is not dict
    ):
        raise AccessError("invalid_private_backup")
    payload = envelope["data"]
    if (
        set(payload) != {
            "format", "repository_id", "profile", "generation", "image_sha256", "image"
        }
        or payload["format"] != BACKUP_FORMAT
        or type(payload["image"]) is not dict or payload["image"].get("schema") != 17
    ):
        raise AccessError("invalid_private_backup")
    try:
        counter(payload["generation"])
        profile = NativeSqliteProfile(**payload["profile"])
    except (TypeError, ValueError, Refusal):
        raise AccessError("invalid_private_backup") from None
    if (
        profile.image_limit_bytes is None
        or payload["image_sha256"] != image_digest(payload["image"])
    ):
        raise AccessError("invalid_private_backup")
    accounting(payload["image"], profile)
    return payload, profile


async def _new_backend(path, *, repository_id, profile, generation):
    constructing = asyncio.create_task(asyncio.to_thread(
        NativeSqlitePersistence, path, repository_id=repository_id, profile=profile,
        expect_new=True, initial_generation=generation,
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
            await finish_owned_commit(asyncio.create_task(_ORIGINAL_CLOSE(backend)))
        raise


async def restore_native(backup_path, destination, *, current_backend):
    """Restore only an EXACT current original snapshot into a NEW private DB.

    The original backend remains active/unchanged. The host must quiesce its
    repository and explicitly select the returned new storage; no live pointer
    is switched here. An old backup can never remove a newer receipt/history or
    person/policy change. Missing original current storage is a recovery blocker,
    not permission to reactivate potentially stale authorization offline.
    """
    if type(current_backend) is not NativeSqlitePersistence:
        raise AccessError("restore_current_storage_required")
    owner = NativeSqlitePersistence._stable(current_backend)
    payload, profile = await joined_thread(read_backup, backup_path)
    if payload["repository_id"] != owner.roots[2] or profile != owner.roots[3]:
        raise AccessError("restore_repository_profile_mismatch")
    current, generation = await NativeSqlitePersistence.snapshot(current_backend)
    if payload["generation"] != generation or not _same_json(payload["image"], current):
        raise AccessError("stale_backup_refused")
    restored = await _new_backend(
        destination, repository_id=owner.roots[2], profile=profile, generation=generation,
    )
    try:
        await NativeSqlitePersistence.save(restored, payload["image"])
        image, restored_generation = await NativeSqlitePersistence.snapshot(restored)
        if restored_generation != generation + 1 or not _same_json(image, current):
            raise AccessError("restore_verification_failed")
        # No actor authorization is inferred from a backup. Check the original
        # current store again after constructor/save/load awaits.
        final, final_generation = await NativeSqlitePersistence.snapshot(current_backend)
        if final_generation != generation or not _same_json(final, current):
            raise AccessError("restore_current_storage_changed")
        return {
            "source_generation": generation, "restored_generation": restored_generation,
            "all_people_receipts_history_preserved": True,
            "original_storage_modified": False, "runtime_adopted": False,
            "host_quiescence_and_explicit_selection_required": True,
            "disk_bytes": restored.disk_bytes(),
        }
    finally:
        await finish_owned_commit(asyncio.create_task(_ORIGINAL_CLOSE(restored)))
