#!/usr/bin/env python3
"""fixture_job - run the Playwright specs that need a live fixture backend, the way the release gate does (own backend on free
ports, own empty data dir, vite preview of frontend/dist proxying to it), then tear everything down.

  fixture_job.py [spec ...] [--project=desktop|tablet|mobile ...] [--no-build] [--list]

spec: a basename with or without .spec.ts (a path is reduced to its basename); none = every spec in
frontend/tests/fixtures/fixture_specs.json. --project overrides the per-spec project list of the JSON. The JSON is the one
source also read by scripts/gate/release_gate.py. Meant for the runner (run_remote.sh fixture ... takes the shared lock first);
no real Home Assistant or device is ever reached (the fixtures force .test hosts and refuse to run inside the add-on).
Only process groups started here are stopped. Exit 0 = every group passed with at least one test that really ran.
"""
from __future__ import annotations

import json
import os
import signal
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FE = ROOT / "frontend"
SPEC_JSON = FE / "tests" / "fixtures" / "fixture_specs.json"
GROUP_TIMEOUT = int(os.environ.get("FIXTURE_GROUP_SECS", "1200"))
STARTED: list[int] = []  # process groups started here: the only ones ever signalled


def load_specs(path: Path = SPEC_JSON) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))["groups"]


def gate_specs(groups: dict) -> set[str]:
    return {n for g in groups.values() for n, s in g["specs"].items() if s.get("gate")}


def norm(name: str) -> str:
    base = name.replace("\\", "/").rsplit("/", 1)[-1]
    return base if base.endswith(".spec.ts") else base + ".spec.ts"


def plan(groups: dict, requested: list[str], projects: list[str]):
    """-> ([(group, [(projects tuple, [spec names])])], unknown names). Requested empty = all specs."""
    want = [norm(r) for r in requested]
    known = {n for g in groups.values() for n in g["specs"]}
    unknown = [n for n in want if n not in known]
    out = []
    for gname, g in groups.items():
        picked = [n for n in g["specs"] if not want or n in want]
        if not picked:
            continue
        by: dict[tuple, list[str]] = {}
        for n in picked:
            by.setdefault(tuple(projects or g["specs"][n].get("projects") or ["desktop", "tablet", "mobile"]), []).append(n)
        out.append((gname, list(by.items())))
    return out, unknown


def free_ports(extra: int = 1) -> int:
    """A port P such that P .. P+extra are all free (the control / fake HA ports sit right above the API port)."""
    for _ in range(100):
        s = socket.socket()
        s.bind(("127.0.0.1", 0))
        p = s.getsockname()[1]
        s.close()
        held = []
        try:
            for i in range(1, extra + 1):
                t = socket.socket()
                t.bind(("127.0.0.1", p + i))
                held.append(t)
            return p
        except OSError:
            continue
        finally:
            for t in held:
                t.close()
    raise RuntimeError("no free port range")


def spawn(cmd, cwd, log: Path, env=None):
    e = dict(os.environ)
    e.update(env or {})
    f = open(log, "ab")
    p = subprocess.Popen([str(c) for c in cmd], cwd=str(cwd), env=e, stdout=f, stderr=subprocess.STDOUT, start_new_session=True)
    STARTED.append(p.pid)
    p._log = f  # type: ignore[attr-defined]
    return p


def stop_group(pid: int) -> None:
    """SIGTERM then SIGKILL to the process group this script started (never by name)."""
    for sig in (signal.SIGTERM, signal.SIGKILL):
        try:
            os.killpg(pid, sig)
        except (ProcessLookupError, PermissionError):
            break
        if sig == signal.SIGTERM:
            time.sleep(1.5)


def reap(p) -> None:
    try:
        p._log.close()
    except Exception:
        pass
    if p.pid in STARTED:
        stop_group(p.pid)
        STARTED.remove(p.pid)
    try:
        p.wait(timeout=5)
    except Exception:
        pass


def wait_http(url: str, secs: int) -> bool:
    end = time.time() + secs
    while time.time() < end:
        try:
            with urllib.request.urlopen(url, timeout=3) as r:
                if r.status < 500:
                    return True
        except Exception:
            time.sleep(1)
    return False


def pw_stats(json_path: Path) -> dict | None:
    try:
        return json.loads(json_path.read_text(encoding="utf-8")).get("stats")
    except (OSError, ValueError):
        return None


def judge(rc: int, stats: dict | None) -> str:
    """PASS only when Playwright exited 0 AND at least one test really ran (an all-skipped run proves nothing)."""
    if stats is None:
        return "FAIL (no Playwright report)"
    ran = int(stats.get("expected", 0)) + int(stats.get("unexpected", 0)) + int(stats.get("flaky", 0))
    if rc != 0 or stats.get("unexpected"):
        return f"FAIL (rc={rc}, failed={stats.get('unexpected', 0)})"
    if ran == 0:
        return f"FAIL (nothing ran: skipped={stats.get('skipped', 0)})"
    return "PASS"


def run_group(gname: str, g: dict, runs, logd: Path, deadline: float) -> bool:
    py = sys.executable
    data = Path(tempfile.mkdtemp(prefix=f"fixture_{gname}_", dir=str(logd)))
    api = free_ports(int(g.get("extra_ports", 1)))
    base_env = {"SW_PORT": str(api), "SW_DATA_DIR": str(data), "SW_DEV_USER": "joni", "SW_BOOTSTRAP_ADMIN": "joni"}
    procs = []
    ok_all = True
    try:
        fx = spawn([py, g["script"]], ROOT, logd / f"{gname}_backend.log", base_env)
        procs.append(fx)
        if not wait_http(f"http://127.0.0.1:{api}/healthz", 90):
            print(f"FIXTURE {gname}: the fixture backend did not come up; see {logd / (gname + '_backend.log')}", flush=True)
            return False
        if g.get("seed"):
            r = subprocess.run([py, g["seed"], str(api), str(api + 1)], cwd=str(ROOT), capture_output=True, text=True, timeout=180)
            print((r.stdout + r.stderr).strip(), flush=True)
            if r.returncode != 0:
                print(f"FIXTURE {gname}: seed failed (rc={r.returncode})", flush=True)
                return False
        port = free_ports(0)
        vp = spawn(["npx", "vite", "preview", "--host", "127.0.0.1", "--port", str(port), "--strictPort"], FE, logd / f"{gname}_preview.log", {"SW_API_PORT": str(api)})
        procs.append(vp)
        if not wait_http(f"http://127.0.0.1:{port}/", 90):
            print(f"FIXTURE {gname}: vite preview did not come up; see {logd / (gname + '_preview.log')}", flush=True)
            return False
        env = dict(g.get("pw_env", {}), SW_API_PORT=str(api), SW_BASE_URL=f"http://127.0.0.1:{port}/")
        for projs, names in runs:
            rep = logd / f"{gname}_{'-'.join(projs)}.json"
            cmd = ["npx", "playwright", "test"] + [f"tests/{n}" for n in names] + [f"--project={p}" for p in projs] + ["--workers=1", "--reporter=list,json"]
            e = dict(os.environ)
            e.update(env)
            e["PLAYWRIGHT_JSON_OUTPUT_NAME"] = str(rep)
            print(f"FIXTURE {gname}: playwright {' '.join(names)} --project={','.join(projs)} (backend :{api}, ui :{port})", flush=True)
            p = subprocess.Popen(cmd, cwd=str(FE), env=e, start_new_session=True)
            STARTED.append(p.pid)
            try:
                rc = p.wait(timeout=max(30, min(GROUP_TIMEOUT, deadline - time.time())))
            except subprocess.TimeoutExpired:
                rc = 124
                stop_group(p.pid)
                p.wait()
            if p.pid in STARTED:
                STARTED.remove(p.pid)
            stats = pw_stats(rep)
            verdict = judge(rc, stats)
            print(f"FIXTURE_RESULT {gname} {','.join(names)} --project={','.join(projs)}: {verdict} stats={stats}", flush=True)
            ok_all = ok_all and verdict == "PASS"
        return ok_all
    finally:
        for p in reversed(procs):
            reap(p)


def main(argv: list[str]) -> int:
    args = [a for a in argv if not a.startswith("--")]
    projects = [a.split("=", 1)[1] for a in argv if a.startswith("--project=")]
    groups = load_specs()
    if "--list" in argv:
        for gname, g in groups.items():
            print(gname, g["script"], ", ".join(n + (" [gate]" if s.get("gate") else "") for n, s in g["specs"].items()))
        return 0
    todo, unknown = plan(groups, args, projects)
    if unknown:
        print("not a fixture spec (see fixture_specs.json): " + ", ".join(unknown), flush=True)
        return 2
    logd = Path(tempfile.mkdtemp(prefix="fixture_job_"))
    deadline = time.time() + int(os.environ.get("FIXTURE_TOTAL_SECS", "3000"))
    if "--no-build" not in argv or not (FE / "dist" / "index.html").exists():
        print("FIXTURE: npm run build", flush=True)
        r = subprocess.run("npm run build", cwd=str(FE), shell=True, capture_output=True, text=True)
        (logd / "build.log").write_text(r.stdout + r.stderr, encoding="utf-8")
        if r.returncode != 0:
            print((r.stdout + r.stderr)[-1500:], flush=True)
            print("FIXTURE: build failed", flush=True)
            return 1
    ok = True

    def on_term(*_):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, on_term)
    try:
        for gname, runs in todo:
            ok = run_group(gname, groups[gname], runs, logd, deadline) and ok
    except KeyboardInterrupt:
        print("FIXTURE: interrupted", flush=True)
        ok = False
    print(f"FIXTURE_{'PASS' if ok else 'FAIL'} logs={logd}", flush=True)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
