"""CR-017 phase 0: probe of the automations / scripts / scenes surface of a Home Assistant instance (docs/architecture/AUTOMATIONS_API.md section 3.3,
CR-017 section 3.3: U-1 ... U-10, W-1, W-2).

DEFAULT = READ-ONLY. It prints STRUCTURE only: key sets, value types, counts, status codes and closed enumerations - never a name, an alias, an entity id,
a template, a host or a token. The only WebSocket message types it can send are in ALLOWED_WS_TYPES, the only REST requests are GETs of
`/api/config/{automation,script,scene}/config/<id>`; anything else raises ProbeRefused before it is sent (tests/test_automations_probe.py). No service is
called, nothing is written, no state is changed, no reload runs.

    python scripts/automations_probe.py <env-file> [--url-var NAME] [--token-var NAME] [--non-admin-token-var NAME]
                                        [--rest-prefix /api] [--ws-path /api/websocket] [--max-items N] [--out DIR]
                                        [--write-check --confirm-throwaway-write [--scene-entity-var NAME]]

- `<env-file>`: KEY=VALUE lines. The URL and the token are read from it (default variable names `SW_PROBE_HA_URL` / `HA_URL` and `SW_PROBE_HA_TOKEN` /
  `HA_TOKEN`). Only the NAMES of variables appear on the command line; values are never printed, logged or put in an error message. Through the
  Supervisor proxy (U-2) use `--rest-prefix /core/api --ws-path /core/websocket` with the add-on's token.
- `--non-admin-token-var NAME`: a NON-administrator user's long-lived token: records which read commands that user may use (U-10, the read-only half).
- `--max-items N`: read at most N configs per kind (default 200).
- `--out DIR`: also write the raw answers; DIR must be inside the git-ignored `private-evidence/` folder (the raw files contain names and entity ids).

THE ONE WRITE PATH, `--write-check`, is opt-in and needs `--confirm-throwaway-write` as well (the owner's explicit, task-specific approval is the condition for
running it; it is NOT run by the agents of the project against a real system). It creates ONE throwaway automation, ONE throwaway script and (with
`--scene-entity-var`) ONE throwaway scene whose config ids start with `arx_probe_`, reads them back, reloads, checks that their entities appear and that the
stored form is what was sent (W-1 / W-2: the format the bridge writer must match), tries the same calls as a non-administrator when a token is named (U-10),
and ALWAYS deletes what it created. The throwaway automation can never trigger (its trigger watches an entity that does not exist; its only step is a
delay). Every write is refused by `guard_rest` / `guard_call` unless it names a `arx_probe_` item.
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
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Awaitable, Callable, Protocol

REPO = Path(__file__).resolve().parents[1]
PRIVATE_EVIDENCE = REPO / "private-evidence"
THROWAWAY_PREFIX = "arx_probe_"

# The complete list of WebSocket message types the READ-ONLY probe may ever send.
ALLOWED_WS_TYPES = frozenset({
    "auth", "get_config", "get_states", "get_services", "config/entity_registry/list", "config/area_registry/list", "config/floor_registry/list",
    "config/label_registry/list", "config/category_registry/list", "automation/config", "script/config", "trace/list", "trace/get", "validate_config", "render_template",
})
# added by --write-check, for throwaway items only (guard_call)
WRITE_WS_TYPES = frozenset({"call_service"})
READ_TRIES_NON_ADMIN: tuple[tuple[str, dict[str, Any]], ...] = (
    ("get_states", {}), ("get_services", {}), ("config/entity_registry/list", {}), ("config/label_registry/list", {}), ("config/floor_registry/list", {}),
    ("config/category_registry/list", {"scope": "automation"}), ("trace/list", {"domain": "automation"}), ("validate_config", {"triggers": [{"trigger": "homeassistant", "event": "start"}]}),
    ("render_template", {"template": "{{ 1 + 1 }}", "timeout": 3}),
)
CONFIG_PATH = re.compile(r"^/api/config/(automation|script|scene)/config/([A-Za-z0-9_\-]{1,64})$")
THROWAWAY_CALLS = frozenset({("automation", "reload"), ("script", "reload"), ("scene", "reload"), ("automation", "turn_on"), ("automation", "turn_off"), ("automation", "trigger"),
                             ("script", "turn_on"), ("script", "turn_off")})

KNOWN_ERROR_CODES = frozenset({"unauthorized", "unknown_command", "not_found", "invalid_format", "home_assistant_error", "unknown_error", "not_allowed", "template_error"})
KNOWN_TRACE_STATES = frozenset({"running", "stopped"})
KNOWN_SCRIPT_EXECUTION = frozenset({"finished", "failed_conditions", "failed_single", "failed_max_runs", "failed_disabled", "failed_runtime", "failed_unexpected_error",
                                    "failed_cancelled", "cancelled", "aborted", "running"})
KNOWN_TRIGGER_VARS = frozenset({"trigger", "this", "context", "event", "repeat", "wait", "range", "item"})
STANDARD_DOMAINS = frozenset({"light", "switch", "fan", "cover", "climate", "lock", "alarm_control_panel", "siren", "media_player", "select", "number", "input_boolean", "input_select",
                              "scene", "script", "automation", "notify", "binary_sensor", "sensor", "person", "zone", "timer", "button", "vacuum", "humidifier", "remote", "camera", "calendar"})
KNOWN_STEP_KEYS = frozenset({"path", "timestamp", "changed_variables", "result", "error"})
ATTRIBUTE_NAME = re.compile(r"^[a-z_][a-z0-9_]{0,63}$")
SECRET_WORDS = re.compile(r"(?i)(^|[^a-z0-9])(password|passwd|token|secret|code|pin|api[_-]?key|apikey)([^a-z0-9]|$)")


class ProbeRefused(Exception):
    """A request outside the allow-list was about to be sent. Never caught by the probe itself."""


class ProbeError(Exception):
    """A failure the probe reports by class and short reason only (never a value from the system)."""


def guard_ws(msg_type: str, *, write_ok: bool = False) -> None:
    if msg_type not in ALLOWED_WS_TYPES and not (write_ok and msg_type in WRITE_WS_TYPES):
        raise ProbeRefused(f"message type not allowed: {msg_type!r}")


def guard_rest(method: str, path: str, *, write_ok: bool = False) -> None:
    m = CONFIG_PATH.match(path)
    if not m:
        raise ProbeRefused("REST path not allowed")
    if method == "GET":
        return
    if method in ("POST", "DELETE") and write_ok and m.group(2).startswith(THROWAWAY_PREFIX):
        return
    raise ProbeRefused(f"REST {method} not allowed here")


def guard_call(domain: str, service: str, data: dict[str, Any], *, write_ok: bool) -> None:
    """A service call is possible only with --write-check, only from THROWAWAY_CALLS, and (except the reloads) only on an `arx_probe_` item."""
    if not write_ok or (domain, service) not in THROWAWAY_CALLS:
        raise ProbeRefused(f"service call not allowed: {domain}.{service}")
    if service != "reload":
        ids = data.get("entity_id")
        ids = [ids] if isinstance(ids, str) else list(ids or [])
        if not ids or not all(isinstance(i, str) and i.split(".", 1)[-1].startswith(THROWAWAY_PREFIX) for i in ids):
            raise ProbeRefused("a call may name only throwaway items")
    elif domain == "automation" and not str(data.get("id", "")).startswith(THROWAWAY_PREFIX):
        raise ProbeRefused("an automation reload must name a throwaway id")


# ---------------------------------------------------------------- transports

class Connection(Protocol):
    async def send(self, obj: dict[str, Any]) -> None: ...

    async def recv(self, timeout: float | None = None) -> dict[str, Any] | None: ...

    async def close(self) -> None: ...


class WsConnection:
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


async def open_ws(base_url: str, ws_path: str = "/api/websocket") -> Connection:
    import websockets  # imported late: the pure functions and the tests do not need it

    url = ("wss://" if base_url.startswith("https://") else "ws://") + base_url.split("://", 1)[1].rstrip("/") + ws_path
    return WsConnection(await websockets.connect(url, max_size=64 * 1024 * 1024, open_timeout=15))


class Rest(Protocol):
    def request(self, method: str, path: str, body: Any = None) -> tuple[int, Any]: ...


class HttpRest:
    """The real REST transport (urllib). A browser-like User-Agent: the public front doors of the probed systems reject Python's default one."""

    def __init__(self, base_url: str, token: str, prefix: str = "/api") -> None:
        self.base, self.token, self.prefix = base_url.rstrip("/"), token, prefix.rstrip("/")

    def request(self, method: str, path: str, body: Any = None) -> tuple[int, Any]:
        url = self.base + self.prefix + path[len("/api"):]
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(url, data=data, method=method, headers={"Authorization": f"Bearer {self.token}", "Content-Type": "application/json",
                                                                              "User-Agent": "Mozilla/5.0 (compatible; arx-probe)"})
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                text = resp.read().decode("utf-8")
                return resp.status, (json.loads(text) if text.strip().startswith(("{", "[")) else text)
        except urllib.error.HTTPError as exc:
            text = exc.read().decode("utf-8", "replace")
            try:
                return exc.code, json.loads(text)
            except ValueError:
                return exc.code, text


class GuardedRest:
    """Every REST request of the probe passes `guard_rest` first: a GET of a config item, and - only with write_ok - a POST / DELETE of a throwaway item."""

    def __init__(self, inner: Rest, *, write_ok: bool = False) -> None:
        self.inner, self.write_ok = inner, write_ok

    def request(self, method: str, path: str, body: Any = None) -> tuple[int, Any]:
        guard_rest(method, path, write_ok=self.write_ok)
        return self.inner.request(method, path, body)


class Session:
    """One authenticated WebSocket connection; every message type passes the allow-list before anything is sent."""

    def __init__(self, conn: Connection, *, write_ok: bool = False) -> None:
        self.conn, self.write_ok = conn, write_ok
        self._id = 0
        self.ha_version: str | None = None
        self.sent_types: list[str] = []

    async def authenticate(self, token: str) -> bool:
        first = await self.conn.recv(15)
        if not first or first.get("type") != "auth_required":
            raise ProbeError("no auth_required frame")
        version = first.get("ha_version")
        self.ha_version = version if isinstance(version, str) and re.match(r"^[0-9][0-9A-Za-z.\-+]{0,30}$", version) else None
        guard_ws("auth")
        self.sent_types.append("auth")
        await self.conn.send({"type": "auth", "access_token": token})
        answer = await self.conn.recv(15)
        return bool(answer and answer.get("type") == "auth_ok")

    async def call(self, msg_type: str, timeout: float = 60, **fields: Any) -> dict[str, Any]:
        guard_ws(msg_type, write_ok=self.write_ok)
        if msg_type == "call_service":
            guard_call(str(fields.get("domain")), str(fields.get("service")), dict(fields.get("service_data") or {}), write_ok=self.write_ok)
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


# ---------------------------------------------------------------- structure helpers (never a value)

def vtype(v: Any) -> str:
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


def key_sets(rows: list[dict[str, Any]]) -> dict[str, Any]:
    if not rows:
        return {"keys": [], "always": [], "sometimes": []}
    sets = [set(map(str, r)) for r in rows]
    union, inter = set().union(*sets), set.intersection(*sets)
    return {"keys": sorted(union), "always": sorted(inter), "sometimes": sorted(union - inter)}


def key_types(rows: list[dict[str, Any]]) -> dict[str, list[str]]:
    out: dict[str, set[str]] = collections.defaultdict(set)
    for r in rows:
        for k, v in r.items():
            out[str(k)].add(vtype(v))
    return {k: sorted(v) for k, v in sorted(out.items())}


def error_code(frame: dict[str, Any]) -> str:
    err = frame.get("error")
    code = err.get("code") if isinstance(err, dict) else None
    return code if isinstance(code, str) and code in KNOWN_ERROR_CODES else "<other>"


def safe_error_kind(message: Any) -> str:
    """The kind of a validation message: the words before the first quoted or parenthesised part and the `@ data[...]` location class - never a value."""
    if not isinstance(message, str):
        return f"<{vtype(message)}>"
    head = re.sub(r"\s*@ data.*$", "", message.splitlines()[0] if message else "")
    head = re.sub(r"\([^)]*\)|'[^']*'|\"[^\"]*\"", "…", head)
    return re.sub(r"\s+", " ", head).strip()[:60]


def status_class(status: Any) -> str:
    return str(status) if isinstance(status, int) and status in (200, 400, 401, 403, 404, 405, 500, 502, 503) else "<other>"


def path_shape(path: str) -> str:
    """`action/0/choose/1/sequence/0` -> `action/N/choose/N/sequence/N`: a trace path's pattern."""
    return re.sub(r"\d+", "N", path)


def scan_secrets(v: Any, depth: int = 0) -> tuple[int, int]:
    """(secret-like keys, strings that look like an unresolved `!secret`) anywhere inside a config - counts only."""
    keys = tags = 0
    if depth > 30:
        return 0, 0
    if isinstance(v, dict):
        for k, x in v.items():
            if isinstance(k, str) and SECRET_WORDS.search(k):
                keys += 1
            a, b = scan_secrets(x, depth + 1)
            keys, tags = keys + a, tags + b
    elif isinstance(v, list):
        for x in v:
            a, b = scan_secrets(x, depth + 1)
            keys, tags = keys + a, tags + b
    elif isinstance(v, str) and v.lstrip().startswith("!secret"):
        tags += 1
    return keys, tags


# ---------------------------------------------------------------- the summaries (U-1 ... U-10)

def summarize_configs(kind: str, configs: list[dict[str, Any]], statuses: collections.Counter) -> dict[str, Any]:
    """U-1 / U-2: what the config GET answers look like."""
    first_keys = collections.Counter(str(next(iter(c))) if c else "<empty>" for c in configs)
    out: dict[str, Any] = {"read": len(configs), "get_status": dict(sorted(statuses.items())), "top_level": {**key_sets(configs), "types": key_types(configs)},
                           "first_key": dict(sorted(first_keys.items())), "with_id_key": sum(1 for c in configs if "id" in c)}
    if kind == "automation":
        out["schema"] = {"new_keys": sum(1 for c in configs if "triggers" in c), "old_keys": sum(1 for c in configs if "trigger" in c), "mixed": sum(1 for c in configs if "trigger" in c and "triggers" in c),
                         "legacy_platform_or_service_keys": sum(1 for c in configs if re.search(r'"(platform|service)"', json.dumps(c)))}
        out["modes"] = dict(sorted(collections.Counter(str(c.get("mode", "<absent>")) if c.get("mode") in ("single", "restart", "queued", "parallel") else "<absent>" for c in configs).items()))
        out["extra_top_level_keys"] = sorted({str(k) for c in configs for k in c if k not in ("id", "alias", "description", "triggers", "trigger", "conditions", "condition", "actions", "action", "mode", "max") and ATTRIBUTE_NAME.match(str(k))})
        out["blueprint_based"] = sum(1 for c in configs if "use_blueprint" in c)
    if kind == "script":
        out["extra_top_level_keys"] = sorted({str(k) for c in configs for k in c if k not in ("alias", "description", "icon", "mode", "max", "fields", "sequence") and ATTRIBUTE_NAME.match(str(k))})
        out["with_fields"] = sum(1 for c in configs if isinstance(c.get("fields"), dict) and c["fields"])
        selectors = collections.Counter(next(iter(f["selector"])) for c in configs if isinstance(c.get("fields"), dict) for f in c["fields"].values()
                                        if isinstance(f, dict) and isinstance(f.get("selector"), dict) and len(f["selector"]) == 1 and next(iter(f["selector"])) in ("number", "boolean", "select", "text", "entity", "time", "object", "template"))
        out["field_selector_kinds"] = dict(sorted(selectors.items()))
    if kind == "scene":
        out["entities_member_forms"] = dict(sorted(collections.Counter(vtype(v) for c in configs if isinstance(c.get("entities"), dict) for v in c["entities"].values()).items()))
        out["member_attribute_keys"] = sorted({str(k) for c in configs if isinstance(c.get("entities"), dict) for v in c["entities"].values() if isinstance(v, dict) for k in v if ATTRIBUTE_NAME.match(str(k))})
    return out


def summarize_u4(configs: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    """U-4: how a secret inside a stored file comes back from GET - which counts can be observed read-only."""
    keys = tags = items = 0
    for lst in configs.values():
        for c in lst:
            a, b = scan_secrets(c)
            keys, tags, items = keys + a, tags + b, items + (1 if (a or b) else 0)
    return {"status": "OBSERVED" if items else "NOT_OBSERVABLE", "items_with_secret_like_keys": items, "secret_like_keys": keys, "strings_that_look_like_an_unresolved_tag": tags,
            "note": "0 items: no stored secret to observe; a resolved !secret reads back as its value (the bridge refuses to rewrite a file that carries tags)"}


def summarize_u9(configs: list[dict[str, Any]]) -> dict[str, Any]:
    """U-9: purpose-specific triggers (`switch.turned_on` ...) as the config API returns them."""
    trig = [t for c in configs for t in (c.get("triggers") if isinstance(c.get("triggers"), list) else []) if isinstance(t, dict) and isinstance(t.get("trigger"), str) and "." in t["trigger"]]
    names = collections.Counter(t["trigger"] if t["trigger"].split(".", 1)[0] in STANDARD_DOMAINS else "<other.*>" for t in trig)
    return {"count": len(trig), "triggers": dict(sorted(names.items())), "keys": {**key_sets(trig), "types": key_types(trig)},
            "options_keys": sorted({str(k) for t in trig if isinstance(t.get("options"), dict) for k in t["options"] if ATTRIBUTE_NAME.match(str(k))}),
            "target_forms": dict(sorted(collections.Counter(vtype(t.get("target")) for t in trig).items()))}


def summarize_trace(domain: str, listing: list[dict[str, Any]], full: dict[str, Any] | None) -> dict[str, Any]:
    """U-7: the shape of `trace/list` rows and of one `trace/get` answer (steps, results, variables, context)."""
    out: dict[str, Any] = {"runs_listed": len(listing), "list_row": {**key_sets(listing), "types": key_types(listing)},
                           "state": dict(sorted(collections.Counter(r.get("state") if r.get("state") in KNOWN_TRACE_STATES else "<other>" for r in listing).items())),
                           "script_execution": dict(sorted(collections.Counter(r.get("script_execution") if r.get("script_execution") in KNOWN_SCRIPT_EXECUTION else "<other>" for r in listing).items()))}
    if not full:
        out["get"] = None
        return out
    trace = full.get("trace") if isinstance(full.get("trace"), dict) else {}
    steps = [s for lst in trace.values() if isinstance(lst, list) for s in lst if isinstance(s, dict)]
    results = [s["result"] for s in steps if isinstance(s.get("result"), dict)]
    ctx = full.get("context") if isinstance(full.get("context"), dict) else {}
    cv = {str(k) for s in steps if isinstance(s.get("changed_variables"), dict) for k in s["changed_variables"]}
    out["get"] = {"keys": {k: vtype(v) for k, v in sorted(full.items())}, "path_patterns": dict(sorted(collections.Counter(path_shape(str(p)) for p in trace).items())),
                  "step": {**key_sets(steps), "types": key_types(steps), "unknown_keys": sorted({str(k) for s in steps for k in s if k not in KNOWN_STEP_KEYS})},
                  "result_keys": sorted({str(k) for r in results for k in r}), "steps_with_error": sum(1 for s in steps if "error" in s),
                  "changed_variables_names": sorted(n for n in cv if n in KNOWN_TRIGGER_VARS), "changed_variables_other_names": len([n for n in cv if n not in KNOWN_TRIGGER_VARS]),
                  "context": {k: vtype(v) for k, v in sorted(ctx.items())}, "has_config": isinstance(full.get("config"), dict), "timestamp": {k: vtype(v) for k, v in sorted((full.get("timestamp") or {}).items())}
                  if isinstance(full.get("timestamp"), dict) else None}
    return out


def summarize_services(services: dict[str, Any] | None) -> dict[str, Any]:
    """U-3 / U-8 (the readable half): which authoring services exist and their fields. Admin status of a service is not exposed read-only."""
    if not isinstance(services, dict):
        return {"registered": False}

    def fields(domain: str, name: str) -> list[str] | None:
        spec = (services.get(domain) or {}).get(name)
        return sorted((spec.get("fields") or {}).keys()) if isinstance(spec, dict) else None

    wanted = {"automation": ("reload", "trigger", "turn_on", "turn_off", "toggle"), "script": ("reload", "turn_on", "turn_off", "toggle"), "scene": ("reload", "turn_on", "apply", "create", "delete")}
    return {"registered": True, "services": {f"{d}.{n}": fields(d, n) for d, names in wanted.items() for n in names},
            "automation_reload_takes_id": "id" in (fields("automation", "reload") or []), "automation_trigger_has_skip_condition": "skip_condition" in (fields("automation", "trigger") or []),
            "automation_trigger_has_variables": "variables" in (fields("automation", "trigger") or []), "scene_create_has_snapshot_entities": "snapshot_entities" in (fields("scene", "create") or []),
            "domains_with_services_of_authoring_interest": sorted(d for d in services if d in wanted),
            "admin_status": "NOT_OBSERVABLE (get_services does not say; U-8 needs a call)"}


# ---------------------------------------------------------------- the read-only probe

async def run_probe(session: Session, rest: Rest, *, max_items: int = 200, log: Callable[[str], None] = print) -> dict[str, Any]:
    """Everything the contract wants to verify without writing. Returns {summary, raw}; `raw` carries names and is never printed."""
    rest = GuardedRest(rest, write_ok=False)  # the read-only run can only GET
    raw: dict[str, Any] = {}
    summary: dict[str, Any] = {"ha_version": session.ha_version}

    cfg = await session.call("get_config")
    result = cfg.get("result") if cfg.get("success") and isinstance(cfg.get("result"), dict) else {}
    comps = result.get("components") if isinstance(result.get("components"), list) else []
    summary["config"] = {"ok": bool(cfg.get("success")), "components": {c: (c in comps) for c in ("config", "automation", "script", "scene", "scheduler", "blueprint", "trace", "device_automation")},
                         "sub_components_listed": {c: (c in comps) for c in ("config.automation", "config.script", "config.scene")}, "config_dir_is_slash_config": result.get("config_dir") == "/config"}

    states = (await session.call("get_states")).get("result") or []
    raw["states"] = [s for s in states if isinstance(s, dict) and str(s.get("entity_id", "")).split(".")[0] in ("automation", "script", "scene")]
    registry = (await session.call("config/entity_registry/list")).get("result") or []
    reg = {r["entity_id"]: r for r in registry if isinstance(r, dict) and isinstance(r.get("entity_id"), str)}
    ents = {d: [s for s in raw["states"] if s["entity_id"].startswith(d + ".")] for d in ("automation", "script", "scene")}
    summary["counts"] = {d: {"entities": len(v), "state": dict(sorted(collections.Counter(str(s.get("state")) if s.get("state") in ("on", "off", "unavailable", "unknown") else "<other>" for s in v).items()))}
                         for d, v in ents.items()}

    # ids to read: an automation / scene's `id` attribute, a script's object id
    wanted: dict[str, list[tuple[str, str]]] = {"automation": [], "script": [], "scene": []}
    for s in ents["automation"]:
        i = (s.get("attributes") or {}).get("id")
        wanted["automation"].append((s["entity_id"], i if isinstance(i, str) else ""))
    for s in ents["script"]:
        wanted["script"].append((s["entity_id"], s["entity_id"].split(".", 1)[1]))
    for s in ents["scene"]:
        i = (s.get("attributes") or {}).get("id")
        wanted["scene"].append((s["entity_id"], i if isinstance(i, str) else ""))
    summary["counts"]["automation"]["without_id_attribute"] = sum(1 for _e, i in wanted["automation"] if not i)
    summary["counts"]["scene"]["without_id_attribute"] = sum(1 for _e, i in wanted["scene"] if not i)
    summary["counts"]["registry"] = {d: {"platform": dict(sorted(collections.Counter(
        (reg.get(e, {}).get("platform") if reg.get(e, {}).get("platform") in ("automation", "script", "homeassistant") else "<integration>") if e in reg else "<none>" for e, _i in wanted[d]).items())),
        "unique_id_equals_config_id": sum(1 for e, i in wanted[d] if i and reg.get(e, {}).get("unique_id") == i)} for d in wanted}

    configs: dict[str, list[dict[str, Any]]] = {"automation": [], "script": [], "scene": []}
    entity_for_config: dict[tuple[str, int], str] = {}
    statuses: dict[str, collections.Counter] = {d: collections.Counter() for d in wanted}
    for kind, pairs in wanted.items():
        for entity_id, cid in pairs[:max_items]:
            if not cid:
                continue
            status, body = await asyncio.to_thread(rest.request, "GET", f"/api/config/{kind}/config/{cid}")
            statuses[kind][status_class(status)] += 1
            if status == 200 and isinstance(body, dict):
                configs[kind].append(body)
                entity_for_config[(kind, len(configs[kind]) - 1)] = entity_id
    raw["configs"] = configs
    summary["u1_u2_config_api"] = {k: summarize_configs(k, v, statuses[k]) for k, v in configs.items()}
    summary["u1_u2_config_api"]["unmanaged_by_ui"] = {k: sum(1 for _e, i in wanted[k] if i) - len(configs[k]) for k in wanted}
    summary["u1_u2_config_api"]["files"] = {"status": "NOT_OBSERVABLE", "note": "the file names (automations.yaml / scripts.yaml / scenes.yaml) and the list / dict shapes are verified by W-1 / W-2; the GET shapes above are what the files hold"}

    # U-2: the WS read of the same item must equal the REST read
    ws_equal: dict[str, str] = {}
    for kind, cmd in (("automation", "automation/config"), ("script", "script/config")):
        if configs[kind]:
            eid = entity_for_config[(kind, 0)]
            frame = await session.call(cmd, entity_id=eid)
            if frame.get("success"):
                ws_cfg = (frame.get("result") or {}).get("config")
                ws_equal[kind] = "equal" if ws_cfg == configs[kind][0] else "differs"
            else:
                ws_equal[kind] = error_code(frame)
    summary["u2_ws_vs_rest"] = ws_equal or {"status": "NOT_RUN"}

    # U-3: HA's own validator through `validate_config`: a valid and an invalid request, the shape of the answer
    good = await session.call("validate_config", triggers=[{"trigger": "homeassistant", "event": "start"}], conditions=[{"condition": "sun", "after": "sunset"}],
                              actions=[{"delay": {"seconds": 1}}])
    bad = await session.call("validate_config", triggers=[{"trigger": "arx_probe_not_a_trigger"}], actions=[{"nothing": 1}])
    summary["u3_validation"] = {"valid_request": {k: ({"valid": v.get("valid"), "error": v.get("error")} if isinstance(v, dict) else vtype(v)) for k, v in ((good.get("result") or {}).items())} if good.get("success") else error_code(good),
                                "invalid_request": {k: ({"valid": v.get("valid"), "error_kind": safe_error_kind(v.get("error"))} if isinstance(v, dict) else vtype(v)) for k, v in ((bad.get("result") or {}).items())} if bad.get("success") else error_code(bad),
                                "import_path": {"status": "NOT_OBSERVABLE", "note": "async_validate_config_item (automation, script) and the scene schema are read in the HA source at this version (see ha_version)"}}
    summary["u4_secrets"] = summarize_u4(configs)
    summary["u5_include_line"] = {"status": "NOT_OBSERVABLE", "note": "a missing `automation: !include automations.yaml` shows only after a write (W-1: the entity never appears; the bridge rolls the create back)",
                                  "items_readable_by_get_without_an_entity": 0}

    # U-6: a template-render command and whether it needs admin (a constant template: no state read, no effect)
    tpl = await session.call("render_template", template="{{ 1 + 1 }}", timeout=3)
    summary["u6_render_template"] = {"command": "success" if tpl.get("success") else error_code(tpl), "note": "condition testing needs a script execution (admin, a write): not tried"}

    # U-7: traces
    traces: dict[str, Any] = {}
    for domain in ("automation", "script"):
        lst_frame = await session.call("trace/list", domain=domain)
        listing = [r for r in (lst_frame.get("result") or []) if isinstance(r, dict)] if lst_frame.get("success") else []
        full = None
        if listing:
            newest = max(listing, key=lambda r: str((r.get("timestamp") or {}).get("start", "")) if isinstance(r.get("timestamp"), dict) else "")
            got = await session.call("trace/get", domain=domain, item_id=newest.get("item_id"), run_id=newest.get("run_id"))
            full = got.get("result") if got.get("success") and isinstance(got.get("result"), dict) else None
        traces[domain] = {"list_command": "success" if lst_frame.get("success") else error_code(lst_frame), **summarize_trace(domain, listing, full)}
    summary["u7_traces"] = traces

    # U-8 / services
    services = (await session.call("get_services")).get("result")
    summary["u8_services"] = summarize_services(services if isinstance(services, dict) else None)

    summary["u9_purpose_specific_triggers"] = summarize_u9(configs["automation"])

    # registries a label / category / floor display needs
    regs: dict[str, Any] = {}
    for name, msg_type, fields in (("labels", "config/label_registry/list", {}), ("floors", "config/floor_registry/list", {}), ("areas", "config/area_registry/list", {}),
                                   ("categories_automation", "config/category_registry/list", {"scope": "automation"}), ("categories_script", "config/category_registry/list", {"scope": "script"})):
        frame = await session.call(msg_type, **fields)
        rows = [r for r in (frame.get("result") or []) if isinstance(r, dict)] if frame.get("success") else []
        regs[name] = {"command": "success" if frame.get("success") else error_code(frame), "count": len(rows), "keys": key_sets(rows)["keys"]}
    summary["registries"] = regs
    summary["u10_non_admin_call"] = {"status": "NOT_TESTABLE_READ_ONLY", "note": "a non-admin Context calling automation.trigger / turn_on / turn_off is a service call: --write-check with --non-admin-token-var, on the throwaway automation only"}
    return {"summary": summary, "raw": raw}


async def run_non_admin_probe(session: Session) -> dict[str, Any]:
    """U-10 (the read half): which read commands does a non-administrator's token get? Only success or a short error code."""
    out: dict[str, Any] = {}
    for msg_type, fields in READ_TRIES_NON_ADMIN:
        frame = await session.call(msg_type, **fields)
        out[msg_type] = "success" if frame.get("success") else error_code(frame)
    return out


# ---------------------------------------------------------------- the opt-in write check (W-1, W-2, U-10)

THROWAWAY_AUTOMATION = {"alias": "arx probe throwaway (safe to delete)", "description": "", "triggers": [{"trigger": "state", "entity_id": ["input_boolean.arx_probe_never_exists"], "to": "on", "id": "probe"}],
                        "conditions": [], "actions": [{"delay": {"hours": 0, "minutes": 0, "seconds": 1}}], "mode": "single"}
THROWAWAY_SCRIPT = {"alias": "arx probe throwaway (safe to delete)", "mode": "single", "sequence": [{"delay": {"hours": 0, "minutes": 0, "seconds": 1}}]}


def canon(v: Any) -> str:
    return json.dumps(v, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def form_diff(sent: dict[str, Any], stored: Any) -> dict[str, Any]:
    """How the stored form differs from the sent one: structure only."""
    if not isinstance(stored, dict):
        return {"stored": vtype(stored)}
    return {"same_content": canon(sent) == canon({k: v for k, v in stored.items() if k != "id"}) or canon(sent) == canon(stored), "key_order_kept": [k for k in stored if k != "id"] == [k for k in sent],
            "id_first": next(iter(stored), None) == "id", "added_keys": sorted(set(stored) - set(sent) - {"id"}), "dropped_keys": sorted(set(sent) - set(stored))}


async def run_write_check(session: Session, rest: Rest, *, non_admin: Session | None = None, scene_entity: str | None = None, log: Callable[[str], None] = print) -> dict[str, Any]:
    """W-1 / W-2 / U-10 on throwaway items. ALWAYS deletes what it created."""
    rest = GuardedRest(rest, write_ok=True)  # POST / DELETE only of an `arx_probe_` item
    stamp = str(int(time.time()))
    aid, sid, scid = f"{THROWAWAY_PREFIX}{stamp}", f"{THROWAWAY_PREFIX}{stamp}", f"{THROWAWAY_PREFIX}{stamp}"
    out: dict[str, Any] = {"throwaway": {"automation": True, "script": True, "scene": bool(scene_entity)}}
    created: list[tuple[str, str]] = []

    async def post(kind: str, key: str, body: dict[str, Any]) -> int:
        status, _b = await asyncio.to_thread(rest.request, "POST", f"/api/config/{kind}/config/{key}", body)
        if status == 200 and (kind, key) not in created:
            created.append((kind, key))
        return status

    async def entity_of(kind: str, key: str, wait_s: float = 5.0) -> str | None:
        deadline = time.monotonic() + wait_s
        while True:
            reg = (await session.call("config/entity_registry/list")).get("result") or []
            row = next((r for r in reg if isinstance(r, dict) and r.get("unique_id") == key and str(r.get("entity_id", "")).startswith(kind + ".")), None)
            if row or time.monotonic() > deadline:
                return row["entity_id"] if row else None
            await asyncio.sleep(0.5)

    try:
        auto = {"id": aid, **THROWAWAY_AUTOMATION}
        scene = ({"id": scid, "name": "arx probe throwaway", "entities": {scene_entity: {"state": "off"}}} if scene_entity else None)
        out["w1_automation"] = {"post_status": status_class(await post("automation", aid, THROWAWAY_AUTOMATION))}
        status, got = await asyncio.to_thread(rest.request, "GET", f"/api/config/automation/config/{aid}")
        out["w1_automation"]["get_status"] = status_class(status)
        out["w1_automation"]["stored_form"] = form_diff(THROWAWAY_AUTOMATION, got)
        out["w1_automation"]["equals_what_the_bridge_writer_emits"] = canon(got) == canon(auto)
        await session.call("call_service", domain="automation", service="reload", service_data={"id": aid})
        eid = await entity_of("automation", aid)
        out["w1_automation"]["entity_after_reload"] = eid is not None
        if eid:
            states = (await session.call("get_states")).get("result") or []
            st = next((s for s in states if isinstance(s, dict) and s.get("entity_id") == eid), None)
            attrs = (st or {}).get("attributes") or {}
            out["w1_automation"]["state"] = st.get("state") if st and st.get("state") in ("on", "off", "unavailable") else None
            out["w1_automation"]["attribute_id_equals_config_id"] = attrs.get("id") == aid
        # an update through the same path: replaced in place, entity kept
        edited = {**THROWAWAY_AUTOMATION, "alias": "arx probe throwaway edited"}
        out["w1_automation"]["update_status"] = status_class(await post("automation", aid, edited))
        await session.call("call_service", domain="automation", service="reload", service_data={"id": aid})
        out["w1_automation"]["entity_same_after_update"] = (await entity_of("automation", aid, 2.0)) == eid

        out["w2_script"] = {"post_status": status_class(await post("script", sid, THROWAWAY_SCRIPT))}
        status, got = await asyncio.to_thread(rest.request, "GET", f"/api/config/script/config/{sid}")
        out["w2_script"]["get_status"] = status_class(status)
        out["w2_script"]["stored_form"] = form_diff(THROWAWAY_SCRIPT, got)
        await session.call("call_service", domain="script", service="reload", service_data={})
        seid = await entity_of("script", sid)
        out["w2_script"]["entity_after_reload"] = seid is not None
        if scene:
            out["w2_scene"] = {"post_status": status_class(await post("scene", scid, {k: v for k, v in scene.items() if k != "id"}))}
            status, got = await asyncio.to_thread(rest.request, "GET", f"/api/config/scene/config/{scid}")
            out["w2_scene"]["get_status"] = status_class(status)
            out["w2_scene"]["stored_form"] = form_diff({k: v for k, v in scene.items() if k != "id"}, got)
            await session.call("call_service", domain="scene", service="reload", service_data={})
            out["w2_scene"]["entity_after_reload"] = (await entity_of("scene", scid)) is not None
        # the error shapes the contract relies on (GET unknown 404, DELETE unknown 400)
        s404, _ = await asyncio.to_thread(rest.request, "GET", f"/api/config/automation/config/{THROWAWAY_PREFIX}absent")
        s400, _ = await asyncio.to_thread(rest.request, "DELETE", f"/api/config/automation/config/{THROWAWAY_PREFIX}absent")
        out["error_shapes"] = {"get_unknown": status_class(s404), "delete_unknown": status_class(s400)}
        # U-10: a non-administrator
        if non_admin is not None and eid:
            u10: dict[str, Any] = {}
            for service, extra in (("turn_off", {}), ("turn_on", {}), ("trigger", {"skip_condition": True})):
                frame = await non_admin.call("call_service", domain="automation", service=service, service_data={"entity_id": eid, **extra})
                u10[f"automation.{service}"] = "success" if frame.get("success") else error_code(frame)
            out["u10_non_admin_call"] = u10
        else:
            out["u10_non_admin_call"] = {"status": "NOT_RUN (no --non-admin-token-var)"}
    finally:
        cleanup: dict[str, Any] = {}
        for kind, key in reversed(created):
            status, _b = await asyncio.to_thread(rest.request, "DELETE", f"/api/config/{kind}/config/{key}")
            cleanup[f"delete_{kind}"] = status_class(status)
        gone: dict[str, Any] = {}
        reg = (await session.call("config/entity_registry/list")).get("result") or []
        for kind, key in created:
            gone[kind] = not any(isinstance(r, dict) and r.get("unique_id") == key for r in reg)
        out["cleanup"] = {**cleanup, "registry_entry_gone": gone, "left_behind": sum(1 for v in gone.values() if not v)}
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
    target = Path(out).resolve()
    root = PRIVATE_EVIDENCE.resolve()
    if target != root and root not in target.parents:
        raise ProbeError("--out must be a folder inside private-evidence/")
    return target


def write_raw(out_dir: Path, result: dict[str, Any]) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for key in ("states", "configs"):
        (out_dir / f"{key}.json").write_text(json.dumps(result["raw"].get(key), ensure_ascii=False, indent=1), encoding="utf-8")
    (out_dir / "summary.json").write_text(json.dumps(result["summary"], ensure_ascii=False, indent=1), encoding="utf-8")


async def main_async(args: argparse.Namespace, open_connection: Callable[[str], Awaitable[Connection]] | None = None, make_rest: Callable[[str, str], Rest] | None = None,
                     log: Callable[[str], None] = print) -> int:
    env_path = Path(args.env_file)
    if not env_path.is_file():
        log("env file not found")
        return 2
    if args.write_check and not args.confirm_throwaway_write:
        log("--write-check needs --confirm-throwaway-write: it creates and deletes throwaway items and needs the owner's explicit approval")
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
    guest_token = pick(env, [args.non_admin_token_var]) if args.non_admin_token_var else None
    if args.non_admin_token_var and not guest_token:
        log(f"variable {args.non_admin_token_var} is not set: the non-admin part is skipped")
    scene_entity = pick(env, [args.scene_entity_var]) if args.scene_entity_var else None
    opener = open_connection or (lambda u: open_ws(u, args.ws_path))
    rest_factory = make_rest or (lambda u, t: HttpRest(u, t, args.rest_prefix))
    try:
        conn = await opener(url)
        session = Session(conn, write_ok=bool(args.write_check))
        if not await session.authenticate(token):
            log("auth: refused")
            return 2
        log("auth: ok (" + ("WRITE CHECK on throwaway items" if args.write_check else "read-only probe") + ")")
        rest = rest_factory(url, token)
        result = await run_probe(session, rest, max_items=args.max_items, log=log)
        gsession: Session | None = None
        if guest_token:
            gconn = await opener(url)
            gsession = Session(gconn, write_ok=bool(args.write_check))
            if await gsession.authenticate(guest_token):
                result["summary"]["u10_non_admin_reads"] = await run_non_admin_probe(gsession)
            else:
                result["summary"]["u10_non_admin_reads"] = {"auth": "refused"}
                await gconn.close()
                gsession = None
        else:
            result["summary"]["u10_non_admin_reads"] = {"skipped": True}
        if args.write_check:
            result["summary"]["write_check"] = await run_write_check(session, rest, non_admin=gsession, scene_entity=scene_entity, log=log)
        if gsession is not None:
            await gsession.conn.close()
        await conn.close()
    except ProbeRefused as exc:
        log(f"REFUSED: {exc}")
        return 3
    except Exception as exc:  # noqa: BLE001 - class name only: an error text may carry the host or a header
        log(f"probe failed: {type(exc).__name__}")
        return 2
    log(json.dumps(result["summary"], ensure_ascii=False, indent=1, sort_keys=True))
    if out_dir:
        write_raw(out_dir, result)
        log("raw answers written inside private-evidence/ (git-ignored; they contain names and entity ids)")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Probe of the automations / scripts / scenes surface (CR-017 phase 0). Read-only unless --write-check --confirm-throwaway-write.")
    p.add_argument("env_file", help="KEY=VALUE file holding the Home Assistant URL and a long-lived token")
    p.add_argument("--url-var", help="name of the URL variable (default SW_PROBE_HA_URL, then HA_URL)")
    p.add_argument("--token-var", help="name of the token variable (default SW_PROBE_HA_TOKEN, then HA_TOKEN)")
    p.add_argument("--non-admin-token-var", help="name of a variable holding a NON-admin user's token (U-10)")
    p.add_argument("--rest-prefix", default="/api", help="REST prefix: /api directly, /core/api through the Supervisor proxy (U-2)")
    p.add_argument("--ws-path", default="/api/websocket", help="WebSocket path: /api/websocket directly, /core/websocket through the Supervisor proxy")
    p.add_argument("--max-items", type=int, default=200, help="read at most N configs per kind")
    p.add_argument("--out", help="folder inside private-evidence/ for the raw answers (optional)")
    p.add_argument("--write-check", action="store_true", help="OPT-IN: create, read back, reload and delete throwaway items (W-1, W-2, U-10)")
    p.add_argument("--confirm-throwaway-write", action="store_true", help="required with --write-check: the owner approved the throwaway writes")
    p.add_argument("--scene-entity-var", help="with --write-check: name of a variable holding ONE existing entity id to use as the member of a throwaway scene")
    return p


if __name__ == "__main__":
    sys.exit(asyncio.run(main_async(build_parser().parse_args())))
