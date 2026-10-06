"""MU2 voice announcements (הכרזות קוליות): speak a typed text through the speakers an administrator allowed, by room or by device.

The smallest useful slice:
- the PATH is the infrastructure's own `tts.speak` (engine entity + the speaker's media_player entity), sent with the add-on's token like
  the rule action `ha_notify` does; no new bridge action, no new integration. Authority is the VMS's: `media.announce` (sensitive,
  installation scope) to speak, `system.configure` to set it up and to press the test button. A client flag grants nothing.
- the TARGET is never free: only approved speaker / player / receiver / group devices the administrator ticked (`announce.devices`)
  can be spoken to; a room means the allowed devices whose anchor sits in that area; nothing is allowed by default and the feature is
  OFF by default.
- the TEXT is one line, at most MAX_TEXT characters, no control characters, no markup (tag-like runs and angle brackets are
  removed, so an SSML-detecting engine never sees SSML), never a template: what is typed is what is spoken.
- the RATE LIMIT is the table itself: `announce.max_per_minute` attempts a minute for the installation (default 6) and one per
  COOLDOWN_S seconds for the same room / device (and for any speaker it reaches, however it is addressed); a limited attempt is logged as `limited` and answers 429.
- every attempt (spoken, failed, limited, refused) is one `announcements` row AND one audit row (`media.announce`).
- ANN2 extras, all off by default: a per-announcement VOLUME (clamped 0-100, applied before the speech and restored after it when the player exposes
  `volume_level`; a player that does not is skipped silently and the reason is a note on the row and in the audit details), PAUSE MUSIC (a
  speaker that was playing is paused, the speech is waited for with bounded timeouts, and only a player we paused and that nobody stopped, powered
  off or restarted meanwhile is resumed), QUIET HOURS (`announce.quiet`: the notification centre's window logic and clock seam; mode `suppress`
  or `lower` with a night volume; an announcement marked `critical`, and a critical notification, is exempt) and the notification-policy
  CHANNEL `announce` (services/announce_channel.py; routing by category and severity lives in `announce.notify`).
- the speak call is `SPEAK`; tests replace it with a fake, so no test ever reaches a real device. A rule's announce action is
  collected by services/rules.py and run after the ingest commit through `run_for_rule`; a rule never raises into ingestion.
"""
from __future__ import annotations

import datetime as dt
import json
import logging
import re
import sqlite3
import time
from typing import Any

from ..audit import audit
from ..config import Settings
from ..db import get_setting, new_id, now_iso, set_setting, unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize
from . import media_model as mm
from . import media_store as store
from .timeutil import iso_utc

log = logging.getLogger("smplwise.announce")

PERM = "media.announce"
CONFIGURE = "system.configure"
MAX_TEXT = 200
COOLDOWN_S = 5
TEST_TEXT = {"he": "זוהי הכרזת בדיקה של המערכת.", "en": "This is a system test announcement."}
K_ENABLED, K_ENGINE, K_LANG, K_DEVICES, K_MAX = "announce.enabled", "announce.engine", "announce.language", "announce.devices", "announce.max_per_minute"
K_VOLUME, K_PAUSE, K_QUIET, K_NOTIFY = "announce.volume", "announce.pause_music", "announce.quiet", "announce.notify"
DEFAULT_QUIET: dict[str, Any] = {"enabled": False, "from": "22:00", "to": "07:00", "days": ["sun", "mon", "tue", "wed", "thu", "fri", "sat"], "mode": "suppress", "night_volume": None}
QUIET_MODES = ("suppress", "lower")
DEFAULT_NOTIFY: dict[str, Any] = {"enabled": False, "scope": "area", "ref": "", "categories": [], "min_severity": "alert"}
DEFAULTS = {K_ENABLED: "false", K_ENGINE: "", K_LANG: "he", K_DEVICES: "[]", K_MAX: "6", K_VOLUME: "", K_PAUSE: "false", K_QUIET: json.dumps(DEFAULT_QUIET), K_NOTIFY: json.dumps(DEFAULT_NOTIFY)}
# the speech is waited for only when a volume was set or music was paused: a poll every POLL_S, the speech must start within START_WAIT_S
# (a short clip may never show as `playing`) and is given at most MAX_SPEECH_S
POLL_S, START_WAIT_S, MAX_SPEECH_S = 1.0, 4.0, 45.0
VOLUME_SET_FEATURE = 4  # MediaPlayerEntityFeature.VOLUME_SET
ENGINE_RE = re.compile(r"^tts\.[a-z0-9_]{1,80}$")
LANG_RE = re.compile(r"^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8})?$")
CONTROL = re.compile("[\\x00-\\x1f\\x7f\\u2028\\u2029]")
# security review 2.2.0 L2: SSML-detecting engines would interpret markup (<break> chains past the limits, <audio src=...>);
# a tag-like run is removed and a lone angle bracket becomes a space - the engine only ever gets plain text
MARKUP = re.compile(r"<[^<>]{0,400}>")

# a stable message per code in both languages; `message` is Hebrew (the product language), `details.message_en` the English one
MESSAGES: dict[str, dict[str, str]] = {
    "feature_disabled": {"he": "ההכרזות כבויות בהגדרות.", "en": "Announcements are switched off in Settings."},
    "not_configured": {"he": "לא הוגדר מנוע דיבור.", "en": "No speech engine is configured."},
    "no_targets": {"he": "אין רמקול מורשה להכרזה במקום הזה.", "en": "No speaker is allowed to announce there."},
    "text_invalid": {"he": "ההודעה ריקה, ארוכה מדי או מכילה תווים אסורים.", "en": "The text is empty, too long or has forbidden characters."},
    "rate_limited": {"he": "יותר מדי הכרזות. נסו שוב בעוד רגע.", "en": "Too many announcements. Try again in a moment."},
    "speak_failed": {"he": "ההכרזה לא נשלחה.", "en": "The announcement was not sent."},
    "validation": {"he": "הבקשה אינה תקינה.", "en": "The request is not valid."},
    "quiet_hours": {"he": "שעות שקט: ההכרזה לא הושמעה.", "en": "Quiet hours: the announcement was not spoken."},
}


def err(status: int, code: str, **details: Any) -> ApiError:
    return ApiError(status, code, MESSAGES[code]["he"], details={**details, "message_en": MESSAGES[code]["en"]})


def default_speak(settings: Settings, engine: str, entity_ids: list[str], message: str, language: str) -> None:
    """The one call that reaches the infrastructure: `tts.speak` on the engine, played on the speakers. Raises ApiError when it refuses."""
    from . import ha_client

    ha_client.call_service(settings, "tts", "speak", {"entity_id": engine, "media_player_entity_id": entity_ids, "message": message, "language": language})


SPEAK = default_speak  # tests replace this: no test reaches a real device


def default_player_state(settings: Settings, entity_id: str) -> dict[str, Any] | None:
    from . import ha_client

    try:
        return ha_client.get_state(settings, entity_id)
    except Exception:  # noqa: BLE001 - an unreadable player is "unknown", never an error of the announcement
        return None


def default_player_call(settings: Settings, service: str, data: dict[str, Any]) -> None:
    from . import ha_client

    ha_client.call_service(settings, "media_player", service, data)


PLAYER_STATE = default_player_state  # tests replace these three (and SLEEP): no test reaches a real player or waits for real time
PLAYER_CALL = default_player_call
SLEEP = time.sleep


def _now() -> dt.datetime:
    from . import notify

    return notify.now_utc()  # the notification centre's clock seam: one place to move time in a test
_DB: list[Any] = []
_SETTINGS: list[Settings] = []


def attach(db: Any, settings: Settings) -> None:
    """Called once per app: a rule's announce action writes through `db` after the ingest commit."""
    _DB[:] = [db]
    _SETTINGS[:] = [settings]


# ------------------------------------------------------------------------------------------------ configuration

def config(conn: sqlite3.Connection) -> dict[str, Any]:
    def g(k: str) -> str:
        return get_setting(conn, k, DEFAULTS[k]) or DEFAULTS[k]

    try:
        devices = [d for d in json.loads(g(K_DEVICES)) if isinstance(d, str)]
    except ValueError:
        devices = []
    try:
        per_min = min(30, max(1, int(g(K_MAX))))
    except ValueError:
        per_min = int(DEFAULTS[K_MAX])
    return {"enabled": g(K_ENABLED) == "true", "engine": get_setting(conn, K_ENGINE) or "", "language": g(K_LANG), "devices": devices,
            "max_per_minute": per_min, "max_text": MAX_TEXT, "cooldown_s": COOLDOWN_S,
            "volume": _vol_or_none(get_setting(conn, K_VOLUME)), "pause_music": g(K_PAUSE) == "true",
            "quiet": _load_quiet(get_setting(conn, K_QUIET)), "notify": _load_notify(get_setting(conn, K_NOTIFY))}


def _vol_or_none(raw: Any) -> int | None:
    try:
        return clamp_volume(int(raw)) if raw not in (None, "") else None
    except (TypeError, ValueError):
        return None


def clamp_volume(v: Any) -> int:
    """A volume is a whole percent, clamped to 0-100 (never rejected for being out of range); anything that is not a number is invalid."""
    if isinstance(v, bool) or not isinstance(v, (int, float)) or v != v:
        raise err(422, "validation", fields=["volume"])
    return max(0, min(100, int(round(v))))


def _json_obj(raw: Any) -> dict[str, Any]:
    try:
        v = json.loads(raw or "")
        return v if isinstance(v, dict) else {}
    except ValueError:
        return {}


def _load_quiet(raw: Any) -> dict[str, Any]:
    from . import notify_settings as ns

    q = {**DEFAULT_QUIET, **{k: v for k, v in _json_obj(raw).items() if k in DEFAULT_QUIET}}
    try:
        base = ns._validate_quiet({k: q[k] for k in ("enabled", "from", "to", "days")})
    except ns.SettingsInvalid:
        base = {k: DEFAULT_QUIET[k] for k in ("enabled", "from", "to", "days")}
    return {**base, "mode": q["mode"] if q["mode"] in QUIET_MODES else "suppress", "night_volume": _vol_or_none(q.get("night_volume"))}


def _load_notify(raw: Any) -> dict[str, Any]:
    from . import notify_policy as np

    n = {**DEFAULT_NOTIFY, **{k: v for k, v in _json_obj(raw).items() if k in DEFAULT_NOTIFY}}
    return {"enabled": n["enabled"] is True, "scope": n["scope"] if n["scope"] in ("area", "device") else "area",
            "ref": n["ref"] if isinstance(n["ref"], str) and len(n["ref"]) <= 64 else "",
            "categories": [c for c in np.CATEGORIES if isinstance(n["categories"], list) and c in n["categories"]],
            "min_severity": n["min_severity"] if n["min_severity"] in np.SEVERITIES else "alert"}


def quiet_active(conn: sqlite3.Connection, now: dt.datetime, cfg: dict[str, Any] | None = None) -> bool:
    """Whether the announcement quiet window is active at `now` (the notification centre's `in_quiet_hours`, in the installation zone)."""
    from ..routers.settings import read_settings
    from . import notify_settings as ns

    q = (cfg or config(conn))["quiet"]
    return bool(q["enabled"]) and ns.in_quiet_hours(q, now, read_settings(conn)["time.zone"])


def update_config(conn: sqlite3.Connection, body: dict[str, Any]) -> list[str]:
    """PUT config (system.configure): every key optional, strict; returns the changed keys."""
    allowed = {"enabled", "engine", "language", "devices", "max_per_minute", "volume", "pause_music", "quiet", "notify"}
    if not isinstance(body, dict) or set(body) - allowed:
        raise err(422, "validation", fields=sorted(set(body) - allowed) if isinstance(body, dict) else ["body"])
    before = config(conn)
    out: dict[str, str] = {}
    for name, value in body.items():
        if name == "enabled" and isinstance(value, bool):
            out[K_ENABLED] = "true" if value else "false"
        elif name == "engine" and isinstance(value, str) and (value == "" or ENGINE_RE.match(value)):
            out[K_ENGINE] = value
        elif name == "language" and isinstance(value, str) and LANG_RE.match(value):
            out[K_LANG] = value
        elif name == "max_per_minute" and isinstance(value, int) and not isinstance(value, bool) and 1 <= value <= 30:
            out[K_MAX] = str(value)
        elif name == "volume" and (value is None or (isinstance(value, (int, float)) and not isinstance(value, bool))):
            out[K_VOLUME] = "" if value is None else str(clamp_volume(value))
        elif name == "pause_music" and isinstance(value, bool):
            out[K_PAUSE] = "true" if value else "false"
        elif name == "quiet" and isinstance(value, dict):
            out[K_QUIET] = json.dumps(_merge_quiet(before["quiet"], value))
        elif name == "notify" and isinstance(value, dict):
            out[K_NOTIFY] = json.dumps(_merge_notify(before["notify"], value))
        elif name == "devices" and isinstance(value, list) and len(value) <= 200 and all(isinstance(v, str) and 0 < len(v) <= 64 for v in value):
            known = {r["device_key"] for r in conn.execute("SELECT device_key FROM media_devices WHERE removed_at IS NULL AND kind != 'screen'").fetchall()}
            if any(v not in known for v in value):
                raise err(422, "validation", fields=["devices"])
            out[K_DEVICES] = json.dumps(sorted(set(value)))
        else:
            raise err(422, "validation", fields=[name])
    for k, v in out.items():
        set_setting(conn, k, v)
    after = config(conn)
    return sorted(k for k in before if k in body and before[k] != after[k])


def _merge_quiet(cur: dict[str, Any], body: dict[str, Any]) -> dict[str, Any]:
    from . import notify_settings as ns

    if set(body) - set(DEFAULT_QUIET):
        raise err(422, "validation", fields=["quiet"])
    mode = body.get("mode", cur["mode"])
    night = body.get("night_volume", cur["night_volume"])
    if mode not in QUIET_MODES:
        raise err(422, "validation", fields=["quiet.mode"])
    try:
        window = ns._validate_quiet({**{k: cur[k] for k in ("enabled", "from", "to", "days")}, **{k: v for k, v in body.items() if k in ("enabled", "from", "to", "days")}})
    except ns.SettingsInvalid:
        raise err(422, "validation", fields=["quiet"]) from None
    return {**window, "mode": mode, "night_volume": None if night is None else clamp_volume(night)}


def _merge_notify(cur: dict[str, Any], body: dict[str, Any]) -> dict[str, Any]:
    from . import notify_policy as np

    if set(body) - set(DEFAULT_NOTIFY):
        raise err(422, "validation", fields=["notify"])
    out = {**cur, **body}
    if not isinstance(out["enabled"], bool) or out["scope"] not in ("area", "device") or not isinstance(out["ref"], str) or len(out["ref"]) > 64 \
            or out["min_severity"] not in np.SEVERITIES or not isinstance(out["categories"], list) or any(c not in np.CATEGORIES for c in out["categories"]):
        raise err(422, "validation", fields=["notify"])
    out["categories"] = [c for c in np.CATEGORIES if c in out["categories"]]
    return out


# ------------------------------------------------------------------------------------------------ targets

def _audio_catalog(conn: sqlite3.Connection) -> store.Catalog:
    return store.load_catalog(conn, approved_only=True, kind=tuple(mm.AUDIO_KINDS))


def _speaker_entity(item: store.Item) -> str | None:
    anchor = item.row.get("anchor_entity_id")
    if anchor and anchor.startswith("media_player."):
        return anchor
    return next((e.ref for e in item.model.endpoints if e.domain == "media_player" and not e.hidden), None)


def admin_targets(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """Every approved speaker for the Settings list (system.configure): `{key, name, kind, floor_name, area_id, area_name, allowed}`."""
    allowed = set(config(conn)["devices"])
    out = []
    for item in _audio_catalog(conn).items.values():
        if not item.row["approved"] or _speaker_entity(item) is None:
            continue
        a = store.floor_area(item)
        out.append({"key": item.key, "name": item.name, "kind": item.row["kind"], "floor_name": a["floor_name"], "area_id": a["area_id"], "area_name": a["area_name"], "allowed": item.key in allowed})
    return sorted(out, key=lambda r: (r["floor_name"] or "", r["area_name"] or "", r["name"] or ""))


def areas(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """The rooms that have at least one allowed speaker, for the announce form: `{area_id, name, floor_name, devices: [{key, name}]}`."""
    by_area: dict[str, dict[str, Any]] = {}
    allowed = set(config(conn)["devices"])
    for item in _audio_catalog(conn).items.values():
        a = store.floor_area(item)
        if item.key not in allowed or not a["area_id"] or _speaker_entity(item) is None:
            continue
        row = by_area.setdefault(a["area_id"], {"area_id": a["area_id"], "name": a["area_name"] or a["area_id"], "floor_name": a["floor_name"], "devices": []})
        row["devices"].append({"key": item.key, "name": item.name})
    return sorted(by_area.values(), key=lambda r: (r["floor_name"] or "", r["name"]))


def resolve(conn: sqlite3.Connection, scope: str, ref: str) -> list[tuple[str, str]]:
    """The (device key, speaker entity) pairs an announcement to `scope` (`device` | `area`) `ref` reaches: approved, allowed by the administrator,
    each entity once. An unknown or not-allowed device is an empty list (`no_targets`); the caller never learns which."""
    allowed = set(config(conn)["devices"])
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for item in sorted(_audio_catalog(conn).items.values(), key=lambda i: i.key):
        if item.key not in allowed or not item.row["approved"]:
            continue
        if scope == "device" and item.key != ref:
            continue
        if scope == "area" and store.floor_area(item)["area_id"] != ref:
            continue
        ent = _speaker_entity(item)
        if ent and ent not in seen:
            seen.add(ent)
            out.append((item.key, ent))
    return out


def clean_text(text: Any) -> str:
    if not isinstance(text, str):
        raise err(422, "text_invalid")
    # checked BEFORE the whitespace fold (str.split() would swallow the separator controls and U+2028); a newline and a tab are plain spaces
    if CONTROL.search(text.translate({10: " ", 9: " "})):
        raise err(422, "text_invalid")
    t = " ".join(MARKUP.sub(" ", text).replace("<", " ").replace(">", " ").split())
    if not t or len(t) > MAX_TEXT:
        raise err(422, "text_invalid")
    return t


# ------------------------------------------------------------------------------------------------ the announcement

def _limited(conn: sqlite3.Connection, scope: str, ref: str, per_min: int, now: dt.datetime, keys: list[str] | None = None) -> str | None:
    n = conn.execute("SELECT COUNT(*) FROM announcements WHERE at >= ? AND status IN ('pending', 'sent', 'failed')", (iso_utc(now - dt.timedelta(seconds=60)),)).fetchone()[0]
    if n >= per_min:
        return "per_minute"
    since = iso_utc(now - dt.timedelta(seconds=COOLDOWN_S))
    recent = conn.execute("SELECT 1 FROM announcements WHERE at >= ? AND scope = ? AND scope_ref = ? AND status IN ('pending', 'sent', 'failed') LIMIT 1",
                          (since, scope, ref)).fetchone()
    if recent:
        return "cooldown"
    # security review 2.2.0 L3: the cooldown is per SPEAKER too - the same device addressed alternately as `device:<key>` and
    # `area:<area>` must not double its rate
    if keys:
        want = set(keys)
        for (targets,) in conn.execute("SELECT targets_json FROM announcements WHERE at >= ? AND status IN ('pending', 'sent', 'failed')", (since,)).fetchall():
            try:
                if want & set(json.loads(targets or "[]")):
                    return "cooldown"
            except (ValueError, TypeError):
                continue
    return None


def _record(conn: sqlite3.Connection, principal: Principal | None, source: str, rule_id: str | None, scope: str, ref: str, keys: list[str], text: str, status: str, error: str | None, now: dt.datetime, notification_id: str | None = None) -> str:
    aid = new_id()
    conn.execute("INSERT INTO announcements(id, at, source, user_id, username, rule_id, scope, scope_ref, targets_json, message, status, error, notification_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                 (aid, iso_utc(now), source, getattr(principal, "user_id", None), getattr(principal, "username", None), rule_id, scope, ref[:64], json.dumps(keys), text, status, error, notification_id))
    return aid


def _audit(conn: sqlite3.Connection, principal: Principal | None, request_id: str | None, source: str, scope: str, ref: str, keys: list[str], status: str, error: str | None, rule_id: str | None, length: int, extra: dict[str, Any] | None = None) -> None:
    audit(conn, actor=principal, action="media.announce", decision="denied" if status in ("refused", "limited") else "allowed", resource_type="announcement", resource_id=f"{scope}:{ref}",
          reason=error, request_id=request_id, details={"source": source, "scope": scope, "targets": len(keys), "status": status, "length": length, **({"rule_id": rule_id} if rule_id else {}), **(extra or {})})


def _state_of(settings: Settings, entity: str) -> tuple[str | None, dict[str, Any]]:
    st = PLAYER_STATE(settings, entity)
    if not isinstance(st, dict):
        return None, {}
    return st.get("state"), st.get("attributes") if isinstance(st.get("attributes"), dict) else {}


def _call(settings: Settings, service: str, entity: str, **data: Any) -> bool:
    try:
        PLAYER_CALL(settings, service, {"entity_id": entity, **data})
        return True
    except Exception:  # noqa: BLE001 - a volume or pause that did not work is a note, never a failed announcement
        return False


def effective_volume(cfg: dict[str, Any], volume: Any, lowered: bool) -> int | None:
    """The explicit volume of this announcement, else the configured default; at night (mode `lower`) never above the night volume."""
    v = clamp_volume(volume) if volume is not None else cfg["volume"]
    night = cfg["quiet"]["night_volume"]
    if lowered and night is not None:
        v = night if v is None else min(v, night)
    return v


def _play(settings: Settings, cfg: dict[str, Any], engine: str, pairs: list[tuple[str, str]], text: str, volume: int | None, notes: list[str]) -> None:
    """Speak, with the optional volume and pause-music handling around it (all of it outside the database write lock). Without a volume and
    without pause-music this is exactly the single SPEAK call. Never raises for the extras: a note says what was skipped and why."""
    touched: list[dict[str, Any]] = []
    if volume is not None or cfg["pause_music"]:
        for key, ent in pairs:
            t: dict[str, Any] = {"key": key, "entity": ent, "paused": False, "prev": None, "set": None, "gone": False}
            state, attrs = _state_of(settings, ent)
            if cfg["pause_music"] and state == "playing":
                if _call(settings, "media_pause", ent):
                    t["paused"] = True
                else:
                    notes.append(f"pause_failed:{key}")
            if volume is not None:
                level = attrs.get("volume_level")
                if state is None:
                    notes.append(f"volume_skipped:{key}:state_unavailable")
                elif isinstance(level, bool) or not isinstance(level, (int, float)):
                    notes.append(f"volume_skipped:{key}:no_volume_level")
                elif "supported_features" in attrs and not (int(attrs.get("supported_features") or 0) & VOLUME_SET_FEATURE):
                    notes.append(f"volume_skipped:{key}:not_supported")
                elif _call(settings, "volume_set", ent, volume_level=volume / 100):
                    t["prev"], t["set"] = float(level), volume / 100
                else:
                    notes.append(f"volume_skipped:{key}:set_failed")
            touched.append(t)
        for t in touched:  # best effort: a paused player that now reads stopped / off was stopped by someone, so it is never resumed
            if t["paused"]:
                state, _a = _state_of(settings, t["entity"])
                if state in ("idle", "off", "standby", "unavailable"):
                    t["paused"], t["gone"] = False, True
                    notes.append(f"resume_skipped:{t['key']}:stopped_meanwhile")
    spoken = False
    try:
        SPEAK(settings, engine, [e for _k, e in pairs], text, cfg["language"])
        spoken = True
    finally:
        if touched:
            _settle(settings, touched, spoken, notes)


def _settle(settings: Settings, touched: list[dict[str, Any]], spoken: bool, notes: list[str]) -> None:
    """Wait (bounded) for the speech to end on the touched players, then put the volume back and resume what we paused. When the speech
    never started (the engine refused) there is nothing to wait for and the music resumes at once."""
    timed_out = False
    if spoken:
        started = {t["entity"]: False for t in touched}
        pending = {t["entity"]: t for t in touched}
        elapsed = 0.0
        while pending and elapsed < MAX_SPEECH_S:
            for ent in list(pending):
                state, _a = _state_of(settings, ent)
                if state in ("playing", "buffering"):
                    started[ent] = True
                elif state in ("off", "standby", "unavailable"):
                    pending[ent]["gone"] = True
                    del pending[ent]
                elif started[ent] or elapsed >= START_WAIT_S:
                    del pending[ent]
            if pending:
                SLEEP(POLL_S)
                elapsed += POLL_S
        timed_out = bool(pending)
        if timed_out:
            notes.append("speech_timeout")
    for t in touched:
        key, ent = t["key"], t["entity"]
        if t["set"] is not None and not t["gone"]:
            state, attrs = _state_of(settings, ent)
            cur = attrs.get("volume_level")
            if state is not None and isinstance(cur, (int, float)) and abs(float(cur) - t["set"]) > 0.011:
                notes.append(f"volume_not_restored:{key}:changed_meanwhile")  # someone moved the slider: that choice stands
            elif not _call(settings, "volume_set", ent, volume_level=t["prev"]):
                notes.append(f"volume_not_restored:{key}:set_failed")
        if t["paused"]:
            if timed_out:
                notes.append(f"resume_skipped:{key}:speech_timeout")
                continue
            state, _a = _state_of(settings, ent)
            if t["gone"] or state in ("off", "standby", "unavailable", None):
                notes.append(f"resume_skipped:{key}:{state or 'state_unavailable'}")
            elif state == "playing" and spoken:
                notes.append(f"resume_skipped:{key}:already_playing")  # someone else started something meanwhile
            elif not _call(settings, "media_play", ent):
                notes.append(f"resume_failed:{key}")


def announce(conn: sqlite3.Connection, settings: Settings, principal: Principal | None, request_id: str | None, *, source: str, scope: str, ref: str, text: Any,
             rule_id: str | None = None, now: dt.datetime | None = None, unlock: Any = None, volume: Any = None, critical: bool = False,
             notification_id: str | None = None) -> dict[str, Any]:
    """Check, record, speak, record the outcome. `unlock` is a context-manager factory (db.unlocked bound to the request's connection) that
    releases the write lock around the speak call; None (a test) calls it directly. A refusal is logged and audited first, then
    raised as an ApiError (the request still commits it). `volume` is a whole percent (clamped); `critical` is exempt from the quiet hours.
    Returns `{id, status: "sent", targets: n}`."""
    if scope not in ("device", "area") or not isinstance(ref, str) or not 0 < len(ref) <= 64:
        raise err(422, "validation", fields=["scope"])
    if volume is not None:
        volume = clamp_volume(volume)
    cfg = config(conn)
    now = now or _now()

    def rec(keys: list[str], t: str, status: str, error: str | None) -> str:
        return _record(conn, principal, source, rule_id, scope, ref, keys, t, status, error, now, notification_id)

    try:
        t = clean_text(text)
    except ApiError:
        rec([], "", "refused", "text_invalid")
        _audit(conn, principal, request_id, source, scope, ref, [], "refused", "text_invalid", rule_id, len(text) if isinstance(text, str) else 0)
        raise
    code = "feature_disabled" if not cfg["enabled"] else "not_configured" if not cfg["engine"] else None
    pairs = resolve(conn, scope, ref) if code is None else []
    if code is None and not pairs:
        code = "no_targets"
    if code is not None:
        rec([], t, "refused", code)
        _audit(conn, principal, request_id, source, scope, ref, [], "refused", code, rule_id, len(t))
        raise err(409 if code == "not_configured" else 404, code)
    keys = [k for k, _e in pairs]
    notes: list[str] = []
    lowered = False
    if not critical and quiet_active(conn, now, cfg):
        if cfg["quiet"]["mode"] == "suppress":
            rec(keys, t, "refused", "quiet_hours")
            _audit(conn, principal, request_id, source, scope, ref, keys, "refused", "quiet_hours", rule_id, len(t))
            raise err(409, "quiet_hours")
        lowered = True
        notes.append("quiet_lowered")
    why = _limited(conn, scope, ref, cfg["max_per_minute"], now, keys)
    if why:
        rec(keys, t, "limited", why)
        _audit(conn, principal, request_id, source, scope, ref, keys, "limited", why, rule_id, len(t))
        raise ApiError(429, "rate_limited", MESSAGES["rate_limited"]["he"], retryable=True, details={"limit": why, "message_en": MESSAGES["rate_limited"]["en"]})
    aid = rec(keys, t, "pending", None)
    level = effective_volume(cfg, volume, lowered)
    problem: str | None = None
    try:
        if unlock is not None:
            with unlock():
                _play(settings, cfg, cfg["engine"], pairs, t, level, notes)
        else:
            _play(settings, cfg, cfg["engine"], pairs, t, level, notes)
    except ApiError as exc:
        problem = exc.code
    except Exception as exc:  # noqa: BLE001 - what the engine did is reported, never raised raw
        problem = type(exc).__name__
    status = "failed" if problem else "sent"
    conn.execute("UPDATE announcements SET status = ?, error = ?, notes_json = ? WHERE id = ?", (status, problem, json.dumps(notes[:40]), aid))
    _audit(conn, principal, request_id, source, scope, ref, keys, status, problem, rule_id, len(t),
           {"volume": level, "pause_music": cfg["pause_music"], "critical": bool(critical), **({"notes": notes[:40]} if notes else {}),
            **({"notification_id": notification_id} if notification_id else {})})
    if problem:
        raise ApiError(502, "speak_failed", MESSAGES["speak_failed"]["he"], retryable=True, details={"error": problem, "message_en": MESSAGES["speak_failed"]["en"]})
    return {"id": aid, "status": status, "targets": len(keys)}


def history(conn: sqlite3.Connection, limit: int = 20) -> list[dict[str, Any]]:
    rows = conn.execute("SELECT id, at, source, username, rule_id, scope, scope_ref, targets_json, message, status, error, notes_json FROM announcements ORDER BY at DESC, rowid DESC LIMIT ?", (max(1, min(limit, 100)),)).fetchall()
    return [{**{k: r[k] for k in ("id", "at", "source", "username", "rule_id", "scope", "scope_ref", "message", "status", "error")}, "targets": len(json.loads(r["targets_json"] or "[]")), "notes": _notes(r["notes_json"])} for r in rows]


def _notes(raw: Any) -> list[str]:
    try:
        v = json.loads(raw or "[]")
        return [x for x in v if isinstance(x, str)] if isinstance(v, list) else []
    except ValueError:
        return []


def prune(conn: sqlite3.Connection, days: int = 90) -> int:
    return conn.execute("DELETE FROM announcements WHERE at < ?", (iso_utc(dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)),)).rowcount


def rule_author(conn: sqlite3.Connection, rule_id: str) -> Principal | None:
    """The person whose authority a rule's announce action runs under: whoever last saved the rule (routers/rules.py checks
    media.announce on every save that carries the action)."""
    r = conn.execute("SELECT updated_by, updated_by_username, created_by, created_by_username FROM rules WHERE id = ?", (rule_id,)).fetchone()
    if r is None:
        return None
    uid, uname = (r["updated_by"], r["updated_by_username"]) if r["updated_by"] else (r["created_by"], r["created_by_username"])
    if not uid:
        return None
    return Principal(user_id=uid, username=uname or "", display_name=uname or "", source="internal")


def run_for_rule(rule_id: str, scope: str, ref: str, text: str, volume: Any = None, critical: bool = False) -> str:
    """A rule's announce action, after the ingest commit: its own short connection, never raises. Returns a short status (`sent`, or the code)."""
    if not _DB:
        return "unavailable"
    try:
        with _DB[0].connection(label="announce.rule") as conn:
            author = rule_author(conn, rule_id)
            if author is None or not authorize(conn, author, "media.announce", INSTALLATION).allowed:
                # security review 2.2.0 L1: the person who last saved the rule must STILL hold media.announce - a demoted or
                # deactivated author's rule stays silent (recorded and audited, nothing spoken)
                now = dt.datetime.now(dt.timezone.utc)
                t = text if isinstance(text, str) else ""
                _record(conn, author, "rule", rule_id, scope, ref, [], t[:MAX_TEXT], "refused", "not_permitted", now)
                _audit(conn, author, None, "rule", scope, ref, [], "refused", "not_permitted", rule_id, len(t))
                return "not_permitted"
            announce(conn, _SETTINGS[0], author, None, source="rule", scope=scope, ref=ref, text=text, rule_id=rule_id, volume=volume, critical=critical, unlock=lambda: unlocked(conn))
        return "sent"
    except ApiError as exc:
        return exc.code
    except Exception as exc:  # noqa: BLE001
        log.exception("rule announcement failed")
        return type(exc).__name__
