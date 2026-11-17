"""Helpers the bridge's modules share (CR-BRIDGE-COMMON-2440, review 05 P2-20). Each of these existed two to five times, typed out per
module; the per-module names stay as aliases or one-line wrappers (tests and callers reach them there), the logic lives here once.

Dependency-free on purpose (the standard library only, no Home Assistant import and no import of another bridge module), so every
module of the package may import it - inside Home Assistant Core and in plain unit tests alike.

- `canonical`: the canonical JSON of a message body - the bytes every signature of the bridge is computed over (`signing.sign`, the v1
  and v2 recipes of `keyset`, the lease contract's body hash). Its output is pinned byte for byte by the add-on's verification.
- `refusal`: the closed answer of a refused call.
- `entity_policy_refusal`: a Home Assistant user's entity policy for a list of entities, in the two variants the bridge needs.
- `group_members`: the member list a group state carries, as the two group walks read it.
- `window_full`: the sliding window of the rate limiters.
"""
from __future__ import annotations

import json
from typing import Any, Iterable, Mapping, MutableSequence

PERMISSION_UNAVAILABLE = "permission_check_unavailable"
UNAUTHORIZED = "unauthorized"


def canonical(body: dict[str, Any]) -> str:
    """Sorted keys, no whitespace, non-ASCII characters as themselves. Never change this: both sides sign and verify over it."""
    return json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def refusal(msg: Mapping[str, Any], error: str, path: str | None = None, *, text_id: bool = False, **extra: Any) -> dict[str, Any]:
    """`{"ok": False, "request_id": ..., "error": <code>}`, plus `path` when one is named and any extra key. `text_id=True` is the
    variant of the handlers that may answer before the message was judged: a `request_id` that is not a string is answered as null."""
    request_id = msg.get("request_id")
    if text_id and not isinstance(request_id, str):
        request_id = None
    out: dict[str, Any] = {"ok": False, "request_id": request_id, "error": error}
    if path:
        out["path"] = path
    out.update(extra)
    return out


def entity_policy_refusal(user: Any, policy_control: Any, entity_ids: Iterable[str], *, strict: bool = False,
                          unavailable: str = PERMISSION_UNAVAILABLE, refused: str = UNAUTHORIZED) -> str | None:
    """None when `user` may control every entity by its own Home Assistant policy (`permissions.check_entity(entity_id,
    POLICY_CONTROL)`), else the refusal code. A permission API that is missing or raises is `unavailable`: closed.

    Two variants, kept exactly as the callers had them:
    - `strict=False` (a Home Assistant person: the schedule and the automations services): an administrator always may, and any
      truthy answer of the policy allows.
    - `strict=True` (the service user of an Arx-only person: runnable.py): never skipped for an administrator - the service user
      is never one, so an administrator (or a user object that does not say) is a fault and answers `unavailable`; only the
      answer `True` itself allows."""
    if strict:
        if getattr(user, "is_admin", True):
            return unavailable
    elif getattr(user, "is_admin", False):
        return None
    check = getattr(getattr(user, "permissions", None), "check_entity", None)
    if not callable(check) or policy_control is None:
        return unavailable
    for entity_id in entity_ids:
        try:
            allowed = check(entity_id, policy_control)
        except Exception:  # noqa: BLE001 - an API that raises is an API we cannot rely on: closed
            return unavailable
        if (allowed is not True) if strict else (not allowed):
            return refused
    return None


UNREADABLE = object()  # group_members: the state names members in a form the bridge does not understand


def group_members(state: Any) -> Any:
    """The members of a group: a state whose `entity_id` attribute lists them. None when `state` is None or carries no such
    attribute (not a group), a list / tuple of the members as given (a single string is one member; the caller judges each
    member), or `UNREADABLE` for any other type. The depth limit and what an unreadable group means stay with each walk."""
    members = (getattr(state, "attributes", None) or {}).get("entity_id") if state is not None else None
    if members is None:
        return None
    if isinstance(members, str):
        return [members]
    if not isinstance(members, (list, tuple)):
        return UNREADABLE
    return members


def window_full(queue: MutableSequence[float], now: float, window_s: float, limit: int) -> bool:
    """Drop the entries of `queue` (a deque of call times, oldest first) older than the window, then say whether it already holds
    `limit` calls. The caller appends `now` itself once every budget it checks has room (a refused call is not counted)."""
    while queue and now - queue[0] > window_s:
        queue.popleft()  # type: ignore[attr-defined]
    return len(queue) >= limit
