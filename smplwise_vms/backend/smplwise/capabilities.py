"""Installation capabilities (NN1 P1, docs/architecture/CAPABILITIES.md): what this installation HAS, as a derived,
read-only set - never stored, no migration, no permission. It generalises the binary installation mode (mode.py, which
stays as a thin compatibility wrapper: `ha_only` = no `nvr` capability).

Rules (owner decisions 2026-10-03):
- derived on every call from the connection settings alone - configured, not reachable: a go2rtc or Home Assistant that
  is down is a health fact (`/health/report`), never a capability change, so the navigation never flickers;
- an NVR without go2rtc is NOT a supported installation (`supported` false, reason `nvr_without_go2rtc`): live video and
  playback are unavailable, the setup wizard never reaches "ready" and says why;
- capabilities are not authorisation: every route keeps its own identity and permission check first; `ensure_capability`
  is called after it and answers 409 `capability_unavailable` (only an authorised caller learns what is missing);
- changing a connection keeps "restart required" (the background work is chosen at start-up);
- the connection source is read through `nvr_host()` / `go2rtc_url()` only, so moving the NVR / go2rtc connection from the
  add-on options into the product's own settings (NN4) changes these two functions and nothing else.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

from .config import Settings
from .errors import ApiError

CAPABILITY_NAMES = ("nvr", "go2rtc", "ha", "live_video", "playback", "events_recorder", "events_ha", "ha_cameras_still", "ha_cameras_live")
NVR_WITHOUT_GO2RTC = "nvr_without_go2rtc"

# operator language, no infrastructure branding (shown in the wizard, the health pill and 409 answers)
UNSUPPORTED_MESSAGES = {
    NVR_WITHOUT_GO2RTC: "התקנה עם NVR אינה נתמכת בלי שרת המדיה (go2rtc): בלעדיו אין וידאו חי ואין ניגון הקלטות.",
}
UNSUPPORTED_ACTIONS = {
    NVR_WITHOUT_GO2RTC: "השלימו את כתובת שרת המדיה (go2rtc_url) בהגדרות החיבור של ההתקנה והפעילו את המערכת מחדש.",
}
CAPABILITY_MESSAGES = {
    "go2rtc": "שרת המדיה (go2rtc) לא הוגדר בהתקנה זו.",
    "live_video": "וידאו חי אינו זמין בהתקנה זו: שרת המדיה (go2rtc) לא הוגדר.",
    "playback": "ניגון הקלטות אינו זמין בהתקנה זו: שרת המדיה (go2rtc) לא הוגדר.",
}


# ---------------------------------------------------------------- the connection sources (the only place that reads them)

def nvr_host(settings: Settings) -> str | None:
    """The NVR host of this installation, or None. CR-022 (NN4): `Settings.nvr_host` is the EFFECTIVE connection -
    the stored `recorder_connections` row overlaid once at start-up by connection_store.load_effective (else the legacy
    add-on options / NVR_* environment, else config.DEV_NVR_PLACEHOLDER for a developer launch). An explicit "no NVR"
    choice (vendor `none`) and an unreadable stored connection are no host."""
    if settings.nvr_vendor == "none" or settings.nvr_connection_state in ("unreadable", "refused", "disabled"):  # refused: review F5; disabled: CR-024
        return None
    from .recorder_scope import DISABLED

    if settings.nvr_recorder_id in DISABLED:  # CR-024: disabled by an administrator while the process runs
        return None
    host = (settings.nvr_host or "").strip()
    return host or None


def go2rtc_url(settings: Settings) -> str | None:
    """The go2rtc address of this installation, or None (same single-source rule as `nvr_host`). CR-022 moves only the
    NVR connection into Arx; go2rtc stays an add-on option for now."""
    url = (settings.go2rtc_url or "").strip()
    return url or None


def ha_configured(settings: Settings) -> bool:
    return bool(settings.ha_url and settings.ha_token)


def wiskey_configured(settings: Settings) -> bool:
    return bool(settings.wiskey_user)


# ---------------------------------------------------------------- the derived set

@dataclass(frozen=True)
class RecorderCaps:
    id: str
    vendor: str
    live: bool
    playback: bool
    events: bool
    write_encodings: bool


@dataclass(frozen=True)
class Capabilities:
    nvr: bool
    go2rtc: bool
    ha: bool
    live_video: bool
    playback: bool
    events_recorder: bool
    events_ha: bool
    ha_cameras_still: bool
    ha_cameras_live: bool
    supported: bool
    unsupported_reason: str | None
    recorders: tuple[RecorderCaps, ...] = field(default_factory=tuple)

    def flags(self) -> dict[str, bool]:
        return {name: getattr(self, name) for name in CAPABILITY_NAMES}

    def as_dict(self, *, with_recorders: bool) -> dict[str, Any]:
        """The JSON block of /me, /health, /health/report and /setup/state. `recorders` (vendor and per-recorder abilities)
        only for a caller who may read the NVR configuration; never a host, serial number, MAC address or credential."""
        out: dict[str, Any] = {**self.flags(), "supported": self.supported, "unsupported_reason": self.unsupported_reason}
        if with_recorders:
            out["recorders"] = [asdict(r) for r in self.recorders]
        return out


def _recorders(settings: Settings) -> tuple[RecorderCaps, ...]:
    """Every configured recorder (CR-024: the primary `nvr-1` and each further one loaded at start-up); the abilities are the
    adapter's own declaration, so a vendor with `playback="none"` or `"hls"` plugs in later without a new mechanism."""
    from .recorder_scope import configured_ids, settings_for
    from .services.recorders.registry import constructor_for

    out: list[RecorderCaps] = []
    for rid in configured_ids(settings):
        rs = settings_for(settings, rid)
        try:  # CR-022: the recorder's chosen vendor (a vendor without an adapter cannot be saved; refused defensively)
            caps = constructor_for(rs)(rid, rs).capabilities()
        except ApiError:
            continue
        out.append(RecorderCaps(id=rid, vendor=caps.vendor, live=caps.live != "none", playback=caps.playback != "none",
                                events=caps.events != "none", write_encodings=caps.write_encodings))
    return tuple(out)


def resolve(settings: Settings) -> Capabilities:
    """The capability set of this installation, from its connection settings. Pure apart from reading `settings`."""
    from .recorder_scope import any_configured

    has_nvr = nvr_host(settings) is not None or any_configured(settings)
    has_go2rtc = go2rtc_url(settings) is not None
    has_ha = ha_configured(settings)
    recorders = _recorders(settings) if has_nvr else ()
    unsupported = NVR_WITHOUT_GO2RTC if (has_nvr and not has_go2rtc) else None
    # a live source: an NVR channel, a WisKey station or a Home Assistant camera (opted in per camera by an administrator)
    live_source = any(r.live for r in recorders) or wiskey_configured(settings) or has_ha
    return Capabilities(
        nvr=has_nvr,
        go2rtc=has_go2rtc,
        ha=has_ha,
        live_video=has_go2rtc and live_source,
        playback=has_go2rtc and any(r.playback for r in recorders),
        events_recorder=any(r.events for r in recorders),
        events_ha=has_ha,
        ha_cameras_still=has_ha,
        ha_cameras_live=has_ha and has_go2rtc,
        supported=unsupported is None,
        unsupported_reason=unsupported,
        recorders=recorders,
    )


def installation_block(caps: Capabilities) -> dict[str, Any]:
    """`installation` in /health, /health/report and /setup/state: is this a supported installation, and why not."""
    reason = caps.unsupported_reason
    return {"supported": caps.supported, "reason": reason, "message": UNSUPPORTED_MESSAGES.get(reason) if reason else None,
            "action": UNSUPPORTED_ACTIONS.get(reason) if reason else None}


def may_see_recorders(permissions: list[str] | set[str]) -> bool:
    """The recorder detail is for whoever may read the NVR configuration (same predicate as the shell's
    `canReadNvrConfig`): a system administrator or any NVR permission at some scope."""
    return any(p == "system.configure" or p.startswith("nvr.") for p in permissions)


def capability_unavailable(name: str) -> ApiError:
    return ApiError(409, "capability_unavailable", CAPABILITY_MESSAGES.get(name, "היכולת אינה זמינה בהתקנה זו."),
                    details={"capability": name, "reason": "media_not_configured" if name in MEDIA_BACKED else "not_configured"})


MEDIA_BACKED = frozenset({"go2rtc", "live_video", "playback", "ha_cameras_live"})


def ensure_capability(settings: Settings, name: str) -> None:
    """409 `capability_unavailable` (`details.capability`) when this installation lacks `name`. Always AFTER the
    handler's own identity and permission checks, and after `mode.ensure_nvr` (an NVR-less installation keeps its
    `nvr_not_configured` answer)."""
    if name not in CAPABILITY_NAMES:
        raise ValueError(f"unknown capability {name!r}")
    if not getattr(resolve(settings), name):
        raise capability_unavailable(name)
