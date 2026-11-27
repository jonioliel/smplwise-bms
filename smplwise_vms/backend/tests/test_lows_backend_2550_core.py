"""LOWS-BACKEND-2550 - the low backend-core findings of the 2.52 deep review (docs/review/DEEP-REVIEW-2520-INDEX.md).

CORE-06  a full /ha/ws queue no longer drops frames silently: the socket's queue is marked, its stale frames are discarded and the client
         gets one `structure_changed` (reason `resync`) - every screen on the socket already refetches on it; the drops are counted.
CORE-07  attributes over the 4,000-character budget are never cut mid-JSON: the largest attribute is shortened (a list by items) or dropped.
CORE-08  the inbox cursor is (last_at, id): rows that share the boundary row's second are on the next page; a one-part cursor still works.
CORE-09  archive members are size-checked before they are read (manifest, tables) and files are copied streamed.
CORE-11  the janitor prunes `remote_token_uses` (not seen for 400 days, or of a deleted user).
Fakes only: no Home Assistant, no device."""
from __future__ import annotations

import datetime as dt
import io
import json
import queue
import zipfile

import pytest
from conftest import as_user
from fastapi.testclient import TestClient
from notify_world import API, World, fake_push  # noqa: F401 - fake_push is a fixture

from smplwise.main import create_app
from smplwise.services import access_tokens, ha_sync, notify
from smplwise.services import backup as bk
from smplwise.services.push_queue import PushQueue


# ---------------------------------------------------------------- CORE-06

def test_core06_a_full_queue_is_marked_counted_and_drained_once():
    q = PushQueue(maxsize=3)
    with ha_sync._sub_lock:
        ha_sync._subscribers.append(q)
    before = ha_sync.STATE.dropped_frames
    try:
        for i in range(5):
            ha_sync.publish({"type": "entity_state_changed", "n": i})
    finally:
        ha_sync.unsubscribe(q)
    assert ha_sync.STATE.dropped_frames == before + 2
    assert ha_sync.take_overflow(q) is True
    assert q.empty()  # the stale frames are discarded: the client refetches the current state instead
    assert ha_sync.take_overflow(q) is False
    plain: queue.Queue = PushQueue(maxsize=3)
    assert ha_sync.take_overflow(plain) is False


def test_core06_the_socket_says_resync_after_an_overflow(settings, monkeypatch):
    app = create_app(settings)
    c = TestClient(app)
    assert c.get("/api/v1/me").status_code == 200
    full = PushQueue(maxsize=2)
    full.put_nowait({"type": "entity_state_changed", "entity": {"entity_id": "light.a"}})
    full.put_nowait({"type": "entity_state_changed", "entity": {"entity_id": "light.b"}})
    full.overflowed = True  # type: ignore[attr-defined]
    monkeypatch.setattr(ha_sync, "subscribe", lambda: full)
    with c.websocket_connect("/api/v1/ha/ws", headers=as_user("joni")) as ws:
        frame = json.loads(ws.receive_text())
    assert frame["type"] == "structure_changed" and frame["payload"]["reason"] == "resync" and frame["sequence"] == 1
    assert full.empty()


# ---------------------------------------------------------------- CORE-07

def test_core07_a_long_option_list_never_makes_invalid_json():
    attrs = {"friendly_name": "בורר אזור זמן", "options": [f"Zone/Number_{i:03d}" for i in range(400)], "icon": "mdi:clock", "unit_of_measurement": "x",
             "device_class": "enum"}
    text = ha_sync.trim_attributes(attrs, "select")
    kept = json.loads(text)  # used to be 4,000 characters cut mid-document
    assert len(text) <= ha_sync.ATTR_BUDGET
    assert kept["friendly_name"] == "בורר אזור זמן" and kept["icon"] == "mdi:clock" and kept["device_class"] == "enum"
    assert kept["options"] and kept["options"] == attrs["options"][:len(kept["options"])]  # whole items, the head of the list


def test_core07_a_document_inside_the_budget_is_unchanged():
    attrs = {"friendly_name": "x", "options": ["a", "b"], "icon": "mdi:y"}
    assert json.loads(ha_sync.trim_attributes(attrs, "select")) == attrs


# ---------------------------------------------------------------- CORE-08

@pytest.fixture()
def w(settings, fake_push) -> World:  # noqa: F811
    return World(settings)


@pytest.mark.usefixtures("daytime_clock")
def test_core08_rows_of_the_boundary_second_are_on_the_next_page(w):
    kitchen = w.entity("binary_sensor.kitchen_leak", cls="moisture", floor=w.ids["floor2"], name="חיישן הצפה")
    orig = notify.now_utc
    t0 = dt.datetime(2026, 11, 26, 10, 0, 0, tzinfo=dt.timezone.utc)
    notify.now_utc = lambda: t0  # every row in the same second
    ids = []
    try:
        ids.append(w.emit("camera.offline", "camera", w.cam, params={"name": "לובי", "place": "לובי"}).id)
        ids.append(w.emit("device.battery_low", "entity", kitchen, params={"name": "חיישן", "level": "9%"}).id)
        ids.append(w.emit("opening.left_open", "entity", kitchen, params={"name": "דלת", "minutes": 10}).id)
    finally:
        notify.now_utc = orig
    assert all(ids) and len(set(ids)) == 3
    seen: list[str] = []
    before = None
    for _ in range(5):
        params = {"limit": 1, **({"before": before} if before else {})}
        page = w.c.get(f"{API}/notifications", params=params, headers=as_user("joni")).json()
        seen += [r["id"] for r in page["notifications"]]
        before = page["next_before"]
        if not before:
            break
    assert sorted(seen) == sorted(ids), "no row of the shared second is skipped"
    # the old one-part cursor is still accepted with its old meaning (strictly older rows)
    r = w.c.get(f"{API}/notifications", params={"limit": 5, "before": "2026-11-26T10:00:01Z"}, headers=as_user("joni"))
    assert r.status_code == 200 and sorted(x["id"] for x in r.json()["notifications"]) == sorted(ids)
    assert w.c.get(f"{API}/notifications", params={"before": "not a time|x"}, headers=as_user("joni")).status_code == 422


# ---------------------------------------------------------------- CORE-09

def _zip(members: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as z:
        for name, data in members.items():
            z.writestr(name, data)
    return buf.getvalue()


def test_core09_an_oversize_manifest_is_refused_at_upload_and_in_the_listing(settings, monkeypatch, tmp_path):
    monkeypatch.setattr(bk, "MANIFEST_MAX_BYTES", 2048)
    big = json.dumps({"format": bk.FORMAT, "pad": " " * 10_000}).encode()
    with pytest.raises(ValueError, match="too large"):
        bk.save_upload(settings, _zip({"manifest.json": big}))
    p = tmp_path / "upload-x.zip"
    p.write_bytes(_zip({"manifest.json": big}))
    with pytest.raises(ValueError, match="too large"):
        bk.read_manifest(p)
    assert bk.entry(p)["name"] == "upload-x.zip"  # the listing still shows the file, without reading the member


def test_core09_a_restore_with_an_oversize_table_member_deletes_nothing(settings, monkeypatch):
    app = create_app(settings)
    c = TestClient(app)
    assert c.post("/api/v1/cameras", json={"channel": 2, "alias": "Lobby cam"}).status_code in (200, 201)
    e = c.post("/api/v1/backups", json={"note": "x"}).json()
    monkeypatch.setattr(bk, "TABLE_MEMBER_MAX_BYTES", 10)  # every table member is now "too large"
    r = c.post(f"/api/v1/backups/{e['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
    assert r.status_code in (400, 409, 422), r.text
    assert [x["alias"] for x in c.get("/api/v1/cameras").json()["cameras"]] == ["Lobby cam"]


def test_core09_read_member_capped():
    raw = _zip({"a.json": b"x" * 100})
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        assert bk.read_member_capped(z, "a.json", 100) == b"x" * 100
        with pytest.raises(ValueError):
            bk.read_member_capped(z, "a.json", 99)


# ---------------------------------------------------------------- CORE-11

def test_core11_old_rows_and_rows_of_deleted_users_are_pruned(settings):
    app = create_app(settings)
    db = app.state.db
    now = access_tokens._iso(__import__("time").time())
    old = access_tokens._iso(__import__("time").time() - 500 * 86400)
    with db.connection() as conn:
        conn.execute("INSERT INTO users(id, username, display_name, source, first_seen_at, last_seen_at, deleted_at) VALUES ('gone-1', 'gone', 'gone', 'local', ?, ?, ?)",
                     (now, now, now))
        for key, uid, seen in (("a" * 64, "dev-joni", now), ("b" * 64, "dev-joni", old), ("c" * 64, "gone-1", now)):
            conn.execute("INSERT INTO remote_token_uses(token_key, user_id, kind, first_seen_at, last_seen_at) VALUES (?, ?, 'unknown', ?, ?)", (key, uid, seen, seen))
    assert access_tokens.prune_uses(db) == 2
    with db.connection(mode="read") as conn:
        assert [r[0] for r in conn.execute("SELECT token_key FROM remote_token_uses")] == ["a" * 64]
    from smplwise.services import janitors

    assert "remote token uses prune" in [s.name for s in janitors.STEPS]
