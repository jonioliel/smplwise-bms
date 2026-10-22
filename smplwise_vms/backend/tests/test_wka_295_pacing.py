"""WKA-295 (WisKey's answer of 2026-10-22, item A07): the `whatsapp/pacing_status_v1` envelope as WisKey declared it.

- `pacing_schema_version` is EXACTLY the JSON integer 1 on the envelope. `True` and `1.0` compare equal to 1 in Python, so a membership test let
  them through, together with the aliases "1", "v1" and the schema name: all of them are now `schema_version_unsupported`.
- WisKey reports up to 128 senders without truncation and refuses beyond; Arx keeps every sender of a read within that bound and refuses a read
  beyond it (`accounts_over_limit`) - never a cut list presented as the full feed. Coverage fields stay.
- The reservation port is unchanged: `request_id_conflict` for another sender / class, a true duplicate charges once.

Negative cases first. Fakes only: no WisKey, no WhatsApp, no network."""
from __future__ import annotations

import datetime as dt

import pytest
from tickets_msg_fakes import KEY_A, KEY_B

from smplwise.services import messaging_accounts as ma
from smplwise.services import wa_pacing as wp

UTC = dt.timezone.utc
NOW = dt.datetime(2026, 10, 22, 9, 0, 0, tzinfo=UTC)
P = ma.Pacing()
REF, REF_B = "wk-sender-1", "wk-sender-2"


def account(ref: str = REF, **over):
    base = {"sender_ref": ref, "sender_match_verified": True, "counters_complete": True,
            "wiskey_own": {"charged_1m": 0, "charged_1h": 0, "charged_24h": 0}, "throttled_until": None, "throttle_scope": None, "retry_after_s": None}
    base.update(over)
    return base


def envelope(accounts, **over):
    env = {"pacing_schema_version": 1, "accounts": accounts}
    env.update(over)
    return env


# ---------------------------------------------------------------- schema_version: exactly int 1 (negative first)

NOT_V1 = [True, 1.0, "1", "v1", "whatsapp_pacing_status_v1", "V1", 1.5, 0, 2, -1, None, [1], {"v": 1}, False]


@pytest.mark.parametrize("version", NOT_V1, ids=repr)
def test_an_envelope_version_that_is_not_exactly_int_1_is_unsupported(version):
    proj = wp.project_pacing_envelope(envelope([account()], pacing_schema_version=version))
    assert proj["closed_reason"] == "schema_version_unsupported" and proj["accounts"] == []
    got = wp.parse_wiskey_status(envelope([account()], pacing_schema_version=version))
    assert dict(got) == {} and got.closed_reason == "schema_version_unsupported"


@pytest.mark.parametrize("version", NOT_V1, ids=repr)
def test_an_entry_that_repeats_a_version_other_than_exactly_int_1_is_dropped(version):
    assert wp.parse_wiskey_account(account(pacing_schema_version=version)) is None
    proj = wp.project_pacing_envelope(envelope([account(), account(REF_B, pacing_schema_version=version)]))
    assert [a["sender_ref"] for a in proj["accounts"]] == [REF]
    assert proj["coverage"]["invalid"] == 1 and proj["coverage"]["truncated"] is True


def test_the_alias_table_is_gone_and_the_check_is_by_type():
    assert not hasattr(wp, "SCHEMA_VERSIONS"), "a membership tuple lets True / 1.0 through"
    assert wp.PACING_SCHEMA_VERSION == 1 and type(wp.PACING_SCHEMA_VERSION) is int
    assert wp.is_schema_v1(1)
    assert not any(wp.is_schema_v1(v) for v in NOT_V1)


def test_exactly_int_1_is_accepted_on_the_envelope_and_on_an_entry():
    proj = wp.project_pacing_envelope(envelope([account(), account(REF_B, pacing_schema_version=1)]))
    assert proj["closed_reason"] is None and proj["pacing_schema_version"] == 1 and type(proj["pacing_schema_version"]) is int
    assert [a["sender_ref"] for a in proj["accounts"]] == [REF, REF_B]
    assert wp.project_pacing_envelope(proj)["closed_reason"] is None, "Arx's own projection still reads back"


# ---------------------------------------------------------------- the account bound: 128, refusal beyond (negative first)

def _many(n: int) -> list[dict]:
    return [account(f"s{i:03d}") for i in range(n)]


@pytest.mark.parametrize("n,total", [(129, None), (200, None), (129, 129), (1, 129), (128, 129), (0, 1000)])
def test_a_read_beyond_128_senders_is_refused_whole(n, total):
    over = {} if total is None else {"accounts_total": total}
    proj = wp.project_pacing_envelope(envelope(_many(n), **over))
    assert proj["closed_reason"] == "accounts_over_limit" and proj["accounts"] == [] and proj["accounts_total"] is None
    assert proj["coverage"] == {"total": None, "received": 0, "returned": 0, "invalid": 0, "truncated": False}
    assert "accounts_over_limit" in wp.CLOSED_REASONS


def test_a_sender_of_a_refused_read_is_unknown_not_zero():
    env = envelope(_many(128) + [account(REF, wiskey_own={"charged_1m": 9, "charged_1h": 9, "charged_24h": 9})])
    ledger, store = ma.MemorySendLedger(), wp.MemoryPacerStore()
    cfg = wp.PacerConfig(senders={KEY_A: REF})
    p = wp.WaPacer(ledger, store, config=lambda: cfg, wiskey=lambda: wp.parse_wiskey_status(env))
    v = p.wiskey_view(KEY_A, NOW)
    assert v["unknown"] is True and v["charged"] is None and v["coverage"] == "not_covered" and v["reason"] == "accounts_over_limit"
    assert p.wiskey_coverage()["closed_reason"] == "accounts_over_limit"


def test_exactly_128_senders_are_all_kept_untruncated():
    accts = _many(127) + [account(REF, wiskey_own={"charged_1m": 2, "charged_1h": 2, "charged_24h": 2})]
    proj = wp.project_pacing_envelope(envelope(accts, accounts_total=128))
    assert proj["closed_reason"] is None and len(proj["accounts"]) == 128 == wp.PACING_ACCOUNTS_MAX
    assert proj["coverage"] == {"total": 128, "received": 128, "returned": 128, "invalid": 0, "truncated": False}
    got = wp.parse_wiskey_status(proj)
    assert len(got) == 128 and got[REF].charged == {"1m": 2, "1h": 2, "24h": 2}, "the last sender is not cut"
    again = wp.project_pacing_envelope(proj)
    assert again["coverage"] == proj["coverage"] and again["accounts"] == proj["accounts"]


def test_without_accounts_total_128_entries_are_complete():
    proj = wp.project_pacing_envelope(envelope(_many(128)))
    assert proj["closed_reason"] is None and proj["coverage"]["truncated"] is False and proj["accounts_total"] == 128


def test_wiskey_sending_fewer_than_it_has_is_still_truncated_and_says_so():
    proj = wp.project_pacing_envelope(envelope(_many(3), accounts_total=7))
    assert proj["closed_reason"] is None
    assert proj["coverage"] == {"total": 7, "received": 3, "returned": 3, "invalid": 0, "truncated": True}


# ---------------------------------------------------------------- the reservation port keeps its rules

def _port():
    ledger, store = ma.MemorySendLedger(), wp.MemoryPacerStore()
    cfg = wp.PacerConfig(senders={KEY_A: REF, KEY_B: REF_B})
    p = wp.WaPacer(ledger, store, config=lambda: cfg)
    return wp.WaReservations(p, lambda _k: P), store


def _granted_count(store, account_key: str) -> int:
    return sum(n for (_h, acct, _k, metric), n in store.counts.items() if acct == account_key and metric == "lease_granted")


def test_request_id_reused_for_another_sender_or_class_is_a_conflict_and_charges_nothing():
    r, store = _port()
    assert r.reserve(sender_ref=REF, klass="ticket", request_id="req-00000001", now=NOW)["granted"] is True
    for sender, klass in ((REF_B, "ticket"), (REF, "alert"), (REF_B, "alert")):
        got = r.reserve(sender_ref=sender, klass=klass, request_id="req-00000001", now=NOW + dt.timedelta(seconds=1))
        assert got == {"granted": False, "reason": "request_id_conflict", "retry_after_s": None}
    assert len(store.leases) == 1 and store.leases["req-00000001"].sender_ref == REF
    assert store.lease_times(KEY_A, NOW - dt.timedelta(seconds=5)) == [NOW] and store.lease_times(KEY_B, NOW - dt.timedelta(seconds=5)) == []
    assert _granted_count(store, KEY_A) == 1 and _granted_count(store, KEY_B) == 0


def test_a_duplicate_of_the_same_meaning_is_answered_again_and_charged_once():
    r, store = _port()
    first = r.reserve(sender_ref=REF, klass="ticket", request_id="req-00000002", now=NOW)
    for i in range(1, 4):
        again = r.reserve(sender_ref=REF, klass="ticket", request_id="req-00000002", now=NOW + dt.timedelta(seconds=i))
        assert again["granted"] is True and again["repeated"] is True and again["lease"] == first["lease"]
    assert store.lease_times(KEY_A, NOW - dt.timedelta(seconds=5)) == [NOW]
    assert _granted_count(store, KEY_A) == 1
    rel = [r.release(request_id="req-00000002", outcome="accepted_by_provider", now=NOW + dt.timedelta(seconds=5)) for _ in range(2)]
    assert rel[0]["repeated"] is False and rel[1]["repeated"] is True and rel[1]["conflict"] is False
    sent = sum(n for (_h, acct, _k, metric), n in store.counts.items() if acct == KEY_A and metric == "sent")
    assert sent == 1, "a repeated release does not count the send twice"
