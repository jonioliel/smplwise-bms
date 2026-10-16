"""Release 2.5.8 consolidated security review (2026-10-16) - the fixes of integ/258: F1 (a re-link of a confirmed directory row),
F2 / F5 (new link / resend on a staff link honour the confirmed number and the user's switch), F3 (prefix-aware URL), F4 (a staff
contact without an account never gets the money surface), F6 (a non-ASCII confirm token), F7 (a stored address whose path became a
reserved word) and the coverage gaps of section 8. Fake ha-whatsapp only; every name and number is invented (050-000-xxxx)."""
from __future__ import annotations

import json
import shutil
import sqlite3
import time

import pytest

from smplwise import db as dbmod
from smplwise.services.tickets import links, settings_doc
from smplwise.services.tickets.public_http import UNIFORM_404
from test_tickets_s5b_channel import env  # noqa: F401 - the slice 5b environment
from test_tickets_staff_links import API, hdr, mine, set_mobile, staff_row, staff_ticket
from tickets_s4_world import Clock, crid


def outbox_count(env, ticket_id: str) -> int:
    return len(env.rows(ticket_id))


# ---------------------------------------------------------------- F1: a re-link never carries the confirmation to another user


def test_f1_relinking_a_confirmed_row_to_another_user_clears_the_confirmation_and_tells_the_new_user(env):
    staff_ticket(env)  # tom's row: mobile set, confirmed by tom
    with env.s4.db.connection(mode="read") as conn:
        cid, rev = conn.execute("SELECT id, revision FROM ticket_contacts WHERE user_id = 'dev-tom'").fetchone()
    r = env.c.patch(f"{API}/tickets/contacts/{cid}", json={"user_id": "dev-gil", "revision": rev})
    assert r.status_code == 200, r.text
    me = mine(env, "gil")
    assert me["has_phone"] is True and me["confirmed"] is False, "gil never confirmed this number"
    t = env.s4.ticket()
    assert env.s4.w.assign("joni", t["id"], "gil").status_code == 200
    assert outbox_count(env, t["id"]) == 0, "no staff link to a number the new user never confirmed"
    with env.s4.db.connection(mode="read") as conn:
        told = conn.execute("SELECT COUNT(*) FROM notifications n JOIN notification_recipients r ON r.notification_id = n.id "
                            "WHERE n.source = 'ticket.staff_mobile' AND r.user_id = 'dev-gil'").fetchone()[0]
    assert told >= 1, "the new user is told in the app"


# ---------------------------------------------------------------- F2 / F5: new link and resend


def test_f2_new_link_after_a_configurer_phone_change_is_refused(env):
    t, _ = staff_ticket(env)
    assert set_mobile(env, "tom", "+972500000093").status_code == 200  # revoked + unconfirmed
    r = env.c.post(f"{API}/tickets/{t['id']}/link/new")
    assert r.status_code == 409 and r.json()["code"] == "assignee_not_allowed", r.text
    assert outbox_count(env, t["id"]) <= 1 and all(x.state != "queued" for x in env.rows(t["id"])[1:])


def test_f2_new_link_after_the_user_withdrew_the_confirmation_is_refused(env):
    t, _ = staff_ticket(env)
    r = env.c.put(f"{API}/tickets/me/staff-mobile", json={"confirmed": False}, headers=env.h("tom"))
    assert r.status_code == 200, r.text
    r = env.c.post(f"{API}/tickets/{t['id']}/link/new")
    assert r.status_code == 409 and r.json()["code"] == "assignee_not_allowed", r.text


def test_f5_resend_honours_the_users_whatsapp_switch(env):
    t, _ = staff_ticket(env)
    env.tick()
    r = env.c.put(f"{API}/tickets/me/staff-mobile", json={"notify_whatsapp": False}, headers=env.h("tom"))
    assert r.status_code == 200, r.text
    before = outbox_count(env, t["id"])
    r = env.c.post(f"{API}/tickets/{t['id']}/link/resend")
    assert r.status_code == 409, r.text
    assert outbox_count(env, t["id"]) == before


# ---------------------------------------------------------------- F3: the URL follows the effective prefix (default and pinned 't')


def _sent_text(env) -> str:
    env.tick()
    return env.fake.calls[-1]["data"]["message"]


def test_f3_the_staff_message_url_follows_the_default_prefix(env):
    staff_ticket(env)
    doc = env.c.get(f"{API}/tickets/settings").json()
    prefix = links.effective_prefix(doc["public"]["base_url"], doc["public"]["path_prefix"])
    text = _sent_text(env)
    assert text.count("https://") == 1 and f"/{prefix}/#" in text, (prefix, text)


def test_f3_the_staff_message_url_follows_a_pinned_t_prefix(env):
    rev = env.c.get(f"{API}/tickets/settings").json()["revision"]
    r = env.c.put(f"{API}/tickets/settings", json={"revision": rev, "public": {"path_prefix": "t"}})
    assert r.status_code == 200, r.text
    staff_ticket(env)
    text = _sent_text(env)
    assert text.count("https://") == 1 and "/t/#" in text, text


# ---------------------------------------------------------------- F6: a non-ASCII confirm token


def test_f6_a_non_ascii_confirm_token_is_a_422_not_a_500(env):
    assert set_mobile(env, "tom", "050-000-0091").status_code == 200
    r = env.c.put(f"{API}/tickets/me/staff-mobile", json={"confirm": "טוקןטוקן"}, headers=env.h("tom"))
    assert r.status_code == 422, r.text


# ---------------------------------------------------------------- gap 1: the cost routes through the prefixed path


def test_gap1_a_staff_token_on_the_prefixed_cost_routes_is_the_uniform_404(env):
    t, _ = staff_ticket(env)
    token = env.s4.token_of(t["id"])
    doc = env.c.get(f"{API}/tickets/settings").json()
    prefix = links.effective_prefix(doc["public"]["base_url"], doc["public"]["path_prefix"])
    client, _ = env.s4.public(Clock(time.time()))
    assert client.get(f"/{prefix}/api/ticket", headers=hdr(token)).status_code == 200, "the prefixed path serves the page"
    for method, path in (("GET", "quote"), ("POST", "quote"), ("GET", "claim"), ("POST", "claim")):
        kw = {"json": {"client_request_id": crid()}} if method == "POST" else {}
        r = client.request(method, f"/{prefix}/api/{path}", headers=hdr(token), **kw)
        assert r.status_code == 404 and r.content == UNIFORM_404, (method, path, r.status_code)


# ---------------------------------------------------------------- gap 6: a configurer can never confirm another user's number


def test_gap6_the_admin_staff_route_cannot_confirm_a_number(env):
    for body in ({"phone": "050-000-0091", "phone_confirmed_at": "2026-10-16T00:00:00Z"}, {"phone": "050-000-0091", "confirmed": True},
                 {"phone": "050-000-0091", "confirm": "abc"}):
        assert set_mobile(env, "tom", body.pop("phone"), **body).status_code == 422
    assert set_mobile(env, "tom", "050-000-0091").status_code == 200
    assert mine(env, "tom")["confirmed"] is False


# ---------------------------------------------------------------- F4: a staff contact without an account gets no money surface


def _employee(env):
    r = env.c.post(f"{API}/tickets/contacts", json={"kind": "employee", "display_name": "יוסי טכנאי", "phone": "050-000-0077", "lang": "he",
                                                     "departments": ["dept-maintenance"]})
    assert r.status_code == 201, r.text
    return r.json()


def test_f4_a_staff_contact_assignment_has_no_cost_claim_and_no_quote_or_claim_route(env):
    e = _employee(env)
    t = env.s4.ticket()
    r = env.s4.assign_contact(t["id"], e["id"], user="mona", cost_claim="required")
    assert r.status_code == 200, r.text
    link = staff_row(env, t["id"])
    with env.s4.db.connection(mode="read") as conn:
        mode = conn.execute("SELECT cost_claim FROM ticket_assignments WHERE id = ?", (link["assignment_id"],)).fetchone()[0]
    assert mode == "off", "fail closed: an internal employee is never put into the vendor-payment pipeline"
    token = env.s4.token_of(t["id"])
    client, _ = env.s4.public(Clock(time.time()))
    view = client.get("/t/api/ticket", headers=hdr(token))
    assert view.status_code == 200 and "claim" not in view.json()
    for method, path in (("GET", "/t/api/quote"), ("POST", "/t/api/quote"), ("GET", "/t/api/claim"), ("POST", "/t/api/claim")):
        kw = {"json": {"client_request_id": crid()}} if method == "POST" else {}
        r = client.request(method, path, headers=hdr(token), **kw)
        assert r.status_code == 404 and r.content == UNIFORM_404, (method, path, r.status_code)
    r = client.post("/t/api/status", headers=hdr(token), json={"status": "acknowledged", "client_request_id": crid()})
    assert r.status_code == 200, "the handler actions stay"


def test_f4_the_preview_offers_no_cost_claim_for_a_staff_contact(env):
    e = _employee(env)
    t = env.s4.ticket()
    r = env.c.post(f"{API}/tickets/{t['id']}/assign/preview", json={"contact_id": e["id"]}, headers=env.h("mona"))
    assert r.status_code == 200, r.text
    assert r.json()["cost_claim"]["default"] == "off" and r.json()["cost_claim"]["choices"] == ["off"]


# ---------------------------------------------------------------- F7: a stored address whose path became a reserved word


def test_f7_a_stored_address_with_a_reserved_path_degrades_with_a_visible_reason(env):
    with env.s4.db.connection() as conn:
        raw = json.loads(conn.execute("SELECT value FROM settings WHERE key = 'tickets.settings'").fetchone()[0])
        raw.setdefault("public", {})["base_url"] = "https://t-demo.arx.example.test/api"
        conn.execute("UPDATE settings SET value = ? WHERE key = 'tickets.settings'", (json.dumps(raw),))
        doc = settings_doc.read(conn)
    assert doc["public"]["base_url"] == "", "fail closed: no link is derived from a refused address"
    assert doc["public"].get("base_url_refused") == "reserved", "the reason is visible (Settings / readiness)"


# ---------------------------------------------------------------- gap 4: 0087 over populated child tables


def _fill(conn: sqlite3.Connection, table: str, **vals) -> None:
    cols = conn.execute(f"PRAGMA table_info({table})").fetchall()
    row = dict(vals)
    for c in cols:
        name, typ, notnull, default = c[1], (c[2] or "").upper(), c[3], c[4]
        if name in row or not notnull or default is not None or c[5]:
            continue
        row[name] = 1 if "INT" in typ else "2026-10-01T00:00:00Z"
    conn.execute(f"INSERT INTO {table}({', '.join(row)}) VALUES ({', '.join('?' * len(row))})", tuple(row.values()))


def test_gap4_migration_0087_keeps_every_child_row_of_a_populated_database(tmp_path, monkeypatch):
    old = tmp_path / "mig"
    old.mkdir()
    for f in dbmod.MIGRATIONS_DIR.glob("*.sql"):
        if int(f.name.split("_", 1)[0]) <= 86:
            shutil.copy(f, old / f.name)
    real = dbmod.MIGRATIONS_DIR
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", old)
    path = tmp_path / "pop.db"
    dbmod.Database(path).migrate()
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA foreign_keys=ON")
    _fill(conn, "tickets", id="tk1", department_id="dept-maintenance", priority_id=conn.execute(
        "SELECT id FROM ticket_priorities WHERE department_id = 'dept-maintenance' LIMIT 1").fetchone()[0], status="assigned", origin="manual",
          waiting_on="assignee", number=1, title="x")
    _fill(conn, "ticket_contacts", id="c1", kind="person", display_name="x")
    _fill(conn, "ticket_assignments", id="a1", ticket_id="tk1", assignee_kind="contact", contact_id="c1", assignee_name="x", channel="whatsapp")
    _fill(conn, "ticket_links", id="l1", ticket_id="tk1", assignment_id="a1", contact_id="c1", key_id="k", token_hash="h1", require_code=1)
    _fill(conn, "ticket_link_sessions", id_hash="s1", link_id="l1", generation=1)
    _fill(conn, "ticket_link_codes", id="co1", link_id="l1", generation=1, code_hash="x", channel="whatsapp")
    _fill(conn, "ticket_link_failures", link_id="l1", generation=1, window_start="2026-10-01T00:00:00Z", failures=2)
    _fill(conn, "ticket_link_access", link_id="l1", at="2026-10-01T00:00:00Z", kind="open", client_key="ck")
    _fill(conn, "ticket_link_redeems", id_hash="r1", link_id="l1", generation=1)
    _fill(conn, "ticket_outbox", id="o1", ticket_id="tk1", link_id="l1", recipient_kind="contact", contact_id="c1", channel="whatsapp",
          purpose="assign", use_key="tickets.messages", state="queued", not_before="2026-10-01T00:00:00Z")
    conn.commit()
    tables = ("ticket_links", "ticket_link_sessions", "ticket_link_codes", "ticket_link_failures", "ticket_link_access", "ticket_link_redeems",
              "ticket_outbox")
    before = {t: conn.execute(f"SELECT * FROM {t} ORDER BY 1").fetchall() for t in tables}
    conn.close()
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", real)
    applied = dbmod.Database(path).migrate()
    assert applied[0] == 87 and all(n > 87 for n in applied[1:])  # later changes (0088 ..., 0096 USR1) apply after it
    conn = sqlite3.connect(path)
    after = {t: conn.execute(f"SELECT * FROM {t} ORDER BY 1").fetchall() for t in tables}
    assert all(len(before[t]) == 1 for t in tables)
    for t in tables:
        if t == "ticket_links":
            assert [r[:-1] for r in after[t]] == before[t] and after[t][0][-1] == "external"
        else:
            assert after[t] == before[t], t
    assert conn.execute("PRAGMA foreign_key_check").fetchall() == []
    conn.close()


# ---------------------------------------------------------------- gap 7: the NOTIFWA opt-in never follows a re-linked row


def test_gap7_a_relinked_row_does_not_carry_the_notifications_opt_in(env):
    from smplwise.services import notify_whatsapp as wa

    assert set_mobile(env, "tom", "050-000-0091").status_code == 200
    with env.s4.db.connection() as conn:
        found = wa.raw_number(conn, "dev-tom")
        assert found is not None
        wa.set_opt_in(conn, "dev-tom", found.digits)  # tom's own opt-in for his number
        cid, rev = conn.execute("SELECT id, revision FROM ticket_contacts WHERE user_id = 'dev-tom'").fetchone()
    r = env.c.patch(f"{API}/tickets/contacts/{cid}", json={"user_id": "dev-gil", "revision": rev})
    assert r.status_code == 200, r.text
    with env.s4.db.connection(mode="read") as conn:
        got = wa.resolve_number(conn, "dev-gil")
    assert got is None or got.consent != "granted", "gil never opted in for this number"
