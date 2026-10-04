"""A fake Provision-ISR device (HTTP API v1) for the P1 adapter tests (CR-025). No network: used through
`httpx.MockTransport(fake.handle)`.

Every answer has the shape of the vendor's v1 guide (Version 1.9, 2025-08) and of the example responses in the v1 Postman
collection (26.6), rebuilt by hand with invented values: no serial number, MAC, address, UUID or password of a real unit.
Quirks kept on purpose: the `GetChannelList` items sit NEXT TO an empty `<channelIDList/>` (guide example), values are
CDATA with surrounding whitespace (Postman), the snapshot is `application/octet-stream` (Postman), failures are HTTP 400
with `<config status="failed" errorCode="n"/>`, `GetPortConfig` carries `longPollingPort` (Postman, not the guide).

Knobs (plain attributes; `reset()` restores them): `kind` ("nvr" | "ipc"), `auth` ("basic" | "digest"), `channels`
({ch: status}), `names` ({ch: OSD name}), `alarms` ({(kind, id): bool}), `codec` per channel, `down` (connection error),
`fail` ({command: errorCode}), `pull_queue` (messages GetPullMessages hands out). `hits` lists every request
("POST /GetDeviceInfo"), `writes` every command that is not a read or a subscription command - P1 must leave it empty."""
from __future__ import annotations

import base64
import threading
from typing import Any

import httpx

HOST = "provision-nvr.test"
USER = "arx-test"
PASSWORD = "fake-pass-1"
NS = 'xmlns="http://www.ipc.com/ver10"'
JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00fake-provision-jpeg\xff\xd9"
READS = {"GetDeviceInfo", "GetChannelList", "GetDiskInfo", "GetRecordStatusInfo", "GetPortConfig", "GetDateAndTime",
         "GetStreamCaps", "GetVideoStreamConfig", "GetImageOsdConfig", "GetSnapshot", "GetAlarmStatus"}
SESSION = {"SetSubscribe", "SetRenew", "SetUnSubscribe", "GetPullMessages"}


def _doc(body: str, version: str = "1.7") -> str:
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<config version="{version}" {NS}>\n{body}\n</config>'


class FakeProvision:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.reset()

    def reset(self) -> None:
        self.kind = "nvr"
        self.auth = "basic"
        self.channels: dict[int, str] = {1: "online", 2: "online", 3: "offline", 4: "videoLoss"}
        self.names: dict[int, str] = {1: "Entrance", 2: "Parking"}
        self.alarms: dict[tuple[str, int | None], bool] = {}
        self.codec: dict[int, str] = {}
        self.down = False
        self.fail: dict[str, int] = {}
        self.pull_queue: list[dict[tuple[str, int | None], bool]] = []
        self.hits: list[str] = []
        self.writes: list[str] = []
        self.subscriptions = 0

    # ------------------------------------------------------------------ auth
    def _authorized(self, request: httpx.Request) -> bool:
        header = request.headers.get("authorization", "")
        if self.auth == "basic":
            return header == "Basic " + base64.b64encode(f"{USER}:{PASSWORD}".encode()).decode()
        return header.startswith("Digest ") and f'username="{USER}"' in header

    def _challenge(self, request: httpx.Request) -> httpx.Response:
        value = 'Basic realm="fake"' if self.auth == "basic" else 'Digest realm="fake", nonce="abc123", qop="auth", algorithm=MD5'
        return httpx.Response(401, headers={"WWW-Authenticate": value}, request=request)

    # ------------------------------------------------------------------ dispatch
    def handle(self, request: httpx.Request) -> httpx.Response:
        if request.url.host != HOST:
            raise httpx.ConnectError("unknown fake host", request=request)
        with self.lock:
            if self.down:
                raise httpx.ConnectError("fake device down", request=request)
            parts = [p for p in request.url.path.split("/") if p]
            cmd = parts[0] if parts else ""
            ch = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 1
            self.hits.append(f"{request.method} {request.url.path}")
            if cmd not in READS and cmd not in SESSION:
                self.writes.append(cmd)
            if not self._authorized(request):
                return self._challenge(request)
            if cmd in self.fail:
                return self._xml(request, f'<?xml version="1.0" encoding="utf-8"?><config status="failed" errorCode="{self.fail[cmd]}"/>', 400)
            handler = getattr(self, f"_{cmd}", None)
            if handler is None:
                return self._xml(request, '<?xml version="1.0" encoding="utf-8"?><config status="failed" errorCode="1"/>', 400)
            return handler(request, ch)

    @staticmethod
    def _xml(request: httpx.Request, text: str, status: int = 200) -> httpx.Response:
        return httpx.Response(status, content=text.encode("utf-8"), headers={"Content-Type": "application/xml; charset=utf-8", "Connection": "close"}, request=request)

    # ------------------------------------------------------------------ commands (shapes from the guide / Postman)
    def _GetDeviceInfo(self, request: httpx.Request, ch: int) -> httpx.Response:
        nvr = self.kind == "nvr"
        return self._xml(request, _doc(f"""<deviceInfo>
    <deviceName type="string"><![CDATA[Fake {'NVR' if nvr else 'IPC'}]]></deviceName>
    <model type="string">
        <![CDATA[{'NVR5-8200PX' if nvr else 'I6-340IPE-MVF'}]]>
    </model>
    <brand type="string"><![CDATA[Provision ISR]]></brand>
    <deviceDescription type="string"><![CDATA[{'NVR' if nvr else 'IPCamera'}]]></deviceDescription>
    <softwareVersion type="string"><![CDATA[9.9.9.1(00001)]]></softwareVersion>
    <softwareBuildDate type="string"><![CDATA[2025-01-01]]></softwareBuildDate>
    <hardwareVersion type="string"><![CDATA[1.0]]></hardwareVersion>
    <mac type="string"><![CDATA[00:00:5E:00:53:01]]></mac>
    <sn type="string"><![CDATA[FAKESERIAL0001]]></sn>
    <supportAPILongPolling type="boolean">{'false' if nvr else 'true'}</supportAPILongPolling>
    <supportHttps type="boolean">true</supportHttps>
    <SupportHttpPost type="boolean">true</SupportHttpPost>
    <integratedPtz type="boolean">false</integratedPtz>
    <chlMaxCount type="uint32">{8 if nvr else 1}</chlMaxCount>
    <apiVersion type="string"><![CDATA[1.7]]></apiVersion>
</deviceInfo>"""))

    def _GetChannelList(self, request: httpx.Request, ch: int) -> httpx.Response:
        if self.kind != "nvr":
            return self._xml(request, '<?xml version="1.0" encoding="utf-8"?><config status="failed" errorCode="1"/>', 400)
        items = "\n".join(f'<item channelStatus="{st}">{c}</item>' for c, st in self.channels.items())
        return self._xml(request, _doc(f"""<types><channelStatus><enum>online</enum><enum>offline</enum><enum>videoOn</enum><enum>videoLoss</enum></channelStatus></types>
<channelIDList type="list" count="{len(self.channels)}"/>
<itemType type="string" maxLen="20"/>
{items}""", "1.0"))

    def _GetImageOsdConfig(self, request: httpx.Request, ch: int) -> httpx.Response:
        if self.kind == "nvr" and self.channels.get(ch) in (None, "offline"):
            return self._xml(request, '<?xml version="1.0" encoding="utf-8"?><config status="failed" errorCode="3"/>', 400)
        name = self.names.get(ch)
        name_el = f'<name type="string" maxLen="19"><![CDATA[{name}]]></name>' if name else ""
        return self._xml(request, _doc(f"""<imageOsd>
<time><switch type="boolean">true</switch><X type="uint32">0</X><Y type="uint32">0</Y><dateFormat type="dateFormat">year-month-day</dateFormat></time>
<channelName><switch type="boolean">true</switch><X type="uint32">0</X><Y type="uint32">0</Y>{name_el}</channelName>
</imageOsd>""", "1.0"))

    def _GetVideoStreamConfig(self, request: httpx.Request, ch: int) -> httpx.Response:
        if self.kind == "nvr" and self.channels.get(ch) in (None, "offline"):
            return self._xml(request, '<?xml version="1.0" encoding="utf-8"?><config status="failed" errorCode="3"/>', 400)
        main = self.codec.get(ch, "h265")
        return self._xml(request, _doc(f"""<types>
<bitRateType><enum>VBR</enum><enum>CBR</enum></bitRateType>
<quality><enum>lowest</enum><enum>lower</enum><enum>medium</enum><enum>higher</enum><enum>highest</enum></quality>
<encodeType><enum>h264</enum><enum>h264plus</enum><enum>h265</enum><enum>h265plus</enum><enum>mjpeg</enum></encodeType>
<encodeLevel><enum>baseLine</enum><enum>mainProfile</enum><enum>highProfile</enum></encodeLevel>
</types>
<mutexList type="list" count="1"><item><object type="mutexObjectType">vfd</object><status type="boolean">false</status></item></mutexList>
<streams type="list" count="3">
    <item id="1">
        <name type="string" maxLen="32">
            <![CDATA[profile1]]>
        </name>
        <resolution>2592x1520</resolution>
        <frameRate type="uint32">25</frameRate>
        <bitRateType type="bitRateType">VBR</bitRateType>
        <maxBitRate type="uint32" min="64" max="8192">3072</maxBitRate>
        <bitRateLists><item>1536</item><item>2048</item><item>3072</item><item>5120</item><item>7168</item></bitRateLists>
        <encodeTypeCaps type="list"><itemType type="encodeType" /><item>h264</item><item>h265</item><item>h264plus</item><item>h265plus</item></encodeTypeCaps>
        <encodeType>{main}</encodeType>
        <encodeLevel>mainProfile</encodeLevel>
        <quality type="quality">higher</quality>
        <GOP type="uint32" min="25" max="1500">50</GOP>
    </item>
    <item id="2">
        <name type="string" maxLen="32"><![CDATA[profile2]]></name>
        <resolution>704x576</resolution>
        <frameRate type="uint32">6</frameRate>
        <bitRateType type="bitRateType">CBR</bitRateType>
        <maxBitRate type="uint32" min="64" max="8192">512</maxBitRate>
        <bitRateLists><item>128</item><item>256</item><item>512</item><item>768</item><item>1024</item></bitRateLists>
        <encodeTypeCaps type="list"><itemType type="encodeType" /><item>h264</item><item>h265</item><item>mjpeg</item></encodeTypeCaps>
        <encodeType>h264</encodeType>
        <encodeLevel>baseLine</encodeLevel>
        <quality type="quality">medium</quality>
        <GOP type="uint32" min="6" max="360">12</GOP>
    </item>
    <item id="3">
        <name type="string" maxLen="32"><![CDATA[profile3]]></name>
        <resolution>704x576</resolution>
        <frameRate type="uint32">25</frameRate>
        <bitRateType type="bitRateType">CBR</bitRateType>
        <maxBitRate type="uint32" min="64" max="8192">512</maxBitRate>
        <encodeType>mjpeg</encodeType>
        <quality type="quality">higher</quality>
        <GOP type="uint32" min="25" max="1500">50</GOP>
    </item>
</streams>
<alarmSnapBindStreamId type="uint32">2</alarmSnapBindStreamId>"""))

    def _GetStreamCaps(self, request: httpx.Request, ch: int) -> httpx.Response:
        return self._xml(request, _doc("""<types>
<resolution><enum>2592x1520</enum><enum>1920x1080</enum><enum>704x576</enum></resolution>
<encodeType><enum>h264</enum><enum>h265</enum><enum>h264plus</enum><enum>h265plus</enum><enum>mjpeg</enum></encodeType>
<encodeLevel><enum>baseLine</enum><enum>mainProfile</enum><enum>highProfile</enum></encodeLevel>
</types>
<rtspPort type="uint16">554</rtspPort>
<streamList type="list" count="3">
<item id="1"><streamName type="string"><![CDATA[profile1]]></streamName>
<resolutionCaps type="list" count="2"><itemType type="resolution"/><item maxFrameRate="25">2592x1520</item><item maxFrameRate="30">1920x1080</item></resolutionCaps>
<encodeTypeCaps type="list" count="2"><itemType type="encodeType"/><item>h264</item><item>h265</item></encodeTypeCaps>
<encodeLevelCaps type="list" count="3"><itemType type="encodeLevel"/><item>baseLine</item><item>mainProfile</item><item>highProfile</item></encodeLevelCaps></item>
<item id="2"><streamName type="string"><![CDATA[profile2]]></streamName>
<resolutionCaps type="list" count="1"><itemType type="resolution"/><item maxFrameRate="25">704x576</item></resolutionCaps>
<encodeTypeCaps type="list" count="3"><itemType type="encodeType"/><item>h264</item><item>h265</item><item>mjpeg</item></encodeTypeCaps>
<encodeLevelCaps type="list" count="1"><itemType type="encodeLevel"/><item>baseLine</item></encodeLevelCaps></item>
<item id="3"><streamName type="string"><![CDATA[profile3]]></streamName>
<resolutionCaps type="list" count="1"><itemType type="resolution"/><item maxFrameRate="25">704x576</item></resolutionCaps>
<encodeTypeCaps type="list" count="1"><itemType type="encodeType"/><item>mjpeg</item></encodeTypeCaps></item>
</streamList>""", "1.0"))

    def _GetSnapshot(self, request: httpx.Request, ch: int) -> httpx.Response:
        if self.kind == "nvr" and self.channels.get(ch) in (None, "offline"):
            return httpx.Response(200, content=b"", headers={"Content-Type": "application/octet-stream"}, request=request)
        return httpx.Response(200, content=JPEG, headers={"Content-Type": "application/octet-stream", "Connection": "close"}, request=request)

    def _GetDiskInfo(self, request: httpx.Request, ch: int) -> httpx.Response:
        return self._xml(request, _doc("""<types><diskStatus><enum>read</enum><enum>read/write</enum><enum>unformat</enum></diskStatus></types>
<diskInfo type="list" count="1"><item>
<id type="string"><![CDATA[{00000000-0000-0000-0000-000000000001}]]></id>
<totalSpace type="uint32">953869</totalSpace><freeSpace type="uint32">847872</freeSpace>
<diskStatus type="diskStatus">read/write</diskStatus></item></diskInfo>""", "1.0"))

    def _GetRecordStatusInfo(self, request: httpx.Request, ch: int) -> httpx.Response:
        return self._xml(request, _doc("""<recordStatusList type="list" count="2">
<item id="1" streamType="main" resolution="2592x1520" frameRate="25" bitrateType="VBR" imageQuality="higher" maxBitrate="3072" recordTypes="motion">recording</item>
<item id="2" streamType="" resolution="" frameRate="" bitrateType="" imageQuality="" maxBitrate="" recordTypes="">norecording</item>
</recordStatusList>""", "1.0"))

    def _GetPortConfig(self, request: httpx.Request, ch: int) -> httpx.Response:
        return self._xml(request, _doc("""<port><httpPort type="uint16">80</httpPort><netPort type="uint16">6036</netPort><rtspPort type="uint16">554</rtspPort>
<httpsPort type="uint16">443</httpsPort><longPollingPort type="uint16">8091</longPollingPort><enablelongPollingHttp type="boolean">true</enablelongPollingHttp></port>"""))

    def _GetDateAndTime(self, request: httpx.Request, ch: int) -> httpx.Response:
        return self._xml(request, _doc("""<time><timeFormatMode type="timeFormatModeType">24h</timeFormatMode>
<timezoneInfo><timeZone type="string" maxLen="127"><![CDATA[IST-2IDT,M3.4.4/26,M10.5.0]]></timeZone><daylightSwitch type="uint32">1</daylightSwitch></timezoneInfo>
<synchronizeInfo><type type="synchronizeType">NTP</type><ntpServer type="string" maxLen="127"><![CDATA[pool.ntp.org]]></ntpServer>
<ntpSyncInterval type="uint32" min="30" max="10080">1440</ntpSyncInterval><currentTime type="string"><![CDATA[2026-10-04 12:00:00]]></currentTime></synchronizeInfo></time>"""))

    def _status_xml(self, alarms: dict[tuple[str, int | None], bool]) -> str:
        parts: list[str] = []
        sensors = {k: v for k, v in alarms.items() if k[0] == "sensorAlarmIn"}
        for (kind, ident), value in alarms.items():
            if kind == "sensorAlarmIn":
                continue
            idattr = f' id="{ident}"' if ident is not None else ""
            parts.append(f'<{kind} type="boolean"{idattr}>{"true" if value else "false"}</{kind}>')
        if sensors:
            items = "".join(f'<item id="{k[1]}">{"true" if v else "false"}</item>' for k, v in sensors.items())
            parts.append(f'<sensorAlarmIn type="list" count="{len(sensors)}"><itemType type="boolean"/>{items}</sensorAlarmIn>')
        return "<alarmStatusInfo>" + "".join(parts) + "</alarmStatusInfo>"

    def _GetAlarmStatus(self, request: httpx.Request, ch: int) -> httpx.Response:
        return self._xml(request, _doc(self._status_xml(self.alarms), "1.0"))

    # long polling (v1 long-polling guide 2.1-2.4)
    def _SetSubscribe(self, request: httpx.Request, ch: int) -> httpx.Response:
        body = request.content.decode()
        if "REALTIME_SUBSCRIBE" not in body:
            return self._xml(request, '<?xml version="1.0" encoding="utf-8"?><config status="failed" errorCode="3"/>', 400)
        self.subscriptions += 1
        return self._xml(request, _doc(f"""<serverAddress type="string"><![CDATA[http://{HOST}:8091/IPC/event/subsription_{self.subscriptions}]]></serverAddress>
<currentTime type="uint32">1759575600</currentTime><terminationTime type="uint32">1759575660</terminationTime>
<timeout type="uint32" min="0" max="10" default="5">5</timeout>""", "1.0"))

    def _GetPullMessages(self, request: httpx.Request, ch: int) -> httpx.Response:
        if "subsription_" not in request.content.decode():
            return self._xml(request, '<?xml version="1.0" encoding="utf-8"?><config status="failed" errorCode="3"/>', 400)
        msgs, self.pull_queue = self.pull_queue, []
        items = "".join(f"""<item>{self._status_xml(m)}<dataTime type="string"><![CDATA[2026-10-04 12:00:0{i}]]></dataTime>
<deviceInfo><deviceName type="string"><![CDATA[IPC]]></deviceName><sn type="string"><![CDATA[FAKESERIAL0001]]></sn>
<ipAddress type="string"><![CDATA[192.0.2.10]]></ipAddress><macAddress type="string"><![CDATA[00:00:5E:00:53:01]]></macAddress></deviceInfo></item>"""
                        for i, m in enumerate(msgs))
        return self._xml(request, _doc(f"""<currentTime type="uint32">1759575601</currentTime><terminationTime type="uint32">1759575661</terminationTime>
<alarmInfoList type="list" count="{len(msgs)}">{items}</alarmInfoList>""", "1.0"))

    def _SetRenew(self, request: httpx.Request, ch: int) -> httpx.Response:
        return self._xml(request, _doc('<currentTime type="uint32">1759575602</currentTime><terminationTime type="uint32">1759575720</terminationTime>', "1.0"))

    def _SetUnSubscribe(self, request: httpx.Request, ch: int) -> httpx.Response:
        return self._xml(request, f'<?xml version="1.0" encoding="UTF-8"?><config version="1.0" {NS} status="success" errorCode="200"/>')

    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self.handle)


def settings_for(base: Any, **extra: Any) -> Any:
    """`base` (the conftest `settings`) pointed at the fake, vendor provision_isr, with `nvr_extra`."""
    import dataclasses

    return dataclasses.replace(base, nvr_host=HOST, nvr_http_port=80, nvr_rtsp_port=554, nvr_user=USER, nvr_password=PASSWORD,
                               nvr_vendor="provision_isr", nvr_extra=dict(extra))
