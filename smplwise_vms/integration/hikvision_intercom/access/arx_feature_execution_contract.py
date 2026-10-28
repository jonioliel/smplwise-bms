"""Additive execution-intent contract; no W1/door/capture DTO is reinterpreted.

The six feature build switches are enabled. This distinct feature protocol
still requires its authenticated runtime binding. Transport verification and current Arx authority
remain mandatory; metadata, a dry plan or a local principal does not grant them.
"""

from __future__ import annotations

import weakref
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from .. import arx_preview_features as features
from ..trusted_actions.envelope import freeze
from ..trusted_actions.peer_boundary import PeerBoundary, PeerMessage, counter
from ..trusted_actions.validation import Refusal, aware, reference, strict_json
from .arx_feature_intents import absolute_time
from .arx_feature_plans import REQUIREMENTS, plan
from .models import AccessError

CONTRACT = "wiskey-arx-feature-execution.v1"
FEATURE_FIELDS = frozenset(
    {
        "contract_version",
        "feature",
        "request_id",
        "operation_id",
        "operation_binding_ref",
        "actor",
        "authority_ref",
        "authority_revision",
        "scope_ref",
        "parameter_reference",
        "issued_at",
        "request_expires_at",
        "execution_expires_at",
        "params",
    }
)
_ISSUER = object()
_BRIDGE_SOURCES = weakref.WeakKeyDictionary()


@dataclass(frozen=True, repr=False)
class _FeatureInput:
    issuer: object
    descriptor: object
    parameters: object
    execution_end: datetime
    gate_owner: dict
    observed: list
    stopped: list


@dataclass(frozen=True, repr=False)
class FeatureRequest:
    descriptor: Any
    parameters: Any
    _validated: _FeatureInput

    @classmethod
    def parse(cls, encoded: str, now: datetime) -> FeatureRequest:
        value = strict_json(encoded, limit=16384)
        if type(value) is not dict or set(value) != FEATURE_FIELDS:
            raise Refusal("invalid_fields")
        if value["contract_version"] != CONTRACT:
            raise Refusal("unknown_contract_version")
        feature = value["feature"]
        if type(feature) is not str or feature not in REQUIREMENTS:
            raise Refusal("unknown_action")
        if features.PLAN_FLAGS.get(feature) is not True:
            raise Refusal("feature_disabled")
        for name in (
            "request_id",
            "operation_id",
            "operation_binding_ref",
            "authority_ref",
            "scope_ref",
            "parameter_reference",
        ):
            reference(value[name])
        try:
            if str(UUID(value["request_id"])) != value["request_id"]:
                raise ValueError
        except (ValueError, TypeError, AttributeError):
            raise Refusal("invalid_fields") from None
        counter(value["authority_revision"])
        actor = value["actor"]
        if type(actor) is not dict:
            raise Refusal("invalid_fields")
        if actor.get("kind") == "human":
            if set(actor) != {"kind", "user_id"}:
                raise Refusal("invalid_fields")
            reference(actor["user_id"])
        elif actor.get("kind") == "automation":
            if set(actor) != {
                "kind",
                "automation_id",
                "run_id",
                "trigger_id",
                "creator_user_id",
                "approver_user_id",
                "grant_revision",
            }:
                raise Refusal("invalid_fields")
            for key in set(actor) - {"kind", "grant_revision"}:
                reference(actor[key])
            if counter(actor["grant_revision"]) != value["authority_revision"]:
                raise Refusal("binding_denied")
        else:
            raise Refusal("Unauthorized")
        if (
            feature == "door_automations"
            and actor["kind"] != "automation"
            or actor["kind"] == "automation"
            and feature not in {"door_automations", "emergency_buttons"}
        ):
            raise Refusal("Unauthorized")
        issued, expires = aware(value["issued_at"]), aware(value["request_expires_at"])
        execution_end = absolute_time(value["execution_expires_at"])
        if (
            now.utcoffset() is None
            or not timedelta() < expires - issued <= timedelta(seconds=15)
            or now >= expires
            or issued > now + timedelta(seconds=2)
            or execution_end <= now
        ):
            raise Refusal("binding_denied")
        try:
            normalized = plan(feature, value["params"])["draft"]
        except AccessError as error:
            raise Refusal(error.code) from None
        if feature == "door_windows":
            if absolute_time(normalized["end"]) != execution_end:
                raise Refusal("binding_denied")
        elif feature in {"door_automations", "live_media", "live_validation"}:
            if absolute_time(normalized["expiry"]) != execution_end:
                raise Refusal("binding_denied")
        descriptor, parameters = freeze(value), freeze(normalized)
        seal = _FeatureInput(
            _ISSUER, descriptor, parameters, execution_end, features.PLAN_FLAGS, [now], [False]
        )
        return cls(descriptor, parameters, seal)

    def get(self, name: str):
        sealed = self._original()
        if name == "action":
            return "features/" + sealed.descriptor["feature"]
        return sealed.descriptor[name]

    def _original(self) -> _FeatureInput:
        sealed = self._validated
        if (
            type(sealed) is not _FeatureInput
            or sealed.issuer is not _ISSUER
            or self.descriptor is not sealed.descriptor
            or self.parameters is not sealed.parameters
        ):
            raise Refusal("binding_denied")
        return sealed

    def recheck(self, now: datetime, _selections=None) -> None:
        sealed = self._original()
        if (
            sealed.stopped[0]
            or features.PLAN_FLAGS is not sealed.gate_owner
            or features.PLAN_FLAGS.get(self.get("feature")) is not True
        ):
            sealed.stopped[0] = True
            raise Refusal("feature_disabled")
        # A newly authenticated request must arrive within TTL15. Its separately
        # signed execution deadline controls only the explicitly admitted job;
        # this never extends or reinterprets a W1 request/capture lease.
        if now.utcoffset() is None or now >= sealed.execution_end or now < sealed.observed[0]:
            sealed.stopped[0] = True
            raise Refusal("binding_denied")
        sealed.observed[0] = now


class FeatureBoundary(PeerBoundary):
    """Same original transport/connection peer checks, separate explicit parser."""

    def __init__(self, *, bridge_source=None, **kwargs):
        if bridge_source is not None:
            from ..arx_native_feature_source import NativeBridgeFeatureSource
            from ..trusted_actions.source_bindings import same_ports

            if type(bridge_source) is not NativeBridgeFeatureSource or not same_ports(
                (bridge_source.verify, bridge_source.is_current, bridge_source.clock),
                (kwargs.get("verify"), kwargs.get("is_current"), kwargs.get("clock")),
            ):
                raise Refusal("Unauthorized")
            _BRIDGE_SOURCES[self] = (
                bridge_source,
                bridge_source.user,
                bridge_source.verify,
                bridge_source.is_current,
                bridge_source.clock,
            )
        super().__init__(**kwargs)

    def _user(self, connection):
        record = _BRIDGE_SOURCES.get(self)
        if record is not None:
            self._stable()
            return record[1](connection)
        return PeerBoundary._user(connection)

    def native_owner(self, message: PeerMessage) -> bool:
        """Current original bridge delegation, separate from human approval.

        Injected/legacy feature verifiers never acquire this exemption. The
        module-owned source record is minted only by the actual native factory.
        """
        record = _BRIDGE_SOURCES.get(self)
        if record is None:
            return False
        self.check(message)
        user = record[1](message._connection)
        return user.id == message.query_owner_id

    def _stable(self):
        PeerBoundary._stable(self)
        record = _BRIDGE_SOURCES.get(self)
        if record is not None:
            from ..arx_native_feature_source import NativeBridgeFeatureSource
            from ..trusted_actions.source_bindings import same_ports

            source = record[0]
            if not same_ports(
                record[1:],
                (
                    source.user,
                    source.verify,
                    source.is_current,
                    source.clock,
                ),
            ):
                raise Refusal("Unauthorized")
            NativeBridgeFeatureSource._owner(source)

    def _parse(self, public_json: str, now):
        return FeatureRequest.parse(public_json, now)
