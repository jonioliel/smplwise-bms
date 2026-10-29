"""Live video for Frigate cameras through Frigate's own restream (task TKFRIGLIVE, CR-029 section 14).

Frigate runs its own go2rtc and republishes each camera it is told to as RTSP on port 8554 (`rtsp://<frigate host>:8554/<stream>`,
Frigate docs "Restream"); `/api/go2rtc/streams` lists those stream names (the adapter already reads it during discovery, GET only).
Arx creates its OWN go2rtc streams for such a camera - the same `smplwise_<recorder>_ch<n>_<profile>` names every recorder uses - with
Frigate's restream URL as the source, so the existing player (WebRTC / MSE through the authorised relay) works unchanged.

Rules:
- Read-only toward Frigate: nothing is written to Frigate; go2rtc on Frigate's side is only READ by Arx's go2rtc (an RTSP pull).
- Only the `smplwise_` namespace of Arx's go2rtc is touched (`Go2rtc.ensure_stream` / `delete_stream` refuse anything else); that
  go2rtc also serves another project, so a Frigate stream whose NAME is also a stream of Arx's go2rtc outside our namespace is
  refused (`frigate_restream_ambiguous`): the URL could be Arx's go2rtc itself under another address.
- The source is checked by the shared camera-source policy (`source_policy.source_refusal` with go2rtc's own host on go2rtc's
  ports): Frigate's restream on the go2rtc host's port 8554 IS go2rtc's own restream and is refused.
- Only stream names Frigate itself lists, matching a strict pattern, and tied to that camera (the camera key, `<key>_sub` /
  `<key>_main`, or a name in the camera's own `live.streams`) are used. No guess, no fixed formula.
- The feature flag (`frigate_enabled`, `SW_FRIGATE=1`) only makes the Frigate recorder TYPE selectable (creating NEW recorders, registry.py);
  it does NOT gate live video of a Frigate recorder that already exists (2.27.3: it used to, which silently left every camera on a still).
  The connection extra `restream` = `off` switches it off per recorder, and Arx's own go2rtc must be configured (`go2rtc_url`).
- Credentials: Frigate's restream has no authentication unless its go2rtc config sets `rtsp.username/password`. The extra
  `restream_auth` = `account` sends the Frigate connection's user and password in the RTSP URL (server-side only, like every
  NVR source); default `none`. The password then also travels over RTSP (cleartext Basic is possible on the LAN) and sits in go2rtc's
  in-memory stream source (readable via go2rtc's GET /api/streams, logged by go2rtc < 1.9.14 on create) - delta review F-2.

Without a matching stream a camera stays a refreshing still (the media route answers 409 `live_not_available`, `fallback: still`)."""
from __future__ import annotations

import os
import re
from collections.abc import Callable
from typing import Any
from urllib.parse import quote, unquote

from ...config import Settings
from ...errors import ApiError

DEFAULT_PORT = 8554
MODES = ("auto", "off")
AUTH_MODES = ("none", "account")
STREAM_NAME = re.compile(r"^(?!\.{1,2}$)[A-Za-z0-9_.-]{1,64}$")


def _extra(settings: Settings) -> dict[str, Any]:
    return settings.nvr_extra if isinstance(settings.nvr_extra, dict) else {}


def flag_on() -> bool:
    """The add-on option `frigate_enabled` (exported as SW_FRIGATE=1). Read at call time so an option change applies on restart."""
    return os.environ.get("SW_FRIGATE", "0") == "1"


def mode(settings: Settings) -> str:
    m = str(_extra(settings).get("restream") or "auto").lower()
    return m if m in MODES else "auto"


def port(settings: Settings) -> int:
    v = _extra(settings).get("restream_port")
    try:
        p = int(v)
    except (TypeError, ValueError):
        return DEFAULT_PORT
    return p if 1 <= p <= 65535 else DEFAULT_PORT


def auth_mode(settings: Settings) -> str:
    m = str(_extra(settings).get("restream_auth") or "none").lower()
    return m if m in AUTH_MODES else "none"


def disabled_reason(settings: Settings) -> str | None:
    """Why live video through the restream is not offered for this recorder at all (None = it may be). The `frigate_enabled` flag is NOT
    a reason: it only gates creating new Frigate recorders, and this is only ever asked about a recorder that already is one."""
    if mode(settings) == "off":
        return "off"
    if not str(getattr(settings, "go2rtc_url", "") or "").strip():
        return "no_go2rtc_url"
    return None


def _live_stream_names(camera: dict[str, Any]) -> list[str]:
    names = camera.get("live_streams") if isinstance(camera.get("live_streams"), list) else []
    return [n for n in names if isinstance(n, str) and STREAM_NAME.fullmatch(n)]


def pick(camera: dict[str, Any], listed: set[str]) -> dict[str, str] | None:
    """{"main": stream, "sub": stream} for ONE camera of the discovery summary, using only names Frigate lists. The main profile
    prefers the camera's first `live.streams` entry, then the camera key, then `<key>_main`; the sub profile prefers `<key>_sub`,
    then a further `live.streams` entry; a missing profile falls back to the other one. None when nothing matches."""
    key = str(camera.get("key") or "")
    if not STREAM_NAME.fullmatch(key) or not camera.get("enabled", True):
        return None
    ok = {n for n in listed if isinstance(n, str) and STREAM_NAME.fullmatch(n)}
    live = _live_stream_names(camera)

    def first(cands: list[str]) -> str | None:
        return next((c for c in cands if c in ok), None)

    main = first([*live[:1], key, f"{key}_main"])
    sub = first([f"{key}_sub", *live[1:]])
    if main is None and sub is None:
        return None
    return {"main": main or sub, "sub": sub or main}  # type: ignore[dict-item]


def plan(doc: dict[str, Any] | None) -> dict[str, dict[str, str]]:
    """camera key -> {"main", "sub"} for every camera of a discovery document with a matching restream (no I/O)."""
    if not doc or not doc.get("version_ok"):
        return {}
    listed = set(doc.get("restream_streams") or [])
    if not listed:
        return {}
    out: dict[str, dict[str, str]] = {}
    for cam in (doc.get("summary") or {}).get("cameras") or []:
        p = pick(cam, listed)
        if p:
            out[str(cam["key"])] = p
    return out


def live_plan(settings: Settings, doc: dict[str, Any] | None) -> dict[str, dict[str, str]]:
    """`plan` gated by the flag and the recorder's own switch."""
    return {} if disabled_reason(settings) else plan(doc)


def summary(settings: Settings, doc: dict[str, Any] | None) -> dict[str, Any]:
    """The `live` block of the Frigate status: mode, how many cameras have live video, and why not (codes, no address)."""
    cams = [c for c in ((doc or {}).get("summary") or {}).get("cameras") or [] if c.get("enabled", True)]
    why = disabled_reason(settings)
    p = {} if why else plan(doc)
    if why is None:
        if not (doc or {}).get("restream_streams"):
            why = "no_streams"
        elif not p:
            why = "no_match"
        elif len(p) < len(cams):
            why = "partial"
    return {"mode": "restream" if p else "still", "cameras_live": len(p), "cameras_total": len(cams), "reason": why,
            "setting": mode(settings), "port": port(settings), "auth": auth_mode(settings), "flag": flag_on()}


def source_url(settings: Settings, stream: str) -> str:
    """The RTSP source Arx's go2rtc pulls: `rtsp://[user:pass@]<frigate host>:<restream port>/<stream>`. Server-side only; never
    returned to a browser or logged unredacted (`go2rtc.redact_source`). Refused (409 `frigate_restream_refused`) when the shared
    camera-source policy refuses it - e.g. the go2rtc host's own port 8554."""
    from .. import source_policy
    from ..go2rtc import rtsp_host

    if not STREAM_NAME.fullmatch(stream or ""):
        raise ApiError(409, "frigate_restream_refused", "מקור השידור החי אינו תקין.", details={"reason": "stream_name"})
    host = rtsp_host((settings.nvr_host or "").strip())
    if not host:
        raise ApiError(503, "source_not_configured", "כתובת המקליט לא הוגדרה.")
    auth = ""
    if auth_mode(settings) == "account":
        if not settings.nvr_user or not settings.nvr_password:
            raise ApiError(503, "source_not_configured", "פרטי ההתחברות של המקליט לא הוגדרו.")
        auth = f"{quote(settings.nvr_user, safe='')}:{quote(settings.nvr_password, safe='')}@"
    url = f"rtsp://{auth}{host}:{port(settings)}/{stream}"
    refusal = source_policy.source_refusal(url, source_policy.go2rtc_targets(settings.go2rtc_url))
    if refusal:
        raise ApiError(409, "frigate_restream_refused", "מקור השידור החי נדחה על ידי מדיניות המקורות.", details={"reason": refusal})
    return url


def refuse_foreign(stream: str) -> Callable[[dict[str, Any]], None]:
    """`Go2rtc.ensure_stream(check=...)`: refuse when the Frigate stream's name is also the name of a stream of Arx's go2rtc
    outside the `smplwise_` namespace (case-insensitive; raw and percent-decoded) - the restream URL might be Arx's own go2rtc
    reached by another address, and the other project's streams must never be re-published under our names."""
    from ..go2rtc import STREAM_PREFIX

    def check(streams: dict[str, Any]) -> None:
        foreign = {str(n).lower() for n in streams if not str(n).startswith(STREAM_PREFIX)}
        if {stream.lower(), unquote(stream).lower()} & foreign:
            raise ApiError(409, "frigate_restream_ambiguous", "שם זרם השידור החי תפוס במערכת השידור; השידור החי לא הופעל.", details={"reason": "name_collides"})

    return check
