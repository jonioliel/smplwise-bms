"""Deliver the SMPLWISE Bridge custom integration from the add-on into Home Assistant (ADR-012).

The add-on image ships the integration (`/app/integration/smplwise_bridge`). With the `homeassistant_config`
mapping the add-on copies it to `<ha config>/custom_components/smplwise_bridge` when it is missing or
outdated, then announces itself through the Supervisor discovery API so Home Assistant offers
"SMPLWISE Bridge" with the pairing code already filled in. Nothing else in the config directory is
touched; the owner still restarts Home Assistant after a fresh copy (custom components load at start)
and confirms the discovered integration. Without the mapping (or outside the add-on) the status says so
and the manual path (copy + pairing code) remains.
"""
from __future__ import annotations

import json
import logging
import os
import shutil
import socket
import sqlite3
import threading
from pathlib import Path
from typing import Any

from ..config import Settings
from ..db import Database, get_setting, now_iso
from ..errors import ApiError
from . import ha_bridge, ha_client

log = logging.getLogger("smplwise.bridge")

DOMAIN = "smplwise_bridge"
MARKER = ".smplwise_installed.json"
ADDON_PORT = 8099

STATE: dict[str, Any] = {
    "source_version": None,
    "config_dir": None,
    "installed_version": None,
    "installed_at": None,
    "installed_now": False,
    "last_run": None,
    "last_error": None,
    "discovery_posted_at": None,
}
_lock = threading.Lock()


def source_dir() -> Path | None:
    env = os.environ.get("SW_INTEGRATION_SRC")
    candidates = [Path(env)] if env else []
    candidates += [Path("/app/integration") / DOMAIN, Path(__file__).resolve().parents[4] / "custom_components" / DOMAIN]
    for c in candidates:
        if (c / "manifest.json").is_file():
            return c
    return None


def ha_config_dir() -> Path | None:
    """The Home Assistant config directory as mounted in the add-on (`/homeassistant` with the current
    Supervisor mapping, `/config` with the legacy one); SW_HA_CONFIG_DIR overrides for development."""
    env = os.environ.get("SW_HA_CONFIG_DIR")
    candidates = [Path(env)] if env else [Path("/homeassistant"), Path("/config")]
    for c in candidates:
        if c.is_dir() and ((c / "configuration.yaml").is_file() or (c / ".storage").is_dir()):
            return c
    return None


def read_version(d: Path) -> str | None:
    try:
        return json.loads((d / "manifest.json").read_text(encoding="utf-8")).get("version")
    except (OSError, ValueError, AttributeError):
        return None


def _marker(target: Path) -> dict[str, Any]:
    try:
        return json.loads((target / MARKER).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _copy_tree(src: Path, dst: Path) -> int:
    """Fresh copy next to the target, then swap (Home Assistant only reads custom components at start-up)."""
    tmp = dst.with_name(dst.name + ".smplwise-new")
    if tmp.exists():
        shutil.rmtree(tmp)
    shutil.copytree(src, tmp, ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".DS_Store", MARKER))
    if dst.exists():
        old = dst.with_name(dst.name + ".smplwise-old")
        if old.exists():
            shutil.rmtree(old)
        dst.rename(old)
        tmp.rename(dst)
        shutil.rmtree(old, ignore_errors=True)
    else:
        tmp.rename(dst)
    return sum(1 for p in dst.rglob("*") if p.is_file())


def addon_url() -> str:
    """The add-on as Home Assistant Core reaches it: the container hostname inside the Supervisor network."""
    return f"http://{socket.gethostname()}:{ADDON_PORT}"


def announce_discovery(db: Database, settings: Settings, conn: sqlite3.Connection | None = None) -> bool:
    """Tell the Supervisor that the bridge service is available (Home Assistant shows it as discovered)."""
    if not ha_client.supervisor_token():
        return False
    if conn is not None:
        ha_bridge.ensure_pairing(conn, False)
        secret = ha_bridge.signing_key(conn)
    else:
        with db.connection() as c:
            ha_bridge.ensure_pairing(c, False)
            secret = ha_bridge.signing_key(c)
    try:
        ha_client.post_discovery(settings, DOMAIN, {"addon_url": addon_url(), "pairing_code": secret})
    except ApiError as exc:
        STATE["last_error"] = f"discovery:{exc.code}"
        log.warning("bridge discovery announcement failed: %s", exc.code)
        return False
    STATE["discovery_posted_at"] = now_iso()
    return True


def install(db: Database, settings: Settings, force: bool = False, announce: bool = True, conn: sqlite3.Connection | None = None) -> dict[str, Any]:
    """Copy the integration into Home Assistant's config directory when missing/outdated (or forced).
    `conn` is the request transaction when called from a handler (a nested connection would wait on it)."""
    with _lock:
        STATE["last_run"] = now_iso()
        STATE["last_error"] = None
        STATE["installed_now"] = False
        STATE["discovery_posted_at"] = None
        src = source_dir()
        cfg = ha_config_dir()
        STATE["source_version"] = read_version(src) if src else None
        STATE["config_dir"] = str(cfg) if cfg else None
        if not src:
            STATE["last_error"] = "source_missing"
            return status(db, conn)
        if not cfg:
            STATE["last_error"] = "ha_config_not_mapped"
            return status(db, conn)
        target = cfg / "custom_components" / DOMAIN
        installed = read_version(target) if target.is_dir() else None
        STATE["installed_version"] = installed
        STATE["installed_at"] = _marker(target).get("at") if installed else None
        try:
            if force or installed != STATE["source_version"]:
                (cfg / "custom_components").mkdir(exist_ok=True)
                n = _copy_tree(src, target)
                at = now_iso()
                (target / MARKER).write_text(json.dumps({"version": STATE["source_version"], "at": at, "files": n}), encoding="utf-8")
                STATE.update(installed_version=STATE["source_version"], installed_at=at, installed_now=True)
                log.info("bridge integration %s copied into Home Assistant's custom_components (%d files); restart Home Assistant to load it", STATE["source_version"], n)
        except OSError as exc:
            STATE["last_error"] = f"copy_failed:{type(exc).__name__}"
            log.warning("bridge integration copy failed: %s", type(exc).__name__)
            return status(db, conn)
        if announce:
            announce_discovery(db, settings, conn)
        return status(db, conn)


def run_startup(db: Database, settings: Settings) -> None:
    """Start-up hook: never raises; a missing mapping simply leaves the status at not_available."""
    try:
        st = install(db, settings, force=False, announce=True)
        if st["state"] == "not_available":
            log.info("bridge integration not delivered automatically (%s); manual install remains possible", st["last_error"])
    except Exception as exc:  # noqa: BLE001 - start-up must not fail because of the integration copy
        STATE["last_error"] = type(exc).__name__
        log.warning("bridge install at start-up failed: %s", type(exc).__name__)


def _state(d: dict[str, Any]) -> str:
    if d["last_error"] in ("source_missing", "ha_config_not_mapped") or not d["config_dir"]:
        return "not_available"
    if d["last_error"] and str(d["last_error"]).startswith("copy_failed"):
        return "error"
    if not d["installed_version"]:
        return "not_installed"
    if d["active_version"] == d["installed_version"]:
        return "active"
    if d["active_version"]:
        return "update_pending"
    return "installed_pending"


def status(db: Database | None = None, conn: sqlite3.Connection | None = None) -> dict[str, Any]:
    d = dict(STATE)
    active = None
    try:
        if conn is not None:
            active = get_setting(conn, "bridge.integration_version") or None
        elif db is not None:
            with db.connection() as c:
                active = get_setting(c, "bridge.integration_version") or None
    except sqlite3.OperationalError:
        active = None
    d["active_version"] = active
    d["up_to_date"] = bool(d["source_version"]) and d["installed_version"] == d["source_version"]
    d["state"] = _state(d)
    d["addon_url"] = addon_url()
    return d
