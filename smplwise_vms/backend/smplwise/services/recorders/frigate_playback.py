"""Frigate recordings: coverage, motion density, HLS playlist handling and the playback / clip-export DESIGN (NN5 F1, CR-029).

Pure functions (no I/O): the adapter fetches, this module interprets. AGENTS rules that apply here:
- "Partial recording coverage is not empty coverage": Frigate keeps 10-second segments by policy (continuous / motion / alerts /
  detections retention). A range without segments may be a policy choice, not a fault; `coverage()` returns the ranges, the
  covered ratio and the recording POLICY, so a screen can say "recorded on motion only" instead of "no recording".
- "A playback stream is not automatically a seekable, synchronized browser recording. Prove media anchors, seek generations,
  actual rendered time...": the VOD playlist carries no `EXT-X-PROGRAM-DATE-TIME` in the sample, so the anchor comes from the
  `recordings` segment list; whether the first segment starts before the requested start, and the rendered-time error, are NOT
  PROVEN (`ANCHORS_PROVEN = False`) until the F1-M1 measurement step has been run with a player. The design says so in its output.
- Every media asset is authorised: the playlist rewrite only ever emits URIs under the Arx proxy prefix for names that match the
  VOD asset pattern; a foreign or odd URI in a playlist is refused (`source_invalid`), never forwarded to the browser.
"""
from __future__ import annotations

import re
from typing import Any

from ...errors import ApiError

ANCHORS_PROVEN = False
SEGMENT_GAP_TOLERANCE_S = 12.0     # segments are ~10 s; a hole up to this is the same recording
DENSITY_BUCKET_S = 60
PLAYLIST_MAX_WINDOW_S = 6 * 3600   # one VOD playlist covers at most this
EXPORT_PLAN_MAX_WINDOW_S = 3600    # a clip the design allows (the Arx export store has its own size limits)
EXPORT_PLAN_MAX_BYTES = 2_000_000_000
ASSET_NAME = re.compile(r"^(init-v\d+\.mp4|seg-\d+-v\d+\.m4s)$")
MAP_URI = re.compile(r'(#EXT-X-MAP:.*?URI=")([^"]*)(")')


def recording_policy(retention: dict[str, Any] | None) -> str:
    """`continuous` | `motion` | `events` | `off` | `unknown`, from the scrubbed config summary's retention block."""
    r = retention or {}
    if not r:
        return "unknown"
    if r.get("record_enabled") is False:
        return "off"
    if (r.get("continuous_days") or 0) > 0:
        return "continuous"
    if (r.get("motion_days") or 0) > 0:
        return "motion"
    if (r.get("alerts_days") or 0) > 0 or (r.get("detections_days") or 0) > 0:
        return "events"
    return "unknown"


def _seg(s: dict[str, Any]) -> tuple[float, float, float, float] | None:
    a, b = s.get("start_time"), s.get("end_time")
    if not isinstance(a, (int, float)) or not isinstance(b, (int, float)) or b <= a:
        return None
    m, o = s.get("motion"), s.get("objects")
    return float(a), float(b), float(m) if isinstance(m, (int, float)) else 0.0, float(o) if isinstance(o, (int, float)) else 0.0


def coverage(segments: list[dict[str, Any]], window_start: float, window_end: float, retention: dict[str, Any] | None = None,
             *, gap_tolerance_s: float = SEGMENT_GAP_TOLERANCE_S, bucket_s: int = DENSITY_BUCKET_S) -> dict[str, Any]:
    """Merge `recordings` segments into ranges inside [window_start, window_end].

    Returns {window, ranges [{start, end, seconds, segments, motion, objects}], covered_s, ratio, partial, policy,
    sparse_by_design, density [{start, motion, objects}]}. `partial` is True whenever the window is not fully covered; with a
    non-continuous policy that is EXPECTED (`sparse_by_design`), so a UI must not read it as "no recording"."""
    parts = sorted(p for p in (_seg(s) for s in segments) if p and p[1] > window_start and p[0] < window_end)
    ranges: list[dict[str, Any]] = []
    for a, b, m, o in parts:
        a, b = max(a, window_start), min(b, window_end)
        if ranges and a - ranges[-1]["end"] <= gap_tolerance_s:
            r = ranges[-1]
            r["end"] = max(r["end"], b)
            r["segments"] += 1
            r["motion"] += m
            r["objects"] += o
        else:
            ranges.append({"start": a, "end": b, "segments": 1, "motion": m, "objects": o})
    for r in ranges:
        r["seconds"] = round(r["end"] - r["start"], 1)
    covered = round(sum(r["seconds"] for r in ranges), 1)
    span = max(window_end - window_start, 1e-6)
    policy = recording_policy(retention)
    density: dict[int, list[float]] = {}
    for a, b, m, o in parts:
        k = int((max(a, window_start) - window_start) // bucket_s)
        d = density.setdefault(k, [0.0, 0.0])
        d[0] += m
        d[1] += o
    return {
        "window": {"start": window_start, "end": window_end}, "ranges": ranges, "covered_s": covered, "ratio": round(min(1.0, covered / span), 4),
        "partial": covered < span - gap_tolerance_s, "policy": policy, "sparse_by_design": policy != "continuous", "bucket_s": bucket_s,
        "density": [{"start": window_start + k * bucket_s, "motion": round(v[0], 1), "objects": round(v[1], 1)} for k, v in sorted(density.items())],
    }


def validate_window(start: float, end: float, max_window_s: float, now: float) -> None:
    if not (start < end):
        raise ApiError(422, "window_invalid", "טווח הזמן אינו תקין.", details={"reason": "start_after_end"})
    if end - start > max_window_s:
        raise ApiError(422, "window_too_long", "טווח הזמן ארוך מדי.", details={"max_s": int(max_window_s)})
    if start > now + 60:
        raise ApiError(422, "window_invalid", "טווח הזמן בעתיד.", details={"reason": "future"})


def rewrite_playlist(text: str, prefix: str) -> str:
    """The VOD playlist with every segment / init URI replaced by `prefix + name`. Relative names of the VOD pattern only: an
    absolute URL, a path, a query or any other name is `source_invalid` (the browser must never be sent to Frigate)."""
    if not prefix.endswith("/"):
        raise ValueError("prefix must end with a slash")
    out: list[str] = []
    for line in text.splitlines():
        s = line.strip()
        if not s:
            continue
        if s.startswith("#"):
            m = MAP_URI.search(s)
            if m:
                if not ASSET_NAME.fullmatch(m.group(2)):
                    raise ApiError(503, "source_invalid", "רשימת ההפעלה של Frigate כוללת כתובת לא צפויה.", details={"op": "vod"})
                s = MAP_URI.sub(lambda mm: mm.group(1) + prefix + mm.group(2) + mm.group(3), s)
            out.append(s)
            continue
        if not ASSET_NAME.fullmatch(s):
            raise ApiError(503, "source_invalid", "רשימת ההפעלה של Frigate כוללת כתובת לא צפויה.", details={"op": "vod"})
        out.append(prefix + s)
    return "\n".join(out) + "\n"


def playback_plan(recorder_id: str, camera_key: str, start: float, end: float, segments: list[dict[str, Any]] | None, retention: dict[str, Any] | None,
                  api_prefix: str = "/api/v1", camera_ref: str | None = None) -> dict[str, Any]:
    """The playback resolution for one camera and window: an HLS playlist served THROUGH Arx. The anchors are marked unproven."""
    cov = coverage(segments or [], start, end, retention) if segments is not None else None
    first = None
    if segments:
        starts = sorted(float(s["start_time"]) for s in segments if isinstance(s.get("start_time"), (int, float)))
        first = starts[0] if starts else None
    base = f"{api_prefix}/frigate/{recorder_id}/cameras/{camera_ref or camera_key}/playback"  # the Arx camera id in the URL, never Frigate's key
    return {
        "kind": "hls", "source": "frigate_vod", "recorder_id": recorder_id, "camera_id": camera_ref,
        "playlist": f"{base}/index.m3u8?start={start:.0f}&end={end:.0f}", "assets": f"{base}/{start:.0f}/{end:.0f}/<name>",
        "window": {"start": start, "end": end, "max_s": PLAYLIST_MAX_WINDOW_S},
        "anchors": {
            "proven": ANCHORS_PROVEN, "status": "unproven", "source": "recordings.segment.start_time", "playlist_has_program_date_time": None,
            "requested_start": start, "first_segment_start": first,
            "first_segment_starts_before_request": (first < start) if first is not None else None,
            "to_prove": ["media anchor", "seek generation", "actual rendered time vs anchor", "consumer reconnect", "cleanup"],
        },
        "seek": "a new playlist at the new start (built on demand by Frigate); the client keeps a seek generation and drops the old player",
        "authorisation": "every playlist and segment request is authorised per request: session, camera scope and playback permission",
        "lease": "none in F1 (no long-lived producer to clean up)", "coverage": cov,
    }


def export_plan(recorder_id: str, camera_key: str, start: float, end: float, api_prefix: str = "/api/v1", camera_ref: str | None = None) -> dict[str, Any]:
    """Clip export DESIGN only: nothing is requested from Frigate and nothing is created. The study's route
    (`GET /<cam>/start/<s>/end/<e>/clip.mp4`) makes the server cut a clip, NOT VERIFIED, and stays outside the F1 allow-list until
    the owner approves one test GET. The job would stream into Arx's own export store (manifest, audit, size limit, retention)."""
    return {
        "executed": False, "status": "design_only", "recorder_id": recorder_id, "camera_id": camera_ref, "window": {"start": start, "end": end},
        "frigate_route": f"GET /<camera>/start/{start:.0f}/end/{end:.0f}/clip.mp4", "verified": False, "allow_listed": False,
        "target": "arx export store (services/exports): manifest + audit + size limit + retention; Frigate stores nothing",
        "limits": {"max_window_s": EXPORT_PLAN_MAX_WINDOW_S, "max_bytes": EXPORT_PLAN_MAX_BYTES},
        "needs": ["owner approval of one live clip.mp4 GET test", "export job adapter for an HTTP source", "permission exports.create on the camera"],
        "plan_endpoint": f"{api_prefix}/frigate/{recorder_id}/cameras/{camera_ref or camera_key}/export-plan",
    }
