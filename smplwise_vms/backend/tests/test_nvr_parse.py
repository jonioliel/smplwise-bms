"""ISAPI XML parsing on synthetic documents shaped like the lab captures (no device needed)."""
from __future__ import annotations

from smplwise.services import nvr

CHANNELS = """<?xml version="1.0" encoding="UTF-8"?>
<InputProxyChannelList version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
<InputProxyChannel><id>1</id><name>Camera 01</name></InputProxyChannel>
<InputProxyChannel><id>2</id><name>Lobby  cam</name></InputProxyChannel>
</InputProxyChannelList>"""

STATUS = """<InputProxyChannelStatusList xmlns="http://www.hikvision.com/ver20/XMLSchema">
<InputProxyChannelStatus><id>1</id><online>true</online></InputProxyChannelStatus>
<InputProxyChannelStatus><id>2</id><online>false</online></InputProxyChannelStatus>
</InputProxyChannelStatusList>"""

TRACKS = """<TrackList xmlns="http://www.hikvision.com/ver20/XMLSchema">
<Track><id>101</id><Channel>101</Channel><Description>trackType=standard,contentType=video,codecType=H.264-BP,resolution=2560x1440,framerate=25.0 fps,bitrate=3072 kbps</Description><SrcDescriptor><SrcChannel>1</SrcChannel></SrcDescriptor></Track>
<Track><id>102</id><Channel>102</Channel><SrcDescriptor><SrcChannel>1</SrcChannel></SrcDescriptor></Track>
<Track><id>201</id><Channel>201</Channel><SrcDescriptor><SrcChannel>2</SrcChannel></SrcDescriptor></Track>
</TrackList>"""


def test_discover_channels_parses_namespaced_xml(monkeypatch):
    responses = {"/ISAPI/ContentMgmt/InputProxy/channels": CHANNELS, "/ISAPI/ContentMgmt/InputProxy/channels/status": STATUS, "/ISAPI/ContentMgmt/record/tracks": TRACKS}

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    monkeypatch.setattr(nvr, "_client", lambda settings: FakeClient())
    monkeypatch.setattr(nvr, "_get", lambda client, path: responses[path])
    chans = nvr.discover_channels(object())  # settings unused by the fakes
    assert [(c.channel, c.name, c.online, c.main_track, c.sub_track) for c in chans] == [
        (1, "Camera 01", True, 101, 102),
        (2, "Lobby cam", False, 201, None),
    ]
    assert chans[0].stream == {"codec": "H.264-BP", "resolution": "2560x1440", "fps": 25.0, "bitrate_kbps": 3072}
    assert chans[1].stream is None
