"""CR-018 S4: the outgoing e-mail channel - settings model, the write-only password, message building, SMTP (STARTTLS / TLS / none, login,
classified failures, retries), rate limit and digest, scoping, the test endpoint, audit. A real in-process fake SMTP server on 127.0.0.1
(tests/fake_smtp.py) speaks the protocol; no mail leaves the machine."""
from __future__ import annotations

import datetime as dt
import email
import email.policy
import heapq
import json
import logging
import os
import smtplib
import socket
import stat

import pytest
from conftest import as_user, bind
from fake_smtp import FakeSMTP
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import notify, notify_channels, notify_email
from smplwise.services import notify_settings as nsettings
from smplwise.services import push as push_svc

PASSWORD = "S3cr3t-Pw-9f2c1d7a"          # a distinctive value to grep for everywhere
SENDER = "arx@example.test"
OWNER = "owner@example.test"
SECOND = "second@example.test"
API = "/api/v1"


# ---------------------------------------------------------------- helpers

@pytest.fixture()
def smtp(tmp_path):
    with FakeSMTP(tmp_path, "none") as s:
        yield s


@pytest.fixture(autouse=True)
def _state(monkeypatch):
    notify_email.reset_state()
    push_svc.reset_limits()
    monkeypatch.setattr(notify_email, "RETRY_DELAYS_S", (3600.0, 3600.0, 3600.0))   # a retry waits until the test says its time has come (World.tick)
    monkeypatch.setattr(notify_email, "TIMEOUT_S", 2.0)
    monkeypatch.setattr(notify_email, "DIGEST_DELAY_S", 0.0)
    yield
    notify_email.reset_state()


class World:
    def __init__(self, settings):
        self.settings = settings
        self.app = create_app(settings)
        self.c = TestClient(self.app)
        assert self.c.get(f"{API}/me").status_code == 200
        r = self.c.put(f"{API}/notify/settings", json={"quiet": {"enabled": False}})
        assert r.status_code == 200, r.text
        self.notifier = push_svc.PushNotifier()
        self.notifier.db = self.app.state.db
        self._n = 0

    @property
    def db(self):
        return self.app.state.db

    def body(self, smtp, **over):
        b = {"host": "127.0.0.1", "port": smtp.port, "security": smtp.mode if smtp.mode != "ssl" else "tls", "user": "", "from": SENDER, "recipients": [OWNER]}
        b.update(over)
        return b

    def configure(self, smtp, **over):
        r = self.c.put(f"{API}/notify/email", json=self.body(smtp, **over))
        assert r.status_code == 200, r.text
        return r.json()

    def emit(self, source="backup.failed", place=None, key=None, subject_kind="system", subject_id="backup", severity=None, **params):
        self._n += 1
        with self.db.connection() as conn:
            return notify.emit_full(conn, notify.Signal(source, subject_kind, subject_id, severity=severity, dedupe_key=key or f"{source}:{self._n}", place=place, params=params)).id

    def tick(self) -> int:
        """Every waiting retry (and digest) comes due now; run them. A retry that fails again goes back to the heap an hour out."""
        self.notifier.retries[:] = [(0.0, seq, job) for _t, seq, job in self.notifier.retries]
        heapq.heapify(self.notifier.retries)
        return self.notifier.run_due()

    def pump(self) -> int:
        """The notifier thread's work, on this thread: the outbox, then every retry that is due."""
        n = notify_channels.process_outbox(self.notifier)
        self.tick()
        return n

    def rows(self, channel="email"):
        with self.db.connection(mode="read") as conn:
            return [dict(r) for r in conn.execute("SELECT * FROM notification_deliveries WHERE channel = ? ORDER BY rowid", (channel,)).fetchall()]


@pytest.fixture()
def world(settings):
    return World(settings)


def parsed(msg: dict):
    return email.message_from_bytes(msg["data"], policy=email.policy.default)


def text_of(m) -> str:
    return m.get_body(preferencelist=("plain",)).get_content()


def html_of(m) -> str:
    return m.get_body(preferencelist=("html",)).get_content()


# ---------------------------------------------------------------- settings model, secret handling, validation

def test_put_get_roundtrip_and_password_is_write_only(world, smtp, settings):
    view = world.configure(smtp, user="mailer", password=PASSWORD, security="starttls", recipients=[OWNER, SECOND, OWNER.upper()])
    assert view["host"] == "127.0.0.1" and view["security"] == "starttls" and view["user"] == "mailer"
    assert view["recipients"] == [OWNER, SECOND], "duplicates (case-insensitive) collapse"
    assert view["password_set"] is True and view["configured"] is True and "password" not in view
    # the password sits in its own file under <data>/secrets, owner-only where the platform has modes
    p = settings.data_dir / "secrets" / "notify_email"
    assert p.read_text(encoding="utf-8") == PASSWORD
    if os.name != "nt":
        assert stat.S_IMODE(p.stat().st_mode) == 0o600 and stat.S_IMODE(p.parent.stat().st_mode) == 0o700
    assert not list(p.parent.glob("*.tmp")), "no temp file left behind"
    # every read path: no password
    for path in ("/notify/email", "/notify/settings", "/notify/deliveries", "/notify/stats", "/notify/policies"):
        r = world.c.get(f"{API}{path}")
        assert r.status_code == 200 and PASSWORD not in r.text, path
    assert world.c.get(f"{API}/notify/email").json()["password_set"] is True
    # omitted or empty = unchanged
    world.configure(smtp, user="mailer", security="starttls")
    world.configure(smtp, user="mailer", security="starttls", password="")
    assert p.read_text(encoding="utf-8") == PASSWORD
    # a new password replaces it; clearing the user clears the stale password
    world.configure(smtp, user="mailer", security="starttls", password=PASSWORD + "x")
    assert p.read_text(encoding="utf-8") == PASSWORD + "x"
    view = world.configure(smtp, user="", security="starttls")
    assert view["password_set"] is False and not p.exists()


def test_settings_row_audit_backup_and_logs_never_hold_the_password(world, smtp, settings, caplog):
    caplog.set_level(logging.DEBUG)
    world.configure(smtp, user="mailer", password=PASSWORD, security="starttls")
    r = world.c.get(f"{API}/audit", params={"prefix": "notify.email"})
    assert r.status_code == 200
    rows = r.json()["rows"]
    assert rows and rows[0]["action"] == "notify.email.update" and PASSWORD not in r.text
    assert rows[0]["details"]["password_changed"] is True and set(rows[0]["details"]) == {"changed", "password_changed"}
    with world.db.connection(mode="read") as conn:
        email_json = conn.execute("SELECT email_json FROM notify_settings WHERE id = 1").fetchone()[0]
        from smplwise.services import backup

        snap = json.dumps(backup.snapshot(conn, include_access=True, include_audit=True), default=str)
        everything = "\n".join(str(tuple(row)) for t in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall() for row in conn.execute(f"SELECT * FROM {t[0]}").fetchall())
    assert PASSWORD not in email_json and PASSWORD not in snap and PASSWORD not in everything, "not in any table, not in a project backup"
    assert PASSWORD not in caplog.text


INVALID_BODIES = [
    {"host": ""}, {"host": "bad host"}, {"host": "mail.example.test\r\nBcc: x@y.test"}, {"host": "a" * 300}, {"host": 5},
    {"port": 0}, {"port": 70000}, {"port": "587"}, {"port": True},
    {"security": "ssl"}, {"security": None},
    {"from": "not-an-address"}, {"from": "a@b.test\r\nBcc: x@y.test"}, {"from": "Arx <a@b.test>"}, {"from": "אבי@example.test"},
    {"recipients": []}, {"recipients": "a@b.test"}, {"recipients": ["ok@b.test", "bad"]}, {"recipients": ["a@b.test\nBcc:x@y.test"]}, {"recipients": [f"u{i}@b.test" for i in range(11)]},
    {"user": "u\r\nx"}, {"password": "pässword", "user": "u"}, {"password": "a\nb", "user": "u"}, {"password": 7, "user": "u"},
    {"security": "none", "user": "mailer", "password": PASSWORD},
    {"user": "mailer"},                                  # a login with no password anywhere
    {"link_base": "javascript:alert(1)"}, {"link_base": "https://user:pw@arx.example.test"}, {"link_base": "https://arx.example.test\r\nX: y"},
    {"surprise": 1},
]


def test_put_validation_is_email_invalid(world, smtp):
    for over in INVALID_BODIES:
        r = world.c.put(f"{API}/notify/email", json=world.body(smtp, **over))
        assert r.status_code == 422 and r.json()["code"] == "email_invalid", (over, r.text)
        assert PASSWORD not in r.text
    assert world.c.get(f"{API}/notify/email").json()["configured"] is False, "a refused change stores nothing"
    assert not (world.settings.data_dir / "secrets" / "notify_email").exists()


def test_read_only_keys_of_a_get_body_are_ignored_and_link_base_is_optional(world, smtp):
    first = world.configure(smtp, link_base="https://arx.example.test/")
    assert first["link_base"] == "https://arx.example.test"
    echoed = {**first, **world.body(smtp)}
    r = world.c.put(f"{API}/notify/email", json={k: v for k, v in echoed.items() if k != "link_base"})
    assert r.status_code == 200 and r.json()["link_base"] == "https://arx.example.test", "link_base omitted = unchanged"
    assert world.c.put(f"{API}/notify/email", json={**world.body(smtp), "link_base": ""}).json()["link_base"] == ""


def test_the_settings_route_cannot_change_mail_and_the_revision_is_untouched(world, smtp):
    before = world.c.get(f"{API}/notify/settings").json()
    world.configure(smtp)
    after = world.c.get(f"{API}/notify/settings").json()
    assert after["revision"] == before["revision"], "the e-mail route has no revision of its own: it must not make the settings tab stale"
    assert after["email"]["configured"] is True and after["email"]["host"] == "127.0.0.1"
    r = world.c.put(f"{API}/notify/settings", json={**after, "email": {"host": "evil.example.test"}})
    assert r.status_code == 200 and world.c.get(f"{API}/notify/email").json()["host"] == "127.0.0.1"


def test_only_notify_manage_may_touch_mail(world, smtp, settings):
    world.configure(smtp)
    bind(world.c, settings, "ops", "operator", "installation", "*")
    for method, path, body in (("get", "/notify/email", None), ("put", "/notify/email", world.body(smtp, host="evil.example.test")), ("post", "/notify/email/test", {})):
        r = getattr(world.c, method)(f"{API}{path}", headers=as_user("ops"), **({"json": body} if body is not None else {}))
        assert r.status_code == 403 and r.json()["code"] == "forbidden", (method, path)
    assert world.c.get(f"{API}/notify/email").json()["host"] == "127.0.0.1"
    assert smtp.connections == 0, "a refused caller reaches no server"


# ---------------------------------------------------------------- sending: modes, content, delivery log

def test_no_mail_without_configuration(world, smtp):
    nid = world.emit(place="חדר שרתים")
    world.pump()
    rows = world.rows()
    assert [(r["status"], r["reason"], r["user_id"]) for r in rows] == [("skipped", "channel_unavailable", None)]
    assert smtp.connections == 0 and rows[0]["notification_id"] == nid


def test_plain_mail_content_is_hebrew_rtl_and_carries_no_person_no_image_no_token(world, smtp, settings):
    world.configure(smtp, link_base="https://arx.example.test")
    nid = world.emit(place="חדר שרתים", name="גיבוי ליל ג׳")
    world.pump()
    assert len(smtp.messages) == 1
    raw = smtp.messages[0]
    assert raw["to"] == [OWNER] and raw["from"] == SENDER and raw["tls"] is False
    m = parsed(raw)
    subject = str(m["Subject"])
    assert subject == "Arx · הגיבוי נכשל · חדר שרתים" and m["Auto-Submitted"] == "auto-generated"
    assert m.get_content_type() == "multipart/alternative"
    txt, page = text_of(m), html_of(m)
    assert 'dir="rtl"' in page and 'lang="he"' in page and "direction:rtl" in page, "RTL-safe HTML"
    assert "‏" in txt, "a right-to-left mark in the plain text"
    for needle in ("הגיבוי נכשל", "חדר שרתים", "חומרה", "התראה"):
        assert needle in txt and needle in page
    assert f"https://arx.example.test/#/notifications/{nid}" in txt and f"https://arx.example.test/#/notifications/{nid}" in page
    assert "<img" not in page.lower() and "src=" not in page.lower() and "multipart/related" not in raw["data"].decode("ascii", "replace")
    # no person's name: the signed-in administrator's display name appears nowhere in the mail
    with world.db.connection(mode="read") as conn:
        names = [r["display_name"] or r["username"] for r in conn.execute("SELECT display_name, username FROM users").fetchall()]
    assert names and all(n and n not in txt + page + subject for n in names)
    # the delivery log: a masked address, never the address
    (row,) = world.rows()
    assert (row["status"], row["reason"], row["attempt"]) == ("sent", None, 1) and row["target_ref"] == "o***@example.test" and OWNER not in json.dumps(row)


def test_non_system_notifications_do_not_carry_the_body_line(world, smtp):
    world.configure(smtp)
    with world.db.connection() as conn:
        conn.execute("UPDATE notify_policies SET channels_json = ? WHERE source = 'rule.alert'", (json.dumps({"inbox": True, "webpush": False, "email": True, "ha_mobile": False, "whatsapp": False}),))
    world.emit("rule.alert", place="לובי", subject_kind="camera", subject_id="cam-1", name="כלל", message="דני כהן נכנס")
    world.pump()
    # a camera row is visible to the administrator through events scope; whatever the rule typed ("message") is not in the mail
    assert all("דני" not in m["data"].decode("utf-8", "replace") and "דני" not in text_of(parsed(m)) for m in smtp.messages)


def test_starttls_with_login_verifies_the_certificate_and_never_sends_in_clear(world, tmp_path, monkeypatch):
    with FakeSMTP(tmp_path, "starttls", auth=("mailer", PASSWORD)) as s:
        monkeypatch.setattr(notify_email, "tls_context", s.client_context)
        world.configure(s, user="mailer", password=PASSWORD)
        world.emit()
        world.pump()
        assert len(s.messages) == 1 and s.messages[0]["tls"] is True and s.messages[0]["user"] == "mailer"
        assert s.plain_after_greeting == [], "AUTH, MAIL and the rest only after STARTTLS"
        assert world.rows()[0]["status"] == "sent"


def test_implicit_tls(world, tmp_path, monkeypatch):
    with FakeSMTP(tmp_path, "ssl", auth=("mailer", PASSWORD)) as s:
        monkeypatch.setattr(notify_email, "tls_context", s.client_context)
        world.configure(s, user="mailer", password=PASSWORD)
        world.emit()
        world.pump()
        assert len(s.messages) == 1 and s.messages[0]["tls"] is True and s.tls_sessions == 1


def test_an_untrusted_certificate_is_a_tls_failure_not_a_silent_downgrade(world, tmp_path):
    with FakeSMTP(tmp_path, "starttls") as s:   # the DEFAULT context does not trust the throw-away certificate
        world.configure(s)
        world.emit()
        world.pump()
        (row,) = world.rows()
        assert (row["status"], row["reason"]) == ("failed", "tls") and s.messages == [], "TLS errors are final and nothing goes out in clear"


def test_starttls_wanted_but_not_offered_is_refused(world, smtp):
    world.configure(smtp, security="starttls")    # the plain fake never offers STARTTLS
    world.emit()
    world.pump()
    (row,) = world.rows()
    assert (row["status"], row["reason"]) == ("failed", "tls") and smtp.messages == []


def test_auth_failure_is_final_and_logs_no_secret(world, tmp_path, monkeypatch, caplog):
    caplog.set_level(logging.DEBUG)
    with FakeSMTP(tmp_path, "starttls", auth=("mailer", "the-real-one")) as s:
        monkeypatch.setattr(notify_email, "tls_context", s.client_context)
        s.extra_reply_text = "SECRET-BANNER-user-mailer-pw-" + PASSWORD
        world.configure(s, user="mailer", password=PASSWORD)
        nid = world.emit()
        world.pump()
        (row,) = world.rows()
        assert (row["status"], row["reason"], row["attempt"]) == ("failed", "auth", 1) and s.connections == 1, "a bad login is not retried (smtplib itself tries PLAIN then LOGIN inside the one session)"
        assert not world.notifier.retries
        assert PASSWORD not in caplog.text and "SECRET-BANNER" not in caplog.text
        with world.db.connection(mode="read") as conn:
            kinds = [r["kind"] for r in conn.execute("SELECT kind FROM notification_events WHERE notification_id = ?", (nid,)).fetchall()]
        assert "delivery_failed" in kinds


def test_connect_dns_and_timeout_classes(world, smtp, monkeypatch):
    world.configure(smtp)
    # connect: the connection is refused (Windows would take ~2 s per refused connect, so the refusal is simulated)
    real = socket.create_connection

    def refused(*a, **k):
        raise ConnectionRefusedError(10061, "refused")

    monkeypatch.setattr(socket, "create_connection", refused)
    world.emit(key="a")
    world.pump()
    assert world.rows()[-1]["reason"] == "connect"
    monkeypatch.setattr(socket, "create_connection", real)
    # dns
    def no_dns(*a, **k):
        raise socket.gaierror(socket.EAI_NONAME, "unknown host")

    world.configure(smtp, host="mail.example.test")
    monkeypatch.setattr(socket, "getaddrinfo", no_dns)
    cfg = notify_email.MailConfig("mail.example.test", 587, "starttls", "", SENDER, (OWNER,))
    with pytest.raises(notify_email.MailError) as ei:
        notify_email.smtp_send(cfg, OWNER, notify_email.compose_test("Asia/Jerusalem"))
    assert ei.value.kind == "dns" and ei.value.retryable
    monkeypatch.undo()
    # timeout: the server accepts and never answers
    smtp.hang = True
    monkeypatch.setattr(notify_email, "TIMEOUT_S", 0.3)
    cfg = notify_email.MailConfig("127.0.0.1", smtp.port, "none", "", SENDER, (OWNER,))
    with pytest.raises(notify_email.MailError) as ei:
        notify_email.smtp_send(cfg, OWNER, notify_email.compose_test("Asia/Jerusalem"))
    assert ei.value.kind == "timeout" and ei.value.retryable


def test_transient_failure_is_retried_three_times_over_the_heap_and_recovers(world, smtp):
    world.configure(smtp)
    smtp.drop = True                        # the server closes every connection at once
    nid = world.emit()
    notify_channels.process_outbox(world.notifier)
    (row,) = world.rows()
    assert (row["status"], row["reason"], row["attempt"]) == ("retry", "connect", 1) and len(world.notifier.retries) == 1
    world.tick()
    assert world.rows()[0]["attempt"] == 2 and world.rows()[0]["status"] == "retry"
    smtp.drop = False                       # the server is back before the third attempt
    world.tick()
    (row,) = world.rows()
    assert (row["status"], row["reason"], row["attempt"]) == ("sent", None, 3) and len(smtp.messages) == 1 and not world.notifier.retries
    assert nid


def test_retries_are_bounded_and_the_last_failure_is_final(world, smtp):
    world.configure(smtp)
    smtp.drop = True
    nid = world.emit()
    notify_channels.process_outbox(world.notifier)
    for _ in range(6):
        world.tick()
    (row,) = world.rows()
    assert (row["status"], row["reason"], row["attempt"]) == ("failed", "connect", 4), "the first attempt plus three retries"
    assert not world.notifier.retries and smtp.messages == []
    with world.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM notification_events WHERE notification_id = ? AND kind = 'delivery_failed' AND channel = 'email'", (nid,)).fetchone()[0] == 1


def test_the_retry_schedule_is_three_retries_over_thirty_minutes():
    src = open(notify_email.__file__, encoding="utf-8").read()
    ns: dict = {}
    line = next(ln for ln in src.splitlines() if ln.startswith("RETRY_DELAYS_S"))
    exec(line, ns)  # the shipped constant, not the fast one the fixture patches in
    assert len(ns["RETRY_DELAYS_S"]) == 3 and sum(ns["RETRY_DELAYS_S"]) == 30 * 60


def test_4xx_is_transient_and_5xx_is_final(world, smtp):
    world.configure(smtp)
    smtp.rcpt_reply = "451 4.3.0 try again later"
    world.emit(key="x1")
    notify_channels.process_outbox(world.notifier)
    assert world.rows()[-1]["status"] == "retry" and world.rows()[-1]["reason"] == "refused"
    smtp.rcpt_reply = "550 5.1.1 no such user"
    world.tick()
    assert world.rows()[-1]["status"] == "failed" and world.rows()[-1]["reason"] == "refused", "the retry hit a permanent refusal: final"
    assert not world.notifier.retries


def test_one_bad_recipient_does_not_stop_the_others(world, smtp):
    world.configure(smtp, recipients=[OWNER, SECOND])
    smtp.rcpt_reply = lambda a: "550 5.1.1 no such user" if a == OWNER else None
    world.emit()
    world.pump()
    by = {r["target_ref"]: (r["status"], r["reason"]) for r in world.rows()}
    assert by == {"o***@example.test": ("failed", "refused"), "s***@example.test": ("sent", None)}
    assert [m["to"] for m in smtp.messages] == [[SECOND]]


def test_a_dead_server_is_contacted_once_per_dispatch_not_once_per_recipient(world, smtp):
    world.configure(smtp, recipients=[OWNER, SECOND, "third@example.test"])
    smtp.drop = True
    world.emit()
    notify_channels.process_outbox(world.notifier)
    assert smtp.connections == 1 and [r["reason"] for r in world.rows()] == ["connect"] * 3 and len(world.notifier.retries) == 3


def test_retry_rechecks_configuration_recipient_and_reach(world, smtp, settings):
    world.configure(smtp, recipients=[OWNER, SECOND])
    smtp.drop = True
    nid = world.emit()
    notify_channels.process_outbox(world.notifier)
    assert len(world.notifier.retries) == 2
    smtp.drop = False
    # the administrator removes one address and revokes nothing else: only the remaining address is mailed
    world.configure(smtp, recipients=[SECOND])
    world.tick()
    by = {r["target_ref"]: (r["status"], r["reason"]) for r in world.rows()}
    assert by["o***@example.test"] == ("skipped", "no_reach") and by["s***@example.test"][0] == "sent"
    # the notification is resolved before a later retry: that mail is not sent either
    smtp.drop = True
    world.configure(smtp, recipients=[OWNER])
    nid2 = world.emit(key="k2", source="backup.failed")
    notify_channels.process_outbox(world.notifier)
    smtp.drop = False
    with world.db.connection() as conn:
        notify.emit(conn, notify.Signal("backup.failed", "system", "backup", dedupe_key="k2", resolve=True))
    world.tick()
    assert [r for r in world.rows() if r["notification_id"] == nid2][0]["reason"] == "no_reach" and nid


def test_retry_stops_when_the_administrator_loses_notify_manage(world, smtp, settings):
    world.configure(smtp)
    smtp.drop = True
    world.emit()
    notify_channels.process_outbox(world.notifier)
    smtp.drop = False
    with world.db.connection() as conn:
        conn.execute("UPDATE bindings SET revoked_at = '2026-10-01T00:00:00Z' WHERE subject_id = 'dev-joni'")
    world.tick()
    (row,) = world.rows()
    assert (row["status"], row["reason"]) == ("skipped", "no_reach") and smtp.messages == []


# ---------------------------------------------------------------- header injection, size

def test_header_injection_is_refused_and_a_hostile_place_name_is_flattened(world, smtp):
    world.configure(smtp)
    world.emit(place="מטבח\r\nBcc: attacker@evil.test\r\nX-Injected: 1", key="inj")
    world.pump()
    assert len(smtp.messages) == 1
    names = {k.lower() for k in parsed(smtp.messages[0]).keys()}
    assert "bcc" not in names and "x-injected" not in names and smtp.messages[0]["to"] == [OWNER], names
    assert "Bcc" in str(parsed(smtp.messages[0])["Subject"]), "the text survives, flattened to one line, inside the subject"
    # the last-resort guards: an address or a header value with a line break
    cfg = notify_email.MailConfig("127.0.0.1", smtp.port, "none", "", SENDER, (OWNER,))
    ok = notify_email.compose_test("Asia/Jerusalem")
    for bad_to in (OWNER + "\r\nBcc: x@y.test", "x@y.test\nRCPT TO:<z@y.test>", "a b@y.test", "<a@y.test>"):
        with pytest.raises(notify_email.MailError) as ei:
            notify_email.build_message(cfg, bad_to, ok)
        assert ei.value.kind == "invalid"
    with pytest.raises(notify_email.MailError) as ei:
        notify_email.build_message(cfg, OWNER, notify_email.Rendered("ok\r\nBcc: x@y.test", "t", "<p>t</p>"))
    assert ei.value.kind == "invalid"
    with pytest.raises(notify_email.MailError):
        notify_email.build_message(notify_email.MailConfig("h", 25, "none", "", "a@b.test\r\nBcc:x@y.test", ()), OWNER, ok)
    assert notify_email.oneline("a\r\nb c\x00d", 50) == "a b c d" and len(notify_email.oneline("x" * 500, 40)) == 40


def test_oversize_messages_are_refused_without_a_connection(world, smtp, monkeypatch):
    cfg = notify_email.MailConfig("127.0.0.1", smtp.port, "none", "", SENDER, (OWNER,))
    big = notify_email.Rendered("Arx · big", "x" * 90_000, "<p>" + "y" * 90_000 + "</p>")
    with pytest.raises(notify_email.MailError) as ei:
        notify_email.smtp_send(cfg, OWNER, big)
    assert ei.value.kind == "too_large" and not ei.value.retryable and smtp.connections == 0
    # a digest of thousands of conditions stays inside the limit: it names at most MAX_DIGEST_LINES and counts the rest
    items = [notify_email.HeldItem(f"d{i}", f"n{i}", f"סוג {i}", f"מקום {i}", "alert", 1, 0.0) for i in range(3000)]
    r = notify_email.compose_digest(items, tz_name="Asia/Jerusalem")
    assert len(notify_email.build_message(cfg, OWNER, r).as_bytes()) < notify_email.MAX_MESSAGE_BYTES and "ועוד 2980" in r.text


# ---------------------------------------------------------------- policy, quiet hours, scoping

def test_a_source_without_the_email_flag_sends_no_mail(world, smtp):
    world.configure(smtp)
    world.emit("sensor.leak", subject_kind="entity", subject_id="binary_sensor.x", place="מטבח", name="חיישן")
    world.pump()
    assert smtp.messages == [] and world.rows() == []


def test_quiet_hours_hold_non_critical_mail_and_the_matrix_passes_critical(world, smtp, monkeypatch):
    world.configure(smtp)
    assert world.c.put(f"{API}/notify/settings", json={"quiet": {"enabled": True, "from": "00:00", "to": "23:59", "days": ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]}}).status_code == 200
    world.emit("backup.failed", key="q1")                       # alert: held
    world.emit("nvr.offline", key="q2", subject_id="nvr")       # critical: passes (default matrix)
    world.pump()
    by = {r["notification_id"]: (r["status"], r["reason"]) for r in world.rows()}
    assert sorted(by.values()) == [("sent", None), ("skipped", "quiet_hours")] and len(smtp.messages) == 1
    assert "המקליט לא זמין" in str(parsed(smtp.messages[0])["Subject"])


def test_scoping_personal_subjects_and_recipients_without_notify_manage_get_nothing(world, smtp, settings):
    world.configure(smtp)
    bind(world.c, settings, "ops", "operator", "installation", "*")
    # personal subject kinds are never mailed to an installation address
    with world.db.connection() as conn:
        conn.execute("UPDATE notify_policies SET channels_json = ? WHERE source IN ('bulk.partial', 'security.new_signin')", (json.dumps({"inbox": True, "webpush": False, "email": True, "ha_mobile": False, "whatsapp": False}),))
        joni = conn.execute("SELECT id FROM users WHERE username = 'joni'").fetchone()[0]
        notify.emit(conn, notify.Signal("bulk.partial", "bulk_job", "job-1", params={"name": "פעולה", "detail": "חלקי"}, initiator_user_id=joni))
        notify.emit(conn, notify.Signal("security.new_signin", "session", joni, initiator_user_id=joni))
    world.pump()
    assert smtp.messages == [] and sorted(r["reason"] for r in world.rows()) == ["no_reach", "no_reach"]
    # a system row whose only recipient is an ordinary user: no administrator among the recipients -> no mail
    with world.db.connection() as conn:
        ops = conn.execute("SELECT id FROM users WHERE username = 'ops'").fetchone()[0]
        conn.execute("UPDATE notify_policies SET recipients_json = ? WHERE source = 'update.available'", (json.dumps({"rule": "users", "user_ids": [ops]}),))
    world.emit("update.available", key="up1", version="9.9")
    world.pump()
    assert smtp.messages == [] and world.rows()[-1]["reason"] == "no_reach"
    # the same source for the administrators is mailed
    with world.db.connection() as conn:
        conn.execute("UPDATE notify_policies SET recipients_json = ? WHERE source = 'update.available'", (json.dumps({"rule": "managers"}),))
    world.emit("update.available", key="up2", version="9.9")
    world.pump()
    assert len(smtp.messages) == 1 and world.rows()[-1]["status"] == "sent"


def test_a_notify_manage_holder_who_cannot_see_the_subject_is_not_enough(world, smtp, settings):
    """notify.manage alone does not widen visibility: a camera row the administrator's scope does not allow is not mailed."""
    world.configure(smtp)
    with world.db.connection() as conn:
        conn.execute("UPDATE notify_policies SET channels_json = ? WHERE source = 'camera.offline'", (json.dumps({"inbox": True, "webpush": False, "email": True, "ha_mobile": False, "whatsapp": False}),))
        conn.execute("UPDATE notify_policies SET recipients_json = ? WHERE source = 'camera.offline'", (json.dumps({"rule": "managers"}),))
    # joni is a system administrator: sees every camera. A deny binding on that camera takes it away.
    from smplwise.db import new_id, now_iso, permission_revision

    with world.db.connection() as conn:
        conn.execute(
            "INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) VALUES (?, 'user', 'dev-joni', 'operator', 'camera', 'cam-x', 'deny', ?, 'test', ?)",
            (new_id(), permission_revision(conn), now_iso()),
        )
    world.emit("camera.offline", subject_kind="camera", subject_id="cam-x", place="לובי", name="לובי")
    world.pump()
    assert smtp.messages == []
    assert all(r["status"] == "skipped" and r["reason"] == "no_reach" for r in world.rows()) or world.rows() == []


# ---------------------------------------------------------------- rate limit and digest

def test_rate_limit_folds_the_rest_into_one_digest_with_counts(world, smtp, monkeypatch):
    monkeypatch.setattr(notify_email, "MAX_MAILS_PER_MIN", 3)
    world.configure(smtp)
    for i in range(3):
        world.emit(key=f"s{i}", place=f"מקום {i}")
    for i in range(5):                                         # the same condition keeps coming, on different rows
        world.emit(key=f"w{i}", place="מטבח")
    world.emit("update.available", key="u", version="1.0")
    notify_channels.process_outbox(world.notifier)
    assert len(smtp.messages) == 3, "the window allows three mails"
    held = [r for r in world.rows() if r["status"] == "retry"]
    assert len(held) == 6 and {r["reason"] for r in held} == {"rate_limited"}
    assert len(world.notifier.retries) == 1, "one digest job, however many are held"
    # the window frees: ONE digest, a count per condition
    monkeypatch.setattr(notify_email, "_mono", lambda: __import__("time").monotonic() + 120)
    world.tick()
    assert len(smtp.messages) == 4
    digest = parsed(smtp.messages[-1])
    assert "6 התראות נוספות" in str(digest["Subject"])
    txt = text_of(digest)
    assert "×5" in txt and "הגיבוי נכשל · מטבח" in txt and "עדכון זמין" in txt and "×1" in txt
    after = world.rows()
    assert sum(1 for r in after if r["status"] == "sent") == 9
    assert {r["id"] for r in after if r["reason"] == "folded"} == {h["id"] for h in held}, "exactly the held rows say they went out in the digest"
    assert not world.notifier.retries


def test_digest_waits_while_the_window_is_full_and_gives_up_after_the_hold_time(world, smtp, monkeypatch):
    monkeypatch.setattr(notify_email, "MAX_MAILS_PER_MIN", 1)
    clock = {"t": 1000.0}
    monkeypatch.setattr(notify_email, "_mono", lambda: clock["t"])
    world.configure(smtp)
    world.emit(key="a")
    world.emit(key="b")
    notify_channels.process_outbox(world.notifier)
    assert len(smtp.messages) == 1
    monkeypatch.setattr(notify_email, "DIGEST_RETRY_S", 3600.0)
    world.tick()                   # the window is still full: the digest is put back (and waits), nothing is sent
    assert len(smtp.messages) == 1 and len(world.notifier.retries) == 1
    clock["t"] += notify_email.MAX_HOLD_S + 1  # held too long: dropped honestly
    world.tick()
    assert [r["status"] for r in world.rows()] == ["sent", "skipped"] and world.rows()[1]["reason"] == "rate_limited" and len(smtp.messages) == 1


def test_escalations_are_never_held_back_by_the_rate_limit(world, smtp, monkeypatch):
    monkeypatch.setattr(notify_email, "MAX_MAILS_PER_MIN", 1)
    world.configure(smtp)
    world.emit("nvr.offline", key="c1", subject_id="nvr")
    notify_channels.process_outbox(world.notifier)
    nid = world.rows()[0]["notification_id"]
    world.emit(key="other")                                   # takes no slot of its own: the window is full
    notify_channels.process_outbox(world.notifier)
    with world.db.connection() as conn:
        mgr = notify.managers(conn)
        notify._enqueue(conn, "dispatch", nid, {"mode": "escalate", "step": 1, "users": mgr})
    notify_channels.process_outbox(world.notifier)
    subjects = [str(parsed(m)["Subject"]) for m in smtp.messages]
    assert any("לא אושר" in s for s in subjects), subjects


# ---------------------------------------------------------------- escalation / resolve content

def test_resolve_notice_mail(world, smtp):
    world.configure(smtp)
    world.emit("nvr.offline", key="r1", subject_id="nvr")
    world.pump()
    with world.db.connection() as conn:
        notify.emit(conn, notify.Signal("nvr.offline", "system", "nvr", dedupe_key="r1", resolve=True))
    world.pump()
    assert len(smtp.messages) == 2
    last = parsed(smtp.messages[-1])
    assert str(last["Subject"]).startswith("Arx · הסתיים: ") and "המקליט חזר" in text_of(last)


# ---------------------------------------------------------------- the test endpoint

def test_test_endpoint_uses_the_real_path_and_reports_ok(world, smtp, tmp_path, monkeypatch):
    with FakeSMTP(tmp_path, "starttls", auth=("mailer", PASSWORD)) as s:
        monkeypatch.setattr(notify_email, "tls_context", s.client_context)
        world.configure(s, user="mailer", password=PASSWORD, recipients=[OWNER, SECOND])
        r = world.c.post(f"{API}/notify/email/test")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True and body["detail"] == "ok" and (body["delivered"], body["total"]) == (2, 2) and PASSWORD not in r.text, body
        assert sorted(m["to"][0] for m in s.messages) == [OWNER, SECOND] and all(m["tls"] and m["user"] == "mailer" for m in s.messages)
        assert str(parsed(s.messages[0])["Subject"]) == "Arx · הודעת בדיקה"
        last = world.c.get(f"{API}/notify/settings").json()["email"]["last_test"]
        assert last["ok"] is True and last["detail"] == "ok" and last["at"]
        # one recipient only: it must be a configured one (no free-text relay)
        s.messages.clear()
        assert world.c.post(f"{API}/notify/email/test", json={"to": SECOND.upper()}).json()["total"] == 1 and [m["to"] for m in s.messages] == [[SECOND]]
        bad = world.c.post(f"{API}/notify/email/test", json={"to": "stranger@example.test"})
        assert bad.status_code == 422 and bad.json()["code"] == "email_invalid" and len(s.messages) == 1


def test_test_endpoint_failure_is_structured_and_never_echoes_server_text(world, tmp_path, monkeypatch, caplog):
    caplog.set_level(logging.DEBUG)
    with FakeSMTP(tmp_path, "starttls", auth=("mailer", "right")) as s:
        monkeypatch.setattr(notify_email, "tls_context", s.client_context)
        s.banner = "SECRET-BANNER mail.internal.example internal-relay-host token=abc123"
        s.extra_reply_text = "SECRET-BANNER internal-relay-host"
        world.configure(s, user="mailer", password=PASSWORD)
        r = world.c.post(f"{API}/notify/email/test")
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is False and body["detail"] == "auth" and body["delivered"] == 0
        blob = r.text + json.dumps(world.c.get(f"{API}/notify/settings").json()) + world.c.get(f"{API}/audit", params={"prefix": "notify.email.test"}).text + caplog.text
        for secret in ("SECRET-BANNER", "internal-relay-host", "abc123", PASSWORD):
            assert secret not in blob, secret
        assert world.c.get(f"{API}/notify/settings").json()["email"]["last_test"]["detail"] == "auth"
        audit = world.c.get(f"{API}/audit", params={"prefix": "notify.email.test"}).json()["rows"]
        assert audit and audit[0]["details"] == {"ok": False, "detail": "auth"}


def test_test_endpoint_connect_class_and_unconfigured_409(world, smtp):
    r = world.c.post(f"{API}/notify/email/test")
    assert r.status_code == 409 and r.json()["code"] == "channel_unavailable"
    world.configure(smtp)
    smtp.drop = True
    r = world.c.post(f"{API}/notify/email/test")
    assert r.status_code == 200 and r.json()["detail"] == "connect" and r.json()["ok"] is False


def test_test_endpoint_is_rate_limited_to_three_a_minute_with_retry_after(world, smtp):
    world.configure(smtp)
    codes = [world.c.post(f"{API}/notify/email/test").status_code for _ in range(4)]
    assert codes == [200, 200, 200, 429]
    r = world.c.post(f"{API}/notify/email/test")
    assert r.status_code == 429 and r.json()["code"] == "rate_limited" and int(r.headers["Retry-After"]) >= 1 and r.json()["retryable"] is True
    assert len(smtp.messages) == 3, "a limited call sends nothing"


# ---------------------------------------------------------------- channel down

def test_channel_down_notification_after_fifteen_minutes_and_resolved_on_recovery(world, smtp, monkeypatch):
    clock = {"now": dt.datetime.now(dt.timezone.utc)}   # starts at the real now: an outbox row older than an hour is dropped as stale
    monkeypatch.setattr(notify, "now_utc", lambda: clock["now"])
    world.configure(smtp)
    smtp.drop = True
    world.emit(key="d1")
    notify_channels.process_outbox(world.notifier)           # attempt 1: the failure streak starts
    with world.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM notifications WHERE source = 'notify.channel'").fetchone()[0] == 0
    clock["now"] += dt.timedelta(minutes=16)
    world.tick()                                  # a later failure after 15+ minutes: the channel is called down
    with world.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT * FROM notifications WHERE source = 'notify.channel'").fetchall()
    assert len(rows) == 1 and rows[0]["state"] == "open" and rows[0]["subject_kind"] == "system"
    world.tick()
    with world.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM notifications WHERE source = 'notify.channel'").fetchone()[0] == 1, "raised once, not per failure"
    smtp.drop = False
    world.emit(key="d2")
    notify_channels.process_outbox(world.notifier)
    with world.db.connection(mode="read") as conn:
        assert conn.execute("SELECT state FROM notifications WHERE source = 'notify.channel'").fetchone()[0] == "resolved"


# ---------------------------------------------------------------- the secret, everywhere

def test_the_password_is_nowhere_in_any_response_log_or_database_after_a_full_workout(world, tmp_path, monkeypatch, caplog):
    caplog.set_level(logging.DEBUG)
    with FakeSMTP(tmp_path, "starttls", auth=("mailer", PASSWORD)) as good, FakeSMTP(tmp_path, "starttls", auth=("mailer", "other")) as bad:
        monkeypatch.setattr(notify_email, "tls_context", lambda: good.client_context())
        responses = [world.c.put(f"{API}/notify/email", json=world.body(good, user="mailer", password=PASSWORD)).text]
        world.emit(key="w1")
        world.pump()
        responses.append(world.c.post(f"{API}/notify/email/test").text)
        monkeypatch.setattr(notify_email, "tls_context", lambda: bad.client_context())
        world.c.put(f"{API}/notify/email", json=world.body(bad, user="mailer"))      # a server that rejects the stored password
        world.emit(key="w2")
        world.pump()
        responses.append(world.c.post(f"{API}/notify/email/test").text)
        for path in ("/notify/email", "/notify/settings", "/notify/deliveries?status=failures", "/notify/deliveries", "/notify/stats", "/notify/policies",
                     "/notifications", "/notifications/deliveries", "/audit", "/audit?prefix=notify"):
            r = world.c.get(f"{API}{path}")
            assert r.status_code == 200, path
            responses.append(r.text)
        blob = "\n".join(responses) + caplog.text
        assert PASSWORD not in blob
        for m in good.messages:
            assert PASSWORD.encode() not in m["data"], "not in a mail either"


# ---------------------------------------------------------------- start-up cleanup of orphaned `retry` rows

def test_retry_rows_without_a_job_behind_them_are_failed_as_unavailable(world, smtp, monkeypatch):
    monkeypatch.setattr(notify_email, "ORPHAN_GRACE_S", 0.0)
    world.configure(smtp, recipients=[OWNER, SECOND])
    smtp.drop = True
    nid = world.emit(key="o1")
    notify_channels.process_outbox(world.notifier)
    assert [r["status"] for r in world.rows()] == ["retry", "retry"] and len(world.notifier.retries) == 2
    # a pass while the jobs are alive in this process leaves them alone
    notify_channels.housekeeping(world.db)
    assert [r["status"] for r in world.rows()] == ["retry", "retry"]
    # the process restarts: the heap and the in-memory bookkeeping are gone, the rows are not
    notify_email.reset_state()
    world.notifier = push_svc.PushNotifier()
    world.notifier.db = world.db
    notify_channels.housekeeping(world.db)
    rows = world.rows()
    assert [(r["status"], r["reason"]) for r in rows] == [("failed", "unavailable")] * 2
    with world.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM notification_events WHERE notification_id = ? AND kind = 'delivery_failed' AND channel = 'email'", (nid,)).fetchone()[0] == 2
    notify_channels.housekeeping(world.db)   # nothing left to do, nothing changes
    assert [r["status"] for r in world.rows()] == ["failed", "failed"]


def test_a_young_retry_row_gets_its_grace_period(world, smtp):
    world.configure(smtp)
    smtp.drop = True
    world.emit(key="o2")
    notify_channels.process_outbox(world.notifier)
    notify_email.reset_state()               # no live job known, but the row is seconds old (default 60 s grace)
    assert notify_email.recover_orphans(world.db) == 0 and world.rows()[0]["status"] == "retry"
