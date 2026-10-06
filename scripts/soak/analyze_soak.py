#!/usr/bin/env python3
"""Analyze a soak CSV from soak_sampler.py and write a Hebrew markdown summary with the T068 acceptance checklist,
a trend / slope table and, when matplotlib is installed, a PNG chart. Python 3.12, standard library only.

Usage: analyze_soak.py soak.csv [more.csv ...] [--out summary.md] [--png chart.png] [--tasks management/tasks.json]
Nothing here touches a network or a device; the CSV holds no host, address or secret.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[2]
GAP_FACTOR = 2.5
TARGET_HOURS = 24.0
MAX_GAP_FRACTION = 0.05
# leak thresholds (units per hour over the longest restart-free segment); a slope above them is flagged
LEAK_LIMITS = {"addon_mem_mib": 1.0, "threads": 0.5, "open_fds": 1.0, "db_bytes": None, "wal_bytes": None}
TREND_METRICS = [
    ("addon_mem_mib", "זיכרון add-on (MiB)"), ("addon_cpu_pct", "CPU add-on (%)"), ("threads", "threads"),
    ("open_fds", "file descriptors"), ("db_bytes", "גודל DB (בתים)"), ("wal_bytes", "גודל WAL (בתים)"),
    ("data_disk_free_mb", "דיסק פנוי (MB)"), ("core_mem_pct", "זיכרון ליבת HA (%)"), ("core_cpu_pct", "CPU ליבת HA (%)"),
    ("lat_health_ms", "latency של /health (ms)"),
]
LAT_COLS = [("lat_healthz_ms", "http_healthz", "/healthz"), ("lat_health_ms", "http_health", "/health"),
            ("lat_summary_ms", "http_summary", "/health/summary")]
FALLBACK_ACCEPTANCE = [
    "למדוד catalogue scale בנפרד ממספר streams/transcodes ולפרסם CPU/RAM/latency/leaks בתצורת ייחוס מתועדת.",
    "להריץ soak, HA/go2rtc/NVR restarts, export queue ו־disk full; backpressure נבדק וההקלטה המקורית נשארת תקינה.",
]
PASS, FAIL, PARTIAL, NOT_MEASURED = "עבר", "נכשל", "חלקי", "לא נמדד"


@dataclass
class Data:
    samples: list[dict[str, Any]]
    gaps: list[dict[str, Any]]
    t0: float
    t1: float


def parse_ts(s: str) -> float:
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp()


TEXT_COLS = {"at_utc", "event", "state", "version", "restart_reason", "error"}


def _val(s: str, col: str = "") -> Any:
    if s == "":
        return None
    if col in TEXT_COLS:
        return s
    try:
        return float(s)
    except ValueError:
        return s


def load(paths: list[Path]) -> Data:
    rows: list[dict[str, Any]] = []
    for p in paths:
        with p.open(newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                d = {k: _val(v, k) for k, v in r.items() if k is not None}
                d["ts"] = parse_ts(r["at_utc"])
                rows.append(d)
    rows.sort(key=lambda r: (r["ts"], r.get("seq") or 0))
    samples = [r for r in rows if r.get("event") == "sample"]
    gaps = [r for r in rows if r.get("event") == "gap"]
    if not samples:
        raise SystemExit("no sample rows in the input")
    return Data(samples, gaps, samples[0]["ts"], samples[-1]["ts"])


def estimate_interval(samples: list[dict[str, Any]]) -> float:
    d = sorted(b["ts"] - a["ts"] for a, b in zip(samples, samples[1:]) if b["ts"] > a["ts"])
    return d[len(d) // 2] if d else 60.0


def find_gaps(data: Data, interval: float) -> list[tuple[float, float]]:
    """(start, length_s) of every hole: the sampler's explicit gap rows plus any unmarked wide spacing."""
    out: dict[int, tuple[float, float]] = {}
    for a, b in zip(data.samples, data.samples[1:]):
        if b["ts"] - a["ts"] > GAP_FACTOR * interval:
            out[int(a["ts"])] = (a["ts"], b["ts"] - a["ts"])
    return sorted(out.values())


def segments(data: Data) -> list[list[dict[str, Any]]]:
    """Restart-free runs: a new segment starts at every sample flagged restart (a trend must not cross a restart)."""
    segs: list[list[dict[str, Any]]] = [[]]
    for r in data.samples:
        if r.get("restart") == 1.0 and segs[-1]:
            segs.append([])
        segs[-1].append(r)
    return segs


def percentile(vals: list[float], p: float) -> float:
    s = sorted(vals)
    k = max(0, min(len(s) - 1, math.ceil(p / 100 * len(s)) - 1))
    return s[k]


def slope_per_hour(rows: list[dict[str, Any]], col: str) -> tuple[float | None, int]:
    pts = [((r["ts"] - rows[0]["ts"]) / 3600.0, r[col]) for r in rows if isinstance(r.get(col), float)]
    n = len(pts)
    if n < 3:
        return None, n
    mx = sum(x for x, _ in pts) / n
    my = sum(y for _, y in pts) / n
    den = sum((x - mx) ** 2 for x, _ in pts)
    if den == 0:
        return None, n
    return sum((x - mx) * (y - my) for x, y in pts) / den, n


def series(data: Data, col: str) -> list[float]:
    return [r[col] for r in data.samples if isinstance(r.get(col), float)]


def fmt(v: float | None, nd: int = 2) -> str:
    return "—" if v is None else (f"{v:.{nd}f}" if abs(v) < 1e6 else f"{v:.3e}")


def load_acceptance(tasks_path: Path) -> list[str]:
    try:
        for t in json.loads(tasks_path.read_text(encoding="utf-8")):
            if t.get("id") == "T068":
                return list(t.get("acceptance") or FALLBACK_ACCEPTANCE)
    except (OSError, ValueError, TypeError, AttributeError):
        pass
    return FALLBACK_ACCEPTANCE


def analyze(data: Data) -> dict[str, Any]:
    interval = estimate_interval(data.samples)
    hours = (data.t1 - data.t0) / 3600.0
    gaps = find_gaps(data, interval)
    gap_s = sum(g[1] for g in gaps)
    span_s = max(data.t1 - data.t0, 1.0)
    segs = segments(data)
    longest = max(segs, key=len)
    res: dict[str, Any] = {
        "interval": interval, "hours": hours, "samples": len(data.samples), "gaps": gaps, "gap_fraction": gap_s / span_s,
        "restarts": [(r["at_utc"], r.get("restart_reason") or "") for r in data.samples if r.get("restart") == 1.0],
        "segments": [(len(s), (s[-1]["ts"] - s[0]["ts"]) / 3600.0, s[0].get("version")) for s in segs],
        "longest_hours": (longest[-1]["ts"] - longest[0]["ts"]) / 3600.0,
        "versions": sorted({str(r["version"]) for r in data.samples if r.get("version")}),
    }
    trends = {}
    for col, label in TREND_METRICS:
        vals = series(data, col)
        if not vals:
            trends[col] = {"label": label, "n": 0}
            continue
        sl, n = slope_per_hour(longest, col)
        trends[col] = {"label": label, "n": len(vals), "first": vals[0], "last": vals[-1], "min": min(vals), "max": max(vals),
                       "mean": sum(vals) / len(vals), "p95": percentile(vals, 95), "slope": sl, "slope_n": n}
    res["trends"] = trends
    lat = {}
    for col, http, name in LAT_COLS:
        vals = series(data, col)
        bad = sum(1 for r in data.samples if isinstance(r.get(http), float) and r[http] != 200.0)
        tot = sum(1 for r in data.samples if isinstance(r.get(http), float))
        lat[name] = {"n": len(vals), "p50": percentile(vals, 50) if vals else None, "p95": percentile(vals, 95) if vals else None,
                     "p99": percentile(vals, 99) if vals else None, "max": max(vals) if vals else None, "non200": bad, "total": tot}
    res["latency"] = lat
    err_rows = [r for r in data.samples if r.get("error")]
    res["error_samples"] = len(err_rows)
    res["error_kinds"] = sorted({e.split(":")[0] for r in err_rows for e in str(r["error"]).split(";") if e})

    def last_minus_first(col: str) -> float | None:
        v = series(data, col)
        return None if not v else v[-1] - v[0]  # cumulative counters: growth over the run (a restart resets them; shown as is)

    res["counters"] = {c: (max(series(data, c)) if series(data, c) else None) for c in
                       ("lock_busy_errors", "lock_gate_timeouts", "lock_waits_over_1s", "ingest_dropped", "ingest_failed",
                        "export_waiting", "export_paused_disk_full", "log_errors", "log_tracebacks")}
    res["max_ingest_depth"] = max(series(data, "ingest_depth"), default=None)
    res["min_disk_free_mb"] = min(series(data, "data_disk_free_mb"), default=None)
    reach = {}
    for col, name in (("nvr_reachable", "NVR"), ("go2rtc_reachable", "go2rtc"), ("ha_connected", "Home Assistant"),
                      ("ingest_connected", "alert stream")):
        vals = series(data, col)
        down = sum(1 for v in vals if v == 0.0)
        trans = sum(1 for a, b in zip(vals, vals[1:]) if a == 1.0 and b == 0.0)
        rec = sum(1 for a, b in zip(vals, vals[1:]) if a == 0.0 and b == 1.0)
        reach[name] = {"n": len(vals), "down": down, "drops": trans, "recoveries": rec}
    res["reach"] = reach
    cams = series(data, "cameras")
    res["cameras"] = (min(cams), max(cams)) if cams else None
    res["lat_last_minus_first"] = last_minus_first("lat_health_ms")
    return res


def checklist(res: dict[str, Any], acceptance: list[str]) -> list[tuple[str, str, str]]:
    """(item, status, evidence). Active scenarios (restarts of HA/go2rtc/NVR, a full disk, an export queue under load) are
    not something a passive sampler performs: they are reported NOT_MEASURED unless the data itself shows them."""
    t = res["trends"]
    out: list[tuple[str, str, str]] = []
    h, gf = res["hours"], res["gap_fraction"]
    if h >= TARGET_HOURS and gf <= MAX_GAP_FRACTION:
        st = PASS
    elif h >= TARGET_HOURS:
        st = PARTIAL
    else:
        st = FAIL
    out.append((f"soak של {TARGET_HOURS:.0f} שעות", st, f"{h:.1f} שעות, {res['samples']} דגימות, פערים {gf * 100:.1f}% מהטווח ({len(res['gaps'])} פערים)"))
    present = [c for c in ("addon_cpu_pct", "addon_mem_mib", "lat_health_ms", "threads", "open_fds", "db_bytes", "wal_bytes") if t[c]["n"]]
    missing = [c for c in ("threads", "open_fds", "db_bytes", "wal_bytes") if not t[c]["n"]]
    core_ok = all(t[c]["n"] for c in ("addon_cpu_pct", "addon_mem_mib", "lat_health_ms"))
    out.append(("CPU / RAM / latency נמדדו", PASS if core_ok else (PARTIAL if present else NOT_MEASURED),
                "CPU, RAM ו-latency: " + ("נמדדו" if core_ok else "חסרים")))
    if missing:
        out.append(("leaks ברמת threads / fds / DB / WAL", NOT_MEASURED if len(missing) == 4 else PARTIAL,
                    "לא נחשפים כרגע ב-endpoint: " + ", ".join(missing) + " (ראו README, הצעת תוספת אבחון)"))
    flagged = []
    for col, lim in LEAK_LIMITS.items():
        d = t[col]
        if d["n"] and d.get("slope") is not None and lim is not None and d["slope"] > lim:
            flagged.append(f"{d['label']}: {d['slope']:+.2f}/שעה")
    mem = t["addon_mem_mib"]
    if mem["n"] and mem.get("slope") is not None and res["longest_hours"] >= 4:
        out.append(("אין דליפת זיכרון (שיפוע בקטע הרציף הארוך ביותר)", FAIL if flagged else PASS,
                    ("; ".join(flagged) if flagged else f"שיפוע {mem['slope']:+.3f} MiB/שעה על {res['longest_hours']:.1f} שעות, סף {LEAK_LIMITS['addon_mem_mib']}")))
    else:
        out.append(("אין דליפת זיכרון (שיפוע בקטע הרציף הארוך ביותר)", NOT_MEASURED, f"הקטע הרציף הארוך ביותר {res['longest_hours']:.1f} שעות (דרושות 4 לפחות)"))
    cams = res["cameras"]
    out.append(("catalogue scale נמדד בנפרד מ-streams/transcodes, תצורת ייחוס מתועדת", PARTIAL if cams else NOT_MEASURED,
                (f"מצלמות בקטלוג {cams[0]:.0f}-{cams[1]:.0f}; " if cams else "") + "מספר streams/transcodes חיים אינו נדגם; יש לתעד את התצורה ולהריץ תרחיש scale נפרד"))
    r = res["reach"]
    ev = "; ".join(f"{k}: {v['drops']} ניתוקים, {v['recoveries']} התאוששויות" for k, v in r.items() if v["n"])
    seen = any(v["drops"] and v["recoveries"] for v in r.values())
    out.append(("הפעלות מחדש של HA / go2rtc / NVR והתאוששות", PARTIAL if (seen or res["restarts"]) else NOT_MEASURED,
                f"הדגימה פסיבית ואינה מפעילה מחדש דבר. {ev or 'אין נתוני reachability'}; הפעלות add-on שזוהו: {len(res['restarts'])}"))
    c = res["counters"]
    bp_seen = any(c[k] is not None for k in ("ingest_dropped", "export_waiting", "lock_busy_errors"))
    out.append(("backpressure ותור ייצוא (מוני drop, תור, busy)", PARTIAL if bp_seen else NOT_MEASURED,
                f"ingest dropped={fmt(c['ingest_dropped'], 0)}, failed={fmt(c['ingest_failed'], 0)}, עומק מרבי={fmt(res['max_ingest_depth'], 0)}, "
                f"busy={fmt(c['lock_busy_errors'], 0)}, gate timeouts={fmt(c['lock_gate_timeouts'], 0)}; תרחיש עומס מכוון לא הורץ בדגימה פסיבית"))
    out.append(("דיסק מלא", NOT_MEASURED, f"דיסק פנוי מינימלי שנצפה: {fmt(res['min_disk_free_mb'], 0)} MB; תרחיש דיסק מלא דורש הרצה יזומה באישור"))
    out.append(("ההקלטה המקורית (NVR) נשארת תקינה", NOT_MEASURED, "הכלי אינו נוגע ב-NVR; נדרשת בדיקה נפרדת של רצף ההקלטה"))
    out.append(("אין Traceback / שגיאות בלוג", PASS if (c["log_errors"] in (None, 0.0) and c["log_tracebacks"] in (None, 0.0) and c["log_errors"] is not None) else
                (NOT_MEASURED if c["log_errors"] is None else FAIL), f"שגיאות מרביות בחלון הלוג: {fmt(c['log_errors'], 0)}, Tracebacks: {fmt(c['log_tracebacks'], 0)}"))
    return out


def render(res: dict[str, Any], acceptance: list[str], source_names: list[str], png: str | None, png_note: str) -> str:
    L: list[str] = []
    L += ["# סיכום soak (T068)", "",
          "> נוצר אוטומטית מ-`analyze_soak.py`. קריאה בלבד: הקובץ אינו כולל כתובות, מזהים או סודות.", f"> קלט: {', '.join(source_names)}", ""]
    L += ["## כיסוי", "",
          f"- משך: **{res['hours']:.2f} שעות** מתוך יעד {TARGET_HOURS:.0f}; {res['samples']} דגימות, מרווח אופייני {res['interval']:.0f} שניות.",
          f"- פערים: {len(res['gaps'])} (סה\"כ {res['gap_fraction'] * 100:.1f}% מהטווח)."]
    for start, ln in res["gaps"][:20]:
        L.append(f"  - {datetime.fromtimestamp(start, timezone.utc).strftime('%Y-%m-%d %H:%M:%SZ')}: {ln / 60:.1f} דקות")
    L.append(f"- גרסאות שנצפו: {', '.join(res['versions']) or '—'}; הפעלות מחדש שזוהו: {len(res['restarts'])}.")
    for at, why in res["restarts"][:20]:
        L.append(f"  - {at}: {why}")
    L.append(f"- הקטע הרציף הארוך ביותר (בלי הפעלה מחדש): {res['longest_hours']:.2f} שעות.")
    L += ["", "## צ'קליסט קבלה T068", "", "שורות הקבלה במשימה:"]
    L += [f"> {a}" for a in acceptance]
    L += ["", "| פריט | מצב | ראיה |", "|---|---|---|"]
    for item, st, ev in checklist(res, acceptance):
        L.append(f"| {item} | **{st}** | {ev.replace('|', '/')} |")
    L += ["", "## מגמות ושיפוע", "",
          f"השיפוע מחושב ברגרסיה לינארית על הקטע הרציף הארוך ביותר ({res['longest_hours']:.1f} שעות), ליחידה לשעה.", "",
          "| מדד | דגימות | התחלה | סוף | מינימום | מקסימום | ממוצע | p95 | שיפוע/שעה |", "|---|---|---|---|---|---|---|---|---|"]
    for col, d in res["trends"].items():
        if not d["n"]:
            L.append(f"| {d['label']} | 0 | לא נמדד | | | | | | |")
        else:
            L.append(f"| {d['label']} | {d['n']} | {fmt(d['first'])} | {fmt(d['last'])} | {fmt(d['min'])} | {fmt(d['max'])} | {fmt(d['mean'])} | {fmt(d['p95'])} | {fmt(d.get('slope'), 3)} |")
    L += ["", "## latency לפי endpoint", "", "בקשה אחת לכל endpoint בכל דגימה; האחוזונים מחושבים על פני כל הדגימות.", "",
          "| endpoint | דגימות | p50 ms | p95 ms | p99 ms | מקסימום | לא-200 |", "|---|---|---|---|---|---|---|"]
    for name, d in res["latency"].items():
        L.append(f"| {name} | {d['n']} | {fmt(d['p50'], 1)} | {fmt(d['p95'], 1)} | {fmt(d['p99'], 1)} | {fmt(d['max'], 1)} | {d['non200']}/{d['total']} |")
    L += ["", "## מוני שגיאות ו-backpressure (ערך מרבי שנצפה)", "", "| מונה | ערך |", "|---|---|"]
    for k, v in res["counters"].items():
        L.append(f"| {k} | {fmt(v, 0)} |")
    L += ["", f"דגימות עם שגיאת דגימה (רשת/HTTP): {res['error_samples']}" + (f" ({', '.join(res['error_kinds'])})" if res["error_kinds"] else "") + ".", "",
          "## נגישות", "", "| רכיב | דגימות | דגימות ירודות | ניתוקים | התאוששויות |", "|---|---|---|---|---|"]
    for name, d in res["reach"].items():
        L.append(f"| {name} | {d['n']} | {d['down']} | {d['drops']} | {d['recoveries']} |" if d["n"] else f"| {name} | 0 | לא נמדד | | |")
    L += ["", "## תרשים", "", f"![soak]({png})" if png else png_note, ""]
    return "\n".join(L)


def draw_png(data: Data, path: Path) -> str | None:
    """Returns None on success or the reason it was skipped."""
    try:
        import matplotlib  # type: ignore

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt  # type: ignore
    except ImportError:
        return "התרשים (PNG) לא נוצר: matplotlib אינו מותקן."
    panels = [("addon_mem_mib", "add-on RSS (MiB)"), ("addon_cpu_pct", "add-on CPU (%)"), ("lat_health_ms", "/health latency (ms)"),
              ("threads", "threads"), ("open_fds", "open fds"), ("db_bytes", "db bytes")]
    panels = [p for p in panels if series(data, p[0])]
    if not panels:
        return "התרשים (PNG) לא נוצר: אין נתונים מספריים."
    fig, axes = plt.subplots(len(panels), 1, figsize=(10, 2.2 * len(panels)), sharex=True, squeeze=False)
    for ax, (col, label) in zip(axes[:, 0], panels):
        pts = [((r["ts"] - data.t0) / 3600.0, r[col]) for r in data.samples if isinstance(r.get(col), float)]
        ax.plot([p[0] for p in pts], [p[1] for p in pts], lw=0.8)
        for r in data.samples:
            if r.get("restart") == 1.0:
                ax.axvline((r["ts"] - data.t0) / 3600.0, color="red", lw=0.6, ls="--")
        ax.set_ylabel(label, fontsize=8)
    axes[-1, 0].set_xlabel("hours since start (red = restart)")
    fig.tight_layout()
    fig.savefig(path, dpi=110)
    plt.close(fig)
    return None


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Hebrew markdown summary of a soak CSV (T068).")
    ap.add_argument("csv", nargs="+", type=Path)
    ap.add_argument("--out", type=Path, default=None, help="markdown output (default: next to the first CSV)")
    ap.add_argument("--png", type=Path, default=None, help="PNG output (default: next to the markdown); skipped without matplotlib")
    ap.add_argument("--tasks", type=Path, default=REPO / "management" / "tasks.json")
    args = ap.parse_args(argv)
    if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8")
    data = load(args.csv)
    res = analyze(data)
    out = args.out or args.csv[0].with_suffix(".summary.md")
    png_path = args.png or out.with_suffix(".png")
    why = draw_png(data, png_path)
    text = render(res, load_acceptance(args.tasks), [p.name for p in args.csv], png_path.name if why is None else None, why or "")
    out.write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {out.name}" + (f" and {png_path.name}" if why is None else f" (no PNG: {why})"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
