"""CR-025 P2 (fake device only): pluggable auth, the settings-screen warnings, the encoding write path (adapter and the
shared nvr_settings route), device push configuration and the push listener, smart events, the registry seam.
Nothing here touches a real device: httpx.MockTransport / the fake installed on HOST, and a localhost listener."""
from __future__ import annotations

import dataclasses
import json
import socket
import sys
import time
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from smplwise.db import Database, now_iso
from smplwise.errors import ApiError
from smplwise.services import autosync
from smplwise.services.recorders import provision_isr as pisr
from smplwise.services.recorders import provision_isr_auth as pauth
from smplwise.services.recorders import provision_isr_xml as px
from smplwise.services.recorders import registry
from smplwise.services.recorders.provision_push import PushListener, PushReceiver

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_provision import HOST, PASSWORD, USER, FakeProvision, settings_for  # noqa: E402


@pytest.fixture()
def fake() -> FakeProvision:
    pisr.clear_auth_cache()
    return FakeProvision()


def make(settings, fake, **extra) -> pisr.ProvisionIsrAdapter:
    return pisr.ProvisionIsrAdapter("nvr-2", settings_for(settings, **extra), transport=fake.transport())


def writer(settings, fake, **extra) -> pisr.ProvisionIsrAdapter:
    return make(settings, fake, writes_enabled=True, **extra)


# ---------------------------------------------------------------------------------------------- auth

def test_auth_detect_and_describe():
    ch = 'Digest realm="Web Service", qop="auth", nonce="0123456789abcdef0123456789abcdef", stale="TRUE", AuthVersion="1.1"'
    assert pauth.detect(ch) == "digest" and pauth.detect('Basic realm="x"') == "basic" and pauth.detect("") == "basic"
    d = pauth.describe(ch)
    assert d == {"scheme": "digest", "qop": "auth", "algorithm": None, "auth_version": "1.1", "stale_on_first": True}
    assert "0123456789abcdef" not in json.dumps(d)  # the nonce is not kept


def test_vendor_slot_refuses_before_any_request(settings, fake):
    a = make(settings, fake, auth="vendor_v1_1")
    with pytest.raises(ApiError) as e:
        a.storage()
    assert e.value.code == "auth_scheme_unsupported"
    assert fake.hits == []


def test_vendor_slot_flow_with_a_stand_in(settings, fake, monkeypatch):
    """The slot's request flow (challenge -> header with nc / cnonce / AuthVersion) works once `response()` is filled."""
    fake.auth = "digest"
    seen = {}

    def response(self, **kw):
        seen.update(kw)
        return "f" * 32

    monkeypatch.setattr(pauth.VendorDigestV11, "IMPLEMENTED", True)
    monkeypatch.setattr(pauth.VendorDigestV11, "response", response)
    a = make(settings, fake, auth="vendor_v1_1")
    assert a.storage()[0]["status"] == "read/write"  # the fake accepts any Digest header naming the user
    assert seen["uri"] == "/GetDiskInfo" and seen["qop"] == "auth" and seen["nc"] == "00000001" and len(seen["cnonce"]) == 32


def test_basic_over_https(settings, fake):
    a = make(settings, fake, scheme="https", https_port=8443, tls_verify=False)
    assert a.health().online
    assert a.transport_info()["insecure"] is False and a._base_url().startswith("https://")


# ---------------------------------------------------------------------------------------------- warnings

def test_insecure_warning_and_its_suppression(settings, fake):
    a = make(settings, fake)
    a.health()
    w = a.warnings()
    assert [x["code"] for x in w] == ["basic_over_http"] and w[0]["dismissible"] is True
    pisr.clear_auth_cache()
    quiet = make(settings, fake, suppress_insecure_warning=True)
    quiet.health()
    assert quiet.warnings() == []
    pisr.clear_auth_cache()
    fake.auth = "digest"
    d = make(settings, fake)
    d.health()
    assert d.warnings() == []


def test_vendor_auth_version_info(settings, fake, monkeypatch):
    fake.auth = "digest"
    real = fake._challenge
    monkeypatch.setattr(fake, "_challenge", lambda request: httpx.Response(
        401, headers={"WWW-Authenticate": 'Digest realm="Web Service", qop="auth", nonce="n1", stale="TRUE", AuthVersion="1.1"'}, request=request))
    a = make(settings, fake)
    a.health()
    assert a.transport_info()["challenge"]["auth_version"] == "1.1"
    assert "vendor_auth_version" in [x["code"] for x in a.warnings()]
    fake._challenge = real


# ---------------------------------------------------------------------------------------------- encoding write (adapter)

def test_writes_are_off_by_default(settings, fake):
    a = make(settings, fake)
    assert a.capabilities().write_encodings is False
    with pytest.raises(ApiError) as e:
        a.write_stream_encoding("101", "x" * 16, "<item id=\"1\"/>", "direct")
    assert e.value.details["reason"] == "writes_disabled" and fake.writes == []


def test_write_applies_and_keeps_siblings(settings, fake):
    a = writer(settings, fake)
    assert a.capabilities().write_encodings is True
    snap = a.read_stream("101")
    opts = a.stream_options("101")
    assert opts.writable and opts.write_via == "direct"
    item = a.stream_document(snap.element, {"bitrate_kbps": 2048, "gop": 75, "quality": 5})
    out = a.write_stream_encoding("101", snap.etag, item, "direct")
    assert (out.verified.parsed["bitrate_kbps"], out.verified.parsed["gop"], out.verified.parsed["quality_raw"]) == (2048, 75, "highest")
    assert out.verified.etag != snap.etag and fake.writes == ["SetVideoStreamConfig"]
    body = fake.set_bodies[0]
    assert "<streams>" in body and 'type="' not in body and "min=" not in body, "no attributes (guide 3.3.4)"
    assert body.count("<item id=") == 3, "every stream of the channel is sent"
    assert a.read_stream("102").parsed["bitrate_kbps"] == 512, "siblings unchanged"


def test_codec_and_smart_codec_tokens(settings, fake):
    a = writer(settings, fake)
    snap = a.read_stream("101")
    a.write_stream_encoding("101", snap.etag, a.stream_document(snap.element, {"codec": "H.264", "smart_codec": True}), "direct")
    p = a.read_stream("101").parsed
    assert (p["codec"], p["smart_codec"], p["codec_raw"]) == ("H.264", True, "h264plus")
    snap = a.read_stream("102")
    a.write_stream_encoding("102", snap.etag, a.stream_document(snap.element, {"codec": "MJPEG"}), "direct")
    p = a.read_stream("102").parsed
    assert p["codec"] == "MJPEG" and p["profile"] is None


def test_stream_document_refuses_unwritable_values(settings, fake):
    a = writer(settings, fake)
    el = a.read_stream("102").element
    for bad in ({"codec": "H.264", "smart_codec": True}, {"svc": False}, {"fps": "full"}, {"resolution": "1080p"}, {"profile": "extended"}):
        with pytest.raises(ApiError) as e:
            a.stream_document(el, bad)
        assert e.value.code == "value_not_allowed"
    assert fake.writes == []


def test_stale_etag_and_fps_over_the_resolution_limit(settings, fake):
    a = writer(settings, fake)
    snap = a.read_stream("101")
    with pytest.raises(ApiError) as e:
        a.write_stream_encoding("101", "0" * 16, snap.element, "direct")
    assert e.value.code == "stale"
    with pytest.raises(ApiError) as e:
        a.write_stream_encoding("101", snap.etag, a.stream_document(snap.element, {"fps": 30}), "direct")  # 2592x1520 max 25
    assert e.value.code == "value_not_allowed" and fake.writes == []


def test_device_outcomes_ignore_partial_reject_unknown(settings, fake):
    a = writer(settings, fake)
    fake.set_effect = "ignore"
    snap = a.read_stream("101")
    out = a.write_stream_encoding("101", snap.etag, a.stream_document(snap.element, {"gop": 60}), "direct")
    assert out.verified.parsed["gop"] == 50, "accepted but nothing changed: the service classifies no_effect"
    fake.set_effect = "partial"
    out = a.write_stream_encoding("101", snap.etag, a.stream_document(snap.element, {"gop": 60, "bitrate_kbps": 2048}), "direct")
    assert (out.verified.parsed["gop"], out.verified.parsed["bitrate_kbps"]) == (50, 2048) or (out.verified.parsed["gop"], out.verified.parsed["bitrate_kbps"]) == (60, 3072)
    fake.set_effect = "apply"
    fake.fail["SetVideoStreamConfig"] = 3
    snap = a.read_stream("101")
    with pytest.raises(ApiError) as e:
        a.write_stream_encoding("101", snap.etag, a.stream_document(snap.element, {"gop": 70}), "direct")
    assert e.value.code == "nvr_rejected"
    del fake.fail["SetVideoStreamConfig"]
    fake.set_after = "drop"
    with pytest.raises(ApiError) as e:
        a.write_stream_encoding("101", snap.etag, a.stream_document(snap.element, {"gop": 70}), "direct")
    assert e.value.code == "source_unavailable" and e.value.details["outcome"] == "unknown" and e.value.retryable is False


def test_parse_element_and_registry_encoding_of_a_written_item(settings, fake):
    a = writer(settings, fake)
    item = a.stream_document(a.read_stream("102").element, {"gop": 20})
    p = a.parse_element(item)
    assert (p["stream_id"], p["gop"], p["codec"]) == (2, 20, "H.264")
    reg = a.registry_encoding(item)
    assert reg["codec"] == "H.264" and reg["webrtc"] == "ok" and reg["source"] == "provision_isr"


# ---------------------------------------------------------------------------------------------- the shared route

def add_camera(settings, cid="pcam1", channel=1):
    with Database(settings.db_path).connection() as conn:
        autosync.ensure_recorder(conn)
        now = now_iso()
        conn.execute("INSERT INTO cameras(id, recorder_id, channel, name_source, sort_order, main_track, sub_track, capabilities_json, status, created_at, updated_at) "
                     "VALUES (?, 'nvr-1', ?, 'Entrance', 1, NULL, NULL, '{}', 'online', ?, ?)", (cid, channel, now, now))


@pytest.fixture()
def app_w(settings, fake, monkeypatch):
    from smplwise.main import create_app

    fake.install(monkeypatch)
    monkeypatch.setitem(registry.VENDORS, "provision_isr", pisr.ProvisionIsrAdapter)
    s = settings_for(settings, writes_enabled=True, auth="basic", osd_names=False)
    app = create_app(s)
    with TestClient(app) as c:
        add_camera(s)
        yield app, c, s


def test_route_write_records_change_audit_and_registry(app_w, fake):
    app, c, s = app_w
    probe = pisr.ProvisionIsrAdapter("nvr-1", s)
    snap = probe.read_stream("101")
    fake.writes.clear()
    r = c.put("/api/v1/nvr/cameras/pcam1/streams/101", json={"if_match": snap.etag, "confirm": True, "changes": {"bitrate_kbps": 2048}})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["change"]["status"] == "applied" and body["applied_fields"] == ["bitrate_kbps"]
    assert fake.writes == ["SetVideoStreamConfig"]
    with app.state.db.connection(mode="read") as conn:
        caps = json.loads(conn.execute("SELECT capabilities_json FROM cameras WHERE id = 'pcam1'").fetchone()["capabilities_json"])
        audit = [r["action"] for r in conn.execute("SELECT action FROM audit_log WHERE action = 'nvr.stream.write'").fetchall()]
    assert caps["encoding"]["main"]["source"] == "provision_isr" and len(audit) >= 2
    # undo through the same seam
    change_id = body["change"]["id"]
    r = c.post(f"/api/v1/nvr/changes/{change_id}/rollback", json={"confirm": True})
    assert r.status_code == 201, r.text
    assert r.json()["change"]["status"] == "applied" and r.json()["change"]["fields"] == {"bitrate_kbps": [2048, 3072]}
    assert probe.read_stream("101").parsed["bitrate_kbps"] == 3072


def test_route_refuses_when_writes_disabled(settings, fake, monkeypatch):
    from smplwise.main import create_app

    fake.install(monkeypatch)
    monkeypatch.setitem(registry.VENDORS, "provision_isr", pisr.ProvisionIsrAdapter)
    s = settings_for(settings, auth="basic", osd_names=False)
    app = create_app(s)
    with TestClient(app) as c:
        add_camera(s)
        snap = pisr.ProvisionIsrAdapter("nvr-1", s).read_stream("101")
        r = c.put("/api/v1/nvr/cameras/pcam1/streams/101", json={"if_match": snap.etag, "confirm": True, "changes": {"gop": 60}})
    assert r.status_code == 503 and r.json()["code"] == "capabilities_unreadable"
    assert "SetVideoStreamConfig" not in fake.writes


# ---------------------------------------------------------------------------------------------- push configuration

def test_push_config_read_and_gated_write(settings, fake):
    a = make(settings, fake)
    assert a.push_config() == {"configured": False, "port": 8010, "heartbeat": False, "heartbeat_s": 30}
    with pytest.raises(ApiError):
        a.configure_push("arx.test", 8099)
    assert "SetAlarmServerConfig" not in fake.writes
    w = writer(settings, fake)
    assert w.configure_push("arx.test", 8099, heartbeat_s=20) == {"applied": True, "port": 8099, "heartbeat_s": 20}
    assert w.push_config()["configured"] is True and "address" not in w.push_config()
    with pytest.raises(ApiError):
        w.configure_push("bad host!", 8099)


def test_event_mode_selects_capability(settings, fake):
    assert make(settings, fake).capabilities().events == "poll"
    assert make(settings, fake, event_mode="push").capabilities().events == "push"
    assert make(settings, fake, event_mode="weird").event_mode() == "poll"


# ---------------------------------------------------------------------------------------------- push receiver / listener

V1_STATUS = b"""<config version="1.0" xmlns="http://www.ipc.com/ver10"><alarmStatusInfo><motionAlarm type="boolean" id="2">true</motionAlarm></alarmStatusInfo>
<dataTime><![CDATA[2026-10-04 12:00:00]]></dataTime><deviceInfo><deviceName><![CDATA[x]]></deviceName><sn><![CDATA[SERIAL]]></sn></deviceInfo></config>"""
V1_CLEAR = V1_STATUS.replace(b">true<", b">false<")
V1_BEAT = b"""<config version="1.0" xmlns="http://www.ipc.com/ver10"><deviceInfo><deviceName><![CDATA[x]]></deviceName></deviceInfo></config>"""
V2_STATUS = b"""<config version="2.0.0" xmlns="http://www.ipc.com/ver10"><messageType>alarmStatus</messageType><deviceInfo><channelId>4</channelId></deviceInfo>
<currentTime>1759575600000000</currentTime><alarmStatusInfo><perimeterAlarm><item>true</item></perimeterAlarm></alarmStatusInfo></config>"""


def test_receiver_edges_heartbeat_and_v2():
    t = [0.0]
    rx = PushReceiver("nvr-2", heartbeat_s=10, clock=lambda: t[0])
    assert rx.stale()
    a = rx.handle("/SendAlarmStatus", V1_STATUS)
    assert [(x.raw_type, x.state, x.channel, x.device_time) for x in a] == [("VMD", "active", 2, "2026-10-04 12:00:00")]
    assert "SERIAL" not in repr(a[0].raw_tags)
    assert rx.handle("/SendAlarmStatus", V1_BEAT) == [] and not rx.stale()
    t[0] = 31
    assert rx.stale()
    assert [(x.state, x.channel) for x in rx.handle("/SendAlarmStatus", V1_CLEAR)] == [("inactive", 2)]
    v2 = rx.handle("/", V2_STATUS)
    assert [(x.raw_type, x.channel) for x in v2] == [("fielddetection", 4)]
    assert rx.handle("/SendAlarmStatus", b"not xml") == [] and rx.invalid == 1
    assert rx.handle("/SendAlarmData", b"<big/>") == [] and rx.handle("/SubscribeTimeOut", b"") == [] and rx.timeouts == 1


def _post(port: int, path: str, body: bytes) -> int:
    with httpx.Client(timeout=5) as c:
        return c.post(f"http://127.0.0.1:{port}{path}", content=body).status_code


def test_listener_routes_by_source_and_refuses_others():
    got = []
    rx = PushReceiver("nvr-2")
    lst = PushListener({"127.0.0.1": rx}, lambda rid, alerts: got.append((rid, [a.raw_type for a in alerts])), host="127.0.0.1", port=0)
    lst.start()
    try:
        assert _post(lst.port, "/SendAlarmStatus", V1_STATUS) == 200
        assert _post(lst.port, "/Other", V1_STATUS) == 404
        with httpx.Client(timeout=5) as c:
            assert c.get(f"http://127.0.0.1:{lst.port}/SendAlarmStatus").status_code == 405
        assert _post(lst.port, "/SendAlarmStatus", b"x" * (600 * 1024)) == 413
    finally:
        lst.stop()
    assert got == [("nvr-2", ["VMD"])]
    other = PushListener({"192.0.2.10": PushReceiver("nvr-3")}, lambda rid, alerts: got.append(rid), host="127.0.0.1", port=0)
    other.start()
    try:
        assert _post(other.port, "/SendAlarmStatus", V1_STATUS) == 403 and other.refused == 1
    finally:
        other.stop()


# ---------------------------------------------------------------------------------------------- smart events

def test_smart_events_from_support_flags(settings, fake):
    a = make(settings, fake)
    kinds = a.smart_events()
    assert kinds[:2] == ["motionAlarm", "sensorAlarmIn"]
    assert "perimeterAlarm" not in kinds  # the fake NVR states no smart support
    info = dict(a.device_info())
    info["support"] = {"supportpea": True, "supportvfd": True, "supportloitering": True, "supportcpc": False}
    a._info = info
    assert a.smart_events() == ["motionAlarm", "sensorAlarmIn", "loiteringAlarm", "tripwireAlarm", "vfdAlarm"]
    assert a.subscribe_types() == ("MOTION", "SENSOR", "PEA", "VFD")


def test_every_mapped_kind_produces_an_event():
    tr = pisr.AlarmTracker()
    status = {(k, None if k == "sensorAlarmIn" else 1): True for k in pisr.ALARM_TYPES}
    out = tr.update(status)
    assert len(out) == len(pisr.ALARM_TYPES) and all(o.raw_tags["kind"] in pisr.ALARM_TYPES for o in out)


# ---------------------------------------------------------------------------------------------- registry seam

def test_register_is_a_no_op_without_the_seam(monkeypatch):
    monkeypatch.delattr(registry, "register_vendor", raising=False)
    assert pisr.register() is None
    assert "provision_isr" not in registry.VENDORS or registry.VENDORS["provision_isr"] is not pisr.ProvisionIsrAdapter


def test_register_through_the_seam_keeps_coming_soon(monkeypatch):
    calls = []
    monkeypatch.setattr(registry, "register_vendor", lambda spec, ctor: calls.append((spec, ctor)) or (lambda: None), raising=False)
    undo = pisr.register()
    assert callable(undo)
    spec, ctor = calls[0]
    assert ctor is pisr.ProvisionIsrAdapter and spec.status == "planned" and spec.id == "provision_isr"
    keys = [f.key for f in spec.fields]
    assert {"host", "password", "scheme", "event_mode", "suppress_insecure_warning"} <= set(keys)
    pisr.register(selectable=True)
    assert calls[1][0].status == "available"
