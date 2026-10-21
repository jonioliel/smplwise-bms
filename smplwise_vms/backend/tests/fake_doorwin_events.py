"""CR-039 slice W0: a fake Home Assistant event source for event-triggered windows (spec 9.1, 9.2, 9.5; T4, T5).

Two event types matter: the custom event `smplwise_arx_door_window` (`event_data: {rule_id, token}`, fired by ANY HA
automation, also one written outside Arx - 9.5) and the `automation_triggered` mirror (`{entity_id, name, source}`, which
`services/ha_sync.py AUTOMATION_EVENTS` already subscribes to and hands to `automations.MIRROR.on_ha_event`). Frames are in
Home Assistant's WebSocket event shape: `{"id": <subscription id>, "type": "event", "event": {"event_type", "data",
"origin", "time_fired", "context": {"id", "parent_id", "user_id"}}}` - the same dict `ha_sync`'s handler receives.

- `subscribe(event_type, callback)` -> a subscription id; every fired frame goes to the callbacks subscribed to its type, in
  subscription order. `subscriptions` lists what was subscribed (a test can pin that the product subscribes to the one
  allow-listed type only, 9.1).
- `fire(event_type, data, ...)` / `door_window(rule_id, token)` / `automation_triggered(entity_id, ...)`: deliver now;
  `fire_at(instant, ...)` / `storm(n, every_s, ...)`: deliver later on the deterministic scheduler (owner "ha").
- Switches: `connected` (False: frames fired while disconnected are DROPPED - Home Assistant never replays events - and
  listed in `dropped`), `deliver_twice` (each frame is delivered twice, the same context id: a duplicate delivery the product
  must not count as two triggers), `origin` ("LOCAL" / "REMOTE").
- Forgeries for T4: `forged_wrong_token`, `forged_unknown_rule`, `forged_template` (a Jinja-looking payload - the product
  never renders it), `forged_extra_keys`, `forged_types` (non-string ids). Each returns the frame it delivered.

Context ids are deterministic (`01JCTX...` + a counter) so the audit pair `trigger_ref` is stable across runs. The token in
an event is a secret of the rule (stored hashed by the product): tests pass it to `fake_doorwin_asserts.assert_no_secrets`.
"""
from __future__ import annotations

import copy
import datetime as dt
import itertools
from typing import Any, Callable

from fake_doorwin_clock import DoorwinScheduler, FakeDoorwinClock

DOOR_WINDOW_EVENT = "smplwise_arx_door_window"
AUTOMATION_TRIGGERED = "automation_triggered"

Callback = Callable[[dict[str, Any]], Any]


class FakeHaEventSource:
    def __init__(self, clock: FakeDoorwinClock, scheduler: DoorwinScheduler | None = None) -> None:
        self.clock = clock
        self.scheduler = scheduler
        self.connected = True
        self.deliver_twice = False
        self.origin = "LOCAL"
        self._subs: dict[int, tuple[str, Callback]] = {}
        self._ids = itertools.count(1)
        self._ctx = itertools.count(1)
        self.subscriptions: list[str] = []
        self.delivered: list[dict[str, Any]] = []
        self.dropped: list[dict[str, Any]] = []

    # ------------------------------------------------------------ subscriptions
    def subscribe(self, event_type: str, callback: Callback) -> int:
        sub = next(self._ids)
        self._subs[sub] = (event_type, callback)
        self.subscriptions.append(event_type)
        return sub

    def unsubscribe(self, sub: int) -> None:
        self._subs.pop(sub, None)

    def subscribed_types(self) -> set[str]:
        return {t for t, _ in self._subs.values()}

    # ------------------------------------------------------------ frames
    def next_context_id(self) -> str:
        return f"01JCTX{next(self._ctx):020d}"

    def event(self, event_type: str, data: dict[str, Any], *, context_id: str | None = None, parent_id: str | None = None, user_id: str | None = None) -> dict[str, Any]:
        """The `event` object of a frame (no subscription id yet)."""
        return {"event_type": event_type, "data": copy.deepcopy(data), "origin": self.origin, "time_fired": self.clock.now_iso(),
                "context": {"id": context_id or self.next_context_id(), "parent_id": parent_id, "user_id": user_id}}

    def fire(self, event_type: str, data: dict[str, Any], **ctx: Any) -> dict[str, Any]:
        """Deliver one event now to every subscriber of its type. Returns the event object."""
        ev = self.event(event_type, data, **ctx)
        if not self.connected:
            self.dropped.append(ev)
            return ev
        for _ in range(2 if self.deliver_twice else 1):
            for sub, (etype, cb) in list(self._subs.items()):
                if etype == event_type:
                    frame = {"id": sub, "type": "event", "event": copy.deepcopy(ev)}
                    self.delivered.append(frame)
                    cb(frame)
        return ev

    def fire_at(self, when: dt.datetime, event_type: str, data: dict[str, Any], **ctx: Any) -> None:
        if self.scheduler is None:
            raise AssertionError("fire_at needs a scheduler")
        self.scheduler.call_at(when, lambda: self.fire(event_type, data, **ctx), owner="ha", name=f"ha.event.{event_type}")

    def storm(self, n: int, every_s: float, event_type: str, data: dict[str, Any]) -> None:
        """`n` identical events `every_s` apart, the first one now (the storm cap of 9.2 / the loop of T5)."""
        if self.scheduler is None:
            raise AssertionError("storm needs a scheduler")
        start = self.clock.now()
        for i in range(n):
            self.fire_at(start + dt.timedelta(seconds=i * every_s), event_type, data)

    # ------------------------------------------------------------ the two event types
    def door_window(self, rule_id: str, token: str, **ctx: Any) -> dict[str, Any]:
        """What the YAML snippet of 9.5 fires: `event: smplwise_arx_door_window, event_data: {rule_id, token}`."""
        return self.fire(DOOR_WINDOW_EVENT, {"rule_id": rule_id, "token": token}, **ctx)

    def automation_triggered(self, entity_id: str, name: str | None = None, source: str = "state of binary_sensor.lobby_motion", **ctx: Any) -> dict[str, Any]:
        """HA's own `automation_triggered` (`{entity_id, name, source}`; the run's context id is the audit `trigger_ref`)."""
        return self.fire(AUTOMATION_TRIGGERED, {"entity_id": entity_id, "name": name or entity_id.split(".", 1)[-1], "source": source}, **ctx)

    # ------------------------------------------------------------ forgeries (T4)
    def forged_wrong_token(self, rule_id: str) -> dict[str, Any]:
        return self.fire(DOOR_WINDOW_EVENT, {"rule_id": rule_id, "token": "not-the-rule-token"})

    def forged_unknown_rule(self, token: str = "guess") -> dict[str, Any]:
        return self.fire(DOOR_WINDOW_EVENT, {"rule_id": "00000000-0000-4000-8000-000000000000", "token": token})

    def forged_template(self, rule_id: str) -> dict[str, Any]:
        return self.fire(DOOR_WINDOW_EVENT, {"rule_id": rule_id, "token": "{{ states('input_text.door_token') }}"})

    def forged_extra_keys(self, rule_id: str, token: str) -> dict[str, Any]:
        return self.fire(DOOR_WINDOW_EVENT, {"rule_id": rule_id, "token": token, "duration_s": 86400, "doors": "all"})

    def forged_types(self) -> dict[str, Any]:
        return self.fire(DOOR_WINDOW_EVENT, {"rule_id": 7, "token": ["x"]})
