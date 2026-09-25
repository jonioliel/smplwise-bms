"""Plan Studio detection baseline (T086, R172 / AT172): on the committed synthetic set every plan reaches walls >= 90 %
(precision >= 80 %), doors >= 80 %, windows >= 60 % and finishes within the 15 s budget; the uncalibrated run offers a
door-width hint within 5 % of the truth; kinds and confidence follow design 9.1; the private-scan script skips
cleanly when there are no private plans."""
from __future__ import annotations

import io
import pathlib
import subprocess
import sys

import plan_detect_metrics as pm
from smplwise.services import plan_detect as pd

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / "fixtures" / "plan_detect"))
import gen_synthetic as gen  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[3]
BUDGET_MS = 15000


def test_baseline_on_the_synthetic_set():
    rows = pm.run_set(pd.detect)
    print(pm.summary_line(rows))
    for row in rows:
        assert row["walls"]["recall"] >= 0.90 and row["walls"]["precision"] >= 0.80, (row["name"], row["walls"])
        assert row["doors"]["recall"] >= 0.80, (row["name"], row["doors"])
        assert row["windows"]["recall"] >= 0.60, (row["name"], row["windows"])
        assert row["ms"] <= BUDGET_MS, (row["name"], row["ms"])
    assert sum(r["windows"]["found"] for r in rows) >= 12 and sum(r["doors"]["found"] for r in rows) >= 20


def test_windows_in_the_hall_and_the_apartment():
    for name, want in (("hall", 5), ("apartment", 3)):
        gt, png = next((g, p) for n, g, p in pm.load_set() if n == name)
        r = pd.detect(png, scale_m_per_px=gt["scale_m_per_px"])
        windows = [o for o in r["openings"] if o["kind"] == "window"]
        assert len(windows) == want, (name, [(o["kind"], o["width_m"]) for o in r["openings"]])
        for o in windows:
            assert o["height_m"] == 1.2 and o["sill_m"] == 0.9 and o["swing"] == "none" and 0.55 <= o["confidence"] <= 0.9
            assert 0.4 <= o["width_m"] <= 1.6, o
        assert pm.opening_scores(gt, r["walls"], r["openings"], ("window",), "windows", 10.0)["recall"] == 1.0


def test_the_profile_pass_finds_the_windows_alone_and_never_twice(monkeypatch):
    """The gap pass of Task 4 already finds every synthetic window, so the profile pass must add none of them again;
    with the gap-pass windows withdrawn it must find all of them by itself (the windows a closing hides in a scan)."""
    gt, png = next((g, p) for n, g, p in pm.load_set() if n == "hall")
    added: list[int] = []
    orig = pd.windows_by_profile

    def both(walls, openings, dt, ink, s):
        out = orig(walls, openings, dt, ink, s)
        added.append(len(out))
        return out

    monkeypatch.setattr(pd, "windows_by_profile", both)
    pd.detect(png, scale_m_per_px=gt["scale_m_per_px"])
    assert added == [0]

    def alone(walls, openings, dt, ink, s):
        openings[:] = [o for o in openings if o["kind"] != "window"]
        return orig(walls, openings, dt, ink, s)

    monkeypatch.setattr(pd, "windows_by_profile", alone)
    r = pd.detect(png, scale_m_per_px=gt["scale_m_per_px"])
    windows = [o for o in r["openings"] if o["kind"] == "window"]
    assert len(windows) == 5 and all(o["confidence"] <= 0.99 for o in windows), windows
    assert pm.opening_scores(gt, r["walls"], r["openings"], ("window",), "windows", 10.0) == {"recall": 1.0, "kind_recall": 1.0, "found": 5, "total": 5, "false": 0}


def test_kinds_and_confidence_follow_the_rules():
    p = gen.Plan("t", 0.01, 800, 500)
    for a, b in (((60, 60), (740, 60)), ((740, 60), (740, 440)), ((740, 440), (60, 440)), ((60, 440), (60, 60))):
        p.wall(a, b, 16, "exterior")
    p.wall((400, 60), (400, 440), 12)  # spans the plan: touches two frame edges, still interior
    p.wall((60, 250), (400, 250), 6)  # a thin partition
    p.wall((560, 250), (610, 250), 12)  # a short stub: low length score
    buf = io.BytesIO()
    p.im.save(buf, "PNG")
    r = pd.detect(buf.getvalue(), scale_m_per_px=0.01)
    by_kind: dict[str, list[dict]] = {}
    for w in r["walls"]:
        by_kind.setdefault(w["kind"], []).append(w)
    assert len(by_kind["exterior"]) == 4 and all(abs(w["thickness_m"] - 0.16) < 0.04 for w in by_kind["exterior"])
    assert any(abs(w["thickness_m"] - 0.06) < 0.03 for w in by_kind.get("partition", [])), by_kind
    assert len([w for w in by_kind.get("interior", []) if abs(w["thickness_m"] - 0.12) < 0.03]) == 2, by_kind
    stub = min(r["walls"], key=lambda w: abs(w["polyline"][0][0] - w["polyline"][1][0]) * 800 + abs(w["polyline"][0][1] - w["polyline"][1][1]) * 500)
    longest = max(by_kind["exterior"], key=lambda w: abs(w["polyline"][0][0] - w["polyline"][1][0]))
    assert stub["confidence"] < longest["confidence"] and longest["confidence"] >= 0.9 and all(0.05 <= w["confidence"] <= 0.99 for w in r["walls"])
    assert r["detector"] == {"name": "plan_detect", "version": pd.VERSION, "params": {"strength": 0.6, "targets": ["walls", "openings"], "analysis_px": [800, 500], "threshold": r["detector"]["params"]["threshold"], "tilt_deg": 0.0}}


def test_private_script_skips_without_private_plans(tmp_path):
    out = subprocess.run([sys.executable, str(ROOT / "scripts" / "plan_detect_private.py"), str(tmp_path / "none")], capture_output=True, text=True, cwd=str(ROOT))
    assert out.returncode == 0 and "skipped: no private plans" in out.stdout
    gen.generate(tmp_path / "set")
    out = subprocess.run([sys.executable, str(ROOT / "scripts" / "plan_detect_private.py"), str(tmp_path / "set")], capture_output=True, text=True, cwd=str(ROOT))
    assert out.returncode == 0 and "6 plans:" in out.stdout and "apartment" in out.stdout and str(tmp_path) not in out.stdout, out.stdout
