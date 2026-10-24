"""GENELEV-295: the elevator alert recipients settings (the screen and the routes already exist - CR-INFRA-ELEVATORS 9.4) gain WhatsApp as an
optional per-state channel. The rules under test: everything is off / empty by default, only system.configure edits, adding WhatsApp (or changing who
it reaches) also needs notify.manage, the choice is mirrored onto the CR-018 policy, and the audit row names ids / counts / channels only."""
from __future__ import annotations

import json

from conftest import as_user, bind
from test_infra_elevators_280 import ALERTS, enable, owner  # noqa: F401 - `owner` is the shared fixture
from test_infra_elevators import app  # noqa: F401 - the fixture `owner` builds on

from smplwise.routers import elevators as router
from smplwise.services import elevator_alerts as ea


def _cur(**over):
    base = ea.default_settings()
    base.update(over)
    return base


# ---------------------------------------------------------------- defaults

def test_defaults_are_off_nobody_and_no_channel(owner):
    c, _, _, _ = owner
    got = c.get(ALERTS).json()
    assert got["enabled"] is False
    for s in got["states"].values():
        assert s == {"enabled": False, "recipients": {"roles": [], "users": [], "groups": []}, "channels": []}
    assert got["channels"] == ["push", "app", "whatsapp"] and "email" not in got["channels"]
    assert got["can_edit"] is True and got["can_whatsapp"] is True and got["row_version"] == 0


def test_a_reader_without_system_configure_cannot_edit_or_use_whatsapp(owner):
    c, _, settings, _ = owner
    bind(c, settings, "adm", "site_admin", "installation", "*")
    a = as_user("adm")
    got = c.get(ALERTS, headers=a).json()
    assert got["can_edit"] is False and got["can_whatsapp"] is False
    assert c.put(ALERTS, json={"states": {"fault": {"channels": ["whatsapp"]}}}, headers=a).status_code == 403
    assert c.get(ALERTS).json()["states"]["fault"]["channels"] == []


def test_saving_with_the_master_off_raises_nothing(owner):
    """Recipients and channels may be prepared while the master switch is off: the policies stay disabled and nothing is notified."""
    c, db, _, _ = owner
    enable(c, master=False, channels=["whatsapp"])
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM notifications WHERE source LIKE 'elevator.%'").fetchone()[0] == 0
        pol = conn.execute("SELECT enabled FROM notify_policies WHERE source = 'elevator.fault'").fetchone()
    assert pol["enabled"] == 0


# ---------------------------------------------------------------- validation

def test_validation_whatsapp_is_a_channel_email_and_unknowns_are_not(owner):
    c, _, _, _ = owner
    for ch in (["email"], ["sms"], ["whatsapp", "announce"]):
        r = c.put(ALERTS, json={"states": {"fault": {"channels": ch}}})
        assert r.status_code == 422 and r.json()["code"] == "channel", (ch, r.text)
    v = c.put(ALERTS, json={"states": {"fault": {"channels": ["whatsapp", "push", "whatsapp"]}}}).json()
    assert v["states"]["fault"]["channels"] == ["push", "whatsapp"]  # canonical order, no duplicate


# ---------------------------------------------------------------- the mirror onto the CR-018 policy

def test_whatsapp_is_mirrored_per_state_and_never_email(owner):
    c, db, _, _ = owner
    enable(c, states=("fault", "fire_service"), channels=["push"])
    c.put(ALERTS, json={"states": {"fault": {"channels": ["push", "whatsapp"]}}})
    with db.connection(mode="read") as conn:
        ch = {r["source"]: json.loads(r["channels_json"]) for r in conn.execute("SELECT source, channels_json FROM notify_policies WHERE source LIKE 'elevator.%'").fetchall()}
    assert ch["elevator.fault"]["whatsapp"] is True and ch["elevator.fault"]["webpush"] is True
    assert ch["elevator.fire_service"]["whatsapp"] is False  # chosen per state
    assert ch["elevator.out_of_service"]["whatsapp"] is False
    assert all(v["email"] is False and v["inbox"] is True for v in ch.values())
    c.put(ALERTS, json={"states": {"fault": {"channels": ["push"]}}})  # removing it removes it from the policy too
    with db.connection(mode="read") as conn:
        assert json.loads(conn.execute("SELECT channels_json FROM notify_policies WHERE source = 'elevator.fault'").fetchone()[0])["whatsapp"] is False


# ---------------------------------------------------------------- notify.manage guards WhatsApp

def test_adding_whatsapp_or_widening_its_reach_needs_notify_manage(owner, monkeypatch):
    """Everyone who holds system.configure is a system administrator today (who also holds notify.manage), so the guard is exercised by refusing
    notify.manage for the caller; edits that do not touch WhatsApp, and removing it, stay allowed."""
    c, _, _, _ = owner
    real = router.require

    def deny(conn, principal, permission, *a, **k):
        if permission == router.NOTIFY_MANAGE:
            raise router.ApiError(403, "forbidden", "אין הרשאה.")
        return real(conn, principal, permission, *a, **k)

    assert c.put(ALERTS, json={"states": {"fault": {"channels": ["push"]}}}).status_code == 200
    monkeypatch.setattr(router, "require", deny)
    assert c.put(ALERTS, json={"states": {"fault": {"channels": ["push", "whatsapp"]}}}).status_code == 403
    assert "whatsapp" not in c.get(ALERTS).json()["states"]["fault"]["channels"]
    assert c.put(ALERTS, json={"states": {"fault": {"recipients": {"roles": ["viewer"]}}}}).status_code == 200  # not WhatsApp's reach
    monkeypatch.undo()
    assert c.put(ALERTS, json={"states": {"fault": {"channels": ["push", "whatsapp"]}}}).status_code == 200
    monkeypatch.setattr(router, "require", deny)
    assert c.put(ALERTS, json={"states": {"fault": {"recipients": {"roles": ["viewer", "operator"]}}}}).status_code == 403  # widening the reach
    assert c.put(ALERTS, json={"enabled": True}).status_code == 403  # the master switch decides whether WhatsApp is used
    assert c.put(ALERTS, json={"states": {"fault": {"channels": ["push"]}}}).status_code == 200  # removing is always allowed


def test_whatsapp_change_rule():
    wa = {"enabled": True, "recipients": {"roles": ["viewer"], "users": [], "groups": []}, "channels": ["whatsapp"]}
    plain = {**wa, "channels": ["push"]}
    cur = _cur(states={"fire_service": plain, "fault": wa, "out_of_service": plain})
    assert ea.whatsapp_change(cur, {"states": {"fault": {"channels": ["whatsapp", "push"]}}}) is False  # kept, nothing else touched
    assert ea.whatsapp_change(cur, {"states": {"fire_service": {"channels": ["whatsapp"]}}}) is True  # added
    assert ea.whatsapp_change(cur, {"states": {"fault": {"recipients": {"roles": ["viewer", "operator"]}}}}) is True
    assert ea.whatsapp_change(cur, {"states": {"fault": {"recipients": {"roles": ["viewer"]}}}}) is False  # same recipients
    assert ea.whatsapp_change(cur, {"states": {"fault": {"enabled": False}}}) is True
    assert ea.whatsapp_change(cur, {"states": {"fire_service": {"recipients": {"roles": ["operator"]}}}}) is False  # a state without WhatsApp
    assert ea.whatsapp_change(cur, {"enabled": True}) is True and ea.whatsapp_change(cur, {"enabled": False}) is False  # cur master is False
    assert ea.whatsapp_change(cur, {"states": {"fault": {"channels": []}}}) is False  # removing
    assert ea.whatsapp_change(_cur(), {"enabled": True}) is False  # no state carries WhatsApp


# ---------------------------------------------------------------- audit

def test_every_change_is_audited_with_ids_counts_and_channels_only(owner):
    c, db, _, _ = owner
    enable(c, states=("fault",), recipients={"roles": ["system_admin"]}, channels=["push", "whatsapp"])
    c.put(ALERTS, json={"enabled": False})
    with db.connection(mode="read") as conn:
        rows = [dict(r) for r in conn.execute("SELECT actor_username, decision, resource_type, details_json FROM audit_log WHERE action = 'infra.elevator.alerts.update' ORDER BY id").fetchall()]
    assert len(rows) == 2 and all(r["decision"] == "allowed" and r["actor_username"] for r in rows)
    d = json.loads(rows[0]["details_json"])
    assert d["enabled"] is True and d["states_on"] == ["fault"] and d["channels"]["fault"] == ["push", "whatsapp"]
    assert d["recipient_counts"]["fault"] == {"roles": 1, "users": 0, "groups": 0}
    assert json.loads(rows[1]["details_json"])["states_on"] == []
    assert "system_admin" not in rows[0]["details_json"]  # counts, not the chosen names


def test_a_refused_write_is_not_audited_as_a_change(owner):
    c, db, settings, _ = owner
    bind(c, settings, "ops", "operator", "installation", "*")
    assert c.put(ALERTS, json={"enabled": True}, headers=as_user("ops")).status_code == 403
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'infra.elevator.alerts.update' AND decision = 'allowed'").fetchone()[0] == 0
