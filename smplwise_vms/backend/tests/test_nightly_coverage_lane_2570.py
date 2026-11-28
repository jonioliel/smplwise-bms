"""FIX-CORE-DATA-2570 (deep review TR-08, part): the nightly calls the report-only coverage lane (scripts/gate/coverage_lane.sh), bounded:
once a week by default (SW_NIGHTLY_COVERAGE=weekly on SW_NIGHTLY_COVERAGE_DAY, Asia/Jerusalem), under `timeout` of at most
SW_NIGHTLY_COVERAGE_MAX_MIN minutes or what is left before the engine's end mark, main only, after the engine.
The schedule is checked by running the real script with --dry-run (no lock, no fetch, nothing run) under a throw-away HOME, with
SW_NIGHTLY_NOW as the clock (needs bash + GNU date with the zone data: the runner; skipped elsewhere); the call itself by its text."""
from __future__ import annotations

import os
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "scripts" / "gate" / "nightly_tests.sh"
BASH = shutil.which("bash")


def _zone_ok() -> bool:
    if not BASH:
        return False
    try:
        out = subprocess.run([BASH, "-c", "TZ=Asia/Jerusalem date -d @0 +%H"], capture_output=True, text=True, timeout=10)
    except (OSError, subprocess.SubprocessError):
        return False
    return out.returncode == 0 and out.stdout.strip() == "02"


needs_bash = pytest.mark.skipif(not _zone_ok(), reason="needs bash + GNU date with Asia/Jerusalem zone data (the runner)")
SATURDAY_0200 = int(datetime(2026, 11, 28, 0, 0, tzinfo=timezone.utc).timestamp())  # 02:00 local, Saturday (date +%u = 6)
MONDAY_0200 = int(datetime(2026, 11, 30, 0, 0, tzinfo=timezone.utc).timestamp())


def _dry(tmp_path: Path, now: int, **env_extra: str) -> str:
    env = {k: v for k, v in os.environ.items() if not k.startswith("SW_NIGHTLY")}
    env.update(HOME=str(tmp_path), SW_NIGHTLY_NOW=str(now), **env_extra)
    p = subprocess.run([BASH, str(SCRIPT), "--dry-run"], capture_output=True, text=True, timeout=30, env=env)
    assert p.returncode == 0, p.stdout + p.stderr
    assert not (tmp_path / "smplwise-results").exists(), "a dry run writes nothing"
    return next(line for line in p.stdout.splitlines() if line.startswith("coverage lane:"))


@needs_bash
def test_the_weekly_lane_runs_on_its_day_only(tmp_path: Path) -> None:
    assert _dry(tmp_path, SATURDAY_0200).startswith("coverage lane: run (mode weekly, day 6, cap 60 min")
    assert _dry(tmp_path, MONDAY_0200).startswith("coverage lane: skip: weekly lane on day 6, today is day 1")


@needs_bash
def test_daily_off_and_the_knobs(tmp_path: Path) -> None:
    assert _dry(tmp_path, MONDAY_0200, SW_NIGHTLY_COVERAGE="daily").startswith("coverage lane: run (mode daily")
    assert _dry(tmp_path, SATURDAY_0200, SW_NIGHTLY_COVERAGE="off").startswith("coverage lane: skip: SW_NIGHTLY_COVERAGE=off")
    line = _dry(tmp_path, MONDAY_0200, SW_NIGHTLY_COVERAGE_DAY="1", SW_NIGHTLY_COVERAGE_MAX_MIN="45")
    assert line.startswith("coverage lane: run") and "cap 45 min" in line
    assert "day 6" in _dry(tmp_path, MONDAY_0200, SW_NIGHTLY_COVERAGE_DAY="9"), "a malformed day falls back to the default"


def test_the_call_is_bounded_main_only_and_after_the_engine() -> None:
    text = SCRIPT.read_text(encoding="utf-8")
    engine = text.index('python3 "$ENGINE"')
    call = text.index('bash "$COVSH" --root "$DIR"')
    assert call > engine, "the lane runs after the engine (never competes with it for the machine)"
    block = text[text.rindex('if [ "$BR" = "main" ] && [ "$FO" -eq 0 ]', 0, call):call]
    assert 'timeout -k 30 "$CAP"' in text[call - 120:call], "the lane runs under timeout"
    assert '[ "$CAP" -gt "$LEFT" ] && CAP=$LEFT' in block and '"$CAP" -lt 1200' in block, "capped by what is left of the hard limit"
    assert "NOT_RUN" in block and "TIMEOUT" in text[call:call + 600], "every outcome leaves a line in the summary"
