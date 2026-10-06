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
- the speak call is `SPEAK`; tests replace it with a fake, so no test ever reaches a real device. A rule's announce action is
  collected by services/rules.py and run after the ingest commit through `run_for_rule`; a rule never raises into ingestion.
"""
from __future__ import annotations

import datetime as dt
import json
import logging
import re
import sqlite3
from typing import Any

from ..audit import audit
from ..config import Settings
from ..db import get_setting, new_id, now_iso, set_setting
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
DEFAULTS = {K_ENABLED: "false", K_ENGINE: "", K_LANG: "he", K_DEVICES: "[]", K_MAX: "6"}
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
}


def err(status: int, code: str, **details: Any) -> ApiError:
    return ApiError(status, code, MESSAGES[code]["he"], details={**details, "message_en": MESSAGES[code]["en"]})


def default_speak(settings: Settings, engine: str, entity_ids: list[str], message: str, language: str) -> None:
    """The one call that reaches the infrastructure: `tts.speak` on the engine, played on the speakers. Raises ApiError when it refuses."""
    from . import ha_client

    ha_client.call_service(settings, "tts", "speak", {"entity_id": engine, "media_player_entity_id": entity_ids, "message": message, "language": language})


SPEAK = default_speak  # tests replace this: no test reaches a real device
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
            "max_per_minute": per_min, "max_text": MAX_TEXT, "cooldown_s": COOLDOWN_S}


def update_config(conn: sqlite3.Connection, body: dict[str, Any]) -> list[str]:
    """PUT config (system.configure): every key optional, strict; returns the changed keys."""
    allowed = {"enabled", "engine", "language", "devices", "max_per_minute"}
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


def _record(conn: sqlite3.Connection, principal: Principal | None, source: str, rule_id: str | None, scope: str, ref: str, keys: list[str], text: str, status: str, error: str | None, now: dt.datetime) -> str:
    aid = new_id()
    conn.execute("INSERT INTO announcements(id, at, source, user_id, username, rule_id, scope, scope_ref, targets_json, message, status, error) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                 (aid, iso_utc(now), source, getattr(principal, "user_id", None), getattr(principal, "username", None), rule_id, scope, ref[:64], json.dumps(keys), text, status, error))
    return aid


def _audit(conn: sqlite3.Connection, principal: Principal | None, request_id: str | None, source: str, scope: str, ref: str, keys: list[str], status: str, error: str | None, rule_id: str | None, length: int) -> None:
    audit(conn, actor=principal, action="media.announce", decision="denied" if status in ("refused", "limited") else "allowed", resource_type="announcement", resource_id=f"{scope}:{ref}",
          reason=error, request_id=request_id, details={"source": source, "scope": scope, "targets": len(keys), "status": status, "length": length, **({"rule_id": rule_id} if rule_id else {})})


def announce(conn: sqlite3.Connection, settings: Settings, principal: Principal | None, request_id: str | None, *, source: str, scope: str, ref: str, text: Any,
             rule_id: str | None = None, now: dt.datetime | None = None, unlock: Any = None) -> dict[str, Any]:
    """Check, record, speak, record the outcome. `unlock` is a context-manager factory (db.unlocked bound to the request's connection) that
    releases the write lock around the speak call; None (a rule, a test) calls it directly. A refusal is logged and audited first, then
    raised as an ApiError (the request still commits it). Returns `{id, status: "sent", targets: n}`."""
    if scope not in ("device", "area") or not isinstance(ref, str) or not 0 < len(ref) <= 64:
        raise err(422, "validation", fields=["scope"])
    cfg = config(conn)
    now = now or dt.datetime.now(dt.timezone.utc)
    try:
        t = clean_text(text)
    except ApiError:
        _record(conn, principal, source, rule_id, scope, ref, [], "", "refused", "text_invalid", now)
        _audit(conn, principal, request_id, source, scope, ref, [], "refused", "text_invalid", rule_id, len(text) if isinstance(text, str) else 0)
        raise
    code = "feature_disabled" if not cfg["enabled"] else "not_configured" if not cfg["engine"] else None
    pairs = resolve(conn, scope, ref) if code is None else []
    if code is None and not pairs:
        code = "no_targets"
    if code is not None:
        _record(conn, principal, source, rule_id, scope, ref, [], t, "refused", code, now)
        _audit(conn, principal, request_id, source, scope, ref, [], "refused", code, rule_id, len(t))
        raise err(409 if code == "not_configured" else 404, code)
    keys = [k for k, _e in pairs]
    why = _limited(conn, scope, ref, cfg["max_per_minute"], now, keys)
    if why:
        _record(conn, principal, source, rule_id, scope, ref, keys, t, "limited", why, now)
        _audit(conn, principal, request_id, source, scope, ref, keys, "limited", why, rule_id, len(t))
        raise ApiError(429, "rate_limited", MESSAGES["rate_limited"]["he"], retryable=True, details={"limit": why, "message_en": MESSAGES["rate_limited"]["en"]})
    aid = _record(conn, principal, source, rule_id, scope, ref, keys, t, "pending", None, now)
    entities = [e for _k, e in pairs]
    problem: str | None = None
    try:
        if unlock is not None:
            with unlock():
                SPEAK(settings, cfg["engine"], entities, t, cfg["language"])
        else:
            SPEAK(settings, cfg["engine"], entities, t, cfg["language"])
    except ApiError as exc:
        problem = exc.code
    except Exception as exc:  # noqa: BLE001 - what the engine did is reported, never raised raw
        problem = type(exc).__name__
    status = "failed" if problem else "sent"
    conn.execute("UPDATE announcements SET status = ?, error = ? WHERE id = ?", (status, problem, aid))
    _audit(conn, principal, request_id, source, scope, ref, keys, status, problem, rule_id, len(t))
    if problem:
        raise ApiError(502, "speak_failed", MESSAGES["speak_failed"]["he"], retryable=True, details={"error": problem, "message_en": MESSAGES["speak_failed"]["en"]})
    return {"id": aid, "status": status, "targets": len(keys)}


def history(conn: sqlite3.Connection, limit: int = 20) -> list[dict[str, Any]]:
    rows = conn.execute("SELECT id, at, source, username, rule_id, scope, scope_ref, targets_json, message, status, error FROM announcements ORDER BY at DESC, rowid DESC LIMIT ?", (max(1, min(limit, 100)),)).fetchall()
    return [{**{k: r[k] for k in ("id", "at", "source", "username", "rule_id", "scope", "scope_ref", "message", "status", "error")}, "targets": len(json.loads(r["targets_json"] or "[]"))} for r in rows]


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


def run_for_rule(rule_id: str, scope: str, ref: str, text: str) -> str:
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
            announce(conn, _SETTINGS[0], author, None, source="rule", scope=scope, ref=ref, text=text, rule_id=rule_id)
        return "sent"
    except ApiError as exc:
        return exc.code
    except Exception as exc:  # noqa: BLE001
        log.exception("rule announcement failed")
        return type(exc).__name__
