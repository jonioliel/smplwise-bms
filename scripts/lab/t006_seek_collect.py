#!/usr/bin/env python3
"""T006 lab measurement collector: does a known request time lead to the right recording and frame, how far is the rendered
media from the requested instant (keyframe offset), how long does a seek take to media, and is the session cleaned up
(docs/changes/T070-T006-2406.md, LAB-T006-01; plan: scripts/lab/t006_seek_plan.json).

READ-ONLY and offline: it reads files the lead saved after the owner did the steps; it never talks to the add-on, go2rtc, the
NVR or Home Assistant, and writes only the report files it is asked for. Stdlib only (Python 3.9+ for zoneinfo).

Inputs:
  --plan FILE           the seek plan (default scripts/lab/t006_seek_plan.json)
  --date YYYY-MM-DD     the recording day the owner played (local, the plan's zone)
  --audit-json FILE     GET /api/v1/audit?prefix=video.playback.&limit=500 saved as JSON (repeatable): the add-on's own rows -
                        video.playback.start (requested_at, start_at), .seek (generation, start_at), .stop (first_media_ms,
                        seek_media_ms - the T074 fields, 2.40.5 and later)
  --log FILE            the add-on log text (optional, repeatable): `playback session <id> g<N> socket closed: <reason> (...)`
  --osd FILE            CSV typed by the lead from the owner's screenshots: point,osd_local,arx_local[,note] (HH:MM:SS each;
                        osd = the camera's burned-in clock in the frame, arx = the player's time readout on the same screenshot)
  --osd-drift-s N       optional: the camera's OSD minus the NVR clock on LIVE view (seconds), subtracted from every offset
  --gop-s N             the main stream's I-frame interval in seconds (read-only from the NVR stream settings; default the plan's)
  --streams-before FILE / --streams-after FILE   go2rtc GET /api/streams saved before the session / after it was closed (optional)
  --session ID          pick this playback session (default: the session whose start matches P0, most seeks first)
  --json OUT / --md OUT the report

Output privacy: numbers, plan point ids and local times of the recording day only - no session, camera, user, stream name,
address or screenshot. Exit: 0 = PASS, 1 = FAIL, 3 = INCOMPLETE / NOT_EVALUATED (never a pass), 2 = input error.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import math
import re
import sys
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
DEFAULT_PLAN = HERE / "t006_seek_plan.json"
PB_PREFIX = "smplwise_pb_"
SOCKET_RE = re.compile(r"playback session (?P<sid>[0-9a-zA-Z_-]+) g(?P<gen>\d+) socket closed: (?P<reason>\S+) "
                       r"\((?P<bytes>\d+) bytes(?:, first media (?P<ms>\d+|-) ms)?\)")
HMS_RE = re.compile(r"^\s*(\d{1,2}):(\d{2}):(\d{2})\s*$")


class InputError(Exception):
    pass


# ------------------------------------------------------------------ helpers
def parse_offset(text: str) -> dt.timedelta:
    m = re.match(r"^([+-])(\d{2}):(\d{2}):(\d{2})$", text.strip())
    if not m:
        raise InputError(f"plan offset {text!r} is not +HH:MM:SS")
    sign = -1 if m.group(1) == "-" else 1
    return sign * dt.timedelta(hours=int(m.group(2)), minutes=int(m.group(3)), seconds=int(m.group(4)))


def parse_utc(text: Any) -> dt.datetime | None:
    if not isinstance(text, str) or not text:
        return None
    try:
        v = dt.datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    return v.astimezone(dt.timezone.utc) if v.tzinfo else None


def hms_seconds(text: str) -> int:
    m = HMS_RE.match(text or "")
    if not m:
        raise InputError(f"time {text!r} is not HH:MM:SS")
    h, mi, s = (int(x) for x in m.groups())
    if h > 23 or mi > 59 or s > 59:
        raise InputError(f"time {text!r} out of range")
    return h * 3600 + mi * 60 + s


def percentile(values: list[int], p: float) -> int | None:
    if not values:
        return None
    s = sorted(values)
    return s[min(len(s), max(1, math.ceil(p / 100 * len(s)))) - 1]


def expected_points(plan: dict[str, Any], day: dt.date) -> list[dict[str, Any]]:
    tz = ZoneInfo(plan["tz"])
    base = dt.datetime.combine(day, dt.time.fromisoformat(plan["base_local"]), tzinfo=tz)
    out = []
    for p in plan["points"]:
        local = base + parse_offset(p["offset"])
        if local.date() != day:
            raise InputError(f"plan point {p['id']} leaves the recording day")
        utc = local.astimezone(dt.timezone.utc)
        if utc.astimezone(tz).replace(tzinfo=None) != local.replace(tzinfo=None):  # a DST gap or fold on that day
            raise InputError(f"plan point {p['id']} falls into a DST change on {day}; pick another day")
        out.append({"id": p["id"], "kind": p.get("kind"), "local": local.strftime("%H:%M:%S"), "utc": utc})
    return out


# ------------------------------------------------------------------ sources
def load_audit(paths: list[str]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for p in paths:
        doc = json.loads(Path(p).read_text(encoding="utf-8"))
        items = doc.get("rows", []) if isinstance(doc, dict) else doc
        for r in items if isinstance(items, list) else []:
            if not isinstance(r, dict):
                continue
            d = r.get("details")
            if d is None and isinstance(r.get("details_json"), str):
                try:
                    d = json.loads(r["details_json"])
                except ValueError:
                    d = None
            if isinstance(d, dict) and str(r.get("action", "")).startswith("video.playback.") and d.get("session"):
                rows.append({"action": r["action"], "at": r.get("at"), "details": d})
    return rows


def sessions_from_audit(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for r in rows:
        d = r["details"]
        s = out.setdefault(str(d["session"]), {"start": None, "seeks": {}, "stop": None})
        if r["action"] == "video.playback.start":
            s["start"] = d
        elif r["action"] == "video.playback.seek":
            try:
                s["seeks"][int(d.get("generation"))] = d
            except (TypeError, ValueError):
                continue
        elif r["action"] == "video.playback.stop" and s["stop"] is None:
            s["stop"] = d
    return out


def read_logs(paths: list[str], sid: str) -> dict[str, int]:
    reasons: dict[str, int] = {}
    for p in paths:
        with open(p, encoding="utf-8", errors="replace") as f:
            for line in f:
                m = SOCKET_RE.search(line)
                if m and m["sid"] == sid:
                    reasons[m["reason"]] = reasons.get(m["reason"], 0) + 1
    return dict(sorted(reasons.items()))


def read_osd(path: str) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            pid = (row.get("point") or "").strip()
            if not pid:
                continue
            out[pid] = {"osd": hms_seconds(row.get("osd_local", "")), "arx": hms_seconds(row.get("arx_local", ""))}
    return out


def stream_names(path: str | None) -> set[str] | None:
    if not path:
        return None
    doc = json.loads(Path(path).read_text(encoding="utf-8"))
    if isinstance(doc, dict):
        return {str(k) for k in doc.keys()}
    if isinstance(doc, list):
        return {str(x.get("name") if isinstance(x, dict) else x) for x in doc}
    raise InputError(f"{path}: not a go2rtc stream list")


# ------------------------------------------------------------------ evaluation
def pick_session(sessions: dict[str, dict[str, Any]], p0_utc: dt.datetime, tol_s: float, wanted: str | None) -> str | None:
    if wanted:
        return wanted if wanted in sessions else None
    def p0_match(s: dict[str, Any]) -> bool:
        st = parse_utc((s.get("start") or {}).get("start_at"))
        return st is not None and abs((st - p0_utc).total_seconds()) <= tol_s
    cands = sorted(sessions.items(), key=lambda kv: (not p0_match(kv[1]), -len(kv[1]["seeks"])))
    return cands[0][0] if cands and (p0_match(cands[0][1]) or cands[0][1]["seeks"]) else None


def classify(offset: float, gop_s: float, th: dict[str, Any]) -> str:
    if abs(offset) >= th["wrong_recording_s"]:
        hours = round(offset / 3600)
        return "tz_shift" if hours != 0 and abs(offset - hours * 3600) <= 60 else "wrong_recording"
    if -(gop_s + th["offset_early_extra_s"]) <= offset <= th["offset_late_tolerance_s"]:
        return "ok"
    return "out_of_tolerance"


def evaluate(plan: dict[str, Any], day: dt.date, audit_rows: list[dict[str, Any]], *, osd: dict[str, dict[str, Any]] | None = None,
             gop_s: float | None = None, drift_s: float | None = None, logs: list[str] | None = None, session: str | None = None,
             streams_before: set[str] | None = None, streams_after: set[str] | None = None) -> dict[str, Any]:
    th = plan["thresholds"]
    gop = float(gop_s if gop_s is not None else th["gop_s_default"])
    tol = float(th["request_match_tolerance_s"])
    points = expected_points(plan, day)
    sessions = sessions_from_audit(audit_rows)
    sid = pick_session(sessions, points[0]["utc"], tol, session)
    rep: dict[str, Any] = {"schema": "smplwise-t006-seek-report/1", "date": day.isoformat(), "tz": plan["tz"], "gop_s": gop,
                           "drift_s": drift_s, "thresholds": th, "sessions_seen": len(sessions)}
    if sid is None:
        rep.update({"points": [], "checks": {"request": "INCOMPLETE", "accuracy": "NOT_EVALUATED", "timing": "INCOMPLETE", "cleanup": "NOT_EVALUATED"},
                    "verdict_at011": "INCOMPLETE", "verdict_at012_cleanup": "NOT_EVALUATED", "problems": ["no playback session of the plan found in the audit rows"]})
        return rep
    s = sessions[sid]
    problems: list[str] = []

    # request: generation -> plan point
    gens: list[tuple[int, dt.datetime | None, dt.datetime | None]] = []
    if s["start"]:
        gens.append((0, parse_utc(s["start"].get("start_at")), parse_utc(s["start"].get("requested_at"))))
    for g in sorted(s["seeks"]):
        gens.append((g, parse_utc(s["seeks"][g].get("start_at")), None))
    rows: list[dict[str, Any]] = []
    used: set[int] = set()
    for p in points:
        hit = None
        for g, start_at, requested in gens:
            if g in used or start_at is None:
                continue
            if abs((start_at - p["utc"]).total_seconds()) <= tol:
                hit = (g, start_at, requested)
                break
        row: dict[str, Any] = {"point": p["id"], "kind": p["kind"], "local": p["local"], "generation": None, "request": "missing"}
        if hit:
            used.add(hit[0])
            row["generation"] = hit[0]
            moved = hit[2] is not None and abs((hit[2] - hit[1]).total_seconds()) > tol
            row["request"] = "moved" if moved else "ok"
        rows.append(row)
    extra = [g for g, _s, _r in gens if g not in used]
    if any(r["request"] == "missing" for r in rows):
        problems.append("plan points without a matching generation: " + ", ".join(r["point"] for r in rows if r["request"] == "missing"))
    if any(r["request"] == "moved" for r in rows):
        problems.append("a request moved to the next segment (no recording at the requested instant)")
    request_state = "FAIL" if any(r["request"] == "moved" for r in rows) else ("INCOMPLETE" if any(r["request"] == "missing" for r in rows) else "PASS")

    # timing (T074 fields of the stop row)
    stop = s["stop"] or {}
    start_ms = stop.get("first_media_ms") if isinstance(stop.get("first_media_ms"), int) else None
    seek_ms = [v for v in (stop.get("seek_media_ms") or []) if isinstance(v, int) and not isinstance(v, bool)]
    seek_gens = sorted(g for g in s["seeks"])
    if len(seek_ms) == len(seek_gens):  # one measurement per seek generation, in generation order
        by_gen = dict(zip(seek_gens, seek_ms))
        for r in rows:
            if r["generation"] in by_gen:
                r["first_media_ms"] = by_gen[r["generation"]]
    for r in rows:
        if r["generation"] == 0:
            r["first_media_ms"] = start_ms
    timing = {"start_first_media_ms": start_ms, "seek_n": len(seek_ms), "seek_p50_ms": percentile(seek_ms, 50),
              "seek_p90_ms": percentile(seek_ms, 90), "seek_max_ms": max(seek_ms) if seek_ms else None,
              "seek_generations": len(seek_gens), "mapped_per_generation": len(seek_ms) == len(seek_gens)}
    if not s["stop"] or "first_media_ms" not in stop:
        timing_state = "INCOMPLETE"
        problems.append("no video.playback.stop row with the T074 timing fields (close the player; 2.40.5 or later)")
    elif start_ms is None:
        timing_state = "FAIL"
        problems.append("the start never relayed media (first_media_ms null)")
    elif len(seek_ms) < int(th["min_measured_seeks"]):
        timing_state = "INCOMPLETE"
        problems.append(f"only {len(seek_ms)} measured seeks (need {th['min_measured_seeks']})")
    else:
        breaches = []
        if start_ms > th["start_first_media_max_ms"]:
            breaches.append(f"start {start_ms} ms > {th['start_first_media_max_ms']}")
        if timing["seek_p90_ms"] > th["seek_first_media_p90_ms"]:
            breaches.append(f"seek p90 {timing['seek_p90_ms']} ms > {th['seek_first_media_p90_ms']}")
        if timing["seek_max_ms"] > th["seek_first_media_max_ms"]:
            breaches.append(f"seek max {timing['seek_max_ms']} ms > {th['seek_first_media_max_ms']}")
        problems += breaches
        timing_state = "FAIL" if breaches else "PASS"

    # accuracy (OSD readings)
    if not osd:
        accuracy_state = "NOT_EVALUATED"
        problems.append("no OSD readings: accuracy (the right recording and frame) is not evaluated - never a pass")
    else:
        bad = False
        for r in rows:
            o = osd.get(r["point"])
            if o is None:
                r["accuracy"] = "no_reading"
                continue
            raw = o["osd"] - o["arx"]
            if raw > 43200:
                raw -= 86400
            elif raw < -43200:
                raw += 86400
            off = raw - (drift_s or 0)
            r["offset_raw_s"] = raw
            r["offset_s"] = off
            r["accuracy"] = classify(off, gop, th)
            bad = bad or r["accuracy"] != "ok"
        missing = [r["point"] for r in rows if r.get("accuracy") == "no_reading"]
        if bad:
            accuracy_state = "FAIL"
            problems.append("points outside the tolerance: " + ", ".join(f"{r['point']} {r['accuracy']} ({r.get('offset_s')} s)" for r in rows if r.get("accuracy") not in (None, "ok", "no_reading")))
        elif missing:
            accuracy_state = "INCOMPLETE"
            problems.append("points without an OSD reading: " + ", ".join(missing))
        else:
            accuracy_state = "PASS"
        offs = [r["offset_s"] for r in rows if "offset_s" in r]
        rep["offset_summary"] = {"n": len(offs), "min_s": min(offs) if offs else None, "max_s": max(offs) if offs else None,
                                 "median_s": sorted(offs)[len(offs) // 2] if offs else None}

    # cleanup (AT012 part)
    cleanup: dict[str, Any] = {}
    if streams_after is None:
        cleanup_state = "NOT_EVALUATED"
    else:
        left = sorted(n for n in streams_after if n.startswith(PB_PREFIX) and f"_{sid}_g" in n)
        cleanup["session_streams_left"] = len(left)
        cleanup_state = "FAIL" if left else "PASS"
        if left:
            problems.append(f"{len(left)} playback stream(s) of the session left in go2rtc after close")
        if streams_before is not None:
            fb = {n for n in streams_before if not n.startswith("smplwise_")}
            fa = {n for n in streams_after if not n.startswith("smplwise_")}
            cleanup["foreign_before"], cleanup["foreign_after"] = len(fb), len(fa)
            cleanup["foreign_added"], cleanup["foreign_removed"] = len(fa - fb), len(fb - fa)
            if fb - fa:
                cleanup_state = "FAIL"
                problems.append(f"{len(fb - fa)} non-smplwise stream(s) disappeared during the run (check who removed them)")
    if logs:
        cleanup["socket_close_reasons"] = read_logs(logs, sid)

    at011 = "FAIL" if "FAIL" in (request_state, accuracy_state, timing_state) else (
        "PASS" if (request_state, accuracy_state, timing_state) == ("PASS", "PASS", "PASS") else "INCOMPLETE")
    rep.update({"points": rows, "extra_generations": len(extra), "timing": timing, "cleanup": cleanup,
                "checks": {"request": request_state, "accuracy": accuracy_state, "timing": timing_state, "cleanup": cleanup_state},
                "verdict_at011": at011, "verdict_at012_cleanup": cleanup_state, "problems": problems,
                "privacy": "numbers, plan point ids and local times of the recording day; no session, camera, user, stream name or address"})
    return rep


def to_markdown(rep: dict[str, Any]) -> str:
    dash = lambda v: "-" if v is None else v  # noqa: E731
    L = [f"# T006 seek measurement - {rep['date']} ({rep['tz']})", "",
         f"AT011: **{rep['verdict_at011']}** · AT012 cleanup part: **{rep['verdict_at012_cleanup']}** · GOP {rep['gop_s']} s · "
         f"live OSD drift {dash(rep.get('drift_s'))} s", "", "| check | state |", "|---|---|"]
    L += [f"| {k} | {v} |" for k, v in rep["checks"].items()]
    L += ["", "| point | kind | requested (local) | generation | request | first media ms | offset s (raw) | accuracy |", "|---|---|---|---|---|---|---|---|"]
    for r in rep["points"]:
        L.append(f"| {r['point']} | {r['kind']} | {r['local']} | {dash(r['generation'])} | {r['request']} | {dash(r.get('first_media_ms'))} | "
                 f"{dash(r.get('offset_s'))} ({dash(r.get('offset_raw_s'))}) | {dash(r.get('accuracy'))} |")
    t = rep.get("timing") or {}
    if t:
        L += ["", f"Timing: start {dash(t.get('start_first_media_ms'))} ms; seeks n {t.get('seek_n')} of {t.get('seek_generations')} generations, "
                  f"p50 {dash(t.get('seek_p50_ms'))} / p90 {dash(t.get('seek_p90_ms'))} / max {dash(t.get('seek_max_ms'))} ms"]
    if rep.get("offset_summary"):
        o = rep["offset_summary"]
        L.append(f"Keyframe offset: n {o['n']}, min {o['min_s']} s, median {o['median_s']} s, max {o['max_s']} s")
    if rep.get("cleanup"):
        L.append(f"Cleanup: {json.dumps(rep['cleanup'])}")
    L += ["", "Problems:"] + ([f"- {p}" for p in rep["problems"]] or ["- none"]) + [""]
    return "\n".join(L)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--plan", default=str(DEFAULT_PLAN))
    ap.add_argument("--date", required=True)
    ap.add_argument("--audit-json", action="append", default=[], required=True)
    ap.add_argument("--log", action="append", default=[])
    ap.add_argument("--osd")
    ap.add_argument("--osd-drift-s", type=float)
    ap.add_argument("--gop-s", type=float)
    ap.add_argument("--streams-before")
    ap.add_argument("--streams-after")
    ap.add_argument("--session")
    ap.add_argument("--json")
    ap.add_argument("--md")
    ns = ap.parse_args(argv)
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except AttributeError:
        pass
    try:
        plan = json.loads(Path(ns.plan).read_text(encoding="utf-8"))
        day = dt.date.fromisoformat(ns.date)
        rep = evaluate(plan, day, load_audit(ns.audit_json), osd=read_osd(ns.osd) if ns.osd else None, gop_s=ns.gop_s,
                       drift_s=ns.osd_drift_s, logs=ns.log, session=ns.session,
                       streams_before=stream_names(ns.streams_before), streams_after=stream_names(ns.streams_after))
    except (OSError, ValueError, KeyError, InputError) as exc:
        print(f"input error: {exc}", file=sys.stderr)
        return 2
    md = to_markdown(rep)
    if ns.json:
        Path(ns.json).write_text(json.dumps(rep, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    if ns.md:
        Path(ns.md).write_text(md, encoding="utf-8", newline="\n")
    print(md)
    if rep["verdict_at011"] == "FAIL" or rep["verdict_at012_cleanup"] == "FAIL":
        return 1
    if rep["verdict_at011"] == "PASS" and rep["verdict_at012_cleanup"] == "PASS":
        return 0
    return 3


if __name__ == "__main__":
    raise SystemExit(main())
