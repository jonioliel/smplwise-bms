"""The two ONVIF device-service reads camera discovery needs (ONVIF-DISCOVER-2500; design sections 4.2, 4.3, 8 D2 / D3 / D4 / D9).

- `device_clock(target)`: `GetSystemDateAndTime`, no credentials - the device's UTC clock, so the password digest is built on the
  device's time (clock drift is measured and kept as evidence, never "fixed"). Also the HTTP fallback's "is anything ONVIF here".
- `device_information(target, username, password, offset)`: `GetDeviceInformation` with a WS-Security UsernameToken
  **PasswordDigest** (Base64(SHA-1(nonce + created + password)), ONVIF Core) - the ONE credential attempt of a press. Manufacturer,
  model, firmware; the serial number is returned to the caller only to compute the keyed fingerprint and is never stored, logged or
  answered.

The SOAP actions this module can build are a closed allow-list per service (SERVICE_ACTIONS / ALLOWED_ACTIONS: reads only, each
with a fixed body template - only a profile token, checked against TOKEN_RE and escaped, is ever filled in); anything else is a code
error before a socket is opened. ONVIF-CLIENT-2500 widened the list to the reads the fuller client needs (device `GetServices` /
`GetCapabilities`, Media and Media2 `GetProfiles` / `GetStreamUri` / `GetSnapshotUri`) and lets a request carry an HTTP Digest
`Authorization` header; the client itself (services/camera_discovery/onvif_client.py) plugs in through `Identifier`
(services/camera_discovery/service.py) without changing the attempt rules, which live in the scan job.

Every answer is device-controlled: at most MAX_BYTES (read in chunks, the rest is never read), no redirects, a short timeout, no
DOCTYPE / ENTITY (services/xmlsafe.py), a closed set of read paths by local name. No error text of a device, and never the password,
the digest or the nonce, leaves this module (outcome codes only)."""
from __future__ import annotations

import base64
import datetime as dt
import hashlib
import re
import secrets
from dataclasses import dataclass, field
from typing import Mapping
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape

import httpx

from .. import xmlsafe
from .wsd import _bounded, _child, _local, _text, NotAProbeMatch, clean_value

DEVICE_NS = "http://www.onvif.org/ver10/device/wsdl"
MEDIA_NS = "http://www.onvif.org/ver10/media/wsdl"
MEDIA2_NS = "http://www.onvif.org/ver20/media/wsdl"
SCHEMA_NS = "http://www.onvif.org/ver10/schema"
# service -> (namespace, prefix); the closed set of services a request may be built for
SERVICES: dict[str, tuple[str, str]] = {"device": (DEVICE_NS, "tds"), "media": (MEDIA_NS, "trt"), "media2": (MEDIA2_NS, "tr2")}
# design D9: Get* reads only, per service (ONVIF-CLIENT-2500 added everything but the first two)
SERVICE_ACTIONS: dict[str, frozenset[str]] = {
    "device": frozenset({"GetSystemDateAndTime", "GetDeviceInformation", "GetServices", "GetCapabilities"}),
    "media": frozenset({"GetProfiles", "GetStreamUri", "GetSnapshotUri"}),
    "media2": frozenset({"GetProfiles", "GetStreamUri", "GetSnapshotUri"}),
}
ALLOWED_ACTIONS = frozenset().union(*SERVICE_ACTIONS.values())
# a profile token as a device names it (ONVIF ReferenceToken: at most 64 characters); anything else is never put into a request
TOKEN_RE = re.compile(r"^[A-Za-z0-9_.:\-][A-Za-z0-9_.:\- ]{0,62}[A-Za-z0-9_.:\-]$|^[A-Za-z0-9_.:\-]$")
MAX_BYTES = 64 * 1024
TIMEOUT_S = 3.0  # design D2: 3 s per request
USER_MAX = 64
PASSWORD_MAX = 128
VALUE_SERIAL_MAX = 64

# seam: tests install an httpx.MockTransport (a fake ONVIF device); nothing in a test reaches a real device
TRANSPORT: httpx.BaseTransport | None = None


@dataclass(frozen=True)
class Target:
    """Where a device's own service answers: always the address that answered the probe (wsd.same_host_xaddrs)."""

    address: str
    port: int
    path: str = "/onvif/device_service"
    scheme: str = "http"

    def url(self) -> str:
        host = f"[{self.address}]" if ":" in self.address else self.address
        return f"{self.scheme}://{host}:{self.port}{self.path}"


@dataclass
class Clock:
    offset_s: float | None  # device UTC minus this machine's UTC; None when the device did not say
    onvif: bool  # the answer was an ONVIF GetSystemDateAndTimeResponse


@dataclass
class DeviceInfo:
    """`auth`: ok | wrong_password | digest_required | no_answer | not_onvif. `failed_auth`: the device REJECTED credentials (counts
    toward the lockout guard)."""

    auth: str
    manufacturer: str | None = None
    model: str | None = None
    firmware: str | None = None
    hardware_id: str | None = None
    serial: str | None = field(default=None, repr=False)

    @property
    def failed_auth(self) -> bool:
        return self.auth in ("wrong_password", "digest_required")


def _iso(at: dt.datetime) -> str:
    return at.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def password_digest(password: str, nonce: bytes, created: str) -> str:
    """ONVIF Core / WS-Security UsernameToken profile: Base64(SHA-1(nonce + created + password))."""
    return base64.b64encode(hashlib.sha1(nonce + created.encode("utf-8") + password.encode("utf-8")).digest()).decode("ascii")


def _security(username: str, password: str, device_now: dt.datetime, nonce: bytes | None = None) -> str:
    nonce = nonce if nonce is not None else secrets.token_bytes(16)
    created = _iso(device_now)
    return (
        '<s:Header><wsse:Security s:mustUnderstand="1" '
        'xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" '
        'xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">'
        f"<wsse:UsernameToken><wsse:Username>{escape(username)}</wsse:Username>"
        '<wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">'
        f"{password_digest(password, nonce, created)}</wsse:Password>"
        '<wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">'
        f"{base64.b64encode(nonce).decode('ascii')}</wsse:Nonce>"
        f"<wsu:Created>{created}</wsu:Created></wsse:UsernameToken></wsse:Security></s:Header>"
    )


def _inner(service: str, action: str, token: str | None) -> str:
    """The fixed body of one allow-listed read; `token` (a profile token) is the only value ever filled in."""
    p = SERVICES[service][1]
    needs_token = action in ("GetStreamUri", "GetSnapshotUri")
    if needs_token != (token is not None):
        raise ValueError("ONVIF request shape not allowed")
    if token is not None and not TOKEN_RE.fullmatch(token):
        raise ValueError("profile token refused")
    tok = escape(token) if token is not None else ""
    if service == "device":
        return {"GetServices": "<tds:GetServices><tds:IncludeCapability>false</tds:IncludeCapability></tds:GetServices>",
                "GetCapabilities": "<tds:GetCapabilities><tds:Category>All</tds:Category></tds:GetCapabilities>"}.get(action, f"<tds:{action}/>")
    if action == "GetProfiles":
        return "<tr2:GetProfiles><tr2:Type>VideoEncoder</tr2:Type></tr2:GetProfiles>" if service == "media2" else "<trt:GetProfiles/>"
    if action == "GetStreamUri" and service == "media":
        return ("<trt:GetStreamUri><trt:StreamSetup><tt:Stream>RTP-Unicast</tt:Stream><tt:Transport><tt:Protocol>RTSP</tt:Protocol>"
                f"</tt:Transport></trt:StreamSetup><trt:ProfileToken>{tok}</trt:ProfileToken></trt:GetStreamUri>")
    if action == "GetStreamUri":
        return f"<tr2:GetStreamUri><tr2:Protocol>RTSP</tr2:Protocol><tr2:ProfileToken>{tok}</tr2:ProfileToken></tr2:GetStreamUri>"
    return f"<{p}:GetSnapshotUri><{p}:ProfileToken>{tok}</{p}:ProfileToken></{p}:GetSnapshotUri>"


def envelope(action: str, security: str = "", *, service: str = "device", token: str | None = None) -> bytes:
    """A SOAP 1.2 request for one allow-listed read of `service`. ValueError for any other action, service or shape (design D9)."""
    if service not in SERVICE_ACTIONS or action not in SERVICE_ACTIONS[service]:
        raise ValueError("ONVIF action not allowed")
    ns, prefix = SERVICES[service]
    return ('<?xml version="1.0" encoding="UTF-8"?>'
            f'<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:{prefix}="{ns}" xmlns:tt="{SCHEMA_NS}">'
            f"{security}<s:Body>{_inner(service, action, token)}</s:Body></s:Envelope>").encode("utf-8")


CHALLENGE_MAX = 1024


@dataclass
class _Answer:
    status: int
    body: bytes
    challenge: str | None = field(default=None, repr=False)  # the raw WWW-Authenticate header (bounded) when it names Digest

    @property
    def digest_challenge(self) -> bool:
        return self.challenge is not None


def _post(target: Target, action: str, body: bytes, timeout: float, *, service: str = "device",
          headers: Mapping[str, str] | None = None) -> _Answer | None:
    """POST one envelope; None when nothing usable came back (no connection, timeout, an answer over MAX_BYTES). `headers`: an
    `Authorization` header (HTTP Digest) only - never logged, never followed to another address (no redirects)."""
    sent = {"Content-Type": f'application/soap+xml; charset=utf-8; action="{SERVICES[service][0]}/{action}"', **(headers or {})}
    try:
        with httpx.Client(transport=TRANSPORT, timeout=timeout, follow_redirects=False, trust_env=False) as client:
            with client.stream("POST", target.url(), content=body, headers=sent) as r:
                buf = bytearray()
                for chunk in r.iter_bytes():
                    buf += chunk
                    if len(buf) > MAX_BYTES:
                        return None
                raw = ", ".join(r.headers.get_list("www-authenticate"))[:CHALLENGE_MAX]
                return _Answer(r.status_code, bytes(buf), raw if "digest" in raw.lower() else None)
    except (httpx.HTTPError, OSError, ValueError):
        return None


def _parse(body: bytes) -> ET.Element | None:
    if not body:
        return None
    try:
        root = xmlsafe.parse(body)
        _bounded(root)
    except (ET.ParseError, NotAProbeMatch):
        return None
    return root if _local(root.tag) == "Envelope" else None


def _find(root: ET.Element, name: str) -> ET.Element | None:
    for el in root.iter():
        if _local(el.tag) == name:
            return el
    return None


def _auth_fault(root: ET.Element | None) -> bool:
    """A SOAP fault that says the credentials were refused (ter:NotAuthorized, wsse:FailedAuthentication / InvalidSecurity)."""
    if root is None:
        return False
    fault = _find(root, "Fault")
    if fault is None:
        return False
    words = " ".join((el.text or "") for el in fault.iter()).lower()
    return any(w in words for w in ("notauthorized", "failedauthentication", "invalidsecurity", "sender not authorized"))


def _int(el: ET.Element | None, name: str, lo: int, hi: int) -> int | None:
    if el is None:
        return None
    try:
        v = int(_text(_child(el, name)))
    except ValueError:
        return None
    return v if lo <= v <= hi else None


def _utc_of(resp: ET.Element) -> dt.datetime | None:
    utc = _find(resp, "UTCDateTime")
    if utc is None:
        return None
    date, time_ = _child(utc, "Date"), _child(utc, "Time")
    year, month, day = _int(date, "Year", 1970, 2200), _int(date, "Month", 1, 12), _int(date, "Day", 1, 31)
    hour, minute, second = _int(time_, "Hour", 0, 23), _int(time_, "Minute", 0, 59), _int(time_, "Second", 0, 60)
    if year is None or month is None or day is None or hour is None or minute is None or second is None:
        return None
    try:
        return dt.datetime(year, month, day, hour, minute, min(second, 59), tzinfo=dt.timezone.utc)  # a leap second reads as :59
    except ValueError:  # 31 February
        return None


def now_utc() -> dt.datetime:  # seam: tests pin the local clock
    return dt.datetime.now(dt.timezone.utc)


def device_clock(target: Target, timeout: float = TIMEOUT_S) -> Clock | None:
    """`GetSystemDateAndTime` (no credentials). None: no answer at all. `onvif` False: something answered that is not ONVIF."""
    ans = _post(target, "GetSystemDateAndTime", envelope("GetSystemDateAndTime"), timeout)
    if ans is None:
        return None
    root = _parse(ans.body)
    resp = _find(root, "GetSystemDateAndTimeResponse") if root is not None else None
    if resp is None:
        return Clock(None, False)
    at = _utc_of(resp)
    return Clock(round((at - now_utc()).total_seconds(), 1) if at is not None else None, True)


def device_information(target: Target, username: str, password: str, offset_s: float | None, timeout: float = TIMEOUT_S) -> DeviceInfo:
    """ONE authenticated `GetDeviceInformation` - never retried here. The digest is built on the device's clock (`offset_s`)."""
    if not isinstance(username, str) or not isinstance(password, str) or not username or len(username) > USER_MAX or len(password) > PASSWORD_MAX:
        raise ValueError("credentials out of bounds")
    device_now = now_utc() + dt.timedelta(seconds=offset_s or 0.0)
    ans = _post(target, "GetDeviceInformation", envelope("GetDeviceInformation", _security(username, password, device_now)), timeout)
    if ans is None:
        return DeviceInfo("no_answer")
    root = _parse(ans.body)
    if _auth_fault(root):
        return DeviceInfo("wrong_password")
    if ans.status in (401, 403):
        return DeviceInfo("digest_required" if ans.digest_challenge else "wrong_password")
    resp = _find(root, "GetDeviceInformationResponse") if root is not None else None
    if resp is None or not 200 <= ans.status < 300:
        return DeviceInfo("not_onvif")

    def val(name: str) -> str | None:
        return clean_value(_text(_child(resp, name)))

    serial = _text(_child(resp, "SerialNumber"))[:VALUE_SERIAL_MAX] or None
    return DeviceInfo("ok", manufacturer=val("Manufacturer"), model=val("Model"), firmware=val("FirmwareVersion"), hardware_id=val("HardwareId"),
                      serial=serial)
