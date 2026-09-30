"""Identity: Supervisor Ingress forwards the authenticated HA user in request headers
(X-Remote-User-Id / -Name / -Display-Name). They are trusted only when the connection comes from the
Supervisor proxy address; no other origin can present an identity. Developer mode (never active inside
the add-on) substitutes a fixed user so the API can run on a workstation.

The first VMS system administrator is chosen explicitly by the HA administrator through the add-on
option `bootstrap_admin_username`; the grant happens once and is recorded in the audit log.
"""
from __future__ import annotations

import sqlite3
from typing import Callable

from fastapi import Depends, Request

from .audit import audit
from .config import Settings
import time

from .db import Database, commit_now, database_of, get_setting, new_id, now_iso, permission_revision, read_mode, release, set_setting, unlocked
from .errors import unauthenticated
from .rbac import Principal
from .remote_channel import is_remote

HEADER_ID = "x-remote-user-id"
HEADER_NAME = "x-remote-user-name"
HEADER_DISPLAY = "x-remote-user-display-name"
DEV_HEADER = "x-sw-dev-user"


def settings_of(request: Request) -> Settings:
    return request.app.state.settings


def _track(request: Request, conn: sqlite3.Connection) -> None:
    conns = getattr(request.state, "sw_conns", None)
    if conns is None:
        conns = request.state.sw_conns = []
    conns.append(conn)


PRE_RESOLVED = "sw_principal"  # request.state key: the remote principal resolved before the write transaction


def resolve_remote_first(request: Request) -> Principal:
    """The remote channel authenticates BEFORE the request's write transaction (round-10 §6.1 / CR-008 §9 follow-up,
    2026-09-30). get_conn takes the write gate - a turn in the process-wide FIFO queue of writers - and SQLite's write
    lock at BEGIN IMMEDIATE; before this, an unauthenticated POST from the internet took that turn only to be refused
    with 401 once it had it, so a flood of them queued in front of every legitimate writer. Now:
    - no credential, an unknown / expired / revoked cookie, a garbage, expired or already-refused bearer token: 401 from
      memory, the gate never touched;
    - a live session or a bearer validated within BEARER_CACHE_S: answered from memory (offline=True);
    - NeedsUnlock (Home Assistant must be asked, or a refusal / sign-in row written): resolved here, with no connection of
      the request open at all - HA is asked without any lock and the rows go through their own short transactions.
    Only then does get_conn open the write transaction. The principal is kept in the request state for _principal."""
    from .services.ha_user_auth import NeedsUnlock

    settings = settings_of(request)
    try:
        principal = resolve_principal(request, settings, offline=True)
    except NeedsUnlock:
        principal = resolve_principal(request, settings)
    setattr(request.state, PRE_RESOLVED, principal)
    return principal


def _pre_resolved(request: Request) -> Principal | None:
    """The principal resolve_remote_first found, while its session is still in the store. A session dropped while the
    request waited for its write turn (a revoke, a sign-out) resolves again, exactly as a request arriving now would."""
    principal = getattr(request.state, PRE_RESOLVED, None)
    if principal is None:
        return None
    from .services import ha_user_auth

    s = ha_user_auth.session_of(request)
    if s is None or ha_user_auth.STORE.peek(s.sid) is None:
        return None
    return principal


def get_conn(request: Request):
    db: Database = request.app.state.db
    if is_remote(request) and getattr(request.state, PRE_RESOLVED, None) is None:
        resolve_remote_first(request)  # 401 here never touches the write gate
    with db.connection(label=f"{request.method} {request.url.path}") as conn:
        _track(request, conn)
        yield conn


def get_read_conn(request: Request):
    """Deferred, query-only request connection for the busy read paths (see Database.connection)."""
    db: Database = request.app.state.db
    with db.connection(mode="read", label=f"{request.method} {request.url.path}") as conn:
        _track(request, conn)
        yield conn


def release_conns(conns: list[sqlite3.Connection]) -> None:
    """Commit the request's connections when its response starts, before the body is sent (main.CommitBeforeSend).
    FastAPI closes a dependency with yield only after the whole response went out, so without this a download (an
    export, a bundle, a backup) or any slow client held the write lock for the whole transfer."""
    for conn in conns:
        release(conn)


def _client_host(request: Request) -> str:
    return request.client.host if request.client else ""


def resolve_principal(request: Request, settings: Settings, offline: bool = False) -> Principal:
    headers = request.headers
    if is_remote(request):
        # CR-008: the /arx channel never takes identity from headers (the middleware already dropped them) and never
        # uses the developer identity; only an Arx session cookie or an HA bearer token validated against HA core
        from .services import ha_user_auth

        return ha_user_auth.remote_principal(request, settings, offline=offline)
    if settings.dev_user and not settings.in_addon:
        username = headers.get(DEV_HEADER) or settings.dev_user
        return Principal(user_id=f"dev-{username}", username=username, display_name=username, source="dev")
    if _client_host(request) not in settings.trusted_proxies:
        raise unauthenticated("untrusted_origin", "הגישה מותרת רק דרך Home Assistant Ingress.")
    user_id = headers.get(HEADER_ID)
    if not user_id:
        raise unauthenticated(
            "identity_missing",
            "Home Assistant לא העביר זהות משתמש בבקשה. נדרש Supervisor שמעביר כותרות X-Remote-User; ראה DOCS.",
        )
    return Principal(
        user_id=user_id,
        username=headers.get(HEADER_NAME, ""),
        display_name=headers.get(HEADER_DISPLAY, "") or headers.get(HEADER_NAME, ""),
        source="ingress",
    )


TOUCH_EVERY_S = 60
_touched: dict[str, float] = {}  # fallback for connections outside a Database (tests, side tools)


def touch_user(conn: sqlite3.Connection, principal: Principal, force: bool = False) -> bool:
    """Upsert the user row and its last_seen_at — at most once a minute per user (the row is the same anyway),
    through a side transaction when the request runs read-only. Returns True when a row was written."""
    key = f"{principal.user_id}|{principal.username}|{principal.display_name}"
    stamp = time.time()
    db = database_of(conn)
    touched = db.touched if db is not None else _touched
    if not force and stamp - touched.get(key, 0.0) < TOUCH_EVERY_S:
        return False
    now = now_iso()
    sql = """INSERT INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at)
           VALUES (?, ?, ?, ?, 1, ?, ?)
           ON CONFLICT(id) DO UPDATE SET username = excluded.username, display_name = excluded.display_name,
                                         last_seen_at = excluded.last_seen_at"""
    args = (principal.user_id, principal.username, principal.display_name, principal.source, now, now)
    if db is not None and read_mode(conn):
        with db.write_aside() as w:
            w.execute(sql, args)
    else:
        conn.execute(sql, args)
    touched[key] = stamp
    return True


def maybe_bootstrap(conn: sqlite3.Connection, settings: Settings, principal: Principal, request_id: str | None) -> None:
    """Grant system_admin once to the HA username named in the add-on options - through Ingress only: never on the
    CR-008 remote channel, whatever the username."""
    if principal.source == "remote":
        return
    if not settings.bootstrap_admin_username:
        return
    if get_setting(conn, "bootstrap_state", "pending") != "pending":
        return
    if principal.username != settings.bootstrap_admin_username:
        return

    def grant(w: sqlite3.Connection) -> None:
        if get_setting(w, "bootstrap_state", "pending") != "pending":
            return  # another request won the race
        w.execute(
            """INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision,
                                    assigned_by, created_at)
               VALUES (?, 'user', ?, 'system_admin', 'installation', '*', 'allow', ?, 'bootstrap', ?)""",
            (new_id(), principal.user_id, permission_revision(w), now_iso()),
        )
        set_setting(w, "bootstrap_state", f"done:{principal.user_id}")
        audit(w, actor=principal, action="rbac.bootstrap_admin", decision="granted", resource_type="user",
              resource_id=principal.user_id, reason="bootstrap_admin_username matched", request_id=request_id)

    db = database_of(conn) if read_mode(conn) else None
    if db is not None:
        with db.write_aside() as w:
            grant(w)
        # a deferred read transaction keeps the snapshot it started with: restart it so this very request
        # (typically the first /me of the admin) already sees the new binding
        commit_now(conn)
    else:
        grant(conn)


def _principal(request: Request, conn: sqlite3.Connection) -> Principal:
    settings = settings_of(request)
    pre = _pre_resolved(request) if is_remote(request) else None
    if pre is not None:
        principal = pre  # get_conn resolved it before the write transaction (resolve_remote_first)
    elif is_remote(request):
        from .services.ha_user_auth import NeedsUnlock

        try:
            # from memory only while this request holds its write lock: a live session or a recently validated token
            principal = resolve_principal(request, settings, offline=True)
        except NeedsUnlock:
            # Home Assistant must be asked (a new, stale or re-validated token) or a refusal row written: never under
            # the request's write lock - the audit's own connection would wait for this very lock (2026-09-29 review)
            with unlocked(conn):
                principal = resolve_principal(request, settings)
    else:
        principal = resolve_principal(request, settings)
    touch_user(conn, principal)
    maybe_bootstrap(conn, settings, principal, getattr(request.state, "correlation_id", None))
    return principal


def current_principal(request: Request, conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    return _principal(request, conn)


def current_principal_ro(request: Request, conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
    """The same identity resolution on the request's read-mode connection (handlers that only read)."""
    return _principal(request, conn)


def read_gate(check: Callable[[sqlite3.Connection, Principal], None]):
    """A permission dependency on the READ connection, for the raw-body routes (review L7; the pattern access_groups
    introduced in T082). Such a route declares `principal = Depends(<gate>), raw = Depends(<body reader>), conn =
    Depends(get_conn)` in this order: the permission is checked (a refusal is audited aside) BEFORE the body is read, and
    the write connection - BEGIN IMMEDIATE, SQLite's single write lock - is only opened AFTER the body has streamed in,
    so a slow or stalled client never holds the lock while its body trickles. `check(conn, principal)` raises to refuse."""

    def gate(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
        check(conn, principal)
        return principal

    return gate
