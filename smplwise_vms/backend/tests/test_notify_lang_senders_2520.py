"""NOTIFY-LANG-SENDERS-2520: the senders around the notification pipeline speak the recipient's language too, with the same rule and helper as
NOTIFY-RECIPIENT-LANG-2520 (services/notify_delivery_lang): the notice-board push, the calendar attendee notices (in app and to external
attendees), the insights monthly report, the electricity bill draft. Hebrew / unknown recipients get the same bytes as before (a one-off
before/after script checked that; see docs/changes/NOTIFY-LANG-SENDERS-2520.md). WhatsApp templates and speaker announcements are not touched.
Fakes only: the fake push service, a fake guest channel, a patched SMTP send; nothing leaves the process."""
from __future__ import annotations

import re

import pytest
from conftest import as_user
from notify_world import API, World, fake_push  # noqa: F401 - fixture
from test_calendar_attendees_2343 import _app, book, cc, db, dispatch, guest, ok, resident, setup_team  # noqa: F401 - fixtures + helpers
from test_insight215_slice3 import _fake_enabled_at, enable, mail, put, ts, w  # noqa: F401 - fixtures + helpers

from smplwise.services import energy_notify, insights_common as ic, insights_delivery as dl, notify_delivery_lang as ndl, notify_policy
from smplwise.services.calendar import attendee_notices as an

HEB = re.compile("[\u0590-\u05ff]")


def _lang(client, lang: str, user: str | None = None) -> None:
    r = client.put(f"{API}/me/prefs", json={"ui.lang": lang}, headers=as_user(user) if user else None)
    assert r.status_code == 200 and r.json()["prefs"]["ui.lang"] == lang, r.text


# ---------------------------------------------------------------- the per-language param (notify_policy.I18N_PARAM)

def test_a_params_own_english_value_is_used_only_in_english_and_only_with_the_english_template():
    params = {"name": "ישיבת ועד", "when": "יום ב׳ 01.12 10:00–11:30", notify_policy.I18N_PARAM: {"en": {"when": "Mon 01.12 10:00–11:30"}}}
    he = notify_policy.render("calendar.attendee.invite", params)
    assert he == notify_policy.render("calendar.attendee.invite", {k: v for k, v in params.items() if k != notify_policy.I18N_PARAM})
    assert he == ("הזמנה לאירוע", "ישיבת ועד · יום ב׳ 01.12 10:00–11:30")
    assert notify_policy.render("calendar.attendee.invite", params, "en") == ("Invitation to an event", "ישיבת ועד · Mon 01.12 10:00–11:30")
    # a name that is not a param of the signal, a nested value or the reserved key itself never sneaks in
    odd = {"name": "x", notify_policy.I18N_PARAM: {"en": {"when": "W", "name": {"a": 1}, notify_policy.I18N_PARAM: "z"}}}
    assert notify_policy.render("calendar.attendee.invite", odd, "en") == ("Invitation to an event", "x ·")
    # a source without English templates stays Hebrew - no English value inside a Hebrew sentence
    assert notify_policy.render("no.such.source", params, "en") == notify_policy.render("no.such.source", params)
    # the delivery rule (note_in) takes it: the row stays Hebrew, the English copy reads the English day
    row = {"id": "n1", "source": "calendar.attendee.invite", "title": he[0], "body": he[1], "params": params}
    assert ndl.note_in(row, "he") is row and ndl.note_in(row, "en")["body"] == "ישיבת ועד · Mon 01.12 10:00–11:30"


# ---------------------------------------------------------------- the notice board's push (already a source of the pipeline)

@pytest.mark.usefixtures("daytime_clock")
def test_the_notice_push_speaks_each_recipients_language_and_the_notice_itself_stays_as_written(settings, fake_push):  # noqa: F811
    world = World(settings)
    world.subscribe("ops2", "vera")
    _lang(world.c, "en", "ops2")  # vera keeps no language: Hebrew
    assert world.c.patch(f"{API}/notices/settings", json={"enabled": True}).status_code == 200
    import datetime as dt

    ends = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%SZ")
    for level in ("type_place", "full"):
        world.set_settings(lockscreen=level)
        r = world.c.post(f"{API}/notices", json={"title": f"הפסקת מים {level}", "body": "עקב עבודות.", "severity": "critical", "ends_at": ends, "publish": True,
                                                 "audience": {"everyone": True}, "push": True})
        assert r.status_code == 200 and r.json()["push"]["sent"] is True, r.text
        world.flush()
        en = [world.browsers["ops2"].decrypt(x.content) for x in fake_push.to(world.browsers["ops2"])][-1]
        he = [world.browsers["vera"].decrypt(x.content) for x in fake_push.to(world.browsers["vera"])][-1]
        assert en["title"] == he["title"] == f"הפסקת מים {level}"  # what the author wrote is data: never translated
        if level == "type_place":
            assert re.fullmatch(r"Critical · \d\d:\d\d", en["body"]) and re.fullmatch(r"קריטי · \d\d:\d\d", he["body"])
        else:
            assert en["body"] == he["body"] == "עקב עבודות."
        assert all(not HEB.search(a["title"]) for a in en.get("actions", []))
    with world.db.connection(mode="read") as conn:
        assert all(HEB.search(t[0]) for t in conn.execute("SELECT title FROM notifications WHERE source = 'notice.published'"))
    # the resolve text is the source's own: an English reader gets its English
    assert ndl.resolve_text_in("notice.published", None, "en") == "Notice removed from the board"
    assert ndl.resolve_text_in("notice.published", None, "he") is None


# ---------------------------------------------------------------- calendar attendee notices

def test_the_day_and_time_in_english_and_the_hebrew_as_before():
    row = {"tz": "Asia/Jerusalem", "starts_at": "2026-12-01T08:00:00Z", "ends_at": "2026-12-01T09:30:00Z", "local_start": "2026-12-01T10:00",
           "local_end": "2026-12-01T11:30", "all_day": 0, "rrule": "FREQ=WEEKLY"}
    assert an.when_text(row) == "יום ג׳ 01.12 10:00–11:30 · חוזר"
    assert an.when_text(row, lang="en") == "Tue 01.12 10:00–11:30 · recurring"
    assert an.when_text(row, "2026-12-08T10:00", "en") == "Tue 08.12 10:00–11:30"
    assert an.when_text({**row, "all_day": 1, "rrule": None}, lang="en") == "Tue 01.12"


def test_the_user_attendee_reads_the_invite_in_his_language_the_row_stays_hebrew(cc):  # noqa: F811
    a, u = setup_team(cc)
    _lang(cc, "en", "dana")  # bob keeps no language
    ok(book(cc, a, who=u["oren"], title="ישיבת ועד", attendees=[{"kind": "user", "ref_id": "dev-dana"}, {"kind": "user", "ref_id": "dev-bob"}]), 201)
    assert dispatch(cc)["sent"] == 2
    with db(cc).connection(mode="read") as c:
        rows = c.execute("SELECT title, body FROM notifications WHERE source = 'calendar.attendee.invite' ORDER BY body").fetchall()
        assert {r["title"] for r in rows} == {"הזמנה לאירוע"} and all("יום ג׳ 03.11" in r["body"] for r in rows)
    dana = cc.get(f"{API}/notifications", headers=as_user("dana")).json()["notifications"]
    bob = cc.get(f"{API}/notifications", headers=as_user("bob")).json()["notifications"]
    inv = [n for n in dana if n["source"] == "calendar.attendee.invite"][0]
    assert inv["title"] == "Invitation to an event" and inv["body"].startswith("ישיבת ועד · Tue 03.11 ") and not HEB.search(inv["body"].split(" · ", 1)[1])
    assert [n for n in bob if n["source"] == "calendar.attendee.invite"][0]["body"].startswith("ישיבת ועד · יום ג׳ 03.11 ")


def test_an_external_attendee_gets_his_directory_language_and_a_guest_stays_hebrew(cc):  # noqa: F811
    a, u = setup_team(cc)
    resident(cc, "res-en", "Ruth", phone="972505550111")
    resident(cc, "res-ar", "ראמי", phone="972505550122")
    resident(cc, "res-he", "רות", phone="972505550133")
    with db(cc).connection() as conn:
        conn.execute("UPDATE ticket_contacts SET lang = 'en' WHERE id = 'res-en'")
        conn.execute("UPDATE ticket_contacts SET lang = 'ar' WHERE id = 'res-ar'")  # a language Arx does not offer: Hebrew
    ok(book(cc, a, who=u["oren"], title="ישיבת ועד", attendees=[{"kind": "resident", "ref_id": r} for r in ("res-en", "res-ar", "res-he")] + [guest()]), 201)
    dispatch(cc)
    sent = dict(cc.wa.sent)
    en = sent["+972505550111"]
    assert en.startswith("You are invited to ישיבת ועד: Tue 03.11 ") and en.endswith(".") and "Invited by:" in en
    for phone in ("+972505550122", "+972505550133", "+972505550142"):
        assert sent[phone].startswith("הוזמנת לישיבת ועד: יום ג׳ 03.11 "), phone
    with db(cc).connection(mode="read") as conn:
        rows = {r["ref_id"] or r["kind"]: r for r in conn.execute("SELECT * FROM cal_attendees").fetchall()}
        assert [an.external_lang(conn, rows[k]) for k in ("res-en", "res-ar", "res-he", "guest")] == ["en", "he", "he", "he"]


def test_the_english_external_texts_for_every_kind(cc):  # noqa: F811
    a, u = setup_team(cc)
    ev = ok(book(cc, a, who=u["oren"], title="Board"), 201)["event"]
    with db(cc).connection(mode="read") as conn:
        row = conn.execute("SELECT * FROM cal_events WHERE id = ?", (ev["id"],)).fetchone()
        texts = {k: an.message_text(conn, k, row, None, "en") for k in ("invite", "change", "cancel", "removed")}
        he = {k: an.message_text(conn, k, row, None) for k in ("invite", "change", "cancel", "removed")}
    assert texts["change"].startswith("Update to Board: the new time is Tue 03.11 ")
    assert re.fullmatch(r"Board \(Tue 03\.11 \d\d:\d\d–\d\d:\d\d\) was cancelled\.", texts["cancel"])
    assert texts["removed"].startswith("Your invitation to Board (Tue 03.11 ")
    # the room ("חדר א") and the organizer's name are data; everything else is English
    assert all(not HEB.search(t.replace("חדר א", "")) for t in texts.values()) and all(t.startswith(("הוזמנת", "עדכון", "Board (", "ההזמנה")) for t in he.values())


# ---------------------------------------------------------------- the insights monthly report

def test_the_report_language_may_be_each_recipients_own(w, mail):  # noqa: F811
    with w["db"].connection() as conn:
        uid = conn.execute("SELECT id FROM users WHERE username = 'joni'").fetchone()[0]
        conn.execute("UPDATE users SET email = 'BOSS@test.example' WHERE id = ?", (uid,))
    _lang(w["c"], "en")
    enable(w, lang="recipient")
    assert w["c"].get(f"{API}/reports/building/delivery").json()["config"]["lang"] == "recipient"
    _fake_enabled_at(w, "2026-09-15T00:00:00Z")
    out = dl.process(w["db"], ts(2026, 10, 1, 6, 0))
    assert out["sent"] == 2
    by = {m[0]: m for m in mail}
    assert by["boss@test.example"][1] == "Arx · Monthly building report 2026-09" and not HEB.search(by["boss@test.example"][2])
    assert by["board@test.example"][1] == "Arx · דוח בניין חודשי 2026-09"  # nobody owns this address: Hebrew
    with w["db"].connection(mode="read") as conn:
        assert sorted(r[0] for r in conn.execute("SELECT lang FROM insights_report_sends")) == ["en", "he"]


def test_a_fixed_report_language_is_still_the_administrators_choice(w, mail):  # noqa: F811
    with w["db"].connection() as conn:
        conn.execute("UPDATE users SET email = 'boss@test.example' WHERE username = 'joni'")
    _lang(w["c"], "en")
    enable(w, lang="he")
    _fake_enabled_at(w, "2026-09-15T00:00:00Z")
    dl.process(w["db"], ts(2026, 10, 1, 6, 0))
    assert {m[1] for m in mail} == {"Arx · דוח בניין חודשי 2026-09"}


def test_the_whatsapp_recipients_language_is_planned_per_user(w):  # noqa: F811
    from conftest import bind

    ic_switch = __import__("insight215_fixtures").switch
    ic_switch(w["db"], ic.SW_REPORT)
    bind(w["c"], w["settings"], "sam", "site_admin", "installation", "*")
    _lang(w["c"], "en", "sam")
    with w["db"].connection() as conn:
        ids = {r["username"]: r["id"] for r in conn.execute("SELECT id, username FROM users").fetchall()}
        cfg = {**dl.load(conn), "whatsapp": True, "users": [ids["sam"], ids["joni"]], "lang": "recipient", "enabled_by": ids["joni"]}
        conn.execute("DELETE FROM insights_report_sends")
        ic.set_setting(conn, dl.CONFIG_KEY, __import__("json").dumps(cfg))
        assert dl.plan(conn, "2026-09", ts(2026, 10, 1, 6, 0)) == 2
        langs = {r["user_id"]: r["lang"] for r in conn.execute("SELECT user_id, lang FROM insights_report_sends").fetchall()}
    assert langs == {ids["sam"]: "en", ids["joni"]: "he"}


def test_the_english_report_mail_is_left_to_right_with_an_english_footer_and_hebrew_is_unchanged():
    model = {"lang": "en", "month": "2026-09", "data": {"summary": [{"title": "Service requests", "text": "3 opened · 2 closed"}]}}
    r = dl.email_message(model, "https://arx.test")
    assert "\u200f" not in r.text and not HEB.search(r.text + r.html) and 'dir="ltr"' in r.html
    assert r.text.endswith("Sent automatically by Arx. Please do not reply to this message.")
    h = dl.email_message({**model, "lang": "he"}, "https://arx.test")
    assert h.text.startswith("\u200f") and 'dir="rtl"' in h.html and h.text.endswith("נשלח אוטומטית מ־Arx. אין להשיב להודעה זו.")


@pytest.mark.parametrize("bad", ["fr", "", None, "Recipient"])
def test_an_unknown_report_language_is_refused(w, bad):  # noqa: F811
    __import__("insight215_fixtures").switch(w["db"], ic.SW_REPORT)
    r = put(w, {"config": {"lang": bad}})
    assert r.status_code == 422 and r.json()["code"] == "validation"


# ---------------------------------------------------------------- the electricity bill draft (already a source of the pipeline)

def test_the_bill_draft_notice_has_an_english_template_and_a_language_free_period():
    import datetime as dt

    period = energy_notify.period_label(dt.date(2026, 9, 1), dt.date(2026, 10, 1))
    title, body = notify_policy.render(energy_notify.SOURCE, {"period": period})
    row = {"id": "n", "source": energy_notify.SOURCE, "title": title, "body": body, "params": {"period": period}}
    en = ndl.note_in(row, "en")
    assert (en["title"], en["body"]) == ("Electricity bill draft ready", "The draft for the period 09/2026 is ready for review.")
    assert ndl.note_in(row, "he") is row and HEB.search(title)
