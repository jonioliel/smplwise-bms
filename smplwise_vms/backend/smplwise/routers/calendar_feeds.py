"""CALCONNECT-2330 (contract 12.1 phase 4a, 13.5, 15.6): iCal OUT - secret-address feeds of selected calendars, read-only for subscribers.

Management (`calendar.connect`, under the module gate, audited with ids only): list, create `{calendar_ids, detail}`, rotate, revoke, and
(CAL-FEED-REVIEW-2351) the per-feed remote switch. Each calendar of a feed needs an `edit`+ role of the creator (the rule of a binding,
owner answer 17). The address carries a 32-byte random token, stored as SHA-256 only and shown ONCE (create / rotate).

The document (`GET /calendar/feed/{token}.ics`) is the only route of the module without a signed-in person: a subscriber (a phone's
calendar, Google, Outlook) cannot sign in. CAL-FEED-REVIEW-2351 (the contract 15.11 review, docs/changes/CAL-FEED-REVIEW-2351.md):
- one uniform 404 for a malformed, unknown, revoked, expired (`feed_max_age_days`) or remote-not-allowed address and while the module or
  `feeds_enabled` (off by default) is off; the stored hash is compared in constant time after the indexed lookup;
- rate limits: per client address (`feed_address_rate_per_min`, counted BEFORE the token is looked at, so misses and hits cost the same)
  and per feed (`feed_rate_per_min`);
- the feed answers with the CURRENT authority of its creator: an inactive / removed creator, one who lost `calendar.connect`, or a
  calendar where he no longer holds `edit`+ (or that is archived) drops out - nothing left = the uniform 404;
- what leaves: CONFIRMED entries 30 days back and 400 ahead, `busy` -> "תפוס" blocks, `titles` -> the title (control / separator
  characters removed, escaped, capped); never notes, attendees (users, residents, guests - names, contacts or counts), organisers,
  on-behalf labels, rooms or anything personal (15.6, CAL-ATTENDEES-2343); the document is capped in entries and bytes;
- no cookie, `no-store`, `no-referrer`, `noindex`; the token never reaches a log line (the access log filter below, a token-free
  connection label) or an audit row;
- the remote channel (the tunnel) keeps answering the uniform 404 unless THIS feed's `remote_enabled` is on (default off; switched only
  from a local session, audited) - remote_channel lets only a well-formed `GET <token>.ics` through to this route, everything else under
  the prefix stays blocked at the edge.

Owner decisions round 14 (02.11, docs/changes/CAL-FEED-REVIEW-2351.md section 6):
- 1A / 2A: the remote switch per feed, a toggle in "פידים יוצאים". Switching it ON needs an administrator, or the feed's creator holding
  `manage` in EVERY calendar of the feed (the UI shows the toggle only then: `can_remote`); OFF needs the creator or an administrator.
  Both only from a local session (403 `local_only` on the remote channel; the list answers `local` so the screen can explain it).
- 4A: a feed whose remote switch is on is ALWAYS busy-only ("תפוס", no titles), on every channel, whatever its own `detail` says;
  the answers carry `detail_effective`. Switching it off restores the feed's own detail.
- 3C: each address carries its own expiry, fixed when it is issued (create / rotate = "renew link"): now + `feed_max_age_days` (an
  installation setting, default 365, 0 = no limit). A later change of the setting applies to addresses issued after it only, and an
  address issued before round 14 has no expiry (no silent revocation). The per-feed expiry lives in the settings row
  `calendar.feed_expiry` ({feed id: ISO instant or null}) instead of a new cal_feeds column (no new migration on this branch)."""
from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import json
import logging
import re
import secrets
import sqlite3
import threading
import time
from typing import Any

from fastapi import APIRouter, Depends, Request, Response

from ..auth import _track, current_principal, get_conn, settings_of
from ..db import get_setting, set_setting
from ..errors import ApiError
from ..rbac import INSTALLATION, LOCAL_ID_PREFIX, Principal, authorize, require
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
RATE_PER_MIN = 30  # the default of `feed_rate_per_min`
ADDRESS_RATE_PER_MIN = 120  # the default of `feed_address_rate_per_min`
MAX_EVENTS = 5000
MAX_DOC_BYTES = 2 * 1024 * 1024
MAX_TITLE = 200
TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{43}$")
DOC_PATH_RE = re.compile(r"^/api/v1/calendar/feed/[A-Za-z0-9_-]{43}\.ics$")  # what remote_channel lets through to this route
BUSY = "תפוס"
LOCAL_ONLY_HE = "שינוי הגישה מרחוק לפיד אפשרי רק בגישה מקומית (מתוך הרשת של הבניין)."
REMOTE_MANAGE_HE = "פתיחת פיד לגישה מרחוק מותרת רק למנהל מערכת או ליוצר הפיד כשהוא מנהל את כל היומנים שבו."
EXPIRY_KEY = "calendar.feed_expiry"  # {feed id: ISO instant | null} - the expiry each address got when it was issued (round 14, 3C)
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


def _expiry_map(conn: sqlite3.Connection) -> dict[str, Any]:
    try:
        v = json.loads(get_setting(conn, EXPIRY_KEY) or "{}")
    except ValueError:
        v = {}
    return v if isinstance(v, dict) else {}


def _issue_expiry(conn: sqlite3.Connection, fid: str, now: dt.datetime) -> None:
    """Fixes the expiry of the address just issued (create / rotate) from the CURRENT default; drops the ids of feeds that are gone or revoked."""
    days = model.read_settings(conn)["feed_max_age_days"]
    live = {r[0] for r in conn.execute("SELECT id FROM cal_feeds WHERE revoked_at IS NULL")}
    m = {k: v for k, v in _expiry_map(conn).items() if k in live}
    m[fid] = model.iso(now + dt.timedelta(days=days)) if days else None
    set_setting(conn, EXPIRY_KEY, json.dumps(m, sort_keys=True))


def _forget_expiry(conn: sqlite3.Connection, fid: str) -> None:
    m = _expiry_map(conn)
    if fid in m:
        m.pop(fid)
        set_setting(conn, EXPIRY_KEY, json.dumps(m, sort_keys=True))


def _expires_at(row: sqlite3.Row, expiry: dict[str, Any]) -> tuple[bool, dt.datetime | None]:
    """(unreadable, the expiry). An address issued before round 14 has no entry: no expiry (no silent revocation). An entry that cannot
    be read fails closed (the document treats it as expired)."""
    if expiry.get(row["id"]) is None:
        return False, None
    try:
        return False, model.parse_utc(expiry[row["id"]], "expires_at")
    except model.Invalid:
        return True, None


def _effective_detail(row: sqlite3.Row) -> str:
    """Round 14, 4A: a feed open on the remote channel is busy-only, whatever its own detail says."""
    return "busy" if row["remote_enabled"] else row["detail"]


def _out(row: sqlite3.Row, expiry: dict[str, Any], ctx: Ctx | None = None) -> dict[str, Any]:
    _, exp = _expires_at(row, expiry)
    out = {"id": row["id"], "calendar_ids": json.loads(row["calendar_ids_json"] or "[]"), "detail": row["detail"], "detail_effective": _effective_detail(row),
           "created_at": row["created_at"], "last_used_at": row["last_used_at"], "revoked": row["revoked_at"] is not None, "remote": bool(row["remote_enabled"]),
           "token_set_at": row["token_set_at"] or row["created_at"], "expires_at": model.iso(exp) if exp else None}
    if ctx is not None:
        out["can_remote"] = row["revoked_at"] is None and _may_switch_remote(ctx, row, not row["remote_enabled"])
    return out


def _path(token: str) -> str:
    return f"/api/v1/calendar/feed/{token}.ics"


def _own(ctx: Ctx, row: sqlite3.Row) -> None:
    if not (ctx.admin or row["created_by"] == ctx.principal.user_id):
        raise Denied(model.PERM_CONNECT, row["id"], "owner")


def _manages_all(ctx: Ctx, row: sqlite3.Row) -> bool:
    """The caller holds `manage` in every calendar of the feed (none archived or gone)."""
    ids = json.loads(row["calendar_ids_json"] or "[]")
    if not ids:
        return False
    for cid in ids:
        cal = ctx.conn.execute("SELECT * FROM cal_calendars WHERE id = ? AND archived_at IS NULL", (cid,)).fetchone()
        if cal is None or ctx.role_in(cal) != "manage":
            return False
    return True


def _may_switch_remote(ctx: Ctx, row: sqlite3.Row, enabled: bool) -> bool:
    """Round 14, 2A: ON - an administrator, or the creator who manages every calendar of the feed; OFF - the creator or an administrator."""
    if ctx.admin:
        return True
    if row["created_by"] != ctx.principal.user_id:
        return False
    return _manages_all(ctx, row) if enabled else True


def _remote(request: Request) -> bool:
    from ..remote_channel import is_remote

    return is_remote(request)


@router.get("/calendar/feeds")
def list_feeds(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """CALCONNECT-2330: the outgoing iCal feeds (never their tokens) and whether `feeds_enabled` is on. Round 14: per feed `can_remote`
    (may THIS caller change the remote switch now), `detail_effective`, `expires_at`; `local` (false on the remote channel, where the
    switch is refused) and `default_max_age_days` (the expiry a new or renewed address gets, 0 = no limit)."""
    _need(conn, principal)
    s = model.read_settings(conn)
    ctx, expiry = Ctx(conn, principal), _expiry_map(conn)
    return {"feeds": [_out(r, expiry, ctx) for r in conn.execute("SELECT * FROM cal_feeds ORDER BY created_at, id").fetchall()],
            "enabled": bool(s["feeds_enabled"]), "local": not _remote(request), "default_max_age_days": s["feed_max_age_days"]}


@router.post("/calendar/feeds", status_code=201)
def create_feed(body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """`{calendar_ids, detail: busy|titles}`; `edit`+ in each calendar; the path with its token is answered ONCE. A new feed is never remote."""
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
        fid, token, when = cals.new_id("fed"), secrets.token_urlsafe(32), cal_mod._now()
        now = model.iso(when)
        conn.execute("INSERT INTO cal_feeds(id, calendar_ids_json, detail, token_hash, created_by, created_at, token_set_at) VALUES (?,?,?,?,?,?,?)",
                     (fid, json.dumps(ids), detail, _hash(token), principal.user_id, now, now))
        _issue_expiry(conn, fid, when)
        _audit(conn, principal, request, "calendar.feed.create", "calendar_feed", fid, calendars=len(ids), detail=detail)
        return {"feed": _out(_row(conn, fid), _expiry_map(conn), ctx), "path": _path(token)}


@router.post("/calendar/feeds/{fid}/rotate")
def rotate_feed(fid: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """"Renew link": a new token (answered once); the old address stops at once; its expiry is fixed again from now with the CURRENT
    default (`feed_max_age_days`). The remote switch is kept. Creator or admin."""
    _need(conn, principal)
    _feeds_on(conn)
    row = _row(conn, fid)
    with _errors(conn, principal, request):
        ctx = Ctx(conn, principal)
        _own(ctx, row)
        if row["revoked_at"] is not None:
            raise ApiError(409, "bad_state", "הפיד בוטל.")
        token, when = secrets.token_urlsafe(32), cal_mod._now()
        conn.execute("UPDATE cal_feeds SET token_hash = ?, last_used_at = NULL, token_set_at = ? WHERE id = ?", (_hash(token), model.iso(when), fid))
        _issue_expiry(conn, fid, when)
        _audit(conn, principal, request, "calendar.feed.rotate", "calendar_feed", fid)
        return {"feed": _out(_row(conn, fid), _expiry_map(conn), ctx), "path": _path(token)}


@router.post("/calendar/feeds/{fid}/revoke")
def revoke_feed(fid: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Ends the feed (its address answers 404 from now on). Creator or admin."""
    _need(conn, principal)
    row = _row(conn, fid)
    with _errors(conn, principal, request):
        ctx = Ctx(conn, principal)
        _own(ctx, row)
        if row["revoked_at"] is None:
            conn.execute("UPDATE cal_feeds SET revoked_at = ?, remote_enabled = 0 WHERE id = ?", (model.iso(cal_mod._now()), fid))
            _forget_expiry(conn, fid)
            _audit(conn, principal, request, "calendar.feed.revoke", "calendar_feed", fid)
        return {"feed": _out(_row(conn, fid), _expiry_map(conn), ctx)}


@router.put("/calendar/feeds/{fid}/remote")
def set_feed_remote(fid: str, body: Body, request: Request, principal: Principal = Depends(current_principal),
                    conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """CAL-FEED-REVIEW-2351: `{enabled: bool}` - may this feed's address answer on the remote channel (default off). A LOCAL session only
    (switching it from outside is refused, like the tickets module's public keys), feeds on, the feed live; audited. Round 14: ON needs an
    administrator or the creator managing every calendar of the feed, OFF the creator or an administrator; while ON the document is
    busy-only (`detail_effective`)."""
    _need(conn, principal)
    if _remote(request):
        raise ApiError(403, "local_only", LOCAL_ONLY_HE, details={"field": "remote"})
    _feeds_on(conn)
    d = _body(body)
    row = _row(conn, fid)
    with _errors(conn, principal, request):
        if set(d) != {"enabled"} or not isinstance(d["enabled"], bool):
            raise model.Invalid("enabled: true or false", "enabled")
        ctx = Ctx(conn, principal)
        _own(ctx, row)
        if not _may_switch_remote(ctx, row, d["enabled"]):
            raise ApiError(403, "forbidden", REMOTE_MANAGE_HE, details={"field": "remote"})
        if row["revoked_at"] is not None:
            raise ApiError(409, "bad_state", "הפיד בוטל.")
        if bool(row["remote_enabled"]) != d["enabled"]:
            conn.execute("UPDATE cal_feeds SET remote_enabled = ? WHERE id = ?", (1 if d["enabled"] else 0, fid))
            _audit(conn, principal, request, "calendar.feed.remote", "calendar_feed", fid, enabled=d["enabled"])
        return {"feed": _out(_row(conn, fid), _expiry_map(conn), ctx)}


# ---------------------------------------------------------------- the document

_DROP = {0x7F, 0x2028, 0x2029, 0xFEFF}


def _esc(v: str) -> str:
    """RFC 5545 TEXT: control characters (C0, DEL, C1) and Unicode line / paragraph separators are removed (no line or property
    can be injected), then backslash, semicolon and comma are escaped; capped at MAX_TITLE characters."""
    v = "".join(c for c in v if ord(c) >= 32 and ord(c) not in _DROP and not 0x80 <= ord(c) <= 0x9F)[:MAX_TITLE]
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
    """The VCALENDAR text. Reads cal_occurrences / cal_events (start, end, title) and cal_calendars (archived) ONLY - never cal_attendees,
    cal_guest_details, notes, organisers or on-behalf labels. At most MAX_EVENTS entries and about MAX_DOC_BYTES."""
    w0, w1 = model.iso(now - dt.timedelta(days=PAST_DAYS)), model.iso(now + dt.timedelta(days=AHEAD_DAYS))
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SmplWise Arx//Calendar feed//HE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"]
    if calendar_ids:
        marks = ",".join("?" * len(calendar_ids))
        rows = conn.execute(
            f"SELECT o.event_id, o.holder_calendar_id, o.occ_start, o.occ_end, e.title FROM cal_occurrences o JOIN cal_events e ON e.id = o.event_id "
            f"JOIN cal_calendars c ON c.id = o.holder_calendar_id WHERE o.holder_calendar_id IN ({marks}) AND o.state = 'confirmed' AND e.state NOT IN "
            f"('cancelled','rejected','withdrawn','expired') AND c.archived_at IS NULL AND o.occ_end > ? AND o.occ_start < ? ORDER BY o.occ_start LIMIT {MAX_EVENTS}",
            (*calendar_ids, w0, w1)).fetchall()
    else:
        rows = []
    stamp = now.strftime("%Y%m%dT%H%M%SZ")
    size = 0
    for r in rows:
        uid = hashlib.sha256(f"{r['event_id']}|{r['holder_calendar_id']}|{r['occ_start']}".encode()).hexdigest()[:32]
        title = BUSY if detail == "busy" else (_esc(r["title"] or "") or BUSY)
        ev = ["BEGIN:VEVENT", f"UID:{uid}@arx", f"DTSTAMP:{stamp}", f"DTSTART:{_stamp(r['occ_start'])}", f"DTEND:{_stamp(r['occ_end'])}",
              _fold(f"SUMMARY:{title}"), "TRANSP:OPAQUE", "CLASS:PRIVATE" if detail == "busy" else "CLASS:PUBLIC", "END:VEVENT"]
        size += sum(len(x.encode("utf-8")) + 2 for x in ev)
        if size > MAX_DOC_BYTES:
            break
        lines += ev
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


def _rate_ok(key: str, per_min: int) -> bool:
    now = time.monotonic()
    with _RATE_LOCK:
        hits = [t for t in _RATE.get(key, []) if now - t < 60]
        if len(hits) >= per_min:
            _RATE[key] = hits
            return False
        hits.append(now)
        _RATE[key] = hits
        if len(_RATE) > 5000:  # bounded memory: forget the quiet ones
            for k in [k for k, v in _RATE.items() if not v or now - v[-1] >= 60]:
                _RATE.pop(k, None)
        return True


def _client(request: Request, remote: bool) -> str:
    """The client address for the per-address budget: on the remote channel the tunnel's CF-Connecting-IP (the socket peer is the
    tunnel itself), elsewhere the socket peer. Capped; never logged."""
    if remote:
        v = (request.headers.get("cf-connecting-ip") or "").strip()[:64]
        if v:
            return v
    return (request.client.host if request.client else "?")[:64]


def _gone() -> ApiError:
    return ApiError(404, "not_found", "לא נמצא.")


def _creator_calendars(conn: sqlite3.Connection, row: sqlite3.Row) -> list[str]:
    """The feed's calendars that its creator may STILL publish: an existing, active user who still holds `calendar.connect` and `edit`+
    in the calendar (not archived). A local identity is checked with its standing bindings (the second factor was shown when the feed
    was made; a feed is not a session)."""
    uid = row["created_by"]
    try:
        u = conn.execute("SELECT active, disabled_at FROM users WHERE id = ?", (uid,)).fetchone()
    except sqlite3.OperationalError:
        u = conn.execute("SELECT active, NULL AS disabled_at FROM users WHERE id = ?", (uid,)).fetchone()
    if u is None or not u["active"] or u["disabled_at"]:
        return []
    p = Principal(user_id=uid, username="", display_name="", source="local" if str(uid).startswith(LOCAL_ID_PREFIX) else "internal", factor_ok=True)
    if not authorize(conn, p, model.PERM_CONNECT, INSTALLATION).allowed:
        return []
    ctx = Ctx(conn, p)
    out = []
    for cid in json.loads(row["calendar_ids_json"] or "[]"):
        cal = conn.execute("SELECT * FROM cal_calendars WHERE id = ? AND archived_at IS NULL", (cid,)).fetchone()
        if cal is None:
            continue
        role = ctx.role_in(cal)
        if role is not None and model.ROLE_RANK[role] >= model.ROLE_RANK["edit"]:
            out.append(cid)
    return out


def feed_conn(request: Request):
    """The document's read connection: like auth.get_read_conn, but its label (the slow-hold / busy logs) never carries the token."""
    db = request.app.state.db
    with db.connection(mode="read", label="GET /calendar/feed/<token>.ics") as conn:
        _track(request, conn)
        yield conn


@public_router.get("/calendar/feed/{name}")
def feed_document(name: str, request: Request, conn: sqlite3.Connection = Depends(feed_conn)) -> Response:
    """The feed document `<token>.ics` (no signed-in person: a subscriber cannot sign in). The uniform 404 when malformed, unknown, revoked,
    expired, off, or remote without this feed's remote switch; 429 past the per-address or per-feed budget."""
    remote = _remote(request)
    s = model.read_settings(conn)
    if not _rate_ok(f"a|{_client(request, remote)}", s["feed_address_rate_per_min"]):
        raise ApiError(429, "rate_limited", "יותר מדי בקשות.", retryable=True)
    token = name[:-4] if name.endswith(".ics") else ""
    if not TOKEN_RE.fullmatch(token):
        raise _gone()
    if not s["enabled"] or not s["feeds_enabled"]:
        raise _gone()
    h = _hash(token)
    row = conn.execute("SELECT * FROM cal_feeds WHERE token_hash = ? AND revoked_at IS NULL", (h,)).fetchone()
    if row is None or not hmac.compare_digest(row["token_hash"], h):
        raise _gone()
    if remote and not row["remote_enabled"]:
        raise _gone()
    now = cal_mod._now()
    broken, exp = _expires_at(row, _expiry_map(conn))
    if broken or (exp is not None and now >= exp):
        raise _gone()
    if not _rate_ok(f"t|{h}", s["feed_rate_per_min"]):
        raise ApiError(429, "rate_limited", "יותר מדי בקשות.", retryable=True)
    calendar_ids = _creator_calendars(conn, row)
    if not calendar_ids:
        raise _gone()
    body = render(conn, calendar_ids, _effective_detail(row), now)  # round 14, 4A: remote on = busy-only on every channel
    last = row["last_used_at"]
    if not last or model.parse_utc(last, "l") < now - dt.timedelta(minutes=10):
        with request.app.state.db.write_aside(label="calendar.feed.used") as c:
            c.execute("UPDATE cal_feeds SET last_used_at = ? WHERE id = ?", (model.iso(now), row["id"]))
    return Response(content=body.encode("utf-8"), media_type="text/calendar; charset=utf-8",
                    headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
                             "X-Robots-Tag": "noindex, nofollow", "Content-Disposition": 'inline; filename="arx.ics"'})


# ---------------------------------------------------------------- the token never reaches a log line

_TOKEN_IN_PATH = re.compile(r"(/calendar/feed/)[^\s\"?#]+")


class RedactFeedToken(logging.Filter):
    """uvicorn's access line (and any error line) records the request path - the feed address IS the secret; redacted here."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            if isinstance(record.args, tuple) and any(isinstance(a, str) and "/calendar/feed/" in a for a in record.args):
                record.args = tuple(_TOKEN_IN_PATH.sub(r"\1REDACTED", a) if isinstance(a, str) else a for a in record.args)
            if isinstance(record.msg, str) and "/calendar/feed/" in record.msg:
                record.msg = _TOKEN_IN_PATH.sub(r"\1REDACTED", record.msg)
        except Exception:  # noqa: BLE001 - a log line is never lost
            pass
        return True


_FILTER = RedactFeedToken()


def install_log_filter() -> None:
    for name in ("uvicorn.access", "uvicorn.error", "smplwise"):
        lg = logging.getLogger(name)
        if _FILTER not in lg.filters:
            lg.addFilter(_FILTER)


install_log_filter()


__all__ = ["router", "public_router", "render", "DOC_PATH_RE", "RedactFeedToken"]
