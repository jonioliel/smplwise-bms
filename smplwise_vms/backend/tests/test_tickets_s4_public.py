"""CR-038 slice 4 - the public handler routes over the REAL store (spec 10.3 / 10.5 / 10.7 / 11.2, D5, D12): the page's view, the
status / note / ETA / return writes, idempotency, the write budget, the read-only grace, the photo route on the real PhotoSink, the
code routes without a message channel, and the hostile inputs of the public surface. The public app is the one public_runtime
builds for the listener, driven through an ASGI test client (no socket)."""
from __future__ import annotations

import io
import json
import time

import pytest
from PIL import Image

from smplwise.services.tickets import links
from smplwise.services.tickets.public_http import UNIFORM_404
from tickets_s4_world import API, PHONE_A_E164, Clock, build_s4, crid


@pytest.fixture()
def s4(settings, monkeypatch):
    return build_s4(settings, monkeypatch)


def hdr(token: str, session: str | None = None) -> dict[str, str]:
    h = {"x-ticket-token": token}
    if session:
        h["x-ticket-session"] = session
    return h


def jpeg(w: int = 800, h: int = 600) -> bytes:
    im = Image.new("RGB", (w, h), (90, 140, 200))
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def upload(client, token: str, data: bytes, rid: str | None = None):
    return client.post("/t/api/photo", headers=hdr(token), files={"file": ("x.jpg", data, "image/jpeg")},
                       data={"client_request_id": rid or crid()})


# ---------------------------------------------------------------- the view


def test_the_page_shows_the_handler_view_and_nothing_internal(s4):
    t, token = s4.sent(title="מזגן לא מקרר - חדר 102")
    tid = t["id"]
    s4.c.post(f"{API}/tickets/{tid}/notes", json={"text": "פנימי: הדייר לא נעים", "external": False})
    s4.c.post(f"{API}/tickets/{tid}/notes", json={"text": "המפתח אצל השומר", "external": True})
    client, _ = s4.public(Clock(time.time()))
    r = client.get("/t/api/ticket", headers=hdr(token))
    assert r.status_code == 200, r.text
    v = r.json()
    assert v["number"] == t["number"] and v["title"] == "מזגן לא מקרר - חדר 102" and v["organization"] == "מגדלי הדר"
    assert v["lang"] == "he" and v["dir"] == "rtl" and v["code_required"] is False and v["read_only"] is False
    assert v["status"] == "assigned" and v["actions"]["statuses"] == ["acknowledged", "in_progress"]
    assert v["actions"]["return"] is True and v["actions"]["eta"] is True
    bodies = [e.get("body") for e in v["timeline"]]
    assert "המפתח אצל השומר" in bodies and "פנימי: הדייר לא נעים" not in bodies, "internal notes never reach the page"
    text = r.text
    assert PHONE_A_E164 not in text and "050-000" not in text and "dev-joni" not in text, "no phone number, no user id"
    assert v["labels"]["one"] and v["time_zone"] == "Asia/Jerusalem"
    assert r.headers["cache-control"] == "no-store" and "default-src 'none'" in r.headers["content-security-policy"]


def test_an_open_with_the_token_is_recorded_once_on_the_timeline_and_never_extends(s4):
    t, token = s4.sent()
    before = s4.link_row(t["id"])
    client, _ = s4.public(Clock(time.time()))
    for _ in range(3):
        assert client.get("/t/api/ticket", headers=hdr(token)).status_code == 200
    after = s4.link_row(t["id"])
    assert after["open_count"] == 3 and after["first_opened_at"] and after["expires_at"] == before["expires_at"], "an open never extends"
    events = [e for e in s4.w.detail(t["id"])["events"] if e["kind"] == "link_opened"]
    assert len(events) == 1 and events[0]["external"] is False
    d = s4.w.detail(t["id"])
    assert d["link"]["open_count"] == 3 and d["link"]["devices"] == 1 and d["link"]["state"] == "live"


def test_a_static_shell_fetch_without_the_token_counts_nothing(s4):
    t, _token = s4.sent()
    client, _ = s4.public(Clock(time.time()))
    assert client.get("/t/").status_code == 200
    assert client.get("/t/api/ticket").content == UNIFORM_404, "no token: the uniform 404, no lookup"
    assert s4.link_row(t["id"])["open_count"] == 0


# ---------------------------------------------------------------- writes


def test_the_handlers_writes_recompute_the_dues_like_every_other_change(s4):
    """Slice 2 computes the SLA dues at every change of a ticket; the handler's writes through the link are changes too."""
    t, token = s4.sent()
    tid = t["id"]

    def dues() -> tuple[str | None, str | None]:
        with s4.db.connection(mode="read") as conn:
            row = conn.execute("SELECT ack_due_at, stuck_due_at FROM tickets WHERE id = ?", (tid,)).fetchone()
        return row[0], row[1]

    ack, stuck = dues()
    assert ack is not None and stuck is None, "assigned outside: the acknowledgement clock runs from the assignment"
    client, _ = s4.public(Clock(time.time()))
    assert client.post("/t/api/status", headers=hdr(token), json={"status": "acknowledged", "client_request_id": crid()}).status_code == 200
    ack, stuck = dues()
    assert ack is None and stuck is not None, "acknowledged: no first-response due, the stuck clock runs"
    assert client.post("/t/api/return", headers=hdr(token), json={"kind": "not_mine", "reason": "לא באזור שלי", "client_request_id": crid()}).status_code == 200
    ack, stuck = dues()
    assert ack is not None and stuck is None, "returned: unassigned again"


def test_status_note_eta_flow_moves_the_ticket_and_extends_the_link(s4):
    t, token = s4.sent()
    tid = t["id"]
    first = s4.link_row(tid)["expires_at"]
    clock = Clock(time.time() + 3 * 86400)  # three days later: an action slides the expiry forward
    client, _ = s4.public(clock)
    r = client.post("/t/api/status", headers=hdr(token), json={"status": "acknowledged", "client_request_id": crid()})
    assert r.status_code == 200 and r.json() == {"ok": True, "status": "acknowledged"}, r.text
    r = client.post("/t/api/status", headers=hdr(token), json={"status": "in_progress", "note": "עובדים על זה", "client_request_id": crid()})
    assert r.status_code == 200, r.text
    r = client.post("/t/api/note", headers=hdr(token), json={"text": "הגעתי, חסר מדחס", "client_request_id": crid()})
    assert r.status_code == 200, r.text
    eta = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(clock() + 2 * 86400))  # in the page's "now" (the shifted clock)
    r = client.post("/t/api/eta", headers=hdr(token), json={"eta_at": eta, "client_request_id": crid()})
    assert r.status_code == 200 and r.json()["eta_at"] == eta, r.text
    d = s4.w.detail(tid)
    assert d["status"] == "in_progress" and d["eta_at"] == eta and d["waiting_on"] == "assignee"
    kinds = [(e["kind"], e["actor"]["kind"], e["via"]) for e in d["events"] if e["actor"]["kind"] == "contact"]
    assert ("status", "contact", "link") in kinds and ("note", "contact", "link") in kinds and ("eta", "contact", "link") in kinds
    row = s4.link_row(tid)
    assert row["update_count"] == 4 and row["expires_at"] > first, "every action slides the expiry"
    with s4.db.connection(mode="read") as conn:
        audits = [dict(a) for a in conn.execute("SELECT * FROM audit_log WHERE actor_username = 'ticket_link' ORDER BY id")]
    assert {a["action"] for a in audits} >= {"ticket.status", "ticket.note", "ticket.eta"}
    assert all(a["actor_user_id"] == f"contact:{s4.contact['id']}" for a in audits)
    assert all("עובדים" not in (a["details_json"] or "") and "מדחס" not in (a["details_json"] or "") for a in audits), "audit = envelope"


def test_the_handler_sets_and_clears_the_part_wait_himself_through_the_status_route(s4):
    """2.5.6: 'waiting for a part' is a sub-state of 'in progress' in the UI; the stored status stays waiting_part and the route is the same."""
    t, token = s4.sent()
    tid = t["id"]
    client, _ = s4.public(Clock(time.time()))
    for to in ("acknowledged", "in_progress"):
        assert client.post("/t/api/status", headers=hdr(token), json={"status": to, "client_request_id": crid()}).status_code == 200
    v = client.get("/t/api/ticket", headers=hdr(token)).json()
    assert v["status"] == "in_progress" and "waiting_part" in v["actions"]["statuses"], "offered from in progress"
    r = client.post("/t/api/status", headers=hdr(token), json={"status": "waiting_part", "client_request_id": crid()})
    assert r.status_code == 200 and r.json() == {"ok": True, "status": "waiting_part"}, r.text
    d = s4.w.detail(tid)
    assert d["status"] == "waiting_part" and d["waiting_on"] == "assignee" and d["waiting_reason"] is None
    v = client.get("/t/api/ticket", headers=hdr(token)).json()
    assert v["status"] == "waiting_part" and "in_progress" in v["actions"]["statuses"], "the way back is offered"
    r = client.post("/t/api/status", headers=hdr(token), json={"status": "in_progress", "client_request_id": crid()})
    assert r.status_code == 200 and s4.w.detail(tid)["status"] == "in_progress"
    kinds = [(e["from"], e["to"]) for e in s4.w.detail(tid)["events"] if e["kind"] == "status" and e["actor"]["kind"] == "contact"]
    assert ("in_progress", "waiting_part") in kinds and ("waiting_part", "in_progress") in kinds


def test_the_status_route_stays_closed_to_other_values_after_the_part_wait_change(s4):
    t, token = s4.sent()
    client, _ = s4.public(Clock(time.time()))
    for bad in ("waiting", "waiting_part ", "WAITING_PART", "returned", "cancelled", "closed", "", None, ["waiting_part"]):
        r = client.post("/t/api/status", headers=hdr(token), json={"status": bad, "client_request_id": crid()})
        assert r.status_code == 422, (bad, r.text)
    r = client.post("/t/api/status", headers=hdr(token), json={"status": "waiting_part", "waiting_reason": "x", "client_request_id": crid()})
    assert r.status_code == 422, "no extra fields"
    r = client.post("/t/api/status", headers=hdr(token), json={"status": "waiting_part", "client_request_id": crid()})
    assert r.status_code == 409 and r.json()["code"] == "invalid_transition", "not from 'assigned': the handler first takes it"
    assert s4.w.detail(t["id"])["status"] == "assigned"


def test_a_move_the_handler_may_not_make_is_409(s4):
    t, token = s4.sent()
    client, _ = s4.public(Clock(time.time()))
    for to in ("done", "waiting_part"):
        r = client.post("/t/api/status", headers=hdr(token), json={"status": to, "client_request_id": crid()})
        assert r.status_code == 409 and r.json()["code"] == "invalid_transition", r.text
    r = client.post("/t/api/status", headers=hdr(token), json={"status": "closed", "client_request_id": crid()})
    assert r.status_code == 422 and r.json()["code"] == "invalid", "closing is the manager's (section 11.2)"
    assert s4.w.detail(t["id"])["status"] == "assigned"


def test_the_write_budget_is_spent_by_stored_effects_only(s4):
    t, token = s4.sent()
    client, app = s4.public(Clock(time.time()))
    spent: list[str] = []
    real = app.gate.spend
    app.gate.spend = lambda kind, key: (spent.append(kind), real(kind, key))[1]  # type: ignore[method-assign]
    rid = crid()
    assert client.post("/t/api/note", headers=hdr(token), json={"text": "א", "client_request_id": rid}).status_code == 200
    assert client.post("/t/api/note", headers=hdr(token), json={"text": "א", "client_request_id": rid}).status_code == 200  # replay
    assert client.post("/t/api/status", headers=hdr(token), json={"status": "done", "client_request_id": crid()}).status_code == 409
    assert client.post("/t/api/note", headers=hdr(token), json={"text": "", "client_request_id": crid()}).status_code == 422
    assert spent == ["token_write"], spent


def test_a_repeated_request_id_replays_and_another_route_is_409(s4):
    t, token = s4.sent()
    client, _ = s4.public(Clock(time.time()))
    rid = crid()
    a = client.post("/t/api/note", headers=hdr(token), json={"text": "פעם אחת", "client_request_id": rid})
    b = client.post("/t/api/note", headers=hdr(token), json={"text": "פעם אחת", "client_request_id": rid})
    assert a.status_code == b.status_code == 200 and a.json() == b.json()
    notes = [e for e in s4.w.detail(t["id"])["events"] if e["kind"] == "note" and e["actor"]["kind"] == "contact"]
    assert len(notes) == 1, "never a second effect"
    r = client.post("/t/api/status", headers=hdr(token), json={"status": "acknowledged", "client_request_id": rid})
    assert r.status_code == 409 and r.json()["code"] == "request_id_reused"


def test_not_mine_returns_the_ticket_and_revokes_the_link_at_once(s4):
    t, token = s4.sent()
    client, _ = s4.public(Clock(time.time()))
    r = client.post("/t/api/return", headers=hdr(token), json={"kind": "not_mine", "reason": "", "client_request_id": crid()})
    assert r.status_code == 422, "a reason is required (D12)"
    r = client.post("/t/api/return", headers=hdr(token), json={"kind": "not_mine", "reason": "זו נזילה, לא מיזוג", "client_request_id": crid()})
    assert r.status_code == 200 and r.json()["status"] == "returned" and r.json()["number"] == t["number"], r.text
    d = s4.w.detail(t["id"])
    assert d["status"] == "returned" and d["waiting_on"] == "manager" and d["waiting_reason"] == "not_mine" and d["assignee"] is None
    assert s4.link_row(t["id"])["revoked_reason"] == "not_mine"
    r = client.get("/t/api/ticket", headers=hdr(token))
    assert r.status_code == 404 and r.content == UNIFORM_404, "the next request is already the uniform 404"


def test_close_gives_a_read_only_grace_then_the_uniform_404(s4):
    t, token = s4.sent()
    tid = t["id"]
    assert s4.w.status("joni", tid, "closed", note="טופל טלפונית").status_code == 200
    now = time.time()
    client, _ = s4.public(Clock(now))
    v = client.get("/t/api/ticket", headers=hdr(token)).json()
    assert v["read_only"] is True and v["status"] == "closed" and v["actions"]["statuses"] == [] and v["actions"]["note"] is False
    r = client.post("/t/api/note", headers=hdr(token), json={"text": "עוד משהו", "client_request_id": crid()})
    assert r.status_code == 409 and r.json()["code"] == "read_only"
    later, _ = s4.public(Clock(now + 25 * 3600))
    assert later.get("/t/api/ticket", headers=hdr(token)).content == UNIFORM_404, "past the 24 h grace (D5)"


def test_reassigning_kills_the_old_link(s4):
    t, token = s4.sent()
    r = s4.assign_contact(t["id"], s4.vendor["id"])
    assert r.status_code == 200, r.text
    client, _ = s4.public(Clock(time.time()))
    assert client.get("/t/api/ticket", headers=hdr(token)).content == UNIFORM_404
    assert client.get("/t/api/ticket", headers=hdr(s4.token_of(t["id"]))).status_code == 200


def test_module_off_answers_the_uniform_404_after_a_refresh(s4):
    _t, token = s4.sent()
    client, app = s4.public(Clock(time.time()))
    assert client.get("/t/api/ticket", headers=hdr(token)).status_code == 200
    assert s4.c.patch(f"{API}/settings", json={"tickets.enabled": "false"}).status_code == 200
    app.deps.switch.refresh()  # the janitor's tick (W3); the settings route of the main app sets RUNTIME.switch when it runs
    assert client.get("/t/api/ticket", headers=hdr(token)).content == UNIFORM_404


# ---------------------------------------------------------------- photos on the real PhotoSink


def test_a_photo_is_reencoded_recorded_and_visible_to_the_manager(s4):
    t, token = s4.sent()
    client, _ = s4.public(Clock(time.time()))
    r = upload(client, token, jpeg())
    assert r.status_code == 201, r.text
    aid = r.json()["id"]
    d = s4.w.detail(t["id"])
    att = [a for a in d["attachments"] if a["id"] == aid]
    assert att and att[0]["external"] is True
    g = s4.c.get(f"{API}/{att[0]['url']}")
    assert g.status_code == 200 and g.headers["content-type"] == "image/jpeg"
    p = client.get(f"/t/api/photo/{aid}", headers=hdr(token))
    assert p.status_code == 200 and p.content[:3] == b"\xff\xd8\xff"


def test_a_repeated_photo_request_id_never_stores_twice(s4):
    t, token = s4.sent()
    client, _ = s4.public(Clock(time.time()))
    rid = crid()
    a = upload(client, token, jpeg(), rid)
    b = upload(client, token, jpeg(), rid)
    assert a.status_code == 201 and b.status_code == 201 and a.json()["id"] == b.json()["id"]
    with s4.db.connection(mode="read") as conn:
        n = conn.execute("SELECT COUNT(*) FROM ticket_attachments WHERE ticket_id = ?", (t["id"],)).fetchone()[0]
        req = conn.execute("SELECT COUNT(*) FROM ticket_requests WHERE client_request_id = ?", (rid,)).fetchone()[0]
    assert n == 1 and req == 1


def test_internal_photos_and_another_tickets_photos_never_open_with_a_token(s4):
    t1, token1 = s4.sent()
    t2, token2 = s4.sent(title="נזילה בשירותים")
    client, _ = s4.public(Clock(time.time()))
    mine = upload(client, token2, jpeg()).json()["id"]
    assert client.get(f"/t/api/photo/{mine}", headers=hdr(token1)).content == UNIFORM_404, "W10: another ticket's photo"
    from conftest import png_bytes

    r = s4.c.post(f"{API}/tickets/{t1['id']}/attachments", files={"file": ("p.png", png_bytes(), "image/png")}, data={"external": "false"})
    assert r.status_code == 201, r.text
    internal = [a for a in r.json()["attachments"] if not a["external"]][0]["id"]
    assert client.get(f"/t/api/photo/{internal}", headers=hdr(token1)).content == UNIFORM_404, "an internal photo"
    v = client.get("/t/api/ticket", headers=hdr(token1)).json()
    assert internal not in [p["id"] for p in v["photos"]]


# ---------------------------------------------------------------- verification codes without a message channel


def test_a_code_protected_assignment_is_refused_while_no_channel_can_carry_the_code(s4):
    t = s4.ticket()
    r = s4.assign_contact(t["id"], require_code=True)
    assert r.status_code == 409 and r.json()["code"] == "code_channel_unavailable", r.text


def test_a_code_protected_link_shows_only_the_minimal_card_and_code_send_is_503(s4):
    t, token = s4.sent()
    with s4.db.connection() as conn:  # a link that needs a code (as slice 7 will mint with a channel)
        conn.execute("UPDATE ticket_links SET require_code = 1 WHERE ticket_id = ?", (t["id"],))
    client, _ = s4.public(Clock(time.time()))
    v = client.get("/t/api/ticket", headers=hdr(token)).json()
    assert v["code_required"] is True and v["code_ok"] is False
    assert "title" not in v and "description" not in v and "timeline" not in v, "nothing beyond 'a ticket exists' (spec 10.5)"
    assert v["code_locked_s"] == 0
    r = client.post("/t/api/note", headers=hdr(token), json={"text": "x", "client_request_id": crid()})
    assert r.status_code == 403 and r.json()["code"] == "code_required"
    r = client.post("/t/api/code/send", headers=hdr(token), json={})
    assert r.status_code == 503 and r.json()["code"] == "code_unavailable", "slice 4 has no channel: nothing is sent"
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_link_codes").fetchone()[0] == 0


def test_a_pre_code_open_of_a_code_protected_link_records_no_open_and_no_device(s4):
    """PUB-02 (public review 2026-10-20): like the RFQ page (review F1), a forwarded code-protected link alone forges no
    "the vendor opened the link" line and no device row - an open counts only past the code gate."""
    t, token = s4.sent()
    with s4.db.connection() as conn:
        conn.execute("UPDATE ticket_links SET require_code = 1 WHERE ticket_id = ?", (t["id"],))
    client, _ = s4.public(Clock(time.time()))
    for _ in range(2):
        v = client.get("/t/api/ticket", headers=hdr(token)).json()
        assert v["code_required"] is True and v["code_ok"] is False
    row = s4.link_row(t["id"])
    assert row["open_count"] == 0 and row["first_opened_at"] is None
    assert [e for e in s4.w.detail(t["id"])["events"] if e["kind"] == "link_opened"] == []
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_link_access").fetchone()[0] == 0


# ---------------------------------------------------------------- hostile inputs


@pytest.mark.parametrize("body", [
    {"text": "x", "client_request_id": "not-a-uuid"},
    {"text": "x"},
    {"text": "x", "client_request_id": "00000000-0000-0000-0000-000000000000", "ticket_id": "t-other"},
    {"text": 5, "client_request_id": "00000000-0000-0000-0000-000000000001"},
    {"text": "א" * 2001, "client_request_id": "00000000-0000-0000-0000-000000000002"},
])
def test_hostile_bodies_are_422_without_echo(s4, body):
    _t, token = s4.sent()
    client, _ = s4.public(Clock(time.time()))
    r = client.post("/t/api/note", headers=hdr(token), json=body)
    assert r.status_code == 422 and r.json()["code"] == "invalid", r.text
    assert "t-other" not in r.text and "input" not in r.text


def test_bidi_and_zero_width_characters_are_stripped_from_a_note(s4):
    t, token = s4.sent()
    client, _ = s4.public(Clock(time.time()))
    r = client.post("/t/api/note", headers=hdr(token), json={"text": "בוצע‮ לא​", "client_request_id": crid()})
    assert r.status_code == 200, r.text
    notes = [e["body"] for e in s4.w.detail(t["id"])["events"] if e["kind"] == "note" and e["actor"]["kind"] == "contact"]
    assert notes == ["בוצע לא"]


def test_a_token_of_another_generation_or_a_mutated_token_is_the_uniform_404(s4):
    t, token = s4.sent()
    client, _ = s4.public(Clock(time.time()))
    mutated = ("A" if token[0] != "A" else "B") + token[1:]
    assert client.get("/t/api/ticket", headers=hdr(mutated)).content == UNIFORM_404
    assert s4.c.post(f"{API}/tickets/{t['id']}/link/new").status_code == 200
    assert client.get("/t/api/ticket", headers=hdr(token)).content == UNIFORM_404, "a new generation kills the old token"
    assert client.get("/t/api/ticket", headers=hdr(s4.token_of(t["id"]))).status_code == 200
    body = json.dumps({"text": "x", "client_request_id": crid()})
    r = client.post("/t/api/note", headers={**hdr(token), "content-type": "application/json"}, content=body)
    assert r.content == UNIFORM_404
