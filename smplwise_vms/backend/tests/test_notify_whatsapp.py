"""NOTIFWA: the `whatsapp` notification channel (services/notify_whatsapp.py, routers/notify_whatsapp.py) on the tickets module's
WhatsApp infrastructure - the master switch (off by default), the account use, the number resolver and consent, quiet hours,
de-duplication, the per-user cap, the account pacing over the shared ledger, the outcome rules (retry / unknown / refused), the
texts (he / ar / ru, lock-screen level, value hygiene), content-free audit and logs, the own-number test and the own opt-out.
Fakes only: the fake `ha-whatsapp` transport (tests/fake_ha_whatsapp.py), no Home Assistant, no phone, no network."""
from __future__ import annotations

import datetime as dt
import json
import logging

import pytest
from conftest import as_user, bind
from fake_ha_whatsapp import FakeHaWhatsapp, PairedAccount
from fastapi.testclient import TestClient

from smplwise.db import now_iso
from smplwise.main import create_app
from smplwise.services import backup, notify, notify_channels
from smplwise.services import messaging_accounts as ma
from smplwise.services import messaging_runtime as mr
from smplwise.services import notify_whatsapp as wa
from smplwise.services import push as push_svc

API = "/api/v1"
ENTRY = "01JFAKEENTRYA"
KEY = f"entry:{ENTRY}"
PHONE = "+972 50-555-0191"          # a fake number (formatted as a person would type it)
DIGITS = "972505550191"
SECOND_PHONE = "972505550277"


@pytest.fixture(autouse=True)
def _state(monkeypatch):
    wa.reset_state()
    push_svc.reset_limits()
    monkeypatch.setattr(mr, "ws_connected", lambda: True)
    monkeypatch.setattr(wa, "RETRY_DELAYS_S", (3600.0, 3600.0, 3600.0))  # a retry waits until the test makes it due (World.tick)
    yield
    wa.reset_state()


class World:
    def __init__(self, settings, monkeypatch, *, connected: bool = True) -> None:
        self.settings = settings
        self.app = create_app(settings)
        self.c = TestClient(self.app)
        assert self.c.get(f"{API}/me").status_code == 200
        assert self.c.put(f"{API}/notify/settings", json={"quiet": {"enabled": False}}).status_code == 200
        self.fake = FakeHaWhatsapp([PairedAccount(ENTRY, "15555550191", connected=connected)])
        monkeypatch.setattr(wa, "TRANSPORT", self.fake)
        self.notifier = push_svc.PushNotifier()
        self.notifier.db = self.db
        self.joni = self.user_id("joni")
        self._n = 0
        now = now_iso()
        with self.db.connection() as conn:
            for r in self.fake.mirror_rows():
                conn.execute("INSERT INTO ha_entities(entity_id, unique_id, platform, config_entry_id, domain, device_class, state, available, disabled, name, first_seen_at, updated_at) "
                             "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)",
                             (r.entity_id, r.unique_id, r.platform, r.config_entry_id, r.domain, r.device_class, r.state, int(r.available), int(r.disabled), now, now))

    @property
    def db(self):
        return self.app.state.db

    def user_id(self, username: str) -> str:
        self.c.get(f"{API}/me", headers=as_user(username))
        with self.db.connection(mode="read") as conn:
            return conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()[0]

    # -- set-up
    def map_account(self, use: str | None = KEY) -> None:
        with self.db.connection() as conn:
            mr.store_doc(conn, ma.MappingDoc(1, (ma.Account(KEY, "discovered", label="משרד"),), {wa.USE_KEY: use} if use else {}))

    def contact(self, user_id: str, phone: str = PHONE, *, lang: str = "he", preferred: str = "whatsapp", name: str = "יוני") -> None:
        now = now_iso()
        with self.db.connection() as conn:
            conn.execute("INSERT INTO ticket_contacts(id, kind, user_id, display_name, phone_e164, preferred_channel, lang, created_by, created_at, updated_at) "
                         "VALUES (?, 'person', ?, ?, ?, ?, ?, 'test', ?, ?)", (f"c-{user_id}"[:40], user_id, name, phone, preferred, lang, now, now))

    def switch(self, on: bool = True, **more):
        r = self.c.put(f"{API}/notify/whatsapp", json={"enabled": on, **more})
        assert r.status_code == 200, r.text
        return r.json()

    def policy(self, source: str = "backup.failed", users: list[str] | None = None, **channels):
        body = {"recipients": {"rule": "users", "user_ids": users or [self.joni]}, "channels": {"inbox": True, "whatsapp": True, **channels}}
        r = self.c.put(f"{API}/notify/policies/{source}", json=body)
        assert r.status_code == 200, r.text

    def ready(self, **switch) -> None:
        self.map_account()
        self.contact(self.joni)
        self.switch(True, **switch)
        self.policy()

    # -- emitting and flushing
    def emit(self, source: str = "backup.failed", severity: str | None = None, place: str | None = None, **params) -> str:
        self._n += 1
        with self.db.connection() as conn:
            return notify.emit_full(conn, notify.Signal(source, "system", "backup", severity=severity, dedupe_key=f"{source}:{self._n}", place=place, params=params)).id

    @property
    def worker(self) -> wa.Worker:
        return wa.worker_for(self.db)

    def outbox(self) -> int:
        n = notify_channels.process_outbox(self.notifier)
        assert self.worker.drain(20), "the whatsapp worker did not settle"
        return n

    def tick(self) -> None:
        self.worker.make_due()
        assert self.worker.drain(20), "the whatsapp worker did not settle"

    def dispatch(self, nid: str, mode: str, **item) -> None:
        notify_channels.dispatch(self.notifier, nid, {"mode": mode, **item})
        assert self.worker.drain(20)

    def rows(self, nid: str | None = None) -> list[dict]:
        with self.db.connection(mode="read") as conn:
            sql = "SELECT * FROM notification_deliveries WHERE channel = 'whatsapp'" + (" AND notification_id = ?" if nid else "") + " ORDER BY rowid"
            return [dict(r) for r in conn.execute(sql, (nid,) if nid else ()).fetchall()]

    def audits(self, action: str = "notify.whatsapp.send") -> list[dict]:
        with self.db.connection(mode="read") as conn:
            return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()]

    def age_ledger(self) -> None:
        """Every ledger row an hour and a day old: the account's gap and hourly windows are free again."""
        with self.db.connection() as conn:
            conn.execute("UPDATE messaging_send_ledger SET at = '2000-01-01T00:00:00.000Z'")


@pytest.fixture()
def w(settings, monkeypatch):
    return World(settings, monkeypatch)


# ---------------------------------------------------------------- the switch, the reserved answer, the policy

def test_master_switch_is_off_by_default_and_nothing_is_sent(w):
    v = w.c.get(f"{API}/notify/whatsapp").json()
    assert v["enabled"] is False and v["per_user_hour"] == 4 and v["dedupe_min"] == 30 and v["account"]["mapped"] is False
    w.map_account()
    w.contact(w.joni)
    w.policy()  # the policy may pick WhatsApp while the switch is off ...
    nid = w.emit()
    w.outbox()
    assert [(r["status"], r["reason"], r["user_id"]) for r in w.rows(nid)] == [("skipped", "channel_unavailable", None)]
    assert w.fake.calls == []  # ... nothing is called


def test_whatsapp_is_no_longer_reserved_but_ha_mobile_is(w):
    p = w.c.get(f"{API}/notify/policies/sensor.leak").json()
    assert p["channels"]["whatsapp"] is False  # never on by default
    assert all(x["channels"]["whatsapp"] is False for x in w.c.get(f"{API}/notify/policies").json()["policies"])
    r = w.c.put(f"{API}/notify/policies/sensor.leak", json={"channels": {"inbox": True, "whatsapp": True}})
    assert r.status_code == 200 and r.json()["channels"]["whatsapp"] is True
    r = w.c.put(f"{API}/notify/policies/sensor.leak", json={"channels": {"ha_mobile": True}})
    assert r.status_code == 422 and r.json()["code"] == "channel_reserved"
    assert w.c.put(f"{API}/notify/policies/sensor.leak", json={"channels": {"whatsapp": "true"}}).status_code == 422  # real booleans only


def test_unmapped_use_is_channel_unavailable(w):
    w.contact(w.joni)
    w.switch(True)
    w.policy()
    nid = w.emit()
    w.outbox()
    assert [(r["status"], r["reason"]) for r in w.rows(nid)] == [("skipped", "channel_unavailable")]
    assert w.fake.calls == []


def test_the_use_appears_in_the_account_mapping_screen(w):
    v = w.c.get(f"{API}/messaging/whatsapp").json()
    use = next(u for u in v["uses"] if u["key"] == wa.USE_KEY)
    assert use["module"] == "notifications" and use["label"] == "התראות המערכת" and use["required"] is False
    r = w.c.put(f"{API}/messaging/whatsapp", json={"revision": v["revision"], "accounts": [], "uses": {wa.USE_KEY: KEY}})
    assert r.status_code == 200, r.text
    assert w.c.get(f"{API}/notify/whatsapp").json()["account"] == {"mapped": True, "label": "וואטסאפ 01JFAK", "state": "connected"}


# ---------------------------------------------------------------- the happy path and what is kept

def test_sends_to_the_users_own_number_with_a_content_free_trail(w, caplog):
    w.ready()
    caplog.set_level(logging.DEBUG)
    nid = w.emit(place="חדר שרתים")
    w.outbox()
    rows = w.rows(nid)
    assert [(r["status"], r["user_id"], r["target_ref"], r["attempt"]) for r in rows] == [("sent", w.joni, "····91", 1)]
    assert len(w.fake.calls) == 1
    call = w.fake.calls[0]
    assert (call["domain"], call["service"], call["data"]["account"], call["data"]["target"]) == ("whatsapp", "send_message", ENTRY, DIGITS)
    text = call["data"]["message"]
    assert text.startswith("Arx · התראה") and "הגיבוי נכשל" in text and "חדר שרתים" in text and "אין להשיב" in text
    # the audit row: ids, outcome and the account KEY - never the number or the text
    a = w.audits()
    assert len(a) == 1 and a[0]["decision"] == "allowed" and a[0]["resource_id"] == nid
    details = json.loads(a[0]["details_json"])
    assert details["outcome"] == "sent" and details["account"] == KEY and details["delivery_id"] == rows[0]["id"]
    blob = json.dumps(a) + caplog.text
    for secret in (DIGITS, DIGITS[-7:], "חדר שרתים", "הגיבוי נכשל"):
        assert secret not in blob, secret
    # the shared ledger: a keyed recipient, never the number; counted against the account like a ticket message
    with w.db.connection(mode="read") as conn:
        led = [dict(r) for r in conn.execute("SELECT * FROM messaging_send_ledger").fetchall()]
    assert len(led) == 1 and led[0]["use_key"] == wa.USE_KEY and led[0]["account_key"] == KEY and led[0]["kind"] == "message"
    assert DIGITS not in json.dumps(led)


def test_no_number_means_no_row_and_no_call(w):
    w.map_account()
    w.switch(True)
    w.policy()
    nid = w.emit()
    w.outbox()
    assert w.rows(nid) == [] and w.fake.calls == []
    assert w.c.get(f"{API}/notify/whatsapp").json()["reachable_users"] == 0


def test_an_erased_or_inactive_contact_is_not_a_number(w):
    w.ready()
    with w.db.connection() as conn:
        conn.execute("UPDATE ticket_contacts SET erased_at = ?", (now_iso(),))
    nid = w.emit()
    w.outbox()
    assert w.rows(nid) == [] and w.fake.calls == []


# ---------------------------------------------------------------- consent and the own opt-out

def test_consent_follows_the_contacts_preferred_channel(w):
    w.map_account()
    w.contact(w.joni, preferred="email")
    w.switch(True)
    w.policy()
    nid = w.emit()
    w.outbox()
    assert [(r["status"], r["reason"]) for r in w.rows(nid)] == [("skipped", "no_consent")]
    assert w.fake.calls == []


def test_own_opt_out_stops_and_allows_again(w):
    w.ready()
    me = w.c.get(f"{API}/me/notify-whatsapp").json()
    assert me == {"channel_enabled": True, "has_number": True, "masked": "····91", "source": "directory", "consent": "granted", "opted_out": False}
    r = w.c.put(f"{API}/me/notify-whatsapp", json={"opted_out": True})
    assert r.status_code == 200 and r.json()["opted_out"] is True
    nid = w.emit()
    w.outbox()
    assert [(r["status"], r["reason"]) for r in w.rows(nid)] == [("skipped", "no_consent")]
    assert w.audits("notify.whatsapp.optout")[-1]["resource_id"] == w.joni
    assert w.c.put(f"{API}/me/notify-whatsapp", json={"opted_out": "yes"}).status_code == 422
    assert w.c.put(f"{API}/me/notify-whatsapp", json={"opted_out": False, "phone": "1"}).status_code == 422  # no other field, never a number
    w.c.put(f"{API}/me/notify-whatsapp", json={"opted_out": False})
    nid2 = w.emit()
    w.outbox()
    assert [r["status"] for r in w.rows(nid2)] == ["sent"]


def test_a_user_sees_only_their_own_masked_number(w):
    w.ready()
    vera = w.user_id("vera")
    w.contact(vera, SECOND_PHONE, name="ורה")
    mine = w.c.get(f"{API}/me/notify-whatsapp", headers=as_user("vera")).json()
    assert mine["masked"] == "····77"
    assert w.c.get(f"{API}/notify/whatsapp", headers=as_user("vera")).status_code == 403  # the admin view is notify.manage only
    assert w.c.put(f"{API}/notify/whatsapp", json={"enabled": False}, headers=as_user("vera")).status_code == 403


def test_opt_out_after_planning_is_honoured_before_the_send(w):
    w.ready()
    nid = w.emit()
    orig = w.worker.submit  # the job is planned; the user opts out before the worker reaches it

    def late_opt_out(jobs):
        with w.db.connection() as conn:
            wa.set_opt_out(conn, w.joni, True)
        return orig(jobs)

    w.worker.submit = late_opt_out  # type: ignore[method-assign]
    w.outbox()
    assert [(r["status"], r["reason"]) for r in w.rows(nid)] == [("skipped", "no_consent")]
    assert w.fake.calls == []


# ---------------------------------------------------------------- quiet hours, de-duplication, the per-user cap

def test_quiet_hours_hold_non_critical_and_pass_critical(w, monkeypatch):
    w.ready()
    w.c.put(f"{API}/notify/settings", json={"quiet": {"enabled": True, "from": "00:00", "to": "23:59", "days": ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]}})
    nid = w.emit(severity="alert")
    w.outbox()
    assert [(r["status"], r["reason"]) for r in w.rows(nid)] == [("skipped", "quiet_hours")]
    crit = w.emit(severity="critical")
    w.outbox()
    assert [r["status"] for r in w.rows(crit)] == ["sent"]  # the pass-through matrix: critical x whatsapp is on by default
    s = w.c.get(f"{API}/notify/settings").json()
    assert s["pass_through"]["critical"]["whatsapp"] is True and s["pass_through"]["alert"]["whatsapp"] is False
    r = w.c.put(f"{API}/notify/settings", json={"pass_through": {"critical": {"whatsapp": False}}})
    assert r.status_code == 200 and r.json()["pass_through"]["critical"]["whatsapp"] is False


def test_renotify_inside_the_window_is_deduplicated(w):
    w.ready()
    nid = w.emit()
    w.outbox()
    w.dispatch(nid, "renotify")
    assert [(r["status"], r["reason"], r["mode"]) for r in w.rows(nid)] == [("sent", None, "new"), ("skipped", "deduped", "renotify")]
    assert len(w.fake.calls) == 1


def test_escalation_bypasses_dedupe_and_the_cap(w):
    w.ready(per_user_hour=1)
    nid = w.emit(severity="critical")
    w.outbox()
    w.age_ledger()
    w.dispatch(nid, "escalate", users=[w.joni])
    assert [(r["status"], r["mode"]) for r in w.rows(nid)] == [("sent", "new"), ("sent", "escalate")]
    assert "עדיין לא אושר" in w.fake.calls[-1]["data"]["message"]


def test_per_user_hourly_cap_applies_to_non_critical_only(w):
    w.ready(per_user_hour=1)
    first = w.emit(severity="alert")
    w.outbox()
    second = w.emit(severity="alert")
    w.outbox()
    assert [r["status"] for r in w.rows(first)] == ["sent"]
    assert [(r["status"], r["reason"]) for r in w.rows(second)] == [("skipped", "rate_limited")]
    w.age_ledger()
    crit = w.emit(severity="critical")
    w.outbox()
    assert [r["status"] for r in w.rows(crit)] == ["sent"]


def test_resolve_notice_only_to_whom_whatsapp_reached(w):
    w.ready()
    vera = w.user_id("vera")
    bind(w.c, w.settings, "vera", "system_admin", "installation", "*")
    w.contact(vera, SECOND_PHONE, preferred="email", name="ורה")  # reachable number, but no consent: never reached
    w.policy(users=[w.joni, vera])
    nid = w.emit()
    w.outbox()
    w.age_ledger()
    w.dispatch(nid, "resolved", text="גיבוי הצליח")
    sent = [(r["user_id"], r["mode"]) for r in w.rows(nid) if r["status"] == "sent"]
    assert sent == [(w.joni, "new"), (w.joni, "resolved")]
    assert "Arx · הסתיים" in w.fake.calls[-1]["data"]["message"]


# ---------------------------------------------------------------- pacing and outcomes

def test_account_pacing_holds_the_second_message_until_the_ledger_frees(w):
    w.ready()
    a = w.emit()
    w.outbox()
    b = w.emit()
    w.outbox()
    assert [r["status"] for r in w.rows(a)] == ["sent"]
    assert [(r["status"], r["reason"]) for r in w.rows(b)] == [("retry", "rate_limited")]  # the 15 s gap of the account
    assert len(w.fake.calls) == 1
    w.age_ledger()
    w.tick()
    assert [r["status"] for r in w.rows(b)] == ["sent"] and len(w.fake.calls) == 2


def test_pacing_hold_past_the_ceiling_is_rate_limited(w, monkeypatch):
    w.ready()
    w.emit()
    w.outbox()
    monkeypatch.setattr(wa, "MAX_HOLD_S", 0.0)
    b = w.emit(severity="alert")
    w.outbox()
    assert [(r["status"], r["reason"]) for r in w.rows(b)] == [("skipped", "rate_limited")]


def test_not_sent_is_retried_then_sent(w):
    w.ready()
    w.fake.queue("connect")
    nid = w.emit()
    w.outbox()
    assert [(r["status"], r["reason"], r["attempt"]) for r in w.rows(nid)] == [("retry", "ha_unavailable", 1)]
    w.tick()
    assert [(r["status"], r["attempt"]) for r in w.rows(nid)] == [("sent", 2)]
    assert len(w.fake.calls) == 2


def test_not_sent_three_times_fails(w):
    w.ready()
    w.fake.queue("http404", "http404", "http404", "http404")
    nid = w.emit()
    w.outbox()
    for _ in range(3):
        w.tick()
    assert [(r["status"], r["reason"], r["attempt"]) for r in w.rows(nid)] == [("failed", "service_not_found", 4)]
    assert len(w.fake.calls) == 4
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM notification_events WHERE notification_id = ? AND kind = 'delivery_failed' AND channel = 'whatsapp'", (nid,)).fetchone()[0] == 1


def test_unknown_outcome_is_final_and_never_retried(w):
    w.ready()
    w.fake.queue("timeout")
    nid = w.emit()
    w.outbox()
    w.tick()
    assert [(r["status"], r["reason"]) for r in w.rows(nid)] == [("failed", "unknown_outcome")]
    assert len(w.fake.calls) == 1
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM messaging_send_ledger").fetchone()[0] == 1  # it may have left: it counts against the budget


def test_refused_fails_at_once(w):
    w.ready()
    w.fake.queue("refused")
    nid = w.emit()
    w.outbox()
    assert [(r["status"], r["reason"]) for r in w.rows(nid)] == [("failed", "provider_refused")]
    assert json.loads(w.audits()[-1]["details_json"])["outcome"] == "refused"


def test_disconnected_account_holds_then_fails(settings, monkeypatch):
    w = World(settings, monkeypatch, connected=False)
    w.ready()
    nid = w.emit()
    w.outbox()
    assert [(r["status"], r["reason"]) for r in w.rows(nid)] == [("retry", "channel_down")]
    assert w.fake.calls == []
    job = next(j for _t, _p, _s, j in w.worker.heap)
    job.down_since = -1e9  # held longer than the account's hold_when_down_min
    w.tick()
    assert [(r["status"], r["reason"]) for r in w.rows(nid)] == [("failed", "channel_down")]


def test_switch_off_after_planning_is_honoured(w):
    w.ready()
    w.fake.queue("connect")
    nid = w.emit()
    w.outbox()
    w.switch(False)
    w.tick()
    assert [(r["status"], r["reason"]) for r in w.rows(nid)] == [("skipped", "channel_unavailable")]
    assert len(w.fake.calls) == 1


def test_orphans_of_a_dead_process_fail_and_are_never_resent(w):
    w.ready()
    nid = w.emit()
    with w.db.connection() as conn:
        conn.execute("INSERT INTO notification_deliveries(id, notification_id, user_id, channel, target_ref, status, attempt, mode, created_at) "
                     "VALUES ('orph', ?, ?, 'whatsapp', '····91', 'queued', 0, 'new', '2026-01-01T00:00:00Z')", (nid, w.joni))
    assert wa.recover_orphans(w.db) == 1
    with w.db.connection(mode="read") as conn:
        assert tuple(conn.execute("SELECT status, reason FROM notification_deliveries WHERE id = 'orph'").fetchone()) == ("failed", "interrupted")
    assert w.fake.calls == []


# ---------------------------------------------------------------- the texts

N = {"title": "דליפת מים", "place": "מטבח", "body": "חיישן הכיור דיווח על מים.", "severity": "critical"}
T = dt.datetime(2026, 10, 5, 9, 30, tzinfo=dt.timezone.utc)


def test_render_follows_the_lock_screen_level():
    generic = wa.render(N, mode="new", level="generic", lang="he", tz_name="Asia/Jerusalem", now=T)
    assert generic == "Arx: התראה חדשה. הפרטים בתוך Arx." and "מטבח" not in generic
    tp = wa.render(N, mode="new", level="type_place", lang="he", tz_name="Asia/Jerusalem", now=T)
    assert tp.splitlines()[:3] == ["Arx · קריטי", "דליפת מים", "מטבח"] and "בשעה 12:30" in tp and "חיישן הכיור" not in tp
    full = wa.render(N, mode="new", level="full", lang="he", tz_name="Asia/Jerusalem", now=T)
    assert "חיישן הכיור דיווח על מים." in full
    assert wa.render(N, mode="resolved", level="generic", lang="he", tz_name="Asia/Jerusalem", now=T) == "Arx: התראה הסתיימה. הפרטים בתוך Arx."


def test_render_in_arabic_russian_and_english():
    ar = wa.render(N, mode="new", level="type_place", lang="ar", tz_name="Asia/Jerusalem", now=T)
    ru = wa.render(N, mode="escalate", level="type_place", lang="ru", tz_name="Asia/Jerusalem", now=T)
    en = wa.render(N, mode="resolved", level="type_place", lang="en", tz_name="Asia/Jerusalem", now=T)
    assert ar.startswith("Arx · حرج") and "الساعة 12:30" in ar
    assert ru.startswith("Arx · Критично · ещё не подтверждено") and "в 12:30" in ru
    assert en.startswith("Arx · ended")
    assert wa.render(N, mode="new", level="type_place", lang="xx", tz_name="Asia/Jerusalem", now=T).startswith("Arx · קריטי")  # unknown -> Hebrew
    assert set(wa.TEXTS) == {"he", "ar", "ru", "en"} and all(set(t) == set(wa.TEXTS["he"]) for t in wa.TEXTS.values())


def test_hebrew_texts_never_use_the_forbidden_word():
    for t in list(wa.TEXTS["he"].values()) + list(wa.SEVERITY["he"].values()):
        assert not any(w in t for w in ("קריאה", "קריאות", "קריאת")), t


def test_values_are_cleaned_against_template_injection():
    evil = {"title": "*דחוף* היכנסו ל https://evil.example/pay ‮גיבוי", "place": "חדר\nשורה​ שנייה {code} {link}", "body": "www.phish.co/x ~~ `x`", "severity": "alert"}
    text = wa.render(evil, mode="new", level="full", lang="he", tz_name="Asia/Jerusalem", now=T)
    assert "https://" not in text and "evil.example" not in text and "phish.co" not in text and "www." not in text
    assert "*" not in text and "~" not in text and "`" not in text
    assert "‮" not in text and "​" not in text
    lines = text.splitlines()
    assert "חדר שורה שנייה {code} {link}" in lines  # one line, the braces stay literal text (rendered once, never re-scanned)
    assert len(wa.render({**N, "title": "א" * 5000}, mode="new", level="full", lang="he", tz_name="UTC", now=T)) <= wa.TEXT_MAX


def test_clean_keeps_ordinary_text():
    assert wa.clean("חיישן 3.5 במטבח (קומה 2)", 80) == "חיישן 3.5 במטבח (קומה 2)"
    assert wa.clean("ups.battery_level", 80) == "ups.battery_level"


# ---------------------------------------------------------------- the resolver interface

def test_a_registered_resolver_runs_first_and_carries_its_own_consent(w, monkeypatch):
    class Profile:
        name = "profile"

        def __init__(self, consent: str) -> None:
            self.consent = consent

        def resolve(self, conn, user_id):
            return wa.ResolvedNumber(SECOND_PHONE, "ru", self.name, self.consent) if user_id == w.joni else None

    monkeypatch.setattr(wa, "RESOLVERS", list(wa.RESOLVERS))
    wa.register_resolver(Profile("granted"), first=True)
    wa.register_resolver(Profile("granted"), first=True)  # once only
    assert [r.name for r in wa.RESOLVERS] == ["profile", "directory"]
    w.ready()
    nid = w.emit()
    w.outbox()
    assert w.fake.calls[0]["data"]["target"] == SECOND_PHONE and w.fake.calls[0]["data"]["message"].startswith("Arx · Предупреждение")
    assert [r["target_ref"] for r in w.rows(nid)] == ["····77"]
    assert repr(wa.ResolvedNumber(SECOND_PHONE)).count(SECOND_PHONE) == 0  # never in a repr


def test_a_number_change_between_planning_and_sending_is_not_sent_to_the_old_number(w):
    w.ready()
    orig = w.worker.submit

    def change(jobs):
        with w.db.connection() as conn:
            conn.execute("UPDATE ticket_contacts SET phone_e164 = ?", (SECOND_PHONE,))
        return orig(jobs)

    w.worker.submit = change  # type: ignore[method-assign]
    nid = w.emit()
    w.outbox()
    assert [(r["status"], r["reason"]) for r in w.rows(nid)] == [("skipped", "no_address")]
    assert w.fake.calls == []


# ---------------------------------------------------------------- settings routes

def test_settings_put_validates_and_audits(w):
    v = w.c.get(f"{API}/notify/whatsapp").json()
    assert v["revision"] == 0 and v["ranges"] == {"per_user_hour": [1, 30], "dedupe_min": [0, 1440]}
    assert w.c.put(f"{API}/notify/whatsapp", json={"enabled": "true"}).status_code == 422
    assert w.c.put(f"{API}/notify/whatsapp", json={"per_user_hour": 0}).status_code == 422
    assert w.c.put(f"{API}/notify/whatsapp", json={"dedupe_min": 99999}).status_code == 422
    assert w.c.put(f"{API}/notify/whatsapp", json={"target": "972500000000"}).status_code == 422
    r = w.c.put(f"{API}/notify/whatsapp", json={"enabled": True, "per_user_hour": 6, "revision": 0})
    assert r.status_code == 200 and (r.json()["enabled"], r.json()["per_user_hour"], r.json()["revision"]) == (True, 6, 1)
    stale = w.c.put(f"{API}/notify/whatsapp", json={"enabled": False, "revision": 0})
    assert stale.status_code == 412 and stale.json()["code"] == "settings_conflict"
    a = w.audits("notify.whatsapp.update")
    assert json.loads(a[-1]["details_json"]) == {"changed": ["enabled", "per_user_hour"]}


def test_corrupt_setting_reads_as_switched_off(w):
    with w.db.connection() as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES ('notify.whatsapp', '{not json') ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        assert wa.load_config(conn)["enabled"] is False
        conn.execute("UPDATE settings SET value = ? WHERE key = 'notify.whatsapp'", (json.dumps({"enabled": 1, "per_user_hour": 999}),))
        cfg = wa.load_config(conn)
    assert cfg["enabled"] is False and cfg["per_user_hour"] == 4  # only a real `true` switches it on


def test_the_switch_is_never_exported_or_restored_and_not_in_get_settings(w):
    assert "notify.whatsapp" in backup.SETTINGS_KEEP
    w.switch(True)
    assert "notify.whatsapp" not in w.c.get(f"{API}/settings").text


def test_reachable_users_is_a_count_only(w):
    w.ready()
    vera = w.user_id("vera")
    w.contact(vera, SECOND_PHONE, preferred="email", name="ורה")
    v = w.c.get(f"{API}/notify/whatsapp").json()
    assert v["reachable_users"] == 1 and v["test"] == {"own_number": True, "masked": "····91"}
    assert SECOND_PHONE not in json.dumps(v) and DIGITS not in json.dumps(v)


# ---------------------------------------------------------------- the own-number test

def test_test_send_goes_only_to_the_callers_own_number(w):
    r = w.c.post(f"{API}/notify/whatsapp/test")
    assert r.status_code == 409 and r.json()["code"] == "no_address"
    w.contact(w.joni)
    r = w.c.post(f"{API}/notify/whatsapp/test")
    assert r.status_code == 409 and r.json()["code"] == "channel_unavailable"
    w.map_account()
    r = w.c.post(f"{API}/notify/whatsapp/test", json={"to": SECOND_PHONE})  # a body is ignored: there is no target to choose
    assert r.status_code == 200 and r.json() == {"ok": True, "outcome": "sent", "code": None}, r.text
    assert w.fake.calls[-1]["data"]["target"] == DIGITS and w.fake.calls[-1]["data"]["message"] == wa.TEXTS["he"]["test"]
    a = w.audits("notify.whatsapp.test")
    assert [x["decision"] for x in a] == ["denied", "denied", "allowed"] and DIGITS not in json.dumps(a)
    with w.db.connection(mode="read") as conn:
        assert [r[0] for r in conn.execute("SELECT kind FROM messaging_send_ledger")] == ["test"]


def test_test_send_is_rate_limited_and_admin_only(w):
    w.map_account()
    w.contact(w.joni)
    codes = []
    for _ in range(4):
        codes.append(w.c.post(f"{API}/notify/whatsapp/test").status_code)
        w.age_ledger()  # the account's own gap is not what this test is about
    assert codes == [200, 200, 200, 429]
    assert len(w.fake.calls) == 3
    assert w.c.post(f"{API}/notify/whatsapp/test", headers=as_user("vera")).status_code == 403


def test_test_send_respects_the_account_gap(w):
    w.map_account()
    w.contact(w.joni)
    assert w.c.post(f"{API}/notify/whatsapp/test").status_code == 200
    r = w.c.post(f"{API}/notify/whatsapp/test")
    assert r.status_code == 429 and r.json()["code"] == "rate_limited" and int(r.headers["Retry-After"]) >= 1
    assert len(w.fake.calls) == 1


def test_deliveries_route_filters_the_whatsapp_channel(w):
    w.ready()
    nid = w.emit()
    w.outbox()
    rows = w.c.get(f"{API}/notify/deliveries", params={"channel": "whatsapp"}).json()["deliveries"]
    assert [(r["notification_id"], r["channel"], r["target"]) for r in rows] == [(nid, "whatsapp", "····91")]
    stats = w.c.get(f"{API}/notify/stats").json()
    assert stats["channels"]["whatsapp"]["sent"] == 1
