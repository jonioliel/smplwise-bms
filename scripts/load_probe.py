"""Load probe for the SMPLWISE backend (T068): concurrent GETs against the running developer backend, latency
percentiles per endpoint, catalogue scale, and the backend process memory / CPU as Windows reports it.
Read-only: every request is a GET the UI issues anyway. Numbers describe THIS workstation and lab; they are a
reference measurement, not a promise for the Home Assistant host.

usage: python scripts/load_probe.py [--base http://127.0.0.1:8099] [--workers 8] [--rounds 5] [--markdown out.md]
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import json
import statistics
import subprocess
import sys
import time

import httpx

sys.stdout.reconfigure(encoding="utf-8")


def pct(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    k = max(0, min(len(s) - 1, round((p / 100) * (len(s) - 1))))
    return s[k]


def backend_process() -> dict[str, float | int | str] | None:
    """Memory / CPU of the python process serving the API (Windows: Get-Process on the smplwise module)."""
    ps = (
        "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*-m smplwise*' -and $_.Name -like 'python*' } | "
        "ForEach-Object { $p = Get-Process -Id $_.ProcessId; [pscustomobject]@{ pid=$_.ProcessId; ws_mb=[math]::Round($p.WorkingSet64/1MB,1); "
        "cpu_s=[math]::Round($p.TotalProcessorTime.TotalSeconds,1); threads=$p.Threads.Count; handles=$p.HandleCount } } | ConvertTo-Json"
    )
    try:
        out = subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, text=True, timeout=30).stdout.strip()
        if not out:
            return None
        data = json.loads(out)
        # the venv launcher and the real interpreter share the command line: the server is the one with the memory
        return max(data, key=lambda d: d["ws_mb"]) if isinstance(data, list) else data
    except Exception:  # noqa: BLE001 - measurement helper only
        return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8099")
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--rounds", type=int, default=5)
    ap.add_argument("--markdown", default="")
    args = ap.parse_args()
    api = args.base.rstrip("/") + "/api/v1"
    with httpx.Client(base_url=api, timeout=60) as c:
        tree = c.get("/sites?tree=true").json()
        floors = [f for s in tree["sites"] for b in s["buildings"] for f in b["floors"] if f.get("has_plan")]
        cams = c.get("/cameras").json()["cameras"]
        scale = {
            "sites": len(tree["sites"]), "floors_with_plan": len(floors), "cameras": len(cams),
            "events_24h": len(c.get("/events?limit=1000").json()["events"]),
            "entities": len(c.get("/ha/entities?limit=1000").json().get("entities", [])),
            "anchors": sum(len(c.get(f"/floors/{f['id']}/map").json()["anchors"]) for f in floors),
            "zones": sum(len(c.get(f"/floors/{f['id']}/map").json()["zones"]) for f in floors),
        }
        floor_id = floors[0]["id"] if floors else ""
        cam_id = cams[0]["id"] if cams else ""
        targets = {
            "health/summary": "/health/summary",
            "cameras": "/cameras",
            "floor map": f"/floors/{floor_id}/map",
            "floor map @instant": f"/floors/{floor_id}/map?at=" + time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "events (24 h)": "/events?limit=500",
            "events/facets": "/events/facets",
            "search": "/search?q=%D7%9C%D7%95%D7%91%D7%99",
            "storage (cached)": "/storage",
            "cases": "/cases",
            "camera recordings today": f"/cameras/{cam_id}/recordings?date=" + time.strftime("%Y-%m-%d"),
        }
        before = backend_process()
        results: dict[str, dict[str, float | int]] = {}
        t_start = time.time()
        total = 0
        for name, path in targets.items():
            lat: list[float] = []
            errors = 0

            def one(_: int) -> float:
                t0 = time.perf_counter()
                r = c.get(path)
                if r.status_code >= 400:
                    raise RuntimeError(r.status_code)
                return (time.perf_counter() - t0) * 1000

            with cf.ThreadPoolExecutor(max_workers=args.workers) as pool:
                for fut in cf.as_completed([pool.submit(one, i) for i in range(args.workers * args.rounds)]):
                    try:
                        lat.append(fut.result())
                    except Exception:  # noqa: BLE001
                        errors += 1
            total += len(lat) + errors
            results[name] = {"n": len(lat), "errors": errors, "p50_ms": round(pct(lat, 50), 1), "p95_ms": round(pct(lat, 95), 1), "max_ms": round(max(lat) if lat else 0, 1), "mean_ms": round(statistics.fmean(lat), 1) if lat else 0}
        elapsed = time.time() - t_start
        after = backend_process()
    lines = [
        f"| endpoint | n | errors | p50 ms | p95 ms | max ms |", "|---|---|---|---|---|---|",
        *(f"| {k} | {v['n']} | {v['errors']} | {v['p50_ms']} | {v['p95_ms']} | {v['max_ms']} |" for k, v in results.items()),
    ]
    summary = {
        "base": args.base, "workers": args.workers, "rounds": args.rounds, "requests": total, "elapsed_s": round(elapsed, 1), "req_per_s": round(total / elapsed, 1) if elapsed else None,
        "scale": scale, "process_before": before, "process_after": after, "results": results, "measured_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=1))
    print("\n".join(lines))
    if args.markdown:
        with open(args.markdown, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
