"""`PATCH /settings`: the screen-content keys - the home screen options, the live plan (surfaces, realistic 3D dials, the
prepared images), the site position, the schedule device classes, the automations lists and limits, the default remote and the
Android download."""
from __future__ import annotations

from ...db import get_setting
from ...errors import ApiError
from ...services import app_download, automation_settings, home_screen_options, media_layout, plan_bakes, plan_view
from ...services.settings_store import DEFAULTS, PLAN_SURFACES, SCHEDULE_CLASSES
from . import Handler, Patch
from .ui import normalised


def home_screen(patch: Patch) -> None:
    changes, conn = patch.changes, patch.conn
    if "home.screen" in changes:
        try:  # HOME-295: a partial update over the stored options (the defaults when nothing was saved)
            changes["home.screen"] = home_screen_options.normalize(changes["home.screen"], home_screen_options.stored(get_setting(conn, "home.screen", "")))
        except ValueError as exc:
            raise ApiError(422, "validation", "אפשרויות המסך הראשי: ערך לא תקין.", details={"home.screen": str(exc)})


def plan_surfaces(patch: Patch) -> None:
    changes = patch.changes
    if "plan.surfaces" in changes:
        bad = [c for c in changes["plan.surfaces"] if c not in PLAN_SURFACES]
        if bad:
            raise ApiError(422, "validation", "מיקומי התוכנית החיה: ערך לא מוכר.", details={"plan.surfaces": bad})
        changes["plan.surfaces"] = [c for c in PLAN_SURFACES if c in changes["plan.surfaces"]]


def plan_view_dials(patch: Patch) -> None:
    changes, conn = patch.changes, patch.conn
    if "plan.view" in changes:
        try:  # a partial update over the stored dials (the defaults when nothing was saved)
            changes["plan.view"] = plan_view.normalize_site(changes["plan.view"], plan_view.stored_site(get_setting(conn, "plan.view", DEFAULTS["plan.view"])))
        except ValueError as exc:
            raise ApiError(422, "validation", "הגדרות התלת־ממד הריאליסטי: ערך לא תקין.", details={"plan.view": str(exc)})


def site_position(patch: Patch) -> None:
    changes = patch.changes
    for key, limit in (("site.latitude", 90.0), ("site.longitude", 180.0)):  # CR-029 S2: degrees inside their range
        if key in changes and changes[key] != "" and abs(float(changes[key])) > limit:
            raise ApiError(422, "validation", "מיקום האתר: קו רוחב בין -90 ל-90, קו אורך בין -180 ל-180.", details={key: changes[key]})


def plan_bakes_setting(patch: Patch) -> None:
    changes, conn = patch.changes, patch.conn
    if "plan.bakes" in changes:
        try:  # a partial update over the stored value (the defaults when nothing was saved)
            changes["plan.bakes"] = plan_bakes.normalize_setting(changes["plan.bakes"], plan_bakes.stored_setting(get_setting(conn, "plan.bakes", DEFAULTS["plan.bakes"])))
        except ValueError as exc:
            raise ApiError(422, "validation", "הגדרות התמונות המוכנות: ערך לא תקין.", details={"plan.bakes": str(exc)})


def schedule_classes(patch: Patch) -> None:
    changes = patch.changes
    if "schedules.classes" in changes:
        bad = [c for c in changes["schedules.classes"] if c not in SCHEDULE_CLASSES]
        if bad:
            raise ApiError(422, "validation", "סוגי התקנים בתזמונים: ערך לא מוכר.", details={"schedules.classes": bad})
        changes["schedules.classes"] = [c for c in SCHEDULE_CLASSES if c in changes["schedules.classes"]]


def automation_json(patch: Patch) -> None:
    changes = patch.changes
    for key in automation_settings.JSON_KEYS:  # CR-017: validated in full before anything is stored
        if key in changes:
            try:
                changes[key] = automation_settings.normalize(key, changes[key])
            except ValueError as exc:
                raise ApiError(422, "validation", "הגדרות האוטומציות: ערך לא תקין.", details={key: str(exc)})


def android_download(patch: Patch) -> None:
    app_download.normalize(patch.changes)


VALIDATORS: dict[str, Handler] = {
    "home.screen": home_screen,
    "plan.surfaces": plan_surfaces,
    "plan.view": plan_view_dials,
    "site.": site_position,  # site.latitude, site.longitude
    "plan.bakes": plan_bakes_setting,
    "schedules.classes": schedule_classes,
    "automations.": automation_json,
    "multimedia.remote_default": normalised("multimedia.remote_default", media_layout.normalise_remote_config, "הגדרת השלט: ערך לא תקין."),
    "app.android_": android_download,
}
