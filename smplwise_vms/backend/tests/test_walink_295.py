"""WALINK-295: the temporary temperature-report link (TEMPLINK-295) sent as a plain-text WhatsApp message to the recipients the settings name.
Fakes only: the fake ha-whatsapp transport (nothing leaves the process, no real number), the tickets world's fake public address, no network.
The gates: off by default, the permission, a typed `not_sendable` for no number / no consent / template support off / no session window (never a fake
`sent`), the settings (recipients, text he/en, window, validation), and a content-free audit row."""
from __future__ import annotations

import datetime as dt
import json

import pytest
from conftest import as_user, bind
from fake_ha_whatsapp import FakeHaWhatsapp, PairedAccount
from test_templink_295 import API, make, turn_on, w  # noqa: F401 - the fixture and helpers of the link feature

from smplwise.db import now_iso
from smplwise.services import intercom_messaging as im
from smplwise.services import messaging_accounts as ma
from smplwise.services import messaging_runtime as mr
from smplwise.services import notify_whatsapp as wa
from smplwise.services import temperature_report_link_wa as rwa
from smplwise.services.tickets.channel import keyed_hash, phone_digits
from smplwise.services.tickets.keyring import KEYS

ENTRY = "01JFAKEENTRYT"
KEY = f"entry:{ENTRY}"
PHONE = "+972 50-555-0191"


@pytest.fixture()
def wl(w, monkeypatch):  # noqa: F811
    monkeypatch.setattr(mr, "ws_connected", lambda: True)
    wa.reset_state()
    fake = FakeHaWhatsapp([PairedAccount(ENTRY, "15555550191")])
    monkeypatch.setattr(wa, "TRANSPORT", fake)
    monkeypatch.setattr(im, "template_send_supported", lambda: True)  # the support flag is ON unless a test turns it off
    at = now_iso()
    with w["db"].connection() as conn:
        for r in fake.mirror_rows():
            conn.execute("INSERT INTO ha_entities(entity_id, unique_id, platform, config_entry_id, domain, device_class, state, available, disabled, name, first_seen_at, updated_at) "
                         "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)",
                         (r.entity_id, r.unique_id, r.platform, r.config_entry_id, r.domain, r.device_class, r.state, int(r.available), int(r.disabled), at, at))
        mr.store_doc(conn, ma.MappingDoc(1, (ma.Account(KEY, "discovered", label="office"),), {wa.USE_KEY: KEY}))
        uid = conn.execute("SELECT id FROM users WHERE username = 'joni'").fetchone()[0]
    w["fake"], w["uid"] = fake, uid
    yield w
    wa.reset_state()


def give_number(w, lang="he", opt_in=True):
    now = now_iso()
    with w["db"].connection() as conn:
        conn.execute("INSERT INTO ticket_contacts(id, kind, user_id, display_name, phone_e164, preferred_channel, lang, created_by, created_at, updated_at) "
                     "VALUES ('c-joni', 'person', ?, 'Joni', ?, 'whatsapp', ?, 'test', ?, ?)", (w["uid"], PHONE, lang, now, now))
    if opt_in:
        token = w["c"].get("/api/v1/me/notify-whatsapp").json()["confirm"]
        assert w["c"].put("/api/v1/me/notify-whatsapp", json={"opted_in": True, "confirm": token}).status_code == 200


def open_window(w, hours_ago=1.0):
    at = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=hours_ago)).strftime("%Y-%m-%dT%H:%M:%SZ")
    with w["db"].connection() as conn:
        conn.execute("INSERT INTO ticket_inbound(id, received_at, event_type, sender_key, dedupe_key, result) VALUES (?, ?, 'whatsapp_message_received', ?, ?, 'ignored')",
                     (f"in-{hours_ago}", at, keyed_hash(KEYS.get(None), phone_digits(PHONE)), f"d-{hours_ago}"))


def configure(w, **extra):
    turn_on(w, report_link_wa_enabled=True, report_link_wa_recipients=[w["uid"]], **extra)


def send(w, link_id, headers=None):
    return w["c"].post(f"{API}/report/links/{link_id}/send", headers=headers)


def audit_rows(w):
    with w["db"].connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = 'infra.temperature.report.link.send'").fetchall()]


def ready(w, **extra):
    configure(w, **extra)
    give_number(w)
    open_window(w)
    return make(w).json()


# ---------------------------------------------------------------- off by default, permission, settings

def test_off_by_default_and_nothing_is_sent(wl):
    turn_on(wl)
    link = make(wl).json()
    r = send(wl, link["id"])
    assert r.status_code == 409 and r.json()["code"] == "report_link_wa_off"
    assert wl["c"].get(f"{API}/settings").json()["rules"]["report_link_wa_enabled"] is False
    assert wl["fake"].calls == []


def test_enabled_without_recipients_is_refused(wl):
    turn_on(wl, report_link_wa_enabled=True)
    link = make(wl).json()
    r = send(wl, link["id"])
    assert r.status_code == 409 and r.json()["code"] == "report_link_wa_none" and wl["fake"].calls == []


def test_only_holders_of_the_send_permission_may_send(wl):
    configure(wl)
    link = make(wl).json()
    for user, role in (("opie", "operator"), ("vera", "viewer")):
        bind(wl["c"], wl["settings"], user, role, "installation", "*")
        assert send(wl, link["id"], as_user(user)).status_code == 403
    assert wl["fake"].calls == []
    assert wl["c"].get(f"{API}/report/links").json()["whatsapp"]["available"] is True
    for user in ("opie", "vera"):
        assert wl["c"].get(f"{API}/report/links", headers=as_user(user)).status_code == 403


def test_the_send_is_not_offered_when_off_or_without_recipients(wl):
    turn_on(wl)
    assert wl["c"].get(f"{API}/report/links").json()["whatsapp"]["available"] is False
    turn_on(wl, report_link_wa_enabled=True)
    assert wl["c"].get(f"{API}/report/links").json()["whatsapp"]["available"] is False


def test_settings_are_validated_and_round_trip(wl):
    c = wl["c"]
    bad = [("report_link_wa_text_he", "no placeholder"), ("report_link_wa_text_en", ""), ("report_link_wa_text_en", "x{link}" + "x" * 300), ("report_link_wa_text_he", 5),
           ("report_link_wa_recipients", "abc"), ("report_link_wa_recipients", ["a b"]), ("report_link_wa_recipients", [f"u{i}" for i in range(31)]),
           ("report_link_wa_window_h", 0), ("report_link_wa_window_h", 73), ("report_link_wa_enabled", "yes")]
    for k, v in bad:
        assert c.put(f"{API}/settings", json={"rules": {k: v}}).status_code == 422, k
    ok = c.put(f"{API}/settings", json={"rules": {"report_link_wa_text_he": "  report:   {link}  ", "report_link_wa_recipients": ["u1", "u1", "u2"], "report_link_wa_window_h": 12}})
    assert ok.status_code == 200, ok.text
    rules = ok.json()["rules"]
    assert rules["report_link_wa_text_he"] == "report: {link}" and rules["report_link_wa_recipients"] == ["u1", "u2"] and rules["report_link_wa_window_h"] == 12


# ---------------------------------------------------------------- sent

def test_a_sendable_recipient_gets_one_plain_text_with_the_link(wl):
    link = ready(wl)
    r = send(wl, link["id"])
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "sent" and body["sent"] == 1 and body["results"][0]["status"] == "sent" and body["results"][0]["user_id"] == wl["uid"]
    texts = wl["fake"].sent_texts()
    assert len(texts) == 1 and "/support/#d." in texts[0] and "24" in texts[0] and wl["fake"].calls[0]["service"] == "send_message"
    assert "template" not in json.dumps(wl["fake"].calls[0]["data"]).lower()


def test_the_text_and_the_language_are_settings(wl):
    configure(wl, report_link_wa_text_en="Report: {link} / {hours}h", report_link_wa_text_he="he {link} ({hours})")
    give_number(wl, lang="en")
    open_window(wl)
    link = make(wl).json()
    assert send(wl, link["id"]).json()["status"] == "sent"
    text = wl["fake"].sent_texts()[0]
    assert text.startswith("Report: ") and text.endswith(" / 24h")


# ---------------------------------------------------------------- not_sendable: typed, recorded, never a fake success

def test_the_template_support_flag_is_not_required(wl, monkeypatch):
    link = ready(wl)
    monkeypatch.setattr(im, "template_send_supported", lambda: False)  # owner 25.10: an open session window is enough
    body = send(wl, link["id"]).json()
    assert body["status"] == "sent" and body["results"][0]["status"] == "sent" and len(wl["fake"].sent_texts()) == 1


def test_no_session_window_is_not_sendable(wl):
    configure(wl)
    give_number(wl)
    link = make(wl).json()
    assert send(wl, link["id"]).json()["results"][0]["reason"] == "no_session_window"
    open_window(wl, hours_ago=30)  # wrote to us, but longer ago than the window
    assert send(wl, link["id"]).json()["results"][0]["reason"] == "no_session_window"
    assert wl["fake"].calls == []
    assert wl["c"].put(f"{API}/settings", json={"rules": {"report_link_wa_enabled": True, "report_link_wa_recipients": [wl["uid"]], "report_link_wa_window_h": 48}}).status_code == 200
    assert send(wl, link["id"]).json()["status"] == "sent"  # the window is a setting


def test_no_number_and_no_consent_are_not_sendable(wl):
    configure(wl)
    link = make(wl).json()
    assert send(wl, link["id"]).json()["results"][0]["reason"] == "no_address"
    give_number(wl, opt_in=False)
    open_window(wl)
    assert send(wl, link["id"]).json()["results"][0]["reason"] == "no_consent"
    assert wl["fake"].calls == []


def test_a_mixed_send_is_partial_and_each_recipient_is_typed(wl):
    link = ready(wl)
    assert wl["c"].put(f"{API}/settings", json={"rules": {"report_link_wa_enabled": True, "report_link_wa_recipients": [wl["uid"], "ghost-user"]}}).status_code == 200
    body = send(wl, link["id"]).json()
    assert body["status"] == "partial" and body["sent"] == 1 and body["not_sendable"] == 1
    assert [x["status"] for x in body["results"]] == ["sent", "not_sendable"] and body["results"][1]["reason"] == "no_address"


def test_a_provider_failure_is_failed_not_sent(wl):
    link = ready(wl)
    wl["fake"].queue("refused")
    body = send(wl, link["id"]).json()
    assert body["status"] == "failed" and body["results"][0]["status"] == "failed" and body["sent"] == 0


# ---------------------------------------------------------------- the link must be live and the caller's

def test_a_revoked_or_unknown_link_is_not_sent(wl):
    link = ready(wl)
    assert wl["c"].delete(f"{API}/report/links/{link['id']}").status_code == 204
    r = send(wl, link["id"])
    assert r.status_code == 409 and r.json()["code"] == "report_link_not_live"
    assert send(wl, "a" * 32).status_code == 404
    assert wl["fake"].calls == []


def test_a_non_manager_sends_only_his_own_link(wl):
    link = ready(wl)
    now = dt.datetime.now(dt.timezone.utc)
    with wl["db"].connection() as conn:
        with pytest.raises(rwa.SendRefused) as e:
            rwa.send(conn, wl["db"], link["id"], "someone-else", None, False, now)
    assert e.value.code == "link_not_found" and e.value.status == 404 and wl["fake"].calls == []


# ---------------------------------------------------------------- the record

def test_the_audit_row_is_content_free_for_sent_and_not_sendable(wl):
    link = ready(wl)
    send(wl, link["id"])
    with wl["db"].connection() as conn:
        conn.execute("DELETE FROM ticket_inbound")  # the window closes
    send(wl, link["id"])
    rows = audit_rows(wl)
    assert len(rows) == 2
    blob = json.dumps(rows, default=str)
    token = wl["fake"].sent_texts()[0].split("#d.")[1].split()[0].rstrip(")")
    assert token not in blob and "972505550191" not in blob and "0191" not in blob and "/support/" not in blob
    details = [json.loads(r["details_json"]) for r in rows]
    assert {d["status"] for d in details} == {"sent", "not_sendable"}
    assert all(r["resource_id"] == link["id"] for r in rows)


def test_render_keeps_one_line_and_fills_the_placeholders():
    assert rwa.render("a\nb {link} {hours}", "https://x.test/#d.t", 5) == "a b https://x.test/#d.t 5"
