"""PERF-HOME-DEVICES-2342: a load-time benchmark of the API calls the home screen (#/devices/building) and the devices
screens (area, tiles panel, synoptic) make, against a large synthetic installation (default: 15 floors x 20 areas = 300
areas, 2000 entities, 16 cameras). Not a test (no `test_` prefix, pytest never collects it); run it by hand:

    python tests/bench_home_devices.py [--areas 300] [--entities 2000] [--cameras 16] [--repeat 7] [--json out.json]

It builds the app exactly as tests/test_devices.py does (a fake `get_states`, the registry and structure mirrors applied
directly), then times each GET with TestClient: the median wall time over `--repeat` calls, the SQL statements one call
runs (sqlite3 trace callback on every connection the app opens) and the JSON payload size. Nothing here touches a device
or the network."""
from __future__ import annotations

import argparse
import json
import os
import statistics
import sqlite3
import sys
import tempfile
import time
from collections import Counter
from dataclasses import replace
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))

import conftest  # noqa: E402,F401 - the test environment switches (background workers off) and the migrated DB template

from fastapi.testclient import TestClient  # noqa: E402

from smplwise import db as db_mod  # noqa: E402
from smplwise.config import Settings  # noqa: E402
from smplwise.services import ha_client, ha_sync  # noqa: E402

TRACE: list[str] = []
_orig_open = db_mod.Database._open


def _traced_open(self, *a, **kw):
    conn = _orig_open(self, *a, **kw)
    conn.set_trace_callback(TRACE.append)
    return conn


db_mod.Database._open = _traced_open  # type: ignore[method-assign]

TS = "2026-10-30T10:00:00+00:00"


def dataset(n_areas: int, n_entities: int, n_cameras: int) -> tuple[list, list, list, list]:
    per_floor = 20
    n_floors = max(1, (n_areas + per_floor - 1) // per_floor)
    floors = [{"floor_id": f"fl{i}", "name": f"קומה {i}", "level": i, "icon": None} for i in range(n_floors)]
    areas = [{"area_id": f"ar{i}", "name": f"חדר {i}", "floor_id": f"fl{i // per_floor}", "icon": None} for i in range(n_areas)]
    kinds = [
        ("light", "on", {"brightness": 200, "color_mode": "brightness"}),
        ("light", "off", {}),
        ("switch", "on", {}),
        ("sensor", "23.4", {"unit_of_measurement": "°C", "device_class": "temperature"}),
        ("binary_sensor", "off", {"device_class": "door"}),
        ("climate", "cool", {"current_temperature": 25, "temperature": 22, "hvac_action": "cooling"}),
        ("cover", "open", {"current_position": 60, "device_class": "shutter"}),
        ("binary_sensor", "on", {"device_class": "motion"}),
        ("media_player", "off", {"device_class": "tv"}),
        ("lock", "locked", {}),
    ]
    states, registry = [], []
    for i in range(n_entities - n_cameras):
        dom, st, attrs = kinds[i % len(kinds)]
        eid = f"{dom}.e{i}"
        states.append({"entity_id": eid, "state": st, "attributes": {"friendly_name": f"התקן {i}", **attrs}, "last_changed": TS, "last_updated": TS})
        registry.append({"entity_id": eid, "id": f"reg-{eid}", "area_id": f"ar{i % n_areas}", "device_id": None, "entity_category": None})
    for i in range(n_cameras):
        eid = f"camera.c{i}"
        states.append({"entity_id": eid, "state": "idle", "attributes": {"friendly_name": f"מצלמה {i}"}, "last_changed": TS, "last_updated": TS})
        registry.append({"entity_id": eid, "id": f"reg-{eid}", "area_id": f"ar{(i * 17) % n_areas}", "device_id": None, "entity_category": None})
    return states, registry, areas, floors


def build_app(tmp: Path, n_areas: int, n_entities: int, n_cameras: int):
    from smplwise.main import create_app

    s = Settings(
        data_dir=tmp / "data", www_dir=None, in_addon=False, trusted_proxies=("172.30.32.2",), dev_user="joni", bootstrap_admin_username="joni",
        nvr_host="nvr-placeholder.test", nvr_http_port=80, nvr_user=None, nvr_password=None, go2rtc_url=None, log_level="warning",
        max_upload_bytes=5 * 1024 * 1024, max_pdf_pages=5, max_render_px=800, preview_px=300,
    )
    s = replace(s, ha_url="http://ha.local:8123", ha_token="bench-token")
    states, registry, areas, floors = dataset(n_areas, n_entities, n_cameras)
    ha_client.get_states = lambda _s: states  # type: ignore[assignment]
    app = create_app(s)
    ha_sync.STATE.connected = True
    ha_sync.snapshot(app.state.db, s)
    with app.state.db.connection() as conn:
        ha_sync.apply_registry(conn, ha_client.registry_maps(registry, [], areas, floors))
        ha_sync.apply_structure(conn, areas, floors)
    return app


ENDPOINTS = [
    # the home screen (devices-building) and the shell around it
    ("home", "/api/v1/me"),
    ("home", "/api/v1/settings"),
    ("home", "/api/v1/devices/tree"),
    ("home", "/api/v1/presence/building"),
    ("home", "/api/v1/sites?tree=true"),
    ("home", "/api/v1/home-links"),
    # one area (devices-area), the tiles panel (devices-tiles-panel), the synoptic map (devices-synoptic)
    ("area", "/api/v1/devices/areas/ar7"),
    ("tiles", "/api/v1/devices/items?kind=lights&scope=building"),
    ("tiles", "/api/v1/devices/items?kind=switches&scope=building"),
    ("tiles", "/api/v1/devices/items?kind=climate&scope=floor&id=fl3"),
    ("synoptic", "/api/v1/events?limit=50"),
]


def measure(client: TestClient, path: str, repeat: int) -> dict:
    client.get(path)  # warm (first-call imports, caches)
    times, stmts, size, status = [], 0, 0, 0
    kinds: Counter[str] = Counter()
    for i in range(repeat):
        TRACE.clear()
        t0 = time.perf_counter()
        r = client.get(path)
        times.append((time.perf_counter() - t0) * 1000)
        if i == 0:
            stmts, size, status = len(TRACE), len(r.content), r.status_code
            for q in TRACE:
                head = " ".join(q.split()[:6])
                kinds[head[:90]] += 1
    return {"path": path, "status": status, "median_ms": round(statistics.median(times), 2), "min_ms": round(min(times), 2), "sql": stmts, "bytes": size, "top_sql": kinds.most_common(6)}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--areas", type=int, default=300)
    ap.add_argument("--entities", type=int, default=2000)
    ap.add_argument("--cameras", type=int, default=16)
    ap.add_argument("--repeat", type=int, default=7)
    ap.add_argument("--json", type=str, default="")
    ap.add_argument("--verbose", action="store_true")
    a = ap.parse_args()
    with tempfile.TemporaryDirectory() as td:
        app = build_app(Path(td), a.areas, a.entities, a.cameras)
        with TestClient(app) as c:
            rows = [{"screen": scr, **measure(c, p, a.repeat)} for scr, p in ENDPOINTS]
        app.state.db.close() if hasattr(app.state.db, "close") else None
    print(f"dataset: {a.areas} areas, {a.entities} entities, {a.cameras} cameras; median of {a.repeat}")
    print(f"{'screen':9} {'status':>6} {'median ms':>10} {'sql':>6} {'KB':>8}  path")
    for r in rows:
        print(f"{r['screen']:9} {r['status']:>6} {r['median_ms']:>10} {r['sql']:>6} {r['bytes'] / 1024:>8.1f}  {r['path']}")
        if a.verbose:
            for q, n in r["top_sql"]:
                print(f"{'':30}{n:>5} x {q}")
    if a.json:
        Path(a.json).write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    os.environ.setdefault("SW_DEV_USER", "joni")
    main()
