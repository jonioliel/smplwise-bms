"""GRANTS3-295 (negative-first, FAKES ONLY): three approved backlog items of the shared Arx + WisKey identity, Arx side.

1. `grants-arrival-step-public` - the arrival step on the public vendor page also for a REGULAR external assignment the manager ticked
   "access needed" (CR-ARX-WISKEY-SHARED-IDENTITY section 5; the build notes' open question 5), and the ticket page announces the step
   (`arrival: true`) so the page fetches its lazy chunk only then.
2. `rfq-access-code-doors` - after the arrival is confirmed and a human approved it, the vendor's page shows WHICH doors, the dates and
   hours, and when / whether his personal code goes to his own number (····NN) - never the code, never a station id; the owner sees the
   grant's history (ids, states and reasons only).
3. `grants-cards-x5` - cards for a vendor's technicians: a card grant is approved like any other, the card is written through the WisKey
   seam by number (in memory only; never stored, logged, audited or answered), capture stays OFF (the lease route is not released), and
   the card is removed at the end (R1) - the revocation is verified only when the readback shows no card.

Nothing here contacts WisKey, a station, a door, a reader or WhatsApp: tests/fake_wiskey.FakeAccessEngine and FakeCodeTransport.
`GO_LIVE_PERMITTED` is switched on INSIDE a test only (monkeypatch), like every grant test; the shipped constant stays False."""
from __future__ import annotations

import json
import logging
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from conftest import as_user, bind
from fake_wiskey import FakeAccessEngine, FakeCodeTransport
from test_access_grants import DUE, PHONE, Env
from tickets_s4_world import API, Clock, build_s4

from smplwise.db import Database, new_id, set_setting
from smplwise.services import access_grants as ag
from smplwise.services.tickets.public_http import UNIFORM_404

UTC = timezone.utc
TECH_PHONE = "972500000061"
CARD = "CARD7731SENTINEL"  # a card number sentinel: must never reach the database, the WAL, an audit row, a log or an answer


def crid() -> str:
    return str(uuid.uuid4())


# ================================================================ 1. the arrival step on a regular external assignment

class Regular:
    """A ticket sent to the vendor through a REGULAR assignment (no RFQ order), with or without the "access needed" tick."""

    def __init__(self, settings, monkeypatch, *, enable: bool = True, tick: bool = True) -> None:
        self.s4 = build_s4(settings, monkeypatch)
        self.db = self.s4.db
        monkeypatch.setattr(ag, "GO_LIVE_PERMITTED", True)
        self.engine, self.transport = FakeAccessEngine(), FakeCodeTransport()
        monkeypatch.setattr(ag, "ENGINE_FACTORY", lambda db: self.engine)
        monkeypatch.setattr(ag, "TRANSPORT", self.transport)
        monkeypatch.setattr(ag, "_station_name", lambda sid: {"st-a": "Gate A"}.get(sid, "Station"))
        now = ag.iso(ag.now())
        with self.db.connection() as conn:
            if enable:
                set_setting(conn, ag.FLAG_KEY, "on")
        self.vendor = self.s4.vendor["id"]
        t = self.s4.ticket(title="Parking gate repair")
        self.ticket_id = t["id"]
        with self.db.connection() as conn:
            building = conn.execute("SELECT id FROM buildings LIMIT 1").fetchone()[0]
            conn.execute("UPDATE tickets SET building_id = ? WHERE id = ?", (building, t["id"]))
            conn.execute("INSERT INTO intercom_station_placement(config_entry_id, building_id, assigned_at) VALUES ('st-a', ?, ?)", (building, now))
            self.tech = new_id()
            conn.execute("""INSERT INTO ticket_contacts(id, kind, vendor_id, display_name, phone_e164, lang, active, created_by, created_at, updated_at,
                            phone_confirmed_at, phone_confirmed_via) VALUES (?, 'person', ?, 'Ron Electric', ?, 'en', 1, 'test', ?, ?, ?, 'code')""",
                         (self.tech, self.vendor, TECH_PHONE, now, now, now))
        self.assign = self.s4.assign_contact(t["id"], contact_id=self.vendor, **({"access_needed": True} if tick else {}))
        if enable or not tick:
            assert self.assign.status_code == 200, self.assign.text
            self.token = self.s4.token_of(t["id"])
            with self.db.connection(mode="read") as conn:
                self.assignment = conn.execute("SELECT id FROM ticket_assignments WHERE ticket_id = ? ORDER BY assigned_at DESC LIMIT 1", (t["id"],)).fetchone()[0]
        self.client, _ = self.s4.public(Clock(time.time()))

    def day(self, plus: int) -> str:
        with self.db.connection(mode="read") as conn:
            zone = ag.zone_of(conn)
        return (datetime.now(zone).date() + timedelta(days=plus)).isoformat()

    def body(self, **over) -> dict:
        b = {"person_id": self.tech, "date_from": self.day(3), "date_to": self.day(4), "hours": "08:00-17:00", "notice_ack": True,
             "notice_version": ag.NOTICE_VERSION, "client_request_id": crid()}
        b.update(over)
        return b

    def view(self):
        return self.client.get("/t/api/arrival", headers={"x-ticket-token": self.token})

    def post(self, **over):
        return self.client.post("/t/api/arrival", headers={"x-ticket-token": self.token}, json=self.body(**over))

    def ticket_page(self) -> dict:
        r = self.client.get("/t/api/ticket", headers={"x-ticket-token": self.token})
        assert r.status_code == 200, r.text
        return r.json()

    def grants(self) -> list[dict]:
        with self.db.connection(mode="read") as conn:
            return [dict(r) for r in conn.execute("SELECT * FROM access_grants ORDER BY created_at").fetchall()]


@pytest.fixture()
def reg(settings, monkeypatch):
    r = Regular(settings, monkeypatch)
    yield r
    ag.reset_for_tests()


def test_without_the_tick_a_regular_assignment_has_no_arrival_step_and_the_page_does_not_announce_it(settings, monkeypatch):
    r = Regular(settings, monkeypatch, tick=False)
    try:
        assert r.view().content == UNIFORM_404
        assert r.post().status_code == 404 and r.grants() == []
        assert "arrival" not in r.ticket_page(), "no announcement: the page never fetches the arrival chunk"
    finally:
        ag.reset_for_tests()


def test_the_tick_is_refused_while_the_feature_is_off(settings, monkeypatch):
    r = Regular(settings, monkeypatch, enable=False)
    try:
        assert r.assign.status_code == 422, r.assign.text
        assert r.assign.json()["details"]["fields"][0] == {"field": "access_needed", "code": "not_allowed"}
        with r.db.connection(mode="read") as conn:
            assert conn.execute("SELECT COUNT(*) FROM access_arrival_flags").fetchone()[0] == 0
            assert conn.execute("SELECT COUNT(*) FROM ticket_assignments WHERE ticket_id = ?", (r.ticket_id,)).fetchone()[0] == 0, "nothing was stored"
    finally:
        ag.reset_for_tests()


def test_the_preview_offers_the_tick_only_while_the_feature_is_on(reg):
    t = reg.s4.ticket(title="Second request")
    p = reg.s4.c.post(f"{API}/tickets/{t['id']}/assign/preview", json={"contact_id": reg.vendor})
    assert p.status_code == 200, p.text
    assert p.json()["access_needed"] == {"available": True}
    with reg.db.connection() as conn:
        set_setting(conn, ag.FLAG_KEY, "off")
    p = reg.s4.c.post(f"{API}/tickets/{t['id']}/assign/preview", json={"contact_id": reg.vendor})
    assert p.json()["access_needed"] == {"available": False}


def test_the_tick_is_stored_with_the_assignment_and_audited(reg):
    with reg.db.connection(mode="read") as conn:
        row = conn.execute("SELECT * FROM access_arrival_flags WHERE assignment_id = ?", (reg.assignment,)).fetchone()
        assert row is not None and row["ticket_id"] == reg.ticket_id and row["set_by"] == "dev-joni"
        details = json.loads(conn.execute("SELECT details_json FROM audit_log WHERE action = 'ticket.assign' ORDER BY id DESC LIMIT 1").fetchone()[0])
        assert details["access_needed"] is True


def test_the_ticket_page_announces_the_step_and_the_view_has_no_order_window(reg):
    assert reg.ticket_page()["arrival"] is True
    v = reg.view()
    assert v.status_code == 200, v.text
    body = v.json()
    assert body["window"] == {"from": None, "to": None} and body["current"] is None
    assert [p["label"] for p in body["persons"]] == ["Ron ····61"]
    assert TECH_PHONE not in v.text and "st-a" not in v.text


def test_an_arrival_on_a_regular_assignment_creates_only_a_requested_ticket_grant(reg):
    r = reg.post()
    assert r.status_code == 200, r.text
    assert r.json()["state"] == "waiting" and r.json()["outside_window"] is False
    (g,) = reg.grants()
    assert (g["state"], g["source_kind"], g["source_ref"], g["assignment_id"]) == ("requested", "ticket", reg.ticket_id, reg.assignment)
    assert g["doors_json"] == '{"st-a": [1]}' and g["credential"] == "pin"
    assert reg.engine.calls == [] and reg.transport.sent == []


def test_returning_a_regular_assignment_ends_its_request_and_hides_the_step(reg):
    assert reg.post().status_code == 200
    r = reg.client.post("/t/api/return", headers={"x-ticket-token": reg.token},
                        json={"kind": "cannot_handle", "reason": "no part", "client_request_id": crid()})
    assert r.status_code == 200, r.text
    (g,) = reg.grants()
    assert g["state"] == "revoked"
    assert reg.view().status_code == 404


def test_a_staff_link_never_gets_the_tick(reg):
    """A staff contact is a handler, not a vendor: the preview does not offer the tick and the assignment refuses it."""
    with reg.db.connection() as conn:
        staff = new_id()
        at = ag.iso(ag.now())
        conn.execute("""INSERT INTO ticket_contacts(id, kind, display_name, phone_e164, lang, active, employee, created_by, created_at, updated_at)
                        VALUES (?, 'person', 'Staff Member', '972500000068', 'he', 1, 1, 'test', ?, ?)""", (staff, at, at))
    t = reg.s4.ticket(title="Staff job")
    p = reg.s4.c.post(f"{API}/tickets/{t['id']}/assign/preview", json={"contact_id": staff})
    if p.status_code == 200:
        assert p.json()["access_needed"] == {"available": False}
    r = reg.s4.assign_contact(t["id"], contact_id=staff, access_needed=True)
    assert r.status_code in (403, 409, 422), r.text
    with reg.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM access_arrival_flags WHERE ticket_id = ?", (t["id"],)).fetchone()[0] == 0


# ================================================================ 2. the vendor sees the doors and the code's schedule after approval

def _approve(reg, gid: str):
    rev = next(g for g in reg.grants() if g["id"] == gid)["revision"]
    return reg.s4.c.post(f"{API}/access-grants/{gid}/approve", json={"revision": rev})


def test_before_approval_the_page_shows_waiting_and_no_doors(reg):
    assert reg.post().status_code == 200
    cur = reg.view().json()["current"]
    assert cur["state"] == "waiting" and cur["person"] == "Ron ····61" and "access" not in cur


def test_after_approval_the_page_names_the_doors_dates_hours_and_when_the_code_goes(reg):
    assert reg.post().status_code == 200
    (g,) = reg.grants()
    assert _approve(reg, g["id"]).status_code == 200
    ag.WORKER.run_once(reg.db)
    v = reg.view()
    cur = v.json()["current"]
    assert cur["state"] == "approved"
    acc = cur["access"]
    assert acc["doors"] == ["Gate A"] and acc["from"] == reg.day(3) and acc["to"] == reg.day(4) and acc["hours"] == "08:00-17:00"
    assert acc["credential"] == "pin" and acc["code"]["state"] == "scheduled" and acc["code"]["to"] == "····61" and acc["code"]["at"]
    assert "st-a" not in v.text and TECH_PHONE not in v.text
    for s in FakeAccessEngine.PIN_SENTINELS:
        assert s not in v.text


def test_once_the_code_left_the_page_says_sent_and_never_shows_it(reg):
    assert reg.post().status_code == 200
    (g,) = reg.grants()
    assert _approve(reg, g["id"]).status_code == 200
    ag.WORKER.run_once(reg.db)
    with reg.db.connection() as conn:
        conn.execute("UPDATE access_grants SET code_due_at = ? WHERE id = ?", (ag.iso(ag.now()), g["id"]))
    ag.WORKER.run_once(reg.db)
    assert len(reg.transport.sent) == 1
    number, text = reg.transport.sent[0]
    assert number == TECH_PHONE and "Gate A" in text, "the code message names the doors (owner answer 11)"
    v = reg.view()
    acc = v.json()["current"]["access"]
    assert acc["code"]["state"] == "sent"
    for s in FakeAccessEngine.PIN_SENTINELS:
        assert s not in v.text


def test_a_code_that_could_not_be_delivered_tells_the_vendor_to_ask_the_manager(reg):
    reg.transport.outcome = "not_sent"
    assert reg.post().status_code == 200
    (g,) = reg.grants()
    assert _approve(reg, g["id"]).status_code == 200
    ag.WORKER.run_once(reg.db)
    with reg.db.connection() as conn:
        conn.execute("UPDATE access_grants SET code_due_at = ? WHERE id = ?", (ag.iso(ag.now()), g["id"]))
    ag.WORKER.run_once(reg.db)
    assert reg.view().json()["current"]["access"]["code"]["state"] == "not_delivered"


# ================================================================ 2b. the owner-visible history of a grant

@pytest.fixture()
def env(settings, monkeypatch):
    e = Env(settings, monkeypatch)
    yield e
    ag.reset_for_tests()


def test_the_owner_sees_the_grants_history_in_order_with_ids_states_and_reasons_only(env, caplog):
    caplog.set_level(logging.DEBUG)
    gid = env.request().json()["grant"]["id"]
    assert env.approve(gid).status_code == 200
    env.run()
    env.clock[0] = DUE
    env.run()
    pin = env.person_of(gid)["pin"]
    r = env.c.get(f"{API}/access-grants/{gid}/history")
    assert r.status_code == 200, r.text
    rows = r.json()["history"]
    actions = [x["action"] for x in rows]
    for want in ("request", "notice_ack", "approve", "provision", "activate", "code_queued", "code_sent"):
        assert want in actions, (want, actions)
    assert actions.index("request") < actions.index("approve") < actions.index("activate") < actions.index("code_sent")
    approve = rows[actions.index("approve")]
    assert approve["by"]["kind"] == "user" and approve["by"]["name"]
    assert rows[actions.index("activate")]["by"] == {"kind": "system", "name": None}
    assert pin not in r.text and PHONE not in r.text and "wk-" not in r.text, "no PIN, no number, no WisKey id"
    assert r.headers["cache-control"].startswith("private")


def test_the_history_is_for_a_system_administrator_only_and_404_for_an_unseen_grant(env):
    gid = env.request().json()["grant"]["id"]
    bind(env.c, env.settings, "reader", "operator", "installation", "*")  # access.people.read: sees the grant, not its history
    r = env.c.get(f"{API}/access-grants/{gid}/history", headers=as_user("reader"))
    assert r.status_code == 403 and r.json()["code"] == "not_system_admin"
    bind(env.c, env.settings, "nobody", "viewer", "floor", env.w.floors["floor2"])
    assert env.c.get(f"{API}/access-grants/{gid}/history", headers=as_user("nobody")).status_code == 404
    assert env.c.get(f"{API}/access-grants/{'f' * 32}/history").status_code == 404


def test_a_vendor_page_request_shows_as_the_vendor_page_in_the_history(reg):
    assert reg.post().status_code == 200
    (g,) = reg.grants()
    rows = reg.s4.c.get(f"{API}/access-grants/{g['id']}/history").json()["history"]
    first = rows[0]
    assert first["action"] == "request" and first["by"] == {"kind": "page", "name": None}
    assert reg.tech not in json.dumps(rows) and reg.vendor not in json.dumps(rows), "no contact ids"


# ================================================================ 3. cards for a vendor's technicians (X5)

def _cards_on(env) -> None:
    env.sql("INSERT OR REPLACE INTO settings(key, value) VALUES (?, 'on')", ag.CARDS_KEY)


def _card_grant(env, contact_id: str | None = None) -> str:
    _cards_on(env)
    r = env.request(contact_id, credential="card")
    assert r.status_code == 200, r.text
    gid = r.json()["grant"]["id"]
    a = env.approve(gid)
    assert a.status_code == 200, a.text
    env.run()
    assert env.grant(gid)["state"] == "active"
    return gid


def _attach(env, gid: str, card: str = CARD, user: str | None = None):
    rev = env.grant(gid)["revision"]
    return env.post(f"/access-grants/{gid}/card", {"revision": rev, "card_no": card}, user)


def test_a_card_grant_is_refused_while_cards_are_off(env):
    r = env.request(credential="card")
    assert r.status_code == 409 and r.json()["code"] == "access_grant_cards_off"
    assert env.sql_count("SELECT COUNT(*) FROM access_grants") == 0


def test_cards_cannot_be_switched_on_without_the_go_live_permit(settings, monkeypatch):
    e = Env(settings, monkeypatch, go_live=False)
    try:
        r = e.c.put(f"{API}/access-grants/settings", json={"cards": "on"})
        assert r.status_code == 409 and r.json()["code"] == "access_grants_not_permitted"
        s = e.c.get(f"{API}/access-grants/settings").json()
        assert s["cards"] == "off" and s["card_capture"] == "off"
    finally:
        ag.reset_for_tests()


def test_a_card_is_for_a_vendors_technician_only(env):
    _cards_on(env)
    with env.db.connection() as conn:
        lone = env.contact(conn, name="Lone Visitor", phone="972500000049")
    r = env.request(lone, credential="card")
    assert r.status_code == 409 and r.json()["code"] == "access_grant_card_not_vendor"


def test_a_card_grant_is_approved_without_a_code_and_provisioned_without_a_pin(env):
    gid = _card_grant(env)
    g = env.grant(gid)
    assert (g["credential"], g["code_state"], g["card_state"]) == ("card", "not_needed", "awaiting")
    p = env.person_of(gid)
    assert p["pin"] is None and p.get("cards", []) == [] and p["active"] is True
    assert "pin_generate" not in env.engine.calls
    listed = env.c.get(f"{API}/access-grants/{gid}").json()["grant"]
    assert listed["card_state"] == "awaiting" and listed["credential"] == "card"


def test_a_decided_grant_never_switches_between_a_pin_and_a_card(env):
    gid = env.active_grant()
    _cards_on(env)
    r = env.request(credential="card")
    assert r.status_code == 409 and r.json()["code"] == "access_grant_credential_change", r.text
    assert env.grant(gid)["pending_json"] is None and env.grant(gid)["credential"] == "pin"
    assert ag.covers(ag.Scope({"a": [1]}, "1", "2", None, "none"), ag.Scope({"a": [1]}, "1", "2", None, "card")) is False, "none -> card widens"


def test_the_card_is_written_through_the_seam_and_never_kept(env, caplog):
    caplog.set_level(logging.DEBUG)
    gid = _card_grant(env)
    r = _attach(env, gid)
    assert r.status_code == 200, r.text
    assert r.json()["grant"]["card_state"] == "attached"
    p = env.person_of(gid)
    assert [c["no"] for c in p["cards"]] == [CARD]
    assert "card_add" in env.engine.calls
    data_dir = Path(env.settings.db_path).parent
    blobs = b"".join(f.read_bytes() for f in data_dir.glob(Path(env.settings.db_path).name + "*"))
    assert CARD.encode() not in blobs, "the card number is in the database file or its WAL"
    with env.db.connection(mode="read") as conn:
        audit = [json.dumps(dict(x), ensure_ascii=False) for x in conn.execute("SELECT * FROM audit_log").fetchall()]
    assert not [a for a in audit if CARD in a or "7731" in a]
    assert any("access.grant.card_attached" in a for a in audit)
    assert CARD not in caplog.text and all(CARD not in a for a in env.answers)
    assert CARD not in env.c.get(f"{API}/access-grants/{gid}/history").text


def test_a_bad_card_number_is_refused_without_echoing_it(env):
    gid = _card_grant(env)
    r = _attach(env, gid, card="BAD CARD<7731>")
    assert r.status_code == 422 and "7731" not in r.text
    assert env.grant(gid)["card_state"] == "awaiting" and "card_add" not in env.engine.calls


def test_attaching_needs_the_approve_permissions_an_active_card_grant_and_the_current_revision(env):
    gid = _card_grant(env)
    bind(env.c, env.settings, "reader", "operator", "installation", "*")
    r = _attach(env, gid, user="reader")
    assert r.status_code == 403, r.text
    stale = env.post(f"/access-grants/{gid}/card", {"revision": env.grant(gid)["revision"] - 1, "card_no": CARD})
    assert stale.status_code == 409 and stale.json()["code"] == "stale_revision"
    pin_gid = env.active_grant(contact_id=env.tech2)
    r = _attach(env, pin_gid)
    assert r.status_code == 409 and r.json()["code"] == "access_grant_state"
    assert "card_add" not in env.engine.calls


def test_a_second_card_is_refused_and_a_card_held_by_someone_else_is_a_conflict(env):
    gid = _card_grant(env)
    assert _attach(env, gid).status_code == 200
    r = _attach(env, gid, card="OTHER1")
    assert r.status_code == 409 and r.json()["code"] == "access_grant_state"
    gid2 = _card_grant(env, contact_id=env.tech2)
    r = _attach(env, gid2)
    assert r.status_code == 409 and r.json()["code"] == "intercom_card_conflict"
    assert env.grant(gid2)["card_state"] == "awaiting"


def test_an_unknown_card_write_is_settled_by_a_fresh_read(env):
    gid = _card_grant(env)
    env.engine.unknown_after_card = True  # the card lands, the answer is lost
    r = _attach(env, gid)
    assert r.status_code == 409 and r.json()["code"] == "access_grant_card_unknown"
    assert env.grant(gid)["card_state"] == "unknown"
    r = _attach(env, gid, card="ANOTHER2")
    assert r.status_code == 409 and r.json()["code"] == "access_grant_card_present", "the read shows the card: never a second one"
    assert env.grant(gid)["card_state"] == "attached"
    assert [c["no"] for c in env.person_of(gid)["cards"]] == [CARD]


def test_capture_stays_off(env):
    gid = _card_grant(env)
    r = env.post(f"/access-grants/{gid}/card/capture", {"revision": env.grant(gid)["revision"]})
    assert r.status_code == 409 and r.json()["code"] == "access_grant_card_capture_off"
    assert not [c for c in env.engine.calls if "capture" in c]


def test_revoking_a_card_grant_removes_the_card_and_is_verified_only_without_it(env):
    gid = _card_grant(env)
    assert _attach(env, gid).status_code == 200
    env.engine.fail["card_remove"] = "not_sent"
    assert env.post(f"/access-grants/{gid}/revoke").status_code == 200
    assert env.grant(gid)["state"] == "revoking", "a card still on the person: the revoke is not verified"
    env.clock[0] = env.clock[0] + timedelta(minutes=10)
    env.run()
    g = env.grant(gid)
    assert (g["state"], g["card_state"]) == ("revoked", "removed")
    p = env.person_of(gid)
    assert p["cards"] == [] and p["active"] is False


def test_the_window_end_removes_the_card_too(env):
    gid = _card_grant(env)
    assert _attach(env, gid).status_code == 200
    env.clock[0] = datetime(2026, 10, 22, 14, 0, tzinfo=UTC)
    env.run()
    g = env.grant(gid)
    assert g["state"] == "ended" and env.person_of(gid)["cards"] == []


def test_the_shipped_build_keeps_cards_and_capture_off():
    from smplwise.services import access_cards

    assert ag.GO_LIVE_PERMITTED is True and access_cards.CAPTURE_PERMITTED is False  # ECCACT-295: the permit is open; card capture is an unbuilt flow, not a permit
    assert ag.DEFAULTS[ag.CARDS_KEY] == "off"
