"""NOTICEDEL-295: real deletion of a notice (DELETE /notices/{id}, `notices.delete`) and the setting `notices.show_places_tree`. Fakes only."""
from __future__ import annotations

import datetime as dt
import json

import pytest

from conftest import as_user, bind
from smplwise.db import Database
from smplwise.services.notices import model, store

API = "/api/v1"


def _on(client) -> None:
    assert client.patch(f"{API}/notices/settings", json={"enabled": True}).status_code == 200


def _iso(delta_h: float = 0.0) -> str:
    return model.iso(dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=delta_h))


def _notice(client, **kw) -> dict:
    body = {"title": "הפסקת מים מחר", "body": "עקב עבודות.", "severity": "info", "publish": True, **kw}
    if body["severity"] == "critical" and "ends_at" not in body:
        body["ends_at"] = _iso(3)
    r = client.post(f"{API}/notices", json=body)
    assert r.status_code == 200, r.text
    return r.json()["notice"]


def _board(client, slug: str = "lobby") -> tuple[dict, str]:
    r = client.post(f"{API}/notices/boards", json={"name": "לוח הלובי", "slug": slug})
    assert r.status_code == 200, r.text
    return r.json()["board"], r.json()["token"]


def _feed(client, slug: str, token: str):
    return client.get(f"{API}/notices/display/{slug}", headers={"X-Board-Token": token})


def _rows(settings, sql: str, *args):
    with Database(settings.db_path).connection() as conn:
        return [dict(r) for r in conn.execute(sql, args).fetchall()]


# ---------------------------------------------------------------- the cascade, the feed and the board version

def test_delete_removes_the_notice_and_every_dependent_row(client, settings):
    _on(client)
    b, token = _board(client)
    n = _notice(client, boards=[b["id"]], audience={"everyone": True})
    assert client.post(f"{API}/notices/{n['id']}/read").status_code == 200
    assert client.patch(f"{API}/notices/boards/{b['id']}", json={"display": {"hold": n["id"]}}).status_code == 200
    assert _rows(settings, "SELECT 1 FROM notice_reads WHERE notice_id = ?", n["id"])
    r = client.delete(f"{API}/notices/{n['id']}?confirm_live=true")
    assert r.status_code == 200 and r.json() == {"deleted": True}
    assert _rows(settings, "SELECT 1 FROM notices WHERE id = ?", n["id"]) == []
    assert _rows(settings, "SELECT 1 FROM notice_board_items WHERE notice_id = ?", n["id"]) == []
    assert _rows(settings, "SELECT 1 FROM notice_reads WHERE notice_id = ?", n["id"]) == []
    assert client.get(f"{API}/notices/{n['id']}").status_code == 404
    assert [x["id"] for x in client.get(f"{API}/notices?scope=all").json()["notices"]] == []
    # the hold on it ended with it, the board itself stays
    assert _feed(client, "lobby", token).json()["board"]["display"]["hold"] == ""
    assert client.get(f"{API}/notices/boards/{b['id']}").status_code == 200


def test_the_board_feed_stops_showing_it_and_its_version_moves(client):
    _on(client)
    b, token = _board(client)
    keep = _notice(client, title="נשארת", boards=[b["id"]], audience={"everyone": True})
    gone = _notice(client, title="נמחקת", boards=[b["id"]], audience={"everyone": True})
    before = _feed(client, "lobby", token).json()
    assert "נמחקת" in json.dumps(before, ensure_ascii=False)
    assert client.delete(f"{API}/notices/{gone['id']}?confirm_live=true").status_code == 200
    after = _feed(client, "lobby", token).json()
    text = json.dumps(after, ensure_ascii=False)
    assert "נמחקת" not in text and "נשארת" in text
    assert after["board"]["version"] != before["board"]["version"]
    assert keep["id"] != gone["id"]


def test_the_boards_updated_at_is_bumped(client, settings):
    _on(client)
    b, _ = _board(client)
    n = _notice(client, boards=[b["id"]])
    with Database(settings.db_path).connection() as conn:
        conn.execute("UPDATE notice_boards SET updated_at = '2000-01-01T00:00:00Z' WHERE id = ?", (b["id"],))
    assert client.delete(f"{API}/notices/{n['id']}?confirm_live=true").status_code == 200
    assert _rows(settings, "SELECT updated_at FROM notice_boards WHERE id = ?", b["id"])[0]["updated_at"] > "2020"


def test_an_archived_notice_and_a_draft_delete_without_the_live_step(client):
    _on(client)
    n = _notice(client)
    client.post(f"{API}/notices/{n['id']}/archive")
    assert client.delete(f"{API}/notices/{n['id']}").json() == {"deleted": True}
    d = client.post(f"{API}/notices", json={"title": "טיוטה"}).json()["notice"]
    assert client.delete(f"{API}/notices/{d['id']}").json() == {"deleted": True}
    assert client.delete(f"{API}/notices/{d['id']}").status_code == 404


def test_the_push_notification_of_a_deleted_notice_is_resolved(client, settings):
    _on(client)
    tree = __import__("conftest").seed_tree(client)
    bind(client, settings, "dana", "viewer", "floor", tree["floor2"])
    n = _notice(client, audience={"floors": [tree["floor2"]]}, push=True)
    rows = _rows(settings, "SELECT state FROM notifications WHERE source = 'notice.published' AND subject_id = ?", n["id"])
    assert len(rows) == 1 and rows[0]["state"] != "resolved"
    assert client.delete(f"{API}/notices/{n['id']}?confirm_live=true").status_code == 200
    rows = _rows(settings, "SELECT state FROM notifications WHERE source = 'notice.published' AND subject_id = ?", n["id"])
    assert len(rows) == 1 and rows[0]["state"] == "resolved"


# ---------------------------------------------------------------- the live step and the emergency rule

def test_a_live_notice_needs_the_extra_confirmation(client, settings):
    _on(client)
    n = _notice(client)  # active now
    r = client.delete(f"{API}/notices/{n['id']}")
    assert r.status_code == 409 and r.json()["code"] == "confirm_live_required"
    assert client.get(f"{API}/notices/{n['id']}").status_code == 200  # nothing was deleted
    assert _rows(settings, "SELECT 1 FROM audit_log WHERE action = 'notices.delete'") == []
    assert client.delete(f"{API}/notices/{n['id']}?confirm_live=true").status_code == 200


def test_a_scheduled_notice_needs_no_live_step(client):
    _on(client)
    n = _notice(client, starts_at=_iso(5), ends_at=_iso(9))
    assert n["state"] == "scheduled"
    assert client.delete(f"{API}/notices/{n['id']}").status_code == 200


def test_an_urgent_notice_on_air_is_refused_without_the_emergency_right(client, settings):
    _on(client)
    bind(client, settings, "edna", "notices_delete", "installation", "*")
    n = _notice(client, severity="critical", audience={"everyone": True})
    assert n["state"] == "active"
    r = client.delete(f"{API}/notices/{n['id']}?confirm_live=true", headers=as_user("edna"))
    assert r.status_code == 403 and r.json()["code"] == "emergency_notice"
    assert client.get(f"{API}/notices/{n['id']}").status_code == 200
    denied = _rows(settings, "SELECT decision, reason FROM audit_log WHERE action = 'notices.delete' AND decision = 'denied'")
    assert denied and denied[0]["reason"] == "emergency_notice"
    # a holder of the emergency right (the administrator) deletes it, still with the extra step
    assert client.delete(f"{API}/notices/{n['id']}").status_code == 409
    assert client.delete(f"{API}/notices/{n['id']}?confirm_live=true").status_code == 200


def test_an_urgent_notice_that_is_not_on_air_does_not_need_the_emergency_right(client, settings):
    _on(client)
    bind(client, settings, "edna", "notices_delete", "installation", "*")
    n = _notice(client, severity="critical", audience={"everyone": True})
    client.post(f"{API}/notices/{n['id']}/archive")
    assert client.delete(f"{API}/notices/{n['id']}", headers=as_user("edna")).status_code == 200


# ---------------------------------------------------------------- the permission

def test_deleting_a_published_notice_needs_notices_delete(client, settings):
    _on(client)
    bind(client, settings, "edna", "notices_manage", "installation", "*")
    n = _notice(client, audience={"everyone": True})
    client.post(f"{API}/notices/{n['id']}/archive")
    r = client.delete(f"{API}/notices/{n['id']}", headers=as_user("edna"))
    assert r.status_code == 403 and r.json()["details"]["permission"] == "notices.delete"
    assert client.get(f"{API}/notices/{n['id']}").status_code == 200
    # the writer still deletes a draft of his own
    d = client.post(f"{API}/notices", json={"title": "טיוטה"}, headers=as_user("edna")).json()["notice"]
    assert client.delete(f"{API}/notices/{d['id']}", headers=as_user("edna")).status_code == 200
    # with the grant he deletes the archived one
    bind(client, settings, "edna", "notices_delete", "installation", "*")
    assert client.delete(f"{API}/notices/{n['id']}", headers=as_user("edna")).status_code == 200


def test_a_reader_and_a_scoped_writer_cannot_delete(client, settings):
    _on(client)
    tree = __import__("conftest").seed_tree(client)
    bind(client, settings, "dana", "viewer", "floor", tree["floor2"])
    bind(client, settings, "edna", "notices_delete", "floor", tree["floor2"])
    n = _notice(client, audience={"everyone": True})
    client.post(f"{API}/notices/{n['id']}/archive")
    assert client.delete(f"{API}/notices/{n['id']}", headers=as_user("dana")).status_code == 403
    r = client.delete(f"{API}/notices/{n['id']}", headers=as_user("edna"))  # an "everyone" notice is outside a floor scope
    assert r.status_code == 403
    assert client.get(f"{API}/notices/{n['id']}").status_code == 200


def test_the_permission_is_catalogued_and_held_by_the_two_admin_roles():
    from smplwise.rbac import ROLES
    from smplwise.routers.access import DEFAULT_DELEGABLE, PERMISSION_LABELS

    assert "notices.delete" in PERMISSION_LABELS
    assert "notices.delete" in ROLES["site_admin"] and "notices.delete" in ROLES["system_admin"]
    for role in ("viewer", "kiosk", "operator", "editor"):
        assert "notices.delete" not in ROLES[role], role
    assert ROLES["notices_delete"] == ["notices.view", "notices.manage", "notices.delete"]
    assert "notices_delete" not in DEFAULT_DELEGABLE


def test_the_module_answer_says_who_may_delete(client, settings):
    _on(client)
    bind(client, settings, "edna", "notices_manage", "installation", "*")
    assert client.get(f"{API}/notices/module").json()["can"]["delete"] is True
    assert client.get(f"{API}/notices/module", headers=as_user("edna")).json()["can"]["delete"] is False


# ---------------------------------------------------------------- the audit row

def test_one_content_free_audit_row_per_deletion(client, settings):
    _on(client)
    n = _notice(client, title="סודי-כותרת", body="סודי-גוף", audience={"everyone": True})
    client.post(f"{API}/notices/{n['id']}/archive")
    assert client.delete(f"{API}/notices/{n['id']}").status_code == 200
    rows = _rows(settings, "SELECT * FROM audit_log WHERE action = 'notices.delete'")
    assert len(rows) == 1
    row = rows[0]
    assert row["decision"] == "allowed" and row["resource_type"] == "notice" and row["resource_id"] == n["id"] and row["at"] and row["actor_user_id"]
    blob = json.dumps(row, ensure_ascii=False, default=str)
    assert "סודי" not in blob
    assert json.loads(row["details_json"]) == {"status": "archived", "state": "archived"}


# ---------------------------------------------------------------- the places-tree setting

def test_show_places_tree_defaults_on_and_is_validated(client, settings):
    _on(client)
    assert client.get(f"{API}/notices/settings").json()["settings"]["show_places_tree"] is True
    assert client.get(f"{API}/notices?scope=all").json()["defaults"]["show_places_tree"] is True
    for bad in ("maybe", 5, None):
        r = client.patch(f"{API}/notices/settings", json={"show_places_tree": bad})
        assert r.status_code == (200 if bad is None else 422), (bad, r.text)
    r = client.patch(f"{API}/notices/settings", json={"show_places_tree": False})
    assert r.status_code == 200 and r.json()["settings"]["show_places_tree"] is False
    assert client.get(f"{API}/notices?scope=all").json()["defaults"]["show_places_tree"] is False
    assert _rows(settings, "SELECT value FROM settings WHERE key = 'notices.show_places_tree'")[0]["value"] == "false"
    keys = _rows(settings, "SELECT details_json FROM audit_log WHERE action = 'notices.settings.update'")
    assert any("notices.show_places_tree" in k["details_json"] for k in keys)


def test_show_places_tree_needs_system_configure(client, settings):
    _on(client)
    bind(client, settings, "edna", "notices_manage", "installation", "*")
    assert client.patch(f"{API}/notices/settings", json={"show_places_tree": False}, headers=as_user("edna")).status_code == 403
    # a reader still receives the value with the list (the page needs it)
    assert client.get(f"{API}/notices", headers=as_user("edna")).json()["defaults"]["show_places_tree"] is True


@pytest.mark.parametrize("stored,expected", [("true", True), ("false", False), ("", True), ("garbage", True)])
def test_the_stored_string_reads_back_safely(stored, expected):
    raw = lambda k, d: stored if k == "notices.show_places_tree" else d  # noqa: E731
    assert model.settings_doc(raw)["show_places_tree"] is expected
    assert store.model is model
