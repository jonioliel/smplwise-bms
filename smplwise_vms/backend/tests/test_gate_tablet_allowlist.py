"""E4: the release gate drops the tablet project for evidence specs reviewed in frontend/tests/gate_tablet_allowlist.json."""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
FE = ROOT / "frontend"
sys.path.insert(0, str(ROOT / "scripts" / "gate"))
_spec = importlib.util.spec_from_file_location("release_gate_e4", ROOT / "scripts" / "gate" / "release_gate.py")
rg = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rg)
DATA = json.loads((FE / "tests" / "gate_tablet_allowlist.json").read_text(encoding="utf-8"))


def test_lists_are_disjoint_and_name_real_evidence_specs():
    keep, drop = set(DATA["tablet"]), set(DATA["desktop_mobile"])
    assert not keep & drop
    for n in keep | drop:
        assert n.startswith("evidence-") and (FE / "tests" / n).is_file(), n
    # the owner asked to keep these two on tablet
    assert {"evidence-access-schedules.spec.ts", "evidence-curve-points.spec.ts"} <= keep


def test_gate_drops_tablet_only_for_reviewed_specs(monkeypatch):
    monkeypatch.setattr(rg, "TABLET_FULL", False)
    cls = rg.classify(FE, "L")
    dropped = set(cls["tablet_dropped"])
    assert dropped and dropped <= set(DATA["desktop_mobile"])
    for n in dropped:
        assert cls["rest"][n]["projects"] == ["desktop", "mobile"], n
    for n in DATA["tablet"]:
        for kind in ("rest", "dev", "fixture"):
            if n in cls[kind]:
                assert n not in dropped


def test_nightly_full_mode_keeps_every_project(monkeypatch):
    monkeypatch.setattr(rg, "TABLET_FULL", True)
    cls = rg.classify(FE, "L")
    assert cls["tablet_dropped"] == []
    assert all("tablet" in v["projects"] for n, v in cls["rest"].items() if n in DATA["desktop_mobile"] and not v["one"])


def test_nightly_script_sets_full_mode():
    assert "GATE_TABLET_FULL=1" in (ROOT / "scripts" / "gate" / "nightly_tests.sh").read_text(encoding="utf-8")
