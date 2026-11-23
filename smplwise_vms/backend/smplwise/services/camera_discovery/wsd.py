"""WS-Discovery over unicast UDP (ONVIF-DISCOVER-2500; design docs/design/onvif-discovery-2412/DESIGN.md sections 4.1 and 8).

Two things only: the `Probe` Arx sends (a fixed template; the only variable parts are a fresh `MessageID` and one of two fixed type
lists) and the reader of a device's `ProbeMatches` answer. The answer is device-controlled data and is read defensively (design D1,
D2): at most MAX_DATAGRAM bytes, no DOCTYPE / ENTITY (services/xmlsafe.py), UTF-8 only, at most MAX_DEPTH levels and MAX_ELEMENTS
elements, a closed set of read paths by local name (namespace-tolerant: vendors use different prefixes and both the 2005/04 and the
2009 WS-Discovery namespaces), and every value bounded and cleaned. A service address (`XAddrs`) is kept only when it is plain
http(s) to the very address that answered (`same_host_xaddrs`): a device cannot point Arx at another host (SSRF guard).

No network code here (services/camera_discovery/sweep.py sends and receives)."""
from __future__ import annotations

import ipaddress
import re
import uuid
from dataclasses import dataclass, field
from typing import Iterable
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree as ET

from .. import xmlsafe

MAX_DATAGRAM = 64 * 1024  # design D2: 64 KiB per answer
MAX_DEPTH = 32
MAX_ELEMENTS = 2000
MAX_MATCHES = 8  # ProbeMatch elements read from one answer
MAX_TYPES = 16
MAX_SCOPES = 64
MAX_XADDRS = 8
SCOPE_MAX_LEN = 512
VALUE_MAX = 64  # a manufacturer / model / name taken from a scope
ENDPOINT_MAX = 128

# round 1 asks for video transmitters (cameras and most recorders answer); round 2 asks every ONVIF device the first round did not
# hear from (recorders that only advertise tds:Device, and a second chance for a lost datagram)
TYPES_TRANSMITTER = "dn:NetworkVideoTransmitter"
TYPES_DEVICE = "tds:Device"
PROBE_TYPES = (TYPES_TRANSMITTER, TYPES_DEVICE)

_PROBE = (
    '<?xml version="1.0" encoding="UTF-8"?>'
    '<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing" '
    'xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dn="http://www.onvif.org/ver10/network/wsdl" '
    'xmlns:tds="http://www.onvif.org/ver10/device/wsdl">'
    "<e:Header><w:MessageID>{mid}</w:MessageID>"
    '<w:To e:mustUnderstand="true">urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>'
    '<w:Action e:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action></e:Header>'
    "<e:Body><d:Probe><d:Types>{types}</d:Types></d:Probe></e:Body></e:Envelope>"
)
_MID_RE = re.compile(r"^uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
_ENDPOINT_RE = re.compile(r"^[A-Za-z0-9:._\-/{}]{1,128}$")
_CLEAN_RE = re.compile(r"[^\w .,()/+#-]", re.UNICODE)

# what a recorder looks like (design 4.4, owner decision Q59): a WS-Discovery type or an ONVIF scope type naming storage / a
# recorder, or a model name of a known recorder family. Hikvision DS-7xxx / DS-8xxx / DS-9xxx / DS-96xxx (and iDS-) are recorders,
# DS-2xxx cameras; Dahua / Uniview / generic names carry NVR / DVR / XVR / HCVR / NVS.
RECORDER_TYPES = frozenset({"networkvideostorage", "networkvideorecorder", "networkvideodisplay"})
RECORDER_SCOPE_TYPES = frozenset({"networkvideostorage", "nvs", "nvr", "dvr", "xvr", "recorder", "video_recorder", "networkvideorecorder", "storage",
                                  "recording"})
CAMERA_TYPES = frozenset({"networkvideotransmitter"})
CAMERA_SCOPE_TYPES = frozenset({"video_encoder", "networkvideotransmitter", "network_video_transmitter", "nvt", "ptz", "video_analytics",
                                "audio_encoder", "camera"})
RECORDER_MODEL_RE = re.compile(r"(?:^|[^A-Za-z])(?:NVR|DVR|XVR|HCVR|NVS)|^i?DS-(?:7|8|9)\d", re.IGNORECASE)


def new_message_id() -> str:
    return f"uuid:{uuid.uuid4()}"


def probe(message_id: str, types: str) -> bytes:
    """The Probe datagram. `message_id` must be a fresh `uuid:<uuid4>` and `types` one of PROBE_TYPES (anything else is a code
    error: nothing device- or user-supplied is ever put into the template)."""
    if not _MID_RE.fullmatch(message_id or "") or types not in PROBE_TYPES:
        raise ValueError("probe: message id or types not allowed")
    return _PROBE.format(mid=message_id, types=types).encode("utf-8")


@dataclass
class ProbeMatch:
    """One device's answer, cleaned. `endpoint` (the device's `urn:uuid:` - on some makes it embeds the MAC address) stays inside
    the scan job: it is used to merge duplicates and is never returned or logged."""

    relates_to: str | None
    endpoint: str | None = field(default=None, repr=False)
    types: tuple[str, ...] = ()
    scopes: tuple[str, ...] = ()
    xaddrs: tuple[str, ...] = ()
    manufacturer: str | None = None
    model: str | None = None
    name: str | None = None
    scope_types: tuple[str, ...] = ()


class NotAProbeMatch(ValueError):
    """The datagram is not a ProbeMatches answer this reader accepts (too large, unsafe XML, wrong shape)."""


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if isinstance(tag, str) else ""


def _bounded(root: ET.Element) -> None:
    count = 0
    stack: list[tuple[ET.Element, int]] = [(root, 1)]
    while stack:
        el, depth = stack.pop()
        count += 1
        if depth > MAX_DEPTH or count > MAX_ELEMENTS:
            raise NotAProbeMatch("too deep or too many elements")
        stack.extend((child, depth + 1) for child in el)


def _text(el: ET.Element | None) -> str:
    return (el.text or "").strip() if el is not None else ""


def _child(el: ET.Element, name: str) -> ET.Element | None:
    for c in el:
        if _local(c.tag) == name:
            return c
    return None


def clean_value(raw: str | None, limit: int = VALUE_MAX) -> str | None:
    """A device-supplied label made safe to show: percent-decoded once, only word characters and a few separators, collapsed
    spaces, at most `limit` characters; None when nothing is left."""
    if not raw:
        return None
    text = _CLEAN_RE.sub(" ", unquote(raw))
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit] or None


def _scope_parts(scopes: Iterable[str]) -> tuple[str | None, str | None, str | None, tuple[str, ...]]:
    """(manufacturer, model, name, scope types) from the ONVIF scopes (`onvif://www.onvif.org/<kind>/<value>`)."""
    hardware = name = mfr = None
    kinds: list[str] = []
    for s in scopes:
        low = s.lower()
        if not low.startswith("onvif://www.onvif.org/"):
            continue
        rest = s[len("onvif://www.onvif.org/"):]
        kind, _, value = rest.partition("/")
        kind = kind.lower()
        if kind == "hardware" and hardware is None:
            hardware = clean_value(value)
        elif kind == "name" and name is None:
            name = clean_value(value)
        elif kind in ("manufacturer", "mfr") and mfr is None:
            mfr = clean_value(value)
        elif kind == "type" and value:
            kinds.append(value.strip("/").lower()[:40])
    if mfr is None and name and hardware and name.lower().endswith(hardware.lower()) and len(name) > len(hardware):
        mfr = clean_value(name[: -len(hardware)])  # "HIKVISION DS-2CD2143G2-I" with hardware "DS-2CD2143G2-I"
    return mfr, hardware, name, tuple(dict.fromkeys(kinds))[:MAX_TYPES]


def parse_probe_matches(data: bytes) -> list[ProbeMatch]:
    """The ProbeMatch entries of one datagram (at most MAX_MATCHES). Raises NotAProbeMatch for anything else."""
    if not isinstance(data, (bytes, bytearray)) or not data or len(data) > MAX_DATAGRAM:
        raise NotAProbeMatch("empty or too large")
    try:
        root = xmlsafe.parse(bytes(data))
    except ET.ParseError as exc:
        raise NotAProbeMatch("not safe XML") from exc
    _bounded(root)
    if _local(root.tag) != "Envelope":
        raise NotAProbeMatch("not a SOAP envelope")
    header = _child(root, "Header")
    body = _child(root, "Body")
    if body is None:
        raise NotAProbeMatch("no body")
    relates = _text(_child(header, "RelatesTo")) if header is not None else ""
    matches_el = _child(body, "ProbeMatches")
    if matches_el is None:
        raise NotAProbeMatch("not ProbeMatches")
    out: list[ProbeMatch] = []
    for m in matches_el:
        if _local(m.tag) != "ProbeMatch":
            continue
        if len(out) >= MAX_MATCHES:
            break
        epr = _child(m, "EndpointReference")
        endpoint = _text(_child(epr, "Address")) if epr is not None else ""
        endpoint = endpoint if _ENDPOINT_RE.fullmatch(endpoint) else ""
        types = tuple(t.rpartition(":")[2] for t in _text(_child(m, "Types")).split()[:MAX_TYPES] if t)
        scopes = tuple(s for s in _text(_child(m, "Scopes")).split()[:MAX_SCOPES] if len(s) <= SCOPE_MAX_LEN)
        xaddrs = tuple(x for x in _text(_child(m, "XAddrs")).split()[:MAX_XADDRS] if len(x) <= 512)
        mfr, model, name, scope_types = _scope_parts(scopes)
        out.append(ProbeMatch(relates_to=relates[:ENDPOINT_MAX] or None, endpoint=endpoint or None, types=types, scopes=scopes, xaddrs=xaddrs,
                              manufacturer=mfr, model=model, name=name, scope_types=scope_types))
    if not out:
        raise NotAProbeMatch("no ProbeMatch")
    return out


def same_host_xaddrs(xaddrs: Iterable[str], responder: str) -> tuple[list[tuple[str, int, str]], int]:
    """The service addresses of `xaddrs` that are plain http(s) to `responder` itself (design D1), as (scheme, port, path); and how
    many were dropped (another host, an IPv6 / link-local form, a user name in the address, a query, a bad port)."""
    try:
        want = ipaddress.ip_address(responder)
    except ValueError:
        return [], len(list(xaddrs))
    kept: list[tuple[str, int, str]] = []
    dropped = 0
    for x in xaddrs:
        try:
            p = urlsplit(x)
            scheme, host, port = p.scheme.lower(), p.hostname, p.port
        except ValueError:
            dropped += 1
            continue
        path = p.path or "/onvif/device_service"
        ok = (scheme in ("http", "https") and host is not None and "@" not in p.netloc and not p.query and not p.fragment
              and path.startswith("/") and len(path) <= 256 and path.isascii() and not re.search(r"[\s\x00-\x1f\x7f\\]", path))
        if ok:
            try:
                ok = ipaddress.ip_address(host) == want
            except ValueError:
                ok = False  # a name: never followed (it could resolve anywhere)
        if not ok:
            dropped += 1
            continue
        entry = (scheme, port or (443 if scheme == "https" else 80), path)
        if entry not in kept:
            kept.append(entry)
    return kept, dropped


def classify(types: Iterable[str], scope_types: Iterable[str], *models: str | None) -> str:
    """`nvr` | `camera` | `unknown` from what a device says about itself (design 4.4, owner decision Q59: a recorder is offered
    "add as a recorder", never added as a camera). A recorder sign wins over a camera sign: most recorders also call themselves
    video transmitters."""
    t = {x.lower() for x in types}
    st = {x.lower() for x in scope_types}
    if t & RECORDER_TYPES or st & RECORDER_SCOPE_TYPES or any(m and RECORDER_MODEL_RE.search(m) for m in models):
        return "nvr"
    if t & CAMERA_TYPES or st & CAMERA_SCOPE_TYPES:
        return "camera"
    return "unknown"
