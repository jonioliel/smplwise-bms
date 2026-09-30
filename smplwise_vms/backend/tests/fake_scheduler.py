"""A FAKE scheduler component for CR-014 (docs/architecture/SCHEDULER_API.md §9), built from the shapes of a real
installation's WebSocket answers (items with `HH:MM:SS` / `sunset+HH:MM:SS` times, a null `stop`, actions with a null
entity, the same conditions in every slot, `timestamps` / `next_entries`, a switch per schedule with its attributes).
The shapes are read-only observations; every name, entity id and value below is GENERIC and anonymised - nothing here
comes from a real system.

Pure Python: no Home Assistant, no network, no real clock. Deterministic (ids from a seeded generator) and driven by an
injectable clock. It stands in for two things at once:

- the COMPONENT: `ws(msg)` answers `scheduler`, `scheduler/item`, `scheduler/tags`, `scheduler_updated`, `manifest/get`
  and `get_services`; `call_service(...)` implements `scheduler.add|edit|remove|copy|run_action|enable_all|disable_all`
  and `switch.turn_on|turn_off` on a schedule switch; `tick(seconds)` fires slots that start (WITH condition
  evaluation, `track_conditions` re-checks inside the window).
- the BRIDGE 0.3.0: `bridge_schedule(signed_payload, secret)` verifies the HMAC exactly as `ha_bridge.sign` makes it,
  re-validates the payload against the ADD-ON's own allow-list (`services/schedule_policy`) and calls the component;
  `fail_next` / `timeout_next` inject answers and `httpx.ReadTimeout`.

`FakeTransport` is the seam (`services/schedules.set_transport`): `ws(msg_type, **kw)` / `bridge(payload)` over a fake,
with `up = False` to simulate an unreachable Home Assistant. `seed_live_like()` builds the twelve schedule patterns of §9.4
and `seed_mirror(db, fake)` puts the matching entities, registry rows and switch states in the add-on's mirror."""
from __future__ import annotations

import copy
import datetime as dt
import random
import re
from typing import Any, Callable
from zoneinfo import ZoneInfo

import httpx

from smplwise.errors import ApiError
from smplwise.services import ha_bridge, schedule_policy as policy

TZ = ZoneInfo("Asia/Jerusalem")
UTC = dt.timezone.utc
DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]  # datetime.weekday(): Monday = 0
SHABBAT = "binary_sensor.shabbat_mode"
SENSITIVE_DEVICE_CLASSES = ("door", "garage", "gate")

TOP_KEYS = {"weekdays", "start_date", "end_date", "timeslots", "repeat_type", "name", "tags"}
SLOT_KEYS = {"start", "stop", "conditions", "condition_type", "track_conditions", "actions"}
ACTION_KEYS = {"service", "entity_id", "service_data"}
COND_KEYS = {"entity_id", "attribute", "value", "match_type"}
BRIDGE_OPS = {"add", "edit", "remove", "copy", "run", "enable", "disable"}


class FakeInvalid(Exception):
    """The component rejected the call (unknown key, missing field, ...)."""


class FakeCrash(Exception):
    """A TypeError inside the component (`unknown_error`), e.g. a null `stop`."""


class FakeNotFound(Exception):
    """The schedule / entity does not exist."""


class ServiceNotFound(Exception):
    """The service is not registered (`reload_storage`)."""


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (name or "").lower()).strip("_")


class FakeScheduler:
    """The component + the bridge in one deterministic object."""

    def __init__(self, installed: bool = True, accept_tags: bool = True, strict_keys: bool = True, event_mode: str = "subscription", trigger_hold_s: int = 60,
                 rename_changes_entity_id: bool = False, now: Callable[[], dt.datetime] | None = None, seed: int = 14) -> None:
        self.installed, self.accept_tags, self.strict_keys = installed, accept_tags, strict_keys
        self.event_mode, self.trigger_hold_s, self.rename_changes_entity_id = event_mode, trigger_hold_s, rename_changes_entity_id
        self._t = dt.datetime(2026, 9, 30, 10, 0, 0, tzinfo=UTC)  # a Wednesday, 13:00 in Israel
        self._clock = now
        self._last_tick = self.now()
        self._rng = random.Random(seed)
        self.items: dict[str, dict[str, Any]] = {}
        self.states: dict[str, dict[str, Any]] = {}  # the schedule switches
        self.registry: list[dict[str, Any]] = []  # platform `scheduler` rows: unique_id = schedule id
        self.world: dict[str, dict[str, Any]] = {}  # the other entities' states (conditions read them; actions check them)
        self.events: list[tuple[str, str | None]] = []
        self.calls: list[dict[str, Any]] = []
        self.bridge_calls: list[dict[str, Any]] = []
        self.actions_fired: list[dict[str, Any]] = []
        self.on_action: Callable[[str, str, dict[str, Any]], None] | None = None
        self.fail_next: dict[str, str] = {}
        self.timeout_next: set[str] = set()
        self.denied_entities: set[str] = set()  # entities the calling (non-admin) user may not control -> `unauthorized`
        self.hide_new_id: bool = False  # the next add / copy answers `id_unknown`
        self.bridge_version = "0.3.0"
        self.sun = {"sunrise": 6 * 3600 + 30 * 60, "sunset": 18 * 3600 + 15 * 60}  # local seconds since midnight
        self.subscription_id: int | None = None
        self._started: set[tuple[str, int, str]] = set()  # (schedule, slot, local date) whose slot has started (the switch went `triggered`)
        self._acted: set[tuple[str, int, str]] = set()  # ... and whose actions ran (the conditions held)
        self._triggered_until: dict[str, dt.datetime] = {}

    # ------------------------------------------------------------------ clock

    def now(self) -> dt.datetime:
        return self._clock() if self._clock else self._t

    def tick(self, seconds: float) -> None:
        """Advance the fake's own clock (a supplied clock is the caller's to advance) and fire the slots that started in
        between - WITH their conditions (`skip_conditions` only applies to run_action)."""
        if self._clock is None:
            self._t += dt.timedelta(seconds=seconds)
        now = self.now()
        prev = self._last_tick
        days = sorted({prev.astimezone(TZ).date(), now.astimezone(TZ).date()})
        for sid, item in list(self.items.items()):
            if not item["enabled"]:
                continue
            for index, slot in enumerate(item["timeslots"]):
                for day in days:
                    start = self._occurrence_on(item, slot["start"], day)
                    if start is None:
                        continue
                    key = (sid, index, day.isoformat())
                    if key in self._acted:
                        continue
                    if prev < start <= now and key not in self._started:  # the slot starts inside this step
                        # VERIFIED (lab component): the switch goes `triggered` at a slot start EVEN WHEN the conditions fail;
                        # the conditions decide only whether the actions run - so `triggered` does not prove they ran
                        self._started.add(key)
                        ok = self._conditions_pass(slot)
                        if ok:
                            self._acted.add(key)
                        self._fire(sid, slot, index, run_actions=ok)
                    elif start <= now and slot.get("track_conditions") and self._window_open(item, slot, start, now):
                        if self._conditions_pass(slot):  # `track_conditions`: keep checking until the window ends
                            self._acted.add(key)
                            self._fire(sid, slot, index, run_actions=True)
        self._last_tick = now
        for sid in self.items:
            self._refresh(sid)  # the next occurrences moved on
        for sid, until in list(self._triggered_until.items()):
            if now >= until:
                del self._triggered_until[sid]
                item = self.items.get(sid)
                if item is not None and item["repeat_type"] == "single":  # `single` deletes itself ~60 s after the slot start
                    self.items.pop(sid)
                    self.registry = [r for r in self.registry if r["unique_id"] != sid]
                    self._emit("item_removed", sid)
                elif item is not None and item["repeat_type"] == "pause":  # `pause` = disabled, switch off
                    item["enabled"] = False
                    self._emit("item_updated", sid)
                    self._emit("timer_updated", sid)
                self._sync_state(sid)

    def _window_open(self, item: dict[str, Any], slot: dict[str, Any], start: dt.datetime, now: dt.datetime) -> bool:
        if not slot.get("stop"):
            return False
        stop = self._to_local(item, slot["stop"], start.date(), end_of_day=True)
        return stop is not None and start <= now < stop

    # ------------------------------------------------------------------ time helpers

    def _seconds_of(self, raw: str) -> int | None:
        spec = policy.parse_time(raw)
        if spec is None:
            return None
        if spec["kind"] == "fixed":
            return int(spec["seconds"])
        return max(0, min(86340, self.sun[spec["event"]] + int(spec["offset_seconds"])))

    def _to_local(self, item: dict[str, Any], raw: str, day: dt.date, *, end_of_day: bool = False) -> dt.datetime | None:
        secs = self._seconds_of(raw)
        if secs is None:
            return None
        if end_of_day and secs == 0:
            secs = 86400
        return dt.datetime.combine(day, dt.time(0), tzinfo=TZ) + dt.timedelta(seconds=secs)

    def _day_matches(self, item: dict[str, Any], day: dt.date) -> bool:
        tokens = item.get("weekdays") or ["daily"]
        token = DAYS[day.weekday()]
        if "daily" in tokens or token in tokens:
            return True
        if "workday" in tokens and token in ("sun", "mon", "tue", "wed", "thu"):
            return True
        if "weekend" in tokens and token in ("fri", "sat"):
            return True
        if item.get("start_date") and day < dt.date.fromisoformat(item["start_date"]):
            return False
        return False

    def _in_period(self, item: dict[str, Any], day: dt.date) -> bool:
        if item.get("start_date") and day < dt.date.fromisoformat(item["start_date"]):
            return False
        if item.get("end_date") and day > dt.date.fromisoformat(item["end_date"]):
            return False
        return True

    def _occurrence_on(self, item: dict[str, Any], raw: str, day: dt.date) -> dt.datetime | None:
        if not self._day_matches(item, day) or not self._in_period(item, day):
            return None
        return self._to_local(item, raw, day)

    def _next_occurrence(self, item: dict[str, Any], raw: str) -> dt.datetime | None:
        now = self.now()
        today = now.astimezone(TZ).date()
        for k in range(0, 400):
            at = self._occurrence_on(item, raw, today + dt.timedelta(days=k))
            if at is not None and at > now:
                return at
        return None

    # ------------------------------------------------------------------ items and switches

    def _new_id(self) -> str:
        while True:
            sid = "".join(self._rng.choice("0123456789abcdef") for _ in range(6))
            if sid not in self.items:
                return sid

    def _entity_id_for(self, sid: str, name: str) -> str:
        s = slug(name)
        if not s:
            return f"switch.schedule_{sid}"
        taken = {i["entity_id"] for i in self.items.values()}
        candidate, n = f"switch.schedule_{s}", 2
        while candidate in taken:
            candidate, n = f"switch.schedule_{s}_{n}", n + 1  # collisions get _2, _3 ...
        return candidate

    def _refresh(self, sid: str) -> None:
        item = self.items[sid]
        stamps: list[str | None] = []
        order: list[tuple[dt.datetime, int]] = []
        for index, slot in enumerate(item["timeslots"]):
            at = self._next_occurrence(item, slot["start"])
            stamps.append(at.isoformat() if at else None)
            if at:
                order.append((at, index))
        item["timestamps"] = stamps
        item["next_entries"] = [i for _, i in sorted(order)]
        self._sync_state(sid)

    def _sync_state(self, sid: str) -> None:
        item = self.items.get(sid)
        if item is None:
            self.states.pop(sid, None)
            return
        triggered = sid in self._triggered_until
        state = "triggered" if triggered and item["enabled"] else ("on" if item["enabled"] else "off")
        slots = item["timeslots"]
        nxt = item["next_entries"][0] if item["next_entries"] else None
        self.states[sid] = {
            "entity_id": item["entity_id"], "state": state,
            "attributes": {
                "actions": [{"service": s["actions"][0]["service"], "data": s["actions"][0].get("service_data") or {}} if s["actions"] else {} for s in slots],
                "current_slot": self._current_slot(item) if triggered else None, "entities": sorted({a["entity_id"] for s in slots for a in s["actions"] if a.get("entity_id")}),
                "friendly_name": f"Scheduler {item['name']}".strip(), "icon": "mdi:calendar-clock", "next_slot": nxt,
                "next_trigger": item["timestamps"][nxt] if nxt is not None else None, "tags": list(item.get("tags") or []),
                "timeslots": [f"{s['start']} - {s['stop']}" if s.get("stop") else s["start"] for s in slots], "weekdays": list(item["weekdays"]),
            },
        }

    def _current_slot(self, item: dict[str, Any]) -> int | None:
        return getattr(self, "_last_slot", {}).get(item["schedule_id"])

    def _emit(self, name: str, sid: str | None) -> None:
        self.events.append((name, sid))

    def pop_events(self) -> list[dict[str, Any]]:
        """The frames the component's subscription would have delivered since the last call. Verified sequences: create ->
        item_created + timer_updated; edit / toggle -> item_updated + timer_updated; remove -> item_removed only; a slot
        start -> timer_finished, then timer_updated. `subscription`: the component's own command frames, names prefixed
        `scheduler_`; `bus`: the `scheduler_updated` bus event (`data: {}`, no id, none on remove) - only "something changed"."""
        out: list[dict[str, Any]] = []
        for name, sid in self.events:
            if self.event_mode == "none":
                continue
            if self.event_mode == "bus":
                if name in ("item_created", "item_updated"):
                    out.append({"id": self.subscription_id, "type": "event", "event": {"event_type": "scheduler_updated", "data": {}, "origin": "LOCAL"}})
            else:
                out.append({"id": self.subscription_id, "type": "event", "event": {"event": f"scheduler_{name}", "schedule_id": sid}})
        self.events = []
        return out

    # ------------------------------------------------------------------ conditions and firing

    def _state_of(self, entity_id: str) -> tuple[str | None, dict[str, Any]]:
        w = self.world.get(entity_id)
        return (w.get("state"), w.get("attributes") or {}) if w else (None, {})

    def _cond_ok(self, c: dict[str, Any]) -> bool:
        state, attrs = self._state_of(c["entity_id"])
        if state in (None, "unavailable", "unknown"):
            return False  # an unavailable sensor never satisfies `is on` nor `is off`
        actual: Any = state if (c.get("attribute") or "state") == "state" else attrs.get(c["attribute"])
        want, mt = c.get("value"), c.get("match_type") or "is"
        if mt == "is":
            return str(actual) == str(want)
        if mt == "not":
            return str(actual) != str(want)
        try:
            a, b = float(actual), float(want)
        except (TypeError, ValueError):
            return False
        return a > b if mt == "above" else a < b

    def _conditions_pass(self, slot: dict[str, Any]) -> bool:
        conds = slot.get("conditions") or []
        if not conds:
            return True
        results = [self._cond_ok(c) for c in conds]
        return all(results) if slot.get("condition_type") == "and" else any(results)

    def _fire(self, sid: str, slot: dict[str, Any], index: int, run_actions: bool = True) -> None:
        if not hasattr(self, "_last_slot"):
            self._last_slot: dict[str, int] = {}
        self._last_slot[sid] = index
        self._triggered_until[sid] = self.now() + dt.timedelta(seconds=self.trigger_hold_s)
        self._emit("timer_finished", sid)
        self._emit("timer_updated", sid)
        for a in slot["actions"] if run_actions else []:
            fired = {"service": a["service"], "entity_id": a.get("entity_id"), "data": dict(a.get("service_data") or {}), "schedule_id": sid, "slot": index}
            self.actions_fired.append(fired)
            if self.on_action and a.get("entity_id"):
                self.on_action(a["service"], a["entity_id"], dict(a.get("service_data") or {}))
        self._sync_state(sid)

    # ------------------------------------------------------------------ WebSocket (§9.2)

    def ws(self, msg: dict[str, Any]) -> list[dict[str, Any]]:
        """The frames for one command: the result first, then events the subscription would deliver."""
        mid, kind = msg.get("id"), msg.get("type")

        def ok(result: Any) -> list[dict[str, Any]]:
            return [{"id": mid, "type": "result", "success": True, "result": result}]

        def fail(code: str, message: str) -> list[dict[str, Any]]:
            return [{"id": mid, "type": "result", "success": False, "error": {"code": code, "message": message}}]

        if kind == "manifest/get":
            if msg.get("integration") == "scheduler" and self.installed:
                return ok({"domain": "scheduler", "version": "3.3.8"})
            return fail("not_found", "Integration not found.")
        if kind == "get_services":
            return ok({"scheduler": {n: {"fields": f} for n, f in {
                "add": ["end_date", "name", "repeat_type", "start_date", "timeslots", "weekdays"], "edit": ["entity_id", "end_date", "name", "repeat_type", "start_date", "timeslots", "weekdays"],
                "remove": ["entity_id"], "copy": ["entity_id", "name"], "run_action": ["entity_id", "skip_conditions", "time"], "enable_all": [], "disable_all": []}.items()}} if self.installed else {})
        if not self.installed and kind in ("scheduler", "scheduler/item", "scheduler/tags", "scheduler_updated"):
            return fail("unknown_command", "Unknown command.")
        if kind == "scheduler":
            return ok([copy.deepcopy(i) for i in self.items.values()])
        if kind == "scheduler/item":
            item = self.items.get(msg.get("schedule_id") or "")
            return ok(copy.deepcopy(item) if item else None)  # verified: an unknown id answers success:true, result:null
        if kind == "scheduler/tags":
            tags: dict[str, list[str]] = {}
            for sid, item in self.items.items():
                for t in item.get("tags") or []:
                    tags.setdefault(t, []).append(sid)
            return ok([{"name": n, "schedules": ids} for n, ids in sorted(tags.items())])
        if kind == "scheduler_updated":
            self.subscription_id = mid
            return ok(None)
        return fail("unknown_command", "Unknown command.")

    # ------------------------------------------------------------------ services (§9.5)

    # -- the write schema of the real component (verified 2026-09-30 on the lab HA): errors are `invalid_format` "... at 'path'",
    # a TypeError is `unknown_error`; nulls and empties are rejected or crash, unknown keys are rejected at every level

    def _time_ok(self, value: Any) -> bool:
        return isinstance(value, str) and re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?|(sunrise|sunset)[+-]([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?", value) is not None

    def _check_slots(self, slots: Any, validate: bool = False) -> list[dict[str, Any]]:
        if not isinstance(slots, list):
            raise FakeInvalid("timeslots must be a list")
        out = []
        for si, s in enumerate(slots):
            path = f"timeslots[{si}]"
            if not isinstance(s, dict) or "start" not in s or "actions" not in s:
                raise FakeInvalid(f"a timeslot needs start and actions at '{path}'")
            if self.strict_keys and set(s) - SLOT_KEYS:
                raise FakeInvalid(f"not a valid option at '{path}.{sorted(set(s) - SLOT_KEYS)[0]}'")
            for a in s["actions"]:
                if self.strict_keys and (not isinstance(a, dict) or set(a) - ACTION_KEYS):
                    raise FakeInvalid(f"not a valid option at '{path}.actions'")
            for c in s.get("conditions") or []:
                if self.strict_keys and (not isinstance(c, dict) or set(c) - COND_KEYS):
                    raise FakeInvalid(f"not a valid option at '{path}.conditions'")
            if validate:
                self._validate_slot(s, path)
            out.append({
                "start": s["start"], "stop": s.get("stop"), "conditions": copy.deepcopy(s.get("conditions") or []), "condition_type": s.get("condition_type"),
                "track_conditions": bool(s.get("track_conditions", False)),
                "actions": [{"service": a["service"], "entity_id": a.get("entity_id"), "service_data": copy.deepcopy(a.get("service_data") or {})} for a in s["actions"]],
            })
        return out

    def _validate_slot(self, s: dict[str, Any], path: str) -> None:
        if not self._time_ok(s["start"]):
            raise FakeInvalid(f"invalid time at '{path}.start'")
        if "stop" in s:
            if s["stop"] is None:
                raise FakeCrash("TypeError: stop is None")  # verified: `stop: null` -> unknown_error
            if not self._time_ok(s["stop"]):
                raise FakeInvalid(f"invalid time at '{path}.stop'")
        if "conditions" in s:
            if not isinstance(s["conditions"], list) or len(s["conditions"]) < 1:
                raise FakeInvalid(f"length must be at least 1 at '{path}.conditions'")  # verified: `conditions: []` is rejected
            for ci, c in enumerate(s["conditions"]):
                if not isinstance(c.get("entity_id"), str) or not c["entity_id"] or c.get("match_type") not in ("is", "not", "above", "below") or "value" not in c:
                    raise FakeInvalid(f"invalid condition at '{path}.conditions[{ci}]'")  # entity_id, match_type and value are required
                if c.get("attribute") is not None and not isinstance(c["attribute"], str):
                    raise FakeInvalid(f"invalid attribute at '{path}.conditions[{ci}].attribute'")
        if "condition_type" in s and s["condition_type"] not in ("and", "or"):
            raise FakeInvalid(f"value must be one of ['and', 'or'] at '{path}.condition_type'")  # verified: null is rejected
        if "track_conditions" in s and not isinstance(s["track_conditions"], bool):
            raise FakeInvalid(f"expected bool at '{path}.track_conditions'")
        if not isinstance(s["actions"], list) or not s["actions"]:
            raise FakeInvalid(f"length must be at least 1 at '{path}.actions'")
        for ai, a in enumerate(s["actions"]):
            ap = f"{path}.actions[{ai}]"
            if not isinstance(a.get("service"), str) or "." not in a["service"]:
                raise FakeInvalid(f"invalid service at '{ap}.service'")
            if "entity_id" in a and (not isinstance(a["entity_id"], str) or not a["entity_id"]):
                raise FakeInvalid(f"invalid entity id at '{ap}.entity_id'")  # verified: null and "" are rejected
            if "service_data" in a and not isinstance(a["service_data"], dict):
                raise FakeInvalid(f"expected dict at '{ap}.service_data'")  # verified: null is rejected
            # (an unknown service or a nonexistent entity is ACCEPTED by the component: Arx's own allow-list is the only guard)

    def _validate_write(self, data: dict[str, Any], creating: bool) -> dict[str, Any]:
        """Top-level schema; returns the data with `tags` coerced (a string becomes a list)."""
        data = dict(data)
        if self.strict_keys and set(data) - TOP_KEYS:
            raise FakeInvalid(f"not a valid option at '{sorted(set(data) - TOP_KEYS)[0]}'")  # also `enabled` and `schedule_id`
        if creating and "repeat_type" not in data:
            raise FakeInvalid("required key not provided at 'repeat_type'")
        if "repeat_type" in data and data["repeat_type"] not in ("repeat", "pause", "single"):
            raise FakeInvalid("value must be one of ['pause', 'repeat', 'single'] at 'repeat_type'")
        if "weekdays" in data:
            w = data["weekdays"]
            valid = {"mon", "tue", "wed", "thu", "fri", "sat", "sun", "workday", "weekend", "daily"}
            if not isinstance(w, list) or not w or len(set(w)) != len(w) or any(x not in valid for x in w):
                raise FakeInvalid("invalid weekdays at 'weekdays'")  # verified: [] / null / duplicates / upper case are rejected
        for key in ("start_date", "end_date"):
            if data.get(key) is not None:
                try:
                    dt.date.fromisoformat(data[key])
                except (TypeError, ValueError):
                    raise FakeInvalid(f"invalid date at '{key}'") from None
        if "tags" in data:
            if not self.accept_tags:
                raise FakeInvalid("tags are not accepted")
            if isinstance(data["tags"], str):
                data["tags"] = [data["tags"]]  # verified: a string is coerced to a list
            if not isinstance(data["tags"], list) or any(not isinstance(t, str) for t in data["tags"]):
                raise FakeInvalid("invalid tags at 'tags'")
        if "timeslots" in data:
            self._check_slots(data["timeslots"], validate=True)
        return data

    def _find(self, entity_id: str | None) -> str:
        for sid, item in self.items.items():
            if item["entity_id"] == entity_id:
                return sid
        raise FakeInvalid("Entity not found")  # verified: edit / remove / copy on a missing entity

    def _local_seconds_now(self) -> int:
        n = self.now().astimezone(TZ)
        return n.hour * 3600 + n.minute * 60 + n.second

    def _slot_contains(self, slot: dict[str, Any], seconds: int) -> bool:
        """Start inclusive, stop exclusive, wrap-aware; a point slot only at its own start."""
        a = self._seconds_of(slot["start"])
        if a is None:
            return False
        if not slot.get("stop"):
            return seconds == a
        b = self._seconds_of(slot["stop"])
        if b is None:
            return False
        if b == 0:
            b = 86400
        return a <= seconds < b if a < b else (seconds >= a or seconds < b)

    def call_service(self, domain: str, service: str, data: dict[str, Any] | None = None, user: str | None = None) -> dict[str, Any] | None:
        """The component's services. VERIFIED: add / edit / copy / remove do NOT support `return_response` and add / copy
        return nothing - a new id is learned by DIFF (the list of items shows it at once)."""
        data = copy.deepcopy(data or {})
        self.calls.append({"domain": domain, "service": service, "data": copy.deepcopy(data), "user": user})
        if domain == "switch" and service in ("turn_on", "turn_off"):
            sid = self._find(data.get("entity_id"))
            self.items[sid]["enabled"] = service == "turn_on"
            self._sync_state(sid)
            self._emit("item_updated", sid)
            self._emit("timer_updated", sid)
            return None
        if domain != "scheduler" or not self.installed:
            raise ServiceNotFound(f"{domain}.{service}")
        if service == "reload_storage":
            raise ServiceNotFound("scheduler.reload_storage")
        if service in ("enable_all", "disable_all"):
            for sid, item in self.items.items():
                item["enabled"] = service == "enable_all"
                self._sync_state(sid)
            return None
        if service == "add":
            self._add(data, validate=True)
            return None
        if service == "edit":
            sid = self._find(data.pop("entity_id", None))
            self._edit(sid, data, validate=True)
            return None
        if service == "remove":
            sid = self._find(data.get("entity_id"))
            self.items.pop(sid)
            self._sync_state(sid)
            self.registry = [r for r in self.registry if r["unique_id"] != sid]
            self._emit("item_removed", sid)
            return None
        if service == "copy":
            sid = self._find(data.get("entity_id"))
            src = self.items[sid]
            name = data.get("name") or src["name"]  # no name: the source's name is duplicated
            new = self._add({"name": name, "weekdays": src["weekdays"], "start_date": src["start_date"], "end_date": src["end_date"], "repeat_type": src["repeat_type"],
                             "timeslots": copy.deepcopy(src["timeslots"]), "tags": list(src["tags"])})
            self.items[new]["enabled"] = src["enabled"]  # copy keeps everything, enabled and tags included
            self._sync_state(new)
            return None
        if service == "run_action":
            entity = data.get("entity_id")
            sid = next((i for i, it in self.items.items() if it["entity_id"] == entity), None)
            if sid is None:
                return None  # verified: a nonexistent entity is a SILENT success
            wanted = data.get("time")
            if wanted is None:
                seconds = self._local_seconds_now()
            elif isinstance(wanted, str) and re.fullmatch(r"\d{1,2}:\d{2}(:\d{2})?", wanted):
                seconds = self._seconds_of(wanted) or 0
            else:
                raise FakeInvalid("invalid time at 'time'")  # verified: HH:MM:SS or HH:MM only, never a sun form
            item = self.items[sid]
            index = next((i for i, sl in enumerate(item["timeslots"]) if self._slot_contains(sl, seconds)), None)
            if index is None:
                return None  # verified: a time outside every slot is a SILENT no-op
            slot = item["timeslots"][index]
            if data.get("skip_conditions") or self._conditions_pass(slot):  # works on a disabled schedule too
                self._fire(sid, slot, index)
            return None
        raise ServiceNotFound(f"scheduler.{service}")

    def _add(self, data: dict[str, Any], event: str = "item_created", validate: bool = False) -> str:
        """`validate` = a write through the component's schema (call_service); without it the data is taken as already
        stored (the seed, an item made 'in the card' by a test)."""
        if validate:
            data = self._validate_write(data, creating=True)
        elif self.strict_keys and set(data) - TOP_KEYS:
            raise FakeInvalid(f"unknown key {sorted(set(data) - TOP_KEYS)[0]}")
        if "repeat_type" not in data:
            raise FakeInvalid("repeat_type is required")
        if "tags" in data and not self.accept_tags:
            raise FakeInvalid("tags are not accepted")
        sid = self._new_id()
        name = data.get("name") or ""
        item = {
            "schedule_id": sid, "entity_id": self._entity_id_for(sid, name), "name": name, "enabled": True, "weekdays": list(data.get("weekdays") or ["daily"]),
            "start_date": data.get("start_date"), "end_date": data.get("end_date"), "repeat_type": data["repeat_type"], "tags": list(data.get("tags") or []),
            "timeslots": self._check_slots(data.get("timeslots") or []), "timestamps": [], "next_entries": [],
        }
        self.items[sid] = item
        self.registry.append({"entity_id": item["entity_id"], "unique_id": sid, "platform": "scheduler", "device_id": f"dev-{sid}", "area_id": None})
        self._refresh(sid)
        self._emit(event, sid)
        self._emit("timer_updated", sid)
        return sid

    def _edit(self, sid: str, data: dict[str, Any], validate: bool = False) -> None:
        item = self.items[sid]
        if validate:
            data = self._validate_write(data, creating=False)
        elif self.strict_keys and set(data) - TOP_KEYS:
            raise FakeInvalid(f"unknown key {sorted(set(data) - TOP_KEYS)[0]}")
        if "tags" in data and not self.accept_tags:
            raise FakeInvalid("tags are not accepted")
        if "timeslots" in data:
            item["timeslots"] = self._check_slots(data["timeslots"])  # replaces the whole list
        for key in ("weekdays", "repeat_type", "tags"):
            if key in data:
                item[key] = copy.deepcopy(data[key])
        # VERIFIED: an edit that omits `start_date` / `end_date` RESETS both to null - even a name-only edit
        item["start_date"] = data.get("start_date")
        item["end_date"] = data.get("end_date")
        renamed = "name" in data and data["name"] != item["name"]
        if "name" in data:
            item["name"] = data["name"]
            if self.rename_changes_entity_id:
                item["entity_id"] = self._entity_id_for(sid, data["name"])
                for r in self.registry:
                    if r["unique_id"] == sid:
                        r["entity_id"] = item["entity_id"]
        self._refresh(sid)
        # VERIFIED (non-admin lab run): a NAME-CHANGING edit emits item_created (+ timer_updated) and keeps the entity id;
        # one that keeps the name emits item_updated - an `item_created` frame is never proof of a NEW schedule id
        self._emit("item_created" if renamed else "item_updated", sid)
        self._emit("timer_updated", sid)

    # ------------------------------------------------------------------ the bridge (§9.6, §8)

    def _bridge_error(self, msg: dict[str, Any], error: str, path: str | None = None) -> dict[str, Any]:
        out: dict[str, Any] = {"ok": False, "request_id": msg.get("request_id"), "error": error}
        if path:
            out["path"] = path
        return out

    def _validate_payload(self, op: str, payload: dict[str, Any], sensitive: bool) -> tuple[str, str | None] | None:
        """(error, path) of the first problem in an add / edit payload (§8.3), else None."""
        if not isinstance(payload, dict):
            return "invalid_payload", None
        if policy.contains_code(payload):
            return "code_not_allowed", None
        if set(payload) - TOP_KEYS:
            return "invalid_payload", None
        if op == "add" and not {"weekdays", "timeslots", "repeat_type", "name"} <= set(payload):
            return "invalid_payload", None
        slots = payload.get("timeslots")
        if slots is None:
            return None
        if not isinstance(slots, list) or len(slots) > 48:
            return "invalid_payload", "timeslots"
        for si, s in enumerate(slots):
            path = f"timeslots[{si}]"
            if not isinstance(s, dict) or set(s) - SLOT_KEYS or "actions" not in s or "start" not in s:
                return "invalid_payload", path
            if policy.parse_time(s.get("start")) is None or (s.get("stop") not in (None, "") and policy.parse_time(s.get("stop")) is None):
                return "invalid_payload", path
            if len(s["actions"]) > 20 or len(s.get("conditions") or []) > 10:
                return "invalid_payload", path
            for c in s.get("conditions") or []:
                if not isinstance(c, dict) or set(c) - COND_KEYS:
                    return "invalid_payload", f"{path}.conditions"
            for ai, a in enumerate(s["actions"]):
                apath = f"{path}.actions[{ai}]"
                if not isinstance(a, dict) or set(a) - ACTION_KEYS or not a.get("entity_id"):
                    return "invalid_payload", apath
                service, eid = a.get("service"), a["entity_id"]
                if service not in policy.SCHEDULE_ACTION_SERVICES or service.split(".", 1)[0] != eid.split(".", 1)[0]:
                    return "service_not_allowed", apath
                problems, _ = policy.check_arguments(service, a.get("service_data") or {}, None, dynamic=False)
                if problems:
                    return ("code_not_allowed" if problems[0]["code"] == "code_not_allowed" else "argument_not_allowed"), apath
                if eid not in self.world:
                    return "entity_not_found", apath
                dclass = (self.world[eid].get("attributes") or {}).get("device_class")
                needs_flag = eid.startswith(("lock.", "alarm_control_panel.")) or (eid.startswith("cover.") and dclass in SENSITIVE_DEVICE_CLASSES)
                if needs_flag and not sensitive:
                    return "sensitive_flag_mismatch", apath
                if eid in self.denied_entities:
                    return "unauthorized", apath
        return None

    def bridge_schedule(self, msg: dict[str, Any], secret: str) -> dict[str, Any]:
        """`smplwise_bridge.schedule` against the fake component: signature, op allow-list, payload schema and services
        (the add-on's own `schedule_policy`), the sensitive flag, the registry check and the id diff for add / copy."""
        self.bridge_calls.append({k: copy.deepcopy(v) for k, v in msg.items() if k not in ("sig", "nonce", "ts")})
        try:
            ha_bridge.verify(secret, msg)
        except ApiError as exc:
            return self._bridge_error(msg, {"bridge_stale": "stale", "bridge_replay": "replay"}.get(exc.code, "bad_signature"))
        op = msg.get("op")
        if op in self.timeout_next:
            self.timeout_next.discard(op)
            raise httpx.ReadTimeout("the fake component did not answer")
        if op in self.fail_next:
            return self._bridge_error(msg, self.fail_next.pop(op))
        if not self.installed:
            return self._bridge_error(msg, "scheduler_missing")
        if op not in BRIDGE_OPS:
            return self._bridge_error(msg, "op_not_allowed")
        sid, entity = msg.get("schedule_id"), msg.get("schedule_entity_id")
        if op in ("add", "edit"):
            bad = self._validate_payload(op, msg.get("payload") or {}, bool(msg.get("sensitive")))
            if bad:
                return self._bridge_error(msg, bad[0], bad[1])
        if op != "add":
            reg = next((r for r in self.registry if r["entity_id"] == entity), None)
            if reg is None or reg["platform"] != "scheduler" or reg["unique_id"] != sid:
                return self._bridge_error(msg, "not_a_schedule")
        before = {r["unique_id"] for r in self.registry}
        user = msg.get("user_id")
        try:
            if op == "add":
                self.call_service("scheduler", "add", msg["payload"], user)
            elif op == "edit":
                self.call_service("scheduler", "edit", {**msg["payload"], "entity_id": entity}, user)
            elif op == "remove":
                self.call_service("scheduler", "remove", {"entity_id": entity}, user)
            elif op == "copy":
                self.call_service("scheduler", "copy", {"entity_id": entity, "name": msg.get("name")}, user)
            elif op == "run":
                self.call_service("scheduler", "run_action", {"entity_id": entity, "time": msg.get("time"), "skip_conditions": bool(msg.get("skip_conditions"))}, user)
            else:
                self.call_service("switch", "turn_on" if op == "enable" else "turn_off", {"entity_id": entity}, user)
        except FakeCrash:
            return self._bridge_error(msg, "unknown_error")
        except (FakeInvalid, FakeNotFound):
            return self._bridge_error(msg, "invalid_format")
        except ServiceNotFound:
            return self._bridge_error(msg, "service_not_found")
        out: dict[str, Any] = {"ok": True, "request_id": msg.get("request_id"), "context_id": "ctx-fake", "schedule_id": sid, "entity_id": entity}
        if op in ("add", "copy"):
            new = [r for r in self.registry if r["unique_id"] not in before]
            if self.hide_new_id or len(new) != 1:
                self.hide_new_id = False
                out.update(schedule_id=None, entity_id=None, error="id_unknown")
            else:
                out.update(schedule_id=new[0]["unique_id"], entity_id=new[0]["entity_id"])
        return out


# ---------------------------------------------------------------- the transport seam (services/schedules.set_transport)

class FakeTransport:
    """`SchedulerTransport` over a FakeScheduler: `ws` / `bridge` never touch a network; `up = False` is an unreachable
    Home Assistant (503 `ha_unavailable`), `bridge_calls` / `ws_calls` are for assertions."""

    def __init__(self, fake: FakeScheduler, secret: str) -> None:
        self.fake, self.secret = fake, secret
        self.up = True
        self.configured_flag = True
        self.ws_calls: list[str] = []
        self._id = 0

    def ws(self, msg_type: str, **kw: Any) -> dict[str, Any]:
        if not self.up:
            raise ApiError(503, "ha_unavailable", "תשתית המערכת אינה זמינה כרגע.", retryable=True)
        self._id += 1
        self.ws_calls.append(msg_type)
        return self.fake.ws({"id": self._id, "type": msg_type, **kw})[0]

    def bridge(self, payload: dict[str, Any]) -> dict[str, Any]:
        if not self.up:
            raise ApiError(503, "ha_unavailable", "תשתית המערכת אינה זמינה כרגע.", retryable=True)
        try:
            return self.fake.bridge_schedule(payload, self.secret)
        except httpx.ReadTimeout:
            raise ApiError(504, "scheduler_timeout", "רכיב התזמונים לא ענה בזמן; ייתכן שהשינוי נשמר. רעננו לפני ניסיון נוסף.") from None

    def connected(self) -> bool:
        return self.up

    def configured(self) -> bool:
        return self.configured_flag


# ---------------------------------------------------------------- generic world (anonymised)

AREAS = [
    {"area_id": "sch_living", "name": "Living room", "floor_id": "sch_ground"},
    {"area_id": "sch_gym", "name": "Gym", "floor_id": "sch_ground"},
    {"area_id": "sch_bedrooms", "name": "Bedrooms", "floor_id": "sch_upper"},
    {"area_id": "sch_yard", "name": "Yard", "floor_id": "sch_ground"},
]
FLOORS = [{"floor_id": "sch_ground", "name": "Ground floor", "level": 0}, {"floor_id": "sch_upper", "name": "First floor", "level": 1}]

# entity id -> (name, area, state, attributes)
ENTITIES: dict[str, tuple[str, str | None, str, dict[str, Any]]] = {
    "climate.living_room": ("Living room AC", "sch_living", "cool", {"hvac_modes": ["off", "cool", "heat", "auto"], "min_temp": 16, "max_temp": 30, "temperature": 25, "supported_features": 1}),
    "climate.bedroom_1": ("Bedroom 1 AC", "sch_bedrooms", "off", {"hvac_modes": ["off", "cool", "heat", "auto"], "min_temp": 16, "max_temp": 30, "supported_features": 1}),
    "climate.bedroom_2": ("Bedroom 2 AC", "sch_bedrooms", "off", {"hvac_modes": ["off", "cool", "heat", "auto"], "min_temp": 16, "max_temp": 30, "supported_features": 1}),
    "climate.study": ("Study AC", "sch_bedrooms", "off", {"hvac_modes": ["off", "cool", "heat", "auto"], "min_temp": 16, "max_temp": 30, "supported_features": 1}),
    "switch.hall_lights": ("Hall lights relay", "sch_living", "off", {}),
    "switch.garden_pump": ("Garden pump", "sch_yard", "off", {}),
    "light.office": ("Office light", "sch_living", "off", {"brightness": 0, "supported_features": 0}),
    "cover.gym_shutter": ("Gym shutter", "sch_gym", "open", {"current_position": 100, "device_class": "shutter", "supported_features": 15}),
    "cover.driveway_gate": ("Driveway gate", "sch_yard", "closed", {"device_class": "gate", "supported_features": 3}),
    "alarm_control_panel.home_panel": ("Home alarm", None, "disarmed", {"code_format": "number", "code_arm_required": False, "supported_features": 1 | 2 | 4}),
    "alarm_control_panel.shed_panel": ("Shed alarm", None, "disarmed", {"code_format": None, "supported_features": 1 | 2}),
    "lock.front_door": ("Front door lock", "sch_living", "locked", {"supported_features": 0}),
    "lock.side_door": ("Side door lock", "sch_yard", "locked", {"code_format": "number", "supported_features": 0}),
    SHABBAT: ("Rest day in effect", None, "off", {"device_class": None}),
    "binary_sensor.motion_hall": ("Hall motion", "sch_living", "off", {"device_class": "motion"}),
    "sensor.outdoor_temperature": ("Outdoor temperature", "sch_yard", "22.5", {"unit_of_measurement": "°C"}),
    # a zone-bypass switch of the alarm's own integration: owned by the alarm section, never schedulable (even when marked bulk-safe)
    "switch.zone_9_bypassed": ("Zone 9 bypassed", None, "off", {}),
    "sun.sun": ("Sun", None, "above_horizon", {"next_rising": "2026-10-01T03:32:00+00:00", "next_setting": "2026-09-30T15:15:00+00:00"}),
}


def world_states() -> dict[str, dict[str, Any]]:
    """`get_states` style dicts of the generic entities (also the fake's `world`, which conditions and the bridge read)."""
    t0 = "2026-09-30T10:00:00+00:00"
    return {eid: {"entity_id": eid, "state": st, "attributes": {"friendly_name": name, **attrs}, "last_changed": t0, "last_updated": t0} for eid, (name, _area, st, attrs) in ENTITIES.items()}


def world_registry() -> list[dict[str, Any]]:
    out = []
    for eid, (name, area, _st, _attrs) in ENTITIES.items():
        platform = {"alarm_control_panel": "risco", "lock": "zwave_js", "sun": "sun"}.get(eid.split(".", 1)[0], "generic")
        entry = f"ce-{platform}"
        if eid == "switch.zone_9_bypassed":
            platform, entry = "risco", None  # no config entry yet: the alarm section fails closed and owns it (services/alarm.fallback_controls)
        out.append({"id": f"reg-{eid}", "entity_id": eid, "unique_id": f"u-{eid}", "platform": platform, "config_entry_id": entry, "device_id": None, "area_id": area, "entity_category": None,
                    "original_name": name, "name": None, "disabled_by": None, "hidden_by": None})
    return out


# ---------------------------------------------------------------- the seed (§9.4)

def _slot(start: str, stop: str | None, *actions: tuple[str, str, dict[str, Any]], cond: str | None = None, ctype: str | None = "or", track: bool = False) -> dict[str, Any]:
    conds = [{"entity_id": SHABBAT, "attribute": "state", "value": cond, "match_type": "is"}] if cond else []
    return {"start": start, "stop": stop, "conditions": conds, "condition_type": ctype if cond else None, "track_conditions": track if cond else False,
            "actions": [{"service": s, "entity_id": e, "service_data": d} for s, e, d in actions]}


def _cooling(entity: str, temp: float, times: list[str]) -> list[dict[str, Any]]:
    slots = []
    for i, start in enumerate(times):
        stop = times[i + 1] if i + 1 < len(times) else "00:00:00"
        act = ("climate.set_temperature", entity, {"hvac_mode": "cool", "temperature": temp}) if i % 2 == 0 else ("climate.turn_off", entity, {})
        slots.append(_slot(start, stop, act, cond="on"))
    return slots


def seed_live_like(fake: FakeScheduler) -> dict[str, str]:
    """The twelve patterns of §9.4 (anonymised): returns {pattern number: schedule id}. Slots are contiguous 00:00 -> 00:00
    where the pattern says so; tags follow the distribution (`shabbat` dominant, `offices`, `outdoor`)."""
    fake.world = world_states()
    ids: dict[str, str] = {}

    def add(n: int, name: str, slots: list[dict[str, Any]], *, weekdays: list[str] | None = None, repeat: str = "repeat", tags: list[str] | None = None, start_date: str | None = None,
            end_date: str | None = None, enabled: bool = True) -> None:
        sid = fake._add({"name": name, "weekdays": weekdays or ["daily"], "repeat_type": repeat, "timeslots": slots, **({"tags": tags} if tags else {}),
                         **({"start_date": start_date} if start_date else {}), **({"end_date": end_date} if end_date else {})})
        if not enabled:
            fake.items[sid]["enabled"] = False
            fake._sync_state(sid)
        ids[str(n)] = sid

    add(1, "Living room cooling on rest days", _cooling("climate.living_room", 25, ["00:00:00", "06:00:00", "12:00:00", "16:00:00", "22:00:00"]), tags=["shabbat"])
    add(2, "Bedroom 1 cooling on rest days", _cooling("climate.bedroom_1", 25.5, ["00:00:00", "07:00:00", "20:00:00"]), tags=["shabbat"], enabled=False)
    add(3, "Hall lights on rest days", [_slot("00:00:00", "18:00:00", ("switch.turn_off", "switch.hall_lights", {}), cond="on"), _slot("18:00:00", "00:00:00", ("switch.turn_on", "switch.hall_lights", {}), cond="on")], tags=["shabbat"])
    add(4, "Office light on weekdays", [_slot("08:00:00", "18:00:00", ("light.turn_on", "light.office", {"brightness": 51})), _slot("18:00:00", None, ("light.turn_off", "light.office", {}))],
        weekdays=["sun", "mon", "tue", "wed", "thu"], tags=["offices"])
    add(5, "Gym shutter", [_slot("07:00:00", "19:00:00", ("cover.set_cover_position", "cover.gym_shutter", {"position": 10})), _slot("19:00:00", "00:00:00", ("cover.close_cover", "cover.gym_shutter", {}))], tags=["outdoor"])
    add(6, "Arm the home panel", [_slot("23:30:00", None, ("alarm_control_panel.alarm_arm_home", "alarm_control_panel.home_panel", {}))])
    add(7, "", [{"start": "05:00:00", "stop": None, "conditions": [], "condition_type": None, "track_conditions": False, "actions": [{"service": "script.missing_script", "entity_id": None, "service_data": {}}]}])
    add(8, "Yard light in season", [_slot("sunset+00:30:00", "00:00:00", ("light.turn_on", "light.office", {"brightness_pct": 40}))], start_date="2026-10-31", end_date="2027-03-31", tags=["outdoor"])
    add(9, "One shot watering", [_slot("06:00:00", None, ("switch.turn_on", "switch.hall_lights", {}))], repeat="pause")
    add(10, "All bedrooms off", [_slot("00:00:00", "00:00:00", ("climate.turn_off", "climate.bedroom_1", {}), ("climate.turn_off", "climate.bedroom_2", {}), ("climate.turn_off", "climate.study", {}),
                                       ("climate.turn_off", "climate.living_room", {}), cond="on")], tags=["shabbat"])
    add(11, "Not on rest days", [_slot("07:00:00", None, ("switch.turn_on", "switch.hall_lights", {}), cond="off")], tags=["offices"])
    add(12, "Gate", [_slot("07:00:00", "08:00:00", ("cover.open_cover", "cover.driveway_gate", {})), _slot("08:00:00", "00:00:00", ("cover.close_cover", "cover.driveway_gate", {}))], enabled=False)
    return ids


def seed_mirror(db: Any, fake: FakeScheduler | None = None, *, bulk_safe: tuple[str, ...] = ("switch.hall_lights", "switch.zone_9_bypassed")) -> None:
    """Put the generic entities, their registry rows, HA areas / floors and (with a fake) the schedule switches into the
    add-on's mirror, and mark the bulk-safe switches - what the entity sync would have written."""
    from smplwise.db import now_iso
    from smplwise.services import ha_client, ha_sync

    states = list(world_states().values())
    reg = world_registry()
    if fake is not None:
        for sid, item in fake.items.items():
            st = fake.states[sid]
            states.append({"entity_id": st["entity_id"], "state": st["state"], "attributes": st["attributes"], "last_changed": "2026-09-30T10:00:00+00:00", "last_updated": "2026-09-30T10:00:00+00:00"})
        for r in fake.registry:
            reg.append({"id": f"reg-{r['entity_id']}", "entity_id": r["entity_id"], "unique_id": r["unique_id"], "platform": "scheduler", "config_entry_id": "ce-scheduler", "device_id": r["device_id"], "area_id": None,
                        "entity_category": None, "original_name": None, "name": None, "disabled_by": None, "hidden_by": None})
    with db.connection() as conn:
        for st in states:
            ha_sync.upsert_state(conn, st)
        ha_sync.apply_registry(conn, ha_client.registry_maps(reg, [], AREAS, FLOORS))
        ha_sync.apply_structure(conn, AREAS, FLOORS)
        for eid in bulk_safe:
            conn.execute("INSERT OR REPLACE INTO device_bulk_safe(entity_id, marked_by, marked_by_username, marked_at) VALUES (?, 'test', 'test', ?)", (eid, now_iso()))
