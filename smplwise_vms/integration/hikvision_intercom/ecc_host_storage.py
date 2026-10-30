"""Select an already migrated ECC repository before any access writer starts.

The ordinary HA image remains the default when no ECC directory exists. A
present incomplete/corrupt selection refuses startup rather than reactivating
the old authorization image. First migration is an offline maintenance action.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from homeassistant.core import HomeAssistant

from .access.commit_tasks import finish_owned_commit
from .access.ecc_storage import MANIFEST_NAME, EccStorageSelection, open_ecc_storage
from .access.models import AccessError
from .access.native_sqlite_backup import joined_thread, read_private
from .access.repository import AccessRepository
from .const import DOMAIN
from .storage import AccessStore
from .trusted_actions.validation import strict_json


def selection_directory(hass: HomeAssistant) -> Path:
    return Path(hass.config.path(".storage", f"{DOMAIN}.ecc"))


def _identity(directory: Path) -> str:
    manifest = strict_json(read_private(directory / MANIFEST_NAME, limit=16384), limit=16384)
    # The factory validates the complete closed manifest, original database,
    # backup, profile and canonical UUID before opening the selected engine.
    identity = manifest.get("repository_id")
    if type(identity) is not str:
        raise AccessError("durable_repository_uuid_required")
    return identity


async def open_host_repository(hass: HomeAssistant):
    """Return the actual repository and its original optional storage owner."""
    directory = selection_directory(hass)
    selection = None
    try:
        # lexists also detects a broken/replaced selection path. Never fall back
        # to the older person/receipt history when a selection is present.
        import os

        selected = await hass.async_add_executor_job(os.path.lexists, directory)
        if selected:
            identity = await joined_thread(_identity, directory)
            selection = await open_ecc_storage(directory, repository_id=identity)
            repository = AccessRepository(
                selection.async_save,
                peer_receipts=True,
                peer_receipt_limit=selection.receipt_limit,
            )
            await repository.async_load(await selection.async_load())
        else:
            store = AccessStore(hass)
            repository = AccessRepository(store.async_save)
            await repository.async_load(await store.async_load())
        return repository, selection
    except BaseException:
        if selection is not None:
            await close_selection(selection)
        raise


async def close_selection(selection: EccStorageSelection) -> None:
    """Join the original selected engine even through repeated cancellation."""
    await finish_owned_commit(asyncio.create_task(EccStorageSelection.close(selection)))
