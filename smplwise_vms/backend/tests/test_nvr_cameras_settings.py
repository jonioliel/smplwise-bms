"""CR-020 S1: the read-only table of the cameras' video settings - the parser of every stream of the ISAPI streaming LIST
(synthetic, redacted fixtures in the lab's v2.0 shape: no address, serial or MAC), the Hikvision adapter, and the three GET
routes against the fake NVR of tests/fixtures/fake_devices.py (the backend's real ISAPI code runs, only the HTTP answers are
fake). Nothing here - and nothing in S1 - writes to a device: `fake.writes` stays empty."""
from __future__ import annotations

import dataclasses
import json
import sys
from pathlib import Path

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.db import new_id, now_iso, permission_revision
from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.services import autosync, nvr
from smplwise.services.recorders import registry
from smplwise.services.recorders.hikvision import HikvisionAdapter
from smplwise.services import xmlsafe

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_devices import NVR_HOST, FakeDevices  # noqa: E402

ISAPI_NS = 'xmlns="http://www.isapi.org/ver20/XMLSchema"'
LIST_NS = 'xmlns="http://www.hikvision.com/ver20/XMLSchema"'


def _stream(sid: str, video: str, enabled: str = "true") -> str:
    return (f'<StreamingChannel version="2.0" {ISAPI_NS}><id>{sid}</id><channelName>{sid}</channelName><enabled>{enabled}</enabled>'
            "<Transport><ControlProtocolList><ControlProtocol><streamingTransport>RTSP</streamingTransport></ControlProtocol></ControlProtocolList></Transport>"
            f"<Video><enabled>true</enabled><dynVideoInputChannelID>{sid[:-2]}</dynVideoInputChannelID>{video}</Video>"
            "<Audio><enabled>true</enabled><audioCompressionType>G.711ulaw</audioCompressionType></Audio></StreamingChannel>")


def _listing(*streams: str) -> str:
    return f'<?xml version="1.0" encoding="UTF-8" ?><StreamingChannelList version="1.0" {LIST_NS}>' + "".join(streams) + "</StreamingChannelList>"


# the lab document's shape (the v2.0 LIST): an H.264 main with SVC on and a VBR cap, an H.264 sub, an H.265 pair, a third stream
LAB_LIST = _listing(
    _stream("101", "<videoCodecType>H.264</videoCodecType><videoResolutionWidth>2560</videoResolutionWidth><videoResolutionHeight>1440</videoResolutionHeight>"
                   "<videoQualityControlType>VBR</videoQualityControlType><vbrUpperCap>3072</vbrUpperCap><fixedQuality>60</fixedQuality><maxFrameRate>0</maxFrameRate><GovLength>50</GovLength>"
                   "<H264Profile>High</H264Profile><SVC><enabled>true</enabled><SVCMode>manual</SVCMode></SVC><SmartCodec><enabled>false</enabled></SmartCodec>"),
    _stream("102", "<videoCodecType>H.264</videoCodecType><videoResolutionWidth>640</videoResolutionWidth><videoResolutionHeight>360</videoResolutionHeight>"
                   "<videoQualityControlType>CBR</videoQualityControlType><constantBitRate>512</constantBitRate><maxFrameRate>2000</maxFrameRate><GovLength>40</GovLength>"
                   "<H264Profile>Baseline</H264Profile><SmartCodec><enabled>false</enabled></SmartCodec>"),
    _stream("103", "<videoCodecType>H.264</videoCodecType><videoResolutionWidth>1280</videoResolutionWidth><videoResolutionHeight>720</videoResolutionHeight><maxFrameRate>1200</maxFrameRate>"),
    _stream("201", "<videoCodecType>H.265</videoCodecType><videoResolutionWidth>2688</videoResolutionWidth><videoResolutionHeight>1520</videoResolutionHeight>"
                   "<videoQualityControlType>VBR</videoQualityControlType><vbrUpperCap>4096</vbrUpperCap><maxFrameRate>2500</maxFrameRate><GovLength>50</GovLength>"
                   "<H265Profile>Main</H265Profile><SVC><enabled>false</enabled></SVC><SmartCodec><enabled>true</enabled></SmartCodec>"),
    _stream("202", "<videoCodecType>H.264+</videoCodecType><H264Profile>Main</H264Profile><videoResolutionWidth>640</videoResolutionWidth><videoResolutionHeight>360</videoResolutionHeight>", enabled="false"),
)


# ---------------------------------------------------------------- the parser

def test_list_parses_every_stream_with_bitrate_and_support_facts():
    streams = nvr.parse_streaming_channels_all(LAB_LIST)
    assert [s["stream_ref"] for s in streams] == ["101", "102", "103", "201", "202"], "every stream the device lists, N03 included, in document order"
    s = {x["stream_ref"]: x for x in streams}
    m = s["101"]
    assert (m["channel"], m["role"], m["codec"], m["profile"], m["resolution"]) == (1, "main", "H.264", "High", "2560x1440")
    assert (m["fps"], m["fps_full"], m["bitrate_mode"], m["bitrate_kbps"], m["quality"], m["gop"]) == (None, True, "VBR", 3072, 60, 50), "fps 0 is the camera's full rate; VBR reads vbrUpperCap"
    assert (m["svc"], m["smart_codec"], m["codec_plus"]) == (True, False, False)
    assert (m["webrtc"], m["webrtc_reason"]) == ("no", "svc"), "the lab's SVC mains: H.264 that does not decode over WebRTC"
    assert set(m["fields"]) == {"b_frames"}, "only the B-frame element is missing on the lab shape"
    assert m["fields"]["b_frames"] == {"supported": False, "editable": False} and m["b_frames"] is None, "never a default for a field the device does not send"
    sub = s["102"]
    assert (sub["role"], sub["bitrate_mode"], sub["bitrate_kbps"], sub["fps"], sub["fps_full"], sub["profile"]) == ("sub", "CBR", 512, 20.0, False, "Baseline"), "CBR reads constantBitRate"
    assert (sub["svc"], sub["webrtc"]) == (None, "ok") and sub["fields"]["svc"]["supported"] is False and sub["fields"]["quality"]["supported"] is False
    assert (s["103"]["role"], s["103"]["bitrate_kbps"], s["103"]["bitrate_mode"], s["103"]["gop"], s["103"]["profile"]) == ("third", None, None, None, None)
    assert set(s["103"]["fields"]) >= {"profile", "bitrate_mode", "bitrate_kbps", "quality", "gop", "svc", "smart_codec", "b_frames"}
    h265 = s["201"]
    assert (h265["channel"], h265["codec"], h265["profile"], h265["svc"], h265["smart_codec"], h265["codec_plus"], h265["webrtc"]) == (2, "H.265", "Main", False, True, True, "no"), "smart codec on is the H.265+ variant"
    plus = s["202"]
    assert (plus["codec"], plus["codec_raw"], plus["codec_plus"], plus["enabled"], plus["resolution"]) == ("H.264", "H.264+", True, False, "640x360"), "the raw '+' codec is kept and flagged"
    assert len({x["etag"] for x in streams}) == 5 and all(len(x["etag"]) == 16 for x in streams)


def test_etag_ignores_whitespace_and_changes_with_the_document():
    a = nvr.parse_streaming_channels_all(LAB_LIST)[0]["etag"]
    spaced = LAB_LIST.replace("><", ">\n  <")
    assert nvr.parse_streaming_channels_all(spaced)[0]["etag"] == a
    assert nvr.parse_streaming_channels_all(LAB_LIST.replace("<SVC><enabled>true", "<SVC><enabled>false"))[0]["etag"] != a


def test_single_stream_document_without_svc_reports_it_unsupported_not_off():
    """The lab firmware's single-channel GET lacks <SVC>; reading it would say 'no SVC' for a stream that has it. The parser
    therefore never invents a value: no element means None and supported:false (the service reads the LIST only)."""
    one = '<?xml version="1.0" encoding="UTF-8" ?>' + _stream("101", "<videoCodecType>H.264</videoCodecType>")
    [s] = nvr.parse_streaming_channels_all(one)
    assert s["svc"] is None and s["fields"]["svc"]["supported"] is False and (s["webrtc"], s["webrtc_reason"]) == ("ok", "h264")


def test_tolerant_of_missing_and_malformed_values():
    doc = _listing(
        _stream("301", "<videoCodecType>H.264</videoCodecType><videoResolutionWidth>abc</videoResolutionWidth><videoResolutionHeight>1080</videoResolutionHeight>"
                       "<maxFrameRate>fast</maxFrameRate><GovLength>-</GovLength><vbrUpperCap>x</vbrUpperCap><videoQualityControlType>weird</videoQualityControlType>"),
        _stream("x1", "<videoCodecType>H.264</videoCodecType>"),  # a non-numeric id is skipped
        '<StreamingChannel><id>502</id></StreamingChannel>',  # no <Video>: skipped
        _stream("601", ""),  # an empty <Video>
    )
    streams = nvr.parse_streaming_channels_all(doc)
    assert [s["stream_ref"] for s in streams] == ["301", "601"]
    a, b = streams
    assert (a["resolution"], a["fps"], a["fps_full"], a["gop"], a["bitrate_kbps"], a["bitrate_mode"]) == (None, None, False, None, None, None)
    assert (b["codec"], b["codec_raw"], b["codec_plus"], b["webrtc"], b["webrtc_reason"]) == (None, None, None, "unknown", "codec_unknown")
    assert nvr.parse_streaming_channels_all(_listing()) == [] and nvr.parse_streaming_channels_all('<StreamingChannelList/>') == []


def test_strict_on_hostile_and_oversized_documents():
    with pytest.raises(xmlsafe.UnsafeXml):
        nvr.parse_streaming_channels_all('<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "b">]>' + _listing())
    with pytest.raises(Exception):
        nvr.parse_streaming_channels_all("not xml at all")
    many = _listing(*[_stream(f"{c}01", "<videoCodecType>H.264</videoCodecType>") for c in range(1, 400)])
    assert len(nvr.parse_streaming_channels_all(many)) == nvr.MAX_STREAMING_ELEMENTS, "an element-count cap"
    assert len(nvr.parse_streaming_channels_all(many, max_streams=10)) == 10
    long_codec = _listing(_stream("101", "<videoCodecType>" + "X" * 500 + "</videoCodecType><H264Profile>" + "p" * 500 + "</H264Profile>"))
    [s] = nvr.parse_streaming_channels_all(long_codec)
    assert len(s["codec_raw"]) == 64 and len(str(s["codec"])) <= 500  # the raw text is capped; the family keeps the (unknown) raw string


def test_stream_role_by_id():
    assert [nvr.stream_role(x) for x in (101, 102, 103, 104, 1001, 1002)] == ["main", "sub", "third", "other", "main", "sub"]


# ---------------------------------------------------------------- the adapter and the registry

@pytest.fixture()
def fake(monkeypatch) -> FakeDevices:
    f = FakeDevices()
    f.install(monkeypatch)
    return f


def with_nvr(settings, **extra):
    return dataclasses.replace(settings, nvr_host=NVR_HOST, nvr_user="reader", nvr_password="fake-password", **extra)


def test_adapter_reads_channels_and_streams_and_declares_read_only(settings, fake):
    fake.nvr["channels"] = 2
    fake.nvr["offline"] = [2]
    fake.nvr["encodings_by_channel"] = {1: {"main": {"codec": "H.264", "svc": True, "bitrate_kbps": 3072, "quality": 60}}}
    ad = HikvisionAdapter("nvr-1", with_nvr(settings))
    caps = ad.capabilities()
    assert (caps.vendor, caps.read_encodings, caps.write_encodings, caps.add_channel, caps.remove_channel) == ("hikvision", True, False, False, False)
    assert "svc" in caps.encoding_fields and "b_frames" in caps.encoding_fields
    h = ad.health()
    assert (h.online, h.model, h.error) == (True, "DS-7616NI-FAKE", None)
    ch = ad.list_channels()
    assert [(c.source_ref, c.channel, c.online) for c in ch] == [("1", 1, True), ("2", 2, False)]
    by = ad.read_stream_encodings()
    assert sorted(by) == ["1", "2"] and [s.stream_ref for s in by["1"]] == ["101", "102"]
    m = by["1"][0]
    assert (m.role, m.encoding["codec"], m.encoding["svc"], m.encoding["bitrate_kbps"], m.encoding["quality"], m.etag is not None) == ("main", "H.264", True, 3072, 60, True)
    assert fake.writes == [], "reading never writes"


def test_adapter_failure_modes_are_api_errors(settings, fake):
    ad = HikvisionAdapter("nvr-1", with_nvr(settings))
    fake.nvr["streaming_xml"] = "<?xml version='1.0'?><!DOCTYPE a [<!ENTITY x 'y'>]><a/>"
    with pytest.raises(ApiError) as e:
        ad.read_stream_encodings()
    assert e.value.code == "source_invalid"
    fake.nvr["streaming_xml"] = "<StreamingChannelList>" + "<!-- " + "x" * (nvr.STREAMING_DOC_MAX_BYTES + 10) + " --></StreamingChannelList>"
    with pytest.raises(ApiError) as e:
        ad.read_stream_encodings()
    assert e.value.code == "source_too_large"
    fake.nvr["streaming"] = False
    with pytest.raises(ApiError) as e:
        ad.read_stream_encodings()
    assert e.value.code == "source_error"
    fake.nvr["up"] = False
    assert ad.health().online is False and ad.health().error == "source_unavailable"
    with pytest.raises(ApiError):
        ad.list_channels()


def test_registry_knows_the_default_recorder_only(settings, fake):
    from smplwise.db import Database

    db = Database(settings.db_path)
    with TestClient(create_app(settings)):
        pass
    with db.connection() as conn:
        assert registry.recorder_ids(conn) == ["nvr-1"]
        assert isinstance(registry.adapter_for(conn, with_nvr(settings), "nvr-1"), HikvisionAdapter)
        with pytest.raises(ApiError) as e:
            registry.adapter_for(conn, with_nvr(settings), "nvr-9")
        assert e.value.status == 404 or e.value.code == "not_found"


# ---------------------------------------------------------------- the routes

def _register(c: TestClient, *channels: tuple[int, str]) -> dict[int, str]:
    return {ch: c.post("/api/v1/cameras", json={"channel": ch, "alias": alias}).json()["id"] for ch, alias in channels}


def _forget_channel(app, channel: int) -> None:
    """The start-up discovery already created a camera row per channel; drop one to stand for 'discovery has not run for it yet'."""
    with app.state.db.connection() as conn:
        conn.execute("DELETE FROM cameras WHERE recorder_id = 'nvr-1' AND channel = ?", (channel,))


def _audit(app, action: str) -> list[dict]:
    with app.state.db.connection() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]


@pytest.fixture()
def app_and_fake(settings, fake):
    fake.nvr["channels"] = 3
    fake.nvr["offline"] = [3]
    fake.nvr["encodings"] = {"main": {"codec": "H.264", "svc": True, "width": 2560, "height": 1440, "bitrate_kbps": 3072, "quality": 60, "fps": 0, "bitrate_mode": "VBR"},
                             "sub": {"codec": "H.264", "svc": None, "width": 640, "height": 360, "bitrate_kbps": 512, "bitrate_mode": "CBR", "fps": 20, "profile": "Baseline"}}
    fake.nvr["encodings_by_channel"] = {2: {"main": {"codec": "H.265", "svc": False, "profile": "Main"}}}
    app = create_app(with_nvr(settings))
    return app, fake


def test_cameras_route_lists_every_channel_with_every_stream(app_and_fake, settings):
    app, fake = app_and_fake
    with TestClient(app) as c:
        _forget_channel(app, 3)  # channel 3 has no Arx row yet; channel 2 is disabled in Arx below
        ids = _register(c, (1, "כניסה"), (2, "חצר"))
        with app.state.db.connection() as conn:
            conn.execute("UPDATE cameras SET enabled = 0 WHERE id = ?", (ids[2],))
        r = c.get("/api/v1/nvr/cameras")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["stale"] is False and body["recorders_failed"] == [] and body["can_write"] is False and body["error"] is None
        cams = {x["channel"]: x for x in body["cameras"]}
        assert sorted(cams) == [1, 2, 3], "every channel of the NVR: offline and disabled-in-Arx included"
        assert (cams[1]["camera_id"], cams[1]["name"], cams[1]["online"], cams[1]["enabled_in_arx"]) == (ids[1], "כניסה", True, True)
        assert (cams[2]["camera_id"], cams[2]["enabled_in_arx"]) == (ids[2], False)
        assert (cams[3]["camera_id"], cams[3]["online"], cams[3]["name"]) == (None, False, "מצלמה 3"), "an unsynced channel: the device's own name, no Arx id"
        m1, s1 = cams[1]["streams"]
        assert (m1["stream_ref"], m1["role"], m1["codec"], m1["svc"], m1["resolution"], m1["fps_full"], m1["bitrate_kbps"], m1["bitrate_mode"]) == ("101", "main", "H.264", True, "2560x1440", True, 3072, "VBR")
        assert (m1["webrtc"], m1["webrtc_reason"], m1["writable"], m1["not_writable_reason"]) == ("no", "svc", False, "read_only")
        assert (s1["role"], s1["svc"], s1["fps"], s1["bitrate_mode"], s1["bitrate_kbps"], s1["profile"], s1["webrtc"]) == ("sub", None, 20.0, "CBR", 512, "Baseline", "ok")
        assert s1["fields"]["svc"] == {"supported": False, "editable": False} and s1["fields"]["b_frames"]["supported"] is False
        assert (cams[2]["streams"][0]["codec"], cams[2]["streams"][0]["webrtc_reason"]) == ("H.265", "h265")
        assert fake.writes == [], "S1 never writes to the device"


def test_cameras_route_leaks_no_address_credential_or_document(app_and_fake):
    app, fake = app_and_fake
    with TestClient(app) as c:
        _register(c, (1, "כניסה"))
        cid = _register(c, (2, "חצר"))[2]
        for path in ("/api/v1/nvr/recorders", "/api/v1/nvr/cameras", f"/api/v1/nvr/cameras/{cid}"):
            text = c.get(path).text
            for secret in (NVR_HOST, "fake-password", "reader", "<Video", "StreamingChannel", "http://"):
                assert secret not in text, (path, secret)


def test_recorders_route_and_nvr_less_mode(settings, fake):
    app = create_app(with_nvr(settings))
    with TestClient(app) as c:
        r = c.get("/api/v1/nvr/recorders")
        assert r.status_code == 200, r.text
        rec = r.json()["recorders"][0]
        assert (rec["recorder_id"], rec["vendor"], rec["online"], rec["model"], rec["error"], r.json()["can_write"]) == ("nvr-1", "hikvision", True, "DS-7616NI-FAKE", None, False)
        assert (rec["capabilities"]["read_encodings"], rec["capabilities"]["write_encodings"], rec["capabilities"]["add_channel"]) == (True, False, False)
        fake.nvr["up"] = False
        down = c.get("/api/v1/nvr/recorders").json()["recorders"][0]
        assert (down["online"], down["error"]) == (False, "source_unavailable")
    ha_only = dataclasses.replace(settings, nvr_host=None, nvr_user=None, nvr_password=None)
    with TestClient(create_app(ha_only)) as c:
        for path in ("/api/v1/nvr/recorders", "/api/v1/nvr/cameras"):
            r = c.get(path)
            assert r.status_code == 409 and r.json()["code"] == "nvr_not_configured", path
        with TestClient(create_app(ha_only)) as c2:
            assert c2.get("/api/v1/nvr/cameras", headers=as_user("nobody")).status_code == 403, "the permission check comes before the mode check"


def test_system_administrators_only_denial_is_audited(app_and_fake, settings):
    app, fake = app_and_fake
    with TestClient(app) as c:
        _register(c, (1, "כניסה"))
        bind(c, with_nvr(settings), "sam", "site_admin", "installation", "*")
        bind(c, with_nvr(settings), "vera", "viewer", "installation", "*")
        for user in ("sam", "vera", "nobody"):
            for path in ("/api/v1/nvr/recorders", "/api/v1/nvr/cameras"):
                assert c.get(path, headers=as_user(user)).status_code == 403, (user, path)
        denied = [r for r in _audit(app, "system.configure") if r["decision"] == "denied"]
        assert {r["actor_username"] for r in denied} >= {"sam", "vera", "nobody"}
        assert c.get("/api/v1/nvr/cameras").status_code == 200  # the bootstrap system administrator
        reads = _audit(app, "nvr.cameras.read")
        assert len(reads) == 1 and reads[0]["decision"] == "allowed" and reads[0]["resource_type"] == "installation"
        details = json.loads(reads[0]["details_json"])
        assert details == {"cameras": 3, "streams": 6, "stale": False, "error": None}, "the read audit keeps counts only"
        assert NVR_HOST not in reads[0]["details_json"]


def test_camera_deny_removes_the_camera_and_403s_its_detail(app_and_fake, settings):
    app, fake = app_and_fake
    s = with_nvr(settings)
    with TestClient(app) as c:
        _forget_channel(app, 3)
        ids = _register(c, (1, "כניסה"), (2, "חצר"))
        c.get("/api/v1/me", headers=as_user("ron"))
        with app.state.db.connection() as conn:
            for scope_type, scope_id, effect in (("installation", "*", "allow"), ("camera", ids[2], "deny")):
                conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) VALUES (?, 'user', 'dev-ron', 'system_admin', ?, ?, ?, ?, 'test', ?)",
                             (new_id(), scope_type, scope_id, effect, permission_revision(conn), now_iso()))
        got = c.get("/api/v1/nvr/cameras", headers=as_user("ron")).json()
        assert [x["channel"] for x in got["cameras"]] == [1], "a denied camera, and a channel without an Arx row (installation-wide only), are left out"
        assert c.get(f"/api/v1/nvr/cameras/{ids[1]}", headers=as_user("ron")).status_code == 200
        assert c.get(f"/api/v1/nvr/cameras/{ids[2]}", headers=as_user("ron")).status_code == 403, "403 before 404/200 for a denied camera"
        assert c.get("/api/v1/nvr/cameras/does-not-exist", headers=as_user("ron")).status_code in (403, 404)
        assert [r for r in _audit(app, "system.configure") if r["decision"] == "denied" and r["resource_id"] == ids[2]]


def test_camera_detail(app_and_fake):
    app, fake = app_and_fake
    with TestClient(app) as c:
        ids = _register(c, (1, "כניסה"))
        r = c.get(f"/api/v1/nvr/cameras/{ids[1]}")
        assert r.status_code == 200, r.text
        cam = r.json()["camera"]
        assert (cam["camera_id"], cam["channel"], [s["stream_ref"] for s in cam["streams"]]) == (ids[1], 1, ["101", "102"]) and r.json()["can_write"] is False
        assert c.get("/api/v1/nvr/cameras/nope").status_code in (403, 404)
        assert fake.writes == []


def test_unreadable_streaming_document_falls_back_to_the_registry_stale(app_and_fake, settings):
    app, fake = app_and_fake
    with TestClient(app) as c:
        ids = _register(c, (1, "כניסה"))
        with app.state.db.connection() as conn:  # the discovery's last reading (main + sub) lives in the camera row
            enc = {"main": {"codec": "H.264", "profile": None, "b_frames": None, "svc": True, "smart_codec": False, "resolution": "2560x1440", "fps": None, "gov_length": 50, "source": "isapi", "webrtc": "no", "reason": "svc"},
                   "sub": {"codec": "H.264", "profile": "Baseline", "b_frames": None, "svc": None, "smart_codec": False, "resolution": "640x360", "fps": 20.0, "gov_length": 50, "source": "isapi", "webrtc": "ok", "reason": "h264_no_b_frames"},
                   "checked_at": now_iso(), "error": None}
            conn.execute("UPDATE cameras SET capabilities_json = ? WHERE id = ?", (json.dumps({"encoding": enc}), ids[1]))
        fake.nvr["streaming"] = False  # the streaming list answers notSupport; the channel list still works
        r = c.get("/api/v1/nvr/cameras")
        assert r.status_code == 200, "a device failure is never a 5xx"
        body = r.json()
        assert body["stale"] is True and body["error"] == "source_error" and body["recorders_failed"] == ["nvr-1"]
        cam = next(x for x in body["cameras"] if x["channel"] == 1)
        assert cam["error"] == "source_error" and [(s["stream_ref"], s["role"], s["etag"], s["writable"]) for s in cam["streams"]] == [("101", "main", None, False), ("102", "sub", None, False)]
        assert (cam["streams"][0]["svc"], cam["streams"][0]["webrtc"], cam["streams"][0]["gop"]) == (True, "no", 50)
        # the whole NVR down: the cameras Arx knows, from the registry
        fake.nvr["up"] = False
        body = c.get("/api/v1/nvr/cameras").json()
        assert body["stale"] is True and body["error"] == "source_unavailable"
        assert [x["channel"] for x in body["cameras"]] == [1, 2, 3], "every camera row Arx has (the start-up discovery made 2 and 3)"
        assert body["cameras"][0]["streams"][0]["codec"] == "H.264" and body["cameras"][1]["streams"][0]["codec"] == "H.265" and all(x["online"] is None or isinstance(x["online"], bool) for x in body["cameras"])
        assert fake.writes == []


def test_recorder_id_filter_is_validated(app_and_fake):
    app, _ = app_and_fake
    with TestClient(app) as c:
        assert c.get("/api/v1/nvr/cameras?recorder_id=nvr-1").status_code == 200
        assert c.get("/api/v1/nvr/cameras?recorder_id=nvr-9").status_code == 404
        assert c.get("/api/v1/nvr/cameras?recorder_id=" + "x" * 80).status_code == 422
        assert c.get("/api/v1/nvr/cameras?recorder_id=../etc").status_code == 422


def test_no_write_verbs_exist(app_and_fake):
    """S1 ships no write route and no write method: PUT / POST / DELETE on the new paths are 405 (the guarded writes are S2)."""
    app, fake = app_and_fake
    with TestClient(app) as c:
        for method in ("put", "post", "delete", "patch"):
            for path in ("/api/v1/nvr/cameras", "/api/v1/nvr/cameras/x", "/api/v1/nvr/recorders", "/api/v1/nvr/cameras/x/streams/101"):
                assert getattr(c, method)(path).status_code in (404, 405, 422), (method, path)
        assert fake.writes == []
    assert not any(hasattr(HikvisionAdapter, n) for n in ("write_stream_encoding", "add_channel", "remove_channel"))
    assert autosync is not None
