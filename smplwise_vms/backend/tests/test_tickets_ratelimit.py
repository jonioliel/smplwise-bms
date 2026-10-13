"""CR-038 public rate limits (services/tickets/ratelimit.py): the scope-parameterised limiter (windows, retry-after, bounded
keys, block_counters persistence under its own scope), client-network keys with the trusted-proxy rule for CF-Connecting-IP,
the policy of spec 10.2 (unknown-token caps, known-good bypass during a flood, per-token caps) and exact counting under
concurrency. Addresses are documentation ranges (RFC 5737 / 3849); nothing touches a network."""
from __future__ import annotations

import sqlite3
import threading

import pytest

from smplwise.services.tickets import ratelimit as rl
from tests.tickets_public_fakes import Clock


def limiter(clock: Clock, horizon: float = 3600.0, **kw) -> rl.ScopedRateLimiter:
    return rl.ScopedRateLimiter("tickets_link", horizon_s=horizon, clock=clock, **kw)


def test_scope_must_be_its_own():
    for bad in ("signin", "alarm_code", "", "Tickets", "a b", "x" * 40, None):
        with pytest.raises(ValueError):
            rl.ScopedRateLimiter(bad, horizon_s=60)  # type: ignore[arg-type]
    with pytest.raises(ValueError):
        rl.ScopedRateLimiter("tickets_link", horizon_s=0)


def test_hit_counts_until_the_cap_and_a_refused_attempt_is_not_counted():
    c = Clock()
    lim = limiter(c)
    limits = ((60.0, 3),)
    assert [lim.hit("k", limits) for _ in range(5)] == [True, True, True, False, False]
    assert lim.count("k", 60) == 3
    c.advance(30)
    assert not lim.hit("k", limits)
    assert lim.check("k", limits) == pytest.approx(30.0)
    c.advance(30.001)
    assert lim.hit("k", limits) and lim.count("k", 60) == 1


def test_retry_after_takes_the_slowest_window():
    c = Clock()
    lim = limiter(c)
    limits = ((60.0, 1), (3600.0, 3))
    for _ in range(3):
        assert lim.hit("k", limits)
        c.advance(61)
    assert lim.check("k", limits) == pytest.approx(3600 - 183, abs=0.01)


def test_record_counts_past_the_cap_so_hammering_keeps_the_lock_sliding():
    c = Clock()
    lim = limiter(c)
    limits = ((60.0, 2),)
    for _ in range(2):
        lim.record("f", limits)
    assert lim.check("f", limits) == pytest.approx(60.0)
    # a client that keeps failing at the cap's pace stays locked at every look
    for _ in range(10):
        c.advance(30)
        lim.record("f", limits)
        assert lim.check("f", limits) > 0
    c.advance(30.001)
    assert lim.check("f", limits) == 0.0  # it stopped: one event left in the window


def test_check_never_records_and_an_unknown_key_creates_nothing():
    c = Clock()
    lim = limiter(c)
    assert lim.check("nobody", ((60.0, 1),)) == 0.0 and lim.keys == 0


def test_key_table_is_bounded_and_cold_keys_go_first():
    c = Clock()
    lim = limiter(c, max_keys=100, low_water=50)
    hot_limits = ((60.0, 2),)
    lim.hit("hot", hot_limits)  # half of the cap: persisted ("hot")
    for i in range(300):
        lim.hit(f"cold{i}", ((60.0, 100),))
    assert lim.keys <= 100
    assert lim.count("hot", 60) == 1


def test_flush_and_restore_round_trip_under_the_scope_only():
    c = Clock()
    db = sqlite3.connect(":memory:")
    db.execute("CREATE TABLE block_counters (scope TEXT NOT NULL, key TEXT NOT NULL, hits_json TEXT NOT NULL DEFAULT '[]', "
               "expires_at REAL NOT NULL, PRIMARY KEY (scope, key))")
    db.execute("INSERT INTO block_counters VALUES ('signin', 'ip:1', '[1]', 9e18)")
    lim = limiter(c, horizon=86400.0)
    limits = ((60.0, 20),)
    lim.hit("once", limits)  # one hit from a fresh key is never a row
    for _ in range(10):
        lim.record("fail:198.51.100.0/24", limits)
    assert lim.flush(db) == 1
    rows = db.execute("SELECT scope, key, expires_at FROM block_counters ORDER BY scope").fetchall()
    assert ("signin", "ip:1", 9e18) in rows
    mine = [r for r in rows if r[0] == "tickets_link"]
    assert mine == [("tickets_link", "fail:198.51.100.0/24", pytest.approx(c() + 86400.0))]
    fresh = limiter(c, horizon=86400.0)
    assert fresh.restore(db) == 1 and fresh.count("fail:198.51.100.0/24", 60) == 10
    # forget deletes the row at the next flush; foreign scopes are never touched
    fresh.forget("fail:198.51.100.0/24")
    fresh.flush(db)
    assert db.execute("SELECT count(*) FROM block_counters WHERE scope = 'tickets_link'").fetchone()[0] == 0
    assert db.execute("SELECT count(*) FROM block_counters WHERE scope = 'signin'").fetchone()[0] == 1


def test_a_busy_database_keeps_the_batch_for_the_next_flush():
    c = Clock()
    lim = limiter(c)
    for _ in range(5):
        lim.record("k", ((60.0, 4),))

    class Busy:
        def execute(self, *a, **k):
            raise sqlite3.OperationalError("database is locked")

    assert lim.flush(Busy()) == 0 and lim.dirty == 1  # type: ignore[arg-type]


def test_exact_counting_under_concurrency():
    c = Clock()
    lim = limiter(c)
    limits = ((60.0, 50),)
    ok: list[bool] = []
    lock = threading.Lock()

    def worker():
        for _ in range(100):
            r = lim.hit("shared", limits)
            with lock:
                ok.append(r)

    threads = [threading.Thread(target=worker) for _ in range(16)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sum(ok) == 50 and lim.count("shared", 60) == 50


# ---------------------------------------------------------------- client networks


TRUSTED = rl.parse_trusted_cidrs(rl.DEFAULT_TRUSTED_PROXY_CIDRS)


def test_cf_connecting_ip_is_believed_only_from_a_trusted_peer():
    assert rl.client_network("172.30.32.5", ["198.51.100.77"], TRUSTED) == "198.51.100.0/24"
    # a mapped host port / the LAN: the header is the client's own choice and is ignored
    assert rl.client_network("192.0.2.9", ["198.51.100.77"], TRUSTED) == "192.0.2.0/24"
    assert rl.client_network("192.0.2.9", [], TRUSTED) == "192.0.2.0/24"
    # a repeated or malformed header from a trusted peer counts as the peer itself
    assert rl.client_network("172.30.32.5", ["198.51.100.77", "203.0.113.1"], TRUSTED) == "172.30.32.0/24"
    assert rl.client_network("172.30.32.5", ["198.51.100.77, 203.0.113.1"], TRUSTED) == "172.30.32.0/24"
    assert rl.client_network("172.30.32.5", ["not-an-ip"], TRUSTED) == "172.30.32.0/24"


def test_ipv6_counts_as_its_64_and_mapped_ipv4_as_ipv4():
    assert rl.client_network("172.30.33.1", ["2001:db8:1:2:3:4:5:6"], TRUSTED) == "2001:db8:1:2::/64"
    assert rl.client_network("::ffff:198.51.100.7", [], TRUSTED) == "198.51.100.0/24"
    assert rl.client_network("fe80::1%eth0", [], TRUSTED) == "fe80::/64"
    assert rl.client_network(None, [], TRUSTED) == "unknown" and rl.client_network("testclient", [], TRUSTED) == "unknown"


def test_trusted_cidrs_refuse_garbage_and_everyone():
    assert rl.parse_trusted_cidrs(["172.30.32.0/23", " 10.0.0.0/8 "])[1].prefixlen == 8
    for bad in (["0.0.0.0/0"], ["::/0"], ["10.0.0.0/7"], ["nonsense"], [5]):
        with pytest.raises(ValueError):
            rl.parse_trusted_cidrs(bad)


# ---------------------------------------------------------------- the policy


def gate(clock: Clock) -> rl.PublicRateGate:
    return rl.PublicRateGate(rl.new_public_limiter(clock))


def test_twenty_unknown_tokens_per_minute_lock_the_network_not_its_neighbours():
    c = Clock()
    g = gate(c)
    net = "198.51.100.0/24"
    for i in range(20):
        assert g.admit("token_read", net, f"t:{i:024x}").ok
        g.failure(net, f"t:{i:024x}")
    d = g.admit("token_read", net, "t:" + "f" * 24)
    assert (d.ok, d.reason) == (False, "network_locked") and 1 <= d.retry_after_s <= 60
    assert g.admit("token_read", "203.0.113.0/24", "t:" + "e" * 24).ok
    c.advance(61)
    assert g.admit("token_read", net, "t:" + "f" * 24).ok


def test_the_global_flood_cap_spares_known_good_tokens():
    c = Clock()
    g = gate(c)
    good = "t:" + "a" * 24
    g.success(good)
    for i in range(300):  # 300 failures spread over 30 networks: no network reaches 20
        g.failure(f"198.51.{i % 30}.0/24")
    fresh = g.admit("token_read", "203.0.113.0/24", "t:" + "b" * 24)
    assert (fresh.ok, fresh.reason) == (False, "flood")  # a fresh link's first open meets the 429 (the page says "try again")
    assert g.admit("token_read", "203.0.113.0/24", good).ok  # a vendor already working is not locked out
    # the mark lasts known_good_ttl_s after the last successful lookup; a new flood then catches the token too
    c.advance(g.limits.known_good_ttl_s + 1)
    for i in range(300):
        g.failure(f"198.51.{i % 30}.0/24")
    assert g.admit("token_read", "203.0.113.0/24", good).reason == "flood"
    # a token whose lookup fails loses its mark at once
    g.success(good)
    assert g.known_good(good)
    g.failure("203.0.113.0/24", good)
    assert not g.known_good(good)


def test_requests_without_a_token_are_failures_without_any_lookup():
    c = Clock()
    g = gate(c)
    d = g.admit("token_write", "198.51.100.0/24", None)
    assert (d.ok, d.reason) == (False, "no_token")


def test_per_token_caps_requests_writes_photos_files():
    c = Clock()
    g = gate(c)
    net, tok = "198.51.100.0/24", "t:" + "c" * 24
    g.success(tok)
    assert sum(g.admit("token_read", net, tok).ok for _ in range(70)) == 60
    c.advance(61)
    assert sum(g.admit("token_write", net, tok).ok for _ in range(25)) == 20
    c.advance(3601)
    assert sum(g.admit("photo", net, tok).ok for _ in range(15)) == 10
    c.advance(3601)
    assert sum(g.admit("claim_file", net, tok).ok for _ in range(45)) == 40  # 40/h but also <= 60/min
    trips = g.trips()
    assert trips["token_rate"] >= 10 and trips["write_rate"] == 5 and trips["photo_rate"] == 5


def test_redeem_and_static_have_their_own_network_caps():
    c = Clock()
    g = gate(c)
    net = "198.51.100.0/24"
    assert sum(g.admit("redeem", net).ok for _ in range(12)) == 10
    assert sum(g.admit("static", net).ok for _ in range(130)) == 120
    with pytest.raises(ValueError):
        g.admit("nonsense", net)


def test_failures_from_many_threads_are_counted_exactly():
    c = Clock()
    g = gate(c)

    def worker(i: int):
        for _ in range(10):
            g.failure(f"198.51.100.{i}")

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(25)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert g.limiter.count("fail:*", 60) == 250


def test_minute_counter_keeps_24_hours():
    c = Clock(0.0)
    m = rl.MinuteCounter(c)
    m.add(3)
    c.advance(3600)
    m.add(2)
    assert m.total() == 5 and m.total(30) == 2
    c.advance(86400)
    assert m.total() == 0
