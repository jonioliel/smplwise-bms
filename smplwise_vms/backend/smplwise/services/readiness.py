"""CR-FLEET215 part 2: the installation readiness score - "the installation is 78% ready" with a closed list of what is missing.

A checklist computed ONLY from state the add-on already keeps: the setup wizard's step statuses (services/setup_wizard.build_state, which
never touches a device - the device steps show the background jobs' last knowledge), the backup folder, a few counts in the database and
the data disk. No probe, no write, no network. The same function feeds the Settings card (GET /readiness) and the fleet report's
`readiness` block (ids only).

Rules (docs/changes/CR-FLEET215.md section 8):
- every item has a fixed weight; `required` items decide `ready` (all required items met), the score is
  round(100 * met weight / applicable weight);
- an item that does not apply to this installation (no NVR in the NVR-less mode, service departments while the service module is off) is
  `met: None` and counts neither way - it is never shown as missing;
- `missing` lists the ids of applicable, unmet items: required ones first, then by weight;
- the output carries ids, plain-language labels (he / en) and a settings link - never a name, an address or any evidence detail of the
  underlying checks (a wizard step's evidence lists floor and camera names; none of it is copied here)."""
from __future__ import annotations

import datetime as dt
import shutil
import sqlite3
from dataclasses import dataclass
from typing import Any

from ..config import Settings
from ..db import get_setting, now_iso
from . import backup as backup_svc
from . import setup_wizard

BACKUP_MAX_AGE_H = 48
DISK_MIN_FREE_BYTES = 2 * 1024**3
DISK_MIN_FREE_RATIO = 0.10


@dataclass(frozen=True)
class Item:
    id: str
    weight: int
    required: bool
    he: str
    en: str
    hint_he: str
    hint_en: str
    link: str  # a setup_wizard.LINKS key


ITEMS: tuple[Item, ...] = (
    Item("addon_healthy", 3, True, "המערכת עצמה תקינה", "The system itself is healthy",
         "בסיס הנתונים או תיקיית הנתונים אינם תקינים, או שהדיסק כמעט מלא.", "The database or the data folder is not healthy, or the disk is almost full.", "health"),
    Item("recorder_connected", 3, True, "מקליט מחובר", "Recorder connected",
         "חברו את המקליט בהגדרות › חיבורים.", "Connect the recorder in Settings › Connections.", "connections"),
    Item("home_system_connected", 3, True, "תשתית המערכת והגשר מחוברים", "Home system and bridge connected",
         "בדקו את החיבור לתשתית המערכת ואת צימוד הגשר.", "Check the home system connection and the bridge pairing.", "ha"),
    Item("media_server", 3, True, "שרת המדיה פעיל", "Media server running",
         "הגדירו את שרת המדיה ובדקו שהוא עונה.", "Configure the media server and check that it answers.", "media"),
    Item("system_admin", 3, True, "יש מנהל מערכת", "A system administrator is assigned",
         "שייכו לפחות אדם אחד לתפקיד מנהל מערכת.", "Assign at least one person the system administrator role.", "access"),
    Item("backup_recent", 3, True, "גיבוי מהיומיים האחרונים", "A backup from the last two days",
         "צרו גיבוי עכשיו או בדקו שהגיבוי היומי פועל.", "Create a backup now or check that the daily backup runs.", "health"),
    Item("floor_plan_published", 2, False, "תוכנית קומה פורסמה", "A floor plan is published",
         "העלו תוכנית לקומה ופרסמו אותה.", "Upload a floor plan and publish it.", "sites"),
    Item("camera_on_map", 2, False, "מצלמה מוצבת על המפה", "A camera is placed on the map",
         "הציבו מצלמה בעורך התוכנית.", "Place a camera in the plan editor.", "sites"),
    Item("alert_receivers", 2, False, "יש מי שמקבל התראות", "Someone receives alerts",
         "הפעילו התראות בדפדפן או באפליקציה אצל לפחות אדם אחד.", "Turn on browser or app notifications for at least one person.", "general"),
    Item("disk_space", 2, False, "מקום פנוי בדיסק", "Free disk space",
         "פנו מקום: ייצואים וגיבויים ישנים.", "Free some space: old exports and backups.", "health"),
    Item("backup_offsite", 1, False, "גיבוי מחוץ לשרת", "Off-site backup",
         "הגדירו יעד גיבוי חיצוני.", "Set up an off-site backup destination.", "general"),
    Item("more_people", 1, False, "אנשים נוספים קיבלו הרשאות", "More people have access",
         "הוסיפו אנשים ושייכו להם תפקידים.", "Add people and assign them roles.", "access"),
    Item("service_departments", 1, False, "מחלקות שירות הוגדרו", "Service departments are set up",
         "הגדירו לפחות מחלקה אחת במודול השירות.", "Set up at least one department in the service module.", "general"),
    Item("up_to_date", 1, False, "גרסה עדכנית", "Up to date",
         "יש עדכון זמין; עדכנו בהגדרות › עדכונים.", "An update is available; update in Settings › Updates.", "general"),
)
ITEM_IDS: tuple[str, ...] = tuple(i.id for i in ITEMS)
_BY_ID = {i.id: i for i in ITEMS}


def _table(conn: sqlite3.Connection, name: str) -> bool:
    return conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (name,)).fetchone() is not None


def _count(conn: sqlite3.Connection, table: str, sql: str, args: tuple = ()) -> int:
    if not _table(conn, table):
        return 0
    try:
        return int(conn.execute(sql, args).fetchone()[0] or 0)
    except sqlite3.Error:
        return 0


def _age_h(iso: str | None, now: dt.datetime) -> float | None:
    if not iso:
        return None
    try:
        t = dt.datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
    except ValueError:
        return None
    if t.tzinfo is None:
        t = t.replace(tzinfo=dt.timezone.utc)
    return max(0.0, (now - t).total_seconds() / 3600)


def facts(settings: Settings, conn: sqlite3.Connection, *, now: dt.datetime | None = None, wizard: dict[str, Any] | None = None) -> dict[str, Any]:
    """The raw inputs (no names, counts and statuses only). `wizard` lets a caller pass a state it already built."""
    now = now or dt.datetime.now(dt.timezone.utc)
    state = wizard if wizard is not None else setup_wizard.build_state(settings, conn, "background")
    steps = {s["id"]: s["status"] for s in state.get("steps", [])}
    backups = backup_svc.list_backups(settings)
    try:
        du = shutil.disk_usage(settings.data_dir)
        free, total = du.free, du.total
    except OSError:
        free = total = None
    return {
        "steps": steps,
        "backup_age_h": _age_h(backups[0]["created_at"], now) if backups else None,
        "system_admins": setup_wizard._system_admins(conn),
        "offbox_targets": _count(conn, "backup_offbox_targets", "SELECT COUNT(*) FROM backup_offbox_targets WHERE enabled = 1"),
        "alert_receivers": _count(conn, "push_subscriptions", "SELECT COUNT(*) FROM push_subscriptions")
        + _count(conn, "mobile_devices", "SELECT COUNT(*) FROM mobile_devices"),
        "people_with_access": _count(conn, "bindings", """SELECT COUNT(DISTINCT u.id) FROM users u JOIN bindings b ON b.subject_kind = 'user' AND b.subject_id = u.id
                                                            WHERE u.active = 1 AND b.effect = 'allow' AND b.revoked_at IS NULL AND (b.expires_at IS NULL OR b.expires_at > ?)""", (now_iso(),)),
        "tickets_enabled": (get_setting(conn, "tickets.enabled", "false") or "false") == "true",
        "departments": _count(conn, "ticket_departments", "SELECT COUNT(*) FROM ticket_departments WHERE active = 1 AND deleted_at IS NULL"),
        "disk_free": free, "disk_total": total,
        "update_available": (get_setting(conn, "update.available") or "") == "true",
    }


def _met(item_id: str, f: dict[str, Any]) -> bool | None:
    st = f["steps"]

    def step(sid: str) -> bool | None:
        s = st.get(sid)
        if s == "not_applicable":
            return None
        return s == "done"

    if item_id == "addon_healthy":
        return step("install") is True
    if item_id == "recorder_connected":
        return step("nvr")
    if item_id == "home_system_connected":
        return step("ha") is True
    if item_id == "media_server":
        return step("go2rtc")
    if item_id == "system_admin":
        return f["system_admins"] >= 1
    if item_id == "backup_recent":
        return f["backup_age_h"] is not None and f["backup_age_h"] <= BACKUP_MAX_AGE_H
    if item_id == "floor_plan_published":
        return step("floor") is True
    if item_id == "camera_on_map":
        return step("camera")
    if item_id == "alert_receivers":
        return f["alert_receivers"] >= 1
    if item_id == "disk_space":
        free, total = f["disk_free"], f["disk_total"]
        if free is None or not total:
            return False
        return free >= DISK_MIN_FREE_BYTES and free / total >= DISK_MIN_FREE_RATIO
    if item_id == "backup_offsite":
        return f["offbox_targets"] >= 1
    if item_id == "more_people":
        return f["people_with_access"] >= 2
    if item_id == "service_departments":
        return (f["departments"] >= 1) if f["tickets_enabled"] else None  # owner rule: no service item at all while the module is off
    if item_id == "up_to_date":
        return not f["update_available"]
    raise KeyError(item_id)  # pragma: no cover - ITEMS and _met are kept in step by a test


def score(f: dict[str, Any]) -> dict[str, Any]:
    """Pure: the checklist from the facts (tests feed facts directly)."""
    items = []
    for it in ITEMS:
        m = _met(it.id, f)
        items.append({"id": it.id, "met": m, "required": it.required, "weight": it.weight, "label": {"he": it.he, "en": it.en},
                      "hint": None if m is not False else {"he": it.hint_he, "en": it.hint_en},
                      "link": {"href": setup_wizard.LINKS[it.link][0]}})
    applicable = [i for i in items if i["met"] is not None]
    total_w = sum(i["weight"] for i in applicable)
    met_w = sum(i["weight"] for i in applicable if i["met"])
    missing = sorted((i for i in applicable if not i["met"]), key=lambda i: (not i["required"], -i["weight"], ITEM_IDS.index(i["id"])))
    return {
        "score": round(100 * met_w / total_w) if total_w else 0,
        "ready": all(i["met"] for i in applicable if i["required"]),
        "met": sum(1 for i in applicable if i["met"]), "total": len(applicable),
        "missing": [i["id"] for i in missing],
        "items": items,
    }


def compute(settings: Settings, conn: sqlite3.Connection, *, now: dt.datetime | None = None, wizard: dict[str, Any] | None = None) -> dict[str, Any]:
    return {**score(facts(settings, conn, now=now, wizard=wizard)), "checked_at": now_iso()}
