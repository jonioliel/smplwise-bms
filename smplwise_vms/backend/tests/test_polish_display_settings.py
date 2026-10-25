"""POLISH-295 (owner approval 2026-10-25): the display choices of the polished control screens - the home screen's info bar or cards
(`home.info_style`), the schedules list's default view (`ui.schedules_view`) and the rows per page of the long lists on a desktop and on a
phone (`ui.page_size.*`). Read by everyone (the operator screens follow them), written only with system.configure, audited; the
frontend (src/api/screen-display.ts) lists the same values and defaults."""
import json
import re
from pathlib import Path

from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app

FRONT = Path(__file__).resolve().parents[3] / "frontend" / "src" / "api" / "screen-display.ts"

SIZES = {"ui.page_size.schedules": 10, "ui.page_size.schedules_phone": 7, "ui.page_size.automations": 12, "ui.page_size.automations_phone": 9}


def test_the_frontend_lists_the_same_values_and_defaults():
    src = FRONT.read_text(encoding="utf-8")
    assert re.search(r"INFO_STYLES: readonly InfoStyle\[\] = \['bar', 'cards'\]", src)
    assert re.search(r"INFO_STYLE_DEFAULT: InfoStyle = 'bar'", src)
    assert re.search(r"SCHEDULES_VIEWS: readonly SchedulesView\[\] = \['rows', 'cards', 'table', 'week'\]", src)
    assert re.search(r"SCHEDULES_VIEW_DEFAULT: SchedulesView = 'rows'", src)
    assert "schedules: { wide: 10, phone: 7 }, automations: { wide: 12, phone: 9 }" in src
    assert "PAGE_SIZE_MIN = 3" in src and "PAGE_SIZE_MAX = 50" in src


def test_defaults_round_trip_refusals_and_audit(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        s = c.get("/api/v1/settings").json()["settings"]
        assert s["home.info_style"] == "bar" and s["ui.schedules_view"] == "rows"
        for key, value in SIZES.items():
            assert s[key] == value, key  # read back as numbers
        r = c.patch("/api/v1/settings", json={"home.info_style": "cards", "ui.schedules_view": "week", "ui.page_size.schedules": 25, "ui.page_size.automations_phone": 3})
        assert r.status_code == 200, r.text
        got = r.json()["settings"]
        assert got["home.info_style"] == "cards" and got["ui.schedules_view"] == "week"
        assert got["ui.page_size.schedules"] == 25 and got["ui.page_size.automations_phone"] == 3
        for bad in ({"home.info_style": "chips"}, {"home.info_style": ""}, {"ui.schedules_view": "grid"}, {"ui.page_size.schedules": 2}, {"ui.page_size.schedules": 51}, {"ui.page_size.automations": "lots"}):
            assert c.patch("/api/v1/settings", json=bad).status_code == 422, bad
        assert c.get("/api/v1/settings").json()["settings"]["ui.page_size.schedules"] == 25
        with app.state.db.connection() as conn:
            rows = [json.loads(r[0] or "{}") for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed' ORDER BY rowid").fetchall()]
        assert any(r.get("home.info_style") == "cards" for r in rows)


def test_a_viewer_reads_them_and_cannot_change_them(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        assert c.patch("/api/v1/settings", json={"home.info_style": "cards"}).status_code == 200
        bind(c, settings, "dana", "viewer", "installation", "*")
        seen = c.get("/api/v1/settings", headers=as_user("dana"))
        assert seen.status_code == 200 and seen.json()["settings"]["home.info_style"] == "cards"
        for body in ({"home.info_style": "bar"}, {"ui.page_size.schedules": 5}, {"ui.schedules_view": "cards"}):
            assert c.patch("/api/v1/settings", json=body, headers=as_user("dana")).status_code == 403, body
        assert c.get("/api/v1/settings").json()["settings"]["home.info_style"] == "cards"
