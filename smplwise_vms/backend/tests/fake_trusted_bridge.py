"""CR-033 slice D0: the fakes the WisKey door path is built and tested on. Models only - no Home Assistant, no bridge, no
WisKey, no door, no key (the pairing secret is the published golden-vector TEST constant).

- `FakeTrustedBridge`: `smplwise_bridge.door_open` / `door_open_status` as the DTO draft v3 describes them. The contract
  oracle is the v3 reference itself (`test_wiskey_golden_vectors.reference_door_service`, the model every golden vector
  agrees with), driven with a STATEFUL store kept here (records, nonces), an injectable capability / storage / dispatch
  result / clock snapshot, and an injectable "timeout after a possible delivery" (the record is written, the caller gets
  a transport error). Installed in place of `ha_client.call_service`; it refuses any other service.
- `FakeClock`: the bridge's notion of now (epoch seconds), frozen or offset.
- `FakeWisKeyFeed`: a served WisKey overview copy (stations, relays, online flags) installed into `intercom_sync.SYNC`
  plus the interim station-release transport (`SYNC.action`) recorded instead of sent, with injectable outcomes
  (accepted, refused before the device, not sent, unknown)."""
from __future__ import annotations

import copy
import json
import time
from typing import Any, Callable

import test_wiskey_golden_vectors as gv

from smplwise.errors import ApiError
from smplwise.services import ha_client, intercom_sync

TEST_SECRET = gv.TEST_SECRET  # published test constant, never a real pairing secret


class FakeClock:
    """The bridge's clock (epoch seconds). `offset_s` shifts the real clock (a bridge ahead / behind Arx); `frozen` pins it."""

    def __init__(self, offset_s: int = 0, frozen: int | None = None) -> None:
        self.offset_s = offset_s
        self.frozen = frozen

    def now(self) -> int:
        return self.frozen if self.frozen is not None else int(time.time()) + self.offset_s


class FakeTrustedBridge:
    """`door_open` / `door_open_status` against the v3 reference model with a store that persists between calls."""

    def __init__(self, station_relays: dict[str, list[int]] | None = None, clock: FakeClock | None = None) -> None:
        self.station_relays = station_relays or {}
        self.clock = clock or FakeClock()
        self.capability = "valid"  # valid | missing | invalid | revoked
        self.storage = "ok"  # ok | fails_before_send
        self.dispatch_result = "acknowledged"  # acknowledged | unconfirmed | interrupted | outcome_persistence_failed
        self.clock_snapshot: dict[str, Any] | None = None  # a W7 snapshot (gv._clock(...)); None = healthy, not under test
        self.timeout_after_delivery = False  # the open is recorded and dispatched, but the caller sees a transport error
        self.unreachable = False  # the call never reaches the bridge (connection refused)
        self.keys: Callable[[str], str | None] | None = None  # K-07: the receiver's key set (kid -> material); None = the pairing secret only
        self.records: list[dict[str, Any]] = []
        self.calls: list[dict[str, Any]] = []  # every call: service, signed_message_json, parsed message, response
        self.other_calls: list[tuple[str, str]] = []

    # ------------------------------------------------------------- what the add-on calls
    def call_service(self, settings: Any, domain: str, service: str, data: dict[str, Any], return_response: bool = False, timeout: float = 15.0) -> dict[str, Any]:
        if domain != "smplwise_bridge" or service not in ("door_open", "door_open_status"):
            self.other_calls.append((domain, service))
            raise AssertionError(f"FakeTrustedBridge: unexpected service {domain}.{service}")
        assert return_response is True, "door_open / door_open_status are always called with return_response"
        if self.unreachable:
            raise ApiError(503, "ha_unavailable", "תשתית המערכת אינה זמינה כרגע.", retryable=True, details={"error": "ConnectError"})
        response, effects = gv.reference_door_service(service, data, self.clock.now(), self._setup(), keys=self.keys)
        text = data.get("signed_message_json") if isinstance(data, dict) else None
        try:
            parsed = json.loads(text) if isinstance(text, str) else None
        except ValueError:
            parsed = None
        self.calls.append({"service": service, "text": text, "message": parsed, "response": response, "effects": effects})
        if effects["dispatched"] and parsed is not None:
            state = "acknowledged" if response.get("result") == "acknowledged" else "unknown"
            self.records.append({"request_id": parsed["request_id"], "nonce": parsed["nonce"], "actor": dict(parsed["actor"]), "station": parsed["station"],
                                 "relay": parsed["params"]["relay"], "state": state, "reason": None if state == "acknowledged" else response.get("reason")})
            if self.timeout_after_delivery:
                raise ApiError(503, "ha_unavailable", "תשתית המערכת אינה זמינה כרגע.", retryable=True, details={"error": "ReadTimeout"})
        return copy.deepcopy(response)

    def _setup(self) -> dict[str, Any]:
        return {"capability": self.capability, "station_relays": self.station_relays, "records": copy.deepcopy(self.records), "storage": self.storage,
                "dispatch_result": self.dispatch_result, "clock": self.clock_snapshot}

    # ------------------------------------------------------------- helpers for assertions
    def opens(self) -> list[dict[str, Any]]:
        return [c for c in self.calls if c["service"] == "door_open"]

    def statuses(self) -> list[dict[str, Any]]:
        return [c for c in self.calls if c["service"] == "door_open_status"]

    def install(self, monkeypatch: Any) -> "FakeTrustedBridge":
        monkeypatch.setattr(ha_client, "call_service", self.call_service)
        return self


def station(station_id: str, name: str, relays: list[int] | None = None, online: bool = True, lock_enabled: bool = True) -> dict[str, Any]:
    """One station in WisKey's raw overview shape (only what Arx projects; synthetic names, no host or hardware id)."""
    relays = [1] if relays is None else relays
    return {"id": station_id, "name": name, "online": online, "call_state": "idle", "sync_state": "synced", "lock_enabled": lock_enabled,
            "integrated_locks": [{"physical_index": r, "api_id": r, "name": f"ממסר {r}"} for r in relays], "entities": {}, "last_access": None, "clock": None}


class FakeWisKeyFeed:
    """A served WisKey copy and the interim release transport, without a WebSocket. `outcome` decides what the next
    station release does: `ok` (WisKey accepted), `refused` (refused before the device), `not_sent`, `unknown`."""

    def __init__(self, stations: list[dict[str, Any]]) -> None:
        self.raw = {"api": {"version": 1}, "default_zone": None, "user_count": 0, "stations": stations}
        self.outcome = "ok"
        self.sent: list[dict[str, Any]] = []

    def install(self, monkeypatch: Any) -> "FakeWisKeyFeed":
        sync = intercom_sync.SYNC
        sync.reset()
        with sync._cache_lock:
            sync._cache = intercom_sync.project_overview(copy.deepcopy(self.raw))
        intercom_sync.STATE.state = "ready"
        monkeypatch.setattr(sync, "served", lambda settings: ("ready", sync._cache))
        monkeypatch.setattr(sync, "action", self.action)
        return self

    def action(self, settings: Any, key: str, send: Callable[..., Any], project: Callable[[Any], Any], who: str, not_after: Any = None,
               on_settled: Callable[[], None] | None = None, **_kw: Any) -> dict[str, Any]:
        """What IntercomSync.action does for a release, recorded: the frame `send` would write is captured by calling it
        with a recording `call` (the real intercom_client wrapper decides the frame's shape)."""
        frames: list[dict[str, Any]] = []

        async def call(kind: str, **fields: Any) -> Any:
            frames.append({"type": kind, **fields})
            return {"success": True, "result": {"accepted": True}}

        import asyncio

        try:
            if self.outcome == "not_sent":
                raise ApiError(503, "intercom_unavailable", "WisKey אינו זמין.", details={"outcome": "not_sent"})
            result = asyncio.run(send(call))
            self.sent.append({"key": key, "who": who, "frames": frames})
            if self.outcome == "refused":
                raise ApiError(409, "intercom_refused", "WisKey דחה את הפקודה.", details={"outcome": "refused", "wiskey_code": "device_unavailable"})
            if self.outcome == "unknown":
                raise ApiError(504, "intercom_timeout", "אין תשובה מ־WisKey.", details={"outcome": "unknown"})
            return {"state": "ready", "configured": True, "last_error": None, "fetched_at": None, key: project(result), "sync": {}}
        finally:
            if on_settled:
                on_settled()


# ---------------------------------------------------------------- LEASE-BUILD: smplwise_bridge.lease_event / lease_request (stages 1-7)

class FakeLeaseBridge:
    """The bridge side of `wiskey-capture-lease-v1` as a `services.lease_events.LeaseTransport`: stages 1-7 through the reference
    validator (tests/lease_contract.py) with a persistent nonce journal (state/replay), then the host (tests/fake_wiskey.py
    `FakeLeaseHost`, stage 8). Switches: `unreachable` (the call never reaches the bridge), `drop_answer` (the host applies the
    message, the caller sees a transport error), `clock_invalid` (every message answered `rejected time/clock_invalid`),
    `answer_override` (a callable(dto, answer) -> answer, to inject non-closed shapes)."""

    def __init__(self, host: Any, clock: Any, secret: str = TEST_SECRET) -> None:
        import lease_contract

        self._lc = lease_contract
        self.host = host
        self.clock = clock
        self.secret = secret
        self.nonces: set[str] = set()
        self.unreachable = False
        self.drop_answer = False
        self.clock_invalid = False
        self.answer_override: Callable[[Any, Any], Any] | None = None
        self.calls: list[dict[str, Any]] = []  # every call: service, text, answer (or the error code)

    def _handle(self, service: str, text: str) -> Any:
        if self.unreachable:
            self.calls.append({"service": service, "text": text, "answer": "unreachable"})
            raise ApiError(503, "ha_unavailable", "x", retryable=True, details={"error": "ConnectError"})
        try:
            dto = self._lc.validate(service, {"signed_message_json": text}, self.clock.now(), self.secret, self.nonces)
        except self._lc.Reject as exc:
            answer: Any = {"result": "rejected", "stage": exc.stage, "code": exc.code}
            if exc.request_id is not None:  # closed answers: request_id iff the schema stage passed
                answer["request_id"] = exc.request_id
            self.calls.append({"service": service, "text": text, "answer": answer})
            return answer
        if self.clock_invalid:
            answer = {"result": "rejected", "stage": "time", "code": "clock_invalid", "request_id": dto.request_id}
            self.calls.append({"service": service, "text": text, "answer": answer, "dto": dto})
            return answer
        answer = self.host.handle_event(dto) if service == "lease_event" else self.host.handle_request(dto)
        if self.answer_override is not None:
            answer = self.answer_override(dto, answer)
        self.calls.append({"service": service, "text": text, "answer": answer, "dto": dto})
        if answer is None or self.drop_answer:
            raise ApiError(503, "ha_unavailable", "x", retryable=True, details={"error": "ReadTimeout"})
        return {"service_response": copy.deepcopy(answer)}

    # LeaseTransport
    def event(self, settings: Any, text: str) -> Any:
        return self._handle("lease_event", text)

    def request(self, settings: Any, action: str, text: str) -> Any:
        return self._handle("lease_request", text)

    def replay(self, index: int = -1) -> Any:
        """N2: the SAME signed bytes again (stage state/replay must refuse them)."""
        call = [c for c in self.calls if isinstance(c.get("text"), str)][index]
        return self._handle(call["service"], call["text"])

    def actions(self, service: str | None = None) -> list[str]:
        return [c["dto"].action for c in self.calls if "dto" in c and (service is None or c["service"] == service)]
