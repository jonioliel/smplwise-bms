"""LIVE-H265-2341: live video of a camera whose stream is H.265, in a browser that cannot decode H.265.

The azia lab (2026-11-01, private/planning/AZIA_LIVE_DIAG_2026-11-01_HE.md section 7): every `smplwise_` stream of the
recorder returned frames, yet some tiles stayed black - the recorder reports H.265 on those channels, and Chrome / Edge
do not decode H.265 over WebRTC (and over MSE only with hardware support). Nothing here changes the recorder's encoding.

What a live socket does (routers/media.py `live_ws`):
  - the player says, per attempt, whether this browser decodes H.265 over the transport it is about to use
    (`?h265=1|0`, frontend/src/api/h265-support.ts). Without the parameter (an older client) nothing changes;
  - the codec of each profile comes from the camera registry (`capabilities_json.encoding`, services/stream_codecs.py,
    filled by the discovery from the recorder - for Provision the cached GetStreamCaps / stream encodings), and when the
    registry does not know it, from what go2rtc's producer reported after a first connect (go2rtc.producer_video_codec);
  - `choose` picks, under the installation setting `media.h265_policy`:
      auto       (default) the other profile when it is H.264 (usually the sub stream), else an H.264 variant that
                 go2rtc transcodes (`smplwise_<recorder>_ch<n>_<profile>_h264`), else refused with a Hebrew reason
                 (the player then tries its next step - MSE when the transport choice allows it - or shows the message);
      sub        only the other profile;
      transcode  only the transcoded variant;
      off        the stream as it is (today's behaviour);
  - transcoding is CPU-heavy on the go2rtc host: at most `media.h265_max_transcodes` (default 2, 0 = never) distinct
    transcoded streams run at once (TranscodeBudget; several viewers of one transcoded stream share go2rtc's one ffmpeg).
    Beyond the cap the socket is refused with `transcode_cap` and the tile keeps a refreshing snapshot with a notice.

The transcoded stream is one of OUR streams (the `smplwise_` namespace, a name derived from the camera's own stream name)
and its source names only that stream (`ffmpeg:<our stream>#video=h264`) - no address, no credentials. It is written to
go2rtc through the same `Go2rtc.ensure_stream` as every other stream, only when a viewer needs it; nothing outside the
namespace is ever created, changed or deleted.
"""
from __future__ import annotations

import json
import threading
from dataclasses import dataclass, field
from typing import Any

from . import go2rtc as g2

POLICIES = ("auto", "sub", "transcode", "off")
DEFAULT_POLICY = "auto"
DEFAULT_MAX_TRANSCODES = 2
MAX_TRANSCODES_LIMIT = 16
TRANSCODE_SUFFIX = "_h264"
PROFILES = ("main", "sub")

H265_ALTERNATE_HE = "הדפדפן לא תומך בקידוד H.265 של המצלמה; מוצג זרם חלופי"
H265_TRANSCODED_HE = "הדפדפן לא תומך בקידוד H.265 של המצלמה; מוצג זרם חלופי (תרגום ל-H.264)"
H265_UNSUPPORTED_HE = "הדפדפן לא תומך בקידוד H.265 של המצלמה; אין זרם חלופי"
TRANSCODE_CAP_HE = "הדפדפן לא תומך בקידוד H.265 של המצלמה, ומכסת התרגומים במקביל ({cap}) מלאה; מוצגת תמונה מתעדכנת"


def codec_family(enc: dict[str, Any] | None) -> str | None:
    """`h264` | `h265` | `mjpeg` | `other` for one registry entry (`{"codec": "H.265", "codec_raw": "H.265+", ...}`), None
    when it says nothing. The vendors' "+" / smart variants (H.264+, H.265+, SmartH265) are the same family."""
    if not isinstance(enc, dict):
        return None
    raw = enc.get("codec") or enc.get("codec_raw")
    if not raw:
        return "h265" if enc.get("reason") == "h265" else None
    n = str(raw).strip().lower().replace(".", "").replace("+", "").replace("-", "").replace(" ", "").replace("smart", "")
    if n in ("h264", "avc", "avc1"):
        return "h264"
    if n in ("h265", "hevc", "hvc1", "hev1"):
        return "h265"
    if n in ("mjpeg", "jpeg", "mjpg"):
        return "mjpeg"
    return "other"


def registry_codecs(cam: Any) -> dict[str, str | None]:
    """The codec family of each profile of one camera row, from its registry entry (`capabilities_json.encoding`)."""
    try:
        caps = json.loads(cam["capabilities_json"] or "{}")
    except (ValueError, TypeError, KeyError, IndexError):
        caps = {}
    enc = caps.get("encoding") if isinstance(caps, dict) else None
    enc = enc if isinstance(enc, dict) else {}
    return {p: codec_family(enc.get(p)) for p in PROFILES}


def merge_observed(codecs: dict[str, str | None], observed: dict[str, str | None]) -> dict[str, str | None]:
    """What go2rtc's producer reported wins over the registry (it is the stream as it really runs); a profile go2rtc has
    not connected yet keeps the registry's value."""
    return {p: (observed.get(p) or codecs.get(p)) for p in PROFILES}


def other_profile(profile: str) -> str:
    return "sub" if profile == "main" else "main"


def transcode_stream_name(recorder_id: str, channel: int, profile: str) -> str:
    """`smplwise_<recorder>_ch<n>_<profile>_h264`: derived from the camera's own stream name, so always in our namespace
    (and never in the Home Assistant cameras' `smplwise_ha_` one, which stream_name refuses)."""
    name = f"{g2.stream_name(recorder_id, channel, profile)}{TRANSCODE_SUFFIX}"
    if not name.startswith(g2.STREAM_PREFIX) or not g2.NAME_RE.match(name):
        raise ValueError(name)
    return name


def is_transcode_stream(name: str) -> bool:
    return name.startswith(g2.STREAM_PREFIX) and not name.startswith(g2.HA_STREAM_PREFIX) and name.endswith(TRANSCODE_SUFFIX)


def transcode_source(base_name: str) -> str:
    """go2rtc's own transcoding of one of our streams to H.264 (its ffmpeg source over a stream name). Only ever one of
    our stream names: the source never carries an address or a credential."""
    if not base_name.startswith(g2.STREAM_PREFIX) or not g2.NAME_RE.match(base_name) or base_name.endswith(TRANSCODE_SUFFIX):
        raise ValueError("a transcode source must name one of our own (untranscoded) streams")
    return f"ffmpeg:{base_name}#video=h264"


@dataclass(frozen=True)
class Choice:
    """What a live socket opens. `kind`: `native` (the requested stream), `other_profile`, `transcode` (the H.264 variant
    of `profile`), `unsupported` (nothing this browser can play: `message`)."""

    kind: str
    profile: str
    variant: str = ""
    message: str = ""
    codec: str | None = None

    @property
    def fallback(self) -> bool:
        return self.kind in ("other_profile", "transcode")


def normalize_policy(value: Any) -> str:
    v = str(value or "").strip().lower()
    return v if v in POLICIES else DEFAULT_POLICY


def choose(policy: str, requested: str, codecs: dict[str, str | None], can_h265: bool | None, *, max_transcodes: int = DEFAULT_MAX_TRANSCODES) -> Choice:
    """The stream a viewer gets. `can_h265` None = the client did not say (an older player): the stream as it is.
    An unknown codec is played as it is (the player's own fallback chain still applies)."""
    policy = normalize_policy(policy)
    codec = codecs.get(requested)
    if policy == "off" or can_h265 is None or can_h265 or codec != "h265":
        return Choice("native", requested, codec=codec)
    other = other_profile(requested)
    if policy in ("auto", "sub") and codecs.get(other) == "h264":
        return Choice("other_profile", other, message=H265_ALTERNATE_HE, codec="h264")
    if policy in ("auto", "transcode") and max_transcodes > 0:
        return Choice("transcode", requested, variant="h264", message=H265_TRANSCODED_HE, codec="h264")
    return Choice("unsupported", requested, message=H265_UNSUPPORTED_HE, codec=codec)


@dataclass
class TranscodeBudget:
    """At most `cap` distinct transcoded streams at once (go2rtc runs one ffmpeg per stream, shared by its viewers). A
    viewer of a stream that is already being transcoded never counts against the cap. Thread-safe: a socket acquires before
    the stream is created and releases when it ends."""

    held: dict[str, str] = field(default_factory=dict)  # token -> transcoded stream name
    lock: threading.Lock = field(default_factory=threading.Lock)

    def active(self) -> set[str]:
        with self.lock:
            return set(self.held.values())

    def acquire(self, token: str, stream: str, cap: int) -> bool:
        with self.lock:
            running = set(self.held.values())
            if stream not in running and len(running) >= max(0, int(cap)):
                return False
            self.held[token] = stream
            return True

    def release(self, token: str) -> None:
        with self.lock:
            self.held.pop(token, None)


BUDGET = TranscodeBudget()
