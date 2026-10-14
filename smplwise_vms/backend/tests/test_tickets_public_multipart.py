"""CR-038 public listener: the strict in-memory multipart reader (services/tickets/public_multipart.py) - exactly the named
fields, bounded parts, no preamble / epilogue / smuggled parts, and a fuzz run proving it only ever answers with parts or a
MultipartError. Every body is synthesised."""
from __future__ import annotations

import random

import pytest

from smplwise.services.tickets.public_multipart import FieldRule, MultipartError, boundary_of, parse_form

B = b"----WebKitFormBoundaryAbC123xyz"
RULES = {"file": FieldRule(file=True, max_bytes=1000), "client_request_id": FieldRule(file=False, max_bytes=64)}


def body(*parts: tuple[str, bytes, str | None], boundary: bytes = B, epilogue: bytes = b"\r\n") -> bytes:
    out = b""
    for name, data, filename in parts:
        disp = f'form-data; name="{name}"' + (f'; filename="{filename}"' if filename is not None else "")
        out += b"--" + boundary + b"\r\nContent-Disposition: " + disp.encode() + b"\r\n"
        if filename is not None:
            out += b"Content-Type: image/jpeg\r\n"
        out += b"\r\n" + data + b"\r\n"
    return out + b"--" + boundary + b"--" + epilogue


GOOD = body(("file", b"\xff\xd8\xff\xe0JPEGDATA\r\n--not-the-boundary", "a.jpg"), ("client_request_id", b"0f8fad5b-d9cb-469f-a165-70867728950e", None))


def test_a_browser_form_is_read_exactly():
    parts = parse_form(GOOD, B, RULES)
    assert parts["file"].data == b"\xff\xd8\xff\xe0JPEGDATA\r\n--not-the-boundary" and parts["file"].is_file
    assert parts["client_request_id"].text() == "0f8fad5b-d9cb-469f-a165-70867728950e"
    assert parse_form(GOOD[:-2], B, RULES)["file"].data.startswith(b"\xff\xd8")  # no final CRLF is fine


@pytest.mark.parametrize("value,expected", [
    ("multipart/form-data; boundary=" + B.decode(), B),
    ('multipart/form-data; boundary="' + B.decode() + '"', B),
    ("Multipart/Form-Data;boundary=abc", b"abc"),
])
def test_boundary_of(value, expected):
    assert boundary_of(value) == expected


@pytest.mark.parametrize("value", [None, "", "application/json", "multipart/mixed; boundary=a", "multipart/form-data",
                                   "multipart/form-data; boundary=", "multipart/form-data; boundary=" + "a" * 71,
                                   "multipart/form-data; boundary=a; boundary=b", "multipart/form-data; boundary=a\x00b",
                                   'multipart/form-data; boundary="ends-with-space "'])
def test_boundary_refusals(value):
    with pytest.raises(MultipartError):
        boundary_of(value)


@pytest.mark.parametrize("bad,code", [
    (b"preamble\r\n" + GOOD, "structure"),
    (GOOD + b"epilogue", "structure"),
    (body(("file", b"x", "a.jpg"), ("client_request_id", b"id", None), ("extra", b"y", None)), "structure"),  # a smuggled 3rd part
    (body(("extra", b"y", None), ("file", b"x", "a.jpg")), "unknown_field"),
    (body(("file", b"x", "a.jpg"), ("file", b"y", "b.jpg")), "duplicate_field"),
    (body(("file", b"x", None), ("client_request_id", b"id", None)), "file_expected"),
    (body(("file", b"x", "a.jpg"), ("client_request_id", b"id", "id.txt")), "text_expected"),
    (body(("file", b"x" * 1001, "a.jpg"), ("client_request_id", b"id", None)), "field_too_large"),
    (body(("file", b"x", "a.jpg")), "missing_field"),
    (body(("file", b"x", "a.jpg"), ("client_request_id", b"id", None), epilogue=b"")[:-4], "structure"),
    (b"--" + B + b"\r\nContent-Disposition: attachment; name=\"file\"\r\n\r\nx\r\n--" + B + b"--", "disposition"),
    (b"--" + B + b"\r\nContent-Disposition: form-data; name=\"fi le\"\r\n\r\nx\r\n--" + B + b"--", "disposition"),
    (b"--" + B + b"\r\nX-Evil: 1\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a\"\r\n\r\nx\r\n--" + B + b"--", "headers"),
    (b"--" + B + b"\r\nContent-Disposition: form-data; name=\"file\"; filename*=UTF-8''a\r\n\r\nx\r\n--" + B + b"--", "disposition"),
    (b"--" + B + b"\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a\"\r\n" + b"Content-Type: x\r\n" * 5 + b"\r\nx\r\n--" + B + b"--", "headers"),
    (b"--" + B + b"\r\n" + b"Content-Disposition: form-data; name=\"" + b"a" * 2000 + b"\"\r\n\r\nx\r\n--" + B + b"--", "headers"),
    (b"--" + B + b"\r\nContent-Disposition: form-data; name=\"file\"; filename=\"\xd7\xa9\"\r\n\r\nx\r\n--" + B + b"--", "headers"),
])
def test_refusals(bad, code):
    with pytest.raises(MultipartError) as e:
        parse_form(bad, B, RULES)
    assert e.value.code == code


@pytest.mark.parametrize("filename", ['"IMG;1234.jpg"', '"a\\"b.jpg"', '"x; name=evil"', "plain.jpg"])
def test_quoted_parameters_may_hold_semicolons_and_escaped_quotes(filename):
    """Code review V20: a `;` inside a quoted filename is part of the value (browsers send it so); a quoted `; name=...` cannot
    smuggle a second name."""
    block = (b"--" + B + b'\r\nContent-Disposition: form-data; name="file"; filename=' + filename.encode() +
             b"\r\n\r\nx\r\n--" + B + b'\r\nContent-Disposition: form-data; name="client_request_id"\r\n\r\nid\r\n--' + B + b"--")
    assert parse_form(block, B, RULES)["file"].data == b"x"


@pytest.mark.parametrize("disposition", ['form-data; name="file"; filename="unterminated', 'form-data; name="file" filename="a"',
                                         'form-data; name="file"; ="a"', "form-data; name"])
def test_broken_parameter_syntax_is_refused(disposition):
    block = (b"--" + B + b"\r\nContent-Disposition: " + disposition.encode() + b"\r\n\r\nx\r\n--" + B + b"--")
    with pytest.raises(MultipartError) as e:
        parse_form(block, B, RULES)
    assert e.value.code == "disposition"


def test_text_field_must_be_utf8():
    parts = parse_form(body(("file", b"x", "a.jpg"), ("client_request_id", b"\xff\xfe", None)), B, RULES)
    with pytest.raises(MultipartError) as e:
        parts["client_request_id"].text()
    assert e.value.code == "encoding"


def test_fuzz_never_raises_anything_but_a_multipart_error():
    rng = random.Random(3838)
    pieces = [b"--" + B, b"\r\n", b"\r\n\r\n", b'Content-Disposition: form-data; name="file"; filename="a"', b"--",
              b'Content-Disposition: form-data; name="client_request_id"', b"Content-Type: image/jpeg", b"\x00", b"\xff\xd8\xff",
              b";", b'"', b"=", b" ", b"x" * 50]
    accepted = 0
    for _ in range(5000):
        data = b"".join(rng.choice(pieces) for _ in range(rng.randint(0, 14)))
        if rng.random() < 0.3:
            data = bytearray(GOOD)
            for _ in range(rng.randint(1, 4)):
                data[rng.randrange(len(data))] = rng.randrange(256)
            data = bytes(data)
        try:
            parts = parse_form(data, B, RULES)
        except MultipartError:
            continue
        accepted += 1
        assert set(parts) == set(RULES) and len(parts["file"].data) <= 1000
    assert accepted < 5000
