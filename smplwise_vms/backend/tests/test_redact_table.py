"""CR-REDACT-2440 (review 05:P2-14): the table of inputs to outputs of the redaction helpers.

Written BEFORE anything moved into `services/redact.py`: every row was first proven against the helper in its owner module,
then the same row is asserted against the shared function the owner now aliases. A helper is unified with another only where
every row agrees; the phone masks that show different amounts stay as separately named variants.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from smplwise.services import access_arrival, access_grants, bulk_people, go2rtc, ha_user_auth, intercom_messaging, thumbnails
from smplwise.services.skins import provider as skin_provider
from smplwise.services.tickets import contacts as tk_contacts

NVR = "rtsp://admin:s3cret@nvr.local:554/Streaming/Channels/401"
HA = "rtsp://gate-user:pw@192.0.2.3:8554/live?token=abc"

# ---------------------------------------------------------------- credentials in URLs
URL_USERINFO = [
    (NVR, "rtsp://***@nvr.local:554/Streaming/Channels/401"),
    ("rtsp://nvr.local/x", "rtsp://nvr.local/x"),                       # nothing to hide
    ("rtsp://user@nvr.local/x", "rtsp://user@nvr.local/x"),             # a bare user is not a credential pair: left as is
    ("ffmpeg: rtsp://a:b@h/1 and http://c:d@i/2", "ffmpeg: rtsp://***@h/1 and http://***@i/2"),  # every pair in a text
    ("rtsp://a:b%40c@h/1", "rtsp://***@h/1"),
    ("rtsp://a:b@c@h/1", "rtsp://***@c@h/1"),                           # pinned as is: a raw `@` in the password ends the match early
    ("", ""),
]
URL_SCHEME_ONLY = [
    (HA, "rtsp://***"),
    ("rtsp://gate-user@h/x", "rtsp://***"),
    ("RTSPS://h/x", "rtsps://***"),
    ("garbage", "***"),
    ("", "***"),
    (None, "***"),
]
SOURCE_BY_NAME = [
    ("smplwise_ha_front_door", HA, "rtsp://***"),
    ("smplwise_cam_1", "rtsp://u:p@192.0.2.9/s?key=1", "rtsp://***"),
    ("smplwise_wiskey_st1", "rtsp://u:p@192.0.2.7:554/Streaming/Channels/101", "rtsp://***/Streaming/Channels/101"),
    ("smplwise_wiskey_st1", "no-scheme", "no-scheme"),
    ("smplwise_nvr-1_ch1_sub", "rtsp://u:p@nvr.local/x", "rtsp://***@nvr.local/x"),
    ("other", "rtsp://nvr.local/x", "rtsp://nvr.local/x"),
]
_S = SimpleNamespace(nvr_password="s3cret", nvr_user="admin", nvr_host="nvr.local")
FFMPEG_TEXT = [
    (f"[rtsp] {NVR}: 401 for admin at nvr.local (s3cret)", NVR, _S, "[rtsp] <rtsp-url>: 401 for *** at *** (***)"),
    ("nothing here", NVR, _S, "nothing here"),
    ("user admin", NVR, SimpleNamespace(nvr_password="", nvr_user=None, nvr_host=""), "user admin"),
    ("port 554", NVR, SimpleNamespace(nvr_password=554, nvr_user="", nvr_host=""), "port ***"),  # a non-string secret is compared as text
]
SECRET_TEXT = [
    ("key sk-abcdef123456 refused", (), "key sk-*** refused"),
    ("Authorization: Bearer abc.def-ghi, next", (), "Authorization: Bearer ***, next"),
    ("the key my-long-key failed", ("my-long-key",), "the key *** failed"),
    ("abc is short", ("abc",), "abc is short"),                         # a secret under 4 characters is not replaced
    ("none", (None, ""), "none"),
]

# ---------------------------------------------------------------- phone masks (four variants that show different amounts)
PHONE_TAIL2_DOTS = [("972500000031", "····31"), ("12", "····12"), ("1", None), ("", None)]          # `····` + last two, from 2 digits
PHONE_TAIL2_BULLETS = [("+972500000000", "••••••00"), ("050-000-0001", "••••••01"), ("1234", "••••••34"), ("123", None), ("", None), (None, None)]
PHONE_TAIL4_BULLETS = [("972500000031", "•••• 0031"), ("12", "•••• 12"), ("", None), (None, None)]

# ---------------------------------------------------------------- network address
IP_NETWORK = [("203.0.113.77", "203.0.113.0/24"), (" 203.0.113.77 ", "203.0.113.0/24"), ("2001:db8:1234:5678::1", "2001:db8:1234::/48"), ("not-an-ip", ""), ("", ""), (None, "")]


# ================================================================ the owners (the names every caller keeps using)

@pytest.mark.parametrize("url,expected", URL_USERINFO)
def test_owner_url_userinfo(url, expected):
    assert go2rtc.redact_url(url) == expected


@pytest.mark.parametrize("url,expected", URL_SCHEME_ONLY)
def test_owner_url_scheme_only(url, expected):
    assert go2rtc.redact_ha_source(url) == expected


@pytest.mark.parametrize("name,url,expected", SOURCE_BY_NAME)
def test_owner_source_by_name(name, url, expected):
    assert go2rtc.redact_source(name, url) == expected


@pytest.mark.parametrize("text,url,settings,expected", FFMPEG_TEXT)
def test_owner_ffmpeg_text(text, url, settings, expected):
    assert thumbnails._redact(text, url, settings) == expected


@pytest.mark.parametrize("text,secrets,expected", SECRET_TEXT)
def test_owner_secret_text(text, secrets, expected):
    assert skin_provider.redact(text, *secrets) == expected


@pytest.mark.parametrize("digits,expected", PHONE_TAIL2_DOTS)
def test_owner_phone_tail2_dots(digits, expected):
    assert access_grants.mask_number({"phone_e164": digits}) == expected
    assert bulk_people._mask_phone(digits) == expected
    # the arrival label shows the same mask after the first name, and the bare name when there is no mask
    assert access_arrival._label({"display_name": "Dana Levi", "phone_e164": digits}) == (f"Dana {expected}" if expected else "Dana")


def test_owner_phone_tail2_dots_edges():
    assert access_grants.mask_number(None) is None and access_grants.mask_number({}) is None
    # the bulk variant strips everything but digits first, and a non-string has no mask
    assert bulk_people._mask_phone("+972 50-000-0031") == "····31" and bulk_people._mask_phone(972500000031) is None and bulk_people._mask_phone(None) is None


@pytest.mark.parametrize("phone,expected", PHONE_TAIL2_BULLETS)
def test_owner_phone_tail2_bullets(phone, expected):
    assert intercom_messaging.mask_phone(phone) == expected


@pytest.mark.parametrize("digits,expected", PHONE_TAIL4_BULLETS)
def test_owner_phone_tail4_bullets(digits, expected):
    assert tk_contacts.mask_phone(digits) == expected


@pytest.mark.parametrize("ip,expected", IP_NETWORK)
def test_owner_ip_network(ip, expected):
    assert ha_user_auth.mask_address(ip) == expected


# ================================================================ the shared functions (services/redact.py) answer the same rows

from smplwise.services import redact  # noqa: E402


@pytest.mark.parametrize("url,expected", URL_USERINFO)
def test_redact_url_userinfo(url, expected):
    assert redact.url_userinfo(url) == expected


@pytest.mark.parametrize("url,expected", URL_SCHEME_ONLY)
def test_redact_url_scheme_only(url, expected):
    assert redact.url_scheme_only(url) == expected


def test_redact_url_host():
    assert redact.url_host("rtsp://u:p@192.0.2.7:554/Streaming/Channels/101") == "rtsp://***/Streaming/Channels/101"
    assert redact.url_host("a rtsp://h1/x b rtsp://h2/y") == "a rtsp://***/x b rtsp://h2/y"  # the first only
    assert redact.url_host("no-scheme") == "no-scheme"


@pytest.mark.parametrize("text,url,settings,expected", FFMPEG_TEXT)
def test_redact_text_without(text, url, settings, expected):
    assert redact.text_without(text, url, (settings.nvr_password, settings.nvr_user, settings.nvr_host)) == expected


@pytest.mark.parametrize("text,secrets,expected", SECRET_TEXT)
def test_redact_secrets_in_text(text, secrets, expected):
    assert redact.secrets_in_text(text, *secrets) == expected


@pytest.mark.parametrize("digits,expected", PHONE_TAIL2_DOTS + [(None, None)])
def test_redact_phone_tail2_dots(digits, expected):
    assert redact.phone_tail2_dots(digits) == expected


@pytest.mark.parametrize("phone,expected", PHONE_TAIL2_BULLETS)
def test_redact_phone_tail2_bullets(phone, expected):
    assert redact.phone_tail2_bullets(phone) == expected


@pytest.mark.parametrize("digits,expected", PHONE_TAIL4_BULLETS)
def test_redact_phone_tail4_bullets(digits, expected):
    assert redact.phone_tail4_bullets(digits) == expected


@pytest.mark.parametrize("ip,expected", IP_NETWORK)
def test_redact_ip_network(ip, expected):
    assert redact.ip_network(ip) == expected


def test_the_phone_variants_really_differ():
    """The reason they are not one function: the same number leaves in three different forms."""
    n = "972500000031"
    assert len({redact.phone_tail2_dots(n), redact.phone_tail2_bullets(n), redact.phone_tail4_bullets(n)}) == 3
    assert redact.phone_tail2_dots("12") == "····12" and redact.phone_tail2_bullets("12") is None


def test_redact_imports_nothing_from_the_product():
    import ast
    import pathlib

    tree = ast.parse(pathlib.Path(redact.__file__).read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            assert node.level == 0 and not (node.module or "").startswith("smplwise"), ast.dump(node)
