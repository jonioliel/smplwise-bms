"""Identity: Supervisor Ingress forwards the authenticated HA user in request headers
(X-Remote-User-Id / -Name / -Display-Name). They are trusted only when the connection comes from the
Supervisor proxy address; no other origin can present an identity. Developer mode (never active inside
the add-on) substitutes a fixed user so the API can run on a workstation.

The first VMS system administrator is chosen explicitly by the HA administrator through the add-on
option `bootstrap_admin_username`; the grant happens once and is recorded in the audit log.
"""
from __future__ import annotations

import sqlite3

from fastapi import Depends, Request

from .audit import audit
from .config import Settings
import time

from .db import Database, database_of, get_setting, new_id, now_iso, permission_revision, read_mode, set_setting
from .errors import unauthenticated
from .rbac import Principal

HEADER_ID = "x-remote-user-id"
HEADER_NAME = "x-remote-user-name"
HEADER_DISPLAY = "x-remote-user-display-name"
DEV_HEADER = "x-sw-dev-user"


def settings_of(request: Request) -> Settings:
    return request.app.state.settings


def get_conn(request: Request):
    db: Database = request.app.state.db
    with db.connection() as conn:
        yield conn


def get_read_conn(request: Request):
    """Deferred, query-only request connection for the busy read paths (see Database.connection)."""
    db: Database = request.app.state.db
    with db.connection(mode="read") as conn:
        yield conn


def _client_host(request: Request) -> str:
    return request.client.host if request.client else ""


def resolve_principal(request: Request, settings: Settings) -> Principal:
    headers = request.headers
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
    """Grant system_admin once to the HA username named in the add-on options."""
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
        conn.execute("COMMIT")
        conn.execute("BEGIN")
    else:
        grant(conn)


def _principal(request: Request, conn: sqlite3.Connection) -> Principal:
    settings = settings_of(request)
    principal = resolve_principal(request, settings)
    touch_user(conn, principal)
    maybe_bootstrap(conn, settings, principal, getattr(request.state, "correlation_id", None))
    return principal


def current_principal(request: Request, conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    return _principal(request, conn)


def current_principal_ro(request: Request, conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
    """The same identity resolution on the request's read-mode connection (handlers that only read)."""
    return _principal(request, conn)
