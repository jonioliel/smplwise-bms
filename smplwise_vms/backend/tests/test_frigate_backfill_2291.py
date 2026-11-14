"""FRIGATE-BACKFILL-2291 - reviews / events stored before their camera was imported get the camera afterwards (finding A of the
Frigate full check). Fake Frigate items only."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

from smplwise.db import Database, now_iso
from smplwise.services.recorders import frigate_events as fe

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_frigate import T0, review  # noqa: E402

RID = "nvr-2"


@pytest.fixture()
def db(settings):
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    d = Database(settings.db_path)
    d.migrate()
    with d.connection() as conn:
        conn.execute("INSERT INTO recorders(id, name, created_at) VALUES (?, 'Frigate', ?)", (RID, now_iso()))
        conn.execute("UPDATE recorders SET vendor = 'frigate' WHERE id = ?", (RID,))
    return d


def add_camera(db, cid, channel, key):
    now = now_iso()
    with db.connection() as conn:
        conn.execute("INSERT INTO cameras(id, recorder_id, channel, name_source, source_ref, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
                     (cid, RID, channel, key, key, now, now))


def poll(db, *items):
    with db.connection() as conn:
        for it in items:
            fe.apply_review(conn, RID, it, fe._camera_lookup(conn, RID))


def backfill(db):
    with db.connection() as conn:
        return fe.backfill_cameras(conn, RID)


def state(db):
    with db.connection(mode="read") as conn:
        r = {x["review_id"]: x["camera_id"] for x in conn.execute("SELECT review_id, camera_id FROM frigate_reviews").fetchall()}
        e = {x["dedup_key"].rsplit("|", 1)[1]: (x["camera_id"], x["channel"]) for x in conn.execute("SELECT dedup_key, camera_id, channel FROM events").fetchall()}
    return r, e


A, B, C = "1791227000.100000-aaa111", "1791227100.100000-bbb222", "1791227200.100000-ccc333"


def test_poll_before_discover_then_backfill_fills_reviews_and_events(db):
    poll(db, review(A, "cam_front", T0 - 100, T0 - 90, "alert"), review(B, "cam_yard", T0 - 80, None, "detection"))
    assert state(db)[0] == {A: None, B: None}
    add_camera(db, "cid1", 1, "cam_front")
    add_camera(db, "cid2", 2, "cam_yard")
    assert backfill(db) == {"reviews": 2, "events": 2}
    r, e = state(db)
    assert r == {A: "cid1", B: "cid2"} and e == {A: ("cid1", 1), B: ("cid2", 2)}


def test_poll_after_discover_is_unchanged(db):
    add_camera(db, "cid1", 1, "cam_front")
    poll(db, review(A, "cam_front", T0 - 100, T0 - 90, "alert"))
    before = state(db)
    assert backfill(db) == {"reviews": 0, "events": 0} and state(db) == before == ({A: "cid1"}, {A: ("cid1", 1)})


def test_unresolved_name_stays_empty(db):
    poll(db, review(A, "cam_front", T0 - 100, T0 - 90, "alert"), review(B, "cam_gone", T0 - 80, T0 - 70, "alert"))
    add_camera(db, "cid1", 1, "cam_front")
    assert backfill(db) == {"reviews": 1, "events": 1}
    r, e = state(db)
    assert r == {A: "cid1", B: None} and e[B] == (None, None)


def test_non_empty_camera_id_is_never_changed(db):
    add_camera(db, "cid1", 1, "cam_front")
    add_camera(db, "cid2", 2, "cam_yard")
    poll(db, review(A, "cam_front", T0 - 100, T0 - 90, "alert"))
    with db.connection() as conn:  # a stored row that points at another camera than its Frigate name says: still not touched
        conn.execute("UPDATE frigate_reviews SET camera_id = 'cid2'")
        conn.execute("UPDATE events SET camera_id = 'cid2', channel = 2")
    assert backfill(db) == {"reviews": 0, "events": 0}
    assert state(db) == ({A: "cid2"}, {A: ("cid2", 2)})


def test_running_twice_is_a_no_op(db):
    poll(db, review(A, "cam_front", T0 - 100, T0 - 90, "alert"), review(C, "cam_gone", T0 - 50, None, "detection"))
    add_camera(db, "cid1", 1, "cam_front")
    assert backfill(db) == {"reviews": 1, "events": 1}
    once = state(db)
    assert backfill(db) == {"reviews": 0, "events": 0} and state(db) == once


def test_other_recorders_rows_are_not_touched(db):
    poll(db, review(A, "cam_front", T0 - 100, T0 - 90, "alert"))
    now = now_iso()
    with db.connection() as conn:
        conn.execute("INSERT INTO recorders(id, name, created_at) VALUES ('nvr-9', 'Other', ?)", (now,))
        conn.execute("INSERT INTO cameras(id, recorder_id, channel, name_source, source_ref, created_at, updated_at) VALUES ('x1','nvr-9',1,'cam_front','cam_front',?,?)", (now, now))
    assert backfill(db) == {"reviews": 0, "events": 0} and state(db)[0] == {A: None}
