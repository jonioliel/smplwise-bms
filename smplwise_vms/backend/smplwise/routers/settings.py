"""Product settings that are safe to expose (no secrets): media transport default, session caps,
snapshot freshness. Secrets stay in the add-on options."""
from __future__ import annotations

import re
import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field, field_validator

from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import get_setting, get_settings_many  # noqa: F401 - get_settings_many: kept as this module's attribute (tests patch it)
from ..rbac import INSTALLATION, Principal, authorize, require
from . import settings_patch, ui_background
from ..services import app_download, nvr_capacity, dd_style
# CR-SETTINGS-STORE-2436: the registry lives in services/settings_store.py; these names are re-exported so every caller
# (`from ..routers.settings import read_settings, DEFAULTS, ...`) keeps working unchanged.
from ..services.settings_store import (
    DEFAULTS,
    SCHEDULE_CLASSES,  # noqa: F401 - re-export
    INT_KEYS,  # noqa: F401 - re-export
    FROZEN_SKINS,
    FROZEN_FALLBACK_SKIN,  # noqa: F401 - re-export
    stored_skin,  # noqa: F401 - re-export
    PRIVATE_KEYS,  # noqa: F401 - re-export
    read_settings,
    _stored_favourites,  # noqa: F401 - re-export
    _stored_remote_default,  # noqa: F401 - re-export
    _stored_nav_size,  # noqa: F401 - re-export
    _stored_mobile,  # noqa: F401 - re-export
    _stored_xs,  # noqa: F401 - re-export
    _stored_timeline_colors,  # noqa: F401 - re-export
    _stored_area_row,  # noqa: F401 - re-export
    PLAN_SURFACES,  # noqa: F401 - re-export
    stored_plan_surfaces,  # noqa: F401 - re-export
    CLASSES_REV_KEY,  # noqa: F401 - re-export
    stored_schedule_classes,  # noqa: F401 - re-export
    TABS_SLUG,  # noqa: F401 - re-export
    TABS_MAX_SECTIONS,  # noqa: F401 - re-export
    TAB_STYLES,  # noqa: F401 - re-export
    TABS_STYLES_KEY,  # noqa: F401 - re-export
    TABS_LEVELS,  # noqa: F401 - re-export
    TABS_MAX_PER_LIST,  # noqa: F401 - re-export
    TABS_MAX_JSON,  # noqa: F401 - re-export
    _stored_tabs,  # noqa: F401 - re-export
    normalize_tabs,  # noqa: F401 - re-export
    NORMALISED_KEYS,  # noqa: F401 - re-export
    setting_value,  # noqa: F401 - re-export
)

# CR-SETTINGS-PATCH-B-2440: the PATCH-only words and the local-only helper live with the checks that use them; re-exported
from .settings_patch.identity import (
    ALLOW_DISARM_WORD,  # noqa: F401 - re-export
    LOCAL_PURGE_WORD,  # noqa: F401 - re-export
    LOCAL_ONLY_IDENTITY_KEYS,  # noqa: F401 - re-export
    LOCAL_ONLY_HE,  # noqa: F401 - re-export
    _local_only_identity_key,  # noqa: F401 - re-export
)

router = APIRouter()


# CR-007 6a/6b: the registered device-screen palettes - keep in step with DEVICE_THEMES in
# frontend/src/styles/devices-themes.ts (docs/design/DEVICE_THEMES.md, "How to add a theme").
DEVICE_THEMES = ("default", "sand", "forest", "graphite")


LEAD_DAYS_PATTERN = r"^(0|[1-9][0-9]?|[12][0-9]{2}|3[0-5][0-9]|36[0-5])$"  # CR-MAINT215: 0-365 days
# TTS-DEFAULT-ENGINE-2400: the fixed announcement engine / language - "" (system default / automatic) or a plain id: no spaces, no
# control characters, no markup; the engine id as Home Assistant spells it (an entity id `tts.x`, or a legacy provider name).
TTS_ENGINE_PATTERN = r"^$|^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"
TTS_LANGUAGE_PATTERN = r"^$|^[A-Za-z]{1,8}([_-][A-Za-z0-9]{1,8}){0,6}$"


class SettingsPatch(BaseModel):
    media_transport_default: str | None = Field(default=None, pattern="^(auto|webrtc|mse)$", alias="media.transport_default")
    media_max_live_sessions: int | None = Field(default=None, ge=1, le=128, alias="media.max_live_sessions")
    media_wall_profile: str | None = Field(default=None, pattern="^(sub|main)$", alias="media.wall_profile")
    media_video_notices: str | None = Field(default=None, pattern="^(true|false)$", alias="media.video_notices")
    # HEALTH-GO2RTC-FOLLOWUP-2431: minutes before the "video service unavailable" administrators' notice (1 / 5 / 15 / 30 / 60)
    media_video_notice_after_min: Literal[1, 5, 15, 30, 60] | None = Field(default=None, alias="media.video_notice_after_min")
    media_h265_policy: str | None = Field(default=None, pattern="^(auto|sub|transcode|off)$", alias="media.h265_policy")  # LIVE-H265-2341
    media_h265_max_transcodes: int | None = Field(default=None, ge=0, le=16, alias="media.h265_max_transcodes")
    nvr_batch_on_refusal: str | None = Field(default=None, pattern="^(skip|stop)$", alias="nvr.batch_on_refusal")  # CAM-H264-VERIFY-2361
    nvr_privacy_mask_write: str | None = Field(default=None, pattern="^(true|false)$", alias="nvr.privacy_mask_write")  # NVRMASK-295
    nvr_privacy_mask_copy: str | None = Field(default=None, pattern="^(true|false)$", alias="nvr.privacy_mask_copy")  # MASKCOPY62-295
    snapshots_max_age_s: int | None = Field(default=None, ge=5, le=3600, alias="snapshots.max_age_s")
    time_zone: str | None = Field(default=None, pattern=r"^[A-Za-z_]+(/[A-Za-z_\-+0-9]+)+$", alias="time.zone")
    playback_max_sessions: int | None = Field(default=None, ge=1, le=128, alias="playback.max_sessions")
    playback_lease_s: int | None = Field(default=None, ge=60, le=3600, alias="playback.lease_s")
    playback_max_seeks_per_min: int | None = Field(default=None, ge=0, le=600, alias="playback.max_seeks_per_min")
    server_fast_network: str | None = Field(default=None, pattern="^(true|false)$", alias="server.fast_network")  # ASYNCIO-DEFAULT-2342
    server_startup_warmup: str | None = Field(default=None, pattern="^(true|false)$", alias="server.startup_warmup")  # WARMUP-POLISH-2421
    playback_cross_recorder_sync: str | None = Field(default=None, pattern="^(true|false)$", alias="playback.cross_recorder_sync")
    playback_stall_s: int | None = Field(default=None, ge=2, le=30, alias="playback.stall_s")
    playback_auto_resume_attempts: int | None = Field(default=None, ge=0, le=5, alias="playback.auto_resume_attempts")
    exports_max_mb: int | None = Field(default=None, ge=50, le=20480, alias="exports.max_mb")
    exports_retention_days: int | None = Field(default=None, ge=1, le=365, alias="exports.retention_days")
    events_retention_days: int | None = Field(default=None, ge=1, le=3650, alias="events.retention_days")
    audit_retention_days: int | None = Field(default=None, ge=30, le=3650, alias="audit.retention_days")
    cases_import_max_mb: int | None = Field(default=None, ge=16, le=4096, alias="cases.import_max_mb")
    storage_min_free_mb: int | None = Field(default=None, ge=0, le=102400, alias="storage.min_free_mb")
    # deprecated (0.1.148): accepted for compatibility, ignored by the app
    ui_design: str | None = Field(default=None, pattern="^(a|b)$", alias="ui.design")
    ui_design_names: str | None = Field(default=None, max_length=200, alias="ui.design_names")
    ui_wall_count: int | None = Field(default=None, ge=1, le=32, alias="ui.wall_count")
    ui_kiosk_cols: int | None = Field(default=None, ge=1, le=6, alias="ui.kiosk_cols")
    ui_kiosk_rows: int | None = Field(default=None, ge=1, le=5, alias="ui.kiosk_rows")
    ui_wall_phone_bar: str | None = Field(default=None, pattern="^(icons|labels)$", alias="ui.wall_phone_bar")  # WALL-PHONE-TOOLBAR-2401
    ui_hide_search: str | None = Field(default=None, pattern="^(true|false)$", alias="ui.hide_search")
    ui_global_search: str | None = Field(default=None, pattern="^(off|admins|roles|all)$", alias="ui.global_search")
    ui_global_search_roles: str | None = Field(default=None, pattern=r"^[A-Za-z0-9_.\-]+(,[A-Za-z0-9_.\-]+)*$|^$", max_length=600, alias="ui.global_search_roles")
    ui_start_route: str | None = Field(default=None, pattern="^(explore|live|wall|events|playback|devices)$", alias="ui.start_route")
    ui_hide_map: str | None = Field(default=None, pattern="^(true|false)$", alias="ui.hide_map")
    ui_security_snapshot: str | None = Field(default=None, pattern="^(true|false)$", alias="ui.security_snapshot")
    ui_tile_layout: str | None = Field(default=None, pattern="^(auto|cards|compact)$", alias="ui.tile_layout")
    ui_page_size_schedules: int | None = Field(default=None, ge=3, le=50, alias="ui.page_size.schedules")
    ui_page_size_schedules_phone: int | None = Field(default=None, ge=3, le=50, alias="ui.page_size.schedules_phone")
    ui_page_size_automations: int | None = Field(default=None, ge=3, le=50, alias="ui.page_size.automations")
    ui_page_size_automations_phone: int | None = Field(default=None, ge=3, le=50, alias="ui.page_size.automations_phone")
    ui_page_size_automations_cards: int | None = Field(default=None, ge=1, le=50, alias="ui.page_size.automations_cards")
    ui_page_size_automations_cards_phone: int | None = Field(default=None, ge=1, le=50, alias="ui.page_size.automations_cards_phone")
    ui_schedules_view: str | None = Field(default=None, pattern="^(rows|cards|table|week)$", alias="ui.schedules_view")
    ui_automations_view: str | None = Field(default=None, pattern="^(rows|cards)$", alias="ui.automations_view")
    ui_skin: str | None = Field(default=None, pattern="^(classic|domus|tesla|bubble|crystal|infra|soft)$", alias="ui.skin")  # keep in step with SKIN_IDS in frontend/src/design/skins/index.ts (SKINFOUND-297: infra, soft)
    ui_scheme: str | None = Field(default=None, pattern="^(light|dark|auto)$", alias="ui.scheme")
    ui_motion: str | None = Field(default=None, pattern="^(auto|full|reduced)$", alias="ui.motion")  # MOTIONSETTING-297; keep in step with MOTION_MODES in frontend/src/design/apply.ts
    ui_entry_animations: str | None = Field(default=None, pattern="^(on|off)$", alias="ui.entry_animations")  # 2.29.0: keep in step with ENTER_MODES in frontend/src/design/apply.ts
    ui_chip_selected: str | None = Field(default=None, pattern="^(strong|soft|filled|dark)$", alias="ui.chip_selected")  # DOMUS-DEFAULT-2439: keep in step with CHIP_ON_MODES in frontend/src/design/apply.ts
    ui_rail_tone: str | None = Field(default=None, pattern="^(auto|dark)$", alias="ui.rail_tone")  # SKINCOMP-297: keep in step with RAIL_TONES in frontend/src/design/skins/index.ts

    @field_validator("ui_skin")
    @classmethod
    def _skin_not_frozen(cls, v: str | None) -> str | None:
        if v in FROZEN_SKINS:
            raise ValueError(f"the '{v}' skin is frozen and can no longer be selected; choose classic, domus, tesla, crystal, infra or soft")
        return v

    ui_accent: str | None = Field(default=None, max_length=16, alias="ui.accent")  # 2.4.4: validated by services/brand_colors.py
    ui_toggle_on: str | None = Field(default=None, max_length=16, alias="ui.toggle_on")
    ui_background: str | None = Field(default=None, pattern="^(builtin|none|custom)$", alias="ui.background")  # CRY: keep in step with BACKGROUND_MODES in frontend/src/design/background.ts
    ui_tabs: dict[str, Any] | None = Field(default=None, alias="ui.tabs")  # validated in full by normalize_tabs
    ui_tabs_mode: str | None = Field(default=None, pattern="^(tabs|hybrid|dropdown)$", alias="ui.tabs_mode")
    ui_tickets_section_row: str | None = Field(default=None, pattern="^(hide_single|always)$", alias="ui.tickets_section_row")  # SERVICEIA1-295
    ui_tabs_mode_groups: dict[str, Any] | None = Field(default=None, alias="ui.tabs_mode_groups")  # validated in full by services/tabs_mode.py
    ui_dd_style: str | None = Field(default=None, pattern="^(" + "|".join(dd_style.STYLES) + ")$", alias="ui.dd_style")
    ui_dd_phone: str | None = Field(default=None, pattern="^(" + "|".join(dd_style.PHONE_MODES) + ")$", alias="ui.dd_phone")
    ui_dd_search: str | None = Field(default=None, pattern="^(" + "|".join(dd_style.SEARCH_MODES) + ")$", alias="ui.dd_search")
    ui_dd_picker: str | None = Field(default=None, pattern="^(" + "|".join(dd_style.PICKERS) + ")$", alias="ui.dd_picker")
    ui_dd_place: str | None = Field(default=None, pattern="^(" + "|".join(dd_style.PLACES) + ")$", alias="ui.dd_place")
    ui_dd_style_groups: dict[str, Any] | None = Field(default=None, alias="ui.dd_style_groups")  # validated in full by services/dd_style.py
    ui_dd_size: str | None = Field(default=None, pattern="^(" + "|".join(dd_style.SIZES) + ")$", alias="ui.dd_size")
    ui_dd_size_groups: dict[str, Any] | None = Field(default=None, alias="ui.dd_size_groups")  # validated in full by services/dd_style.py
    ui_dd_ring: str | None = Field(default=None, pattern="^(" + "|".join(re.escape(r) for r in dd_style.RINGS) + ")$", alias="ui.dd_ring")
    ui_dd_ring_groups: dict[str, Any] | None = Field(default=None, alias="ui.dd_ring_groups")  # validated in full by services/dd_style.py
    ui_dd_panel: str | None = Field(default=None, pattern="^(" + "|".join(dd_style.PANELS) + ")$", alias="ui.dd_panel")
    ui_dd_panel_groups: dict[str, Any] | None = Field(default=None, alias="ui.dd_panel_groups")  # validated in full by services/dd_style.py
    ui_mobile: dict[str, Any] | None = Field(default=None, alias="ui.mobile")  # validated in full by services/mobile_options.py
    ui_xs: dict[str, Any] | None = Field(default=None, alias="ui.xs")  # validated in full by services/xs_options.py (2.29.0)
    ui_nav_size: dict[str, Any] | None = Field(default=None, alias="ui.nav_size")  # validated in full by services/nav_size.py
    ui_look: dict[str, Any] | None = Field(default=None, alias="ui.look")  # validated in full by services/look.py (every dial required)
    ui_palettes: list[dict[str, Any]] | None = Field(default=None, alias="ui.palettes")  # validated in full (shape; contrast is warn-only) by services/palettes.py
    timeline_palette: dict[str, Any] | None = Field(default=None, alias="timeline.colors")  # validated in full by services/timeline_colors.py
    playback_helper_line: str | None = Field(default=None, pattern="^(all|installers|hidden)$", alias="playback.helper_line")
    playback_diagnostics: str | None = Field(default=None, pattern="^(all|installers|hidden)$", alias="playback.diagnostics")
    history_ha_secondary: str | None = Field(default=None, pattern="^(true|false)$", alias="history.ha_secondary")
    history_timescrub: str | None = Field(default=None, pattern="^(true|false)$", alias="history.timescrub")  # CR-TIMESCRUB101
    history_range_max_days: int | None = Field(default=None, ge=1, le=30, alias="history.range_max_days")
    history_presence_retention_days: int | None = Field(default=None, ge=1, le=30, alias="history.presence_retention_days")
    plan_estimates: str | None = Field(default=None, pattern="^(true|false)$", alias="plan.estimates")
    plan_levels: str | None = Field(default=None, pattern="^(all|default)$", alias="plan.levels")
    map_shared_levels: str | None = Field(default=None, pattern="^(show|hide)$", alias="map.shared_levels")
    map_default_floor: str | None = Field(default=None, max_length=64, pattern=r"^[A-Za-z0-9_.\-]*$", alias="map.default_floor")  # "" or an existing floor id (checked in the handler)
    map_default_view: str | None = Field(default=None, pattern="^(2d|3d)$", alias="map.default_view")
    map_room_pills: str | None = Field(default=None, pattern="^(room|room_always|device)$", alias="map.room_pills")  # PLAN3D-R28-UI-2433
    map_room_pill_tap: str | None = Field(default=None, pattern="^(popover|card)$", alias="map.room_pill_tap")
    map_room_pill_quiet: str | None = Field(default=None, pattern="^(name|hide|bubble)$", alias="map.room_pill_quiet")
    map_room_card_place: str | None = Field(default=None, pattern="^(side|float|sheet_tablet)$", alias="map.room_card_place")
    map_room_card_confirm: str | None = Field(default=None, pattern="^(system|bulk)$", alias="map.room_card_confirm")
    map_room_card_camera: str | None = Field(default=None, pattern="^(snapshot|live|none)$", alias="map.room_card_camera")
    map_stack_backdrop: str | None = Field(default=None, pattern="^(theme|light|dark)$", alias="map.stack_backdrop")
    map_stack_pick: str | None = Field(default=None, pattern="^(two_tap|one_tap)$", alias="map.stack_pick")
    plan_quality: str | None = Field(default=None, pattern="^(auto|1|2)$", alias="plan.quality")
    plan_camsuggest_distance: str | None = Field(default=None, pattern="^([1-9]|[1-9][0-9]|100)$", alias="plan.camsuggest_distance")  # CAMSUGGEST138-295: 1-100 % of the plan width
    plan_camsuggest_fov: str | None = Field(default=None, pattern="^([0-9]|[1-9][0-9]|100)$", alias="plan.camsuggest_fov")  # 0-100 %
    plan_camsuggest_count: str | None = Field(default=None, pattern="^[1-3]$", alias="plan.camsuggest_count")  # 1-3 suggestions
    plan_presence_fade: str | None = Field(default=None, pattern="^(off|[1-9]|[1-9][0-9]|1[01][0-9]|120)$", alias="plan.presence_fade")  # off, or 1-120 minutes
    plan_surfaces: list[str] | None = Field(default=None, max_length=4, alias="plan.surfaces")  # each one of PLAN_SURFACES (checked in the handler)
    site_location_source: str | None = Field(default=None, pattern="^(home|manual)$", alias="site.location_source")  # CR-029 S2 (owner 2026-10-11)
    site_latitude: str | None = Field(default=None, max_length=12, pattern=r"^(|-?\d{1,3}(\.\d{1,6})?)$", alias="site.latitude")  # CR-029 S2: "" clears
    site_longitude: str | None = Field(default=None, max_length=12, pattern=r"^(|-?\d{1,3}(\.\d{1,6})?)$", alias="site.longitude")
    plan_view: dict[str, Any] | None = Field(default=None, alias="plan.view")  # CR-029 S0: a partial update of the dials, validated in full by services/plan_view.py
    plan_bakes: dict[str, Any] | None = Field(default=None, alias="plan.bakes")  # CR-029 S3: a partial update, validated in full by services/plan_bakes.py
    ai_provider: str | None = Field(default=None, pattern="^(none|local|external)$", alias="ai.provider")
    ai_privacy_ack: str | None = Field(default=None, pattern="^(true|false)$", alias="ai.privacy_ack")
    ai_budget_daily: int | None = Field(default=None, ge=0, le=100000, alias="ai.budget_daily")
    skins_provider: str | None = Field(default=None, pattern="^(openai)$", alias="skins.provider")
    skins_model: str | None = Field(default=None, pattern=r"^[a-z0-9][a-z0-9.\-]{1,63}$", alias="skins.model")
    skins_privacy_ack: str | None = Field(default=None, pattern="^(true|false)$", alias="skins.privacy_ack")
    skins_budget_renders_per_floor: int | None = Field(default=None, ge=0, le=6, alias="skins.budget_renders_per_floor")
    skins_budget_monthly: int | None = Field(default=None, ge=0, le=500, alias="skins.budget_monthly")
    access_ui_overview: str | None = Field(default=None, pattern="^(wiskey|smplwise)$", alias="access.ui.overview")
    access_ui_events: str | None = Field(default=None, pattern="^(wiskey|smplwise)$", alias="access.ui.events")
    access_ui_people: str | None = Field(default=None, pattern="^(wiskey|smplwise)$", alias="access.ui.people")
    access_ui_stations: str | None = Field(default=None, pattern="^(wiskey|smplwise)$", alias="access.ui.stations")  # CR-036 S6
    access_ui_schedules: str | None = Field(default=None, pattern="^(wiskey|smplwise)$", alias="access.ui.schedules")  # CR-036 S9
    ui_hide_wiskey: str | None = Field(default=None, pattern="^(true|false)$", alias="ui.hide_wiskey")
    ui_wiskey_size: str | None = Field(default=None, pattern="^(normal|fit|full)$", alias="ui.wiskey_size")
    ui_wiskey_scale: str | None = Field(default=None, pattern="^(100|90|80|70)$", alias="ui.wiskey_scale")
    ui_wiskey_density: str | None = Field(default=None, pattern="^(auto|4|6|8|9|12)$", alias="ui.wiskey_density")
    ui_wiskey_wall: str | None = Field(default=None, pattern="^(auto|4|9|12)$", alias="ui.wiskey_wall")
    access_phone_embed: str | None = Field(default=None, pattern="^(true|false)$", alias="access.phone_embed")
    access_settings_layout: str | None = Field(default=None, pattern="^(cards|accordion|tabs|list)$", alias="access.settings_layout")  # SETTINGS-INTERCOM-CARDS-2401 / SETTINGS-CARDS-ACCORDION-2402
    access_employee_no_sensitive: str | None = Field(default=None, pattern="^(true|false)$", alias="access.employee_no_sensitive")  # CR-036 S3
    access_event_portrait_sensitive: str | None = Field(default=None, pattern="^(true|false)$", alias="access.event_portrait_sensitive")
    access_event_portrait_audit: str | None = Field(default=None, pattern="^(true|false)$", alias="access.event_portrait_audit")
    access_sync_errors_everyone: str | None = Field(default=None, pattern="^(true|false)$", alias="access.sync_errors_everyone")
    # SECFIX2-295: the uniform 404 for a restricted writer and a malformed person record he cannot see (default false = today's 403)
    access_unknown_person_uniform_404: str | None = Field(default=None, pattern="^(true|false)$", alias="access.unknown_person_uniform_404")
    access_call_hint: str | None = Field(default=None, pattern="^(everyone|call)$", alias="access.call_hint")  # CR-036 S6
    access_talk_button: str | None = Field(default=None, pattern="^(classic|hidden)$", alias="access.talk_button")
    access_announce_scope: str | None = Field(default=None, pattern="^(scope|station)$", alias="access.announce_scope")
    access_announce_phrases: str | None = Field(default=None, max_length=2000, alias="access.announce_phrases")  # one phrase per line
    # TTS-DEFAULT-ENGINE-2400: an HA TTS engine id (`tts.piper`, a legacy provider `google_translate`) or "" (the system default); a
    # language code (`he`, `en-US`, `zh_Hans`) or "" (automatic). WisKey's own bounds: engine 1..128, language <= 64.
    access_tts_engine: str | None = Field(default=None, max_length=128, pattern=TTS_ENGINE_PATTERN, alias="access.tts_engine")
    access_tts_language: str | None = Field(default=None, max_length=64, pattern=TTS_LANGUAGE_PATTERN, alias="access.tts_language")
    access_station_media: str | None = Field(default=None, pattern="^(off|video|video_talk)$", alias="access.station_media")  # CR-036 S18
    access_station_media_provider: str | None = Field(default=None, pattern="^(local|auto)$", alias="access.station_media_provider")  # REL2140 M-3
    access_station_media_max_talk_s: int | None = Field(default=None, ge=1, le=86400, alias="access.station_media_max_talk_s")  # W10CLIENT-295 / WKDIRECT-295
    access_station_listen: str | None = Field(default=None, pattern="^(off|on|probe)$", alias="access.station_listen")  # WKAUDIN-295
    devices_style: str | None = Field(default=None, pattern="^(smplwise|glass)$", alias="devices.style")
    devices_theme: str | None = Field(default=None, pattern="^(" + "|".join(DEVICE_THEMES) + ")$", alias="devices.theme")
    devices_default_view: str | None = Field(default=None, pattern="^(cards|tiles)$", alias="devices.default_view")
    devices_show_sensors: str | None = Field(default=None, pattern="^(true|false)$", alias="devices.show_sensors")
    devices_show_climate_strip: str | None = Field(default=None, pattern="^(true|false)$", alias="devices.show_climate_strip")
    devices_density: str | None = Field(default=None, pattern="^(comfortable|compact)$", alias="devices.density")
    devices_scheme: str | None = Field(default=None, pattern="^(light|dark|auto)$", alias="devices.scheme")
    devices_glass_scheme: str | None = Field(default=None, pattern="^(follow|light|dark)$", alias="devices.glass_scheme")  # 2.4.4
    devices_area_design: str | None = Field(default=None, pattern="^(tiles|sections)$", alias="devices.area_design")
    devices_area_row: dict[str, Any] | None = Field(default=None, alias="devices.area_row")  # validated in full by services/area_row.py
    devices_floor_row: dict[str, Any] | None = Field(default=None, alias="devices.floor_row")  # validated in full by services/area_row.py
    home_title: str | None = Field(default=None, max_length=60, alias="home.title")
    home_floor_order: str | None = Field(default=None, max_length=6000, alias="home.floor_order")
    home_clock: str | None = Field(default=None, pattern="^(off|time|datetime)$", alias="home.clock")
    home_weather: str | None = Field(default=None, pattern="^(true|false)$", alias="home.weather")
    home_weather_entity: str | None = Field(default=None, pattern=r"^(|weather\.[a-z0-9_]{1,100})$", alias="home.weather_entity")
    home_jewish: str | None = Field(default=None, pattern="^(true|false)$", alias="home.jewish")
    home_jewish_parsha: str | None = Field(default=None, pattern=r"^(|sensor\.[a-z0-9_]{1,100})$", alias="home.jewish_parsha")
    home_jewish_candles: str | None = Field(default=None, pattern=r"^(|sensor\.[a-z0-9_]{1,100})$", alias="home.jewish_candles")
    home_jewish_havdalah: str | None = Field(default=None, pattern=r"^(|sensor\.[a-z0-9_]{1,100})$", alias="home.jewish_havdalah")
    home_clock_size: str | None = Field(default=None, pattern="^(chip|medium|large)$", alias="home.clock_size")
    home_clock_seconds: str | None = Field(default=None, pattern="^(true|false)$", alias="home.clock_seconds")
    home_weather_size: str | None = Field(default=None, pattern="^(chip|medium|large)$", alias="home.weather_size")
    home_jewish_size: str | None = Field(default=None, pattern="^(chip|medium|large)$", alias="home.jewish_size")
    home_jewish_date: str | None = Field(default=None, pattern=r"^(|sensor\.[a-z0-9_]{1,100})$", alias="home.jewish_date")
    home_direction: str | None = Field(default=None, pattern="^(a|b|c)$", alias="home.direction")
    home_side: str | None = Field(default=None, pattern="^(start|end)$", alias="home.side")
    home_info_style: str | None = Field(default=None, pattern="^(auto|bar|cards)$", alias="home.info_style")  # HOME-295: auto = by the view
    home_floor_title_lines: str | None = Field(default=None, pattern="^(1|2|3)$", alias="home.floor_title_lines")  # POLISH-CONTROL-297
    ui_long_lists: str | None = Field(default=None, pattern="^(paged|scroll)$", alias="ui.long_lists")  # POLISH-CONTROL-297
    home_bulk_idle: str | None = Field(default=None, pattern="^(disabled|enabled)$", alias="home.bulk_idle")  # POLISH-CONTROL-297
    home_screen: dict[str, Any] | None = Field(default=None, alias="home.screen")  # HOME-295: a partial update, validated in full by services/home_screen_options.py
    home_widgets: dict[str, Any] | None = Field(default=None, alias="home.widgets")  # validated in full by services/home_config.py
    remote_policy: str | None = Field(default=None, pattern="^(flag|any_role)$", alias="remote.policy")
    remote_admins_default: str | None = Field(default=None, pattern="^(true|false)$", alias="remote.admins_default")
    remote_session: str | None = Field(default=None, pattern="^(rolling_90d|browser_session|rolling_90d_idle_lock)$", alias="remote.session")
    remote_idle_lock_minutes: int | None = Field(default=None, ge=5, le=10080, alias="remote.idle_lock_minutes")
    remote_default_profile: str | None = Field(default=None, pattern="^(main|sub)$", alias="remote.default_profile")
    remote_wall_profile: str | None = Field(default=None, pattern="^(main|sub)$", alias="remote.wall_profile")
    remote_mse_fallback: str | None = Field(default=None, pattern="^(true|false)$", alias="remote.mse_fallback")
    security_second_factor_policy: str | None = Field(default=None, pattern="^(optional|admins)$", alias="security.second_factor_policy")
    security_second_factor_bearer: str | None = Field(default=None, pattern="^(enforce|off)$", alias="security.second_factor_bearer")
    remote_require_mfa_admin: str | None = Field(default=None, pattern="^(true|false)$", alias="remote.require_mfa_admin")
    security_local_identity: str | None = Field(default=None, pattern="^(on|off)$", alias="security.local_identity")  # USR2: system_admin only (checked below)
    security_local_identity_extended: str | None = Field(default=None, pattern="^(on|off)$", alias="security.local_identity_extended")  # SVCIDENT2: system_admin; on = local channel only, off = any channel (AMEND273)
    security_local_session: str | None = Field(default=None, pattern="^(rolling_30d|rolling_90d|browser_session)$", alias="security.local_session")
    security_local_admin_session_days: int | None = Field(default=None, ge=1, le=7, alias="security.local_admin_session_days")
    security_local_password_min: int | None = Field(default=None, ge=10, le=64, alias="security.local_password_min")
    privacy_local_purge: str | None = Field(default=None, pattern="^(on|off)$", alias="privacy.local_purge")  # IDENT146
    privacy_local_purge_days: int | None = Field(default=None, ge=30, le=3650, alias="privacy.local_purge_days")  # IDENT146: never below the owner's 30 days
    privacy_local_purge_confirm: str | None = Field(default=None, max_length=32, alias="privacy.local_purge_confirm")  # REL2140 M-1: the typed confirmation; never stored
    privacy_personal_export: str | None = Field(default=None, pattern="^(on|off)$", alias="privacy.personal_export")  # IDENT146
    backup_password_min: int | None = Field(default=None, ge=8, le=64, alias="backup.password_min")  # BACKUP-HASH-ENC: hard floor 8
    backup_offbox_restore_scope: str | None = Field(default=None, pattern=r"^(project|project\+access)$", alias="backup.offbox_restore_scope")  # OFFBOX-RESTORE-2300
    backup_local_restore_scope: str | None = Field(default=None, pattern=r"^(project|project\+access)$", alias="backup.local_restore_scope")  # OFFBOX-RESTORE-2300
    backup_safety_before_local_restore: str | None = Field(default=None, pattern="^(on|off)$", alias="backup.safety_before_local_restore")  # OFFBOX-RESTORE-2300
    security_local_link_ttl_h: int | None = Field(default=None, ge=1, le=168, alias="security.local_link_ttl_h")
    security_local_lock_mode: str | None = Field(default=None, pattern="^(delay|lock)$", alias="security.local_lock_mode")
    security_local_public_url: str | None = Field(default=None, max_length=300, alias="security.local_public_url")  # USR2 phase 2: system_admin only (checked below)
    security_local_passkey_first: str | None = Field(default=None, pattern="^(on|off)$", alias="security.local_passkey_first")  # USR2 phase 4: system_admin only
    security_local_passkey_android: str | None = Field(default=None, max_length=1200, alias="security.local_passkey_android")  # USR2 phase 4: system_admin only
    remote_max_live_streams: int | None = Field(default=None, ge=1, le=128, alias="remote.max_live_streams")
    remote_csp_enforce: str | None = Field(default=None, pattern="^(true|false)$", alias="remote.csp_enforce")
    app_android_url: str | None = Field(default=None, max_length=app_download.MAX_URL, alias="app.android_url")  # https only, checked in app_download.normalize
    app_android_version: str | None = Field(default=None, max_length=32, alias="app.android_version")
    app_android_sha256: str | None = Field(default=None, max_length=64, alias="app.android_sha256")
    alarm_remote_control: str | None = Field(default=None, pattern="^(true|false)$", alias="alarm.remote_control")
    alarm_remote_disarm: str | None = Field(default=None, pattern="^(true|false)$", alias="alarm.remote_disarm")
    alarm_code_mode: str | None = Field(default=None, pattern="^(personal_pin|panel_code)$", alias="alarm.code_mode")
    alarm_remote_codeless: str | None = Field(default=None, pattern="^(true|false)$", alias="alarm.remote_codeless")
    alarm_pin_min_length: str | None = Field(default=None, pattern="^[4-8]$", alias="alarm.pin_min_length")
    schedules_enabled: str | None = Field(default=None, pattern="^(true|false)$", alias="schedules.enabled")
    schedules_classes: list[str] | None = Field(default=None, max_length=17, alias="schedules.classes")  # each one of SCHEDULE_CLASSES (checked in the handler)
    schedules_snap_minutes: str | None = Field(default=None, pattern="^(5|15|30)$", alias="schedules.snap_minutes")
    schedules_default_repeat: str | None = Field(default=None, pattern="^(repeat|pause|single)$", alias="schedules.default_repeat")
    schedules_runs_retention_days: int | None = Field(default=None, ge=7, le=365, alias="schedules.runs_retention_days")
    device_activity_retention_days: int | None = Field(default=None, ge=7, le=365, alias="device_activity.retention_days")
    schedules_shabbat_sensor: str | None = Field(default=None, pattern=r"^(|binary_sensor\.[a-z0-9_]{1,100})$", alias="schedules.shabbat_sensor")
    schedules_shabbat_sensor_force: bool | None = Field(default=None, alias="schedules.shabbat_sensor_force")  # an explicit override; never stored
    schedules_allow_disarm: str | None = Field(default=None, pattern="^(true|false)$", alias="schedules.allow_disarm")
    schedules_allow_disarm_confirm: str | None = Field(default=None, max_length=32, alias="schedules.allow_disarm_confirm")  # the typed confirmation; never stored
    multimedia_enabled: str | None = Field(default=None, pattern="^(true|false)$", alias="multimedia.enabled")
    multimedia_remote_default: dict[str, Any] | None = Field(default=None, alias="multimedia.remote_default")  # validated in full by services/media_layout.py
    automations_enabled: str | None = Field(default=None, pattern="^(true|false)$", alias="automations.enabled")
    automations_code_view_roles: list[str] | None = Field(default=None, max_length=200, alias="automations.code_view_roles")
    automations_trash_days: int | None = Field(default=None, ge=7, le=90, alias="automations.trash_days")
    automations_versions_keep: int | None = Field(default=None, ge=5, le=50, alias="automations.versions_keep")
    automations_limits: dict[str, Any] | None = Field(default=None, alias="automations.limits")
    automations_storm_auto_disable: str | None = Field(default=None, pattern="^(true|false)$", alias="automations.storm_auto_disable")
    automations_sensitive_warning: str | None = Field(default=None, pattern="^(true|false)$", alias="automations.sensitive_warning")
    automations_templates_enabled: str | None = Field(default=None, pattern="^(true|false)$", alias="automations.templates_enabled")
    automations_templates_hidden: list[str] | None = Field(default=None, max_length=200, alias="automations.templates_hidden")
    automations_templates_order: list[str] | None = Field(default=None, max_length=200, alias="automations.templates_order")
    automations_notify_targets: list[str] | None = Field(default=None, max_length=200, alias="automations.notify_targets")
    automations_ask_when_on_new: str | None = Field(default=None, pattern="^(true|false)$", alias="automations.ask_when_on_new")
    automations_blueprints_enabled: str | None = Field(default=None, pattern="^(true|false)$", alias="automations.blueprints_enabled")
    automations_phone_filter: str | None = Field(default=None, pattern="^(fold|rows)$", alias="automations.phone_filter")
    automations_sensitive_chip: str | None = Field(default=None, pattern="^(amber|red)$", alias="automations.sensitive_chip")
    # KAV079-295: the editors' extension (services/automation_ext.py; every switch OFF by default)
    automations_wall_buttons_editable: str | None = Field(default=None, pattern="^(true|false)$", alias="automations.wall_buttons_editable")
    automations_wall_double_ms: int | None = Field(default=None, ge=150, le=1500, alias="automations.wall_double_ms")
    automations_wall_long_ms: int | None = Field(default=None, ge=300, le=5000, alias="automations.wall_long_ms")
    automations_wall_debounce_ms: int | None = Field(default=None, ge=0, le=500, alias="automations.wall_debounce_ms")
    automations_wall_listen_s: int | None = Field(default=None, ge=5, le=120, alias="automations.wall_listen_s")
    automations_precheck_enabled: str | None = Field(default=None, pattern="^(true|false)$", alias="automations.precheck_enabled")
    automations_conflict_window_min: int | None = Field(default=None, ge=1, le=120, alias="automations.conflict_window_min")
    automations_save_with_warnings: str | None = Field(default=None, pattern="^(true|false)$", alias="automations.save_with_warnings")
    automations_button_reuse: str | None = Field(default=None, pattern="^(warn|error)$", alias="automations.button_reuse")
    automations_device_test_enabled: str | None = Field(default=None, pattern="^(true|false)$", alias="automations.device_test_enabled")
    automations_device_test_end: str | None = Field(default=None, pattern="^(ask|restore|keep)$", alias="automations.device_test_end")
    automations_presence_entity: str | None = Field(default=None, pattern=r"^(|(binary_sensor|input_boolean)\.[a-z0-9_]{1,100})$", alias="automations.presence_entity")
    update_apply_enabled: str | None = Field(default=None, pattern="^(true|false)$", alias="update.apply_enabled")  # 2.4.4: CR-021 self-update switch
    tickets_enabled: str | None = Field(default=None, pattern="^(true|false)$", alias="tickets.enabled")  # CR-038: the tickets module switch
    emergency_readiness_enabled: str | None = Field(default=None, pattern="^(true|false)$", alias="emergency_readiness.enabled")  # CR-EMERG104: the readiness view switch
    maintenance_enabled: str | None = Field(default=None, pattern="^(true|false)$", alias="maintenance.enabled")  # CR-MAINT215: the maintenance module switch
    # CR-MAINT215 slice 2: the default lead per kind (0-365 days) and the sticker address (empty = the remote address)
    maintenance_lead_certificate: str | None = Field(default=None, pattern=LEAD_DAYS_PATTERN, alias="maintenance.lead_days.certificate")
    maintenance_lead_preventive: str | None = Field(default=None, pattern=LEAD_DAYS_PATTERN, alias="maintenance.lead_days.preventive")
    maintenance_lead_round: str | None = Field(default=None, pattern=LEAD_DAYS_PATTERN, alias="maintenance.lead_days.round")
    maintenance_lead_vendor_document: str | None = Field(default=None, pattern=LEAD_DAYS_PATTERN, alias="maintenance.lead_days.vendor_document")
    maintenance_tag_base_url: str | None = Field(default=None, max_length=300, pattern=r"^(https://[A-Za-z0-9.-]+(:[0-9]{1,5})?(/[A-Za-z0-9._~/%-]*)?)?$", alias="maintenance.tag_base_url")
    maintenance_reminders_enabled: str | None = Field(default=None, pattern="^(true|false)$", alias="maintenance.reminders_enabled")  # MAINT215B
    maintenance_round_phone_view: str | None = Field(default=None, pattern="^(step|list)$", alias="maintenance.round_phone_view")
    maintenance_close_request_mode: str | None = Field(default=None, pattern="^(ask|auto|off)$", alias="maintenance.close_request_mode")
    maintenance_reminder_check_minutes: str | None = Field(default=None, pattern=r"^([1-9][0-9]{0,2}|1[0-3][0-9]{2}|14[0-3][0-9]|1440)$", alias="maintenance.reminder_check_minutes")
    maintenance_reminder_log_keep_days: str | None = Field(default=None, pattern=r"^([7-9]|[1-9][0-9]{1,2}|[1-2][0-9]{3}|3[0-5][0-9]{2}|36[0-4][0-9]|3650)$", alias="maintenance.reminder_log_keep_days")
    maintenance_vendor_missing_insurance_mark: str | None = Field(default=None, pattern="^(true|false)$", alias="maintenance.vendor_missing_insurance_mark")
    maintenance_vendor_insurance_warn_days: str | None = Field(default=None, pattern=LEAD_DAYS_PATTERN, alias="maintenance.vendor_insurance_warn_days")
    maintenance_file_max_per_task: str | None = Field(default=None, pattern=r"^([1-9]|[1-4][0-9]|50)$", alias="maintenance.file_max_per_task")
    docread_enabled: str | None = Field(default=None, pattern="^(true|false)$", alias="docread.enabled")  # SUPPLIERDOCS-297 (OFF by default)

    model_config = {"populate_by_name": True}


def _capacity_info(conn: sqlite3.Connection) -> dict[str, Any]:
    """`nvr_channels` (None = unknown) and `warnings` ([{key, message}]): advisory only, a warning never blocks a save."""
    channels = nvr_capacity.recorder_channels(conn)
    warnings = []
    for key, fn in (
        ("playback.max_sessions", nvr_capacity.playback_sessions_warning),
        ("media.max_live_sessions", nvr_capacity.live_sessions_warning),
        ("remote.max_live_streams", nvr_capacity.remote_live_streams_warning),
    ):
        text = fn(int(get_setting(conn, key, DEFAULTS[key]) or DEFAULTS[key]), channels)
        if text:
            warnings.append({"key": key, "message": text})
    return {"nvr_channels": channels, "warnings": warnings}


@router.get("/settings")
def get_settings(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    can_edit = authorize(conn, principal, "system.configure", INSTALLATION).allowed
    from .search import search_allowed

    return {"settings": read_settings(conn, private=can_edit), "can_edit": can_edit, "search_allowed": search_allowed(conn, principal), **_capacity_info(conn)}


@router.patch("/settings")
def patch_settings(body: SettingsPatch, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    patch = settings_patch.Patch(conn, request, principal, {k: v for k, v in body.model_dump(by_alias=True).items() if v is not None})
    settings_patch.apply(patch)  # every check in its order, then the store, the followers and the audit rows (routers/settings_patch)
    return {"settings": read_settings(conn, private=True), "can_edit": True, **_capacity_info(conn)}
