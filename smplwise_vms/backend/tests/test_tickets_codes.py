"""CR-038 verification codes (services/tickets/codes.py, option B, spec 10.5): 6 fixed digits, derived from the code row id
(never stored), send caps per link (rows) and per recipient (limiter), 5 wrong per 15 min -> 30 min lock, malformed and
no-live-code guesses not counted, single use under concurrency, sessions bound to link + generation, the D6 channel rule in
every combination, fuzzed parsing. In-memory fakes only."""
from __future__ import annotations

import dataclasses
import itertools
import random
import string
import threading

import pytest

from smplwise.services.tickets import codes as cd
from smplwise.services.tickets import links
from smplwise.services.tickets.ratelimit import new_public_limiter
from tests.tickets_public_fakes import KEY, Clock, FakeCodes, FakeLinks


@pytest.fixture()
def env():
    clock = Clock()
    store = FakeCodes()
    engine = cd.CodeEngine(store, lambda: KEY, limiter=new_public_limiter(clock), clock=clock)
    fl = FakeLinks(clock)
    link, _ = fl.add(require_code=True)
    return clock, store, engine, link, fl


def the_code(issued: cd.Issued) -> str:
    return cd.derive_code(KEY, issued.code_id)  # what the outbox worker renders


def wrong(code: str) -> str:
    return f"{(int(code) + 1) % 10 ** 6:06d}"


# ---------------------------------------------------------------- the code itself


def test_code_is_six_digits_derived_and_stored_only_as_the_spec_hmac(env):
    clock, store, engine, link, _ = env
    issued = engine.issue(link, "whatsapp")
    code = the_code(issued)
    assert len(code) == 6 and code.isdigit()
    rec = store.latest_code(link.link_id)
    assert rec.id == issued.code_id and rec.channel == "whatsapp" and rec.expires_at == clock() + 600
    assert rec.code_hash == cd.code_hash(KEY, link.link_id, code) and code not in rec.code_hash
    assert code not in repr(rec)


def test_derived_codes_are_uniform_enough():
    counts = [0] * 10
    for _ in range(20000):
        counts[int(cd.derive_code(KEY, cd.new_code_id())[0])] += 1
    assert min(counts) > 1700 and max(counts) < 2300  # first digit ~ uniform (expected 2000 each)


@pytest.mark.parametrize("raw,expected", [
    ("123456", "123456"), (" 123456 ", "123456"), ("123 456", "123456"), ("123-456", "123456"), ("12 34 56", "123456"),
    ("١٢٣٤٥٦", "123456"), ("۱۲۳۴۵۶", "123456"), ("１２３４５６", "123456"), ("000000", "000000"),
    ("12345", None), ("1234567", None), ("12a456", None), ("123  456", None), ("-123456", None), ("123456-", None),
    ("+123456", None), ("12.3456", None), ("", None), ("¹²³⁴⁵⁶", None), (None, None), (123456, None), ("1" * 40, None),
])
def test_code_parsing(raw, expected):
    assert cd.parse_code(raw) == expected


def test_fuzz_code_parsing_never_raises_and_only_yields_six_ascii_digits():
    rng = random.Random(1005)
    pool = string.printable + "٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹０１２３４５６７８９​‮  ‐-–"
    for _ in range(8000):
        s = "".join(rng.choice(pool) for _ in range(rng.randint(0, 14)))
        out = cd.parse_code(s)
        assert out is None or (len(out) == 6 and out.isascii() and out.isdigit())


# ---------------------------------------------------------------- sending


def test_send_caps_one_a_minute_three_an_hour_six_a_day(env):
    clock, store, engine, link, _ = env
    engine.issue(link, "whatsapp")
    with pytest.raises(cd.CodeRefused) as e:
        engine.issue(link, "whatsapp")
    assert e.value.reason == "rate_limited" and 0 < e.value.retry_after_s <= 60
    clock.advance(61)
    engine.issue(link, "whatsapp")
    clock.advance(61)
    engine.issue(link, "whatsapp")
    clock.advance(61)
    with pytest.raises(cd.CodeRefused) as e:
        engine.issue(link, "whatsapp")  # the 4th within the hour
    assert e.value.reason == "rate_limited" and e.value.retry_after_s > 3000
    issued = 3
    for _ in range(10):
        clock.advance(3601)
        try:
            for _ in range(3):
                engine.issue(link, "whatsapp")
                issued += 1
                clock.advance(61)
        except cd.CodeRefused:
            pass
    assert len(store.code_times_since(link.link_id, clock() - 86400)) <= 6


def test_a_new_code_invalidates_the_previous_one(env):
    clock, store, engine, link, _ = env
    first = the_code(engine.issue(link, "whatsapp"))
    clock.advance(61)
    second = the_code(engine.issue(link, "email"))
    if first != second:
        with pytest.raises(cd.CodeRefused):
            engine.verify(link, first)
    assert engine.verify(link, second).session


def test_six_codes_an_hour_per_recipient_across_links(env):
    clock, store, engine, _link, fl = env
    shared = "r" * 64
    issued = 0
    with pytest.raises(cd.CodeRefused) as e:
        for _ in range(7):
            other, _ = fl.add(require_code=True, recipient_key=shared)
            engine.issue(other, "whatsapp")
            issued += 1
    assert issued == 6 and e.value.reason == "rate_limited"


def test_issue_refuses_while_locked_and_an_unknown_channel(env):
    clock, store, engine, link, _ = env
    with pytest.raises(ValueError):
        engine.issue(link, "sms")
    code = the_code(engine.issue(link, "whatsapp"))
    for _ in range(5):
        with pytest.raises(cd.CodeRefused):
            engine.verify(link, wrong(code))
    clock.advance(61)
    with pytest.raises(cd.CodeRefused) as e:
        engine.issue(link, "whatsapp")
    assert e.value.reason == "locked"


# ---------------------------------------------------------------- verifying


def test_correct_code_gives_a_session_once(env):
    clock, store, engine, link, _ = env
    code = the_code(engine.issue(link, "whatsapp"))
    v = engine.verify(link, f" {code[:3]} {code[3:]} ")
    assert links.parse_session(v.session) == v.session and v.expires_at == clock() + 43200
    assert store.session(links.session_hash(v.session)).link_id == link.link_id
    assert v.session not in repr(store.sessions)  # only the hash is kept
    with pytest.raises(cd.CodeRefused) as e:
        engine.verify(link, code)
    assert e.value.reason == "no_code"


def test_session_is_bound_to_link_generation_and_expiry(env):
    clock, store, engine, link, fl = env
    v = engine.verify(link, the_code(engine.issue(link, "whatsapp")))
    assert engine.session_ok(link, v.session)
    assert not engine.session_ok(dataclasses.replace(link, generation=2), v.session)  # a new link kills it
    other, _ = fl.add(require_code=True)
    assert not engine.session_ok(other, v.session)
    for bad in (None, "", v.session + "x", v.session[:-1], links.new_session_value()):
        assert not engine.session_ok(link, bad)
    clock.advance(43201)
    assert not engine.session_ok(link, v.session)


def test_session_never_outlives_its_link(env):
    clock, store, engine, _l, fl = env
    short, _ = fl.add(require_code=True, ttl_s=600)
    v = engine.verify(short, the_code(engine.issue(short, "whatsapp")))
    assert v.expires_at == short.expires_at


def test_five_wrong_codes_lock_the_link_for_thirty_minutes(env):
    clock, store, engine, link, _ = env
    code = the_code(engine.issue(link, "whatsapp"))
    lefts = []
    for _ in range(4):
        with pytest.raises(cd.CodeRefused) as e:
            engine.verify(link, wrong(code))
        lefts.append((e.value.reason, e.value.attempts_left))
    assert lefts == [("invalid", 4), ("invalid", 3), ("invalid", 2), ("invalid", 1)]
    with pytest.raises(cd.CodeRefused) as e:
        engine.verify(link, wrong(code))
    assert (e.value.reason, e.value.attempts_left, e.value.retry_after_s) == ("locked", 0, 1800)
    with pytest.raises(cd.CodeRefused) as e:
        engine.verify(link, code)  # even the right code while locked
    assert e.value.reason == "locked" and 0 < e.value.retry_after_s <= 1800
    assert engine.locked_for(link) == pytest.approx(1800)
    clock.advance(1801)
    with pytest.raises(cd.CodeRefused) as e:
        engine.verify(link, code)
    assert e.value.reason in ("expired", "no_code")  # the code died with the lock; a new one is needed
    engine.issue(link, "whatsapp")


def test_the_failure_window_is_fifteen_minutes(env):
    clock, store, engine, link, _ = env
    code = the_code(engine.issue(link, "whatsapp"))
    for _ in range(4):  # four failures inside the first 3 minutes
        with pytest.raises(cd.CodeRefused) as e:
            engine.verify(link, wrong(code))
        assert e.value.reason == "invalid"
        clock.advance(60)
    clock.advance(15 * 60 - 4 * 60 + 1)  # 15 minutes after the window started
    code = the_code(engine.issue(link, "whatsapp"))  # the first code expired meanwhile
    with pytest.raises(cd.CodeRefused) as e:
        engine.verify(link, wrong(code))
    assert (e.value.reason, e.value.attempts_left) == ("invalid", 4)  # the window restarted: the 5th failure does not lock


def test_malformed_values_and_guesses_without_a_live_code_are_not_counted(env):
    """Review T5a: a stranger holding the forwarded link cannot lock the vendor out before a code exists."""
    clock, store, engine, link, _ = env
    for _ in range(20):
        with pytest.raises(cd.CodeRefused) as e:
            engine.verify(link, "123456")
        assert e.value.reason == "no_code"
        with pytest.raises(cd.CodeRefused) as e:
            engine.verify(link, "12345x")
        assert e.value.reason == "malformed"
    issued = engine.issue(link, "whatsapp")
    clock.advance(601)
    for _ in range(20):
        with pytest.raises(cd.CodeRefused) as e:
            engine.verify(link, "123456")
        assert e.value.reason == "expired"
    assert store.failures(link.link_id) is None and engine.locked_for(link) == 0
    assert store.latest_code(link.link_id).id == issued.code_id


def test_reset_after_a_lock_is_the_managers_new_link(env):
    clock, store, engine, link, _ = env
    code = the_code(engine.issue(link, "whatsapp"))
    for _ in range(5):
        with pytest.raises(cd.CodeRefused):
            engine.verify(link, wrong(code))
    assert engine.locked_for(link) > 0
    engine.reset(link.link_id)
    new_link = dataclasses.replace(link, generation=link.generation + 1)
    assert engine.locked_for(new_link) == 0
    clock.advance(61)
    assert engine.verify(new_link, the_code(engine.issue(new_link, "whatsapp"))).session


def test_a_new_generation_does_not_accept_the_old_generations_code_even_without_reset(env):
    """Code review V8 / W8: the manager's "new link" bumps the generation; a code issued under generation N must not verify
    under N+1, and N's failure window must not lock N+1 - without relying on the caller remembering reset()."""
    clock, store, engine, link, _ = env
    old_code = the_code(engine.issue(link, "whatsapp"))
    new_link = dataclasses.replace(link, generation=link.generation + 1)
    with pytest.raises(cd.CodeRefused) as e:
        engine.verify(new_link, old_code)
    assert e.value.reason == "no_code"
    for _ in range(5):  # lock generation N
        with pytest.raises(cd.CodeRefused):
            engine.verify(link, wrong(old_code))
    assert engine.locked_for(link) > 0
    assert engine.locked_for(new_link) == 0  # N+1 starts clean
    clock.advance(61)
    fresh = the_code(engine.issue(new_link, "whatsapp"))
    assert engine.verify(new_link, fresh).session


def test_withdrawn_code_is_dead_but_still_counts(env):
    clock, store, engine, link, _ = env
    issued = engine.issue(link, "whatsapp")
    engine.withdraw(link, issued.code_id)
    with pytest.raises(cd.CodeRefused) as e:
        engine.verify(link, the_code(issued))
    assert e.value.reason == "expired"
    with pytest.raises(cd.CodeRefused) as e:
        engine.issue(link, "whatsapp")
    assert e.value.reason == "rate_limited"


def test_parallel_guesses_are_counted_exactly_and_never_pass(env):
    clock, store, engine, link, _ = env
    code = the_code(engine.issue(link, "whatsapp"))
    results: list[str] = []
    lock = threading.Lock()

    def guess(n: int):
        g = f"{(int(code) + 1 + n) % 10 ** 6:06d}"
        try:
            engine.verify(link, g)
            r = "ok"
        except cd.CodeRefused as exc:
            r = exc.reason
        with lock:
            results.append(r)

    threads = [threading.Thread(target=guess, args=(i,)) for i in range(40)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert "ok" not in results
    assert results.count("invalid") == 4 and results.count("locked") == 36
    assert store.latest_code(link.link_id).attempts == 5


def test_two_parallel_correct_codes_get_one_session(env):
    clock, store, engine, link, _ = env
    code = the_code(engine.issue(link, "whatsapp"))
    out: list[str] = []
    barrier = threading.Barrier(8)

    def attempt():
        barrier.wait()
        try:
            out.append(engine.verify(link, code).session)
        except cd.CodeRefused as exc:
            out.append(exc.reason)

    threads = [threading.Thread(target=attempt) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sum(1 for r in out if links.parse_session(r)) == 1 and out.count("no_code") == 7


def test_policy_from_settings_keeps_safe_bounds():
    p = cd.CodePolicy.from_settings({"ttl_min": 5, "max_attempts": 3, "lock_min": 60})
    assert (p.ttl_s, p.max_attempts, p.lock_s) == (300, 3, 3600)
    for bad in ({"ttl_min": 0}, {"ttl_min": 999}, {"max_attempts": 1}, {"max_attempts": True}, {"lock_min": "30"}, None, "x"):
        q = cd.CodePolicy.from_settings(bad)  # type: ignore[arg-type]
        assert (q.ttl_s, q.max_attempts, q.lock_s) == (600, 5, 1800)
    assert not hasattr(cd.CodePolicy(), "length") and cd.CODE_DIGITS == 6


# ---------------------------------------------------------------- the D6 channel rule


def test_code_channel_rule_in_every_combination():
    for via, wa, phone, mail, has_mail in itertools.product((None, "whatsapp", "email", "manual"), (True, False), (True, False),
                                                           (True, False), (True, False)):
        got = cd.code_channel(link_sent_via=via, whatsapp_ready=wa, has_phone=phone, email_ready=mail, has_email=has_mail)
        if wa and phone:
            expected = "whatsapp"
        elif via in ("whatsapp", "manual") and mail and has_mail:
            expected = "email"  # a different channel from the link's
        else:
            expected = None  # e-mail link -> the code must go by WhatsApp; an unsent link gets no fallback
        assert got == expected, (via, wa, phone, mail, has_mail)
    assert cd.code_channel(link_sent_via="email", whatsapp_ready=False, has_phone=True, email_ready=True, has_email=True) is None


def test_require_code_is_raise_only():
    assert cd.effective_require_code(True, False) is True
    assert cd.effective_require_code(True, None) is True
    assert cd.effective_require_code(False, True) is True
    assert cd.effective_require_code(False, None) is False
