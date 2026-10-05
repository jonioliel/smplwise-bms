"""Fixture backend for tests/evidence-device-activity-live.spec.ts (DEVHIST-JOIN, CR-032): the REAL SmplWise Arx backend (developer identity, the
bootstrap administrator `joni` is a system administrator) serving the built UI, with a seeded FAKE Home Assistant state stream. The stream is
fed through the backend's own `ha_sync.handle_state_event` (the same function the HA WebSocket calls for every state_changed), so every
activity row is produced by the real capture code: attribution, coalescing, the context links. No real Home Assistant, device or network is
reached (HA_URL is a reserved `.test` name; the sync's own connection attempts simply fail); it refuses to start inside the add-on.

    SW_PORT=<port> SW_DATA_DIR=<empty dir> <venv-python> frontend/tests/fixtures/devhist_fixture_backend.py     (npm run build first)

It prints `READY <port>` when the API answers. Seeded: floor "קומה 1", area "סלון" (id `salon`) with one entity of each of the twelve activity
kinds (the water heater, valve and vacuum have no card yet, so they exist only on the API), a sensor and a media player (never flagged), HA users
dana / avi, one light with 120 rows (paging), 70 outlet rows etc. Timestamps are relative to the start, so the feed always shows "today".
"""
from __future__ import annotations

import datetime as dt
import os
import shutil
import sys
import tempfile
import threading
import time
from pathlib import Path

if os.environ.get("SUPERVISOR_TOKEN"):
    sys.exit("devhist_fixture_backend: refusing to run inside the add-on")

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend"))
PORT = int(os.environ.get("SW_PORT", "8361"))
DIST = ROOT / "frontend" / "dist"
if not (DIST / "index.html").exists():
    sys.exit("devhist_fixture_backend: build the UI first (npm run build in frontend/)")
WWW = Path(tempfile.mkdtemp(prefix="devhist-www-"))
shutil.copytree(DIST, WWW, dirs_exist_ok=True)
if not (WWW / "arx-sw.js").exists():
    (WWW / "arx-sw.js").write_text("// placeholder service worker for the fixture\n", encoding="utf-8")

os.environ.update({"SW_WWW_DIR": str(WWW), "SW_HOST": "127.0.0.1", "SW_PORT": str(PORT), "HA_URL": "http://fake-devhist.test:8123", "HA_TOKEN": "fake-fixture-token"})
os.environ.setdefault("SW_DATA_DIR", tempfile.mkdtemp(prefix="devhist-data-"))
os.environ.setdefault("SW_DEV_USER", "joni")
os.environ.setdefault("SW_BOOTSTRAP_ADMIN", "joni")
for k in ("NVR_HOST", "GO2RTC_URL"):
    os.environ.pop(k, None)

import uvicorn  # noqa: E402

from smplwise.config import load_settings  # noqa: E402
from smplwise.main import create_app  # noqa: E402
from smplwise.services import device_activity as da  # noqa: E402
from smplwise.services import ha_client, ha_sync  # noqa: E402

NOW = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)


def iso(minutes_ago: float) -> str:
    return (NOW - dt.timedelta(minutes=minutes_ago)).isoformat()


def st(eid: str, state: str, minutes_ago: float = 0.0, cid: str | None = None, user: str | None = None, parent: str | None = None, **attrs) -> dict:
    return {"entity_id": eid, "state": state, "attributes": attrs, "last_changed": iso(minutes_ago), "last_updated": iso(minutes_ago),
            "context": {"id": cid or f"c-{eid}-{minutes_ago}", "parent_id": parent, "user_id": user}}


INITIAL = [
    ("light.lobby", "on", {"friendly_name": "Lobby light", "brightness": 128}), ("light.dimmer", "off", {"friendly_name": "Dimmer", "brightness": 0}),
    ("switch.sign", "on", {"friendly_name": "Sign"}), ("switch.plug", "off", {"friendly_name": "Plug", "device_class": "outlet"}),
    ("sensor.plug_power", "41.5", {"friendly_name": "Plug power", "device_class": "power", "unit_of_measurement": "W"}),
    ("climate.ac", "cool", {"friendly_name": "AC", "current_temperature": 25.5, "temperature": 22, "fan_mode": "auto", "hvac_modes": ["cool", "heat", "off"]}),
    ("climate.floor_heat", "heat", {"friendly_name": "Floor heating", "current_temperature": 21, "temperature": 23, "hvac_action": "heating", "hvac_modes": ["heat", "off"]}),
    ("cover.blind", "open", {"friendly_name": "Blind", "current_position": 100}), ("cover.garage", "closed", {"friendly_name": "Garage", "device_class": "garage", "current_position": 0}),
    ("fan.vent", "off", {"friendly_name": "Vent"}), ("lock.front", "locked", {"friendly_name": "Front door"}),
    ("alarm_control_panel.house", "disarmed", {"friendly_name": "House alarm"}),
    ("water_heater.boiler", "eco", {"friendly_name": "Boiler", "temperature": 55}), ("valve.garden", "closed", {"friendly_name": "Irrigation", "current_position": 0}),
    ("vacuum.robo", "docked", {"friendly_name": "Robo", "fan_speed": "quiet"}),
    ("sensor.temp", "23.5", {"friendly_name": "Temp"}), ("media_player.tv", "playing", {"friendly_name": "TV"}),
    ("automation.evening", "on", {"friendly_name": "Evening lights"}),
]
STATES = [{"entity_id": e, "state": s, "attributes": a, "last_changed": iso(5000), "last_updated": iso(5000)} for e, s, a in INITIAL]
ha_client.get_states = lambda _s: STATES  # the snapshot's only HA call
da.ENTITY_RATE = (100000, 60.0)  # the seed is a burst: the per-entity write-rate guard is covered by the backend tests

APP = create_app()
STATE = ha_sync.STATE
STATE.connected = True


def push(old: dict, new: dict) -> None:
    ha_sync.handle_state_event(APP.state.db, {"entity_id": new["entity_id"], "old_state": old, "new_state": new})


def seed() -> None:
    ha_sync.snapshot(APP.state.db, load_settings())
    with APP.state.db.connection() as conn:
        now = NOW.isoformat()
        conn.execute("INSERT OR REPLACE INTO ha_floors(floor_id, name, level, icon, position, updated_at) VALUES ('f1', 'קומה 1', 1, NULL, 0, ?)", (now,))
        conn.execute("INSERT OR REPLACE INTO ha_areas(area_id, name, floor_id, icon, position, updated_at) VALUES ('salon', 'סלון', 'f1', NULL, 0, ?)", (now,))
        conn.execute("UPDATE ha_entities SET area_id = 'salon', area_name = 'סלון', ha_floor_id = 'f1', ha_floor_name = 'קומה 1' WHERE entity_id NOT LIKE 'automation.%'")
        for eid, dev in (("switch.plug", "dev-plug"), ("sensor.plug_power", "dev-plug")):
            conn.execute("UPDATE ha_entities SET device_id = ? WHERE entity_id = ?", (dev, eid))
        for uid, name, uname in (("u-dana", "דנה כהן", "dana"), ("u-avi", "אבי לוי", "avi")):
            conn.execute("INSERT OR REPLACE INTO ha_users(id, name, username, is_active, is_admin, synced_at) VALUES (?,?,?,1,0,?)", (uid, name, uname, now))
    # an automation run that switches the lobby light on (the automation state is seen first, then the device with the same context)
    push(st("automation.evening", "on", 9000), st("automation.evening", "on", 130, "auto-1", friendly_name="Evening lights", last_triggered="x"))
    # lobby light: 120 alternating power rows (paging: 50 + 50 + 20), people, a schedule-less automation, a value change, an outage
    state = "off"
    for i in range(120):
        m = 4000 - i * 30
        new = "on" if state == "off" else "off"
        who = ("u-dana", "u-avi", None)[i % 3]
        attrs = {"friendly_name": "Lobby light", "brightness": 200} if new == "on" else {"friendly_name": "Lobby light"}
        cid, parent = (None, None)
        if i == 117:
            cid = "auto-1"
            who = None
        push(st("light.lobby", state, m + 30), st("light.lobby", new, m, cid, who, parent, **attrs))
        state = new
    push(st("light.lobby", state, 20, brightness=200), st("light.lobby", state, 15, "dim-1", "u-dana", brightness=77, friendly_name="Lobby light"))
    push(st("light.lobby", state, 15), st("light.lobby", "unavailable", 10, "av-1"))
    push(st("light.lobby", "unavailable", 10), st("light.lobby", "on", 8, "av-2", brightness=77, friendly_name="Lobby light"))
    # one row of each other kind
    push(st("light.dimmer", "off", 400), st("light.dimmer", "on", 300, "d1", "u-avi", brightness=255))
    push(st("switch.sign", "on", 400), st("switch.sign", "off", 300, "s1"))  # manual at the device: estimated
    for i in range(70):
        push(st("switch.plug", "off" if i % 2 == 0 else "on", 2000 - i * 20), st("switch.plug", "on" if i % 2 == 0 else "off", 1990 - i * 20, f"pl{i}", "u-dana"))
    push(st("climate.ac", "cool", 500, temperature=22), st("climate.ac", "cool", 200, "ac1", "u-dana", temperature=24, friendly_name="AC", fan_mode="auto"))
    push(st("climate.ac", "cool", 200), st("climate.ac", "off", 100, "ac2", "u-avi"))
    push(st("climate.floor_heat", "off", 500), st("climate.floor_heat", "heat", 200, "fh1", "u-dana", temperature=23, hvac_action="heating", friendly_name="Floor heating"))
    push(st("cover.blind", "open", 700, current_position=100), st("cover.blind", "closing", 600, "cv1", "u-avi", current_position=70))
    push(st("cover.blind", "closing", 600, current_position=70), st("cover.blind", "closed", 598, "cv2", None, current_position=0))
    push(st("cover.garage", "closed", 900, current_position=0), st("cover.garage", "open", 800, "g1", "u-dana", current_position=100, device_class="garage", friendly_name="Garage"))
    push(st("fan.vent", "off", 900), st("fan.vent", "on", 800, "f1", "u-avi"))
    push(st("lock.front", "locked", 900), st("lock.front", "unlocked", 800, "l1", "u-dana"))
    push(st("alarm_control_panel.house", "disarmed", 900), st("alarm_control_panel.house", "armed_away", 800, "al1", "u-dana"))
    push(st("water_heater.boiler", "eco", 900, temperature=55), st("water_heater.boiler", "eco", 800, "w1", "u-dana", temperature=60, friendly_name="Boiler"))
    push(st("valve.garden", "closed", 900, current_position=0), st("valve.garden", "open", 800, "v1", "u-avi", current_position=100, friendly_name="Irrigation"))
    push(st("vacuum.robo", "docked", 900, fan_speed="quiet"), st("vacuum.robo", "cleaning", 800, "r1", "u-dana", fan_speed="turbo", friendly_name="Robo"))
    seed_schedules()
    # never stored (control): a sensor and a media player
    push(st("sensor.temp", "23.5", 100), st("sensor.temp", "24.5", 50))
    push(st("media_player.tv", "playing", 100), st("media_player.tv", "paused", 50, "tv1", "u-dana"))


def seed_schedules() -> None:
    """Three schedules of light.lobby in the scheduler mirror, as a real pull would leave them (the component itself is not reachable here)."""
    sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend" / "tests"))
    from fake_scheduler import FakeScheduler, _slot  # noqa: E402

    from smplwise.db import set_setting  # noqa: E402
    from smplwise.services.schedules import MIRROR  # noqa: E402

    fake = FakeScheduler()
    mk = lambda name, slots, **kw: fake._add({"name": name, "weekdays": ["daily"], "repeat_type": "repeat", "timeslots": slots, **kw})  # noqa: E731
    sid1 = mk("תאורת ערב", [_slot("19:00:00", None, ("light.turn_on", "light.lobby", {"brightness_pct": 60})), _slot("23:30:00", None, ("light.turn_off", "light.lobby", {}))])
    sid2 = mk("הדלקה בסופ\"ש", [_slot("07:00:00", None, ("light.turn_on", "light.lobby", {}))], weekdays=["fri", "sat"])
    fake.items[sid2]["enabled"] = False
    with APP.state.db.connection() as conn:
        set_setting(conn, "schedules.enabled", "true")
        MIRROR.db = APP.state.db
        MIRROR.apply_items(conn, [fake.items[sid1], fake.items[sid2]], full=True)
        st = MIRROR.state(conn)
        st.update(last_sync_at=NOW.isoformat(), missing_first_at=None, missing_confirmed=False, last_error=None, component_version="0.3.0")
        MIRROR._save(conn, st)


def main() -> None:
    seed()
    cfg = uvicorn.Config(APP, host="127.0.0.1", port=PORT, log_level="warning", proxy_headers=False)
    server = uvicorn.Server(cfg)
    threading.Thread(target=server.run, daemon=True).start()
    import httpx

    for _ in range(100):
        try:
            if httpx.get(f"http://127.0.0.1:{PORT}/api/v1/me", timeout=2).status_code == 200:
                break
        except Exception:  # noqa: BLE001
            time.sleep(0.3)
    print(f"READY {PORT}", flush=True)
    while True:
        time.sleep(3600)


if __name__ == "__main__":
    main()
