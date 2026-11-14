"""RFQATT - files and pictures on a request for quotation (docs/tickets/RFQ_BACKEND_CONTRACT.md section 19; owner 17.10), over the
REAL store, the real manager API and the real public listener app. Negative cases first: who may attach (an audited 403 for a member,
the uniform 404 for an outsider), the type / size / count / total limits, a mismatched declared type, path traversal in the file name,
the state lock; on the public side the uniform 404 for another request's file, an internal-only file, a removed vendor, a token of the
other domain, a closed or deleted request; a code-protected link without its session. Then: audit and timeline rows carry ids only,
no file name reaches a log, deletion (a draft's file is deleted, a file vendors priced against is only marked), the work order's
reference copy (the vendor keeps the files on the service request's handler page), the invitation says "N files" and never a name.
Every name and number here is invented (the 050-000-xxxx block, example.test hosts)."""
from __future__ import annotations

import io
import json
import logging
import time

import pytest
from conftest import bind
from PIL import Image

from smplwise.services.tickets import rfq_files, store_rfq
from smplwise.services.tickets.public_http import UNIFORM_404
from test_tickets_cost_files import pdf
from test_tickets_rfq_files import office
from test_tickets_rfq_public import QUOTE, _at, add_vendor, detail, hdr, pub, quote, s4, token, view, vid  # noqa: F401
from tickets_s4_world import API, Clock, crid

DAY = 86400.0
SECRET_NAME = "secret-plan-of-the-vault.pdf"


def jpeg(w: int = 640, h: int = 480) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (90, 160, 40)).save(buf, "JPEG", quality=85)
    return buf.getvalue()


def draft(s4, vendors: list[dict] | None = None, **body) -> dict:
    vendors = vendors if vendors is not None else [{"contact_id": s4.vendor["id"]}, {"contact_id": s4.contact["id"]}]
    payload = {"department_id": "dept-maintenance", "title": "שיפוץ לובי", "description": "ריצוף וצבע", "due_at": _at(3),
               "work_from": _at(5), "work_to": _at(10), "vendors": vendors, "client_request_id": crid(), **body}
    r = s4.c.post(f"{API}/tickets/rfqs", json=payload, headers=s4.h("mona"))
    assert r.status_code == 201, r.text
    return r.json()


def allow_office(s4, on: bool = True) -> None:
    """The installation switch `rfq.attachments.allow_office` (system.configure; the fixture's default caller is an administrator)."""
    rev = s4.c.get(f"{API}/tickets/settings").json()["revision"]
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "rfq": {"attachments": {"allow_office": on}}})
    assert r.status_code == 200 and r.json()["rfq"]["attachments"]["allow_office"] is on, r.text


def attach(s4, rid: str, data: bytes, name: str = "plan.pdf", mime: str = "application/pdf", user: str = "mona", **form):
    return s4.c.post(f"{API}/tickets/rfqs/{rid}/attachments", files={"file": (name, data, mime)}, data={k: str(v) for k, v in form.items()},
                     headers=s4.h(user))


def attached(s4, rid: str, data: bytes, name: str = "plan.pdf", mime: str = "application/pdf", **form) -> dict:
    r = attach(s4, rid, data, name, mime, **form)
    assert r.status_code == 201, r.text
    return r.json()["attachment"]


def send(s4, rid: str) -> dict:
    d = detail(s4, rid)
    r = s4.c.post(f"{API}/tickets/rfqs/{rid}/send", json={"revision": d["revision"], "channel": "auto", "client_request_id": crid()},
                  headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    return detail(s4, rid)


def audits(s4, prefix: str = "ticket.rfq.attachment") -> list[dict]:
    with s4.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT action, decision, reason, details_json FROM audit_log WHERE action LIKE ? ORDER BY rowid",
                                              (prefix + "%",))]


def files_on_disk(s4) -> list:
    root = s4.w.settings.data_dir / "tickets"
    return sorted(p for p in root.rglob("*") if p.is_file() and "/rfq/" in p.as_posix())


# ---------------------------------------------------------------- refusals first: who, what, how much

def test_only_an_rfq_manager_may_attach_others_get_an_audited_403_or_the_uniform_404(s4, settings):
    d = draft(s4)
    r = attach(s4, d["id"], pdf(), user="tom")  # a plain member of the department: sees the request, is not its manager
    assert r.status_code == 403 and r.json()["details"]["reason"] == "not_manager", r.text
    r = attach(s4, d["id"], pdf(), user="nora")  # no membership at all: the request does not exist for her
    assert r.status_code == 404 and r.json()["code"] == "rfq_not_found"
    r = attach(s4, "no-such-request", pdf())
    assert r.status_code == 404 and r.json()["code"] == "rfq_not_found"
    assert [a["decision"] for a in audits(s4)] == ["denied"], "the role refusal is audited"
    assert files_on_disk(s4) == [], "nothing was decoded or written for a refused caller"
    # a member also cannot change or remove, nor see another request's file through this request
    a = attached(s4, d["id"], pdf())
    other = draft(s4)
    assert s4.c.get(f"{API}/tickets/rfqs/{other['id']}/attachments/{a['id']}", headers=s4.h("mona")).status_code == 404
    assert s4.c.patch(f"{API}/tickets/rfqs/{d['id']}/attachments/{a['id']}", json={"caption": "x"}, headers=s4.h("tom")).status_code == 403
    assert s4.c.delete(f"{API}/tickets/rfqs/{d['id']}/attachments/{a['id']}", headers=s4.h("tom")).status_code == 403
    # but every viewer of the request may read its files
    assert s4.c.get(f"{API}/tickets/rfqs/{d['id']}/attachments/{a['id']}", headers=s4.h("tom")).status_code == 200


def test_types_sizes_and_mismatched_declared_types(s4):
    d = draft(s4)
    rid = d["id"]
    for data, name, mime, code, status in [
        (b"<script>alert(1)</script>", "photo.jpg", "image/jpeg", "unsupported_format", 415),
        (b"MZ\x90\x00" + b"\x00" * 100, "spec.pdf", "application/pdf", "unsupported_format", 415),
        (b"GIF89a" + b"\x00" * 100, "a.gif", "image/gif", "unsupported_format", 415),
        (pdf(b"1 0 obj << /OpenAction 2 0 R /JS (app.alert(1)) >> endobj"), "x.pdf", "application/pdf", "pdf_refused", 422),
        (office(), "spec.docx", "application/octet-stream", "office_disabled", 422),  # Word / Excel are OFF by default
        (b"%PDF-1.7\n" + b"\x00" * (rfq_files.DOCUMENT_MAX_BYTES + 10), "big.pdf", "application/pdf", "payload_too_large", 413),
        (b"\xff\xd8\xff" + b"\x00" * (rfq_files.IMAGE_MAX_BYTES + 10), "big.jpg", "image/jpeg", "payload_too_large", 413),
    ]:
        r = attach(s4, rid, data, name, mime)
        assert (r.status_code, r.json()["code"]) == (status, code), (name, r.text)
        assert "alert" not in r.text and name not in r.text, "a refusal never echoes the content or the name"
    assert detail(s4, rid)["attachments"] == [] and files_on_disk(s4) == []
    allow_office(s4)
    r = attach(s4, rid, office(extra={"word/vbaProject.bin": b"\xd0\xcf"}), "macro.docx", "application/octet-stream")
    assert (r.status_code, r.json()["code"]) == (422, "office_refused") and files_on_disk(s4) == []
    # a picture declared as a PDF is a picture: re-encoded and named .jpg
    a = attached(s4, rid, jpeg(), "drawing.pdf", "application/pdf")
    assert (a["kind"], a["name"], a["mime"], a["thumb"]) == ("image", "drawing.jpg", "image/jpeg", True)
    # a document called .jpg is still the document it is
    b = attached(s4, rid, office(kind="xlsx"), "boq.jpg", "image/jpeg")
    assert (b["kind"], b["name"]) == ("xlsx", "boq.xlsx") and b["thumb"] is False


def test_count_and_total_limits_are_enforced_on_the_server(s4, monkeypatch):
    d = draft(s4)
    monkeypatch.setattr(rfq_files, "MAX_FILES", 2)
    attached(s4, d["id"], pdf())
    attached(s4, d["id"], jpeg(), "a.jpg", "image/jpeg")
    r = attach(s4, d["id"], pdf())
    assert r.status_code == 409 and r.json()["code"] == "attachment_limit" and r.json()["details"]["max_files"] == 2
    monkeypatch.setattr(rfq_files, "MAX_FILES", 10)
    used = sum(a["bytes"] for a in detail(s4, d["id"])["attachments"])
    monkeypatch.setattr(rfq_files, "TOTAL_MAX_BYTES", used + 10)
    r = attach(s4, d["id"], pdf())
    assert r.status_code == 413 and r.json()["code"] == "attachment_total"
    assert len(detail(s4, d["id"])["attachments"]) == 2 and len(files_on_disk(s4)) == 3  # 1 PDF + a picture and its thumbnail


def test_path_traversal_and_control_characters_in_the_name_never_reach_the_disk(s4):
    d = draft(s4)
    a = attached(s4, d["id"], pdf(), "../../../../etc/passwd‮.pdf")
    assert a["name"] == "passwd.pdf"
    with s4.db.connection(mode="read") as conn:
        row = store_rfq.attachment(conn, d["id"], a["id"])
    assert row["path"].startswith(f"{d['id']}/rfq/") and "passwd" not in row["path"] and ".." not in row["path"]
    r = attach(s4, d["id"], pdf(), "x.pdf", caption="x" * 300)
    assert r.status_code == 422 and r.json()["details"]["fields"][0]["field"] == "caption"
    r = attach(s4, d["id"], pdf(), "x.pdf", visible_vendors="maybe")
    assert r.status_code == 422


def test_files_are_locked_after_the_award_or_cancel(s4, settings):
    bind(s4.c, settings, "kim", "system_admin", "installation", "*")
    d = draft(s4)
    a = attached(s4, d["id"], pdf())
    d = send(s4, d["id"])
    v = vid(d, s4.vendor["id"])
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{v}/quotes", json={"lines": QUOTE}, headers=s4.h("joni"))
    assert r.status_code == 201, r.text
    cmp = s4.c.get(f"{API}/tickets/rfqs/{d['id']}/comparison", headers=s4.h("joni")).json()
    q = next(x for x in cmp["quotes"] if x["vendor_id"] == v)
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards", json={"quote_id": q["quote_id"], "revision": q["revision"]}, headers=s4.h("kim"))
    assert r.status_code == 201, r.text
    assert detail(s4, d["id"], "mona")["can"]["attach"] is False
    for r in (attach(s4, d["id"], pdf()), s4.c.patch(f"{API}/tickets/rfqs/{d['id']}/attachments/{a['id']}", json={"visible_vendors": False},
                                                     headers=s4.h("mona")),
              s4.c.delete(f"{API}/tickets/rfqs/{d['id']}/attachments/{a['id']}", headers=s4.h("mona"))):
        assert r.status_code == 409 and r.json()["code"] == "attachment_locked", r.text


# ---------------------------------------------------------------- the vendor side: uniform 404 first

def test_vendors_see_only_live_vendor_visible_files_of_their_own_request(s4):
    d = draft(s4)
    pub_file = attached(s4, d["id"], pdf(), "spec.pdf", caption="מפרט טכני")
    internal = attached(s4, d["id"], pdf(), "budget.pdf", visible_vendors="false")
    pic = attached(s4, d["id"], jpeg(), "site.jpg", "image/jpeg")
    other = draft(s4)
    foreign = attached(s4, other["id"], pdf(), "other.pdf")
    send(s4, other["id"])
    d = send(s4, d["id"])
    tok = token(s4, vid(d, s4.vendor["id"]))
    c = pub(s4)
    v = view(c, tok)
    assert [f["id"] for f in v["rfq"]["attachments"]] == [pub_file["id"], pic["id"]]
    shown = v["rfq"]["attachments"][0]
    assert set(shown) == {"id", "name", "caption", "kind", "bytes", "width", "height", "thumb"} and shown["caption"] == "מפרט טכני"
    assert "budget" not in json.dumps(v), "an internal-only file is never listed"
    ok = c.get(f"/t/api/rfq/file/{pub_file['id']}", headers=hdr(tok))
    assert ok.status_code == 200 and ok.headers["content-type"] == "application/pdf" and ok.content.startswith(b"%PDF-")
    assert ok.headers["content-disposition"].startswith("attachment;") and ok.headers["x-content-type-options"] == "nosniff"
    assert "no-store" in ok.headers["cache-control"] and "default-src 'none'" in ok.headers["content-security-policy"]
    img = c.get(f"/t/api/rfq/file/{pic['id']}", headers=hdr(tok))
    th = c.get(f"/t/api/rfq/file/{pic['id']}/thumb", headers=hdr(tok))
    assert img.status_code == th.status_code == 200 and img.headers["content-type"] == th.headers["content-type"] == "image/jpeg"
    assert img.headers["content-disposition"].startswith("inline;") and len(th.content) < len(img.content)
    _t, ticket_tok = s4.sent()
    misses = [c.get(f"/t/api/rfq/file/{internal['id']}", headers=hdr(tok)),  # internal-only
              c.get(f"/t/api/rfq/file/{foreign['id']}", headers=hdr(tok)),  # another request's file
              c.get(f"/t/api/rfq/file/{pub_file['id']}/thumb", headers=hdr(tok)),  # a document has no thumbnail
              c.get(f"/t/api/rfq/file/no-such-file", headers=hdr(tok)),
              c.get(f"/t/api/rfq/file/{pub_file['id']}", headers=hdr("A" * 43)),  # an unknown token
              c.get(f"/t/api/rfq/file/{pub_file['id']}", headers=hdr(ticket_tok)),  # a ticket token (the other domain)
              c.get(f"/t/api/rfq/file/{pub_file['id']}"),  # no token
              c.get(f"/t/api/ticket/rfq-file/{pub_file['id']}", headers=hdr(ticket_tok)),  # not referenced by that ticket
              c.get(f"/t/api/ticket/rfq-file/{pub_file['id']}", headers=hdr(tok)),  # an RFQ token on the ticket route
              c.get(f"/t/api/rfq/file/..%2F..%2Fetc%2Fpasswd", headers=hdr(tok)),
              c.get("/t/api/rfq/files", headers=hdr(tok))]  # no list route exists
    assert [m.status_code for m in misses] == [404] * len(misses), [m.status_code for m in misses]
    assert {m.content for m in misses} == {UNIFORM_404}, "byte-identical: nothing tells a hidden file from an unknown one"


def test_a_removed_vendor_a_closed_request_and_a_deleted_request_lose_access(s4, settings):
    third = add_vendor(s4, "צבעי השרון", "050-000-0077")
    d = draft(s4, vendors=[{"contact_id": s4.vendor["id"]}, {"contact_id": s4.contact["id"]}, {"contact_id": third["id"]}])
    a = attached(s4, d["id"], pdf())
    d = send(s4, d["id"])
    t1, t3 = token(s4, vid(d, s4.vendor["id"])), token(s4, vid(d, third["id"]))
    clock = Clock(time.time())
    c = pub(s4, clock)
    assert c.get(f"/t/api/rfq/file/{a['id']}", headers=hdr(t3)).status_code == 200
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{vid(d, third['id'])}/remove", json={"revision": detail(s4, d["id"])["revision"]},
                  headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    assert c.get(f"/t/api/rfq/file/{a['id']}", headers=hdr(t3)).content == UNIFORM_404, "an unselected (removed) vendor: the uniform 404"
    # a cancelled request: the read-only grace shows no files, then the link is gone
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/cancel", json={"revision": detail(s4, d["id"])["revision"], "notify": False}, headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    assert view(c, t1)["rfq"]["attachments"] == []
    assert c.get(f"/t/api/rfq/file/{a['id']}", headers=hdr(t1)).content == UNIFORM_404
    # full deletion removes the rows and the files
    assert files_on_disk(s4)
    r = s4.c.delete(f"{API}/tickets/rfqs/{d['id']}", headers=s4.h("joni"))
    assert r.status_code == 200 and r.json()["rows"].get("ticket_rfq_attachments") == 1, r.text
    assert files_on_disk(s4) == []
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_rfq_attachments").fetchone()[0] == 0


def test_a_code_protected_link_shows_nothing_before_the_code(s4):
    d = draft(s4)
    a = attached(s4, d["id"], pdf())
    d = send(s4, d["id"])
    rv = vid(d, s4.vendor["id"])
    tok = token(s4, rv)
    c = pub(s4)
    assert c.get(f"/t/api/rfq/file/{a['id']}", headers=hdr(tok)).status_code == 200
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{rv}/options", json={"revision": d["revision"], "require_code": True}, headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    v = view(c, tok)
    assert "rfq" not in v, "the minimal card only"
    r = c.get(f"/t/api/rfq/file/{a['id']}", headers=hdr(tok))
    assert r.status_code == 403 and r.json() == {"code": "code_required"}


# ---------------------------------------------------------------- records: ids only, nothing in the logs, deletion rules

def test_audit_and_timeline_rows_carry_ids_only_and_no_name_reaches_a_log(s4, caplog):
    caplog.set_level(logging.DEBUG)
    d = draft(s4)
    a = attached(s4, d["id"], pdf(), SECRET_NAME, caption="קוד הכספת 4417")
    s4.c.patch(f"{API}/tickets/rfqs/{d['id']}/attachments/{a['id']}", json={"caption": "שינוי 4418", "visible_vendors": False}, headers=s4.h("mona"))
    attach(s4, d["id"], b"<script>", SECRET_NAME, "application/pdf")  # a refusal is audited too
    s4.c.delete(f"{API}/tickets/rfqs/{d['id']}/attachments/{a['id']}", headers=s4.h("mona"))
    rows = audits(s4)
    assert [(r["action"], r["decision"]) for r in rows] == [("ticket.rfq.attachment_add", "allowed"), ("ticket.rfq.attachment_edit", "allowed"),
                                                            ("ticket.rfq.attachment_add", "denied"), ("ticket.rfq.attachment_remove", "allowed")]
    with s4.db.connection(mode="read") as conn:
        events = [dict(r) for r in conn.execute("SELECT kind, data_json FROM ticket_rfq_events WHERE rfq_id = ? AND kind LIKE 'attachment_%'",
                                                (d["id"],))]
    assert [e["kind"] for e in events] == ["attachment_added", "attachment_changed", "attachment_removed"]
    blob = json.dumps(rows, ensure_ascii=False) + json.dumps(events, ensure_ascii=False)
    for secret in ("secret-plan", "4417", "4418", "הכספת", "sha", ".pdf"):
        assert secret not in blob, secret
    logged = "\n".join(r.getMessage() for r in caplog.records)
    assert "secret-plan" not in logged and "4417" not in logged


def test_removal_deletes_a_drafts_file_and_only_marks_one_vendors_priced_against(s4):
    d = draft(s4)
    a = attached(s4, d["id"], pdf(), "first.pdf")
    r = s4.c.delete(f"{API}/tickets/rfqs/{d['id']}/attachments/{a['id']}", headers=s4.h("mona"))
    assert r.status_code == 200 and r.json()["attachments"] == [] and files_on_disk(s4) == []
    b = attached(s4, d["id"], pdf(), "second.pdf")
    d = send(s4, d["id"])
    tok = token(s4, vid(d, s4.vendor["id"]))
    c = pub(s4)
    assert quote(c, tok).status_code == 201  # a quote arrived
    r = s4.c.delete(f"{API}/tickets/rfqs/{d['id']}/attachments/{b['id']}", headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    kept = next(x for x in r.json()["attachments"] if x["id"] == b["id"])
    assert kept["removed"] is True and kept["removed_at"] and len(files_on_disk(s4)) == 1, "the file vendors priced against is kept"
    assert view(c, tok)["rfq"]["attachments"] == [] and c.get(f"/t/api/rfq/file/{b['id']}", headers=hdr(tok)).content == UNIFORM_404
    assert detail(s4, d["id"], "tom")["attachments"] == [], "only the managers see a removed file"
    assert s4.c.delete(f"{API}/tickets/rfqs/{d['id']}/attachments/{b['id']}", headers=s4.h("mona")).status_code == 404
    rows = audits(s4, "ticket.rfq.attachment_remove")
    assert [json.loads(x["details_json"]).get("kept") for x in rows] == [False, True]


# ---------------------------------------------------------------- messages, meta, the work order's reference copy

def test_the_invitation_says_how_many_files_and_never_names_them(s4):
    d = draft(s4)
    attached(s4, d["id"], pdf(), SECRET_NAME)
    attached(s4, d["id"], jpeg(), "site.jpg", "image/jpeg")
    attached(s4, d["id"], pdf(), "internal.pdf", visible_vendors="false")
    send(s4, d["id"])
    with s4.db.connection(mode="read") as conn:
        rows = [dict(x) for x in conn.execute("SELECT params_json FROM ticket_outbox WHERE rfq_id = ? AND purpose = 'rfq_invite'", (d["id"],))]
    assert rows
    for x in rows:
        params = json.loads(x["params_json"])
        assert params["files"] in ("מצורפים לבקשה 2 קבצים (בקישור).", "2 files are attached to the request (see the link).")
        assert "secret" not in x["params_json"] and "site" not in x["params_json"] and "http" not in x["params_json"]
    from smplwise.services.tickets import message_templates as mt

    text = mt.render(mt.STARTERS["rfq_invite"]["he"], {"name": "דנה", "number": "7", "title": "שיפוץ", "files": params["files"]}, lang="he",
                     secrets={"link": "https://t.example.test/x"})
    assert "2 קבצים" in text and text.count("https://") == 1
    # no file: the line is dropped
    assert "קבצים" not in mt.render(mt.STARTERS["rfq_invite"]["he"], {"name": "דנה", "files": ""}, lang="he", secrets={"link": "L"})


def test_meta_and_detail_describe_the_attachments(s4):
    m = s4.c.get(f"{API}/tickets/rfqs/meta", headers=s4.h("mona")).json()
    assert m["attachments"] is True and m["attachment_limits"]["files"] == rfq_files.MAX_FILES
    assert set(m["attachment_limits"]["types"]) == {"jpg", "png", "webp", "pdf"} and m["attachment_limits"]["office"] is False
    assert m["settings"]["attachments"] == {"allow_office": False}
    allow_office(s4)
    m = s4.c.get(f"{API}/tickets/rfqs/meta", headers=s4.h("mona")).json()
    assert set(m["attachment_limits"]["types"]) == {"jpg", "png", "webp", "pdf", "docx", "xlsx"} and m["attachment_limits"]["office"] is True
    d = draft(s4)
    assert d["can"]["attach"] is True and detail(s4, d["id"], "tom")["can"]["attach"] is False


def test_a_work_order_references_the_files_and_the_vendor_keeps_them(s4, settings):
    bind(s4.c, settings, "kim", "system_admin", "installation", "*")
    d = draft(s4)
    shared = attached(s4, d["id"], pdf(), "spec.pdf")
    hidden = attached(s4, d["id"], pdf(), "budget.pdf", visible_vendors="false")
    d = send(s4, d["id"])
    v = vid(d, s4.vendor["id"])
    tok = token(s4, v)
    c = pub(s4)
    assert quote(c, tok).status_code == 201
    cmp = s4.c.get(f"{API}/tickets/rfqs/{d['id']}/comparison", headers=s4.h("joni")).json()
    q = next(x for x in cmp["quotes"] if x["vendor_id"] == v)
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards", json={"quote_id": q["quote_id"], "revision": q["revision"]}, headers=s4.h("kim"))
    assert r.status_code == 201, r.text
    award_id = r.json()["award"]["id"]
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{award_id}/order", json={"request_key": f"ord-{crid()[:12]}"}, headers=s4.h("mona"))
    assert r.status_code == 201, r.text
    tid = r.json()["ticket"]["id"]
    with s4.db.connection(mode="read") as conn:
        refs = [x[0] for x in conn.execute("SELECT attachment_id FROM ticket_rfq_attachment_refs WHERE ticket_id = ?", (tid,))]
        assert conn.execute("SELECT COUNT(*) FROM ticket_rfq_attachments").fetchone()[0] == 2, "referenced, not duplicated"
    assert refs == [shared["id"]], "an internal-only file is never referenced"
    t = s4.c.get(f"{API}/tickets/{tid}", headers=s4.h("joni")).json()
    assert [f["id"] for f in t["rfq_origin"]["attachments"]] == [shared["id"]]
    assert s4.c.get(f"{API}/tickets/{tid}/rfq-attachments/{shared['id']}", headers=s4.h("joni")).status_code == 200
    assert s4.c.get(f"{API}/tickets/{tid}/rfq-attachments/{hidden['id']}", headers=s4.h("joni")).status_code == 404
    ticket_tok = s4.token_of(tid)
    tv = c.get("/t/api/ticket", headers=hdr(ticket_tok)).json()
    assert [f["id"] for f in tv["rfq_files"]] == [shared["id"]]
    got = c.get(f"/t/api/ticket/rfq-file/{shared['id']}", headers=hdr(ticket_tok))
    assert got.status_code == 200 and got.content.startswith(b"%PDF-") and got.headers["content-disposition"].startswith("attachment;")
    assert c.get(f"/t/api/ticket/rfq-file/{hidden['id']}", headers=hdr(ticket_tok)).content == UNIFORM_404
    # the request is deleted: the referenced file stays with the service request, the other one goes
    r = s4.c.delete(f"{API}/tickets/rfqs/{d['id']}", headers=s4.h("joni"))
    assert r.status_code == 200, r.text
    assert c.get(f"/t/api/ticket/rfq-file/{shared['id']}", headers=hdr(ticket_tok)).status_code == 200
    with s4.db.connection(mode="read") as conn:
        left = [dict(x) for x in conn.execute("SELECT id, rfq_id FROM ticket_rfq_attachments")]
    assert left == [{"id": shared["id"], "rfq_id": None}]


# ---------------------------------------------------------------- review 2.6.4: the office switch, the edge headers, the read budget,
# the storage accounting and the refusal order

def test_office_attachments_are_off_by_default_and_follow_the_installation_switch(s4):
    d = draft(s4)
    r = attach(s4, d["id"], office(), "spec.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    assert (r.status_code, r.json()["code"]) == (422, "office_disabled") and "spec" not in r.text
    assert files_on_disk(s4) == [] and audits(s4)[-1]["reason"] == "office_disabled", "refused before the scan, audited"
    # only system.configure turns it on (an RFQ manager cannot)
    rev = s4.c.get(f"{API}/tickets/settings").json()["revision"]
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "rfq": {"attachments": {"allow_office": True}}}, headers=s4.h("mona"))
    assert r.status_code == 403
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "rfq": {"attachments": {"allow_office": "yes"}}})
    assert r.status_code == 422
    allow_office(s4)
    with s4.db.connection(mode="read") as conn:
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'tickets.settings.update' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert "rfq.attachments.allow_office" in json.loads(row[0])["changed"], "the switch is audited"
    doc = attached(s4, d["id"], office(), "spec.docx", "application/octet-stream")
    pdf_file = attached(s4, d["id"], pdf(), "plan.pdf")
    d = send(s4, d["id"])
    tok = token(s4, vid(d, s4.vendor["id"]))
    c = pub(s4)
    assert [f["id"] for f in view(c, tok)["rfq"]["attachments"]] == [doc["id"], pdf_file["id"]]
    assert c.get(f"/t/api/rfq/file/{doc['id']}", headers=hdr(tok)).status_code == 200
    # switched off again: the office file already attached stops travelling too (fail closed); the manager still sees it
    allow_office(s4, False)
    assert [f["id"] for f in view(c, tok)["rfq"]["attachments"]] == [pdf_file["id"]]
    assert c.get(f"/t/api/rfq/file/{doc['id']}", headers=hdr(tok)).content == UNIFORM_404
    assert doc["id"] in [a["id"] for a in detail(s4, d["id"], "mona")["attachments"]]


def test_document_headers_leaving_the_real_public_listener(s4):
    """Review F7: the bytes that leave the EDGE (not rfq_files.headers in isolation) - a download, never sniffed, never cached by a
    shared cache, no validators / ranges, and the listener's own CSP (the route's `sandbox` is internal-API only)."""
    allow_office(s4)
    d = draft(s4)
    files = [attached(s4, d["id"], pdf(), "plan.pdf"), attached(s4, d["id"], office(), "spec.docx", "application/octet-stream"),
             attached(s4, d["id"], office(kind="xlsx"), "boq.xlsx", "application/octet-stream")]
    d = send(s4, d["id"])
    tok = token(s4, vid(d, s4.vendor["id"]))
    c = pub(s4)
    for f, mime in zip(files, ("application/pdf", rfq_files.MIME["docx"], rfq_files.MIME["xlsx"])):
        r = c.get(f"/t/api/rfq/file/{f['id']}", headers={**hdr(tok), "Range": "bytes=0-10", "If-None-Match": "*"})
        h = {k.lower(): v for k, v in r.headers.items()}
        assert r.status_code == 200 and h["content-type"] == mime, (r.status_code, h)
        assert h["content-disposition"].startswith("attachment;") and "filename*=UTF-8''" in h["content-disposition"]
        assert h["x-content-type-options"] == "nosniff" and h["cache-control"] == "private, no-store"
        assert not {"etag", "last-modified", "accept-ranges", "content-range", "set-cookie", "server"} & set(h), sorted(h)
        assert h["content-security-policy"].startswith("default-src 'none'") and "sandbox" not in h["content-security-policy"]
        assert len(r.headers.get_list("content-security-policy")) == 1
        assert h["x-frame-options"] == "DENY" and h["referrer-policy"] == "no-referrer"
    # the internal API keeps the route's sandbox CSP
    r = s4.c.get(f"{API}/tickets/rfqs/{d['id']}/attachments/{files[0]['id']}", headers=s4.h("mona"))
    assert r.status_code == 200 and "sandbox" in r.headers["content-security-policy"]


def test_full_size_file_reads_have_a_budget_of_their_own(s4):
    """Review F4: a document is up to 10 MiB and every read is the whole file - the full file routes count in `file_read` (20 a
    minute, 60 an hour per link), the thumbnails stay in the photo window, the token's own request window is untouched."""
    from smplwise.services.tickets import links

    d = draft(s4)
    a = attached(s4, d["id"], jpeg(), "site.jpg", "image/jpeg")
    d = send(s4, d["id"])
    tok = token(s4, vid(d, s4.vendor["id"]))
    c, app = s4.public(Clock(time.time()))
    statuses = [c.get(f"/t/api/rfq/file/{a['id']}", headers=hdr(tok)).status_code for _ in range(21)]
    assert statuses == [200] * 20 + [429], statuses
    assert c.get(f"/t/api/ticket/rfq-file/{a['id']}", headers=hdr(tok)).status_code == 429, "the same budget on the reference-copy route"
    assert c.get(f"/t/api/rfq/file/{a['id']}/thumb", headers=hdr(tok)).status_code == 200, "thumbnails keep the photo window"
    key = links.limiter_key(links.token_hash(tok))
    assert app.gate.limiter.count(key, 60) <= 1, "the token's own request window untouched"
    assert view(c, tok)["rfq"]["attachments"]


def test_storage_accounting_follows_rfq_files(s4):
    """Review F6: the 2 GiB cap's cached directory size learns a new RFQ file (and its thumbnail) at once and is credited on delete."""
    from smplwise.services.tickets import attachments as att

    data_dir = s4.w.settings.data_dir
    att.forget_size_cache()
    before = att.used_bytes(data_dir)  # primes the cache (a walk)
    d = draft(s4)
    a = attached(s4, d["id"], jpeg(), "site.jpg", "image/jpeg")
    on_disk = sum(p.stat().st_size for p in files_on_disk(s4))
    assert att.used_bytes(data_dir) == before + on_disk, "cached size includes the picture and its thumbnail without a new walk"
    r = s4.c.delete(f"{API}/tickets/rfqs/{d['id']}/attachments/{a['id']}", headers=s4.h("mona"))
    assert r.status_code == 200 and files_on_disk(s4) == []
    assert att.used_bytes(data_dir) == before


def test_the_role_refusal_comes_before_form_validation(s4):
    """Review F9: a member who is not the request's manager gets the audited 403, whatever else is wrong with the form."""
    d = draft(s4)
    r = attach(s4, d["id"], pdf(), user="tom", visible_vendors="maybe")
    assert r.status_code == 403 and r.json()["details"]["reason"] == "not_manager", r.text
