"""BUSTIMES-295 (real-time slice): the engine of pilot/BUSRT-295 behind the provider interface, the estimate + distance in the digest, the
refresh controls (screen refresh / source poll) and the freshness thresholds that follow the poll cadence. A recorded fake of Stride, no live call."""
from __future__ import annotations

import datetime as dt
import json

import pytest

from test_bustimes_295 import API, BASE, _board, _clean_poller_state, _db, _digest, _on  # noqa: F401
from transit_fake import FakeStride
from smplwise.services.transit import catalogue, digest, model, poller, stride
from smplwise.services.transit.provider import RealtimeProvider


def Z(t: dt.datetime) -> str:
    return t.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class RtStride(FakeStride):
    """The scheduled fake plus the two endpoints the estimate needs: a ride's planned stop list (with `shape_dist_traveled`) and SIRI positions.
    Ride 1 (line_ref 10001) starts 20 min before BASE, reaches stop 33323 (3000 m) at BASE+4:30 and ends at 4000 m. Ride 2 has no position."""

    def __init__(self, base, *, pos_dist=2400.0, pos_age_s=60, no_positions=False):
        super().__init__(base)
        self.pos_dist, self.pos_age_s, self.no_positions = pos_dist, pos_age_s, no_positions
        self.plan = {1: [(1, -20, 0, 11111), (2, -10, 2000, 22222), (3, 4.5, 3000, 33323), (4, 12, 4000, 44444)],
                     2: [(1, -5, 0, 11111), (2, 3, 2000, 22222), (3, 12, 3000, 33323), (4, 20, 4000, 44444)]}

    def __call__(self, path, params):
        if path == "/gtfs_ride_stops/list" and "gtfs_ride_ids" in params and int(params["gtfs_ride_ids"]) in self.plan:
            self.calls.append((path, dict(params)))
            rid = int(params["gtfs_ride_ids"])
            if params.get("limit") == 1:  # the destination fallback: the last stop
                return [{"gtfs_ride_id": rid, "stop_sequence": 4, "gtfs_stop__name": "end"}]
            return [{"id": 9000 + seq, "gtfs_ride_id": rid, "arrival_time": Z(self.base + dt.timedelta(minutes=m)), "stop_sequence": seq, "pickup_type": 0,
                     "shape_dist_traveled": dist, "gtfs_stop__code": code, "gtfs_route__line_ref": 10000 + rid % 1000} for seq, m, dist, code in self.plan[rid]]
        if path == "/siri_vehicle_locations/list":
            self.calls.append((path, dict(params)))
            if self.fail is not None:
                raise self.fail
            if self.no_positions:
                return []
            rec = self.base - dt.timedelta(seconds=self.pos_age_s)
            return [{"recorded_at_time": Z(rec), "distance_from_journey_start": self.pos_dist, "siri_route__line_ref": 10001,
                     "siri_ride__scheduled_start_time": Z(self.base - dt.timedelta(minutes=20)), "siri_ride__vehicle_ref": "V1"}]
        return super().__call__(path, params)


def _rt(client, settings, fake=None, **kw):
    fake = fake or RtStride(BASE)
    catalogue.refresh(_db(settings), fake, BASE, dt.date(2026, 10, 26))
    _on(client, **kw)
    _board(client)
    out = poller.poll_once(_db(settings), fake, BASE)
    return fake, out


def _plan_calls(fake):
    return [c for c in fake.calls if c[0] == "/gtfs_ride_stops/list" and "gtfs_ride_ids" in c[1] and c[1].get("limit") != 1]


# ---------------------------------------------------------------- the engine behind the provider interface

def test_the_default_provider_is_the_realtime_one_and_rows_keep_ride_and_ride_start(client, settings):
    fake, out = _rt(client, settings)
    assert out["fetched"] == 1 and out["error"] is None
    assert isinstance(poller._PROVIDERS[id(fake)][1], RealtimeProvider)
    with _db(settings).connection(mode="read") as conn:
        rows = json.loads(conn.execute("SELECT rows_json FROM transit_cache WHERE code = 33323").fetchone()["rows_json"])
    first = rows[0]
    assert first["ride"] == 1 and first["ride_start"] == Z(BASE - dt.timedelta(minutes=20)) and first["line_ref"] == 10001  # the join key is kept per row
    assert first["est"] is not None and first["distance_m"] == pytest.approx(600.0) and first["est_age_s"] == 60


def test_the_estimate_is_derived_from_the_delay_of_the_position(client, settings):
    _rt(client, settings)
    d = _digest(settings, BASE, {"enabled": True, "window_min": 60})
    it = d["items"][0]
    # at 2400 m the plan says BASE-4.2 min, the position was recorded at BASE-1 min: 3.2 min late -> expected BASE+7.7 min instead of +4.5
    assert it["scheduled_time"] == Z(BASE + dt.timedelta(minutes=4, seconds=30))
    assert it["estimated_time"] == Z(BASE + dt.timedelta(minutes=7, seconds=42)) and it["quality"] == "realtime" and it["mins"] == 7
    assert it["position_age_s"] == 60 and it["age_seconds"] == 60 and d["realtime"] is True


def test_a_ride_without_a_position_stays_scheduled_and_carries_no_distance(client, settings):
    """The honest limit (line 25, stop 33323 close to the origin): no position exists in time, so the row is plain scheduled."""
    _rt(client, settings, RtStride(BASE, no_positions=True))
    d = _digest(settings, BASE, {"enabled": True})
    assert d["items"] and all(i["quality"] == "scheduled" and i["estimated_time"] is None and "distance_m" not in i and "position_age_s" not in i for i in d["items"])
    assert d["realtime"] is False


def test_a_failing_positions_endpoint_degrades_to_the_schedule_and_does_not_trip_the_breaker(client, settings):
    class Boom(RtStride):
        def __call__(self, path, params):
            if path == "/siri_vehicle_locations/list":
                raise stride.StrideError("http_500")
            return super().__call__(path, params)

    _, out = _rt(client, settings, Boom(BASE))
    assert out["error"] is None and out["fetched"] == 1 and not poller.HEALTH.blocked(BASE)
    assert all(i["quality"] == "scheduled" for i in _digest(settings, BASE, {"enabled": True})["items"])


def test_a_bus_that_already_passed_is_dropped(client, settings):
    _rt(client, settings, RtStride(BASE, pos_dist=3500.0))  # ride 1 is already past the stop (3000 m)
    d = _digest(settings, BASE, {"enabled": True})
    assert not [i for i in d["items"] if i["scheduled_time"] == Z(BASE + dt.timedelta(minutes=4, seconds=30))]


def test_plan_lookups_are_capped_per_pass_and_cached_for_the_day(client, settings):
    fake, _ = _rt(client, settings)
    first = _plan_calls(fake)
    assert 0 < len(first) <= 12
    fake.calls.clear()
    poller.poll_once(_db(settings), fake, BASE + dt.timedelta(seconds=40))
    seen = {c[1]["gtfs_ride_ids"] for c in first}
    assert not [c for c in _plan_calls(fake) if c[1]["gtfs_ride_ids"] in seen]  # what was read stays read for the day


# ---------------------------------------------------------------- the distance rule

@pytest.mark.parametrize("m,want", [(10, None), (24, None), (25, 50), (60, 50), (80, 100), (770, 750), (790, 800), (1049, 1000), (1050, 1100), (1230, 1200), (4960, 5000)])
def test_distance_rounds_to_50_m_under_a_km_and_to_100_m_above(m, want):
    assert digest.round_distance(m) == want


def test_distance_is_shown_only_for_a_fresh_position_and_follows_the_limit(client, settings):
    _rt(client, settings, RtStride(BASE, pos_age_s=200))  # 3.3 min old: inside the 5 min default
    it = _digest(settings, BASE, {"enabled": True})["items"][0]
    assert it["quality"] == "realtime" and it["distance_m"] == 600 and it["position_age_s"] == 200
    # 110 s later the position is 310 s old (> 5 min): no estimate, so no distance either - the scheduled time is shown
    late = _digest(settings, BASE + dt.timedelta(seconds=110), {"enabled": True})
    row = [i for i in late["items"] if i["scheduled_time"] == Z(BASE + dt.timedelta(minutes=4, seconds=30))][0]
    assert row["quality"] == "stale" and "distance_m" not in row


def test_the_freshness_limit_is_configurable(client, settings):
    _rt(client, settings, RtStride(BASE, pos_age_s=200), position_fresh_min=2)  # 200 s > 120 s
    it = _digest(settings, BASE, {"enabled": True})["items"][0]
    assert it["quality"] == "stale" and "distance_m" not in it and it["hm"] == "08:04"


def test_show_distance_installation_default_and_screen_override(client, settings):
    _rt(client, settings, RtStride(BASE), show_distance=False)
    d = _digest(settings, BASE, {"enabled": True})
    assert "distance_m" not in d["items"][0] and d["show_distance"] is False and d["items"][0]["quality"] == "realtime"  # the estimate stays
    on = _digest(settings, BASE, {"enabled": True, "show_distance": True})
    assert on["items"][0]["distance_m"] == 600 and on["show_distance"] is True


def test_scheduled_rows_never_carry_a_distance_even_when_the_provider_sends_one(client, settings):
    catalogue.refresh(_db(settings), FakeStride(BASE), BASE, dt.date(2026, 10, 26))
    _on(client)
    _board(client)

    class P:
        def arrivals(self, code, a, b):
            return [{"line": "25", "dest": "x", "agency": "", "ride": 1, "at": Z(BASE + dt.timedelta(minutes=10)), "est": None, "est_age_s": None, "distance_m": 400.0}]

    poller.poll_once(_db(settings), P(), BASE)
    it = _digest(settings, BASE, {"enabled": True})["items"][0]
    assert it["quality"] == "scheduled" and "distance_m" not in it


# ---------------------------------------------------------------- refresh controls

def test_defaults_and_ranges_of_the_refresh_controls():
    d = model.normalize_config({})
    assert (d["poll_s"], d["refresh_s"], d["position_fresh_min"], d["show_distance"], d["poll_floor_ack"]) == (30, 20, 5, True, False)
    for bad in ({"refresh_s": 9}, {"refresh_s": 121}, {"poll_s": 14}, {"poll_s": 301}, {"position_fresh_min": 0}, {"position_fresh_min": 31}, {"show_distance": "yes"}):
        with pytest.raises(model.Invalid):
            model.normalize_config(bad, strict=True)
    assert model.normalize_config({"refresh_s": 10, "poll_s": 300, "position_fresh_min": 30}, strict=True)["poll_s"] == 300
    s = model.normalize_screen({"refresh_s": 15, "show_distance": False}, strict=True)
    assert s["refresh_s"] == 15 and s["show_distance"] is False and model.normalize_screen({})["refresh_s"] is None
    for bad in ({"refresh_s": 5}, {"refresh_s": 200}, {"show_distance": "no"}):
        with pytest.raises(model.Invalid):
            model.normalize_screen(bad, strict=True)
    assert model.normalize_screen({"refresh_s": None, "show_distance": None}, strict=True)["refresh_s"] is None


def test_the_stride_floor_of_30_s_needs_a_knowing_owner():
    with pytest.raises(model.Invalid) as e:
        model.normalize_config({"poll_s": 20}, strict=True)
    assert e.value.field == "poll_s"
    ok = model.normalize_config({"poll_s": 20, "poll_floor_ack": True}, strict=True)
    assert model.poll_s(ok) == 20
    assert model.poll_s(model.normalize_config({"poll_s": 20})) == 30  # a stored value under the floor without the confirmation is lifted when used


def test_the_api_saves_validates_and_audits_the_controls(client, settings):
    _on(client)
    r = client.put(f"{API}/transit/settings", json={"refresh_s": 25, "poll_s": 45, "position_fresh_min": 8, "show_distance": False})
    assert r.status_code == 200, r.text
    c = r.json()["config"]
    assert (c["refresh_s"], c["poll_s"], c["position_fresh_min"], c["show_distance"]) == (25, 45, 8, False)
    lim = r.json()["limits"]
    assert lim["poll_range"] == [15, 300] and lim["poll_floor_s"] == 30 and lim["refresh_range"] == [10, 120]
    assert client.put(f"{API}/transit/settings", json={"poll_s": 20}).status_code == 422  # under the floor without the confirmation
    assert client.put(f"{API}/transit/settings", json={"refresh_s": 5}).status_code == 422
    assert client.put(f"{API}/transit/settings", json={"poll_s": 20, "poll_floor_ack": True}).status_code == 200
    with _db(settings).connection(mode="read") as conn:
        rows = conn.execute("SELECT details_json FROM audit_log WHERE action = 'transit.settings.update'").fetchall()
    keys = {k for row in rows for k in json.loads(row["details_json"])["keys"]}
    assert {"refresh_s", "poll_s", "show_distance", "position_fresh_min"} <= keys


def test_the_board_patch_validates_the_screen_controls(client, settings):
    _on(client)
    bid, _ = _board(client)
    ok = client.patch(f"{API}/notices/boards/{bid}", json={"display": {"transit": {"enabled": True, "refresh_s": 15, "show_distance": False}}})
    assert ok.status_code == 200, ok.text
    assert client.patch(f"{API}/notices/boards/{bid}", json={"display": {"transit": {"enabled": True, "refresh_s": 3}}}).status_code == 422


def test_the_digest_tells_the_screen_its_refresh_and_the_thresholds(client, settings):
    _rt(client, settings, refresh_s=40)
    d = _digest(settings, BASE, {"enabled": True})
    assert d["refresh_s"] == 40 and d["fresh_s"] == 180 and d["position_fresh_s"] == 300
    assert _digest(settings, BASE, {"enabled": True, "refresh_s": 12})["refresh_s"] == 12  # the screen's own value wins


def test_the_poll_interval_follows_the_setting_and_fresh_follows_the_cadence(client, settings):
    _on(client, poll_s=120)
    assert poller.Poller._interval(_db(settings)) == 120.0
    with _db(settings).connection(mode="read") as conn:
        cfg = poller.load_config(conn)
    assert model.fresh_s(cfg) == 360  # 3 x the poll interval, never under 3 minutes
    assert model.fresh_s(model.normalize_config({"poll_s": 30})) == 180


def test_a_slower_poll_keeps_the_digest_fresh_longer(client, settings):
    _rt(client, settings, poll_s=120)
    assert _digest(settings, BASE + dt.timedelta(minutes=5), {"enabled": True})["state"] == "fresh"   # 300 s <= 360 s
    assert _digest(settings, BASE + dt.timedelta(minutes=7), {"enabled": True})["state"] == "cached"  # 420 s > 360 s


def test_the_engine_is_asked_at_the_poll_cadence(client, settings):
    fake, _ = _rt(client, settings, poll_s=45)
    n0 = fake.count("/siri_vehicle_locations/list")  # one request per line at the stop
    assert n0 > 0
    poller.poll_once(_db(settings), fake, BASE + dt.timedelta(seconds=10))  # inside 0.8 x 45 s: the engine answers from its cache
    assert fake.count("/siri_vehicle_locations/list") == n0
    poller.poll_once(_db(settings), fake, BASE + dt.timedelta(seconds=40))  # past it: the source is asked again
    assert fake.count("/siri_vehicle_locations/list") == 2 * n0


def test_a_null_distance_on_the_first_stop_is_the_origin_not_a_dropped_point():
    """Live finding: the first stop of a ride has shape_dist_traveled null. Dropping it made a bus 500 m from the origin look ~3 minutes early."""
    from smplwise.services.transit_realtime.delay import delay_s
    from smplwise.services.transit_realtime.stride import PlanStore

    t0 = BASE - dt.timedelta(minutes=20)
    rows = [{"stop_sequence": 1, "arrival_time": Z(t0), "shape_dist_traveled": None, "gtfs_stop__code": 11111, "pickup_type": 0},
            {"stop_sequence": 2, "arrival_time": Z(t0 + dt.timedelta(minutes=10)), "shape_dist_traveled": 1000, "gtfs_stop__code": 22222, "pickup_type": 0},
            {"stop_sequence": 3, "arrival_time": Z(t0 + dt.timedelta(minutes=20)), "shape_dist_traveled": 3000, "gtfs_stop__code": 33323, "pickup_type": 0}]
    plans = PlanStore(lambda path, params: rows)
    rp = plans.ride(1, 33323)
    assert rp.plan.dist[0] == 0.0 and rp.plan.dist == (0.0, 1000.0, 3000.0)
    # a bus 500 m from the origin, on time (planned 5 min after the start): delay 0, not ~-5 min
    assert abs(delay_s(rp.plan, 500.0, (t0 + dt.timedelta(minutes=5)).timestamp())) < 1
    # a null on a later stop is still dropped (not invented)
    rows[1]["shape_dist_traveled"] = None
    assert PlanStore(lambda path, params: rows).ride(1, 33323).plan.dist == (0.0, 3000.0)
