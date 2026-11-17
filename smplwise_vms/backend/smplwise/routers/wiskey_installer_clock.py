"""WISKEY-INSTALLER-NATIVE-2400 phase 1: the intercom system's clock (services/wiskey_installer_clock.py has the WisKey side).

- `GET  /access-control/installer/clock` - the saved NTP preference, the host's NTP state and every station's last measured clock
  (from the served copy; no device is asked). Each part says its own state: a failed read of one part does not hide the others.
- `GET  /access-control/installer/clock/stations/{id}` - one station's clock CHECK: WisKey's last measurement from its health report
  (`health/get`, READ channel), at most once per station per 15 s.
- `PUT  /access-control/installer/clock/settings` - save the preference (revision compare-and-set; WisKey: "saving never changes a
  device"). Confirmation; the diff against the read is shown by the screen before.
- `POST /access-control/installer/clock/host-apply` - set the host's NTP server to the saved one (Supervisor; typed phrase "שעון השרת").
  Refused before sending when the saved port is not 123 (WisKey's own rule) or the host does not support NTP.
- `POST /access-control/installer/clock/stations/{id}/sync` - write the saved NTP setting to one station (and optionally copy the
  host's time first): typed phrase = the station's name; online stations only; up to ~50 s on WisKey's side, the screen shows progress."""
from __future__ import annotations

import sqlite3
import threading
import time
from typing import Any

from fastapi import APIRouter, Depends, Path, Request
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt

from ..auth import get_conn, settings_of
from ..errors import ApiError
from ..rbac import Principal
from ..services import intercom_adapter as ad
from ..services import intercom_sync
from ..services import wiskey_installer as wi
from ..services import wiskey_installer_clock as wc
from ._common import raw_body as _raw_body
from .wiskey_installer_common import WriteBody, Write, installer_gate, installer_reader, phrase_for_station, read, station_for_write, station_or_404

router = APIRouter()
ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"
CHECK_TTL_S = 15.0


class _CheckCache:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._by: dict[str, tuple[float, dict[str, Any]]] = {}

    def get(self, station_id: str) -> dict[str, Any] | None:
        with self._lock:
            hit = self._by.get(station_id)
        return None if hit is None or time.monotonic() - hit[0] > CHECK_TTL_S else hit[1]

    def put(self, station_id: str, value: dict[str, Any]) -> None:
        with self._lock:
            self._by[station_id] = (time.monotonic(), value)

    def drop(self, station_id: str) -> None:
        with self._lock:
            self._by.pop(station_id, None)

    def reset(self) -> None:
        with self._lock:
            self._by.clear()


CHECKS = _CheckCache()


def _part(request: Request, principal: Principal, name: str) -> dict[str, Any]:
    try:
        got = read(request, principal, wc.OPS[name])
        return {"state": "ready", "error": None, "fetched_at": got["fetched_at"], "data": got["data"]}
    except ApiError as exc:
        return {"state": "error", "error": {"code": exc.code, "wiskey_code": (exc.details or {}).get("wiskey_code"), "message": exc.user_message}, "fetched_at": None, "data": None}


@router.get("/access-control/installer/clock")
def clock_view(request: Request, principal: Principal = Depends(installer_reader)) -> dict[str, Any]:
    stations = wi.stations(settings_of(request))
    settings = _part(request, principal, "settings")
    host = _part(request, principal, "host_status")
    return {
        "settings": settings,
        "host": host,
        "stations": None if stations is None else [wc.station_clock_row(s) for s in stations],
        "feed": intercom_sync.STATE.state,
        "defaults": wc.DEFAULTS,
        "host_typed_phrase": wc.OPS["host_apply"].typed_word,
        "cooldowns": {"host_apply": wi.LIMITS.cooldown_left(wc.OPS["host_apply"], "*")},
    }


@router.get("/access-control/installer/clock/stations/{station_id}")
def clock_check(request: Request, principal: Principal = Depends(installer_reader), station_id: str = Path(min_length=1, max_length=128, pattern=ID_PATTERN)) -> dict[str, Any]:
    station = station_or_404(request, station_id)
    cached = CHECKS.get(station_id)
    if cached is None:
        reply = intercom_sync.SYNC.command(settings_of(request), "report", lambda call: ad.health_get(call, station_id), ad.project_health,
                                           who=principal.user_id, channel="read")
        report = reply.get("report")
        if reply.get("state") != "ready" or report is None:
            raise ApiError(502, "installer_read_failed", f"WisKey לא החזיר את מצב השעון של העמדה ({reply.get('last_error') or reply.get('state')}).",
                           details={"state": reply.get("state"), "wiskey_code": reply.get("last_error")})
        cached = {"fetched_at": reply.get("fetched_at"), "clock": report.get("clock"), "online": report.get("online")}
        CHECKS.put(station_id, cached)
    return {
        "station_id": station_id,
        "name": None if station is None else station.get("name"),
        "typed_phrase": None if station is None else phrase_for_station(station),
        "cooldown_s": wi.LIMITS.cooldown_left(wc.OPS["station_sync"], station_id),
        **cached,
    }


class NtpValues(BaseModel):
    model_config = ConfigDict(extra="forbid")
    server: str = Field(min_length=1, max_length=64)
    port: StrictInt
    interval: StrictInt


class SettingsBody(WriteBody):
    revision: StrictInt
    values: NtpValues


class HostApplyBody(WriteBody):
    revision: StrictInt


class StationSyncBody(WriteBody):
    revision: StrictInt
    copy_system: StrictBool = False


@router.put("/access-control/installer/clock/settings")
def clock_settings_update(request: Request, principal: Principal = Depends(installer_gate), raw: bytes = Depends(_raw_body),
                          conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    w = Write(request, conn, principal, wc.OPS["settings_update"], "שמירת הגדרות השעון")
    body: SettingsBody = w.parse(SettingsBody, raw)
    values = body.values.model_dump()
    values["server"] = values["server"].strip().lower()
    bad = wc.invalid_values(values)
    if bad:
        raise w.refuse(422, "validation", "ערכי השעון אינם תקינים: " + ", ".join(bad), fields=bad)
    w.act.details["changes"] = {k: values[k] for k in wc.NTP_KEYS}  # not secrets: a time server and two numbers
    return w.run({"revision": body.revision, "values": values})


@router.post("/access-control/installer/clock/host-apply")
def clock_host_apply(request: Request, principal: Principal = Depends(installer_gate), raw: bytes = Depends(_raw_body),
                     conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    w = Write(request, conn, principal, wc.OPS["host_apply"], "החלת שרת הזמן על השרת")
    body: HostApplyBody = w.parse(HostApplyBody, raw)
    w.typed(body, w.op.typed_word)
    return w.run({"revision": body.revision})


@router.post("/access-control/installer/clock/stations/{station_id}/sync")
def clock_station_sync(request: Request, station_id: str, principal: Principal = Depends(installer_gate), raw: bytes = Depends(_raw_body),
                       conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    w = Write(request, conn, principal, wc.OPS["station_sync"], "כתיבת הגדרות השעון לעמדה", target=station_id)
    body: StationSyncBody = w.parse(StationSyncBody, raw)
    station = station_for_write(w, station_id)
    w.typed(body, phrase_for_station(station))
    w.act.details["copy_system"] = body.copy_system
    return w.run({"station_id": station_id, "revision": body.revision, "copy_system": body.copy_system}, on_ok=lambda _d: CHECKS.drop(station_id))


def reset() -> None:
    CHECKS.reset()
