"""WISKEY-INSTALLER-NATIVE-2400 phase 4: the rest of WisKey's platform from Arx (routers/wiskey_installer_platform.py) against the stateful
operations-centre fake (tests/fake_wiskey_installer.PlatformFake, validated by the rc.10 extract). Nothing contacts a device.

Proven: the view keeps no key and each part has its own state; the exact frames (READ commands without `api_contract`, the rest with it);
validation before sending (webhook https, retention bounds, window, targets); every write once, with confirmation, and the typed phrase
for import / retention / fleet apply / maintenance / the webhook key; the key goes to the caller once with no-store and to no audit row;
a fleet apply that fails on one station reports per station (partial failure); one-use reviews (a second apply is WisKey's refusal and
changes nothing); the maintenance queue's progress is its job / row states; cancel needs the current fingerprint; permission."""
from __future__ import annotations

import json
from typing import Any

import pytest
import websockets
from conftest import as_user
from fake_wiskey_installer import PlatformFake
from test_wiskey_installer_clock import API, audit_rows, env, frames

from smplwise.services import intercom_sync
from smplwise.services import wiskey_installer as wi

WINDOW = {"enabled": True, "days": [0, 1, 2, 3, 4], "start": "02:00", "end": "05:00", "timezone": "Asia/Jerusalem"}
VALUES = {"zone": "לובי", "owner": "", "tags": ["entrance"], "thresholds": {"offline": 600, "sync_stalled": 900, "event_gap": 600}, "window": WINDOW}


@pytest.fixture()
def px(wx, monkeypatch):  # noqa: F811 - reuses the installer fixture, swapping in the platform fake
    _, c, s = wx
    fake = PlatformFake("admin", token="t")
    monkeypatch.setattr(websockets, "connect", fake.connect)
    intercom_sync.SYNC.shutdown()
    if intercom_sync.SYNC.thread is not None:
        intercom_sync.SYNC.thread.join(timeout=5)
    intercom_sync.SYNC.reset()
    intercom_sync.SYNC.start(s)
    from test_wiskey_installer_clock import wait_for

    wait_for(lambda: intercom_sync.STATE.state == "ready")
    return fake, c, s


from test_wiskey_installer_clock import wx  # noqa: E402,F401 - the base fixture


def post(c: Any, path: str, user: str = "root", **body: Any) -> Any:
    return c.post(f"{API}/platform{path}", json=env(**{"confirmed": True, **body}), headers=as_user(user))


def put(c: Any, path: str, user: str = "root", **body: Any) -> Any:
    return c.put(f"{API}/platform{path}", json=env(**{"confirmed": True, **body}), headers=as_user(user))


def test_the_view_has_no_key_and_parts_of_their_own(px):
    fake, c, _ = px
    r = c.get(f"{API}/platform", headers=as_user("root"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert fake.WEBHOOK_KEY not in r.text and fake.SIGNING_KEY not in r.text
    assert body["platform"]["data"]["revision"] == 4 and body["platform"]["data"]["templates"] == 1
    assert body["capacity"]["data"]["records"][0]["users"]["alert"] == "near_limit"
    assert body["integrity"]["data"]["writes_performed"] is False
    assert body["typed"]["import_apply"] == "ייבוא תצורה"
    assert set(frames(fake, "platform/get")[-1]) == {"id", "type"}  # a WisKey READ: no api_contract
    fake.fail_with["platform/capacity"] = "operations_unavailable"
    body = c.get(f"{API}/platform", headers=as_user("root")).json()
    assert body["capacity"]["state"] == "error" and body["platform"]["state"] == "ready"
    assert c.get(f"{API}/platform", headers=as_user("otto")).status_code == 403


def test_station_metadata_and_window(px):
    fake, c, s = px
    bad = put(c, "/stations/entry-a", revision=4, values={**VALUES, "window": {**WINDOW, "start": "06:00"}})
    assert bad.status_code == 422 and not frames(fake, "platform/save")
    r = put(c, "/stations/entry-a", revision=4, values=VALUES)
    assert r.status_code == 200, r.text
    sent = frames(fake, "platform/save")[-1]
    assert set(sent) == {"id", "type", "collection", "record_id", "revision", "values", "api_contract"} and sent["collection"] == "stations"
    assert put(c, "/stations/entry-a", revision=4, values=VALUES).status_code in (429, 502)  # cool-down, or WisKey's revision_conflict
    assert put(c, "/stations/nope", revision=5, values=VALUES).status_code == 404


def test_webhook_save_validates_and_the_key_is_shown_once(px):
    fake, c, s = px
    assert put(c, "/webhook", revision=4, values={"enabled": True, "url": "http://x.example/h", "kinds": ["access_event"]}).status_code == 422
    assert put(c, "/webhook", revision=4, values={"enabled": True, "url": "https://x.example/h?t=1", "kinds": ["access_event"]}).status_code == 422
    r = put(c, "/webhook", revision=4, values={"enabled": True, "url": "https://hooks.example/arx", "kinds": ["access_event"]})
    assert r.status_code == 200 and fake.ops["webhook"]["enabled"] is True
    assert "hooks.example" not in json.dumps(audit_rows(s, "intercom.installer.platform_webhook_save"))
    r = post(c, "/webhook/key")
    assert r.status_code == 409 and r.json()["code"] == "typed_confirmation_required"
    r = post(c, "/webhook/key", typed_confirmation="הצגת המפתח")
    assert r.status_code == 200 and r.json()["data"]["key"] == fake.WEBHOOK_KEY and r.headers["cache-control"] == "no-store"
    rows = audit_rows(s, "intercom.installer.platform_webhook_key")
    assert fake.WEBHOOK_KEY not in json.dumps(rows) and rows[-1]["details"]["result"] == {"revealed": True}


def test_export_then_import_with_preview_and_typed_apply(px):
    fake, c, _ = px
    put(c, "/stations/entry-a", revision=4, values=VALUES)
    exported = c.get(f"{API}/platform/export", headers=as_user("root"))
    assert exported.status_code == 200 and exported.headers["cache-control"] == "no-store"
    content = json.dumps(exported.json()["data"])
    prev = c.post(f"{API}/platform/import/preview", json={"content": content, "mapping": {"entry-a": "entry-c"}}, headers=as_user("root"))
    assert prev.status_code == 200, prev.text
    review = prev.json()["data"]
    assert review["stations"][0]["target"] == "entry-c" and not [e for e in fake.effects if e[0] == "platform/import_apply"]
    r = post(c, "/import/apply", review_id=review["review_id"])
    assert r.status_code == 409 and r.json()["code"] == "typed_confirmation_required"
    r = post(c, "/import/apply", review_id=review["review_id"], typed_confirmation="ייבוא תצורה")
    assert r.status_code == 200 and r.json()["data"]["stations"] == 1
    wi.LIMITS.reset()
    again = post(c, "/import/apply", review_id=review["review_id"], typed_confirmation="ייבוא תצורה")
    assert again.status_code == 502 and again.json()["details"]["wiskey_code"] == "review_expired"
    bad = c.post(f"{API}/platform/import/preview", json={"content": "not json", "mapping": {}}, headers=as_user("root"))
    assert bad.status_code == 502 and bad.json()["details"]["wiskey_code"] == "configuration_invalid"


def test_retention_preview_then_typed_apply(px):
    fake, c, _ = px
    assert c.post(f"{API}/platform/retention/preview", json={"values": {"days": 0, "count": 100, "bytes": 262144}}, headers=as_user("root")).status_code == 422
    prev = c.post(f"{API}/platform/retention/preview", json={"values": {"days": 30, "count": 1000, "bytes": 16_777_216}}, headers=as_user("root")).json()["data"]
    assert prev["removed"] == 200 and fake.events == 1200
    r = post(c, "/retention/apply", review_id=prev["review_id"], typed_confirmation="מחיקת אירועים")
    assert r.status_code == 200 and fake.events == 1000
    assert set(frames(fake, "platform/retention_apply")[-1]) == {"id", "type", "review_id", "confirmed", "api_contract"}


def test_fleet_change_preview_and_apply_with_a_partial_failure(px):
    fake, c, s = px
    assert c.post(f"{API}/platform/config/preview", json={"station_ids": ["entry-a"], "door": 3, "changes": {"openDuration": 7}}, headers=as_user("root")).status_code == 422
    assert c.post(f"{API}/platform/config/preview", json={"station_ids": [], "door": 1, "changes": {"openDuration": 7}}, headers=as_user("root")).status_code == 422
    read = c.post(f"{API}/platform/config/read", json={"station_ids": ["entry-a", "entry-c"], "door": 1}, headers=as_user("root")).json()["data"]
    assert read["rows"][0]["values"]["openDuration"] == 5
    fake.offline.add("entry-b")  # WisKey answers station_unloaded for it
    prev = c.post(f"{API}/platform/config/preview", json={"station_ids": ["entry-a", "entry-c", "entry-b"], "door": 1, "changes": {"openDuration": 7}},
                  headers=as_user("root")).json()["data"]
    assert prev["count"] == 2 and [r["error"] for r in prev["rows"]] == [None, None, "station_unloaded"] and prev["rows"][0]["after"]["openDuration"] == 7
    fake.fail_station = "entry-c"
    r = post(c, "/config/apply", review_id=prev["review_id"], typed_confirmation="החלה על העמדות")
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["verified"] == 1 and data["failed"] == 1 and data["receipts"][1] == {"at": "2026-11-03T07:00:00+00:00", "station_id": "entry-c", "state": "failed",
                                                                                    "code": "device_unavailable"}
    row = audit_rows(s, "intercom.installer.platform_config_apply")[-1]
    assert row["details"]["result"] == {"verified": 1, "failed": 1, "codes": ["device_unavailable"]}


def test_maintenance_queue_enqueue_progress_and_cancel(px):
    fake, c, _ = px
    prev = c.post(f"{API}/platform/maintenance/preview", json={"station_ids": ["entry-a"], "door": 1, "changes": {"openDuration": 9}}, headers=as_user("root")).json()["data"]
    assert prev["count"] == 1 and prev["rows"][0]["window"]["enabled"] is False
    r = post(c, "/maintenance/enqueue", review_id=prev["review_id"], typed_confirmation="תזמון תחזוקה")
    assert r.status_code == 200 and r.json()["data"]["state"] == "queued"
    job = c.get(f"{API}/platform", headers=as_user("root")).json()["maintenance"]["data"]["records"][0]
    assert job["state"] == "queued" and job["rows"][0]["state"] == "pending"
    stale = post(c, f"/maintenance/jobs/{job['id']}/cancel", fingerprint="old")
    assert stale.status_code == 502 and stale.json()["details"]["wiskey_code"] == "bulk_review_stale"
    wi.LIMITS.reset()
    done = post(c, f"/maintenance/jobs/{job['id']}/cancel", fingerprint=job["fingerprint"])
    assert done.status_code == 200 and done.json()["data"]["records"][0]["state"] == "cancelled"


def test_platform_writes_need_permission_before_the_body(px):
    fake, c, _ = px
    for path in ("/import/apply", "/retention/apply", "/config/apply", "/maintenance/enqueue", "/webhook/key"):
        assert post(c, path, user="otto", review_id="x", typed_confirmation="x").status_code == 403, path
    assert c.post(f"{API}/platform/config/preview", json={"station_ids": ["entry-a"], "door": 1, "changes": {"openDuration": 7}}, headers=as_user("otto")).status_code == 403
    assert not fake.effects
