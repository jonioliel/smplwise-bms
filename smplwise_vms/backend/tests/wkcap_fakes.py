"""WKCAP-295 fakes: a `WiskeyDirectPort` that plays the WisKey side of the round-4 contracts (FAKES ONLY - nothing here talks to a network, a station or a door).

`FakeDirectPort` records every call as (command, parameters) and answers from small scripted behaviours:
- capture: forwards `capture/lease_event` / `capture/lease_request` to the existing `FakeLeaseBridge` (tests/fake_trusted_bridge.py) with the ORIGINAL signed text;
- features: a closed `features/start|result|cancel|status|prepare_media` host with an EmergencyEventLedger-like model for `wiskey-emergency-event.v2`
  (retry_of must name an UNKNOWN parent of the same event; a LIVE parent is refused; a release makes a later hold `superseded`);
- whatsapp: returns whatever the test queued.
The synthetic authority is labelled: the policy snapshot is only checked for its closed shape and its binding to the request (as WisKey's parse_snapshot does)."""
from __future__ import annotations

import copy
from typing import Any, Mapping

from smplwise.errors import ApiError
from smplwise.services.wiskey_capture_port import PortError, PortIdentity

REPO = "11111111-2222-4333-8444-555555555555"
IDENTITY = PortIdentity(entry_id="entry-pairing-1", query_owner_id="a" * 32, repository_id=REPO, connection_ref="c" * 32)

# WisKey access/arx_policy_snapshot.py FIELDS (ROUND4_CONTRACTS.json policy_snapshot_v1.closed_fields)
SNAPSHOT_FIELDS = {"schema_version", "repository_id", "bridge_owner", "source_epoch", "authority_ref", "authority_revision", "scope_ref", "actor", "actor_session_active",
                   "issued_at", "expires_at", "active", "complete", "permissions", "grant_ids", "stations", "rows", "private_input"}
STATION_GRANT_FIELDS = {"grant_id", "station_id", "api_relay", "physical_relay", "mapping_revision"}
ROW_GRANT_FIELDS = {"grant_id", "source_line", "user_id", "revision", "origin_ref", "change_digest"}
EMERGENCY_V2_FIELDS = {"kind", "event_ref", "command", "trigger", "retry_of"}


class FakeDirectPort:
    def __init__(self, bridge: Any = None) -> None:
        self.bridge = bridge  # an existing FakeLeaseBridge for the capture commands
        self.calls: list[tuple[str, Any]] = []
        self.headers_signed: list[tuple[str, str]] = []
        self.opened: list[tuple[str, dict[str, str]]] = []
        self.connected = True
        self.on_call: Any = None  # hook(command, params) - e.g. to read the database at the moment of the call
        self.queue: dict[str, list[Any]] = {}  # command -> answers (a PortError instance is raised)
        # features host
        self.ops: dict[str, dict[str, Any]] = {}
        self.start_script: list[str] = []  # per features/start: ok | ack_loss | refuse:<code> | not_sent | timeout
        self.result_mode = "finished"  # finished | running | unknown | lost | refused
        self.result_outcome = "acknowledged"
        self.n = 0
        self.by_operation: dict[str, str] = {}

    # -- the port ----------------------------------------------------------------------------------------------------------------------
    def identity(self) -> PortIdentity:
        if not self.connected:
            raise PortError("wiskey_direct_not_connected", "not_sent")
        return IDENTITY

    def media_ingress_header(self, *, ticket: str, preparation_ref: str) -> str:
        self.headers_signed.append((ticket, preparation_ref))
        return '{"command":"features/media_ingress_v1","sig":"x"}'

    def open_media(self, *, path: str, headers: Mapping[str, str], timeout_s: float) -> Any:
        self.opened.append((path, dict(headers)))
        return "media-socket"

    def call(self, command: str, parameters: Mapping[str, Any], *, timeout_s: float) -> Mapping[str, Any]:
        self.calls.append((command, copy.deepcopy(dict(parameters))))
        if self.on_call is not None:
            self.on_call(command, parameters)
        if not self.connected:
            raise PortError("wiskey_direct_not_connected", "not_sent")
        queued = self.queue.get(command)
        if queued:
            nxt = queued.pop(0)
            if isinstance(nxt, BaseException):
                raise nxt
            return nxt
        if command in ("capture/lease_event", "capture/lease_request"):
            return self._capture(command, parameters)
        handler = {"features/start": self._start, "features/prepare_media": self._prepare_media, "features/result": self._result, "features/cancel": self._cancel,
                   "features/status": lambda p: {"schema_version": 1, "features": {}}}.get(command)
        if handler is None:
            raise PortError("unknown_command", "refused")
        return handler(parameters)

    def sent(self, command: str) -> list[Any]:
        return [p for c, p in self.calls if c == command]

    # -- capture -----------------------------------------------------------------------------------------------------------------------
    def _capture(self, command: str, params: Mapping[str, Any]) -> Mapping[str, Any]:
        assert set(params) == {"signed_message_json"}
        service = "lease_event" if command == "capture/lease_event" else "lease_request"
        try:
            return self.bridge._handle(service, params["signed_message_json"])
        except ApiError as exc:
            if exc.details.get("error") == "ConnectError":
                raise PortError("wiskey_direct_not_connected", "not_sent") from None
            raise PortError("capture_outcome_unknown", "unknown") from None

    # -- features ------------------------------------------------------------------------------------------------------------------------
    def _check_binding(self, params: Mapping[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
        if not {"request", "policy_snapshot"} <= set(params) or set(params) - {"request", "policy_snapshot", "subscription"}:
            raise PortError("invalid_fields", "refused")
        req, snap = params["request"], params["policy_snapshot"]
        if set(snap) != SNAPSHOT_FIELDS or snap["schema_version"] != 1 or snap["complete"] is not True:
            raise PortError("invalid_policy_snapshot", "refused")
        if snap["repository_id"] != REPO or snap["bridge_owner"] != {"entry_id": IDENTITY.entry_id, "query_owner_id": IDENTITY.query_owner_id}:
            raise PortError("policy_binding_denied", "refused")
        if any(snap[k] != req[k] for k in ("authority_ref", "authority_revision", "scope_ref")) or snap["actor"] != req["actor"]:
            raise PortError("policy_binding_denied", "refused")
        if req["actor"]["kind"] == "human" and snap["actor_session_active"] is not True:
            raise PortError("policy_binding_denied", "refused")
        used = [s["grant_id"] for s in snap["stations"]] + [r["grant_id"] for r in snap["rows"]]
        if set(used) != set(snap["grant_ids"]) or len(set(used)) != len(used):
            raise PortError("invalid_policy_snapshot", "refused")
        if any(set(s) != STATION_GRANT_FIELDS for s in snap["stations"]) or any(set(r) != ROW_GRANT_FIELDS for r in snap["rows"]):
            raise PortError("invalid_policy_snapshot", "refused")
        if snap["expires_at"] < req["execution_expires_at"].replace("Z", "") and False:
            raise PortError("policy_expired", "refused")
        return req, snap

    def _start(self, params: Mapping[str, Any]) -> Mapping[str, Any]:
        mode = self.start_script.pop(0) if self.start_script else "ok"
        if mode == "not_sent":
            raise PortError("wiskey_direct_not_connected", "not_sent")
        if mode.startswith("refuse:"):
            raise PortError(mode.split(":", 1)[1], "refused")
        req, snap = self._check_binding(params)
        self.n += 1
        op = f"op-{self.n}"
        private = snap["private_input"]
        record: dict[str, Any] = {"request": copy.deepcopy(req), "private": copy.deepcopy(private), "phase": "attempted", "outcome": "acknowledged"}
        if req["feature"] == "emergency_buttons":
            self._emergency_admit(op, req, private, record)
        self.ops[op] = record
        self.by_operation[req["operation_id"]] = op
        if mode == "ack_loss":
            record["phase"] = "unknown"  # the ACK was lost AND the original task is gone (crash window): a new attempt may follow
        if mode in ("ack_loss", "timeout"):
            # the host admitted and ran it; the caller never sees the reply
            raise PortError("timeout", "unknown")
        return {"schema_version": 1, "operation_ref": op, "state": "admitted", "execution_result": "pending", "replay_available": False}

    def _emergency_admit(self, op: str, req: dict[str, Any], private: Any, record: dict[str, Any]) -> None:
        if not isinstance(private, dict) or set(private) != EMERGENCY_V2_FIELDS or private["kind"] != "wiskey-emergency-event.v2":
            raise PortError("invalid_emergency_event", "refused")
        if private["command"] not in ("hold_open", "release") or private["trigger"] not in ("manual", "fire"):
            raise PortError("invalid_emergency_event", "refused")
        if (private["trigger"] == "fire") != (req["actor"]["kind"] == "automation"):
            raise PortError("Unauthorized", "refused")
        event = private["event_ref"]
        if private["retry_of"] is not None:
            if private["command"] != "hold_open":
                raise PortError("invalid_emergency_event", "refused")
            parent = self.ops.get(self.by_operation.get(private["retry_of"], ""))
            if parent is None or parent["private"]["event_ref"] != event or parent["private"]["command"] != "hold_open":
                raise PortError("retry_parent_invalid", "refused")
            if parent["phase"] != "unknown":
                raise PortError("retry_parent_live", "refused")  # a still-live attempted operation is denied as a retry parent
            if req["operation_id"] == parent["request"]["operation_id"] or req["request_id"] == parent["request"]["request_id"]:
                raise PortError("retry_requires_new_request", "refused")
        record["event"] = event
        released = any(o["private"]["event_ref"] == event and o["private"]["command"] == "release" for o in self.ops.values() if o.get("private"))
        if private["command"] == "hold_open" and released:
            record["outcome"] = "superseded"
        record["request_ids"] = req["request_id"]

    def mark_unknown(self, op: str) -> None:
        """A crash window: the operation has no live task and no completion."""
        self.ops[op]["phase"] = "unknown"

    def _result(self, params: Mapping[str, Any]) -> Mapping[str, Any]:
        op = params["operation_ref"]
        if self.result_mode == "lost":
            raise PortError("timeout", "unknown")
        if self.result_mode == "refused":
            raise PortError("binding_denied", "refused")
        rec = self.ops.get(op)
        if rec is None:
            raise PortError("operation_not_found", "refused")
        if self.result_mode == "running":
            return {"schema_version": 1, "operation_ref": op, "state": "running"}
        if self.result_mode == "unknown":
            rec["phase"] = "unknown"
            return {"schema_version": 1, "operation_ref": op, "state": "unknown", "replay_available": False}
        outcome = rec["outcome"] if self.result_outcome == "acknowledged" else self.result_outcome
        rec["phase"] = outcome
        private = rec["private"] or {}
        receipt = {"kind": private.get("kind"), "trigger": private.get("trigger"), "retry_of": private.get("retry_of"), "automatic_fire_supported": True,
                   "deployment_auto_state": "not_changed", "original": {}, "event_ref": private.get("event_ref"), "command": private.get("command"), "duplicate": False,
                   "targets": [{"target": {"station_id": rec["request"]["params"].get("station_id")}, "phase": outcome, "outcome": outcome, "duplicate": False,
                                "prior_attempt": None, "physical_result": "unknown"}],
                   "hold_policy": "until_matching_release", "dedup_retention": "durable_no_automatic_eviction", "physical_result": "unknown", "atomic_all": False,
                   "replay_available": False}
        return {"schema_version": 1, "operation_ref": op, "state": "finished", "receipt": receipt, "replay_available": False}

    def _cancel(self, params: Mapping[str, Any]) -> Mapping[str, Any]:
        return {"schema_version": 1, "operation_ref": params["operation_ref"], "state": "cleanup_joined", "replay_available": False}

    def _prepare_media(self, params: Mapping[str, Any]) -> Mapping[str, Any]:
        self._check_binding(params)
        self.n += 1
        return {"schema_version": 1, "state": "prepared", "preparation_ref": f"prep-{self.n}", "operation_ref": None, "expires_at": "2026-10-24T12:00:30Z",
                "ingress": [{"step_id": "video-1", "url": "/api/hikvision_intercom/arx_bridge/v1/media/" + "ab" * 24}], "replay_available": False}
