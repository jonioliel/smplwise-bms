"""NOTICEPUSH-295 (CR-NOTICE106 section 7, slice 2): a published notice as a source in the notification pipeline. Fakes only: the notifier
thread is not running in these tests, rows land in `notifications` / `notification_recipients` / `notify_outbox` and nothing is sent."""
from __future__ import annotations

import datetime as dt

from conftest import as_user, bind
from smplwise.db import Database
from smplwise.services.notices import model, push, store

API = "/api/v1"


def _on(client, **extra) -> None:
    assert client.patch(f"{API}/notices/settings", json={"enabled": True, **extra}).status_code == 200


def _iso(delta_h: float = 0.0) -> str:
    return model.iso(dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=delta_h))


def _post(client, **kw):
    body = {"title": "הפסקת מים מחר", "body": "עקב עבודות.\nמומלץ למלא מים.", "severity": "info", "publish": True, **kw}
    if body["severity"] == "critical" and "ends_at" not in body:
        body["ends_at"] = _iso(3)
    return client.post(f"{API}/notices", json=body, headers=kw.pop("headers", None) if False else None)


def _rows(settings, nid: str | None = None):
    db = Database(settings.db_path)
    with db.connection() as conn:
        q = "SELECT * FROM notifications WHERE source = 'notice.published'" + (" AND subject_id = ?" if nid else "")
        rows = [dict(r) for r in conn.execute(q, (nid,) if nid else ()).fetchall()]
        for r in rows:
            r["users"] = sorted(x[0] for x in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ?", (r["id"],)).fetchall())
        return rows


def _setup(client, settings):
    _on(client)
    tree = __import__("conftest").seed_tree(client)
    bind(client, settings, "dana", "viewer", "floor", tree["floor2"])
    bind(client, settings, "omer", "viewer", "floor", tree["floor3"])
    return tree


# ---------------------------------------------------------------- the decision


def test_default_push_by_severity_always_never():
    assert [push.default_push("by_severity", s) for s in ("info", "alert", "critical")] == [False, False, True]
    assert [push.default_push("always", s) for s in ("info", "alert", "critical")] == [True, True, True]
    assert [push.default_push("never", s) for s in ("info", "alert", "critical")] == [False, False, False]


def test_an_ordinary_notice_does_not_push_unless_the_author_ticks(client, settings):
    _setup(client, settings)
    r = _post(client, audience={"everyone": True})
    assert r.status_code == 200 and r.json()["push"] == {"requested": False, "sent": False, "recipients": 0}
    assert _rows(settings) == []
    r2 = _post(client, title="עם התראה", audience={"everyone": True}, push=True)
    assert r2.json()["push"]["sent"] is True and r2.json()["push"]["recipients"] >= 3
    rows = _rows(settings, r2.json()["notice"]["id"])
    assert len(rows) == 1 and rows[0]["title"] == "עם התראה" and rows[0]["category"] == "building" and rows[0]["state"] == "open"
    assert {"dev-dana", "dev-omer"} <= set(rows[0]["users"])
    assert r2.json()["notice"]["pushed_at"] and r2.json()["notice"]["push_requested"] is True


def test_a_critical_notice_pushes_by_default_and_the_author_may_untick(client, settings):
    _setup(client, settings)
    r = _post(client, title="דחוף", severity="critical", audience={"everyone": True})
    assert r.json()["push"]["sent"] is True
    rows = _rows(settings, r.json()["notice"]["id"])
    assert len(rows) == 1 and rows[0]["severity"] == "critical"
    quiet = _post(client, title="דחוף בשקט", severity="critical", audience={"everyone": True}, push=False)
    assert quiet.json()["push"]["requested"] is False and _rows(settings, quiet.json()["notice"]["id"]) == []


def test_the_defaults_card_always_and_never(client, settings):
    _setup(client, settings)
    _on(client, push_default="always")
    a = _post(client, title="תמיד", audience={"everyone": True})
    assert a.json()["push"]["sent"] is True
    _on(client, push_default="never")
    n = _post(client, title="אף פעם", severity="critical", audience={"everyone": True})
    assert n.json()["push"]["requested"] is False
    ticked = _post(client, title="סומן", severity="critical", audience={"everyone": True}, push=True)
    assert ticked.json()["push"]["sent"] is True, "the author's tick wins over the default"


# ---------------------------------------------------------------- recipients and visibility


def test_recipients_are_the_audience_only(client, settings):
    tree = _setup(client, settings)
    r = _post(client, title="קומה 2", audience={"floors": [tree["floor2"]]}, push=True)
    rows = _rows(settings, r.json()["notice"]["id"])
    assert len(rows) == 1 and "dev-dana" in rows[0]["users"] and "dev-omer" not in rows[0]["users"]


def test_a_tv_only_notice_pushes_nobody(client, settings):
    _setup(client, settings)
    r = _post(client, title="לוחות בלבד", audience={}, push=True)
    assert r.json()["push"] == {"requested": True, "sent": False, "recipients": 0}
    assert _rows(settings) == []


def test_a_notice_notification_is_visible_to_its_audience_and_managers_only(client, settings):
    tree = _setup(client, settings)
    bind(client, settings, "gil", "viewer", "floor", tree["floor3"])
    nid = _post(client, audience={"floors": [tree["floor2"]]}, push=True).json()["notice"]["id"]
    from smplwise.services.notify_visibility import Reach, principal_of

    db = Database(settings.db_path)
    with db.connection() as conn:
        n = {"subject_kind": "notice", "subject_id": nid, "origin": {}, "source": "notice.published"}
        seen = {u: Reach(conn, principal_of(conn, u)).can_see(n) for u in ("dev-dana", "dev-omer", "dev-joni")}
    assert seen == {"dev-dana": True, "dev-omer": False, "dev-joni": True}


def test_the_module_off_lists_no_notice_source(client, settings):
    from smplwise.services import notify_policy

    db = Database(settings.db_path)
    with db.connection() as conn:
        assert "notice.published" not in [p["source"] for p in notify_policy.list_policies(conn)]
    _on(client)
    with db.connection() as conn:
        listed = {p["source"]: p for p in notify_policy.list_policies(conn)}
    assert listed["notice.published"]["category"] == "building" and listed["notice.published"]["recipients"]["rule"] == "notice"
    assert listed["notice.published"]["channels"]["app"] is True and listed["notice.published"]["channels"]["email"] is False


# ---------------------------------------------------------------- permission


def test_an_explicit_tick_needs_notices_push(client, settings):
    _setup(client, settings)
    bind(client, settings, "edi", "notices_manage", "installation", "*")
    h = as_user("edi")
    r = client.post(f"{API}/notices", json={"title": "x", "audience": {"everyone": True}, "publish": True, "push": True}, headers=h)
    assert r.status_code == 403 and r.json()["details"]["permission"] == "notices.push"
    assert client.get(f"{API}/notices?scope=all").json()["notices"] == [], "nothing was created"
    draft = client.post(f"{API}/notices", json={"title": "טיוטה", "audience": {"everyone": True}}, headers=h).json()["notice"]
    denied = client.post(f"{API}/notices/{draft['id']}/publish", json={"push": True}, headers=h)
    assert denied.status_code == 403
    assert client.get(f"{API}/notices/{draft['id']}", headers=h).json()["notice"]["state"] == "draft"
    ok = client.post(f"{API}/notices/{draft['id']}/publish", headers=h)  # no tick: the default (ordinary notice: nothing)
    assert ok.status_code == 200 and ok.json()["push"]["requested"] is False
    db = Database(settings.db_path)
    with db.connection() as conn:
        assert conn.execute("SELECT 1 FROM audit_log WHERE action = 'notices.push' AND decision = 'denied'").fetchone() is not None


def test_a_draft_remembers_the_tick(client, settings):
    _setup(client, settings)
    d = client.post(f"{API}/notices", json={"title": "טיוטה", "audience": {"everyone": True}, "push": True}).json()["notice"]
    assert d["push_requested"] is True
    r = client.post(f"{API}/notices/{d['id']}/publish")
    assert r.json()["push"]["sent"] is True and len(_rows(settings, d["id"])) == 1
    d2 = client.post(f"{API}/notices", json={"title": "ללא", "audience": {"everyone": True}}).json()["notice"]
    assert client.patch(f"{API}/notices/{d2['id']}", json={"push": True}).json()["notice"]["push_requested"] is True
    assert client.patch(f"{API}/notices/{d2['id']}", json={"push": False}).json()["notice"]["push_requested"] is False


# ---------------------------------------------------------------- once, and resolve


def test_sent_once_editing_never_pushes_again(client, settings):
    _setup(client, settings)
    n = _post(client, audience={"everyone": True}, push=True).json()["notice"]
    assert client.patch(f"{API}/notices/{n['id']}", json={"title": "עודכן", "push": True}).status_code == 200
    assert client.post(f"{API}/notices/{n['id']}/publish").status_code == 409  # only a draft publishes
    assert len(_rows(settings, n["id"])) == 1


def test_archive_resolves_the_notification(client, settings):
    _setup(client, settings)
    n = _post(client, audience={"everyone": True}, push=True).json()["notice"]
    assert client.post(f"{API}/notices/{n['id']}/archive").status_code == 200
    rows = _rows(settings, n["id"])
    assert len(rows) == 1 and rows[0]["state"] == "resolved"


def test_an_ended_notice_is_resolved_by_the_janitor(client, settings):
    _setup(client, settings)
    n = _post(client, audience={"everyone": True}, push=True, starts_at=_iso(-2), ends_at=_iso(1)).json()["notice"]
    db = Database(settings.db_path)
    with db.connection() as conn:
        assert push.resolve_ended(conn) == 0, "still active"
        conn.execute("UPDATE notices SET ends_at = ? WHERE id = ?", (_iso(-0.5), n["id"]))
        assert push.resolve_ended(conn) == 1
    assert _rows(settings, n["id"])[0]["state"] == "resolved"


def test_a_failing_pipeline_never_blocks_the_publish(client, settings, monkeypatch):
    _setup(client, settings)
    from smplwise.services import notify

    def boom(*a, **k):
        raise RuntimeError("notifier down")

    monkeypatch.setattr(notify, "emit_full", boom)
    r = _post(client, audience={"everyone": True}, push=True)
    assert r.status_code == 200 and r.json()["notice"]["state"] == "active" and r.json()["push"]["error"] == "emit_failed"


def test_the_push_text_is_the_title_and_the_first_160_characters(client, settings):
    _setup(client, settings)
    long_body = "א" * 400
    n = _post(client, title="כותרת", body=long_body[:300], audience={"everyone": True}, push=True).json()["notice"]
    row = _rows(settings, n["id"])[0]
    assert row["title"] == "כותרת" and row["body"].startswith("א") and len(row["body"]) <= 180
