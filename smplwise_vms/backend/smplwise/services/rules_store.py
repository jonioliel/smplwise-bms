"""The SQL of the local rules router (routers/rules.py; CR-ROUTER-SQL-B-2450, review 05:P2-07): every statement the router ran inline,
moved here unchanged (same text, same arguments, same order of calls). The alert list keeps its builder (the caller's camera scope as a
WHERE fragment, the optional open-only filter). The router keeps the permission checks (it still decides the row scope and refuses a
caller with none), the validation and the audit; each function runs on the connection the route hands it. services/rules.py stays the
rule model and engine."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

Rows = list[sqlite3.Row]


# ---------------------------------------------------------------- rules

def rule(conn: sqlite3.Connection, rule_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM rules WHERE id = ?", (rule_id,)).fetchone()


def rules(conn: sqlite3.Connection) -> Rows:
    return conn.execute("SELECT * FROM rules ORDER BY created_at").fetchall()


def insert_rule(conn: sqlite3.Connection, cols: dict[str, Any], rule_id: str, uid: str, uname: str, now: str) -> None:
    """`cols` = RuleIn.columns() (name, description, enabled, owner, ha_automation_id, the JSON columns, cooldown_s); revision 1, the
    caller as creator and last editor."""
    conn.execute(
        "INSERT INTO rules(id, name, description, enabled, owner, ha_automation_id, trigger_json, scope_json, window_json, cooldown_s, actions_json, revision, created_by, created_by_username, updated_by, updated_by_username, created_at, updated_at) "
        "VALUES (:id, :name, :description, :enabled, :owner, :ha_automation_id, :trigger_json, :scope_json, :window_json, :cooldown_s, :actions_json, 1, :uid, :uname, :uid, :uname, :now, :now)",
        {**cols, "id": rule_id, "uid": uid, "uname": uname, "now": now},
    )


def update_rule(conn: sqlite3.Connection, rule_id: str, cols: dict[str, Any], uid: str, uname: str, now: str) -> None:
    """Every column from RulePatch.columns(); the revision moves."""
    conn.execute(
        "UPDATE rules SET name = :name, description = :description, enabled = :enabled, owner = :owner, ha_automation_id = :ha_automation_id, trigger_json = :trigger_json, scope_json = :scope_json, "
        "window_json = :window_json, cooldown_s = :cooldown_s, actions_json = :actions_json, revision = revision + 1, updated_by = :uid, updated_by_username = :uname, updated_at = :now WHERE id = :id",
        {**cols, "id": rule_id, "uid": uid, "uname": uname, "now": now},
    )


def delete_rule(conn: sqlite3.Connection, rule_id: str) -> None:
    """The rule's alerts first, then the rule (two statements, in this order)."""
    conn.execute("DELETE FROM rule_alerts WHERE rule_id = ?", (rule_id,))
    conn.execute("DELETE FROM rules WHERE id = ?", (rule_id,))


# ---------------------------------------------------------------- rule alerts

def alert_counts(conn: sqlite3.Connection) -> dict[str, tuple[int, int | None]]:
    """Per rule: (alerts, open alerts)."""
    return {r["rule_id"]: (r["n"], r["open"]) for r in conn.execute("SELECT rule_id, COUNT(*) AS n, SUM(CASE WHEN acked_at IS NULL THEN 1 ELSE 0 END) AS open FROM rule_alerts GROUP BY rule_id").fetchall()}


def alert_scope_clause(sc: Any) -> tuple[str, list[Any]]:
    """The caller's reach over rule_alerts as a WHERE fragment: a camera alert follows the camera scope, a camera-less
    one the installation-wide grant (T055 M3). Everything = no fragment."""
    if sc.everything:
        return "1 = 1", []
    parts: list[str] = []
    params: list[Any] = []
    cams = sc.cameras
    if cams.everything:
        parts.append("COALESCE(a.camera_id, '') <> ''")
    elif cams.ids:
        parts.append("a.camera_id IN (SELECT value FROM json_each(?))")
        params.append(json.dumps(sorted(cams.ids)))
    if sc.camera_less:
        parts.append("COALESCE(a.camera_id, '') = ''")
    return ("(" + " OR ".join(parts) + ")") if parts else "0 = 1", params


def alerts(conn: sqlite3.Connection, where: str, params: list[Any], unacked: bool, limit: int) -> Rows:
    """The alerts matching `where` (alert_scope_clause) with their rule's name, newest first; open ones only when `unacked`."""
    sql = f"SELECT a.*, r.name AS rule_name FROM rule_alerts a JOIN rules r ON r.id = a.rule_id WHERE {where}" + (" AND a.acked_at IS NULL" if unacked else "") + " ORDER BY a.fired_at DESC, a.occurred_at DESC LIMIT ?"
    return conn.execute(sql, (*params, limit)).fetchall()


def open_alert_count(conn: sqlite3.Connection, where: str, params: list[Any]) -> int:
    return conn.execute(f"SELECT COUNT(*) FROM rule_alerts a WHERE {where} AND a.acked_at IS NULL", params).fetchone()[0]


def alert(conn: sqlite3.Connection, alert_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM rule_alerts WHERE id = ?", (alert_id,)).fetchone()


def alert_with_rule_name(conn: sqlite3.Connection, alert_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT a.*, r.name AS rule_name FROM rule_alerts a JOIN rules r ON r.id = a.rule_id WHERE a.id = ?", (alert_id,)).fetchone()


def ack_alert(conn: sqlite3.Connection, alert_id: str, acked_at: str, acked_by: str, acked_by_username: str) -> None:
    conn.execute("UPDATE rule_alerts SET acked_at = ?, acked_by = ?, acked_by_username = ? WHERE id = ?", (acked_at, acked_by, acked_by_username, alert_id))
