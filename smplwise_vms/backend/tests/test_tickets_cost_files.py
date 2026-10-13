"""CR-038 invoice files (services/tickets/cost_files.py, spec 11A.6 / 11A.6A): the PDF acceptance checks exactly as the spec
lists them (magic, trailer, size, the active-content / encryption names - matched as PDF name tokens, `#xx` escapes decoded),
the bounded inflate of FlateDecode streams (code review V7), the document grouping limits (3 documents, 10 pages, 25
files, duplicates) and the download / inline headers. Every PDF here is hand-written and harmless."""
from __future__ import annotations

import zlib

import pytest

from smplwise.services.tickets import cost_files as cf
from smplwise.services.tickets.image_intake import IntakeError


def pdf(*objects: bytes, trailer: bytes = b"<< /Root 1 0 R >>", tail: bytes = b"\n") -> bytes:
    body = b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n"
    body += b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    body += b"2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n"
    for i, obj in enumerate(objects, start=3):
        body += f"{i} 0 obj\n".encode() + obj + b"\nendobj\n"
    return body + b"trailer\n" + trailer + b"\nstartxref\n0\n%%EOF" + tail


def test_a_plain_invoice_pdf_is_accepted():
    data = pdf(b"<< /Type /Page /Contents 4 0 R >>", b"<< /Length 20 >>\nstream\nBT /F1 12 Tf ET\nendstream")
    info = cf.check_pdf(data)
    assert info.bytes == len(data) and len(info.sha256) == 64


@pytest.mark.parametrize("name", [b"JavaScript", b"JS", b"Launch", b"EmbeddedFile", b"RichMedia", b"XFA", b"OpenAction", b"AA"])
def test_every_active_content_name_is_refused(name):
    data = pdf(b"<< /Type /Action /S /" + name + b" (app.alert(1)) >>")
    with pytest.raises(IntakeError) as e:
        cf.check_pdf(data)
    assert (e.value.code, e.value.status) == ("pdf_refused", 422)


def test_encrypted_pdfs_are_refused():
    with pytest.raises(IntakeError) as e:
        cf.check_pdf(pdf(trailer=b"<< /Root 1 0 R /Encrypt 5 0 R /ID [<00><00>] >>"))
    assert e.value.code == "pdf_refused"


@pytest.mark.parametrize("spelling", [b"/J#61vaScript", b"/#4A#53", b"/Open#41ction", b"/#41#41", b"/Encr#79pt", b"/JS\n", b"/JS(", b"/AA<<"])
def test_hex_escaped_and_delimiter_adjacent_names_are_caught(spelling):
    with pytest.raises(IntakeError) as e:
        cf.check_pdf(pdf(b"<< /S " + spelling + b" (x) >>"))
    assert e.value.code == "pdf_refused"


@pytest.mark.parametrize("lookalike", [b"/JSON", b"/AAPL", b"/JSX", b"/Launcher", b"/OpenActionX", b"/javascript", b"/js"])
def test_names_that_only_look_alike_are_not_refused(lookalike):
    """Exact name tokens: a naive substring search would refuse these; PDF names are case-sensitive and whole."""
    cf.check_pdf(pdf(b"<< " + lookalike + b" 1 >>"))


def test_magic_trailer_and_size_rules():
    with pytest.raises(IntakeError) as e:
        cf.check_pdf(b" " + pdf())  # %PDF- must be at offset 0
    assert (e.value.code, e.value.status) == ("unsupported_format", 415)
    with pytest.raises(IntakeError) as e:
        cf.check_pdf(pdf().replace(b"%%EOF", b"%%EOX"))
    assert (e.value.code, e.value.status) == ("pdf_invalid", 422)
    with pytest.raises(IntakeError) as e:
        cf.check_pdf(pdf(tail=b"\n" + b" " * 1100))  # %%EOF farther than 1 KiB from the end
    assert e.value.code == "pdf_invalid"
    cf.check_pdf(pdf(tail=b"\n" + b" " * 900))
    with pytest.raises(IntakeError) as e:
        cf.check_pdf(b"%PDF-1.4\n" + b"0" * cf.PDF_MAX_BYTES)
    assert (e.value.code, e.value.status) == ("too_large", 413)
    for not_pdf in (b"", b"\xff\xd8\xff", b"<html>"):
        with pytest.raises(IntakeError):
            cf.check_pdf(not_pdf)


def _flate(data: bytes) -> bytes:
    packed = zlib.compress(data)
    return b"<< /Filter /FlateDecode /Length " + str(len(packed)).encode() + b" >>\nstream\n" + packed + b"\nendstream"


def test_names_inside_a_compressed_object_stream_are_seen_after_a_bounded_inflate():
    """Slice 9 (code review V7): the FlateDecode streams are inflated (bounded) and scanned with the same rule - the common
    PDF 1.5+ shape is no longer a way past the filter. The scan stays a FILTER: a stream that does not inflate cleanly is skipped
    (the stated limit of 11A.6 moves there); the real controls stay download-only, sandboxed, never rendered."""
    hidden = zlib.compress(b"<< /Type /Catalog /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>")
    objstm = b"<< /Type /ObjStm /N 1 /First 4 /Filter /FlateDecode /Length " + str(len(hidden)).encode() + b" >>\nstream\n" + hidden + b"\nendstream"
    data = pdf(objstm)
    assert b"JavaScript" not in data
    with pytest.raises(IntakeError) as e:
        cf.check_pdf(data)
    assert e.value.code == "pdf_refused"
    cf.check_pdf(pdf(_flate(b"BT /F1 12 Tf 72 712 Td (Invoice 1042) Tj ET")))


def test_a_deflate_bomb_inside_a_pdf_is_refused_at_the_bound():
    with pytest.raises(IntakeError) as e:
        cf.check_pdf(pdf(_flate(bytes(8 * 1024 * 1024))))
    assert e.value.code == "pdf_refused"


def test_a_stream_that_does_not_inflate_is_skipped_not_fatal():
    cf.check_pdf(pdf(b"<< /Filter /FlateDecode /Length 9 >>\nstream\nnot-zlib!\nendstream"))


def test_the_scan_stays_cheap_on_crafted_files():
    """A 10 MiB file made of name tokens must not buy seconds of CPU per upload (the scan is one C-level search for the plain
    spellings; escaped names are decoded one by one, at most MAX_ESCAPED_NAMES)."""
    import time

    from conftest import sw_time_factor

    filler = b"%PDF-1.7\n" + b"/a" * (4 * 1024 * 1024) + b"\n%%EOF\n"
    t0 = time.perf_counter()
    cf.check_pdf(filler)
    assert time.perf_counter() - t0 < 1.5 * sw_time_factor()
    escapes = b"%PDF-1.7\n" + b"/#41" * (2 * 1024 * 1024) + b"\n%%EOF\n"
    t0 = time.perf_counter()
    with pytest.raises(IntakeError) as e:
        cf.check_pdf(escapes)
    assert e.value.code == "pdf_refused" and time.perf_counter() - t0 < 1.5 * sw_time_factor()
    assert cf.active_markers(b"/JS#20 /A#41#41x") == set()  # "JS " and "AAx" are other names


def test_claim_file_kind_by_content():
    assert cf.claim_file_kind(b"%PDF-1.7") == "pdf"
    assert cf.claim_file_kind(b"\xff\xd8\xff\xe0") == "photo"
    assert cf.claim_file_kind(b"\x89PNG\r\n\x1a\n") == "photo"
    assert cf.claim_file_kind(b"RIFF\x00\x00\x00\x00WEBP") is None and cf.claim_file_kind(b"<html>") is None


# ---------------------------------------------------------------- documents of one claim revision

NOW = 1_800_000_000.0


def pending(n: int, *, kind: str = "photo", link: str = "L1", age: float = 60.0, sha: str | None = None) -> cf.PendingFile:
    return cf.PendingFile(id=f"f{n:03d}", link_id=link, kind=kind, sha256=sha or f"{n:064x}", bytes=1000, created_at=NOW - age)


def pool(*files: cf.PendingFile) -> dict[str, cf.PendingFile]:
    return {f.id: f for f in files}


def test_three_documents_of_up_to_ten_pages_and_25_files():
    files = [pending(i) for i in range(1, 26)]
    docs = [[f.id for f in files[0:10]], [f.id for f in files[10:20]], [f.id for f in files[20:25]]]
    out = cf.assemble_documents(docs, pool(*files), link_id="L1", now=NOW)
    assert [len(d) for d in out] == [10, 10, 5] and out[0][0].id == "f001"
    pdf_doc = pending(99, kind="pdf")
    out = cf.assemble_documents([[pdf_doc.id], ["f001", "f002"]], pool(pdf_doc, *files), link_id="L1", now=NOW)
    assert out[0][0].kind == "pdf"


@pytest.mark.parametrize("docs,code", [
    ([["f001"], ["f002"], ["f003"], ["f004"]], "too_many_documents"),
    ([[]], "empty_document"),
    ([[f"f{i:03d}" for i in range(1, 12)]], "too_many_pages"),
    ([["f001", "f001"]], "file_reused"),
    ([["f001"], ["f001"]], "file_reused"),
    ([["nope"]], "unknown_file"),
    ([["f500"]], "unknown_file"),  # another link's file reads as unknown
    ([["f600"]], "expired_file"),
    ([["f700", "f001"]], "mixed_document"),
    ([["f700", "f701"]], "mixed_document"),
    ([["f001", "f800"]], "duplicate_file"),
])
def test_document_refusals(docs, code):
    files = [pending(i) for i in range(1, 30)] + [pending(500, link="L2"), pending(600, age=cf.PENDING_TTL_S + 1),
                                                   pending(700, kind="pdf"), pending(701, kind="pdf"), pending(800, sha=f"{1:064x}")]
    with pytest.raises(cf.DocumentProblem) as e:
        cf.assemble_documents(docs, pool(*files), link_id="L1", now=NOW)
    assert e.value.code == code


def test_more_than_25_files_overall_is_refused():
    files = [pending(i) for i in range(1, 40)]
    docs = [[f"f{i:03d}" for i in range(1, 11)], [f"f{i:03d}" for i in range(11, 21)], [f"f{i:03d}" for i in range(21, 27)]]
    with pytest.raises(cf.DocumentProblem) as e:
        cf.assemble_documents(docs, pool(*files), link_id="L1", now=NOW)
    assert (e.value.code, e.value.index) == ("too_many_files", 2)


@pytest.mark.parametrize("key,page,expected", [(None, None, (None, None)), ("doc-1", "3", ("doc-1", 3)), ("A_b", 10, ("A_b", 10)), ("", "", (None, None))])
def test_page_fields(key, page, expected):
    assert cf.page_fields(key, page) == expected


@pytest.mark.parametrize("key,page", [("../x", None), ("x" * 33, None), ("a b", None), (None, "0"), (None, "11"), (None, "2.5"),
                                      (None, True), (None, "9" * 5000), (5, None)])
def test_page_fields_refusals(key, page):
    with pytest.raises(ValueError):
        cf.page_fields(key, page)


def test_pending_file_quota_per_link():
    cf.check_pending_quota(29)
    with pytest.raises(IntakeError) as e:
        cf.check_pending_quota(30)
    assert (e.value.code, e.value.status) == ("file_limit", 409)


def test_download_and_inline_headers():
    h = cf.pdf_download_headers(1042, 2)
    assert h == {"Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="ticket-1042-invoice-2.pdf"',
                 "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox", "Cache-Control": "private, no-store"}
    p = cf.photo_headers(1042)
    assert p["Content-Type"] == "image/jpeg" and p["Content-Disposition"] == 'inline; filename="ticket-1042.jpg"'
    assert p["X-Content-Type-Options"] == "nosniff" and p["Cache-Control"] == "private, no-store"
    for bad in ("1042\"; x=1", -1, "abc"):
        with pytest.raises(ValueError):
            cf.pdf_download_headers(bad, 1)  # type: ignore[arg-type]
