"""Owner-selected PIN reuse restriction in the explicit schema 17 candidate.

No policy is selected automatically. The policy adds a restriction beyond the
existing native per-station retirement. Clock passage alone never releases a
PIN: every original target needs native absence bookkeeping and an explicit
fresh owner maintenance operation must persist the release. Private PINs stay
only in private repository storage, never hashes, diagnostics or public output.
"""

from __future__ import annotations

import inspect
import json
import weakref
from dataclasses import dataclass
from datetime import timedelta
from uuid import uuid4

from ..trusted_actions.peer_boundary import counter
from ..trusted_actions.source_bindings import same_ports
from ..trusted_actions.source_commit_guard import source_commit
from ..trusted_actions.validation import Refusal, aware, reference
from .models import AccessError

FORMAT = "wiskey-pin-quarantine.v1"
MAX_ITEMS = 4096
MAX_SECONDS = 30 * 24 * 60 * 60
_DELIVERY_OWNERS = weakref.WeakKeyDictionary()
_POLICY_OWNERS = weakref.WeakKeyDictionary()


def _metadata(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)


def bind_original_policy(repository):
    """Native constructor hook only; second issuance cannot replace an owner."""
    if repository in _POLICY_OWNERS:
        raise ValueError("one original native PIN policy binding required")
    owner = repository._pin_quarantine_owner
    _POLICY_OWNERS[repository] = (
        (None, None, None, None)
        if owner is None
        else (owner, _metadata(owner[2]), repository._save, repository._lock)
    )


@dataclass(frozen=True, repr=False)
class PinQuarantinePolicy:
    policy_ref: str
    revision: int
    minimum_seconds: int

    def __post_init__(self):
        reference(self.policy_ref)
        counter(self.revision)
        if type(self.minimum_seconds) is not int or not 0 <= self.minimum_seconds <= MAX_SECONDS:
            raise ValueError("explicit bounded owner PIN quarantine policy required")

    def metadata(self):
        return {
            "policy_ref": self.policy_ref,
            "revision": self.revision,
            "minimum_seconds": self.minimum_seconds,
        }


def defaults(policy: PinQuarantinePolicy):
    return {"schema": FORMAT, "policy": policy.metadata(), "last_observed_at": None, "items": {}}


def validate(value):
    if value is None:
        return
    try:
        if (
            type(value) is not dict
            or set(value) != {"schema", "policy", "last_observed_at", "items"}
            or value["schema"] != FORMAT
            or type(value["policy"]) is not dict
            or set(value["policy"]) != {"policy_ref", "revision", "minimum_seconds"}
        ):
            raise ValueError
        policy = PinQuarantinePolicy(**value["policy"])
        if value["last_observed_at"] is not None:
            aware(value["last_observed_at"])
        items = value["items"]
        if type(items) is not dict or len(items) > MAX_ITEMS:
            raise ValueError
        for key, item in items.items():
            reference(key)
            if (
                type(item) is not dict
                or set(item)
                != {
                    "user_id",
                    "person_revision",
                    "pin",
                    "targets",
                    "confirmed",
                    "retired_at",
                    "not_before",
                }
                or type(item["pin"]) is not str
                or not item["pin"].isascii()
                or not item["pin"].isdigit()
                or not 1 <= len(item["pin"]) <= 32
            ):
                raise ValueError
            reference(item["user_id"])
            counter(item["person_revision"])
            for name in ("targets", "confirmed"):
                values = item[name]
                if type(values) is not list or len(values) > 100 or values != sorted(set(values)):
                    raise ValueError
                for station in values:
                    reference(station)
            if not set(item["confirmed"]) <= set(item["targets"]):
                raise ValueError
            retired, end = aware(item["retired_at"]), aware(item["not_before"])
            if end - retired != timedelta(seconds=policy.minimum_seconds):
                raise ValueError
            if value["last_observed_at"] is None or retired > aware(value["last_observed_at"]):
                raise ValueError
    except (KeyError, TypeError, ValueError, AttributeError, Refusal):
        raise AccessError("invalid_storage") from None


def selected(repository):
    issued = _POLICY_OWNERS.get(repository)
    if issued is None or repository._pin_quarantine_owner is not issued[0]:
        raise AccessError("candidate_policy_changed")
    owner = repository._pin_quarantine_owner
    if owner is None:
        if repository._state.get("peer_source", {}).get("pin_quarantine") is not None:
            raise AccessError("candidate_policy_required")
        return None
    policy, clock, metadata = owner
    if (
        repository._save is not issued[2]
        or repository._lock is not issued[3]
        or repository._pin_quarantine is not policy
        or repository._quarantine_clock is not clock
        or policy.metadata() != metadata
        or _metadata(metadata) != issued[1]
    ):
        raise AccessError("candidate_policy_changed")
    return owner


def clock_now(repository, state):
    owner = selected(repository)
    if owner is None:
        raise AccessError("candidate_policy_required")
    policy, clock, metadata = owner
    sample = clock()
    if type(sample) is not str:
        raise AccessError("invalid_clock")
    try:
        now = aware(sample)
    except Exception:
        raise AccessError("invalid_clock") from None
    table = state["peer_source"]["pin_quarantine"]
    if table["policy"] != metadata:
        raise AccessError("candidate_policy_changed")
    previous = table["last_observed_at"]
    if previous is not None and now < aware(previous):
        raise AccessError("invalid_clock")
    if selected(repository) is not owner:
        raise AccessError("candidate_policy_changed")
    table["last_observed_at"] = now.isoformat()
    return now


def observe(repository, before, candidate):
    """Native CPU candidate hook, before collision checks and the only save."""
    owner = selected(repository)
    if owner is None:
        return
    now = clock_now(repository, candidate)
    policy = owner[0]
    items = candidate["peer_source"]["pin_quarantine"]["items"]
    for uid, previous in before["users"].items():
        pin = previous.get("pin")
        desired = candidate["users"].get(uid)
        if pin is None or desired is not None and desired.get("pin") == pin:
            continue
        if any(item["pin"] == pin for item in items.values()):
            continue
        if len(items) >= MAX_ITEMS:
            raise AccessError("pin_quarantine_capacity")
        targets = set(previous["assignments"]) | {
            station for station, bindings in before["bindings"].items() if uid in bindings
        }
        targets |= set(candidate["tombstones"].get(uid, {}).get("targets", []))
        items[str(uuid4())] = {
            "user_id": uid,
            "person_revision": previous["revision"],
            "pin": pin,
            "targets": sorted(targets),
            "confirmed": [],
            "retired_at": now.isoformat(),
            "not_before": (now + timedelta(seconds=policy.minimum_seconds)).isoformat(),
        }
    validate(candidate["peer_source"]["pin_quarantine"])


def confirm(state, station, user_id, present_pin):
    table = state.get("peer_source", {}).get("pin_quarantine")
    if table is None:
        return
    # Same native exact station/owner/absence boundary as retired_pins. A
    # missing/corrupt/timeout read must never call this primitive as absence.
    for item in table["items"].values():
        if (
            item["user_id"] == user_id
            and station in item["targets"]
            and type(present_pin) is str
            and item["pin"] != present_pin
        ):
            item["confirmed"] = sorted(set(item["confirmed"]) | {station})


def unavailable(state, pin):
    table = state.get("peer_source", {}).get("pin_quarantine")
    return table is not None and any(item["pin"] == pin for item in table["items"].values())


def validate_collisions(state):
    table = state.get("peer_source", {}).get("pin_quarantine")
    if table is None:
        return
    blocked = {item["pin"] for item in table["items"].values()}
    # Tombstones retain their original PIN until native deletion finishes;
    # they are an additional restriction and cannot activate a credential.
    if any(record.get("pin") in blocked for record in state["users"].values()):
        raise AccessError("pin_quarantined")


async def release(repository, item_id, *, expected_policy: PinQuarantinePolicy, guard):
    """Explicit owner maintenance primitive; no peer/public route installs it.

    The host must bind guard to its actual fresh owner authorization and exact
    item scope. There is no local-admin/default-success fallback. This does not
    itself prove actual firmware removal; physical lab acceptance stays open.
    """
    reference(item_id)
    if not callable(guard) or inspect.iscoroutinefunction(guard):
        raise ValueError("fresh synchronous owner maintenance guard required")
    owner = selected(repository)
    if owner is None or expected_policy is not owner[0]:
        raise AccessError("candidate_policy_changed")
    guard()

    def change(state):
        now = clock_now(repository, state)
        item = state["peer_source"]["pin_quarantine"]["items"].get(item_id)
        if item is None:
            raise AccessError("pin_quarantine_not_found")
        if now < aware(item["not_before"]) or set(item["targets"]) != set(item["confirmed"]):
            raise AccessError("pin_quarantine_pending")
        # Do not discard a native retirement/tombstone restriction merely
        # because this additional quarantine has reached its owner deadline.
        if any(r["pin"] == item["pin"] for r in state["retired_pins"].values()) or any(
            r["record"].get("pin") == item["pin"] for r in state["tombstones"].values()
        ):
            raise AccessError("pin_removal_pending")
        del state["peer_source"]["pin_quarantine"]["items"][item_id]

    with source_commit(repository, guard):
        await repository._commit(change)


class NativePinDeliveryPolicy:
    """Additional typed refusal fence for current candidate PIN delivery.

    It grants no send permission, returns no credential and does not replace
    current Arx/template/recipient authority. The sender calls require before
    preview and immediately around its actual POST boundary. A configured
    candidate quarantine must not silently use a sender without this fence.
    """

    def __init__(self, repository):
        from .repository import AccessRepository

        if type(repository) is not AccessRepository or selected(repository) is None:
            raise ValueError("explicit native candidate PIN policy repository required")
        self.repository = repository
        self._roots = (
            repository,
            repository._save,
            repository._lock,
            repository._pin_quarantine_owner,
        )
        _DELIVERY_OWNERS[self] = (self._roots, _metadata(self._roots[3][2]))

    def require(self, person_id, revision):
        reference(person_id)
        counter(revision)
        issued = _DELIVERY_OWNERS.get(self)
        if issued is None or self._roots is not issued[0]:
            raise Refusal("binding_denied")
        repository, save, lock, owner = issued[0]

        def current_owner():
            try:
                return selected(repository)
            except (AccessError, TypeError, ValueError, KeyError):
                raise Refusal("binding_denied") from None

        if (
            self.repository is not repository
            or repository._save is not save
            or repository._lock is not lock
            or current_owner() is not owner
            or json.dumps(owner[2], sort_keys=True, separators=(",", ":"), allow_nan=False)
            != issued[1]
        ):
            raise Refusal("binding_denied")
        state = repository._state
        raw = state["users"].get(person_id)
        if (
            type(raw) is not dict
            or raw.get("id") != person_id
            or type(raw.get("revision")) is not int
            or raw["revision"] != revision
            or type(raw.get("pin")) is not str
            or unavailable(state, raw["pin"])
        ):
            raise Refusal("binding_denied")
        original_pin = raw["pin"]
        sample = owner[1]()
        table = state["peer_source"]["pin_quarantine"]
        if table["policy"] != owner[2]:
            raise Refusal("binding_denied")
        try:
            now = aware(sample)
            if table["last_observed_at"] is not None and now < aware(table["last_observed_at"]):
                raise Refusal("binding_denied")
        except Exception:
            raise Refusal("binding_denied") from None
        if (
            current_owner() is not owner
            or repository._state is not state
            or state["users"].get(person_id) is not raw
            or raw.get("pin") != original_pin
            or raw.get("revision") != revision
            or unavailable(state, original_pin)
            or state["peer_source"]["pin_quarantine"] is not table
            or table["policy"] != owner[2]
            or json.dumps(owner[2], sort_keys=True, separators=(",", ":"), allow_nan=False)
            != issued[1]
            or not same_ports(
                self._roots,
                (
                    self.repository,
                    repository._save,
                    repository._lock,
                    repository._pin_quarantine_owner,
                ),
            )
        ):
            raise Refusal("binding_denied")
