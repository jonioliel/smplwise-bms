"""CR-READY96 slice 1: installation readiness - one score (0-100) and a checklist that says how complete and how safe an installation is.

    computed checks (measured here, read-only)  +  configured checks (a person attests, with name and time)
        -->  score = round(100 * sum(weight * fraction) / sum(weight))  over the APPLICABLE checks
        -->  level (building / almost / ready) + the hand-over ADVICE + the next steps ordered by the points they would add

Owner decisions of 2026-10-24 (docs/changes/CR-READY96.md, "Owner review 24.10 decisions"):
  * the hand-over threshold is ADVICE only - the installer may hand over earlier; nothing here ever blocks the attestation (it is recorded with
    `below_advice` and audited, so the hand-over report can say so);
  * every threshold and every weight is a setting (`readiness.*`, validated, audited), not a constant;
  * the page belongs to whoever configures the system (`system.configure` at the installation) - no other reader.

Nothing here writes to a device and nothing leaves the installation: the checks read this database, the backup folder and the cached health report
(`probe=False`, no network call). Slice 1 has no PDF report, no module checks beyond the tickets module and no technician-flag test (see the CR)."""
from __future__ import annotations

import datetime as dt
import json
import logging
import sqlite3
import zoneinfo
from typing import Any, Callable

from ..audit import audit
from ..config import Settings
from ..db import get_setting, set_setting
from ..errors import ApiError
from ..i18n import t
from . import readiness_text  # noqa: F401 - registers the report's texts (I18N-BACKEND-2490)
from . import values
from ..rbac import Principal
from .timeutil import iso_utc

log = logging.getLogger("smplwise.readiness")
UTC = dt.timezone.utc

PERMISSION = "system.configure"  # read, check, attest and edit the thresholds: the wizard's permission holders (owner decision, form Q7)

# status: ok | attention | blocked | pending | not_applicable
OK, ATTENTION, BLOCKED, PENDING, NOT_APPLICABLE = "ok", "attention", "blocked", "pending", "not_applicable"
LEVELS = ("building", "almost", "ready")
# I18N-BACKEND-2490: every user-visible text of the report is a `Msg` (services/readiness_text.py): its str value is the Hebrew the
# report always wrote (what the history, the fleet report and every background reader see); routers/readiness.py renders it in the
# requesting user's language.
LEVEL_TEXT = {level: t(f"readiness.level.{level}") for level in LEVELS}

# id -> (group, source, default weight, critical, title). The order is the order of the page.
CHECKS: dict[str, tuple[str, str, int, bool, str]] = {
    "cameras_connected": ("video", "computed", 12, True, t("readiness.title.cameras_connected")),
    "cameras_verified": ("video", "computed", 12, False, t("readiness.title.cameras_verified")),
    "places": ("map", "computed", 8, False, t("readiness.title.places")),
    "people": ("people", "computed", 10, True, t("readiness.title.people")),
    "notifications": ("notify", "computed", 10, False, t("readiness.title.notifications")),
    "backup": ("data", "computed", 12, True, t("readiness.title.backup")),
    "remote": ("access", "computed", 8, False, t("readiness.title.remote")),
    "time": ("system", "computed", 4, False, t("readiness.title.time")),
    "integrations": ("system", "computed", 10, False, t("readiness.title.integrations")),
    "modules": ("modules", "computed", 8, False, t("readiness.title.modules")),
    "handover": ("handover", "configured", 6, False, t("readiness.title.handover")),
}
CRITICAL = frozenset(k for k, v in CHECKS.items() if v[3])
HANDOVER = "handover"
CHECK_IDS: tuple[str, ...] = tuple(CHECKS)  # the closed id set other consumers may name (the fleet report's `readiness.missing`, READYFLEET-295)
NOT_DONE = (ATTENTION, BLOCKED, PENDING)     # an applicable check in one of these is "missing"


def _int_in(lo: int, hi: int) -> Callable[[str], bool]:
    return lambda v: v.isdigit() and lo <= int(v) <= hi


SETTINGS: dict[str, tuple[str, Callable[[str], bool]]] = {
    "readiness.advice_score": ("90", _int_in(1, 100)),         # the score from which hand-over is advised (advice only; never blocks)
    "readiness.band_almost_min": ("50", _int_in(1, 99)),        # the score from which the level is "almost" (below it: "building")
    "readiness.cameras_seen_hours": ("24", _int_in(1, 720)),    # a camera counts as verified when the system saw it this recently
    "readiness.backup_max_age_days": ("7", _int_in(1, 365)),    # the newest local backup must be younger than this
    "readiness.notify_days": ("30", _int_in(1, 365)),           # a channel counts as reachable after a delivery this recently
    "readiness.history_keep": ("200", _int_in(10, 2000)),       # score history rows kept
    **{f"readiness.weight.{cid}": (str(spec[2]), _int_in(0, 100)) for cid, spec in CHECKS.items()},
}


def setting(conn: sqlite3.Connection, key: str) -> str:
    return values.checked_setting(conn, SETTINGS, key)  # CR-BE-SMALL-UNIFY-2440 (review 04:F24): the shared reader over this module's registry


def settings_view(conn: sqlite3.Connection) -> dict[str, str]:
    return {k: setting(conn, k) for k in SETTINGS}


def _num(conn: sqlite3.Connection, key: str) -> int:
    return int(setting(conn, key))


def update_settings(conn: sqlite3.Connection, principal: Principal, changes: dict[str, Any], rid: str | None) -> dict[str, tuple[str, str]]:
    """Validate and store; {key: (before, after)} of what changed. Unknown key / bad value = 422; the "almost" band must stay below the advice score."""
    for key, value in changes.items():
        if key not in SETTINGS or not isinstance(value, str) or not SETTINGS[key][1](value):
            raise ApiError(422, "invalid_setting", t("readiness.invalid_setting"), details={"key": str(key)[:64]})
    merged = {**settings_view(conn), **changes}
    if int(merged["readiness.band_almost_min"]) >= int(merged["readiness.advice_score"]):
        raise ApiError(422, "invalid_setting", t("readiness.band_below_advice"), details={"key": "readiness.band_almost_min"})
    if all(int(merged[f"readiness.weight.{cid}"]) == 0 for cid in CHECKS):
        raise ApiError(422, "invalid_setting", t("readiness.one_weight"), details={"key": "readiness.weight"})
    out: dict[str, tuple[str, str]] = {}
    for key, value in changes.items():
        before = setting(conn, key)
        if before != value:
            set_setting(conn, key, value)
            out[key] = (before, value)
            audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="setting", resource_id=key, request_id=rid,
                  details={"key": key, "before": before, "after": value})
    return out


# ---------------------------------------------------------------- the checks

class Ctx:
    def __init__(self, conn: sqlite3.Connection, settings: Settings, now: dt.datetime) -> None:
        self.conn, self.settings, self.now = conn, settings, now
        self.t = {k: _num(conn, k) for k in SETTINGS if not k.startswith("readiness.weight.")}

    def ago(self, **kw: float) -> str:
        return iso_utc(self.now - dt.timedelta(**kw))


def _res(fraction: float | None, summary: str, facts: list[dict[str, Any]], next_: dict[str, str] | None, *, status: str | None = None) -> dict[str, Any]:
    """`fraction` None = not applicable."""
    return {"fraction": fraction, "summary": summary, "facts": facts, "next": next_, "status": status}


def _fact(label: str, value: str, ok: bool | None = None) -> dict[str, Any]:
    return {"label": label, "value": value, "ok": ok}


def _enabled_cameras(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute("SELECT id, status, last_seen_at FROM cameras WHERE enabled = 1").fetchall()


def _ha_only(c: Ctx) -> bool:
    from ..mode import is_ha_only

    try:
        return is_ha_only(c.settings)
    except Exception:  # noqa: BLE001 - a settings object without a recorder block (a test) is a full installation
        return False


def check_cameras_connected(c: Ctx) -> dict[str, Any]:
    cams = _enabled_cameras(c.conn)
    if not cams and _ha_only(c):
        return _res(None, t("readiness.cameras.nvrless"), [], None)
    online = sum(1 for r in cams if r["status"] == "online")
    nxt = {"label": t("readiness.next.wizard"), "href": "#/system/wizard"}
    if not cams:
        return _res(0.0, t("readiness.cameras.none_active"), [_fact(t("readiness.cameras.active"), "0", False)], nxt)
    return _res(online / len(cams), t("readiness.cameras.connected_summary", online=online, total=len(cams)),
                [_fact(t("readiness.cameras.connected"), f"{online}/{len(cams)}", online == len(cams))],
                None if online == len(cams) else nxt)


def check_cameras_verified(c: Ctx) -> dict[str, Any]:
    cams = _enabled_cameras(c.conn)
    if not cams and _ha_only(c):
        return _res(None, t("readiness.cameras.verified_nvrless"), [], None)
    cutoff = c.ago(hours=c.t["readiness.cameras_seen_hours"])
    seen = sum(1 for r in cams if r["last_seen_at"] and r["last_seen_at"] >= cutoff)
    nxt = {"label": t("readiness.next.wizard_cameras"), "href": "#/system/wizard"}
    if not cams:
        return _res(0.0, t("readiness.cameras.none_to_verify"), [], nxt)
    return _res(seen / len(cams), t("readiness.cameras.verified_summary", seen=seen, total=len(cams), hours=c.t['readiness.cameras_seen_hours']),
                [_fact(t("readiness.cameras.seen"), f"{seen}/{len(cams)}", seen == len(cams))], None if seen == len(cams) else nxt)


def check_places(c: Ctx) -> dict[str, Any]:
    floors = c.conn.execute("SELECT id FROM floors WHERE deleted_at IS NULL").fetchall()
    nxt = {"label": t("readiness.next.map"), "href": "#/explore/sites"}
    if not floors:
        return _res(0.0, t("readiness.places.no_floors"), [_fact(t("readiness.places.floors"), "0", False)], nxt)
    with_plan = c.conn.execute(
        "SELECT COUNT(DISTINCT v.floor_id) FROM plan_versions v JOIN floors f ON f.id = v.floor_id AND f.deleted_at IS NULL WHERE v.status = 'published'").fetchone()[0]
    parts = [with_plan / len(floors)]
    facts = [_fact(t("readiness.places.published"), f"{with_plan}/{len(floors)}", with_plan == len(floors))]
    cams = _enabled_cameras(c.conn)
    if cams:
        placed = c.conn.execute(
            "SELECT COUNT(DISTINCT a.resource_id) FROM map_anchors a JOIN cameras k ON k.id = a.resource_id AND k.enabled = 1 "
            "WHERE a.resource_type = 'camera' AND a.effective_to IS NULL").fetchone()[0]
        parts.append(placed / len(cams))
        facts.append(_fact(t("readiness.places.on_map"), f"{placed}/{len(cams)}", placed == len(cams)))
    f = sum(parts) / len(parts)
    tail = t("readiness.places.cameras_tail", placed=facts[1]['value']) if len(facts) > 1 else t("readiness.places.dot")
    return _res(f, t("readiness.places.summary", with_plan=with_plan, floors=len(floors), tail=tail), facts, None if f >= 1 else nxt)


def check_people(c: Ctx) -> dict[str, Any]:
    now = iso_utc(c.now)
    rows = c.conn.execute(
        "SELECT b.role_id, b.scope_type, b.subject_id FROM bindings b JOIN users u ON u.id = b.subject_id AND u.active = 1 "
        "WHERE b.subject_kind = 'user' AND b.effect = 'allow' AND b.revoked_at IS NULL AND (b.expires_at IS NULL OR b.expires_at > ?)", (now,)).fetchall()
    admins = {r["subject_id"] for r in rows if r["role_id"] == "system_admin" and r["scope_type"] == "installation"}
    others = {r["subject_id"] for r in rows if r["role_id"] != "system_admin"}
    f = 0.5 * bool(admins) + 0.5 * bool(others)
    nxt = {"label": t("readiness.next.access"), "href": "#/system/access"}
    return _res(f, t("readiness.people.summary", admins=len(admins), others=len(others)),
                [_fact(t("readiness.people.admin"), str(len(admins)), bool(admins)), _fact(t("readiness.people.with_role"), str(len(others)), bool(others))],
                None if f >= 1 else nxt)


def check_notifications(c: Ctx) -> dict[str, Any]:
    since = c.ago(days=c.t["readiness.notify_days"])
    try:
        subs = {r[0] for r in c.conn.execute("SELECT DISTINCT kind FROM push_subscriptions").fetchall()}
        recent = c.conn.execute("SELECT channel, status FROM notification_deliveries WHERE created_at >= ?", (since,)).fetchall()
    except sqlite3.OperationalError:
        subs, recent = set(), []
    attempted = {r["channel"] for r in recent if r["status"] != "skipped"}
    reached = {r["channel"] for r in recent if r["status"] == "sent"}
    configured = subs | attempted
    nxt = {"label": t("readiness.next.notifications"), "href": "#/system/notifications"}
    if not configured:
        return _res(0.0, t("readiness.notify.none"), [_fact(t("readiness.notify.channels"), "0", False)], nxt)
    f = len(reached & configured) / len(configured)
    return _res(f, t("readiness.notify.summary", reached=len(reached & configured), configured=len(configured), days=c.t['readiness.notify_days']),
                [_fact(t("readiness.notify.configured"), str(len(configured)), True), _fact(t("readiness.notify.reached"), str(len(reached & configured)), f >= 1)],
                None if f >= 1 else nxt)


def check_backup(c: Ctx) -> dict[str, Any]:
    from . import backup as backup_svc
    from . import backup_drill

    backups = [b for b in backup_svc.list_backups(c.settings) if b.get("valid")]
    newest = max((b["created_at"] for b in backups), default=None)
    young = bool(newest) and newest >= c.ago(days=c.t["readiness.backup_max_age_days"])
    sealed = any((b.get("sensitive") or {}).get("state") == "encrypted" for b in backups)
    last = backup_drill.read_last(c.settings)
    drill_ok = bool(last) and last.get("result") == "PASS"
    try:
        offbox = c.conn.execute(
            "SELECT 1 FROM backup_offbox_runs r JOIN backup_offbox_targets t ON t.id = r.target_id AND t.enabled = 1 WHERE r.ok = 1 AND r.verified = 1 LIMIT 1").fetchone() is not None
    except sqlite3.OperationalError:
        offbox = False
    def yes_no(ok: bool) -> Any:
        return t("readiness.yes") if ok else t("readiness.no")

    facts = [_fact(t("readiness.backup.local", days=c.t['readiness.backup_max_age_days']), yes_no(young), young),
             _fact(t("readiness.backup.sealed"), yes_no(sealed), sealed),
             _fact(t("readiness.backup.drill"), yes_no(drill_ok), drill_ok),
             _fact(t("readiness.backup.offbox"), yes_no(offbox), offbox)]
    f = sum(1 for x in facts if x["ok"]) / 4
    return _res(f, t("readiness.backup.summary", n=sum(1 for x in facts if x['ok'])), facts,
                None if f >= 1 else {"label": t("readiness.next.backup"), "href": "#/system/diagnostics?tab=backup"})


def check_remote(c: Ctx) -> dict[str, Any]:
    if not getattr(c.settings, "remote_access", False):
        return _res(None, t("readiness.remote.off"), [], None)
    mfa = (get_setting(c.conn, "remote.require_mfa_admin", "false") or "false") == "true"
    policy = get_setting(c.conn, "remote.policy", "flag") or "flag"
    f = 0.5 + 0.5 * mfa
    return _res(f, t("readiness.remote.summary", tail=t("readiness.remote.with_mfa") if mfa else t("readiness.remote.without_mfa")),
                [_fact(t("readiness.remote.policy"), policy, True), _fact(t("readiness.remote.mfa"), t("readiness.remote.required") if mfa else t("readiness.remote.not_required"), mfa)],
                None if mfa else {"label": t("readiness.next.security"), "href": "#/system/security"})


def check_time(c: Ctx) -> dict[str, Any]:
    tz = get_setting(c.conn, "time.zone", "") or ""
    try:
        zoneinfo.ZoneInfo(tz)
        valid = bool(tz)
    except Exception:  # noqa: BLE001 - an unknown zone name
        valid = False
    return _res(1.0 if valid else 0.0, t("readiness.time.summary", tz=tz) if valid else t("readiness.time.invalid"), [_fact(t("readiness.time.zone"), tz or "-", valid)],
                None if valid else {"label": t("readiness.next.general"), "href": "#/system/diagnostics"})


DOOR_MAP_NEXT = {"label": t("readiness.next.door_map"), "href": "#/system/setup"}  # the "שיוך דלתות" card (Settings › חיבורים)


def _doors_waiting(c: Ctx) -> dict[str, Any] | None:
    """UNLOCK-REASON-2370: intercom doors with no working door mapping. None = nothing waits. Read-only: it only counts and links; the
    administrator approves the suggestions on the door-map card, nothing here maps a door."""
    from . import intercom_doors

    try:
        waiting = intercom_doors.unmapped_summary(c.conn)
    except Exception:  # noqa: BLE001 - the door map must never take the readiness page down
        log.warning("readiness: door map summary unavailable", exc_info=True)
        return None
    if waiting["count"] <= 0:
        return None
    n, sug = waiting["count"], waiting["with_suggestion"]
    text = t("readiness.doors.all_suggested", n=sug) if sug == n else t("readiness.doors.some_suggested", n=n, sug=sug) if sug else t("readiness.doors.manual", n=n)
    return {"count": n, "with_suggestion": sug, "text": text}


def check_integrations(c: Ctx) -> dict[str, Any]:
    from . import health_report

    try:
        report = health_report.build(c.settings, c.conn, probe=False)
    except Exception:  # noqa: BLE001 - the health report must never take the readiness page down
        log.warning("readiness: health report unavailable", exc_info=True)
        return _res(0.0, t("readiness.integrations.no_report"), [], {"label": t("readiness.next.health"), "href": "#/system/diagnostics?tab=health"}, status=ATTENTION)
    wanted = [x for x in report.get("checks", []) if x["id"] in ("nvr", "go2rtc", "ha_sync", "bridge") and x["status"] != "off"]
    doors = _doors_waiting(c)  # an intercom door nobody can open is an unfinished connection: one more item, half credit while it waits
    if not wanted and doors is None:
        return _res(None, t("readiness.integrations.none"), [], None)
    health_score = sum(1.0 if x["status"] == "ok" else 0.5 if x["status"] == "warn" else 0.0 for x in wanted)
    total = len(wanted) + (1 if doors else 0)
    f = (health_score + (0.5 if doors else 0.0)) / total
    facts = [_fact(x["label"], x["status"], x["status"] == "ok") for x in wanted]
    if doors:
        facts.append(_fact(t("readiness.next.door_map"), doors["text"], False))
    summary = t("readiness.integrations.summary", ok=sum(1 for x in wanted if x['status'] == 'ok'), total=len(wanted)) if wanted else t("readiness.integrations.all_ok")
    if doors:
        summary = t("readiness.integrations.with_doors", summary=summary, doors=doors['text'])
    health_ok = all(x["status"] == "ok" for x in wanted)
    nxt = None if f >= 1 else DOOR_MAP_NEXT if (health_ok and doors) else {"label": t("readiness.next.health"), "href": "#/system/diagnostics?tab=health"}
    return _res(f, summary, facts, nxt)


def check_modules(c: Ctx) -> dict[str, Any]:
    from .tickets import access as tickets_access

    if not tickets_access.module_on(c.conn):
        return _res(None, t("readiness.modules.none"), [], None)
    n = c.conn.execute("SELECT COUNT(*) FROM ticket_departments WHERE active = 1").fetchone()[0]
    return _res(1.0 if n else 0.0, t("readiness.modules.departments", n=n) if n else t("readiness.modules.no_department"),
                [_fact(t("readiness.modules.departments_fact"), str(n), n > 0)],
                None if n else {"label": t("readiness.next.module_settings"), "href": "#/system/tickets?tab=departments"})


def check_handover(c: Ctx) -> dict[str, Any]:
    row = c.conn.execute("SELECT done, note, payload_json, user_id, updated_at FROM readiness_attestations WHERE check_id = ?", (HANDOVER,)).fetchone()
    if row is None or not row["done"]:
        return _res(0.0, t("readiness.handover.pending"), [], None, status=PENDING)
    payload = json.loads(row["payload_json"] or "{}")
    facts = [_fact(t("readiness.handover.recorded_fact"), row["updated_at"], True)]
    if payload.get("customer_name"):
        facts.append(_fact(t("readiness.handover.customer"), str(payload["customer_name"]), True))
    if payload.get("below_advice"):
        facts.append(_fact(t("readiness.handover.below_advice"), t("readiness.handover.score", score=payload.get('score_at')), False))
    return _res(1.0, t("readiness.handover.done"), facts, None)


FUNCS: dict[str, Callable[[Ctx], dict[str, Any]]] = {
    "cameras_connected": check_cameras_connected, "cameras_verified": check_cameras_verified, "places": check_places, "people": check_people,
    "notifications": check_notifications, "backup": check_backup, "remote": check_remote, "time": check_time, "integrations": check_integrations,
    "modules": check_modules, "handover": check_handover,
}


# ---------------------------------------------------------------- the report

def _status_of(cid: str, r: dict[str, Any]) -> str:
    if r["fraction"] is None:
        return NOT_APPLICABLE
    if r["status"]:
        return r["status"]
    if r["fraction"] >= 1.0:
        return OK
    return BLOCKED if cid in CRITICAL else ATTENTION


def level_of(conn: sqlite3.Connection, score: int) -> str:
    if score >= _num(conn, "readiness.advice_score"):
        return "ready"
    return "almost" if score >= _num(conn, "readiness.band_almost_min") else "building"


def evaluate(conn: sqlite3.Connection, settings: Settings, now: dt.datetime | None = None) -> dict[str, Any]:
    """The whole report, computed now. Pure read."""
    now = now or dt.datetime.now(UTC)
    ctx = Ctx(conn, settings, now)
    weights = {cid: _num(conn, f"readiness.weight.{cid}") for cid in CHECKS}
    checks: list[dict[str, Any]] = []
    for cid, (group, source, _w, critical, title) in CHECKS.items():
        try:
            r = FUNCS[cid](ctx)
        except Exception:  # noqa: BLE001 - one failing check never hides the others
            log.warning("readiness check %s failed", cid, exc_info=True)
            r = _res(0.0, t("readiness.check_failed"), [], None, status=ATTENTION)
        status = _status_of(cid, r)
        applicable = status != NOT_APPLICABLE and weights[cid] > 0
        checks.append({"id": cid, "group": group, "source": source, "title": title, "weight": weights[cid], "critical": critical, "status": status,
                       "fraction": None if r["fraction"] is None else round(r["fraction"], 4), "summary": r["summary"], "facts": r["facts"], "next": r["next"],
                       "applicable": applicable, "checked_at": iso_utc(now)})
    total = sum(x["weight"] for x in checks if x["applicable"])
    got = sum(x["weight"] * x["fraction"] for x in checks if x["applicable"])
    score = round(100 * got / total) if total else 0
    for x in checks:  # points this check would still add: its missing share of the whole
        x["gain"] = round(100 * x["weight"] * (1 - x["fraction"]) / total) if x["applicable"] and total and x["fraction"] is not None else 0
    advice = _num(conn, "readiness.advice_score")
    blockers = [x["id"] for x in checks if x["applicable"] and x["critical"] and x["fraction"] is not None and x["fraction"] < 1.0]
    nxt = sorted((x for x in checks if x["applicable"] and x["status"] in (ATTENTION, BLOCKED, PENDING) and x["next"]), key=lambda x: (-(1 - x["fraction"]) * x["weight"], x["id"]))
    handover = next((x for x in checks if x["id"] == HANDOVER), None)
    return {"score": score, "level": level_of(conn, score), "level_text": LEVEL_TEXT[level_of(conn, score)], "checks": checks, "checked_at": iso_utc(now),
            "handover": {"advice_score": advice, "advice_met": score >= advice and not blockers, "blockers": blockers, "may_hand_over": True,  # advice only: always allowed
                         "done": bool(handover and handover["status"] == OK)},
            "next_steps": [{"id": x["id"], "title": x["title"], "label": x["next"]["label"], "href": x["next"]["href"], "gain": x["gain"]} for x in nxt],
            "bands": {"almost_min": _num(conn, "readiness.band_almost_min"), "advice": advice}}


# ---------------------------------------------------------------- history and the handover attestation

def last_history(conn: sqlite3.Connection, limit: int = 20) -> list[dict[str, Any]]:
    return [{"at": r["at"], "score": r["score"], "level": r["level"], "blockers": json.loads(r["blockers_json"])}
            for r in conn.execute("SELECT * FROM readiness_history ORDER BY id DESC LIMIT ?", (limit,)).fetchall()]


def chip(conn: sqlite3.Connection) -> dict[str, Any] | None:
    """The cheap block for /me (system.configure holders): the last recorded score, never a computation."""
    r = conn.execute("SELECT score, level, at FROM readiness_history ORDER BY id DESC LIMIT 1").fetchone()
    return {"score": r["score"], "level": r["level"], "at": r["at"]} if r else None


def record(conn: sqlite3.Connection, report: dict[str, Any]) -> bool:
    """Write one history row when the score or any status changed since the last row. True = a row was written."""
    snap = {x["id"]: {"status": x["status"], "fraction": x["fraction"]} for x in report["checks"]}
    last = conn.execute("SELECT score, checks_json FROM readiness_history ORDER BY id DESC LIMIT 1").fetchone()
    if last is not None and last["score"] == report["score"] and json.loads(last["checks_json"]) == snap:
        return False
    conn.execute("INSERT INTO readiness_history(at, score, level, blockers_json, checks_json) VALUES (?,?,?,?,?)",
                 (report["checked_at"], report["score"], report["level"], json.dumps(report["handover"]["blockers"]), json.dumps(snap)))
    keep = _num(conn, "readiness.history_keep")
    conn.execute("DELETE FROM readiness_history WHERE id NOT IN (SELECT id FROM readiness_history ORDER BY id DESC LIMIT ?)", (keep,))
    return True


def attest(conn: sqlite3.Connection, settings: Settings, principal: Principal, check_id: str, done: bool, note: str, payload: dict[str, Any], rid: str | None) -> dict[str, Any]:
    """The installer records (or withdraws) the hand-over. Never refused for a low score: the advice is shown, the fact is recorded."""
    if check_id != HANDOVER:
        raise ApiError(404, "check_not_configurable", t("readiness.not_configurable"))
    before = evaluate(conn, settings)
    below = bool(done) and not before["handover"]["advice_met"]
    stored = {**payload, "below_advice": below, "score_at": before["score"], "blockers_at": before["handover"]["blockers"]} if done else {}
    stamp = iso_utc(dt.datetime.now(UTC))
    conn.execute("INSERT INTO readiness_attestations(check_id, done, note, payload_json, user_id, updated_at) VALUES (?,?,?,?,?,?) "
                 "ON CONFLICT(check_id) DO UPDATE SET done = excluded.done, note = excluded.note, payload_json = excluded.payload_json, user_id = excluded.user_id, updated_at = excluded.updated_at",
                 (check_id, int(bool(done)), note[:500], json.dumps(stored, ensure_ascii=False), principal.user_id, stamp))
    audit(conn, actor=principal, action="readiness.handover", decision="allowed", resource_type="installation", resource_id="*", request_id=rid,
          details={"done": bool(done), "score": before["score"], "below_advice": below, "blockers": before["handover"]["blockers"]})
    report = evaluate(conn, settings)
    record(conn, report)
    return report
