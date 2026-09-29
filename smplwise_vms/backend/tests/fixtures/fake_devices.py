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
import threading
from typing import Any
from zoneinfo import ZoneInfo

import httpx

NVR_HOST = "fake-nvr.test"
GO2RTC_HOST = "fake-go2rtc.test"
HA_HOST = "fake-ha.test"
NS = 'xmlns="http://www.hikvision.com/ver20/XMLSchema"'
UTC = dt.timezone.utc


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
        if request.method != "GET":
            self.writes.append(f"nvr {request.method} {request.url.path}")
            return httpx.Response(403, text=_xml(f"<ResponseStatus {NS}><statusString>Forbidden</statusString><subStatusCode>notSupport</subStatusCode></ResponseStatus>"), request=request)
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
        if path == "/ISAPI/System/time":
            if n["time_error"]:
                return httpx.Response(500, text="error", request=request)
            return self._ok(request, f"<Time version=\"2.0\" {NS}><timeMode>NTP</timeMode><localTime>{self._nvr_time()}</localTime><timeZone>CST-2:00:00DST01:00:00,M3.5.5/02:00:00,M10.5.0/02:00:00</timeZone></Time>")
        if path == "/ISAPI/System/time/ntpServers/1":
            return self._ok(request, f"<NTPServer version=\"2.0\" {NS}><id>1</id><addressingFormatType>hostname</addressingFormatType><hostName>pool.ntp.org</hostName><portNo>123</portNo><synchronizeInterval>1440</synchronizeInterval></NTPServer>")
        return httpx.Response(404, text=_xml(f"<ResponseStatus {NS}><statusString>Invalid Operation</statusString><subStatusCode>notSupport</subStatusCode></ResponseStatus>"), request=request)

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
