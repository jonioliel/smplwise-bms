"""`PATCH /settings`, split by group (review 05:P1-10 step 2).

The route was one 397-line function. Its checks now live in the modules of this package, one small handler per key or key
family, and run from a table `{prefix: handler}` in the order the function ran them: of two refusals in one request the earlier
one answers, and the audit rows keep their order (tests/test_settings_patch_audit_order.py pins both).

A handler takes the request on its way (`Patch`) and changes `patch.changes` in place (a normalised value, a helper key popped),
notes a switch that actually changes, or raises `ApiError`. It runs only when a key of the request starts with its prefix; each
handler still checks its exact keys, so a prefix only has to be wide enough. Once every check passed, the steps of `AFTER` run in
order: the values are stored, the running services that follow a setting are told, and the audit rows of the switches and of the
request are written. Nothing here imports `routers.settings` (it imports this package)."""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Any, Callable

from fastapi import Request

from ...rbac import Principal


@dataclass
class Patch:
    """One `PATCH /settings` request: `changes` is the body by setting key (unset fields left out), edited by the handlers."""
    conn: sqlite3.Connection
    request: Request
    principal: Principal
    changes: dict[str, Any]
    # noted by a check when the switch actually changes; its audit row is written after the values are stored
    disarm_change: str | None = None
    disarm_word: str | None = None  # CR-I18N-CONFIRM-WORDS-2442: which word confirmed the switch to true ("he" / "en"), for the audit row
    update_switch: str | None = None
    local_switch: str | None = None
    tickets_switch: str | None = None
    maintenance_switch: str | None = None
    docread_switch: str | None = None
    emergency_switch: str | None = None
    forced: bool = False  # the calendar-sensor check was overridden (`schedules.shabbat_sensor_force`)


Handler = Callable[[Patch], None]

from . import cameras, content, effects, identity, modules, site, ui  # noqa: E402 - the handler modules use Patch

# In the order the checks run. Python keeps a dict in insertion order; `run` relies on it.
VALIDATORS: dict[str, Handler] = {
    **ui.VALIDATORS,
    **content.VALIDATORS,
    "schedules.allow_disarm": identity.allow_disarm,  # and schedules.allow_disarm_confirm
    "update.apply_enabled": modules.update_switch,
    "security.local_identity": identity.local_identity_switch,
    "security.local_identity_extended": identity.extended_switch,
    "security.local_public_url": identity.public_url,
    "security.local_passkey_": identity.passkey_settings,  # security.local_passkey_first, security.local_passkey_android
    "security.passkeys_all_users": identity.passkeys_all_users,  # MFA-PASSKEYS-2490
    "security.factor_reset_channel": identity.factor_reset_channel,  # MFA-RESET-HARDENING-2510
    "privacy.local_purge": identity.local_purge,  # and privacy.local_purge_confirm, privacy.local_purge_days
    "tickets.enabled": modules.tickets_switch,
    "maintenance.enabled": modules.maintenance_switch,
    "docread.enabled": modules.docread_switch,
    "cameras.discovery_allowed_ranges": cameras.discovery_ranges,  # ONVIF-API-2500: private site networks only, stored normalised
    "emergency_readiness.enabled": modules.emergency_switch,
    "schedules.shabbat_sensor": site.shabbat_sensor,  # and schedules.shabbat_sensor_force
    "map.default_floor": site.default_floor,
    "home.title": site.home_title,
    "home.floor_order": site.home_floor_order,
    "home.widgets": site.home_widgets,
    "time.zone": site.time_zone,
    "ai.provider": site.ai_provider,
    "access.station_media_direct_v2": modules.station_media_direct_v2,  # WISKEY-MEDIA-V2-2530: system_admin only, bridge 0.10.9+ to turn on
}

# After every check passed, in this order; each step looks at the request itself (no prefix: several read more than one key).
AFTER: tuple[Handler, ...] = (
    effects.store,
    effects.schedules_switched_on,
    effects.automations_switched_on,
    effects.remote_csp,
    effects.station_media_provider,
    effects.microphone_policy,
    identity.local_identity_changed,
    identity.local_switch_applied,
    identity.disarm_changed,
    modules.update_changed,
    modules.tickets_changed,
    modules.emergency_changed,
    modules.maintenance_changed,
    modules.docread_changed,
    effects.settings_updated,
)


def run(patch: Patch, table: dict[str, Handler]) -> None:
    for prefix, handler in table.items():
        if any(key.startswith(prefix) for key in patch.changes):
            handler(patch)


def validate(patch: Patch) -> None:
    """Every check of the table, in order; the first refusal ends the request (nothing was stored yet)."""
    run(patch, VALIDATORS)


def apply(patch: Patch) -> None:
    """The whole request: every check, then the store, the followers and the audit rows."""
    validate(patch)
    for step in AFTER:
        step(patch)
