"""Test applications and what a test puts into one: identities, a seeded tree, direct bindings, sample uploads."""
from __future__ import annotations

import io

from fastapi.testclient import TestClient
from PIL import Image

from smplwise.config import Settings
from smplwise.main import create_app


def make_client(settings: Settings) -> TestClient:
    """A fresh application on `settings` and its client (what the `client` fixture returns)."""
    return TestClient(create_app(settings))


def warm_routes(client) -> None:
    """Build FastAPI's per-app route state up front, outside a timed window (TEST-DEBT-2412).

    Since fastapi 0.141 each included router of an app builds its route state (dependants, compiled paths, pydantic
    adapters) lazily, on the first request that is matched against it, under one lock. A path that matches nothing walks
    every router, so one such request builds them all: about 4-10 s on a busy workstation or runner, paid once per
    `create_app`. A test that times "the answer is immediate" from a fresh app measured that build instead of the answer
    (test_nvr_less 409 routes, the remote flood, the setup check deadline). Call this before such a timed request."""
    for path in ("/api/v1/__sw_warm_routes__", "/arx/api/v1/__sw_warm_routes__"):
        client.get(path)


def as_user(username: str) -> dict[str, str]:
    """Developer-mode identity override (only honoured when SW_DEV_USER is set and never in the add-on)."""
    return {"X-SW-Dev-User": username}


def png_bytes(width: int = 640, height: int = 400, color=(240, 240, 250)) -> bytes:
    im = Image.new("RGB", (width, height), color)
    for x in range(0, width, 40):
        for y in range(height):
            im.putpixel((x, y), (120, 130, 150))
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()


def pdf_bytes(pages: int = 2) -> bytes:
    import pymupdf

    doc = pymupdf.open()
    for i in range(pages):
        page = doc.new_page(width=595, height=842)
        page.draw_rect(pymupdf.Rect(60, 60, 535, 780), color=(0.2, 0.3, 0.5), width=2)
        page.insert_text((80, 100), f"synthetic plan page {i + 1}", fontsize=18)
    data = doc.tobytes()
    doc.close()
    return data


def seed_tree(client: TestClient) -> dict[str, str]:
    """Admin creates site → building → two floors. Returns ids."""
    site = client.post("/api/v1/sites", json={"name": "אתר בדיקה", "address": "רחוב 1"}).json()
    building = client.post(f"/api/v1/sites/{site['id']}/buildings", json={"name": "מבנה א"}).json()
    f2 = client.post(f"/api/v1/buildings/{building['id']}/floors", json={"name": "קומה 2", "level": 2}).json()
    f3 = client.post(f"/api/v1/buildings/{building['id']}/floors", json={"name": "קומה 3", "level": 3}).json()
    return {"site": site["id"], "building": building["id"], "floor2": f2["id"], "floor3": f3["id"]}


def enable_search(client: TestClient, mode: str = "all", roles: str = "") -> None:
    """TOPPILL-295: the global search is off by default; a test that exercises it turns it on first (as the installation's admin)."""
    r = client.patch("/api/v1/settings", json={"ui.global_search": mode, **({"ui.global_search_roles": roles} if roles else {})})
    assert r.status_code == 200, r.text


def bind(client: TestClient, settings: Settings, username: str, role: str, scope_type: str, scope_id: str) -> None:
    """Direct DB binding for tests (the bindings API arrives with T076/T083)."""
    from smplwise.db import Database, new_id, now_iso, permission_revision

    # make sure the user row exists so the id is stable
    client.get("/api/v1/me", headers=as_user(username))
    db = Database(settings.db_path)
    with db.connection() as conn:
        conn.execute(
            "INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) VALUES (?, 'user', ?, ?, ?, ?, 'allow', ?, 'test', ?)",
            (new_id(), f"dev-{username}", role, scope_type, scope_id, permission_revision(conn), now_iso()),
        )
