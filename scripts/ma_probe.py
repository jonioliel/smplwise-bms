"""CR-016 phase 2b: READ-ONLY probe of the Music Assistant (MA) layer of one Home Assistant system (docs/changes/CR-016-MEDIA-PLAYERS.md
section 17). The owner allowed read-only inspection of his systems (2026-10-01); nothing is played, joined, changed or restarted.

What it may send - and nothing else (ProbeRefused before anything outside the allow-list is sent):
- Home Assistant WebSocket: `auth`, `get_services`, `config/entity_registry/list`, `config_entries/get`, and `call_service` ONLY for the
  three Music Assistant RESPONSE services that read (`music_assistant.get_library`, `get_queue`, `search`) with `return_response: true`.
- Music Assistant HTTP: `GET /info` on port 8095 of the Home Assistant host (the server's own description; no token is sent).

What it prints: STRUCTURE ONLY - key sets, value types, counts, closed enumerations (media types, repeat modes), version numbers. Never a
name, a title, an entity id, a player / queue / item id, a uri, a URL, an address or a token. Nothing is written to disk.

    python scripts/ma_probe.py <env-file>        (HA_URL / HA_TOKEN are read from the file; their values are never printed)
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ALLOWED_WS = frozenset({"auth", "get_services", "config/entity_registry/list", "config_entries/get", "call_service"})
ALLOWED_SERVICES = frozenset({("music_assistant", "get_library"), ("music_assistant", "get_queue"), ("music_assistant", "search")})
ENUM_KEYS = {"media_type", "repeat_mode", "state", "album_type"}


class ProbeRefused(RuntimeError):
    pass


def shape(value: Any, depth: int = 0) -> Any:
    """The structure of a value: dict -> {key: shape}, list -> [len, shape of the first], scalar -> its type name."""
    if depth > 6:
        return "..."
    if isinstance(value, dict):
        return {k: (sorted({value[k]}) if k in ENUM_KEYS and isinstance(value[k], str) else shape(value[k], depth + 1)) for k in sorted(value)}
    if isinstance(value, list):
        return [f"len={len(value)}", shape(value[0], depth + 1) if value else None]
    if value is None:
        return "null"
    return type(value).__name__


def read_env(path: str) -> dict[str, str]:
    out = {}
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"')
    return out


class Session:
    def __init__(self, ws: Any):
        self.ws, self.n = ws, 0

    async def call(self, msg_type: str, **fields: Any) -> Any:
        if msg_type not in ALLOWED_WS:
            raise ProbeRefused(msg_type)
        if msg_type == "call_service" and ((fields.get("domain"), fields.get("service")) not in ALLOWED_SERVICES or fields.get("return_response") is not True):
            raise ProbeRefused("call_service")
        self.n += 1
        await self.ws.send(json.dumps({"id": self.n, "type": msg_type, **fields}))
        while True:
            msg = json.loads(await asyncio.wait_for(self.ws.recv(), 60))
            if msg.get("id") == self.n:
                return msg


async def main(env_file: str) -> int:
    import httpx
    import websockets

    env = read_env(env_file)
    base, token = env["HA_URL"].rstrip("/"), env["HA_TOKEN"]
    report: dict[str, Any] = {}
    host = urlparse(base).hostname
    try:  # MA's own server description, unauthenticated (no token is sent to it)
        r = httpx.get(f"http://{host}:8095/info", timeout=8)
        info = r.json() if r.status_code == 200 else {}
        report["ma_info"] = {"http_status": r.status_code, "keys": sorted(info), **{k: info.get(k) for k in ("server_version", "schema_version", "min_supported_schema_version", "homeassistant_addon", "onboard_done") if k in info}}
    except Exception as exc:  # noqa: BLE001 - only the class name is reported
        report["ma_info"] = {"reachable_from_workstation": False, "error": type(exc).__name__}
    url = base.replace("http", "ws", 1) + "/api/websocket"
    async with websockets.connect(url, max_size=64 * 1024 * 1024, open_timeout=15) as ws:
        await ws.recv()
        await ws.send(json.dumps({"type": "auth", "access_token": token}))
        if json.loads(await ws.recv()).get("type") != "auth_ok":
            print("auth failed")
            return 2
        s = Session(ws)
        services = (await s.call("get_services")).get("result", {}).get("music_assistant", {})
        report["services"] = {name: {"fields": sorted((spec.get("fields") or {}).keys()), "response": (spec.get("response") or {}).get("optional")} for name, spec in sorted(services.items())}
        entries = [e for e in (await s.call("config_entries/get", domain="music_assistant")).get("result", []) if e.get("domain") == "music_assistant"]
        report["config_entries"] = {"count": len(entries), "states": sorted({e.get("state") for e in entries})}
        entry_id = next((e["entry_id"] for e in entries if e.get("state") == "loaded"), None)
        reg = (await s.call("config/entity_registry/list")).get("result", [])
        ma_players = [e for e in reg if e.get("platform") == "music_assistant" and str(e.get("entity_id", "")).startswith("media_player.") and not e.get("disabled_by")]
        report["ma_players"] = len(ma_players)
        report["unique_id_shape"] = sorted({("hex" if all(c in "0123456789abcdef" for c in str(e.get("unique_id", "")).replace(":", "").lower()) else "text") + f":{len(str(e.get('unique_id', '')))}" for e in ma_players})
        if entry_id:
            lib: dict[str, Any] = {}
            for media_type in ("radio", "playlist", "track", "album", "artist"):
                for fav in (True, False):
                    ans = await s.call("call_service", domain="music_assistant", service="get_library", return_response=True,
                                       service_data={"config_entry_id": entry_id, "media_type": media_type, "favorite": fav, "limit": 3, "offset": 0})
                    resp = (ans.get("result") or {}).get("response") if ans.get("success") else None
                    items = (resp or {}).get("items") if isinstance(resp, dict) else None
                    lib[f"{media_type}{'_fav' if fav else ''}"] = {"ok": bool(ans.get("success")), "error": (ans.get("error") or {}).get("code"),
                                                                   "top_keys": sorted(resp) if isinstance(resp, dict) else None,
                                                                   "items": len(items) if isinstance(items, list) else None,
                                                                   "item_shape": shape(items[0]) if items else None}
            report["get_library"] = lib
            ans = await s.call("call_service", domain="music_assistant", service="search", return_response=True,
                               service_data={"config_entry_id": entry_id, "name": "a", "limit": 2})
            resp = (ans.get("result") or {}).get("response") if ans.get("success") else None
            report["search"] = {"ok": bool(ans.get("success")), "error": (ans.get("error") or {}).get("code"),
                                "keys": {k: (len(v) if isinstance(v, list) else type(v).__name__) for k, v in (resp or {}).items()} if isinstance(resp, dict) else None}
        queues = []
        for e in ma_players[:4]:
            ans = await s.call("call_service", domain="music_assistant", service="get_queue", return_response=True, target={"entity_id": e["entity_id"]})
            resp = (ans.get("result") or {}).get("response") if ans.get("success") else None
            q = next(iter(resp.values()), None) if isinstance(resp, dict) and len(resp) == 1 else resp
            queues.append({"ok": bool(ans.get("success")), "error": (ans.get("error") or {}).get("code"), "shape": shape(q) if isinstance(q, dict) else None})
        report["get_queue"] = queues
    text = json.dumps(report, indent=1, ensure_ascii=False, default=str)
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main(sys.argv[1])))
