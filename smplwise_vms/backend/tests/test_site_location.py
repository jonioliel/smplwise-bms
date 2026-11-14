"""CR-029 S2, owner decision 2026-10-11: the sun of the realistic 3D stands where the home is - the latitude, longitude,
elevation and time zone of Home Assistant's core config, read by the HA sync session's own `get_config` (no new access
path), kept as the last known value, refreshed rarely. A typed latitude / longitude is only an explicit override
(`site.location_source` = manual). Read-only in GET /plan-view/prefs as `location` with `source` = ha | manual | default.

The real HaSync session runs against the fake Home Assistant of test_ha_structure_refresh (no device, no network)."""
from __future__ import annotations

import asyncio
import json
import re
from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.routers.settings import DEFAULTS
from smplwise.services import backup as backup_svc
from smplwise.services import ha_sync
from smplwise.services import site_location as sl
from test_ha_structure_refresh import REFUSED, FakeHa, _ok, run_session

TOKEN = "secret-token-value"
# a core config as Home Assistant answers it, with everything the location must NOT carry along
HOME_CONFIG = {"version": "2026.10.0", "latitude": 31.776543, "longitude": 35.234567, "elevation": 754.4, "time_zone": "Asia/Jerusalem",
               "location_name": "Private Home Name", "internal_url": "http://homeassistant.internal:8123", "external_url": "https://home.example.invalid",
               "config_dir": "/config", "country": "IL", "unit_system": {"length": "km"}}


class LocatedHa(FakeHa):
    """The fake Home Assistant with a core config that has a location (or a refused / position-less one)."""

    def __init__(self, config: dict[str, Any] | None) -> None:
        super().__init__()
        self.config = config

    async def call(self, msg_type: str, **kw: Any) -> dict[str, Any]:
        if msg_type == "get_config":
            self.calls.append(msg_type)
            return _ok(dict(self.config)) if self.config is not None else REFUSED
        return await super().call(msg_type, **kw)


@pytest.fixture()
def app_ha(settings, monkeypatch):
    monkeypatch.setattr(ha_sync, "REGISTRY_DEBOUNCE_S", 0.05)
    monkeypatch.setattr(ha_sync, "REGISTRY_MAX_WAIT_S", 0.3)
    s = replace(settings, ha_url="http://ha.local:8123", ha_token=TOKEN)
    app = create_app(s)
    yield app, s
    ha_sync.STATE.connected = False


async def _idle(_on_event, _on_message, _settle) -> None:
    return None


def location(c: TestClient, **kw: Any) -> dict[str, Any]:
    r = c.get("/api/v1/plan-view/prefs", **kw)
    assert r.status_code == 200, r.text
    return r.json()["location"]


# ------------------------------------------------------------------ parsing


@pytest.mark.parametrize(("cfg", "out"), [
    (HOME_CONFIG, {"latitude": 31.776543, "longitude": 35.234567, "elevation_m": 754, "time_zone": "Asia/Jerusalem"}),
    ({"latitude": -33.8688, "longitude": 151.2093, "time_zone": "Australia/Sydney"}, {"latitude": -33.8688, "longitude": 151.2093, "elevation_m": None, "time_zone": "Australia/Sydney"}),
    ({"latitude": 40.0, "longitude": -105.27, "elevation": 1655, "time_zone": "Not/AZone"}, {"latitude": 40.0, "longitude": -105.27, "elevation_m": 1655, "time_zone": None}),
    ({"latitude": 51.5, "longitude": 0.0, "elevation": True, "time_zone": "../../etc/passwd"}, {"latitude": 51.5, "longitude": 0.0, "elevation_m": None, "time_zone": None}),
])
def test_the_core_config_location_is_validated_and_kept_exact_server_side(cfg, out):
    assert sl.from_ha_config(cfg) == out


@pytest.mark.parametrize(("value", "out"), [(31.776543, 31.78), (35.234567, 35.23), (-33.8688, -33.87), (151.2093, 151.21), (32.0, 32.0), (-0.004, -0.0)])
def test_a_served_coordinate_has_two_decimals(value, out):
    assert sl.served(value) == out


@pytest.mark.parametrize("cfg", [None, "x", [], {}, {"latitude": 0, "longitude": 0}, {"latitude": 0.0, "longitude": 0.0, "time_zone": "UTC"},
                                 {"latitude": 91, "longitude": 10}, {"latitude": 10, "longitude": 180.5}, {"latitude": "32", "longitude": "34"},
                                 {"latitude": True, "longitude": 34.8}, {"latitude": float("nan"), "longitude": 34.8}, {"latitude": 32.1}])
def test_a_core_config_without_a_usable_position_is_not_a_location(cfg):
    """0 / 0 is Home Assistant's own "never set" value; strings, booleans, NaN and out-of-range numbers are refused."""
    assert sl.from_ha_config(cfg) is None


def test_the_defaults_agree_with_the_settings_and_the_frontend():
    assert sl.DEFAULT_ZONE == DEFAULTS["time.zone"]
    assert DEFAULTS[sl.MODE_KEY] == sl.DEFAULT_MODE == "home"
    assert sl.CACHE_KEY not in DEFAULTS  # internal: never in GET / PATCH /settings
    sun = (Path(__file__).resolve().parents[3] / "frontend" / "src" / "map" / "sun.ts").read_text(encoding="utf-8")
    m = re.search(r"export const DEFAULT_SITE = \{ latitude: ([\d.-]+), longitude: ([\d.-]+) \}", sun)
    assert m and (float(m.group(1)), float(m.group(2))) == (sl.DEFAULT["latitude"], sl.DEFAULT["longitude"])
    assert f"DEFAULT_ZONE = '{sl.DEFAULT_ZONE}'" in sun


# ------------------------------------------------------------------ the HA sync session feeds it


def test_the_home_location_comes_from_the_sync_sessions_core_config(app_ha, monkeypatch):
    app, s = app_ha
    c = TestClient(app)
    before = location(c)
    assert before["source"] == "default" and (before["latitude"], before["longitude"]) == (32.0, 34.8) and before["home"] is None
    assert before["time_zone"] == "Asia/Jerusalem" and before["mode"] == "home"
    fake = LocatedHa(HOME_CONFIG)
    run_session(app, s, fake, _idle, monkeypatch)
    assert fake.calls.count("get_config") == 1, "the connect's own get_config - no extra request"
    loc = location(c)
    assert loc["source"] == "ha" and (loc["latitude"], loc["longitude"], loc["elevation_m"]) == (31.78, 35.23, 754)
    assert loc["time_zone"] == "Asia/Jerusalem" and loc["home"]["fetched_at"]
    # the same for a person who only reads maps (permissions unchanged: map.read reads it, nobody writes it)
    c.get("/api/v1/me")
    bind(c, s, "dana", "viewer", "installation", "*")
    assert location(c, headers=as_user("dana"))["source"] == "ha"


def test_unreachable_home_keeps_the_last_known_location_then_the_default(app_ha, monkeypatch):
    app, s = app_ha
    c = TestClient(app)
    run_session(app, s, LocatedHa(HOME_CONFIG), _idle, monkeypatch)
    first = location(c)
    # Home Assistant answers without a position (refused, restarting, never set): the last known value stays
    for cfg in (None, {"version": "2026.10.1", "latitude": 0, "longitude": 0}):
        run_session(app, s, LocatedHa(cfg), _idle, monkeypatch)
        assert location(c) == first
    # the add-on restarts while Home Assistant is down: a new app on the same data still has it
    assert location(TestClient(create_app(s))) == first
    # an unreadable stored value reads as "never read": the fallback, never an error
    with app.state.db.connection() as conn:
        conn.execute("UPDATE settings SET value = 'not json' WHERE key = ?", (sl.CACHE_KEY,))
    loc = location(c)
    assert loc["source"] == "default" and (loc["latitude"], loc["longitude"]) == (32.0, 34.8)


def test_the_location_is_read_again_only_rarely(app_ha, monkeypatch):
    """Every connect reads it; inside a session only after REFRESH_S (6 h) - here shortened to see the second read."""
    app, s = app_ha
    monkeypatch.setattr(ha_sync, "REGISTRY_REFRESH_S", 0.05)
    fake = LocatedHa(HOME_CONFIG)

    async def script(_on_event, _on_message, _settle):
        await asyncio.sleep(0.3)
        assert fake.calls.count("get_config") == 1, "not again before REFRESH_S"
        fake.config = {**HOME_CONFIG, "latitude": 29.55, "longitude": 34.95, "time_zone": "Asia/Jerusalem"}
        monkeypatch.setattr(sl, "REFRESH_S", 0)
        loop = asyncio.get_running_loop()
        end = loop.time() + 10
        while fake.calls.count("get_config") < 2 and loop.time() < end:
            await asyncio.sleep(0.02)
        await asyncio.sleep(0.2)  # the store runs in the executor

    run_session(app, s, fake, script, monkeypatch)
    assert fake.calls.count("get_config") >= 2
    assert (location(TestClient(app))["latitude"], location(TestClient(app))["longitude"]) == (29.55, 34.95)


# ------------------------------------------------------------------ the explicit override


def test_the_manual_override_wins_only_when_chosen_and_complete(app_ha, monkeypatch):
    app, s = app_ha
    c = TestClient(app)
    run_session(app, s, LocatedHa(HOME_CONFIG), _idle, monkeypatch)
    # typed values alone do not override the home (the owner's decision: the default is the home's location)
    assert c.patch("/api/v1/settings", json={"site.latitude": "-33.8688", "site.longitude": "151.2093"}).status_code == 200
    assert location(c)["source"] == "ha"
    assert c.get("/api/v1/settings").json()["settings"]["site.location_source"] == "home"
    # chosen: the override, the home's zone and elevation stay (the override is about the position)
    assert c.patch("/api/v1/settings", json={"site.location_source": "manual"}).status_code == 200
    loc = location(c)
    assert loc["source"] == "manual" and loc["mode"] == "manual" and (loc["latitude"], loc["longitude"]) == (-33.87, 151.21)  # served rounded
    assert c.get("/api/v1/settings").json()["settings"]["site.latitude"] == -33.8688  # the administrator sees what was typed
    assert loc["time_zone"] == "Asia/Jerusalem" and loc["elevation_m"] == 754 and loc["home"]["latitude"] == 31.78
    # chosen but incomplete: the home again (never a half-typed place)
    assert c.patch("/api/v1/settings", json={"site.longitude": ""}).status_code == 200
    assert location(c)["source"] == "ha" and location(c)["mode"] == "manual"
    # back to the home
    c.patch("/api/v1/settings", json={"site.longitude": "151.2093", "site.location_source": "home"})
    assert location(c)["source"] == "ha"
    for bad in ({"site.location_source": "gps"}, {"site.location_source": ""}, {"site.location_source": "HOME"}):
        assert c.patch("/api/v1/settings", json=bad).status_code == 422, bad
    # only an administrator chooses (system.configure, unchanged)
    c.get("/api/v1/me")
    bind(c, s, "dana", "viewer", "installation", "*")
    assert c.patch("/api/v1/settings", headers=as_user("dana"), json={"site.location_source": "manual"}).status_code == 403


def test_without_the_home_a_manual_override_still_works_and_else_the_default(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        c.patch("/api/v1/settings", json={"site.location_source": "manual", "site.latitude": "40.0", "site.longitude": "-105.27", "time.zone": "America/Denver"})
        loc = location(c)
        assert loc["source"] == "manual" and loc["home"] is None and loc["time_zone"] == "America/Denver" and loc["elevation_m"] is None
        c.patch("/api/v1/settings", json={"site.location_source": "home"})
        loc = location(c)
        assert loc["source"] == "default" and (loc["latitude"], loc["longitude"]) == (32.0, 34.8) and loc["time_zone"] == "America/Denver"


# ------------------------------------------------------------------ nothing private leaves


def test_no_secret_name_or_address_in_any_response_or_the_stored_value(app_ha, monkeypatch):
    app, s = app_ha
    c = TestClient(app)
    run_session(app, s, LocatedHa(HOME_CONFIG), _idle, monkeypatch)
    texts = [c.get("/api/v1/plan-view/prefs").text, c.put("/api/v1/plan-view/prefs", json={"prefs": {"eye_m": 1.5}}).text, c.get("/api/v1/settings").text]
    with app.state.db.connection() as conn:
        stored = conn.execute("SELECT value FROM settings WHERE key = ?", (sl.CACHE_KEY,)).fetchone()[0]
    for text in [*texts, stored]:
        for secret in (TOKEN, "Private Home Name", "homeassistant.internal", "example.invalid", "ha.local"):
            assert secret not in text, secret
    for text in texts:  # the exact position stays server-side; what leaves is rounded
        for exact in ("31.776543", "35.234567", "31.7765", "35.2345"):
            assert exact not in text, exact
    assert set(json.loads(stored)) == {"latitude", "longitude", "elevation_m", "time_zone", "fetched_at"}
    assert json.loads(stored)["latitude"] == 31.776543
    assert set(json.loads(texts[0])["location"]) == {"latitude", "longitude", "elevation_m", "time_zone", "source", "mode", "home"}
    assert sl.CACHE_KEY not in json.loads(texts[2])["settings"]


def test_the_site_position_reaches_map_readers_rounded_and_the_override_only_administrators(app_ha, monkeypatch):
    """SEC247 review I3: the general settings listing (GET /settings of any reader, GET /cameras `media`) never carries the
    site position; map readers get only the resolved, rounded `location` of /plan-view/prefs; the manual override fields
    are read back to system.configure holders only."""
    app, s = app_ha
    c = TestClient(app)
    run_session(app, s, LocatedHa(HOME_CONFIG), _idle, monkeypatch)
    assert c.patch("/api/v1/settings", json={"site.location_source": "manual", "site.latitude": "29.557669", "site.longitude": "34.951925"}).status_code == 200
    admin = c.get("/api/v1/settings").json()
    assert admin["can_edit"] and admin["settings"]["site.latitude"] == 29.557669 and admin["settings"]["site.location_source"] == "manual"
    c.get("/api/v1/me")
    bind(c, s, "dana", "viewer", "installation", "*")
    viewer = c.get("/api/v1/settings", headers=as_user("dana")).json()
    assert viewer["can_edit"] is False
    assert "site.latitude" not in viewer["settings"] and "site.longitude" not in viewer["settings"]
    cams = c.get("/api/v1/cameras")  # its `media` block is the general listing, whoever asks
    assert cams.status_code == 200, cams.text
    assert "site.latitude" not in cams.json()["media"] and "site.longitude" not in cams.json()["media"]
    for text in (c.get("/api/v1/settings", headers=as_user("dana")).text, cams.text):
        for exact in ("29.557669", "34.951925", "31.776543", "35.234567"):
            assert exact not in text, exact
    loc = location(c, headers=as_user("dana"))
    assert (loc["latitude"], loc["longitude"], loc["source"]) == (29.56, 34.95, "manual")
    assert (loc["home"]["latitude"], loc["home"]["longitude"]) == (31.78, 35.23)
    # the internal readers keep working without the keys
    from smplwise.routers.settings import read_settings

    with app.state.db.connection() as conn:
        assert "site.latitude" not in read_settings(conn) and read_settings(conn, private=True)["site.longitude"] == 34.951925


def test_the_home_location_is_local_state_never_in_a_backup():
    assert backup_svc._kept_setting(sl.CACHE_KEY)
    assert not backup_svc._kept_setting(sl.MODE_KEY) and not backup_svc._kept_setting("site.latitude")  # the choices are project settings
