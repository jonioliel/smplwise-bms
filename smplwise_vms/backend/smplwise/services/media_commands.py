"""The one path of a media command (CR-015 section 5, docs/architecture/MEDIA_API.md 3.4): `POST /multimedia/devices/{key}/commands`.

The client names a DEVICE and a COMMAND, never an entity or a service. This module resolves the primary endpoint and the platform
code, checks everything the server owns - the caller's permission at the device's anchor, the public-screen rule, the bridge version,
the screen's live state, its capabilities, the profile, the curated sources, the rate limits - and only then sends ONE signed call
through the bridge as the caller's own HA user (`ha_bridge.validate_action` + `smplwise_bridge.execute`, exactly as the generic action
route does). Nothing is queued and nothing is retried: a dropped press is dropped, a failed call is reported.

Never here: a power key (power is `media_player.turn_on` / `turn_off` only), `remote.turn_off`, an automatic power-on, a command to a
screen that is off or unavailable other than power-on, a retry after a reconnect. Typed text is sent but never stored, logged or
audited (only its length)."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
import threading
import time
import uuid
from typing import Any

from ..audit import audit
from ..config import Settings
from ..db import get_setting, now_iso, unlocked
from ..errors import ApiError
from ..rbac import Principal, note_grant
from . import ha_actions, ha_bridge, ha_client, media_model as mm, media_profiles as profiles, media_store as store
from .timeutil import parse_utc

EXPIRY_MAX_S = 60.0
POWER_GAP_MS = 2000  # the least time between two power commands of one device
POWER_PENDING_MS = 8000  # ... and a power command is "in flight" this long while its state has not been confirmed

# the server-enforced limits of the UI's own throttles (MEDIA_API.md 5.3); tokens/second and burst
KEY_DEVICE = (5.0, 8.0)
KEY_USER = (10.0, 10.0)
VOLUME_DEVICE = (4.0, 4.0)
TEXT_DEVICE = (1.0, 1.0)

POWER_COMMANDS = frozenset({"power_on", "power_off", "source", "app", "sound_output"})  # media.power; the rest media.control
# a screen marked public: owner decision 2026-09-30 - every command but volume, mute and play / pause needs media.public too,
# except power (decision 4a: power is not content) and the sound output
EXEMPT_PUBLIC_KEYS = frozenset({"volup", "voldown", "mute", "play", "pause"})
EXEMPT_PUBLIC_TRANSPORT = frozenset({"play", "pause", "play_pause"})

TRANSPORT_ACTIONS = {
    "play": "media_player.media_play", "pause": "media_player.media_pause", "play_pause": "media_player.media_play_pause", "stop": "media_player.media_stop",
    "next": "media_player.media_next_track", "previous": "media_player.media_previous_track",
}
TRANSPORT_CAP = {"play": "play", "pause": "pause", "stop": "stop", "next": "next", "previous": "previous"}

MESSAGES = {
    "forbidden": "אין הרשאה",
    "public_screen": "מסך ציבורי: נדרשת הרשאה נפרדת",
    "not_found": "המסך לא נמצא.",
    "screen_off": "המסך כבוי",
    "unavailable": "המסך אינו זמין",
    "power_pending": "פקודת הפעלה קודמת עדיין ממתינה",
    "expired": "הבקשה פגה; נסו שוב.",
    "not_supported": "המסך אינו תומך בפעולה זו",
    "validation": "הפקודה אינה תקינה.",
    "rate_limited": "יותר מדי לחיצות; נסו שוב",
    "bridge_outdated": "נדרש עדכון של רכיב החיבור",
    "bridge_not_paired": "פעולות אלו דורשות את הגשר מותקן ומצומד.",
    "identity_unmapped": "לא ניתן למפות את הזהות לפעולת ההתקן.",
}


def err(status: int, code: str, **details: Any) -> ApiError:
    return ApiError(status, code, MESSAGES[code], details=details or None)


# ------------------------------------------------------------------------------------------------ rate limits

NOW_MS = lambda: int(time.time() * 1000)  # noqa: E731 - tests move the clock here
MONO = time.monotonic  # ... and here (token buckets)


class _Buckets:
    """Token buckets: `rate` tokens a second up to `burst`. A press over the limit is dropped (never queued)."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.state: dict[tuple[str, str], tuple[float, float]] = {}

    def take(self, kind: str, key: str, limit: tuple[float, float]) -> bool:
        rate, burst = limit
        now = MONO()
        with self.lock:
            tokens, last = self.state.get((kind, key), (burst, now))
            tokens = min(burst, tokens + max(0.0, now - last) * rate)
            if tokens < 1.0:
                self.state[(kind, key)] = (tokens, now)
                return False
            self.state[(kind, key)] = (tokens - 1.0, now)
            if len(self.state) > 2000:  # keys of users / devices long gone
                for k in [k for k, (_t, l) in self.state.items() if now - l > 120]:
                    del self.state[k]
            return True

    def refund(self, kind: str, key: str, limit: tuple[float, float]) -> None:
        rate, burst = limit
        with self.lock:
            tokens, last = self.state.get((kind, key), (burst, MONO()))
            self.state[(kind, key)] = (min(burst, tokens + 1.0), last)

    def clear(self) -> None:
        with self.lock:
            self.state.clear()


BUCKETS = _Buckets()

# key presses are audited as one row per user and device per 60 s window (media.keys), updated in place
_KEY_WINDOWS: dict[tuple[str, str], dict[str, Any]] = {}
_KEY_WINDOW_S = 60.0


# ------------------------------------------------------------------------------------------------ the plan


class Plan:
    """What one command becomes: the allow-listed action, its target entity and arguments, and how it is confirmed."""

    def __init__(self, command: str, action_id: str | None, entity_id: str | None, args: dict[str, Any], *, kind: str = "command", recent: tuple[str, str] | None = None) -> None:
        self.command, self.action_id, self.entity_id, self.args, self.kind, self.recent = command, action_id, entity_id, args, kind, recent


def needs_public(cmd: dict[str, Any]) -> bool:
    name = cmd["command"]
    if name in ("source", "app", "text"):
        return True
    if name == "key":
        return cmd["key"] not in EXEMPT_PUBLIC_KEYS
    if name == "transport":
        return cmd["action"] not in EXEMPT_PUBLIC_TRANSPORT
    return False


def _feat(cat: store.Catalog, entity_id: str | None, bit: int) -> bool:
    return bool(entity_id) and mm._feat(cat.ents.get(entity_id or ""), bit)


def _target_view(cat: store.Catalog, item: store.Item, target: str | None, live: dict[str, Any]) -> tuple[store.Item, str]:
    """The device whose endpoints take volume and mute: the receiver when `target` (or the effective default) is `linked`."""
    chosen = target or live["volume"]["target"]
    if chosen == "linked":
        linked = cat.linked(item)
        if linked is None:
            raise err(422, "not_supported", reason="no_linked_device")
        return linked, "linked"
    return item, "screen"


def plan(cat: store.Catalog, item: store.Item, cmd: dict[str, Any], caps: dict[str, Any], live: dict[str, Any]) -> Plan:
    """Resolve `cmd` to one allow-listed call, or refuse it (422 not_supported / validation): the command must be in `caps`, the
    profile must have the key, the source or app must be one of the curated visible ones."""
    name = cmd["command"]
    prim = item.view.prim
    if name == "power_on":
        if not caps["power_on"]:
            raise err(422, "not_supported", reason=caps["power_on_reason"] or "power_on")
        return Plan(name, "media_player.turn_on", prim["power"], {})
    if name == "power_off":
        if not caps["power_off"]:
            raise err(422, "not_supported", reason="power_off")
        return Plan(name, "media_player.turn_off", prim["power"], {})
    if name == "volume_set":
        level = cmd.get("level")
        if isinstance(level, bool) or not isinstance(level, (int, float)) or not 0 <= level <= 100:
            raise err(422, "validation", fields=["level"])
        view, which = _target_view(cat, item, cmd.get("target"), live)
        endpoint = view.view.prim.get("volume")
        lg_external = view.view.profile == "lg_webos" and which == "screen" and str(mm._attrs(cat.ents.get(view.view.prim.get("power") or "")).get("sound_output") or "").startswith("external")
        if not _feat(cat, endpoint, mm.F_VOLUME_SET) or lg_external:
            raise err(422, "not_supported", reason="volume_set")
        ceiling = item.row.get("volume_max")
        value = float(level)
        if ceiling is not None:
            value = min(value, float(ceiling))
        return Plan(name, "media_player.volume_set", endpoint, {"volume_level": round(value / 100.0, 4)})
    if name == "volume_step":
        direction = cmd.get("direction")
        if direction not in ("up", "down"):
            raise err(422, "validation", fields=["direction"])
        view, which = _target_view(cat, item, cmd.get("target"), live)
        step = mm.step_endpoint(view.model, cat.ents, view.view.prim)
        if step and _feat(cat, step, mm.F_VOLUME_STEP):
            return Plan(name, f"media_player.volume_{direction}", step, {}, kind="step")
        # no step support on the endpoint: the profile's own volume key (the screen's speakers only)
        key = "volup" if direction == "up" else "voldown"
        if which == "screen" and key in caps["keys"]:
            return _key_plan(item, key, name)
        raise err(422, "not_supported", reason="volume_step")
    if name == "mute":
        muted = cmd.get("muted")
        if not isinstance(muted, bool):
            raise err(422, "validation", fields=["muted"])
        view, _which = _target_view(cat, item, cmd.get("target"), live)
        endpoint = view.view.prim.get("mute")
        if not _feat(cat, endpoint, mm.F_VOLUME_MUTE):
            raise err(422, "not_supported", reason="mute")
        return Plan(name, "media_player.volume_mute", endpoint, {"is_volume_muted": muted})
    if name == "source":
        source_id = cmd.get("source_id")
        if not isinstance(source_id, str) or not source_id or len(source_id) > profiles.SOURCE_MAX:
            raise err(422, "validation", fields=["source_id"])
        if not caps["sources"]:
            raise err(422, "not_supported", reason="sources")
        sources, _apps = mm.view_lists(item.view)
        if not any(s["id"] == source_id and not s["hidden"] and s["kind"] in ("source", "channel") for s in sources):
            raise err(422, "not_supported", reason="unknown_source")
        return Plan(name, "media_player.select_source", prim["sources"], {"source": source_id}, recent=("source", source_id))
    if name == "app":
        app_id = cmd.get("app_id")
        if not isinstance(app_id, str) or not app_id or len(app_id) > 200:
            raise err(422, "validation", fields=["app_id"])
        if not caps["apps"]:
            raise err(422, "not_supported", reason="apps")
        _sources, apps = mm.view_lists(item.view)
        if not any(a["id"] == app_id and not a["hidden"] for a in apps):
            raise err(422, "not_supported", reason="unknown_app")
        if item.profile == "android_tv":
            return Plan(name, "remote.turn_on", prim["apps"], {"activity": app_id}, recent=("app", app_id))
        return Plan(name, "media_player.select_source", prim["apps"], {"source": app_id}, recent=("app", app_id))
    if name == "sound_output":
        output = cmd.get("output")
        if not isinstance(output, str) or output not in caps["sound_outputs"]:
            raise err(422, "not_supported", reason="sound_output")
        return Plan(name, "webostv.select_sound_output", prim["power"], {"sound_output": output})
    if name == "transport":
        action = cmd.get("action")
        if action not in TRANSPORT_ACTIONS:
            raise err(422, "validation", fields=["action"])
        t = caps["transport"]
        ok = (t["play"] or t["pause"]) if action == "play_pause" else t[TRANSPORT_CAP[action]]
        if not ok:
            raise err(422, "not_supported", reason="transport")
        return Plan(name, TRANSPORT_ACTIONS[action], prim["now_playing"], {})
    if name == "key":
        key = cmd.get("key")
        if not isinstance(key, str) or key not in profiles.KEY_IDS:
            raise err(422, "validation", fields=["key"])
        if key not in caps["keys"]:
            raise err(422, "not_supported", reason="key_not_in_profile")
        return _key_plan(item, key, name)
    if name == "text":
        text = cmd.get("text")
        problem = profiles.text_problem(text)
        if problem:
            raise err(422, "validation", fields=["text"], reason=problem)
        if not caps["text"]:
            raise err(422, "not_supported", reason="text")
        if item.profile == "samsung_smart":
            return Plan(name, "media_player.play_media", prim["keys"], {"media_content_type": "send_text", "media_content_id": text}, kind="text")
        return Plan(name, "remote.send_command", prim["keys"], {"command": "text:" + text}, kind="text")
    raise err(422, "validation", fields=["command"])


def _key_plan(item: store.Item, key: str, command: str) -> Plan:
    """One remote key through the profile's own transport. A power key does not exist: the tables have none."""
    transport = profiles.TRANSPORT.get(item.profile)
    code = profiles.code_of(item.profile, key, item.view.model_keys)
    endpoint = item.view.prim.get("keys")
    if transport is None or code is None or endpoint is None:
        raise err(422, "not_supported", reason="key_not_in_profile")
    action_id, arg, _role = transport
    args = {"media_content_type": "send_key", "media_content_id": code} if action_id == "media_player.play_media" else {arg: code}
    return Plan(command, action_id, endpoint, args, kind="key" if command == "key" else "step")


# ------------------------------------------------------------------------------------------------ helpers


def _stored(conn: sqlite3.Connection, principal: Principal, crid: str) -> dict[str, Any] | None:
    r = conn.execute("SELECT id, status, action_id, error FROM media_commands WHERE principal_user_id = ? AND client_request_id = ?", (principal.user_id, crid)).fetchone()
    if r is None:
        return None
    confirm = "none"
    if r["action_id"]:
        a = conn.execute("SELECT action_id, expected_state FROM ha_actions WHERE id = ?", (r["action_id"],)).fetchone()
        if a:
            confirm = ha_bridge.confirmation_kind(a["action_id"], a["expected_state"])
    return {"command_id": r["id"], "status": r["status"], "action_id": r["action_id"], "confirm": confirm, "error": r["error"]}


def _deny(conn: sqlite3.Connection, principal: Principal, request_id: str | None, item: store.Item, cmd: dict[str, Any], exc: ApiError) -> ApiError:
    audit(conn, actor=principal, action="media.command", decision="denied", resource_type="media_device", resource_id=item.key, reason=exc.code, request_id=request_id,
          details={"command": cmd["command"]})
    return exc


def _audit_keys(conn: sqlite3.Connection, principal: Principal, request_id: str | None, item: store.Item, key: str) -> None:
    now = MONO()
    win = _KEY_WINDOWS.get((principal.user_id, item.key))
    if win is not None and now - win["start"] < _KEY_WINDOW_S:
        win["counts"][key] = win["counts"].get(key, 0) + 1
        conn.execute("UPDATE audit_log SET details_json = ? WHERE id = ?", (json.dumps({"counts": win["counts"], "window_s": int(_KEY_WINDOW_S)}), win["row"]))
        return
    counts = {key: 1}
    audit(conn, actor=principal, action="media.keys", decision="allowed", resource_type="media_device", resource_id=item.key, request_id=request_id,
          details={"counts": counts, "window_s": int(_KEY_WINDOW_S)})
    row = conn.execute("SELECT MAX(id) FROM audit_log WHERE action = 'media.keys' AND actor_user_id = ? AND resource_id = ?", (principal.user_id, item.key)).fetchone()[0]
    if row is not None:
        _KEY_WINDOWS[(principal.user_id, item.key)] = {"start": now, "row": row, "counts": counts}
    if len(_KEY_WINDOWS) > 500:
        for k in [k for k, w in _KEY_WINDOWS.items() if now - w["start"] > _KEY_WINDOW_S]:
            del _KEY_WINDOWS[k]


def _power_gate(conn: sqlite3.Connection, item: store.Item) -> None:
    """One power command per device in flight; a second within 8 s while the first is unconfirmed, or within 2 s of any, is refused."""
    last = conn.execute(
        "SELECT id, created_ms, action_id FROM media_commands WHERE device_key = ? AND command IN ('power_on', 'power_off') AND status != 'refused' ORDER BY created_ms DESC LIMIT 1", (item.key,)).fetchone()
    if last is None:
        return
    age = NOW_MS() - last["created_ms"]
    if 0 <= age < POWER_GAP_MS:
        raise err(409, "power_pending", reason="gap")
    if 0 <= age < POWER_PENDING_MS and last["action_id"]:
        a = conn.execute("SELECT * FROM ha_actions WHERE id = ?", (last["action_id"],)).fetchone()
        if a is not None:
            d = ha_actions.as_dict(a)
            if d["status"] == "pending":
                ha_actions.refresh(conn, d)
                a = conn.execute("SELECT status FROM ha_actions WHERE id = ?", (last["action_id"],)).fetchone()
            if a is not None and a["status"] == "pending":
                raise err(409, "power_pending", reason="in_flight")


# ------------------------------------------------------------------------------------------------ the command


def run(conn: sqlite3.Connection, settings: Settings, principal: Principal, request_id: str | None, cat: store.Catalog, item: store.Item, access: store.Access, cmd: dict[str, Any], crid: str, expires_at: str) -> tuple[int, dict[str, Any]]:
    """Execute one command: (HTTP status, body). Raises ApiError for a refusal before anything is sent (audited) and for the
    bridge being unreachable; a call HA or the bridge refuses is the answer `status: "refused"` (200, audited)."""
    anchor = item.row.get("anchor_entity_id")
    name = cmd["command"]
    # 1. the envelope: a request that expired on the way is never sent
    try:
        expires = parse_utc(expires_at)
    except (ValueError, AttributeError):
        raise _deny(conn, principal, request_id, item, cmd, err(422, "validation", fields=["expires_at"])) from None
    now = dt.datetime.now(dt.timezone.utc)
    if expires <= now:
        raise _deny(conn, principal, request_id, item, cmd, err(409, "expired"))
    if expires > now + dt.timedelta(seconds=EXPIRY_MAX_S):
        raise _deny(conn, principal, request_id, item, cmd, err(422, "validation", fields=["expires_at"]))
    # 2. idempotent: the same request id of the same caller never sends twice
    again = _stored(conn, principal, crid)
    if again is not None:
        return (200 if again["status"] == "refused" else 202), again
    # 3. permission at the device's anchor, then the public-screen rule
    perm = store.PERM_POWER if name in POWER_COMMANDS else store.PERM_CONTROL
    if not access.has(perm, anchor):
        raise _deny(conn, principal, request_id, item, cmd, err(403, "forbidden", permission=perm))
    note_grant(access.decision(perm, anchor), perm)
    if item.row["is_public"] and needs_public(cmd) and not access.has(store.PERM_PUBLIC, anchor):
        raise _deny(conn, principal, request_id, item, cmd, err(403, "public_screen"))
    # 4. the caller's identity and the bridge
    if principal.source not in ("ingress", "remote") and not settings.dev_user:
        raise _deny(conn, principal, request_id, item, cmd, err(403, "identity_unmapped"))
    bridge = store.bridge_state(conn)
    if not bridge["paired"]:
        raise _deny(conn, principal, request_id, item, cmd, err(503, "bridge_not_paired"))
    if not bridge["media_ready"]:
        raise _deny(conn, principal, request_id, item, cmd, err(503, "bridge_outdated", required=store.BRIDGE_REQUIRED))
    secret = ha_bridge.signing_key(conn)
    # 5. one power command per device in flight (checked first: a double tap is "pending", not "already on")
    if name in ("power_on", "power_off"):
        try:
            _power_gate(conn, item)
        except ApiError as exc:
            raise _deny(conn, principal, request_id, item, cmd, exc) from None
    # 6. the screen's live state and capabilities
    live = store.live_of(cat, item, key_url=False)
    caps = store.caps_of(cat, item)
    power = live["power"]
    if power == "unavailable" or (power == "unknown" and name != "power_on"):
        raise _deny(conn, principal, request_id, item, cmd, err(409, "unavailable"))
    if name != "power_on" and power in ("off", "standby", "art") and not (name == "power_off" and power == "art"):
        raise _deny(conn, principal, request_id, item, cmd, err(409, "screen_off"))
    if name == "power_off" and power in ("off", "standby"):
        raise _deny(conn, principal, request_id, item, cmd, err(409, "screen_off"))
    if name == "power_on" and power == "on":
        raise _deny(conn, principal, request_id, item, cmd, err(422, "not_supported", reason="already_on"))
    try:
        p = plan(cat, item, cmd, caps, live)
        if p.entity_id is None or p.action_id is None:
            raise err(422, "not_supported", reason="no_endpoint")
        spec, data = ha_bridge.validate_action(p.action_id, p.entity_id, p.args)
    except ApiError as exc:
        if exc.code in ("action_not_allowed", "action_domain_mismatch", "argument_not_allowed"):
            exc = err(422, "not_supported", reason=exc.code)
        raise _deny(conn, principal, request_id, item, cmd, exc) from None
    # 7. rate limits (a dropped press is dropped, never queued)
    if name in ("key", "volume_step"):
        if not BUCKETS.take("key-device", item.key, KEY_DEVICE):
            raise _deny(conn, principal, request_id, item, cmd, err(429, "rate_limited", scope="device"))
        if not BUCKETS.take("key-user", principal.user_id, KEY_USER):
            BUCKETS.refund("key-device", item.key, KEY_DEVICE)
            raise _deny(conn, principal, request_id, item, cmd, err(429, "rate_limited", scope="user"))
    elif name == "volume_set" and not BUCKETS.take("vol-device", item.key, VOLUME_DEVICE):
        raise _deny(conn, principal, request_id, item, cmd, err(429, "rate_limited", scope="device"))
    elif name == "text" and not BUCKETS.take("text-device", item.key, TEXT_DEVICE):
        raise _deny(conn, principal, request_id, item, cmd, err(429, "rate_limited", scope="device"))
    # 8. record, send, settle
    command_id = uuid.uuid4().hex
    entity = cat.ents.get(p.entity_id) or {}
    expected = ha_bridge.expectation_for(spec, entity.get("attributes"))
    confirm = ha_bridge.confirmation_kind(p.action_id, expected)
    aid = uuid.uuid4().hex[:12] if confirm != "none" else None
    request_ref = aid or command_id[:12]
    cleaned = {k: v for k, v in data.items() if k != "entity_id"}
    created = now_iso()
    try:
        conn.execute(
            "INSERT INTO media_commands(id, device_key, principal_user_id, client_request_id, command, status, action_id, recent_kind, recent_id, created_ms, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (command_id, item.key, principal.user_id, crid, name, "pending", aid, p.recent[0] if p.recent else None, p.recent[1] if p.recent else None, NOW_MS(), created))
    except sqlite3.IntegrityError:
        again = _stored(conn, principal, crid)
        if again is not None:
            return (200 if again["status"] == "refused" else 202), again
        raise
    if aid is not None:
        conn.execute(
            "INSERT INTO ha_actions(id, entity_id, action_id, arguments_json, principal_user_id, principal_username, client_request_id, status, requested_at, expected_state, via) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (aid, p.entity_id, p.action_id, json.dumps(cleaned, ensure_ascii=False) if p.kind not in ("text",) else "{}", principal.user_id, principal.username, f"media:{crid}", "pending", created, expected, "bridge"))
    payload = ha_bridge.sign(secret or "", {"user_id": principal.user_id, "domain": spec["domain"], "service": spec["service"], "data": data, "request_id": request_ref})
    try:
        with unlocked(conn):  # the HA call runs without the request's write lock
            result = ha_client.call_bridge_execute(settings, payload)
    except ApiError as exc:
        conn.execute("UPDATE media_commands SET status = 'refused', error = ? WHERE id = ?", (exc.code, command_id))
        if aid:
            conn.execute("UPDATE ha_actions SET status = 'failed', error = ?, responded_at = ? WHERE id = ?", (exc.code, now_iso(), aid))
        audit(conn, actor=principal, action="media.command", decision="allowed", resource_type="media_device", resource_id=item.key, reason=exc.code, request_id=request_id,
              details={"command": name, "endpoint_id": store.ENDPOINT_PREFIX + p.entity_id, "status": "failed"})
        raise
    status, error = ha_actions.bridge_status(result)
    ok = status == "pending"
    if aid:
        conn.execute("UPDATE ha_actions SET status = ?, error = ?, responded_at = ? WHERE id = ?", (status, error, now_iso(), aid))
    outcome = ("accepted" if aid else "sent") if ok else "refused"
    conn.execute("UPDATE media_commands SET status = ?, error = ? WHERE id = ?", (outcome, None if ok else error, command_id))
    _audit_outcome(conn, principal, request_id, item, name, p, aid, outcome, error)
    body = {"command_id": command_id, "status": outcome, "action_id": aid if ok else (aid if aid else None), "confirm": confirm if ok else "none", "error": None if ok else error}
    return (202 if ok else 200), body


def _audit_outcome(conn: sqlite3.Connection, principal: Principal, request_id: str | None, item: store.Item, name: str, p: Plan, aid: str | None, outcome: str, error: str | None) -> None:
    if outcome == "refused":
        audit(conn, actor=principal, action="media.command", decision="denied", resource_type="media_device", resource_id=item.key, reason=error, request_id=request_id,
              details={"command": name, "endpoint_id": store.ENDPOINT_PREFIX + (p.entity_id or ""), "id": aid})
        return
    if name == "key":
        _audit_keys(conn, principal, request_id, item, _key_of(item, p))
    elif name == "text":
        audit(conn, actor=principal, action="media.text", decision="allowed", resource_type="media_device", resource_id=item.key, request_id=request_id,
              details={"length": len(p.args.get("media_content_id") or p.args.get("command", "")[5:])})  # the length only, never the text
    else:
        audit(conn, actor=principal, action="media.command", decision="allowed", resource_type="media_device", resource_id=item.key, request_id=request_id,
              details={"command": name, "endpoint_id": store.ENDPOINT_PREFIX + (p.entity_id or ""), "id": aid, "status": outcome})


def _key_of(item: store.Item, p: Plan) -> str:
    """The KeyId behind the code a key plan sent (for the aggregated key audit)."""
    code = p.args.get("media_content_id") or p.args.get("command") or p.args.get("button")
    table = {**profiles.CODES.get(item.profile, {}), **profiles.MODEL_CODES.get(item.profile, {})}
    return next((k for k, c in table.items() if c == code), "?")


def on_action_confirmed(conn: sqlite3.Connection, action_id: str) -> None:
    """`GET /ha/actions/{id}`: a source / app pick whose action just got confirmed goes into the screen's "recent" list."""
    r = conn.execute("SELECT device_key, recent_kind, recent_id FROM media_commands WHERE action_id = ? AND recent_kind IS NOT NULL", (action_id,)).fetchone()
    if r is not None:
        store.note_recent(conn, r["device_key"], r["recent_kind"], r["recent_id"])
        conn.execute("UPDATE media_commands SET recent_kind = NULL WHERE action_id = ?", (action_id,))
