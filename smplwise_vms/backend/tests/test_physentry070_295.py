"""PHYSENTRY070-295 (negative-first, FAKES ONLY): "physical entry required" marked on an outside assignment AFTER it was made
(owner decision GRANTS3 Q3 = B, design note docs/changes/ARRIVAL-AFTER-GRANT-DESIGN.md), and the vendor notice when it is cancelled.
OFF by default: setting `access.external.arrival_after_grant`. Nothing here contacts WisKey, a door or WhatsApp.

NOT YET RUN by the author (the runner was reserved for the release gate): the lead runs this file."""
from __future__ import annotations

import pytest
from test_grants3_295 import Regular
from tickets_s4_world import API

from smplwise.db import set_setting
from smplwise.services import access_external as ax
from smplwise.services import access_grants as ag
from smplwise.services.tickets import external as ext


@pytest.fixture()
def reg(settings, monkeypatch):
    r = Regular(settings, monkeypatch, tick=False)
    yield r
    ag.reset_for_tests()


def _post(r, value: bool, rev: int | None = None):
    rev = rev if rev is not None else r.s4.w.detail(r.ticket_id)["revision"]
    return r.s4.c.post(f"{API}/tickets/{r.ticket_id}/access-needed", json={"value": value, "revision": rev}, headers=r.s4.h("joni"))


def _flags(r) -> int:
    with r.db.connection(mode="read") as conn:
        return conn.execute("SELECT COUNT(*) FROM access_arrival_flags").fetchone()[0]


def _switch(r, on: bool) -> None:
    with r.db.connection() as conn:
        set_setting(conn, ax.ARRIVAL_AFTER_GRANT_KEY, "on" if on else "off")


def test_default_off_refuses_the_route_and_draws_no_control(reg):
    assert _post(reg, True).status_code == 409 and _post(reg, True).json()["code"] == "arrival_after_grant_off"
    assert _flags(reg) == 0
    assert "access_needed" not in (reg.s4.w.detail(reg.ticket_id).get("link") or {})


def test_tick_after_the_assignment_then_untick_keeps_issued_grants(reg):
    _switch(reg, True)
    block = reg.s4.w.detail(reg.ticket_id)["link"]["access_needed"]
    assert block == {"available": True, "on": False}
    assert reg.view().status_code == 404, "no arrival step before the tick"
    r = _post(reg, True)
    assert r.status_code == 200, r.text
    assert r.json()["link"]["access_needed"]["on"] is True and _flags(reg) == 1
    assert reg.view().status_code == 200, "the vendor's page now offers the step"
    made = reg.post()
    assert made.status_code in (200, 201), made.text
    before = reg.grants()
    r = _post(reg, False)
    assert r.status_code == 200 and r.json()["link"]["access_needed"]["on"] is False and _flags(reg) == 0
    assert reg.grants() == before, "an untick never touches a request or a grant that exists"
    assert reg.view().status_code == 404, "the step is no longer offered"


def test_stale_revision_and_feature_off_are_refused(reg):
    _switch(reg, True)
    assert _post(reg, True, rev=1).status_code == 409 and _flags(reg) == 0
    with reg.db.connection() as conn:
        set_setting(conn, ag.FLAG_KEY, "off")
    assert _post(reg, True).status_code == 422 and _flags(reg) == 0


def test_untick_queues_the_cancel_notice_through_the_dispatch_seam(reg, monkeypatch):
    _switch(reg, True)
    seen: list[dict] = []

    class Fake(ext.ManualDispatch):
        def queue_arrival_cancelled(self, conn, **kw):
            seen.append({k: kw[k] for k in ("assignment_id", "requested_by")})
            return {"queued": True, "channel": "whatsapp"}

    monkeypatch.setattr(ext, "DISPATCH", Fake())
    assert _post(reg, True).status_code == 200
    assert seen == [], "ticking sends nothing"
    assert _post(reg, False).status_code == 200
    assert len(seen) == 1 and seen[0]["assignment_id"] == reg.assignment
    assert _post(reg, False).status_code == 200 and len(seen) == 1, "a second untick is a no-op: one cancel, one message"
    with reg.db.connection(mode="read") as conn:
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'ticket.access_needed.clear'").fetchone()
    assert row is not None and "Ron" not in row[0] and "972" not in row[0], "ids only in the audit row"


def test_the_notice_text_is_code_owned_in_all_four_languages():
    from smplwise.services.tickets import message_templates as mt

    for lang in mt.LANGS:
        tpl = mt.variant_by_id(mt.variant_template_id(mt.ARRIVAL_CANCELLED, lang), "update")
        assert tpl is not None and "{link}" in tpl.body and tpl.purpose == "update"
    assert mt.variant_by_id(mt.variant_template_id(mt.ARRIVAL_CANCELLED, "he"), "closed") is None, "bound to its own purpose"
