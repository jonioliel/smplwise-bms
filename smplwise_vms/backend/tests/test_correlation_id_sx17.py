"""SX-17 (session-exchange client contract): the X-Correlation-Id header is accepted only when it is ONE value of 8-64 characters from
[A-Za-z0-9_-]; anything else is replaced by a fresh server id and never reflected (response header, error body, body-limit answer)."""
from __future__ import annotations

import re

import pytest
from fastapi.testclient import TestClient

from smplwise import body_limit as bl
from smplwise import correlation_id as cid
from smplwise.main import create_app

SERVER_ID = re.compile(r"^[0-9a-f]{12}$")
GOOD = ["0123456789ab", "0123456789abcdef0123456789abcdef", "abcdefgh", "A" * 64, "3f2504e0-4f89-11d3-9a0c-0305e82c3301", "app_ios-1234"]
BAD = ["", "short", "1234567", "A" * 65, "abc def12", "abc\tdef12", "abc;def12", "abc.def12", "abc/def12", "abc%0d%0aX", "א" * 10,
       "abc\"def12", "<script>x", "abcdefgh\r\nSet-Cookie: x=1"]


@pytest.mark.parametrize("value", GOOD)
def test_well_formed_ids_are_accepted_as_they_are(value):
    assert cid.accepted(value) == value
    assert cid.accepted(value.encode()) == value
    assert cid.resolve([value]) == value


@pytest.mark.parametrize("value", BAD)
def test_malformed_ids_are_replaced_by_a_fresh_server_id(value):
    assert cid.accepted(value) is None
    out = cid.resolve([value])
    assert out != value and SERVER_ID.match(out)


def test_no_header_two_headers_and_non_text_values_get_a_server_id():
    assert SERVER_ID.match(cid.resolve([]))
    assert SERVER_ID.match(cid.resolve(["0123456789ab", "0123456789ab"]))  # sent twice: ambiguous, refused
    assert cid.accepted(None) is None and cid.accepted(12345678) is None and cid.accepted(b"\xff" * 10) is None
    assert cid.new() != cid.new()


def test_the_middleware_echoes_a_valid_id_in_the_header_and_the_error_body(settings):
    c = TestClient(create_app(settings))
    r = c.get("/api/v1/no-such-route", headers={"X-Correlation-Id": "0123456789abcdef"})
    assert r.status_code == 404
    assert r.headers["x-correlation-id"] == "0123456789abcdef" and r.json()["correlation_id"] == "0123456789abcdef"


@pytest.mark.parametrize("value", ["short", "A" * 65, "abc def12", "abc;def12", "<script>x"])
def test_the_middleware_never_reflects_a_malformed_id(settings, value):
    c = TestClient(create_app(settings))
    r = c.get("/api/v1/no-such-route", headers={"X-Correlation-Id": value})
    got = r.headers["x-correlation-id"]
    assert got != value and SERVER_ID.match(got) and r.json()["correlation_id"] == got
    assert value not in r.text


def test_the_middleware_refuses_a_repeated_header(settings):
    c = TestClient(create_app(settings))
    r = c.get("/api/v1/no-such-route", headers=[("X-Correlation-Id", "0123456789ab"), ("X-Correlation-Id", "fedcba987654")])
    got = r.headers["x-correlation-id"]
    assert SERVER_ID.match(got) and got not in ("0123456789ab", "fedcba987654")


def test_the_body_limit_answer_uses_the_same_rule():
    assert bl._correlation([(b"x-correlation-id", b"0123456789ab")]) == "0123456789ab"
    for raw in (b"abc", b"x" * 65, b"abc def12", b"abc\r\ndef12"):
        out = bl._correlation([(b"x-correlation-id", raw)])
        assert SERVER_ID.match(out) and out.encode() != raw
    assert SERVER_ID.match(bl._correlation([]))
