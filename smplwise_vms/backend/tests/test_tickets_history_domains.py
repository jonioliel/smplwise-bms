"""CR-TK-HISTORY-2436 (code review 01:F-04): the security-domain list "never share device history with an outside handler"
(D3 / D23: lock, alarm panel, cover, camera) lives in ONE place, `policy.NEVER_SHARED_DOMAINS`, and every call site that decides
whether a handler may see a device history refuses exactly that set:

1. `policy.may_share_history` - the department default of the per-ticket box;
2. `device_context.share_history_allowed` - the `shareable` flag on the ticket detail;
3. `external.history_option` - whether the box exists when a ticket is assigned (and so the 422 `not_allowed`);
4. `handler_actions._history` - the lines the handler page shows.

The second test widens the single list and expects all four sites to follow it, so a fifth copy of the list fails here.
Pure unit tests: the stored snapshot is a fake, no database is opened."""
from __future__ import annotations

import pytest

from smplwise.services.tickets import device_context, external, handler_actions, policy, store_links

DOCUMENTED = frozenset({"lock", "alarm_control_panel", "cover", "camera"})
OTHERS = ("climate", "light", "switch", "sensor", "binary_sensor", "siren", "media_player")
INST = {"links": {"sliding_days": 14, "cap_days": 90, "grace_hours": 24}, "send_hours": {"from": "07:00", "to": "21:00"}, "urgent_is_critical": True}
SNAP = {"source": "device_activity", "withheld": None, "items_json": "[]", "items": []}


@pytest.fixture(autouse=True)
def _fake_snapshot(monkeypatch):
    """Every ticket has a usable frozen snapshot, so only the domain rule can refuse."""
    monkeypatch.setattr(store_links, "device_context", lambda conn, ticket_id: dict(SNAP))


def refusals(domain: str) -> dict[str, bool]:
    """True = the site refuses to share the history of `<domain>.x` with a handler."""
    eid = f"{domain}.x"
    ticket = {"id": "t1", "entity_id": eid, "department_id": "d1"}
    dept_policy = policy.resolve(INST, {"share_history_external": 1})
    option = external.history_option(None, ticket, {"share_history": 1}, None)
    return {
        "policy.may_share_history": not policy.may_share_history(dept_policy, domain),
        "device_context.share_history_allowed": not device_context.share_history_allowed(eid, SNAP),
        "external.history_option": not option["available"],
        "handler_actions._history": handler_actions._history(None, ticket, {"share_history": 1}) is None,
    }


def test_the_single_list_is_the_documented_one():
    assert policy.NEVER_SHARED_DOMAINS == DOCUMENTED


@pytest.mark.parametrize("domain", sorted(DOCUMENTED) + list(OTHERS))
def test_the_four_call_sites_refuse_the_same_domain_set(domain):
    seen = refusals(domain)
    expected = domain in DOCUMENTED
    assert seen == dict.fromkeys(seen, expected), seen


def test_widening_the_single_list_reaches_every_call_site(monkeypatch):
    monkeypatch.setattr(policy, "NEVER_SHARED_DOMAINS", DOCUMENTED | {"siren"})
    seen = refusals("siren")
    assert all(seen.values()), f"a call site keeps its own copy of the list: {seen}"
    assert not any(refusals("climate").values())
