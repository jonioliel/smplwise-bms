"""TEMPREPORT-2310: the security review of the WhatsApp temperature report link (docs/security/REVIEW_TEMPREPORT_2310.md).

One test (or a small group) per finding, written before the fix. Fakes only: the fake ha-whatsapp transport (nothing leaves the process, every
number is invented), a fake PDF renderer, the tickets world's public listener; no network, no Home Assistant, no real WhatsApp send.

* S1 - the link to SYSTEM USERS has its own switch (`report_link_users`, OFF): the vendor mode `report_attachment` no longer turns it on, and
  turning the user link on does not turn on vendor documents.
* S2 - a link that went to a user's WhatsApp number dies when the user withdraws the opt-in or the number changes.
* S3 - a PDF that leaves by a public link carries no staff name and no free-text maintenance reason unless `report_link_people` is on.
* S4 - "revoke all links" covers every live temperature document link (vendor links included) and counts only live ones.
* S5 - the link routes (list / create / revoke all) answer `Cache-Control: private, no-store`."""
from __future__ import annotations

import datetime as dt
import json

from conftest import as_user, bind
from test_templink_295 import API, PDF, public_get, token_of, turn_on, w  # noqa: F401 - the fixture and helpers of the link feature
from test_walink_295 import give_number, wl  # noqa: F401 - the fake WhatsApp transport fixture

from smplwise.db import now_iso
from smplwise.services import notify_whatsapp as wa
from smplwise.services import temperature as t
from smplwise.services import temperature_pdf
from smplwise.services import temperature_whatsapp as twa
from smplwise.services.tickets import out_documents as D

UTC = dt.timezone.utc
STAFF = "Dana Staffname"
REASON = "compressor swap by Dana"


def _ts() -> float:
    now = dt.datetime.now(UTC)
    at = now.replace(hour=10, minute=0, second=0, microsecond=0)
    return (at if at >= now else at + dt.timedelta(days=1)).timestamp()


def user_links(w, **rules):
    turn_on(w, report_link_users=True, **rules)


def queue(w, headers=None):
    r = w["c"].post(f"{API}/report/send", json={"units": [w["u1"]], "range": "24h", "lang": "he", "recipients": [{"kind": "user", "id": w["uid"]}]}, headers=headers)
    assert r.status_code == 202, r.text
    return r.json()


def docs(w):
    with w["db"].connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM outbound_documents ORDER BY created_at").fetchall()]


def sent_link(w) -> str:
    text = w["fake"].sent_texts()[-1]
    return next(x for x in text.split("\n") if "#d." in x).strip()


def capture_models():
    seen: list[dict] = []

    def render(model):
        seen.append(model)
        return PDF

    temperature_pdf.set_renderer(render)
    return seen


def add_maintenance(w):
    """A maintenance window inside the last 24 h, set by a named staff member, with a free-text reason."""
    now = dt.datetime.now(UTC)
    with w["db"].connection() as conn:
        staff = conn.execute("SELECT id FROM users WHERE username = 'joni'").fetchone()[0]
        conn.execute("UPDATE users SET display_name = ? WHERE id = ?", (STAFF, staff))
        conn.execute("INSERT INTO infra_temp_events(id, unit_id, kind, severity, started_at, ended_at, ack_by, detail_json) VALUES ('ev-m', ?, 'maint', 'info', ?, ?, ?, ?)",
                     (w["u1"], (now - dt.timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%SZ"), (now - dt.timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ"), staff,
                      json.dumps({"reason": REASON})))


def maint_events(model):
    return [e for u in model["units"] for e in u.get("events", []) if e["kind"] == "maint"]


# ---------------------------------------------------------------- S1: a separate switch for links to system users

def test_s1_the_user_link_switch_exists_and_is_off_by_default(wl):
    assert t.code_defaults()["report_link_users"] is False
    assert wl["c"].get(f"{API}/settings").json()["rules"]["report_link_users"] is False


def test_s1_the_vendor_mode_alone_gives_system_users_no_link(wl):
    turn_on(wl, report_attachment="link")  # the vendor document mode and the documents switch, the user switch untouched
    give_number(wl)
    assert wl["c"].get(f"{API}/report/recipients").json()["user_attachment"] == "none"
    queue(wl)
    assert twa.process(wl["db"], _ts())["sent"] == 1
    assert "#d." not in wl["fake"].sent_texts()[0] and docs(wl) == []


def test_s1_the_user_switch_does_not_turn_on_vendor_documents(wl):
    user_links(wl)
    with wl["db"].connection(mode="read") as conn:
        sam = conn.execute("SELECT id FROM users WHERE username = 'joni'").fetchone()[0]
        assert twa.wants_document(conn, {"id": "x", "recipient_kind": "vendor", "contact_id": "c1", "created_by": sam}) is False
        assert twa.wants_document(conn, {"id": "x", "recipient_kind": "user", "user_id": sam, "created_by": sam}) is True


# ---------------------------------------------------------------- S2: consent withdrawn / number changed

def test_s2_withdrawing_the_whatsapp_opt_in_revokes_the_links_sent_to_that_user(wl):
    user_links(wl)
    give_number(wl)
    queue(wl)
    twa.process(wl["db"], _ts())
    manual = wl["c"].post(f"{API}/report/links", json={"units": [wl["u1"]], "range": "24h"}).json()  # made in the dialog, never sent to his number
    sent = token_of(sent_link(wl))
    assert public_get(wl, "doc", sent).status_code == 200
    assert wl["c"].put("/api/v1/me/notify-whatsapp", json={"opted_in": False}).status_code == 200
    assert public_get(wl, "doc/file", sent).status_code == 404
    d = next(x for x in docs(wl) if x["source_id"])
    assert d["revoked_at"] and d["revoked_reason"] == "contact_changed"
    assert public_get(wl, "doc", token_of(manual["url"])).status_code == 200, "a link the user made himself is not a message to his number"


def test_s2_a_changed_number_revokes_the_links_sent_to_the_old_number(wl):
    user_links(wl)
    give_number(wl)
    queue(wl)
    twa.process(wl["db"], _ts())
    sent = token_of(sent_link(wl))
    with wl["db"].connection() as conn:
        conn.execute("UPDATE ticket_contacts SET phone_e164 = '+972505550192' WHERE id = 'c-joni'")
    assert wa.number_change_sweep(wl["db"]) == 1
    assert public_get(wl, "doc/file", sent).status_code == 404
    assert docs(wl)[0]["revoked_reason"] == "contact_changed"


def test_s2_confirming_the_same_number_again_keeps_the_link(wl):
    user_links(wl)
    give_number(wl)
    queue(wl)
    twa.process(wl["db"], _ts())
    sent = token_of(sent_link(wl))
    token = wl["c"].get("/api/v1/me/notify-whatsapp").json()["confirm"]
    assert wl["c"].put("/api/v1/me/notify-whatsapp", json={"opted_in": True, "confirm": token}).status_code == 200
    assert public_get(wl, "doc", sent).status_code == 200


# ---------------------------------------------------------------- S3: no staff names / free text in a linked PDF by default

def test_s3_the_whatsapp_link_pdf_carries_no_staff_name_or_reason_by_default(wl):
    user_links(wl)
    give_number(wl)
    add_maintenance(wl)
    seen = capture_models()
    queue(wl)
    twa.process(wl["db"], _ts())
    [m] = maint_events(seen[-1])
    assert not m.get("by_name") and not m.get("reason")
    assert STAFF not in json.dumps(seen[-1], ensure_ascii=False) and REASON not in json.dumps(seen[-1], ensure_ascii=False)


def test_s3_the_people_setting_puts_them_back(wl):
    user_links(wl, report_link_people=True)
    give_number(wl)
    add_maintenance(wl)
    seen = capture_models()
    queue(wl)
    twa.process(wl["db"], _ts())
    [m] = maint_events(seen[-1])
    assert m["by_name"] == STAFF and m["reason"] == REASON


def test_s3_the_manual_link_pdf_follows_the_same_setting_but_the_inapp_download_does_not(wl):
    turn_on(wl)
    add_maintenance(wl)
    seen = capture_models()
    assert wl["c"].post(f"{API}/report/links", json={"units": [wl["u1"]], "range": "24h", "events": True}).status_code == 201
    [m] = maint_events(seen[-1])
    assert not m.get("by_name") and not m.get("reason")
    assert wl["c"].get(f"{API}/report.pdf", params={"units": wl["u1"], "range": "24h"}).status_code == 200  # the signed-in download keeps them
    [m] = maint_events(seen[-1])
    assert m["by_name"] == STAFF and m["reason"] == REASON


# ---------------------------------------------------------------- S4: revoke all covers every live temperature document link

def test_s4_revoke_all_covers_vendor_links_and_counts_only_live_ones(wl):
    user_links(wl)
    give_number(wl)
    queue(wl)
    twa.process(wl["db"], _ts())
    now = dt.datetime.now(UTC)
    with wl["db"].connection() as conn:
        me = conn.execute("SELECT id FROM users WHERE username = 'joni'").fetchone()[0]
        vendor = D.mint(conn, module="temperature", source_id="snd-v", recipient_kind="contact", recipient_id="c-vendor", media_type="application/pdf",
                        filename="report.pdf", content=PDF, created_by=me, now=now)
        old = D.mint(conn, module="temperature", source_id=None, recipient_kind="user", recipient_id=me, media_type="application/pdf",
                     filename="report.pdf", content=PDF, created_by=me, now=now - dt.timedelta(hours=30), hours=1)
    r = wl["c"].delete(f"{API}/report/links")
    assert r.status_code == 200 and r.json() == {"revoked": 2}, "the sent user link and the vendor link; the expired one is not counted"
    by_id = {d["id"]: d for d in docs(wl)}
    assert by_id[vendor["id"]]["revoked_reason"] == "manual" and by_id[old["id"]]["revoked_at"] is None
    with wl["db"].connection(mode="read") as conn:
        a = conn.execute("SELECT details_json FROM audit_log WHERE action = 'infra.temperature.report.link.revoke_all' ORDER BY rowid DESC").fetchone()
    assert json.loads(a[0])["revoked"] == 2


def test_s4_a_non_manager_revoke_all_leaves_other_peoples_vendor_links(wl):
    user_links(wl)
    now = dt.datetime.now(UTC)
    with wl["db"].connection() as conn:
        conn.execute("INSERT INTO custom_roles(id, name_he, permissions_json, created_at, updated_at) VALUES ('linker', 'linker', ?, ?, ?)",
                     (json.dumps(["infra.temperature.report_link", "devices.read"]), now_iso(), now_iso()))
        me = conn.execute("SELECT id FROM users WHERE username = 'joni'").fetchone()[0]
        vendor = D.mint(conn, module="temperature", source_id="snd-v", recipient_kind="contact", recipient_id="c-vendor", media_type="application/pdf",
                        filename="report.pdf", content=PDF, created_by=me, now=now)
    bind(wl["c"], wl["settings"], "lin", "linker", "installation", "*")
    assert wl["c"].delete(f"{API}/report/links", headers=as_user("lin")).json() == {"revoked": 0}
    assert {d["id"]: d for d in docs(wl)}[vendor["id"]]["revoked_at"] is None


# ---------------------------------------------------------------- S5: the link routes are never cached

def test_s5_the_link_routes_answer_private_no_store(wl):
    turn_on(wl)
    for r in (wl["c"].post(f"{API}/report/links", json={"units": [wl["u1"]], "range": "24h"}), wl["c"].get(f"{API}/report/links"),
              wl["c"].delete(f"{API}/report/links")):
        assert r.status_code in (200, 201), r.text
        cc = r.headers.get("cache-control", "")
        assert "no-store" in cc and "private" in cc, (r.request.method, cc)
