"""The push relay's base URL, validated (no heavy imports: config, the options writer and services/mobile_push all use it).

Documented form: `https://<host>[:port]` - the BASE only, no `/v1`, no path at all, no query, no fragment, no credentials
(docs/operations/ARX_PUSH_RELAY_DEPLOY_HE.md section 3.3). The server appends `/v1/push` itself, so a base with an extra path makes
the relay answer a plain 404 for every push; that must never be confused with "this phone's token is gone"
(services/mobile_push.py), and it is refused up front here with an explicit Hebrew message."""
from __future__ import annotations

from urllib.parse import urlsplit

ERR_SCHEME = "כתובת הממסר שגויה: חייבת להתחיל ב-https://"
ERR_SHAPE = "כתובת הממסר שגויה: יש להזין את כתובת הבסיס בלבד (https://שם-המארח), בלי נתיב כמו /v1, בלי סימן שאלה, בלי # ובלי שם משתמש וסיסמה."
ERR_HOST = "כתובת הממסר שגויה: שם המארח חסר או אינו תקין."
MAX_LEN = 300


def check_relay_url(raw: object, *, allow_http: bool = False) -> tuple[str | None, str | None]:
    """`(normalized, None)` for a good URL, `(None, None)` for an empty one (the channel is simply not set up) and `(None, hebrew_error)`
    for a malformed one. `allow_http` is only for the tests' in-process fake relay. One trailing slash is tolerated and removed."""
    if raw is None:
        return None, None
    if not isinstance(raw, str):
        return None, ERR_SHAPE
    text = raw.strip()
    if not text:
        return None, None
    if len(text) > MAX_LEN or any(ch.isspace() or ord(ch) < 32 or ch == "\\" for ch in text):
        return None, ERR_SHAPE
    lower = text.lower()
    if not (lower.startswith("https://") or (allow_http and lower.startswith("http://"))):
        return None, ERR_SCHEME
    if "?" in text or "#" in text or "@" in text:
        return None, ERR_SHAPE
    try:
        parts = urlsplit(text)
        port = parts.port  # raises ValueError for a non-numeric or out-of-range port
    except ValueError:
        return None, ERR_HOST
    host = parts.hostname or ""
    if not host or host.startswith(".") or host.endswith(".") or ".." in host:
        return None, ERR_HOST
    if parts.path not in ("", "/"):
        return None, ERR_SHAPE
    netloc = host if port is None else f"{host}:{port}"
    if ":" in host:  # an IPv6 literal keeps its brackets
        netloc = f"[{host}]" + (f":{port}" if port is not None else "")
    return f"{parts.scheme.lower()}://{netloc}", None
