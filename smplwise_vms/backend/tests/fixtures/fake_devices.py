"""Fake NVR, go2rtc and Home Assistant REST for the setup wizard (T071): the backend's real device code (nvr.device_info,
nvr.discover_channels, nvr_system.time_status, Go2rtc.info / list_streams, ha_client.get_config) runs unchanged; only
the HTTP answer comes from here. Hosts are reserved `.test` names that never resolve, and the hook is installed on
httpx's transport, so a request to any other host goes out as before (Starlette's TestClient has its own transport and
is not affected).

Used by tests/test_setup_wizard.py and by the Playwright fixture backend frontend/tests/fixtures/setup_fake_devices.py.

Every knob is a plain attribute (`fake.nvr["up"] = False`, `fake.nvr["drift_s"] = 45`, `fake.nvr["offset"] = "+02:00"`,
`fake.go2rtc["streams"]`, `fake.ha["drift_s"]` ...); `reset()` restores the defaults below. `writes` lists every
non-GET request a fake device received - the wizard must never add one (the fixture backend's own stream sync does:
it creates `smplwise_` streams in the fake go2rtc at start-up, as the real add-on would)."""
from __future__ import annotations

import datetime as dt
import email.utils
import json
import re
import threading
import time
from typing import Any
from zoneinfo import ZoneInfo

import httpx

NVR_HOST = "fake-nvr.test"
GO2RTC_HOST = "fake-go2rtc.test"
HA_HOST = "fake-ha.test"
NS = 'xmlns="http://www.hikvision.com/ver20/XMLSchema"'
UTC = dt.timezone.utc
_STREAM_PUT = re.compile(r"^(/ISAPI/Streaming/channels|/ISAPI/ContentMgmt/StreamingProxy/channels)/(\d{3,6})$")
_STREAM_SUB = re.compile(r"^(/ISAPI/Streaming/channels|/ISAPI/ContentMgmt/StreamingProxy/channels)/(\d{3,6})(?:/(capabilities|dynamicCap))?$")


def _xml(body: str) -> str:
    return f'<?xml version="1.0" encoding="UTF-8" ?>{body}'


class FakeDevices:
    def __init__(self, zone: str = "Asia/Jerusalem") -> None:
        self.lock = threading.Lock()
        self.zone = ZoneInfo(zone)
        self.reset()

    def reset(self) -> None:
        with self.lock:
            self.nvr: dict[str, Any] = {
                "up": True, "auth": True, "model": "DS-7616NI-FAKE", "firmware": "V4.84.000 fake", "channels": 4, "offline": [],
                "no_tracks": [], "drift_s": 0, "offset": None, "naive": False, "time_error": False,
                # the NTP server by address (192.0.2.x, RFC 5737 documentation range) and an odd port value; delay_s holds
                # every answer that long (outside the lock), for the deadline and parallel-request tests
                "ntp_address": None, "ntp_port": "123", "delay_s": 0.0,
                # CR-008 D7: GET /ISAPI/Streaming/channels (N01 main, N02 sub) in the lab document's shape
                # (private-evidence/nvr-probes: <Video> with videoCodecType, SVC, SmartCodec). `streaming` False answers
                # notSupport; `encodings` is every channel's default, `encodings_by_channel` {channel: {"main": {...}}}
                # overrides one. Keys: codec, profile (H264Profile / H265Profile), svc, bframes (a synthetic <BFrame>
                # element - the lab firmware has none), width, height.
                "streaming": True,
                # CR-020 S1: more keys of an `encodings` entry - bitrate_mode (CBR | VBR), bitrate_kbps, quality, fps (e.g. 25),
                # gop; `streaming_xml` replaces the whole streaming list answer (oversized / hostile / odd-shaped documents)
                "streaming_xml": None,
                "encodings": {"main": {"codec": "H.265", "svc": False, "width": 2560, "height": 1440},
                              "sub": {"codec": "H.264", "svc": None, "width": 640, "height": 360}},
                "encodings_by_channel": {},
                # CR-020 S2: the guarded stream write. PUT /ISAPI/Streaming/channels/{sid} (or the StreamingProxy path when
                # `write_path` is "proxy"; the other path answers 403 notSupport) parses the received <Video> into
                # `encodings_by_channel`, so the next LIST shows it; every body is kept in `put_bodies`. `put` picks the
                # answer: status ok (statusCode 1) | reboot (7, applied) | busy (2) | invalid (6) | forbidden (403) |
                # notsupport (403 notSupport) | timeout (httpx.ReadTimeout, applied or not per `timeout_applies`) |
                # server_error (500 without a ResponseStatus, applied); keeps_old answers OK and applies nothing;
                # put_fail_at: n makes the nth PUT busy. put_hold_s holds a PUT outside the lock (parallel requests run);
                # on_put(request) runs when a PUT arrives (exceptions kept in on_put_error). on_list_read(fake, n) runs
                # inside the lock on the nth LIST read (a test changes the stream between reads).
                # Capability documents: caps (the opt / min / max values), caps_status {"direct": 200, "proxy": 404},
                # caps_status_by_stream {"101": {...}}, dynamic_cap None (404) or {codec: ["WxH", ...]}.
                # The single-stream GET omits <SVC> like the lab firmware unless single_get_has_svc.
                "write_path": "direct", "put": {"status": "ok"}, "put_hold_s": 0.0, "on_put": None, "on_put_error": None, "put_fail_at": None,
                "timeout_applies": False, "on_list_read": None, "list_reads": 0, "put_count": 0, "put_bodies": [], "single_get_has_svc": False,
                "caps": {"codec": ["H.264", "H.265"], "widths": [2560, 1920, 1280], "heights": [1440, 1080, 720], "fps": [2500, 2000, 1500, 1000, 500, 0],
                         "modes": ["CBR", "VBR"], "kbps": (32, 16384), "quality": [10, 30, 45, 60, 75, 90], "gop": (1, 400),
                         "h264_profiles": ["Baseline", "Main", "High"], "h265_profiles": ["Main"], "svc": True, "smart": True},
                "caps_status": {"direct": 200, "proxy": 404}, "caps_status_by_stream": {}, "dynamic_cap": None,
                # CR-020 S2C: put_unknown_at: n makes the nth PUT a timeout (applied or not per `timeout_applies`) - an unknown outcome
                "put_unknown_at": None,
            }
            self.go2rtc: dict[str, Any] = {"up": True, "auth": True, "version": "1.9.9-fake", "streams": {}, "foreign": ["intercom_door_1", "intercom_door_2"]}
            self.ha: dict[str, Any] = {"up": True, "status": 200, "version": "2026.9.3", "time_zone": "Asia/Jerusalem", "drift_s": 0}
            self.hits: list[str] = []
            self.writes: list[str] = []

    # ------------------------------------------------------------ NVR (ISAPI)

    def _nvr_time(self) -> str:
        now = dt.datetime.now(UTC) + dt.timedelta(seconds=self.nvr["drift_s"])
        if self.nvr["offset"]:
            sign = 1 if self.nvr["offset"][0] == "+" else -1
            hh, mm = self.nvr["offset"][1:].split(":")
            tz: dt.tzinfo = dt.timezone(sign * dt.timedelta(hours=int(hh), minutes=int(mm)))
        else:
            tz = self.zone
        local = now.astimezone(tz).replace(microsecond=0)
        return local.replace(tzinfo=None).isoformat() if self.nvr["naive"] else local.isoformat()

    def _nvr(self, request: httpx.Request) -> httpx.Response:
        n = self.nvr
        if not n["up"]:
            raise httpx.ConnectError("fake NVR is down", request=request)
        if request.method == "POST" and request.url.path == "/ISAPI/ContentMgmt/search":  # a read by POST (recording search)
            return self._ok(request, f"<CMSearchResult {NS}><responseStatus>true</responseStatus><responseStatusStrg>NO MATCHES</responseStatusStrg><numOfMatches>0</numOfMatches></CMSearchResult>")
        if request.method == "PUT" and _STREAM_PUT.match(request.url.path):
            return self._stream_put(request)
        if request.method != "GET":
            self.writes.append(f"nvr {request.method} {request.url.path}")
            return httpx.Response(403, text=_xml(f"<ResponseStatus {NS}><statusString>Forbidden</statusString><subStatusCode>notSupport</subStatusCode></ResponseStatus>"), request=request)
        caps = _STREAM_SUB.match(request.url.path)
        if caps and n["auth"]:
            return self._stream_sub(request, caps.group(1), int(caps.group(2)), caps.group(3))
        if not n["auth"]:
            return httpx.Response(401, text="Unauthorized", request=request)
        path = request.url.path
        chans = range(1, n["channels"] + 1)
        if path == "/ISAPI/System/deviceInfo":
            return self._ok(request, f"<DeviceInfo version=\"2.0\" {NS}><deviceName>fake</deviceName><model>{n['model']}</model><firmwareVersion>{n['firmware']}</firmwareVersion><deviceType>NVR</deviceType></DeviceInfo>")
        if path == "/ISAPI/ContentMgmt/InputProxy/channels":
            return self._ok(request, f"<InputProxyChannelList {NS}>" + "".join(f"<InputProxyChannel><id>{c}</id><name>מצלמה {c}</name></InputProxyChannel>" for c in chans) + "</InputProxyChannelList>")
        if path == "/ISAPI/ContentMgmt/InputProxy/channels/status":
            return self._ok(request, f"<InputProxyChannelStatusList {NS}>" + "".join(
                f"<InputProxyChannelStatus><id>{c}</id><online>{'false' if c in n['offline'] else 'true'}</online></InputProxyChannelStatus>" for c in chans) + "</InputProxyChannelStatusList>")
        if path == "/ISAPI/ContentMgmt/record/tracks":
            desc = "trackType=standard,contentType=video,codecType=H.265,resolution=2560x1440,framerate=25.0 fps,bitrate=4096 kbps"
            return self._ok(request, f"<TrackList {NS}>" + "".join(
                f"<Track><id>{c}01</id><Channel>{c}01</Channel><Description>{desc}</Description><SrcDescriptor><SrcChannel>{c}</SrcChannel></SrcDescriptor></Track>"
                f"<Track><id>{c}02</id><Channel>{c}02</Channel><SrcDescriptor><SrcChannel>{c}</SrcChannel></SrcDescriptor></Track>"
                for c in chans if c not in n["no_tracks"]) + "</TrackList>")
        if path == "/ISAPI/Streaming/channels" and n["streaming"]:
            n["list_reads"] += 1
            if n["on_list_read"] is not None:
                n["on_list_read"](self, n["list_reads"])
        if path == "/ISAPI/Streaming/channels" and n["streaming"] and n["streaming_xml"] is not None:
            return self._ok(request, n["streaming_xml"])
        if path == "/ISAPI/Streaming/channels" and n["streaming"]:
            return self._ok(request, f"<StreamingChannelList version=\"1.0\" {NS}>" + "".join(
                self._streaming_channel(c, kind) for c in chans for kind in ("main", "sub")) + "</StreamingChannelList>")
        if path == "/ISAPI/System/time":
            if n["time_error"]:
                return httpx.Response(500, text="error", request=request)
            return self._ok(request, f"<Time version=\"2.0\" {NS}><timeMode>NTP</timeMode><localTime>{self._nvr_time()}</localTime><timeZone>CST-2:00:00DST01:00:00,M3.5.5/02:00:00,M10.5.0/02:00:00</timeZone></Time>")
        if path == "/ISAPI/System/time/ntpServers/1":
            where = (f"<addressingFormatType>ipaddress</addressingFormatType><ipAddress>{n['ntp_address']}</ipAddress>" if n["ntp_address"]
                     else "<addressingFormatType>hostname</addressingFormatType><hostName>pool.ntp.org</hostName>")
            return self._ok(request, f"<NTPServer version=\"2.0\" {NS}><id>1</id>{where}<portNo>{n['ntp_port']}</portNo><synchronizeInterval>1440</synchronizeInterval></NTPServer>")
        return httpx.Response(404, text=_xml(f"<ResponseStatus {NS}><statusString>Invalid Operation</statusString><subStatusCode>notSupport</subStatusCode></ResponseStatus>"), request=request)

    def _encoding(self, channel: int, kind: str) -> dict[str, Any]:
        return {**self.nvr["encodings"][kind], **(self.nvr["encodings_by_channel"].get(channel) or self.nvr["encodings_by_channel"].get(str(channel)) or {}).get(kind, {})}

    # ------------------------------------------------------------ CR-020 S2: one stream (capabilities, single GET, PUT)

    def _stream_exists(self, sid: int) -> bool:
        channel, kind = divmod(sid, 100)
        return 1 <= channel <= self.nvr["channels"] and kind in (1, 2)

    def _caps_status(self, sid: int, which: str) -> int:
        by = self.nvr["caps_status_by_stream"].get(str(sid)) or {}
        return int(by.get(which, self.nvr["caps_status"].get(which, 404)))

    def _caps_xml(self) -> str:
        c = self.nvr["caps"]
        lo, hi = c["kbps"]
        glo, ghi = c["gop"]
        svc = '<SVC><enabled opt="true,false">true</enabled><SVCMode opt="manual,auto">manual</SVCMode></SVC>' if c.get("svc") else ""
        smart = '<SmartCodec><enabled opt="true,false">false</enabled></SmartCodec>' if c.get("smart") else ""
        return (f'<StreamingChannel version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema"><id>101</id><Video>'
                f'<videoCodecType opt="{",".join(c["codec"])}">H.264</videoCodecType>'
                f'<videoResolutionWidth opt="{",".join(map(str, c["widths"]))}">1920</videoResolutionWidth>'
                f'<videoResolutionHeight opt="{",".join(map(str, c["heights"]))}">1080</videoResolutionHeight>'
                f'<videoQualityControlType opt="{",".join(c["modes"])}">VBR</videoQualityControlType>'
                f'<constantBitRate min="{lo}" max="{hi}">2048</constantBitRate><vbrUpperCap min="{lo}" max="{hi}">2048</vbrUpperCap>'
                f'<fixedQuality opt="{",".join(map(str, c["quality"]))}">60</fixedQuality>'
                f'<maxFrameRate opt="{",".join(map(str, c["fps"]))}">2500</maxFrameRate>'
                f'<GovLength min="{glo}" max="{ghi}">50</GovLength>'
                f'<H264Profile opt="{",".join(c["h264_profiles"])}">Main</H264Profile><H265Profile opt="{",".join(c["h265_profiles"])}">Main</H265Profile>'
                f'{svc}{smart}</Video></StreamingChannel>')

    def _stream_sub(self, request: httpx.Request, prefix: str, sid: int, sub: str | None) -> httpx.Response:
        not_found = httpx.Response(404, text=_xml(f"<ResponseStatus {NS}><statusCode>4</statusCode><statusString>Invalid Operation</statusString><subStatusCode>notSupport</subStatusCode></ResponseStatus>"), request=request)
        if not self._stream_exists(sid):
            return not_found
        which = "proxy" if "StreamingProxy" in prefix else "direct"
        if sub == "capabilities":
            status = self._caps_status(sid, which)
            if status != 200:
                return httpx.Response(status, text=_xml(f"<ResponseStatus {NS}><statusCode>4</statusCode><subStatusCode>notSupport</subStatusCode></ResponseStatus>"), request=request)
            return self._ok(request, self._caps_xml())
        if sub == "dynamicCap":
            dyn = self.nvr["dynamic_cap"]
            codec = request.url.params.get("videoCodecType") or "H.264"
            if dyn is None or which != "direct":
                return not_found
            return self._ok(request, "<DynamicCap><ResolutionAvailableDscriptorList>" + "".join(
                f"<ResolutionAvailableDscriptor><resolution>{r.replace('x', '*')}</resolution></ResolutionAvailableDscriptor>" for r in dyn.get(codec, [])) + "</ResolutionAvailableDscriptorList></DynamicCap>")
        if sub is None and which == "direct":  # the single-stream GET: like the lab firmware, without <SVC>
            channel, kind = divmod(sid, 100)
            el = self._streaming_channel(channel, "main" if kind == 1 else "sub")
            if not self.nvr["single_get_has_svc"]:
                el = re.sub(r"<SVC>.*?</SVC>", "", el)
            return self._ok(request, el)
        return not_found

    def _stream_put(self, request: httpx.Request) -> httpx.Response:
        n = self.nvr
        path = request.url.path
        self.writes.append(f"nvr PUT {path}")
        body = request.content.decode("utf-8", "replace")
        n["put_bodies"].append(body)
        n["put_count"] += 1
        m = _STREAM_PUT.match(path)
        assert m is not None
        sid = int(m.group(2))
        which = "proxy" if "StreamingProxy" in m.group(1) else "direct"
        status_doc = lambda code, sub, http=200: httpx.Response(http, text=_xml(  # noqa: E731
            f"<ResponseStatus {NS}><requestURL>{path}</requestURL><statusCode>{code}</statusCode><statusString>s</statusString><subStatusCode>{sub}</subStatusCode></ResponseStatus>"), request=request)
        if which != n["write_path"] or not self._stream_exists(sid):
            return status_doc(4, "notSupport", 403)
        mode = (n["put"] or {}).get("status", "ok")
        if n["put_fail_at"] is not None and n["put_count"] == n["put_fail_at"]:
            mode = "busy"
        if n.get("put_unknown_at") is not None and n["put_count"] == n["put_unknown_at"]:
            mode = "timeout"
        if mode == "busy":
            return status_doc(2, "deviceBusy", 503)
        if mode == "invalid":
            return status_doc(6, "badXmlContent", 400)
        if mode == "forbidden":
            return status_doc(4, "unAuthorized", 403)
        if mode == "notsupport":
            return status_doc(4, "notSupport", 403)
        if mode == "timeout":
            if n["timeout_applies"]:
                self._apply_put(sid, body)
            raise httpx.ReadTimeout("fake NVR timed out", request=request)
        if not (n["put"] or {}).get("keeps_old"):
            self._apply_put(sid, body)
        if mode == "server_error":
            return httpx.Response(500, text="Internal Server Error", request=request)
        if mode == "reboot":
            return status_doc(7, "rebootRequired")
        return status_doc(1, "ok")

    def _apply_put(self, sid: int, body: str) -> None:
        import xml.etree.ElementTree as ET

        channel, k = divmod(sid, 100)
        kind = "main" if k == 1 else "sub"
        root = ET.fromstring(body.encode("utf-8"))
        video = next(el for el in root.iter() if el.tag.endswith("Video"))

        def text(name: str) -> str | None:
            el = next((c for c in video if c.tag.split("}")[-1] == name), None)
            return (el.text or "").strip() if el is not None else None

        def flag(name: str) -> bool | None:
            el = next((c for c in video if c.tag.split("}")[-1] == name), None)
            en = next((c for c in el if c.tag.split("}")[-1] == "enabled"), None) if el is not None else None
            return None if en is None else (en.text or "").strip() == "true"

        e = self._encoding(channel, kind)
        mode = text("videoQualityControlType") or e.get("bitrate_mode", "VBR")
        new = {
            "codec": text("videoCodecType"), "width": int(text("videoResolutionWidth") or e.get("width", 1920)), "height": int(text("videoResolutionHeight") or e.get("height", 1080)),
            "bitrate_mode": mode, "fps": int(text("maxFrameRate") or 2500) / 100, "gop": int(text("GovLength") or e.get("gop", 50)),
            "profile": text("H264Profile") or text("H265Profile") or e.get("profile"), "svc": flag("SVC") if flag("SVC") is not None else e.get("svc"),
            "smart": flag("SmartCodec"),
        }
        kbps = text("constantBitRate") if mode == "CBR" else text("vbrUpperCap")
        if kbps:
            new["bitrate_kbps"] = int(kbps)
        if text("fixedQuality"):
            new["quality"] = int(text("fixedQuality") or 0)
        by = self.nvr["encodings_by_channel"]
        key: Any = channel if channel in by or str(channel) not in by else str(channel)
        by.setdefault(key, {})[kind] = {**(by.get(key) or {}).get(kind, {}), **{k2: v for k2, v in new.items() if v is not None}}

    def _streaming_channel(self, channel: int, kind: str) -> str:
        e = self._encoding(channel, kind)
        codec = e.get("codec") or "H.264"
        profile = f"<{'H265Profile' if '265' in codec else 'H264Profile'}>{e['profile']}</{'H265Profile' if '265' in codec else 'H264Profile'}>" if e.get("profile") else ""
        svc = f"<SVC><enabled>{'true' if e['svc'] else 'false'}</enabled><SVCMode>manual</SVCMode></SVC>" if e.get("svc") is not None else ""
        bframes = f"<BFrame><enabled>{'true' if e['bframes'] else 'false'}</enabled></BFrame>" if e.get("bframes") is not None else ""
        sid = f"{channel}0{1 if kind == 'main' else 2}"
        mode = e.get("bitrate_mode", "VBR")
        kbps = e.get("bitrate_kbps")
        rate = ""
        if mode == "CBR" and kbps is not None:
            rate = f"<constantBitRate>{kbps}</constantBitRate>"
        elif kbps is not None:
            rate = f"<vbrUpperCap>{kbps}</vbrUpperCap>"
        if e.get("quality") is not None:
            rate += f"<fixedQuality>{e['quality']}</fixedQuality>"
        return (f'<StreamingChannel version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema"><id>{sid}</id><channelName>{sid}</channelName><enabled>true</enabled>'
                "<Transport><ControlProtocolList><ControlProtocol><streamingTransport>RTSP</streamingTransport></ControlProtocol></ControlProtocolList></Transport>"
                f"<Video><enabled>true</enabled><dynVideoInputChannelID>{channel}</dynVideoInputChannelID><videoCodecType>{codec}</videoCodecType>"
                f"<videoResolutionWidth>{e.get('width', 1920)}</videoResolutionWidth><videoResolutionHeight>{e.get('height', 1080)}</videoResolutionHeight>"
                f"<videoQualityControlType>{mode}</videoQualityControlType>{rate}<maxFrameRate>{int(float(e.get('fps', 25)) * 100)}</maxFrameRate><GovLength>{e.get('gop', 50)}</GovLength>{profile}{svc}{bframes}"
                f"<snapShotImageType>JPEG</snapShotImageType><SmartCodec><enabled>{'true' if e.get('smart') else 'false'}</enabled></SmartCodec></Video></StreamingChannel>")

    @staticmethod
    def _ok(request: httpx.Request, body: str) -> httpx.Response:
        return httpx.Response(200, text=_xml(body), headers={"Content-Type": "application/xml"}, request=request)

    # ------------------------------------------------------------ go2rtc

    def _go2rtc(self, request: httpx.Request) -> httpx.Response:
        g = self.go2rtc
        if not g["up"]:
            raise httpx.ConnectError("fake go2rtc is down", request=request)
        if not g["auth"]:
            return httpx.Response(401, text="Unauthorized", request=request)
        path = request.url.path
        if path == "/api" and request.method == "GET":
            return httpx.Response(200, json={"version": g["version"], "config_path": "/config/go2rtc.yaml"}, request=request)
        if path == "/api/streams":
            if request.method == "GET":
                body = {name: {"producers": [{"url": "rtsp://***@fake/stream", **({"medias": ["video"]} if online else {})}]} for name, online in g["streams"].items()}
                body.update({name: {"producers": [{"url": "rtsp://***@door/stream"}]} for name in g["foreign"]})
                return httpx.Response(200, json=body, request=request)
            self.writes.append(f"go2rtc {request.method} {request.url.params.get('name') or request.url.params.get('src')}")
            if request.method == "PUT":
                g["streams"][request.url.params.get("name", "")] = True
                return httpx.Response(200, request=request)
            if request.method == "DELETE":
                g["streams"].pop(request.url.params.get("src", ""), None)
                return httpx.Response(200, request=request)
        return httpx.Response(404, text="not found", request=request)

    # ------------------------------------------------------------ Home Assistant REST

    def _ha(self, request: httpx.Request) -> httpx.Response:
        h = self.ha
        if not h["up"]:
            raise httpx.ConnectError("fake Home Assistant is down", request=request)
        if request.method != "GET":
            self.writes.append(f"ha {request.method} {request.url.path}")
            return httpx.Response(405, request=request)
        if request.url.path == "/api/config":
            if h["status"] != 200:
                return httpx.Response(h["status"], text="error", request=request)
            date = email.utils.format_datetime(dt.datetime.now(UTC) + dt.timedelta(seconds=h["drift_s"]), usegmt=True)
            return httpx.Response(200, content=json.dumps({"version": h["version"], "time_zone": h["time_zone"], "location_name": "fake"}).encode(),
                                  headers={"Content-Type": "application/json", "Date": date}, request=request)
        return httpx.Response(404, json={"message": "not found"}, request=request)

    # ------------------------------------------------------------ dispatch

    def handle(self, request: httpx.Request) -> httpx.Response | None:
        host = request.url.host
        if host not in (NVR_HOST, GO2RTC_HOST, HA_HOST):
            return None
        with self.lock:
            delay = float(self.nvr["delay_s"]) if host == NVR_HOST else 0.0
            stream_put = host == NVR_HOST and request.method == "PUT" and _STREAM_PUT.match(request.url.path) is not None
            hold = float(self.nvr["put_hold_s"]) if stream_put else 0.0
            on_put = self.nvr["on_put"] if stream_put else None
        if delay:
            time.sleep(delay)
        if on_put is not None:  # outside the lock: the observer may read the fake or the database
            try:
                on_put(request)
            except Exception as exc:  # noqa: BLE001 - kept for the test to re-raise
                with self.lock:
                    self.nvr["on_put_error"] = exc
        if hold:
            time.sleep(hold)
        with self.lock:
            self.hits.append(f"{host} {request.method} {request.url.path}")
            if host == NVR_HOST:
                return self._nvr(request)
            if host == GO2RTC_HOST:
                return self._go2rtc(request)
            return self._ha(request)

    def install(self, monkeypatch: Any | None = None) -> None:
        """Answer the fake hosts from this object; with pytest's monkeypatch the hook is undone after the test."""
        real = httpx.HTTPTransport.handle_request
        fake = self

        def handle_request(transport: httpx.HTTPTransport, request: httpx.Request) -> httpx.Response:
            answer = fake.handle(request)
            return answer if answer is not None else real(transport, request)

        if monkeypatch is not None:
            monkeypatch.setattr(httpx.HTTPTransport, "handle_request", handle_request)
        else:
            httpx.HTTPTransport.handle_request = handle_request  # type: ignore[method-assign]
