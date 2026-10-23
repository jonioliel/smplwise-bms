"""CR-INSIGHT215 slice 3: generator run counts / hours in the building report (owner answers 262 and 26) and the scheduled monthly delivery
(owner: sent only after setup and after an explicit enable).

Negative first: the delivery is OFF by default and a switched-off report part is the uniform 404; turning the delivery on needs a complete setup
(422 `setup_incomplete` naming what is missing) and system.configure as well; a month before the enable moment is never sent; a recipient who may
not read the report is sent nothing. Then the run recorder (open, keep, close, blip, a silent mirror, a run across two months) and the report
sections by permission. Fakes only: no Home Assistant, no mail server, no WhatsApp provider, no network."""
from __future__ import annotations

import datetime as dt
import json
from types import SimpleNamespace

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from insight215_fixtures import API, NOW, audit_rows, entity, switch

from smplwise.db import Database, now_iso
from smplwise.services import insights_access as access
from smplwise.services import insights_common as ic
from smplwise.services import insights_delivery as dl
from smplwise.services import insights_generator as ig

UTC = dt.timezone.utc
GEN = "g1"


def ts(y, mo, d, h=0, mi=0) -> float:
    return dt.datetime(y, mo, d, h, mi, tzinfo=UTC).timestamp()


@pytest.fixture()
def w(settings, monkeypatch):
    from smplwise.main import create_app
    from smplwise.routers import insights as ir

    monkeypatch.setattr(ir, "now_ts", lambda: NOW)
    dl.reset()
    c = TestClient(create_app(settings))
    c.get(f"{API}/me")
    return {"c": c, "db": Database(settings.db_path), "settings": settings}


def seed_generator(conn, state="stopped", hours: float | None = None) -> None:
    conn.execute("""INSERT INTO generator_devices(id, name, source_kind, source_device_ref, status, detected_at)
                    VALUES (?, 'גנרטור ראשי', 'manual', 'dev-ref', 'detected', ?)""", (GEN, now_iso()))
    entity(conn, "sensor.gen_state", "מצב מנוע", state=state)
    conn.execute("INSERT INTO generator_roles(device_id, role, entity_ref) VALUES (?, 'engine_state', 'sensor.gen_state')", (GEN,))
    if hours is not None:
        entity(conn, "sensor.gen_hours", "שעות עבודה", state=str(hours))
        conn.execute("INSERT INTO generator_roles(device_id, role, entity_ref) VALUES (?, 'run_hours', 'sensor.gen_hours')", (GEN,))


def set_state(conn, state: str, hours: float | None = None) -> None:
    conn.execute("UPDATE ha_entities SET state = ? WHERE entity_id = 'sensor.gen_state'", (state,))
    if hours is not None:
        conn.execute("UPDATE ha_entities SET state = ? WHERE entity_id = 'sensor.gen_hours'", (str(hours),))


# ---------------------------------------------------------------- the settings (thresholds editable)

def test_new_settings_have_defaults_and_bounds(w):
    c = w["c"]
    doc = c.get(f"{API}/insights/settings").json()["settings"]
    assert doc["generator"] == {"min_run_s": 60} and doc["report"]["generator_runs"] == "report_readers"
    for bad in ({"generator": {"min_run_s": 3601}}, {"generator": {"min_run_s": -1}}, {"generator": {"nope": 1}}, {"report": {"generator_runs": "everyone"}}):
        r = c.put(f"{API}/insights/settings", json={"settings": bad})
        assert r.status_code == 422, bad
    ok = c.put(f"{API}/insights/settings", json={"settings": {"generator": {"min_run_s": 120}, "report": {"generator_runs": "generator_viewers", "sections": ["generator"]}}})
    assert ok.status_code == 200
    saved = ok.json()["settings"]
    assert saved["generator"]["min_run_s"] == 120 and saved["report"] == {"sections": ["generator"], "generator_runs": "generator_viewers"}


# ---------------------------------------------------------------- the run recorder

def test_a_run_is_opened_kept_and_closed(w):
    with w["db"].connection() as conn:
        seed_generator(conn, hours=100.0)
        t = ts(2026, 9, 10, 8)
        assert ig.record(conn, t) == {"opened": 0, "closed": 0}  # stopped: nothing
        set_state(conn, "running", 100.0)
        assert ig.record(conn, t + 15)["opened"] == 1
        assert ig.record(conn, t + 30)["opened"] == 0  # the same run
        set_state(conn, "stopped", 101.5)
        assert ig.record(conn, t + 3600)["closed"] == 1
        rep = ig.report(conn, ts(2026, 9, 1), ts(2026, 10, 1), 60)
    d = rep["devices"][0]
    assert d["runs"] == 1 and d["meter_hours"] == 1.5 and 0.9 < d["hours"] < 1.1 and rep["runs"] == 1


def test_a_blip_below_the_threshold_is_not_counted_and_the_threshold_is_the_setting(w):
    with w["db"].connection() as conn:
        seed_generator(conn)
        t = ts(2026, 9, 10, 8)
        set_state(conn, "running")
        ig.record(conn, t)
        set_state(conn, "stopped")
        ig.record(conn, t + 20)
        lo, hi = ts(2026, 9, 1), ts(2026, 10, 1)
        assert ig.report(conn, lo, hi, 60)["runs"] == 0
        assert ig.report(conn, lo, hi, 10)["runs"] == 1


def test_a_silent_mirror_closes_the_run_at_the_last_time_seen(w):
    with w["db"].connection() as conn:
        seed_generator(conn)
        t = ts(2026, 9, 10, 8)
        set_state(conn, "running")
        ig.record(conn, t)
        ig.record(conn, t + 600)
        out = ig.record(conn, t + 600 + 3 * 3600)  # three silent hours, still "running" on return: a NEW run
        assert out == {"opened": 1, "closed": 1}
        rows = conn.execute("SELECT interrupted, ended_at FROM generator_runs ORDER BY id").fetchall()
        assert rows[0]["interrupted"] == 1 and rows[1]["ended_at"] is None
        hours = ig.report(conn, ts(2026, 9, 1), ts(2026, 10, 1), 1)["hours"]
    assert hours < 0.3  # ten minutes plus an open run of a moment: the silent hours are NOT invented


def test_a_run_across_midnight_of_the_month_counts_once_and_hours_are_clipped(w):
    with w["db"].connection() as conn:
        seed_generator(conn)
        conn.execute("INSERT INTO generator_runs(device_id, started_at, last_seen_at, ended_at) VALUES (?, '2026-09-30T22:00:00Z', '2026-10-01T02:00:00Z', '2026-10-01T02:00:00Z')", (GEN,))
        sep = ig.report(conn, ts(2026, 9, 1), ts(2026, 10, 1), 60)
        octo = ig.report(conn, ts(2026, 10, 1), ts(2026, 11, 1), 60)
    assert sep["runs"] == 1 and sep["hours"] == 2.0
    assert octo["runs"] == 0 and octo["hours"] == 2.0 and sep["hours"] + octo["hours"] == 4.0


def test_the_tick_records_runs_and_survives_a_recorder_failure(w, monkeypatch):
    from smplwise.services import generator_runtime as gr

    with w["db"].connection() as conn:
        seed_generator(conn, state="running")
    out = gr.tick(w["db"], w["settings"], ts(2026, 9, 10, 8), require_connection=False)
    assert out["runs"]["opened"] == 1
    monkeypatch.setattr(ig, "record", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")))
    out2 = gr.tick(w["db"], w["settings"], ts(2026, 9, 10, 8) + 100, require_connection=False)
    assert "runs" not in out2 and "skipped" not in out2


# ---------------------------------------------------------------- the report sections by permission

def _report(w, **q):
    switch(w["db"], ic.SW_REPORT)
    return w["c"].get(f"{API}/reports/building/preview?month=2026-09&sections=generator,summary").json()


def test_the_generator_section_carries_the_runs(w):
    with w["db"].connection() as conn:
        seed_generator(conn)
        conn.execute("INSERT INTO generator_runs(device_id, started_at, last_seen_at, ended_at, hours_start, hours_end) "
                     "VALUES (?, '2026-09-05T08:00:00Z', '2026-09-05T10:30:00Z', '2026-09-05T10:30:00Z', 10, 12.4)", (GEN,))
    m = _report(w)
    g = m["data"]["generator"]
    assert g["alerts"] is True and g["runs"]["runs"] == 1 and g["runs"]["hours"] == 2.5 and g["runs"]["devices"][0]["meter_hours"] == 2.4
    assert any("1" in x["text"] and "2.5" in x["text"] for x in m["data"]["summary"] if x["section"] == "generator")


@pytest.mark.parametrize("mode,runs_shown", [("report_readers", True), ("generator_viewers", True), ("off", False)])
def test_the_runs_follow_the_setting(w, mode, runs_shown):
    save = w["c"].put(f"{API}/insights/settings", json={"settings": {"report": {"generator_runs": mode}}})
    assert save.status_code == 200
    g = _report(w)["data"]["generator"]
    assert (g["runs"] is not None) is runs_shown


def test_who_gets_which_part_of_the_generator_section(w, monkeypatch):
    c = w["c"]
    c.put(f"{API}/insights/settings", json={"settings": {"report": {"generator_runs": "report_readers"}}})
    p = SimpleNamespace()
    seen = {"generator.view": False}
    monkeypatch.setattr(access, "authorize", lambda conn, principal, perm, scope: SimpleNamespace(allowed=seen.get(perm, True)))
    with w["db"].connection(mode="read") as conn:
        assert access.generator_parts(conn, p) == (False, True)           # a report reader without generator.view: runs only (answer 262)
        assert access.section_gate(conn, p)("generator") is None
    with w["db"].connection() as conn:
        ic.save(conn, {**ic.load(conn), "report": {"sections": list(ic.SECTIONS), "generator_runs": "generator_viewers"}})
    with w["db"].connection(mode="read") as conn:
        assert access.generator_parts(conn, p) == (False, False)
        assert access.section_gate(conn, p)("generator") == "not_permitted"
        seen["generator.view"] = True
        assert access.generator_parts(conn, p) == (True, True)
    with w["db"].connection() as conn:
        ic.save(conn, {**ic.load(conn), "report": {"sections": list(ic.SECTIONS), "generator_runs": "off"}})
    with w["db"].connection(mode="read") as conn:
        assert access.generator_parts(conn, p) == (True, False)


def test_alerts_are_hidden_when_only_the_runs_are_allowed(w, monkeypatch):
    from smplwise.services import building_report as rep

    with w["db"].connection() as conn:
        seed_generator(conn)
        d = rep.generator(conn, ts(2026, 9, 1), ts(2026, 10, 1), (False, True))
    assert d["alerts"] is False and d["devices"] == [] and d["total"] == 0 and d["runs"] is not None
    with w["db"].connection() as conn:
        assert rep.generator(conn, ts(2026, 9, 1), ts(2026, 10, 1), (True, False))["runs"] is None


# ---------------------------------------------------------------- the delivery: negative first

def put(w, body, user=None):
    return w["c"].put(f"{API}/reports/building/delivery", json=body, headers=as_user(user) if user else {})


def test_the_delivery_part_is_the_uniform_404_while_the_report_is_off(w):
    assert w["c"].get(f"{API}/reports/building/delivery").status_code == 404
    assert put(w, {"enabled": True}).status_code == 404


def test_the_delivery_is_off_by_default_and_needs_the_manage_permission(w):
    switch(w["db"], ic.SW_REPORT)
    body = w["c"].get(f"{API}/reports/building/delivery").json()
    assert body["config"]["enabled"] is False and body["config"]["enabled_at"] is None
    assert set(body["problems"]) == {"no_channel"}
    bind(w["c"], w["settings"], "otto", "operator", "installation", "*")
    assert w["c"].get(f"{API}/reports/building/delivery", headers=as_user("otto")).status_code == 403
    assert put(w, {"config": {"dom": 5}}, "otto").status_code == 403


def test_enabling_without_a_complete_setup_is_refused_with_what_is_missing(w):
    switch(w["db"], ic.SW_REPORT)
    r = put(w, {"enabled": True})
    assert r.status_code == 422 and r.json()["error"]["code"] == "setup_incomplete" and "no_channel" in r.json()["error"]["details"]["fields"]
    r = put(w, {"config": {"whatsapp": True}, "enabled": True})
    assert r.status_code == 422 and "no_recipients" in r.json()["error"]["details"]["fields"]
    r = put(w, {"config": {"email": True}, "enabled": True})
    assert r.status_code == 422 and "email_not_configured" in r.json()["error"]["details"]["fields"]
    assert w["c"].get(f"{API}/reports/building/delivery").json()["config"]["enabled"] is False
    assert not [a for a in audit_rows(w["db"], "reports.building.delivery.update") if json.loads(a["details_json"])["enabled"]]


@pytest.mark.parametrize("cfg", [{"dom": 0}, {"dom": 29}, {"dom": True}, {"at": "25:00"}, {"at": "8:00"}, {"lang": "fr"}, {"email": "yes"}, {"users": ["nobody"]}, {"nope": 1}])
def test_a_bad_setup_names_its_field(w, cfg):
    switch(w["db"], ic.SW_REPORT)
    r = put(w, {"config": cfg})
    assert r.status_code == 422 and r.json()["error"]["code"] == "validation", cfg


def test_enabling_also_needs_system_configure(w, monkeypatch):
    switch(w["db"], ic.SW_REPORT)
    monkeypatch.setattr(dl, "mail_ready", lambda conn: True)
    bind(w["c"], w["settings"], "sam", "site_admin", "installation", "*")  # insights.manage but not system.configure
    assert put(w, {"config": {"email": True}}, "sam").status_code == 200
    assert w["c"].get(f"{API}/reports/building/delivery", headers=as_user("sam")).json()["can_enable"] is False
    assert put(w, {"enabled": True}, "sam").status_code == 403
    assert w["c"].get(f"{API}/reports/building/delivery").json()["config"]["enabled"] is False
    assert put(w, {"enabled": True}).status_code == 200  # joni: a system administrator
    assert put(w, {"enabled": False}, "sam").status_code == 200  # switching OFF needs only insights.manage


# ---------------------------------------------------------------- the delivery: setup, enable, send

@pytest.fixture()
def mail(monkeypatch):
    from smplwise.services import notify_email as ne

    sent: list[tuple[str, str, str]] = []
    cfg = ne.MailConfig("smtp.test", 587, "starttls", "", "arx@test.example", ("boss@test.example", "board@test.example"), "https://arx.test", None)
    monkeypatch.setattr(ne, "load_config", lambda conn, data_dir=None: cfg)
    monkeypatch.setattr(ne, "smtp_send", lambda c, to, r, deadline=None: sent.append((to, r.subject, r.text)))
    return sent


def enable(w, **cfg):
    switch(w["db"], ic.SW_REPORT)
    body = {"email": True, "dom": 1, "at": "08:00", "lang": "he", **cfg}
    r = put(w, {"config": body, "enabled": True})
    assert r.status_code == 200, r.text
    return r.json()


def test_enabling_records_the_moment_and_the_person(w, mail):
    enable(w)
    with w["db"].connection(mode="read") as conn:
        cfg = dl.load(conn)
    assert cfg["enabled"] is True and cfg["enabled_at"] and cfg["enabled_by"]
    assert any(json.loads(a["details_json"])["enabled"] for a in audit_rows(w["db"], "reports.building.delivery.update"))
    assert not json.dumps([dict(a) for a in audit_rows(w["db"], "reports.building.delivery.update")]).count("@")  # no address in the audit


def test_nothing_is_sent_before_the_send_time_or_for_a_month_that_ended_before_the_enable(w, mail):
    enable(w)
    with w["db"].connection() as conn:
        enabled_at = ic.ts_of(dl.load(conn)["enabled_at"])
    # the enable happened "now" (wall clock); a pass at a moment BEFORE it, or before 08:00 of the 1st, plans nothing
    assert dl.process(w["db"], enabled_at - 40 * 86400)["planned"] == 0
    assert mail == []
    with w["db"].connection(mode="read") as conn:
        assert dl.due(conn, ts(2026, 10, 1, 4, 0)) is None  # 07:00 local on the 1st: before the send time, and before enabled_at anyway


def _fake_enabled_at(w, when: str) -> None:
    with w["db"].connection() as conn:
        cfg = dl.load(conn)
        cfg["enabled_at"] = when
        ic.set_setting(conn, dl.CONFIG_KEY, json.dumps(cfg))


def test_the_month_goes_out_once_to_every_configured_address(w, mail):
    enable(w)
    _fake_enabled_at(w, "2026-09-15T00:00:00Z")
    now = ts(2026, 10, 1, 6, 0)  # 09:00 local, after the 08:00 send time
    out = dl.process(w["db"], now)
    assert out["planned"] == 2 and out["sent"] == 2 and sorted(m[0] for m in mail) == ["board@test.example", "boss@test.example"]
    assert "2026-09" in mail[0][1]
    again = dl.process(w["db"], now + 120)
    assert again["planned"] == 0 and again["sent"] == 0 and len(mail) == 2
    with w["db"].connection(mode="read") as conn:
        assert dl.due(conn, now + 5 * 86400) is None  # planned: not again this month
        rows = conn.execute("SELECT month, channel, status, recipient_key FROM insights_report_sends").fetchall()
        assert {r["status"] for r in rows} == {"sent"} and all("@" not in r["recipient_key"] for r in rows)
    # the next month, a month later, goes out again
    nxt = dl.process(w["db"], ts(2026, 11, 1, 6, 0))
    assert nxt["planned"] == 2 and len(mail) == 4


def test_a_report_switched_off_after_the_plan_sends_nothing(w, mail):
    enable(w)
    _fake_enabled_at(w, "2026-09-15T00:00:00Z")
    now = ts(2026, 10, 1, 6, 0)
    dl.process(w["db"], now)
    with w["db"].connection() as conn:
        conn.execute("UPDATE insights_report_sends SET status = 'queued', finished_at = NULL")
    switch(w["db"], ic.SW_REPORT, False)
    before = len(mail)
    assert dl.process(w["db"], now + 60)["sent"] == 0 and len(mail) == before


def test_a_transient_mail_failure_is_retried_then_a_permanent_one_fails(w, mail, monkeypatch):
    from smplwise.services import notify_email as ne

    enable(w)
    _fake_enabled_at(w, "2026-09-15T00:00:00Z")
    calls = {"n": 0}

    def flaky(c, to, r, deadline=None):
        calls["n"] += 1
        raise ne.MailError("connect", True)

    monkeypatch.setattr(ne, "smtp_send", flaky)
    now = ts(2026, 10, 1, 6, 0)
    out = dl.process(w["db"], now)
    assert out["retry"] == 2 and out["sent"] == 0
    for i in range(1, 6):
        dl.process(w["db"], now + i * 3600)
    with w["db"].connection(mode="read") as conn:
        rows = conn.execute("SELECT status, attempts, reason FROM insights_report_sends").fetchall()
    assert {r["status"] for r in rows} == {"failed"} and all(r["attempts"] == dl.MAX_ATTEMPTS and r["reason"] == "connect" for r in rows)


def test_the_whatsapp_text_goes_only_to_a_consenting_user_who_may_read_the_report(w, monkeypatch):
    from smplwise.services import notify_whatsapp as nw

    switch(w["db"], ic.SW_REPORT)
    bind(w["c"], w["settings"], "sam", "site_admin", "installation", "*")
    bind(w["c"], w["settings"], "otto", "operator", "installation", "*")
    with w["db"].connection(mode="read") as conn:
        ids = {r["username"]: r["id"] for r in conn.execute("SELECT id, username FROM users").fetchall()}
    consent = {ids["sam"]: "granted", ids["otto"]: "granted"}
    monkeypatch.setattr(nw, "raw_number", lambda conn, uid: SimpleNamespace(digits="972500000000") if uid in consent else None)
    monkeypatch.setattr(nw, "resolve_number", lambda conn, uid: SimpleNamespace(digits="972500000000", consent=consent.get(uid, "none")) if uid in consent else None)
    texts: list[str] = []
    monkeypatch.setattr(dl, "_send_whatsapp", lambda db, row, digits, text, now: (texts.append(text) or ("sent", None)))
    r = put(w, {"config": {"whatsapp": True, "users": [ids["sam"], ids["otto"]], "dom": 1, "at": "08:00"}, "enabled": True})
    assert r.status_code == 200, r.text
    reach = {x["name"]: x["reach"] for x in r.json()["recipients"]}
    assert reach.get("otto") == "no_permission"
    _fake_enabled_at(w, "2026-09-15T00:00:00Z")
    out = dl.process(w["db"], ts(2026, 10, 1, 6, 0))
    assert out["planned"] == 2 and out["sent"] + out["skipped"] == 2
    with w["db"].connection(mode="read") as conn:
        got = {r["user_id"]: (r["status"], r["reason"]) for r in conn.execute("SELECT user_id, status, reason FROM insights_report_sends").fetchall()}
    assert got[ids["otto"]] == ("skipped", "not_permitted")
    if got[ids["sam"]][0] == "sent":
        assert len(texts) == 1 and "2026-09" in texts[0] and "@" not in texts[0]


def test_whatsapp_waits_for_the_send_hours(w, monkeypatch):
    from smplwise.services import notify_whatsapp as nw

    switch(w["db"], ic.SW_REPORT)
    with w["db"].connection(mode="read") as conn:
        uid = conn.execute("SELECT id FROM users LIMIT 1").fetchone()["id"]
    monkeypatch.setattr(nw, "raw_number", lambda conn, u: SimpleNamespace(digits="972500000000"))
    monkeypatch.setattr(nw, "resolve_number", lambda conn, u: SimpleNamespace(digits="972500000000", consent="granted"))
    sent: list[str] = []
    monkeypatch.setattr(dl, "_send_whatsapp", lambda db, row, digits, text, now: (sent.append(text) or ("sent", None)))
    assert put(w, {"config": {"whatsapp": True, "users": [uid], "at": "04:00"}, "enabled": True}).status_code == 200
    _fake_enabled_at(w, "2026-09-15T00:00:00Z")
    out = dl.process(w["db"], ts(2026, 10, 1, 2, 0))  # 05:00 local: after the send time, before the 07:00 opening
    assert out["held"] == 1 and sent == []
    with w["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT status, reason FROM insights_report_sends").fetchone()["reason"] == "send_hours"
    out = dl.process(w["db"], ts(2026, 10, 1, 6, 0))
    assert out["sent"] == 1 and len(sent) == 1


def test_an_edit_that_would_leave_an_enabled_delivery_without_a_channel_is_refused(w, mail):
    enable(w)
    r = put(w, {"config": {"email": False}})
    assert r.status_code == 422 and r.json()["error"]["code"] == "setup_incomplete"
    assert w["c"].get(f"{API}/reports/building/delivery").json()["config"]["email"] is True
    off = put(w, {"enabled": False})
    assert off.status_code == 200 and off.json()["config"]["enabled"] is False
    assert put(w, {"config": {"email": False}}).status_code == 200


def test_the_janitor_is_throttled_and_idle_when_off(w):
    assert dl.janitor(w["db"], w["settings"], 1000.0) is None  # not enabled: nothing
    assert dl.janitor(w["db"], w["settings"], 1010.0) is None  # throttled
    with w["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM insights_report_sends").fetchone()[0] == 0


def test_the_text_builders_are_clean(w):
    model = {"lang": "he", "month": "2026-09", "data": {"summary": [{"section": "tickets", "title": "בקשות שירות", "text": "3 נפתחו https://evil.example"}]}}
    t = dl.whatsapp_text(model)
    assert "evil.example" not in t and "2026-09" in t and len(t) <= 700
    mail = dl.email_message(model, "https://arx.test")
    assert mail.subject.endswith("2026-09") and "בקשות שירות" in mail.html and "arx.test" in mail.html
