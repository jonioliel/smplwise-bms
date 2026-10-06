"""Android app download offer on the Arx sign-in page (owner request 2026-10-06).

The offer exists only when an administrator saved a download address (`app.android_url`, https only); with no address
nothing is offered. A version label and a SHA-256 are optional and only shown so the person can verify the file. No APK
is bundled or hosted by the add-on. `public_offer` is the ONLY thing the pre-login route returns: url / version / sha256.
"""
from __future__ import annotations

import re
import sqlite3
from typing import Any
from urllib.parse import urlsplit

from ..db import get_setting
from ..errors import ApiError

KEY_URL = "app.android_url"
KEY_VERSION = "app.android_version"
KEY_SHA256 = "app.android_sha256"
DEFAULTS: dict[str, str] = {KEY_URL: "", KEY_VERSION: "", KEY_SHA256: ""}

MAX_URL = 2000
_VERSION_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._+\- ]{0,31}$")
_SHA_RE = re.compile(r"^[0-9a-f]{64}$")


def valid_url(raw: Any) -> str | None:
    """The address when it is a plain https URL (a host, no credentials, no whitespace or control characters), else None."""
    if not isinstance(raw, str):
        return None
    value = raw.strip()
    if not value or len(value) > MAX_URL or any(c.isspace() or ord(c) < 32 or ord(c) == 127 for c in value) or "\\" in value:
        return None
    try:
        parts = urlsplit(value)
        host = parts.hostname
        parts.port  # noqa: B018 - raises ValueError on a bad port
    except ValueError:
        return None
    if parts.scheme != "https" or not host or parts.username is not None or parts.password is not None:
        return None
    return value


def normalize(changes: dict[str, Any]) -> None:
    """Validate and normalise the `app.android_*` keys of a settings patch in place (422 with a Hebrew message)."""
    if KEY_URL in changes:
        raw = changes[KEY_URL]
        if (raw or "").strip():
            ok = valid_url(raw)
            if ok is None:
                raise ApiError(422, "validation", "כתובת ההורדה חייבת להיות כתובת https תקינה.", details={KEY_URL: "https_url_required"})
            changes[KEY_URL] = ok
        else:
            changes[KEY_URL] = ""
    if KEY_VERSION in changes:
        value = (changes[KEY_VERSION] or "").strip()
        if value and not _VERSION_RE.fullmatch(value):
            raise ApiError(422, "validation", "תווית הגרסה: עד 32 תווים (אותיות, ספרות, נקודה, מקף).", details={KEY_VERSION: "invalid"})
        changes[KEY_VERSION] = value
    if KEY_SHA256 in changes:
        value = (changes[KEY_SHA256] or "").strip().lower()
        if value and not _SHA_RE.fullmatch(value):
            raise ApiError(422, "validation", "SHA-256: 64 תווים הקסדצימליים.", details={KEY_SHA256: "invalid"})
        changes[KEY_SHA256] = value


def public_offer(conn: sqlite3.Connection) -> dict[str, Any]:
    """What the pre-login page may know: `{"android": {"url", "version", "sha256"}}` or `{"android": None}`. Values are
    re-validated on read, so a corrupt stored row offers nothing."""
    url = valid_url(get_setting(conn, KEY_URL, "") or "")
    if url is None:
        return {"android": None}
    version = (get_setting(conn, KEY_VERSION, "") or "").strip()
    sha = (get_setting(conn, KEY_SHA256, "") or "").strip().lower()
    return {"android": {
        "url": url,
        "version": version if _VERSION_RE.fullmatch(version) else "",
        "sha256": sha if _SHA_RE.fullmatch(sha) else "",
    }}
