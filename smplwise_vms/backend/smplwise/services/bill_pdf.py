"""Electricity bill PDF (CR-023 P3): `render_bill_pdf(snapshot) -> bytes`.

The bill is a consumption bill and payment demand (not a tax invoice). The renderer is a pure function of the frozen
bill snapshot: it never reads the database, the clock, settings or the network, and never recomputes an amount.

The render runs in a child process (`python -m smplwise.services.bill_pdf_engine`) with a wall-clock timeout, CPU,
address-space and file-size limits, a scrubbed environment and its own process group, so a hostile bill or a library
fault can neither hang nor exhaust the add-on. Limits (all overridable through the environment, see `_limits`):
timeout 20 s, 1.5 GiB address space, 40 pages, 10 MB of PDF. Engine: WeasyPrint, with fpdf2 as the fallback when the
WeasyPrint stack cannot load on the target (SW_BILL_PDF_ENGINE = auto | weasyprint | fpdf2).
"""
from __future__ import annotations

import base64
import json
import logging
import os
import re
import signal
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

from .bill_pdf_logo import LogoError, sanitize_logo
from .bill_pdf_model import NUMBER_RE, BillSnapshot, BillSnapshotError

log = logging.getLogger("smplwise.bill_pdf")

__all__ = ["render_bill_pdf", "bill_pdf_filename", "BillPdfError", "BillSnapshotError", "LogoError", "sanitize_logo"]

_PACKAGE_PARENT = str(Path(__file__).resolve().parent.parent.parent)
_STDERR_KEEP = 2000


class BillPdfError(Exception):
    """Rendering failed. `code` is stable for the API: pdf_render_failed (retryable, 503), pdf_timeout (retryable),
    pdf_page_limit and pdf_too_large (not retryable: the bill is beyond the limits)."""

    def __init__(self, code: str, retryable: bool = True):
        super().__init__(code)
        self.code = code
        self.retryable = retryable


@dataclass(frozen=True)
class _Limits:
    timeout_s: float
    memory_bytes: int
    max_pages: int
    max_pdf_bytes: int
    engine: str


def _env_number(name: str, default: float, low: float, high: float) -> float:
    try:
        return min(max(float(os.environ.get(name, default)), low), high)
    except ValueError:
        return default


def _limits(timeout_s: float | None, engine: str | None) -> _Limits:
    chosen = (engine or os.environ.get("SW_BILL_PDF_ENGINE") or "auto").lower()
    if chosen not in ("auto", "weasyprint", "fpdf2"):
        chosen = "auto"
    return _Limits(
        timeout_s=timeout_s if timeout_s else _env_number("SW_BILL_PDF_TIMEOUT_S", 20, 1, 120),
        memory_bytes=int(_env_number("SW_BILL_PDF_MEMORY_MB", 1536, 256, 8192)) * 1024 * 1024,
        max_pages=int(_env_number("SW_BILL_PDF_MAX_PAGES", 40, 1, 200)),
        max_pdf_bytes=10 * 1024 * 1024,
        engine=chosen)


def bill_pdf_filename(number: str | None) -> str:
    """ASCII-only download name built from the bill number, never from user text: bill-2026-12-0001.pdf.
    A running suffix "/2" becomes "_2" (2026-12-0001/2-2 -> bill-2026-12-0001_2-2.pdf); no number (a draft) -> bill-draft.pdf."""
    if number and NUMBER_RE.fullmatch(number):
        return f"bill-{number.replace('/', '_')}.pdf"
    return "bill-draft.pdf"


def _child_setup(limits: _Limits):  # pragma: no cover - runs in the forked child
    def apply() -> None:
        import resource

        resource.setrlimit(resource.RLIMIT_AS, (limits.memory_bytes, limits.memory_bytes))
        cpu = int(limits.timeout_s) + 5
        resource.setrlimit(resource.RLIMIT_CPU, (cpu, cpu))
        resource.setrlimit(resource.RLIMIT_FSIZE, (limits.max_pdf_bytes + 1_000_000, limits.max_pdf_bytes + 1_000_000))
    return apply


def _child_env() -> dict[str, str]:
    """A scrubbed environment: no tokens, no proxy settings, nothing of the add-on's configuration."""
    env = {"PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"), "PYTHONPATH": _PACKAGE_PARENT,
           "HOME": "/tmp", "LANG": "C.UTF-8", "PYTHONUNBUFFERED": "1", "PYTHONDONTWRITEBYTECODE": "1",
           "XDG_CACHE_HOME": "/tmp"}
    for keep in ("SYSTEMROOT", "TEMP", "TMP", "LD_LIBRARY_PATH", "FONTCONFIG_PATH", "FONTCONFIG_FILE"):
        if keep in os.environ:
            env[keep] = os.environ[keep]
    return env


def render_bill_pdf(snapshot: Mapping[str, Any], *, logo: bytes | None = None, watermark: str | None = None,
                    timeout_s: float | None = None, engine: str | None = None) -> bytes:
    """Render one bill to PDF bytes (the contract of ELECTRICITY_BILL_SNAPSHOT.md section 5).

    snapshot: the frozen bill snapshot v1 as parsed JSON. logo: the logo bytes (PNG or JPEG); they are decoded and
    re-encoded here, and a logo that fails the checks is dropped (the bill still renders: the logo is decoration).
    watermark: None | "draft" | "void" | "copy" (a draft snapshot is always marked "draft").
    Raises BillSnapshotError for a malformed snapshot (a caller bug) and BillPdfError for render failures."""
    BillSnapshot.from_billing_snapshot(snapshot, watermark=watermark)  # validate in the caller's process first
    limits = _limits(timeout_s, engine)
    logo_png: bytes | None = None
    if logo:
        try:
            logo_png = sanitize_logo(logo)
        except LogoError as exc:
            log.warning("bill logo dropped: %s", exc)
    job = {"snapshot": snapshot, "logo": base64.b64encode(logo_png).decode("ascii") if logo_png else None,
           "watermark": watermark, "max_pages": limits.max_pages, "engine": limits.engine}
    payload = json.dumps(job, default=str).encode("utf-8")

    kwargs: dict[str, Any] = {"stdin": subprocess.PIPE, "stdout": subprocess.PIPE, "stderr": subprocess.PIPE,
                              "env": _child_env(), "cwd": _PACKAGE_PARENT}
    if os.name == "posix":
        kwargs["start_new_session"] = True  # own process group: only this child tree is ever signalled
        kwargs["preexec_fn"] = _child_setup(limits)
    cmd = [sys.executable, "-s", "-m", "smplwise.services.bill_pdf_engine"]
    try:
        proc = subprocess.Popen(cmd, **kwargs)
    except OSError as exc:
        log.error("bill pdf: cannot start the render process: %s", exc)
        raise BillPdfError("pdf_render_failed") from exc
    try:
        out, err = proc.communicate(payload, timeout=limits.timeout_s)
    except subprocess.TimeoutExpired:
        _kill_group(proc)
        proc.communicate()
        log.error("bill pdf: render timed out after %.0f s", limits.timeout_s)
        raise BillPdfError("pdf_timeout") from None
    finally:
        if proc.poll() is None:  # defensive: never leave the child behind
            _kill_group(proc)
    tail = err.decode("utf-8", "replace")[-_STDERR_KEEP:].strip()
    if proc.returncode == 3:
        code = "pdf_too_large" if "pdf_too_large" in tail else "pdf_page_limit"
        raise BillPdfError(code, retryable=False)
    if proc.returncode != 0 or not out.startswith(b"%PDF-"):
        log.error("bill pdf: render failed (exit %s): %s", proc.returncode, tail[-400:])
        raise BillPdfError("pdf_render_failed")
    if len(out) > limits.max_pdf_bytes:
        raise BillPdfError("pdf_too_large", retryable=False)
    return out


def _kill_group(proc: subprocess.Popen) -> None:
    try:
        if os.name == "posix":
            os.killpg(proc.pid, signal.SIGKILL)  # the group created for this child (its pid is its pgid)
        else:
            proc.kill()
    except (ProcessLookupError, PermissionError):
        pass
