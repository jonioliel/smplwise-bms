"""CR-038 security review 2026-10-14 - the one-line fixes of 2.5.1: the module key rotation and the handler page's public keys are
local-only, nobody approves a cost revision they entered themselves, and the tickets CSV uses the module's own cell guard."""
from __future__ import annotations


import pytest

from smplwise import remote_channel
from smplwise.routers import tickets_admin
from smplwise.services.tickets import export, text_hygiene
from test_tickets_costs import LINES, decide, done, jpeg  # noqa: F401 - the slice 9 world
from tickets_s4_world import API, build_s4
from smplwise.services.tickets import costs_report


@pytest.fixture()
def s4(settings, monkeypatch):
    costs_report.reset_rate()
    return build_s4(settings, monkeypatch)


def test_the_key_rotation_is_never_reachable_through_the_tunnel():
    assert "/api/v1/tickets/key/rotate" in remote_channel.BLOCKED_ON_REMOTE
    assert "/api/v1/tickets/address/probe" in remote_channel.BLOCKED_ON_REMOTE


def test_the_public_settings_are_refused_from_a_remote_session(s4, monkeypatch):
    doc = s4.c.get(f"{API}/tickets/settings").json()
    monkeypatch.setattr(tickets_admin, "is_remote", lambda request: True)
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": doc["revision"], "public": {"base_url": "https://t-x.example.org"}})
    assert r.status_code == 403 and r.json()["code"] == "local_only"
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": doc["revision"], "ui": {"detail": "drawer"}})
    assert r.status_code == 200, "the other keys stay editable remotely"


def test_nobody_approves_a_revision_they_entered(s4):
    t, *_ = done(s4)
    r = s4.c.post(f"{API}/tickets/{t['id']}/costs", json={"lines": [{"kind": "other", "description": "חשבונית נייר", "amount": "300"}],
                                                          "amounts_include_vat": True})
    assert r.status_code == 201, r.text
    for action, extra in (("approve", {}), ("adjust", {"lines": LINES, "reason": "תיקון"})):
        r = decide(s4, t["id"], action, **extra)
        assert r.status_code == 409 and r.json()["code"] == "self_approval", (action, r.text)


def test_the_tickets_csv_uses_the_module_cell_guard():
    assert export.csv_cell is text_hygiene.csv_cell
    assert export.csv_cell("=1+1") == "'=1+1" and export.csv_cell(None) == "" and export.csv_cell(5) == 5
