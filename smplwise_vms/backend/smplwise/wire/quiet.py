"""Response models of routers/quiet.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset({'GET /quiet/windows', 'POST /quiet/windows/{window_id}/stop'})


class QuietStartWindow(ExactModel):
    id: str
    scope_type: str
    scope_id: str
    label: str
    started_at: str
    ends_at: str
    active: bool
    ended_at: Any
    end_reason: Any
    seconds_left: Num


class QuietSettings(ExactModel):
    settings: dict[str, Any]


class QuietPutSettings(ExactModel):
    settings: dict[str, Any]
    changed: list[str]
