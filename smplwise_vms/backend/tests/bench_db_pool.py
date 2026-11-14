"""DB-CONN-POOL-2343: request throughput and latency with connection reuse on and off, in one process, against a large
synthetic installation (default 15 floors x 20 areas = 300 areas, 2000 entities, 16 cameras - the dataset of
PERF-HOME-DEVICES-2342). Not a test (no `test_` prefix, pytest never collects it); run it by hand:

    python tests/bench_db_pool.py [--areas 300] [--entities 2000] [--repeat 40] [--threads 4] [--json out.json]

First the per-connection floor (one read-mode connection() with one small SELECT, pool off / on) and the working-set
growth per open connection. Then for every endpoint: `--repeat` sequential calls per mode, the pool switched off / on for
every other call (machine drift hits both alike; the idle connections stay pooled across the "off" calls):
p50 / p95 and requests per second (1 / mean); then `--threads` clients at once per mode (p50 / p95, requests per second
over the wall time). The pool is switched with db.CONN_POOL (the kill switch) and emptied whenever it goes off.
Nothing here touches a device or the network."""
from __future__ import annotations

import argparse
import ctypes
import json
import statistics
import sys
import tempfile
import threading
import time
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

TS = "2026-10-30T10:00:00+00:00"
ENDPOINTS = ["/api/v1/settings", "/api/v1/devices/tree", "/api/v1/devices/areas/ar7", "/api/v1/devices/items?kind=lights&scope=building",
             "/api/v1/me"]


def rss_mb() -> float | None:
    if sys.platform != "win32":
        try:
            return int(Path("/proc/self/statm").read_text().split()[1]) * 4096 / 1048576
        except OSError:
            return None

    class PMC(ctypes.Structure):
        _fields_ = [("cb", ctypes.c_ulong), ("PageFaultCount", ctypes.c_ulong), ("PeakWorkingSetSize", ctypes.c_size_t),
                    ("WorkingSetSize", ctypes.c_size_t), ("QuotaPeakPagedPoolUsage", ctypes.c_size_t), ("QuotaPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t), ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                    ("PagefileUsage", ctypes.c_size_t), ("PeakPagefileUsage", ctypes.c_size_t)]

    pmc = PMC()
    pmc.cb = ctypes.sizeof(PMC)
    k32 = ctypes.WinDLL("kernel32")
    k32.GetCurrentProcess.restype = ctypes.c_void_p
    k32.K32GetProcessMemoryInfo.argtypes = [ctypes.c_void_p, ctypes.POINTER(PMC), ctypes.c_ulong]
    ok = k32.K32GetProcessMemoryInfo(k32.GetCurrentProcess(), ctypes.byref(pmc), pmc.cb)
    return round(pmc.WorkingSetSize / 1048576, 1) if ok else None


def dataset(n_areas: int, n_entities: int, n_cameras: int):
    per_floor = 20
    floors = [{"floor_id": f"fl{i}", "name": f"floor {i}", "level": i, "icon": None} for i in range(max(1, (n_areas + per_floor - 1) // per_floor))]
    areas = [{"area_id": f"ar{i}", "name": f"room {i}", "floor_id": f"fl{i // per_floor}", "icon": None} for i in range(n_areas)]
    kinds = [("light", "on", {"brightness": 200}), ("light", "off", {}), ("switch", "on", {}), ("sensor", "23.4", {"device_class": "temperature"}),
             ("binary_sensor", "off", {"device_class": "door"}), ("climate", "cool", {"temperature": 22}), ("cover", "open", {"current_position": 60}),
             ("binary_sensor", "on", {"device_class": "motion"}), ("media_player", "off", {}), ("lock", "locked", {})]
    states, registry = [], []
    for i in range(n_entities - n_cameras):
        dom, st, attrs = kinds[i % len(kinds)]
        eid = f"{dom}.e{i}"
        states.append({"entity_id": eid, "state": st, "attributes": {"friendly_name": f"device {i}", **attrs}, "last_changed": TS, "last_updated": TS})
        registry.append({"entity_id": eid, "id": f"reg-{eid}", "area_id": f"ar{i % n_areas}", "device_id": None, "entity_category": None})
    for i in range(n_cameras):
        eid = f"camera.c{i}"
        states.append({"entity_id": eid, "state": "idle", "attributes": {"friendly_name": f"camera {i}"}, "last_changed": TS, "last_updated": TS})
        registry.append({"entity_id": eid, "id": f"reg-{eid}", "area_id": f"ar{(i * 17) % n_areas}", "device_id": None, "entity_category": None})
    return states, registry, areas, floors


def build_app(tmp: Path, a):
    from smplwise.main import create_app

    s = Settings(data_dir=tmp / "data", www_dir=None, in_addon=False, trusted_proxies=("172.30.32.2",), dev_user="joni", bootstrap_admin_username="joni",
                 nvr_host="nvr-placeholder.test", nvr_http_port=80, nvr_user=None, nvr_password=None, go2rtc_url=None, log_level="warning",
                 max_upload_bytes=5 * 1024 * 1024, max_pdf_pages=5, max_render_px=800, preview_px=300)
    s = replace(s, ha_url="http://ha.local:8123", ha_token="bench-token")
    states, registry, areas, floors = dataset(a.areas, a.entities, a.cameras)
    ha_client.get_states = lambda _s: states  # type: ignore[assignment]
    app = create_app(s)
    ha_sync.STATE.connected = True
    ha_sync.snapshot(app.state.db, s)
    with app.state.db.connection() as conn:
        ha_sync.apply_registry(conn, ha_client.registry_maps(registry, [], areas, floors))
        ha_sync.apply_structure(conn, areas, floors)
    return app


def pct(xs: list[float], p: float) -> float:
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(round(p / 100 * (len(xs) - 1))))]


def summary(times: list[float]) -> dict:
    return {"p50_ms": round(statistics.median(times), 1), "p95_ms": round(pct(times, 95), 1), "rps": round(1000 / statistics.mean(times), 1)}


def run_paired(client: TestClient, db, path: str, n: int) -> dict:
    """Sequential calls, the pool switched off / on for every other call: drift of the machine hits both modes alike."""
    for _ in range(3):
        assert client.get(path).status_code == 200, path
    times: dict[str, list[float]] = {"off": [], "on": []}
    for i in range(2 * n):
        mode = "on" if i % 2 else "off"
        db_mod.CONN_POOL = mode == "on"  # off: plain connections, the idle ones stay pooled for the next "on" call
        s = time.perf_counter()
        client.get(path)
        times[mode].append((time.perf_counter() - s) * 1000)
    return {m: summary(t) for m, t in times.items()}


def conn_memory(db, n: int = 10) -> float | None:
    """Working-set growth per connection that parsed the schema (n extra connections held open at once)."""
    import gc

    gc.collect()
    before = rss_mb()
    conns = []
    for _ in range(n):
        c = db._open()
        c.execute("SELECT value FROM settings WHERE key = 'x'").fetchone()
        conns.append(c)
    after = rss_mb()
    for c in conns:
        c.close()
    return None if before is None or after is None else round((after - before) / n, 2)


def run_floor(db, n: int) -> dict:
    """The per-connection floor alone: one read-mode connection() with one small SELECT."""
    out = {}
    for mode in ("off", "on"):
        db_mod.CONN_POOL = mode == "on"
        db.invalidate_pool()
        times = []
        for _ in range(n + 2):
            s = time.perf_counter()
            with db.connection(mode="read") as conn:
                conn.execute("SELECT value FROM settings WHERE key = 'x'").fetchone()
            times.append((time.perf_counter() - s) * 1000)
        out[mode] = summary(times[2:])
    return out


def run_par(client: TestClient, path: str, n: int, threads: int) -> dict:
    times: list[float] = []
    lock = threading.Lock()

    def worker() -> None:
        for _ in range(n):
            s = time.perf_counter()
            r = client.get(path)
            assert r.status_code == 200
            with lock:
                times.append((time.perf_counter() - s) * 1000)

    ts = [threading.Thread(target=worker) for _ in range(threads)]
    t0 = time.perf_counter()
    for t in ts:
        t.start()
    for t in ts:
        t.join()
    wall = time.perf_counter() - t0
    return {"p50_ms": round(statistics.median(times), 1), "p95_ms": round(pct(times, 95), 1), "rps": round(len(times) / wall, 1)}  # throughput


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--areas", type=int, default=300)
    ap.add_argument("--entities", type=int, default=2000)
    ap.add_argument("--cameras", type=int, default=16)
    ap.add_argument("--repeat", type=int, default=40)
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--json", type=str, default="")
    a = ap.parse_args()
    out: dict = {"dataset": vars(a), "rows": []}
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        app = build_app(Path(td), a)
        db = app.state.db
        with db.connection(mode="read") as conn:
            out["schema_objects"] = conn.execute("SELECT COUNT(*) FROM sqlite_master").fetchone()[0]
        out["floor"] = run_floor(db, 50)
        out["rss_mb_per_connection"] = conn_memory(db)
        print(json.dumps({"floor": out["floor"]}), flush=True)
        with TestClient(app) as c:
            for path in ENDPOINTS:
                row = {"path": path, "seq": run_paired(c, db, path, a.repeat)}
                if a.threads > 1:
                    for mode in ("off", "on"):
                        db_mod.CONN_POOL = mode == "on"
                        db.invalidate_pool()
                        row[f"par_{mode}"] = run_par(c, path, max(1, a.repeat // a.threads), a.threads)
                out["rows"].append(row)
                print(json.dumps(row, ensure_ascii=False), flush=True)
            db_mod.CONN_POOL = True
            for path in ENDPOINTS:
                c.get(path)
            out["idle_after_warm"] = sum(len(v) for v in db._idle.values())
            out["pool_stats"] = db_mod.pool_stats()
        db.close_pool()
    print(json.dumps({k: v for k, v in out.items() if k != "rows"}, ensure_ascii=False))
    if a.json:
        Path(a.json).write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
