"""HOME-V3-P2-2431: the home interface's family and building screens (approved mockup round 27, "home-full-v3", phase 2).

Everything here is a thin, read-mostly projection over modules that already exist; the writes go through the modules' own functions:

* `features` - what the person may see in phase 2, from each module's own switch and the person's own permissions (a capability whose
  module is off or whose permission is missing is simply absent; the home interface never grants anything).
* who is home (`presence_home`): owner decision 2026-11-11 (round 27 q4 "א"): the household sees each other, and each person can hide
  themself. The placement is THE rule of "who is in the building" (services/presence_people.place_device); the gate is the presence
  master switch plus `presence.report` anywhere (whoever takes part with a phone sees the others who take part). A person on the opt-out
  list (the same list as the full interface's, services/presence.set_opt_out) is never listed to anyone else - not even counted.
* nearby buses (`buses`): the notice-board digest of OUR transit cache (services/transit/digest.build) with a strip-shaped screen.
* weather (`weather`): the installation's first available weather entity, through the TV feed's own block (services/notices/sources).
* my notifications (`notify_get` / `notify_set`): the categories muted on ALL of the caller's own phones (services/mobile_push.set_muted,
  the same column the phone app writes) and the person's own "do not disturb" night window (table home_notify_quiet, migration 0214),
  which the phone push channel honours (mobile_push.AppPushChannel: never for a critical notification, an escalation or the categories
  in DND_PASS - the alarm and the doors, as the mockup says).
* scene schedules (`scene_schedules`, `scene_draft`): owner decision (round 27 q10 "א"): a family member can run, pause and create a
  schedule of a SCENE - never of a single device. Only schedules whose every action is `scene.turn_on` of a scene are listed or touched
  here; the writes are the schedules module's own operations (schedule_ops), with its permission (`schedule.manage`) and its checks.

Nothing here talks to a device. HA users, groups and admin flags are never touched.
"""
from __future__ import annotations

import datetime as dt
import json
import re
import sqlite3
from typing import Any

from ..db import get_setting, now_iso
from ..errors import ApiError
from ..rbac import Principal, permissions_anywhere

TIME_RE = re.compile(r"^([01][0-9]|2[0-3]):[0-5][0-9]$")
DAYS = ("sun", "mon", "tue", "wed", "thu", "fri", "sat")
# what "do not disturb" lets through (the mockup: "רק אזעקה ודלת מגיעות"); `safety` is critical anyway
DND_PASS = frozenset({"safety", "security", "doors"})
DND_DEFAULT = {"enabled": False, "start": "22:00", "end": "07:00"}
# the family words of the phone's notification categories (services/notify_policy.CATEGORIES); a category not listed keeps its own name
CATEGORY_WORDS = {"doors": "דלתות ואינטרקום", "security": "אזעקה וכניסות", "tickets": "עדכון בפנייה שלי", "building": "הודעות חדשות בלוח",
                  "alerts": "התראות מהבית", "device_faults": "תקלה במכשיר", "maintenance": "תחזוקה", "automations": "אוטומציות",
                  "system": "הודעות מערכת", "safety": "בטיחות"}
PEOPLE_MAX = 60


class HomeFamilyError(ApiError):
    pass


def _anywhere(conn: sqlite3.Connection, principal: Principal) -> set[str]:
    return set(permissions_anywhere(conn, principal))


# ---------------------------------------------------------------- what the person may see

def features(conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
    """Each phase-2 capability: `on` (its module / source exists and is switched on) and what the caller may do there."""
    from . import presence as P
    from .calendar import model as cal_model
    from .notices import store as notices_store
    from ..routers.settings import read_settings as schedule_settings
    from .tickets import access as tk
    from .transit import model as transit_model

    perms = _anywhere(conn, principal)
    try:
        cal_on = bool(cal_model.read_settings(conn)["enabled"])
    except Exception:  # noqa: BLE001 - a calendar settings row that does not read is "off", never a broken home screen
        cal_on = False
    from ..rbac import has_any_binding

    tcfg = transit_model.load_config(get_setting(conn, transit_model.CONFIG_KEY, ""))
    sched_on = schedule_settings(conn)["schedules.enabled"] == "true"
    phones = conn.execute("SELECT COUNT(*) FROM mobile_devices WHERE user_id = ? AND revoked_at IS NULL", (principal.user_id,)).fetchone()[0]
    return {
        "presence": {"on": bool(P.load_settings(conn)["enabled"]), "can": "presence.report" in perms},
        "calendar": {"on": cal_on, "view": cal_model.PERM_VIEW in perms, "book": cal_model.PERM_BOOK in perms},
        "notices": {"on": notices_store.module_on(conn), "can": "notices.view" in perms or has_any_binding(conn, principal)},
        "transit": {"on": bool(tcfg["enabled"] and tcfg["stops"])},
        "tickets": {"on": tk.module_on(conn), "create": tk.CREATE in perms, "view": tk.VIEW in perms},
        "schedules": {"on": sched_on, "view": "schedule.view" in perms or "schedule.manage" in perms, "manage": "schedule.manage" in perms},
        "scenes": {"capture": "scene.manage" in perms},
        "weather": weather_entity(conn) is not None,
        "notif": {"phones": int(phones)},
    }


# ---------------------------------------------------------------- who is home

def presence_home(conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
    """The household: every active person with a phone that takes part (an acknowledged notice), at home (placed by the building rule)
    or away, newest first within each group. The caller is always first and sees their own hidden state; a hidden person is absent
    for everyone else. Names only - no floor, area or device leaves this function."""
    from . import presence as P
    from . import presence_people as pp

    st = P.load_settings(conn)
    hidden = set(P.opt_out_users(conn))
    me_hidden = principal.user_id in hidden
    out: dict[str, Any] = {"enabled": bool(st["enabled"]), "me_hidden": me_hidden, "people": []}
    if not st["enabled"]:
        return out
    now = P.now_utc()
    rows = conn.execute(
        "SELECT d.*, u.username, u.display_name FROM mobile_devices d JOIN users u ON u.id = d.user_id"
        " WHERE d.revoked_at IS NULL AND u.active = 1 AND d.notice_ack_version >= ?",
        (st["notice_version"],),
    ).fetchall()
    people: dict[str, dict[str, Any]] = {}
    for d in rows:
        uid = d["user_id"]
        if uid in hidden and uid != principal.user_id:
            continue
        p = people.setdefault(uid, {"user_id": uid, "name": d["display_name"] or d["username"] or "", "me": uid == principal.user_id, "home": False, "at": None})
        place = pp.place_device(conn, d, st, now)
        if place is not None:
            if not p["home"] or (place["at"] or "") > (p["at"] or ""):
                p["home"], p["at"] = True, place["at"]
            continue
        if p["home"]:
            continue
        pres = P._json(d["presence_json"], {})
        left = pres.get("at") if pres.get("inside") is False and isinstance(pres.get("at"), str) else None
        if left and (p["at"] is None or left > p["at"]):
            p["at"] = left
    listed = sorted(people.values(), key=lambda p: (not p["me"], not p["home"], -(dt.datetime.fromisoformat(p["at"].replace("Z", "+00:00")).timestamp() if p["at"] else 0), p["name"].casefold()))
    out["people"] = [{k: p[k] for k in ("user_id", "name", "me", "home", "at")} for p in listed[:PEOPLE_MAX]]
    out["home_count"] = sum(1 for p in listed if p["home"] and not (p["me"] and me_hidden))
    return out


# ---------------------------------------------------------------- nearby buses

def buses(conn: sqlite3.Connection, now: dt.datetime | None = None) -> dict[str, Any]:
    """The installation's stops as a short strip (the next arrivals, grouped by line): `state` off / fresh / cached / expired."""
    from .notices.sources import installation_tz
    from .transit import digest, model

    now = now or dt.datetime.now(dt.timezone.utc)
    screen = model.normalize_screen({"enabled": True, "layout": "strip", "window_min": 60, "rows": 4, "group": "always"})
    d = digest.build(conn, screen, now, installation_tz(conn))
    keep = ("state", "updated_hm", "rows", "groups", "stops", "realtime", "source_down", "next")
    return {k: d.get(k) for k in keep if k in d}


# ---------------------------------------------------------------- weather

def weather_entity(conn: sqlite3.Connection) -> str | None:
    r = conn.execute("SELECT entity_id FROM ha_entities WHERE domain = 'weather' AND removed_at IS NULL AND disabled = 0 AND available = 1 ORDER BY entity_id LIMIT 1").fetchone()
    return r["entity_id"] if r else None


def weather(conn: sqlite3.Connection, now: dt.datetime | None = None) -> dict[str, Any] | None:
    """Now (temperature, condition, feels-like, wind, rain chance when reported), the next hours and the next days, or None."""
    from .notices import sources

    eid = weather_entity(conn)
    if eid is None:
        return None
    now = now or dt.datetime.now(dt.timezone.utc)
    block = sources.weather_block(conn, eid, 8, "he", now, days=5)
    if block is None:
        return None
    row = conn.execute("SELECT state, attributes_json FROM ha_entities WHERE entity_id = ?", (eid,)).fetchone()
    try:
        a = json.loads(row["attributes_json"] or "{}") if row else {}
    except ValueError:
        a = {}

    def num(k: str) -> float | None:
        v = a.get(k)
        return round(float(v)) if isinstance(v, (int, float)) and not isinstance(v, bool) else None

    fc = [f for f in a.get("forecast") or [] if isinstance(f, dict)] if isinstance(a.get("forecast"), list) else []
    rain = next((f.get("precipitation_probability") for f in fc if isinstance(f.get("precipitation_probability"), (int, float))), None)
    block["now"].update({"condition": WEATHER_KIND.get(str(row["state"] if row else ""), "cloud"), "feels": num("apparent_temperature"), "wind": num("wind_speed"),
                         "wind_unit": a.get("wind_speed_unit") if isinstance(a.get("wind_speed_unit"), str) else None,
                         "humidity": num("humidity"), "rain": round(rain) if isinstance(rain, (int, float)) else None})
    # the feed draws rain as a cloud; the home screen tells them apart (the same entries, the raw condition per hour / day)
    tz = sources.installation_tz(conn)
    by_hm: dict[str, str] = {}
    by_day: dict[str, list[tuple[float, str]]] = {}
    for f in fc:
        try:
            when = dt.datetime.fromisoformat(str(f.get("datetime")).replace("Z", "+00:00"))
        except ValueError:
            continue
        when = when if when.tzinfo else when.replace(tzinfo=dt.timezone.utc)
        local = when.astimezone(tz)
        kind = WEATHER_KIND.get(str(f.get("condition")), "cloud")
        by_hm.setdefault(local.strftime("%H:%M"), kind)
        by_day.setdefault(local.date().isoformat(), []).append((abs(local.hour + local.minute / 60 - 12), kind))
    for hr in block.get("hours") or []:
        hr["condition"] = by_hm.get(hr["at"], hr["condition"])
    for d in block.get("days") or []:
        if by_day.get(d["date"]):
            d["condition"] = min(by_day[d["date"]])[1]
    return block


# the raw condition of a weather source -> the home screen's icon kind
WEATHER_KIND = {"sunny": "sun", "clear-night": "night", "partlycloudy": "partly", "cloudy": "cloud", "fog": "fog", "rainy": "rain", "pouring": "rain",
                "hail": "rain", "lightning": "storm", "lightning-rainy": "storm", "snowy": "snow", "snowy-rainy": "snow", "windy": "wind",
                "windy-variant": "wind", "exceptional": "cloud"}


# ---------------------------------------------------------------- my notifications and "do not disturb"

def _dnd_row(conn: sqlite3.Connection, user_id: str) -> dict[str, Any]:
    try:
        r = conn.execute("SELECT enabled, start_hm, end_hm FROM home_notify_quiet WHERE user_id = ?", (user_id,)).fetchone()
    except sqlite3.OperationalError:  # a database before migration 0214: nobody has a night window
        return dict(DND_DEFAULT)
    return {"enabled": bool(r["enabled"]), "start": r["start_hm"], "end": r["end_hm"]} if r else dict(DND_DEFAULT)


def notify_get(conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
    """The caller's own: the categories (with family words; a critical one cannot be muted), which are muted on every phone (a category
    muted on only some phones reads as `partly`), how many phones, and the night window."""
    from . import mobile_push

    phones = conn.execute("SELECT push_muted_json FROM mobile_devices WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at", (principal.user_id,)).fetchall()
    muted_sets = [set(mobile_push._json(p["push_muted_json"], [])) for p in phones]
    cats = []
    for c in mobile_push.categories():
        n = sum(1 for m in muted_sets if c["id"] in m)
        cats.append({"id": c["id"], "name": CATEGORY_WORDS.get(c["id"], c["name"]), "critical": c["critical"],
                     "on": n == 0, "partly": 0 < n < len(muted_sets)})
    return {"phones": len(phones), "categories": cats, "dnd": _dnd_row(conn, principal.user_id), "dnd_pass": sorted(DND_PASS)}


def notify_set(conn: sqlite3.Connection, principal: Principal, muted: list[str] | None, dnd: dict[str, Any] | None) -> dict[str, Any]:
    from . import mobile_push
    from .notify_policy import CATEGORIES

    if muted is not None:
        bad = [m for m in muted if m not in CATEGORIES]
        if bad:
            raise HomeFamilyError(422, "validation", "סוג התראה לא מוכר.", details={"field": "muted"})
        clean = sorted({m for m in muted if m not in mobile_push.CRITICAL_CATEGORIES})
        for row in conn.execute("SELECT * FROM mobile_devices WHERE user_id = ? AND revoked_at IS NULL", (principal.user_id,)).fetchall():
            mobile_push.set_muted(conn, row, clean)
    if dnd is not None:
        cur = _dnd_row(conn, principal.user_id)
        new = {**cur, **{k: v for k, v in dnd.items() if k in ("enabled", "start", "end")}}
        if not isinstance(new["enabled"], bool) or not TIME_RE.match(str(new["start"])) or not TIME_RE.match(str(new["end"])) or new["start"] == new["end"]:
            raise HomeFamilyError(422, "validation", "שעות השקט אינן תקינות.", details={"field": "dnd"})
        conn.execute(
            """INSERT INTO home_notify_quiet (user_id, enabled, start_hm, end_hm, updated_at) VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(user_id) DO UPDATE SET enabled = excluded.enabled, start_hm = excluded.start_hm, end_hm = excluded.end_hm, updated_at = excluded.updated_at""",
            (principal.user_id, int(new["enabled"]), new["start"], new["end"], now_iso()),
        )
    return notify_get(conn, principal)


def dnd_active(conn: sqlite3.Connection, user_id: str, at: dt.datetime, tz_name: str) -> bool:
    """True while the person's own night window holds their phone pushes (the push channel calls it; a missing table / row = False)."""
    row = _dnd_row(conn, user_id)
    if not row["enabled"]:
        return False
    from zoneinfo import ZoneInfo

    try:
        local = at.astimezone(ZoneInfo(tz_name or "UTC"))
    except Exception:  # noqa: BLE001 - an unknown zone name: judge in UTC rather than drop every push
        local = at.astimezone(dt.timezone.utc)
    hm = local.strftime("%H:%M")
    s, e = row["start"], row["end"]
    return (s <= hm < e) if s < e else (hm >= s or hm < e)


# ---------------------------------------------------------------- scene schedules

def is_scene_schedule(item: dict[str, Any]) -> str | None:
    """The scene a schedule runs when its every action is `scene.turn_on` of one scene (the home interface's only kind), else None."""
    scenes: set[str] = set()
    for s in item.get("slots") or []:
        for a in s.get("actions") or []:
            eid = a.get("entity_id")
            if a.get("service") != "scene.turn_on" or not isinstance(eid, str) or not eid.startswith("scene."):
                return None
            scenes.add(eid)
    return next(iter(scenes)) if len(scenes) == 1 else None


def scene_draft(name: str, scene_entity: str, at: str, days: list[str]) -> dict[str, Any]:
    if not isinstance(scene_entity, str) or not re.match(r"^scene\.[a-z0-9_]{1,120}$", scene_entity):
        raise HomeFamilyError(422, "validation", "אפשר לתזמן כאן סצנה בלבד.", details={"field": "scene"})
    if not TIME_RE.match(at or ""):
        raise HomeFamilyError(422, "validation", "השעה אינה תקינה.", details={"field": "at"})
    want = [d for d in DAYS if d in set(days or [])]
    if not want:
        raise HomeFamilyError(422, "validation", "בחרו לפחות יום אחד.", details={"field": "days"})
    return {"name": name.strip()[:80] or None, "weekdays": ["daily"] if len(want) == 7 else want, "repeat": "repeat",
            "slots": [{"start": at, "actions": [{"service": "scene.turn_on", "entity_id": scene_entity}]}]}
