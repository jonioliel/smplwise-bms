"""GDRIVEBK-295 / GDRIVEBK-2310: an in-memory fake of the parts of Google Drive v3 and Google's OAuth token endpoint that
services/offbox_gdrive.py speaks, served through `httpx.MockTransport(FakeDrive().handler)`. Nothing here opens a socket; a request
to any other host is answered 599 and recorded in `foreign`, so a test can assert that no call left the fake.

Covered: the OAuth 2.0 device authorization grant (`/device/code`, then `/token` with the device-code grant answering
`authorization_pending`, `slow_down`, `access_denied`, `expired_token` or the tokens, per `device_script`), token refresh
(refresh_token grant; `revoked` -> invalid_grant; the client secret is checked), revoke, files.list with the `q` forms the adapter sends
(folder by name, children of a folder, a child by name; pagination by `page_size`), folder create, file metadata, alt=media, delete,
trash (PATCH trashed), multipart upload, resumable upload (session, 256 KiB-aligned chunks, 308 + Range, status query), about.storageQuota.

Failure knobs: `quota_limit` (bytes; uploads beyond it answer 403 storageQuotaExceeded), `fail_chunk` (answer 503 to these chunk
numbers once each), `expire_session_after_chunk` (the session forgets itself after that chunk: 404), `expire_access_once` (the next
API call answers 401 although the token is valid), `rate_limit_once` (the next API call answers 403 userRateLimitExceeded),
`revoked` (the refresh token no longer works)."""
from __future__ import annotations

import json
import re
import secrets
import urllib.parse
from dataclasses import dataclass, field
from typing import Any

import httpx

REFRESH_TOKEN = "fake-refresh-token-0123456789"
CLIENT_ID = "1234567890-fakeclientid.apps.googleusercontent.com"
CLIENT_SECRET = "GOCSPX-fake-client-secret-value"
DEVICE_CODE = "AH-fake-device-code-0123456789"
USER_CODE = "ABCD-EFGH"
DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code"
SCOPE = "https://www.googleapis.com/auth/drive.file"
FOLDER_MIME = "application/vnd.google-apps.folder"


@dataclass
class FakeFile:
    id: str
    name: str
    parents: list[str]
    mime: str
    data: bytes = b""
    trashed: bool = False
    created: int = 0


@dataclass
class Session:
    meta: dict[str, Any]
    size: int
    data: bytearray = field(default_factory=bytearray)
    chunks: int = 0


class FakeDrive:
    def __init__(self) -> None:
        self.files: dict[str, FakeFile] = {}
        self.sessions: dict[str, Session] = {}
        self.tokens: set[str] = set()
        self.refresh_calls = 0
        self.revoked = False
        self.revoke_calls: list[str] = []
        self.quota_limit: int | None = None
        self.report_limit = True  # False: about.storageQuota shows no limit, the upload still hits it (Drive's own refusal)
        self.fail_chunk: set[int] = set()
        self.expire_session_after_chunk: int | None = None
        self.expire_access_once = False
        self.rate_limit_once = False
        self.rate_limit_always = False  # every API call answers 429 (the retries run out)
        self.page_size: int | None = None
        self.calls: list[tuple[str, str]] = []
        # the device flow: each poll pops the next answer (pending | slow_down | approve | deny | expire); empty = pending
        self.device_script: list[str] = []
        self.device_starts: list[dict[str, str]] = []
        self.granted_scope = SCOPE
        self.foreign: list[str] = []
        self._clock = 0

    # ---- helpers

    def usage(self) -> int:
        return sum(len(f.data) for f in self.files.values())

    def children(self, folder_id: str, *, include_trashed: bool = False) -> list[FakeFile]:
        return [f for f in self.files.values() if folder_id in f.parents and (include_trashed or not f.trashed)]

    def by_name(self, name: str) -> list[FakeFile]:
        return [f for f in self.files.values() if f.name == name and not f.trashed]

    def _new_id(self) -> str:
        return "f" + secrets.token_hex(8)

    def _tick(self) -> int:
        self._clock += 1
        return self._clock

    def _created(self, f: FakeFile) -> str:
        return f"2026-10-25T10:{f.created // 60:02d}:{f.created % 60:02d}.000Z"

    @staticmethod
    def _err(status: int, reason: str = "", message: str = "") -> httpx.Response:
        body = {"error": {"code": status, "message": message or reason, "errors": [{"reason": reason}] if reason else []}}
        return httpx.Response(status, json=body)

    # ---- the transport

    def handler(self, request: httpx.Request) -> httpx.Response:
        url = request.url
        host = url.host
        self.calls.append((request.method, url.path))
        if host == "oauth2.googleapis.com":
            return self._oauth(request)
        if host != "www.googleapis.com":
            self.foreign.append(str(host))
            return httpx.Response(599)
        auth = request.headers.get("authorization", "")
        if not auth.startswith("Bearer ") or auth[7:] not in self.tokens:
            return self._err(401, "authError", "Invalid Credentials")
        if self.expire_access_once:
            self.expire_access_once = False
            self.tokens.discard(auth[7:])
            return self._err(401, "authError", "Invalid Credentials")
        if self.rate_limit_always:
            return self._err(429, "rateLimitExceeded")
        if self.rate_limit_once:
            self.rate_limit_once = False
            return self._err(403, "userRateLimitExceeded")
        path = url.path
        if path == "/drive/v3/about":
            q: dict[str, Any] = {"usage": str(self.usage())}
            if self.quota_limit is not None and self.report_limit:
                q["limit"] = str(self.quota_limit)
            return httpx.Response(200, json={"storageQuota": q})
        if path == "/drive/v3/files" and request.method == "GET":
            return self._list(request)
        if path == "/drive/v3/files" and request.method == "POST":
            meta = json.loads(request.content or b"{}")
            f = FakeFile(self._new_id(), meta["name"], list(meta.get("parents") or ["root"]), meta.get("mimeType") or "application/octet-stream",
                         created=self._tick())
            self.files[f.id] = f
            return httpx.Response(200, json={"id": f.id})
        m = re.fullmatch(r"/drive/v3/files/([A-Za-z0-9_-]+)", path)
        if m:
            return self._file(request, m.group(1))
        if path == "/upload/drive/v3/files":
            kind = url.params.get("uploadType")
            if kind == "multipart":
                return self._multipart(request)
            if kind == "resumable" and request.method == "POST":
                return self._start(request)
            if kind == "resumable" and request.method == "PUT":
                return self._chunk(request, url.params.get("upload_id") or "")
        return self._err(400, "badRequest")

    def _oauth(self, request: httpx.Request) -> httpx.Response:
        form = {k: v[0] for k, v in urllib.parse.parse_qs(request.content.decode()).items()}
        if request.url.path == "/revoke":
            self.revoke_calls.append("token" if form.get("token") else "")
            self.revoked = True
            return httpx.Response(200, json={})
        if request.url.path == "/device/code":
            self.device_starts.append(form)
            if form.get("client_id") != CLIENT_ID:
                return httpx.Response(401, json={"error": "invalid_client"})
            if form.get("scope") != SCOPE:
                return httpx.Response(400, json={"error": "invalid_scope"})
            return httpx.Response(200, json={"device_code": DEVICE_CODE, "user_code": USER_CODE, "verification_url": "https://www.google.com/device",
                                             "expires_in": 1800, "interval": 5})
        if request.url.path != "/token":
            return self._err(404)
        self.refresh_calls += 1
        if form.get("client_id") != CLIENT_ID or form.get("client_secret") != CLIENT_SECRET:
            return httpx.Response(401, json={"error": "invalid_client"})
        if form.get("grant_type") == DEVICE_GRANT:
            if form.get("device_code") != DEVICE_CODE:
                return httpx.Response(400, json={"error": "invalid_grant"})
            step = self.device_script.pop(0) if self.device_script else "pending"
            if step == "pending":
                return httpx.Response(428, json={"error": "authorization_pending"})
            if step == "slow_down":
                return httpx.Response(403, json={"error": "slow_down"})
            if step == "deny":
                return httpx.Response(403, json={"error": "access_denied"})
            if step == "expire":
                return httpx.Response(400, json={"error": "expired_token"})
            self.revoked = False
            tok = "ya29.fake-" + secrets.token_hex(8)
            self.tokens.add(tok)
            return httpx.Response(200, json={"access_token": tok, "expires_in": 3599, "refresh_token": REFRESH_TOKEN, "scope": self.granted_scope,
                                             "token_type": "Bearer"})
        if form.get("grant_type") != "refresh_token" or form.get("refresh_token") != REFRESH_TOKEN or self.revoked:
            return httpx.Response(400, json={"error": "invalid_grant", "error_description": "Token has been expired or revoked."})
        tok = "ya29.fake-" + secrets.token_hex(8)
        self.tokens.add(tok)
        return httpx.Response(200, json={"access_token": tok, "expires_in": 3599, "scope": SCOPE, "token_type": "Bearer"})

    def _list(self, request: httpx.Request) -> httpx.Response:
        q = request.url.params.get("q") or ""
        items: list[FakeFile]
        m_folder = re.fullmatch(r"name = '([^']+)' and mimeType = '" + re.escape(FOLDER_MIME) + r"' and trashed = false", q)
        m_child = re.fullmatch(r"'([^']+)' in parents and trashed = false(?: and name = '([^']+)')?", q)
        if m_folder:
            items = [f for f in self.files.values() if f.name == m_folder.group(1) and f.mime == FOLDER_MIME and not f.trashed]
        elif m_child:
            items = self.children(m_child.group(1))
            if m_child.group(2):
                items = [f for f in items if f.name == m_child.group(2)]
        else:
            return self._err(400, "invalidQuery")
        items.sort(key=lambda f: f.created)
        size = self.page_size or int(request.url.params.get("pageSize") or 100)
        start = int(request.url.params.get("pageToken") or 0)
        page = items[start:start + size]
        body: dict[str, Any] = {"files": [{"id": f.id, "name": f.name, "size": str(len(f.data)), "createdTime": self._created(f)} for f in page]}
        if start + size < len(items):
            body["nextPageToken"] = str(start + size)
        return httpx.Response(200, json=body)

    def _file(self, request: httpx.Request, fid: str) -> httpx.Response:
        f = self.files.get(fid)
        if f is None:
            return self._err(404, "notFound")
        if request.method == "DELETE":
            del self.files[fid]
            return httpx.Response(204)
        if request.method == "PATCH":
            body = json.loads(request.content or b"{}")
            if "trashed" in body:
                f.trashed = bool(body["trashed"])
            return httpx.Response(200, json={"id": f.id})
        if request.url.params.get("alt") == "media":
            return httpx.Response(200, content=f.data)
        return httpx.Response(200, json={"id": f.id, "name": f.name, "mimeType": f.mime, "trashed": f.trashed})

    def _room(self, n: int) -> bool:
        return self.quota_limit is None or self.usage() + n <= self.quota_limit

    def _multipart(self, request: httpx.Request) -> httpx.Response:
        ctype = request.headers.get("content-type", "")
        m = re.search(r"boundary=([A-Za-z0-9]+)", ctype)
        if not ctype.startswith("multipart/related") or not m:
            return self._err(400, "badContent")
        b = m.group(1).encode()
        parts = request.content.split(b"--" + b)
        meta_part, data_part = parts[1], parts[2]
        meta = json.loads(meta_part.split(b"\r\n\r\n", 1)[1].rstrip(b"\r\n"))
        data = data_part.split(b"\r\n\r\n", 1)[1]
        data = data[:-2] if data.endswith(b"\r\n") else data
        if not self._room(len(data)):
            return self._err(403, "storageQuotaExceeded", "The user's Drive storage quota has been exceeded.")
        f = FakeFile(self._new_id(), meta["name"], list(meta.get("parents") or ["root"]), "application/octet-stream", data, created=self._tick())
        self.files[f.id] = f
        return httpx.Response(200, json={"id": f.id, "size": str(len(data))})

    def _start(self, request: httpx.Request) -> httpx.Response:
        meta = json.loads(request.content or b"{}")
        size = int(request.headers.get("x-upload-content-length") or -1)
        if size < 0:
            return self._err(400, "badRequest")
        if not self._room(size):
            return self._err(403, "storageQuotaExceeded")
        sid = secrets.token_hex(10)
        self.sessions[sid] = Session(meta, size)
        return httpx.Response(200, headers={"Location": f"https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id={sid}"})

    def _chunk(self, request: httpx.Request, sid: str) -> httpx.Response:
        s = self.sessions.get(sid)
        if s is None:
            return self._err(404, "notFound")
        cr = request.headers.get("content-range", "")
        m_status = re.fullmatch(r"bytes \*/(\d+)", cr)
        if m_status:
            if len(s.data) >= s.size:
                return self._finish(sid, s)
            return httpx.Response(308, headers={"Range": f"bytes=0-{len(s.data) - 1}"} if s.data else {})
        m = re.fullmatch(r"bytes (\d+)-(\d+)/(\d+)", cr)
        if not m or int(m.group(3)) != s.size:
            return self._err(400, "badContentRange")
        start, end = int(m.group(1)), int(m.group(2))
        body = request.content
        if start != len(s.data) or end - start + 1 != len(body):
            return self._err(400, "badContentRange")
        last = end + 1 == s.size
        if not last and len(body) % (256 * 1024):
            return self._err(400, "chunkNotAligned")
        s.chunks += 1
        if s.chunks in self.fail_chunk:
            self.fail_chunk.discard(s.chunks)
            # a 503 after half the chunk arrived: the session holds a 256 KiB-aligned part of it
            keep = (len(body) // 2) // (256 * 1024) * (256 * 1024)
            s.data.extend(body[:keep])
            return self._err(503, "backendError")
        s.data.extend(body)
        if self.expire_session_after_chunk is not None and s.chunks >= self.expire_session_after_chunk:
            self.expire_session_after_chunk = None
            del self.sessions[sid]
            return self._err(404, "notFound")
        if last:
            return self._finish(sid, s)
        return httpx.Response(308, headers={"Range": f"bytes=0-{len(s.data) - 1}"})

    def _finish(self, sid: str, s: Session) -> httpx.Response:
        f = FakeFile(self._new_id(), s.meta["name"], list(s.meta.get("parents") or ["root"]), "application/octet-stream", bytes(s.data),
                     created=self._tick())
        self.files[f.id] = f
        self.sessions.pop(sid, None)
        return httpx.Response(200, json={"id": f.id, "size": str(len(f.data))})
