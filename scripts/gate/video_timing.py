#!/usr/bin/env python3
"""Time to camera / time to recording (T074, docs/changes/T074-VISUAL-METRICS-2405.md): numbers a nightly (or the lead) can
report and threshold. Stdlib only; reads, never writes, the sources it is given.

What is measured (all server side, by the add-on itself; nothing here touches a device):
  live.mse.first_media_ms        live socket opened -> first media byte relayed (MSE; `ttff_ms` of the video.live.stop row)
  live.webrtc.answer_ms          live socket opened -> go2rtc's webrtc/answer (WebRTC media flows outside the socket, so the answer
                                 is the server-side proxy; the browser's first decoded frame is NOT seen here)
  playback.start.first_media_ms  playback start request -> first media byte of generation 0 (the "time to recording")
  playback.seek.first_media_ms   seek request -> first media byte of the new generation
  live.no_media_ratio / playback.no_media_ratio   sessions that ended without any measured media / all sessions
  upstream_errors                go2rtc error CLASSES only (auth, timeout, refused, ...), never their text

Sources (any mix; repeat a flag for several files):
  --log FILE         add-on log text: `live session <id> ended: <reason> (transport <t>, first media <n|-> ms[, answer <n|-> ms])`
                     and `playback session <id> g<N> socket closed: <reason> (<b> bytes[, first media <n|-> ms])` (T074 and later; an older
                     playback line without the field is counted as `unmeasured`, never as no media)
  --audit-json FILE  the JSON of GET /api/v1/audit?prefix=video.live.stop (and ...=video.playback.stop): {"rows": [...]} or a list
  --db FILE          an Arx SQLite database (opened READ-ONLY, uri mode=ro): audit_log rows of the last --since-days (default 7)
A session seen in two sources is counted once (by its session id, used for de-duplication only and never written out).

Privacy (acceptance AT148): the output carries counts, percentiles and error classes - no session, camera, user, stream, URL,
address or error text. Nothing is collected by this script; it only aggregates rows the add-on already wrote.

  video_timing.py report [sources] [--thresholds FILE] [--json OUT] [--md OUT] [--enforce]
Thresholds (default video_timing_thresholds.json next to this file): per metric a percentile limit (`p50`/`p90`/`p95`/`max`, ms) or
for a ratio a `max`; `min_samples` below which a check is INSUFFICIENT (not evaluated - never a pass).
Exit: 0 report written (without --enforce always, whatever the numbers); with --enforce 1 = a limit breached, 3 = nothing could be
evaluated (no or too few samples); 2 = input error.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import re
import sqlite3
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_THRESHOLDS = HERE / "video_timing_thresholds.json"

LIVE_RE = re.compile(r"live session (?P<sid>[0-9a-zA-Z_-]+) ended: (?P<reason>\S+) \(transport (?P<transport>[^,\s]+), "
                     r"first media (?P<ttff>\d+|-) ms(?:, answer (?P<answer>\d+|-) ms)?\)")
PLAYBACK_RE = re.compile(r"playback session (?P<sid>[0-9a-zA-Z_-]+) g(?P<gen>\d+) socket closed: (?P<reason>\S+) "
                         r"\((?P<bytes>\d+) bytes(?:, first media (?P<ms>\d+|-) ms)?\)")
SURFACES = {"camera", "ha_camera", "station", "intercom", "door_station"}   # resource types reported by name; anything else is "other"
ERROR_CLASSES = {"auth", "timeout", "refused", "codecs", "not_found", "busy", "eof", "other"}   # services/live_diag.py classes
METRICS = ("live.mse.first_media_ms", "live.webrtc.answer_ms", "playback.start.first_media_ms", "playback.seek.first_media_ms")
RATIOS = ("live.no_media_ratio", "playback.no_media_ratio")
STATS = ("p50", "p90", "p95", "max")


def _int(v) -> int | None:
    if isinstance(v, bool):
        return None
    if isinstance(v, int):
        return v if v >= 0 else None
    if isinstance(v, str) and v.isdigit():
        return int(v)
    return None


class Collector:
    """Sessions keyed by their id (de-duplication across sources); only numbers leave it."""

    def __init__(self) -> None:
        self.live: dict[str, dict] = {}          # sid -> {transport, ttff, answer, error, surface}
        self.pb_start: dict[str, int | None] = {}  # sid -> start ms (None = no media)
        self.pb_seek_audit: dict[str, list[int]] = {}
        self.pb_seek_log: dict[tuple[str, int], int | None] = {}
        self.pb_unmeasured = 0               # playback sockets / stop rows from before T074 (nothing measured)
        self.live_unmeasured = 0             # live stop rows from before 2.40.0
        self.sources: list[dict] = []

    # ---- live
    def live_session(self, sid: str, transport, ttff, answer, error=None, surface=None) -> None:
        cur = self.live.setdefault(sid, {"transport": None, "ttff": None, "answer": None, "error": None, "surface": None})
        t = str(transport or "").strip().lower()
        if t in ("mse", "webrtc") and not cur["transport"]:
            cur["transport"] = t
        for k, v in (("ttff", _int(ttff)), ("answer", _int(answer))):
            if v is not None and cur[k] is None:
                cur[k] = v
        if error and not cur["error"]:
            cur["error"] = error if error in ERROR_CLASSES else "other"
        if surface and not cur["surface"]:
            cur["surface"] = surface if surface in SURFACES else "other"

    # ---- playback
    def playback_start(self, sid: str, ms) -> None:
        """A measured start (ms) wins over a "no media" (None) of the same session from another source or socket."""
        if self.pb_start.get(sid) is None:
            self.pb_start[sid] = _int(ms)

    def playback_seek_audit(self, sid: str, values) -> None:
        vals = [x for x in (_int(v) for v in (values or [])) if x is not None]
        if vals:
            self.pb_seek_audit[sid] = vals

    def playback_socket(self, sid: str, gen: int, ms) -> None:
        if gen == 0:
            self.playback_start(sid, ms)
            return
        v = _int(ms)
        if self.pb_seek_log.get((sid, gen)) is None:
            self.pb_seek_log[(sid, gen)] = v

    # ---- results
    def samples(self) -> dict[str, list[int]]:
        out = {m: [] for m in METRICS}
        for s in self.live.values():
            if s["transport"] == "mse" and s["ttff"] is not None:
                out["live.mse.first_media_ms"].append(s["ttff"])
            if s["transport"] == "webrtc" and s["answer"] is not None:
                out["live.webrtc.answer_ms"].append(s["answer"])
        out["playback.start.first_media_ms"] = [v for v in self.pb_start.values() if v is not None]
        seeks = [v for vals in self.pb_seek_audit.values() for v in vals]
        seeks += [v for (sid, _g), v in self.pb_seek_log.items() if v is not None and sid not in self.pb_seek_audit]
        out["playback.seek.first_media_ms"] = seeks
        return out

    def ratios(self) -> dict[str, dict]:
        live_none = sum(1 for s in self.live.values() if s["ttff"] is None and s["answer"] is None)
        pb_none = sum(1 for v in self.pb_start.values() if v is None)
        return {"live.no_media_ratio": _ratio(live_none, len(self.live)), "playback.no_media_ratio": _ratio(pb_none, len(self.pb_start))}

    def errors(self) -> dict[str, int]:
        out: dict[str, int] = {}
        for s in self.live.values():
            if s["error"]:
                out[s["error"]] = out.get(s["error"], 0) + 1
        return dict(sorted(out.items()))

    def by_transport(self) -> dict[str, int]:
        out: dict[str, int] = {}
        for s in self.live.values():
            k = s["transport"] or "none"
            out[k] = out.get(k, 0) + 1
        return dict(sorted(out.items()))

    def by_surface(self) -> dict[str, int]:
        out: dict[str, int] = {}
        for s in self.live.values():
            k = s["surface"] or "unknown"
            out[k] = out.get(k, 0) + 1
        return dict(sorted(out.items()))


def _ratio(k: int, n: int) -> dict:
    return {"no_media": k, "total": n, "ratio": round(k / n, 4) if n else None}


def percentile(values: list[int], p: float) -> int | None:
    """Nearest-rank percentile (p in 0..100) of integer samples; None for no samples."""
    if not values:
        return None
    s = sorted(values)
    k = max(1, math.ceil(p / 100 * len(s)))
    return s[min(k, len(s)) - 1]


def stats(values: list[int]) -> dict:
    return {"n": len(values), "p50": percentile(values, 50), "p90": percentile(values, 90), "p95": percentile(values, 95),
            "max": max(values) if values else None}


# ---------------------------------------------------------------- sources
def read_log(c: Collector, path: Path) -> None:
    lines = matched = 0
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            lines += 1
            m = LIVE_RE.search(line)
            if m:
                matched += 1
                c.live_session(m["sid"], m["transport"], m["ttff"], m["answer"])
                continue
            m = PLAYBACK_RE.search(line)
            if m:
                matched += 1
                if m["ms"] is None:      # a pre-T074 line: the socket closed but nothing was measured
                    c.pb_unmeasured += 1
                    continue
                c.playback_socket(m["sid"], int(m["gen"]), m["ms"])
    c.sources.append({"kind": "log", "lines": lines, "matched": matched})


def _rows_from_json(doc) -> list[dict]:
    if isinstance(doc, dict):
        doc = doc.get("rows", [])
    return [r for r in doc if isinstance(r, dict)] if isinstance(doc, list) else []


def add_audit_rows(c: Collector, rows: list[dict], kind: str) -> None:
    used = 0
    for r in rows:
        d = r.get("details")
        if d is None and isinstance(r.get("details_json"), str):
            try:
                d = json.loads(r["details_json"])
            except ValueError:
                d = None
        if not isinstance(d, dict) or not d.get("session"):
            continue
        sid = str(d["session"])
        if r.get("action") == "video.live.stop":
            if "transport" not in d:     # a row from before 2.40.0 (VIDEO-TRANSPORT-2400): nothing was measured, so it is not "no media"
                c.live_unmeasured += 1
                continue
            used += 1
            c.live_session(sid, d.get("transport"), d.get("ttff_ms"), d.get("answer_ms"), d.get("upstream_error"), r.get("resource_type"))
        elif r.get("action") == "video.playback.stop":
            if "first_media_ms" not in d:  # a row from before T074 (the key is always written since, null = no media)
                c.pb_unmeasured += 1
                continue
            used += 1
            c.playback_start(sid, d.get("first_media_ms"))
            c.playback_seek_audit(sid, d.get("seek_media_ms"))
    c.sources.append({"kind": kind, "rows": len(rows), "used": used})


def read_audit_json(c: Collector, path: Path) -> None:
    add_audit_rows(c, _rows_from_json(json.loads(Path(path).read_text(encoding="utf-8"))), "audit-json")


def read_db(c: Collector, path: Path, since_days: int, now: dt.datetime | None = None) -> None:
    now = now or dt.datetime.now(dt.timezone.utc)
    cutoff = (now - dt.timedelta(days=since_days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    uri = Path(path).resolve().as_uri() + "?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    try:
        conn.row_factory = sqlite3.Row
        rows = [dict(r) for r in conn.execute(
            "SELECT at, action, resource_type, details_json FROM audit_log WHERE action IN ('video.live.stop', 'video.playback.stop') AND at >= ?",
            (cutoff,))]
    finally:
        conn.close()
    add_audit_rows(c, rows, "db")
    c.sources[-1]["since"] = cutoff


# ---------------------------------------------------------------- thresholds and verdict
def load_thresholds(path: Path | None) -> dict:
    p = Path(path) if path else DEFAULT_THRESHOLDS
    doc = json.loads(p.read_text(encoding="utf-8"))
    if not isinstance(doc.get("limits", {}), dict):
        raise ValueError("thresholds: `limits` must be an object")
    for name, lim in doc.get("limits", {}).items():
        if name not in METRICS + RATIOS:
            raise ValueError(f"thresholds: unknown metric {name!r} (known: {', '.join(METRICS + RATIOS)})")
        allowed = ("max",) if name in RATIOS else STATS
        for k, v in lim.items():
            if k not in allowed or not isinstance(v, (int, float)) or isinstance(v, bool) or v < 0:
                raise ValueError(f"thresholds: {name}.{k} must be one of {allowed} with a non-negative number")
    return doc


def evaluate(metrics: dict, ratios: dict, th: dict) -> tuple[list[dict], str]:
    mins = int(th.get("min_samples", 5))
    checks = []
    for name, lim in th.get("limits", {}).items():
        for stat, limit in lim.items():
            if name in RATIOS:
                r = ratios[name]
                n, value = r["total"], r["ratio"]
            else:
                n, value = metrics[name]["n"], metrics[name][stat]
            if n < mins or value is None:
                state = "insufficient"
            else:
                state = "breach" if value > limit else "pass"
            checks.append({"metric": name, "stat": stat, "limit": limit, "value": value, "n": n, "state": state})
    states = {c["state"] for c in checks}
    verdict = "breach" if "breach" in states else ("pass" if "pass" in states else "not_evaluated")
    return checks, verdict


def build_report(c: Collector, th: dict, now: dt.datetime | None = None) -> dict:
    now = now or dt.datetime.now(dt.timezone.utc)
    samples = c.samples()
    metrics = {m: stats(v) for m, v in samples.items()}
    ratios = c.ratios()
    checks, verdict = evaluate(metrics, ratios, th)
    return {"generated": now.strftime("%Y-%m-%dT%H:%M:%SZ"), "sources": c.sources, "metrics": metrics, "ratios": ratios,
            "live_sessions_by_transport": c.by_transport(), "live_sessions_by_surface": c.by_surface(), "upstream_errors": c.errors(),
            "playback_unmeasured": c.pb_unmeasured, "live_unmeasured": c.live_unmeasured, "min_samples": int(th.get("min_samples", 5)),
            "thresholds_status": th.get("status", ""), "checks": checks, "verdict": verdict,
            "privacy": "aggregate numbers and error classes only; no session, camera, user, stream, URL, address or error text"}


def to_markdown(rep: dict, heading: str = "##") -> str:
    v = {"pass": "PASS", "breach": "BREACH", "not_evaluated": "NOT_EVALUATED (no or too few samples - not a pass)"}[rep["verdict"]]
    out = [f"{heading} Time to camera / time to recording (T074): {v}", ""]
    src = "; ".join(", ".join(f"{k} {s[k]}" for k in s) for s in rep["sources"]) or "no source"
    out += [f"- sources: {src}", f"- thresholds: {rep.get('thresholds_status') or '-'}; min samples {rep['min_samples']}", "",
            "| metric | n | p50 ms | p90 ms | p95 ms | max ms |", "|---|---|---|---|---|---|"]
    dash = lambda x: "-" if x is None else x   # noqa: E731
    for m, s in rep["metrics"].items():
        out.append(f"| {m} | {s['n']} | {dash(s['p50'])} | {dash(s['p90'])} | {dash(s['p95'])} | {dash(s['max'])} |")
    out += ["", "| ratio | no media | total | ratio |", "|---|---|---|---|"]
    for m, r in rep["ratios"].items():
        out.append(f"| {m} | {r['no_media']} | {r['total']} | {dash(r['ratio'])} |")
    out += ["", f"- live sessions by transport: {rep['live_sessions_by_transport'] or '-'}; by surface: {rep['live_sessions_by_surface'] or '-'}",
            f"- go2rtc error classes: {rep['upstream_errors'] or '-'}; rows / lines from older versions without a measurement (left out): "
            f"playback {rep['playback_unmeasured']}, live {rep['live_unmeasured']}", "", "| check | limit | value | n | state |", "|---|---|---|---|---|"]
    for ch in rep["checks"]:
        out.append(f"| {ch['metric']} {ch['stat']} | {ch['limit']} | {dash(ch['value'])} | {ch['n']} | {ch['state'].upper()} |")
    if not rep["checks"]:
        out.append("| (no thresholds) | - | - | - | - |")
    return "\n".join(out) + "\n"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("cmd", choices=["report"])
    ap.add_argument("--log", action="append", default=[])
    ap.add_argument("--audit-json", action="append", default=[])
    ap.add_argument("--db", action="append", default=[])
    ap.add_argument("--since-days", type=int, default=7)
    ap.add_argument("--thresholds")
    ap.add_argument("--json")
    ap.add_argument("--md")
    ap.add_argument("--enforce", action="store_true", help="exit 1 on a breached limit, 3 when nothing could be evaluated")
    ns = ap.parse_args(argv)
    c = Collector()
    try:
        th = load_thresholds(Path(ns.thresholds) if ns.thresholds else None)
        for p in ns.log:
            read_log(c, Path(p))
        for p in ns.audit_json:
            read_audit_json(c, Path(p))
        for p in ns.db:
            read_db(c, Path(p), ns.since_days)
    except (OSError, ValueError, sqlite3.Error) as e:
        print(f"video_timing: {type(e).__name__}: {e}")
        return 2
    rep = build_report(c, th)
    md = to_markdown(rep)
    if ns.json:
        Path(ns.json).write_text(json.dumps(rep, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    if ns.md:
        Path(ns.md).write_text(md, encoding="utf-8")
    print(md)
    if not ns.enforce:
        return 0
    return {"breach": 1, "not_evaluated": 3}.get(rep["verdict"], 0)


if __name__ == "__main__":
    sys.exit(main())
