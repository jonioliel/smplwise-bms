"""Android app download offer on the Arx sign-in page (owner request 2026-10-06; bundled file, owner decision 2026-10-06).

Two sources, in this order:
1. an address an administrator saved (`app.android_url`, https only; optional version label and SHA-256) - the override;
2. the signed release APK that ships INSIDE the add-on image (`<downloads_dir>/SmplWiseArx.apk` + the sidecar
   `SmplWiseArx.apk.json`), served from the public route `auth/app-download/file`. Its SHA-256 and size are computed here
   (never trusted from a label); the sidecar carries the version and the application id and is validated on every read.
With neither, nothing is offered. `public_offer` is the ONLY thing the pre-login route returns: url / version / sha256 (+ size
and `bundled` for the local file). The APK is never committed to git; the release process places it in the build context.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import sqlite3
import stat
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from ..db import get_setting
from ..errors import ApiError

KEY_URL = "app.android_url"
KEY_VERSION = "app.android_version"
KEY_SHA256 = "app.android_sha256"
DEFAULTS: dict[str, str] = {KEY_URL: "", KEY_VERSION: "", KEY_SHA256: ""}

APK_NAME = "SmplWiseArx.apk"
SIDECAR_NAME = APK_NAME + ".json"
APPLICATION_ID = "com.smplwise.arx.app"
BUNDLED_URL = "api/v1/auth/app-download/file"  # relative to the Arx page (<remote_path>/), so it works behind any tunnel host
MAX_APK_BYTES = 200 * 1024 * 1024  # size sanity cap: anything larger is not offered
MAX_SIDECAR_BYTES = 4096
MIME = "application/vnd.android.package-archive"
log = logging.getLogger("smplwise.app_download")

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


@dataclass(frozen=True)
class Bundled:
    path: Path
    version: str
    sha256: str
    size: int

    @property
    def etag(self) -> str:
        return f'"{self.sha256}"'

    @property
    def filename(self) -> str:
        return f"SmplWiseArx-{self.version.replace(' ', '_')}.apk"


_cache_lock = threading.Lock()
_cache: dict[str, tuple[tuple, Bundled | None]] = {}


def _regular_file(path: Path, root: Path) -> os.stat_result | None:
    """The stat of `path` when it is a regular file (no symlink) directly inside `root`, else None."""
    try:
        if path.is_symlink() or path.parent.resolve() != root.resolve():
            return None
        st = os.stat(path)
    except OSError:
        return None
    return st if stat.S_ISREG(st.st_mode) else None


def _sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _validate(apk: Path, side: Path, apk_size: int, side_size: int) -> Bundled | None:
    if not 0 < apk_size <= MAX_APK_BYTES or not 0 < side_size <= MAX_SIDECAR_BYTES:
        log.warning("bundled APK refused: size out of range")
        return None
    try:
        meta = json.loads(side.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        log.warning("bundled APK refused: sidecar unreadable")
        return None
    if not isinstance(meta, dict) or meta.get("applicationId") != APPLICATION_ID:
        log.warning("bundled APK refused: sidecar applicationId mismatch")
        return None
    version = meta.get("version")
    if not isinstance(version, str) or not _VERSION_RE.fullmatch(version.strip()):
        log.warning("bundled APK refused: sidecar version invalid")
        return None
    try:
        digest = _sha256_of(apk)
    except OSError:
        return None
    declared = meta.get("sha256")  # optional: when the release process recorded one, it must match the file
    if declared is not None and (not isinstance(declared, str) or declared.strip().lower() != digest):
        log.warning("bundled APK refused: sidecar sha256 does not match the file")
        return None
    return Bundled(path=apk, version=version.strip(), sha256=digest, size=apk_size)


def load_bundled(downloads_dir: Path | None) -> Bundled | None:
    """The validated bundled APK, or None (absent, too large, sidecar missing / malformed / for another application id, a
    sidecar hash that does not match the file). Hash and size are computed once per (mtime, size) of the two files."""
    if downloads_dir is None:
        return None
    apk, side = downloads_dir / APK_NAME, downloads_dir / SIDECAR_NAME
    st_a, st_s = _regular_file(apk, downloads_dir), _regular_file(side, downloads_dir)
    if st_a is None or st_s is None:
        return None
    key = (st_a.st_mtime_ns, st_a.st_size, st_s.st_mtime_ns, st_s.st_size)
    with _cache_lock:
        hit = _cache.get(str(apk))
        if hit and hit[0] == key:
            return hit[1]
    result = _validate(apk, side, st_a.st_size, st_s.st_size)
    with _cache_lock:
        _cache[str(apk)] = (key, result)
    return result


def reset_cache_for_tests() -> None:
    with _cache_lock:
        _cache.clear()


def public_offer(conn: sqlite3.Connection, downloads_dir: Path | None = None) -> dict[str, Any]:
    """What the pre-login page may know: `{"android": {"url", "version", "sha256"[, "size", "bundled"]}}` or `{"android": None}`.
    An administrator's https address wins; otherwise the bundled file. Values are re-validated on read, so a corrupt
    stored row offers nothing (and falls back to the bundled file when there is one)."""
    url = valid_url(get_setting(conn, KEY_URL, "") or "")
    if url is None:
        b = load_bundled(downloads_dir)
        if b is None:
            return {"android": None}
        return {"android": {"url": BUNDLED_URL, "version": b.version, "sha256": b.sha256, "size": b.size, "bundled": True}}
    version = (get_setting(conn, KEY_VERSION, "") or "").strip()
    sha = (get_setting(conn, KEY_SHA256, "") or "").strip().lower()
    return {"android": {
        "url": url,
        "version": version if _VERSION_RE.fullmatch(version) else "",
        "sha256": sha if _SHA_RE.fullmatch(sha) else "",
    }}
