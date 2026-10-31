"""CALCONNECT-2330: obtaining and refreshing the owner's OAuth authorisation for Google Calendar and Microsoft 365 / Outlook (contract
12.5, 15.1-15.4). Arx never creates an account or an app registration, never asks for a password and never automates a consent screen:
the owner registers his OWN client at the provider, pastes its id (and Google's secret) into Arx and approves in his own browser.

Two flows, both suitable for a headless add-on (no inbound redirect reaches Arx, no public callback surface):

* Google - the "installed application" (Desktop app client) flow: authorization code + PKCE (S256) with a LOOPBACK redirect
  (`http://127.0.0.1:8749/`). The screen opens Google's consent page; after the approval the browser lands on the loopback address (a
  page that does not load - nothing listens there) and the owner pastes that address back. Arx checks the single-use `state` (bound to
  the connection AND the person who started it, 10 minutes), then exchanges the code with the PKCE verifier. Google's device flow is NOT
  used: Google does not allow calendar scopes on "TVs and Limited Input devices" clients (the Drive backup's `drive.file` is allowed).
* Microsoft - the device authorization grant (RFC 8628) of the Microsoft identity platform: a short code shown in Arx, approved at
  microsoft.com/devicelogin on any phone or computer; the app registration needs "Allow public client flows". No client secret.

Scopes are the least the binding needs (15.3): Google `calendar` / `calendar.readonly` by default (owner answer C8, setting
`sync_google_scope = full`), or `calendar.events` (+ `calendar.calendarlist.readonly` to list the calendars) with `events`; Microsoft
`Calendars.ReadWrite` or `Calendars.Read`, plus `offline_access` for the refresh token. Never mail, contacts or directory scopes.

The device code, the PKCE verifier and the state live in process memory only (`_PENDING`) until the grant ends - never stored, returned,
logged or audited. The refresh token is sealed at once (credentials.py). Every HTTP call goes through `http_client()`, the test seam
(`HTTP`): tests put an httpx.MockTransport in front of fake provider servers; no test reaches Google or Microsoft."""
from __future__ import annotations

import base64
import dataclasses
import hashlib
import json
import re
import secrets
import threading
import time
from typing import Any, Callable
from urllib.parse import parse_qs, urlencode, urlsplit

import httpx

from . import credentials
from .adapter import NeedsReauth, RateLimited, SyncError

# ---------------------------------------------------------------- endpoints (fixed; never taken from a request or a provider answer)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
GOOGLE_REDIRECT = "http://127.0.0.1:8749/"
GOOGLE_CLIENT_RE = re.compile(r"^[0-9]{1,30}-[a-z0-9]{1,64}\.apps\.googleusercontent\.com$")
G = "https://www.googleapis.com/auth/"
GOOGLE_SCOPES = {
    ("full", "read_write"): (G + "calendar",),
    ("full", "read"): (G + "calendar.readonly",),
    ("events", "read_write"): (G + "calendar.events", G + "calendar.calendarlist.readonly"),
    ("events", "read"): (G + "calendar.events.readonly", G + "calendar.calendarlist.readonly"),
}

MS_LOGIN = "https://login.microsoftonline.com"
MS_CLIENT_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
MS_TENANT_RE = re.compile(r"^(common|organizations|consumers|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63}){1,4})$")
MS_VERIFY_RE = re.compile(r"^https://(microsoft\.com/devicelogin|login\.microsoft\.com/device|www\.microsoft\.com/link|aka\.ms/devicelogin)$")
MS_SCOPES = {"read_write": ("offline_access", "Calendars.ReadWrite"), "read": ("offline_access", "Calendars.Read")}
DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code"

PENDING_S = 600
CLOCK: Callable[[], float] = time.monotonic
HTTP: Callable[[], httpx.Client] | None = None  # test seam


def http_client() -> httpx.Client:
    return HTTP() if HTTP is not None else httpx.Client(timeout=httpx.Timeout(15.0), follow_redirects=False, headers={"User-Agent": "SmplWise-Arx-Calendar/1"})


class OAuthError(Exception):
    """A failed authorisation step. `code` is a short machine word the screen translates; never a token, a code or a body."""

    def __init__(self, code: str, status: int = 422) -> None:
        super().__init__(code)
        self.code = code
        self.status = status


def _json(resp: httpx.Response) -> dict[str, Any]:
    try:
        body = json.loads(resp.content[:65536] or b"{}")
    except (ValueError, UnicodeDecodeError):
        return {}
    return body if isinstance(body, dict) else {}


def _int(v: Any, default: int, lo: int, hi: int) -> int:
    try:
        return max(lo, min(hi, int(v)))
    except (TypeError, ValueError):
        return default


def _post(http: httpx.Client, url: str, form: dict[str, str]) -> httpx.Response:
    try:
        return http.post(url, data=form)
    except httpx.HTTPError:
        raise OAuthError("provider_unavailable", 502) from None


def scopes_for(provider: str, scope: str, google_scope: str = "full") -> tuple[str, ...]:
    if provider == "google":
        return GOOGLE_SCOPES[(google_scope if google_scope in ("full", "events") else "full", "read_write" if scope == "read_write" else "read")]
    return MS_SCOPES["read_write" if scope == "read_write" else "read"]


def validate_client(provider: str, client_id: str, tenant: str | None) -> None:
    if provider == "google" and not GOOGLE_CLIENT_RE.fullmatch(client_id or ""):
        raise OAuthError("client_id_invalid")
    if provider == "microsoft":
        if not MS_CLIENT_RE.fullmatch(client_id or ""):
            raise OAuthError("client_id_invalid")
        if tenant is not None and not MS_TENANT_RE.fullmatch(tenant):
            raise OAuthError("tenant_invalid")


# ---------------------------------------------------------------- the pending grants (memory only)

@dataclasses.dataclass
class _Pending:
    provider: str
    user_id: str
    client_id: str
    scopes: tuple[str, ...]
    expires_at: float
    state: str = dataclasses.field(default="", repr=False)
    verifier: str = dataclasses.field(default="", repr=False)
    device_code: str = dataclasses.field(default="", repr=False)
    interval: int = 5
    next_poll_at: float = 0.0


_LOCK = threading.Lock()
_PENDING: dict[str, _Pending] = {}


def pending(cid: str) -> str | None:
    """The provider of a live pending grant of this connection, else None."""
    with _LOCK:
        p = _PENDING.get(cid)
        return p.provider if p and CLOCK() < p.expires_at else None


def cancel(cid: str) -> bool:
    with _LOCK:
        return _PENDING.pop(cid, None) is not None


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


# ---------------------------------------------------------------- Google: installed-app flow (code + PKCE, loopback paste-back)

def google_start(cid: str, user_id: str, client_id: str, scopes: tuple[str, ...]) -> dict[str, Any]:
    if not GOOGLE_CLIENT_RE.fullmatch(client_id or ""):
        raise OAuthError("client_missing", 409)
    state, verifier = secrets.token_urlsafe(24), secrets.token_urlsafe(48)
    challenge = _b64(hashlib.sha256(verifier.encode("ascii")).digest())
    with _LOCK:
        _PENDING[cid] = _Pending("google", user_id, client_id, scopes, CLOCK() + PENDING_S, state=state, verifier=verifier)
    q = urlencode({"client_id": client_id, "redirect_uri": GOOGLE_REDIRECT, "response_type": "code", "scope": " ".join(scopes), "state": state,
                   "code_challenge": challenge, "code_challenge_method": "S256", "access_type": "offline", "prompt": "consent", "include_granted_scopes": "false"})
    return {"flow": "paste", "authorize_url": f"{GOOGLE_AUTH_URL}?{q}", "redirect_prefix": GOOGLE_REDIRECT, "expires_in": PENDING_S}


def _pasted(text: str) -> dict[str, str]:
    """The query of the loopback address the browser landed on. Only our own loopback redirect is accepted."""
    if not isinstance(text, str) or not 10 <= len(text) <= 4096 or any(ord(c) < 32 for c in text):
        raise OAuthError("paste_invalid")
    t = text.strip()
    parts = urlsplit(t)
    if f"{parts.scheme}://{parts.netloc}/" != GOOGLE_REDIRECT or parts.path not in ("", "/"):
        raise OAuthError("paste_invalid")
    q = {k: v[0] for k, v in parse_qs(parts.query, keep_blank_values=False).items() if v}
    return q


def google_complete(cid: str, user_id: str, pasted: str, client_secret: str | None) -> str:
    """Checks the state, exchanges the code; returns the refresh token (the caller seals it at once)."""
    q = _pasted(pasted)
    with _LOCK:
        p = _PENDING.get(cid)
        if p is None or p.provider != "google" or CLOCK() >= p.expires_at:
            _PENDING.pop(cid, None)
            raise OAuthError("grant_expired", 409)
        if p.user_id != user_id or not secrets.compare_digest(q.get("state", ""), p.state):
            raise OAuthError("state_mismatch", 409)  # never consumed by a stranger's paste; the owner may still paste the right one
        _PENDING.pop(cid, None)  # single use from here on
    if q.get("error"):
        raise OAuthError("denied" if q["error"] == "access_denied" else "provider_refused", 409)
    code = q.get("code", "")
    if not code or len(code) > 1024:
        raise OAuthError("paste_invalid")
    form = {"grant_type": "authorization_code", "code": code, "client_id": p.client_id, "redirect_uri": GOOGLE_REDIRECT, "code_verifier": p.verifier}
    if client_secret:
        form["client_secret"] = client_secret
    http = http_client()
    try:
        resp = _post(http, GOOGLE_TOKEN_URL, form)
    finally:
        http.close()
    body = _json(resp)
    if resp.status_code >= 400:
        err = body.get("error")
        if err in ("invalid_client", "unauthorized_client"):
            raise OAuthError("client_invalid", 409)
        if err == "invalid_grant":
            raise OAuthError("grant_expired", 409)
        if resp.status_code == 429:
            raise OAuthError("rate_limited", 429)
        raise OAuthError("provider_unavailable" if resp.status_code >= 500 else "provider_refused", 502 if resp.status_code >= 500 else 409)
    granted = set(str(body.get("scope") or "").split())
    if not set(p.scopes) <= granted:
        raise OAuthError("scope_refused", 409)  # a partial consent (a box left unticked) is not a working connection
    token = body.get("refresh_token")
    if not isinstance(token, str) or not token or len(token) > 4096:
        raise OAuthError("no_refresh_token", 502)
    access = body.get("access_token")
    if isinstance(access, str) and access:
        credentials.remember_access(cid, access, _int(body.get("expires_in"), 0, 0, 86400))
    return token


# ---------------------------------------------------------------- Microsoft: device authorization grant

def _ms(tenant: str, path: str) -> str:
    if not MS_TENANT_RE.fullmatch(tenant or ""):
        raise OAuthError("tenant_invalid")
    return f"{MS_LOGIN}/{tenant}/oauth2/v2.0/{path}"


def microsoft_start(cid: str, user_id: str, client_id: str, tenant: str, scopes: tuple[str, ...]) -> dict[str, Any]:
    if not MS_CLIENT_RE.fullmatch(client_id or ""):
        raise OAuthError("client_missing", 409)
    http = http_client()
    try:
        resp = _post(http, _ms(tenant, "devicecode"), {"client_id": client_id, "scope": " ".join(scopes)})
    finally:
        http.close()
    body = _json(resp)
    if resp.status_code >= 400:
        err = body.get("error")
        if err in ("invalid_client", "unauthorized_client"):
            raise OAuthError("client_invalid", 409)  # usually "Allow public client flows" is off in the app registration
        if err == "invalid_scope":
            raise OAuthError("scope_refused", 409)
        if resp.status_code == 429:
            raise OAuthError("rate_limited", 429)
        raise OAuthError("provider_unavailable" if resp.status_code >= 500 else "provider_refused", 502 if resp.status_code >= 500 else 409)
    device, user_code, url = body.get("device_code"), body.get("user_code"), body.get("verification_uri") or body.get("verification_url")
    if not (isinstance(device, str) and device and isinstance(user_code, str) and re.fullmatch(r"[A-Za-z0-9-]{4,32}", user_code)
            and isinstance(url, str) and MS_VERIFY_RE.fullmatch(url)):
        raise OAuthError("provider_refused", 502)  # never show the owner a link that is not Microsoft's own device page
    expires, interval = _int(body.get("expires_in"), 900, 60, 3600), _int(body.get("interval"), 5, 1, 60)
    now = CLOCK()
    with _LOCK:
        _PENDING[cid] = _Pending("microsoft", user_id, client_id, scopes, now + expires, device_code=device, interval=interval, next_poll_at=now)
    return {"flow": "device", "user_code": user_code, "verification_url": url, "expires_in": expires, "interval": interval}


def microsoft_poll(cid: str, user_id: str, tenant: str) -> dict[str, Any]:
    """{state: none|pending|slow_down|denied|expired|connected, interval?, refresh_token? (connected only; the caller seals it)}"""
    now = CLOCK()
    with _LOCK:
        p = _PENDING.get(cid)
        if p is None or p.provider != "microsoft":
            return {"state": "none"}
        if p.user_id != user_id:
            return {"state": "none"}
        if now >= p.expires_at:
            _PENDING.pop(cid, None)
            return {"state": "expired"}
        if now < p.next_poll_at:
            return {"state": "pending", "interval": p.interval}
        p.next_poll_at = now + p.interval
    http = http_client()
    try:
        resp = _post(http, _ms(tenant, "token"), {"grant_type": DEVICE_GRANT, "client_id": p.client_id, "device_code": p.device_code})
    finally:
        http.close()
    body = _json(resp)
    if resp.status_code >= 400:
        err = body.get("error")
        if err == "authorization_pending":
            return {"state": "pending", "interval": p.interval}
        if err == "slow_down" or resp.status_code == 429:
            with _LOCK:
                p.interval = min(60, p.interval + 5)
                p.next_poll_at = CLOCK() + p.interval
            return {"state": "slow_down", "interval": p.interval}
        with _LOCK:
            _PENDING.pop(cid, None)
        if err in ("authorization_declined", "access_denied"):
            return {"state": "denied"}
        if err in ("expired_token", "bad_verification_code", "invalid_grant"):
            return {"state": "expired"}
        if err in ("invalid_client", "unauthorized_client"):
            raise OAuthError("client_invalid", 409)
        raise OAuthError("provider_unavailable" if resp.status_code >= 500 else "provider_refused", 502 if resp.status_code >= 500 else 409)
    with _LOCK:
        _PENDING.pop(cid, None)
    granted = {g.rsplit("/", 1)[-1] for g in (s.lower() for s in str(body.get("scope") or "").split())}
    if "calendars.readwrite" in granted:
        granted.add("calendars.read")  # an earlier, wider consent covers a read connection
    need = {s.lower() for s in p.scopes if s != "offline_access"}
    if not need <= granted:
        raise OAuthError("scope_refused", 409)
    token = body.get("refresh_token")
    if not isinstance(token, str) or not token or len(token) > 8192:
        raise OAuthError("no_refresh_token", 502)
    access = body.get("access_token")
    if isinstance(access, str) and access:
        credentials.remember_access(cid, access, _int(body.get("expires_in"), 0, 0, 86400))
    return {"state": "connected", "refresh_token": token}


# ---------------------------------------------------------------- refresh + revoke (used by the adapters, no transaction open)

def access_token(provider: str, cid: str, *, force: bool = False) -> str:
    """A short-lived access token from the sealed refresh token. invalid_grant -> NeedsReauth('auth_expired')."""
    if not force:
        hit = credentials.cached_access(cid)
        if hit:
            return hit
    cred = credentials.RUNTIME.read(cid)
    refresh = cred.get("refresh_token")
    if not refresh:
        raise NeedsReauth(code="not_authorized")
    if provider == "google":
        url, form = GOOGLE_TOKEN_URL, {"grant_type": "refresh_token", "client_id": cred["client_id"], "refresh_token": refresh}
        if cred.get("client_secret"):
            form["client_secret"] = cred["client_secret"]
    else:
        try:
            url = _ms(cred.get("tenant") or credentials.TENANT_DEFAULT, "token")
        except OAuthError:
            raise SyncError(code="tenant_invalid") from None
        form = {"grant_type": "refresh_token", "client_id": cred["client_id"], "refresh_token": refresh}
    if not cred.get("client_id"):
        raise SyncError(code="client_missing")
    http = http_client()
    try:
        try:
            resp = http.post(url, data=form)
        except httpx.HTTPError:
            raise SyncError(code="provider_unavailable") from None
    finally:
        http.close()
    body = _json(resp)
    if resp.status_code >= 400:
        err = body.get("error")
        if err == "invalid_grant":
            credentials.forget_access(cid)
            raise NeedsReauth(code="auth_expired")
        if err in ("invalid_client", "unauthorized_client"):
            raise SyncError(code="client_invalid")
        if resp.status_code == 429:
            raise RateLimited(code="rate_limited", retry_after_s=_int(resp.headers.get("Retry-After"), 60, 1, 3600))
        raise SyncError(code="provider_unavailable" if resp.status_code >= 500 else "provider_error")
    token = body.get("access_token")
    if not isinstance(token, str) or not token:
        raise SyncError(code="provider_error")
    rotated = body.get("refresh_token")
    if isinstance(rotated, str) and rotated and rotated != refresh and len(rotated) <= 8192:
        credentials.RUNTIME.store_refresh(cid, rotated)
    credentials.remember_access(cid, token, _int(body.get("expires_in"), 0, 0, 86400))
    return token


def google_revoke(refresh_token: str) -> bool:
    http = http_client()
    try:
        resp = http.post(GOOGLE_REVOKE_URL, data={"token": refresh_token})
        return resp.status_code < 400
    except httpx.HTTPError:
        return False
    finally:
        http.close()


__all__ = ["OAuthError", "google_start", "google_complete", "microsoft_start", "microsoft_poll", "access_token", "google_revoke", "cancel",
           "pending", "scopes_for", "validate_client"]
