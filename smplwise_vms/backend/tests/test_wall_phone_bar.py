"""WALL-PHONE-TOOLBAR-2401 (owner 04.11 evening): הגדרות › כללי › וידאו ומדיה › "סרגל קיר המצלמות בטלפון" (ui.wall_phone_bar).

icons (default) = one row of icon keys on a phone; labels = two rows with the full labels. Installation-wide: read by any signed-in user (the
phone wall of a viewer follows it), written only with system.configure, only the two values, audited like every settings change."""
import json

from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.routers.settings import DEFAULTS, SettingsPatch

KEY = "ui.wall_phone_bar"
URL = "/api/v1/settings"


def test_default_is_one_row_of_icons():
    assert DEFAULTS[KEY] == "icons"
    assert SettingsPatch.model_fields["ui_wall_phone_bar"].alias == KEY


def test_fresh_installation_reads_icons(settings):
    with TestClient(create_app(settings)) as c:
        assert c.get(URL).json()["settings"][KEY] == "icons"


def test_round_trip_both_values_and_audit(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        r = c.patch(URL, json={KEY: "labels"})
        assert r.status_code == 200, r.text
        assert r.json()["settings"][KEY] == "labels"
        assert c.get(URL).json()["settings"][KEY] == "labels"
        assert c.patch(URL, json={KEY: "icons"}).json()["settings"][KEY] == "icons"
        assert c.get(URL).json()["settings"][KEY] == "icons"
        with app.state.db.connection() as conn:
            rows = [json.loads(r[0] or "{}") for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed' ORDER BY rowid").fetchall()]
        assert {KEY: "labels"} in rows and {KEY: "icons"} in rows


def test_other_values_are_refused_and_change_nothing(settings):
    with TestClient(create_app(settings)) as c:
        assert c.patch(URL, json={KEY: "labels"}).status_code == 200
        for bad in ("", "icon", "Icons", "LABELS", "two", "one", "1", "2", "true", "icons ", " labels", "icons;labels"):
            assert c.patch(URL, json={KEY: bad}).status_code == 422, bad
        for bad in (1, True, ["icons"], {"v": "icons"}):
            assert c.patch(URL, json={KEY: bad}).status_code == 422, bad
        assert c.get(URL).json()["settings"][KEY] == "labels"


def test_read_by_a_viewer_written_only_with_system_configure(settings):
    with TestClient(create_app(settings)) as c:
        assert c.patch(URL, json={KEY: "labels"}).status_code == 200
        bind(c, settings, "dana", "viewer", "installation", "*")
        assert c.get(URL, headers=as_user("dana")).json()["settings"][KEY] == "labels"
        assert c.patch(URL, json={KEY: "icons"}, headers=as_user("dana")).status_code == 403
        assert c.get(URL).json()["settings"][KEY] == "labels"


def test_other_settings_leave_it_alone(settings):
    with TestClient(create_app(settings)) as c:
        assert c.patch(URL, json={KEY: "labels"}).status_code == 200
        r = c.patch(URL, json={"ui.wall_count": 9, "ui.kiosk_cols": 2, "ui.kiosk_rows": 2})
        assert r.status_code == 200, r.text
        assert r.json()["settings"][KEY] == "labels"
        r = c.patch(URL, json={"ui.wall_count": 6, KEY: "icons"})
        assert r.status_code == 200, r.text
        s = r.json()["settings"]
        assert s[KEY] == "icons" and str(s["ui.wall_count"]) == "6"
