"""Plan Studio 6 look settings (CR-029 S0, LOOK_SPEC section 10; owner rule 2026-10-09: every look choice stays changeable later
in settings). The installation's `plan.view` (PATCH /settings: system.configure, partial updates over the stored dials, audited,
in every backup) and a person's own override (PUT /plan-view/prefs: map.read, own row only, audited, in every backup, migration
0074). Defaults are the owner's answers; nothing is clamped silently; unknown dials are refused."""
from __future__ import annotations

import json

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import backup as backup_svc
from smplwise.services import plan_view as pv

OWNER_DEFAULTS = {"style": "auto", "default_view": "schematic", "furniture": "models", "textures": "files", "wall_display": "live", "time_source": "clock",
                  "mouse_mode": "drag", "quality": "auto", "kiosk_idle_s": 30, "eye_m": 1.65, "dpr_cap": 1.25, "section_cut": True, "show_temps": False,
                  "motion": True}


def test_defaults_are_the_owner_answers():
    assert pv.DEFAULT == OWNER_DEFAULTS
    assert "default_view" not in pv.SITE_DIALS  # realistic is never the installation's default for everyone (owner Q11)
    assert set(pv.USER_DIALS) <= set(pv.DEFAULT) and {"furniture", "textures", "wall_display", "kiosk_idle_s"}.isdisjoint(pv.USER_DIALS)


@pytest.mark.parametrize(("key", "value", "out"), [("eye_m", 1.2, 1.2), ("eye_m", 2.0, 2.0), ("eye_m", 1.66, 1.65), ("eye_m", 1.7, 1.7), ("dpr_cap", 1.6, 1.5),
                                                   ("kiosk_idle_s", "120", 120), ("kiosk_idle_s", 0, 0), ("style", "dark", "dark"), ("show_temps", True, True)])
def test_dials_accept_and_snap(key, value, out):
    assert pv._dial(key, value) == out


@pytest.mark.parametrize(("key", "value"), [("eye_m", 1.19), ("eye_m", 2.01), ("eye_m", "1.65"), ("eye_m", True), ("eye_m", float("nan")), ("dpr_cap", 3),
                                            ("kiosk_idle_s", 15), ("kiosk_idle_s", True), ("style", "Dark"), ("style", None), ("mouse_mode", "touch"),
                                            ("section_cut", "true"), ("motion", 1), ("quality", "ultra"), ("nope", 1)])
def test_dials_refuse(key, value):
    with pytest.raises(ValueError):
        pv._dial(key, value)


def test_site_normalisation_is_partial_and_strict():
    base = pv.stored_site(None)
    assert base == {k: OWNER_DEFAULTS[k] for k in pv.SITE_DIALS}
    out = pv.normalize_site({"furniture": "procedural", "eye_m": 1.5}, base)
    assert out == {**base, "furniture": "procedural", "eye_m": 1.5}
    for bad in ({"default_view": "realistic"}, {"colour": "red"}, "x", [], {"eye_m": 9}):
        with pytest.raises(ValueError):
            pv.normalize_site(bad, base)
    assert pv.stored_site('{"eye_m": 9, "style": "dark"}') == {**base, "style": "dark"}  # a corrupt dial reads as its default
    assert pv.stored_site("not json") == base


def test_installation_dials_round_trip_audit_and_permission(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        assert c.get("/api/v1/settings").json()["settings"]["plan.view"] == {k: OWNER_DEFAULTS[k] for k in pv.SITE_DIALS}
        r = c.patch("/api/v1/settings", json={"plan.view": {"furniture": "procedural", "wall_display": "stills"}})
        assert r.status_code == 200, r.text
        r = c.patch("/api/v1/settings", json={"plan.view": {"kiosk_idle_s": 600}})  # partial: the earlier change stays
        view = r.json()["settings"]["plan.view"]
        assert view["furniture"] == "procedural" and view["wall_display"] == "stills" and view["kiosk_idle_s"] == 600
        for bad in ({"default_view": "realistic"}, {"furniture": "photoreal"}, {"eye_m": 2.5}, {"x": 1}):
            assert c.patch("/api/v1/settings", json={"plan.view": bad}).status_code == 422, bad
        assert c.get("/api/v1/settings").json()["settings"]["plan.view"] == view  # refused values stored nothing
        with app.state.db.connection() as conn:
            rows = [json.loads(x[0] or "{}") for x in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed' ORDER BY rowid")]
        assert any("plan.view" in d and d["plan.view"]["kiosk_idle_s"] == 600 for d in rows)
        bind(c, settings, "dana", "viewer", "installation", "*")
        assert c.patch("/api/v1/settings", headers=as_user("dana"), json={"plan.view": {"furniture": "models"}}).status_code == 403
        assert c.get("/api/v1/settings").json()["settings"]["plan.view"]["furniture"] == "procedural"


def test_own_dials_are_partial_personal_validated_audited_and_clearable(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        c.get("/api/v1/me")
        bind(c, settings, "dana", "viewer", "installation", "*")
        body = c.get("/api/v1/plan-view/prefs", headers=as_user("dana")).json()
        assert body["own"] == {} and body["effective"] == OWNER_DEFAULTS and body["can_edit_site"] is False
        assert body["personal_dials"] == list(pv.USER_DIALS)
        r = c.put("/api/v1/plan-view/prefs", headers=as_user("dana"), json={"prefs": {"default_view": "realistic", "eye_m": 1.2, "mouse_mode": "lock"}})
        assert r.status_code == 200, r.text
        assert r.json()["own"] == {"default_view": "realistic", "eye_m": 1.2, "mouse_mode": "lock"}
        assert r.json()["effective"]["default_view"] == "realistic" and r.json()["effective"]["eye_m"] == 1.2
        # the installation changes what dana did not override, never what she did
        c.patch("/api/v1/settings", json={"plan.view": {"eye_m": 1.8, "style": "dark"}})
        eff = c.get("/api/v1/plan-view/prefs", headers=as_user("dana")).json()["effective"]
        assert eff["eye_m"] == 1.2 and eff["style"] == "dark"
        # another person is untouched
        assert c.get("/api/v1/plan-view/prefs").json()["own"] == {}
        for bad in ({"furniture": "procedural"}, {"kiosk_idle_s": 10}, {"eye_m": 3}, {"x": 1}, {"style": "neon"}):
            assert c.put("/api/v1/plan-view/prefs", headers=as_user("dana"), json={"prefs": bad}).status_code == 422, bad
        assert c.put("/api/v1/plan-view/prefs", headers=as_user("dana"), json={"other": 1}).status_code == 422
        # null puts a dial back on the installation; an empty override deletes the row
        r = c.put("/api/v1/plan-view/prefs", headers=as_user("dana"), json={"prefs": {"eye_m": None}})
        assert r.json()["own"] == {"default_view": "realistic", "mouse_mode": "lock"} and r.json()["effective"]["eye_m"] == 1.8
        c.put("/api/v1/plan-view/prefs", headers=as_user("dana"), json={"prefs": {"default_view": None, "mouse_mode": None}})
        with app.state.db.connection() as conn:
            assert conn.execute("SELECT COUNT(*) FROM plan_view_prefs WHERE user_id = 'dev-dana'").fetchone()[0] == 0
            audits = conn.execute("SELECT decision, resource_id FROM audit_log WHERE action = 'plan.view_prefs' ORDER BY rowid").fetchall()
        assert [tuple(a) for a in audits] == [("allowed", "dev-dana")] * 3


def test_a_person_without_map_read_may_not_keep_a_look(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        c.get("/api/v1/me", headers=as_user("eve"))  # no binding at all
        assert c.get("/api/v1/plan-view/prefs", headers=as_user("eve")).status_code == 403
        assert c.put("/api/v1/plan-view/prefs", headers=as_user("eve"), json={"prefs": {"eye_m": 1.5}}).status_code == 403
        with app.state.db.connection() as conn:
            assert conn.execute("SELECT COUNT(*) FROM plan_view_prefs").fetchone()[0] == 0
            assert conn.execute("SELECT decision FROM audit_log WHERE action = 'plan.view_prefs'").fetchall()[-1][0] == "denied"


def test_the_own_dials_are_backed_up_and_survive_an_older_archive():
    assert "plan_view_prefs" in backup_svc.PROJECT_TABLES and "plan_view_prefs" in backup_svc.KEEP_WHEN_ABSENT
    assert "plan_view_prefs" not in backup_svc.ACCESS_TABLES
