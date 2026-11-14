"""WISKEY-INSTALLER-NATIVE-2400 phase 1 (plan 2026-11-03 row 51): the clock of the intercom system - WisKey's fleet NTP preference,
the host's NTP (through WisKey's Supervisor integration) and each station's clock - from Arx.

WisKey rc.10 (`clock_api.py`, `ntp_settings.py`, `client/ntp.py`; registrations in `websocket.py` COMMANDS):

| op                 | WisKey command          | keys                                   | what WisKey does                                                        |
|--------------------|-------------------------|----------------------------------------|-------------------------------------------------------------------------|
| `settings`         | `clock/settings_get`    | -                                      | the revisioned preference `{revision, server, port, interval}`         |
| `settings_update`  | `clock/settings_update` | `revision`, `values{server,port,interval}` | saves the preference (compare-and-set); "Saving never changes a device" |
| `host_status`      | `clock/host_status`     | -                                      | Supervisor `/host/info` + `/time/info`: NTP supported / synchronized    |
| `host_apply`       | `clock/host_apply`      | `revision`                             | Supervisor `/time/options` servers = [the saved server], then reads back; only when the host advertises `ntp` and the port is 123 |
| `station_sync`     | `clock/station_sync`    | `station_id`, `revision`, `copy_system`| WRITES the station: NTP server (readback), time mode NTP; `copy_system` first sets the host's time manually; then measures the clock (`clock_verified`: |skew| + uncertainty <= 5 s). 50 s cap, at most three stations at once |

None of them is a WisKey READ command (api_contract.READ_COMMANDS), so `api_contract` goes on every frame. Read access is WisKey's
`management: view`, writes `management: manage`; Arx's service identity is a WisKey administrator (diagnostics finding
`service_identity_is_admin`). In Arx every one of them needs system.configure at the installation.

The per-station clock CHECK is a read of WisKey's last measurement (`health/get`'s clock, the READ channel) - no device is asked. A
fresh device read of one station's clock is the station-maintenance action `stations/clock_refresh` (WISKEY-STATION-OPS-2390, the
`maintenance` channel), deliberately not duplicated here."""
from __future__ import annotations

import ipaddress
import re
from typing import Any

from . import intercom_adapter as ad
from .wiskey_installer import DEVICE_TIMEOUT_S, WRITE_TIMEOUT_S, Op

HOST_LABEL = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?")
MEASUREMENT_STATES = frozenset({"measured", "host_clock_changed"})
NTP_KEYS = ("server", "port", "interval")
DEFAULTS = {"server": "time.windows.com", "port": 123, "interval": 60}  # WisKey's own defaults (ntp_settings.DEFAULTS)


def valid_server(host: Any) -> bool:
    """WisKey's `ntp_settings.normalize` rule for the server: 1-64 characters, an IPv4 address that is not unspecified or multicast,
    or a host name of DNS labels that is not all digits and dots."""
    if not isinstance(host, str) or not 1 <= len(host) <= 64:
        return False
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return all(HOST_LABEL.fullmatch(label) for label in host.split(".")) and not re.fullmatch(r"[0-9.]+", host)
    return address.version == 4 and not address.is_unspecified and not address.is_multicast


def invalid_values(values: dict[str, Any]) -> list[str]:
    """The fields WisKey would refuse (`invalid_fields`), checked before anything is sent."""
    bad = []
    if not valid_server(values.get("server")):
        bad.append("server")
    port = values.get("port")
    if type(port) is not int or not 2 <= port <= 65535:
        bad.append("port")
    interval = values.get("interval")
    if type(interval) is not int or not 1 <= interval <= 10080:
        bad.append("interval")
    return bad


# ---------------------------------------------------------------- projections

def project_settings(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict) or ad._int(raw.get("revision")) is None:
        raise ValueError("unexpected clock settings")
    return {
        "revision": raw["revision"],
        "server": ad._text(raw.get("server"), 64),
        "port": ad._int(raw.get("port")),
        "interval": ad._int(raw.get("interval")),
    }


def _servers(v: Any) -> list[str]:
    return [s for s in (v if isinstance(v, list) else [])[:8] if ad._text(s, 255)]


def _host_config(v: Any) -> dict[str, Any] | None:
    if not isinstance(v, dict):
        return None
    return {"servers": _servers(v.get("servers")), "fallback_servers": _servers(v.get("fallback_servers"))}


def project_host_status(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("unexpected host status")
    return {
        "supported": ad._bool(raw.get("supported")) is True,
        "synchronized": ad._bool(raw.get("synchronized")),
        "use_ntp": ad._bool(raw.get("use_ntp")),
        "config": _host_config(raw.get("config")),
    }


def project_host_apply(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("unexpected host apply answer")
    return {"configuration_verified": raw.get("configuration_verified") is True, "config": _host_config(raw.get("config"))}


def project_measured_clock(raw: Any) -> dict[str, Any] | None:
    """WisKey's `ClockClient.async_read` (clock_health.measured_clock) without the zone object: the device time, the mode, the
    estimate against the host and its uncertainty."""
    if not isinstance(raw, dict):
        return None
    m = raw.get("measurement") if isinstance(raw.get("measurement"), dict) else {}
    return {
        "device_time": ad._iso(raw.get("device_time")),
        "checked_at": ad._iso(raw.get("checked_at")),
        "time_mode": ad._enum(raw.get("time_mode"), ad.TIME_MODES),
        "skew_seconds": ad._num(raw.get("skew_seconds")),
        "measurement": {
            "status": ad._enum(m.get("status"), MEASUREMENT_STATES),
            "estimated_skew_seconds": ad._num(m.get("estimated_skew_seconds")),
            "uncertainty_seconds": ad._num(m.get("uncertainty_seconds")),
        },
    }


def project_station_sync(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("unexpected station clock answer")
    return {
        "configuration_verified": raw.get("configuration_verified") is True,
        "server": ad._text(raw.get("server"), 64),
        "clock_verified": raw.get("clock_verified") is True,
        "copied_system": raw.get("copied_system") is True,
        "clock": project_measured_clock(raw.get("clock")),
    }


def station_clock_row(station: dict[str, Any]) -> dict[str, Any]:
    """One station of the served copy with the clock WisKey last measured (its closed technical part; nothing is asked)."""
    technical = station.get("technical") or {}
    clock = technical.get("clock") if isinstance(technical.get("clock"), dict) else None
    return {
        "id": station.get("id"),
        "name": station.get("name"),
        "online": bool(station.get("online")),
        "clock": None if clock is None else {
            "status": clock.get("status"), "skew_seconds": clock.get("skew_seconds"), "drift_state": clock.get("drift_state"),
            "time_mode": clock.get("time_mode"), "checked_at": clock.get("checked_at"), "error": clock.get("error"),
        },
    }


# ---------------------------------------------------------------- audit summaries (never a host, a credential or a person)

def _sum_settings(p: dict[str, Any]) -> dict[str, Any]:
    return {k: p.get(k) for k in ("revision", "server", "port", "interval")}


def _sum_host(p: dict[str, Any]) -> dict[str, Any]:
    return {"configuration_verified": p.get("configuration_verified")}


def _sum_station(p: dict[str, Any]) -> dict[str, Any]:
    clock = p.get("clock") or {}
    return {"configuration_verified": p.get("configuration_verified"), "clock_verified": p.get("clock_verified"), "copied_system": p.get("copied_system"),
            "skew_seconds": (clock.get("measurement") or {}).get("estimated_skew_seconds")}


OPS: dict[str, Op] = {
    "settings": Op("settings", "clock/settings_get", "read", "intercom.installer.clock_read", project=project_settings),
    "host_status": Op("host_status", "clock/host_status", "read", "intercom.installer.clock_read", project=project_host_status),
    "settings_update": Op("settings_update", "clock/settings_update", "write", "intercom.installer.clock_settings_update", ("revision", "values"),
                          danger="confirm", cooldown_s=2.0, project=project_settings, summary=_sum_settings),
    "host_apply": Op("host_apply", "clock/host_apply", "write", "intercom.installer.clock_host_apply", ("revision",), danger="typed",
                     timeout_s=DEVICE_TIMEOUT_S, cooldown_s=30.0, typed_word="שעון השרת", project=project_host_apply, summary=_sum_host),
    "station_sync": Op("station_sync", "clock/station_sync", "write", "intercom.installer.clock_station_sync", ("station_id", "revision", "copy_system"),
                       danger="typed", scope="station", timeout_s=WRITE_TIMEOUT_S, cooldown_s=60.0, project=project_station_sync, summary=_sum_station),
}
COMMANDS = frozenset(op.command for op in OPS.values())
AUDIT_ACTIONS = tuple(sorted({op.audit for op in OPS.values()}))
