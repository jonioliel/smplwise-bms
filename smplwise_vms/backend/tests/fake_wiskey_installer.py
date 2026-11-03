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
        self.jobs: dict[str, dict[str, Any]] = {}
        self.lifecycle_blockers = []

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

    # ------------------------------------------------------------ station lifecycle (rc.10 station_lifecycle_api / station_transactions_api)
    dual_approval = False
    cleanup_pending = False

    def _impact(self, source: str, target: str) -> dict[str, Any]:
        return {"source_id": source, "target_id": target or None, "mode": "replacement" if target else "retirement", "read_only": True, "can_apply": False,
                "device_writes": 0, "affected_people": 2,
                "rows": [{"user_id": "u1", "display_name": "Dana Levi", "active": True, "source_permission": "none", "locks": [1], "before": [source], "after": []}],
                "rows_complete": True, "row_budget": 200, "groups": [], "known_bindings": 2, "pending_cleanup": 0, "source_observed_at": None, "unknown_owners": 0,
                "hold_programs": 0, "native_schedules": 0, "required_target_locks": [1] if target else [], "blockers": list(self.lifecycle_blockers),
                "cleanup_verified": False, "source_removal_ready": False}

    def _job_public(self, job: dict[str, Any]) -> dict[str, Any]:
        keys = ("id", "source_id", "target_id", "state", "fingerprint", "created_at", "expires_at", "applied_at", "verified_at", "removed_at", "metadata_applied")
        return {k: job[k] for k in keys} | {"own_request": True, "require_approval": self.dual_approval, "approval_state": "pending",
                                             "affected_people": 2, "source_name": job["source_name"], "target_name": job["target_name"]}

    def _job(self, msg: dict[str, Any]) -> tuple[dict[str, Any] | None, str | None]:
        job = self.jobs.get(msg["job_id"])
        if job is None:
            return None, "lifecycle_not_found"
        if msg["fingerprint"] != job["fingerprint"]:
            return None, "bulk_review_stale"
        return job, None

    def _h_platform__lifecycle_review(self, msg: dict[str, Any]) -> dict[str, Any]:
        ids = [msg["source_id"], *([msg["target_id"]] if msg["target_id"] else [])]
        if msg["source_id"] == msg["target_id"] or any(self._station({"station_id": i}) is None for i in ids):
            return fail(msg, "station_not_found")
        stations = [{"id": i, "name": self._station({"station_id": i})["name"], "identity_verified": True, "identity_checked_at": "2026-11-03T07:00:00+00:00",
                     "error": None, "mappings": [{"physical_index": 1, "api_id": 1, "name": None}]} for i in ids]
        return ok(msg, {**self._impact(msg["source_id"], msg["target_id"]), "stations": stations})

    def _h_platform__lifecycle_prepare(self, msg: dict[str, Any]) -> dict[str, Any]:
        if self._station({"station_id": msg["source_id"]}) is None:
            return fail(msg, "station_unloaded")
        if self.lifecycle_blockers:
            return fail(msg, "lifecycle_blocked")
        jid = f"job-{len(self.jobs) + 1}"
        job = {"id": jid, "source_id": msg["source_id"], "target_id": msg["target_id"] or None, "state": "prepared", "fingerprint": f"fp-{jid}-1",
               "created_at": "2026-11-03T07:00:00+00:00", "expires_at": "2026-11-03T08:00:00+00:00", "applied_at": None, "verified_at": None, "removed_at": None,
               "metadata_applied": False, "source_name": self._station({"station_id": msg["source_id"]})["name"],
               "target_name": self._station({"station_id": msg["target_id"]})["name"] if msg["target_id"] else None}
        self.jobs[jid] = job
        self.effects.append(("platform/lifecycle_prepare", {"job_id": jid}))
        return ok(msg, {"job": self._job_public(job), "impact": self._impact(msg["source_id"], msg["target_id"])})

    def _h_platform__lifecycle_jobs(self, msg: dict[str, Any]) -> dict[str, Any]:
        return ok(msg, {"records": [self._job_public(j) for j in self.jobs.values()]})

    def _h_platform__lifecycle_plan(self, msg: dict[str, Any]) -> dict[str, Any]:
        job, err = self._job(msg)
        if err:
            return fail(msg, err)
        return ok(msg, {"job": self._job_public(job), "impact": self._impact(job["source_id"], job["target_id"] or ""), "metadata": {}})

    def _h_platform__lifecycle_apply(self, msg: dict[str, Any]) -> dict[str, Any]:
        job, err = self._job(msg)
        if err:
            return fail(msg, err)
        if msg["confirmed"] is not True:
            return fail(msg, "confirmation_required")
        if self.dual_approval:
            return fail(msg, "approval_required")
        if job["state"] == "prepared":
            job.update(state="applied", applied_at="2026-11-03T07:05:00+00:00", metadata_applied=True, fingerprint=job["fingerprint"] + "a")
            self.effects.append(("platform/lifecycle_apply", {"job_id": job["id"]}))
        return ok(msg, {"job": self._job_public(job)})

    def _h_platform__lifecycle_verify(self, msg: dict[str, Any]) -> dict[str, Any]:
        job, err = self._job(msg)
        if err:
            return fail(msg, err)
        if job["state"] not in ("applied", "verified", "removing"):
            return fail(msg, "lifecycle_not_applied")
        job["state"] = "applied" if self.cleanup_pending else "verified"
        return ok(msg, {"job": self._job_public(job)})

    def _h_platform__lifecycle_remove(self, msg: dict[str, Any]) -> dict[str, Any]:
        job, err = self._job(msg)
        if err:
            return fail(msg, err)
        if job["state"] not in ("applied", "verified", "removing"):
            return fail(msg, "lifecycle_not_applied")
        if self.cleanup_pending:
            return fail(msg, "lifecycle_cleanup_pending")
        job.update(state="removed", removed_at="2026-11-03T07:10:00+00:00")
        self.effects.append(("platform/lifecycle_remove", {"station_id": job["source_id"]}))
        return ok(msg, {"job": self._job_public(job)})


class FakeFlows:
    """Home Assistant's config-entry flow API for `hikvision_intercom`, answered the way WisKey rc.10's config_flow.py does: user or
    reconfigure, confirm_device, locks, then mapping and confirm_mapping, ending in create_entry or abort. Calls are recorded with the
    password masked; the one password seen is kept in `last_password_seen` only, so a test can prove it reached the flow and nothing else."""

    def __init__(self) -> None:
        self.flows: dict[str, dict[str, Any]] = {}
        self.calls: list[tuple[str, str, dict[str, Any]]] = []
        self.last_password_seen: str | None = None
        self.fail_next: Exception | None = None
        self.pulses = 0

    @staticmethod
    def _form(fid: str, step: str, errors: dict[str, str] | None = None, placeholders: dict[str, str] | None = None) -> dict[str, Any]:
        user = [{"name": "name", "required": True, "default": "Intercom", "type": "string"}, {"name": "host", "required": True, "type": "string"},
                {"name": "username", "required": True, "default": "admin", "type": "string"},
                {"name": "password", "required": True, "selector": {"text": {"type": "password"}}},
                {"name": "scheme", "required": True, "default": "http", "type": "select", "options": [["http", "http"], ["https", "https"]]},
                {"name": "port", "required": True, "default": 80, "type": "integer"}, {"name": "verify_ssl", "required": True, "default": True, "type": "boolean"},
                {"name": "rtsp_port", "required": True, "default": 554, "type": "integer"}]
        schemas = {
            "user": user, "reconfigure": user, "confirm_device": [],
            "locks": [{"name": "mode", "required": True, "selector": {"select": {"options": ["camera_only", "map_active_relay"]}}},
                      {"name": "lock_name", "default": "", "type": "string"}],
            "mapping": [{"name": "api_id", "required": True, "type": "select", "options": [[1, 1], [2, 2]]},
                        {"name": "test_unlock", "required": True, "default": False, "type": "boolean"}],
            "confirm_mapping": [{"name": "result", "required": True, "selector": {"select": {"options": ["released_and_returned", "choose_again", "camera_only"]}}}],
        }
        return {"type": "form", "flow_id": fid, "handler": "hikvision_intercom", "step_id": step, "data_schema": schemas[step], "errors": errors or {},
                "description_placeholders": placeholders or {}, "last_step": None}

    def _maybe_fail(self) -> None:
        if self.fail_next is not None:
            exc, self.fail_next = self.fail_next, None
            raise exc

    def start(self, settings: Any, entry_id: str | None) -> dict[str, Any]:
        self.calls.append(("start", entry_id or "", {}))
        self._maybe_fail()
        fid = f"flow{len(self.flows) + 1:06d}abcd"
        step = "reconfigure" if entry_id else "user"
        self.flows[fid] = {"step": step, "entry_id": entry_id}
        return self._form(fid, step)

    def step(self, settings: Any, flow_id: str, data: dict[str, Any]) -> dict[str, Any]:
        self.calls.append(("step", flow_id, {k: ("<secret>" if k == "password" else v) for k, v in data.items()}))
        self._maybe_fail()
        flow = self.flows[flow_id]
        step = flow["step"]
        if step in ("user", "reconfigure"):
            self.last_password_seen = data.get("password")
            if data.get("password") == "wrong":
                return self._form(flow_id, step, errors={"base": "invalid_auth"})
            flow["step"] = "confirm_device"
            return self._form(flow_id, "confirm_device", placeholders={"model": "DS-KV6113", "firmware": "V2.2.53", "serial": "MAC identity"})
        if step == "confirm_device":
            flow["step"] = "locks"
            return self._form(flow_id, "locks")
        if step == "locks":
            if data["mode"] == "camera_only":
                self.flows.pop(flow_id)
                if flow["entry_id"]:
                    return {"type": "abort", "flow_id": flow_id, "reason": "reconfigure_successful"}
                return {"type": "create_entry", "flow_id": flow_id, "title": "Lobby", "result": {"entry_id": "entry-new"}}
            flow["step"] = "mapping"
            return self._form(flow_id, "mapping")
        if step == "mapping":
            self.pulses += 1
            flow["step"] = "confirm_mapping"
            return self._form(flow_id, "confirm_mapping")
        self.flows.pop(flow_id)
        return {"type": "create_entry", "flow_id": flow_id, "title": "Lobby", "result": {"entry_id": "entry-new"}}

    def abort(self, settings: Any, flow_id: str) -> None:
        self.calls.append(("abort", flow_id, {}))
        self.flows.pop(flow_id, None)
