"""Installation capabilities (NN1 P1, docs/architecture/CAPABILITIES.md): the binary installation mode generalised into a
derived capability set on /me, /health, /health/report and /setup/state - no migration, no stored flag, no new permission.

Four installations x Home Assistant (none / configured but down / connected):
  A  no NVR, no go2rtc      (the NVR-less mode, as shipped 2026-09-29)
  B  no NVR, go2rtc         (WisKey station video, opted-in Home Assistant cameras)
  C  NVR, no go2rtc         NOT a supported installation (owner decision 2026-10-03): no live video, no playback, the
                            wizard never reaches "ready" and says why in operator language
  D  NVR and go2rtc         (full)
Capabilities follow what is configured, never what is reachable (a down go2rtc or HA is a health fact, so the navigation
never flickers). Devices are the reserved `.test` fakes of tests/fixtures/fake_devices.py - nothing real is contacted."""
from __future__ import annotations

import dataclasses
import sys
import time
from pathlib import Path

import pytest
from conftest import as_user, bind, sw_time_factor
from fastapi.testclient import TestClient

from smplwise import capabilities as capmod
from smplwise.db import now_iso
from smplwise.main import create_app
from smplwise.mode import FULL, HA_ONLY, installation_mode
from smplwise.services import autosync, bridge_install, ha_sync
from smplwise.services import setup_wizard as wizard

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_devices import GO2RTC_HOST, HA_HOST, NVR_HOST, FakeDevices  # noqa: E402

STATE = "/api/v1/setup/state"
COMBOS = ("A", "B", "C", "D")
HA_STATES = ("none", "down", "up")
FLAGS = capmod.CAPABILITY_NAMES


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


@pytest.fixture()
def fake(monkeypatch):
    f = FakeDevices()
    f.install(monkeypatch)
    return f


def combo_settings(settings, combo: str, ha: str, monkeypatch=None, **extra):
    has_nvr = combo in ("C", "D")
    has_go2rtc = combo in ("B", "D")
    s = dataclasses.replace(
        settings,
        nvr_host=NVR_HOST if has_nvr else None, nvr_user="viewer" if has_nvr else None, nvr_password="pw" if has_nvr else None,
        go2rtc_url=f"http://{GO2RTC_HOST}:1984" if has_go2rtc else None,
        ha_url=f"http://{HA_HOST}:8123" if ha != "none" else None, ha_token="fake-token" if ha != "none" else None,
        data_dir=settings.data_dir.parent / f"{combo}-{ha}", **extra)
    if monkeypatch is not None:
        monkeypatch.setattr(ha_sync.STATE, "connected", ha == "up")
    return s


def expected_flags(combo: str, ha: str) -> dict[str, bool]:
    nvr, go, h = combo in ("C", "D"), combo in ("B", "D"), ha != "none"
    return {"nvr": nvr, "go2rtc": go, "ha": h, "live_video": go and (nvr or h), "playback": go and nvr, "events_recorder": nvr,
            "events_ha": h, "ha_cameras_still": h, "ha_cameras_live": go and h}


def leftover_camera(app) -> None:
    from smplwise.services.autosync import DEFAULT_RECORDER, ensure_recorder

    with app.state.db.connection() as conn:
        ensure_recorder(conn)
        now = now_iso()
        conn.execute("INSERT INTO cameras(id, recorder_id, channel, name_source, sort_order, main_track, sub_track, capabilities_json, status, created_at, updated_at) "
                     "VALUES ('cam1', ?, 1, 'שער', 1, 101, 102, '{}', 'online', ?, ?)", (DEFAULT_RECORDER, now, now))


# ---------------------------------------------------------------- the pure derivation

@pytest.mark.parametrize("ha", HA_STATES)
@pytest.mark.parametrize("combo", COMBOS)
def test_resolve_matrix(combo, ha, settings):
    caps = capmod.resolve(combo_settings(settings, combo, ha))
    assert caps.flags() == expected_flags(combo, ha)
    assert caps.supported is (combo != "C")
    assert caps.unsupported_reason == ("nvr_without_go2rtc" if combo == "C" else None)
    assert [r.id for r in caps.recorders] == (["nvr-1"] if combo in ("C", "D") else [])
    if caps.recorders:
        r = caps.recorders[0]
        assert (r.vendor, r.live, r.playback, r.events) == ("hikvision", True, True, True)


def test_wiskey_alone_is_a_live_source(settings):
    s = dataclasses.replace(combo_settings(settings, "B", "none"), wiskey_user="door")
    assert capmod.resolve(s).live_video is True
    assert capmod.resolve(combo_settings(settings, "B", "none")).live_video is False, "go2rtc without any source: nothing to watch"


def test_mode_is_a_thin_wrapper_over_the_nvr_capability(settings):
    for combo in COMBOS:
        s = combo_settings(settings, combo, "none")
        assert installation_mode(s) == (FULL if capmod.resolve(s).nvr else HA_ONLY)
    assert capmod.nvr_host(dataclasses.replace(settings, nvr_host="   ")) is None, "a blank host is no host"
    assert capmod.go2rtc_url(dataclasses.replace(settings, go2rtc_url=" ")) is None


def test_the_dev_placeholder_host_counts_as_an_nvr(settings):
    """conftest / developer launches: full mode with the placeholder host and no go2rtc = combination C."""
    caps = capmod.resolve(settings)
    assert caps.nvr is True and caps.go2rtc is False and caps.supported is False


def test_ensure_capability_raises_a_stable_409(settings):
    with pytest.raises(Exception) as exc:
        capmod.ensure_capability(combo_settings(settings, "C", "none"), "playback")
    err = exc.value
    assert err.status == 409 and err.code == "capability_unavailable"
    assert err.details == {"capability": "playback", "reason": "media_not_configured"}
    capmod.ensure_capability(combo_settings(settings, "D", "none"), "playback")
    with pytest.raises(ValueError):
        capmod.ensure_capability(settings, "teleport")


# ---------------------------------------------------------------- /me, /health, /health/report, /setup/state

@pytest.mark.parametrize("ha", HA_STATES)
@pytest.mark.parametrize("combo", COMBOS)
def test_me_reports_the_capabilities(combo, ha, settings, monkeypatch, fake):
    c = TestClient(create_app(combo_settings(settings, combo, ha, monkeypatch)))
    me = c.get("/api/v1/me").json()
    caps = me["capabilities"]
    assert {k: caps[k] for k in FLAGS} == expected_flags(combo, ha)
    assert caps["supported"] is (combo != "C") and caps["unsupported_reason"] == ("nvr_without_go2rtc" if combo == "C" else None)
    assert me["mode"] == (FULL if combo in ("C", "D") else HA_ONLY), "the old field stays for the shell of today"
    assert [r["id"] for r in caps["recorders"]] == (["nvr-1"] if combo in ("C", "D") else []), "the system administrator sees the recorders"
    blob = repr(caps)
    assert NVR_HOST not in blob and GO2RTC_HOST not in blob and "viewer" not in blob, "no host or credential in the capability block"


def test_capabilities_follow_configuration_not_reachability(settings, monkeypatch, fake):
    """A down go2rtc or a disconnected HA is a health fact, never a capability change (no navigation flicker)."""
    s = combo_settings(settings, "D", "up", monkeypatch)
    c = TestClient(create_app(s))
    before = c.get("/api/v1/me").json()["capabilities"]
    fake.go2rtc["up"] = False
    fake.nvr["up"] = False
    monkeypatch.setattr(ha_sync.STATE, "connected", False)
    assert c.get("/api/v1/me").json()["capabilities"] == before


def test_recorder_detail_needs_nvr_or_system_permissions(settings, monkeypatch, fake):
    s = combo_settings(settings, "D", "none", monkeypatch)
    app = create_app(s)
    c = TestClient(app)
    c.get("/api/v1/me")
    nobody = c.get("/api/v1/me", headers=as_user("nobody")).json()
    assert "recorders" not in nobody["capabilities"] and nobody["capabilities"]["nvr"] is True, "booleans for everyone, detail for few"
    bind(c, s, "ron", "viewer", "installation", "*")
    ron = c.get("/api/v1/me", headers=as_user("ron")).json()
    assert ron["has_access"] is True and "recorders" not in ron["capabilities"]
    ron_health = c.get("/api/v1/health", headers=as_user("ron")).json()
    assert "recorders" not in ron_health["capabilities"]
    assert ron_health["recorders"] == [], "security review L2: per-recorder state (error codes) only for who may see recorders"
    admin_health = c.get("/api/v1/health").json()
    assert admin_health["capabilities"]["recorders"][0]["vendor"] == "hikvision"
    assert [r["id"] for r in admin_health["recorders"]] == ["nvr-1"]


@pytest.mark.parametrize("ha", ("none", "up"))
@pytest.mark.parametrize("combo", COMBOS)
def test_health_and_report_carry_capabilities_and_the_installation_verdict(combo, ha, settings, monkeypatch, fake):
    c = TestClient(create_app(combo_settings(settings, combo, ha, monkeypatch)))
    h = c.get("/api/v1/health").json()
    assert {k: h["capabilities"][k] for k in FLAGS} == expected_flags(combo, ha)
    assert h["installation"]["supported"] is (combo != "C")
    rep = c.get("/api/v1/health/report?fresh=1").json()
    assert {k: rep["capabilities"][k] for k in FLAGS} == expected_flags(combo, ha)
    assert rep["installation"] == h["installation"]
    go = next(x for x in rep["checks"] if x["id"] == "go2rtc")
    if combo == "A":
        assert go["status"] == "off"
    elif combo == "C":
        assert go["status"] == "error" and go["meta"].get("required") is True, go
        assert "אינה נתמכת" in go["detail"] and "Home Assistant" not in go["detail"]
    else:
        assert go["status"] == "ok", go
    summary = c.get("/api/v1/health/summary").json()
    items = {i["id"]: i for i in summary["items"]}
    if combo == "C":
        assert items["go2rtc"]["status"] == "error" and summary["status"] == "error"
        assert "Home Assistant" not in items["go2rtc"]["label"] and "Add-on" not in items["go2rtc"]["label"]
    else:
        assert "go2rtc" not in items or items["go2rtc"]["status"] != "error"


def test_unconfigured_placeholder_keeps_the_fresh_install_wording(settings):
    """Developer / fresh install (placeholder host, no credentials): unsupported is reported, but the health picture keeps
    its "not configured yet" warnings - the error appears once the NVR is really connected."""
    c = TestClient(create_app(settings))
    rep = c.get("/api/v1/health/report?fresh=1").json()  # the probe cache is process-wide
    go = next(x for x in rep["checks"] if x["id"] == "go2rtc")
    assert go["status"] == "warn" and go["meta"]["configured"] is False
    assert rep["installation"]["supported"] is False
    assert "go2rtc" not in {i["id"] for i in c.get("/api/v1/health/summary").json()["items"]}


@pytest.mark.parametrize("combo", COMBOS)
def test_setup_state_reports_capabilities_and_the_verdict(combo, settings, monkeypatch, fake):
    c = TestClient(create_app(combo_settings(settings, combo, "up", monkeypatch)))
    body = c.get(STATE).json()
    assert {k: body["capabilities"][k] for k in FLAGS} == expected_flags(combo, "up")
    inst = body["installation"]
    assert inst["supported"] is (combo != "C")
    go = next(s for s in body["steps"] if s["id"] == "go2rtc")
    if combo == "C":
        assert inst["reason"] == "nvr_without_go2rtc" and body["ready"] is False
        assert go["status"] == "failed" and go["problem"]["code"] == "media_not_configured"
        text = " ".join([inst["message"], inst["action"], go["problem"]["message"], go["problem"]["action"]])
        assert "אינה נתמכת" in go["problem"]["message"]
        for word in ("Home Assistant", "Add-on", "Supervisor", "Configuration"):
            assert word not in text, word
    else:
        assert inst["reason"] is None and inst["message"] is None


def test_unsupported_installation_never_reaches_ready(settings, monkeypatch, fake):
    """Even if every step read "done" (a stale cache, a future step change), an NVR without go2rtc is not ready."""
    s = combo_settings(settings, "C", "up", monkeypatch)
    app = create_app(s)
    done = {"status": "done", "summary": "ok", "facts": [], "evidence": {}, "warnings": []}
    monkeypatch.setattr(wizard, "floor_step", lambda conn: {**done, "id": "floor"})
    monkeypatch.setattr(wizard, "camera_step", lambda conn, st: {**done, "id": "camera"})
    for sid in wizard.DEVICE_STEPS:
        monkeypatch.setitem(wizard.BACKGROUND, sid, lambda st, conn, sid=sid: {**done, "id": sid})
    monkeypatch.setattr(wizard, "install_step", lambda *a, **k: {**done, "id": "install"})
    with app.state.db.connection() as conn:
        body = wizard.build_state(s, conn, "dev")
    assert body["done"] == body["total"] and body["ready"] is False and body["installation"]["supported"] is False


# ---------------------------------------------------------------- route sweep: 2xx / 403 / 409, never 5xx, under 2 s

AT = {"from_at": "2026-09-29T10:00:00Z", "to_at": "2026-09-29T10:00:30Z"}
# (method, path, body, needs) - `needs` lists the capabilities in the order the route checks them
ROUTES = [
    ("GET", "/api/v1/me", None, ()),
    ("GET", "/api/v1/health", None, ()),
    ("GET", "/api/v1/health/summary", None, ()),
    ("GET", "/api/v1/health/report", None, ()),
    ("GET", STATE, None, ()),
    ("GET", "/api/v1/cameras", None, ()),
    ("GET", "/api/v1/events", None, ()),
    ("GET", "/api/v1/exports", None, ()),
    ("GET", "/api/v1/cases", None, ()),
    ("GET", "/api/v1/storage/local", None, ()),
    ("GET", "/api/v1/devices/tree", None, ()),
    ("GET", "/api/v1/nvr/connection", None, ()),
    ("GET", "/api/v1/media/streams", None, ("go2rtc",)),  # was a 503 media_not_configured without go2rtc (found by this sweep)
    ("GET", "/api/v1/media/sessions", None, ()),
    ("GET", "/api/v1/playback/sessions", None, ()),
    ("GET", "/api/v1/media/live/cam1", None, ("nvr",)),
    ("POST", "/api/v1/media/streams/sync", None, ("nvr", "live_video")),  # was a 503 media_not_configured without go2rtc
    ("POST", "/api/v1/playback/sessions", {"camera_id": "cam1", "start_at": "2026-09-29T10:00:00Z"}, ("nvr", "playback")),  # was 503
    ("POST", "/api/v1/playback/groups", {"camera_ids": ["cam1"], "start_at": "2026-09-29T10:00:00Z"}, ("nvr", "playback")),  # was 503
    ("POST", "/api/v1/exports/estimate", {"camera_id": "cam1", **AT}, ("nvr",)),
    ("POST", "/api/v1/cameras/sync", None, ("nvr",)),  # last: it adds the fake NVR's cameras (more streams to sync above)
]


def _expect(combo: str, needs: tuple[str, ...]) -> str | None:
    """The 409 code the route must answer in this installation, or None (served: 2xx or an ordinary 4xx)."""
    flags = expected_flags(combo, "up")
    for need in needs:
        if not flags[need]:
            return "nvr_not_configured" if need == "nvr" else "capability_unavailable"
    return None


@pytest.mark.parametrize("combo", COMBOS)
def test_route_sweep(combo, settings, monkeypatch, fake):
    app = create_app(combo_settings(settings, combo, "up", monkeypatch))
    leftover_camera(app)
    c = TestClient(app)
    c.get("/api/v1/me")  # the first request of a fresh app (bootstrap grant) is not what is measured
    for method, path, body, needs in ROUTES:
        t0 = time.time()
        r = c.request(method, path, json=body)
        took = time.time() - t0
        assert r.status_code < 500, (combo, method, path, r.status_code, r.text[:300])
        code = _expect(combo, needs)
        # every answer the installation decides (a 409, a local read) is immediate; a route that really talks to the fake
        # devices pays httpx's client set-up per call (measured ~0.5 s each on the Windows workstation), so it only has to
        # stay far from a device timeout (8 s per NVR call)
        device_bound = not code and any(n in ("nvr", "live_video", "playback", "go2rtc") for n in needs)
        assert took < (8 if device_bound else 2) * sw_time_factor(), (combo, path, took)
        if code:
            assert r.status_code == 409 and r.json()["code"] == code, (combo, path, r.status_code, r.text[:300])
            if code == "capability_unavailable":
                missing = next(n for n in needs if not expected_flags(combo, "up")[n])
                assert r.json()["details"]["capability"] == missing
        else:
            assert r.status_code != 409 or r.json()["code"] not in ("nvr_not_configured", "capability_unavailable"), (combo, path, r.text[:300])
            assert r.status_code in (200, 201, 202, 204, 404, 409, 422, 429), (combo, path, r.status_code, r.text[:300])


GATED = [(m, p, b) for m, p, b, needs in ROUTES if {"playback", "live_video", "go2rtc"} & set(needs)]


@pytest.mark.parametrize("method,path,body", GATED, ids=[f"{m} {p}" for m, p, _ in GATED])
def test_capability_routes_authenticate_and_authorise_before_409(method, path, body, settings, monkeypatch, fake):
    """Hidden is not unprotected: 401 for an unidentified caller, an audited 403 for one without the permission - only
    an authorised caller learns that the installation lacks the capability."""
    anon = TestClient(create_app(dataclasses.replace(combo_settings(settings, "C", "none"), dev_user=None)))
    assert anon.request(method, path, json=body).status_code == 401
    app = create_app(combo_settings(settings, "C", "none", monkeypatch))
    leftover_camera(app)
    c = TestClient(app)
    c.get("/api/v1/me", headers=as_user("nobody"))
    r = c.request(method, path, json=body, headers=as_user("nobody"))
    assert r.status_code == 403, (path, r.status_code, r.text[:200])
    with app.state.db.connection() as conn:
        denied = conn.execute("SELECT COUNT(*) FROM audit_log WHERE decision = 'denied' AND actor_user_id = 'dev-nobody'").fetchone()[0]
    assert denied >= 1
    r2 = c.request(method, path, json=body)  # the system administrator
    assert r2.status_code == 409 and r2.json()["code"] == "capability_unavailable"
