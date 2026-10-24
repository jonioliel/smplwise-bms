"""WKWRITE-295 test double: a FAKE WisKey people-write producer behind the WiskeyCommandPort.

It follows the published contracts (NATIVE_WRITE_V1.md, ROUND4_CONTRACTS.json, the command catalog slice in
fixtures/wiskey_round4/people_command_catalog.json) and mirrors the producer checks read in WisKey source CODE d2579588
(`native_peer_write_api.NativePeerWriteSource.stage`, `access/native_peer_storage.attach/find`, `name_reference_api`,
`bulk_operations.receipt`). It is NOT WisKey and proves nothing about an installed WisKey; it exists so Arx's writer can be driven
through every outcome, including faults and crashes.

State can be saved to / loaded from a JSON file (`state_path`) so a fake survives a real child-process exit in the crash tests.
"""
from __future__ import annotations

import copy
import json
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Mapping

from smplwise.services.wiskey_command_port import NOT_SENT, REFUSED, UNKNOWN, WiskeyCommandError

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "wiskey_round4"
CATALOG = json.loads((FIXTURES / "people_command_catalog.json").read_text(encoding="utf-8"))["commands"]
W1_SCHEMA = json.loads((FIXTURES / "GENERALIZED_W1_ENVELOPE.draft3.schema.json").read_text(encoding="utf-8"))
CONTRACT = "wiskey-native-bridge-write.v1"
ACTIONS = sorted({"users/create", "users/update", "users/set_active", "users/archive", "users/unarchive", "users/temporary_cancel",
                  "users/delete", "cards/add", "cards/remove"})
REF = re.compile(r"[^\x00-\x1f\x7f]{1,128}")


class SimulatedKill(BaseException):
    """An in-process stand-in for the Arx process dying at a chosen step (not an Exception: no handler in the writer catches it)."""


def refused(code: str) -> WiskeyCommandError:
    return WiskeyCommandError(code, outcome=REFUSED)


def _canonical(v: Any) -> str:
    return json.dumps(v, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def _closed(obj: Any, schema: Mapping[str, Any], where: str) -> None:
    """required <= keys <= properties for one JSON-schema object level (the subset the W1 envelope needs)."""
    if not isinstance(obj, dict):
        raise refused("invalid_fields")
    props, req = set(schema.get("properties", {})), set(schema.get("required", []))
    if not req <= set(obj) or (schema.get("additionalProperties") is False and not set(obj) <= props):
        raise refused("invalid_fields")


class FakeWisKey:
    def __init__(self, state_path: Path | None = None) -> None:
        self.state_path = state_path
        self.faults: dict[str, list[str]] = {}
        self.sent: list[tuple[str, dict[str, Any]]] = []  # the WisKey side's own view of what arrived (signed inputs)
        self.on_step: Any = None  # hook(step) for real-process crash tests
        if state_path is not None and state_path.exists():
            self.s = json.loads(state_path.read_text(encoding="utf-8"))
        else:
            self.s = {"repository_id": str(uuid.uuid4()), "entry": "entry-1", "descriptor_epoch": uuid.uuid4().hex, "users": {},
                      "receipts": {}, "name_receipts": {}, "carriers": {}, "write_revision": 1, "counter": 0}

    # ---------------------------------------------------------------- persistence (crash tests)

    def save(self) -> None:
        if self.state_path is None:
            return
        tmp = self.state_path.with_suffix(".tmp")
        with open(tmp, "w", encoding="utf-8") as fh:
            fh.write(json.dumps(self.s))
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, self.state_path)

    # ---------------------------------------------------------------- identities

    @property
    def subject(self) -> str:
        return "arx-service:" + self.s["entry"]

    @property
    def verified_peer_ref(self) -> str:
        return "smplwise_bridge:" + self.s["entry"]

    @property
    def write_ref(self) -> str:
        return "arx-write:" + self.s["entry"] + ":" + self.subject

    def source(self) -> dict[str, Any]:
        return {"schema_version": 1, "contract": CONTRACT, "repository_id": self.s["repository_id"], "verified_peer_ref": self.verified_peer_ref,
                "peer_binding_ref": self.write_ref, "peer_binding_revision": self.s["write_revision"], "query_owner_id": self.subject,
                "descriptor_epoch": self.s["descriptor_epoch"], "commands": ACTIONS, "request_schema_prefix": "urn:wiskey:native-bridge:",
                "request_schema_revision": "1", "delete_person_revision": "last_native_revision", "replay_available": False}

    def seed_user(self, uid: str, revision: int = 3, **fields: Any) -> None:
        self.s["users"][uid] = {"revision": revision, "display_name": "seed", "cards": [], **fields}

    # ---------------------------------------------------------------- the port

    def _fault(self, command: str) -> str | None:
        queue = self.faults.get(command)
        return queue.pop(0) if queue else None

    async def send_signed(self, command: str, parameters: Mapping[str, Any], *, operation_id: str | None) -> Mapping[str, Any]:
        fault = self._fault(command)
        if fault == "not_sent":
            raise WiskeyCommandError("not_connected", outcome=NOT_SENT)
        if fault == "kill_before_arrival":
            raise SimulatedKill(command)
        params = copy.deepcopy(dict(parameters))
        self.sent.append((command, params))
        if fault == "lost_before_commit":
            raise WiskeyCommandError("timeout", outcome=UNKNOWN)
        if fault and fault.startswith("refuse:"):
            raise refused(fault.split(":", 1)[1])
        spec = CATALOG.get(command)
        if spec is None:
            raise refused("unknown_command")
        handler = {"peer_writes/source_v1": self._source, "peer_bindings/get": self._read_binding, "peer_receipts/resolve": self._resolve,
                   "users/name_ref_prepare_v1": self._prepare, "users/name_ref_apply_v1": self._apply,
                   "users/bulk_receipt": self._bulk_receipt}.get(command, self._native_write)
        result = handler(command, params, spec)
        if fault in ("commit_then_lose_ack", "kill_after_commit", "exit_after_commit"):
            self.save()
            if fault == "kill_after_commit":
                raise SimulatedKill(command)
            if fault == "exit_after_commit" and self.on_step is not None:
                self.on_step("after_commit")
            raise WiskeyCommandError("timeout", outcome=UNKNOWN)
        self.save()
        return result

    # ---------------------------------------------------------------- handlers

    def _check_params(self, params: dict[str, Any], spec: Mapping[str, Any]) -> None:
        schema = spec["parameters_schema"]
        if "oneOf" in schema:
            return
        _closed(params, schema, "parameters")

    def _source(self, command: str, params: dict[str, Any], spec: Mapping[str, Any]) -> dict[str, Any]:
        if params != {}:
            raise refused("invalid_fields")
        return self.source()

    def _read_binding(self, command: str, params: dict[str, Any], spec: Mapping[str, Any]) -> dict[str, Any]:
        if params != {"initialize": True, "expected_revision": 0}:
            raise refused("invalid_fields")
        return {"schema_version": 1, "protocol": "wiskey-peer-binding-draft1", "verified_peer_ref": self.verified_peer_ref,
                "peer_binding_ref": "bridge:" + self.s["entry"] + ":" + self.subject, "peer_binding_revision": 1,
                "query_owner_id": self.subject, "repository_id": self.s["repository_id"], "allowed_read_scope": "central_capture_person_commit",
                "state": "active", "active": True, "historical_read": True, "successor": None}

    def _stage(self, command: str, params: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
        """NativePeerWriteSource.stage, as read at d2579588."""
        meta = params.get("peer_write")
        if not isinstance(meta, dict) or set(meta) != {"schema_version", "descriptor_epoch", "peer_binding_ref", "peer_binding_revision",
                                                       "descriptor", "actor_session_active", "create_origin_ref"}:
            raise refused("invalid_fields")
        if type(meta["schema_version"]) is not int or meta["schema_version"] != 1 or type(meta["peer_binding_revision"]) is not int \
                or type(meta["actor_session_active"]) is not bool:
            raise refused("invalid_fields")
        if meta["peer_binding_ref"] != self.write_ref:
            raise refused("native_write_source_not_observed")
        if meta["descriptor_epoch"] != self.s["descriptor_epoch"] or meta["peer_binding_revision"] != self.s["write_revision"]:
            raise refused("binding_denied")
        d = meta["descriptor"]
        self._parse_request(d)
        origin = meta["create_origin_ref"]
        target = origin if command == "users/create" else params.get("user_id")
        op = d["operation"]
        if (d["action"] != command or not isinstance(params.get("actor"), dict) or params["actor"].get("id") != d["actor"]["user_id"]
                or meta["actor_session_active"] is not True or d["target"]["logical_target_id"] != target
                or d["target"]["binding_revision"] != self.s["write_revision"]
                or op["request_schema_id"] != "urn:wiskey:native-bridge:" + command.replace("/", ":") or op["request_schema_revision"] != "1"
                or op["parameter_transport"] != "agreed_sensitive_opaque_reference" or (command != "users/create" and origin is not None)):
            raise refused("binding_denied")
        if command == "users/create" and (not isinstance(origin, str) or not REF.fullmatch(origin)):
            raise refused("invalid_fields")
        original = {"repository_id": self.s["repository_id"], "verified_peer_ref": self.verified_peer_ref, "peer_binding_ref": self.write_ref,
                    "peer_binding_revision": self.s["write_revision"], "query_owner_id": self.subject,
                    "descriptor_epoch": self.s["descriptor_epoch"], "original": copy.deepcopy(d)}
        return meta, original

    def _parse_request(self, d: Any) -> None:
        """The structural part of trusted_actions.envelope.Request.parse (closed levels, TTL, cross-field equalities)."""
        _closed(d, W1_SCHEMA, "descriptor")
        props = W1_SCHEMA["properties"]
        for key in ("target", "grant", "operation", "decision"):
            _closed(d[key], props[key], key)
        _closed(d["actor"], props["actor"]["oneOf"][0], "actor")
        if d["contract_version"] != "wiskey-arx-generalized-w1-draft.3" or d["selection_revision"] != "rev1":
            raise refused("unknown_contract_version")
        issued, expires, decided = (datetime.fromisoformat(x) for x in (d["issued_at"], d["request_expires_at"], d["decision"]["decided_at"]))
        now = datetime.now(timezone.utc)
        if (not 0 < (expires - issued).total_seconds() <= 15 or expires <= now or (issued - now).total_seconds() > 2
                or not issued <= decided <= now + timedelta(seconds=2)):
            raise refused("binding_denied")
        g, t, o, c = d["grant"], d["target"], d["operation"], d["decision"]
        pairs = [(g["decision_id"], c["decision_id"]), (g["grant_revision"], c["grant_revision"]),
                 (g["permission_revision"], c["permission_revision"]), (g["permission_revision"], o["permission_revision"]),
                 (t["binding_revision"], c["binding_revision"]), (d["selection_revision"], c["selection_revision"]),
                 (d["selection_revision"], o["selection_revision"])]
        pairs += [(d[k], c[k]) for k in ("request_id", "operation_id", "operation_binding_ref")]
        pairs += [(o[k], c[k]) for k in ("request_schema_id", "request_schema_revision")]
        if any(a != b or type(a) is not type(b) for a, b in pairs):
            raise refused("binding_denied")

    def _native_write(self, command: str, params: dict[str, Any], spec: Mapping[str, Any]) -> dict[str, Any]:
        self._check_params(params, spec)
        meta, original = self._stage(command, params)
        d = meta["descriptor"]
        peer = self.verified_peer_ref
        for old in self.s["receipts"].get(peer, {}).values():
            if old["original"]["operation_id"] == d["operation_id"] or old["original"]["request_id"] == d["request_id"]:
                raise refused("original_already_committed")
            if meta["create_origin_ref"] is not None and old["create_origin_ref"] == meta["create_origin_ref"]:
                raise refused("original_create_already_committed")
        users = self.s["users"]
        if command == "users/create":
            self.s["counter"] += 1
            uid = f"u-{self.s['counter']}"
            users[uid] = {"revision": 1, **copy.deepcopy(params["data"])}
            person_revision, result = 1, {"id": uid, "revision": 1}
        else:
            uid = params["user_id"]
            if uid not in users:
                raise refused("user_not_found")
            if users[uid]["revision"] != params["revision"]:
                raise refused("revision_conflict")
            if command == "users/delete":
                person_revision = users.pop(uid)["revision"]  # the LAST actual revision, never a successor
                result = None
            else:
                users[uid]["revision"] += 1
                if command == "cards/add":
                    users[uid].setdefault("cards", []).append(copy.deepcopy(params["data"]))
                elif "data" in params:
                    users[uid].update(copy.deepcopy(params["data"]))
                person_revision, result = users[uid]["revision"], {"id": uid, "revision": users[uid]["revision"]}
        receipt = {"schema": "wiskey-native-peer-source.v2", **original, "source_epoch": self.s["descriptor_epoch"],
                   "create_origin_ref": meta["create_origin_ref"], "capture_original": None, "user_id": uid, "person_revision": person_revision,
                   "central_state": "committed", "device_application": "unknown", "signed_capture_covered": False}
        self.s["receipts"].setdefault(peer, {})[d["operation_id"]] = receipt
        return {"schema_version": 1, "contract": CONTRACT, "result": result, "receipt": copy.deepcopy(receipt), "replay_available": False}

    def _resolve(self, command: str, params: dict[str, Any], spec: Mapping[str, Any]) -> dict[str, Any]:
        self._check_params(params, spec)
        if (params["peer_binding_ref"], params["peer_binding_revision"]) != ("bridge:" + self.s["entry"] + ":" + self.subject, 1):
            raise refused("binding_denied")
        original = params["original"]
        if not isinstance(original, dict) or set(original) != {"repository_id", "verified_peer_ref", "peer_binding_ref", "peer_binding_revision",
                                                               "query_owner_id", "descriptor_epoch", "original"}:
            raise refused("invalid_fields")
        if original["query_owner_id"] != self.subject or original["repository_id"] != self.s["repository_id"]:
            raise refused("binding_denied")
        row = self.s["receipts"].get(original["verified_peer_ref"], {}).get(original["original"].get("operation_id"))
        if row is None:
            return {"schema_version": 1, "state": "unknown", "receipt": None}
        if any(_canonical(row[k]) != _canonical(v) for k, v in original.items()):
            raise refused("original_reference_mismatch")
        return {"schema_version": 1, "state": "found", "receipt": copy.deepcopy(row)}

    def _prepare(self, command: str, params: dict[str, Any], spec: Mapping[str, Any]) -> dict[str, Any]:
        self._check_params(params, spec)
        person = self.s["users"].get(params["person_ref"])
        if person is None:
            raise refused("user_not_found")
        if person["revision"] != params["expected_person_revision"]:
            raise refused("revision_conflict")
        if params["operation_id"] in self.s["name_receipts"]:
            raise refused("name_ref_consumed")
        ref = uuid.uuid4().hex
        self.s["carriers"][ref] = {"bindings": {k: params[k] for k in ("person_ref", "expected_person_revision", "request_id", "operation_id")},
                                   "value": params["display_name"], "state": "prepared"}
        return {"name_ref": ref, "expires_at": datetime.now(timezone.utc).isoformat()}

    def _apply(self, command: str, params: dict[str, Any], spec: Mapping[str, Any]) -> dict[str, Any]:
        self._check_params(params, spec)
        row = self.s["carriers"].get(params["name_ref"])
        if row is None:
            raise refused("name_ref_unknown")
        bindings = {k: params[k] for k in ("person_ref", "expected_person_revision", "request_id", "operation_id")}
        if bindings != row["bindings"]:
            raise refused("Unauthorized")
        if row["state"] != "prepared":
            raise refused("name_ref_consumed")
        row["state"], value, row["value"] = "applying", row["value"], None
        person = self.s["users"][params["person_ref"]]
        if person["revision"] != params["expected_person_revision"]:
            raise refused("revision_conflict")
        person["revision"] += 1
        person["display_name"] = value
        self.s["name_receipts"][params["operation_id"]] = {
            "schema": "wiskey-name-ref-receipt.v1", **bindings, "name_ref": params["name_ref"], "actor": "arx:" + self.s["entry"] + ":" + self.subject,
            "source_epoch": self.s["descriptor_epoch"], "saved_at": datetime.now(timezone.utc).isoformat(), "action": "users/name_ref_apply_v1",
            "person_revision": person["revision"], "changed": 1, "user_ids": [params["person_ref"]], "stations": []}
        row["state"] = "committed"
        return {"person_ref": params["person_ref"], "person_revision": person["revision"], "operation_id": params["operation_id"],
                "state": "committed"}

    def _bulk_receipt(self, command: str, params: dict[str, Any], spec: Mapping[str, Any]) -> dict[str, Any]:
        self._check_params(params, spec)
        if "actor" in params:
            raise refused("operation_not_found")  # another actor (arx:<id>) never sees the pairing principal's receipt
        r = self.s["name_receipts"].get(params["operation_id"])
        if r is None:
            raise refused("operation_not_found")
        return copy.deepcopy(r)
