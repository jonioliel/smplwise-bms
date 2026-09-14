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
from .db import Database, get_setting, new_id, now_iso, permission_revision, set_setting
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


def touch_user(conn: sqlite3.Connection, principal: Principal) -> None:
    now = now_iso()
    conn.execute(
        """INSERT INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at)
           VALUES (?, ?, ?, ?, 1, ?, ?)
           ON CONFLICT(id) DO UPDATE SET username = excluded.username, display_name = excluded.display_name,
                                         last_seen_at = excluded.last_seen_at""",
        (principal.user_id, principal.username, principal.display_name, principal.source, now, now),
    )


def maybe_bootstrap(conn: sqlite3.Connection, settings: Settings, principal: Principal, request_id: str | None) -> None:
    """Grant system_admin once to the HA username named in the add-on options."""
    if not settings.bootstrap_admin_username:
        return
    if get_setting(conn, "bootstrap_state", "pending") != "pending":
        return
    if principal.username != settings.bootstrap_admin_username:
        return
    conn.execute(
        """INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision,
                                assigned_by, created_at)
           VALUES (?, 'user', ?, 'system_admin', 'installation', '*', 'allow', ?, 'bootstrap', ?)""",
        (new_id(), principal.user_id, permission_revision(conn), now_iso()),
    )
    set_setting(conn, "bootstrap_state", f"done:{principal.user_id}")
    audit(conn, actor=principal, action="rbac.bootstrap_admin", decision="granted", resource_type="user",
          resource_id=principal.user_id, reason="bootstrap_admin_username matched", request_id=request_id)


def current_principal(request: Request, conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    settings = settings_of(request)
    principal = resolve_principal(request, settings)
    touch_user(conn, principal)
    maybe_bootstrap(conn, settings, principal, getattr(request.state, "correlation_id", None))
    return principal
