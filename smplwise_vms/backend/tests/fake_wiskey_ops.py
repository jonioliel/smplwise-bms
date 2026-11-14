"""WISKEY-OPS-VIEWS-2400: the fake WisKey of Settings › תפעול האינטרקום - tests/fake_wiskey.py's responder, validating every frame against
the rc.10 static extract (`docs/integrations/wiskey/catalog/rc10-extract/`: exact top-level key set, primitive types, area grants) and
answering the T11 commands the way WisKey rc.10 does (shapes from `C:\\hik intercom` @ origin/codex/wiskey-mac-m12-policy-b-2026-11-02:
websocket.py `overview`, access/operations_report.py, access/investigations.py + investigations_api.py, access/checkpoint_jobs.py,
capacity_history.py, access/operational_readiness.py, access/admin_audit.py, reporting.py). The jobs are STATEFUL: `jobs/action` cancel
compares the revision, refuses a finished job (`job_finished`) and empties the pending rows - so a test can prove a refusal changed
nothing. Invented values only - formula-like texts included on purpose (`=HYPERLINK(...)`, a leading tab, a full-width plus) so the
CSV guard is exercised. Nothing contacts a device, a station, Home Assistant or WisKey.

Switches: `fail_with[command] = code` (answer that code every time), `cancel_unclear` (the cancel answers a code that may come after
the store was written), `capacity_at` (the inventory time `platform/capacity` reports), `effects` (the writes that changed state)."""
from __future__ import annotations

import copy
import csv
import io
import json
from pathlib import Path
from typing import Any

from fake_wiskey import FakeWiskey, fail, ok

REPO = Path(__file__).resolve().parents[3]
RC10_DIR = REPO / "docs" / "integrations" / "wiskey" / "catalog" / "rc10-extract"

EVIL_NAME = "=HYPERLINK(\"http://x.invalid\",\"x\")"


class OpsFake(FakeWiskey):
    def __init__(self, *a: Any, **kw: Any) -> None:
        kw.setdefault("pin_dir", RC10_DIR)
        super().__init__(*a, **kw)
        self.fail_with: dict[str, str] = {}
        self.cancel_unclear = False
        self.effects: list[tuple[str, dict[str, Any]]] = []
        self.capacity_at = "2026-11-03T10:00:00+00:00"
        self.capacity_fresh = True
        self.jobs: dict[str, dict[str, Any]] = {
            "job-1": {"id": "job-1", "kind": "csv", "state": "paused", "revision": 3, "created_at": "2026-11-02T08:00:00+00:00", "updated_at": "2026-11-02T08:05:00+00:00",
                      "approval": None, "rows": [{"line": 2, "state": "saved", "error": None}, {"line": 3, "state": "failed", "error": "duplicate_card"},
                                                 {"line": 4, "state": "pending", "error": None}]},
            "job-2": {"id": "job-2", "kind": "bulk", "state": "completed", "revision": 7, "created_at": "2026-11-01T08:00:00+00:00", "updated_at": "2026-11-01T08:09:00+00:00",
                      "approval": None, "rows": [{"line": 1, "state": "saved", "error": None}]},
        }

    # ------------------------------------------------------------ the responder
    def _answer(self, command: str, msg: dict[str, Any], auth: dict[str, Any]) -> list[Any]:
        if command in self.fail_with:
            return [fail(msg, self.fail_with[command])]
        handler = getattr(self, "_h_" + command.replace("/", "__"), None)
        if handler is not None:
            return [handler(msg, auth)]
        return super()._answer(command, msg, auth)

    def _h_overview__summary(self, msg: dict[str, Any], auth: dict[str, Any]) -> dict[str, Any]:
        body = self._overview(auth)
        body["users"], body["user_count"] = [], 0
        stations = body["stations"]
        stations[1]["sync_state"], stations[1]["last_error"], stations[1]["pending_user_count"] = "error", "authentication_failed", 3
        stations[2]["user_count"], stations[2]["capabilities"] = 460, {**(stations[2].get("capabilities") or {}), "max_users": 500, "max_cards": 500}
        return ok(msg, body)

    @staticmethod
    def _public_job(job: dict[str, Any]) -> dict[str, Any]:
        rows = job["rows"]
        return {**{k: job[k] for k in ("id", "kind", "state", "revision", "created_at", "updated_at")}, "approval": job["approval"],
                "total": len(rows), "saved": sum(r["state"] == "saved" for r in rows), "failed": sum(r["state"] == "failed" for r in rows),
                "pending": sum(r["state"] == "pending" for r in rows),
                "errors": [{"row": r["line"], "code": r["error"]} for r in rows if r["state"] == "failed"]}

    def _h_jobs__list(self, msg: dict[str, Any], auth: dict[str, Any]) -> dict[str, Any]:
        records = sorted((self._public_job(j) for j in self.jobs.values()), key=lambda j: j["created_at"], reverse=True)
        return ok(msg, {"records": records, "reviews": [], "dual_approval": False})

    def _h_jobs__errors(self, msg: dict[str, Any], auth: dict[str, Any]) -> dict[str, Any]:
        job = self.jobs.get(msg["job_id"])
        if job is None:
            return fail(msg, "operation_not_found")
        out = io.StringIO()
        w = csv.writer(out)
        w.writerow(["row", "state", "error"])
        for r in job["rows"]:
            if r["state"] == "failed":
                w.writerow([r["line"], r["state"], r["error"]])
        return ok(msg, {"csv": out.getvalue()})

    def _h_jobs__action(self, msg: dict[str, Any], auth: dict[str, Any]) -> dict[str, Any]:
        if msg["action"] not in {"pause", "resume", "cancel", "retry_failed"}:
            return fail(msg, "invalid_fields")
        job = self.jobs.get(msg["job_id"])
        if job is None:
            return fail(msg, "operation_not_found")
        if job["revision"] != msg["revision"]:
            return fail(msg, "revision_conflict")
        if job["state"] in ("cancelled", "completed"):
            return fail(msg, "job_finished")
        if self.cancel_unclear:
            job["state"], job["revision"] = "cancelled", job["revision"] + 1  # the store WAS written, the answer says otherwise
            return fail(msg, "storage_or_internal_error")
        job["state"], job["revision"], job["updated_at"] = "cancelled", job["revision"] + 1, "2026-11-03T10:01:00+00:00"
        for r in job["rows"]:
            if r["state"] == "pending":
                r["error"] = None
        self.effects.append(("jobs/action", {"job_id": job["id"], "action": msg["action"]}))
        return ok(msg, self._public_job(job))

    def _h_operations__query(self, msg: dict[str, Any], auth: dict[str, Any]) -> dict[str, Any]:
        f = msg["filters"]
        if set(f) - {"kind", "state", "user_id", "station_id", "query"} or not 1 <= msg["limit"] <= 200:
            return fail(msg, "invalid_fields")
        rows = [
            {"id": "op-sync-1", "kind": "sync", "action": "sync/user_station", "state": "failed", "created_at": "2026-11-03T08:00:00+00:00",
             "updated_at": "2026-11-03T08:02:00+00:00", "changed": 1, "user_ids": ["u-1"], "station_ids": ["entry-b"],
             "progress": {"total": 1, "pending": 0, "failed": 1, "verified": 0, "settled": 0},
             "children": [{"id": "x", "user_id": "u-1", "station_id": "entry-b", "state": "failed", "updated_at": "2026-11-03T08:02:00+00:00",
                           "last_error": "authentication_failed", "host": "192.0.2.20"}]},
            {"id": "op-bulk-1", "kind": "bulk", "action": "bulk/enable", "state": "verified", "created_at": "2026-11-02T08:00:00+00:00",
             "updated_at": "2026-11-02T08:03:00+00:00", "changed": 4, "user_ids": ["u-1", "u-2"], "station_ids": ["entry-a", "entry-c"],
             "progress": {"total": 4, "pending": 0, "failed": 0, "verified": 4, "settled": 0}, "children": []},
        ]
        rows = [r for r in rows if (f.get("kind", "all") in ("all", r["kind"])) and (f.get("state", "all") in ("all", r["state"]))
                and (not f.get("station_id") or f["station_id"] in r["station_ids"])]
        page = rows[msg["offset"]: msg["offset"] + msg["limit"]]
        return ok(msg, {"records": page, "total": len(rows), "offset": msg["offset"], "limit": msg["limit"], "next_offset": None, "previous_offset": None,
                        "snapshot": "snap-ops", "stale": bool(msg["snapshot"] and msg["snapshot"] != "snap-ops"),
                        "summary": {k: sum(r["state"] == k for r in rows) for k in ("pending", "failed", "verified", "settled", "saved")}})

    def _h_investigations__query(self, msg: dict[str, Any], auth: dict[str, Any]) -> dict[str, Any]:
        f = msg["filters"]
        if set(f) - {"source", "user_id", "station_id", "query", "start", "end"}:
            return fail(msg, "invalid_fields")
        rows = [
            {"id": "access/e1", "source": "access", "time": "2026-11-03T07:59:00+00:00", "received_at": "2026-11-03T07:59:01+00:00", "time_source": "device",
             "user_id": "u-1", "person_name": "דנה כהן", "employee_no": "1001", "station_ids": ["entry-a"], "action": "access_granted", "status": "granted",
             "actor": None, "evidence": "device_event", "details": {"authentication": "card", "door": 1, "recovered": False, "identity_basis": "observed_station_owner"}},
            {"id": "change/12", "source": "change", "time": "2026-11-03T07:50:00+00:00", "received_at": None, "time_source": "system",
             "user_id": "u-1", "person_name": "דנה כהן", "employee_no": "1001", "station_ids": ["entry-a"], "action": "users/update", "status": "saved",
             "actor": "ha-admin-1", "evidence": "desired_state_saved", "details": {"fields": ["valid_until"], "revision_before": 4, "revision_after": 5}},
            {"id": "sync/s1", "source": "sync", "time": "2026-11-03T07:51:00+00:00", "received_at": None, "time_source": "system", "user_id": "u-1",
             "person_name": "דנה כהן", "employee_no": "1001", "station_ids": ["entry-a"], "action": "sync/user_station", "status": "verified", "actor": None,
             "evidence": "device_readback", "details": {"queued_at": None, "verified_at": None}},
        ]
        rows = [r for r in rows if f.get("source", "all") in ("all", r["source"]) and (not f.get("station_id") or f["station_id"] in r["station_ids"])]
        rows.sort(key=lambda r: r["time"], reverse=True)
        return ok(msg, {"records": rows[msg["offset"]: msg["offset"] + msg["limit"]], "total": len(rows), "offset": msg["offset"], "limit": msg["limit"],
                        "next_offset": None, "previous_offset": None, "snapshot": "snap-inv", "stale": False,
                        "summary": {k: sum(r["source"] == k for r in rows) for k in ("access", "change", "sync")}, "generated_at": "2026-11-03T08:00:00+00:00",
                        "retention": {"access_days": 30, "change_days": 30, "sync": "latest_per_user_station"}, "correlation": "chronology_is_not_causation",
                        "sources": {"access_available": True, "access_storage_failed": False}, "actors": {"ha-admin-1": "Owner Admin"}})

    def _h_platform__capacity(self, msg: dict[str, Any], auth: dict[str, Any]) -> dict[str, Any]:
        def values(count: int, limit: int, alert: str) -> dict[str, Any]:
            return {"count": count, "advertised_limit": limit, "used_percent": round(100 * count / limit, 1), "remaining": limit - count,
                    "observed_growth_per_day": 2.5, "estimated_days_to_limit": round((limit - count) / 2.5, 1), "alert": alert}
        rows = [
            {"station_id": "entry-a", "name": "Main gate", "sampled_at": self.capacity_at, "age_seconds": 60, "fresh": self.capacity_fresh, "sample_count": 5,
             "sample_span_days": 4.0, "users": values(12, 500, "observed"), "cards": values(9, 500, "observed"), "programs": {"advertised_limit": None, "alert": "unknown"}},
            {"station_id": "entry-c", "name": "Loading dock", "sampled_at": self.capacity_at, "age_seconds": 60, "fresh": self.capacity_fresh, "sample_count": 5,
             "sample_span_days": 4.0, "users": values(460, 500, "near_limit"), "cards": values(300, 500, "observed"), "programs": {"advertised_limit": None, "alert": "unknown"}},
        ]
        return ok(msg, {"records": rows, "basis": "complete_observed_inventories", "history_budget": {"stations": 500, "per_station_samples": 64, "total_samples": 6000},
                        "forecast_is_estimate": True})

    def _h_fleet__inventory_export(self, msg: dict[str, Any], auth: dict[str, Any]) -> dict[str, Any]:
        if msg["format"] not in {"json", "csv"}:
            return fail(msg, "invalid_fields")
        report = {"format": "hikvision_intercom.fleet_inventory", "generated_at": "2026-11-03T08:00:00+00:00", "integration_version": "2.0.1-rc.10",
                  "scope": "cached_inventory_no_device_reads", "summary": {}, "stations": [
                      {"station_ref": "ref-a", "name": EVIL_NAME, "model": "\tDS-KV6113", "firmware": "＋V2.2", "loaded": True, "online": True, "sync_state": "synced",
                       "last_error": None, "managed_locks": 1, "managed_users": 12, "pending_users": 0, "users": 12, "max_users": 500, "user_utilization_percent": 2,
                       "cards": 9, "max_cards": 500, "card_utilization_percent": 2, "near_capacity": False, "pin_writable": True, "native_schedules": True,
                       "inventory_sampled_at": "2026-11-03T07:00:00+00:00", "last_reconciled_at": None, "host": "192.0.2.10"},
                      {"station_ref": "ref-b", "name": "Side door", "model": "DS-KV6113", "firmware": "V2.2", "loaded": True, "online": False, "sync_state": "error",
                       "last_error": "authentication_failed", "managed_locks": 1, "managed_users": 5, "pending_users": 3, "users": 5, "max_users": 500,
                       "user_utilization_percent": 1, "cards": 2, "max_cards": 500, "card_utilization_percent": 0, "near_capacity": False, "pin_writable": True,
                       "native_schedules": True, "inventory_sampled_at": None, "last_reconciled_at": None}]}
        if msg["format"] == "csv":
            return ok(msg, {"filename": "wiskey-fleet-inventory.csv", "mime_type": "text/csv", "content": "station_ref,name\nref-a,=1+1\n"})
        return ok(msg, {"filename": "wiskey-fleet-inventory.json", "mime_type": "application/json", "content": json.dumps(report, ensure_ascii=False)})

    def _h_audit__export(self, msg: dict[str, Any], auth: dict[str, Any]) -> dict[str, Any]:
        f = msg["filters"]
        if set(f) - {"user_id", "station_id", "action", "actor", "start", "end", "before", "limit"}:
            return fail(msg, "invalid_fields")
        summary = {"display_name": "@dana", "employee_no": "-1001", "active": True}
        records = [{"sequence": 12, "time": "2026-11-03T07:50:00+00:00", "actor": "ha-admin-1", "action": "users/update", "user_id": "u-1", "stations": ["entry-a"],
                    "fields": ["valid_until"], "before": summary, "after": summary, "revision_before": 4, "revision_after": 5}]
        records = [r for r in records if not f.get("station_id") or f["station_id"] in r["stations"]]
        return ok(msg, {"records": records, "next_cursor": None, "total": len(records), "retention_days": 30, "retention_limit": 5000,
                        "format": "hikvision_intercom.admin_audit", "schema": 1, "csv": "\ufeff\"time_utc\"\r\n", "actors": {"ha-admin-1": "=cmd|' /C calc'!A0"}})

    def _h_events__report(self, msg: dict[str, Any], auth: dict[str, Any]) -> dict[str, Any]:
        f = msg["filters"]
        if set(f) & {"limit", "before"} or set(f) - {"station_id", "person", "result", "authentication", "event_type", "door", "start", "end"}:
            return fail(msg, "invalid_fields")

        def counts(granted: int, denied: int, other: int = 0) -> dict[str, int]:
            return {"records": granted + denied + other, "authentication": granted + denied, "granted": granted, "denied": denied, "unknown": 0,
                    "other": other, "recovered": 0}
        return ok(msg, {"generated_at": "2026-11-03T08:00:00+00:00", "day_timezone": "station", "oldest": "2026-10-28T06:00:00+00:00",
                        "newest": "2026-11-03T07:59:00+00:00", "totals": counts(40, 6, 3), "methods": {"card": 30, "pin": 16},
                        "anomalies": {"access_denied": 6, "attempt_limit": 1, "unlock_exception": 0, "door_not_closed": 2},
                        "anomaly_by_station": [{"station_id": "entry-b", "total": 7, "counts": {"access_denied": 5, "attempt_limit": 1, "unlock_exception": 0, "door_not_closed": 1}}],
                        "by_station": [{"station_id": "entry-a", **counts(30, 1)}, {"station_id": "entry-b", **counts(10, 5, 3)}],
                        "by_day": [{"day": d, **counts(g, x)} for d, g, x in (("2026-11-01", 12, 2), ("2026-11-02", 15, 1), ("2026-11-03", 13, 3))],
                        "filters": dict(f), "retention_days": 30, "capacity": 5000, "storage_failed": False, "stations": {}, "membership_basis": None})


def copy_jobs(fake: OpsFake) -> dict[str, Any]:
    return copy.deepcopy(fake.jobs)
