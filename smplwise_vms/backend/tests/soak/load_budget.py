"""LOAD-BUDGET-2530 (T068): the resource-budget load run. Drives the real backend (its own process, `soak_long_backend.py`) with a
realistic mix of screens against the device fakes of `soak_long.py` (fake NVR, fake Home Assistant + WisKey, fake go2rtc), measures
latency per route, memory, CPU, database growth, open connections and go2rtc streams, compares them with the written budget
(`load_budget.json`, documented in docs/operations/RESOURCE_BUDGET.md) and exits non-zero when a line is over its limit.
Opt-in: nothing runs unless SW_SOAK=1. Device-free: everything listens on 127.0.0.1; refuses to run inside the add-on.

    SW_SOAK=1 python tests/soak/load_budget.py --run-dir <dir> --minutes 10            # the short budget run (~14 min wall)
    SW_SOAK=1 python tests/soak/load_budget.py --run-dir <dir> --hours 14 --restarts    # the long soak (docs/operations/SOAK_14H_RUNBOOK.md)
    python tests/soak/load_budget.py --evaluate <run-dir>                                # re-evaluate a finished run against the budget file
    stop early (graceful; the report is still written):  touch <dir>/STOP

The run, in phases:

1. start-up: fakes, the backend on a fresh data directory, the seed (8 cameras, the notices module on, --boards TV boards with their
   tokens, --notices published notices on every board);
2. idle (--idle-s): no client load; the device feeds keep flowing (NVR alerts, HA state changes). The last sample is the idle line
   ("backend working set, idle + device sync");
3. warm-up (--warmup-s): the full client load, latencies not counted (first thumbnails, caches, the first exports);
4. measurement (--minutes / --hours / --until): the full client load, every request's latency kept per route (a bounded reservoir,
   so a 14 h run stays bounded), a sample of the backend every --interval s into samples.csv;
5. drain (--drain-s): every client stops; then the backend must hold no WebSocket, live session, event subscriber or go2rtc media
   socket any more (a leaked connection shows here).

The client mix (real HTTP / WebSocket against the backend's port; the polling periods are the UI's own):

- --kiosks camera-wall screens: `GET /health/summary` every 15 s (kiosk-wall.ts), the camera list every 2 minutes;
- --home-walls home wall panels: `GET /presence/building` every 30 s (building-presence-logic.ts), the notices list every 60 s
  (home-wall-rest.ts);
- --boards notice TV boards: `GET /notices/display/<slug>` with the board token and If-None-Match every 30 s (tv-logic.ts);
- a notice author: one new published notice on every board every --author-every s, the oldest archived beyond --notices;
- soak_long's actors: --operators operators cycling the screens (2-6 s think time), an acker, an exporter, --event-sockets event-feed
  WebSockets and --viewers live viewers (live-session churn through the fake go2rtc).

Results in the run folder: samples.csv (soak_long's columns + phase / go2rtc streams / backend sockets), routes.json (p50 / p95 /
max / n / errors per route), budget_report.json and budget_report.md (every budget line: limit, measured, PASS / FAIL / N/A), and
summary.json as soak_long writes it. Exit code: 0 every line within budget, 1 a line over budget, 2 the run itself did not complete
(the backend exited, start-up failed)."""
from __future__ import annotations

import argparse
import collections
import csv
import datetime as dt
import json
import os
import random
import statistics
import sys
import threading
import time
from pathlib import Path
from typing import Any, Callable

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parents[1]
for p in (str(BACKEND), str(HERE), str(BACKEND / "tests")):
    if p not in sys.path:
        sys.path.insert(0, p)

from soak_long import CSV_HEADER, Metrics, Soak, pct, proc_stats  # noqa: E402

BUDGET_FILE = HERE / "load_budget.json"
ROUTE_KEEP = 20_000  # latencies kept per route (reservoir): bounded over a 14 h run
EXTRA_COLUMNS = ["phase", "go2rtc_streams", "backend_sockets"]
# answers that are a documented state, not an error, for the routes this module adds (soak_long's own list stays as it is)
EXPECTED_EXTRA = {"notices_display": {304}, "presence_building": {403, 404, 409}}
WRITES = {"export_create", "export_delete", "ack", "notice_create", "notice_archive"}


# ---------------------------------------------------------------- pure helpers (unit-tested)

def quantile_ms(values_s: list[float], f: float) -> float | None:
    """The f-quantile (nearest rank, as soak_long.pct) of a list of seconds, in milliseconds."""
    if not values_s:
        return None
    v = pct(sorted(values_s), f)
    return None if v is None else round(v * 1000, 1)


def slope_per_hour(points: list[tuple[float, float]]) -> float | None:
    """Least-squares slope of (elapsed seconds, value) points, per hour; None with fewer than 3 points or no time spread."""
    pts = [(x, y) for x, y in points if x is not None and y is not None]
    if len(pts) < 3:
        return None
    mx = statistics.fmean(x for x, _ in pts)
    my = statistics.fmean(y for _, y in pts)
    sxx = sum((x - mx) ** 2 for x, _ in pts)
    if sxx <= 0:
        return None
    return round(sum((x - mx) * (y - my) for x, y in pts) / sxx * 3600, 2)


def growth(values: list[float | None], k: int = 3) -> float | None:
    """Median of the last k values minus the median of the first k (robust to one noisy sample); None with fewer than 2 values."""
    vals = [float(v) for v in values if v is not None]
    if len(vals) < 2:
        return None
    k = max(1, min(k, len(vals) // 2))
    return round(statistics.median(vals[-k:]) - statistics.median(vals[:k]), 2)


def route_table(routes: dict[str, list[float]], codes: dict[str, int]) -> dict[str, dict[str, Any]]:
    """p50 / p95 / max / n per route plus the route's error answers (5xx, unexpected 4xx, client exceptions) from `codes`
    ("<route> <status or exception>" -> count)."""
    out: dict[str, dict[str, Any]] = {}
    errors: collections.Counter[str] = collections.Counter()
    for key, n in codes.items():
        name, _, what = key.rpartition(" ")
        if what.isdigit():
            st = int(what)
            if st >= 500 or (st >= 400 and st not in expected_for(name)):
                errors[name] += n
        else:
            errors[name] += n
    for name in sorted(set(routes) | set(errors)):
        vals = routes.get(name, [])
        out[name] = {"n": len(vals), "p50_ms": quantile_ms(vals, 0.5), "p95_ms": quantile_ms(vals, 0.95),
                     "max_ms": round(max(vals) * 1000, 1) if vals else None, "errors": errors.get(name, 0)}
    return out


def expected_for(name: str) -> set[int]:
    from soak_long import EXPECTED_STATUS

    return set(EXPECTED_STATUS.get(name, set())) | EXPECTED_EXTRA.get(name, set())


def group_latency(table: dict[str, dict[str, Any]], routes: dict[str, list[float]], names: list[str]) -> dict[str, Any]:
    """p50 / p95 over the pooled latencies of a group of routes, and the worst single-route p95 in it."""
    pooled = [s for n in names for s in routes.get(n, [])]
    worst = max(((table[n]["p95_ms"], n) for n in names if n in table and table[n]["p95_ms"] is not None), default=(None, None))
    return {"n": len(pooled), "p50_ms": quantile_ms(pooled, 0.5), "p95_ms": quantile_ms(pooled, 0.95), "worst_route_p95_ms": worst[0], "worst_route": worst[1]}


def evaluate(budget: dict[str, Any], measured: dict[str, Any], *, restarts: bool = False) -> list[dict[str, Any]]:
    """Every budget line against the measured value. A line: {"max": limit, "max_with_restarts": optional limit when device
    restarts are on, "min_window_min": the line applies only to a measurement window at least this long, "unit", "what"}.
    Latency groups (budget["latency"]) give `<group>.p50_ms`, `<group>.p95_ms` and `<group>.worst_route_p95_ms` lines.
    Status: PASS, FAIL, N/A (not measured in this run) or SKIPPED (window too short)."""
    window_min = (measured.get("window_s") or 0) / 60
    lines: list[dict[str, Any]] = []

    def line(name: str, spec: dict[str, Any], value: Any) -> None:
        limit = spec.get("max_with_restarts", spec.get("max")) if restarts else spec.get("max")
        row = {"line": name, "what": spec.get("what", ""), "unit": spec.get("unit", ""), "limit": limit, "value": value}
        if limit is None:
            row["status"] = "N/A"
        elif spec.get("min_window_min") and window_min < float(spec["min_window_min"]):
            row["status"] = "SKIPPED"
            row["note"] = f"needs a measurement window of {spec['min_window_min']} min or more"
        elif value is None:
            row["status"] = "N/A"
        else:
            row["status"] = "PASS" if float(value) <= float(limit) else "FAIL"
        lines.append(row)

    groups = measured.get("latency_groups") or {}
    for gname, spec in (budget.get("latency") or {}).items():
        g = groups.get(gname) or {}
        for key in ("p50_ms", "p95_ms", "worst_route_p95_ms"):
            if key in spec:
                line(f"{gname}.{key}", {"max": spec[key], "unit": "ms", "what": spec.get("what", "")}, g.get(key))
    for name, spec in (budget.get("checks") or {}).items():
        line(name, spec, measured.get(name))
    return lines


def verdict(lines: list[dict[str, Any]]) -> str:
    return "FAIL" if any(r["status"] == "FAIL" for r in lines) else "PASS"


def report_markdown(lines: list[dict[str, Any]], measured: dict[str, Any], routes: dict[str, dict[str, Any]], cfg: dict[str, Any]) -> str:
    out = [f"# Load budget run - {verdict(lines)}", "",
           f"Started {cfg.get('started_utc')}; measurement window {round((measured.get('window_s') or 0) / 60, 1)} min; "
           f"mix: {cfg.get('mix')}; device restarts {'on' if cfg.get('restarts') else 'off'}; reason {measured.get('reason')}.", "",
           "| line | limit | measured | unit | status |", "|---|---|---|---|---|"]
    for r in lines:
        out.append(f"| {r['line']} | {r['limit']} | {r['value']} | {r['unit']} | {r['status']}{' - ' + r['note'] if r.get('note') else ''} |")
    out += ["", "## Per route (measurement window)", "", "| route | n | p50 ms | p95 ms | max ms | errors |", "|---|---|---|---|---|---|"]
    for name, r in routes.items():
        out.append(f"| {name} | {r['n']} | {r['p50_ms']} | {r['p95_ms']} | {r['max_ms']} | {r['errors']} |")
    out += ["", "## Other measured values", ""]
    for k in sorted(measured):
        if k not in ("latency_groups",):
            out.append(f"- {k}: {measured[k]}")
    return "\n".join(out) + "\n"


def socket_count(pid: int) -> int | None:
    """Sockets among the open file descriptors of a process (Linux; None elsewhere): listening + connected TCP + Unix sockets."""
    try:
        n = 0
        for fd in os.listdir(f"/proc/{pid}/fd"):
            try:
                if os.readlink(f"/proc/{pid}/fd/{fd}").startswith("socket:"):
                    n += 1
            except OSError:
                continue
        return n
    except OSError:
        return None


# ---------------------------------------------------------------- per-route metrics

class RouteMetrics(Metrics):
    """soak_long's interval metrics plus, while `collect` is set, every latency per route (reservoir of ROUTE_KEEP per route)."""

    def __init__(self) -> None:
        super().__init__()
        self.collect = False
        self.routes: dict[str, list[float]] = collections.defaultdict(list)
        self.seen: collections.Counter[str] = collections.Counter()
        self.window_codes: collections.Counter[str] = collections.Counter()
        self.rnd = random.Random(2530)

    def record(self, name: str, seconds: float, status: int) -> None:
        if status in EXPECTED_EXTRA.get(name, set()):
            status_for_base = 200  # a documented answer of a route this module adds (304 Not Modified, module off): not an error
        else:
            status_for_base = status
        super().record(name, seconds, status_for_base)
        if not self.collect:
            return
        with self.lock:
            self.window_codes[f"{name} {status}"] += 1
            self.seen[name] += 1
            lst = self.routes[name]
            if len(lst) < ROUTE_KEEP:
                lst.append(seconds)
            else:
                j = self.rnd.randrange(self.seen[name])
                if j < ROUTE_KEEP:
                    lst[j] = seconds

    def client_error(self, name: str, exc: BaseException) -> None:
        super().client_error(name, exc)
        if self.collect:
            with self.lock:
                self.window_codes[f"{name} {type(exc).__name__}"] += 1


# ---------------------------------------------------------------- the run

class LoadBudget(Soak):
    def __init__(self, a: argparse.Namespace) -> None:
        super().__init__(a)
        self.metrics = RouteMetrics()
        self.phase = "startup"
        self.boards: list[dict[str, str]] = []  # {"id", "slug", "token"}
        self.notice_ids: collections.deque[str] = collections.deque()
        self.board_ids: list[str] = []

    # -- samples.csv carries three more columns
    def write_row(self, row: dict[str, Any]) -> None:
        row["phase"] = self.phase
        row["go2rtc_streams"] = len(self.g2.streams)
        row["backend_sockets"] = socket_count(self.backend.pid) if self.backend is not None else None
        path = self.run_dir / "samples.csv"
        new = not path.exists()
        with open(path, "a", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=CSV_HEADER + EXTRA_COLUMNS, extrasaction="ignore")
            if new:
                w.writeheader()
            w.writerow(row)
            f.flush()
            os.fsync(f.fileno())

    # -- seed: notices on, boards with tokens, a few published notices
    def seed_notices(self) -> None:
        a = self.a
        with self.client() as c:
            r = c.patch("/api/v1/notices/settings", json={"enabled": True, "boards_max": max(10, a.boards)})
            if r.status_code != 200:
                self.note(f"seed: notices settings answered {r.status_code}; the board / notice actors will count errors")
            for k in range(a.boards):
                r = c.post("/api/v1/notices/boards", json={"name": f"load board {k + 1}", "slug": f"load-{k + 1}"})
                if r.status_code in (200, 201):
                    j = r.json()
                    self.boards.append({"id": j["board"]["id"], "slug": j["board"]["slug"], "token": j["token"]})
                else:
                    self.note(f"seed: board {k + 1} answered {r.status_code}")
            self.board_ids = [b["id"] for b in self.boards]
            for k in range(a.notices):
                self.publish_notice(c, k)

    def publish_notice(self, c: Any, k: int) -> None:
        body = {"title": f"load notice {k + 1}", "body": "the elevator in the north lobby is serviced on Sunday between 09:00 and 12:00",
                "audience": {"everyone": True}, "boards": self.board_ids, "publish": True, "push": False}
        r = self.http(c, "POST", "/api/v1/notices", "notice_create", json=body)
        if r is not None and r.status_code in (200, 201):
            nid = (r.json().get("notice") or {}).get("id")
            if nid:
                self.notice_ids.append(nid)

    # -- the actors this module adds
    def kiosk(self, k: int) -> Callable[[int], float]:
        c = self.client()

        def step(i: int) -> float:
            self.http(c, "GET", "/api/v1/health/summary", "health_summary")
            if i % 8 == 0:
                self.http(c, "GET", "/api/v1/cameras", "cameras")
            return 15.0
        return step

    def home_wall(self, k: int) -> Callable[[int], float]:
        c = self.client()

        def step(i: int) -> float:
            self.http(c, "GET", "/api/v1/presence/building", "presence_building")
            if i % 2 == 0:
                self.http(c, "GET", "/api/v1/notices?scope=mine", "notices_list")
            return 30.0
        return step

    def board(self, k: int) -> Callable[[int], float]:
        c = self.client()
        etag: dict[str, str] = {}

        def step(i: int) -> float:
            if not self.boards:
                return 30.0
            b = self.boards[k % len(self.boards)]
            h = {"X-Board-Token": b["token"]}
            if etag.get("v"):
                h["If-None-Match"] = etag["v"]
            r = self.http(c, "GET", f"/api/v1/notices/display/{b['slug']}", "notices_display", headers=h)
            if r is not None and r.status_code == 200 and r.headers.get("etag"):
                etag["v"] = r.headers["etag"]
            return 30.0
        return step

    def author(self) -> Callable[[int], float]:
        c = self.client()

        def step(i: int) -> float:
            self.publish_notice(c, self.a.notices + i)
            while len(self.notice_ids) > self.a.notices:
                self.http(c, "POST", f"/api/v1/notices/{self.notice_ids.popleft()}/archive", "notice_archive")
            return float(self.a.author_every)
        return step

    # -- stats helpers
    def backend_numbers(self) -> dict[str, Any]:
        st, _ = self.fetch_stats()
        out: dict[str, Any] = {"stats": st}
        if self.backend is not None:
            ps = proc_stats(self.backend.pid)
            if ps:
                out.update(ps)
            out["sockets"] = socket_count(self.backend.pid)
        if st and "cpu_s" not in out:
            out["cpu_s"] = st.get("cpu_s")
        if st and "rss_mb" not in out:
            out["rss_mb"] = st.get("rss_mb")
        return out

    # -- main
    def run(self) -> dict[str, Any]:  # noqa: C901 - one linear script of phases
        from soak_local import FakeNvr

        from soak_long import FakeGo2rtc, FakeHaWiskey

        a = self.a
        (self.run_dir / "harness.pid").write_text(str(os.getpid()))
        stop_file = self.run_dir / "STOP"
        stop_file.unlink(missing_ok=True)
        self.nvr = FakeNvr()
        self.nvr.start()
        self.ha = FakeHaWiskey(rate=a.ha_rate, sensors=a.ha_sensors)
        self.ha.start()
        self.g2 = FakeGo2rtc()
        self.g2.start()
        self.start_backend()
        self.seed()
        self.seed_notices()
        mix = {"kiosks": a.kiosks, "home_walls": a.home_walls, "boards": a.boards, "operators": a.operators, "viewers": a.viewers,
               "event_sockets": a.event_sockets, "ha_entities": len(self.ha.states), "ha_rate": a.ha_rate, "cameras": len(self.cams),
               "notices": a.notices, "author_every_s": a.author_every}
        cfg = {k: v for k, v in vars(a).items()}
        cfg.update(backend=self.base, python=sys.version.split()[0], platform=sys.platform, mix=mix, restarts=self.restarts_on(),
                   started_utc=dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), harness="load_budget")
        (self.run_dir / "config.json").write_text(json.dumps(cfg, indent=1, default=str), encoding="utf-8")
        self.note(f"backend {self.base}; mix {mix}")

        prev: dict[str, Any] = {}
        n0 = self.backend_numbers()
        prev.update(cpu_s=n0.get("cpu_s"), wall=time.monotonic())
        rows: list[dict[str, Any]] = []
        measured: dict[str, Any] = {}

        def wait(seconds: float) -> bool:
            """Sleeps up to `seconds` in 1 s steps, sampling every --interval; False when the run must end now."""
            end = time.monotonic() + seconds
            nonlocal_next = [time.monotonic() + a.interval]
            while time.monotonic() < end:
                self.stop.wait(1)
                if self.stop.is_set():
                    return False
                if stop_file.exists():
                    self.reason = "stop_file"
                    self.note("STOP file found: stopping")
                    return False
                if self.backend is not None and self.backend.poll() is not None:
                    self.reason = "backend_exit"
                    self.note(f"the backend exited on its own (rc {self.backend.returncode})")
                    return False
                if time.monotonic() >= nonlocal_next[0]:
                    nonlocal_next[0] += a.interval
                    row = self.sample(prev)
                    rows.append(row)
                    self.guard(row, prev)
            return True

        # phase 2: idle
        self.phase = "idle"
        ok = wait(a.idle_s)
        idle = self.backend_numbers()
        measured["rss_idle_mb"] = idle.get("rss_mb")
        measured["threads_idle"] = idle.get("threads")
        measured["fds_idle"] = idle.get("fds")

        # phase 3 + 4: client load (warm-up, then the measurement window)
        threads: list[threading.Thread] = []
        if ok:
            threads.append(threading.Thread(target=self.restarter, name="soak-restarter", daemon=True))
            threads += [self.loop(f"operator{k}", self.operator(k), first_delay=k * 0.7) for k in range(a.operators)]
            threads += [self.loop(f"kiosk{k}", self.kiosk(k), first_delay=k * 1.3) for k in range(a.kiosks)]
            threads += [self.loop(f"homewall{k}", self.home_wall(k), first_delay=k * 2.1) for k in range(a.home_walls)]
            threads += [self.loop(f"board{k}", self.board(k), first_delay=k * 2.9) for k in range(a.boards)]
            threads += [self.loop("author", self.author(), 30), self.loop("acker", self.acker(), 3), self.loop("exporter", self.exporter(), 20)]
            threads += [self.loop(f"events_ws{k}", self.event_socket(k), k) for k in range(a.event_sockets)]
            threads += [self.loop(f"viewer{k}", self.viewer(k), 2 + k * 3) for k in range(a.viewers)]
            self.start_clock()  # the restarter's schedule counts from the start of the load
            for t in threads:
                t.start()
            self.phase = "warmup"
            ok = wait(a.warmup_s)
        w0 = self.backend_numbers()
        t_window = time.monotonic()
        if ok:
            self.phase = "measure"
            with self.metrics.lock:
                self.metrics.collect = True
            ok = wait(max(0.0, self.duration))
            if ok:
                self.reason = "duration"
        with self.metrics.lock:
            self.metrics.collect = False
        window_s = time.monotonic() - t_window
        w1 = self.backend_numbers()

        # phase 5: drain - every client stops, then nothing may stay open
        self.phase = "drain"
        self.stop.set()
        for t in threads:
            t.join(20)
        stuck = [t.name for t in threads if t.is_alive()]
        drained: dict[str, Any] = {}
        deadline = time.monotonic() + a.drain_s
        while True:
            st, _ = self.fetch_stats()
            if st is not None:
                ws_open = st.get("ws_open") or {}
                drained = {"drain_ws_open": sum(int(v) for v in ws_open.values()), "drain_live_sessions": st.get("live_sessions"),
                           "drain_event_subscribers": st.get("events_subscribers"), "drain_go2rtc_media": self.g2.ws_open,
                           "drain_http_inflight": st.get("http_inflight")}
                if not any(drained.values()):
                    break
            if time.monotonic() >= deadline or (self.backend is not None and self.backend.poll() is not None):
                break
            time.sleep(1)
        drained["drain_sockets"] = socket_count(self.backend.pid) if self.backend is not None and self.backend.poll() is None else None
        final_row = self.sample(prev) if self.backend is not None and self.backend.poll() is None else None
        if final_row:
            rows.append(final_row)
        last_stats = prev.get("last") or {}
        rc = self.stop_backend()
        for fake in (self.g2, self.nvr, self.ha):
            try:
                fake.stop()
            except Exception:  # noqa: BLE001
                pass
        self.ha.close()

        # the numbers
        win_rows = [r for r in rows if r.get("phase") == "measure"]
        measured.update(self.window_numbers(win_rows, w0, w1, window_s, last_stats))
        measured.update(drained)
        measured["reason"] = self.reason
        measured["stuck_client_threads"] = len(stuck)
        with self.metrics.lock:
            routes = {k: list(v) for k, v in self.metrics.routes.items()}
            codes = dict(self.metrics.window_codes)
        table = route_table(routes, codes)
        budget = json.loads(Path(a.budget).read_text(encoding="utf-8"))
        measured["latency_groups"] = {g: group_latency(table, routes, spec.get("routes") or []) for g, spec in (budget.get("latency") or {}).items()}
        measured["routes_without_requests"] = sorted({n for spec in (budget.get("latency") or {}).values() for n in spec.get("routes") or []} - set(routes))
        self.write_report(budget, measured, table, cfg)

        summary = {
            "reason": self.reason, "duration_s": round(window_s), "planned_s": round(self.duration), "backend_rc": rc,
            "restarts": collections.Counter(r["what"] for r in self.restarts), "client_cumulative": dict(self.metrics.cum),
            "status_codes": dict(self.metrics.codes.most_common(80)), "stuck_client_threads": stuck, "notes": self.notes[-200:],
            "first_row": win_rows[0] if win_rows else None, "last_row": win_rows[-1] if win_rows else None,
            "backend_last_stats": {k: last_stats.get(k) for k in ("log", "db_write_lock", "ingest", "events_cache", "export_counters", "thread_names", "ws_total", "http_total")},
            "fakes": {"nvr_sent": dict(self.nvr.sent), "ha_events_sent": self.ha.sent_events, "ha_connections": self.ha.connections,
                      "wiskey_frames": self.ha.wiskey_frames, "go2rtc": dict(self.g2.counters), "go2rtc_streams": sorted(self.g2.streams)},
            "backend_log": self.log_pump.stats() if self.log_pump is not None else None,
        }
        (self.run_dir / "summary.json").write_text(json.dumps(summary, indent=1, default=str), encoding="utf-8")
        return summary

    def restarts_on(self) -> bool:
        return any(float(getattr(self.a, k, 0) or 0) > 0 for k in ("nvr_every", "ha_every", "go2rtc_every"))

    def window_numbers(self, win_rows: list[dict[str, Any]], w0: dict[str, Any], w1: dict[str, Any], window_s: float,
                       last_stats: dict[str, Any]) -> dict[str, Any]:
        """Memory / CPU / DB / connection / stream numbers of the measurement window, from its samples and its two end points."""
        def col(name: str) -> list[float | None]:
            return [None if r.get(name) in (None, "") else float(r[name]) for r in win_rows]

        def num(name: str) -> list[float]:
            return [v for v in col(name) if v is not None]

        def mx(name: str) -> float | None:
            v = num(name)
            return max(v) if v else None

        hours = window_s / 3600 if window_s > 0 else None
        db0 = (w0.get("stats") or {}).get("db_bytes") or 0
        db1 = (w1.get("stats") or {}).get("db_bytes") or 0
        wal0 = (w0.get("stats") or {}).get("wal_bytes") or 0
        wal1 = (w1.get("stats") or {}).get("wal_bytes") or 0
        cpu = None
        if w0.get("cpu_s") is not None and w1.get("cpu_s") is not None and window_s > 0:
            cpu = round(100 * (w1["cpu_s"] - w0["cpu_s"]) / window_s, 1)
        rss_pts = [(float(r["elapsed_s"]), float(r["rss_mb"])) for r in win_rows if r.get("rss_mb") not in (None, "")]
        log = last_stats.get("log") or {}
        wl = last_stats.get("db_write_lock") or {}
        cum = dict(self.metrics.cum)
        with self.metrics.lock:
            codes = dict(self.metrics.window_codes)
        err5 = sum(n for k, n in codes.items() if k.rpartition(" ")[2].isdigit() and int(k.rpartition(" ")[2]) >= 500)
        err4 = sum(n for k, n in codes.items() if k.rpartition(" ")[2].isdigit() and 400 <= int(k.rpartition(" ")[2]) < 500
                   and int(k.rpartition(" ")[2]) not in expected_for(k.rpartition(" ")[0]))
        errc = sum(n for k, n in codes.items() if not k.rpartition(" ")[2].isdigit() and not k.startswith("live_ws "))
        live_opened, live_failed = cum.get("live_opened", 0), cum.get("live_failed", 0)
        return {
            "window_s": round(window_s), "samples": len(win_rows),
            "rss_load_start_mb": w0.get("rss_mb"), "rss_load_end_mb": w1.get("rss_mb"), "rss_load_max_mb": mx("rss_mb"),
            "rss_growth_mb": growth(col("rss_mb")), "rss_slope_mb_per_h": slope_per_hour(rss_pts),
            "private_growth_mb": growth(col("private_mb")),
            "cpu_avg_pct": cpu, "cpu_p95_pct": pct(sorted(num("cpu_pct")), 0.95),
            "db_bytes_end_mb": round((db1 + wal1) / 1024 / 1024, 1),
            "db_growth_mb": round((db1 + wal1 - db0 - wal0) / 1024 / 1024, 1),
            "db_growth_mb_per_h": round((db1 + wal1 - db0 - wal0) / 1024 / 1024 / hours, 1) if hours else None,
            "wal_max_mb": round(mx("wal_bytes") / 1024 / 1024, 1) if mx("wal_bytes") is not None else None,
            "fds_max": mx("fds"), "fds_growth": growth(col("fds")),
            "sockets_max": mx("backend_sockets"), "sockets_growth": growth(col("backend_sockets")),
            "threads_max": mx("threads"), "threads_growth": growth(col("threads")),
            "py_objects_growth_pct": (lambda g, v: round(100 * g / v[0], 2) if g is not None and v and v[0] else None)(growth(col("py_objects")), num("py_objects")),
            "loop_lag_p99_max_ms": mx("loop_lag_p99_ms"), "loop_lag_max_ms": mx("loop_lag_max_ms"),
            "ws_live_max": mx("ws_live_open"), "ws_events_max": mx("ws_events_open"), "live_sessions_max": mx("live_sessions"),
            "events_subscribers_max": mx("events_subscribers"),
            "go2rtc_streams_max": mx("go2rtc_streams"), "go2rtc_streams_growth": growth(col("go2rtc_streams")),
            "go2rtc_media_max": mx("go2rtc_ws_open"),
            "go2rtc_media_over_viewers": (mx("go2rtc_ws_open") - self.a.viewers) if mx("go2rtc_ws_open") is not None else None,
            "err_5xx": err5, "err_4xx_unexpected": err4, "err_client": errc,
            "db_locked": log.get("database_is_locked"), "write_lock_busy": wl.get("busy_errors"), "write_lock_max_hold_s": wl.get("max_hold_s"),
            "log_errors": log.get("errors"),
            "ingest_dropped": (last_stats.get("ingest") or {}).get("dropped"), "ingest_high_water": (last_stats.get("ingest") or {}).get("high_water"),
            "live_opened": live_opened, "live_failed": live_failed,
            "live_failed_pct": round(100 * live_failed / (live_opened + live_failed), 1) if (live_opened + live_failed) else None,
            "requests_in_window": sum(n for k, n in codes.items()),
        }

    def write_report(self, budget: dict[str, Any], measured: dict[str, Any], table: dict[str, dict[str, Any]], cfg: dict[str, Any]) -> None:
        lines = evaluate(budget, measured, restarts=self.restarts_on())
        doc = {"verdict": verdict(lines), "lines": lines, "measured": measured, "routes": table, "mix": cfg.get("mix"),
               "budget_file": str(Path(self.a.budget).name), "budget_version": budget.get("version")}
        (self.run_dir / "routes.json").write_text(json.dumps(table, indent=1), encoding="utf-8")
        (self.run_dir / "budget_report.json").write_text(json.dumps(doc, indent=1, default=str), encoding="utf-8")
        (self.run_dir / "budget_report.md").write_text(report_markdown(lines, measured, table, cfg), encoding="utf-8")
        self.verdict = doc["verdict"]
        failed = [r["line"] for r in lines if r["status"] == "FAIL"]
        print(f"[load-budget] {doc['verdict']}: {len(lines)} lines, {len(failed)} over budget {failed}; report {self.run_dir / 'budget_report.md'}", flush=True)


def reevaluate(run_dir: Path, budget_path: Path) -> int:
    """Evaluates a finished run's measured values (budget_report.json) against a (possibly changed) budget file."""
    doc = json.loads((run_dir / "budget_report.json").read_text(encoding="utf-8"))
    cfg = json.loads((run_dir / "config.json").read_text(encoding="utf-8")) if (run_dir / "config.json").exists() else {}
    budget = json.loads(budget_path.read_text(encoding="utf-8"))
    lines = evaluate(budget, doc["measured"], restarts=bool(cfg.get("restarts")))
    print(report_markdown(lines, doc["measured"], doc.get("routes") or {}, cfg))
    return 0 if verdict(lines) == "PASS" else 1


def parse(argv: list[str] | None = None) -> argparse.Namespace:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--run-dir")
    ap.add_argument("--evaluate", metavar="RUN_DIR", help="re-evaluate a finished run against --budget and exit")
    ap.add_argument("--budget", default=str(BUDGET_FILE))
    ap.add_argument("--hours", type=float, default=0.0)
    ap.add_argument("--minutes", type=float, default=0.0)
    ap.add_argument("--until", help="UTC end instant of the measurement window, e.g. 2026-11-27T06:00:00Z")
    ap.add_argument("--idle-s", type=float, default=60.0)
    ap.add_argument("--warmup-s", type=float, default=120.0)
    ap.add_argument("--drain-s", type=float, default=20.0)
    ap.add_argument("--interval", type=float, default=30.0, help="seconds between samples")
    ap.add_argument("--kiosks", type=int, default=8)
    ap.add_argument("--home-walls", type=int, default=6)
    ap.add_argument("--boards", type=int, default=8)
    ap.add_argument("--notices", type=int, default=6, help="published notices kept on the boards")
    ap.add_argument("--author-every", type=float, default=120.0)
    ap.add_argument("--operators", type=int, default=4)
    ap.add_argument("--viewers", type=int, default=4)
    ap.add_argument("--event-sockets", type=int, default=3)
    ap.add_argument("--ha-sensors", type=int, default=300, help="x2 entities (motion + power)")
    ap.add_argument("--ha-rate", type=float, default=20.0, help="state_changed events per second")
    ap.add_argument("--restarts", action="store_true", help="restart the fakes as soak_long does (NVR 30 min, HA 45 min, go2rtc 60 min)")
    ap.add_argument("--nvr-every", type=float, default=0.0)
    ap.add_argument("--ha-every", type=float, default=0.0)
    ap.add_argument("--go2rtc-every", type=float, default=0.0)
    ap.add_argument("--max-rss-mb", type=float, default=1200.0)
    ap.add_argument("--pause-mem-mb", type=float, default=800.0)
    ap.add_argument("--min-free-mb", type=float, default=2048.0)
    ap.add_argument("--log-max-mb", type=float, default=64.0)
    ap.add_argument("--log-keep", type=int, default=3)
    a = ap.parse_args(argv)
    if a.evaluate:
        return a
    if not a.run_dir:
        ap.error("give --run-dir (or --evaluate RUN_DIR)")
    if not a.until and a.hours <= 0 and a.minutes <= 0:
        ap.error("give --hours, --minutes or --until")
    if a.restarts:
        a.nvr_every = a.nvr_every or 1800.0
        a.ha_every = a.ha_every or 2700.0
        a.go2rtc_every = a.go2rtc_every or 3600.0
    return a


def main(argv: list[str] | None = None) -> int:
    a = parse(argv)
    if a.evaluate:
        return reevaluate(Path(a.evaluate), Path(a.budget))
    if os.environ.get("SW_SOAK") != "1":
        raise SystemExit("opt-in load run: set SW_SOAK=1")
    if os.environ.get("SUPERVISOR_TOKEN"):
        raise SystemExit("load_budget: refusing to run inside the Home Assistant add-on")
    run = LoadBudget(a)
    import signal

    def on_term(_sig: int, _frame: Any) -> None:
        run.reason = "signal"
        run.stop.set()

    signal.signal(signal.SIGTERM, on_term)
    try:
        signal.signal(signal.SIGINT, on_term)
    except ValueError:
        pass
    try:
        summary = run.run()
    except SystemExit as exc:
        print(f"[load-budget] start-up failed: {exc}", flush=True)
        return 2
    finally:
        run.stop.set()
        if run.backend is not None and run.backend.poll() is None:
            run.stop_backend()
    if summary["reason"] not in ("duration", "stop_file", "signal"):
        return 2
    return 0 if getattr(run, "verdict", "FAIL") == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
