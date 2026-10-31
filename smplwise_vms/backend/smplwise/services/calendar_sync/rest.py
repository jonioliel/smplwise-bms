"""CALCONNECT-2330: the one authorised REST call of the Google and Microsoft adapters, and the provider error -> SyncError mapping.

401 refreshes the access token once and retries; a second 401 is `auth_expired` (the owner authorises again). 429 and the providers'
rate-limit reasons are RateLimited (the engine backs off, at least Retry-After); a used-up quota is `quota_exceeded`; 5xx is
`provider_unavailable`; 404 / 410 are returned to the caller (each adapter knows what they mean). Never a token, a URL or a body in
an error. Every URL is built by the adapter from fixed bases; a `nextLink` / `deltaLink` of a provider answer is followed only when it
points back at the same API host."""
from __future__ import annotations

import json
from typing import Any
from urllib.parse import urlsplit

import httpx

from . import oauth
from .adapter import NeedsReauth, RateLimited, SyncError

RATE_REASONS = {"rateLimitExceeded", "userRateLimitExceeded", "ApplicationThrottled", "TooManyRequests"}
QUOTA_REASONS = {"quotaExceeded", "dailyLimitExceeded", "ErrorQuotaExceeded", "MailboxStoreUnavailable", "ErrorExceededMessageLimit"}


def body_of(resp: httpx.Response) -> dict[str, Any]:
    try:
        b = json.loads(resp.content[:4 * 1024 * 1024] or b"{}")
    except (ValueError, UnicodeDecodeError):
        return {}
    return b if isinstance(b, dict) else {}


def _reasons(resp: httpx.Response) -> set[str]:
    err = body_of(resp).get("error")
    out: set[str] = set()
    if isinstance(err, dict):
        if isinstance(err.get("code"), str):
            out.add(err["code"])
        for e in err.get("errors") or []:
            if isinstance(e, dict) and isinstance(e.get("reason"), str):
                out.add(e["reason"])
        inner = err.get("innerError") or err.get("innererror")
        if isinstance(inner, dict) and isinstance(inner.get("code"), str):
            out.add(inner["code"])
    return out


def _retry_after(resp: httpx.Response) -> int | None:
    v = resp.headers.get("Retry-After")
    try:
        return max(1, min(3600, int(v))) if v else None
    except ValueError:
        return None


def same_host(url: str, base: str) -> bool:
    try:
        a, b = urlsplit(url), urlsplit(base)
    except ValueError:
        return False
    return a.scheme == "https" and a.netloc == b.netloc


def call(provider: str, cid: str, method: str, url: str, *, ok: tuple[int, ...] = (200, 201, 204), passthrough: tuple[int, ...] = (),
         **kw: Any) -> httpx.Response:
    """One call with the connection's access token. Statuses in `passthrough` come back to the caller unmapped."""
    token = oauth.access_token(provider, cid)
    base_headers = dict(kw.pop("headers", {}) or {})
    for attempt in (0, 1):
        http = oauth.http_client()
        try:
            headers = {**base_headers, "Authorization": f"Bearer {token}"}
            try:
                resp = http.request(method, url, headers=headers, **kw)
            except httpx.HTTPError:
                raise SyncError(code="provider_unavailable") from None
        finally:
            http.close()
        if resp.status_code == 401 and attempt == 0:
            token = oauth.access_token(provider, cid, force=True)
            continue
        break
    s = resp.status_code
    if s in ok or s in passthrough:
        return resp
    reasons = _reasons(resp)
    if s == 401:
        raise NeedsReauth(code="auth_expired")
    if s == 429 or reasons & RATE_REASONS:
        raise RateLimited(code="rate_limited", retry_after_s=_retry_after(resp))
    if reasons & QUOTA_REASONS:
        raise SyncError(code="quota_exceeded")
    if s == 403:
        raise SyncError(code="forbidden")
    if s == 404:
        raise SyncError(code="not_found")
    if s >= 500:
        raise SyncError(code="provider_unavailable", retry_after_s=_retry_after(resp))
    raise SyncError(code="provider_error")


__all__ = ["call", "body_of", "same_host"]
