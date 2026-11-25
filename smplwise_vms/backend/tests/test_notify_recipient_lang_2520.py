"""NOTIFY-RECIPIENT-LANG-2520: a notification goes out in each RECIPIENT's language - Web Push and the phone app in the recipient user's
`ui.lang`, e-mail in the language of the Arx user whose own e-mail is the address - with the same English templates the notification
centre uses (services/notify_policy_en.py). No stored language, an unknown value, or no matching user = Hebrew, byte for byte as before.
WhatsApp is not changed (its texts are approved templates owned elsewhere). Every send goes to a fake (push service, relay, SMTP on
127.0.0.1)."""
from __future__ import annotations

import datetime as dt
import email
import email.policy
import json
import re

import httpx
import pytest
from conftest import as_user
from fake_smtp import FakeSMTP
from notify_world import API, World, fake_push  # noqa: F401 - fixture

from smplwise.services import mobile_push, notify, notify_channels, notify_delivery_lang as dl, notify_email, notify_policy, presence
from smplwise.services import push as push_svc
from smplwise.services.notify_policy_en import TEMPLATES_EN

pytestmark = pytest.mark.usefixtures("daytime_clock")

HEB = re.compile("[\u0590-\u05ff]")
NOW = dt.datetime(2026, 11, 25, 10, 0, tzinfo=dt.timezone.utc)
OWNER = "owner@example.test"
SECOND = "second@example.test"


def _lang(w, lang: str, user: str | None = None) -> None:
    r = w.c.put(f"{API}/me/prefs", json={"ui.lang": lang}, headers=as_user(user) if user else None)
    assert r.status_code == 200 and r.json()["prefs"]["ui.lang"] == lang, r.text


# ---------------------------------------------------------------- the shared rule (no database)

def test_fixed_words_are_english_for_english_and_untouched_for_hebrew():
    for he, en in dl.TEXT_EN.items():
        assert HEB.search(he) and en.strip() and not HEB.search(en), (he, en)
        assert dl.word(he, "he") is he and dl.word(he, "en") == en
        assert sorted(re.findall(r"\{(\w+)\}", he)) == sorted(re.findall(r"\{(\w+)\}", en)), he
    assert dl.word("טקסט שאינו בטבלה", "en") == "טקסט שאינו בטבלה"
    assert [dl.severity_label(s, "he") for s in ("info", "alert", "critical")] == [notify_policy.SEVERITY_LABEL_HE[s] for s in ("info", "alert", "critical")]
    assert [dl.severity_label(s, "en") for s in ("info", "alert", "critical", "x")] == ["Info", "Alert", "Critical", ""]


def test_note_in_renders_the_recipients_language_only_when_the_row_is_the_templates_own():
    params = {"name": "חיישן מטבח"}
    title, body = notify_policy.render("sensor.leak", params)
    row = {"id": "n1", "source": "sensor.leak", "title": title, "body": body, "params": params, "place": "מטבח"}
    assert dl.note_in(row, "he") is row
    en = dl.note_in(row, "en")
    assert en is not row and (en["title"], en["body"]) == ("Water leak", "חיישן מטבח reported water.") and en["place"] == "מטבח"
    assert row["title"] == title, "never written back"
    assert dl.note_in({**row, "body": "נוסח ישן"}, "en")["body"] == "נוסח ישן", "an older wording goes out as stored"
    assert dl.note_in({**row, "source": "no.such"}, "en")["title"] == title
    # the resolve text: the source's own -> English; a text of its own stays
    assert dl.resolve_text_in("sensor.leak", None, "en") == "Sensor is dry" == dl.resolve_text_in("sensor.leak", "החיישן יבש", "en")
    assert dl.resolve_text_in("sensor.leak", "טקסט משלו", "en") == "טקסט משלו"
    assert dl.resolve_text_in("sensor.leak", "החיישן יבש", "he") == "החיישן יבש"


def test_a_per_generator_source_reads_its_alert_types_english():
    src = "generator.low_fuel@gen-1"
    params = {"name": "גנרטור ראשי", "detail": "15%"}
    assert notify_policy.render(src, params, "en") == ("Low fuel level", "גנרטור ראשי: 15%.")
    assert notify_policy.render(src, params) == notify_policy.render("generator.low_fuel", params)
    assert notify_policy.base_key(src) == "generator.low_fuel" and notify_policy.base_key("sensor.leak") == "sensor.leak"
    assert dl.resolve_text_in(src, None, "en") == TEMPLATES_EN["generator.low_fuel"][2]


def test_payload_v2_in_english_and_hebrew_unchanged():
    he = {"id": "n1", "title": "דליפת מים", "body": "חיישן דיווח על מים.", "place": "מטבח", "severity": "critical", "category": "safety"}
    en = {**he, "title": "Water leak", "body": "חיישן reported water."}
    tokens, door = {"ack": "A" * 22, "snooze": "S" * 22}, {"id": "d1", "can_open": True}
    p = notify_channels.payload_v2(en, "type_place", tokens=tokens, door=door, tz_name="Asia/Jerusalem", mode="new", now=NOW, lang="en")
    assert p["title"] == "Water leak · מטבח" and re.fullmatch(r"Critical · \d\d:\d\d", p["body"])
    assert [a["title"] for a in p["actions"]] == ["Acknowledge", "Mute for an hour", "Open the door"]
    g = notify_channels.payload_v2(en, "generic", tokens=None, door=None, tz_name="Asia/Jerusalem", mode="resolved", now=NOW, lang="en")
    assert (g["title"], g["body"]) == ("Arx", "Ended")
    f = notify_channels.payload_v2({**en, "body": ""}, "full", tokens=None, door=None, tz_name="Asia/Jerusalem", mode="resolved", now=NOW, lang="en")
    assert f["body"] == "Critical · מטבח · Ended"
    h = notify_channels.payload_v2(he, "type_place", tokens=tokens, door=door, tz_name="Asia/Jerusalem", mode="new", now=NOW)
    assert h == notify_channels.payload_v2(he, "type_place", tokens=tokens, door=door, tz_name="Asia/Jerusalem", mode="new", now=NOW, lang="he")
    assert [a["title"] for a in h["actions"]] == ["אישור", "השתק לשעה", "פתח דלת"] and re.fullmatch(r"קריטי · \d\d:\d\d", h["body"])


def test_mail_in_english_is_left_to_right_and_the_hebrew_mail_is_unchanged():
    n = {"id": "n1", "title": "Backup failed", "body": "The automatic backup did not finish.", "place": "חדר שרתים", "severity": "alert", "subject_kind": "system",
         "count": 3, "last_at": "2026-11-25T09:30:00Z"}
    r = notify_email.compose_notification(n, mode="escalate", tz_name="Asia/Jerusalem", link_base="https://arx.example.test", lang="en")
    assert r.subject == "Arx · Not acknowledged: Backup failed · חדר שרתים"
    assert "\u200f" not in r.text and 'dir="ltr"' in r.html and 'lang="en"' in r.html and "border-left:6px" in r.html and 'dir="rtl"' not in r.html
    for needle in ("Severity: Alert", "Place: חדר שרתים", "Occurrences: 3", "Status: Not acknowledged yet", "Details: The automatic backup did not finish.",
                   "Sent automatically by Arx"):
        assert needle in r.text, needle
    assert "Open in Arx" in r.html
    only_names = r.text.replace("חדר שרתים", "")
    assert not HEB.search(only_names), only_names
    resolved = notify_email.compose_notification(n, mode="resolved", tz_name="Asia/Jerusalem", resolve_text="Backup succeeded", lang="en")
    assert resolved.subject.startswith("Arx · Ended: ") and "Status: Backup succeeded" in resolved.text and "For details and handling, sign in to Arx." in resolved.text
    he = notify_email.compose_notification({**n, "title": "הגיבוי נכשל"}, mode="escalate", tz_name="Asia/Jerusalem")
    assert he.subject == "Arx · לא אושר: הגיבוי נכשל · חדר שרתים" and 'dir="rtl"' in he.html and he.text.startswith("\u200f")
    items = [notify_email.HeldItem(f"d{i}", f"n{i}", "Backup failed", "מטבח", "alert", 1, 0.0, "en") for i in range(3)]
    d = notify_email.compose_digest(items, tz_name="Asia/Jerusalem", now=NOW, lang="en")
    assert d.subject == "Arx · 3 more notifications" and "Many notifications were raised" in d.text and "Backup failed · מטבח ×3" in d.text and 'dir="ltr"' in d.html
    t = notify_email.compose_test("Asia/Jerusalem", "en")
    assert t.subject == "Arx · Test message" and "outgoing mail is set up correctly" in t.text and not HEB.search(t.text + t.html)
    assert notify_email.compose_test("Asia/Jerusalem").subject == "Arx · הודעת בדיקה"


# ---------------------------------------------------------------- Web Push and the phone app (fake push service, fake relay)

@pytest.fixture()
def w(settings, fake_push) -> World:
    return World(settings)


def _payloads(w: World, fake, user: str) -> list[dict]:
    return [w.browsers[user].decrypt(r.content) for r in fake.to(w.browsers[user])]


def test_web_push_speaks_each_recipients_language(w, fake_push):
    w.subscribe("ops2", "vera")
    _lang(w, "en", "ops2")  # vera keeps no language: Hebrew
    kitchen = w.entity("binary_sensor.kitchen_leak", cls="moisture", floor=w.ids["floor2"], name="חיישן הצפה")
    for level in ("type_place", "full", "generic"):
        w.set_settings(lockscreen=level)
        w.emit("sensor.leak", "entity", kitchen, params={"name": "חיישן הצפה"}, dedupe_key=f"k-{level}")
        w.flush()
        en, he = _payloads(w, fake_push, "ops2")[-1], _payloads(w, fake_push, "vera")[-1]
        if level == "type_place":
            assert en["title"] == "Water leak · מטבח" and re.fullmatch(r"Critical · \d\d:\d\d", en["body"])
            assert he["title"] == "דליפת מים · מטבח" and re.fullmatch(r"קריטי · \d\d:\d\d", he["body"])
            assert en["actions"] and all(not HEB.search(a["title"]) for a in en["actions"])
            assert {a["title"] for a in he["actions"]} <= {"אישור", "השתק לשעה", "פתח דלת"}
        elif level == "full":
            assert en["body"] == "חיישן הצפה reported water. · מטבח" and he["body"] == "חיישן הצפה דיווח על מים. · מטבח"
        else:
            assert (en["title"], en["body"]) == ("Arx", "New notification") and (he["title"], he["body"]) == ("Arx", "התראה חדשה")
    # the centre and the push agree for the English reader; the row itself stays Hebrew
    row = [n for n in w.inbox("ops2") if n["source"] == "sensor.leak"][0]
    assert row["title"] == "Water leak"
    with w.db.connection(mode="read") as conn:
        assert {r[0] for r in conn.execute("SELECT title FROM notifications WHERE source = 'sensor.leak'")} == {"דליפת מים"}


def test_an_unknown_stored_language_is_hebrew(w, fake_push):
    w.subscribe("ops2")
    _lang(w, "en", "ops2")
    with w.db.connection() as conn:
        conn.execute("UPDATE user_prefs SET value_json = '\"xx\"' WHERE key = 'ui.lang'")
    w.set_settings(lockscreen="type_place")
    w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"})
    w.flush()
    assert _payloads(w, fake_push, "ops2")[-1]["title"] == "מצלמה לא זמינה · לובי"


def test_the_test_push_is_in_the_callers_language(w, fake_push):
    w.subscribe("ops2")
    _lang(w, "en", "ops2")
    with w.db.connection(mode="read") as conn:
        uid = conn.execute("SELECT user_id FROM user_prefs WHERE key = 'ui.lang'").fetchone()[0]
    notify_channels.send_test(w.db, uid)
    p = _payloads(w, fake_push, "ops2")[-1]
    assert (p["title"], p["body"]) == ("Arx · Test notification", "Notifications are working on this device.")


class _Relay:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.calls.append(json.loads(request.content))
        return httpx.Response(200, json={"ok": True})


@pytest.fixture()
def relay(monkeypatch):
    fake = _Relay()
    monkeypatch.setenv("SW_PUSH_RELAY_URL", "https://relay.test")
    monkeypatch.setenv("SW_PUSH_RELAY_KEY", "srvkey-test-0001")
    monkeypatch.setattr(mobile_push, "TRANSPORT", httpx.MockTransport(fake.handler))
    monkeypatch.setattr(mobile_push, "BACKOFF_S", (0.0, 0.0, 0.0))
    monkeypatch.setattr(mobile_push, "now_utc", lambda: notify.now_utc())
    mobile_push.reset_limits()
    presence.reset_limits()
    mobile_push.reset_health()
    yield fake
    mobile_push.reset_limits()
    presence.reset_limits()
    mobile_push.reset_health()


def _register(w: World, user: str, relay_token: str) -> tuple[str, dict]:
    r = w.c.post(f"{API}/presence/devices", json={"name": "נייד", "platform": "ios", "install_id": f"{user}-install-0000-0000", "app_version": "1.0.0"}, headers=as_user(user))
    assert r.status_code == 201, r.text
    did, tok = r.json()["device_id"], {"Authorization": f"Bearer {r.json()['device_token']}"}
    r = w.c.post(f"{API}/notifications/devices", json={"platform": "ios", "relay_token": relay_token, "app_version": "1.0.0"}, headers=tok)
    assert r.status_code == 200, r.text
    return did, tok


def test_the_phone_app_message_is_in_each_recipients_language(w, relay):
    _, tok_en = _register(w, "ops2", "rt_ops2_0123456789abcdef")
    did_he, tok_he = _register(w, "joni", "rt_joni_0123456789abcdef")  # the administrator: a recipient, no language stored
    _lang(w, "en", "ops2")
    w.set_policy("camera.offline", channels={"webpush": False, "email": False, "app": True})
    w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"})
    w.flush()
    by_token = {c["relay_token"]: c["notification_id"] for c in relay.calls}
    en = w.c.get(f"{API}/notifications/app/{by_token['rt_ops2_0123456789abcdef']}", headers=tok_en).json()
    he = w.c.get(f"{API}/notifications/app/{by_token['rt_joni_0123456789abcdef']}", headers=tok_he).json()
    assert en["title"] == "Camera unavailable · לובי" and en["body"].startswith("Alert · ")
    assert he["title"] == "מצלמה לא זמינה · לובי" and he["body"].startswith("התראה · ")
    # the relay call itself carries no text in any language
    assert all(not HEB.search(json.dumps(c, ensure_ascii=False)) and "Camera" not in json.dumps(c) for c in relay.calls)
    # the device's test push follows its owner's language (vera: Hebrew, as before)
    mobile_push.send_test(w.db, did_he)
    msg = w.c.get(f"{API}/notifications/app/{relay.calls[-1]['notification_id']}", headers=tok_he).json()
    assert (msg["title"], msg["body"]) == ("Arx · התראת בדיקה", "ההתראות פועלות במכשיר הזה.")


# ---------------------------------------------------------------- e-mail (fake SMTP on 127.0.0.1)

@pytest.fixture()
def smtp(tmp_path):
    with FakeSMTP(tmp_path, "none") as s:
        yield s


@pytest.fixture()
def mail(settings, monkeypatch):
    notify_email.reset_state()
    push_svc.reset_limits()
    monkeypatch.setattr(notify_email, "TIMEOUT_S", 2.0)
    monkeypatch.setattr(notify_email, "ALLOW_LOOPBACK_HOST", True)
    w = World(settings)
    assert w.c.put(f"{API}/notify/settings", json={"quiet": {"enabled": False}}).status_code == 200
    notifier = push_svc.PushNotifier()
    notifier.db = w.db
    w.mail_notifier = notifier
    yield w
    notify_email.reset_state()


def _configure(w, smtp) -> None:
    r = w.c.put(f"{API}/notify/email", json={"host": "127.0.0.1", "port": smtp.port, "security": "none", "user": "", "from": "arx@example.test", "recipients": [OWNER, SECOND]})
    assert r.status_code == 200, r.text


def _pump(w) -> None:
    notify_channels.process_outbox(w.mail_notifier)
    assert notify_email.worker_for(w.db).drain(20)


def _mails(smtp) -> dict[str, email.message.EmailMessage]:
    return {m["to"][0]: email.message_from_bytes(m["data"], policy=email.policy.default) for m in smtp.messages}


def test_mail_goes_out_in_the_language_of_the_user_who_owns_the_address(mail, smtp):
    _configure(mail, smtp)
    _lang(mail, "en")  # the administrator (the default client) reads English ...
    with mail.db.connection() as conn:
        uid = conn.execute("SELECT user_id FROM user_prefs WHERE key = 'ui.lang'").fetchone()[0]
        conn.execute("UPDATE users SET email = ? WHERE id = ?", (OWNER.upper(), uid))  # ... and OWNER is his own address (case-insensitive)
        assert dl.address_langs(conn, [OWNER, SECOND, "nobody@example.test"]) == {OWNER: "en", SECOND: "he", "nobody@example.test": "he"}
    with mail.db.connection() as conn:
        notify.emit_full(conn, notify.Signal("backup.failed", "system", "backup", dedupe_key="b1", place="חדר שרתים", params={}))
    _pump(mail)
    got = _mails(smtp)
    assert set(got) == {OWNER, SECOND}
    en, he = got[OWNER], got[SECOND]
    assert str(en["Subject"]) == "Arx · Backup failed · חדר שרתים" and str(he["Subject"]) == "Arx · הגיבוי נכשל · חדר שרתים"
    en_txt, he_txt = en.get_body(preferencelist=("plain",)).get_content(), he.get_body(preferencelist=("plain",)).get_content()
    assert "Severity: Alert" in en_txt and "The automatic backup did not finish." in en_txt and "\u200f" not in en_txt
    assert "חומרה: התראה" in he_txt and he_txt.startswith("\u200f")
    assert 'dir="ltr"' in en.get_body(preferencelist=("html",)).get_content() and 'dir="rtl"' in he.get_body(preferencelist=("html",)).get_content()
    # the delivery log is the same as before: one row per address, masked
    with mail.db.connection(mode="read") as conn:
        rows = [dict(r) for r in conn.execute("SELECT target_ref, status FROM notification_deliveries WHERE channel = 'email' ORDER BY rowid")]
    assert sorted(r["status"] for r in rows) == ["sent", "sent"] and all("@example.test" in r["target_ref"] and "*" in r["target_ref"] for r in rows)


def test_users_who_disagree_on_an_address_get_hebrew(mail, smtp):
    _lang(mail, "en")
    _lang(mail, "he", "vera")
    with mail.db.connection() as conn:
        rows = {r[0] for r in conn.execute("SELECT user_id FROM user_prefs WHERE key = 'ui.lang'")}
        assert len(rows) == 2
        for uid in rows:
            conn.execute("UPDATE users SET email = ? WHERE id = ?", (OWNER, uid))
        assert dl.address_langs(conn, [OWNER]) == {OWNER: "he"}
        conn.execute("UPDATE users SET active = 0 WHERE id IN (SELECT user_id FROM user_prefs WHERE key = 'ui.lang' AND value_json = '\"he\"')")
        assert dl.address_langs(conn, [OWNER]) == {OWNER: "en"}, "an inactive user does not count"


def test_the_mail_test_button_follows_each_addresses_language(mail, smtp):
    _configure(mail, smtp)
    _lang(mail, "en")
    with mail.db.connection() as conn:
        uid = conn.execute("SELECT user_id FROM user_prefs WHERE key = 'ui.lang'").fetchone()[0]
        conn.execute("UPDATE users SET email = ? WHERE id = ?", (SECOND, uid))
    r = mail.c.post(f"{API}/notify/email/test", json={})
    assert r.status_code == 200 and r.json()["ok"] is True, r.text
    got = _mails(smtp)
    assert str(got[SECOND]["Subject"]) == "Arx · Test message" and str(got[OWNER]["Subject"]) == "Arx · הודעת בדיקה"


def test_whatsapp_is_left_as_it_was():
    from pathlib import Path

    src = Path(notify_email.__file__).with_name("notify_whatsapp.py").read_text(encoding="utf-8")
    assert "notify_delivery_lang" not in src and "note_in" not in src
