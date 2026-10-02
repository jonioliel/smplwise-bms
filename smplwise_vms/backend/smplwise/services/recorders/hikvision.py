"""The Hikvision adapter (CR-020 S1): a thin wrapper over the proven read-only ISAPI code in `services/nvr.py`.
Nothing here writes to the device."""
from __future__ import annotations

import xml.etree.ElementTree as ET

from ...config import Settings
from ...errors import ApiError
from .. import nvr
from .base import ChannelInfo, RecorderCapabilities, RecorderHealth, StreamEncoding


class HikvisionAdapter:
    vendor = "hikvision"

    def __init__(self, recorder_id: str, settings: Settings) -> None:
        self.recorder_id = recorder_id
        self._settings = settings

    def capabilities(self) -> RecorderCapabilities:
        # S1: reading only. The write abilities are declared true by the S2 / S3 slices once their guarded paths exist.
        return RecorderCapabilities(
            vendor=self.vendor, read_encodings=True, write_encodings=False, encoding_fields=frozenset(nvr.ENCODING_FIELDS),
            add_channel=False, remove_channel=False, max_channels=None, live="rtsp", playback="rtsp", events="push",
        )

    def health(self) -> RecorderHealth:
        try:
            info = nvr.device_info(self._settings)
        except ApiError as exc:
            if exc.code == "nvr_not_configured":
                raise
            return RecorderHealth(online=False, model=None, firmware=None, error=exc.code)
        return RecorderHealth(online=True, model=info.get("model") or None, firmware=info.get("firmware") or None, error=None)

    def list_channels(self) -> list[ChannelInfo]:
        return [ChannelInfo(source_ref=str(c.channel), channel=c.channel, name=c.name, online=c.online) for c in nvr.discover_channels(self._settings)]

    def read_stream_encodings(self) -> dict[str, list[StreamEncoding]]:
        xml = nvr.fetch_streaming_document(self._settings)
        try:
            parsed = nvr.parse_streaming_channels_all(xml)
        except ET.ParseError as exc:  # incl. a DOCTYPE (xmlsafe.UnsafeXml): a device answer that is not a streaming list
            raise ApiError(503, "source_invalid", "תשובת ה־NVR אינה מסמך זרמים תקין.", details={"op": "streaming", "error": type(exc).__name__}) from exc
        out: dict[str, list[StreamEncoding]] = {}
        for s in parsed:
            enc = {k: v for k, v in s.items() if k not in ("stream_ref", "channel", "role", "enabled", "fields", "etag")}
            out.setdefault(str(s["channel"]), []).append(StreamEncoding(
                stream_ref=str(s["stream_ref"]), role=s["role"], enabled=s["enabled"], encoding=enc, fields=s["fields"], etag=str(s["etag"]),  # type: ignore[arg-type]
            ))
        return out
