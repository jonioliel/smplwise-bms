"""CR-BE-SMALL-2440: one helper reads a request's correlation id (`correlation_id.of`, re-exported to routers as `_common.rid`).

About 30 routers, the settings-patch package, auth.py, main.py and services/rbac_admin.py each hand-rolled
`getattr(request.state, "correlation_id", None)`; they now call the helper. Behaviour is unchanged: the same id lands in the audit row's
`request_id` and in the response's X-Correlation-Id header, a well-formed client id is kept, and a request without the middleware state
reads None. The guard is static (AST over smplwise/): a new hand-rolled copy fails here."""
from __future__ import annotations

import ast
from pathlib import Path
from types import SimpleNamespace

from conftest import seed_tree
from fastapi.testclient import TestClient

from smplwise import correlation_id
from smplwise.main import create_app
from smplwise.routers import _common
from smplwise.services import rbac_admin

PKG = Path(__file__).resolve().parents[1] / "smplwise"
OWNER = PKG / "correlation_id.py"  # the one place that reads the request state


def _hand_rolled() -> list[str]:
    """Every `getattr(<x>.state, "correlation_id", ...)` outside correlation_id.py."""
    found: list[str] = []
    for path in sorted(PKG.rglob("*.py")):
        if path == OWNER:
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if (isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "getattr" and len(node.args) >= 2
                    and isinstance(node.args[0], ast.Attribute) and node.args[0].attr == "state"
                    and isinstance(node.args[1], ast.Constant) and node.args[1].value == "correlation_id"):
                found.append(f"{path.relative_to(PKG)}:{node.lineno}")
    return found


def test_no_module_hand_rolls_the_correlation_id_lookup():
    assert _hand_rolled() == [], "use correlation_id.of(request) (routers: `from ._common import rid as _rid`)"


def test_the_helpers_are_one_lookup():
    req = SimpleNamespace(state=SimpleNamespace(correlation_id="abc123def456"))
    bare = SimpleNamespace(state=SimpleNamespace())
    for fn in (correlation_id.of, _common.rid, rbac_admin._rid):
        assert fn(req) == "abc123def456"
        assert fn(bare) is None
    assert correlation_id.current() is None  # outside a request


def _audit(app, action: str) -> list[dict]:
    with app.state.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT request_id FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]


def test_audit_rows_keep_the_request_correlation_id(settings):
    """A converted router (routers/views.py): the audit row's request_id is the id the response announces - a well-formed client id
    as sent, otherwise the server's own 12-hex id; a refused client value is never written."""
    app = create_app(settings)
    c = TestClient(app)
    seed_tree(c)
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "מצלמה 1"}).json()["id"]

    r = c.post("/api/v1/views", json={"name": "א", "cameras": [cam]}, headers={"X-Correlation-Id": "client-id-2440"})
    assert r.status_code == 201, r.text
    assert r.headers["x-correlation-id"] == "client-id-2440"
    r2 = c.post("/api/v1/views", json={"name": "ב", "cameras": [cam]})
    server_id = r2.headers["x-correlation-id"]
    assert len(server_id) == 12 and int(server_id, 16) >= 0
    r3 = c.post("/api/v1/views", json={"name": "ג", "cameras": [cam]}, headers={"X-Correlation-Id": "bad value"})
    refused = r3.headers["x-correlation-id"]
    assert refused != "bad value" and len(refused) == 12

    assert [row["request_id"] for row in _audit(app, "views.create")] == ["client-id-2440", server_id, refused]


def test_an_error_envelope_carries_the_same_id(settings):
    """main.py's handlers read the id through the helper too: the envelope's correlation_id is the response header's."""
    c = TestClient(create_app(settings))
    r = c.post("/api/v1/views", json={"name": ["not", "text"]}, headers={"X-Correlation-Id": "envelope-2440"})
    assert r.status_code == 422, r.text
    assert r.json()["correlation_id"] == r.headers["x-correlation-id"] == "envelope-2440"
    r = c.patch("/api/v1/views/no-such-view", json={"name": "x"}, headers={"X-Correlation-Id": "envelope-2440-b"})
    assert r.status_code in (404, 405)
    assert r.json().get("correlation_id", "envelope-2440-b") == r.headers["x-correlation-id"] == "envelope-2440-b"
