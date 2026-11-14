"""WISKEY-OPS-VIEWS-2400 (integration plan T11): Settings › תפעול האינטרקום end to end over the add-on's live service session against the
fake WisKey validated by the rc.10 extract (tests/fake_wiskey_ops.py). Nothing contacts a device, Home Assistant or WisKey.

Proven here:
- the closed `operations` channel (nothing else leaves on it; no other channel gained a command) and the exact frames: rc.10's key sets,
  READ commands without `api_contract`, the one write (`jobs/action`) with it and with `action: "cancel"` only;
- permission: `access.read` unrestricted at the installation for the views; `access.admin.read` unrestricted for the exports and the
  cancel; each refusal an audited 403 before anything is sent; person fields of the timeline by the caller's people permissions;
- projection: no host, no station reference, no unknown key; capacity samples stored once per WisKey sample time, the trend served;
- exports: audited (rows, columns - never a row), every CSV written by Arx with the formula guard (ASCII, tab, full-width, after spaces);
- the cancel: confirmation, envelope, revision; a refusal changes nothing; an unclear answer is `unknown`; attempt + outcome rows;
- capability discovery: a command this WisKey does not list is not sent (501)."""
from __future__ import annotations

import csv
import io
import json
import time
import uuid
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from conftest import as_user, bind
from fake_wiskey import PREFIX
from fake_wiskey_ops import EVIL_NAME, OpsFake
from fastapi.testclient import TestClient

from smplwise.db import Database
from smplwise.services import intercom_sync, wiskey_channels
from smplwise.services import wiskey_ops_views as ov

API = "/api/v1/access-control/operations"


def wait_for(pred: Any, timeout: float = 5.0) -> None:
    end = time.time() + timeout
    while time.time() < end:
        if pred():
            return
        time.sleep(0.02)
    raise AssertionError(f"condition not met; feed state {intercom_sync.STATE.as_dict()}")


def env(ttl: float = 15.0, **fields: Any) -> dict[str, Any]:
    return {"client_request_id": uuid.uuid4().hex, "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=ttl)).strftime("%Y-%m-%dT%H:%M:%SZ"), **fields}


@pytest.fixture()
def ox(settings, monkeypatch):
    """root: system_admin (access.read + access.admin.read + people); sam: site_admin at the installation; otto: operator (access.read
    only); kim: kiosk (no access.read)."""
    import websockets

    fake = OpsFake("admin", token="t")
    monkeypatch.setattr(websockets, "connect", fake.connect)
    monkeypatch.setattr(intercom_sync, "RETRY_S", 0.05)
    monkeypatch.setattr(intercom_sync, "RETRY_MAX_S", 0.2)
    for name in ("USER_BURST", "GLOBAL_BURST", "CONFIG_USER_BURST", "CONFIG_GLOBAL_BURST"):
        monkeypatch.setattr(intercom_sync, name, 1000.0)
    intercom_sync.SYNC.reset()
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="t", ha_core_url="http://ha.local:8123")
    from smplwise.main import create_app

    c = TestClient(create_app(s))
    bind(c, s, "root", "system_admin", "installation", "*")
    bind(c, s, "otto", "operator", "installation", "*")
    bind(c, s, "kim", "kiosk", "installation", "*")
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    yield fake, c, s
    intercom_sync.SYNC.shutdown()
    if intercom_sync.SYNC.thread is not None:
        intercom_sync.SYNC.thread.join(timeout=5)
    intercom_sync.SYNC.reset()


def frames(fake: OpsFake, command: str) -> list[dict[str, Any]]:
    return [m for m in fake.received if m.get("type") == PREFIX + command]


def audit_rows(s: Any, action: str) -> list[dict[str, Any]]:
    db = Database(s.db_path)
    with db.connection() as conn:
        rows = conn.execute("SELECT actor_user_id, action, decision, resource_type, resource_id, reason, details_json FROM audit_log WHERE action = ? ORDER BY id",
                            (action,)).fetchall()
    return [{**dict(r), "details": json.loads(r["details_json"] or "{}")} for r in rows]


def parse_csv(body: bytes) -> list[list[str]]:
    text = body.decode("utf-8")
    assert text.startswith("﻿")
    return list(csv.reader(io.StringIO(text[1:])))


# ---------------------------------------------------------------- the channel


def test_the_operations_channel_is_closed_and_additive():
    assert wiskey_channels.OPERATIONS == {"overview/summary", "operations/query", "investigations/query", "jobs/list", "jobs/errors", "platform/capacity",
                                          "fleet/inventory_export", "audit/export", "events/report", "jobs/action"}
    for other in ("jobs/approval_decide", "jobs/bulk_create", "jobs/csv_create", "events/print", "events/export", "stations/test_unlock", "platform/save"):
        assert not wiskey_channels.allowed("operations", PREFIX + other), other
    assert not wiskey_channels.allowed("operations", "get_config")
    assert "operations" in wiskey_channels.ADAPTER_CHANNELS
    for name, commands in wiskey_channels.ALLOWLISTS.items():  # no other channel carries the one write
        if name != "operations":
            assert "jobs/action" not in commands, name
    assert set(ov.OPS[n].command for n in ov.OPS) == set(wiskey_channels.OPERATIONS)


def test_every_command_is_in_the_rc10_extract_and_read_classes_match():
    from fake_wiskey_ops import RC10_DIR

    catalog = json.loads((RC10_DIR / "commands.static.json").read_text(encoding="utf-8"))["commands"]
    for op in ov.OPS.values():
        entry = catalog[op.command]
        is_read = entry["permission"]["read_command_for_security_guard_and_api_contract"]
        assert is_read == (op.kind == "read"), op.command
        assert set(op.fields) <= set(entry["request"]["properties"]), op.command
        assert set(entry["request"]["required"]) - {"id", "type"} == set(op.fields), op.command


def test_frame_fields_refuse_any_action_but_cancel():
    with pytest.raises(ValueError):
        ov.frame_fields(ov.OPS["cancel"], {"job_id": "j", "revision": 1, "action": "resume"})
    assert ov.frame_fields(ov.OPS["cancel"], {"job_id": "j", "revision": 1, "action": "cancel"})["api_contract"] == 1
    assert "api_contract" not in ov.frame_fields(ov.OPS["operations"], {"filters": {}, "offset": 0, "limit": 1, "snapshot": ""})


# ---------------------------------------------------------------- permission


def test_views_need_access_read_at_the_installation_exports_need_admin(ox):
    fake, c, s = ox
    before = len(fake.received)
    for path in ("/overview", "/operations", "/investigations", "/jobs", "/capacity", "/events-report"):
        assert c.get(API + path, headers=as_user("kim")).status_code == 403, path
        assert c.get(API + path, headers=as_user("otto")).status_code == 200, path
    for path in ("/exports/fleet-inventory.csv", "/exports/audit.csv", "/jobs/job-1/errors.csv"):
        r = c.get(API + path, headers=as_user("otto"))
        assert r.status_code == 403, path
    r = c.post(f"{API}/jobs/job-1/cancel", json=env(confirmed=True, revision=3), headers=as_user("otto"))
    assert r.status_code == 403
    sent = [m.get("type") for m in fake.received[before:]]
    assert PREFIX + "jobs/action" not in sent and PREFIX + "fleet/inventory_export" not in sent and PREFIX + "audit/export" not in sent
    denied = audit_rows(s, "access.admin.read")
    assert denied and all(r["decision"] == "denied" for r in denied)


def test_a_station_scoped_reader_is_refused(ox):
    fake, c, s = ox
    bind(c, s, "sid", "operator", "site", "site-1")
    assert c.get(f"{API}/overview", headers=as_user("sid")).status_code == 403


# ---------------------------------------------------------------- reads and projection


def test_overview_kpis_without_host_and_the_listed_views(ox):
    fake, c, _ = ox
    r = c.get(f"{API}/overview", headers=as_user("otto"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert "192.0.2" not in r.text and "ref-a" not in r.text and "camera." not in r.text
    k = body["summary"]["data"]["kpis"]
    assert k == {"stations": 3, "online": k["online"], "offline": 3 - k["online"], "pending_users": k["pending_users"], "sync_problems": 1, "near_capacity": 1}
    assert body["views"] == {name: True for name in ov.OPS}
    assert body["can"]["admin"] is False and body["can"]["cancel"] is False
    assert set(frames(fake, "overview/summary")[-1]) == {"id", "type"}
    assert c.get(f"{API}/overview", headers=as_user("root")).json()["can"]["admin"] is True


def test_overview_survives_a_failed_summary_and_unlisted_views_are_not_sent(ox):
    fake, c, s = ox
    fake.fail_with["overview/summary"] = "manager_closed"
    body = c.get(f"{API}/overview", headers=as_user("otto")).json()
    assert body["summary"]["state"] == "error" and body["summary"]["code"] == "ops_read_failed"
    # a WisKey without `platform/capacity` in overview.api.commands: the served copy is the one taken at connect, so reconnect
    fake.unlist("platform/capacity")
    fake.close_all()
    wait_for(lambda: intercom_sync.STATE.state == "ready" and ov.listed(s).get("capacity") is False, timeout=8)
    assert c.get(f"{API}/overview", headers=as_user("otto")).json()["views"]["capacity"] is False
    before = len(frames(fake, "platform/capacity"))
    r = c.get(f"{API}/capacity", headers=as_user("otto"))
    assert r.status_code == 501 and r.json()["code"] == "ops_unsupported"
    assert len(frames(fake, "platform/capacity")) == before


def test_operations_frames_and_rows(ox):
    fake, c, _ = ox
    r = c.get(f"{API}/operations", params={"state": "failed", "station_id": "entry-b", "limit": 20}, headers=as_user("otto"))
    assert r.status_code == 200, r.text
    sent = frames(fake, "operations/query")[-1]
    assert set(sent) == {"id", "type", "filters", "offset", "limit", "snapshot"}
    assert sent["filters"] == {"kind": "all", "state": "failed", "query": "", "station_id": "entry-b"} and sent["limit"] == 20
    data = r.json()["data"]
    assert [row["id"] for row in data["records"]] == ["op-sync-1"]
    assert data["records"][0]["errors"] == ["authentication_failed"] and data["summary"]["failed"] == 1
    assert "192.0.2.20" not in r.text
    assert c.get(f"{API}/operations", params={"state": "nope"}, headers=as_user("otto")).status_code == 422


def test_investigations_person_fields_follow_the_caller(ox):
    fake, c, s = ox
    r = c.get(f"{API}/investigations", params={"source": "all"}, headers=as_user("root"))
    assert r.status_code == 200, r.text
    rows = r.json()["data"]["records"]
    assert [x["source"] for x in rows] == ["access", "sync", "change"]
    assert rows[0]["person_name"] == "דנה כהן" and rows[0]["employee_no"] == "1001" and rows[2]["actor"] == "ha-admin-1"
    assert r.json()["data"]["actors"] == {"ha-admin-1": "Owner Admin"} and r.json()["data"]["fields_hidden"] == []
    r = c.get(f"{API}/investigations", headers=as_user("otto"))
    assert r.status_code == 200
    body = r.json()["data"]
    if "person_name" in body["fields_hidden"]:
        assert all(x["person_name"] is None and x["user_id"] is None for x in body["records"]) and "דנה" not in r.text
    assert "actor" in body["fields_hidden"] and body["actors"] == {} and "Owner Admin" not in r.text
    # a free-text search matches names: it needs access.people.read unrestricted
    bind(c, s, "vic", "viewer", "installation", "*")
    if "access.people.read" not in _perms(s, "viewer"):
        before = len(frames(fake, "investigations/query"))
        assert c.get(f"{API}/investigations", params={"query": "דנה"}, headers=as_user("vic")).status_code == 403
        assert len(frames(fake, "investigations/query")) == before
    r = c.get(f"{API}/investigations", params={"query": "דנה", "start": "2026-11-01T00:00:00Z", "end": "2026-11-04T00:00:00Z"}, headers=as_user("root"))
    assert r.status_code == 200 and frames(fake, "investigations/query")[-1]["filters"]["query"] == "דנה"
    bad = c.get(f"{API}/investigations", params={"start": "2026-11-04T00:00:00Z", "end": "2026-11-01T00:00:00Z"}, headers=as_user("root"))
    assert bad.status_code == 422
    assert c.get(f"{API}/investigations", params={"start": "2026-11-04 00:00"}, headers=as_user("root")).status_code == 422


def _perms(s: Any, role: str) -> set[str]:
    from smplwise import rbac

    db = Database(s.db_path)
    with db.connection() as conn:
        return set(rbac.role_permissions(conn, role))


def test_jobs_list_with_errors_and_cancellable(ox):
    fake, c, _ = ox
    r = c.get(f"{API}/jobs", headers=as_user("otto"))
    assert r.status_code == 200, r.text
    body = r.json()
    jobs = {j["id"]: j for j in body["data"]["records"]}
    assert jobs["job-1"]["errors"] == [{"row": 3, "code": "duplicate_card"}] and jobs["job-1"]["cancellable"] is True
    assert jobs["job-2"]["cancellable"] is False and body["can_cancel"] is False
    assert set(frames(fake, "jobs/list")[-1]) == {"id", "type"}


def test_capacity_stores_samples_once_and_serves_the_trend(ox):
    fake, c, s = ox
    r = c.get(f"{API}/capacity", headers=as_user("otto"))
    assert r.status_code == 200, r.text
    body = r.json()
    rows = {x["station_id"]: x for x in body["data"]["records"]}
    assert rows["entry-c"]["users"]["alert"] == "near_limit" and rows["entry-c"]["users"]["used_percent"] == 92.0
    assert body["trend"]["stored_now"] == 2 and [p["users"] for p in body["trend"]["series"]["entry-c"]] == [460]
    assert c.get(f"{API}/capacity", headers=as_user("otto")).json()["trend"]["stored_now"] == 0  # the same WisKey sample: not stored again
    fake.capacity_at = "2026-11-03T11:00:00+00:00"
    again = c.get(f"{API}/capacity", params={"days": 365}, headers=as_user("otto")).json()
    assert again["trend"]["stored_now"] == 2 and len(again["trend"]["series"]["entry-a"]) == 2 and again["trend"]["days"] == 365
    fake.capacity_fresh = False
    fake.capacity_at = "2026-11-03T12:00:00+00:00"
    assert c.get(f"{API}/capacity", headers=as_user("otto")).json()["trend"]["stored_now"] == 0  # a stale report repeats nothing
    assert c.get(f"{API}/capacity", params={"days": 3}, headers=as_user("otto")).status_code == 422


def test_events_report_aggregates_only(ox):
    fake, c, _ = ox
    r = c.get(f"{API}/events-report", params={"station_id": "entry-b", "start": "2026-10-28T00:00:00Z"}, headers=as_user("otto"))
    assert r.status_code == 200, r.text
    sent = frames(fake, "events/report")[-1]
    assert set(sent) == {"id", "type", "filters"} and sent["filters"] == {"station_id": "entry-b", "start": "2026-10-28T00:00:00Z"}
    data = r.json()["data"]
    assert [d["day"] for d in data["by_day"]] == ["2026-11-01", "2026-11-02", "2026-11-03"] and data["totals"]["denied"] == 6
    assert data["anomalies"]["door_not_closed"] == 2 and data["methods"] == {"card": 30, "pin": 16, "unknown": 0}
    assert "filters" not in data and "stations" not in data


# ---------------------------------------------------------------- exports


def test_fleet_inventory_csv_is_arx_s_own_and_formula_safe(ox):
    fake, c, s = ox
    r = c.get(f"{API}/exports/fleet-inventory.csv", headers=as_user("root"))
    assert r.status_code == 200, r.text
    assert r.headers["cache-control"] == "private, no-store" and r.headers["x-export-rows"] == "2"
    assert frames(fake, "fleet/inventory_export")[-1]["format"] == "json"
    rows = parse_csv(r.content)
    assert rows[0] == list(ov.INVENTORY_FIELDS)
    first = dict(zip(rows[0], rows[1]))
    assert first["name"] == "'" + EVIL_NAME and first["model"] == "DS-KV6113" and first["firmware"] == "'＋V2.2"
    assert "192.0.2.10" not in r.text and "ref-a" not in r.text and "station_ref" not in rows[0]
    row = audit_rows(s, "intercom.ops.export_inventory")[-1]
    assert row["decision"] == "allowed" and row["details"]["rows"] == 2 and EVIL_NAME not in json.dumps(row)


def test_audit_csv_guards_names_and_actors_and_is_audited(ox):
    fake, c, s = ox
    r = c.get(f"{API}/exports/audit.csv", params={"station_id": "entry-a", "start": "2026-11-01T00:00:00Z"}, headers=as_user("root"))
    assert r.status_code == 200, r.text
    assert frames(fake, "audit/export")[-1]["filters"] == {"start": "2026-11-01T00:00:00Z", "station_id": "entry-a"}
    rows = parse_csv(r.content)
    rec = dict(zip(rows[0], rows[1]))
    assert rec["actor_name"] == "'=cmd|' /C calc'!A0" and rec["action"] == "users/update" and rec["stations"] == "entry-a"
    if "name" in rec:
        assert rec["name"] == "'@dana"
    if "employee_no" in rec:
        assert rec["employee_no"] == "'-1001"
    row = audit_rows(s, "intercom.ops.export_audit")[-1]
    assert row["details"]["rows"] == 1 and row["details"]["filters"]["station_id"] == "entry-a" and "dana" not in json.dumps(row)


def test_job_errors_csv(ox):
    fake, c, s = ox
    r = c.get(f"{API}/jobs/job-1/errors.csv", headers=as_user("root"))
    assert r.status_code == 200, r.text
    assert parse_csv(r.content) == [["row", "state", "error"], ["3", "failed", "duplicate_card"]]
    assert audit_rows(s, "intercom.ops.export_job_errors")[-1]["details"]["job_id"] == "job-1"
    assert c.get(f"{API}/jobs/nope/errors.csv", headers=as_user("root")).status_code in (404, 502)


@pytest.mark.parametrize("value,expected", [
    ("=1+1", "'=1+1"), ("+1", "'+1"), ("-1", "'-1"), ("@x", "'@x"), ("\tx", "'\tx"), ("\rx", "'\rx"), ("  =1", "'  =1"), ("＝1", "'＝1"),
    ("שלום", "שלום"), (-5, -5), (None, ""), (True, "true"), ("a=b", "a=b"),
])
def test_the_csv_cell_guard(value: Any, expected: Any):
    assert ov.csv_cell(value) == expected


# ---------------------------------------------------------------- the cancel


def test_cancel_needs_confirmation_and_is_sent_once(ox):
    fake, c, s = ox
    r = c.post(f"{API}/jobs/job-1/cancel", json=env(revision=3), headers=as_user("root"))
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required" and not frames(fake, "jobs/action")
    r = c.post(f"{API}/jobs/job-1/cancel", json=env(ttl=-5, confirmed=True, revision=3), headers=as_user("root"))
    assert r.status_code == 409 and r.json()["code"] == "expired" and not frames(fake, "jobs/action")
    r = c.post(f"{API}/jobs/job-1/cancel", json=env(confirmed=True, revision=3, action="resume"), headers=as_user("root"))
    assert r.status_code == 422 and not frames(fake, "jobs/action")
    r = c.post(f"{API}/jobs/job-1/cancel", json=env(confirmed=True, revision=3), headers=as_user("root"))
    assert r.status_code == 200, r.text
    assert r.json()["job"]["state"] == "cancelled" and r.json()["job"]["revision"] == 4
    sent = frames(fake, "jobs/action")
    assert len(sent) == 1 and set(sent[0]) == {"id", "type", "job_id", "revision", "action", "api_contract"} and sent[0]["action"] == "cancel"
    phases = [(x["details"]["phase"], x["details"].get("outcome")) for x in audit_rows(s, "intercom.ops.job_cancel")]
    assert ("attempt", None) in phases and ("outcome", "ok") in phases
    assert fake.effects == [("jobs/action", {"job_id": "job-1", "action": "cancel"})]


def test_cancel_refusals_change_nothing(ox):
    fake, c, s = ox
    r = c.post(f"{API}/jobs/job-2/cancel", json=env(confirmed=True, revision=7), headers=as_user("root"))
    assert r.status_code == 409 and r.json()["code"] == "ops_cancel_refused" and r.json()["details"]["outcome"] == "refused"
    r = c.post(f"{API}/jobs/job-1/cancel", json=env(confirmed=True, revision=1), headers=as_user("root"))
    assert r.status_code == 409 and r.json()["details"]["wiskey_code"] == "revision_conflict"
    assert fake.jobs["job-1"]["state"] == "paused" and fake.effects == []
    r = c.post(f"{API}/jobs/missing/cancel", json=env(confirmed=True, revision=1), headers=as_user("root"))
    assert r.status_code == 404
    outcomes = [x["details"].get("outcome") for x in audit_rows(s, "intercom.ops.job_cancel") if x["details"]["phase"] == "outcome"]
    assert outcomes == ["refused", "refused", "refused"]


def test_an_unclear_cancel_is_unknown_not_refused(ox):
    fake, c, s = ox
    fake.cancel_unclear = True
    r = c.post(f"{API}/jobs/job-1/cancel", json=env(confirmed=True, revision=3), headers=as_user("root"))
    assert r.status_code == 504 and r.json()["code"] == "ops_cancel_unknown" and r.json()["details"]["outcome"] == "unknown"
    assert [x["details"].get("outcome") for x in audit_rows(s, "intercom.ops.job_cancel") if x["details"]["phase"] == "outcome"] == ["unknown"]


# ---------------------------------------------------------------- projections in isolation


def test_projections_drop_unknown_keys_and_values():
    summary = ov.project_summary({"stations": [{"id": "a", "name": "A‮", "online": "yes", "sync_state": "weird", "host": "192.0.2.10", "capabilities": {"max_users": 10},
                                                "user_count": 9}, {"id": "../x"}]})
    assert summary["stations"] == [{**summary["stations"][0]}] and len(summary["stations"]) == 1
    s0 = summary["stations"][0]
    assert s0["name"] == "A" and s0["online"] is False and s0["sync_state"] == "unknown" and "host" not in s0 and s0["peak_use_percent"] == 90.0
    with pytest.raises(ValueError):
        ov.project_jobs([])
    with pytest.raises(ValueError):
        ov.project_job_errors({"csv": "a,b\n"})
    with pytest.raises(ValueError):
        ov.project_inventory({"content": json.dumps({"format": "other"})})
