"""WISKEY-INSTALLER-NATIVE-2400: the fake WisKey of the installer tools - tests/fake_wiskey.py's responder, validating every frame
against the rc.10 static extract (`docs/integrations/wiskey/catalog/rc10-extract/`: the exact top-level key set, the primitive
types, the area grants) and answering the installer commands STATEFULLY the way WisKey rc.10 does (clock_api.py / ntp_settings.py /
client/ntp.py, technical_api.py / client/technical.py, operations_api.py, station_transactions_api.py, maintenance_api.py):
revisions compare-and-set, a write refused with WisKey's own code changes nothing, a readback mismatch leaves the outcome open.
Invented values only; nothing contacts a device, a station, Home Assistant or WisKey.

Switches a test sets:
- `fail_with[command] = code`: answer that command with that code (once per call, every time);
- `effects`: the writes that changed state, in order (`(command, key facts)`), so a test can prove a refused write changed nothing.
"""
from __future__ import annotations

import copy
from pathlib import Path
from typing import Any

from fake_wiskey import FakeWiskey, fail, ok

REPO = Path(__file__).resolve().parents[3]
RC10_DIR = REPO / "docs" / "integrations" / "wiskey" / "catalog" / "rc10-extract"

NTP_DEFAULT = {"server": "time.windows.com", "port": 123, "interval": 60}


class InstallerFake(FakeWiskey):
    def __init__(self, *a: Any, **kw: Any) -> None:
        kw.setdefault("pin_dir", RC10_DIR)
        super().__init__(*a, **kw)
        self.fail_with: dict[str, str] = {}
        self.effects: list[tuple[str, dict[str, Any]]] = []
        # clock (ntp_settings.NtpSettings + Supervisor)
        self.ntp = {"revision": 3, **NTP_DEFAULT}
        self.host = {"supported": True, "synchronized": True, "use_ntp": True, "config": {"servers": ["time.windows.com"], "fallback_servers": []}}
        self.clock_skew: dict[str, float] = {"entry-a": 0.4, "entry-c": 61.0}
        # station technical settings (client/technical.py read_door / update_door): both doors' DoorParam per station, the advertised
        # bounds, and the confirmed relay selection (entry-c has none: camera only)
        self.doors: dict[str, dict[int, dict[str, Any]]] = {
            sid: {1: {"doorName": "Door 1", "openDuration": 5, "relayReverseEnabled": False}, 2: {"doorName": "Door 2", "openDuration": 3, "relayReverseEnabled": False}}
            for sid in ("entry-a", "entry-b", "entry-c")
        }
        self.bounds = {"doorName": {"type": "text", "min": 1, "max": 32}, "openDuration": {"type": "integer", "min": 1, "max": 255}, "relayReverseEnabled": {"type": "boolean"}}
        self.relays: dict[str, list[dict[str, Any]]] = {"entry-a": [{"physical_index": 1, "api_id": 1, "confirmed": True, "name": "Main"}], "entry-b": [{"physical_index": 1, "api_id": 2, "confirmed": True}], "entry-c": []}
        self.readback_lies: set[str] = set()  # stations whose readback differs from the write (WisKey: device_unavailable after the PUT)

    # ------------------------------------------------------------ the responder
    def _answer(self, command: str, msg: dict[str, Any], auth: dict[str, Any]) -> list[Any]:
        if command in self.fail_with:
            return [fail(msg, self.fail_with[command])]
        handler = getattr(self, "_h_" + command.replace("/", "__"), None)
        if handler is not None:
            return [handler(msg)]
        return super()._answer(command, msg, auth)

    def _station(self, msg: dict[str, Any]) -> dict[str, Any] | None:
        return next((s for s in self.overview["stations"] if s["id"] == msg.get("station_id")), None)

    # ------------------------------------------------------------ clock (rc.10 clock_api.dispatch_clock)
    def _h_clock__settings_get(self, msg: dict[str, Any]) -> dict[str, Any]:
        return ok(msg, copy.deepcopy(self.ntp))

    def _h_clock__settings_update(self, msg: dict[str, Any]) -> dict[str, Any]:
        values = msg["values"]
        if set(values) != {"server", "port", "interval"}:
            return fail(msg, "invalid_fields")
        if msg["revision"] != self.ntp["revision"]:
            return fail(msg, "revision_conflict")
        current = {k: self.ntp[k] for k in ("server", "port", "interval")}
        if values != current:
            self.ntp = {"revision": self.ntp["revision"] + 1, **values}
            self.effects.append(("clock/settings_update", {"revision": self.ntp["revision"]}))
        return ok(msg, copy.deepcopy(self.ntp))

    def _h_clock__host_status(self, msg: dict[str, Any]) -> dict[str, Any]:
        return ok(msg, copy.deepcopy(self.host))

    def _h_clock__host_apply(self, msg: dict[str, Any]) -> dict[str, Any]:
        if msg["revision"] != self.ntp["revision"]:
            return fail(msg, "revision_conflict")
        if not self.host["supported"] or self.ntp["port"] != 123:
            return fail(msg, "operation_unsupported")
        self.host["config"] = {"servers": [self.ntp["server"]], "fallback_servers": []}
        self.effects.append(("clock/host_apply", {"server": self.ntp["server"]}))
        return ok(msg, {"configuration_verified": True, "config": copy.deepcopy(self.host["config"])})

    def _h_clock__station_sync(self, msg: dict[str, Any]) -> dict[str, Any]:
        station = self._station(msg)
        if station is None or msg["station_id"] in self.offline:
            return fail(msg, "station_unloaded")
        if msg["revision"] != self.ntp["revision"]:
            return fail(msg, "revision_conflict")
        self.effects.append(("clock/station_sync", {"station_id": msg["station_id"], "copy_system": msg["copy_system"]}))
        skew = 0.6 if msg["copy_system"] else self.clock_skew.get(msg["station_id"], 0.5)
        return ok(msg, {
            "configuration_verified": True, "server": self.ntp["server"], "copied_system": msg["copy_system"],
            "clock_verified": abs(skew) + 1.1 <= 5,
            "clock": {"zone": {"kind": "device", "name": "IST-2IDT"}, "device_time": "2026-11-03T09:00:01+02:00", "checked_at": "2026-11-03T07:00:00+00:00",
                      "skew_seconds": round(skew), "time_mode": "NTP",
                      "measurement": {"status": "measured", "duration_seconds": 0.2, "estimated_skew_seconds": skew, "uncertainty_seconds": 1.1},
                      "next_transition": {"status": "fixed"}},
        })

    # ------------------------------------------------------------ station technical settings (rc.10 technical_api.dispatch_technical)
    def _h_stations__technical_get(self, msg: dict[str, Any]) -> dict[str, Any]:
        station = self._station(msg)
        if station is None or msg["station_id"] in self.offline:
            return fail(msg, "station_unloaded")
        doors = [{"door": d, "values": copy.deepcopy(v), "constraints": {k: copy.deepcopy(self.bounds[k]) for k in v}} for d, v in sorted(self.doors[msg["station_id"]].items())]
        return ok(msg, {
            "checked_at": "2026-11-03T07:00:00+00:00", "doors": doors,
            "passwords": {"states": {"engineeringConfigured": True, "setupAlarmConfigured": False, "public1Configured": False}, "public_pin_state": "absent"},
            "password_error": None,
            "features": [{"family": "AccessControl", "name": "isSupportDoorParam", "supported": True}, {"family": "VideoIntercom", "name": "isSupportPrivilegePasswordStatus", "supported": True}],
            "relay_selection": copy.deepcopy(self.relays.get(msg["station_id"], [])),
        })

    def _h_stations__technical_update(self, msg: dict[str, Any]) -> dict[str, Any]:
        sid, door = msg["station_id"], msg["door"]
        if self._station(msg) is None or sid in self.offline:
            return fail(msg, "station_unloaded")
        if door not in {r["api_id"] for r in self.relays.get(sid, [])}:
            return fail(msg, "operation_unsupported")
        if msg["confirmed"] is not True:
            return fail(msg, "invalid_fields")
        current = self.doors[sid][door]
        changes = msg["changes"]
        if msg["expected"] != current:
            return fail(msg, "device_unavailable")  # HikvisionValidationError "reload before saving" -> device_unavailable
        for k, v in changes.items():
            cap = self.bounds.get(k)
            if cap is None or (cap["type"] == "integer" and not (type(v) is int and cap["min"] <= v <= cap["max"])) or (
                    cap["type"] == "text" and not (isinstance(v, str) and cap["min"] <= len(v) <= cap["max"])) or (cap["type"] == "boolean" and type(v) is not bool):
                return fail(msg, "device_unavailable")
        self.doors[sid][door] = {**current, **changes}
        self.effects.append(("stations/technical_update", {"station_id": sid, "door": door, "changes": dict(changes)}))
        if sid in self.readback_lies:
            return fail(msg, "device_unavailable")  # "Technical change not confirmed by readback"
        return ok(msg, {"door": door, "values": copy.deepcopy(self.doors[sid][door]), "constraints": {k: copy.deepcopy(self.bounds[k]) for k in self.doors[sid][door]}})
