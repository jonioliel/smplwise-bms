"""A tiny local stand-in for the SmplWise push relay (CR-027), for the app developer's mock setup and manual server tests.

    python services/push-relay/fake_relay.py --port 8787 [--server-key srvkey-dev]

It speaks the relay contract (docs/api/mobile-presence-contract.md section 8) with no APNs / FCM behind it: registrations live
in memory, every /v1/push is printed and recorded, `GET /v1/pushes` lists what arrived (so a mock app can poll it and raise a
local notification), `DELETE /v1/pushes` clears the list. Standard library only. Never points at anything; nothing leaves it.
Server side: SW_PUSH_RELAY_URL=http://127.0.0.1:8787 SW_PUSH_RELAY_KEY=srvkey-dev (the backend accepts http only when a test
transport is installed, so for a dev backend run it behind https or set the URL through a local https proxy; the backend tests
use their own in-process fake)."""
from __future__ import annotations

import argparse
import hashlib
import json
import secrets
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

REGS: dict[str, dict] = {}  # sha256(relay_token) -> registration
PUSHES: list[dict] = []
SERVER_KEY = "srvkey-dev"


class Handler(BaseHTTPRequestHandler):
    def _json(self, status: int, body: dict | list | None) -> None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else b""
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _body(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        if n > 2048:
            return {}
        try:
            return json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            return {}

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/v1/health":
            self._json(200, {"ok": True, "apns": False, "fcm": False, "fake": True})
        elif self.path == "/v1/pushes":
            self._json(200, PUSHES)
        else:
            self._json(404, {"code": "not_found"})

    def do_DELETE(self) -> None:  # noqa: N802
        if self.path == "/v1/register":
            body = self._body()
            REGS.pop(hashlib.sha256(str(body.get("relay_token", "")).encode()).hexdigest(), None)
            self._json(204, None)
        elif self.path == "/v1/pushes":
            PUSHES.clear()
            self._json(204, None)
        else:
            self._json(404, {"code": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        body = self._body()
        if self.path == "/v1/register":
            if body.get("platform") not in ("ios", "android") or not body.get("push_token"):
                return self._json(400, {"code": "invalid_registration"})
            token = "rt_" + secrets.token_urlsafe(32)[:43]
            REGS[hashlib.sha256(token.encode()).hexdigest()] = {"platform": body["platform"], "push_token": str(body["push_token"])[-8:], "bundle_id": body.get("bundle_id")}
            return self._json(200, {"relay_token": token})
        if self.path == "/v1/push":
            if self.headers.get("Authorization") != f"Bearer {SERVER_KEY}":
                return self._json(401, {"code": "unauthorized"})
            reg = REGS.get(hashlib.sha256(str(body.get("relay_token", "")).encode()).hexdigest())
            if reg is None:
                return self._json(404, {"code": "relay_token_unknown"})
            item = {k: body.get(k) for k in ("category", "notification_id", "priority", "server", "collapse")}
            item["platform"] = reg["platform"]
            PUSHES.append(item)
            print("push:", json.dumps(item, ensure_ascii=False))
            return self._json(200, {"ok": True})
        self._json(404, {"code": "not_found"})

    def log_message(self, fmt: str, *args) -> None:  # quiet; tokens never printed
        pass


def main() -> None:
    global SERVER_KEY
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8787)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--server-key", default=SERVER_KEY)
    a = ap.parse_args()
    SERVER_KEY = a.server_key
    print(f"fake push relay on http://{a.host}:{a.port} (server key: {a.server_key})")
    ThreadingHTTPServer((a.host, a.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
