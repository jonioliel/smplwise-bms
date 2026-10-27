"""SUPPLIERDOCS-297: the tier-1 text source - poppler's `pdftotext` (poppler-utils is already in the add-on image for plan rendering;
no new dependency, a GPL tool used as a separate process, see docs/security/DEPENDENCY_AND_SECRETS_AUDIT.md).

The PDF already passed the tickets cost-file check when it was attached (no active content, no encryption, <= 10 MiB). That check is
a filter, not a guarantee, and poppler now PARSES the file - so the child runs with the minimal environment (no SUPERVISOR_TOKEN, no
secret), a wall-clock timeout, a page cap passed to the tool (`-l max+1`, so one page over the cap is detected without reading the
rest) and a cap on the text it may return. Process RLIMITs and a process-group kill are the hardening slice's work (CR-OCR119 S4)
and a security review gates `docread.enabled` before it may be switched on in a release."""
from __future__ import annotations

import shutil
import subprocess
import threading
import time
from pathlib import Path

from ..child_env import minimal_env
from .ports import TextResult

TIMEOUT_S = 20
OUTPUT_MAX = 1024 * 1024  # 1 MiB of text
MIN_TEXT_CHARS = 10       # fewer visible characters than this = no usable text layer (a scan)


def run_capped(cmd: list[str], *, timeout_s: float, cap: int) -> tuple[str, int, bytes]:
    """Run a child and read at most `cap` + 1 bytes of its stdout (security review SUPPLIERDOCS2-297, finding F2): the output is never
    buffered whole, so a decompression-bomb PDF cannot make the add-on hold hundreds of MiB. The child is killed as soon as it writes
    more than `cap` bytes or the wall-clock `timeout_s` passes; stderr is discarded (never logged). Returns (status, returncode, stdout)
    with status `ok` | `too_big` | `timeout` | `unavailable`."""
    try:
        proc = subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=minimal_env())
    except OSError:
        return "unavailable", -1, b""
    deadline = time.monotonic() + timeout_s
    box: dict[str, bytes] = {}

    def pump() -> None:
        try:
            box["out"] = proc.stdout.read(cap + 1) if proc.stdout else b""
        except (OSError, ValueError):
            box["out"] = b""

    t = threading.Thread(target=pump, name="docread-pdftotext", daemon=True)
    t.start()
    try:
        t.join(max(deadline - time.monotonic(), 0.0))
        if t.is_alive():
            return "timeout", -1, b""
        out = box.get("out", b"")
        if len(out) > cap:
            return "too_big", -1, b""
        try:
            rc = proc.wait(timeout=max(deadline - time.monotonic(), 0.1))
        except subprocess.TimeoutExpired:
            return "timeout", -1, b""
        return "ok", rc, out
    finally:
        if proc.poll() is None:
            proc.kill()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                pass
        if proc.stdout:
            try:
                proc.stdout.close()
            except OSError:
                pass
        t.join(1.0)


class PdftotextReader:
    name = "pdftotext"

    def __init__(self, timeout_s: int = TIMEOUT_S) -> None:
        self.timeout_s = min(max(int(timeout_s), 1), 30)

    def read(self, path: Path, *, max_pages: int) -> TextResult:
        tool = shutil.which("pdftotext")
        if not tool:
            return TextResult(status="unavailable")
        cmd = [tool, "-layout", "-enc", "UTF-8", "-q", "-f", "1", "-l", str(max_pages + 1), str(path), "-"]
        status, rc, out = run_capped(cmd, timeout_s=self.timeout_s, cap=OUTPUT_MAX)
        if status == "timeout":
            return TextResult(status="timeout", engine=self.name)
        if status == "unavailable":
            return TextResult(status="unavailable")
        if status != "ok" or rc != 0:
            return TextResult(status="unreadable", engine=self.name)
        text = out.decode("utf-8", errors="replace")
        pages = text.count("\f") or (1 if text.strip() else 0)
        if pages > max_pages:
            return TextResult(status="too_many_pages", pages=pages, engine=self.name)
        if sum(1 for ch in text if not ch.isspace()) < MIN_TEXT_CHARS:
            return TextResult(status="no_text", pages=pages, engine=self.name)
        return TextResult(status="ok", text=text, pages=pages, engine=self.name)
