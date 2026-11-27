"""WISKEY-VISIT-FILTERS-2560, FAKES ONLY: WisKey's discovery contract `business_contracts["visits/list"] =
{"contract": "wiskey-visit-list-filters.v1", "status_filters": [...]}` decides the visit list's status filters (`ended` no longer needs the
record command). Absent or malformed contract: the 2.52 rule. Unknown filters are ignored; nothing here can raise. Nothing contacts WisKey."""
from __future__ import annotations

from types import SimpleNamespace

from test_wiskey_visits_2407 import W, sent, vx  # noqa: F401 - vx is the shared fixture

from smplwise.services import wiskey_visits as wv

SIX = ["all", "pending", "approved", "rejected", "cancelled", "superseded"]
ALL7 = [*SIX, "ended"]
RC10 = {"commands": ["visits/list", "guest_templates/get"]}
CONTRACT = {"contract": "wiskey-visit-list-filters.v1", "status_filters": ["all", "approved", "cancelled", "ended", "pending", "rejected", "superseded"]}


def caps(entry, published=True):
    return SimpleNamespace(lists=lambda c: published and c == "visits/list", business_contracts={"visits/list": entry} if entry is not None else {})


def test_contract_present_shows_ended_without_the_record_command():
    assert wv.list_statuses(RC10, caps(CONTRACT)) == ALL7
    assert wv.list_statuses(None, caps(CONTRACT)) == ALL7


def test_contract_absent_keeps_the_old_rule():
    assert wv.list_statuses(RC10, caps(None)) == SIX
    assert wv.list_statuses(RC10, None) == SIX
    assert wv.list_statuses({"commands": [*RC10["commands"], wv.RECORD]}, caps(None)) == ALL7
    assert wv.list_statuses(RC10, caps(CONTRACT, published=False)) == SIX, "visits/list must be published on the connection"


def test_malformed_or_other_contract_is_treated_as_absent():
    bad = [{}, "x", 7, {"contract": "other.v1", "status_filters": ["all", "ended"]}, {"contract": CONTRACT["contract"]},
           {"contract": CONTRACT["contract"], "status_filters": "ended"}, {"contract": CONTRACT["contract"], "status_filters": ["ended", 3]},
           {"contract": CONTRACT["contract"], "status_filters": ["ended"]}]
    for entry in bad:
        assert wv.list_statuses(RC10, caps(entry)) == SIX, entry
    assert wv.list_statuses(RC10, SimpleNamespace()) == SIX, "a caps object that cannot answer never crashes"
    assert wv.list_statuses({"commands": [*RC10["commands"], wv.RECORD]}, caps({})) == ALL7


def test_unknown_filters_are_ignored_and_order_is_canonical():
    entry = {"contract": CONTRACT["contract"], "status_filters": ["ended", "weird", "all", "pending"]}
    assert wv.list_statuses(RC10, caps(entry)) == ["all", "pending", "ended"]


def test_router_offers_and_sends_ended_on_the_contract(vx, monkeypatch):  # noqa: F811
    fake, env, _s = vx
    fake.filter_contract = True
    monkeypatch.setattr(wv, "direct_capabilities", lambda: caps(CONTRACT))
    assert env.c.get(W).json()["capabilities"]["visits"]["statuses"] == ALL7
    r = env.c.get(f"{W}/visits", params={"status": "ended", "offset": 0, "limit": 50})
    assert r.status_code == 200, r.text
    frame = sent(fake, "visits/list")[-1]
    assert frame["filters"]["status"] == "ended" and frame["offset"] == 0 and frame["limit"] == 50


def test_router_without_contract_still_refuses_ended(vx, monkeypatch):  # noqa: F811
    _fake, env, _s = vx
    monkeypatch.setattr(wv, "direct_capabilities", lambda: caps({"contract": "bad"}))
    assert env.c.get(W).json()["capabilities"]["visits"]["statuses"] == SIX
    assert env.c.get(f"{W}/visits", params={"status": "ended"}).status_code == 409
