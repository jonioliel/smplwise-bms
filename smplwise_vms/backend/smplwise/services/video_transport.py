"""VIDEO-TRANSPORT-2400: the ONE decision of how a live picture travels (WebRTC / MSE), for every player of the product.

Owner decisions 2026-11-04 (docs/changes/VIDEO-TRANSPORT-2400.md):

1. The transport is exactly what the choice says, in every channel (the local Ingress / LAN page, the remote `/arx/` page and
   the phone app) and on every surface (camera page, all-cameras wall, kiosk, display wall, camera cards, the stations drawer):
   `mse` plays MSE only, `webrtc` plays WebRTC only. Nothing overrides an explicit choice. `auto` is the only choice that
   tries more than one transport, in the documented order below.
2. The choice is the viewer's personal one (`video.transport` in /me/prefs, "החשבון שלי › וידאו") when set, else the
   installation's `media.transport_default`, else `auto`.
3. Stations play both transports (Arx's own source and WisKey's W10 lease); there is no reduced station profile.

The order of `auto`:
- local channel: WebRTC, then MSE (the same profile);
- remote channel: WebRTC, then MSE through the tunnel when `remote.mse_fallback` is on; with it off, WebRTC of the other
  profile instead (CR-008 D7). `remote.mse_fallback` concerns `auto` only: an explicit MSE choice plays MSE remotely too.

Profile steps (a profile fallback never changes the transport of an explicit choice):
- local: a player whose profile is not the viewer's own choice (`auto_profile`, the wall's default quality) may continue on
  the other profile (explicit: the same transport; `auto`: the other profile's lab order, main MSE first, sub WebRTC first);
- remote: with `auto_profile` (VIDEO-SUB-FALLBACK-2402) the other profile follows on each transport already planned (the player
  switches profile only on that same transport); an explicit WebRTC choice (or `auto` without the MSE fallback) continues on the other profile over WebRTC; a stream
  the registry knows undecodable over WebRTC (`encoding.<profile>.webrtc == "no"`) is skipped there (CR-008 D7);
- a station (`single_profile`): the drawer's quality choice is the viewer's, so the plan never changes the profile; a transport
  the station's descriptor does not offer for the profile is dropped (`offered`), never replaced by the other one.

Pure functions only (no I/O): the routes read the inputs and serve the result; the frontend executes the plan
(frontend/src/api/video-policy.ts mirrors `plan_steps` for the demo mode and an older server, checked against the same case
table: contracts/fixtures/video_transport/policy_cases.json).
"""
from __future__ import annotations

from typing import Any, Iterable, Mapping

CHOICES: tuple[str, ...] = ("auto", "webrtc", "mse")
PROFILES: tuple[str, ...] = ("main", "sub")
CHANNELS: tuple[str, ...] = ("local", "remote")
PERSONAL_KEY = "video.transport"
INSTALLATION_KEY = "media.transport_default"

LABELS_HE: dict[str, str] = {"auto": "אוטומטי (WebRTC, ואם אינו זמין MSE)", "webrtc": "WebRTC בלבד", "mse": "MSE בלבד"}


def normalize_choice(value: Any) -> str | None:
    """A known choice, or None (unset / unreadable)."""
    text = str(value).strip().lower() if isinstance(value, str) else ""
    return text if text in CHOICES else None


def effective_choice(installation: Any, personal: Any) -> tuple[str, str]:
    """(choice, source): the personal choice when set, else the installation's, else `auto` (source `default`)."""
    own = normalize_choice(personal)
    if own:
        return own, "personal"
    base = normalize_choice(installation)
    if base:
        return base, "installation"
    return "auto", "default"


def _flag(value: Any, default: bool = True) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    return str(value).strip().lower() != "false"


def transport_order(choice: str, channel: str, mse_fallback: Any = True) -> list[str]:
    """The transports a player may use, in order. One entry for an explicit choice; `auto` only may hold two."""
    c = normalize_choice(choice) or "auto"
    if c != "auto":
        return [c]
    if channel == "remote" and not _flag(mse_fallback):
        return ["webrtc"]
    return ["webrtc", "mse"]


def _other(profile: str) -> str:
    return "sub" if profile == "main" else "main"


def plan_steps(choice: str, channel: str, profile: str, *, mse_fallback: Any = True, auto_profile: bool = False,
               single_profile: bool = False, webrtc_ok: Mapping[str, bool] | None = None,
               offered: Mapping[str, Iterable[str]] | None = None) -> list[dict[str, str]]:
    """The ordered steps (`{"profile", "transport"}`) one player walks. Empty = nothing may play under this choice (the player
    says so; it never substitutes another transport)."""
    c = normalize_choice(choice) or "auto"
    p = profile if profile in PROFILES else "sub"
    o = _other(p)
    order = transport_order(c, channel, mse_fallback)
    steps: list[tuple[str, str]]
    if channel == "remote":
        if order == ["mse"]:
            steps = [(p, "mse")]
        elif order == ["webrtc"]:
            steps = [(p, "webrtc"), (o, "webrtc")]
        else:
            steps = [(p, "webrtc"), (p, "mse")]
        if auto_profile:  # VIDEO-SUB-FALLBACK-2402: the other profile on each transport already planned (never a transport of its own)
            steps += [(o, t) for (pr, t) in list(steps) if pr == p and (o, t) not in steps]
    elif c != "auto":
        steps = [(p, c)] + ([(o, c)] if auto_profile else [])
    else:
        steps = [(p, "webrtc"), (p, "mse")]
        if auto_profile:
            first = "mse" if o == "main" else "webrtc"
            steps += [(o, first), (o, "webrtc" if first == "mse" else "mse")]
    if single_profile:
        steps = [s for s in steps if s[0] == p]
    if channel == "remote" and webrtc_ok is not None:
        steps = [s for s in steps if s[1] != "webrtc" or webrtc_ok.get(s[0], True)]
    if offered is not None:
        steps = [s for s in steps if s[1] in set(offered.get(s[0], ()))]
    return [{"profile": pr, "transport": t} for pr, t in steps]


def encode(steps: list[dict[str, str]]) -> str:
    """`main:webrtc,main:mse` (the player's `plan` value); `none` when empty."""
    return ",".join(f"{s['profile']}:{s['transport']}" for s in steps) or "none"


def webrtc_ok_from_encoding(encoding: Mapping[str, Any] | None) -> dict[str, bool]:
    """False only where the registry says the profile does not decode over WebRTC; unknown is tried."""
    out: dict[str, bool] = {}
    for pr in PROFILES:
        e = (encoding or {}).get(pr)
        out[pr] = not (isinstance(e, Mapping) and e.get("webrtc") == "no")
    return out


def policy(installation: Any, personal: Any, channel: str, remote: Mapping[str, Any] | None = None) -> dict[str, Any]:
    """What every player of this viewer on this channel follows (GET /media/video-policy)."""
    ch = channel if channel in CHANNELS else "local"
    choice, source = effective_choice(installation, personal)
    r = remote or {}
    mse_fallback = _flag(r.get("remote.mse_fallback"), True)
    order = transport_order(choice, ch, mse_fallback)
    return {
        "choice": choice,
        "source": source,
        "explicit": choice != "auto",
        "installation": normalize_choice(installation) or "auto",
        "personal": normalize_choice(personal),
        "channel": ch,
        "order": order,
        "label": LABELS_HE[choice],
        "remote": {"default_profile": "sub" if r.get("remote.default_profile") == "sub" else "main", "mse_fallback": mse_fallback} if ch == "remote" else None,
    }


def case_table() -> list[dict[str, Any]]:
    """Every installation choice x personal choice x channel x remote.mse_fallback x profile x surface kind, with the policy and
    the plan - the table the frontend's mirror is checked against (contracts/fixtures/video_transport/policy_cases.json)."""
    rows: list[dict[str, Any]] = []
    surfaces = {
        "viewer": {},  # camera page, camera card, kiosk / wall tile on the viewer's own profile
        "wall_default": {"auto_profile": True},  # the wall's default quality (the profile is not the viewer's)
        "station": {"single_profile": True, "offered": {"main": ["mse", "webrtc"], "sub": ["mse", "webrtc"]}},
        "station_mse_only": {"single_profile": True, "offered": {"main": ["mse"]}},
        "undecodable_main": {"webrtc_ok": {"main": False, "sub": True}},
    }
    for installation in (*CHOICES, None):
        for personal in (None, *CHOICES):
            for channel in CHANNELS:
                for mse_fallback in ((True, False) if channel == "remote" else (True,)):
                    pol = policy(installation, personal, channel, {"remote.mse_fallback": "true" if mse_fallback else "false"})
                    for profile in PROFILES:
                        for surface, opts in surfaces.items():
                            steps = plan_steps(pol["choice"], channel, profile, mse_fallback=mse_fallback, **opts)  # type: ignore[arg-type]
                            rows.append({
                                "installation": installation, "personal": personal, "channel": channel, "mse_fallback": mse_fallback,
                                "profile": profile, "surface": surface, "choice": pol["choice"], "source": pol["source"],
                                "order": pol["order"], "plan": encode(steps),
                            })
    return rows
