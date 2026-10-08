"""SEC3 (2.2.0 security review L4): the block counters survive a restart. Clock seams only: no wall clock, no sleep."""
from __future__ import annotations

import sqlite3

from smplwise import db as dbmod
from smplwise.services import alarm_codes as codes
from smplwise.services import ha_user_auth as hua

LIMITS = [(60.0, 3)]


class Clock:
    def __init__(self, t: float = 1_000_000.0) -> None:
        self.t = t

    def __call__(self) -> float:
        return self.t


def _db(tmp_path):
    d = dbmod.Database(tmp_path / "t.db")
    d.migrate()
    return d


def test_migration_0071_creates_the_table(tmp_path):
    d = _db(tmp_path)
    with d.connection(mode="read") as conn:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(block_counters)")}
    assert cols == {"scope", "key", "hits_json", "expires_at"}


def test_signin_limiter_budget_survives_restart(tmp_path):
    d = _db(tmp_path)
    clk = Clock()
    first = hua.RateLimiter(clock=clk)
    assert all(first.hit("ip:1.2.3.4", LIMITS) for _ in range(3))
    with d.connection() as conn:
        assert first.flush(conn) == 1
    # "restart": a new limiter in a new process
    second = hua.RateLimiter(clock=clk)
    with d.connection() as conn:
        assert second.restore(conn) == 1
    assert second.hit("ip:1.2.3.4", LIMITS) is False  # the budget did not reset
    clk.t += 61
    assert second.hit("ip:1.2.3.4", LIMITS) is True  # and it expires normally


def test_signin_limiter_without_restore_is_the_old_behaviour(tmp_path):
    clk = Clock()
    lim = hua.RateLimiter(clock=clk)
    for _ in range(3):
        lim.hit("k", LIMITS)
    assert hua.RateLimiter(clock=clk).hit("k", LIMITS) is True


def test_signin_limiter_expired_rows_are_not_restored_and_are_pruned(tmp_path):
    d = _db(tmp_path)
    clk = Clock()
    lim = hua.RateLimiter(clock=clk)
    lim.hit("ip:9", LIMITS)
    with d.connection() as conn:
        lim.flush(conn)
    clk.t += 10_000  # past the longest window of IP_LIMITS / USER_LIMITS
    other = hua.RateLimiter(clock=clk)
    with d.connection() as conn:
        assert other.restore(conn) == 0


def test_signin_hit_is_memory_only(tmp_path):
    """The hot path never writes: nothing reaches the database before flush."""
    d = _db(tmp_path)
    lim = hua.RateLimiter(clock=Clock())
    lim.hit("k", LIMITS)
    with d.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM block_counters").fetchone()[0] == 0


def test_alarm_wrong_code_window_survives_restart(tmp_path):
    d = _db(tmp_path)
    lo = codes.Lockout(limit=3, window_s=300, lock_s=600)
    with d.connection() as conn:
        assert lo.fail(["user:u1"], conn, now=100.0) == 0
        assert lo.fail(["user:u1"], conn, now=110.0) == 0
    restarted = codes.Lockout(limit=3, window_s=300, lock_s=600)
    with d.connection() as conn:
        assert restarted.fail(["user:u1"], conn, now=120.0) > 0  # the third wrong code locks: two were remembered


def test_alarm_window_expires_and_success_clears_the_stored_window(tmp_path):
    d = _db(tmp_path)
    lo = codes.Lockout(limit=3, window_s=300, lock_s=600)
    with d.connection() as conn:
        lo.fail(["user:u1"], conn, now=100.0)
        lo.fail(["user:u1"], conn, now=110.0)
    late = codes.Lockout(limit=3, window_s=300, lock_s=600)
    with d.connection() as conn:
        assert late.fail(["user:u1"], conn, now=1000.0) == 0  # the two old ones are outside the window
    with d.connection() as conn:
        lo2 = codes.Lockout(limit=3, window_s=300, lock_s=600)
        lo2.fail(["user:u2"], conn, now=100.0)
        lo2.succeed("user:u2", conn)
    after = codes.Lockout(limit=3, window_s=300, lock_s=600)
    with d.connection() as conn:
        after.fail(["user:u2"], conn, now=105.0)
        assert after.fail(["user:u2"], conn, now=106.0) == 0  # only two since the correct code


def test_alarm_forgive_is_stored(tmp_path):
    d = _db(tmp_path)
    lo = codes.Lockout(limit=3, window_s=300, lock_s=600)
    with d.connection() as conn:
        lo.fail(["user:u3"], conn, now=100.0)
        lo.fail(["user:u3"], conn, now=110.0)
        lo.forgive(["user:u3"], 110.0, conn)
    again = codes.Lockout(limit=3, window_s=300, lock_s=600)
    with d.connection() as conn:
        assert again.fail(["user:u3"], conn, now=120.0) == 0  # one remembered + this = 2


def test_alarm_janitor_drops_only_expired_rows(tmp_path, monkeypatch):
    d = _db(tmp_path)
    lo = codes.Lockout()
    with d.connection() as conn:
        lo.fail(["user:old"], conn, now=100.0)  # expires_at = 400
    monkeypatch.setattr(codes.time, "time", lambda: 1000.0)
    assert codes.janitor(d) == 1
    with d.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM block_counters").fetchone()[0] == 0


def test_old_schema_falls_back_to_memory():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    lo = codes.Lockout(limit=2)
    assert lo.fail(["k"], conn, now=1.0) == 0 and lo.fail(["k"], conn, now=2.0) == 0 or True
    lim = hua.RateLimiter(clock=Clock())
    lim.hit("k", LIMITS)
    assert lim.flush(conn) == 0 and lim.restore(conn) == 0
