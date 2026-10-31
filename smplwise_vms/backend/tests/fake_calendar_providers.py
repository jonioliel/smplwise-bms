"""CALCONNECT-2330: in-memory fakes of the parts of Google (OAuth token / revoke + Calendar v3) and Microsoft (identity platform device
code + Graph v1.0 calendars) that services/calendar_sync speaks, served through `httpx.MockTransport(fake.handler)`. Nothing here opens
a socket; a request to any other host answers 599 and is recorded in `foreign`, so a test can assert nothing left the fake.

`on_request` (optional) runs before every answer - the tests use it to prove that no database write lock is held while a provider
is asked."""
from __future__ import annotations

import base64
import hashlib
import json
import urllib.parse
from dataclasses import dataclass, field
from typing import Any, Callable

import httpx

G_CLIENT_ID = "1234567890-fakecalclient.apps.googleusercontent.com"
G_CLIENT_SECRET = "GOCSPX-fake-calendar-secret-value"
G_REFRESH = "1//fake-google-refresh-token-abcdef"
MS_CLIENT_ID = "0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b"
MS_REFRESH_1 = "M.fake-ms-refresh-token-one"
MS_REFRESH_2 = "M.fake-ms-refresh-token-two"
MS_DEVICE = "fake-ms-device-code-0123456789"
MS_USER_CODE = "FAKE1234"
G = "https://www.googleapis.com/auth/"


def _form(req: httpx.Request) -> dict[str, str]:
    return {k: v[0] for k, v in urllib.parse.parse_qs(req.content.decode()).items()}


def _json(status: int, body: Any, headers: dict[str, str] | None = None) -> httpx.Response:
    return httpx.Response(status, json=body, headers=headers or {})


@dataclass
class FakeGoogle:
    calendars: dict[str, dict[str, Any]] = field(default_factory=lambda: {"primary@x": {"summary": "Owner", "accessRole": "owner", "primary": True},
                                                                          "rooms@x": {"summary": "Rooms", "accessRole": "writer"},
                                                                          "ro@x": {"summary": "Holidays", "accessRole": "reader"}})
    events: dict[str, dict[str, dict[str, Any]]] = field(default_factory=lambda: {"primary@x": {}, "rooms@x": {}, "ro@x": {}})
    granted_scope: str | None = None  # None = what was asked for
    challenge: str | None = None
    code: str = "4/fake-auth-code"
    revoked: list[str] = field(default_factory=list)
    refresh_revoked: bool = False
    access_issued: int = 0
    seq: int = 0
    tomb: dict[str, dict[str, int]] = field(default_factory=dict)
    issued_tokens: dict[str, int] = field(default_factory=dict)  # sync token -> seq
    gone_tokens: bool = False
    fail_next: list[tuple[int, dict[str, Any], dict[str, str]]] = field(default_factory=list)
    calls: list[tuple[str, str]] = field(default_factory=list)
    foreign: list[str] = field(default_factory=list)
    on_request: Callable[[httpx.Request], None] | None = None
    asked_scope: str = ""

    def handler(self, req: httpx.Request) -> httpx.Response:
        if self.on_request:
            self.on_request(req)
        host, path = req.url.host, req.url.path
        self.calls.append((req.method, f"{host}{path}"))
        if host == "oauth2.googleapis.com":
            return self._oauth(req, path)
        if host == "www.googleapis.com" and path.startswith("/calendar/v3/"):
            if req.headers.get("Authorization", "") != "Bearer g-access":
                return _json(401, {"error": {"code": 401}})
            if self.fail_next:
                s, body, h = self.fail_next.pop(0)
                return _json(s, body, h)
            return self._api(req, path[len("/calendar/v3"):])
        self.foreign.append(str(req.url))
        return httpx.Response(599)

    # ---------------------------------------------------------------- OAuth
    def _oauth(self, req: httpx.Request, path: str) -> httpx.Response:
        f = _form(req)
        if path == "/revoke":
            self.revoked.append(f.get("token", ""))
            return httpx.Response(200)
        if path != "/token":
            return httpx.Response(404)
        if f.get("client_id") != G_CLIENT_ID or f.get("client_secret") != G_CLIENT_SECRET:
            return _json(401, {"error": "invalid_client"})
        if f.get("grant_type") == "authorization_code":
            if f.get("code") != self.code or f.get("redirect_uri") != "http://127.0.0.1:8749/":
                return _json(400, {"error": "invalid_grant"})
            verifier = f.get("code_verifier", "")
            ch = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
            if ch != self.challenge:
                return _json(400, {"error": "invalid_grant"})
            self.access_issued += 1
            return _json(200, {"access_token": "g-access", "expires_in": 3599, "refresh_token": G_REFRESH,
                               "scope": self.granted_scope if self.granted_scope is not None else self.asked_scope, "token_type": "Bearer"})
        if f.get("grant_type") == "refresh_token":
            if self.refresh_revoked or f.get("refresh_token") != G_REFRESH:
                return _json(400, {"error": "invalid_grant"})
            self.access_issued += 1
            return _json(200, {"access_token": "g-access", "expires_in": 3599, "token_type": "Bearer"})
        return _json(400, {"error": "unsupported_grant_type"})

    def note_authorize_url(self, url: str) -> dict[str, str]:
        q = {k: v[0] for k, v in urllib.parse.parse_qs(urllib.parse.urlsplit(url).query).items()}
        self.challenge, self.asked_scope = q.get("code_challenge"), q.get("scope", "")
        return q

    # ---------------------------------------------------------------- Calendar v3
    def _bump(self) -> int:
        self.seq += 1
        return self.seq

    def user_create(self, cal: str, eid: str, summary: str, start: str, end: str, **extra: Any) -> None:
        self.events[cal][eid] = {"id": eid, "etag": f'"{self._bump()}"', "summary": summary, "start": {"dateTime": start}, "end": {"dateTime": end},
                                 "status": "confirmed", "_seq": self.seq, **extra}

    def user_delete(self, cal: str, eid: str) -> None:
        self.events[cal].pop(eid)
        self.tomb.setdefault(cal, {})[eid] = self._bump()

    def _out(self, e: dict[str, Any]) -> dict[str, Any]:
        return {k: v for k, v in e.items() if not k.startswith("_")}

    def _api(self, req: httpx.Request, path: str) -> httpx.Response:
        parts = [urllib.parse.unquote(p) for p in path.strip("/").split("/")]
        if parts[:3] == ["users", "me", "calendarList"]:
            return _json(200, {"items": [{"id": k, **v} for k, v in self.calendars.items()]})
        if parts[0] != "calendars" or parts[1] not in self.events or len(parts) < 3 or parts[2] != "events":
            return _json(404, {"error": {"code": 404}})
        cal, evs = parts[1], self.events[parts[1]]
        if len(parts) == 3 and req.method == "GET":
            q = dict(req.url.params)
            tok = q.get("syncToken")
            if tok is not None:
                if self.gone_tokens or tok not in self.issued_tokens:
                    return _json(410, {"error": {"code": 410, "errors": [{"reason": "fullSyncRequired"}]}})
                since = self.issued_tokens[tok]
                items = [self._out(e) for e in evs.values() if e["_seq"] > since]
                items += [{"id": u, "status": "cancelled"} for u, s in self.tomb.get(cal, {}).items() if s > since]
            else:
                items = [self._out(e) for e in evs.values()]
            nxt = f"st{self.seq}-{len(self.issued_tokens)}"
            self.issued_tokens[nxt] = self.seq
            self.gone_tokens = False
            return _json(200, {"timeZone": "Asia/Jerusalem", "items": items, "nextSyncToken": nxt})
        if len(parts) == 3 and req.method == "POST":
            body = json.loads(req.content)
            eid = f"g{self._bump()}"
            evs[eid] = {**body, "id": eid, "etag": f'"{self.seq}"', "status": "confirmed", "_seq": self.seq}
            return _json(200, self._out(evs[eid]))
        eid = parts[3]
        if req.method == "PUT":
            if eid not in evs:
                return _json(404, {"error": {"code": 404}})
            body = json.loads(req.content)
            evs[eid] = {**body, "id": eid, "etag": f'"{self._bump()}"', "status": "confirmed", "_seq": self.seq}
            return _json(200, self._out(evs[eid]))
        if req.method == "DELETE":
            if eid not in evs:
                return _json(410, {"error": {"code": 410}})
            self.user_delete(cal, eid)
            return httpx.Response(204)
        return _json(405, {})


@dataclass
class FakeMicrosoft:
    tenant: str = "common"
    script: list[str] = field(default_factory=lambda: ["authorization_pending", "slow_down", "ok"])
    granted: str = "https://graph.microsoft.com/Calendars.ReadWrite https://graph.microsoft.com/User.Read"
    refresh: str = MS_REFRESH_1
    calendars: dict[str, dict[str, Any]] = field(default_factory=lambda: {"AAMk-cal-1": {"name": "Calendar", "canEdit": True, "isDefaultCalendar": True}})
    events: dict[str, dict[str, Any]] = field(default_factory=dict)
    removed: list[str] = field(default_factory=list)
    delta_since: int = 0
    seq: int = 0
    fail_next: list[tuple[int, dict[str, Any], dict[str, str]]] = field(default_factory=list)
    calls: list[tuple[str, str]] = field(default_factory=list)
    foreign: list[str] = field(default_factory=list)
    on_request: Callable[[httpx.Request], None] | None = None

    def handler(self, req: httpx.Request) -> httpx.Response:
        if self.on_request:
            self.on_request(req)
        host, path = req.url.host, req.url.path
        self.calls.append((req.method, f"{host}{path}"))
        if host == "login.microsoftonline.com":
            return self._login(req, path)
        if host == "graph.microsoft.com" and path.startswith("/v1.0/"):
            if req.headers.get("Authorization", "") != "Bearer ms-access":
                return _json(401, {"error": {"code": "InvalidAuthenticationToken"}})
            if self.fail_next:
                s, body, h = self.fail_next.pop(0)
                return _json(s, body, h)
            return self._graph(req, path[len("/v1.0"):])
        self.foreign.append(str(req.url))
        return httpx.Response(599)

    def _login(self, req: httpx.Request, path: str) -> httpx.Response:
        f = _form(req)
        if path != f"/{self.tenant}/oauth2/v2.0/devicecode" and path != f"/{self.tenant}/oauth2/v2.0/token":
            return _json(400, {"error": "invalid_request"})
        if f.get("client_id") != MS_CLIENT_ID:
            return _json(400, {"error": "unauthorized_client"})
        if path.endswith("/devicecode"):
            return _json(200, {"device_code": MS_DEVICE, "user_code": MS_USER_CODE, "verification_uri": "https://microsoft.com/devicelogin", "expires_in": 900,
                               "interval": 5, "message": "..."})
        if f.get("grant_type") == "urn:ietf:params:oauth:grant-type:device_code":
            if f.get("device_code") != MS_DEVICE:
                return _json(400, {"error": "bad_verification_code"})
            step = self.script.pop(0) if self.script else "ok"
            if step != "ok":
                return _json(400, {"error": step})
            return _json(200, {"access_token": "ms-access", "refresh_token": self.refresh, "expires_in": 3600, "scope": self.granted})
        if f.get("grant_type") == "refresh_token":
            if f.get("refresh_token") != self.refresh:
                return _json(400, {"error": "invalid_grant"})
            self.refresh = MS_REFRESH_2 if self.refresh == MS_REFRESH_1 else MS_REFRESH_1  # Microsoft rotates
            return _json(200, {"access_token": "ms-access", "refresh_token": self.refresh, "expires_in": 3600, "scope": self.granted})
        return _json(400, {"error": "unsupported_grant_type"})

    def _bump(self) -> int:
        self.seq += 1
        return self.seq

    def user_create(self, eid: str, subject: str, start: str, end: str) -> None:
        self.events[eid] = {"id": eid, "@odata.etag": f'W/"{self._bump()}"', "subject": subject, "start": {"dateTime": start, "timeZone": "UTC"},
                            "end": {"dateTime": end, "timeZone": "UTC"}, "isAllDay": False, "_seq": self.seq}

    def user_delete(self, eid: str) -> None:
        self.events.pop(eid)
        self.removed.append(eid)
        self._removed_seq = getattr(self, "_removed_seq", {})
        self._removed_seq[eid] = self._bump()

    def _out(self, e: dict[str, Any]) -> dict[str, Any]:
        return {k: v for k, v in e.items() if not k.startswith("_")}

    def _graph(self, req: httpx.Request, path: str) -> httpx.Response:
        if path == "/me/calendars":
            return _json(200, {"value": [{"id": k, **v} for k, v in self.calendars.items()]})
        if path.endswith("/calendarView/delta"):
            q = dict(req.url.params)
            since = int(q["since"]) if "since" in q else 0
            if "since" not in q and ("startDateTime" not in q or "endDateTime" not in q):
                return _json(400, {"error": {"code": "ErrorInvalidParameter"}})
            if q.get("since") == "gone":
                return _json(410, {"error": {"code": "SyncStateNotFound"}})
            items = [self._out(e) for e in self.events.values() if e["_seq"] > since]
            items += [{"id": u, "@removed": {"reason": "deleted"}} for u, s in getattr(self, "_removed_seq", {}).items() if s > since]
            base = f"https://graph.microsoft.com/v1.0{path}"
            return _json(200, {"value": items, "@odata.deltaLink": f"{base}?since={self.seq}"})
        if path.startswith("/me/calendars/") and path.endswith("/events") and req.method == "POST":
            body = json.loads(req.content)
            eid = f"m{self._bump()}"
            self.events[eid] = {**body, "id": eid, "@odata.etag": f'W/"{self.seq}"', "_seq": self.seq}
            return _json(201, self._out(self.events[eid]))
        if path.startswith("/me/events/"):
            eid = urllib.parse.unquote(path.rsplit("/", 1)[1])
            if eid not in self.events:
                return _json(404, {"error": {"code": "ErrorItemNotFound"}})
            if req.method == "PATCH":
                self.events[eid].update(json.loads(req.content))
                self.events[eid]["@odata.etag"] = f'W/"{self._bump()}"'
                self.events[eid]["_seq"] = self.seq
                return _json(200, self._out(self.events[eid]))
            if req.method == "DELETE":
                self.user_delete(eid)
                return httpx.Response(204)
        return _json(404, {"error": {"code": "ErrorItemNotFound"}})


class Router:
    """One MockTransport handler in front of several fakes, by host."""

    def __init__(self, *fakes: Any) -> None:
        self.fakes = fakes

    def handler(self, req: httpx.Request) -> httpx.Response:
        for f in self.fakes:
            if isinstance(f, FakeGoogle) and req.url.host in ("oauth2.googleapis.com", "www.googleapis.com"):
                return f.handler(req)
            if isinstance(f, FakeMicrosoft) and req.url.host in ("login.microsoftonline.com", "graph.microsoft.com"):
                return f.handler(req)
        return httpx.Response(599)

    def client(self) -> httpx.Client:
        return httpx.Client(transport=httpx.MockTransport(self.handler))
