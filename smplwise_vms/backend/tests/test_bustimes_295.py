"""BUSTIMES-295: nearby public-transport times on the notice board - settings model, the Stride client against a recorded fake, the local
catalogue, the de-duplicating poller with its breaker, the digest states (fresh / cached / expired / off), the routes and their permissions,
the TV digest route (token, LAN listener), source health, and the rule that nothing on a screen's path calls the third party.
Fakes only: no network."""
from __future__ import annotations

import datetime as dt
import json
import re
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from conftest import as_user, bind
from transit_fake import FakeStride
from smplwise.db import Database
from smplwise.services.notices import display as disp
from smplwise.services.notices import listener, model as nmodel
from smplwise.services.transit import catalogue, digest, health, model, poller, stride

API = "/api/v1"
BASE = dt.datetime(2026, 10, 26, 6, 0, 0, tzinfo=dt.timezone.utc)  # 08:00 in Israel (UTC+2: summer time ended 2026-10-25)
TZ = ZoneInfo("Asia/Jerusalem")


@pytest.fixture(autouse=True)
def _clean_poller_state():
    poller.HEALTH.__init__()
    poller._PROVIDERS.clear()
    poller._LAST_CATALOGUE_TRY.clear()
    yield


def _db(settings) -> Database:
    return Database(settings.db_path)


def _on(client, stops=(33323,), **extra):
    assert client.patch(f"{API}/notices/settings", json={"enabled": True}).status_code == 200
    r = client.put(f"{API}/transit/settings", json={"enabled": True, "stops": [{"code": c} for c in stops], **extra})
    assert r.status_code == 200, r.text
    return r.json()


def _board(client, slug="lobby", transit=None):
    display = {"transit": {"enabled": True, **(transit or {})}}
    r = client.post(f"{API}/notices/boards", json={"name": "לוח " + slug, "slug": slug, "display": display})
    assert r.status_code == 200, r.text
    return r.json()["board"]["id"], r.json()["token"]


def _loaded(client, settings, fake=None, **kw):
    """A configured installation with a loaded catalogue and one polled pass; returns (fake, token)."""
    fake = fake or FakeStride(BASE)
    catalogue.refresh(_db(settings), fake, BASE, dt.date(2026, 10, 26))
    _on(client, **kw)
    _, token = _board(client)
    poller.poll_once(_db(settings), fake, BASE)
    return fake, token


def _digest(settings, now, screen):
    with _db(settings).connection(mode="read") as conn:
        return digest.build(conn, model.normalize_screen(screen), now, TZ)


# ---------------------------------------------------------------- the settings model

def test_config_defaults_ranges_and_the_four_stop_cap():
    d = model.normalize_config({})
    assert d == {"enabled": False, "stops": [], "clock_after_min": 60, "stale_grace_min": 30, "hide_closer_min": 0}
    five = [{"code": c} for c in (1, 2, 3, 4, 5)]
    assert len(model.normalize_config({"stops": five})["stops"]) == 4  # a stored value is clamped
    with pytest.raises(model.Invalid):
        model.normalize_config({"stops": five}, strict=True)
    with pytest.raises(model.Invalid):
        model.normalize_config({"stops": [{"code": 7}, {"code": 7}]}, strict=True)
    with pytest.raises(model.Invalid):
        model.normalize_config({"stale_grace_min": 999}, strict=True)
    assert model.normalize_config({"stale_grace_min": 0})["stale_grace_min"] == 0  # 0 = no last-known data at all
    assert model.normalize_config({"stops": [{"code": "33323", "name": "  א   ב "}]})["stops"] == [{"code": 33323, "name": "א ב"}]


def test_screen_defaults_choices_and_free_window():
    d = model.normalize_screen({})
    assert d == {"enabled": False, "stops": [], "layout": "side", "window_min": 60, "rows": 5, "group": "auto", "dwell_s": 15}
    for w in (15, 30, 60, 120, 180, 45, 240, 5):  # the list AND a free value
        assert model.normalize_screen({"window_min": w}, strict=True)["window_min"] == w
    for bad in ({"window_min": 4}, {"window_min": 241}, {"rows": 2}, {"rows": 11}, {"layout": "x"}, {"group": "x"}, {"stops": [1, 1]}, {"enabled": "yes"}):
        with pytest.raises(model.Invalid):
            model.normalize_screen(bad, strict=True)
        assert model.normalize_screen(bad) == model.normalize_screen({})  # a stored bad value reads as the default


def test_an_old_board_display_without_the_key_reads_the_defaults_and_a_patch_is_validated():
    old = nmodel.load_display(json.dumps({"template": 1, "lang": "he"}))
    assert old["transit"] == model.SCREEN_DEFAULTS and old["transit"]["enabled"] is False
    merged = nmodel.merge_display(old, {"transit": {"enabled": True, "layout": "strip"}})
    assert merged["transit"]["layout"] == "strip" and merged["transit"]["rows"] == 5
    with pytest.raises(nmodel.Invalid):
        nmodel.merge_display(old, {"transit": {"layout": "diagonal"}})


def test_selection_follows_the_installation_order_and_ignores_removed_stops():
    cfg = {"stops": [{"code": 3}, {"code": 1}, {"code": 2}]}
    assert model.selection(cfg, {"stops": []}) == [3, 1, 2]
    assert model.selection(cfg, {"stops": [2, 3, 99]}) == [3, 2]


# ---------------------------------------------------------------- the Stride client against the recorded fake

def test_destination_comes_from_the_route_name_and_falls_back_to_empty():
    assert stride.destination("ת. רכבת נתניה-נתניה<->בית גיל הזהב/השקד-נתניה-2#") == "בית גיל הזהב/השקד"
    assert stride.destination("ת. רכבת נתניה-נתניה<->קניון השרון-נתניה-1#") == "קניון השרון"
    assert stride.destination("no marker") == "" and stride.destination(None) == ""


def test_arrivals_keep_only_boardable_rows_in_utc_and_the_request_shape_is_right():
    fake = FakeStride(BASE)
    ids = stride.stop_ids(fake, 33323, dt.date(2026, 10, 26))
    assert ids == [49655060]
    rows = stride.fetch_arrivals(fake, [49655060, 49655059], BASE, BASE + dt.timedelta(hours=3))
    path, params = fake.calls[-1]
    assert params["gtfs_stop_ids"] == "49655060,49655059" and params["arrival_time_from"].endswith("Z") and "arrival_time_to" in params  # CSV ids + a time range
    got = stride.normalize_arrivals(rows)
    assert [r["line"] for r in got] == ["25", "11", "28", "25", "25", "28"] and "650" not in {r["line"] for r in got}  # the terminus row is dropped
    assert got[0]["at"] == "2026-10-26T06:04:30Z" and got[0]["dest"] == "בית גיל הזהב/השקד"


def test_the_fake_reproduces_the_inconsistent_list_parameters():
    fake = FakeStride(BASE)
    with pytest.raises(stride.StrideError):
        fake("/gtfs_ride_stops/list", {"gtfs_stop_ids": "49655060"})  # no time range: 400
    with pytest.raises(stride.StrideError):
        fake("/gtfs_ride_stops/list", {"gtfs_ride_ids": "1,2"})  # a CSV of rides: 400
    assert stride.last_stop_name(fake, 1) == "בית גיל הזהב/השקד"  # the single-id form works


def test_catalogue_download_pages_and_deduplicates_by_code(monkeypatch):
    monkeypatch.setattr(stride, "PAGE", 2)
    fake = FakeStride(BASE)
    got = stride.fetch_catalogue(fake, dt.date(2026, 10, 26))
    assert sorted(s["code"] for s in got) == [11111, 33323, 33324, 51439, 57453]  # 57453 once
    assert fake.count("/gtfs_stops/list") == 4  # 6 rows in pages of 2, a short page ends it ... (3 full + 1 empty)
    with pytest.raises(stride.StrideError):
        stride.fetch_catalogue(FakeStride(BASE, stops=[]), dt.date(2026, 10, 26))


# ---------------------------------------------------------------- the local catalogue

def test_catalogue_refresh_swaps_the_table_and_search_is_local(client, settings):
    fake = FakeStride(BASE)
    db = _db(settings)
    st = catalogue.refresh(db, fake, BASE, dt.date(2026, 10, 26))
    assert st["count"] == 5 and st["date"] == "2026-10-26" and st["error"] is None
    n_calls = len(fake.calls)
    with db.connection(mode="read") as conn:
        assert catalogue.cities(conn) == ["ירושלים", "נתניה", "תל אביב יפו"]
        codes = lambda **kw: sorted(s["code"] for s in catalogue.search(conn, **kw))  # noqa: E731
        assert codes(city="נתניה") == [33323, 33324]
        assert codes(q="הרצל") == [33323, 33324]
        assert codes(city="נתניה", q="חיים הרצל") == [33323, 33324]  # every word must occur, any order
        assert codes(q="33323") == [33323]
        assert codes(q="3332") == [33323, 33324]  # a code prefix
        assert catalogue.search(conn) == [] and catalogue.search(conn, q="%") == []  # no filter = nothing; a LIKE wildcard is a literal
    assert len(fake.calls) == n_calls  # the search made no third-party call


def test_a_failed_download_keeps_yesterdays_table_and_says_so(client, settings):
    db = _db(settings)
    fake = FakeStride(BASE)
    catalogue.refresh(db, fake, BASE, dt.date(2026, 10, 25))
    fake.fail = stride.StrideError("http_500")
    st = catalogue.refresh(db, fake, BASE + dt.timedelta(days=1), dt.date(2026, 10, 26))
    assert st["count"] == 5 and st["date"] == "2026-10-25" and st["error"] == "http_500"
    fake.fail = None
    assert catalogue.refresh(db, fake, BASE + dt.timedelta(days=1), dt.date(2026, 10, 26))["error"] is None


def test_the_nightly_download_is_due_after_four_local_and_once_a_day(client, settings):
    db = _db(settings)
    with db.connection(mode="read") as conn:
        assert catalogue.due(conn, dt.datetime(2026, 10, 26, 1, 0, tzinfo=TZ))  # empty: due at once
    catalogue.refresh(db, FakeStride(BASE), BASE, dt.date(2026, 10, 26))
    with db.connection(mode="read") as conn:
        assert not catalogue.due(conn, dt.datetime(2026, 10, 26, 23, 0, tzinfo=TZ))
        assert not catalogue.due(conn, dt.datetime(2026, 10, 27, 3, 59, tzinfo=TZ))
        assert catalogue.due(conn, dt.datetime(2026, 10, 27, 4, 0, tzinfo=TZ))


def test_catalogue_pass_runs_only_with_the_module_on_and_retries_after_half_an_hour(client, settings):
    db = _db(settings)
    fake = FakeStride(BASE)
    assert poller.catalogue_pass(db, fake, BASE) is None and not fake.calls  # module off: no call
    _on(client)
    fake.fail = stride.StrideError("unreachable")
    assert poller.catalogue_pass(db, fake, BASE)["error"] == "unreachable"
    n = len(fake.calls)
    assert poller.catalogue_pass(db, fake, BASE + dt.timedelta(minutes=5)) is None and len(fake.calls) == n  # not hammered
    fake.fail = None
    assert poller.catalogue_pass(db, fake, BASE + dt.timedelta(minutes=31))["count"] == 5


# ---------------------------------------------------------------- the poller

def test_one_request_per_distinct_code_shared_by_every_screen(client, settings):
    fake = FakeStride(BASE)
    catalogue.refresh(_db(settings), fake, BASE, dt.date(2026, 10, 26))
    _on(client, stops=(33323, 33324))
    _board(client, "a")
    _board(client, "b", {"stops": [33323]})
    _board(client, "c", {"window_min": 180, "stops": [33324]})
    fake.calls.clear()
    out = poller.poll_once(_db(settings), fake, BASE)
    assert out["codes"] == 2 and out["fetched"] == 2
    assert fake.count("/gtfs_ride_stops/list") == 2  # not 3 screens x 2 stops
    assert fake.count("/gtfs_stops/list") == 2  # the day's ids, once per code
    fake.calls.clear()
    poller.poll_once(_db(settings), fake, BASE + dt.timedelta(minutes=1))
    assert fake.count("/gtfs_stops/list") == 0 and fake.count("/gtfs_ride_stops/list") == 2  # the ids are kept for the day


def test_the_fetched_window_is_wider_than_any_display_window(client, settings):
    fake = FakeStride(BASE)
    catalogue.refresh(_db(settings), fake, BASE, dt.date(2026, 10, 26))
    _on(client)
    _board(client, "a", {"window_min": 30})
    _board(client, "b", {"window_min": 120})
    poller.poll_once(_db(settings), fake, BASE)
    _, params = [c for c in fake.calls if c[0] == "/gtfs_ride_stops/list"][-1]
    to = stride.parse_time(params["arrival_time_to"])
    assert to - BASE == dt.timedelta(minutes=120 + poller.EXTRA_MIN)
    with _db(settings).connection(mode="read") as conn:
        row = conn.execute("SELECT fetched_at, rows_json FROM transit_cache WHERE code = 33323").fetchone()
    assert row["fetched_at"] == "2026-10-26T06:00:00Z" and len(json.loads(row["rows_json"])) == 5  # 6 rows - the terminus one; the 96 min one is inside 120+90


def test_nothing_is_fetched_without_a_reason(client, settings):
    fake = FakeStride(BASE)
    db = _db(settings)
    assert poller.poll_once(db, fake, BASE)["skipped"] == "idle"
    _on(client)  # module on, no board shows transit
    client.post(f"{API}/notices/boards", json={"name": "x", "slug": "plain"})
    assert poller.poll_once(db, fake, BASE)["skipped"] == "idle"
    bid, _ = _board(client, "t")
    assert poller.poll_once(db, fake, BASE)["fetched"] == 1
    client.patch(f"{API}/notices/boards/{bid}", json={"enabled": False})
    fake.calls.clear()
    assert poller.poll_once(db, fake, BASE)["skipped"] == "idle" and not fake.calls  # a disabled board needs nothing
    client.patch(f"{API}/notices/boards/{bid}", json={"enabled": True})
    client.patch(f"{API}/notices/settings", json={"enabled": False})
    assert poller.poll_once(db, fake, BASE)["skipped"] == "idle"  # the board module off
    client.patch(f"{API}/notices/settings", json={"enabled": True})
    client.put(f"{API}/transit/settings", json={"enabled": False})
    assert poller.poll_once(db, fake, BASE)["skipped"] == "idle"  # the transit module off


def test_the_breaker_backs_off_1_2_4_8_minutes_and_recovers(client, settings):
    fake = FakeStride(BASE)
    catalogue.refresh(_db(settings), fake, BASE, dt.date(2026, 10, 26))
    _on(client)
    _board(client)
    db = _db(settings)
    fake.fail = stride.StrideError("http_503")
    t = BASE
    for expect in (60, 120, 240, 480, 480):
        assert poller.poll_once(db, fake, t)["error"] == "http_503"
        assert poller.HEALTH.backoff_until - t == dt.timedelta(seconds=expect)
        n = len(fake.calls)
        assert poller.poll_once(db, fake, t + dt.timedelta(seconds=expect - 1))["skipped"] == "backoff" and len(fake.calls) == n  # no call while it is open
        t = t + dt.timedelta(seconds=expect)
    fake.fail = None
    assert poller.poll_once(db, fake, t)["fetched"] == 1
    v = poller.HEALTH.view()
    assert v["consecutive_errors"] == 0 and v["errors"] == 5 and v["backoff_until"] is None and v["last_ok_at"] == "2026-10-26T06:23:00Z"


def test_a_bad_row_shape_is_a_source_failure_not_a_crash(client, settings):
    fake = FakeStride(BASE)
    catalogue.refresh(_db(settings), fake, BASE, dt.date(2026, 10, 26))
    _on(client)
    _board(client)
    db = _db(settings)
    poller.poll_once(db, fake, BASE)

    def broken(path, params):
        return {"detail": "oops"} if path == "/gtfs_ride_stops/list" else fake(path, params)

    assert poller.poll_once(db, broken, BASE + dt.timedelta(minutes=2))["error"] == "bad_shape"
    with db.connection(mode="read") as conn:  # the last good rows are still there
        assert conn.execute("SELECT fetched_at FROM transit_cache WHERE code = 33323").fetchone()[0] == "2026-10-26T06:00:00Z"


def test_a_missing_destination_is_looked_up_once_per_ride(client, settings):
    fake = FakeStride(BASE)
    fake.rides[49655060][0]["gtfs_route__route_long_name"] = "no marker here"
    catalogue.refresh(_db(settings), fake, BASE, dt.date(2026, 10, 26))
    _on(client)
    _board(client)
    poller.poll_once(_db(settings), fake, BASE)
    poller.poll_once(_db(settings), fake, BASE + dt.timedelta(minutes=1))
    assert sum(1 for p, a in fake.calls if p == "/gtfs_ride_stops/list" and "gtfs_ride_ids" in a) == 1
    d = _digest(settings, BASE + dt.timedelta(minutes=1), {"enabled": True})
    assert d["items"][0]["dest"] == "בית גיל הזהב/השקד"


def test_a_stop_unknown_today_is_not_the_sources_failure(client, settings):
    fake = FakeStride(BASE)
    catalogue.refresh(_db(settings), fake, BASE, dt.date(2026, 10, 26))
    _on(client, stops=(33323, 11111))
    fake.stops = [s for s in fake.stops if s["code"] != 11111]
    _board(client)
    out = poller.poll_once(_db(settings), fake, BASE)
    assert out["error"] is None and poller.HEALTH.consecutive == 0


# ---------------------------------------------------------------- the digest

def test_a_fresh_digest_gives_local_times_minutes_and_the_window(client, settings):
    fake, _ = _loaded(client, settings, stops=(33323,))
    d = _digest(settings, BASE, {"enabled": True, "window_min": 60, "rows": 5})
    assert d["state"] == "fresh" and d["age_s"] == 0 and d["realtime"] is False and d["multi"] is False
    assert [(i["line"], i["hm"], i["mins"]) for i in d["items"]] == [("25", "08:04", 4), ("28", "08:12", 12), ("25", "08:34", 34)]  # UTC+2, 60 min window
    assert d["items"][0]["dest"] == "בית גיל הזהב/השקד" and d["items"][0]["at"] == "2026-10-26T06:04:30Z"
    assert d["stops"] == [{"code": 33323, "name": "שדרות חיים וייצמן/הרצל"}] and d["overflow"] == 0 and d["grouped"] is False
    assert d["next"] is None  # the window has buses


def test_passed_rows_are_dropped_and_the_walking_offset_hides_close_buses(client, settings):
    _loaded(client, settings, hide_closer_min=5)
    d = _digest(settings, BASE, {"enabled": True})
    assert [i["hm"] for i in d["items"]] == ["08:12", "08:34"]  # 08:04 is closer than 5 minutes
    later = _digest(settings, BASE + dt.timedelta(seconds=30), {"enabled": True, "window_min": 15})  # age 30 s: still fresh
    assert [i["hm"] for i in later["items"]] == ["08:12"]
    assert _digest(settings, BASE + dt.timedelta(minutes=2), {"enabled": True})["items"][0]["hm"] == "08:12"
    passed = _digest(settings, BASE + dt.timedelta(minutes=13), {"enabled": True, "window_min": 30})
    assert all(i["hm"] != "08:12" for i in passed["items"])  # an arrival in the past never shows (and the state is cached by now)


def test_the_age_decides_fresh_cached_expired(client, settings):
    _loaded(client, settings)
    st = lambda secs: _digest(settings, BASE + dt.timedelta(seconds=secs), {"enabled": True})  # noqa: E731
    assert st(0)["state"] == "fresh" and st(180)["state"] == "fresh"
    c = st(181)
    assert c["state"] == "cached" and c["updated_hm"] == "08:00" and c["items"] and c["fetched_at"] == "2026-10-26T06:00:00Z" and c["age_s"] == 181
    assert st(30 * 60)["state"] == "cached"
    e = st(30 * 60 + 1)
    assert e["state"] == "expired" and "items" not in e and e["stale_grace_min"] == 30


def test_the_grace_is_configurable_and_zero_means_no_last_known(client, settings):
    _loaded(client, settings, stale_grace_min=0)
    assert _digest(settings, BASE + dt.timedelta(seconds=181), {"enabled": True})["state"] == "expired"
    client.put(f"{API}/transit/settings", json={"stale_grace_min": 120})
    assert _digest(settings, BASE + dt.timedelta(minutes=119), {"enabled": True})["state"] == "cached"
    assert _digest(settings, BASE + dt.timedelta(minutes=121), {"enabled": True})["state"] == "expired"


def test_never_fetched_is_expired_and_off_states_are_off(client, settings):
    catalogue.refresh(_db(settings), FakeStride(BASE), BASE, dt.date(2026, 10, 26))
    _on(client)
    _board(client)
    d = _digest(settings, BASE, {"enabled": True})
    assert d["state"] == "expired" and d["fetched_at"] is None and d["age_s"] is None
    assert _digest(settings, BASE, {"enabled": False}) == {"state": "off"}
    client.put(f"{API}/transit/settings", json={"enabled": False})
    assert _digest(settings, BASE, {"enabled": True}) == {"state": "off"}
    client.put(f"{API}/transit/settings", json={"enabled": True, "stops": []})
    assert _digest(settings, BASE, {"enabled": True}) == {"state": "off"}  # nothing configured


def test_no_buses_in_the_window_gives_the_next_bus(client, settings):
    _loaded(client, settings)
    t = BASE + dt.timedelta(seconds=40)
    d = _digest(settings, t, {"enabled": True, "window_min": 5, "rows": 3})
    assert d["items"] == [] or [i["hm"] for i in d["items"]] == ["08:04"]
    q = _digest(settings, t, {"enabled": True, "window_min": 5, "rows": 3})
    assert q["items"][0]["hm"] == "08:04"
    quiet = digest.build  # a window with nothing in it: the screen is asked for 5 minutes at 08:05 (the 08:04 bus has gone)
    with _db(settings).connection(mode="read") as conn:
        r = quiet(conn, model.normalize_screen({"enabled": True, "window_min": 5}), BASE + dt.timedelta(minutes=5), TZ)
    assert r["items"] == [] and r["next"]["line"] == "28" and r["next"]["hm"] == "08:12" and r["next"]["mins"] == 7


def test_rows_overflow_and_grouping_auto_always_never(client, settings):
    fake = FakeStride(BASE)
    for k in range(4):  # many arrivals of the same two lines
        fake.rides[49655060].append(__import__("transit_fake").ride_row(100 + k, BASE + dt.timedelta(minutes=40 + 5 * k), "25", __import__("transit_fake").LONG_25))
    _loaded(client, settings, fake, stops=(33323,))
    flat = _digest(settings, BASE, {"enabled": True, "window_min": 120, "rows": 4, "group": "never"})
    assert flat["grouped"] is False and len(flat["items"]) == 4 and flat["overflow"] == 5  # 9 arrivals inside 120 minutes
    auto = _digest(settings, BASE, {"enabled": True, "window_min": 120, "rows": 4, "group": "auto"})
    assert auto["grouped"] is True  # more arrivals than rows
    assert [(i["line"], len(i["more"])) for i in auto["items"]] == [("25", 2), ("28", 1)] and auto["overflow"] == 0
    assert auto["items"][0]["hm"] == "08:04" and [m["hm"] for m in auto["items"][0]["more"]] == ["08:34", "08:40"]
    few = _digest(settings, BASE, {"enabled": True, "window_min": 15, "rows": 4, "group": "auto"})
    assert few["grouped"] is False  # fits: auto keeps single rows
    always = _digest(settings, BASE, {"enabled": True, "window_min": 15, "rows": 4, "group": "always"})
    assert always["grouped"] is True and [i["line"] for i in always["items"]] == ["25", "28"]


def test_several_stops_mark_multi_and_the_slide_layout_gets_a_column_per_stop(client, settings):
    _loaded(client, settings, stops=(33323, 33324))
    d = _digest(settings, BASE, {"enabled": True, "layout": "slide", "window_min": 15})
    assert d["multi"] is True and [i["stop"] for i in d["items"]] == [33323, 33324, 33323]  # 08:04, 08:09, 08:12 - merged by time
    assert [c["stop"] for c in d["columns"]] == [33323, 33324]
    assert [i["line"] for i in d["columns"][1]["items"]] == ["11"]
    assert "columns" not in _digest(settings, BASE, {"enabled": True, "layout": "side"})
    only = _digest(settings, BASE, {"enabled": True, "stops": [33324]})
    assert [s["code"] for s in only["stops"]] == [33324] and [i["line"] for i in only["items"]] == ["11"]


def test_a_display_name_overrides_the_catalogue_name(client, settings):
    _loaded(client, settings)
    client.put(f"{API}/transit/settings", json={"stops": [{"code": 33323, "name": "תחנת הבית"}]})
    assert _digest(settings, BASE, {"enabled": True})["stops"][0]["name"] == "תחנת הבית"


# ---------------------------------------------------------------- routes and permissions

def test_settings_roundtrip_defaults_names_and_validation(client, settings):
    catalogue.refresh(_db(settings), FakeStride(BASE), BASE, dt.date(2026, 10, 26))
    got = client.get(f"{API}/transit/settings").json()
    assert got["config"]["enabled"] is False and got["config"]["stops"] == [] and got["catalogue"]["count"] == 5 and got["limits"]["max_stops"] == 4
    assert got["health"]["state"] == "off" and got["can"] == {"configure": True, "boards": True}
    put = client.put(f"{API}/transit/settings", json={"enabled": True, "stops": [{"code": 33323}, {"code": 33324, "name": "שלי"}], "clock_after_min": 90}).json()
    names = [s["name"] for s in put["config"]["stops"]]
    assert names == ["שדרות חיים וייצמן/הרצל", "שלי"] and put["config"]["clock_after_min"] == 90 and put["config"]["stops"][0]["city"] == "נתניה"
    bad = lambda body: client.put(f"{API}/transit/settings", json=body)  # noqa: E731
    assert bad({"stops": [{"code": c} for c in (33323, 33324, 51439, 11111, 57453)]}).status_code == 422  # five
    assert bad({"stops": [{"code": 99999}]}).status_code == 422  # not in the catalogue
    assert bad({"clock_after_min": 241}).status_code == 422 and bad({"stale_grace_min": -1}).status_code == 422 and bad({"colour": 1}).status_code == 422
    assert client.get(f"{API}/transit/settings").json()["config"]["clock_after_min"] == 90  # a refused save changed nothing


def test_stops_may_be_set_before_the_catalogue_exists(client, settings):
    r = client.put(f"{API}/transit/settings", json={"enabled": True, "stops": [{"code": 33323}]})
    assert r.status_code == 200 and r.json()["config"]["stops"][0]["name"] == "" and r.json()["catalogue"]["count"] == 0


def test_search_endpoints_use_the_local_catalogue_only(client, settings):
    catalogue.refresh(_db(settings), FakeStride(BASE), BASE, dt.date(2026, 10, 26))
    assert client.get(f"{API}/transit/cities").json()["cities"] == ["ירושלים", "נתניה", "תל אביב יפו"]
    r = client.get(f"{API}/transit/stops", params={"city": "נתניה", "q": "הרצל"}).json()
    assert sorted(s["code"] for s in r["stops"]) == [33323, 33324] and r["catalogue"]["count"] == 5
    assert client.get(f"{API}/transit/stops", params={"q": "x" * 61}).status_code == 422


def test_permissions_read_by_configure_or_boards_write_by_configure(client, settings):
    bind(client, settings, "dana", "viewer", "installation", "*")
    h = as_user("dana")
    for path in ("settings", "cities", "stops?q=1", "status"):
        assert client.get(f"{API}/transit/{path}", headers=h).status_code == 403
    assert client.put(f"{API}/transit/settings", json={"enabled": True}, headers=h).status_code == 403
    assert client.post(f"{API}/transit/catalogue/refresh", headers=h).status_code == 403
    assert client.get(f"{API}/transit/settings").status_code == 200  # joni (administrator)


def test_every_change_is_audited_and_the_module_switch_has_its_own_action(client, settings):
    _on(client)
    client.put(f"{API}/transit/settings", json={"clock_after_min": 45})
    client.put(f"{API}/transit/settings", json={"clock_after_min": 45})  # no change, no row
    client.put(f"{API}/transit/settings", json={"enabled": False})
    with _db(settings).connection(mode="read") as conn:
        actions = [r[0] for r in conn.execute("SELECT action FROM audit_log WHERE action LIKE 'transit.%' ORDER BY rowid").fetchall()]
    assert actions == ["transit.module.enable", "transit.settings.update", "transit.module.disable"]


def test_the_manual_catalogue_refresh_runs_in_the_background(client, settings):
    client.app.state.transit_fetch = FakeStride(BASE)
    assert client.post(f"{API}/transit/catalogue/refresh").json()["started"] is True
    from smplwise.routers import transit as router

    router._REFRESH["t"].join(5)
    assert client.get(f"{API}/transit/status").json()["catalogue"]["count"] == 5


# ---------------------------------------------------------------- the screen's route

def test_the_tv_route_serves_the_digest_with_the_board_token(client, settings):
    fake, token = _loaded(client, settings)
    n = len(fake.calls)
    r = client.get(f"{API}/notices/display/lobby/transit", headers={"X-Board-Token": token})
    assert r.status_code == 200 and r.headers["cache-control"] == "no-store"
    doc = r.json()
    assert doc["state"] in ("fresh", "cached", "expired") and doc["layout"] == "side" and "now" in doc
    assert len(fake.calls) == n  # the route never calls the third party
    blob = json.dumps(doc)
    assert not re.search(r"token|password|secret|\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b", blob)
    assert client.get(f"{API}/notices/display/lobby/transit").status_code == 404  # no token
    assert client.get(f"{API}/notices/display/lobby/transit", headers={"X-Board-Token": "x" * 30}).status_code == 404  # wrong token
    assert client.get(f"{API}/notices/display/nope/transit", headers={"X-Board-Token": token}).status_code == 404


def test_a_board_that_does_not_show_transit_gets_off(client, settings):
    _on(client)
    r = client.post(f"{API}/notices/boards", json={"name": "plain", "slug": "plain"}).json()
    got = client.get(f"{API}/notices/display/plain/transit", headers={"X-Board-Token": r["token"]})
    assert got.status_code == 200 and got.json() == {"state": "off"}


def test_the_route_is_dead_with_the_board_module_off(client, settings):
    _, token = _loaded(client, settings)
    client.patch(f"{API}/notices/settings", json={"enabled": False})
    assert client.get(f"{API}/notices/display/lobby/transit", headers={"X-Board-Token": token}).status_code == 404


def test_the_lan_listener_routes_the_digest(client, settings):
    _, token = _loaded(client, settings)
    db = _db(settings)
    svc = disp.DisplayService(lambda: db.connection(mode="read"), settings.data_dir, limiter=disp.RateLimiter(), clock=lambda: BASE)
    r = listener.route(svc, settings.www_dir, "GET", "/api/v1/notices/display/lobby/transit", {"x-board-token": token}, "1.1.1.1")
    assert r.status == 200 and json.loads(r.body)["state"] == "fresh" and json.loads(r.body)["items"]
    assert listener.route(svc, settings.www_dir, "GET", "/api/v1/notices/display/lobby/transit", {}, "1.1.1.2").status == 404
    assert listener.route(svc, settings.www_dir, "GET", "/api/v1/notices/display/lobby/transit/x", {"x-board-token": token}, "1.1.1.1").status == 404
    assert listener.route(svc, settings.www_dir, "POST", "/api/v1/notices/display/lobby/transit", {"x-board-token": token}, "1.1.1.1").status == 405


def test_the_board_patch_saves_the_screen_block_and_refuses_an_unconfigured_stop(client, settings):
    _loaded(client, settings, stops=(33323, 33324))
    bid, _ = _board(client, "second")
    ok = client.patch(f"{API}/notices/boards/{bid}", json={"display": {"transit": {"enabled": True, "layout": "strip", "stops": [33324], "window_min": 45, "rows": 6, "group": "always"}}})
    assert ok.status_code == 200 and ok.json()["board"]["display"]["transit"] == {"enabled": True, "stops": [33324], "layout": "strip", "window_min": 45, "rows": 6, "group": "always", "dwell_s": 15}
    assert client.patch(f"{API}/notices/boards/{bid}", json={"display": {"transit": {"stops": [51439]}}}).status_code == 422  # not an installation stop
    assert client.patch(f"{API}/notices/boards/{bid}", json={"display": {"transit": {"layout": "x"}}}).status_code == 422
    assert client.patch(f"{API}/notices/boards/{bid}", json={"display": {"transit": {"window_min": 3}}}).status_code == 422
    bind(client, settings, "dana", "viewer", "installation", "*")
    assert client.patch(f"{API}/notices/boards/{bid}", json={"display": {"transit": {"rows": 7}}}, headers=as_user("dana")).status_code == 403


def test_the_settings_preview_digest_uses_the_draft(client, settings):
    _loaded(client, settings)
    bid, _ = _board(client, "prev", {"layout": "side"})
    saved = client.post(f"{API}/notices/boards/{bid}/transit", json={}).json()
    assert saved["layout"] == "side"
    draft = client.post(f"{API}/notices/boards/{bid}/transit", json={"display": {"transit": {"layout": "strip", "rows": 3}}}).json()
    assert draft["layout"] == "strip" and draft["rows"] == 3
    assert client.post(f"{API}/notices/boards/{bid}/transit", json={"display": {"transit": {"layout": "q"}}}).status_code == 422
    bind(client, settings, "dana", "viewer", "installation", "*")
    assert client.post(f"{API}/notices/boards/{bid}/transit", json={}, headers=as_user("dana")).status_code == 403


# ---------------------------------------------------------------- source health, backup, no ticket action

def test_health_view_states_and_the_system_health_report(client, settings):
    db = _db(settings)
    with db.connection(mode="read") as conn:
        assert health.view(conn, BASE)["state"] == "off"
    _loaded(client, settings)
    with db.connection(mode="read") as conn:
        h = health.view(conn, BASE + dt.timedelta(seconds=10))
        assert h["state"] == "ok" and h["codes_in_use"] == 1 and h["age_s"] == 10 and h["last_ok_at"] == "2026-10-26T06:00:00Z"
        assert health.view(conn, BASE + dt.timedelta(minutes=10))["state"] == "stale"
        assert health.view(conn, BASE + dt.timedelta(minutes=40))["state"] == "down"
    poller.HEALTH.fail(BASE, "http_500")
    with db.connection(mode="read") as conn:
        h = health.view(conn, BASE + dt.timedelta(minutes=40))
    assert h["errors"] == 1 and h["last_error"] == "http_500" and h["consecutive_errors"] == 1
    report = client.get(f"{API}/health/report").json()
    check = next(c for c in report["checks"] if c["id"] == "transit")
    assert check["status"] == "warn" and check["meta"]["codes_in_use"] == 1  # data older than the grace (the wall clock is far past BASE)
    summary = client.get(f"{API}/health/summary").json()
    assert any(i["id"] == "transit" for i in summary["items"])


def test_the_health_report_has_no_transit_row_while_the_module_is_off(client, settings):
    report = client.get(f"{API}/health/report").json()
    assert all(c["id"] != "transit" for c in report["checks"])
    assert all(i["id"] != "transit" for i in client.get(f"{API}/health/summary").json()["items"])


def test_a_restore_never_carries_the_modules_switch_or_stops():
    from smplwise.services import backup

    assert {"transit.config", "transit.catalogue"} <= set(backup.SETTINGS_KEEP)


def test_there_is_no_service_ticket_action_anywhere_in_the_module():
    """Tickets module rule: bus data that goes stale shows in Settings / system health only - the module never imports or calls the tickets code."""
    root = Path(__file__).resolve().parents[1] / "smplwise"
    files = list((root / "services" / "transit").glob("*.py")) + [root / "routers" / "transit.py"]
    for f in files:
        text = f.read_text(encoding="utf-8").lower()
        assert not re.search(r"(import|from)\s+[\w. ]*ticket|create_ticket|open_ticket|tickets_rules|\.tickets|service_request", text), f.name


def test_the_screens_path_never_imports_the_http_client():
    """Nothing live-depends on the third party: only the poller module (and the manual catalogue refresh) reach `stride.http_fetch`."""
    root = Path(__file__).resolve().parents[1] / "smplwise"
    users = [p.relative_to(root).as_posix() for p in root.rglob("*.py") if "http_fetch" in p.read_text(encoding="utf-8")]
    assert sorted(users) == sorted(["routers/transit.py", "services/transit/poller.py", "services/transit/stride.py"])
    assert "stride" not in (root / "services" / "transit" / "digest.py").read_text(encoding="utf-8").replace("from . import catalogue, model, stride", "").replace("stride.parse_time", "")


def test_the_migration_creates_both_tables_and_the_number_is_after_0177(client, settings):
    with _db(settings).connection(mode="read") as conn:
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()}
        assert {"transit_stops", "transit_cache"} <= tables
        assert conn.execute("SELECT 1 FROM schema_migrations WHERE version = 179").fetchone()


# ---------------------------------------------------------------- the provider interface (a real-time provider plugs in here)

class FakeRealtime:
    """A stand-in for the real-time provider of pilot/BUSRT-295: the same `arrivals(stop_code, window_start, window_end)` contract."""

    def __init__(self, base, est_age=20):
        self.base, self.est_age, self.calls = base, est_age, []

    def arrivals(self, stop_code, window_start, window_end):
        self.calls.append((stop_code, window_start, window_end))
        z = lambda m: (self.base + dt.timedelta(minutes=m)).strftime("%Y-%m-%dT%H:%M:%SZ")  # noqa: E731
        return [{"line": "25", "dest": "א", "agency": "", "ride": 1, "at": z(10), "est": z(6), "est_age_s": self.est_age},  # early by 4 minutes
                {"line": "28", "dest": "ב", "agency": "", "ride": 2, "at": z(12), "est": None, "est_age_s": None}]


def test_the_scheduled_provider_satisfies_the_contract_and_never_estimates():
    prov = __import__("smplwise.services.transit.provider", fromlist=["x"]).ScheduledProvider(FakeStride(BASE), TZ)
    rows = prov.arrivals(33323, BASE, BASE + dt.timedelta(hours=2))
    assert rows and all(r["est"] is None and r["est_age_s"] is None and r["at"].endswith("Z") for r in rows)
    with pytest.raises(__import__("smplwise.services.transit.provider", fromlist=["x"]).UnknownStop):
        prov.arrivals(99999, BASE, BASE + dt.timedelta(hours=2))


def test_a_realtime_provider_plugs_into_the_poller_and_the_rows_carry_both_times(client, settings):
    catalogue.refresh(_db(settings), FakeStride(BASE), BASE, dt.date(2026, 10, 26))
    _on(client)
    _board(client)
    rt = FakeRealtime(BASE)
    out = poller.poll_once(_db(settings), rt, BASE)
    assert out["fetched"] == 1 and rt.calls[0][0] == 33323 and rt.calls[0][2] - BASE >= dt.timedelta(minutes=60 + poller.EXTRA_MIN)
    d = _digest(settings, BASE + dt.timedelta(seconds=10), {"enabled": True})
    a, b = d["items"][0], d["items"][1]
    assert (a["quality"], a["hm"], a["at"]) == ("realtime", "08:06", "2026-10-26T06:06:00Z")  # minutes count to the estimate
    assert a["scheduled_time"] == "2026-10-26T06:10:00Z" and a["estimated_time"] == "2026-10-26T06:06:00Z" and a["age_seconds"] == 30
    assert (b["quality"], b["estimated_time"], b["hm"]) == ("scheduled", None, "08:12") and d["realtime"] is True


def test_an_old_estimate_is_stale_and_the_schedule_is_shown(client, settings):
    catalogue.refresh(_db(settings), FakeStride(BASE), BASE, dt.date(2026, 10, 26))
    _on(client)
    _board(client)
    poller.poll_once(_db(settings), FakeRealtime(BASE, est_age=100), BASE)
    d = _digest(settings, BASE + dt.timedelta(seconds=5), {"enabled": True})
    first = d["items"][0]
    assert first["quality"] == "stale" and first["hm"] == "08:10" and first["estimated_time"] and d["realtime"] is False
    # the estimate ages with the cache: fresh at the fetch, too old a minute later
    poller.poll_once(_db(settings), FakeRealtime(BASE, est_age=20), BASE + dt.timedelta(minutes=5))
    t = BASE + dt.timedelta(minutes=5)
    assert _digest(settings, t, {"enabled": True, "window_min": 30})["items"][0]["quality"] == "realtime"
    assert _digest(settings, t + dt.timedelta(seconds=80), {"enabled": True, "window_min": 30})["items"][0]["quality"] == "stale"  # 20 + 80 s > 90 s
    # while the source is down (cache older than 3 minutes) an estimate is never trusted
    assert _digest(settings, t + dt.timedelta(minutes=4), {"enabled": True, "window_min": 30})["items"][0]["quality"] == "stale"
