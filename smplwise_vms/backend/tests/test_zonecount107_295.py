"""ZONECOUNT107-295 slice 1 (docs/changes/CR-ZONECOUNT107.md): people count per area from Frigate review items. Fake review items only - no
Frigate, NVR or go2rtc is contacted. Covers the zone mapping, count up / down, stale expiry, the unknown state, the time series (change +
heartbeat), retention purge and cap, the event-path hook, the permission / area scope of the routes and the OFF switch."""
from __future__ import annotations

import datetime as dt
import sys
import threading
import time
from pathlib import Path

import pytest

from smplwise.db import Database, now_iso
from smplwise.services import events_ingest, rules
from smplwise.services import zone_counts as zc
from smplwise.services.recorders import frigate_events as fe

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from conftest import as_user, bind  # noqa: E402
from fake_frigate import review  # noqa: E402

RID = "nvr-z"
UTC = dt.timezone.utc
API = "/api/v1/occupancy"


def utcnow() -> dt.datetime:
    return dt.datetime.now(UTC)


class World:
    def __init__(self, client, settings) -> None:
        self.client, self.settings = client, settings
        client.get("/api/v1/me")  # creates the schema and the bootstrap administrator
        self.db = Database(settings.db_path)
        now = now_iso()
        with self.db.connection() as conn:
            conn.execute("INSERT INTO recorders(id, name, created_at) VALUES (?, 'Frigate', ?)", (RID, now))
            conn.execute("UPDATE recorders SET vendor = 'frigate' WHERE id = ?", (RID,))
            for i, key in enumerate(("cam_front", "cam_yard", "cam_hall"), start=1):
                conn.execute("INSERT INTO cameras(id, recorder_id, channel, name_source, source_ref, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
                             (f"cid{i}", RID, i, key, key, now, now))
            for aid, name in (("lobby", "Lobby"), ("yard", "Yard")):
                conn.execute("INSERT INTO ha_areas(area_id, name, position, updated_at) VALUES (?,?,0,?)", (aid, name, now))
        self.fresh()

    def conn(self):
        return self.db.connection()

    def fresh(self, at: str | None = None, error: str | None = None) -> None:
        with self.conn() as conn:
            conn.execute("INSERT INTO frigate_sync_state(recorder_id, last_poll_at, last_poll_error) VALUES (?,?,?) ON CONFLICT(recorder_id) DO UPDATE SET "
                         "last_poll_at = excluded.last_poll_at, last_poll_error = excluded.last_poll_error", (RID, at or now_iso(), error))

    def map(self, cam: str, zone: str, area: str) -> None:
        with self.conn() as conn:
            zc.add_mapping(conn, recorder_id=RID, camera_key=cam, frigate_zone=zone, area_id=area, actor="t")

    def review(self, rid: str, cam: str, end: float | None = None, objects=("person",), zones=(), severity="detection") -> None:
        start = time.time() - 30
        item = review(rid, cam, start, end, severity=severity, objects=objects, zones=zones)
        with self.conn() as conn:
            fe.apply_review(conn, RID, item, fe._camera_lookup(conn, RID))

    def counts(self, now: dt.datetime | None = None) -> dict:
        with self.db.connection(mode="read") as conn:
            return zc.current_counts(conn, now)

    def set(self, key: str, value: str) -> None:
        from smplwise.db import set_setting

        with self.conn() as conn:
            set_setting(conn, key, value)

    def samples(self, area: str | None = None) -> list[tuple]:
        with self.db.connection(mode="read") as conn:
            sql, args = ("SELECT area_id, at, count FROM zone_count_samples" + (" WHERE area_id = ?" if area else "") + " ORDER BY id"), ((area,) if area else ())
            return [tuple(r) for r in conn.execute(sql, args).fetchall()]


@pytest.fixture()
def w(client, settings) -> World:
    return World(client, settings)


# ---------------------------------------------------------------------------------------------- mapping and counting

def test_zone_mapping_counts_people_per_area(w):
    w.map("cam_front", "lobby_zone", "lobby")
    w.map("cam_yard", "", "yard")                      # the whole camera view
    w.review("r1", "cam_front", zones=("lobby_zone",))
    w.review("r2", "cam_front", zones=("other_zone",))  # a zone that is not mapped: not counted
    w.review("r3", "cam_yard", zones=())               # whole-camera mapping needs no zone
    w.review("r4", "cam_hall", zones=("lobby_zone",))  # an unmapped camera: not counted
    assert w.counts() == {"lobby": 1, "yard": 1}


def test_count_goes_up_and_down(w):
    w.map("cam_front", "", "lobby")
    assert w.counts() == {"lobby": 0}
    w.review("a", "cam_front")
    w.review("b", "cam_front", objects=("person", "person", "car"))
    assert w.counts() == {"lobby": 3}                  # 1 + 2 persons; the car is not counted
    w.review("b", "cam_front", end=time.time() - 1, objects=("person", "person"))  # Frigate closed it
    assert w.counts() == {"lobby": 1}
    w.review("a", "cam_front", end=time.time() - 1)
    assert w.counts() == {"lobby": 0}


def test_only_people_count(w):
    w.map("cam_front", "", "lobby")
    w.review("c", "cam_front", objects=("car", "dog"))
    assert w.counts() == {"lobby": 0}


def test_two_cameras_of_one_area_are_summed_and_one_review_counts_once_per_area(w):
    w.map("cam_front", "", "lobby")
    w.map("cam_yard", "", "lobby")
    w.map("cam_front", "z1", "lobby")                  # the same area through two mappings of one camera: still once per review
    w.review("a", "cam_front", zones=("z1",))
    w.review("b", "cam_yard")
    assert w.counts() == {"lobby": 2}                  # no de-duplication across cameras in slice 1 (documented)


def test_a_review_in_two_mapped_zones_counts_in_both_areas(w):
    w.map("cam_front", "z1", "lobby")
    w.map("cam_front", "z2", "yard")
    w.review("a", "cam_front", zones=("z1", "z2"))
    assert w.counts() == {"lobby": 1, "yard": 1}


def test_stale_open_review_expires(w):
    w.map("cam_front", "", "lobby")
    w.review("a", "cam_front")
    assert w.counts() == {"lobby": 1}
    with w.conn() as conn:
        conn.execute("UPDATE frigate_reviews SET last_seen_at = ?", (zc._iso(utcnow() - dt.timedelta(seconds=zc.REVIEW_STALE_S + 5)),))
    assert w.counts() == {"lobby": 0}                  # never seen again: it stops counting, it does not linger


def test_source_not_fresh_is_unknown_not_zero(w):
    w.map("cam_front", "", "lobby")
    w.review("a", "cam_front")
    w.fresh(at=zc._iso(utcnow() - dt.timedelta(seconds=zc.SOURCE_FRESH_S + 5)))
    assert w.counts() == {"lobby": None}
    w.fresh(error="source_unreachable")
    assert w.counts() == {"lobby": None}
    with w.conn() as conn:
        conn.execute("DELETE FROM frigate_sync_state")
    assert w.counts() == {"lobby": None}
    w.fresh()
    assert w.counts() == {"lobby": 1}


def test_mapping_validation(w):
    with w.conn() as conn:
        with pytest.raises(Exception) as e:
            zc.add_mapping(conn, recorder_id=RID, camera_key="nope", frigate_zone="", area_id="lobby", actor=None)
        assert getattr(e.value, "code", "") == "camera_not_found"
        with pytest.raises(Exception) as e:
            zc.add_mapping(conn, recorder_id=RID, camera_key="cam_front", frigate_zone="", area_id="nope", actor=None)
        assert getattr(e.value, "code", "") == "area_not_found"
    w.map("cam_front", "", "lobby")
    with w.conn() as conn:
        with pytest.raises(Exception) as e:
            zc.add_mapping(conn, recorder_id=RID, camera_key="cam_front", frigate_zone="", area_id="yard", actor=None)
        assert getattr(e.value, "code", "") == "mapping_exists"


# ---------------------------------------------------------------------------------------------- the series

def test_sampling_writes_on_change_and_on_heartbeat_only(w):
    w.map("cam_front", "", "lobby")
    t0 = utcnow()
    with w.conn() as conn:
        assert zc.sample(conn, t0) == 0                # OFF: nothing is written
    assert w.samples() == []
    w.set(zc.ENABLED, "on")
    with w.conn() as conn:
        assert zc.sample(conn, t0) == 1                # first value (0)
        assert zc.sample(conn, t0 + dt.timedelta(seconds=30)) == 0   # unchanged, inside the heartbeat
    w.review("a", "cam_front")
    with w.conn() as conn:
        assert zc.sample(conn, t0 + dt.timedelta(seconds=60)) == 1   # 1 person
        conn.execute("UPDATE zone_count_samples SET at = ? WHERE id = (SELECT MAX(id) FROM zone_count_samples)", (zc._iso(t0 - dt.timedelta(seconds=zc.HEARTBEAT_S + 1)),))
        assert zc.sample(conn, t0 + dt.timedelta(seconds=61)) == 1   # unchanged but its last row is older than the heartbeat: written again
    assert [c for _, _, c in w.samples()] == [0, 1, 1]


def test_unknown_is_recorded_as_null(w):
    w.map("cam_front", "", "lobby")
    w.set(zc.ENABLED, "on")
    w.fresh(at=zc._iso(utcnow() - dt.timedelta(hours=1)))
    with w.conn() as conn:
        zc.sample(conn)
    assert [c for _, _, c in w.samples()] == [None]


def test_retention_purge_and_cap_and_unmapped_areas(w, monkeypatch):
    w.map("cam_front", "", "lobby")
    w.set(zc.ENABLED, "on")
    w.set(zc.RETENTION, "2")
    now = utcnow()
    with w.conn() as conn:
        for hours, n in ((72, 1), (47, 2), (1, 3)):
            conn.execute("INSERT INTO zone_count_samples(area_id, at, count) VALUES ('lobby', ?, ?)", (zc._iso(now - dt.timedelta(hours=hours)), n))
        conn.execute("INSERT INTO zone_count_samples(area_id, at, count) VALUES ('gone', ?, 4)", (zc._iso(now),))   # an area that is no longer mapped
        assert zc.prune(conn, now) == 2
    assert [c for _, _, c in w.samples()] == [2, 3]
    monkeypatch.setattr(zc, "MAX_SAMPLES_PER_AREA", 5)
    with w.conn() as conn:
        for i in range(10):
            conn.execute("INSERT INTO zone_count_samples(area_id, at, count) VALUES ('lobby', ?, ?)", (zc._iso(now - dt.timedelta(minutes=10 - i)), 10 + i))
        zc.prune(conn, now)
    assert [c for _, _, c in w.samples()] == [15, 16, 17, 18, 19]   # the newest 5 survive


def test_the_event_path_feeds_the_series(w, monkeypatch):
    """A frame batch through the real Frigate frame handler writes a sample (the hook), and a switched-off feature writes none."""
    published: list = []
    monkeypatch.setattr(events_ingest, "publish", lambda ev: published.append(ev))
    monkeypatch.setattr(rules, "evaluate_event", lambda conn, ev, tz, deliver=True: [])

    class Listener:
        def __init__(self, db) -> None:
            self.db, self.recorder_id, self.state = db, RID, events_ingest.IngestState()
            self.stop, self.tz_getter = threading.Event(), (lambda: "Asia/Jerusalem")

    w.map("cam_front", "", "lobby")
    item = review("fr1", "cam_front", time.time() - 20, None, severity="alert", objects=("person",))
    fe._apply_frames(Listener(w.db), [item], [], time.time())
    assert w.samples() == []                           # OFF
    w.set(zc.ENABLED, "on")
    item2 = review("fr2", "cam_front", time.time() - 10, None, severity="alert", objects=("person",))
    fe._apply_frames(Listener(w.db), [item2], [], time.time())
    assert [c for _, _, c in w.samples()] == [2]


def test_no_personal_data_in_the_tables(w):
    with w.db.connection(mode="read") as conn:
        cols = {t: [r["name"] for r in conn.execute(f"PRAGMA table_info({t})").fetchall()] for t in ("zone_count_map", "zone_count_samples")}
    assert cols["zone_count_samples"] == ["id", "area_id", "at", "count"]
    assert not {"review_id", "detections", "label", "name", "thumb"} & set(cols["zone_count_map"] + cols["zone_count_samples"])


# ---------------------------------------------------------------------------------------------- the routes

def _enable(w, retention: int | None = None) -> None:
    body = {"enabled": True, **({"retention_days": retention} if retention else {})}
    r = w.client.put(f"{API}/settings", json=body)
    assert r.status_code == 200, r.text


def test_routes_are_off_by_default(w):
    w.map("cam_front", "", "lobby")
    r = w.client.get(f"{API}/areas")
    assert r.status_code == 409 and r.json()["code"] =="occupancy_disabled"
    assert w.client.get(f"{API}/areas/lobby").status_code == 409
    s = w.client.get(f"{API}/settings").json()
    assert s["enabled"] is False and s["retention_days"] == zc.RETENTION_DEFAULT and s["mappings"] == 1


def test_current_count_and_series_over_the_api(w):
    _enable(w)
    r = w.client.post(f"{API}/mappings", json={"recorder_id": RID, "camera_key": "cam_front", "area_id": "lobby"})
    assert r.status_code == 201, r.text
    w.review("a", "cam_front")
    w.review("b", "cam_front")
    with w.conn() as conn:
        zc.sample(conn)
    body = w.client.get(f"{API}/areas").json()
    assert body["items"] == [{"area_id": "lobby", "name": "Lobby", "count": 2, "known": True}]
    one = w.client.get(f"{API}/areas/lobby?hours=6").json()
    assert one["count"] == 2 and one["series"]["points"][-1]["count"] == 2 and one["series"]["max"] == 2 and one["series"]["hours"] == 6
    assert w.client.get(f"{API}/areas/nowhere").status_code == 404
    assert w.client.get(f"{API}/areas/lobby?hours=0").status_code == 422
    # nothing about a person or a Frigate id is in the answer
    text = w.client.get(f"{API}/areas/lobby").text
    assert "person" not in text and "review" not in text and RID not in text


def test_unknown_count_is_null_over_the_api(w):
    _enable(w)
    w.map("cam_front", "", "lobby")
    w.fresh(at=zc._iso(utcnow() - dt.timedelta(hours=1)))
    item = w.client.get(f"{API}/areas").json()["items"][0]
    assert item["count"] is None and item["known"] is False


def test_permission_and_area_scope(w):
    _enable(w)
    w.map("cam_front", "", "lobby")                    # lobby <- cam_front only
    w.map("cam_front", "yard_zone", "yard")            # yard  <- cam_front (one zone) and cam_yard
    w.map("cam_yard", "", "yard")
    # a user with no occupancy.view anywhere: nothing listed, a detail answers 404, configuration is refused
    bind(w.client, w.settings, "viewer1", "viewer", "installation", "*")
    h = as_user("viewer1")
    assert w.client.get(f"{API}/areas", headers=h).json()["items"] == []
    assert w.client.get(f"{API}/areas/lobby", headers=h).status_code == 404
    assert w.client.get(f"{API}/settings", headers=h).status_code == 403
    assert w.client.put(f"{API}/settings", json={"enabled": False}, headers=h).status_code == 403
    assert w.client.post(f"{API}/mappings", json={"recorder_id": RID, "camera_key": "cam_hall", "area_id": "lobby"}, headers=h).status_code == 403
    # a holder of occupancy.view on ONE camera sees only the areas that camera alone feeds
    bind(w.client, w.settings, "scoped", "system_admin", "camera", "cid1")
    h2 = as_user("scoped")
    assert [i["area_id"] for i in w.client.get(f"{API}/areas", headers=h2).json()["items"]] == ["lobby"]
    assert w.client.get(f"{API}/areas/lobby", headers=h2).status_code == 200
    assert w.client.get(f"{API}/areas/yard", headers=h2).status_code == 404
    # the installation-wide administrator sees both
    assert sorted(i["area_id"] for i in w.client.get(f"{API}/areas").json()["items"]) == ["lobby", "yard"]
    # a deny binding on the camera takes the area away again
    from smplwise.db import new_id, permission_revision

    with w.conn() as conn:
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                     "VALUES (?, 'user', 'dev-scoped', 'system_admin', 'camera', 'cid1', 'deny', ?, 'test', ?)", (new_id(), permission_revision(conn), now_iso()))
    assert w.client.get(f"{API}/areas", headers=h2).json()["items"] == []


def test_switching_off_deletes_the_samples_and_stops_collecting(w):
    _enable(w)
    w.map("cam_front", "", "lobby")
    with w.conn() as conn:
        zc.sample(conn)
    assert len(w.samples()) == 1
    r = w.client.put(f"{API}/settings", json={"enabled": False})
    assert r.status_code == 200 and r.json()["enabled"] is False
    assert w.samples() == []
    with w.conn() as conn:
        assert zc.sample(conn) == 0
    assert w.samples() == []
    assert w.client.get(f"{API}/areas").status_code == 409
    with w.db.connection(mode="read") as conn:         # the mapping stays: switching on again needs no re-entry
        assert conn.execute("SELECT COUNT(*) FROM zone_count_map").fetchone()[0] == 1


def test_m2_janitor_deletes_leftover_samples_while_off_and_prunes_while_on(w):
    """REL2140 review M-2: a switch turned off without the PUT delete (a restore of an older build, a direct write) left the samples with no
    end date, because `prune` ran only inside `sample`, which needs the switch on. The janitor now deletes them while off."""
    w.map("cam_front", "", "lobby")
    now = utcnow()
    with w.conn() as conn:
        for hours in (200, 1):
            conn.execute("INSERT INTO zone_count_samples(area_id, at, count) VALUES ('lobby', ?, 1)", (zc._iso(now - dt.timedelta(hours=hours)),))
    assert zc.janitor(w.db, now) == 2                  # OFF: every sample goes
    assert w.samples() == []
    assert zc.janitor(w.db, now) == 0                  # nothing left, nothing to do
    w.set(zc.ENABLED, "on")
    zc._last_prune.pop("janitor", None)
    with w.conn() as conn:
        for hours in (200, 1):
            conn.execute("INSERT INTO zone_count_samples(area_id, at, count) VALUES ('lobby', ?, 1)", (zc._iso(now - dt.timedelta(hours=hours)),))
    assert zc.janitor(w.db, now) == 1                  # ON: the retention (7 days) even without a Frigate poll
    assert len(w.samples()) == 1
    assert zc.janitor(w.db, now + dt.timedelta(minutes=5)) == 0   # throttled to PRUNE_EVERY_S while on
    zc._last_prune.pop("janitor", None)


def test_m2_janitor_never_raises_on_a_database_without_the_tables(tmp_path):
    db = Database(tmp_path / "empty.db")
    with db.connection() as conn:
        conn.execute("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT)")
    assert zc.janitor(db) == 0


def test_m2_the_switch_and_retention_are_never_restored(w, settings, tmp_path):
    import io
    import json
    import zipfile
    from dataclasses import replace

    from fastapi.testclient import TestClient

    from smplwise.db import get_setting
    from smplwise.main import create_app
    from smplwise.services import backup as svc

    for key in (zc.ENABLED, zc.RETENTION, "access.external.denied_alert", "access.external.denied_cursor"):
        assert svc._kept_setting(key), key
    w.set(zc.ENABLED, "on")
    w.set(zc.RETENTION, "30")
    w.set("ui.design", "b")
    e = w.client.post("/api/v1/backups", json={}).json()
    raw = w.client.get(f"/api/v1/backups/{e['name']}/download").content
    src = zipfile.ZipFile(io.BytesIO(raw))
    rows = json.loads(src.read("data/settings.json"))
    keys = {r["key"] for r in rows}
    assert "ui.design" in keys and zc.ENABLED not in keys and zc.RETENTION not in keys   # never exported
    out = io.BytesIO()  # an older build's archive (or a hand-edited one) that carries the switch on
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as dst:
        for n in src.namelist():
            data = src.read(n)
            if n == "data/settings.json":
                data = json.dumps(rows + [{**dict(rows[0]), "key": zc.ENABLED, "value": "on"}, {**dict(rows[0]), "key": zc.RETENTION, "value": "90"}]).encode()
            dst.writestr(n, data)
    app2 = create_app(replace(settings, data_dir=tmp_path / "data2"))
    c2 = TestClient(app2)
    c2.get("/api/v1/me")
    up = c2.post("/api/v1/backups/upload", files={"file": ("copy.zip", out.getvalue(), "application/zip")})
    assert up.status_code == 201, up.text
    for mode in ("replace", "merge"):
        body = {"mode": mode, "confirm": "RESTORE", **({"scope": "project"} if mode == "replace" else {})}
        res = c2.post(f"/api/v1/backups/{up.json()['name']}/restore", json=body)
        assert res.status_code == 200, res.text
        with app2.state.db.connection(mode="read") as conn:
            assert (get_setting(conn, zc.ENABLED, "off") or "off") == "off", mode
            assert get_setting(conn, zc.RETENTION) is None, mode


def test_retention_setting_is_validated_and_bounds_the_series(w):
    assert w.client.put(f"{API}/settings", json={"retention_days": 0}).status_code == 422
    assert w.client.put(f"{API}/settings", json={"retention_days": 91}).status_code == 422
    assert w.client.put(f"{API}/settings", json={"bogus": 1}).status_code == 422
    _enable(w, retention=1)
    w.map("cam_front", "", "lobby")
    assert w.client.get(f"{API}/areas/lobby?hours=500").json()["series"]["hours"] == 24   # asked for 500 h, kept 1 day


def test_mapping_routes(w):
    body = {"recorder_id": RID, "camera_key": "cam_front", "frigate_zone": "z1", "area_id": "lobby"}
    mid = w.client.post(f"{API}/mappings", json=body).json()["id"]
    assert w.client.post(f"{API}/mappings", json=body).status_code == 409
    assert w.client.post(f"{API}/mappings", json={**body, "area_id": "nope"}).status_code == 404
    assert [m["frigate_zone"] for m in w.client.get(f"{API}/mappings").json()["items"]] == ["z1"]
    assert w.client.delete(f"{API}/mappings/{mid}").status_code == 200
    assert w.client.delete(f"{API}/mappings/{mid}").status_code == 404
