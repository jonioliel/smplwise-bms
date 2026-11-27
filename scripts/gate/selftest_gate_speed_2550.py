#!/usr/bin/env python3
"""Self-test of GATE-SPEED-2550 with FAKE data only: no runner, no real test suite, no browser, no network, nothing outside a temp dir.

  python scripts/gate/selftest_gate_speed_2550.py        (exit 0 = all OK; each case prints OK / BROKEN / SKIP; Windows or POSIX)

Part A  release_gate.py: the measured pixel estimate (pw_pixel_*.json process walls), the pixel chunks, the heavy-unit split of a
        parallel group (every (spec, project) still runs exactly once), the CPU sampler (/proc/stat), the seed writer, the committed
        seeds, and the 2.54.0 pool replay (the arithmetic of docs/changes/GATE-SPEED-2550.md).
Part B  gate_budget.py: the load factor and the limit (2.53 run 2 replay: the 67-minute derived cap vs the plan), the CLI.
Part C  gate2_select.py: the estimate uses an explicit GATE_PW_SLOTS / GATE_BACKEND_SHARDS, the frozen defer_seconds keep the
        heavy deferral unchanged (a throw-away git repository; SKIP without git).
Part D  the wrappers: release_gate2.sh / branch_check.sh hand gate_budget.py limit the load and keep an explicit limit first.
"""
import importlib.util
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
from contextlib import redirect_stdout
from pathlib import Path

HERE = Path(__file__).resolve().parent
TMP = Path(tempfile.mkdtemp(prefix="gate_speed_2550_"))
for _k in [k for k in os.environ if k.startswith(("GATE_", "GATE2_", "ENTRY_"))]:
    del os.environ[_k]
os.environ["GATE_HOME"] = str(TMP / "home")
os.environ["GATE_RESULTS_DIR"] = str(TMP / "results")
(TMP / "home").mkdir()
(TMP / "results").mkdir()
sys.path.insert(0, str(HERE))
BAD = []

# the 2.54.0 full gate's pool (release/2540-train @ f9217db8a, 8 slots): label, workers, the engine's est s, the measured wall s
POOL_2540 = [
    ("preview_desktop-tablet-mobile", 4, 9840, 8282), ("dev_desktop", 4, 1999, 1616),
    ("preview_desktop-tablet-mobile_w1_c3", 1, 3633, 3133), ("preview_desktop-tablet-mobile_w1_c7", 1, 3633, 2744),
    ("preview_desktop-tablet-mobile_w1_c0", 1, 3633, 3165), ("preview_desktop-tablet-mobile_w1_c1", 1, 3633, 2764),
    ("preview_desktop-tablet-mobile_w1_c2", 1, 3633, 2838), ("preview_desktop-tablet-mobile_w1_c6", 1, 3633, 3202),
    ("preview_desktop-tablet-mobile_w1_c4", 1, 3633, 3512), ("preview_desktop-tablet-mobile_w1_c5", 1, 3633, 3047),
    ("dev_desktop_w1_c3", 1, 1286, 1057), ("dev_desktop_w1_c1", 1, 1281, 991), ("dev_desktop_w1_c0", 1, 1276, 1002),
    ("dev_desktop_w1_c2", 1, 1272, 1000), ("dev_desktop_w1_c4", 1, 1264, 1077), ("fixture_devices", 2, 567, 711),
    ("preview_desktop", 3, 325, 422), ("preview_desktop-mobile", 3, 298, 396), ("fixture_nvrless_cameras", 2, 390, 263),
    ("preview_desktop_w1_c0", 1, 778, 731), ("preview_desktop_w1_c1", 1, 738, 476), ("pixel", 1, 710, 1728),
    ("fixture_media_ma", 2, 350, 224), ("fixture_media_sonos", 2, 350, 113), ("fixture_shots_devpolish", 1, 525, 335),
    ("fixture_wiskey", 2, 232, 158), ("fixture_nvrless_recorder", 2, 218, 56), ("dev_desktop-tablet-mobile", 3, 125, 166),
    ("visual", 4, 90, 100), ("dev_mobile", 3, 80, 88), ("fixture_no_ha", 2, 116, 65), ("dev_desktop-mobile", 3, 50, 110),
    ("dev_desktop-tablet-mobile_w1", 1, 125, 73), ("dev_desktop-mobile_w1", 1, 89, 59), ("dev_mobile_w1", 1, 60, 55),
    ("fixture_shots_home_personal", 1, 56, 32), ("fixture_shots_home_edit", 1, 53, 29), ("preview_mobile", 3, 12, 18),
    ("preview_desktop-mobile_w1", 1, 28, 66),
]


def check(name, cond, detail=""):
    print(("OK      " if cond else "BROKEN  ") + name + ("" if cond else f"  [{str(detail)[:700]}]"))
    if not cond:
        BAD.append(name)


def wj(p, d):
    Path(p).parent.mkdir(parents=True, exist_ok=True)
    Path(p).write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")


def engine(results=None, seed=None, **env):
    """A fresh engine module (its globals are state) with this results dir, an optional seed file next to a copy, and env knobs."""
    for k in [k for k in os.environ if k.startswith("GATE_") and k not in ("GATE_HOME",)]:
        del os.environ[k]
    os.environ["GATE_RESULTS_DIR"] = str(results or (TMP / "results"))
    os.environ.update({k: str(v) for k, v in env.items()})
    src = HERE / "release_gate.py"
    if seed is not None:
        d = TMP / f"eng_{len(list(TMP.glob('eng_*')))}"
        d.mkdir()
        shutil.copy(src, d / "release_gate.py")
        (d / "gate_durations.json").write_text(json.dumps(seed), encoding="utf-8")
        src = d / "release_gate.py"
    spec = importlib.util.spec_from_file_location(f"rg_{id(src)}_{len(BAD)}_{len(env)}", src)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def pw_report(file, rows, wall_ms=None):
    """A Playwright JSON report: rows = [(project, duration_ms)] for one spec file."""
    rep = {"suites": [{"file": file, "specs": [{"file": file, "title": f"t{i}", "tests": [
        {"projectName": p, "results": [{"duration": ms, "status": "passed"}]}]} for i, (p, ms) in enumerate(rows)]}]}
    if wall_ms is not None:
        rep["stats"] = {"startTime": "2026-11-26T20:00:00.000Z", "duration": wall_ms}
    return rep


# ------------------------------------------------------------------ part A: the engine
def part_a():
    # ---- reading the reports
    g = engine()
    c, pc = g.pw_report_costs(pw_report("a.spec.ts", [("desktop", 1000), ("mobile", 3000), ("desktop", 500)]))
    check("report costs: per file and per file+project", c == {"a.spec.ts": 4.5} and pc == {"a.spec.ts": {"desktop": 1.5, "mobile": 3.0}}, (c, pc))
    f, w = g.pixel_report_wall(pw_report("pixel-x.spec.ts", [("desktop", 2000)], wall_ms=56115))
    check("pixel report wall = stats.duration of its own process", (f, round(w, 3)) == ("pixel-x.spec.ts", 56.115), (f, w))
    check("pixel report without stats -> 0 s", g.pixel_report_wall(pw_report("p.spec.ts", [("desktop", 1)]))[1] == 0.0)

    # ---- prior costs: per project and the pixel walls from a fake gate's logs; retries ignored; seed pixel_seconds as fallback
    res = TMP / "resA"
    logs = res / "gate_release-x_aaa1111.logs"
    wj(logs / "pw_dev_desktop.json", pw_report("layout-big.spec.ts", [("desktop", 1_008_000)]))
    wj(logs / "pw_pixel_0.json", pw_report("pixel-a.spec.ts", [("desktop", 10_000), ("mobile", 10_000)], wall_ms=60_000))
    wj(logs / "pw_pixel_1.json", pw_report("pixel-b.spec.ts", [("desktop", 5_000)], wall_ms=30_000))
    wj(logs / "pw_pixel_1_retry_desktop.json", pw_report("pixel-b.spec.ts", [("desktop", 5_000)], wall_ms=999_000))
    g = engine(res, seed={"seconds": {"seed-only.spec.ts": 7.0}, "pixel_seconds": {"pixel-c.spec.ts": 40.0, "pixel-a.spec.ts": 1.0}})
    g.prior_costs()
    check("prior costs: per-project seconds recorded", g.project_costs().get("layout-big.spec.ts") == {"desktop": 1008.0}, g.project_costs())
    px = g.pixel_walls()
    check("pixel walls: measured per file, the retry report ignored, the seed only fills an untimed file",
          px == {"pixel-a.spec.ts": 60.0, "pixel-b.spec.ts": 30.0, "pixel-c.spec.ts": 40.0}, px)
    est = g.pixel_estimate(4, ["pixel-a.spec.ts", "pixel-b.spec.ts", "pixel-c.spec.ts", "pixel-new.spec.ts"])
    check("pixel estimate = sum of measured walls, an untimed file weighs the median (40)", est == 60 + 30 + 40 + 40, est)
    g0 = engine(TMP / "resEmpty", seed={"pixel_phase_seconds": 710})
    check("pixel estimate without measured walls: the seed's pixel_phase_seconds (the old rule)", g0.pixel_estimate(70, ["x.spec.ts"]) == 710.0)
    g1 = engine(TMP / "resEmpty", seed={})
    check("pixel estimate with neither: 4 s per file, at least 60 s", g1.pixel_estimate(70) == 280.0 and g1.pixel_estimate(3) == 60.0)

    # ---- pixel chunks
    names = [f"pixel-{i:02d}.spec.ts" for i in range(70)]
    seed = {"pixel_seconds": {n: 24.7 for n in names}}       # 70 x 24.7 = 1729 s, the 2.54.0 pixel job (1728 s measured)
    gv1 = engine(TMP / "resEmpty", seed=seed)
    one = gv1.pixel_jobs(names, 1500)
    check("pixel chunks: v1 default = one job labelled 'pixel' (unchanged)", len(one) == 1 and one[0]["label"] == "pixel" and one[0]["names"] == names, one[:1])
    gv2 = engine(TMP / "resEmpty", seed=seed, GATE_SCHEDULE="v2")
    gv2.SCHEDULE = "v2"
    jobs = gv2.pixel_jobs(names, 1500)
    got = [n for j in jobs for n in j["names"]]
    idx = [j["pixel_index"][n] for j in jobs for n in j["names"]]
    check("pixel chunks: v2 auto -> ceil(1729 / 1500) = 2 jobs, one worker each", [j["label"] for j in jobs] == ["pixel_c0", "pixel_c1"]
          and all(j["workers"] == 1 and j["kind"] == "pixel" and j["cat"] == "pixel" for j in jobs), [(j["label"], j["est"]) for j in jobs])
    check("pixel chunks: every pixel spec exactly once, global log index unique", sorted(got) == sorted(names) and sorted(idx) == list(range(70)))
    check("pixel chunks: balanced by measured wall (difference <= one file)", abs(jobs[0]["est"] - jobs[1]["est"]) <= 24.7 + 1e-6, [j["est"] for j in jobs])
    check("pixel chunks: inside a job the classification order is kept", all(j["names"] == sorted(j["names"], key=names.index) for j in jobs))
    gcap = engine(TMP / "resEmpty", seed={"pixel_seconds": {n: 200.0 for n in names}}, GATE_SCHEDULE="v2")
    gcap.SCHEDULE = "v2"
    check("pixel chunks: auto is capped at GATE_PIXEL_MAX_CHUNKS (3)", len(gcap.pixel_jobs(names, 1500)) == 3)
    gn = engine(TMP / "resEmpty", seed=seed, GATE_PIXEL_CHUNKS="1")
    gn.SCHEDULE = "v2"
    check("pixel chunks: GATE_PIXEL_CHUNKS=1 keeps one job on v2", len(gn.pixel_jobs(names, 1500)) == 1)
    g2 = engine(TMP / "resEmpty", seed=seed, GATE_PIXEL_CHUNKS="9")
    check("pixel chunks: never more jobs than files", len(g2.pixel_jobs(names[:2], 1500)) == 2)

    # ---- the heavy-unit split of a parallel group (dev_desktop in 2.53 / 2.54: one 1008 s file held 4 slots ~500 s)
    table = {f"small-{i:02d}.spec.ts": {"projects": ["desktop"], "workers1": False, "one": False} for i in range(40)}
    table["layout-electricity.spec.ts"] = {"projects": ["desktop"], "workers1": False, "one": False}
    table["layout-skin.spec.ts"] = {"projects": ["desktop", "mobile"], "workers1": False, "one": False}
    table["untimed-huge.spec.ts"] = {"projects": ["desktop", "mobile"], "workers1": False, "one": False}
    costs = {f"small-{i:02d}.spec.ts": 120.0 for i in range(40)} | {"layout-electricity.spec.ts": 1008.0, "layout-skin.spec.ts": 1388.0}
    pcosts = {"layout-skin.spec.ts": {"desktop": 1059.0, "mobile": 329.0}}
    gh = engine(TMP / "resEmpty", seed={})
    gh.SCHEDULE = "v2"
    gh._COSTS, gh._PCOSTS, gh._PXWALL = dict(costs), dict(pcosts), {}
    jobs = gh.plan_pw_jobs("dev", table, costs, 1500, 8, 4, 3)

    def units(js):
        return sorted((n, p) for j in js for n in j["names"] for p in j["projects"])
    want = sorted((n, p) for n, v in table.items() for p in v["projects"])
    check("heavy split: every (spec, project) of the group still runs exactly once", units(jobs) == want, units(jobs))
    heavy = {j["label"]: (j["names"], j["projects"], j["workers"], round(j["est"])) for j in jobs if j.get("heavy")}
    check("heavy split: the heavy units run alone (one file, one worker); a heavy project alone, the file's other projects together",
          sorted(heavy.values()) == sorted([(["layout-skin.spec.ts"], ["desktop"], 1, 1059), (["layout-skin.spec.ts"], ["mobile"], 1, 329),
                                            (["layout-electricity.spec.ts"], ["desktop"], 1, 1008)]), heavy)
    grp = [j for j in jobs if j["label"] == "dev_desktop"]
    check("heavy split: an untimed file never moves; the group keeps the rest with its own width",
          any("untimed-huge.spec.ts" in j["names"] for j in jobs if not j.get("heavy")) and grp and "layout-electricity.spec.ts" not in grp[0]["names"]
          and grp[0]["workers"] >= 3, [(j["label"], len(j["names"]), j["workers"]) for j in jobs])
    labels = [j["label"] for j in jobs]
    check("heavy split: labels unique (one report per job)", len(labels) == len(set(labels)), labels)
    goff = engine(TMP / "resEmpty", seed={}, GATE_HEAVY_SPLIT_SECS="0")
    goff.SCHEDULE = "v2"
    goff._COSTS, goff._PCOSTS, goff._PXWALL = dict(costs), dict(pcosts), {}
    off = goff.plan_pw_jobs("dev", table, costs, 1500, 8, 4, 3)
    check("heavy split: GATE_HEAVY_SPLIT_SECS=0 -> the old plan (no heavy job)", not any(j.get("heavy") for j in off) and units(off) == want)
    gv1h = engine(TMP / "resEmpty", seed={})
    gv1h._COSTS, gv1h._PCOSTS, gv1h._PXWALL = dict(costs), dict(pcosts), {}
    check("heavy split: off on the v1 schedule (default)", not any(j.get("heavy") for j in gv1h.plan_pw_jobs("dev", table, costs, 1500, 3, 3, 3)))
    w1 = {n: dict(v, workers1=True) for n, v in table.items()}
    check("heavy split: --workers=1 groups are never split by project", not any(j.get("heavy") for j in gh.plan_pw_jobs("dev", w1, costs, 1500, 8, 4, 3)))
    gcapj = engine(TMP / "resEmpty", seed={}, GATE_HEAVY_MAX_JOBS="1")
    gcapj.SCHEDULE = "v2"
    gcapj._COSTS, gcapj._PCOSTS, gcapj._PXWALL = dict(costs), dict(pcosts), {}
    capped = [j for j in gcapj.plan_pw_jobs("dev", table, costs, 1500, 8, 4, 3) if j.get("heavy")]
    check("heavy split: at most GATE_HEAVY_MAX_JOBS jobs per group (a file that needs more stays in the group)",
          [j["names"] for j in capped] == [["layout-electricity.spec.ts"]], capped)
    big = {f"f{i}.spec.ts": {"projects": ["desktop", "tablet", "mobile"], "workers1": False, "one": False} for i in range(900)}
    bc = {f"f{i}.spec.ts": 40.0 for i in range(900)} | {"f0.spec.ts": 1395.0}
    gh._COSTS, gh._PCOSTS = dict(bc), {"f0.spec.ts": {"desktop": 1059.0, "tablet": 7.0, "mobile": 329.0}}
    check("heavy split: a 1059 s unit in a ~9000 s, 4-worker group is NOT heavy (threshold = 25 % of the group's wall)",
          not any(j.get("heavy") for j in gh.plan_pw_jobs("preview", big, bc, 1500, 8, 4, 3)))

    # ---- the 2.54.0 replay: the measured pixel estimate starts the pixel job before the tail
    gs = engine()
    real = {l: wall for l, _, _, wall in POOL_2540}
    old = [{"label": l, "workers": w, "est": float(e)} for l, w, e, _ in POOL_2540]
    new = [dict(j, est=float(real["pixel"])) if j["label"] == "pixel" else j for j in old]

    def replay(jobs, slots=8):
        """run_pool's greedy order (gs._order on est), with the measured wall as the true duration."""
        pending, running, t, free = gs._order(jobs), [], 0.0, slots
        starts = {}
        while pending or running:
            pick = next((j for j in pending if gs._fits(j["workers"], free, slots)), None)
            if pick:
                pending.remove(pick); free -= pick["workers"]; starts[pick["label"]] = t
                running.append((t + real[pick["label"]], pick["workers"]))
                continue
            running.sort(); e, w = running.pop(0); t, free = e, free + w
        return t, starts
    span_old, st_old = replay(old)
    span_new, st_new = replay(new)
    ends_new = {l: st_new[l] + real[l] for l in st_new}
    check("2.54 replay: the old est (710 s) starts pixel at 8558 s (the real gate: 9543 s); the measured est (1728 s) ~1050 s earlier, "
          "and pixel is no longer the last job to end",
          st_old["pixel"] == 8558 and st_new["pixel"] <= st_old["pixel"] - 1000
          and ends_new["pixel"] < max(v for l, v in ends_new.items() if l != "pixel"), (st_old["pixel"], st_new["pixel"], ends_new["pixel"]))
    check("2.54 replay: the slot-model pool ends no later (10286 -> <= 10200 s)", span_old == 10286 and span_new <= 10200, (span_old, span_new))
    area = sum(w * real[l] for l, w, _, _ in POOL_2540)
    check("2.54 replay: lower bound area / 8 slots = 9986 s; the new order is within 2 %", round(area / 8) == 9986 and span_new <= area / 8 * 1.02,
          (area / 8, span_new))

    # ---- the CPU sampler
    stat1 = "cpu  100 0 50 800 50 0 0 0 0 0\ncpu0 1 1 1 1 1\ncpu1 1 1 1 1 1\nintr 1\n"
    stat2 = "cpu  250 0 100 850 50 0 0 0 0 0\ncpu0 1 1 1 1 1\ncpu1 1 1 1 1 1\n"
    check("cpu: /proc/stat parse -> busy, idle(+iowait), cores", g.parse_proc_stat(stat1) == (150, 850, 2), g.parse_proc_stat(stat1))
    check("cpu: no cpu line -> None", g.parse_proc_stat("intr 1\n") is None and g.parse_proc_stat("") is None)
    last, res_ = {}, {}
    first = g.cpu_sample(stat1, 0.0, last, res_)
    pct = g.cpu_sample(stat2, 30.0, last, res_)
    # delta busy 200, idle 50 -> 80 % busy; idle core-seconds = 0.2 x 2 cores x 30 s = 12
    check("cpu: first sample only primes; the next one records 80 % busy and 12 idle core-seconds",
          first is None and pct == 80 and res_["cpu_busy_pct"] == [80] and res_["idle_core_s"] == 12.0 and res_["cpus"] == 2, res_)
    check("cpu: summary text", "busy 80 %" in g.cpu_summary(res_) and g.cpu_summary({}) == "", g.cpu_summary(res_))

    # ---- the seed writer: pixel walls into the seed
    sl = TMP / "seedlogs"
    wj(sl / "pw_pixel_0.json", pw_report("pixel-a.spec.ts", [("desktop", 10_000)], wall_ms=60_000))
    wj(sl / "pw_pixel_1.json", pw_report("pixel-b.spec.ts", [("desktop", 10_000)], wall_ms=25_500))
    wj(sl / "pw_preview_desktop.json", pw_report("a.spec.ts", [("desktop", 2_000)]))
    gw = engine(TMP / "resEmpty", seed={"pixel_phase_seconds": 710})
    buf = io.StringIO()
    with redirect_stdout(buf):
        rc = gw.main_cli(["--seed-from", str(sl), "gate x @ 1"])
    doc = json.loads(buf.getvalue())
    check("seed writer: pixel_seconds per file and pixel_phase_seconds = their sum", rc == 0 and doc.get("pixel_seconds") == {"pixel-a.spec.ts": 60.0, "pixel-b.spec.ts": 25.5}
          and doc.get("pixel_phase_seconds") == 86 and doc["seconds"]["a.spec.ts"] == 2.0, doc)

    # ---- the committed seeds
    d = json.loads((HERE / "gate_durations.json").read_text(encoding="utf-8"))
    c2 = json.loads((HERE / "gate2_costs.json").read_text(encoding="utf-8-sig"))
    ok = all(isinstance(v, (int, float)) and v > 0 for doc_ in (d, c2) for key in ("seconds", "backend_seconds", "pixel_seconds")
             for v in doc_.get(key, {}).values())
    check("committed seeds: seconds, backend_seconds and pixel_seconds present and positive", ok and d.get("pixel_seconds") and c2.get("pixel_seconds")
          and len(d["seconds"]) > 1000 and len(c2["backend_seconds"]) > 1000, (len(d.get("seconds", {})), len(c2.get("backend_seconds", {}))))
    check("committed seeds: gate2_costs.json keeps the frozen defer_seconds (the heavy deferral is unchanged)",
          isinstance(c2.get("defer_seconds"), dict) and len(c2["defer_seconds"]) == 630, len(c2.get("defer_seconds") or {}))


# ------------------------------------------------------------------ part B: the limit
def part_b():
    import gate_budget as gb
    check("load factor: missing / junk -> 1.0", gb.load_factor(None, 16) == 1.0 and gb.load_factor("x", 16) == 1.0 and gb.load_factor(5, 0) == 1.0)
    check("load factor: load up to a quarter of the cores is noise", gb.load_factor(4, 16) == 1.0 and gb.load_factor(2.5, 16) == 1.0)
    check("load factor: 1 + (load - 4) / 16 on 16 cores, capped at 1.6", gb.load_factor(8, 16) == 1.25 and gb.load_factor(16, 16) == 1.6
          and gb.load_factor(99, 16) == 1.6, (gb.load_factor(8, 16), gb.load_factor(16, 16)))
    # the 2.53 run 2 trap: a passed select history from the small 2.52 --after run -> a 4059 s (67 min) cap
    res = TMP / "resB"
    phases = {"select": 3, "spec-lint": 0, "modules": 0, "backend-start": 2, "tsc": 46, "build": 27, "fe-static": 5, "release_check": 6,
              "addon-build-start": 0, "fe-lint-start": 0, "early-layout": 130, "early-layout-settle": 0, "playwright-pool": 1696,
              "playwright-settle": 0, "fe-lint-wait": 0, "addon-build-wait": 0, "backend-wait": 122}
    wj(res / "gate_release-2520-train_20fc43ef9.json", {"verdict": "pass", "tier": "L", "branch": "release/2520-train", "sha": "20fc43ef9",
                                                        "finished": "2026-11-26T01:13:00+0000", "selection": {"reduced": {"preview": "300 of 1228"}},
                                                        "phases": [{"name": n, "seconds": s} for n, s in phases.items()]})
    seed = HERE / "gate_phase_budgets.json"
    derived = gb.total_cap(gb.derive_budgets(res, "select", seed))
    check("2.53 run 2 replay: the derived select cap from the 2.52 --after run is ~67 min", 3900 <= derived <= 4200, derived)
    plan = ("  full backend : no\n  full frontend: no\n"
            "  knobs for this run: GATE_BACKEND_SHARDS=4 GATE_PW_SLOTS=8 (closure depth 2) [estimated with the explicit GATE_PW_SLOTS / GATE_BACKEND_SHARDS of the environment]\n"
            "  ESTIMATE gate2: ~108-126 min wall   (full tier on the same tree: ~160-196 min; 2.54.0 actual full v2 gate: 192 min)\n")
    r = gb.effective_limit(res, "select", gb.parse_plan(plan), None, 7200, seed, load1=3.0, nproc=16)
    check("limit: an idle runner -> estimate high 126 min x 1.25 = 158 min (run 3 needed 125 min)", r["limit_s"] == 9450 and r["rule"] == "estimate"
          and r["load_factor"] == 1.0, r)
    r = gb.effective_limit(res, "select", gb.parse_plan(plan), None, 7200, seed, load1=12.0, nproc=16)
    check("limit: load 12 on 16 cores at the start -> x 1.5 -> 236 min, and the why names the load", r["limit_s"] == 14175 and "load factor 1.5" in r["why"], r)
    r = gb.effective_limit(res, "select", gb.parse_plan(plan), "5000", 7200, seed, load1=40, nproc=16)
    check("limit: an explicit limit still wins", r["limit_s"] == 5000 and r["rule"] == "explicit", r)
    r = gb.effective_limit(res, "select", gb.parse_plan(""), None, 7200, seed, load1=40, nproc=16)
    check("limit: no plan -> the derived cap (the load factor only scales an estimate)", r["limit_s"] == derived and r["rule"] == "derived", r)
    small = plan.replace("~108-126 min wall", "~10-12 min wall")
    r = gb.effective_limit(res, "select", gb.parse_plan(small), None, 7200, seed, load1=3, nproc=16)
    check("limit: a small estimate never lowers the derived cap", r["limit_s"] == derived, r)
    full = gb.effective_limit(TMP / "resNone", "full", gb.parse_plan(plan), None, 12000, seed, load1=3, nproc=16)
    check("limit: full mode takes the plan's full-tier high (196 min x 1.25 = 245 min) over the cap", full["limit_s"] == 14700, full)
    # the CLI as the wrappers call it
    exe = [sys.executable, str(HERE / "gate_budget.py"), "limit", "--results", str(res), "--mode", "select", "--plan", "-", "--fallback", "7200",
           "--load1", "12.0", "--nproc", "16", "--explain"]
    p = subprocess.run(exe, input=plan, capture_output=True, text=True, timeout=60)
    check("CLI limit: one integer on stdout, the why (with the load) on stderr", p.returncode == 0 and p.stdout.strip() == "14175"
          and "time limit:" in p.stderr and "load factor 1.5" in p.stderr, (p.returncode, p.stdout, p.stderr))
    p = subprocess.run(exe[:-5] + ["--load1", "", "--nproc", "", "--explain"], input=plan, capture_output=True, text=True, timeout=60)
    check("CLI limit: empty --load1 / --nproc (no /proc) -> factor 1", p.returncode == 0 and p.stdout.strip() == "9450", (p.stdout, p.stderr))
    p = subprocess.run([sys.executable, str(HERE / "gate_budget.py"), "cap", "--results", str(res), "--mode", "select"], capture_output=True, text=True, timeout=60)
    check("CLI cap: unchanged", p.returncode == 0 and p.stdout.strip() == str(derived), p.stdout)


# ------------------------------------------------------------------ part C: the plan's estimate and the deferral
def part_c():
    import gate2_select as g2
    keep = {k: os.environ.get(k) for k in ("GATE_PW_SLOTS", "GATE_BACKEND_SHARDS")}
    try:
        for k in keep:
            os.environ.pop(k, None)
        check("run knobs: nothing set -> search (12 slots, no shards, not fixed)", g2.run_knobs() == (12, None, False))
        os.environ["GATE_PW_SLOTS"], os.environ["GATE_BACKEND_SHARDS"] = "8", "4"
        check("run knobs: the environment's 8 slots / 4 shards are used", g2.run_knobs() == (8, 4, True))
        os.environ["GATE_PW_SLOTS"], os.environ["GATE_BACKEND_SHARDS"] = "lots", "0"
        check("run knobs: junk -> the search", g2.run_knobs() == (12, None, False))
    finally:
        for k, v in keep.items():
            os.environ.pop(k, None) if v is None else os.environ.__setitem__(k, v)
    # a tiny tree: 30 dist-preview specs, 8 backend test files; the estimate with fixed slots
    root = TMP / "tree"
    (root / g2.FE / "tests").mkdir(parents=True)
    (root / g2.BE / "tests").mkdir(parents=True)
    for i in range(30):
        (root / g2.FE / "tests" / f"unit-{i:02d}.spec.ts").write_text("import { test } from '@playwright/test';\n", encoding="utf-8")
    for i in range(8):
        (root / g2.BE / "tests" / f"test_{i}.py").write_text("def test_x():\n    pass\n", encoding="utf-8")
    costs = {"seconds": {f"unit-{i:02d}.spec.ts": 600.0 for i in range(30)}, "backend_seconds": {f"test_{i}.py": 900.0 for i in range(8)}}
    os.environ["GATE_SCHEDULE"] = "v2"
    try:
        e8 = g2.estimate(root, None, costs, 8, None, fixed_slots=True)
        e_search = g2.estimate(root, None, costs)
        e84 = g2.estimate(root, None, costs, 8, 4)
    finally:
        os.environ.pop("GATE_SCHEDULE", None)
    check("estimate: fixed 8 slots -> the pool is planned on 8 slots, only the shards are searched", e8["pw_slots"] == 8 and 4 <= e8["backend_shards"] <= 10, e8)
    check("estimate: the old search may pick more slots than the run has", e_search["pw_slots"] >= 8, e_search)
    check("estimate: 8 slots + 4 shards as given", e84["pw_slots"] == 8 and e84["backend_shards"] == 4 and e84["backend_wall_s"] == 1800.0, e84)
    # the frozen defer_seconds decide the deferral (a throw-away git repository)
    if not shutil.which("git"):
        print("SKIP    deferral: git not found")
        return
    r = TMP / "repo"
    for d in ("smplwise_vms/backend/smplwise", "smplwise_vms/backend/tests", "frontend/src", "frontend/tests"):
        (r / d).mkdir(parents=True)
    (r / "smplwise_vms/backend/smplwise/__init__.py").write_text("")
    (r / "frontend/src/a.ts").write_text("export const a = 1;\n")
    (r / "frontend/tests/layout-heavy.spec.ts").write_text("import { a } from '../src/a';\n")
    (r / "frontend/tests/unit-a.spec.ts").write_text("import { a } from '../src/a';\n")

    def git(*a):
        subprocess.run(["git", "-C", str(r), "-c", "user.email=t@t", "-c", "user.name=t", "-c", "core.autocrlf=false", *a],
                       check=True, capture_output=True)
    git("init", "-q"); git("add", "-A"); git("commit", "-q", "-m", "base"); git("tag", "base")
    (r / "frontend/src/a.ts").write_text("export const a = 2;\n")
    git("commit", "-q", "-am", "change")
    s_old = g2.select_gate2(r, "base", "HEAD", costs={"seconds": {"layout-heavy.spec.ts": 5000}})
    s_frozen = g2.select_gate2(r, "base", "HEAD", costs={"seconds": {"layout-heavy.spec.ts": 5000}, "defer_seconds": {"layout-heavy.spec.ts": 10}})
    s_frozen2 = g2.select_gate2(r, "base", "HEAD", costs={"seconds": {"layout-heavy.spec.ts": 10}, "defer_seconds": {"layout-heavy.spec.ts": 5000}})
    check("deferral: without defer_seconds the seconds decide (as before)", "layout-heavy.spec.ts" in s_old["deferred_to_nightly"], s_old["deferred_to_nightly"])
    check("deferral: with defer_seconds those decide, not the refreshed seconds",
          "layout-heavy.spec.ts" not in s_frozen["deferred_to_nightly"] and "layout-heavy.spec.ts" in s_frozen["frontend"]["selected"]
          and "layout-heavy.spec.ts" in s_frozen2["deferred_to_nightly"], (s_frozen["deferred_to_nightly"], s_frozen2["deferred_to_nightly"]))


# ------------------------------------------------------------------ part D: the wrappers
def part_d():
    rg2 = (HERE / "release_gate2.sh").read_text(encoding="utf-8")
    bc = (HERE / "branch_check.sh").read_text(encoding="utf-8")
    check("release_gate2.sh: the select limit comes from gate_budget.py limit with the load at the start",
          'printf \'%s\\n\' "$PLAN" | effective_limit select 7200' in rg2 and "--load1 \"$(cut -d' ' -f1 /proc/loadavg" in rg2
          and '--nproc "$(nproc' in rg2 and 'derived_cap "$1" "$2"' in rg2)
    check("release_gate2.sh: --full takes the plan's full-tier estimate as a floor, an explicit GATE_TOTAL_SECS first",
          'effective_limit full 12000' in rg2 and 'if [ -z "${GATE_TOTAL_SECS:-}" ]; then' in rg2)
    check("release_gate2.sh: the dry-run prints the limit a real run would get", "GATE-SPEED-2550: the time limit a real run would get now" in rg2)
    check("branch_check.sh: limit with the load, ENTRY_TOTAL_SECS first, the old cap as fallback",
          'gate_budget.py" limit --results "$RES" --mode select --plan - --fallback 5400' in bc and '--explicit "${ENTRY_TOTAL_SECS:-}"' in bc
          and '--load1 "$(cut' in bc and 'TOTAL="${ENTRY_TOTAL_SECS:-${CAP:-5400}}"' in bc)
    bash = shutil.which("bash")
    if not bash:
        print("SKIP    wrappers: bash not found")
        return
    for name in ("release_gate2.sh", "branch_check.sh"):
        p = subprocess.run([bash, "-n", str(HERE / name)], capture_output=True, text=True, timeout=60)
        check(f"{name}: bash -n (syntax)", p.returncode == 0, p.stderr)


def main() -> int:
    try:
        part_a()
        part_b()
        part_c()
        part_d()
    finally:
        shutil.rmtree(TMP, ignore_errors=True)
    print(f"SELFTEST {'FAILED: ' + str(len(BAD)) if BAD else 'OK'}")
    return 1 if BAD else 0


if __name__ == "__main__":
    sys.exit(main())
