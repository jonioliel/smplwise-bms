"""LOWS-BRIDGE-GATE-2550 (deep review 2.52 TR-08, part "run.sh is never executed"): the add-on's entrypoint `smplwise_vms/run.sh` is
EXECUTED here, in a sandbox: a fake bashio (only the functions run.sh calls, all of which exist in the real bashio library; any other
`bashio::*` name is recorded as missing), a fake `python3` on PATH that records how it was started, and `/app` redirected to a temporary
folder. Before this, the only tests of run.sh matched strings in it, so a bashio typo, a broken `if`, a CRLF line end or a wrong
start command passed every gate. The real image's bashio is checked by `scripts/gate/addon_build_check.sh` (step `run_sh_in_image`).
Needs bash; no Supervisor, no network, no image."""
from __future__ import annotations

import os
import re
import shutil
import subprocess
from pathlib import Path

import pytest

ADDON = Path(__file__).resolve().parents[2]
RUN_SH = ADDON / "run.sh"
BASH = shutil.which("bash")
FAKE_BASHIO_FUNCTIONS = ("bashio::config", "bashio::config.true", "bashio::config.has_value", "bashio::log.info", "bashio::log.warning")

PRELUDE = r"""
# the shell options the real /usr/bin/bashio sets before it sources the script (read from the add-on image, base Alpine)
set -o errexit -o errtrace -o nounset -o pipefail
shopt -s inherit_errexit 2>/dev/null || true
__opt() { local k="FAKE_OPT_${1}"; printf '%s' "${!k-}"; }
bashio::config() { local v; v="$(__opt "$1")"; if [ -z "$v" ] && [ "$#" -ge 2 ]; then v="$2"; fi; printf '%s' "$v"; }
bashio::config.true() { [ "$(__opt "$1")" = "true" ]; }
bashio::config.has_value() { [ -n "$(__opt "$1")" ]; }
bashio::log.info() { printf 'INFO: %s\n' "$*" >> "$FAKE_LOG"; }
bashio::log.warning() { printf 'WARNING: %s\n' "$*" >> "$FAKE_LOG"; }
command_not_found_handle() { printf '%s\n' "$1" >> "$FAKE_MISSING"; return 127; }
cd() { if [ "$1" = /app ]; then builtin cd "$FAKE_APP"; else builtin cd "$@"; fi; }
"""

FAKE_PYTHON = """#!/bin/sh
pwd > "$FAKE_OUT/cwd"
printf '%s\\n' "$@" > "$FAKE_OUT/argv"
env > "$FAKE_OUT/env"
exit 0
"""

pytestmark = pytest.mark.skipif(BASH is None, reason="needs bash")


def _run(tmp_path: Path, run_sh: Path = RUN_SH, **options: str) -> tuple[subprocess.CompletedProcess, Path]:
    app, out, fake_bin = tmp_path / "app", tmp_path / "out", tmp_path / "bin"
    for d in (app, out, fake_bin):
        d.mkdir()
    py = fake_bin / "python3"
    py.write_text(FAKE_PYTHON, encoding="utf-8", newline="\n")
    py.chmod(0o755)
    prelude = tmp_path / "fake_bashio.sh"
    prelude.write_text(PRELUDE, encoding="utf-8", newline="\n")
    env = {k: v for k, v in os.environ.items() if not k.startswith(("SW_", "FAKE_", "PYTHONFAULTHANDLER"))}
    env.update(PATH=f"{fake_bin}{os.pathsep}{env.get('PATH', '')}", FAKE_APP=str(app), FAKE_OUT=str(out),
               FAKE_LOG=str(tmp_path / "log"), FAKE_MISSING=str(tmp_path / "missing"))
    env.update({f"FAKE_OPT_{k}": v for k, v in options.items()})
    # run.sh as the real interpreter would run it: the script's own text, in one bash, after bashio's functions are defined
    p = subprocess.run([BASH, "-c", 'source "$1"; source "$2"', "run_sh_sandbox", str(prelude), str(run_sh)],
                       capture_output=True, text=True, timeout=60, env=env, cwd=str(tmp_path))
    return p, out


def _env(out: Path) -> dict[str, str]:
    pairs = (line.split("=", 1) for line in (out / "env").read_text(encoding="utf-8").splitlines() if "=" in line)
    return {k: v for k, v in pairs}


def test_run_sh_is_the_image_entrypoint_text_it_claims() -> None:
    raw = RUN_SH.read_bytes()
    assert b"\r\n" not in raw, "a CRLF line end breaks the shebang inside the image"
    assert raw.startswith(b"#!/usr/bin/with-contenv bashio\n")
    used = set(re.findall(r"bashio::[A-Za-z_.]+", raw.decode("utf-8")))
    assert used <= set(FAKE_BASHIO_FUNCTIONS), f"run.sh calls bashio functions this sandbox does not know: {sorted(used - set(FAKE_BASHIO_FUNCTIONS))}"
    docker = (ADDON / "Dockerfile").read_text(encoding="utf-8")
    assert "COPY run.sh /run.sh" in docker and "chmod a+x /run.sh" in docker and 'CMD [ "/run.sh" ]' in docker


def test_run_sh_starts_the_crash_guard_with_the_options(tmp_path: Path) -> None:
    p, out = _run(tmp_path, log_level="debug", frigate_enabled="true", bootstrap_admin_username="admin")
    assert p.returncode == 0, p.stdout + p.stderr
    assert not (tmp_path / "missing").exists(), (tmp_path / "missing").read_text(encoding="utf-8")
    assert (out / "argv").read_text(encoding="utf-8").split() == ["-m", "smplwise.crashguard"]
    assert Path((out / "cwd").read_text(encoding="utf-8").strip()).name == "app", "the server starts in /app"
    env = _env(out)
    assert (env.get("SW_LOG_LEVEL"), env.get("SW_FRIGATE"), env.get("PYTHONFAULTHANDLER")) == ("debug", "1", "1")
    log = (tmp_path / "log").read_text(encoding="utf-8")
    assert "starting on port 8099" in log and "WARNING" not in log


def test_run_sh_defaults_and_warns_without_a_bootstrap_admin(tmp_path: Path) -> None:
    p, out = _run(tmp_path)
    assert p.returncode == 0, p.stdout + p.stderr
    assert not (tmp_path / "missing").exists()
    env = _env(out)
    assert (env.get("SW_LOG_LEVEL"), env.get("SW_FRIGATE")) == ("info", "0")
    assert "WARNING: bootstrap_admin_username is empty" in (tmp_path / "log").read_text(encoding="utf-8")


def test_the_sandbox_catches_a_bashio_typo(tmp_path: Path) -> None:
    """The sandbox itself: a run.sh that calls a function bashio does not have is caught (the class of defect the review names)."""
    broken = tmp_path / "run_typo.sh"
    broken.write_text(RUN_SH.read_text(encoding="utf-8").replace("bashio::config 'log_level'", "bashio::confg 'log_level'"),
                      encoding="utf-8", newline="\n")
    _run(tmp_path, broken)
    assert (tmp_path / "missing").read_text(encoding="utf-8").split() == ["bashio::confg"]
