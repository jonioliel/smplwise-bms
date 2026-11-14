"""CR-021 S4 (D8): the `[platform-restart]` marker of the add-on's own CHANGELOG becomes the "restart required" reason `release`.

Convention: a release that needs one restart of the platform core after it is installed carries a line containing the literal
`[platform-restart]` inside its own `## <version> ...` section of `smplwise_vms/CHANGELOG.md` (the bilingual notes may put it in either
language block). The image carries that file (`Dockerfile`: `COPY CHANGELOG.md /app/CHANGELOG.md`), so the check is local: no
infrastructure call, no upstream text. Only the RUNNING version's section is read.

At start (`main.py`, after `update_runs.on_startup`) `note_release_restart` adds the reason once per version: the settings row
`platform_restart.release_noted` remembers the version it was added for, so a reason that a successful platform restart cleared is
not added again on the next start of the same version. Never raises into the start-up.

Never a trigger: the restart stays a separate, confirmed action of a `system.update` holder (owner decision D6)."""
from __future__ import annotations

import os
import re
import sqlite3
from pathlib import Path

from .. import __version__
from ..db import get_setting, set_setting
from . import platform_restart

MARKER = "[platform-restart]"
NOTED_KEY = "platform_restart.release_noted"
MAX_BYTES = 2 * 1024 * 1024
HEADING_RE = re.compile(r"^##\s+(\S+)")


def _candidates() -> list[Path]:
    here = Path(__file__).resolve()
    out: list[Path] = []
    env = os.environ.get("SW_CHANGELOG")
    if env:
        out.append(Path(env))
    out.append(here.parents[2] / "CHANGELOG.md")  # the image: /app/CHANGELOG.md next to /app/smplwise
    if len(here.parents) > 3:
        out.append(here.parents[3] / "CHANGELOG.md")  # the repository: smplwise_vms/CHANGELOG.md
    return out


def read_changelog(path: Path | None = None) -> str | None:
    for p in [path] if path is not None else _candidates():
        try:
            if p.is_file() and p.stat().st_size <= MAX_BYTES:
                return p.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
    return None


def section(text: str, version: str) -> list[str] | None:
    """The lines of the `## <version> ...` section (heading excluded), or None when the version has no section."""
    lines: list[str] | None = None
    for line in text.splitlines():
        m = HEADING_RE.match(line)
        if m:
            if lines is not None:
                break
            if m.group(1) == version:
                lines = []
            continue
        if lines is not None:
            lines.append(line)
    return lines


def flagged(text: str, version: str) -> bool:
    body = section(text, version)
    return body is not None and any(MARKER in line for line in body)


def note_release_restart(conn: sqlite3.Connection, version: str = __version__, *, path: Path | None = None) -> bool:
    """Adds the `release` reason when the running version's notes carry the marker and it was not added for this version before.
    Returns whether a reason was added."""
    if not isinstance(version, str) or not platform_restart.VERSION_RE.fullmatch(version):
        return False
    if get_setting(conn, NOTED_KEY) == version:
        return False
    text = read_changelog(path)
    if text is None or not flagged(text, version):
        return False
    platform_restart.add_reason(conn, "release", version)
    set_setting(conn, NOTED_KEY, version)
    return True
