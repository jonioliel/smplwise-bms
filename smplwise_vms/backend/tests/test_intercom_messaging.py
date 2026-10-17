"""CR-036 WA: WhatsApp from the people screen - the typed message routes (routers/access_control_messaging.py), Arx's rules
(services/intercom_messaging.py) and the WisKey adapter (services/intercom_messaging_adapter.py), end to end over the add-on's live
service session against the FAKE WisKey (tests/fake_wiskey_messaging.py). Nothing here contacts a device, a station, Home Assistant,
WisKey or a phone; the WisKey side of the contract (ask W11) is unanswered, so every state of it is a switch of the fake.

Owner decisions of 2026-10-12 under test: approved templates AND free text; administrators edit the templates; the free text never
gets a PIN or credential (and no text is ever kept); every send audited (initiator, request id, the person, the outcome - never the text,
a number or a value); bulk send in stage 1. Same identity matrix as tests/test_intercom_adapter.py (root, sam with a deny on entry-b,
otto, vera, sara) plus a names-level sender (`mona`: may message, may not see phone numbers) and a one-station administrator (`mia`)."""
from __future__ import annotations

import json
import logging
import re
import uuid
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pytest
from conftest import as_user, bind
from fake_wiskey import PREFIX
from fake_wiskey_messaging import MessagingWiskey
from fastapi.testclient import TestClient
from intercom_station_scope import station_scope  # noqa: F401 - a fixture
from test_intercom_adapter import audit_rows, sent, wait_for

from smplwise.db import Database
from smplwise.services import intercom_authority as ia
from smplwise.services import intercom_messaging as M
from smplwise.services import intercom_messaging_adapter as A
from smplwise.services import intercom_sync

API = "/api/v1/access-control"
PHONES = ("+972500000000", "+972500000002", "+972500000003", "+972500000004", "+972500000005")


@pytest.fixture()
def mc(settings, monkeypatch, station_scope):  # noqa: F811
    """The app with the messaging fake as its WisKey (the identity-matrix directory) and the principals of the adapter tests."""
    import websockets

    fake = MessagingWiskey("admin", token="t").use_directory()
    monkeypatch.setattr(websockets, "connect", fake.connect)
    monkeypatch.setattr(intercom_sync, "RETRY_S", 0.05)
    monkeypatch.setattr(intercom_sync, "RETRY_MAX_S", 0.2)
    # the send hours (review F5) are checked against this clock: midday in the installation's zone, whenever the suite runs
    monkeypatch.setattr(M, "hours_now", lambda: datetime(2026, 10, 14, 9, 0, tzinfo=timezone.utc), raising=False)
    intercom_sync.SYNC.reset()
    A.MESSAGING.forget()
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="t", ha_core_url="http://ha.local:8123")
    from smplwise.main import create_app

    c = TestClient(create_app(s))
    bind(c, s, "root", "system_admin", "installation", "*")
    bind(c, s, "otto", "operator", "installation", "*")
    bind(c, s, "vera", "viewer", "installation", "*")
    bind(c, s, "sam", "site_admin", "installation", "*")
    c.get("/api/v1/me", headers=as_user("sara"))
    c.get("/api/v1/me", headers=as_user("mia"))
    station_scope.bind("dev-sara", "operator", "entry-a")
    station_scope.bind("dev-sam", "site_admin", "entry-b", effect="deny")
    station_scope.bind("dev-mia", "site_admin", "entry-a")
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    yield fake, c, s
    intercom_sync.SYNC.shutdown()
    if intercom_sync.SYNC.thread is not None:
        intercom_sync.SYNC.thread.join(timeout=5)
    intercom_sync.SYNC.reset()
    A.MESSAGING.forget()


# ---------------------------------------------------------------- helpers

def req(c: TestClient, method: str, path: str, user: str = "root", **kw: Any) -> Any:
    return c.request(method, API + path, headers=as_user(user), **kw)


def settings_doc(c: TestClient) -> dict[str, Any]:
    r = req(c, "GET", "/messaging/settings")
    assert r.status_code == 200, r.text
    return r.json()["settings"]


def save(c: TestClient, **over: Any) -> Any:
    cur = settings_doc(c)
    doc = {k: cur[k] for k in ("enabled", "free_text", "bulk_max", "rate_per_hour", "organization", "account", "templates")}
    return req(c, "PUT", "/messaging/settings", json={"base_revision": cur["revision"], **doc, **over})


def enable(c: TestClient, **over: Any) -> dict[str, Any]:
    r = save(c, enabled=True, **over)
    assert r.status_code == 200, r.text
    return r.json()["settings"]


def revision(c: TestClient) -> int:
    return settings_doc(c)["revision"]


def send(c: TestClient, person: str, user: str = "root", *, template: str | None = None, text: str | None = None, refill: bool = True, **extra: Any) -> Any:
    """One send. The feed's per-user budgets (read 10 + 1 a second, message 6 + 0.5 a second) are what the dialog's pacing stays under;
    a test that sends many in a row refills them first, the tests of the budgets themselves pass `refill=False`."""
    if refill:
        intercom_sync.SYNC._buckets_reset()
    body: dict[str, Any] = {"client_request_id": uuid.uuid4().hex, "confirmed": True, **extra}
    if template is not None:
        body["template_id"] = template
        body.setdefault("templates_revision", revision(c))
    if text is not None:
        body["text"] = text
    return req(c, "POST", f"/people/{person}/messages", user, json=body)


def rows(s: Any, sql: str, *args: Any) -> list[dict[str, Any]]:
    with Database(s.db_path).connection() as conn:
        return [dict(r) for r in conn.execute(sql, args).fetchall()]


def messages(s: Any) -> list[dict[str, Any]]:
    return rows(s, "SELECT * FROM intercom_messages ORDER BY at, rowid")


def person(fake: MessagingWiskey, uid: str) -> dict[str, Any]:
    return next(p for p in fake.directory or [] if p["id"] == uid)


def audits(s: Any, action: str = M.AUDIT_SEND) -> list[dict[str, Any]]:
    return audit_rows(s, action)


def details(row: dict[str, Any]) -> dict[str, Any]:
    return json.loads(row["details_json"]) if row["details_json"] else {}


def mona(c: TestClient, s: Any) -> None:
    """A names-level sender: `access.people.read` and `access.people.message` at installation scope, no `access.people.sensitive`."""
    c.get("/api/v1/me", headers=as_user("mona"))
    role = c.post("/api/v1/access/roles", json={"name": "שולחי הודעות", "permissions": ["access.read", "access.people.read"], "sensitive": ["access.people.message"]})
    assert role.status_code == 201, role.text
    r = c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-mona", "role_id": role.json()["id"], "scope_type": "installation", "scope_id": "*", "effect": "allow"})
    assert r.status_code == 201, r.text


# ---------------------------------------------------------------- the pure rules

@pytest.mark.parametrize("text", [
    "הקוד שלך 4821", "קוד הגישה: 123456", "your PIN is 4821", "PIN: 12345678", "code 4821", "סיסמה 99887", "פין-1234", "passcode  0000", "Password: 55555",
    "{pin}", "{ PIN }", "הכרטיס {card_number}", "{code}", "{password}", "{credential_section}",
])
def test_the_credential_guard_catches_what_reads_like_a_code(text: str):
    assert M.looks_like_credential(text), text


@pytest.mark.parametrize("text", [
    "הכניסה סגורה בין 12:00 ל־14:00", "שלום דנה, כרטיס הכניסה מוכן", "נפגש ב־15.10.2026 בשעה 09:30", "מספר העובד שלך 1001", "קוד הלבוש: חליפה",
    "תקבלו הודעה נוספת מחר", "Meeting room 3 at 14:00", "{name}, {organization}",
])
def test_the_credential_guard_leaves_ordinary_text_alone(text: str):
    assert not M.looks_like_credential(text), text


def test_a_template_is_rendered_in_one_pass_and_a_name_cannot_inject_a_placeholder():
    assert M.render("שלום {name}, ב{organization}.", name="דנה", organization="מגדל") == "שלום דנה, במגדל."
    assert M.render("שלום {name}", name="{organization}", organization="X") == "שלום {organization}"
    assert M.render("שלום {name}", name="דנה\n\tכהן ", organization="") == "שלום דנה כהן"
    assert len(M.render("{name}", name="x" * 500, organization="")) == M.NAME_MAX


def test_the_phone_is_masked_down_to_its_last_two_digits():
    assert M.mask_phone("+972500000000") == "••••••00" and M.mask_phone("050-000-0001").endswith("01")  # fixed width (review F10)
    assert M.mask_phone("12") is None and M.mask_phone(None) is None and M.mask_phone("") is None
    assert "972" not in M.mask_phone("+972500000000")


def test_the_effective_consent():
    assert M.consent_from(False, "unknown") == "unknown" and M.consent_from(False, "granted") == "granted"
    assert M.consent_from(True, "granted") == "declined" and M.consent_from(False, "declined") == "declined"


@pytest.mark.parametrize(("reply", "outcome", "phase", "expected"), [
    ({}, "ok", "send", ("sent", None)),
    ({"last_error": "timeout"}, "unknown", "send", ("unknown", "uncertain")),
    ({"last_error": "whatsapp_send_uncertain"}, "unknown", "send", ("unknown", "uncertain")),
    ({"last_error": "busy"}, "not_sent", "preview", ("not_sent", "rate_limited")),
    ({"last_error": "rate_limited"}, "not_sent", "preview", ("not_sent", "rate_limited")),
    ({"last_error": "expired"}, "not_sent", "preview", ("not_sent", "expired")),
    ({"state": "ha_unavailable"}, "not_sent", "preview", ("not_sent", "service_unavailable")),
    ({"last_error": "whatsapp_unavailable"}, "refused", "preview", ("not_sent", "service_unavailable")),
    ({"last_error": "whatsapp_invalid_phone"}, "refused", "preview", ("not_sent", "not_registered")),
    ({"last_error": "user_not_found"}, "refused", "preview", ("not_sent", "person_not_found")),
    ({"last_error": "action_failed"}, "refused", "preview", ("not_sent", "service_unavailable")),
    ({"last_error": "whatsapp_invalid_phone"}, "refused", "send", ("refused", "not_registered")),
    ({"last_error": "invalid_fields"}, "refused", "send", ("refused", "refused")),
    ({"last_error": "whatsapp_preview_expired"}, "refused", "send", ("not_sent", "expired")),
    ({"last_error": "rate_limited"}, "refused", "send", ("not_sent", "rate_limited")),
    ({"last_error": "whatsapp_unavailable"}, "refused", "send", ("not_sent", "service_unavailable")),
    ({"last_error": "unauthorized", "state": "forbidden"}, "refused", "send", ("not_sent", "service_unavailable")),
])
def test_what_each_answer_of_wiskey_means(reply, outcome, phase, expected):
    r = A.classify(reply, outcome, phase)
    assert (r.outcome, r.code) == expected


def test_only_a_proven_refusal_of_the_send_is_a_refusal():
    """Every code that is not on the list may come AFTER the provider call: the message may have gone out - unknown, never 'refused'."""
    import asyncio

    from smplwise.services.intercom_client import IntercomError, UnclearAnswer

    def frame(code: str) -> dict[str, Any]:
        return {"id": 1, "type": "result", "success": False, "error": {"code": code, "message": code}}

    for code in A.SEND_REFUSED:
        with pytest.raises(IntercomError):
            A._accepted(frame(code))
    for code in ("whatsapp_send_uncertain", "action_failed", "a_code_nobody_knows", "device_unavailable", ""):
        with pytest.raises(UnclearAnswer):
            A._accepted(frame(code))
    with pytest.raises(UnclearAnswer):
        A._accepted({"id": 1, "type": "result", "success": True, "result": {"accepted": False}})
    with pytest.raises(UnclearAnswer):
        A._accepted({"id": 1, "type": "result", "success": True, "result": None})
    assert A._accepted({"id": 1, "type": "result", "success": True, "result": {"accepted": True}}) == {"accepted": True}
    # a preview gives the token and NOTHING else of itself
    assert A._token_of({"id": 1, "type": "result", "success": True, "result": {"token": "abcdefgh1234", "message": "PIN 4821"}}) == "abcdefgh1234"
    for bad in ({"success": True, "result": {"token": "short"}}, {"success": True, "result": {"token": "has space token"}}, {"success": True, "result": {}}, {"success": False}, None):
        with pytest.raises(IntercomError):
            A._token_of(bad)
    assert asyncio.iscoroutinefunction(A._preview_and_send)


# ---------------------------------------------------------------- the catalogue

def test_the_message_permission_is_sensitive_and_held_by_the_two_administrator_roles():
    from smplwise.rbac import ROLES
    from smplwise.routers.access import PERMISSION_LABELS, SENSITIVE

    assert ia.PEOPLE_MESSAGE == "access.people.message" and M.PERMISSION == ia.PEOPLE_MESSAGE
    assert {r for r, perms in ROLES.items() if ia.PEOPLE_MESSAGE in perms} == {"site_admin", "system_admin"}
    assert ia.PEOPLE_MESSAGE in SENSITIVE and ia.PEOPLE_MESSAGE in ia.SENSITIVE_PERMISSIONS
    assert PERMISSION_LABELS[ia.PEOPLE_MESSAGE] == "בקרת כניסה: שליחת הודעות וואטסאפ לאנשים"


def test_every_message_route_gates_on_the_permission_before_the_body_or_the_parameters(mc):
    fake, c, s = mc
    before = len(fake.received)
    calls = [
        ("GET", "/messaging", None), ("POST", "/messaging/recipients", {"person_ids": ["u1"]}), ("GET", "/people/u1/messages", None),
        ("POST", "/people/u1/messages", {"text": "x"}), ("PUT", "/people/u1/messages/optout", {"opted_out": True}),
    ]
    for user in ("vera", "otto", "sara", "nobody"):
        for method, path, body in calls:
            r = req(c, method, path, user, **({"json": body} if body is not None else {}))
            assert r.status_code == 403 and r.json()["code"] == "forbidden", (user, method, path, r.status_code)
    for user in ("vera", "otto"):
        assert req(c, "GET", "/messaging/settings", user).status_code == 403 and req(c, "PUT", "/messaging/settings", user, json={}).status_code == 403
    assert req(c, "GET", "/messaging/settings", "sam").status_code == 403, "the settings are system.configure's (a site administrator holds the permission to MESSAGE, not to configure)"
    assert len(fake.received) == before, "a refused caller never reaches WisKey"
    denied = audits(s, ia.PEOPLE_MESSAGE)
    assert denied and all(r["decision"] == "denied" for r in denied)
    # the body is not even looked at: a malformed one from a refused caller is a 403 too, not a 415 / 422
    r = c.post(API + "/people/u1/messages", headers={**as_user("vera"), "content-type": "text/plain"}, content=b"not json")
    assert r.status_code == 403


# ---------------------------------------------------------------- the administrator's settings and templates

def test_the_settings_start_off_with_three_starter_templates_and_are_the_administrators_alone(mc):
    _fake, c, _s = mc
    r = req(c, "GET", "/messaging/settings")
    body = r.json()
    cfg = body["settings"]
    assert cfg["enabled"] is False, "the master switch is OFF until an administrator turns it on (the WisKey side is unanswered)"
    assert (cfg["free_text"], cfg["bulk_max"], cfg["rate_per_hour"], cfg["organization"], cfg["account"], cfg["revision"]) == (True, 50, 60, "", "", 0)
    assert [t["id"] for t in cfg["templates"]] == ["card_ready", "validity_reminder", "closure"]
    assert body["limits"]["templates_max"] == 20 and body["limits"]["placeholders"] == ["name", "organization"]
    assert body["service"]["connected"] is True and [a["id"] for a in body["service"]["accounts"]] == ["wa-1"]


def test_the_templates_are_not_in_the_general_settings_reply_and_that_reply_cannot_write_them(mc):
    _fake, c, s = mc
    enable(c)
    everyone = c.get("/api/v1/settings", headers=as_user("vera")).json()
    assert "access.messaging" not in json.dumps(everyone) and "card_ready" not in json.dumps(everyone)
    mine = c.get("/api/v1/settings", headers=as_user("root")).json()
    assert "access.messaging" not in mine["settings"]
    c.patch("/api/v1/settings", headers=as_user("root"), json={"access.messaging": json.dumps({"enabled": False, "templates": []})})
    assert settings_doc(c)["enabled"] is True, "PATCH /settings ignores the key: only the validated route writes the document"


BAD = [
    ({"templates": [{"label": "א", "body": "שלום {pin}"}]}, "templates.0.body", "credential"),
    ({"templates": [{"label": "א", "body": "שלום {name}, הקוד שלך 4821"}]}, "templates.0.body", "credential"),
    ({"templates": [{"label": "א", "body": "שלום {phone}"}]}, "templates.0.body", "unknown_placeholder"),
    ({"templates": [{"label": "א", "body": "שלום {name"}]}, "templates.0.body", "bad_braces"),
    ({"templates": [{"label": "א", "body": "שלום }name{"}]}, "templates.0.body", "bad_braces"),
    ({"templates": [{"label": "א", "body": "שלום {organization}"}]}, "templates.0.body", "organization_missing"),
    ({"templates": [{"label": "א", "body": "   "}]}, "templates.0.body", "empty"),
    ({"templates": [{"label": "", "body": "שלום"}]}, "templates.0.label", "empty"),
    ({"templates": [{"label": "ל" * 41, "body": "שלום"}]}, "templates.0.label", "too_long"),
    ({"templates": [{"label": "א", "body": "ב" * 601}]}, "templates.0.body", "too_long"),
    ({"templates": [{"label": "א", "body": "שלום\u0007"}]}, "templates.0.body", "control_chars"),
    ({"templates": [{"label": "א\nב", "body": "שלום"}]}, "templates.0.label", "control_chars"),
    ({"templates": [{"label": "א", "body": "{name}" * 7}]}, "templates.0.body", "too_many_placeholders"),
    ({"templates": [{"label": "א", "body": "ב"}, {"label": "א", "body": "ג"}]}, "templates.1.label", "duplicate_label"),
    ({"templates": [{"id": "x", "label": "א", "body": "ב"}, {"id": "x", "label": "ב", "body": "ג"}]}, "templates.1.id", "duplicate_id"),
    ({"templates": [{"id": "Bad Id!", "label": "א", "body": "ב"}]}, "templates.0.id", "bad_id"),
    ({"templates": [{"label": f"t{i}", "body": "ב"} for i in range(21)]}, "templates", "too_many"),
    ({"templates": "not a list"}, "templates", "type"),
    ({"templates": [5]}, "templates.0", "type"),
    ({"bulk_max": 0}, "bulk_max", "range"),
    ({"bulk_max": 201}, "bulk_max", "range"),
    ({"bulk_max": "5"}, "bulk_max", "type"),
    ({"bulk_max": True}, "bulk_max", "type"),
    ({"rate_per_hour": 0}, "rate_per_hour", "range"),
    ({"rate_per_hour": 1001}, "rate_per_hour", "range"),
    ({"enabled": "yes"}, "enabled", "type"),
    ({"free_text": None}, "free_text", "type"),
    ({"organization": "{name}"}, "organization", "bad_braces"),
    ({"organization": "א" * 61}, "organization", "too_long"),
    ({"account": "a" * 129}, "account", "too_long"),
]


@pytest.mark.parametrize(("over", "path", "code"), BAD, ids=[f"{p}:{c}:{i}" for i, (_o, p, c) in enumerate(BAD)])
def test_the_template_and_settings_validation_names_every_problem(mc, over, path, code):
    _fake, c, _s = mc
    r = save(c, **over)
    assert r.status_code == 422 and r.json()["code"] == "message_settings_invalid", r.text
    assert {"path": path, "code": code} in r.json()["details"]["errors"], r.json()["details"]["errors"]
    assert settings_doc(c)["revision"] == 0, "nothing was stored"


def test_saving_keeps_ids_assigns_new_ones_bumps_the_revision_and_audits_names_only(mc):
    _fake, c, s = mc
    cur = settings_doc(c)
    templates = [dict(cur["templates"][0]), {"label": "הודעה חדשה", "body": "שלום {name}, מדברים מ{organization}."}]
    r = save(c, enabled=True, organization="מגדל הדגמה", templates=templates, bulk_max=10, rate_per_hour=5)
    assert r.status_code == 200, r.text
    new = r.json()["settings"]
    assert new["revision"] == 1 and new["enabled"] is True and (new["bulk_max"], new["rate_per_hour"], new["organization"]) == (10, 5, "מגדל הדגמה")
    assert new["templates"][0]["id"] == "card_ready" and re.fullmatch(r"t[0-9a-f]{8}", new["templates"][1]["id"])
    row = audits(s, M.AUDIT_SETTINGS)[-1]
    assert row["decision"] == "allowed" and row["actor_user_id"] == "dev-root" and row["request_id"]
    d = details(row)
    assert d == {"revision": 1, "changed": ["bulk_max", "enabled", "organization", "rate_per_hour", "templates"], "enabled": True, "templates": 2}
    assert "מדברים" not in row["details_json"] and "מגדל הדגמה" not in row["details_json"], "the audit row names fields and counts, never a body or a value"
    # saving the same document again changes nothing but the revision
    again = save(c).json()["settings"]
    assert again["revision"] == 2 and details(audits(s, M.AUDIT_SETTINGS)[-1])["changed"] == []


def test_a_stale_base_revision_is_a_conflict_and_nothing_is_overwritten(mc):
    _fake, c, _s = mc
    cur = settings_doc(c)
    doc = {k: cur[k] for k in ("enabled", "free_text", "bulk_max", "rate_per_hour", "organization", "account", "templates")}
    assert req(c, "PUT", "/messaging/settings", json={"base_revision": 0, **doc, "bulk_max": 7}).status_code == 200
    r = req(c, "PUT", "/messaging/settings", json={"base_revision": 0, **doc, "bulk_max": 9})
    assert r.status_code == 409 and r.json()["code"] == "message_settings_conflict" and r.json()["details"]["revision"] == 1
    assert settings_doc(c)["bulk_max"] == 7


def test_a_corrupt_stored_document_reads_as_off(mc):
    fake, c, s = mc
    enable(c)
    with Database(s.db_path).connection() as conn:
        conn.execute("UPDATE settings SET value = ? WHERE key = ?", ('{"enabled": true, "templates": [{"id": "x", "label": "a", "body": "הקוד שלך {pin}"}]}', M.SETTING_KEY))
    cfg = settings_doc(c)
    assert cfg["enabled"] is False and [t["id"] for t in cfg["templates"]] == ["card_ready", "validity_reminder", "closure"], "fail closed: off, with the starter templates"
    with Database(s.db_path).connection() as conn:
        conn.execute("UPDATE settings SET value = 'not json' WHERE key = ?", (M.SETTING_KEY,))
    assert settings_doc(c)["enabled"] is False
    assert send(c, "u1", text="שלום").status_code == 409, "nothing is sent while the document is unreadable"
    assert sent(fake, "whatsapp/send") == []


# ---------------------------------------------------------------- the dialog's configuration

def test_with_the_feature_off_nothing_is_asked_of_wiskey_and_no_template_is_served(mc):
    fake, c, _s = mc
    body = req(c, "GET", "/messaging", "sam").json()["messaging"]
    assert body["feature"] is False and body["enabled"] is False and body["can_send"] is False and body["templates"] == [] and body["quota"] is None
    assert sent(fake, "whatsapp/status") == []
    assert req(c, "POST", "/messaging/recipients", "sam", json={"person_ids": ["u1"]}).json()["code"] == "message_disabled"
    r = send(c, "u1", "sam", text="שלום")
    assert r.status_code == 409 and r.json()["code"] == "message_disabled" and r.json()["details"]["outcome"] == "not_sent"
    assert sent(fake, "whatsapp/send") == [] and messages(_s) == []
    assert audits(_s)[-1]["decision"] == "denied" and audits(_s)[-1]["reason"] == "message_disabled"


def test_the_configuration_for_a_sender(mc):
    fake, c, _s = mc
    enable(c, organization="מגדל", bulk_max=12, rate_per_hour=30, free_text=False)
    m = req(c, "GET", "/messaging", "sam").json()
    cfg = m["messaging"]
    assert m["state"] == "ready" and cfg["feature"] is True and cfg["enabled"] is True and cfg["can_send"] is True
    assert cfg["free_text"] is False and cfg["bulk_max"] == 12 and cfg["text_max"] == 1000 and cfg["pace_ms"] == M.PACE_MS
    assert [t["id"] for t in cfg["templates"]] == ["card_ready", "validity_reminder", "closure"] and cfg["templates_revision"] == 1
    assert cfg["quota"] == {"limit": 30, "used": 0, "resets_in_s": 0} and cfg["can_reveal_phone"] is True
    frames = sent(fake, "whatsapp/status")
    assert frames and all(f.get("api_contract") == 1 for f in frames) and set(frames[0]) == {"id", "type", "api_contract"}
    n = len(frames)
    req(c, "GET", "/messaging", "sam")
    assert len(sent(fake, "whatsapp/status")) == n, "the service's state is cached for a few seconds"


def test_the_dialog_gets_the_templates_with_the_organization_filled_in(mc):
    """`{organization}` is the administrator's own setting, not a secret: the dialog gets it filled in, so the text a sender sees - and may
    edit into a free text, which the server never renders - is the text that goes out. `{name}` stays for the person; the editor keeps both."""
    fake, c, _s = mc
    saved = enable(c, organization="מגדל הדגמה", templates=[{"label": "הודעה", "body": "שלום {name}, מדברים מ{organization}."}])
    assert saved["templates"][0]["body"] == "שלום {name}, מדברים מ{organization}."  # the stored document and the editor keep the placeholder
    assert settings_doc(c)["templates"][0]["body"] == "שלום {name}, מדברים מ{organization}."
    cfg = req(c, "GET", "/messaging", "root").json()["messaging"]
    (t,) = cfg["templates"]
    assert t["body"] == "שלום {name}, מדברים ממגדל הדגמה." and (t["id"], t["label"]) == (saved["templates"][0]["id"], "הודעה")
    r = send(c, "u1", template=t["id"], templates_revision=cfg["templates_revision"])
    assert r.status_code == 200, r.text
    assert fake.wa_sent[-1]["text"] == "שלום Dana, מדברים ממגדל הדגמה."  # what the sender saw, with the person's name


def test_the_service_states_the_dialog_must_say(mc):
    fake, c, _s = mc
    enable(c)
    fake.wa_available = False
    A.MESSAGING.forget()
    cfg = req(c, "GET", "/messaging", "sam").json()["messaging"]
    assert cfg["feature"] is True and cfg["enabled"] is False, "switched on but not connected: the dialog says so"
    fake.wa_available = True
    fake.wa_accounts = [{"id": "wa-1", "name": "Office"}, {"id": "wa-2", "name": "Spare"}]
    A.MESSAGING.forget()
    assert req(c, "GET", "/messaging", "sam").json()["messaging"]["enabled"] is False, "several accounts and none chosen: no message leaves from a number nobody picked"
    assert req(c, "GET", "/messaging/settings").json()["service"]["problem"] == "account_required"
    save(c, account="wa-2")
    assert req(c, "GET", "/messaging", "sam").json()["messaging"]["enabled"] is True
    save(c, account="gone")
    assert req(c, "GET", "/messaging", "sam").json()["messaging"]["enabled"] is False
    save(c, account="")
    fake.wa_accounts = None
    A.MESSAGING.forget()
    assert req(c, "GET", "/messaging", "sam").json()["messaging"]["enabled"] is True


def test_a_wiskey_that_does_not_list_the_commands_hides_the_feature_without_a_call(mc):
    fake, c, s = mc
    enable(c)
    fake.unlist("whatsapp/send")
    fake.push("refresh")
    wait_for(lambda: "whatsapp/send" not in (intercom_sync.SYNC.api_facts(s) or {}).get("commands", frozenset({"whatsapp/send"})))
    A.MESSAGING.forget()
    before = len(fake.received)
    cfg = req(c, "GET", "/messaging", "sam").json()["messaging"]
    assert cfg["enabled"] is False
    assert not [m for m in fake.received[before:] if m.get("type", "").startswith(PREFIX + "whatsapp/")], "no frame is sent for a command WisKey does not list"
    r = send(c, "u1", "root", text="שלום")
    assert r.status_code == 503 and r.json()["code"] == "message_service_unavailable"
    assert messages(s) == [] and sent(fake, "whatsapp/send") == []


# ---------------------------------------------------------------- the preview of a selection

def test_the_preview_of_a_selection_by_level(mc):
    fake, c, s = mc
    enable(c)
    person(fake, "u3")["phone"] = ""
    person(fake, "u2")["whatsapp_consent"] = "declined"
    person(fake, "u4")["whatsapp_consent"] = "granted"
    ids = ["u1", "u2", "u3", "u4", "nobody", "u1"]
    out = req(c, "POST", "/messaging/recipients", "root", json={"person_ids": ids}).json()["recipients"]
    by = {r["person_id"]: r for r in out}
    assert list(by) == ["u1", "u2", "u3", "u4"], "an unknown person is not listed; a repeated one once"
    assert by["u1"] == {"person_id": "u1", "name": "Dana", "phone_masked": "••••••00", "has_phone": True, "consent": "unknown", "allowed": True}
    assert by["u2"]["consent"] == "declined" and by["u3"]["has_phone"] is False and by["u3"]["phone_masked"] is None and by["u4"]["consent"] == "granted"
    assert not any(p in json.dumps(out) for p in PHONES), "a number never leaves in full"
    # Arx's own opt-out list joins WisKey's
    assert req(c, "PUT", "/people/u5/messages/optout", json={"opted_out": True}).status_code == 200
    assert {r["person_id"]: r["consent"] for r in req(c, "POST", "/messaging/recipients", json={"person_ids": ["u5"]}).json()["recipients"]} == {"u5": "declined"}
    # a names-level sender: the same eligibility, and no masked number, no "has a phone", no consent (review F2: `phone_set` is a
    # sensitive field everywhere else; the send answers message_no_phone / message_no_consent for itself)
    mona(c, s)
    named = req(c, "POST", "/messaging/recipients", "mona", json={"person_ids": ["u1", "u3"]}).json()["recipients"]
    assert [(r["person_id"], r["phone_masked"], r["has_phone"], r["consent"], r["allowed"]) for r in named] == [("u1", None, None, None, True), ("u3", None, None, None, True)]
    assert req(c, "GET", "/messaging", "mona").json()["messaging"]["can_reveal_phone"] is False


def test_the_preview_looks_at_ten_people_and_validates_its_input(mc):
    fake, c, _s = mc
    enable(c)
    fake.directory.extend({**person(fake, "u1"), "id": f"x{i}", "display_name": f"X{i}"} for i in range(12))
    ids = [f"x{i}" for i in range(12)]
    intercom_sync.SYNC._buckets_reset()  # (the sender's read budget is a burst of 10 tokens)
    n = len(sent(fake, "users/get"))
    out = req(c, "POST", "/messaging/recipients", json={"person_ids": ids}).json()["recipients"]
    assert len(out) == M.RECIPIENT_READS == 6 and len(sent(fake, "users/get")) - n == M.RECIPIENT_READS, "the rest are decided as each message goes"
    for bad in ({"person_ids": []}, {"person_ids": ["bad id/with slash"]}, {"person_ids": ["a"] * 201}, {"person_ids": "u1"}, {"person_ids": ["u1"], "extra": 1}):
        assert req(c, "POST", "/messaging/recipients", json=bad).status_code == 422, bad


def test_the_preview_shows_nobody_off_the_callers_chain(mc):
    fake, c, _s = mc
    enable(c)
    out = {r["person_id"]: r for r in req(c, "POST", "/messaging/recipients", "mia", json={"person_ids": ["u1", "u4", "u5", "u3", "nobody"]}).json()["recipients"]}
    # mia: message + people.read + sensitive on entry-a ONLY. u1 (entry-a + entry-b) is visible but not messageable; u5 (entry-a + entry-c)
    # likewise; u4 (entry-c) and u3 (no station) are invisible - exactly like an id that does not exist
    assert set(out) == {"u1", "u5"} and out["u1"]["allowed"] is False and out["u5"]["allowed"] is False


# ---------------------------------------------------------------- a send

def test_a_template_send_hands_wiskey_arxs_own_text_and_records_who_and_what_but_never_the_text(mc, caplog):
    fake, c, s = mc
    enable(c, organization="מגדל")
    caplog.set_level(logging.DEBUG)
    r = send(c, "u1", template="card_ready")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["message"]["outcome"] == "sent" and re.fullmatch(r"[0-9a-f]{32}", body["message"]["id"]) and body["quota"]["used"] == 1
    previews, sends = sent(fake, "whatsapp/preview"), sent(fake, "whatsapp/send")
    assert len(previews) == 1 and len(sends) == 1
    assert previews[0]["user_id"] == "u1" and previews[0]["account"] == "wa-1" and previews[0]["language"] == "he" and previews[0]["api_contract"] == 1
    assert sends[0]["message"] == "שלום Dana, כרטיס הכניסה שלך מוכן לאיסוף." and sends[0]["confirmed"] is True and sends[0]["api_contract"] == 1
    assert sends[0]["token"].startswith("wa-token-") and sends[0]["user_id"] == "u1"
    assert fake.wa_sent == [{"user": "u1", "account": "wa-1", "text": "שלום Dana, כרטיס הכניסה שלך מוכן לאיסוף.", "uncertain": False}]
    # the record and the audit trail: who, which person, which template, how long, what happened - and not a word of the message
    (m,) = messages(s)
    assert (m["actor_user_id"], m["person_id"], m["kind"], m["template_id"], m["template_label"], m["outcome"]) == ("dev-root", "u1", "template", "card_ready", "כרטיס מוכן", "sent")
    assert m["chars"] == len("שלום Dana, כרטיס הכניסה שלך מוכן לאיסוף.") and m["template_revision"] == 1 and m["request_id"]
    a1, a2 = audits(s)[-2:]
    assert [details(a1)["phase"], details(a2)["phase"]] == ["attempt", "outcome"] and details(a2)["outcome"] == "sent"
    assert a1["actor_user_id"] == "dev-root" and a1["resource_type"] == "intercom_person" and a1["resource_id"] == "u1" and a1["request_id"] == a2["request_id"] == m["request_id"]
    assert details(a1)["message_id"] == details(a2)["message_id"] == m["id"] and details(a1)["template_id"] == "card_ready"
    everything = json.dumps({"audit": rows(s, "SELECT * FROM audit_log"), "messages": messages(s), "optout": rows(s, "SELECT * FROM intercom_message_optout")}, ensure_ascii=False)
    for secret in ("כרטיס הכניסה שלך מוכן", "Dana, כרטיס", PHONES[0], "wa-token", "מדברים"):
        assert secret not in everything, secret
    assert "wa-token" not in caplog.text and PHONES[0] not in caplog.text and "כרטיס הכניסה שלך מוכן" not in caplog.text


def test_a_free_text_goes_out_as_typed_and_only_its_length_is_kept(mc):
    fake, c, s = mc
    enable(c)
    r = send(c, "u2", text="  שלום אבי,\r\nאפשר לעבור במשרד?  ")
    assert r.status_code == 200, r.text
    assert sent(fake, "whatsapp/send")[0]["message"] == "שלום אבי,\nאפשר לעבור במשרד?"
    (m,) = messages(s)
    assert (m["kind"], m["template_id"], m["template_label"], m["chars"]) == ("free", None, None, len("שלום אבי,\nאפשר לעבור במשרד?"))
    assert "אפשר לעבור" not in json.dumps(rows(s, "SELECT * FROM audit_log"), ensure_ascii=False)


@pytest.mark.parametrize(("body", "status", "code"), [
    ({"text": ""}, 422, "message_empty"), ({"text": "   \n  "}, 422, "message_empty"), ({"text": "x" * 1001}, 422, "message_too_long"),
    ({"text": "הקוד שלך 4821"}, 422, "message_forbidden_content"), ({"text": "your PIN: 123456"}, 422, "message_forbidden_content"),
    ({"text": "שלום {pin}"}, 422, "message_forbidden_content"), ({"text": "שלום\u0007"}, 422, "message_forbidden_content"),
    ({"template_id": "nope"}, 422, "message_template_unknown"), ({"template_id": "closure", "templates_revision": 99}, 409, "message_template_changed"),
    ({"template_id": "closure"}, 409, "message_template_changed"), ({"template_id": "closure", "text": "אחר"}, 422, "validation"),
    ({"client_request_id": "short"}, 422, "validation"), ({"text": "שלום", "bogus": 1}, 422, "validation"), ({"text": "שלום", "confirmed": False}, 409, "confirmation_required"),
    ({"text": "שלום", "confirmed": "true"}, 409, "confirmation_required"),
])
def test_a_text_that_may_not_go_is_refused_before_wiskey_hears_of_it(mc, body, status, code):
    fake, c, s = mc
    enable(c)
    base = {"client_request_id": uuid.uuid4().hex, "confirmed": True}
    if "template_id" in body and "templates_revision" not in body and code != "message_template_changed":
        body = {**body, "templates_revision": revision(c)}
    r = req(c, "POST", "/people/u1/messages", json={**base, **body})
    assert (r.status_code, r.json()["code"]) == (status, code), r.text
    assert r.json()["details"].get("outcome", "not_sent") == "not_sent"
    assert sent(fake, "whatsapp/preview") == [] and sent(fake, "whatsapp/send") == [] and messages(s) == []
    last = audits(s)[-1]
    assert last["decision"] == "denied" and details(last)["phase"] == "refused" and details(last)["outcome"] == "not_sent"
    assert "הקוד שלך" not in last["details_json"] and "4821" not in json.dumps(rows(s, "SELECT * FROM audit_log"))


def test_free_text_can_be_switched_off_templates_stay(mc):
    fake, c, _s = mc
    enable(c, free_text=False)
    r = send(c, "u1", text="שלום")
    assert r.status_code == 403 and r.json()["code"] == "message_free_text_disabled"
    assert send(c, "u1", template="closure").status_code == 200
    assert req(c, "GET", "/messaging", "sam").json()["messaging"]["free_text"] is False


def test_a_json_body_is_required(mc):
    fake, c, s = mc
    enable(c)
    r = c.post(f"{API}/people/u1/messages", headers={**as_user("root"), "content-type": "text/plain"}, content=json.dumps({"client_request_id": uuid.uuid4().hex, "confirmed": True, "text": "שלום"}))
    assert r.status_code == 415 and sent(fake, "whatsapp/send") == []
    r = c.post(f"{API}/people/u1/messages", headers={**as_user("root"), "content-type": "application/json"}, content=b"{not json")
    assert r.status_code == 422 and audits(s)[-1]["decision"] == "denied"


def test_a_pin_in_wiskeys_preview_never_reaches_the_response_the_record_the_audit_or_the_logs(mc, caplog):
    """rc.37's `whatsapp/preview` returns the message WisKey builds for the renewal flow - with the person's PIN in it. The adapter asks
    for the preview only to get the one-use token."""
    fake, c, s = mc
    enable(c)
    fake.wa_preview_pin = "4821"
    caplog.set_level(logging.DEBUG)
    r = send(c, "u1", template="closure")
    assert r.status_code == 200
    out = sent(fake, "whatsapp/send")[0]["message"]
    assert out == "שלום Dana, הכניסה סגורה זמנית. נעדכן כשתיפתח שוב." and "4821" not in out and "קוד הגישה" not in out
    everything = json.dumps({"audit": rows(s, "SELECT * FROM audit_log"), "messages": messages(s), "settings": rows(s, "SELECT * FROM settings")}, ensure_ascii=False)
    assert "4821" not in r.text and "4821" not in everything and "4821" not in caplog.text and "קוד הגישה" not in r.text
    # and when the SEND is refused or its outcome is unknown, the error bodies do not carry it either
    fake.errors_once["whatsapp/send"] = "whatsapp_send_uncertain"
    r = send(c, "u1", template="closure")
    assert r.status_code == 504 and "4821" not in r.text and "4821" not in caplog.text


# ---------------------------------------------------------------- who may be messaged

def test_no_phone_no_consent_and_the_opt_out_list(mc):
    fake, c, s = mc
    enable(c)
    person(fake, "u3")["phone"] = ""
    r = send(c, "u3", text="שלום")
    assert r.status_code == 422 and r.json()["code"] == "message_no_phone"
    person(fake, "u2")["whatsapp_consent"] = "declined"
    r = send(c, "u2", text="שלום")
    assert r.status_code == 409 and r.json()["code"] == "message_no_consent"
    assert sent(fake, "whatsapp/preview") == [] and sent(fake, "whatsapp/send") == [] and messages(s) == []
    # Arx's own list: marked -> refused whatever WisKey says; cleared -> sent
    assert send(c, "u4", text="שלום").status_code == 200
    put = req(c, "PUT", "/people/u4/messages/optout", json={"opted_out": True})
    assert put.status_code == 200 and put.json()["consent"] == "declined" and put.json()["opt_out"]["by"] == "root"
    r = send(c, "u4", text="שלום שוב")
    assert r.status_code == 409 and r.json()["code"] == "message_no_consent"
    hist = req(c, "GET", "/people/u4/messages").json()
    assert hist["opt_out"]["by"] == "root" and hist["consent"] == "declined" and len(hist["messages"]) == 1
    cleared = req(c, "PUT", "/people/u4/messages/optout", json={"opted_out": False})
    assert cleared.json() == {"opt_out": None, "consent": "unknown"}
    assert send(c, "u4", text="שלום שוב").status_code == 200
    optouts = audits(s, M.AUDIT_OPTOUT)
    assert [details(r) for r in optouts] == [{"opted_out": True}, {"opted_out": False, "cleared": 1}] and all(r["resource_id"] == "u4" for r in optouts)
    assert req(c, "PUT", "/people/u4/messages/optout", json={"opted_out": "yes"}).status_code == 422


def test_a_person_the_caller_may_not_see_is_not_found_and_one_they_may_not_message_is_forbidden(mc):
    fake, c, s = mc
    enable(c)
    missing = send(c, "nobody", "root", text="שלום")
    hidden = send(c, "u4", "mia", text="שלום")  # entry-c only: invisible to mia
    nobody_visible = send(c, "u3", "mia", text="שלום")  # no station: only an unrestricted caller sees them
    for r in (missing, hidden, nobody_visible):
        assert r.status_code == 404 and r.json()["code"] == "intercom_person_not_found"
    strip = lambda r: {k: v for k, v in r.json().items() if k != "correlation_id"}  # noqa: E731
    assert strip(missing) == strip(hidden) == strip(nobody_visible), "the same answer: no existence oracle"
    shared = send(c, "u1", "mia", text="שלום")  # entry-a + entry-b: visible through entry-a, but mia may message on entry-a only
    assert shared.status_code == 403 and shared.json()["code"] == "message_forbidden"
    own = person(fake, "u5")
    own["assignments"] = {"entry-a": own["assignments"]["entry-a"]}
    assert send(c, "u5", "mia", text="שלום").status_code == 200, "a person of that one station can be messaged"
    # sam: site administrator with a deny on entry-b - entry-b's people are not his, a person shared with it is not his to message
    assert send(c, "u2", "sam", text="שלום").status_code == 404
    assert send(c, "u1", "sam", text="שלום").status_code == 403
    assert sent(fake, "whatsapp/send") and len(sent(fake, "whatsapp/send")) == 1
    assert [m["person_id"] for m in messages(s)] == ["u5"]


def test_a_sender_who_may_not_see_phone_numbers_still_sends_and_never_sees_one(mc):
    fake, c, s = mc
    enable(c)
    mona(c, s)
    cfg = req(c, "GET", "/messaging", "mona").json()["messaging"]
    assert cfg["can_send"] is True and cfg["can_reveal_phone"] is False
    r = send(c, "u1", "mona", template="closure")
    assert r.status_code == 200 and not any(p in r.text for p in PHONES)
    hist = req(c, "GET", "/people/u1/messages", "mona")
    assert hist.status_code == 200 and hist.json()["messages"][0]["by"] == "mona" and not any(p in hist.text for p in PHONES)
    assert messages(s)[0]["actor_user_id"] == "dev-mona"


# ---------------------------------------------------------------- what can go wrong at WisKey

def test_the_service_not_connected_sends_nothing_and_leaves_no_record(mc):
    fake, c, s = mc
    enable(c)
    fake.wa_available = False
    A.MESSAGING.forget()
    r = send(c, "u1", text="שלום")
    assert r.status_code == 503 and r.json()["code"] == "message_service_unavailable" and r.json()["details"]["outcome"] == "not_sent"
    assert sent(fake, "whatsapp/preview") == [] and messages(s) == [] and audits(s)[-1]["decision"] == "denied"


def test_a_refusal_of_the_number_is_kept_as_not_sent_and_the_rest_of_the_states(mc):
    fake, c, s = mc
    enable(c)
    fake.wa_unregistered.add(PHONES[0])
    r = send(c, "u1", text="שלום")
    assert r.status_code == 502 and r.json()["code"] == "message_not_registered" and r.json()["details"]["outcome"] == "refused"
    (m,) = messages(s)
    assert (m["outcome"], m["reason"]) == ("refused", "not_registered")
    assert details(audits(s)[-1])["outcome"] == "refused" and details(audits(s)[-1])["wiskey_code"] == "whatsapp_invalid_phone"
    assert len(sent(fake, "whatsapp/send")) == 1, "one attempt: a refusal is not retried"
    # the token went stale between the two commands of the exchange (the person's record changed): nothing was sent, no record, 410
    fake.errors_once["whatsapp/send"] = "whatsapp_preview_expired"
    r = send(c, "u2", text="שלום")
    assert r.status_code == 410 and r.json()["code"] == "message_expired" and r.json()["details"]["outcome"] == "not_sent"
    assert [x["person_id"] for x in messages(s)] == ["u1"], "a message that provably never left leaves no record"
    # the preview fails (the service dropped): nothing was sent either
    fake.errors_once["whatsapp/preview"] = "whatsapp_unavailable"
    r = send(c, "u2", text="שלום")
    assert r.status_code == 503 and r.json()["details"]["outcome"] == "not_sent" and [x["person_id"] for x in messages(s)] == ["u1"]
    assert len(sent(fake, "whatsapp/send")) == 2, "the failed preview never reached the send"
    # WisKey's own limiter: burst - wait and it passes
    fake.errors_once["whatsapp/preview"] = "rate_limited"
    r = send(c, "u2", text="שלום")
    assert r.status_code == 429 and r.json()["code"] == "message_rate_limited" and r.json()["details"]["scope"] == "burst" and r.json()["details"]["retry_after_s"] == 5
    assert send(c, "u2", text="שלום").status_code == 200


def test_an_unknown_outcome_is_said_so_recorded_and_never_retried(mc):
    fake, c, s = mc
    enable(c)
    fake.wa_uncertain.add("u1")
    r = send(c, "u1", text="שלום")
    assert r.status_code == 504 and r.json()["code"] == "message_uncertain" and r.json()["details"]["outcome"] == "unknown"
    assert len(sent(fake, "whatsapp/send")) == 1, "never retried"
    (m,) = messages(s)
    assert (m["outcome"], m["reason"]) == ("unknown", "uncertain")
    assert details(audits(s)[-1])["outcome"] == "unknown" and details(audits(s)[-1])["wiskey_code"] == "whatsapp_send_uncertain"
    assert req(c, "GET", "/people/u1/messages").json()["messages"][0]["outcome"] == "unknown"
    # an unknown WisKey code at the send is unknown too (it may have come after the provider call); a timeout as well
    fake.errors_once["whatsapp/send"] = "a_code_nobody_knows"
    r = send(c, "u2", text="שלום")
    assert r.status_code == 504 and r.json()["details"]["outcome"] == "unknown"


def test_a_slow_wiskey_is_a_timeout_and_a_timeout_is_unknown(mc, monkeypatch):
    fake, c, s = mc
    enable(c)
    monkeypatch.setattr(intercom_sync, "MESSAGE_TIMEOUT_S", 0.3)
    fake.slow = 1.0
    fake.slow_commands = {"whatsapp/send"}
    r = send(c, "u1", text="שלום")
    assert r.status_code == 504 and r.json()["details"]["outcome"] == "unknown"
    assert messages(s)[0]["outcome"] == "unknown"


def test_the_feeds_own_budget_is_a_burst_refusal_that_leaves_no_record(mc):
    fake, c, s = mc
    enable(c)
    for _ in range(int(intercom_sync.MESSAGE_USER_BURST)):
        assert intercom_sync.SYNC._spend_token("dev-root", "message")
    r = send(c, "u1", text="שלום", refill=False)
    assert r.status_code == 429 and r.json()["details"]["scope"] == "burst" and r.json()["details"]["outcome"] == "not_sent"
    assert sent(fake, "whatsapp/preview") == [] and messages(s) == []
    outcome = [details(a) for a in audits(s)][-1]
    assert outcome["phase"] == "outcome" and outcome["outcome"] == "not_sent"


def test_messages_have_a_lane_of_their_own(mc):
    """A send in progress holds the message slot only: a door release's and a people save's slots stay free."""
    fake, c, s = mc
    enable(c)
    assert intercom_sync.SYNC._message_inflight.acquire(blocking=False)
    try:
        r = send(c, "u1", text="שלום")
        assert r.status_code == 429 and r.json()["details"]["wiskey_code"] == "busy" and r.json()["details"]["outcome"] == "not_sent"
        for lane in (intercom_sync.SYNC._action_inflight, intercom_sync.SYNC._config_inflight, intercom_sync.SYNC._capture_inflight, intercom_sync.SYNC._inflight):
            assert lane.acquire(blocking=False)
            lane.release()
    finally:
        intercom_sync.SYNC._message_inflight.release()
    assert messages(s) == []


def test_the_adapter_sends_only_its_three_commands_each_with_the_client_api(mc):
    fake, c, _s = mc
    enable(c)
    send(c, "u1", text="שלום")
    req(c, "GET", "/people/u1/messages")
    req(c, "POST", "/messaging/recipients", json={"person_ids": ["u1", "u2"]})
    used = {m["type"][len(PREFIX):] for m in fake.received if m.get("type", "").startswith(PREFIX + "whatsapp/")}
    assert used == {"whatsapp/status", "whatsapp/preview", "whatsapp/send"}, "never the history, the media or the template commands"
    for m in fake.received:
        if m.get("type", "").startswith(PREFIX + "whatsapp/"):
            assert m["api_contract"] == 1
    assert {n: getattr(call, "channel", None) for n, call in intercom_sync.SYNC._channel_calls.items()}["messaging"] == "messaging"


# ---------------------------------------------------------------- the allowance, duplicates and a bulk run

def test_the_hourly_allowance_counts_what_left_and_resets(mc):
    fake, c, s = mc
    enable(c, rate_per_hour=2)
    assert send(c, "u1", text="a").status_code == 200
    fake.wa_unregistered.add(PHONES[1])
    assert send(c, "u2", text="a").status_code == 502, "a refusal by the service sent nothing and does not count"
    r = send(c, "u3", text="a")
    assert r.status_code == 200 and r.json()["quota"] == {"limit": 2, "used": 2, "resets_in_s": r.json()["quota"]["resets_in_s"]}
    r = send(c, "u4", text="a")
    assert r.status_code == 429 and r.json()["code"] == "message_rate_limited" and r.json()["details"]["scope"] == "hour"
    assert 3000 < r.json()["details"]["retry_after_s"] <= 3600 and r.json()["details"]["quota"]["used"] == 2
    assert len(sent(fake, "whatsapp/send")) == 3 and [m["person_id"] for m in messages(s)] == ["u1", "u2", "u3"]
    cfg = req(c, "GET", "/messaging", "sam").json()["messaging"]
    assert cfg["quota"]["used"] == 2
    old = (datetime.now(timezone.utc) - timedelta(minutes=61)).strftime("%Y-%m-%dT%H:%M:%SZ")
    with Database(s.db_path).connection() as conn:
        conn.execute("UPDATE intercom_messages SET at = ? WHERE person_id = 'u1'", (old,))
    assert send(c, "u4", text="a").status_code == 200, "the hour moved on"
    # WisKey's own allowance, when it reports a tighter one, is the one the dialog shows
    fake.wa_quota = {"limit": 5, "used": 4}
    A.MESSAGING.forget()
    save(c, rate_per_hour=100)
    assert req(c, "GET", "/messaging", "sam").json()["messaging"]["quota"]["limit"] == 5


def test_the_same_request_id_is_refused_the_second_time_and_sends_once(mc):
    fake, c, s = mc
    enable(c)
    body = {"client_request_id": "retry-me-0001", "confirmed": True, "text": "שלום"}
    assert req(c, "POST", "/people/u1/messages", json=body).status_code == 200
    r = req(c, "POST", "/people/u1/messages", json=body)
    assert r.status_code == 409 and r.json()["code"] == "message_duplicate" and r.json()["details"]["outcome"] == "not_sent"
    assert len(sent(fake, "whatsapp/send")) == 1 and len(messages(s)) == 1
    # the id belongs to the sender: another user may use the same string
    assert req(c, "POST", "/people/u5/messages", "sam", json=body).status_code == 200


def test_a_bulk_run_is_one_message_to_many_people_one_at_a_time_and_a_failure_stops_nobody(mc):
    fake, c, s = mc
    enable(c, bulk_max=3)
    person(fake, "u3")["phone"] = ""
    bulk = "bulk-run-0001"
    results = {pid: send(c, pid, template="closure", bulk_id=bulk, bulk_total=3) for pid in ("u1", "u3", "u4")}
    assert [r.status_code for r in results.values()] == [200, 422, 200]
    assert results["u3"].json()["code"] == "message_no_phone"
    assert [m["person_id"] for m in messages(s)] == ["u1", "u4"] and {m["bulk_id"] for m in messages(s)} == {bulk}
    attempts = [details(a) for a in audits(s) if details(a).get("phase") == "attempt"]
    assert [a["bulk_id"] for a in attempts] == [bulk, bulk]
    # the run's size is the administrator's limit and the declared total, and every message of it is the same one
    third = send(c, "u2", template="closure", bulk_id=bulk, bulk_total=3)
    assert third.status_code == 200
    again = send(c, "u5", template="closure", bulk_id=bulk, bulk_total=3)
    assert again.status_code == 422 and again.json()["code"] == "message_bulk_too_many"
    # (the server's own run window - review F4 - counts this sender's last 10 minutes whatever bulk_id says: the next run starts later)
    later = (datetime.now(timezone.utc) - timedelta(seconds=M.RUN_WINDOW_S + 5)).strftime("%Y-%m-%dT%H:%M:%SZ")
    with Database(s.db_path).connection() as conn:
        conn.execute("UPDATE intercom_messages SET at = ?", (later,))
    other = send(c, "u5", template="card_ready", bulk_id="bulk-run-0002", bulk_total=3)
    assert other.status_code == 200
    mixed = send(c, "u3", template="validity_reminder", bulk_id="bulk-run-0002", bulk_total=3)
    assert mixed.status_code in (422,)  # u3 has no phone (refused first) ...
    person(fake, "u3")["phone"] = PHONES[2]
    mixed = send(c, "u3", template="validity_reminder", bulk_id="bulk-run-0002", bulk_total=3)
    assert mixed.status_code == 422 and mixed.json()["code"] == "message_bulk_mismatch"
    alone = send(c, "u3", text="שלום", bulk_id="bulk-run-0002", bulk_total=3)
    assert alone.status_code == 422 and alone.json()["code"] == "message_bulk_mismatch"
    foreign = send(c, "u4", "sam", template="card_ready", bulk_id="bulk-run-0002", bulk_total=3)
    assert foreign.status_code == 422 and foreign.json()["code"] == "message_bulk_mismatch", "another sender cannot join a run"
    assert send(c, "u3", template="closure", bulk_id="short").status_code == 422


# ---------------------------------------------------------------- the history

def test_the_history_lists_who_sent_what_when_and_never_the_text(mc):
    fake, c, s = mc
    enable(c)
    assert send(c, "u5", template="card_ready").status_code == 200
    assert send(c, "u5", "sam", text="שלום דנה").status_code == 200
    fake.wa_unregistered.add(PHONES[4])
    assert send(c, "u5", template="closure").status_code == 502
    hist = req(c, "GET", "/people/u5/messages").json()
    assert [(m["by"], m["kind"], m["template_label"], m["outcome"]) for m in hist["messages"]] == [
        ("root", "template", "הכניסה סגורה", "refused"), ("sam", "free", None, "sent"), ("root", "template", "כרטיס מוכן", "sent")]
    assert hist["opt_out"] is None and hist["consent"] == "unknown"
    assert "שלום דנה" not in json.dumps(hist, ensure_ascii=False) and set(hist["messages"][0]) == {"id", "at", "by", "kind", "template_id", "template_label", "outcome", "reason", "bulk"}
    # a record whose process died between its two rows reads as unknown after a while
    old = (datetime.now(timezone.utc) - timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M:%SZ")
    with Database(s.db_path).connection() as conn:
        conn.execute("INSERT INTO intercom_messages(id, at, actor_user_id, actor_name, person_id, kind, chars, client_request_id, outcome) VALUES ('p1', ?, 'dev-root', 'root', 'u5', 'free', 3, 'crash-0001', 'pending')", (old,))
    assert req(c, "GET", "/people/u5/messages").json()["messages"][-1]["outcome"] == "unknown"
    assert req(c, "GET", "/people/u4/messages").json()["messages"] == []
    assert req(c, "GET", "/people/nobody/messages").status_code == 404 and req(c, "GET", "/people/u4/messages", "mia").status_code == 404 and req(c, "GET", "/people/u1/messages", "mia").status_code == 403


def test_old_records_are_removed_when_the_next_message_is_recorded(mc):
    fake, c, s = mc
    enable(c)
    ancient = (datetime.now(timezone.utc) - timedelta(days=M.KEEP_DAYS + 1)).strftime("%Y-%m-%dT%H:%M:%SZ")
    with Database(s.db_path).connection() as conn:
        conn.execute("INSERT INTO intercom_messages(id, at, actor_user_id, person_id, kind, chars, client_request_id, outcome) VALUES ('old1', ?, 'dev-root', 'u1', 'free', 3, 'old-request-1', 'sent')", (ancient,))
    assert send(c, "u1", text="שלום").status_code == 200
    assert [m["id"] for m in messages(s) if m["id"] == "old1"] == []


def test_the_migration_creates_the_record_and_the_opt_out_tables(mc):
    _fake, _c, s = mc
    cols = {r["name"] for r in rows(s, "PRAGMA table_info(intercom_messages)")}
    assert {"id", "at", "actor_user_id", "person_id", "kind", "template_id", "chars", "bulk_id", "client_request_id", "outcome", "reason"} <= cols
    assert not {"text", "message", "body", "phone", "token", "pin"} & cols, "no column could hold a message, a number or a credential"
    assert {r["name"] for r in rows(s, "PRAGMA table_info(intercom_message_optout)")} == {"person_id", "at", "by_user_id", "by_name", "phone_hash"}
    assert {"phone_hash", "station_ids"} <= cols  # 0114 (review F3 / F6): a keyed hash of the number, never the number
    assert {76, 117} <= {r["version"] for r in rows(s, "SELECT version FROM schema_migrations")}


# ---------------------------------------------------------------- the mock of the Playwright specs cannot drift from the routes

WIRE = Path(__file__).resolve().parents[3] / "frontend" / "tests" / "fixtures" / "messaging_wire.json"


def test_the_mock_replies_have_the_shape_of_the_real_routes(mc, monkeypatch):
    """The people screen and the Settings page are tested in Playwright against a MOCKED backend whose answers come from
    frontend/tests/fixtures/messaging_wire.json. A mock that quietly drifts from the server would prove nothing, so this asks the REAL
    routes (over the fake WisKey) and checks every reply in the fixture has exactly the keys and value types the server produces
    (the shape rules are test_access_control_wire.py's)."""
    from test_access_control_wire import mismatches, shape

    fake, c, s = mc
    wire = json.loads(WIRE.read_text(encoding="utf-8"))
    enable(c, organization="מגדל הדגמה", rate_per_hour=2)
    real: dict[str, Any] = {}
    real["config"] = req(c, "GET", "/messaging").json()
    real["recipients"] = req(c, "POST", "/messaging/recipients", json={"person_ids": ["u1"]}).json()
    assert send(c, "u5", template="card_ready").status_code == 200
    fake.wa_unregistered.add(PHONES[4])
    assert send(c, "u5", text="שלום", bulk_id="bulk-wire-0001", bulk_total=2).status_code == 502
    optout = req(c, "PUT", "/people/u5/messages/optout", json={"opted_out": True})
    real["optout"] = optout.json()
    real["history"] = req(c, "GET", "/people/u5/messages").json()
    fake.wa_unregistered.clear()
    person(fake, "u3")["phone"] = ""
    errors: dict[str, Any] = {}
    errors["no_phone"] = send(c, "u3", text="שלום").json()
    assert send(c, "u2", text="שלום").status_code == 200  # the second message of the hour
    errors["rate_hour"] = send(c, "u4", text="שלום").json()
    errors["settings_invalid"] = save(c, bulk_max=0).json()
    cur = settings_doc(c)
    doc = {k: cur[k] for k in ("enabled", "free_text", "bulk_max", "rate_per_hour", "organization", "account", "templates")}
    errors["settings_conflict"] = req(c, "PUT", "/messaging/settings", json={"base_revision": cur["revision"] - 1, **doc}).json()
    with Database(s.db_path).connection() as conn:
        conn.execute("DELETE FROM intercom_messages")
    save(c, rate_per_hour=60)
    fake.wa_uncertain.add("u1")
    errors["uncertain"] = send(c, "u1", text="שלום").json()
    fake.wa_uncertain.clear()
    r = send(c, "u2", template="closure")
    assert r.status_code == 200
    real["sent"] = r.json()
    real["settings"] = req(c, "GET", "/messaging/settings").json()
    # the 2.6.5 review's answers (F3 person cap, F6 clear permission, F5 send hours)
    save(c, per_person_per_day=1)
    errors["rate_person"] = send(c, "u2", text="שלום").json()
    errors["optout_clear_forbidden"] = req(c, "PUT", "/people/u5/messages/optout", "sam", json={"opted_out": False}).json()
    monkeypatch.setattr(M, "hours_now", lambda: datetime(2026, 10, 14, 23, 40, tzinfo=timezone.utc))
    errors["outside_hours"] = send(c, "u4", text="שלום").json()
    for name, reply in real.items():
        mock = {**wire[name], "sync": wire["sync"]} if "sync" in reply else wire[name]
        problems = mismatches(shape(reply), shape(mock))
        assert not problems, f"{name} drifted from the server:\n  " + "\n  ".join(problems)
    for key, body in errors.items():
        assert wire["errors"][key]["code"] == body["code"], (key, body)
        assert not mismatches(shape(body), shape(wire["errors"][key])), (key, mismatches(shape(body), shape(wire["errors"][key])))
