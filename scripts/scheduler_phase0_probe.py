"""CR-014 phase 0: READ-ONLY probe of the Scheduler component on a Home Assistant instance.

It answers the open questions of docs/architecture/SCHEDULER_API.md 1.2 / 11 (weekday forms, event frames, sun-offset
signs, match types, admin-only commands, the rename behaviour ...) from a real system, and prints STRUCTURE only: key
sets, value types, counts and closed enumerations - never a name, an entity id, a tag, a host or a token.

Read-only by construction: the only WebSocket message types it can send are in ALLOWED_WS_TYPES (`auth`,
`get_services`, `get_states`, `config/entity_registry/list`, `manifest/get`, `scheduler`, `scheduler/item`,
`scheduler/tags`, and the `scheduler_updated` subscription, which is closed with the connection). Anything else raises
ProbeRefused before it is sent (tests/test_scheduler_probe.py). No service is called, nothing is written to Home
Assistant, no state is changed.

    python scripts/scheduler_phase0_probe.py <env-file> [--url-var NAME] [--token-var NAME]
                                             [--non-admin-token-var NAME] [--listen SECONDS] [--out DIR]

- `<env-file>`: KEY=VALUE lines. The URL and the token are read from it (default variable names `SW_PROBE_HA_URL` /
  `HA_URL` and `SW_PROBE_HA_TOKEN` / `HA_TOKEN`; override with --url-var / --token-var). Only the NAMES of variables
  appear on the command line; values are never printed, logged or put in an error message.
- `--non-admin-token-var NAME`: the name of a variable (in the env file or the process environment) that holds a
  NON-administrator user's long-lived token. With it the probe also records which read commands that user may use
  (SCHEDULER_API.md P0-6). Without it that part is skipped.
- `--listen SECONDS`: subscribe to `scheduler_updated` and record the frame shapes of what arrives (P0-2); the owner
  toggles or edits a schedule in the card meanwhile. 0 (default) skips it.
- `--out DIR`: also write the raw answers (services, schedules, items, tags, switch states, registry rows, events) plus
  summary.json. DIR must be inside the repository's git-ignored `private-evidence/` folder; the raw files contain
  names and entity ids and never leave it.
"""
from __future__ import annotations

import argparse
import asyncio
import collections
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Awaitable, Callable, Protocol

REPO = Path(__file__).resolve().parents[1]
PRIVATE_EVIDENCE = REPO / "private-evidence"

# The complete list of WebSocket message types this script may ever send (SCHEDULER_API.md 11.1).
ALLOWED_WS_TYPES = frozenset({
    "auth",
    "get_services",
    "get_states",
    "config/entity_registry/list",
    "manifest/get",
    "scheduler",
    "scheduler/item",
    "scheduler/tags",
    "scheduler_updated",
})
# the read commands a non-admin token is tried with (P0-6)
NON_ADMIN_TRIES: tuple[tuple[str, dict[str, Any]], ...] = (
    ("scheduler", {}),
    ("scheduler/tags", {}),
    ("get_services", {}),
    ("get_states", {}),
    ("config/entity_registry/list", {}),
)

KNOWN_SCHEDULER_SERVICES = frozenset({"add", "edit", "remove", "copy", "run_action", "enable_all", "disable_all"})
KNOWN_WEEKDAYS = frozenset({"sun", "mon", "tue", "wed", "thu", "fri", "sat", "daily", "workday", "weekend"})
KNOWN_REPEAT = frozenset({"repeat", "pause", "single"})
KNOWN_MATCH = frozenset({"is", "not", "above", "below"})
KNOWN_CONDITION_TYPE = frozenset({"and", "or"})
KNOWN_SWITCH_STATES = frozenset({"on", "off", "triggered", "completed", "unavailable", "unknown"})
KNOWN_EVENTS = frozenset({"item_created", "item_updated", "item_removed", "timer_updated", "timer_finished", "timer_started"})
KNOWN_ERROR_CODES = frozenset({"unauthorized", "unknown_command", "not_found", "invalid_format", "home_assistant_error", "unknown_error", "not_allowed"})
# service domains whose service ids are printed as they are; any other domain is printed as "<domain>.*" or "other.*"
# (a script's or a custom integration's service id can carry a private name)
STANDARD_SERVICE_DOMAINS = frozenset({"light", "switch", "cover", "climate", "fan", "lock", "alarm_control_panel", "button", "media_player", "scene", "input_boolean", "vacuum", "siren", "humidifier", "number", "select", "input_number", "input_select"})

TIME_FIXED = re.compile(r"^\d{2}:\d{2}:\d{2}$")
TIME_SUN = re.compile(r"^(sunrise|sunset)([+-])\d{2}:\d{2}:\d{2}$")
ATTRIBUTE_NAME = re.compile(r"^[a-z_][a-z0-9_]{0,63}$")


class ProbeRefused(Exception):
    """A message type outside ALLOWED_WS_TYPES was about to be sent. Never caught by the probe itself."""


class ProbeError(Exception):
    """A failure the probe reports by class and short reason only (never a value from the system)."""


def guard(msg_type: str) -> None:
    if msg_type not in ALLOWED_WS_TYPES:
        raise ProbeRefused(f"message type not allowed in the read-only probe: {msg_type!r}")


# ---------------------------------------------------------------- transport


class Connection(Protocol):
    async def send(self, obj: dict[str, Any]) -> None: ...

    async def recv(self, timeout: float | None = None) -> dict[str, Any] | None: ...

    async def close(self) -> None: ...


class WsConnection:
    """The real transport (the `websockets` package). Nothing here logs frames."""

    def __init__(self, ws: Any) -> None:
        self._ws = ws

    async def send(self, obj: dict[str, Any]) -> None:
        await self._ws.send(json.dumps(obj))

    async def recv(self, timeout: float | None = None) -> dict[str, Any] | None:
        try:
            raw = await asyncio.wait_for(self._ws.recv(), timeout) if timeout is not None else await self._ws.recv()
        except asyncio.TimeoutError:
            return None
        return json.loads(raw)

    async def close(self) -> None:
        await self._ws.close()


async def open_ws(base_url: str) -> Connection:
    import websockets  # imported late: the pure functions and the tests do not need it

    url = ("wss://" if base_url.startswith("https://") else "ws://") + base_url.split("://", 1)[1].rstrip("/") + "/api/websocket"
    return WsConnection(await websockets.connect(url, max_size=64 * 1024 * 1024, open_timeout=15))


class Session:
    """One authenticated connection; `call` checks the allow-list before anything is sent."""

    def __init__(self, conn: Connection) -> None:
        self.conn = conn
        self._id = 0
        self.ha_version: str | None = None
        self.sent_types: list[str] = []

    async def authenticate(self, token: str) -> bool:
        first = await self.conn.recv(15)
        if not first or first.get("type") != "auth_required":
            raise ProbeError("no auth_required frame")
        version = first.get("ha_version")
        self.ha_version = version if isinstance(version, str) and re.match(r"^[0-9][0-9A-Za-z.\-+]{0,30}$", version) else None
        guard("auth")
        self.sent_types.append("auth")
        await self.conn.send({"type": "auth", "access_token": token})
        answer = await self.conn.recv(15)
        return bool(answer and answer.get("type") == "auth_ok")

    async def call(self, msg_type: str, timeout: float = 60, **fields: Any) -> dict[str, Any]:
        guard(msg_type)
        self._id += 1
        mid = self._id
        self.sent_types.append(msg_type)
        await self.conn.send({"id": mid, "type": msg_type, **fields})
        deadline = time.monotonic() + timeout
        while True:
            left = deadline - time.monotonic()
            frame = await self.conn.recv(max(left, 0.01)) if left > 0 else None
            if frame is None:
                raise ProbeError(f"no answer to {msg_type}")
            if frame.get("id") == mid and frame.get("type") == "result":
                return frame

    async def subscribe(self, msg_type: str) -> int:
        guard(msg_type)
        self._id += 1
        self.sent_types.append(msg_type)
        await self.conn.send({"id": self._id, "type": msg_type})
        return self._id


# ---------------------------------------------------------------- structure helpers (no values)


def vtype(v: Any) -> str:
    """The JSON type name of a value: never the value."""
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "bool"
    if isinstance(v, int):
        return "int"
    if isinstance(v, float):
        return "float"
    if isinstance(v, str):
        return "str"
    if isinstance(v, list):
        return "list"
    if isinstance(v, dict):
        return "dict"
    return type(v).__name__


def enum_or_type(v: Any, known: frozenset[str] | set[str]) -> str:
    """A closed-enumeration value as it is, anything else as its type."""
    return v if isinstance(v, str) and v in known else f"<{vtype(v)}>"


def key_types(rows: list[dict[str, Any]]) -> dict[str, list[str]]:
    out: dict[str, set[str]] = collections.defaultdict(set)
    for r in rows:
        for k, v in r.items():
            out[str(k)].add(vtype(v))
    return {k: sorted(v) for k, v in sorted(out.items())}


def key_sets(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """{keys: union, always: keys present in every row, sometimes: keys missing from some row}."""
    if not rows:
        return {"keys": [], "always": [], "sometimes": []}
    sets = [set(map(str, r)) for r in rows]
    union, inter = set().union(*sets), set.intersection(*sets)
    return {"keys": sorted(union), "always": sorted(inter), "sometimes": sorted(union - inter)}


def time_kind(v: Any) -> str:
    if v is None:
        return "null"
    if isinstance(v, str):
        if TIME_FIXED.match(v):
            return "HH:MM:SS"
        m = TIME_SUN.match(v)
        if m:
            return f"{m.group(1)}{m.group(2)}HH:MM:SS"
    return f"<{vtype(v)}>"


def service_label(service: Any) -> str:
    if not isinstance(service, str) or "." not in service:
        return f"<{vtype(service)}>"
    domain, _name = service.split(".", 1)
    if domain in STANDARD_SERVICE_DOMAINS:
        return service
    return "script.*" if domain == "script" else "other.*"


def summarize_items(items: list[dict[str, Any]]) -> dict[str, Any]:
    """Structure of the schedule items (WS `scheduler` / `scheduler/item`)."""
    slots = [t for it in items for t in (it.get("timeslots") or []) if isinstance(t, dict)]
    actions = [a for t in slots for a in (t.get("actions") or []) if isinstance(a, dict)]
    conditions = [c for t in slots for c in (t.get("conditions") or []) if isinstance(c, dict)]
    weekdays = collections.Counter()
    for it in items:
        days = it.get("weekdays")
        if isinstance(days, list):
            weekdays[",".join(sorted(enum_or_type(d, KNOWN_WEEKDAYS) for d in days))] += 1
        else:
            weekdays[f"<{vtype(days)}>"] += 1
    time_kinds: collections.Counter = collections.Counter()
    for t in slots:
        for k in ("start", "stop"):
            time_kinds[f"{k}:{time_kind(t.get(k))}"] += 1
    uniform = 0
    for it in items:
        per_slot = [json.dumps([t.get("conditions"), t.get("condition_type"), t.get("track_conditions")], sort_keys=True) for t in it.get("timeslots") or [] if isinstance(t, dict)]
        uniform += 1 if len(set(per_slot)) <= 1 else 0
    negative_sun = sum(1 for t in slots for k in ("start", "stop") if isinstance(t.get(k), str) and re.match(r"^sun(rise|set)-", t[k]))
    positive_sun = sum(1 for t in slots for k in ("start", "stop") if isinstance(t.get(k), str) and re.match(r"^sun(rise|set)\+", t[k]))
    # argument names only of standard domains (a script's variables can carry private names)
    service_data_keys = sorted({str(k) for a in actions if isinstance(a.get("service_data"), dict) and isinstance(a.get("service"), str) and a["service"].split(".", 1)[0] in STANDARD_SERVICE_DOMAINS
                                for k in a["service_data"] if ATTRIBUTE_NAME.match(str(k))})
    return {
        "count": len(items),
        "item": {**key_sets(items), "types": key_types(items)},
        "timeslot": {**key_sets(slots), "types": key_types(slots), "count": len(slots)},
        "action": {**key_sets(actions), "types": key_types(actions), "count": len(actions), "entity_id_null": sum(1 for a in actions if a.get("entity_id") is None),
                   "entity_domains": dict(sorted(collections.Counter(str(a.get("entity_id")).split(".")[0] if isinstance(a.get("entity_id"), str) else "<none>" for a in actions).items()))
                   if all(isinstance(a.get("entity_id"), (str, type(None))) for a in actions) else {},
                   "services": dict(sorted(collections.Counter(service_label(a.get("service")) for a in actions).items())), "service_data_keys": service_data_keys},
        "condition": {**key_sets(conditions), "count": len(conditions), "match_type": dict(sorted(collections.Counter(enum_or_type(c.get("match_type"), KNOWN_MATCH) for c in conditions).items())),
                      "attribute": dict(sorted(collections.Counter("state" if c.get("attribute") == "state" else "<other>" for c in conditions).items())),
                      "value_type": dict(sorted(collections.Counter(vtype(c.get("value")) for c in conditions).items()))},
        "condition_type": dict(sorted(collections.Counter(enum_or_type(t.get("condition_type"), KNOWN_CONDITION_TYPE) if t.get("condition_type") is not None else "null" for t in slots).items())),
        "conditions_uniform_across_slots": {"schedules": uniform, "of": len(items)},
        "weekdays": dict(sorted(weekdays.items())),
        "repeat_type": dict(sorted(collections.Counter(enum_or_type(it.get("repeat_type"), KNOWN_REPEAT) for it in items).items())),
        "enabled": dict(sorted(collections.Counter(str(it.get("enabled")) for it in items).items())),
        "time_kinds": dict(sorted(time_kinds.items())),
        "sun_offset_signs": {"plus": positive_sun, "minus": negative_sun},
        "with_dates": sum(1 for it in items if it.get("start_date") or it.get("end_date")),
        "unnamed": sum(1 for it in items if not it.get("name")),
        "with_tags": sum(1 for it in items if it.get("tags")),
        "timestamps_and_next_entries_aligned": sum(1 for it in items if isinstance(it.get("timestamps"), list) and isinstance(it.get("next_entries"), list) and len(it["timestamps"]) == len(it.get("timeslots") or [])),
    }


def summarize_switches(switches: list[dict[str, Any]], items: list[dict[str, Any]]) -> dict[str, Any]:
    attrs = [s.get("attributes") for s in switches if isinstance(s.get("attributes"), dict)]
    by_entity = {it.get("entity_id"): it for it in items if isinstance(it.get("entity_id"), str)}
    tuples = [a.get("timeslots") for a in attrs if isinstance(a.get("timeslots"), list)]
    return {
        "count": len(switches),
        "state": dict(sorted(collections.Counter(enum_or_type(s.get("state"), KNOWN_SWITCH_STATES) for s in switches).items())),
        "attributes": {**key_sets(attrs), "types": key_types(attrs)},
        "timeslots_attribute_forms": dict(sorted(collections.Counter(
            "HH:MM:SS - HH:MM:SS" if isinstance(x, str) and re.match(r"^\d{2}:\d{2}:\d{2} - \d{2}:\d{2}:\d{2}$", x)
            else "HH:MM:SS" if isinstance(x, str) and TIME_FIXED.match(x) else f"<{vtype(x)}>" for ts in tuples for x in ts).items())),
        "matched_to_an_item_by_entity_id": sum(1 for s in switches if s.get("entity_id") in by_entity),
    }


def summarize_registry(rows: list[dict[str, Any]], items: list[dict[str, Any]]) -> dict[str, Any]:
    ours = [r for r in rows if r.get("platform") == "scheduler"]
    ids = {it.get("schedule_id") for it in items}
    return {
        "scheduler_rows": len(ours),
        "platforms_of_switch_schedule_rows": dict(sorted(collections.Counter(str(r.get("platform")) if r.get("platform") in ("scheduler", None) else "<other>" for r in rows if str(r.get("entity_id", "")).startswith("switch.schedule_")).items())),
        "keys": {**key_sets(ours), "types": key_types(ours)},
        "unique_id_equals_a_schedule_id": sum(1 for r in ours if r.get("unique_id") in ids),
        "with_device_id": sum(1 for r in ours if r.get("device_id")),
        "with_area_id": sum(1 for r in ours if r.get("area_id")),
        "domains": dict(sorted(collections.Counter(str(r.get("entity_id", "")).split(".")[0] for r in ours).items())),
    }


def summarize_services(services: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(services, dict):
        return {"registered": False}
    fields = {name: sorted((spec.get("fields") or {}).keys()) if isinstance(spec, dict) else [] for name, spec in services.items()}
    return {"registered": True, "services": fields, "unknown_to_the_contract": sorted(set(fields) - KNOWN_SCHEDULER_SERVICES), "missing_from_the_contract_list": sorted(KNOWN_SCHEDULER_SERVICES - set(fields)),
            "reload_storage_registered": "reload_storage" in fields}


def frame_shape(frame: Any, depth: int = 0) -> Any:
    """The structure of an event frame: keys and value types, plus a closed set of event names verbatim."""
    if isinstance(frame, dict):
        if depth >= 4:
            return "{...}"
        out = {}
        for k, v in sorted(frame.items()):
            if k in ("event", "type") and isinstance(v, str):
                out[k] = v if v in KNOWN_EVENTS or v in ("event", "result") else "<str>"
            else:
                out[str(k)] = frame_shape(v, depth + 1)
        return out
    if isinstance(frame, list):
        return [frame_shape(frame[0], depth + 1), f"x{len(frame)}"] if frame else []
    return vtype(frame)


def error_code(frame: dict[str, Any]) -> str:
    err = frame.get("error")
    code = err.get("code") if isinstance(err, dict) else None
    return code if isinstance(code, str) and code in KNOWN_ERROR_CODES else "<other>"


# ---------------------------------------------------------------- the probe


async def run_admin_probe(session: Session, listen_s: float = 0.0, log: Callable[[str], None] = print) -> dict[str, Any]:
    """Read everything the contract wants to verify. Returns {summary, raw}; `raw` carries names and is never printed."""
    raw: dict[str, Any] = {}
    summary: dict[str, Any] = {"ha_version": session.ha_version}

    services = await session.call("get_services")
    raw["services"] = (services.get("result") or {}).get("scheduler") if services.get("success") else None
    summary["services"] = summarize_services(raw["services"])

    manifest = await session.call("manifest/get", integration="scheduler")
    summary["manifest"] = {"ok": bool(manifest.get("success")), "error": None if manifest.get("success") else error_code(manifest),
                           "version": (manifest.get("result") or {}).get("version") if manifest.get("success") and isinstance((manifest.get("result") or {}).get("version"), str) and re.match(r"^[0-9][0-9A-Za-z.\-+]{0,30}$", manifest["result"]["version"]) else None}

    listing = await session.call("scheduler")
    if not listing.get("success"):
        summary["scheduler"] = {"ok": False, "error": error_code(listing)}
        raw.update(schedules=[], items=[], tags=[])
        items: list[dict[str, Any]] = []
    else:
        listed = [x for x in (listing.get("result") or []) if isinstance(x, dict)]
        raw["schedules"] = listed
        items = []
        for entry in listed:
            sid = entry.get("schedule_id")
            if isinstance(sid, str):
                one = await session.call("scheduler/item", schedule_id=sid)
                if one.get("success") and isinstance(one.get("result"), dict):
                    items.append(one["result"])
        raw["items"] = items
        summary["scheduler"] = {"ok": True, "list_matches_item_by_item": listed == items, **summarize_items(listed)}
        summary["scheduler"]["dumped_item_keys"] = key_sets(items[:1]) if items else None
        tags = await session.call("scheduler/tags")
        raw["tags"] = tags.get("result") if tags.get("success") else []
        tag_rows = [t for t in (raw["tags"] or []) if isinstance(t, dict)]
        summary["tags"] = {"ok": bool(tags.get("success")), "count": len(tag_rows), "keys": key_sets(tag_rows), "types": key_types(tag_rows)}

    states = await session.call("get_states")
    switches = [s for s in (states.get("result") or []) if isinstance(s, dict) and str(s.get("entity_id", "")).startswith("switch.schedule_")] if states.get("success") else []
    raw["switch_states"] = switches
    summary["switches"] = summarize_switches(switches, items)
    if items:
        # "dump one item and its switch attributes": the structure of item 0 and of its switch
        first = items[0]
        twin = next((s for s in switches if s.get("entity_id") == first.get("entity_id")), None)
        summary["first_item"] = {"keys": {k: vtype(v) for k, v in sorted(first.items())}, "switch_attributes": {k: vtype(v) for k, v in sorted((twin or {}).get("attributes", {}).items())} if twin else None}

    registry = await session.call("config/entity_registry/list")
    rows = [r for r in (registry.get("result") or []) if isinstance(r, dict) and (r.get("platform") == "scheduler" or str(r.get("entity_id", "")).startswith("switch.schedule_"))] if registry.get("success") else []
    raw["registry"] = [r for r in rows if r.get("platform") == "scheduler"]
    summary["registry"] = summarize_registry(rows, items)

    raw["events"] = []
    if listen_s > 0:
        sub_id = await session.subscribe("scheduler_updated")
        deadline = time.monotonic() + listen_s
        answered: str | None = None
        while time.monotonic() < deadline:
            frame = await session.conn.recv(max(deadline - time.monotonic(), 0.01))
            if frame is None:
                break
            if frame.get("id") != sub_id:
                continue
            if frame.get("type") == "result":
                answered = "success" if frame.get("success") else error_code(frame)
            else:
                raw["events"].append(frame)
        shapes = collections.Counter(json.dumps(frame_shape(f), sort_keys=True) for f in raw["events"])
        summary["scheduler_updated"] = {"subscription": answered, "listened_s": listen_s, "events": len(raw["events"]), "shapes": [json.loads(s) | {"_count": n} for s, n in shapes.items()]}
    else:
        summary["scheduler_updated"] = {"skipped": True}
    return {"summary": summary, "raw": raw}


async def run_non_admin_probe(session: Session, first_schedule_id: str | None) -> dict[str, Any]:
    """Which read commands does a non-administrator's token get? Answers only success or a short error code."""
    out: dict[str, Any] = {}
    for msg_type, fields in NON_ADMIN_TRIES:
        frame = await session.call(msg_type, **fields)
        out[msg_type] = "success" if frame.get("success") else error_code(frame)
    if first_schedule_id:
        frame = await session.call("scheduler/item", schedule_id=first_schedule_id)
        out["scheduler/item"] = "success" if frame.get("success") else error_code(frame)
    return out


# ---------------------------------------------------------------- environment, output


def read_env_file(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$", line)
        if m and not line.lstrip().startswith("#"):
            v = m.group(2)
            if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
                v = v[1:-1]
            env[m.group(1)] = v
    return env


def pick(env: dict[str, str], names: list[str]) -> str | None:
    for n in names:
        v = env.get(n) or os.environ.get(n)
        if v:
            return v
    return None


def safe_out_dir(out: str) -> Path:
    """The raw files hold names and entity ids: only under the git-ignored private-evidence/ folder."""
    target = Path(out).resolve()
    root = PRIVATE_EVIDENCE.resolve()
    if target != root and root not in target.parents:
        raise ProbeError("--out must be a folder inside private-evidence/")
    return target


def write_raw(out_dir: Path, result: dict[str, Any]) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    files = {"services": "services.json", "schedules": "schedules.json", "items": "items.json", "tags": "tags.json", "switch_states": "switch_states.json", "registry": "registry.json", "events": "events.json"}
    for key, name in files.items():
        (out_dir / name).write_text(json.dumps(result["raw"].get(key), ensure_ascii=False, indent=1), encoding="utf-8")
    (out_dir / "summary.json").write_text(json.dumps(result["summary"], ensure_ascii=False, indent=1), encoding="utf-8")


def print_summary(summary: dict[str, Any], log: Callable[[str], None] = print) -> None:
    log(json.dumps(summary, ensure_ascii=False, indent=1, sort_keys=True))


async def main_async(args: argparse.Namespace, open_connection: Callable[[str], Awaitable[Connection]] = open_ws, log: Callable[[str], None] = print) -> int:
    env_path = Path(args.env_file)
    if not env_path.is_file():
        log("env file not found")
        return 2
    env = read_env_file(env_path)
    url = pick(env, [args.url_var] if args.url_var else ["SW_PROBE_HA_URL", "HA_URL"])
    token = pick(env, [args.token_var] if args.token_var else ["SW_PROBE_HA_TOKEN", "HA_TOKEN"])
    if not url or not token:
        log("the URL or token variable is missing (names only are shown: SW_PROBE_HA_URL / HA_URL, SW_PROBE_HA_TOKEN / HA_TOKEN, or --url-var / --token-var)")
        return 2
    if not re.match(r"^https?://", url):
        log("the URL variable must start with http:// or https://")
        return 2
    try:
        out_dir = safe_out_dir(args.out) if args.out else None
    except ProbeError as exc:
        log(str(exc))
        return 2
    guest_token = None
    if args.non_admin_token_var:
        guest_token = pick(env, [args.non_admin_token_var])
        if not guest_token:
            log(f"variable {args.non_admin_token_var} is not set: the non-admin part is skipped")
    try:
        conn = await open_connection(url)
        session = Session(conn)
        if not await session.authenticate(token):
            log("auth: refused")
            return 2
        log("auth: ok (read-only probe)")
        result = await run_admin_probe(session, args.listen, log)
        await conn.close()
        first_id = (result["raw"].get("items") or [{}])[0].get("schedule_id") if result["raw"].get("items") else None
        if guest_token:
            gconn = await open_connection(url)
            gsession = Session(gconn)
            if await gsession.authenticate(guest_token):
                result["summary"]["non_admin"] = await run_non_admin_probe(gsession, first_id if isinstance(first_id, str) else None)
            else:
                result["summary"]["non_admin"] = {"auth": "refused"}
            await gconn.close()
        else:
            result["summary"]["non_admin"] = {"skipped": True}
    except ProbeRefused as exc:
        log(f"REFUSED: {exc}")
        return 3
    except Exception as exc:  # noqa: BLE001 - class name only: an error text may carry the host or a header
        log(f"probe failed: {type(exc).__name__}")
        return 2
    print_summary(result["summary"], log)
    if out_dir:
        write_raw(out_dir, result)
        log("raw answers written inside private-evidence/ (git-ignored; they contain names and entity ids)")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Read-only structural probe of the Scheduler component (CR-014 phase 0).")
    p.add_argument("env_file", help="KEY=VALUE file holding the Home Assistant URL and a long-lived token")
    p.add_argument("--url-var", help="name of the URL variable (default SW_PROBE_HA_URL, then HA_URL)")
    p.add_argument("--token-var", help="name of the token variable (default SW_PROBE_HA_TOKEN, then HA_TOKEN)")
    p.add_argument("--non-admin-token-var", help="name of a variable holding a NON-admin user's token (P0-6)")
    p.add_argument("--listen", type=float, default=0.0, help="seconds to listen to scheduler_updated events (P0-2); 0 skips")
    p.add_argument("--out", help="folder inside private-evidence/ for the raw answers (optional)")
    return p


if __name__ == "__main__":
    sys.exit(asyncio.run(main_async(build_parser().parse_args())))
