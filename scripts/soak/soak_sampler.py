#!/usr/bin/env python3
"""Read-only soak sampler for the SmplWise add-on (registry task T068). Python 3.12, standard library only.

Every --interval seconds (default 60) it makes ONE GET per endpoint:
  add-on     : /healthz, /health, /health/summary   (latency, status, counters, reachability flags)
  supervisor (through the HA REST proxy): add-on stats, add-on info, core stats   (RSS/CPU, state, version)
  supervisor logs (every --logs-every samples): error / warning / traceback / startup counts of the log tail
and appends one CSV row. It never writes to any system and never talks to the NVR or go2rtc directly; the NVR /
go2rtc / Home Assistant reachability flags are the add-on's own cached view (/health), so no device is touched.

Configuration comes from environment variables or the gitignored secrets/lab.env (read at run time, never printed
or stored; no host or address lives in the repository):
  HA_URL, HA_TOKEN            Home Assistant base URL and long-lived access token (supervisor proxy)
  SOAK_ADDON_SLUG             the add-on slug as the supervisor knows it
  SOAK_ADDON_URL              base URL of the add-on API (optional; without it the add-on endpoints are skipped)
  SOAK_ADDON_TOKEN            optional bearer token for the add-on API
  SOAK_VERIFY_TLS=0           optional, disable TLS verification (lab self-signed certificates)

Restart detection (no uptime is exposed today, see README): add-on uptime reset when /health ever gains a
`process.uptime_s`; otherwise a version change, a state returning to `started` from another state, or a
monotonic counter going backwards (write-lock holds, ingest-queue accepted).
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import signal
import ssl
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

REPO = Path(__file__).resolve().parents[2]
DEFAULT_ENV_FILE = REPO / "secrets" / "lab.env"
DEFAULT_OUT = REPO / "private-evidence" / "soak-lab" / "soak_v2.csv"
HTTP_TIMEOUT_S = 10.0
LOG_LINES = 2000
GAP_FACTOR = 2.5  # a wall-clock distance above GAP_FACTOR x interval is a gap (network loss, sleep, a stalled host)

HEADER = [
    "at_utc", "seq", "event", "gap_s",
    "state", "version", "restart", "restart_reason",
    "addon_cpu_pct", "addon_mem_mib", "addon_mem_pct", "core_cpu_pct", "core_mem_pct",
    "threads", "open_fds", "uptime_s", "db_bytes", "wal_bytes", "data_disk_free_mb", "cameras",
    "lat_healthz_ms", "lat_health_ms", "lat_summary_ms", "http_healthz", "http_health", "http_summary",
    "ingest_connected", "discovery_error", "ha_connected", "nvr_reachable", "go2rtc_reachable",
    "lock_holds", "lock_busy_errors", "lock_gate_timeouts", "lock_waits_over_1s", "lock_max_wait_recent_s",
    "ingest_accepted", "ingest_dropped", "ingest_failed", "ingest_depth", "export_waiting", "export_paused_disk_full",
    "log_errors", "log_warnings", "log_tracebacks", "log_starts",
    "error",
]


class ConfigError(Exception):
    pass


@dataclass
class Config:
    ha_url: str = ""
    ha_token: str = ""
    slug: str = ""
    addon_url: str = ""
    addon_token: str = ""
    verify_tls: bool = True
    interval_s: float = 60.0
    duration_h: float = 0.0  # 0 = until interrupted
    logs_every: int = 5
    out: Path = DEFAULT_OUT


@dataclass
class Fetched:
    status: int | None  # None = no HTTP answer (timeout, refused, DNS)
    ms: float | None
    body: bytes = b""
    error: str = ""


Fetcher = Callable[[str, dict[str, str]], Fetched]


# ----------------------------------------------------------------------------------------------- configuration

def parse_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return out
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def load_config(args: argparse.Namespace, environ: dict[str, str] | None = None) -> Config:
    environ = os.environ if environ is None else environ
    file_vals = parse_env_file(Path(args.env_file)) if args.env_file else {}

    def get(key: str) -> str:
        return (environ.get(key) or file_vals.get(key) or "").strip()

    return Config(
        ha_url=get("HA_URL").rstrip("/"), ha_token=get("HA_TOKEN"), slug=get("SOAK_ADDON_SLUG"),
        addon_url=get("SOAK_ADDON_URL").rstrip("/"), addon_token=get("SOAK_ADDON_TOKEN"),
        verify_tls=get("SOAK_VERIFY_TLS") not in ("0", "false", "no"),
        interval_s=args.interval, duration_h=args.duration, logs_every=args.logs_every, out=Path(args.out),
    )


def validate_config(cfg: Config) -> list[str]:
    """Problems that prevent sampling (empty = valid). Never includes a secret or an address."""
    bad: list[str] = []
    if not cfg.ha_url.startswith(("http://", "https://")):
        bad.append("HA_URL missing or not http(s)")
    if not cfg.ha_token:
        bad.append("HA_TOKEN missing")
    if not cfg.slug:
        bad.append("SOAK_ADDON_SLUG missing")
    if cfg.addon_url and not cfg.addon_url.startswith(("http://", "https://")):
        bad.append("SOAK_ADDON_URL is not http(s)")
    if cfg.interval_s < 5:
        bad.append("--interval below 5 s is refused (read-only, low-load tool)")
    if cfg.duration_h < 0:
        bad.append("--duration must be >= 0")
    if cfg.logs_every < 1:
        bad.append("--logs-every must be >= 1")
    parent = cfg.out.parent
    if parent.exists() and not os.access(parent, os.W_OK):
        bad.append("output directory is not writable")
    return bad


# ----------------------------------------------------------------------------------------------- HTTP

def make_fetcher(cfg: Config) -> Fetcher:
    ctx = None
    if not cfg.verify_tls:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

    def fetch(url: str, headers: dict[str, str]) -> Fetched:
        req = urllib.request.Request(url, headers=headers, method="GET")
        t0 = time.perf_counter()
        try:
            with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT_S, context=ctx) as r:
                body = r.read()
                return Fetched(r.status, (time.perf_counter() - t0) * 1000.0, body)
        except urllib.error.HTTPError as e:
            return Fetched(e.code, (time.perf_counter() - t0) * 1000.0, b"", f"http_{e.code}")
        except Exception as e:  # noqa: BLE001 - network loss must never stop the soak
            return Fetched(None, None, b"", type(e).__name__)

    return fetch


def _json(f: Fetched) -> dict[str, Any]:
    if f.status != 200 or not f.body:
        return {}
    try:
        v = json.loads(f.body.decode("utf-8", "replace"))
    except ValueError:
        return {}
    if isinstance(v, dict) and isinstance(v.get("data"), dict):  # supervisor envelope
        return v["data"]
    return v if isinstance(v, dict) else {}


def _dig(d: Any, *path: str) -> Any:
    for p in path:
        if not isinstance(d, dict):
            return None
        d = d.get(p)
    return d


def _num(v: Any, nd: int = 3) -> float | int | None:
    if isinstance(v, bool) or v is None:
        return None
    if isinstance(v, float):
        return round(v, nd)
    if isinstance(v, int):
        return v
    return None


def _flag(v: Any) -> int | None:
    return None if v is None else int(bool(v))


def _dict(v: Any) -> dict[str, Any]:
    return v if isinstance(v, dict) else {}


# ----------------------------------------------------------------------------------------------- sampling

@dataclass
class State:
    seq: int = 0
    last_wall: float | None = None
    last_version: str | None = None
    last_state: str | None = None
    last_uptime: float | None = None
    last_counters: dict[str, float] = field(default_factory=dict)
    samples_since_logs: int = 10**9  # the first sample reads the logs


def utc(ts: float) -> str:
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _count_logs(text: str) -> dict[str, int]:
    lines = text.splitlines()
    return {
        "log_errors": sum(1 for x in lines if " ERROR " in x or " CRITICAL " in x),
        "log_warnings": sum(1 for x in lines if " WARNING " in x),
        "log_tracebacks": sum(1 for x in lines if x.startswith("Traceback")),
        "log_starts": sum(1 for x in lines if "Application startup complete" in x),
    }


def sample_once(cfg: Config, fetch: Fetcher, st: State, now: float) -> list[dict[str, Any]]:
    """One sample: exactly one GET per endpoint. Returns the rows to append (a gap row first when the wall clock jumped)."""
    rows: list[dict[str, Any]] = []
    if st.last_wall is not None and now - st.last_wall > GAP_FACTOR * cfg.interval_s:
        st.seq += 1
        rows.append({"at_utc": utc(now), "seq": st.seq, "event": "gap", "gap_s": round(now - st.last_wall, 1)})
    st.last_wall = now
    st.seq += 1
    row: dict[str, Any] = {"at_utc": utc(now), "seq": st.seq, "event": "sample"}
    errors: list[str] = []
    sup_h = {"Authorization": f"Bearer {cfg.ha_token}", "Accept": "application/json"}
    base = f"{cfg.ha_url}/api/hassio"

    stats_f = fetch(f"{base}/addons/{cfg.slug}/stats", sup_h)
    info_f = fetch(f"{base}/addons/{cfg.slug}/info", sup_h)
    core_f = fetch(f"{base}/core/stats", sup_h)
    for name, f in (("stats", stats_f), ("info", info_f), ("core", core_f)):
        if f.status != 200:
            errors.append(f"sup_{name}:{f.error or f.status}")
    stats, info, core = _json(stats_f), _json(info_f), _json(core_f)
    mem = stats.get("memory_usage")
    row.update({
        "state": info.get("state"), "version": info.get("version"),
        "addon_cpu_pct": _num(stats.get("cpu_percent")),
        "addon_mem_mib": round(mem / 1048576, 1) if isinstance(mem, (int, float)) else None,
        "addon_mem_pct": _num(stats.get("memory_percent")), "core_cpu_pct": _num(core.get("cpu_percent")),
        "core_mem_pct": _num(core.get("memory_percent")),
    })

    health: dict[str, Any] = {}
    if cfg.addon_url:
        ah = {"Accept": "application/json"}
        if cfg.addon_token:
            ah["Authorization"] = f"Bearer {cfg.addon_token}"
        hz, hl, sm = (fetch(cfg.addon_url + p, ah) for p in ("/healthz", "/health", "/health/summary"))
        for key, f in (("healthz", hz), ("health", hl), ("summary", sm)):
            row[f"lat_{key}_ms"] = None if f.ms is None else round(f.ms, 1)
            row[f"http_{key}"] = f.status if f.status is not None else 0
            if f.status != 200:
                errors.append(f"addon_{key}:{f.error or f.status}")
        health = _json(hl)

    # Fields appear only when the endpoint exposes them (README: the process / db-size block is a proposal, not implemented).
    proc = _dict(health.get("process"))
    row["threads"] = _num(proc.get("threads"))
    row["open_fds"] = _num(proc.get("open_fds"))
    row["uptime_s"] = _num(proc.get("uptime_s"), 1)
    dbb = _dict(health.get("db"))
    row["db_bytes"] = _num(dbb.get("size_bytes"))
    row["wal_bytes"] = _num(dbb.get("wal_bytes"))
    bp = _dict(health.get("backpressure"))
    row["data_disk_free_mb"] = _num(_dig(bp, "data_disk", "free_mb"))
    ds = _dict(health.get("discovery"))
    row["cameras"] = _num(ds.get("cameras"))
    ing_connected = _dig(health, "events", "ingest", "connected")
    row["ingest_connected"] = _flag(ing_connected)
    row["discovery_error"] = _flag(ds.get("cameras_last_error") or ds.get("streams_last_error")) if ds else None
    row["ha_connected"] = _flag(_dig(health, "home_assistant", "connected"))
    # NVR reachable = the alert stream is connected (when an NVR is configured); go2rtc = the last stream sync did not fail.
    row["nvr_reachable"] = _flag(ing_connected) if health.get("nvr_configured") else None
    row["go2rtc_reachable"] = int(not ds.get("streams_last_error")) if health.get("go2rtc_configured") else None
    wl = _dict(dbb.get("write_lock"))
    row["lock_holds"] = _num(wl.get("holds"))
    row["lock_busy_errors"] = _num(wl.get("busy_errors"))
    row["lock_gate_timeouts"] = _num(wl.get("gate_timeouts"))
    row["lock_waits_over_1s"] = _num(wl.get("waits_over_1s"))
    row["lock_max_wait_recent_s"] = _num(wl.get("max_wait_recent_s"))
    iq = _dict(bp.get("ingest_queue"))
    row["ingest_accepted"] = _num(iq.get("accepted"))
    row["ingest_dropped"] = _num(iq.get("dropped"))
    row["ingest_failed"] = _num(iq.get("failed"))
    row["ingest_depth"] = _num(iq.get("depth"))
    ex = _dict(bp.get("exports"))
    row["export_waiting"] = _num(ex.get("waiting"))
    row["export_paused_disk_full"] = _num(ex.get("paused_disk_full"))

    st.samples_since_logs += 1
    if st.samples_since_logs >= cfg.logs_every:
        st.samples_since_logs = 0
        lf = fetch(f"{base}/addons/{cfg.slug}/logs?lines={LOG_LINES}", {**sup_h, "Accept": "text/plain"})
        if lf.status == 200:
            row.update(_count_logs(lf.body.decode("utf-8", "replace")))
        else:
            errors.append(f"sup_logs:{lf.error or lf.status}")

    reason = detect_restart(st, row)
    row["restart"] = 1 if reason else 0
    row["restart_reason"] = reason
    row["error"] = ";".join(errors)
    rows.append(row)
    return rows


COUNTERS = ("lock_holds", "ingest_accepted")


def detect_restart(st: State, row: dict[str, Any]) -> str:
    reasons: list[str] = []
    up = row.get("uptime_s")
    if up is not None:
        if st.last_uptime is not None and up < st.last_uptime:
            reasons.append("uptime_reset")
        st.last_uptime = up
    ver = row.get("version")
    if ver:
        if st.last_version and ver != st.last_version:
            reasons.append("version_change")
        st.last_version = ver
    state = row.get("state")
    if state:
        if state == "started" and st.last_state not in (None, "started"):
            reasons.append("state_back_to_started")
        st.last_state = state
    for c in COUNTERS:
        v = row.get(c)
        if v is None:
            continue
        prev = st.last_counters.get(c)
        if prev is not None and v < prev:
            reasons.append(f"counter_reset:{c}")
        st.last_counters[c] = v
    return "+".join(reasons)


# ----------------------------------------------------------------------------------------------- CSV

def _line(values: list[Any]) -> bytes:
    buf = io.StringIO()
    csv.writer(buf, lineterminator="\n").writerow(["" if v is None else v for v in values])
    return buf.getvalue().encode("utf-8")


def append_rows(path: Path, rows: list[dict[str, Any]]) -> None:
    """Atomic append: the header is written once (a new or empty file), a torn last line from a killed process is
    terminated first, and all rows go out in a single write followed by fsync. A file whose header differs is refused."""
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = b""
    if path.exists() and path.stat().st_size > 0:
        with path.open("rb") as f:
            first = f.readline().decode("utf-8", "replace").strip()
            if first != ",".join(HEADER):
                raise ConfigError("existing output file has a different header; choose another --out")
            f.seek(-1, os.SEEK_END)
            if f.read(1) != b"\n":
                payload += b"\n"
    else:
        payload += _line(HEADER)
    for r in rows:
        payload += _line([r.get(c) for c in HEADER])
    fd = os.open(path, os.O_WRONLY | os.O_APPEND | os.O_CREAT | getattr(os, "O_BINARY", 0), 0o644)
    try:
        os.write(fd, payload)
        os.fsync(fd)
    finally:
        os.close(fd)


# ----------------------------------------------------------------------------------------------- loop

def run(cfg: Config, fetch: Fetcher, *, clock: Callable[[], float] = time.time, sleep: Callable[[float], None] = time.sleep,
        max_samples: int | None = None, stop: Callable[[], bool] = lambda: False) -> int:
    st = State()
    start = clock()
    end = start + cfg.duration_h * 3600 if cfg.duration_h > 0 else None
    n = 0
    next_t = start
    append_rows(cfg.out, [{"at_utc": utc(start), "seq": 0, "event": "start"}])
    while not stop():
        now = clock()
        if end is not None and now >= end:
            break
        append_rows(cfg.out, sample_once(cfg, fetch, st, now))
        n += 1
        if max_samples is not None and n >= max_samples:
            break
        next_t += cfg.interval_s
        now = clock()
        if next_t < now:  # woke late (sleep, stall): no catch-up burst; the gap is marked on the next sample
            next_t = now
        wait = next_t - now
        while wait > 0 and not stop():
            sleep(min(wait, 1.0))
            wait = next_t - clock()
    append_rows(cfg.out, [{"at_utc": utc(clock()), "seq": st.seq + 1, "event": "stop"}])
    return n


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Read-only soak sampler (T068). See scripts/soak/README_HE.md.")
    ap.add_argument("--interval", type=float, default=60.0, help="seconds between samples (default 60, minimum 5)")
    ap.add_argument("--duration", type=float, default=0.0, help="hours to run (0 = until Ctrl-C)")
    ap.add_argument("--out", default=str(DEFAULT_OUT), help="CSV file to append to")
    ap.add_argument("--env-file", default=str(DEFAULT_ENV_FILE), help="env file read when a variable is not in the environment")
    ap.add_argument("--logs-every", type=int, default=5, help="read the add-on log tail every N samples")
    ap.add_argument("--check", action="store_true", help="validate the configuration and exit; no network, no sampling")
    args = ap.parse_args(argv)
    cfg = load_config(args)
    problems = validate_config(cfg)
    if args.check:
        print("config check (values are never printed):")
        for k, v in (("HA_URL", cfg.ha_url), ("HA_TOKEN", cfg.ha_token), ("SOAK_ADDON_SLUG", cfg.slug),
                     ("SOAK_ADDON_URL", cfg.addon_url), ("SOAK_ADDON_TOKEN", cfg.addon_token)):
            print(f"  {k}: {'set' if v else 'not set'}")
        dur = f"{cfg.duration_h:g}h" if cfg.duration_h else "until interrupted"
        print(f"  interval={cfg.interval_s:g}s duration={dur} logs_every={cfg.logs_every} tls_verify={cfg.verify_tls}")
        print(f"  requests per sample: {3 + (3 if cfg.addon_url else 0)} (+1 log read every {cfg.logs_every} samples)")
        print(f"  output file: {cfg.out.name}")
        for p in problems:
            print(f"  PROBLEM: {p}")
        print("RESULT:", "INVALID" if problems else "OK")
        return 2 if problems else 0
    if problems:
        print("configuration invalid:", "; ".join(problems), file=sys.stderr)
        return 2
    stop_flag = {"v": False}

    def _sig(*_: Any) -> None:
        stop_flag["v"] = True

    signal.signal(signal.SIGINT, _sig)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, _sig)
    try:
        n = run(cfg, make_fetcher(cfg), stop=lambda: stop_flag["v"])
    except ConfigError as e:
        print(str(e), file=sys.stderr)
        return 2
    print(f"done: {n} samples")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
