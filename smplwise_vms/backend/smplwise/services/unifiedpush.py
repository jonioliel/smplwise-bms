"""ANDROID-PUSH-2550 (CR-012 section 4C): push to the Arx phone app WITHOUT Google services - UnifiedPush.

How it works (docs/api/mobile-presence-contract.md section 7.4):
- the phone runs a UnifiedPush distributor app (ntfy, Sunup, NextPush ...) that keeps ONE connection to a push server the site
  chose (self-hosted or public). The Arx app registers through the UnifiedPush connector and receives a Web Push endpoint on that
  server plus its own Web Push keys (p256dh / auth); it registers them with this installation (`POST notifications/devices`
  with `kind: "unifiedpush"`, device token);
- the notification core's `app` channel (services/mobile_push.AppPushChannel) then sends to that endpoint instead of the SmplWise
  relay: the SAME content-less body the relay carries (`{notification_id, category, server, priority}` plus the optional
  CRITSOUND flags), encrypted end to end with RFC 8291 (`aes128gcm`) and signed with the installation's VAPID key - the code of
  services/push.py, which already speaks Web Push to browsers. The push server sees only an encrypted blob, its size and time;
  the app fetches the real text from this installation with its device token (`GET notifications/app/{message_id}`), exactly as
  after a relay push;
- no Google, no Apple, no SmplWise relay and no account anywhere are involved on this path.

Configuration - OFF by default: the add-on option `unifiedpush_servers` (config.py puts it in `SW_UNIFIEDPUSH_SERVERS`), a list of
push server host names separated by commas or spaces (`ntfy.example.com`, `push.example.org:8443`). Empty = UnifiedPush is off: the
registration is refused (`409 unifiedpush_off`) and `GET notifications/push-options` says `enabled: false`. The list is the SSRF
fence: the server only ever POSTs to an https endpoint whose host (and port, when the entry names one) is EXACTLY on it - no IP
literals, no credentials in the URL, no fragment, no redirects followed. An entry that is not a plain DNS host name is ignored and
reported in the health state (`invalid_entries`), never echoed.
`TRANSPORT` lets the tests install a fake push server (httpx.MockTransport); no test reaches the network."""
from __future__ import annotations

import ipaddress
import json
import os
import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit

import httpx
from cryptography.hazmat.primitives.asymmetric import ec

from ..test_reset import register_reset
from . import push

ENV = "SW_UNIFIEDPUSH_SERVERS"
OPTION = "unifiedpush_servers"
MAX_ENDPOINT_LEN = push.MAX_ENDPOINT_LEN
MAX_ENTRIES = 8
SEND_TIMEOUT_S = 10.0
TTL_S = push.TTL_S  # an alert older than an hour is not worth waking a phone for
TRANSPORT: httpx.BaseTransport | None = None
_ENTRY_RE = re.compile(r"^(?P<host>[a-z0-9.-]{1,253})(?::(?P<port>[0-9]{1,5}))?$")
STATE_HE: dict[str, str] = {
    "off": "UnifiedPush כבוי: לא הוגדר אף שרת דחיפה (אפשרות התוסף unifiedpush_servers).",
    "invalid": "אף רשומה ברשימת שרתי UnifiedPush אינה שם שרת תקין.",
}
CONFIG_ERRORS = ("unifiedpush_off", "endpoint_refused", "vapid_missing")  # the site's setup, not the phone: registration kept, no failure counted
STATS: dict[str, Any] = {"sent": 0, "gone": 0, "failed": 0, "refused": 0, "last_error": None, "last_sent_at": None}


@dataclass(frozen=True)
class Allowed:
    host: str
    port: int | None  # None = the entry named no port: only the default https port is accepted


def _parse(raw: str) -> tuple[list[Allowed], int]:
    """(valid entries, number of entries ignored). An entry: a DNS host name with at least one dot, optional `:port`; never an IP."""
    out: list[Allowed] = []
    bad = 0
    for item in re.split(r"[\s,;]+", raw.strip().lower()):
        if not item:
            continue
        m = _ENTRY_RE.match(item)
        host = m.group("host").rstrip(".") if m else ""
        port = int(m.group("port")) if m and m.group("port") else None
        ok = bool(m) and bool(push.HOST_RE.match(host)) and not host.rsplit(".", 1)[-1].isdigit() and (port is None or 1 <= port <= 65535)
        if ok:
            try:
                ipaddress.ip_address(host)
                ok = False  # an IP literal: refused (no lab or LAN addresses as push targets)
            except ValueError:
                pass
        if ok and len(out) < MAX_ENTRIES:
            a = Allowed(host, None if port == 443 else port)
            if a not in out:
                out.append(a)
        elif not ok:
            bad += 1
    return out, bad


def allowed_servers() -> list[Allowed]:
    return _parse(os.environ.get(ENV) or "")[0]


def enabled() -> bool:
    """UnifiedPush is on when the add-on option names at least one valid push server."""
    return bool(allowed_servers())


def allowed_endpoint(endpoint: Any, servers: list[Allowed] | None = None) -> bool:
    """https, no credentials, no fragment, a plain host name, and host (+ port) exactly on the site's list."""
    if not isinstance(endpoint, str) or not endpoint or len(endpoint) > MAX_ENDPOINT_LEN:
        return False
    try:
        u = urlsplit(endpoint)
        port = u.port
    except ValueError:
        return False
    host = (u.hostname or "").lower()
    if u.scheme != "https" or not host or u.username or u.password or u.fragment or not push.HOST_RE.match(host):
        return False
    if any(c.isspace() or ord(c) < 0x21 or ord(c) > 0x7E for c in endpoint):
        return False
    if u.netloc.lower() != (host if port is None else f"{host}:{port}"):  # no user info, no brackets, nothing but host[:port]
        return False
    port = None if port == 443 else port
    return any(a.host == host and a.port == port for a in (servers if servers is not None else allowed_servers()))


def validate(endpoint: Any, p256dh: Any, auth: Any) -> None:
    """Raises push.InvalidSubscription with a UnifiedPush code; the endpoint itself is never part of the message."""
    if not isinstance(endpoint, str) or not allowed_endpoint(endpoint):
        raise push.InvalidSubscription("unifiedpush_endpoint_refused", "כתובת הדחיפה אינה של שרת UnifiedPush שהוגדר באתר הזה.")
    try:  # the same key shapes push.validate demands of a browser: an uncompressed P-256 point and a 16-byte auth secret
        if not isinstance(p256dh, str) or not isinstance(auth, str) or len(p256dh) > 128 or len(auth) > 64:
            raise ValueError("type")
        raw = push.b64u_dec(p256dh)
        if len(raw) != 65 or raw[0] != 4:
            raise ValueError("shape")
        ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), raw)
        if len(push.b64u_dec(auth)) != 16:
            raise ValueError("auth")
    except (ValueError, TypeError):
        raise push.InvalidSubscription("push_keys_invalid", "מפתחות הדחיפה של הטלפון אינם תקינים.") from None


def body_for(message_id: str, category: str, server: str, priority: str, critical_alert: bool = False, resolved_tone: bool = False) -> bytes:
    """The decrypted body the app's connector receives: the relay's FCM data map, nothing more (no text, no address, no name).
    The CRITSOUND flags travel as the string "1" exactly like the FCM data keys (contract section 7.3), absent otherwise."""
    data: dict[str, str] = {"notification_id": message_id, "category": category, "server": server, "priority": priority}
    if critical_alert:
        data["critical_alert"] = "1"
    elif resolved_tone:
        data["resolved_tone"] = "1"
    return json.dumps(data, separators=(",", ":"), ensure_ascii=True).encode("ascii")


@dataclass
class Outcome:
    status: int  # HTTP status of the push server; 0 = no answer
    retry_after: float | None = None
    error: str | None = None
    kind: str | None = None  # "token_gone" (404 / 410: the subscription is gone) | None


def send(endpoint: str, p256dh: str, auth: str, body: bytes, urgency: str, key: tuple[ec.EllipticCurvePrivateKey, str] | None) -> Outcome:
    """One Web Push POST. Never follows a redirect; the endpoint is re-checked against the CURRENT list (an entry removed after the
    phone registered is never called again)."""
    if not enabled():
        return Outcome(0, error="unifiedpush_off")
    if not allowed_endpoint(endpoint):
        STATS["refused"] += 1
        return Outcome(0, error="endpoint_refused")
    if key is None:
        return Outcome(0, error="vapid_missing")
    private, public = key
    headers = {"Authorization": push.vapid_authorization(private, public, endpoint), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream",
               "TTL": str(TTL_S), "Urgency": "high" if urgency == "high" else "normal"}
    try:
        payload = push.encrypt(body, p256dh, auth)
        with httpx.Client(timeout=SEND_TIMEOUT_S, transport=TRANSPORT, follow_redirects=False) as client:
            r = client.post(endpoint, content=payload, headers=headers)
    except (httpx.HTTPError, OSError) as exc:
        return Outcome(0, error=type(exc).__name__)
    except ValueError as exc:  # broken keys stored by hand
        return Outcome(400, error=type(exc).__name__)
    retry_after = None
    ra = r.headers.get("retry-after")
    if ra:
        try:
            retry_after = min(push.MAX_RETRY_AFTER_S, max(0.0, float(ra)))
        except ValueError:
            retry_after = None
    if r.status_code in (404, 410):
        return Outcome(r.status_code, retry_after, f"unifiedpush_{r.status_code}", "token_gone")
    if 300 <= r.status_code < 400:
        return Outcome(r.status_code, retry_after, "unifiedpush_redirect")  # not followed: counted as a failure, never a retry
    return Outcome(r.status_code, retry_after, None if r.is_success else f"http_{r.status_code}")


def health() -> dict[str, Any]:
    """For the administrator (`GET notify/stats`, member `app_unifiedpush`): on / off, how many servers are allowed and how many entries
    were ignored, with the Hebrew reason when it is not on. Never a host name, an endpoint or a key."""
    servers, bad = _parse(os.environ.get(ENV) or "")
    if servers:
        state, message = "ok", None
    elif bad:
        state, message = "invalid", STATE_HE["invalid"]
    else:
        state, message = "off", STATE_HE["off"]
    return {"enabled": bool(servers), "state": state, "message": message, "servers": len(servers), "invalid_entries": bad,
            "sent": STATS["sent"], "failed": STATS["failed"], "gone": STATS["gone"], "last_error": STATS["last_error"], "last_sent_at": STATS["last_sent_at"]}


def _reset_all_for_tests() -> None:
    STATS.clear()
    STATS.update({"sent": 0, "gone": 0, "failed": 0, "refused": 0, "last_error": None, "last_sent_at": None})


register_reset(__name__, ("STATS",), _reset_all_for_tests)  # CR-SINGLETON-RESETS-2460: module-level tables (tests/test_singletons_registered.py)
