"""VIDEO-TRANSPORT-2400 (lab audit 2026-11-04, finding 8): what one live session's sockets said, so a session that ends in under a
second is explainable from Arx's own log and audit row.

Before this, every session ended `client_closed` and go2rtc's error frames (text) were neither logged nor counted - a station
stream that failed at once looked exactly like a viewer who closed the drawer. `LiveDiag` watches the relay (it never changes a
frame) and adds to the `video.live.stop` row:
- `transport`: what go2rtc answered on this socket (`webrtc` = a `webrtc/answer`, `mse` = its `mse` codec line); none when go2rtc
  failed before answering (the error frame says why);
- `ttff_ms`: the first media byte after the socket opened (MSE; WebRTC media flows outside the socket - `answer_ms` instead);
- `upstream_error` / `upstream_error_text`: go2rtc's first error frame, classified and SANITIZED - addresses, URLs and anything
  after `@` are replaced (a source URL can carry the station's credentials), the text is bounded. Never the raw frame.
"""
from __future__ import annotations

import json
import re
import time
from typing import Any

MAX_TEXT = 120

_URL = re.compile(r"[a-zA-Z][a-zA-Z0-9+.-]*://\S+")
_CRED = re.compile(r"\S+:\S*@\S+")
_IPV4 = re.compile(r"\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b")
_IPV6 = re.compile(r"\[[0-9a-fA-F:]+\](?::\d+)?|\b(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}\b")
_DIAL = re.compile(r"\b(dial|lookup|read|write)\s+(tcp|udp)\S*\s+\S+", re.IGNORECASE)
_MAC = re.compile(r"\b[0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5}\b")
_SERIAL = re.compile(r"\b[A-Z0-9]{16,}\b")

_CLASSES: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("auth", re.compile(r"user/pass|unauthori[sz]ed|\b401\b|forbidden|\b403\b|authentication", re.IGNORECASE)),
    ("timeout", re.compile(r"timeout|timed out|deadline", re.IGNORECASE)),
    ("refused", re.compile(r"refused|unreachable|no route|reset by peer", re.IGNORECASE)),
    ("codecs", re.compile(r"codec", re.IGNORECASE)),
    ("not_found", re.compile(r"not found|\b404\b|no such|can't find|unknown stream", re.IGNORECASE)),
    ("busy", re.compile(r"busy|\b453\b|not enough bandwidth|too many|limit", re.IGNORECASE)),
    ("eof", re.compile(r"\beof\b|closed", re.IGNORECASE)),
)


def sanitize(text: str) -> str:
    """A go2rtc error text with no address, URL, credential, MAC or serial left; bounded to MAX_TEXT characters."""
    t = str(text or "")
    t = _URL.sub("<url>", t)
    t = _CRED.sub("<cred>", t)
    t = _DIAL.sub(lambda m: f"{m.group(1)} {m.group(2)} <host>", t)
    t = _IPV6.sub("<host>", t)
    t = _IPV4.sub("<host>", t)
    t = _MAC.sub("<mac>", t)
    t = _SERIAL.sub("<id>", t)
    t = "".join(ch if ch.isprintable() else " " for ch in t).strip()
    return t[:MAX_TEXT]


def classify(text: str) -> str:
    for code, pattern in _CLASSES:
        if pattern.search(text or ""):
            return code
    return "other"


class LiveDiag:
    """Fed by the relay (go2rtc's frames towards the browser); read once at the end of the session (`details`)."""

    def __init__(self, now: float | None = None) -> None:
        self.opened = time.monotonic() if now is None else now
        self.transport = ""
        self.ttff_ms: int | None = None
        self.answer_ms: int | None = None
        self.error_code = ""
        self.error_text = ""
        self.errors = 0

    def _ms(self, now: float | None) -> int:
        return max(0, int(((time.monotonic() if now is None else now) - self.opened) * 1000))

    def down_text(self, text: str, now: float | None = None) -> None:
        """A text frame from go2rtc (seen BEFORE any rewrite that hides it from the browser)."""
        msg = _parse(text)
        kind = msg.get("type") if isinstance(msg, dict) else None
        if kind == "webrtc/answer" and self.answer_ms is None:
            self.answer_ms = self._ms(now)
            self.transport = self.transport or "webrtc"
        elif kind == "mse":
            self.transport = self.transport or "mse"
        elif kind == "error":
            self.errors += 1
            if not self.error_code:
                raw = msg.get("value") if isinstance(msg.get("value"), str) else ""
                self.error_text = sanitize(raw)
                self.error_code = classify(raw)

    def down_bytes(self, now: float | None = None) -> None:
        if self.ttff_ms is None:
            self.ttff_ms = self._ms(now)

    def details(self) -> dict[str, Any]:
        out: dict[str, Any] = {"transport": self.transport or None}
        if self.ttff_ms is not None:
            out["ttff_ms"] = self.ttff_ms
        if self.answer_ms is not None:
            out["answer_ms"] = self.answer_ms
        if self.error_code:
            out["upstream_error"] = self.error_code
            out["upstream_error_text"] = self.error_text
            if self.errors > 1:
                out["upstream_errors"] = self.errors
        return out


def _parse(text: str) -> Any:
    try:
        return json.loads(text)
    except (ValueError, TypeError):
        return None
