"""WARMUP-POLISH-2421: the first-request time of the home screen's API calls in a fresh process, with and without the start-up
warm-up (services/startup_warmup.py). Not a test (pytest never collects it); run it by hand, each mode in its own process:

    python tests/bench_startup_warmup.py cold   # the first GET of each call right after start-up
    python tests/bench_startup_warmup.py warm   # the same after startup_warmup.run()

It reuses bench_home_devices.build_app (synthetic installation: 300 areas, 2000 entities, 16 cameras). The database was just written
by the build, so the operating system's file cache is already warm in both modes: this measures the in-process first-use cost (lazy
imports, first parse, first build) only - on the add-on host after a restart the file cache is cold too, so the real gain is larger
than what this shows. Nothing here touches a device or the network."""
from __future__ import annotations

import json
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))

import bench_home_devices as bhd  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

PATHS = [p for scr, p in bhd.ENDPOINTS if scr == "home"]


def main() -> None:
    mode = sys.argv[1] if len(sys.argv) > 1 else "cold"
    out: dict[str, float] = {}
    with tempfile.TemporaryDirectory() as td:
        app = bhd.build_app(Path(td), 300, 2000, 16)
        with TestClient(app) as c:
            if mode == "warm":
                from smplwise.services import startup_warmup

                t0 = time.perf_counter()
                out["warmup"] = startup_warmup.run(app.state.db, app=app, pause_s=0)  # type: ignore[assignment]
                out["warmup_ms"] = round((time.perf_counter() - t0) * 1000, 1)
            total = 0.0
            for p in PATHS:
                t0 = time.perf_counter()
                c.get(p)
                ms = (time.perf_counter() - t0) * 1000
                total += ms
                out[p] = round(ms, 1)
            out["first_screen_total_ms"] = round(total, 1)
    print(json.dumps({"mode": mode, **out}))


if __name__ == "__main__":
    main()
