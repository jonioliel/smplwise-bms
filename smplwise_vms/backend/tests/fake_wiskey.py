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
- CR-036 S11 (the person writes): with `use_directory()` every person write (`users/create`, `update`, `delete`, `archive`,
  `unarchive`, `set_active`, `temporary_cancel`, `cards/add`, `cards/remove`) is answered STATEFULLY - the revision
  compare-and-set, rc.37's archive / temporary / card rules, card numbers unique across people (kept inside the fake, the record
  shows the mask), a photo written is the one `users/photo_get` serves - so a test can write and read the effect back;
  `pin_value`: the SENTINEL `users/pin_generate` answers (tests never use a real PIN).
- CR-036 S7 (the people screen's message dialog; W11 is NOT delivered, so every shape here is W? except the keys rc.37's
  whatsapp_api.py shows): `wa_available` (the messaging service is connected), `wa_quota` (`{limit, used}` sends per hour; the send
  past it is answered `rate_limited`), `wa_unregistered` (phone numbers the provider refuses: `whatsapp_invalid_phone`). A
  person may carry `whatsapp_consent` (`granted` | `declined` | `unknown`; the fake's own model of a consent W11 has not
  defined). The templates are an APPROVED catalogue with the placeholders {name} and {organization} only - never a PIN or any
  other credential (rc.37's own templates embed {pin}: the Arx adapter must not forward those; the fake models what Arx
  will require).

Shapes the catalog does not give (responses are "not statically generated" there) come from the fixtures; the fixtures follow
the shapes tests/test_intercom.py already used (WISKEY_SOURCE_EXTRACTION.md, rc.37 `types.ts`). Where WisKey's real behaviour
is not verified (marked W? in CR-036), the fake says so in a comment rather than guessing silently.
"""
from __future__ import annotations

import asyncio
import copy
import json
from datetime import datetime, timezone
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
REVISIONED_WRITES = frozenset({"users/update", "users/delete", "cards/capture_start",
                               # CR-036 S11
                               "users/archive", "users/unarchive", "users/set_active", "users/temporary_cancel", "cards/add", "cards/remove"})
# CR-036 S11: the person writes the fake answers STATEFULLY over the directory (`use_directory`): rc.37's own rules as read in the
# reference source (websocket.py `_dispatch_inner`, access/repository.py, access/models.py build_user) - existence, the revision
# compare-and-set, the archive / temporary / card checks, card numbers unique across people (kept only inside the fake; the
# public record carries the mask) - so a test can write, read back and see the effect. Without the directory a write answers the
# fixture person, as before.
PERSON_WRITES = frozenset({"users/create", "users/update", "users/delete", "users/archive", "users/unarchive", "users/set_active",
                           "users/temporary_cancel", "cards/add", "cards/remove"})
CARD_FIELDS = frozenset({"id", "card_no", "label", "card_type", "enabled"})
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
    # CR-036 S4: the stage-1 reads of the adapter (shapes from the S4 review of the rc.37 source; values synthetic)
    "events/export": "events_export.json",
    "profiles/settings_get": "profiles_settings_get.json",
    "profiles/versions": "profiles_versions.json",
    "schedules/list": "schedules_list.json",
    "schedules/plan_list": "schedules_plan_list.json",
    "schedules/operations_list": "schedules_operations_list.json",
    "conflicts/list": "conflicts_list.json",
    "fleet/alerts": "fleet_alerts.json",
    "audit/list": "audit_list.json",
}
# CR-036 S4: per-station reads - an unknown station is WisKey's own code for that handler
PER_STATION = {
    "health/get": ("health_get.json", "station_not_found"),
    "health/history": ("health_history.json", "station_not_found"),
    "stations/technical_program_list": ("stations_technical_program_list.json", "station_unloaded"),
    "stations/technical_hold_get": ("stations_technical_hold_get.json", "station_unloaded"),
    "stations/technical_codes_get": ("stations_technical_codes_get.json", "station_unloaded"),
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
        # CR-036 S4: the commands `overview.api.commands` lists - every catalog command for an administrator identity, the
        # fixture's list for any other; `unlist` removes some (a WisKey that lacks a command: the feature is hidden)
        self.unlisted: set[str] = set()
        # CR-036 S4: the identity-matrix data (`use_directory`): several people and events across the three stations
        self.directory: list[dict[str, Any]] | None = None
        self.event_rows: list[dict[str, Any]] | None = None
        # CR-036 S7: the clock `users/query` uses for the `expired` / `upcoming` states (None = the real one)
        self.now: datetime | None = None
        # CR-036 S7: the messaging fake (see the module docstring)
        self.wa_available = True
        self.wa_quota: dict[str, int] | None = None
        self.wa_unregistered: set[str] = set()
        self._wa_tokens: dict[str, dict[str, Any]] = {}
        # CR-036 S11: what the stateful person writes keep that a public record never shows (card numbers by card id, photos)
        self._card_numbers: dict[str, str] = {}
        self._photos: dict[str, str] = {}
        self._serial = 0
        self.pin_value: str | None = None  # `users/pin_generate` answers this sentinel when set (else the fixture's)
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

    def unlist(self, *commands: str) -> "FakeWiskey":
        self.unlisted |= set(commands)
        return self

    def use_directory(self) -> "FakeWiskey":
        """Five people across entry-a / entry-b / entry-c (one with none) and seven events across the stations, newest first:
        `users/query`, `users/get`, `users/photo_get`, `events/list` and `events/detail` answer from them (paging, the
        `station` / `rights` / `state` filters, the `before` cursor, the `person` match on name or employee number)."""
        self.directory = fixture("people_directory.json")
        self.event_rows = fixture("events_directory.json")
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
            if self.directory is not None:
                return [ok(msg, self._drifted(self._people_page(msg), rows="records"))]
            page = fixture("users_query.json")
            if self.stale_revision:
                page["stale"] = True
            return [ok(msg, self._drifted(page, rows="records"))]
        if command == "events/list":
            if self.event_rows is not None:
                return self._events_page(msg)
            return [ok(msg, self._drifted(fixture("events_list.json"), rows="records"))]
        if command == "users/get":
            person = self._person(msg.get("user_id"))
            if person is None:
                return [fail(msg, "user_not_found")]
            return [ok(msg, self._drifted(person))]
        if command == "users/photo_get":
            person = self._person(msg.get("user_id"))
            if person is None:
                return [fail(msg, "user_not_found")]
            if person["id"] in self._photos:
                return [ok(msg, {"photo": self._photos[person["id"]]})]
            return [ok(msg, fixture("users_photo_get.json") if person.get("photo_configured") else {"photo": None})]
        if command in PERSON_WRITES and self.directory is not None:
            return self._person_write(command, msg)
        if command == "users/pin_generate":
            # CR-036 S11: a test sets `pin_value` to a SENTINEL (never a real PIN); an unknown person in the directory is WisKey's own code
            if self.directory is not None and msg.get("user_id") and self._person(msg["user_id"]) is None:
                return [fail(msg, "user_not_found")]
            return [ok(msg, {"pin": self.pin_value} if self.pin_value is not None else fixture("users_pin_generate.json"))]
        if command == "events/detail":
            return self._event_detail(msg)
        if command == "sync/status":
            body = self._overview(auth)
            body["users"] = copy.deepcopy(self.directory) if self.directory is not None else [fixture("users_get.json")]
            body["user_count"] = len(body["users"])
            body.update(fixture("sync_arrays.json"))
            return [ok(msg, body)]
        if command in PER_STATION:
            name, missing = PER_STATION[command]
            station = next((s for s in self.overview["stations"] if s["id"] == msg.get("station_id")), None)
            if station is None:
                return [fail(msg, missing)]
            if command == "stations/technical_hold_get" and msg.get("door") not in [lock["physical_index"] for lock in station.get("integrated_locks") or []]:
                return [fail(msg, "operation_unsupported")]
            return [ok(msg, self._drifted(fixture(name)))]
        if command.startswith("whatsapp/"):
            return self._whatsapp(command, msg)
        if command == "tts/start":
            return [ok(msg)]  # the subscription id is the frame id (audio_tts.py); events are pushed by the test if needed
        name = FIXTURE_FOR.get(command)
        if name is not None:
            return [ok(msg, fixture(name))]
        if command in ("users/create", "users/update", "users/archive", "users/unarchive", "users/set_active", "users/temporary_cancel", "cards/add", "cards/remove"):
            person = fixture("users_get.json")
            person["revision"] = int(msg.get("revision") or 0) + 1
            return [ok(msg, person)]  # WisKey answers the person's public record
        return [ok(msg, {})]

    # ------------------------------------------------------------ CR-036 S11: the stateful person writes over the directory
    def _public(self, person: dict[str, Any]) -> dict[str, Any]:
        """`ManagedUser.public()`: never a PIN, never a card number, never the photo itself."""
        out = copy.deepcopy(person)
        for key in ("pin", "photo"):
            out.pop(key, None)
        return out

    def _mask(self, number: str) -> str:
        return "•••• " + number[-4:]

    def _apply(self, person: dict[str, Any], data: dict[str, Any]) -> str | None:
        """A users/create / users/update patch onto a stored person (the subset of build_user the tests need). Returns WisKey's
        refusal code, or None."""
        if person.get("archived_at") and data.get("active") is True:
            return "user_archived"
        for key in ("display_name", "employee_no", "phone", "active", "valid_from", "valid_until", "access_category", "responsible_person", "access_purpose",
                    "access_timing_draft", "access_timing_policy"):
            if key in data:
                person[key] = copy.deepcopy(data[key])
        if "pin" in data:
            person["pin_configured"] = data["pin"] is not None
        if "photo" in data:
            if data["photo"] is None:
                self._photos.pop(person["id"], None)
            else:
                self._photos[person["id"]] = data["photo"]
            person["photo_configured"] = data["photo"] is not None
        if "cards" in data:
            existing = {c["id"]: c for c in person.get("cards", [])}
            cards = []
            for raw in data["cards"]:
                if "id" in raw:
                    card = existing.get(raw["id"])
                    if card is None:
                        return "invalid_cards"
                    cards.append({**card, "label": raw.get("label", card.get("label", "")), "enabled": raw.get("enabled", card.get("enabled", True))})
                else:
                    number = raw["card_no"]
                    if number in self._card_numbers.values():
                        return "card_conflict"
                    self._serial += 1
                    cid = f"card-new-{self._serial}"
                    self._card_numbers[cid] = number
                    cards.append({"id": cid, "masked_number": self._mask(number), "label": raw.get("label", ""), "card_type": raw.get("card_type", "normalCard"),
                                  "enabled": raw.get("enabled", True)})
            person["cards"] = cards
        overrides, doors = data.get("permission_overrides"), data.get("door_permissions")
        if isinstance(overrides, dict) and isinstance(doors, dict):
            assignments = person.setdefault("assignments", {})
            for sid, effect in overrides.items():
                if effect == "deny" and sid in assignments:
                    assignments[sid]["enabled"] = False
            for sid, locks in doors.items():
                previous = assignments.get(sid, {})
                assignments[sid] = {**previous, "config_entry_id": sid, "enabled": True, "allowed_locks": list(locks), "sync_state": "pending",
                                    "last_sync_at": previous.get("last_sync_at"), "last_error": None}
            person["permission_overrides"] = dict(overrides)
        return None

    def _person_write(self, command: str, msg: dict[str, Any]) -> list[Any]:
        assert self.directory is not None
        if command == "users/create":
            data = msg.get("data") or {}
            if any(p.get("employee_no") == data.get("employee_no") for p in self.directory):
                return [fail(msg, "employee_conflict")]
            self._serial += 1
            person = {"id": f"u-new-{self._serial}", "display_name": "", "employee_no": "", "phone": "", "active": True, "user_type": "normal", "valid_from": None,
                      "valid_until": None, "revision": 1, "identity_locked": False, "profile": {}, "group_ids": [], "permission_overrides": {}, "photo_configured": False,
                      "pin_configured": False, "cards": [], "assignments": {}, "access_category": "staff", "responsible_person": "", "access_purpose": "",
                      "access_timing_draft": None, "access_timing_policy": None, "archived_at": None}
            code = self._apply(person, data)
            if code:
                return [fail(msg, code)]
            self.directory.append(person)
            return [ok(msg, self._public(person))]
        person = next((p for p in self.directory if p["id"] == msg.get("user_id")), None)
        if person is None:
            return [fail(msg, "user_not_found")]
        if msg.get("revision") != person.get("revision"):
            return [fail(msg, "revision_conflict")]
        if command == "users/delete":
            self.directory.remove(person)
            return [ok(msg, {"accepted": True})]
        candidate = copy.deepcopy(person)
        if command == "users/update":
            code = self._apply(candidate, msg.get("data") or {})
        elif command in ("users/archive", "users/unarchive"):
            archived = command == "users/archive"
            code = "archive_state_changed" if bool(candidate.get("archived_at")) == archived else None
            candidate["archived_at"] = datetime.now(timezone.utc).isoformat() if archived else None
            candidate["active"] = False  # archived or restored: switched off (restoration stays inactive)
        elif command == "users/set_active":
            code = self._apply(candidate, {"active": msg["active"]})
        elif command == "users/temporary_cancel":
            code = None
            if candidate.get("access_category") not in ("visitor", "contractor"):
                code = "temporary_user_required"
            elif not candidate.get("active"):
                code = "temporary_already_inactive"
            candidate["active"] = False
        elif command == "cards/add":
            card = msg.get("data") or {}
            if set(card) - CARD_FIELDS or "card_no" not in card or "id" in card:
                return [fail(msg, "invalid_fields")]
            code = self._apply(candidate, {"cards": [{"id": c["id"]} for c in candidate.get("cards", [])] + [card]})
        else:  # cards/remove
            if not any(c["id"] == msg.get("card_id") for c in candidate.get("cards", [])):
                return [fail(msg, "card_not_found")]
            candidate["cards"] = [c for c in candidate.get("cards", []) if c["id"] != msg.get("card_id")]
            self._card_numbers.pop(str(msg.get("card_id")), None)
            code = None
        if code:
            return [fail(msg, code)]
        candidate["revision"] = int(person["revision"]) + 1
        self.directory[self.directory.index(person)] = candidate
        return [ok(msg, self._public(candidate))]

    # ------------------------------------------------------------ CR-036 S7: the messaging fake (W11 is not delivered)
    WA_ACCOUNT = {"id": "wa-1", "name": "Office line"}
    WA_TEXT_MAX = 12000  # rc.37 whatsapp_api.py: a longer message is `invalid_fields`

    def _whatsapp(self, command: str, msg: dict[str, Any]) -> list[Any]:
        """`whatsapp/*` as rc.37's whatsapp_api.py shapes them: status {available, history, accounts}; preview {token, recipient,
        message, warnings} (+ the PROPOSED `consent` and `quota`); send {accepted}; templates_get; history. Nothing is sent
        anywhere - the 'send' only counts."""
        if command == "whatsapp/status":
            return [ok(msg, {"available": self.wa_available, "history": self.wa_available, "accounts": [dict(self.WA_ACCOUNT)] if self.wa_available else [],
                             "quota": dict(self.wa_quota) if self.wa_quota else None})]
        if command == "whatsapp/templates_get":
            return [ok(msg, fixture("whatsapp_templates_get.json"))]
        if command == "whatsapp/templates_update":
            return [ok(msg, {**fixture("whatsapp_templates_get.json"), "revision": int(msg.get("revision") or 0) + 1})]
        if not self.wa_available or msg.get("account") != self.WA_ACCOUNT["id"]:
            return [fail(msg, "whatsapp_unavailable")]
        person = self._person(msg.get("user_id"))
        if person is None:
            return [fail(msg, "user_not_found")]
        number = str(person.get("phone") or "").strip()
        if not number:
            return [fail(msg, "whatsapp_invalid_phone")]
        bound = {"user": person["id"], "revision": person.get("revision"), "phone": number, "account": msg["account"]}
        if command == "whatsapp/preview":
            templates = fixture("whatsapp_templates_get.json")
            text = templates["templates"][0]["body"].format(name=person.get("display_name", ""), organization=templates["organization"])
            token = f"wa-token-{len(self._wa_tokens) + 1}"
            self._wa_tokens[token] = bound
            return [ok(msg, {"token": token, "recipient": number, "message": text, "warnings": [], "consent": person.get("whatsapp_consent", "granted"),
                             "quota": dict(self.wa_quota) if self.wa_quota else None})]
        if command == "whatsapp/send":
            text = msg.get("message")
            if msg.get("confirmed") is not True or not isinstance(text, str) or not text.strip() or len(text) > self.WA_TEXT_MAX:
                return [fail(msg, "invalid_fields")]
            if self._wa_tokens.pop(msg.get("token"), None) != bound:  # one use, bound to the person, the revision and the phone
                return [fail(msg, "whatsapp_preview_expired")]
            if self.wa_quota is not None and self.wa_quota["used"] >= self.wa_quota["limit"]:
                return [fail(msg, "rate_limited")]
            if number in self.wa_unregistered:
                return [fail(msg, "whatsapp_invalid_phone")]
            if self.wa_quota is not None:
                self.wa_quota["used"] += 1
            return [ok(msg, {"accepted": True})]
        if command == "whatsapp/history":
            return [ok(msg, {"recipient": number, "messages": []})]
        return [fail(msg, "unknown_command")]

    # ------------------------------------------------------------ CR-036 S4: the directory answers
    def _person(self, user_id: Any) -> dict[str, Any] | None:
        if self.directory is not None:
            found = next((p for p in self.directory if p["id"] == user_id), None)
            return copy.deepcopy(found) if found is not None else None
        person = fixture("users_get.json")
        return person if user_id == person["id"] else None

    def _people_page(self, msg: dict[str, Any]) -> dict[str, Any]:
        """`users/query` over the directory, as WisKey pages it (access/user_directory.py: its `group` / `profile` / `station` /
        `rights` / `state` / `credential` filters, name or employee sort, offset clamped to the last page, a snapshot of the ids
        and revisions). The text is always empty from Arx. `self.now` pins the clock the `expired` / `upcoming` states use."""
        filters = msg.get("filters") or {}
        state = filters.get("state") or ""
        instant = self.now or datetime.now(timezone.utc)
        everyone = len(self.directory or [])  # WisKey: total_all is the whole directory it was given
        wanted_profile = {k: v for k, v in (filters.get("profile") or {}).items() if v}

        def when(value: Any) -> datetime | None:
            try:
                parsed = datetime.fromisoformat(value) if value else None
            except ValueError:
                return None
            return parsed.astimezone(timezone.utc) if parsed is not None and parsed.tzinfo else None

        def matches(p: dict[str, Any]) -> bool:
            if bool(p.get("archived_at")) != (state == "archived"):
                return False
            if filters.get("group") and filters["group"] not in p.get("group_ids", []):
                return False
            if any(p.get("profile", {}).get(k) != v for k, v in wanted_profile.items()):
                return False
            assignments = p.get("assignments", {})
            station = filters.get("station") or ""
            selected = [assignments[station]] if station and station in assignments else [] if station else list(assignments.values())
            rights = filters.get("rights") or ""
            if station and not rights and not selected:
                return False
            if rights == "assigned" and not any(a.get("enabled") for a in selected):
                return False
            if rights == "unassigned" and selected:
                return False
            if rights == "disabled" and not any(not a.get("enabled") for a in selected):
                return False
            if state == "active" and not p.get("active"):
                return False
            if state == "inactive" and p.get("active"):
                return False
            if state == "expired" and ((ends := when(p.get("valid_until"))) is None or ends > instant):
                return False
            if state == "upcoming" and ((starts := when(p.get("valid_from"))) is None or starts <= instant):
                return False
            has_card = any(c.get("enabled") for c in p.get("cards", []))
            credential = filters.get("credential") or ""
            if (credential == "pin" and not p.get("pin_configured")) or (credential == "no_pin" and p.get("pin_configured"))                     or (credential == "card" and not has_card) or (credential == "no_card" and has_card):
                return False
            return True

        people = [p for p in copy.deepcopy(self.directory or []) if matches(p)]
        sort = filters.get("sort") or "employee"
        people.sort(key=(lambda p: p["employee_no"]) if sort == "employee" else (lambda p: p["display_name"].casefold()), reverse=sort == "name_desc")
        offset, limit = int(msg.get("offset") or 0), int(msg.get("limit") or 50)
        total = len(people)
        if offset >= total:
            offset = ((total - 1) // limit) * limit if total else 0
        end = offset + limit
        snapshot = "snap-" + "-".join(f"{p['id']}.{p['revision']}" for p in sorted(people, key=lambda p: p["id"]))[:58]
        return {"records": people[offset:end], "total": total, "total_all": everyone, "profile_facets": {"department": ["Engineering"]},
                "offset": offset, "limit": limit, "next_offset": end if end < total else None, "previous_offset": max(0, offset - limit) if offset else None,
                "snapshot": snapshot, "stale": bool(self.stale_revision or (msg.get("snapshot") and msg["snapshot"] != snapshot))}

    def _events_page(self, msg: dict[str, Any]) -> list[Any]:
        """`events/list` over the directory events, newest first: the `station_id`, `result` and `person` filters (a name or
        an employee number - W?: WisKey's exact match rule is not verified, a substring here), `limit`, and `before` (the id
        to continue after; an unknown one is refused, as a pruned cursor)."""
        filters = msg.get("filters") or {}
        rows = copy.deepcopy(self.event_rows or [])
        if filters.get("before") is not None:
            ids = [r["id"] for r in rows]
            if filters["before"] not in ids:
                return [fail(msg, "invalid_fields")]
            rows = rows[ids.index(filters["before"]) + 1:]
        if filters.get("station_id"):
            rows = [r for r in rows if r["station_id"] == filters["station_id"]]
        if filters.get("result"):
            rows = [r for r in rows if r["result"] == filters["result"]]
        if filters.get("person"):
            needle = str(filters["person"]).casefold()
            rows = [r for r in rows if needle in (r.get("person_name") or "").casefold() or needle in (r.get("employee_no") or "").casefold()]
        if filters.get("start"):
            rows = [r for r in rows if r["timestamp"] >= filters["start"]]
        if filters.get("end"):
            rows = [r for r in rows if r["timestamp"] < filters["end"]]
        limit = int(filters.get("limit") or 100)
        page = rows[:limit]
        stations = {sid: {"stream": "connected", "history": "recovered", "reconnects": 0, "telemetry": {"seen": 1}} for sid in {r["station_id"] for r in self.event_rows or []}}
        body = {"records": page, "next": page[-1]["id"] if len(rows) > limit else None, "retention_days": 30, "capacity": 5000,
                "membership_basis": None, "storage_failed": False, "stations": stations}
        return [ok(msg, self._drifted(body, rows="records"))]

    def _event_detail(self, msg: dict[str, Any]) -> list[Any]:
        detail = fixture("events_detail.json")
        rows = self.event_rows if self.event_rows is not None else [detail["record"]]
        row = next((r for r in rows if r["id"] == msg.get("event_id")), None)
        if row is None:
            return [fail(msg, "event_not_found")]
        detail["record"] = {k: v for k, v in copy.deepcopy(row).items() if k not in ("evidence", "portrait", "person_link")}
        return [ok(msg, detail)]

    def _listed(self, auth: dict[str, Any], fixture_list: list[str]) -> list[str]:
        base = set(self.commands) if auth.get("is_admin") is True else set(fixture_list)
        return sorted(base - self.unlisted)

    def _overview(self, auth: dict[str, Any]) -> dict[str, Any]:
        raw = copy.deepcopy(self.overview)
        api = raw.get("api") if isinstance(raw.get("api"), dict) else None
        if api is not None:
            api["commands"] = self._listed(auth, api.get("commands") or [])
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
            "revision_conflict", "user_not_found", "event_not_found", "station_unloaded", "operation_unsupported", "invalid_fields",
            "whatsapp_unavailable", "whatsapp_invalid_phone", "whatsapp_preview_expired", "rate_limited",
            # CR-036 S11: the stateful person writes
            "employee_conflict", "card_conflict", "invalid_cards", "user_archived", "archive_state_changed", "temporary_user_required",
            "temporary_already_inactive", "card_not_found"} | set(fake.errors_once.values())


Responder = Callable[[dict[str, Any]], list[Any]]


# ---------------------------------------------------------------- LEASE-BUILD: the capture-lease host (stage 8 of wiskey-capture-lease-v1)

class FakeLeaseHost:
    """WisKey's side of the capture lease as CR-WISKEY-LEASE-REVOCATION-EVENT and docs/contracts/wiskey-capture-lease/SCHEMA.md
    describe it (W? - WisKey's real consumer is not built yet). A MODEL: no reader, no station, no card. Receives the immutable
    DTO from `FakeLeaseBridge` after stages 1-7.

    State: the current stream (`stream_id`, `last_sequence`, `last_params_sha`), the live leases (`leases`: ref -> session),
    `last_heard` (epoch of the last revoke / heartbeat / reset, for the 15 s silence rule). Switches: `start_outcome`
    (`ok` | `refused` | `timeout` | `no_session`), `confirm_outcome` (`ok` | `sent_unknown` | `timeout` | `busy`), `present_card()`."""

    SILENCE_S = 15

    def __init__(self, clock: Any) -> None:
        self.clock = clock  # .now() -> epoch seconds (FakeClock)
        self.stream_id: str | None = None
        self.last_sequence = 0
        self.last_params_sha: str | None = None
        self.leases: dict[str, dict[str, Any]] = {}
        self.destroyed: list[tuple[str, str]] = []  # (lease_ref, why)
        self.last_heard: int | None = None
        self.start_outcome = "ok"
        self.confirm_outcome = "ok"
        self.events: list[dict[str, Any]] = []  # every DTO applied (action, params)
        self.requests: list[dict[str, Any]] = []
        self._sid = 0

    @staticmethod
    def _sha(params: dict[str, Any]) -> str:
        import hashlib as _h

        return _h.sha256(json.dumps(params, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()

    def _destroy_all(self, why: str) -> int:
        n = len(self.leases)
        for ref in list(self.leases):
            self.destroyed.append((ref, why))
        self.leases.clear()
        return n

    def check_silence(self) -> int:
        """The host's own rule: no revoke / heartbeat for SILENCE_S -> every live lease destroyed."""
        if self.leases and self.last_heard is not None and self.clock.now() - self.last_heard > self.SILENCE_S:
            return self._destroy_all("silence")
        return 0

    def live(self) -> list[str]:
        self.check_silence()
        now = self.clock.now()
        for ref, s in list(self.leases.items()):
            if s["expires"] <= now:
                self.destroyed.append((ref, "expired"))
                del self.leases[ref]
        return sorted(self.leases)

    # -- lease_event
    def handle_event(self, dto: Any) -> dict[str, Any]:
        self.check_silence()
        p, rid = dto.params, dto.request_id
        self.events.append({"action": dto.action, "params": dict(p)})
        if dto.action == "lease_stream_reset":
            n = self._destroy_all("stream_reset")
            self.stream_id, self.last_sequence, self.last_params_sha = p["stream_id"], 1, self._sha(p)
            self.last_heard = self.clock.now()
            return {"result": "acknowledged", "request_id": rid, "sequence": 1, "destroyed": n}
        if p["stream_id"] != self.stream_id:
            return {"result": "unknown_stream", "request_id": rid}
        self.last_heard = self.clock.now()
        seq = p["sequence"]
        if dto.action == "lease_heartbeat":
            return {"result": "acknowledged", "request_id": rid, "sequence": seq, "destroyed": 0, "live_leases": self.live()}
        sha = self._sha({"actor": dto.actor_id, "station": dto.station, "params": p})  # the message's meaning, not its envelope
        if seq == self.last_sequence:
            if sha == self.last_params_sha:
                return {"result": "duplicate", "request_id": rid, "sequence": seq}
            return {"result": "conflict", "request_id": rid, "sequence": seq, "destroyed": self._destroy_all("conflict")}
        if seq < self.last_sequence:
            if p["scope"] == "lease" and p["lease_ref"] in self.leases:
                self.leases.pop(p["lease_ref"])
                self.destroyed.append((p["lease_ref"], "stale_revoke"))
            return {"result": "stale", "request_id": rid, "sequence": seq, "last_sequence": self.last_sequence}
        if seq > self.last_sequence + 1:
            last = self.last_sequence
            self.last_sequence, self.last_params_sha = seq, sha
            return {"result": "gap", "request_id": rid, "sequence": seq, "last_sequence": last, "destroyed": self._destroy_all("gap")}
        self.last_sequence, self.last_params_sha = seq, sha
        victims = [ref for ref, s in self.leases.items() if p["scope"] == "all" or (p["scope"] == "lease" and ref == p["lease_ref"])
                   or (p["scope"] == "actor" and s["actor"] == dto.actor_id) or (p["scope"] == "station" and s["station"] == dto.station)]
        for ref in victims:
            self.leases.pop(ref)
            self.destroyed.append((ref, "revoke:" + p["reason"]))
        return {"result": "acknowledged", "request_id": rid, "sequence": seq, "destroyed": len(victims)}

    # -- lease_request
    def present_card(self, lease_ref: str, masked: str = "•••• 4321") -> None:
        s = self.leases[lease_ref]
        s["state"] = "captured"
        s["card"] = {"masked_number": masked, "technology": "TypeA_M1", "reader_id": 1}

    def handle_request(self, dto: Any) -> dict[str, Any] | None:
        """None = the host never answers (a timeout after a possible delivery)."""
        import calendar as _cal
        import time as _time

        self.check_silence()
        p, rid = dto.params, dto.request_id
        self.requests.append({"action": dto.action, "params": dict(p)})
        now = self.clock.now()
        if dto.action == "capture_start":
            lease = p["lease"]
            if self.start_outcome == "refused":
                return {"result": "refused", "request_id": rid, "code": "capture_station_busy"}
            if lease["stream_id"] != self.stream_id:
                return {"result": "refused", "request_id": rid, "code": "lease_gone"}
            self._sid += 1
            sid = f"{self._sid:016x}"
            expires = _cal.timegm(_time.strptime(lease["lease_expires_at"], "%Y-%m-%dT%H:%M:%SZ"))
            self.leases[lease["lease_ref"]] = {"session_id": sid, "actor": dto.actor_id, "station": dto.station, "state": "preparing", "card": None, "expires": expires}
            if self.start_outcome == "timeout":
                return None
            if self.start_outcome == "no_session":
                return {"result": "acknowledged", "request_id": rid, "session": {"state": "preparing"}}
            return {"result": "acknowledged", "request_id": rid, "session": {"session_id": sid, "state": "preparing"}}
        ref = p["lease_ref"]
        s = self.leases.get(ref)
        if s is None or s["expires"] <= now:
            if dto.action == "capture_cancel" and s is None:  # no session held for this lease_ref: closed answer capture_not_found
                return {"result": "refused", "request_id": rid, "code": "capture_not_found"}
            if dto.action == "capture_cancel":
                return {"result": "acknowledged", "request_id": rid, "cancelled": True}
            return {"result": "refused", "request_id": rid, "code": "lease_gone"}
        if dto.action == "capture_status":
            out = {"state": s["state"], "error": None, "card": s["card"] if s["state"] == "captured" else None}
            if s["state"] == "preparing":
                s["state"] = "waiting"
            return {"result": "acknowledged", "request_id": rid, "capture": out}
        if dto.action == "capture_cancel":
            self.leases.pop(ref)
            self.destroyed.append((ref, "cancelled"))
            return {"result": "acknowledged", "request_id": rid, "cancelled": True}
        if dto.action == "capture_confirm":
            if self.confirm_outcome == "busy":  # the session stays untouched (closed code table: capture_operation_busy)
                return {"result": "refused", "request_id": rid, "code": "capture_operation_busy"}
            if s["state"] != "captured":
                return {"result": "refused", "request_id": rid, "code": "capture_not_ready"}
            self.leases.pop(ref)
            self.destroyed.append((ref, "confirmed"))
            if self.confirm_outcome == "sent_unknown":
                return {"result": "sent_unknown", "request_id": rid}
            if self.confirm_outcome == "timeout":
                return None
            return {"result": "acknowledged", "request_id": rid, "person": copy.deepcopy(LEASE_PERSON)}
        return {"result": "refused", "request_id": rid, "code": "unknown_action"}


LEASE_PERSON = {"id": "u1", "display_name": "LEASE-PERSON-SENTINEL", "revision": 5, "active": True, "archived": False, "valid_from": None, "valid_until": None,
                "assignments": {"entry-a": {"config_entry_id": "entry-a", "enabled": True, "allowed_locks": [1], "sync_state": "synced", "last_sync_at": None}},
                "cards": [{"id": "c1", "masked_number": "•••• 4321", "label": "tag", "card_type": "normalCard", "enabled": True}]}


# ---------------------------------------------------------------- CR-ARX-WISKEY-SHARED-IDENTITY: the access-engine fake

class FakeAccessEngine:
    """The WisKey person store as the external-grant service sees it (services/access_grant_engine.Engine): people with a revision
    compare-and-set, a PIN generator that answers SENTINEL values (never a real PIN) with injectable conflicts, validity, door maps,
    a WisKey-side edit (drift), a person deleted elsewhere, an unreachable engine and unknown outcomes. Nothing here contacts anything.

    Switches: `offline` (every call -> not_sent), `pin_conflicts` (the next N PIN writes -> pin_conflict), `fail` ({method: kind},
    one-shot), `unknown_after_apply` (the next apply LANDS and then answers unknown), `unknown_before_apply` (the next apply does
    NOT land and answers unknown). `calls` records method names only (never a PIN).

    WisKey-stated semantics (reply 2, 2026-10-18; source-derived, NOT_RUN on hardware) that the fake models: the person view is built from a
    `ManagedUser.public`-shaped dict by the REAL `person_from_raw` (no `door_permissions`; the door map is the enabled `assignments`);
    `door_permissions` replaces the lock list of each supplied station only and a key outside the resolved stations is refused; a station is
    dropped only through the COMPLETE `permission_overrides` replacement ("deny"); revoke-all = group_ids [] + overrides {} + inactive + PIN
    cleared; employee_no is server-generated (nine digits) when omitted. More switches: `hide_doors` (access fields redacted ->
    assignments {} + redacted_fields), `restricted_projection` (access AND credential fields redacted: pin_configured False proves nothing),
    `sync_lag` (a strip leaves a pending revocation until `settle_revocations()`), `status_unknown` (revocation_pending -> None).
    STATIONSYNC-295 (R11-I1-03): `revocation_pending(person_id, revision)` runs the REAL `revocation_pending_from` over
    `access_state_reader` (default: `access_state`, a fake of WisKey's PROPOSED ACR5-01 answer, revision-bound: another revision
    raises revision_conflict); `unverified[person_id]` holds settled-but-unverified stations. Assignment rows carry a `last_sync_at`.
    `updates` records the (method, overrides, door keys) of every write, never a PIN."""

    SYNCED_AT = "2026-10-20T06:00:00+00:00"
    PIN_SENTINELS = ("913377", "913378", "913379", "913380", "913381", "913382", "913383", "913384")

    def __init__(self) -> None:
        from smplwise.services.access_grant_engine import EnginePerson  # noqa: F401 - shape reference

        self.people: dict[str, dict[str, Any]] = {}
        self.offline = False
        self.pin_conflicts = 0
        self.fail: dict[str, str] = {}
        self.unknown_after_apply = False
        self.unknown_before_apply = False
        self.hide_doors = False  # access fields redacted: every view reports doors_known=False (assignments {} + redacted_fields)
        self.restricted_projection = False  # access AND credential fields redacted (pin_configured False is not proof)
        self.sync_lag = False  # a strip leaves a pending revocation until settle_revocations()
        self.status_unknown = False  # revocation_pending answers None
        self.pending_revocations: set[str] = set()
        self.unverified: dict[str, set[str]] = {}
        self._stripped_from: dict[str, set[str]] = {}  # settled-only station work per person (never cleanup)
        self.access_state_reader = self.access_state
        self.last_known_stations = None  # WKV2-295: optional (person_id) -> frozenset | None for the v2 F-02 cross-check
        self.updates: list[dict[str, Any]] = []
        self.calls: list[str] = []
        self.deleted: list[str] = []
        self._pins = list(self.PIN_SENTINELS)
        self._seq = 0

    # -- helpers
    def _err(self, kind: str):
        from smplwise.services.access_grant_engine import EngineError

        return EngineError(kind, f"fake_{kind}")

    def _gate(self, method: str) -> None:
        self.calls.append(method)
        if self.offline:
            raise self._err("not_sent")
        if method in self.fail:
            raise self._err(self.fail.pop(method))

    def _raw(self, p: dict[str, Any]) -> dict[str, Any]:
        """The ManagedUser.public shape (no door_permissions) the real parser reads."""
        rows: dict[str, Any] = {}
        for sid, locks in p["doors"].items():
            rows[sid] = {"config_entry_id": sid, "enabled": True, "allowed_locks": list(locks), "desired_revision": p["revision"],
                         "applied_revision": p["revision"], "sync_state": "synced", "last_sync_at": self.SYNCED_AT, "last_error": None}
        for sid in sorted(set(p["overrides"]) - set(p["doors"])) + [x for x in p.get("other_stations", ()) if x not in p["doors"]]:
            rows.setdefault(sid, {"config_entry_id": sid, "enabled": False, "allowed_locks": [1], "desired_revision": p["revision"],
                                  "applied_revision": p["revision"], "sync_state": "synced", "last_error": None})
        raw: dict[str, Any] = {"id": p["id"], "revision": p["revision"], "display_name": p["display_name"], "employee_no": p["employee_no"],
                               "active": p["active"], "valid_from": p["valid_from"], "valid_until": p["valid_until"], "assignments": rows,
                               "group_ids": list(p["group_ids"]), "permission_overrides": dict(p["overrides"]), "pin_configured": p["pin"] is not None,
                               # GRANTS3-295: WisKey's public record carries the cards MASKED (`•••• 1234`), never the number
                               "cards": [{"id": c["id"], "masked_number": "•••• " + c["no"][-4:], "label": c["label"], "card_type": "normalCard",
                                          "enabled": True} for c in p.setdefault("cards", [])],
                               "access_category": p["category"],
                               "access_timing_policy": {"mode": "ha", "schedule": copy.deepcopy(p["timing"]), "bindings": {}} if p["timing"] else None}
        if "policy" in p:  # STATIONPERM-295: a person whose whole timing policy was seeded (native mode with bindings, malformed ...)
            raw["access_timing_policy"] = copy.deepcopy(p["policy"])
        redacted: list[str] = []
        if self.hide_doors or self.restricted_projection:
            raw.update({"assignments": {}, "group_ids": [], "permission_overrides": {}})
            redacted += ["assignments", "group_ids", "permission_overrides"]
        if self.restricted_projection:
            raw["pin_configured"] = False
            raw["cards"] = []
            redacted += ["pin_configured", "cards"]
        if redacted:
            raw["redacted_fields"] = redacted
        return raw

    def _view(self, p: dict[str, Any]):
        from smplwise.services.access_grant_engine import person_from_raw

        return person_from_raw(self._raw(p))

    def _get(self, person_id: str) -> dict[str, Any]:
        p = self.people.get(person_id)
        if p is None:
            raise self._err("not_found")
        return p

    # -- test seams
    def add_person(self, person_id: str, *, stations: Iterable[str] = (), doors: dict[str, list[int]] | None = None, category: str = "contractor",
                   group_doors: dict[str, list[int]] | None = None, overrides: dict[str, str] | None = None, policy: Any = None) -> None:
        """`group_doors` (STATIONPERM-295): the stations the person's groups give (shown enabled with no personal entry); `overrides` the
        personal entries; `policy` a whole seeded `access_timing_policy` (omitted = derived from the timing as before)."""
        merged = {k: list(v) for k, v in (group_doors or {}).items()}
        merged.update({k: list(v) for k, v in (doors or {}).items()})
        for sid, mode in (overrides or {}).items():
            if mode == "deny":
                merged.pop(sid, None)
        self.people[person_id] = {"id": person_id, "revision": 1, "display_name": person_id, "employee_no": "e-" + person_id, "active": True,
                                  "valid_from": None, "valid_until": None, "doors": merged, "other_stations": tuple(stations), "pin": None,
                                  "timing": None, "category": category, "overrides": dict(overrides or {}), "group_ids": ["g-1"] if group_doors else [],
                                  "group_doors": {k: list(v) for k, v in (group_doors or {}).items()}}
        if policy is not None:
            self.people[person_id]["policy"] = copy.deepcopy(policy)

    def edit_elsewhere(self, person_id: str) -> None:
        """Someone edited the person in WisKey's own panel: the revision moves (T12)."""
        self._get(person_id)["revision"] += 1

    def pin_of(self, person_id: str) -> str | None:
        """Only for assertions inside a test (the sentinel the fake holds)."""
        return self._get(person_id)["pin"]

    # -- the port
    def create_person(self, *, display_name: str, category: str, responsible_person: str, access_purpose: str, employee_no: str | None = None):
        self._gate("create_person")
        self._seq += 1
        pid = f"wk-{self._seq:04d}"
        if employee_no is None:
            employee_no = str(100000000 + self._seq * 7919)  # WisKey generates nine digits when it is omitted
        self.people[pid] = {"id": pid, "revision": 1, "display_name": display_name[:32], "employee_no": employee_no, "active": False, "valid_from": None,
                            "valid_until": None, "doors": {}, "other_stations": (), "pin": None, "timing": None, "category": category,
                            "overrides": {}, "group_ids": [], "responsible_person": responsible_person, "access_purpose": access_purpose}
        return self._view(self.people[pid])

    def get_person(self, person_id: str):
        self._gate("get_person")
        return self._view(self._get(person_id))

    def apply(self, person_id: str, revision: int, *, doors, valid_from, valid_until, timing, active, pin=None, overrides=None):
        from smplwise.services.access_grant_engine import KEEP

        self._gate("apply")
        p = self._get(person_id)
        if self.unknown_before_apply:
            self.unknown_before_apply = False
            raise self._err("unknown")
        if p["revision"] != revision:
            raise self._err("revision_conflict")
        if pin is not KEEP and pin is not None and self.pin_conflicts > 0:
            self.pin_conflicts -= 1
            raise self._err("pin_conflict")
        # validate first (a rejected update changes nothing): the complete overrides replacement, then door_permissions per supplied station
        new_doors = {k: list(v) for k, v in p["doors"].items()}
        new_overrides = dict(p["overrides"])
        if overrides is not None:
            new_overrides = dict(overrides)
            for sid, mode in new_overrides.items():
                if mode == "deny":
                    new_doors.pop(sid, None)
                elif sid not in new_doors:
                    new_doors[sid] = [1]
        for sid, locks in doors.items():
            if sid not in new_doors:
                raise self._err("refused")  # invalid_assignments: a door_permissions key outside the resolved stations
            if not locks:
                raise self._err("refused")  # unmanaged_lock: an empty lock list is rejected
            new_doors[sid] = list(locks)  # REPLACES this station's list; stations not supplied are untouched (dropping one does not revoke it)
        self.updates.append({"method": "apply", "overrides": copy.deepcopy(overrides), "doors": sorted(doors)})
        p.update({"doors": new_doors, "overrides": new_overrides, "valid_from": valid_from, "valid_until": valid_until, "timing": copy.deepcopy(timing),
                  "active": bool(active)})
        if pin is not KEEP:
            p["pin"] = pin
        p["revision"] += 1
        if self.unknown_after_apply:
            self.unknown_after_apply = False
            raise self._err("unknown")
        return self._view(p)

    def strip(self, person_id: str, revision: int):
        """Revoke-all: group_ids [] + permission_overrides {} + active false + pin null (door_permissions {} would do nothing)."""
        self._gate("strip")
        p = self._get(person_id)
        if p["revision"] != revision:
            raise self._err("revision_conflict")
        self.updates.append({"method": "strip", "overrides": {}, "doors": []})
        self._stripped_from[person_id] = set(p["doors"]) | set(p["overrides"])
        p.update({"doors": {}, "overrides": {}, "group_ids": [], "active": False, "pin": None, "timing": None})
        p["revision"] += 1
        if self.sync_lag:
            self.pending_revocations.add(person_id)
        return self._view(p)

    def set_station_access(self, person_id: str, revision: int, *, overrides: dict[str, str], doors: dict[str, list[int]]):
        """STATIONPERM-295: the complete overrides replacement + the allowed station's relays. A station with no personal entry falls back
        to the groups (`group_doors`); a deny beats a group; an allow with no relays named keeps the station's relays (else [1])."""
        from smplwise.services.access_grant_engine import station_access_payload

        self._gate("set_station_access")
        p = self._get(person_id)
        if self.unknown_before_apply:
            self.unknown_before_apply = False
            raise self._err("unknown")
        if p["revision"] != revision:
            raise self._err("revision_conflict")
        try:
            data = station_access_payload(overrides=overrides, doors=doors)
        except ValueError:
            raise self._err("refused") from None
        groups = p.get("group_doors", {})
        new_doors = {k: list(v) for k, v in p["doors"].items()}
        for sid in set(p["overrides"]) | set(data["permission_overrides"]) | set(groups):
            mode = data["permission_overrides"].get(sid)
            if mode == "deny":
                new_doors.pop(sid, None)
            elif mode == "allow":
                new_doors[sid] = list(data["door_permissions"].get(sid) or new_doors.get(sid) or groups.get(sid) or [1])
            elif sid in groups:
                new_doors[sid] = list(groups[sid])
            else:
                new_doors.pop(sid, None)
        self.updates.append({"method": "set_station_access", "overrides": copy.deepcopy(data["permission_overrides"]), "doors": sorted(data["door_permissions"])})
        p.update({"doors": new_doors, "overrides": dict(data["permission_overrides"])})
        p["revision"] += 1
        if self.sync_lag and any(m == "deny" for m in data["permission_overrides"].values()):
            self.pending_revocations.add(person_id)
        if self.unknown_after_apply:
            self.unknown_after_apply = False
            raise self._err("unknown")
        return self._view(p)

    def access_state(self, user_id: str, revision: int) -> dict[str, Any]:
        """A fake of WisKey's PROPOSED ACR5-01 users/access_state answer (schema 1). A present person at another revision raises
        revision_conflict; a deleted person is `absent` (no revision, no history disclosed); a strip under `sync_lag` leaves its
        stations in `operations` until `settle_revocations()`."""
        p = self.people.get(user_id)
        if p is not None and p["revision"] != revision:
            raise self._err("revision_conflict")
        pending = {k: [] for k in ("bindings", "tombstones", "cards", "pins", "operations", "unverified")}
        if user_id in self.pending_revocations:
            pending["operations"] = sorted(self._stripped_from.get(user_id) or {"st-unknown"})
        pending["unverified"] = sorted(self.unverified.get(user_id, ()))
        owed = any(v for k, v in pending.items() if k != "unverified")
        flag = True if owed else (False if p is not None and not pending["unverified"] else None)
        return {"schema_version": 1, "observation": "durable_repository_snapshot", "scope": "all_managed_stations", "user_id": user_id,
                "person_revision": p["revision"] if p is not None else None, "presence": "present" if p is not None else "absent",
                "revocation_pending": flag, "stations_synced": None, "assignments": [], "timing_policy": None, "pending": pending}

    def revocation_pending(self, person_id: str, revision: int):
        from smplwise.services.access_grant_engine import revocation_pending_from

        self._gate("revocation_pending")
        if self.status_unknown:
            return None
        known = self.last_known_stations(person_id) if self.last_known_stations is not None else None
        return revocation_pending_from(self.access_state_reader, person_id, revision, last_known_stations=known)

    def settle_revocations(self) -> None:
        """The stations took the removals: the central sync status shows no pending revocation any more."""
        self.pending_revocations.clear()

    def pin_generate(self, person_id: str) -> str:
        self._gate("pin_generate")
        self._get(person_id)
        return self._pins.pop(0) if self._pins else "913399"

    def rename(self, person_id: str, revision: int, display_name: str):
        self._gate("rename")
        p = self._get(person_id)
        if p["revision"] != revision:
            raise self._err("revision_conflict")
        p["display_name"] = display_name[:32]
        p["revision"] += 1
        return self._view(p)

    def delete(self, person_id: str, revision: int) -> None:
        self._gate("delete")
        p = self._get(person_id)
        if p["revision"] != revision:
            raise self._err("revision_conflict")
        del self.people[person_id]
        self.deleted.append(person_id)

    # -- GRANTS3-295 (X5): cards. WisKey's revoke-all (strip) keeps them - Arx removes each one by its id. `unknown_after_card`: the next
    # card_add LANDS and then answers unknown. `calls` records the method name only (never a card number).
    unknown_after_card = False

    def card_add(self, person_id: str, revision: int, *, card_no: str, label: str = ""):
        self._gate("card_add")
        p = self._get(person_id)
        if p["revision"] != revision:
            raise self._err("revision_conflict")
        for other in self.people.values():
            if any(c["no"] == card_no for c in other.setdefault("cards", [])):
                from smplwise.services.access_grant_engine import EngineError

                raise EngineError("refused", "card_conflict")
        self._seq += 1
        p.setdefault("cards", []).append({"id": f"card-{self._seq:04d}", "no": card_no, "label": label})
        p["revision"] += 1
        self.updates.append({"method": "card_add", "overrides": None, "doors": []})
        if self.unknown_after_card:
            self.unknown_after_card = False
            raise self._err("unknown")
        return self._view(p)

    def card_remove(self, person_id: str, revision: int, card_id: str):
        self._gate("card_remove")
        p = self._get(person_id)
        if p["revision"] != revision:
            raise self._err("revision_conflict")
        before = len(p.setdefault("cards", []))
        p["cards"] = [c for c in p["cards"] if c["id"] != card_id]
        if len(p["cards"]) == before:
            raise self._err("refused")  # card_not_found
        p["revision"] += 1
        self.updates.append({"method": "card_remove", "overrides": None, "doors": []})
        return self._view(p)


class FakeCodeTransport:
    """A fake WhatsApp transport for the access-code message: records what WOULD have left (number + text, for assertions inside
    the test only) and answers `outcome` (sent | not_sent | unknown)."""

    def __init__(self, outcome: str = "sent") -> None:
        self.outcome = outcome
        self.sent: list[tuple[str, str]] = []

    def __call__(self, msg: Any) -> str:
        self.sent.append((msg.digits, msg.text))
        return self.outcome
