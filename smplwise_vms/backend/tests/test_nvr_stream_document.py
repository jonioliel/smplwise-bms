"""CR-020 S2 (S2-04): the pure pieces of the single-stream write - slicing one <StreamingChannel> out of the LIST as text,
its etag (the same function as the S1 list parser), the text-level edit of its <Video> (every other byte kept, no
re-serialization, nothing but validated values written) and the capability-document parser. Synthetic documents in the lab's
v2.0 shape: no address, serial or MAC."""
from __future__ import annotations

import pytest

from smplwise.errors import ApiError
from smplwise.services import nvr, xmlsafe

ISAPI_NS = 'xmlns="http://www.isapi.org/ver20/XMLSchema"'
LIST_NS = 'xmlns="http://www.hikvision.com/ver20/XMLSchema"'


def _stream(sid: str, video: str) -> str:
    return (f'<StreamingChannel version="2.0" {ISAPI_NS}><id>{sid}</id><channelName>{sid}</channelName><enabled>true</enabled>'
            "<Transport><ControlProtocolList><ControlProtocol><streamingTransport>RTSP</streamingTransport></ControlProtocol></ControlProtocolList></Transport>"
            f"<Video><enabled>true</enabled><dynVideoInputChannelID>{sid[:-2]}</dynVideoInputChannelID>{video}</Video>"
            "<Audio><enabled>true</enabled><audioCompressionType>G.711ulaw</audioCompressionType></Audio></StreamingChannel>")


MAIN = ("<videoCodecType>H.264</videoCodecType><videoResolutionWidth>2560</videoResolutionWidth><videoResolutionHeight>1440</videoResolutionHeight>"
        "<videoQualityControlType>VBR</videoQualityControlType><vbrUpperCap>3072</vbrUpperCap><fixedQuality>60</fixedQuality><maxFrameRate>2500</maxFrameRate>"
        "<GovLength>50</GovLength><H264Profile>High</H264Profile><SVC><enabled>true</enabled><SVCMode>manual</SVCMode></SVC><SmartCodec><enabled>false</enabled></SmartCodec>")
SUB = ("<videoCodecType>H.264</videoCodecType><videoResolutionWidth>640</videoResolutionWidth><videoResolutionHeight>360</videoResolutionHeight>"
       "<videoQualityControlType>CBR</videoQualityControlType><constantBitRate>512</constantBitRate><maxFrameRate>2000</maxFrameRate><GovLength>40</GovLength>"
       "<H264Profile>Baseline</H264Profile><SmartCodec><enabled>false</enabled></SmartCodec>")
LIST = (f'<?xml version="1.0" encoding="UTF-8" ?>\n<StreamingChannelList version="1.0" {LIST_NS}>\n'
        + _stream("101", MAIN) + "\n" + _stream("102", SUB) + "\n" + _stream("1101", MAIN.replace("H.264<", "H.265<").replace("H264Profile", "H265Profile")) + "\n</StreamingChannelList>")


def test_slice_returns_the_exact_text_of_one_element_and_the_same_etag_as_the_list_parser():
    listed = {s["stream_ref"]: s for s in nvr.parse_streaming_channels_all(LIST)}
    for ref in ("101", "102", "1101"):
        el = nvr.slice_stream_element(LIST, ref)
        assert el is not None and el in LIST and el.startswith("<StreamingChannel") and el.endswith("</StreamingChannel>")
        assert ISAPI_NS in el, "the element keeps its own namespace (not the list root's)"
        assert nvr.stream_element_etag(el) == listed[ref]["etag"], "the page's etag, the compared etag and the stored etag are one function"
        assert nvr.parse_stream_element(el)["svc"] == listed[ref]["svc"]
    assert nvr.slice_stream_element(LIST, "103") is None and nvr.slice_stream_element(LIST, "10") is None and nvr.slice_stream_element(LIST, "1") is None
    assert nvr.slice_stream_element("<StreamingChannelList><StreamingChannel><id>101</id><Video>", "101") is None, "an unterminated element is not sliced"
    assert nvr.slice_stream_element(LIST.replace("<id>102</id>", "<channelName>x</channelName><id>102</id>"), "102") is None, "the id must be the first child"


def test_svc_edit_changes_exactly_one_value_and_keeps_every_other_byte():
    el = nvr.slice_stream_element(LIST, "101")
    assert el is not None
    out = nvr.stream_document(el, {"svc": False})
    assert out == el.replace("<SVC><enabled>true</enabled>", "<SVC><enabled>false</enabled>"), "one value, text level"
    assert nvr.parse_stream_element(out)["svc"] is False and nvr.stream_element_etag(out) != nvr.stream_element_etag(el)
    assert "<SmartCodec><enabled>false</enabled>" in out, "the other <enabled> flags are not touched"
    back = nvr.stream_document(out, {"svc": True})
    assert back == el


def test_every_supported_field_and_the_one_cbr_insertion():
    el = nvr.slice_stream_element(LIST, "101")
    assert el is not None
    out = nvr.stream_document(el, {"resolution": "1920x1080", "fps": 12.5, "gop": 25, "quality": 75, "bitrate_kbps": 2048, "smart_codec": True, "profile": "Main"})
    p = nvr.parse_stream_element(out)
    assert (p["resolution"], p["fps"], p["gop"], p["quality"], p["bitrate_kbps"], p["smart_codec"], p["profile"]) == ("1920x1080", 12.5, 25, 75, 2048, True, "Main")
    full = nvr.parse_stream_element(nvr.stream_document(el, {"fps": "full"}))
    assert (full["fps"], full["fps_full"]) == (None, True)
    cbr = nvr.stream_document(el, {"bitrate_mode": "CBR"})
    assert "<videoQualityControlType>CBR</videoQualityControlType><constantBitRate>3072</constantBitRate><vbrUpperCap>" in cbr, "inserted right after the mode, from the VBR cap"
    assert (nvr.parse_stream_element(cbr)["bitrate_mode"], nvr.parse_stream_element(cbr)["bitrate_kbps"]) == ("CBR", 3072)
    cbr2 = nvr.parse_stream_element(nvr.stream_document(el, {"bitrate_mode": "CBR", "bitrate_kbps": 4096}))
    assert cbr2["bitrate_kbps"] == 4096
    h265 = nvr.stream_document(el, {"codec": "H.265", "profile": "Main"})
    assert "<videoCodecType>H.265</videoCodecType>" in h265 and "<H265Profile>Main</H265Profile>" in h265 and "H264Profile" not in h265


def test_fields_the_document_lacks_are_not_supported_and_bad_values_are_refused():
    sub = nvr.slice_stream_element(LIST, "102")
    assert sub is not None
    for change in ({"svc": False}, {"quality": 60}):
        with pytest.raises(ApiError) as e:
            nvr.stream_document(sub, change)
        assert e.value.code == "field_not_supported", change
    for change in ({"codec": "H.264</videoCodecType><x>"}, {"profile": "Main<!--"}, {"codec": "a" * 40}, {"resolution": "1920x1080<"}, {"gop": -1},
                   {"gop": True}, {"fps": "fast"}, {"svc": "false"}, {"bitrate_mode": "ABR"}, {"bitrate_kbps": 0}):
        with pytest.raises(ApiError) as e:
            nvr.stream_document(nvr.slice_stream_element(LIST, "101") or "", change)
        assert e.value.code in ("value_not_allowed", "field_not_supported"), change
    with pytest.raises(ApiError) as e:
        nvr.stream_document(sub, {"b_frames": False})
    assert e.value.code == "field_not_supported", "S2 writes no B-frame element"


CAPS = (f'<StreamingChannel version="2.0" {ISAPI_NS}><id>101</id><Video>'
        '<videoCodecType opt="H.264,H.265,bad value,&lt;x&gt;">H.264</videoCodecType>'
        '<videoResolutionWidth opt="2560,1920,1280">2560</videoResolutionWidth><videoResolutionHeight opt="1440,1080,720">1440</videoResolutionHeight>'
        '<videoQualityControlType opt="CBR,VBR">VBR</videoQualityControlType><constantBitRate min="32" max="16384">2048</constantBitRate>'
        '<fixedQuality opt="10,30,45,60,75,90">60</fixedQuality><maxFrameRate opt="2500,1250,100,50,0">2500</maxFrameRate><GovLength min="1" max="400">50</GovLength>'
        '<H264Profile opt="Baseline,Main,High">High</H264Profile><H265Profile opt="Main">Main</H265Profile>'
        '<SVC><enabled opt="true,false">true</enabled></SVC><SmartCodec><enabled opt="true,false">false</enabled></SmartCodec></Video></StreamingChannel>')


def test_capability_document_to_options():
    o = nvr.parse_stream_capabilities(CAPS)
    assert o["codec"] == ["H.264", "H.265"], "tokens outside the strict alphabet are dropped"
    assert o["resolution"] == {"H.264": ["2560x1440", "1920x1080", "1280x720"], "H.265": ["2560x1440", "1920x1080", "1280x720"]}, "width/height paired by position"
    assert o["profile"] == {"H.264": ["Baseline", "Main", "High"], "H.265": ["Main"]}
    assert (o["fps"], o["fps_full"]) == ([25.0, 12.5, 1.0, 0.5], True)
    assert (o["bitrate_mode"], o["bitrate_kbps"], o["quality"], o["gop"]) == (["CBR", "VBR"], {"min": 32, "max": 16384}, [10, 30, 45, 60, 75, 90], {"min": 1, "max": 400})
    assert (o["svc"], o["smart_codec"], o["b_frames"], o["locks"]) == (True, True, False, {"smart_codec": ["gop", "bitrate_mode", "quality"]})
    bare = nvr.parse_stream_capabilities(f"<StreamingChannel {ISAPI_NS}><Video><videoCodecType>H.264</videoCodecType></Video></StreamingChannel>", "H.264")
    assert (bare["codec"], bare["svc"], bare["bitrate_kbps"], bare["fps"], bare["locks"]) == (["H.264"], False, None, [], {})
    with pytest.raises(xmlsafe.UnsafeXml):
        nvr.parse_stream_capabilities('<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "b">]><x/>')


def test_dynamic_cap_resolutions():
    doc = "<DynamicCap><ResolutionAvailableDscriptorList><ResolutionAvailableDscriptor><resolution>2560*1440</resolution></ResolutionAvailableDscriptor>" \
          "<ResolutionAvailableDscriptor><resolution>1920x1080</resolution></ResolutionAvailableDscriptor><ResolutionAvailableDscriptor><resolution>bad</resolution>" \
          "</ResolutionAvailableDscriptor></ResolutionAvailableDscriptorList></DynamicCap>"
    assert nvr.parse_dynamic_resolutions(doc) == ["2560x1440", "1920x1080"]
