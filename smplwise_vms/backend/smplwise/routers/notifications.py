"""Notifications API (CR-018, docs/architecture/NOTIFICATIONS_API.md section 2).

Every signed-in user (own data only, no permission): the inbox, its summary, read / read-all / snooze / acknowledge, one row, its
snapshot, a test push to their own devices, their own delivery rows. A user sees only rows they were made a recipient of AND may
still see - the check runs on every read (services/notify_visibility), so a revoked scope hides old rows at once.

No session: `POST /notifications/action` - a push button's single-use token authorises exactly `ack` or `snooze` on one row for one
user. There is no token for, and no route here that performs, anything physical: the doorbell's "open door" is a deep link into an
in-app confirmation that runs the existing release route with its own permission, step-up, rate limit and audit.

Administrators (`notify.manage`, installation scope): settings, per-source policies, outgoing mail (`/notify/email`, its test), the delivery log and its
counters. Every one of those routes answers 403 to anyone else.
"""
from __future__ import annotations

import datetime as dt
import sqlite3
import threading
import time
from typing import Any, Literal

from fastapi import APIRouter, Body, Depends, Header, Query, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import Database, unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services import notify, notify_channels
from ..services import notify_email as email_svc
from ..services import notify_policy as policies
from ..services import notify_settings as nsettings
from ..services import push as push_svc
from ..services import user_events
from ..services.notify_visibility import MANAGE
from ..services.timeutil import iso_utc, parse_utc
from .settings import read_settings

router = APIRouter()


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _tz(conn: sqlite3.Connection) -> str:
    return read_settings(conn)["time.zone"]


def _manager(conn: sqlite3.Connection, principal: Principal) -> None:
    """notify.manage at installation scope, or the audited 403 `forbidden` (every /notify/* route)."""
    require(conn, principal, MANAGE, INSTALLATION)


def _not_found() -> ApiError:
    return ApiError(404, "notification_not_found", "ההתראה לא נמצאה.")


def _expected_revision(if_match: str | None, body_revision: Any) -> int | None:
    """The revision a PUT was made against: the If-Match header (`3`, `"3"` or `W/"3"`), else the body's `base_revision` (the rest of the API) or
    `revision`. The S0 client sends both; they must agree - a mismatch is the stale case."""
    raw = if_match
    if raw:
        raw = raw.strip()
        if raw.startswith("W/"):
            raw = raw[2:]
        raw = raw.strip('"')
        if raw.isdigit():
            return int(raw)
        raise ApiError(422, "validation", "If-Match חייב להיות מספר מהדורה.", details={"field": "If-Match"})
    if isinstance(body_revision, int) and not isinstance(body_revision, bool):
        return body_revision
    return None


# ================================================================ every signed-in user

@router.get("/notifications")
def list_notifications(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn),
                       state: Literal["open", "all"] = "all", category: str | None = Query(None, max_length=32), severity_min: Literal["info", "alert", "critical"] | None = None,
                       unread: bool = False, before: str | None = Query(None, max_length=40), limit: int = Query(50, ge=1, le=200)) -> dict[str, Any]:
    """The caller's inbox, newest first (open critical safety rows pinned on top). `state=open` hides resolved rows."""
    if category and category not in policies.CATEGORIES:
        raise ApiError(422, "validation", "קטגוריה לא מוכרת.", details={"field": "category"})
    if before:
        try:
            parse_utc(before)
        except ValueError:
            raise ApiError(422, "validation", "before חייב להיות זמן UTC.", details={"field": "before"}) from None
    return notify.list_for(conn, principal, state=state, category=category, severity_min=severity_min, unread=unread, before=before, limit=limit, data_dir=settings_of(request).data_dir)


@router.get("/notifications/summary")
def notifications_summary(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """`{unread, open_critical, by_category}` - the user-menu chip and the avatar dot (visible rows only) - plus what the center needs from the
    installation's settings, which only an administrator may read: `center_layout` (sheet | page) and `quiet_active` / `quiet_until`."""
    return {**notify.summary(conn, principal), **notify.center_state(conn, _tz(conn))}


@router.post("/notifications/read-all")
def read_all(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    n = notify.read_all(conn, principal)
    return {"marked": n, **notify.summary(conn, principal)}


class SnoozeIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    minutes: Literal[60, "until_morning"]


@router.get("/notifications/deliveries")
def my_deliveries(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn), notification_id: str | None = Query(None, max_length=64)) -> dict[str, Any]:
    """The caller's OWN delivery rows (what was sent to their devices, what was held back and why)."""
    sql = "SELECT d.*, n.title, n.source FROM notification_deliveries d JOIN notifications n ON n.id = d.notification_id WHERE d.user_id = ?"
    params: list[Any] = [principal.user_id]
    if notification_id:
        sql += " AND d.notification_id = ?"
        params.append(notification_id)
    rows = conn.execute(sql + " ORDER BY d.created_at DESC, d.id DESC LIMIT 200", params).fetchall()
    return {"deliveries": [_delivery(conn, r, with_user=False) for r in rows]}


@router.post("/notifications/test")
def test_notification(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """A test push to the caller's own registered devices (3 per minute per user, the same bucket as /push/test)."""
    if not push_svc.take_token(principal.user_id, "test"):
        raise ApiError(429, "rate_limited", "יותר מדי התראות בדיקה. נסו שוב בעוד דקה.", retryable=True, details={"retry_after_s": 20})
    if not conn.execute("SELECT 1 FROM push_subscriptions WHERE user_id = ?", (principal.user_id,)).fetchone():
        raise ApiError(409, "push_not_subscribed", "המכשיר הזה (וכל מכשיר אחר שלך) עדיין לא נרשם להתראות.")
    audit(conn, actor=principal, action="push.test", decision="allowed", resource_type="user", resource_id=principal.user_id, request_id=_rid(request))
    db: Database = request.app.state.db
    with unlocked(conn):  # the push services are called without the request's write lock
        results = notify_channels.send_test(db, principal.user_id)
    return {"results": results, "sent": sum(1 for r in results if r["outcome"] == "sent")}


# ---- the no-session action endpoint

class ActionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    t: str = Field(min_length=8, max_length=128)
    a: Literal["ack", "snooze"]  # nothing else is an action: the doorbell's "open door" is a deep link, not a call


class _FailureBucket:
    """Token guesses per client address: 20 failures a minute, then 429 - a token is 128 random bits, this only keeps noise down."""

    def __init__(self, burst: int = 20, per_s: float = 60.0) -> None:
        self.burst, self.per_s = burst, per_s
        self.hits: dict[str, list[float]] = {}
        self.lock = threading.Lock()

    def blocked(self, who: str) -> bool:
        now = time.monotonic()
        with self.lock:
            self.hits[who] = [t for t in self.hits.get(who, []) if now - t < self.per_s]
            return len(self.hits[who]) >= self.burst

    def fail(self, who: str) -> None:
        with self.lock:
            self.hits.setdefault(who, []).append(time.monotonic())
            if len(self.hits) > 2000:
                self.hits.clear()


ACTION_FAILURES = _FailureBucket()


def _remote_gate(request: Request) -> Principal | None:
    """On the remote channel (/arx) the call must ALSO carry a live Arx session: refused 401 here, before the body is read or validated, like
    every other route (CR-008 3e.2). The service worker's fetch is same-origin and sends the session cookie. On the local (Ingress) channel the
    action token alone is the credential - Home Assistant's own sign-in already stands behind that surface. Returns the session's principal."""
    from ..remote_channel import is_remote

    if not is_remote(request):
        return None
    from ..auth import resolve_remote_first

    return resolve_remote_first(request)


@router.post("/notifications/action")
def push_action(request: Request, session: Principal | None = Depends(_remote_gate), body: ActionIn = Body(...)) -> dict[str, Any]:
    """A push button (ack / snooze) pressed from the service worker. The single-use token is the credential (plus, on the remote channel, a live
    Arx session of THE SAME user). It is bound to (notification, user, action), expires with the push, and is re-checked against the user's
    CURRENT visibility and, for ack, their right to acknowledge. Any failure (expired, used, other action, lost reach, another user's session,
    unknown) is the same 401 `action_token_invalid`."""
    who = request.client.host if request.client else "?"
    if ACTION_FAILURES.blocked(who):
        raise ApiError(429, "rate_limited", "יותר מדי ניסיונות. נסו שוב בעוד דקה.", retryable=True, details={"retry_after_s": 60})
    db: Database = request.app.state.db
    with db.connection(label="notifications/action") as conn:
        got = notify.redeem_token(conn, body.t, body.a, _tz(conn), expect_user=session.user_id if session is not None else None)
        if got is not None:
            principal = got["principal"]
            audit(conn, actor=principal, action="notify.action", decision="allowed", resource_type="notification", resource_id=got["notification_id"], request_id=_rid(request),
                  details={"channel": "push", "action": body.a})
    if got is None:
        ACTION_FAILURES.fail(who)
        raise ApiError(401, "action_token_invalid", "הכפתור כבר אינו תקף. פתחו את Arx כדי לטפל בהתראה.")
    return {"ok": True, "result": got["result"], "notification_id": got["notification_id"]}


# ---- one notification

def _row_or_404(conn: sqlite3.Connection, principal: Principal, nid: str):
    got = notify.get_row(conn, principal, nid)
    if got is None:
        raise _not_found()
    return got


@router.get("/notifications/{nid}")
def get_notification(nid: str, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    row, rec, reach = _row_or_404(conn, principal, nid)
    return notify.serialize(conn, row, principal, reach, rec, settings_of(request).data_dir)


@router.post("/notifications/{nid}/read")
def mark_read(nid: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    if not notify.mark_read(conn, principal, nid):
        raise _not_found()
    row, rec, reach = _row_or_404(conn, principal, nid)
    return notify.serialize(conn, row, principal, reach, rec, settings_of(request).data_dir)


@router.post("/notifications/{nid}/snooze")
def snooze(nid: str, body: SnoozeIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Snooze for the caller only: 60 minutes, or "until_morning" (the next end of the quiet window, in the installation zone). Answers the updated row."""
    until = notify.snooze(conn, principal, nid, body.minutes, _tz(conn))
    if until is None:
        raise _not_found()
    row, rec, reach = _row_or_404(conn, principal, nid)
    return notify.serialize(conn, row, principal, reach, rec, settings_of(request).data_dir)


@router.post("/notifications/{nid}/ack")
def ack(nid: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Acknowledge (shared): stops escalation, audited `notify.ack`. 403 `ack_not_allowed` unless the caller's `can_ack`."""
    result = notify.acknowledge(conn, principal, nid)
    if result == "not_found":
        raise _not_found()
    if result == "not_allowed":
        audit(conn, actor=principal, action="notify.ack", decision="denied", resource_type="notification", resource_id=nid, reason="ack_not_allowed", request_id=_rid(request))
        raise ApiError(403, "ack_not_allowed", "אין לך הרשאה לאשר את ההתראה הזו.")
    row, rec, reach = _row_or_404(conn, principal, nid)
    audit(conn, actor=principal, action="notify.ack", decision="allowed", resource_type="notification", resource_id=nid, request_id=_rid(request), details={"source": row["source"]})
    return notify.serialize(conn, row, principal, reach, rec, settings_of(request).data_dir)


@router.get("/notifications/{nid}/snapshot")
def snapshot(nid: str, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    """The event's stored still, fetched inside Arx after sign-in - for a camera subject the caller may view live or read events on. It is
    never in a push payload or an e-mail. 404 `notification_not_found` for anything else."""
    from ..rbac import authorize
    from ..services import thumbnails

    row, _rec, _reach = _row_or_404(conn, principal, nid)
    n = notify._row_note(row)
    cam = n["origin"].get("camera_id") or (n["subject_id"] if n["subject_kind"] == "camera" else None)
    ev = n["origin"].get("event_id")
    if not cam or not ev:
        raise _not_found()
    if not (authorize(conn, principal, "video.live", ("camera", cam)).allowed or authorize(conn, principal, "events.read", ("camera", cam)).allowed):
        raise _not_found()
    path = thumbnails.path_for(settings_of(request), str(ev))
    if not path.is_file():
        raise _not_found()
    return Response(content=path.read_bytes(), media_type="image/jpeg", headers={"Cache-Control": "private, no-store"})


# ================================================================ administrators (notify.manage)

def _delivery(conn: sqlite3.Connection, r: sqlite3.Row, with_user: bool = True) -> dict[str, Any]:
    d: dict[str, Any] = {"id": r["id"], "notification_id": r["notification_id"], "title": r["title"], "source": r["source"], "channel": r["channel"], "target": r["target_ref"], "status": r["status"],
                         "reason": r["reason"], "attempt": r["attempt"], "at": r["sent_at"] or r["created_at"], "mode": r["mode"]}
    if with_user:
        u = conn.execute("SELECT display_name, username FROM users WHERE id = ?", (r["user_id"],)).fetchone() if r["user_id"] else None
        d["user_display"] = (u["display_name"] or u["username"]) if u else ("דואר יוצא" if r["channel"] == "email" else "")
    else:
        d["user_display"] = ""
    return d


@router.get("/notify/settings")
def get_settings(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _manager(conn, principal)
    return nsettings.load(conn, settings_of(request))


@router.put("/notify/settings")
def put_settings(request: Request, body: dict[str, Any] = Body(...), if_match: str | None = Header(None), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Quiet hours and the pass-through matrix, escalation, lock-screen level, retention, the reserved Companion flag. A full GET body may be
    sent back as it is (the read-only fields - email, updated_at - are ignored; the mail block has its own route). With a revision (If-Match
    or `revision`) a stale one is 412 `settings_conflict`."""
    _manager(conn, principal)
    try:
        stored, changed = nsettings.update(conn, body, principal.user_id, _expected_revision(if_match, body.get("base_revision", body.get("revision"))))
    except nsettings.SettingsInvalid as exc:
        raise ApiError(exc.status, exc.code, exc.message, details=exc.details) from None
    audit(conn, actor=principal, action="notify.settings.update", decision="allowed", resource_type="installation", resource_id="notify", request_id=_rid(request), details={"changed": changed})
    return nsettings.load(conn, settings_of(request))


def _policy_view(p: dict[str, Any], audience: str = "admins") -> dict[str, Any]:
    """A policy as the settings tab shows it. The two failure sources (schedule not executed, automation failed) show the recipients that
    `failures_audience` makes effective (`recipients.locked_by`), because that one setting decides them."""
    rec = policies.effective_recipients(p, audience)
    if rec is not p.get("recipients") and p["source"] in policies.FAILURE_SOURCES:
        p = {**p, "recipients": {**rec, "locked_by": "failures_audience"}}
    return {**p, "label": policies.BY_KEY[p["source"]].label, "subject_kind": policies.BY_KEY[p["source"]].subject, "resolves": policies.BY_KEY[p["source"]].resolves}


@router.get("/notify/policies")
def list_policies(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _manager(conn, principal)
    audience = nsettings.failures_audience(conn)
    return {"policies": [_policy_view(p, audience) for p in policies.list_policies(conn)], "categories": list(policies.CATEGORIES), "severities": list(policies.SEVERITIES),
            "recipient_rules": list(policies.RECIPIENT_RULES)}


@router.get("/notify/policies/{source}")
def get_policy(source: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _manager(conn, principal)
    p = policies.get_policy(conn, source)
    if p is None:
        raise ApiError(404, "not_found", "מקור ההתראות לא נמצא.")
    return _policy_view(p, nsettings.failures_audience(conn))


@router.put("/notify/policies/{source}")
def put_policy(source: str, request: Request, body: dict[str, Any] = Body(...), if_match: str | None = Header(None), principal: Principal = Depends(current_principal),
               conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Change one source's policy (enabled, severity, category, how long the condition must hold, fold window, resolve notice, recipients,
    channels). `ha_mobile` / `whatsapp` true is 422 `channel_reserved` in v1. A stale revision is 412 `settings_conflict`."""
    _manager(conn, principal)
    cur = policies.get_policy(conn, source)
    if cur is None:
        raise ApiError(404, "not_found", "מקור ההתראות לא נמצא.")
    expected = _expected_revision(if_match, body.get("base_revision", body.get("revision")))
    if expected is not None and expected != cur["revision"]:
        raise ApiError(412, "settings_conflict", "המדיניות השתנתה בינתיים; טען מחדש.", details={"current_revision": cur["revision"], "sent_revision": expected})
    try:
        cols = policies.validate_update(source, {k: v for k, v in body.items() if k not in ("source", "revision", "base_revision", "label", "subject_kind", "resolves")})
    except policies.PolicyInvalid as exc:
        raise ApiError(422, exc.code, exc.message, details=exc.details) from None
    if cols:
        if conn.execute("SELECT 1 FROM notify_policies WHERE source = ?", (source,)).fetchone() is None:
            policies.ensure_defaults(conn)
        conn.execute(f"UPDATE notify_policies SET {', '.join(f'{k} = ?' for k in cols)}, revision = revision + 1, updated_by = ?, updated_at = ? WHERE source = ?",
                     (*cols.values(), principal.user_id, iso_utc(dt.datetime.now(dt.timezone.utc)), source))
    audit(conn, actor=principal, action="notify.policy.update", decision="allowed", resource_type="notify_policy", resource_id=source, request_id=_rid(request),
          details={"changed": sorted(k.removesuffix("_json") for k in cols)})
    return _policy_view(policies.get_policy(conn, source), nsettings.failures_audience(conn))  # type: ignore[arg-type]


@router.get("/notify/email")
def get_email(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The outgoing-mail block of the settings: host / port / security / user / from / recipients / last test and `password_set` - never the password."""
    _manager(conn, principal)
    return email_svc.email_view(conn, settings_of(request).data_dir)


@router.put("/notify/email")
def put_email(request: Request, body: dict[str, Any] = Body(...), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Outgoing mail: host, port, security (starttls | tls | none), user, from, recipients (1-10 addresses) and the password. The password is
    WRITE-ONLY: omitted or empty = unchanged; it goes to <data>/secrets/notify_email (mode 600) and the answer only says `password_set`. 422
    `email_invalid` for a bad host, port, address (or a CR/LF in any of them). The audit row names the changed fields, never a value."""
    _manager(conn, principal)
    try:
        view, changed, pw = email_svc.update_email(conn, settings_of(request).data_dir, body, principal.user_id)
    except nsettings.SettingsInvalid as exc:
        raise ApiError(exc.status, exc.code, exc.message, details=exc.details) from None
    audit(conn, actor=principal, action="notify.email.update", decision="allowed", resource_type="installation", resource_id="notify.email", request_id=_rid(request),
          details={"changed": changed, "password_changed": pw})
    return view


EMAIL_TEST_MESSAGES = {
    "ok": "הודעת הבדיקה נשלחה.", "dns": "שם שרת הדואר לא נמצא.", "connect": "אין חיבור לשרת הדואר.", "tls": "ההצפנה מול שרת הדואר נכשלה.",
    "auth": "שם המשתמש או הסיסמה נדחו.", "refused": "שרת הדואר סירב להודעה.", "timeout": "שרת הדואר לא ענה בזמן.", "invalid": "ההודעה אינה תקינה.",
    "too_large": "ההודעה גדולה מדי.", "unavailable": "הדואר היוצא אינו מוגדר במלואו.",
}


@router.post("/notify/email/test")
def test_email(request: Request, body: dict[str, Any] | None = Body(None), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Any:
    """Send one test mail through the real code path to each configured recipient (or, with `{"to": <one of them>}`, only to that one), 3 a minute.
    `{ok, detail, message, delivered, total}`: `detail` is `ok` or the failure class (dns, connect, tls, auth, refused, timeout) - never a
    server text, which could echo an address or a credential. The result is stored as `email.last_test`. 409 `channel_unavailable` when mail is
    not configured; 429 `rate_limited` with Retry-After."""
    _manager(conn, principal)
    allowed, wait = email_svc.take_test_token(principal.user_id)
    if not allowed:
        secs = int(wait) + 1
        err = ApiError(429, "rate_limited", "יותר מדי בדיקות דואר. נסו שוב בעוד דקה.", retryable=True, details={"retry_after_s": secs})
        return JSONResponse(status_code=429, content=err.payload(_rid(request) or ""), headers={"Retry-After": str(secs)})
    cfg = email_svc.load_config(conn, settings_of(request).data_dir)
    if cfg is None:
        raise ApiError(409, "channel_unavailable", "הדואר היוצא עדיין לא הוגדר.")
    to = (body or {}).get("to")
    if to is not None and (not isinstance(to, str) or to.lower() not in [a.lower() for a in cfg.recipients]):
        raise ApiError(422, "email_invalid", "הבדיקה נשלחת רק לאחת מכתובות הנמענים שהוגדרו.", details={"field": "to"})
    tz_name = _tz(conn)
    with unlocked(conn):  # the SMTP server is called without the request's write lock
        ok, detail, delivered, total = email_svc.send_test(cfg, tz_name, to)
    nsettings.store_last_test(conn, ok, detail)
    audit(conn, actor=principal, action="notify.email.test", decision="allowed", resource_type="installation", resource_id="notify.email", request_id=_rid(request),
          details={"ok": ok, "detail": detail})
    return {"ok": ok, "detail": detail, "message": EMAIL_TEST_MESSAGES.get(detail, detail), "delivered": delivered, "total": total}


@router.get("/notify/deliveries")
def all_deliveries(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn), status: str | None = Query(None, max_length=16),
                   channel: Literal["webpush", "email"] | None = None, since: str | None = Query(None, max_length=40), limit: int = Query(100, ge=1, le=500)) -> dict[str, Any]:
    """Everyone's delivery log (masked targets): `status=failed` (or `failures`: failed and gone) for the failures panel."""
    _manager(conn, principal)
    if status is not None and status not in ("queued", "sent", "retry", "failed", "gone", "skipped", "failures"):
        raise ApiError(422, "validation", "סטטוס לא מוכר.", details={"field": "status"})
    sql = "SELECT d.*, n.title, n.source FROM notification_deliveries d JOIN notifications n ON n.id = d.notification_id WHERE 1 = 1"
    params: list[Any] = []
    if status == "failures":
        sql += " AND d.status IN ('failed', 'gone')"
    elif status:
        sql += " AND d.status = ?"
        params.append(status)
    if channel:
        sql += " AND d.channel = ?"
        params.append(channel)
    if since:
        try:
            parse_utc(since)
        except ValueError:
            raise ApiError(422, "validation", "since חייב להיות זמן UTC.", details={"field": "since"}) from None
        sql += " AND d.created_at >= ?"
        params.append(since)
    rows = conn.execute(sql + " ORDER BY d.created_at DESC, d.id DESC LIMIT ?", (*params, limit)).fetchall()
    return {"deliveries": [_delivery(conn, r) for r in rows]}


@router.get("/notify/stats")
def stats(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Per-channel counters for the last 24 hours - `channels[<channel>] = {sent, failed, skipped: {<reason>: n}}` (failed counts failed and gone) -
    the push worker's own counters as `worker` (no endpoints, no ids), plus the notification volume `by_source` (what the settings tab's volume
    column shows) and the number of registered push devices."""
    _manager(conn, principal)
    since = iso_utc(dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=24))
    channels: dict[str, dict[str, Any]] = {}
    for r in conn.execute("SELECT channel, status, COALESCE(reason, '') AS reason, COUNT(*) AS n FROM notification_deliveries WHERE created_at >= ? GROUP BY channel, status, reason", (since,)).fetchall():
        c = channels.setdefault(r["channel"], {"sent": 0, "failed": 0, "skipped": {}})
        if r["status"] == "sent":
            c["sent"] += r["n"]
        elif r["status"] in ("failed", "gone"):
            c["failed"] += r["n"]
        elif r["status"] == "skipped":
            c["skipped"][r["reason"] or "other"] = c["skipped"].get(r["reason"] or "other", 0) + r["n"]
    by_source = {r["source"]: r["n"] for r in conn.execute("SELECT source, COUNT(*) AS n FROM notifications WHERE created_at >= ? GROUP BY source ORDER BY n DESC", (since,)).fetchall()}
    worker = {k: push_svc.STATS[k] for k in ("queued", "sent", "retried", "gone", "failed", "refused", "retry_skipped", "rate_limited", "dropped_queue")}
    return {"since": since, "channels": channels, "worker": worker, "by_source": by_source, "push_devices": conn.execute("SELECT COUNT(*) FROM push_subscriptions").fetchone()[0]}
