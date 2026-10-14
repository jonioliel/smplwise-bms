"""CR-038 handler-link tokens and bearer values (services/tickets/links.py) and the module key (module_key.py): derivation,
hash-only lookup values, strict parsing (fuzz), constant-time checks, URL building with the token in the fragment only.
No real key, address or token: every value is invented."""
from __future__ import annotations

import base64
import hashlib
import hmac
import random
import string

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


# (The wall-clock "hash lookup time" test was dropped after the code review of 2026-10-13: hashing 32 characters is
# constant-time by construction and a dict read is not slice 4's SQLite path - the property is W1, checked over the real store
# with EXPLAIN QUERY PLAN, not with a stopwatch.)


# ---------------------------------------------------------------- the module key files (key ids, code review V4 / W12)


def _secrets(tmp_path):
    return tmp_path / "secrets"


def test_the_first_key_is_created_only_after_a_link_check_that_reports_none(tmp_path):
    mk = module_key.ModuleKey(tmp_path)  # no has_links check at all: never creates
    assert mk.status() == {"state": "absent", "current": None, "keys": 0}
    with pytest.raises(module_key.ModuleKeyError):
        mk.current()
    with pytest.raises(module_key.ModuleKeyError):
        mk.current(create=True)
    for check in (lambda: True, lambda: 1 / 0):  # links exist / the check itself fails: refused
        with pytest.raises(module_key.ModuleKeyError):
            module_key.ModuleKey(tmp_path, has_links=check).current(create=True)
    assert not _secrets(tmp_path).exists() or not any(_secrets(tmp_path).iterdir())
    mk = module_key.ModuleKey(tmp_path, has_links=lambda: False)
    kid, k1 = mk.current(create=True)
    assert module_key.is_key_id(kid) and len(k1) == 32
    assert module_key.key_path(tmp_path, kid) == _secrets(tmp_path) / f"tickets_key.{kid}"
    assert module_key.key_path(tmp_path, kid).read_bytes() == k1
    assert module_key.pointer_path(tmp_path).read_bytes() == kid.encode()
    assert not [x for x in _secrets(tmp_path).iterdir() if x.name.endswith(".tmp")]
    again = module_key.ModuleKey(tmp_path)  # another process: reads, never creates
    assert again.current() == (kid, k1) and again(kid) == k1 and again() == k1
    assert again.status() == {"state": "ok", "current": kid, "keys": 1}
    assert mk.current(create=True) == (kid, k1)  # create=True with a key present is a plain read


def test_a_data_restore_without_secrets_is_refused_never_reminted(tmp_path):
    """W12: links exist, the key files are gone (a /data restore without secrets/) - minting a new key would silently kill
    every live link and every phone match; the class refuses and says what to do."""
    kid, _k = module_key.ModuleKey(tmp_path, has_links=lambda: False).current(create=True)
    for f in _secrets(tmp_path).iterdir():
        f.unlink()
    restored = module_key.ModuleKey(tmp_path, has_links=lambda: True)
    with pytest.raises(module_key.ModuleKeyError) as e:
        restored.current(create=True)
    assert "restore secrets/" in str(e.value)
    with pytest.raises(module_key.ModuleKeyError):
        restored.get(kid)  # a row naming the lost key fails closed
    assert restored.status()["state"] == "absent" and not any(_secrets(tmp_path).iterdir())


def test_damaged_key_or_pointer_is_refused_not_replaced(tmp_path):
    d = _secrets(tmp_path)
    d.mkdir()
    (d / "tickets_key.aaaaaaaaaaaa").write_bytes(b"short")
    (d / "tickets_key.current").write_bytes(b"aaaaaaaaaaaa")
    mk = module_key.ModuleKey(tmp_path, has_links=lambda: False)
    with pytest.raises(module_key.ModuleKeyError) as e:
        mk.current(create=True)
    assert "short" not in str(e.value) and mk.status()["state"] == "damaged"
    assert (d / "tickets_key.aaaaaaaaaaaa").read_bytes() == b"short"
    (d / "tickets_key.current").write_bytes(b"../../etc/passwd")
    with pytest.raises(module_key.ModuleKeyError):
        module_key.ModuleKey(tmp_path, has_links=lambda: False).current(create=True)
    (d / "tickets_key.current").write_bytes(b"bbbbbbbbbbbb")  # names a file that is not there
    assert module_key.ModuleKey(tmp_path).status()["state"] == "missing"
    with pytest.raises(module_key.ModuleKeyError):
        module_key.ModuleKey(tmp_path).get("../secrets")


def test_an_interrupted_first_creation_leaves_an_unused_file_and_creation_still_works(tmp_path):
    d = _secrets(tmp_path)
    d.mkdir()
    (d / "tickets_key.cccccccccccc").write_bytes(bytes(32))  # key written, pointer never
    assert module_key.ModuleKey(tmp_path).status() == {"state": "orphaned", "current": None, "keys": 1}
    with pytest.raises(module_key.ModuleKeyError):
        module_key.ModuleKey(tmp_path, has_links=lambda: True).current(create=True)
    kid, _k = module_key.ModuleKey(tmp_path, has_links=lambda: False).current(create=True)
    assert kid != "cccccccccccc" and set(module_key.list_ids(tmp_path)) == {kid, "cccccccccccc"}


def test_rotation_with_ids_never_strands_a_row(tmp_path):
    """stage -> (the DB transaction re-derives under the staged id) -> commit -> retire the old id once unreferenced. At every
    step every id a row can name has its file: a crash between the file and the transaction strands nothing."""
    mk = module_key.ModuleKey(tmp_path, has_links=lambda: False)
    old, k1 = mk.current(create=True)
    tok = links.derive_token(k1, LINK, 1)
    staged = mk.stage()
    assert staged != old and mk.current_id() == old and mk.ids() == tuple(sorted((old, staged)))
    assert mk.get(staged) != k1
    crashed = module_key.ModuleKey(tmp_path)  # a restart between stage and commit: still the old key, both readable
    assert crashed.current_id() == old and crashed.get(staged) == mk.get(staged)
    mk.commit(staged)
    assert mk.current_id() == staged and module_key.ModuleKey(tmp_path).current_id() == staged
    assert links.verify_token(mk.get(old), LINK, 1, tok)  # a row still naming the old id keeps working until retired
    assert not links.verify_token(mk.get(staged), LINK, 1, tok)
    with pytest.raises(module_key.ModuleKeyError):
        mk.retire(staged)  # never the current key
    assert mk.retire(old) is True and mk.retire(old) is False
    with pytest.raises(module_key.ModuleKeyError):
        mk.get(old)
    assert mk.ids() == (staged,)
    with pytest.raises(module_key.ModuleKeyError):
        mk.commit("dddddddddddd")  # a key that is not there is never made current
    assert "\\x" not in repr(mk) and k1.hex() not in repr(mk) and repr(mk).startswith("ModuleKey(")
