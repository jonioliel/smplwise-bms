"""CR-038 handler-link tokens and bearer values (services/tickets/links.py) and the module key (module_key.py): derivation,
hash-only lookup values, strict parsing (fuzz), constant-time checks, URL building with the token in the fragment only.
No real key, address or token: every value is invented."""
from __future__ import annotations

import base64
import hashlib
import hmac
import random
import statistics
import string
import time

import pytest

from smplwise.services.tickets import links, module_key

KEY = bytes(range(32))
LINK = "0123456789abcdef0123456789abcdef"


def test_token_is_the_spec_formula_192_bits_in_32_base64url_characters():
    tok = links.derive_token(KEY, LINK, 1)
    mac = hmac.new(KEY, f"tkt|{LINK}|1".encode(), hashlib.sha256).digest()
    assert tok == base64.urlsafe_b64encode(mac).decode()[:32]
    assert len(tok) == 32 and set(tok) <= set(string.ascii_letters + string.digits + "-_")
    assert base64.urlsafe_b64decode(tok) == mac[:24]  # exactly 24 bytes = 192 bits


def test_generation_bump_and_another_key_or_link_give_unrelated_tokens():
    t1, t2 = links.derive_token(KEY, LINK, 1), links.derive_token(KEY, LINK, 2)
    other_key = links.derive_token(bytes(32), LINK, 1)
    other_link = links.derive_token(KEY, "f" * 32, 1)
    assert len({t1, t2, other_key, other_link}) == 4
    assert links.verify_token(KEY, LINK, 2, t2) and not links.verify_token(KEY, LINK, 2, t1)


def test_only_the_hash_is_a_lookup_value():
    tok = links.derive_token(KEY, LINK, 3)
    h = links.token_hash(tok)
    assert h == hashlib.sha256(tok.encode()).hexdigest() and tok not in h
    assert links.limiter_key(h) == "t:" + h[:24]


@pytest.mark.parametrize("bad", [("x" * 31, 1), ("0123456789ABCDEF" * 2, 1), (LINK, 0), (LINK, -1), (LINK, True), (LINK, "1")])
def test_derivation_refuses_malformed_inputs(bad):
    link_id, gen = bad
    with pytest.raises(ValueError):
        links.derive_token(KEY, link_id, gen)
    with pytest.raises(ValueError):
        links.derive_token(b"short", LINK, 1)


def _fuzz_strings(rng: random.Random, n: int) -> list[str]:
    alphabets = [string.ascii_letters + string.digits + "-_", string.printable, "٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "​‮﻿ \t\r\n%=+/",
                 "".join(chr(c) for c in range(0x590, 0x600)), "\x00\x7f\x80"]
    out: list[str] = []
    for _ in range(n):
        alpha = rng.choice(alphabets)
        length = rng.choice([0, 1, 31, 32, 33, 43, 44, 64, rng.randint(0, 80)])
        out.append("".join(rng.choice(alpha) for _ in range(length)))
    return out


def test_fuzz_token_parsing_accepts_exactly_the_produced_shape_and_never_raises():
    rng = random.Random(1038)
    good = set(string.ascii_letters + string.digits + "-_")
    for s in _fuzz_strings(rng, 6000) + [None, 5, b"x" * 32, ["a"], " " + "a" * 31, "a" * 31 + "\n", "a" * 32 + "\n"]:
        got = links.parse_token(s)
        expected = s if isinstance(s, str) and len(s) == 32 and set(s) <= good else None
        assert got == expected, repr(s)


def test_mutated_tokens_never_verify():
    rng = random.Random(7)
    tok = links.derive_token(KEY, LINK, 1)
    alphabet = string.ascii_letters + string.digits + "-_"
    for _ in range(2000):
        i = rng.randrange(32)
        c = rng.choice(alphabet.replace(tok[i], ""))
        mutated = tok[:i] + c + tok[i + 1:]
        assert not links.verify_token(KEY, LINK, 1, mutated)
        assert links.token_hash(mutated) != links.token_hash(tok)
    for wrong in (tok[:-1], tok + "A", tok.upper() if tok.upper() != tok else tok.lower(), " " + tok[1:]):
        if wrong != tok:
            assert not links.verify_token(KEY, LINK, 1, wrong)


def test_redeem_ids_and_sessions_are_random_strict_and_stored_as_sha256():
    rids = {links.new_redeem_id() for _ in range(200)}
    assert len(rids) == 200 and all(links.parse_redeem_id(r) == r for r in rids)
    rid = next(iter(rids))
    assert links.redeem_hash(rid) == hashlib.sha256(rid.encode()).hexdigest()
    assert links.parse_redeem_id(rid.upper()) is None and links.parse_redeem_id(rid[:-1]) is None
    ses = links.new_session_value()
    assert len(ses) == 43 and links.parse_session(ses) == ses
    assert links.session_hash(ses) == hashlib.sha256(ses.encode()).hexdigest()
    assert links.parse_session(ses + "=") is None and links.parse_session(ses[:-1]) is None
    rng = random.Random(99)
    for s in _fuzz_strings(rng, 3000):
        assert links.parse_session(s) in (None, s) and links.parse_redeem_id(s) in (None, s)


def test_phone_key_and_client_key_are_keyed_digests():
    assert links.phone_key(KEY, "972501234567") == hmac.new(KEY, b"972501234567", hashlib.sha256).hexdigest()
    for not_a_number in ("", "1234567", "9725012345678901", "+972501234567", "123456789@lid", "٩٧٢٥٠١٢٣٤٥٦٧"):
        assert links.phone_key(KEY, not_a_number) is None
    ck = links.client_key(KEY, "198.51.100.0/24", "Chrome · Android")
    assert len(ck) == 16 and ck != links.client_key(bytes(32), "198.51.100.0/24", "Chrome · Android")
    assert links.ua_family("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36") == "Chrome · Android"


@pytest.mark.parametrize("url,expected", [
    ("https://t-acme.example.com", "https://t-acme.example.com"),
    ("https://T-Acme.Example.COM/", "https://t-acme.example.com"),
    ("https://t-acme.example.com:443/", "https://t-acme.example.com"),
    ("https://xn--4dbrk0ce.example.co.il", "https://xn--4dbrk0ce.example.co.il"),
])
def test_public_base_url_accepted_and_normalised(url, expected):
    assert links.validate_public_base_url(url) == expected


@pytest.mark.parametrize("url,code", [
    ("http://t-acme.example.com", "https_required"),
    ("https://user:pw@t-acme.example.com", "userinfo"),
    ("https://t-acme.example.com/t/", "path"),
    ("https://t-acme.example.com?x=1", "query"),
    ("https://t-acme.example.com#frag", "query"),
    ("https://t-acme.example.com:8443", "port"),
    ("https://192.0.2.10", "ip_literal"),
    ("https://[2001:db8::1]", "ip_literal"),
    ("https://0x7f.0.0.1", "ip_literal"),
    ("https://localhost", "hostname"),
    ("https://homeassistant.local", "reserved"),
    ("https://supervisor.example.com", "reserved"),
    ("https://-bad.example.com", "hostname"),
    ("https://exa mple.com", "invalid"),
    ("", "invalid"),
    (None, "invalid"),
])
def test_public_base_url_refusals(url, code):
    with pytest.raises(links.PublicUrlError) as e:
        links.validate_public_base_url(url)
    assert e.value.code == code


def test_urls_carry_the_token_only_in_the_fragment_and_email_never_carries_it():
    tok = links.derive_token(KEY, LINK, 1)
    url = links.handler_url("https://t-acme.example.com/", tok)
    assert url == f"https://t-acme.example.com/t/#{tok}"
    from urllib.parse import urlsplit

    parts = urlsplit(url)
    assert tok not in parts.path and tok not in parts.query and parts.fragment == tok
    rid = links.new_redeem_id()
    email_url = links.redeem_url("https://t-acme.example.com", rid)
    assert email_url == f"https://t-acme.example.com/t/r/{rid}" and tok not in email_url
    with pytest.raises(ValueError):
        links.handler_url("https://t-acme.example.com", "not-a-token")


def test_hash_lookup_time_does_not_depend_on_the_token_characters():
    """The listener never compares a presented token with a stored one: it hashes it and does one dict / index read. This
    checks the property the timing argument rests on: hashing a token whose prefix matches a real one costs the same as
    hashing an unrelated one (loose bound - a behavioural check, not a benchmark)."""
    tok = links.derive_token(KEY, LINK, 1)
    index = {links.token_hash(tok): "row"}
    near = tok[:31] + ("A" if tok[31] != "A" else "B")
    far = "Z" * 32

    def timed(t: str) -> float:
        samples = []
        for _ in range(9):
            t0 = time.perf_counter()
            for _ in range(3000):
                index.get(links.token_hash(t))
            samples.append(time.perf_counter() - t0)
        return min(samples)  # the least disturbed run is the intrinsic cost

    from conftest import sw_time_factor

    a, b = timed(near), timed(far)
    assert max(a, b) / min(a, b) < 1.6 * sw_time_factor(), (a, b)
    assert statistics.mean([a, b]) > 0


# ---------------------------------------------------------------- the module key file


def test_key_is_created_once_with_32_bytes_and_read_back(tmp_path):
    assert module_key.load(tmp_path, create=False) is None
    k1 = module_key.load(tmp_path, create=True)
    assert k1 is not None and len(k1) == 32
    assert module_key.load(tmp_path, create=True) == k1
    p = module_key.key_path(tmp_path)
    assert p == tmp_path / "secrets" / "tickets_key" and p.read_bytes() == k1
    assert not [x for x in p.parent.iterdir() if x.name.endswith(".tmp")]


def test_damaged_key_file_is_refused_not_replaced(tmp_path):
    p = module_key.key_path(tmp_path)
    p.parent.mkdir(parents=True)
    p.write_bytes(b"short")
    with pytest.raises(module_key.ModuleKeyError) as e:
        module_key.load(tmp_path, create=True)
    assert "short" not in str(e.value)
    assert p.read_bytes() == b"short"


def test_rotation_replaces_the_key_and_kills_every_derived_token(tmp_path):
    mk = module_key.ModuleKey(tmp_path)
    with pytest.raises(module_key.ModuleKeyError):
        mk.get()
    k1 = mk.get(create=True)
    tok = links.derive_token(k1, LINK, 1)
    k2 = mk.rotate()
    assert k2 != k1 and mk() == k2 and module_key.load(tmp_path, create=False) == k2
    assert not links.verify_token(k2, LINK, 1, tok)
    assert repr(mk) == "ModuleKey(loaded=True)"  # never key material in a repr (logs, tracebacks)
