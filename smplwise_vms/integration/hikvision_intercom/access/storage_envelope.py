"""One bounded HA Store image, including all native metadata/assets/history."""

from __future__ import annotations

import json
from collections.abc import Iterable
from typing import Any, Literal, overload

from .models import AccessError

ACTIVE_IMAGE_MAX_BYTES = 32 * 1024**2
USERS_STORAGE_KEY = "hikvision_intercom.users"
ENVELOPE_FORMAT = "wiskey-ha-store-canonical.v1"


def _chunks(
    data: Any, *, key: str, version: int, minor_version: int, canonical: bool,
) -> Iterable[str]:
    envelope = {"version": version, "minor_version": minor_version, "key": key, "data": data}
    encoder = json.JSONEncoder(
        ensure_ascii=False,
        allow_nan=False,
        sort_keys=canonical,
        separators=(",", ":") if canonical else None,
    )
    return encoder.iterencode(envelope)


@overload
def measure_envelope(
    data: Any, *, key: str = USERS_STORAGE_KEY, version: int = 1, minor_version: int = 1,
    limit: int = ACTIVE_IMAGE_MAX_BYTES, canonical: bool = True, collect: Literal[True],
) -> tuple[int, str]: ...


@overload
def measure_envelope(
    data: Any, *, key: str = USERS_STORAGE_KEY, version: int = 1, minor_version: int = 1,
    limit: int = ACTIVE_IMAGE_MAX_BYTES, canonical: bool = True, collect: bool = False,
) -> tuple[int, str | None]: ...


def measure_envelope(
    data: Any, *, key: str = USERS_STORAGE_KEY, version: int = 1, minor_version: int = 1,
    limit: int = ACTIVE_IMAGE_MAX_BYTES, canonical: bool = True, collect: bool = False,
) -> tuple[int, str | None]:
    """Stop at the exact UTF-8 boundary; no asset/history exclusion or truncation.

    Generic legacy AccessStore retains its original JSON value semantics; the
    explicit native SQLite profile validates its exact built-in forest FIRST.
    """
    if type(limit) is not int or not 1 <= limit <= ACTIVE_IMAGE_MAX_BYTES:
        raise ValueError("active image budget cannot exceed32MiB")
    if type(collect) is not bool or type(canonical) is not bool:
        raise ValueError("explicit bounded envelope selection required")
    total, chunks = 0, []
    try:
        for chunk in _chunks(
            data, key=key, version=version, minor_version=minor_version, canonical=canonical,
        ):
            total += len(chunk.encode("utf-8"))
            if total > limit:
                raise AccessError("storage_image_capacity")
            if collect:
                chunks.append(chunk)
    except (TypeError, ValueError, RecursionError, UnicodeError):
        raise AccessError("invalid_storage") from None
    return total, "".join(chunks) if collect else None


def encode_envelope(
    data: Any, *, key: str, version: int, minor_version: int, limit: int, canonical: bool = False,
) -> str:
    return measure_envelope(
        data, key=key, version=version, minor_version=minor_version,
        limit=limit, canonical=canonical, collect=True,
    )[1]
