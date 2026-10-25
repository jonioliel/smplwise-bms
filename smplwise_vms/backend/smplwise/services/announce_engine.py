"""ANNOUNCE-295 (stage A): the speech engines behind voice announcements, behind one small interface.

- `local` (the default, as it always was): the infrastructure's own `tts.speak` on the engine entity the administrator named. The text stays
  inside the building and the home system. The call is `announcements.SPEAK`, which tests replace.
- `cloud` (optional, OFF by default): a cloud speech service turns the text into audio and the audio is played on the same speakers. The TEXT
  LEAVES THE BUILDING, so it is behind its own switch (`announce.cloud_enabled`) and the engine selector refuses `cloud` while the switch is
  off. The API key is NEVER a setting: it lives in the in-app secrets store (services/secrets_store.py, name `announce_cloud_key`, sealed
  per install, write-only in Settings) and is read per announcement; it is never logged, audited, returned or put in an exception.

Both engines implement `Engine.speak(settings, entity_ids, text, language)`. The cloud engine is built from two seams that tests replace with
fakes, so no test reaches a real cloud service or a real player:
- `SYNTHESIZE(key, text, language) -> Audio`  the cloud call (default: an OpenAI-compatible speech endpoint at a FIXED https host; the host is not
  a setting, so a setting can never point the key somewhere else);
- `DELIVER(settings, entity_ids, audio)`      hands the audio to the speakers. There is no default delivery path in stage A (the clip needs a URL
  the speakers can fetch, which is a separate decision with the owner), so it raises `cloud_delivery_unavailable` until one is wired.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Protocol

KINDS = ("local", "cloud")
DEFAULT_KIND = "local"
SECRET_NAME = "announce_cloud_key"
CLOUD_URL = "https://api.openai.com/v1/audio/speech"  # fixed on purpose: not a setting (the key can only ever go here)
CLOUD_MODEL = "gpt-4o-mini-tts"
CLOUD_TIMEOUT_S = 15
MAX_AUDIO_BYTES = 8 * 1024 * 1024


class EngineError(Exception):
    """An engine could not speak. `code` is a stable machine code; the message never carries a key or a response body."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class Audio:
    data: bytes = field(repr=False)  # never in a repr, a log or an audit row
    mime: str = "audio/mpeg"


class Engine(Protocol):
    kind: str

    def speak(self, settings: Any, entity_ids: list[str], text: str, language: str) -> None: ...


class LocalEngine:
    """`tts.speak` on the engine entity through the module seam `announcements.SPEAK` (looked up per call, so a test's fake applies)."""

    kind = "local"

    def __init__(self, entity: str) -> None:
        self.entity = entity

    def speak(self, settings: Any, entity_ids: list[str], text: str, language: str) -> None:
        from . import announcements as ann

        ann.SPEAK(settings, self.entity, entity_ids, text, language)


def default_synthesize(key: str, text: str, language: str) -> Audio:
    """The cloud call: one POST with the bearer key, a bounded wait and a bounded answer. Raises EngineError with a code only."""
    body = json.dumps({"model": CLOUD_MODEL, "input": text, "voice": "alloy", "response_format": "mp3", "instructions": f"Speak in language: {language}"}).encode()
    req = urllib.request.Request(CLOUD_URL, data=body, method="POST", headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=CLOUD_TIMEOUT_S) as resp:  # noqa: S310 - fixed https URL
            data = resp.read(MAX_AUDIO_BYTES + 1)
            mime = resp.headers.get("Content-Type", "audio/mpeg")
    except urllib.error.HTTPError as exc:
        raise EngineError("cloud_rejected" if exc.code in (401, 403) else "cloud_error") from None
    except Exception:  # noqa: BLE001 - never carries the URL, the key or a body
        raise EngineError("cloud_unreachable") from None
    if not data or len(data) > MAX_AUDIO_BYTES:
        raise EngineError("cloud_error")
    return Audio(data=data, mime=mime.split(";")[0].strip() or "audio/mpeg")


def default_deliver(settings: Any, entity_ids: list[str], audio: Audio) -> None:
    raise EngineError("cloud_delivery_unavailable")


SYNTHESIZE = default_synthesize  # tests replace both: no test reaches a cloud service or a player
DELIVER = default_deliver


class CloudEngine:
    kind = "cloud"

    def __init__(self, key: str) -> None:
        self._key = key

    def __repr__(self) -> str:  # the key is never printed
        return "CloudEngine(key=***)"

    def speak(self, settings: Any, entity_ids: list[str], text: str, language: str) -> None:
        audio = SYNTHESIZE(self._key, text, language)
        DELIVER(settings, entity_ids, audio)


def key_of(conn: Any, settings: Any) -> str | None:
    """The cloud key from the secrets store (a stored row decides; an unreadable or cleared row is None). Never logged."""
    from . import secrets_store

    try:
        return secrets_store.current_value(conn, settings, SECRET_NAME)
    except Exception:  # noqa: BLE001
        return None


def key_is_set(conn: Any, settings: Any) -> bool:
    return bool(key_of(conn, settings)) if settings is not None else False


def build(kind: str, conn: Any, settings: Any, local_entity: str) -> Engine | None:
    """The engine for `kind`, or None when it is not ready (local: no engine entity; cloud: no key). The caller turns None into `not_configured`."""
    if kind == "cloud":
        key = key_of(conn, settings)
        return CloudEngine(key) if key else None
    return LocalEngine(local_entity) if local_entity else None
