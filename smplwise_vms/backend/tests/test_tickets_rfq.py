"""TKRFQ1 - requests for quotation, stage C1, over the REAL store (docs/tickets/RFQ_BACKEND_CONTRACT.md; RFQ_SPEC_DRAFT.md section 9,
owner decisions 16.10): migration 0089 (with the outbox rebuild), the visibility rule and the permission matrix, cross-request and
cross-vendor isolation, idempotency, the state machine's refusals, NO automatic message on award / close / not_awarded, the single
approval and the optional second approval, money through money.py, the vendor links (token domain, contact change, key rotation),
retention and full deletion. Every name and number here is invented (the 050-000-xxxx block, example.test hosts)."""
from __future__ import annotations

import datetime as dt
import json
import re
import shutil
from pathlib import Path

import pytest
from conftest import bind

from smplwise.db import MIGRATIONS_DIR
from smplwise.services.tickets import links, rfq as rfq_mod, rfq_links, store_rfq
from smplwise.services.tickets.keyring import KEYS
from tickets_s4_world import API, build_s4, crid

SMPLWISE = Path(__file__).resolve().parents[1] / "smplwise"
QUOTE = [{"kind": "labor", "hours": "2", "rate": "150"}, {"kind": "parts", "description": "מדחס", "quantity": "1", "unit_price": "800"}]
CHEAP = [{"kind": "labor", "hours": "1", "rate": "100"}, {"kind": "parts", "description": "מסנן", "quantity": "1", "unit_price": "500"}]


def _at(days: float = 0, hours: float = 0) -> str:
    return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=days, hours=hours)).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


@pytest.fixture()
def s4(settings, monkeypatch):
    world = build_s4(settings, monkeypatch)
    bind(world.c, settings, "mona", "tickets_external", "installation", "*")  # the maintenance manager may send outside
    return world


def add_vendor(s4, name: str, phone: str, **extra):
    r = s4.add_contact(kind="vendor", display_name=name, phone=phone, **extra)
    assert r.status_code == 201, r.text
    return r.json()


def new_rfq(s4, user: str = "mona", vendors: list[str] | None = None, **body):
    payload = {"department_id": "dept-maintenance", "title": "החלפת מזגן בחדר הישיבות", "description": "היחידה דולפת",
               "due_at": _at(days=3), "work_from": _at(days=5), "work_to": _at(days=10),
               "vendors": [{"contact_id": c} for c in (vendors or [])], "client_request_id": crid(), **body}
    return s4.c.post(f"{API}/tickets/rfqs", json=payload, headers=s4.h(user))


def make(s4, user: str = "mona", vendors: list[str] | None = None, **body) -> dict:
    r = new_rfq(s4, user, vendors if vendors is not None else [s4.vendor["id"], s4.contact["id"]], **body)
    assert r.status_code == 201, r.text
    return r.json()


def get(s4, rid: str, user: str = "joni"):
    return s4.c.get(f"{API}/tickets/rfqs/{rid}", headers=s4.h(user))


def detail(s4, rid: str, user: str = "joni") -> dict:
    r = get(s4, rid, user)
    assert r.status_code == 200, r.text
    return r.json()


def send(s4, rid: str, user: str = "mona", channel: str = "manual", **extra):
    return s4.c.post(f"{API}/tickets/rfqs/{rid}/send", json={"revision": detail(s4, rid)["revision"], "channel": channel,
                                                              "client_request_id": crid(), **extra}, headers=s4.h(user))


def sent_rfq(s4, **body) -> dict:
    d = make(s4, **body)
    r = send(s4, d["id"])
    assert r.status_code == 200, r.text
    return r.json()


def vid(d: dict, contact_id: str) -> str:
    return next(v["id"] for v in d["vendors"] if v["contact"]["id"] == contact_id)


def on_behalf(s4, rid: str, vendor_id: str, user: str = "joni", lines=None, **body):
    return s4.c.post(f"{API}/tickets/rfqs/{rid}/vendors/{vendor_id}/quotes", json={"lines": lines or QUOTE, **body}, headers=s4.h(user))


def quoted(s4, rid: str, vendor_id: str, user: str = "joni", lines=None, **body) -> dict:
    r = on_behalf(s4, rid, vendor_id, user, lines, **body)
    assert r.status_code == 201, r.text
    return r.json()


def compare(s4, rid: str, user: str = "joni") -> dict:
    r = s4.c.get(f"{API}/tickets/rfqs/{rid}/comparison", headers=s4.h(user))
    assert r.status_code == 200, r.text
    return r.json()


def award(s4, rid: str, quote: dict, user: str = "kim", **body):
    return s4.c.post(f"{API}/tickets/rfqs/{rid}/awards", json={"quote_id": quote["quote_id"], "revision": quote["revision"], **body},
                     headers=s4.h(user))


def quote_row(cmp: dict, vendor_id: str) -> dict:
    return next(q for q in cmp["quotes"] if q["vendor_id"] == vendor_id)


def outbox_count(s4) -> int:
    with s4.db.connection(mode="read") as conn:
        return int(conn.execute("SELECT COUNT(*) FROM ticket_outbox").fetchone()[0])


def whatsapp_on(s4) -> None:
    rev = s4.c.get(f"{API}/tickets/channel").json()["revision"]
    assert s4.c.put(f"{API}/tickets/channel", json={"revision": rev, "whatsapp": {"enabled": True}}).status_code == 200


def kim(s4, settings, *names: str) -> None:
    """More approvers: system administrators (tickets.costs + view, all departments - the top of the chain)."""
    for n in names or ("kim",):
        bind(s4.c, settings, n, "system_admin", "installation", "*")


# ---------------------------------------------------------------- the migration

def test_0089_creates_the_rfq_tables_and_rebuilds_only_the_outbox(s4):
    sql = (MIGRATIONS_DIR / "0089_ticket_rfq.sql").read_text(encoding="utf-8")
    assert "CR-038" in sql.splitlines()[0] and "Final number 0089" in sql  # integ/263 renumbered (was PROVISIONAL NUMBER)
    assert re.findall(r"^DROP TABLE\s+(\w+)", sql, re.I | re.M) == ["ticket_outbox"], "one rebuild: the outbox (its purpose CHECK)"
    assert not re.search(r"^\s*(BEGIN|COMMIT)\b", sql, re.M | re.I)
    with s4.db.connection(mode="read") as conn:
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        assert {"ticket_rfqs", "ticket_rfq_vendors", "ticket_rfq_links", "ticket_rfq_link_redeems", "ticket_rfq_awards", "ticket_rfq_messages",
                "ticket_rfq_events"} <= tables
        assert "ticket_outbox_new" not in tables
        cols = [r[1] for r in conn.execute("PRAGMA table_info(ticket_outbox)")]
        assert cols[-2:] == ["link_generation", "rfq_id"]
        idx = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'ticket_outbox'")}
        assert {"idx_ticket_outbox_queue", "idx_ticket_outbox_ticket", "idx_ticket_outbox_contact_sent", "idx_ticket_outbox_provider",
                "idx_ticket_outbox_channel_sent", "idx_ticket_outbox_account_sent", "idx_ticket_outbox_updated", "idx_ticket_outbox_idempotency",
                "idx_ticket_outbox_rfq"} <= idx
        assert "rfq_second_approval_minor" in {r[1] for r in conn.execute("PRAGMA table_info(ticket_departments)")}
        assert conn.execute("SELECT value FROM ticket_sequence WHERE name = 'rfq'").fetchone()[0] == 0
        assert conn.execute("PRAGMA foreign_key_check").fetchall() == []


def test_0089_keeps_every_outbox_row_and_widens_only_the_purposes(settings, tmp_path, monkeypatch):
    from smplwise import db as dbmod

    real = dbmod.MIGRATIONS_DIR
    older = tmp_path / "older"
    older.mkdir()
    for f in real.glob("*.sql"):
        if int(f.name.split("_", 1)[0]) < 89:
            shutil.copy(f, older / f.name)
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", older)
    database = dbmod.Database(settings.db_path)
    database.migrate()
    with database.connection() as conn:
        conn.execute("INSERT INTO ticket_outbox(id, recipient_kind, contact_id, channel, purpose, use_key, params_json, state, not_before, "
                     "idempotency_key, link_generation, created_at, updated_at) VALUES ('o1', 'contact', 'c1', 'whatsapp', 'assign', "
                     "'tickets.messages', '{\"number\":\"1\"}', 'sent', 't', 'k1', 2, 't', 't')")
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", real)
    applied = dbmod.Database(settings.db_path).migrate()
    assert applied[0] == 89 and applied == sorted(n for n in (int(f.name[:4]) for f in dbmod.MIGRATIONS_DIR.glob("*.sql")) if n >= 89)  # 0090..0093, 0095 follow in the real set (none rebuilds ticket_outbox again)
    with database.connection() as conn:
        row = dict(conn.execute("SELECT * FROM ticket_outbox WHERE id = 'o1'").fetchone())
        assert (row["purpose"], row["state"], row["idempotency_key"], row["link_generation"], row["rfq_id"]) == ("assign", "sent", "k1", 2, None)
        conn.execute("INSERT INTO ticket_outbox(id, recipient_kind, contact_id, channel, purpose, use_key, state, not_before, created_at, updated_at, "
                     "rfq_id) VALUES ('o2', 'contact', 'c1', 'email', 'rfq_invite', 'email', 'queued', 't', 't', 't', 'r1')")
        import sqlite3

        with pytest.raises(sqlite3.IntegrityError):
            conn.execute("INSERT INTO ticket_outbox(id, recipient_kind, contact_id, channel, purpose, use_key, state, not_before, created_at, "
                         "updated_at) VALUES ('o3', 'contact', 'c1', 'email', 'rfq_bogus', 'email', 'queued', 't', 't', 't')")
        with pytest.raises(sqlite3.IntegrityError):  # the idempotency index survived the rebuild
            conn.execute("INSERT INTO ticket_outbox(id, recipient_kind, contact_id, channel, purpose, use_key, state, not_before, created_at, "
                         "updated_at, idempotency_key) VALUES ('o4', 'contact', 'c1', 'email', 'assign', 'email', 'queued', 't', 't', 't', 'k1')")
        # integration 2.6.3: TKNOTIFOTP's purpose is folded into this single rebuild (no second ticket_outbox rebuild exists)
        conn.execute("INSERT INTO ticket_outbox(id, recipient_kind, contact_id, channel, purpose, use_key, state, not_before, created_at, updated_at, "
                     "code_id) VALUES ('o5', 'contact', 'c1', 'whatsapp', 'phone_verify', 'tickets.codes', 'queued', 't', 't', 't', 'pv1')")
        assert conn.execute("SELECT count(*) FROM ticket_outbox").fetchone()[0] == 3
    rebuilds = [f.name for f in real.glob("*.sql") if "CREATE TABLE ticket_outbox_new" in f.read_text(encoding="utf-8") and int(f.name[:4]) > 86]
    assert rebuilds == ["0089_ticket_rfq.sql"], rebuilds


# ---------------------------------------------------------------- visibility and the permission matrix

def test_the_module_switch_hides_every_rfq_route(s4):
    d = make(s4)
    assert s4.c.patch(f"{API}/settings", json={"tickets.enabled": "false"}).status_code == 200
    for path in ("/tickets/rfqs", f"/tickets/rfqs/{d['id']}", "/tickets/rfqs/meta", f"/tickets/rfqs/{d['id']}/comparison"):
        r = s4.c.get(f"{API}{path}")
        assert r.status_code == 404 and r.json()["code"] == "feature_disabled", path


def test_who_may_create_a_request(s4):
    assert new_rfq(s4, "tom").status_code == 403, "a member without tickets.external"
    r = new_rfq(s4, "nora")
    assert r.status_code == 403 and r.json()["details"]["reason"] == "external_permission_missing"
    assert new_rfq(s4, "vic").status_code == 403, "no ticket permission at all"
    assert new_rfq(s4, "mona", vendors=[s4.vendor["id"]]).status_code == 201
    with s4.db.connection(mode="read") as conn:
        denied = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'ticket.rfq.create' AND decision = 'denied'").fetchone()[0]
    assert denied >= 2, "role / membership refusals are audited"


def test_visibility_follows_the_department_and_is_the_uniform_404(s4):
    d = make(s4)
    for user in ("joni", "mona", "tom", "alda"):  # admin, the creator (manager), a member, all departments
        assert get(s4, d["id"], user).status_code == 200, user
    for user in ("cleo", "nora", "vic", "dina"):  # another department's manager, a non-member, no permission, a deny of tickets.view
        r = get(s4, d["id"], user)
        assert r.status_code in (403, 404), user
        if r.status_code == 404:
            assert r.json()["code"] in ("rfq_not_found", "feature_disabled"), user
    assert get(s4, "no-such-rfq", "joni").json()["code"] == "rfq_not_found"
    assert [i["id"] for i in s4.c.get(f"{API}/tickets/rfqs", headers=s4.h("cleo")).json()["items"]] == []
    assert [i["id"] for i in s4.c.get(f"{API}/tickets/rfqs", headers=s4.h("tom")).json()["items"]] == [d["id"]]


def test_amounts_need_tickets_costs_view(s4):
    d = sent_rfq(s4)
    v = vid(d, s4.vendor["id"])
    quoted(s4, d["id"], v)
    mine = detail(s4, d["id"], "mona")  # the manager without tickets.costs.view
    assert mine["kpis"]["lowest_total_minor"] is None and set(next(x for x in mine["vendors"] if x["id"] == v)["quote"]) == {"id", "version", "state", "created_at"}
    r = s4.c.get(f"{API}/tickets/rfqs/{d['id']}/comparison", headers=s4.h("mona"))
    assert r.status_code == 403 and r.json()["details"]["reason"] == "costs_permission_missing"
    assert detail(s4, d["id"])["kpis"]["lowest_total_minor"] == 129800


def test_managing_needs_the_manager_rule_and_tickets_external(s4):
    d = make(s4)
    for user in ("tom", "alda"):  # a member; all departments without tickets.manage / external
        r = send(s4, d["id"], user)
        assert r.status_code == 403, (user, r.text)
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/close", json={"revision": detail(s4, d["id"])["revision"]}, headers=s4.h("tom"))
    assert r.status_code == 403


def test_on_behalf_and_award_need_the_cost_permissions(s4, settings):
    kim(s4, settings)
    d = sent_rfq(s4)
    v = vid(d, s4.vendor["id"])
    r = on_behalf(s4, d["id"], v, user="mona")
    assert r.status_code == 403 and r.json()["details"]["reason"] == "costs_permission_missing"
    quoted(s4, d["id"], v)
    q = quote_row(compare(s4, d["id"]), v)
    r = award(s4, d["id"], q, user="mona")
    assert r.status_code == 403
    assert award(s4, d["id"], q, user="kim").status_code == 201


# ---------------------------------------------------------------- isolation

def test_a_vendor_or_quote_of_another_request_is_not_found(s4, settings):
    kim(s4, settings)
    a = sent_rfq(s4)
    b = sent_rfq(s4)
    va, vb = vid(a, s4.vendor["id"]), vid(b, s4.vendor["id"])
    assert va != vb
    r = on_behalf(s4, b["id"], va)
    assert r.status_code == 404 and r.json()["code"] == "vendor_not_found"
    quoted(s4, a["id"], va)
    qa = quote_row(compare(s4, a["id"]), va)
    r = award(s4, b["id"], qa)
    assert r.status_code == 404 and r.json()["code"] == "quote_not_found"
    r = s4.c.post(f"{API}/tickets/rfqs/{b['id']}/vendors/{vb}/quotes/{qa['quote_id']}/withdraw", json={"revision": qa["revision"]})
    assert r.status_code == 404 and r.json()["code"] == "quote_not_found"
    r = s4.c.get(f"{API}/tickets/rfqs/{b['id']}/vendors/{va}/messages")
    assert r.status_code == 404


def test_a_ticket_quote_is_never_an_rfq_quote_and_the_other_way_round(s4, settings):
    kim(s4, settings)
    d = sent_rfq(s4)
    v = vid(d, s4.vendor["id"])
    quoted(s4, d["id"], v)
    t, _token = s4.sent()
    r = s4.c.get(f"{API}/tickets/{t['id']}/quotes")
    assert r.status_code == 200 and r.json()["quotes"] == [], "an RFQ quote has no ticket"
    r = s4.c.post(f"{API}/tickets/{t['id']}/quotes", json={"lines": QUOTE})
    assert r.status_code == 201
    ticket_quote = r.json()["quotes"][-1]
    r = award(s4, d["id"], {"quote_id": ticket_quote["id"], "revision": ticket_quote["revision"]})
    assert r.status_code == 404 and r.json()["code"] == "quote_not_found"


def test_other_vendors_never_see_each_other_through_the_detail_of_a_limited_viewer(s4):
    """The vendor page is stage C2; here: the manager's detail names each vendor's own quote only under its own row."""
    d = sent_rfq(s4)
    v1, v2 = vid(d, s4.vendor["id"]), vid(d, s4.contact["id"])
    quoted(s4, d["id"], v1)
    full = detail(s4, d["id"])
    rows = {x["id"]: x for x in full["vendors"]}
    assert rows[v1]["quote"] is not None and rows[v2]["quote"] is None


# ---------------------------------------------------------------- idempotency

def test_create_and_send_replay_the_first_answer(s4):
    crid_ = crid()
    payload = {"department_id": "dept-maintenance", "title": "החלפת מזגן", "due_at": _at(days=3), "vendors": [{"contact_id": s4.vendor["id"]}],
               "client_request_id": crid_}
    r1 = s4.c.post(f"{API}/tickets/rfqs", json=payload, headers=s4.h("mona"))
    r2 = s4.c.post(f"{API}/tickets/rfqs", json=payload, headers=s4.h("mona"))
    assert r1.status_code == r2.status_code == 201 and r1.json()["id"] == r2.json()["id"]
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_rfqs").fetchone()[0] == 1
    rid = r1.json()["id"]
    body = {"revision": r1.json()["revision"], "channel": "manual", "client_request_id": crid()}
    a = s4.c.post(f"{API}/tickets/rfqs/{rid}/send", json=body, headers=s4.h("mona"))
    b = s4.c.post(f"{API}/tickets/rfqs/{rid}/send", json=body, headers=s4.h("mona"))
    assert a.status_code == b.status_code == 200 and a.json()["sent"] == b.json()["sent"] == {"vendors": 1, "channels": {"manual": 1}}
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_rfq_events WHERE kind = 'sent'").fetchone()[0] == 1


def test_numbers_run_on_their_own_sequence(s4):
    a, b = make(s4), make(s4)
    assert (a["number"], b["number"]) == (1, 2) and a["ref"] == "RFQ-01"


# ---------------------------------------------------------------- the state machine's refusals

def test_illegal_moves_are_refused(s4, settings):
    kim(s4, settings)
    empty = make(s4, vendors=[])
    r = send(s4, empty["id"])
    assert r.status_code == 409 and r.json()["code"] == "rfq_no_vendors"
    d = make(s4)
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/close", json={"revision": d["revision"]})
    assert r.status_code == 409 and r.json()["code"] == "rfq_invalid_transition", "a draft is cancelled, never closed"
    r = s4.c.patch(f"{API}/tickets/rfqs/{d['id']}", json={"revision": d["revision"] + 5, "title": "x"}, headers=s4.h("mona"))
    assert r.status_code == 409 and r.json()["code"] == "rfq_stale"
    assert send(s4, d["id"]).status_code == 200
    r = s4.c.patch(f"{API}/tickets/rfqs/{d['id']}", json={"revision": detail(s4, d["id"])["revision"], "title": "כותרת אחרת"}, headers=s4.h("mona"))
    assert r.status_code == 409 and r.json()["code"] == "rfq_field_locked", "vendors already saw the title"
    r = s4.c.patch(f"{API}/tickets/rfqs/{d['id']}", json={"revision": detail(s4, d["id"])["revision"], "due_at": _at(days=1)}, headers=s4.h("mona"))
    assert r.status_code == 422, "after the send the deadline only moves later"
    v = vid(d, s4.vendor["id"])
    quoted(s4, d["id"], v)
    q = quote_row(compare(s4, d["id"]), v)
    assert award(s4, d["id"], q).status_code == 201
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/cancel", json={"revision": detail(s4, d["id"])["revision"]}, headers=s4.h("mona"))
    assert r.status_code == 409 and r.json()["code"] == "rfq_has_award"
    r = award(s4, d["id"], q)
    assert r.status_code == 409 and r.json()["code"] in ("quote_stale", "quote_not_open"), "a quote is awarded once"


def test_a_deadline_in_the_past_cannot_be_sent(s4):
    d = make(s4)
    with s4.db.connection() as conn:
        conn.execute("UPDATE ticket_rfqs SET due_at = ? WHERE id = ?", (_at(hours=-1), d["id"]))
    r = send(s4, d["id"])
    assert r.status_code == 409 and r.json()["code"] == "rfq_due_passed"


def test_the_deadline_passes_without_a_write_and_a_later_one_reopens(s4):
    d = sent_rfq(s4)
    with s4.db.connection() as conn:
        conn.execute("UPDATE ticket_rfqs SET due_at = ? WHERE id = ?", (_at(hours=-1), d["id"]))
    got = detail(s4, d["id"])
    assert got["state"] == "due_passed" and {v["state"] for v in got["vendors"]} == {"expired"}, "reads never show a stale state"
    with s4.db.connection() as conn:
        assert rfq_mod.tick(conn, dt.datetime.now(dt.timezone.utc)) == 1
        assert conn.execute("SELECT state FROM ticket_rfqs WHERE id = ?", (d["id"],)).fetchone()[0] == "due_passed"
    r = s4.c.patch(f"{API}/tickets/rfqs/{d['id']}", json={"revision": detail(s4, d["id"])["revision"], "due_at": _at(days=2)}, headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    assert r.json()["state"] == "sent" and {v["state"] for v in r.json()["vendors"]} == {"sent"}


def test_quote_versions_supersede_and_withdraw(s4):
    d = sent_rfq(s4)
    v = vid(d, s4.vendor["id"])
    quoted(s4, d["id"], v)
    quoted(s4, d["id"], v, lines=CHEAP)
    with s4.db.connection(mode="read") as conn:
        states = [(r["version"], r["state"]) for r in conn.execute("SELECT version, state FROM ticket_quotes WHERE rfq_vendor_id = ? ORDER BY version", (v,))]
    assert states == [(1, "superseded"), (2, "submitted")]
    q = quote_row(compare(s4, d["id"]), v)
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{v}/quotes/{q['quote_id']}/withdraw", json={"revision": q["revision"]})
    assert r.status_code == 200, r.text
    assert next(x for x in r.json()["vendors"] if x["id"] == v)["state"] == "withdrawn"
    assert compare(s4, d["id"])["quotes"] == []


def test_only_the_requests_line_kinds(s4):
    d = sent_rfq(s4)
    v = vid(d, s4.vendor["id"])
    r = on_behalf(s4, d["id"], v, lines=QUOTE + [{"kind": "travel", "amount": "50"}])
    assert r.status_code == 422 and r.json()["details"]["fields"][0] == {"field": "lines.2.kind", "code": "line_kind_not_allowed"}


def test_who_may_be_invited(s4):
    employee = s4.add_contact(kind="employee", display_name="עובד אחזקה", phone="050-000-0041")
    assert employee.status_code == 201, employee.text
    d = make(s4, vendors=[])
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors", json={"contact_id": employee.json()["id"], "revision": d["revision"]}, headers=s4.h("mona"))
    assert r.status_code == 409 and r.json()["code"] == "vendor_not_allowed" and r.json()["details"]["reason"] == "employee"
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors", json={"contact_id": s4.vendor["id"], "revision": d["revision"]}, headers=s4.h("mona"))
    assert r.status_code == 201
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors", json={"contact_id": s4.vendor["id"], "revision": r.json()["revision"]}, headers=s4.h("mona"))
    assert r.status_code == 409 and r.json()["code"] == "vendor_duplicate"


# ---------------------------------------------------------------- money (money.py) and the comparison

def test_money_is_computed_on_the_server_and_ranked_in_integers(s4):
    d = sent_rfq(s4)
    v1, v2 = vid(d, s4.vendor["id"]), vid(d, s4.contact["id"])
    quoted(s4, d["id"], v1, work_from=_at(days=6), work_to=_at(days=7))
    quoted(s4, d["id"], v2, lines=CHEAP, work_from=_at(days=8), work_to=_at(days=12))
    cmp = compare(s4, d["id"])
    q1, q2 = quote_row(cmp, v1), quote_row(cmp, v2)
    assert (q1["subtotal_minor"], q1["vat_minor"], q1["total_minor"]) == (110000, 19800, 129800)
    assert q1["by_kind"] == {"labor": 30000, "parts": 80000, "travel": 0, "other": 0}
    assert (q2["subtotal_minor"], q2["vat_minor"], q2["total_minor"]) == (60000, 10800, 70800)
    assert cmp["lowest_quote_id"] == q2["quote_id"] and cmp["earliest_quote_id"] == q1["quote_id"]
    assert q1["in_window"] is True and q2["in_window"] is False and cmp["filters"] == {"all": 2, "in_window": 1}


def test_a_partial_award_by_kind_recomputes_the_approved_amounts(s4, settings):
    kim(s4, settings)
    d = sent_rfq(s4)
    v = vid(d, s4.vendor["id"])
    quoted(s4, d["id"], v)
    q = quote_row(compare(s4, d["id"]), v)
    r = award(s4, d["id"], q, kinds=["parts"])
    assert r.status_code == 201, r.text
    a = r.json()["award"]
    assert a["state"] == "approved" and a["line_indexes"] == [1]
    assert (a["subtotal_minor"], a["vat_minor"], a["total_minor"]) == (80000, 14400, 94400)
    with s4.db.connection(mode="read") as conn:
        row = dict(conn.execute("SELECT * FROM ticket_quotes WHERE id = ?", (q["quote_id"],)).fetchone())
    assert (row["state"], row["approved_lines_json"], row["approved_total_minor"]) == ("partially_approved", "[1]", 94400)


# ---------------------------------------------------------------- the award: baseline, not_awarded, no message

def test_the_award_is_the_baseline_others_are_not_awarded_and_nothing_is_sent(s4, settings):
    kim(s4, settings)
    d = sent_rfq(s4)
    v1, v2 = vid(d, s4.vendor["id"]), vid(d, s4.contact["id"])
    quoted(s4, d["id"], v1)
    quoted(s4, d["id"], v2, lines=CHEAP)
    before = outbox_count(s4)
    q2 = quote_row(compare(s4, d["id"]), v2)
    r = award(s4, d["id"], q2)
    assert r.status_code == 201, r.text
    body = r.json()
    assert outbox_count(s4) == before, "an award never sends a message by itself (owner 15.10 evening)"
    draft = body["message_draft"]
    assert draft["send"]["source"] == {"kind": "award", "id": body["award"]["id"]} and "70" not in draft["text"] and draft["lang"] == "he"
    states = {v["id"]: v["state"] for v in body["rfq"]["vendors"]}
    assert body["rfq"]["state"] == "awarded" and states == {v1: "not_awarded", v2: "awarded"}
    with s4.db.connection(mode="read") as conn:
        q = {r["rfq_vendor_id"]: r["state"] for r in conn.execute("SELECT rfq_vendor_id, state FROM ticket_quotes WHERE rfq_vendor_id IS NOT NULL")}
        actions = [r[0] for r in conn.execute("SELECT action FROM ticket_quote_decisions ORDER BY at, rowid")]
    assert q == {v1: "not_awarded", v2: "approved"} and "not_awarded" in actions and "approve" in actions
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/close", json={"revision": body["rfq"]["revision"]}, headers=s4.h("mona"))
    assert r.status_code == 200 and r.json()["state"] == "closed"
    assert outbox_count(s4) == before, "closing never sends either"


def test_the_award_draft_is_sent_only_when_the_manager_writes_it(s4, settings):
    kim(s4, settings)
    d = sent_rfq(s4)
    v = vid(d, s4.vendor["id"])
    quoted(s4, d["id"], v)
    r = award(s4, d["id"], quote_row(compare(s4, d["id"]), v))
    draft = r.json()["message_draft"]
    msg = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{v}/messages", json={"text": draft["text"], "source": draft["send"]["source"]},
                    headers=s4.h("mona"))
    assert msg.status_code == 201, msg.text
    assert msg.json()["notified"] == {"queued": False, "channel": None}, "no vendor page in C1: stored in the thread, nothing queued"
    items = s4.c.get(f"{API}/tickets/rfqs/{d['id']}/vendors/{v}/messages").json()["items"]
    assert [i["source"] for i in items] == [draft["send"]["source"]]


# ---------------------------------------------------------------- single approval, optional second approval (owner 16.10, final)

def _threshold(s4, minor):
    r = s4.c.put(f"{API}/tickets/rfqs/departments/dept-maintenance", json={"second_approval_minor": minor})
    assert r.status_code == 200, r.text


def test_single_approval_is_final_without_a_threshold(s4, settings):
    kim(s4, settings)
    d = sent_rfq(s4)
    v = vid(d, s4.vendor["id"])
    quoted(s4, d["id"], v)
    r = award(s4, d["id"], quote_row(compare(s4, d["id"]), v))
    assert r.json()["award"]["state"] == "approved" and r.json()["award"]["second_required"] is False


def test_over_the_threshold_a_second_approver_above_the_requester_confirms(s4, settings):
    kim(s4, settings, "kim", "lea")
    _threshold(s4, 100000)
    d = sent_rfq(s4)  # requester: mona, a department manager (level 1)
    v = vid(d, s4.vendor["id"])
    quoted(s4, d["id"], v)  # entered on the vendor's behalf by joni
    before = outbox_count(s4)
    r = award(s4, d["id"], quote_row(compare(s4, d["id"]), v), user="kim")
    assert r.status_code == 201 and r.json()["award"]["state"] == "pending_second" and r.json()["message_draft"] is None
    a = r.json()["award"]
    assert next(x for x in r.json()["rfq"]["vendors"] if x["id"] == v)["state"] == "quoted", "the vendor sees nothing yet"
    for user, code in (("kim", "second_approver_required"), ("joni", "second_approver_required")):  # the first approver; the entrant
        r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/confirm", json={"revision": a["revision"]}, headers=s4.h(user))
        assert r.status_code == 409 and r.json()["code"] == code, user
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/confirm", json={"revision": a["revision"]}, headers=s4.h("mona"))
    assert r.status_code == 403, "the requester has no cost permission and is never asked twice"
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/close", json={"revision": detail(s4, d["id"])["revision"]}, headers=s4.h("mona"))
    assert r.status_code == 409 and r.json()["code"] == "award_pending"
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/confirm", json={"revision": a["revision"]}, headers=s4.h("lea"))
    assert r.status_code == 200, r.text
    assert r.json()["award"]["state"] == "approved" and r.json()["rfq"]["state"] == "awarded" and r.json()["message_draft"]
    assert outbox_count(s4) == before


def test_the_chain_ending_at_the_requester_makes_one_approval_final(s4, settings):
    kim(s4, settings)
    _threshold(s4, 100000)
    d = sent_rfq(s4, user="joni")  # the requester is a system administrator: nobody stands above
    v = vid(d, s4.vendor["id"])
    with s4.db.connection() as conn:  # the quote is entered by mona on the vendor's behalf (via the store; she has no cost permission)
        pass
    quoted(s4, d["id"], v, user="kim")
    r = award(s4, d["id"], quote_row(compare(s4, d["id"]), v), user="joni")  # the requester approves, above the threshold
    assert r.status_code == 201, r.text
    assert r.json()["award"]["state"] == "approved" and r.json()["award"]["second_required"] is False


def test_no_eligible_second_approver_means_the_first_approval_is_final(s4, settings):
    """mona (a department manager) asked; kim approves above the threshold; joni entered the quote and is excluded; alda stands above
    but holds no cost permission: nobody can give a second approval, so the system does not wait for one."""
    kim(s4, settings)
    _threshold(s4, 100000)
    d = sent_rfq(s4)
    v = vid(d, s4.vendor["id"])
    quoted(s4, d["id"], v)
    r = award(s4, d["id"], quote_row(compare(s4, d["id"]), v), user="kim")
    assert r.json()["award"]["state"] == "approved"


def test_below_the_threshold_one_approval_is_final(s4, settings):
    kim(s4, settings, "kim", "lea")
    _threshold(s4, 10_000_000)
    d = sent_rfq(s4)
    v = vid(d, s4.vendor["id"])
    quoted(s4, d["id"], v)
    assert award(s4, d["id"], quote_row(compare(s4, d["id"]), v)).json()["award"]["state"] == "approved"


def test_self_approval_of_an_on_behalf_quote_is_refused(s4):
    d = sent_rfq(s4)
    v = vid(d, s4.vendor["id"])
    quoted(s4, d["id"], v, user="joni")
    r = award(s4, d["id"], quote_row(compare(s4, d["id"]), v), user="joni")
    assert r.status_code == 409 and r.json()["code"] == "self_approval"


def test_the_threshold_route_needs_tickets_configure(s4):
    r = s4.c.put(f"{API}/tickets/rfqs/departments/dept-maintenance", json={"second_approval_minor": 5}, headers=s4.h("mona"))
    assert r.status_code == 403
    _threshold(s4, None)


# ---------------------------------------------------------------- messages: templates only, gated by the vendor page

def test_an_invitation_by_whatsapp_waits_for_the_vendor_page(s4):
    d = make(s4)
    r = send(s4, d["id"], channel="auto")
    assert r.status_code in (200, 409)
    if r.status_code == 409:
        assert r.json()["code"] == "rfq_vendor_page_unavailable"
    assert outbox_count(s4) == 0


def test_invitations_through_the_outbox_carry_no_link_text_or_amount(s4, monkeypatch):
    monkeypatch.setattr(rfq_mod, "VENDOR_PAGE", True)
    whatsapp_on(s4)
    d = make(s4)
    r = send(s4, d["id"], channel="auto")
    assert r.status_code == 200, r.text
    with s4.db.connection(mode="read") as conn:
        rows = [dict(x) for x in conn.execute("SELECT * FROM ticket_outbox WHERE rfq_id = ?", (d["id"],))]
        link_rows = [dict(x) for x in conn.execute("SELECT * FROM ticket_rfq_links WHERE rfq_id = ?", (d["id"],))]
    assert {x["purpose"] for x in rows} == {"rfq_invite"} and len(rows) == len(link_rows) == 2
    for x in rows:
        params = json.loads(x["params_json"])
        assert set(params) <= {"name", "number", "title", "place", "department", "organization", "due", "window", "files"}  # RFQATT: "files" = a count text, never a name
        assert x["ticket_id"] is None and x["link_id"] in {lr["id"] for lr in link_rows}
        token = rfq_links.token_of(next(lr for lr in link_rows if lr["id"] == x["link_id"]))
        assert token not in json.dumps(x), "the token is derived at send time, never stored"
    with s4.db.connection() as conn:  # the DbLinks port resolves an RFQ link like a ticket link
        from smplwise.services.tickets.messaging import RUNTIME

        url = RUNTIME.outbox.p.links.url(rows[0]["link_id"])
    assert url and url.startswith("https://t-demo.arx.example.test/support/#q."), "TKRFQVP: the TK255 prefix and the q. mark"
    r2 = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/remind", json={}, headers=s4.h("mona"))
    r3 = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/remind", json={}, headers=s4.h("mona"))
    assert r2.json()["reminded"]["queued"] == 2 and r3.status_code == 200
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_outbox WHERE purpose = 'rfq_reminder'").fetchone()[0] == 2, "one per vendor per hour"


def test_cancel_notifies_only_vendors_who_quoted_through_the_system(s4, monkeypatch):
    monkeypatch.setattr(rfq_mod, "VENDOR_PAGE", True)
    whatsapp_on(s4)
    d = make(s4)
    assert send(s4, d["id"], channel="auto").status_code == 200
    v = vid(d, s4.vendor["id"])
    quoted(s4, d["id"], v)
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/cancel", json={"revision": detail(s4, d["id"])["revision"], "reason": "התקציב בוטל"},
                  headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    assert r.json()["cancelled"] == {"notified": 1} and r.json()["state"] == "cancelled"
    with s4.db.connection(mode="read") as conn:
        rows = {(x["purpose"], x["state"]) for x in conn.execute("SELECT purpose, state FROM ticket_outbox WHERE rfq_id = ?", (d["id"],))}
        links_ = [dict(x) for x in conn.execute("SELECT grace_until, revoked_at FROM ticket_rfq_links WHERE rfq_id = ?", (d["id"],))]
    assert ("rfq_cancelled", "queued") in rows and ("rfq_invite", "cancelled") in rows, "unsent invitations never go out after a cancel"
    assert all(lr["grace_until"] and not lr["revoked_at"] for lr in links_), "read-only grace (24 h)"


# ---------------------------------------------------------------- vendor links

def test_an_rfq_token_is_never_a_ticket_token():
    key = b"k" * 32
    lid = links.new_link_id()
    assert links.derive_token(key, lid, 1, domain="rfq") != links.derive_token(key, lid, 1)
    with pytest.raises(ValueError):
        links.derive_token(key, lid, 1, domain="other")


def test_a_contact_change_and_a_key_rotation_revoke_rfq_links(s4, monkeypatch):
    monkeypatch.setattr(rfq_mod, "VENDOR_PAGE", True)
    whatsapp_on(s4)
    d = make(s4)
    assert send(s4, d["id"], channel="auto").status_code == 200
    r = s4.c.patch(f"{API}/tickets/contacts/{s4.vendor['id']}", json={"phone": "050-000-0099", "revision": s4.contact_rev(s4.vendor["id"])})
    assert r.status_code == 200, r.text
    with s4.db.connection(mode="read") as conn:
        reasons = {x["contact_id"]: x["revoked_reason"] for x in conn.execute("SELECT contact_id, revoked_reason FROM ticket_rfq_links")}
        assert store_rfq.link_of_vendor(conn, vid(d, s4.contact["id"]))["key_id"] in __import__("smplwise.services.tickets.store_links",
                                                                                                 fromlist=["x"]).key_ids_in_use(conn)
    assert reasons == {s4.vendor["id"]: "contact_changed", s4.contact["id"]: None}
    if KEYS.can_rotate():
        r = s4.c.post(f"{API}/tickets/key/rotate", json={"confirm": True})
        assert r.status_code == 200, r.text
        with s4.db.connection(mode="read") as conn:
            assert conn.execute("SELECT revoked_reason FROM ticket_rfq_links WHERE contact_id = ?", (s4.contact["id"],)).fetchone()[0] == "module_key"


# ---------------------------------------------------------------- audit, retention, deletion

def test_audit_rows_carry_ids_states_and_totals_never_a_text(s4, settings):
    kim(s4, settings)
    d = sent_rfq(s4, title="כותרת סודית מאוד")
    v = vid(d, s4.vendor["id"])
    quoted(s4, d["id"], v, note="הערה פנימית של הספק")
    award(s4, d["id"], quote_row(compare(s4, d["id"]), v))
    with s4.db.connection(mode="read") as conn:
        rows = [dict(r) for r in conn.execute("SELECT action, details_json FROM audit_log WHERE action LIKE 'ticket.rfq.%'")]
        events = [r[0] for r in conn.execute("SELECT data_json FROM ticket_rfq_events")]
    assert {r["action"] for r in rows} >= {"ticket.rfq.create", "ticket.rfq.send", "ticket.rfq.quote_on_behalf", "ticket.rfq.award"}
    blob = json.dumps(rows, ensure_ascii=False) + json.dumps(events, ensure_ascii=False)
    assert "סודית" not in blob and "פנימית" not in blob and "מדחס" not in blob


def test_full_deletion_needs_tickets_delete_and_leaves_nothing(s4, settings):
    kim(s4, settings)
    d = sent_rfq(s4)
    v = vid(d, s4.vendor["id"])
    quoted(s4, d["id"], v)
    a = award(s4, d["id"], quote_row(compare(s4, d["id"]), v)).json()["award"]
    s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{v}/messages", json={"text": "שאלה"}, headers=s4.h("mona"))
    r = s4.c.delete(f"{API}/tickets/rfqs/{d['id']}", headers=s4.h("mona"))
    assert r.status_code == 403
    vendor_ids = [x["id"] for x in detail(s4, d["id"])["vendors"]]
    r = s4.c.delete(f"{API}/tickets/rfqs/{d['id']}")
    assert r.status_code == 200, r.text
    with s4.db.connection(mode="read") as conn:
        assert store_rfq.rfq_rows_left(conn, d["id"], vendor_ids, []) == {}
        assert conn.execute("SELECT COUNT(*) FROM ticket_quote_decisions WHERE quote_id = ?", (a["quote_id"],)).fetchone()[0] == 0
    assert get(s4, d["id"]).status_code == 404


def test_retention_drops_links_then_the_request(s4, monkeypatch):
    monkeypatch.setattr(rfq_mod, "VENDOR_PAGE", True)
    whatsapp_on(s4)
    d = make(s4)
    assert send(s4, d["id"], channel="auto").status_code == 200
    s4.c.post(f"{API}/tickets/rfqs/{d['id']}/close", json={"revision": detail(s4, d["id"])["revision"]}, headers=s4.h("mona"))
    now = dt.datetime.now(dt.timezone.utc)
    with s4.db.connection() as conn:
        out = rfq_mod.retention(conn, now + dt.timedelta(days=31))
        assert out["links"] == 2 and out["purged"] == 0
        assert conn.execute("SELECT COUNT(*) FROM ticket_rfq_links").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM ticket_rfq_vendors").fetchone()[0] == 2, "the vendor rows keep their states"
        out = rfq_mod.retention(conn, now + dt.timedelta(days=30 * 24 + 1))
        assert out["purged"] == 1 and conn.execute("SELECT COUNT(*) FROM ticket_rfqs").fetchone()[0] == 0


def test_a_ticket_purge_keeps_the_rfq_it_was_opened_from(s4):
    t = s4.ticket()
    d = make(s4, source_ticket_id=t["id"])
    assert detail(s4, d["id"])["source_ticket"] == {"id": t["id"], "number": t["number"]}
    from smplwise.services.tickets import store

    with s4.db.connection() as conn:
        store.purge_ticket(conn, t["id"])
    assert detail(s4, d["id"])["source_ticket"] is None


def test_a_source_ticket_the_caller_cannot_see_is_refused(s4):
    t = s4.w.create("cleo", "חלון שבור", dept=s4.w.cleaning)
    r = new_rfq(s4, "mona", vendors=[s4.vendor["id"]], source_ticket_id=t["id"])
    assert r.status_code == 422 and r.json()["details"]["fields"][0]["field"] == "source_ticket_id"


# ---------------------------------------------------------------- guards

def test_only_the_rfq_module_reads_requests_unchecked():
    offenders = []
    for path in SMPLWISE.rglob("*.py"):
        rel = path.relative_to(SMPLWISE).as_posix()
        if rel in ("services/tickets/rfq.py", "services/tickets/store_rfq.py"):
            continue
        if re.search(r"\b(rfq_row_unchecked|rfq_candidates_unchecked)\b", path.read_text(encoding="utf-8")):
            offenders.append(rel)
    assert offenders == [], f"a request read around rfq.visible(): {offenders}"


def test_visible_hebrew_avoids_the_retired_words():
    words = ("קריאה", "קריאות", "קריאת")
    for name in ("services/tickets/rfq.py", "routers/tickets_rfq.py", "services/tickets/rfq_links.py", "services/tickets/message_templates.py"):
        body = (SMPLWISE / name).read_text(encoding="utf-8")
        assert not any(w in body for w in words), name


def test_the_rfq_starters_pass_the_template_rules():
    from smplwise.services.tickets import message_templates as mt

    for purpose in ("rfq_invite", "rfq_reminder", "rfq_update", "rfq_cancelled", "rfq_order"):
        assert set(mt.STARTERS[purpose]) == {"he", "en", "ar", "ru"}
        for lang, body in mt.STARTERS[purpose].items():
            assert mt.problems(purpose, body) == [], (purpose, lang)
            assert not any(n in body for n in mt.DEFAULT_NOUNS), (purpose, lang)
    assert mt.footer_for({"number": "7"}, lang="he", purpose="rfq_invite") == "בקשה להצעת מחיר 7"
