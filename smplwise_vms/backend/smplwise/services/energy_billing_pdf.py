"""CR-023 P2/P3 seam: the billing API renders a bill snapshot to PDF through this one function. The renderer is
`services/bill_pdf.render_bill_pdf(snapshot, *, logo=None, watermark=None) -> bytes` (docs/architecture/ELECTRICITY_BILL_PDF.md):
a blocking call that starts an isolated child process, so callers run it in a worker thread (the PDF route is a plain `def`
route, which FastAPI runs in its thread pool). Tests register a fake with `set_renderer`, or `UNAVAILABLE` to simulate a build
without any PDF engine.

Errors (ELECTRICITY_BILL_PDF.md section 1): `PdfUnavailable` (no engine in this build: 503 pdf_unavailable) and
`PdfFailed(code, retryable, status)`: pdf_render_failed / pdf_timeout -> 503 retryable, pdf_page_limit / pdf_too_large -> 422
not retryable; a malformed snapshot (a caller bug) -> 503 pdf_render_failed, not retryable."""
from __future__ import annotations

import inspect
import logging
from typing import Any, Callable

log = logging.getLogger("smplwise.energy_billing")

Renderer = Callable[..., bytes]
_RENDERER: Renderer | None = None


class PdfUnavailable(Exception):
    pass


class PdfFailed(Exception):
    STATUS = {"pdf_render_failed": 503, "pdf_timeout": 503, "pdf_page_limit": 422, "pdf_too_large": 422}

    def __init__(self, code: str = "pdf_render_failed", retryable: bool = True):
        super().__init__(code)
        self.code = code if code in self.STATUS else "pdf_render_failed"
        self.retryable = retryable
        self.status = self.STATUS[self.code]


def UNAVAILABLE(snapshot: dict[str, Any], **_kw: Any) -> bytes:  # noqa: N802 - a sentinel renderer for tests
    raise PdfUnavailable()


def set_renderer(fn: Renderer | None) -> None:
    """A test renderer; None returns to the real one (services/bill_pdf)."""
    global _RENDERER
    _RENDERER = fn


def _real() -> Renderer | None:
    try:
        from . import bill_pdf
    except ImportError:  # pragma: no cover - the renderer module is part of the add-on
        return None
    st = bill_pdf.engine_status()
    if st.get("checked") and st.get("active") is None:
        return None  # the start-up self-check found no working engine
    return bill_pdf.render_bill_pdf


def engine_status() -> dict[str, Any] | None:
    """The active PDF engine for the API (None while a test renderer is registered)."""
    if _RENDERER is not None:
        return None
    try:
        from . import bill_pdf
    except ImportError:  # pragma: no cover
        return None
    s = bill_pdf.engine_status()
    return {"configured": s["configured"], "active": s["active"], "checked": s["checked"], "detail": s["detail"],
            "last_render_engine": s["last_render_engine"], "slow_fallbacks": s["slow_fallbacks"], "fallback_after_s": s["fallback_after_s"]}


def available() -> bool:
    if _RENDERER is UNAVAILABLE:
        return False
    return _RENDERER is not None or _real() is not None


def render(snapshot: dict[str, Any], *, logo: bytes | None = None, watermark: str | None = None) -> bytes:
    fn = _RENDERER or _real()
    if fn is None:
        raise PdfUnavailable()
    try:
        params = inspect.signature(fn).parameters
        kwargs: dict[str, Any] = {}
        if "logo" in params or any(p.kind is p.VAR_KEYWORD for p in params.values()):
            kwargs["logo"] = logo
        if "watermark" in params or any(p.kind is p.VAR_KEYWORD for p in params.values()):
            kwargs["watermark"] = watermark
    except (TypeError, ValueError):
        kwargs = {}
    try:
        out = fn(snapshot, **kwargs)
    except PdfUnavailable:
        raise
    except Exception as exc:  # noqa: BLE001 - any renderer failure keeps the bill's state
        code = getattr(exc, "code", None)
        retryable = getattr(exc, "retryable", True)
        if type(exc).__name__ == "BillSnapshotError":
            code, retryable = "pdf_render_failed", False
        log.warning("bill PDF render failed: %s %s", type(exc).__name__, code or "")
        raise PdfFailed(code if isinstance(code, str) else "pdf_render_failed", bool(retryable)) from None
    if not isinstance(out, (bytes, bytearray)) or not bytes(out).startswith(b"%PDF"):
        raise PdfFailed()
    return bytes(out)
