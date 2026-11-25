"""Response models of routers/announcements.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset()


class AnnouncementsAreasArea(ExactModel):
    area_id: str
    name: str
    floor_name: str
    devices: list[dict[str, str]]
    screens: Num


class AnnouncementsAreasTemplateName(ExactModel):
    he: str
    en: str
    ru: str
    ar: str


class AnnouncementsAreasTemplate(ExactModel):
    id: str
    kind: str
    name: AnnouncementsAreasTemplateName
    text: AnnouncementsAreasTemplateName


class AnnouncementsAreas(ExactModel):
    enabled: bool
    areas: list[AnnouncementsAreasArea]
    max_text: Num
    templates: list[AnnouncementsAreasTemplate]
    languages: list[str]
    default_language: str
    emergency_languages: list[str]
    quiet_mode: str
    screens_enabled: bool
    screens_default_on: bool
    translate_enabled: bool
    translate_targets: list[str]


class AnnouncementsSpeak(ExactModel):
    id: str
    status: str
    targets: Num
    screens: Num = None
    release_at: str = None


class AnnouncementsEmergency(ExactModel):
    id: str
    status: str
    targets: Num
    screens: Num = None


class AnnouncementsConfigSpeaker(ExactModel):
    key: str
    name: str
    kind: str
    floor_name: str | None
    area_id: str | None
    area_name: str | None
    allowed: bool


class AnnouncementsConfigEngineInfoItem(ExactModel):
    entity_id: str
    name: str
    platform: str
    cloud: bool


class AnnouncementsConfigHistoryItem(ExactModel):
    id: str
    at: str
    source: str
    username: str
    rule_id: Any
    scope: str
    scope_ref: str
    message: str
    status: str
    error: str | None
    template_id: Any
    release_at: Any
    targets: Num
    notes: list[Any]
    languages: list[str]
    critical: bool
    screens: Num
    screen_until: Any
    machine_translated: list[Any]


class AnnouncementsConfigScreenOptionsScreen(ExactModel):
    key: str
    kind: str
    name: str
    area_id: str | None
    allowed: bool
    device_key: Any


class AnnouncementsConfigScreenOptionsDevice(ExactModel):
    key: str
    name: str
    area_id: str


class AnnouncementsConfigScreenOptions(ExactModel):
    screens: list[AnnouncementsConfigScreenOptionsScreen]
    devices: list[AnnouncementsConfigScreenOptionsDevice]


class AnnouncementsConfig(ExactModel):
    config: dict[str, Any]
    speakers: list[AnnouncementsConfigSpeaker]
    engines: list[str]
    engine_info: list[AnnouncementsConfigEngineInfoItem]
    history: list[AnnouncementsConfigHistoryItem]
    templates: list[AnnouncementsAreasTemplate]
    screen_options: AnnouncementsConfigScreenOptions


class AnnouncementsPutConfigHistoryItem(ExactModel):
    id: str
    at: str
    source: str
    username: str | None
    rule_id: Any
    scope: str
    scope_ref: str
    message: str
    status: str
    error: str | None
    template_id: str | None
    release_at: str | None
    targets: Num
    notes: list[Any]
    languages: list[str]
    critical: bool
    screens: Num
    screen_until: str | None
    machine_translated: list[str]


class AnnouncementsPutConfigScreenOptionsScreen(ExactModel):
    key: str
    kind: str
    name: str
    area_id: str | None
    allowed: bool
    device_key: str | None


class AnnouncementsPutConfigScreenOptions(ExactModel):
    screens: list[AnnouncementsPutConfigScreenOptionsScreen]
    devices: list[AnnouncementsConfigScreenOptionsDevice]


class AnnouncementsPutConfig(ExactModel):
    changed: list[str]
    config: dict[str, Any]
    speakers: list[AnnouncementsConfigSpeaker]
    engines: list[Any]
    engine_info: list[Any]
    history: list[AnnouncementsPutConfigHistoryItem]
    templates: list[AnnouncementsAreasTemplate]
    screen_options: AnnouncementsPutConfigScreenOptions


class AnnouncementsTranslateItem(ExactModel):
    language: str
    text: str
    machine: bool
    cached: bool


class AnnouncementsTranslate(ExactModel):
    """ANNOUNCE-297: draft translations for review (nothing is announced)."""
    provider: str
    source: str
    items: list[AnnouncementsTranslateItem]


class AnnouncementsTemplatesTemplate(ExactModel):
    id: str
    kind: str
    name: dict[str, str]
    text: dict[str, str]


class AnnouncementsTemplates(ExactModel):
    templates: list[AnnouncementsTemplatesTemplate]
    languages: list[str]


class AnnouncementsPutTemplatesTemplateName(ExactModel):
    he: str
    en: str = None


class AnnouncementsPutTemplatesTemplate(ExactModel):
    id: str
    kind: str
    name: AnnouncementsPutTemplatesTemplateName
    text: dict[str, str]


class AnnouncementsPutTemplates(ExactModel):
    templates: list[AnnouncementsPutTemplatesTemplate]


class AnnouncementsTestAnnouncement(ExactModel):
    id: str
    status: str
    targets: Num


class AnnouncementsStopScreens(ExactModel):
    """ANNOUNCEB-295: take an announcement off the screens now (the speech is not touched)."""
    stopped: bool


class AnnouncementsHistoryHistoryItem(ExactModel):
    id: str
    at: str
    source: str
    username: str | None
    rule_id: str | None
    scope: str
    scope_ref: str
    message: str
    status: str
    error: str | None
    template_id: Any
    release_at: Any
    targets: Num
    notes: list[str]
    languages: list[str]
    critical: bool
    screens: Num
    screen_until: str | None
    machine_translated: list[str]


class AnnouncementsHistory(ExactModel):
    history: list[AnnouncementsHistoryHistoryItem]
