"""NVR-less mode (owner request 2026-09-29, docs/operations/NVR_LESS_MODE.md): an installation whose add-on options name no
NVR host runs as `ha_only` - Home Assistant, floor plans, device control and WisKey - with no NVR background work, a
neutral health picture, a wizard that skips the NVR and camera steps on purpose, and clean 409 `nvr_not_configured`
answers from the routes that need the NVR (never a 500 or a device timeout). Adding an NVR later is an options change
and a restart; the data needs no migration either way."""
from __future__ import annotations

import dataclasses
import logging
import sys
import time
from pathlib import Path

import pytest
from conftest import as_user, bind, png_bytes, seed_tree, sw_time_factor
from fastapi.testclient import TestClient

from smplwise.db import Database, now_iso, set_setting
from smplwise.main import create_app
from smplwise.mode import FULL, HA_ONLY, installation_mode
from smplwise.services import autosync, backup as backup_svc, bridge_install, events_derive, events_ingest, ha_sync, nvr, storage, thumbnails
from smplwise.services import exports as exports_svc
from smplwise.services import setup_wizard as wizard

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_devices import GO2RTC_HOST, HA_HOST, FakeDevices  # noqa: E402

STATE = "/api/v1/setup/state"


@pytest.fixture()
def ha_only(settings):
    """The conftest settings name a placeholder NVR host (full mode); the NVR-less installation has none at all."""
    return dataclasses.replace(settings, nvr_host=None, nvr_user=None, nvr_password=None)


@pytest.fixture(autouse=True)
def clean_process_state(monkeypatch):
    wizard.reset()
    monkeypatch.setattr(wizard, "CHECK_EVERY_S", 0.0)
    for k in list(autosync.STATE):
        monkeypatch.setitem(autosync.STATE, k, None)
    monkeypatch.setattr(ha_sync.STATE, "connected", False)
    monkeypatch.setattr(ha_sync.STATE, "last_error", None)
    for k in list(bridge_install.STATE):
        monkeypatch.setitem(bridge_install.STATE, k, None)
    yield
    wizard.reset()


def step_of(body: dict, step: str) -> dict:
    return next(s for s in body["steps"] if s["id"] == step)


def publish_plan(c: TestClient, floor_id: str) -> None:
    asset = c.post(f"/api/v1/floors/{floor_id}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{floor_id}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200


# ---------------------------------------------------------------- the mode itself

def test_mode_follows_the_nvr_host_option_only(settings, ha_only):
    assert installation_mode(ha_only) == HA_ONLY
    assert installation_mode(dataclasses.replace(ha_only, nvr_host="  ")) == HA_ONLY, "a blank host is no host"
    assert installation_mode(settings) == FULL, "a host without credentials is a full installation whose NVR is not configured yet"
    assert installation_mode(dataclasses.replace(settings, nvr_user="u", nvr_password="p")) == FULL


def test_load_settings_without_nvr_options(tmp_path, monkeypatch):
    """Inside the add-on the options decide alone (no nvr_host = ha_only). Every other launch - a developer backend, a
    throwaway test backend, a Playwright fixture - keeps the full mode with a placeholder host unless SW_MODE=ha_only."""
    from smplwise import config
    from smplwise.config import DEV_NVR_PLACEHOLDER, load_settings

    for k in ("NVR_HOST", "NVR_USER", "NVR_PASSWORD", "SW_MODE"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("SW_DATA_DIR", str(tmp_path / "data"))
    opts = tmp_path / "options.json"
    opts.write_text('{"nvr_host": "", "nvr_username": "", "nvr_password": "", "log_level": "info"}', encoding="utf-8")
    dev = load_settings(opts)
    assert dev.nvr_host == DEV_NVR_PLACEHOLDER and installation_mode(dev) == FULL, "a dev / test backend keeps the camera screens"
    assert dev.nvr_user is None and dev.nvr_password is None, "the placeholder never gets credentials: nothing connects to it"
    monkeypatch.setenv("SW_MODE", "ha_only")
    assert installation_mode(load_settings(opts)) == HA_ONLY
    monkeypatch.delenv("SW_MODE")
    monkeypatch.setenv("SUPERVISOR_TOKEN", "t")  # inside the add-on: never the placeholder
    assert load_settings(opts).nvr_host is None
    monkeypatch.delenv("SUPERVISOR_TOKEN")
    # the add-on reads /data/options.json: no nvr_host is the NVR-less mode, whatever the environment says
    real_path = config.Path
    monkeypatch.setattr(config, "Path", lambda p: real_path(opts) if str(p) == "/data/options.json" else real_path(p))
    addon = load_settings("/data/options.json")
    assert addon.nvr_host is None and installation_mode(addon) == HA_ONLY
    opts.write_text('{"nvr_host": "nvr.local", "nvr_username": "v", "nvr_password": "p"}', encoding="utf-8")
    assert installation_mode(load_settings("/data/options.json")) == FULL


def test_mode_is_reported_in_me_health_and_setup_state(ha_only, settings):
    c = TestClient(create_app(ha_only))
    assert c.get("/api/v1/me").json()["mode"] == HA_ONLY
    h = c.get("/api/v1/health").json()
    assert h["mode"] == HA_ONLY and h["status"] == "ok"
    assert h["nvr"] == {"configured": False, "state": "not_configured", "label": "לא מוגדר - מצב ללא NVR"}
    assert c.get(STATE).json()["mode"] == HA_ONLY
    assert c.get("/api/v1/health/summary").json()["mode"] == HA_ONLY
    assert c.get("/api/v1/health/report").json()["mode"] == HA_ONLY

    full = TestClient(create_app(dataclasses.replace(settings, data_dir=settings.data_dir.parent / "full")))
    fh = full.get("/api/v1/health").json()
    assert fh["nvr"]["state"] == "placeholder" and "פיתוח" in fh["nvr"]["label"], "the placeholder host is labelled, never shown as an NVR"
    conn_view = full.get("/api/v1/nvr/connection").json()
    assert conn_view["host"] is None and conn_view["placeholder"] is True
    assert full.get("/api/v1/me").json()["mode"] == FULL
    assert full.get("/api/v1/health").json()["mode"] == FULL


# ---------------------------------------------------------------- start-up: no NVR background work

@pytest.mark.parametrize("mode", [HA_ONLY, FULL])
def test_start_up_starts_no_nvr_background_work_in_ha_only(mode, ha_only, monkeypatch, caplog):
    calls: list[str] = []
    monkeypatch.setattr(events_ingest.LISTENER, "start", lambda *a, **k: calls.append("alert_stream"))
    monkeypatch.setattr(exports_svc.WORKER, "start", lambda *a, **k: calls.append("export_worker"))
    monkeypatch.setattr(thumbnails.WORKER, "start_with", lambda *a, **k: calls.append("thumbnails"))
    monkeypatch.setattr(autosync, "run_once", lambda *a, **k: calls.append("discovery"))
    monkeypatch.setattr(events_derive, "run_once", lambda *a, **k: calls.append("derive") or 0)
    monkeypatch.setattr(storage, "warm", lambda *a, **k: calls.append("storage_warm") or False)
    monkeypatch.setattr(nvr, "device_info", lambda *a, **k: pytest.fail("no NVR call at start-up"))
    s = ha_only if mode == HA_ONLY else dataclasses.replace(ha_only, nvr_host="nvr.fixture.test")
    caplog.set_level(logging.INFO, logger="smplwise")
    app = create_app(s)
    with TestClient(app) as c:
        assert c.get("/healthz").json() == {"status": "ok"}
        deadline = time.time() + 5
        while mode == FULL and "discovery" not in calls and time.time() < deadline:
            time.sleep(0.05)  # the start-up discovery is an asyncio task
    lines = [r.getMessage() for r in caplog.records if "installation mode: ha_only" in r.getMessage()]
    if mode == HA_ONLY:
        assert calls == [], f"NVR background work started in the NVR-less mode: {calls}"
        assert len(lines) == 1 and caplog.records[[r.getMessage() for r in caplog.records].index(lines[0])].levelno == logging.INFO
    else:
        assert {"alert_stream", "export_worker", "thumbnails", "discovery"} <= set(calls), calls
        assert lines == []


def test_janitor_tick_skips_the_nvr_work_in_ha_only(ha_only, monkeypatch):
    from smplwise.main import janitor_tick
    from smplwise.services import nvr_write

    app = create_app(ha_only)
    monkeypatch.setattr(storage, "warm", lambda *a, **k: pytest.fail("no NVR storage warm-up in the NVR-less mode"))
    monkeypatch.setattr(nvr_write, "stop_expired_manual", lambda *a, **k: pytest.fail("no NVR recording to stop"))
    janitor_tick(app.state.db, ha_only)  # the local housekeeping (retention, audit prune, checkpoint) still runs


# ---------------------------------------------------------------- health: neutral, never red because of the NVR

def with_ha(settings):
    return dataclasses.replace(settings, ha_url=f"http://{HA_HOST}:8123", ha_token="fake-token")


def test_health_summary_is_green_without_an_nvr_while_home_assistant_is_up(ha_only, monkeypatch):
    s = with_ha(ha_only)
    app = create_app(s)
    c = TestClient(app)
    backup_svc.create_standalone(s, app.state.db, "auto-daily")  # a fresh install's only other item
    monkeypatch.setattr(ha_sync.STATE, "connected", True)
    r = c.get("/api/v1/health/summary").json()
    assert r["status"] == "ok" and r["items"] == [], r


def test_home_assistant_is_the_product_in_ha_only_missing_or_down_is_red(ha_only, monkeypatch):
    """Without an NVR, Home Assistant is the whole product: not configured, or disconnected past a minute, is an error."""
    app = create_app(ha_only)
    backup_svc.create_standalone(ha_only, app.state.db, "auto-daily")
    r = TestClient(app).get("/api/v1/health/summary").json()
    assert r["status"] == "error" and [i["id"] for i in r["items"]] == ["ha"], r
    rep_ = TestClient(app).get("/api/v1/health/report").json()
    assert {x["id"]: x["status"] for x in rep_["checks"]}["ha_sync"] == "error"

    s = with_ha(ha_only)
    app2 = create_app(dataclasses.replace(s, data_dir=s.data_dir.parent / "ha"))
    backup_svc.create_standalone(app2.state.settings, app2.state.db, "auto-daily")
    c2 = TestClient(app2)
    monkeypatch.setattr(ha_sync.STATE, "connected", True)
    monkeypatch.setattr(ha_sync.STATE, "connected", False)  # just lost: within the grace period
    assert c2.get("/api/v1/health/summary").json()["status"] != "error"
    monkeypatch.setitem(ha_sync.STATE.__dict__, "disconnected_since", time.monotonic() - 120)
    r2 = c2.get("/api/v1/health/summary").json()
    assert r2["status"] == "error" and r2["items"][0]["id"] == "ha", r2
    assert {x["id"]: x["status"] for x in c2.get("/api/v1/health/report").json()["checks"]}["ha_sync"] == "error"

    full = dataclasses.replace(ha_only, nvr_host="nvr-placeholder.test", data_dir=s.data_dir.parent / "full")
    app3 = create_app(full)
    backup_svc.create_standalone(full, app3.state.db, "auto-daily")
    assert TestClient(app3).get("/api/v1/health/summary").json()["status"] != "error", "the full mode keeps its HA wording (warn)"


def test_health_report_shows_the_nvr_as_off_and_drops_the_nvr_jobs(ha_only, monkeypatch):
    monkeypatch.setattr(nvr, "device_info", lambda *a, **k: pytest.fail("the report never probes an NVR in the NVR-less mode"))
    for k, v in (("cameras_last_error", "nvr_not_configured"),):  # what an old process left behind
        monkeypatch.setitem(autosync.STATE, k, v)
    monkeypatch.setitem(events_derive.STATE, "last_error", "nvr_not_configured")
    c = TestClient(create_app(ha_only))
    r = c.get("/api/v1/health/report?fresh=1").json()
    by = {x["id"]: x for x in r["checks"]}
    assert by["nvr"]["status"] == "off" and "מצב ללא NVR" in by["nvr"]["detail"]
    assert by["go2rtc"]["status"] == "off", "go2rtc is optional without an NVR"
    for gone in ("events_ingest", "events_derive", "discovery", "video_webrtc", "thumbnails", "exports"):
        assert gone not in by, f"{gone} is an NVR job and is not reported in the NVR-less mode"
    assert "error" not in {x["status"] for x in r["checks"] if x["id"] not in ("backups", "ha_sync")}, "ha_sync: no HA here (its own test)"


def test_off_checks_never_lower_the_overall_status(ha_only, monkeypatch):
    from smplwise.services import health_report

    app = create_app(ha_only)
    backup_svc.create_standalone(ha_only, app.state.db, "auto-daily")
    with app.state.db.connection() as conn:
        rep = health_report.build(ha_only, conn, probe=True)
    statuses = {x["id"]: x["status"] for x in rep["checks"]}
    assert statuses["nvr"] == "off"
    worst_without_off = "error" if "error" in statuses.values() else "warn" if "warn" in statuses.values() else "ok"
    assert rep["status"] == worst_without_off


# ---------------------------------------------------------------- the setup wizard

def test_wizard_skips_the_nvr_and_camera_steps_on_purpose(ha_only):
    """CR-022: without an NVR host the NVR step asks for an explicit choice (todo until "no NVR" or a connection is stored);
    the camera step stays skipped on purpose. No platform-options wording anywhere."""
    c = TestClient(create_app(ha_only))
    body = c.get(STATE).json()
    nvr_step, cam, go = step_of(body, "nvr"), step_of(body, "camera"), step_of(body, "go2rtc")
    assert cam["status"] == "not_applicable" and cam["status_label"] == "דילוג - מצב ללא NVR", cam
    assert cam["problem"]["code"] == "nvr_less_mode" and "nvr_host" not in cam["problem"]["action"] and "הגדרות › חיבורים" in cam["problem"]["action"]
    assert nvr_step["status"] == "todo" and nvr_step["problem"]["code"] == "nvr_choice_needed", nvr_step
    assert nvr_step["problem"]["link"]["href"] == "#/system/setup"
    assert go["status"] == "not_applicable" and go["problem"]["code"] == "go2rtc_optional"
    assert body["total"] == 4 and body["done"] == 1 and body["next"] == "nvr", "install, nvr (choose), ha and floor remain"
    assert all(s["status"] != "failed" for s in body["steps"] if s["id"] in ("nvr", "camera", "go2rtc"))
    # the explicit "no NVR" choice completes the step
    r = c.put("/api/v1/nvr/connection", json={"vendor": "none"})
    assert r.status_code == 200 and r.json()["restart_required"] is True, r.text
    after = step_of(c.get(STATE).json(), "nvr")
    assert after["status"] == "done" and after["evidence"]["choice"] == "none"


def test_wizard_nvr_check_probes_nothing(ha_only, monkeypatch):
    monkeypatch.setattr(nvr, "device_info", lambda *a, **k: pytest.fail("no NVR probe in the NVR-less mode"))
    c = TestClient(create_app(ha_only))
    r = c.post("/api/v1/setup/check/nvr")
    assert r.status_code == 200 and step_of(r.json(), "nvr")["status"] == "todo", "nothing chosen yet (CR-022); still no probe"


def test_wizard_is_ready_with_the_remaining_steps(ha_only, monkeypatch):
    fake = FakeDevices()
    fake.install(monkeypatch)
    s = dataclasses.replace(ha_only, go2rtc_url=f"http://{GO2RTC_HOST}:1984", ha_url=f"http://{HA_HOST}:8123", ha_token="fake-token")
    c = TestClient(create_app(s))
    ids = seed_tree(c)
    publish_plan(c, ids["floor2"])
    monkeypatch.setattr(ha_sync.STATE, "connected", True)
    with Database(s.db_path).connection() as conn:
        set_setting(conn, "bridge.secret", "s3cret")
        set_setting(conn, "bridge.paired_at", now_iso())
        set_setting(conn, "bridge.integration_version", "0.3.0")
    for sid in ("ha", "go2rtc"):
        assert step_of(c.post(f"/api/v1/setup/check/{sid}").json(), sid)["status"] == "done", sid
    assert c.put("/api/v1/nvr/connection", json={"vendor": "none"}).status_code == 200  # CR-022: the explicit "no NVR" choice
    body = c.get(STATE).json()
    go = step_of(body, "go2rtc")
    assert go["status"] == "done", "a configured go2rtc is a real step (WisKey station video)"
    assert "no_cameras_yet" not in {w["code"] for w in go["warnings"]}, "no camera streams are expected without an NVR"
    assert body["total"] == 5 and body["done"] == 5 and body["ready"] is True and body["next"] is None
    assert [x["status"] for x in body["steps"]] == ["done", "done", "done", "done", "done", "not_applicable"]
    # past the live cache (no stream sync runs without an NVR): go2rtc stays done on its last successful check
    real = time.time
    monkeypatch.setattr(wizard.time, "time", lambda: real() + wizard.LIVE_TTL_S + 60)
    later = c.get(STATE).json()
    assert step_of(later, "go2rtc")["status"] == "done" and step_of(later, "go2rtc")["source"] == "background"
    assert later["ready"] is True and later["total"] == 5
    # a later failed check forgets the success: once its own cache expires the step is not "done" again
    monkeypatch.setattr(wizard.time, "time", real)
    fake.go2rtc["up"] = False
    assert step_of(c.post("/api/v1/setup/check/go2rtc").json(), "go2rtc")["status"] == "failed"
    monkeypatch.setattr(wizard.time, "time", lambda: real() + wizard.LIVE_TTL_S + 60)
    assert step_of(c.get(STATE).json(), "go2rtc")["status"] != "done"
    assert fake.writes == []


def test_wizard_needs_go2rtc_when_wiskey_station_video_is_configured(ha_only):
    s = dataclasses.replace(ha_only, wiskey_user="door", wiskey_password="pw")
    body = TestClient(create_app(s)).get(STATE).json()
    go = step_of(body, "go2rtc")
    assert go["status"] == "failed" and go["problem"]["code"] == "media_not_configured", "WisKey stills and video go through go2rtc"
    assert body["total"] == 5


# ---------------------------------------------------------------- the NVR routes: clean 409, never 500 or a timeout

# a camera left over from an earlier NVR (a restored backup, an NVR removed from the options): `cam1`
AT = {"from_at": "2026-09-29T10:00:00Z", "to_at": "2026-09-29T10:00:30Z"}
NVR_ROUTES = [
    ("POST", "/api/v1/cameras/sync", None),
    ("POST", "/api/v1/cameras", {"channel": 1, "alias": "x"}),
    ("GET", "/api/v1/cameras/cam1/snapshot.jpg", None),
    ("GET", "/api/v1/cameras/cam1/capabilities", None),
    ("GET", "/api/v1/cameras/cam1/zones", None),
    ("GET", "/api/v1/cameras/cam1/recordings?date=2026-09-29", None),
    ("GET", "/api/v1/cameras/cam1/frame?at=2026-09-29T10:00:00Z", None),
    ("POST", "/api/v1/playback/sessions", {"camera_id": "cam1", "start_at": "2026-09-29T10:00:00Z"}),
    ("POST", "/api/v1/playback/groups", {"camera_ids": ["cam1"], "start_at": "2026-09-29T10:00:00Z"}),
    ("POST", "/api/v1/exports", {"camera_id": "cam1", **AT}),
    ("POST", "/api/v1/exports/estimate", {"camera_id": "cam1", **AT}),
    ("GET", "/api/v1/media/live/cam1", None),
    ("POST", "/api/v1/media/streams/sync", None),
    ("GET", "/api/v1/nvr/system", None),
    ("GET", "/api/v1/nvr/notify", None),
    ("POST", "/api/v1/nvr/reboot", {"confirm": "RESTART"}),
    ("GET", "/api/v1/cameras/cam1/osd", None),
    ("POST", "/api/v1/cases/{case}/items/{item}/preserve", None),
]


def leftover_camera(app) -> None:
    from smplwise.services.autosync import DEFAULT_RECORDER, ensure_recorder

    with app.state.db.connection() as conn:
        ensure_recorder(conn)
        now = now_iso()
        conn.execute("INSERT INTO cameras(id, recorder_id, channel, name_source, sort_order, main_track, sub_track, capabilities_json, status, created_at, updated_at) "
                     "VALUES ('cam1', ?, 1, 'שער', 1, 101, 102, '{}', 'online', ?, ?)", (DEFAULT_RECORDER, now, now))


def resolve(c: TestClient, path: str) -> str:
    if "{case}" not in path:
        return path
    case = c.post("/api/v1/cases", json={"title": "t"}).json()
    item = c.post(f"/api/v1/cases/{case['id']}/items", json={"kind": "clip", "camera_id": "cam1", **AT}).json()
    return path.format(case=case["id"], item=item["id"])


@pytest.mark.parametrize("method,path,body", NVR_ROUTES, ids=[f"{m} {p}" for m, p, _ in NVR_ROUTES])
def test_nvr_routes_answer_409_nvr_not_configured(method, path, body, ha_only, monkeypatch):
    for fn in ("device_info", "discover_channels"):
        monkeypatch.setattr(nvr, fn, lambda *a, **k: pytest.fail("no NVR call in the NVR-less mode"))
    app = create_app(ha_only)
    leftover_camera(app)
    c = TestClient(app)
    c.get("/api/v1/me")  # the first request of a fresh app (bootstrap grant) is not what is measured
    path = resolve(c, path)
    t0 = time.time()
    r = c.request(method, path, json=body)
    assert r.status_code == 409, (path, r.status_code, r.text)
    j = r.json()
    assert j["code"] == "nvr_not_configured" and j["details"] == {"mode": "ha_only"} and "הגדרות › חיבורים" in j["user_message"] and "nvr_host" not in j["user_message"]
    assert time.time() - t0 < 5 * sw_time_factor(), "an immediate answer, never a device timeout (8 s per NVR call)"


def test_nvr_routes_still_authenticate_first(ha_only):
    """Hidden is not unprotected: an unidentified caller gets 401, not a statement about the installation."""
    s = dataclasses.replace(ha_only, dev_user=None)
    c = TestClient(create_app(s))
    for method, path, body in NVR_ROUTES[:4]:
        assert c.request(method, path, json=body).status_code == 401, path


@pytest.mark.parametrize("method,path,body", [r for r in NVR_ROUTES if "{case}" not in r[1]], ids=[f"{m} {p}" for m, p, _ in NVR_ROUTES if "{case}" not in p])
def test_nvr_routes_check_permissions_before_the_mode(method, path, body, ha_only):
    """The mode answer comes after each route's own permission check: a user without a role gets the same audited 403
    as in the full mode, and only an authorised caller learns that there is no NVR."""
    app = create_app(ha_only)
    leftover_camera(app)
    c = TestClient(app)
    c.get("/api/v1/me", headers=as_user("nobody"))
    r = c.request(method, path, json=body, headers=as_user("nobody"))
    assert r.status_code == 403, (path, r.status_code, r.text[:200])
    with app.state.db.connection() as conn:
        denied = conn.execute("SELECT COUNT(*) FROM audit_log WHERE decision = 'denied' AND actor_user_id = 'dev-nobody'").fetchone()[0]
    assert denied >= 1, "the refusal is audited as before"


def test_leftover_camera_events_get_no_thumbnail_queue(ha_only):
    app = create_app(ha_only)
    leftover_camera(app)
    with app.state.db.connection() as conn:
        now = now_iso()
        conn.execute("INSERT INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at) "
                     "VALUES ('ev1', 'nvr', 'VMD', 'motion', 'cam1', 1, ?, ?, 'none', 1, 'info', 'measured', '{}', 'k1', ?)", (now, now, now))
    c = TestClient(app)
    r = c.get("/api/v1/events/ev1/thumbnail")
    assert r.status_code == 404 and r.json()["code"] == "thumbnail_unavailable", "never a 202 that waits forever"
    assert thumbnails.WORKER.is_pending("ev1") is False


def test_local_reads_and_the_rest_of_the_product_keep_working(ha_only):
    c = TestClient(create_app(ha_only))
    ids = seed_tree(c)
    publish_plan(c, ids["floor2"])
    for path in ("/api/v1/cameras", "/api/v1/events", "/api/v1/exports", "/api/v1/cases", "/api/v1/storage", "/api/v1/storage/local", "/api/v1/devices/tree",
                 "/api/v1/nvr/connection", "/api/v1/backups", "/api/v1/sites", f"/api/v1/floors/{ids['floor2']}/map", "/api/v1/search?q=קומה"):
        r = c.get(path)
        assert r.status_code == 200, (path, r.status_code, r.text[:200])
    assert c.get("/api/v1/cameras").json()["cameras"] == []
    st = c.get("/api/v1/storage?fresh=true").json()  # never a report cached by another test's settings (storage._cache is process-wide)
    assert st["nvr"]["configured"] is False and st["disks"] == []


def test_permission_checks_are_unchanged_in_ha_only(ha_only):
    c = TestClient(create_app(ha_only))
    c.get("/api/v1/me", headers=as_user("admin"))  # a user without any role
    assert c.get(STATE, headers=as_user("admin")).status_code == 403
    assert c.get("/api/v1/devices/tree", headers=as_user("admin")).status_code == 403
    me = c.get("/api/v1/me", headers=as_user("admin")).json()
    assert me["has_access"] is False and me["mode"] == HA_ONLY
    bind(c, ha_only, "ron", "viewer", "installation", "*")
    assert c.get(STATE, headers=as_user("ron")).status_code == 403, "the wizard stays system.configure"


# ---------------------------------------------------------------- switching modes needs no migration

def test_adding_an_nvr_later_switches_the_mode_without_migration(ha_only, monkeypatch):
    monkeypatch.setattr(nvr, "device_info", lambda *a, **k: {"model": "fake"})
    app1 = create_app(ha_only)
    c1 = TestClient(app1)
    ids = seed_tree(c1)
    publish_plan(c1, ids["floor2"])
    with app1.state.db.connection() as conn:
        schema = conn.execute("SELECT MAX(version) FROM schema_migrations").fetchone()[0]
    assert c1.get("/api/v1/me").json()["mode"] == HA_ONLY

    full = dataclasses.replace(ha_only, nvr_host="nvr.fixture.test", nvr_user="viewer", nvr_password="pw")
    app2 = create_app(full)  # the add-on restarted with nvr_host in its options, same /data
    c2 = TestClient(app2)
    assert Database(full.db_path).migrate() == [], "no migration for a mode change"
    with app2.state.db.connection() as conn:
        assert conn.execute("SELECT MAX(version) FROM schema_migrations").fetchone()[0] == schema
    assert c2.get("/api/v1/me").json()["mode"] == FULL and c2.get("/api/v1/health").json()["mode"] == FULL
    assert [s["id"] for s in c2.get("/api/v1/sites").json()["sites"]] == [ids["site"]], "the project is untouched"
    assert step_of(c2.get(STATE).json(), "nvr")["status"] != "not_applicable"
    assert c2.post("/api/v1/cameras/sync").status_code != 409, "the NVR routes answer again"

    app3 = create_app(ha_only)  # and back again: the options lost the host
    c3 = TestClient(app3)
    assert c3.get("/api/v1/me").json()["mode"] == HA_ONLY
    assert c3.get(f"/api/v1/floors/{ids['floor2']}/map").status_code == 200
