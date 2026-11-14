"""CR-INFRA-TEMPERATURE 2.9.1 phase 2: the temperature report (model, HTML, PDF route with a fake renderer - no PDF engine is needed) and
the WhatsApp TEXT SUMMARY (owner option A) through the existing account / pacing / consent / send hours, with the fake ha-whatsapp
transport. Also the phase-2 settings: alerts on by default, quiet hours and mute hold warnings only unless an administrator chose otherwise.
Fakes only: no Home Assistant, no phone, no network."""
from __future__ import annotations

import datetime as dt
import json

import pytest
from conftest import as_user, bind
from fake_ha_whatsapp import FakeHaWhatsapp, PairedAccount
from fastapi.testclient import TestClient

from smplwise.db import Database, now_iso
from smplwise.services import messaging_accounts as ma
from smplwise.services import messaging_runtime as mr
from smplwise.services import notify_whatsapp as wa
from smplwise.services import temperature_pdf, temperature_report as rep
from smplwise.services import temperature_runtime as rt
from smplwise.services import temperature_whatsapp as twa

API = "/api/v1/infra/temperature"
UTC = dt.timezone.utc
T0 = dt.datetime(2026, 10, 19, 7, 0, tzinfo=UTC).timestamp()     # 10:00 local - inside the default send hours 07:00-21:00
NIGHT = dt.datetime(2026, 10, 19, 20, 30, tzinfo=UTC).timestamp()  # 23:30 local - outside
ENTRY = "01JFAKEENTRYT"
KEY = f"entry:{ENTRY}"
PHONE = "+972 50-555-0191"


def iso(ts: float) -> str:
    return dt.datetime.fromtimestamp(ts, UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


@pytest.fixture()
def app(settings, monkeypatch):
    from smplwise.main import create_app
    from smplwise.routers import temperature as tr
    from smplwise.services import ha_sync

    ha_sync.STATE.connected = True
    rt.reset()
    wa.reset_state()
    monkeypatch.setattr(mr, "ws_connected", lambda: True)
    clock = {"ts": T0 + 3600}
    monkeypatch.setattr(tr, "now_ts", lambda: clock["ts"])
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    db = Database(settings.db_path)
    fake = FakeHaWhatsapp([PairedAccount(ENTRY, "15555550191")])
    monkeypatch.setattr(wa, "TRANSPORT", fake)
    at = now_iso()
    with db.connection() as conn:
        for eid, st, unit in (("sensor.fridge_temp", "4.0", "°C"), ("sensor.freezer_temp", "-18.0", "°C")):
            conn.execute("""INSERT INTO ha_entities (entity_id, name, domain, device_class, unit, state, available, last_changed, last_updated, first_seen_at, updated_at)
                            VALUES (?, ?, 'sensor', 'temperature', ?, ?, 1, ?, ?, ?, ?)""", (eid, "שם " + eid.split(".")[1], unit, st, at, at, at, at))
        for r in fake.mirror_rows():
            conn.execute("INSERT INTO ha_entities(entity_id, unique_id, platform, config_entry_id, domain, device_class, state, available, disabled, name, first_seen_at, updated_at) "
                         "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)",
                         (r.entity_id, r.unique_id, r.platform, r.config_entry_id, r.domain, r.device_class, r.state, int(r.available), int(r.disabled), at, at))
    u1 = c.post(API, json={"name": "מקרר מטבח", "temp_entity_id": "sensor.fridge_temp", "low": 2, "high": 6, "defrost_mode": "none", "rules": {"high_alarm_min": 1}}).json()["id"]
    u2 = c.post(API, json={"name": "מקפיא", "temp_entity_id": "sensor.freezer_temp", "low": -22, "high": -16, "defrost_mode": "none"}).json()["id"]
    with db.connection() as conn:
        for i, v in enumerate([4.0, 7.0, 7.0, 5.0]):
            conn.execute("UPDATE ha_entities SET state = ? WHERE entity_id = 'sensor.fridge_temp'", (str(v),))
            rt.evaluate(conn, T0 + i * 60, connected=True)
    yield {"c": c, "db": db, "settings": settings, "clock": clock, "u1": u1, "u2": u2, "fake": fake}
    temperature_pdf.set_renderer(None)
    wa.reset_state()
    ha_sync.STATE.connected = False


def joni(db: Database) -> str:
    with db.connection(mode="read") as conn:
        return conn.execute("SELECT id FROM users WHERE username = 'joni'").fetchone()[0]


def ready_whatsapp(w, username: str = "joni") -> str:
    """The account mapped for the notifications use (the report use inherits it), the user's directory row and his OWN opt-in."""
    c, db = w["c"], w["db"]
    uid = joni(db) if username == "joni" else None
    if uid is None:
        c.get("/api/v1/me", headers=as_user(username))
        with db.connection(mode="read") as conn:
            uid = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()[0]
    now = now_iso()
    with db.connection() as conn:
        mr.store_doc(conn, ma.MappingDoc(1, (ma.Account(KEY, "discovered", label="משרד"),), {wa.USE_KEY: KEY}))
        conn.execute("INSERT INTO ticket_contacts(id, kind, user_id, display_name, phone_e164, preferred_channel, lang, created_by, created_at, updated_at) "
                     "VALUES (?, 'person', ?, 'יוני', ?, 'whatsapp', 'he', 'test', ?, ?)", (f"c-{uid}"[:40], uid, PHONE, now, now))
    hdr = as_user(username) if username != "joni" else {}
    token = c.get("/api/v1/me/notify-whatsapp", headers=hdr).json()["confirm"]
    assert c.put("/api/v1/me/notify-whatsapp", json={"opted_in": True, "confirm": token}, headers=hdr).status_code == 200
    return uid


def add_vendor(db: Database) -> str:
    now = now_iso()
    with db.connection() as conn:
        conn.execute("INSERT INTO ticket_contacts(id, kind, display_name, company, phone_e164, preferred_channel, lang, created_by, created_at, updated_at) "
                     "VALUES ('v1', 'vendor', 'קירור הצפון', 'קירור הצפון בע\"מ', '972505550277', 'whatsapp', 'he', 'test', ?, ?)", (now, now))
    return "v1"


# ---------------------------------------------------------------- the model, the HTML, the text

def test_preview_model_numbers_and_text_summary(app):
    c, u1, u2 = app["c"], app["u1"], app["u2"]
    m = c.get(f"{API}/report/preview?units={u1},{u2}&range=24h").json()
    assert [u["name"] for u in m["units"]] == ["מקרר מטבח", "מקפיא"]
    s = m["units"][0]["stats"]
    assert s["max"] == 7.0 and s["min"] == 4.0 and s["out_min"] == 2 and s["alarms"] == 1
    assert m["units"][0]["events"][0]["kind"] == "high" and m["signature"] == {"mode": "line"}
    assert len(m["digest"]) == 64 and m["filename"].startswith("temperature-report-")
    txt = m["text_summary"]
    assert txt.startswith("Arx · דוח טמפרטורות") and "מקרר מטבח: מינ׳ 4.0° · מקס׳ 7.0°" in txt and "PDF" in txt and len(txt) <= rep.TEXT_MAX
    assert "sensor." not in json.dumps(m)  # friendly names only, never an entity id
    en = c.get(f"{API}/report/preview?units={u1}&range=7d&lang=en&chart=0&events=0&signature=0").json()
    assert en["text_summary"].startswith("Arx · Temperature report") and en["signature"] is None and "points" not in en["units"][0]
    assert c.get(f"{API}/report/preview?units=nope&range=24h").status_code == 404
    assert c.get(f"{API}/report/preview?units={u1}&range=bogus").status_code == 422


def test_html_is_rtl_with_a_signature_line_and_the_chart(app):
    c, db, u1 = app["c"], app["db"], app["u1"]
    m = c.get(f"{API}/report/preview?units={u1}&range=24h").json()
    page = rep.html_of(m)
    assert '<html lang="he" dir="rtl">' in page and "חתימת מנהל" in page and "<svg class=\"chart\"" in page and "sha256" in page
    assert 'src="bill-brand:smplwise-word.png"' in page  # NOTICEPUSH-295: the approved SmplWise logo (bundled picture)
    assert "bill-asset:Heebo-he-400.ttf" in page and "http" not in page.replace("http://www.w3.org/2000/svg", "")  # bundled fonts only
    m["lang"] = "en"
    assert '<html lang="en" dir="ltr">' in rep.html_of(m) and "Manager signature" in rep.html_of(m)
    # many units: the text is capped and says how many were left out
    m["lang"] = "he"
    m["units"] = m["units"] * 20
    assert len(rep.text_summary(m)) <= rep.TEXT_MAX and "ועוד" in rep.text_summary(m)


def test_white_label_names_the_installer_in_the_page_head_only_while_on(app):
    """WHITELABEL097-295: the installer's name and contact line sit under the SmplWise mark in the head (inside the digest), only while on."""
    c, u1 = app["c"], app["u1"]
    m = c.get(f"{API}/report/preview?units={u1}&range=24h").json()
    assert "installer" not in m and 'class="inst"' not in rep.html_of(m)
    assert c.put("/api/v1/brand/white-label", json={"name": "מתקין <i>", "contact": "03-1234567", "enabled": True}).status_code == 200
    on = c.get(f"{API}/report/preview?units={u1}&range=24h").json()
    assert on["installer"] == {"name": "מתקין <i>", "contact": "03-1234567"} and on["digest"] != m["digest"]
    page = rep.html_of(on)
    assert 'alt="SmplWise"><div class="inst">מתקין &lt;i&gt; · 03-1234567</div>' in page and "<i>" not in page


def test_pdf_route_with_a_fake_renderer_and_the_unavailable_engine(app):
    c, u1 = app["c"], app["u1"]
    seen = {}

    def fake(model):
        seen["model"] = model
        return b"%PDF-1.7 fake"

    temperature_pdf.set_renderer(fake)
    r = c.get(f"{API}/report.pdf?units={u1}&range=custom&from=2026-10-19T06:00:00Z&to=2026-10-19T09:00:00Z&lang=en")
    assert r.status_code == 200 and r.content.startswith(b"%PDF-") and r.headers["content-type"] == "application/pdf"
    assert "attachment" in r.headers["content-disposition"] and r.headers["x-report-digest"] == seen["model"]["digest"]
    assert seen["model"]["lang"] == "en" and seen["model"]["from"] == int(dt.datetime(2026, 10, 19, 6, tzinfo=UTC).timestamp())

    def broken(model):
        raise temperature_pdf.PdfError("pdf_unavailable")

    temperature_pdf.set_renderer(broken)
    r = c.get(f"{API}/report.pdf?units={u1}")
    assert r.status_code == 503 and r.json()["code"] == "pdf_unavailable"


def test_presets_in_local_time():
    from zoneinfo import ZoneInfo

    tz = ZoneInfo("Asia/Jerusalem")
    now = dt.datetime(2026, 10, 21, 9, 0, tzinfo=tz).timestamp()  # a Wednesday
    lo, hi = twa.range_of("week", now, tz)
    assert dt.datetime.fromtimestamp(lo, tz) == dt.datetime(2026, 10, 18, 0, 0, tzinfo=tz) and hi == int(now)  # from Sunday
    lo, hi = twa.range_of("prev_month", now, tz)
    assert dt.datetime.fromtimestamp(lo, tz).date() == dt.date(2026, 9, 1) and dt.datetime.fromtimestamp(hi, tz).date() == dt.date(2026, 10, 1)
    with pytest.raises(ValueError):
        twa.range_of("x", now, tz)


# ---------------------------------------------------------------- WhatsApp (text summary only)

def test_recipients_vendors_are_listed_but_not_selectable_and_never_a_number(app):
    c, db = app["c"], app["db"]
    add_vendor(db)
    r = c.get(f"{API}/report/recipients").json()
    assert r["vendors"] == [{"id": "v1", "name": "קירור הצפון", "company": 'קירור הצפון בע"מ', "has_phone": True, "selectable": False, "reason": "coming_later"}]
    assert r["send_hours"] == {"from": "07:00", "to": "21:00"} and r["attachment"] == "none"
    assert next(u for u in r["users"] if u["id"] == joni(db))["reach"] == "no_address"  # warned, still selectable
    assert "972" not in json.dumps(r) and "555" not in json.dumps(r)
    body = {"units": [app["u1"]], "range": "24h", "recipients": [{"kind": "vendor", "id": "v1"}]}
    rr = c.post(f"{API}/report/send", json=body)
    assert rr.status_code == 422 and rr.json()["code"] == "vendor_coming_later"


def test_send_inside_the_hours_reaches_an_opted_in_user_with_the_summary(app):
    c, db, fake = app["c"], app["db"], app["fake"]
    uid = ready_whatsapp(app)
    r = c.post(f"{API}/report/send", json={"units": [app["u1"]], "range": "24h", "recipients": [{"kind": "user", "id": uid}]})
    assert r.status_code == 202 and r.json()["queued"] == 1 and r.json()["sends"][0]["status"] == "queued"
    out = twa.process(db, T0 + 3600)
    assert out["sent"] == 1
    text = " | ".join(fake.sent_texts())
    assert "דוח טמפרטורות" in text and "מקרר מטבח" in text
    batch = r.json()["batch_id"]
    assert c.get(f"{API}/report/sends/{batch}").json()["sends"][0]["status"] == "sent"
    with db.connection(mode="read") as conn:
        row = conn.execute("SELECT * FROM infra_temp_report_sends").fetchone()
        assert "972" not in json.dumps(dict(row)) and "מקרר" not in row["request_json"]  # the request, never the text or a number
        assert all("972" not in str(dict(a)) for a in conn.execute("SELECT * FROM audit_log WHERE action LIKE 'infra.temperature.report%'").fetchall())


def test_outside_the_send_hours_the_summary_waits_for_the_next_opening(app):
    c, db = app["c"], app["db"]
    uid = ready_whatsapp(app)
    app["clock"]["ts"] = NIGHT
    c.post(f"{API}/report/send", json={"units": [app["u1"]], "range": "24h", "recipients": [{"kind": "user", "id": uid}]})
    out = twa.process(db, NIGHT)
    assert out["held"] == 1 and out["sent"] == 0
    with db.connection(mode="read") as conn:
        row = conn.execute("SELECT status, reason, not_before FROM infra_temp_report_sends").fetchone()
    assert row["status"] == "held" and row["reason"] == "send_hours" and row["not_before"] == "2026-10-20T04:00:00Z"  # 07:00 local
    assert twa.process(db, NIGHT + 600)["sent"] == 0  # still before the opening
    assert twa.process(db, dt.datetime(2026, 10, 20, 4, 1, tzinfo=UTC).timestamp())["sent"] == 1


def test_no_number_or_no_consent_or_no_scope_is_skipped_with_the_reason(app):
    c, db, settings = app["c"], app["db"], app["settings"]
    bind(c, settings, "kio", "kiosk", "installation", "*")
    uid_k = ready_whatsapp(app, "kio")  # opted in, but a kiosk has no devices.read
    c.get("/api/v1/me", headers=as_user("nophone"))
    with db.connection(mode="read") as conn:
        nophone = conn.execute("SELECT id FROM users WHERE username = 'nophone'").fetchone()[0]
    r = c.post(f"{API}/report/send", json={"units": [app["u1"]], "range": "24h", "recipients": [{"kind": "user", "id": uid_k}, {"kind": "user", "id": nophone}]})
    assert r.status_code == 202
    twa.process(db, T0 + 3600)
    sends = {s["name"]: (s["status"], s["reason"]) for s in c.get(f"{API}/report/sends/{r.json()['batch_id']}").json()["sends"]}
    assert ("skipped", "no_reach") in sends.values() and ("skipped", "no_address") in sends.values()


def test_send_and_schedules_need_the_manage_permission(app):
    c, settings = app["c"], app["settings"]
    bind(c, settings, "ops", "operator", "installation", "*")
    h = as_user("ops")
    assert c.get(f"{API}/report/recipients", headers=h).status_code == 403
    assert c.post(f"{API}/report/send", json={"units": [app["u1"]], "recipients": [{"kind": "user", "id": "x"}]}, headers=h).status_code == 403
    assert c.get(f"{API}/report/preview?units={app['u1']}", headers=h).status_code == 200  # the PDF / preview: whoever sees the unit


def test_a_weekly_schedule_queues_at_its_time_and_moves_on(app):
    c, db = app["c"], app["db"]
    uid = ready_whatsapp(app)
    body = {"units": [app["u1"], app["u2"]], "range": "prev_week", "freq": "weekly", "dow": 1, "at": "08:30", "recipients": [{"kind": "user", "id": uid}]}
    assert c.post(f"{API}/report/schedules", json={**body, "dow": 9}).status_code == 422
    assert c.post(f"{API}/report/schedules", json={**body, "recipients": [{"kind": "vendor", "id": "v1"}]}).json()["code"] == "vendor_coming_later"
    s = c.post(f"{API}/report/schedules", json=body).json()
    assert s["next_run_at"] == "2026-10-26T06:30:00Z"  # the clock is Monday 19.10 11:00 local: the next Monday 08:30 (winter time from 25.10)
    assert s["freq"] == "weekly" and s["recipients"] == [{"kind": "user", "id": uid}]
    out = twa.process(db, dt.datetime(2026, 10, 26, 6, 31, tzinfo=UTC).timestamp())
    assert out["scheduled"] == 1 and out["sent"] == 1
    nxt = c.get(f"{API}/report/schedules").json()["schedules"][0]["next_run_at"]
    assert nxt == "2026-11-02T06:30:00Z"  # the next Monday 08:30 local (winter time)
    assert c.delete(f"{API}/report/schedules/{s['id']}").status_code == 204


def test_next_run_daily_monthly():
    from zoneinfo import ZoneInfo

    tz = ZoneInfo("Asia/Jerusalem")
    after = dt.datetime(2026, 10, 19, 9, 0, tzinfo=tz).timestamp()
    assert dt.datetime.fromtimestamp(twa.next_run({"freq": "daily", "at": "08:30"}, after, tz), tz) == dt.datetime(2026, 10, 20, 8, 30, tzinfo=tz)
    assert dt.datetime.fromtimestamp(twa.next_run({"freq": "monthly", "at": "08:30", "dom": 1}, after, tz), tz) == dt.datetime(2026, 11, 1, 8, 30, tzinfo=tz)


def test_attachment_seam_is_off_and_the_setting_accepts_none_only(app):
    c, db = app["c"], app["db"]
    with db.connection(mode="read") as conn:
        assert twa.attachment_for(conn, {}, {}) is None
    assert c.put(f"{API}/settings", json={"rules": {"report_attachment": "pdf"}}).status_code == 422
    assert c.put(f"{API}/settings", json={"rules": {"report_attachment": "none"}}).status_code == 200


# ---------------------------------------------------------------- the phase-2 settings: alerts on, warnings-only holds (all configurable)

def test_holds_are_settings():
    base = {"alerts_enabled": True, "quiet_includes_alarms": False, "mute_includes_alarms": False}
    assert rt.holds(base, quiet=True, muted=False) == ("quiet", None)
    assert rt.holds(base, quiet=False, muted=True) == ("mute", None)
    assert rt.holds({**base, "quiet_includes_alarms": True}, quiet=True, muted=False) == ("quiet", "quiet")
    assert rt.holds({**base, "mute_includes_alarms": True}, quiet=False, muted=True) == ("mute", "mute")
    assert rt.holds({**base, "alerts_enabled": False}, quiet=False, muted=False) == ("off", "off")
    assert rt.holds(base, quiet=False, muted=False) == (None, None)


def test_a_unit_with_alerts_off_logs_but_does_not_notify(app):
    c, db = app["c"], app["db"]
    u2 = app["u2"]
    c.put(f"{API}/{u2}", json={"name": "מקפיא", "temp_entity_id": "sensor.freezer_temp", "low": -22, "high": -16, "defrost_mode": "none",
                               "rules": {"alerts_enabled": False, "high_alarm_min": 1}})
    with db.connection() as conn:
        conn.execute("UPDATE ha_entities SET state = '-10' WHERE entity_id = 'sensor.freezer_temp'")
        rt.evaluate(conn, T0 + 600, connected=True)
        rt.evaluate(conn, T0 + 700, connected=True)
        ev = conn.execute("SELECT * FROM infra_temp_events WHERE unit_id = ? AND kind = 'high'", (u2,)).fetchone()
        n = conn.execute("SELECT COUNT(*) FROM notifications WHERE subject_id = ?", (u2,)).fetchone()[0]
    assert ev["severity"] == "alarm" and ev["suppressed"] == "off" and n == 0
