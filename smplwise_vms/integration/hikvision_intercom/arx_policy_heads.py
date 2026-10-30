"""Native durable anti-rollback metadata for authenticated feature policies.

This is storage, not authentication. The native bridge source must supply its
already authenticated snapshot and original current guard. Only public origin
references/revision/time persist; no policy body, private value or body hash.
Heads never evict to make an old revision appear new after component/HA restart.
"""

from __future__ import annotations

import asyncio
import weakref
from dataclasses import dataclass

from .access.arx_policy_snapshot import PolicySnapshot, revision
from .media_lifetime import join_owned
from .storage import AccessStore
from .trusted_actions.source_bindings import same_ports
from .trusted_actions.validation import Refusal, aware, reference

MAX_HEADS = 4096
_OWNERS = weakref.WeakKeyDictionary()
_KEYS = ("entry_id", "query_owner_id", "source_epoch", "authority_ref")


def _decode(state, repository_id):
    if state is None:
        state = {
            "schema_version": 1,
            "repository_id": repository_id,
            "last_seen": None,
            "heads": [],
        }
    if (
        type(state) is not dict
        or set(state) != {"schema_version", "repository_id", "last_seen", "heads"}
        or type(state["schema_version"]) is not int
        or state["schema_version"] != 1
        or state["repository_id"] != repository_id
        or type(state["heads"]) is not list
        or len(state["heads"]) > MAX_HEADS
    ):
        raise Refusal("policy_ledger_invalid")
    if state["last_seen"] is not None:
        aware(state["last_seen"])
    heads = {}
    for row in state["heads"]:
        if type(row) is not dict or set(row) != {*_KEYS, "authority_revision"}:
            raise Refusal("policy_ledger_invalid")
        key = tuple(reference(row[k]) for k in _KEYS)
        if key in heads:
            raise Refusal("policy_ledger_invalid")
        heads[key] = revision(row["authority_revision"])
    return state["last_seen"], heads


@dataclass(repr=False)
class _Owner:
    store: object
    hass: object
    config: object
    path: str
    repository_id: str
    ports: tuple
    heads: dict
    last_seen: str | None
    lock: object
    poisoned: bool = False


class NativePolicyHeads:
    def __init__(self, store, repository_id, state):
        if type(store) is not AccessStore:
            raise ValueError("Original native private HA storage required")
        reference(repository_id)
        last_seen, heads = _decode(state, repository_id)
        _OWNERS[self] = _Owner(
            store,
            store.hass,
            store.hass.config,
            store.path,
            repository_id,
            (store.async_save, store.hass.async_add_executor_job, store._save_strict),
            heads,
            last_seen,
            asyncio.Lock(),
        )

    def _owner(self):
        owner = _OWNERS.get(self)
        if (
            owner is None
            or owner.poisoned
            or owner.store.hass is not owner.hass
            or owner.hass.config is not owner.config
            or owner.store.path != owner.path
            or not same_ports(
                owner.ports,
                (
                    owner.store.async_save,
                    owner.hass.async_add_executor_job,
                    owner.store._save_strict,
                ),
            )
        ):
            raise Refusal("policy_ledger_unavailable")
        return owner

    def head(self, key):
        """Bounded synchronous memory read; never disk or an async callback."""
        return NativePolicyHeads._owner(self).heads.get(key, 0)

    async def advance(self, snapshot, *, now, guard):
        if type(snapshot) is not PolicySnapshot:
            raise Refusal("invalid_policy_snapshot")
        owner = NativePolicyHeads._owner(self)
        async with owner.lock:
            guard()
            if (
                NativePolicyHeads._owner(self) is not owner
                or snapshot.payload["repository_id"] != owner.repository_id
                or owner.last_seen is not None
                and now < aware(owner.last_seen)
            ):
                raise Refusal("policy_binding_denied")
            if snapshot.revision <= owner.heads.get(snapshot.key, 0):
                raise Refusal("policy_revision_rollback")
            if snapshot.key not in owner.heads and len(owner.heads) >= MAX_HEADS:
                raise Refusal("policy_head_capacity")
            heads = {**owner.heads, snapshot.key: snapshot.revision}
            draft = {
                "schema_version": 1,
                "repository_id": owner.repository_id,
                "last_seen": now.isoformat(),
                "heads": [
                    {**dict(zip(_KEYS, key, strict=True)), "authority_revision": value}
                    for key, value in sorted(heads.items())
                ],
            }
            # Publish refusal immediately; a cancelled/lost save acknowledgement
            # cannot leave old revision authority active or invite a resend.
            owner.poisoned = True
            try:
                result, cancelled = await join_owned(owner.ports[0](draft))
                if result is not None:
                    raise Refusal("policy_ledger_unavailable")
                owner.heads, owner.last_seen = heads, draft["last_seen"]
                owner.poisoned = False
                NativePolicyHeads._owner(self)
                guard()
                if cancelled:
                    raise asyncio.CancelledError
            except BaseException:
                owner.poisoned = True
                raise

    def retire(self):
        _OWNERS.pop(self, None)
