"""SUPPLIERDOCS-297: the seams of document reading. Three ports, each with a NULL implementation:

* `TextLayerReader` - the text of a PDF that HAS a text layer (tier 1). Real implementation: `pdftext.PdftotextReader` (poppler's
  `pdftotext`, already in the add-on image). Null: `NullTextReader` (no binary: the route answers 503 `reader_unavailable`).
* `OcrReader` - the text of a picture or a scanned PDF (tier 2, NOT in this slice). Only `NullOcrReader` exists: such a file ends in
  the state `needs_ocr`. A later slice plugs Tesseract (or a separate OCR add-on) in here, with the same `TextResult` contract, so the
  rules and the confirmation flow stay unchanged.
* `ModelExtractor` - an external or LAN model that turns text into fields (tier 3). Only `NullModelExtractor` exists and nothing selects
  it: no document leaves the add-on, no model is called. Adding one needs a separate owner decision (privacy paper, consent, review).

Every port returns DATA; the caller validates it (length caps, control characters) before anything is stored."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal, Protocol

SNIPPET_MAX = 80
VALUE_MAX = 120

TextStatus = Literal["ok", "no_text", "unreadable", "too_many_pages", "timeout", "unavailable", "ocr_not_available"]
Confidence = Literal["high", "medium", "low", "none"]


@dataclass(frozen=True)
class TextResult:
    status: TextStatus
    text: str = ""
    pages: int = 0
    engine: str = "none"


@dataclass(frozen=True)
class FieldSuggestion:
    """One proposed field: the parsed value (None = not found), how sure the rules are, the label it was found next to and a short
    source snippet (at most SNIPPET_MAX characters, scrubbed of id / bank numbers) so the screen can show where it came from."""
    value: str | None = None
    confidence: Confidence = "none"
    evidence: str = ""
    snippet: str = ""

    def as_json(self) -> dict[str, object]:
        return {"value": self.value, "confidence": self.confidence, "evidence": self.evidence, "snippet": self.snippet}


@dataclass(frozen=True)
class Extraction:
    fields: dict[str, FieldSuggestion]
    summary: Literal["good", "partial", "none"]
    flags: tuple[str, ...] = field(default_factory=tuple)

    def as_json(self) -> dict[str, object]:
        return {"fields": {k: v.as_json() for k, v in self.fields.items()}, "summary": self.summary, "flags": list(self.flags)}


class TextLayerReader(Protocol):
    name: str

    def read(self, path: Path, *, max_pages: int) -> TextResult: ...


class OcrReader(Protocol):
    name: str

    def read(self, path: Path, *, max_pages: int) -> TextResult: ...


class ModelExtractor(Protocol):
    name: str

    def extract(self, text: str, kind: str) -> dict[str, FieldSuggestion]: ...


class NullTextReader:
    name = "none"

    def read(self, path: Path, *, max_pages: int) -> TextResult:  # noqa: ARG002 - the port's signature
        return TextResult(status="unavailable")


class NullOcrReader:
    """Tier 2 is not in this slice: a picture or a scanned page is never read."""
    name = "none"

    def read(self, path: Path, *, max_pages: int) -> TextResult:  # noqa: ARG002
        return TextResult(status="ocr_not_available")


class NullModelExtractor:
    """Tier 3 is not built: the seam exists, nothing is ever sent anywhere."""
    name = "none"

    def extract(self, text: str, kind: str) -> dict[str, FieldSuggestion]:  # noqa: ARG002
        return {}
