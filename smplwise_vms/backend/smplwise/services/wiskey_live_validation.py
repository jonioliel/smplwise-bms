"""WISKEY-LIVE-VALIDATION-2390 (WisKey integration plan T16): the station acceptance tool ("בדיקת קבלה לעמדות").

One run checks one station or all of them, on demand only (nothing here runs by itself: no timer, no start-up hook). Per station,
in this order:

- `identity`, `door_capabilities`, `door_read` - WisKey's Native `live_validation` feature (WisKey 2.0.1-rc.10,
  `access/arx_validation_execution.py` ValidationCoordinator): ONE `features/start` per station through the existing direct
  `FeatureAdapters` (`DirectJoin.features_or_none`), with the closed private input `native_validation.v1` (owner go, checklist ref,
  ordered steps bound to the station's confirmed relay map), then `features/result` until the native receipt is finished. Read-only
  steps only: no `pulse`, no `video` / `two_way_audio` step (see "not used" below).
- `media_arx` - one still through Arx's own source (`LocalProvider`, go2rtc in-memory stream, by name).
- `media_wiskey` - one still through WisKey: the installed WisKey snapshot when `wiskey.auto_install` is on, else WisKey's W10
  descriptor + stream lease (`WiskeyBridgeProvider`, without its fallback to Arx's source - the point is to prove the WisKey path).
- `talk` - whether talk is available for this station right now, and why not (no talk session is opened, no microphone).
- `events` - the station's event stream as WisKey reports it (`health/get`, else the feed's technical copy) AND Arx's own feed.
- `clock` - the station clock's skew / drift state as WisKey measured it (tolerance CLOCK_TOLERANCE_S).

The optional door pulse (`run_pulse`) is a separate run: ONE momentary open of ONE mapped door through the same `live_validation`
feature (a single `pulse` step), never part of "run all", for a system administrator on a local session, after a typed
confirmation; WisKey's receipt says only that the command was acknowledged (`physical_result` / `human_witness` stay `unknown` on
WisKey's side), so the result waits for the witness's verdict (`record_witness`) before it can pass.

Results are honest, one of four per check: `pass`, `fail` (+ a reason code), `unsupported` (WisKey does not offer it), `not_run`
(+ why: a switch, no relay map, cancelled, an earlier step failed ...). A WisKey step whose outcome is unknown is a `fail`, never a
pass. Nothing is retried and no request id is sent twice (`wiskey_feature_intents`).

Not used, on purpose: the native validation `video` step needs `features/prepare_media` with ingress tickets for the
`live_validation` feature, which Arx's direct client does not build (it prepares media for `live_media` only); `two_way_audio` is a
microphone session. Both are WisKey-side gaps recorded in docs/changes/WISKEY-LIVE-VALIDATION-2390.md; the media checks above use
Arx's existing, already-reviewed paths instead.

Stored: services' tables `wiskey_validation_runs` / `wiskey_validation_results` (migration 0199): codes, numbers and times only -
never a frame, a source, an address, a serial number (WisKey's target `identity` is dropped on read), a credential or a token."""
from __future__ import annotations

import csv
import io
import json
import logging
import secrets
import sqlite3
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Iterable, Mapping

from ..rbac import Principal
from . import wiskey_feature_exec as fx

log = logging.getLogger("smplwise.wiskey.validation")

FEATURE = "live_validation"
KIND = "native_validation.v1"
WISKEY_CHECKS = ("identity", "door_capabilities", "door_read")
CHECKS = WISKEY_CHECKS + ("media_arx", "media_wiskey", "talk", "events", "clock")
PULSE = "pulse"
STATUSES = ("pending", "running", "pass", "fail", "unsupported", "not_run")
FINAL = frozenset({"pass", "fail", "unsupported", "not_run"})
RUN_STATES = ("running", "done", "cancelled", "interrupted")
WITNESS_VERDICTS = ("opened", "not_opened", "unsure")

# WisKey rc.10 arx_validation_execution.PERMISSIONS / OBSERVATIONS (read as data): what each step needs and what an acknowledged
# step's observation must be. An acknowledged step with any other observation is not a pass.
STEP_PERMISSION = {"identity": "validation/identity", "door_capabilities": "validation/door_capabilities",
                   "door_read": "validation/door_read", "pulse": "door/pulse"}
OBSERVATION = {"identity": {"identity_matched": True}, "door_capabilities": {"pulse_advertised": True},
               "door_read": {"configuration_read": True}, "pulse": {"command_acknowledged": True}}
RUN_PERMISSION = "validation/run"
# ValidationCoordinator.receipt() - the closed finished receipt; steps as the journal keeps them
RECEIPT_KEYS = frozenset({"original", "owner_go", "checklist_ref", "steps", "physical_result", "human_witness", "replay_available"})
STEP_KEYS = frozenset({"step_id", "action", "target", "phase", "observation"})
PHASES = frozenset({"prepared", "attempted", "acknowledged", "unknown", "aborted", "denied"})
# a closed WisKey refusal that means "this WisKey cannot run the feature here" (unsupported), not "the check failed"
UNSUPPORTED_CODES = frozenset({"unknown_command", "unknown_feature", "feature_disabled", "authenticated_current_source_not_installed",
                               "signed_feature_policy_not_current", "native_media_ingress_unavailable", "use_prepare_media"})

CLOCK_TOLERANCE_S = 2.0  # the station drawer's own "clock ok" line uses the same 2 s
RUN_TTL_S = 180  # the execution deadline of one station's validation operation (WisKey: deadline = the draft's expiry)
PULSE_TTL_S = 60
RESULT_WAIT_S = 60.0
POLL_GAP_S = 0.5
MAX_RUNS_LISTED = 30
REASON_MAX = 64

STATUS_TEXT = {"pending": "ממתין", "running": "בבדיקה", "pass": "עבר", "fail": "נכשל", "unsupported": "לא נתמך ב-WisKey", "not_run": "לא הורץ"}
CHECK_TEXT = {
    "identity": "זהות העמדה", "door_capabilities": "יכולות הדלת", "door_read": "קריאת הגדרות הדלת", "media_arx": "תמונה דרך Arx",
    "media_wiskey": "תמונה דרך WisKey", "talk": "זמינות דיבור", "events": "זרם אירועים", "clock": "סטיית שעון", "pulse": "פתיחת דלת עם עד",
}
# Hebrew reason lines (one source for the screen and the export); an unknown code is shown as itself
REASON_TEXT = {
    "relay_map_missing": "לעמדה אין שיוך דלתות מאושר, ולכן WisKey לא יכול לבדוק אותה. שייכו דלתות במסך שיוך דלתות.",
    "direct_join_off": "החיבור הישיר ל-WisKey כבוי (מקור הווידאו והדיבור במצב Arx, או שאין מפתח צימוד חותם).",
    "native_media_ingress_unavailable": "רכיב המדיה של WisKey אינו זמין.",
    "use_prepare_media": "WisKey דורש הכנת מדיה לצעד הזה.",
    "feature_disabled": "הבדיקה כבויה ב-WisKey.",
    "authenticated_current_source_not_installed": "רכיב ההרצה של WisKey אינו מותקן או אינו מחובר ל-Arx.",
    "signed_feature_policy_not_current": "המדיניות החתומה של WisKey אינה מעודכנת לבדיקה הזו.",
    "unknown_command": "WisKey אינו מכיר את הפקודה.",
    "unknown_feature": "WisKey אינו מכיר את הבדיקה.",
    "policy_incomplete": "ההרשאות ב-Arx אינן מאפשרות את הבדיקה (צריך ניהול עמדות ברמת ההתקנה).",
    "permission_missing": "חסרה הרשאה לאחד מצעדי הבדיקה.",
    "step_failed": "WisKey ניסה את הצעד והתוצאה לא אושרה.",
    "step_denied": "WisKey סירב לצעד.",
    "aborted_after_failure": "לא הורץ: צעד קודם נכשל, ו-WisKey עוצר את שאר הצעדים.",
    "observation_mismatch": "WisKey אישר את הצעד בלי התצפית הצפויה.",
    "result_unknown": "לא התקבלה תוצאה סופית מ-WisKey; התוצאה אינה ידועה.",
    "start_unknown": "לא ידוע אם WisKey קיבל את הבקשה.",
    "invalid_receipt": "התשובה של WisKey אינה בצורה המוכרת.",
    "cancelled": "הבדיקה בוטלה לפני הצעד הזה.",
    "interrupted": "השרת הופעל מחדש באמצע הבדיקה.",
    "offline": "העמדה מנותקת.",
    "no_camera": "לעמדה אין מצלמה.",
    "no_media": "שירות הווידאו של Arx אינו מוגדר.",
    "no_host": "כתובת העמדה אינה ידועה ל-Arx.",
    "no_credentials": "ל-Arx אין פרטי גישה לעמדה.",
    "frame_error": "לא התקבלה תמונה.",
    "empty_frame": "התקבלה תמונה ריקה.",
    "provider_local": "מקור הווידאו והדיבור מוגדר Arx, ולכן WisKey לא נבדק כאן.",
    "not_listed": "WisKey אינו מפרסם את פקודות המדיה בערוץ השירות.",
    "discovery_unknown": "רשימת הפקודות של WisKey עוד לא נקראה.",
    "api_incompatible": "גרסת החוזה של WisKey אינה תואמת.",
    "commands_unknown": "רשימת הפקודות של WisKey אינה קריאה.",
    "signing_not_ready": "מפתח הצימוד אינו יכול לחתום, ולכן הנתיב של WisKey כבוי.",
    "snapshot_not_ready": "WisKey לא החזיר תמונה.",
    "talk_setting_off": "דיבור כבוי בהגדרות (מדיה של עמדות).",
    "wiskey_talk_not_listed": "WisKey אינו מפרסם את פקודות הדיבור.",
    "talk_unsupported": "העמדה אינה מציעה דיבור.",
    "wiskey_fallback_local": "WisKey לא ענה, ו-Arx עבר למקור שלו (וידאו בלבד).",
    "forbidden": "אין לך הרשאת שיחה לעמדה.",
    "no_event_status": "WisKey לא מסר את מצב זרם האירועים.",
    "stream_connected": "מחובר.",
    "stream_connecting": "זרם האירועים מתחבר.",
    "stream_disconnected": "זרם האירועים מנותק.",
    "stream_unavailable": "זרם האירועים אינו זמין.",
    "stream_stopped": "זרם האירועים עצור.",
    "stream_authentication_failed": "העמדה דחתה את פרטי הגישה של WisKey.",
    "stream_unknown": "מצב זרם האירועים אינו ידוע.",
    "arx_feed_not_ready": "WisKey מחובר לעמדה, אבל ערוץ העדכונים של Arx מ-WisKey אינו פעיל.",
    "no_clock": "WisKey לא מסר את מצב השעון של העמדה.",
    "clock_unavailable": "WisKey לא הצליח לקרוא את שעון העמדה.",
    "not_measured": "סטיית השעון עוד לא נמדדה.",
    "skew_over_tolerance": "שעון העמדה סוטה מעבר ל-2 שניות.",
    "drift_ahead": "שעון העמדה מקדים.",
    "drift_behind": "שעון העמדה מאחר.",
    "drift_repeated_ahead": "שעון העמדה מקדים שוב ושוב.",
    "drift_repeated_behind": "שעון העמדה מאחר שוב ושוב.",
    "probe_error": "הבדיקה נכשלה בתוך Arx.",
    "awaiting_witness": "WisKey אישר את שליחת הפקודה; ממתין לאישור העד.",
    "witness_not_opened": "העד דיווח שהדלת לא נפתחה.",
    "witness_unsure": "העד לא בטוח שהדלת נפתחה.",
    "witness_opened": "העד אישר שהדלת נפתחה.",
    "door_not_mapped": "הדלת שנבחרה אינה משויכת לעמדה.",
    "not_reached": "הבדיקה הסתיימה לפני הצעד הזה.",
    "no_video_profile": "WisKey לא הציע פרופיל וידאו לעמדה.",
}


class ValidationError(Exception):
    """A refusal of the API surface (`code` is served, `status` is the HTTP status)."""

    def __init__(self, code: str, status: int = 409, text: str = "") -> None:
        super().__init__(code)
        self.code = code
        self.status = status
        self.text = text


@dataclass(frozen=True)
class Outcome:
    status: str
    reason: str | None = None
    detail: Mapping[str, Any] = field(default_factory=dict)


def passed(detail: Mapping[str, Any] | None = None, reason: str | None = None) -> Outcome:
    return Outcome("pass", reason, dict(detail or {}))


def failed(reason: str, detail: Mapping[str, Any] | None = None) -> Outcome:
    return Outcome("fail", _code(reason), dict(detail or {}))


def unsupported(reason: str, detail: Mapping[str, Any] | None = None) -> Outcome:
    return Outcome("unsupported", _code(reason), dict(detail or {}))


def not_run(reason: str, detail: Mapping[str, Any] | None = None) -> Outcome:
    return Outcome("not_run", _code(reason), dict(detail or {}))


def _code(value: Any) -> str:
    text = str(value or "unknown")
    clean = "".join(c if (c.isascii() and (c.isalnum() or c in "_.:-")) else "_" for c in text)
    return clean[:REASON_MAX] or "unknown"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime | None = None) -> str:
    from .timeutil import iso_utc  # CR-TIMEUTIL-2436 (04:F14): same text

    return iso_utc(value or _now())


def _canonical(value: datetime) -> str:
    """WisKey's `expiry_intent` canonical form (`isoformat`, seconds, +00:00): the draft and the owner go carry the same string."""
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat(timespec="seconds")


def new_run_id() -> str:
    return "lv_" + secrets.token_hex(16)


def reason_text(code: str | None) -> str | None:
    if code is None:
        return None
    return REASON_TEXT.get(code, code)


# ---------------------------------------------------------------- the stored runs

def create_run(conn: sqlite3.Connection, *, kind: str, scope: str, stations: Iterable[tuple[str, str]], actor: Principal,
               parent_run_id: str | None = None, checks: Iterable[str] = CHECKS, run_id: str | None = None) -> str:
    rid = run_id or new_run_id()
    stations = list(stations)
    at = _iso()
    conn.execute("INSERT INTO wiskey_validation_runs (id, kind, scope, parent_run_id, state, created_by, created_by_name, created_at, station_count) "
                 "VALUES (?,?,?,?, 'running', ?,?,?,?)",
                 (rid, kind, scope, parent_run_id, actor.user_id, (actor.display_name or actor.username or "")[:120] or None, at, len(stations)))
    checks = tuple(checks)
    for sid, name in stations:
        for seq, check in enumerate(checks):
            conn.execute("INSERT INTO wiskey_validation_results (run_id, station_id, station_name, seq, check_key, status) VALUES (?,?,?,?,?, 'pending')",
                         (rid, sid, (name or "")[:200] or None, seq, check))
    return rid


def mark_running(conn: sqlite3.Connection, run_id: str, station_id: str, checks: Iterable[str]) -> None:
    at = _iso()
    for check in checks:
        conn.execute("UPDATE wiskey_validation_results SET status='running', started_at=? WHERE run_id=? AND station_id=? AND check_key=? AND status='pending'",
                     (at, run_id, station_id, check))


def save_outcome(conn: sqlite3.Connection, run_id: str, station_id: str, check: str, outcome: Outcome) -> None:
    if outcome.status not in STATUSES:
        raise ValueError("invalid status")
    detail = json.dumps(_clean_detail(outcome.detail), ensure_ascii=False, sort_keys=True) if outcome.detail else None
    at = _iso()
    final = outcome.status in FINAL
    conn.execute("UPDATE wiskey_validation_results SET status=?, reason=?, detail_json=?, started_at=COALESCE(started_at, ?), finished_at=? "
                 "WHERE run_id=? AND station_id=? AND check_key=?",
                 (outcome.status, outcome.reason, detail, at, at if final else None, run_id, station_id, check))


def _clean_detail(detail: Mapping[str, Any]) -> dict[str, Any]:
    """Codes, numbers, booleans, short strings and small lists of those: a detail never carries a frame, a source or a long text."""
    out: dict[str, Any] = {}
    for key, value in list(detail.items())[:16]:
        if not isinstance(key, str) or len(key) > 40:
            continue
        if value is None or isinstance(value, (bool, int, float)):
            out[key] = value
        elif isinstance(value, str):
            out[key] = value[:120]
        elif isinstance(value, (list, tuple)):
            out[key] = [_clean_detail(v) if isinstance(v, Mapping) else (v[:120] if isinstance(v, str) else v)
                        for v in list(value)[:8] if v is None or isinstance(v, (bool, int, float, str, Mapping))]
        elif isinstance(value, Mapping):
            out[key] = _clean_detail(value)
    return out


def finish_run(conn: sqlite3.Connection, run_id: str, state: str, reason: str | None = None) -> None:
    """Close a run; whatever never reached a result is `not_run` with the run's reason (cancelled / interrupted)."""
    if state not in RUN_STATES or state == "running":
        raise ValueError("invalid run state")
    left = reason or ("cancelled" if state == "cancelled" else "interrupted" if state == "interrupted" else "not_reached")
    at = _iso()
    conn.execute("UPDATE wiskey_validation_results SET status='not_run', reason=?, finished_at=? WHERE run_id=? AND status IN ('pending','running') "
                 "AND NOT (check_key='pulse' AND reason='awaiting_witness')", (left, at, run_id))
    conn.execute("UPDATE wiskey_validation_runs SET state=?, finished_at=? WHERE id=? AND state='running'", (state, at, run_id))


def cancel_requested(conn: sqlite3.Connection, run_id: str) -> bool:
    r = conn.execute("SELECT cancel_requested FROM wiskey_validation_runs WHERE id=?", (run_id,)).fetchone()
    return bool(r and r[0])


def request_cancel(conn: sqlite3.Connection, run_id: str) -> bool:
    return conn.execute("UPDATE wiskey_validation_runs SET cancel_requested=1 WHERE id=? AND state='running' AND kind='checks'", (run_id,)).rowcount == 1


def reconcile_db(db: Any) -> int:
    """A run still `running` that no worker of THIS process owns was cut by a restart: `interrupted`, its open checks `not_run`.
    Never resumed (nothing runs by itself). Reads first; takes the write lock only when there is something to close."""
    with db.connection(mode="read", label="wiskey validation reconcile") as conn:
        rows = [r[0] for r in conn.execute("SELECT id FROM wiskey_validation_runs WHERE state='running' AND kind='checks'").fetchall()]
    if not rows:
        return 0
    with _LOCK:
        live = set(_ACTIVE)
    stale = [rid for rid in rows if rid not in live]
    if stale:
        with db.connection(label="wiskey validation reconcile") as conn:
            for rid in stale:
                finish_run(conn, rid, "interrupted")
    return len(stale)


def _row_dict(r: sqlite3.Row | tuple, cols: list[str]) -> dict[str, Any]:
    return {c: r[i] for i, c in enumerate(cols)}


RUN_COLS = ["id", "kind", "scope", "parent_run_id", "state", "created_by", "created_by_name", "created_at", "finished_at", "cancel_requested", "station_count"]
RESULT_COLS = ["station_id", "station_name", "seq", "check_key", "status", "reason", "detail_json", "started_at", "finished_at"]


def _counts(results: list[dict[str, Any]]) -> dict[str, int]:
    out = {s: 0 for s in STATUSES}
    for r in results:
        out[r["status"]] = out.get(r["status"], 0) + 1
    return out


def _public_result(r: dict[str, Any]) -> dict[str, Any]:
    detail = json.loads(r["detail_json"]) if r.get("detail_json") else {}
    return {"check": r["check_key"], "label": CHECK_TEXT.get(r["check_key"], r["check_key"]), "status": r["status"],
            "status_text": STATUS_TEXT.get(r["status"], r["status"]), "reason": r["reason"], "reason_text": reason_text(r["reason"]),
            "detail": detail, "started_at": r["started_at"], "finished_at": r["finished_at"]}


def run_view(conn: sqlite3.Connection, run_id: str, *, visible: Callable[[str], bool] | None = None) -> dict[str, Any] | None:
    """One run with its stations and checks (only the stations `visible` allows), its counts and its pulse runs."""
    r = conn.execute(f"SELECT {', '.join(RUN_COLS)} FROM wiskey_validation_runs WHERE id=?", (run_id,)).fetchone()
    if r is None:
        return None
    run = _row_dict(r, RUN_COLS)
    rows = [_row_dict(x, RESULT_COLS) for x in conn.execute(
        f"SELECT {', '.join(RESULT_COLS)} FROM wiskey_validation_results WHERE run_id=? ORDER BY rowid", (run_id,)).fetchall()]
    rows = [x for x in rows if visible is None or visible(x["station_id"])]
    stations: dict[str, dict[str, Any]] = {}
    for x in rows:
        st = stations.setdefault(x["station_id"], {"station_id": x["station_id"], "name": x["station_name"], "checks": []})
        st["checks"].append(_public_result(x))
    for st in stations.values():
        st["counts"] = _counts([{"status": c["status"]} for c in st["checks"]])
        done = sum(1 for c in st["checks"] if c["status"] in FINAL)
        st["progress"] = {"done": done, "total": len(st["checks"])}
    pulses = []
    if run["kind"] == "checks":
        for (pid,) in conn.execute("SELECT id FROM wiskey_validation_runs WHERE parent_run_id=? AND kind='pulse' ORDER BY created_at", (run_id,)).fetchall():
            p = run_view(conn, pid, visible=visible)
            if p is not None and p["stations"]:
                pulses.append(p)
    total = sum(len(s["checks"]) for s in stations.values())
    done = sum(s["progress"]["done"] for s in stations.values())
    return {**{k: run[k] for k in ("id", "kind", "scope", "parent_run_id", "state", "created_by", "created_by_name", "created_at", "finished_at")},
            "cancel_requested": bool(run["cancel_requested"]), "station_count": run["station_count"], "stations": list(stations.values()),
            "counts": _counts(rows), "progress": {"done": done, "total": total}, "pulses": pulses}


def list_runs(conn: sqlite3.Connection, limit: int = MAX_RUNS_LISTED) -> list[dict[str, Any]]:
    rows = conn.execute(f"SELECT {', '.join(RUN_COLS)} FROM wiskey_validation_runs WHERE kind='checks' ORDER BY created_at DESC, rowid DESC LIMIT ?",
                        (max(1, min(limit, 200)),)).fetchall()
    out = []
    for r in rows:
        run = _row_dict(r, RUN_COLS)
        counts = {s: 0 for s in STATUSES}
        for status, n in conn.execute("SELECT status, COUNT(*) FROM wiskey_validation_results WHERE run_id=? GROUP BY status", (run["id"],)).fetchall():
            counts[status] = n
        out.append({k: run[k] for k in ("id", "scope", "state", "created_by_name", "created_at", "finished_at", "station_count")} | {"counts": counts})
    return out


def export_csv(view: Mapping[str, Any]) -> str:
    """The installer's acceptance record of one run (and its pulses): one row per station and check. UTF-8 with a BOM (Excel)."""
    buf = io.StringIO()
    buf.write("﻿")
    w = csv.writer(buf, lineterminator="\r\n")
    w.writerow(["ריצה", "התחלה (UTC)", "סיום (UTC)", "הורץ על ידי", "עמדה", "מזהה עמדה", "בדיקה", "תוצאה", "קוד סיבה", "סיבה", "פרטים", "נבדק ב (UTC)"])

    def rows(run: Mapping[str, Any]) -> None:
        for st in run["stations"]:
            for c in st["checks"]:
                w.writerow([_safe_cell(run["id"]), run["created_at"], run["finished_at"] or "", _safe_cell(run["created_by_name"] or ""),
                            _safe_cell(st["name"] or ""), _safe_cell(st["station_id"]), c["label"], c["status_text"], c["reason"] or "",
                            _safe_cell(c["reason_text"] or ""), _safe_cell(_detail_text(c["detail"])), c["finished_at"] or ""])

    rows(view)
    for p in view.get("pulses") or []:
        rows(p)
    return buf.getvalue()


def _safe_cell(value: str) -> str:
    """A cell never starts a spreadsheet formula (CSV injection)."""
    text = str(value)
    return "'" + text if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


def _detail_text(detail: Mapping[str, Any]) -> str:
    parts = []
    for k, v in detail.items():
        if isinstance(v, (list, dict)):
            v = json.dumps(v, ensure_ascii=False, sort_keys=True)
        parts.append(f"{k}={v}")
    return "; ".join(parts)[:400]


# ---------------------------------------------------------------- WisKey's live_validation (the three native read steps, the pulse)

@dataclass(frozen=True)
class Door:
    api_relay: int
    physical_relay: int
    revision: int


def mapped_doors(conn: sqlite3.Connection, station_id: str) -> list[Door]:
    """The station's ACTIVE confirmed relay map rows (WisKey binds every step to station, physical relay and mapping revision). A
    physical relay named by two active rows is ambiguous and left out (WisKey refuses a duplicate physical relay too)."""
    rows = conn.execute("SELECT api_relay, physical_relay, revision FROM wiskey_relay_map WHERE station_id=? AND active=1 ORDER BY physical_relay, api_relay",
                        (station_id,)).fetchall()
    seen: dict[int, int] = {}
    for _api, physical, _rev in rows:
        seen[physical] = seen.get(physical, 0) + 1
    return [Door(api, physical, rev) for api, physical, rev in rows if seen[physical] == 1]


@dataclass
class WiskeyRun:
    """What one native `live_validation` operation answered, per step id (phase + observation), or one outcome for all steps."""

    phases: dict[str, tuple[str, Any]] = field(default_factory=dict)
    whole: Outcome | None = None
    operation_ref: str | None = None
    request_id: str | None = None


def read_receipt(receipt: Any) -> dict[str, tuple[str, Any]]:
    """The closed ValidationCoordinator receipt -> {step_id: (phase, observation)}. WisKey's target `identity` (a device identity)
    is never read out. Raises ValueError for any other shape."""
    if not isinstance(receipt, Mapping) or set(receipt) != RECEIPT_KEYS:
        raise ValueError("receipt_shape")
    if receipt.get("physical_result") != "unknown" or receipt.get("human_witness") != "unknown" or receipt.get("replay_available") is not False:
        raise ValueError("receipt_claims")
    steps = receipt.get("steps")
    if not isinstance(steps, list) or not 1 <= len(steps) <= 64:
        raise ValueError("receipt_steps")
    out: dict[str, tuple[str, Any]] = {}
    for s in steps:
        if not isinstance(s, Mapping) or not (STEP_KEYS <= set(s) <= STEP_KEYS | {"media"}):
            raise ValueError("receipt_step")
        if s.get("phase") not in PHASES or not isinstance(s.get("step_id"), str) or s["step_id"] in out:
            raise ValueError("receipt_step")
        out[s["step_id"]] = (s["phase"], s.get("observation"))
    return out


def run_native(conn: sqlite3.Connection, features: Any, *, principal: Principal, run_id: str, station_id: str,
               steps: list[tuple[str, str, Door]], required: Iterable[str], ttl_s: int, now: datetime | None = None,
               sleep: Callable[[float], None] = time.sleep, monotonic: Callable[[], float] = time.monotonic,
               wait_s: float = RESULT_WAIT_S) -> WiskeyRun:
    """ONE `live_validation` operation: the request + current policy + snapshot (Arx RBAC, the confirmed relay map), the durable
    intent committed before the start, then completion reads until finished or `wait_s`. `steps` = (step_id, action, door)."""
    from ..db import permission_revision
    from .wiskey_capture_port import PortError
    from .wiskey_feature_direct import FeatureWireError, _commit

    now = now or _now()
    expiry = (now + timedelta(seconds=ttl_s)).replace(microsecond=0)  # the draft, the owner go and the deadline name the same instant
    expiry_s = _canonical(expiry)
    revision = permission_revision(conn)
    ref = run_id[-24:]
    checklist_ref, go_ref = f"lv-chk:{ref}:{station_id}"[:128], f"lv-go:{ref}:{station_id}"[:128]
    private = {"kind": KIND,
               "owner_go": {"reference": go_ref, "owner_user_id": principal.user_id, "authority_revision": revision, "approved": True, "expiry": expiry_s},
               "checklist_ref": checklist_ref,
               "steps": [{"step_id": sid, "action": action, "station_id": station_id, "physical_relay": d.physical_relay, "mapping_revision": d.revision}
                         for sid, action, d in steps]}
    targets = sorted({(station_id, d.api_relay) for _sid, _a, d in steps})
    try:
        body, snapshot = features.prepare(
            conn, feature=FEATURE, actor=fx.human_actor(principal.user_id), principals=[principal], authority_ref="arx-permissions",
            authority_revision=revision, scope_ref=f"lv:{ref}:{station_id}"[:128], parameter_reference=run_id,
            params={"checklist_ref": checklist_ref, "owner_go_ref": go_ref, "expiry": expiry_s}, now=now, source_epoch=str(revision),
            actor_session_active=True, targets=targets, private_input=private, execution_expires_at=expiry)
    except FeatureWireError as exc:
        return WiskeyRun(whole=not_run(exc.code))
    except fx.FeatureError as exc:
        return WiskeyRun(whole=not_run(exc.code))
    except PortError as exc:  # the port's identity: no selected / connected direct link - nothing was stored or sent
        return WiskeyRun(whole=not_run("direct_join_off" if exc.outcome == "not_sent" else exc.code))
    granted = set(snapshot.get("permissions") or ())
    missing = sorted(set(required) - granted)
    if missing:
        return WiskeyRun(whole=not_run("permission_missing", {"missing": missing}))
    if {(s["station_id"], s["physical_relay"], s["mapping_revision"]) for s in snapshot.get("stations") or []} != \
            {(station_id, d.physical_relay, d.revision) for _sid, _a, d in steps}:
        return WiskeyRun(whole=not_run("relay_map_missing"))
    try:
        started = features.start(conn, body, snapshot)
    except FeatureWireError as exc:
        return WiskeyRun(whole=_start_refusal(exc.outcome, exc.code))
    except fx.FeatureError as exc:  # duplicate: one attempt only
        return WiskeyRun(whole=not_run(exc.code))
    if started.state == "not_sent":
        return WiskeyRun(whole=not_run("direct_join_off" if started.code in (None, "wiskey_direct_not_connected") else started.code))
    if started.state == "refused":
        return WiskeyRun(whole=_start_refusal("refused", started.code or "refused"), request_id=body["request_id"])
    if started.state != "admitted" or not started.operation_ref:
        return WiskeyRun(whole=failed("start_unknown"), request_id=body["request_id"])
    op = started.operation_ref
    deadline = monotonic() + wait_s
    while True:
        try:
            res = features.client.result(op)
        except FeatureWireError:
            res = None
        if res is not None and res.state != "running":
            break
        if monotonic() + POLL_GAP_S > deadline:
            return WiskeyRun(whole=failed("result_unknown", {"state": "running" if res is not None else "no_answer"}), operation_ref=op,
                             request_id=body["request_id"])
        sleep(POLL_GAP_S)
    if res.state != "finished":
        fx.settle_feature(conn, body["request_id"], "unknown", "receipt_unknown")
        _commit(conn)
        return WiskeyRun(whole=failed("result_unknown", {"state": res.state}), operation_ref=op, request_id=body["request_id"])
    try:
        phases = read_receipt(res.receipt)
    except ValueError:
        fx.settle_feature(conn, body["request_id"], "unknown", "receipt_invalid")
        _commit(conn)
        return WiskeyRun(whole=failed("invalid_receipt"), operation_ref=op, request_id=body["request_id"])
    if set(phases) != {sid for sid, _a, _d in steps}:
        fx.settle_feature(conn, body["request_id"], "unknown", "receipt_steps")
        _commit(conn)
        return WiskeyRun(whole=failed("invalid_receipt"), operation_ref=op, request_id=body["request_id"])
    all_ack = all(p == "acknowledged" for p, _o in phases.values())
    fx.settle_feature(conn, body["request_id"], "accepted" if all_ack else "unknown", "acknowledged" if all_ack else "steps_not_acknowledged")
    _commit(conn)
    return WiskeyRun(phases=phases, operation_ref=op, request_id=body["request_id"])


def _start_refusal(outcome: str, code: str) -> Outcome:
    if outcome == "not_sent":
        return not_run("direct_join_off" if code == "wiskey_direct_not_connected" else code)
    if outcome == "unknown":
        return failed("start_unknown")
    return unsupported(code) if code in UNSUPPORTED_CODES else failed(code)


def step_outcome(action: str, phase: str, observation: Any) -> Outcome:
    if phase == "acknowledged":
        return passed() if observation == OBSERVATION.get(action) else failed("observation_mismatch")
    if phase == "unknown":
        return failed("step_failed")
    if phase == "denied":
        return failed("step_denied")
    if phase == "aborted":
        return not_run("aborted_after_failure")
    return failed("result_unknown", {"phase": phase})


def native_checks(conn: sqlite3.Connection, features: Any, *, principal: Principal, run_id: str, station_id: str, **kw: Any) -> dict[str, Outcome]:
    """identity / door_capabilities / door_read of one station. Steps: identity on the first mapped door, then per door its
    capabilities and its configuration read (every mapped door is a target WisKey requires a step for). WisKey's `features/status`
    is NOT read first (WisKey T06: a static availability flag proves nothing; tests/test_t06_work_states_297.py): the start itself
    answers, and a host that cannot run the feature refuses it with a closed code (`unsupported`)."""
    doors = mapped_doors(conn, station_id)
    if not doors:
        return {c: not_run("relay_map_missing") for c in WISKEY_CHECKS}
    if features is None:
        return {c: not_run("direct_join_off") for c in WISKEY_CHECKS}
    steps: list[tuple[str, str, Door]] = [("identity", "identity", doors[0])]
    for d in doors:
        steps.append((f"door_capabilities-{d.physical_relay}", "door_capabilities", d))
        steps.append((f"door_read-{d.physical_relay}", "door_read", d))
    required = {RUN_PERMISSION} | {STEP_PERMISSION[a] for _s, a, _d in steps}
    result = run_native(conn, features, principal=principal, run_id=run_id, station_id=station_id, steps=steps, required=required,
                        ttl_s=RUN_TTL_S, **kw)
    if result.whole is not None:
        return {c: result.whole for c in WISKEY_CHECKS}
    out: dict[str, Outcome] = {}
    for check in WISKEY_CHECKS:
        mine = [(sid, d) for sid, a, d in steps if a == check]
        per = [(d, step_outcome(check, *result.phases[sid])) for sid, d in mine]
        doors_detail = [{"door": d.physical_relay, "result": o.status, **({"reason": o.reason} if o.reason else {})} for d, o in per]
        detail = {"doors": doors_detail} if check != "identity" else {}
        bad = next((o for _d, o in per if o.status == "fail"), None)
        skipped = next((o for _d, o in per if o.status == "not_run"), None)
        if bad is not None:
            out[check] = failed(bad.reason or "step_failed", detail)
        elif skipped is not None:
            out[check] = not_run(skipped.reason or "aborted_after_failure", detail)
        else:
            out[check] = passed(detail)
    return out


# ---------------------------------------------------------------- Arx's own probes (media, talk, events, clock)

class ArxProbes:
    """The Arx-side checks, on Arx's existing reviewed paths. Every probe returns an Outcome and never raises; a test swaps the
    whole object (`set_probes`)."""

    def __init__(self, settings: Any) -> None:
        self.settings = settings

    # -- media ------------------------------------------------------------------------------------------------------------------------
    def media_arx(self, conn: Any, station: Mapping[str, Any]) -> Outcome:
        from ..errors import ApiError
        from . import go2rtc
        from . import intercom_media as im

        if not station.get("online"):
            return failed("offline")
        try:
            im._local.describe(conn, self.settings, dict(station))
        except im.Unavailable as exc:
            return failed(exc.code)
        try:
            name = im._local.video_stream(conn, self.settings, dict(station), "main")
            data = go2rtc.Go2rtc(self.settings).frame_existing(name)
        except ApiError as exc:
            return failed(exc.code)
        except Exception:  # noqa: BLE001 - no exception text leaves (it may name a source)
            return failed("frame_error")
        return _frame_outcome(data, "arx")

    def media_wiskey(self, conn: Any, station: Mapping[str, Any]) -> Outcome:
        from ..errors import ApiError
        from . import go2rtc
        from . import intercom_media as im
        from . import wiskey_auto_install as wai
        from . import wiskey_media_contract as w10

        if not station.get("online"):
            return failed("offline")
        sid = str(station.get("id"))
        if wai.switch_on(conn):  # the installed WisKey's own still (the thumbnail's first path)
            try:
                still = wai.route_snapshot(self.settings, sid)
            except ApiError as exc:
                return failed("snapshot_not_ready", {"code": _code(exc.code)})
            except Exception:  # noqa: BLE001
                return failed("snapshot_not_ready")
            if still is not None:
                return _frame_outcome(still[0], "wiskey_snapshot")
        if im.provider_choice(conn) != "auto":
            return not_run("provider_local")
        try:
            video, _talk, why = w10.listed(im._feed_discovery(self.settings))
        except Exception:  # noqa: BLE001
            video, why = False, "discovery_unknown"
        if not video:
            return unsupported(why or "not_listed")
        try:
            provider = im.bridge_provider(self.settings, conn)
        except Exception:  # noqa: BLE001
            return not_run("signing_not_ready")
        ready = getattr(provider, "signing_ready", None)
        try:
            if ready is not None and not ready():
                return not_run("signing_not_ready")
        except Exception:  # noqa: BLE001
            return not_run("signing_not_ready")
        try:
            d = provider._describe(conn, self.settings, dict(station))  # WisKey only: no fallback to Arx's source here
            if not d.profiles:
                return unsupported("no_video_profile")
            name = provider._leased_stream(self.settings, d, sid, d.default_profile, None)
            data = go2rtc.Go2rtc(self.settings).frame_existing(name)
        except im.Unavailable as exc:
            return failed(exc.code)
        except ApiError as exc:
            return failed((exc.details or {}).get("reason") or exc.code)
        except Exception:  # noqa: BLE001
            return failed("frame_error")
        finally:
            try:
                im.release_leased_streams(self.settings, sid)
            except Exception:  # noqa: BLE001
                pass
        return _frame_outcome(data, "wiskey_w10")

    # -- talk -------------------------------------------------------------------------------------------------------------------------
    def talk(self, conn: Any, auth: Any, station: Mapping[str, Any]) -> Outcome:
        from . import intercom_authority as ia
        from . import intercom_media as im
        from . import wiskey_media_contract as w10

        mode = im.media_mode(conn)
        if mode != "video_talk":
            return not_run("talk_setting_off", {"mode": mode})
        if not station.get("online"):
            return failed("offline")
        sid = str(station.get("id"))
        provider = im.provider_for(self.settings, conn)
        if provider.name == "local":
            if im.provider_choice(conn) != "auto":
                return failed("provider_local")
            try:
                _video, talk, why = w10.listed(im._feed_discovery(self.settings))
            except Exception:  # noqa: BLE001
                talk, why = False, "discovery_unknown"
            if not talk:
                return unsupported("wiskey_talk_not_listed", {"why": why})
            return failed("signing_not_ready")
        try:
            d = im.MEDIA.descriptor(provider, conn, self.settings, dict(station))
        except im.Unavailable as exc:
            return failed(exc.code)
        except Exception:  # noqa: BLE001
            return failed("probe_error")
        if d.provider == "local":
            return failed("wiskey_fallback_local")
        if not d.talk_transport:
            return unsupported("talk_unsupported")
        if not auth.station(ia.CALL, sid):
            return failed("forbidden")
        return passed({"provider": provider.name, "transport": d.talk_transport, "codec": d.audio_codec, "duplex": d.duplex,
                       "busy": bool(im.MEDIA.busy(sid))})

    # -- events + clock (one health read) ---------------------------------------------------------------------------------------------
    def health(self, auth: Any, station_id: str) -> tuple[Mapping[str, Any] | None, str]:
        from . import intercom_adapter as adapter

        try:
            reply = adapter.ADAPTER.health(self.settings, auth, station_id)
            h = reply.get("health") if isinstance(reply, Mapping) else None
            if isinstance(h, Mapping):
                return h, "wiskey"
        except Exception:  # noqa: BLE001 - 404 for a caller without access.admin.read on it, an unsupported command: fall back
            pass
        try:
            reply = adapter.ADAPTER.station(self.settings, auth, station_id)
            tech = (reply.get("station") or {}).get("technical") if isinstance(reply, Mapping) else None
            if isinstance(tech, Mapping):
                return {"events": tech.get("event_status"), "clock": tech.get("clock")}, "feed"
        except Exception:  # noqa: BLE001
            pass
        return None, "none"

    def feed_state(self) -> str:
        from . import intercom_sync

        try:
            return intercom_sync.SYNC.served(self.settings)[0]
        except Exception:  # noqa: BLE001
            return "unknown"


def _frame_outcome(data: Any, source: str) -> Outcome:
    if not isinstance(data, (bytes, bytearray)) or not data:
        return failed("empty_frame", {"source": source})
    if bytes(data[:2]) != b"\xff\xd8":
        return failed("frame_error", {"source": source})
    return passed({"source": source, "bytes": len(data)})


def events_outcome(health: Mapping[str, Any] | None, source: str, feed_state: str) -> Outcome:
    if health is None:
        return unsupported("no_event_status")
    ev = health.get("events")
    if not isinstance(ev, Mapping):
        return unsupported("no_event_status")
    detail = {"source": source, "stream": ev.get("stream"), "history": ev.get("history"), "reconnects": ev.get("reconnects"),
              "last_frame_at": ev.get("last_frame_at"), "arx_feed": feed_state}
    stream = ev.get("stream")
    if stream == "connected":
        if feed_state != "ready":
            return failed("arx_feed_not_ready", detail)
        return passed(detail)
    if stream in ("connecting", "disconnected", "unavailable", "stopped", "authentication_failed"):
        return failed("stream_" + stream, detail)
    return failed("stream_unknown", detail)


def clock_outcome(health: Mapping[str, Any] | None, source: str) -> Outcome:
    if health is None:
        return unsupported("no_clock")
    c = health.get("clock")
    if not isinstance(c, Mapping):
        return unsupported("no_clock")
    skew = c.get("skew_seconds")
    drift = c.get("drift_state")
    detail = {"source": source, "skew_seconds": skew, "drift_state": drift, "time_mode": c.get("time_mode"), "checked_at": c.get("checked_at"),
              "tolerance_seconds": CLOCK_TOLERANCE_S}
    if c.get("status") == "unavailable":
        return failed("clock_unavailable", detail)
    if drift in ("ahead", "behind", "repeated_ahead", "repeated_behind"):
        return failed("drift_" + drift, detail)
    if isinstance(skew, (int, float)) and not isinstance(skew, bool):
        return passed(detail) if abs(skew) <= CLOCK_TOLERANCE_S else failed("skew_over_tolerance", detail)
    if drift == "within_tolerance":
        return passed(detail)
    return not_run("not_measured", detail)


# ---------------------------------------------------------------- the run (a worker thread; one at a time)

_LOCK = threading.Lock()
_ACTIVE: dict[str, threading.Thread] = {}
_PROBES: Callable[[Any], Any] = ArxProbes


def _features_from_join() -> Any:
    from . import wiskey_direct_join as wdj

    join = wdj.JOIN
    return join.features_or_none() if join is not None else None


FEATURES_PROVIDER: Callable[[], Any] = _features_from_join  # tests: a FeatureAdapters over a fake direct port
INLINE = False  # tests: run the worker in the caller's thread


def set_probes(factory: Callable[[Any], Any] | None) -> None:
    global _PROBES
    _PROBES = factory or ArxProbes


def active_run() -> str | None:
    """The check run in progress in this process (a pulse in flight is not a run the screen can follow)."""
    with _LOCK:
        for rid, t in list(_ACTIVE.items()):
            if t is not None and not t.is_alive():
                _ACTIVE.pop(rid, None)
                continue
            if rid.startswith("lv_"):
                return rid
    return None


def start_run(db: Any, settings: Any, principal: Principal, stations: list[Mapping[str, Any]], *, scope: str) -> str:
    """Create the run and start its worker. `stations` = the served stations the caller may validate (id, name, online, ...)."""
    if scope not in ("one", "all") or not stations:
        raise ValidationError("no_stations", 422)
    with _LOCK:
        busy = next((rid for rid, t in _ACTIVE.items() if t is None or t.is_alive()), None)
        if busy is not None:
            raise ValidationError("run_in_progress", 409)
        with db.connection(label="wiskey validation create") as conn:
            rid = create_run(conn, kind="checks", scope=scope, stations=[(str(s["id"]), str(s.get("name") or "")) for s in stations], actor=principal)
        _ACTIVE[rid] = None  # reserved before the thread exists (a second start waits for nothing and is refused)
    snapshot = [dict(s) for s in stations]
    if INLINE:
        try:
            execute_run(db, settings, principal, rid, snapshot)
        finally:
            with _LOCK:
                _ACTIVE.pop(rid, None)
        return rid
    t = threading.Thread(target=_worker, args=(db, settings, principal, rid, snapshot), name=f"wiskey-validation-{rid[-6:]}", daemon=True)
    with _LOCK:
        _ACTIVE[rid] = t
    t.start()
    return rid


def _worker(db: Any, settings: Any, principal: Principal, rid: str, stations: list[dict[str, Any]]) -> None:
    try:
        execute_run(db, settings, principal, rid, stations)
    except Exception:  # noqa: BLE001 - the run is closed honestly; nothing of the exception is stored
        log.exception("wiskey validation run %s failed", rid[-6:])
        try:
            with db.connection(label="wiskey validation close") as conn:
                finish_run(conn, rid, "interrupted", "probe_error")
        except Exception:  # noqa: BLE001
            pass
    finally:
        with _LOCK:
            _ACTIVE.pop(rid, None)


def execute_run(db: Any, settings: Any, principal: Principal, rid: str, stations: list[dict[str, Any]], **native_kw: Any) -> None:
    """Station by station, check by check; every result is committed as soon as it is known (the screen polls the run). A cancel is
    honoured between checks: what has not started is `not_run` (cancelled). An in-flight WisKey operation is never abandoned midway."""
    from . import intercom_authority as ia

    probes = _PROBES(settings)
    try:
        features = FEATURES_PROVIDER()
    except Exception:  # noqa: BLE001 - an unreadable selection is "not selected"
        features = None
    feed = probes.feed_state()
    cancelled = False
    for station in stations:
        sid = str(station["id"])
        with db.connection(label="wiskey validation station") as conn:
            if cancel_requested(conn, rid):
                cancelled = True
                break
            mark_running(conn, rid, sid, WISKEY_CHECKS)
        with db.connection(label="wiskey validation native") as conn:
            try:
                native = native_checks(conn, features, principal=principal, run_id=rid, station_id=sid, **native_kw)
            except Exception:  # noqa: BLE001
                log.exception("wiskey validation: native checks of a station failed")
                native = {c: failed("probe_error") for c in WISKEY_CHECKS}
            for check, outcome in native.items():
                save_outcome(conn, rid, sid, check, outcome)
        health_cache: dict[str, Any] = {}
        for check in ("media_arx", "media_wiskey", "talk", "events", "clock"):
            with db.connection(label="wiskey validation step") as conn:
                if cancel_requested(conn, rid):
                    cancelled = True
                    break
                mark_running(conn, rid, sid, (check,))
            with db.connection(mode="read", label="wiskey validation probe") as conn:
                auth = ia.Authority(conn, principal)
                try:
                    if check == "media_arx":
                        outcome = probes.media_arx(conn, station)
                    elif check == "media_wiskey":
                        outcome = probes.media_wiskey(conn, station)
                    elif check == "talk":
                        outcome = probes.talk(conn, auth, station)
                    else:
                        if "h" not in health_cache:
                            health_cache["h"] = probes.health(auth, sid)
                        h, source = health_cache["h"]
                        outcome = events_outcome(h, source, feed) if check == "events" else clock_outcome(h, source)
                except Exception:  # noqa: BLE001
                    log.exception("wiskey validation: probe %s failed", check)
                    outcome = failed("probe_error")
            with db.connection(label="wiskey validation save") as conn:
                save_outcome(conn, rid, sid, check, outcome)
        if cancelled:
            break
    with db.connection(label="wiskey validation finish") as conn:
        state = "cancelled" if cancelled or cancel_requested(conn, rid) else "done"
        finish_run(conn, rid, state)
        view = run_view(conn, rid) or {}
        from ..audit import audit

        audit(conn, actor=principal, action="wiskey.validation.run.end", decision="allowed", resource_type="wiskey_validation_run", resource_id=rid,
              details={"state": state, "counts": view.get("counts"), "stations": view.get("station_count")})


# ---------------------------------------------------------------- the door pulse (separate, confirmed, witnessed)


def run_pulse(db: Any, principal: Principal, *, station: Mapping[str, Any], door: int, witness_name: str, parent_run_id: str | None,
              **native_kw: Any) -> str:
    """ONE momentary open of ONE mapped door through `live_validation` (a single `pulse` step). The caller has checked: system
    administrator, local session, the typed confirmation, `access.doors.open` on the station, no earlier pulse of this station in the
    same check run. Refused while any run is in progress. Nothing is retried. After an acknowledged command the result stays
    `pending` (awaiting_witness) until the witness's verdict is recorded (`record_witness`)."""
    sid = str(station["id"])
    key = "pulse:" + sid
    with _LOCK:
        if any(t is None or t.is_alive() for t in _ACTIVE.values()):
            raise ValidationError("run_in_progress", 409)
        _ACTIVE[key] = None
    try:
        try:
            features = FEATURES_PROVIDER()
        except Exception:  # noqa: BLE001
            features = None
        base = {"door": door, "witness_name": witness_name[:80]}
        with db.connection(mode="read", label="wiskey validation pulse doors") as conn:
            match = [d for d in mapped_doors(conn, sid) if d.physical_relay == door]
        early: Outcome | None = None
        if not match:
            early = not_run("door_not_mapped")
        elif features is None:
            early = not_run("direct_join_off")
        with db.connection(label="wiskey validation pulse") as conn:
            rid = create_run(conn, kind="pulse", scope="one", stations=[(sid, str(station.get("name") or ""))], actor=principal,
                             parent_run_id=parent_run_id, checks=(PULSE,))
            if early is not None:
                save_outcome(conn, rid, sid, PULSE, Outcome(early.status, early.reason, base))
                finish_run(conn, rid, "done")
                return rid
            mark_running(conn, rid, sid, (PULSE,))
        with db.connection(label="wiskey validation pulse send") as conn:
            result = run_native(conn, features, principal=principal, run_id=rid, station_id=sid, steps=[("pulse", PULSE, match[0])],
                                required={RUN_PERMISSION, STEP_PERMISSION[PULSE]}, ttl_s=PULSE_TTL_S, **native_kw)
            if result.whole is not None:
                outcome = Outcome(result.whole.status, result.whole.reason, {**base, **dict(result.whole.detail)})
            else:
                phase, observation = result.phases["pulse"]
                step = step_outcome(PULSE, phase, observation)
                if step.status == "pass":  # WisKey acknowledged the command; the door itself is the witness's to confirm
                    outcome = Outcome("pending", "awaiting_witness", {**base, "wiskey": "acknowledged"})
                else:
                    outcome = Outcome(step.status, step.reason, {**base, "wiskey": phase})
            save_outcome(conn, rid, sid, PULSE, outcome)
            finish_run(conn, rid, "done")
        return rid
    finally:
        with _LOCK:
            _ACTIVE.pop(key, None)


def record_witness(conn: sqlite3.Connection, run_id: str, verdict: str, witness_name: str | None = None) -> dict[str, Any]:
    """The witness's verdict on an acknowledged pulse, once: `opened` passes, `not_opened` / `unsure` fail. A verdict on a pulse that
    WisKey did not acknowledge, or a second verdict, is refused."""
    if verdict not in WITNESS_VERDICTS:
        raise ValidationError("invalid_verdict", 422)
    row = conn.execute("SELECT r.station_id, r.status, r.reason, r.detail_json FROM wiskey_validation_results r JOIN wiskey_validation_runs u ON u.id=r.run_id "
                       "WHERE r.run_id=? AND r.check_key='pulse' AND u.kind='pulse'", (run_id,)).fetchone()
    if row is None:
        raise ValidationError("not_found", 404)
    sid, status, reason, detail_json = row
    if status != "pending" or reason != "awaiting_witness":
        raise ValidationError("witness_not_expected", 409)
    detail = json.loads(detail_json) if detail_json else {}
    if witness_name:
        detail["witness_name"] = witness_name[:80]
    detail["witness"] = verdict
    detail["witnessed_at"] = _iso()
    outcome = passed(detail, "witness_opened") if verdict == "opened" else failed("witness_" + verdict, detail)
    save_outcome(conn, run_id, sid, PULSE, outcome)
    return {"status": outcome.status, "reason": outcome.reason}


def pulse_done_for(conn: sqlite3.Connection, parent_run_id: str, station_id: str) -> bool:
    """Whether this station already had its ONE pulse attempt in this check run (any outcome: nothing is retried)."""
    return conn.execute("SELECT 1 FROM wiskey_validation_runs u JOIN wiskey_validation_results r ON r.run_id=u.id "
                        "WHERE u.parent_run_id=? AND u.kind='pulse' AND r.station_id=? LIMIT 1", (parent_run_id, station_id)).fetchone() is not None
