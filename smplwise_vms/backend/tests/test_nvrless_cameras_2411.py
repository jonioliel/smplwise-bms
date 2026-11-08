"""NVRLESS-CAMERAS-2411 (owner decision 2א, 08.11; docs/changes/NVRLESS-CAMERAS-2411.md): the capability `cameras_available`.

An installation with no NVR shows the camera screens when it has at least one camera without a recorder (pseudo-recorder
`standalone`, CAMERA-STREAM-SOURCES-2410). The backend says so on /me, /health, /health/report and /setup/state:
`cameras_available` = an NVR OR a camera without a recorder. Such a camera is also a live source (`live_video` with go2rtc).
Nothing is renamed; with zero cameras without a recorder every existing flag is what it was. Fakes only: the `.test` devices of
tests/fixtures/fake_devices.py and catalogue rows written straight into the database - no device, go2rtc or camera is contacted."""
from __future__ import annotations

import dataclasses
import sys
from pathlib import Path

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise import capabilities as capmod
from smplwise.db import now_iso
from smplwise.main import create_app
from smplwise.mode import FULL, HA_ONLY
from smplwise.services import autosync, ha_sync
from smplwise.services import camera_sources as cs
from smplwise.services import setup_wizard as wizard

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_devices import GO2RTC_HOST, HA_HOST, NVR_HOST, FakeDevices  # noqa: E402

COMBOS = ("A", "B", "C", "D")  # A: no NVR, no go2rtc · B: go2rtc only · C: NVR only (unsupported) · D: both


@pytest.fixture(autouse=True)
def clean_process_state(monkeypatch):
    wizard.reset()
    monkeypatch.setattr(wizard, "CHECK_EVERY_S", 0.0)
    for k in list(autosync.STATE):
        monkeypatch.setitem(autosync.STATE, k, None)
    monkeypatch.setattr(ha_sync.STATE, "connected", False)
    yield
    wizard.reset()


@pytest.fixture()
def fake(monkeypatch):
    f = FakeDevices()
    f.install(monkeypatch)
    return f


def combo_settings(settings, combo: str, ha: bool = False):
    has_nvr, has_go2rtc = combo in ("C", "D"), combo in ("B", "D")
    return dataclasses.replace(
        settings,
        nvr_host=NVR_HOST if has_nvr else None, nvr_user="viewer" if has_nvr else None, nvr_password="pw" if has_nvr else None,
        go2rtc_url=f"http://{GO2RTC_HOST}:1984" if has_go2rtc else None,
        ha_url=f"http://{HA_HOST}:8123" if ha else None, ha_token="fake-token" if ha else None,
        data_dir=settings.data_dir.parent / f"nvrlesscam-{combo}-{int(ha)}")


def add_standalone(app, n: int = 1) -> list[str]:
    """Catalogue rows of the pseudo-recorder exactly as camera_sources.create_standalone writes them (minus the sealed source,
    which the capability never reads)."""
    ids = []
    with app.state.db.connection() as conn:
        cs._ensure_standalone_recorder(conn)
        now = now_iso()
        for i in range(1, n + 1):
            cid = f"sa{i}"
            conn.execute("INSERT INTO cameras(id, recorder_id, channel, name_source, sort_order, capabilities_json, status, created_at, updated_at) "
                         "VALUES (?, ?, ?, ?, ?, '{}', 'unknown', ?, ?)", (cid, cs.STANDALONE, i, f"כניסה {i}", cs.STANDALONE_SORT_BASE + i, now, now))
            ids.append(cid)
    return ids


def leftover_nvr_camera(app) -> None:
    """A camera row of a removed NVR (NN1 D5): it must NOT make cameras available."""
    with app.state.db.connection() as conn:
        autosync.ensure_recorder(conn)
        now = now_iso()
        conn.execute("INSERT INTO cameras(id, recorder_id, channel, name_source, sort_order, main_track, sub_track, capabilities_json, status, created_at, updated_at) "
                     "VALUES ('cam1', ?, 1, 'שער', 1, 101, 102, '{}', 'online', ?, ?)", (autosync.DEFAULT_RECORDER, now, now))


# ---------------------------------------------------------------- the derivation

@pytest.mark.parametrize("combo", COMBOS)
def test_resolve_with_and_without_a_camera_without_a_recorder(combo, settings):
    s = combo_settings(settings, combo)
    app = create_app(s)
    has_nvr, has_go2rtc = combo in ("C", "D"), combo in ("B", "D")
    with app.state.db.connection() as conn:
        before = capmod.resolve(s, conn)
    assert before.cameras_available is has_nvr, "zero cameras without a recorder: cameras = an NVR, exactly as before"
    assert before == capmod.resolve(s), "without such a camera the database adds nothing"
    add_standalone(app)
    with app.state.db.connection() as conn:
        after = capmod.resolve(s, conn)
    assert after.cameras_available is True
    assert after.live_video is has_go2rtc, "a camera without a recorder is a live source - through go2rtc only"
    unchanged = ("nvr", "go2rtc", "ha", "playback", "events_recorder", "events_ha", "ha_cameras_still", "ha_cameras_live", "supported", "unsupported_reason")
    assert {k: getattr(after, k) for k in unchanged} == {k: getattr(before, k) for k in unchanged}, "the recorder-only flags never follow it"
    assert after.recorders == before.recorders and "standalone" not in [r.id for r in after.recorders]


def test_resolve_without_a_connection_is_the_old_answer(settings):
    """Callers that only gate a route (ensure_capability) and pass no connection get the pre-2411 answer."""
    s = combo_settings(settings, "B")
    app = create_app(s)
    add_standalone(app)
    assert capmod.resolve(s).cameras_available is False and capmod.resolve(s).live_video is False
    with app.state.db.connection() as conn:
        capmod.ensure_capability(s, "cameras_available", conn)
        capmod.ensure_capability(s, "live_video", conn)
    with pytest.raises(Exception) as exc:
        capmod.ensure_capability(s, "cameras_available")
    assert exc.value.status == 409 and exc.value.code == "capability_unavailable"


def test_leftover_rows_of_a_removed_nvr_do_not_make_cameras_available(settings):
    s = combo_settings(settings, "B")
    app = create_app(s)
    leftover_nvr_camera(app)
    with app.state.db.connection() as conn:
        assert capmod.resolve(s, conn).cameras_available is False, "NN1 D5: leftover NVR rows stay invisible"


def test_removing_the_last_camera_without_a_recorder_takes_the_flag_back(settings):
    s = combo_settings(settings, "B")
    app = create_app(s)
    ids = add_standalone(app, 2)
    with app.state.db.connection() as conn:
        assert cs.standalone_count(conn) == 2
        conn.execute("DELETE FROM cameras WHERE id = ?", (ids[0],))
        assert capmod.resolve(s, conn).cameras_available is True
        conn.execute("DELETE FROM cameras WHERE id = ?", (ids[1],))
        assert cs.standalone_count(conn) == 0 and capmod.resolve(s, conn).cameras_available is False


# ---------------------------------------------------------------- the capability block on every route that carries it

@pytest.mark.parametrize("standalone", (False, True))
@pytest.mark.parametrize("combo", COMBOS)
def test_me_health_report_and_setup_state_carry_cameras_available(combo, standalone, settings, monkeypatch, fake):
    s = combo_settings(settings, combo)
    app = create_app(s)
    if standalone:
        add_standalone(app)
    c = TestClient(app)
    want = combo in ("C", "D") or standalone
    me = c.get("/api/v1/me").json()
    assert me["capabilities"]["cameras_available"] is want
    assert me["capabilities"]["nvr"] is (combo in ("C", "D")), "the NVR flag itself never follows a camera without a recorder"
    assert me["mode"] == (FULL if combo in ("C", "D") else HA_ONLY), "the old mode field is unchanged"
    assert c.get("/api/v1/health").json()["capabilities"]["cameras_available"] is want
    assert c.get("/api/v1/health/report?fresh=1").json()["capabilities"]["cameras_available"] is want
    assert c.get("/api/v1/setup/state").json()["capabilities"]["cameras_available"] is want


def test_the_flag_is_for_every_signed_in_user_and_carries_no_detail(settings, monkeypatch, fake):
    s = combo_settings(settings, "B")
    app = create_app(s)
    add_standalone(app)
    c = TestClient(app)
    c.get("/api/v1/me")
    bind(c, s, "ron", "viewer", "installation", "*")
    caps = c.get("/api/v1/me", headers=as_user("ron")).json()["capabilities"]
    assert caps["cameras_available"] is True and "recorders" not in caps
    assert "sa1" not in repr(caps) and GO2RTC_HOST not in repr(caps), "a boolean only - no camera id, no address"


def test_the_camera_list_serves_cameras_without_a_recorder_in_an_installation_without_an_nvr(settings, monkeypatch, fake):
    """The backend half was ready in 2.41.0 (GET /cameras has no NVR gate); this pins it next to the new flag."""
    s = combo_settings(settings, "B")
    app = create_app(s)
    add_standalone(app)
    body = TestClient(app).get("/api/v1/cameras").json()
    sa = [cam for cam in body["cameras"] if cam["id"] == "sa1"]
    assert len(sa) == 1 and sa[0]["standalone"] is True
    assert "standalone" in [r["id"] for r in body["recorders"]]
