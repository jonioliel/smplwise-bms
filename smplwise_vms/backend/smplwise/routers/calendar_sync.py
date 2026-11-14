"""CALENDARS-298 phase 2 + CALCONNECT-2330 (server) - external calendar connections, their authorisation, bindings and manual sync
(contract sections 12, 13.5 and 15).

Who: `calendar.connect` (the grant the owner hands out, C10), at installation scope. A connection is changed, authorised, paused, synced
or removed by its owner or a system administrator (owner answer 19); every connect holder sees the list. Binding a calendar needs, on
top, an `edit`+ role in that calendar (owner answer 17: a connection holder cannot publish a calendar he cannot edit). All under the
module gate; every write is audited with ids only (never labels of external accounts, never tokens, never an address).

The connect flow (CALCONNECT-2330, oauth.py): the owner pastes HIS OWN client id (and Google's client secret) - `PUT .../client`; then
`POST .../authorize` starts the provider's flow: Google answers an authorize address to open and, after the approval, the owner pastes
the loopback address his browser landed on (`POST .../authorize/complete`); Microsoft answers a short code for microsoft.com/devicelogin
and the screen polls (`POST .../authorize/poll`). The refresh token is sealed at once. The same flow re-authorises a connection that
needs it ("הרשאה מחדש"). iCal IN takes its secret address (`PUT .../feed`). No route answers a secret; no route opens a provider
connection while the request holds the write lock (each releases it first)."""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request, Response

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import release
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services import connection_store
from ..services.calendar import calendars as cals
from ..services.calendar import model
from ..services.calendar.access import Ctx, Denied, get_visible
from ..services.calendar.events import get_row
from ..services.calendar_sync import credentials, engine, ics, oauth, registry
from ..services.calendar_sync.adapter import PROVIDERS, SyncError
from ._common import db_of as _db
from . import calendar as cal_mod
from .calendar import Body, _audit, _body, _errors, module_gate

router = APIRouter(dependencies=[Depends(module_gate)])


def _now() -> dt.datetime:
    return cal_mod._now()  # looked up at call time: the one route clock of the module (tests replace it)

SETUP_STEPS = {
    "google": ["Create a Google Cloud project and enable the Google Calendar API", "Configure the OAuth consent screen and add yourself as a test user",
               "Create an OAuth client of type 'Desktop app'", "Paste the client id and the client secret into Arx",
               "Press 'connect', approve in your browser, then paste the address the browser landed on (http://127.0.0.1:8749/...) back into Arx"],
    "microsoft": ["Register an application in Microsoft Entra (supported accounts as you need)", "Under Authentication, turn on 'Allow public client flows'",
                  "Add the delegated Microsoft Graph permission Calendars.ReadWrite (or Calendars.Read)", "Paste the application (client) id and the directory into Arx",
                  "Press 'connect' and enter the code Arx shows at microsoft.com/devicelogin"],
    "ics_in": ["Copy the secret iCal address of the calendar you want to read", "Paste it into Arx (it is stored sealed)"],
    "ics_out": ["Create a feed; Arx shows its address once", "Subscribe to it from the calendar application"],
}
MAX_CONNECTIONS = 50

OAUTH_HE = {
    "client_missing": "חסר מזהה הלקוח (Client ID) של האפליקציה שלך אצל הספק.",
    "client_id_invalid": "מזהה הלקוח לא נראה תקין עבור הספק הזה.",
    "tenant_invalid": "הספרייה (tenant) לא תקינה. ברירת המחדל היא common.",
    "client_invalid": "הספק דחה את מזהה הלקוח או את הסוד שלו. יש לבדוק את ההגדרה אצל הספק.",
    "grant_expired": "תוקף בקשת ההרשאה פג. יש ללחוץ שוב על 'התחברות'.",
    "state_mismatch": "הכתובת שהודבקה לא שייכת לבקשת ההרשאה הזו.",
    "paste_invalid": "יש להדביק את כל הכתובת שהדפדפן הגיע אליה (מתחילה ב־http://127.0.0.1:8749/).",
    "denied": "ההרשאה לא אושרה אצל הספק.",
    "provider_refused": "הספק סירב לבקשה.",
    "provider_unavailable": "הספק לא ענה. אפשר לנסות שוב בעוד רגע.",
    "rate_limited": "הספק מגביל כרגע את קצב הבקשות. אפשר לנסות שוב בעוד רגע.",
    "scope_refused": "לא אושרו כל ההרשאות שהיומן צריך. יש לאשר מחדש ולסמן את כל התיבות.",
    "no_refresh_token": "הספק לא החזיר הרשאה מתמשכת. יש לנסות שוב.",
    "feed_refused": "אי אפשר לקרוא מהכתובת הזו (רק https, פורט 443, כתובת ציבורית).",
    "wrong_provider": "הפעולה לא מתאימה לסוג החיבור הזה.",
}


def _oauth_err(exc: oauth.OAuthError) -> ApiError:
    return ApiError(exc.status, exc.code, OAUTH_HE.get(exc.code, "החיבור לספק נכשל."), retryable=exc.code in ("provider_unavailable", "rate_limited"))


def _audit_aside(request: Request, principal: Principal, action: str, rid: str, decision: str = "allowed", reason: str | None = None, **details: Any) -> None:
    with _db(request).write_aside(label=action) as c:
        audit(c, actor=principal, action=action, decision=decision, resource_type="calendar_connection", resource_id=rid, reason=reason,
              request_id=cal_mod._rid(request), details=details or None)


def _need_connect(conn: sqlite3.Connection, principal: Principal) -> None:
    require(conn, principal, model.PERM_CONNECT, INSTALLATION)


def _connection(conn: sqlite3.Connection, cid: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM cal_connections WHERE id = ?", (cid,)).fetchone()
    if row is None:
        raise ApiError(404, "not_found", "החיבור לא נמצא.")
    return row


def _own(ctx: Ctx, row: sqlite3.Row) -> None:
    if not (ctx.admin or row["owner_user_id"] == ctx.principal.user_id):
        raise Denied(model.PERM_CONNECT, row["id"], "owner")


def _owned(conn: sqlite3.Connection, principal: Principal, request: Request, cid: str) -> sqlite3.Row:
    _need_connect(conn, principal)
    row = _connection(conn, cid)
    with _errors(conn, principal, request):
        _own(Ctx(conn, principal), row)
    return row


def _out(conn: sqlite3.Connection, row: sqlite3.Row, data_dir: Any = None) -> dict[str, Any]:
    bs = conn.execute("SELECT id, calendar_id, direction, detail, dedicated FROM cal_sync_bindings WHERE connection_id = ? ORDER BY id", (row["id"],)).fetchall()
    out = {"id": row["id"], "provider": row["provider"], "label": row["label"], "scope": row["scope"], "state": row["state"], "owner": cals.user_label(conn, row["owner_user_id"]),
           "last_sync_at": row["last_sync_at"], "next_sync_at": row["next_sync_at"], "error_code": row["error_code"], "adapter_available": row["provider"] in registry.available(),
           "account_hint": row["account_hint"],
           "bindings": [{"id": b["id"], "calendar_id": b["calendar_id"], "direction": b["direction"], "detail": b["detail"], "dedicated": bool(b["dedicated"])} for b in bs],
           "revision": row["revision"]}
    if data_dir is not None:
        st = credentials.status(conn, data_dir, row["id"])
        needs_client = row["provider"] in ("google", "microsoft")
        out["setup"] = {"client_id_set": st["client_id_set"], "client_secret_set": st["client_secret_set"], "authorized": st["authorized"],
                        "feed_url_set": st["feed_url_set"], "tenant": st["tenant"] if row["provider"] == "microsoft" else None,
                        "ready": (st["authorized"] if needs_client else st["feed_url_set"] if row["provider"] == "ics_in" else True),
                        "pending_flow": oauth.pending(row["id"])}
    return out


@router.get("/calendar/connections")
def list_connections(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _need_connect(conn, principal)
    d = settings_of(request).data_dir
    return {"connections": [_out(conn, r, d) for r in conn.execute("SELECT * FROM cal_connections ORDER BY created_at, id").fetchall()],
            "providers": [{"provider": p, "adapter_available": p in registry.available()} for p in PROVIDERS], "setup_steps": SETUP_STEPS,
            "google_redirect": oauth.GOOGLE_REDIRECT}


@router.post("/calendar/connections", status_code=201)
def add_connection(body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _need_connect(conn, principal)
    d = _body(body)
    with _errors(conn, principal, request):
        if set(d) - {"provider", "label", "scope"}:  # a password or token in the body is refused, never stored
            raise model.Invalid("provider, label and scope only (Arx never takes a password here)", "provider")
        provider = model._choice(d.get("provider"), "provider", PROVIDERS)
        label = model._text(d.get("label"), "label", 1, 80)
        scope = model._choice(d.get("scope", "read"), "scope", ("read", "read_write"))
        if provider == "ics_in" and scope != "read":
            raise model.Invalid("an iCal subscription is read-only", "scope", "connection_read_only")
        if conn.execute("SELECT COUNT(*) FROM cal_connections").fetchone()[0] >= MAX_CONNECTIONS:
            raise model.Invalid("too many connections", "provider", "limit_reached")
        cid = cals.new_id("con")
        conn.execute("INSERT INTO cal_connections(id, provider, label, owner_user_id, scope, state, token_ref, created_at) VALUES (?,?,?,?,?, 'ok', ?, ?)",
                     (cid, provider, label, principal.user_id, scope, cid if provider != "ics_out" else None, model.iso(_now())))
        _audit(conn, principal, request, "calendar.connection.add", "calendar_connection", cid, provider=provider, scope=scope)
        return {"connection": _out(conn, _connection(conn, cid), settings_of(request).data_dir), "setup_steps": SETUP_STEPS[provider]}


# ---------------------------------------------------------------- the connect flow (CALCONNECT-2330)

@router.put("/calendar/connections/{cid}/client")
def put_client(cid: str, body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The owner's OWN OAuth client: `{client_id, client_secret?, tenant?}`. The secret is sealed; the answer carries flags only. A new client
    id drops the old authorisation (it belonged to the old client)."""
    row = _owned(conn, principal, request, cid)
    data_dir = settings_of(request).data_dir
    d = _body(body)
    if row["provider"] not in ("google", "microsoft"):
        raise ApiError(409, "wrong_provider", OAUTH_HE["wrong_provider"])
    with _errors(conn, principal, request):
        if set(d) - {"client_id", "client_secret", "tenant"}:
            raise model.Invalid("client_id, client_secret and tenant only", "client_id")
        client_id = model._text(d.get("client_id"), "client_id", 1, 200).strip()
        tenant = (model._text(d.get("tenant") or credentials.TENANT_DEFAULT, "tenant", 1, 260).strip().lower()) if row["provider"] == "microsoft" else credentials.TENANT_DEFAULT
        secret = d.get("client_secret")
        if secret is not None and (not isinstance(secret, str) or not 1 <= len(secret) <= 512 or any(ord(c) < 32 for c in secret)):
            raise model.Invalid("client_secret: 1-512 printable characters", "client_secret")
    try:
        oauth.validate_client(row["provider"], client_id, tenant)
    except oauth.OAuthError as exc:
        raise _oauth_err(exc) from None
    before = credentials.client(conn, cid)
    changed = bool(before["client_id"]) and (before["client_id"], before["tenant"]) != (client_id, tenant)
    credentials.set_client(conn, cid, client_id, tenant)
    if isinstance(secret, str):
        credentials.set_secret(conn, data_dir, cid, "client_secret", secret)
    if changed:
        credentials.clear_secret(conn, cid, "refresh_token")
        oauth.cancel(cid)
    conn.execute("UPDATE cal_connections SET revision = revision + 1 WHERE id = ?", (cid,))
    _audit(conn, principal, request, "calendar.connection.client", "calendar_connection", cid, secret_set=isinstance(secret, str), authorization_dropped=changed)
    return {"connection": _out(conn, _connection(conn, cid), data_dir)}


@router.put("/calendar/connections/{cid}/feed")
def put_feed_url(cid: str, body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The secret address of an iCal subscription (`{url}`; https or webcal). Checked for syntax and names now and fully (every resolved
    address) on each fetch; sealed; never answered back."""
    row = _owned(conn, principal, request, cid)
    if row["provider"] != "ics_in":
        raise ApiError(409, "wrong_provider", OAUTH_HE["wrong_provider"])
    d = _body(body)
    url = d.get("url")
    if set(d) - {"url"} or not isinstance(url, str) or not 10 <= len(url) <= 2048:
        raise ApiError(422, "validation", "url: the https address of the iCal feed", details={"field": "url"})
    try:
        ics.check_url(url, resolve=False)
    except SyncError:
        raise ApiError(422, "feed_refused", OAUTH_HE["feed_refused"], details={"field": "url"}) from None
    data_dir = settings_of(request).data_dir
    credentials.set_secret(conn, data_dir, cid, "feed_url", ics.normalise_url(url))
    host = ics.host_hint(url)
    conn.execute("UPDATE cal_connections SET account_hint = ?, state = CASE WHEN state = 'error' THEN 'ok' ELSE state END, error_code = NULL, next_sync_at = NULL, "
                 "revision = revision + 1 WHERE id = ?", (host, cid))
    _audit(conn, principal, request, "calendar.connection.feed", "calendar_connection", cid)
    return {"connection": _out(conn, _connection(conn, cid), data_dir)}


@router.post("/calendar/connections/{cid}/authorize")
def authorize(cid: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Starts (or restarts) the provider's consent. Google: `{flow: paste, authorize_url, redirect_prefix, expires_in}`. Microsoft:
    `{flow: device, user_code, verification_url, expires_in, interval}`. The state / verifier / device code never leave the server."""
    row = _owned(conn, principal, request, cid)
    if row["provider"] not in ("google", "microsoft"):
        raise ApiError(409, "wrong_provider", OAUTH_HE["wrong_provider"])
    c = credentials.client(conn, cid)
    scopes = oauth.scopes_for(row["provider"], row["scope"], model.read_settings(conn)["sync_google_scope"])
    release(conn)  # no transaction across the call to the provider
    try:
        if row["provider"] == "google":
            out = oauth.google_start(cid, principal.user_id, c["client_id"], scopes)
        else:
            out = oauth.microsoft_start(cid, principal.user_id, c["client_id"], c["tenant"], scopes)
    except oauth.OAuthError as exc:
        _audit_aside(request, principal, "calendar.connection.authorize_start", cid, "denied", exc.code)
        raise _oauth_err(exc) from None
    _audit_aside(request, principal, "calendar.connection.authorize_start", cid, provider=row["provider"])
    return out


def _connected(request: Request, principal: Principal, cid: str, token: str) -> dict[str, Any]:
    data_dir = settings_of(request).data_dir
    with _db(request).write_aside(label="calendar.connection.authorize") as c:
        credentials.set_secret(c, data_dir, cid, "refresh_token", token)
        c.execute("UPDATE cal_connections SET state = 'ok', error_code = NULL, error_text = NULL, next_sync_at = NULL, revision = revision + 1 WHERE id = ?", (cid,))
        audit(c, actor=principal, action="calendar.connection.authorize", decision="allowed", resource_type="calendar_connection", resource_id=cid,
              request_id=cal_mod._rid(request))
        return {"state": "connected", "connection": _out(c, _connection(c, cid), data_dir)}


@router.post("/calendar/connections/{cid}/authorize/complete")
def authorize_complete(cid: str, body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Google: `{redirect_url}` - the loopback address the browser landed on after the approval. State-checked, single use."""
    row = _owned(conn, principal, request, cid)
    if row["provider"] != "google":
        raise ApiError(409, "wrong_provider", OAUTH_HE["wrong_provider"])
    d = _body(body)
    if set(d) - {"redirect_url"}:
        raise ApiError(422, "validation", "redirect_url only", details={"field": "redirect_url"})
    secret = credentials.secret(conn, settings_of(request).data_dir, cid, "client_secret")
    release(conn)
    try:
        token = oauth.google_complete(cid, principal.user_id, str(d.get("redirect_url") or ""), secret)
    except oauth.OAuthError as exc:
        _audit_aside(request, principal, "calendar.connection.authorize", cid, "denied", exc.code)
        raise _oauth_err(exc) from None
    return _connected(request, principal, cid, token)


@router.post("/calendar/connections/{cid}/authorize/poll")
def authorize_poll(cid: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Microsoft: one poll of the pending device grant: `{state: none|pending|slow_down|denied|expired|connected, interval?}`."""
    row = _owned(conn, principal, request, cid)
    if row["provider"] != "microsoft":
        raise ApiError(409, "wrong_provider", OAUTH_HE["wrong_provider"])
    tenant = credentials.client(conn, cid)["tenant"]
    release(conn)
    try:
        res = oauth.microsoft_poll(cid, principal.user_id, tenant)
    except oauth.OAuthError as exc:
        _audit_aside(request, principal, "calendar.connection.authorize", cid, "denied", exc.code)
        raise _oauth_err(exc) from None
    if res["state"] != "connected":
        return {k: v for k, v in res.items() if k != "refresh_token"}
    return _connected(request, principal, cid, res["refresh_token"])


@router.delete("/calendar/connections/{cid}/authorize", status_code=204)
def authorize_cancel(cid: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    """Cancels a pending consent of this connection (the state / verifier / device code are forgotten)."""
    _owned(conn, principal, request, cid)
    oauth.cancel(cid)
    return Response(status_code=204)


@router.get("/calendar/connections/{cid}/calendars")
def connection_calendars(cid: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _need_connect(conn, principal)
    row = _connection(conn, cid)
    ad = registry.get(row["provider"])
    if ad is None:
        raise ApiError(409, "adapter_unavailable", "אין עדיין מתאם לספק הזה.", details={"provider": row["provider"]})
    info = engine.connection_info(row)
    release(conn)  # the provider is asked with no transaction open
    try:
        items = ad.list_calendars(info)
    except SyncError as exc:
        status = 409 if exc.code in ("needs_reauth", "not_authorized", "auth_expired", "feed_missing", "client_missing") else 429 if exc.code == "rate_limited" else 502
        raise ApiError(status, "provider_error", "הספק לא ענה.", retryable=status != 409, details={"code": exc.code}) from None
    return {"calendars": [{"id_ref": c.id_ref, "name": c.name, "can_write": c.can_write, "is_primary": c.is_primary} for c in items]}


def _set_state(conn: sqlite3.Connection, principal: Principal, request: Request, cid: str, allowed_from: tuple[str, ...], to: str, action: str) -> dict[str, Any]:
    _need_connect(conn, principal)
    row = _connection(conn, cid)
    with _errors(conn, principal, request):
        _own(Ctx(conn, principal), row)
        if row["state"] not in allowed_from:
            raise ApiError(409, "bad_state", "אי אפשר לבצע את הפעולה במצב הנוכחי של החיבור.", details={"state": row["state"]})
        nxt = None if to == "paused" else model.iso(_now())
        conn.execute("UPDATE cal_connections SET state = ?, next_sync_at = ?, error_code = NULL, error_text = NULL, revision = revision + 1 WHERE id = ?", (to, nxt, cid))
        _audit(conn, principal, request, action, "calendar_connection", cid)
        return {"connection": _out(conn, _connection(conn, cid), settings_of(request).data_dir)}


@router.post("/calendar/connections/{cid}/pause")
def pause_connection(cid: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return _set_state(conn, principal, request, cid, ("ok", "error"), "paused", "calendar.connection.pause")


@router.post("/calendar/connections/{cid}/resume")
def resume_connection(cid: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    # owner answer 21 as a setting: with `reauth_and_continue` (default) a connection waiting for a new authorisation also offers a manual
    # "continue" - the next sync tries again and returns to needs_reauth if the provider still refuses; `reauth_only` keeps the old rule
    allowed = ("paused", "error", "needs_reauth") if model.read_settings(conn)["reauth_mode"] == "reauth_and_continue" else ("paused", "error")
    return _set_state(conn, principal, request, cid, allowed, "ok", "calendar.connection.resume")


@router.delete("/calendar/connections/{cid}", status_code=204)
def remove_connection(cid: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    """Best-effort revoke at the provider (no transaction open), then the local delete: tokens, bindings and their map rows go; Arx entries stay (13.5)."""
    row = _owned(conn, principal, request, cid)
    ad = registry.get(row["provider"])
    info = engine.connection_info(row)
    release(conn)
    oauth.cancel(cid)
    if ad is not None:
        try:
            ad.revoke(info)
        except Exception:  # noqa: BLE001 - revoking is best effort; the local delete always happens
            pass
    with _db(request).write_aside(label="calendar.connection.remove") as c:
        ids = [b["id"] for b in c.execute("SELECT id FROM cal_sync_bindings WHERE connection_id = ?", (cid,)).fetchall()]
        for bid in ids:
            c.execute("DELETE FROM cal_sync_map WHERE binding_id = ?", (bid,))
        c.execute("UPDATE cal_calendars SET sync_binding_id = NULL WHERE sync_binding_id IN (SELECT id FROM cal_sync_bindings WHERE connection_id = ?)", (cid,))
        c.execute("DELETE FROM cal_sync_bindings WHERE connection_id = ?", (cid,))
        c.execute("DELETE FROM settings WHERE key IN (?, ?)", (engine._lease_key(cid), f"calendar.sync.manual.{cid}"))
        credentials.clear_all(c, cid)
        c.execute("DELETE FROM cal_connections WHERE id = ?", (cid,))
        audit(c, actor=principal, action="calendar.connection.remove", decision="allowed", resource_type="calendar_connection", resource_id=cid,
              request_id=cal_mod._rid(request), details={"bindings": len(ids)})
    return Response(status_code=204)


@router.post("/calendar/connections/{cid}/sync")
def sync_now(cid: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Manual "sync now": at most once per `sync_manual_min_interval_s` (default 60) per connection. The provider is asked with no
    transaction open (engine.run_connection)."""
    row = _owned(conn, principal, request, cid)
    settings = model.read_settings(conn)
    now = _now()
    key = f"calendar.sync.manual.{cid}"
    from ..db import get_setting, set_setting  # noqa: PLC0415

    last = get_setting(conn, key)
    gap = settings["sync_manual_min_interval_s"]
    if last and gap and now < model.parse_utc(last, "last") + dt.timedelta(seconds=gap):
        wait = int((model.parse_utc(last, "last") + dt.timedelta(seconds=gap) - now).total_seconds())
        raise ApiError(429, "rate_limited", "אפשר לסנכרן ידנית פעם בדקה.", retryable=True, details={"retry_after_s": wait})
    set_setting(conn, key, model.iso(now))
    release(conn)
    data_dir = settings_of(request).data_dir
    report = engine.run_connection(_db(request), data_dir, row["id"], now)
    _audit_aside(request, principal, "calendar.connection.sync", cid, **{k: v for k, v in report.items() if isinstance(v, (int, str))})
    with _db(request).connection(mode="read", label="calendar.connection.sync") as c:
        return {"report": report, "connection": _out(c, _connection(c, cid), data_dir)}


@router.put("/calendar/calendars/{cid}/binding")
def put_binding(cid: str, body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Binds a calendar to one external calendar, or (a null body field `connection_id`) removes the binding. One binding per calendar."""
    _need_connect(conn, principal)
    ctx = Ctx(conn, principal, settings_of(request).data_dir)
    cal = get_visible(ctx, cid)
    d = _body(body)
    with _errors(conn, principal, request):
        role = ctx.role_in(cal)
        if role is None or model.ROLE_RANK[role] < model.ROLE_RANK["edit"]:
            raise Denied("calendar.role", cid, "edit")
        old = conn.execute("SELECT * FROM cal_sync_bindings WHERE calendar_id = ?", (cid,)).fetchone()
        if d.get("connection_id") is None:
            if old is not None:
                conn.execute("DELETE FROM cal_sync_map WHERE binding_id = ?", (old["id"],))
                conn.execute("DELETE FROM cal_sync_bindings WHERE id = ?", (old["id"],))
                conn.execute("UPDATE cal_calendars SET sync_binding_id = NULL WHERE id = ?", (cid,))
                _audit(conn, principal, request, "calendar.binding.set", "calendar", cid, removed=True)
            return {"binding": None}
        if set(d) - {"connection_id", "external_calendar_ref", "direction", "detail", "dedicated"}:
            raise model.Invalid("unknown binding field", "connection_id")
        crow = _connection(conn, str(d["connection_id"]))
        ref = model._text(d.get("external_calendar_ref"), "external_calendar_ref", 1, 300)
        direction = d.get("direction", "export")
        detail = d.get("detail", "busy")
        dedicated = d.get("dedicated", False)
        if not isinstance(dedicated, bool):
            raise model.Invalid("dedicated: true or false", "dedicated")
        engine.validate_binding(crow["provider"], direction, detail, dedicated, crow["scope"])
        if old is not None and old["connection_id"] == crow["id"] and engine.open_ref(settings_of(request).data_dir, old) == ref:
            # the same external calendar: settings change in place (map and sync token stay, so nothing is imported twice)
            if (old["detail"], old["direction"]) != (detail, direction):
                conn.execute("UPDATE cal_sync_map SET last_pushed_revision = NULL WHERE binding_id = ? AND origin = 'arx'", (old["id"],))  # re-publish at the new level
            conn.execute("UPDATE cal_sync_bindings SET direction = ?, detail = ?, dedicated = ?, revision = revision + 1 WHERE id = ?", (direction, detail, int(dedicated), old["id"]))
            bid = old["id"]
        else:
            if old is not None:  # another external calendar: nothing of the old link is trusted
                conn.execute("DELETE FROM cal_sync_map WHERE binding_id = ?", (old["id"],))
                conn.execute("DELETE FROM cal_sync_bindings WHERE id = ?", (old["id"],))
            bid = cals.new_id("bnd")
            conn.execute("INSERT INTO cal_sync_bindings(id, connection_id, calendar_id, external_calendar_id_sealed, direction, detail, dedicated, created_by) VALUES (?,?,?,?,?,?,?,?)",
                         (bid, crow["id"], cid, connection_store.seal_calendar_sync(settings_of(request).data_dir, bid, "ref", ref), direction, detail, int(dedicated), principal.user_id))
        conn.execute("UPDATE cal_calendars SET sync_binding_id = ?, updated_at = ?, revision = revision + 1 WHERE id = ?", (bid, model.iso(_now()), cid))
        conn.execute("UPDATE cal_connections SET next_sync_at = NULL WHERE id = ? AND state IN ('ok','error')", (crow["id"],))  # due on the next scheduler tick
        _audit(conn, principal, request, "calendar.binding.set", "calendar", cid, direction=direction, detail=detail, dedicated=dedicated, connection_id=crow["id"])
        return {"binding": {"id": bid, "connection_id": crow["id"], "calendar_id": cid, "direction": direction, "detail": detail, "dedicated": dedicated}}


@router.get("/calendar/sync/flags")
def sync_flags(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """CALENDARS-UI-2310: the entries the sync flagged for a human decision (C9: both kept), for the "סומנו להחלטה" list of the connections
    screen and the week view's side-by-side mark. Only calendars where the caller holds `edit`+ (the role that may resolve a flag)."""
    ctx = Ctx(conn, principal)
    out = []
    for ev in conn.execute("SELECT * FROM cal_events WHERE sync_flag IS NOT NULL AND state NOT IN ('cancelled','rejected','withdrawn','expired') ORDER BY starts_at LIMIT 500").fetchall():
        cal = conn.execute("SELECT * FROM cal_calendars WHERE id = ?", (ev["calendar_id"],)).fetchone()
        role = ctx.role_in(cal) if cal is not None and ctx.can_see(cal) else None
        if role is None or model.ROLE_RANK[role] < model.ROLE_RANK["edit"]:
            continue
        out.append({"event_id": ev["id"], "calendar": {"id": cal["id"], "name": cal["name"], "color": cal["color"]}, "title": ev["title"], "start": ev["starts_at"],
                    "end": ev["ends_at"], "flag": ev["sync_flag"], "source": ev["source"], "state": ev["state"], "revision": ev["revision"]})
    return {"flags": out}


@router.post("/calendar/events/{eid}/sync-resolve")
def resolve_sync_flag(eid: str, body: Body, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The human decision on an entry flagged by the sync (C9): `keep` clears the flag, `cancel` cancels the entry. Needs `edit`+ in its calendar."""
    ctx = Ctx(conn, principal, settings_of(request).data_dir)
    ev, cal, role = get_row(ctx, eid)
    d = _body(body)
    with _errors(conn, principal, request):
        if role is None or model.ROLE_RANK[role] < model.ROLE_RANK["edit"]:
            raise Denied("calendar.role", cal["id"], "edit")
        if d.get("revision") != ev["revision"]:
            raise ApiError(409, "stale", "האירוע עודכן בינתיים. רענן ונסה שוב.", details={"revision": ev["revision"]})
        resolution = model._choice(d.get("resolution"), "resolution", ("keep", "cancel"))
        if not ev["sync_flag"]:
            raise ApiError(409, "bad_state", "האירוע לא מסומן לטיפול.", details={"state": ev["state"]})
        engine.resolve_flag(conn, model.read_settings(conn), ev, resolution, principal.user_id, _now())
        _audit(conn, principal, request, "calendar.sync.resolve", "calendar_event", eid, resolution=resolution, flag=ev["sync_flag"])
        fresh = conn.execute("SELECT * FROM cal_events WHERE id = ?", (eid,)).fetchone()
        return {"event_id": eid, "state": fresh["state"], "sync_flag": fresh["sync_flag"]}


__all__ = ["router"]
