"""`PATCH /settings`: the keys checked against the site itself - the Shabbat and holiday sensor, the map's default floor, the
home screen title, floor order and widgets, the time zone and the analysis provider."""
from __future__ import annotations

import json

from ...errors import ApiError
from ...services import home_config
from ...services import settings_patch_site_store as store
from . import Patch


def shabbat_sensor(patch: Patch) -> None:
    changes, conn = patch.changes, patch.conn
    force_sensor = bool(changes.pop("schedules.shabbat_sensor_force", False))
    if changes.get("schedules.shabbat_sensor"):
        row = store.live_entity(conn, changes["schedules.shabbat_sensor"])
        if not row:
            raise ApiError(422, "validation", "חיישן השבת והחג לא נמצא.", details={"schedules.shabbat_sensor": changes["schedules.shabbat_sensor"]})
        from ...services import home_screen

        # the sensor's state is shown to schedule viewers and decides the presets: only a calendar sensor, unless an
        # administrator says explicitly that this one is right (`schedules.shabbat_sensor_force`)
        calendar_sensor = home_screen.is_jewish_calendar(dict(row)) or "issur_melacha" in row["entity_id"]
        patch.forced = force_sensor and not calendar_sensor
        if not force_sensor and not calendar_sensor:
            raise ApiError(422, "not_calendar_sensor", "זה לא נראה כחיישן של לוח השנה היהודי. לבחירה מפורשת שלחו schedules.shabbat_sensor_force.",
                           details={"schedules.shabbat_sensor": changes["schedules.shabbat_sensor"]})


def default_floor(patch: Patch) -> None:
    changes, conn = patch.changes, patch.conn
    if changes.get("map.default_floor") and not store.live_floor_row(conn, changes["map.default_floor"]):
        raise ApiError(422, "validation", "קומת ברירת המחדל של המפה לא קיימת.", details={"map.default_floor": changes["map.default_floor"]})


def home_title(patch: Patch) -> None:
    changes = patch.changes
    if "home.title" in changes:
        title = changes["home.title"].strip()
        if any(ord(c) < 32 or ord(c) == 127 for c in title):
            raise ApiError(422, "validation", "כותרת המסך: טקסט רגיל בלבד.", details={"home.title": "control_characters"})
        changes["home.title"] = title


def home_floor_order(patch: Patch) -> None:
    changes = patch.changes
    if "home.floor_order" in changes:
        from ...services import home_screen

        order = home_screen.normalise_floor_order(changes["home.floor_order"])
        if order is None:
            raise ApiError(422, "validation", "סדר הקומות: רשימה של מזהי קומות שונים זה מזה.", details={"home.floor_order": "invalid"})
        changes["home.floor_order"] = json.dumps(order, ensure_ascii=False)


def home_widgets(patch: Patch) -> None:
    changes = patch.changes
    if "home.widgets" in changes:
        # the whole widget configuration, validated in full; an empty object puts the setting back to "never saved" (the
        # default with the catalogue's suggestions)
        try:
            cfg = home_config.normalise(changes["home.widgets"]) if changes["home.widgets"] else None
        except ValueError as exc:
            raise ApiError(422, "validation", "הגדרות הווידג׳טים: ערך לא תקין.", details={"home.widgets": str(exc)})
        changes["home.widgets"] = cfg


def time_zone(patch: Patch) -> None:
    changes = patch.changes
    if "time.zone" in changes:
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

        try:
            ZoneInfo(changes["time.zone"])
        except (ZoneInfoNotFoundError, ValueError):
            raise ApiError(422, "validation", "אזור זמן לא מוכר.", details={"time.zone": changes["time.zone"]})


def ai_provider(patch: Patch) -> None:
    if patch.changes.get("ai.provider") == "external":
        # the adapter contract exists (privacy, model version, budget, opt-in) but no provider is bundled: refuse, never pretend
        raise ApiError(422, "provider_not_available", "לא מצורף ספק ניתוח חיצוני; קיים רק חוזה המתאם (פרטיות, גרסת מודל, תקציב, opt-in).", details={"choices": ["none", "local"]})
