"""WISKEY-INSTALLER-NATIVE-2400 phase 1: the intercom system's clock from Arx (routers/wiskey_installer_clock.py), end to end over the
add-on's live service session against the fake WisKey validated by the rc.10 extract (tests/fake_wiskey_installer.py). Nothing
contacts a device, Home Assistant or WisKey.

Proven here:
- the exact frames: rc.10's key sets with `api_contract`, on the closed `installer` channel (and that channel lets nothing else out);
- permission: system.configure at the installation for every read and write (an audited 403 before the body is read);
- confirmation per write, the typed phrase for the dangerous ones (host apply, station clock write), the envelope (expired, duplicate);
- honest results: completed with WisKey's own verification facts; refused with WisKey's code and NOTHING changed; unknown on a readback
  mismatch; not_sent for an offline station, a missing typed phrase, Arx's own limits (busy, cool-down, rate);
- audit rows without secrets; the overview's capability discovery."""
from __future__ import annotations

import json
import time
import uuid
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from conftest import as_user, bind
from fake_wiskey import PREFIX
from fake_wiskey_installer import InstallerFake
from fastapi.testclient import TestClient

from smplwise.db import Database
from smplwise.routers import wiskey_installer as router_mod
from smplwise.services import intercom_sync, wiskey_channels
from smplwise.services import wiskey_installer as wi

API = "/api/v1/access-control/installer"


def env(ttl: float = 15.0, **fields: Any) -> dict[str, Any]:
    return {"client_request_id": uuid.uuid4().hex, "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=ttl)).strftime("%Y-%m-%dT%H:%M:%SZ"), **fields}


def wait_for(pred: Any, timeout: float = 5.0) -> None:
    end = time.time() + timeout
    while time.time() < end:
        if pred():
            return
        time.sleep(0.02)
    raise AssertionError(f"condition not met; feed state {intercom_sync.STATE.as_dict()}")


@pytest.fixture()
def wx(settings, monkeypatch):
    """The app with the installer fake as its WisKey: root (system_admin: system.configure at the installation) and otto (operator)."""
    import websockets

    fake = InstallerFake("admin", token="t")
    monkeypatch.setattr(websockets, "connect", fake.connect)
    monkeypatch.setattr(intercom_sync, "RETRY_S", 0.05)
    monkeypatch.setattr(intercom_sync, "RETRY_MAX_S", 0.2)
    for name in ("USER_BURST", "GLOBAL_BURST"):
        monkeypatch.setattr(intercom_sync, name, 1000.0)
    router_mod.reset()
    intercom_sync.SYNC.reset()
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="t", ha_core_url="http://ha.local:8123")
    from smplwise.main import create_app

    c = TestClient(create_app(s))
    bind(c, s, "root", "system_admin", "installation", "*")
    bind(c, s, "otto", "operator", "installation", "*")
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    yield fake, c, s
    intercom_sync.SYNC.shutdown()
    if intercom_sync.SYNC.thread is not None:
        intercom_sync.SYNC.thread.join(timeout=5)
    intercom_sync.SYNC.reset()
    router_mod.reset()


def frames(fake: InstallerFake, command: str) -> list[dict[str, Any]]:
    return [m for m in fake.received if m.get("type") == PREFIX + command]


def audit_rows(s: Any, action: str) -> list[dict[str, Any]]:
    db = Database(s.db_path)
    with db.connection() as conn:
        rows = conn.execute("SELECT actor_user_id, action, decision, resource_type, resource_id, reason, details_json FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()
    return [{**dict(r), "details": json.loads(r["details_json"] or "{}")} for r in rows]


# ---------------------------------------------------------------- the channel


def test_the_installer_channel_is_closed():
    assert wiskey_channels.INSTALLER >= {"clock/settings_get", "clock/settings_update", "clock/host_status", "clock/host_apply", "clock/station_sync"}
    assert not wiskey_channels.allowed("installer", PREFIX + "stations/test_unlock")
    assert not wiskey_channels.allowed("installer", PREFIX + "stations/clock_refresh")  # the station-maintenance channel's, not duplicated
    assert not wiskey_channels.allowed("installer", "get_config")
    assert not any(wiskey_channels.allowed("service", PREFIX + c) for c in wiskey_channels.INSTALLER)
    assert "installer" in wiskey_channels.ADAPTER_CHANNELS


# ---------------------------------------------------------------- reads


def test_overview_lists_the_clock_tool(wx):
    fake, c, _ = wx
    r = c.get(f"{API}/overview", headers=as_user("root"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["tools"]["clock"] == {"available": True, "missing": []}
    assert [s["id"] for s in body["stations"]] == ["entry-a", "entry-b", "entry-c"]


def test_the_clock_view_reads_settings_host_and_stations(wx):
    fake, c, _ = wx
    r = c.get(f"{API}/clock", headers=as_user("root"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["settings"]["data"] == {"revision": 3, "server": "time.windows.com", "port": 123, "interval": 60}
    assert body["host"]["data"]["supported"] is True and body["host"]["data"]["config"]["servers"] == ["time.windows.com"]
    assert [s["id"] for s in body["stations"]] == ["entry-a", "entry-b", "entry-c"]
    assert body["host_typed_phrase"] == "שעון השרת"
    # the exact frames: no keys but WisKey's own, api_contract on these non-READ commands
    assert {k for k in frames(fake, "clock/settings_get")[-1]} == {"id", "type", "api_contract"}
    assert {k for k in frames(fake, "clock/host_status")[-1]} == {"id", "type", "api_contract"}


def test_a_failed_part_does_not_hide_the_others(wx):
    fake, c, _ = wx
    fake.fail_with["clock/host_status"] = "operations_unavailable"
    body = c.get(f"{API}/clock", headers=as_user("root")).json()
    assert body["settings"]["state"] == "ready"
    assert body["host"]["state"] == "error" and body["host"]["error"]["wiskey_code"] == "operations_unavailable"


def test_the_station_check_reads_the_last_measurement_only(wx):
    fake, c, _ = wx
    r = c.get(f"{API}/clock/stations/entry-a", headers=as_user("root"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["typed_phrase"] == "Main gate" and "clock" in body
    assert frames(fake, "health/get") and not frames(fake, "stations/clock_refresh") and not frames(fake, "clock/station_sync")
    c.get(f"{API}/clock/stations/entry-a", headers=as_user("root"))
    assert len(frames(fake, "health/get")) == 1  # cached for 15 s
    assert c.get(f"{API}/clock/stations/nope", headers=as_user("root")).status_code == 404


def test_reads_need_system_configure(wx):
    _, c, s = wx
    for path in ("/overview", "/clock", "/clock/stations/entry-a"):
        r = c.get(API + path, headers=as_user("otto"))
        assert r.status_code == 403, (path, r.text)
    assert any(r["decision"] == "denied" for r in audit_rows(s, "system.configure"))


# ---------------------------------------------------------------- the preference


def test_settings_update_saves_with_confirmation_and_audits_without_secrets(wx):
    fake, c, s = wx
    body = env(revision=3, values={"server": "Pool.NTP.org", "port": 123, "interval": 30})
    r = c.put(f"{API}/clock/settings", json=body, headers=as_user("root"))
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required"
    assert not frames(fake, "clock/settings_update")
    r = c.put(f"{API}/clock/settings", json={**env(revision=3, values={"server": "Pool.NTP.org", "port": 123, "interval": 30}), "confirmed": True}, headers=as_user("root"))
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "completed" and r.json()["data"] == {"revision": 4, "server": "pool.ntp.org", "port": 123, "interval": 30}
    sent = frames(fake, "clock/settings_update")[-1]
    assert set(sent) == {"id", "type", "revision", "values", "api_contract"} and sent["values"]["server"] == "pool.ntp.org"
    rows = audit_rows(s, "intercom.installer.clock_settings_update")
    phases = [r["details"].get("phase") for r in rows]
    assert phases == ["refused", "attempt", "outcome"]
    assert rows[-1]["details"]["outcome"] == "ok" and rows[-1]["actor_user_id"] != "" and rows[-1]["resource_type"] == "intercom_installation"


def test_settings_update_refused_by_wiskey_changes_nothing(wx):
    fake, c, s = wx
    r = c.put(f"{API}/clock/settings", json=env(revision=2, values={"server": "pool.ntp.org", "port": 123, "interval": 30}, confirmed=True), headers=as_user("root"))
    assert r.status_code == 502 and r.json()["code"] == "installer_refused"
    assert r.json()["details"]["outcome"] == "refused" and r.json()["details"]["wiskey_code"] == "revision_conflict"
    assert fake.ntp["revision"] == 3 and not fake.effects
    assert audit_rows(s, "intercom.installer.clock_settings_update")[-1]["details"]["outcome"] == "refused"


def test_settings_update_validates_before_sending(wx):
    fake, c, _ = wx
    for values in ({"server": "1.2.3", "port": 123, "interval": 30}, {"server": "ntp", "port": 1, "interval": 30}, {"server": "ntp", "port": 123, "interval": 0},
                   {"server": "224.0.0.1", "port": 123, "interval": 5}):
        r = c.put(f"{API}/clock/settings", json=env(revision=3, values=values, confirmed=True), headers=as_user("root"))
        assert r.status_code == 422, (values, r.text)
    r = c.put(f"{API}/clock/settings", json=env(revision=3, values={"server": "ntp", "port": "123", "interval": 30}, confirmed=True), headers=as_user("root"))
    assert r.status_code == 422
    assert not frames(fake, "clock/settings_update")


def test_writes_need_system_configure_before_the_body(wx):
    fake, c, _ = wx
    r = c.put(f"{API}/clock/settings", content=b"not json", headers={**as_user("otto"), "content-type": "application/json"})
    assert r.status_code == 403
    r = c.post(f"{API}/clock/stations/entry-a/sync", json=env(revision=3, confirmed=True, typed_confirmation="Main gate"), headers=as_user("otto"))
    assert r.status_code == 403
    assert not frames(fake, "clock/station_sync")


def test_envelope_expired_and_duplicate(wx):
    fake, c, _ = wx
    old = env(revision=3, values={"server": "pool.ntp.org", "port": 123, "interval": 30}, confirmed=True)
    old["expires_at"] = (datetime.now(timezone.utc) - timedelta(seconds=5)).strftime("%Y-%m-%dT%H:%M:%SZ")
    assert c.put(f"{API}/clock/settings", json=old, headers=as_user("root")).json()["code"] == "expired"
    once = env(revision=3, values={"server": "pool.ntp.org", "port": 123, "interval": 30}, confirmed=True)
    assert c.put(f"{API}/clock/settings", json=once, headers=as_user("root")).status_code == 200
    wi.LIMITS.reset()
    again = c.put(f"{API}/clock/settings", json=once, headers=as_user("root"))
    assert again.status_code == 409 and again.json()["code"] == "intercom_duplicate_command"
    assert len(frames(fake, "clock/settings_update")) == 1


# ---------------------------------------------------------------- the host


def test_host_apply_needs_the_typed_phrase(wx):
    fake, c, s = wx
    r = c.post(f"{API}/clock/host-apply", json=env(revision=3, confirmed=True), headers=as_user("root"))
    assert r.status_code == 409 and r.json()["code"] == "typed_confirmation_required" and r.json()["details"]["expected"] == "שעון השרת"
    r = c.post(f"{API}/clock/host-apply", json=env(revision=3, confirmed=True, typed_confirmation="שעון  השרת "), headers=as_user("root"))
    assert r.status_code == 200, r.text
    assert r.json()["data"]["configuration_verified"] is True
    assert set(frames(fake, "clock/host_apply")[-1]) == {"id", "type", "revision", "api_contract"}
    assert fake.effects == [("clock/host_apply", {"server": "time.windows.com"})]


def test_host_apply_refused_when_the_host_has_no_ntp(wx):
    fake, c, _ = wx
    fake.host["supported"] = False
    r = c.post(f"{API}/clock/host-apply", json=env(revision=3, confirmed=True, typed_confirmation="שעון השרת"), headers=as_user("root"))
    assert r.status_code == 502 and r.json()["details"]["wiskey_code"] == "operation_unsupported"
    assert not fake.effects


def test_host_apply_readback_mismatch_is_unknown_not_done(wx):
    fake, c, s = wx
    fake.fail_with["clock/host_apply"] = "readback_mismatch"
    r = c.post(f"{API}/clock/host-apply", json=env(revision=3, confirmed=True, typed_confirmation="שעון השרת"), headers=as_user("root"))
    assert r.status_code == 504 and r.json()["code"] == "installer_outcome_unknown" and r.json()["details"]["outcome"] == "unknown"
    assert audit_rows(s, "intercom.installer.clock_host_apply")[-1]["details"]["outcome"] == "unknown"
    # the cool-down holds after a send: no blind repeat
    again = c.post(f"{API}/clock/host-apply", json=env(revision=3, confirmed=True, typed_confirmation="שעון השרת"), headers=as_user("root"))
    assert again.status_code == 429 and again.json()["code"] == "installer_cooldown"
    assert len(frames(fake, "clock/host_apply")) == 1


# ---------------------------------------------------------------- a station


def test_station_sync_typed_station_name_and_verified_result(wx):
    fake, c, s = wx
    r = c.post(f"{API}/clock/stations/entry-a/sync", json=env(revision=3, confirmed=True, typed_confirmation="Side door"), headers=as_user("root"))
    assert r.status_code == 409 and r.json()["code"] == "typed_confirmation_required"
    r = c.post(f"{API}/clock/stations/entry-a/sync", json=env(revision=3, confirmed=True, typed_confirmation="Main gate", copy_system=True), headers=as_user("root"))
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["configuration_verified"] is True and data["clock_verified"] is True and data["copied_system"] is True
    assert data["clock"]["measurement"]["estimated_skew_seconds"] == 0.6 and "zone" not in data["clock"]
    sent = frames(fake, "clock/station_sync")[-1]
    assert set(sent) == {"id", "type", "station_id", "revision", "copy_system", "api_contract"} and sent["copy_system"] is True
    row = audit_rows(s, "intercom.installer.clock_station_sync")[-1]
    assert row["resource_type"] == "intercom_station" and row["resource_id"] == "entry-a"
    assert row["details"]["result"] == {"configuration_verified": True, "clock_verified": True, "copied_system": True, "skew_seconds": 0.6}


def test_station_sync_reports_an_unverified_clock_honestly(wx):
    fake, c, _ = wx
    r = c.post(f"{API}/clock/stations/entry-c/sync", json=env(revision=3, confirmed=True, typed_confirmation="Loading dock"), headers=as_user("root"))
    assert r.status_code == 200
    assert r.json()["data"]["configuration_verified"] is True and r.json()["data"]["clock_verified"] is False


def test_station_sync_offline_station_is_not_sent(wx):
    fake, c, s = wx
    r = c.post(f"{API}/clock/stations/entry-b/sync", json=env(revision=3, confirmed=True, typed_confirmation="Side door"), headers=as_user("root"))
    assert r.status_code == 409 and r.json()["code"] == "intercom_station_offline" and r.json()["details"]["outcome"] == "not_sent"
    assert not frames(fake, "clock/station_sync")
    assert audit_rows(s, "intercom.installer.clock_station_sync")[-1]["details"]["phase"] == "refused"


def test_station_sync_one_at_a_time_and_per_operator_window(wx, monkeypatch):
    fake, c, _ = wx
    assert wi.LIMITS.admit("someone", wi.Op("x", "clock/station_sync", "write", "a"), "t") is None  # holds the only slot
    r = c.post(f"{API}/clock/stations/entry-a/sync", json=env(revision=3, confirmed=True, typed_confirmation="Main gate"), headers=as_user("root"))
    assert r.status_code == 429 and r.json()["code"] == "installer_busy"
    wi.LIMITS.reset()
    monkeypatch.setattr(wi, "USER_MAX", 1)
    assert c.post(f"{API}/clock/stations/entry-a/sync", json=env(revision=3, confirmed=True, typed_confirmation="Main gate"), headers=as_user("root")).status_code == 200
    r = c.post(f"{API}/clock/stations/entry-c/sync", json=env(revision=3, confirmed=True, typed_confirmation="Loading dock"), headers=as_user("root"))
    assert r.status_code == 429 and r.json()["code"] == "installer_rate_limited" and r.json()["details"]["retry_after_s"] > 0
    assert len(frames(fake, "clock/station_sync")) == 1


def test_a_station_write_without_a_served_copy_is_not_sent(wx, monkeypatch):
    fake, c, _ = wx
    monkeypatch.setattr(wi, "stations", lambda settings: None)
    r = c.post(f"{API}/clock/stations/entry-a/sync", json=env(revision=3, confirmed=True, typed_confirmation="Main gate"), headers=as_user("root"))
    assert r.status_code == 503 and r.json()["details"]["outcome"] == "not_sent"
    assert not frames(fake, "clock/station_sync")


def test_wiskey_refusal_of_the_whole_identity(wx):
    fake, c, _ = wx
    fake.set_forbidden({"clock/station_sync"})
    r = c.post(f"{API}/clock/stations/entry-a/sync", json=env(revision=3, confirmed=True, typed_confirmation="Main gate"), headers=as_user("root"))
    assert r.status_code == 502 and r.json()["details"]["outcome"] == "refused" and r.json()["details"]["wiskey_code"] == "unauthorized"
    assert not fake.effects
