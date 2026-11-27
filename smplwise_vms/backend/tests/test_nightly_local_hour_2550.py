"""LOWS-BRIDGE-GATE-2550 (deep review 2.52 TR-14): the runner's cron ignores CRON_TZ=Asia/Jerusalem, so the nightly started at 02:00 UTC
(04:00 local in winter). `nightly_tests.sh --local-hour=02` runs only when it is 02:xx in Asia/Jerusalem; the cron line fires at both UTC
hours that can be 02:00 local and the wrong one exits at once. Runs the real script with --dry-run (no lock, no fetch, nothing run) under
a throw-away HOME, with SW_NIGHTLY_NOW as the clock. Needs bash and GNU date with the zone data (the runner); skipped elsewhere."""
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


pytestmark = pytest.mark.skipif(not _zone_ok(), reason="needs bash + GNU date with Asia/Jerusalem zone data (the runner)")


def _epoch(*args: int) -> int:
    return int(datetime(*args, tzinfo=timezone.utc).timestamp())


def _run(tmp_path: Path, now: int, *args: str) -> subprocess.CompletedProcess:
    env = {k: v for k, v in os.environ.items() if not k.startswith("SW_NIGHTLY")}
    env.update(HOME=str(tmp_path), SW_NIGHTLY_NOW=str(now))
    return subprocess.run([BASH, str(SCRIPT), *args, "--dry-run"], capture_output=True, text=True, timeout=30, env=env)


@pytest.mark.parametrize("when,runs", [
    ((2026, 11, 27, 0, 0), True),    # winter: 00:00 UTC = 02:00 local
    ((2026, 11, 26, 23, 0), False),  # winter: 23:00 UTC = 01:00 local
    ((2026, 7, 1, 23, 0), True),     # summer: 23:00 UTC = 02:00 local
    ((2026, 7, 2, 0, 0), False),     # summer: 00:00 UTC = 03:00 local
    ((2026, 11, 27, 2, 0), False),   # the old cron slot, 02:00 UTC = 04:00 local
])
def test_only_two_oclock_local_runs(tmp_path: Path, when: tuple, runs: bool) -> None:
    p = _run(tmp_path, _epoch(*when), "--local-hour=02")
    assert p.returncode == 0, p.stdout + p.stderr
    if runs:
        assert "branches: main" in p.stdout, p.stdout
    else:
        assert "branches:" not in p.stdout and "nothing run" in p.stdout, p.stdout
    assert not (tmp_path / ".smplwise-tests.lock").exists() and not (tmp_path / "smplwise-results").exists(), "nothing written"


def test_without_the_option_nothing_changes(tmp_path: Path) -> None:
    p = _run(tmp_path, _epoch(2026, 11, 27, 2, 0))
    assert p.returncode == 0 and "branches: main" in p.stdout, p.stdout


def test_a_malformed_hour_is_refused(tmp_path: Path) -> None:
    p = _run(tmp_path, _epoch(2026, 11, 27, 0, 0), "--local-hour=2")
    assert p.returncode == 2 and "two digits" in p.stdout
