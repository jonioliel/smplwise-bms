"""CALCONNECT-2330 (contract 12.1 phase 4a, 13.5, 15.6): iCal OUT - secret-address feeds of selected calendars, read-only for subscribers.

Management (`calendar.connect`, under the module gate, audited with ids only): list, create `{calendar_ids, detail}`, rotate, revoke. Each
calendar of a feed needs an `edit`+ role of the creator (the rule of a binding, owner answer 17). The address carries a 32-byte random
token, stored as SHA-256 only and shown ONCE (create / rotate).

The document (`GET /calendar/feed/{token}.ics`) is the only route of the module without a signed-in person: a subscriber (a phone's
calendar, Google, Outlook) cannot sign in. It answers 404 alike for an unknown, revoked or malformed token and while the module or
`feeds_enabled` (off by default) is off; it is rate-limited per token (30 a minute); it sets no cookie. What leaves: CONFIRMED entries
30 days back and 400 ahead, `busy` -> "תפוס" blocks, `titles` -> the title; never notes, guests, organisers or anything personal
(15.6). Reaching the address from outside the house depends on how the installation is exposed - the owner's choice, not Arx's (the
setup guide says so); the feed endpoint passes the review gate of contract 15.11 before it is exposed publicly."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
import secrets
import sqlite3
import threading
import time
from typing import Any

from fastapi import APIRouter, Depends, Request, Response

from ..auth import current_principal, get_conn, get_read_conn, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services.calendar import calendars as cals
from ..services.calendar import model
from ..services.calendar.access import Ctx, Denied, get_visible
from . import calendar as cal_mod
from .calendar import Body, _audit, _body, _errors, module_gate

router = APIRouter(dependencies=[Depends(module_gate)])
public_router = APIRouter()

MAX_FEEDS = 50
MAX_CALS = 20
PAST_DAYS, AHEAD_DAYS = 30, 400
RATE_PER_MIN = 30
TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{43}$")
BUSY = "תפוס"
_RATE: dict[str, list[float]] = {}
_RATE_LOCK = threading.Lock()


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("ascii")).hexdigest()


def _need(conn: sqlite3.Connection, principal: Principal) -> None:
    require(conn, principal, model.PERM_CONNECT, INSTALLATION)


def _feeds_on(conn: sqlite3.Connection) -> None:
    if not model.read_settings(conn)["feeds_enabled"]:
        raise ApiError(409, "feeds_disabled", "פידים של iCal כבויים בהגדרות היומנים.")


def _row(conn: sqlite3.Connection, fid: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM cal_feeds WHERE id = ?", (fid,)).fetchone()
    if row is None:
        raise ApiError(404, "not_found", "הפיד לא נמצא.")
    return row


def _out(row: sqlite3.Row) -> dict[str, Any]:
    return {"id": row["id"], "calendar_ids": json.loads(row["calendar_ids_json"] or "[]"), "detail": row["detail"], "created_at": row["created_at"],
            "last_used_at": row["last_used_at"], "revoked": row["revoked_at"] is not None}


def _path(token: str) -> str:
    return f"/api/v1/calendar/feed/{token}.ics"


def _own(ctx: Ctx, row: sqlite3.Row) -> None:
    if not (ctx.admin or row["created_by"] == ctx.principal.user_id):
        raise Denied(model.PERM_CONNECT, row["id"], "owner")


@router.get("/calendar/feeds")
def list_feeds(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """CALCONNECT-2330: the outgoing iCal feeds (never their tokens) and whether `feeds_enabled` is on."""
    _need(conn, principal)
    return {"feeds": [_out(r) for r in conn.execute("SELECT * FROM cal_feeds ORDER BY created_at, id").fetchall()],
            "enabled": bool(model.read_settings(conn)["feeds_enabled"])}


@router.post("/calendar/feeds", status_code=201)
def create_feed(body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """`{calendar_ids, detail: busy|titles}`; `edit`+ in each calendar; the path with its token is answered ONCE."""
    _need(conn, principal)
    _feeds_on(conn)
    d = _body(body)
    ctx = Ctx(conn, principal, settings_of(request).data_dir)
    with _errors(conn, principal, request):
        if set(d) - {"calendar_ids", "detail"}:
            raise model.Invalid("calendar_ids and detail only", "calendar_ids")
        ids = d.get("calendar_ids")
        if not isinstance(ids, list) or not 1 <= len(ids) <= MAX_CALS or not all(isinstance(i, str) for i in ids) or len(set(ids)) != len(ids):
            raise model.Invalid(f"calendar_ids: 1-{MAX_CALS} distinct calendar ids", "calendar_ids")
        detail = model._choice(d.get("detail", "busy"), "detail", ("busy", "titles"))
        for cid in ids:
            cal = get_visible(ctx, cid)
            role = ctx.role_in(cal)
            if role is None or model.ROLE_RANK[role] < model.ROLE_RANK["edit"]:
                raise Denied("calendar.role", cid, "edit")
        if conn.execute("SELECT COUNT(*) FROM cal_feeds WHERE revoked_at IS NULL").fetchone()[0] >= MAX_FEEDS:
            raise model.Invalid("too many feeds", "calendar_ids", "limit_reached")
        fid, token = cals.new_id("fed"), secrets.token_urlsafe(32)
        conn.execute("INSERT INTO cal_feeds(id, calendar_ids_json, detail, token_hash, created_by, created_at) VALUES (?,?,?,?,?,?)",
                     (fid, json.dumps(ids), detail, _hash(token), principal.user_id, model.iso(cal_mod._now())))
        _audit(conn, principal, request, "calendar.feed.create", "calendar_feed", fid, calendars=len(ids), detail=detail)
        return {"feed": _out(_row(conn, fid)), "path": _path(token)}


@router.post("/calendar/feeds/{fid}/rotate")
def rotate_feed(fid: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """A new token (answered once); the old address stops at once. Creator or admin."""
    _need(conn, principal)
    _feeds_on(conn)
    row = _row(conn, fid)
    with _errors(conn, principal, request):
        _own(Ctx(conn, principal), row)
        if row["revoked_at"] is not None:
            raise ApiError(409, "bad_state", "הפיד בוטל.")
        token = secrets.token_urlsafe(32)
        conn.execute("UPDATE cal_feeds SET token_hash = ?, last_used_at = NULL WHERE id = ?", (_hash(token), fid))
        _audit(conn, principal, request, "calendar.feed.rotate", "calendar_feed", fid)
        return {"feed": _out(_row(conn, fid)), "path": _path(token)}


@router.post("/calendar/feeds/{fid}/revoke")
def revoke_feed(fid: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Ends the feed (its address answers 404 from now on). Creator or admin."""
    _need(conn, principal)
    row = _row(conn, fid)
    with _errors(conn, principal, request):
        _own(Ctx(conn, principal), row)
        if row["revoked_at"] is None:
            conn.execute("UPDATE cal_feeds SET revoked_at = ? WHERE id = ?", (model.iso(cal_mod._now()), fid))
            _audit(conn, principal, request, "calendar.feed.revoke", "calendar_feed", fid)
        return {"feed": _out(_row(conn, fid))}


# ---------------------------------------------------------------- the document

def _esc(v: str) -> str:
    v = "".join(c for c in v if ord(c) >= 32)
    return v.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,")


def _fold(line: str) -> str:
    raw = line.encode("utf-8")
    if len(raw) <= 75:
        return line
    out, cur = [], b""
    for ch in line:
        b = ch.encode("utf-8")
        if len(cur) + len(b) > (75 if not out else 74):
            out.append(cur.decode("utf-8"))
            cur = b""
        cur += b
    out.append(cur.decode("utf-8"))
    return "\r\n ".join(out)


def _stamp(iso: str) -> str:
    return model.parse_utc(iso, "t").strftime("%Y%m%dT%H%M%SZ")


def render(conn: sqlite3.Connection, calendar_ids: list[str], detail: str, now: dt.datetime) -> str:
    w0, w1 = model.iso(now - dt.timedelta(days=PAST_DAYS)), model.iso(now + dt.timedelta(days=AHEAD_DAYS))
    marks = ",".join("?" * len(calendar_ids))
    rows = conn.execute(
        f"SELECT o.event_id, o.holder_calendar_id, o.occ_start, o.occ_end, e.title, e.updated_at, e.all_day FROM cal_occurrences o JOIN cal_events e ON e.id = o.event_id "
        f"JOIN cal_calendars c ON c.id = o.holder_calendar_id WHERE o.holder_calendar_id IN ({marks}) AND o.state = 'confirmed' AND e.state NOT IN "
        f"('cancelled','rejected','withdrawn','expired') AND c.archived_at IS NULL AND o.occ_end > ? AND o.occ_start < ? ORDER BY o.occ_start LIMIT 5000",
        (*calendar_ids, w0, w1)).fetchall()
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SmplWise Arx//Calendar feed//HE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"]
    stamp = now.strftime("%Y%m%dT%H%M%SZ")
    for r in rows:
        uid = hashlib.sha256(f"{r['event_id']}|{r['holder_calendar_id']}|{r['occ_start']}".encode()).hexdigest()[:32]
        title = BUSY if detail == "busy" else (r["title"] or BUSY)
        lines += ["BEGIN:VEVENT", f"UID:{uid}@arx", f"DTSTAMP:{stamp}", f"DTSTART:{_stamp(r['occ_start'])}", f"DTEND:{_stamp(r['occ_end'])}",
                  _fold(f"SUMMARY:{_esc(title)}"), "TRANSP:OPAQUE", "CLASS:PRIVATE" if detail == "busy" else "CLASS:PUBLIC", "END:VEVENT"]
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


def _rate_ok(key: str) -> bool:
    now = time.monotonic()
    with _RATE_LOCK:
        hits = [t for t in _RATE.get(key, []) if now - t < 60]
        if len(hits) >= RATE_PER_MIN:
            _RATE[key] = hits
            return False
        hits.append(now)
        _RATE[key] = hits
        if len(_RATE) > 5000:  # bounded memory: forget the quiet ones
            for k in [k for k, v in _RATE.items() if not v or now - v[-1] >= 60]:
                _RATE.pop(k, None)
        return True


def _gone() -> ApiError:
    return ApiError(404, "not_found", "לא נמצא.")


@public_router.get("/calendar/feed/{name}")
def feed_document(name: str, request: Request, conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    """The feed document `<token>.ics` (no signed-in person: a subscriber cannot sign in). 404 alike when unknown, revoked or off; 30 a minute."""
    token = name[:-4] if name.endswith(".ics") else ""
    if not TOKEN_RE.fullmatch(token):
        raise _gone()
    s = model.read_settings(conn)
    if not s["enabled"] or not s["feeds_enabled"]:
        raise _gone()
    h = _hash(token)
    row = conn.execute("SELECT * FROM cal_feeds WHERE token_hash = ? AND revoked_at IS NULL", (h,)).fetchone()
    if row is None:
        raise _gone()
    if not _rate_ok(h):
        raise ApiError(429, "rate_limited", "יותר מדי בקשות.", retryable=True)
    now = cal_mod._now()
    body = render(conn, json.loads(row["calendar_ids_json"] or "[]"), row["detail"], now)
    last = row["last_used_at"]
    if not last or model.parse_utc(last, "l") < now - dt.timedelta(minutes=10):
        with request.app.state.db.write_aside(label="calendar.feed.used") as c:
            c.execute("UPDATE cal_feeds SET last_used_at = ? WHERE id = ?", (model.iso(now), row["id"]))
    return Response(content=body.encode("utf-8"), media_type="text/calendar; charset=utf-8",
                    headers={"Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff", "Content-Disposition": 'inline; filename="arx.ics"'})


__all__ = ["router", "public_router", "render"]
