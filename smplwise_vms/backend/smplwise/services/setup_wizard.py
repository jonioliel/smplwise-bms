"""Setup wizard (T071, R141 / AT141): install → NVR → Home Assistant → go2rtc → floor → camera. One status per step
(done / todo / failed / skipped / not_applicable) with the evidence behind it, a Hebrew explanation with the concrete next action when a
step is not done, and a link to the settings section that fixes it.

How a step is evaluated:
- `local` (install, floor, camera): the add-on's own database and data directory - always current, no network.
- device steps (nvr, ha, go2rtc): GET /setup/state never touches a device. It shows the last on-demand probe (kept for
  LIVE_TTL_S) or, without one, what the background jobs already know (camera discovery, the go2rtc stream sync, the HA
  sync and bridge state), marked `source: background`. POST /setup/check/{step} runs that step's probe now with the same
  read-only calls the rest of the add-on uses - nvr.device_info / nvr.discover_channels / nvr_system.time_status,
  Go2rtc.info / Go2rtc.list_streams, ha_client.get_config - rate-limited per user and step, audited as a read.
  Nothing here writes to the NVR, go2rtc or Home Assistant.

Time checks (the NVR step and the HA step): the device clock against the add-on's (|drift| <= DRIFT_OK_S fine, up to
DRIFT_FAIL_S a warning, beyond that the step fails), and the NVR's UTC offset against the installation time zone at
this instant (a wrong DST rule on the NVR shifts every recording search by an hour, because searches are made in the
NVR's wall clock - KNOWN_QUIRKS T2)."""
from __future__ import annotations

import datetime as dt
import email.utils
import json
import math
import os
import re
import shutil
import sqlite3
import threading
import time
from concurrent.futures import Future, ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from typing import Any, Callable
from zoneinfo import ZoneInfo

from .. import __version__
from ..capabilities import NVR_WITHOUT_GO2RTC, UNSUPPORTED_ACTIONS, UNSUPPORTED_MESSAGES, installation_block
from ..capabilities import resolve as resolve_capabilities
from ..config import Settings
from ..db import now_iso
from ..errors import ApiError
from ..i18n import Msg, t
from . import setup_wizard_text  # noqa: F401 - registers the wizard's texts (I18N-BACKEND-2490)
from . import autosync, bridge_install, bridge_keys as bk, events_ingest, ha_client, ha_sync, nvr, nvr_system, stream_codecs
from . import go2rtc as g2
from .timeutil import site_zone_name, zone
from ..mode import installation_mode, is_ha_only
from ..test_reset import register_reset

STEPS = ("install", "nvr", "ha", "go2rtc", "floor", "camera")
# I18N-BACKEND-2490: every user-visible text below is a `Msg` (services/setup_wizard_text.py): its str value is the Hebrew the wizard
# always wrote, and routers/setup.py renders it in the requesting user's language. The cached probe results (`_live`) hold `Msg`s, so
# one cached check serves a Hebrew and an English administrator alike.
TITLES = {step: t(f"wizard.title.{step}") for step in ("install", "nvr", "ha", "go2rtc", "floor", "camera")}
DEVICE_STEPS = ("nvr", "ha", "go2rtc")
# 2.6.0 TKWIZHINT: a step the installation works without. It stays visible in the wizard (labelled optional) but never keeps the shell hint alive.
OPTIONAL_STEPS = frozenset({"floor", "camera"})

DRIFT_OK_S = 2
DRIFT_FAIL_S = 30
CHECK_EVERY_S = 5.0  # per user and step: "בדוק שוב" is a nudge, not a poll
LIVE_TTL_S = 600  # a live probe result is shown this long, then the background state again
MIN_FREE_BYTES = 512 * 1024**2  # the health report's own "error" line for /data

_lock = threading.Lock()
_live: dict[str, tuple[float, dict[str, Any]]] = {}
# NVR-less mode: the last successful go2rtc check, kept past LIVE_TTL_S - without an NVR no stream sync runs, so the
# background jobs never learn that go2rtc answers; reachability is the whole go2rtc step there
_go2rtc_ok: dict[str, Any] = {}
_last_check: dict[tuple[str, str], float] = {}

LINKS = {
    "connections": ("#/system/setup", t("wizard.link.connections")),
    "health": ("#/system/diagnostics?tab=health", t("wizard.link.health")),
    "ha": ("#/system/diagnostics?tab=ha", t("wizard.link.ha")),
    "media": ("#/system/diagnostics?tab=media", t("wizard.link.media")),
    "general": ("#/system/diagnostics", t("wizard.link.general")),
    "sites": ("#/explore/sites", t("wizard.link.sites")),
    "devices": ("#/system/devices", t("wizard.link.devices")),
    "access": ("#/system/access", t("wizard.link.access")),
    "remote": ("#/system/diagnostics?tab=remote", t("wizard.link.remote")),
}

# CR-008 D7: the streaming-channels GET inside the wizard's NVR check (CHECK_DEADLINE_S covers the whole check)
STREAMING_TIMEOUT_S = 3.0
# CR-008 D7: at most this many per-camera "main stream will not play over WebRTC" warnings; the rest are counted
MAX_CODEC_WARNINGS = 4


def _codec_fact(main: dict[str, int], total: int) -> dict[str, Any]:
    value = t("wizard.concat", a=t("wizard.concat", a=t("wizard.of", a=main["ok"], b=total), b=t("wizard.codec.no", n=main["no"]) if main["no"] else ""),
              b=t("wizard.codec.unknown", n=main["unknown"]) if main["unknown"] else "")
    return _fact(t("wizard.codec.label"), value, "warn" if main["no"] else "ok" if main["ok"] == total else "")


def _codec_warnings(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The settings hints of the cameras whose main stream will not play over WebRTC (stream_codecs.hints shape)."""
    out = [_warning("main_not_webrtc", str(it["hint"]), _link("remote")) for it in items[:MAX_CODEC_WARNINGS]]
    if len(items) > MAX_CODEC_WARNINGS:
        out.append(_warning("main_not_webrtc_more", t("wizard.codec.more", n=len(items) - MAX_CODEC_WARNINGS), _link("health")))
    return out


def reset() -> None:
    """Forget cached probe results and the rate limiter (tests, the fixture backend's control API)."""
    with _lock:
        _live.clear()
        _inflight.clear()
        _last_check.clear()
        _go2rtc_ok.clear()


# ---------------------------------------------------------------- building blocks

def _link(key: str, href: str | None = None, label: str | None = None) -> dict[str, str]:
    h, l = LINKS[key]
    return {"href": href or h, "label": label or l}


def _problem(code: str, message: str, action: str, link: dict[str, str] | None) -> dict[str, Any]:
    return {"code": code, "message": message, "action": action, "link": link}


def _fact(label: str, value: Any, tone: str = "") -> dict[str, Any]:
    return {"label": label, "value": "—" if value in (None, "") else value if isinstance(value, Msg) else str(value), "tone": tone}


def _step(step_id: str, status: str, summary: str, *, facts: list[dict[str, Any]], evidence: dict[str, Any], settings_link: dict[str, str],
          problem: dict[str, Any] | None = None, warnings: list[dict[str, Any]] | None = None, source: str = "local", checked_at: str | None = None) -> dict[str, Any]:
    return {
        "id": step_id, "index": STEPS.index(step_id) + 1, "title": TITLES[step_id], "optional": step_id in OPTIONAL_STEPS, "status": status, "summary": summary,
        "facts": facts, "evidence": evidence, "problem": problem, "warnings": warnings or [], "settings_link": settings_link,
        "source": source, "checked_at": checked_at or now_iso(),
    }


def _warning(code: str, message: str, link: dict[str, str] | None = None) -> dict[str, Any]:
    return {"code": code, "message": message, "link": link}


def _signed(n: int) -> str:
    return f"+{n}" if n > 0 else str(n)


def _fmt_offset(off: dt.timedelta | None) -> str | None:
    if off is None:
        return None
    total = int(off.total_seconds())
    sign = "+" if total >= 0 else "-"
    total = abs(total)
    return f"{sign}{total // 3600:02d}:{(total % 3600) // 60:02d}"


def _fmt_bytes(n: int) -> str:
    return f"{n / 1024**3:.1f} GB" if n >= 1024**3 else f"{n / 1024**2:.0f} MB"


# ---------------------------------------------------------------- time checks

def drift_level(drift_s: int | None) -> str:
    """ok (|d| <= DRIFT_OK_S) · warn (<= DRIFT_FAIL_S) · fail · unknown."""
    if drift_s is None:
        return "unknown"
    a = abs(drift_s)
    return "ok" if a <= DRIFT_OK_S else "warn" if a <= DRIFT_FAIL_S else "fail"


def nvr_time_check(local_time: str | None, tz: ZoneInfo, now: dt.datetime) -> dict[str, Any]:
    """The NVR's clock (its ISAPI localTime) against the add-on's, and its UTC offset against the installation zone at
    this instant. A localTime without an offset is read as the installation zone's wall clock; its DST is then unknown."""
    expected = now.astimezone(tz).utcoffset()
    out: dict[str, Any] = {"local_time": local_time, "zone": tz.key, "expected_offset": _fmt_offset(expected), "offset": None, "drift_s": None, "level": "unknown", "dst": "unknown"}
    if not local_time:
        return out
    try:
        parsed = dt.datetime.fromisoformat(local_time.strip().replace("Z", "+00:00"))
    except ValueError:
        return out
    if parsed.tzinfo is None:
        instant = parsed.replace(tzinfo=tz)
    else:
        # the device reports its wall clock (summer time applied) tagged with the zone's STANDARD offset: read the
        # digits in the installation zone (nvr_system.device_instant); the tag alone is then no longer evidence
        instant = nvr_system.device_instant(local_time, tz) or parsed
        out["offset"] = _fmt_offset(parsed.utcoffset())
        out["dst"] = "ok" if parsed.utcoffset() == expected or (instant != parsed and abs((instant - now).total_seconds()) <= DRIFT_FAIL_S) else "mismatch"
    out["drift_s"] = round((instant - now).total_seconds())
    out["level"] = drift_level(out["drift_s"])
    return out


def ha_time_check(date_header: str | None, ha_zone: str | None, tz: ZoneInfo, now: dt.datetime) -> dict[str, Any]:
    """HA's clock from its response's Date header (one-second resolution) and its configured time zone."""
    out: dict[str, Any] = {"ha_time": None, "drift_s": None, "level": "unknown", "ha_zone": ha_zone, "zone": tz.key, "zone_match": (ha_zone == tz.key) if ha_zone else None}
    if date_header:
        try:
            ha_now = email.utils.parsedate_to_datetime(date_header)
        except (TypeError, ValueError):
            ha_now = None
        if ha_now is not None and ha_now.tzinfo is not None:
            out["ha_time"] = ha_now.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            out["drift_s"] = round((ha_now - now).total_seconds())
            out["level"] = drift_level(out["drift_s"])
    return out


def _drift_fact(label: str, check: dict[str, Any]) -> dict[str, Any]:
    d = check.get("drift_s")
    tone = {"ok": "ok", "warn": "warn", "fail": "err"}.get(check.get("level"), "")
    return _fact(label, t("wizard.not_measured") if d is None else t("wizard.seconds", n=_signed(d)), tone)


# ---------------------------------------------------------------- step 1: install (local)

def _system_admins(conn: sqlite3.Connection) -> int:
    """The installation's administrator count - CR-ADMIN-GATE-2438 (code review 02:P2-9, lead decision L5): the one definition,
    rbac.admin_count (active users allowed rbac.roles.manage at the installation). It used to count system_admin allow-binding ROWS,
    so a deny, an inactive user, a group binding or two rows for one person all gave a wrong number."""
    from ..rbac import admin_count

    return admin_count(conn)


def install_step(settings: Settings, conn: sqlite3.Connection, identity_source: str, *, deep: bool = False) -> dict[str, Any]:
    """The add-on itself: its version, the database, /data (writable, free space) and the first administrator. `deep`
    (the on-demand check) runs SQLite's quick_check; the state view only proves the database answers."""
    try:
        if deep:
            integrity = conn.execute("PRAGMA quick_check").fetchone()[0]
            db_ok = integrity == "ok"
        else:
            integrity = None
            db_ok = conn.execute("SELECT 1").fetchone()[0] == 1
    except sqlite3.Error as exc:
        integrity, db_ok = type(exc).__name__, False
    writable = os.access(settings.data_dir, os.W_OK)
    try:
        du = shutil.disk_usage(settings.data_dir)
        free, total = du.free, du.total
    except OSError:
        free = total = None
    admins = _system_admins(conn)
    tz_name = _tz_name(conn)
    evidence = {"version": __version__, "db_ok": db_ok, "integrity": integrity, "data_dir_writable": writable, "free_bytes": free, "total_bytes": total,
                "system_admins": admins, "bootstrap_admin_configured": bool(settings.bootstrap_admin_username), "identity_source": identity_source,
                "in_addon": settings.in_addon, "time_zone": tz_name}
    facts = [
        _fact(t("wizard.install.version"), __version__),
        _fact(t("wizard.install.db"), t("wizard.concat", a=t("wizard.install.db_ok") if db_ok else t("wizard.install.db_error", integrity=integrity),
                                       b=" · quick_check" if deep and db_ok else ""), "ok" if db_ok else "err"),
        _fact(t("wizard.install.data_dir"), t("wizard.concat", a=t("wizard.install.writable") if writable else t("wizard.install.not_writable"),
                                             b=t("wizard.install.free", free=_fmt_bytes(free), total=_fmt_bytes(total)) if free is not None else ""),
              "ok" if writable and (free is None or free >= MIN_FREE_BYTES) else "err"),
        _fact(t("wizard.install.admins"), admins, "ok" if admins else "warn"),
        _fact(t("wizard.install.identity"), "Home Assistant Ingress" if identity_source == "ingress" else identity_source),
        _fact(t("wizard.install.zone"), tz_name),
    ]
    link = _link("health")
    problem = None
    if not db_ok:
        problem = _problem("db_error", t("wizard.install.db_problem", integrity=integrity),
                           t("wizard.install.db_action"), _link("general", "#/system/diagnostics?tab=backup", t("wizard.link.backup")))
    elif not writable:
        problem = _problem("data_not_writable", t("wizard.install.not_writable_problem"), t("wizard.install.not_writable_action"), link)
    elif free is not None and free < MIN_FREE_BYTES:
        problem = _problem("disk_full", t("wizard.install.disk_full", free=_fmt_bytes(free)),
                           t("wizard.install.disk_full_action"), _link("general", "#/system/storage", t("wizard.link.storage")))
    warnings = []
    if admins == 0:
        warnings.append(_warning("no_system_admin", t("wizard.install.no_admin"), _link("access")))
    if problem:
        return _step("install", "failed", problem["message"], facts=facts, evidence=evidence, settings_link=link, problem=problem, warnings=warnings)
    return _step("install", "done", t("wizard.install.done", version=__version__), facts=facts, evidence=evidence, settings_link=link, warnings=warnings)


def _tz_name(conn: sqlite3.Connection) -> str:
    return site_zone_name(conn)  # CR-TIMEUTIL-2436: the stored `time.zone` or the default, as read_settings answered it


# ---------------------------------------------------------------- step 2: NVR

# code -> (message, action); every action names the connections section (LINKS["connections"])
NVR_ERRORS = {
    "source_not_configured": (t("wizard.nvr.not_configured"), t("wizard.nvr.not_configured_action", link=LINKS["connections"][1])),
    "nvr_not_configured": (t("wizard.nvr.not_configured"), t("wizard.nvr.not_configured_action", link=LINKS["connections"][1])),
    "source_unavailable": (t("wizard.nvr.unavailable"), t("wizard.nvr.unavailable_action", link=LINKS["connections"][1])),
    "source_forbidden": (t("wizard.nvr.forbidden"), t("wizard.nvr.forbidden_action", link=LINKS["connections"][1])),
    "source_error": (t("wizard.nvr.error"), t("wizard.nvr.error_action", link=LINKS["connections"][1])),
}


def _nvr_problem(code: str, detail: str | None = None) -> dict[str, Any]:
    link = _link("connections")
    message, action = NVR_ERRORS.get(code, (t("wizard.nvr.read_failed", code=code), t("wizard.nvr.read_failed_action", link=link["label"])))
    return _problem(code, t("wizard.concat", a=message, b=t("wizard.paren", detail=detail) if detail else ""), action, link)


def _looks_like_address(host: str) -> bool:
    h = host.strip().strip("[]")
    return bool(re.fullmatch(r"[0-9.]+", h)) or ":" in h


def _nvr_configured(settings: Settings) -> bool:
    return bool(settings.nvr_host and settings.nvr_user and settings.nvr_password)


def _recorder(conn: sqlite3.Connection) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM recorders WHERE id = ?", (autosync.DEFAULT_RECORDER,)).fetchone()


def _alert_warning() -> dict[str, Any] | None:
    ing = events_ingest.STATE.as_dict()
    if ing.get("connected"):
        return None
    return _warning("alert_stream_down", t("wizard.nvr.alert_stream_down"), _link("connections"))


def further_recorders_step(settings: Settings | None, conn: sqlite3.Connection | None) -> dict[str, Any] | None:
    """CR-024: the NVR step when the first recorder has no connection but another recorder does (a device connected after a removed
    `nvr-1` with history gets a new id - owner 2026-10-04). `done` when this process runs one and its discovery answered, `todo`
    while its connection waits for the restart (or the first discovery), `failed` on its discovery error. None = no other recorder."""
    if conn is None or settings is None:
        return None
    try:
        rows = conn.execute("""SELECT rc.recorder_id FROM recorder_connections rc LEFT JOIN recorders r ON r.id = rc.recorder_id
                               WHERE rc.recorder_id <> ? AND rc.vendor <> 'none' AND r.removed_at IS NULL ORDER BY rc.recorder_id""",
                            (autosync.DEFAULT_RECORDER,)).fetchall()
    except sqlite3.OperationalError:
        return None
    if not rows:
        return None
    from ..recorder_scope import ready_ids

    link = _link("connections")
    ids = [r[0] for r in rows]
    running = [rid for rid in ready_ids(settings) if rid in ids]
    if not running:
        p = _problem("restart_pending", t("wizard.nvr.saved_restart"), NVR_RESTART_ACTION, link)
        return _step("nvr", "todo", p["message"], facts=[_fact(t("wizard.nvr.fact_saved"), t("wizard.nvr.saved_waiting"), "warn")],
                     evidence={"configured": False, "state": "pending_restart", "recorders": ids}, settings_link=link, problem=p)
    states = {rid: autosync.recorder_state(rid) for rid in running}
    failed = {rid: st.get("cameras_last_error") for rid, st in states.items() if st.get("cameras_last_error")}
    ok = [rid for rid, st in states.items() if st.get("cameras_last_ok")]
    evidence = {"configured": True, "recorders": running, "discovery_errors": failed}
    if ok and not failed:
        return _step("nvr", "done", t("wizard.nvr.recorders_done", n=len(ok)), facts=[_fact(t("wizard.nvr.fact_connected"), len(ok), "ok")], evidence=evidence, settings_link=link,
                     source="background")
    if failed:
        p = _nvr_problem(str(next(iter(failed.values()))))
        return _step("nvr", "failed", p["message"], facts=[_fact(t("wizard.nvr.fact_connected"), len(ok)), _fact(t("wizard.nvr.fact_faulty"), len(failed), "err")], evidence=evidence,
                     settings_link=link, problem=p, source="background")
    p = _problem("not_checked", t("wizard.nvr.not_checked"), t("wizard.nvr.not_checked_action"), link)
    return _step("nvr", "todo", p["message"], evidence=evidence, settings_link=link, problem=p, source="background")


def nvr_background(settings: Settings, conn: sqlite3.Connection) -> dict[str, Any]:
    link = _link("connections")
    if not _nvr_configured(settings):
        other = further_recorders_step(settings, conn)
        if other is not None:
            return other
        p = _nvr_problem("nvr_not_configured")
        return _step("nvr", "failed", p["message"], facts=[_fact(t("wizard.nvr.fact_saved"), t("wizard.no"), "err")], evidence={"configured": False}, settings_link=link, problem=p, source="background")
    ds = dict(autosync.STATE)
    rec = _recorder(conn)
    cams = conn.execute("SELECT COUNT(*) FROM cameras").fetchone()[0]
    evidence = {"configured": True, "model": rec["model"] if rec else None, "firmware": rec["firmware"] if rec else None, "channels": cams,
                "discovery_last_ok": ds.get("cameras_last_ok"), "discovery_last_error": ds.get("cameras_last_error"), "time": None}
    facts = [_fact(t("wizard.nvr.model_fw"), f"{evidence['model'] or '—'} · {evidence['firmware'] or '—'}"), _fact(t("wizard.nvr.channels_registered"), cams),
             _fact(t("wizard.nvr.last_discovery_ok"), ds.get("cameras_last_ok")), _fact(t("wizard.nvr.clock_vs_system"), t("wizard.not_checked_yet"))]
    codecs = stream_codecs.summary(conn, with_names=True)
    evidence["video_codecs"] = {k: v for k, v in codecs.items() if k != "main_not_webrtc"}
    if codecs["checked"]:
        facts.append(_codec_fact(codecs["main"], codecs["checked"]))
    warnings = [w for w in (_alert_warning(),) if w] + _codec_warnings(codecs["main_not_webrtc"])
    if ds.get("cameras_last_error"):
        p = _nvr_problem(str(ds["cameras_last_error"]))
        return _step("nvr", "failed", p["message"], facts=facts, evidence=evidence, settings_link=link, problem=p, warnings=warnings, source="background", checked_at=ds.get("cameras_last_run"))
    if ds.get("cameras_last_ok"):
        return _step("nvr", "done", t("wizard.nvr.background_done", model=evidence['model'] or 'NVR', n=cams), facts=facts, evidence=evidence, settings_link=link,
                     warnings=warnings, source="background", checked_at=ds.get("cameras_last_ok"))
    p = _problem("not_checked", t("wizard.nvr.not_checked"), t("wizard.nvr.not_checked_action"), link)
    return _step("nvr", "todo", p["message"], facts=facts, evidence=evidence, settings_link=link, problem=p, warnings=warnings, source="background")


def nvr_probe(settings: Settings, tz_name: str, now: dt.datetime | None = None, disabled: set[int] | frozenset[int] = frozenset()) -> dict[str, Any]:
    """deviceInfo, the channel / track list (the capabilities the rest of the add-on relies on) and the clock - read-only,
    device calls only (no database). The caller checks that the NVR is configured."""
    link = _link("connections")
    tz = zone(tz_name)
    t0 = time.monotonic()
    try:
        info = nvr.device_info(settings)
    except ApiError as exc:
        p = _nvr_problem(exc.code, (exc.details or {}).get("error"))
        return _step("nvr", "failed", p["message"], facts=[_fact(t("wizard.nvr.fact_saved"), t("wizard.yes"), "ok"), _fact(t("wizard.answer"), t("wizard.none_answer"), "err")],
                     evidence={"configured": True, "reachable": False, "error": exc.code}, settings_link=link, problem=p, source="live")
    except Exception as exc:  # noqa: BLE001 - an unparsable answer is a failed step, never a 500
        p = _nvr_problem("source_error", type(exc).__name__)
        return _step("nvr", "failed", p["message"], facts=[], evidence={"configured": True, "reachable": False, "error": type(exc).__name__}, settings_link=link, problem=p, source="live")
    ms = int((time.monotonic() - t0) * 1000)
    warnings: list[dict[str, Any]] = []
    channels: list[nvr.DiscoveredChannel] = []
    channel_error = None
    try:
        channels = nvr.discover_channels(settings)
    except ApiError as exc:
        channel_error = exc.code
    except Exception as exc:  # noqa: BLE001
        channel_error = type(exc).__name__
    online = sum(1 for c in channels if c.online)
    offline = sum(1 for c in channels if c.online is False)
    with_tracks = sum(1 for c in channels if c.main_track and c.sub_track)
    # CR-008 D7: the main / sub stream encodings (a read-only GET with a short timeout inside the check's budget) -
    # which main streams will not play over WebRTC; counted over the enabled cameras, as /health and the report do
    codec_items: list[dict[str, Any]] = []
    codec_main = {"ok": 0, "no": 0, "unknown": 0}
    codec_error = None
    codec_channels = [c for c in channels if c.channel not in disabled]
    if codec_channels:
        try:
            encodings = nvr.fetch_stream_encodings(settings, timeout=STREAMING_TIMEOUT_S)
        except ApiError as exc:
            encodings, codec_error = {}, exc.code
        except Exception as exc:  # noqa: BLE001
            encodings, codec_error = {}, type(exc).__name__
        for c in codec_channels:
            enc = stream_codecs.build(c, encodings.get(c.channel), None, error=codec_error, now=now_iso()) or {}
            main = enc.get("main")
            verdict = str((main or {}).get("webrtc") or "unknown")
            codec_main[verdict if verdict in codec_main else "unknown"] += 1
            hint = stream_codecs.main_hint(c.name or f"ערוץ {c.channel}", c.channel, main, info.get("model"))
            if hint:
                codec_items.append({"channel": c.channel, "name": c.name, "reason": (main or {}).get("reason"), "hint": hint})
    profiles: list[str] = []
    for c in channels:
        s = c.stream or {}
        label = " ".join(str(x) for x in (s.get("codec"), s.get("resolution"), f"{s['fps']:g}fps" if s.get("fps") else None) if x)
        if label and label not in profiles:
            profiles.append(label)
    try:
        ts = nvr_system.time_status(settings)
        time_check = nvr_time_check(ts.get("local_time"), tz, now or dt.datetime.now(dt.timezone.utc))
        # the NTP server is reduced to "set / a name or an address": a LAN server's address is private (CLAUDE.md), and
        # this result is cached and served to every system administrator
        ntp_host = str((ts.get("ntp") or {}).get("host") or "")
        time_check.update({"mode": ts.get("mode"), "device_zone": ts.get("time_zone"), "ntp_configured": bool(ntp_host),
                           "ntp_is_hostname": bool(ntp_host) and not _looks_like_address(ntp_host)})
    except ApiError as exc:
        time_check = {"level": "unknown", "error": exc.code, "drift_s": None, "dst": "unknown", "zone": tz.key}
    except (ValueError, TypeError, AttributeError) as exc:  # an odd value in the clock / NTP document (portNo, interval ...)
        time_check = {"level": "unknown", "error": f"unparsable ({type(exc).__name__})", "drift_s": None, "dst": "unknown", "zone": tz.key}
    evidence = {"configured": True, "reachable": True, "ms": ms, "model": info.get("model"), "firmware": info.get("firmware"), "device_type": info.get("device_type"),
                "channels": len(channels), "online": online, "offline": offline, "with_tracks": with_tracks, "profiles": profiles[:6], "channel_error": channel_error,
                "time": time_check, "video_codecs": {"main": codec_main, "error": codec_error, "main_not_webrtc": len(codec_items)}}
    facts = [
        _fact(t("wizard.nvr.model_fw"), f"{info.get('model') or '—'} · {info.get('firmware') or '—'}", "ok"),
        _fact(t("wizard.nvr.channels"), t("wizard.concat", a=t("wizard.nvr.channels_value", n=len(channels), online=online),
                                         b=t("wizard.nvr.channels_offline_part", n=offline) if offline else ""), "ok" if channels else "err"),
        _fact(t("wizard.nvr.with_tracks"), t("wizard.of", a=with_tracks, b=len(channels)), "ok" if channels and with_tracks == len(channels) else "warn"),
        _fact(t("wizard.nvr.profiles"), " · ".join(profiles[:4]) if profiles else "—"),
        *([_codec_fact(codec_main, len(codec_channels))] if codec_channels else []),
        _drift_fact(t("wizard.nvr.clock_fact"), time_check),
        _fact(t("wizard.nvr.zone_fact"), t("wizard.nvr.zone_value", offset=time_check.get('offset') or '?', expected=time_check.get('expected_offset'), zone=tz.key),
              {"ok": "ok", "mismatch": "err"}.get(time_check.get("dst"), "warn")),
    ]
    if channel_error or not channels:
        p = _problem("no_channels", t("wizard.nvr.no_channels", detail=t("wizard.nvr.no_channels_detail", error=channel_error) if channel_error else t("wizard.nvr.dot")),
                     t("wizard.nvr.no_channels_action", link=link["label"]), link)
        return _step("nvr", "failed", p["message"], facts=facts, evidence=evidence, settings_link=link, problem=p, source="live")
    if time_check.get("dst") == "mismatch":
        p = _problem("nvr_dst_mismatch", t("wizard.nvr.dst_mismatch", offset=time_check['offset'], zone=tz.key, expected=time_check['expected_offset']),
                     t("wizard.nvr.dst_mismatch_action"), link)
        return _step("nvr", "failed", p["message"], facts=facts, evidence=evidence, settings_link=link, problem=p, source="live")
    if time_check.get("level") == "fail":
        p = _problem("nvr_clock_drift", t("wizard.nvr.clock_drift", drift=_signed(time_check['drift_s']), limit=DRIFT_FAIL_S),
                     t("wizard.nvr.clock_drift_action", link=link["label"]), link)
        return _step("nvr", "failed", p["message"], facts=facts, evidence=evidence, settings_link=link, problem=p, source="live")
    if time_check.get("level") == "warn":
        warnings.append(_warning("nvr_clock_drift", t("wizard.nvr.clock_drift_warn", drift=_signed(time_check['drift_s']), ok=DRIFT_OK_S), link))
    elif time_check.get("level") == "unknown":
        warnings.append(_warning("nvr_clock_unknown", t("wizard.nvr.clock_unknown", detail=t("wizard.paren", detail=time_check['error']) if time_check.get("error") else ""), link))
    if time_check.get("dst") == "unknown" and time_check.get("level") != "unknown":
        warnings.append(_warning("nvr_dst_unknown", t("wizard.nvr.dst_unknown"), link))
    if with_tracks < len(channels):
        warnings.append(_warning("tracks_missing", t("wizard.nvr.tracks_missing", n=len(channels) - with_tracks), _link("devices")))
    if offline:
        warnings.append(_warning("channels_offline", t("wizard.nvr.channels_offline", n=offline), _link("devices")))
    warnings.extend(_codec_warnings(codec_items))
    w = _alert_warning()
    if w:
        warnings.append(w)
    return _step("nvr", "done", t("wizard.nvr.done", model=info.get('model') or 'NVR', firmware=info.get('firmware') or '?', n=len(channels)), facts=facts, evidence=evidence,
                 settings_link=link, warnings=warnings, source="live")


# ---------------------------------------------------------------- step 3: Home Assistant and the bridge

def _ha_not_configured(settings: Settings) -> dict[str, Any]:
    link = _link("ha")
    action = t("wizard.ha.no_supervisor") if settings.in_addon else t("wizard.ha.outside_addon")
    return _problem("ha_not_configured", t("wizard.ha.not_configured"), action, link)


HA_ERRORS = {
    "ha_unavailable": (t("wizard.ha.unavailable"), t("wizard.ha.unavailable_action")),
    "ha_forbidden": (t("wizard.ha.forbidden"), t("wizard.ha.forbidden_action")),
    "ha_error": (t("wizard.ha.error"), t("wizard.ha.error_action")),
    "check_timeout": (t("wizard.ha.timeout"), t("wizard.ha.timeout_action")),
}


def _bridge_view(conn: sqlite3.Connection) -> dict[str, Any]:
    from ..db import get_setting

    st = bridge_install.status(conn=conn)
    paired = bk.paired_secret(conn) and bool(get_setting(conn, "bridge.paired_at"))
    try:
        users = conn.execute("SELECT COUNT(*) FROM ha_users").fetchone()[0]
    except sqlite3.OperationalError:
        users = 0
    # a paired integration that reported an empty version has no active version at all, which bridge_install reads as
    # "copied, never loaded" - forever. Paired means it is loaded; its version is unknown, not a pending restart.
    version_unknown = paired and not st.get("active_version")
    pending = st.get("state") in ("installed_pending", "update_pending") and not version_unknown
    return {"state": st.get("state"), "installed_version": st.get("installed_version"), "active_version": st.get("active_version"), "source_version": st.get("source_version"),
            "paired": paired, "restart_pending": pending, "version_unknown": version_unknown, "directory_users": users, "last_error": st.get("last_error")}


def ha_step(settings: Settings, conn: sqlite3.Connection, *, live: dict[str, Any] | None = None, source: str = "background") -> dict[str, Any]:
    """Configured, the WebSocket sync connected, the bridge integration paired and loaded (no restart pending); with
    `live` (the /api/config probe) also HA's version, time zone and clock."""
    link = _link("ha")
    hs = ha_sync.STATE.as_dict()
    bridge = _bridge_view(conn)
    evidence: dict[str, Any] = {"configured": ha_client.configured(settings), "connected": bool(hs.get("connected")), "ha_version": (live or {}).get("version") or hs.get("ha_version"),
                                "entities": hs.get("entities", 0), "last_error": hs.get("last_error"), "bridge": bridge, "time": (live or {}).get("time"), "reachable": (live or {}).get("reachable")}
    state = str(bridge["state"])
    bridge_label = t(f"wizard.ha.bridge.{state}") if state in ("active", "installed_pending", "update_pending", "not_installed", "not_available", "error") else state
    facts = [
        _fact(t("wizard.ha.connection"), t("wizard.ha.connected") if evidence["connected"] else t("wizard.ha.disconnected_value"), "ok" if evidence["connected"] else "err"),
        _fact(t("wizard.ha.version"), evidence["ha_version"]),
        _fact(t("wizard.ha.entities"), evidence["entities"]),
        _fact(t("wizard.ha.bridge_integration"), t("wizard.ha.bridge_value", state=bridge_label, version=bridge['active_version'] or bridge['installed_version'] or '—'),
              "warn" if bridge["restart_pending"] else ""),
        _fact(t("wizard.ha.pairing"), t("wizard.ha.paired") if bridge["paired"] else t("wizard.ha.not_paired"), "ok" if bridge["paired"] else "err"),
        _fact(t("wizard.ha.restart_waiting"), t("wizard.yes") if bridge["restart_pending"] else t("wizard.no"), "err" if bridge["restart_pending"] else "ok"),
    ]
    tc = evidence["time"]
    if tc:
        facts.append(_drift_fact(t("wizard.ha.clock_fact"), tc))
        facts.append(_fact(t("wizard.ha.zone_fact"), t("wizard.concat", a=f"{tc.get('ha_zone') or '—'}",
                                                      b="" if tc.get("zone_match") in (None, True) else t("wizard.ha.zone_install_part", zone=tc.get('zone'))),
                           "warn" if tc.get("zone_match") is False else ""))
        if tc.get("nvr_ha_s") is not None:
            facts.append(_fact(t("wizard.ha.nvr_ha_fact"), t("wizard.seconds", n=_signed(tc['nvr_ha_s'])), {"ok": "ok", "warn": "warn", "fail": "err"}.get(drift_level(tc["nvr_ha_s"]), "")))
    elif source == "background":
        facts.append(_fact(t("wizard.ha.clock_fact"), t("wizard.not_checked_yet")))

    def failed(p: dict[str, Any]) -> dict[str, Any]:
        return _step("ha", "failed", p["message"], facts=facts, evidence=evidence, settings_link=link, problem=p, source=source)

    if not evidence["configured"]:
        return failed(_ha_not_configured(settings))
    if live and live.get("error"):
        message, action = HA_ERRORS.get(live["error"], (t("wizard.ha.read_failed", code=live['error']), t("wizard.ha.read_failed_action")))
        return failed(_problem(live["error"], message, action, link))
    if not evidence["connected"]:
        return failed(_problem("ha_disconnected", t("wizard.ha.disconnected", detail=t("wizard.nvr.no_channels_detail", error=hs['last_error']) if hs.get("last_error") else t("wizard.nvr.dot")),
                               t("wizard.ha.disconnected_action"), link))
    if bridge["restart_pending"]:
        return failed(_problem("ha_restart_pending", t("wizard.ha.restart_pending"), t("wizard.ha.restart_pending_action"), link))
    if bridge["state"] == "error":
        return failed(_problem("bridge_copy_failed", t("wizard.ha.copy_failed", error=bridge['last_error']), t("wizard.ha.copy_failed_action", link=link["label"]), link))
    if not bridge["paired"]:
        return failed(_problem("bridge_not_paired", t("wizard.ha.not_paired_problem"), t("wizard.ha.not_paired_action", link=link["label"]), link))
    if tc and tc.get("level") == "fail":
        return failed(_problem("ha_clock_drift", t("wizard.ha.clock_drift", drift=_signed(tc['drift_s']), limit=DRIFT_FAIL_S), t("wizard.ha.clock_drift_action"), link))
    warnings = []
    if bridge["version_unknown"]:
        warnings.append(_warning("bridge_version_unknown", t("wizard.ha.version_unknown", link=link["label"]), link))
    if tc and tc.get("level") == "warn":
        warnings.append(_warning("ha_clock_drift", t("wizard.ha.clock_drift_warn", drift=_signed(tc['drift_s'])), link))
    if tc and tc.get("zone_match") is False:
        warnings.append(_warning("ha_zone_mismatch", t("wizard.ha.zone_mismatch", ha_zone=tc['ha_zone'], zone=tc['zone'], link=LINKS["media"][1]), _link("media")))
    if tc and tc.get("nvr_ha_s") is not None and drift_level(tc["nvr_ha_s"]) in ("warn", "fail"):
        warnings.append(_warning("nvr_ha_drift", t("wizard.ha.nvr_ha_drift", n=abs(tc['nvr_ha_s'])), _link("connections")))
    # the version slot keeps the old ".replace("  ", " ")" result: "Home Assistant · ..." without a version
    version = f" {evidence['ha_version']}".replace("  ", " ") if evidence['ha_version'] else ""
    return _step("ha", "done", t("wizard.ha.done", version=version, entities=evidence['entities']), facts=facts,
                 evidence=evidence, settings_link=link, warnings=warnings, source=source)


def ha_probe(settings: Settings, tz_name: str, now: dt.datetime | None = None) -> dict[str, Any]:
    """HA's /api/config (version, time zone, Date header) - the device part only; ha_step composes it with the sync and
    bridge state when the state is built. The caller checks that HA is configured."""
    try:
        config, date_header = ha_client.get_config(settings)
    except ApiError as exc:
        return {"error": exc.code, "reachable": False, "checked_at": now_iso()}
    tc = ha_time_check(date_header, config.get("time_zone"), zone(tz_name), now or dt.datetime.now(dt.timezone.utc))
    return {"version": config.get("version"), "time": tc, "reachable": True, "checked_at": now_iso()}


def _with_nvr_gap(live: dict[str, Any]) -> dict[str, Any]:
    """The NVR-HA clock gap from the latest cached results of both checks, whichever of them ran last."""
    tc = dict(live.get("time") or {})
    nvr_time = ((_cached_live("nvr") or {}).get("evidence") or {}).get("time") or {}
    if tc.get("drift_s") is not None and nvr_time.get("drift_s") is not None:
        tc["nvr_ha_s"] = int(nvr_time["drift_s"]) - int(tc["drift_s"])
    return {**live, "time": tc or None}


# ---------------------------------------------------------------- step 4: go2rtc

GO2RTC_ERRORS = {
    # NN1: operator wording without infrastructure branding (the connection settings move into the product with NN4)
    "media_not_configured": (t("wizard.go2rtc.not_configured"), t("wizard.go2rtc.not_configured_action")),
    "media_unavailable": (t("wizard.go2rtc.unavailable"), t("wizard.go2rtc.unavailable_action")),
    "media_error": (t("wizard.go2rtc.error"), t("wizard.go2rtc.error_action")),
}


def _go2rtc_problem(code: str, detail: str | None = None) -> dict[str, Any]:
    message, action = GO2RTC_ERRORS.get(code, (t("wizard.go2rtc.other", code=code), t("wizard.go2rtc.other_action")))
    return _problem(code, t("wizard.concat", a=message, b=t("wizard.paren", detail=detail) if detail else ""), action, _link("media"))


def _expected_streams(conn: sqlite3.Connection) -> list[str]:
    # CAMERA-STREAM-SOURCES-2410: the recorder channels' streams only (a camera without a recorder has its own `smplwise_cam_` streams)
    return [g2.stream_name(r["recorder_id"], r["channel"], p) for r in conn.execute("SELECT recorder_id, channel FROM cameras WHERE enabled = 1 AND recorder_id <> 'standalone' ORDER BY channel") for p in ("sub", "main")]


def go2rtc_background(settings: Settings, conn: sqlite3.Connection) -> dict[str, Any]:
    link = _link("media")
    if not settings.go2rtc_url:
        p = _go2rtc_problem("media_not_configured")
        if resolve_capabilities(settings).unsupported_reason == NVR_WITHOUT_GO2RTC:
            # NN1, owner decision 2026-10-03: an NVR without go2rtc is not a supported installation - say why, keep the code
            p = _problem("media_not_configured", UNSUPPORTED_MESSAGES[NVR_WITHOUT_GO2RTC], UNSUPPORTED_ACTIONS[NVR_WITHOUT_GO2RTC], link)
        return _step("go2rtc", "failed", p["message"], facts=[_fact(t("wizard.go2rtc.fact_configured"), t("wizard.no"), "err")], evidence={"configured": False}, settings_link=link, problem=p, source="background")
    if is_ha_only(settings):
        # NVR-less mode: no camera streams exist or are synced; the step is go2rtc answering (WisKey station video)
        with _lock:
            ok = dict(_go2rtc_ok)
        if ok:
            ev = ok.get("evidence") or {}
            return _step("go2rtc", "done", t("wizard.go2rtc.answered", version=ev.get('version') or '?'), facts=ok.get("facts") or [], evidence=ev, settings_link=link,
                         source="background", checked_at=ok.get("checked_at"))
        p = _problem("not_checked", t("wizard.go2rtc.not_checked"), t("wizard.go2rtc.not_checked_answer_action"), link)
        return _step("go2rtc", "todo", p["message"], facts=[_fact(t("wizard.go2rtc.fact_configured"), t("wizard.yes"), "ok")], evidence={"configured": True}, settings_link=link, problem=p, source="background")
    ds = dict(autosync.STATE)
    expected = len(_expected_streams(conn))
    evidence = {"configured": True, "expected_streams": expected, "sync_last_ok": ds.get("streams_last_ok"), "sync_last_error": ds.get("streams_last_error")}
    facts = [_fact(t("wizard.go2rtc.expected"), expected), _fact(t("wizard.go2rtc.last_sync_ok"), ds.get("streams_last_ok")), _fact(t("wizard.go2rtc.version"), t("wizard.go2rtc.version_not_checked"))]
    if ds.get("streams_last_error") and ds.get("streams_last_error") != "media_not_configured":
        p = _go2rtc_problem(str(ds["streams_last_error"]))
        return _step("go2rtc", "failed", p["message"], facts=facts, evidence=evidence, settings_link=link, problem=p, source="background", checked_at=ds.get("streams_last_run"))
    if ds.get("streams_last_ok"):
        return _step("go2rtc", "done", t("wizard.go2rtc.synced", n=expected), facts=facts, evidence=evidence, settings_link=link, source="background", checked_at=ds.get("streams_last_ok"))
    p = _problem("not_checked", t("wizard.go2rtc.not_checked"), t("wizard.go2rtc.not_checked_action"), link)
    return _step("go2rtc", "todo", p["message"], facts=facts, evidence=evidence, settings_link=link, problem=p, source="background")


def go2rtc_probe(settings: Settings, expected: list[str]) -> dict[str, Any]:
    """go2rtc's /api (version) and /api/streams: our `smplwise_` streams against what the cameras need (`expected`, read
    from the database before the call); others are only counted - their names are another product's business (the lab
    go2rtc also serves the intercom project). Device calls only; the caller checks that go2rtc is configured."""
    link = _link("media")
    try:
        client = g2.Go2rtc(settings)
        info = client.info()
        streams = client.list_streams()
    except ApiError as exc:
        p = _go2rtc_problem(exc.code, str((exc.details or {}).get("status") or (exc.details or {}).get("error") or "") or None)
        return _step("go2rtc", "failed", p["message"], facts=[_fact(t("wizard.go2rtc.fact_configured"), t("wizard.yes"), "ok"), _fact(t("wizard.answer"), t("wizard.none_answer"), "err")],
                     evidence={"configured": True, "reachable": False, "error": exc.code}, settings_link=link, problem=p, source="live")
    except Exception as exc:  # noqa: BLE001
        p = _go2rtc_problem("media_error", type(exc).__name__)
        return _step("go2rtc", "failed", p["message"], facts=[], evidence={"configured": True, "reachable": False, "error": type(exc).__name__}, settings_link=link, problem=p, source="live")
    ours = sorted(n for n in streams if n.startswith(g2.STREAM_PREFIX))
    online = sum(1 for n in ours if streams[n].online)
    foreign = len(streams) - len(ours)
    missing = [n for n in expected if n not in streams]
    version = info.get("version") if isinstance(info, dict) else None
    evidence = {"configured": True, "reachable": True, "version": version, "streams": ours, "online": online, "foreign": foreign, "expected_streams": len(expected), "missing": missing}
    facts = [
        _fact(t("wizard.go2rtc.version"), version, "ok" if version else ""),
        _fact(t("wizard.go2rtc.ours"), t("wizard.go2rtc.ours_value", n=len(ours), online=online), "ok" if ours else "err"),
        _fact(t("wizard.go2rtc.expected"), t("wizard.go2rtc.expected_value", n=len(expected), missing=len(missing)), "ok" if not missing else "warn"),
        _fact(t("wizard.go2rtc.foreign"), t("wizard.go2rtc.foreign_value", n=foreign)),
    ]
    if expected and not ours:
        p = _problem("no_streams", t("wizard.go2rtc.no_streams"), t("wizard.go2rtc.no_streams_action", link=link["label"]), link)
        return _step("go2rtc", "failed", p["message"], facts=facts, evidence=evidence, settings_link=link, problem=p, source="live")
    warnings = []
    if missing:
        warnings.append(_warning("streams_missing", t("wizard.go2rtc.streams_missing", n=len(missing), example=missing[0]), link))
    if not expected and not is_ha_only(settings):
        warnings.append(_warning("no_cameras_yet", t("wizard.go2rtc.no_cameras_yet"), _link("connections")))
    return _step("go2rtc", "done", t("wizard.go2rtc.done", version=version or '?', n=len(ours), online=online), facts=facts, evidence=evidence, settings_link=link, warnings=warnings, source="live")


# ---------------------------------------------------------------- steps 5-6: floor and camera (local)

def _published_floors(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        """SELECT f.id, f.name, b.name AS building, MAX(v.published_at) AS published_at FROM floors f
           JOIN buildings b ON b.id = f.building_id AND b.deleted_at IS NULL
           JOIN sites s ON s.id = b.site_id AND s.deleted_at IS NULL
           JOIN plan_versions v ON v.floor_id = f.id AND v.status = 'published'
           WHERE f.deleted_at IS NULL GROUP BY f.id ORDER BY b.sort_order, f.sort_order, f.level""").fetchall()


def floor_step(conn: sqlite3.Connection) -> dict[str, Any]:
    link = _link("sites")
    sites = conn.execute("SELECT id FROM sites WHERE deleted_at IS NULL ORDER BY sort_order").fetchall()
    buildings = conn.execute("SELECT b.id FROM buildings b JOIN sites s ON s.id = b.site_id AND s.deleted_at IS NULL WHERE b.deleted_at IS NULL ORDER BY b.sort_order").fetchall()
    floors = conn.execute(
        """SELECT f.id, f.name FROM floors f JOIN buildings b ON b.id = f.building_id AND b.deleted_at IS NULL JOIN sites s ON s.id = b.site_id AND s.deleted_at IS NULL
           WHERE f.deleted_at IS NULL ORDER BY b.sort_order, f.sort_order, f.level""").fetchall()
    published = _published_floors(conn)
    drafts = {r[0] for r in conn.execute("SELECT DISTINCT floor_id FROM plan_versions WHERE status = 'draft'")}
    pub_ids = {r["id"] for r in published}
    evidence = {"sites": len(sites), "buildings": len(buildings), "floors": len(floors), "floors_published": len(published),
                "published": [{"id": r["id"], "name": r["name"], "building": r["building"], "published_at": r["published_at"]} for r in published[:10]],
                "without_plan": [{"id": r["id"], "name": r["name"], "draft": r["id"] in drafts} for r in floors if r["id"] not in pub_ids][:10]}
    facts = [
        _fact(t("wizard.floor.counts"), f"{len(sites)} · {len(buildings)} · {len(floors)}", "ok" if floors else "warn"),
        _fact(t("wizard.floor.published"), t("wizard.of", a=len(published), b=len(floors)), "ok" if published else "warn"),
    ]
    if published:
        facts.append(_fact(t("wizard.floor.example"), " · ".join(f"{r['building']} / {r['name']}" for r in published[:3])))
    if not sites or not buildings:
        p = _problem("no_building", t("wizard.floor.no_building"), t("wizard.floor.no_building_action", link=link["label"]), link)
        return _step("floor", "todo", p["message"], facts=facts, evidence=evidence, settings_link=link, problem=p)
    if not floors:
        b = buildings[0]["id"]
        p = _problem("no_floor", t("wizard.floor.no_floor"), t("wizard.floor.no_floor_action"), {"href": f"#/explore/buildings/{b}/floors", "label": t("wizard.link.building_floors")})
        return _step("floor", "todo", p["message"], facts=facts, evidence=evidence, settings_link=link, problem=p)
    if not published:
        f = floors[0]
        if f["id"] in drafts:
            p = _problem("plan_not_published", t("wizard.floor.draft", name=f['name']), t("wizard.floor.draft_action"),
                         {"href": f"#/explore/floors/{f['id']}/import", "label": t("wizard.link.import_publish")})
        else:
            p = _problem("no_plan", t("wizard.floor.no_plan", name=f['name']), t("wizard.floor.no_plan_action"),
                         {"href": f"#/explore/floors/{f['id']}/import", "label": t("wizard.link.import_floor")})
        return _step("floor", "todo", p["message"], facts=facts, evidence=evidence, settings_link=link, problem=p)
    warnings = []
    if len(published) < len(floors):
        f = next(r for r in floors if r["id"] not in pub_ids)
        warnings.append(_warning("floors_without_plan", t("wizard.floor.without_plan", n=len(floors) - len(published), name=f['name']),
                                 {"href": f"#/explore/floors/{f['id']}/import", "label": t("wizard.link.import")}))
    return _step("floor", "done", t("wizard.floor.done", n=len(published)), facts=facts, evidence=evidence, settings_link=link, warnings=warnings)


def _has_stream(caps_json: str | None) -> bool:
    try:
        return bool(json.loads(caps_json or "{}").get("stream"))
    except (ValueError, AttributeError):
        return False


def camera_step(conn: sqlite3.Connection, nvr_status: str) -> dict[str, Any]:
    cams = conn.execute("SELECT id, channel, alias, name_source, enabled, status, capabilities_json FROM cameras ORDER BY sort_order, channel").fetchall()
    placed_rows = conn.execute(
        """SELECT DISTINCT a.resource_id, a.floor_id FROM map_anchors a JOIN floors f ON f.id = a.floor_id AND f.deleted_at IS NULL
           WHERE a.resource_type = 'camera' AND a.effective_to IS NULL""").fetchall()
    placed = {r["resource_id"] for r in placed_rows}
    published = _published_floors(conn)
    name = {r["id"]: (r["alias"] or r["name_source"] or t("wizard.channel", n=r['channel'])) for r in cams}
    unplaced = [r["id"] for r in cams if r["enabled"] and r["id"] not in placed]
    with_stream = sum(1 for r in cams if _has_stream(r["capabilities_json"]))
    offline = sum(1 for r in cams if r["status"] == "offline")
    placed_known = [cid for cid in placed if cid in name]
    editor = {"href": f"#/explore/floors/{published[0]['id']}/edit", "label": t("wizard.link.editor")} if published else _link("sites")
    evidence = {"cameras": len(cams), "enabled": sum(1 for r in cams if r["enabled"]), "placed": len(placed_known), "unplaced": [{"id": c, "name": name[c]} for c in unplaced[:10]],
                "with_stream_profile": with_stream, "offline": offline}
    facts = [
        _fact(t("wizard.camera.registered"), f"{len(cams)} ({evidence['enabled']})", "ok" if cams else "warn"),
        _fact(t("wizard.camera.placed"), t("wizard.of", a=len(placed_known), b=evidence['enabled']), "ok" if placed_known else "warn"),
        _fact(t("wizard.camera.with_stream"), t("wizard.of", a=with_stream, b=len(cams)), "ok" if cams and with_stream == len(cams) else ""),
    ]
    if not cams:
        if nvr_status != "done":
            p = _problem("waiting_for_nvr", t("wizard.camera.waiting_for_nvr"), t("wizard.camera.waiting_for_nvr_action"), _link("connections"))
            return _step("camera", "skipped", p["message"], facts=facts, evidence=evidence, settings_link=editor, problem=p)
        p = _problem("no_cameras", t("wizard.camera.none"), t("wizard.camera.none_action", link=LINKS["devices"][1]), _link("devices"))
        return _step("camera", "todo", p["message"], facts=facts, evidence=evidence, settings_link=editor, problem=p)
    if not published:
        p = _problem("waiting_for_floor", t("wizard.camera.waiting_for_floor"), t("wizard.camera.waiting_for_floor_action"), _link("sites"))
        return _step("camera", "skipped", p["message"], facts=facts, evidence=evidence, settings_link=editor, problem=p)
    if not placed_known:
        p = _problem("no_camera_placed", t("wizard.camera.none_placed"), t("wizard.camera.none_placed_action"), editor)
        return _step("camera", "todo", p["message"], facts=facts, evidence=evidence, settings_link=editor, problem=p)
    warnings = []
    if unplaced:
        warnings.append(_warning("cameras_unplaced", t("wizard.camera.unplaced", n=len(unplaced), name=name[unplaced[0]]), editor))
    if offline:
        warnings.append(_warning("cameras_offline", t("wizard.camera.offline", n=offline), _link("devices")))
    return _step("camera", "done", t("wizard.camera.done", n=len(placed_known)), facts=facts, evidence=evidence, settings_link=editor, warnings=warnings)


# ---------------------------------------------------------------- NVR-less mode (mode.py)

NVR_LESS_SKIP = t("wizard.nvrless.skip")
# CR-022: the connection is entered in Arx (הגדרות › חיבורים), never in the platform's options
NVR_LESS_ACTION = t("wizard.nvrless.action")
NVR_CHOICE_ACTION = t("wizard.nvrless.choice_action")
NVR_RESTART_ACTION = t("wizard.nvrless.restart_action")
NVR_UNREADABLE_ACTION = t("wizard.nvrless.unreadable_action")
NVR_REFUSED_ACTION = t("wizard.nvrless.refused_action")


def not_applicable_step(step_id: str, summary: str, problem: dict[str, Any], link: dict[str, str], *, label: str = NVR_LESS_SKIP) -> dict[str, Any]:
    """A step that is not part of this installation: neither done nor failed, and not counted in `total`."""
    return _step(step_id, "not_applicable", summary, facts=[_fact(t("wizard.nvrless.mode_fact"), t("wizard.nvrless.no_nvr"))], evidence={"configured": False, "mode": "ha_only"},
                 settings_link=link, problem=problem) | {"status_label": label}


def nvr_choice_step(conn: sqlite3.Connection | None, settings: Settings | None = None) -> dict[str, Any]:
    """CR-022 section 11: the NVR step of an installation without an NVR host. `done` for the installer's explicit "no NVR"
    (vendor `none` stored), `failed` for a stored connection that cannot be decrypted or whose host was refused at start-up
    (review F5, `connection_refused`), `todo` while nothing was chosen - and
    `todo` for a connection that was just saved and waits for the restart that applies it (slice C: it is not unreadable)."""
    from .connection_store import get_row, readable

    link = _link("connections")
    row = get_row(conn) if conn is not None else None
    other = further_recorders_step(settings, conn)  # CR-024: a recorder connected under a new id (not nvr-1)
    if other is not None:
        return other
    if row is not None and row["vendor"] == "none":
        return _step("nvr", "done", t("wizard.nvrless.chosen"), facts=[_fact(t("wizard.nvrless.type_fact"), t("wizard.nvrless.no_nvr"), "ok")], evidence={"configured": False, "mode": "ha_only", "choice": "none"},
                     settings_link=link) | {"status_label": t("wizard.nvrless.no_nvr")}
    # `refused` describes the row this process loaded at start-up; a row saved since (another revision) waits for the restart
    loaded = row is not None and settings is not None and settings.nvr_connection_revision == int(row["revision"])
    if loaded and settings.nvr_connection_state == "refused":  # CR-022 review F5: the stored host failed the source policy at start-up
        p = _problem("connection_refused", t("wizard.nvrless.refused"), NVR_REFUSED_ACTION, link)
        return _step("nvr", "failed", p["message"], facts=[_fact(t("wizard.nvrless.saved_address"), t("wizard.nvrless.not_allowed"), "err")], evidence={"configured": False, "state": "refused"},
                     settings_link=link, problem=p)
    if row is not None and conn is not None and settings is not None and readable(conn, settings, row):
        p = _problem("restart_pending", t("wizard.nvr.saved_restart"), NVR_RESTART_ACTION, link)
        return _step("nvr", "todo", p["message"], facts=[_fact(t("wizard.nvr.fact_saved"), t("wizard.nvr.saved_waiting"), "warn")], evidence={"configured": False, "state": "pending_restart"},
                     settings_link=link, problem=p)
    if row is not None:
        p = _problem("connection_unreadable", t("wizard.nvrless.unreadable"), NVR_UNREADABLE_ACTION, link)
        return _step("nvr", "failed", p["message"], facts=[_fact(t("wizard.nvr.fact_saved"), t("wizard.nvrless.not_readable"), "err")], evidence={"configured": False, "state": "unreadable"},
                     settings_link=link, problem=p)
    p = _problem("nvr_choice_needed", t("wizard.nvrless.choice_needed"), NVR_CHOICE_ACTION, link)
    return _step("nvr", "todo", p["message"], facts=[_fact(t("wizard.nvrless.type_fact"), t("wizard.nvrless.not_chosen"), "warn")], evidence={"configured": False, "mode": "ha_only", "choice": None},
                 settings_link=link, problem=p)


def nvr_less_steps(settings: Settings, conn: sqlite3.Connection | None = None) -> dict[str, dict[str, Any]]:
    """The NVR and camera steps (and go2rtc while it is not configured - optional here, only WisKey station video uses it)
    in the NVR-less mode. CR-022: the NVR step itself asks for an explicit choice (`nvr_choice_step`)."""
    conn_link = _link("connections")
    p = _problem("nvr_less_mode", t("wizard.nvrless.mode"), NVR_LESS_ACTION, conn_link)
    out = {
        "nvr": nvr_choice_step(conn, settings),
        "camera": not_applicable_step("camera", t("wizard.nvrless.camera"), p, _link("sites")),
    }
    if not settings.go2rtc_url and not settings.wiskey_user:  # WisKey station stills and video need go2rtc
        g = _problem("go2rtc_optional", t("wizard.nvrless.go2rtc"), t("wizard.nvrless.go2rtc_action"), _link("media"))
        out["go2rtc"] = not_applicable_step("go2rtc", t("wizard.nvrless.go2rtc_summary"), g, _link("media"), label=t("wizard.nvrless.go2rtc_skip"))
    return out


# ---------------------------------------------------------------- state and checks

def _cached_live(step_id: str) -> dict[str, Any] | None:
    with _lock:
        hit = _live.get(step_id)
    if hit and time.time() - hit[0] < LIVE_TTL_S:
        return hit[1]
    return None


def _remember(step_id: str, result: dict[str, Any]) -> None:
    with _lock:
        _live[step_id] = (time.time(), result)
        if step_id == "go2rtc":
            _go2rtc_ok.clear()  # a failed check forgets the last success: it must not read "done" once the cache expires
            if result.get("status") == "done":
                _go2rtc_ok.update(result)


BACKGROUND: dict[str, Callable[[Settings, sqlite3.Connection], dict[str, Any]]] = {
    "nvr": nvr_background,
    "ha": lambda s, c: ha_step(s, c),
    "go2rtc": go2rtc_background,
}


def build_state(settings: Settings, conn: sqlite3.Connection, identity_source: str, *, deep_install: bool = False) -> dict[str, Any]:
    """Every step without touching a device: local steps now, device steps from the last live probe or the background."""
    steps: dict[str, dict[str, Any]] = {"install": install_step(settings, conn, identity_source, deep=deep_install)}
    skipped = nvr_less_steps(settings, conn) if is_ha_only(settings) else {}
    for sid in DEVICE_STEPS:
        if sid in skipped:
            steps[sid] = skipped[sid]
            continue
        live = _cached_live(sid)
        if sid == "ha" and live is not None:
            # the cached HA result is the probe's own facts (reachability, version, clock); the bridge / sync part may have
            # moved on since (HA restarted, the bridge paired) and is read now, and so is the NVR-HA clock gap
            steps[sid] = ha_step(settings, conn, live=_with_nvr_gap(live), source="live") | {"checked_at": live["checked_at"]}
        else:
            steps[sid] = live if live is not None else BACKGROUND[sid](settings, conn)
    steps["floor"] = floor_step(conn)
    steps["camera"] = skipped.get("camera") or camera_step(conn, steps["nvr"]["status"])
    ordered = [steps[s] for s in STEPS]
    required = [s for s in ordered if s["status"] != "not_applicable"]  # a step skipped on purpose is not counted
    done = sum(1 for s in required if s["status"] == "done")
    nxt = next((s["id"] for s in required if s["status"] != "done"), None)
    caps = resolve_capabilities(settings, conn)  # NVRLESS-CAMERAS-2411: cameras without a recorder count
    must = [s for s in required if not s["optional"]]  # TKWIZHINT: the shell hint and `ready` follow the required steps only
    must_done = sum(1 for s in must if s["status"] == "done")
    must_next = next((s["id"] for s in must if s["status"] != "done"), None)
    return {
        "version": __version__, "mode": installation_mode(settings), "checked_at": now_iso(), "steps": ordered, "done": done, "total": len(required),
        "required_done": must_done, "required_total": len(must), "required_failed": [s["id"] for s in must if s["status"] == "failed"],
        # NN1: an unsupported installation (an NVR without go2rtc) never reaches "ready", whatever the steps say
        "ready": must_done == len(must) and caps.supported, "next": must_next or nxt,
        "capabilities": caps.as_dict(with_recorders=True), "installation": installation_block(caps),  # system.configure only
        "thresholds": {"drift_ok_s": DRIFT_OK_S, "drift_fail_s": DRIFT_FAIL_S}, "check_every_s": CHECK_EVERY_S, "live_ttl_s": LIVE_TTL_S,
    }


def rate_limit(user_id: str, step_id: str) -> float | None:
    """Take this user's slot for the step (one per CHECK_EVERY_S, atomically: parallel requests get one slot); returns the
    previous slot for `refund`."""
    now = time.monotonic()
    with _lock:
        last = _last_check.get((user_id, step_id))
        if last is not None and now - last < CHECK_EVERY_S:
            wait = max(1, math.ceil(CHECK_EVERY_S - (now - last)))
            raise ApiError(429, "check_rate_limited", t("wizard.rate_limited", wait=wait), retryable=True, details={"retry_after_s": wait, "step": step_id})
        _last_check[(user_id, step_id)] = now
    return last


def refund(user_id: str, step_id: str, previous: float | None) -> None:
    """A check that failed with an unexpected error (a 500) gives its slot back."""
    with _lock:
        if previous is None:
            _last_check.pop((user_id, step_id), None)
        else:
            _last_check[(user_id, step_id)] = previous


# ---------------------------------------------------------------- on-demand checks (device calls with a deadline)

CHECK_DEADLINE_S = 20.0  # a whole check, however many device calls it makes (each has its own shorter timeout)
_pool = ThreadPoolExecutor(max_workers=3, thread_name_prefix="setup-check")
_inflight: dict[str, Future] = {}

TIMEOUT_TEXT = {
    "nvr": (t("wizard.timeout.who_nvr"), t("wizard.timeout.nvr_action"), "connections"),
    "go2rtc": ("go2rtc", t("wizard.timeout.go2rtc_action"), "media"),
    "ha": ("Home Assistant", t("wizard.timeout.ha_action"), "ha"),
}


def configured(settings: Settings, step_id: str) -> bool:
    return {"nvr": _nvr_configured(settings), "go2rtc": bool(settings.go2rtc_url), "ha": ha_client.configured(settings)}.get(step_id, False)


def prepare(conn: sqlite3.Connection, step_id: str) -> dict[str, Any]:
    """What a probe needs from the database, read before the device calls so that no read transaction spans them."""
    disabled = {int(r[0]) for r in conn.execute("SELECT channel FROM cameras WHERE enabled = 0").fetchall()} if step_id == "nvr" else set()
    return {"tz": _tz_name(conn), "expected": _expected_streams(conn) if step_id == "go2rtc" else [], "disabled": disabled}


def _probe(settings: Settings, step_id: str, inputs: dict[str, Any]) -> dict[str, Any]:
    if step_id == "nvr":
        return nvr_probe(settings, inputs["tz"], disabled=frozenset(inputs.get("disabled") or ()))
    if step_id == "go2rtc":
        return go2rtc_probe(settings, [] if is_ha_only(settings) else inputs["expected"])  # NVR-less: no camera streams expected
    return ha_probe(settings, inputs["tz"])


def _timed_out(step_id: str) -> dict[str, Any]:
    who, action, link_key = TIMEOUT_TEXT[step_id]
    if step_id == "ha":
        return {"error": "check_timeout", "reachable": False, "checked_at": now_iso()}
    p = _problem("check_timeout", t("wizard.timeout", who=who, seconds=f"{CHECK_DEADLINE_S:g}"), action, _link(link_key))
    return _step(step_id, "failed", p["message"], facts=[_fact(t("wizard.answer"), t("wizard.not_in_time"), "err")], evidence={"configured": True, "reachable": False, "error": "check_timeout"},
                 settings_link=_link(link_key), problem=p, source="live")


def run_check(settings: Settings, step_id: str, inputs: dict[str, Any]) -> dict[str, Any] | None:
    """Probe one device step now - device calls only, no database connection - within CHECK_DEADLINE_S, and remember the
    result. A probe of the same step that is still running (a slow device) is joined, not started twice. Local steps and
    unconfigured devices need no probe: the state re-reads them. An unexpected error propagates (the caller refunds)."""
    if step_id not in DEVICE_STEPS or not configured(settings, step_id) or (step_id == "nvr" and is_ha_only(settings)):
        return None
    with _lock:
        fut = _inflight.get(step_id)
        if fut is None or fut.done():
            fut = _pool.submit(_probe, settings, step_id, inputs)
            _inflight[step_id] = fut
    try:
        result = fut.result(timeout=CHECK_DEADLINE_S)
    except FutureTimeout:
        result = _timed_out(step_id)
    _remember(step_id, result)
    return result


register_reset(__name__, ("_live", "_inflight", "_last_check", "_go2rtc_ok"), reset)  # CR-BE-COMPLEXITY-B-2450: module-level tables (tests/test_singletons_registered.py)
