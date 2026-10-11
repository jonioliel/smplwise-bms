"""A reusable fake WisKey behind a fake Home Assistant WebSocket (CR-036 slice S0).

Every WisKey test of stage 1 runs against this module; nothing here contacts a device, a station, Home Assistant or WisKey.

What it is:

- `FakeWiskey`: the command responder. It answers `hikvision_intercom/<command>` frames the way WisKey rc.37 does, from the
  recorded-shape fixtures in `tests/fixtures/wiskey_rc37/` (synthetic values; see PROVENANCE.md there), plus the few Home
  Assistant frames the add-on sends (`get_config`, `subscribe_entities`, `unsubscribe_events`).
- `FakeWiskeySocket`: one scripted Home Assistant WebSocket (auth handshake by token, then the responder), with optional
  delays, server pushes (`refresh`, `access_revoked`, `screen_locked`) and a close. `FakeWiskey.connect` is a drop-in for
  `websockets.connect` (monkeypatch it).
- `FakeWiskey.script`: the same responder in the `script(msg, fake)` form of tests/test_intercom.py's `FakeHa`, so the
  existing harness (`feed`, `split` fixtures) can use it unchanged.

What is derived from the pinned catalog (docs/integrations/wiskey/catalog/rc37-contract.4):

- the command set: a command that is not in `commands.static.json` (and is not one of WisKey's separate handlers
  `subscribe`, `tts/engines`, `tts/start`) is answered `unknown_command`, as Home Assistant does;
- request validation (`strict`, on by default): required keys, no key outside the request schema (`additionalProperties:
  false`), primitive types and integer bounds - a violation is answered `invalid_format` (Home Assistant's voluptuous code);
- authorization: the identity's WisKey areas (`authorization/session` fixture) are checked against the command's
  `alternative_area_grants` / `administrator_only_by_base_mapping`; a miss is answered `unauthorized`;
- every error code the fake answers is one the catalog's `errors.static.json` lists, or one of Home Assistant's own
  (`HA_ERROR_CODES`) - tests/test_fake_wiskey.py checks that.

Switches (attributes, change them at any time, also while a session is open):

- `offline`: station ids that are offline - the overview shows them offline (`call_state: unavailable`, `sync_state:
  offline`), station-bound physical commands answer `station_offline`;
- `stale_revision`: writes that carry a `revision` answer `revision_conflict`, and `users/query` pages come back `stale: true`;
- `forbidden`: `True` refuses every WisKey command with `unauthorized`; a set refuses only those commands;
- `slow`: seconds to wait before each answer (`slow_commands` restricts it to some commands);
- `drift`: schema drift - unknown top-level and per-row keys, unknown enum values, a dropped field (`last_seen`), so a
  test can prove unknown fields are dropped and unknown values shown as unknown;
- `errors`: `{command: code}` - answer that command with that error code once per call (a hook for one-off cases).

Shapes the catalog does not give (responses are "not statically generated" there) come from the fixtures; the fixtures follow
the shapes tests/test_intercom.py already used (WISKEY_SOURCE_EXTRACTION.md, rc.37 `types.ts`). Where WisKey's real behaviour
is not verified (marked W? in CR-036), the fake says so in a comment rather than guessing silently.
"""
from __future__ import annotations

import asyncio
import copy
import json
from pathlib import Path
from typing import Any, Callable, Iterable

REPO = Path(__file__).resolve().parents[3]
PIN_DIR = REPO / "docs" / "integrations" / "wiskey" / "catalog" / "rc37-contract.4"
FIXTURES = Path(__file__).resolve().parent / "fixtures" / "wiskey_rc37"
DOMAIN = "hikvision_intercom"
PREFIX = DOMAIN + "/"

# Home Assistant's own error codes the fake may answer (homeassistant/components/websocket_api/const.py), not WisKey's.
HA_ERROR_CODES = frozenset({"unknown_command", "invalid_format"})
# WisKey's handlers outside the static catalog (CONTRACT_DIFF.md): exact key sets their own handlers check.
SEPARATE_HANDLERS: dict[str, frozenset[str]] = {
    "subscribe": frozenset({"id", "type"}),
    "tts/engines": frozenset({"id", "type"}),
    "tts/start": frozenset({"id", "type", "station_id", "engine_id", "language", "message"}),
}
# W?: the area a separate handler needs is not in the catalog. The fake assumes `overview: view` for `subscribe` and
# `tts/engines`, and `overview: manage` for `tts/start`; tests that depend on it say so.
SEPARATE_GRANTS: dict[str, list[tuple[str, str]]] = {
    "subscribe": [("overview", "view"), ("users", "view"), ("events", "view"), ("stations", "view"), ("management", "view")],
    "tts/engines": [("overview", "view")],
    "tts/start": [("overview", "manage")],
}
# commands that act on a station's device: refused with `station_offline` when the station is offline
STATION_BOUND = frozenset({"stations/test_unlock", "media/signal", "tts/start", "cards/reader_capabilities", "cards/capture_start"})
REVISIONED_WRITES = frozenset({"users/update", "users/delete", "cards/capture_start"})
LEVELS = {"none": 0, "view": 1, "manage": 2}
FIXTURE_FOR = {
    "overview": "overview.json",
    "events/list": "events_list.json",
    "users/query": "users_query.json",
    "users/get": "users_get.json",
    "media/signal": "media_signal.json",
    "tts/engines": "tts_engines.json",
    "stations/test_unlock": "stations_test_unlock.json",
    "users/pin_generate": "users_pin_generate.json",
    "users/delete": "users_delete.json",
    "cards/reader_capabilities": "cards_reader_capabilities.json",
}
DRIFT_ENUMS = {"call_state": "teleporting", "sync_state": "quantum", "result": "maybe", "authentication": "retina"}
CLOSE = object()


def load_catalog(pin_dir: Path = PIN_DIR) -> tuple[dict[str, Any], dict[str, Any]]:
    commands = json.loads((pin_dir / "commands.static.json").read_text(encoding="utf-8"))["commands"]
    errors = json.loads((pin_dir / "errors.static.json").read_text(encoding="utf-8"))["errors"]
    return commands, errors


def fixture(name: str) -> Any:
    """A deep copy of one recorded-shape fixture (`overview.json`, `authorization_session.admin.json`, ...)."""
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def ok(msg: dict[str, Any], result: Any = None) -> dict[str, Any]:
    return {"id": msg["id"], "type": "result", "success": True, "result": result}


def fail(msg: dict[str, Any], code: str) -> dict[str, Any]:
    return {"id": msg["id"], "type": "result", "success": False, "error": {"code": code, "message": code}}


_PRIMITIVES = {"string": str, "object": dict, "array": list, "boolean": bool, "null": type(None)}


def conforms(value: Any, schema: dict[str, Any]) -> bool:
    """The primitive part of a catalog property schema (the catalog states nothing about nested shapes)."""
    if "const" in schema:
        return value == schema["const"]
    kind = schema.get("type")
    kinds = kind if isinstance(kind, list) else [kind]
    for k in kinds:
        if k == "integer":
            if isinstance(value, int) and not isinstance(value, bool) and schema.get("minimum", value) <= value <= schema.get("maximum", value):
                return True
        elif k == "number":
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                return True
        elif k in _PRIMITIVES:
            if isinstance(value, _PRIMITIVES[k]):
                return True
        elif k is None:
            return True
    return False


class FakeWiskey:
    """The responder. `identity` names an `authorization_session.<identity>.json` fixture (`admin`, `background`) or is a dict
    of the same shape; `token` is the Home Assistant token the fake socket accepts for it. `more` adds further accounts,
    `{token: identity}` (the split background account of D-006 is `{"bg-token": "background"}`); each socket answers as the
    account it authenticated with."""

    def __init__(self, identity: str | dict[str, Any] = "admin", *, token: str = "t", more: dict[str, str | dict[str, Any]] | None = None,
                 strict: bool = True, pin_dir: Path = PIN_DIR) -> None:
        self.commands, self.errors = load_catalog(pin_dir)
        self.token = token
        self.identities: dict[str, dict[str, Any]] = {
            tok: (fixture(f"authorization_session.{ident}.json") if isinstance(ident, str) else copy.deepcopy(ident))
            for tok, ident in {token: identity, **(more or {})}.items()
        }
        self.auth = self.identities[token]
        self.strict = strict
        self.overview = fixture("overview.json")
        # switches
        self.offline: set[str] = set()
        self.stale_revision = False
        self.forbidden: bool | set[str] = False
        self.slow = 0.0
        self.slow_commands: set[str] | None = None
        self.drift = False
        self.errors_once: dict[str, str] = {}
        # what happened
        self.received: list[dict[str, Any]] = []
        self.answered: list[tuple[str, str]] = []  # (command or HA type, "ok" | error code)
        self.sockets: list[FakeWiskeySocket] = []

    # ------------------------------------------------------------ switches as methods (readable in tests)
    def set_offline(self, *station_ids: str) -> "FakeWiskey":
        self.offline |= set(station_ids)
        return self

    def set_forbidden(self, commands: bool | Iterable[str] = True) -> "FakeWiskey":
        self.forbidden = commands if isinstance(commands, bool) else set(commands)
        return self

    # ------------------------------------------------------------ the responder
    def respond(self, msg: dict[str, Any], token: str | None = None) -> list[Any]:
        """The frames that answer one client frame of the account `token` (default: the main one; no delay, see
        `delay_for`)."""
        auth = self.identities.get(token if token is not None else self.token)
        if auth is None:
            raise AssertionError("a frame from an account the fake does not know")
        self.received.append(copy.deepcopy(msg))
        kind = str(msg.get("type") or "")
        if not kind.startswith(PREFIX):
            return self._ha(msg, kind)
        command = kind[len(PREFIX):]
        code = self._refusal(command, msg, auth)
        if code is not None:
            self.answered.append((command, code))
            return [fail(msg, code)]
        frames = self._answer(command, msg, auth)
        self.answered.append((command, "ok" if frames and frames[0].get("success") else str(((frames or [{}])[0].get("error") or {}).get("code"))))
        return frames

    def script(self, msg: dict[str, Any], _fake: Any = None) -> list[Any]:
        """tests/test_intercom.py `FakeHa` script form."""
        return self.respond(msg)

    def delay_for(self, msg: dict[str, Any]) -> float:
        kind = str(msg.get("type") or "")
        command = kind[len(PREFIX):] if kind.startswith(PREFIX) else kind
        if self.slow and (self.slow_commands is None or command in self.slow_commands):
            return self.slow
        return 0.0

    def _ha(self, msg: dict[str, Any], kind: str) -> list[Any]:
        if kind == "get_config":
            self.answered.append((kind, "ok"))
            return [ok(msg, {"state": "RUNNING", "version": "2026.9.0", "components": [DOMAIN]})]
        if kind in ("subscribe_entities", "unsubscribe_events"):
            self.answered.append((kind, "ok"))
            return [ok(msg)]
        self.answered.append((kind, "unknown_command"))
        return [fail(msg, "unknown_command")]

    def _refusal(self, command: str, msg: dict[str, Any], auth: dict[str, Any]) -> str | None:
        entry = self.commands.get(command)
        if entry is None and command not in SEPARATE_HANDLERS:
            return "unknown_command"
        if self.strict:
            if entry is None:
                if set(msg) != SEPARATE_HANDLERS[command]:
                    return "invalid_format"
            else:
                schema = entry["request"]
                props = schema.get("properties") or {}
                if schema.get("additionalProperties") is False and set(msg) - set(props):
                    return "invalid_format"
                if set(schema.get("required") or []) - set(msg):
                    return "invalid_format"
                if any(not conforms(v, props[k]) for k, v in msg.items() if k in props):
                    return "invalid_format"
                if len(json.dumps(msg)) > int(entry.get("max_request_bytes") or 65536):
                    return "request_too_large"
        if self.forbidden is True or (isinstance(self.forbidden, set) and command in self.forbidden):
            return "unauthorized"
        if not self._granted(command, entry, auth):
            return "unauthorized"
        if command in self.errors_once:
            return self.errors_once.pop(command)
        station_id = msg.get("station_id")
        if command in STATION_BOUND and isinstance(station_id, str):
            if station_id not in {s["id"] for s in self.overview["stations"]}:
                return "station_not_found"
            if station_id in self.offline:
                return "station_offline"
        if self.stale_revision and command in REVISIONED_WRITES and "revision" in msg:
            return "revision_conflict"
        return None

    def _granted(self, command: str, entry: dict[str, Any] | None, auth: dict[str, Any]) -> bool:
        if auth.get("allowed") is False:
            return False
        if auth.get("is_admin") is True:
            return True
        if entry is not None and entry["permission"].get("administrator_only_by_base_mapping"):
            return False
        grants = SEPARATE_GRANTS.get(command) if entry is None else entry["permission"].get("alternative_area_grants")
        if not grants:
            # the catalog names no area: `authorization/session` is an "active-user session endpoint" (any allowed user);
            # everything else (administrator-only, the personal renewal grant) is refused for a non-administrator here
            # (W?: the renewal grant is not modelled - the conservative reading)
            return entry is not None and entry["permission"].get("special_access") == "active-user session endpoint"
        areas = auth.get("areas") or {}
        return any(LEVELS.get(str(areas.get(area)), 0) >= LEVELS.get(level, 9) for area, level in grants)

    def _answer(self, command: str, msg: dict[str, Any], auth: dict[str, Any]) -> list[Any]:
        if command == "overview":
            return [ok(msg, self._overview(auth))]
        if command == "authorization/session":
            return [ok(msg, copy.deepcopy(auth))]
        if command == "subscribe":
            return [ok(msg)]
        if command == "users/query":
            page = fixture("users_query.json")
            if self.stale_revision:
                page["stale"] = True
            return [ok(msg, self._drifted(page, rows="records"))]
        if command == "events/list":
            return [ok(msg, self._drifted(fixture("events_list.json"), rows="records"))]
        if command == "users/get":
            person = fixture("users_get.json")
            if msg.get("user_id") != person["id"]:
                return [fail(msg, "user_not_found")]
            return [ok(msg, self._drifted(person))]
        if command == "tts/start":
            return [ok(msg)]  # the subscription id is the frame id (audio_tts.py); events are pushed by the test if needed
        name = FIXTURE_FOR.get(command)
        if name is not None:
            return [ok(msg, fixture(name))]
        if command in ("users/create", "users/update"):
            person = fixture("users_get.json")
            person["revision"] = int(msg.get("revision") or 0) + 1
            return [ok(msg, person)]  # WisKey answers the person's public record
        return [ok(msg, {})]

    def _overview(self, auth: dict[str, Any]) -> dict[str, Any]:
        raw = copy.deepcopy(self.overview)
        for station in raw["stations"]:
            if station["id"] in self.offline:
                station.update(online=False, call_state="unavailable", sync_state="offline")
        if auth.get("is_admin") is not True:
            # a restricted account: no directory, no technical station fields (SCOPES "Projection placeholders") - but
            # WisKey still sends `last_access` with a person name (WisKey's own D-006 finding), so the fake keeps it
            raw["users"], raw["user_count"] = [], 0
            for station in raw["stations"]:
                for key in ("host", "model", "firmware", "capabilities", "observations", "clock", "event_status", "last_poll_ms"):
                    station.pop(key, None)
            ids = auth.get("station_ids")
            if isinstance(ids, list):
                raw["stations"] = [s for s in raw["stations"] if s["id"] in ids]
        raw["access"] = {k: copy.deepcopy(auth.get(k)) for k in ("allowed", "is_admin", "revision", "areas")}
        return self._drifted(raw, rows="stations")

    def _drifted(self, body: dict[str, Any], rows: str | None = None) -> dict[str, Any]:
        if not self.drift:
            return body
        body["x_unknown_top_level"] = {"nested": ["a", 1, None], "person_name": "Drift Person"}
        items = body.get(rows) if rows else [body]
        for item in items or []:
            if not isinstance(item, dict):
                continue
            item["x_unknown_field"] = "drift"
            for key, value in DRIFT_ENUMS.items():
                if key in item:
                    item[key] = value
            item.pop("last_seen", None)
        return body

    # ------------------------------------------------------------ sockets
    def connect(self, url: str, **_kw: Any) -> "FakeWiskeySocket":
        """Drop-in for `websockets.connect` (monkeypatch it)."""
        sock = FakeWiskeySocket(self, url)
        self.sockets.append(sock)
        return sock

    def push(self, kind: str) -> int:
        """Send a data-free `subscribe` event (`refresh`, `access_revoked`, `screen_locked`) on every open socket that
        subscribed. Returns how many sockets got it. Call it from the test thread; it is handed to each socket's loop."""
        n = 0
        for sock in self.sockets:
            if sock.subscription is not None and not sock.closed:
                sock.inject({"id": sock.subscription, "type": "event", "event": {"kind": kind}})
                n += 1
        return n

    def close_all(self) -> None:
        for sock in self.sockets:
            sock.inject(CLOSE)

    def types_sent(self) -> list[str]:
        return [str(m.get("type") or "") for m in self.received]

    def commands_sent(self) -> list[str]:
        return [t[len(PREFIX):] for t in self.types_sent() if t.startswith(PREFIX)]


class FakeWiskeySocket:
    """One scripted Home Assistant WebSocket in front of a FakeWiskey: `auth_required` -> `auth` (only the fake's token is
    accepted) -> `auth_ok`, then every frame goes to the responder; answers wait `delay_for(msg)` seconds."""

    def __init__(self, wiskey: FakeWiskey, url: str) -> None:
        self.wiskey = wiskey
        self.url = url
        self.q: asyncio.Queue | None = None
        self.loop: asyncio.AbstractEventLoop | None = None
        self.token: str | None = None
        self.subscription: int | None = None
        self.closed = False
        self.sent: list[dict[str, Any]] = []

    async def __aenter__(self) -> "FakeWiskeySocket":
        self.loop = asyncio.get_running_loop()
        self.q = asyncio.Queue()
        self.q.put_nowait({"type": "auth_required", "ha_version": "2026.9.0"})
        return self

    async def __aexit__(self, *exc: Any) -> bool:
        self.closed = True
        return False

    async def recv(self) -> str:
        assert self.q
        item = await self.q.get()
        if item is CLOSE:
            self.closed = True
            raise ConnectionError("closed by the fake")
        return json.dumps(item)

    async def send(self, raw: str) -> None:
        assert self.q
        msg = json.loads(raw)
        self.sent.append(msg)
        if msg.get("type") == "auth":
            self.token = msg.get("access_token")
            self.q.put_nowait({"type": "auth_ok" if self.token in self.wiskey.identities else "auth_invalid"})
            return
        frames = self.wiskey.respond(msg, self.token)
        if msg.get("type") == PREFIX + "subscribe" and frames and frames[0].get("success"):
            self.subscription = msg["id"]
        delay = self.wiskey.delay_for(msg)
        if delay > 0:
            loop = asyncio.get_running_loop()
            for frame in frames:
                loop.call_later(delay, self.q.put_nowait, frame)
        else:
            for frame in frames:
                self.q.put_nowait(frame)

    def inject(self, frame: Any) -> None:
        """Queue a server frame from any thread."""
        if self.loop is None or self.q is None:
            return
        self.loop.call_soon_threadsafe(self.q.put_nowait, frame)

    def __aiter__(self) -> "FakeWiskeySocket":
        return self

    async def __anext__(self) -> str:
        assert self.q
        item = await self.q.get()
        if item is CLOSE:
            self.closed = True
            raise StopAsyncIteration
        return json.dumps(item)

    async def close(self) -> None:
        self.closed = True


def all_error_codes(fake: FakeWiskey) -> set[str]:
    """Every error code this fake can answer (for the test that each one is in the catalog or is Home Assistant's own)."""
    return {"unknown_command", "invalid_format", "request_too_large", "unauthorized", "station_not_found", "station_offline",
            "revision_conflict", "user_not_found"} | set(fake.errors_once.values())


Responder = Callable[[dict[str, Any]], list[Any]]
