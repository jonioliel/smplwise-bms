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
  (accepted, refused before the device, not sent, unknown).
- `FakeTrustBridge` (CR-040, WXROT): the bridge's `trust_rotate` / `trust_status` for the add-on's tests - the REAL bridge core
  (custom_components/smplwise_bridge/trust.py and signing.py, loaded without Home Assistant) with an in-memory durable store, the
  one Verifier every signed service shares (also behind `ha_client.call_bridge_execute`), restarts from the store, and transport
  faults per call. A `FakeTrustedBridge` routes the two trust services to an attached one (`attach_trust`)."""
from __future__ import annotations

import asyncio
import copy
import json
import threading
import time
from typing import Any, Callable

import bridge_loader
import test_wiskey_golden_vectors as gv

from smplwise.errors import ApiError
from smplwise.services import ha_client, intercom_sync

TEST_SECRET = gv.TEST_SECRET  # published test constant, never a real pairing secret
TEST_TRUST_KEY = "TEST-ONLY-bridge-trust-key-0001-NOT-A-REAL-SECRET"  # synthetic pairing key of the trust tests, never a real one
TRUST_SERVICES = ("trust_rotate", "trust_status")


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
        self.records: list[dict[str, Any]] = []
        self.calls: list[dict[str, Any]] = []  # every call: service, signed_message_json, parsed message, response
        self.other_calls: list[tuple[str, str]] = []
        self.trust: FakeTrustBridge | None = None  # CR-040: the trust services, when a test attaches them

    def attach_trust(self, trust: "FakeTrustBridge") -> "FakeTrustedBridge":
        self.trust = trust
        return self

    # ------------------------------------------------------------- what the add-on calls
    def call_service(self, settings: Any, domain: str, service: str, data: dict[str, Any], return_response: bool = False, timeout: float = 15.0) -> dict[str, Any]:
        if domain == "smplwise_bridge" and service in TRUST_SERVICES and self.trust is not None:
            return self.trust.call_service(settings, domain, service, data, return_response=return_response, timeout=timeout)
        if domain != "smplwise_bridge" or service not in ("door_open", "door_open_status"):
            self.other_calls.append((domain, service))
            raise AssertionError(f"FakeTrustedBridge: unexpected service {domain}.{service}")
        assert return_response is True, "door_open / door_open_status are always called with return_response"
        if self.unreachable:
            raise ApiError(503, "ha_unavailable", "תשתית המערכת אינה זמינה כרגע.", retryable=True, details={"error": "ConnectError"})
        response, effects = gv.reference_door_service(service, data, self.clock.now(), self._setup())
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
            self.calls.append({"service": service, "text": text, "answer": answer})
            return answer
        if self.clock_invalid:
            answer = {"result": "rejected", "stage": "time", "code": "clock_invalid"}
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
# ---------------------------------------------------------------- CR-040: the bridge's trust services

class FakeTrustStore:
    """The bridge's private trust store, in memory and durable across `FakeTrustBridge.restart()`. `fail_next_save` makes the next
    write raise (a full disk); `saves` counts the writes."""

    def __init__(self) -> None:
        self.data: Any = None
        self.fail_next_save = False
        self.saves = 0

    async def save(self, state: dict[str, Any]) -> None:
        if self.fail_next_save:
            self.fail_next_save = False
            raise OSError("disk full (test)")
        self.data = copy.deepcopy(state)
        self.saves += 1


class Crash(RuntimeError):
    """The add-on process dying in the middle of a call: an error nothing in the rotation path handles, so the request ends there."""


class FakeTrustBridge:
    """`smplwise_bridge.trust_rotate` / `trust_status` as bridge 0.9.1 answers them: the REAL trust core (trust.TrustRuntime, the
    shared signing.Verifier) with an in-memory durable store. Faults, one per call, queued per service (`fail_next`):
      `unreachable`   the connection is never made (ConnectError): nothing reaches the bridge
      `drop_before`   the bridge dies before its handler runs (the caller sees RemoteProtocolError); it restarts from its store
      `timeout_after` the bridge handles the call (persists, switches) and the caller sees a ReadTimeout
      `crash_after`   the bridge handles it and dies before answering (RemoteProtocolError); it restarts from its store
      `http_500`      Home Assistant answers 500 after the handler ran
      `garbage`       the answer is not one of the closed shapes
      `hold`          the call waits for `release()` (a slow bridge); `holding` is set while it waits
      `arx_crash_before` / `arx_crash_after`  the ADD-ON process dies before / after the bridge handled the call (raises Crash)
    `call_bridge_execute` verifies a device command with the same Verifier (so the old key is refused after a switch). Synthetic keys
    only; no Home Assistant, bridge, WisKey or door."""

    def __init__(self, entry_code: str = TEST_TRUST_KEY, *, entry_id: str = "entry-test", pairing_id: str = "legacy", clock: Callable[[], float] | None = None) -> None:
        self._trust = bridge_loader.load("trust")
        self._signing = bridge_loader.load("signing")
        self.entry_code, self.entry_id, self.pairing_id = entry_code, entry_id, pairing_id
        self.entry_epoch: int | None = None
        self.store = FakeTrustStore()
        self.clock = clock or time.time
        self.faults: dict[str, list[str]] = {s: [] for s in TRUST_SERVICES}
        self.calls: list[dict[str, Any]] = []  # service, signed text, answer (None when not handled), fault
        self.executed: list[dict[str, Any]] = []
        self.restarts = 0
        self._loop = asyncio.new_event_loop()
        self._lock = threading.Lock()
        self._release = threading.Event()
        self.holding = threading.Event()
        self.start()

    # ------------------------------------------------------------- life cycle (trust_service.async_setup_trust's reconcile)
    def start(self) -> None:
        stored = copy.deepcopy(self.store.data)
        state = self._trust.reconcile(stored, self.entry_id, self.pairing_id, self.entry_epoch)
        if state != stored:
            self.store.data = copy.deepcopy(state)
        self.verifier = self._signing.Verifier(self.entry_code)
        self.verifier.secret = self._trust.current_key(state, self.entry_code)
        self.runtime = self._trust.TrustRuntime(self.verifier, state, self.store.save, clock=self.clock, on_switch=self._mirror)

    def _mirror(self, key: str, epoch: int) -> None:
        self.entry_code, self.entry_epoch = key, epoch

    def restart(self) -> None:
        """Home Assistant restarts: the nonce cache is gone, the store and the (mirrored) config entry remain."""
        self.restarts += 1
        self.start()

    def re_pair(self, code: str, pairing_id: str = "re-paired") -> None:
        """The config flow accepted a DIFFERENT code (a new pairing id, epoch 1) and the entry reloads."""
        self.entry_code, self.pairing_id, self.entry_epoch = code, pairing_id, 1
        self.restart()

    @property
    def key(self) -> str:
        return self.verifier.secret

    @property
    def epoch(self) -> int:
        return self.runtime.epoch

    @property
    def ledger(self) -> dict[str, Any]:
        return self.runtime.state.get("ledger") or {}

    def fail_next(self, service: str, *faults: str) -> "FakeTrustBridge":
        self.faults[service].extend(faults)
        return self

    def release(self) -> None:
        self._release.set()

    def handle(self, service: str, text: str) -> dict[str, Any]:
        """Hand one signed text straight to the bridge (a replay, a late delivery) - no transport, no fault."""
        with self._lock:
            return self._loop.run_until_complete(self.runtime.handle(service, {"signed_message_json": text}))

    # ------------------------------------------------------------- what the add-on calls
    def call_service(self, settings: Any, domain: str, service: str, data: dict[str, Any], return_response: bool = False, timeout: float = 15.0) -> dict[str, Any]:
        if domain != "smplwise_bridge" or service not in TRUST_SERVICES:
            raise AssertionError(f"FakeTrustBridge: unexpected service {domain}.{service}")
        assert return_response is True, "the trust services are always called with return_response"
        fault = self.faults[service].pop(0) if self.faults[service] else None
        text = data.get("signed_message_json") if isinstance(data, dict) else None
        record: dict[str, Any] = {"service": service, "text": text, "answer": None, "fault": fault}
        self.calls.append(record)
        if fault == "unreachable":
            raise ApiError(503, "ha_unavailable", "תשתית המערכת אינה זמינה כרגע.", retryable=True, details={"error": "ConnectError"})
        if fault == "drop_before":
            self.restart()
            raise ApiError(503, "ha_unavailable", "תשתית המערכת אינה זמינה כרגע.", retryable=True, details={"error": "RemoteProtocolError"})
        if fault == "arx_crash_before":
            raise Crash("the add-on died before the request left")
        if fault == "hold":
            self.holding.set()
            assert self._release.wait(timeout=20), "the test never released the held call"
        with self._lock:
            answer = self._loop.run_until_complete(self.runtime.handle(service, copy.deepcopy(data)))
        record["answer"] = copy.deepcopy(answer)
        if fault == "timeout_after":
            raise ApiError(503, "ha_unavailable", "תשתית המערכת אינה זמינה כרגע.", retryable=True, details={"error": "ReadTimeout"})
        if fault == "crash_after":
            self.restart()
            raise ApiError(503, "ha_unavailable", "תשתית המערכת אינה זמינה כרגע.", retryable=True, details={"error": "RemoteProtocolError"})
        if fault == "arx_crash_after":
            raise Crash("the add-on died after the bridge handled the request")
        if fault == "http_500":
            raise ApiError(503, "ha_error", "תשתית המערכת החזירה שגיאה.", retryable=True, details={"status": 500})
        if fault == "garbage":
            return {"result": "rotated", "request_id": "not-this-request"}
        return copy.deepcopy(answer)

    def call_bridge_execute(self, settings: Any, payload: dict[str, Any], timeout: float = 15.0) -> dict[str, Any]:
        """`smplwise_bridge.execute`, verified with the one Verifier; nothing is executed (fakes only)."""
        reason = self.verifier.verify(dict(payload))
        self.executed.append({"request_id": payload.get("request_id"), "error": reason})
        if reason:
            return {"ok": False, "error": reason}
        return {"ok": True, "context_id": "ctx-test", "request_id": payload.get("request_id")}

    def push(self, **extra: Any) -> dict[str, Any]:
        """The 0.9.1 directory push, signed with the bridge's current key."""
        body = {"users": [], "version": "0.9.1", "delegated_authoring": False, "delegated_changed_at": None, "config_item": True,
                "trust_epoch": self.epoch, "trust_rotation": 1, **extra}
        return self._signing.sign(self.verifier.secret, body)

    def rotations(self) -> list[dict[str, Any]]:
        return [c for c in self.calls if c["service"] == "trust_rotate"]

    def statuses(self) -> list[dict[str, Any]]:
        return [c for c in self.calls if c["service"] == "trust_status"]

    def install(self, monkeypatch: Any) -> "FakeTrustBridge":
        monkeypatch.setattr(ha_client, "call_service", self.call_service)
        monkeypatch.setattr(ha_client, "call_bridge_execute", self.call_bridge_execute)
        monkeypatch.setattr(ha_client, "configured", lambda s: True)
        return self

    def close(self) -> None:
        self._release.set()
        self._loop.close()
