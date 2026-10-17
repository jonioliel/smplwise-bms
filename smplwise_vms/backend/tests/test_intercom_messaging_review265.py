"""CR-036 WA - the counterexamples of the 2.6.5 security review of the people-messaging (WhatsApp send) surface, each one a test that
failed before its fix (review F1-F6, F8-F11; F7 waits for WisKey W11 and is not here). Same fake WisKey, same identity matrix as
tests/test_intercom_messaging.py (whose fixture and helpers this module reuses). Nothing here contacts a device, WisKey or a phone."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from intercom_station_scope import station_scope  # noqa: F401 - a fixture
from test_intercom_messaging import PHONES, audits, details, enable, messages, mc, mona, person, req, rows, save, send, settings_doc  # noqa: F401
from test_intercom_adapter import sent

from smplwise.db import Database
from smplwise.services import intercom_messaging as M

JERUSALEM_NIGHT = datetime(2026, 10, 14, 23, 40, tzinfo=timezone.utc)  # 02:40 in Asia/Jerusalem (UTC+3 in October)


def twin(fake: Any, uid: str, new_id: str, **over: Any) -> dict[str, Any]:
    """A second WisKey record copied from `uid` (same phone unless overridden) - a re-registered contractor, a shared family phone."""
    p = {**json.loads(json.dumps(person(fake, uid))), "id": new_id, "display_name": f"Twin {new_id}", **over}
    fake.directory.append(p)
    return p


# ---------------------------------------------------------------- F2: the preview is not a field oracle

def test_f2_the_preview_withholds_phone_and_consent_from_a_caller_who_may_not_message_the_person(mc):
    fake, c, _s = mc
    enable(c)
    assert req(c, "PUT", "/people/u1/messages/optout", json={"opted_out": True}).status_code == 200
    out = {r["person_id"]: r for r in req(c, "POST", "/messaging/recipients", "mia", json={"person_ids": ["u1"]}).json()["recipients"]}
    # mia: message + read + sensitive on entry-a only; u1 is on entry-a + entry-b - visible, NOT messageable
    assert out["u1"]["allowed"] is False
    assert out["u1"]["has_phone"] is None and out["u1"]["consent"] is None and out["u1"]["phone_masked"] is None, out["u1"]


def test_f2_a_names_level_caller_gets_neither_has_phone_nor_consent(mc):
    fake, c, s = mc
    enable(c)
    person(fake, "u3")["phone"] = ""
    mona(c, s)
    named = {r["person_id"]: r for r in req(c, "POST", "/messaging/recipients", "mona", json={"person_ids": ["u1", "u3"]}).json()["recipients"]}
    assert [(r["has_phone"], r["consent"], r["phone_masked"]) for r in named.values()] == [(None, None, None), (None, None, None)]
    assert named["u1"]["allowed"] is True and named["u3"]["allowed"] is True


# ---------------------------------------------------------------- F3: per-sender, per-recipient and per-station caps

def test_f3_one_sender_cannot_exhaust_the_installation_allowance(mc):
    fake, c, s = mc
    enable(c, per_sender_per_hour=2, rate_per_hour=60)
    assert send(c, "u1", text="שלום").status_code == 200
    assert send(c, "u2", text="שלום").status_code == 200
    r = send(c, "u4", text="שלום")
    assert r.status_code == 429 and r.json()["code"] == "message_rate_limited" and r.json()["details"]["scope"] == "sender", r.text
    assert 3000 < r.json()["details"]["retry_after_s"] <= 3600
    assert send(c, "u5", "sam", text="שלום").status_code == 200, "another operator still has the installation's allowance"
    assert len(sent(fake, "whatsapp/send")) == 3
    refused = [a for a in audits(s) if a["decision"] == "denied"]
    assert refused and refused[-1]["reason"] == "message_rate_limited" and details(refused[-1])["phase"] == "refused"


def test_f3_the_same_person_is_not_messaged_past_the_daily_cap_even_under_a_second_record(mc):
    fake, c, _s = mc
    enable(c, per_person_per_day=2)
    assert send(c, "u1", text="אחת").status_code == 200
    assert send(c, "u1", template="closure").status_code == 200
    r = send(c, "u1", text="שלוש")
    assert r.status_code == 429 and r.json()["details"]["scope"] == "person", r.text
    twin(fake, "u1", "x1")  # the same phone on another record
    r = send(c, "x1", text="שלום")
    assert r.status_code == 429 and r.json()["details"]["scope"] == "person", "the cap follows the number, not only the record"
    assert send(c, "u2", text="שלום").status_code == 200
    assert len(sent(fake, "whatsapp/send")) == 3


def test_f3_a_station_is_not_flooded(mc):
    fake, c, _s = mc
    enable(c, per_station_per_hour=2)
    twin(fake, "u5", "x5", phone="+972500000055", assignments={"entry-a": person(fake, "u5")["assignments"]["entry-a"]})
    assert send(c, "u1", text="שלום").status_code == 200  # entry-a + entry-b
    assert send(c, "u5", text="שלום").status_code == 200  # entry-a + entry-c
    r = send(c, "x5", text="שלום")  # entry-a: its third this hour
    assert r.status_code == 429 and r.json()["details"]["scope"] == "station", r.text
    assert send(c, "u4", text="שלום").status_code == 200, "entry-c has had one"


def test_f3_the_new_caps_have_sensible_defaults_ranges_and_survive_an_old_client(mc):
    _fake, c, _s = mc
    cfg = settings_doc(c)
    assert (cfg["per_sender_per_hour"], cfg["per_person_per_day"], cfg["per_station_per_hour"]) == (50, 3, 50)
    assert cfg["send_hours"] == {"from": "08:00", "to": "21:00"}
    for key, bad in (("per_sender_per_hour", 0), ("per_sender_per_hour", 1001), ("per_person_per_day", 0), ("per_person_per_day", 51),
                     ("per_station_per_hour", 0), ("per_station_per_hour", "5"), ("per_person_per_day", True)):
        r = save(c, **{key: bad})
        assert r.status_code == 422 and any(e["path"] == key for e in r.json()["details"]["errors"]), (key, bad, r.text)
    # a client that does not know the new fields (the 2.6.4 editor) keeps them as they are
    assert save(c, per_sender_per_hour=7).status_code == 200
    cur = settings_doc(c)
    old = {k: cur[k] for k in ("enabled", "free_text", "bulk_max", "rate_per_hour", "organization", "account", "templates")}
    r = req(c, "PUT", "/messaging/settings", json={"base_revision": cur["revision"], **old})
    assert r.status_code == 200 and r.json()["settings"]["per_sender_per_hour"] == 7


# ---------------------------------------------------------------- F4: bulk_max holds without the client's bulk_id

@pytest.mark.parametrize("label", ["absent", "rotating"])
def test_f4_the_bulk_limit_holds_whatever_bulk_id_the_client_sends(mc, label):
    fake, c, _s = mc
    enable(c, bulk_max=3)
    codes = []
    for i, pid in enumerate(("u1", "u2", "u4", "u5")):
        extra = {} if label == "absent" else {"bulk_id": f"run-{i:04d}-abcd", "bulk_total": 1}
        codes.append(send(c, pid, template="closure", **extra))
    assert [r.status_code for r in codes[:3]] == [200, 200, 200]
    assert codes[3].status_code == 422 and codes[3].json()["code"] == "message_bulk_too_many", codes[3].text
    assert len(sent(fake, "whatsapp/send")) == 3


# ---------------------------------------------------------------- F5: send hours

def test_f5_nothing_is_sent_outside_the_send_hours(mc, monkeypatch):
    fake, c, s = mc
    enable(c)
    monkeypatch.setattr(M, "hours_now", lambda: JERUSALEM_NIGHT)
    cfg = req(c, "GET", "/messaging", "sam").json()["messaging"]
    assert cfg["send_hours"]["open_now"] is False and cfg["send_hours"]["from"] == "08:00"
    r = send(c, "u1", template="closure")
    assert r.status_code == 409 and r.json()["code"] == "message_outside_hours", r.text
    assert r.json()["details"]["outcome"] == "not_sent" and r.json()["details"]["next_allowed_at"] == "2026-10-15T05:00:00Z"
    assert sent(fake, "whatsapp/preview") == [] and messages(s) == []
    assert audits(s)[-1]["decision"] == "denied" and audits(s)[-1]["reason"] == "message_outside_hours"
    # an administrator may switch the window off (null) - then night sends go
    assert save(c, send_hours=None).status_code == 200
    assert send(c, "u1", template="closure").status_code == 200


@pytest.mark.parametrize("bad", [{"from": "22:00", "to": "06:00"}, {"from": "09:00", "to": "09:00"}, {"from": "9:00", "to": "21:00"}, {"from": "09:00"}, "09-21"])
def test_f5_the_send_hours_follow_the_existing_window_rules(mc, bad):
    _fake, c, _s = mc
    r = save(c, send_hours=bad)
    assert r.status_code == 422 and any(e["path"] == "send_hours" for e in r.json()["details"]["errors"]), r.text


# ---------------------------------------------------------------- F6: the opt-out follows the number; clearing it is an administrator's

def test_f6_an_opt_out_follows_the_phone_number_to_a_second_record(mc):
    fake, c, s = mc
    enable(c)
    assert req(c, "PUT", "/people/u4/messages/optout", json={"opted_out": True}).status_code == 200
    twin(fake, "u4", "x4")
    r = send(c, "x4", text="שלום")
    assert r.status_code == 409 and r.json()["code"] == "message_no_consent", r.text
    assert sent(fake, "whatsapp/send") == []
    stored = json.dumps(rows(s, "SELECT * FROM intercom_message_optout"))
    assert PHONES[3] not in stored and "500000004" not in stored, "the number is kept only as a keyed hash"


def test_f6_clearing_an_opt_out_needs_the_administrators_permission_and_is_audited(mc):
    fake, c, s = mc
    enable(c)
    assert req(c, "PUT", "/people/u5/messages/optout", "sam", json={"opted_out": True}).status_code == 200, "a sender may record the request"
    r = req(c, "PUT", "/people/u5/messages/optout", "sam", json={"opted_out": False})
    assert r.status_code == 403 and r.json()["code"] == "message_optout_clear_forbidden", r.text
    last = audits(s, M.AUDIT_OPTOUT)[-1]
    assert last["decision"] == "denied" and last["reason"] == "message_optout_clear_forbidden" and last["resource_id"] == "u5"
    assert send(c, "u5", "sam", text="שלום").status_code == 409, "still opted out"
    cleared = req(c, "PUT", "/people/u5/messages/optout", "root", json={"opted_out": False})
    assert cleared.status_code == 200 and cleared.json()["opt_out"] is None
    row = audits(s, M.AUDIT_OPTOUT)[-1]
    assert row["decision"] == "allowed" and row["actor_user_id"] == "dev-root" and details(row)["opted_out"] is False
    assert req(c, "GET", "/people/u5/messages", "sam").json()["can_clear_opt_out"] is False
    assert req(c, "GET", "/people/u5/messages", "root").json()["can_clear_opt_out"] is True


# ---------------------------------------------------------------- F1 / F8: the credential guard

EVASIONS = [
    "קוד:\n4821", "קוד 4 8 2 1", "קוד 48 21", "code 48-21", "pincode 4821", "Zugangscode 4821", "PIN code: 4 8 2 1", "P.I.N. 4821",
    "c​ode 4821", "קו​ד 4821", "рin 4821", "код 4821", "пароль 4821", "رمز 4821", "كلمة السر 4821", "mot de passe 4821",
    "pass 4821", "your pin is four eight two one", "הקוד: ארבע-שמונה-שתיים-אחת", "קוד 48²¹", "קוד ①②③④", "סִיסְמָה 4821",
    "קוד לכניסה הראשית בבניין 4821", "PIN ٤٨٢١", "קוד ۴۸۲۱", "пин 4821", "كود 4821",
]


@pytest.mark.parametrize("text", EVASIONS)
def test_f1_the_guard_catches_the_reviews_evasions(text):
    assert M.looks_like_credential(text), text


@pytest.mark.parametrize("text", [
    "הכניסה סגורה בין 12:00 ל־14:00", "שלום דנה, כרטיס הכניסה מוכן", "נפגש ב־15.10.2026 בשעה 09:30", "מספר העובד שלך 1001", "קוד הלבוש: חליפה",
    "תקבלו הודעה נוספת מחר", "Meeting room 3 at 14:00", "{name}, {organization}", "שלום, אחת ושתיים ושלוש", "one two three",
])
def test_f1_ordinary_text_still_passes(text):
    assert not M.looks_like_credential(text), text


def test_f1_a_free_text_evasion_is_refused_at_the_route(mc):
    fake, c, s = mc
    enable(c)
    r = send(c, "u1", text="הקוד שלך:\n4 8 2 1")
    assert r.status_code == 422 and r.json()["code"] == "message_forbidden_content", r.text
    assert sent(fake, "whatsapp/preview") == [] and messages(s) == []


def test_f8_the_organization_and_the_rendered_template_are_credential_checked_at_save(mc):
    _fake, c, _s = mc
    r = save(c, organization="4821", templates=[{"label": "א", "body": "שלום {name}, הקוד שלך {organization}"}])
    assert r.status_code == 422 and {"path": "templates.0.body", "code": "credential"} in r.json()["details"]["errors"], r.text
    r = save(c, organization="קוד 4821")
    assert r.status_code == 422 and {"path": "organization", "code": "credential"} in r.json()["details"]["errors"], r.text


def test_f8_the_rendered_text_is_checked_at_send_time(mc):
    fake, c, s = mc
    enable(c)
    person(fake, "u1")["display_name"] = "קוד 4821"
    r = send(c, "u1", template="card_ready")
    assert r.status_code == 422 and r.json()["code"] == "message_forbidden_content", r.text
    assert sent(fake, "whatsapp/preview") == [] and messages(s) == []
    assert "4821" not in json.dumps(rows(s, "SELECT * FROM audit_log"))


# ---------------------------------------------------------------- F9 / F10 / F11

def test_f9_refusals_count_toward_the_senders_hour(mc):
    fake, c, _s = mc
    enable(c, per_sender_per_hour=2)
    fake.wa_unregistered.update({PHONES[0], PHONES[1]})
    assert send(c, "u1", text="שלום").status_code == 502
    assert send(c, "u2", text="שלום").status_code == 502
    r = send(c, "u4", text="שלום")
    assert r.status_code == 429 and r.json()["details"]["scope"] == "sender", "probing who is on WhatsApp is not free"
    assert req(c, "GET", "/messaging", "root").json()["messaging"]["quota"]["used"] == 0, "the installation's allowance still counts what left only"


def test_f10_the_mask_does_not_tell_the_length_of_the_number():
    assert M.mask_phone("+972500000000") == M.mask_phone("0500000000") == "••••••00"
    assert M.mask_phone("12") is None and M.mask_phone(None) is None


def test_f11_the_previews_refusals_are_audited_and_the_history_lists_fifty(mc):
    fake, c, s = mc
    before = len(audits(s))
    assert req(c, "POST", "/messaging/recipients", json={"person_ids": ["u1"]}).json()["code"] == "message_disabled"
    enable(c)
    assert req(c, "POST", "/messaging/recipients", json={"person_ids": ["bad id/x"]}).status_code == 422
    refused = [a for a in audits(s)[before:] if a["decision"] == "denied"]
    assert [a["reason"] for a in refused] == ["message_disabled", "validation"], refused
    now = datetime.now(timezone.utc)
    with Database(s.db_path).connection() as conn:
        for i in range(40):
            conn.execute("INSERT INTO intercom_messages(id, at, actor_user_id, actor_name, person_id, kind, chars, client_request_id, outcome) VALUES (?, ?, 'dev-root', 'root', 'u5', 'free', 3, ?, 'sent')",
                         (uuid.uuid4().hex, (now - timedelta(days=2, minutes=i)).strftime("%Y-%m-%dT%H:%M:%SZ"), f"hist-{i:04d}"))
    assert len(req(c, "GET", "/people/u5/messages").json()["messages"]) == 40
