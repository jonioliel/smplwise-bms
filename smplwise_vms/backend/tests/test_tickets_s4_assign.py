"""CR-038 slice 4 - sending a ticket outside and the life of its link on the manager's side (spec 8.1, 10.2, 11.2; D5, D6, D12,
D23, D25; review T4, T19-3, C10, C11): the gates of an external assignment, the preview, the minted link (a hash, never a token),
copy / new / revoke / resend, the D5 durations with department overrides, the first expiry over the resolve window, the
lower-cap pull-in, the grace at close and the revocations at reassign / reopen."""
from __future__ import annotations

import datetime as dt
import time

import pytest

from conftest import bind
from smplwise.services.tickets import handler_links, links
from smplwise.services.tickets.keyring import KEYS
from smplwise.services.tickets.public_runtime import RUNTIME
from tickets_s4_world import API, BASE_URL, Clock, build_s4


@pytest.fixture()
def s4(settings, monkeypatch):
    return build_s4(settings, monkeypatch)


def iso_dt(s: str) -> dt.datetime:
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))


# ---------------------------------------------------------------- the gates


def test_a_manager_without_the_external_permission_is_refused_and_audited(s4):
    t = s4.ticket()
    r = s4.assign_contact(t["id"], user="mona")
    assert r.status_code == 403 and r.json()["details"]["reason"] == "external_permission_missing", r.text
    bind(s4.c, s4.w.settings, "mona", "tickets_external", "installation", "*")
    assert s4.assign_contact(t["id"], user="mona").status_code == 200


def test_the_external_permission_without_manager_rights_is_not_enough(s4):
    bind(s4.c, s4.w.settings, "tom", "tickets_external", "installation", "*")
    t = s4.ticket()
    r = s4.assign_contact(t["id"], user="tom")
    assert r.status_code == 403 and r.json()["details"]["reason"] == "not_manager"


@pytest.mark.parametrize("missing", ["option", "listener", "address"])
def test_without_the_public_page_external_assignment_is_409(s4, monkeypatch, missing):
    if missing == "option":
        monkeypatch.setattr(RUNTIME, "option_on", False)
    elif missing == "listener":
        monkeypatch.setattr(RUNTIME, "listening", False)
    else:
        rev = s4.c.get(f"{API}/tickets/settings").json()["revision"]
        assert s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "public": {"base_url": ""}}).status_code == 200
    t = s4.ticket()
    r = s4.assign_contact(t["id"])
    assert r.status_code == 409 and r.json()["code"] == "public_link_unavailable"
    assert s4.w.detail(t["id"])["can"]["assign_external"] is False
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_links").fetchone()[0] == 0, "nothing written"


def test_a_contact_allowed_only_in_another_department_is_refused(s4):
    r = s4.add_contact(display_name="ספק ניקיון", phone="050-000-0041", departments=[s4.w.cleaning])
    t = s4.ticket()
    res = s4.assign_contact(t["id"], r.json()["id"])
    assert res.status_code == 409 and res.json()["code"] == "assignee_not_allowed"


def test_an_inactive_or_unknown_contact_is_refused(s4):
    cid = s4.contact["id"]
    assert s4.c.patch(f"{API}/tickets/contacts/{cid}", json={"active": False, "revision": s4.contact_rev(cid)}).status_code == 200
    t = s4.ticket()
    assert s4.assign_contact(t["id"], cid).json()["code"] == "assignee_not_allowed"
    assert s4.assign_contact(t["id"], "nope0000").json()["code"] == "assignee_not_allowed"


def test_the_assignee_picker_lists_contacts_only_for_external_holders(s4):
    t = s4.ticket()
    r = s4.c.get(f"{API}/tickets/assignees", params={"department_id": "dept-maintenance", "ticket_id": t["id"]}, headers=s4.h("mona"))
    assert r.status_code == 200 and r.json()["contacts"] == [] and r.json()["external"] is False
    r = s4.c.get(f"{API}/tickets/assignees", params={"department_id": "dept-maintenance", "ticket_id": t["id"]})
    names = [c["name"] for c in r.json()["contacts"]]
    assert "משה אברהם" in names and "קליימה-טק מיזוג אוויר" in names and r.json()["public_ready"] is True


# ---------------------------------------------------------------- the assignment and its link


def test_an_external_assignment_mints_a_hashed_link_and_records_everything(s4):
    t, token = s4.sent()
    d = s4.w.detail(t["id"])
    assert d["status"] == "assigned" and d["assignee"]["kind"] == "contact" and d["assignee"]["name"] == "משה אברהם"
    row = s4.link_row(t["id"])
    assert row["token_hash"] == links.token_hash(token) and row["generation"] == 1 and row["require_code"] == 0
    with s4.db.connection(mode="read") as conn:
        dump = " ".join(str(v) for r in conn.execute("SELECT * FROM ticket_links") for v in tuple(r))
        audit = " ".join(r[0] or "" for r in conn.execute("SELECT details_json FROM audit_log"))
    assert token not in dump and token not in audit, "the token is derived, never stored or audited"
    link = d["link"]
    assert link["state"] == "live" and link["current"] and link["can"]["copy"] and not link["can"]["resend"]
    assert "token" not in str(link) and BASE_URL not in str(d), "the detail never carries the URL"
    assert [e for e in d["events"] if e["kind"] == "assigned"][0]["data"]["assignee_kind"] == "contact"
    assert d["assignments"][-1]["channel"] == "manual"


def test_copy_returns_the_url_once_audited_and_marks_it_sent_by_hand(s4):
    t, token = s4.sent()
    r = s4.copy(t["id"])
    assert r.status_code == 200 and r.headers["cache-control"] == "no-store", r.text
    body = r.json()
    assert body["url"] == f"{BASE_URL}/t/#{token}" and token in body["text"] and "#" in body["url"]
    assert s4.link_row(t["id"])["sent_via"] == "manual"
    with s4.db.connection(mode="read") as conn:
        a = conn.execute("SELECT details_json FROM audit_log WHERE action = 'ticket.link.copy'").fetchone()[0]
    assert token not in a and "t/#" not in a
    assert s4.copy(t["id"], user="mona").status_code == 403, "a manager without tickets.external copies nothing"


def test_the_preview_shows_the_text_with_a_placeholder_and_the_refusals(s4):
    t = s4.ticket(title="נזילה בתקרה")
    r = s4.c.post(f"{API}/tickets/{t['id']}/assign/preview", json={"contact_id": s4.contact["id"]})
    assert r.status_code == 200, r.text
    p = r.json()
    assert "[קישור]" in p["text"] and "נזילה בתקרה" in p["text"] and p["channel"] == "manual" and p["refusals"] == []
    assert p["link"]["sliding_days"] == 14 and p["share_history"] == {"available": False, "default": False}
    r = s4.c.post(f"{API}/tickets/{t['id']}/assign/preview", json={"contact_id": s4.contact["id"], "require_code": True})
    assert r.json()["refusals"] == ["code_channel_unavailable"] and r.json()["require_code"] is True
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_links").fetchone()[0] == 0, "a preview has no side effect"


def test_an_english_contact_gets_the_english_text(s4):
    r = s4.add_contact(display_name="John Smith", phone="050-000-0060", lang="en")
    t = s4.ticket()
    p = s4.c.post(f"{API}/tickets/{t['id']}/assign/preview", json={"contact_id": r.json()["id"]}).json()
    assert p["lang"] == "en" and p["text"].startswith("Hello John Smith") and "[link]" in p["text"]


def test_share_history_is_refused_without_a_device_snapshot_and_for_security_domains(s4):
    t = s4.ticket()
    r = s4.assign_contact(t["id"], share_history=True)
    assert r.status_code == 422 and r.json()["details"]["fields"][0] == {"field": "share_history", "code": "not_allowed"}
    with s4.db.connection() as conn:
        conn.execute("UPDATE tickets SET entity_id = 'lock.front_door' WHERE id = ?", (t["id"],))
        conn.execute("INSERT INTO ticket_device_context(ticket_id, entity_id, captured_at, window_from, window_to, source, items_json) "
                     "VALUES (?, 'lock.front_door', 'a', 'a', 'a', 'device_activity', '[]')", (t["id"],))
    r = s4.assign_contact(t["id"], share_history=True)
    assert r.status_code == 422, "never for a lock (D3), whatever the client sends"


def test_reassigning_to_the_same_contact_is_409_and_to_a_user_revokes_the_link(s4):
    t, _token = s4.sent()
    assert s4.assign_contact(t["id"]).json()["code"] == "already_assigned"
    r = s4.w.assign("joni", t["id"], "tom")
    assert r.status_code == 200, r.text
    assert s4.link_row(t["id"])["revoked_reason"] == "reassigned"


def test_new_link_kills_the_old_token_and_starts_a_new_cap(s4):
    t, token = s4.sent()
    old = s4.link_row(t["id"])
    r = s4.c.post(f"{API}/tickets/{t['id']}/link/new")
    assert r.status_code == 200, r.text
    new = s4.link_row(t["id"])
    assert new["generation"] == 2 and new["token_hash"] != old["token_hash"] and new["revoked_at"] is None
    assert s4.token_of(t["id"]) != token
    assert any(e["kind"] == "link_new" for e in r.json()["events"])
    assert s4.c.post(f"{API}/tickets/{t['id']}/link/new", headers=s4.h("mona")).status_code == 403


def test_revoke_and_then_new_link(s4):
    t, _token = s4.sent()
    assert s4.c.post(f"{API}/tickets/{t['id']}/link/revoke").status_code == 200
    d = s4.w.detail(t["id"])
    assert d["link"]["state"] == "revoked" and d["link"]["revoked_reason"] == "manual" and d["link"]["can"]["new"] is True
    assert s4.c.post(f"{API}/tickets/{t['id']}/link/revoke").json()["code"] == "link_not_live"
    assert s4.copy(t["id"]).json()["code"] == "link_not_live"
    assert s4.c.post(f"{API}/tickets/{t['id']}/link/new").status_code == 200
    assert s4.w.detail(t["id"])["link"]["state"] == "live"


def test_resend_needs_a_message_channel(s4):
    t, _token = s4.sent()
    r = s4.c.post(f"{API}/tickets/{t['id']}/link/resend")
    assert r.status_code == 409 and r.json()["code"] == "channel_unavailable"


def test_link_actions_on_a_ticket_without_an_external_assignment_are_409(s4):
    t = s4.ticket()
    assert s4.c.post(f"{API}/tickets/{t['id']}/link/copy").json()["code"] == "no_link"


def test_an_invisible_ticket_is_the_uniform_404_on_every_new_route(s4):
    t, _token = s4.sent()
    for method, path, body in (("post", f"/tickets/{t['id']}/assign/preview", {"contact_id": s4.contact["id"]}),
                               ("post", f"/tickets/{t['id']}/link/copy", None), ("post", f"/tickets/{t['id']}/link/new", None),
                               ("post", f"/tickets/{t['id']}/link/revoke", None), ("post", f"/tickets/{t['id']}/link/resend", None)):
        r = getattr(s4.c, method)(f"{API}{path}", json=body, headers=s4.h("cleo"))
        assert r.status_code == 404 and r.json()["code"] == "ticket_not_found", (path, r.text)


# ---------------------------------------------------------------- D5: durations, first expiry, sliding, cap, grace


def test_the_first_expiry_covers_the_priority_resolve_window(s4):
    meta = s4.c.get(f"{API}/tickets/meta").json()["departments"][0]
    low = [p["id"] for p in meta["priorities"] if p["key"] == "low"][0]
    t = s4.ticket(priority_id=low)  # low = 30 days to resolve (13.1)
    assert s4.assign_contact(t["id"]).status_code == 200
    row = s4.link_row(t["id"])
    created, expires, cap = iso_dt(row["created_at"]), iso_dt(row["expires_at"]), iso_dt(row["cap_at"])
    assert abs((expires - created) - dt.timedelta(days=31)) < dt.timedelta(minutes=1), "review C10: 31 days, not 14"
    assert abs((cap - created) - dt.timedelta(days=90)) < dt.timedelta(minutes=1)


def test_department_overrides_win_over_the_installation(s4):
    with s4.db.connection() as conn:
        conn.execute("UPDATE ticket_departments SET link_sliding_days = 3, link_cap_days = 10, link_grace_hours = 0 WHERE id = 'dept-maintenance'")
    with s4.db.connection(mode="read") as conn:
        d = handler_links.durations(conn, "dept-maintenance")
    assert (d.sliding_days, d.cap_days, d.grace_hours) == (3, 10, 0)
    t, token = s4.sent()
    assert s4.w.status("joni", t["id"], "closed", note="סגירה").status_code == 200
    assert s4.link_row(t["id"])["revoked_reason"] == "closed", "grace 0 revokes at close (D5)"


def test_settings_validate_the_durations_and_a_lower_cap_pulls_live_links_in(s4):
    t, _token = s4.sent()
    rev = s4.c.get(f"{API}/tickets/settings").json()["revision"]
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "links": {"cap_days": 7, "sliding_days": 14}})
    assert r.status_code == 422 and r.json()["details"]["fields"][0]["field"] == "links.cap_days"
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "links": {"sliding_days": 7, "cap_days": 20}})
    assert r.status_code == 200 and r.json()["links"] == {"sliding_days": 7, "cap_days": 20, "grace_hours": 24}, r.text
    row = s4.link_row(t["id"])
    assert abs((iso_dt(row["cap_at"]) - iso_dt(row["created_at"])) - dt.timedelta(days=20)) < dt.timedelta(minutes=1)
    assert iso_dt(row["expires_at"]) <= iso_dt(row["cap_at"])


@pytest.mark.parametrize("url", ["http://t.example.test", "https://10.0.0.5", "https://localhost", "https://t.example.test/x",
                                 "https://t.example.test:8443", "https://user@t.example.test", "https://homeassistant.local"])
def test_the_public_address_is_validated(s4, url):
    rev = s4.c.get(f"{API}/tickets/settings").json()["revision"]
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "public": {"base_url": url}})
    assert r.status_code == 422 and r.json()["details"]["fields"][0]["field"] == "public.base_url", r.text


def test_trusted_proxy_networks_are_validated_and_reach_the_running_listener(s4):
    client, app = s4.public(Clock(time.time()))
    RUNTIME.app = app  # the listener's app (public_runtime.start would set it)
    rev = s4.c.get(f"{API}/tickets/settings").json()["revision"]
    assert s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "public": {"trusted_proxy_cidrs": ["0.0.0.0/0"]}}).status_code == 422
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "public": {"trusted_proxy_cidrs": ["172.30.32.0/23", "10.9.0.0/16"]}})
    assert r.status_code == 200, r.text
    assert [str(n) for n in app.edge.trusted] == ["172.30.32.0/23", "10.9.0.0/16"], "W13: no restart needed"


def test_reopening_a_closed_ticket_kills_the_link_in_its_grace(s4):
    t, token = s4.sent()
    assert s4.w.status("joni", t["id"], "closed", note="סגירה").status_code == 200
    assert s4.link_row(t["id"])["grace_until"] is not None
    assert s4.w.status("joni", t["id"], "new").status_code == 200
    assert s4.link_row(t["id"])["revoked_at"] is not None
    client, _ = s4.public(Clock(time.time()))
    assert client.get("/t/api/ticket", headers={"x-ticket-token": token}).status_code == 404


def test_the_module_key_is_created_once_and_named_by_the_rows(s4):
    with s4.db.connection(mode="read") as conn:
        ids = {r[0] for r in conn.execute("SELECT key_id FROM ticket_links UNION SELECT phone_key_id FROM ticket_contacts WHERE phone_key_id IS NOT NULL")}
    t, _ = s4.sent()
    assert s4.link_row(t["id"])["key_id"] in KEYS.ids() or KEYS.ids() == ("000000000000",)
    assert ids <= set(KEYS.ids())
