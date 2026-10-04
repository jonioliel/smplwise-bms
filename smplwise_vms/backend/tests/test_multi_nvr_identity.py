"""CR-024 owner answer (2026-10-04) to the wizard question: `PUT /nvr/connection` - the setup wizard and the first recorder's form -
reconnects `nvr-1` only when it is the SAME physical recorder (keyed identity: model + serial hash, never the serial or the
address). A different device, or an unknown identity, after a removed `nvr-1` with history gets a NEW id, so the old (disabled)
cameras never match the new device's channels. A fresh installation is unchanged (it gets `nvr-1`).

Fakes only: two fake NVRs on reserved `.test` names, a stubbed resolver, made-up passwords and serials."""
from __future__ import annotations

import dataclasses
import json
import sys
from pathlib import Path

import pytest
from conftest import as_user
from fastapi.testclient import TestClient

from smplwise.db import Database
from smplwise.main import create_app
from smplwise.services import autosync, connection_probe, events_ingest

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_devices import GO2RTC_HOST, NVR_ADDR, NVR_HOST, FakeDevices, install_many  # noqa: E402

NVR2_HOST = "fake-nvr-2.test"
NVR2_ADDR = "192.0.2.81"
PW = "Canary-Ident-Pw-31"
SERIAL_A = "FAKE-NVR-SERIAL-A-0001"
SERIAL_B = "FAKE-NVR-SERIAL-B-0002"
API = "/api/v1/nvr/connection"


@pytest.fixture()
def fakes(monkeypatch):
    one = FakeDevices()
    two = FakeDevices(nvr_host=NVR2_HOST, nvr_addr=NVR2_ADDR, shared=False)
    one.nvr["serial"] = SERIAL_A
    two.nvr["serial"] = SERIAL_B
    install_many([one, two], monkeypatch)
    table = {NVR_HOST: [NVR_ADDR], NVR2_HOST: [NVR2_ADDR]}
    monkeypatch.setattr(connection_probe, "RESOLVE", lambda h: list(table.get(h.strip().lower().rstrip("."), [])))
    monkeypatch.setattr(connection_probe, "HOSTNAME", lambda: "arx-test-host")
    monkeypatch.setattr(connection_probe, "LOCAL_ADDRESSES", lambda: set(), raising=False)
    for k in list(autosync.STATE):
        monkeypatch.setitem(autosync.STATE, k, None)
    monkeypatch.setattr(autosync, "RECORDER_STATE", {})
    yield one, two
    events_ingest.shutdown_extra()
    events_ingest.EXTRA.clear()


@pytest.fixture()
def fresh(settings):
    """A new installation: no NVR (the development placeholder host), go2rtc configured."""
    return dataclasses.replace(settings, go2rtc_url=f"http://{GO2RTC_HOST}:1984")


def client(app):
    c = TestClient(app)
    c.headers.update(as_user("joni"))
    c.get("/api/v1/me")
    return c


def rows(settings, sql, args=()):
    with Database(settings.db_path).connection(mode="read") as conn:
        return [dict(r) for r in conn.execute(sql, args).fetchall()]


def put(c, host, **kw):
    rev = c.get(API).json().get("revision") or 0
    return c.put(API, json={"vendor": "hikvision", "host": host, "http_port": 80, "rtsp_port": 554, "username": "viewer", "password": PW, "if_revision": rev, **kw})


def restart_and_discover(settings):
    app = create_app(settings)
    autosync.run_once(app.state.db, app.state.settings, reason="startup")
    return app, client(app)


def connected_then_removed(fresh):
    """nvr-1 connected through the wizard route, discovered (4 cameras), then removed (cameras disabled, history kept)."""
    c = client(create_app(fresh))
    r = put(c, NVR_HOST)
    assert r.status_code == 200 and r.json()["recorder_id"] == "nvr-1" and r.json()["new_recorder"] is False, r.text
    app, c = restart_and_discover(fresh)
    old = rows(fresh, "SELECT id, channel FROM cameras WHERE recorder_id = 'nvr-1' ORDER BY channel")
    assert len(old) == 4
    fp = rows(fresh, "SELECT device_fingerprint FROM recorders WHERE id = 'nvr-1'")[0]["device_fingerprint"]
    assert fp and SERIAL_A not in fp, "a keyed hash, never the serial"
    rev = c.get(API).json()["revision"]
    assert c.request("DELETE", API, json={"confirm_text": "הסר", "if_revision": rev}).status_code == 200
    return c, old, fp


def test_a_fresh_installation_still_gets_nvr_1(fresh, fakes):
    c = client(create_app(fresh))
    r = put(c, NVR_HOST)
    assert r.status_code == 200 and r.json()["recorder_id"] == "nvr-1" and r.json()["new_recorder"] is False
    body = json.dumps(r.json()) + c.post(f"{API}/test", json={"vendor": "hikvision", "host": NVR_HOST, "http_port": 80, "rtsp_port": 554,
                                                              "username": "viewer", "password": PW}).text
    assert SERIAL_A not in body and "_serial" not in body, "the device serial never leaves the server"


def test_the_same_device_reconnected_keeps_nvr_1(fresh, fakes):
    c, old, fp = connected_then_removed(fresh)
    r = put(c, NVR_HOST)
    assert r.status_code == 200 and r.json()["recorder_id"] == "nvr-1" and r.json()["new_recorder"] is False, r.text
    app, c = restart_and_discover(fresh)
    again = rows(fresh, "SELECT id, channel, enabled FROM cameras WHERE recorder_id = 'nvr-1' ORDER BY channel")
    assert [x["id"] for x in again] == [x["id"] for x in old], "the same camera rows (same device, same channels)"
    assert all(x["enabled"] == 0 for x in again), "they stay disabled until the installer reviews them (CR-022 D7)"
    assert not rows(fresh, "SELECT 1 FROM cameras WHERE recorder_id <> 'nvr-1'")


def test_the_same_device_at_a_new_address_is_still_the_same_device(fresh, fakes):
    one, two = fakes
    c, old, fp = connected_then_removed(fresh)
    two.nvr["serial"] = SERIAL_A  # the very same recorder, moved to another address
    r = put(c, NVR2_HOST)
    assert r.json()["recorder_id"] == "nvr-1" and r.json()["new_recorder"] is False


def test_a_different_device_after_removal_gets_a_new_id_and_the_old_cameras_never_match_it(fresh, fakes):
    c, old, fp = connected_then_removed(fresh)
    r = put(c, NVR2_HOST)
    assert r.status_code == 200, r.text
    assert r.json()["recorder_id"] == "nvr-2" and r.json()["new_recorder"] is True and r.json()["restart_required"] is True
    assert c.get(API).json()["vendor"] == "none", "the first recorder stays removed"
    audit = rows(fresh, "SELECT details_json FROM audit_log WHERE action = 'nvr.recorder.add'")
    assert audit and "history_under_first_id" in audit[-1]["details_json"]
    app, c = restart_and_discover(fresh)
    new = rows(fresh, "SELECT id, channel, enabled FROM cameras WHERE recorder_id = 'nvr-2' ORDER BY channel")
    assert len(new) == 4 and not {x["id"] for x in new} & {x["id"] for x in old}, "the new device's channels are new rows"
    still = rows(fresh, "SELECT id, enabled, recorder_id FROM cameras WHERE id IN (%s)" % ",".join("?" * len(old)), [x["id"] for x in old])
    assert {x["recorder_id"] for x in still} == {"nvr-1"} and all(x["enabled"] == 0 for x in still), "the old rows keep nvr-1, disabled"
    # the wizard's NVR step follows the recorder that runs under its new id
    step = next(s for s in c.get("/api/v1/setup/state").json()["steps"] if s["id"] == "nvr")
    assert step["status"] == "done", step


def test_an_unknown_identity_falls_back_to_a_new_id(fresh, fakes):
    one, two = fakes
    c, old, fp = connected_then_removed(fresh)
    one.nvr["serial"] = None  # the device no longer reports a serial: unsure = never the same device
    r = put(c, NVR_HOST)
    assert r.json()["recorder_id"] == "nvr-2" and r.json()["new_recorder"] is True


def test_an_untested_save_after_removal_falls_back_to_a_new_id(fresh, fakes):
    one, two = fakes
    c, old, fp = connected_then_removed(fresh)
    one.nvr["up"] = False
    r = put(c, NVR_HOST, save_untested=True, confirm_text="שמור")
    assert r.status_code == 200 and r.json()["recorder_id"] == "nvr-2" and r.json()["new_recorder"] is True and r.json()["untested"] is True
    # before the restart the wizard step waits for it (not "no NVR")
    step = next(s for s in c.get("/api/v1/setup/state").json()["steps"] if s["id"] == "nvr")
    assert step["status"] == "todo" and (step.get("problem") or {}).get("code") == "restart_pending", step


def test_an_active_first_recorder_edit_is_unchanged(fresh, fakes):
    one, two = fakes
    c = client(create_app(fresh))
    assert put(c, NVR_HOST).json()["recorder_id"] == "nvr-1"
    app, c = restart_and_discover(fresh)
    two.nvr["serial"] = SERIAL_B
    r = put(c, NVR2_HOST)  # editing the live connection of nvr-1 (not after a removal): CR-022 behaviour
    assert r.status_code == 200 and r.json()["recorder_id"] == "nvr-1" and r.json()["new_recorder"] is False
