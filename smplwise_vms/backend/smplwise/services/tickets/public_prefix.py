"""TK255: the public path prefix. The listener serves ITSELF under one configurable single-segment prefix (default `support`), so a
single Cloudflare route `^/support(/.*)?$` reaches it with no Rewrite rule. Inside, every route is still the spec's `/t/...` (ROUTES,
the FastAPI app, the stored `route` of idempotent requests): the edge maps `/<prefix>/<rest>` to `/t/<rest>` BEFORE it matches a
route, so there is exactly one allowlist and it is the old one.

Fail closed (nothing here ever redirects or guesses):
- the path must be plain ASCII `/seg/...` - no `//`, no `.` or `..` segment, no `%`, no backslash, no control or non-ASCII byte, a
  bounded length; the raw (undecoded) path the server received must be byte-identical to the decoded one, so a `%2e`, `%2f`, `%5c`,
  a double encoding or an overlong UTF-8 spelling is refused instead of being normalised into something that matches;
- the first segment must be EXACTLY the configured prefix (case-sensitive), or `t` while `legacy_t` is on (links already sent to
  vendors before the prefix existed); when the configured prefix is `t` only `t` is served;
- VPORTAL, ONLY while the vendor portal is on (`loose_root`): the bare page root `/<prefix>` / `/<prefix>/` in ANY letter case
  (`/Support`) is the page root `/t/` (the portal's address is typed by people); nothing deeper is case-insensitive. With the portal
  off (the default) nothing here changed;
- every other path is `None` (the caller answers the one uniform 404)."""
from __future__ import annotations

import re

PREFIX_RE = re.compile(r"t|[a-z0-9][a-z0-9_-]{1,31}")  # `t` (the old form) or 2-32 characters
# a prefix may never shadow a route word of the page or a path another route of the same hostname uses (`/arx` is the add-on)
RESERVED = frozenset({"api", "assets", "r", "healthz", "arx", "admin", "hassio", "ingress", "auth", "static", "config", "www", "login",
                      "public", "hacsfiles", "local", "oauth", "well-known"})
DEFAULT_PREFIX = "support"
LEGACY = "t"
MAX_PATH = 256


def validate_prefix(value: object) -> str:
    """The bare prefix (`support`) of `support` or `/support`; ValueError otherwise (never echoes the value)."""
    if not isinstance(value, str) or isinstance(value, bool):
        raise ValueError("type")
    text = value[1:] if value.startswith("/") else value
    if PREFIX_RE.fullmatch(text) is None:
        raise ValueError("invalid")
    if text in RESERVED:
        raise ValueError("reserved")
    return text


def resolve_path(path: str, raw_path: bytes | None, prefix: str, legacy_t: bool, loose_root: bool = False) -> tuple[str, str] | None:
    """(`/t/<rest>`, the public prefix the request used) or None. `prefix` is a validated bare prefix. `loose_root` (VPORTAL: only
    while the vendor portal is on) also serves the bare root in any letter case."""
    if not isinstance(path, str) or not path.startswith("/") or len(path) > MAX_PATH:
        return None
    if raw_path is not None:
        try:
            if raw_path.decode("ascii") != path:  # a percent-escape (or any re-spelling) of what we match is not a path we serve
                return None
        except UnicodeDecodeError:
            return None
    if any(ord(ch) < 0x21 or ord(ch) > 0x7E for ch in path) or "%" in path or "\\" in path or "?" in path or "#" in path or ";" in path:
        return None
    if loose_root and path.lower() in (f"/{prefix}", f"/{prefix}/"):
        # VPORTAL (portal on): the page ROOT alone - the address a vendor types (`/support`, `/Support`, `/SUPPORT/`) - is served in any
        # letter case and without the slash (the same shell, never a redirect). Every deeper path keeps the exact, case-sensitive rule.
        return "/t/", prefix
    segments = path.split("/")  # ['', first, ...]
    if "" in segments[1:-1] or any(s in (".", "..") for s in segments):
        return None  # `//`, `/./`, `/../`; a trailing empty segment (the page root `/support/`) is the one allowed shape
    first = segments[1]
    if first == prefix:
        used = prefix
    elif first == LEGACY and legacy_t:
        used = LEGACY
    else:
        return None
    rest = path[1 + len(first):]
    if not rest.startswith("/"):
        return None
    return "/t" + rest, used
