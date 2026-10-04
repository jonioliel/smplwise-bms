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
    channels = [nvr.DiscoveredChannel(channel=int(c.channel or c.source_ref), name=c.name, online=c.online, main_track=None, sub_track=None)
                for c in a.list_channels()]
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
        return a.live_source(str(channel), profile)


def snapshot(settings: Settings, recorder_id: str, channel: int) -> bytes:
    return adapter(settings, recorder_id).snapshot(str(channel))
