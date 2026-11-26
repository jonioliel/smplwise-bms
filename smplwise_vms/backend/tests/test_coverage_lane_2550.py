"""LOWS-BRIDGE-GATE-2550 (deep review 2.52 TR-08, part "no coverage measurement"): `scripts/gate/coverage_lane.py`, the report-only,
stdlib line-coverage recorder (Python 3.12 sys.monitoring) and its report. A throw-away package under tmp_path only."""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
_spec = importlib.util.spec_from_file_location("coverage_lane_2550", ROOT / "scripts" / "gate" / "coverage_lane.py")
cl = importlib.util.module_from_spec(_spec)
assert _spec.loader
_spec.loader.exec_module(cl)

pytestmark = pytest.mark.skipif(not hasattr(sys, "monitoring"), reason="sys.monitoring needs Python 3.12")

MODULE = '''"""A module."""


def used(x):
    y = x + 1
    return y


def unused(x):
    z = x * 2
    return z
'''


def _package(tmp_path: Path) -> Path:
    src = tmp_path / "pkg"
    (src / "sub").mkdir(parents=True)
    (src / "m.py").write_text(MODULE, encoding="utf-8")
    (src / "sub" / "never.py").write_text("A = 1\nB = 2\n", encoding="utf-8")
    return src


def _load(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(mod)
    return mod


def test_the_recorder_sees_the_lines_that_ran_and_only_under_its_source(tmp_path: Path) -> None:
    src = _package(tmp_path)
    rec = cl.Recorder(src)
    assert rec.start(), "a free sys.monitoring tool id"
    try:
        mod = _load(src / "m.py", "cov_lane_m_2550")
        assert mod.used(1) == 2
    finally:
        rec.stop()
    data = rec.data()
    lines = data["files"]["m.py"]
    body = MODULE.splitlines()
    assert body.index("    y = x + 1") + 1 in lines and body.index("    return y") + 1 in lines
    assert body.index("    z = x * 2") + 1 not in lines, "the function that never ran"
    assert set(data["files"]) == {"m.py"}, "nothing outside the source folder is recorded"


def test_the_report_merges_shards_and_lists_what_no_test_imported(tmp_path: Path) -> None:
    src = _package(tmp_path)
    rec = cl.Recorder(src)
    rec.start()
    try:
        _load(src / "m.py", "cov_lane_m2_2550").used(3)
    finally:
        rec.stop()
    shard = tmp_path / "shard_0.json"
    shard.write_text(json.dumps(rec.data()), encoding="utf-8")
    bad = tmp_path / "shard_1.json"
    bad.write_text("{not json", encoding="utf-8")
    out, summary = tmp_path / "out" / "coverage.md", tmp_path / "out" / "coverage.json"
    assert cl.main(["report", "--src", str(src), "--out", str(out), "--json", str(summary), str(shard), str(bad)]) == 0
    s = json.loads(summary.read_text(encoding="utf-8"))
    assert s["modules"] == 2 and s["never_imported"] == ["sub/never.py"] and 0 < s["pct"] < 100
    text = out.read_text(encoding="utf-8")
    assert "report only" in text and "`sub/never.py`" in text and "shard_1.json: unreadable" in text


def test_the_report_never_fails(tmp_path: Path) -> None:
    out = tmp_path / "coverage.md"
    assert cl.main(["report", "--src", str(tmp_path / "missing"), "--out", str(out)]) == 0
    assert out.read_text(encoding="utf-8").startswith("# Backend line coverage")


def test_the_plugin_does_nothing_without_its_environment(monkeypatch) -> None:
    monkeypatch.delenv("SW_COVERAGE_OUT", raising=False)
    cl.pytest_configure(None)
    assert cl._REC is None
    cl.pytest_unconfigure(None)
