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
         "GetStreamCaps", "GetVideoStreamConfig", "GetImageOsdConfig", "GetSnapshot", "GetAlarmStatus", "GetAlarmServerConfig",
         "GetRecordType", "SearchRecordDate", "SearchByTime", "GetSnapshotByTime"}  # P3 reads (the derived-events pass searches recordings)
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
        # P2 (writes, fake only): per-channel stream state, what SetVideoStreamConfig does with a body ("apply" | "ignore"
        # | "partial": only the first changed field), a failure after the body arrived ("drop": connection lost -> unknown)
        self.streams: dict[int, dict[int, dict[str, Any]]] = {}
        self.set_effect = "apply"
        self.set_after: str | None = None
        self.set_bodies: list[str] = []
        self.alarm_server = {"addr": "", "port": 8010, "heartbeat": False, "interval": 30}
        # "doc": the guide / Postman shapes. "live": what the owner's NVR (NVR8-16400AN, firmware 1.4.7) answered on
        # 2026-10-04 - stream ids from 0, each stream named by its RTSP URL (sub = `sub1`), channel names as an attribute
        # of the channel list, profiles in a top-level encodeLevelCaps, an empty encodeTypeCaps, chlOfflineAlarm in
        # GetAlarmStatus, one record-status item per stream, "no recording", no apiVersion.
        self.shape = "doc"

    def _state(self, ch: int) -> dict[int, dict[str, Any]]:
        if ch not in self.streams:
            self.streams[ch] = {
                1: {"name": "profile1", "resolution": "2592x1520", "frameRate": "25", "bitRateType": "VBR", "maxBitRate": "3072",
                    "encodeType": self.codec.get(ch, "h265"), "encodeLevel": "mainProfile", "quality": "higher", "GOP": "50"},
                2: {"name": "profile2", "resolution": "704x576", "frameRate": "6", "bitRateType": "CBR", "maxBitRate": "512",
                    "encodeType": "h264", "encodeLevel": "baseLine", "quality": "medium", "GOP": "12"},
                3: {"name": "profile3", "resolution": "704x576", "frameRate": "25", "bitRateType": "CBR", "maxBitRate": "512",
                    "encodeType": "mjpeg", "quality": "higher", "GOP": "50"},
            }
        return self.streams[ch]

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
            if cmd == "ISAPI":  # another vendor's discovery probing this host (app-level tests): not a Provision command
                return httpx.Response(404, request=request)
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
    {'' if self.shape == "live" else '<apiVersion type="string"><![CDATA[1.7]]></apiVersion>'}
</deviceInfo>"""))

    def _GetChannelList(self, request: httpx.Request, ch: int) -> httpx.Response:
        if self.kind != "nvr":
            return self._xml(request, '<?xml version="1.0" encoding="utf-8"?><config status="failed" errorCode="1"/>', 400)
        if self.shape == "live":
            items = "\n".join(f'<item channelStatus="{st}" name="{self.names.get(c, f"CAM-{c}")}">{c}</item>' for c, st in self.channels.items())
        else:
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

    _CAPS = {
        1: ('<bitRateLists><item>1536</item><item>2048</item><item>3072</item><item>5120</item><item>7168</item></bitRateLists>'
            '<encodeTypeCaps type="list"><itemType type="encodeType" /><item>h264</item><item>h265</item><item>h264plus</item><item>h265plus</item></encodeTypeCaps>',
            '<maxBitRate type="uint32" min="64" max="8192">{}</maxBitRate>', '<GOP type="uint32" min="25" max="1500">{}</GOP>'),
        2: ('<bitRateLists><item>128</item><item>256</item><item>512</item><item>768</item><item>1024</item></bitRateLists>'
            '<encodeTypeCaps type="list"><itemType type="encodeType" /><item>h264</item><item>h265</item><item>mjpeg</item></encodeTypeCaps>',
            '<maxBitRate type="uint32" min="64" max="8192">{}</maxBitRate>', '<GOP type="uint32" min="6" max="360">{}</GOP>'),
        3: ('', '<maxBitRate type="uint32" min="64" max="8192">{}</maxBitRate>', '<GOP type="uint32" min="25" max="1500">{}</GOP>'),
    }

    def _GetVideoStreamConfig(self, request: httpx.Request, ch: int) -> httpx.Response:
        if self.kind == "nvr" and self.channels.get(ch) in (None, "offline"):
            return self._xml(request, '<?xml version="1.0" encoding="utf-8"?><config status="failed" errorCode="3"/>', 400)
        items = []
        live = self.shape == "live"
        for sid, s in self._state(ch).items():
            lists, rate, gop = self._CAPS.get(sid, self._CAPS[3])
            if live:
                lists, rate, gop = "", '<maxBitRate type="uint32" min="32" max="10240">{}</maxBitRate>', '<GOP type="uint32" min="1" max="400">{}</GOP>'
            level = f"<encodeLevel>{s['encodeLevel']}</encodeLevel>" if s.get("encodeLevel") else ""
            name = f"rtsp://{HOST}:554/chID={ch}&streamType={'main' if sid == 1 else f'sub{sid - 1}'}" if live else s["name"]
            items.append(f"""    <item id="{sid - 1 if live else sid}">
        <name type="string" maxLen="32">
            <![CDATA[{name}]]>
        </name>
        <resolution>{s['resolution']}</resolution>
        <frameRate type="uint32">{s['frameRate']}</frameRate>
        <bitRateType type="bitRateType">{s['bitRateType']}</bitRateType>
        {rate.format(s['maxBitRate'])}
        {lists}
        <encodeType>{s['encodeType']}</encodeType>
        {level}
        <quality type="quality">{s['quality']}</quality>
        {gop.format(s['GOP'])}
    </item>""")
        return self._xml(request, _doc(f"""<types>
<bitRateType><enum>VBR</enum><enum>CBR</enum></bitRateType>
<quality><enum>lowest</enum><enum>lower</enum><enum>medium</enum><enum>higher</enum><enum>highest</enum></quality>
<encodeType><enum>h264</enum><enum>h264plus</enum><enum>h265</enum><enum>h265plus</enum><enum>mjpeg</enum></encodeType>
<encodeLevel><enum>baseLine</enum><enum>mainProfile</enum><enum>highProfile</enum></encodeLevel>
</types>
<mutexList type="list" count="1"><item><object type="mutexObjectType">vfd</object><status type="boolean">false</status></item></mutexList>
<streams type="list" count="{len(items)}">
{chr(10).join(items)}
</streams>
<alarmSnapBindStreamId type="uint32">2</alarmSnapBindStreamId>"""))

    def _SetVideoStreamConfig(self, request: httpx.Request, ch: int) -> httpx.Response:
        import xml.etree.ElementTree as ET

        body = request.content.decode()
        self.set_bodies.append(body)
        if self.set_after == "drop":
            raise httpx.ReadError("connection lost after the body was sent", request=request)
        root = ET.fromstring(body)
        ns = "{http://www.ipc.com/ver10}"
        streams = root.find(f"{ns}streams")
        if streams is None or streams.attrib:  # guide 3.3.4: the whole streams element, no attributes
            return self._xml(request, '<?xml version="1.0" encoding="utf-8"?><config status="failed" errorCode="3"/>', 400)
        state = self._state(ch)
        for item in streams.findall(f"{ns}item"):
            sid = int(item.attrib["id"]) + (1 if self.shape == "live" else 0)
            if sid not in state or any(c.attrib for c in item):
                return self._xml(request, '<?xml version="1.0" encoding="utf-8"?><config status="failed" errorCode="3"/>', 400)
            new = {c.tag.replace(ns, ""): (c.text or "").strip() for c in item}
            if new.get("bitRateType") not in ("CBR", "VBR", None) or not 64 <= int(new.get("maxBitRate", "512")) <= 8192:
                return self._xml(request, '<?xml version="1.0" encoding="utf-8"?><config status="failed" errorCode="3"/>', 400)
            changed = [k for k, v in new.items() if state[sid].get(k) != v]
            if self.set_effect == "ignore":
                changed = []
            elif self.set_effect == "partial":
                changed = changed[:1]
            for k in changed:
                state[sid][k] = new[k]
            if state[sid].get("encodeType") == "mjpeg":
                state[sid].pop("encodeLevel", None)
        return self._xml(request, '<?xml version="1.0" encoding="UTF-8"?><config status="success"/>')

    def _GetAlarmServerConfig(self, request: httpx.Request, ch: int) -> httpx.Response:
        a = self.alarm_server
        return self._xml(request, _doc(f"""<alarmServer><serverAddr type="string"><![CDATA[{a['addr']}]]></serverAddr>
<serverPort type="uint16" min="1" max="65535">{a['port']}</serverPort><enableHeartbeat type="boolean">{'true' if a['heartbeat'] else 'false'}</enableHeartbeat>
<heartbeatInterval type="uint16" min="10" max="1800">{a['interval']}</heartbeatInterval></alarmServer>"""))

    def _SetAlarmServerConfig(self, request: httpx.Request, ch: int) -> httpx.Response:
        import xml.etree.ElementTree as ET

        ns = "{http://www.ipc.com/ver10}"
        srv = ET.fromstring(request.content.decode()).find(f"{ns}alarmServer")
        if srv is None:
            return self._xml(request, '<?xml version="1.0" encoding="utf-8"?><config status="failed" errorCode="3"/>', 400)
        get = lambda tag: (srv.findtext(f"{ns}{tag}") or "").strip()  # noqa: E731
        self.alarm_server = {"addr": get("serverAddr"), "port": int(get("serverPort")), "heartbeat": get("enableHeartbeat") == "true",
                             "interval": int(get("heartbeatInterval"))}
        return self._xml(request, '<?xml version="1.0" encoding="UTF-8"?><config status="success"/>')
    def _GetStreamCaps(self, request: httpx.Request, ch: int) -> httpx.Response:
        if self.shape == "live":
            items = []
            for sid in self._state(ch):
                res = "".join(f'<item maxFrameRate="25">{r}</item>' for r in (("2592x1520", "1920x1080") if sid == 1 else ("704x576", "640x480", "352x288")))
                st = "main" if sid == 1 else f"sub{sid - 1}"
                items.append(f'<item id="{sid - 1}"><streamName type="string"><![CDATA[rtsp://{HOST}:554/chID={ch}&streamType={st}]]></streamName>'
                             f'<resolutionCaps type="list" count="2"><itemType type="resolution"></itemType>{res}</resolutionCaps>'
                             '<encodeTypeCaps type="list" count="0"><itemType type="encodeType"></itemType></encodeTypeCaps>'
                             '<encodeLevelCaps type="list" count="0"><itemType type="encodeLevel"></itemType></encodeLevelCaps></item>')
            return self._xml(request, _doc('<types><resolution><enum>1920x1080</enum></resolution><encodeType></encodeType><encodeLevel></encodeLevel></types>'
                                           '<encodeLevelCaps><enum>baseLine</enum><enum>mainProfile</enum></encodeLevelCaps><rtspPort type="uint16">554</rtspPort>'
                                           f'<streamList type="list" count="{len(items)}">{"".join(items)}</streamList>', "1.0"))
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
        if self.shape == "live":
            return self._xml(request, _doc("""<types><recordStatusType><enum>no recording</enum><enum>recording</enum><enum>exception</enum></recordStatusType></types>
<recordStatusList type="list" count="3"><itemType type="recordStatusType" maxLen="20"></itemType>
<item id="1" streamType="" resolution="" frameRate="" bitrateType="" imageQuality="" maxBitrate="" recordTypes="">no recording</item>
<item id="2" streamType="main" resolution="1920x1080" frameRate="25" bitrateType="VBR" imageQuality="higher" maxBitrate="2048" recordTypes="motion">recording</item>
<item id="2" streamType="sub" resolution="704x576" frameRate="6" bitrateType="VBR" imageQuality="higher" maxBitrate="128" recordTypes="manual,motion">recording</item>
</recordStatusList>""", "1.0"))
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
        if self.shape == "live":  # only active kinds; channel offline as a list
            active = {k: v for k, v in self.alarms.items() if v}
            xml = self._status_xml(active)
            off = [c for c, st in self.channels.items() if st == "offline"]
            if off:
                items = "".join(f'<item id="{c}">true</item>' for c in off)
                xml = xml.replace("</alarmStatusInfo>", f'<chlOfflineAlarm type="list" count="{len(off)}"><itemType type="boolean"></itemType>{items}</chlOfflineAlarm></alarmStatusInfo>')
            return self._xml(request, _doc(xml, "1.0"))
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

    def install(self, monkeypatch: Any) -> None:
        """Answer HOST for every httpx client of the process (app-level tests); other hosts go to the real transport."""
        real = httpx.HTTPTransport.handle_request
        fake = self

        def handle_request(transport: httpx.HTTPTransport, request: httpx.Request) -> httpx.Response:
            return fake.handle(request) if request.url.host == HOST else real(transport, request)

        monkeypatch.setattr(httpx.HTTPTransport, "handle_request", handle_request)


def settings_for(base: Any, **extra: Any) -> Any:
    """`base` (the conftest `settings`) pointed at the fake, vendor provision_isr, with `nvr_extra`."""
    import dataclasses

    return dataclasses.replace(base, nvr_host=HOST, nvr_http_port=80, nvr_rtsp_port=554, nvr_user=USER, nvr_password=PASSWORD,
                               nvr_vendor="provision_isr", nvr_extra=dict(extra))
