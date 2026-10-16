"""CR-038 section 10.2: handler-link tokens and the other bearer values of the public page - pure functions, no database.

Token model (the cast relay `token_for` precedent, CR-028):
- `token = base64url(HMAC-SHA256(k_tickets, "tkt|" + link_id + "|" + generation))[:32]` - 32 characters of the base64url
  alphabet = 24 bytes = 192 bits. Derived, never stored: a resend or the manager's "copy link" derives it again from
  (link_id, generation). Bumping the generation kills every earlier token of the link.
- The database keeps only `token_hash = sha256(token)` hex, the lookup index (`ticket_links.token_hash`, unique): ONE indexed
  read per request whatever the token is, so the time a lookup takes says nothing about the token's characters (the
  `cast_relay.Index.lookup` precedent). The derivation key stays outside the database and outside project backups
  (module_key.py).
- Transport: the token travels in the URL FRAGMENT (`https://t-<customer>.<domain>/t/#<token>`), which browsers never send in
  the request line, in a Referer or to Cloudflare; the page reads `location.hash`, replaces the address bar with `/t/` and
  sends the token as the `X-Ticket-Token` header. E-mail never carries the fragment: it carries a redeem link `/t/r/<rid>`
  (a 128-bit random id, stored as its SHA-256) whose GET is the static shell and whose button press releases the token
  (review T3-2, spec 10.2).
- After a correct verification code the page holds a 256-bit session value (`X-Ticket-Session`), stored as its SHA-256.

Parsing is strict and never normalises: a value is accepted only in exactly the shape this module produces (no trimming, no
case folding, no percent decoding), so two spellings of one token cannot exist. Comparisons of secrets use
`hmac.compare_digest`."""
from __future__ import annotations

import base64
import hashlib
import hmac
import ipaddress
import re
import secrets
from urllib.parse import urlsplit

TOKEN_HEADER = "x-ticket-token"
SESSION_HEADER = "x-ticket-session"
TOKEN_BYTES = 24
TOKEN_LENGTH = 32  # base64url characters of TOKEN_BYTES (no padding)
SESSION_LENGTH = 43  # base64url characters of 32 bytes (no padding)
_TOKEN_RE = re.compile(r"[A-Za-z0-9_-]{32}")
_SESSION_RE = re.compile(r"[A-Za-z0-9_-]{43}")
_HEX32_RE = re.compile(r"[0-9a-f]{32}")
_DIGITS_RE = re.compile(r"[0-9]{8,15}")


# ---------------------------------------------------------------- ids


def new_link_id() -> str:
    """`ticket_links.id`: 128 random bits as 32 lowercase hex characters (the HMAC input of the token)."""
    return secrets.token_hex(16)


def is_link_id(value: object) -> bool:
    return isinstance(value, str) and _HEX32_RE.fullmatch(value) is not None


# ---------------------------------------------------------------- handler-link tokens


def derive_token(key: bytes, link_id: str, generation: int) -> str:
    """The token of (link_id, generation) under the module key."""
    if not is_link_id(link_id):
        raise ValueError("link_id must be 32 lowercase hex characters")
    if isinstance(generation, bool) or not isinstance(generation, int) or generation < 1:
        raise ValueError("generation must be a positive integer")
    if not isinstance(key, (bytes, bytearray)) or len(key) < 16:
        raise ValueError("the module key must be at least 16 bytes")
    mac = hmac.new(bytes(key), f"tkt|{link_id}|{generation}".encode("ascii"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(mac).decode("ascii")[:TOKEN_LENGTH]


def token_hash(token: str) -> str:
    """`ticket_links.token_hash`: SHA-256 hex of the token (the lookup key; never the token itself)."""
    return hashlib.sha256(token.encode("ascii")).hexdigest()


def parse_token(raw: object) -> str | None:
    """The token when `raw` is exactly a token (32 base64url characters), else None. Never raises."""
    if not isinstance(raw, str) or len(raw) != TOKEN_LENGTH:
        return None
    return raw if _TOKEN_RE.fullmatch(raw) else None


def verify_token(key: bytes, link_id: str, generation: int, presented: object) -> bool:
    """Constant-time check that `presented` is the current token of (link_id, generation). The public listener does not need it
    (it looks up by hash); it serves the manager-side paths that hold a link row and a presented value."""
    token = parse_token(presented)
    if token is None:
        return False
    return hmac.compare_digest(derive_token(key, link_id, generation), token)


def limiter_key(token_digest: str) -> str:
    """The rate-limit key of a token: a prefix of its SHA-256 (96 bits - unique enough to count per token, not the lookup key)."""
    return "t:" + token_digest[:24]


# ---------------------------------------------------------------- e-mail redeem ids and code sessions


def new_redeem_id() -> str:
    """A redeem id for the e-mail form of a link (`/t/r/<rid>`): 128 random bits, 32 lowercase hex characters."""
    return secrets.token_hex(16)


def parse_redeem_id(raw: object) -> str | None:
    if not isinstance(raw, str) or len(raw) != 32:
        return None
    return raw if _HEX32_RE.fullmatch(raw) else None


def redeem_hash(rid: str) -> str:
    """`ticket_link_redeems.id_hash`: SHA-256 hex of the redeem id."""
    return hashlib.sha256(rid.encode("ascii")).hexdigest()


def new_session_value() -> str:
    """The code session handed out after a correct verification code: 256 random bits, 43 base64url characters."""
    return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode("ascii").rstrip("=")


def parse_session(raw: object) -> str | None:
    if not isinstance(raw, str) or len(raw) != SESSION_LENGTH:
        return None
    return raw if _SESSION_RE.fullmatch(raw) else None


def session_hash(value: str) -> str:
    """`ticket_link_sessions.id_hash`: SHA-256 hex of the session value."""
    return hashlib.sha256(value.encode("ascii")).hexdigest()


# ---------------------------------------------------------------- keyed digests of the module key (spec 7.2, 7.4)


def phone_key(key: bytes, digits: str) -> str | None:
    """`ticket_contacts.phone_key` / `ticket_inbound.sender_key`: HMAC-SHA256(k_tickets, digits) hex, or None when `digits` is
    not 8-15 ASCII digits (an `@lid` identifier, an empty sender - review T12b)."""
    if not isinstance(digits, str) or not _DIGITS_RE.fullmatch(digits):
        return None
    return hmac.new(bytes(key), digits.encode("ascii"), hashlib.sha256).hexdigest()


def client_key(key: bytes, network: str, ua_family: str) -> str:
    """`ticket_link_access.client_key`: HMAC(k_tickets, network | UA family)[:16] - "how many devices opened it", nothing more
    (no address, no user-agent string is ever stored)."""
    msg = f"{network}|{ua_family}".encode("utf-8", "replace")
    return hmac.new(bytes(key), msg, hashlib.sha256).hexdigest()[:16]


def ua_family(user_agent: str | None) -> str:
    """"Chrome · Android"-style family of a User-Agent (services/ha_user_auth.agent_family), never the full string."""
    from ..ha_user_auth import agent_family

    return agent_family((user_agent or "")[:512])[:40]


# ---------------------------------------------------------------- the public address and the URLs built on it

_LABEL_RE = re.compile(r"(?!-)[a-z0-9-]{1,63}(?<!-)")
_TLD_RE = re.compile(r"(?:[a-z][a-z0-9-]*[a-z0-9]|[a-z]|xn--[a-z0-9-]+)")
BLOCKED_HOSTS = frozenset({"localhost", "homeassistant", "supervisor", "hassio", "local"})
# 2.5.4: ONE optional path prefix (`/support`) on the public address. The listener still serves only `/t/...`; an edge rewrite
# (Cloudflare: `/support/*` -> `/t/*`) maps the prefix, so URLs built for vendors use the prefix and the listener never sees it.
_PREFIX_RE = re.compile(r"/[a-z][a-z0-9-]{1,31}")


class PublicUrlError(ValueError):
    """`tickets.settings.public.base_url` refused; `code` says why (fixed vocabulary, never the value)."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def validate_public_base_url(url: object) -> str:
    """The normalised public base URL (`https://<host>` or `https://<host>/<prefix>`, lower case, no trailing slash) or PublicUrlError.

    Spec 14.1: https; a DNS hostname, never an IP literal; no path beyond `/` except (2.5.4) ONE optional prefix segment
    `/[a-z][a-z0-9-]{1,31}` such as `/support` (a trailing `/` is dropped). Also refused: user info, a query or fragment,
    a port other than 443, a single-label or reserved name (localhost, homeassistant, supervisor), a numeric last label (the
    `0x7f.1` / `2130706433` spellings resolvers read as addresses). Whether the NAME resolves to a private address is the
    address probe's check (slice 4, review T11), not this one."""
    if not isinstance(url, str) or not url or len(url) > 300:
        raise PublicUrlError("invalid")
    if any(ch.isspace() for ch in url) or any(ord(ch) < 0x21 or ord(ch) > 0x7E for ch in url):
        raise PublicUrlError("invalid")
    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError:
        raise PublicUrlError("invalid") from None
    if parts.scheme != "https":
        raise PublicUrlError("https_required")
    if parts.username is not None or parts.password is not None or "@" in parts.netloc:
        raise PublicUrlError("userinfo")
    if parts.query or parts.fragment or "?" in url or "#" in url:
        raise PublicUrlError("query")
    prefix = ""
    if parts.path not in ("", "/"):
        candidate = parts.path[:-1] if parts.path.endswith("/") else parts.path
        if _PREFIX_RE.fullmatch(candidate) is None:
            raise PublicUrlError("path")
        from .public_prefix import validate_prefix  # TK255 review F1: the listener would refuse a reserved word at start

        try:
            validate_prefix(candidate)
        except ValueError:
            raise PublicUrlError("path") from None
        prefix = candidate
    if port not in (None, 443):
        raise PublicUrlError("port")
    host = (parts.hostname or "").lower()
    if not host or host.startswith("[") or ":" in host:
        raise PublicUrlError("ip_literal")
    try:
        ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        raise PublicUrlError("ip_literal")
    if host.endswith("."):
        host = host[:-1]
    labels = host.split(".")
    if len(host) > 253 or len(labels) < 2 or not all(_LABEL_RE.fullmatch(lb) for lb in labels):
        raise PublicUrlError("hostname")
    if not _TLD_RE.fullmatch(labels[-1]):
        raise PublicUrlError("ip_literal")
    if labels[0] in BLOCKED_HOSTS or host in BLOCKED_HOSTS or labels[-1] in ("local", "localhost", "internal", "home", "lan"):
        raise PublicUrlError("reserved")
    return f"https://{host}{prefix}"


def split_base(base: str) -> tuple[str, str]:
    """(`https://<host>`, prefix) of a validated base; the prefix is "" or `/support`-style."""
    parts = urlsplit(base)
    return f"{parts.scheme}://{parts.netloc}", parts.path


def effective_prefix(base_url: str, setting_prefix: str) -> str:
    """TK255: the one bare prefix (`support`) the vendor URLs and the listener use: the address's own path segment when it has one
    (an address saved since 2.5.4 as `https://host/support` keeps working unchanged), else `public.path_prefix`."""
    if base_url:
        try:
            _origin, path = split_base(validate_public_base_url(base_url))
        except PublicUrlError:
            path = ""
        if path:
            return path.lstrip("/")
    return setting_prefix


def public_url(base_url: str, rest: str, prefix: str | None = None) -> str:
    """`<origin>/<prefix>/<rest>`: the listener serves `/<prefix>/<rest>` itself (TK255; the prefix is `effective_prefix`). Without
    a `prefix` argument the legacy rule applies: the address's own path, else today's `/t/<rest>`."""
    origin, base_prefix = split_base(validate_public_base_url(base_url))
    if prefix is not None:
        from .public_prefix import validate_prefix

        return f"{origin}/{validate_prefix(prefix)}/{rest}"
    return f"{origin}{base_prefix or '/t'}/{rest}"


def handler_url(base_url: str, token: str, prefix: str | None = None) -> str:
    """The URL a WhatsApp message carries: the token in the fragment (`<base>/<prefix>/#<token>`)."""
    if parse_token(token) is None:
        raise ValueError("not a handler-link token")
    return public_url(base_url, f"#{token}", prefix)


def redeem_url(base_url: str, rid: str, prefix: str | None = None) -> str:
    """The URL an e-mail carries instead (`<base>/<prefix>/r/<rid>`): no token anywhere in it."""
    if parse_redeem_id(rid) is None:
        raise ValueError("not a redeem id")
    return public_url(base_url, f"r/{rid}", prefix)
