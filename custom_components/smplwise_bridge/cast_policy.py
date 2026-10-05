"""Cast policy for `smplwise_bridge.cast_stream` (bridge 0.7.0, CR-028 phase 1): what the bridge lets a Cast device be told to play,
decided WITHOUT trusting the add-on. Dependency-free (standard library only), like media_policy.py: the same function runs inside Home
Assistant Core and in plain unit tests.

The generic path is unchanged: `smplwise_bridge.execute` still refuses every `media_player.play_media` but a Samsung key or typed text
(media_policy.py, CR-015). This service is the ONE narrow way a URL reaches a screen, and it refuses, whatever the signature says:

- an op other than `play`, `stop`, `off`; any key outside the op's own set;
- a target that is not ONE `media_player` entity whose registry platform is `cast` (a DLNA renderer, an Apple TV, a Samsung browser or a
  speaker of another platform is never told to fetch anything here - phase 1 is Google Cast only);
- a URL that is not exactly `http://<host>:<port>/cast/<32 hex>/index.m3u8` - no credentials, no query, no fragment, no other path;
- a URL whose `<host>:<port>` is not the cast origin the PAIRED add-on announced (signed with the pairing secret under its own purpose,
  carried by the user-directory answer); no origin announced = nothing is played;
- a URL host that is not an IP address of THIS Home Assistant host (the relay is the add-on on this machine; a TV is never pointed
  anywhere else on the LAN or outside it) - when the host's addresses cannot be read, nothing is played;
- a title longer than 80 characters or carrying control characters.

Pure functions: they never read Home Assistant state themselves."""
from __future__ import annotations

import ipaddress
import re
from typing import Any, Callable, Iterable, Mapping
from urllib.parse import urlsplit

OPS = ("play", "stop", "off")
BASE_KEYS = frozenset({"user_id", "op", "entity_id", "request_id", "ts", "nonce", "sig"})
OP_KEYS = {"play": frozenset({"url", "title"}), "stop": frozenset(), "off": frozenset()}
CAST_PLATFORM = "cast"
ENTITY_RE = re.compile(r"^media_player\.[a-z0-9_]{1,200}$")
PATH_RE = re.compile(r"^/cast/[0-9a-f]{32}/index\.m3u8$")
URL_MAX = 200
TITLE_MAX = 80
_CONTROL = re.compile(r"[\x00-\x1f\x7f]")
CONTENT_TYPE = "application/vnd.apple.mpegurl"

Platform = Callable[[str], "str | None"]


def _ip(host: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address | None:
    try:
        return ipaddress.ip_address(host.strip("[]"))
    except ValueError:
        return None


def origin_netloc(origin: Any) -> str | None:
    """`host:port` of an announced origin (`http://<IP>:<port>`), or None when it is not one."""
    if not isinstance(origin, str) or len(origin) > 80:
        return None
    try:
        p = urlsplit(origin)
        port = p.port
    except ValueError:
        return None
    if p.scheme != "http" or p.username or p.password or p.path not in ("", "/") or p.query or p.fragment or not p.hostname or port is None:
        return None
    ip = _ip(p.hostname)
    if ip is None:
        return None
    return f"[{ip}]:{port}" if ip.version == 6 else f"{ip}:{port}"


def url_refusal(url: Any, origin: Any, local_addresses: Iterable[Any] | None) -> str | None:
    """None when `url` may be played: the relay path on the announced origin, whose host is one of this machine's addresses."""
    if not isinstance(url, str) or not 1 <= len(url) <= URL_MAX or _CONTROL.search(url) or "\\" in url or not url.isascii():
        return "cast_url_refused"
    want = origin_netloc(origin)
    if want is None:
        return "cast_origin_unknown"
    try:
        p = urlsplit(url)
        port = p.port
    except ValueError:
        return "cast_url_refused"
    if p.scheme != "http" or p.username is not None or p.password is not None or p.query or p.fragment or "?" in url or "#" in url:
        return "cast_url_refused"
    if not PATH_RE.match(p.path or ""):
        return "cast_url_refused"
    ip = _ip(p.hostname or "")
    if ip is None or port is None:
        return "cast_url_refused"
    got = f"[{ip}]:{port}" if ip.version == 6 else f"{ip}:{port}"
    if got != want:
        return "cast_origin_mismatch"
    if local_addresses is None:
        return "cast_origin_unverifiable"
    mine = {str(a) for a in (_ip(str(x)) for x in local_addresses) if a is not None}
    if str(ip) not in mine:
        return "cast_origin_not_local"
    return None


def refusal(msg: Mapping[str, Any], platform_of: Platform, origin: Any, local_addresses: Iterable[Any] | None) -> str | None:
    """None when this signed `cast_stream` request may run, else a fixed refusal code (never the URL)."""
    op = msg.get("op")
    if op not in OPS:
        return "cast_op_refused"
    keys = set(map(str, msg))
    if not BASE_KEYS <= keys or keys - BASE_KEYS - OP_KEYS[op]:
        return "invalid_request"
    entity_id = msg.get("entity_id")
    if not isinstance(entity_id, str) or not ENTITY_RE.match(entity_id):
        return "cast_entity"
    if platform_of(entity_id) != CAST_PLATFORM:
        return "cast_entity"
    if op != "play":
        return None
    if "url" not in msg:
        return "invalid_request"
    title = msg.get("title")
    if title is not None and (not isinstance(title, str) or not 1 <= len(title) <= TITLE_MAX or _CONTROL.search(title)):
        return "invalid_request"
    return url_refusal(msg.get("url"), origin, local_addresses)


def service_call(msg: Mapping[str, Any]) -> tuple[str, str, dict[str, Any]]:
    """The ONE Home Assistant call a request that passed `refusal` becomes: (domain, service, data)."""
    entity_id = msg["entity_id"]
    if msg["op"] == "stop":
        return "media_player", "media_stop", {"entity_id": entity_id}
    if msg["op"] == "off":
        return "media_player", "turn_off", {"entity_id": entity_id}
    extra: dict[str, Any] = {"stream_type": "LIVE"}
    if msg.get("title"):
        extra["title"] = msg["title"]
    return "media_player", "play_media", {"entity_id": entity_id, "media_content_type": CONTENT_TYPE, "media_content_id": msg["url"], "extra": extra}
