#!/usr/bin/env python3
"""Read-only Home Assistant / Supervisor intake probe (T002).

Uses HA_URL and HA_TOKEN from secrets/lab.env. Only GET requests. Prints a redacted summary and
stores raw JSON under private-evidence/ha-probes/<timestamp>/ (gitignored).
"""
from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "lab"))
from nvr_probe import ENV_PATH, load_env, make_redactor  # noqa: E402

PROBES = [
    ("api_root", "/api/"),
    ("config", "/api/config"),
    ("hassio_core_info", "/api/hassio/core/info"),
    ("hassio_supervisor_info", "/api/hassio/supervisor/info"),
    ("hassio_host_info", "/api/hassio/host/info"),
    ("hassio_os_info", "/api/hassio/os/info"),
    ("hassio_addons", "/api/hassio/addons"),
    ("hassio_network_info", "/api/hassio/network/info"),
]


def main() -> int:
    env = load_env(ENV_PATH)
    red = make_redactor(env)
    if not env.get("HA_TOKEN"):
        print("HA_TOKEN missing in secrets/lab.env")
        return 2
    client = httpx.Client(base_url=env["HA_URL"], headers={"Authorization": f"Bearer {env['HA_TOKEN']}"}, timeout=15)
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out = ROOT / "private-evidence" / "ha-probes" / stamp
    out.mkdir(parents=True, exist_ok=True)
    results: dict[str, object] = {}
    for name, path in PROBES:
        try:
            r = client.get(path)
        except httpx.HTTPError as exc:
            print(f"{name:24} {path:32} ERROR {type(exc).__name__}")
            continue
        body = r.text
        (out / f"{name}.json").write_text(body, encoding="utf-8")
        try:
            data = r.json()
        except ValueError:
            data = None
        results[name] = data
        print(f"{name:24} {path:32} HTTP {r.status_code} {len(r.content)} B")

    cfg = results.get("config") or {}
    if isinstance(cfg, dict):
        print("core:", cfg.get("version"), "| tz:", cfg.get("time_zone"), "| location_name:", red(str(cfg.get("location_name"))),
              "| components:", len(cfg.get("components", [])))
        comps = cfg.get("components", [])
        interesting = [c for c in comps if any(k in c for k in ("hikvision", "go2rtc", "hassio", "webrtc", "frigate", "camera", "ssh", "samba"))]
        print("interesting components:", sorted(interesting)[:30])

    def data_of(name: str) -> dict:
        d = results.get(name)
        return d.get("data", {}) if isinstance(d, dict) else {}

    sup = data_of("hassio_supervisor_info")
    if sup:
        print("supervisor:", sup.get("version"), "| channel:", sup.get("channel"), "| arch:", sup.get("arch"), "| addons_repositories:", len(sup.get("addons_repositories", [])))
        for repo in sup.get("addons_repositories", []):
            print("   repo:", red(str(repo)))
    core = data_of("hassio_core_info")
    if core:
        print("core (supervisor view):", core.get("version"), "| arch:", core.get("arch"), "| machine:", core.get("machine"))
    host = data_of("hassio_host_info")
    if host:
        print("host:", host.get("operating_system"), "| kernel:", host.get("kernel"), "| chassis:", host.get("chassis"),
              "| disk free GB:", host.get("disk_free"), "| features:", host.get("features"))
    osi = data_of("hassio_os_info")
    if osi:
        print("HAOS:", osi.get("version"), "| board:", osi.get("board"))
    addons = data_of("hassio_addons")
    if addons:
        rows = addons.get("addons", [])
        print(f"add-ons: {len(rows)}")
        for a in rows:
            print(f"   {a.get('slug'):40} {str(a.get('version')):12} state={a.get('state'):8} ingress={a.get('ingress')} repo={red(str(a.get('repository')))} name={red(str(a.get('name')))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
