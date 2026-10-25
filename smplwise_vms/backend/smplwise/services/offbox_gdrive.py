"""GDRIVEBK-295 (scaffold, OFF by default): Google Drive as a destination of the off-box backup copies.

Design: docs/design/GDRIVE_BACKUP.md. This module is the transport only; it plugs into the existing off-box pipeline
(services/backup_offbox.py: the archive is SEALED with SWXB v1 before it leaves, uploaded, read back, verified, and only then is
the retention applied), so nothing about encryption, verification or retention is re-invented here.

- `GDriveDestination` implements `backup_offbox.Destination` (put / get / list / delete / describe / close) over the Drive v3 REST
  API with an INJECTED `httpx.Client` (tests: an `httpx.MockTransport` in front of tests/fake_gdrive.py; no test ever reaches
  Google). Scope: `drive.file` only - the app sees the files and the folder it created, nothing else of the user's Drive.
- Uploads: multipart for small files (the connection-test marker), RESUMABLE for archives (chunks of a multiple of 256 KiB; a chunk
  that fails is retried after asking the session how much it holds; an expired session restarts the upload once).
- Quota: `about.storageQuota` is read before an upload; a copy that would leave less than `min_free_bytes` plus `quota_margin_pct`
  of the copy free is refused up front (`quota_exceeded`), and Drive's own `storageQuotaExceeded` maps to the same code.
- Retries: 429, 5xx and Drive's rate-limit reasons back off exponentially (bounded; the sleep is injectable); 401 refreshes the
  access token once; everything else maps to a fixed `OffboxError` code - never a token, a body or the upload session URL.
- Tokens: `TokenSource` is the seam. `RefreshTokenSource` trades the stored refresh token for short-lived access tokens at the
  token endpoint (implemented; tested against the fake). The CONSENT step that obtains the refresh token in the first place is
  `OAuthFlow` - TODO(GDRIVEBK-OAUTH): only `NotImplementedFlow` exists until the owner decides the Google Cloud project, the client
  type and the consent screen (docs/design/GDRIVE_BACKUP.md section 9)."""
from __future__ import annotations

import dataclasses
import json
import logging
import random
import re
import secrets
import time
from pathlib import Path
from typing import Any, Callable, Protocol

import httpx

from .backup_offbox import CHUNK, OBJECT_RE, CredentialRef, OffboxError, RemoteObject, SecretLookup, check_name

log = logging.getLogger("smplwise.backup.gdrive")

DRIVE_API = "https://www.googleapis.com"
TOKEN_URL = "https://oauth2.googleapis.com/token"
REVOKE_URL = "https://oauth2.googleapis.com/revoke"
DEVICE_CODE_URL = "https://oauth2.googleapis.com/device/code"
SCOPE = "https://www.googleapis.com/auth/drive.file"
FOLDER_MIME = "application/vnd.google-apps.folder"
GRANULE = 256 * 1024  # Drive's resumable chunks are multiples of 256 KiB (except the last)
MAX_PAGES = 1000
FOLDER_NAME_RE = re.compile(r"^[^'\\\x00-\x1f]{1,100}$")
CLIENT_ID_RE = re.compile(r"^[0-9]{1,30}-[a-z0-9]{1,64}\.apps\.googleusercontent\.com$")
RETRY_REASONS = {"rateLimitExceeded", "userRateLimitExceeded", "backendError", "internalError"}
QUOTA_REASONS = {"storageQuotaExceeded", "quotaExceeded", "teamDriveFileLimitExceeded"}


# ---------------------------------------------------------------- tokens


class TokenSource(Protocol):
    def access_token(self, *, force_refresh: bool = False) -> str: ...


class RefreshTokenSource:
    """Access tokens from the stored refresh token (`grant_type=refresh_token`). The access token lives in this object only, until
    60 s before it expires. `invalid_grant` (revoked, expired after six months unused, or a consent screen still in Google's
    "Testing" status: seven days) is `gdrive_reconnect_required` - an administrator must connect again; nothing retries it."""

    def __init__(self, client_id: str, refresh_token: CredentialRef, http: httpx.Client, *, client_secret: CredentialRef | None = None,
                 secret_store: SecretLookup | None = None, clock: Callable[[], float] = time.monotonic, token_url: str = TOKEN_URL):
        if not CLIENT_ID_RE.fullmatch(client_id or ""):
            raise OffboxError("gdrive_client_missing", "no Google client id is configured")
        self.client_id = client_id
        self._refresh = refresh_token
        self._secret = client_secret
        self._store = secret_store
        self._http = http
        self._clock = clock
        self._url = token_url
        self._token: str | None = None
        self._expires = 0.0
        self.refreshes = 0

    def __repr__(self) -> str:
        return f"RefreshTokenSource(client_id={self.client_id!r})"

    def access_token(self, *, force_refresh: bool = False) -> str:
        if self._token and not force_refresh and self._clock() < self._expires - 60:
            return self._token
        form = {"grant_type": "refresh_token", "client_id": self.client_id, "refresh_token": self._refresh.resolve(self._store)}
        if self._secret is not None:
            form["client_secret"] = self._secret.resolve(self._store)
        try:
            resp = self._http.post(self._url, data=form)
        except httpx.HTTPError as exc:
            raise OffboxError("destination_unavailable", f"the token service did not answer ({type(exc).__name__})") from None
        self.refreshes += 1
        if resp.status_code >= 400:
            err = _json(resp).get("error")
            if err == "invalid_grant":
                raise OffboxError("gdrive_reconnect_required", "the Google connection was revoked or expired; connect again")
            if err in ("invalid_client", "unauthorized_client"):
                raise OffboxError("gdrive_client_invalid", "Google refused the client id / secret")
            if resp.status_code >= 500 or resp.status_code == 429:
                raise OffboxError("destination_unavailable", f"the token service answered HTTP {resp.status_code}")
            raise OffboxError("auth_failed", f"the token service refused the request (HTTP {resp.status_code})")
        body = _json(resp)
        token = body.get("access_token")
        if not isinstance(token, str) or not token:
            raise OffboxError("remote_error", "the token service answered without a token")
        try:
            ttl = max(0, min(int(body.get("expires_in") or 0), 24 * 3600))
        except (TypeError, ValueError):
            ttl = 0
        self._token, self._expires = token, self._clock() + ttl
        return token


# ---------------------------------------------------------------- the consent step (TODO behind an interface)


@dataclasses.dataclass(frozen=True)
class DeviceAuthorization:
    """What the administrator sees (user_code, verification_url) and what stays on the server (device_code - never returned)."""

    user_code: str
    verification_url: str
    expires_in: int
    interval: int
    device_code: str = dataclasses.field(repr=False)


@dataclasses.dataclass(frozen=True)
class PollResult:
    state: str  # pending | slow_down | connected | denied | expired
    refresh_token: str | None = dataclasses.field(default=None, repr=False)


class OAuthFlow(Protocol):
    def start(self, client_id: str, scope: str) -> DeviceAuthorization: ...
    def poll(self, client_id: str, auth: DeviceAuthorization) -> PollResult: ...


class NotImplementedFlow:
    """TODO(GDRIVEBK-OAUTH): the real consent flow. Planned: the OAuth 2.0 device authorization grant (POST DEVICE_CODE_URL with
    client_id + scope=drive.file -> user_code / verification_url; poll TOKEN_URL with grant_type=urn:ietf:params:oauth:grant-type:
    device_code until `authorization_pending` ends). Blocked on the owner's Google Cloud project / client id / consent-screen
    decisions (docs/design/GDRIVE_BACKUP.md section 9). Until then every call is refused with a fixed code; nothing calls Google."""

    def start(self, client_id: str, scope: str) -> DeviceAuthorization:
        raise OffboxError("gdrive_oauth_not_implemented", "the Google consent flow is not built yet")

    def poll(self, client_id: str, auth: DeviceAuthorization) -> PollResult:
        raise OffboxError("gdrive_oauth_not_implemented", "the Google consent flow is not built yet")


# ---------------------------------------------------------------- retries


@dataclasses.dataclass(frozen=True)
class RetryPolicy:
    max_retries: int = 5
    base_ms: int = 500
    max_ms: int = 32000

    def delay_s(self, attempt: int, rng: Callable[[], float] = random.random) -> float:
        ms = min(self.max_ms, self.base_ms * (2 ** attempt))
        return (ms + rng() * self.base_ms) / 1000.0  # full exponential + a little jitter


def _json(resp: httpx.Response) -> dict[str, Any]:
    try:
        body = json.loads(resp.content[:65536] or b"{}")
    except (ValueError, UnicodeDecodeError):
        return {}
    return body if isinstance(body, dict) else {}


def _reason(resp: httpx.Response) -> str:
    err = _json(resp).get("error")
    if isinstance(err, dict):
        errs = err.get("errors")
        if isinstance(errs, list) and errs and isinstance(errs[0], dict) and isinstance(errs[0].get("reason"), str):
            return errs[0]["reason"][:60]
        if isinstance(err.get("status"), str):
            return err["status"][:60]
    return ""


class _Retry(Exception):
    pass


# ---------------------------------------------------------------- the destination


class GDriveDestination:
    """One folder in the connected account's Drive (created by this app; `drive.file`). Objects are the SWXB copies
    (`<archive>.zip.swxb`) and the connection-test markers; `list()` shows the copies only. Drive allows two files with one name:
    `put` removes the older file(s) of the same name after the new one landed, and `get` reads the newest."""

    kind = "gdrive"

    def __init__(self, tokens: TokenSource, http: httpx.Client, *, folder_name: str, folder_id: str | None = None,
                 chunk_bytes: int = 8 * 1024 * 1024, simple_max_bytes: int = 5 * 1024 * 1024, retry: RetryPolicy | None = None,
                 quota_margin_pct: int = 10, min_free_bytes: int = 100 * 1024 * 1024, prune_mode: str = "delete",
                 sleep: Callable[[float], None] = time.sleep, api: str = DRIVE_API):
        if not FOLDER_NAME_RE.fullmatch(folder_name or ""):
            raise OffboxError("destination_invalid", "folder name not valid")
        if chunk_bytes < GRANULE or chunk_bytes % GRANULE:
            raise OffboxError("destination_invalid", "chunk size must be a multiple of 256 KiB")
        if prune_mode not in ("delete", "trash"):
            raise OffboxError("destination_invalid", "prune_mode must be delete | trash")
        if folder_id is not None and not re.fullmatch(r"[A-Za-z0-9_-]{1,200}", folder_id):
            folder_id = None
        self.tokens, self.http = tokens, http
        self.folder_name, self.folder_id = folder_name, folder_id
        self.chunk_bytes, self.simple_max_bytes = chunk_bytes, simple_max_bytes
        self.retry = retry or RetryPolicy()
        self.quota_margin_pct, self.min_free_bytes = quota_margin_pct, min_free_bytes
        self.prune_mode = prune_mode
        self._sleep = sleep
        self._api = api.rstrip("/")
        self.resumed_chunks = 0  # observability for tests and the run detail: how many chunk retries a push needed

    def describe(self) -> dict[str, Any]:
        return {"kind": self.kind, "folder_name": self.folder_name, "folder_id": self.folder_id, "prune_mode": self.prune_mode}

    def __repr__(self) -> str:
        return f"GDriveDestination({self.describe()!r})"

    def close(self) -> None:
        return None  # the runtime owns the httpx client

    # ---- HTTP with auth refresh, backoff and fixed error codes

    def _send(self, method: str, url: str, *, params: dict[str, str] | None = None, json_body: Any = None, content: Any = None,
              headers: dict[str, str] | None = None, ok: tuple[int, ...] = (200,), stream: bool = False,
              retry: bool = True) -> httpx.Response:
        """`retry=False`: no backoff loop here (a resumable chunk: its caller asks the session before sending again)."""
        refreshed = False
        attempt = 0
        while True:
            h = dict(headers or {})
            h["Authorization"] = f"Bearer {self.tokens.access_token()}"
            try:
                req = self.http.build_request(method, url, params=params, json=json_body, content=content, headers=h)
                resp = self.http.send(req, stream=stream)
            except httpx.HTTPError as exc:
                if retry and attempt < self.retry.max_retries:
                    self._sleep(self.retry.delay_s(attempt))
                    attempt += 1
                    continue
                raise OffboxError("destination_unavailable", f"Google Drive did not answer ({type(exc).__name__})") from None
            if resp.status_code in ok:
                return resp
            if stream:
                resp.read()
            resp.close()
            if resp.status_code == 401 and not refreshed:
                refreshed, attempt = True, 0
                self.tokens.access_token(force_refresh=True)
                continue
            if resp.status_code == 401:
                raise OffboxError("auth_failed", "Google Drive refused the access token")
            reason = _reason(resp)
            if reason in QUOTA_REASONS and resp.status_code == 403:
                raise OffboxError("quota_exceeded", "the Google Drive storage is full")
            transient = resp.status_code in (429, 500, 502, 503, 504) or (resp.status_code == 403 and reason in RETRY_REASONS)
            if transient and retry and attempt < self.retry.max_retries:
                self._sleep(self.retry.delay_s(attempt))
                attempt += 1
                continue
            if transient:
                raise OffboxError("destination_unavailable", f"Google Drive kept answering HTTP {resp.status_code} {reason}".strip())
            if resp.status_code == 404:
                raise OffboxError("object_missing", "the object is not in the Drive folder")
            if resp.status_code == 403:
                raise OffboxError("permission_denied", f"Google Drive refused the operation ({reason or 403})")
            raise OffboxError("remote_error", f"Google Drive answered HTTP {resp.status_code} {reason}".strip())

    def _files_url(self, file_id: str = "") -> str:
        return f"{self._api}/drive/v3/files" + (f"/{file_id}" if file_id else "")

    # ---- the folder

    def ensure_folder(self) -> str:
        """The folder id: the remembered one if it still exists and is not trashed, else the app's folder of that name, else a new one.
        The runtime persists the id (settings `backup.gdrive.state`)."""
        if self.folder_id:
            try:
                meta = _json(self._send("GET", self._files_url(self.folder_id), params={"fields": "id,trashed,mimeType"}))
                if not meta.get("trashed") and meta.get("mimeType") == FOLDER_MIME:
                    return self.folder_id
            except OffboxError as exc:
                if exc.code != "object_missing":
                    raise
            self.folder_id = None
        q = f"name = '{self.folder_name}' and mimeType = '{FOLDER_MIME}' and trashed = false"
        found = _json(self._send("GET", self._files_url(), params={"q": q, "fields": "files(id,name,createdTime)", "spaces": "drive",
                                                                     "orderBy": "createdTime", "pageSize": "10"})).get("files") or []
        if found and isinstance(found[0], dict) and found[0].get("id"):
            self.folder_id = str(found[0]["id"])
            return self.folder_id
        made = _json(self._send("POST", self._files_url(), params={"fields": "id"}, json_body={"name": self.folder_name, "mimeType": FOLDER_MIME}))
        fid = made.get("id")
        if not isinstance(fid, str) or not fid:
            raise OffboxError("remote_error", "Google Drive did not return the new folder")
        self.folder_id = fid
        log.info("Google Drive backup folder created")
        return fid

    def _files(self, name: str | None = None) -> list[dict[str, Any]]:
        fid = self.ensure_folder()
        q = f"'{fid}' in parents and trashed = false" + (f" and name = '{check_name(name, marker_ok=True)}'" if name else "")
        out: list[dict[str, Any]] = []
        params = {"q": q, "fields": "nextPageToken,files(id,name,size,createdTime)", "spaces": "drive", "pageSize": "1000"}
        for _ in range(MAX_PAGES):  # a misbehaving server can never loop us forever
            page = _json(self._send("GET", self._files_url(), params=params))
            out.extend(f for f in page.get("files") or [] if isinstance(f, dict) and f.get("id") and isinstance(f.get("name"), str))
            token = page.get("nextPageToken")
            if not token:
                break
            params = {**params, "pageToken": str(token)}
        out.sort(key=lambda f: (str(f.get("createdTime") or ""), str(f["id"])), reverse=True)  # newest first
        return out

    # ---- Destination

    def list(self) -> list[RemoteObject]:
        seen: dict[str, RemoteObject] = {}
        for f in self._files():
            if OBJECT_RE.fullmatch(f["name"]) and f["name"] not in seen:
                try:
                    size = int(f.get("size") or 0)
                except (TypeError, ValueError):
                    size = 0
                seen[f["name"]] = RemoteObject(f["name"], size)
        return sorted(seen.values(), key=lambda o: o.name)

    def free_bytes(self) -> int | None:
        """Free space by `about.storageQuota` (None: no limit reported - e.g. some Workspace plans)."""
        q = _json(self._send("GET", f"{self._api}/drive/v3/about", params={"fields": "storageQuota"})).get("storageQuota") or {}
        try:
            limit = int(q["limit"]) if q.get("limit") not in (None, "") else None
            usage = int(q.get("usage") or 0)
        except (TypeError, ValueError):
            return None
        return None if limit is None else max(0, limit - usage)

    def _check_quota(self, size: int) -> None:
        free = self.free_bytes()
        if free is None:
            return
        need = size + (size * self.quota_margin_pct) // 100 + self.min_free_bytes
        if free < need:
            raise OffboxError("quota_exceeded", "the Google Drive storage does not have room for this copy")

    def put(self, src: Path, name: str) -> RemoteObject:
        name = check_name(name, marker_ok=True)
        size = Path(src).stat().st_size
        fid = self.ensure_folder()
        if OBJECT_RE.fullmatch(name):  # the marker is a few bytes: no quota round trip for it
            self._check_quota(size)
        older = [f["id"] for f in self._files(name)]
        meta = {"name": name, "parents": [fid]}
        new_id = self._multipart(src, meta) if size <= self.simple_max_bytes else self._resumable(src, size, meta)
        for old in older:
            if old != new_id:
                self._remove(old)
        return RemoteObject(name, size)

    def _multipart(self, src: Path, meta: dict[str, Any]) -> str:
        boundary = "arx" + secrets.token_hex(12)
        body = (f"--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{json.dumps(meta)}\r\n"
                f"--{boundary}\r\nContent-Type: application/octet-stream\r\n\r\n").encode() + Path(src).read_bytes() + f"\r\n--{boundary}--\r\n".encode()
        resp = self._send("POST", f"{self._api}/upload/drive/v3/files", params={"uploadType": "multipart", "fields": "id,size"}, content=body,
                          headers={"Content-Type": f"multipart/related; boundary={boundary}"}, ok=(200, 201))
        return self._new_id(resp)

    @staticmethod
    def _new_id(resp: httpx.Response) -> str:
        fid = _json(resp).get("id")
        if not isinstance(fid, str) or not fid:
            raise OffboxError("remote_error", "Google Drive did not return the uploaded file")
        return fid

    def _start_session(self, size: int, meta: dict[str, Any]) -> str:
        resp = self._send("POST", f"{self._api}/upload/drive/v3/files", params={"uploadType": "resumable", "fields": "id,size"}, json_body=meta,
                          headers={"X-Upload-Content-Type": "application/octet-stream", "X-Upload-Content-Length": str(size)})
        loc = resp.headers.get("location") or ""
        if not loc.startswith(self._api + "/upload/"):  # never follow a session URL to another host
            raise OffboxError("remote_error", "Google Drive did not return an upload session")
        return loc

    @staticmethod
    def _offset(resp: httpx.Response) -> int:
        m = re.fullmatch(r"bytes=0-(\d+)", resp.headers.get("range") or "")
        return int(m.group(1)) + 1 if m else 0

    def _resumable(self, src: Path, size: int, meta: dict[str, Any]) -> str:
        """Upload in chunks; after a failed chunk ask the session (`Content-Range: bytes */size`) how much it holds and go on from
        there. A session Drive no longer knows (404 / 410) restarts the upload once. The session URL is a capability: never logged."""
        restarts = 0
        session = self._start_session(size, meta)
        offset = 0
        failures = 0
        with open(src, "rb") as f:
            while True:
                f.seek(offset)
                data = f.read(self.chunk_bytes)
                end = offset + len(data) - 1
                headers = {"Content-Range": f"bytes {offset}-{end}/{size}" if data else f"bytes */{size}"}
                try:
                    resp = self._send("PUT", session, content=data, headers=headers, ok=(200, 201, 308), retry=False)
                except OffboxError as exc:
                    if exc.code not in ("destination_unavailable", "remote_error", "object_missing"):
                        raise
                    failures += 1
                    if failures > self.retry.max_retries:
                        raise OffboxError("destination_unavailable", "the resumable upload kept failing") from None
                    self._sleep(self.retry.delay_s(failures - 1))
                    status = self._session_status(session, size)
                    if status is None:  # the session is gone: start over, once
                        restarts += 1
                        if restarts > 1:
                            raise OffboxError("destination_unavailable", "the upload session expired twice") from None
                        session, offset = self._start_session(size, meta), 0
                        continue
                    if isinstance(status, str):
                        return status
                    self.resumed_chunks += 1
                    offset = status
                    continue
                if resp.status_code in (200, 201):
                    return self._new_id(resp)
                offset = self._offset(resp)

    def _session_status(self, session: str, size: int) -> int | str | None:
        """int: the next offset; str: the upload had completed (the file id); None: the session is gone."""
        try:
            resp = self._send("PUT", session, content=b"", headers={"Content-Range": f"bytes */{size}"}, ok=(200, 201, 308, 404, 410))
        except OffboxError:
            return 0  # still unreachable: retry the chunk from the start of what we know
        if resp.status_code in (404, 410):
            return None
        if resp.status_code in (200, 201):
            return self._new_id(resp)
        return self._offset(resp)

    def get(self, name: str, dest: Path) -> None:
        files = self._files(check_name(name, marker_ok=True))
        if not files:
            raise OffboxError("object_missing", "the object is not in the Drive folder")
        resp = self._send("GET", self._files_url(files[0]["id"]), params={"alt": "media"}, stream=True)
        try:
            with open(dest, "wb") as out:
                for chunk in resp.iter_bytes(CHUNK):
                    out.write(chunk)
        except httpx.HTTPError:
            Path(dest).unlink(missing_ok=True)
            raise OffboxError("destination_unavailable", "the download was interrupted") from None
        finally:
            resp.close()

    def _remove(self, file_id: str) -> None:
        try:
            if self.prune_mode == "trash":
                self._send("PATCH", self._files_url(file_id), json_body={"trashed": True}, params={"fields": "id"})
            else:
                self._send("DELETE", self._files_url(file_id), ok=(200, 204))
        except OffboxError as exc:
            if exc.code != "object_missing":
                raise

    def delete(self, name: str) -> None:
        for f in self._files(check_name(name, marker_ok=True)):
            self._remove(f["id"])


def revoke(http: httpx.Client, token: str, url: str = REVOKE_URL) -> bool:
    """Best effort: ask Google to revoke the refresh token on disconnect. False when Google could not be told (the local copy is
    removed anyway; the owner can also revoke at myaccount.google.com > Security > Third-party access)."""
    try:
        resp = http.post(url, data={"token": token})
    except httpx.HTTPError:
        return False
    return resp.status_code in (200, 400)  # 400 = already invalid: revoked as far as anyone can tell
