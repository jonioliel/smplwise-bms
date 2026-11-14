"""CR-READY96 slice 1: demo mode - the whole product on a SEPARATE database filled with clearly synthetic data, so a prospect can be walked through it
on the installer's own box without touching the installation's real data.

    start (a person holding `demo.run`, one explicit action) --> <data>/demo/demo.sqlite is built from the migrations + the dataset
        --> the one shared Database handle (app.state.db) is pointed at it (Database.switch_path) --> every request and worker now reads/writes the demo file
    stop / expiry / restart --> the handle points back at the real file, the demo file is deleted

Owner decisions of 2026-10-24 (docs/changes/CR-READY96.md, "Owner review 24.10 decisions"):
  * FULL depth with its own separate database (not a frontend-only fixture);
  * permission to start it is for the system installer only: `demo.run` is a sensitive permission in NO built-in role (default off) - an
    administrator grants it by naming it in a custom role;
  * over the remote channel it runs only on the installer's own server (`demo.allow_remote` = on, default off, saved by an administrator on THAT server)
    or for a holder of `demo.run_anywhere` (the owner), again no built-in role;
  * scenarios: `normal`, `cameras_offline`, `new_installation` (see SCENARIOS).

Safety (the real database is never opened for writing while a demo runs; the start and stop audit rows are written to it BEFORE the switch / AFTER the return):
  * the people and their role bindings are COPIED into the demo file when it starts (so nobody loses their permissions and nobody gains one); local-identity
    credentials and sessions are not copied, so Arx-only identities are signed out for the duration;
  * `blocked_permission`: rbac.authorize refuses every physical-action, device-configuration, update and backup permission while the handle is in demo mode -
    even if some route were wired to a real device by mistake the permission is the first gate;
  * a restart exits demo mode (create_app deletes the demo folder; the handle always starts on the real file);
  * the janitor ends an expired demo (`tick`) and skips the rest of its pass while a demo runs.
Slice 1 limits (the CR's S3/S4): the fake device adapters are not yet swapped in for the background workers, so a worker that reads a real device writes what it
read into the DEMO file; the datasets are minimal (floors, cameras); the go2rtc `smplwise_demo_` sample streams and the PDF watermark are not built."""
from __future__ import annotations

import datetime as dt
import logging
import shutil
import sqlite3
from pathlib import Path
from typing import Any

from ..audit import audit
from ..config import Settings
from ..db import Database, bump_permission_revision, get_setting, new_id, release, set_setting
from ..errors import ApiError
from ..rbac import Principal
from .timeutil import iso_utc, parse_utc

log = logging.getLogger("smplwise.demo")
UTC = dt.timezone.utc

RUN_PERMISSION = "demo.run"                    # start / extend / stop - sensitive, in no built-in role
ANYWHERE_PERMISSION = "demo.run_anywhere"      # start over the remote channel on any server - sensitive, in no built-in role
CONFIGURE = "system.configure"                 # the settings (allow_remote)

DATASETS = ("residential", "office", "retail")
SCENARIOS = ("normal", "cameras_offline", "new_installation")
DEFAULT_HOURS, MAX_HOURS = 4, 24
ALLOW_REMOTE = "demo.allow_remote"             # off by default; only an administrator on the installer's server turns it on; never exported or restored (backup.SETTINGS_KEEP_PREFIXES, READYFLEET-295)

# Everything that moves a physical thing, writes to a device or a recorder, updates or restores the installation, or changes who may do what.
# While the handle is in demo mode rbac.authorize answers "demo_mode" for these.
BLOCKED_EXACT = frozenset({
    "devices.control", "devices.control_bulk", "ha.entity.control", "door.unlock", "access.doors.open", "access.release", "access.call",
    "access.windows.manage", "access.windows.cancel", "access.emergency.lock", "access.emergency.open", "access.doors.automate",
    "alarm.arm", "alarm.disarm", "alarm.bypass", "camera.ptz", "audio.talk", "video.export",
    "media.control", "media.power", "media.public", "media.bulk", "media.layout", "media.group", "media.queue", "media.cast", "media.announce",
    "system.update", "backup.manage", "bridge.key.rotate", "users.ha_manage", "identity.local.manage", "rbac.assign", "rbac.roles.manage",
    "script.run", "automation.manage", "scene.manage", "script.manage", "schedule.manage", "rules.ha_notify", "notify.manage",
    "generator.manage", "energy.manage", "water.manage", "infra.elevators.manage", "infra.temperature.manage",
    "messaging.accounts.manage", "access.people.message", "access.pin.generate", "access.external.grant", "access.cards.capture",
    "access.visitor.invite",  # EXTERNALBUILD-297: a demo session never invites a visitor (a code would be generated for a real door)
})
BLOCKED_PREFIXES = ("nvr.",)


def blocked_permission(permission: str) -> bool:
    return permission in BLOCKED_EXACT or permission.startswith(BLOCKED_PREFIXES)


def demo_dir(settings: Settings) -> Path:
    return Path(settings.data_dir) / "demo"


def clear_on_boot(settings: Settings) -> None:
    """A restart exits demo mode: whatever a previous process left is deleted (create_app)."""
    shutil.rmtree(demo_dir(settings), ignore_errors=True)


def active(db: Database | None) -> bool:
    return bool(db is not None and db.demo and db.demo_state)


def me_block(db: Database | None) -> dict[str, Any]:
    """What every signed-in user is told (the banner): never the dataset internals."""
    s = db.demo_state if active(db) else None
    if not s:
        return {"active": False}
    return {"active": True, "dataset": s["dataset"], "scenario": s["scenario"], "started_at": s["started_at"], "expires_at": s["expires_at"],
            "started_by_name": s["started_by_name"]}


def now_utc() -> dt.datetime:
    return dt.datetime.now(UTC)


# ---------------------------------------------------------------- the dataset

_NAMES = {
    "residential": ("בית לדוגמה", ["כניסה ראשית", "חצר קדמית", "סלון", "מטבח", "חצר אחורית", "חניה"], ["קומת קרקע", "קומה א"]),
    "office": ("משרד לדוגמה", ["לובי", "דלת כניסה", "קבלה", "אולם עבודה", "חדר ישיבות", "מטבחון", "מחסן", "חניון", "גג", "מעלית", "מסדרון א", "מסדרון ב"], ["לובי", "קומה 1", "קומה 2"]),
    "retail": ("חנות לדוגמה", ["כניסה", "קופה 1", "קופה 2", "אולם מכירות", "מחסן", "רציף פריקה", "חניה", "מעבר א", "מעבר ב"], ["אולם מכירות", "מחסן"]),
}
_TABLES_COPIED = ("users", "groups", "group_members", "bindings", "custom_roles")
_SETTING_PREFIXES = ("ui.", "time.", "readiness.", "bootstrap_state")


def _copy_people(real: sqlite3.Connection, demo: sqlite3.Connection) -> None:
    """The people and what they may do, as they are now (a snapshot): the demo is shown by someone who already has access."""
    existing = {r[0] for r in demo.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()}
    for table in _TABLES_COPIED:
        if table not in existing:
            continue
        rows = real.execute(f"SELECT * FROM {table}").fetchall()
        if not rows:
            continue
        cols = list(rows[0].keys())
        demo.executemany(f"INSERT OR REPLACE INTO {table}({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})", [tuple(r[c] for c in cols) for r in rows])
    for r in real.execute("SELECT key, value FROM settings").fetchall():
        if r["key"].startswith(_SETTING_PREFIXES):
            set_setting(demo, r["key"], r["value"])


def _seed(demo: sqlite3.Connection, dataset: str, scenario: str, now: dt.datetime) -> None:
    """The synthetic installation. Every name says it is an example; no real person, address, host or picture."""
    stamp = iso_utc(now)
    site_name, camera_names, floor_names = _NAMES[dataset]
    sid, bid = new_id(), new_id()
    demo.execute("INSERT INTO sites(id, name, address, timezone, sort_order, created_at, updated_at) VALUES (?,?,?,?,0,?,?)", (sid, site_name, "", "Asia/Jerusalem", stamp, stamp))
    demo.execute("INSERT INTO buildings(id, site_id, name, sort_order, created_at, updated_at) VALUES (?,?,?,0,?,?)", (bid, sid, "מבנה ראשי", stamp, stamp))
    for i, name in enumerate(floor_names):
        fid = new_id()
        demo.execute("INSERT INTO floors(id, building_id, name, level, sort_order, created_at, updated_at) VALUES (?,?,?,?,?,?,?)", (fid, bid, name, i, i, stamp, stamp))
    set_setting(demo, "demo.example", "true")
    if scenario == "new_installation":
        return  # a fresh installation: floors only, no recorder, no camera
    rid = "demo-recorder"
    demo.execute("INSERT INTO recorders(id, name, model, firmware, last_seen_at, created_at) VALUES (?,?,?,?,?,?)", (rid, "מקליט לדוגמה", "DEMO", "demo", stamp, stamp))
    offline = 2 if scenario == "cameras_offline" else 0
    for ch, name in enumerate(camera_names, start=1):
        status = "offline" if ch > len(camera_names) - offline else "online"
        demo.execute("INSERT INTO cameras(id, recorder_id, channel, name_source, alias, enabled, sort_order, status, last_seen_at, created_at, updated_at) VALUES (?,?,?,?,?,1,?,?,?,?,?)",
                     (f"demo-cam-{ch}", rid, ch, name, name, ch, status, stamp if status == "online" else None, stamp, stamp))


def build(settings: Settings, real_conn: sqlite3.Connection, dataset: str, scenario: str) -> Path:
    """A fresh demo database file: all migrations, the people copied, the dataset seeded. Never touches the real file."""
    d = demo_dir(settings)
    shutil.rmtree(d, ignore_errors=True)
    d.mkdir(parents=True, exist_ok=True)
    path = d / "demo.sqlite"
    ddb = Database(path)
    ddb.migrate()
    with ddb.connection(label="demo.build") as dc:
        _copy_people(real_conn, dc)
        _seed(dc, dataset, scenario, now_utc())
        bump_permission_revision(dc)
    return path


# ---------------------------------------------------------------- start / extend / stop

def setting_allow_remote(conn: sqlite3.Connection) -> bool:
    return (get_setting(conn, ALLOW_REMOTE, "off") or "off") == "on"


def start(db: Database, settings: Settings, conn: sqlite3.Connection, principal: Principal, dataset: str, scenario: str, hours: float, *,
          remote: bool, holds_anywhere: bool, rid: str | None) -> dict[str, Any]:
    """`conn` is the request's connection on the REAL file; it is committed (release) before the switch, so the audit row is in the real database."""
    if db.demo:
        raise ApiError(409, "demo_active", "מצב הדגמה כבר פעיל.")
    if dataset not in DATASETS or scenario not in SCENARIOS:
        raise ApiError(422, "invalid_demo", "מערך נתונים או תרחיש לא מוכרים.")
    if not (0 < hours <= MAX_HOURS):
        raise ApiError(422, "invalid_demo", f"משך ההדגמה חייב להיות עד {MAX_HOURS} שעות.")
    if remote and not (holds_anywhere or setting_allow_remote(conn)):
        audit(conn, actor=principal, action="demo.start", decision="denied", resource_type="installation", resource_id="*", reason="remote_refused", request_id=rid)
        raise ApiError(403, "demo_remote_refused", "הדגמה מרחוק מותרת רק בשרת של חברת ההתקנה.")
    started = now_utc()
    path = build(settings, conn, dataset, scenario)
    audit(conn, actor=principal, action="demo.start", decision="allowed", resource_type="installation", resource_id="*", request_id=rid,
          details={"dataset": dataset, "scenario": scenario, "hours": hours, "remote": remote})
    release(conn)  # the real file is committed and idle before any request can land on the demo file
    db.demo_state = {"dataset": dataset, "scenario": scenario, "started_at": iso_utc(started), "expires_at": iso_utc(started + dt.timedelta(hours=hours)),
                     "started_by": principal.user_id, "started_by_name": principal.display_name or principal.username}
    db.switch_path(path, demo=True)
    log.warning("demo mode started (%s/%s, %.1f h)", dataset, scenario, hours)
    return me_block(db)


def extend(db: Database, principal: Principal, hours: float) -> dict[str, Any]:
    """Push the end out by `hours`, never beyond MAX_HOURS from the start."""
    if not active(db):
        raise ApiError(409, "demo_not_active", "מצב הדגמה אינו פעיל.")
    s = db.demo_state
    assert s is not None
    cap = parse_utc(s["started_at"]) + dt.timedelta(hours=MAX_HOURS)
    new_end = min(parse_utc(s["expires_at"]) + dt.timedelta(hours=hours), cap)
    s["expires_at"] = iso_utc(new_end)
    return me_block(db)


def _leave(db: Database, settings: Settings) -> dict[str, Any] | None:
    state = db.demo_state
    db.switch_path(db.real_path, demo=False)
    db.demo_state = None
    shutil.rmtree(demo_dir(settings), ignore_errors=True)  # best effort: an open reader may hold the file on some systems; the next boot clears it
    return state


def stop(db: Database, settings: Settings, principal: Principal | None, conn: sqlite3.Connection | None, rid: str | None, *, reason: str = "stopped") -> dict[str, Any]:
    """Back to the real file. `conn` (the request's, opened on the demo file) is committed first. The audit row goes to the REAL database, in a transaction of its own."""
    if not active(db):
        raise ApiError(409, "demo_not_active", "מצב הדגמה אינו פעיל.")
    if conn is not None:
        release(conn)
    state = _leave(db, settings)
    with db.connection(label="demo.stop") as rc:
        audit(rc, actor=principal, action="demo.stop" if reason == "stopped" else "demo.expire", decision="allowed", resource_type="installation", resource_id="*",
              request_id=rid, details={"reason": reason, "dataset": (state or {}).get("dataset"), "started_at": (state or {}).get("started_at")})
    log.warning("demo mode ended (%s)", reason)
    return {"active": False}


def tick(db: Database, settings: Settings) -> bool:
    """The janitor's hook: end a demo whose time is up. True while a demo is (still) running."""
    if not active(db):
        return False
    s = db.demo_state
    assert s is not None
    if now_utc() >= parse_utc(s["expires_at"]):
        stop(db, settings, None, None, None, reason="expired")
        return False
    return True
