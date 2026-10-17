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
        (office(extra={"word/vbaProject.bin": b"\xd0\xcf"}), "macro.docx", "application/octet-stream", "office_refused", 422),
        (b"%PDF-1.7\n" + b"\x00" * (rfq_files.DOCUMENT_MAX_BYTES + 10), "big.pdf", "application/pdf", "payload_too_large", 413),
        (b"\xff\xd8\xff" + b"\x00" * (rfq_files.IMAGE_MAX_BYTES + 10), "big.jpg", "image/jpeg", "payload_too_large", 413),
    ]:
        r = attach(s4, rid, data, name, mime)
        assert (r.status_code, r.json()["code"]) == (status, code), (name, r.text)
        assert "alert" not in r.text and name not in r.text, "a refusal never echoes the content or the name"
    assert detail(s4, rid)["attachments"] == [] and files_on_disk(s4) == []
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
    assert set(m["attachment_limits"]["types"]) == {"jpg", "png", "webp", "pdf", "docx", "xlsx"}
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
