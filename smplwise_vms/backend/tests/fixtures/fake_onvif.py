"""A fake ONVIF network for camera discovery tests (ONVIF-DISCOVER-2500). Nothing here touches a real network.

- `FakeNetwork` is the sweep's UDP transport: a Probe "sent" to an address is answered by the `FakeOnvifDevice` living there (when it
  answers probes, and when the probed types match it), the answer queued for `recv`. Every datagram sent is recorded with its
  instant (pacing tests) and extra raw datagrams can be injected (spoofed / hostile answers).
- `FakeNetwork.http` is an httpx.MockTransport handler: the ONVIF device service of every fake device - `GetSystemDateAndTime`
  (no credentials) and `GetDeviceInformation`, which checks the WS-Security PasswordDigest exactly as a camera does (digest of
  nonce + created + password, `Created` within CLOCK_SKEW_S of the DEVICE's clock) and can lock its account after N failures.
  Any other action answers a SOAP fault (and is recorded: the tests assert none is ever sent).

ONVIF-CLIENT-2500 extended the device service to what the fuller client reads, still all from the specification shapes:
- HTTP Digest (RFC 7616, MD5 or SHA-256, qop=auth): a `digest_only` device answers a WS-Security request with 401 and a Digest
  challenge, and accepts a request whose `Authorization: Digest` answers a nonce it issued (`stale_after` ages a nonce);
- `GetServices` (or, when `services=False`, an ActionNotSupported fault and the `GetCapabilities` answer) naming the Media
  (`/onvif/Media`) and / or Media2 (`/onvif/Media2`) service - `media_host` points them at another host (the SSRF guard);
- Media1 and Media2 `GetProfiles` (video encoder: codec, resolution, frame rate), `GetStreamUri` (RTSP; `stream_host` puts the
  address on another host, `stream_uris` overrides it per token) and `GetSnapshotUri`;
- `info_open`: GetDeviceInformation answered without checking the credentials (some firmwares), the media reads still checked;
  `media_refused`: the account may not read media.
Every request is recorded per device: `actions` (action names), `calls` ((service path, action, auth method)).

The answers are built from the ONVIF / WS-Discovery specification shapes with made-up values (a made-up 10.77.0.0/24 network,
made-up serials and endpoint ids) - nothing is captured from the lab."""
from __future__ import annotations

import base64
import datetime as dt
import hashlib
import re
import secrets
import threading
import time
from dataclasses import dataclass, field

import httpx

CLOCK_SKEW_S = 5.0
NS_ENV = "http://www.w3.org/2003/05/soap-envelope"
NS_A = "http://schemas.xmlsoap.org/ws/2004/08/addressing"
NS_D = "http://schemas.xmlsoap.org/ws/2005/04/discovery"
NS_MEDIA = "http://www.onvif.org/ver10/media/wsdl"
NS_MEDIA2 = "http://www.onvif.org/ver20/media/wsdl"
REALM = "fake-onvif"
PATHS = {"/onvif/device_service": "device", "/onvif/Media": "media", "/onvif/Media2": "media2"}


def default_profiles() -> list[dict]:
    """A Hikvision-like camera: a 2560x1440 main stream and a 640x360 sub stream, both H.264."""
    return [{"token": "Profile_1", "name": "mainStream", "encoding": "H264", "width": 2560, "height": 1440, "fps": 25},
            {"token": "Profile_2", "name": "subStream", "encoding": "H264", "width": 640, "height": 360, "fps": 15}]


@dataclass
class FakeOnvifDevice:
    address: str
    endpoint: str
    types: str = "dn:NetworkVideoTransmitter tds:Device"
    scopes: str = ""
    xaddrs: str | None = None  # None: http://<address>/onvif/device_service
    username: str = "admin"
    password: str = "Cam-Pass-1"
    serial: str = "FAKESERIAL0001"
    manufacturer: str = "HIKVISION"
    model: str = "DS-2CD2143G2-I"
    clock_offset_s: float = 0.0
    answers_probe: bool = True
    answers_http: bool = True
    relates: str = "ok"  # ok | missing | other
    digest_only: bool = False  # answers 401 + an HTTP Digest challenge to a WS-Security request
    digest_algorithm: str = "MD5"  # MD5 | SHA-256
    stale_after: int | None = None  # a Digest nonce is answered `stale=true` after this many uses
    lock_after: int | None = None  # the account locks after this many failed logins
    info_open: bool = False  # GetDeviceInformation without checking the credentials
    media_refused: bool = False  # the media reads are refused (an account without the media right)
    services: bool = True  # GetServices supported (else the client falls back to GetCapabilities)
    media1: bool = True
    media2: bool = False
    media_host: str | None = None  # the media services announced on another host
    stream_host: str | None = None  # the stream addresses on another host
    stream_uris: dict[str, str] = field(default_factory=dict)  # token -> the stream address the camera gives
    profiles: list[dict] = field(default_factory=default_profiles)
    failures: int = 0
    probes: int = 0
    auth_requests: int = 0
    actions: list[str] = field(default_factory=list)
    calls: list[tuple[str, str, str]] = field(default_factory=list)  # (service, action, auth: wsse | digest | none)
    nonces: dict[str, int] = field(default_factory=dict)  # issued Digest nonces -> uses

    def xaddr(self) -> str:
        return self.xaddrs if self.xaddrs is not None else f"http://{self.address}/onvif/device_service"


def probe_match(dev: FakeOnvifDevice, relates_to: str | None) -> bytes:
    relates = f"<a:RelatesTo>{relates_to}</a:RelatesTo>" if relates_to else ""
    return (f'<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="{NS_ENV}" xmlns:a="{NS_A}" xmlns:d="{NS_D}" '
            f'xmlns:dn="http://www.onvif.org/ver10/network/wsdl" xmlns:tds="http://www.onvif.org/ver10/device/wsdl">'
            f"<s:Header><a:MessageID>uuid:00000000-0000-4000-8000-{abs(hash(dev.endpoint)) % 10**12:012d}</a:MessageID>{relates}"
            f"<a:To>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</a:To>"
            f"<a:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/ProbeMatches</a:Action></s:Header>"
            f"<s:Body><d:ProbeMatches><d:ProbeMatch><a:EndpointReference><a:Address>{dev.endpoint}</a:Address></a:EndpointReference>"
            f"<d:Types>{dev.types}</d:Types><d:Scopes>{dev.scopes}</d:Scopes><d:XAddrs>{dev.xaddr()}</d:XAddrs>"
            f"<d:MetadataVersion>1</d:MetadataVersion></d:ProbeMatch></d:ProbeMatches></s:Body></s:Envelope>").encode("utf-8")


def hik_scopes(model: str, name: str | None = None, kind: str = "video_encoder") -> str:
    return (f"onvif://www.onvif.org/type/{kind} onvif://www.onvif.org/Profile/Streaming onvif://www.onvif.org/hardware/{model} "
            f"onvif://www.onvif.org/name/{(name or 'HIKVISION ' + model).replace(' ', '%20')} onvif://www.onvif.org/location/city/hangzhou")


class FakeNetwork:
    """The UDP side (Transport) and the HTTP side (`http`) of a set of fake devices."""

    def __init__(self, devices: list[FakeOnvifDevice] | None = None) -> None:
        self.devices = {d.address: d for d in devices or []}
        self.sent: list[tuple[float, str, bytes]] = []
        self.queue: list[tuple[bytes, str]] = []
        self.injected: list[tuple[bytes, str]] = []
        self.lock = threading.Lock()
        self.closed = 0
        self.http_requests: list[tuple[str, str]] = []  # (host, action)
        self.http_in_flight = 0
        self.http_max_in_flight = 0
        self.http_delay_s = 0.0

    # ---------------------------------------------------------------- UDP (sweep.Transport)

    def __call__(self) -> "FakeNetwork":  # the sweep's transport_factory
        return self

    def send(self, address: str, payload: bytes) -> None:
        text = payload.decode("utf-8")
        mid = re.search(r"<w:MessageID>(uuid:[0-9a-f-]+)</w:MessageID>", text).group(1)
        types = re.search(r"<d:Types>([^<]*)</d:Types>", text).group(1)
        with self.lock:
            self.sent.append((time.monotonic(), address, payload))
            if self.injected:
                self.queue.extend(self.injected)
                self.injected = []
            dev = self.devices.get(address)
            if dev is None or not dev.answers_probe:
                return
            dev.probes += 1
            if "NetworkVideoTransmitter" in types and "NetworkVideoTransmitter" not in dev.types:
                return  # a device matches a probe only when it has every probed type
            relates = {"ok": mid, "missing": None, "other": "uuid:11111111-2222-4333-8444-555555555555"}[dev.relates]
            self.queue.append((probe_match(dev, relates), address))

    def recv(self, timeout: float) -> tuple[bytes, str] | None:
        with self.lock:
            if self.queue:
                return self.queue.pop(0)
        time.sleep(min(timeout, 0.002))
        return None

    def close(self) -> None:
        self.closed += 1

    def inject(self, data: bytes, src: str) -> None:
        with self.lock:
            self.injected.append((data, src))

    # ---------------------------------------------------------------- HTTP (the device service)

    def http(self, request: httpx.Request) -> httpx.Response:
        host = request.url.host
        body = request.content.decode("utf-8", "replace")
        m = re.search(r"<s:Body>\s*<(\w+):(\w+)", body)
        action = m.group(2) if m else "?"
        with self.lock:
            self.http_requests.append((host, action))
            self.http_in_flight += 1
            self.http_max_in_flight = max(self.http_max_in_flight, self.http_in_flight)
        try:
            if self.http_delay_s:
                time.sleep(self.http_delay_s)
            dev = self.devices.get(host)
            if dev is None or not dev.answers_http:
                raise httpx.ConnectError("no route", request=request)
            service = PATHS.get(request.url.path, "?")
            authz = request.headers.get("authorization") or ""
            dev.actions.append(action)
            dev.calls.append((service, action, "digest" if authz.startswith("Digest ") else ("wsse" if "<wsse:Security" in body else "none")))
            now = dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=dev.clock_offset_s)
            if service == "device" and action == "GetSystemDateAndTime":
                return _soap(200, f"<tds:GetSystemDateAndTimeResponse><tds:SystemDateAndTime><tt:DateTimeType>NTP</tt:DateTimeType>"
                                  f"<tt:UTCDateTime><tt:Date><tt:Year>{now.year}</tt:Year><tt:Month>{now.month}</tt:Month><tt:Day>{now.day}</tt:Day></tt:Date>"
                                  f"<tt:Time><tt:Hour>{now.hour}</tt:Hour><tt:Minute>{now.minute}</tt:Minute><tt:Second>{now.second}</tt:Second></tt:Time>"
                                  f"</tt:UTCDateTime></tds:SystemDateAndTime></tds:GetSystemDateAndTimeResponse>")
            known = {"device": ("GetDeviceInformation", "GetServices", "GetCapabilities"),
                     "media": ("GetProfiles", "GetStreamUri", "GetSnapshotUri") if dev.media1 else (),
                     "media2": ("GetProfiles", "GetStreamUri", "GetSnapshotUri") if dev.media2 else ()}
            if action not in known.get(service, ()) or (action == "GetServices" and not dev.services):
                return _fault(400, "ter:ActionNotSupported")
            if action == "GetDeviceInformation":
                dev.auth_requests += 1
            if not (action == "GetDeviceInformation" and dev.info_open):
                denied = self._authenticate(request, body, dev, now, authz)
                if denied is not None:
                    return denied
                if dev.media_refused and service != "device":
                    dev.failures += 1
                    return _fault(400, "ter:NotAuthorized")
            return self._answer(dev, service, action, body)
        finally:
            with self.lock:
                self.http_in_flight -= 1

    def _authenticate(self, request: httpx.Request, body: str, dev: FakeOnvifDevice, now: dt.datetime, authz: str) -> httpx.Response | None:
        """None when the request carries the right credentials; else the camera's refusal (and a failed login counted)."""
        if dev.lock_after is not None and dev.failures >= dev.lock_after:
            return _fault(400, "ter:NotAuthorized")  # locked: even the right password is refused
        if authz.startswith("Digest "):
            verdict = _http_digest_ok(authz, dev, request.url.raw_path.decode("ascii"))
            if verdict == "ok":
                return None
            if verdict == "stale":
                return self._challenge(dev, stale=True)
            dev.failures += 1
            return self._challenge(dev)
        if dev.digest_only:
            return self._challenge(dev)  # HTTP authentication first: the WS-Security header is not even read (not a failed login)
        if not _digest_ok(body, dev, now):
            dev.failures += 1
            return _fault(400, "ter:NotAuthorized")
        return None

    @staticmethod
    def _challenge(dev: FakeOnvifDevice, stale: bool = False) -> httpx.Response:
        nonce = secrets.token_hex(12)
        dev.nonces[nonce] = 0
        algo = "" if dev.digest_algorithm == "MD5" else f", algorithm={dev.digest_algorithm}"
        return httpx.Response(401, headers={"WWW-Authenticate": f'Digest realm="{REALM}", qop="auth", nonce="{nonce}", opaque="op-77"{algo}'
                                                                f'{", stale=true" if stale else ""}'})

    def _answer(self, dev: FakeOnvifDevice, service: str, action: str, body: str) -> httpx.Response:
        a = dev.address
        if action == "GetDeviceInformation":
            return _soap(200, f"<tds:GetDeviceInformationResponse><tds:Manufacturer>{dev.manufacturer}</tds:Manufacturer><tds:Model>{dev.model}</tds:Model>"
                              f"<tds:FirmwareVersion>V5.7.3 build 220112</tds:FirmwareVersion><tds:SerialNumber>{dev.serial}</tds:SerialNumber>"
                              f"<tds:HardwareId>88</tds:HardwareId></tds:GetDeviceInformationResponse>")
        mh = dev.media_host or a
        if action == "GetServices":
            svcs = [("http://www.onvif.org/ver10/device/wsdl", f"http://{a}/onvif/device_service")]
            if dev.media1:
                svcs.append((NS_MEDIA, f"http://{mh}/onvif/Media"))
            if dev.media2:
                svcs.append((NS_MEDIA2, f"http://{mh}/onvif/Media2"))
            inner = "".join(f"<tds:Service><tds:Namespace>{ns}</tds:Namespace><tds:XAddr>{x}</tds:XAddr><tds:Version><tt:Major>2</tt:Major>"
                            f"<tt:Minor>60</tt:Minor></tds:Version></tds:Service>" for ns, x in svcs)
            return _soap(200, f"<tds:GetServicesResponse>{inner}</tds:GetServicesResponse>")
        if action == "GetCapabilities":
            media = f"<tt:Media><tt:XAddr>http://{mh}/onvif/Media</tt:XAddr></tt:Media>" if dev.media1 else ""
            return _soap(200, f"<tds:GetCapabilitiesResponse><tds:Capabilities><tt:Device><tt:XAddr>http://{a}/onvif/device_service</tt:XAddr></tt:Device>"
                              f"{media}</tds:Capabilities></tds:GetCapabilitiesResponse>")
        p = "tr2" if service == "media2" else "trt"
        token = re.search(r"ProfileToken>([^<]*)<", body)
        tok = token.group(1) if token else None
        if action == "GetProfiles":
            out = []
            for prof in dev.profiles:
                enc = (f"<tt:Name>{prof['token']}-enc</tt:Name><tt:UseCount>1</tt:UseCount><tt:Encoding>{prof['encoding']}</tt:Encoding>"
                       f"<tt:Resolution><tt:Width>{prof['width']}</tt:Width><tt:Height>{prof['height']}</tt:Height></tt:Resolution>"
                       f"<tt:RateControl><tt:FrameRateLimit>{prof['fps']}</tt:FrameRateLimit><tt:BitrateLimit>2048</tt:BitrateLimit></tt:RateControl>")
                if service == "media2":
                    out.append(f'<tr2:Profiles token="{prof["token"]}" fixed="true"><tr2:Name>{prof["name"]}</tr2:Name><tr2:Configurations>'
                               f'<tr2:VideoEncoder token="VE-{prof["token"]}" GovLength="50">{enc}</tr2:VideoEncoder></tr2:Configurations></tr2:Profiles>')
                else:
                    out.append(f'<trt:Profiles token="{prof["token"]}" fixed="true"><tt:Name>{prof["name"]}</tt:Name>'
                               f'<tt:VideoEncoderConfiguration token="VE-{prof["token"]}">{enc}</tt:VideoEncoderConfiguration></trt:Profiles>')
            return _soap(200, f"<{p}:GetProfilesResponse>{''.join(out)}</{p}:GetProfilesResponse>")
        idx = next((i for i, prof in enumerate(dev.profiles) if prof["token"] == tok), None)
        if idx is None:
            return _fault(400, "ter:NoProfile")
        if action == "GetStreamUri":
            uri = dev.stream_uris.get(tok) or f"rtsp://{dev.stream_host or a}:554/Streaming/Channels/1{idx + 1:02d}?transportmode=unicast"
            uri = uri.replace("&", "&amp;")
            if service == "media2":
                return _soap(200, f"<tr2:GetStreamUriResponse><tr2:Uri>{uri}</tr2:Uri></tr2:GetStreamUriResponse>")
            return _soap(200, f"<trt:GetStreamUriResponse><trt:MediaUri><tt:Uri>{uri}</tt:Uri><tt:InvalidAfterConnect>false</tt:InvalidAfterConnect>"
                              f"<tt:InvalidAfterReboot>false</tt:InvalidAfterReboot><tt:Timeout>PT0S</tt:Timeout></trt:MediaUri></trt:GetStreamUriResponse>")
        snap = f"http://{a}/onvif-http/snapshot?Profile_{idx + 1}"
        if service == "media2":
            return _soap(200, f"<tr2:GetSnapshotUriResponse><tr2:Uri>{snap}</tr2:Uri></tr2:GetSnapshotUriResponse>")
        return _soap(200, f"<trt:GetSnapshotUriResponse><trt:MediaUri><tt:Uri>{snap}</tt:Uri></trt:MediaUri></trt:GetSnapshotUriResponse>")

    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self.http)


def _http_digest_ok(authz: str, dev: FakeOnvifDevice, path: str) -> str:
    """ok | stale | bad - the camera's check of an `Authorization: Digest` header (RFC 7616, qop=auth)."""
    params = {k.lower(): (q if q else b) for k, q, b in re.findall(r'(\w+)=(?:"([^"]*)"|([^\s,]+))', authz[len("Digest "):])}
    nonce = params.get("nonce", "")
    if params.get("username") != dev.username or params.get("realm") != REALM or nonce not in dev.nonces or params.get("uri") != path:
        return "bad"
    fn = hashlib.sha256 if dev.digest_algorithm == "SHA-256" else hashlib.md5

    def h(s: str) -> str:
        return fn(s.encode()).hexdigest()

    ha1 = h(f"{dev.username}:{REALM}:{dev.password}")
    ha2 = h(f"POST:{path}")
    want = h(f"{ha1}:{nonce}:{params.get('nc')}:{params.get('cnonce')}:auth:{ha2}")
    if params.get("qop") != "auth" or params.get("response") != want or params.get("opaque") != "op-77":
        return "bad"
    dev.nonces[nonce] += 1
    if dev.stale_after is not None and dev.nonces[nonce] > dev.stale_after:
        return "stale"
    return "ok"


def _digest_ok(body: str, dev: FakeOnvifDevice, device_now: dt.datetime) -> bool:
    user = re.search(r"<wsse:Username>([^<]*)</wsse:Username>", body)
    pw = re.search(r"#PasswordDigest\">([^<]*)</wsse:Password>", body)
    nonce = re.search(r"<wsse:Nonce[^>]*>([^<]*)</wsse:Nonce>", body)
    created = re.search(r"<wsu:Created>([^<]*)</wsu:Created>", body)
    if not (user and pw and nonce and created) or user.group(1) != dev.username:
        return False
    expect = base64.b64encode(hashlib.sha1(base64.b64decode(nonce.group(1)) + created.group(1).encode() + dev.password.encode()).digest()).decode()
    if pw.group(1) != expect:
        return False
    at = dt.datetime.strptime(created.group(1), "%Y-%m-%dT%H:%M:%S.000Z").replace(tzinfo=dt.timezone.utc)
    return abs((at - device_now).total_seconds()) <= CLOCK_SKEW_S


def _soap(status: int, inner: str) -> httpx.Response:
    return httpx.Response(status, content=(f'<?xml version="1.0" encoding="UTF-8"?><env:Envelope xmlns:env="{NS_ENV}" '
                                           f'xmlns:tds="http://www.onvif.org/ver10/device/wsdl" xmlns:tt="http://www.onvif.org/ver10/schema" '
                                           f'xmlns:trt="{NS_MEDIA}" xmlns:tr2="{NS_MEDIA2}">'
                                           f"<env:Body>{inner}</env:Body></env:Envelope>").encode("utf-8"),
                          headers={"Content-Type": "application/soap+xml; charset=utf-8"})


FAULT_TEXT = {"ter:NotAuthorized": "Sender not Authorized", "ter:ActionNotSupported": "Optional Action Not Implemented",
              "ter:NoProfile": "The requested profile token does not exist"}


def _fault(status: int, subcode: str) -> httpx.Response:
    return _soap(status, f'<env:Fault><env:Code><env:Value>env:Sender</env:Value><env:Subcode><env:Value xmlns:ter="http://www.onvif.org/ver10/error">'
                         f"{subcode}</env:Value></env:Subcode></env:Code><env:Reason><env:Text xml:lang=\"en\">{FAULT_TEXT[subcode]}</env:Text>"
                         f"</env:Reason></env:Fault>")
