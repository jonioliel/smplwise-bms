"""Native-owned durable repository identity; never a grant or ECC selector.

The original repository-open lifecycle is the sole producer. A read/probe never
creates it. Legacy person schema16 and ConfigEntry1.2 remain byte-compatible.
The private initial image backup precedes the first exclusive identity commit.
Loss/corruption alongside prior durable state refuses identity resolution rather
than silently creating another UUID; ordinary legacy operation remains intact.
"""

from __future__ import annotations

import hashlib
import os
import weakref
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID, uuid4

from .access.native_sqlite_backup import joined_thread, read_private, write_exclusive
from .access.storage_envelope import ACTIVE_IMAGE_MAX_BYTES, encode_envelope
from .storage import AccessStore
from .trusted_actions.validation import Refusal, strict_json

DIRECTORY = "hikvision_intercom.repository_identity"
FORMAT = "wiskey-native-repository-identity.v1"
_ISSUED = weakref.WeakKeyDictionary()


@dataclass(frozen=True)
class _Identity:
    store: weakref.ReferenceType
    directory: Path
    document: bytes
    repository_id: str


def _read(directory):
    from .access.native_sqlite_backup import private_directory

    private_directory(directory, create=False)
    raw = read_private(directory / "identity.json", limit=16384)
    value = strict_json(raw, limit=16384)
    if (
        type(value) is not dict
        or set(value) != {"format", "repository_id", "store_key", "source_schema", "backup_sha256"}
        or value["format"] != FORMAT
        or value["store_key"] != "hikvision_intercom.users"
        or type(value["source_schema"]) is not int
        or value["source_schema"] != 16
        or type(value["repository_id"]) is not str
    ):
        raise Refusal("repository_identity_invalid")
    try:
        if str(UUID(value["repository_id"])) != value["repository_id"]:
            raise ValueError
    except (ValueError, AttributeError):
        raise Refusal("repository_identity_invalid") from None
    backup = read_private(directory / "legacy-before-identity.json")
    if hashlib.sha256(backup).hexdigest() != value["backup_sha256"]:
        raise Refusal("repository_identity_backup_changed")
    return raw, value["repository_id"]


def _produce(root, image):
    from .access.native_sqlite_backup import private_directory
    from .relay_export_contract import canonical_json

    base = Path(root) / ".storage"
    directory = base / DIRECTORY
    if os.path.lexists(directory):
        return _read(directory)
    # A missing identity must not be regenerated over an existing durable owner.
    for name in (
        "hikvision_intercom.ecc",
        "hikvision_intercom.native_recovery",
        "hikvision_intercom.relay_export",
        "hikvision_intercom.feature_effects",
        "hikvision_intercom.automatic_installation",
        "hikvision_intercom.arx_installation",
        "hikvision_intercom.native_service_write_intents_v1",
        "hikvision_intercom.template_jobs_v1",
    ):
        if os.path.lexists(base / name):
            raise Refusal("repository_identity_existing_state_unbound")
    if type(image) is not dict or image.get("schema") != 16:
        raise Refusal("repository_identity_legacy_schema_required")
    # Exclusive directory creation prevents two producers choosing identities.
    # A failed/partial creation remains visible and is never silently replaced.
    private_directory(directory, create=True)
    backup = encode_envelope(
        image,
        key="hikvision_intercom.users",
        version=1,
        minor_version=1,
        limit=ACTIVE_IMAGE_MAX_BYTES,
        canonical=True,
    )
    write_exclusive(directory / "legacy-before-identity.json", backup)
    value = {
        "format": FORMAT,
        "repository_id": str(uuid4()),
        "store_key": "hikvision_intercom.users",
        "source_schema": 16,
        "backup_sha256": hashlib.sha256(backup.encode()).hexdigest(),
    }
    write_exclusive(directory / "identity.json", canonical_json(value).decode())
    return _read(directory)


async def initialize(hass, repository, store):
    """Called only by original repository-open/authorized managed migration."""
    if (
        type(store) is not AccessStore
        or store.hass is not hass
        or store.key != "hikvision_intercom.users"
        or getattr(repository._save, "__self__", None) is not store
        or getattr(repository._save, "__func__", None) is not AccessStore.async_save
    ):
        raise Refusal("repository_identity_source_changed")
    raw, identity = await joined_thread(_produce, hass.config.config_dir, repository.snapshot())
    directory = Path(hass.config.config_dir) / ".storage" / DIRECTORY
    _ISSUED[repository] = _Identity(weakref.ref(store), directory, raw, identity)
    return identity


def cached(hass, repository):
    """HELLO's existing nullable UUID field, from original lifecycle issuance.

    No I/O in the synchronous transport identity. Every source/maintenance
    request still calls resolve() and revalidates the private durable bytes.
    An identity fact does not install a peer registry or grant write authority.
    """
    issued = _ISSUED.get(repository)
    store = issued.store() if issued else None
    if (
        type(store) is not AccessStore
        or store.hass is not hass
        or getattr(repository._save, "__self__", None) is not store
        or getattr(repository._save, "__func__", None) is not AccessStore.async_save
    ):
        return None
    return issued.repository_id


async def resolve(hass, repository):
    """Read existing original issuance and private bytes; creates nothing."""
    if cached(hass, repository) is None:
        raise Refusal("relay_export_original_uuid_unavailable")
    issued = _ISSUED[repository]
    raw, identity = await joined_thread(_read, issued.directory)
    if raw != issued.document or identity != issued.repository_id:
        raise Refusal("repository_identity_source_changed")
    return identity
