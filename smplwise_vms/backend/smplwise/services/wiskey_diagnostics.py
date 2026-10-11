"""WisKey diagnostics, B0: "what WisKey sees Arx as" (read-only; system administrators;
ported onto 2.4.4 as CR-036 slice S1).

Decisions D-001 / D-004 / D-006 turn on facts only WisKey can state: which identity each Arx channel really has, what that
identity may read, whether its scope is narrow, whether the connection is locked, whether `subscribe` works. This module asks
WisKey's `authorization/session` once per identity and shows the answer - nothing is decided from it, nothing is written, and
no person field is involved (the result carries areas, scope and security state only):

- `service`: the add-on's own Home Assistant user (SUPERVISOR_TOKEN, an administrator today) - the session that also carries
  the existing writes (D-004);
- `background`: the dedicated non-administrator account the OWNER creates after B0 (`wiskey_background_token`), on its own
  session. Without it the channel shares the service identity, and the findings say so;

B0 also probed a third identity - the signed-in operator, under their own Home Assistant token in `/arx`. CR-036 (owner
decision 2026-10-03, item 5: Arx RBAC is the single authority for actions started from Arx) needs no per-operator Home
Assistant identity, so that probe was not ported: every Arx operator reaches WisKey only through the add-on's channels, and
the add-on never sends a user's own token to WisKey.

`findings` are plain codes with a level (`warn` / `info`) that the screen words in Hebrew; they are derived only from the
projected answers. An unrecognised enum value is shown as `unknown`, never as a permission (ARX_DECISIONS_REPLY_HE.md
section 5)."""
from __future__ import annotations

import datetime
from typing import Any

from ..config import Settings
from . import ha_client, intercom_client, intercom_sync, wiskey_background_feed

AREAS = ("overview", "users", "events", "stations", "management")
FIELDS = ("phone", "photo", "credentials", "profile", "access")
LEVELS = ("none", "view", "manage")
MAX_STATION_IDS = 200


def _level(value: Any) -> str:
    return value if value in LEVELS else "unknown"


def _bool(value: Any) -> bool | None:
    return value if isinstance(value, bool) else None


def _int(value: Any) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def project_authorization(raw: Any) -> dict[str, Any]:
    """WisKey's `authorization/session` result as the diagnostics show it. Built key by key: only permission facts survive
    (a `profile_fields` map or any other extra key is dropped). `station_scope.kind` is `all` (`station_ids: null`),
    `explicit` (a list: the ids, capped) or `unknown`. Raises ValueError for an answer that is not an object."""
    if not isinstance(raw, dict):
        raise ValueError("authorization/session: not an object")
    areas = raw.get("areas") if isinstance(raw.get("areas"), dict) else {}
    fields = raw.get("fields") if isinstance(raw.get("fields"), dict) else {}
    ids = raw.get("station_ids")
    if ids is None and "station_ids" in raw:
        scope: dict[str, Any] = {"kind": "all", "count": None, "ids": []}
    elif isinstance(ids, list):
        listed = [i for i in ids if isinstance(i, str) and i][:MAX_STATION_IDS]
        scope = {"kind": "explicit", "count": len(ids), "ids": listed}
    else:
        scope = {"kind": "unknown", "count": None, "ids": []}
    security = raw.get("security")
    return {
        "allowed": _bool(raw.get("allowed")),
        "is_admin": _bool(raw.get("is_admin")),
        "areas": {a: _level(areas.get(a)) for a in AREAS},
        "fields": {f: _level(fields.get(f)) for f in FIELDS},
        "station_scope": scope,
        "revision": _int(raw.get("revision")),
        "personal_renewal": _bool(raw.get("personal_renewal")),
        "security": (
            {"locked": _bool(security.get("locked")), "idle_minutes": _int(security.get("idle_minutes")),
             "reauth_sensitive": _bool(security.get("reauth_sensitive")), "elevated": _bool(security.get("elevated"))}
            if isinstance(security, dict) else None
        ),
    }


def _now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


# ---------------------------------------------------------------- the two identities

def _service(settings: Settings, who: str) -> dict[str, Any]:
    st = intercom_sync.STATE
    configured = ha_client.configured(settings)
    base = {
        "identity": "service",
        "state": st.state if configured else "ha_not_configured",
        "last_error": st.last_error if configured else "ha_not_configured",
        "connected": st.connected,
        "wiskey_version": st.wiskey_version,
        "subscribe": intercom_sync.SYNC.subscribe_state(),
        "authorization": None,
        "authorization_state": "not_asked",
    }
    if not configured:
        return base
    reply = intercom_sync.SYNC.command(settings, "authorization", intercom_client.authorization_session, project_authorization, who=who)
    base["authorization"] = reply.get("authorization")
    base["authorization_state"] = "ok" if reply.get("authorization") is not None else str(reply.get("last_error") or reply.get("state"))
    return base


def _background(settings: Settings) -> dict[str, Any]:
    if not wiskey_background_feed.configured(settings):
        return {"identity": "service", "split": False, "configured": False, "state": "shares_service_identity", "last_error": None, "connected": None,
                "wiskey_version": None, "subscribe": "n/a", "authorization": None, "authorization_state": "not_asked"}
    feed = wiskey_background_feed.FEED
    status = feed.status
    out = {
        "identity": "background", "split": True, "configured": True, "state": status["state"], "last_error": status["last_error"],
        "connected": status["connected"], "wiskey_version": status["wiskey_version"], "subscribe": status["subscribe"],
        "authorization": None, "authorization_state": "not_asked",
    }
    code, raw = feed.command("authorization/session", intercom_client.authorization_session)
    if code != "ok":
        out["authorization_state"] = code
        return out
    try:
        out["authorization"], out["authorization_state"] = project_authorization(raw), "ok"
    except ValueError:
        out["authorization_state"] = "invalid_response"
    return out


# ---------------------------------------------------------------- findings

def _finding(code: str, level: str, subject: str) -> dict[str, str]:
    return {"code": code, "level": level, "subject": subject}


def findings(service: dict[str, Any], background: dict[str, Any]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    svc = service.get("authorization") or {}
    if svc.get("is_admin") is True:
        out.append(_finding("service_identity_is_admin", "info", "service"))
    if not background["split"]:
        out.append(_finding("background_shares_service_identity", "warn", "background"))
    else:
        bg = background.get("authorization")
        if bg is not None:
            if bg["is_admin"] is True:
                out.append(_finding("background_is_admin", "warn", "background"))
            if bg["areas"]["overview"] in ("none", "unknown") or bg["allowed"] is False:
                out.append(_finding("background_cannot_read_overview", "warn", "background"))
            wide_areas = [a for a in AREAS if a != "overview" and bg["areas"][a] not in ("none",)]
            wide_fields = [f for f in FIELDS if bg["fields"][f] not in ("none",)]
            if wide_areas or wide_fields:
                out.append(_finding("background_has_more_than_overview", "warn", "background"))
            if bg["station_scope"]["kind"] == "all":
                out.append(_finding("background_scope_is_all_stations", "info", "background"))
        elif background["authorization_state"] not in ("not_asked",):
            out.append(_finding("background_authorization_unavailable", "warn", "background"))
        if background["state"] == "ready" and background["subscribe"] != "ok":
            out.append(_finding("background_subscribe_not_live", "warn", "background"))
    if service["state"] == "ready" and service["subscribe"] != "ok":
        out.append(_finding("service_subscribe_not_live", "warn", "service"))
    for subject, part in (("service", service), ("background", background)):
        auth = part.get("authorization")
        security = (auth or {}).get("security") if auth else None
        if security:
            if security["locked"] is True:
                out.append(_finding("connection_locked", "warn", subject))
            if (security["idle_minutes"] or 0) > 0 or security["reauth_sensitive"] is True:
                out.append(_finding("idle_or_reauth_configured", "info", subject))
    return out


def collect(settings: Settings, *, who: str) -> dict[str, Any]:
    """The whole diagnostics reply. Each identity is asked once; a failure of one never hides the other. `channels` lists
    the per-channel command allow-lists (services/wiskey_channels.py) so the screen can show what each channel may send."""
    from . import wiskey_channels

    service = _service(settings, who)
    background = _background(settings)
    return {
        "generated_at": _now(),
        "service": service,
        "background": background,
        "channels": wiskey_channels.describe(),
        "findings": findings(service, background),
    }
