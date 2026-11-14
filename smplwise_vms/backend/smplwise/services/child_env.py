"""The environment of every child process Arx starts (ffmpeg, pdftoppm, pdfinfo).

Security review of CR-021 S3 (2026-10-04): a child started without `env=` inherits the whole environment of the add-on, including
SUPERVISOR_TOKEN (worth the Supervisor `manager` role since S3) and any other secret. These tools parse input that others control (a floor
plan PDF, an NVR video stream), so a memory bug in a parser must never find a token. Every `subprocess` call of the product passes
`env=minimal_env()`; tests/test_self_update_s3_fixes.py has a guard that fails on a call without it.

Only the names in PASSED are copied from the parent (none of them carries a secret), plus a fixed `LANG`."""
from __future__ import annotations

import os

# PATH to find the tool; TZ for timestamps; the temp directory variables; and on Windows (a developer workstation) the system root that
# some tools need to start at all.
PASSED = ("PATH", "TZ", "TMPDIR", "TEMP", "TMP", "SYSTEMROOT", "WINDIR")
DEFAULT_PATH = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"


def minimal_env(extra: dict[str, str] | None = None) -> dict[str, str]:
    """`extra`: fixed, non-secret values a tool needs (e.g. the bill PDF renderer's PYTHONPATH and HOME=/tmp). Never pass values taken
    from the parent environment wholesale."""
    env = {name: os.environ[name] for name in PASSED if os.environ.get(name)}
    env.setdefault("PATH", DEFAULT_PATH)
    env["LANG"] = "C.UTF-8"
    if extra:
        env.update(extra)
    return env
