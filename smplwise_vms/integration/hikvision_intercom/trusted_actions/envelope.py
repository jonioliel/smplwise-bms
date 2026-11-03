"""Immutable draft3 descriptor and cross-field predicates, with no key material."""

from __future__ import annotations

import math
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from types import MappingProxyType
from typing import Any

from .validation import Refusal, Schema, aware, reference, strict_json
from .validation import resource as resource

CONTRACT = "wiskey-arx-generalized-w1-draft.3"
OFF_ACTIONS = frozenset(
    {
        "stations/technical_program_save",
        "stations/technical_program_action",
        "emergency/open",
        "emergency/secure",
        "emergency/release",
    }
)
CSV_ACTIONS = frozenset({"users/csv_inspect", "users/csv_export"})
_BOOTSTRAP = datetime(2026, 1, 1, tzinfo=UTC)
_FUTURE_SKEW = timedelta(seconds=2)
_ZERO = timedelta(0)
_REQUEST_TTL = timedelta(seconds=15)
_HEALTH_TTL = timedelta(seconds=30)


def freeze(value: Any) -> Any:
    if type(value) is dict:
        return MappingProxyType({k: freeze(v) for k, v in value.items()})
    if type(value) is list:
        return tuple(freeze(v) for v in value)
    if value is None or type(value) in (str, int, bool):
        return value
    if type(value) is float and math.isfinite(value):
        return value
    raise Refusal()


def freeze_parameters(value: Any) -> Any:
    """Own a public JSON tree; arbitrary mapping keys cannot carry aliases.

    This copies even caller-supplied mappingproxies. General internal freeze
    retains its separate typed-map behavior; request parameters have JSON keys.
    """
    kind = type(value)
    if value is None or kind in (str, int, bool):
        return value
    if kind in (list, tuple):
        return tuple(freeze_parameters(item) for item in value)
    if kind is dict or kind is MappingProxyType or isinstance(value, Mapping):
        result = {}
        for key, item in value.items():
            if type(key) is not str:
                raise Refusal("invalid_fields")
            result[key] = freeze_parameters(item)
        return MappingProxyType(result)
    return freeze(value)


def thaw(value: Any) -> Any:
    kind = type(value)
    if kind is dict or kind is MappingProxyType:
        return {k: thaw(v) for k, v in value.items()}
    if kind is tuple:
        return [thaw(v) for v in value]
    if value is None or kind in (str, int, float, bool):
        return value
    if isinstance(value, Mapping):
        return {k: thaw(v) for k, v in value.items()}
    return value


_VALIDATED_INPUT = object()


@dataclass(frozen=True, repr=False)
class _ValidatedInput:
    issuer: object
    descriptor: object
    issued: datetime
    expires: datetime
    decided: datetime
    binding_grant: object
    binding_schema: object


@dataclass(frozen=True, repr=False)
class Request:
    descriptor: Mapping
    _validated: object = None

    @classmethod
    def parse(cls, encoded: str | bytes, now: datetime, enabled_selections=frozenset({"rev1"})):
        value = strict_json(encoded)
        Schema.from_resource("GENERALIZED_W1_ENVELOPE.draft3.schema.json")(value)
        if value["contract_version"] != CONTRACT:
            raise Refusal("unknown_contract_version")
        if value["action"] in OFF_ACTIONS or value["selection_revision"] not in enabled_selections:
            raise Refusal("unknown_action")
        if value["action"] in CSV_ACTIONS and value["selection_revision"] != "rev2":
            raise Refusal()
        issued, expires, decided = map(
            aware,
            [value["issued_at"], value["request_expires_at"], value["decision"]["decided_at"]],
        )
        if now.tzinfo is None or not _ZERO < expires - issued <= _REQUEST_TTL:
            raise Refusal()
        if (
            expires <= now
            or (issued - now).total_seconds() > 2
            or not issued <= decided <= now + _FUTURE_SKEW
        ):
            raise Refusal()
        if not _BOOTSTRAP <= now:
            raise Refusal()
        grant, target, operation, decision = (
            value[k] for k in ["grant", "target", "operation", "decision"]
        )
        equalities = [
            (grant["decision_id"], decision["decision_id"]),
            (grant["grant_revision"], decision["grant_revision"]),
            (grant["permission_revision"], decision["permission_revision"]),
            (grant["permission_revision"], operation["permission_revision"]),
            (target["binding_revision"], decision["binding_revision"]),
            (value["selection_revision"], decision["selection_revision"]),
            (value["selection_revision"], operation["selection_revision"]),
        ]
        for key in ["request_id", "operation_id", "operation_binding_ref"]:
            equalities.append((value[key], decision[key]))
        for key in ["request_schema_id", "request_schema_revision"]:
            equalities.append((operation[key], decision[key]))
        if value["actor"]["kind"] == "automation":
            equalities.append((value["actor"]["grant_revision"], grant["grant_revision"]))
        if any(a != b or type(a) is not type(b) for a, b in equalities):
            raise Refusal("binding_denied")
        for box in [value, target, grant, operation, decision, value["actor"]]:
            for item in box.values():
                if type(item) is str:
                    reference(
                        item
                    )  # All descriptor strings are bounded public references/version/time labels.
        descriptor = freeze(value)
        # Deterministic views of this immutable descriptor's binding metadata,
        # never a live authorization decision or a source/action result.
        binding_grant = freeze(
            {k: grant[k] for k in ("grant_id", "grant_revision", "permission_revision")}
        )
        binding_schema = freeze(
            {
                **{
                    k: operation[k]
                    for k in (
                        "request_schema_id",
                        "request_schema_revision",
                        "parameter_transport",
                        "public_descriptor_revision",
                    )
                },
                "definition_revision": operation.get("definition_revision"),
                "operation_scope": value.get("operation_scope"),
            }
        )
        return cls(
            descriptor,
            _ValidatedInput(
                _VALIDATED_INPUT,
                descriptor,
                issued,
                expires,
                decided,
                binding_grant,
                binding_schema,
            ),
        )

    def get(self, key: str) -> Any:
        # Metadata/refusal reporting always uses the original validated input,
        # never a descriptor a faulty in-process callback replaced afterwards.
        seal = self._validated
        if type(seal) is not _ValidatedInput or seal.issuer is not _VALIDATED_INPUT:
            raise Refusal("binding_denied")
        return seal.descriptor[key]

    def binding_parts(self):
        """Read-only identity parts; permission/time guards still run afresh."""
        seal = self._validated
        if (
            type(seal) is not _ValidatedInput
            or seal.issuer is not _VALIDATED_INPUT
            or self.descriptor is not seal.descriptor
        ):
            raise Refusal("binding_denied")
        return seal.binding_grant, seal.binding_schema

    def recheck(self, now: datetime, enabled_selections: frozenset[str]) -> None:
        self.check_time(now)
        if (
            self.get("action") in OFF_ACTIONS
            or self.get("selection_revision") not in enabled_selections
        ):
            raise Refusal("unknown_action")
        if self.get("action") in CSV_ACTIONS and self.get("selection_revision") != "rev2":
            raise Refusal("binding_denied")

    def check_time(self, now: datetime) -> None:
        """Freshness of an already parsed immutable descriptor across awaits."""
        seal = self._validated
        if (
            type(seal) is not _ValidatedInput
            or seal.issuer is not _VALIDATED_INPUT
            or self.descriptor is not seal.descriptor
        ):
            raise Refusal("binding_denied")
        issued, expires, decided = seal.issued, seal.expires, seal.decided
        if now.tzinfo is None or now < _BOOTSTRAP or not _ZERO < expires - issued <= _REQUEST_TTL:
            raise Refusal("binding_denied")
        if (
            now >= expires
            or issued > now + _FUTURE_SKEW
            or not issued <= decided <= now + _FUTURE_SKEW
        ):
            raise Refusal("binding_denied")


@dataclass(frozen=True)
class ClockSample:
    now: datetime
    health_observed: datetime
    synchronized: bool

    def check(self):
        if (
            self.now.tzinfo is None
            or self.health_observed.tzinfo is None
            or self.synchronized is not True
        ):
            raise Refusal()
        if not _ZERO <= self.now - self.health_observed <= _HEALTH_TTL:
            raise Refusal()
        if self.now < _BOOTSTRAP:
            raise Refusal()
