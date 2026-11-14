"""XSCENARIO109-295 (CR-SCENARIO109 sections 9 and 17.4): the `scenarios.*` settings. Every threshold, window, cap and recipient of the
module is a setting (the owner's standing rule), edited by `scenario.admin` through PUT /scenarios/settings (confirmed, audited).

Default OFF: the module switch, the kill switch's opposite and every per-action switch start false."""
from __future__ import annotations

import json
import re
import sqlite3
from typing import Any, Callable

from ..audit import audit
from ..db import get_setting, set_setting
from ..errors import ApiError
from ..rbac import Principal
from .scenario_model import HHMM_RE

_BOOL = ("true", "false")
_ID = re.compile(r"^[A-Za-z0-9_.:\-]{1,120}$")


def _bool(v: Any) -> str | None:
    return v if v in _BOOL else None


def _int(lo: int, hi: int) -> Callable[[Any], str | None]:
    def f(v: Any) -> str | None:
        if isinstance(v, bool):
            return None
        try:
            n = int(v)
        except (TypeError, ValueError):
            return None
        return str(n) if lo <= n <= hi and str(v).strip().lstrip("-").isdigit() else None
    return f


def _enum(*values: str) -> Callable[[Any], str | None]:
    return lambda v: v if v in values else None


def _window(v: Any) -> str | None:
    if isinstance(v, str):
        try:
            v = json.loads(v)
        except ValueError:
            return None
    ok = isinstance(v, dict) and set(v) == {"days", "from", "to"} and isinstance(v["days"], list) and 0 < len(v["days"]) <= 7 \
        and all(isinstance(d, int) and not isinstance(d, bool) and 0 <= d <= 6 for d in v["days"]) and len(set(v["days"])) == len(v["days"]) \
        and isinstance(v["from"], str) and HHMM_RE.match(v["from"]) and isinstance(v["to"], str) and HHMM_RE.match(v["to"])
    return json.dumps({"days": v["days"], "from": v["from"], "to": v["to"]}, separators=(",", ":")) if ok else None


def _recipients(v: Any) -> str | None:
    if isinstance(v, str):
        try:
            v = json.loads(v)
        except ValueError:
            return None
    ok = isinstance(v, dict) and set(v) <= {"users", "roles"} and all(
        isinstance(v.get(k, []), list) and len(v.get(k, [])) <= 50 and all(isinstance(x, str) and _ID.match(x) for x in v.get(k, [])) for k in ("users", "roles"))
    return json.dumps({"users": list(dict.fromkeys(v.get("users", []))), "roles": list(dict.fromkeys(v.get("roles", [])))}, separators=(",", ":")) if ok else None


# key -> (default text, validator returning the normalised text or None)
SETTINGS: dict[str, tuple[str, Callable[[Any], str | None]]] = {
    "scenarios.enabled": ("false", _bool),                       # the module switch (section 9): off = 409 on every route but status / settings
    "scenarios.kill_switch": ("false", _bool),                   # stops every action at once; conditions still evaluate and log
    "scenarios.actions.notify": ("false", _bool),                # per-action switches (section 9), all OFF by default
    "scenarios.actions.create_ticket": ("false", _bool),
    "scenarios.actions.set_flag": ("false", _bool),
    "scenarios.max_fires_per_day": ("100", _int(1, 1000)),       # owner Q8 = 271 a: global default; a rule may set its own
    "scenarios.max_tickets_per_day": ("20", _int(0, 200)),
    "scenarios.max_actions_per_hour": ("600", _int(10, 5000)),
    "scenarios.max_rules": ("200", _int(1, 500)),
    "scenarios.tick_s": ("30", _int(10, 300)),
    "scenarios.test_per_min": ("20", _int(1, 120)),
    "scenarios.runs_keep_days": ("90", _int(7, 365)),
    "scenarios.degraded_notice": ("false", _bool),               # owner Q2 = 211 a: the "cannot be evaluated" notice is optional, off
    "scenarios.after_hours_source": ("window", _enum("window", "calendar")),  # the working-hours window below, or the service module's calendar
    "scenarios.work_window": ('{"days":[6,0,1,2,3],"from":"08:00","to":"17:00"}', _window),  # Sunday-Thursday 08:00-17:00 site time
    "scenarios.default_recipients": ('{"users":[],"roles":["system_admin"]}', _recipients),  # a notify action without its own list
}
JSON_KEYS = ("scenarios.work_window", "scenarios.default_recipients")


def setting(conn: sqlite3.Connection, key: str) -> str:
    default, valid = SETTINGS[key]
    v = get_setting(conn, key, default)
    norm = valid(v) if v is not None else None
    return norm if norm is not None else default


def on(conn: sqlite3.Connection, key: str) -> bool:
    return setting(conn, key) == "true"


def num(conn: sqlite3.Connection, key: str) -> int:
    return int(setting(conn, key))


def value(conn: sqlite3.Connection, key: str) -> Any:
    raw = setting(conn, key)
    if key in JSON_KEYS:
        return json.loads(raw)
    if raw in _BOOL:
        return raw == "true"
    return int(raw) if raw.isdigit() else raw


def view(conn: sqlite3.Connection) -> dict[str, Any]:
    return {k: value(conn, k) for k in SETTINGS}


def update(conn: sqlite3.Connection, principal: Principal, changes: dict[str, Any], rid: str | None) -> list[str]:
    """Validate everything first, then store; audited per key (`scenario.settings.change`, and `scenario.kill_switch` for that key)."""
    norm: dict[str, str] = {}
    for key, v in changes.items():
        if key not in SETTINGS:
            raise ApiError(422, "invalid_setting", "הגדרה לא מוכרת.", details={"key": str(key)[:64]})
        if isinstance(v, bool):
            v = "true" if v else "false"
        elif isinstance(v, int):
            v = str(v)
        n = SETTINGS[key][1](v)
        if n is None:
            raise ApiError(422, "invalid_setting", "ערך לא תקין להגדרה.", details={"key": key})
        norm[key] = n
    changed: list[str] = []
    for key, n in norm.items():
        before = setting(conn, key)
        if before == n:
            continue
        set_setting(conn, key, n)
        changed.append(key)
        action = "scenario.kill_switch" if key == "scenarios.kill_switch" else "scenario.settings.change"
        audit(conn, actor=principal, action=action, decision="allowed", resource_type="setting", resource_id=key, request_id=rid,
              details={"key": key, "before": before, "after": n})
    return sorted(changed)
