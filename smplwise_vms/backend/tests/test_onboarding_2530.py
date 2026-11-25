"""DOCS-ONBOARDING-2530 (T071): the first-run "getting started" checklist.

- `onboarding.enabled` is an installation setting, "false" by default (today's behaviour: an existing installation never shows the
  checklist); PATCH /settings takes true | false only, system.configure only, and every viewer reads it.
- A FRESH installation (this start ran migration 1) stores "true" once (startup_steps.mark_fresh_install_onboarding); an existing
  database (no migration 1 in this start), an explicit choice already stored, and a developer / test backend (SW_DEV_USER) are left alone.
- `onboarding.dismissed` is the user's own (/me/prefs): true or null, per user.
- A backup never carries the switch (services/backup.SETTINGS_KEEP)."""
from __future__ import annotations

import dataclasses
from types import SimpleNamespace

from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise import startup_steps
from smplwise.db import Database, get_setting, set_setting
from smplwise.main import create_app
from smplwise.services import backup
from smplwise.services.settings_store import DEFAULTS


def test_default_is_off_and_patch_is_admin_only_and_closed(settings):
    c = TestClient(create_app(settings))  # a developer backend: a fresh test database behaves like an existing installation
    assert DEFAULTS["onboarding.enabled"] == "false"
    assert c.get("/api/v1/settings").json()["settings"]["onboarding.enabled"] == "false"
    r = c.patch("/api/v1/settings", json={"onboarding.enabled": "true"})
    assert r.status_code == 200 and r.json()["settings"]["onboarding.enabled"] == "true"
    for bad in ("yes", "on", "", True):
        assert c.patch("/api/v1/settings", json={"onboarding.enabled": bad}).status_code == 422, bad
    bind(c, settings, "dana", "viewer", "installation", "*")
    assert c.get("/api/v1/settings", headers=as_user("dana")).json()["settings"]["onboarding.enabled"] == "true"  # readable by every viewer
    assert c.patch("/api/v1/settings", json={"onboarding.enabled": "false"}, headers=as_user("dana")).status_code == 403
    assert c.patch("/api/v1/settings", json={"onboarding.enabled": "false"}).json()["settings"]["onboarding.enabled"] == "false"


def _app(db: Database) -> SimpleNamespace:
    return SimpleNamespace(state=SimpleNamespace(db=db))


def test_fresh_installation_switches_the_checklist_on_once(settings, tmp_path):
    db = Database(tmp_path / "fresh.db")
    applied = db.migrate()
    assert 1 in applied
    prod = dataclasses.replace(settings, dev_user=None)
    startup_steps.mark_fresh_install_onboarding(_app(db), prod, applied)
    with db.connection(mode="read") as conn:
        assert get_setting(conn, "onboarding.enabled") == "true"
    # an administrator's later choice is never overwritten, not even by a second "fresh" signal
    with db.connection() as conn:
        set_setting(conn, "onboarding.enabled", "false")
    startup_steps.mark_fresh_install_onboarding(_app(db), prod, applied)
    with db.connection(mode="read") as conn:
        assert get_setting(conn, "onboarding.enabled") == "false"


def test_existing_installation_and_developer_backend_are_left_alone(settings, tmp_path):
    db = Database(tmp_path / "existing.db")
    db.migrate()
    prod = dataclasses.replace(settings, dev_user=None)
    # an existing database: this start applied only newer migrations (or none)
    startup_steps.mark_fresh_install_onboarding(_app(db), prod, [224])
    startup_steps.mark_fresh_install_onboarding(_app(db), prod, [])
    startup_steps.mark_fresh_install_onboarding(_app(db), prod, None)
    with db.connection(mode="read") as conn:
        assert get_setting(conn, "onboarding.enabled") is None
    # a developer / test backend, even on a fresh database
    dev = Database(tmp_path / "dev.db")
    applied = dev.migrate()
    startup_steps.mark_fresh_install_onboarding(_app(dev), settings, applied)
    with dev.connection(mode="read") as conn:
        assert get_setting(conn, "onboarding.enabled") is None


def test_a_failure_never_blocks_the_start(settings):
    class Broken:
        def connection(self, *a, **k):
            raise RuntimeError("disk gone")

    startup_steps.mark_fresh_install_onboarding(_app(Broken()), dataclasses.replace(settings, dev_user=None), [1, 2])  # logs, never raises


def test_fresh_production_app_reads_on(settings):
    """The whole start: a production-shaped app (no developer identity) on an empty data directory reads the checklist as on."""
    app = create_app(dataclasses.replace(settings, dev_user=None))
    with app.state.db.connection(mode="read") as conn:
        assert get_setting(conn, "onboarding.enabled") == "true"


def test_dismissal_is_per_user_true_or_null(settings):
    c = TestClient(create_app(settings))
    assert c.get("/api/v1/me/prefs").json()["prefs"]["onboarding.dismissed"] is None
    r = c.put("/api/v1/me/prefs", json={"onboarding.dismissed": True})
    assert r.status_code == 200 and r.json()["prefs"]["onboarding.dismissed"] is True and "onboarding.dismissed" in r.json()["stored"]
    for bad in (False, "true", 1, {"dismissed": True}):
        assert c.put("/api/v1/me/prefs", json={"onboarding.dismissed": bad}).status_code == 422, bad
    bind(c, settings, "dana", "viewer", "installation", "*")
    assert c.get("/api/v1/me/prefs", headers=as_user("dana")).json()["prefs"]["onboarding.dismissed"] is None
    r = c.put("/api/v1/me/prefs", json={"onboarding.dismissed": None})
    assert r.json()["prefs"]["onboarding.dismissed"] is None and "onboarding.dismissed" not in r.json()["stored"]


def test_backup_never_carries_the_switch():
    assert "onboarding.enabled" in backup.SETTINGS_KEEP
