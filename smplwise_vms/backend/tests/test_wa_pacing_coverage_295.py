"""PACING12-295: the two gaps of WisKey's `whatsapp_pacing_status_v1` read (docs/changes/CR-WA-PACING-295-PORT-CONTRACT.md section 11).

1. ROUTE: the pacing envelope is read from ONE explicitly chosen route, `whatsapp/pacing_status_v1`, and only after discovery (WisKey's
   `api.commands`) lists it. A discovery that does not list it fails closed with a named reason - never a fall back to `whatsapp/status`.
2. COVERAGE: no silent truncation. The envelope carries `pacing_schema_version` (on the ENVELOPE, not per account) and a coverage block
   (total vs returned, truncated); an account the read did not cover is UNKNOWN, never zero.

Negative cases first. Fakes only: no WisKey, no WhatsApp, no network."""
from __future__ import annotations

import asyncio
import datetime as dt

import pytest
from tickets_msg_fakes import KEY_A

from smplwise.services import intercom_messaging_adapter as adapter
from smplwise.services import messaging_accounts as ma
from smplwise.services import wa_pacing as wp
from smplwise.services import wiskey_channels as ch

UTC = dt.timezone.utc
NOW = dt.datetime(2026, 10, 21, 9, 0, 0, tzinfo=UTC)
P = ma.Pacing()
REF = "wk-sender-1"


def account(ref: str = REF, **over):
    base = {"sender_ref": ref, "sender_match_verified": True, "counters_complete": True,
            "wiskey_own": {"charged_1m": 0, "charged_1h": 0, "charged_24h": 0}, "throttled_until": None, "throttle_scope": None, "retry_after_s": None}
    base.update(over)
    return base


def envelope(accounts, **over):
    env = {"pacing_schema_version": 1, "accounts": accounts}
    env.update(over)
    return env


def pacer(wiskey):
    ledger, store = ma.MemorySendLedger(), wp.MemoryPacerStore()
    cfg = wp.PacerConfig(senders={KEY_A: REF})
    return wp.WaPacer(ledger, store, config=lambda: cfg, wiskey=wiskey), ledger


# ---------------------------------------------------------------- gap 1: discovery, then an explicit route (negative first)

@pytest.mark.parametrize("commands,reason", [
    (None, "discovery_unknown"),
    ("whatsapp/pacing_status_v1", "discovery_unknown"),  # not a list: nothing is guessed from a string
    ([], "pacing_route_not_listed"),
    (["whatsapp/status", "whatsapp/send"], "pacing_route_not_listed"),
    (["whatsapp/pacing_status"], "pacing_route_not_listed"),  # a similar name is not the route
])
def test_missing_route_fails_closed_and_never_falls_back_to_whatsapp_status(commands, reason):
    route, why = wp.choose_pacing_route(commands)
    assert route is None and why == reason
    assert route != "whatsapp/status"


def test_a_listed_route_is_chosen_explicitly():
    assert wp.choose_pacing_route(["whatsapp/status", "whatsapp/pacing_status_v1"]) == ("whatsapp/pacing_status_v1", None)
    assert wp.PACING_ROUTE == "whatsapp/pacing_status_v1"


def test_the_pacing_channel_carries_only_the_pacing_route():
    assert ch.ALLOWLISTS["pacing"] == {"whatsapp/pacing_status_v1"} and "pacing" in ch.UNPINNED_CHANNELS and "pacing" in ch.ADAPTER_CHANNELS
    assert ch.allowed("pacing", ch.PREFIX + "whatsapp/pacing_status_v1")
    assert not ch.allowed("pacing", ch.PREFIX + "whatsapp/status") and not ch.allowed("pacing", ch.PREFIX + "whatsapp/send")
    assert not ch.allowed("messaging", ch.PREFIX + "whatsapp/pacing_status_v1")


class FakeSync:
    def __init__(self, commands, answer=None, state="ready"):
        self.facts = {"version": "x", "min_client": None, "commands": commands}
        self.answer, self.state, self.calls = answer, state, []

    def api_facts(self, _settings):
        return dict(self.facts) if self.facts is not None else None

    def command(self, _settings, key, send, project, who="", channel="service", **_kw):
        self.calls.append((key, channel))
        frames = []

        async def call(msg_type, **kw):
            frames.append(msg_type)
            return {"success": True, "result": self.answer}

        result = asyncio.run(send(call))
        self.frames = frames
        if self.state != "ready":
            return {"state": self.state, key: None}
        return {"state": "ready", key: project(result)}


def test_adapter_without_the_listed_route_makes_no_call_and_reports_the_closed_reason(monkeypatch):
    fake = FakeSync(["whatsapp/status", "whatsapp/preview", "whatsapp/send"], answer=envelope([account()]))
    monkeypatch.setattr(adapter.intercom_sync, "SYNC", fake)
    a = adapter.MessagingAdapter()
    assert a.refresh_pacing(object(), "u") == "pacing_route_not_listed"
    assert fake.calls == [], "no endpoint is guessed"
    got = a.cached_pacing()
    assert dict(got) == {} and got.closed_reason == "pacing_route_not_listed"


def test_adapter_with_no_discovery_copy_fails_closed(monkeypatch):
    fake = FakeSync(None)
    fake.facts = None
    monkeypatch.setattr(adapter.intercom_sync, "SYNC", fake)
    a = adapter.MessagingAdapter()
    assert a.refresh_pacing(object(), "u") == "discovery_unknown" and fake.calls == []


def test_adapter_with_an_incompatible_contract_fails_closed(monkeypatch):
    fake = FakeSync(["whatsapp/pacing_status_v1"])
    fake.facts["min_client"] = adapter.API_CONTRACT + 1
    monkeypatch.setattr(adapter.intercom_sync, "SYNC", fake)
    assert adapter.MessagingAdapter().refresh_pacing(object(), "u") == "api_incompatible" and fake.calls == []


def test_adapter_reads_the_listed_route_on_the_pacing_channel(monkeypatch):
    fake = FakeSync(["whatsapp/status", "whatsapp/pacing_status_v1"], answer=envelope([account()]))
    monkeypatch.setattr(adapter.intercom_sync, "SYNC", fake)
    a = adapter.MessagingAdapter()
    assert a.refresh_pacing(object(), "u") is None
    assert fake.calls == [("pacing", "pacing")] and fake.frames == [adapter.DOMAIN + "/whatsapp/pacing_status_v1"]
    got = a.cached_pacing()
    assert REF in got and got.closed_reason is None and got.coverage["truncated"] is False


def test_adapter_route_error_fails_closed(monkeypatch):
    fake = FakeSync(["whatsapp/pacing_status_v1"], answer=envelope([account()]), state="error")
    monkeypatch.setattr(adapter.intercom_sync, "SYNC", fake)
    a = adapter.MessagingAdapter()
    assert a.refresh_pacing(object(), "u") == "route_error"
    assert dict(a.cached_pacing()) == {} and a.cached_pacing().closed_reason == "route_error"


def test_whatsapp_status_no_longer_feeds_the_pacing_cache():
    raw = {"available": True, "accounts": [dict(account(), id="a1", name="n", pacing_schema_version=1)]}
    assert "pacing" not in adapter.project_status(raw), "pacing is never derived from whatsapp/status"


def test_the_cache_is_unknown_when_never_read_or_stale():
    a = adapter.MessagingAdapter()
    assert dict(a.cached_pacing()) == {} and a.cached_pacing().closed_reason == "not_read"
    a._pacing, a._pacing_at = wp.project_pacing_envelope(envelope([account()])), adapter.time.monotonic() - adapter.PACING_MAX_AGE_S - 1
    assert dict(a.cached_pacing()) == {} and a.cached_pacing().closed_reason == "stale"


# ---------------------------------------------------------------- gap 2: the envelope schema location (negative first)

def test_wrong_schema_location_version_only_on_accounts_is_closed():
    env = {"accounts": [dict(account(), pacing_schema_version=1)]}
    proj = wp.project_pacing_envelope(env)
    assert proj["closed_reason"] == "schema_version_misplaced" and proj["accounts"] == []
    assert dict(wp.parse_wiskey_status(env)) == {} and wp.parse_wiskey_status(env).closed_reason == "schema_version_misplaced"


@pytest.mark.parametrize("env,reason", [
    ({"accounts": [account()]}, "schema_version_missing"),
    (envelope([account()], pacing_schema_version=2), "schema_version_unsupported"),
    (envelope("nope"), "envelope_invalid"),
    ([account()], "envelope_invalid"),  # a bare list is not the envelope
    (None, "envelope_invalid"),
    (envelope([account()], accounts_total=-1), "envelope_invalid"),
    (envelope([account(), account("b")], accounts_total=1), "coverage_inconsistent"),
])
def test_a_bad_envelope_is_closed_with_its_reason(env, reason):
    proj = wp.project_pacing_envelope(env)
    assert proj["closed_reason"] == reason and proj["accounts"] == []
    assert proj["coverage"]["returned"] == 0


def test_a_per_account_version_that_contradicts_the_envelope_drops_that_account():
    proj = wp.project_pacing_envelope(envelope([account(), account("b", pacing_schema_version=2)]))
    assert [a["sender_ref"] for a in proj["accounts"]] == [REF]
    assert proj["coverage"] == {"total": 2, "received": 2, "returned": 1, "invalid": 1, "truncated": True}
    assert "pacing_schema_version" not in proj["accounts"][0], "the version lives on the envelope only"
    assert proj["pacing_schema_version"] == 1


# ---------------------------------------------------------------- gap 2: coverage (no silent truncation)

def test_truncated_coverage_is_explicit_when_arx_caps_the_list():
    accts = [account(f"s{i:02d}") for i in range(wp.PACING_ACCOUNTS_MAX + 2)]
    proj = wp.project_pacing_envelope(envelope(accts))
    assert len(proj["accounts"]) == wp.PACING_ACCOUNTS_MAX
    assert proj["coverage"] == {"total": 12, "received": 12, "returned": 10, "invalid": 0, "truncated": True}
    got = wp.parse_wiskey_status(proj)
    assert got.coverage["truncated"] is True and got.coverage["total"] == 12 and len(got) == 10


def test_truncated_coverage_is_explicit_when_wiskey_sends_fewer_than_it_has():
    proj = wp.project_pacing_envelope(envelope([account()], accounts_total=5))
    assert proj["coverage"] == {"total": 5, "received": 1, "returned": 1, "invalid": 0, "truncated": True}


def test_full_coverage_is_not_truncated_and_reprojection_is_stable():
    proj = wp.project_pacing_envelope(envelope([account(), account("b")], accounts_total=2))
    assert proj["coverage"] == {"total": 2, "received": 2, "returned": 2, "invalid": 0, "truncated": False}
    again = wp.project_pacing_envelope(proj)
    assert again["coverage"] == proj["coverage"] and again["accounts"] == proj["accounts"]


def test_reprojection_keeps_the_invalid_count():
    proj = wp.project_pacing_envelope(envelope([account(), {"x": 1}]))
    assert proj["coverage"]["invalid"] == 1 and proj["coverage"]["truncated"] is True
    assert wp.parse_wiskey_status(proj).coverage == proj["coverage"]


def test_out_of_range_counters_stay_unknown():
    got = wp.parse_wiskey_status(envelope([account(wiskey_own={"charged_1m": wp.COUNTER_MAX + 1, "charged_1h": -1, "charged_24h": True})]))
    assert got[REF].charged == {"1m": None, "1h": None, "24h": None}


# ---------------------------------------------------------------- consumers: missing is not zero

def test_an_uncovered_account_is_unknown_not_zero():
    others = [account(f"s{i:02d}") for i in range(wp.PACING_ACCOUNTS_MAX)]
    env = wp.project_pacing_envelope(envelope(others + [account(wiskey_own={"charged_1m": 9, "charged_1h": 9, "charged_24h": 9})]))
    assert REF not in [a["sender_ref"] for a in env["accounts"]], "our sender was cut by the cap"
    p, _ = pacer(lambda: wp.parse_wiskey_status(env))
    v = p.wiskey_view(KEY_A, NOW)
    assert v["unknown"] is True and v["charged"] is None and v["coverage"] == "not_covered" and v["reason"] == "truncated"


def test_a_closed_read_names_its_reason_on_the_account():
    p, _ = pacer(lambda: wp.parse_wiskey_status({"accounts": [dict(account(), pacing_schema_version=1)]}))
    v = p.wiskey_view(KEY_A, NOW)
    assert v["unknown"] is True and v["charged"] is None and v["reason"] == "schema_version_misplaced"
    assert p.wiskey_coverage()["closed_reason"] == "schema_version_misplaced"


def test_a_covered_account_is_used_and_says_covered():
    p, _ = pacer(lambda: wp.parse_wiskey_status(envelope([account(wiskey_own={"charged_1m": 3, "charged_1h": 3, "charged_24h": 3})])))
    v = p.wiskey_view(KEY_A, NOW)
    assert v["unknown"] is False and v["charged"] == {"1m": 3, "1h": 3, "24h": 3} and v["coverage"] == "covered" and v["reason"] is None
    cov = p.wiskey_coverage()
    assert cov["closed_reason"] is None and cov["truncated"] is False and cov["total"] == 1


def test_incomplete_counters_say_why():
    p, _ = pacer(lambda: wp.parse_wiskey_status(envelope([account(counters_complete=False)])))
    v = p.wiskey_view(KEY_A, NOW)
    assert v["unknown"] is True and v["coverage"] == "covered" and v["reason"] == "counters_incomplete"


def test_no_reader_is_not_read():
    p, _ = pacer(None)
    assert p.wiskey_coverage()["closed_reason"] == "not_read"


# ---------------------------------------------------------------- the WhatsApp accounts list of whatsapp/status: no silent cut either

def test_the_status_account_list_reports_its_own_truncation():
    raw = {"available": True, "accounts": [{"id": f"a{i:02d}", "name": "n"} for i in range(12)]}
    got = adapter.project_status(raw)
    assert len(got["accounts"]) == 10 and got["accounts_total"] == 12 and got["accounts_truncated"] is True
    full = adapter.project_status({"available": True, "accounts": [{"id": "a1"}]})
    assert full["accounts_total"] == 1 and full["accounts_truncated"] is False


def test_a_configured_account_beyond_the_cut_is_not_covered_not_missing():
    status = {"accounts": [{"id": f"a{i:02d}"} for i in range(10)], "accounts_truncated": True}
    assert adapter.MessagingAdapter.account_for(status, "a11") == (None, "account_not_covered")
    assert adapter.MessagingAdapter.account_for({**status, "accounts_truncated": False}, "a11") == (None, "account_missing")
