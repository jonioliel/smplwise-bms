"""Response models of routers/automation_blueprints.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from pydantic import Field

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset({'POST /automation-blueprints/{blueprint_id}/instantiate'})


class AutomationBlueprintsStatus(ExactModel):
    """Never 403: whether the module is on and whether the caller can use it."""
    module_on: bool
    enabled: bool
    can_use: bool
    schema_: Num = Field(alias='schema')
    library_version: Num
    count: Num
    import_export: bool


class AutomationBlueprintsBlueprintsBlueprint(ExactModel):
    id: str
    version: Num
    schema_: Num = Field(alias='schema')
    category: str
    icon: str
    title: str
    description: str
    parameters: list[dict[str, Any]]
    sensitive: bool
    builtin: bool


class AutomationBlueprintsBlueprints(ExactModel):
    blueprints: list[AutomationBlueprintsBlueprintsBlueprint]
    schema_: Num = Field(alias='schema')
    library_version: Num


class AutomationBlueprintsOneBlueprintParameter(ExactModel):
    key: str
    type: str
    label: str
    domains: list[str] = None
    device_classes: list[str] = None
    role: str = None
    max: Num
    default: Num = None
    min: Num = None


class AutomationBlueprintsOneBlueprint(ExactModel):
    id: str
    version: Num
    schema_: Num = Field(alias='schema')
    category: str
    icon: str
    title: str
    description: str
    parameters: list[AutomationBlueprintsOneBlueprintParameter]
    sensitive: bool
    builtin: bool


class AutomationBlueprintsPreview(ExactModel):
    blueprint: dict[str, Any]
    draft: dict[str, Any]
    sentence: str
    ok: bool
    refusal: Any
    sensitive: bool
    enabled_on_create: bool
