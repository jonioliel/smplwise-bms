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
import json
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


class PlatformFake(InstallerFake):
    """InstallerFake plus rc.10's operations centre (operations_api.dispatch_operations, maintenance_api.dispatch), stateful: a revision,
    station metadata, the webhook and its key, retention with event records, one-use reviews bound to their kind, receipts, the
    maintenance queue."""

    WEBHOOK_KEY = "ab" * 32
    SIGNING_KEY = "cd" * 32

    def __init__(self, *a: Any, **kw: Any) -> None:
        super().__init__(*a, **kw)
        self.ops: dict[str, Any] = {"revision": 4, "retention": {"days": 30, "count": 5000, "bytes": 16_777_216},
                                    "webhook": {"enabled": False, "url": "", "kinds": []}, "stations": {}, "templates": {"t1": {}}, "door_presets": {},
                                    "views": {}, "reports": {}, "receipts": [], "report_runs": [], "journal": [], "observations": [], "schema": 2,
                                    "signing_key": self.SIGNING_KEY, "webhook_key": self.WEBHOOK_KEY}
        self.events = 1200
        self.reviews: dict[str, dict[str, Any]] = {}
        self.queue: dict[str, dict[str, Any]] = {}
        self.fail_station: str | None = None  # config_apply: this station's receipt fails

    def _catalog(self) -> dict[str, str]:
        return {s["id"]: s["name"] for s in self.overview["stations"]}

    def _review(self, kind: str, values: Any) -> str:
        token = f"rv-{kind}-{len(self.reviews) + 1}"
        self.reviews[token] = {"kind": kind, "values": values}
        return token

    def _consume(self, msg: dict[str, Any], kind: str) -> tuple[Any, str | None]:
        if msg.get("confirmed") is not True:
            return None, "confirmation_required"
        review = self.reviews.pop(msg["review_id"], None)
        if review is None or review["kind"] != kind:
            return None, "review_expired"
        return review["values"], None

    def _rows(self, msg: dict[str, Any], window: bool) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        rows, pending = [], []
        for sid in msg["station_ids"]:
            if sid not in self._catalog():
                raise KeyError(sid)
            if sid in self.offline:
                rows.append({"station_id": sid, "name": self._catalog()[sid], "before": None, "after": None, "error": "station_unloaded", **({"window": None} if window else {})})
                continue
            before = dict(self.doors[sid][msg["door"]])
            row = {"station_id": sid, "name": self._catalog()[sid], "before": before, "after": {**before, **msg["changes"]}, "error": None}
            if window:
                row["window"] = {"enabled": False, "days": [0, 1, 2, 3, 4, 5, 6], "start": "00:00", "end": "23:59", "timezone": "UTC"}
            rows.append(row)
            pending.append({"station_id": sid, "name": self._catalog()[sid], "door": msg["door"], "expected": before, "changes": dict(msg["changes"])})
        return rows, pending

    def _h_platform__get(self, msg: dict[str, Any]) -> dict[str, Any]:
        data = copy.deepcopy(self.ops)
        data.pop("signing_key")
        data.pop("webhook_key")
        return ok(msg, {**data, "event_usage": {"records": self.events, "bytes": self.events * 900, "days": 30, "count_limit": 5000, "byte_limit": 16_777_216,
                                                 "observed_records_per_day": 40.0, "count_horizon_days": 125.0, "forecast_basis": "x", "storage_failed": False},
                        "catalog": self._catalog(), "capabilities": ["fleet_configuration_approval", "fleet_maintenance_queue", "fleet_capacity_trends"]})

    def _h_platform__capacity(self, msg: dict[str, Any]) -> dict[str, Any]:
        def kind(count: int, limit: int) -> dict[str, Any]:
            return {"count": count, "advertised_limit": limit, "used_percent": round(100 * count / limit, 1), "remaining": limit - count,
                    "observed_growth_per_day": 1.5, "estimated_days_to_limit": None, "alert": "near_limit" if count / limit >= 0.8 else "observed"}
        return ok(msg, {"records": [{"station_id": sid, "name": n, "sampled_at": "2026-11-03T06:00:00+00:00", "age_seconds": 60, "fresh": True, "sample_count": 4,
                                     "sample_span_days": 3.0, "users": kind(420, 500), "cards": kind(100, 1000), "programs": {"advertised_limit": None, "alert": "unknown"}}
                                    for sid, n in self._catalog().items()], "basis": "complete_observed_inventories", "forecast_is_estimate": True})

    def _h_platform__integrity(self, msg: dict[str, Any]) -> dict[str, Any]:
        return ok(msg, {"checks": [{"component": c, "state": "available", "remedy": "none"} for c in ("access", "panel_permissions", "operations_center", "events")],
                        "writes_performed": False})

    def _h_platform__demo(self, msg: dict[str, Any]) -> dict[str, Any]:
        return ok(msg, {"demo": True, "stations": [{"name": "x", "online": True}], "steps": ["review_identity", "verify_door_mapping"], "device_writes": 0})

    def _h_platform__save(self, msg: dict[str, Any]) -> dict[str, Any]:
        if msg["collection"] != "stations":
            return fail(msg, "invalid_fields")
        if msg["record_id"] not in self._catalog():
            return fail(msg, "station_not_found")
        if msg["revision"] != self.ops["revision"]:
            return fail(msg, "revision_conflict")
        self.ops["revision"] += 1
        self.ops["stations"][msg["record_id"]] = {"actor": "svc", "values": copy.deepcopy(msg["values"])}
        self.effects.append(("platform/save", {"record_id": msg["record_id"]}))
        return ok(msg, {"id": msg["record_id"], "revision": self.ops["revision"], "values": copy.deepcopy(msg["values"])})

    def _h_platform__export(self, msg: dict[str, Any]) -> dict[str, Any]:
        return ok(msg, {"format": "smplwise-operations", "version": 1,
                        "stations": {k: {"name": self._catalog().get(k, k), "values": v["values"]} for k, v in self.ops["stations"].items()}, "templates": []})

    def _h_platform__import_preview(self, msg: dict[str, Any]) -> dict[str, Any]:
        try:
            source = json.loads(msg["content"])
            assert source["format"] == "smplwise-operations"
        except Exception:  # noqa: BLE001
            return fail(msg, "configuration_invalid")
        if set(msg["mapping"]) != set(source["stations"]) or set(msg["mapping"].values()) - set(self._catalog()):
            return fail(msg, "station_mapping_required")
        token = self._review("import", {"stations": {msg["mapping"][k]: v["values"] for k, v in source["stations"].items()}})
        return ok(msg, {"review_id": token, "stations": [{"source": k, "name": v["name"], "target": msg["mapping"][k], "replaces": False} for k, v in source["stations"].items()],
                        "templates": 0, "replaces_templates": True})

    def _h_platform__import_apply(self, msg: dict[str, Any]) -> dict[str, Any]:
        values, err = self._consume(msg, "import")
        if err:
            return fail(msg, err)
        self.ops["revision"] += 1
        self.ops["stations"].update({k: {"actor": "svc", "values": v} for k, v in values["stations"].items()})
        self.effects.append(("platform/import_apply", {"stations": len(values["stations"])}))
        return ok(msg, {"revision": self.ops["revision"], "stations": len(values["stations"])})

    def _h_platform__webhook_save(self, msg: dict[str, Any]) -> dict[str, Any]:
        v = msg["values"]
        if v.get("url") and not str(v["url"]).startswith("https://"):
            return fail(msg, "webhook_https_required")
        if msg["confirmed"] is not True:
            return fail(msg, "confirmation_required")
        if msg["revision"] != self.ops["revision"]:
            return fail(msg, "revision_conflict")
        self.ops["revision"] += 1
        self.ops["webhook"] = {"enabled": v["enabled"], "url": v["url"], "kinds": sorted(v["kinds"])}
        self.effects.append(("platform/webhook_save", {}))
        return ok(msg, {"revision": self.ops["revision"], "enabled": v["enabled"]})

    def _h_platform__webhook_key(self, msg: dict[str, Any]) -> dict[str, Any]:
        if msg["confirmed"] is not True:
            return fail(msg, "confirmation_required")
        return ok(msg, {"key": self.WEBHOOK_KEY})

    def _h_platform__retention_preview(self, msg: dict[str, Any]) -> dict[str, Any]:
        v = msg["values"]
        after = min(self.events, v["count"])
        return ok(msg, {"review_id": self._review("retention", v), "before": self.events, "after": after, "removed": self.events - after, "values": v})

    def _h_platform__retention_apply(self, msg: dict[str, Any]) -> dict[str, Any]:
        values, err = self._consume(msg, "retention")
        if err:
            return fail(msg, err)
        self.events = min(self.events, values["count"])
        self.ops["retention"] = values
        self.effects.append(("platform/retention_apply", {"count": values["count"]}))
        return ok(msg, {"records": self.events, "bytes": self.events * 900, "days": values["days"], "count_limit": values["count"], "byte_limit": values["bytes"]})

    def _h_platform__config_read(self, msg: dict[str, Any]) -> dict[str, Any]:
        return ok(msg, {"rows": [{"station_id": sid, "name": self._catalog().get(sid), "configuration": {"door": msg["door"], "values": dict(self.doors[sid][msg["door"]]),
                                                                                                           "constraints": {}}, "error": None} for sid in msg["station_ids"]]})

    def _h_platform__config_preview(self, msg: dict[str, Any]) -> dict[str, Any]:
        try:
            rows, pending = self._rows(msg, window=False)
        except KeyError:
            return fail(msg, "invalid_fields")
        token = self._review("configuration", {"rows": pending}) if pending else None
        return ok(msg, {"review_id": token, "rows": rows, "apply_count": len(pending)})

    def _h_platform__config_apply(self, msg: dict[str, Any]) -> dict[str, Any]:
        values, err = self._consume(msg, "configuration")
        if err:
            return fail(msg, err)
        receipts = []
        for row in values["rows"]:
            receipt = {"at": "2026-11-03T07:00:00+00:00", "station_id": row["station_id"], "state": "failed", "code": ""}
            if row["station_id"] == self.fail_station:
                receipt["code"] = "device_unavailable"
            else:
                self.doors[row["station_id"]][row["door"]].update(row["changes"])
                receipt["state"] = "verified"
                self.effects.append(("platform/config_apply", {"station_id": row["station_id"]}))
            receipts.append(receipt)
            self.ops["receipts"].append(receipt)
        return ok(msg, {"receipts": receipts})

    def _h_platform__maintenance_preview(self, msg: dict[str, Any]) -> dict[str, Any]:
        try:
            rows, pending = self._rows(msg, window=True)
        except KeyError:
            return fail(msg, "invalid_fields")
        token = self._review("maintenance", {"rows": pending}) if pending else None
        return ok(msg, {"review_id": token, "rows": rows, "queue_count": len(pending)})

    def _h_platform__maintenance_enqueue(self, msg: dict[str, Any]) -> dict[str, Any]:
        values, err = self._consume(msg, "maintenance")
        if err:
            return fail(msg, err)
        jid = f"00000000-0000-4000-8000-{len(self.queue) + 1:012d}"
        self.queue[jid] = {"id": jid, "actor": "svc", "created_at": "2026-11-03T07:00:00+00:00", "expires_at": "2026-11-11T07:00:00+00:00", "dual_required": False,
                           "consent": None, "state": "queued", "rows": [{**r, "window": None, "state": "pending", "code": ""} for r in values["rows"]]}
        self.effects.append(("platform/maintenance_enqueue", {"job_id": jid}))
        return ok(msg, {"job_id": jid, "state": "queued"})

    def _jobs_public(self) -> list[dict[str, Any]]:
        return [{**copy.deepcopy(j), "fingerprint": f"fp-{j['id'][-4:]}-{j['state']}", "own_request": True} for j in reversed(list(self.queue.values()))]

    def _h_platform__maintenance_jobs(self, msg: dict[str, Any]) -> dict[str, Any]:
        return ok(msg, {"records": self._jobs_public()})

    def _h_platform__maintenance_cancel(self, msg: dict[str, Any]) -> dict[str, Any]:
        if msg["confirmed"] is not True:
            return fail(msg, "confirmation_required")
        job = self.queue.get(msg["job_id"])
        if job is None:
            return fail(msg, "job_not_found")
        if msg["fingerprint"] != f"fp-{job['id'][-4:]}-{job['state']}":
            return fail(msg, "bulk_review_stale")
        job["state"] = "cancelled"
        for row in job["rows"]:
            if row["state"] == "pending":
                row["state"] = "cancelled"
        self.effects.append(("platform/maintenance_cancel", {"job_id": job["id"]}))
        return ok(msg, {"records": self._jobs_public()})
