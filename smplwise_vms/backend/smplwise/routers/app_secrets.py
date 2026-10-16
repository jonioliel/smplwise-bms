"""הגדרות › חיבורים › סודות (TKSECRETS2): the in-app secrets store (services/secrets_store.py) - the go2rtc API password, the
WisKey stations' camera password, the WisKey background token, the OpenAI API key and the push relay key, which used to be add-on
options of type `password`.

Every route: `system.configure` at installation scope (the system administrator, as the NVR connection), checked FIRST - the
401 / 403 and its audit row come before the body is parsed. Bodies are strict (`extra=forbid`), small, JSON only. None of these
routes is reachable on the remote channel (remote_channel.BLOCKED_ON_REMOTE). A value is WRITE-ONLY: no answer, audit row, log line
or error carries it or its ciphertext - the answers say `configured`, the state, when, who and the source; the audit rows name the
secret only. The connection test exists where a probe already did (go2rtc's API, a WisKey station's camera through go2rtc) and
answers an outcome code, never the value."""
from __future__ import annotations

import dataclasses
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, get_conn, read_gate, settings_of
from ..config import Settings
from ..db import unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services import secrets_store
from ..services.connection_store import SecretError
from .nvr_connection import _parse, _raw_body

router = APIRouter()

PERMISSION = "system.configure"


class SaveIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    value: str = Field(min_length=1, max_length=secrets_store.VALUE_MAX)


class TestIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    value: str | None = Field(default=None, max_length=secrets_store.VALUE_MAX)  # a candidate to test before saving; absent = the stored one


_admin_ro = read_gate(lambda conn, principal: require(conn, principal, PERMISSION, INSTALLATION))


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _spec(name: str) -> secrets_store.SecretSpec:
    spec = secrets_store.BY_NAME.get(name)
    if spec is None:
        raise ApiError(404, "secret_unknown", "הסוד המבוקש אינו מוכר.")
    return spec


def _clean(value: str) -> str:
    """Surrounding whitespace of a pasted value is dropped; a control character inside is refused (422)."""
    v = value.strip()
    if not v:
        raise ApiError(422, "validation", "יש להזין ערך.", details={"fields": ["value"]})
    if any(ord(ch) < 32 or ord(ch) == 127 for ch in v):
        raise ApiError(422, "validation", "הערך מכיל תווים לא חוקיים.", details={"fields": ["value"]})
    return v


def _item(conn: sqlite3.Connection, settings: Settings, name: str) -> dict[str, Any]:
    return next(s for s in secrets_store.status(conn, settings) if s["name"] == name)


@router.get("/system/secrets")
def list_secrets(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, PERMISSION, INSTALLATION)
    settings = settings_of(request)
    return {"secrets": secrets_store.status(conn, settings), "in_addon": settings.in_addon}


@router.put("/system/secrets/{name}")
def save_secret(name: str, request: Request, principal: Principal = Depends(_admin_ro), raw: bytes = Depends(_raw_body),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, PERMISSION, INSTALLATION)
    spec = _spec(name)
    body: SaveIn = _parse(request, raw, SaveIn)
    value = _clean(body.value)
    try:
        secrets_store.set_secret(conn, settings_of(request).data_dir, name, value, principal.user_id)
    except SecretError:
        audit(conn, actor=principal, action="secret.update", decision="denied", resource_type="secret", resource_id=name, reason="secret_store_unavailable",
              request_id=_rid(request), details={"name": name})
        raise ApiError(500, "secret_store_unavailable", "לא ניתן לשמור את הסוד בצורה מוצפנת; בדקו את תיקיית הנתונים.") from None
    audit(conn, actor=principal, action="secret.update", decision="allowed", resource_type="secret", resource_id=name, request_id=_rid(request),
          details={"name": name, "restart_required": spec.restart_required})
    secrets_store.apply_live(request.app, name, value)
    return {"saved": True, "restart_required": spec.restart_required, "secret": _item(conn, settings_of(request), name)}


@router.delete("/system/secrets/{name}")
def clear_secret(name: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, PERMISSION, INSTALLATION)
    spec = _spec(name)
    had = secrets_store.clear_secret(conn, name, principal.user_id)
    audit(conn, actor=principal, action="secret.clear", decision="allowed", resource_type="secret", resource_id=name, request_id=_rid(request),
          details={"name": name, "had_value": had, "restart_required": spec.restart_required})
    secrets_store.apply_live(request.app, name, None)
    return {"cleared": True, "restart_required": spec.restart_required, "secret": _item(conn, settings_of(request), name)}


# ---------------------------------------------------------------- the connection test (an outcome code, never the value)

def _stored_or_candidate(conn: sqlite3.Connection, settings: Settings, name: str, candidate: str | None) -> str | None:
    if candidate is not None:
        return _clean(candidate)
    row = secrets_store.get_row(conn, name)
    if row is not None:
        try:
            return secrets_store.read_value(settings.data_dir, row)
        except SecretError:
            raise ApiError(422, "secret_unreadable", "לא ניתן לקרוא את הסוד השמור - יש להזין אותו מחדש.", details={"field": "value"}) from None
    return secrets_store.legacy_value(settings, secrets_store.BY_NAME[name])


def _probe_go2rtc(settings: Settings, value: str) -> str:
    from ..services import go2rtc as g2

    if not settings.go2rtc_url:
        return "not_configured"
    if not settings.go2rtc_user:
        return "username_missing"
    try:
        g2.Go2rtc(dataclasses.replace(settings, go2rtc_password=value)).info()
    except ApiError as exc:
        status = (exc.details or {}).get("status")
        if status in (401, 403):
            return "unauthorized"
        return "unreachable" if exc.code == "media_unavailable" else "error"
    return "ok"


def _probe_wiskey(conn: sqlite3.Connection, settings: Settings, value: str) -> str:
    """The shared account against the first online station with a camera and no account of its own, the way the camera still
    route pulls it, but on a throwaway go2rtc stream in the smplwise_ namespace that is deleted right after (the live station stream
    is never touched). KNOWN LIMIT: go2rtc < 1.9.14 logs the whole source URL when it creates a stream, so the candidate password
    reaches go2rtc's own log once per test on those versions - Arx cannot prevent that (the source must be given to go2rtc), it can
    only keep the password out of Arx's logs and out of any lasting stream. A failure cannot tell a wrong password from a camera
    that did not answer: `station_failed` says so."""
    from ..services import go2rtc as g2
    from ..services import intercom_sync

    if not settings.go2rtc_url:
        return "not_configured"
    if not settings.wiskey_user:
        return "username_missing"
    _, overview = intercom_sync.SYNC.served(settings)
    if overview is None:
        return "wiskey_unavailable"
    overrides = {r[0] for r in conn.execute("SELECT station_id FROM wiskey_station_credentials").fetchall()}
    for station in overview.get("stations", []):
        if not station.get("camera_entity") or not station.get("online") or station["id"] in overrides:
            continue
        host = intercom_sync.SYNC.station_host(settings, station["id"])
        if not host:
            continue
        # Delta review S-4: a THROWAWAY stream name (smplwise_ namespace), never the station's live stream - a candidate password
        # must not re-point what the live still route uses - deleted right after, whatever the outcome.
        probe = g2.wiskey_probe_stream_name()
        client = g2.Go2rtc(settings)
        try:
            source = g2.wiskey_rtsp_url(host, settings.wiskey_user, value)
            with unlocked(conn):
                try:
                    client.frame_jpeg(probe, source)
                finally:
                    client.discard_probe_stream(probe)
        except ApiError as exc:
            status = (exc.details or {}).get("status")
            if exc.code == "media_unavailable":
                return "unreachable"
            if status in (401, 403):
                return "go2rtc_unauthorized"
            return "station_failed"
        return "ok"
    return "no_station"


@router.post("/system/secrets/{name}/test")
def test_secret(name: str, request: Request, principal: Principal = Depends(_admin_ro), raw: bytes = Depends(_raw_body),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, PERMISSION, INSTALLATION)
    spec = _spec(name)
    if spec.test is None:
        raise ApiError(422, "secret_not_testable", "לסוד הזה אין בדיקת חיבור.")
    body: TestIn = _parse(request, raw, TestIn)
    settings = settings_of(request)
    value = _stored_or_candidate(conn, settings, name, body.value)
    if not value:
        raise ApiError(422, "secret_not_set", "אין ערך לבדוק: יש להזין ערך או לשמור אחד.", details={"field": "value"})
    wait = request.app.state.connection_probe_limiter.take(principal.user_id or principal.username or "?")
    if wait:
        audit(conn, actor=principal, action="secret.test", decision="denied", resource_type="secret", resource_id=name, reason="rate_limited", request_id=_rid(request),
              details={"name": name})
        raise ApiError(429, "rate_limited", f"יותר מדי בדיקות חיבור; אפשר לנסות שוב בעוד {wait} שניות.", retryable=True, details={"retry_after_s": wait})
    outcome = _probe_go2rtc(settings, value) if spec.test == "go2rtc" else _probe_wiskey(conn, settings, value)
    audit(conn, actor=principal, action="secret.test", decision="allowed", resource_type="secret", resource_id=name, request_id=_rid(request),
          details={"name": name, "outcome": outcome, "candidate": body.value is not None})
    return {"ok": outcome == "ok", "code": outcome}
