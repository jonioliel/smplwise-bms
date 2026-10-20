"""TEMPVENDOR-295 (docs/changes/CR-VENDORQ2-295.md section 3): the temperature report reaches a VENDOR through the tickets message queue
(`contact_reports`, outbox purpose `report`) - over the REAL store with the fake ha-whatsapp and a fake SMTP sender of slice 5b (no network, no
Home Assistant, no phone, no PDF engine). The vendor of the tickets world stands in; every name, number and address is invented.

Covers: off by default (vendor_coming_later), the switches (`reports.to_contacts`, `reports.email`, `reports.documents`), the channel chosen per
report with NO automatic fallback, the text built at SEND time, the scope rule (the vendor gets exactly the selected units; refused at queue time
for a unit the sender cannot see, and again at send time), the send hours, the outcome mirrored on the send row, the temporary document link,
the schedule path, the tickets-module-off rule, and row / log hygiene."""
from __future__ import annotations

import datetime as dt
import json
import logging

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient  # noqa: F401 - typing only

from smplwise.db import now_iso
from smplwise.services import ha_sync, temperature_pdf
from smplwise.services import temperature_runtime as rt
from smplwise.services import temperature_whatsapp as twa
from smplwise.services.tickets import contact_reports as CR
from smplwise.services.tickets import out_documents, settings_doc
from test_tickets_s5b_channel import DAY, NIGHT, env  # noqa: F401 - `env` is the fixture of slice 5b
from tickets_s4_world import BASE_URL

API = "/api/v1/infra/temperature"
TICKETS = "/api/v1/settings"
PHONE_B_DIGITS = "972500000032"
MAIL_B = "service@clima.example.test"


@pytest.fixture()
def tw(env, monkeypatch):
    """Two temperature units with a little history, on the tickets world; the temperature routes see the world's fake clock."""
    from smplwise.routers import temperature as tr

    ha_sync.STATE.connected = True
    rt.reset()
    monkeypatch.setattr(tr, "now_ts", lambda: env.clock().timestamp())
    db, c = env.s4.db, env.c
    at = now_iso()
    with db.connection() as conn:
        for eid, st in (("sensor.fridge_temp", "4.0"), ("sensor.freezer_temp", "-18.0")):
            conn.execute("""INSERT INTO ha_entities (entity_id, name, domain, device_class, unit, state, available, last_changed, last_updated, first_seen_at, updated_at)
                            VALUES (?, ?, 'sensor', 'temperature', '°C', ?, 1, ?, ?, ?, ?)""", (eid, "שם " + eid.split(".")[1], st, at, at, at, at))
    u1 = c.post(API, json={"name": "מקרר מטבח", "temp_entity_id": "sensor.fridge_temp", "low": 2, "high": 6, "defrost_mode": "none", "rules": {"high_alarm_min": 1}}).json()["id"]
    u2 = c.post(API, json={"name": "מקפיא", "temp_entity_id": "sensor.freezer_temp", "low": -22, "high": -16, "defrost_mode": "none"}).json()["id"]
    t0 = env.clock().timestamp() - 3600
    with db.connection() as conn:
        for i, v in enumerate([4.0, 7.0, 7.0, 5.0]):
            conn.execute("UPDATE ha_entities SET state = ? WHERE entity_id = 'sensor.fridge_temp'", (str(v),))
            rt.evaluate(conn, t0 + i * 60, connected=True)
    yield {"env": env, "u1": u1, "u2": u2, "vendor": env.s4.vendor["id"]}
    temperature_pdf.set_renderer(None)
    ha_sync.STATE.connected = False


def _switch(env, **reports):
    with env.s4.db.connection() as conn:
        settings_doc.apply_patch(conn, {"reports": reports})


def _ts(env) -> float:
    return env.clock().timestamp()


def _vendor(w, channel="whatsapp"):
    return {"kind": "vendor", "id": w["vendor"], "channel": channel}


def _send(w, recipients=None, units=None, user="joni"):
    env = w["env"]
    return env.c.post(f"{API}/report/send", json={"units": units or [w["u1"]], "range": "24h", "recipients": recipients or [_vendor(w)]},
                      headers=env.h(user) if user != "joni" else {})


def _send_rows(env):
    with env.s4.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM infra_temp_report_sends ORDER BY created_at, id").fetchall()]


def _reports(env):
    return [r for r in env.rows() if r.purpose == "report"]


def _process(env):
    return twa.process(env.s4.db, _ts(env))


# ---------------------------------------------------------------- off by default

def test_vendors_stay_disabled_and_refused_while_vendor_reports_are_off(tw):
    env = tw["env"]
    r = env.c.get(f"{API}/report/recipients").json()
    v = next(x for x in r["vendors"] if x["id"] == tw["vendor"])
    assert (v["selectable"], v["reason"]) == (False, "coming_later") and "channels" not in v
    assert r["vendor_reports"] == {"enabled": False, "email": False} and r["attachment"] == "none"
    rr = _send(tw)
    assert rr.status_code == 422 and rr.json()["code"] == "vendor_coming_later"
    s = env.c.post(f"{API}/report/schedules", json={"units": [tw["u1"]], "range": "24h", "freq": "daily", "at": "08:30", "recipients": [_vendor(tw)]})
    assert s.status_code == 422 and s.json()["code"] == "vendor_coming_later"
    assert _send_rows(env) == [] and _reports(env) == []


def test_the_tickets_module_off_keeps_vendors_out_even_with_the_reports_switch_on(tw):
    env = tw["env"]
    _switch(env, to_contacts=True)
    assert env.c.patch(TICKETS, json={"tickets.enabled": "false"}).status_code == 200
    r = env.c.get(f"{API}/report/recipients").json()
    assert next(x for x in r["vendors"] if x["id"] == tw["vendor"])["selectable"] is False and r["vendor_reports"]["enabled"] is False
    assert _send(tw).json()["code"] == "vendor_coming_later"
    assert _reports(env) == []


# ---------------------------------------------------------------- WhatsApp: queue -> outbox -> the text built at send time

def test_a_vendor_report_goes_through_the_outbox_and_the_text_is_built_at_send_time(tw, caplog):
    caplog.set_level(logging.DEBUG)
    env = tw["env"]
    _switch(env, to_contacts=True)
    r = env.c.get(f"{API}/report/recipients").json()
    v = next(x for x in r["vendors"] if x["id"] == tw["vendor"])
    assert v["selectable"] is True and v["channels"] == {"whatsapp": "ok", "email": "reports_email_off"} and v["channel"] == "whatsapp"
    assert PHONE_B_DIGITS not in json.dumps(r) and MAIL_B not in json.dumps(r)
    rr = _send(tw, [_vendor(tw)], [tw["u1"]])
    assert rr.status_code == 202 and rr.json()["queued"] == 1 and rr.json()["vendors"] == 1
    assert rr.json()["sends"][0]["kind"] == "vendor" and rr.json()["sends"][0]["name"] == env.s4.vendor["display_name"]
    row = _send_rows(env)[0]
    assert (row["recipient_kind"], row["contact_id"], row["user_id"], row["status"]) == ("vendor", tw["vendor"], None, "queued")
    assert json.loads(row["request_json"])["channel"] == "whatsapp" and row["created_by"]
    out = _process(env)
    assert out["handed"] == 1 and out["sent"] == 0 and env.fake.calls == [], "the temperature worker sends nothing itself"
    sent = _send_rows(env)[0]
    assert (sent["status"], sent["finished_at"]) == ("handed", None)
    rep = _reports(env)
    assert len(rep) == 1 and (rep[0].source_module, rep[0].source_id, rep[0].channel, rep[0].contact_id) == ("temperature", row["id"], "whatsapp", tw["vendor"])
    with env.s4.db.connection(mode="read") as conn:
        stored = json.dumps(dict(conn.execute("SELECT * FROM ticket_outbox WHERE id = ?", (rep[0].id,)).fetchone()), ensure_ascii=False)
    assert "מקרר" not in stored and PHONE_B_DIGITS not in stored, "the outbox row holds no text and no number"
    with env.s4.db.connection() as conn:  # the data changes between the hand-off and the send: the text follows
        conn.execute("UPDATE infra_temp_units SET name = 'מקרר חדש' WHERE id = ?", (tw["u1"],))
    assert env.tick() == 1
    msg = env.fake.calls[0]
    assert msg["data"]["target"] == PHONE_B_DIGITS and msg["service"] == "send_message"
    text = msg["data"]["message"]
    assert text.startswith("מגדלי הדר\n") and "דוח טמפרטורות" in text and "מקרר חדש" in text and "מקפיא" not in text, "exactly the selected unit"
    assert "זמין במערכת" not in text, "a vendor has no access to the system"
    done = _send_rows(env)[0]
    assert (done["status"], done["reason"]) == ("sent", None) and done["finished_at"]
    assert env.c.get(f"{API}/report/sends/{rr.json()['batch_id']}").json()["sends"][0]["status"] == "sent"
    for blob in (json.dumps(done), caplog.text):
        assert PHONE_B_DIGITS not in blob and "מקרר חדש" not in blob and MAIL_B not in blob
    with env.s4.db.connection(mode="read") as conn:
        acts = {a[0]: a[1] for a in conn.execute("SELECT action, details_json FROM audit_log WHERE action LIKE 'infra.temperature.report%' OR action = 'ticket.message.send'")}
    assert {"infra.temperature.report.send", "infra.temperature.report.handoff", "ticket.message.send"} <= set(acts)
    assert PHONE_B_DIGITS not in json.dumps(acts) and "מקרר" not in json.dumps(acts, ensure_ascii=False)


def test_two_units_selected_two_units_sent(tw):
    env = tw["env"]
    _switch(env, to_contacts=True)
    assert _send(tw, units=[tw["u1"], tw["u2"]]).status_code == 202
    _process(env)
    env.tick()
    text = env.fake.calls[0]["data"]["message"]
    assert "מקרר מטבח" in text and "מקפיא" in text


def test_a_vendor_who_cannot_be_reached_is_skipped_with_the_reason(tw):
    env = tw["env"]
    _switch(env, to_contacts=True, email=True)
    with env.s4.db.connection() as conn:
        conn.execute("UPDATE ticket_contacts SET phone_e164 = NULL WHERE id = ?", (tw["vendor"],))
    env.smtp()
    r = env.c.get(f"{API}/report/recipients").json()
    v = next(x for x in r["vendors"] if x["id"] == tw["vendor"])
    assert v["channels"] == {"whatsapp": "no_whatsapp", "email": "ok"} and v["selectable"] is True and v["channel"] == "email"
    assert _send(tw).status_code == 202  # the manager chose WhatsApp anyway: the reason is shown, nothing else is tried
    out = _process(env)
    assert out["skipped"] == 1 and out["handed"] == 0
    row = _send_rows(env)[0]
    assert (row["status"], row["reason"]) == ("skipped", "no_whatsapp")
    assert _reports(env) == [] and env.fake.calls == [] and env.mails == [], "no automatic fallback to e-mail"
    with env.s4.db.connection(mode="read") as conn:
        a = conn.execute("SELECT decision, reason FROM audit_log WHERE action = 'infra.temperature.report.handoff' ORDER BY id DESC LIMIT 1").fetchone()
    assert tuple(a) == ("denied", "no_whatsapp")


def test_an_unknown_or_erased_vendor_is_refused(tw):
    env = tw["env"]
    _switch(env, to_contacts=True)
    r = _send(tw, [{"kind": "vendor", "id": "no-such"}])
    assert r.status_code == 422 and r.json()["code"] == "recipient_vendor"
    r = _send(tw, [{"kind": "vendor", "id": env.s4.contact["id"]}])  # a person of the directory is not a vendor
    assert r.status_code == 422 and r.json()["code"] == "recipient_vendor"
    r = _send(tw, [{"kind": "vendor", "id": tw["vendor"], "channel": "pigeon"}])
    assert r.status_code == 422 and r.json()["code"] == "validation"
    assert _send_rows(env) == []


def test_users_and_vendors_in_one_send_each_take_their_own_path(tw):
    env = tw["env"]
    _switch(env, to_contacts=True)
    me = env.c.get("/api/v1/me").json()
    uid = me.get("id") or me.get("user", {}).get("id")
    r = _send(tw, [{"kind": "user", "id": uid}, _vendor(tw)])
    assert r.status_code == 202 and r.json()["queued"] == 2
    kinds = {x["recipient_kind"]: x for x in _send_rows(env)}
    assert kinds["user"]["user_id"] == uid and kinds["user"]["contact_id"] is None and "channel" not in json.loads(kinds["user"]["request_json"])
    out = _process(env)
    assert out["handed"] == 1 and out["skipped"] == 1  # the user has no opted-in number: skipped as before, the vendor is handed on


# ---------------------------------------------------------------- the send hours

def test_the_send_hours_hold_a_vendor_report(tw):
    env = tw["env"]
    _switch(env, to_contacts=True)
    env.clock.t = NIGHT
    assert _send(tw).status_code == 202
    assert _process(env)["held"] == 1 and _reports(env) == []
    row = _send_rows(env)[0]
    assert (row["status"], row["reason"]) == ("held", "send_hours")
    env.clock.t = DAY + dt.timedelta(days=1)  # the next morning
    assert _process(env)["handed"] == 1
    env.tick()
    assert _send_rows(env)[0]["status"] == "sent" and len(env.fake.calls) == 1


def test_the_outbox_holds_a_handed_report_in_its_own_hours_and_the_row_follows(tw):
    env = tw["env"]
    _switch(env, to_contacts=True)
    assert _send(tw).status_code == 202
    assert _process(env)["handed"] == 1
    env.clock.t = NIGHT  # the window closed before the worker picked it up
    assert env.tick() == 0 and env.fake.calls == []
    held = _reports(env)[0]
    assert (held.state, held.held_reason) == ("held", "send_hours") and _send_rows(env)[0]["status"] == "handed"
    env.clock.t = DAY + dt.timedelta(days=1)
    assert env.tick() == 1 and _send_rows(env)[0]["status"] == "sent"


# ---------------------------------------------------------------- the outcome

def test_an_unknown_outcome_is_final_and_failed_on_the_send_row(tw):
    env = tw["env"]
    _switch(env, to_contacts=True)
    _send(tw)
    _process(env)
    env.fake.queue("timeout")
    env.tick()
    row = _send_rows(env)[0]
    assert (row["status"], row["reason"]) == ("failed", "unknown_outcome") and row["finished_at"]
    assert env.tick(minutes=30) == 0 and len(env.fake.calls) == 1, "never retried"


def test_a_refused_report_is_failed_with_the_outbox_code_and_an_unmapped_account_only_waits(tw):
    env = tw["env"]
    _switch(env, to_contacts=True)
    _send(tw)
    _process(env)
    env.mapping({"tickets.messages": None})
    env.tick()
    assert _send_rows(env)[0]["status"] == "handed", "held (account unmapped) is not an outcome yet"
    env.mapping({"tickets.messages": "entry:01JFAKEENTRYA"})
    env.fake.queue("refused")
    env.tick(minutes=1)
    row = _send_rows(env)[0]
    assert row["status"] == "failed" and row["reason"] and row["finished_at"]
    assert _reports(env)[0].state == "refused" and row["reason"] == (_reports(env)[0].outcome_code or "refused")


# ---------------------------------------------------------------- the scope rule

def test_a_vendor_is_refused_a_unit_the_sender_cannot_see(tw, env):
    c, settings = env.c, env.s4.w.settings
    bind(c, settings, "kio", "kiosk", "installation", "*")  # no devices.read at all
    _switch(env, to_contacts=True)
    with env.s4.db.connection() as conn:
        for sender, ok in (("dev-joni", True), ("dev-kio", False)):
            batch = lambda: twa.queue_send(conn, None, [tw["u1"]], 0, 100, "he", [_vendor(tw)], _ts(env), sender_id=sender)  # noqa: E731
            if ok:
                assert batch()["vendors"] == 1
            else:
                with pytest.raises(twa.SendInvalid) as exc:
                    batch()
                assert exc.value.code == "vendor_scope"
    assert len(_send_rows(env)) == 1


def test_a_schedule_with_a_vendor_needs_a_sender_who_sees_every_unit(tw, env):
    c, settings = env.c, env.s4.w.settings
    bind(c, settings, "kio", "kiosk", "installation", "*")
    body = {"units": [tw["u1"]], "range": "24h", "freq": "daily", "at": "08:30", "recipients": [_vendor(tw)]}
    _switch(env, to_contacts=True)
    with env.s4.db.connection() as conn:
        with pytest.raises(twa.SendInvalid) as exc:
            twa.save_schedule(conn, type("P", (), {"user_id": "dev-kio"})(), [tw["u1"]], "he", body, _ts(env))
        assert exc.value.code == "vendor_scope"
    assert env.c.post(f"{API}/report/schedules", json=body).status_code == 201


def test_the_scope_is_checked_again_at_send_time(tw, env):
    c, settings = env.c, env.s4.w.settings
    bind(c, settings, "kio", "kiosk", "installation", "*")
    _switch(env, to_contacts=True)
    # the sender loses access between the queue and the hand-off: nothing is handed on
    _send(tw)
    with env.s4.db.connection() as conn:
        conn.execute("UPDATE infra_temp_report_sends SET created_by = 'dev-kio'")
    out = _process(env)
    assert out["skipped"] == 1 and _reports(env) == [] and _send_rows(env)[0]["reason"] == "no_reach"
    # ... and after the hand-off: the text builder returns nothing, the message provably does not leave
    _send(tw)
    _process(env)
    with env.s4.db.connection() as conn:
        conn.execute("UPDATE infra_temp_report_sends SET created_by = 'dev-kio' WHERE status = 'handed'")
    env.tick()
    assert env.fake.calls == []
    rep = [r for r in _reports(env) if r.outcome_code]
    assert [r.outcome_code for r in rep] == ["report_unavailable"]
    assert sorted((r["status"], r["reason"]) for r in _send_rows(env) if r["status"] != "skipped") == [("failed", "report_unavailable")]


# ---------------------------------------------------------------- e-mail: its own switch, never a fallback

def test_the_email_channel_needs_its_own_switch(tw):
    env = tw["env"]
    _switch(env, to_contacts=True)
    env.smtp()
    r = _send(tw, [_vendor(tw, "email")])
    assert r.status_code == 422 and r.json()["code"] == "reports_email_off"
    assert _send_rows(env) == []


def test_a_report_leaves_by_email_when_the_manager_chose_email(tw, caplog):
    caplog.set_level(logging.DEBUG)
    env = tw["env"]
    _switch(env, to_contacts=True, email=True)
    env.smtp()
    r = env.c.get(f"{API}/report/recipients").json()
    assert r["vendor_reports"] == {"enabled": True, "email": True}
    assert next(x for x in r["vendors"] if x["id"] == tw["vendor"])["channels"] == {"whatsapp": "ok", "email": "ok"}
    assert _send(tw, [_vendor(tw, "email")]).status_code == 202
    assert json.loads(_send_rows(env)[0]["request_json"])["channel"] == "email"
    assert _process(env)["handed"] == 1
    assert _reports(env)[0].channel == "email"
    assert env.tick() == 1
    assert env.fake.calls == [], "e-mail never touches WhatsApp"
    to, rendered = env.mails[0]
    assert to == MAIL_B and rendered.subject == "דוח"
    assert rendered.text.startswith("מגדלי הדר\n") and "דוח טמפרטורות" in rendered.text and "מקרר מטבח" in rendered.text
    assert _send_rows(env)[0]["status"] == "sent"
    assert MAIL_B not in caplog.text and MAIL_B not in json.dumps(_send_rows(env))


def test_a_failed_whatsapp_report_never_becomes_an_email(tw):
    env = tw["env"]
    _switch(env, to_contacts=True, email=True)
    env.smtp()
    env.channel(email_fallback=True)
    _send(tw, [_vendor(tw)])
    _process(env)
    env.fake.queue("timeout")
    env.tick()
    env.tick(minutes=30)
    assert env.mails == [] and len(env.fake.calls) == 1 and _send_rows(env)[0]["status"] == "failed"
    # the reverse: an e-mail that cannot leave never becomes a WhatsApp message
    with env.s4.db.connection() as conn:
        conn.execute("UPDATE ticket_contacts SET email = NULL WHERE id = ?", (tw["vendor"],))
    env.fake.calls.clear()
    _send(tw, [_vendor(tw, "email")])
    assert _process(env)["skipped"] == 1 and env.fake.calls == []
    assert _send_rows(env)[-1]["reason"] == "no_email"


# ---------------------------------------------------------------- the temporary document link

def _doc_ready(env, monkeypatch, pdf=b"%PDF-1.7\n%fake\n"):
    monkeypatch.setattr(out_documents, "PAGE_READY", True)
    temperature_pdf.set_renderer(lambda model: pdf)
    assert env.c.put(f"{API}/settings", json={"rules": {"report_attachment": "link"}}).status_code == 200


def test_the_attachment_setting_accepts_none_and_link_only(tw):
    c = tw["env"].c
    assert c.put(f"{API}/settings", json={"rules": {"report_attachment": "pdf"}}).status_code == 422
    assert c.put(f"{API}/settings", json={"rules": {"report_attachment": "link"}}).status_code == 200
    assert c.put(f"{API}/settings", json={"rules": {"report_attachment": "none"}}).status_code == 200


def test_mode_link_with_documents_on_sends_the_pdf_by_a_temporary_link(tw, monkeypatch):
    env = tw["env"]
    _switch(env, to_contacts=True, documents=True)
    _doc_ready(env, monkeypatch)
    r = env.c.get(f"{API}/report/recipients").json()
    assert r["attachment"] == "link" and "link" in r["attachment_modes"]
    _send(tw, [_vendor(tw)], [tw["u1"], tw["u2"]])
    assert _process(env)["handed"] == 1
    rep = _reports(env)[0]
    assert rep.document_id
    with env.s4.db.connection(mode="read") as conn:
        doc = out_documents.row(conn, rep.document_id)
        token = out_documents.token_of(doc)
        stored = json.dumps(dict(conn.execute("SELECT * FROM ticket_outbox WHERE id = ?", (rep.id,)).fetchone()))
        minted = conn.execute("SELECT 1 FROM audit_log WHERE action = 'report.document.mint'").fetchone()
    assert (doc["recipient_kind"], doc["recipient_id"], doc["media_type"], doc["module"]) == ("contact", tw["vendor"], "application/pdf", "temperature")
    assert doc["filename"].startswith("temperature-report-") and minted and token not in stored
    assert env.tick() == 1
    text = env.fake.calls[0]["data"]["message"]
    assert "הדוח המלא (זמין עד " in text and text.endswith(f"{BASE_URL}/support/#d.{token}")
    assert "זמין במערכת" not in text
    assert _send_rows(env)[0]["status"] == "sent"


def test_documents_off_or_mode_none_sends_the_text_only(tw, monkeypatch):
    env = tw["env"]
    _switch(env, to_contacts=True, documents=False)
    _doc_ready(env, monkeypatch)  # mode link, but the tickets switch for documents is off
    _send(tw)
    _process(env)
    assert _reports(env)[0].document_id is None
    env.tick()
    assert "#d." not in env.fake.calls[0]["data"]["message"]
    with env.s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM outbound_documents").fetchone()[0] == 0


def test_the_pdf_engine_down_retries_and_never_sends_the_text_without_the_document(tw, monkeypatch):
    env = tw["env"]
    _switch(env, to_contacts=True, documents=True)
    _doc_ready(env, monkeypatch)

    def boom(model):
        raise temperature_pdf.PdfError("pdf_unavailable")

    temperature_pdf.set_renderer(boom)
    _send(tw)
    ts = _ts(env)
    assert twa.process(env.s4.db, ts)["retry"] == 1
    assert _send_rows(env)[0]["status"] == "retry" and _reports(env) == []
    for k in (1, 2, 3):
        env.clock.advance(minutes=20)
        twa.process(env.s4.db, _ts(env))
    row = _send_rows(env)[0]
    assert (row["status"], row["reason"]) == ("skipped", "pdf_unavailable") and _reports(env) == [] and env.fake.calls == []
    temperature_pdf.set_renderer(lambda model: b"%PDF-1.7\n")
    with env.s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM outbound_documents").fetchone()[0] == 0


def test_a_document_whose_report_cannot_be_queued_is_revoked(tw, monkeypatch):
    env = tw["env"]
    _switch(env, to_contacts=True, documents=True)
    _doc_ready(env, monkeypatch)
    _send(tw)
    real = CR.queue

    def refuse(conn, **kw):
        raise CR.ReportRefused("queue_unavailable")

    monkeypatch.setattr(CR, "queue", refuse)
    out = _process(env)
    monkeypatch.setattr(CR, "queue", real)
    assert out["skipped"] == 1 and _send_rows(env)[0]["reason"] == "queue_unavailable"
    with env.s4.db.connection(mode="read") as conn:
        docs = conn.execute("SELECT revoked_reason FROM outbound_documents").fetchall()
    assert [d[0] for d in docs] == ["send_failed"], "no live link without its message"


# ---------------------------------------------------------------- schedules

def test_a_schedule_with_a_vendor_hands_the_report_on_and_a_deleted_schedule_stops_it(tw):
    env = tw["env"]
    _switch(env, to_contacts=True)
    body = {"units": [tw["u1"]], "range": "24h", "freq": "daily", "at": "08:30", "recipients": [_vendor(tw)]}
    s = env.c.post(f"{API}/report/schedules", json=body)
    assert s.status_code == 201 and s.json()["recipients"] == [_vendor(tw)]
    env.clock.t = DAY + dt.timedelta(days=1)  # 11:00 next day: after the 08:30 run
    out = _process(env)
    assert out["scheduled"] == 1 and out["handed"] == 1
    row = _send_rows(env)[0]
    assert (row["recipient_kind"], row["schedule_id"], row["status"]) == ("vendor", s.json()["id"], "handed") and row["created_by"]
    assert env.c.delete(f"{API}/report/schedules/{s.json()['id']}").status_code == 204
    env.tick()
    assert env.fake.calls == [] and _reports(env)[0].state != "sent", "withdrawn with the schedule"
    # the next run of another schedule is not affected
    assert env.c.post(f"{API}/report/schedules", json=body).status_code == 201


def test_a_schedule_run_skips_a_vendor_whose_sender_lost_the_scope_and_still_serves_the_others(tw, env):
    c, settings = env.c, env.s4.w.settings
    bind(c, settings, "kio", "kiosk", "installation", "*")
    _switch(env, to_contacts=True)
    me = c.get("/api/v1/me").json()
    uid = me.get("id") or me.get("user", {}).get("id")
    body = {"units": [tw["u1"]], "range": "24h", "freq": "daily", "at": "08:30", "recipients": [{"kind": "user", "id": uid}, _vendor(tw)]}
    sid = c.post(f"{API}/report/schedules", json=body).json()["id"]
    with env.s4.db.connection() as conn:
        conn.execute("UPDATE infra_temp_report_schedules SET created_by = 'dev-kio' WHERE id = ?", (sid,))
    env.clock.t = DAY + dt.timedelta(days=1)
    _process(env)
    kinds = [r["recipient_kind"] for r in _send_rows(env)]
    assert "vendor" not in kinds and _reports(env) == []
    with env.s4.db.connection(mode="read") as conn:
        a = conn.execute("SELECT decision, reason FROM audit_log WHERE action = 'infra.temperature.report.schedule_skip'").fetchone()
    assert tuple(a) == ("denied", "vendor_scope")


# ---------------------------------------------------------------- permission and small pieces

def test_vendor_sends_need_the_manage_permission(tw, env):
    c, settings = env.c, env.s4.w.settings
    bind(c, settings, "ops", "operator", "installation", "*")
    _switch(env, to_contacts=True)
    assert _send(tw, user="ops").status_code == 403
    assert c.get(f"{API}/report/recipients", headers=as_user("ops")).status_code == 403
    assert _send_rows(env) == []


def test_the_vendor_text_has_no_system_note_and_a_user_text_keeps_it(tw):
    from smplwise.services import temperature_report as rep

    env = tw["env"]
    with env.s4.db.connection(mode="read") as conn:
        units = [u for u in conn.execute("SELECT * FROM infra_temp_units").fetchall() if u["id"] == tw["u1"]]
        model = rep.build(conn, units, set(), int(_ts(env)) - 86400, int(_ts(env)), "he", _ts(env), chart=False, events=False, signature=False)
        en = rep.build(conn, units, set(), int(_ts(env)) - 86400, int(_ts(env)), "en", _ts(env), chart=False, events=False, signature=False)
    assert "זמין במערכת" in rep.text_summary(model) and "זמין במערכת" not in rep.text_summary(model, external=True)
    assert "available in the system" in rep.text_summary(en) and "available in the system" not in rep.text_summary(en, external=True)
    assert rep.text_summary(en, external=True).endswith("Automatic message - do not reply.")
    with env.s4.db.connection(mode="read") as conn:
        assert twa.attachment_for(conn, {"recipient_kind": "user"}, model, pdf=b"%PDF-") is None, "a system user never gets a link"
        assert twa.attachment_for(conn, {}, {}) is None
