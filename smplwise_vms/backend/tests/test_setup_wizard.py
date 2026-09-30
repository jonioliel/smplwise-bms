"""Setup wizard (T071, AT141): six steps install → NVR → HA → go2rtc → floor → camera with status, evidence, a Hebrew
explanation with the next action and a settings link; POST /setup/check/{step} probes one step on demand (read-only,
rate-limited, audited); system.configure only. The devices are the fakes in tests/fixtures/fake_devices.py: the
backend's real ISAPI / go2rtc / HA REST code runs, only the HTTP answers are fake."""
from __future__ import annotations

import dataclasses
import datetime as dt
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.db import Database, now_iso, set_setting
from smplwise.main import create_app
from smplwise.services import autosync, bridge_install, events_ingest, ha_sync
from smplwise.services import setup_wizard as wizard

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_devices import GO2RTC_HOST, HA_HOST, NVR_HOST, FakeDevices  # noqa: E402

STATE = "/api/v1/setup/state"
UTC = dt.timezone.utc
TZ = ZoneInfo("Asia/Jerusalem")


def check(c: TestClient, step: str, **kw):
    return c.post(f"/api/v1/setup/check/{step}", **kw)


def step_of(body: dict, step: str) -> dict:
    return next(s for s in body["steps"] if s["id"] == step)


@pytest.fixture()
def fake(monkeypatch) -> FakeDevices:
    f = FakeDevices()
    f.install(monkeypatch)
    return f


@pytest.fixture(autouse=True)
def clean_process_state(monkeypatch):
    """The wizard's cache and limiter, discovery / ingest / HA-sync / bridge states are process-wide: start each test
    from a known, empty picture and put everything back afterwards."""
    wizard.reset()
    monkeypatch.setattr(wizard, "CHECK_EVERY_S", 0.0)
    for k in list(autosync.STATE):
        monkeypatch.setitem(autosync.STATE, k, None)
    for k in ("connected", "last_error", "ha_version"):
        monkeypatch.setattr(ha_sync.STATE, k, False if k == "connected" else None)
    monkeypatch.setattr(ha_sync.STATE, "entities", 0)
    monkeypatch.setattr(events_ingest.STATE, "connected", True)
    for k in list(bridge_install.STATE):
        monkeypatch.setitem(bridge_install.STATE, k, None)
    yield
    wizard.reset()


def devices(settings, **extra):
    return dataclasses.replace(settings, nvr_host=NVR_HOST, nvr_user="wizard", nvr_password="fake-password", go2rtc_url=f"http://{GO2RTC_HOST}:1984",
                               ha_url=f"http://{HA_HOST}:8123", ha_token="fake-token", **extra)


def pair_bridge(settings, version: str = "0.3.0") -> None:
    with Database(settings.db_path).connection() as conn:
        set_setting(conn, "bridge.secret", "s3cret")
        set_setting(conn, "bridge.paired_at", now_iso())
        set_setting(conn, "bridge.integration_version", version)


def publish_plan(c: TestClient, floor_id: str) -> str:
    asset = c.post(f"/api/v1/floors/{floor_id}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{floor_id}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    return v["id"]


# ---------------------------------------------------------------- shape, permissions, nothing configured

def test_fresh_install_every_step_explains_itself_and_links_to_its_fix(settings):
    c = TestClient(create_app(settings))
    body = c.get(STATE).json()
    assert [s["id"] for s in body["steps"]] == ["install", "nvr", "ha", "go2rtc", "floor", "camera"]
    assert [s["index"] for s in body["steps"]] == [1, 2, 3, 4, 5, 6]
    assert body["total"] == 6 and body["ready"] is False and body["thresholds"] == {"drift_ok_s": 2, "drift_fail_s": 30}
    st = {s["id"]: s for s in body["steps"]}
    assert st["install"]["status"] == "done" and st["install"]["evidence"]["db_ok"] and st["install"]["evidence"]["data_dir_writable"]
    assert st["install"]["evidence"]["system_admins"] == 1, "the bootstrap administrator is the first system admin"
    expected = {
        "nvr": ("failed", "nvr_not_configured", "#/system/setup"),
        "ha": ("failed", "ha_not_configured", "#/system/diagnostics?tab=ha"),
        "go2rtc": ("failed", "media_not_configured", "#/system/diagnostics?tab=media"),
        "floor": ("todo", "no_building", "#/explore/sites"),
        "camera": ("skipped", "waiting_for_nvr", "#/system/setup"),
    }
    for sid, (status, code, href) in expected.items():
        s = st[sid]
        assert s["status"] == status, (sid, s["status"])
        assert s["problem"]["code"] == code and s["problem"]["link"]["href"] == href, (sid, s["problem"])
        assert s["problem"]["message"] and s["problem"]["action"] and any("֐" <= ch <= "׿" for ch in s["problem"]["action"]), "a Hebrew next action"
        assert s["settings_link"]["href"].startswith("#/")
    assert body["done"] == 1 and body["next"] == "nvr"


def test_viewer_and_site_admin_are_refused_and_the_refusal_is_audited(settings):
    c = TestClient(create_app(settings))
    ids = seed_tree(c)
    bind(c, settings, "ron", "viewer", "installation", "*")
    bind(c, settings, "dana", "site_admin", "site", ids["site"])
    for user in ("ron", "dana"):
        assert c.get(STATE, headers=as_user(user)).status_code == 403
        r = check(c, "nvr", headers=as_user(user))
        assert r.status_code == 403 and r.json()["details"]["permission"] == "system.configure"
    with Database(settings.db_path).connection() as conn:
        denied = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'system.configure' AND decision = 'denied' AND actor_username IN ('ron', 'dana')").fetchone()[0]
        assert denied == 4
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'setup.check'").fetchone()[0] == 0


def test_state_never_touches_a_device(settings, fake):
    s = devices(settings)
    c = TestClient(create_app(s))
    for _ in range(3):
        assert c.get(STATE).status_code == 200
    assert fake.hits == [], "GET /setup/state shows cached / background facts only"


def test_unknown_step_rate_limit_and_audit(settings, fake, monkeypatch):
    c = TestClient(create_app(devices(settings)))
    assert check(c, "firmware").status_code == 404
    monkeypatch.setattr(wizard, "CHECK_EVERY_S", 5.0)
    first = check(c, "nvr")
    assert first.status_code == 200 and first.json()["checked"] == "nvr"
    second = check(c, "nvr")
    assert second.status_code == 429 and second.json()["code"] == "check_rate_limited"
    assert 1 <= second.json()["details"]["retry_after_s"] <= 5 and "שניות" in second.json()["user_message"]
    assert check(c, "go2rtc").status_code == 200, "the limit is per step"
    bind(c, settings, "yael", "system_admin", "installation", "*")
    assert check(c, "nvr", headers=as_user("yael")).status_code == 200, "and per user"
    with Database(settings.db_path).connection() as conn:
        rows = conn.execute("SELECT actor_username, decision, details_json FROM audit_log WHERE action = 'setup.check' ORDER BY id").fetchall()
    assert [r["actor_username"] for r in rows] == ["joni", "joni", "yael"]
    assert all(r["decision"] == "allowed" for r in rows) and '"step": "nvr"' in rows[0]["details_json"] and '"status": "done"' in rows[0]["details_json"]
    assert fake.writes == [], "a check never writes to a device"


# ---------------------------------------------------------------- NVR

def test_nvr_down_fails_with_the_explanation_then_up_passes_with_evidence(settings, fake):
    c = TestClient(create_app(devices(settings)))
    fake.nvr["up"] = False
    body = check(c, "nvr").json()
    nvr = step_of(body, "nvr")
    assert nvr["status"] == "failed" and nvr["source"] == "live"
    assert nvr["problem"]["code"] == "source_unavailable" and nvr["problem"]["message"].startswith("ה־NVR לא ענה")
    assert "דולק" in nvr["problem"]["action"] and nvr["problem"]["link"]["href"] == "#/system/setup"
    assert step_of(body, "camera")["status"] == "skipped", "no cameras while the NVR step is not done"
    assert step_of(c.get(STATE).json(), "nvr")["status"] == "failed", "the state keeps the last live result"

    fake.nvr["up"] = True
    nvr = step_of(check(c, "nvr").json(), "nvr")
    assert nvr["status"] == "done" and nvr["problem"] is None
    ev = nvr["evidence"]
    assert ev["model"] == "DS-7616NI-FAKE" and ev["firmware"] == "V4.84.000 fake" and ev["device_type"] == "NVR"
    assert ev["channels"] == 4 and ev["online"] == 4 and ev["with_tracks"] == 4 and ev["profiles"] == ["H.265 2560x1440 25fps"]
    assert ev["time"]["level"] == "ok" and ev["time"]["dst"] == "ok" and abs(ev["time"]["drift_s"]) <= 2 and ev["time"]["zone"] == "Asia/Jerusalem"
    assert any(f["label"].startswith("דגם") and "DS-7616NI-FAKE" in f["value"] for f in nvr["facts"])
    assert fake.writes == []


def test_nvr_wrong_password_no_channels_and_capability_warnings(settings, fake):
    c = TestClient(create_app(devices(settings)))
    fake.nvr["auth"] = False
    nvr = step_of(check(c, "nvr").json(), "nvr")
    assert nvr["status"] == "failed" and nvr["problem"]["code"] == "source_forbidden" and "הסיסמה" in nvr["problem"]["message"]
    fake.nvr.update(auth=True, channels=0)
    nvr = step_of(check(c, "nvr").json(), "nvr")
    assert nvr["status"] == "failed" and nvr["problem"]["code"] == "no_channels"
    fake.nvr.update(channels=3, offline=[2], no_tracks=[3])
    nvr = step_of(check(c, "nvr").json(), "nvr")
    assert nvr["status"] == "done" and nvr["evidence"]["with_tracks"] == 2 and nvr["evidence"]["offline"] == 1
    assert {w["code"] for w in nvr["warnings"]} >= {"tracks_missing", "channels_offline"}


def test_nvr_background_state_before_any_check(settings, fake, monkeypatch):
    s = devices(settings)
    c = TestClient(create_app(s))
    nvr = step_of(c.get(STATE).json(), "nvr")
    assert nvr["status"] == "todo" and nvr["source"] == "background" and nvr["problem"]["code"] == "not_checked"
    monkeypatch.setitem(autosync.STATE, "cameras_last_error", "source_forbidden")
    nvr = step_of(c.get(STATE).json(), "nvr")
    assert nvr["status"] == "failed" and nvr["problem"]["code"] == "source_forbidden"
    monkeypatch.setitem(autosync.STATE, "cameras_last_error", None)
    monkeypatch.setitem(autosync.STATE, "cameras_last_ok", now_iso())
    nvr = step_of(c.get(STATE).json(), "nvr")
    assert nvr["status"] == "done" and nvr["source"] == "background"
    monkeypatch.setattr(events_ingest.STATE, "connected", False)
    assert "alert_stream_down" in {w["code"] for w in step_of(c.get(STATE).json(), "nvr")["warnings"]}
    assert fake.hits == []


# ---------------------------------------------------------------- time checks

@pytest.mark.parametrize("drift, level", [(0, "ok"), (2, "ok"), (-2, "ok"), (3, "warn"), (30, "warn"), (-30, "warn"), (31, "fail"), (-3600, "fail"), (None, "unknown")])
def test_drift_thresholds(drift, level):
    assert wizard.drift_level(drift) == level


def test_nvr_time_check_offset_dst_and_naive_clock():
    now = dt.datetime(2026, 9, 29, 7, 0, 0, tzinfo=UTC)  # Israel is on summer time (+03:00) on this date
    ok = wizard.nvr_time_check("2026-09-29T10:00:01+03:00", TZ, now)
    assert ok["drift_s"] == 1 and ok["level"] == "ok" and ok["dst"] == "ok" and ok["offset"] == "+03:00" and ok["expected_offset"] == "+03:00"
    # Hikvision: the WALL clock (summer time applied) tagged with the zone's STANDARD offset - a correct clock, no drift
    base_tag = wizard.nvr_time_check("2026-09-29T10:00:01+02:00", TZ, now)
    assert base_tag["drift_s"] == 1 and base_tag["level"] == "ok" and base_tag["dst"] == "ok" and base_tag["offset"] == "+02:00"
    # a wall clock that shows winter time in summer: an hour behind, and the summer-time rule is what is wrong
    wrong = wizard.nvr_time_check("2026-09-29T09:00:00+02:00", TZ, now)
    assert wrong["drift_s"] == -3600 and wrong["level"] == "fail" and wrong["dst"] == "mismatch" and wrong["offset"] == "+02:00"
    # a device kept in another zone is honoured as written
    other = wizard.nvr_time_check("2026-09-29T12:00:00+05:00", TZ, now)
    assert other["drift_s"] == 0 and other["dst"] == "mismatch"
    winter = wizard.nvr_time_check("2026-12-01T09:00:00+02:00", TZ, dt.datetime(2026, 12, 1, 7, 0, 0, tzinfo=UTC))
    assert winter["dst"] == "ok" and winter["expected_offset"] == "+02:00"
    naive = wizard.nvr_time_check("2026-09-29T10:00:40", TZ, now)
    assert naive["drift_s"] == 40 and naive["level"] == "fail" and naive["dst"] == "unknown"
    assert wizard.nvr_time_check(None, TZ, now)["level"] == "unknown"


def test_ha_time_check_reads_the_date_header():
    now = dt.datetime(2026, 9, 29, 7, 0, 0, tzinfo=UTC)
    t = wizard.ha_time_check("Tue, 29 Sep 2026 07:00:04 GMT", "Asia/Jerusalem", TZ, now)
    assert t["drift_s"] == 4 and t["level"] == "warn" and t["zone_match"] is True
    t = wizard.ha_time_check(None, "Europe/London", TZ, now)
    assert t["level"] == "unknown" and t["zone_match"] is False


def test_nvr_clock_warning_drift_failure_and_dst_failure_through_the_probe(settings, fake):
    c = TestClient(create_app(devices(settings)))
    fake.nvr["drift_s"] = 12
    nvr = step_of(check(c, "nvr").json(), "nvr")
    assert nvr["status"] == "done" and "nvr_clock_drift" in {w["code"] for w in nvr["warnings"]}
    fake.nvr["drift_s"] = -45
    nvr = step_of(check(c, "nvr").json(), "nvr")
    assert nvr["status"] == "failed" and nvr["problem"]["code"] == "nvr_clock_drift" and "-4" in nvr["problem"]["message"]
    assert "NTP" in nvr["problem"]["action"]
    fake.nvr["drift_s"] = 0
    expected = dt.datetime.now(TZ).utcoffset()
    fake.nvr["offset"] = "+02:00" if expected == dt.timedelta(hours=3) else "+03:00"
    nvr = step_of(check(c, "nvr").json(), "nvr")
    assert nvr["status"] == "failed" and nvr["problem"]["code"] == "nvr_dst_mismatch" and "שעון הקיץ" in nvr["problem"]["message"]
    fake.nvr.update(offset=None, time_error=True)
    nvr = step_of(check(c, "nvr").json(), "nvr")
    assert nvr["status"] == "done" and "nvr_clock_unknown" in {w["code"] for w in nvr["warnings"]}


# ---------------------------------------------------------------- Home Assistant

def test_ha_step_connection_bridge_restart_and_clock(settings, fake, monkeypatch):
    s = devices(settings)
    c = TestClient(create_app(s))
    ha = step_of(check(c, "ha").json(), "ha")
    assert ha["status"] == "failed" and ha["problem"]["code"] == "ha_disconnected"
    monkeypatch.setattr(ha_sync.STATE, "connected", True)
    monkeypatch.setattr(ha_sync.STATE, "entities", 42)
    ha = step_of(check(c, "ha").json(), "ha")
    assert ha["problem"]["code"] == "bridge_not_paired" and "Devices & services" in ha["problem"]["action"]
    pair_bridge(s, "0.3.0")
    monkeypatch.setitem(bridge_install.STATE, "config_dir", "/config")
    monkeypatch.setitem(bridge_install.STATE, "installed_version", "0.4.0")  # copied, HA still runs 0.3.0
    ha = step_of(check(c, "ha").json(), "ha")
    assert ha["status"] == "failed" and ha["problem"]["code"] == "ha_restart_pending" and ha["evidence"]["bridge"]["restart_pending"] is True
    assert "הפעילו מחדש את Home Assistant" in ha["problem"]["action"]
    monkeypatch.setitem(bridge_install.STATE, "installed_version", "0.3.0")
    ha = step_of(check(c, "ha").json(), "ha")
    assert ha["status"] == "done", ha["problem"]
    assert ha["evidence"]["ha_version"] == "2026.9.3" and ha["evidence"]["bridge"]["active_version"] == "0.3.0" and ha["evidence"]["entities"] == 42
    assert ha["evidence"]["time"]["level"] == "ok" and ha["evidence"]["time"]["zone_match"] is True
    fake.ha.update(drift_s=6, time_zone="Europe/London")
    ha = step_of(check(c, "ha").json(), "ha")
    assert ha["status"] == "done" and {w["code"] for w in ha["warnings"]} >= {"ha_clock_drift", "ha_zone_mismatch"}
    fake.ha["drift_s"] = 90
    ha = step_of(check(c, "ha").json(), "ha")
    assert ha["status"] == "failed" and ha["problem"]["code"] == "ha_clock_drift"
    fake.ha["up"] = False
    ha = step_of(check(c, "ha").json(), "ha")
    assert ha["status"] == "failed" and ha["problem"]["code"] == "ha_unavailable" and ha["evidence"]["reachable"] is False
    assert fake.writes == []


def test_ha_state_follows_the_bridge_after_a_check(settings, fake, monkeypatch):
    """The cached live HA result keeps its clock and version, but pairing / restart state is re-read on every GET."""
    s = devices(settings)
    c = TestClient(create_app(s))
    monkeypatch.setattr(ha_sync.STATE, "connected", True)
    assert step_of(check(c, "ha").json(), "ha")["problem"]["code"] == "bridge_not_paired"
    pair_bridge(s)
    ha = step_of(c.get(STATE).json(), "ha")
    assert ha["status"] == "done" and ha["evidence"]["time"]["level"] == "ok"


def test_nvr_and_ha_clocks_are_compared_with_each_other(settings, fake, monkeypatch):
    s = devices(settings)
    c = TestClient(create_app(s))
    monkeypatch.setattr(ha_sync.STATE, "connected", True)
    pair_bridge(s)
    fake.nvr["drift_s"] = 20
    fake.ha["drift_s"] = -1
    assert step_of(check(c, "nvr").json(), "nvr")["status"] == "done"
    ha = step_of(check(c, "ha").json(), "ha")
    assert ha["evidence"]["time"]["nvr_ha_s"] in (20, 21, 22) and "nvr_ha_drift" in {w["code"] for w in ha["warnings"]}
    # the other order (HA checked first): the gap comes from the latest results of both whenever the state is built
    wizard.reset()
    monkeypatch.setattr(wizard, "CHECK_EVERY_S", 0.0)
    assert "nvr_ha_s" not in (step_of(check(c, "ha").json(), "ha")["evidence"]["time"] or {})
    check(c, "nvr")
    assert step_of(c.get(STATE).json(), "ha")["evidence"]["time"]["nvr_ha_s"] in (20, 21, 22)


# ---------------------------------------------------------------- review round 1: privacy, deadline, limits, odd values

DOTTED_QUAD = re.compile(r"(?<![\d.])\d{1,3}(?:\.\d{1,3}){3}(?![\d.])")


def test_the_ntp_server_address_never_reaches_the_state(settings, fake):
    c = TestClient(create_app(devices(settings)))
    fake.nvr["ntp_address"] = "192.0.2.10"
    r = check(c, "nvr")
    t = step_of(r.json(), "nvr")["evidence"]["time"]
    assert t["ntp_configured"] is True and t["ntp_is_hostname"] is False and "ntp" not in t
    assert not DOTTED_QUAD.search(r.text) and not DOTTED_QUAD.search(c.get(STATE).text), "no address in the check or the state"
    fake.nvr["ntp_address"] = None
    t = step_of(check(c, "nvr").json(), "nvr")["evidence"]["time"]
    assert t["ntp_configured"] is True and t["ntp_is_hostname"] is True and "pool.ntp.org" not in c.get(STATE).text


def test_an_odd_ntp_value_is_a_warning_not_a_500(settings, fake):
    c = TestClient(create_app(devices(settings)))
    fake.nvr["ntp_port"] = "one-two-three"
    nvr = step_of(check(c, "nvr").json(), "nvr")
    assert nvr["status"] == "done" and "nvr_clock_unknown" in {w["code"] for w in nvr["warnings"]}
    assert nvr["evidence"]["time"]["error"].startswith("unparsable")


def test_a_slow_device_is_cut_off_at_the_check_deadline(settings, fake, monkeypatch):
    c = TestClient(create_app(devices(settings)))
    monkeypatch.setattr(wizard, "CHECK_DEADLINE_S", 0.5)
    fake.nvr["delay_s"] = 1.0
    t0 = time.monotonic()
    nvr = step_of(check(c, "nvr").json(), "nvr")
    assert time.monotonic() - t0 < 5, "the request does not wait for every device call"
    assert nvr["status"] == "failed" and nvr["problem"]["code"] == "check_timeout" and "לא ענה בזמן" in nvr["problem"]["message"]
    assert nvr["problem"]["action"] and nvr["problem"]["link"]["href"] == "#/system/setup"
    fake.nvr["delay_s"] = 0.0


def test_an_unexpected_error_gives_the_check_back(settings, fake, monkeypatch):
    c = TestClient(create_app(devices(settings)), raise_server_exceptions=False)
    monkeypatch.setattr(wizard, "CHECK_EVERY_S", 5.0)

    def boom(*_a, **_k):
        raise RuntimeError("unexpected")

    real = wizard.nvr_probe
    monkeypatch.setattr(wizard, "nvr_probe", boom)
    assert check(c, "nvr").status_code == 500
    monkeypatch.setattr(wizard, "nvr_probe", real)
    assert check(c, "nvr").status_code == 200, "the 500 did not use up the slot"
    assert check(c, "nvr").status_code == 429


def test_parallel_checks_get_one_slot(settings, fake, monkeypatch):
    c = TestClient(create_app(devices(settings)))
    monkeypatch.setattr(wizard, "CHECK_EVERY_S", 5.0)
    fake.nvr["delay_s"] = 0.2
    with ThreadPoolExecutor(max_workers=4) as pool:
        codes = sorted(pool.map(lambda _: check(c, "nvr").status_code, range(4)))
    assert codes == [200, 429, 429, 429]
    fake.nvr["delay_s"] = 0.0


def test_a_bridge_that_reported_no_version_is_not_pending_forever(settings, fake, monkeypatch):
    s = devices(settings)
    c = TestClient(create_app(s))
    monkeypatch.setattr(ha_sync.STATE, "connected", True)
    monkeypatch.setitem(bridge_install.STATE, "config_dir", "/config")
    monkeypatch.setitem(bridge_install.STATE, "installed_version", "0.4.0")
    pair_bridge(s, "")
    ha = step_of(check(c, "ha").json(), "ha")
    assert ha["status"] == "done" and ha["evidence"]["bridge"]["restart_pending"] is False and ha["evidence"]["bridge"]["version_unknown"] is True
    w = next(w for w in ha["warnings"] if w["code"] == "bridge_version_unknown")
    assert "התקנת הגשר" in w["message"] and w["link"]["href"] == "#/system/diagnostics?tab=ha"


def test_a_failed_stream_sync_is_dated_by_its_own_run(settings, monkeypatch):
    c = TestClient(create_app(devices(settings)))
    monkeypatch.setitem(autosync.STATE, "cameras_last_run", "2026-09-29T01:00:00Z")
    monkeypatch.setitem(autosync.STATE, "streams_last_run", "2026-09-29T01:00:05Z")
    monkeypatch.setitem(autosync.STATE, "streams_last_error", "media_unavailable")
    g = step_of(c.get(STATE).json(), "go2rtc")
    assert g["status"] == "failed" and g["source"] == "background" and g["checked_at"] == "2026-09-29T01:00:05Z"


# ---------------------------------------------------------------- go2rtc

def test_go2rtc_down_no_streams_then_synced(settings, fake):
    s = devices(settings)
    c = TestClient(create_app(s))
    fake.go2rtc["up"] = False
    g = step_of(check(c, "go2rtc").json(), "go2rtc")
    assert g["status"] == "failed" and g["problem"]["code"] == "media_unavailable" and g["problem"]["link"]["href"] == "#/system/diagnostics?tab=media"
    fake.go2rtc["up"] = True
    g = step_of(check(c, "go2rtc").json(), "go2rtc")
    assert g["status"] == "done" and "no_cameras_yet" in {w["code"] for w in g["warnings"]}
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "כניסה"}).json()
    assert cam["channel"] == 1
    g = step_of(check(c, "go2rtc").json(), "go2rtc")
    assert g["status"] == "failed" and g["problem"]["code"] == "no_streams" and "סנכרון זרמים" in g["problem"]["action"]
    fake.go2rtc["streams"] = {"smplwise_nvr-1_ch1_sub": True}
    g = step_of(check(c, "go2rtc").json(), "go2rtc")
    assert g["status"] == "done" and g["evidence"]["version"] == "1.9.9-fake" and g["evidence"]["online"] == 1
    assert g["evidence"]["foreign"] == 2 and g["evidence"]["missing"] == ["smplwise_nvr-1_ch1_main"]
    assert "streams_missing" in {w["code"] for w in g["warnings"]}
    r = check(c, "go2rtc")
    assert "intercom_door" not in r.text, "another product's stream names are counted, never listed"
    fake.go2rtc["auth"] = False
    g = step_of(check(c, "go2rtc").json(), "go2rtc")
    assert g["status"] == "failed" and g["problem"]["code"] == "media_error" and "go2rtc_api_username" in g["problem"]["action"]
    assert fake.writes == []


# ---------------------------------------------------------------- floor, camera, ready

def test_floor_and_camera_steps_then_ready_when_all_six_pass(settings, fake, monkeypatch):
    s = devices(settings)
    c = TestClient(create_app(s))
    ids = seed_tree(c)
    body = c.get(STATE).json()
    fl = step_of(body, "floor")
    assert fl["status"] == "todo" and fl["problem"]["code"] == "no_plan" and fl["problem"]["link"]["href"] == f"#/explore/floors/{ids['floor2']}/import"
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    draft = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert step_of(c.get(STATE).json(), "floor")["problem"]["code"] == "plan_not_published"
    assert c.post(f"/api/v1/plan-versions/{draft['id']}/publish").status_code == 200
    fl = step_of(c.get(STATE).json(), "floor")
    assert fl["status"] == "done" and fl["evidence"]["floors_published"] == 1 and "floors_without_plan" in {w["code"] for w in fl["warnings"]}

    # no cameras yet: the camera step waits for the NVR step
    assert step_of(c.get(STATE).json(), "camera")["status"] == "skipped"
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "כניסה"}).json()
    c.post("/api/v1/cameras", json={"channel": 2, "alias": "חניה"})
    cm = step_of(c.get(STATE).json(), "camera")
    assert cm["status"] == "todo" and cm["problem"]["code"] == "no_camera_placed" and cm["problem"]["link"]["href"] == f"#/explore/floors/{ids['floor2']}/edit"
    r = c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cam["id"], "x": 0.3, "y": 0.4, "rotation_degrees": 90, "field_of_view_degrees": 90})
    assert r.status_code == 201, r.text
    cm = step_of(c.get(STATE).json(), "camera")
    assert cm["status"] == "done" and cm["evidence"]["placed"] == 1 and "cameras_unplaced" in {w["code"] for w in cm["warnings"]}

    # all six: the devices are up, HA is connected and the bridge paired
    monkeypatch.setattr(ha_sync.STATE, "connected", True)
    pair_bridge(s)
    fake.go2rtc["streams"] = {f"smplwise_nvr-1_ch{ch}_{p}": True for ch in (1, 2) for p in ("sub", "main")}
    for sid in ("install", "nvr", "ha", "go2rtc"):
        assert step_of(check(c, sid).json(), sid)["status"] == "done", sid
    body = c.get(STATE).json()
    assert body["ready"] is True and body["done"] == 6 and body["next"] is None
    assert step_of(body, "install")["evidence"]["integrity"] is None, "the state view does not run quick_check"
    assert step_of(check(c, "install").json(), "install")["evidence"]["integrity"] == "ok"
    assert fake.writes == []
