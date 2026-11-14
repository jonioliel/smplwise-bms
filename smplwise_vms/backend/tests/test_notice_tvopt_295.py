"""TVOPT-295: the TV screen choices of the one-row header review - the header (a / b / c), the "updated" status line (full / time /
issues), what the freed height goes to (bigger / more / mix) and the company logo on the dark screen (auto / plate / invert).

A board's display JSON holds one of them only when the board chose its own value (no migration). Everything else follows the
installation defaults (`notices.tv.*`, PUT /notices/tv-defaults), which start at c / full / bigger / auto - the screen as it was.
Both are validated alike, reach the TV feed and the Settings preview, and are edited under the same permission (notices.boards)."""
from __future__ import annotations

import datetime as dt
import json
from zoneinfo import ZoneInfo

import pytest

from conftest import as_user, bind  # noqa: F401
from smplwise.db import Database
from smplwise.services.notices import model, sources

API = "/api/v1"
KEYS = ("header", "updated", "space", "night_logo", "weather_days", "idle_logo")
ALLOWED = {"header": model.HEADERS, "updated": model.UPDATED_LINES, "space": model.SPACE_USES, "night_logo": model.NIGHT_LOGOS, "weather_days": model.WEATHER_DAYS, "idle_logo": model.IDLE_LOGOS}
# TVNOTICE2-297 (owner 27.10): the "updated" line defaults to the approved preview wording ("place"); the header stays c; idle = SmplWise only
FACTORY = {"header": "c", "updated": "place", "space": "bigger", "night_logo": "auto", "weather_days": 0, "idle_logo": "sw"}
BAD = ["", "A", "d", "bigger ", 1, True, ["a"], {"v": "a"}]
BAD_DAYS = [-1, 6, 2.0, "3", True, False, [3], ""]


def _enable(client):
    assert client.patch(f"{API}/notices/settings", json={"enabled": True}).status_code == 200


def _board(client, slug="lobby", display=None):
    body = {"name": "לוח", "slug": slug, **({"display": display} if display is not None else {})}
    r = client.post(f"{API}/notices/boards", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def _feed(client, slug, token):
    return client.get(f"{API}/notices/display/{slug}", headers={"X-Board-Token": token})


def _fd(client, slug, token):
    d = _feed(client, slug, token).json()["board"]["display"]
    return {k: d[k] for k in KEYS}


# ---------------------------------------------------------------- the model

def test_the_allowed_values_and_the_factory_defaults():
    assert model.HEADERS == ("a", "b", "c")
    assert model.UPDATED_LINES == ("place", "full", "time", "issues")
    assert model.IDLE_LOGOS == ("sw", "both")
    assert model.SPACE_USES == ("bigger", "more", "mix")
    assert model.NIGHT_LOGOS == ("auto", "plate", "invert")
    assert model.TV_FACTORY == FACTORY
    assert {k: model.SETTINGS_DEFAULTS[f"notices.tv.{k}"] for k in KEYS} == {k: str(v) for k, v in FACTORY.items()}
    assert model.WEATHER_DAYS == (0, 1, 2, 3, 4, 5)
    assert model.tv_defaults_doc(lambda k, d: d) == FACTORY


def test_a_board_without_its_own_value_holds_no_key():
    assert not set(KEYS) & set(model.normalize_display({}))
    assert not set(KEYS) & set(model.DISPLAY_DEFAULTS)
    old = model.load_display('{"template": 3, "logos": "c", "saver": "off"}')  # a board stored before TVOPT-295
    assert not set(KEYS) & set(old) and (old["template"], old["logos"], old["saver"]) == (3, "c", "off")
    for k, allowed in ALLOWED.items():
        for v in allowed:
            assert model.normalize_display({k: v})[k] == v
            assert model.normalize_display({k: v}, strict=True)[k] == v
        assert k not in model.normalize_display({k: None}, strict=True)  # null = follow the default


@pytest.mark.parametrize(("key", "bad"), [(k, b) for k in KEYS for b in (BAD_DAYS if k == "weather_days" else BAD)])
def test_unknown_values_are_dropped_on_load_and_refused_by_a_patch(key, bad):
    assert key not in model.normalize_display({key: bad})  # lenient on load: the board follows the default
    with pytest.raises(model.Invalid) as e:
        model.normalize_display({key: bad}, strict=True)
    assert e.value.field == f"display.{key}"


def test_effective_display_prefers_the_boards_own_value():
    defaults = {"header": "a", "updated": "time", "space": "mix", "night_logo": "plate", "weather_days": 4, "idle_logo": "both"}
    assert {k: model.effective_display({}, defaults)[k] for k in KEYS} == defaults
    own = model.effective_display({"header": "c", "night_logo": "invert", "weather_days": 0}, defaults)
    assert (own["header"], own["updated"], own["space"], own["night_logo"], own["weather_days"]) == ("c", "time", "mix", "invert", 0)  # an own 0 wins too
    assert {k: model.effective_display({}, {})[k] for k in KEYS} == FACTORY


def test_merge_keeps_the_other_choices_and_null_returns_to_the_default():
    cur = model.normalize_display({"header": "a", "updated": "time", "space": "mix", "night_logo": "invert", "logos": "b"})
    m = model.merge_display(cur, {"header": "b"})
    assert (m["header"], m["updated"], m["space"], m["night_logo"], m["logos"]) == ("b", "time", "mix", "invert", "b")
    m = model.merge_display(m, {"header": None, "space": None})
    assert "header" not in m and "space" not in m and (m["updated"], m["night_logo"]) == ("time", "invert")


def test_defaults_values_are_validated():
    assert model.tv_defaults_values({"header": "b", "night_logo": "invert", "weather_days": 5}) == {"notices.tv.header": "b", "notices.tv.night_logo": "invert", "notices.tv.weather_days": "5"}
    for bad in ({"header": "d"}, {"updated": 1}, {"space": None}, {"colour": "red"}, {"night_logo": "white"}, {"weather_days": 6}, {"weather_days": "2"}, {"weather_days": True}):
        with pytest.raises(model.Invalid):
            model.tv_defaults_values(bad)
    stored = {"notices.tv.header": "z", "notices.tv.space": "more", "notices.tv.weather_days": "3"}
    assert model.tv_defaults_doc(lambda k, d: stored.get(k, d)) == {**FACTORY, "space": "more", "weather_days": 3}
    assert model.tv_defaults_doc(lambda k, d: {"notices.tv.weather_days": "9"}.get(k, d))["weather_days"] == 0  # a bad stored value reads as the factory one


# ---------------------------------------------------------------- the API

def test_boards_follow_the_installation_defaults_until_they_choose(client):
    _enable(client)
    old_board = _board(client, "lobby")  # created before the defaults change: no own value
    assert not set(KEYS) & set(old_board["board"]["display"])
    assert _fd(client, "lobby", old_board["token"]) == FACTORY  # backwards compatible: the screen as it was
    assert client.get(f"{API}/notices/tv-defaults").json()["tv_defaults"] == FACTORY
    assert client.get(f"{API}/notices/settings").json()["settings"]["tv_defaults"] == FACTORY

    want = {"header": "a", "updated": "issues", "space": "more", "night_logo": "plate", "weather_days": 3, "idle_logo": "both"}
    r = client.put(f"{API}/notices/tv-defaults", json=want)
    assert r.status_code == 200 and r.json()["tv_defaults"] == want
    v_before = _feed(client, "lobby", old_board["token"]).json()["board"]["version"]
    assert _fd(client, "lobby", old_board["token"]) == want  # the existing board follows the new defaults
    new_board = _board(client, "lobby-2")
    assert not set(KEYS) & set(new_board["board"]["display"])
    assert _fd(client, "lobby-2", new_board["token"]) == want  # so does a new one
    # a board's own explicit value wins, the rest still follows
    bid = old_board["board"]["id"]
    r = client.patch(f"{API}/notices/boards/{bid}", json={"display": {"header": "c", "night_logo": "invert"}})
    assert r.status_code == 200 and (r.json()["board"]["display"]["header"], r.json()["board"]["display"]["night_logo"]) == ("c", "invert")
    assert _fd(client, "lobby", old_board["token"]) == {**want, "header": "c", "night_logo": "invert"}
    assert _feed(client, "lobby", old_board["token"]).json()["board"]["version"] != v_before  # the TV redraws
    # null returns one choice to the default
    r = client.patch(f"{API}/notices/boards/{bid}", json={"display": {"header": None}})
    assert r.status_code == 200 and "header" not in r.json()["board"]["display"]
    assert _fd(client, "lobby", old_board["token"])["header"] == "a"
    # a board created with its own values keeps them through a defaults change
    own = _board(client, "lobby-3", {"header": "b", "updated": "time"})
    assert client.put(f"{API}/notices/tv-defaults", json={"header": "c", "updated": "full"}).status_code == 200
    assert _fd(client, "lobby-3", own["token"]) == {"header": "b", "updated": "time", "space": "more", "night_logo": "plate", "weather_days": 3, "idle_logo": "both"}
    assert _fd(client, "lobby-2", new_board["token"]) == {"header": "c", "updated": "full", "space": "more", "night_logo": "plate", "weather_days": 3, "idle_logo": "both"}


def test_board_values_are_validated_and_the_preview_resolves_drafts(client):
    _enable(client)
    made = _board(client)
    bid, token = made["board"]["id"], made["token"]
    for bad in ({"header": "d"}, {"updated": "never"}, {"space": 2}, {"night_logo": "white"}, {"weather_days": 6}, {"weather_days": "2"}, {"weather_days": True}):
        assert client.patch(f"{API}/notices/boards/{bid}", json={"display": bad}).status_code == 422, bad
    assert client.post(f"{API}/notices/boards", json={"name": "לוח 3", "slug": "lobby-3", "display": {"updated": "x"}}).status_code == 422
    assert client.put(f"{API}/notices/tv-defaults", json={"space": "mix"}).status_code == 200
    r = client.post(f"{API}/notices/boards/{bid}/preview", json={"display": {"header": "b", "night_logo": "invert"}})
    assert r.status_code == 200
    d = r.json()["board"]["display"]
    assert (d["header"], d["updated"], d["space"], d["night_logo"], d["weather_days"]) == ("b", "place", "mix", "invert", 0)  # draft + defaults
    assert not set(KEYS) & set(client.get(f"{API}/notices/boards/{bid}").json()["board"]["display"])  # nothing saved
    assert _fd(client, "lobby", token)["space"] == "mix"


@pytest.mark.parametrize("bad", [{"header": "d"}, {"updated": 3}, {"space": "huge"}, {"night_logo": "white"}, {"colour": "red"}, {"weather_days": 6}, {"weather_days": -1}, {"weather_days": "2"}, {"weather_days": True}])
def test_defaults_put_refuses_bad_values(client, bad):
    _enable(client)
    assert client.put(f"{API}/notices/tv-defaults", json=bad).status_code == 422
    assert client.get(f"{API}/notices/tv-defaults").json()["tv_defaults"] == FACTORY


def test_only_the_screen_settings_permission_changes_them(client, settings):
    """The same permission as every other screen setting of a board (notices.boards, granted per role) - for a board and for the defaults."""
    _enable(client)
    bid = _board(client)["board"]["id"]
    bind(client, settings, "dana", "viewer", "installation", "*")
    assert client.patch(f"{API}/notices/boards/{bid}", json={"display": {"header": "a"}}, headers=as_user("dana")).status_code == 403
    assert client.put(f"{API}/notices/tv-defaults", json={"header": "a"}, headers=as_user("dana")).status_code == 403
    assert client.get(f"{API}/notices/tv-defaults", headers=as_user("dana")).status_code == 403
    assert client.get(f"{API}/notices/tv-defaults").json()["tv_defaults"]["header"] == "c"
    bind(client, settings, "omer", "notices_boards", "installation", "*")
    r = client.patch(f"{API}/notices/boards/{bid}", json={"display": {"header": "a", "night_logo": "invert"}}, headers=as_user("omer"))
    assert r.status_code == 200 and r.json()["board"]["display"]["header"] == "a"
    r = client.put(f"{API}/notices/tv-defaults", json={"updated": "time"}, headers=as_user("omer"))
    assert r.status_code == 200 and r.json()["tv_defaults"]["updated"] == "time"
    # the module settings route (system.configure) does not take them
    assert client.patch(f"{API}/notices/settings", json={"tv_header": "a"}).status_code == 422


# ---------------------------------------------------------------- weather_days (owner 2026-10-25)

TZ = ZoneInfo("Asia/Jerusalem")
NOW = dt.datetime(2026, 10, 25, 8, 0, tzinfo=dt.timezone.utc)  # 10:00 in Israel (UTC+2 after the 25.10.2026 clock change)


def _daily(n, start=0):
    # local midnights (the zone changes its offset on 25.10.2026: built per day, never by adding 24 h to an instant)
    return [{"datetime": dt.datetime.combine(dt.date(2026, 10, 25) + dt.timedelta(days=i), dt.time(0, 0), TZ).isoformat(), "temperature": 25 + i, "templow": 15 + i,
             "condition": "sunny" if i % 2 else "cloudy"} for i in range(start, start + n)]


def test_forecast_days_from_a_daily_forecast():
    # daily entries at 00:00 local time (21:00 UTC the evening before), from today on
    days = sources.forecast_days(_daily(7), TZ, NOW, 5)
    assert [d["date"] for d in days] == ["2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29"]
    assert days[0] == {"date": "2026-10-25", "t": 25, "lo": 15, "condition": "cloud"}
    assert days[1]["condition"] == "sun"
    assert len(sources.forecast_days(_daily(7), TZ, NOW, 3)) == 3


def test_forecast_days_falls_back_to_what_the_source_has():
    assert len(sources.forecast_days(_daily(2), TZ, NOW, 5)) == 2  # fewer days: fewer cells, none invented
    assert sources.forecast_days(None, TZ, NOW, 5) == [] and sources.forecast_days([], TZ, NOW, 5) == []
    past = [{"datetime": "2026-10-20T09:00:00Z", "temperature": 20}]
    assert sources.forecast_days(past, TZ, NOW, 5) == []  # days before today are skipped
    junk = [{"datetime": "nope", "temperature": 20}, {"datetime": "2026-10-26T09:00:00Z", "temperature": "hot"}, "x", {"datetime": "2026-10-26T09:00:00Z", "temperature": True}]
    assert sources.forecast_days(junk, TZ, NOW, 5) == []


def test_forecast_days_from_an_hourly_forecast():
    hourly = [{"datetime": (NOW + dt.timedelta(hours=h)).isoformat(), "temperature": 20 + (h % 12), "condition": "sunny" if h == 2 else "cloudy"} for h in range(0, 30, 2)]
    days = sources.forecast_days(hourly, TZ, NOW, 5)
    assert [d["date"] for d in days] == ["2026-10-25", "2026-10-26"]  # 30 hours cover two local days
    assert days[0]["t"] == 30 and days[0]["lo"] == 20  # high and low of the hours of the day (no templow)
    assert days[0]["condition"] == "sun"  # the entry nearest to noon (12:00 local = 10:00 UTC = NOW + 2 h)


def _weather(client, settings, forecast):
    db = Database(settings.db_path)
    with db.connection() as conn:
        conn.execute("""INSERT INTO ha_entities(entity_id, domain, name, state, attributes_json, available, first_seen_at, updated_at)
                        VALUES ('weather.home', 'weather', 'Home', 'sunny', ?, 1, '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z')""",
                     (json.dumps({"temperature": 24.4, "forecast": forecast}),))
    assert client.patch(f"{API}/notices/settings", json={"weather_entity": "weather.home"}).status_code == 200


def test_weather_days_reach_the_feed_only_when_asked(client, settings):
    _enable(client)
    today = dt.datetime.now(dt.timezone.utc).astimezone(TZ).replace(hour=12, minute=0, second=0, microsecond=0)
    fc = [{"datetime": (today + dt.timedelta(days=i)).isoformat(), "temperature": 25 + i, "templow": 15, "condition": "sunny"} for i in range(6)]
    _weather(client, settings, fc)
    made = _board(client)
    bid, token = made["board"]["id"], made["token"]
    w = _feed(client, "lobby", token).json()["weather"]
    assert "days" not in w and len(w["hours"]) == 5  # the factory default 0: the feed exactly as before
    assert client.patch(f"{API}/notices/boards/{bid}", json={"display": {"weather_days": 4}}).status_code == 200
    w = _feed(client, "lobby", token).json()["weather"]
    assert len(w["days"]) == 4 and w["days"][0]["date"] == today.date().isoformat() and w["days"][0]["t"] == 25
    assert client.patch(f"{API}/notices/boards/{bid}", json={"display": {"weather_days": 1}}).status_code == 200
    assert "days" not in _feed(client, "lobby", token).json()["weather"]  # today only: the TV draws no forecast row
    # the installation default applies to a board without its own value
    assert client.patch(f"{API}/notices/boards/{bid}", json={"display": {"weather_days": None}}).status_code == 200
    assert client.put(f"{API}/notices/tv-defaults", json={"weather_days": 5}).status_code == 200
    feed = _feed(client, "lobby", token).json()
    assert feed["board"]["display"]["weather_days"] == 5 and len(feed["weather"]["days"]) == 5