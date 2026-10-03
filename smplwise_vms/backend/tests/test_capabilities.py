"""T045 / T012 (read-only half): capability facts per camera come from the NVR itself — PTZ supported only when the
device says so, 'unsupported' only on the device's notSupport, otherwise 'unknown' with the reason; the preset list
is read, never recalled; two-way audio is available / disabled / unsupported / unknown; nothing here writes."""
from __future__ import annotations

import httpx
from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.routers import cameras as cameras_router
from smplwise.services import nvr

PRESETS_EMPTY = """<?xml version="1.0" encoding="UTF-8" ?>
<PTZPresetList version="1.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
</PTZPresetList>"""
PRESETS = """<?xml version="1.0" encoding="UTF-8" ?>
<PTZPresetList version="1.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
<PTZPreset><enabled>true</enabled><id>1</id><presetName>כניסה</presetName></PTZPreset>
<PTZPreset><enabled>true</enabled><id>7</id><presetName>חניה</presetName></PTZPreset>
</PTZPresetList>"""
AUDIO = """<?xml version="1.0" encoding="UTF-8" ?>
<TwoWayAudioChannelList version="1.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
<TwoWayAudioChannel><id>1</id><enabled>false</enabled><audioCompressionType>G.711ulaw</audioCompressionType></TwoWayAudioChannel>
<TwoWayAudioChannel><id>1001</id><enabled>false</enabled><audioCompressionType>G.711ulaw</audioCompressionType>
<associateVideoInputs><enabled>true</enabled><videoInputChannelList><videoInputChannelID>1</videoInputChannelID></videoInputChannelList></associateVideoInputs></TwoWayAudioChannel>
<TwoWayAudioChannel><id>2002</id><enabled>true</enabled><audioCompressionType>G.711alaw</audioCompressionType>
<associateVideoInputs><enabled>true</enabled><videoInputChannelList><videoInputChannelID>2</videoInputChannelID></videoInputChannelList></associateVideoInputs></TwoWayAudioChannel>
</TwoWayAudioChannelList>"""
NOT_SUPPORT = """<?xml version="1.0" encoding="UTF-8" ?>
<ResponseStatus version="1.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
<requestURL>/ISAPI/PTZCtrl/channels/1/capabilities</requestURL>
<statusCode>4</statusCode><statusString>Invalid Operation</statusString><subStatusCode>notSupport</subStatusCode>
</ResponseStatus>"""
FORBIDDEN = """<?xml version="1.0" encoding="UTF-8" ?>
<ResponseStatus version="1.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
<statusCode>3</statusCode><statusString>Device Error</statusString><subStatusCode>noPermission</subStatusCode>
</ResponseStatus>"""


def test_parsers_on_lab_shaped_samples():
    assert nvr.parse_presets(PRESETS_EMPTY) == []
    assert nvr.parse_presets(PRESETS) == [{"id": "1", "name": "כניסה"}, {"id": "7", "name": "חניה"}]
    assert nvr.parse_two_way_audio(AUDIO, 1) == {"channel_id": "1001", "enabled": False, "codec": "G.711ulaw"}
    assert nvr.parse_two_way_audio(AUDIO, 2) == {"channel_id": "2002", "enabled": True, "codec": "G.711alaw"}
    assert nvr.parse_two_way_audio(AUDIO, 9) is None


def _fake_nvr(answers: dict[str, tuple[int, str]]):
    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        for key, (code, body) in answers.items():
            if path.endswith(key):
                return httpx.Response(code, text=body)
        return httpx.Response(404, text="")

    return httpx.MockTransport(handler)


def test_fetch_capabilities_states(monkeypatch, settings):
    from dataclasses import replace

    s = replace(settings, nvr_host="nvr.example", nvr_user="u", nvr_password="p")

    def client_with(answers):
        def _client(_settings):
            return httpx.Client(base_url="http://nvr.example:90", transport=_fake_nvr(answers))

        monkeypatch.setattr(nvr, "_client", _client)

    # the lab shape: PTZ notSupport (device says so), an empty preset list, an audio channel that exists but is disabled
    client_with({"/capabilities": (403, NOT_SUPPORT), "/presets": (200, PRESETS_EMPTY), "TwoWayAudio/channels": (200, AUDIO)})
    caps = nvr.fetch_capabilities(s, 1)
    assert caps["ptz"]["state"] == "unsupported" and "notSupport" in caps["ptz"]["reason"] and caps["ptz"]["presets"] == [] and caps["ptz"]["preset_count"] == 0
    assert caps["audio"]["state"] == "disabled" and caps["audio"]["channel_id"] == "1001" and caps["audio"]["codec"] == "G.711ulaw"
    # a PTZ camera with presets and enabled audio
    client_with({"/capabilities": (200, "<PTZChanelCap/>"), "/presets": (200, PRESETS), "TwoWayAudio/channels": (200, AUDIO)})
    caps = nvr.fetch_capabilities(s, 2)
    assert caps["ptz"]["state"] == "supported" and caps["ptz"]["preset_count"] == 2 and caps["audio"]["state"] == "available"
    # no permission on the NVR account: unknown, never guessed; no audio channel for the input: unsupported
    client_with({"/capabilities": (403, FORBIDDEN), "/presets": (403, FORBIDDEN), "TwoWayAudio/channels": (200, AUDIO)})
    caps = nvr.fetch_capabilities(s, 9)
    assert caps["ptz"]["state"] == "unknown" and "forbidden" in caps["ptz"]["reason"] and caps["ptz"]["presets"] is None
    assert caps["audio"]["state"] == "unsupported"
    client_with({"/capabilities": (403, FORBIDDEN), "/presets": (403, FORBIDDEN), "TwoWayAudio/channels": (403, FORBIDDEN)})
    assert nvr.fetch_capabilities(s, 1)["audio"]["state"] == "unknown"


def test_capabilities_endpoint_permission_cache_and_no_writes(settings, monkeypatch):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    cam = c.post("/api/v1/cameras", json={"channel": 4, "alias": "גג"}).json()["id"]
    calls: list[int] = []

    def fake_caps(_settings, channel):
        calls.append(channel)
        return {"ptz": {"state": "unsupported", "reason": "device: Invalid Operation / notSupport", "presets": [], "preset_count": 0}, "audio": {"state": "disabled", "reason": "the channel exists but is disabled on the device", "channel_id": "4004", "codec": "G.711ulaw"}}

    monkeypatch.setattr(cameras_router, "CAPS", fake_caps)
    cameras_router._CAPS_CACHE.clear()
    r = c.get(f"/api/v1/cameras/{cam}/capabilities")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["read_only"] is True and d["channel"] == 4 and d["ptz"]["state"] == "unsupported" and d["audio"]["state"] == "disabled"
    assert d["writes"] == {"ptz_move": "not_offered", "preset_recall": "not_offered", "talk": "not_offered", "reason": "device writes need an explicit approval; nothing is simulated"}
    assert d["digital_zoom"] == "browser_only" and d["cached"] is False and calls == [4]
    assert c.get(f"/api/v1/cameras/{cam}/capabilities").json()["cached"] is True and calls == [4]
    assert c.get(f"/api/v1/cameras/{cam}/capabilities?refresh=true").json()["cached"] is False and calls == [4, 4]
    bind(c, settings, "ron", "viewer", "floor", ids["floor3"])
    assert c.get(f"/api/v1/cameras/{cam}/capabilities", headers=as_user("ron")).status_code == 403
    assert c.get("/api/v1/cameras/nope/capabilities").status_code == 404
    # nothing in the API moves a camera, recalls a preset or opens a microphone
    paths = [getattr(r, "path", "") for r in app.routes]
    assert not [p for p in paths if any(k in p.lower() for k in ("ptz", "preset", "talk", "audio/"))]
