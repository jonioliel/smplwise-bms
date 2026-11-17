"""One home for the redaction helpers (CR-REDACT-2440, review 05:P2-14).

Pure string functions with no imports from the product: what a value looks like once it may leave the server (an answer, a log
line, an audit row). The helpers used to live next to their first caller under about twenty names; those names stay as aliases
in their owner modules, and `tests/test_redact_table.py` pins every output.

Two helpers were merged only where EVERY output agrees. The phone masks show different amounts on purpose (two digits to
another person, four to a manager of the ticket desk; a fixed width where the length must not leak), so they are separate, named
variants here - choosing one is a product decision of the caller, never a default.
"""
from __future__ import annotations

import ipaddress
import re
from typing import Any

MASK = "***"
DOTS = "····"

_USERINFO_PAIR_RE = re.compile(r"://[^/@\s]+:[^/@\s]+@")
_SCHEME_RE = re.compile(r"^([A-Za-z][A-Za-z0-9+.-]{0,15})://")
_AUTHORITY_RE = re.compile(r"://[^/\s]*")
_SK_RE = re.compile(r"sk-[A-Za-z0-9_\-]{6,}")
_BEARER_RE = re.compile(r"(?i)(bearer\s+)[^\s\"',]+")


# ---------------------------------------------------------------- credentials in URLs

def url_userinfo(url: str) -> str:
    """rtsp://user:pass@host -> rtsp://***@host, for every such pair in the text (logs and audit details). A bare user without
    a password is left as it is."""
    return _USERINFO_PAIR_RE.sub("://***@", url)


def url_scheme_only(url: str | None) -> str:
    """The scheme only (`rtsp://***`), `***` when there is none: the address, the credentials (`user:pass@`, but also a bare
    user, a token in the path or the query) and the path are all hidden."""
    m = _SCHEME_RE.match(url or "")
    return f"{m.group(1).lower()}://***" if m else MASK


def url_host(url: str) -> str:
    """The whole authority (credentials, host and port) of the first URL hidden, the path kept: rtsp://***/Streaming/Channels/101."""
    return _AUTHORITY_RE.sub("://***", url, count=1)


# ---------------------------------------------------------------- secrets in free text

def text_without(text: str, url: str, secrets: tuple[Any, ...] | list[Any], *, url_token: str = "<rtsp-url>") -> str:
    """A child process's output with the address it was given replaced by `url_token` and every non-empty secret by `***`
    (in the order given; a non-string secret is compared as its text)."""
    out = text.replace(url, url_token)
    for secret in secrets:
        if secret:
            out = out.replace(str(secret), MASK)
    return out


def secrets_in_text(text: str, *secrets: str | None) -> str:
    """Every given secret of four characters or more, and anything shaped like an OpenAI key or a bearer token, removed from a
    text before it is logged, audited or returned."""
    out = text
    for s in secrets:
        if s and len(s) >= 4:
            out = out.replace(s, MASK)
    out = _SK_RE.sub("sk-***", out)
    return _BEARER_RE.sub(r"\1***", out)


# ---------------------------------------------------------------- phone masks (named variants; they differ on purpose)

def phone_tail2_dots(digits: str | None) -> str | None:
    """`····31`: the last two digits of another person's number; None under two digits."""
    d = digits or ""
    return f"{DOTS}{d[-2:]}" if len(d) >= 2 else None


def phone_tail2_bullets(phone: str | None) -> str | None:
    """`••••••31`: a fixed width, so the mask tells neither the length of the number nor whether it is international. Anything
    that is not a digit is dropped first; None under four digits."""
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) < 4:
        return None
    return "•" * 6 + digits[-2:]


def phone_tail4_bullets(digits: str | None) -> str | None:
    """`•••• 0031`: the last four digits; None for no number."""
    if not digits:
        return None
    return "•••• " + digits[-4:]


# ---------------------------------------------------------------- network address

def ip_network(ip: str | None) -> str:
    """An address cut to its network: IPv4 to its /24, IPv6 to its /48; anything else is dropped (`""`)."""
    try:
        addr = ipaddress.ip_address((ip or "").strip())
    except ValueError:
        return ""
    if addr.version == 4:
        return str(ipaddress.ip_network(f"{addr}/24", strict=False))
    return str(ipaddress.ip_network(f"{addr}/48", strict=False))
