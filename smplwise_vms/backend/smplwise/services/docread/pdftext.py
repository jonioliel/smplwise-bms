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
from pathlib import Path

from ..child_env import minimal_env
from .ports import TextResult

TIMEOUT_S = 20
OUTPUT_MAX = 1024 * 1024  # 1 MiB of text
MIN_TEXT_CHARS = 10       # fewer visible characters than this = no usable text layer (a scan)


class PdftotextReader:
    name = "pdftotext"

    def __init__(self, timeout_s: int = TIMEOUT_S) -> None:
        self.timeout_s = min(max(int(timeout_s), 1), 30)

    def read(self, path: Path, *, max_pages: int) -> TextResult:
        tool = shutil.which("pdftotext")
        if not tool:
            return TextResult(status="unavailable")
        cmd = [tool, "-layout", "-enc", "UTF-8", "-q", "-f", "1", "-l", str(max_pages + 1), str(path), "-"]
        try:
            proc = subprocess.run(cmd, capture_output=True, timeout=self.timeout_s, check=False, env=minimal_env())
        except subprocess.TimeoutExpired:
            return TextResult(status="timeout", engine=self.name)
        except OSError:
            return TextResult(status="unavailable")
        out = proc.stdout or b""
        if proc.returncode != 0 or len(out) > OUTPUT_MAX:
            return TextResult(status="unreadable", engine=self.name)
        text = out.decode("utf-8", errors="replace")
        pages = text.count("\f") or (1 if text.strip() else 0)
        if pages > max_pages:
            return TextResult(status="too_many_pages", pages=pages, engine=self.name)
        if sum(1 for ch in text if not ch.isspace()) < MIN_TEXT_CHARS:
            return TextResult(status="no_text", pages=pages, engine=self.name)
        return TextResult(status="ok", text=text, pages=pages, engine=self.name)
