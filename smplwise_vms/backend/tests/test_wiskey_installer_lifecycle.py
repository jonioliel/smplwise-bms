"""WISKEY-INSTALLER-NATIVE-2400 phase 3: adding, re-onboarding, removing and replacing stations from Arx
(routers/wiskey_installer_lifecycle.py), against the fake WisKey (rc.10 extract) and a fake of Home Assistant's config-entry flow API
for `hikvision_intercom` (tests/fake_wiskey_installer.FakeFlows). Nothing contacts a device or Home Assistant.

Proven: the onboarding wizard forwards only each step's closed key set, to the flow Arx started, by the user who started it, at the step
it waits on; the credentials reach the flow and nothing else (no audit row, no reply, no log line); the door-pulse step needs the typed
phrase; failures are classified (not sent / refused / unknown). Removal: the review keeps counts and blocker codes only (no person name);
prepare / apply / verify / remove send WisKey's exact frames once; apply and remove need the typed name of the station being removed,
taken from WisKey's own job; WisKey's blockers, stale fingerprints, pending cleanup and dual approval are refusals that change nothing."""
from __future__ import annotations

import json
import logging
from typing import Any

import pytest
from conftest import as_user
from fake_wiskey_installer import FakeFlows
from test_wiskey_installer_clock import API, audit_rows, env, frames, wx  # noqa: F401 - wx is the shared fixture

from smplwise.services import wiskey_installer as wi
from smplwise.services import wiskey_installer_lifecycle as wl

CREDS = {"name": "Lobby", "host": "intercom.local", "username": "admin", "password": "S3cret-not-for-arx", "scheme": "http", "port": 80, "verify_ssl": True,
         "rtsp_port": 554}


@pytest.fixture()
def flows():
    fake = FakeFlows()
    wl.set_transport(fake)
    yield fake
    wl.set_transport(None)


def post(c: Any, path: str, user: str = "root", **body: Any) -> Any:
    return c.post(f"{API}{path}", json=env(**{"confirmed": True, **body}), headers=as_user(user))


def start(c: Any, **body: Any) -> dict[str, Any]:
    r = post(c, "/onboarding", **{"kind": "add", **body})
    assert r.status_code == 200, r.text
    return r.json()["data"]


# ---------------------------------------------------------------- onboarding


def test_the_wizard_adds_a_station_and_the_password_goes_nowhere_else(wx, flows, caplog):  # noqa: F811
    _, c, s = wx
    caplog.set_level(logging.DEBUG)
    first = start(c)
    assert first["type"] == "form" and first["step_id"] == "user" and first["defaults"]["username"] == "admin" and "password" not in first["defaults"]
    assert first["choices"]["scheme"] == ["http", "https"]
    fid = first["flow_id"]
    r = post(c, f"/onboarding/{fid}/steps/user", input=CREDS)
    assert r.status_code == 200, r.text
    dev = r.json()["data"]
    assert dev["step_id"] == "confirm_device" and dev["device"]["model"] == "DS-KV6113"
    assert flows.last_password_seen == CREDS["password"]
    locks = post(c, f"/onboarding/{fid}/steps/confirm_device", input={}).json()["data"]
    assert locks["step_id"] == "locks" and locks["choices"]["mode"] == ["camera_only", "map_active_relay"]
    done = post(c, f"/onboarding/{fid}/steps/locks", input={"mode": "camera_only", "lock_name": ""}).json()["data"]
    assert done["type"] == "create_entry" and done["entry"] == {"entry_id": "entry-new", "title": "Lobby"}
    # the secret is in no audit row and no log line; the audit has the step and the outcome only
    rows = audit_rows(s, "intercom.installer.onboarding_step")
    assert [r["details"].get("phase") for r in rows].count("outcome") == 3
    dump = json.dumps(rows + audit_rows(s, "intercom.installer.onboarding_start"), ensure_ascii=False)
    assert CREDS["password"] not in dump and CREDS["host"] not in dump and "MAC identity" not in dump
    assert CREDS["password"] not in caplog.text
    assert rows[-1]["details"]["result"]["entry"] == {"entry_id": "entry-new", "title": "Lobby"}


def test_the_door_pulse_step_needs_the_typed_phrase(wx, flows):  # noqa: F811
    _, c, _ = wx
    fid = start(c)["flow_id"]
    post(c, f"/onboarding/{fid}/steps/user", input=CREDS)
    post(c, f"/onboarding/{fid}/steps/confirm_device", input={})
    assert post(c, f"/onboarding/{fid}/steps/locks", input={"mode": "map_active_relay"}).json()["data"]["step_id"] == "mapping"
    r = post(c, f"/onboarding/{fid}/steps/mapping", input={"api_id": 1, "test_unlock": True})
    assert r.status_code == 409 and r.json()["code"] == "typed_confirmation_required" and flows.pulses == 0
    r = post(c, f"/onboarding/{fid}/steps/mapping", input={"api_id": 1, "test_unlock": True}, typed_confirmation=wl.PULSE_PHRASE)
    assert r.status_code == 200 and flows.pulses == 1 and r.json()["data"]["choices"]["result"][0] == "released_and_returned"
    wi.LIMITS.reset()
    end = post(c, f"/onboarding/{fid}/steps/confirm_mapping", input={"result": "released_and_returned"}).json()["data"]
    assert end["type"] == "create_entry"


def test_only_the_closed_keys_of_the_waiting_step_by_its_owner(wx, flows):  # noqa: F811
    _, c, _ = wx
    fid = start(c)["flow_id"]
    for bad in ({**CREDS, "extra": 1}, {k: v for k, v in CREDS.items() if k != "password"}, {**CREDS, "port": "80"}, {**CREDS, "host": "a b"}):
        r = post(c, f"/onboarding/{fid}/steps/user", input=bad)
        assert r.status_code == 422, (bad, r.text)
    assert post(c, f"/onboarding/{fid}/steps/locks", input={"mode": "camera_only"}).json()["code"] == "onboarding_step_mismatch"
    assert post(c, "/onboarding/nosuchflow1/steps/user", input=CREDS).json()["code"] == "onboarding_flow_not_found"
    assert post(c, f"/onboarding/{fid}/steps/user", user="otto", input=CREDS).status_code == 403
    assert [k for k, _, _ in flows.calls] == ["start"]


def test_a_wrong_password_comes_back_as_the_flow_error(wx, flows):  # noqa: F811
    _, c, _ = wx
    fid = start(c)["flow_id"]
    r = post(c, f"/onboarding/{fid}/steps/user", input={**CREDS, "password": "wrong"})
    assert r.status_code == 200 and r.json()["data"]["step_id"] == "user" and r.json()["data"]["errors"] == {"base": "invalid_auth"}


def test_reconfigure_keeps_the_stored_password_when_left_empty(wx, flows):  # noqa: F811
    _, c, _ = wx
    first = start(c, kind="reconfigure", entry_id="entry-a")
    assert first["step_id"] == "reconfigure" and flows.calls[0] == ("start", "entry-a", {})
    fid = first["flow_id"]
    r = post(c, f"/onboarding/{fid}/steps/reconfigure", input={**CREDS, "password": ""})
    assert r.status_code == 200 and "password" not in flows.calls[-1][2]
    assert post(c, "/onboarding", kind="reconfigure", entry_id="nope").status_code == 404


def test_flow_failures_are_classified_and_the_limit_of_open_flows(wx, flows):  # noqa: F811
    _, c, _ = wx
    flows.fail_next = wl.FlowError("not_sent", "ha_unavailable")
    r = post(c, "/onboarding", kind="add")
    assert r.status_code == 503 and r.json()["details"]["outcome"] == "not_sent"
    fid = start(c)["flow_id"]
    flows.fail_next = wl.FlowError("unknown", "timeout")
    r = post(c, f"/onboarding/{fid}/steps/user", input=CREDS)
    assert r.status_code == 504 and r.json()["details"]["outcome"] == "unknown"
    wi.LIMITS.reset()
    start(c)
    wi.LIMITS.reset()
    r = post(c, "/onboarding", kind="add")
    assert r.status_code == 429 and r.json()["code"] == "installer_busy"
    assert post(c, f"/onboarding/{fid}/abort").status_code == 200
    assert flows.calls[-1] == ("abort", fid, {})


# ---------------------------------------------------------------- removal / replacement


def test_the_review_keeps_counts_and_blockers_only(wx):  # noqa: F811
    fake, c, _ = wx
    r = c.get(f"{API}/lifecycle/review?source_id=entry-a", headers=as_user("root"))
    assert r.status_code == 200, r.text
    review = r.json()["review"]
    assert review["mode"] == "retirement" and review["affected_people"] == 2 and review["blockers"] == []
    assert "Dana" not in r.text and "rows" not in review
    sent = frames(fake, "platform/lifecycle_review")[-1]
    assert set(sent) == {"id", "type", "source_id", "target_id"} and sent["target_id"] == ""  # a WisKey READ: no api_contract
    rep = c.get(f"{API}/lifecycle/review?source_id=entry-a&target_id=entry-c", headers=as_user("root")).json()["review"]
    assert rep["mode"] == "replacement" and [s["id"] for s in rep["stations"]] == ["entry-a", "entry-c"]


def test_remove_a_station_end_to_end_with_typed_names(wx):  # noqa: F811
    fake, c, s = wx
    r = post(c, "/lifecycle/prepare", source_id="entry-a")
    assert r.status_code == 200, r.text
    job = r.json()["data"]["job"]
    assert job["state"] == "prepared" and job["source_name"] == "Main gate"
    assert set(frames(fake, "platform/lifecycle_prepare")[-1]) == {"id", "type", "source_id", "target_id", "api_contract"}
    jid, fp = job["id"], job["fingerprint"]
    plan = c.get(f"{API}/lifecycle/jobs/{jid}/plan?fingerprint={fp}", headers=as_user("root")).json()
    assert plan["job"]["id"] == jid and plan["impact"]["affected_people"] == 2
    r = post(c, f"/lifecycle/jobs/{jid}/apply", fingerprint=fp)
    assert r.status_code == 409 and r.json()["code"] == "typed_confirmation_required" and r.json()["details"]["expected"] == "Main gate"
    r = post(c, f"/lifecycle/jobs/{jid}/apply", fingerprint=fp, typed_confirmation="Main gate")
    assert r.status_code == 200 and r.json()["data"]["job"]["state"] == "applied"
    fp = r.json()["data"]["job"]["fingerprint"]
    wi.LIMITS.reset()
    assert post(c, f"/lifecycle/jobs/{jid}/verify", fingerprint=fp).json()["data"]["job"]["state"] == "verified"
    wi.LIMITS.reset()
    r = post(c, f"/lifecycle/jobs/{jid}/remove", fingerprint=fp, typed_confirmation="Main gate")
    assert r.status_code == 200 and r.json()["data"]["job"]["state"] == "removed"
    assert [e[0] for e in fake.effects] == ["platform/lifecycle_prepare", "platform/lifecycle_apply", "platform/lifecycle_remove"]
    row = audit_rows(s, "intercom.installer.lifecycle_remove")[-1]
    assert row["resource_type"] == "intercom_station" and row["resource_id"] == "entry-a" and row["details"]["outcome"] == "ok"
    listing = c.get(f"{API}/lifecycle", headers=as_user("root")).json()
    assert listing["records"][0]["state"] == "removed"


def test_wiskey_refusals_change_nothing(wx):  # noqa: F811
    fake, c, _ = wx
    fake.lifecycle_blockers = ["target_contains_accounts"]
    r = post(c, "/lifecycle/prepare", source_id="entry-a", target_id="entry-c")
    assert r.status_code == 502 and r.json()["details"]["wiskey_code"] == "lifecycle_blocked" and not fake.effects
    fake.lifecycle_blockers = []
    wi.LIMITS.reset()
    job = post(c, "/lifecycle/prepare", source_id="entry-a").json()["data"]["job"]
    wi.LIMITS.reset()
    stale = post(c, f"/lifecycle/jobs/{job['id']}/apply", fingerprint="old", typed_confirmation="Main gate")
    assert stale.status_code == 502 and stale.json()["details"]["wiskey_code"] == "bulk_review_stale"
    wi.LIMITS.reset()
    fake.dual_approval = True
    r = post(c, f"/lifecycle/jobs/{job['id']}/apply", fingerprint=job["fingerprint"], typed_confirmation="Main gate")
    assert r.status_code == 502 and r.json()["details"]["wiskey_code"] == "approval_required"
    assert [e[0] for e in fake.effects] == ["platform/lifecycle_prepare"]


def test_remove_while_cleanup_is_pending_is_refused(wx):  # noqa: F811
    fake, c, _ = wx
    job = post(c, "/lifecycle/prepare", source_id="entry-c").json()["data"]["job"]
    wi.LIMITS.reset()
    applied = post(c, f"/lifecycle/jobs/{job['id']}/apply", fingerprint=job["fingerprint"], typed_confirmation="Loading dock").json()["data"]["job"]
    fake.cleanup_pending = True
    wi.LIMITS.reset()
    assert post(c, f"/lifecycle/jobs/{job['id']}/verify", fingerprint=applied["fingerprint"]).json()["data"]["job"]["state"] == "applied"
    wi.LIMITS.reset()
    r = post(c, f"/lifecycle/jobs/{job['id']}/remove", fingerprint=applied["fingerprint"], typed_confirmation="Loading dock")
    assert r.status_code == 502 and r.json()["details"]["wiskey_code"] == "lifecycle_cleanup_pending"
    assert "platform/lifecycle_remove" not in [e[0] for e in fake.effects]


def test_lifecycle_gates_and_validation(wx):  # noqa: F811
    fake, c, _ = wx
    assert c.get(f"{API}/lifecycle", headers=as_user("otto")).status_code == 403
    assert post(c, "/lifecycle/prepare", user="otto", source_id="entry-a").status_code == 403
    assert post(c, "/lifecycle/prepare", source_id="entry-a", target_id="entry-a").status_code == 422
    assert post(c, "/lifecycle/prepare", source_id="nope").status_code == 404
    assert post(c, "/lifecycle/jobs/job-9/remove", fingerprint="x", typed_confirmation="x").json()["code"] == "lifecycle_not_found"
    assert not frames(fake, "platform/lifecycle_prepare") and not frames(fake, "platform/lifecycle_remove")
