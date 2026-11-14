"""WAPACE-295 (owner decisions 2026-10-24): the WhatsApp send policy - low default pacing (100 an hour, 600 a day, both editable), the recipient
allow-list of handlers and providers (enforced in the one send path, never silent, audited, stored as keyed hashes) and the self-messages
test window that ends by itself. No Home Assistant, no WhatsApp, no real number (the 555-01xx fiction range)."""
from __future__ import annotations

import datetime as dt
import json

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from messaging_registry_isolation import registry_without_lazy_modules  # noqa: F401

from smplwise.db import Database
from smplwise.main import create_app
from smplwise.services import messaging_accounts as ma
from smplwise.services import wa_policy as wp
from smplwise.services.tickets import channel_whatsapp as cw
from smplwise.services.tickets.channel import NOT_SENT, SENT, AccountRef, OutboundMessage, Recipient

API = "/api/v1"
URL = f"{API}/messaging/whatsapp/policy"
UTC = dt.timezone.utc
NOW = dt.datetime(2026, 10, 24, 9, 0, 0, tzinfo=UTC)
P1, P2 = "15555550191", "15555550192"
K1, K2 = "a" * 32, "b" * 32


# ---------------------------------------------------------------- pure

def test_default_pacing_starts_low_and_stays_editable():
    d = ma.Pacing()
    assert (d.per_hour, d.per_day) == (100, 600)
    assert ma.PACING_RANGES["per_hour"][1] >= 2000 and ma.PACING_RANGES["per_day"][1] >= 10000, "both can be raised in Settings"
    doc = ma.parse_doc({"revision": 1, "accounts": [{"key": "entry:01JX", "kind": "discovered", "pacing": {"per_hour": 250, "per_day": 900}}]})
    assert (doc.accounts[0].pacing.per_hour, doc.accounts[0].pacing.per_day) == (250, 900)


def test_default_policy_is_open_and_total():
    p = wp.parse(None)
    assert p == wp.WaPolicy() and not p.enforce and wp.guard_decision(p, K1) is None
    assert wp.parse("not json") == wp.WaPolicy() and wp.parse({"allow": "x", "enforce": "yes"}) == wp.WaPolicy()
    bad = wp.parse({"enforce": True, "allow": [{"id": "x", "key": "nothex", "label": "a"}, {"id": "abcdef12", "key": K1, "label": "L", "role": "zzz", "last4": "12"}]})
    assert bad.enforce and [e.key for e in bad.allow] == [K1] and bad.allow[0].role == "other" and bad.allow[0].last4 is None


def test_entries_validate_and_enforcement_decides():
    p, prob = wp.with_entry(wp.WaPolicy(), key=K1, digits=P1, label="  Dana   handler ", role="handler")
    assert not prob and p.allow[0].label == "Dana handler" and p.allow[0].last4 == P1[-4:]
    _, prob = wp.with_entry(p, key=K1, digits=P1, label="again", role="handler")
    assert prob == [{"code": "already_listed", "field": "phone"}]
    _, prob = wp.with_entry(p, key=K2, digits=P2, label="", role="robot")
    assert {x["code"] for x in prob} == {"label_required", "role_unknown"}
    assert wp.guard_decision(p, K2) is None, "enforcement is off by default"
    on = wp.with_enforce(p, True)
    assert wp.guard_decision(on, K1) is None and wp.guard_decision(on, K2) == "recipient_not_allowed"
    gone, prob = wp.without_entry(on, p.allow[0].id)
    assert not prob and not gone.allow and wp.without_entry(on, "nope")[1][0]["code"] == "not_found"
    assert json.dumps(wp.to_json(on)).count(P1) == 0, "the number itself is never stored"


def test_self_window_range_and_expiry():
    p, prob = wp.with_self_window(wp.WaPolicy(), 30, NOW)
    assert not prob and p.self_active(NOW + dt.timedelta(minutes=29)) and not p.self_active(NOW + dt.timedelta(minutes=30))
    for bad in (0, 241, True, "5"):
        assert wp.with_self_window(wp.WaPolicy(), bad, NOW)[1] == [{"code": "out_of_range", "field": "minutes"}]
    assert wp.with_self_window(p, None, NOW)[0].self_until is None
    v = wp.view(p, NOW, True)
    assert v["self_messages"]["active"] and v["self_messages"]["until"].startswith("2026-10-24T09:30")
    assert wp.view(p, NOW + dt.timedelta(hours=1), True)["self_messages"] == {"active": False, "until": None, "minutes_default": 30, "minutes_range": [1, 240]}


# ---------------------------------------------------------------- the channel guard

class FakeTransport:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    def call(self, domain, service, data, *, return_response, timeout):
        self.calls.append(data)
        return cw.TransportReply("response", 200, {"service_response": {"success": True, "message_id": "3EB0TEST"}})


class Accounts:
    def status(self, key):
        raise AssertionError("not used by send")


def _msg(phone: str) -> OutboundMessage:
    return OutboundMessage(outbox_id="ob1", channel="whatsapp", purpose="notify", recipient=Recipient(None, phone=phone), text="hello",
                           account=AccountRef("entry:01JX", "01JX", "x"))


@pytest.fixture(autouse=True)
def _reset_guard():
    yield
    cw.set_recipient_guard(None)


def test_channel_refuses_a_blocked_recipient_before_the_transport():
    t = FakeTransport()
    ch = cw.WhatsAppChannel(t, Accounts())
    cw.set_recipient_guard(lambda digits, oid, purpose: "recipient_not_allowed" if digits == P2 else None)
    ok, blocked = ch.send(_msg(P1)), ch.send(_msg(P2))
    assert ok.outcome == SENT and (blocked.outcome, blocked.outcome_code) == (NOT_SENT, "recipient_not_allowed")
    assert [c["target"] for c in t.calls] == [P1], "the blocked message never reached the transport"
    cw.set_recipient_guard(None)
    assert ch.send(_msg(P2)).outcome == SENT


def test_a_blocked_recipient_is_not_retried():
    from smplwise.services.tickets import outbox

    assert "recipient_not_allowed" in outbox.NON_RETRYABLE


# ---------------------------------------------------------------- routes, audit and the bound guard

@pytest.fixture()
def env(settings, registry_without_lazy_modules):
    c = TestClient(create_app(settings))
    c.get(f"{API}/me")
    bind(c, settings, "otto", "operator", "installation", "*")
    return c, settings


def _audit(settings, action):
    with Database(settings.db_path).connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,))]


def test_routes_edit_the_policy_and_audit_without_a_number(env):
    c, settings = env
    v = c.get(URL, headers=as_user("joni")).json()
    assert v["enforce"] is False and v["allow"] == [] and v["can_manage"] and v["self_messages"]["active"] is False
    r = c.post(f"{URL}/allow", json={"phone": f"+{P1}", "label": "Dana", "role": "handler"}, headers=as_user("joni"))
    assert r.status_code == 200, r.text
    entry = r.json()["allow"][0]
    assert entry["last4"] == P1[-4:] and entry["role"] == "handler" and P1 not in r.text
    assert c.post(f"{URL}/allow", json={"phone": P1, "label": "dup", "role": "provider"}, headers=as_user("joni")).status_code == 422
    assert c.post(f"{URL}/allow", json={"phone": "12", "label": "x"}, headers=as_user("joni")).status_code == 422
    assert c.put(URL, json={"enforce": True}, headers=as_user("joni")).json()["enforce"] is True
    r = c.put(f"{URL}/self-messages", json={"minutes": 45}, headers=as_user("joni")).json()
    assert r["self_messages"]["active"] and r["self_messages"]["until"]
    assert c.put(f"{URL}/self-messages", json={"minutes": 999}, headers=as_user("joni")).status_code == 422
    assert c.put(f"{URL}/self-messages", json={"minutes": None}, headers=as_user("joni")).json()["self_messages"]["active"] is False
    with Database(settings.db_path).connection(mode="read") as conn:
        stored = conn.execute("SELECT value FROM settings WHERE key = ?", (wp.SETTING_KEY,)).fetchone()[0]
        everything = json.dumps([dict(r) for r in conn.execute("SELECT * FROM audit_log")])
    assert P1 not in stored and P1 not in everything
    assert [json.loads(a["details_json"])["change"] for a in _audit(settings, "messaging.whatsapp.policy")] == ["allow_add", "enforce"]
    assert [json.loads(a["details_json"])["state"] for a in _audit(settings, "messaging.whatsapp.self_messages")] == ["on", "off"]
    assert c.delete(f"{URL}/allow/{entry['id']}", headers=as_user("joni")).json()["allow"] == []
    assert c.delete(f"{URL}/allow/{entry['id']}", headers=as_user("joni")).status_code == 404


def test_an_operator_cannot_edit_or_read(env):
    c, _ = env
    for call in (lambda: c.get(URL, headers=as_user("otto")), lambda: c.put(URL, json={"enforce": True}, headers=as_user("otto")),
                 lambda: c.post(f"{URL}/allow", json={"phone": P1, "label": "x"}, headers=as_user("otto")),
                 lambda: c.put(f"{URL}/self-messages", json={"minutes": 5}, headers=as_user("otto"))):
        assert call().status_code == 403


def test_the_app_binds_the_guard_and_a_blocked_send_is_audited(env):
    c, settings = env
    c.post(f"{URL}/allow", json={"phone": P1, "label": "Dana", "role": "handler"}, headers=as_user("joni"))
    t = FakeTransport()
    ch = cw.WhatsAppChannel(t, Accounts())
    assert ch.send(_msg(P2)).outcome == SENT, "enforcement is off: everyone may be sent to"
    c.put(URL, json={"enforce": True}, headers=as_user("joni"))
    assert ch.send(_msg(P1)).outcome == SENT
    blocked = ch.send(_msg(P2))
    assert (blocked.outcome, blocked.outcome_code) == (NOT_SENT, "recipient_not_allowed")
    assert [x["target"] for x in t.calls] == [P2, P1]
    rows = _audit(settings, "messaging.whatsapp.recipient_blocked")
    assert len(rows) == 1 and rows[0]["decision"] == "denied" and rows[0]["resource_id"] == "ob1" and P2 not in json.dumps(rows)


def test_an_expired_window_switches_itself_off_once_with_an_audit_row(env):
    c, settings = env
    c.put(f"{URL}/self-messages", json={"minutes": 5}, headers=as_user("joni"))
    db = Database(settings.db_path)
    with db.connection() as conn:
        assert wp.expire_window(conn, dt.datetime.now(UTC)) is False
        assert wp.expire_window(conn, dt.datetime.now(UTC) + dt.timedelta(minutes=6)) is True
        assert wp.expire_window(conn, dt.datetime.now(UTC) + dt.timedelta(minutes=7)) is False
    states = [json.loads(a["details_json"])["state"] for a in _audit(settings, "messaging.whatsapp.self_messages")]
    assert states == ["on", "expired"]
    assert c.get(URL, headers=as_user("joni")).json()["self_messages"]["active"] is False


def test_the_policy_setting_stays_out_of_project_backups():
    from smplwise.services import backup

    assert wp.SETTING_KEY in open(backup.__file__, encoding="utf-8").read()
