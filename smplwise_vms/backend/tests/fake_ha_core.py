"""A fake Home Assistant core for CR-008 (SmplWise Arx remote sign-in): the parts of HA's auth API the Arx login page
and the add-on use, with HA's own shapes (homeassistant/components/auth/{__init__,login_flow}.py, HA frontend
src/data/auth.ts). Shared by the backend tests (tests/test_remote_access.py) and the Playwright fixture backend
(frontend/tests/fixtures/arx_fake_ha.py). No real Home Assistant is ever reached.

- `GET /auth/providers`, `POST /auth/login_flow` (PKCE S256), `POST /auth/login_flow/{flow_id}` (username/password,
  then the `mfa` step for a user with MFA; `invalid_auth` / `invalid_code` like HA), `POST /auth/token`
  (authorization_code with code_verifier, refresh_token, `action=revoke`), all as pure functions plus a tiny HTTP server;
- the WebSocket API's `auth` + `auth/current_user` (+ `auth/delete_refresh_token`, CR-008 P2) as an in-process socket (`dial`) that ha_user_auth._dial is swapped
  for.

Access tokens are JWT-shaped (header.payload.signature, `exp` in the payload) so the add-on's structural pre-check
passes; the signature is random and only this fake knows which tokens are valid.
"""
from __future__ import annotations

import base64
import hashlib
import json
import re
import secrets
import threading
import time
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def make_jwt(exp: float, sub: str = "refresh-id") -> str:
    header = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64(json.dumps({"iss": sub, "iat": int(time.time()), "exp": int(exp)}).encode())
    return f"{header}.{payload}.{_b64(secrets.token_bytes(24))}"


@dataclass
class FakeUser:
    id: str
    username: str
    password: str
    name: str
    is_owner: bool = False
    is_admin: bool = False
    mfa_code: str | None = None  # a user with MFA: the one code the fake accepts
    active: bool = True


@dataclass
class _Refresh:
    token: str
    user_id: str
    client_id: str
    revoked: bool = False


@dataclass
class FakeHaCore:
    users: dict[str, FakeUser] = field(default_factory=dict)
    access_lifetime_s: int = 1800
    lock: threading.Lock = field(default_factory=threading.Lock)
    _flows: dict[str, dict[str, Any]] = field(default_factory=dict)
    _codes: dict[str, dict[str, Any]] = field(default_factory=dict)
    _refresh: dict[str, _Refresh] = field(default_factory=dict)
    _access: dict[str, tuple[str, float]] = field(default_factory=dict)  # token -> (refresh token, exp)
    dials: list[dict[str, Any]] = field(default_factory=list)  # every WebSocket the add-on opened (url, headers)
    requests: list[tuple[str, str]] = field(default_factory=list)  # every HTTP call (method, path)
    deleted_refresh: list[str] = field(default_factory=list)  # refresh-token ids deleted over the WebSocket API

    def add_user(self, user: FakeUser) -> FakeUser:
        with self.lock:
            self.users[user.id] = user
        return user

    # ---------------------------------------------------------- tokens

    def issue(self, user_id: str, client_id: str = "http://testserver/arx/") -> dict[str, Any]:
        """A refresh token and a first access token for `user_id` (what a finished login flow ends with)."""
        with self.lock:
            rt = _Refresh(token=secrets.token_hex(32), user_id=user_id, client_id=client_id)
            self._refresh[rt.token] = rt
        return self._access_for(rt)

    def _access_for(self, rt: _Refresh) -> dict[str, Any]:
        exp = time.time() + self.access_lifetime_s
        token = make_jwt(exp, sub=rt.token[:12])
        with self.lock:
            self._access[token] = (rt.token, exp)
        return {"access_token": token, "expires_in": self.access_lifetime_s, "refresh_token": rt.token, "token_type": "Bearer", "ha_auth_provider": "homeassistant"}

    def revoke_refresh(self, refresh_token: str) -> None:
        """What deleting the client in the HA profile (or `action=revoke`) does: its access tokens stop working."""
        with self.lock:
            rt = self._refresh.get(refresh_token)
            if rt:
                rt.revoked = True

    def revoke_user(self, user_id: str) -> None:
        with self.lock:
            for rt in self._refresh.values():
                if rt.user_id == user_id:
                    rt.revoked = True

    def user_of(self, access_token: str) -> FakeUser | None:
        with self.lock:
            entry = self._access.get(access_token)
            if not entry or entry[1] <= time.time():
                return None
            rt = self._refresh.get(entry[0])
            if not rt or rt.revoked:
                return None
            user = self.users.get(rt.user_id)
        return user if user and user.active else None

    def refresh_tokens_of(self, user_id: str) -> list[str]:
        with self.lock:
            return [t for t, rt in self._refresh.items() if rt.user_id == user_id and not rt.revoked]

    # ---------------------------------------------------------- the login flow (HA's JSON shapes)

    def providers(self) -> dict[str, Any]:
        return {"providers": [{"name": "Home Assistant Local", "id": None, "type": "homeassistant"}], "preselect_remember_me": True}

    @staticmethod
    def _form(flow_id: str, step: str, errors: dict[str, str] | None = None) -> dict[str, Any]:
        schema = ([{"type": "string", "name": "username", "required": True}, {"type": "string", "name": "password", "required": True}]
                  if step == "init" else [{"type": "string", "name": "code", "required": True}])
        return {"type": "form", "flow_id": flow_id, "handler": ["homeassistant", None], "step_id": step, "data_schema": schema,
                "errors": errors or {}, "description_placeholders": {"mfa_module_name": "Authenticator app"} if step == "mfa" else None,
                "last_step": None, "preview": None}

    # HA core dev, homeassistant/components/auth/login_flow.py (read 2026-09-29): LoginFlowIndexView.post's
    # RequestDataValidator schema - no extra keys (a plain Schema), handler a 2-list, code_challenge 43 base64url chars,
    # a challenge requires code_challenge_method S256 ('plain' is refused, RFC 7636 4.3).
    START_KEYS = {"client_id", "handler", "redirect_uri", "code_challenge", "code_challenge_method", "type"}
    CHALLENGE_RE = re.compile(r"^[A-Za-z0-9_-]{43}\Z")

    def start_flow(self, body: dict[str, Any]) -> tuple[int, dict[str, Any]]:
        extra = sorted(set(body) - self.START_KEYS)
        if extra:
            return 400, {"message": f"Message format incorrect: extra keys not allowed @ data['{extra[0]}']"}
        for key in ("client_id", "handler", "redirect_uri"):
            if key not in body:
                return 400, {"message": f"Message format incorrect: required key not provided @ data['{key}']"}
        handler = body["handler"]
        if not isinstance(handler, list) or len(handler) != 2 or not all(h is None or isinstance(h, str) for h in handler):
            return 400, {"message": "Message format incorrect: handler"}
        if "code_challenge" in body and not (isinstance(body["code_challenge"], str) and self.CHALLENGE_RE.match(body["code_challenge"])):
            return 400, {"message": "Message format incorrect: code_challenge"}
        if "code_challenge" in body and body.get("code_challenge_method") != "S256":
            return 400, {"message": "code_challenge_method must be S256"}
        client_id, redirect_uri = body.get("client_id"), body.get("redirect_uri")
        if not isinstance(client_id, str) or not isinstance(redirect_uri, str) or urlparse(client_id).netloc != urlparse(redirect_uri).netloc:
            return 400, {"message": "Invalid redirect URI"}
        if handler[0] != "homeassistant":
            return 404, {"message": "Invalid handler specified"}
        flow_id = secrets.token_hex(16)
        with self.lock:
            self._flows[flow_id] = {"client_id": client_id, "challenge": body.get("code_challenge"), "method": body.get("code_challenge_method"),
                                    "step": "init", "user": None}
        return 200, self._form(flow_id, "init")

    def step_flow(self, flow_id: str, body: dict[str, Any]) -> tuple[int, dict[str, Any]]:
        with self.lock:
            flow = self._flows.get(flow_id)
        if not flow:
            return 404, {"message": "Invalid flow specified"}
        if body.get("client_id") != flow["client_id"]:
            return 400, {"message": "Invalid client id"}
        if flow["step"] == "init":
            user = next((u for u in self.users.values() if u.username == body.get("username") and u.password == body.get("password")), None)
            if user is None or not user.active:
                return 200, self._form(flow_id, "init", {"base": "invalid_auth"})
            flow["user"] = user.id
            if user.mfa_code:
                flow["step"] = "mfa"
                return 200, self._form(flow_id, "mfa")
        elif flow["step"] == "mfa":
            user = self.users[flow["user"]]
            if body.get("code") != user.mfa_code:
                return 200, self._form(flow_id, "mfa", {"base": "invalid_code"})
        code = secrets.token_hex(16)
        with self.lock:
            self._codes[code] = {"user": flow["user"], "client_id": flow["client_id"], "challenge": flow["challenge"]}
            self._flows.pop(flow_id, None)
        return 200, {"type": "create_entry", "flow_id": flow_id, "handler": ["homeassistant", None], "result": code, "description": None,
                     "description_placeholders": None, "context": {}, "title": "", "minor_version": 1, "options": {}, "version": 1}

    def token(self, form: dict[str, str]) -> tuple[int, dict[str, Any]]:
        if form.get("action") == "revoke":
            self.revoke_refresh(form.get("token", ""))
            return 200, {}
        grant = form.get("grant_type")
        if grant == "authorization_code":
            with self.lock:
                entry = self._codes.pop(form.get("code", ""), None)
            if not entry or entry["client_id"] != form.get("client_id"):
                return 400, {"error": "invalid_request", "error_description": "Invalid code"}
            if entry["challenge"]:  # auth/__init__.py _async_handle_auth_code: a challenge requires a matching verifier
                verifier = form.get("code_verifier", "")
                if not verifier:
                    return 400, {"error": "invalid_request", "error_description": "Missing code verifier"}
                if _b64(hashlib.sha256(verifier.encode()).digest()) != entry["challenge"]:
                    return 400, {"error": "invalid_grant", "error_description": "Invalid code verifier"}
            return 200, self.issue(entry["user"], entry["client_id"])
        if grant == "refresh_token":
            with self.lock:
                rt = self._refresh.get(form.get("refresh_token", ""))
            if not rt or rt.revoked:
                return 400, {"error": "invalid_grant"}
            if rt.client_id != form.get("client_id"):
                return 400, {"error": "invalid_request"}
            data = self._access_for(rt)
            data.pop("refresh_token")
            return 200, data
        return 400, {"error": "unsupported_grant_type"}

    # ---------------------------------------------------------- the WebSocket API (auth + auth/current_user)

    async def dial(self, url: str, headers: dict[str, str]) -> "FakeCoreSocket":
        self.dials.append({"url": url, "headers": dict(headers)})
        return FakeCoreSocket(self)

    # ---------------------------------------------------------- HTTP server (the Playwright fixture)

    def serve(self, port: int) -> ThreadingHTTPServer:
        core = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_a: Any) -> None:
                return

            def _reply(self, status: int, body: dict[str, Any]) -> None:
                raw = json.dumps(body).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)

            def _body(self) -> bytes:
                return self.rfile.read(int(self.headers.get("Content-Length") or 0))

            def do_GET(self) -> None:  # noqa: N802
                path = urlparse(self.path).path
                core.requests.append(("GET", path))
                if path == "/auth/providers":
                    self._reply(200, core.providers())
                elif path == "/fake/state":
                    with core.lock:
                        self._reply(200, {"refresh_tokens": [{"user_id": r.user_id, "client_id": r.client_id, "revoked": r.revoked, "tail": r.token[-8:]} for r in core._refresh.values()],
                                          "requests": core.requests[-50:]})
                else:
                    self._reply(404, {"message": "not found"})

            def do_POST(self) -> None:  # noqa: N802
                path = urlparse(self.path).path
                core.requests.append(("POST", path))
                raw = self._body()
                if path == "/auth/login_flow":
                    self._reply(*core.start_flow(json.loads(raw or b"{}")))
                elif path.startswith("/auth/login_flow/"):
                    self._reply(*core.step_flow(path.rsplit("/", 1)[1], json.loads(raw or b"{}")))
                elif path == "/auth/token":
                    form = {k: v[0] for k, v in parse_qs(raw.decode()).items()}
                    self._reply(*core.token(form))
                elif path == "/fake/revoke-user":
                    core.revoke_user(json.loads(raw or b"{}").get("user_id", ""))
                    self._reply(200, {"ok": True})
                else:
                    self._reply(404, {"message": "not found"})

        server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
        threading.Thread(target=server.serve_forever, name="fake-ha-core", daemon=True).start()
        return server


class FakeCoreSocket:
    def __init__(self, core: FakeHaCore) -> None:
        self.core = core
        self.out: list[str] = [json.dumps({"type": "auth_required", "ha_version": "2026.9.0-fake"})]
        self.user: FakeUser | None = None
        self.closed = False

    async def recv(self) -> str:
        if not self.out:
            raise ConnectionError("fake HA socket: nothing to read")
        return self.out.pop(0)

    async def send(self, raw: str) -> None:
        msg = json.loads(raw)
        if msg.get("type") == "auth":
            self.user = self.core.user_of(msg.get("access_token", ""))
            self.out.append(json.dumps({"type": "auth_ok", "ha_version": "2026.9.0-fake"} if self.user else {"type": "auth_invalid", "message": "Invalid access token or password"}))
            return
        if self.user is None:
            raise ConnectionError("fake HA socket: not authenticated")
        if msg.get("type") == "auth/current_user":
            u = self.user
            self.out.append(json.dumps({"id": msg["id"], "type": "result", "success": True, "result": {
                "id": u.id, "name": u.name, "is_owner": u.is_owner, "is_admin": u.is_admin,
                "credentials": [{"auth_provider_type": "homeassistant", "auth_provider_id": None}],
                "mfa_modules": [{"id": "totp", "name": "Authenticator app", "enabled": bool(u.mfa_code)}]}}))
        elif msg.get("type") == "auth/delete_refresh_token":
            # HA core auth/__init__.py websocket_delete_refresh_token: the id must name a refresh token of the
            # connection's own user (access tokens here carry the first 12 characters of theirs as `iss`)
            rid = msg.get("refresh_token_id")
            with self.core.lock:
                rt = next((r for r in self.core._refresh.values() if r.token[:12] == rid), None)
            if rt is None or rt.user_id != self.user.id:
                self.out.append(json.dumps({"id": msg.get("id"), "type": "result", "success": False, "error": {"code": "invalid_token_id", "message": "Received invalid token"}}))
            else:
                self.core.deleted_refresh.append(rid)
                self.core.revoke_refresh(rt.token)
                self.out.append(json.dumps({"id": msg.get("id"), "type": "result", "success": True, "result": {}}))
        else:
            self.out.append(json.dumps({"id": msg.get("id"), "type": "result", "success": False, "error": {"code": "unknown_command"}}))

    async def close(self) -> None:
        self.closed = True
