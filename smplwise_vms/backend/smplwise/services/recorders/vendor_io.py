"""Vendor dispatch for the device reads the multi-NVR background work and media routes make (CR-025 wiring on CR-024).

The CR-020 / CR-024 code paths were written for Hikvision ISAPI (`nvr.discover_channels`, `go2rtc.hikvision_rtsp_url`,
`nvr.fetch_snapshot`, the alert stream). For a recorder whose connection names another vendor, those call sites ask this
module instead; Hikvision recorders take exactly the old path (`handles()` is False for them). Device I/O only, like the
adapters: no SQLite, no audit, no permission decisions."""
from __future__ import annotations

from typing import Any

from ...config import Settings
from .. import nvr
from .provision_isr import VENDOR as PROVISION, ProvisionIsrAdapter


def handles(settings: Settings) -> bool:
    """True when this recorder's connection is a vendor served here (today: Provision-ISR)."""
    return (settings.nvr_vendor or "") == PROVISION


def adapter(settings: Settings, recorder_id: str) -> ProvisionIsrAdapter:
    return ProvisionIsrAdapter(recorder_id, settings)


def _registry_entry(enc: dict[str, Any]) -> dict[str, Any]:
    """A StreamEncoding.encoding of the adapter -> the codec-registry entry shape stream_codecs.build keeps."""
    return {"codec": enc.get("codec"), "codec_raw": enc.get("codec_raw"), "profile": enc.get("profile"), "b_frames": enc.get("b_frames"),
            "svc": enc.get("svc"), "smart_codec": enc.get("smart_codec"), "resolution": enc.get("resolution"), "fps": enc.get("fps"),
            "gov_length": enc.get("gop"), "source": "provision_isr", "webrtc": enc.get("webrtc"), "reason": enc.get("webrtc_reason")}


def discover(settings: Settings, recorder_id: str) -> tuple[dict[str, Any], list[nvr.DiscoveredChannel], dict[int, dict[str, Any]], str | None]:
    """(device info {model, firmware}, channels, encodings {channel: {"main": entry, "sub": entry}}, encodings error code).
    Channel names come from the device (the live NVR's GetChannelList); no recording track ids (Provision playback is
    addressed by channel, CR-025 P3)."""
    from ...errors import ApiError

    a = adapter(settings, recorder_id)
    info = a.device_info(refresh=True)
    # the recording "track" of a Provision camera is its channel: playback, search, thumbnails and exports address the
    # channel (CR-025 P3), so every `main_track` check of the Hikvision paths passes and carries the right number
    channels = [nvr.DiscoveredChannel(channel=int(c.channel or c.source_ref), name=c.name, online=c.online,
                                      main_track=int(c.channel or c.source_ref), sub_track=None) for c in a.list_channels()]
    encodings: dict[int, dict[str, Any]] = {}
    error: str | None = None
    try:
        for ch, streams in a.read_stream_encodings().items():
            by_role = {s.role: _registry_entry(s.encoding) for s in streams if s.role in ("main", "sub")}
            encodings[int(ch)] = by_role
    except ApiError as exc:
        error = exc.code
    return {"model": info.get("model"), "firmware": info.get("firmware")}, channels, encodings, error


class LiveSources:
    """go2rtc sources for one stream sync pass: one adapter per recorder (so GetStreamCaps is read once per channel)."""

    def __init__(self) -> None:
        self._adapters: dict[str, ProvisionIsrAdapter] = {}

    def url(self, settings: Settings, recorder_id: str, channel: int, profile: str) -> str:
        a = self._adapters.get(recorder_id)
        if a is None:
            a = self._adapters[recorder_id] = adapter(settings, recorder_id)
        return go2rtc_source(settings, a.live_source(str(channel), profile))


def snapshot(settings: Settings, recorder_id: str, channel: int) -> bytes:
    return adapter(settings, recorder_id).snapshot(str(channel))



# ---------------------------------------------------------------------------------------------- recordings (P3 wiring)

def playback_service(settings: Settings, recorder_id: str, tz_name: str):
    from .provision_playback import ProvisionPlayback

    return ProvisionPlayback(adapter(settings, recorder_id), tz_name)


def search(settings: Settings, recorder_id: str, channel: int, start, end, tz_name: str):
    """recordings.SearchResult of a Provision camera (device wall clock per the recorder's time basis)."""
    return playback_service(settings, recorder_id, tz_name).search(int(channel), start, end)


def playback_url(settings: Settings, recorder_id: str, channel: int, start, end, tz_name: str) -> str:
    from .provision_playback import rtsp_playback_url

    return rtsp_playback_url(settings, int(channel), start, end, tz_name, recorder_id=recorder_id)


def export_files(settings: Settings, recorder_id: str, channel: int, start, end, tz_name: str):
    return playback_service(settings, recorder_id, tz_name).export_files(int(channel), start, end)


def time_note(settings: Settings, recorder_id: str, tz_name: str) -> dict[str, Any] | None:
    """The recorder's time basis and whether the device clock rule differs from the installation zone - from the cache
    the playback module fills (no device call here; health must stay cheap). None before the first device read."""
    import datetime as dt

    from . import provision_playback as pp
    from . import provision_time as pt

    a = adapter(settings, recorder_id)
    basis = "iana" if str(a._extra.get("time_basis") or "").lower() == "iana" else "device"
    with pp._CACHE_LOCK:
        hit = pp._ZONES.get(a.device_key)
    if hit is None:
        return {"basis": basis, "known": False}
    _exp, tz, source, facts = hit
    now = dt.datetime.now(pt.UTC)
    iana = pt.iana(tz_name)
    differs_now = tz.utcoffset(now.astimezone(tz).replace(tzinfo=None)) != iana.utcoffset(now.astimezone(iana).replace(tzinfo=None))
    periods = pt.divergence(tz, iana, now.year) if source != "iana" else []
    return {"basis": basis, "known": True, "device_rule": facts.get("time_zone"), "source": source, "differs_now": bool(differs_now),
            "differs_periods": len(periods)}



def go2rtc_source(settings: Settings, rtsp_url: str) -> str:
    """The go2rtc source for a Provision RTSP URL. Live finding 2026-10-04 (owner's NVR, HA2's go2rtc 1.9.14): go2rtc's own
    RTSP client gets NO tracks from this NVR (live and playback alike: "codecs not matched:  => ..."), while the same URL
    through go2rtc's ffmpeg source plays (1920x1080 H.264 over MSE in the browser). So the default wraps the URL in
    `ffmpeg:...#video=copy` (no re-encode; audio is not carried yet). `nvr_extra.go2rtc_source = "rtsp"` uses the native
    client for a firmware where it works. Only for go2rtc: thumbnails / frames hand the plain URL to the local ffmpeg."""
    extra = settings.nvr_extra if isinstance(settings.nvr_extra, dict) else {}
    if str(extra.get("go2rtc_source") or "ffmpeg").lower() == "rtsp":
        return rtsp_url
    return f"ffmpeg:{rtsp_url}#video=copy"
