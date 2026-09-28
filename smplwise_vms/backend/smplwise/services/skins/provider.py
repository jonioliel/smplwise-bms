"""Image providers for AI-rendered floor skins (CR-006 phase 2, slice 2a).

A provider turns a control image - our own deterministic level-2 isometric render of a floor, labels stripped - and a
prompt into one image. The interface is provider-agnostic (`SkinProvider`); one implementation exists at a time, the
first being OpenAI's image edit endpoint (owner decision 2026-09-28, CR-006 7.1 (a); Claude does not generate images).

External-service rules, the go2rtc adapter's way (services/go2rtc.py): the API key is an add-on option (`openai_api_key`,
config.Settings) - never stored in the database, never logged, never in an audit row or an error payload; every text
that may carry it passes through `redact` before it leaves this module. Nothing is sent from here on its own: the
caller (routers/skins.py) holds the privacy acknowledgement, the budget and the audit trail, and in slice 2a the only
caller that sends is the owner's connection test with a synthetic 64x64 pattern.

The request shape was checked on 2026-09-28 against OpenAI's official material: the image-generation guide's edit
example (developers.openai.com/api/docs/guides/image-generation: POST https://api.openai.com/v1/images/edits,
multipart/form-data, `Authorization: Bearer`, fields `model`, `image[]` (file), `prompt`) and the official Python SDK
(openai-python `types/image_edit_params.py`: `size`, `quality`, `output_format`, `n`; `types/images_response.py`:
`data[].b64_json`, `usage.input_tokens/output_tokens/total_tokens`, `created`). Per-image prices were NOT verifiable
from the pricing page (it lists token prices only): `estimate()` is a rough, clearly labelled figure; the reply's
token usage is recorded as the fact.
"""
from __future__ import annotations

import base64
import re
from dataclasses import dataclass, field
from typing import Any, Protocol

import httpx

OPENAI_BASE_URL = "https://api.openai.com/v1"
OPENAI_EDIT_PATH = "/images/edits"
# The SDK's documented default for the edit endpoint; the installation may choose another GPT image model (skins.model).
OPENAI_DEFAULT_MODEL = "gpt-image-1.5"
# Sizes the GPT image models accept for edits (SDK Literal); a custom WxH is also allowed, but we keep to the fixed set so
# the answer has the control image's pixel grid (the masks of 2c project 1:1).
OPENAI_SIZES = ("1024x1024", "1536x1024", "1024x1536")
QUALITIES = ("low", "medium", "high")
# NEEDS_VERIFICATION: a rough per-image estimate in USD by quality for a 1024-class square, scaled by the pixel count.
# Not from a price list (the pricing page gives token prices only); shown as an estimate, never as a charge.
_EST_USD = {"low": 0.02, "medium": 0.07, "high": 0.25}
MAX_REPLY_BYTES = 40 * 1024 * 1024
_SK_RE = re.compile(r"sk-[A-Za-z0-9_\-]{6,}")
_BEARER_RE = re.compile(r"(?i)(bearer\s+)[^\s\"',]+")


def redact(text: str, *secrets: str | None) -> str:
    """Remove every secret (and anything shaped like an OpenAI key or a bearer token) from a text before it is logged,
    audited or returned: the go2rtc.redact_url rule for credentials in URLs, applied to free text."""
    out = text
    for s in secrets:
        if s and len(s) >= 4:
            out = out.replace(s, "***")
    out = _SK_RE.sub("sk-***", out)
    return _BEARER_RE.sub(r"\1***", out)


@dataclass(frozen=True)
class RenderOptions:
    size: str = "1536x1024"
    quality: str = "medium"
    model: str | None = None  # None = the provider's configured model


@dataclass
class RenderResult:
    """One answer of a provider. `image` is None when the reply carried no picture (a test may still count as sent)."""
    image: bytes | None
    provider: str
    model: str
    cost_estimate_usd: float
    http_status: int
    usage: dict[str, Any] = field(default_factory=dict)
    request_id: str | None = None

    def describe(self) -> dict[str, Any]:
        return {"provider": self.provider, "model": self.model, "http_status": self.http_status, "cost_estimate_usd": self.cost_estimate_usd,
                "usage": self.usage, "request_id": self.request_id, "image_bytes": len(self.image) if self.image else 0}


class SkinProviderError(Exception):
    """A provider refused or failed. `message` is already redacted; `http_status` is the provider's (0 = no reply)."""

    def __init__(self, code: str, message: str, http_status: int = 0, provider_code: str | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.http_status = http_status
        self.provider_code = provider_code


class SkinProvider(Protocol):
    id: str
    model: str

    def render(self, control_png: bytes, prompt: str, options: RenderOptions) -> RenderResult: ...

    def estimate(self, options: RenderOptions) -> dict[str, Any]: ...

    def capabilities(self) -> dict[str, Any]: ...


def _pixels(size: str) -> int:
    w, h = (int(v) for v in size.split("x"))
    return w * h


class OpenAIImageProvider:
    """OpenAI's image edit endpoint with one input image (the control image). `transport` is for tests only (an
    httpx.MockTransport); production uses the network."""

    id = "openai"
    name = "OpenAI Images (edit)"

    def __init__(self, api_key: str | None, model: str | None = None, base_url: str = OPENAI_BASE_URL, transport: httpx.BaseTransport | None = None, timeout_s: float = 180.0):
        # without a key the provider still describes itself (capabilities, estimate); render() refuses
        self._key = api_key or ""
        self.model = model or OPENAI_DEFAULT_MODEL
        self.base_url = base_url.rstrip("/")
        self._transport = transport
        self._timeout = httpx.Timeout(timeout_s, connect=10.0)

    def capabilities(self) -> dict[str, Any]:
        return {"provider": self.id, "name": self.name, "model": self.model, "endpoint": f"{self.base_url}{OPENAI_EDIT_PATH}",
                "input": "one PNG control image + a text prompt", "sizes": list(OPENAI_SIZES), "qualities": list(QUALITIES), "output": "png",
                "image_to_image": True, "masks": False}

    def estimate(self, options: RenderOptions) -> dict[str, Any]:
        if options.quality not in _EST_USD or options.size not in OPENAI_SIZES:
            raise ValueError("unsupported options")
        usd = round(_EST_USD[options.quality] * _pixels(options.size) / (1024 * 1024), 4)
        return {"cost_estimate_usd": usd, "basis": "estimate_unverified", "model": options.model or self.model, "size": options.size, "quality": options.quality}

    def _client(self) -> httpx.Client:
        kw: dict[str, Any] = {"base_url": self.base_url, "timeout": self._timeout}
        if self._transport is not None:
            kw["transport"] = self._transport
        return httpx.Client(**kw)

    def render(self, control_png: bytes, prompt: str, options: RenderOptions) -> RenderResult:
        if not self._key:
            raise SkinProviderError("key_missing", "מפתח ה־API של OpenAI לא הוגדר באפשרויות ה־Add-on (openai_api_key).")
        if options.size not in OPENAI_SIZES or options.quality not in QUALITIES:
            raise SkinProviderError("bad_options", "גודל או איכות שאינם נתמכים.")
        model = options.model or self.model
        data = {"model": model, "prompt": prompt, "size": options.size, "quality": options.quality, "output_format": "png", "n": "1"}
        files = {"image[]": ("control.png", control_png, "image/png")}
        est = self.estimate(options)["cost_estimate_usd"]
        try:
            with self._client() as c:
                r = c.post(OPENAI_EDIT_PATH, data=data, files=files, headers={"Authorization": f"Bearer {self._key}"})
        except httpx.HTTPError as exc:
            raise SkinProviderError("provider_unreachable", redact(f"{type(exc).__name__}: {exc}", self._key)[:300]) from None
        request_id = r.headers.get("x-request-id")
        if r.status_code >= 400:
            msg, pcode = "", None
            try:
                err = r.json().get("error") or {}
                msg, pcode = str(err.get("message") or ""), (str(err.get("code") or err.get("type") or "") or None)
            except ValueError:
                msg = r.text[:200]
            raise SkinProviderError("provider_refused", redact(msg, self._key)[:300] or f"HTTP {r.status_code}", r.status_code, pcode)
        if len(r.content) > MAX_REPLY_BYTES:
            raise SkinProviderError("reply_too_large", "תשובת הספק גדולה מהמותר.", r.status_code)
        try:
            body = r.json()
        except ValueError:
            raise SkinProviderError("bad_reply", "תשובת הספק אינה JSON.", r.status_code) from None
        image = None
        items = body.get("data") or []
        if items and isinstance(items[0], dict) and items[0].get("b64_json"):
            try:
                image = base64.b64decode(items[0]["b64_json"], validate=True)
            except ValueError:
                raise SkinProviderError("bad_reply", "התמונה בתשובת הספק אינה base64 תקין.", r.status_code) from None
        usage = body.get("usage") if isinstance(body.get("usage"), dict) else {}
        keep = {k: usage[k] for k in ("input_tokens", "output_tokens", "total_tokens") if isinstance(usage.get(k), int)}
        return RenderResult(image=image, provider=self.id, model=model, cost_estimate_usd=est, http_status=r.status_code, usage=keep, request_id=request_id)


PROVIDERS = ("openai",)


def make_provider(provider_id: str, api_key: str | None, model: str | None) -> SkinProvider:
    if provider_id != "openai":
        raise SkinProviderError("provider_unknown", "ספק רינדור לא מוכר.")
    return OpenAIImageProvider(api_key, model)
