"""CR-021 S3: why the platform core should be restarted ("נדרשת הפעלה מחדש של תשתית המערכת"), from one registry.

Reasons (never a trigger: the restart is always a separate, confirmed action of a `system.update` holder - owner decision D6):

* `bridge`  - computed live: the bridge integration was copied into `custom_components` but the platform still runs another (or no)
              version (`bridge_install.status()` state `update_pending` / `installed_pending`).
* `wiskey`  - added by the WisKey installer after it copied a release whose `release-manifest.json` says `requires_ha_restart: true`
              (`note_component_manifest`); the WisKey fold-in installer is not written yet - it must call this instead of building its
              own restart button (S3 design section 12).
* `release` - added when the running Arx release is flagged `[platform-restart]` in its notes (D8; the notes feed is slice S4 -
              `add_reason(conn, "release", version)` is the hook it calls).

The stored reasons are `settings` rows `platform_restart.reason.<code>` = `{"version", "at"}` (no migration). They are cleared by a
platform restart run that SUCCEEDED and started after the reason was added (`clear_after_restart`). Assumption to confirm in the lab:
WisKey's contract version read after the restart (a WebSocket command of the WisKey brief) is not available yet, so a successful restart
is taken as "loaded"."""
from __future__ import annotations

import json
import re
import sqlite3
from typing import Any

from ..db import get_setting, now_iso, set_setting

STORED = ("wiskey", "release")
CODES = ("bridge",) + STORED
PREFIX = "platform_restart.reason."
VERSION_RE = re.compile(r"[0-9A-Za-z._+-]{1,40}")
BRIDGE_STATES = ("update_pending", "installed_pending")


def add_reason(conn: sqlite3.Connection, code: str, version: str) -> None:
    if code not in STORED:
        raise ValueError(f"unknown platform restart reason {code!r}")
    if not isinstance(version, str) or not VERSION_RE.fullmatch(version):
        raise ValueError("version")
    set_setting(conn, PREFIX + code, json.dumps({"version": version, "at": now_iso()}))


def clear_reason(conn: sqlite3.Connection, code: str) -> None:
    conn.execute("DELETE FROM settings WHERE key = ?", (PREFIX + code,))


def note_component_manifest(conn: sqlite3.Connection, code: str, manifest: Any) -> bool:
    """For an installer that just copied a component release: `requires_ha_restart: true` (the JSON literal) adds the reason.
    Anything else (absent, false, a string) adds nothing. Returns whether a reason was added."""
    if not isinstance(manifest, dict) or manifest.get("requires_ha_restart") is not True:
        return False
    version = manifest.get("version")
    add_reason(conn, code, version if isinstance(version, str) and VERSION_RE.fullmatch(version) else "unknown")
    return True


def _stored(conn: sqlite3.Connection, code: str) -> dict[str, Any] | None:
    raw = get_setting(conn, PREFIX + code)
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


def reasons(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """`[{code, version}]`, codes only - no path, host or file name."""
    from . import bridge_install

    out: list[dict[str, Any]] = []
    try:
        st = bridge_install.status(conn=conn)
    except Exception:  # noqa: BLE001 - a status that cannot be read is no reason
        st = {}
    if st.get("state") in BRIDGE_STATES:
        out.append({"code": "bridge", "version": st.get("installed_version")})
    for code in STORED:
        data = _stored(conn, code)
        if data is not None:
            out.append({"code": code, "version": data.get("version")})
    return out


def clear_after_restart(conn: sqlite3.Connection, restart_started_at: str) -> list[str]:
    """A platform restart that started at `restart_started_at` succeeded: every stored reason added before it is satisfied."""
    cleared = []
    for code in STORED:
        data = _stored(conn, code)
        if data is not None and str(data.get("at") or "") <= restart_started_at:
            clear_reason(conn, code)
            cleared.append(code)
    return cleared
