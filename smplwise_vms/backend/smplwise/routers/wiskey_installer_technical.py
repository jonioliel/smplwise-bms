"""WISKEY-INSTALLER-NATIVE-2400 phase 2: a station's technical settings (services/wiskey_installer_technical.py has the WisKey side).

- `GET /access-control/installer/technical/stations/{id}` - the station's technical report as WisKey reads it from the device: both
  doors' name / open time / relay inversion with the bounds the device advertises, which doors can be written (the confirmed relay
  mapping), capability flags and privilege-password PRESENCE (booleans only). One device read per station per 15 s at most (cached; a
  successful update replaces the cached door with WisKey's readback).
- `PUT /access-control/installer/technical/stations/{id}/doors/{door}` - `{expected, changes, confirmed, typed_confirmation?}`:
  `expected` is the door's values as read (WisKey refuses when the device changed since), `changes` only the edited fields. A change of
  `relayReverseEnabled` needs the typed station name. Online stations only; the reply is WisKey's readback of the door."""
from __future__ import annotations

import sqlite3
import threading
import time
from typing import Any

from fastapi import APIRouter, Depends, Path, Request
from pydantic import ConfigDict, StrictBool, StrictInt, StrictStr

from ..auth import get_conn
from ..rbac import Principal
from ..services import wiskey_installer as wi
from ..services import wiskey_installer_technical as wt
from .access_control import _raw_body
from .wiskey_installer_common import Write, WriteBody, installer_gate, installer_reader, phrase_for_station, read, station_for_write, station_or_404

router = APIRouter()
ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"
READ_TTL_S = 15.0


class _Reports:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._by: dict[str, tuple[float, dict[str, Any]]] = {}

    def get(self, station_id: str) -> dict[str, Any] | None:
        with self._lock:
            hit = self._by.get(station_id)
        return None if hit is None or time.monotonic() - hit[0] > READ_TTL_S else hit[1]

    def put(self, station_id: str, value: dict[str, Any]) -> None:
        with self._lock:
            self._by[station_id] = (time.monotonic(), value)

    def door_written(self, station_id: str, door: dict[str, Any]) -> None:
        with self._lock:
            hit = self._by.get(station_id)
            if hit is None:
                return
            report = dict(hit[1])
            data = dict(report["data"])
            data["doors"] = [door if d.get("door") == door.get("door") else d for d in data.get("doors") or []]
            report["data"] = data
            self._by[station_id] = (hit[0], report)

    def drop(self, station_id: str) -> None:
        with self._lock:
            self._by.pop(station_id, None)

    def reset(self) -> None:
        with self._lock:
            self._by.clear()


REPORTS = _Reports()


@router.get("/access-control/installer/technical/stations/{station_id}")
def technical_view(request: Request, principal: Principal = Depends(installer_reader), station_id: str = Path(min_length=1, max_length=128, pattern=ID_PATTERN),
                   fresh: bool = False) -> dict[str, Any]:
    station = station_or_404(request, station_id)
    cached = None if fresh else REPORTS.get(station_id)
    if cached is None:
        cached = read(request, principal, wt.OPS["read"], {"station_id": station_id})
        REPORTS.put(station_id, cached)
    data = cached["data"]
    return {
        "station_id": station_id,
        "name": None if station is None else station.get("name"),
        "online": None if station is None else bool(station.get("online")),
        "typed_phrase": None if station is None else phrase_for_station(station),
        "fetched_at": cached["fetched_at"],
        "editable_doors": wt.editable_doors(data),
        "dangerous_fields": sorted(wt.DANGEROUS_FIELDS),
        "report": data,
    }


class UpdateBody(WriteBody):
    model_config = ConfigDict(extra="forbid")
    expected: dict[str, StrictStr | StrictInt | StrictBool]
    changes: dict[str, StrictStr | StrictInt | StrictBool]


@router.put("/access-control/installer/technical/stations/{station_id}/doors/{door}")
def technical_update(request: Request, station_id: str, door: int, principal: Principal = Depends(installer_gate), raw: bytes = Depends(_raw_body),
                     conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    probe = Write(request, conn, principal, wt.OPS["update"], "שמירת ההגדרות הטכניות של העמדה", target=station_id)
    body: UpdateBody = probe.parse(UpdateBody, raw)
    dangerous = bool(wt.DANGEROUS_FIELDS & set(body.changes))
    w = probe
    if dangerous:  # same audit action and envelope; the typed rule of the relay inversion
        w.op = wt.OPS["update_relay"]
        w.act.details["installer"] = w.op.name
    w.act.details["door"] = door
    if door not in (1, 2):
        raise w.refuse(422, "validation", "מספר הדלת אינו תקין (1 או 2).", fields=["door"])
    if not body.changes:
        raise w.refuse(422, "validation", "אין שינויים לשמור.", fields=["changes"])
    bad = wt.invalid_changes(body.changes) + [k for k in body.expected if k not in wt.FIELDS]
    if bad:
        raise w.refuse(422, "validation", "השדות האלה אינם תקינים: " + ", ".join(sorted(set(bad))), fields=sorted(set(bad)))
    station = station_for_write(w, station_id)
    if dangerous:
        w.typed(body, phrase_for_station(station))
    w.act.details["changes"] = dict(body.changes)  # configuration values, not secrets
    return w.run({"station_id": station_id, "door": door, "expected": dict(body.expected), "changes": dict(body.changes), "confirmed": True},
                 on_ok=lambda data: REPORTS.door_written(station_id, data))


def reset() -> None:
    REPORTS.reset()
