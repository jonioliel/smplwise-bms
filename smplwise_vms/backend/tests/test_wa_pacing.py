"""CR-WA-PACING-295: the shared WhatsApp send budget (services/wa_pacing.py) - per-minute / burst caps (owner numbers 2026-10-21: 10 a
minute, burst 5 per 10 s, 300 an hour, 1500 a day), priority classes that yield on one budget, WisKey's sends as foreign load (Arx's
own record, `whatsapp_pacing_status_v1` charged counters for a verified sender, leases of the reservation port), backoff on 429 /
pair-rate answers (alerts counted, never delayed), the queue age limit (a message ends visibly, never dropped), the persisted
counters, the routes, and that the tickets outbox behaves exactly as before with the module off or the mode `off`. Fakes only: the
fake ha-whatsapp and in-memory stores - no real send, no token, no number."""
from __future__ import annotations

import contextlib
import datetime as dt

import pytest
from conftest import as_user
from tickets_msg_fakes import KEY_A, KEY_B, PHONE_OTHER, T0, assign, default_doc, make_env

from smplwise.services import intercom_messaging_adapter as adapter
from smplwise.services import messaging_accounts as ma
from smplwise.services import wa_pacing as wp
from smplwise.services.tickets import channel_whatsapp as cw
from smplwise.services.tickets.channel import NOT_SENT, REFUSED, SENT

UTC = dt.timezone.utc
P = ma.Pacing()  # 300 an hour, 1500 a day
NOW = dt.datetime(2026, 10, 21, 9, 0, 0, tzinfo=UTC)
REF = "wk-sender-1"


def sec(n: float) -> dt.timedelta:
    return dt.timedelta(seconds=n)


def pacer(mode="conservative", *, shared=True, foreign=None, waits=None, senders=None, wiskey=None, **cfg_kw):
    ledger, store = ma.MemorySendLedger(), wp.MemoryPacerStore()
    cfg = wp.PacerConfig(mode=mode, wiskey_shared=shared, max_wait_min={**wp.DEFAULT_MAX_WAIT_MIN, **(waits or {})}, senders=senders or {}, **cfg_kw)
    return wp.WaPacer(ledger, store, config=lambda: cfg, foreign=foreign, wiskey=wiskey), ledger, store


def send(ledger, ago_s: float, *, account=KEY_A, use="tickets.messages", now=NOW):
    ledger.record(account_key=account, use_key=use, recipient_key="r", kind="message", at=now - sec(ago_s))


def fill(ledger, n: int, *, within_s: float = 50, first_ago: float = 12, now=NOW, **kw):
    """n sends spread over the last minute but outside the 10 s burst window."""
    for i in range(n):
        send(ledger, first_ago + i * (within_s - first_ago) / max(1, n - 1 if n > 1 else 1), now=now, **kw)


def check(p, klass, *, now=NOW, ref="x", rkey="r", account=KEY_A, **kw):
    return p.check(account_key=account, pacing=P, recipient_key=rkey, klass=klass, ref=ref, now=now, **kw)


def wk_status(**over):
    base = {"pacing_schema_version": 1, "sender_ref": REF, "sender_match_verified": True, "counters_complete": True,
            "wiskey_own": {"charged_1m": 0, "charged_1h": 0, "charged_24h": 0}, "throttled_until": None, "throttle_scope": None, "retry_after_s": None,
            "sent_1m": 99, "sent_1h": 99, "sent_24h": 99}
    base.update(over)
    return base


def wk(**over):
    return lambda: wp.parse_wiskey_status([wk_status(**over)])


# ---------------------------------------------------------------- classes and config

def test_class_of():
    assert wp.class_of(use_key="notifications.whatsapp") == wp.CLASS_ALERT
    assert wp.class_of(use_key="tickets.codes") == wp.CLASS_CODE
    assert wp.class_of(use_key="infra.temperature.reports") == wp.CLASS_REMINDER
    assert wp.class_of(use_key="something.new") == wp.CLASS_TICKET
    for purpose, klass in (("code", "code"), ("phone_verify", "code"), ("test", "code"), ("assign", "ticket"), ("closed", "ticket"),
                           ("update", "ticket"), ("reminder", "reminder"), ("rfq_reminder", "reminder"), ("report", "reminder")):
        assert wp.class_of(purpose=purpose) == klass, purpose


def test_the_owner_numbers_are_the_defaults_and_settings():
    assert wp.PROFILES["conservative"] == wp.Budget(per_minute=10, burst=5, burst_window_s=10)
    assert (ma.Pacing().per_hour, ma.Pacing().per_day) == (300, 1500)
    assert ma.Pacing().min_gap_s * 10 <= 60, "the legacy gap must not be the binding limit at 10 a minute"
    cfg = wp.parse_config({"per_minute": 15, "burst": 7})
    assert cfg.budget() == wp.Budget(15, 7, 10)
    assert wp.parse_config({"per_minute": 0, "burst": 999}).budget() == wp.PROFILES["conservative"]


def test_config_is_conservative_by_default_and_total():
    assert wp.parse_config(None).mode == "conservative" and wp.parse_config(None).wiskey_shared is True
    assert wp.parse_config("{not json").mode == "conservative"
    assert wp.parse_config({"mode": "turbo"}).mode == "conservative"
    assert wp.parse_config({"mode": "off"}).enabled is False
    cfg = wp.parse_config({"max_wait_min": {"ticket": 30, "code": 0, "bogus": 5}})
    assert cfg.max_wait_min["ticket"] == 30 and cfg.max_wait_min["code"] == wp.DEFAULT_MAX_WAIT_MIN["code"]
    _, problems = wp.validate_config({"mode": "turbo", "wiskey_shared": "yes", "max_wait_min": {"ticket": 99999, "x": 1}, "per_minute": 0,
                                      "senders": {"entry:A": "bad ref!", "nope": "r1"}})
    assert {p["field"] for p in problems} == {"mode", "wiskey_shared", "max_wait_min.ticket", "max_wait_min.x", "per_minute", "senders.entry:A", "senders.nope"}
    assert wp.validate_config({"mode": "standard"})[1] == []
    assert wp.validate_config({"senders": {"entry:A": "r", "entry:B": "r"}})[1][0]["code"] == "sender_ref_duplicate"


# ---------------------------------------------------------------- the budget

def test_off_is_the_legacy_gate_alone():
    p, ledger, _ = pacer("off")
    for i in range(30):
        send(ledger, i)
    assert check(p, wp.CLASS_REMINDER).allowed


def test_minute_cap_with_class_shares():
    p, ledger, _ = pacer()  # 10 a minute -> alert 10, code 9, ticket 8, reminder 6
    fill(ledger, 5)
    assert all(check(p, k).allowed for k in wp.CLASSES)
    send(ledger, 55)  # six in the minute
    d = check(p, wp.CLASS_REMINDER)
    assert not d.allowed and d.reason == "minute" and d.not_before == NOW + sec(5)  # the oldest leaves the window in 5 s
    assert check(p, wp.CLASS_TICKET).allowed
    fill(ledger, 2, first_ago=30)
    assert not check(p, wp.CLASS_TICKET).allowed and check(p, wp.CLASS_CODE).allowed and check(p, wp.CLASS_ALERT).allowed
    send(ledger, 40)
    assert not check(p, wp.CLASS_CODE).allowed, "9 in the minute: a code waits too"
    assert check(p, wp.CLASS_ALERT).allowed, "an operational alert keeps the last slot of the minute"
    send(ledger, 41)
    d = check(p, wp.CLASS_ALERT)
    assert not d.allowed and d.reason == "minute"


def test_burst_window():
    p, ledger, _ = pacer("standard")  # 20 a minute, burst 8 per 10 s -> ticket burst limit 6, reminder 4
    for ago in (1, 2, 3, 4, 5):
        send(ledger, ago)
    assert check(p, wp.CLASS_TICKET).allowed and not check(p, wp.CLASS_REMINDER).allowed
    send(ledger, 6)
    d = check(p, wp.CLASS_TICKET)
    assert not d.allowed and d.reason == "burst" and d.not_before == NOW + sec(4)  # the oldest of the six leaves the 10 s window in 4 s
    assert check(p, wp.CLASS_ALERT).allowed


def test_hour_and_day_shares_use_the_accounts_own_pacing():
    p, ledger, _ = pacer("standard")
    for i in range(180):  # 300 an hour * 60% = 180 for a reminder; spread out so the minute cap never binds
        send(ledger, 100 + i * 19)
    d = check(p, wp.CLASS_REMINDER)
    assert not d.allowed and d.reason == "hour"
    assert check(p, wp.CLASS_TICKET).allowed  # 80% = 240


def test_wiskey_sends_in_arxs_record_spend_the_same_budget():
    foreign = [NOW - sec(20 + i) for i in range(8)]
    p, ledger, _ = pacer(foreign=lambda since: [t for t in foreign if t > since])
    assert not check(p, wp.CLASS_TICKET).allowed  # eight foreign sends in the minute fill a ticket's share (8 of 10)
    assert check(p, wp.CLASS_ALERT).allowed
    off, _, _ = pacer(shared=False, foreign=lambda since: foreign)
    assert check(off, wp.CLASS_TICKET).allowed, "not counted when WisKey sends from another number"
    mapped, _, _ = pacer(foreign=lambda since: foreign, senders={KEY_B: REF})
    assert check(mapped, wp.CLASS_TICKET, account=KEY_A).allowed, "with a sender mapping only the mapped accounts carry WisKey"
    assert not check(mapped, wp.CLASS_TICKET, account=KEY_B).allowed


def test_other_accounts_do_not_share_a_budget():
    p, ledger, _ = pacer()
    fill(ledger, 10, account=KEY_B)
    assert check(p, wp.CLASS_TICKET, account=KEY_A).allowed


# ---------------------------------------------------------------- backoff

def test_account_backoff_doubles_to_a_ceiling_and_resets_on_an_accepted_send():
    p, _, _ = pacer()
    ends = [p.on_result(account_key=KEY_A, recipient_key="r", klass="ticket", outcome=NOT_SENT, outcome_code="rate_limited", now=NOW) for _ in range(8)]
    assert [(e - NOW).total_seconds() for e in ends] == [60, 120, 240, 480, 960, 1800, 1800, 1800]
    d = check(p, wp.CLASS_TICKET)
    assert not d.allowed and d.reason == "backoff"
    assert check(p, wp.CLASS_ALERT).allowed, "owner 2026-10-21: alerts are counted but never delayed by a backoff, however deep"
    later = NOW + sec(1801)
    assert check(p, wp.CLASS_TICKET, now=later).allowed
    p.on_result(account_key=KEY_A, recipient_key="r", klass="ticket", outcome=SENT, outcome_code=None, now=later)
    assert p.on_result(account_key=KEY_A, recipient_key="r", klass="ticket", outcome=NOT_SENT, outcome_code="rate_limited", now=later) == later + sec(60)


def test_pair_backoff_only_slows_that_recipient_and_never_an_alert():
    p, _, store = pacer()
    until = p.on_result(account_key=KEY_A, recipient_key="bad", klass="ticket", outcome=NOT_SENT, outcome_code="pair_rate_limited", now=NOW)
    assert until == NOW + sec(300)
    d = check(p, wp.CLASS_TICKET, rkey="bad")
    assert not d.allowed and d.reason == "pair_backoff" and d.not_before == until
    assert check(p, wp.CLASS_TICKET, rkey="other").allowed
    assert check(p, wp.CLASS_ALERT, rkey="bad").allowed
    assert p.blocked_until(KEY_A, "bad", NOW) == until and p.blocked_until(KEY_A, "other", NOW) == NOW


def test_a_provider_refusal_or_unknown_never_starts_a_backoff():
    p, _, store = pacer()
    for outcome, code in ((REFUSED, "provider_refused"), ("unknown", "timeout"), (NOT_SENT, "ha_unavailable")):
        assert p.on_result(account_key=KEY_A, recipient_key="r", klass="ticket", outcome=outcome, outcome_code=code, now=NOW) is None
    assert not store.state


# ---------------------------------------------------------------- the age limit and the counters

def test_a_message_waiting_past_its_limit_ends_visibly_and_is_counted():
    p, ledger, store = pacer(waits={"reminder": 10})
    fill(ledger, 6)
    d = check(p, wp.CLASS_REMINDER, ref="m1")
    assert not d.allowed and not d.expired
    assert store.wait_since("m1") == NOW
    later = NOW + sec(11 * 60)
    fill(ledger, 6, now=later)
    again = check(p, wp.CLASS_REMINDER, ref="m1", now=later)
    assert again.expired and not again.allowed
    assert store.wait_since("m1") is None
    by_metric = {m: n for (_h, _a, _k, m), n in store.counts.items()}
    assert by_metric == {"deferred": 1, "expired": 1}


def test_waiting_clears_when_the_message_is_allowed():
    p, ledger, store = pacer()
    fill(ledger, 6)
    assert not check(p, wp.CLASS_REMINDER, ref="m").allowed and store.wait_since("m") is not None
    assert check(p, wp.CLASS_REMINDER, ref="m", now=NOW + sec(30)).allowed
    assert store.wait_since("m") is None


# ---------------------------------------------------------------- WisKey's pacing contract (tolerant reader)

def test_the_reader_is_tolerant_and_closed():
    assert wp.parse_wiskey_account(None) is None and wp.parse_wiskey_account("x") is None
    assert wp.parse_wiskey_account({"sender_ref": REF}) is None, "no schema version: not the contract"
    assert wp.parse_wiskey_account(wk_status(pacing_schema_version=2)) is None
    assert wp.parse_wiskey_account(wk_status(sender_ref="has space")) is None
    st = wp.parse_wiskey_account(wk_status(wiskey_own={"charged_1m": 3, "charged_1h": "7", "charged_24h": -1}, throttled_until="2026-10-21T09:05:00Z",
                                           throttle_scope="account", retry_after_s=300, junk={"a": 1}))
    assert st.charged == {"1m": 3, "1h": None, "24h": None}, "anything that is not a non-negative integer is unknown"
    assert st.throttled_until == dt.datetime(2026, 10, 21, 9, 5, tzinfo=UTC) and st.retry_after_s == 300
    assert wp.parse_wiskey_account(wk_status(sender_match_verified="true")).verified is False, "only a real true counts"
    assert wp.parse_wiskey_account(wk_status(counters_complete=None)).complete is False
    assert wp.parse_wiskey_status("nope") == {} and set(wp.parse_wiskey_status([wk_status(), {"x": 1}, 5])) == {REF}
    proj = wp.project_pacing_accounts([wk_status(), {"x": 1}])
    assert len(proj) == 1 and "sent_1m" not in proj[0] and proj[0]["wiskey_own"]["charged_1m"] == 0
    assert set(wp.parse_wiskey_status(proj)) == {REF}


def test_only_charged_counts_and_only_for_a_verified_complete_mapped_sender():
    kw = dict(senders={KEY_A: REF})
    full = wk(wiskey_own={"charged_1m": 8, "charged_1h": 8, "charged_24h": 8})  # sent_* say 99: they must be ignored
    p, _, _ = pacer(wiskey=full, **kw)
    assert not check(p, wp.CLASS_TICKET).allowed, "8 charged in the minute fill a ticket's share"
    d = check(p, wp.CLASS_TICKET)
    assert d.reason == "minute" and d.not_before > NOW
    assert check(p, wp.CLASS_ALERT).allowed
    low, _, _ = pacer(wiskey=wk(wiskey_own={"charged_1m": 2, "charged_1h": 2, "charged_24h": 2}), **kw)
    assert check(low, wp.CLASS_TICKET).allowed, "sent_* of 99 never counts"
    big = dict(wiskey_own={"charged_1m": 80, "charged_1h": 80, "charged_24h": 80})
    for label, factory in (("unverified", wk(sender_match_verified=False, **big)), ("incomplete", wk(counters_complete=False, **big)),
                           ("null window", wk(wiskey_own={"charged_1m": None, "charged_1h": 80, "charged_24h": 80})),
                           ("absent", lambda: {}), ("other sender", wk(sender_ref="someone-else", **big))):
        q, _, _ = pacer(wiskey=factory, **kw)
        assert check(q, wp.CLASS_TICKET).allowed, label
        assert q.wiskey_view(KEY_A, NOW)["unknown"] is True, f"{label}: unknown, never zero"
        assert q.wiskey_view(KEY_A, NOW)["charged"] is None
    unmapped, _, _ = pacer(wiskey=full)
    assert check(unmapped, wp.CLASS_TICKET).allowed and unmapped.wiskey_view(KEY_A, NOW)["mapped"] is False, "never matched by name or digits"


def test_wiskey_throttle_holds_everything_but_alerts():
    until = NOW + sec(120)
    p, _, _ = pacer(wiskey=wk(throttled_until=until.isoformat(), throttle_scope="account", retry_after_s=120), senders={KEY_A: REF})
    d = check(p, wp.CLASS_TICKET)
    assert not d.allowed and d.reason == "wiskey_throttle" and d.not_before == until
    assert check(p, wp.CLASS_ALERT).allowed
    assert check(p, wp.CLASS_TICKET, now=until + sec(1)).allowed
    other, _, _ = pacer(wiskey=wk(throttled_until=until.isoformat(), throttle_scope="recipient"), senders={KEY_A: REF})
    assert check(other, wp.CLASS_TICKET).allowed, "a scope this side cannot judge is not applied account-wide"


def test_f3b_wp01_a_forged_counter_is_unknown_and_never_defers_anything():
    kw = dict(senders={KEY_A: REF})
    for label, own in (("billions", {"charged_1m": 4_000_000_000, "charged_1h": 4_000_000_000, "charged_24h": 4_000_000_000}),
                       ("just above the ceiling", {"charged_1m": wp.COUNTER_MAX + 1, "charged_1h": 0, "charged_24h": 0}),
                       ("negative", {"charged_1m": -1, "charged_1h": 0, "charged_24h": 0}),
                       ("a bool", {"charged_1m": True, "charged_1h": 0, "charged_24h": 0})):
        p, _, _ = pacer(wiskey=wk(wiskey_own=own), **kw)
        view = p.wiskey_view(KEY_A, NOW)
        assert view["unknown"] is True and view["charged"] is None, label
        assert check(p, wp.CLASS_TICKET).allowed and check(p, wp.CLASS_ALERT).allowed, label


def test_f3b_wp01_an_in_range_but_implausible_excess_is_ignored_and_an_alert_is_never_delayed_by_a_count():
    kw = dict(senders={KEY_A: REF})
    p, _, _ = pacer(wiskey=wk(wiskey_own={"charged_1m": 9_000, "charged_1h": 9_000, "charged_24h": 9_000}), **kw)
    assert check(p, wp.CLASS_TICKET).allowed, "beyond two window caps is not believed"
    plausible = dict(wiskey_own={"charged_1m": 12, "charged_1h": 12, "charged_24h": 12})  # a believable excess: over the minute cap of 10
    q, _, _ = pacer(wiskey=wk(**plausible), **kw)
    assert not check(q, wp.CLASS_TICKET).allowed
    assert check(q, wp.CLASS_ALERT).allowed, "WisKey's count alone never delays an operational alert"
    own, ledger, _ = pacer(wiskey=wk(**plausible), **kw)
    fill(ledger, 10)
    assert not check(own, wp.CLASS_ALERT).allowed, "Arx's own sends still count against an alert"


def test_f3b_wp01_a_far_future_throttle_is_clamped_to_the_backoff_ceiling():
    far = NOW + dt.timedelta(days=400)
    p, _, _ = pacer(wiskey=wk(throttled_until=far.isoformat(), throttle_scope="account", retry_after_s=10**9), senders={KEY_A: REF})
    view = p.wiskey_view(KEY_A, NOW)
    assert view["throttled_until"] == NOW + sec(wp.ACCOUNT_BACKOFF_S[1]) and view["retry_after_s"] is None
    d = check(p, wp.CLASS_TICKET)
    assert not d.allowed and d.not_before == NOW + sec(wp.ACCOUNT_BACKOFF_S[1])
    assert check(p, wp.CLASS_ALERT).allowed


# ---------------------------------------------------------------- the reservation port

def port(**kw):
    p, ledger, store = pacer(senders={KEY_A: REF}, **kw)
    return wp.WaReservations(p, lambda _k: P), p, ledger, store


def rid(n):
    return f"req-{n:08d}"


def test_reserve_grants_a_lease_and_it_counts_as_a_send():
    r, p, ledger, store = port()
    got = r.reserve(sender_ref=REF, klass="ticket", request_id=rid(1), now=NOW)
    assert got["granted"] is True and got["lease"]["request_id"] == rid(1) and got["lease"]["expires_at"].startswith("2026-10-21T09:01:00")
    assert store.lease_times(KEY_A, NOW - sec(5)) == [NOW]
    assert p.wiskey_view(KEY_A, NOW)["times"] == [NOW]


def test_reserve_is_idempotent_and_never_double_charges():
    r, p, ledger, store = port()
    a = r.reserve(sender_ref=REF, klass="ticket", request_id=rid(1), now=NOW)
    b = r.reserve(sender_ref=REF, klass="ticket", request_id=rid(1), now=NOW + sec(5))
    assert a["lease"] == b["lease"] and b["repeated"] is True and len(store.leases) == 1


def test_the_last_slot_goes_to_one_sender_only():
    r, p, ledger, store = port()
    fill(ledger, 7)  # ticket limit 8: one slot left
    first = r.reserve(sender_ref=REF, klass="ticket", request_id=rid(1), now=NOW)
    second = r.reserve(sender_ref=REF, klass="ticket", request_id=rid(2), now=NOW)
    assert first["granted"] is True
    assert second["granted"] is False and second["reason"] == "minute" and second["retry_after_s"] >= 1
    assert r.reserve(sender_ref=REF, klass="alert", request_id=rid(3), now=NOW)["granted"] is True, "an alert still fits"
    assert {m for (_h, _a, _k, m) in store.counts} == {"lease_granted", "lease_denied"}


def test_reserve_refusals():
    r, p, ledger, store = port()
    assert r.reserve(sender_ref="unknown-sender", klass="ticket", request_id=rid(1), now=NOW)["reason"] == "sender_unknown"
    assert r.reserve(sender_ref=REF, klass="vip", request_id=rid(1), now=NOW)["reason"] == "class_unknown"
    assert not store.leases


def test_a_lease_expires_but_stays_counted_and_cannot_be_taken_again():
    r, p, ledger, store = port()
    r.reserve(sender_ref=REF, klass="ticket", request_id=rid(1), now=NOW)
    later = NOW + sec(61)
    again = r.reserve(sender_ref=REF, klass="ticket", request_id=rid(1), now=later)
    assert again == {"granted": False, "reason": "lease_expired", "retry_after_s": None}
    assert store.lease_times(KEY_A, later - sec(120)) == [NOW], "the send may have left: it keeps counting"
    assert store.lease_active(KEY_A, later) == 0 and store.lease_active(KEY_A, NOW + sec(5)) == 1


def test_release_is_idempotent_and_not_sent_hands_the_slot_back():
    r, p, ledger, store = port()
    r.reserve(sender_ref=REF, klass="ticket", request_id=rid(1), now=NOW)
    out = r.release(request_id=rid(1), outcome="not_sent", now=NOW + sec(2))
    assert out["released"] is True and out["repeated"] is False and out["conflict"] is False
    assert store.lease_times(KEY_A, NOW - sec(5)) == []
    again = r.release(request_id=rid(1), outcome="accepted_by_provider", now=NOW + sec(3))
    assert again == {"released": True, "repeated": True, "outcome": "not_sent", "conflict": True}, "the first outcome stands; the conflict is reported"
    assert r.release(request_id=rid(1), outcome="not_sent", now=NOW + sec(3))["conflict"] is False
    assert r.reserve(sender_ref=REF, klass="ticket", request_id=rid(1), now=NOW + sec(4))["reason"] == "already_released"
    assert r.release(request_id="nope-nope-nope", outcome="unknown", now=NOW)["reason"] == "unknown_request"
    assert r.release(request_id=rid(1), outcome="exploded", now=NOW)["reason"] == "outcome_unknown"
    assert r.release(request_id=rid(1), outcome="sent", now=NOW)["reason"] == "outcome_unknown", "the old word is not part of the vocabulary"


def test_which_outcomes_credit_and_which_stay_counted():
    r, p, ledger, store = port()
    for n, outcome in enumerate(("accepted_by_provider", "unknown", "not_sent", "expired"), start=1):
        r.reserve(sender_ref=REF, klass="ticket", request_id=rid(n), now=NOW)
        r.release(request_id=rid(n), outcome=outcome, now=NOW + sec(1))
    assert len(store.lease_times(KEY_A, NOW - sec(5))) == 2, "accepted and unknown count; not_sent and expired (never dispatched) are handed back"
    assert {m: n for (_h, _a, _k, m), n in store.counts.items()}["sent"] == 1


def test_an_unreleased_lease_that_expires_is_never_an_automatic_credit_but_a_late_proof_settles_it():
    r, p, ledger, store = port()
    r.reserve(sender_ref=REF, klass="ticket", request_id=rid(1), now=NOW)
    later = NOW + sec(300)
    assert r.status(request_id=rid(1), now=later)["state"] == "expired" and r.status(request_id=rid(1), now=later)["counted"] is True
    assert len(store.lease_times(KEY_A, later - sec(600))) == 1
    out = r.release(request_id=rid(1), outcome="not_sent", now=later)
    assert out["late"] is True and out["released"] is True
    assert r.status(request_id=rid(1), now=later) == {**r.status(request_id=rid(1), now=later), "state": "released", "outcome": "not_sent", "counted": False}


def test_status_reconciles_by_request_id():
    r, p, ledger, store = port()
    assert r.status(request_id=rid(9), now=NOW) == {"found": False}
    r.reserve(sender_ref=REF, klass="reminder", request_id=rid(1), now=NOW)
    st = r.status(request_id=rid(1), now=NOW + sec(5))
    assert st["found"] and st["state"] == "granted" and st["counted"] is True and st["class"] == "reminder" and st["outcome"] is None


def test_a_reported_slowdown_starts_the_backoff_with_the_providers_hint_and_never_changes_the_outcome():
    r, p, ledger, store = port()
    r.reserve(sender_ref=REF, klass="ticket", request_id=rid(1), now=NOW)
    out = r.release(request_id=rid(1), outcome="not_sent", now=NOW, slowdown={"scope": "account", "retry_after_s": 90})
    assert out["outcome"] == "not_sent"
    assert store.get_state(f"account:{KEY_A}")[1] == NOW + sec(90)
    assert check(p, wp.CLASS_TICKET).reason == "backoff" and check(p, wp.CLASS_ALERT).allowed
    assert r.reserve(sender_ref=REF, klass="reminder", request_id=rid(2), now=NOW)["reason"] == "backoff"
    r.reserve(sender_ref=REF, klass="alert", request_id=rid(3), now=NOW)
    r.release(request_id=rid(3), outcome="not_sent", now=NOW, slowdown={"scope": "pair"})
    assert store.get_state(f"account:{KEY_A}")[1] == NOW + sec(90), "a pair slowdown is only counted"
    assert r.release(request_id=rid(3), outcome="unknown", now=NOW, slowdown={"scope": "galaxy"})["reason"] == "slowdown_invalid"


def test_leases_replace_wiskeys_charged_counters_and_only_its_unreserved_sends_are_added():
    full = wk(wiskey_own={"charged_1m": 7, "charged_1h": 7, "charged_24h": 7})
    r, p, ledger, store = port(wiskey=full)
    assert p.wiskey_view(KEY_A, NOW)["charged"] == {"1m": 7, "1h": 7, "24h": 7}
    r.reserve(sender_ref=REF, klass="alert", request_id=rid(1), now=NOW)
    v = p.wiskey_view(KEY_A, NOW)
    assert v["charged"] is None and v["unknown"] is True and v["superseded_by_leases"] is True, "no unreserved counters: its fail-open sends are unknown, not zero"
    split = wk(wiskey_own={"charged_1m": 7, "charged_1h": 7, "charged_24h": 7, "charged_unreserved_1m": 2, "charged_unreserved_1h": 2, "charged_unreserved_24h": 2})
    r2, p2, _, _ = port(wiskey=split)
    r2.reserve(sender_ref=REF, klass="alert", request_id=rid(1), now=NOW)
    v2 = p2.wiskey_view(KEY_A, NOW)
    assert v2["charged"] == {"1m": 2, "1h": 2, "24h": 2} and v2["unknown"] is False, "the reserved sends are the lease; only the unreserved ones are added"


def test_the_port_with_the_mode_off_grants_without_limiting():
    r, p, ledger, store = port(mode="off")
    fill(ledger, 30)
    assert r.reserve(sender_ref=REF, klass="reminder", request_id=rid(1), now=NOW)["granted"] is True


def test_f3b_wp02_the_port_principal_cannot_take_more_than_its_share_of_a_window_even_for_alerts():
    r, p, ledger, store = port()
    assert r.reserve(sender_ref=REF, klass="alert", request_id=rid(1), now=NOW)["granted"] is True
    assert r.reserve(sender_ref=REF, klass="alert", request_id=rid(2), now=NOW)["granted"] is True
    third = r.reserve(sender_ref=REF, klass="alert", request_id=rid(3), now=NOW)  # burst 5 -> the port may take 2 of them
    assert third["granted"] is False and third["reason"] == "lease_ceiling" and third["retry_after_s"] >= 1
    assert store.lease_get(rid(3)) is None, "a denial records nothing"
    assert check(p, wp.CLASS_ALERT).allowed, "Arx's own alert still has its floor"
    assert r.reserve(sender_ref=REF, klass="alert", request_id=rid(3), now=NOW + sec(third["retry_after_s"]))["granted"] is True


def test_f3b_wp02_a_lease_storm_over_a_minute_stops_at_half_the_minute_cap():
    r, p, ledger, store = port()
    got = [r.reserve(sender_ref=REF, klass="alert", request_id=rid(i), now=NOW + sec(11 * i))["granted"] for i in range(1, 7)]  # 11 s apart: past the burst window
    assert got == [True] * 5 + [False], "per_minute 10 -> 5 leases in any minute"
    assert check(p, wp.CLASS_ALERT, now=NOW + sec(60)).allowed


def test_f3b_wp05_the_ceiling_holds_with_the_mode_off_and_a_released_not_sent_lease_frees_its_slot():
    r, p, ledger, store = port(mode="off")
    assert [r.reserve(sender_ref=REF, klass="reminder", request_id=rid(i), now=NOW)["granted"] for i in (1, 2, 3)] == [True, True, False]
    assert r.release(request_id=rid(1), outcome="not_sent", now=NOW)["released"] is True
    assert r.reserve(sender_ref=REF, klass="reminder", request_id=rid(3), now=NOW)["granted"] is True


def test_f3b_wp05_live_leases_per_account_are_capped(monkeypatch):
    monkeypatch.setattr(wp, "LEASE_ACTIVE_MAX", 1)
    r, p, ledger, store = port()
    assert r.reserve(sender_ref=REF, klass="ticket", request_id=rid(1), now=NOW)["granted"] is True
    d = r.reserve(sender_ref=REF, klass="ticket", request_id=rid(2), now=NOW + sec(20))
    assert d["granted"] is False and d["reason"] == "lease_ceiling"
    r.release(request_id=rid(1), outcome="accepted_by_provider", now=NOW + sec(21))
    assert r.reserve(sender_ref=REF, klass="ticket", request_id=rid(2), now=NOW + sec(22))["granted"] is True


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


def test_wiskeys_error_classes_are_understood_and_unknown_is_never_resent():
    c = adapter.classify
    assert c({"last_error": "pair_rate_limited"}, "refused", "send") == adapter.SendResult("not_sent", "pair_rate_limited", "pair_rate_limited", adapter.PAIR_RETRY_S, "pair")
    assert c({"last_error": "pacing_expired"}, "refused", "send") == adapter.SendResult("not_sent", "pacing_expired", "pacing_expired")
    assert c({"last_error": "rate_limited"}, "refused", "send").code == "rate_limited"
    for code in ("whatsapp_send_uncertain", "status_unknown"):
        assert c({"last_error": code}, "unknown", "send").outcome == "unknown"
        assert c({"last_error": code}, "refused", "send").outcome == "unknown", "an uncertain code is never a refusal"
        assert c({"last_error": code}, "not_sent", "send").outcome == "unknown"
    assert {"pair_rate_limited", "pacing_expired"} <= adapter.SEND_REFUSED
    assert not (adapter.UNCERTAIN_CODES & adapter.SEND_REFUSED), "uncertain codes come after the message may have left"


def test_the_status_projection_keeps_only_the_contract_and_the_cache_goes_stale():
    raw = {"available": True, "accounts": [dict(wk_status(), id="a1", name="n", secret="x")]}
    got = adapter.project_status(raw)
    assert got["pacing"][0]["sender_ref"] == REF and "secret" not in got["pacing"][0] and "sent_1m" not in got["pacing"][0]
    assert adapter.project_status({"available": True, "accounts": [{"id": "a1"}]})["pacing"] == []
    a = adapter.MessagingAdapter()
    a._pacing, a._pacing_at = got["pacing"], adapter.time.monotonic()
    assert REF in a.cached_pacing()
    a._pacing_at = adapter.time.monotonic() - adapter.PACING_MAX_AGE_S - 1
    assert a.cached_pacing() == {}, "old counters are unknown, not still true"


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
    assert any(e[0] == "send_failed" for e in env.hooks.events), env.hooks.events
    assert env.ledger.rows == []


def test_a_rate_answer_holds_every_recipient_until_the_backoff_ends():
    env = env_with_pacer(doc=fast_doc())
    env.directory.add("c1")
    env.directory.add("c2", phone=PHONE_OTHER)
    first = assign(env, contact="c1", link="L1", assignment="A1", ticket="T1")
    second = assign(env, contact="c2", link="L2", assignment="A2", ticket="T2")
    env.fake.queue("http429")
    env.tick()
    env.tick(seconds=61)
    env.tick(seconds=30)
    env.tick(seconds=30)
    assert env.row(first.id).state == "sent" and env.row(second.id).state == "sent"


def test_alerts_keep_headroom_ticket_reminders_wait():
    env = env_with_pacer(doc=fast_doc())
    now = env.clock.now()
    for ago in (12, 20, 28, 36, 44, 52):  # six alert sends in the minute (notifications.whatsapp writes the same ledger)
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


def burst_of_reminders(env, n=8):
    for i in range(n):
        env.directory.add(f"c{i}", phone=f"1555555{i:04d}")
        assign(env, contact=f"c{i}", link=f"L{i}", assignment=f"A{i}", ticket=f"T{i}", purpose="reminder")
    env.drain(step_s=5)


def test_mode_off_is_byte_for_byte_the_legacy_behaviour():
    legacy = make_env(doc=fast_doc(), seed=3)
    off = env_with_pacer("off", doc=fast_doc(), seed=3)
    for env in (legacy, off):
        burst_of_reminders(env)
    assert [(c["data"]["target"], c["data"]["message"]) for c in off.fake.calls] == [(c["data"]["target"], c["data"]["message"]) for c in legacy.fake.calls]
    assert [r[4] for r in off.ledger.rows] == [r[4] for r in legacy.ledger.rows]
    assert not off.pstore.counts


def test_the_default_conservative_mode_slows_a_burst_of_reminders():
    legacy = make_env(doc=fast_doc(), seed=3)
    paced = env_with_pacer(doc=fast_doc(), seed=3)
    for env in (legacy, paced):
        burst_of_reminders(env)
    assert len(paced.fake.calls) == len(legacy.fake.calls) == 8
    assert paced.ledger.rows[-1][4] > legacy.ledger.rows[-1][4], "a reminder gets 6 of the 10 slots of a minute: the 7th and 8th wait"
    assert all(r.state == "sent" for r in paced.store.rows.values())


# ---------------------------------------------------------------- the routes and the counters

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
    assert body["budget"] == {"per_minute": 10, "burst": 5, "burst_window_s": 10} and body["share_pct"]["alert"] == 100
    assert body["shared_budget_guaranteed"] is False
    assert client.get(URL, headers=as_user("otto")).status_code in (401, 403)
    assert client.put(URL, json={"mode": "turbo"}, headers=as_user("joni")).status_code == 422
    assert client.put(URL, json={"max_wait_min": {"ticket": 0}}, headers=as_user("joni")).status_code == 422
    assert client.put(URL, json={"per_minute": 0}, headers=as_user("joni")).status_code == 422
    assert client.put(URL, json={"senders": {"entry:A": "bad ref"}}, headers=as_user("joni")).status_code == 422
    assert client.put(URL, json={"mode": "standard"}, headers=as_user("otto")).status_code in (401, 403)
    r = client.put(URL, json={"mode": "standard", "wiskey_shared": False, "max_wait_min": {"ticket": 90}, "per_minute": 15, "burst": 6,
                              "senders": {"entry:01JFAKEENTRYA": REF}}, headers=as_user("joni"))
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["mode"] == "standard" and out["wiskey_shared"] is False and out["max_wait_min"]["ticket"] == 90 and out["max_wait_min"]["code"] == 5
    assert out["budget"]["per_minute"] == 15 and out["budget"]["burst"] == 6 and out["senders"] == {"entry:01JFAKEENTRYA": REF}
    assert client.put(URL, json={"mode": "off"}, headers=as_user("joni")).json()["applies"] is False
    from smplwise.db import Database

    with Database(settings.db_path).connection(mode="read") as conn:
        acts = [r[0] for r in conn.execute("SELECT action FROM audit_log WHERE action = 'messaging.pacing.update'")]
    assert len(acts) == 2


def test_route_with_the_tickets_module_off_says_it_does_not_apply(client):
    assert client.patch(f"{API}/settings", json={"tickets.enabled": "false"}).status_code == 200
    body = client.get(URL, headers=as_user("joni")).json()
    assert body["mode"] == "conservative" and body["applies"] is False


def _role_and_bind(settings, c, user, role_id, perms):
    import json as _json

    from conftest import bind

    from smplwise.db import Database, now_iso

    db = Database(settings.db_path)
    now = now_iso()
    with db.connection() as conn:
        conn.execute("INSERT INTO custom_roles(id, name_he, permissions_json, sensitive_json, created_at, updated_at) VALUES (?,?,?,?,?,?)",
                     (role_id, role_id, _json.dumps([]), _json.dumps(perms), now, now))
        conn.execute("UPDATE settings SET value = CAST(value AS INTEGER) + 1 WHERE key = 'permission_revision'")
    bind(c, settings, user, role_id, "installation", "*")


def test_reservation_routes_need_their_own_narrow_permission(client, settings):
    assert client.put(URL, json={"senders": {"entry:01JFAKEENTRYA": REF}}, headers=as_user("joni")).status_code == 200
    _role_and_bind(settings, client, "wisk", "r-wk-port", ["messaging.pacing.reserve"])
    _role_and_bind(settings, client, "mia", "r-msg-manage", ["messaging.accounts.manage"])
    body = {"sender_ref": REF, "class": "ticket", "request_id": "req-route-0001"}
    wkh = as_user("wisk")
    got = client.post(f"{URL}/reserve", json=body, headers=wkh)
    assert got.status_code == 200, got.text
    assert got.json()["granted"] is True
    assert client.post(f"{URL}/reserve", json=body, headers=wkh).json()["repeated"] is True
    assert client.post(f"{URL}/reserve", json={**body, "sender_ref": "who-is-this"}, headers=wkh).json()["reason"] == "sender_unknown"
    assert client.post(f"{URL}/reserve", json={**body, "request_id": "short"}, headers=wkh).status_code == 422
    assert client.post(f"{URL}/reserve", json={**body, "extra": 1}, headers=wkh).status_code == 422
    for who in ("otto", "mia"):  # an operator, and a holder of messaging.accounts.manage: neither may use the port
        assert client.post(f"{URL}/reserve", json=body, headers=as_user(who)).status_code == 403, who
        assert client.post(f"{URL}/release", json={"request_id": "req-route-0001", "outcome": "unknown"}, headers=as_user(who)).status_code == 403, who
        assert client.get(f"{URL}/lease/req-route-0001", headers=as_user(who)).status_code == 403, who
    assert client.get(URL, headers=wkh).status_code in (401, 403), "the port principal reads nothing else of the pacing settings"
    assert client.put(URL, json={"mode": "off"}, headers=wkh).status_code in (401, 403)
    st = client.get(f"{URL}/lease/req-route-0001", headers=wkh).json()
    assert st["found"] is True and st["state"] == "granted"
    rel = client.post(f"{URL}/release", json={"request_id": "req-route-0001", "outcome": "accepted_by_provider"}, headers=wkh)
    assert rel.status_code == 200 and rel.json()["released"] is True
    again = client.post(f"{URL}/release", json={"request_id": "req-route-0001", "outcome": "not_sent"}, headers=wkh).json()
    assert again["repeated"] is True and again["conflict"] is True and again["outcome"] == "accepted_by_provider"
    assert client.post(f"{URL}/release", json={"request_id": "req-route-0001", "outcome": "unknown", "slowdown": {"scope": "account", "retry_after_s": 0}}, headers=wkh).status_code == 422
    assert client.get(f"{URL}/lease/x", headers=wkh).status_code == 422


def test_snapshot_counts_waiting_backoff_and_wiskey(settings):
    from fastapi.testclient import TestClient

    from smplwise.db import Database
    from smplwise.main import create_app

    TestClient(create_app(settings))  # runs the migrations
    db = Database(settings.db_path)
    now = dt.datetime.now(UTC)
    with db.connection() as conn:
        cfg = wp.PacerConfig(senders={KEY_A: REF})
        store = wp.SqlitePacerStore(lambda: contextlib.nullcontext(conn), lambda: conn)
        ledger = ma.SqliteSendLedger(conn)
        ledger.record(account_key=KEY_A, use_key="tickets.messages", recipient_key="r", kind="message", at=now - sec(60))
        conn.execute("INSERT INTO intercom_messages(id, at, actor_user_id, person_id, kind, chars, client_request_id, outcome) "
                     "VALUES ('m1', ?, 'u', 'p', 'free', 5, 'c1', 'sent')", (now.strftime("%Y-%m-%dT%H:%M:%S") + "Z",))
        p = wp.WaPacer(ledger, store, config=lambda: cfg, foreign=wp.wiskey_foreign_use(conn), wiskey=lambda: {})
        p.on_result(account_key=KEY_A, recipient_key="r", klass="ticket", outcome=NOT_SENT, outcome_code="rate_limited", now=now)
        p.on_result(account_key=KEY_A, recipient_key="r", klass="ticket", outcome=SENT, outcome_code=None, now=now)
        p.on_result(account_key=KEY_A, recipient_key="r2", klass="ticket", outcome=NOT_SENT, outcome_code="pair_rate_limited", now=now)
        snap = wp.snapshot(conn, p, [KEY_A, KEY_B], now)
    a = next(x for x in snap["accounts"] if x["account_key"] == KEY_A)
    assert a["sends_1h"] == 1 and a["wiskey_1h"] == 1 and a["backoff"]["level"] == 1 and a["pairs_in_backoff"] == 1
    assert a["wiskey"]["unknown"] is True and a["wiskey"]["charged"] is None, "mapped but WisKey reports nothing: unknown, not zero"
    assert a["counters_24h"]["backoff"] == 1 and a["counters_24h"]["pair_backoff"] == 1 and a["counters_24h"]["sent"] == 1
    assert next(x for x in snap["accounts"] if x["account_key"] == KEY_B)["sends_1h"] == 0
    assert snap["shared_budget_guaranteed"] is False
    assert "r2" not in str(snap) and "15555" not in str(snap)


def test_f3b_wp03_an_infrastructure_or_home_system_administrator_can_never_be_the_port_principal(client, settings):
    from smplwise.db import Database

    assert client.put(URL, json={"senders": {"entry:01JFAKEENTRYA": REF}}, headers=as_user("joni")).status_code == 200
    body = {"sender_ref": REF, "class": "ticket", "request_id": "req-admin-0001"}
    _role_and_bind(settings, client, "wisk", "r-wk-port", ["messaging.pacing.reserve"])
    _role_and_bind(settings, client, "boss", "r-wk-port-2", ["messaging.pacing.reserve"])
    from conftest import bind

    bind(client, settings, "boss", "system_admin", "installation", "*")
    assert client.post(f"{URL}/reserve", json=body, headers=as_user("wisk")).json()["granted"] is True, "the dedicated principal still works"
    for path, call in (("reserve", lambda h: client.post(f"{URL}/reserve", json=body, headers=h)),
                       ("release", lambda h: client.post(f"{URL}/release", json={"request_id": body["request_id"], "outcome": "unknown"}, headers=h)),
                       ("lease", lambda h: client.get(f"{URL}/lease/{body['request_id']}", headers=h))):
        r = call(as_user("boss"))
        assert r.status_code == 403 and r.json()["code"] == "port_principal_forbidden", path
    with Database(settings.db_path).connection(mode="read") as conn:
        reasons = [x[0] for x in conn.execute("SELECT reason FROM audit_log WHERE action = 'messaging.pacing.reserve' AND decision = 'denied'")]
    assert reasons.count("system_admin_not_allowed") == 3
    # a home-system administrator flag bars the principal as well
    with Database(settings.db_path).connection() as conn:
        uid = "dev-wisk"
        conn.execute("INSERT INTO ha_users(id, name, username, is_active, is_admin, group_ids_json, synced_at) VALUES (?,?,?,1,1,'[]','2026-10-21T00:00:00Z') "
                     "ON CONFLICT(id) DO UPDATE SET is_admin = 1", (uid, "w", "wisk"))
    r = client.post(f"{URL}/reserve", json={**body, "request_id": "req-admin-0002"}, headers=as_user("wisk"))
    assert r.status_code == 403 and r.json()["details"]["reason"] == "ha_admin_not_allowed"


def test_f3b_wp04_reserve_release_and_status_leave_an_actor_trace_without_secrets(client, settings):
    import json as _json

    from smplwise.db import Database

    assert client.put(URL, json={"senders": {"entry:01JFAKEENTRYA": REF}}, headers=as_user("joni")).status_code == 200
    _role_and_bind(settings, client, "wisk", "r-wk-port", ["messaging.pacing.reserve"])
    wkh = as_user("wisk")
    rid_ = "req-audit-0001"
    assert client.post(f"{URL}/reserve", json={"sender_ref": REF, "class": "alert", "request_id": rid_}, headers=wkh).json()["granted"] is True
    assert client.post(f"{URL}/release", json={"request_id": rid_, "outcome": "not_sent", "slowdown": {"scope": "account", "retry_after_s": 90}}, headers=wkh).json()["released"] is True
    assert client.post(f"{URL}/release", json={"request_id": rid_, "outcome": "accepted_by_provider"}, headers=wkh).json()["conflict"] is True
    assert client.get(f"{URL}/lease/{rid_}", headers=wkh).json()["found"] is True
    with Database(settings.db_path).connection(mode="read") as conn:
        rows = conn.execute("SELECT action, actor_user_id, resource_id, decision, details_json FROM audit_log WHERE action LIKE 'messaging.pacing.%' "
                            "AND action != 'messaging.pacing.update' AND decision = 'allowed' ORDER BY rowid").fetchall()
    assert [r["action"] for r in rows] == ["messaging.pacing.reserve", "messaging.pacing.release", "messaging.pacing.release", "messaging.pacing.lease_status"]
    assert all(r["actor_user_id"] == "dev-wisk" and r["resource_id"] == rid_ for r in rows)
    d = [_json.loads(r["details_json"]) for r in rows]
    assert d[0]["granted"] is True and d[0]["klass"] == "alert"
    assert d[1]["released"] is True and d[1]["outcome"] == "not_sent" and d[1]["slowdown"] == "account"
    assert d[2]["conflict"] is True and d[3]["found"] is True and d[3]["state"] == "released"
    assert "entry:" not in str(d) and REF not in str(d)
