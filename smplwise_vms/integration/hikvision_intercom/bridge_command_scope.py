"""Lightweight refusal-default context for native permission helpers.

Ordinary policy/projector tests do not import HA transport or storage modules.
Only an active scope delegates to the original native principal validator.
"""

from __future__ import annotations

from collections.abc import Callable
from contextvars import ContextVar
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .bridge_command_auth import _CommandScope

_SCOPE: ContextVar[_CommandScope | None] = ContextVar(
    "wiskey_verified_bridge_command", default=None
)


def bridge_authorized(hass=None, user=None, *, permissions=None):
    if _SCOPE.get() is None:
        return False
    from .bridge_command_auth import bridge_authorized as verify_original_scope

    return verify_original_scope(hass, user, permissions=permissions)


def check_command_current(hass=None):
    """Extra refusal only; no scope leaves ordinary native behavior intact."""
    if _SCOPE.get() is not None:
        bridge_authorized(hass=hass)


def mark_command_effect(hass=None):
    """Record possible I/O only on the current original command Task."""
    check_command_current(hass)
    if (scope := _SCOPE.get()) is not None:
        scope.native_attempted = True


def capture_command_current_guard() -> Callable[[], None]:
    """Extra refusal for one already admitted native persistence operation.

    Capture is allowed only on the original command Task. A cancellation-safe
    commit child may recheck the captured source; it gains no command scope,
    role or API authority, and a retired parent refuses.
    """
    scope = _SCOPE.get()
    if scope is None:
        return lambda: None
    bridge_authorized()

    def current() -> None:
        from .trusted_actions.validation import Refusal

        if _SCOPE.get() is not scope or not scope.active:
            raise Refusal("binding_denied")
        scope.principal.check()

    return current
