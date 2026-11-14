"""T036: the smoke test after an upgrade runs its read-only checks against a backend, degrades to 'skip' when the
NVR is not configured or the caller has no VMS role, and fails only on real breakage."""
from __future__ import annotations

import importlib.util
from pathlib import Path

from conftest import as_user, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("smoke_after_upgrade", ROOT / "scripts" / "smoke_after_upgrade.py")
sm = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(sm)


class Adapter(sm.Client):
    """Drive the FastAPI TestClient through the script's client protocol."""

    def __init__(self, c: TestClient, headers: dict[str, str] | None = None) -> None:
        self.c = c
        self.headers = headers or {}

    def request(self, method, path, body=None, timeout=30):  # noqa: ARG002
        url = "/" + path.lstrip("/") if path else "/"
        r = self.c.request(method, url, json=body, headers=self.headers)
        return r.status_code, r.content, r.headers.get("content-type", "")


def test_smoke_passes_on_a_fresh_backend_without_an_nvr(settings):
    app = create_app(settings)
    c = TestClient(app)
    seed_tree(c)
    c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"})
    results = sm.run_smoke(Adapter(c))
    by = {n: (s, d) for n, s, d in results}
    assert by["health"][0] == "ok" and by["identity"][0] == "ok" and "has_access=True" in by["identity"][1]
    assert by["nvr"][0] == "skip" and by["snapshot"][0] == "skip" and by["playback"][0] == "skip", "no NVR configured: media checks are skipped, not failed"
    assert by["cameras"][0] == "ok" and "1 cameras" in by["cameras"][1]
    assert by["sites"][0] == "ok" and by["events"][0] == "ok" and by["saved views"][0] == "ok" and by["audit"][0] == "ok"
    assert by["ui"][0] == "skip", "API-only test backend has no built UI"
    assert not [n for n, s, _ in results if s == "fail"], results


def test_smoke_skips_privileged_checks_for_a_user_without_a_role(settings):
    app = create_app(settings)
    c = TestClient(app)
    results = sm.run_smoke(Adapter(c, as_user("nobody")))
    by = {n: (s, d) for n, s, d in results}
    assert by["identity"][0] == "ok" and "has_access=False" in by["identity"][1]
    assert by["cameras"][0] == "skip" and "no VMS role" in by["cameras"][1]
    assert "storage" not in by, "the run stops after identity when the user has no role"
    assert not [n for n, s, _ in results if s == "fail"]


def test_smoke_fails_when_health_is_unreachable():
    class Dead(sm.Client):
        def request(self, method, path, body=None, timeout=30):  # noqa: ARG002
            return 503, b"", ""

    results = sm.run_smoke(Dead())
    assert results == [("health", "fail", "GET /health -> 503")]
