"""SUPPLIERDOCS-297 (docs/changes/CR-SUPPLIERDOCS-297.md): reading a supplier certificate that is already attached to a maintenance
certificate / supplier-document task. NEGATIVE FIRST: the switch is OFF by default (uniform 404), permissions and visibility follow the
task, an image or a scanned PDF needs OCR (not in this slice), no reader binary is a clean 503. Then: the read stores PROPOSALS only
(the task itself never changes), every field is decided on its own (confirm / edit / reject - there is no "approve all"), the audit
carries ids and counts, never a value, and drafts are purged.

Same cast and fakes as test_maintenance_215.py (joni system_admin, tom operator = view only, fred floor 2, gil floor 3, vic viewer).
The text reader is a FAKE returning synthetic text, except the one test that runs the real `pdftotext` on a synthetic PDF when the
binary is installed (skipped otherwise - reported as skipped, never as passed)."""
from __future__ import annotations

import datetime as dt
import json
import shutil
from pathlib import Path

import pytest
from test_maintenance_215 import API, M, NOW, _round, mw  # noqa: F401  (mw is the fixture)
from test_maintenance_215b import PDF, jpeg

from smplwise.services.docread import ports
from smplwise.services.docread import service as dsvc

D = f"{M}/docread"

CERT_TEXT = """
                         אישור עריכת ביטוח
שם המבוטח: מעליות הדוגמה בע"מ ח.פ. 512345678
מספר פוליסה: 7700-123456
תאריך הנפקה: 05/01/2026
בתוקף עד: 31/12/2027
היקף הכיסוי: ביטוח אחריות מקצועית לעבודות מעליות
\f"""


class FakeReader:
    name = "fake-text"

    def __init__(self, text: str = CERT_TEXT, status: str = "ok", pages: int = 1) -> None:
        self.text, self.status, self.pages, self.calls = text, status, pages, 0

    def read(self, path: Path, *, max_pages: int) -> ports.TextResult:
        self.calls += 1
        assert path.is_file(), "the reader gets the stored file"
        return ports.TextResult(status=self.status, text=self.text if self.status == "ok" else "", pages=self.pages, engine=self.name)


@pytest.fixture()
def reader():
    fake = FakeReader()
    dsvc.set_text_reader(fake)
    yield fake
    dsvc.set_text_reader(None)


def on(mw, docread: bool = True):
    mw.on(reminders=False)
    r = mw.c.patch(f"{API}/settings", json={"docread.enabled": "true" if docread else "false"})
    assert r.status_code == 200, r.text


def doc_with_file(mw, data: bytes = PDF, name: str = "cert.pdf", ctype: str = "application/pdf", **task):
    if "place" in task:  # a supplier document is placeless; a placed certificate (an elevator's inspection) carries the scope
        t = mw.task(kind="certificate", title="תסקיר מעלית", due_date="2027-06-01", **task)
    else:
        t = mw.task(kind="vendor_document", title="ביטוח ספק", vendor_id=mw.vendor("ספק לדוגמה"), doc_type="insurance", due_date="2027-06-01")
    r = mw.c.post(f"{M}/tasks/{t['id']}/files", files={"file": (name, data, ctype)})
    assert r.status_code == 201, r.text
    return t, r.json()


def read(mw, t, f, user: str = "joni"):
    return mw.c.post(f"{M}/tasks/{t['id']}/files/{f['id']}/read", headers=mw.h(user))


def decide(mw, x, field, decision, value=None, user="joni", revision=None):
    body = {"decision": decision, "revision": x["revision"] if revision is None else revision}
    if value is not None:
        body["value"] = value
    return mw.c.put(f"{D}/extractions/{x['id']}/fields/{field}", json=body, headers=mw.h(user))


# ================================================================ NEGATIVE: the switch

def test_the_switch_is_off_by_default_and_every_route_is_the_uniform_404(mw, reader):
    mw.on(reminders=False)
    assert mw.c.get(f"{API}/settings").json()["settings"]["docread.enabled"] == "false"
    t, f = doc_with_file(mw)
    assert mw.c.get(f"{D}/module").json()["enabled"] is False
    for method, path in (("POST", f"{M}/tasks/{t['id']}/files/{f['id']}/read"), ("GET", f"{D}/extractions/x1"),
                         ("PUT", f"{D}/extractions/x1/fields/supplier"), ("POST", f"{D}/extractions/x1/discard"),
                         ("GET", f"{M}/tasks/{t['id']}/files/{f['id']}/extraction")):
        r = mw.c.request(method, path, json={"decision": "reject", "revision": 1} if method == "PUT" else None)
        assert r.status_code == 404 and r.json()["code"] == "feature_disabled", (method, path, r.text)
    assert reader.calls == 0 and mw.rows("SELECT COUNT(*) FROM doc_extractions")[0][0] == 0


def test_the_switch_needs_system_configure_is_validated_and_the_maintenance_module_gates_everything(mw, reader):
    mw.on(reminders=False)
    assert mw.c.patch(f"{API}/settings", json={"docread.enabled": "true"}, headers=mw.h("tom")).status_code == 403
    assert mw.c.patch(f"{API}/settings", json={"docread.enabled": "yes"}).status_code == 422
    on(mw)
    assert len(mw.audits("docread.enable", "allowed")) == 1
    t, f = doc_with_file(mw)
    assert mw.c.patch(f"{API}/settings", json={"maintenance.enabled": "false"}).status_code == 200
    assert mw.c.get(f"{D}/module").json()["code"] == "feature_disabled"
    assert read(mw, t, f).json()["code"] == "feature_disabled"


def test_the_module_state_names_the_provisional_scope(mw):
    on(mw)
    m = mw.c.get(f"{D}/module").json()
    assert m == {"enabled": True, "kinds": ["certificate"], "fields": ["supplier", "document_number", "issue_date", "expiry_date", "scope"],
                 "text_reader": m["text_reader"], "ocr": False, "model": "none", "confirm": "per_field", "provisional": True}


# ================================================================ NEGATIVE: permissions and visibility

def test_reading_needs_manage_on_the_task_and_an_invisible_task_is_404(mw, reader):
    on(mw)
    t, f = doc_with_file(mw)
    r = read(mw, t, f, user="tom")
    assert r.status_code == 403 and r.json()["details"]["permission"] == "maintenance.manage"
    assert any(a["actor_user_id"] == "dev-tom" for a in mw.audits("docread.read", "denied"))
    floor_t, floor_f = doc_with_file(mw, place=mw.floor("floor2"))
    assert read(mw, floor_t, floor_f, user="gil").status_code == 404, "gil (floor 3) cannot see a floor-2 task"
    assert read(mw, t, {"id": "nope"}).json()["code"] == "maint_file_not_found"
    assert reader.calls == 0 and mw.rows("SELECT COUNT(*) FROM doc_extractions")[0][0] == 0


def test_only_certificates_and_supplier_documents_are_read(mw, reader):
    on(mw)
    rnd = _round(mw)
    r = mw.c.post(f"{M}/tasks/{rnd['id']}/files/f1/read")
    assert r.status_code == 409 and r.json()["code"] == "docread_kind_not_supported"


def test_viewing_needs_view_and_deciding_needs_manage(mw, reader):
    on(mw)
    t, f = doc_with_file(mw)
    x = read(mw, t, f).json()
    assert mw.c.get(f"{D}/extractions/{x['id']}", headers=mw.h("tom")).status_code == 200, "an operator sees the proposal"
    assert mw.c.get(f"{D}/extractions/{x['id']}", headers=mw.h("vic")).status_code in (403, 404)
    assert decide(mw, x, "supplier", "confirm", user="tom").status_code == 403
    assert mw.c.post(f"{D}/extractions/{x['id']}/discard", headers=mw.h("tom")).status_code == 403
    floor_t, floor_f = doc_with_file(mw, place=mw.floor("floor2"))
    fx = read(mw, floor_t, floor_f).json()
    assert mw.c.get(f"{D}/extractions/{fx['id']}", headers=mw.h("gil")).status_code == 404
    assert mw.c.get(f"{D}/extractions/{fx['id']}", headers=mw.h("fred")).status_code == 200


# ================================================================ NEGATIVE: what this slice cannot read

def test_a_picture_needs_ocr_which_is_not_in_this_slice(mw, reader):
    on(mw)
    t, f = doc_with_file(mw, data=jpeg(), name="scan.jpg", ctype="image/jpeg")
    r = read(mw, t, f)
    assert r.status_code == 201, r.text
    x = r.json()
    assert x["state"] == "needs_ocr" and x["error_code"] == "ocr_not_available" and x["fields"] == {}
    assert reader.calls == 0, "a picture never reaches the text reader"


@pytest.mark.parametrize(("status", "state", "code"), [("no_text", "needs_ocr", "no_text_layer"), ("unreadable", "failed", "unreadable"),
                                                       ("too_many_pages", "failed", "too_many_pages"), ("timeout", "failed", "timeout")])
def test_reader_outcomes_are_plain_states_never_a_500(mw, reader, status, state, code):
    on(mw)
    t, f = doc_with_file(mw)
    reader.status = status
    x = read(mw, t, f).json()
    assert (x["state"], x["error_code"], x["fields"]) == (state, code, {})


def test_no_text_reader_installed_is_a_clean_503_and_nothing_is_stored(mw):
    on(mw)
    dsvc.set_text_reader(ports.NullTextReader())
    try:
        t, f = doc_with_file(mw)
        r = read(mw, t, f)
        assert r.status_code == 503 and r.json()["code"] == "reader_unavailable"
        assert mw.rows("SELECT COUNT(*) FROM doc_extractions")[0][0] == 0
    finally:
        dsvc.set_text_reader(None)


# ================================================================ the read stores PROPOSALS only

def test_a_read_proposes_fields_and_changes_nothing_on_the_task(mw, reader):
    on(mw)
    t, f = doc_with_file(mw)
    before = mw.c.get(f"{M}/tasks/{t['id']}").json()
    r = read(mw, t, f)
    assert r.status_code == 201, r.text
    x = r.json()
    assert x["state"] == "proposed" and x["kind"] == "certificate" and x["summary"] == "good" and x["engine"] == "fake-text"
    assert x["task_id"] == t["id"] and x["file_id"] == f["id"] and x["confirm"] == "per_field" and x["provisional"] is True
    exp = x["fields"]["expiry_date"]
    assert exp["proposed"] == "2027-12-31" and exp["status"] == "proposed" and exp["value"] is None and exp["confidence"] == "high"
    assert x["fields"]["supplier"]["proposed"] == 'מעליות הדוגמה בע"מ'
    after = mw.c.get(f"{M}/tasks/{t['id']}").json()
    assert after["due_date"] == before["due_date"] == "2027-06-01" and after["revision"] == before["revision"], "nothing is applied"
    # the same file again: the live proposal comes back, the reader is not run again
    again = read(mw, t, f)
    assert again.status_code == 200 and again.json()["id"] == x["id"] and reader.calls == 1
    assert mw.c.get(f"{M}/tasks/{t['id']}/files/{f['id']}/extraction").json()["id"] == x["id"]


def test_the_stored_row_holds_no_full_text_and_the_audit_no_values(mw, reader):
    on(mw)
    reader.text = CERT_TEXT + ("שורה ארוכה של טקסט מסמך " * 400)
    t, f = doc_with_file(mw)
    x = read(mw, t, f).json()
    stored = mw.rows("SELECT fields_json FROM doc_extractions WHERE id = ?", (x["id"],))[0][0]
    assert len(stored) < 4000 and "שורה ארוכה של טקסט מסמך שורה ארוכה" not in stored and "512345678" not in stored
    decide(mw, x, "supplier", "edit", "ספק מתוקן")
    blob = json.dumps([dict(a) for a in mw.audits("docread.read") + mw.audits("docread.field")], ensure_ascii=False)
    for secret in ("מעליות", "7700-123456", "2027-12-31", "ספק מתוקן", "512345678"):
        assert secret not in blob, secret
    assert mw.audits("docread.read", "allowed") and mw.audits("docread.field", "allowed")


# ================================================================ field-by-field decisions, no "approve all"

def test_every_field_is_decided_on_its_own_and_there_is_no_approve_all(mw, reader):
    on(mw)
    t, f = doc_with_file(mw)
    x = read(mw, t, f).json()
    for path in ("confirm", "approve", "confirm-all", "approve-all", "apply"):
        assert mw.c.post(f"{D}/extractions/{x['id']}/{path}", json={}).status_code in (404, 405), path
    assert mw.c.put(f"{D}/extractions/{x['id']}/fields/all", json={"decision": "confirm", "revision": x["revision"]}).status_code == 422
    assert mw.c.put(f"{D}/extractions/{x['id']}/fields/supplier", json={"decision": "confirm", "revision": x["revision"], "fields": ["scope"]}).status_code == 422
    r = decide(mw, x, "expiry_date", "confirm")
    assert r.status_code == 200, r.text
    x = r.json()
    assert x["fields"]["expiry_date"]["status"] == "confirmed" and x["fields"]["expiry_date"]["value"] == "2027-12-31"
    assert x["fields"]["expiry_date"]["decided_by_name"] and x["state"] == "proposed", "four fields still open"
    assert x["fields"]["supplier"]["status"] == "proposed", "confirming one field touches no other"
    x = decide(mw, x, "supplier", "edit", "  מעליות הדוגמה בע\"מ (סניף צפון)‫ ").json()
    assert x["fields"]["supplier"]["status"] == "edited" and x["fields"]["supplier"]["value"] == 'מעליות הדוגמה בע"מ (סניף צפון)'
    assert x["fields"]["supplier"]["proposed"] == 'מעליות הדוגמה בע"מ', "the proposal is kept beside the person's value"
    x = decide(mw, x, "scope", "reject").json()
    assert x["fields"]["scope"]["status"] == "rejected" and x["fields"]["scope"]["value"] is None
    x = decide(mw, x, "document_number", "confirm").json()
    assert x["state"] == "proposed"
    x = decide(mw, x, "issue_date", "edit", "2026-01-06").json()
    assert x["state"] == "reviewed" and x["reviewed_by_name"], "every field decided -> reviewed"
    # reviewed values are still NOT applied to the task in this slice
    assert mw.c.get(f"{M}/tasks/{t['id']}").json()["due_date"] == "2027-06-01"
    # a decided field can be changed again until the proposal is discarded
    x = decide(mw, x, "scope", "edit", "אחריות מקצועית").json()
    assert x["fields"]["scope"]["status"] == "edited"


def test_confirming_a_field_that_was_not_found_is_refused_but_an_edit_supplies_it(mw, reader):
    on(mw)
    reader.text = "בתוקף עד: 31/12/2027\n\f"
    t, f = doc_with_file(mw)
    x = read(mw, t, f).json()
    assert x["summary"] == "partial" and x["fields"]["scope"]["confidence"] == "none"
    r = decide(mw, x, "scope", "confirm")
    assert r.status_code == 422 and r.json()["code"] == "docread_nothing_to_confirm"
    assert decide(mw, x, "scope", "edit", "מעליות").json()["fields"]["scope"]["value"] == "מעליות"


@pytest.mark.parametrize(("field", "value"), [("expiry_date", "31/12/2027"), ("expiry_date", "2027-02-30"), ("issue_date", "tomorrow"),
                                              ("supplier", ""), ("supplier", "x" * 121), ("document_number", "   ")])
def test_edited_values_are_validated(mw, reader, field, value):
    on(mw)
    t, f = doc_with_file(mw)
    x = read(mw, t, f).json()
    r = decide(mw, x, field, "edit", value)
    assert r.status_code == 422, r.text
    assert mw.c.get(f"{D}/extractions/{x['id']}").json()["fields"][field]["status"] == "proposed"


def test_an_edit_needs_a_value_and_confirm_or_reject_take_none(mw, reader):
    on(mw)
    t, f = doc_with_file(mw)
    x = read(mw, t, f).json()
    assert decide(mw, x, "supplier", "edit").status_code == 422
    assert decide(mw, x, "supplier", "confirm", "other").status_code == 422
    assert decide(mw, x, "supplier", "reject", "other").status_code == 422
    assert decide(mw, x, "supplier", "maybe").status_code == 422


def test_the_revision_guards_a_concurrent_decision(mw, reader):
    on(mw)
    t, f = doc_with_file(mw)
    x = read(mw, t, f).json()
    assert decide(mw, x, "supplier", "confirm").status_code == 200
    r = decide(mw, x, "scope", "confirm")  # the old revision
    assert r.status_code == 409 and r.json()["code"] == "revision_conflict"


def test_discard_drops_the_proposal_values_and_a_new_read_starts_fresh(mw, reader):
    on(mw)
    t, f = doc_with_file(mw)
    x = read(mw, t, f).json()
    r = mw.c.post(f"{D}/extractions/{x['id']}/discard")
    assert r.status_code == 200 and r.json()["state"] == "discarded" and r.json()["fields"] == {}
    assert mw.rows("SELECT fields_json FROM doc_extractions WHERE id = ?", (x["id"],))[0][0] == "{}"
    assert decide(mw, x, "supplier", "confirm", revision=r.json()["revision"]).json()["code"] == "docread_closed"
    y = read(mw, t, f)
    assert y.status_code == 201 and y.json()["id"] != x["id"] and reader.calls == 2


def test_a_deleted_file_hides_its_proposal(mw, reader):
    on(mw)
    t, f = doc_with_file(mw)
    x = read(mw, t, f).json()
    assert mw.c.delete(f"{M}/tasks/{t['id']}/files/{f['id']}").status_code == 200
    assert mw.c.get(f"{D}/extractions/{x['id']}").status_code == 404


# ================================================================ retention

def test_drafts_are_purged_after_the_retention(mw, reader):
    on(mw)
    t, f = doc_with_file(mw)
    x = read(mw, t, f).json()
    with mw.db.connection() as conn:
        assert dsvc.purge(conn, NOW + dt.timedelta(days=dsvc.RETENTION_DAYS - 1)) == 0
        assert dsvc.purge(conn, NOW + dt.timedelta(days=dsvc.RETENTION_DAYS + 1)) == 1
    assert mw.c.get(f"{D}/extractions/{x['id']}").status_code == 404


def test_f6_the_drafts_of_a_deleted_task_are_purged_at_the_next_janitor_pass(mw, reader):
    """F6: a soft-deleted TASK (its files stay attached) left its proposals in the table until the 14-day retention ran out."""
    on(mw)
    t, f = doc_with_file(mw)
    keep_t, keep_f = doc_with_file(mw, place=mw.floor("floor2"))
    x = read(mw, t, f).json()
    keep = read(mw, keep_t, keep_f).json()
    assert mw.c.delete(f"{M}/tasks/{t['id']}").status_code == 200
    with mw.db.connection() as conn:
        assert dsvc.purge(conn, NOW) == 1
    assert mw.rows("SELECT COUNT(*) FROM doc_extractions WHERE id = ?", (x["id"],))[0][0] == 0
    assert mw.rows("SELECT COUNT(*) FROM doc_extractions WHERE id = ?", (keep["id"],))[0][0] == 1


def test_the_table_is_never_in_a_project_backup():
    from smplwise.services import backup as bsvc

    assert "doc_extractions" in bsvc.NEVER_EXPORTED_TABLES and "doc_extractions" not in bsvc.PROJECT_TABLES


# ================================================================ the real pdftotext (only where installed)

def _text_pdf(lines: list[str]) -> bytes:
    """A minimal synthetic text-layer PDF (Helvetica, ASCII) with a correct xref table."""
    content = "BT /F1 12 Tf 72 760 Td 16 TL " + " ".join(f"({ln}) Tj T*" for ln in lines) + " ET"
    objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
            f"<< /Length {len(content)} >>\nstream\n{content}\nendstream", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    out, offsets = bytearray(b"%PDF-1.4\n"), []
    for i, body in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n{body}\nendobj\n".encode("latin-1")
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode() + b"".join(f"{o:010d} 00000 n \n".encode() for o in offsets)
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(out)


@pytest.mark.skipif(shutil.which("pdftotext") is None, reason="pdftotext (poppler-utils) not installed on this machine")
def test_the_real_pdftotext_reader_on_a_synthetic_english_certificate(mw):
    on(mw)
    dsvc.set_text_reader(None)  # the default: pdftotext from PATH
    pdf = _text_pdf(["CERTIFICATE OF INSURANCE", "Name of insured: Example Elevators Ltd.", "Policy No.: POL-2026-0042",
                     "Date of issue: 01/02/2026", "Valid until: 31/01/2028", "Scope: Lift maintenance, standard EN 81-20"])
    t, f = doc_with_file(mw, data=pdf)
    x = read(mw, t, f).json()
    assert x["state"] == "proposed", x
    assert {k: v["proposed"] for k, v in x["fields"].items()} == {"supplier": "Example Elevators Ltd.", "document_number": "POL-2026-0042",
                                                                   "issue_date": "2026-02-01", "expiry_date": "2028-01-31",
                                                                   "scope": "Lift maintenance, standard EN 81-20"}
    assert x["engine"].startswith("pdftotext")


def test_the_pdftotext_reader_maps_the_child_outcomes(monkeypatch, tmp_path):
    from smplwise.services.docread import pdftext

    import sys

    seen: dict = {}
    child = {"status": "ok", "rc": 0, "out": "בתוקף עד: 31/12/2027\n\f".encode()}

    def fake_run_limited(cmd, *, limits, cwd=None, env_extra=None):
        seen.update(cmd=cmd, timeout_s=limits.timeout_s, cap=limits.output_bytes)
        return pdftext.ChildResult(child["status"], child["rc"], child["out"])

    monkeypatch.setattr(pdftext.shutil, "which", lambda name: sys.executable)  # an existing file stands in for the binary
    monkeypatch.setattr(pdftext, "run_limited", fake_run_limited)
    p = tmp_path / "a.pdf"
    p.write_bytes(b"%PDF-1.4\n%%EOF\n")
    res = pdftext.PdftotextReader().read(p, max_pages=10)
    assert res.status == "ok" and res.pages == 1 and "31/12/2027" in res.text
    assert seen["timeout_s"] <= 30 and seen["cap"] == pdftext.OUTPUT_MAX
    assert seen["cmd"][-1] == "-" and "-l" in seen["cmd"] and seen["cmd"][seen["cmd"].index("-l") + 1] == "11"
    # more pages than the cap: refused; an oversized output, a failing tool, a timeout: refused, never a 500
    child["out"] = b"x\f" * 12
    assert pdftext.PdftotextReader().read(p, max_pages=10).status == "too_many_pages"
    child.update(status="too_big", rc=-1, out=b"")
    assert pdftext.PdftotextReader().read(p, max_pages=10).status == "unreadable"
    child.update(status="ok", rc=1, out=b"")
    assert pdftext.PdftotextReader().read(p, max_pages=10).status == "unreadable"
    child.update(status="timeout", rc=-1, out=b"")
    assert pdftext.PdftotextReader().read(p, max_pages=10).status == "timeout"


# ================================================================ security review SUPPLIERDOCS2-297 (regressions)

def _py(code: str) -> list[str]:
    import sys

    # Windows: a venv's python.exe is a launcher that starts the real interpreter as a CHILD, which the reader's Job Object (one active
    # process, security review F4) refuses - use the base interpreter (the snippets need nothing from the venv).
    return [getattr(sys, "_base_executable", sys.executable) or sys.executable, "-I", "-c", code]


def test_f2_the_child_runs_with_the_minimal_environment_and_its_output_is_never_buffered_whole(monkeypatch):
    """F2: `capture_output` held the WHOLE stdout before the size check; a decompression-bomb PDF could make the add-on hold hundreds
    of MiB. The bounded reader stops at cap + 1 bytes and kills the child."""
    import time

    from smplwise.services.docread import pdftext

    monkeypatch.setenv("SUPERVISOR_TOKEN", "secret-token-for-test")
    status, rc, out = pdftext.run_capped(_py("import os,sys; sys.stdout.write(os.environ.get('SUPERVISOR_TOKEN', 'absent'))"), timeout_s=20, cap=1024)
    assert (status, rc, out) == ("ok", 0, b"absent")
    t0 = time.monotonic()
    status, _, out = pdftext.run_capped(_py("import sys\nwhile True: sys.stdout.write('a' * 65536)"), timeout_s=20, cap=4096)
    assert status == "too_big" and out == b"" and time.monotonic() - t0 < 15, "killed at the cap, long before the timeout"
    t0 = time.monotonic()
    status, _, _ = pdftext.run_capped(_py("import time; time.sleep(30)"), timeout_s=1, cap=1024)
    assert status == "timeout" and time.monotonic() - t0 < 10
    assert pdftext.run_capped(["/definitely/not/a/tool-xyz"], timeout_s=1, cap=10)[0] == "unavailable"


def test_f1_the_iban_scrub_is_linear_on_a_crafted_line():
    """F1: `(?:[ ]?[A-Z0-9]{2,4}){3,}\\b` backtracked exponentially - 36 capitals took 0.25 s, the 80-character snippet hours, inside
    the database write lock. The one-character-per-repetition pattern answers at once and still scrubs a real IBAN."""
    import time

    from smplwise.services.docread import certificate_rules as cr

    t0 = time.monotonic()
    for n in (36, 60, 76, 200):
        cr.scrub("AB12" + "A" * n + "a")
    assert time.monotonic() - t0 < 1.0
    assert "IL62" not in cr.scrub("חשבון IL62 0108 0000 0009 9999 999 בנק") and "[…]" in cr.scrub("IBAN GB82WEST12345698765432")
    t0 = time.monotonic()
    x = cr.extract("שם הספק: AB12" + "A" * 70 + "a\nבתוקף עד: 31/12/2027\n")
    assert time.monotonic() - t0 < 1.0 and x.fields["expiry_date"].value == "2027-12-31"


def test_f1_the_rules_run_outside_the_write_lock_and_f3_reads_are_bounded(mw, reader, monkeypatch):
    """F1: the rules ran in `store`, under the database write lock. F3: no bound on reads running at once (discard + read in a loop
    spawned children without limit). Now the route analyses inside `unlocked` and answers 429 `busy` when every slot is taken."""
    on(mw)
    t, f = doc_with_file(mw)
    calls = {"store_ext": None}
    real_store = dsvc.store

    def spy_store(viewer, task, frow, res, rid, ext=None):
        calls["store_ext"] = ext
        return real_store(viewer, task, frow, res, rid, ext)

    monkeypatch.setattr(dsvc, "store", spy_store)
    taken = [dsvc.read_slot() for _ in range(dsvc.READ_CONCURRENCY)]
    try:
        assert all(taken)
        r = read(mw, t, f)
        assert r.status_code == 429 and r.json()["code"] == "busy" and reader.calls == 0
    finally:
        for _ in taken:
            dsvc.release_slot()
    r = read(mw, t, f)
    assert r.status_code == 201, r.text
    assert calls["store_ext"] is not None and calls["store_ext"].fields["expiry_date"].value == "2027-12-31", "analysed before store"
    assert dsvc.read_slot(), "the slot came back after the read"
    dsvc.release_slot()
