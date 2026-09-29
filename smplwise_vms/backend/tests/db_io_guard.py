"""Diagnostic: find device / network / subprocess I/O that runs while the calling code holds SQLite's write lock.

SQLite has one write lock; a request or a background job that calls the NVR, go2rtc or Home Assistant (or waits for
ffmpeg) inside its BEGIN IMMEDIATE transaction makes every other writer wait (the round-10 "database is locked" storm).
The rule (smplwise/db.py): slow I/O runs before the transaction, after it, or inside unlocked(conn).

How it attributes: at every httpx send (sync and async) and every subprocess wait, the Python stack of the calling
thread (and, for a coroutine, the frames of the coroutines awaiting it) is walked; a frame whose locals hold a
sqlite3.Connection that is currently a write-lock holder (db._holders) and inside a transaction is a violation. Request
connections are opened in one worker thread and used in another, so the stack - not the thread - is what ties the I/O
to the transaction. Limits: a fake that replaces a device function outright (instead of an httpx transport) is not
seen, and a connection reached only through an attribute (self.conn) is not seen.

Enabled for a whole pytest run by SW_DB_IO_GUARD=1 (tests/conftest.py); the findings are printed at the end of the
session and written to SW_DB_IO_GUARD_OUT (JSON) when set. It never fails a test: it is an inventory tool."""
from __future__ import annotations

import sqlite3
import subprocess
import sys
import threading
import traceback
from pathlib import Path
from typing import Any

import httpx

from smplwise import db as db_mod

_ROOT = Path(db_mod.__file__).resolve().parent


class Findings:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.items: dict[tuple[str, str, str], dict[str, Any]] = {}

    def add(self, kind: str, target: str, holder: str, where: str, test: str) -> None:
        key = (kind, holder, where)
        with self.lock:
            item = self.items.setdefault(key, {"kind": kind, "holder": holder, "where": where, "targets": set(), "tests": set(), "count": 0})
            item["count"] += 1
            item["targets"].add(target)
            item["tests"].add(test)

    def report(self) -> list[dict[str, Any]]:
        with self.lock:
            return [{**v, "targets": sorted(v["targets"])[:5], "tests": sorted(v["tests"])[:5]} for v in sorted(self.items.values(), key=lambda v: -v["count"])]


FINDINGS = Findings()
CURRENT_TEST = {"id": "?"}


def held_write_conns_in_stack(start: Any = None) -> list[tuple[str, str]]:
    """(holder label, product frame that holds it) for every write-lock-holding connection in a caller's locals."""
    holders = db_mod._holders.copy()
    if not holders:
        return []
    found: list[tuple[str, str]] = []
    seen: set[int] = set()
    f = start or sys._getframe(2)
    depth = 0
    while f is not None and depth < 200:
        depth += 1
        try:
            values = list(f.f_locals.values())
        except Exception:  # noqa: BLE001 - a frame being torn down
            values = []
        for v in values:
            if isinstance(v, sqlite3.Connection) and id(v) in holders and id(v) not in seen:
                try:
                    open_tx = v.in_transaction
                except sqlite3.ProgrammingError:
                    continue
                if open_tx:
                    seen.add(id(v))
                    found.append((holders[id(v)][0], _where(f)))
        f = f.f_back
    return found


def _where(f: Any) -> str:
    path = Path(f.f_code.co_filename)
    try:
        rel = path.resolve().relative_to(_ROOT.parent)
    except ValueError:
        rel = path.name
    return f"{rel}:{f.f_lineno} {f.f_code.co_name}"


def _product_site() -> str:
    """The innermost product frame of the current call (what issued the I/O)."""
    for fs in reversed(traceback.extract_stack(limit=80)):
        p = Path(fs.filename)
        if _ROOT in p.resolve().parents or p.resolve().parent == _ROOT:
            return f"{p.resolve().relative_to(_ROOT.parent)}:{fs.lineno} {fs.name}"
    return "?"


def _check(kind: str, target: str) -> None:
    for holder, where in held_write_conns_in_stack(sys._getframe(2)):
        FINDINGS.add(kind, target, holder, f"{where} -> {_product_site()}", CURRENT_TEST["id"])


def install(monkeypatch_setattr) -> None:
    """Wrap the I/O entry points (use a pytest MonkeyPatch.setattr so the session teardown restores them)."""
    orig_send = httpx.Client.send
    orig_asend = httpx.AsyncClient.send
    orig_run = subprocess.run
    orig_communicate = subprocess.Popen.communicate
    orig_wait = subprocess.Popen.wait

    def send(self, request, *a, **kw):
        if request.url.host != "testserver":  # the test's own ASGI client, not a device
            _check("http", f"{request.method} {request.url.host}{request.url.path[:60]}")
        return orig_send(self, request, *a, **kw)

    async def asend(self, request, *a, **kw):
        if request.url.host != "testserver":
            _check("http", f"{request.method} {request.url.host}{request.url.path[:60]}")
        return await orig_asend(self, request, *a, **kw)

    def run(*a, **kw):
        cmd = a[0] if a else kw.get("args")
        _check("subprocess", str(cmd[0] if isinstance(cmd, (list, tuple)) and cmd else cmd)[:60])
        return orig_run(*a, **kw)

    def communicate(self, *a, **kw):
        _check("subprocess", str(self.args[0] if isinstance(self.args, (list, tuple)) and self.args else self.args)[:60])
        return orig_communicate(self, *a, **kw)

    def wait(self, *a, **kw):
        _check("subprocess", str(self.args[0] if isinstance(self.args, (list, tuple)) and self.args else self.args)[:60])
        return orig_wait(self, *a, **kw)

    monkeypatch_setattr(httpx.Client, "send", send)
    monkeypatch_setattr(httpx.AsyncClient, "send", asend)
    monkeypatch_setattr(subprocess, "run", run)
    monkeypatch_setattr(subprocess.Popen, "communicate", communicate)
    monkeypatch_setattr(subprocess.Popen, "wait", wait)
