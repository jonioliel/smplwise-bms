"""2.7.1 hardening of the external-person door grants (Fable review of 2.7.0, WISKEYID K1-K4, K6; negative first, FAKES ONLY).

- K1: a vendor-page arrival on a work order whose ticket has no station placement (and no "entrance for external people" station)
  used to store `doors = {}` - a request no approver could ever approve. It is now refused at request time (409
  `no_doors_suggested`) and nothing is written (no grant, no pending technician, no notice).
- K2: the mutating routes answer the uniform 404 for a grant the caller cannot see - an id never discloses existence.
- K3: `approve()` checks the approver's authority on the grant's stations BEFORE it reads the person from WisKey.
- K4: a widening approved while the grant is `provisioning` reaches WisKey (it used to be dropped: Arx showed the wider map,
  WisKey held the narrower one).
- K6: the arrival step's order lookup reads the RFQ's own timeline rows (indexed by `rfq_id`), not every order of the installation."""
from __future__ import annotations

import json
import sqlite3

import pytest
from conftest import as_user, bind
from test_access_arrival import Arrival
from test_access_grants import APPROVER, Env

from smplwise.services import access_arrival
from smplwise.services import access_grants as ag
from test_tickets_rfq import s4  # noqa: F401 - the RFQ world fixture
from test_tickets_rfq_order import award_of, awarded, ordered


@pytest.fixture()
def env(settings, monkeypatch):
    e = Env(settings, monkeypatch)
    yield e
    ag.reset_for_tests()


# ---------------------------------------------------------------- K1


def test_k1_an_arrival_without_any_door_suggestion_is_refused_and_writes_nothing(settings, monkeypatch):
    a = Arrival(settings, monkeypatch)
    try:
        with a.db.connection() as conn:
            conn.execute("DELETE FROM intercom_station_placement")
            before_contacts = conn.execute("SELECT COUNT(*) FROM ticket_contacts").fetchone()[0]
        r = a.post()
        assert r.status_code == 409 and r.json()["code"] == "no_doors_suggested", r.text
        r = a.post(person_id=None, new_person={"name": "אבי חדש", "phone": "050-000-0057"})
        assert r.status_code == 409 and r.json()["code"] == "no_doors_suggested", r.text
        assert a.grants() == []
        with a.db.connection(mode="read") as conn:
            assert conn.execute("SELECT COUNT(*) FROM ticket_contacts").fetchone()[0] == before_contacts, "no pending technician left behind"
            assert conn.execute("SELECT COUNT(*) FROM access_pending_contacts").fetchone()[0] == 0
            assert conn.execute("SELECT COUNT(*) FROM access_grant_notices").fetchone()[0] == 0
        assert a.engine.calls == [] and a.transport.sent == []
    finally:
        ag.reset_for_tests()


def test_k1_the_service_refuses_an_empty_door_map_from_the_page(env):
    with env.db.connection() as conn:
        with pytest.raises(ag.ApiError) as exc:
            ag.request_grant(conn, actor=ag.ContactActor("contact:x"), requested_by="contact:x", contact_id=env.tech, source_kind="rfq_order",
                             source_ref=None, assignment_id=None, scope=ag.Scope({}, "2026-10-22T05:00:00Z", "2026-10-22T14:00:00Z", None, "pin"))
        assert exc.value.code == "no_doors_suggested"
        assert conn.execute("SELECT COUNT(*) FROM access_grants").fetchone()[0] == 0


# ---------------------------------------------------------------- K2


def test_k2_every_mutating_route_is_a_uniform_404_for_a_grant_the_caller_cannot_see(env):
    gid = env.request(doors={"st-a": [1]}).json()["grant"]["id"]
    rid = env.role("מאשר עמדה ב", APPROVER)
    bind(env.c, env.settings, "outsider", rid, "access_control_station", "st-b")
    rev = env.grant(gid)["revision"]
    for path, body in ((f"/access-grants/{gid}/approve", {"revision": rev, "told": True}), (f"/access-grants/{gid}/refuse", {"revision": rev}),
                       (f"/access-grants/{gid}/revoke", {}), (f"/access-grants/{gid}/rotate", {"revision": rev}),
                       (f"/access-grants/{gid}/provision-now", {})):
        real = env.post(path, body, user="outsider")
        unknown = env.post(path.replace(gid, "0" * 32), body, user="outsider")
        assert real.status_code == unknown.status_code == 404, (path, real.text, unknown.text)
        assert real.json()["code"] == unknown.json()["code"] == "access_grant_not_found", path
    assert env.grant(gid)["state"] == "requested"


# ---------------------------------------------------------------- K3


def test_k3_approve_checks_the_authority_before_it_reads_wiskey(env):
    gid = env.active_grant(doors={"st-a": [1]})  # linked: an approval now reads the person
    env.request(doors={"st-a": [1], "st-b": [1]})  # a widening waits for approval
    rid = env.role("מאשר עמדה ב בלבד", APPROVER)
    bind(env.c, env.settings, "half", rid, "access_control_station", "st-b")  # sees the grant (st-b is pending) but lacks st-a
    env.engine.calls.clear()
    r = env.approve(gid, user="half")
    assert r.status_code == 403, r.text
    assert "get_person" not in env.engine.calls, "an unauthorised caller made Arx read WisKey"
    env.engine.offline = True
    r = env.approve(gid, user="half")
    assert r.status_code == 403, "the engine's reachability is not disclosed to an unauthorised caller (it was 503)"


# ---------------------------------------------------------------- K4


def test_k4_a_widening_approved_while_provisioning_reaches_wiskey(env):
    gid = env.request(doors={"st-a": [1]}).json()["grant"]["id"]
    assert env.approve(gid).status_code == 200
    real_apply = env.engine.apply
    fired = []

    def apply_with_a_widening_in_flight(*args, **kwargs):
        if not fired:
            fired.append(1)
            assert env.grant(gid)["state"] == "provisioning"
            assert env.request(doors={"st-a": [1], "st-b": [1]}).json()["outcome"] == "widening"
            assert env.approve(gid).status_code == 200, "the amendment is approved while the first write is out"
        return real_apply(*args, **kwargs)

    env.engine.apply = apply_with_a_widening_in_flight
    env.run()
    g = env.grant(gid)
    assert g["state"] == "active" and json.loads(g["doors_json"]) == {"st-a": [1], "st-b": [1]}
    env.run()
    assert env.person_of(gid)["doors"] == {"st-a": [1], "st-b": [1]}, "WisKey holds what Arx shows"
    assert env.grant(gid)["needs_push"] == 0


# ---------------------------------------------------------------- K6


def test_k6_the_order_lookup_reads_only_the_rfqs_own_timeline(s4, settings):  # noqa: F811
    d, vs = awarded(s4, settings)
    a = award_of(d, vs["v1"])
    out = ordered(s4, d["id"], a["id"])
    with s4.db.connection(mode="read") as conn:
        aid = conn.execute("SELECT assignment_id FROM ticket_quotes WHERE ticket_id = ?", (out["ticket"]["id"],)).fetchone()[0]
        want = json.loads(conn.execute("SELECT data_json FROM ticket_rfq_events WHERE kind = 'order_created'").fetchone()[0])
        seen: list[str] = []
        conn.set_trace_callback(seen.append)
        try:
            got = access_arrival._order(conn, aid)
        finally:
            conn.set_trace_callback(None)
        events = [s for s in seen if "ticket_rfq_events" in s]
        assert events and all("rfq_id = " in s for s in events), events
        for s in events:
            plan = " ".join(str(r[-1]) for r in conn.execute("EXPLAIN QUERY PLAN " + s))
            assert "idx_ticket_rfq_events_rfq" in plan, plan
    assert got is not None and got["ticket_id"] == out["ticket"]["id"]
    assert (got["work_from"], got["work_to"]) == (want["work_from"], want["work_to"]) and got["work_from"]


def test_k6_no_rfq_tables_or_no_quote_is_still_no_order():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    assert access_arrival._order(conn, "a1") is None
