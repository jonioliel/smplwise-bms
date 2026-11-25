"""Response models of routers/settings.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2): `GET /api/v1/settings` and
`PATCH /api/v1/settings`. The settings document is passed through as stored (dotted keys -> value; secrets only for an editor)."""
from __future__ import annotations

from typing import Any

from . import ExactModel

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet (none here; the ratchet counts them)
UNMODELLED: frozenset[str] = frozenset()


class SettingsCapacityWarning(ExactModel):
    """An advisory capacity warning: the setting key and the operator text (it never blocks a save)."""
    key: str
    message: str


class SettingsSettings(ExactModel):
    """The installation settings: `can_edit` = system.configure; `nvr_channels` = the recorders' channel count (null = unknown)."""
    settings: dict[str, Any]
    can_edit: bool
    search_allowed: bool
    nvr_channels: int | None
    warnings: list[SettingsCapacityWarning]


class SettingsPatchSettings(ExactModel):
    """The settings after a save (an editor's view)."""
    settings: dict[str, Any]
    can_edit: bool
    nvr_channels: int | None
    warnings: list[SettingsCapacityWarning]
