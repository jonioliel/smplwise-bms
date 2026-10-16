"""USR1: an in-process fake of Home Assistant's user-management WebSocket API - the only "HA" the USR1 tests ever reach.

It mimics HA core's commands with HA's own shapes and error codes as read from
homeassistant/components/config/{auth,auth_provider_homeassistant}.py and person/__init__.py (NOT verified against a running
HA - docs/design/USR1_HA_USERS_FROM_ARX.md §1.4):
  config/auth/list | create | update | delete, config/auth_provider/homeassistant/create, person/create | delete.
All of them are admin-only (`@require_admin` -> error `unauthorized`).

`FakeHaUsers.connect` replaces `websockets.connect`, so the add-on's real transport (ha_client.ws_session: hello, auth,
numbered commands, results) runs unchanged against it. No socket is opened and no real Home Assistant is ever reached.
HA's error messages carry CANARY, so a test can prove HA text never reaches an API answer."""
from __future__ import annotations

import asyncio
import json
import uuid
from typing import Any

CANARY = "HA-TEXT-CANARY"
SUPERVISOR_TOKEN = "fake-supervisor-token"
ADMIN_TOKEN = "fake-admin-llat"
NON_ADMIN_TOKEN = "fake-non-admin-llat"

ADMIN_ONLY = {"config/auth/list", "config/auth/create", "config/auth/update", "config/auth/delete", "config/auth_provider/homeassistant/create",
              "person/create", "person/delete"}


class FakeHaUsers:
    def __init__(self) -> None:
        self.users: dict[str, dict[str, Any]] = {}
        self.credentials: dict[str, dict[str, Any]] = {}  # username -> {user_id, password}
        self.persons: dict[str, dict[str, Any]] = {}
        self.calls: list[tuple[str, dict[str, Any]]] = []  # (type, args with the password replaced)
        self.urls: list[str] = []
        self.fail: dict[str, str] = {}  # command -> error code (persistent until removed)
        self.fail_once: dict[str, str] = {}
        self.unreachable = False
        self.create_makes_admin = False  # HA would make the new user owner/admin (an installation without an owner)
        self.tokens = {SUPERVISOR_TOKEN: "supervisor", ADMIN_TOKEN: "owner-1", NON_ADMIN_TOKEN: "other-1"}
        self._add("supervisor", "Supervisor", None, groups=["system-admin"], system_generated=True)
        self._add("owner-1", "Owner", "owner", groups=["system-admin"], owner=True)
        self._add("other-1", "Other person", "other", groups=["system-users"])
        self.credentials["owner"] = {"user_id": "owner-1", "password": "x"}
        self.credentials["other"] = {"user_id": "other-1", "password": "x"}

    def _add(self, uid: str, name: str, username: str | None, *, groups: list[str], owner: bool = False, system_generated: bool = False) -> None:
        self.users[uid] = {"id": uid, "name": name, "username": username, "is_owner": owner, "is_active": True, "local_only": False,
                           "system_generated": system_generated, "group_ids": list(groups), "credentials": [{"type": "homeassistant"}] if username else []}

    def types(self) -> list[str]:
        return [t for t, _ in self.calls]

    def password_of(self, username: str) -> str | None:
        c = self.credentials.get(username)
        return c["password"] if c else None

    # ------------------------------------------------------------ websocket seam

    def connect(self, url: str, **_kw: Any) -> "_FakeSocket":
        self.urls.append(url)
        if self.unreachable:
            raise OSError("fake: connection refused")
        return _FakeSocket(self)

    # ------------------------------------------------------------ commands

    def _err(self, mid: int, code: str, message: str) -> dict[str, Any]:
        return {"id": mid, "type": "result", "success": False, "error": {"code": code, "message": f"{message} ({CANARY})"}}

    def _ok(self, mid: int, result: Any = None) -> dict[str, Any]:
        return {"id": mid, "type": "result", "success": True, "result": result}

    def handle(self, conn_user: str, msg: dict[str, Any]) -> dict[str, Any]:
        mid = int(msg["id"])
        kind = str(msg.get("type"))
        args = {k: v for k, v in msg.items() if k not in ("id", "type")}
        self.calls.append((kind, {k: ("<password>" if k == "password" else v) for k, v in args.items()}))
        if kind in ADMIN_ONLY and "system-admin" not in self.users.get(conn_user, {}).get("group_ids", []):
            return self._err(mid, "unauthorized", "Unauthorized")
        if kind in self.fail_once:
            return self._err(mid, self.fail_once.pop(kind), "Injected failure")
        if kind in self.fail:
            return self._err(mid, self.fail[kind], "Injected failure")
        if kind == "config/auth/list":
            return self._ok(mid, [dict(u) for u in self.users.values()])
        if kind == "config/auth/create":
            uid = uuid.uuid4().hex
            groups = list(args.get("group_ids") or [])
            if self.create_makes_admin:
                groups = ["system-admin"]
            self._add(uid, str(args["name"]), None, groups=groups, owner=self.create_makes_admin)
            self.users[uid]["local_only"] = bool(args.get("local_only"))
            return self._ok(mid, {"user": dict(self.users[uid])})
        if kind == "config/auth_provider/homeassistant/create":
            user = self.users.get(str(args.get("user_id")))
            if user is None:
                return self._err(mid, "not_found", "User not found")
            if user["system_generated"]:
                return self._err(mid, "system_generated", "Cannot add credentials to a system generated user.")
            username = str(args["username"])
            if username in self.credentials:
                return self._err(mid, "username_exists", "Username already exists")
            self.credentials[username] = {"user_id": user["id"], "password": str(args["password"])}
            user["username"] = username
            user["credentials"] = [{"type": "homeassistant"}]
            return self._ok(mid)
        if kind == "config/auth/update":
            user = self.users.get(str(args.get("user_id")))
            if user is None:
                return self._err(mid, "not_found", "User not found")
            if user["system_generated"]:
                return self._err(mid, "cannot_modify_system_generated", "Unable to update system generated users.")
            if user["is_owner"] and args.get("is_active") is False:
                return self._err(mid, "cannot_deactivate_owner", "Unable to deactivate owner.")
            for key in ("name", "is_active", "group_ids", "local_only"):
                if key in args:
                    user[key] = args[key]
            return self._ok(mid, {"user": dict(user)})
        if kind == "config/auth/delete":
            uid = str(args.get("user_id"))
            if uid == conn_user:
                return self._err(mid, "no_delete_self", "Unable to delete your own account")
            if uid not in self.users:
                return self._err(mid, "not_found", "User not found")
            del self.users[uid]
            for name in [n for n, c in self.credentials.items() if c["user_id"] == uid]:
                del self.credentials[name]
            for p in self.persons.values():
                if p.get("user_id") == uid:
                    p["user_id"] = None
            return self._ok(mid)
        if kind == "person/create":
            if any(p.get("user_id") == args.get("user_id") for p in self.persons.values() if args.get("user_id")):
                return self._err(mid, "home_assistant_error", "User already taken")
            pid = uuid.uuid4().hex[:12]
            self.persons[pid] = {"id": pid, "name": args.get("name"), "user_id": args.get("user_id")}
            return self._ok(mid, dict(self.persons[pid]))
        if kind == "person/delete":
            pid = str(args.get("person_id"))
            if pid not in self.persons:
                return self._err(mid, "not_found", "Person not found")
            del self.persons[pid]
            return self._ok(mid)
        return self._err(mid, "unknown_command", "Unknown command")


class _FakeSocket:
    def __init__(self, ha: FakeHaUsers) -> None:
        self.ha = ha
        self.user: str | None = None
        self.q: asyncio.Queue = asyncio.Queue()
        self.q.put_nowait(json.dumps({"type": "auth_required", "ha_version": "2026.10.0"}))

    async def __aenter__(self) -> "_FakeSocket":
        return self

    async def __aexit__(self, *_exc: Any) -> None:
        self.q.put_nowait(None)

    async def recv(self) -> str:
        item = await self.q.get()
        if item is None:
            raise ConnectionError("fake: closed")
        return item

    async def send(self, raw: str) -> None:
        msg = json.loads(raw)
        if msg.get("type") == "auth":
            self.user = self.ha.tokens.get(str(msg.get("access_token")))
            self.q.put_nowait(json.dumps({"type": "auth_ok" if self.user else "auth_invalid", "message": "Invalid access token or password" if not self.user else ""}))
            return
        assert self.user, "a command before auth_ok"
        self.q.put_nowait(json.dumps(self.ha.handle(self.user, msg)))

    def __aiter__(self) -> "_FakeSocket":
        return self

    async def __anext__(self) -> str:
        item = await self.q.get()
        if item is None:
            raise StopAsyncIteration
        return item
