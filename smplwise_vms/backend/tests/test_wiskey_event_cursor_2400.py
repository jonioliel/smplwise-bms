"""WISKEY-EVENT-CURSOR-2400 (plan T15): the service feed's `events/resume_v1` consumer (services/wiskey_event_resume.py).

A fake WisKey implements the resume semantics of WisKey's `event_resume.py` (source, acceptance sequence, HMAC cursor, retention,
`reset_required` reasons, `invalid_cursor` refusal). Synthetic data only: no lab host, no real event."""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import sqlite3
from pathlib import Path
from typing import Any

import pytest

from smplwise.db import Database
from smplwise.services import wiskey_event_resume as wer
from smplwise.services.intercom_client import IntercomError

SRC_A = "a" * 32
SRC_B = "b" * 32
PERSON = "Synthetic Person Seven"


class FakeWisKey:
    """WisKey's durable resume store, reduced to what Arx can observe."""

    def __init__(self, source: str = SRC_A) -> None:
        self.source = source
        self.key = b"synthetic-resume-key"
        self.seq = 0
        self.rows: dict[int, dict[str, Any]] = {}
        self.calls: list[str | None] = []
        self.gate: asyncio.Event | None = None
        self.unknown_command = False

    def add(self, n: int, *, id_prefix: str | None = None) -> None:
        for _ in range(n):
            self.seq += 1
            s = self.seq
            at = f"2026-11-04T10:{s // 60:02d}:{s % 60:02d}+00:00"
            eid = hashlib.sha256(f"{id_prefix or self.source}:{s}".encode()).hexdigest()
            self.rows[s] = {"id": eid, "station_id": "entry-a", "timestamp": at, "received_at": at, "time_source": "device",
                            "employee_no": "E-77", "person_name": PERSON, "door": 1, "api_door": 1, "authentication": "card",
                            "result": "granted", "event_type": "access_granted", "major": 5, "minor": 1, "card": "9988776655",
                            "recovered": False, "source": "stream"}

    def prune(self, upto: int) -> None:
        for s in [s for s in self.rows if s <= upto]:
            del self.rows[s]

    def reinstall(self, source: str = SRC_B) -> None:
        self.source, self.seq, self.rows = source, 0, {}

    def rollback(self, to_seq: int) -> None:
        self.seq = to_seq
        self.rows = {s: r for s, r in self.rows.items() if s <= to_seq}

    def cursor(self, seq: int) -> str:
        prefix = f"{self.source}.{seq}"
        return prefix + "." + hmac.new(self.key, prefix.encode(), hashlib.sha256).hexdigest()

    def resume(self, value: str | None, limit: int) -> dict[str, Any]:
        if value is None:
            position: int | None = 0
        else:
            parts = value.split(".")
            if len(parts) != 3 or not parts[1].isdigit():
                raise IntercomError("invalid_cursor", wer.COMMAND)
            if parts[0] != self.source:
                position = None
            else:
                position = int(parts[1])
                if not hmac.compare_digest(self.cursor(position), value):
                    raise IntercomError("invalid_cursor", wer.COMMAND)
        high = self.seq
        retained = set(self.rows)
        reset = ("source_replaced" if position is None else "cursor_ahead" if position > high
                 else "retention_gap" if any(s not in retained for s in range(position + 1, min(high, position + 501) + 1)) else None)
        base = {"contract": "wiskey-event-cursor.v1", "schema_version": 1, "source": self.source}
        if reset:
            return {**base, "state": "reset_required", "reason": reset, "records": [], "cursor": value, "reset_cursor": self.cursor(high),
                    "has_more": False, "all_delivered": False}
        page = sorted(s for s in self.rows if s > position)[:limit]
        end = page[-1] if page else position
        return {**base, "state": "page", "reason": None, "records": [{"sequence": s, "event": dict(self.rows[s])} for s in page],
                "cursor": self.cursor(end), "reset_cursor": None, "has_more": end < high, "all_delivered": end == high}

    async def send(self, cursor: str | None, limit: int) -> dict[str, Any]:
        self.calls.append(cursor)
        if self.unknown_command:
            raise IntercomError("unknown_command", wer.COMMAND)
        if self.gate is not None:
            await self.gate.wait()
        return self.resume(cursor, limit)


@pytest.fixture()
def world(tmp_path: Path, monkeypatch):
    wer.reset_for_tests()
    tick = {"n": 0}

    def clock() -> str:
        tick["n"] += 1
        return f"2026-11-04T12:{tick['n'] // 60:02d}:{tick['n'] % 60:02d}Z"

    wer.set_clock_for_tests(clock)
    db = Database(tmp_path / "db" / "evcursor.db")
    db.migrate()
    yield db
    wer.reset_for_tests()


def run(coro):
    return asyncio.run(coro)


def q(db: Database, sql: str, args: tuple = ()) -> list[tuple]:
    with db.connection(mode="read") as conn:
        return [tuple(r) for r in conn.execute(sql, args).fetchall()]


def stored(db: Database) -> int:
    return q(db, "SELECT COUNT(*) FROM wiskey_door_events")[0][0]


def gaps(db: Database) -> list[tuple]:
    return q(db, "SELECT reason, from_at, to_at, old_source, new_source, event_ref FROM wiskey_event_gaps ORDER BY observed_at")


def active(db: Database) -> tuple:
    return q(db, "SELECT source, cursor FROM wiskey_event_cursors WHERE active = 1")[0]


# ================================================================ first start, restart mid-stream, duplicates

def test_first_start_reads_the_retained_history_behind_a_first_start_gap(world):
    wk = FakeWisKey()
    wk.add(5)
    out = run(wer.pass_once(wk.send, world))
    assert out["state"] == "page" and out["delivered"] == 5 and out["duplicates"] == 0 and out["caught_up"] is True and out["gaps"] == 1
    assert wk.calls == [None] and stored(world) == 5
    (g,) = gaps(world)
    assert g[0] == "first_start" and g[1] is None and g[4] == SRC_A, "the start is unknown: Arx never held a cursor"
    ev = q(world, "SELECT type, source, raw_type, camera_id, details_json FROM events WHERE id = ?", (g[5],))[0]
    assert ev[:4] == ("coverage_gap", "system", "wiskey_events_gap", None), "the gap is visible in the event centre"
    assert json.loads(ev[4])["complete"] is False and json.loads(ev[4])["reason"] == "first_start"
    assert active(world) == (SRC_A, wk.cursor(5))


def test_restart_mid_stream_resumes_from_the_stored_cursor_without_gap_or_duplicate(world):
    wk = FakeWisKey()
    wk.add(7)
    out = run(wer.pass_once(wk.send, world, limit=3, max_steps=1))  # Arx stops mid-stream (has_more)
    assert out["delivered"] == 3 and out["caught_up"] is False
    # "restart": the process memory goes, the database stays; WisKey kept accepting events meanwhile
    wer.STATUS["last"] = None
    wk.add(2)
    wk2 = FakeWisKey()
    wk2.__dict__.update({k: v for k, v in wk.__dict__.items() if k != "calls"})
    out = run(wer.pass_once(wk2.send, world, limit=3))
    assert wk2.calls[0] == wk.cursor(3), "the reconnect resumes exactly where the stored cursor points"
    assert out["delivered"] == 6 and out["duplicates"] == 0 and out["caught_up"] is True
    assert stored(world) == 9 and [g[0] for g in gaps(world)] == ["first_start"], "no new gap: nothing was missed"
    seqs = [r[0] for r in q(world, "SELECT sequence FROM wiskey_door_events ORDER BY sequence")]
    assert seqs == list(range(1, 10))


def test_a_replayed_page_is_stored_once(world):
    wk = FakeWisKey()
    wk.add(4)
    run(wer.pass_once(wk.send, world))
    # at-least-once: WisKey hands the same events again (e.g. Arx lost the answer after storing); simulated by rewinding the cursor
    with world.write_aside() as conn:
        conn.execute("UPDATE wiskey_event_cursors SET cursor = ? WHERE source = ?", (wk.cursor(1), SRC_A))
    wk.add(1)
    out = run(wer.pass_once(wk.send, world))
    assert out["delivered"] == 1 and out["duplicates"] == 3
    assert stored(world) == 5 and q(world, "SELECT COUNT(DISTINCT event_id) FROM wiskey_door_events")[0][0] == 5


def test_a_failed_commit_leaves_the_cursor_and_the_page_comes_again_once(world, monkeypatch):
    wk = FakeWisKey()
    wk.add(2)
    run(wer.pass_once(wk.send, world))
    wk.add(3)
    real = wer._store_records

    def boom(conn, page, now):
        real(conn, page, now)
        raise RuntimeError("crash between the insert and the commit")

    monkeypatch.setattr(wer, "_store_records", boom)
    with pytest.raises(RuntimeError):  # the pump (run) logs it and retries; the transaction is rolled back
        run(wer.pass_once(wk.send, world))
    assert stored(world) == 2 and active(world)[1] == wk.cursor(2), "one transaction: nothing kept"
    monkeypatch.setattr(wer, "_store_records", real)
    out = run(wer.pass_once(wk.send, world))
    assert out["delivered"] == 3 and stored(world) == 5


def test_the_stored_row_is_the_closed_projection(world):
    wk = FakeWisKey()
    wk.add(1)
    run(wer.pass_once(wk.send, world))
    cols = [r[1] for r in q(world, "PRAGMA table_info(wiskey_door_events)")]
    assert not {"person_name", "employee_no", "card", "major", "minor"} & set(cols)
    path = Path(world.path)
    with sqlite3.connect(path) as raw:
        dump = "\n".join(raw.iterdump())
    assert PERSON not in dump and "E-77" not in dump and "9988776655" not in dump
    row = q(world, "SELECT station_id, event_type, result, authentication, door, time_source, recovered FROM wiskey_door_events")[0]
    assert row == ("entry-a", "access_granted", "granted", "card", 1, "device", 0)


# ================================================================ expired cursor, WisKey reset / new install

def test_an_expired_cursor_records_a_gap_with_its_time_range_and_adopts_wiskeys_reset_point(world):
    wk = FakeWisKey()
    wk.add(3)
    run(wer.pass_once(wk.send, world))
    caught_up = q(world, "SELECT caught_up_at FROM wiskey_event_cursors")[0][0]
    wk.add(5)
    wk.prune(6)  # WisKey's retention removed events 1..6 before Arx read 4..8
    out = run(wer.pass_once(wk.send, world))
    reasons = [g[0] for g in gaps(world)]
    assert reasons == ["first_start", "retention_gap"]
    g = gaps(world)[-1]
    assert g[1] == caught_up and g[2] > g[1], "from the last moment Arx was complete to the moment the reset was seen"
    assert out["gaps"] == 1 and out["caught_up"] is True
    assert active(world) == (SRC_A, wk.cursor(8)), "WisKey's reset point is adopted"
    assert stored(world) == 3, "events 4..8 are NOT pretended: they are inside the gap"
    ev = q(world, "SELECT occurred_at, ended_at, severity FROM events WHERE id = ?", (g[5],))[0]
    assert ev == (g[1], g[2], "alert")
    wk.add(2)
    out = run(wer.pass_once(wk.send, world))
    assert out["delivered"] == 2 and out["gaps"] == 0 and stored(world) == 5


def test_wiskey_reinstalled_starts_the_new_source_fresh_behind_a_gap(world):
    wk = FakeWisKey()
    wk.add(2)
    run(wer.pass_once(wk.send, world))
    wk.reinstall(SRC_B)
    wk.add(3)
    out = run(wer.pass_once(wk.send, world))
    assert [g[0] for g in gaps(world)] == ["first_start", "source_replaced"]
    g = gaps(world)[-1]
    assert (g[3], g[4]) == (SRC_A, SRC_B) and g[1] is not None
    assert out["delivered"] == 3 and wk.calls[-1] is None, "the unknown source is read from its beginning"
    assert active(world) == (SRC_B, wk.cursor(3)) and stored(world) == 5
    assert q(world, "SELECT active FROM wiskey_event_cursors WHERE source = ?", (SRC_A,))[0][0] == 0


def test_a_reset_store_that_cannot_serve_its_beginning_extends_the_same_gap(world):
    wk = FakeWisKey()
    wk.add(2)
    run(wer.pass_once(wk.send, world))
    wk.reinstall(SRC_B)
    wk.add(6)
    wk.prune(4)
    out = run(wer.pass_once(wk.send, world))
    assert [g[0] for g in gaps(world)] == ["first_start", "source_replaced"], "one gap, not two"
    assert out["state"] == "page" and out["caught_up"] is True and active(world) == (SRC_B, wk.cursor(6))


def test_switching_back_to_a_known_source_resumes_its_own_cursor_without_a_gap(world):
    wk_a = FakeWisKey(SRC_A)
    wk_a.add(2)
    run(wer.pass_once(wk_a.send, world))
    wk_b = FakeWisKey(SRC_B)
    wk_b.add(1)
    run(wer.pass_once(wk_b.send, world))  # e.g. Arx pointed at another WisKey for a while
    assert active(world)[0] == SRC_B
    wk_a.add(2)
    out = run(wer.pass_once(wk_a.send, world))
    assert out["delivered"] == 2 and active(world) == (SRC_A, wk_a.cursor(4))
    assert [g[0] for g in gaps(world)] == ["first_start", "source_replaced"], "back to A: no new gap"


def test_wiskey_history_going_back_is_a_cursor_ahead_gap(world):
    wk = FakeWisKey()
    wk.add(5)
    run(wer.pass_once(wk.send, world))
    wk.rollback(2)  # WisKey's storage restored from an older backup
    wk.add(1)
    run(wer.pass_once(wk.send, world))
    assert gaps(world)[-1][0] == "cursor_ahead" and active(world) == (SRC_A, wk.cursor(3))


def test_a_cursor_wiskey_cannot_verify_rereads_the_source_from_its_beginning(world):
    wk = FakeWisKey()
    wk.add(3)
    run(wer.pass_once(wk.send, world))
    wk.key = b"another-resume-key"  # WisKey's cursor key changed: the stored cursor no longer verifies
    wk.add(1)
    out = run(wer.pass_once(wk.send, world))
    assert gaps(world)[-1][0] == "cursor_invalid"
    assert out["delivered"] == 1 and out["duplicates"] == 3, "the retained history comes again and is de-duplicated"
    assert active(world) == (SRC_A, wk.cursor(4)) and stored(world) == 4


# ================================================================ concurrent reconnect

def test_two_pulls_in_one_process_one_answers_busy(world):
    wk = FakeWisKey()
    wk.add(3)

    async def both():
        wk.gate = asyncio.Event()
        first = asyncio.create_task(wer.pass_once(wk.send, world))
        await asyncio.sleep(0.05)
        second = await wer.pass_once(wk.send, world)
        wk.gate.set()
        return await first, second

    first, second = run(both())
    assert second == {"state": "busy"} and first["delivered"] == 3 and stored(world) == 3


def test_a_stale_puller_never_moves_the_cursor_back_or_stores_twice(world):
    wk = FakeWisKey()
    wk.add(2)
    run(wer.pass_once(wk.send, world))
    wk.add(3)

    async def race():
        wk.gate = asyncio.Event()
        a = asyncio.create_task(wer.step(wk.send, world))
        b = asyncio.create_task(wer.step(wk.send, world))  # a second session reconnecting at the same moment (another worker)
        await asyncio.sleep(0.05)
        wk.gate.set()
        return await a, await b

    a, b = run(race())
    assert sorted([a["state"], b["state"]]) == ["page", "superseded"]
    assert stored(world) == 5 and active(world) == (SRC_A, wk.cursor(5))
    assert [g[0] for g in gaps(world)] == ["first_start"]


# ================================================================ errors, the pump, the sender

def test_wiskey_without_the_command_stops_the_pump_for_the_session(world):
    wk = FakeWisKey()
    wk.unknown_command = True

    async def go():
        end = asyncio.Event()
        await asyncio.wait_for(wer.run(wk.send, world, end), 5)

    run(go())
    assert wer.STATUS["last"]["state"] == "unsupported" and len(wk.calls) == 1


def test_a_refusal_changes_nothing_and_is_kept_as_the_last_outcome(world):
    async def refuse(cursor, limit):
        raise IntercomError("Unauthorized", wer.COMMAND)

    out = run(wer.pass_once(refuse, world))
    assert out["state"] == "refused" and out["code"] == "Unauthorized"
    assert q(world, "SELECT COUNT(*) FROM wiskey_event_cursors")[0][0] == 0 and gaps(world) == []
    with world.connection(mode="read") as conn:
        assert json.loads(conn.execute("SELECT value FROM settings WHERE key = ?", (wer.LAST_KEY,)).fetchone()[0])["code"] == "Unauthorized"


def test_an_invalid_page_changes_nothing(world):
    async def bad(cursor, limit):
        return {"contract": "wiskey-event-cursor.v1", "schema_version": 1, "state": "page"}

    assert run(wer.pass_once(bad, world))["code"] == "event_page_invalid" and gaps(world) == []


def test_a_refresh_push_wakes_the_pump(world, monkeypatch):
    monkeypatch.setattr(wer, "WAKE_DEBOUNCE_S", 0.0)
    monkeypatch.setattr(wer, "POLL_S", 60.0)
    wk = FakeWisKey()
    wk.add(1)

    async def go():
        end = asyncio.Event()
        task = asyncio.create_task(wer.run(wk.send, world, end))
        for _ in range(100):
            await asyncio.sleep(0.02)
            if stored(world) == 1:
                break
        wk.add(2)
        wer.wake()
        for _ in range(100):
            await asyncio.sleep(0.02)
            if stored(world) == 3:
                break
        end.set()
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)

    run(go())
    assert stored(world) == 3 and len(wk.calls) == 2


def test_the_signed_sender_carries_only_the_resume_command_with_cursor_and_limit():
    frames: list[tuple[str, dict]] = []

    async def call(msg_type, **kw):
        frames.append((msg_type, kw))
        if msg_type == "auth/current_user":
            return {"id": 1, "type": "result", "success": True, "result": {"id": "c" * 32}}
        return {"id": 2, "type": "result", "success": True, "bridge_schema": "wiskey-bridge-command.v1", "result": {"ok": 1}}

    send = wer.signed_sender(call, object(), key_reader=lambda _s: "synthetic-pairing-secret")
    assert run(send(None, 50)) == {"ok": 1}
    msg_type, kw = frames[-1]
    assert msg_type == "hikvision_intercom/events/resume_v1" and set(kw) == {"bridge"}
    body = json.dumps(kw["bridge"])
    assert "events/resume_v1" in body and '"cursor": null' in body and '"limit": 50' in body
    assert "synthetic-pairing-secret" not in body
    assert run(send("x.1.y", 10)) == {"ok": 1} and [f[0] for f in frames].count("auth/current_user") == 1


def test_the_signed_sender_refuses_without_a_key_or_a_valid_identity():
    async def call(msg_type, **kw):
        if msg_type == "auth/current_user":
            return {"id": 1, "type": "result", "success": True, "result": {"id": "not-an-id"}}
        raise AssertionError("nothing may be sent")

    with pytest.raises(IntercomError) as e:
        run(wer.signed_sender(call, object(), key_reader=lambda _s: "k")(None, 1))
    assert e.value.code == "unauthorized"

    async def call2(msg_type, **kw):
        if msg_type == "auth/current_user":
            return {"id": 1, "type": "result", "success": True, "result": {"id": "c" * 32}}
        raise AssertionError("nothing may be sent")

    with pytest.raises(IntercomError) as e:
        run(wer.signed_sender(call2, object(), key_reader=lambda _s: None)(None, 1))
    assert e.value.code == "bridge_not_paired"


def test_the_pump_is_off_when_switched_off(monkeypatch):
    monkeypatch.setenv(wer.ENV, "0")

    async def go():
        return wer.start(lambda *a, **k: None, object(), asyncio.Event())

    assert run(go()) is None


# ================================================================ the status line on "מצב WisKey"

def _line(db: Database) -> dict:
    from smplwise.services import wiskey_pairing

    with db.connection(mode="read") as conn:
        return wiskey_pairing._events_line(conn)


def test_status_line_states(world, monkeypatch):
    monkeypatch.setenv(wer.ENV, "1")
    ln = _line(world)
    assert ln["key"] == "events" and ln["state"] == "unknown" and ln["reason"] == "events_not_run" and ln["fix"]
    wk = FakeWisKey()
    wk.add(2)
    run(wer.pass_once(wk.send, world))
    ln = _line(world)
    assert ln["reason"] == "events_gap" and ln["state"] == "warn" and "לא ידוע" in ln["text"], "a first start is a gap with an unknown start"
    with world.write_aside() as conn:
        conn.execute("UPDATE wiskey_event_gaps SET observed_at = '2026-01-01T00:00:00Z'")  # older than the visible window
    ln = _line(world)
    assert ln["state"] == "ok" and ln["reason"] == "events_ok" and ln["fix"] is None and "2 אירועים חדשים" in ln["text"]
    wk.add(3)
    wk.prune(4)
    run(wer.pass_once(wk.send, world))
    ln = _line(world)
    assert ln["reason"] == "events_gap" and "WisKey כבר מחק" in ln["text"]
    monkeypatch.setenv(wer.ENV, "0")
    assert _line(world)["reason"] == "events_off"
    for text in (ln["text"], ln["fix"]):
        assert "Home Assistant" not in text and any("֐" <= ch <= "׿" for ch in text)


def test_the_last_outcome_survives_a_restart_through_the_setting(world, monkeypatch):
    monkeypatch.setenv(wer.ENV, "1")

    async def refuse(cursor, limit):
        raise IntercomError("Unauthorized", wer.COMMAND)

    run(wer.pass_once(refuse, world))
    wer.STATUS["last"] = None  # the process restarted
    ln = _line(world)
    assert ln["reason"] == "events_failed" and "Unauthorized" in ln["text"]
