"""CR-INTAKE99 / TENANTINTAKE098-295 (owner answers 143-156, 2026-10-24; phases 1-3, no public page): the free-text intake on the real
database - known numbers only, drafts, caps, coalescing, approval through create_ticket (origin inbound), merge, reject + block,
the fixed replies, retention, permissions, and "no text / no number in an audit row". FAKES ONLY (no WhatsApp, no network)."""
from __future__ import annotations

import datetime as dt
import json

import pytest
from fake_ha_whatsapp import FakeHaWhatsapp
from tickets_world import API, MAINT, build

from smplwise.db import Database
from smplwise.services.tickets import intake, messaging
from smplwise.services.tickets.keyring import KEYS

UTC = dt.timezone.utc
NOW = dt.datetime(2026, 10, 25, 9, 0, tzinfo=UTC)
PHONE = "972501112233"
OTHER = "972509998877"
SECRET_WORDS = "המעלית בבניין B תקועה בקומה 3 דחוף"


@pytest.fixture()
def w(settings):
    world = build(settings)
    return world


def db(w) -> Database:
    return Database(w.settings.db_path)


def turn_on(w, **extra) -> None:
    doc = w.c.get(f"{API}/tickets/settings", headers=w.h("joni")).json()
    body = {"revision": doc["revision"], "intake": {"enabled": True, "whatsapp": True, "default_department": MAINT, **extra}}
    r = w.c.put(f"{API}/tickets/settings", json=body, headers=w.h("joni"))
    assert r.status_code == 200, r.text


def add_known(w, phone: str = "0501112233", name: str = "דנה כהן", user: str = "joni"):
    return w.c.post(f"{API}/tickets/intake/known", json={"display_name": name, "phone": phone, "org": "דירה 12"}, headers=w.h(user))


def accept(w, digits: str, content: str, at: dt.datetime = NOW, rt=messaging.RUNTIME) -> tuple[str, str | None]:
    _kid, key = KEYS.current(create=False)
    with db(w).connection() as conn:
        return intake.accept(conn, key=key, digits=digits, content=content, account_key=None, now=at, rt=rt)


def drafts(w, user: str = "joni", state: str = "open"):
    return w.c.get(f"{API}/tickets/intake/drafts?state={state}", headers=w.h(user))


def rows(w, sql: str, *args):
    with db(w).connection() as conn:
        return [dict(r) for r in conn.execute(sql, args)]


# ---------------------------------------------------------------- off by default

def test_everything_ships_off_and_a_message_makes_nothing(w):
    doc = w.c.get(f"{API}/tickets/settings", headers=w.h("joni")).json()["intake"]
    assert doc["enabled"] is False and doc["whatsapp"] is False and doc["classifier"] == "rules"
    assert accept(w, PHONE, SECRET_WORDS) == ("intake_off", None)
    assert rows(w, "SELECT COUNT(*) AS n FROM ticket_intake_drafts")[0]["n"] == 0
    assert rows(w, "SELECT COUNT(*) AS n FROM ticket_intake_unlisted")[0]["n"] == 0


def test_no_number_no_draft(w):
    turn_on(w)
    assert accept(w, None, SECRET_WORDS) == ("intake_no_number", None)


# ---------------------------------------------------------------- permissions (owner 143)

def test_who_may_see_the_queue(w):
    turn_on(w)
    assert drafts(w, "joni").status_code == 200  # system administrators hold tickets.intake
    assert drafts(w, "mona").status_code == 200  # a department manager holds it implicitly
    for user in ("tom", "nora", "vic", "alda"):
        assert drafts(w, user).status_code == 403, user
    assert w.c.get(f"{API}/tickets/intake/summary", headers=w.h("tom")).json() == {"open": 0, "can": False, "enabled": False}


def test_a_grant_of_the_permission_opens_the_queue_and_the_list(w):
    from conftest import bind

    turn_on(w)
    assert drafts(w, "nora").status_code == 403
    bind(w.c, w.settings, "nora", "tickets_intake", "installation", "*")
    assert drafts(w, "nora").status_code == 200
    assert w.c.get(f"{API}/tickets/intake/known", headers=w.h("nora")).status_code == 200


def test_the_known_list_is_not_open_to_an_implicit_manager(w):
    turn_on(w)
    assert w.c.get(f"{API}/tickets/intake/known", headers=w.h("mona")).status_code == 403
    assert add_known(w, user="mona").status_code == 403
    assert add_known(w).status_code == 201


# ---------------------------------------------------------------- SEC217: security review 2.16.0 finding 4.1 - drafts scoped by department

def _draft_actions(w, user: str, did: str, rev: int) -> list[int]:
    return [
        w.c.get(f"{API}/tickets/intake/drafts/{did}", headers=w.h(user)).status_code,
        w.c.put(f"{API}/tickets/intake/drafts/{did}", json={"revision": rev, "values": {"title": "x"}}, headers=w.h(user)).status_code,
        w.c.post(f"{API}/tickets/intake/drafts/{did}/approve", json={"revision": rev}, headers=w.h(user)).status_code,
        w.c.post(f"{API}/tickets/intake/drafts/{did}/reject", json={"revision": rev, "reason": "spam"}, headers=w.h(user)).status_code,
        w.c.post(f"{API}/tickets/intake/drafts/{did}/merge", json={"revision": rev, "number": 1}, headers=w.h(user)).status_code,
    ]


def test_sec217_a_department_manager_sees_only_his_departments_drafts(w):
    turn_on(w)  # default department: maintenance
    add_known(w)
    did = accept(w, PHONE, SECRET_WORDS)[1]
    rev = w.c.get(f"{API}/tickets/intake/drafts/{did}", headers=w.h("joni")).json()["revision"]
    assert [d["id"] for d in drafts(w, "mona").json()["drafts"]] == [did]  # the maintenance manager
    other = drafts(w, "cleo").json()  # the cleaning manager: the queue opens, but holds nothing of maintenance
    assert other["drafts"] == [] and other["total"] == 0
    assert w.c.get(f"{API}/tickets/intake/summary", headers=w.h("cleo")).json()["open"] == 0
    assert w.c.get(f"{API}/tickets/intake/summary", headers=w.h("mona")).json()["open"] == 1
    assert _draft_actions(w, "cleo", did, rev) == [404] * 5  # the same 404 as an unknown id - no existence oracle
    assert w.c.get(f"{API}/tickets/intake/drafts/nope", headers=w.h("cleo")).json()["code"] == \
        w.c.get(f"{API}/tickets/intake/drafts/{did}", headers=w.h("cleo")).json()["code"]
    d = rows(w, "SELECT state, revision FROM ticket_intake_drafts WHERE id = ?", did)[0]
    assert d == {"state": "open", "revision": rev}  # nothing changed by the refused calls
    assert SECRET_WORDS not in json.dumps(other)


def test_sec217_routing_a_draft_moves_it_between_queues(w):
    turn_on(w)
    add_known(w)
    did = accept(w, PHONE, SECRET_WORDS)[1]
    rev = w.c.get(f"{API}/tickets/intake/drafts/{did}", headers=w.h("mona")).json()["revision"]
    r = w.c.put(f"{API}/tickets/intake/drafts/{did}", json={"revision": rev, "values": {"department_id": w.cleaning}}, headers=w.h("mona"))
    assert r.status_code == 200, r.text
    assert drafts(w, "mona").json()["drafts"] == [] and w.c.get(f"{API}/tickets/intake/drafts/{did}", headers=w.h("mona")).status_code == 404
    assert [d["id"] for d in drafts(w, "cleo").json()["drafts"]] == [did]
    assert w.c.get(f"{API}/tickets/intake/drafts/{did}", headers=w.h("cleo")).status_code == 200
    assert [d["id"] for d in drafts(w, "joni").json()["drafts"]] == [did]  # installation-wide tickets.intake sees every draft


def test_sec217_a_draft_without_a_department_is_for_installation_wide_handlers_only(w):
    turn_on(w, default_department="")
    add_known(w)
    did = accept(w, PHONE, "שלום")[1]
    with db(w).connection() as conn:
        conn.execute("UPDATE ticket_intake_drafts SET suggestion_json = json_set(suggestion_json, '$.department_id', NULL) WHERE id = ?", (did,))
    assert [d["id"] for d in drafts(w, "joni").json()["drafts"]] == [did]
    assert drafts(w, "mona").json()["drafts"] == [] and drafts(w, "cleo").json()["drafts"] == []
    assert w.c.get(f"{API}/tickets/intake/drafts/{did}", headers=w.h("mona")).status_code == 404


def test_sec217_duplicate_hints_show_only_tickets_the_handler_may_see(w):
    turn_on(w)
    add_known(w)
    mine = w.create("mona", "מזגן לא מקרר")
    foreign = w.create("joni", "ניקיון לובי", dept=w.cleaning)
    did = accept(w, PHONE, "המזגן לא מקרר")[1]
    with db(w).connection() as conn:
        cat = "cat-sec217"
        conn.execute("INSERT INTO ticket_categories(id, department_id, name) VALUES (?,?,?)", (cat, MAINT, "קירור"))
        conn.execute("UPDATE tickets SET category_id = ? WHERE id IN (?, ?)", (cat, mine["id"], foreign["id"]))
        conn.execute("UPDATE ticket_intake_drafts SET suggestion_json = json_set(suggestion_json, '$.category', json(?)) WHERE id = ?",
                     (json.dumps({"value": cat, "confidence": "high"}), did))
    seen = w.c.get(f"{API}/tickets/intake/drafts/{did}", headers=w.h("mona")).json()["duplicates"]["ticket_numbers"]
    assert mine["number"] in seen and foreign["number"] not in seen
    every = w.c.get(f"{API}/tickets/intake/drafts/{did}", headers=w.h("joni")).json()["duplicates"]["ticket_numbers"]
    assert {mine["number"], foreign["number"]} <= set(every)


# ---------------------------------------------------------------- known numbers only (owner 146) + the unlisted reply (owner 267)

def test_a_known_number_opens_a_draft_with_a_suggestion_and_nothing_else(w):
    turn_on(w)
    assert add_known(w).status_code == 201
    reason, did = accept(w, PHONE, SECRET_WORDS)
    assert reason == "intake_draft" and did
    d = w.c.get(f"{API}/tickets/intake/drafts/{did}", headers=w.h("joni")).json()
    assert d["state"] == "open" and d["requester"]["name"] == "דנה כהן" and d["requester"]["phone_masked"] == "•••• 2233"
    assert PHONE not in json.dumps(d) and d["text"] == SECRET_WORDS
    assert d["suggestion"]["urgency"]["value"] == "high"
    assert "קומה 3" in d["suggestion"]["place"]["text"]
    assert rows(w, "SELECT COUNT(*) AS n FROM tickets")[0]["n"] == 0, "a draft is never a ticket"
    assert rows(w, "SELECT COUNT(*) AS n FROM ticket_outbox WHERE purpose = 'intake_reply'")[0]["n"] == 0, "nothing is sent before approval"


def test_an_unlisted_number_gets_one_fixed_reply_per_day_and_no_draft(w):
    turn_on(w)
    assert accept(w, OTHER, SECRET_WORDS) == ("intake_unlisted", None)
    assert accept(w, OTHER, "שוב", NOW + dt.timedelta(minutes=5)) == ("intake_unlisted", None)
    assert rows(w, "SELECT COUNT(*) AS n FROM ticket_intake_drafts")[0]["n"] == 0
    out = rows(w, "SELECT purpose, recipient_kind, template_id, contact_id FROM ticket_outbox WHERE purpose = 'intake_reply'")
    assert len(out) == 1 and out[0]["template_id"] == "starter:intake_unlisted" and out[0]["recipient_kind"] == "test" and out[0]["contact_id"] is None
    att = rows(w, "SELECT attempts, last4, replied FROM ticket_intake_unlisted")[0]
    assert (att["attempts"], att["last4"], att["replied"]) == (2, "8877", 1)


def test_the_unlisted_reply_can_be_switched_off(w):
    turn_on(w, unlisted_reply=False)
    accept(w, OTHER, "שלום")
    assert rows(w, "SELECT COUNT(*) AS n FROM ticket_outbox WHERE purpose = 'intake_reply'")[0]["n"] == 0
    assert rows(w, "SELECT attempts FROM ticket_intake_unlisted")[0]["attempts"] == 1


def test_the_number_is_not_stored_in_the_outbox_or_the_envelope_text(w):
    turn_on(w)
    accept(w, OTHER, "שלום")
    dump = json.dumps(rows(w, "SELECT * FROM ticket_outbox"), default=str)
    assert OTHER not in dump


def test_the_daily_summary_counts_yesterday_without_numbers(w):
    turn_on(w)
    accept(w, OTHER, "שלום", NOW)
    accept(w, "972507776655", "שלום", NOW)
    with db(w).connection() as conn:
        assert intake.daily_summary(conn, NOW) == 0  # today's attempts are not yet summarised
        assert intake.daily_summary(conn, NOW + dt.timedelta(days=1)) == 1
        assert intake.daily_summary(conn, NOW + dt.timedelta(days=1)) == 0, "once a day"


# ---------------------------------------------------------------- coalescing, caps, blocks

def test_messages_inside_the_window_join_one_draft(w):
    turn_on(w)
    add_known(w)
    first = accept(w, PHONE, "המזגן לא מקרר")[1]
    reason, again = accept(w, PHONE, "בחדר 204", NOW + dt.timedelta(minutes=3))
    assert reason == "intake_coalesced" and again == first
    d = w.c.get(f"{API}/tickets/intake/drafts/{first}", headers=w.h("joni")).json()
    assert d["message_count"] == 2 and "204" in d["text"] and d["suggestion"]["place"]["text"] == "בחדר 204"
    assert rows(w, "SELECT COUNT(*) AS n FROM ticket_intake_drafts")[0]["n"] == 1


def test_the_per_sender_daily_cap_refuses_silently(w):
    turn_on(w, sender_per_day=2, coalesce_min=1)
    add_known(w)
    assert accept(w, PHONE, "תקלה אחת", NOW)[0] == "intake_draft"
    assert accept(w, PHONE, "תקלה שתיים", NOW + dt.timedelta(minutes=5))[0] == "intake_draft"
    assert accept(w, PHONE, "תקלה שלוש", NOW + dt.timedelta(minutes=10)) == ("intake_cap", None)
    assert rows(w, "SELECT COUNT(*) AS n FROM ticket_intake_drafts")[0]["n"] == 2


def test_the_queue_cap_never_drops_an_older_draft(w):
    turn_on(w, open_max=50, sender_per_day=20, sender_per_week=50, installation_per_hour=200, coalesce_min=1)
    phones = [f"05011122{n:02d}" for n in range(10, 15)]  # five listed numbers, ten drafts each (the per-sender cap is 20 a day)
    for i, p in enumerate(phones):
        assert add_known(w, phone=p, name=f"דייר {i}").status_code == 201
    for i in range(50):
        digits = "972" + phones[i % 5][1:]
        assert accept(w, digits, f"תקלה {i}", NOW + dt.timedelta(minutes=2 * i))[0] == "intake_draft", i
    assert accept(w, "972" + phones[0][1:], "עוד", NOW + dt.timedelta(minutes=200))[0] == "intake_cap"
    assert rows(w, "SELECT COUNT(*) AS n FROM ticket_intake_drafts WHERE state = 'open'")[0]["n"] == 50


# ---------------------------------------------------------------- approval

def test_approval_creates_one_request_origin_inbound_flagged_for_review_and_replies_with_the_number(w):
    turn_on(w)
    add_known(w)
    did = accept(w, PHONE, SECRET_WORDS)[1]
    d = w.c.get(f"{API}/tickets/intake/drafts/{did}", headers=w.h("joni")).json()
    r = w.c.post(f"{API}/tickets/intake/drafts/{did}/approve", json={"revision": d["revision"]}, headers=w.h("joni"))
    assert r.status_code == 200, r.text
    ticket = rows(w, "SELECT * FROM tickets WHERE id = ?", r.json()["ticket_id"])[0]
    assert ticket["origin"] == "inbound" and ticket["department_id"] == MAINT and ticket["status"] == "new"
    assert ticket["description"] == SECRET_WORDS and "קומה 3" in ticket["place_text"]
    notes = rows(w, "SELECT body, data_json FROM ticket_events WHERE ticket_id = ? AND kind = 'note'", ticket["id"])
    assert any(json.loads(n["data_json"]).get("needs_review") for n in notes)
    assert rows(w, "SELECT state, ticket_id FROM ticket_intake_drafts")[0] == {"state": "approved", "ticket_id": ticket["id"]}
    out = rows(w, "SELECT template_id, params_json FROM ticket_outbox WHERE purpose = 'intake_reply'")
    assert len(out) == 1 and out[0]["template_id"].startswith("starter:intake_approved") and str(ticket["number"]) in out[0]["params_json"]
    assert not rows(w, "SELECT 1 FROM ticket_assignments"), "no automatic assignment or dispatch"
    assert len(rows(w, "SELECT field FROM ticket_intake_feedback")) == 4
    # a second approval of the same draft is the revision conflict
    assert w.c.post(f"{API}/tickets/intake/drafts/{did}/approve", json={"revision": d["revision"]}, headers=w.h("joni")).status_code == 409


def test_the_approval_reply_can_be_switched_off(w):
    turn_on(w, approval_reply=False)
    add_known(w)
    did = accept(w, PHONE, "המזגן לא מקרר")[1]
    rev = w.c.get(f"{API}/tickets/intake/drafts/{did}", headers=w.h("joni")).json()["revision"]
    assert w.c.post(f"{API}/tickets/intake/drafts/{did}/approve", json={"revision": rev}, headers=w.h("joni")).json()["reply_queued"] is False


def test_an_edit_wins_over_the_suggestion_and_bad_ids_are_refused(w):
    turn_on(w)
    add_known(w)
    did = accept(w, PHONE, "המזגן לא מקרר")[1]
    d = w.c.get(f"{API}/tickets/intake/drafts/{did}", headers=w.h("joni")).json()
    bad = w.c.put(f"{API}/tickets/intake/drafts/{did}", json={"revision": d["revision"], "values": {"category_id": "nope"}}, headers=w.h("joni"))
    assert bad.status_code == 422
    ok = w.c.put(f"{API}/tickets/intake/drafts/{did}", json={"revision": d["revision"], "values": {"title": "תיקון מזגן", "priority_key": "high"}}, headers=w.h("joni"))
    assert ok.status_code == 200
    stale = w.c.put(f"{API}/tickets/intake/drafts/{did}", json={"revision": d["revision"], "values": {"title": "x"}}, headers=w.h("joni"))
    assert stale.status_code == 409
    r = w.c.post(f"{API}/tickets/intake/drafts/{did}/approve", json={"revision": ok.json()["revision"]}, headers=w.h("joni"))
    t = rows(w, "SELECT title FROM tickets WHERE id = ?", r.json()["ticket_id"])[0]
    assert t["title"] == "תיקון מזגן"


def test_an_approver_without_create_where_the_ticket_lies_is_refused_and_the_draft_stays_open(w):
    from conftest import bind

    turn_on(w)
    add_known(w)
    did = accept(w, PHONE, "המזגן לא מקרר")[1]
    bind(w.c, w.settings, "vic", "tickets_intake", "installation", "*")  # may handle drafts, but holds no tickets.create
    rev = w.c.get(f"{API}/tickets/intake/drafts/{did}", headers=w.h("vic")).json()["revision"]
    r = w.c.post(f"{API}/tickets/intake/drafts/{did}/approve", json={"revision": rev}, headers=w.h("vic"))
    assert r.status_code == 403
    assert rows(w, "SELECT state FROM ticket_intake_drafts")[0]["state"] == "open"
    assert rows(w, "SELECT COUNT(*) AS n FROM tickets")[0]["n"] == 0


# ---------------------------------------------------------------- merge and reject

def test_merge_adds_an_internal_note_to_a_request_the_handler_manages(w):
    turn_on(w)
    add_known(w)
    t = w.create("mona", "מזגן לא מקרר")
    did = accept(w, PHONE, "עדיין חם")[1]
    rev = w.c.get(f"{API}/tickets/intake/drafts/{did}", headers=w.h("mona")).json()["revision"]
    r = w.c.post(f"{API}/tickets/intake/drafts/{did}/merge", json={"revision": rev, "ticket_id": t["id"]}, headers=w.h("mona"))
    assert r.status_code == 200, r.text
    ev = rows(w, "SELECT body, via, visible_external FROM ticket_events WHERE ticket_id = ? AND via = 'whatsapp'", t["id"])
    assert ev == [{"body": "עדיין חם", "via": "whatsapp", "visible_external": 0}]
    assert rows(w, "SELECT state FROM ticket_intake_drafts")[0]["state"] == "merged"


def test_merge_by_the_number_a_person_reads_and_an_invisible_one_is_the_same_404(w):
    turn_on(w)
    add_known(w)
    t = w.create("mona", "מזגן לא מקרר")
    did = accept(w, PHONE, "עדיין חם")[1]
    rev = w.c.get(f"{API}/tickets/intake/drafts/{did}", headers=w.h("mona")).json()["revision"]
    missing = w.c.post(f"{API}/tickets/intake/drafts/{did}/merge", json={"revision": rev, "number": 999999}, headers=w.h("mona"))
    assert missing.status_code == 404
    both = w.c.post(f"{API}/tickets/intake/drafts/{did}/merge", json={"revision": rev, "number": 1, "ticket_id": t["id"]}, headers=w.h("mona"))
    assert both.status_code == 422
    ok = w.c.post(f"{API}/tickets/intake/drafts/{did}/merge", json={"revision": rev, "number": t["number"]}, headers=w.h("mona"))
    assert ok.status_code == 200 and ok.json() == {"ticket_id": t["id"]}


def test_reject_with_a_block_stops_later_messages(w):
    turn_on(w)
    add_known(w)
    did = accept(w, PHONE, "ספאם")[1]
    rev = w.c.get(f"{API}/tickets/intake/drafts/{did}", headers=w.h("joni")).json()["revision"]
    r = w.c.post(f"{API}/tickets/intake/drafts/{did}/reject", json={"revision": rev, "reason": "spam", "block": True}, headers=w.h("joni"))
    assert r.json() == {"ok": True, "blocked": True}
    assert accept(w, PHONE, "עוד ספאם", NOW + dt.timedelta(hours=1)) == ("intake_blocked", None)
    # reject() stamps the block from the wall clock (now + block_days), not from the fixed NOW of these messages: "a month later" is
    # counted from the later of the two, or the test turns red once the real date passes NOW (it did on 2026-10-26)
    after = max(NOW, dt.datetime.now(UTC)) + dt.timedelta(days=31)
    assert accept(w, PHONE, "אחרי חודש", after)[0] == "intake_draft"
    assert w.c.post(f"{API}/tickets/intake/drafts/{did}/reject", json={"revision": rev, "reason": "bogus"}, headers=w.h("joni")).status_code == 422


# ---------------------------------------------------------------- the managed list

def test_the_list_validates_masks_and_refuses_duplicates(w):
    turn_on(w)
    assert add_known(w, phone="12").status_code == 422
    r = add_known(w)
    assert r.status_code == 201 and r.json()["phone_masked"] == "•••• 2233" and "972" not in json.dumps(r.json())
    assert add_known(w, phone="+972 50-111-2233", name="אחר").status_code == 409
    kid, rev = r.json()["id"], r.json()["revision"]
    assert w.c.delete(f"{API}/tickets/intake/known/{kid}?revision={rev + 1}", headers=w.h("joni")).status_code == 409
    assert w.c.delete(f"{API}/tickets/intake/known/{kid}?revision={rev}", headers=w.h("joni")).status_code == 200
    assert accept(w, PHONE, "המזגן")[0] == "intake_unlisted", "a removed number is unlisted again"


# ---------------------------------------------------------------- the lexicon is editable data

def test_a_configurers_synonym_and_domain_mapping_change_the_suggestion(w):
    turn_on(w)
    add_known(w)
    cat = w.c.post(f"{API}/tickets/admin/departments/{MAINT}/categories", json={"name": "מעליות"}, headers=w.h("joni"))
    assert cat.status_code == 201, cat.text
    cid = next(c["id"] for c in cat.json()["categories"] if c["name"] == "מעליות")  # the answer is the department with its categories
    before = w.c.get(f"{API}/tickets/intake/drafts/{accept(w, PHONE, 'הליפט תקוע')[1]}", headers=w.h("joni")).json()
    assert before["suggestion"]["category"]["value"] is None, "an unmapped seed domain suggests nothing"
    assert w.c.post(f"{API}/tickets/intake/lexicon", json={"kind": "domain_map", "phrase": "elevator", "target_id": cid}, headers=w.h("joni")).status_code == 201
    assert w.c.post(f"{API}/tickets/intake/lexicon", json={"kind": "domain_map", "phrase": "elevator", "target_id": cid}, headers=w.h("joni")).status_code == 409
    after = w.c.get(f"{API}/tickets/intake/drafts/{accept(w, PHONE, 'הליפט תקוע', NOW + dt.timedelta(hours=1))[1]}", headers=w.h("joni")).json()
    assert after["suggestion"]["category"]["value"] == cid and after["suggestion"]["department_id"] == MAINT
    assert w.c.get(f"{API}/tickets/intake/lexicon", headers=w.h("mona")).status_code == 403


# ---------------------------------------------------------------- retention and privacy

def test_undecided_drafts_expire_and_decided_text_is_purged(w):
    turn_on(w, draft_ttl_days=1, rejected_keep_days=1)
    add_known(w)
    did = accept(w, PHONE, "המזגן לא מקרר", NOW)[1]
    with db(w).connection() as conn:
        intake.janitor(conn, NOW + dt.timedelta(days=2))
        r = dict(conn.execute("SELECT state, text FROM ticket_intake_drafts WHERE id = ?", (did,)).fetchone())
        assert r["state"] == "expired" and r["text"] is not None
        intake.janitor(conn, NOW + dt.timedelta(days=4))
        assert conn.execute("SELECT text FROM ticket_intake_drafts WHERE id = ?", (did,)).fetchone()["text"] is None


def test_no_audit_row_or_notification_carries_the_text_or_a_number(w):
    turn_on(w)
    add_known(w)
    did = accept(w, PHONE, SECRET_WORDS)[1]
    rev = w.c.get(f"{API}/tickets/intake/drafts/{did}", headers=w.h("joni")).json()["revision"]
    w.c.put(f"{API}/tickets/intake/drafts/{did}", json={"revision": rev, "values": {"title": "כותרת"}}, headers=w.h("joni"))
    rev = w.c.get(f"{API}/tickets/intake/drafts/{did}", headers=w.h("joni")).json()["revision"]
    w.c.post(f"{API}/tickets/intake/drafts/{did}/approve", json={"revision": rev}, headers=w.h("joni"))
    audits = json.dumps(rows(w, "SELECT action, details_json FROM audit_log WHERE action LIKE 'ticket.intake%'"), ensure_ascii=False)
    assert "ticket.intake.approve" in audits and "ticket.intake.known.add" in audits
    for secret in (SECRET_WORDS, "מעלית בבניין", PHONE, "0501112233", "1112233"):
        assert secret not in audits, secret
