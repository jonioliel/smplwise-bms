"""WISKEY-RESYNC-2520 slice 1: WisKey `system/status_v1` and `jobs/status_v1` (WisKey 2.0.1-rc.19 contracts system-status-v1 and
checkpoint-jobs-status-v1; the synthetic examples are copied unchanged into tests/fixtures/wiskey_rc19/). Nothing contacts a device, Home
Assistant or WisKey: a fake SYNC answers, the router tests replace the read itself.

Proven here:
- the closed `system_status` channel (exactly the two READs, no write, nothing else rides it); the reserved channels of the other 2.52 rows
  (relay_inventory, station_sync_v1) are in use since R3 / R4 and none is reserved any more;
- one frame `{type}` per read - no `api_contract`, no other key; nothing is sent when WisKey does not list the command, lists nothing,
  has no served copy or needs a newer client; a WisKey refusal is `forbidden` and is never retried with another command;
- projection: UNKNOWN stays unknown, null stays null (never a zero / false / success); an unreported job family is `families_absent`;
  a document that breaks a pinned guarantee (writes shown open, legacy schedule writes on, a sync effect proven, history complete,
  physical result measured, the format) is refused as a whole; an additive key is dropped;
- permission: `access.admin.read` unrestricted at the installation (operator: 403; a site administrator denied on one station: 403)."""
from __future__ import annotations

import asyncio
import json
import re
from pathlib import Path
from typing import Any

import pytest
from intercom_station_scope import station_scope  # noqa: F401 - a fixture

from smplwise.services import wiskey_channels as ch
from smplwise.services import wiskey_system_status as ss

FIXTURES = Path(__file__).parent / "fixtures" / "wiskey_rc19"
PREFIX = "hikvision_intercom/"
LISTED = ["overview", "system/status_v1", "jobs/status_v1"]


def fixture(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def station(**over: Any) -> dict[str, Any]:
    doc = {
        "station_id": "entry-a",
        "loaded": True,
        "connection": "connected",
        "last_authenticated_at": "2026-11-24T10:00:00+02:00",
        "last_failure": {"at": "2026-11-24T07:59:00+00:00", "channel": "request", "event": "failure", "schema_version": 1,
                         "http_status_code": 401, "isapi_status_code": 4, "sub_status": "unauthorized", "reason": "authentication_failed"},
        "firmware": "V2.2.0 build synthetic",
        "sync": {
            "state": "synced",
            "last_reconciled_at": "2026-11-24T08:01:00Z",
            "request": {"scope": "current_attached_runtime_only", "pending_request_id": None, "active_request_id": "req-2",
                        "last_result": {"request_id": "req-1", "state": "synced", "observed_at": "2026-11-24T08:01:00Z", "code": None,
                                        "effect_proven": False}},
            "last_intent": {"operation_id": "op-1", "state": "verified", "updated_at": "2026-11-24T08:00:00Z", "verified_at": None},
        },
    }
    doc.update(over)
    return doc


def system_doc(**over: Any) -> dict[str, Any]:
    doc = fixture("system-status-v1.result.valid.json")
    doc["stations"] = [station(), station(station_id="entry-b", connection="auth_failed", last_authenticated_at=None, last_failure=None,
                                          firmware=None, sync={"state": "pending", "last_reconciled_at": None, "request": None, "last_intent": None})]
    doc["jobs"]["families"] = [{"family": "checkpoint", "waiting": 1, "running": 0, "failed_last_24h": None},
                               {"family": "schedules", "waiting": 0, "running": 2, "failed_last_24h": 3}]
    doc.update(over)
    return doc


def job(**over: Any) -> dict[str, Any]:
    doc = {"id": "0" * 31 + "1", "kind": "csv", "state": "completed_with_errors", "revision": 4, "created_at": "2026-11-24T08:00:00Z",
           "updated_at": "2026-11-24T08:05:00Z", "approval": {"state": "pending", "action": "retry_failed", "expires_at": "2026-11-24T09:00:00Z"},
           "total": 10, "saved": 8, "failed": 2, "pending": 0, "errors": [{"row": 3, "code": "pin_conflict"}, {"row": 7, "code": None}]}
    doc.update(over)
    return doc


# ---------------------------------------------------------------- the channel

def test_the_system_status_channel_holds_exactly_the_two_reads_and_no_write():
    assert ch.SYSTEM_STATUS == {"system/status_v1", "jobs/status_v1"}
    assert ch.ALLOWLISTS["system_status"] == ch.SYSTEM_STATUS and ch.HA_FRAMES["system_status"] == frozenset()
    assert "system_status" in ch.ADAPTER_CHANNELS and "system_status" in ch.UNPINNED_CHANNELS
    assert {ss.OPS[n].command for n in ss.OPS} == set(ch.SYSTEM_STATUS) and ss.CHANNEL == "system_status"
    assert not (ch.SYSTEM_STATUS & ch.SERVICE_WRITES)
    for other in ("jobs/list", "jobs/action", "sync/station", "sync/station_v1", "overview", "stations/relay_inventory_v1"):
        assert not ch.allowed("system_status", PREFIX + other), other
    for name, commands in ch.ALLOWLISTS.items():  # no other channel carries the two reads
        if name != "system_status":
            assert not (commands & ch.SYSTEM_STATUS), name
    assert ch.describe()["system_status"] == {"commands": ["jobs/status_v1", "system/status_v1"], "in_use": True}


def test_no_channel_is_reserved_any_more_and_the_former_reserved_ones_are_in_use():
    """Slice 1 registered `relay_inventory` and `station_sync_v1` ahead of their rows; R3 / R4 send on them now. The mechanism stays: a
    channel still in RESERVED_CHANNELS would be named by no module but the registry (none is reserved today)."""
    assert ch.RESERVED_CHANNELS == frozenset()
    assert ch.RELAY_INVENTORY == {"stations/relay_inventory_v1"} and ch.STATION_SYNC_V1 == {"sync/station_v1"}
    for name in ("relay_inventory", "station_sync_v1"):
        assert ch.describe()[name]["in_use"] is True and name in ch.UNPINNED_CHANNELS and name in ch.ADAPTER_CHANNELS
    if ch.RESERVED_CHANNELS:
        package = Path(ch.__file__).resolve().parents[1]
        pattern = re.compile(r"""["'](%s)["']""" % "|".join(sorted(map(re.escape, ch.RESERVED_CHANNELS))))
        users = sorted(p.name for p in package.rglob("*.py") if p.name != "wiskey_channels.py" and pattern.search(p.read_text(encoding="utf-8")))
        assert users == [], users
    for command in ("stations/relay_inventory_v1", "sync/station_v1"):  # and no other channel can carry them
        assert [n for n, c in ch.ALLOWLISTS.items() if command in c] == (["relay_inventory"] if "relay" in command else ["station_sync_v1"])


# ---------------------------------------------------------------- the frame

def _frames(op: ss.Op, answer: Any) -> tuple[list[tuple[str, dict[str, Any]]], Any, Exception | None]:
    sent: list[tuple[str, dict[str, Any]]] = []

    async def call(msg_type: str, **kw: Any) -> Any:
        sent.append((msg_type, kw))
        return answer

    try:
        return sent, asyncio.run(ss.send(call, op)), None
    except Exception as exc:  # noqa: BLE001 - the test inspects it
        return sent, None, exc


@pytest.mark.parametrize("name", ["system", "jobs"])
def test_one_frame_with_the_type_only(name):
    sent, result, exc = _frames(ss.OPS[name], {"success": True, "result": {"x": 1}})
    assert exc is None and result == {"x": 1}
    assert sent == [(PREFIX + ss.OPS[name].command, {})], "a READ command: no api_contract, no other key"


def test_a_refusal_is_wiskeys_code_and_a_malformed_frame_is_invalid():
    _, _, exc = _frames(ss.OPS["jobs"], {"success": False, "error": {"code": "unauthorized", "message": "Access action could not be completed"}})
    assert isinstance(exc, ss.IntercomError) and exc.code == "unauthorized"
    _, _, exc = _frames(ss.OPS["jobs"], {"success": False, "error": {"code": "Bad Code\n"}})
    assert isinstance(exc, ss.IntercomError) and exc.code == "other"
    _, _, exc = _frames(ss.OPS["system"], ["not", "a", "frame"])
    assert isinstance(exc, ss.IntercomError) and exc.code == "invalid_response"


# ---------------------------------------------------------------- system/status_v1 projection

def test_wiskeys_own_valid_example_projects_with_every_guarantee_kept():
    got = ss.project_system(fixture("system-status-v1.result.valid.json"))
    assert got["integration"] == {"version": "2.0.1-rc.synthetic", "api_contract": 1, "profile": "manual-existing"}
    assert got["stations"] == [] and got["generated_at"] == "2026-11-14T00:00:00Z"
    assert got["writes"]["writes_enabled"] is None, "per-command admission: never one global true / false"
    assert got["writes"]["legacy_schedule_writes_enabled"] is False and got["schedules"]["legacy_writes_enabled"] is False
    assert got["jobs"]["families"] == [] and got["jobs"]["families_absent"] == ["checkpoint", "schedules", "maintenance", "templates"]
    assert got["jobs"]["history_complete"] is False and got["physical_result"] == "not_measured"
    assert got["templates"] == {"installation_state": "unavailable", "configured_accounts": None, "configured_templates": None,
                                "reason_codes": ["template_installation_unavailable"], "send_admission": "original_per_operation_guards"}


def test_stations_keep_unknown_and_null_and_the_sync_observation_stays_unproven():
    got = ss.project_system(system_doc())
    a, b = got["stations"]
    assert a["station_id"] == "entry-a" and a["last_authenticated_at"] == "2026-11-24T08:00:00Z", "UTC"
    assert a["last_failure"] == {"at": "2026-11-24T07:59:00Z", "channel": "request", "http_status_code": 401, "isapi_status_code": 4,
                                 "sub_status": "unauthorized", "reason": "authentication_failed"}
    assert a["sync"]["request"]["last_result"]["effect_proven"] is False and a["sync"]["request"]["scope"] == "current_attached_runtime_only"
    assert a["sync"]["last_intent"]["operation_id"] == "op-1", "a person / station intent id, kept apart from the sync request id"
    assert b["connection"] == "auth_failed" and b["last_authenticated_at"] is None and b["firmware"] is None and b["last_failure"] is None
    assert b["sync"] == {"state": "pending", "last_reconciled_at": None, "request": None, "last_intent": None}
    weird = ss.project_system(system_doc(stations=[station(connection="online", loaded="yes", firmware="\x07fw‮ 1",
                                                           last_failure={**station()["last_failure"], "reason": "new_reason", "sub_status": "x"})]))
    w = weird["stations"][0]
    assert w["connection"] == "unknown" and w["loaded"] is None and w["firmware"] == "fw 1"
    assert w["last_failure"]["reason"] == "unknown" and w["last_failure"]["sub_status"] == "unknown"


def test_job_counts_are_per_family_never_summed_and_a_missing_count_is_not_zero():
    got = ss.project_system(system_doc())["jobs"]
    assert got["families"] == [{"family": "checkpoint", "waiting": 1, "running": 0, "failed_last_24h": None},
                               {"family": "schedules", "waiting": 0, "running": 2, "failed_last_24h": 3}]
    assert got["families_absent"] == ["maintenance", "templates"], "an unloaded owner is unknown, not zero jobs"
    assert "total" not in json.dumps(got)
    bad = ss.project_system(system_doc(jobs={**system_doc()["jobs"], "families": [{"family": "checkpoint", "waiting": -1, "running": True,
                                                                                    "failed_last_24h": 1.0}, {"family": "other"}]}))["jobs"]
    assert bad["families"] == [{"family": "checkpoint", "waiting": None, "running": None, "failed_last_24h": None}]


@pytest.mark.parametrize("path,value", [
    (("writes", "writes_enabled"), True),
    (("writes", "writes_enabled"), False),
    (("writes", "legacy_schedule_writes_enabled"), True),
    (("schedules", "legacy_writes_enabled"), True),
    (("schedules", "physical_acceptance"), "accepted"),
    (("jobs", "history_complete"), True),
    (("physical_result",), "measured"),
    (("format",), "wiskey-system-status.v2"),
    (("schema_version",), 1.0),
    (("observation_scope",), "device_reads"),
    (("writes", "reason_codes"), ["writes_open"]),
    (("templates", "reason_codes"), ["something_else"]),
])
def test_a_document_that_breaks_a_pinned_guarantee_is_refused_as_a_whole(path, value):
    doc = system_doc()
    target = doc
    for key in path[:-1]:
        target = target[key]
    target[path[-1]] = value
    with pytest.raises(ss.ContractMismatch):
        ss.project_system(doc)


def test_a_proven_sync_effect_or_a_missing_list_is_refused():
    proven = station()
    proven["sync"]["request"]["last_result"]["effect_proven"] = True
    with pytest.raises(ss.ContractMismatch):
        ss.project_system(system_doc(stations=[proven]))
    for key in ("stations",):
        doc = system_doc()
        del doc[key]
        with pytest.raises(ss.ContractMismatch):
            ss.project_system(doc)
    doc = system_doc()
    del doc["jobs"]["families"]
    with pytest.raises(ss.ContractMismatch):
        ss.project_system(doc)


def test_wiskeys_wrong_and_missing_examples_are_refused_and_the_extra_key_is_dropped():
    for name in ("system-status-v1.result.wrong.json", "system-status-v1.result.missing.json"):
        with pytest.raises(ss.ContractMismatch):
            ss.project_system(fixture(name))
    extra = ss.project_system(fixture("system-status-v1.result.extra.json"))
    assert "unexpected" not in extra and extra == ss.project_system(fixture("system-status-v1.result.valid.json"))


def test_repeated_stations_keep_the_first_row_and_are_sorted():
    got = ss.project_system(system_doc(stations=[station(station_id="z"), station(station_id="a", firmware="one"),
                                                 station(station_id="a", firmware="two"), station(station_id="bad id/")]))
    assert [(s["station_id"], s["firmware"]) for s in got["stations"]] == [("a", "one"), ("z", "V2.2.0 build synthetic")]


# ---------------------------------------------------------------- jobs/status_v1 projection

def test_jobs_status_examples():
    assert ss.project_jobs(fixture("checkpoint-jobs-status-v1.result.valid.json")) == {
        "records": [], "scope": "all_retained_checkpoint_jobs", "history_complete": False,
        "notification": "original_data_free_refresh_requires_authorized_read"}
    for name in ("checkpoint-jobs-status-v1.result.wrong.json", "checkpoint-jobs-status-v1.result.missing.json"):
        with pytest.raises(ss.ContractMismatch):
            ss.project_jobs(fixture(name))
    assert "unexpected" not in ss.project_jobs(fixture("checkpoint-jobs-status-v1.result.extra.json"))


def test_job_records_are_closed_and_unknown_stays_unknown():
    doc = fixture("checkpoint-jobs-status-v1.result.valid.json")
    doc["records"] = [job(), job(id="0" * 31 + "2", kind="xml", state="exploded", revision=0, total=None, approval=None, actor="ha-user-1",
                                 payload={"pin": "1234"}, created_at="2026-11-24T07:00:00Z"), job(id="not-hex"), job()]
    got = ss.project_jobs(doc)["records"]
    assert [r["id"][-1] for r in got] == ["2", "1"], "sorted by created_at, a repeated id keeps its first row, a bad id is dropped"
    second, first = got
    assert second["kind"] == "unknown" and second["state"] == "unknown" and second["revision"] is None and second["total"] is None
    assert "actor" not in second and "payload" not in second and "1234" not in json.dumps(got)
    assert first["approval"] == {"state": "pending", "action": "retry_failed", "expires_at": "2026-11-24T09:00:00Z"}
    assert first["errors"] == [{"row": 3, "code": "pin_conflict"}, {"row": 7, "code": None}] and first["errors_truncated"] is False
    with pytest.raises(ss.ContractMismatch):
        ss.project_jobs({**doc, "history_complete": True})
    missing = dict(doc)
    del missing["records"]
    with pytest.raises(ss.ContractMismatch):
        ss.project_jobs(missing)


# ---------------------------------------------------------------- the read (fake SYNC)

class FakeSync:
    def __init__(self, commands: Any = LISTED, answer: Any = None, refuse: str | None = None, state: str = "ready", min_client: Any = None):
        self.facts: dict[str, Any] | None = {"version": "x", "min_client": min_client, "commands": commands}
        self.answer, self.refuse, self.state = answer, refuse, state
        self.calls: list[tuple[str, str]] = []
        self.frames: list[tuple[str, dict[str, Any]]] = []

    def api_facts(self, _settings: Any) -> dict[str, Any] | None:
        return dict(self.facts) if self.facts is not None else None

    def command(self, _settings: Any, key: str, send: Any, project: Any, who: str = "", channel: str = "service", **_kw: Any) -> dict[str, Any]:
        self.calls.append((key, channel))
        assert ch.allowed(channel, PREFIX + ss.OPS[key].command), "the frame goes through the channel's guard"
        if self.state != "ready":
            return {"state": self.state, "last_error": self.refuse, key: None}

        async def call(msg_type: str, **kw: Any) -> Any:
            self.frames.append((msg_type, kw))
            if self.refuse:
                return {"success": False, "error": {"code": self.refuse, "message": "x"}}
            return {"success": True, "result": self.answer}

        try:
            raw = asyncio.run(send(call))
        except ss.IntercomError as exc:
            return {"state": "forbidden" if exc.code == "unauthorized" else "error", "last_error": exc.code, key: None}
        try:
            return {"state": "ready", "last_error": None, "fetched_at": "2026-11-25T00:00:00Z", key: project(raw)}
        except Exception:  # noqa: BLE001 - intercom_sync's own rule: an unexpected shape is invalid_response
            return {"state": "error", "last_error": "invalid_response", key: None}


@pytest.fixture()
def fake(monkeypatch):
    def install(**kw: Any) -> FakeSync:
        f = FakeSync(**kw)
        monkeypatch.setattr(ss.intercom_sync, "SYNC", f)
        return f
    return install


def test_ready_reads_go_once_on_the_closed_channel(fake):
    f = fake(answer=system_doc())
    got = ss.read(object(), "system", "u1")
    assert got["state"] == "ready" and got["data"]["integration"]["profile"] == "manual-existing" and got["fetched_at"]
    assert f.calls == [("system", "system_status")] and f.frames == [(PREFIX + "system/status_v1", {})]
    f = fake(answer=fixture("checkpoint-jobs-status-v1.result.valid.json"))
    assert ss.read(object(), "jobs", "u1")["data"]["records"] == [] and f.calls == [("jobs", "system_status")]


@pytest.mark.parametrize("commands,min_client,reason", [
    (["overview"], None, "not_listed"),
    (None, None, "commands_unknown"),
    (LISTED, 99, "api_incompatible"),
])
def test_nothing_is_sent_when_wiskey_does_not_offer_the_read(fake, commands, min_client, reason):
    f = fake(commands=commands, min_client=min_client, answer=system_doc())
    got = ss.read(object(), "system", "u1")
    assert got == {"state": "unsupported", "reason": reason, "wiskey_code": None, "fetched_at": None, "data": None}
    assert f.calls == [] and f.frames == []


def test_no_served_copy_sends_nothing(fake):
    f = fake()
    f.facts = None
    assert ss.read(object(), "jobs", "u1")["reason"] == "no_copy" and f.calls == []


def test_a_wiskey_refusal_is_forbidden_and_never_falls_back_to_another_command(fake):
    f = fake(refuse="unauthorized")
    got = ss.read(object(), "jobs", "u1")
    assert got == {"state": "forbidden", "reason": "wiskey_refused", "wiskey_code": "unauthorized", "fetched_at": None, "data": None}
    assert [t for t, _ in f.frames] == [PREFIX + "jobs/status_v1"], "one frame; jobs/list is never tried instead"


def test_a_contract_mismatch_is_an_error_without_data(fake):
    fake(answer=system_doc(writes={**system_doc()["writes"], "writes_enabled": True}))
    got = ss.read(object(), "system", "u1")
    assert got == {"state": "error", "reason": "contract_mismatch", "wiskey_code": None, "fetched_at": None, "data": None}


@pytest.mark.parametrize("state,code,want", [
    ("connecting", None, "unavailable"),
    ("ha_unavailable", "session_ended", "unavailable"),
    ("rate_limited", "rate_limited", "busy"),
    ("error", "busy", "busy"),
    ("error", "timeout", "error"),
    ("unsupported", "unknown_command", "unsupported"),
])
def test_feed_states_map_to_the_page_states_without_data(fake, state, code, want):
    fake(state=state, refuse=code)
    got = ss.read(object(), "system", "u1")
    assert got["state"] == want and got["data"] is None


# ---------------------------------------------------------------- the routes

@pytest.fixture()
def app(settings, monkeypatch, station_scope):  # noqa: F811
    from conftest import bind
    from fastapi.testclient import TestClient

    from smplwise.main import create_app

    seen: list[tuple[str, str]] = []

    def read(_settings: Any, name: str, who: str) -> dict[str, Any]:
        seen.append((name, who))
        return {"state": "ready", "reason": None, "wiskey_code": None, "fetched_at": "2026-11-25T00:00:00Z", "data": {"ok": name}}

    monkeypatch.setattr(ss, "read", read)
    c = TestClient(create_app(settings))
    bind(c, settings, "root", "system_admin", "installation", "*")
    bind(c, settings, "otto", "operator", "installation", "*")
    bind(c, settings, "sam", "site_admin", "installation", "*")
    station_scope.bind("dev-sam", "site_admin", "entry-b", effect="deny")
    return c, seen



@pytest.mark.parametrize("path,name", [("/api/v1/access-control/status/system", "system"), ("/api/v1/access-control/status/jobs", "jobs")])
def test_the_reads_need_access_admin_read_unrestricted_at_the_installation(app, path, name):
    from conftest import as_user

    c, seen = app
    r = c.get(path, headers=as_user("root"))
    assert r.status_code == 200 and r.json() == {"state": "ready", "reason": None, "wiskey_code": None, "fetched_at": "2026-11-25T00:00:00Z",
                                                 "data": {"ok": name}}
    assert [n for n, _ in seen] == [name]
    for user in ("otto", "sam"):  # an operator has no access.admin.read; a site administrator denied on one station is not unrestricted
        assert c.get(path, headers=as_user(user)).status_code == 403, user
    assert [n for n, _ in seen] == [name], "a refused caller never reaches WisKey"
