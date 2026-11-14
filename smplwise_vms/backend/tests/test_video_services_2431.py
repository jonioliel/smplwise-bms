"""HEALTH-GO2RTC-FOLLOWUP-2431 (owner answers 11.11): the administrators' "video service unavailable" notice waits an administrator-chosen
delay (15 minutes by default); Arx lists the go2rtc add-ons that run next to it (Supervisor, read only) and the administrator chooses one -
the choice takes precedence over the add-on option go2rtc_url, at once for requests and at every start."""
from __future__ import annotations

from dataclasses import replace

import httpx
import pytest
from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient
from notify_src_world import World, clock, fake_push  # noqa: F401 - fixtures

from smplwise.db import Database, get_setting, set_setting
from smplwise.main import create_app
from smplwise.remote_channel import BLOCKED_ON_REMOTE
from smplwise.services import backup, notify_sources, self_update
from smplwise.services import video_services as vs

OPTION_URL = "http://option-go2rtc.invalid:1984"
API = "/api/v1/system/video-services"

ADDONS = [
    {"slug": "a889bffc_go2rtc", "name": "go2rtc", "state": "started", "version": "1.9.9"},
    {"slug": "core_ssh", "name": "Terminal & SSH", "state": "started", "version": "9.0"},
    {"slug": "b1c2d3e4_go2rtc_door", "name": "go2rtc (door stations)", "state": "stopped", "version": "1.9.4"},
    {"slug": "c0ffee00_media", "name": "Media relay", "state": "started", "version": "2.0"},  # no go2rtc in slug / name: not listed
]
INFO = {
    "a889bffc_go2rtc": {"name": "go2rtc", "slug": "a889bffc_go2rtc", "hostname": "a889bffc-go2rtc", "state": "started", "version": "1.9.9",
                        "image": "ghcr.io/alexxit/go2rtc-amd64"},
    "b1c2d3e4_go2rtc_door": {"name": "go2rtc (door stations)", "slug": "b1c2d3e4_go2rtc_door", "hostname": "b1c2d3e4-go2rtc-door",
                             "state": "stopped", "version": "1.9.4", "image": "local/go2rtc"},
}


class FakeSupervisor:
    def __init__(self) -> None:
        self.paths: list[tuple[str, str]] = []
        self.forbid = False

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.paths.append((request.method, request.url.path))
        assert request.headers.get("authorization") == "Bearer test-token"
        if self.forbid:
            return httpx.Response(403, json={"result": "error"})
        if request.method == "GET" and request.url.path == "/addons":
            return httpx.Response(200, json={"result": "ok", "data": {"addons": ADDONS}})
        parts = request.url.path.strip("/").split("/")
        if request.method == "GET" and len(parts) == 3 and parts[0] == "addons" and parts[2] == "info" and parts[1] in INFO:
            return httpx.Response(200, json={"result": "ok", "data": INFO[parts[1]]})
        return httpx.Response(404, json={"result": "error"})


@pytest.fixture()
def sup(monkeypatch) -> FakeSupervisor:
    f = FakeSupervisor()
    monkeypatch.setattr(self_update, "BASE_URL", "http://supervisor")
    monkeypatch.setattr(self_update, "TOKEN", "test-token")
    monkeypatch.setattr(self_update, "TRANSPORT", httpx.MockTransport(f.handler))
    probed: list[str] = []

    def probe(url: str):
        probed.append(url)
        return ("ok", "1.9.9") if "a889bffc" in url else ("unreachable", None)

    monkeypatch.setattr(vs, "PROBE", probe)
    f.probed = probed  # type: ignore[attr-defined]
    return f


@pytest.fixture()
def osettings(settings):
    return replace(settings, go2rtc_url=OPTION_URL)


# ---------------------------------------------------------------- discovery

def test_discovery_lists_only_go2rtc_addons_with_state_version_address_and_probe(osettings, sup):
    found = vs.discover(osettings)
    assert found["supported"] is True and found["reason"] is None
    by = {c["slug"]: c for c in found["candidates"]}
    assert set(by) == {"a889bffc_go2rtc", "b1c2d3e4_go2rtc_door"}
    a, b = by["a889bffc_go2rtc"], by["b1c2d3e4_go2rtc_door"]
    assert a["state"] == "started" and a["version"] == "1.9.9" and a["address"] == "a889bffc-go2rtc:1984" and a["probe"] == "ok"
    assert a["go2rtc_version"] == "1.9.9" and a["image_go2rtc"] is True
    assert b["state"] == "stopped" and b["probe"] == "not_probed", "a stopped add-on is not probed"
    assert sup.probed == ["http://a889bffc-go2rtc:1984"]
    assert ("GET", "/addons/core_ssh/info") not in sup.paths and ("GET", "/addons/c0ffee00_media/info") not in sup.paths
    assert all(m == "GET" for m, _ in sup.paths), "discovery only reads"


def test_discovery_is_cached_and_fresh_is_rate_limited(osettings, sup):
    vs.discover(osettings)
    n = len(sup.paths)
    vs.discover(osettings)
    assert len(sup.paths) == n, "cached"
    vs.discover(osettings, fresh=True)
    m = len(sup.paths)
    assert m > n
    vs.discover(osettings, fresh=True)
    assert len(sup.paths) == m, "a second fresh discovery within FRESH_MIN_GAP_S answers from the cache"


def test_the_addon_info_door_reads_only_listed_go2rtc_addons(osettings, sup):
    with pytest.raises(self_update.ProbeRefused):
        self_update.check_allowed("GET", self_update.P_ADDON_INFO, addon="a889bffc_go2rtc")  # not listed yet
    vs.discover(osettings)
    assert self_update.check_allowed("GET", self_update.P_ADDON_INFO, addon="a889bffc_go2rtc") == "/addons/a889bffc_go2rtc/info"
    for bad in ("core_ssh", "../core", "A889", "", None):
        with pytest.raises(self_update.ProbeRefused):
            self_update.check_allowed("GET", self_update.P_ADDON_INFO, addon=bad)
    with pytest.raises(self_update.ProbeRefused):
        self_update.check_allowed("POST", self_update.P_ADDON_INFO, addon="a889bffc_go2rtc")
    with pytest.raises(self_update.ProbeRefused):
        self_update.check_allowed("GET", self_update.P_ADDONS, addon="a889bffc_go2rtc")


def test_outside_the_addon_discovery_says_unsupported(osettings):
    found = vs.discover(osettings)
    assert found == {"supported": False, "reason": "no_supervisor", "candidates": [], "checked_at": found["checked_at"]}


def test_a_refused_listing_says_forbidden(osettings, sup):
    sup.forbid = True
    assert vs.discover(osettings)["reason"] == "forbidden"


def test_hostname_rule_and_url_shape():
    assert vs.hostname_of("a1_go2rtc", {}) == "a1-go2rtc"
    assert vs.hostname_of("a1_go2rtc", {"hostname": "x.example.com"}) == "a1-go2rtc", "a dotted name is never used"
    assert vs.hostname_of("a1_go2rtc", {"hostname": "192.0.2.17"}) == "a1-go2rtc"
    assert vs.display_address("http://user:secret@host.invalid:1984/path") == "host.invalid:1984"
    assert vs.URL_RE.fullmatch("http://a889bffc-go2rtc:1984") and not vs.URL_RE.fullmatch("http://192.0.2.17:1984")


# ---------------------------------------------------------------- the API

def test_list_is_for_administrators_only(osettings, sup):
    c = TestClient(create_app(osettings))
    ids = seed_tree(c)
    bind(c, osettings, "ron", "viewer", "floor", ids["floor2"])
    assert c.get(API, headers=as_user("ron")).status_code == 403
    body = c.get(API).json()
    assert body["supported"] is True and body["current"]["source"] == "option" and body["current"]["address"] == "option-go2rtc.invalid:1984"
    assert body["selection"] is None and {x["slug"] for x in body["candidates"]} == {"a889bffc_go2rtc", "b1c2d3e4_go2rtc_door"}
    assert all("url" not in x for x in body["candidates"]) and not any(x["current"] for x in body["candidates"])
    assert c.put(f"{API}/selection", json={"slug": "a889bffc_go2rtc"}, headers=as_user("ron")).status_code == 403
    assert c.delete(f"{API}/selection", headers=as_user("ron")).status_code == 403


def test_select_applies_at_once_is_audited_and_wins_over_the_option_after_a_restart(osettings, sup):
    app = create_app(osettings)
    c = TestClient(app)
    r = c.put(f"{API}/selection", json={"slug": "a889bffc_go2rtc"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["current"]["source"] == "selection" and body["current"]["slug"] == "a889bffc_go2rtc" and body["restart_recommended"] is True
    assert body["selection"]["slug"] == "a889bffc_go2rtc" and body["selection"]["address"] == "a889bffc-go2rtc:1984"
    assert app.state.settings.go2rtc_url == "http://a889bffc-go2rtc:1984", "requests use the chosen service at once"
    with app.state.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT action, details_json FROM audit_log WHERE action LIKE 'media.video_service.%'").fetchall()
    assert [x["action"] for x in rows] == ["media.video_service.select"] and "1984" not in rows[0]["details_json"]
    # the next start: the stored choice takes precedence over the add-on option
    app2 = create_app(osettings)
    assert app2.state.settings.go2rtc_url == "http://a889bffc-go2rtc:1984" and app2.state.go2rtc_option_url == OPTION_URL
    # back to the add-on option
    r2 = TestClient(app2).delete(f"{API}/selection")
    assert r2.status_code == 200 and r2.json()["current"]["source"] == "option" and r2.json()["selection"] is None
    assert app2.state.settings.go2rtc_url == OPTION_URL
    assert create_app(osettings).state.settings.go2rtc_url == OPTION_URL


def test_select_refuses_an_unknown_slug_a_typed_address_and_no_supervisor(osettings, sup, monkeypatch):
    c = TestClient(create_app(osettings))
    assert c.put(f"{API}/selection", json={"slug": "core_ssh"}).status_code == 404
    assert c.put(f"{API}/selection", json={"slug": "a889bffc_go2rtc", "url": "http://evil:1984"}).status_code == 422
    assert c.put(f"{API}/selection", json={"slug": "http://x"}).status_code == 422
    monkeypatch.setattr(self_update, "TOKEN", None)
    monkeypatch.delenv("SUPERVISOR_TOKEN", raising=False)
    assert c.put(f"{API}/selection", json={"slug": "a889bffc_go2rtc"}).json()["code"] == "video_services_unsupported"


def test_a_corrupt_stored_choice_leaves_the_option_in_force(osettings):
    app = create_app(osettings)
    with app.state.db.connection() as conn:
        set_setting(conn, vs.K_SELECTION, '{"slug": "x_go2rtc", "url": "http://192.0.2.18:1984"}')
    assert create_app(osettings).state.settings.go2rtc_url == OPTION_URL


def test_the_choice_is_local_only_and_never_in_a_project_backup():
    assert "/api/v1/system/video-services" in BLOCKED_ON_REMOTE
    assert "media.video_service_selection" in backup.SETTINGS_KEEP


# ---------------------------------------------------------------- the notice delay (owner 11.11, answer 1)

def test_the_notice_delay_setting_defaults_to_15_and_takes_only_the_offered_values(osettings):
    c = TestClient(create_app(osettings))
    assert c.get("/api/v1/settings").json()["settings"]["media.video_notice_after_min"] == 15
    for ok in (1, 5, 15, 30, 60):
        assert c.patch("/api/v1/settings", json={"media.video_notice_after_min": ok}).status_code == 200
        assert c.get("/api/v1/settings").json()["settings"]["media.video_notice_after_min"] == ok
    for bad in (0, 7, 120, "15"):
        assert c.patch("/api/v1/settings", json={"media.video_notice_after_min": bad}).status_code == 422


@pytest.fixture()
def w(settings, clock) -> World:  # noqa: F811
    return World(settings, clock)


def _run(w, clock, on: bool):  # noqa: F811
    summary = {"status": "error" if on else "ok", "items": [{"id": "video_service", "status": "error", "label": "x"}] if on else []}
    with w.db.connection() as conn:
        return notify_sources.health_tick(conn, summary, {"known": True, "none": False, "age_s": 3600.0}, clock.now)


def test_the_notice_waits_the_administrators_delay(w, clock):  # noqa: F811
    with w.db.connection() as conn:
        set_setting(conn, vs.K_NOTICE_AFTER, "5")
        assert vs.notice_after_min(conn) == 5
    _run(w, clock, True)
    clock.advance(seconds=290)
    _run(w, clock, True)
    assert w.rows("system.health") == []
    clock.advance(seconds=20)
    _run(w, clock, True)
    assert [r["subject_id"] for r in w.rows("system.health")] == ["video_service"]


def test_a_corrupt_delay_reads_as_15_minutes(w):
    with w.db.connection() as conn:
        set_setting(conn, vs.K_NOTICE_AFTER, "7")
        assert vs.notice_after_min(conn) == 15
        set_setting(conn, vs.K_NOTICE_AFTER, "x")
        assert vs.notice_after_min(conn) == 15


def test_the_notice_lists_the_video_services_found(w, clock, osettings, sup):  # noqa: F811
    vs.discover(osettings)
    with w.db.connection() as conn:
        set_setting(conn, vs.K_NOTICE_AFTER, "1")
    _run(w, clock, True)
    clock.advance(seconds=61)
    _run(w, clock, True)
    body = w.rows("system.health")[0]["body"]
    assert "שירות הווידאו לא זמין" in body and "go2rtc (פועל)" in body and "go2rtc (door stations) (כבוי)" in body
    assert "1984" not in body and "Terminal" not in body
