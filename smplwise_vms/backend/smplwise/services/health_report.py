"""Health report (T033): one check per subsystem with its own status, so the operator sees which part is fine,
which is not configured and which is failing — never one green light for everything. Device probes are
cached for a short while so the settings page cannot hammer the NVR."""
from __future__ import annotations

import os
import shutil
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any

from .. import __version__
from ..config import Settings
from ..db import get_setting, now_iso, permission_revision
from . import autosync, events_derive, events_ingest, ha_client, ha_sync, thumbnails
from . import backup as backup_svc

PROBE_TTL_S = 20
STARTED = time.time()
_probe_lock = threading.Lock()
_probe_cache: dict[str, tuple[float, dict[str, Any]]] = {}


def _check(id: str, label: str, status: str, detail: str, **meta: Any) -> dict[str, Any]:
    return {"id": id, "label": label, "status": status, "detail": detail, "meta": meta}


def _dir_size(p: Path) -> int:
    total = 0
    if not p.exists():
        return 0
    for root, _dirs, files in os.walk(p):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass
    return total


def _fmt_bytes(n: int) -> str:
    if n >= 1024**3:
        return f"{n / 1024**3:.1f} GB"
    if n >= 1024**2:
        return f"{n / 1024**2:.0f} MB"
    return f"{n / 1024:.0f} KB"


def _age_s(iso: str | None) -> float | None:
    if not iso:
        return None
    import datetime as dt

    try:
        t = dt.datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return None
    return (dt.datetime.now(dt.timezone.utc) - t).total_seconds()


def _cached(key: str, fn) -> dict[str, Any]:
    now = time.time()
    with _probe_lock:
        hit = _probe_cache.get(key)
        if hit and now - hit[0] < PROBE_TTL_S:
            return hit[1]
    result = fn()
    with _probe_lock:
        _probe_cache[key] = (time.time(), result)
    return result


def invalidate() -> None:
    with _probe_lock:
        _probe_cache.clear()


def _probe_nvr(settings: Settings) -> dict[str, Any]:
    from . import nvr

    if not (settings.nvr_host and settings.nvr_user):
        return {"status": "warn", "detail": "ה־NVR לא מוגדר בהגדרות התוסף.", "configured": False}
    t0 = time.time()
    try:
        info = nvr.device_info(settings)
    except Exception as exc:  # noqa: BLE001 - the report must never fail because a device is down
        return {"status": "error", "detail": f"אין תשובה מה־NVR ({type(exc).__name__}).", "configured": True, "error": type(exc).__name__}
    return {"status": "ok", "detail": f"מחובר · {info.get('model') or 'דגם לא ידוע'} · קושחה {info.get('firmware') or '?'}", "configured": True, "model": info.get("model"), "firmware": info.get("firmware"), "ms": int((time.time() - t0) * 1000)}


def _probe_go2rtc(settings: Settings) -> dict[str, Any]:
    from .go2rtc import STREAM_PREFIX, Go2rtc

    if not settings.go2rtc_url:
        return {"status": "warn", "detail": "כתובת go2rtc לא הוגדרה.", "configured": False}
    try:
        g = Go2rtc(settings)
        info = g.info()
        streams = g.list_streams()
    except Exception as exc:  # noqa: BLE001
        return {"status": "error", "detail": f"go2rtc אינו זמין ({type(exc).__name__}).", "configured": True, "error": type(exc).__name__}
    ours = [s for s in streams if s.startswith(STREAM_PREFIX)]
    online = sum(1 for s in ours if streams[s].online)
    return {"status": "ok", "detail": f"גרסה {info.get('version', '?')} · {len(ours)} זרמים שלנו ({online} פעילים) · {len(streams) - len(ours)} זרמים זרים לא נגעו", "configured": True, "version": info.get("version"), "streams": len(ours), "online": online, "foreign": len(streams) - len(ours)}


def build(settings: Settings, conn: sqlite3.Connection, probe: bool = True) -> dict[str, Any]:
    checks: list[dict[str, Any]] = []

    # database
    try:
        integrity = conn.execute("PRAGMA quick_check").fetchone()[0]
        journal = conn.execute("PRAGMA journal_mode").fetchone()[0]
        db_bytes = settings.db_path.stat().st_size if settings.db_path.exists() else 0
        checks.append(_check("db", "מסד נתונים", "ok" if integrity == "ok" else "error", f"{'תקין' if integrity == 'ok' else integrity} · {journal.upper()} · {_fmt_bytes(db_bytes)} · סכימה {backup_svc.schema_version(conn)} · מהדורת הרשאות {permission_revision(conn)}", integrity=integrity, journal=journal, bytes=db_bytes, schema=backup_svc.schema_version(conn)))
    except sqlite3.Error as exc:
        checks.append(_check("db", "מסד נתונים", "error", f"שגיאת מסד: {type(exc).__name__}"))

    # storage
    try:
        du = shutil.disk_usage(settings.data_dir)
        sizes = {"plans": _dir_size(settings.plans_dir), "thumbs": _dir_size(settings.data_dir / "thumbs"), "backups": _dir_size(settings.data_dir / "backups"), "exports": _dir_size(settings.data_dir / "exports")}
        free_ratio = du.free / du.total if du.total else 1
        st = "error" if du.free < 512 * 1024**2 else "warn" if (du.free < 2 * 1024**3 or free_ratio < 0.10) else "ok"
        checks.append(_check("storage", "אחסון התוסף (/data)", st, f"פנוי {_fmt_bytes(du.free)} מתוך {_fmt_bytes(du.total)} · תוכניות {_fmt_bytes(sizes['plans'])} · תמונות אירועים {_fmt_bytes(sizes['thumbs'])} · גיבויים {_fmt_bytes(sizes['backups'])} · ייצוא {_fmt_bytes(sizes['exports'])}", free=du.free, total=du.total, **sizes))
    except OSError as exc:
        checks.append(_check("storage", "אחסון התוסף (/data)", "error", f"לא ניתן לקרוא את שטח הדיסק ({type(exc).__name__})"))

    # devices (probed, cached)
    if probe:
        nvr = _cached("nvr", lambda: _probe_nvr(settings))
        go = _cached("go2rtc", lambda: _probe_go2rtc(settings))
    else:
        nvr = {"status": "warn", "detail": "לא נבדק בבקשה זו."}
        go = {"status": "warn", "detail": "לא נבדק בבקשה זו."}
    checks.append(_check("nvr", "NVR (Hikvision ISAPI)", nvr["status"], nvr["detail"], **{k: v for k, v in nvr.items() if k not in ("status", "detail")}))
    checks.append(_check("go2rtc", "go2rtc (מדיה)", go["status"], go["detail"], **{k: v for k, v in go.items() if k not in ("status", "detail")}))

    # Home Assistant sync + bridge
    hs = ha_sync.STATE.as_dict()
    if not ha_client.configured(settings):
        checks.append(_check("ha_sync", "סנכרון Home Assistant", "warn", "אין חיבור ל־Home Assistant בהגדרות (בתוסף: אוטומטי דרך ה־Supervisor).", configured=False))
    else:
        age = _age_s(hs.get("last_event_at") or hs.get("last_snapshot_at"))
        st = "ok" if hs.get("connected") else ("warn" if hs.get("last_snapshot_at") else "error")
        checks.append(_check("ha_sync", "סנכרון Home Assistant", st, f"{'מחובר' if hs.get('connected') else 'מנותק'} · {hs.get('entities', 0)} ישויות · HA {hs.get('ha_version') or '?'} · עדכון אחרון {'לפני ' + str(int(age)) + ' שנ׳' if age is not None else '—'}{' · ' + str(hs.get('last_error')) if hs.get('last_error') else ''}", **hs))
    paired = bool(get_setting(conn, "bridge.secret")) and bool(get_setting(conn, "bridge.paired_at"))
    users = conn.execute("SELECT COUNT(*) FROM ha_users").fetchone()[0] if "ha_users" in {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")} else 0
    dir_age = _age_s(get_setting(conn, "bridge.directory_at") or None)
    checks.append(_check("bridge", "גשר Home Assistant (אינטגרציה)", "ok" if paired and (dir_age is None or dir_age < 15 * 60) else ("warn" if paired else "warn"), f"{'מצומד' if paired else 'לא מצומד'} · גרסת אינטגרציה {get_setting(conn, 'bridge.integration_version') or '?'} · {users} משתמשים בספרייה · ספרייה עודכנה {'לפני ' + str(int(dir_age // 60)) + ' דק׳' if dir_age is not None else 'טרם'}", paired=paired, integration_version=get_setting(conn, "bridge.integration_version"), directory_users=users, directory_age_s=dir_age))

    # events
    ing = events_ingest.STATE.as_dict()
    if not (settings.nvr_host and settings.nvr_user):
        checks.append(_check("events_ingest", "קליטת התראות מה־NVR", "warn", "ה־NVR לא מוגדר.", configured=False))
    else:
        hb = _age_s(ing.get("last_heartbeat_at"))
        checks.append(_check("events_ingest", "קליטת התראות מה־NVR (alertStream)", "ok" if ing.get("connected") else "error", f"{'מחובר' if ing.get('connected') else 'מנותק'} · פעימה {'לפני ' + str(int(hb)) + ' שנ׳' if hb is not None else '—'} · {ing.get('events_stored', 0)} התראות נקלטו · {ing.get('reconnects', 0)} חיבורים מחדש{' · ' + str(ing.get('last_error')) if ing.get('last_error') else ''}", **ing))
    dv = dict(events_derive.STATE)
    dage = _age_s(dv.get("last_ok"))
    checks.append(_check("events_derive", "אירועים נגזרים מהקלטות", "error" if dv.get("last_error") else ("ok" if dv.get("last_ok") else "warn"), f"{'שגיאה: ' + str(dv['last_error']) if dv.get('last_error') else ('עודכן לפני ' + str(int(dage // 60)) + ' דק׳' if dage is not None else 'טרם רץ')} · {dv.get('derived', 0)} נגזרו · {conn.execute('SELECT COUNT(*) FROM events').fetchone()[0]} אירועים במאגר", **dv))

    # discovery / thumbnails / exports / sessions / backups
    ds = dict(autosync.STATE)
    cams = conn.execute("SELECT COUNT(*) FROM cameras").fetchone()[0]
    cage = _age_s(ds.get("cameras_last_ok"))
    checks.append(_check("discovery", "גילוי מצלמות מה־NVR", "error" if ds.get("cameras_last_error") else ("ok" if ds.get("cameras_last_ok") else "warn"), f"{cams} מצלמות רשומות · {'עודכן לפני ' + str(int(cage // 60)) + ' דק׳' if cage is not None else 'טרם רץ'} · כל {autosync.INTERVAL_S // 60} דק׳{' · ' + str(ds.get('cameras_last_error')) if ds.get('cameras_last_error') else ''}", cameras=cams, **ds))
    th = dict(thumbnails.STATE)
    checks.append(_check("thumbnails", "תמונות אירועים (ffmpeg)", "error" if th.get("last_error") == "ffmpeg_missing" else ("warn" if th.get("failed", 0) > th.get("generated", 0) and th.get("failed", 0) > 3 else "ok"), f"{th.get('generated', 0)} נוצרו · {th.get('failed', 0)} נכשלו · {th.get('queued', 0)} בתור{' · אחרונה: ' + str(th.get('last_error')) if th.get('last_error') else ''}", **th))
    jobs = {r[0]: r[1] for r in conn.execute("SELECT state, COUNT(*) FROM export_jobs GROUP BY state").fetchall()}
    checks.append(_check("exports", "ייצוא קטעים", "ok" if not jobs.get("failed") else "warn", " · ".join(f"{n} {s}" for s, n in jobs.items()) if jobs else "אין עבודות ייצוא", **jobs))
    from ..routers.media import REGISTRY as LIVE
    from .playback import REGISTRY as PB

    live_n = LIVE.count()
    pb_n = len(PB.active())
    checks.append(_check("sessions", "זרמים פעילים דרך התוסף", "ok", f"{live_n} חיים · {pb_n} ניגון", live=live_n, playback=pb_n))
    backups = backup_svc.list_backups(settings)
    last = backups[0] if backups else None
    bage = _age_s(last["created_at"]) if last else None
    checks.append(_check("backups", "גיבויים", "error" if not last else ("warn" if bage is not None and bage > 2 * 86400 else "ok"), f"{len(backups)} גיבויים · אחרון {last['name'] + ' (' + last['kind'] + ')' if last else 'אין עדיין'}{' · לפני ' + str(int(bage // 3600)) + ' שע׳' if bage is not None else ''}", count=len(backups), last=last["name"] if last else None, last_kind=last["kind"] if last else None, last_age_s=bage))

    worst = "ok"
    for c in checks:
        if c["status"] == "error":
            worst = "error"
            break
        if c["status"] == "warn":
            worst = "warn"
    return {"status": worst, "version": __version__, "uptime_s": int(time.time() - STARTED), "checked_at": now_iso(), "probe_ttl_s": PROBE_TTL_S, "checks": checks}


def summary(settings: Settings, conn: sqlite3.Connection) -> dict[str, Any]:
    """Cheap status for every signed-in user (top-bar pill): only cached job states and the backup age, never a
    network probe. `items` lists what is wrong in operator words; `status` is the worst of them."""
    items: list[dict[str, str]] = []
    nvr = bool(settings.nvr_host and settings.nvr_user)
    ing = events_ingest.STATE
    if nvr:
        down_for = (time.time() - ing.disconnected_since) if (not ing.connected and ing.disconnected_since) else 0
        if not ing.connected and (down_for > 60 or not ing.last_heartbeat_at):
            items.append({"id": "nvr", "status": "error", "label": "NVR מנותק — אין התראות חיות; וידאו חי והקלטות עשויים להיכשל"})
        ds = autosync.STATE
        if ds.get("cameras_last_error") and not ds.get("cameras_last_ok"):
            items.append({"id": "discovery", "status": "error", "label": "גילוי המצלמות מה־NVR נכשל"})
        elif ds.get("cameras_last_error"):
            items.append({"id": "discovery", "status": "warn", "label": "גילוי המצלמות האחרון נכשל; משתמשים ברשימה הקודמת"})
        if ds.get("streams_last_error"):
            items.append({"id": "go2rtc", "status": "warn", "label": "סנכרון הזרמים ל־go2rtc נכשל"})
    else:
        items.append({"id": "nvr", "status": "warn", "label": "ה־NVR לא הוגדר"})
    if ha_client.configured(settings):
        hs = ha_sync.STATE
        if not hs.connected and hs.last_snapshot_at:
            items.append({"id": "ha", "status": "warn", "label": "הסנכרון עם Home Assistant מנותק; מצבי ישויות עלולים להיות מיושנים"})
        elif not hs.connected and not hs.last_snapshot_at and hs.last_error:
            items.append({"id": "ha", "status": "warn", "label": "אין חיבור ל־Home Assistant"})
    if thumbnails.STATE.get("last_error") == "ffmpeg_missing":
        items.append({"id": "thumbnails", "status": "warn", "label": "ffmpeg חסר — אין תמונות אירועים"})
    backups = backup_svc.list_backups(settings)
    last_age = _age_s(backups[0]["created_at"]) if backups else None
    if not backups:
        items.append({"id": "backups", "status": "warn", "label": "אין עדיין גיבוי של הפרויקט"})
    elif last_age is not None and last_age > 2 * 86400:
        items.append({"id": "backups", "status": "warn", "label": "הגיבוי האחרון ישן מיומיים"})
    worst = "ok"
    for it in items:
        if it["status"] == "error":
            worst = "error"
            break
        worst = "warn"
    return {"status": worst, "items": items, "checked_at": now_iso(), "version": __version__}
