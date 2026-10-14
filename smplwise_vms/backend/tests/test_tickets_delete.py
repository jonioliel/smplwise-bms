"""Full deletion of a ticket by a manager (owner decisions 14.10; services/tickets/deletion.py, docs/changes/CR-038-DELETE-NOTES.md):
the permission catalogue (sensitive, not delegable, system_admin only), the matrix (manager rights + tickets.delete where the ticket
lies, department scope, place scope), the uniform 404 after, idempotency, the typed number and the reason, every table emptied over
the REAL store (links revoked first, outbox / inbound / costs / photos / device context / events / assignments), the files on disk
(after the commit; a failed removal is swept), the cost guard, the content-free audit row, the bulk route with per-ticket results,
the interactive-session rule and the hourly rate. Every name, number and address here is invented."""
from __future__ import annotations

import io
import json

import pytest
from conftest import as_user, bind
from PIL import Image

from smplwise.rbac import ROLES, Principal
from smplwise.routers.access import DEFAULT_DELEGABLE, PERMISSION_LABELS, SENSITIVE
from smplwise.services.tickets import deletion, store
from smplwise.services.tickets.public_http import UNIFORM_404
from tickets_s4_world import PHONE_A, build_s4, crid
from tickets_world import API, MAINT, build
from test_tickets_costs import decide, done, hdr, submit  # noqa: F401 - the slice 9 world


@pytest.fixture(autouse=True)
def _fresh_rate():
    deletion.reset_rate()
    yield
    deletion.reset_rate()


@pytest.fixture()
def w(settings):
    return build(settings)


@pytest.fixture()
def s4(settings, monkeypatch):
    return build_s4(settings, monkeypatch)


def jpeg() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (640, 480), (200, 210, 220)).save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def delete(c, ticket: dict, user: str = "joni", *, number: int | None = None, reason: str = "נפתחה בטעות", request_id: str | None = None):
    body = {"reason": reason, "confirm_number": number if number is not None else ticket["number"], "client_request_id": request_id or crid()}
    return c.post(f"{API}/tickets/{ticket['id']}/delete", json=body, headers=as_user(user))


def audit_rows(db, action: str = "ticket.delete") -> list[dict]:
    with db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]


def _db(w):
    return w.c.app.state.db


# ---------------------------------------------------------------- the catalogue

def test_the_permission_is_catalogued_sensitive_not_delegable_and_system_admin_only():
    assert ROLES["tickets_delete"] == ["tickets.delete"]
    assert "tickets.delete" in SENSITIVE and "tickets_delete" not in DEFAULT_DELEGABLE
    assert "{module}" in PERMISSION_LABELS["tickets.delete"]
    holders = sorted(r for r, perms in ROLES.items() if "tickets.delete" in perms)
    assert holders == ["system_admin", "tickets_delete"], "never granted to a built-in role automatically except system_admin"


# ---------------------------------------------------------------- the matrix

def test_who_may_delete(w):
    t = w.create("nora")
    assert w.detail(t["id"], "mona")["can"]["delete"] is False, "a manager without tickets.delete"
    assert delete(w.c, t, "mona").status_code == 403
    assert delete(w.c, t, "tom").status_code == 403, "a member, no permission"
    assert delete(w.c, t, "cleo").status_code == 404, "another department: the uniform 404"
    assert delete(w.c, t, "vic").status_code == 404
    for user in ("tom", "alda", "cleo"):
        bind(w.c, w.settings, user, "tickets_delete", "installation", "*")
    assert delete(w.c, t, "tom").status_code == 403, "tickets.delete without manager rights"
    assert delete(w.c, t, "alda").status_code == 403, "all departments + view, but no tickets.manage"
    assert delete(w.c, t, "cleo").status_code == 404, "the permission does not open another department"
    bind(w.c, w.settings, "mona", "tickets_delete", "installation", "*")
    assert w.detail(t["id"], "mona")["can"]["delete"] is True
    r = delete(w.c, t, "mona")
    assert r.status_code == 200, r.text
    assert r.json()["deleted"] is True and r.json()["number"] == t["number"]


def test_any_status_including_open_and_closed(w):
    for to in (None, "closed"):
        t = w.create("joni")
        if to:
            assert w.status("joni", t["id"], to, note="סגירה").status_code == 200
        assert delete(w.c, t).status_code == 200


def test_the_permission_is_checked_where_the_ticket_lies(w):
    bind(w.c, w.settings, "mona", "tickets_delete", "floor", w.floors["floor2"])
    t2, t3 = w.create("joni"), w.create("joni")
    w.place(t2["id"], "floor2")
    w.place(t3["id"], "floor3")
    assert delete(w.c, t3, "mona").status_code == 403, "tickets.delete held on another floor only"
    assert delete(w.c, t2, "mona").status_code == 200


def test_after_the_delete_the_ticket_is_the_uniform_404(w):
    t = w.create("joni")
    unknown = w.c.get(f"{API}/tickets/nosuchticket01").json()
    assert delete(w.c, t).status_code == 200
    gone = w.get("joni", t["id"])
    assert gone.status_code == 404 and gone.json()["code"] == unknown["code"] == "ticket_not_found"
    again = delete(w.c, t)
    assert again.status_code == 404 and again.json()["code"] == "ticket_not_found"
    assert w.c.post(f"{API}/tickets/nosuchticket01/delete", json={"reason": "x", "confirm_number": 1, "client_request_id": crid()}).json()["code"] == "ticket_not_found"


def test_idempotent_by_client_request_id(w):
    t = w.create("joni")
    rid = crid()
    a, b = delete(w.c, t, request_id=rid), delete(w.c, t, request_id=rid)
    assert a.status_code == b.status_code == 200 and a.json() == b.json()
    assert len([r for r in audit_rows(_db(w)) if r["decision"] == "allowed"]) == 1, "deleted once"


def test_the_typed_number_and_the_reason(w):
    t = w.create("joni")
    r = delete(w.c, t, number=t["number"] + 1)
    assert r.status_code == 422 and r.json()["details"]["fields"][0]["field"] == "confirm_number"
    r = delete(w.c, t, reason="   ")
    assert r.status_code == 422 and r.json()["details"]["fields"][0] == {"field": "reason", "code": "required"}
    r = delete(w.c, t, reason="א" * 301)
    assert r.status_code == 422 and r.json()["details"]["fields"][0]["field"] == "reason"
    assert w.get("joni", t["id"]).status_code == 200, "nothing deleted"
    assert delete(w.c, t, reason="א" * 300).status_code == 200


# ---------------------------------------------------------------- everything goes (the real store)

def test_every_row_and_file_goes_and_links_are_revoked_first(s4, settings, monkeypatch):
    t, token, client, _clock = done(s4, "optional")
    tid = t["id"]
    assert client.get("/t/api/ticket", headers=hdr(token)).status_code == 200
    assert client.post("/t/api/claim/file", headers=hdr(token), files={"file": ("p.jpg", jpeg(), "image/jpeg")},
                       data={"client_request_id": crid()}).status_code == 201
    assert submit(client, token).status_code == 201
    up = s4.c.post(f"{API}/tickets/{tid}/attachments", files={"file": ("a.jpg", jpeg(), "image/jpeg")}, data={"external": "false"})
    assert up.status_code == 201, up.text
    assert s4.c.post(f"{API}/tickets/{tid}/notes", json={"text": "הערה פנימית"}).status_code == 201
    with s4.db.connection() as conn:
        conn.execute("INSERT INTO ticket_inbound(id, received_at, event_type, dedupe_key, ticket_id, result) VALUES ('in-1', '2026-10-14T08:00:00Z', "
                     "'whatsapp_message_received', 'dk-1', ?, 'note')", (tid,))
        for oid, state in (("ob-1", "queued"), ("ob-2", "sent")):
            conn.execute("INSERT INTO ticket_outbox(id, ticket_id, recipient_kind, channel, purpose, use_key, state, not_before, created_at, updated_at) "
                         "VALUES (?, ?, 'contact', 'whatsapp', 'update', 'tickets.messages', ?, '2026-10-14T08:00:00Z', '2026-10-14T08:00:00Z', "
                         "'2026-10-14T08:00:00Z')", (oid, tid, state))
        conn.execute("INSERT INTO ticket_requests(scope, client_request_id, route, status_code, response_json, at) VALUES "
                     "('user:x', 'zz-00000001', 'POST /tickets', 201, ?, '2026-10-14T08:00:00Z')", (json.dumps({"id": tid}),))
    folder = settings.data_dir / "tickets" / tid
    assert folder.is_dir() and any(folder.rglob("*.jpg"))
    seen_at_purge: list[list] = []
    real_purge = store.purge_ticket

    def spy(conn, ticket_id):
        seen_at_purge.append([r["revoked_at"] for r in conn.execute("SELECT revoked_at FROM ticket_links WHERE ticket_id = ?", (ticket_id,)).fetchall()])
        return real_purge(conn, ticket_id)

    monkeypatch.setattr(store, "purge_ticket", spy)
    r = delete(s4.c, t)
    assert r.status_code == 200, r.text
    assert r.json()["counts"]["photos"] == 1 and r.json()["counts"]["files"] >= 2 and r.json()["counts"]["claims"] == 1
    assert seen_at_purge and seen_at_purge[0] and all(seen_at_purge[0]), "every link was revoked before any row went"
    with s4.db.connection(mode="read") as conn:
        assert store.ticket_rows_left(conn, tid) == {}
        assert conn.execute("SELECT COUNT(*) FROM ticket_cost_revisions").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM ticket_link_sessions").fetchone()[0] == 0
        left = conn.execute("SELECT route FROM ticket_requests WHERE response_json LIKE ?", (f"%{tid}%",)).fetchall()
        assert [r[0] for r in left] == ["POST /tickets/{id}/delete"], "only the deletion's own (content-free) idempotency answer"
        open_n = conn.execute("SELECT COUNT(*) FROM notifications WHERE state != 'resolved' AND dedupe_key LIKE ?", (f"ticket:{tid}:%",)).fetchone()[0]
        assert open_n == 0, "the ticket's notifications are resolved"
    assert not folder.exists(), "photos and invoice files are removed after the commit"
    assert client.get("/t/api/ticket", headers=hdr(token)).content == UNIFORM_404, "the vendor's page is dead"


def test_a_failed_file_removal_is_swept_later(s4, settings, monkeypatch):
    t = s4.ticket()
    assert s4.c.post(f"{API}/tickets/{t['id']}/attachments", files={"file": ("a.jpg", jpeg(), "image/jpeg")}).status_code == 201
    folder = settings.data_dir / "tickets" / t["id"]
    keep = s4.ticket()
    assert s4.c.post(f"{API}/tickets/{keep['id']}/attachments", files={"file": ("a.jpg", jpeg(), "image/jpeg")}).status_code == 201

    def boom(*_a, **_k):
        raise OSError("busy")

    monkeypatch.setattr(deletion.shutil, "rmtree", boom)
    assert delete(s4.c, t).status_code == 200, "the rows are gone even when the folder is not"
    assert folder.is_dir()
    with s4.db.connection(mode="read") as conn:
        assert store.ticket_rows_left(conn, t["id"]) == {}
    monkeypatch.undo()
    assert deletion.sweep_orphans(s4.db, settings.data_dir / "tickets", min_age_s=0) == 1
    assert not folder.exists() and (settings.data_dir / "tickets" / keep["id"]).is_dir(), "a live ticket's folder stays"


# ---------------------------------------------------------------- the cost guard

def test_an_approved_claim_needs_the_cost_permission(s4):
    t, token, client, _ = done(s4)
    assert submit(client, token).status_code == 201 and decide(s4, t["id"], "approve").status_code == 200
    bind(s4.c, s4.w.settings, "mona", "tickets_delete", "installation", "*")
    r = delete(s4.c, t, "mona")
    assert r.status_code == 409 and r.json()["code"] == "cost_claim_approved"
    assert s4.w.get("joni", t["id"]).status_code == 200
    r = delete(s4.c, t, "joni")
    assert r.status_code == 200, r.text
    row = [a for a in audit_rows(s4.db) if a["decision"] == "allowed"][-1]
    d = json.loads(row["details_json"])
    assert d["cost_override"] is True and d["had_cost_claim"] is True


# ---------------------------------------------------------------- the audit row holds no content

def test_the_audit_row_is_content_free(s4):
    t, token, client, _ = done(s4, "off", )
    assert s4.c.post(f"{API}/tickets/{t['id']}/notes", json={"text": "פתק-סודי-777"}).status_code == 201
    with s4.db.connection(mode="read") as conn:
        link_ids = [r[0] for r in conn.execute("SELECT id FROM ticket_links WHERE ticket_id = ?", (t["id"],)).fetchall()]
    title = s4.w.detail(t["id"])["title"]
    assert delete(s4.c, t, reason="כפילות").status_code == 200
    rows = [a for a in audit_rows(s4.db) if a["resource_id"] == t["id"]]
    assert len([a for a in rows if a["decision"] == "allowed"]) == 1
    d = json.loads(rows[-1]["details_json"])
    assert {"number", "department_id", "status", "reason", "notes", "photos", "files", "links", "claims", "had_cost_claim"} <= set(d)
    assert d["number"] == t["number"] and d["department_id"] == MAINT and d["reason"] == "כפילות" and d["notes"] >= 1
    blob = json.dumps(rows, ensure_ascii=False)
    for secret in (title, "פתק-סודי-777", PHONE_A, token, *link_ids, s4.contact["display_name"]):
        assert secret not in blob, secret


# ---------------------------------------------------------------- bulk

def test_bulk_delete_answers_per_ticket(w):
    bind(w.c, w.settings, "mona", "tickets_delete", "installation", "*")
    mine1, mine2 = w.create("joni"), w.create("joni")
    other = w.create("joni", dept=w.cleaning)
    ids = [mine1["id"], other["id"], "nosuchticket01", mine2["id"]]

    def bulk(user="mona", **body):
        payload = {"ids": ids, "reason": "ניקוי כפילויות", "confirm_count": len(ids), "client_request_id": crid(), **body}
        return w.c.post(f"{API}/tickets/bulk-delete", json=payload, headers=as_user(user))

    assert bulk(confirm_count=3).json()["details"]["fields"][0] == {"field": "confirm_count", "code": "mismatch"}
    assert bulk(ids=[f"t{i:03d}xxxx" for i in range(51)], confirm_count=51).status_code == 422
    assert bulk("tom").status_code == 403, "no tickets.delete anywhere"
    r = bulk()
    assert r.status_code == 200, r.text
    res = {x["id"]: x["result"] for x in r.json()["results"]}
    assert res == {mine1["id"]: "ok", other["id"]: "not_found", "nosuchticket01": "not_found", mine2["id"]: "ok"}
    assert r.json()["done"] == 2
    assert w.get("joni", other["id"]).status_code == 200 and w.get("joni", mine1["id"]).status_code == 404


def test_bulk_keeps_a_ticket_blocked_by_an_approved_claim(s4):
    t, token, client, _ = done(s4)
    assert submit(client, token).status_code == 201 and decide(s4, t["id"], "approve").status_code == 200
    plain = s4.ticket()
    bind(s4.c, s4.w.settings, "mona", "tickets_delete", "installation", "*")
    r = s4.c.post(f"{API}/tickets/bulk-delete", json={"ids": [t["id"], plain["id"]], "reason": "x", "confirm_count": 2, "client_request_id": crid()},
                  headers=as_user("mona"))
    assert {x["id"]: x["result"] for x in r.json()["results"]} == {t["id"]: "cost_claim_approved", plain["id"]: "ok"}


# ---------------------------------------------------------------- the session and the rate

def test_interactive_sessions_only():
    assert deletion.interactive(Principal("u", "u", "u", "remote", via="cookie"))
    assert deletion.interactive(Principal("u", "u", "u", "ingress"))
    assert not deletion.interactive(Principal("u", "u", "u", "remote", via="bearer"))


def test_a_token_client_is_refused(w, monkeypatch):
    t = w.create("joni")
    monkeypatch.setattr(deletion, "interactive", lambda _p: False)
    r = delete(w.c, t)
    assert r.status_code == 403 and r.json()["code"] == "interactive_session_required"
    assert w.get("joni", t["id"]).status_code == 200


def test_the_hourly_rate(w, monkeypatch):
    monkeypatch.setattr(deletion, "RATE_PER_HOUR", 2)
    a, b, c3 = w.create("joni"), w.create("joni"), w.create("joni")
    assert delete(w.c, a).status_code == 200 and delete(w.c, b).status_code == 200
    r = delete(w.c, c3)
    assert r.status_code == 429 and r.json()["code"] == "delete_rate" and r.json()["details"]["retry_after_s"] > 0
    assert w.get("joni", c3["id"]).status_code == 200
    assert deletion.rate_wait("someone-else") == 0
