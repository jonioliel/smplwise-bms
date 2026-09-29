"""Fixture backend for tests/evidence-arx-remote.spec.ts (CR-008 SmplWise Arx MVP): the REAL SMPLWISE backend with the
remote channel ON (`/arx/`, serving the built UI), whose only fake is Home Assistant core
(smplwise_vms/backend/tests/fake_ha_core.py): the login flow (`/auth/providers`, `/auth/login_flow` with PKCE and the
MFA step, `/auth/token` incl. refresh and revoke) on a small HTTP server, and the WebSocket API's `auth` +
`auth/current_user` in-process (the add-on's token validation). HA_CORE_URL is forced to a `.test` host (a reserved
name that never resolves) and the validation's dial is swapped for the fake, so no real Home Assistant is ever reached;
it refuses to start inside the add-on.

The browser reaches HA's endpoints on the SAME origin as /arx/ in production (the tunnel sends everything but /arx to
HA). Here the spec routes `http://127.0.0.1:<SW_PORT>/auth/**` to the fake's HTTP server with Playwright's page.route.

Seeded HA users (password = pw-<username>):
    joni  u-owner   HA owner + admin, Arx system_admin, remote flag on
    dana  u-viewer  Arx viewer, remote flag on
    avi   u-mfa     Arx viewer, remote flag on, MFA code 123456
    noa   u-noflag  Arx viewer, NO remote flag (remote.policy = flag refuses her)
plus a site / building / floor so the viewer's map has something to show.

Run it (a fresh data dir each time; `npm run build` first - the UI is served from frontend/dist):

    SW_PORT=8349 SW_DATA_DIR=<empty dir> <repo>/.venv/Scripts/python.exe frontend/tests/fixtures/arx_fake_ha.py

then, from frontend/:

    SW_LIVE=1 SW_ARX_FIXTURE=1 SW_API_PORT=8349 npx playwright test tests/evidence-arx-remote.spec.ts --workers=1

The fake HA's HTTP server listens on SW_PORT + 2 (SW_FAKE_HA_PORT); `GET /fake/state` lists its refresh tokens.
"""
from __future__ import annotations

import os
import shutil
import sys
import tempfile
from pathlib import Path

if os.environ.get("SUPERVISOR_TOKEN"):
    sys.exit("arx_fake_ha: refusing to run inside the Home Assistant add-on")

ROOT = Path(__file__).resolve().parents[3]
BACKEND = ROOT / "smplwise_vms" / "backend"
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(BACKEND / "tests"))
PORT = int(os.environ.get("SW_PORT", "8349"))
FAKE_PORT = int(os.environ.get("SW_FAKE_HA_PORT", str(PORT + 2)))
DIST = ROOT / "frontend" / "dist"
if not (DIST / "index.html").exists():
    sys.exit("arx_fake_ha: build the UI first (npm run build in frontend/)")

# the UI from a copy of dist, plus a placeholder service worker when the PWA branch's arx-sw.js is not there yet
WWW = Path(tempfile.mkdtemp(prefix="arx-www-"))
shutil.copytree(DIST, WWW, dirs_exist_ok=True)
if not (WWW / "arx-sw.js").exists():
    (WWW / "arx-sw.js").write_text("// placeholder service worker for the Arx fixture (the PWA branch ships the real one)\n", encoding="utf-8")

os.environ["SW_WWW_DIR"] = str(WWW)
os.environ["SW_REMOTE_ACCESS"] = "1"
os.environ["SW_REMOTE_PATH"] = "/arx"
os.environ["HA_CORE_URL"] = "http://fake-ha-core.test:8123"
os.environ.pop("HA_URL", None)
os.environ.pop("HA_TOKEN", None)
os.environ.setdefault("SW_DEV_USER", "joni")  # the local channel (the spec's seeding) only; /arx never uses it
os.environ.setdefault("SW_BOOTSTRAP_ADMIN", "joni")
os.environ.setdefault("SW_MODE", "ha_only")  # no NVR: the map and device control, nothing that would dial a camera

from fake_ha_core import FakeHaCore, FakeUser  # noqa: E402
from smplwise.config import load_settings  # noqa: E402
from smplwise.db import Database, new_id, now_iso, permission_revision  # noqa: E402
from smplwise.services import ha_user_auth  # noqa: E402

CORE = FakeHaCore()
USERS = [
    (FakeUser("u-owner", "joni", "pw-joni", "יוני אוליאל", is_owner=True, is_admin=True), "system_admin", True),
    (FakeUser("u-viewer", "dana", "pw-dana", "דנה כהן"), "viewer", True),
    (FakeUser("u-mfa", "avi", "pw-avi", "אבי לוי", mfa_code="123456"), "viewer", True),
    (FakeUser("u-noflag", "noa", "pw-noa", "נועה"), "viewer", False),
]


def seed() -> None:
    settings = load_settings()
    db = Database(settings.db_path)
    db.migrate()
    with db.connection() as conn:
        for user, role, flag in USERS:
            CORE.add_user(user)
            conn.execute("INSERT OR REPLACE INTO ha_users(id, name, username, is_active, is_admin, synced_at) VALUES (?, ?, ?, 1, ?, ?)",
                         (user.id, user.name, user.username, int(user.is_admin), now_iso()))
            conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                         "VALUES (?, 'user', ?, ?, 'installation', '*', 'allow', ?, 'arx-fixture', ?)", (new_id(), user.id, role, permission_revision(conn), now_iso()))
            if flag:
                conn.execute("INSERT OR IGNORE INTO remote_access_users(user_id, granted_by, granted_at) VALUES (?, 'arx-fixture', ?)", (user.id, now_iso()))
        if not conn.execute("SELECT 1 FROM sites").fetchone():
            site, building, floor = new_id(), new_id(), new_id()
            now = now_iso()
            conn.execute("INSERT INTO sites(id, name, address, timezone, sort_order, created_at, updated_at) VALUES (?, 'אתר Arx', 'רחוב הבדיקה 1', 'Asia/Jerusalem', 0, ?, ?)", (site, now, now))
            conn.execute("INSERT INTO buildings(id, site_id, name, sort_order, created_at, updated_at) VALUES (?, ?, 'מבנה ראשי', 0, ?, ?)", (building, site, now, now))
            conn.execute("INSERT INTO floors(id, building_id, name, level, sort_order, created_at, updated_at) VALUES (?, ?, 'קומת קרקע', 0, 0, ?, ?)", (floor, building, now, now))


def main() -> None:
    ha_user_auth._dial = CORE.dial  # type: ignore[assignment]
    seed()
    CORE.serve(FAKE_PORT)
    print(f"arx_fake_ha: fake Home Assistant core on http://127.0.0.1:{FAKE_PORT}; Arx on http://127.0.0.1:{PORT}/arx/", flush=True)
    from smplwise.__main__ import main as serve

    serve()


if __name__ == "__main__":
    main()
