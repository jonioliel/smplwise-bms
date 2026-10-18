"""WA-CONSENT-LINK (docs/changes/CR-WA-CONSENT-LINK.md): opt-in consent by link for the people screen's WhatsApp messages - the send path
(routers/access_control_messaging.py), the rules (services/intercom_consent.py) and the NEW PUBLIC SURFACE (services/tickets/
public_consent.py behind the public listener's edge).

NEGATIVE CASES FIRST: the switch off changes nothing (an `unknown` person is messaged as before - the owner's decision); the public page
answers the uniform 404 to no / tampered / foreign-domain / expired / replayed / unknown tokens - byte-identical; CSRF (a form post is
415, a post without the token header is 404, a body is never parsed without a live token); the notice version must be the current one;
the failure caps of the edge (429); one consent request per person per 30 days; at most 3 held messages; a free text is never held; the
credential guard is untouched. Then the happy paths: approve releases the held message through the normal rules, decline lands on the
opt-out list, no answer drops with an audit row and a notification for the sender. Fake WisKey only (tests/fake_wiskey_messaging.py); no
device, phone, WhatsApp or Home Assistant is contacted; every name and number is invented."""
from __future__ import annotations

import json
import re
import uuid
from datetime import timedelta
from typing import Any

import pytest
from conftest import as_user
from fastapi.testclient import TestClient
from intercom_station_scope import station_scope  # noqa: F401 - a fixture (mc needs it)
from test_intercom_messaging import PHONES, audits, details, enable, mc, messages, req, rows, save, send, settings_doc  # noqa: F401 - mc is a fixture

from smplwise.db import Database
from smplwise.services import intercom_consent as C
from smplwise.services import intercom_messaging as M
from smplwise.services.tickets import links, store_links
from smplwise.services.tickets.keyring import KEYS
from smplwise.services.tickets.public_http import UNIFORM_404
from smplwise.services.tickets.public_runtime import RUNTIME

BASE_URL = "https://t-demo.arx.example.test"
ORG = "מגדלי הדר"
TOKEN_RE = re.compile(r"#c\.([A-Za-z0-9_-]{32})")


# ---------------------------------------------------------------- the world

@pytest.fixture()
def cw(mc, monkeypatch):  # noqa: F811
    """The messaging world (fake WisKey) + the tickets module on with its public page ready (option on, listener counted as running, a
    public address, the module key) + a public client over the real public app (ASGI, no socket)."""
    fake, c, s = mc
    root = as_user("root")
    assert c.patch("/api/v1/settings", json={"tickets.enabled": "true"}, headers=root).status_code == 200
    monkeypatch.setattr(RUNTIME, "option_on", True)
    monkeypatch.setattr(RUNTIME, "listening", True)
    monkeypatch.setattr(RUNTIME, "app", None)
    monkeypatch.setattr(RUNTIME, "switch", None)
    r = c.get("/api/v1/tickets/settings", headers=root)
    assert r.status_code == 200, r.text
    r = c.put("/api/v1/tickets/settings", json={"revision": r.json()["revision"], "public": {"base_url": BASE_URL}}, headers=root)
    assert r.status_code == 200, r.text
    kicks: list[int] = []
    monkeypatch.setattr(C.RELEASER, "kick", lambda: kicks.append(1))  # the tests run the releaser themselves (release_due)
    db = Database(s.db_path)
    pub = TestClient(RUNTIME.build_app(db), client=("198.51.100.7", 50000))
    return World(fake, c, s, db, pub, kicks)


class World:
    def __init__(self, fake: Any, c: TestClient, s: Any, db: Database, pub: TestClient, kicks: list[int]) -> None:
        self.fake, self.c, self.s, self.db, self.pub, self.kicks = fake, c, s, db, pub, kicks

    def on(self, **over: Any) -> dict[str, Any]:
        return enable(self.c, organization=ORG, consent_by_link=True, **over)

    def token(self, i: int = -1) -> str:
        texts = [m["text"] for m in self.fake.wa_sent if "#c." in m["text"]]
        m = TOKEN_RE.search(texts[i])
        assert m, texts
        return m.group(1)

    def view(self, token: str | None, **kw: Any) -> Any:
        return self.pub.get("/t/api/consent", headers={"x-ticket-token": token} if token else {}, **kw)

    def answer(self, token: str | None, choice: str = "approve", version: str | None = None, **extra: Any) -> Any:
        body = {"choice": choice, "notice_version": version or C.NOTICE_VERSION, **extra}
        return self.pub.post("/t/api/consent", json=body, headers={"x-ticket-token": token} if token else {})

    def q(self, sql: str, *args: Any) -> list[dict[str, Any]]:
        return rows(self.s, sql, *args)

    def release(self) -> dict[str, int]:
        from smplwise.services import intercom_sync

        intercom_sync.SYNC._buckets_reset()
        return C.release_due(self.db, self.s)

    def shift(self, table: str, column: str, days: int) -> None:
        with self.db.connection() as conn:
            for r in conn.execute(f"SELECT id, {column} FROM {table}").fetchall():  # noqa: S608 - test-only fixed names
                moved = M.iso(M.utc() - timedelta(days=days)) if column == "created_at" else M.iso(M.utc() - timedelta(seconds=1))
                conn.execute(f"UPDATE {table} SET {column} = ? WHERE id = ?", (moved, r[0]))  # noqa: S608


def uniform_404(r: Any) -> None:
    assert r.status_code == 404 and r.content == UNIFORM_404, (r.status_code, r.text)


def wa_texts(w: World) -> list[str]:
    return [m["text"] for m in w.fake.wa_sent]


# ---------------------------------------------------------------- 1. OFF by default: nothing changes (the owner's decision)

def test_off_by_default_an_unknown_person_is_messaged_as_before_and_no_consent_request_exists(cw):
    w = cw
    cfg = enable(w.c, organization=ORG)
    assert cfg["consent_by_link"] is False and cfg["consent_wait_days"] == 7 and cfg["consent_wa_template"] == ""
    r = send(w.c, "u1", template="card_ready")
    assert r.status_code == 200 and r.json()["message"]["outcome"] == "sent"
    assert wa_texts(w) == ["שלום Dana, כרטיס הכניסה שלך מוכן לאיסוף."]
    assert w.q("SELECT * FROM intercom_consent_requests") == [] and w.q("SELECT * FROM intercom_held_messages") == []


def test_a_client_that_predates_the_consent_fields_keeps_them(cw):
    w = cw
    w.on(consent_wait_days=10)
    r = save(w.c, consent_by_link=None, consent_wait_days=None)  # the old editor sends none of them
    assert r.status_code == 200, r.text
    assert r.json()["settings"]["consent_by_link"] is True and r.json()["settings"]["consent_wait_days"] == 10


@pytest.mark.parametrize(("over", "path", "code"), [
    ({"consent_by_link": "yes"}, "consent_by_link", "type"),
    ({"consent_wait_days": 0}, "consent_wait_days", "range"), ({"consent_wait_days": 31}, "consent_wait_days", "range"),
    ({"consent_wait_days": 7.5}, "consent_wait_days", "type"), ({"consent_wait_days": True}, "consent_wait_days", "type"),
    ({"consent_language": "fr"}, "consent_language", "type"),
    ({"consent_wa_template": "Consent Request"}, "consent_wa_template", "bad_name"), ({"consent_wa_template": "x" * 129}, "consent_wa_template", "bad_name"),
    ({"consent_wa_language": "hebrew"}, "consent_wa_language", "bad_language"),
    ({"consent_by_link": True, "organization": ""}, "consent_by_link", "organization_missing"),
])
def test_the_consent_settings_are_validated(cw, over, path, code):
    r = save(cw.c, **over)
    assert r.status_code == 422 and r.json()["code"] == "message_settings_invalid", r.text
    assert {"path": path, "code": code} in r.json()["details"]["errors"]


def test_only_system_configure_edits_the_consent_settings_and_the_audit_names_the_field_only(cw):
    w = cw
    cur = settings_doc(w.c)
    r = req(w.c, "PUT", "/messaging/settings", "otto", json={"base_revision": cur["revision"], "consent_by_link": True})
    assert r.status_code == 403
    w.on(consent_wait_days=10)  # integ/270 (review C1): a template name is refused while it cannot be forwarded - see the C1 tests below
    row = audits(w.s, M.AUDIT_SETTINGS)[-1]
    assert "consent_by_link" in details(row)["changed"] and "consent_wait_days" in details(row)["changed"]
    reply = req(w.c, "GET", "/messaging/settings").json()
    assert reply["consent"]["page_problem"] is None and reply["consent"]["notice_version"] == C.NOTICE_VERSION


# ---------------------------------------------------------------- integ/270, review C1: the WhatsApp template that cannot be forwarded

@pytest.mark.parametrize(("over", "path"), [({"consent_wa_template": "arx_consent_v1"}, "consent_wa_template"),
                                            ({"consent_wa_language": "he"}, "consent_wa_language")])
def test_a_template_is_refused_while_the_adapter_cannot_forward_it(cw, over, path):
    w = cw
    from smplwise.services.intercom_messaging_adapter import TEMPLATE_SEND_SUPPORTED

    assert TEMPLATE_SEND_SUPPORTED is False and M.template_send_supported() is False
    r = save(w.c, consent_by_link=True, organization=ORG, **over)
    assert r.status_code == 422 and r.json()["code"] == "message_settings_invalid", r.text
    assert {"path": path, "code": "template_send_unsupported"} in r.json()["details"]["errors"]
    reply = req(w.c, "GET", "/messaging/settings").json()
    assert reply["consent"]["template_send_supported"] is False
    assert reply["settings"]["consent_wa_template"] == "" and reply["settings"]["consent_wa_language"] == ""  # nothing stored


def test_a_stored_template_name_is_never_claimed_or_passed_on_while_unsupported(cw, monkeypatch):
    w = cw
    w.on()
    with w.db.connection() as conn:  # as if an earlier build had stored one: the read drops it (fail closed)
        doc = json.loads(conn.execute("SELECT value FROM settings WHERE key = ?", (M.SETTING_KEY,)).fetchone()[0])
        doc.update(consent_wa_template="arx_consent_v1", consent_wa_language="he")
        M.save_settings(conn, doc)
    with w.db.connection(mode="read") as conn:
        cfg = M.read_settings(conn)
    assert cfg["consent_wa_template"] == "" and cfg["consent_wa_language"] == ""
    from smplwise.services.intercom_messaging_adapter import MESSAGING

    seen: list[Any] = []
    real = MESSAGING.send
    monkeypatch.setattr(MESSAGING, "send", lambda *a, **k: (seen.append(k.get("wa_template")), real(*a, **k))[1])
    r = send(w.c, "u1", template="card_ready")
    assert r.status_code == 202 and r.json()["message"]["outcome"] == "consent_requested", r.text
    assert seen == [None]  # no template handed to the adapter, so none is claimed as sent


def test_consent_on_but_the_public_page_cannot_serve_a_link_nothing_is_sent(cw, monkeypatch):
    w = cw
    w.on()
    monkeypatch.setattr(RUNTIME, "listening", False)
    r = send(w.c, "u1", template="card_ready")
    assert (r.status_code, r.json()["code"]) == (409, "message_consent_unavailable") and r.json()["details"]["reason"] == "public_page"
    assert w.fake.wa_sent == [] and messages(w.s) == [] and w.q("SELECT * FROM intercom_consent_requests") == []
    assert audits(w.s)[-1]["decision"] == "denied"


# ---------------------------------------------------------------- 2. the send: the consent request goes first, the message waits

def test_the_first_message_is_the_code_owned_consent_request_and_the_template_waits(cw, caplog):
    w = cw
    w.on()
    r = send(w.c, "u1", template="card_ready")
    assert r.status_code == 202, r.text
    msg = r.json()["message"]
    assert msg["outcome"] == "consent_requested" and msg["held"] is True and msg["consent"] == "pending" and msg["until"]
    (text,) = wa_texts(w)
    assert "כרטיס הכניסה שלך מוכן" not in text, "the requested content is NOT sent before consent"
    assert text.startswith("שלום Dana,") and ORG in text and f"{BASE_URL}/support/#c." in text and "7 ימים" in text
    assert not M.looks_like_credential(text.replace(w.token(), "")), "the request asks nothing like a code"
    (req_row,) = w.q("SELECT * FROM intercom_consent_requests")
    assert req_row["state"] == "open" and req_row["person_id"] == "u1" and req_row["token_hash"] == links.token_hash(w.token())
    (held,) = w.q("SELECT * FROM intercom_held_messages")
    assert (held["state"], held["template_id"], held["actor_user_id"]) == ("held", "card_ready", "dev-root")
    (m,) = messages(w.s)
    assert (m["template_id"], m["outcome"], m["chars"]) == (C.TEMPLATE_ID, "sent", 0)
    # nothing secret anywhere: no token, no phone, no text, no name in the audit, the records or the logs
    everything = json.dumps({"audit": w.q("SELECT * FROM audit_log"), "req": w.q("SELECT * FROM intercom_consent_requests"),
                             "held": w.q("SELECT * FROM intercom_held_messages"), "messages": messages(w.s)}, ensure_ascii=False)
    for secret in (w.token(), PHONES[0], "Dana", "מבקשת את אישורך", BASE_URL):
        assert secret not in everything, secret
        assert secret not in caplog.text, secret


def test_while_pending_messages_are_held_collapsed_and_capped_and_no_second_request_is_sent(cw):
    w = cw
    w.on()
    assert send(w.c, "u1", template="card_ready").status_code == 202
    r = send(w.c, "u1", template="card_ready")
    assert r.status_code == 202 and r.json()["message"] == {**r.json()["message"], "outcome": "held", "collapsed": True}
    assert send(w.c, "u1", template="closure").json()["message"]["collapsed"] is False
    assert send(w.c, "u1", template="validity_reminder").status_code == 202
    r = send(w.c, "u1", text="שלום")
    assert (r.status_code, r.json()["code"]) == (409, "message_consent_pending") and r.json()["details"]["held"] is False
    cfg = settings_doc(w.c)
    doc = {k: cfg[k] for k in ("enabled", "free_text", "bulk_max", "rate_per_hour", "organization", "account")}
    templates = cfg["templates"] + [{"label": "רביעית", "body": "שלום {name}, עוד הודעה."}]
    r = req(w.c, "PUT", "/messaging/settings", json={"base_revision": cfg["revision"], **doc, "templates": templates})
    assert r.status_code == 200
    fourth = r.json()["settings"]["templates"][-1]["id"]
    r = send(w.c, "u1", template=fourth)
    assert (r.status_code, r.json()["code"]) == (409, "message_consent_pending")
    assert len(wa_texts(w)) == 1, "exactly one WhatsApp message (the consent request) for all of it"
    assert len(w.q("SELECT * FROM intercom_held_messages WHERE state = 'held'")) == 3


def test_a_free_text_starts_the_request_but_is_never_kept(cw):
    w = cw
    w.on()
    r = send(w.c, "u2", text="שלום אבי, אפשר לעבור במשרד?")
    assert r.status_code == 202 and r.json()["message"]["outcome"] == "consent_requested" and r.json()["message"]["held"] is False
    assert w.q("SELECT * FROM intercom_held_messages") == []
    assert "אפשר לעבור" not in json.dumps(w.q("SELECT * FROM audit_log"), ensure_ascii=False)
    assert all("אפשר לעבור" not in t for t in wa_texts(w))


def test_a_granted_person_is_messaged_normally_and_a_declined_one_never(cw):
    w = cw
    w.on()
    w.fake.directory[0]["whatsapp_consent"] = "granted"  # u1: WisKey says granted
    assert send(w.c, "u1", template="card_ready").status_code == 200
    assert w.q("SELECT * FROM intercom_consent_requests") == []
    req(w.c, "PUT", "/people/u2/messages/optout", json={"opted_out": True})
    r = send(w.c, "u2", template="card_ready")
    assert (r.status_code, r.json()["code"]) == (409, "message_no_consent")
    assert w.q("SELECT * FROM intercom_consent_requests WHERE person_id = 'u2'") == []


# ---------------------------------------------------------------- 3. the public page: negative cases first

def test_the_page_answers_the_uniform_404_to_every_token_that_is_not_live(cw):
    w = cw
    w.on()
    send(w.c, "u1", template="card_ready")
    token = w.token()
    (row,) = w.q("SELECT * FROM intercom_consent_requests")
    flipped = ("B" if token[0] != "B" else "C") + token[1:]
    ticket_domain = links.derive_token(KEYS.get(row["key_id"]), row["id"], 1, domain="tkt")  # the same id under another domain
    rfq_domain = links.derive_token(KEYS.get(row["key_id"]), row["id"], 1, domain="rfq")
    second_gen = links.derive_token(KEYS.get(row["key_id"]), row["id"], 2, domain="wac")
    for bad in (None, "", flipped, ticket_domain, rfq_domain, second_gen, "x" * 32, token + "A", token[:-1], token.lower() if token.lower() != token else token.upper()):
        uniform_404(w.view(bad))
        uniform_404(w.answer(bad))
    assert w.q("SELECT state FROM intercom_consent_requests")[0]["state"] == "open"


def test_csrf_a_form_post_is_415_a_post_without_the_header_is_404_and_no_body_is_read_without_a_live_token(cw):
    w = cw
    w.on()
    send(w.c, "u1", template="card_ready")
    token = w.token()
    r = w.pub.post("/t/api/consent", content=b"choice=approve&notice_version=x", headers={"x-ticket-token": token, "content-type": "application/x-www-form-urlencoded"})
    assert r.status_code == 415
    r = w.pub.post("/t/api/consent", content=b"choice=approve", headers={"x-ticket-token": token, "content-type": "text/plain"})
    assert r.status_code == 415
    uniform_404(w.pub.post("/t/api/consent", json={"choice": "approve", "notice_version": C.NOTICE_VERSION}))  # a cross-site fetch cannot add the header
    uniform_404(w.pub.post("/t/api/consent", json={"bogus": 1}, headers={"x-ticket-token": "z" * 32}))  # never a 422 without a live token
    r = w.pub.post("/t/api/consent", json={"choice": "approve", "notice_version": C.NOTICE_VERSION}, headers={"x-ticket-token": token, "cookie": "a=b"})
    assert r.status_code == 200 and "set-cookie" not in r.headers  # (a cookie is neither read nor set)
    assert "access-control-allow-origin" not in {k.lower() for k in r.headers}


def test_a_malformed_answer_or_a_stale_notice_changes_nothing(cw):
    w = cw
    w.on()
    send(w.c, "u1", template="card_ready")
    token = w.token()
    for body in ({"choice": "yes", "notice_version": C.NOTICE_VERSION}, {"choice": "approve"}, {"choice": "approve", "notice_version": C.NOTICE_VERSION, "person": "u2"},
                 {"choice": True, "notice_version": C.NOTICE_VERSION}):
        r = w.pub.post("/t/api/consent", json=body, headers={"x-ticket-token": token})
        assert r.status_code == 422 and r.json()["code"] == "invalid", body
        assert "u2" not in r.text and "yes" not in r.text  # the input is never echoed
    r = w.answer(token, version="wa-consent-1999-01-01.1")
    assert (r.status_code, r.json()["code"]) == (409, "notice_changed")
    assert w.q("SELECT state FROM intercom_consent_requests")[0]["state"] == "open" and w.q("SELECT * FROM intercom_consent") == []


def test_the_page_shows_no_personal_data(cw):
    w = cw
    w.on()
    send(w.c, "u1", template="card_ready")
    r = w.view(w.token())
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body) == {"organization", "logo", "theme", "notice_version", "lang", "expires_at"}
    assert body["organization"] == ORG and body["notice_version"] == C.NOTICE_VERSION and body["lang"] == "he"
    for personal in ("Dana", "u1", PHONES[0], "dev-root", "card_ready"):
        assert personal not in r.text
    assert r.headers["cache-control"] == "no-store" and "default-src 'none'" in r.headers["content-security-policy"]


def test_unknown_tokens_hit_the_edges_failure_cap_per_network(cw):
    w = cw
    w.on()
    codes = [w.view(uuid.uuid4().hex[:32]).status_code for _ in range(25)]
    assert codes[:20] == [404] * 20 and 429 in codes[20:]


def test_used_expired_and_unknown_tokens_get_byte_identical_answers(cw):
    w = cw
    w.on()
    send(w.c, "u1", template="card_ready")
    used = w.token()
    assert w.answer(used).status_code == 200
    send(w.c, "u2", template="card_ready")
    expired = w.token()
    w.shift("intercom_consent_requests", "expires_at", 0)
    answers = {(w.view(t).status_code, w.view(t).content) for t in (used, expired, "Q" * 32)}
    assert answers == {(404, UNIFORM_404)}


# ---------------------------------------------------------------- 4. approve, decline, no answer

def test_approve_stores_the_consent_with_its_notice_version_and_releases_the_held_message_once(cw):
    w = cw
    # integ/270: WA-SEND-FIX's per-recipient day cap (default 3) counts the consent request and both released messages - a fourth message
    # to the same person the same day is refused 429 (scope person), which is the cap working; this test sends a fourth, so it raises the cap
    w.on(per_person_per_day=5)
    send(w.c, "u1", template="card_ready")
    send(w.c, "u1", template="closure")
    token = w.token()
    r = w.answer(token, "approve")
    assert r.status_code == 200 and r.json() == {"ok": True, "answer": "approved"}
    assert w.kicks, "the releaser was kicked (the public listener never waits for WisKey)"
    (consent,) = w.q("SELECT * FROM intercom_consent")
    assert consent["person_id"] == "u1" and consent["state"] == "granted" and consent["notice_version"] == C.NOTICE_VERSION and consent["at"]
    assert {r["state"] for r in w.q("SELECT state FROM intercom_held_messages")} == {"due"}
    assert w.release() == {"released": 2, "dropped": 0, "retry": 0}
    assert wa_texts(w)[1:] == ["שלום Dana, כרטיס הכניסה שלך מוכן לאיסוף.", "שלום Dana, הכניסה סגורה זמנית. נעדכן כשתיפתח שוב."]
    assert {r["state"] for r in w.q("SELECT state FROM intercom_held_messages")} == {"released"}
    assert w.release() == {"released": 0, "dropped": 0, "retry": 0}, "never sent twice"
    uniform_404(w.answer(token, "decline"))  # single use: a replay changes nothing
    uniform_404(w.view(token))
    assert w.q("SELECT * FROM intercom_message_optout") == []
    # from now on the person is `granted`: a message goes out normally
    assert send(w.c, "u1", template="validity_reminder").status_code == 200
    assert req(w.c, "GET", "/people/u1/messages").json()["consent"] == "granted"
    a = [details(x) for x in audits(w.s, C.AUDIT_ANSWER)]
    assert a[-1]["answer"] == "granted" and a[-1]["due"] == 2 and w.token() not in json.dumps(a)


def test_decline_lands_on_the_opt_out_list_drops_the_held_message_and_tells_the_sender(cw):
    w = cw
    w.on()
    send(w.c, "u1", template="card_ready")
    r = w.answer(w.token(), "decline")
    assert r.status_code == 200 and r.json()["answer"] == "declined"
    (opt,) = w.q("SELECT * FROM intercom_message_optout")
    assert opt["person_id"] == "u1" and opt["by_user_id"] == C.OPTOUT_BY_ID and opt["by_name"] == C.OPTOUT_BY  # HARDEN271 (C3): not NULL
    (held,) = w.q("SELECT * FROM intercom_held_messages")
    assert (held["state"], held["reason"]) == ("dropped", "declined")
    assert w.release()["released"] == 0 and len(wa_texts(w)) == 1, "nothing but the consent request was ever sent"
    note = w.q("SELECT * FROM notifications WHERE source = ?", C.NOTIFY_SOURCE)
    assert len(note) == 1 and note[0]["initiator_user_id"] == "dev-root" and "Dana" not in json.dumps(note, ensure_ascii=False)
    r = send(w.c, "u1", template="card_ready")
    assert (r.status_code, r.json()["code"]) == (409, "message_no_consent")
    page = req(w.c, "GET", "/people/u1/messages").json()
    assert page["consent"] == "declined" and any(m["outcome"] == "dropped" and m["reason"] == "declined" for m in page["messages"])


def test_no_answer_in_time_drops_the_message_with_an_audit_row_and_a_notification_and_no_second_request_for_30_days(cw):
    w = cw
    w.on(consent_wait_days=3)
    send(w.c, "u1", template="card_ready")
    token = w.token()
    page = req(w.c, "GET", "/people/u1/messages").json()
    assert page["consent_request"]["state"] == "pending" and {m["outcome"] for m in page["messages"]} == {"held", "sent"}
    w.shift("intercom_consent_requests", "expires_at", 0)
    uniform_404(w.view(token))
    C.tick(w.db, w.s)
    assert w.q("SELECT state FROM intercom_consent_requests")[0]["state"] == "expired"
    (held,) = w.q("SELECT * FROM intercom_held_messages")
    assert (held["state"], held["reason"]) == ("dropped", "no_answer")
    assert details(audits(w.s, C.AUDIT_ANSWER)[-1])["outcome"] == "expired"
    assert len(w.q("SELECT * FROM notifications WHERE source = ?", C.NOTIFY_SOURCE)) == 1
    r = send(w.c, "u1", template="card_ready")
    assert (r.status_code, r.json()["code"]) == (409, "message_consent_recently_requested") and r.json()["details"]["retry_after_days"] >= 1
    assert len(wa_texts(w)) == 1
    w.shift("intercom_consent_requests", "created_at", 31)
    assert send(w.c, "u1", template="card_ready").status_code == 202, "a month later one new request may go"
    assert len(wa_texts(w)) == 2


def test_a_token_acts_on_its_own_person_only(cw):
    w = cw
    w.on()
    send(w.c, "u1", template="card_ready")
    t1 = w.token()
    send(w.c, "u2", template="card_ready")
    t2 = w.token()
    assert t1 != t2
    assert w.answer(t2, "decline").status_code == 200
    assert [r["person_id"] for r in w.q("SELECT person_id FROM intercom_message_optout")] == ["u2"]
    assert w.q("SELECT state FROM intercom_held_messages WHERE person_id = 'u1'")[0]["state"] == "held"
    assert w.answer(t1, "approve").status_code == 200
    assert [r["person_id"] for r in w.q("SELECT person_id FROM intercom_consent")] == ["u1"]


def test_release_checks_everything_again_a_changed_template_or_a_later_opt_out_drops_it(cw):
    w = cw
    w.on()
    send(w.c, "u1", template="card_ready")
    t1 = w.token()
    send(w.c, "u2", template="closure")
    t2 = w.token()
    cfg = settings_doc(w.c)
    doc = {k: cfg[k] for k in ("enabled", "free_text", "bulk_max", "rate_per_hour", "organization", "account")}
    templates = [dict(t, body="שלום {name}, הכרטיס מחכה בקבלה.") if t["id"] == "card_ready" else t for t in cfg["templates"]]
    assert req(w.c, "PUT", "/messaging/settings", json={"base_revision": cfg["revision"], **doc, "templates": templates}).status_code == 200
    assert w.answer(t1).status_code == 200 and w.answer(t2).status_code == 200
    req(w.c, "PUT", "/people/u2/messages/optout", json={"opted_out": True})  # an administrator marks u2 after the approval: the opt-out wins
    assert w.release() == {"released": 0, "dropped": 2, "retry": 0}
    reasons = {r["person_id"]: r["reason"] for r in w.q("SELECT person_id, reason FROM intercom_held_messages")}
    assert reasons == {"u1": "template_changed", "u2": "no_consent"}
    assert len(wa_texts(w)) == 2 and len(w.q("SELECT * FROM notifications WHERE source = ?", C.NOTIFY_SOURCE)) == 2


def test_release_rechecks_the_senders_permission(cw):
    w = cw
    w.on()
    assert send(w.c, "u1", template="card_ready").status_code == 202
    with w.db.connection() as conn:  # the held message's sender is now one without access.people.message (vera: a viewer)
        conn.execute("UPDATE intercom_held_messages SET actor_user_id = 'dev-vera', actor_username = 'vera', actor_name = 'vera'")
    assert w.answer(w.token()).status_code == 200
    assert w.release()["dropped"] == 1
    assert w.q("SELECT reason FROM intercom_held_messages")[0]["reason"] == "forbidden"


# ---------------------------------------------------------------- 5. the key and the guard

def test_a_live_consent_link_keeps_its_module_key(cw):
    w = cw
    w.on()
    send(w.c, "u1", template="card_ready")
    (row,) = w.q("SELECT key_id FROM intercom_consent_requests")
    with w.db.connection(mode="read") as conn:
        assert row["key_id"] in store_links.key_ids_in_use(conn) and store_links.any_keyed_row(conn)


def test_the_credential_guard_is_unchanged_and_the_consent_text_is_never_a_sender_text(cw):
    for text in ("הקוד שלך 4821", "your PIN is 4821", "{pin}"):
        assert M.looks_like_credential(text)
    for lang in C.TEXTS:
        rendered = C.render_request(lang, name="Dana Levi", organization=ORG, link=f"{BASE_URL}/support/#c.{'A' * 32}", days=7)
        assert "Dana" in rendered and "Levi" not in rendered, "the first name only"
        assert ORG in rendered and "{" not in rendered and not M.CREDENTIAL_WORDS.search(rendered.replace("A" * 32, ""))
    assert C.render_request("he", name="{organization}", organization="X", link="L", days=7).startswith("שלום {organization},")
