"""DOMUS-DEFAULT-2439 (owner round 33, Q-DES-20 option a): a saved skin of exactly "classic" moves to Domus once, at the first
start of the version that carries the step (services/skin_switch.py, a guarded start-up step with a done-marker).

An "upgrade" here: start the application once (the schema exists), put the settings table in the state the old version left -
what it stored, and no marker - and start the application again on the same data directory."""
from __future__ import annotations

import json

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.db import get_setting, set_setting
from smplwise.main import create_app
from smplwise.services import skin_switch

LOOK = {"ui.scheme": "dark", "ui.motion": "reduced", "ui.chip_selected": "soft", "ui.rail_tone": "dark", "ui.entry_animations": "off",
        "devices.style": "glass", "ui.accent": "#0a7d5a"}


def _old_installation(settings, rows: dict[str, str]) -> None:
    """The database as the previous version left it: the given stored rows, no marker of the one-time step."""
    app = create_app(settings)
    with TestClient(app):
        with app.state.db.connection() as conn:
            conn.execute("DELETE FROM settings WHERE key = ?", (skin_switch.MARKER,))
            conn.execute("DELETE FROM settings WHERE key = 'ui.skin'")
            for key, value in rows.items():
                set_setting(conn, key, value)
            conn.commit()


def _stored(app, key: str) -> str | None:
    with app.state.db.connection(mode="read") as conn:
        return get_setting(conn, key)


def test_saved_classic_moves_to_domus_at_the_upgrade_and_every_other_look_choice_stays(settings):
    _old_installation(settings, {"ui.skin": "classic", **LOOK})
    app = create_app(settings)
    with TestClient(app) as c:
        assert _stored(app, "ui.skin") == "domus"
        assert _stored(app, skin_switch.MARKER) == "moved:classic"
        for key, value in LOOK.items():
            assert _stored(app, key) == value, key
        served = c.get("/api/v1/settings").json()["settings"]
        assert served["ui.skin"] == "domus"
        assert served["ui.scheme"] == "dark" and served["ui.motion"] == "reduced" and served["ui.chip_selected"] == "soft"
        assert served["devices.style"] == "glass"
        assert skin_switch.MARKER not in served  # a record of the step, not a setting
        assert c.patch("/api/v1/settings", json={skin_switch.MARKER: "x", "ui.scheme": "dark"}).status_code in (200, 422)
        assert _stored(app, skin_switch.MARKER) == "moved:classic"  # not writable through the settings route


@pytest.mark.parametrize("skin", ["tesla", "crystal", "infra", "soft", "domus", "bubble", "Classic", "classic "])
def test_any_other_saved_skin_is_untouched(settings, skin):
    _old_installation(settings, {"ui.skin": skin, "devices.style": "glass"})
    app = create_app(settings)
    with TestClient(app):
        assert _stored(app, "ui.skin") == skin
        assert _stored(app, "devices.style") == "glass"
        assert _stored(app, skin_switch.MARKER) == "kept"


def test_the_glass_style_of_the_device_screens_alone_is_untouched(settings):
    _old_installation(settings, {"devices.style": "glass"})  # no stored skin at all
    app = create_app(settings)
    with TestClient(app) as c:
        assert _stored(app, "ui.skin") is None  # no row is created
        assert _stored(app, "devices.style") == "glass"
        assert _stored(app, skin_switch.MARKER) == "kept"
        assert c.get("/api/v1/settings").json()["settings"]["ui.skin"] == "domus"  # the read-time default


def test_a_second_start_does_nothing_and_a_later_choice_of_classic_sticks(settings):
    _old_installation(settings, {"ui.skin": "classic", "ui.scheme": "dark"})
    app = create_app(settings)
    with TestClient(app) as c:
        assert _stored(app, "ui.skin") == "domus"
        # the administrator chooses classic on purpose, after the move, through the settings screen's own route
        r = c.patch("/api/v1/settings", json={"ui.skin": "classic"})
        assert r.status_code == 200 and r.json()["settings"]["ui.skin"] == "classic"
    for _ in range(2):  # two more starts of the same version (and of any later one): the choice stays
        again = create_app(settings)
        with TestClient(again) as c:
            assert _stored(again, "ui.skin") == "classic"
            assert _stored(again, "ui.scheme") == "dark"
            assert _stored(again, skin_switch.MARKER) == "moved:classic"
            assert c.get("/api/v1/settings").json()["settings"]["ui.skin"] == "classic"
            with again.state.db.connection() as conn:
                assert skin_switch.run_once(conn) is None  # the step itself, called again: nothing


def test_the_step_is_idempotent_on_its_own_and_writes_the_move_and_the_marker_together(settings):
    app = create_app(settings)
    with TestClient(app):
        with app.state.db.connection() as conn:
            conn.execute("DELETE FROM settings WHERE key = ?", (skin_switch.MARKER,))
            set_setting(conn, "ui.skin", "classic")
            assert skin_switch.run_once(conn) == "moved"
            assert get_setting(conn, "ui.skin") == "domus" and get_setting(conn, skin_switch.MARKER) == "moved:classic"
            assert skin_switch.run_once(conn) is None
            set_setting(conn, "ui.skin", "classic")
            assert skin_switch.run_once(conn) is None
            assert get_setting(conn, "ui.skin") == "classic"
            conn.rollback()  # the move and the marker were one transaction: undone together
        with app.state.db.connection(mode="read") as conn:
            assert get_setting(conn, "ui.skin") != "domus" or get_setting(conn, skin_switch.MARKER) is not None


def test_a_new_installation_is_marked_at_its_first_start_and_keeps_a_classic_it_chooses(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        assert _stored(app, skin_switch.MARKER) == "kept" and _stored(app, "ui.skin") is None
        assert c.get("/api/v1/settings").json()["settings"]["ui.skin"] == "domus"
        assert c.patch("/api/v1/settings", json={"ui.skin": "classic"}).status_code == 200
        with app.state.db.connection() as conn:
            rows = [json.loads(r[0] or "{}") for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed'").fetchall()]
        assert {"ui.skin": "classic"} in rows
        bind(c, settings, "dana", "viewer", "installation", "*")
        assert c.get("/api/v1/settings", headers=as_user("dana")).json()["settings"]["ui.skin"] == "classic"
    again = create_app(settings)
    with TestClient(again):
        assert _stored(again, "ui.skin") == "classic"
