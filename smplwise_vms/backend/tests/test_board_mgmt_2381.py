"""BOARD-MGMT-2381 (owner answers 03.11, questions 5-7): the board's "copy link" never replaces the link (a separate, audited "replace
link"), a manual "שלח שוב" for a published notice (never automatic after an edit) and the editor role managing notices by default.
Fakes only: no lab, no network; the notifier thread is not running, rows land in `notifications`."""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

from conftest import as_user, bind, seed_tree
from smplwise.db import Database
from smplwise.services.notices import model, push

API = "/api/v1"
ROOT = Path(__file__).resolve().parents[3]


def _on(client) -> None:
    assert client.patch(f"{API}/notices/settings", json={"enabled": True}).status_code == 200


def _iso(delta_h: float = 0.0) -> str:
    return model.iso(dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=delta_h))


def _audit(settings, action: str) -> list[dict]:
    with Database(settings.db_path).connection() as c:
        return [dict(r) for r in c.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()]


# ---------------------------------------------------------------- question 5: copy never replaces; replace is separate and audited


def test_copying_the_link_changes_nothing_and_the_paired_tv_keeps_working(client, settings):
    _on(client)
    made = client.post(f"{API}/notices/boards", json={"name": "לובי", "slug": "lobby"}).json()
    bid, token = made["board"]["id"], made["token"]
    with Database(settings.db_path).connection() as c:
        before = dict(c.execute("SELECT token_hash, token_generation, token_rotated_at, token_sealed FROM notice_boards WHERE id = ?", (bid,)).fetchone())
    for _ in range(3):
        r = client.get(f"{API}/notices/boards/{bid}/link")
        assert r.status_code == 200 and r.json()["token"] == token
    with Database(settings.db_path).connection() as c:
        after = dict(c.execute("SELECT token_hash, token_generation, token_rotated_at, token_sealed FROM notice_boards WHERE id = ?", (bid,)).fetchone())
    assert after == before, "a copy never rotates, re-seals or re-stamps the link"
    assert client.get(f"{API}/notices/display/lobby", headers={"X-Board-Token": token}).status_code == 200
    reads = _audit(settings, "notices.board.link_read")
    assert len(reads) == 3 and all(token not in json.dumps(r) for r in reads), "audited, without the link"
    assert _audit(settings, "notices.board.rotate") == []


def test_replacing_the_link_disconnects_the_old_one_and_is_audited(client, settings):
    _on(client)
    made = client.post(f"{API}/notices/boards", json={"name": "לובי", "slug": "lobby"}).json()
    bid, old = made["board"]["id"], made["token"]
    r = client.post(f"{API}/notices/boards/{bid}/rotate-token")
    assert r.status_code == 200
    new = r.json()["token"]
    assert new != old and r.json()["board"]["token_rotated_at"]
    assert client.get(f"{API}/notices/display/lobby", headers={"X-Board-Token": old}).status_code == 404
    assert client.get(f"{API}/notices/display/lobby", headers={"X-Board-Token": new}).status_code == 200
    assert client.get(f"{API}/notices/boards/{bid}/link").json()["token"] == new, "the copy now gives the replaced link"
    rows = _audit(settings, "notices.board.rotate")
    assert len(rows) == 1 and rows[0]["resource_id"] == bid and rows[0]["decision"] == "allowed" and new not in json.dumps(rows[0])


def test_copy_and_replace_keep_their_permission(client, settings):
    _on(client)
    bid = client.post(f"{API}/notices/boards", json={"name": "לובי", "slug": "lobby"}).json()["board"]["id"]
    bind(client, settings, "edna", "editor", "installation", "*")  # notices.manage by default now, but never the boards right
    H = as_user("edna")
    assert client.get(f"{API}/notices/boards/{bid}/link", headers=H).status_code == 403
    assert client.post(f"{API}/notices/boards/{bid}/rotate-token", headers=H).status_code == 403
    bind(client, settings, "bo", "notices_boards", "installation", "*")
    assert client.get(f"{API}/notices/boards/{bid}/link", headers=as_user("bo")).status_code == 200


# ---------------------------------------------------------------- question 6: the manual "שלח שוב"


def _setup(client, settings) -> dict:
    _on(client)
    tree = seed_tree(client)
    bind(client, settings, "dana", "viewer", "floor", tree["floor2"])
    return tree


def _publish(client, **kw) -> dict:
    body = {"title": "הפסקת מים מחר", "body": "עקב עבודות.", "severity": "info", "publish": True, "audience": {"everyone": True}, **kw}
    r = client.post(f"{API}/notices", json=body, headers=kw.pop("headers", None) if False else None)
    assert r.status_code == 200, r.text
    return r.json()["notice"]


def _rows(settings, nid: str) -> list[dict]:
    with Database(settings.db_path).connection() as c:
        return [dict(r) for r in c.execute("SELECT * FROM notifications WHERE source = 'notice.published' AND subject_id = ? ORDER BY first_at, rowid", (nid,)).fetchall()]


def _age_last_send(settings, nid: str, seconds: int = 120) -> None:
    with Database(settings.db_path).connection() as c:
        c.execute("UPDATE notifications SET first_at = ? WHERE subject_id = ?", (model.iso(dt.datetime.now(dt.timezone.utc) - dt.timedelta(seconds=seconds)), nid))


def test_an_edit_never_resends_by_itself(client, settings):
    _setup(client, settings)
    n = _publish(client, push=True)
    assert client.patch(f"{API}/notices/{n['id']}", json={"title": "עודכן", "push": True}).status_code == 200
    assert len(_rows(settings, n["id"])) == 1 and _audit(settings, "notices.resend") == []


def test_resend_after_an_edit_sends_the_edited_notice_once_more(client, settings):
    _setup(client, settings)
    n = _publish(client, push=True)
    assert client.patch(f"{API}/notices/{n['id']}", json={"title": "הפסקת מים - שעה עודכנה"}).status_code == 200
    _age_last_send(settings, n["id"])
    r = client.post(f"{API}/notices/{n['id']}/resend")
    assert r.status_code == 200, r.text
    res = r.json()["push"]
    assert res["sent"] is True and res["recipients"] >= 2 and res["generation"] == 1
    assert r.json()["notice"]["push_generation"] == 1
    rows = _rows(settings, n["id"])
    assert len(rows) == 2
    old, new = rows
    assert old["state"] == "resolved" and old["dedupe_key"] == push.key_of(n["id"], 0)
    assert new["state"] == "open" and new["dedupe_key"] == push.key_of(n["id"], 1) and new["title"] == "הפסקת מים - שעה עודכנה"
    audit = _audit(settings, "notices.resend")
    assert len(audit) == 1 and audit[0]["decision"] == "allowed" and audit[0]["resource_id"] == n["id"]
    details = json.loads(audit[0]["details_json"])
    assert details["generation"] == 1 and details["sent"] is True and details["recipients"] == res["recipients"]
    assert "עודכנה" not in json.dumps(audit[0], ensure_ascii=False), "the audit row carries no content"


def test_resend_of_a_notice_that_never_pushed(client, settings):
    _setup(client, settings)
    n = _publish(client)  # an ordinary notice: the default sent nothing
    assert _rows(settings, n["id"]) == []
    r = client.post(f"{API}/notices/{n['id']}/resend")
    assert r.status_code == 200 and r.json()["push"]["sent"] is True
    assert [x["state"] for x in _rows(settings, n["id"])] == ["open"]
    assert r.json()["notice"]["pushed_at"]


def test_resend_is_limited_to_once_a_minute(client, settings):
    _setup(client, settings)
    n = _publish(client, push=True)
    r = client.post(f"{API}/notices/{n['id']}/resend")
    assert r.status_code == 429 and r.json()["code"] == "resend_too_soon" and 0 < r.json()["details"]["retry_after_s"] <= 60
    _age_last_send(settings, n["id"])
    assert client.post(f"{API}/notices/{n['id']}/resend").status_code == 200
    assert client.post(f"{API}/notices/{n['id']}/resend").status_code == 429, "counted from the new send"


def test_resend_only_for_a_live_published_notice(client, settings):
    _setup(client, settings)
    draft = client.post(f"{API}/notices", json={"title": "טיוטה", "audience": {"everyone": True}}).json()["notice"]
    assert client.post(f"{API}/notices/{draft['id']}/resend").json()["code"] == "not_live"
    ended = _publish(client, starts_at=_iso(-3), ends_at=_iso(-1))
    assert client.post(f"{API}/notices/{ended['id']}/resend").json()["code"] == "not_live"
    gone = _publish(client)
    assert client.post(f"{API}/notices/{gone['id']}/archive").status_code == 200
    r = client.post(f"{API}/notices/{gone['id']}/resend")
    assert r.status_code == 409 and r.json()["code"] == "not_live"
    later = _publish(client, starts_at=_iso(2), ends_at=_iso(5))
    assert client.post(f"{API}/notices/{later['id']}/resend").status_code == 200, "a scheduled notice may be sent again"


def test_resend_of_a_tv_only_notice_is_refused_and_writes_nothing(client, settings):
    _setup(client, settings)
    n = _publish(client, audience={})
    r = client.post(f"{API}/notices/{n['id']}/resend")
    assert r.status_code == 409 and r.json()["code"] == "no_recipients"
    assert _rows(settings, n["id"]) == [] and _audit(settings, "notices.resend") == []
    assert client.get(f"{API}/notices/{n['id']}").json()["notice"]["push_generation"] == 0


def test_a_failing_pipeline_changes_nothing(client, settings, monkeypatch):
    _setup(client, settings)
    n = _publish(client, push=True)
    _age_last_send(settings, n["id"])
    from smplwise.services import notify

    def boom(*a, **k):
        raise RuntimeError("pipeline down")

    monkeypatch.setattr(notify, "emit_full", boom)
    r = client.post(f"{API}/notices/{n['id']}/resend")
    assert r.status_code == 200 and r.json()["push"]["sent"] is False and r.json()["push"]["error"] == "emit_failed"
    assert r.json()["notice"]["push_generation"] == 0
    assert [x["state"] for x in _rows(settings, n["id"])] == ["open"], "the previous notification stays open"
    assert _audit(settings, "notices.resend")[0]["decision"] == "denied"


def test_resend_needs_manage_on_the_audience_and_the_push_right(client, settings):
    tree = _setup(client, settings)
    n = _publish(client, push=True)
    _age_last_send(settings, n["id"])
    bind(client, settings, "mo", "notices_manage", "installation", "*")
    r = client.post(f"{API}/notices/{n['id']}/resend", headers=as_user("mo"))
    assert r.status_code == 403 and r.json()["details"]["permission"] == "notices.push"
    denied = [a for a in _audit(settings, "notices.push") if a["decision"] == "denied"]
    assert denied and denied[-1]["resource_id"] == n["id"]
    assert client.post(f"{API}/notices/{n['id']}/resend", headers=as_user("dana")).status_code in (403, 404), "a reader never re-sends"
    # a floor-scoped manager with the push right: his floor's notice yes, an everyone notice no
    bind(client, settings, "fl", "notices_manage", "floor", tree["floor2"])
    bind(client, settings, "fl", "notices_push", "installation", "*")
    assert client.post(f"{API}/notices/{n['id']}/resend", headers=as_user("fl")).status_code in (403, 404)
    mine = _publish(client, audience={"floors": [tree["floor2"]]}, push=True)
    _age_last_send(settings, mine["id"])
    assert client.post(f"{API}/notices/{mine['id']}/resend", headers=as_user("fl")).status_code == 200
    assert len(_rows(settings, n["id"])) == 1, "the refused re-sends sent nothing"


def test_archive_after_resend_resolves_the_current_copy(client, settings):
    _setup(client, settings)
    n = _publish(client, push=True)
    _age_last_send(settings, n["id"])
    assert client.post(f"{API}/notices/{n['id']}/resend").status_code == 200
    assert client.post(f"{API}/notices/{n['id']}/archive").status_code == 200
    assert {x["state"] for x in _rows(settings, n["id"])} == {"resolved"}


# ---------------------------------------------------------------- question 7: the editor role manages notices by default


def test_the_editor_role_carries_notice_management_only():
    from smplwise.rbac import ROLES

    assert {"notices.view", "notices.manage"} <= set(ROLES["editor"])
    for p in ("notices.push", "notices.delete", "notices.boards"):
        assert p not in ROLES["editor"], p
    contract = json.loads((ROOT / "contracts" / "examples" / "role-catalog.design.json").read_text(encoding="utf-8"))
    editor = next(r for r in contract["roles"] if r["id"] == "editor")
    assert {"notices.view", "notices.manage"} <= set(editor["permissions"]) and "notices.push" not in editor["permissions"]
    for role in ("viewer", "kiosk", "operator"):
        assert not any(p.startswith("notices.") for p in ROLES[role]), role


def test_an_existing_editor_binding_gets_notice_management_with_no_migration(client, settings):
    """Built-in roles live in code (roles.json) and are not editable in an installation, so every existing editor binding holds the new
    default at once; nothing in the database changes."""
    tree = _setup(client, settings)
    bind(client, settings, "edna", "editor", "installation", "*")
    H = as_user("edna")
    module = client.get(f"{API}/notices/module", headers=H).json()
    assert module["can"]["manage"] is True and module["can"]["push"] is False and module["can"]["boards"] is False
    r = client.post(f"{API}/notices", json={"title": "מעלית בתחזוקה", "audience": {"everyone": True}, "publish": True}, headers=H)
    assert r.status_code == 200, r.text
    nid = r.json()["notice"]["id"]
    assert client.patch(f"{API}/notices/{nid}", json={"title": "מעלית בתחזוקה עד 12:00"}, headers=H).status_code == 200
    assert client.post(f"{API}/notices/{nid}/resend", headers=H).status_code == 403, "push stays a separate grant"
    # a floor-scoped editor writes his floor only
    bind(client, settings, "efi", "editor", "floor", tree["floor2"])
    E = as_user("efi")
    assert client.post(f"{API}/notices", json={"title": "קומה 2", "audience": {"floors": [tree["floor2"]]}}, headers=E).status_code == 200
    out = client.post(f"{API}/notices", json={"title": "כולם", "audience": {"everyone": True}}, headers=E)
    assert out.status_code == 403 and out.json()["code"] == "audience_out_of_scope"


def test_a_deny_of_notice_management_still_wins_over_the_editor_default(client, settings):
    """An administrator's explicit deny of notices_manage on a user keeps that user out, editor or not."""
    _setup(client, settings)
    bind(client, settings, "edna", "editor", "installation", "*")
    from smplwise.db import new_id, now_iso, permission_revision

    with Database(settings.db_path).connection() as c:
        c.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at)"
                  " VALUES (?, 'user', 'dev-edna', 'notices_manage', 'installation', '*', 'deny', ?, 'test', ?)", (new_id(), permission_revision(c), now_iso()))
    r = client.post(f"{API}/notices", json={"title": "x", "audience": {"everyone": True}}, headers=as_user("edna"))
    assert r.status_code == 403


def test_the_new_default_does_not_raise_the_site_admin_delegation_ceiling():
    """A delegated administrator hands out a role only with every permission of it in his own scope. The two new editor permissions are
    held by site_admin already, so a delegated site administrator who may hand out editor (when the owner put it on the allow-list)
    still can; a delegate whose own role lacks notice management can no longer hand out editor (reported in the change doc)."""
    from smplwise.rbac import ROLES

    assert {"notices.view", "notices.manage"} <= set(ROLES["site_admin"])
