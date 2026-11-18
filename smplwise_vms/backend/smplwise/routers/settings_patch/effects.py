"""`PATCH /settings`: what happens once every check passed - the values are stored, the running services that follow a setting
are told, and the request's own audit row is written last."""
from __future__ import annotations

import json

from ...audit import audit
from ...db import set_setting
from ...services import automation_settings
from ...services.settings_store import CLASSES_REV_KEY
from .._common import rid as _rid
from . import Patch

# Stored as compact JSON; every other value is stored as `str(value)`.
JSON_STORED = ("ui.tabs", "ui.nav_size", "ui.look", "ui.palettes", "ui.tabs_mode_groups", "ui.dd_style_groups", "ui.dd_size_groups", "ui.dd_ring_groups", "ui.dd_panel_groups", "ui.mobile", "ui.xs", "timeline.colors", "schedules.classes", "plan.surfaces", "plan.view", "plan.bakes", "devices.area_row", "devices.floor_row", "home.screen", "multimedia.remote_default", *automation_settings.JSON_KEYS)


def store(patch: Patch) -> None:
    changes, conn = patch.changes, patch.conn
    for key, value in changes.items():
        if key == "home.widgets":
            set_setting(conn, key, json.dumps(value, ensure_ascii=False, separators=(",", ":")) if value else "")
            continue
        set_setting(conn, key, json.dumps(value, ensure_ascii=False, separators=(",", ":")) if key in JSON_STORED else str(value))
    if "schedules.classes" in changes:
        set_setting(conn, CLASSES_REV_KEY, "2")  # from now on the list is read as saved (the 2026-10-04 classes can be switched off)


def schedules_switched_on(patch: Patch) -> None:
    if patch.changes.get("schedules.enabled") == "true":  # CR-014: the feature was just switched on - start listening to the component now
        from ...services import schedules as schedules_svc

        schedules_svc.MIRROR.feature_switched_on()


def automations_switched_on(patch: Patch) -> None:
    if patch.changes.get("automations.enabled") == "true":  # CR-017: listen to the reload / run events and pull now
        from ...services import automations as automations_svc

        automations_svc.MIRROR.feature_switched_on()


def remote_csp(patch: Patch) -> None:
    changes = patch.changes
    if "remote.csp_enforce" in changes:  # CR-008 P2: the remote channel's next response already follows
        from ...remote_channel import set_csp_enforce

        set_csp_enforce(changes["remote.csp_enforce"] == "true")


def station_media_provider(patch: Patch) -> None:
    if "access.station_media_provider" in patch.changes:  # WISKEY-JOIN-LIVE-2382: WisKey's direct join follows the provider without a restart
        from ...services import wiskey_join_live

        wiskey_join_live.request_reevaluate("settings", actor=patch.principal, request_id=_rid(patch.request))


def microphone_policy(patch: Patch) -> None:
    if any(k in patch.changes for k in ("access.station_media", "ui.hide_wiskey")):  # LAZYMIC-295: the microphone policy follows at once
        from ...remote_channel import load_mic_mode_from

        load_mic_mode_from(patch.conn)


def settings_updated(patch: Patch) -> None:
    changes = patch.changes
    audit(patch.conn, actor=patch.principal, action="settings.update", decision="allowed", resource_type="installation", resource_id="*",
          request_id=_rid(patch.request), details={**changes, "forced": True} if patch.forced else changes)  # an override of the calendar-sensor check is on the record
