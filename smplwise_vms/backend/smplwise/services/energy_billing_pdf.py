"""CR-023 P2/P3 seam: the billing API renders a bill snapshot to PDF through this one function. The renderer itself is
the PDF branch's `render_bill_pdf(snapshot, *, logo=None, watermark=None) -> bytes` (docs/architecture/
ELECTRICITY_BILL_SNAPSHOT.md section 5). Tests register a fake with `set_renderer`."""
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
    pass


def set_renderer(fn: Renderer | None) -> None:
    global _RENDERER
    _RENDERER = fn


def _find() -> Renderer | None:
    if _RENDERER is not None:
        return _RENDERER
    for mod in ("energy_pdf", "energy_bill_pdf"):
        try:
            module = __import__(f"{__package__}.{mod}", fromlist=["render_bill_pdf"])
        except ImportError:
            continue
        fn = getattr(module, "render_bill_pdf", None)
        if callable(fn):
            return fn
    return None


def render(snapshot: dict[str, Any], *, logo: bytes | None = None, watermark: str | None = None) -> bytes:
    fn = _find()
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
    except Exception as exc:  # noqa: BLE001 - any renderer failure is a retryable 503, the bill keeps its state
        log.warning("bill PDF render failed: %s", type(exc).__name__)
        raise PdfFailed() from None
    if not isinstance(out, (bytes, bytearray)) or not bytes(out).startswith(b"%PDF"):
        raise PdfFailed()
    return bytes(out)
