"""CR-017: the seam to Home Assistant for automations, scripts and scenes (docs/architecture/AUTOMATIONS_API.md §4, §5, §8.1) and the
persisted state of the mirror that every part of the feature reads (availability, write state).

`AutomationsTransport`: `rest_config` (GET of one item's stored config - read only), `ws` (read-only WebSocket commands: traces, validate_config,
get_services, `automation/config`), `bridge` (the signed `smplwise_bridge.config_item` call), `state` (one entity state), `connected`, `configured`.
Production `HaTransport` uses the live HA session and REST; tests install a fake with `set_transport`. Reads never write; the ONLY write path is
`bridge`. Nothing here logs a URL, a token or a config."""
from __future__ import annotations

import json
import sqlite3
from typing import Any, Protocol

from ..db import get_setting
from ..errors import ApiError
from . import ha_client, ha_sync

BRIDGE_REQUIRED = "0.6.0"
STATE_KEY = "automations.mirror"
PROBE_ID = "arx_probe_not_an_item"


class AutomationsTransport(Protocol):
    def rest_config(self, kind: str, config_id: str) -> tuple[int, Any]:
        """GET /api/config/<kind>/config/<id>: (HTTP status, JSON body or None when the body is not JSON). ApiError when HA is unreachable."""

    def ws(self, msg_type: str, **kw: Any) -> dict[str, Any]:
        """One read-only WebSocket command: HA's reply `{"success": bool, "result" | "error": ...}`. ApiError when HA is unreachable."""

    def bridge(self, payload: dict[str, Any]) -> dict[str, Any]:
        """The signed `smplwise_bridge.config_item` call; the service response. ApiError on a transport failure (504 `config_timeout` for a call that
        may have been applied)."""

    def state(self, entity_id: str) -> dict[str, Any] | None:
        """One entity's current state object (REST), None when unknown."""

    def connected(self) -> bool: ...

    def configured(self) -> bool: ...


class HaTransport:
    """Production transport: the live HA session (`ha_sync.SYNC.ws_call`) and REST through the add-on's settings."""

    def __init__(self) -> None:
        self.settings: Any = None

    def _settings(self) -> Any:
        settings = self.settings or ha_sync.SYNC.settings
        if settings is None:
            raise ApiError(503, "ha_not_configured", "אין גישה לתשתית המערכת.")
        return settings

    def rest_config(self, kind: str, config_id: str) -> tuple[int, Any]:
        return ha_client.get_config_item(self._settings(), kind, config_id)

    def ws(self, msg_type: str, **kw: Any) -> dict[str, Any]:
        return ha_sync.SYNC.ws_call(msg_type, **kw)

    def bridge(self, payload: dict[str, Any]) -> dict[str, Any]:
        return ha_client.call_bridge_config_item(self._settings(), payload)

    def state(self, entity_id: str) -> dict[str, Any] | None:
        return ha_client.get_state(self._settings(), entity_id)

    def connected(self) -> bool:
        return bool(ha_sync.STATE.connected)

    def configured(self) -> bool:
        settings = self.settings or ha_sync.SYNC.settings
        return bool(settings is not None and ha_client.configured(settings))


_TRANSPORT: AutomationsTransport = HaTransport()


def set_transport(transport: AutomationsTransport | None) -> None:
    """Tests: replace the transport (None restores the production one)."""
    global _TRANSPORT
    _TRANSPORT = transport if transport is not None else HaTransport()


def get_transport() -> AutomationsTransport:
    return _TRANSPORT


def bind_settings(settings: Any) -> None:
    if isinstance(_TRANSPORT, HaTransport):
        _TRANSPORT.settings = settings


# ---------------------------------------------------------------- the persisted state of the mirror

def mirror_state(conn: sqlite3.Connection) -> dict[str, Any]:
    try:
        st = json.loads(get_setting(conn, STATE_KEY, "{}") or "{}")
    except ValueError:
        st = {}
    st = st if isinstance(st, dict) else {}
    st.setdefault("last_sync_at", None)
    st.setdefault("last_attempt_at", None)
    st.setdefault("last_error", None)
    st.setdefault("config_api", None)  # "ok" | "unavailable" | None (not probed yet)
    st.setdefault("authoring_block", None)  # "not_loaded" after a write whose item never appeared (CR §4.6)
    st.setdefault("ha_version", None)
    return st


def version_tuple(text: str | None) -> tuple[int, ...]:
    out = []
    for part in (text or "").split("."):
        digits = "".join(ch for ch in part if ch.isdigit())
        out.append(int(digits) if digits else 0)
    return tuple(out)


def availability(conn: sqlite3.Connection, cfg: dict[str, Any]) -> str:
    """§2.4 `available`: ok | ha_unavailable | config_api_unavailable | feature_disabled | not_configured | error."""
    tr = get_transport()
    if cfg["automations.enabled"] != "true":
        return "feature_disabled"
    if not tr.configured():
        return "not_configured"
    if not tr.connected():
        return "ha_unavailable"
    st = mirror_state(conn)
    if st.get("config_api") == "unavailable":
        return "config_api_unavailable"
    if st.get("last_error") and st["last_error"] not in ("config_api_unavailable",):
        return "error"
    return "ok"


def write_block(conn: sqlite3.Connection, cfg: dict[str, Any]) -> str | None:
    """§2.4 `write_block` that does not depend on who is asking: feature_disabled | ha_unavailable | bridge_missing | bridge_unpaired | bridge_too_old |
    authoring_blocked | config_api_unavailable (shown as ha_unavailable by the status). None = writable."""
    avail = availability(conn, cfg)
    if avail == "feature_disabled":
        return "feature_disabled"
    if avail in ("ha_unavailable", "not_configured", "error"):
        return "ha_unavailable"
    if avail == "config_api_unavailable":
        return "config_api_unavailable"
    if not get_setting(conn, "bridge.secret"):
        return "bridge_missing"
    if not get_setting(conn, "bridge.paired_at"):
        return "bridge_unpaired"
    if version_tuple(get_setting(conn, "bridge.integration_version")) < version_tuple(BRIDGE_REQUIRED):
        return "bridge_too_old"
    if mirror_state(conn).get("authoring_block"):
        return "authoring_blocked"
    return None
