"""CR-020 S2 (S2-09, S2-11): the lock discipline and the pending janitor of the stream write.

- the pending change and its attempt audit row are COMMITTED before the device sees the PUT (a second connection finds them);
- the request's write lock is not held while the device answers (another writer gets the database at once);
- a busy database at re-lock leaves the committed pending row, which the janitor settles from a device READ;
- the janitor settles applied / failed (interrupted) / diverged, audits with no actor, and never writes to the device.
AT-020-09, AT-020-13, AT-020-14."""
from __future__ import annotations

import json
import sqlite3
import threading
import time

import pytest
from conftest import sw_time_factor
from test_nvr_stream_write import audits, fake, put, rows, stream, w, with_nvr  # noqa: F401 - fixtures

from smplwise import db as dbmod
from smplwise.services import nvr_settings, stream_codecs


def test_pending_row_and_attempt_audit_are_committed_before_the_put(w, settings):
    app, c, fake, ids = w
    seen: dict = {}

    def observer(request):
        raw = sqlite3.connect(settings.db_path)  # its own connection: sees committed rows only
        raw.row_factory = sqlite3.Row
        try:
            seen["changes"] = [dict(r) for r in raw.execute("SELECT status, stream_ref, fields_json FROM nvr_changes")]
            seen["audit"] = [json.loads(r["details_json"])["phase"] for r in raw.execute("SELECT details_json FROM audit_log WHERE action = 'nvr.stream.write' ORDER BY id")]
        finally:
            raw.close()

    fake.nvr["on_put"] = observer
    r = put(c, ids[1], "101", {"svc": False})
    assert r.status_code == 200, r.text
    assert fake.nvr["on_put_error"] is None
    assert seen["changes"] == [{"status": "pending", "stream_ref": "101", "fields_json": '{"svc": [true, false]}'}]
    assert seen["audit"] == ["attempt"], "the outcome row comes after the device answered"
    assert [json.loads(a["details_json"])["phase"] for a in audits(app, "nvr.stream.write")] == ["attempt", "outcome"]


def test_the_write_lock_is_released_while_the_device_holds_the_put(w):
    app, c, fake, ids = w
    etag = stream(c, ids[1], "101")["etag"]
    fake.nvr["put_hold_s"] = 2.0
    result: dict = {}
    t = threading.Thread(target=lambda: result.setdefault("r", put(c, ids[1], "101", {"svc": False}, etag)))
    t.start()
    deadline = time.monotonic() + 10
    while fake.nvr["put_count"] < 1 and time.monotonic() < deadline:  # the PUT arrived and is held
        time.sleep(0.01)
    time.sleep(0.1)
    t0 = time.monotonic()
    with app.state.db.connection() as conn:  # another writer, while the device still holds the PUT
        conn.execute("INSERT INTO settings(key, value) VALUES ('test.parallel', '1') ON CONFLICT(key) DO UPDATE SET value = '2'")
    took = time.monotonic() - t0
    t.join(15)
    assert result["r"].status_code == 200, result["r"].text
    assert took < 1.0 * sw_time_factor(), f"a parallel write waited {took:.2f}s: the request held the write lock across the device call"


def test_busy_database_at_relock_leaves_the_pending_row_for_the_janitor(w, settings, monkeypatch):
    app, c, fake, ids = w
    etag = stream(c, ids[1], "101")["etag"]
    real = dbmod._relock
    state = {"done": False}

    def flaky(conn):
        if fake.nvr["put_count"] >= 1 and not state["done"]:
            state["done"] = True
            raise sqlite3.OperationalError("database is locked")
        return real(conn)

    monkeypatch.setattr(dbmod, "_relock", flaky)
    with pytest.raises(sqlite3.OperationalError):
        put(c, ids[1], "101", {"svc": False}, etag)
    monkeypatch.setattr(dbmod, "_relock", real)
    [ch] = rows(app, "SELECT * FROM nvr_changes")
    assert ch["status"] == "pending" and fake.writes == ["nvr PUT /ISAPI/Streaming/channels/101"], "the device acted and the committed row says so"
    assert nvr_settings.settle_pending(app.state.db, with_nvr(settings)) == 0, "a young pending row waits for the janitor's age limit"
    assert nvr_settings.settle_pending(app.state.db, with_nvr(settings), older_than_s=0) == 1
    assert rows(app, "SELECT status FROM nvr_changes WHERE id = ?", ch["id"])[0]["status"] == "applied"
    assert len(fake.writes) == 1, "settling reads; it never writes"


def _pending(app, cid: str, ref: str, fields: dict, created_at: str = "2026-01-01T00:00:00Z", rollback_of: str | None = None) -> str:
    rid = dbmod.new_id()
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO nvr_changes(id, kind, permission, target, path, before_xml, after_xml, status, note, created_at, recorder_id, camera_id, stream_ref, fields_json, rollback_of) "
                     "VALUES (?, 'stream_encoding', 'nvr.configure', ?, ?, '<b/>', '<a/>', 'pending', '', ?, 'nvr-1', ?, ?, ?, ?)",
                     (rid, f"stream-{ref}", f"direct:{ref}", created_at, cid, ref, json.dumps(fields), rollback_of))
    return rid


def test_janitor_settles_applied_interrupted_and_diverged_from_a_read(w, settings):
    app, c, fake, ids = w
    fake.nvr["encodings_by_channel"] = {1: {"main": {"svc": False}}, 2: {"main": {"codec": "H.265", "svc": True, "profile": "Main"}}, 3: {"main": {"svc": False, "gop": 50}}}
    a = _pending(app, ids[1], "101", {"svc": [True, False]})                      # the device shows the new value
    b = _pending(app, ids[2], "201", {"svc": [True, False]})                      # the device shows the old value
    d = _pending(app, ids[3], "301", {"svc": [True, False], "gop": [50, 25]})     # half of it
    young = _pending(app, ids[1], "102", {"gop": [40, 30]}, created_at=dbmod.now_iso())
    assert nvr_settings.settle_pending(app.state.db, with_nvr(settings)) == 3
    got = {r["id"]: (r["status"], r["error"]) for r in rows(app, "SELECT id, status, error FROM nvr_changes")}
    assert got[a] == ("applied", None) and got[b] == ("failed", "interrupted") and got[d] == ("diverged", "diverged") and got[young] == ("pending", None)
    settled = [a2 for a2 in audits(app, "nvr.stream.write") if json.loads(a2["details_json"])["phase"] == "settle"]
    assert len(settled) == 3 and all(x["actor_username"] is None for x in settled)
    with app.state.db.connection(mode="read") as conn:
        enc = stream_codecs.encoding_of(conn.execute("SELECT * FROM cameras WHERE id = ?", (ids[1],)).fetchone())
    assert enc and (enc["main"]["svc"], enc["main"]["webrtc"]) == (False, "ok"), "an applied settle refreshes the registry"
    assert fake.writes == [], "the janitor never writes to the device"


def test_janitor_leaves_the_row_when_the_device_cannot_be_read_and_settles_an_undo(w, settings):
    app, c, fake, ids = w
    r = put(c, ids[1], "101", {"svc": False})
    orig = r.json()["change"]["id"]
    fake.nvr["encodings_by_channel"] = {1: {"main": {"svc": True}}}  # the undo landed on the device, the request never recorded it
    undo = _pending(app, ids[1], "101", {"svc": [False, True]}, rollback_of=orig)
    fake.nvr["up"] = False
    assert nvr_settings.settle_pending(app.state.db, with_nvr(settings)) == 0
    assert rows(app, "SELECT status FROM nvr_changes WHERE id = ?", undo)[0]["status"] == "pending"
    fake.nvr["up"] = True
    assert nvr_settings.settle_pending(app.state.db, with_nvr(settings)) == 1
    st = {x["id"]: x["status"] for x in rows(app, "SELECT id, status FROM nvr_changes")}
    assert st[undo] == "applied" and st[orig] == "rolled_back"
    assert [json.loads(a2["details_json"])["phase"] for a2 in audits(app, "nvr.rollback")] == ["settle"]
