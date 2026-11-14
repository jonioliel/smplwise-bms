"""XSCENARIO109-295 (docs/changes/CR-SCENARIO109.md, section 17 binds): cross-module scenarios - storage, the reference rule, the dry run,
the evaluation engine and the closed action set.

Who acts: every scenario has its own service identity record (`svc:scenario:<id>`, never a sign-in); the author's rights are rechecked at
EVERY run, and a rule whose author lost them stops, is marked defective (`degraded` / `author_rights_lost`) and waits for a manager to
reassign it (owner Q4 = 270 a). Actions: notify, create_service_request, set_flag - nothing else, never a door or a device (section 6.1,
17.3). Everything is OFF by default (scenario_settings). The HA automation path is not touched (17.1): nothing here calls the bridge."""
from __future__ import annotations

import datetime as dt
import json
import logging
import os
import sqlite3
import threading
import time
from typing import Any, Iterable, Mapping

from ..audit import audit
from ..db import new_id, now_iso
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, all_roles, authorize, role_name
from . import scenario_model as m
from . import scenario_settings as cfg
from . import scenario_signals as sig

log = logging.getLogger("smplwise.scenarios")

VIEW, MANAGE, ADMIN = "scenario.view", "scenario.manage", "scenario.admin"
STATES = ("off", "ok", "active", "degraded", "suppressed")
RUNTIME_PATH = "$"

TEXT = {
    "disabled": "תרחישים כבויים בהגדרות המערכת.",
    "not_found": "התרחיש לא נמצא.",
    "version_conflict": "התרחיש השתנה בינתיים. רעננו ונסו שוב.",
    "test_required": "יש להריץ בדיקה (הרצה יבשה) של הגרסה הנוכחית לפני ההפעלה.",
    "confirm_required": "הפעלת תרחיש שפותח בקשות שירות דורשת אישור מפורש של המחלקה ומגבלת הבקשות היומית.",
    "local_identity": "משתמש מקומי של Arx אינו יכול לכתוב תרחישים.",
    "too_many_rules": "הגעתם למספר התרחישים המרבי שהוגדר.",
    "rate_limited": "יותר מדי בדיקות בדקה. נסו שוב בעוד רגע.",
    "not_referenced": "אין לכם הרשאה לאות או לנושא הזה.",
    "tickets_off": "מודול בקשות השירות כבוי, ולכן אין פעולת פתיחת בקשת שירות.",
    "department": "אין לכם הרשאה לפתוח בקשות במחלקה הזו, או שהמחלקה אינה פעילה.",
    "recipient": "נמען לא מוכר.",
    "flag_cycle": "סימונים יוצרים מעגל בין תרחישים.",
    "flag_depth": "שרשרת סימונים ארוכה מ-3 תרחישים.",
    "redacted": "אין הרשאה להצגת הנתון",
    "owner": "המשתמש אינו פעיל או אינו רשאי לכתוב תרחישים.",
}
REASON_HE = {
    "sensor_unknown": "חיישן לא מדווח זמן רב מדי",
    "author_rights_lost": "לכותב התרחיש כבר אין הרשאה; מנהל צריך להעביר את התרחיש",
    "tickets_off": "מודול בקשות השירות כבוי",
    "kill_switch": "עצירת חירום של כל הפעולות",
    "fires_cap": "הגעה למגבלת ההפעלות היומית",
    "actions_cap": "הגעה למגבלת הפעולות לשעה",
    "cooldown": "בהמתנה בין הפעלות",
}
CMP_HE = {"is_true": "", "is_false": "לא", "gt": "מעל", "ge": "לפחות", "lt": "מתחת", "le": "לכל היותר", "eq": "שווה", "ne": "שונה מ",
          "between": "בין", "outside": "מחוץ ל", "in_set": "אחד מ"}
_test_hits: dict[str, list[float]] = {}
_test_lock = threading.Lock()


def _err(status: int, code: str, details: dict[str, Any] | None = None) -> ApiError:
    return ApiError(status, code, TEXT.get(code, code), details=details)


def _validation(errors: list[dict[str, str]]) -> ApiError:
    return ApiError(422, "validation", "התרחיש אינו תקין.", details={"errors": errors})


def module_on(conn: sqlite3.Connection) -> bool:
    return cfg.on(conn, "scenarios.enabled")


def require_on(conn: sqlite3.Connection) -> None:
    if not module_on(conn):
        raise ApiError(409, "scenarios_disabled", TEXT["disabled"])


def allowed(conn: sqlite3.Connection, principal: Principal, permission: str) -> bool:
    return authorize(conn, principal, permission, INSTALLATION).allowed


def service_identity_of(rule_id: str) -> str:
    return f"svc:scenario:{rule_id}"


def _principal(conn: sqlite3.Connection, user_id: str) -> Principal | None:
    from .notify_visibility import principal_of

    return principal_of(conn, user_id)


def _local_day(conn: sqlite3.Connection, now: dt.datetime) -> str:
    return now.astimezone(sig.site_zone(conn)).date().isoformat()


# ---------------------------------------------------------------- the reference rule (section 8)

def _tickets_on(conn: sqlite3.Connection) -> bool:
    try:
        from .tickets import access

        return access.module_on(conn)
    except Exception:  # noqa: BLE001
        return False


def _department(conn: sqlite3.Connection, dept_id: str) -> dict[str, Any] | None:
    try:
        from .tickets import store

        d = store.department(conn, dept_id)
    except Exception:  # noqa: BLE001
        return None
    return dict(d) if d is not None else None


def reference_problems(conn: sqlite3.Connection, author: Principal, v: m.Validated) -> list[dict[str, str]]:
    """What the author may not reference: signals / subjects, the request department, the recipients. [] = everything is in reach."""
    reach = sig.Reach(conn, author)
    out: list[dict[str, str]] = []
    for path, leaf in v.leaves:
        if not sig.can_reference(reach, leaf["signal"], leaf.get("subject")):
            out.append({"path": f"{path}.subject" if leaf.get("subject") else f"{path}.signal", "code": "not_referenced", "message": TEXT["not_referenced"]})
    roles = None
    for i, a in enumerate(v.definition.get("actions") or []):
        if a["type"] == "create_service_request":
            if not _tickets_on(conn):
                out.append({"path": f"actions[{i}].type", "code": "tickets_off", "message": TEXT["tickets_off"]})
                continue
            from .tickets import access

            dept = _department(conn, a["department_id"])
            if dept is None or not dept.get("active") or not access.Viewer(conn, author).can_create_in(dept):
                out.append({"path": f"actions[{i}].department_id", "code": "department", "message": TEXT["department"]})
        elif a["type"] == "notify":
            to = a.get("to") or {}
            for u in to.get("users", []):
                if _principal(conn, u) is None:
                    out.append({"path": f"actions[{i}].to.users", "code": "recipient", "message": TEXT["recipient"]})
            if to.get("roles"):
                roles = roles if roles is not None else all_roles(conn)
                for r in to["roles"]:
                    if r not in roles:
                        out.append({"path": f"actions[{i}].to.roles", "code": "recipient", "message": TEXT["recipient"]})
    return out


def _graph(conn: sqlite3.Connection, skip: str | None) -> dict[str, tuple[set[str], set[str]]]:
    g: dict[str, tuple[set[str], set[str]]] = {}
    for r in conn.execute("SELECT id, definition_json FROM scenario_rules").fetchall():
        if r["id"] == skip:
            continue
        try:
            d = json.loads(r["definition_json"])
        except ValueError:
            continue
        reads = {lf.get("subject") for _, lf in m.leaves_of(d.get("when") or {}) if lf.get("signal") == "flag.value"}
        writes = {a.get("flag") for a in d.get("actions") or [] if a.get("type") == "set_flag"}
        g[r["id"]] = ({x for x in reads if isinstance(x, str)}, {x for x in writes if isinstance(x, str)})
    return g


def check(conn: sqlite3.Connection, author: Principal, definition: Any, rule_id: str | None = None) -> m.Validated:
    v, errors = m.validate(definition, sig.CATALOGUE)
    if v is None:
        raise _validation(errors)
    problems = reference_problems(conn, author, v)
    if problems:
        raise _validation(problems)
    g = _graph(conn, rule_id)
    g[rule_id or "new"] = (v.flags_read, v.flags_written)
    cyc, longest = m.flag_cycle(g)
    if cyc is not None:
        raise _validation([{"path": "actions", "code": "flag_cycle", "message": TEXT["flag_cycle"]}])
    if longest > 3:
        raise _validation([{"path": "actions", "code": "flag_depth", "message": TEXT["flag_depth"]}])
    return v


def rights_lost(conn: sqlite3.Connection, row: Mapping[str, Any], definition: Mapping[str, Any]) -> bool:
    """The recheck at every run: the author is active, still holds scenario.manage and still reaches every signal and action."""
    author = _principal(conn, row["owner_user_id"])
    if author is None or not allowed(conn, author, MANAGE):
        return True
    v, errors = m.validate(definition, sig.CATALOGUE)
    if v is None:
        return True
    probs = [p for p in reference_problems(conn, author, v) if p["code"] != "tickets_off"]  # tickets off is its own state, not lost rights
    return bool(probs)


# ---------------------------------------------------------------- the sentence (section 7)

def _fmt(v: Any, unit: str) -> str:
    if isinstance(v, bool):
        return "כן" if v else "לא"
    if v is None:
        return "לא ידוע"
    if isinstance(v, float):
        v = round(v, 1)
    return f"{v}{(' ' + unit) if unit and unit != 's' else (' שנ׳' if unit == 's' else '')}"


def leaf_text(conn: sqlite3.Connection, snap: Mapping[str, Any]) -> str:
    spec = sig.CATALOGUE.get(snap["signal"])
    if spec is None:
        return ""
    name = sig.subject_name(conn, snap["signal"], snap.get("subject"))
    head = spec.label + (f" ב{name}" if name and spec.subject != "flag" else (f" {name}" if name else ""))
    if spec.subject == "window":
        w = snap.get("target") or {}
        head = f"{spec.label} {w.get('from', '')}-{w.get('to', '')}"
    c = snap.get("cmp")
    if c in ("is_true", "is_false"):
        cond = "" if c == "is_true" else " (לא)"
        val = ""
    else:
        t = snap.get("target")
        tt = "-".join(str(x) for x in t) if isinstance(t, list) else str(t)
        cond = f" ({CMP_HE.get(c, c)} {tt})"
        val = f" = {_fmt(snap.get('value'), spec.unit)}"
    mark = {"TRUE": "✓", "FALSE": "✗", "UNKNOWN": "?"}[snap.get("result", "UNKNOWN")]
    return f"{mark} {head}{val}{cond}"


def sentence(conn: sqlite3.Connection, node: Mapping[str, Any], snaps: list[Mapping[str, Any]], path: str = "when") -> str:
    by = {s["path"]: s for s in snaps}

    def rec(n: Mapping[str, Any], p: str) -> str:
        op = n.get("op")
        if op in ("and", "or"):
            word = " וגם " if op == "and" else " או "
            parts = [rec(it, f"{p}.items[{i}]") for i, it in enumerate(n["items"])]
            s = word.join(parts)
            return f"({s})" if p != path else s
        if op == "not":
            return f"לא ({rec(n['item'], f'{p}.item')})"
        s = by.get(p)
        return leaf_text(conn, s) if s else ""
    return rec(node, path)


# ---------------------------------------------------------------- evaluation of one rule (shared by the engine and the dry run)

def _states(conn: sqlite3.Connection, rule_id: str) -> tuple[dict[str, m.LeafState], dict[str, Any]]:
    leaves: dict[str, m.LeafState] = {}
    runtime: dict[str, Any] = {}
    for r in conn.execute("SELECT * FROM scenario_leaf_state WHERE rule_id = ?", (rule_id,)).fetchall():
        try:
            d = json.loads(r["last_reading_json"] or "{}")
        except ValueError:
            d = {}
        if r["leaf_path"] == RUNTIME_PATH:
            runtime = d if isinstance(d, dict) else {}
        else:
            leaves[r["leaf_path"]] = m.LeafState.of(d)
    return leaves, runtime


def _save_states(conn: sqlite3.Connection, rule_id: str, leaves: Mapping[str, m.LeafState], runtime: Mapping[str, Any]) -> None:
    conn.execute("DELETE FROM scenario_leaf_state WHERE rule_id = ?", (rule_id,))
    for p, st in leaves.items():
        conn.execute("INSERT INTO scenario_leaf_state(rule_id, leaf_path, raw_state, since, held_since, hyst_state, last_reading_json) VALUES (?,?,?,?,?,?,?)",
                     (rule_id, p, st.raw, st.since, st.held_since, st.hyst, json.dumps(st.to_json())))
    conn.execute("INSERT INTO scenario_leaf_state(rule_id, leaf_path, raw_state, last_reading_json) VALUES (?,?,?,?)",
                 (rule_id, RUNTIME_PATH, "UNKNOWN", json.dumps(dict(runtime))))


def provider_ctx(conn: sqlite3.Connection, now: dt.datetime) -> sig.Ctx:
    return sig.Ctx(conn, now, cfg.value(conn, "scenarios.work_window"), cfg.setting(conn, "scenarios.after_hours_source"))


def read_all(ctx: sig.Ctx, definition: Mapping[str, Any], overrides: Mapping[str, Any] | None = None) -> dict[str, m.Reading]:
    """Every leaf's reading; `overrides` (a simulation) replaces a leaf's value by path with a fresh, ok reading."""
    out: dict[str, m.Reading] = {}
    for p, leaf in m.leaves_of(definition["when"]):
        if overrides and p in overrides:
            v = overrides[p]
            out[p] = m.Reading(v, "ok", m.iso(ctx.now), "simulated") if v is not None else m.Reading(None, "unknown", None, "simulated_unknown")
        else:
            out[p] = sig.read(ctx, leaf)
    return out


def dry_run(conn: sqlite3.Connection, author: Principal, definition: Any, *, rule_row: Mapping[str, Any] | None = None, overrides: Mapping[str, Any] | None = None,
            now: dt.datetime | None = None) -> dict[str, Any]:
    """Evaluate against current (or simulated) readings. No action runs, no state is stored. For a saved rule the hold / debounce
    progress comes from its stored state; for an unsaved definition the holds are reported, not waited for."""
    v = check(conn, author, definition, rule_row["id"] if rule_row else None)
    if overrides:
        paths = {p for p, _ in m.leaves_of(definition["when"])}
        bad = [p for p in overrides if p not in paths]
        if bad:
            raise _validation([{"path": p, "code": "unknown_key", "message": m.MSG["unknown_key"]} for p in bad[:10]])
    now = now or m.SystemClock().now()
    ctx = provider_ctx(conn, now)
    readings = read_all(ctx, definition, overrides)
    states = _states(conn, rule_row["id"])[0] if rule_row else {}
    result, _, snaps = m.evaluate(definition["when"], sig.CATALOGUE, readings, states, now, stateless=rule_row is None)
    opts = m.options_of(definition)
    would = result == m.TRUE
    actions = [_action_preview(conn, a) for a in v.definition["actions"]]
    return {"result": result, "would_fire": would, "snapshot": snaps, "sentence": sentence(conn, definition["when"], snaps), "options": opts,
            "actions": actions, "at": m.iso(now), "simulated": bool(overrides)}


def _action_preview(conn: sqlite3.Connection, a: Mapping[str, Any]) -> dict[str, Any]:
    key = {"notify": "scenarios.actions.notify", "create_service_request": "scenarios.actions.create_ticket", "set_flag": "scenarios.actions.set_flag"}[a["type"]]
    out = {"type": a["type"], "switch_on": cfg.on(conn, key)}
    if a["type"] == "create_service_request":
        out["tickets_on"] = _tickets_on(conn)
    return out


# ---------------------------------------------------------------- actions

def _role_users(conn: sqlite3.Connection, roles: Iterable[str]) -> list[str]:
    roles = list(roles)
    if not roles:
        return []
    q = f"SELECT DISTINCT subject_id FROM bindings WHERE subject_kind = 'user' AND effect = 'allow' AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?) AND role_id IN ({','.join('?' * len(roles))})"
    try:
        return [r["subject_id"] for r in conn.execute(q, (now_iso(), *roles)).fetchall()]
    except sqlite3.Error:
        return []


def audiences(conn: sqlite3.Connection, definition: Mapping[str, Any], to: Mapping[str, Any]) -> tuple[list[str], list[str]]:
    """(full, generic): addressed people who may see every module and subject the scenario reads get the values; the rest a notice
    without values (owner Q7 = 216 a)."""
    ids = list(dict.fromkeys([*to.get("users", []), *_role_users(conn, to.get("roles", []))]))
    full, generic = [], []
    leaves = m.leaves_of(definition["when"])
    for uid in ids[:200]:
        p = _principal(conn, uid)
        if p is None:
            continue
        reach = sig.Reach(conn, p)
        (full if all(sig.can_reference(reach, lf["signal"], lf.get("subject")) for _, lf in leaves) else generic).append(uid)
    return full, generic


def _notify(conn: sqlite3.Connection, row: Mapping[str, Any], definition: Mapping[str, Any], a: Mapping[str, Any], run_id: str, text: str, *, resolve: bool = False) -> dict[str, Any]:
    from . import notify

    to = a.get("to") or {}
    if not to.get("users") and not to.get("roles"):
        to = cfg.value(conn, "scenarios.default_recipients")
    full, generic = audiences(conn, definition, to)
    res: dict[str, Any] = {"type": "notify", "status": "ok", "full": len(full), "generic": len(generic)}
    for source, users, key in (("scenario.fired", full, "full"), ("scenario.fired_generic", generic, "generic")):
        if not users and not resolve:
            continue
        s = notify.Signal(source, "scenario", row["id"], severity=a.get("severity"), dedupe_key=f"scenario:{row['id']}:{key}",
                          params={"name": row["name"], "detail": text if key == "full" else ""}, origin={"scenario_id": row["id"], "run_id": run_id, "to": users},
                          resolve=resolve, link=f"/automations?scenario={row['id']}&run={run_id}")
        notify.emit_full(conn, s)
    return res


def _ticket(conn: sqlite3.Connection, row: Mapping[str, Any], a: Mapping[str, Any], run_id: str, text: str, limits: Mapping[str, int]) -> dict[str, Any]:
    if not _tickets_on(conn):
        return {"type": "create_service_request", "status": "skipped", "reason": "tickets_off"}
    if row["tickets_today"] >= limits["tickets"]:
        return {"type": "create_service_request", "status": "skipped", "reason": "tickets_cap"}
    from .tickets import create

    spec = create.TicketSpec(department_id=a["department_id"], title=(a.get("title") or f"תרחיש: {row['name']}")[:200], description=text[:4000],
                             priority_key=a.get("priority_key") or None, origin="rule", rule_ref=f"scenario:{row['id']}", dedupe_key=f"scenario:{row['id']}")
    r = create.create_by_rule(conn, spec, source_note=f"נפתח על ידי התרחיש \"{row['name']}\" (זהות שירות {service_identity_of(row['id'])}).\n{text}"[:4000],
                              absorb_note="התרחיש הופעל שוב בזמן שהבקשה פתוחה.", data={"scenario_id": row["id"], "run_id": run_id})
    if r.kind == "created":
        conn.execute("UPDATE scenario_rules SET tickets_today = tickets_today + 1 WHERE id = ?", (row["id"],))
    return {"type": "create_service_request", "status": "ok", "result": r.kind, "ticket_id": r.ticket_id, "number": r.number}


def _flag(conn: sqlite3.Connection, row: Mapping[str, Any], a: Mapping[str, Any], value: bool | None = None) -> dict[str, Any]:
    v = a["value"] if value is None else value
    conn.execute("INSERT INTO scenario_flags(name, value, set_by_rule, set_at) VALUES (?,?,?,?) ON CONFLICT(name) DO UPDATE SET value = excluded.value, "
                 "set_by_rule = excluded.set_by_rule, set_at = excluded.set_at", (a["flag"], "true" if v else "false", row["id"], now_iso()))
    return {"type": "set_flag", "status": "ok", "flag": a["flag"], "value": v}


SWITCH = {"notify": "scenarios.actions.notify", "create_service_request": "scenarios.actions.create_ticket", "set_flag": "scenarios.actions.set_flag"}


def run_actions(conn: sqlite3.Connection, row: Mapping[str, Any], definition: Mapping[str, Any], run_id: str, text: str, limits: Mapping[str, int]) -> list[dict[str, Any]]:
    """Each action independent: one failing never skips the rest; every result is logged (section 4)."""
    out = []
    for a in definition["actions"]:
        if not cfg.on(conn, SWITCH[a["type"]]):
            out.append({"type": a["type"], "status": "skipped", "reason": "action_off"})
            continue
        conn.execute("SAVEPOINT scenario_action")
        try:
            if a["type"] == "notify":
                res = _notify(conn, row, definition, a, run_id, text)
            elif a["type"] == "create_service_request":
                res = _ticket(conn, row, a, run_id, text, limits)
            else:
                res = _flag(conn, row, a)
            conn.execute("RELEASE scenario_action")
        except Exception as exc:  # noqa: BLE001 - an action failing never breaks the engine or the module
            conn.execute("ROLLBACK TO scenario_action")
            conn.execute("RELEASE scenario_action")
            log.warning("scenario action failed: %s", a["type"], exc_info=True)
            res = {"type": a["type"], "status": "failed", "reason": getattr(exc, "code", type(exc).__name__)}
            audit(conn, actor=None, action="scenario.action_failed", decision="error", resource_type="scenario", resource_id=row["id"],
                  details={"type": a["type"], "reason": res["reason"], "service_identity": service_identity_of(row["id"])})
        out.append(res)
    return out


def _clear_actions(conn: sqlite3.Connection, row: Mapping[str, Any], definition: Mapping[str, Any], run_id: str) -> None:
    for a in definition["actions"]:
        if a["type"] == "notify":
            try:
                _notify(conn, row, definition, a, run_id, "", resolve=True)
            except Exception:  # noqa: BLE001
                log.warning("scenario resolve notice failed", exc_info=True)


# ---------------------------------------------------------------- the engine step (section 3.3, 10)

def _write_run(conn: sqlite3.Connection, row: Mapping[str, Any], at: dt.datetime, trigger: str, outcome: str, result: str, snaps: Any, actions: Any,
               extra: Mapping[str, Any] | None = None) -> str:
    rid = new_id()
    snap = {"leaves": snaps, **(extra or {})}
    conn.execute("INSERT INTO scenario_runs(id, rule_id, rule_version, at, trigger_kind, outcome, result, snapshot_json, actions_json) VALUES (?,?,?,?,?,?,?,?,?)",
                 (rid, row["id"], row["version"], m.iso(at), trigger, outcome, result, json.dumps(snap, ensure_ascii=False), json.dumps(actions, ensure_ascii=False)))
    return rid


def _set_state(conn: sqlite3.Connection, row: Mapping[str, Any], state: str, reason: str | None, now: dt.datetime) -> None:
    if row["state"] != state or (row["state_reason"] or None) != reason:
        conn.execute("UPDATE scenario_rules SET state = ?, state_reason = ?, state_since = ? WHERE id = ?", (state, reason, m.iso(now), row["id"]))


def limits_of(conn: sqlite3.Connection, definition: Mapping[str, Any]) -> dict[str, int]:
    o = definition.get("options") or {}
    return {"fires": int(o.get("max_fires_per_day", cfg.num(conn, "scenarios.max_fires_per_day"))),
            "tickets": int(o.get("max_tickets_per_day", cfg.num(conn, "scenarios.max_tickets_per_day"))),
            "per_hour": cfg.num(conn, "scenarios.max_actions_per_hour")}


def _actions_last_hour(conn: sqlite3.Connection, now: dt.datetime) -> int:
    since = m.iso(now - dt.timedelta(hours=1))
    r = conn.execute("SELECT COALESCE(SUM(json_array_length(actions_json)), 0) AS n FROM scenario_runs WHERE outcome = 'fired' AND at >= ?", (since,)).fetchone()
    return int(r["n"] or 0)


def step(conn: sqlite3.Connection, rule_id: str, now: dt.datetime, trigger: str = "tick") -> str | None:
    """One rule at `now`. Returns the outcome written (fired / cleared / suppressed / degraded) or None when nothing changed."""
    row = conn.execute("SELECT * FROM scenario_rules WHERE id = ?", (rule_id,)).fetchone()
    if row is None or not row["enabled"]:
        return None
    if row["state"] == "degraded" and row["state_reason"] == "author_rights_lost":
        return None  # stopped until a manager reassigns it
    definition = json.loads(row["definition_json"])
    if rights_lost(conn, row, definition):
        _set_state(conn, row, "degraded", "author_rights_lost", now)
        _write_run(conn, row, now, trigger, "degraded", m.UNKNOWN, [], [], {"reason": "author_rights_lost"})
        audit(conn, actor=None, action="scenario.degraded", decision="denied", resource_type="scenario", resource_id=row["id"],
              details={"reason": "author_rights_lost", "service_identity": service_identity_of(row["id"])})
        return "degraded"
    day = _local_day(conn, now)
    if row["fires_day"] != day:
        conn.execute("UPDATE scenario_rules SET fires_day = ?, fires_today = 0, tickets_today = 0 WHERE id = ?", (day, row["id"]))
        row = conn.execute("SELECT * FROM scenario_rules WHERE id = ?", (rule_id,)).fetchone()
    opts = m.options_of(definition)
    leaves, rt = _states(conn, row["id"])
    readings = read_all(provider_ctx(conn, now), definition)
    result, new_leaves, snaps = m.evaluate(definition["when"], sig.CATALOGUE, readings, leaves, now)
    eff = m.FALSE if (result == m.UNKNOWN and opts["on_unknown"] == "treat_as_false") else result
    nowi = m.iso(now)
    outcome: str | None = None
    state, reason = row["state"], row["state_reason"]
    if eff == m.UNKNOWN:
        rt["unknown_since"] = rt.get("unknown_since") or nowi
        rt["for_since"] = None
        if state != "degraded" and (m._secs(rt["unknown_since"], now) or 0) >= opts["unknown_grace_s"]:
            rt["was_active"] = state == "active"
            _set_state(conn, row, "degraded", "sensor_unknown", now)
            outcome = "degraded"
            _write_run(conn, row, now, trigger, outcome, result, snaps, [], {"reason": "sensor_unknown"})
            audit(conn, actor=None, action="scenario.degraded", decision="allowed", resource_type="scenario", resource_id=row["id"],
                  details={"reason": "sensor_unknown", "service_identity": service_identity_of(row["id"])})
            if cfg.on(conn, "scenarios.degraded_notice"):
                _degraded_notice(conn, row, definition, REASON_HE["sensor_unknown"])
    else:
        rt["unknown_since"] = None
        if state == "degraded" and reason == "sensor_unknown":
            state = "active" if rt.get("was_active") else "ok"
            _set_state(conn, row, state, None, now)
            if cfg.on(conn, "scenarios.degraded_notice"):
                _degraded_notice(conn, row, definition, "", resolve=True)
        if eff == m.TRUE:
            rt["false_since"] = None
            rt["for_since"] = rt.get("for_since") or nowi
            held = (m._secs(rt["for_since"], now) or 0) >= opts["for_s"]
            if held and state not in ("active",):
                outcome = _fire(conn, row, definition, now, trigger, result, snaps)
        else:
            rt["for_since"] = None
            if state == "active":
                rt["false_since"] = rt.get("false_since") or nowi
                if (m._secs(rt["false_since"], now) or 0) >= opts["clear_after_s"]:
                    run_id = _write_run(conn, row, now, trigger, "cleared", result, snaps, [])
                    _clear_actions(conn, row, definition, run_id)
                    _set_state(conn, row, "ok", None, now)
                    rt["false_since"] = None
                    outcome = "cleared"
            elif state in ("suppressed", "off"):
                _set_state(conn, row, "ok", None, now)
    conn.execute("UPDATE scenario_rules SET last_eval_at = ?, last_result = ? WHERE id = ?", (nowi, result, row["id"]))
    _save_states(conn, row["id"], new_leaves, rt)
    return outcome


def _fire(conn: sqlite3.Connection, row: Mapping[str, Any], definition: Mapping[str, Any], now: dt.datetime, trigger: str, result: str, snaps: Any) -> str | None:
    opts = m.options_of(definition)
    last = m.parse(row["last_fire_at"])
    if last is not None and (now - last).total_seconds() < opts["cooldown_s"]:
        return None  # inside the cooldown: no new fire, the rule simply waits
    limits = limits_of(conn, definition)
    text = sentence(conn, definition["when"], snaps)
    why = None
    if cfg.on(conn, "scenarios.kill_switch"):
        why = "kill_switch"
    elif row["fires_today"] >= limits["fires"]:
        why = "fires_cap"
    elif _actions_last_hour(conn, now) + len(definition["actions"]) > limits["per_hour"]:
        why = "actions_cap"
    if why:
        if row["state"] != "suppressed":  # audited once per suppression, no retry storm
            _write_run(conn, row, now, trigger, "suppressed", result, snaps, [], {"reason": why, "sentence": text})
            audit(conn, actor=None, action="scenario.suppressed", decision="denied", resource_type="scenario", resource_id=row["id"],
                  details={"reason": why, "service_identity": service_identity_of(row["id"])})
            _set_state(conn, row, "suppressed", why, now)
            return "suppressed"
        return None
    run_id = new_id()
    actions = run_actions(conn, row, definition, run_id, text, limits)
    snap = {"leaves": snaps, "sentence": text, "service_identity": service_identity_of(row["id"])}
    conn.execute("INSERT INTO scenario_runs(id, rule_id, rule_version, at, trigger_kind, outcome, result, snapshot_json, actions_json) VALUES (?,?,?,?,?,?,?,?,?)",
                 (run_id, row["id"], row["version"], m.iso(now), trigger, "fired", result, json.dumps(snap, ensure_ascii=False), json.dumps(actions, ensure_ascii=False)))
    conn.execute("UPDATE scenario_rules SET last_fire_at = ?, fires_today = fires_today + 1 WHERE id = ?", (m.iso(now), row["id"]))
    _set_state(conn, row, "active", None, now)
    audit(conn, actor=None, action="scenario.fire", decision="allowed", resource_type="scenario", resource_id=row["id"],
          details={"version": row["version"], "run_id": run_id, "service_identity": service_identity_of(row["id"]),
                   "actions": [{k: v for k, v in a.items() if k in ("type", "status", "reason", "result")} for a in actions]})
    return "fired"


def _degraded_notice(conn: sqlite3.Connection, row: Mapping[str, Any], definition: Mapping[str, Any], text: str, *, resolve: bool = False) -> None:
    from . import notify

    try:
        users = [u for u in [row["owner_user_id"]] if _principal(conn, u) is not None]
        notify.emit_full(conn, notify.Signal("scenario.degraded", "scenario", row["id"], dedupe_key=f"scenario:{row['id']}:degraded",
                                             params={"name": row["name"], "detail": text}, origin={"scenario_id": row["id"], "to": users}, resolve=resolve))
    except Exception:  # noqa: BLE001
        log.warning("scenario degraded notice failed", exc_info=True)


def tick(db: Any, now: dt.datetime | None = None) -> dict[str, Any]:
    """One pass over every enabled rule (each in its own transaction, so one bad rule never stops the others)."""
    now = now or m.SystemClock().now()
    with db.connection(mode="read", label="scenarios.tick.read") as conn:
        try:
            if not module_on(conn):
                return {"skipped": "disabled"}
            ids = [r["id"] for r in conn.execute("SELECT id FROM scenario_rules WHERE enabled = 1 ORDER BY id LIMIT ?", (cfg.num(conn, "scenarios.max_rules"),)).fetchall()]
        except sqlite3.Error:
            return {"skipped": "no_schema"}
    out: dict[str, Any] = {"rules": len(ids), "outcomes": {}}
    for rid in ids:
        try:
            with db.connection(label="scenarios.tick") as conn:
                o = step(conn, rid, now)
            if o:
                out["outcomes"][rid] = o
        except Exception:  # noqa: BLE001 - the engine never breaks a module
            log.warning("scenario step failed", exc_info=True)
    return out


def janitor(db: Any, now: dt.datetime | None = None) -> int:
    now = now or m.SystemClock().now()
    with db.connection(label="scenarios.janitor") as conn:
        try:
            keep = cfg.num(conn, "scenarios.runs_keep_days")
            cur = conn.execute("DELETE FROM scenario_runs WHERE at < ?", (m.iso(now - dt.timedelta(days=keep)),))
            n = cur.rowcount or 0
            for r in conn.execute("SELECT rule_id, COUNT(*) AS c FROM scenario_runs GROUP BY rule_id HAVING c > 5000").fetchall():
                n += conn.execute("DELETE FROM scenario_runs WHERE rule_id = ? AND id NOT IN (SELECT id FROM scenario_runs WHERE rule_id = ? ORDER BY at DESC LIMIT 5000)",
                                  (r["rule_id"], r["rule_id"])).rowcount or 0
            return n
        except sqlite3.Error:
            return 0


class Runner:
    def __init__(self) -> None:
        self.stop_evt = threading.Event()
        self.thread: threading.Thread | None = None
        self.last: dict[str, Any] = {}
        self.errors = 0
        self._pruned = 0.0

    def start(self, db: Any) -> None:
        if os.environ.get("SW_SCENARIOS", "1") == "0" or (self.thread and self.thread.is_alive()):
            return
        self.stop_evt.clear()
        self.thread = threading.Thread(target=self._run, args=(db,), name="scenarios-runner", daemon=True)
        self.thread.start()

    def _interval(self, db: Any) -> float:
        try:
            with db.connection(mode="read", label="scenarios.interval") as conn:
                return float(cfg.num(conn, "scenarios.tick_s"))
        except Exception:  # noqa: BLE001
            return 30.0

    def _run(self, db: Any) -> None:
        while not self.stop_evt.wait(self._interval(db)):
            try:
                self.last = tick(db)  # nothing is read while the module is off
                if time.time() - self._pruned > 3600:
                    self._pruned = time.time()
                    janitor(db)
            except Exception:  # noqa: BLE001
                self.errors += 1
                log.warning("scenarios pass failed", exc_info=True)

    def shutdown(self) -> None:
        self.stop_evt.set()


RUNNER = Runner()


# ---------------------------------------------------------------- storage and views

def _row(conn: sqlite3.Connection, rule_id: str) -> sqlite3.Row:
    r = conn.execute("SELECT * FROM scenario_rules WHERE id = ?", (rule_id,)).fetchone()
    if r is None:
        raise _err(404, "not_found")
    return r


def get_row(conn: sqlite3.Connection, rule_id: str) -> sqlite3.Row:
    return _row(conn, rule_id)


def _user_name(conn: sqlite3.Connection, uid: str) -> str:
    r = conn.execute("SELECT display_name, username FROM users WHERE id = ?", (uid,)).fetchone()
    return (r["display_name"] or r["username"] or "") if r else ""


def redact(conn: sqlite3.Connection, viewer: Principal, definition: Mapping[str, Any]) -> tuple[dict[str, Any], set[str]]:
    """The definition as the viewer may read it: a leaf on a module or subject he cannot see is replaced by a redacted marker."""
    reach = sig.Reach(conn, viewer)
    hidden: set[str] = set()

    def rec(n: Mapping[str, Any], p: str) -> dict[str, Any]:
        op = n.get("op")
        if op in ("and", "or"):
            return {"op": op, "items": [rec(it, f"{p}.items[{i}]") for i, it in enumerate(n["items"])]}
        if op == "not":
            return {"op": "not", "item": rec(n["item"], f"{p}.item")}
        if sig.can_reference(reach, n["signal"], n.get("subject")):
            return dict(n)
        hidden.add(p)
        return {"redacted": True, "message": TEXT["redacted"]}
    d = dict(definition)
    d["when"] = rec(definition["when"], "when")
    return d, hidden


def view(conn: sqlite3.Connection, viewer: Principal, r: Mapping[str, Any], *, full: bool = True) -> dict[str, Any]:
    definition = json.loads(r["definition_json"])
    shown, hidden = redact(conn, viewer, definition)
    has_ticket = any(a.get("type") == "create_service_request" for a in definition.get("actions") or [])
    warnings = []
    if has_ticket and not _tickets_on(conn):
        warnings.append({"code": "tickets_off", "message": REASON_HE["tickets_off"]})
    out = {"id": r["id"], "name": r["name"], "description": r["description"], "enabled": bool(r["enabled"]), "version": r["version"],
           "state": r["state"] if r["enabled"] else "off", "state_reason": r["state_reason"], "state_reason_text": REASON_HE.get(r["state_reason"] or "", ""),
           "state_since": r["state_since"], "last_eval_at": r["last_eval_at"], "last_result": r["last_result"], "last_fire_at": r["last_fire_at"],
           "fires_today": r["fires_today"], "tickets_today": r["tickets_today"], "owner": {"id": r["owner_user_id"], "name": _user_name(conn, r["owner_user_id"])},
           "service_identity": r["service_identity"], "redacted_leaves": sorted(hidden), "warnings": warnings, "updated_at": r["updated_at"],
           "modules": sorted({sig.CATALOGUE[lf["signal"]].module for _, lf in m.leaves_of(definition["when"]) if lf.get("signal") in sig.CATALOGUE}),
           "action_types": [a.get("type") for a in definition.get("actions") or []]}
    if full:
        out["definition"] = shown
        out["tested_version"] = _tested_version(conn, r)
    return out


def _tested_version(conn: sqlite3.Connection, r: Mapping[str, Any]) -> bool:
    return conn.execute("SELECT 1 FROM scenario_runs WHERE rule_id = ? AND outcome = 'test' AND rule_version = ? LIMIT 1", (r["id"], r["version"])).fetchone() is not None


def list_view(conn: sqlite3.Connection, viewer: Principal) -> list[dict[str, Any]]:
    return [view(conn, viewer, r, full=False) for r in conn.execute("SELECT * FROM scenario_rules ORDER BY name COLLATE NOCASE, id").fetchall()]


def _refuse_local(conn: sqlite3.Connection, principal: Principal, rid: str | None) -> None:
    from . import service_identity

    if service_identity.is_local(principal):
        audit(conn, actor=principal, action="scenario.denied", decision="denied", resource_type="scenario", resource_id="*", reason="local_identity", request_id=rid)
        raise ApiError(403, "scenario_write_requires_ha_identity", TEXT["local_identity"])


def create(conn: sqlite3.Connection, principal: Principal, name: str, description: str, definition: Any, rid: str | None) -> dict[str, Any]:
    _refuse_local(conn, principal, rid)
    n = conn.execute("SELECT COUNT(*) AS c FROM scenario_rules").fetchone()["c"]
    if n >= cfg.num(conn, "scenarios.max_rules"):
        raise _err(409, "too_many_rules")
    check(conn, principal, definition)
    rule_id = new_id()
    now = now_iso()
    conn.execute("""INSERT INTO scenario_rules(id, name, description, enabled, schema_version, definition_json, definition_hash, version, owner_user_id,
                    service_identity, state, created_by, updated_by, created_at, updated_at) VALUES (?,?,?,0,?,?,?,1,?,?,'off',?,?,?,?)""",
                 (rule_id, name, description, m.SCHEMA_VERSION, m.canonical(definition), m.definition_hash(definition), principal.user_id,
                  service_identity_of(rule_id), principal.user_id, principal.user_id, now, now))
    conn.execute("INSERT INTO scenario_versions(rule_id, version, definition_json, name, at, by_user) VALUES (?,1,?,?,?,?)",
                 (rule_id, m.canonical(definition), name, now, principal.user_id))
    audit(conn, actor=principal, action="scenario.create", decision="allowed", resource_type="scenario", resource_id=rule_id, request_id=rid,
          details={"version": 1, "hash": m.definition_hash(definition), "service_identity": service_identity_of(rule_id)})
    return view(conn, principal, _row(conn, rule_id))


def update(conn: sqlite3.Connection, principal: Principal, rule_id: str, version: int, name: str, description: str, definition: Any, rid: str | None) -> dict[str, Any]:
    _refuse_local(conn, principal, rid)
    r = _row(conn, rule_id)
    if r["version"] != version:
        raise _err(409, "version_conflict", {"version": r["version"]})
    _, hidden = redact(conn, principal, json.loads(r["definition_json"]))
    if hidden:  # an editor who cannot see a leaf cannot rewrite it (the reference rule, section 8)
        raise _validation([{"path": p, "code": "not_referenced", "message": TEXT["not_referenced"]} for p in sorted(hidden)])
    check(conn, principal, definition, rule_id)
    nv = version + 1
    now = now_iso()
    changed = m.definition_hash(definition) != r["definition_hash"]
    conn.execute("""UPDATE scenario_rules SET name = ?, description = ?, definition_json = ?, definition_hash = ?, version = ?, owner_user_id = ?, updated_by = ?,
                    updated_at = ?, state = CASE WHEN enabled = 1 THEN 'ok' ELSE 'off' END, state_reason = NULL WHERE id = ?""",
                 (name, description, m.canonical(definition), m.definition_hash(definition), nv, principal.user_id, principal.user_id, now, rule_id))
    if changed:
        conn.execute("DELETE FROM scenario_leaf_state WHERE rule_id = ?", (rule_id,))  # the leaves changed: their hold / hysteresis state goes
    conn.execute("INSERT INTO scenario_versions(rule_id, version, definition_json, name, at, by_user) VALUES (?,?,?,?,?,?)",
                 (rule_id, nv, m.canonical(definition), name, now, principal.user_id))
    audit(conn, actor=principal, action="scenario.update", decision="allowed", resource_type="scenario", resource_id=rule_id, request_id=rid,
          details={"version": nv, "hash": m.definition_hash(definition), "definition_changed": changed})
    return view(conn, principal, _row(conn, rule_id))


def delete(conn: sqlite3.Connection, principal: Principal, rule_id: str, rid: str | None) -> None:
    r = _row(conn, rule_id)
    _, hidden = redact(conn, principal, json.loads(r["definition_json"]))
    if hidden:
        raise _validation([{"path": p, "code": "not_referenced", "message": TEXT["not_referenced"]} for p in sorted(hidden)])
    definition = json.loads(r["definition_json"])
    _clear_actions(conn, r, definition, "delete")
    for t in ("scenario_leaf_state", "scenario_runs", "scenario_versions"):
        conn.execute(f"DELETE FROM {t} WHERE rule_id = ?", (rule_id,))
    conn.execute("DELETE FROM scenario_rules WHERE id = ?", (rule_id,))
    audit(conn, actor=principal, action="scenario.delete", decision="allowed", resource_type="scenario", resource_id=rule_id, request_id=rid,
          details={"version": r["version"]})


def set_enabled(conn: sqlite3.Connection, principal: Principal, rule_id: str, on: bool, version: int, confirm: bool, rid: str | None) -> dict[str, Any]:
    _refuse_local(conn, principal, rid)
    r = _row(conn, rule_id)
    if r["version"] != version:
        raise _err(409, "version_conflict", {"version": r["version"]})
    definition = json.loads(r["definition_json"])
    if on:
        check(conn, principal, definition, rule_id)
        if not _tested_version(conn, r):
            raise _err(409, "test_required")
        tickets = [a for a in definition["actions"] if a["type"] == "create_service_request"]
        if tickets and not confirm:
            lim = limits_of(conn, definition)
            raise ApiError(409, "confirmation_required", TEXT["confirm_required"],
                           details={"departments": [a["department_id"] for a in tickets], "max_tickets_per_day": lim["tickets"]})
        # enabling makes the enabler the author whose rights are rechecked from now on
        conn.execute("UPDATE scenario_rules SET enabled = 1, state = 'ok', state_reason = NULL, state_since = ?, owner_user_id = ?, updated_at = ? WHERE id = ?",
                     (now_iso(), principal.user_id, now_iso(), rule_id))
    else:
        conn.execute("UPDATE scenario_rules SET enabled = 0, state = 'off', state_reason = NULL, state_since = ?, updated_at = ? WHERE id = ?", (now_iso(), now_iso(), rule_id))
        _clear_actions(conn, r, definition, "disable")
        conn.execute("DELETE FROM scenario_leaf_state WHERE rule_id = ?", (rule_id,))
    audit(conn, actor=principal, action="scenario.enable" if on else "scenario.disable", decision="allowed", resource_type="scenario", resource_id=rule_id,
          request_id=rid, details={"version": r["version"], "confirmed": bool(confirm)})
    return view(conn, principal, _row(conn, rule_id))


def reassign(conn: sqlite3.Connection, admin: Principal, rule_id: str, owner_user_id: str, rid: str | None) -> dict[str, Any]:
    r = _row(conn, rule_id)
    new_owner = _principal(conn, owner_user_id)
    if new_owner is None or not allowed(conn, new_owner, MANAGE):
        raise _err(422, "owner")
    definition = json.loads(r["definition_json"])
    v, errors = m.validate(definition, sig.CATALOGUE)
    if v is None:
        raise _validation(errors)
    probs = [p for p in reference_problems(conn, new_owner, v) if p["code"] != "tickets_off"]
    if probs:
        raise _validation(probs)
    conn.execute("UPDATE scenario_rules SET owner_user_id = ?, state = CASE WHEN enabled = 1 THEN 'ok' ELSE 'off' END, state_reason = NULL, state_since = ?, "
                 "updated_at = ? WHERE id = ?", (owner_user_id, now_iso(), now_iso(), rule_id))
    audit(conn, actor=admin, action="scenario.reassign", decision="allowed", resource_type="scenario", resource_id=rule_id, request_id=rid,
          details={"from": r["owner_user_id"], "to": owner_user_id})
    return view(conn, admin, _row(conn, rule_id))


def rate_test(conn: sqlite3.Connection, user_id: str) -> None:
    per_min = cfg.num(conn, "scenarios.test_per_min")
    t = time.monotonic()
    with _test_lock:
        hits = [h for h in _test_hits.get(user_id, []) if t - h < 60]
        if len(hits) >= per_min:
            raise ApiError(429, "rate_limited", TEXT["rate_limited"])
        hits.append(t)
        _test_hits[user_id] = hits


def test_rule(conn: sqlite3.Connection, principal: Principal, rule_id: str, overrides: Mapping[str, Any] | None, rid: str | None) -> dict[str, Any]:
    """The dry run of a saved rule: writes only a `test` run row (it marks the version as tested), performs no action."""
    r = _row(conn, rule_id)
    definition = json.loads(r["definition_json"])
    _, hidden = redact(conn, principal, definition)
    if hidden:
        raise _validation([{"path": p, "code": "not_referenced", "message": TEXT["not_referenced"]} for p in sorted(hidden)])
    res = dry_run(conn, principal, definition, rule_row=r, overrides=overrides)
    run_id = _write_run(conn, r, m.parse(res["at"]) or m.SystemClock().now(), "manual_test", "test", res["result"], res["snapshot"], [],
                        {"sentence": res["sentence"], "simulated": res["simulated"], "by": principal.user_id})
    audit(conn, actor=principal, action="scenario.test", decision="allowed", resource_type="scenario", resource_id=rule_id, request_id=rid,
          details={"version": r["version"], "result": res["result"], "simulated": res["simulated"]})
    return {**res, "run_id": run_id, "version": r["version"]}


def runs(conn: sqlite3.Connection, viewer: Principal, rule_id: str, limit: int = 50) -> list[dict[str, Any]]:
    r = _row(conn, rule_id)
    _, hidden = redact(conn, viewer, json.loads(r["definition_json"]))
    out = []
    for x in conn.execute("SELECT * FROM scenario_runs WHERE rule_id = ? ORDER BY at DESC, id DESC LIMIT ?", (rule_id, limit)).fetchall():
        snap = json.loads(x["snapshot_json"] or "{}")
        leaves = [({"path": s.get("path"), "redacted": True, "message": TEXT["redacted"]} if s.get("path") in hidden else s) for s in snap.get("leaves") or []]
        item = {"id": x["id"], "at": x["at"], "version": x["rule_version"], "trigger": x["trigger_kind"], "outcome": x["outcome"], "result": x["result"],
                "leaves": leaves, "reason": snap.get("reason"), "reason_text": REASON_HE.get(snap.get("reason") or "", ""),
                "actions": json.loads(x["actions_json"] or "[]")}
        item["sentence"] = None if hidden else snap.get("sentence")
        out.append(item)
    return out


def flags(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT name, value, set_by_rule, set_at FROM scenario_flags ORDER BY name").fetchall()]


def choices(conn: sqlite3.Connection, author: Principal) -> dict[str, Any]:
    """What the editor's pickers offer (names, never a raw id to type): active users, every role, and the service departments the author may
    open requests in (only while the service module is on)."""
    users = [{"id": r["id"], "name": r["display_name"] or r["username"] or r["id"]}
             for r in conn.execute("SELECT id, username, display_name FROM users WHERE active = 1 ORDER BY COALESCE(NULLIF(display_name, ''), username)").fetchall()]
    roles = [{"id": rid, "name": role_name(conn, rid)} for rid in all_roles(conn)]
    departments: list[dict[str, str]] = []
    if _tickets_on(conn):
        from .tickets import access, store

        viewer = access.Viewer(conn, author)
        departments = [{"id": d["id"], "name": d["name"]} for d in store.departments(conn, include_inactive=False) if viewer.can_create_in(d)]
    return {"users": users[:500], "roles": roles, "departments": departments}