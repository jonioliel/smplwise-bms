"""`PATCH /settings`: the appearance keys - the deprecated design names, the tab bars, navigation size, look, palettes, the
per-group drop-down options, phone and cross-section options, timeline and brand colours, the area and floor rows."""
from __future__ import annotations

import json
from typing import Any, Callable

from ...errors import ApiError
from ...services import area_row, brand_colors, dd_style, look, mobile_options, nav_size, palettes, tabs_mode, timeline_colors, xs_options
from ...services.settings_store import normalize_tabs
from . import Handler, Patch


def normalised(key: str, normalize: Callable[[Any], Any], message: str | None) -> Handler:
    """A handler for one JSON key: the value is replaced by `normalize(value)`; a ValueError is a 422 with `message` (the
    error's own text when `message` is None) and the error text under the key."""
    def handler(patch: Patch) -> None:
        changes = patch.changes
        if key in changes:
            try:
                changes[key] = normalize(changes[key])
            except ValueError as exc:
                raise ApiError(422, "validation", str(exc) if message is None else message, details={key: str(exc)})

    return handler


def design_names(patch: Patch) -> None:
    changes = patch.changes
    if "ui.design_names" in changes:
        try:
            names = json.loads(changes["ui.design_names"])
            assert isinstance(names, dict) and set(names) <= {"a", "b"} and all(isinstance(v, str) and 1 <= len(v.strip()) <= 24 for v in names.values())
        except (ValueError, AssertionError):
            raise ApiError(422, "validation", "שמות העיצובים: אובייקט עם a ו־b, עד 24 תווים לכל שם.")
        changes["ui.design_names"] = json.dumps({"a": names.get("a", "SW A").strip(), "b": names.get("b", "SW B").strip()}, ensure_ascii=False)


def tabs(patch: Patch) -> None:
    changes = patch.changes
    if "ui.tabs" in changes:
        changes["ui.tabs"] = normalize_tabs(changes["ui.tabs"])


def brand_colour(key: str) -> Handler:
    def handler(patch: Patch) -> None:
        changes = patch.changes
        if key in changes:
            try:
                changes[key] = brand_colors.normalize(changes[key], key)
            except ValueError as exc:
                raise ApiError(422, "validation", "צבע: ברירת מחדל, צבע מוכן, קוד ‎#rrggbb, ולמתג גם \"כמו הצבע הראשי\".", details={key: str(exc)})

    return handler


VALIDATORS: dict[str, Handler] = {
    "ui.design_names": design_names,
    "ui.tabs": tabs,
    "ui.nav_size": normalised("ui.nav_size", nav_size.normalize, "גודל הניווט: ערך לא תקין."),
    "ui.look": normalised("ui.look", look.normalize, "מראה: ערך לא תקין."),
    "ui.palettes": normalised("ui.palettes", palettes.normalize_customs, None),
    "ui.tabs_mode_groups": normalised("ui.tabs_mode_groups", tabs_mode.normalize_groups, "תצוגת לשוניות לפי קבוצה: ערך לא תקין."),
    "ui.dd_style_groups": normalised("ui.dd_style_groups", dd_style.normalize_groups, "סגנון תפריט נפתח לפי קבוצה: ערך לא תקין."),
    "ui.dd_size_groups": normalised("ui.dd_size_groups", dd_style.normalize_size_groups, "גודל תפריט נפתח לפי קבוצה: ערך לא תקין."),
    "ui.dd_ring_groups": normalised("ui.dd_ring_groups", dd_style.normalize_ring_groups, "עובי טבעת לפי קבוצה: ערך לא תקין."),
    "ui.dd_panel_groups": normalised("ui.dd_panel_groups", dd_style.normalize_panel_groups, "רוחב לוח פתוח לפי קבוצה: ערך לא תקין."),
    "ui.mobile": normalised("ui.mobile", mobile_options.normalize, "אפשרויות נייד: ערך לא תקין."),
    "ui.xs": normalised("ui.xs", xs_options.normalize, "אפשרויות חתך הבניין: ערך לא תקין."),
    "timeline.colors": normalised("timeline.colors", timeline_colors.normalize, "צבעי ציר הזמן: ערך לא תקין."),
    **{key: brand_colour(key) for key in brand_colors.KEYS},
    "devices.area_row": normalised("devices.area_row", area_row.normalize_area, "מה מוצג ליד שם האזור: ערך לא תקין."),
    "devices.floor_row": normalised("devices.floor_row", area_row.normalize_floor, "מה מוצג בכותרת הקומה: ערך לא תקין."),
}
