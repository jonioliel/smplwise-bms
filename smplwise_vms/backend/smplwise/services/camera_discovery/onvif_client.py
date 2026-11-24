"""The fuller ONVIF client of camera discovery (ONVIF-CLIENT-2500; design docs/design/onvif-discovery-2412 sections 4.2, 4.3, 8 and
9; owner decisions 2026-11-22 Q57). It plugs into the scan job through `service.Identifier` and changes none of its attempt rules.

One identification press of one camera (`OnvifClient.information`):
1. `GetDeviceInformation` with a WS-Security PasswordDigest built on the camera's own clock - THE credential attempt of the press.
2. When the camera answers that request with an HTTP Digest challenge (401 `WWW-Authenticate: Digest ...`), the same press answers
   that challenge ONCE (design section 9: "try HTTP Digest once (same press)"). Both refusals count toward the scan job's lockout
   guard, and the guard is asked BEFORE the Digest request is sent: a camera whose guard is full is not contacted again
   (`locked_guard`). No other retry exists: a refused pair ends the press for that camera.
3. After `ok`, the reads that turn a camera into a video source, all with the same proven credentials, all Get* (onvif_http's
   closed allow-list): `GetServices` (fallback `GetCapabilities`) for the Media2 / Media service addresses - kept only when they
   point at the very address that answered (`wsd.same_host_xaddrs`, design D1); Media2 `GetProfiles` + `GetStreamUri` (RTSP) per
   video profile, Media1 when Media2 is missing or gives nothing; one `GetSnapshotUri` for the suggested main profile.
4. Every stream address the camera gives is shaped for the camera-source model (`shape_stream`): rtsp / rtsps only, the same host
   as the camera, no user name or password inside, no fragment (go2rtc reads `#...` as its own options), no go2rtc API query key,
   bounded. The credentials are put into it only on the server, at the add / preview step (`with_credentials`), and the result
   still goes through camera_sources.refusal (services/source_policy.py) there.

Caps: at most MAX_REQUESTS requests and DEADLINE_S seconds per camera per press, MAX_PROFILES profiles read, MAX_STREAM_READS stream
addresses asked for; each answer is onvif_http's (64 KiB, no redirect, 3 s, no DOCTYPE). Nothing here logs, returns or raises a
user name, a password, a digest, a nonce, a serial or a device's own error text: outcome codes only. Nothing here calls go2rtc or
writes to a device."""
from __future__ import annotations

import datetime as dt
import hashlib
import ipaddress
import re
import secrets
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Protocol
from urllib.parse import quote, urlsplit, urlunsplit
from xml.etree import ElementTree as ET

from . import onvif_http
from .onvif_http import Clock, DeviceInfo, Target
from .wsd import _child, _local, _text, clean_value, same_host_xaddrs

MAX_REQUESTS = 16  # per camera per press (device information, services, profiles, stream addresses, snapshot, a stale nonce)
DEADLINE_S = 20.0  # per camera per press
MAX_PROFILES = 8  # profiles read from one answer
MAX_STREAM_READS = 6  # GetStreamUri requests per camera per press
URI_MAX = 512
SUB_MIN_WIDTH = 320  # design 4.2: sub = the lowest-resolution profile at least this wide
NAME_MAX = 64
_PRINTABLE_RE = re.compile(r"^[\x21-\x7e]+$")
_DIGEST_PARAM_RE = re.compile(r'([A-Za-z][A-Za-z0-9_-]*)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^\s,"]+))')
_FORBIDDEN_QUERY_KEYS = frozenset({"src", "name"})  # source_policy.FORBIDDEN_QUERY_KEYS: go2rtc's own API words
CODECS = {"h264": "h264", "avc": "h264", "h265": "h265", "hevc": "h265", "jpeg": "mjpeg", "mjpeg": "mjpeg", "mpeg4": "mpeg4"}


# ---------------------------------------------------------------- the lockout guard, seen from the client

class Guard(Protocol):
    """The scan job's per-camera lockout guard (service.Manager): `allow()` before every credential request after the first;
    `refused()` for every request the camera refused."""

    def allow(self) -> bool: ...

    def refused(self) -> None: ...


class _NoGuard:
    def allow(self) -> bool:
        return True

    def refused(self) -> None:
        return None


# ---------------------------------------------------------------- results

def shown(uri: str) -> str:
    """The only form of a camera's stream address an answer may carry: scheme, host and port, the path and query replaced by `/***`.
    Some cameras put a user name, a password or a token in the path (`/user=admin&password=...`), which the query-only masking of the
    camera-source model would let through (security review, ONVIF-UI-2500)."""
    try:
        p = urlsplit(uri)
        host = p.hostname or ""
        hostport = (f"[{host}]" if ":" in host else host) + (f":{p.port}" if p.port else "")
    except ValueError:
        return "***"
    return f"{p.scheme.lower()}://{hostport}/***" if host else "***"


@dataclass
class Profile:
    """One video profile of a camera. `uri` (repr hidden) is the camera's own stream address WITHOUT credentials, already shaped;
    `stream` says why there is none (`other_host`, `not_rtsp`, `bad_shape`, `no_answer`, `not_read`)."""

    token: str
    name: str | None
    codec: str | None
    width: int | None
    height: int | None
    fps: int | None
    uri: str | None = field(default=None, repr=False)
    stream: str = "not_read"

    def view(self) -> dict[str, Any]:
        return {"token": self.token, "name": self.name, "codec": self.codec, "width": self.width, "height": self.height, "fps": self.fps,
                "stream": self.stream, "uri_masked": shown(self.uri) if self.uri else None}

    @property
    def pixels(self) -> int:
        return (self.width or 0) * (self.height or 0)


@dataclass
class Identified(DeviceInfo):
    """DeviceInfo plus what the media reads found. `media`: media2 | media | none (no media service / no video profile);
    `auth_mode`: wsse | digest (how the camera accepted the pair); `refusals`: requests the camera refused in this press."""

    auth_mode: str | None = None
    media: str = "none"
    profiles: list[Profile] = field(default_factory=list)
    snapshot_uri: str | None = field(default=None, repr=False)
    requests: int = 0
    refusals: int = 0


# ---------------------------------------------------------------- HTTP Digest (RFC 7616 / 2617), answered once per press

@dataclass
class Challenge:
    realm: str
    nonce: str = field(repr=False)
    algorithm: str = "MD5"  # MD5 | MD5-sess | SHA-256 | SHA-256-sess
    qop: str | None = None  # auth | None
    opaque: str | None = field(default=None, repr=False)
    stale: bool = False


def parse_challenge(raw: str | None) -> Challenge | None:
    """The Digest challenge of a (bounded) WWW-Authenticate header; None when there is none this client can answer (no realm /
    nonce, an unknown algorithm, only `auth-int`)."""
    if not raw or len(raw) > onvif_http.CHALLENGE_MAX:
        return None
    m = re.search(r"(?:^|[\s,])digest\s+", raw, re.IGNORECASE)
    if m is None:
        return None
    rest = raw[m.end():]
    nxt = re.search(r",\s*(?:basic|bearer|negotiate|ntlm|digest)\s+[A-Za-z]", rest, re.IGNORECASE)  # the next scheme, if any
    rest = rest[: nxt.start()] if nxt else rest
    params: dict[str, str] = {}
    for key, quoted, bare in _DIGEST_PARAM_RE.findall(rest):
        params.setdefault(key.lower(), re.sub(r"\\(.)", r"\1", quoted) if quoted else bare)
    realm, nonce = params.get("realm"), params.get("nonce")
    if not realm or not nonce or len(realm) > 256 or len(nonce) > 256 or not nonce.isascii() or not realm.isprintable():
        return None
    algorithm = {"md5": "MD5", "md5-sess": "MD5-sess", "sha-256": "SHA-256", "sha-256-sess": "SHA-256-sess"}.get(params.get("algorithm", "md5").lower())
    if algorithm is None:
        return None
    qops = [q.strip().lower() for q in params.get("qop", "").split(",") if q.strip()]
    if qops and "auth" not in qops:
        return None  # auth-int only: not answered
    opaque = params.get("opaque")
    return Challenge(realm=realm, nonce=nonce, algorithm=algorithm, qop="auth" if qops else None,
                     opaque=opaque if opaque and len(opaque) <= 256 else None, stale=params.get("stale", "").lower() == "true")


def _h(algorithm: str, text: str) -> str:
    fn = hashlib.sha256 if algorithm.startswith("SHA-256") else hashlib.md5
    return fn(text.encode("utf-8")).hexdigest()


def _quoted(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def digest_authorization(ch: Challenge, method: str, uri: str, username: str, password: str, nc: int, cnonce: str) -> str:
    """The `Authorization: Digest ...` value answering `ch` (RFC 7616 section 3.4). Never logged."""
    ha1 = _h(ch.algorithm, f"{username}:{ch.realm}:{password}")
    if ch.algorithm.endswith("-sess"):
        ha1 = _h(ch.algorithm, f"{ha1}:{ch.nonce}:{cnonce}")
    ha2 = _h(ch.algorithm, f"{method}:{uri}")
    if ch.qop == "auth":
        response = _h(ch.algorithm, f"{ha1}:{ch.nonce}:{nc:08x}:{cnonce}:auth:{ha2}")
    else:
        response = _h(ch.algorithm, f"{ha1}:{ch.nonce}:{ha2}")
    parts = [f'username="{_quoted(username)}"', f'realm="{_quoted(ch.realm)}"', f'nonce="{_quoted(ch.nonce)}"', f'uri="{_quoted(uri)}"',
             f"algorithm={ch.algorithm}", f'response="{response}"']
    if ch.qop == "auth":
        parts += ["qop=auth", f"nc={nc:08x}", f'cnonce="{cnonce}"']
    if ch.opaque is not None:
        parts.append(f'opaque="{_quoted(ch.opaque)}"')
    return "Digest " + ", ".join(parts)


# ---------------------------------------------------------------- stream addresses for the camera-source model

def _same_address(host: str | None, address: str) -> bool:
    try:
        return host is not None and ipaddress.ip_address(host) == ipaddress.ip_address(address)
    except ValueError:
        return False  # a name: never followed (it could resolve anywhere)


def shape_stream(uri: Any, address: str) -> tuple[str | None, str]:
    """(the address to keep, `ok`) or (None, why). Kept: rtsp / rtsps to `address` itself (design 4.2 step 4: another host is
    refused - `cameras.discovery_allow_other_host` is not built), without user info (removed: the typed pair goes in at the add
    step), without a fragment, without go2rtc's `src` / `name` query keys, ASCII, at most URI_MAX characters."""
    if not isinstance(uri, str) or not uri or len(uri) > URI_MAX or not _PRINTABLE_RE.fullmatch(uri):
        return None, "bad_shape"
    try:
        p = urlsplit(uri)
        scheme, host, port = p.scheme.lower(), p.hostname, p.port
    except ValueError:
        return None, "bad_shape"
    if scheme not in ("rtsp", "rtsps"):
        return None, "not_rtsp"
    if p.fragment or "#" in uri or "\\" in uri:
        return None, "bad_shape"
    if not _same_address(host, address):
        return None, "other_host"
    keys = {c.partition("=")[0].lower() for c in p.query.replace(";", "&").split("&") if c}
    if keys & _FORBIDDEN_QUERY_KEYS:
        return None, "bad_shape"
    hostport = f"[{host}]" if host and ":" in host else str(host)
    if port is not None:
        if not 0 < port < 65536:
            return None, "bad_shape"
        hostport += f":{port}"
    return urlunsplit((scheme, hostport, p.path or "/", p.query, "")), "ok"


def with_credentials(uri: str, username: str, password: str) -> str:
    """The shaped stream address with the typed pair inside (percent-encoded). Built on the server only, at the add / preview
    step; sealed by camera_sources at once, never returned, logged or audited."""
    p = urlsplit(uri)
    return urlunsplit((p.scheme, f"{quote(username, safe='')}:{quote(password, safe='')}@{p.netloc}", p.path, p.query, ""))


def _http_shape(uri: Any, address: str) -> str | None:
    """A snapshot address: http(s) to the camera itself, no user info / fragment, bounded; else None."""
    if not isinstance(uri, str) or not uri or len(uri) > URI_MAX or not _PRINTABLE_RE.fullmatch(uri):
        return None
    try:
        p = urlsplit(uri)
        ok = p.scheme.lower() in ("http", "https") and "@" not in p.netloc and not p.fragment and _same_address(p.hostname, address)
        _ = p.port
    except ValueError:
        return None
    return urlunsplit((p.scheme.lower(), p.netloc, p.path or "/", p.query, "")) if ok else None


def suggest(profiles: list[Profile]) -> tuple[Profile | None, Profile | None]:
    """Design 4.2 step 3: main = the highest-resolution H.264 / H.265 profile with a stream address (any codec when none is); sub =
    the lowest-resolution other one at least SUB_MIN_WIDTH wide (None: one address serves both)."""
    usable = [p for p in profiles if p.uri]
    if not usable:
        return None, None
    video = [p for p in usable if p.codec in ("h264", "h265")] or usable
    main = max(video, key=lambda p: (p.pixels, p.codec == "h264"))
    rest = [p for p in usable if p is not main and (p.width or 0) >= SUB_MIN_WIDTH and p.pixels < main.pixels]
    sub = min(rest, key=lambda p: (p.pixels, p.codec != "h264")) if rest else None
    return main, sub


# ---------------------------------------------------------------- reading answers (closed set of read paths by local name)

def _all(root: ET.Element, name: str) -> list[ET.Element]:
    return [el for el in root.iter() if _local(el.tag) == name]


def _int_of(el: ET.Element | None, lo: int, hi: int) -> int | None:
    try:
        v = int(float(_text(el)))
    except ValueError:
        return None
    return v if lo <= v <= hi else None


def parse_services(root: ET.Element) -> dict[str, list[str]]:
    """GetServicesResponse / GetCapabilitiesResponse -> {media2: [xaddr], media: [xaddr]} (raw, judged by the caller)."""
    out: dict[str, list[str]] = {"media2": [], "media": []}
    for svc in _all(root, "Service")[:32]:
        ns, xaddr = _text(_child(svc, "Namespace")), _text(_child(svc, "XAddr"))
        if ns == onvif_http.MEDIA2_NS and xaddr:
            out["media2"].append(xaddr)
        elif ns == onvif_http.MEDIA_NS and xaddr:
            out["media"].append(xaddr)
    caps = _all(root, "Capabilities")
    for cap in caps[:1]:
        media = _child(cap, "Media")
        if media is not None and _text(_child(media, "XAddr")):
            out["media"].append(_text(_child(media, "XAddr")))
        ext = _child(cap, "Extension")
        for el in (ext.iter() if ext is not None else ()):
            if _local(el.tag) == "Media2" and _text(_child(el, "XAddr")):  # some firmwares announce Media2 here
                out["media2"].append(_text(_child(el, "XAddr")))
    return {k: v[:4] for k, v in out.items()}


def parse_profiles(root: ET.Element, media: str) -> list[Profile]:
    """GetProfilesResponse (Media1 or Media2) -> the video profiles (at most MAX_PROFILES; one without a video encoder is skipped)."""
    resp = next(iter(_all(root, "GetProfilesResponse")), None)
    if resp is None:
        return []
    out: list[Profile] = []
    for prof in resp:
        if _local(prof.tag) != "Profiles":
            continue
        if len(out) >= MAX_PROFILES:
            break
        token = (prof.get("token") or "").strip()
        if not onvif_http.TOKEN_RE.fullmatch(token) or any(p.token == token for p in out):
            continue
        if media == "media2":
            confs = _child(prof, "Configurations")
            enc = _child(confs, "VideoEncoder") if confs is not None else None
        else:
            enc = _child(prof, "VideoEncoderConfiguration")
        if enc is None:
            continue
        res = _child(enc, "Resolution")
        rate = _child(enc, "RateControl")
        raw_codec = _text(_child(enc, "Encoding")).lower().replace(".", "").replace("-", "")
        out.append(Profile(token=token, name=clean_value(_text(_child(prof, "Name")), NAME_MAX),
                           codec=CODECS.get(raw_codec, "other" if raw_codec else None),
                           width=_int_of(_child(res, "Width") if res is not None else None, 1, 16384),
                           height=_int_of(_child(res, "Height") if res is not None else None, 1, 16384),
                           fps=_int_of(_child(rate, "FrameRateLimit") if rate is not None else None, 1, 1000)))
    return out


def _uri_of(root: ET.Element, response: str) -> str | None:
    resp = next(iter(_all(root, response)), None)
    if resp is None:
        return None
    uri = next(iter(_all(resp, "Uri")), None)
    return _text(uri) or None


# ---------------------------------------------------------------- one press of one camera

@dataclass
class _Call:
    """The outcome of one request: `root` (a parsed envelope) or nothing; `refused` when the camera refused the credentials."""

    status: int | None
    root: ET.Element | None
    refused: bool = False
    challenge: str | None = field(default=None, repr=False)

    @property
    def ok(self) -> bool:
        return self.status is not None and 200 <= self.status < 300 and self.root is not None and onvif_http._find(self.root, "Fault") is None


class _Session:
    """The proven way to talk to one camera inside one press: WS-Security (a fresh nonce and Created on the camera's clock per
    request) or HTTP Digest (the camera's nonce, a counting `nc`; a `stale` nonce is renewed once - not a refusal)."""

    def __init__(self, username: str, password: str, offset_s: float | None, guard: Guard, clock: Callable[[], float]) -> None:
        self.username, self.password = username, password
        self.offset_s = offset_s
        self.guard = guard
        self.mode = "wsse"
        self.challenge: Challenge | None = None
        self.nc = 0
        self.requests = 0
        self.refusals = 0
        self.retry_used = False
        self.clock = clock
        self.deadline = clock() + DEADLINE_S

    def budget_left(self) -> bool:
        return self.requests < MAX_REQUESTS and self.clock() < self.deadline

    def _send(self, target: Target, action: str, service: str, token: str | None) -> _Call:
        self.requests += 1
        headers: dict[str, str] = {}
        if self.mode == "digest" and self.challenge is not None:
            self.nc += 1
            uri = target.path or "/"
            headers["Authorization"] = digest_authorization(self.challenge, "POST", uri, self.username, self.password, self.nc, secrets.token_hex(8))
            security = ""
        else:
            device_now = onvif_http.now_utc() + dt.timedelta(seconds=self.offset_s or 0.0)
            security = onvif_http._security(self.username, self.password, device_now)
        body = _build(action, security, service, token)
        ans = onvif_http._post(target, action, body, onvif_http.TIMEOUT_S, service=service, headers=headers)
        if ans is None:
            return _Call(None, None)
        root = onvif_http._parse(ans.body)
        refused = onvif_http._auth_fault(root) or ans.status in (401, 403)
        return _Call(ans.status, root, refused=refused, challenge=ans.challenge)

    def call(self, target: Target, action: str, service: str = "device", token: str | None = None) -> _Call:
        """One read with the session's credentials; a refusal is counted toward the guard. The one HTTP Digest answer of the press
        (`retry_used`) happens here when a camera answers WS-Security with a Digest challenge and the guard still allows it."""
        if not self.budget_left():
            return _Call(None, None)
        res = self._send(target, action, service, token)
        if res.refused and self.mode == "digest" and res.challenge:
            ch = parse_challenge(res.challenge)
            if ch is not None and ch.stale and self.budget_left():  # the pair was right, only the nonce aged: renew it once
                self.challenge, self.nc = ch, 0
                res = self._send(target, action, service, token)
        if not res.refused:
            return res
        self.refusals += 1
        self.guard.refused()
        if self.mode == "wsse" and res.challenge and not self.retry_used:
            ch = parse_challenge(res.challenge)
            if ch is None:
                return res
            self.retry_used = True
            if not self.guard.allow() or not self.budget_left():
                res.challenge = "guard"  # the Digest answer was due, the guard said no: not sent
                return res
            self.mode, self.challenge, self.nc = "digest", ch, 0
            res = self._send(target, action, service, token)
            if res.refused:
                self.refusals += 1
                self.guard.refused()
        return res


def _build(action: str, security: str, service: str, token: str | None) -> bytes:
    """The envelope of one of the reads this client sends - every action named literally (the allow-list test reads them)."""
    if action == "GetDeviceInformation":
        return onvif_http.envelope("GetDeviceInformation", security)
    if action == "GetServices":
        return onvif_http.envelope("GetServices", security)
    if action == "GetCapabilities":
        return onvif_http.envelope("GetCapabilities", security)
    if action == "GetProfiles":
        return onvif_http.envelope("GetProfiles", security, service=service)
    if action == "GetStreamUri":
        return onvif_http.envelope("GetStreamUri", security, service=service, token=token)
    if action == "GetSnapshotUri":
        return onvif_http.envelope("GetSnapshotUri", security, service=service, token=token)
    raise ValueError("ONVIF action not allowed")


class OnvifClient:
    """`service.Identifier`: the device clock (no credentials) and one press's identification (credentials, then the media reads)."""

    def __init__(self, now: Callable[[], float] = time.monotonic) -> None:
        self.now = now  # seam: the per-press deadline's clock

    def clock(self, target: Target) -> Clock | None:
        """`GetSystemDateAndTime`, no credentials (onvif_http.device_clock)."""
        return onvif_http.device_clock(target)

    def information(self, target: Target, username: str, password: str, offset_s: float | None, guard: Guard | None = None) -> Identified:
        if not isinstance(username, str) or not isinstance(password, str) or not username or len(username) > onvif_http.USER_MAX or len(password) > onvif_http.PASSWORD_MAX:
            raise ValueError("credentials out of bounds")
        g = guard or _NoGuard()
        s = _Session(username, password, offset_s, g, self.now)
        res = s.call(target, "GetDeviceInformation")
        out = self._device_info(res, s)
        if out.auth != "ok":
            return out
        if self._media(target, s, out):
            # the camera answered its device information without checking the pair (some do), then refused the media reads: the
            # pair is not good for a video source - reported, counted and forgotten like any refusal
            out.auth, out.media, out.profiles, out.snapshot_uri = "wrong_password", "none", [], None
        out.requests, out.refusals = s.requests, s.refusals
        out.auth_mode = s.mode if out.auth == "ok" else None
        return out

    @staticmethod
    def _device_info(res: _Call, s: _Session) -> Identified:
        def done(auth: str, **kw: Any) -> Identified:
            return Identified(auth, requests=s.requests, refusals=s.refusals, auth_mode=s.mode if auth == "ok" else None, **kw)

        if res.status is None and res.root is None:
            return done("no_answer")
        if res.refused:
            if res.challenge == "guard":
                return done("locked_guard")
            if s.mode == "wsse" and res.challenge and parse_challenge(res.challenge) is None:
                return done("digest_required")  # a Digest challenge this client cannot answer
            return done("wrong_password")
        resp = onvif_http._find(res.root, "GetDeviceInformationResponse") if res.root is not None else None
        if resp is None or res.status is None or not 200 <= res.status < 300:
            return done("not_onvif")

        def val(name: str) -> str | None:
            return clean_value(_text(_child(resp, name)))

        serial = _text(_child(resp, "SerialNumber"))[: onvif_http.VALUE_SERIAL_MAX] or None
        return done("ok", manufacturer=val("Manufacturer"), model=val("Model"), firmware=val("FirmwareVersion"), hardware_id=val("HardwareId"),
                    serial=serial)

    def _media(self, target: Target, s: _Session, out: Identified) -> bool:
        """The media reads after `ok`; True when the camera refused one of them (the press stops there)."""
        services: dict[str, list[str]] = {"media2": [], "media": []}
        res = s.call(target, "GetServices")
        if res.refused:
            return True
        if res.ok and res.root is not None:
            services = parse_services(res.root)
        if not services["media2"] and not services["media"]:
            res = s.call(target, "GetCapabilities")
            if res.refused:
                return True
            if res.ok and res.root is not None:
                found = parse_services(res.root)
                services = {k: services[k] + found[k] for k in services}
        for media in ("media2", "media"):  # design 4.2: Media2 first, Media1 after
            kept, _dropped = same_host_xaddrs(services[media], target.address)  # design D1: only the address that answered
            if not kept:
                continue
            scheme, port, path = kept[0]
            mt = Target(target.address, port, path, scheme)
            profiles, refused = self._profiles(mt, media, s)
            if refused:
                return True
            if not any(p.uri for p in profiles) and media == "media2" and services["media"]:
                continue  # Media2 gave no usable stream: Media1 may
            if profiles:
                out.media, out.profiles = media, profiles
                main, _sub = suggest(profiles)
                if main is not None:
                    res = s.call(mt, "GetSnapshotUri", media, main.token)
                    if res.refused:
                        return True
                    if res.ok and res.root is not None:
                        out.snapshot_uri = _http_shape(_uri_of(res.root, "GetSnapshotUriResponse"), target.address)
                return False
        return False

    @staticmethod
    def _profiles(mt: Target, media: str, s: _Session) -> tuple[list[Profile], bool]:
        res = s.call(mt, "GetProfiles", media)
        if res.refused:
            return [], True
        if not res.ok or res.root is None:
            return [], False
        profiles = parse_profiles(res.root, media)
        # largest first: the stream reads (capped) go to the profiles most likely to be main / sub
        for p in sorted(profiles, key=lambda p: -p.pixels)[:MAX_STREAM_READS]:
            r = s.call(mt, "GetStreamUri", media, p.token)
            if r.refused:
                return profiles, True
            if not r.ok or r.root is None:
                p.stream = "no_answer"
                continue
            p.uri, p.stream = shape_stream(_uri_of(r.root, "GetStreamUriResponse"), mt.address)
        return profiles, False
