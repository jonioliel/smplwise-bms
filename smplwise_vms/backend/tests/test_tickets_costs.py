"""CR-038 slice 9 - cost claims over the REAL store (section 11A, owner decisions D31 / D32): the per-assignment requirement and its
preselection, the claim at "done", the vendor's submission through the handler link (server computation, client totals refused),
files (photo pages and PDFs, hostile PDFs), the close gate and its override, the reviewer's decisions, claim mode after the page
stops serving (close + grace, cannot-handle return) and never after "לא שלי" / reassignment, the permission matrix (amounts only
with tickets.costs.view, decisions only with tickets.costs), the report per currency, the CSV, the table's cost columns, the
retention janitor and the audit envelope. Every name, number and address here is invented."""
from __future__ import annotations

import datetime as dt
import io
import time
import zlib

import pytest
from conftest import bind
from hygiene import installation_day
from PIL import Image

from smplwise.services.tickets import costs, costs_report, costs_retention
from smplwise.services.tickets.public_http import UNIFORM_404
from smplwise.services.tickets.public_runtime import RUNTIME
from tickets_s4_world import API, Clock, build_s4, crid


@pytest.fixture()
def s4(settings, monkeypatch):
    costs_report.reset_rate()
    return build_s4(settings, monkeypatch)


def hdr(token: str) -> dict[str, str]:
    return {"x-ticket-token": token}


def jpeg(w: int = 900, h: int = 1200, color=(240, 240, 235)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color).save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def pdf(*objects: bytes) -> bytes:
    body = b"%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n"
    for i, obj in enumerate(objects, start=3):
        body += f"{i} 0 obj\n".encode() + obj + b"\nendobj\n"
    return body + b"trailer\n<< /Root 1 0 R >>\nstartxref\n0\n%%EOF\n"


LINES = [{"kind": "labor", "hours": "2", "rate": "150"}, {"kind": "parts", "description": "מדחס", "quantity": "1", "unit_price": "800"},
         {"kind": "travel", "amount": "50"}, {"kind": "other", "description": "פינוי", "amount": "25.50"}]


def done(s4, mode: str | None = "required", clock: Clock | None = None):
    """A ticket sent to the contact with the given requirement, reported done by the vendor; returns (ticket, token, client, clock)."""
    extra = {"cost_claim": mode} if mode else {}
    t, token = s4.sent(**extra)
    clock = clock or Clock(time.time())
    client, _ = s4.public(clock)
    for st in ("acknowledged", "done"):
        r = client.post("/t/api/status", headers=hdr(token), json={"status": st, "client_request_id": crid()})
        assert r.status_code == 200, r.text
    return t, token, client, clock


def submit(client, token, **body):
    payload = {"lines": LINES, "client_request_id": crid(), **body}
    return client.post("/t/api/claim", headers=hdr(token), json=payload)


def costs_of(s4, tid, user="joni"):
    r = s4.c.get(f"{API}/tickets/{tid}/costs", headers=s4.h(user))
    assert r.status_code == 200, r.text
    return r.json()


# ---------------------------------------------------------------- requirement, preselection, claim at done

def test_the_assign_preview_preselects_vendor_then_department_then_installation(s4):
    t = s4.ticket()
    r = s4.c.post(f"{API}/tickets/{t['id']}/assign/preview", json={"contact_id": s4.contact["id"]})
    assert r.status_code == 200, r.text
    assert r.json()["cost_claim"] == {"default": "optional", "from": "installation", "choices": ["required", "optional", "off"]}
    assert s4.c.put(f"{API}/tickets/costs/departments/dept-maintenance", json={"cost_claim": "required", "claim_window_days": 7}).status_code == 200
    with s4.db.connection() as conn:
        assert costs.preselected_mode(conn, contact=s4.contact, vendor=None, department={"cost_claim": "required"}) == ("required", "department")
        assert costs.preselected_mode(conn, contact={"cost_claim": "off"}, vendor=None, department={"cost_claim": "required"}) == ("off", "contact")
        assert costs.preselected_mode(conn, contact={}, vendor={"cost_claim": "optional"}, department={"cost_claim": "required"}) == ("optional", "vendor")


def test_done_by_the_vendor_asks_a_required_claim_and_the_board_shows_awaiting(s4):
    t, _token, _client, clock = done(s4, "required")
    d = s4.w.detail(t["id"])
    assert d["cost"]["status"] == "awaiting" and d["cost"]["can_view"] is True
    c = costs_of(s4, t["id"])["claims"]
    assert len(c) == 1 and c[0]["status"] == "awaiting" and c[0]["required"] is True and c[0]["window_open"] is True
    until = dt.datetime.fromisoformat(c[0]["claim_until"].replace("Z", "+00:00")).timestamp()
    assert abs(until - (clock() + 14 * 86400)) < 5, "the window is 14 days from done (11A.5)"


def test_an_off_assignment_and_an_internal_assignee_never_get_a_claim(s4):
    t, *_ = done(s4, "off")
    assert costs_of(s4, t["id"])["claims"] == [] and s4.w.detail(t["id"])["cost"]["status"] == "not_required"
    t2 = s4.ticket()
    s4.w.member("dept-maintenance", "tom", "member")
    assert s4.w.assign("joni", t2["id"], "tom").status_code == 200
    assert s4.w.status("tom", t2["id"], "acknowledged").status_code == 200
    assert s4.w.status("tom", t2["id"], "done").status_code == 200
    assert costs_of(s4, t2["id"])["claims"] == []


def test_an_optional_claim_does_not_mark_the_ticket_awaiting(s4):
    t, *_ = done(s4, "optional")
    assert s4.w.detail(t["id"])["cost"]["status"] == "not_required"
    assert costs_of(s4, t["id"])["claims"][0]["required"] is False


# ---------------------------------------------------------------- the vendor's submission

def test_the_vendor_submits_and_the_server_computes_every_figure(s4):
    t, token, client, _clock = done(s4)
    form = client.get("/t/api/claim", headers=hdr(token))
    assert form.status_code == 200, form.text
    f = form.json()
    assert f["status"] == "awaiting" and f["writable"] is True and f["form"]["currencies"] == ["ILS"] and f["form"]["vat"]["rate_bp"] == 1800
    r = submit(client, token, amounts_include_vat=False, vendor_ref="INV-1042", notes="הוחלף מדחס")
    assert r.status_code == 201, r.text
    rev = r.json()["revision"]
    assert (rev["subtotal_minor"], rev["vat_minor"], rev["total_minor"], rev["net_minor"]) == (117550, 21159, 138709, 117550)
    assert rev["labor_minor"] == 30000 and rev["vat_mode"] == "excluded" and rev["source"] == "vendor"
    d = s4.w.detail(t["id"])
    assert d["cost"]["status"] == "submitted" and d["cost"]["total_minor"] == 138709 and d["cost"]["currency"] == "ILS"
    ev = [e for e in d["events"] if e["kind"] == "cost_submitted"]
    assert ev and "138709" not in str(ev), "the timeline never carries an amount (members without costs.view read it)"


def test_vat_included_and_a_vat_exempt_vendor(s4):
    t, token, client, _ = done(s4)
    r = submit(client, token, lines=[{"kind": "other", "description": "תיקון", "amount": "118"}], amounts_include_vat=True)
    assert r.status_code == 201, r.text
    rev = r.json()["revision"]
    assert (rev["vat_mode"], rev["total_minor"], rev["vat_minor"], rev["net_minor"]) == ("included", 11800, 1800, 10000)
    rc = s4.contact_rev(s4.contact["id"])
    assert s4.c.patch(f"{API}/tickets/contacts/{s4.contact['id']}", json={"vat_exempt": True, "revision": rc}).status_code == 200
    r = submit(client, token, lines=[{"kind": "other", "description": "תיקון", "amount": "118"}], amounts_include_vat=True)
    assert r.status_code == 201 and r.json()["revision"]["vat_mode"] == "none" and r.json()["revision"]["total_minor"] == 11800


def test_client_totals_and_floats_are_refused(s4):
    _t, token, client, _ = done(s4)
    r = submit(client, token, lines=[{"kind": "travel", "amount": "50", "total": "1"}])
    assert r.status_code == 422 and r.json()["code"] == "invalid"
    r = submit(client, token, lines=[{"kind": "travel", "amount": 50.0}])
    assert r.status_code == 422
    r = submit(client, token, total_minor=1)
    assert r.status_code == 422
    r = submit(client, token, lines=[{"kind": "other", "description": "x", "amount": "999999999"}] * 2)
    assert r.status_code == 422 and r.json()["fields"][0]["code"] == "claim_too_large"


def test_no_charge_is_a_claim_with_zero_lines(s4):
    _t, token, client, _ = done(s4)
    assert submit(client, token, lines=[{"kind": "travel", "amount": "1"}], no_charge=True).status_code == 422
    r = submit(client, token, lines=[], no_charge=True)
    assert r.status_code == 201 and r.json()["revision"]["total_minor"] == 0 and r.json()["revision"]["no_charge"] is True


def test_a_corrected_revision_supersedes_and_revisions_stay_immutable(s4):
    t, token, client, _ = done(s4)
    a = submit(client, token)
    b = submit(client, token, lines=[{"kind": "travel", "amount": "40"}])
    assert a.status_code == b.status_code == 201
    claim = costs_of(s4, t["id"])["claims"][0]
    assert [r["seq"] for r in claim["revisions"]] == [1, 2] and claim["revisions"][0]["total_minor"] == 138709
    assert [d["action"] for d in claim["decisions"]] == ["superseded"]
    assert claim["current_revision_id"] == claim["revisions"][1]["id"] and claim["total_minor"] == 4720


def test_photo_pages_and_a_pdf_become_documents(s4):
    t, token, client, _ = done(s4)
    ids = []
    for color in ((250, 250, 250), (200, 200, 200)):
        r = client.post("/t/api/claim/file", headers=hdr(token), files={"file": ("p.jpg", jpeg(color=color), "image/jpeg")},
                        data={"client_request_id": crid(), "document_key": "doc1", "page_no": str(len(ids) + 1), "name": "חשבונית"})
        assert r.status_code == 201, r.text
        assert r.json()["kind"] == "photo"
        ids.append(r.json()["id"])
    r = client.post("/t/api/claim/file", headers=hdr(token), files={"file": ("a.pdf", pdf(), "application/pdf")}, data={"client_request_id": crid()})
    assert r.status_code == 201 and r.json()["kind"] == "pdf", r.text
    pdf_id = r.json()["id"]
    r = client.post("/t/api/claim/file", headers=hdr(token), files={"file": ("a.pdf", pdf(), "application/pdf")}, data={"client_request_id": crid()})
    assert r.status_code == 409 and r.json()["code"] == "duplicate_file"
    r = submit(client, token, documents=[{"file_ids": ids + [pdf_id]}])
    assert r.status_code == 422 and r.json()["fields"][0]["code"] == "mixed_document"
    r = submit(client, token, documents=[{"file_ids": ids}, {"file_ids": [pdf_id]}])
    assert r.status_code == 201, r.text
    docs = r.json()["revision"]["documents"]
    assert [(d["no"], d["kind"], len(d["pages"])) for d in docs] == [(1, "photo", 2), (2, "pdf", 1)]
    claim = costs_of(s4, t["id"])["claims"][0]
    rev = claim["revisions"][0]
    got = s4.c.get(f"{API}/tickets/{t['id']}/costs/files/{pdf_id}")
    assert got.status_code == 200 and got.headers["content-disposition"].startswith("attachment;")
    assert got.headers["content-security-policy"] == "sandbox" and got.headers["x-content-type-options"] == "nosniff"
    pytest.importorskip("fpdf")  # fpdf2 is in requirements.txt (the add-on image and the runner); a bare dev venv may lack it
    assembled = s4.c.get(f"{API}/tickets/{t['id']}/costs/{claim['id']}/documents/{rev['id']}/1.pdf")
    assert assembled.status_code == 200 and assembled.content.startswith(b"%PDF-") and b"/JavaScript" not in assembled.content
    assert assembled.headers["content-disposition"].startswith("attachment;")


def test_pending_bytes_per_link_are_capped_next_to_the_count(s4, monkeypatch):
    """Deep review A5: the pending quota counts bytes too (64 MiB per link; lowered here to the two files already held)."""
    from smplwise.services.tickets import cost_files

    _t, token, client, _ = done(s4)
    held = 0
    for i in range(2):
        data = pdf(f"<< /Producer (vendor {i}) >>".encode())
        r = client.post("/t/api/claim/file", headers=hdr(token), files={"file": ("a.pdf", data, "application/pdf")}, data={"client_request_id": crid()})
        assert r.status_code == 201, r.text
        held += r.json()["bytes"]
    monkeypatch.setattr(cost_files, "MAX_PENDING_BYTES_PER_LINK", held)
    r = client.post("/t/api/claim/file", headers=hdr(token), files={"file": ("b.pdf", pdf(b"<< /Producer (third) >>"), "application/pdf")},
                    data={"client_request_id": crid()})
    assert r.status_code == 409 and r.json()["code"] == "file_limit", r.text
    monkeypatch.setattr(cost_files, "MAX_PENDING_BYTES_PER_LINK", held + 1)
    r = client.post("/t/api/claim/file", headers=hdr(token), files={"file": ("b.pdf", pdf(b"<< /Producer (third) >>"), "application/pdf")},
                    data={"client_request_id": crid()})
    assert r.status_code == 201, r.text


def test_hostile_pdfs_are_refused_on_the_public_route(s4):
    _t, token, client, _ = done(s4)
    hidden = zlib.compress(b"<< /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>")
    bad = pdf(b"<< /Filter /FlateDecode /Length " + str(len(hidden)).encode() + b" >>\nstream\n" + hidden + b"\nendstream")
    for data, code in ((bad, "pdf_refused"), (pdf(b"<< /Encrypt 5 0 R >>"), "pdf_refused"), (b"%PDF-1.7\nno trailer", "pdf_invalid"),
                       (b"<html>x</html>", "unsupported_format")):
        r = client.post("/t/api/claim/file", headers=hdr(token), files={"file": ("x.pdf", data, "application/pdf")}, data={"client_request_id": crid()})
        assert r.status_code in (415, 422) and r.json()["code"] == code, (code, r.text)


def test_the_claim_route_is_idempotent(s4):
    t, token, client, _ = done(s4)
    rid = crid()
    a = submit(client, token, client_request_id=rid)
    b = submit(client, token, client_request_id=rid)
    assert a.status_code == b.status_code == 201 and a.json() == b.json()
    assert len(costs_of(s4, t["id"])["claims"][0]["revisions"]) == 1


# ---------------------------------------------------------------- decisions

def _claim(s4, tid):
    return costs_of(s4, tid)["claims"][0]


def decide(s4, tid, action, user="joni", **body):
    c = _claim(s4, tid)
    payload = {"revision": c["revision"], **body}
    if action in ("approve", "adjust", "reject"):
        payload.setdefault("revision_id", c["current_revision_id"])
    return s4.c.post(f"{API}/tickets/{tid}/costs/{c['id']}/{action}", json=payload, headers=s4.h(user))


def test_approve_mark_paid_unmark_and_the_payment_hook(s4):
    t, token, client, _ = done(s4)
    assert submit(client, token).status_code == 201
    events: list[tuple[str, str]] = []
    costs.SUBSCRIBERS.append(lambda kind, claim: events.append((kind, claim["status"])))
    try:
        assert decide(s4, t["id"], "approve").status_code == 200
        c = _claim(s4, t["id"])
        assert c["status"] == "approved" and c["approved_total_minor"] == 138709 and c["high_amount"] is False
        assert s4.w.detail(t["id"])["cost"]["status"] == "approved"
        r = decide(s4, t["id"], "mark-paid", payment_ref="העברה 7781", payment_date=installation_day())
        assert r.status_code == 200 and _claim(s4, t["id"])["status"] == "paid"
        assert decide(s4, t["id"], "unmark-paid").status_code == 422, "a reason is required"
        assert decide(s4, t["id"], "unmark-paid", reason="סומן בטעות").status_code == 200
    finally:
        costs.SUBSCRIBERS.clear()
    assert events == [("approved", "approved"), ("paid", "paid"), ("unpaid", "approved")]
    assert submit(client, token).json()["code"] in ("claim_closed", "claim_window_closed")


def test_adjust_creates_a_manager_revision_with_a_reason_and_the_vendor_sees_it(s4):
    t, token, client, _ = done(s4)
    assert submit(client, token, vendor_ref="INV-9").status_code == 201
    assert decide(s4, t["id"], "adjust", lines=[{"kind": "travel", "amount": "50"}]).status_code == 422, "the reason is mandatory"
    r = decide(s4, t["id"], "adjust", lines=[{"kind": "labor", "hours": "2", "rate": "150"}], reason="המחיר המוסכם לחלק אחר")
    assert r.status_code == 200, r.text
    c = _claim(s4, t["id"])
    adj = c["revisions"][-1]
    assert adj["source"] == "manager" and adj["kind"] == "adjustment" and adj["based_on"] == c["revisions"][0]["id"]
    assert adj["vat_mode"] == c["revisions"][0]["vat_mode"] and c["approved_total_minor"] == 35400 and c["status"] == "approved"
    v = client.get("/t/api/claim", headers=hdr(token)).json()
    assert v["approved"] == {"total_minor": 35400, "currency": "ILS", "adjusted": True, "reason": "המחיר המוסכם לחלק אחר"}
    assert all(r["source"] == "vendor" for r in v["revisions"]), "the vendor sees its own revisions"
    assert "joni" not in str(v) and "by" not in v


def test_reject_restarts_the_window_and_the_vendor_resubmits(s4):
    t, token, client, clock = done(s4)
    assert submit(client, token).status_code == 201
    assert decide(s4, t["id"], "reject").status_code == 422
    assert decide(s4, t["id"], "reject", reason="חסרה חשבונית").status_code == 200
    v = client.get("/t/api/claim", headers=hdr(token)).json()
    assert v["status"] == "rejected" and v["rejection_reason"] == "חסרה חשבונית" and v["writable"] is True
    assert s4.w.detail(t["id"])["cost"]["status"] == "rejected"
    assert submit(client, token).status_code == 201
    assert _claim(s4, t["id"])["status"] == "submitted"


def test_a_stale_decision_is_409(s4):
    t, token, client, _ = done(s4)
    assert submit(client, token).status_code == 201
    c = _claim(s4, t["id"])
    assert submit(client, token, lines=[{"kind": "travel", "amount": "40"}]).status_code == 201
    r = s4.c.post(f"{API}/tickets/{t['id']}/costs/{c['id']}/approve", json={"revision": c["revision"], "revision_id": c["current_revision_id"]})
    assert r.status_code == 409 and r.json()["code"] == "claim_stale"


def test_high_amount_flag(s4):
    t, token, client, _ = done(s4)
    assert submit(client, token, lines=[{"kind": "other", "description": "החלפת יחידה", "amount": "20000"}]).status_code == 201
    assert _claim(s4, t["id"])["high_amount"] is True


# ---------------------------------------------------------------- the close gate

def test_a_required_claim_blocks_close_until_approved_or_overridden(s4):
    t, token, client, _ = done(s4)
    r = s4.w.status("joni", t["id"], "closed")
    assert r.status_code == 409 and r.json()["code"] == "cost_claim_pending" and r.json()["details"]["can_override"] is True
    r = s4.w.status("joni", t["id"], "closed", override_claim_reason="עבודה במסגרת אחריות, הספק אישר בטלפון")
    assert r.status_code == 200, r.text
    with s4.db.connection(mode="read") as conn:
        a = conn.execute("SELECT * FROM audit_log WHERE action = 'ticket.close.override_claim' AND decision = 'allowed'").fetchall()
    assert len(a) == 1 and "אחריות" not in (a[0]["details_json"] or "")
    assert "override_close" in [d["action"] for d in _claim(s4, t["id"])["decisions"]]


def test_the_override_needs_the_costs_permission(s4):
    t, token, client, _ = done(s4)
    r = s4.w.status("mona", t["id"], "closed", override_claim_reason="בלי")
    assert r.status_code == 403, r.text
    r = s4.w.status("mona", t["id"], "closed")
    assert r.status_code == 409 and r.json()["details"]["can_override"] is False


def test_an_optional_or_approved_claim_never_blocks(s4):
    t, *_ = done(s4, "optional")
    assert s4.w.status("joni", t["id"], "closed").status_code == 200
    t2, token, client, _ = done(s4)
    assert submit(client, token).status_code == 201 and decide(s4, t2["id"], "approve").status_code == 200
    assert s4.w.status("joni", t2["id"], "closed").status_code == 200
    with s4.db.connection(mode="read") as conn:
        assert costs.blocks_close(conn, t2["id"]) is False


# ---------------------------------------------------------------- claim mode (11A.5)

def test_claim_mode_after_close_and_past_the_grace(s4):
    t, token, client, clock = done(s4)
    assert s4.w.status("joni", t["id"], "closed", override_claim_reason="נסגר, הדרישה תוגש").status_code == 200
    later, _ = s4.public(Clock(clock() + 3 * 86400))
    v = later.get("/t/api/ticket", headers=hdr(token))
    assert v.status_code == 200 and v.json()["claim_mode"] is True and v.json()["claim"]["writable"] is True, v.text
    assert "timeline" not in v.json(), "claim mode shows the minimal card only"
    r = later.post("/t/api/note", headers=hdr(token), json={"text": "x", "client_request_id": crid()})
    assert r.status_code == 404 and r.content == UNIFORM_404, "every other route stays dead"
    assert submit(later, token).status_code == 201
    gone, _ = s4.public(Clock(clock() + 15 * 86400))
    assert gone.get("/t/api/claim", headers=hdr(token)).content == UNIFORM_404, "past claim_until"


def test_cannot_handle_opens_an_optional_claim_not_mine_never(s4):
    t, token = s4.sent(cost_claim="required")
    client, _ = s4.public(Clock(time.time()))
    r = client.post("/t/api/return", headers=hdr(token), json={"kind": "cannot_handle", "reason": "חסר חלק במלאי", "client_request_id": crid()})
    assert r.status_code == 200, r.text
    c = _claim(s4, t["id"])
    assert c["required"] is False and c["status"] == "awaiting"
    v = client.get("/t/api/ticket", headers=hdr(token)).json()
    assert v["claim_mode"] is True
    assert submit(client, token, lines=[{"kind": "travel", "amount": "120"}]).status_code == 201
    t2, token2 = s4.sent(cost_claim="required")
    r = client.post("/t/api/return", headers=hdr(token2), json={"kind": "not_mine", "reason": "לא שלנו", "client_request_id": crid()})
    assert r.status_code == 200
    assert costs_of(s4, t2["id"])["claims"] == []
    assert client.get("/t/api/claim", headers=hdr(token2)).content == UNIFORM_404


def test_reassigning_after_done_never_opens_claim_mode(s4):
    t, token, client, _ = done(s4)
    assert s4.assign_contact(t["id"], s4.vendor["id"]).status_code == 200
    assert client.get("/t/api/claim", headers=hdr(token)).content == UNIFORM_404
    assert client.get("/t/api/ticket", headers=hdr(token)).content == UNIFORM_404


def test_window_passing_raises_claim_missing_once_and_reopen_works_once(s4):
    t, token, client, clock = done(s4)
    future = dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=15)
    with s4.db.connection() as conn:
        assert costs.tick(conn, future) == 1
        assert costs.tick(conn, future) == 0
    d = s4.w.detail(t["id"])
    assert d["waiting_on"] == "manager" and d["waiting_reason"] == "claim_missing"
    with s4.db.connection() as conn:  # the window's end, as the janitor will have seen it
        conn.execute("UPDATE ticket_cost_claims SET claim_until = '2000-01-01T00:00:00Z'")
    assert decide(s4, t["id"], "reopen-window").status_code == 200
    assert decide(s4, t["id"], "reopen-window").json()["code"] in ("window_still_open", "already_reopened")
    assert s4.w.detail(t["id"])["waiting_reason"] != "claim_missing"


# ---------------------------------------------------------------- permissions (11A.8)

def test_without_costs_view_only_the_status_chip(s4):
    t, token, client, _ = done(s4)
    assert submit(client, token).status_code == 201
    d = s4.w.detail(t["id"], user="mona")
    assert d["cost"] == {"status": "submitted", "can_view": False}
    c = s4.c.get(f"{API}/tickets/{t['id']}/costs", headers=s4.h("mona")).json()["claims"][0]
    assert set(c) == {"id", "assignment_id", "status", "required", "claim_until", "window_open", "missing"}
    r = decide(s4, t["id"], "approve", user="mona")
    assert r.status_code == 403
    r = s4.c.get(f"{API}/tickets/costs/report", headers=s4.h("mona"))
    assert r.status_code == 403


def test_costs_view_without_costs_cannot_decide(s4):
    t, token, client, _ = done(s4)
    assert submit(client, token).status_code == 201
    bind(s4.c, s4.w.settings, "mona", "tickets_costs_view", "installation", "*")
    c = s4.c.get(f"{API}/tickets/{t['id']}/costs", headers=s4.h("mona")).json()
    assert c["claims"][0]["total_minor"] == 138709 and c["cost"]["can_decide"] is False
    assert decide(s4, t["id"], "approve", user="mona").status_code == 403
    bind(s4.c, s4.w.settings, "mona", "tickets_costs", "installation", "*")
    assert decide(s4, t["id"], "approve", user="mona").status_code == 200


def test_on_behalf_entry_with_a_paper_invoice(s4):
    t, *_ = done(s4)
    r = s4.c.post(f"{API}/tickets/{t['id']}/costs/files", files={"file": ("scan.jpg", jpeg(), "image/jpeg")})
    assert r.status_code == 201, r.text
    fid = r.json()["id"]
    r = s4.c.post(f"{API}/tickets/{t['id']}/costs", json={"lines": [{"kind": "other", "description": "חשבונית נייר", "amount": "300"}],
                                                          "amounts_include_vat": True, "documents": [{"file_ids": [fid]}]})
    assert r.status_code == 201, r.text
    rev = r.json()["claims"][0]["revisions"][0]
    assert rev["source"] == "manager" and rev["kind"] == "on_behalf" and rev["total_minor"] == 30000
    r = s4.c.post(f"{API}/tickets/{t['id']}/costs/files", headers=s4.h("mona"), files={"file": ("scan.jpg", jpeg(), "image/jpeg")})
    assert r.status_code == 403


def test_requirement_change_while_nothing_was_submitted(s4):
    t, token, client, _ = done(s4, "optional")
    asg = s4.w.detail(t["id"])["assignments"][-1]["id"]
    r = s4.c.post(f"{API}/tickets/{t['id']}/costs/requirement", json={"assignment_id": asg, "mode": "required"})
    assert r.status_code == 200 and r.json()["claims"][0]["required"] is True
    assert s4.w.detail(t["id"])["cost"]["status"] == "awaiting"
    assert submit(client, token).status_code == 201
    r = s4.c.post(f"{API}/tickets/{t['id']}/costs/requirement", json={"assignment_id": asg, "mode": "off"})
    assert r.status_code == 409 and r.json()["code"] == "claim_already_submitted"


# ---------------------------------------------------------------- report, CSV, table

def test_the_report_sums_per_currency_and_the_csv_is_guarded(s4):
    r = s4.c.get(f"{API}/tickets/settings")
    assert s4.c.put(f"{API}/tickets/settings", json={"revision": r.json()["revision"], "costs": {"currencies": ["ILS", "USD"]}}).status_code == 200
    t1, k1, c1, _ = done(s4)
    t2, k2, c2, _ = done(s4)
    assert submit(c1, k1).status_code == 201
    assert submit(c2, k2, currency="USD", lines=[{"kind": "other", "description": "=HYPERLINK(\"x\")", "amount": "10"}]).status_code == 201
    assert decide(s4, t1["id"], "approve").status_code == 200
    rep = s4.c.get(f"{API}/tickets/costs/report?group_by=department").json()
    tot = {x["currency"]: x for x in rep["totals"]}
    assert tot["ILS"]["approved_minor"] == 138709 and tot["ILS"]["pending_minor"] == 0
    assert tot["USD"]["pending_minor"] == 1180 and tot["USD"]["approved_minor"] == 0, "never summed across currencies"
    csv = s4.c.get(f"{API}/tickets/costs/export.csv?rows=line")
    assert csv.status_code == 200 and csv.content.startswith("﻿".encode())
    body = csv.content.decode("utf-8")
    assert "'=HYPERLINK" in body and "050-000" not in body
    assert s4.c.get(f"{API}/tickets/costs/export.csv").status_code == 429, "one export a minute"
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'ticket.costs.export'").fetchone()[0] == 1


def test_the_table_cost_column_and_sort_need_costs_view(s4):
    t, token, client, _ = done(s4)
    assert submit(client, token).status_code == 201
    r = s4.c.get(f"{API}/tickets/table?sort=cost:desc&status=all")
    assert r.status_code == 200, r.text
    row = next(i for i in r.json()["items"] if i["id"] == t["id"])
    assert row["cost"]["total_minor"] == 138709 and row["cost_status"] == "submitted"
    assert s4.c.get(f"{API}/tickets/table?sort=cost:desc", headers=s4.h("mona")).status_code == 403
    rows = s4.c.get(f"{API}/tickets/table?status=all", headers=s4.h("mona")).json()["items"]
    mine = next(i for i in rows if i["id"] == t["id"])
    assert mine["cost"] is None and mine["cost_status"] is None


# ---------------------------------------------------------------- retention

def test_pending_files_and_purged_claims_leave_with_their_files(s4):
    t, token, client, _ = done(s4)
    r = client.post("/t/api/claim/file", headers=hdr(token), files={"file": ("p.jpg", jpeg(), "image/jpeg")}, data={"client_request_id": crid()})
    assert r.status_code == 201
    root = RUNTIME.attachments_root()
    with s4.db.connection(mode="read") as conn:
        path = conn.execute("SELECT path FROM ticket_cost_files").fetchone()["path"]
    assert (root / path).is_file()
    out = costs_retention.janitor(s4.db, root, force=True, now=dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=25))
    assert out["pending_files"] == 1 and not (root / path).exists()
    assert submit(client, token).status_code == 201 and decide(s4, t["id"], "approve").status_code == 200
    with s4.db.connection(mode="read") as conn:
        purge = conn.execute("SELECT purge_after FROM ticket_cost_claims").fetchone()["purge_after"]
    years = (dt.datetime.fromisoformat(purge.replace("Z", "+00:00")) - dt.datetime.now(dt.timezone.utc)).days / 365
    assert 6.9 < years < 7.1, "7 years (D32)"
    out = costs_retention.janitor(s4.db, root, force=True, now=dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=2556))
    assert out["claims"] == 1
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_cost_revisions").fetchone()[0] == 0


def test_audit_rows_carry_ids_and_totals_never_descriptions(s4):
    t, token, client, _ = done(s4)
    assert submit(client, token, notes="סוד מסחרי", vendor_ref="INV-SECRET").status_code == 201
    assert decide(s4, t["id"], "approve").status_code == 200
    with s4.db.connection(mode="read") as conn:
        rows = [r["details_json"] or "" for r in conn.execute("SELECT details_json FROM audit_log WHERE action LIKE 'ticket.cost.%'")]
    assert rows and not any("סוד" in r or "INV-SECRET" in r or "מדחס" in r for r in rows)


# ---------------------------------------------------------------- CR-018 sources (slice 9b, 11A.7)

def _notes(s4, source: str) -> list[dict]:
    with s4.db.connection() as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM notifications WHERE source = ? ORDER BY created_at, id", (source,)).fetchall()]
        for r in rows:
            r["to"] = sorted(x[0] for x in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ?", (r["id"],)).fetchall())
        return rows


def test_cost_submitted_and_cost_missing_notify_managers_with_costs_view_without_amounts(s4):
    t, token, client, _ = done(s4)
    future = dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=15)
    with s4.db.connection() as conn:
        assert costs.tick(conn, future) == 1
    missing = _notes(s4, "ticket.cost_missing")
    assert len(missing) == 1 and missing[0]["state"] != "resolved" and missing[0]["severity"] == "alert"
    assert "mona" not in str(missing[0]["to"])
    with s4.db.connection() as conn:
        conn.execute("UPDATE ticket_cost_claims SET claim_until = '2000-01-01T00:00:00Z'")
    assert decide(s4, t["id"], "reopen-window").status_code == 200
    assert submit(client, token).status_code == 201
    sub = _notes(s4, "ticket.cost_submitted")
    assert len(sub) == 1 and sub[0]["severity"] == "info" and sub[0]["state"] != "resolved"
    assert "138709" not in str(sub) and "1387" not in str(sub), "no amount in a notification"
    assert _notes(s4, "ticket.cost_missing")[0]["state"] == "resolved", "a submission ends the 'not submitted' row"
    assert decide(s4, t["id"], "approve").status_code == 200
    assert _notes(s4, "ticket.cost_submitted")[0]["state"] == "resolved", "the decision ends the review row"
