"""RFQ-VENDOR-UPLOAD - a vendor's own files and pictures on his quote (owner decision 2026-10-17; docs/tickets/RFQ_BACKEND_CONTRACT.md
section 19.10), over the REAL store, the real manager API and the real public listener app. A NEW PUBLIC UPLOAD ROUTE, so negative cases
first: the switch is OFF by default (the uniform 404, byte for byte), a wrong / foreign / missing token, another vendor's quote id, a
superseded version, polyglots (PDF+ZIP, JPEG+ZIP, HTML / SVG / EXE dressed as pictures), WebP on the public side, Word / Excel behind
`rfq.attachments.allow_office`, oversize bodies, the count / upload / byte quotas, the edge's per-link and per-network windows, another
vendor's file id on removal, the code gate and the read-only grace. Then: the managers read the files with the comparison's rule and
always as a download, another vendor never sees them, audit / timeline / logs carry ids only, a purge removes rows and files, the orphan
sweep keeps them, a retry is a replay. Every name and number here is invented (the 050-000-xxxx block)."""
from __future__ import annotations

import io
import json
import logging
import time
import zipfile

import pytest
from PIL import Image

from smplwise.services.tickets import public_http, ratelimit, rfq_vendor_files, settings_doc, store, store_rfq
from smplwise.services.tickets.public_http import UNIFORM_404
from test_tickets_cost_files import pdf
from test_tickets_rfq_attachments import allow_office, attached, draft, files_on_disk, jpeg, send
from test_tickets_rfq_files import office, webp
from test_tickets_rfq_public import _at, add_vendor, detail, hdr, pub, quote, s4, token, view, vid  # noqa: F401
from tickets_s4_world import API, Clock, crid

SECRET = "secret-offer-of-the-roof-4417"
MiB = 1024 * 1024


def limits(s4, **values) -> None:
    """The administrator's limits `rfq.vendor_uploads.max_*` (system.configure)."""
    rev = s4.c.get(f"{API}/tickets/settings").json()["revision"]
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "rfq": {"vendor_uploads": values}})
    assert r.status_code == 200, r.text
    assert all(r.json()["rfq"]["vendor_uploads"][k] == v for k, v in values.items())


def uploads(s4, on: bool = True) -> None:
    """The installation switch `rfq.vendor_uploads.enabled` (system.configure; the fixture's default caller is an administrator)."""
    rev = s4.c.get(f"{API}/tickets/settings").json()["revision"]
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "rfq": {"vendor_uploads": {"enabled": on}}})
    assert r.status_code == 200 and r.json()["rfq"]["vendor_uploads"]["enabled"] is on, r.text


def up(c, tok: str, quote_id: str | None, data: bytes, *, name: str = f"{SECRET}.pdf", rid: str | None = None, mime: str = "application/pdf",
       headers: dict | None = None, message_id: str | None = None):
    form = {"client_request_id": rid or crid(), "name": name}
    if quote_id is not None:
        form["quote_id"] = quote_id
    if message_id is not None:
        form["message_id"] = message_id
    return c.post("/t/api/rfq/upload", files={"file": ("upload.bin", data, mime)}, data=form, headers=headers if headers is not None else hdr(tok))


def ask(c, tok: str, text: str = "האם אפשר לקבל תוכנית קומה?") -> str:
    r = c.post("/t/api/rfq/message", json={"text": text, "client_request_id": crid()}, headers=hdr(tok))
    assert r.status_code == 201, r.text
    return r.json()["message"]["id"]


def rm(c, tok: str, file_id: str, rid: str | None = None):
    return c.post("/t/api/rfq/upload/remove", json={"file_id": file_id, "client_request_id": rid or crid()}, headers=hdr(tok))


def zip_bytes(n: int = 1) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for i in range(n):
            z.writestr(f"payload{i}.txt", "x")
    return buf.getvalue()


def world(s4, *, on: bool = True):
    """A sent request with two vendors; vendor A has submitted a quote. Returns (detail, client, token A, quote id A, token B)."""
    if on:
        uploads(s4)
    d = send(s4, draft(s4)["id"])
    ta, tb = token(s4, vid(d, s4.vendor["id"])), token(s4, vid(d, s4.contact["id"]))
    c = pub(s4)
    r = quote(c, ta)
    assert r.status_code == 201, r.text
    return d, c, ta, r.json()["quote"]["id"], tb


def _wide_limits(init):
    def wide(self, *a, **kw):
        kw.setdefault("token_rfq_uploads", ((3600.0, 100),))
        kw.setdefault("rfq_upload_per_network", ((600.0, 100),))
        init(self, *a, **kw)
    return wide


def vendor_rows(s4) -> list[dict]:
    with s4.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM ticket_rfq_vendor_files ORDER BY created_at, id")]


# ---------------------------------------------------------------- refusals first: the switch, the token, the quote

def test_the_switch_is_off_by_default_and_both_routes_are_the_uniform_404(s4):
    d, c, ta, qid, _tb = world(s4, on=False)
    v = view(c, ta)
    assert v["uploads"] is None, "the page shows no upload block while the switch is off"
    for r in (up(c, ta, qid, pdf()), rm(c, ta, "anything")):
        assert (r.status_code, r.content) == (404, UNIFORM_404), "byte-identical to an unknown route"
    assert vendor_rows(s4) == [] and files_on_disk(s4) == []
    meta = s4.c.get(f"{API}/tickets/rfqs/meta", headers=s4.h("mona")).json()
    assert meta["vendor_uploads"] is False and meta["settings"]["vendor_uploads"]["enabled"] is False
    # only system.configure turns it on; a non-boolean is refused
    rev = s4.c.get(f"{API}/tickets/settings").json()["revision"]
    assert s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "rfq": {"vendor_uploads": {"enabled": True}}},
                    headers=s4.h("mona")).status_code == 403
    assert s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "rfq": {"vendor_uploads": {"enabled": "yes"}}}).status_code == 422
    uploads(s4)
    with s4.db.connection(mode="read") as conn:
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'tickets.settings.update' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert "rfq.vendor_uploads.enabled" in json.loads(row[0])["changed"], "the switch is audited"
    assert up(c, ta, qid, pdf()).status_code == 201


def test_wrong_foreign_and_missing_tokens_are_the_uniform_404(s4):
    _d, c, ta, qid, _tb = world(s4)
    _t, ticket_tok = s4.sent()
    misses = [up(c, ta, qid, pdf(), headers=hdr("A" * 43)), up(c, ta, qid, pdf(), headers=hdr(ticket_tok)), up(c, ta, qid, pdf(), headers={}),
              c.post("/t/api/rfq/upload/remove", json={"file_id": "x", "client_request_id": crid()}, headers=hdr("A" * 43)),
              c.get("/t/api/rfq/upload", headers=hdr(ta)),  # no read / list route of any kind
              c.get(f"/t/api/rfq/upload/{qid}", headers=hdr(ta))]
    assert [m.status_code for m in misses] == [404] * len(misses)
    assert {m.content for m in misses} == {UNIFORM_404}
    assert vendor_rows(s4) == [] and files_on_disk(s4) == []


def test_only_his_own_current_submitted_quote(s4):
    d, c, ta, qid, tb = world(s4)
    # vendor B has no quote: nothing to attach to; and he cannot use vendor A's quote id
    for r in (up(c, tb, qid, pdf()), up(c, ta, "no-such-quote", pdf())):
        assert (r.status_code, r.json()) == (409, {"code": "quote_closed", "reason": "vendor"}), r.text
    # no target, or both targets: exactly one is required
    for r in (up(c, ta, None, pdf()), up(c, ta, "", pdf()), up(c, ta, qid, pdf(), message_id="m-1")):
        assert (r.status_code, r.json()["code"], r.json()["fields"][0]["code"]) == (422, "invalid", "one_of"), r.text
    # a superseded version of his own quote is refused the same way
    r2 = quote(c, ta, base=1)
    assert r2.status_code == 201, r2.text
    r = up(c, ta, qid, pdf())
    assert (r.status_code, r.json()["code"]) == (409, "quote_closed")
    assert up(c, ta, r2.json()["quote"]["id"], pdf()).status_code == 201
    assert len(vendor_rows(s4)) == 1


# ---------------------------------------------------------------- what a file may be: the SAME checks as a manager's file

def test_polyglots_disguises_webp_and_office_are_refused_by_content(s4, monkeypatch):
    # more attempts than one client network's upload window allows (12 / 10 min): this test is about content, not about the edge
    monkeypatch.setattr(ratelimit.PublicLimits, "__init__", _wide_limits(ratelimit.PublicLimits.__init__))
    _d, c, ta, qid, _tb = world(s4)
    for data, code, status in [
        (pdf() + zip_bytes(), "pdf_invalid", 422),  # PDF + small ZIP: bytes after the last %%EOF (review F3)
        (pdf() + zip_bytes() + b"%%EOF\n", "pdf_refused", 422),  # PDF + ZIP + a re-appended trailer: the ZIP directory inside
        (pdf(b"1 0 obj << /OpenAction 2 0 R /JS (app.alert(1)) >> endobj"), "pdf_refused", 422),
        (b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>", "unsupported_format", 415),
        (b"<html><script>alert(1)</script></html>", "unsupported_format", 415),
        (b"MZ\x90\x00" + b"\x00" * 200, "unsupported_format", 415),
        (b"GIF89a" + b"\x00" * 100, "unsupported_format", 415),
        (webp(), "unsupported_format", 415),  # WebP stays refused on every public route (decision 6)
        (office(), "office_disabled", 422),  # Word / Excel are OFF by default
    ]:
        r = up(c, ta, qid, data, mime="image/jpeg")
        assert (r.status_code, r.json()["code"]) == (status, code), (code, r.text)
        assert "alert" not in r.text and SECRET not in r.text, "a refusal never echoes the content or the name"
    assert vendor_rows(s4) == [] and files_on_disk(s4) == []
    allow_office(s4)
    r = up(c, ta, qid, office(extra={"word/vbaProject.bin": b"\xd0\xcf"}))
    assert (r.status_code, r.json()["code"]) == (422, "office_refused")
    r = up(c, ta, qid, b"%PDF-1.7\n" + office()[5:])  # an office package dressed as a PDF is a broken PDF
    assert r.status_code in (415, 422)
    assert vendor_rows(s4) == [] and files_on_disk(s4) == []
    # a JPEG with a ZIP appended is stored as OUR fresh JPEG: the appended bytes never reach the disk
    r = up(c, ta, qid, jpeg() + zip_bytes(), name="site.pdf", mime="application/pdf")
    assert r.status_code == 201, r.text
    f = r.json()["file"]
    assert (f["kind"], f["name"]) == ("image", "site.jpg"), "the name never decides the kind; the extension is the content's"
    stored = [p for p in files_on_disk(s4)]
    assert len(stored) == 2 and all(b"PK\x03\x04" not in p.read_bytes() and b"PK\x05\x06" not in p.read_bytes() for p in stored)
    r = up(c, ta, qid, office(), name="boq.xlsx")
    assert r.status_code == 201 and r.json()["file"]["kind"] == "docx", r.text


def test_oversize_bodies_are_refused_at_the_edge_or_by_the_kind_cap(s4):
    _d, c, ta, qid, _tb = world(s4)
    r = up(c, ta, qid, b"\xff\xd8\xff" + b"\x00" * (8 * MiB + 10), mime="image/jpeg")
    assert (r.status_code, r.json()["code"]) == (413, "too_large") and r.json()["max_bytes"] == 8 * MiB
    r = up(c, ta, qid, b"%PDF-1.7\n" + b"\x00" * (public_http.RFQ_UPLOAD_MAX + 10))
    assert r.status_code == 413, "a body over the route's cap is refused before it is read"
    r = up(c, ta, qid, b"%PDF-1.7\n" + b"\x00" * (10 * MiB + 10))
    assert r.status_code in (413, 422) and r.status_code != 201
    assert vendor_rows(s4) == [] and files_on_disk(s4) == []


def test_unknown_or_duplicate_form_fields_and_a_missing_request_id(s4):
    _d, c, ta, qid, _tb = world(s4)
    r = c.post("/t/api/rfq/upload", files={"file": ("a.pdf", pdf(), "application/pdf")}, data={"quote_id": qid, "client_request_id": crid(),
                                                                                             "caption": "x"}, headers=hdr(ta))
    assert (r.status_code, r.json()["fields"][0]["code"]) == (422, "unknown_field")
    r = c.post("/t/api/rfq/upload", files={"file": ("a.pdf", pdf(), "application/pdf")}, data={"quote_id": qid}, headers=hdr(ta))
    assert r.status_code == 422
    r = c.post("/t/api/rfq/upload", data={"quote_id": qid, "client_request_id": crid()}, headers=hdr(ta))
    assert r.status_code in (415, 422)
    assert vendor_rows(s4) == []


# ---------------------------------------------------------------- quotas and rate limits

def test_live_file_upload_and_byte_quotas(s4):
    _d, c, ta, qid, _tb = world(s4)
    ids = [up(c, ta, qid, pdf(b"%d 0 obj << >> endobj" % i)).json()["file"]["id"] for i in range(5)]  # the default: 5 live files
    r = up(c, ta, qid, pdf())
    assert (r.status_code, r.json()["code"], r.json()["max_files"]) == (409, "upload_limit", 5), r.text
    assert view(c, ta)["uploads"]["can"]["upload"] is False
    assert rm(c, ta, ids[0]).status_code == 200
    assert up(c, ta, qid, pdf()).status_code == 201, "a removal frees a live place"
    limits(s4, max_uploads=6)
    assert rm(c, ta, ids[1]).status_code == 200
    r = up(c, ta, qid, pdf())
    assert (r.status_code, r.json()["code"], r.json()["max_uploads"]) == (409, "upload_limit", 6), "a removal gives no upload back"
    assert len(vendor_rows(s4)) == 6


def test_the_byte_quota_counts_removed_files(s4):
    _d, c, ta, qid, _tb = world(s4)
    limits(s4, max_total_mb=1)
    big = pdf(b"3 0 obj << /Pad (" + b"x" * 600_000 + b") >> endobj")
    first = up(c, ta, qid, big)
    assert first.status_code == 201, first.text
    assert rm(c, ta, first.json()["file"]["id"]).status_code == 200
    r = up(c, ta, qid, big)
    assert (r.status_code, r.json()["code"], r.json()["max_bytes"]) == (413, "upload_total", MiB), "removed files keep counting: on disk"
    assert len(vendor_rows(s4)) == 1 and len(files_on_disk(s4)) == 1, "the refused file was deleted after the check"


# ---------------------------------------------------------------- the limits are administrator settings, inside hard caps

def test_limit_settings_are_validated_against_the_hard_caps(s4):
    rev = s4.c.get(f"{API}/tickets/settings").json()["revision"]
    for bad in ({"max_files": 0}, {"max_files": 11}, {"max_uploads": 31}, {"max_image_mb": 9}, {"max_doc_mb": 11}, {"max_total_mb": 51},
                {"max_files": "5"}, {"max_files": True}, {"max_files": 8, "max_uploads": 7}, {"unknown": 1}):
        r = s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "rfq": {"vendor_uploads": bad}})
        assert r.status_code == 422, (bad, r.text)
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "rfq": {"vendor_uploads": {"max_files": 3}}}, headers=s4.h("mona"))
    assert r.status_code == 403, "only system.configure"
    got = s4.c.get(f"{API}/tickets/settings").json()["rfq"]["vendor_uploads"]
    assert got == {"enabled": False, "max_files": 5, "max_uploads": 10, "max_image_mb": 8, "max_doc_mb": 10, "max_total_mb": 20}
    limits(s4, max_files=10, max_uploads=30, max_image_mb=8, max_doc_mb=10, max_total_mb=50)  # the caps themselves are allowed


def test_lower_limits_are_enforced_and_a_stored_value_beyond_a_cap_never_widens(s4):
    _d, c, ta, qid, _tb = world(s4)
    limits(s4, max_files=2, max_doc_mb=1, max_image_mb=1)
    r = up(c, ta, qid, pdf(b"3 0 obj << /Pad (" + b"x" * (MiB + 10) + b") >> endobj"))
    assert (r.status_code, r.json()["code"], r.json()["max_bytes"]) == (413, "too_large", MiB), r.text
    r = up(c, ta, qid, b"\xff\xd8\xff" + b"\x00" * (MiB + 10), mime="image/jpeg")
    assert (r.status_code, r.json()["max_bytes"]) == (413, MiB)
    assert up(c, ta, qid, pdf()).status_code == 201 and up(c, ta, qid, pdf(b"3 0 obj << >> endobj")).status_code == 201
    r = up(c, ta, qid, pdf(b"4 0 obj << >> endobj"))
    assert (r.status_code, r.json()["max_files"]) == (409, 2)
    v = view(c, ta)["uploads"]["limits"]
    assert (v["files"], v["document_bytes"], v["image_bytes"]) == (2, MiB, MiB)
    # a hand-edited document beyond the hard caps is clamped (never wider than 10 files / 10 MiB)
    with s4.db.connection() as conn:
        raw = conn.execute("SELECT value FROM settings WHERE key = ?", (settings_doc.SETTING_KEY,)).fetchone()[0]
        doc = json.loads(raw)
        doc["rfq"]["vendor_uploads"].update({"max_files": 999, "max_doc_mb": 999, "max_uploads": 999})
        conn.execute("UPDATE settings SET value = ? WHERE key = ?", (json.dumps(doc), settings_doc.SETTING_KEY))
    with s4.db.connection(mode="read") as conn:
        lim = rfq_vendor_files.limits_of(conn)
    assert lim.files <= 10 and lim.document_bytes <= 10 * MiB and lim.uploads <= 30, "never wider than the hard caps"
    assert rfq_vendor_files.Limits({"max_files": 999, "max_doc_mb": 999, "max_uploads": 999, "max_total_mb": -5}).__dict__ == {
        "files": 10, "uploads": 30, "image_bytes": 8 * MiB, "document_bytes": 10 * MiB, "total_bytes": MiB}


def test_the_edge_windows_per_link_and_per_client_network():
    """The `rfq_upload` kind: a network's window is counted at admission for EVERY attempt (valid token or not); a link's budget is
    spent when an upload's body phase starts (RequestCost.body_phase) and checked at admission."""
    limits = ratelimit.PublicLimits(token_rfq_uploads=((3600.0, 2),), rfq_upload_per_network=((600.0, 3),))
    clock = Clock(1_000_000.0)
    gate = ratelimit.PublicRateGate(ratelimit.new_public_limiter(clock, limits), limits)
    net, other = "203.0.113.0/24", "198.51.100.0/24"
    for _ in range(2):
        cost = gate.open("rfq_upload", net, "tok-a")
        assert cost.decision.ok
        cost.proved("link-a")
        cost.body_phase()
    d = gate.open("rfq_upload", other, "tok-a")
    assert (d.decision.ok, d.decision.reason) == (False, "rfq_upload_rate"), "the link's own budget, whatever the network"
    assert gate.open("rfq_upload", net, "tok-b").decision.ok, "the third attempt of the network (another link)"
    d = gate.open("rfq_upload", net, "tok-c")
    assert (d.decision.ok, d.decision.reason) == (False, "rfq_upload_net_rate"), "one network cannot spread uploads over many links"
    assert gate.open("rfq_upload", other, "tok-c").decision.ok
    assert gate.open("token_write", net, "tok-c").decision.ok, "other kinds are untouched"
    clock.t += 601
    assert gate.open("rfq_upload", net, "tok-d").decision.ok, "the network window slides"
    assert "rfq_upload" in ratelimit.UPLOAD_KINDS and "u:" in ratelimit.PROTECTED_PREFIXES


def test_the_real_listener_applies_the_upload_window(s4):
    """Integration: the route's kind is `rfq_upload` and its body phase spends the link budget - refused uploads included."""
    rule = next(r for r in public_http.ROUTES if r.template == "/t/api/rfq/upload")
    assert (rule.method, rule.kind, rule.body, rule.max_body) == ("POST", "rfq_upload", "multipart", public_http.RFQ_UPLOAD_MAX)
    _d, c, ta, qid, _tb = world(s4)
    statuses = [up(c, ta, qid, b"MZ" + b"\x00" * 64).status_code for _ in range(13)]
    assert statuses[:12] == [415] * 12 and statuses[12] == 429, statuses


# ---------------------------------------------------------------- removal, the code gate, the read-only grace

def test_removal_only_of_his_own_live_files(s4):
    d, c, ta, qid, tb = world(s4)
    f = up(c, ta, qid, pdf()).json()["file"]
    rb = quote(c, tb)
    assert rb.status_code == 201
    g = up(c, tb, rb.json()["quote"]["id"], pdf()).json()["file"]
    for r in (rm(c, ta, g["id"]), rm(c, ta, "no-such-file"), rm(c, tb, f["id"])):
        assert (r.status_code, r.json()["code"]) == (409, "upload_not_found"), r.text  # never the uniform 404: the page would forget the link
    assert rm(c, ta, f["id"]).status_code == 200
    assert (rm(c, ta, f["id"]).json()["code"]) == "upload_not_found", "already removed"
    assert view(c, ta)["uploads"]["files"] == [] and [x["id"] for x in view(c, tb)["uploads"]["files"]] == [g["id"]]
    rows = {r["id"]: r for r in vendor_rows(s4)}
    assert rows[f["id"]]["removed_at"] and len(files_on_disk(s4)) == 2, "kept for the record until the purge"


def test_a_code_protected_link_and_the_read_only_grace(s4):
    d, c, ta, qid, _tb = world(s4)
    rv = vid(d, s4.vendor["id"])
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{rv}/options", json={"revision": detail(s4, d["id"])["revision"], "require_code": True},
                  headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    r = up(c, ta, qid, pdf())
    assert (r.status_code, r.json()["code"]) == (403, "code_required")
    assert "uploads" not in view(c, ta), "nothing of the request before the code"
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{rv}/options", json={"revision": detail(s4, d["id"])["revision"], "require_code": False},
                  headers=s4.h("mona"))
    assert r.status_code == 200
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/cancel", json={"revision": detail(s4, d["id"])["revision"], "notify": False}, headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    r = up(c, ta, qid, pdf())
    assert (r.status_code, r.json()["code"]) == (409, "read_only")
    assert view(c, ta)["uploads"] is None and vendor_rows(s4) == []


# ---------------------------------------------------------------- the managers' side and the other vendors

def test_managers_read_vendor_files_as_downloads_with_the_comparison_rule(s4):
    d, c, ta, qid, tb = world(s4)
    doc = up(c, ta, qid, pdf()).json()["file"]
    pic = up(c, ta, qid, jpeg(), name="roof.jpg", mime="image/jpeg").json()["file"]
    cmp = s4.c.get(f"{API}/tickets/rfqs/{d['id']}/comparison", headers=s4.h("joni")).json()
    col = next(q for q in cmp["quotes"] if q["vendor_id"] == vid(d, s4.vendor["id"]))
    assert [f["id"] for f in col["vendor_files"]] == [doc["id"], pic["id"]] and col["vendor_files"][0]["quote_version"] == 1
    assert set(col["vendor_files"][0]) == {"id", "name", "kind", "mime", "bytes", "width", "height", "thumb", "quote_id", "message_id", "quote_version",
                                           "created_at", "removed"}
    base = f"{API}/tickets/rfqs/{d['id']}/vendor-files"
    for path, mime in ((f"{base}/{doc['id']}", "application/pdf"), (f"{base}/{pic['id']}", "image/jpeg"), (f"{base}/{pic['id']}/thumb", "image/jpeg")):
        r = s4.c.get(path, headers=s4.h("joni"))
        h = {k.lower(): v for k, v in r.headers.items()}
        assert r.status_code == 200 and h["content-type"] == mime, (path, r.status_code)
        assert h["content-disposition"].startswith("attachment;"), "a vendor's file is ALWAYS a download, a picture too"
        assert h["x-content-type-options"] == "nosniff" and "sandbox" in h["content-security-policy"] and h["cache-control"] == "private, no-store"
    # a document has no thumbnail; another request's id; a member without costs.view (audited 403); an outsider (the uniform 404)
    other = send(s4, draft(s4)["id"])
    assert s4.c.get(f"{base}/{doc['id']}/thumb", headers=s4.h("joni")).status_code == 404
    assert s4.c.get(f"{API}/tickets/rfqs/{other['id']}/vendor-files/{doc['id']}", headers=s4.h("joni")).status_code == 404
    assert s4.c.get(f"{base}/{doc['id']}", headers=s4.h("tom")).status_code == 403
    assert s4.c.get(f"{base}/{doc['id']}", headers=s4.h("nora")).json()["code"] == "rfq_not_found"
    # the other vendor never sees vendor A's files - not on his page, not by any public route
    vb = view(c, tb)
    assert vb["uploads"]["files"] == [] and doc["id"] not in json.dumps(vb) and SECRET not in json.dumps(vb)
    for path in (f"/t/api/rfq/file/{doc['id']}", f"/t/api/rfq/file/{pic['id']}/thumb"):
        assert c.get(path, headers=hdr(tb)).content == UNIFORM_404
        assert c.get(path, headers=hdr(ta)).content == UNIFORM_404, "not even the uploader: no public read of a vendor file"


def test_office_files_follow_the_office_switch_on_the_managers_side_too(s4):
    allow_office(s4)
    d, c, ta, qid, _tb = world(s4)
    doc = up(c, ta, qid, office(), name="spec.docx").json()["file"]
    base = f"{API}/tickets/rfqs/{d['id']}/vendor-files"
    assert s4.c.get(f"{base}/{doc['id']}", headers=s4.h("joni")).status_code == 200
    allow_office(s4, False)
    assert s4.c.get(f"{base}/{doc['id']}", headers=s4.h("joni")).status_code == 404, "fail closed while Word / Excel are off"
    cmp = s4.c.get(f"{API}/tickets/rfqs/{d['id']}/comparison", headers=s4.h("joni")).json()
    assert all(not q["vendor_files"] for q in cmp["quotes"])
    assert view(c, ta)["uploads"]["limits"]["types"] == ["jpg", "png", "pdf"]


def test_audit_timeline_and_logs_carry_ids_only_and_a_retry_is_a_replay(s4, caplog):
    caplog.set_level(logging.DEBUG)
    d, c, ta, qid, _tb = world(s4)
    rid = crid()
    first = up(c, ta, qid, pdf(), rid=rid)
    again = up(c, ta, qid, pdf(), rid=rid)
    assert first.status_code == again.status_code == 201 and first.json() == again.json()
    assert len(vendor_rows(s4)) == 1 and len(files_on_disk(s4)) == 1, "one effect, the retry stored nothing"
    assert rm(c, ta, first.json()["file"]["id"]).status_code == 200
    with s4.db.connection(mode="read") as conn:
        trail = [dict(r) for r in conn.execute("SELECT action, details_json FROM audit_log WHERE action LIKE 'ticket.rfq.vendor_file%' ORDER BY rowid")]
        events = [dict(r) for r in conn.execute("SELECT kind, data_json FROM ticket_rfq_events WHERE kind LIKE 'vendor_file%' ORDER BY rowid")]
    assert [a["action"] for a in trail] == ["ticket.rfq.vendor_file_add", "ticket.rfq.vendor_file_remove"]
    assert [e["kind"] for e in events] == ["vendor_file_added", "vendor_file_removed"]
    blob = json.dumps(trail) + json.dumps(events) + caplog.text
    assert SECRET not in blob and "bytes" not in json.dumps(trail), "never a name or a size"
    d2 = detail(s4, d["id"])
    assert any(e["kind"] == "vendor_file_added" for e in d2["timeline"])


def test_the_purge_removes_rows_and_files_and_the_orphan_sweep_keeps_live_ones(s4, settings):
    from conftest import bind

    from smplwise.services.tickets import deletion

    bind(s4.c, settings, "kim", "system_admin", "installation", "*")
    d, c, ta, qid, _tb = world(s4)
    up(c, ta, qid, jpeg(), name="roof.jpg", mime="image/jpeg")
    with s4.db.connection(mode="read") as conn:
        assert store.folder_in_use(conn, d["id"]) and len(store.stored_paths(conn, d["id"])) == 2
    root = s4.w.settings.data_dir / "tickets"
    later = time.time() + 86400  # every file is old enough for the sweeps
    assert deletion.sweep_orphan_files(s4.db, root, now=later) == 0
    assert deletion.sweep_orphans(s4.db, root, now=later) == 0
    assert len(files_on_disk(s4)) == 2, "the orphan sweeps never delete a file a vendor-file row names"
    r = s4.c.delete(f"{API}/tickets/rfqs/{d['id']}", headers=s4.h("joni"))
    assert r.status_code == 200 and r.json()["rows"].get("ticket_rfq_vendor_files") == 1, r.text
    assert files_on_disk(s4) == [] and vendor_rows(s4) == []


# ---------------------------------------------------------------- owner decision 2026-10-17 (4): files with a QUESTION, no quote needed

def test_question_files_refusals_first(s4):
    d, c, ta, _qid, tb = world(s4)
    mine = ask(c, tb)  # vendor B asks (he has no quote)
    other = ask(c, ta)  # vendor A's question
    rv_b = vid(d, s4.contact["id"])
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{rv_b}/messages", json={"text": "התוכנית מצורפת לבקשה", "notify": False},
                  headers=s4.h("mona"))
    assert r.status_code in (200, 201), r.text
    with s4.db.connection(mode="read") as conn:
        answer = conn.execute("SELECT id FROM ticket_rfq_messages WHERE rfq_vendor_id = ? AND direction = 'out'", (rv_b,)).fetchone()[0]
    for target in (other, answer, "no-such-message"):  # another vendor's question, the organisation's answer, unknown
        r = up(c, tb, None, pdf(), message_id=target)
        assert (r.status_code, r.json()["code"]) == (409, "question_not_found"), (target, r.text)
    assert vendor_rows(s4) == [] and files_on_disk(s4) == []
    # the switch off: the uniform 404 for the question path too
    uploads(s4, False)
    assert up(c, tb, None, pdf(), message_id=mine).content == UNIFORM_404
    uploads(s4, True)
    # the same scanners: a polyglot is refused on the question path as well
    assert up(c, tb, None, pdf() + zip_bytes() + b"%%EOF\n", message_id=mine).json()["code"] == "pdf_refused"
    assert up(c, tb, None, webp(), message_id=mine, mime="image/webp").status_code == 415
    # an ended request takes no question files
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/cancel", json={"revision": detail(s4, d["id"])["revision"], "notify": False}, headers=s4.h("mona"))
    assert r.status_code == 200
    assert up(c, tb, None, pdf(), message_id=mine).json()["code"] == "read_only"
    assert vendor_rows(s4) == []


def test_question_files_without_a_quote_shared_quota_and_who_sees_them(s4):
    d, c, ta, qid, tb = world(s4)
    assert view(c, tb)["uploads"]["can"] == {"upload": False, "question": True, "remove": True}, "no quote: only the question path"
    mid = ask(c, tb)
    f = up(c, tb, None, jpeg(), message_id=mid, name="leak.jpg", mime="image/jpeg")
    assert f.status_code == 201, f.text
    f = f.json()["file"]
    assert (f["on"], f["message_id"]) == ("question", mid)
    rv_b = vid(d, s4.vendor["id"]), vid(d, s4.contact["id"])
    # managers: next to the question (the thread and the pending questions), NOT in the comparison's quote files
    items = s4.c.get(f"{API}/tickets/rfqs/{d['id']}/vendors/{rv_b[1]}/messages", headers=s4.h("tom")).json()["items"]
    q = next(i for i in items if i["id"] == mid)
    assert [x["id"] for x in q["files"]] == [f["id"]]
    pend = detail(s4, d["id"], "mona")["questions"]["items"]
    assert [x["id"] for x in next(p for p in pend if p["id"] == mid)["files"]] == [f["id"]]
    cmp = s4.c.get(f"{API}/tickets/rfqs/{d['id']}/comparison", headers=s4.h("joni")).json()
    assert all(f["id"] not in json.dumps(x["vendor_files"]) for x in cmp["quotes"])
    # the thread's rule: a member who sees the request (no costs.view) reads a QUESTION file, never a QUOTE file
    qf = up(c, ta, qid, pdf()).json()["file"]
    base = f"{API}/tickets/rfqs/{d['id']}/vendor-files"
    got = s4.c.get(f"{base}/{f['id']}", headers=s4.h("tom"))
    assert got.status_code == 200 and got.headers["content-disposition"].startswith("attachment;") and "sandbox" in got.headers["content-security-policy"]
    assert s4.c.get(f"{base}/{qf['id']}", headers=s4.h("tom")).status_code == 403
    assert s4.c.get(f"{base}/{f['id']}", headers=s4.h("nora")).status_code == 404
    # another vendor never sees it
    va = view(c, ta)
    assert f["id"] not in json.dumps(va) and "leak" not in json.dumps(va)
    # ONE quota per vendor: question files and quote files count together
    limits(s4, max_files=2)
    rq = quote(c, tb)
    assert rq.status_code == 201
    assert up(c, tb, rq.json()["quote"]["id"], pdf()).status_code == 201
    r = up(c, tb, None, pdf(), message_id=mid)
    assert (r.status_code, r.json()["max_files"]) == (409, 2)
    assert view(c, tb)["uploads"]["can"] == {"upload": False, "question": False, "remove": True}
    with s4.db.connection(mode="read") as conn:
        ev = [json.loads(r[0]) for r in conn.execute("SELECT data_json FROM ticket_rfq_events WHERE kind = 'vendor_file_added' ORDER BY rowid")]
    assert ev[0] == {"file_id": f["id"], "kind": "image", "message_id": mid}


# ---------------------------------------------------------------- owner decision 2026-10-17 (1): visible on the work order

def _award_and_order(s4, d: dict, rv: str) -> str:
    cmp = s4.c.get(f"{API}/tickets/rfqs/{d['id']}/comparison", headers=s4.h("joni")).json()
    q = next(x for x in cmp["quotes"] if x["vendor_id"] == rv)
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards", json={"quote_id": q["quote_id"], "revision": q["revision"]}, headers=s4.h("kim"))
    assert r.status_code == 201, r.text
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{r.json()['award']['id']}/order", json={"request_key": f"ord-{crid()[:12]}"},
                  headers=s4.h("mona"))
    assert r.status_code == 201, r.text
    return r.json()["ticket"]["id"]


def test_the_work_order_references_the_awarded_vendors_files_for_cost_viewers_only(s4, settings):
    from conftest import bind

    bind(s4.c, settings, "kim", "system_admin", "installation", "*")
    d, c, ta, qid, tb = world(s4)
    rv_a = vid(d, s4.vendor["id"])
    keep = up(c, ta, qid, pdf()).json()["file"]
    gone = up(c, ta, qid, jpeg(), name="old.jpg", mime="image/jpeg").json()["file"]
    assert rm(c, ta, gone["id"]).status_code == 200
    qmid = ask(c, ta)
    qfile = up(c, ta, None, pdf(b"3 0 obj << >> endobj"), message_id=qmid).json()["file"]
    rb = quote(c, tb)
    other = up(c, tb, rb.json()["quote"]["id"], pdf()).json()["file"]
    tid = _award_and_order(s4, d, rv_a)
    with s4.db.connection(mode="read") as conn:
        refs = sorted(x[0] for x in conn.execute("SELECT file_id FROM ticket_rfq_vendor_file_refs WHERE ticket_id = ?", (tid,)))
        assert conn.execute("SELECT COUNT(*) FROM ticket_rfq_vendor_files").fetchone()[0] == 4, "referenced, never copied"
    assert refs == sorted([keep["id"], qfile["id"]]), "the awarded vendor's LIVE files only - not a removed one, not another vendor's"
    t = s4.c.get(f"{API}/tickets/{tid}", headers=s4.h("joni")).json()
    assert sorted(f["id"] for f in t["rfq_origin"]["vendor_files"]) == refs
    base = f"{API}/tickets/{tid}/rfq-vendor-files"
    got = s4.c.get(f"{base}/{keep['id']}", headers=s4.h("joni"))
    h = {k.lower(): v for k, v in got.headers.items()}
    assert got.status_code == 200 and h["content-disposition"].startswith("attachment;") and h["x-content-type-options"] == "nosniff"
    assert "sandbox" in h["content-security-policy"] and h["cache-control"] == "private, no-store"
    for fid in (gone["id"], other["id"], "no-such-file"):
        assert s4.c.get(f"{base}/{fid}", headers=s4.h("joni")).status_code == 404, fid
    assert s4.c.get(f"{base}/{keep['id']}/thumb", headers=s4.h("joni")).status_code == 404, "a document has no thumbnail"
    # a viewer of the ticket without costs.view: an empty list and an audited 403
    tt = s4.c.get(f"{API}/tickets/{tid}", headers=s4.h("tom"))
    if tt.status_code == 200 and tt.json().get("rfq_origin"):
        assert tt.json()["rfq_origin"]["vendor_files"] == []
        assert s4.c.get(f"{base}/{keep['id']}", headers=s4.h("tom")).status_code == 403
    assert s4.c.get(f"{base}/{keep['id']}", headers=s4.h("nora")).status_code == 404
    # the vendor's handler page of the work order shows NO vendor files (he has the originals) and no public route reads them
    ticket_tok = s4.token_of(tid)
    tv = c.get("/t/api/ticket", headers=hdr(ticket_tok)).json()
    assert keep["id"] not in json.dumps(tv)
    assert c.get(f"/t/api/ticket/rfq-file/{keep['id']}", headers=hdr(ticket_tok)).content == UNIFORM_404
    # the request is purged: the referenced files stay with the work order, the rest goes
    r = s4.c.delete(f"{API}/tickets/rfqs/{d['id']}", headers=s4.h("joni"))
    assert r.status_code == 200, r.text
    assert s4.c.get(f"{base}/{keep['id']}", headers=s4.h("joni")).status_code == 200
    with s4.db.connection(mode="read") as conn:
        left = sorted((x[0], x[1]) for x in conn.execute("SELECT id, rfq_id FROM ticket_rfq_vendor_files"))
    assert left == sorted([(keep["id"], None), (qfile["id"], None)])
    assert len(files_on_disk(s4)) == 2
    # the work order's references gone (its purge), the janitor drops the rows; the orphan sweeps then remove the files
    with s4.db.connection() as conn:
        conn.execute("DELETE FROM ticket_rfq_vendor_file_refs WHERE ticket_id = ?", (tid,))
        assert store_rfq.drop_orphan_vendor_files(conn) == 2
