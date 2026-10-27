"""ANNOUNCE-297 (voice announcements, stage C): a Hebrew announcement machine-translated into Arabic, English and Russian, for review before sending.

Nothing leaves the building by default:
- the feature is OFF (`announce.translate.enabled` false); while it is off, the provider is `off` or nobody approved the provider, `translate()`
  refuses before any provider is built, so no request is ever made. The default provider is `google` (ANNOUNCE2-297, owner 27.10: the free
  Google translation, no key); `cloud` (OpenAI-compatible, a key) stays selectable;
- turning it on needs an explicit APPROVAL recorded in the same request (`approve: true` by a `system.configure` holder: who and when are stored in
  `announce.translate.approval` and audited). The approval belongs to one provider; choosing another provider needs a new approval. The product rule
  is that the OWNER gives this approval; the server records the person who pressed it;
- the provider key is NEVER a setting: it lives in the in-app secrets store (services/secrets_store.py, name `announce_translate_key`, sealed per
  install, write-only in Settings) and is read per call; it is never logged, audited, returned or put in an exception.

Pluggable: a translator implements `Translator.translate(text, source, target) -> str`. `PROVIDERS` maps a provider name to a factory
`(conn, settings) -> Translator | None` (None = not ready, for example no key); `register()` adds one (a self-hosted engine later, a fake in tests).
The built-in `cloud` provider is an OpenAI-compatible chat endpoint at a FIXED https host (not a setting, so a setting can never point the key
somewhere else), through the seam `CLOUD_CALL(key, text, source, target) -> str`, which tests replace. `FakeTranslator` is deterministic and never
touches the network.

The answer is a DRAFT: the operator sees every translated text, may edit it, and sends it through the ordinary `POST /announcements` with the part
marked `machine: true`; the mark is stored with the announcement (`texts_json` third element `"mt"`), shown on the screens next to that language and
kept in the history and the audit. A translation is cached in memory (bounded, per process) by provider, languages and text, so the same Hebrew
sentence is not sent twice; a per-minute cap bounds the provider calls.
"""
from __future__ import annotations

import collections
import datetime as dt
import hashlib
import json
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Callable, Protocol

from ..db import get_setting

SOURCE = "he"
TARGETS = ("ar", "en", "ru")
# ANNOUNCE2-297 (owner 27.10): `google` = the free Google translation (no key; the default provider), `cloud` = the OpenAI-compatible provider
# (a key in the secrets store; selectable). The switch stays off and needs the recorded approval for the chosen provider either way.
PROVIDERS_KNOWN = ("off", "google", "cloud")
SECRET_NAME = "announce_translate_key"
K_ENABLED, K_PROVIDER, K_TARGETS, K_APPROVAL = "announce.translate.enabled", "announce.translate.provider", "announce.translate.targets", "announce.translate.approval"
DEFAULTS = {K_ENABLED: "false", K_PROVIDER: "google", K_TARGETS: json.dumps(list(TARGETS)), K_APPROVAL: ""}
SETTING_KEYS = ("enabled", "provider", "targets", "approve")
CLOUD_URL = "https://api.openai.com/v1/chat/completions"  # fixed on purpose: not a setting (the key can only ever go here)
CLOUD_MODEL = "gpt-4o-mini"
CLOUD_TIMEOUT_S = 15
MAX_ANSWER_BYTES = 64 * 1024
CALLS_PER_MINUTE = 20
CACHE_MAX = 256
CACHE_TTL_S = 7 * 24 * 3600
LANG_NAMES = {"he": "Hebrew", "ar": "Arabic", "en": "English", "ru": "Russian"}


class TranslateError(Exception):
    """A provider could not translate. `code` is a stable machine code; the message never carries a key, a text or a response body."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class Translator(Protocol):
    name: str

    def translate(self, text: str, source: str, target: str) -> str: ...


class FakeTranslator:
    """Deterministic and offline (tests, demos): `[ar] <text>`. Records every call so a test can prove the cache worked."""

    name = "fake"

    def __init__(self) -> None:
        self.calls: list[tuple[str, str, str]] = []

    def translate(self, text: str, source: str, target: str) -> str:
        self.calls.append((text, source, target))
        return f"[{target}] {text}"


def default_cloud_call(key: str, text: str, source: str, target: str) -> str:
    """The cloud call: one POST with the bearer key, a bounded wait and a bounded answer. Raises TranslateError with a code only."""
    prompt = (f"Translate the following public-address announcement from {LANG_NAMES[source]} to {LANG_NAMES[target]}. "
              "Answer with the translation only, one line, no quotes, no notes.")
    body = json.dumps({"model": CLOUD_MODEL, "temperature": 0, "messages": [{"role": "system", "content": prompt}, {"role": "user", "content": text}]}).encode()
    req = urllib.request.Request(CLOUD_URL, data=body, method="POST", headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=CLOUD_TIMEOUT_S) as resp:  # noqa: S310 - fixed https URL
            raw = resp.read(MAX_ANSWER_BYTES + 1)
    except urllib.error.HTTPError as exc:
        raise TranslateError("translate_rejected" if exc.code in (401, 403) else "translate_failed") from None
    except Exception:  # noqa: BLE001 - never carries the URL, the key or a body
        raise TranslateError("translate_unreachable") from None
    if not raw or len(raw) > MAX_ANSWER_BYTES:
        raise TranslateError("translate_failed")
    try:
        out = json.loads(raw)["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError):
        raise TranslateError("translate_failed") from None
    if not isinstance(out, str):
        raise TranslateError("translate_failed")
    return out


CLOUD_CALL = default_cloud_call  # tests replace it: no test reaches a cloud service

# ANNOUNCE2-297: the free Google translation (the endpoint Google's own web clients use; no key, no account). The host is fixed (not a setting);
# the text goes in the POST body, never in the address, so it is not in any access log or proxy URL.
GOOGLE_HOST = "translate.googleapis.com"
GOOGLE_URL = f"https://{GOOGLE_HOST}/translate_a/single"
GOOGLE_LANG = {"he": "iw", "ar": "ar", "en": "en", "ru": "ru"}  # Google's codes (Hebrew is "iw")


def default_google_call(text: str, source: str, target: str) -> str:
    """One POST to the fixed Google host; a bounded wait and a bounded answer. Raises TranslateError with a code only (never the text)."""
    query = urllib.parse.urlencode({"client": "gtx", "sl": GOOGLE_LANG[source], "tl": GOOGLE_LANG[target], "dt": "t", "ie": "UTF-8", "oe": "UTF-8"})
    body = urllib.parse.urlencode({"q": text}).encode()
    req = urllib.request.Request(f"{GOOGLE_URL}?{query}", data=body, method="POST",
                                 headers={"Content-Type": "application/x-www-form-urlencoded;charset=utf-8", "User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=CLOUD_TIMEOUT_S) as resp:  # noqa: S310 - fixed https URL
            raw = resp.read(MAX_ANSWER_BYTES + 1)
    except urllib.error.HTTPError as exc:
        raise TranslateError("translate_rate_limited" if exc.code == 429 else "translate_failed") from None
    except Exception:  # noqa: BLE001 - never carries the text or a body
        raise TranslateError("translate_unreachable") from None
    if not raw or len(raw) > MAX_ANSWER_BYTES:
        raise TranslateError("translate_failed")
    try:
        segments = json.loads(raw)[0]
        out = "".join(s[0] for s in segments if isinstance(s, list) and s and isinstance(s[0], str))
    except (ValueError, KeyError, IndexError, TypeError):
        raise TranslateError("translate_failed") from None
    if not out.strip():
        raise TranslateError("translate_failed")
    return out


GOOGLE_CALL = default_google_call  # tests replace it: no test reaches Google


class GoogleTranslator:
    name = "google"

    def translate(self, text: str, source: str, target: str) -> str:
        return GOOGLE_CALL(text, source, target)


class CloudTranslator:
    name = "cloud"

    def __init__(self, key: str) -> None:
        self._key = key

    def __repr__(self) -> str:  # the key is never printed
        return "CloudTranslator(key=***)"

    def translate(self, text: str, source: str, target: str) -> str:
        return CLOUD_CALL(self._key, text, source, target)


def key_of(conn: Any, settings: Any) -> str | None:
    """The provider key from the secrets store (a stored row decides; an unreadable or cleared row is None). Never logged."""
    from . import secrets_store

    if settings is None:
        return None
    try:
        return secrets_store.current_value(conn, settings, SECRET_NAME)
    except Exception:  # noqa: BLE001
        return None


def _build_cloud(conn: Any, settings: Any) -> Translator | None:
    key = key_of(conn, settings)
    return CloudTranslator(key) if key else None


PROVIDERS: dict[str, Callable[[Any, Any], "Translator | None"]] = {"google": lambda _conn, _settings: GoogleTranslator(), "cloud": _build_cloud}


def register(name: str, factory: Callable[[Any, Any], "Translator | None"]) -> None:
    """Add (or replace) a provider. A provider that sends text outside the building needs the same approval as `cloud`; every provider does."""
    PROVIDERS[name] = factory


# ---------------------------------------------------------------------------------------------------- settings

def _approval(raw: Any) -> dict[str, Any] | None:
    try:
        v = json.loads(raw or "")
    except ValueError:
        return None
    if not isinstance(v, dict) or not isinstance(v.get("provider"), str) or not isinstance(v.get("at"), str):
        return None
    return {"provider": v["provider"], "by": v.get("by") if isinstance(v.get("by"), str) else None, "at": v["at"]}


def _targets(raw: Any) -> list[str]:
    try:
        v = json.loads(raw or "[]")
    except ValueError:
        return list(TARGETS)
    out = [t for t in TARGETS if isinstance(v, list) and t in v]
    return out or list(TARGETS)


def config(conn: Any, settings: Any = None) -> dict[str, Any]:
    def g(k: str) -> str:
        return get_setting(conn, k, DEFAULTS[k]) or DEFAULTS[k]

    provider = g(K_PROVIDER)
    provider = provider if provider in PROVIDERS_KNOWN or provider in PROVIDERS else "off"
    approval = _approval(get_setting(conn, K_APPROVAL, ""))
    return {"enabled": g(K_ENABLED) == "true", "provider": provider, "source": SOURCE, "targets": _targets(g(K_TARGETS)),
            "approval": approval if approval and approval["provider"] == provider else None,
            "key_set": bool(key_of(conn, settings)) if provider == "cloud" else provider not in ("off",)}


def ready(cfg: dict[str, Any]) -> bool:
    """Whether a translation may be asked for: the switch on, a provider chosen, approved for that provider, and (cloud) a key stored."""
    return bool(cfg["enabled"] and cfg["provider"] != "off" and cfg["approval"] and cfg["key_set"])


def merge(conn: Any, settings: Any, body: Any, actor: str | None, now: dt.datetime) -> dict[str, str]:
    """PUT config `translate` (system.configure): every key optional. Returns the settings to store. Raises ValueError(field) on a bad value and
    ValueError("translate.approval_required") when the result would be ON for a provider nobody approved."""
    from .timeutil import iso_utc

    if not isinstance(body, dict) or not body or set(body) - set(SETTING_KEYS):
        raise ValueError("translate")
    cur = config(conn, settings)
    out: dict[str, str] = {}
    for name, value in body.items():
        if name in ("enabled", "approve"):
            if not isinstance(value, bool):
                raise ValueError(f"translate.{name}")
            if name == "enabled":
                out[K_ENABLED] = "true" if value else "false"
        elif name == "provider":
            if not isinstance(value, str) or value not in set(PROVIDERS_KNOWN) | set(PROVIDERS):
                raise ValueError("translate.provider")
            out[K_PROVIDER] = value
        else:  # targets
            if not isinstance(value, list) or not value or len(value) > len(TARGETS) or any(v not in TARGETS for v in value) or len(set(value)) != len(value):
                raise ValueError("translate.targets")
            out[K_TARGETS] = json.dumps([t for t in TARGETS if t in value])
    provider = out.get(K_PROVIDER, cur["provider"])
    if body.get("approve") is True:
        if provider == "off":
            raise ValueError("translate.provider")
        out[K_APPROVAL] = json.dumps({"provider": provider, "by": actor, "at": iso_utc(now)})
    approved = K_APPROVAL in out or (cur["approval"] is not None and cur["approval"]["provider"] == provider)
    if out.get(K_ENABLED, "true" if cur["enabled"] else "false") == "true" and provider != "off" and not approved:
        raise ValueError("translate.approval_required")
    return out


# ---------------------------------------------------------------------------------------------------- cache and cap

class _Cache:
    def __init__(self) -> None:
        self._d: collections.OrderedDict[str, tuple[float, str]] = collections.OrderedDict()
        self._lock = threading.Lock()

    @staticmethod
    def key(provider: str, source: str, target: str, text: str) -> str:
        return hashlib.sha256(f"{provider}\x00{source}\x00{target}\x00{text}".encode()).hexdigest()

    def get(self, k: str, now: float) -> str | None:
        with self._lock:
            hit = self._d.get(k)
            if hit is None:
                return None
            if now - hit[0] > CACHE_TTL_S:
                del self._d[k]
                return None
            self._d.move_to_end(k)
            return hit[1]

    def put(self, k: str, value: str, now: float) -> None:
        with self._lock:
            self._d[k] = (now, value)
            self._d.move_to_end(k)
            while len(self._d) > CACHE_MAX:
                self._d.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._d.clear()

    def __len__(self) -> int:
        return len(self._d)


CACHE = _Cache()
_CALLS: collections.deque[float] = collections.deque()
_CALLS_LOCK = threading.Lock()
CLOCK = time.monotonic  # tests may move it


def _take_call(now: float) -> bool:
    with _CALLS_LOCK:
        while _CALLS and now - _CALLS[0] > 60:
            _CALLS.popleft()
        if len(_CALLS) >= CALLS_PER_MINUTE:
            return False
        _CALLS.append(now)
        return True


def reset() -> None:
    """Forget the cache and the call window (a provider or key change; tests)."""
    CACHE.clear()
    with _CALLS_LOCK:
        _CALLS.clear()


# ---------------------------------------------------------------------------------------------------- translate

def translate(conn: Any, settings: Any, text: str, targets: list[str]) -> dict[str, Any]:
    """Draft translations of a cleaned Hebrew `text` into `targets`: `{provider, source, items: [{language, text, machine: true, cached}]}`.
    Raises TranslateError: `translate_off` (switch / provider / approval), `translate_not_configured` (provider not ready, e.g. no key), `translate_rate_limited`,
    or the provider's code. The cache is consulted first, so a cached text never reaches the provider."""
    cfg = config(conn, settings)
    if not (cfg["enabled"] and cfg["provider"] != "off" and cfg["approval"]):
        raise TranslateError("translate_off")
    if not cfg["key_set"]:
        raise TranslateError("translate_not_configured")
    provider = cfg["provider"]
    items: list[dict[str, Any]] = []
    engine: Translator | None = None
    now = CLOCK()
    for target in [t for t in TARGETS if t in targets]:
        k = CACHE.key(provider, SOURCE, target, text)
        hit = CACHE.get(k, now)
        if hit is not None:
            items.append({"language": target, "text": hit, "machine": True, "cached": True})
            continue
        if engine is None:
            factory = PROVIDERS.get(provider)
            engine = factory(conn, settings) if factory else None
            if engine is None:
                raise TranslateError("translate_not_configured")
        if not _take_call(now):
            raise TranslateError("translate_rate_limited")
        out = _clean(engine.translate(text, SOURCE, target))
        CACHE.put(k, out, now)
        items.append({"language": target, "text": out, "machine": True, "cached": False})
    return {"provider": provider, "source": SOURCE, "items": items}


def _clean(raw: Any) -> str:
    """A provider's answer as an announcement text: one line, the same cleaning as a typed text; empty or too long is a failure, never cut."""
    from .announcements import MAX_TEXT, clean_text

    if not isinstance(raw, str):
        raise TranslateError("translate_failed")
    line = " ".join(raw.split()).strip().strip('"').strip()
    if not line:
        raise TranslateError("translate_failed")
    if len(line) > MAX_TEXT:
        raise TranslateError("translate_too_long")  # longer than an announcement may be: the operator shortens the Hebrew text
    try:
        return clean_text(line)
    except Exception:  # noqa: BLE001 - an ApiError text_invalid: the provider's line is not a usable announcement
        raise TranslateError("translate_failed") from None
