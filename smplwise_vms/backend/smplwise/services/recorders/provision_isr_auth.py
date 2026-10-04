"""Pluggable authentication for the Provision-ISR adapter (CR-025).

Schemes (`nvr_extra.auth` forces one; otherwise the device's 401 challenge decides):
- `basic`  - RFC 7617, the v1 guide's scheme; over HTTP (with the settings-screen warning) or HTTPS;
- `digest` - standard RFC 2617 / 7616 Digest (httpx.DigestAuth), the v2 guide's second scheme;
- `vendor_v1_1` - SLOT for the vendor's own Digest variant. The owner's NVR (2026-10-04) challenges with
  `Digest realm="Web Service", qop="auth", stale="TRUE", AuthVersion="1.1"` and refused two standard Digest answers built
  from correct credentials. `AuthVersion` is in no vendor document; when its computation is known, implement
  `VendorDigestV11.response()` and set `IMPLEMENTED = True`. Until then selecting it fails locally, before any request.

`detect(challenge)` names the scheme a challenge asks for; `describe(challenge)` keeps the non-secret facts (scheme, qop,
algorithm, auth version) for health / the settings screen. Never the realm value of a device that embeds a serial in it."""
from __future__ import annotations

import hashlib
import os
import re
from collections.abc import Generator
from typing import Any

import httpx

from ...errors import ApiError

SCHEMES = ("basic", "digest", "vendor_v1_1")
_PARAM = re.compile(r'(\w+)=("[^"]*"|[^,\s]+)')


def params(challenge: str) -> dict[str, str]:
    return {k: v.strip('"') for k, v in _PARAM.findall(challenge or "")}


def describe(challenge: str) -> dict[str, Any]:
    """Non-secret facts of a WWW-Authenticate value."""
    head = (challenge or "").strip().split(" ", 1)[0].lower() or None
    p = params(challenge)
    return {"scheme": head, "qop": p.get("qop"), "algorithm": p.get("algorithm"), "auth_version": p.get("AuthVersion"),
            "stale_on_first": (p.get("stale") or "").lower() == "true"}


def detect(challenge: str) -> str:
    """The scheme to use for this challenge. A Digest challenge carrying the vendor's `AuthVersion` still maps to standard
    Digest (the vendor variant is opt-in until it is implemented and proven); Basic or nothing usable -> Basic."""
    head = (challenge or "").strip().lower()
    return "digest" if head.startswith("digest") else "basic"


class VendorDigestV11(httpx.Auth):
    """Slot for the vendor's `AuthVersion="1.1"` Digest. Fill `response()` (and set IMPLEMENTED) once the computation is
    known; the flow around it (challenge, nonce count, cnonce, header) is already here and tested with a stand-in."""

    IMPLEMENTED = False

    def __init__(self, username: str, password: str) -> None:
        self._user = username
        self._password = password
        self._nc = 0

    def response(self, *, method: str, uri: str, realm: str, nonce: str, nc: str, cnonce: str, qop: str) -> str:  # pragma: no cover - slot
        raise NotImplementedError

    def auth_flow(self, request: httpx.Request) -> Generator[httpx.Request, httpx.Response, None]:
        if not self.IMPLEMENTED:
            raise ApiError(409, "auth_scheme_unsupported", "שיטת האימות של ה־NVR עדיין אינה נתמכת.",
                           details={"op": "auth", "scheme": "vendor_v1_1"})
        response = yield request
        if response.status_code != 401:
            return
        p = params(response.headers.get("www-authenticate", ""))
        self._nc += 1
        nc = f"{self._nc:08x}"
        cnonce = hashlib.md5(os.urandom(8)).hexdigest()
        qop = "auth"
        uri = request.url.raw_path.decode("ascii")
        value = self.response(method=request.method, uri=uri, realm=p.get("realm", ""), nonce=p.get("nonce", ""), nc=nc, cnonce=cnonce, qop=qop)
        fields = [f'username="{self._user}"', f'realm="{p.get("realm", "")}"', f'nonce="{p.get("nonce", "")}"', f'uri="{uri}"',
                  f"qop={qop}", f"nc={nc}", f'cnonce="{cnonce}"', f'response="{value}"']
        if "opaque" in p:
            fields.append(f'opaque="{p["opaque"]}"')
        if p.get("AuthVersion"):
            fields.append(f'AuthVersion="{p["AuthVersion"]}"')
        request.headers["Authorization"] = "Digest " + ", ".join(fields)
        yield request


def build(scheme: str, username: str, password: str) -> httpx.Auth:
    if scheme == "basic":
        return httpx.BasicAuth(username, password)
    if scheme == "digest":
        return httpx.DigestAuth(username, password)
    if scheme == "vendor_v1_1":
        return VendorDigestV11(username, password)
    raise ApiError(422, "value_not_allowed", "שיטת אימות לא מוכרת.", details={"field": "auth"})
