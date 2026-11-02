"""TREE-HIDE-UNASSIGNED-2331 (owner 01.11): "הצג 'ללא שיוך' בעץ" - home.screen.tree_unassigned = always (default, as before) |
editing (only while the screen editor is open) | never. One installation setting (PATCH /settings, system.configure, audited);
presentation only - the devices tree keeps the bucket and the building counts keep counting it."""
import json

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import home_screen_options as hso

API = "/api/v1"


def test_choice_values_and_default():
    assert hso.CHOICES["tree_unassigned"] == ("always", "editing", "never")
    assert hso.default()["tree_unassigned"] == "always"  # today's behaviour
    base = hso.default()
    for v in ("editing", "never", "always"):
        assert hso.normalize({"tree_unassigned": v}, base)["tree_unassigned"] == v
    assert base["tree_unassigned"] == "always"  # the base is not modified
    # a partial update keeps the other keys
    out = hso.normalize({"tree_unassigned": "never"}, hso.normalize({"floor_off": "buttons"}, base))
    assert out["floor_off"] == "buttons" and out["tree_unassigned"] == "never"


@pytest.mark.parametrize("bad", ["hidden", "", None, True, 0, ["never"], "ALWAYS"])
def test_bad_values_are_refused(bad):
    with pytest.raises(ValueError):
        hso.normalize({"tree_unassigned": bad}, hso.default())


def test_stored_value_tolerates_corruption():
    assert hso.stored('{"tree_unassigned": "editing"}')["tree_unassigned"] == "editing"
    assert hso.stored('{"tree_unassigned": "maybe"}')["tree_unassigned"] == "always"  # a corrupt value reads as the defaults


def test_round_trip_permission_audit_and_data_unchanged(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        assert c.get(f"{API}/settings").json()["settings"]["home.screen"]["tree_unassigned"] == "always"
        before = c.get(f"{API}/devices/tree")
        r = c.patch(f"{API}/settings", json={"home.screen": {"tree_unassigned": "editing"}})
        assert r.status_code == 200, r.text
        got = c.get(f"{API}/settings").json()["settings"]["home.screen"]
        assert got["tree_unassigned"] == "editing" and got["floor_off"] == "menu" and got["many_floors"] == "more"
        # bad values: 422, the stored value stays
        for bad in ({"tree_unassigned": "hide"}, {"tree_unassigned": None}, {"tree_unasigned": "never"}):
            assert c.patch(f"{API}/settings", json={"home.screen": bad}).status_code == 422, bad
        assert c.get(f"{API}/settings").json()["settings"]["home.screen"]["tree_unassigned"] == "editing"
        # hiding never changes data: the devices tree still carries the bucket and the same building counts
        after = c.get(f"{API}/devices/tree")
        assert before.status_code == after.status_code
        if after.status_code == 200:
            b, a = before.json(), after.json()
            assert a["unassigned"] == b["unassigned"] and a["building"] == b["building"]
        # audited like every settings change
        with app.state.db.connection() as conn:
            rows = [json.loads(x[0] or "{}") for x in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed' ORDER BY rowid").fetchall()]
        assert any("tree_unassigned" in json.dumps(x) or "home.screen" in json.dumps(x) for x in rows)
        # a viewer reads it but may not change it (system.configure)
        bind(c, settings, "dana", "viewer", "installation", "*")
        seen = c.get(f"{API}/settings", headers=as_user("dana"))
        assert seen.status_code == 200 and seen.json()["settings"]["home.screen"]["tree_unassigned"] == "editing"
        assert seen.json().get("can_edit") is not True
        r = c.patch(f"{API}/settings", json={"home.screen": {"tree_unassigned": "always"}}, headers=as_user("dana"))
        assert r.status_code == 403
        assert c.get(f"{API}/settings").json()["settings"]["home.screen"]["tree_unassigned"] == "editing"
        # the administrator brings it back ("undo")
        assert c.patch(f"{API}/settings", json={"home.screen": {"tree_unassigned": "always"}}).status_code == 200
        assert c.get(f"{API}/settings").json()["settings"]["home.screen"]["tree_unassigned"] == "always"
