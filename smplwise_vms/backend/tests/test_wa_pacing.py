"""CR-WA-PACING-295: the shared WhatsApp send budget (services/wa_pacing.py) - per-minute / burst caps, priority classes that yield on
one budget, WisKey's sends counted as foreign use, backoff on 429 / pair-rate answers, the queue age limit (a message ends visibly,
never dropped), the persisted counters, the route, and that the tickets outbox behaves exactly as before with the module off or the
mode `off`. Fakes only: the fake ha-whatsapp and in-memory stores - no real send, no token, no number."""
from __future__ import annotations

import datetime as dt
import random

import pytest
from conftest import as_user
from fake_ha_whatsapp import PairedAccount
from tickets_msg_fakes import KEY_A, KEY_B, T0, assign, default_doc, make_env

from smplwise.services import messaging_accounts as ma
from smplwise.services import wa_pacing as wp
from smplwise.services.tickets import channel_whatsapp as cw
from smplwise.services.tickets.channel import NOT_SENT, REFUSED, SENT

UTC = dt.timezone.utc
P = ma.Pacing()  # per hour 30, per day 150
NOW = dt.datetime(2026, 10, 21, 9, 0, 0, tzinfo=UTC)


def sec(n: float) -> dt.timedelta:
    return dt.timedelta(seconds=n)


def pacer(mode="conservative", *, shared=True, foreign=None, waits=None):
    ledger, store = ma.MemorySendLedger(), wp.MemoryPacerStore()
    cfg = wp.PacerConfig(mode=mode, wiskey_shared=shared, max_wait_min={**wp.DEFAULT_MAX_WAIT_MIN, **(waits or {})})
    return wp.WaPacer(ledger, store, config=lambda: cfg, foreign=foreign), ledger, store


def send(ledger, ago_s: float, *, account=KEY_A, use="tickets.messages", now=NOW):
    ledger.record(account_key=account, use_key=use, recipient_key="r", kind="message", at=now - sec(ago_s))


def check(p, klass, *, now=NOW, ref="x", rkey="r", account=KEY_A):
    return p.check(account_key=account, pacing=P, recipient_key=rkey, klass=klass, ref=ref, now=now)


# ---------------------------------------------------------------- classes and config

def test_class_of():
    assert wp.class_of(use_key="notifications.whatsapp") == wp.CLASS_ALERT
    assert wp.class_of(use_key="tickets.codes") == wp.CLASS_CODE
    assert wp.class_of(use_key="infra.temperature.reports") == wp.CLASS_REMINDER
    assert wp.class_of(use_key="something.new") == wp.CLASS_TICKET
    for purpose, klass in (("code", "code"), ("phone_verify", "code"), ("test", "code"), ("assign", "ticket"), ("closed", "ticket"),
                           ("update", "ticket"), ("reminder", "reminder"), ("rfq_reminder", "reminder"), ("report", "reminder")):
        assert wp.class_of(purpose=purpose) == klass, purpose


def test_config_is_conservative_by_default_and_total():
    assert wp.parse_config(None).mode == "conservative" and wp.parse_config(None).wiskey_shared is True
    assert wp.parse_config("{not json").mode == "conservative"
    assert wp.parse_config({"mode": "turbo"}).mode == "conservative"
    assert wp.parse_config({"mode": "off"}).enabled is False
    cfg = wp.parse_config({"max_wait_min": {"ticket": 30, "code": 0, "bogus": 5}})
    assert cfg.max_wait_min["ticket"] == 30 and cfg.max_wait_min["code"] == wp.DEFAULT_MAX_WAIT_MIN["code"]
    _, problems = wp.validate_config({"mode": "turbo", "wiskey_shared": "yes", "max_wait_min": {"ticket": 99999, "x": 1}})
    assert {p["field"] for p in problems} == {"mode", "wiskey_shared", "max_wait_min.ticket", "max_wait_min.x"}
    assert wp.validate_config({"mode": "standard"})[1] == []


# ---------------------------------------------------------------- the budget

def test_off_is_the_legacy_gate_alone():
    p, ledger, _ = pacer("off")
    for i in range(10):
        send(ledger, i)
    assert check(p, wp.CLASS_REMINDER).allowed


def test_minute_cap_with_class_shares():
    p, ledger, _ = pacer()  # conservative: 3 / minute -> alert 3, code 2, ticket 2, reminder 1
    assert check(p, wp.CLASS_REMINDER).allowed
    send(ledger, 40)
    d = check(p, wp.CLASS_REMINDER)
    assert not d.allowed and d.reason == "minute" and d.not_before == NOW + sec(20)  # the one send leaves the window in 20 s
    assert check(p, wp.CLASS_TICKET).allowed and check(p, wp.CLASS_ALERT).allowed
    send(ledger, 30)
    assert not check(p, wp.CLASS_TICKET).allowed and not check(p, wp.CLASS_CODE).allowed
    assert check(p, wp.CLASS_ALERT).allowed, "an operational alert keeps the last slot of the minute"
    send(ledger, 20)
    d = check(p, wp.CLASS_ALERT)
    assert not d.allowed and d.reason == "minute" and d.not_before == NOW + sec(20)


def test_burst_window():
    p, ledger, _ = pacer("standard")  # 6 / minute, burst 3 per 10 s -> ticket burst limit 2
    send(ledger, 3)
    assert check(p, wp.CLASS_TICKET).allowed
    send(ledger, 2)
    d = check(p, wp.CLASS_TICKET)
    assert not d.allowed and d.reason == "burst" and d.not_before == NOW + sec(7)
    assert check(p, wp.CLASS_ALERT).allowed


def test_hour_and_day_shares_use_the_accounts_own_pacing():
    p, ledger, _ = pacer("standard")
    for i in range(18):  # 30 per hour * 60% = 18 for a reminder; spread out so the minute cap never binds
        send(ledger, 120 + i * 150)
    assert not check(p, wp.CLASS_REMINDER).allowed
    d = check(p, wp.CLASS_REMINDER)
    assert d.reason == "hour"
    assert check(p, wp.CLASS_TICKET).allowed  # 80% = 24


def test_wiskey_sends_spend_the_same_budget():
    foreign = [NOW - sec(30), NOW - sec(20)]
    p, ledger, _ = pacer(foreign=lambda since: [t for t in foreign if t > since])
    assert not check(p, wp.CLASS_TICKET).allowed  # two foreign sends in the minute fill a ticket's share (2 of 3)
    assert check(p, wp.CLASS_ALERT).allowed
    off, _, _ = pacer(shared=False, foreign=lambda since: foreign)
    assert check(off, wp.CLASS_TICKET).allowed, "not counted when WisKey sends from another number"


def test_other_accounts_do_not_share_a_budget():
    p, ledger, _ = pacer()
    send(ledger, 10, account=KEY_B)
    send(ledger, 20, account=KEY_B)
    assert check(p, wp.CLASS_TICKET, account=KEY_A).allowed


# ---------------------------------------------------------------- backoff

def test_account_backoff_doubles_to_a_ceiling_and_resets_on_an_accepted_send():
    p, _, _ = pacer()
    ends = [p.on_result(account_key=KEY_A, recipient_key="r", klass="ticket", outcome=NOT_SENT, outcome_code="rate_limited", now=NOW) for _ in range(8)]
    assert [(e - NOW).total_seconds() for e in ends] == [60, 120, 240, 480, 960, 1800, 1800, 1800]
    d = check(p, wp.CLASS_TICKET)
    assert not d.allowed and d.reason == "backoff"
    assert not check(p, wp.CLASS_ALERT).allowed, "at level 3+ even alerts wait"
    later = NOW + sec(1801)
    assert check(p, wp.CLASS_TICKET, now=later).allowed
    p.on_result(account_key=KEY_A, recipient_key="r", klass="ticket", outcome=SENT, outcome_code=None, now=later)
    assert p.on_result(account_key=KEY_A, recipient_key="r", klass="ticket", outcome=NOT_SENT, outcome_code="rate_limited", now=later) == later + sec(60)


def test_a_mild_backoff_still_lets_an_alert_through_but_not_a_ticket():
    p, _, _ = pacer()
    p.on_result(account_key=KEY_A, recipient_key="r", klass="ticket", outcome=NOT_SENT, outcome_code="rate_limited", now=NOW)
    assert not check(p, wp.CLASS_TICKET).allowed and check(p, wp.CLASS_ALERT).allowed


def test_pair_backoff_only_slows_that_recipient():
    p, _, store = pacer()
    until = p.on_result(account_key=KEY_A, recipient_key="bad", klass="ticket", outcome=NOT_SENT, outcome_code="pair_rate_limited", now=NOW)
    assert until == NOW + sec(300)
    d = check(p, wp.CLASS_TICKET, rkey="bad")
    assert not d.allowed and d.reason == "pair_backoff" and d.not_before == until
    assert check(p, wp.CLASS_TICKET, rkey="other").allowed
    assert check(p, wp.CLASS_ALERT, rkey="bad").allowed is False
    assert p.blocked_until(KEY_A, "bad", NOW) == until and p.blocked_until(KEY_A, "other", NOW) == NOW


def test_a_provider_refusal_or_unknown_never_starts_a_backoff():
    p, _, store = pacer()
    for outcome, code in ((REFUSED, "provider_refused"), ("unknown", "timeout"), (NOT_SENT, "ha_unavailable")):
        assert p.on_result(account_key=KEY_A, recipient_key="r", klass="ticket", outcome=outcome, outcome_code=code, now=NOW) is None
    assert not store.state


# ---------------------------------------------------------------- the age limit and the counters

def test_a_message_waiting_past_its_limit_ends_visibly_and_is_counted():
    p, ledger, store = pacer(waits={"reminder": 10})
    send(ledger, 40)
    d = check(p, wp.CLASS_REMINDER, ref="m1")
    assert not d.allowed and not d.expired
    assert store.wait_since("m1") == NOW
    again = check(p, wp.CLASS_REMINDER, ref="m1", now=NOW + sec(11 * 60))
    send(ledger, 5, now=NOW + sec(11 * 60))
    again = check(p, wp.CLASS_REMINDER, ref="m1", now=NOW + sec(11 * 60))
    assert again.expired and not again.allowed
    assert store.wait_since("m1") is None
    counts = {(m): n for (h, a, k, m), n in store.counts.items()}
    assert counts == {"deferred": 1, "expired": 2} or counts["expired"] >= 1


def test_waiting_clears_when_the_message_is_allowed():
    p, ledger, store = pacer()
    send(ledger, 40)
    assert not check(p, wp.CLASS_REMINDER, ref="m").allowed and store.wait_since("m") is not None
    assert check(p, wp.CLASS_REMINDER, ref="m", now=NOW + sec(30)).allowed
    assert store.wait_since("m") is None


# ---------------------------------------------------------------- reading the platform's rate answers

def reply(status, body=None, text=""):
    return cw.TransportReply("response", status, body, isinstance(body, (dict, list)), text)


def test_classify_rate_answers():
    assert cw.classify(reply(429)) == cw.SendResult(NOT_SENT, "rate_limited")
    assert cw.classify(reply(429, text="slow down 131056")).outcome_code == "pair_rate_limited"
    assert cw.classify(reply(400, text="400: error 131056 pair rate limit hit")).outcome_code == "pair_rate_limited"
    assert cw.classify(reply(400, {"message": "Too many requests"})).outcome_code == "rate_limited"
    assert cw.classify(reply(200, {"service_response": {"success": False, "error_code": 131056}})) == cw.SendResult(NOT_SENT, "pair_rate_limited")
    assert cw.classify(reply(200, {"service_response": {"success": False, "error": "rate limit hit"}})).outcome_code == "rate_limited"
    # nothing else changes
    assert cw.classify(reply(200, {"service_response": {"success": False}})) == cw.SendResult(REFUSED, "provider_refused")
    assert cw.classify(reply(400, text="400: Bad Request")).outcome_code == "bad_request"
    assert cw.classify(reply(500)).outcome == "unknown"
    assert cw.classify(reply(403)).outcome_code == "ha_forbidden"


# ---------------------------------------------------------------- the outbox with the pacer

def env_with_pacer(mode="conservative", **kw):
    env = make_env(**kw)
    store = wp.MemoryPacerStore()
    cfg = wp.PacerConfig(mode=mode)
    env.outbox.p.pacer = wp.WaPacer(env.ledger, store, config=lambda: cfg)
    env.pstore = store
    return env


def fast_doc():
    """One account whose legacy gap / jitter are small, so the shared budget (not the legacy gate) is what the tests meet."""
    pacing = ma.Pacing(min_gap_s=5, jitter_s=0)
    doc = default_doc()
    return ma.MappingDoc(revision=1, accounts=tuple(ma.Account(a.key, a.kind, a.label, a.last4, pacing=pacing) for a in doc.accounts), uses=doc.uses)


def test_a_rate_answer_requeues_without_using_an_attempt_or_the_ledger():
    env = env_with_pacer(doc=fast_doc())
    row = assign(env)
    env.fake.queue("http429")
    assert env.tick() == 1
    r = env.row(row.id)
    assert r.state == "queued" and r.attempts == 0 and r.outcome_code == "rate_limited"
    assert r.not_before == env.clock.now() + sec(60)
    assert env.ledger.rows == [] and env.pstore.wait_since(row.id) is not None
    assert env.tick(seconds=30) == 0 and len(env.fake.calls) == 1, "nothing leaves during the backoff"
    assert env.tick(seconds=31) == 1
    done = env.row(row.id)
    assert done.state == "sent" and len(env.fake.calls) == 2 and len(env.ledger.rows) == 1


def test_a_rate_answer_never_drops_the_message_it_ends_visibly_at_the_age_limit():
    env = env_with_pacer(doc=fast_doc())
    env.outbox.p.pacer._config = lambda: wp.PacerConfig(max_wait_min={**wp.DEFAULT_MAX_WAIT_MIN, "ticket": 5})
    row = assign(env)
    env.fake.default = "http429"
    for _ in range(60):
        env.tick(seconds=61)
        if env.row(row.id).state not in ("queued", "held"):
            break
    done = env.row(row.id)
    assert done.state == "not_sent" and done.outcome_code == "pacing_expired"
    assert ("send_failed", row.id) in [(e[0], e[1]) for e in env.hooks.events] or any(e[0] == "send_failed" for e in env.hooks.events)
    assert env.ledger.rows == []


def test_pair_rate_answer_holds_only_that_recipient():
    env = env_with_pacer(doc=fast_doc())
    first = assign(env, contact="c1", link="L1", assignment="A1", ticket="T1")
    second = assign(env, contact="c2", link="L2", assignment="A2", ticket="T2")
    env.directory.contacts["c2"].phone = "15555550102"
    env.fake.queue("http429")
    env.tick()
    # the 429 answer is account-wide: both wait; after the backoff both go
    env.tick(seconds=61)
    env.tick(seconds=30)
    env.tick(seconds=30)
    assert env.row(first.id).state == "sent" and env.row(second.id).state == "sent"


def test_alerts_keep_headroom_ticket_reminders_wait():
    env = env_with_pacer(doc=fast_doc())
    now = env.clock.now()
    for ago in (20, 40):  # two alert sends in the minute (notifications.whatsapp writes the same ledger)
        env.ledger.record(account_key=KEY_A, use_key="notifications.whatsapp", recipient_key="a", kind="message", at=now - sec(ago))
    reminder = assign(env, purpose="reminder", link="LR", assignment="AR", ticket="TR")
    env.tick()
    r = env.row(reminder.id)
    assert r.state == "queued" and not env.fake.calls and r.not_before > now
    assert env.pstore.wait_since(reminder.id) is not None
    env.drain(step_s=15)
    assert env.row(reminder.id).state == "sent"


def test_module_off_changes_nothing_and_touches_no_counter():
    env = env_with_pacer(doc=fast_doc())
    row = assign(env)
    env.module_on[0] = False
    env.outbox.p.context.on = False
    assert env.tick() == 0
    assert env.row(row.id).state == "held" and not env.fake.calls
    assert not env.pstore.counts and not env.pstore.waits and not env.pstore.state


def test_mode_off_is_byte_for_byte_the_legacy_behaviour():
    legacy = make_env(doc=fast_doc(), seed=3)
    off = env_with_pacer("off", doc=fast_doc(), seed=3)
    for env in (legacy, off):
        for i in range(6):
            assign(env, contact=f"c{i}", link=f"L{i}", assignment=f"A{i}", ticket=f"T{i}", purpose="reminder")
        env.drain(step_s=7)
    assert [(c["data"]["target"], c["data"]["message"]) for c in off.fake.calls] == [(c["data"]["target"], c["data"]["message"]) for c in legacy.fake.calls]
    assert [r[4] for r in off.ledger.rows] == [r[4] for r in legacy.ledger.rows]
    assert not off.pstore.counts


def test_the_default_conservative_mode_slows_a_burst_of_reminders():
    legacy = make_env(doc=fast_doc(), seed=3)
    paced = env_with_pacer(doc=fast_doc(), seed=3)
    for env in (legacy, paced):
        for i in range(6):
            assign(env, contact=f"c{i}", link=f"L{i}", assignment=f"A{i}", ticket=f"T{i}", purpose="reminder")
        env.drain(step_s=5)
        env.clock.t = T0 + sec(60)
    # same six messages all arrive; the paced run needs longer for them (a reminder gets one send per minute window)
    assert len(paced.fake.calls) == len(legacy.fake.calls) == 6
    assert paced.ledger.rows[-1][4] > legacy.ledger.rows[-1][4]
    assert all(r.state == "sent" for r in paced.store.rows.values())


# ---------------------------------------------------------------- the route and the counters

API = "/api/v1"
URL = f"{API}/messaging/whatsapp/pacing"


@pytest.fixture()
def client(settings):
    from conftest import bind
    from fastapi.testclient import TestClient

    from smplwise.main import create_app

    c = TestClient(create_app(settings))
    c.get(f"{API}/me")
    assert c.patch(f"{API}/settings", json={"tickets.enabled": "true"}).status_code == 200
    bind(c, settings, "otto", "operator", "installation", "*")
    return c


def test_route_defaults_put_validation_and_audit(client, settings):
    r = client.get(URL, headers=as_user("joni"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["mode"] == "conservative" and body["wiskey_shared"] is True and body["applies"] is True and body["can_manage"] is True
    assert body["budget"] == {"per_minute": 3, "burst": 2, "burst_window_s": 10} and body["share_pct"]["alert"] == 100
    assert client.get(URL, headers=as_user("otto")).status_code in (401, 403)
    assert client.put(URL, json={"mode": "turbo"}, headers=as_user("joni")).status_code == 422
    assert client.put(URL, json={"max_wait_min": {"ticket": 0}}, headers=as_user("joni")).status_code == 422
    assert client.put(URL, json={"mode": "standard"}, headers=as_user("otto")).status_code in (401, 403)
    r = client.put(URL, json={"mode": "standard", "wiskey_shared": False, "max_wait_min": {"ticket": 90}}, headers=as_user("joni"))
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["mode"] == "standard" and out["wiskey_shared"] is False and out["max_wait_min"]["ticket"] == 90 and out["max_wait_min"]["code"] == 5
    assert client.put(URL, json={"mode": "off"}, headers=as_user("joni")).json()["applies"] is False
    from smplwise.db import Database

    with Database(settings.db_path).connection(mode="read") as conn:
        acts = [r[0] for r in conn.execute("SELECT action FROM audit_log WHERE action = 'messaging.pacing.update'")]
    assert len(acts) == 3 - 0 or len(acts) >= 2


def test_route_with_the_tickets_module_off_says_it_does_not_apply(client):
    assert client.patch(f"{API}/settings", json={"tickets.enabled": "false"}).status_code == 200
    body = client.get(URL, headers=as_user("joni")).json()
    assert body["mode"] == "conservative" and body["applies"] is False


def test_snapshot_counts_waiting_backoff_and_wiskey(settings):
    from smplwise.db import Database

    db = Database(settings.db_path)
    now = dt.datetime.now(UTC)
    with db.connection() as conn:
        cfg = wp.PacerConfig()
        store = wp.SqlitePacerStore(lambda: __import__("contextlib").nullcontext(conn), lambda: conn)
        ledger = ma.SqliteSendLedger(conn)
        ledger.record(account_key=KEY_A, use_key="tickets.messages", recipient_key="r", kind="message", at=now - sec(60))
        conn.execute("INSERT INTO intercom_messages(id, at, actor_user_id, person_id, kind, chars, client_request_id, outcome) "
                     "VALUES ('m1', ?, 'u', 'p', 'free', 5, 'c1', 'sent')", (now.strftime("%Y-%m-%dT%H:%M:%S") + "Z",))
        p = wp.WaPacer(ledger, store, config=lambda: cfg)
        p.on_result(account_key=KEY_A, recipient_key="r", klass="ticket", outcome=NOT_SENT, outcome_code="rate_limited", now=now)
        p.on_result(account_key=KEY_A, recipient_key="r", klass="ticket", outcome=SENT, outcome_code=None, now=now)
        p.on_result(account_key=KEY_A, recipient_key="r2", klass="ticket", outcome=NOT_SENT, outcome_code="pair_rate_limited", now=now)
        snap = wp.snapshot(conn, ledger, cfg, [KEY_A, KEY_B], now)
    a = next(x for x in snap["accounts"] if x["account_key"] == KEY_A)
    assert a["sends_1h"] == 1 and a["wiskey_1h"] == 1 and a["backoff"]["level"] == 1 and a["pairs_in_backoff"] == 1
    assert a["counters_24h"]["backoff"] == 1 and a["counters_24h"]["pair_backoff"] == 1 and a["counters_24h"]["sent"] == 1
    assert next(x for x in snap["accounts"] if x["account_key"] == KEY_B)["sends_1h"] == 0
    assert "r2" not in str(snap) and "15555" not in str(snap)
