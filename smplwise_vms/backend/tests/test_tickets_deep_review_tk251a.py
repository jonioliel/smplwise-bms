"""TK251A - the non-blocking findings of the deep security review of 2026-10-15 (upload pipeline A1/A2/A3/A5, inbound path
B2/B5; B1/B3/B4 are pinned over the real store in test_tickets_s5b_channel.py). Every PDF, number and text here is hand-made
and harmless."""
from __future__ import annotations

import struct
import unicodedata
import zlib

import pytest

from smplwise.services.tickets import cost_files as cf
from smplwise.services.tickets import inbound
from smplwise.services.tickets import message_templates as mt
from smplwise.services.tickets.image_intake import IntakeError

HIDDEN = b"<< /Type /Catalog /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>"


def pdf(*objects: bytes) -> bytes:
    body = b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n"
    for i, obj in enumerate(objects, start=3):
        body += f"{i} 0 obj\n".encode() + obj + b"\nendobj\n"
    return body + b"trailer\n<< /Root 1 0 R >>\nstartxref\n0\n%%EOF\n"


def stream(content: bytes, *, dictionary: bytes = b"/Type /ObjStm /N 1 /First 4 /Filter /FlateDecode", keyword: bytes = b"stream\n",
           length: bytes | None = None) -> bytes:
    n = str(len(content)).encode() if length is None else length
    return b"<< " + dictionary + b" /Length " + n + b" >>\n" + keyword + content + b"\nendstream"


def refused(data: bytes) -> None:
    with pytest.raises(IntakeError) as e:
        cf.check_pdf(data)
    assert (e.value.code, e.value.status) == ("pdf_refused", 422)


# ---------------------------------------------------------------- A1: every end-of-line form after the `stream` keyword


@pytest.mark.parametrize("keyword", [b"stream\r", b"stream \r\n", b"stream\t\n", b"stream  \n", b"stream \r"])
def test_a1_a_stream_after_a_lone_cr_or_trailing_blanks_is_inflated_and_scanned(keyword):
    data = pdf(stream(zlib.compress(HIDDEN), keyword=keyword))
    assert b"OpenAction" not in data
    refused(data)


def test_a1_the_plain_forms_stay_scanned_and_a_clean_file_stays_accepted():
    for keyword in (b"stream\n", b"stream\r\n"):
        refused(pdf(stream(zlib.compress(HIDDEN), keyword=keyword)))
        content = zlib.compress(b"BT /F1 11 Tf (Invoice 42) Tj ET\n" * 50)
        cf.check_pdf(pdf(stream(content, dictionary=b"/Filter /FlateDecode", keyword=keyword)))
    cf.check_pdf(pdf(stream(zlib.compress(b"BT ET"), dictionary=b"/Filter /FlateDecode", keyword=b"stream\r")))


# ---------------------------------------------------------------- A2: predictors and Flate filter chains


@pytest.mark.parametrize("parms", [b"/DecodeParms << /Predictor 12 /Columns 5 >>", b"/DecodeParms<</Predictor 2/Colors 1>>",
                                   b"/DecodeParms << /Pr#65dictor 11 /Columns 4 >>", b"/DecodeParms [ << /Predictor 10 >> ]"])
def test_a2_an_object_stream_with_a_predictor_is_refused(parms):
    data = pdf(stream(zlib.compress(b"1 0 << /Producer (x) >>"), dictionary=b"/Type /ObjStm /N 1 /First 4 /Filter /FlateDecode " + parms))
    refused(data)


@pytest.mark.parametrize("parms", [b"/DecodeParms 9 0 R", b"/DecodeParms [ 9 0 R ]"])
def test_a2_indirect_decode_parameters_are_refused(parms):
    """A predictor may also hide in an indirect dictionary the scan cannot follow: refused (no invoice writer does this)."""
    refused(pdf(stream(zlib.compress(b"1 0 << >>"), dictionary=b"/Type /ObjStm /N 1 /First 4 /Filter /FlateDecode " + parms)))


@pytest.mark.parametrize("filt", [b"[/FlateDecode /FlateDecode]", b"[ /FlateDecode/Fl ]", b"[/Fl#61teDecode /FlateDecode]",
                                  b"[/FlateDecode /ASCII85Decode /FlateDecode]"])
def test_a2_a_filter_chain_naming_flate_twice_is_refused(filt):
    twice = zlib.compress(zlib.compress(HIDDEN))
    refused(pdf(stream(twice, dictionary=b"/Type /ObjStm /N 1 /First 4 /Filter " + filt)))


def test_a2_a_filter_held_indirectly_is_refused():
    refused(pdf(stream(zlib.compress(b"1 0 << >>"), dictionary=b"/Type /ObjStm /N 1 /First 4 /Filter 9 0 R")))


def test_a2_doubly_deflated_content_is_inflated_again_and_scanned():
    """Even when no dictionary admits it (the filter array forged away), output that is itself a zlib stream is inflated again
    (within the same bound) and scanned."""
    twice = zlib.compress(zlib.compress(HIDDEN))
    refused(pdf(stream(twice, dictionary=b"/Filter /FlateDecode")))
    thrice = zlib.compress(zlib.compress(zlib.compress(HIDDEN)))
    refused(pdf(stream(thrice, dictionary=b"/Filter /FlateDecode")))


def test_a2_a_cross_reference_stream_keeps_its_predictor():
    """PDF 1.5+ writers (Word, Chrome, LibreOffice) put PNG predictors on the cross-reference stream: exempt by /Type /XRef."""
    rows = b"".join(b"\x02" + bytes([1, 0, i, 0]) for i in range(8))
    xref = stream(zlib.compress(rows), dictionary=b"/Type /XRef /Size 8 /W [1 2 1] /Root 1 0 R /Filter /FlateDecode "
                                                  b"/DecodeParms << /Columns 4 /Predictor 12 >>")
    content = stream(zlib.compress(b"BT /F1 11 Tf (Invoice) Tj ET"), dictionary=b"/Filter /FlateDecode")
    data = pdf(b"<< /Type /Page /Contents 4 0 R >>", content, xref)
    assert cf.check_pdf(data).bytes == len(data)
    cf.check_pdf(pdf(stream(zlib.compress(rows), dictionary=b"/Type/XRef/W[1 2 1]/Filter/FlateDecode/DecodeParms<</Columns 4/Predictor 12>>")))


@pytest.mark.parametrize("dictionary", [
    b"/Type /XRef /Type /ObjStm /Filter /FlateDecode /DecodeParms << /Predictor 12 /Columns 4 >>",
    b"/Type /ObjStm /Subtype /XRef /Filter /FlateDecode /DecodeParms << /Predictor 12 /Columns 4 >>",
    b"/Type /XRefX /Filter /FlateDecode /DecodeParms << /Predictor 12 /Columns 4 >>",
])
def test_a2_the_xref_exemption_cannot_be_borrowed(dictionary):
    refused(pdf(stream(zlib.compress(b"1 0 << >>"), dictionary=dictionary)))


@pytest.mark.parametrize("dictionary", [
    # a fake object header inside a literal string must not cut the real dictionary (with its /Predictor) off
    b"/Type /ObjStm /DecodeParms << /Predictor 12 /Columns 4 >> /Filter /FlateDecode /Note (1 0 obj /Type /XRef)",
    b"/Type /ObjStm /DecodeParms << /Predictor 12 /Columns 4 >> /Filter /FlateDecode /Note (x 1 0 obj \\( /Type /XRef )",
    b"/Type /ObjStm /DecodeParms << /Predictor 12 /Columns 4 >> /Filter /FlateDecode /Note ((1 0 obj /Type /XRef) )",
])
def test_a2_a_header_faked_inside_a_string_grants_no_exemption(dictionary):
    refused(pdf(stream(zlib.compress(b"1 0 << >>"), dictionary=dictionary)))


def test_a2_a_cross_reference_stream_with_literal_string_ids_keeps_its_predictor():
    rows = b"".join(b"\x02" + bytes([1, 0, i, 0]) for i in range(4))
    cf.check_pdf(pdf(stream(zlib.compress(rows), dictionary=b"/Type /XRef /W [1 2 1] /ID [(a\\)b) (c(d)e)] /Filter /FlateDecode "
                                                         b"/DecodeParms << /Columns 4 /Predictor 12 >>")))


@pytest.mark.parametrize("filler", [b"(" * 8000, b"1 " * 4000, b"/DecodeParms[" * 600, b"/Filter[" * 1000, b"9 " * 2000 + b"0 obj ",
                                    b"\\(" * 4000, b"x obj " * 1300], ids=["parens", "numbers", "parms-arrays", "filter-arrays", "headers", "escapes", "obj-words"])
def test_a2_the_dictionary_checks_stay_cheap_on_crafted_windows(filler):
    """Every stream re-reads up to 8 KiB of dictionary: bounded patterns and a bounded string check keep a crafted 10 MiB file
    (about a thousand such streams) under the same time budget as the other scan tests."""
    import time

    from conftest import sw_time_factor

    one = b"9 0 obj\n<< " + filler + b" /Filter /FlateDecode /Length 9 >>\nstream\n" + zlib.compress(b"x") + b"\nendstream\nendobj\n"
    data = b"%PDF-1.7\n" + one * max(1, (cf.PDF_MAX_BYTES - 1024) // len(one)) + b"%%EOF\n"
    t0 = time.perf_counter()
    try:
        cf.check_pdf(data)
    except IntakeError:
        pass
    assert time.perf_counter() - t0 < 1.5 * sw_time_factor()


def test_a2_the_named_residual_other_filters_stay_undecoded():
    """Unchanged known limit (c): an ASCIIHex stream is not decoded (see test_tickets_cost_files)."""
    hidden = HIDDEN.hex().encode() + b">"
    cf.check_pdf(pdf(stream(hidden, dictionary=b"/Type /ObjStm /Filter /ASCIIHexDecode")))


# ---------------------------------------------------------------- A3: a direct /Length beats an early `endstream`


def _stored_then_deflated(stored: bytes, payload: bytes) -> bytes:
    """A zlib stream: one stored (level-0) block holding `stored` verbatim, then a compressed final block of `payload`."""
    raw = bytes([0x00]) + struct.pack("<HH", len(stored), len(stored) ^ 0xFFFF) + stored
    co = zlib.compressobj(9, zlib.DEFLATED, -15)
    raw += co.compress(payload) + co.flush()
    return b"\x78\x01" + raw + struct.pack(">I", zlib.adler32(stored + payload))


def test_a3_an_endstream_literal_inside_a_stored_block_does_not_end_the_scan():
    body = _stored_then_deflated(b"filler endstream filler ", HIDDEN)
    assert zlib.decompress(body) == b"filler endstream filler " + HIDDEN
    data = pdf(stream(body))
    assert b"OpenAction" not in data and b"JavaScript" not in data
    refused(data)


def test_a3_an_indirect_or_wrong_length_falls_back_to_the_literal_search():
    body = zlib.compress(HIDDEN)
    refused(pdf(stream(body, length=b"12 0 R")))
    refused(pdf(stream(body, length=b"3")))  # does not land on `endstream`: the literal search decides, as before
    refused(pdf(stream(body, length=b"999999")))
    clean = zlib.compress(b"BT (ok) Tj ET")
    cf.check_pdf(pdf(stream(clean, dictionary=b"/Filter /FlateDecode", length=b"12 0 R")))


def test_a3_the_inflate_bound_still_holds_with_a_length():
    bomb = zlib.compress(b"\x00" * (64 * 1024 * 1024), 9)
    refused(pdf(stream(bomb, dictionary=b"/Filter /FlateDecode")))


# ---------------------------------------------------------------- A5: the per-link pending bytes next to the count


def test_a5_the_pending_quota_counts_bytes_as_well_as_files():
    cf.check_pending_quota(0)
    cf.check_pending_quota(29, cf.MAX_PENDING_BYTES_PER_LINK - 1)
    assert cf.MAX_PENDING_BYTES_PER_LINK == 64 * cf.MiB
    for count, size in ((30, 0), (1, cf.MAX_PENDING_BYTES_PER_LINK), (0, cf.MAX_PENDING_BYTES_PER_LINK + 1)):
        with pytest.raises(IntakeError) as e:
            cf.check_pending_quota(count, size)
        assert (e.value.code, e.value.status) == ("file_limit", 409)


# ---------------------------------------------------------------- B3: the migration (0086)


def test_b3_the_migration_adds_the_generation_column_with_a_check_and_no_transaction_of_its_own(settings):
    import re
    import sqlite3

    from smplwise import db as dbmod

    files = list(dbmod.MIGRATIONS_DIR.glob("*_ticket_outbox_link_generation.sql"))
    assert len(files) == 1
    sql = files[0].read_text(encoding="utf-8")
    assert not re.search(r"^\s*(BEGIN|COMMIT)\b", sql, re.M | re.I)
    database = dbmod.Database(settings.db_path)
    database.migrate()
    with database.connection() as conn:
        cols = {r[1]: r for r in conn.execute("PRAGMA table_info(ticket_outbox)").fetchall()}
        assert "link_generation" in cols and cols["link_generation"][3] == 0, "nullable: old rows may stay NULL"
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute("INSERT INTO ticket_outbox(id, recipient_kind, channel, purpose, use_key, state, not_before, created_at, updated_at, "
                         "link_generation) VALUES ('x', 'contact', 'whatsapp', 'assign', 'tickets.messages', 'queued', 'a', 'a', 'a', 0)")


# ---------------------------------------------------------------- B2: inbound content and sender name through clean_text


def _event(content: str, name: str = "Vendor") -> dict:
    return {"event_type": "whatsapp_message_received",
            "data": {"sender_number": "15555550191", "sender_name": name, "content": content, "type": "text", "timestamp": 1_800_000_000}}


def test_b2_inbound_text_is_nfc_without_surrogates_noncharacters_or_zalgo():
    msg = inbound.normalise(_event("שָלֹום\ud800 x﷐y￿ z" + "́" * 40 + "‮1"))
    assert msg is not None
    text = msg.content
    assert "\ud800" not in text and "﷐" not in text and "￿" not in text and "‮" not in text
    assert text.count("́") <= 8
    assert text == unicodedata.normalize("NFC", text)
    assert inbound.normalise(_event("café")).content == "café", "decomposed input arrives precomposed (NFC)"
    inbound.dedupe_key(msg, "k")  # a lone surrogate no longer reaches the UTF-8 encoder (the B1 crash path)


def test_b2_a_decomposed_reply_digit_still_parses_and_lines_stay():
    msg = inbound.normalise(_event("  1  "))
    assert msg is not None and msg.content == "1" and inbound.parse_reply(msg.content)[1] == "ack"
    msg = inbound.normalise(_event("אגיע מחר\r\n\r\n\r\nבבוקר סוף"))
    assert msg is not None and msg.content == "אגיע מחר\n\nבבוקר\nסוף"


def test_b2_the_sender_name_is_one_clean_line():
    msg = inbound.normalise(_event("1", name="Ben‮​ Vendor\nSecond\ud800" + "̀" * 30))
    assert msg is not None
    assert msg.sender_name.startswith("Ben Vendor Second") and "\n" not in msg.sender_name and "\ud800" not in msg.sender_name
    assert msg.sender_name.count("̀") <= 8


def test_b2_a_huge_inbound_text_is_too_long_without_a_full_scan():
    msg = inbound.normalise(_event("א" * 2_000_000))
    assert msg is not None and msg.content_too_long is True and len(msg.content) <= inbound.CONTENT_MAX


# ---------------------------------------------------------------- B5: a bare domain followed by a path


@pytest.mark.parametrize("body", ["שלום {link} evil.example/x", "שלום {link} login.evil-bank.co.il/reset", "{link}\nפרטים: example.com/a?b=1",
                                  "{link} EXAMPLE.ORG/path", "{link} שלום.קום/דף"])
def test_b5_a_bare_domain_with_a_path_is_refused(body):
    assert {"code": "url_not_link", "field": "body"} in mt.problems("assign", body)


@pytest.mark.parametrize("body", ["שלום {name}! מספר {number}\n{link}", "{link} מחיר 1.5/2 ש\"ח", "{link} גרסה 2.5.6/ב", "{link} בין 08:00/09:00",
                                  "{link} יחידה 3.2 / קומה 4", "{link} a/b"])
def test_b5_ordinary_text_with_dots_and_slashes_is_not_a_url(body):
    assert not any(p["code"] == "url_not_link" for p in mt.problems("assign", body))


def test_b5_every_starter_template_still_passes():
    for purpose, langs in mt.STARTERS.items():
        for lang, body in langs.items():
            assert not any(p["code"] == "url_not_link" for p in mt.problems(purpose, body)), (purpose, lang)
