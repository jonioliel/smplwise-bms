"""2.7.1 hardening of consent by link (Fable review of 2.7.0, WA-CONSENT-LINK residuals; negative first, fake WisKey only).

- No second live consent request per person: `plan()` and the insert ran in two transactions, so two parallel sends to the same
  `unknown` person could both create one (two WhatsApp requests, two live links). The insert now re-checks inside its own write
  transaction; the loser sends nothing and answers 409.
- C3: a decline on the page writes the opt-out row with a fixed `by_user_id` marker (never NULL, never a user id); the person's tab still
  names "the consent link" and an administrator can still clear it.
- C2: the releaser rebuilds the sender without a session (`factor_ok = False`); that is correct only while no permission the release
  re-checks is in rbac.LOCAL_ADMIN_PERMISSIONS - pinned here, and a build where it is keeps the message due instead of dropping it."""
from __future__ import annotations

import pytest
from intercom_station_scope import station_scope  # noqa: F401 - a fixture (mc needs it)
from test_intercom_consent_link import World, cw, wa_texts  # noqa: F401 - cw is a fixture
from test_intercom_messaging import mc, req, send  # noqa: F401 - mc is a fixture

from smplwise import rbac
from smplwise.services import intercom_consent as C
from smplwise.services import intercom_messaging as M


def test_a_parallel_send_never_creates_a_second_live_request(cw, monkeypatch):  # noqa: F811
    w: World = cw
    w.on()
    first = send(w.c, "u1", template="card_ready")
    assert first.status_code == 202 and first.json()["message"]["outcome"] == "consent_requested", first.text
    real = C.plan
    calls: list[int] = []

    def stale_plan(conn, person_id, now):  # the race: the send's own plan() ran before the other send committed its request
        calls.append(1)
        return ("new", None) if len(calls) == 1 else real(conn, person_id, now)

    monkeypatch.setattr(C, "plan", stale_plan)
    r = send(w.c, "u1", template="closure")
    assert (r.status_code, r.json()["code"]) == (409, "message_consent_pending"), r.text
    assert len(w.q("SELECT * FROM intercom_consent_requests WHERE state IN ('sending', 'open')")) == 1
    assert len(wa_texts(w)) == 1, "exactly one consent request went out"
    got = [(m["outcome"], m["reason"]) for m in w.q("SELECT outcome, reason FROM intercom_messages ORDER BY at, rowid")]
    assert got == [("sent", None)], got  # the loser's attempt record is withdrawn (`not_sent`: nothing went out)


def test_the_insert_itself_refuses_a_second_live_request(cw):  # noqa: F811
    w: World = cw
    w.on()
    assert send(w.c, "u1", template="card_ready").status_code == 202
    with w.db.connection(mode="read") as conn:
        cfg = M.read_settings(conn)
    with pytest.raises(C.ConsentRaced) as exc:
        with w.db.connection() as conn:
            C.create_request(conn, principal=rbac.Principal("dev-root", "root", "root", "ingress"), person_id="u1", message_id="m-x", cfg=cfg,
                             request_id=None, now=C.utc())
    assert exc.value.kind == "open"
    assert len(w.q("SELECT * FROM intercom_consent_requests")) == 1


def test_c3_a_decline_names_the_consent_link_and_an_administrator_can_clear_it(cw):  # noqa: F811
    w: World = cw
    w.on()
    send(w.c, "u1", template="card_ready")
    assert w.answer(w.token(), "decline").status_code == 200
    (opt,) = w.q("SELECT by_user_id, by_name FROM intercom_message_optout")
    assert opt["by_user_id"] == C.OPTOUT_BY_ID and opt["by_user_id"] is not None and opt["by_name"] == C.OPTOUT_BY
    page = req(w.c, "GET", "/people/u1/messages")
    assert page.status_code == 200 and page.json()["opt_out"]["by"] == C.OPTOUT_BY
    r = req(w.c, "PUT", "/people/u1/messages/optout", json={"opted_out": False})
    assert r.status_code == 200 and r.json()["opt_out"] is None and w.q("SELECT * FROM intercom_message_optout") == []


def test_c2_no_permission_the_release_rechecks_is_behind_the_local_factor_gate():
    assert set(C.RELEASE_PERMISSIONS).isdisjoint(rbac.LOCAL_ADMIN_PERMISSIONS)
    p = C.sender_principal({"actor_user_id": "l_abc", "actor_username": "loc", "actor_name": "loc", "actor_source": "local"}, rbac.Principal)
    assert p.factor_ok is False and p.source == "local"


def test_c2_a_build_that_gates_a_release_permission_keeps_the_message_due(cw, monkeypatch):  # noqa: F811
    w: World = cw
    w.on()
    send(w.c, "u1", template="card_ready")
    assert w.answer(w.token()).status_code == 200
    monkeypatch.setattr(rbac, "LOCAL_ADMIN_PERMISSIONS", rbac.LOCAL_ADMIN_PERMISSIONS | {"access.people.message"})
    assert w.release() == {"released": 0, "dropped": 0, "retry": 1}
    assert w.q("SELECT state FROM intercom_held_messages")[0]["state"] == "due"
