"""Which go2rtc video services run on this installation, and which one Arx uses (HEALTH-GO2RTC-FOLLOWUP-2431).

Owner answers of 11.11 (docs/changes/HEALTH-GO2RTC-FOLLOWUP-2431.md): Arx detects the go2rtc services that run next to it and lets the
administrator choose between them; and the administrators' "video service unavailable" notice waits an administrator-chosen delay.

Discovery (read only, through the add-on's single infrastructure door services/self_update.py):
- `GET /addons` lists the installed add-ons; a candidate is one whose slug or name says go2rtc (`is_go2rtc`). At most MAX_CANDIDATES.
- `GET /addons/{slug}/info` of each candidate (only those slugs - self_update refuses any other): state (started / stopped / ...),
  version, image (a second go2rtc mark) and the internal hostname. The address Arx would use is `http://<hostname>:1984` (go2rtc's API
  port inside its container); the hostname must look like an internal add-on hostname (HOSTNAME_RE), never an IP or a dotted name.
- each started candidate's `GET /api` is probed once, in parallel, with PROBE_TIMEOUT_S: any HTTP answer = it answers (401 / 403 =
  `auth_required`), a connection failure or a timeout = `unreachable`. No credential is sent (the probed service may not be the one
  the stored go2rtc password belongs to). Nothing else is called: no stream is listed, created, changed or deleted here.
- the answer is cached CACHE_S (the settings card, the player's administrator hint and the notice text read the cache); `fresh`
  bypasses it at most once per FRESH_MIN_GAP_S.

The choice (`select`): only a candidate of a fresh discovery, by slug - never a typed address. Stored as the installation setting
`media.video_service_selection` ({slug, name, url, at, by}); it TAKES PRECEDENCE over the add-on option `go2rtc_url` (and the developer
environment GO2RTC_URL): `apply_at_startup` overlays it once (before the NVR overlay, so every recorder's settings inherit it) and
`apply_live` replaces `app.state.settings` at once, so every request (live, playback, snapshots, the stream sync button) and the
janitor (which now reads the live settings) use it immediately. Background workers that keep their start-up copy (the periodic camera
discovery and stream sync) use it after the next restart of Arx: the answer says `restart_recommended`. `clear` drops the stored
choice and the add-on option applies again. The setting is installation-local: never exported in a project backup, never restored
(services/backup.SETTINGS_KEEP).

Only `smplwise_`-namespace streams are ever written by Arx on whichever service is chosen (services/go2rtc.py); this module writes none.
"""
from __future__ import annotations

import dataclasses
import datetime as dt
import json
import logging
import re
import sqlite3
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any
from urllib.parse import urlsplit

from ..config import Settings
from ..db import get_setting, set_setting
from . import self_update
from .timeutil import iso_utc

log = logging.getLogger("smplwise.video_services")

K_SELECTION = "media.video_service_selection"
K_NOTICE_AFTER = "media.video_notice_after_min"
NOTICE_AFTER_CHOICES = (1, 5, 15, 30, 60)  # minutes (owner 11.11: an administrator setting)
NOTICE_AFTER_DEFAULT_MIN = 15  # owner 11.11, answer 1: 15 minutes (was the system.health policy's 5)

GO2RTC_PORT = 1984
MAX_CANDIDATES = 8
PROBE_TIMEOUT_S = 1.5
INFO_TIMEOUT_S = 4.0
CACHE_S = 20.0
FRESH_MIN_GAP_S = 5.0
HOSTNAME_RE = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?")
URL_RE = re.compile(r"http://[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?:1984")
NAME_MAX = 80
VERSION_RE = re.compile(r"[0-9A-Za-z._+-]{1,40}")
STATES = ("started", "stopped", "startup", "error", "unknown")

_lock = threading.Lock()
_cache: dict[str, Any] = {"at": 0.0, "view": None, "fresh_at": 0.0}
PROBE: Any = None  # tests: a stand-in for _probe(url) -> (outcome, version)


def reset_for_tests() -> None:
    with _lock:
        _cache.update(at=0.0, view=None, fresh_at=0.0)
    self_update.remember_video_addons([])


# ---------------------------------------------------------------- the notice delay

def notice_after_min(conn: sqlite3.Connection) -> int:
    """The administrator's delay before the "video service unavailable" notice, in minutes (a corrupt row reads as the default)."""
    try:
        v = int(get_setting(conn, K_NOTICE_AFTER, str(NOTICE_AFTER_DEFAULT_MIN)) or NOTICE_AFTER_DEFAULT_MIN)
    except (TypeError, ValueError):
        return NOTICE_AFTER_DEFAULT_MIN
    return v if v in NOTICE_AFTER_CHOICES else NOTICE_AFTER_DEFAULT_MIN


# ---------------------------------------------------------------- the stored choice

def _clean_name(value: Any) -> str:
    text = re.sub(r"[\x00-\x1f\x7f]", "", str(value or "")).strip()
    return text[:NAME_MAX]


def selection(conn: sqlite3.Connection) -> dict[str, Any] | None:
    """The stored choice, or None (no row, or a row that is not a valid choice - then the add-on option applies)."""
    raw = get_setting(conn, K_SELECTION)
    if not raw:
        return None
    try:
        d = json.loads(raw)
    except ValueError:
        return None
    if not isinstance(d, dict) or not isinstance(d.get("url"), str) or not URL_RE.fullmatch(d["url"]):
        return None
    if not isinstance(d.get("slug"), str) or not self_update.SLUG_RE.fullmatch(d["slug"]):
        return None
    return {"slug": d["slug"], "name": _clean_name(d.get("name")), "url": d["url"], "at": d.get("at"), "by": _clean_name(d.get("by")) or None}


def _store(conn: sqlite3.Connection, cand: dict[str, Any], by: str | None) -> dict[str, Any]:
    row = {"slug": cand["slug"], "name": cand["name"], "url": cand["url"], "at": iso_utc(dt.datetime.now(dt.timezone.utc)), "by": by}
    set_setting(conn, K_SELECTION, json.dumps(row, ensure_ascii=False, separators=(",", ":")))
    return row


def clear(conn: sqlite3.Connection) -> bool:
    had = selection(conn) is not None or bool(get_setting(conn, K_SELECTION))
    set_setting(conn, K_SELECTION, "")
    return had


def _with_url(settings: Settings, url: str | None) -> Settings:
    out = dataclasses.replace(settings, go2rtc_url=url)
    children = settings.recorder_settings if isinstance(settings.recorder_settings, dict) else {}
    if children:  # CR-024: the further recorders' settings are copies of the primary's (go2rtc included)
        out = dataclasses.replace(out, recorder_settings={rid: dataclasses.replace(c, go2rtc_url=url) for rid, c in children.items()})
    return out


def apply_at_startup(db: Any, settings: Settings) -> tuple[Settings, str | None]:
    """Overlay the stored choice once at start-up. Returns (effective settings, the add-on option / environment URL it replaced)."""
    option_url = settings.go2rtc_url
    try:
        with db.connection(mode="read", label="video service selection") as conn:
            sel = selection(conn)
    except Exception:  # noqa: BLE001 - an unreadable row leaves the add-on option in force
        log.warning("video service selection unreadable; the add-on option applies", exc_info=True)
        return settings, option_url
    if sel is None:
        return settings, option_url
    log.info("video service: the administrator's choice applies (it takes precedence over the add-on option)")
    return _with_url(settings, sel["url"]), option_url


def option_url(app: Any) -> str | None:
    return getattr(app.state, "go2rtc_option_url", None)


def apply_live(app: Any, url: str | None) -> None:
    """Requests (and the janitor) see the new address at once; the reachability state starts over for it."""
    from . import media_reach

    app.state.settings = _with_url(app.state.settings, url)
    media_reach.REACH.reset()
    with _lock:
        _cache.update(at=0.0, view=None)


# ---------------------------------------------------------------- discovery

def is_go2rtc(item: dict[str, Any]) -> bool:
    text = " ".join(str(item.get(k) or "") for k in ("slug", "name", "image")).lower()
    return "go2rtc" in text


def hostname_of(slug: str, info: dict[str, Any]) -> str | None:
    """The add-on's hostname on the internal network: the Supervisor's `hostname`, else its rule (slug, `_` -> `-`)."""
    for value in (info.get("hostname"), slug.replace("_", "-")):
        if isinstance(value, str) and HOSTNAME_RE.fullmatch(value):
            return value
    return None


def _probe(url: str) -> tuple[str, str | None]:
    """One GET {url}/api: (ok | auth_required | unreachable | error, go2rtc version or None). Never raises; no credential."""
    if PROBE is not None:
        return PROBE(url)
    import httpx

    try:
        with httpx.Client(timeout=PROBE_TIMEOUT_S, follow_redirects=False) as client:
            r = client.get(url + "/api")
    except httpx.HTTPError:
        return "unreachable", None
    if r.status_code in (401, 403):
        return "auth_required", None
    if not 200 <= r.status_code < 300:
        return "error", None
    try:
        version = (r.json() or {}).get("version")
    except ValueError:
        version = None
    return "ok", (version if isinstance(version, str) and VERSION_RE.fullmatch(version) else None)


def _norm(url: str | None) -> str | None:
    """`scheme://host:port` of an address, lower case, without any user info or path (never shown with a password)."""
    if not url:
        return None
    try:
        parts = urlsplit(url.strip())
        host = (parts.hostname or "").lower()
        port = parts.port
    except ValueError:
        return None
    if not host:
        return None
    if port is None:
        port = 443 if parts.scheme == "https" else 80
    return f"{(parts.scheme or 'http').lower()}://{host}:{port}"


def display_address(url: str | None) -> str | None:
    """host:port only - what the administrator sees of the address in use."""
    n = _norm(url)
    return n.split("://", 1)[1] if n else None


def _discover(settings: Settings) -> dict[str, Any]:
    if not self_update.configured(settings):
        return {"supported": False, "reason": "no_supervisor", "candidates": []}
    listing = self_update.call(settings, "GET", self_update.P_ADDONS, timeout=INFO_TIMEOUT_S)
    if listing.kind != "ok":
        return {"supported": False, "reason": "forbidden" if listing.kind == "forbidden" else "unreachable", "candidates": []}
    addons = (listing.data or {}).get("addons")
    items = [a for a in addons if isinstance(a, dict)] if isinstance(addons, list) else []
    found = [a for a in items if is_go2rtc(a) and isinstance(a.get("slug"), str) and self_update.SLUG_RE.fullmatch(a["slug"])][:MAX_CANDIDATES]
    self_update.remember_video_addons([a["slug"] for a in found])
    candidates: list[dict[str, Any]] = []
    for a in found:
        slug = a["slug"]
        if slug == self_update._SELF_SLUG:
            continue
        info_reply = self_update.call(settings, "GET", self_update.P_ADDON_INFO, addon=slug, timeout=INFO_TIMEOUT_S)
        info = (info_reply.data or {}) if info_reply.kind == "ok" else {}
        host = hostname_of(slug, info)
        state = str(info.get("state") or a.get("state") or "unknown")
        version = str(info.get("version") or a.get("version") or "")
        candidates.append({
            "slug": slug,
            "name": _clean_name(info.get("name") or a.get("name") or slug) or slug,
            "state": state if state in STATES else "unknown",
            "version": version if VERSION_RE.fullmatch(version) else None,
            "image_go2rtc": "go2rtc" in str(info.get("image") or "").lower(),
            "url": f"http://{host}:{GO2RTC_PORT}" if host else None,
            "address": f"{host}:{GO2RTC_PORT}" if host else None,
            "probe": "not_probed",
            "go2rtc_version": None,
        })
    todo = [c for c in candidates if c["url"] and c["state"] == "started"]
    if todo:
        with ThreadPoolExecutor(max_workers=min(4, len(todo)), thread_name_prefix="video-probe") as pool:
            for c, (outcome, gv) in zip(todo, pool.map(lambda c: _probe(c["url"]), todo)):
                c["probe"], c["go2rtc_version"] = outcome, gv
    return {"supported": True, "reason": None, "candidates": candidates}


def discover(settings: Settings, fresh: bool = False) -> dict[str, Any]:
    """The cached discovery (CACHE_S); `fresh` re-runs it unless one ran in the last FRESH_MIN_GAP_S. Network calls: never under a DB connection."""
    now = time.monotonic()
    with _lock:
        view = _cache["view"]
        if view is not None and (now - _cache["at"] < CACHE_S) and not (fresh and now - _cache["fresh_at"] >= FRESH_MIN_GAP_S):
            return view
    view = _discover(settings)
    view["checked_at"] = iso_utc(dt.datetime.now(dt.timezone.utc))
    with _lock:
        _cache.update(at=time.monotonic(), view=view)
        if fresh:
            _cache["fresh_at"] = time.monotonic()
    return view


def cached(max_age_s: float = 600.0) -> dict[str, Any] | None:
    """The last discovery if not older than `max_age_s` (no network) - the notice text reads this."""
    with _lock:
        view = _cache["view"]
        return view if view is not None and time.monotonic() - _cache["at"] < max_age_s else None


def view(settings: Settings, sel: dict[str, Any] | None, option: str | None, fresh: bool = False) -> dict[str, Any]:
    """The administrator's page: what is in use (from where), the stored choice and every candidate (`current` marks the one in use)."""
    from . import media_reach

    found = discover(settings, fresh)
    in_use = _norm(settings.go2rtc_url)
    cands = [{k: v for k, v in c.items() if k != "url"} | {"current": bool(c["url"]) and _norm(c["url"]) == in_use} for c in found["candidates"]]
    source = "selection" if sel and _norm(sel["url"]) == in_use else ("option" if settings.go2rtc_url else "none")
    return {
        "supported": found["supported"], "reason": found["reason"], "checked_at": found.get("checked_at"),
        "current": {"source": source, "address": display_address(settings.go2rtc_url), "state": media_reach.REACH.view(settings)["state"],
                    "slug": next((c["slug"] for c in cands if c["current"]), None)},
        "option_address": display_address(option),
        "selection": ({k: sel[k] for k in ("slug", "name", "at", "by")} | {"address": display_address(sel["url"])}) if sel else None,
        "candidates": cands,
        "restart_recommended": False,
    }


def find(settings: Settings, slug: str) -> dict[str, Any] | None:
    """A candidate of a FRESH discovery by slug (the only way an address is chosen)."""
    for c in discover(settings, fresh=True)["candidates"]:
        if c["slug"] == slug and c["url"] and URL_RE.fullmatch(c["url"]):
            return c
    return None


def remember(conn: sqlite3.Connection, cand: dict[str, Any], by: str | None) -> dict[str, Any]:
    return _store(conn, cand, by)


def notice_suffix() -> str:
    """The candidates in the administrators' notice text (from the cache only; empty when nothing is known)."""
    found = cached()
    if not found or not found.get("candidates"):
        return ""
    label = {"started": "פועל", "stopped": "כבוי"}
    parts = [f"{c['name']} ({label.get(c['state'], 'מצב לא ידוע')})" for c in found["candidates"][:4]]
    return " · שירותי וידאו שנמצאו: " + ", ".join(parts) + " — אפשר לבחור בהגדרות › וידאו ומדיה › שירות וידאו"
