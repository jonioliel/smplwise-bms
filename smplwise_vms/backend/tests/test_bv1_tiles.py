"""BV1 (2026-10-05): more Bubble variants on the home screen - the agenda tile (the next event of the chosen `calendar.*`
entities, read from the mirrored catalogue), the quick-launcher grid (routes, scenes, scripts, quick actions), the tile style
of the clock / weather, and the two look dials (`surface: none`, `slider`). Validation, the data the tree carries, the
candidates, and that nothing beyond the allowed attributes of a calendar is mirrored."""
from __future__ import annotations

import json
from dataclasses import replace
from datetime import datetime, timedelta, timezone

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.services import ha_client, ha_sync, home_config, home_screen, look

NOW = datetime(2026, 10, 5, 10, 0, tzinfo=timezone.utc)


def _iso(delta_h: float) -> str:
    return (NOW + timedelta(hours=delta_h)).isoformat()


def _st(eid: str, state: str, **attrs) -> dict:
    return {"entity_id": eid, "state": state, "attributes": attrs, "last_changed": NOW.isoformat(), "last_updated": NOW.isoformat()}


STATES = [
    _st("calendar.family", "on", friendly_name="משפחה", message="רופא שיניים", start_time=_iso(2), end_time=_iso(3), all_day=False, location="רחוב הרצל 5", description="private note"),
    _st("calendar.work", "off", friendly_name="עבודה", message="פגישת צוות", start_time=_iso(30), end_time=_iso(31), all_day=False),
    _st("calendar.allday", "off", friendly_name="חגים", message="חג", start_time=(NOW + timedelta(days=2)).strftime("%Y-%m-%d 00:00:00"), end_time=(NOW + timedelta(days=3)).strftime("%Y-%m-%d 00:00:00"), all_day=True),
    _st("calendar.far", "off", friendly_name="רחוק", message="בעוד חודש", start_time=_iso(24 * 30), end_time=_iso(24 * 30 + 1), all_day=False),
    _st("calendar.past", "off", friendly_name="עבר", message="נגמר", start_time=_iso(-5), end_time=_iso(-4), all_day=False),
    _st("calendar.empty", "off", friendly_name="ריק"),
    _st("calendar.gone", "unavailable", friendly_name="נעלם", message="x", start_time=_iso(1)),
    _st("scene.evening", "unknown", friendly_name="ערב"),
    _st("script.goodnight", "off", friendly_name="לילה טוב"),
    _st("weather.home", "sunny", friendly_name="Home", temperature=27),
]


@pytest.fixture()
def app_c(settings, monkeypatch):
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="secret-token-value")
    monkeypatch.setattr(ha_client, "get_states", lambda _s: STATES)
    from smplwise.main import create_app

    app = create_app(s)
    ha_sync.STATE.connected = True
    ha_sync.snapshot(app.state.db, s)
    return app, s


def _patch(c: TestClient, body: dict, **kw):
    return c.patch("/api/v1/settings", json=body, **kw)


# ------------------------------------------------------------------------------------------------ the configuration


def test_defaults_append_the_new_widgets_off_screen_and_keep_the_cards():
    cfg = home_config.default_config()
    assert cfg["order"][-2:] == ["agenda", "launcher"]
    assert cfg["agenda"] == {"on": True, "sizes": {"a": "m", "b": "m", "c": "m"}, "label": "", "phone_on": None, "phone_size": None, "calendars": [], "days": 7}
    assert cfg["launcher"] == {"on": True, "sizes": {"a": "m", "b": "s", "c": "m"}, "label": "", "phone_on": None, "phone_size": None, "items": []}
    assert cfg["clock"]["style"] == "card" and cfg["weather"]["style"] == "card"  # today's pixels: the card
    # a config stored before BV1 reads with the defaults (nothing refused)
    old = {"order": ["clock", "weather", "shabbat", "alarm", "quick", "media"], "clock": {"on": True, "mode": "time"}}
    got = home_config.normalise(old)
    assert got["order"] == list(home_config.WIDGET_IDS) and got["agenda"]["calendars"] == [] and got["launcher"]["items"] == [] and got["clock"]["style"] == "card"


def test_the_new_widgets_are_validated_whole():
    ok = home_config.normalise({
        "clock": {"style": "tile"}, "weather": {"style": "tile"},
        "agenda": {"calendars": ["calendar.family", "calendar.work", "calendar.family"], "days": 3},
        "launcher": {"items": [{"kind": "route", "id": "live"}, {"kind": "scene", "id": "scene.evening", "label": " ערב "}, {"kind": "script", "id": "script.goodnight"}, {"kind": "quick", "id": "all_off"}]},
    })
    assert ok["clock"]["style"] == "tile" and ok["weather"]["style"] == "tile"
    assert ok["agenda"] == {**home_config._default_widget("agenda"), "calendars": ["calendar.family", "calendar.work"], "days": 3}
    assert ok["launcher"]["items"] == [{"kind": "route", "id": "live", "label": ""}, {"kind": "scene", "id": "scene.evening", "label": "ערב"}, {"kind": "script", "id": "script.goodnight", "label": ""}, {"kind": "quick", "id": "all_off", "label": ""}]
    for bad in (
        {"clock": {"style": "big"}}, {"weather": {"style": ""}},
        {"agenda": {"calendars": "calendar.x"}}, {"agenda": {"calendars": ["sensor.x"]}}, {"agenda": {"calendars": [""]}}, {"agenda": {"calendars": [f"calendar.c{i}" for i in range(7)]}},
        {"agenda": {"days": 2}}, {"agenda": {"days": "7"}}, {"agenda": {"days": True}}, {"agenda": {"colour": "red"}},
        {"launcher": {"items": "live"}}, {"launcher": {"items": [{"kind": "route", "id": "nope"}]}}, {"launcher": {"items": [{"kind": "scene", "id": "script.x"}]}},
        {"launcher": {"items": [{"kind": "quick", "id": "everything"}]}}, {"launcher": {"items": [{"kind": "url", "id": "https://x"}]}}, {"launcher": {"items": [{"kind": "route", "id": "live", "icon": "x"}]}},
        {"launcher": {"items": [{"kind": "route", "id": "live"}, {"kind": "route", "id": "live"}]}}, {"launcher": {"items": [{"kind": "route", "id": "live"}] * 13}},
        {"launcher": {"items": [{"kind": "scene", "id": "scene.x", "label": "x" * 31}]}},
    ):
        with pytest.raises(ValueError):
            home_config.normalise(bad)


def test_personal_override_covers_the_new_widgets_too():
    p = home_config.normalise_personal({"widgets": {"agenda": {"on": False}, "launcher": {"size": "l"}}, "order": ["launcher"]})
    assert p["widgets"] == {"agenda": {"on": False}, "launcher": {"size": "l"}} and p["order"][0] == "launcher"
    out, _ = home_config.apply_personal(home_config.default_config(), "a", p)
    assert out["agenda"]["on"] is False and out["launcher"]["sizes"]["a"] == "l"


# ------------------------------------------------------------------------------------------------ the data


def test_the_agenda_reads_the_next_event_of_each_mirrored_calendar_sorted_and_within_the_horizon(app_c):
    app, _ = app_c
    with app.state.db.connection() as conn:
        cfg = home_config.default_config()
        cfg["agenda"]["calendars"] = ["calendar.work", "calendar.family", "calendar.allday", "calendar.far", "calendar.past", "calendar.empty", "calendar.gone"]
        # (the limit is 6 in the validator; the service itself takes what it is given)
        d = home_screen.agenda_data(conn, cfg, now=NOW)
        assert [e["calendar"] for e in d["events"]] == ["calendar.family", "calendar.work", "calendar.allday"]  # by start; far / past / empty / unavailable dropped
        fam = d["events"][0]
        assert fam == {"calendar": "calendar.family", "calendar_name": "משפחה", "message": "רופא שיניים", "start": _iso(2), "end": _iso(3), "all_day": False, "location": "רחוב הרצל 5"}
        assert "description" not in json.dumps(d) and "private note" not in json.dumps(d)
        assert d["events"][2]["all_day"] is True and d["events"][2]["location"] is None
        by_id = {c["entity_id"]: c for c in d["calendars"]}
        assert by_id["calendar.gone"]["available"] is False and by_id["calendar.empty"]["available"] is True and by_id["calendar.family"]["name"] == "משפחה"
        # a shorter horizon drops the work meeting (30 h away)
        cfg["agenda"]["days"] = 1
        assert [e["calendar"] for e in home_screen.agenda_data(conn, cfg, now=NOW)["events"]] == ["calendar.family"]
        # a calendar that is not mirrored is listed as not found
        cfg["agenda"]["calendars"] = ["calendar.nope"]
        d = home_screen.agenda_data(conn, cfg, now=NOW)
        assert d["events"] == [] and d["calendars"] == [{"entity_id": "calendar.nope", "name": "calendar.nope", "available": False, "found": False}]


def test_the_tree_carries_the_agenda_only_while_the_widget_is_on_with_calendars(app_c):
    app, s = app_c
    with TestClient(app) as c:
        assert c.get("/api/v1/devices/tree").json()["home"]["data"]["agenda"] is None  # no calendar chosen
        r = _patch(c, {"home.widgets": {"agenda": {"calendars": ["calendar.family", "calendar.work"]}}})
        assert r.status_code == 200, r.text
        d = c.get("/api/v1/devices/tree").json()["home"]["data"]["agenda"]
        assert [e["message"] for e in d["events"]] == ["רופא שיניים", "פגישת צוות"]
        # a viewer sees the agenda too (the calendars are the site's, like the weather entity)
        bind(c, s, "ron", "viewer", "installation", "*")
        assert c.get("/api/v1/devices/tree", headers=as_user("ron")).json()["home"]["data"]["agenda"]["events"][0]["message"] == "רופא שיניים"
        _patch(c, {"home.widgets": {"agenda": {"on": False, "calendars": ["calendar.family"]}}})
        assert c.get("/api/v1/devices/tree").json()["home"]["data"]["agenda"] is None


def test_the_mirror_keeps_only_the_events_allowed_attributes():
    kept = json.loads(ha_sync.trim_attributes({"message": "m", "start_time": "2026-10-06 10:00:00", "end_time": "2026-10-06 11:00:00", "all_day": False, "location": "here", "description": "secret", "offset_reached": False}, "calendar"))
    assert kept == {"message": "m", "start_time": "2026-10-06 10:00:00", "end_time": "2026-10-06 11:00:00", "all_day": False, "location": "here"}


def test_candidates_offer_calendars_with_their_next_event_scenes_and_scripts(app_c):
    app, _ = app_c
    with TestClient(app) as c:
        cand = c.get("/api/v1/devices/home-candidates").json()
        cals = {x["entity_id"]: x for x in cand["calendars"]}
        assert set(cals) == {"calendar.family", "calendar.work", "calendar.allday", "calendar.far", "calendar.past", "calendar.empty", "calendar.gone"}
        assert cals["calendar.family"]["event"]["message"] == "רופא שיניים" and cals["calendar.empty"]["event"] is None and cals["calendar.gone"]["event"] is None
        assert [x["entity_id"] for x in cand["scenes"]] == ["scene.evening"] and cand["scenes"][0]["name"] == "ערב"
        assert [x["entity_id"] for x in cand["scripts"]] == ["script.goodnight"]


# ------------------------------------------------------------------------------------------------ the look dials


def test_the_surfaceless_look_and_the_slider_dial():
    assert "none" in look.SURFACES and look.SLIDERS == ("horizontal", "vertical")
    assert look.DEFAULT["slider"] == "horizontal" and look.KEYS.index("slider") == look.KEYS.index("radius") + 1
    assert look.normalize_partial({"surface": "none", "slider": "vertical"}) == {"surface": "none", "slider": "vertical"}
    for bad in ({"slider": "diagonal"}, {"slider": "Vertical"}, {"slider": 1}, {"surface": "None"}):
        with pytest.raises(ValueError):
            look.normalize_partial(bad)
    # an installation default stored before the dial existed reads as horizontal
    old = {k: v for k, v in look.DEFAULT.items() if k != "slider"}
    assert look.stored(json.dumps(old))["slider"] == "horizontal"
