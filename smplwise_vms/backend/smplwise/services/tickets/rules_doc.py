"""CR-038 phase 2 (TKRULES-291, docs/changes/CR-038-TKRULES-NOTES.md): the `tickets.rules` document - the installation's rules that
open a ticket from an alert. JSON in the `settings` table, revision-checked, edited with `system.configure` only (routers/tickets_rules.py).
NOT in routers/settings.DEFAULTS (so `GET /settings` never carries it) and kept out of project backups (backup.SETTINGS_KEEP).

Default = no rules, i.e. nothing happens. A stored document that no longer validates (a hand edit, an older / newer shape) reads rule by
rule: a rule that fails validation is served with `invalid: true` and is never acted on (fail safe); the engine reads the same answer.

Pure validation here (plus reads of the department / priority / category rows); no ticket is touched."""
from __future__ import annotations

import json
import re
import sqlite3
import string
from dataclasses import dataclass
from typing import Any

from ...db import new_id
from . import model, store

SETTING_KEY = "tickets.rules"
MAX_RULES = 50
DEFAULT_DAILY = 20
HARD_DAILY_MAX = 200  # the documented hard bound of a rule's tickets per local day (the default x 10; see the design note section 2)
HOLD_MAX_MIN = 1440
NAME_MAX = 80
TITLE_MAX = model.TITLE_MAX
DESCRIPTION_MAX = 2000
SUBJECT_MAX = 200
ON_CLEAR = ("comment", "comment_close")
PLACEHOLDERS = ("alert", "details", "place", "source", "since")
# never a trigger: the module's own sources (a ticket would raise a notification that opens a ticket), people's sessions and security
EXCLUDED_CATEGORIES = ("tickets", "security")
EXCLUDED_SUBJECTS = ("ticket", "rfq", "session")
_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")


class Invalid(Exception):
    """Field problems: [(field path, code)] - the router answers 422 `validation` with `details.fields`."""

    def __init__(self, problems: list[tuple[str, str]]):
        super().__init__(", ".join(f"{f}:{c}" for f, c in problems))
        self.problems = problems


@dataclass(frozen=True)
class SourceInfo:
    key: str
    label: str
    category: str
    subject: str


def allowed_sources() -> dict[str, SourceInfo]:
    """The catalogue sources a rule may listen to: they resolve by themselves (the clear has a meaning) and are not the module's own,
    a security / session source, or a ticket / RFQ subject."""
    from .. import notify_policy

    out: dict[str, SourceInfo] = {}
    for s in notify_policy.SOURCES:
        if not s.resolves or s.category in EXCLUDED_CATEGORIES or s.subject in EXCLUDED_SUBJECTS:
            continue
        out[s.key] = SourceInfo(s.key, s.label, s.category, s.subject)
    return out


def source_allowed(key: str) -> bool:
    return isinstance(key, str) and key in allowed_sources()


def _placeholders_ok(template: str) -> bool:
    try:
        for _lit, name, spec, conv in string.Formatter().parse(template):
            if name is None:
                continue
            if name not in PLACEHOLDERS or spec or conv:
                return False
    except ValueError:
        return False
    return True


def render(template: str, values: dict[str, str], *, multiline: bool, max_len: int) -> str:
    """A validated template with the alert's values (each cleaned first); unknown placeholders cannot reach here."""
    clean = {k: model.clean_text(values.get(k, "")) for k in PLACEHOLDERS}
    try:
        text = template.format_map(clean)
    except (ValueError, KeyError, IndexError):
        text = template
    text = model.clean_text(text, multiline=multiline)
    return text if len(text) <= max_len else text[: max_len - 1] + "…"


def _text(v: Any, field: str, *, required: bool, max_len: int, multiline: bool, problems: list[tuple[str, str]]) -> str:
    if v is None:
        v = ""
    if not isinstance(v, str):
        problems.append((field, "type"))
        return ""
    t = model.clean_text(v, multiline=multiline)
    if required and not t:
        problems.append((field, "required"))
    elif len(t) > max_len:
        problems.append((field, "too_long"))
    return t


def _limit(v: Any, field: str, problems: list[tuple[str, str]], *, nullable: bool) -> int | None:
    if v is None and nullable:
        return None
    if isinstance(v, bool) or not isinstance(v, int):
        problems.append((field, "integer"))
        return None
    if not 1 <= v <= HARD_DAILY_MAX:
        problems.append((field, "range"))
        return None
    return v


def validate_rule(conn: sqlite3.Connection, raw: Any, prefix: str = "rule") -> tuple[dict[str, Any], list[tuple[str, str]]]:
    """One rule, cleaned, and its problems (empty = valid). `id` is kept as sent; the caller decides new vs existing."""
    p: list[tuple[str, str]] = []
    if not isinstance(raw, dict):
        return {}, [(prefix, "type")]
    f = lambda name: f"{prefix}.{name}"  # noqa: E731 - the field path of a problem
    rid = raw.get("id")
    if rid is not None and (not isinstance(rid, str) or not _ID.match(rid)):
        p.append((f("id"), "invalid"))
        rid = None
    out: dict[str, Any] = {"id": rid}
    out["name"] = _text(raw.get("name"), f("name"), required=True, max_len=NAME_MAX, multiline=False, problems=p)
    enabled = raw.get("enabled", True)
    if not isinstance(enabled, bool):
        p.append((f("enabled"), "boolean"))
        enabled = False
    out["enabled"] = enabled
    src = raw.get("source")
    if not source_allowed(src):
        p.append((f("source"), "unknown"))
    out["source"] = src if isinstance(src, str) else ""
    out["subject_id"] = _text(raw.get("subject_id"), f("subject_id"), required=False, max_len=SUBJECT_MAX, multiline=False, problems=p)
    hold = raw.get("hold_min", 0)
    if isinstance(hold, bool) or not isinstance(hold, int) or not 0 <= hold <= HOLD_MAX_MIN:
        p.append((f("hold_min"), "range"))
        hold = 0
    out["hold_min"] = hold
    dept_id = raw.get("department_id")
    dept = store.department(conn, dept_id) if isinstance(dept_id, str) and dept_id else None
    if dept is None or not dept.get("active") or dept.get("deleted_at"):
        p.append((f("department_id"), "unknown"))
        dept = None
    out["department_id"] = dept_id if isinstance(dept_id, str) else ""
    pid = raw.get("priority_id")
    if pid in (None, ""):
        out["priority_id"] = None
    else:
        pr = store.priority(conn, pid) if isinstance(pid, str) else None
        if pr is None or not pr.get("active") or (dept is not None and pr["department_id"] != dept["id"]):
            p.append((f("priority_id"), "unknown"))
        out["priority_id"] = pid if isinstance(pid, str) else None
    cid = raw.get("category_id")
    if cid in (None, ""):
        out["category_id"] = None
    else:
        cat = store.category(conn, cid) if isinstance(cid, str) else None
        if cat is None or not cat.get("active") or (dept is not None and cat["department_id"] != dept["id"]):
            p.append((f("category_id"), "unknown"))
        out["category_id"] = cid if isinstance(cid, str) else None
    out["title"] = _text(raw.get("title"), f("title"), required=True, max_len=TITLE_MAX, multiline=False, problems=p)
    out["description"] = _text(raw.get("description"), f("description"), required=False, max_len=DESCRIPTION_MAX, multiline=True, problems=p)
    for k in ("title", "description"):
        if out[k] and not _placeholders_ok(out[k]):
            p.append((f(k), "placeholder"))
    on_clear = raw.get("on_clear", "comment")
    if on_clear not in ON_CLEAR:
        p.append((f("on_clear"), "choice"))
        on_clear = "comment"
    out["on_clear"] = on_clear
    out["daily_limit"] = _limit(raw.get("daily_limit"), f("daily_limit"), p, nullable=True)
    return out, p


def _stored(conn: sqlite3.Connection) -> dict[str, Any]:
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (SETTING_KEY,)).fetchone()
    try:
        doc = json.loads(row[0]) if row else {}
    except (ValueError, TypeError):
        doc = {}
    return doc if isinstance(doc, dict) else {}


def read(conn: sqlite3.Connection) -> dict[str, Any]:
    """The document as served and as the engine reads it: every stored rule re-validated (an invalid one carries `invalid: true` and its
    problem codes and is never acted on); a missing / broken top-level value reads as its default."""
    stored = _stored(conn)
    rev = stored.get("revision")
    enabled = stored.get("enabled")
    default = stored.get("daily_limit_default")
    out: dict[str, Any] = {
        "revision": rev if isinstance(rev, int) and not isinstance(rev, bool) and rev >= 0 else 0,
        "enabled": enabled if isinstance(enabled, bool) else True,
        "daily_limit_default": default if isinstance(default, int) and not isinstance(default, bool) and 1 <= default <= HARD_DAILY_MAX else DEFAULT_DAILY,
        "rules": [],
    }
    raw_rules = stored.get("rules") if isinstance(stored.get("rules"), list) else []
    for raw in raw_rules[:MAX_RULES]:
        rule, problems = validate_rule(conn, raw)
        if not rule.get("id"):
            continue  # a stored rule always has its id; one without is not addressable and is dropped from the answer
        if problems:
            rule["invalid"] = True
            rule["problems"] = sorted({c for _f, c in problems})
        out["rules"].append(rule)
    return out


def effective_limit(doc: dict[str, Any], rule: dict[str, Any]) -> int:
    v = rule.get("daily_limit")
    return v if isinstance(v, int) and not isinstance(v, bool) and 1 <= v <= HARD_DAILY_MAX else int(doc["daily_limit_default"])


def save(conn: sqlite3.Connection, body: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    """Validate a whole document (`enabled`, `daily_limit_default`, `rules`) and write it with the next revision. A rule id that is not
    in the current document gets a new id (a client cannot pick the dedupe key of another rule). Returns (the new document, the change
    summary for the audit: added / removed / changed rule ids and the top-level keys that changed). Raises Invalid."""
    current = read(conn)
    problems: list[tuple[str, str]] = []
    enabled = body.get("enabled", current["enabled"])
    if not isinstance(enabled, bool):
        problems.append(("enabled", "boolean"))
    default = _limit(body.get("daily_limit_default", current["daily_limit_default"]), "daily_limit_default", problems, nullable=False)
    rules_in = body.get("rules", [])
    if not isinstance(rules_in, list):
        raise Invalid([("rules", "type")])
    if len(rules_in) > MAX_RULES:
        raise Invalid([("rules", "too_many")])
    known = {r["id"] for r in current["rules"]}
    seen: set[str] = set()
    rules: list[dict[str, Any]] = []
    for i, raw in enumerate(rules_in):
        rule, rp = validate_rule(conn, raw, f"rules[{i}]")
        problems.extend(rp)
        if not rule:
            continue
        rid = rule.get("id")
        if not rid or rid not in known or rid in seen:
            rid = new_id()
        seen.add(rid)
        rule["id"] = rid
        rules.append(rule)
    if problems:
        raise Invalid(problems)
    before = {r["id"]: r for r in current["rules"]}
    after = {r["id"]: r for r in rules}
    changes: dict[str, Any] = {
        "added": sorted(set(after) - set(before)), "removed": sorted(set(before) - set(after)),
        "changed": {rid: sorted(k for k in after[rid] if before[rid].get(k) != after[rid].get(k) and k not in ("invalid", "problems"))
                    for rid in sorted(set(after) & set(before)) if any(before[rid].get(k) != after[rid].get(k) for k in after[rid])},
        "settings": [k for k, v in (("enabled", enabled), ("daily_limit_default", default)) if current[k] != v],
    }
    doc = {"revision": current["revision"] + 1, "enabled": enabled, "daily_limit_default": default, "rules": rules}
    conn.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                 (SETTING_KEY, json.dumps(doc, ensure_ascii=False, separators=(",", ":"))))
    return read(conn), changes
