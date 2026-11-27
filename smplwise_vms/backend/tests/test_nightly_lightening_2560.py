"""GATE-NIGHTLY-2560: the owner's 25.11 lightening of the nightly (Q11 a: same parallelism as the release gate) was first made on the runner
only; the repo copy of nightly_tests.sh must carry it (and the engine drift check, and --local-hour) so installing it undoes nothing.
Static check of the script text; needs no bash."""
from __future__ import annotations

from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[3] / "scripts" / "gate" / "nightly_tests.sh"


def test_the_repo_copy_keeps_the_runner_lightening_on_the_engine_call() -> None:
    text = SCRIPT.read_text(encoding="utf-8")
    engine_call = text.index('python3 "$ENGINE"')
    for knob in ('GATE_PW_SLOTS="${SW_NIGHTLY_PW_SLOTS:-8}"', 'GATE_BACKEND_SHARDS="${SW_NIGHTLY_SHARDS:-4}"',
                 'GATE_PW_MAX_WORKERS="${SW_NIGHTLY_PW_MAX_WORKERS:-4}"', 'GATE_MIN_FREE_MB="${SW_NIGHTLY_MIN_FREE_MB:-3000}"'):
        pos = text.index(knob)
        assert pos < engine_call and engine_call - pos < 900, f"{knob} must be set in the command that runs the engine"


def test_the_repo_copy_keeps_the_drift_check_and_the_newer_local_hour_logic() -> None:
    text = SCRIPT.read_text(encoding="utf-8")
    assert "engine_sync.py" in text and "--set nightly" in text and "--warn-only" in text
    assert "--local-hour=" in text and "TZ=Asia/Jerusalem" in text
