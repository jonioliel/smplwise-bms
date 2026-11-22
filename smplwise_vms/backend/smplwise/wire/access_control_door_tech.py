"""Response models of routers/access_control_door_tech.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset({'POST /access-control/stations/{station_id}/codes/{slot}', 'POST /access-control/stations/{station_id}/doors/{door}/hold', 'POST /access-control/stations/{station_id}/doors/{door}/hold/delete', 'POST /access-control/stations/{station_id}/doors/{door}/program', 'POST /access-control/stations/{station_id}/doors/{door}/program/{action}'})


class AccessControlDoorTechDoorTechViewCommandsHoldSave(ExactModel):
    available: Any
    reason: Any


class AccessControlDoorTechDoorTechViewCommands(ExactModel):
    hold_save: AccessControlDoorTechDoorTechViewCommandsHoldSave
    hold_delete: AccessControlDoorTechDoorTechViewCommandsHoldSave
    code_write: AccessControlDoorTechDoorTechViewCommandsHoldSave
    program_save: AccessControlDoorTechDoorTechViewCommandsHoldSave
    program_action: AccessControlDoorTechDoorTechViewCommandsHoldSave


class AccessControlDoorTechDoorTechViewLimits(ExactModel):
    code_window_s: Num
    code_max: Num


class AccessControlDoorTechDoorTechView(ExactModel):
    station_id: str
    allowed: bool
    reason: str
    online: Any
    feed: str
    locks: list[Any]
    commands: AccessControlDoorTechDoorTechViewCommands
    confirm_phrase: str
    limits: AccessControlDoorTechDoorTechViewLimits
    history: list[Any]
