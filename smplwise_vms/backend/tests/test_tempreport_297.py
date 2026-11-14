"""TEMPREPORT-297 (owner 2026-10-27): the temperature report reaches a SYSTEM USER on WhatsApp as a short-lived, signed, read-only download
link inside the ordinary text summary (one-off and scheduled sends) - no file contract needed. Fakes only: the fake ha-whatsapp transport (nothing
leaves the process, every number is invented), a fake PDF renderer, the tickets world's public listener, no network, no Home Assistant.

Covers: off by default (`report_attachment` none), the permission gate on the sender (`infra.temperature.report_link_send`), the link in the
text, the hash-only token, expiry, revocation (one link and all links from Settings), replay past the downloads limit, the recipient's own
scope, the retry / skip paths (no text without the document), the audit row (sender, recipient label, time, downloads; never the number, the
text, the link or the token), and that a report link is never forwarded through the manual link send."""
from __future__ import annotations

import datetime as dt
import hashlib
import json

import pytest
from conftest import as_user, bind
from test_templink_295 import API, PDF, public_get, token_of, turn_on, w  # noqa: F401 - the fixture and helpers of the link feature
from test_walink_295 import give_number, wl  # noqa: F401 - the fake WhatsApp transport fixture

from smplwise.db import now_iso
from smplwise.services import temperature_pdf
from smplwise.services import temperature_report as rep
from smplwise.services import temperature_whatsapp as twa
from smplwise.services.tickets import out_documents as D

UTC = dt.timezone.utc
PHONE_DIGITS = "972505550191"


def _ts() -> float:
    """A pass time inside the default send hours (07:00-21:00 local) and not before the queued rows (queued at the real time)."""
    now = dt.datetime.now(UTC)
    at = now.replace(hour=10, minute=0, second=0, microsecond=0)
    return (at if at >= now else at + dt.timedelta(days=1)).timestamp()


def link_mode(w, **rules):
    turn_on(w, report_link_users=True, **rules)  # TEMPREPORT-2310 S1: the user link has its own switch


def queue(w, headers=None):
    r = w["c"].post(f"{API}/report/send", json={"units": [w["u1"]], "range": "24h", "lang": "he", "recipients": [{"kind": "user", "id": w["uid"]}]}, headers=headers)
    assert r.status_code == 202, r.text
    return r.json()


def rows(w):
    with w["db"].connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM infra_temp_report_sends ORDER BY created_at, id").fetchall()]


def docs(w):
    with w["db"].connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM outbound_documents ORDER BY created_at").fetchall()]


def audits(w, action="infra.temperature.report.document.send"):
    with w["db"].connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()]


def sent_link(w) -> str:
    text = w["fake"].sent_texts()[-1]
    line = next(x for x in text.split("\n") if "#d." in x)
    return line.strip()


# ---------------------------------------------------------------- off by default, the gate

def test_off_by_default_the_summary_has_no_link(wl):
    turn_on(wl)  # the documents switch and the manual link are on, the attachment mode is not
    give_number(wl)
    rules = wl["c"].get(f"{API}/settings").json()["rules"]
    assert rules["report_attachment"] == "none" and rules["report_link_users"] is False
    assert wl["c"].get(f"{API}/report/recipients").json()["user_attachment"] == "none"
    queue(wl)
    assert twa.process(wl["db"], _ts())["sent"] == 1
    text = wl["fake"].sent_texts()[0]
    assert "#d." not in text and rep.TEXT["he"]["pdf"] in text
    assert docs(wl) == [] and audits(wl) == []


def test_the_link_mode_needs_the_documents_switch(wl):
    assert wl["c"].put(f"{API}/settings", json={"rules": {"report_link_users": True}}).status_code == 200  # reports.documents stays off
    give_number(wl)
    assert wl["c"].get(f"{API}/report/recipients").json()["user_attachment"] == "none"
    queue(wl)
    twa.process(wl["db"], _ts())
    assert "#d." not in wl["fake"].sent_texts()[0] and docs(wl) == []


def test_a_sender_without_the_send_permission_sends_the_plain_summary(wl):
    link_mode(wl)
    give_number(wl)
    with wl["db"].connection() as conn:  # a manager role WITHOUT infra.temperature.report_link_send
        conn.execute("INSERT INTO custom_roles(id, name_he, permissions_json, created_at, updated_at) VALUES ('mgr', 'mgr', ?, ?, ?)",
                     (json.dumps(["infra.temperature.manage", "devices.read"]), now_iso(), now_iso()))
    bind(wl["c"], wl["settings"], "mona", "mgr", "installation", "*")
    assert wl["c"].get(f"{API}/report/recipients", headers=as_user("mona")).json()["user_attachment"] == "none"
    assert wl["c"].get(f"{API}/report/recipients").json()["user_attachment"] == "link"
    queue(wl, as_user("mona"))
    twa.process(wl["db"], _ts())
    assert len(wl["fake"].sent_texts()) == 1 and "#d." not in wl["fake"].sent_texts()[0] and docs(wl) == []


# ---------------------------------------------------------------- the link in the message

def test_the_summary_carries_a_live_link_to_the_recipients_pdf(wl):
    link_mode(wl)
    give_number(wl)
    queue(wl)
    out = twa.process(wl["db"], _ts())
    assert out["sent"] == 1, out
    text = wl["fake"].sent_texts()[0]
    url = sent_link(wl)
    token = token_of(url)
    assert rep.TEXT["he"]["pdf"] not in text and "PDF" in text and wl["fake"].calls[0]["service"] == "send_message"
    [d] = docs(wl)
    assert (d["module"], d["recipient_kind"], d["recipient_id"], d["source_id"]) == ("temperature", "user", wl["uid"], rows(wl)[0]["id"])
    assert d["token_hash"] == hashlib.sha256(token.encode()).hexdigest()
    blob = json.dumps({k: (v.hex() if isinstance(v, bytes) else v) for k, v in d.items()})
    assert token not in blob, "only the hash of the token is stored"
    created, expires = (dt.datetime.fromisoformat(d[k].replace("Z", "+00:00")) for k in ("created_at", "expires_at"))
    assert expires - created == dt.timedelta(hours=24) and d["max_opens"] == 10  # the defaults of report_link_hours / report_link_max_opens
    got = public_get(wl, "doc/file", token)  # no account: the token only
    assert got.status_code == 200 and got.content == PDF and got.headers["content-type"] == "application/pdf"
    assert rows(wl)[0]["status"] == "sent"


def test_the_lifetime_and_the_downloads_are_settings_and_replay_ends_at_the_limit(wl):
    link_mode(wl, report_link_hours=2, report_link_max_opens=2)
    give_number(wl)
    queue(wl)
    twa.process(wl["db"], _ts())
    [d] = docs(wl)
    created, expires = (dt.datetime.fromisoformat(d[k].replace("Z", "+00:00")) for k in ("created_at", "expires_at"))
    assert expires - created == dt.timedelta(hours=2)
    token = token_of(sent_link(wl))
    assert [public_get(wl, "doc/file", token).status_code for _ in range(3)] == [200, 200, 404], "a replayed link past its downloads is the uniform 404"
    assert public_get(wl, "doc", token).status_code == 404
    listed = wl["c"].get(f"{API}/report/links").json()["links"][0]
    assert listed["opens"] == 2 and listed["state"] == "used" and listed["sent"] is True and listed["recipient"]


def test_an_expired_link_is_the_uniform_404(wl):
    link_mode(wl)
    give_number(wl)
    queue(wl)
    twa.process(wl["db"], _ts())
    token = token_of(sent_link(wl))
    [d] = docs(wl)
    past = dt.datetime.now(UTC) - dt.timedelta(seconds=1)
    with wl["db"].connection() as conn:
        conn.execute("UPDATE outbound_documents SET created_at = ?, expires_at = ? WHERE id = ?", (D.iso(past - dt.timedelta(hours=24)), D.iso(past), d["id"]))
    assert public_get(wl, "doc/file", token).status_code == 404 and public_get(wl, "doc", token).status_code == 404
    assert wl["c"].get(f"{API}/report/links").json()["links"][0]["state"] == "expired"


def test_revoking_one_link_and_all_links_from_settings(wl):
    link_mode(wl)
    give_number(wl)
    queue(wl)
    twa.process(wl["db"], _ts())
    manual = wl["c"].post(f"{API}/report/links", json={"units": [wl["u1"]], "range": "24h"}).json()  # plus one link made in the report dialog
    tokens = [token_of(sent_link(wl)), token_of(manual["url"])]
    assert all(public_get(wl, "doc", t).status_code == 200 for t in tokens)
    first = manual["id"]
    assert wl["c"].delete(f"{API}/report/links/{first}").status_code == 204
    r = wl["c"].delete(f"{API}/report/links")
    assert r.status_code == 200 and r.json() == {"revoked": 1}
    assert all(public_get(wl, "doc/file", t).status_code == 404 for t in tokens)
    assert {x["state"] for x in wl["c"].get(f"{API}/report/links").json()["links"]} == {"revoked"}
    assert wl["c"].delete(f"{API}/report/links").json() == {"revoked": 0}
    assert [json.loads(a["details_json"])["revoked"] for a in audits(wl, "infra.temperature.report.link.revoke_all")] == [1, 0]


def test_revoke_all_needs_the_link_permission_and_a_non_manager_revokes_only_his_own(wl):
    link_mode(wl)
    for user, role in (("opie", "operator"), ("vera", "viewer")):
        bind(wl["c"], wl["settings"], user, role, "installation", "*")
        assert wl["c"].delete(f"{API}/report/links", headers=as_user(user)).status_code == 403
    give_number(wl)
    queue(wl)
    twa.process(wl["db"], _ts())
    with wl["db"].connection() as conn:
        conn.execute("INSERT INTO custom_roles(id, name_he, permissions_json, created_at, updated_at) VALUES ('linker', 'linker', ?, ?, ?)",
                     (json.dumps(["infra.temperature.report_link", "devices.read"]), now_iso(), now_iso()))
    bind(wl["c"], wl["settings"], "lin", "linker", "installation", "*")
    assert wl["c"].delete(f"{API}/report/links", headers=as_user("lin")).json() == {"revoked": 0}
    assert public_get(wl, "doc", token_of(sent_link(wl))).status_code == 200, "his revoke-all left the others' links alone"


def test_a_report_link_is_never_forwarded_by_the_manual_link_send(wl):
    link_mode(wl, report_link_wa_enabled=True, report_link_wa_recipients=["someone"])
    give_number(wl)
    queue(wl)
    twa.process(wl["db"], _ts())
    [d] = docs(wl)
    r = wl["c"].post(f"{API}/report/links/{d['id']}/send")
    assert r.status_code == 404 and r.json()["code"] == "link_not_found" and len(wl["fake"].sent_texts()) == 1


# ---------------------------------------------------------------- scope, failures

def test_a_recipient_who_sees_no_unit_gets_nothing(wl):
    link_mode(wl)
    give_number(wl)
    bind(wl["c"], wl["settings"], "nobody", "viewer", "site", "no-such-site")
    with wl["db"].connection(mode="read") as conn:
        uid = conn.execute("SELECT id FROM users WHERE username = 'nobody'").fetchone()[0]
    r = wl["c"].post(f"{API}/report/send", json={"units": [wl["u1"]], "range": "24h", "recipients": [{"kind": "user", "id": uid}]})
    assert r.status_code == 202, r.text
    twa.process(wl["db"], _ts())
    assert docs(wl) == [] and wl["fake"].calls == []


def test_a_busy_pdf_engine_retries_and_the_text_never_leaves_without_the_document(wl):
    link_mode(wl)
    give_number(wl)
    queue(wl)

    def busy(model):
        raise temperature_pdf.PdfError("pdf_busy")

    temperature_pdf.set_renderer(busy)
    out = twa.process(wl["db"], _ts())
    assert out["retry"] == 1 and wl["fake"].calls == [] and docs(wl) == []
    assert (rows(wl)[0]["status"], rows(wl)[0]["reason"]) == ("retry", "pdf_busy")


def test_an_oversized_pdf_is_skipped_and_audited(wl):
    link_mode(wl)
    give_number(wl)
    queue(wl)
    temperature_pdf.set_renderer(lambda model: b"%PDF-" + b"0" * (D.MAX_BYTES + 1))
    out = twa.process(wl["db"], _ts())
    assert out["skipped"] == 1 and wl["fake"].calls == []
    assert (rows(wl)[0]["status"], rows(wl)[0]["reason"]) == ("skipped", "document_too_large")
    [a] = audits(wl)
    assert a["decision"] == "denied" and json.loads(a["details_json"])["reason"] == "document_too_large"


def test_a_refused_message_revokes_its_link(wl):
    link_mode(wl)
    give_number(wl)
    queue(wl)
    wl["fake"].queue("refused")
    twa.process(wl["db"], _ts())
    [d] = docs(wl)
    assert d["revoked_at"] and d["revoked_reason"] == "send_failed"
    assert (rows(wl)[0]["status"], rows(wl)[0]["reason"]) == ("failed", "provider_refused")


# ---------------------------------------------------------------- the audit row

def test_the_audit_row_names_sender_recipient_and_time_but_never_the_number_or_the_link(wl):
    link_mode(wl)
    give_number(wl)
    queue(wl)
    twa.process(wl["db"], _ts())
    token = token_of(sent_link(wl))
    assert public_get(wl, "doc/file", token).status_code == 200
    [a] = audits(wl)
    det = json.loads(a["details_json"])
    assert a["decision"] == "allowed" and a["at"] and a["resource_id"] == docs(wl)[0]["id"]
    assert det["sender"] and det["recipient"] == wl["uid"] and det["recipient_label"] and det["status"] == "sent" and det["units"] == 1
    with wl["db"].connection(mode="read") as conn:
        everything = json.dumps([dict(r) for r in conn.execute("SELECT * FROM audit_log").fetchall()], default=str)
        opens = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'report.document.open' AND resource_id = ?", (a["resource_id"],)).fetchone()[0]
    assert opens == 1, "each download is audited and counted"
    assert token not in everything and PHONE_DIGITS not in everything and "0191" not in everything and "/support/#d." not in everything


# ---------------------------------------------------------------- the text

def test_the_text_puts_the_link_on_its_own_line_and_keeps_the_cap():
    model = {"lang": "en", "zone": "Asia/Jerusalem", "from": 0, "to": 3600, "units": [{"name": f"Unit {i}", "stats": {"min": 1.0, "max": 5.0, "avg": 3.0, "out_min": 0,
             "alarms": 0, "warnings": 0}} for i in range(40)]}
    link = "https://x.test/support/#d." + "A" * 43
    text = rep.text_summary(model, link=link, until=dt.datetime(2026, 10, 28, 10, 0, tzinfo=UTC))
    lines = text.split("\n")
    assert link in lines and len(text) <= rep.TEXT_MAX and "28.10 12:00" in text and "and " in text and lines[-1] == rep.TEXT["en"]["footer"]


@pytest.mark.parametrize("mode", ["pdf", "html", "file"])
def test_only_the_known_attachment_modes_are_accepted(wl, mode):
    assert wl["c"].put(f"{API}/settings", json={"rules": {"report_attachment": mode}}).status_code == 422
