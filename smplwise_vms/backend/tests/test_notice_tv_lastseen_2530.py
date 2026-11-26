"""NOTICE-TV-LASTSEEN-2530: the TV board feed no longer writes `last_seen_at` inside the request.

LOAD-BUDGET-2530 run 2 measured the feed (`GET /notices/display/<slug>`) as the slowest polling route (p95 1217 ms of 800) because
it wrote `last_seen_at` once a minute per board inside the request and so waited for the single write lock. The feed now only
notes the time in memory (`display.SeenRecorder.note`); a background pass writes every noted board in one transaction every
SEEN_FLUSH_S, and the shutdown writes once more. Pinned here: the feed never takes the write lock (and answers while another
writer holds it), ETag / 304 and the token check are unchanged, a pass writes the latest values in one transaction and never moves a
value backwards, a failed pass keeps its values, the shutdown flushes (through the real lifespan) and a new process starts clean.
Fakes only: no lab, no network."""
from __future__ import annotations

import sqlite3
import threading
import time

from fastapi.testclient import TestClient

from smplwise import db as db_mod
from smplwise.db import Database
from smplwise.main import create_app
from smplwise.services.notices import display as disp

API = "/api/v1"


def _on(client) -> None:
    r = client.patch(f"{API}/notices/settings", json={"enabled": True})
    assert r.status_code == 200, r.text


def _board(client, slug: str) -> tuple[dict, str]:
    r = client.post(f"{API}/notices/boards", json={"name": f"לוח {slug}", "slug": slug})
    assert r.status_code == 200, r.text
    return r.json()["board"], r.json()["token"]


def _feed(client, slug: str, token: str | None, **headers):
    h = {"X-Board-Token": token} if token else {}
    h.update(headers)
    return client.get(f"{API}/notices/display/{slug}", headers=h)


def _seen(db: Database, board_id: str) -> str | None:
    with db.connection(mode="read", label="test.seen") as conn:
        return conn.execute("SELECT last_seen_at FROM notice_boards WHERE id = ?", (board_id,)).fetchone()[0]


def _spy_writes(monkeypatch) -> list[str]:
    labels: list[str] = []
    real = db_mod._begin_immediate

    def spy(conn, label, *a, **k):
        labels.append(label)
        return real(conn, label, *a, **k)

    monkeypatch.setattr(db_mod, "_begin_immediate", spy)
    return labels


class _Clock:
    def __init__(self, *stamps: str) -> None:
        self.stamps = list(stamps)

    def __call__(self) -> str:
        return self.stamps.pop(0)


def test_feed_never_takes_the_write_lock_and_keeps_etag_and_token(client, monkeypatch):
    _on(client)
    b, token = _board(client, "lobby")
    client.get(f"{API}/notices/boards")  # every one-time write of the session side happens before the spy
    labels = _spy_writes(monkeypatch)
    first = _feed(client, "lobby", token)
    assert first.status_code == 200, first.text
    etag = first.headers["etag"]
    again = _feed(client, "lobby", token, **{"If-None-Match": etag})
    assert again.status_code == 304 and again.headers["etag"] == etag  # ETag / 304 unchanged
    assert _feed(client, "lobby", "x" * 43).status_code == 404  # a wrong token: the same uniform 404
    assert _feed(client, "lobby", None).status_code == 404
    for _ in range(3):
        assert _feed(client, "lobby", token).status_code == 200
    assert labels == [], f"the feed took the write lock: {labels}"
    rec = disp.seen_recorder(client.app.state)
    assert set(rec.pending()) == {b["id"]}  # only the board the token was accepted for
    db: Database = client.app.state.db
    assert _seen(db, b["id"]) is None  # not written by the request
    assert rec.flush() == 1
    assert labels == ["notices.board.seen"]  # one transaction, off the request
    stamp = _seen(db, b["id"])
    assert stamp is not None and stamp.endswith("Z")
    listed = {x["id"]: x for x in client.get(f"{API}/notices/boards").json()["boards"]}
    assert listed[b["id"]]["last_seen_at"] == stamp


def test_feed_answers_while_another_writer_holds_the_lock(client):
    _on(client)
    _b, token = _board(client, "hall")
    assert _feed(client, "hall", token).status_code == 200  # route state built outside the timed window
    disp.seen_recorder(client.app.state).flush()
    db: Database = client.app.state.db
    holding, release = threading.Event(), threading.Event()

    def hold() -> None:
        with db.connection(label="test.holder") as conn:
            conn.execute("UPDATE settings SET value = value WHERE key = 'none'")
            holding.set()
            release.wait(30)

    th = threading.Thread(target=hold, daemon=True)
    th.start()
    assert holding.wait(10)
    try:
        took = []
        for _ in range(3):  # the old code wrote on the first read of a board each minute: every one of these is a first read for it
            t = time.perf_counter()
            r = _feed(client, "hall", token)
            took.append(time.perf_counter() - t)
            assert r.status_code == 200
    finally:
        release.set()
        th.join(10)
    assert max(took) < 3.0, f"the feed waited behind another writer: {took}"


def test_a_pass_writes_the_latest_values_in_one_transaction(client, monkeypatch):
    _on(client)
    b1, _ = _board(client, "a")
    b2, _ = _board(client, "b")
    db: Database = client.app.state.db
    rec = disp.SeenRecorder(db, interval_s=3600, now=_Clock("2026-11-25T10:00:00Z", "2026-11-25T10:00:30Z", "2026-11-25T10:00:10Z",
                                                            "2026-11-25T10:00:20Z"))
    try:
        rec.note(b1["id"])
        rec.note(b1["id"])  # newer
        rec.note(b2["id"])
        rec.note(b1["id"])  # older than the pending one (a late request): never moves the value back
        labels = _spy_writes(monkeypatch)
        assert rec.flush() == 2
        assert labels == ["notices.board.seen"]
        assert _seen(db, b1["id"]) == "2026-11-25T10:00:30Z"
        assert _seen(db, b2["id"]) == "2026-11-25T10:00:10Z"
        assert rec.flush() == 0 and labels == ["notices.board.seen"]  # nothing pending: no write lock at all
    finally:
        rec.close(flush=False)


def test_a_pass_never_moves_a_stored_value_backwards(client):
    _on(client)
    b, _ = _board(client, "c")
    db: Database = client.app.state.db
    with db.connection(label="test.seed") as conn:
        conn.execute("UPDATE notice_boards SET last_seen_at = '2026-11-25T12:00:00Z' WHERE id = ?", (b["id"],))
    rec = disp.SeenRecorder(db, interval_s=3600, now=_Clock("2026-11-25T11:59:00Z"))
    try:
        rec.note(b["id"])
        assert rec.flush() == 1
        assert _seen(db, b["id"]) == "2026-11-25T12:00:00Z"
    finally:
        rec.close(flush=False)


def test_a_failed_pass_keeps_its_values_for_the_next(client):
    _on(client)
    b, _ = _board(client, "d")
    db: Database = client.app.state.db
    rec = disp.SeenRecorder(db, interval_s=3600, now=_Clock("2026-11-25T10:00:00Z", "2026-11-25T10:01:00Z"))
    real = db.connection
    calls = {"n": 0}

    def busy(*a, **k):
        calls["n"] += 1
        raise sqlite3.OperationalError("database is locked")

    try:
        rec.note(b["id"])
        db.connection = busy  # type: ignore[method-assign]
        try:
            rec.flush()
            raise AssertionError("the failing pass must raise to its caller")
        except sqlite3.OperationalError:
            pass
        finally:
            db.connection = real  # type: ignore[method-assign]
        assert calls["n"] == 1 and rec.pending() == {b["id"]: "2026-11-25T10:00:00Z"}
        rec.note(b["id"])  # a newer read meanwhile
        assert rec.flush() == 1
        assert _seen(db, b["id"]) == "2026-11-25T10:01:00Z"
    finally:
        rec.close(flush=False)


def test_the_background_pass_runs_on_its_interval(client):
    _on(client)
    b, _ = _board(client, "e")
    db: Database = client.app.state.db
    rec = disp.SeenRecorder(db, interval_s=0.05)
    try:
        assert rec._thread is None  # noqa: SLF001 - no thread before the first note (an installation without boards runs none)
        rec.note(b["id"])
        deadline = time.monotonic() + 10
        while _seen(db, b["id"]) is None and time.monotonic() < deadline:
            time.sleep(0.05)
        assert _seen(db, b["id"]) is not None
        assert rec.pending() == {}
    finally:
        rec.close(flush=False)
    assert not rec._thread.is_alive()  # noqa: SLF001


def test_close_flushes_once_ignores_later_notes_and_a_new_process_starts_clean(client):
    _on(client)
    b, _ = _board(client, "f")
    db: Database = client.app.state.db
    rec = disp.SeenRecorder(db, interval_s=3600, now=_Clock("2026-11-25T10:00:00Z", "2026-11-25T10:05:00Z", "2026-11-25T10:09:00Z"))
    rec.note(b["id"])
    assert rec.close() == 1  # the shutdown's final flush
    assert _seen(db, b["id"]) == "2026-11-25T10:00:00Z"
    assert not rec._thread.is_alive()  # noqa: SLF001
    rec.note(b["id"])  # after the shutdown: ignored
    assert rec.pending() == {} and rec.close() == 0  # twice is safe
    # the next process: a fresh recorder on the same file, empty; its next read moves the value on
    rec2 = disp.SeenRecorder(Database(db.path), interval_s=3600, now=_Clock("2026-11-25T10:10:00Z"))
    try:
        assert rec2.pending() == {}
        rec2.note(b["id"])
        assert rec2.flush() == 1
        assert _seen(db, b["id"]) == "2026-11-25T10:10:00Z"
    finally:
        rec2.close(flush=False)


def test_the_application_shares_one_recorder_and_its_shutdown_flushes(settings):
    with TestClient(create_app(settings)) as c:
        _on(c)
        b, token = _board(c, "g")
        assert _feed(c, "g", token).status_code == 200
        rec = disp.seen_recorder(c.app.state)
        assert rec is disp.seen_recorder(c.app.state)  # the routes and the LAN listener use the same one
        assert b["id"] in rec.pending()
        db: Database = c.app.state.db
        assert _seen(db, b["id"]) is None
    assert _seen(Database(settings.db_path), b["id"]) is not None  # the lifespan's shutdown step wrote it
    assert rec.pending() == {}
