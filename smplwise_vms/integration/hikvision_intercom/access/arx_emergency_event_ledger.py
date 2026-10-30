"""Original durable emergency event index; cached facts never issue permission.

Every effect must separately check its current original FeatureLease and native
target. Source change/poison/port replacement refuses. Full original descriptors
remain in the original journal; event references never reconstruct them.
"""

from __future__ import annotations

import asyncio
import weakref
from collections.abc import Callable
from copy import deepcopy
from dataclasses import dataclass, field
from types import MethodType
from typing import Any

from ..trusted_actions.validation import Refusal
from . import arx_emergency_event_contract as contract
from .arx_execution_authority import FeatureLease
from .arx_execution_journal import FeatureExecutionJournal

_Entry = dict[str, Any]
_Key = tuple[str, str]
_Scope = tuple[Any, ...]
_Reference = tuple[_Key, str]
_Events = dict[str, _Reference | None]
_View = dict[str, tuple[_Entry, dict[str, Any]] | None]
_LEDGERS: weakref.WeakKeyDictionary[FeatureExecutionJournal, EmergencyEventLedger] = (
    weakref.WeakKeyDictionary()
)
_OWNERS: weakref.WeakKeyDictionary[EmergencyEventLedger, _Owner] = weakref.WeakKeyDictionary()
_PORTS = ("begin", "save", "read", "emergency_event_rows", "pending_secure_claims", "_stable")


@dataclass(repr=False)
class _Owner:
    journal: weakref.ReferenceType[FeatureExecutionJournal]
    ports: tuple[Callable[..., Any], ...]
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    rows: dict[_Key, _Entry] = field(default_factory=dict)
    events: dict[_Scope, _Events] = field(default_factory=dict)
    invalid: bool = False
    running: dict = field(default_factory=dict)


def _root(original: dict[str, Any]) -> tuple[Any, ...]:
    return tuple(
        original[key]
        for key in (
            "repository_id",
            "verified_peer_ref",
            "query_owner_id",
        )
    )


class EmergencyEventLedger:
    def __new__(cls, journal: FeatureExecutionJournal) -> EmergencyEventLedger:
        if cls is not EmergencyEventLedger or type(journal) is not FeatureExecutionJournal:
            raise Refusal("binding_denied")
        if (old := _LEDGERS.get(journal)) is not None:
            EmergencyEventLedger._owner(old)
            return old
        return super().__new__(cls)

    def __init__(self, journal: FeatureExecutionJournal) -> None:
        if self in _OWNERS:
            return
        FeatureExecutionJournal._stable(journal)
        ports = tuple(getattr(journal, name) for name in _PORTS)
        if any(type(port) is not MethodType or port.__self__ is not journal for port in ports):
            raise Refusal("binding_denied")
        # No bound methods/strong journal reference in the global weak index.
        _OWNERS[self] = _Owner(weakref.ref(journal), tuple(port.__func__ for port in ports))
        _LEDGERS[journal] = self
        EmergencyEventLedger.refresh(self)

    def _owner(self) -> tuple[_Owner, FeatureExecutionJournal]:
        owner = _OWNERS.get(self) if type(self) is EmergencyEventLedger else None
        journal = owner.journal() if owner is not None else None
        if owner is None or journal is None or owner.invalid:
            raise Refusal("emergency_event_ledger_unavailable")
        for name, function in zip(_PORTS, owner.ports, strict=True):
            current = getattr(journal, name)
            if (
                type(current) is not MethodType
                or current.__self__ is not journal
                or current.__func__ is not function
            ):
                raise Refusal("binding_denied")
        owner.ports[-1](journal)
        return owner, journal

    @property
    def lock(self) -> asyncio.Lock:
        return EmergencyEventLedger._owner(self)[0].lock

    def refresh(self) -> None:
        owner, journal = EmergencyEventLedger._owner(self)
        try:
            # Original full recovery validator covers legacy/emergency kinds.
            owner.ports[4](journal)
            values = owner.ports[3](journal)
            rows: dict[_Key, _Entry]
            events: dict[_Scope, _Events]
            claims: dict[tuple[str, ...] | None, list[tuple[_Scope, dict[str, Any]]]]
            rows, events, claims = {}, {}, {}
            for entry in values:
                original, body = entry["original"], entry["body"]
                key = entry["key"]
                if key in rows:
                    raise Refusal("invalid_storage")
                rows[key] = entry
                if body["kind"] in contract.KINDS:
                    for target_key, row in body["targets"].items():
                        scope = contract.scope(original, body["event_ref"], row["target"])
                        event = events.setdefault(scope, {"apply": None, "release": None})
                        reference = (key, target_key)
                        if row["duplicate"]:
                            prior = rows.get((key[0], row["prior_operation"]))
                            if prior is None or prior["body"]["kind"] not in contract.KINDS:
                                raise Refusal("invalid_storage")
                            matches = [
                                candidate
                                for candidate in prior["body"]["targets"].values()
                                if contract.scope(
                                    prior["original"],
                                    prior["body"]["event_ref"],
                                    candidate["target"],
                                )
                                == scope
                            ]
                            if len(matches) != 1 or (
                                row["phase"] == "superseded" and event["release"] is None
                            ):
                                raise Refusal("invalid_storage")
                            expected = event["release"] or event["apply"]
                            if (
                                expected is None
                                or (key[0], row["prior_operation"]) != expected[0]
                                or contract.signature(matches[0]["target"])
                                != contract.signature(row["target"])
                                or body["command"] == "release"
                                and event["release"] is None
                                or body["command"] == "hold_open"
                                and (row["phase"] == "superseded") != (event["release"] is not None)
                            ):
                                raise Refusal("invalid_storage")
                            continue
                        if body["command"] == "hold_open":
                            if event["release"] is not None:
                                raise Refusal("invalid_storage")
                            if event["apply"] is not None:
                                previous_key, previous_target = event["apply"]
                                previous = rows[previous_key]["body"]["targets"][previous_target]
                                if (
                                    body.get("retry_of") != previous_key[1]
                                    or row["prior_operation"] != previous_key[1]
                                    or previous["phase"] not in {"unknown", "attempted"}
                                    or previous["duplicate"]
                                    or row["claim"] != previous["claim"]
                                    or contract.signature(row["target"])
                                    != contract.signature(previous["target"])
                                ):
                                    raise Refusal("invalid_storage")
                            elif body.get("retry_of") is not None:
                                raise Refusal("invalid_storage")
                            event["apply"] = reference
                            own = contract.claim(row["claim"])
                            if own in claims:
                                # One native operation can explicitly target
                                # many doors, each with its original signature.
                                claims[own].append((scope, row["target"]))
                            else:
                                claims[own] = [(scope, row["target"])]
                        else:
                            if event["release"] is not None:
                                raise Refusal("invalid_storage")
                            if event["apply"] is None:
                                if (
                                    row["release_claim"] is not None
                                    or row["prior_operation"] is not None
                                ):
                                    raise Refusal("invalid_storage")
                            else:
                                prior_key, prior_target = event["apply"]
                                prior_entry = rows[prior_key]
                                prior_row = prior_entry["body"]["targets"][prior_target]
                                if (
                                    row["prior_operation"] != prior_key[1]
                                    or row["release_claim"] != prior_row["claim"]
                                    or contract.signature(row["target"])
                                    != contract.signature(prior_row["target"])
                                ):
                                    raise Refusal("invalid_storage")
                            event["release"] = reference
                elif body["mode"] == "release_all":
                    # A matching actual native explicit release ACK is a deny
                    # fact for the original event, never a permission inferred
                    # from a foreign request/actor/history reference.
                    for row in body["targets"].values():
                        if row["phase"] != "acknowledged":
                            continue
                        released = tuple(row["target"]["release_claim"])
                        target = {key: row["target"][key] for key in contract.TARGET_FIELDS}
                        for scope, old_target in claims.get(released, ()):
                            if contract.signature(target) == contract.signature(old_target):
                                event = events[scope]
                                if event["release"] is None:
                                    # Keep the prior event's own original as
                                    # the duplicate reference, not this actor's.
                                    event["release"] = event["apply"]
            EmergencyEventLedger._owner(self)
            owner.rows, owner.events = rows, events
        except BaseException:
            owner.invalid = True
            raise

    def track_attempt(self, record, *, finished=False):
        """Deny concurrent retry of a live original task; never an allow cache."""
        owner, journal = EmergencyEventLedger._owner(self)
        FeatureExecutionJournal._owned(journal, record)
        task = asyncio.current_task()
        if task is None:
            raise Refusal("binding_denied")
        old = owner.running.get(record._key)
        if finished:
            if old is not None and old() is task:
                owner.running.pop(record._key)
        else:
            if old is not None and old() is not None and not old().done():
                raise Refusal("operation_in_progress")
            owner.running[record._key] = weakref.ref(task)

    def can_retry(self, key, phase):
        owner, _journal = EmergencyEventLedger._owner(self)
        if phase == "unknown":
            return True
        if phase != "attempted":
            return False
        ref = owner.running.get(key)
        # A persisted incomplete attempt after process loss is still UNKNOWN.
        # It can have a new authorized attempt; its old row is never reset.
        return ref is None or ref() is None or ref().done()

    def view(self, lease: FeatureLease, event_ref: str, target: dict[str, Any]) -> _View:
        if (
            type(lease) is not FeatureLease
            or lease.message.request.get("feature") != "emergency_buttons"
        ):
            raise Refusal("Unauthorized")
        lease.check()
        owner, journal = EmergencyEventLedger._owner(self)
        peer = lease.message.verification
        if peer.repository_id != journal.repository_id:
            raise Refusal("binding_denied")
        contract.signature(target)
        original = {
            "repository_id": peer.repository_id,
            "verified_peer_ref": peer.verified_peer_ref,
            "query_owner_id": lease.message.query_owner_id,
        }
        key = contract.scope(original, event_ref, target)
        value = owner.events.get(key, {"apply": None, "release": None})
        return deepcopy(
            {
                name: None
                if reference is None
                else (
                    owner.rows[reference[0]],
                    owner.rows[reference[0]]["body"]["targets"][reference[1]],
                )
                for name, reference in value.items()
            }
        )


def journal_changed(journal: FeatureExecutionJournal) -> None:
    if (ledger := _LEDGERS.get(journal)) is not None:
        EmergencyEventLedger.refresh(ledger)
