"""CR-READCONN-A-2436 (review 05:P1-02, 02:P1-3, 02:P1-4): a GET route that only reads runs on the request's READ connection
(auth.current_principal_ro + auth.get_read_conn) and never takes SQLite's single write lock (auth.get_conn: BEGIN IMMEDIATE).

Two checks:

1. Inventory - every GET route in scope whose dependency tree reaches `auth.get_conn` must be listed in an allow-list file
   (`tests/get_write_allowlist_*.txt`, one `GET <path>  # why` per line): the routes that really write while they read
   (lazy creation, a mirror refresh). An allow-list entry whose route is gone or no longer reaches `get_conn` fails too, so
   the list never keeps a stale exemption.
   Scope: the access-area routers of READCONN-A (`ACCESS_MODULES`). Once `tests/get_write_allowlist_rest.txt` exists
   (CR-READCONN-B), every GET route of the application is in scope and every allow-list file is read.
2. Behaviour - each in-scope GET route that is not allow-listed answers while another connection holds the write lock.
"""
from __future__ import annotations

import importlib
import pkgutil
import threading
from pathlib import Path

import pytest
from fastapi import APIRouter
from fastapi.routing import APIRoute

import smplwise.routers as routers_pkg
from smplwise import auth
from smplwise.main import create_app

API = "/api/v1"
HERE = Path(__file__).resolve().parent
ACCESS_MODULES = (
    "door_windows", "schedules", "door_automations", "access_control", "access", "doors", "local_identity",
    "wiskey_relay_map", "access_groups", "ha_users", "service_identity", "quiet",
)
REST_ALLOWLIST = HERE / "get_write_allowlist_rest.txt"


def _allowlist() -> dict[str, str]:
    """{"GET /api/v1/...": reason} from every allow-list file that applies."""
    out: dict[str, str] = {}
    for f in sorted(HERE.glob("get_write_allowlist_*.txt")):
        for line in f.read_text(encoding="utf-8").splitlines():
            text = line.split("#", 1)[0].strip()
            if not text:
                continue
            method, _, path = text.partition(" ")
            assert method == "GET" and path.strip().startswith("/"), f"{f.name}: malformed line {line!r}"
            out[f"GET {path.strip()}"] = line.split("#", 1)[1].strip() if "#" in line else ""
    return out


def _reaches_write_conn(dependant) -> bool:
    for dep in dependant.dependencies:
        if dep.call is auth.get_conn or _reaches_write_conn(dep):
            return True
    return False


def _router_modules() -> list[str]:
    """The router modules in scope: the access area, or every router module once the rest allow-list exists."""
    if not REST_ALLOWLIST.exists():
        return list(ACCESS_MODULES)
    return sorted(info.name for info in pkgutil.iter_modules(routers_pkg.__path__))


def _get_routes() -> list[tuple[str, APIRoute]]:
    """("GET /api/v1/...", route) for every GET route of the in-scope routers, read from each module's own APIRouter objects
    (as tests/test_plan_routes_unique.py does: independent of how a FastAPI version wraps included routers, and no
    application is built). Every API router is mounted under /api/v1."""
    out: list[tuple[str, APIRoute]] = []
    seen: list[APIRouter] = []
    for name in _router_modules():
        mod = importlib.import_module(f"smplwise.routers.{name}")
        for value in vars(mod).values():
            if not isinstance(value, APIRouter) or any(value is r for r in seen):
                continue
            seen.append(value)
            for r in value.routes:
                if isinstance(r, APIRoute) and "GET" in r.methods and r.endpoint.__module__ == mod.__name__:
                    out.append((f"GET {API}{value.prefix}{r.path}", r))
    return out


def test_allowlist_is_well_formed_and_access_modules_exist():
    assert _allowlist(), "the access allow-list is read"
    for name in ACCESS_MODULES:
        assert any(r.endpoint.__module__ == f"smplwise.routers.{name}" for _, r in _get_routes()), name


def test_get_routes_on_the_write_connection_are_allow_listed():
    allow = _allowlist()
    routes = _get_routes()
    on_write = {key for key, r in routes if _reaches_write_conn(r.dependant)}
    missing = sorted(on_write - set(allow))
    assert not missing, (
        "these GET routes take the write lock (auth.get_conn) but are not in tests/get_write_allowlist_*.txt; move them to "
        "current_principal_ro + get_read_conn, or allow-list them with the reason they write:\n  " + "\n  ".join(missing))
    by_key = dict(routes)
    stale = sorted(k for k in allow if k not in by_key or not _reaches_write_conn(by_key[k].dependant))
    assert not stale, "allow-list entries whose route is gone or no longer uses the write connection:\n  " + "\n  ".join(stale)


def _concrete(route: APIRoute) -> str:
    path = API + route.path
    for p in route.dependant.path_params:
        value = "1" if p.field_info.annotation is int or getattr(p, "type_", None) is int else "zz-test"
        path = path.replace("{" + p.name + "}", value)
    return path


# Read routes that record one audit row on success: on the read connection audit() writes it through a short side transaction
# (db.write_aside), which waits for the lock by design - the request no longer holds the lock for its whole run, but it cannot
# finish while another connection holds it. They are checked without a held lock (still: no write connection of their own).
AUDITS_ON_SUCCESS = {
    f"GET {API}/intercom/diagnostics",  # intercom.diagnostics.read
    f"GET {API}/identity/local-users/export",  # identity.local.user.exported
}

_ALLOW = _allowlist()
_CONVERTED = [(key, _concrete(r)) for key, r in _get_routes() if key not in _ALLOW]


@pytest.mark.parametrize(("key", "url"), _CONVERTED, ids=[k for k, _ in _CONVERTED])
def test_converted_get_answers_while_the_write_lock_is_held(settings, monkeypatch, key, url):
    """Deterministic, not a stopwatch: the request must not ask for a write connection of its own (the request
    connections are labelled `<method> <path>`, auth.get_conn / get_read_conn), and it must answer - not 500 - while another
    connection holds the write lock (a GET on get_conn would queue behind it and fail after BUSY_TIMEOUT_S). A 4xx or a
    domain 503 (`ha_not_configured`) is an answer: the test is about the connection, not the fixture's data."""
    from fastapi.testclient import TestClient

    from smplwise.db import Database

    app = create_app(settings)
    c = TestClient(app)
    assert c.get(f"{API}/me").status_code == 200  # the bootstrap administrator and the user touch exist before the lock is taken
    db = app.state.db
    opened: list[tuple[str, str | None]] = []
    original = Database.connection

    def recording(self, mode="write", label=None, durable=True):
        opened.append((mode, label))
        return original(self, mode=mode, label=label, durable=durable)

    hold = key not in AUDITS_ON_SUCCESS
    held, release = threading.Event(), threading.Event()

    def writer():
        with db.connection(label="test holder") as conn:  # BEGIN IMMEDIATE: holds the write lock until released
            conn.execute("INSERT INTO settings(key, value) VALUES ('readconn_hold', '1')")
            held.set()
            release.wait(120)

    t = threading.Thread(target=writer, daemon=True)
    if hold:
        t.start()
        assert held.wait(30)
    monkeypatch.setattr(Database, "connection", recording)
    try:
        r = c.get(url)
    finally:
        monkeypatch.setattr(Database, "connection", original)
        release.set()
        if hold:
            t.join(30)
    own = [m for m, label in opened if label == f"GET {url}"]
    assert own, f"{key}: the request opened no labelled request connection (the recorder missed it)"
    assert "write" not in own, f"{key} opened a WRITE request connection (auth.get_conn): {own}"
    assert r.status_code != 500, f"{key} -> {r.status_code}: {r.text[:300]}"
