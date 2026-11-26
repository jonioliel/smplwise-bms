"""Response models of routers/access_control_system_status.py (WISKEY-RESYNC-2520 slice 1)."""
from __future__ import annotations

from typing import Any

from . import ExactModel

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet (scripts/wire_ratchet.py): none
UNMODELLED: frozenset[str] = frozenset()


class AccessControlSystemStatusRead(ExactModel):
    """One WisKey status read: `state` ready / unsupported / forbidden / unavailable / busy / error; `data` (the closed projection of
    services/wiskey_system_status.py) is null unless `state` is ready."""
    state: str
    reason: str | None
    wiskey_code: str | None
    fetched_at: str | None
    data: dict[str, Any] | None
