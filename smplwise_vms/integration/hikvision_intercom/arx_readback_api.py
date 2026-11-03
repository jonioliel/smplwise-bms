"""OFF-by-default candidate read API. No station/provider action is available here."""

from collections.abc import Callable
from typing import Any

from . import arx_preview_features as features
from .access.models import AccessError
from .access.person_readback import normalize_schedule, validate_request
from .const import DOMAIN
from .trusted_actions.source_bindings import same_ports


def authorize(command: str, user: Any) -> None:
    from .bridge_command_scope import bridge_authorized

    # Before feature state, repository access, person existence or schedule parsing.
    if (
        user is None or getattr(user, "is_active", False) is not True
        or getattr(user, "is_admin", False) is not True and not bridge_authorized(user=user)
    ):
        raise AccessError("unauthorized")
    if command not in features.CANDIDATE_READS:
        raise AccessError("unknown_command")
    if not features.enabled(command):
        raise AccessError("feature_disabled")


async def dispatch(
    hass: Any, command: str, msg: dict[str, Any], user: Any,
    *, guard: Callable[[], None] | None = None,
) -> dict[str, Any]:
    def admit() -> None:
        authorize(command, user)
        if guard is not None:
            guard()
        authorize(command, user)

    admit()
    if not isinstance(msg, dict):
        raise AccessError("invalid_fields")
    if command == features.SCHEDULE_NORMALIZE:
        if "schedule" not in msg:
            raise AccessError("invalid_fields")
        result = normalize_schedule(msg["schedule"])
        admit()
        return result
    validate_request(msg.get("user_id"), msg.get("revision"))
    data = hass.data
    namespace = data[DOMAIN]
    manager = namespace["access"]
    repository = manager.repository
    method = (
        "async_person_access_state_v2"
        if command == features.PERSON_READBACK_V2 else "async_person_access_state"
    )
    read = getattr(repository, method)
    lock = getattr(repository, "_lock", None)

    def current_snapshot() -> None:
        admit()
        # A successful old-store read cannot describe a newly installed manager.
        # Test identity before descending into a possibly replaced source object.
        if (
            hass.data is not data or data.get(DOMAIN) is not namespace
            or namespace.get("access") is not manager or manager.repository is not repository
            or getattr(repository, "_lock", None) is not lock
            or not same_ports((read,), (getattr(repository, method, None),))
        ):
            raise AccessError("readback_unavailable")

    current_snapshot()
    result = await read(
        msg["user_id"], revision=msg["revision"], guard=current_snapshot
    )
    current_snapshot()
    return result
