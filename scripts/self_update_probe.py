"""CR-021: READ-ONLY probe of the Supervisor facts the Arx self-update feature depends on (docs/changes/CR-021-SELF-UPDATE.md).

Standard library only (a minimal WebSocket client is included). The owner's long-lived token reaches the Supervisor through Home
Assistant's `supervisor/api` WebSocket command, exactly as the Lovelace card and `scripts/smoke_after_upgrade.py` do.

What it may send - and nothing else (ProbeRefused before anything outside the allow-list is sent):
- `auth`
- `supervisor/api` with method `get` and ONLY these endpoints: `/addons`, `/addons/<slug>/info`, `/store`, `/supervisor/info`, `/core/info`.
  No store reload, no update, no restart, no options, no backup, no POST of any kind.

What it prints: STRUCTURE ONLY - key names, value types, closed enumerations (state, stage, role, booleans), version strings, counts.
Never a slug, a name, a repository URL, an address or a token. Nothing is written to disk.

    python scripts/self_update_probe.py <env-file>        (HA_URL / HA_TOKEN are read from the file; their values are never printed)
"""
from __future__ import annotations

import base64
import json
import os
import re
import socket
import ssl
import struct
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ALLOWED_WS = frozenset({"auth", "supervisor/api"})
_ENDPOINT = re.compile(r"/(addons|addons/[A-Za-z0-9_.-]{1,80}/info|store|supervisor/info|core/info)")
ENUM_KEYS = {"state", "stage", "hassio_role", "update_available", "auto_update", "ingress", "build", "advanced", "boot", "startup", "watchdog",
             "host_network", "homeassistant_api", "hassio_api", "backup", "detached", "available", "arch", "channel", "healthy", "supported"}
VERSION_KEYS = {"version", "version_latest"}


class ProbeRefused(RuntimeError):
    pass


def read_env(path: str) -> dict[str, str]:
    out = {}
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"')
    return out


def guard(msg_type: str, fields: dict[str, Any]) -> None:
    """Everything that leaves this process passes here first."""
    if msg_type not in ALLOWED_WS:
        raise ProbeRefused(msg_type)
    if msg_type == "supervisor/api":
        endpoint = str(fields.get("endpoint", ""))
        if str(fields.get("method", "")).lower() != "get" or not _ENDPOINT.fullmatch(endpoint) or set(fields) - {"endpoint", "method", "timeout"}:
            raise ProbeRefused("supervisor/api")


def shape(value: Any, depth: int = 0) -> Any:
    """Structure of a value: dict -> {key: shape}; list -> [len, shape of the first]; scalar -> type name; closed enumerations and
    version strings keep their value (a version is not private)."""
    if depth > 4:
        return "..."
    if isinstance(value, dict):
        return {k: (value[k] if (k in ENUM_KEYS or k in VERSION_KEYS) and isinstance(value[k], (str, bool, type(None))) and len(str(value[k])) < 40
                    else shape(value[k], depth + 1)) for k in sorted(value)}
    if isinstance(value, list):
        return [f"len={len(value)}", shape(value[0], depth + 1) if value else None]
    return "null" if value is None else type(value).__name__


# ----------------------------------------------------------------------------------------------- minimal WebSocket client (RFC 6455)
class WS:
    def __init__(self, url: str):
        u = urlparse(url)
        secure = u.scheme in ("https", "wss")
        port = u.port or (443 if secure else 80)
        raw = socket.create_connection((u.hostname, port), timeout=15)
        self.sock = ssl.create_default_context().wrap_socket(raw, server_hostname=u.hostname) if secure else raw
        self.sock.settimeout(60)
        key = base64.b64encode(os.urandom(16)).decode()
        host = u.hostname if not u.port else f"{u.hostname}:{u.port}"
        req = (f"GET /api/websocket HTTP/1.1\r\nHost: {host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
               f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n")
        self.sock.sendall(req.encode())
        head = b""
        while b"\r\n\r\n" not in head:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise ConnectionError("handshake closed")
            head += chunk
        head, self.buf = head.split(b"\r\n\r\n", 1)
        if b" 101 " not in head.split(b"\r\n", 1)[0]:
            raise ConnectionError("websocket upgrade refused")

    def _need(self, n: int) -> bytes:
        while len(self.buf) < n:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise ConnectionError("closed")
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def send(self, text: str) -> None:
        data = text.encode()
        n = len(data)
        header = bytes([0x81]) + (bytes([0x80 | n]) if n < 126 else bytes([0x80 | 126]) + struct.pack(">H", n) if n < 65536 else bytes([0x80 | 127]) + struct.pack(">Q", n))
        mask = os.urandom(4)
        self.sock.sendall(header + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

    def recv(self) -> str:
        payload = b""
        while True:
            b1, b2 = self._need(2)
            op, n = b1 & 0x0F, b2 & 0x7F
            if n == 126:
                n = struct.unpack(">H", self._need(2))[0]
            elif n == 127:
                n = struct.unpack(">Q", self._need(8))[0]
            data = self._need(n)
            if op == 0x9:  # ping -> pong (masked, as a client must)
                mask = os.urandom(4)
                self.sock.sendall(bytes([0x8A, 0x80 | len(data)]) + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))
                continue
            if op == 0x8:
                raise ConnectionError("closed by peer")
            payload += data
            if b1 & 0x80:
                return payload.decode()

    def close(self) -> None:
        try:
            self.sock.close()
        except OSError:
            pass


class Session:
    def __init__(self, ws: WS):
        self.ws, self.n = ws, 0

    def call(self, msg_type: str, **fields: Any) -> dict[str, Any]:
        guard(msg_type, fields)
        self.n += 1
        self.ws.send(json.dumps({"id": self.n, "type": msg_type, **fields}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == self.n:
                return msg

    def supervisor_get(self, endpoint: str) -> tuple[bool, Any, str | None]:
        ans = self.call("supervisor/api", endpoint=endpoint, method="get", timeout=30)
        if not ans.get("success"):
            return False, None, (ans.get("error") or {}).get("code")
        res = ans.get("result")
        return True, (res.get("data") if isinstance(res, dict) and "data" in res else res), None


def main(env_file: str) -> int:
    env = read_env(env_file)
    base, token = env["HA_URL"].rstrip("/"), env["HA_TOKEN"]
    ws = WS(base)
    try:
        ws.recv()  # auth_required
        ws.send(json.dumps({"type": "auth", "access_token": token}))
        if json.loads(ws.recv()).get("type") != "auth_ok":
            print("auth failed")
            return 2
        s = Session(ws)
        report: dict[str, Any] = {}

        ok, data, err = s.supervisor_get("/addons")
        listing = (data or {}).get("addons", []) if isinstance(data, dict) else []
        report["addons_list"] = {"ok": ok, "error": err, "count": len(listing), "item_keys": shape(listing[0]) if listing else None}

        def find(suffix: str) -> str | None:
            for a in listing:
                if str(a.get("slug", "")).endswith(suffix):
                    return a["slug"]  # used for the request only; never printed
            return None

        for label, suffix in (("arx_addon", "_smplwise_vms"), ("music_assistant_addon", "music_assistant")):
            slug = find(suffix)
            if not slug:
                report[label] = {"installed": False}
                continue
            row = next(a for a in listing if a.get("slug") == slug)
            ok, info, err = s.supervisor_get(f"/addons/{slug}/info")
            keys = ("version", "version_latest", "update_available", "state", "stage", "build", "auto_update", "ingress", "hassio_role",
                    "hassio_api", "homeassistant_api", "advanced", "boot", "startup", "watchdog", "backup", "detached", "available")
            report[label] = {
                "installed": True,
                "list_row": {k: row[k] for k in ("version", "version_latest", "update_available", "state", "build", "installed", "available", "detached") if k in row},
                "info_ok": ok, "info_error": err,
                "info_values": {k: info.get(k) for k in keys if isinstance(info, dict) and k in info},
                "info_key_count": len(info) if isinstance(info, dict) else None,
                "info_keys_with_role_or_api": sorted(k for k in (info or {}) if "role" in k or k.endswith("_api")),
            }
        report["addons_with_update_available"] = sum(1 for a in listing if a.get("update_available"))

        ok, data, err = s.supervisor_get("/store")
        repos = (data or {}).get("repositories", []) if isinstance(data, dict) else []
        report["store"] = {"ok": ok, "error": err, "top_keys": sorted(data) if isinstance(data, dict) else None,
                           "repositories": len(repos), "repository_keys": sorted(repos[0]) if repos and isinstance(repos[0], dict) else None}
        for name, ep in (("supervisor_info", "/supervisor/info"), ("core_info", "/core/info")):
            ok, data, err = s.supervisor_get(ep)
            report[name] = {"ok": ok, "error": err, "keys": sorted(data) if isinstance(data, dict) else None,
                            "versions": {k: data[k] for k in ("version", "version_latest", "update_available", "channel", "healthy", "supported", "auto_update") if isinstance(data, dict) and k in data}}
        print(json.dumps(report, indent=2, ensure_ascii=False, sort_keys=True))
        return 0
    finally:
        ws.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
