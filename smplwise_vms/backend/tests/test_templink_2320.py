"""TEMPLINK-2320: the owner's decisions of 2026-10-31 on the temperature report / document links (docs/security/REVIEW_TEMPREPORT_2310.md
section 5), written before the code.

* 4A - a user who is DEACTIVATED or DELETED loses every live report link minted for him (recipient_kind `user`) at once, in every identity
  path (Arx-only users, Home Assistant users managed from Arx, the Home Assistant directory push) and, as a safety net, at the janitor pass.
  Audited as a count only.
* 5A - a per-sender mint limit for report links: `report_link_daily_max` (default 50 per rolling 24 h, 0 = no limit). The dialog link, the
  WhatsApp link to a system user and the vendor link all count against the SENDER; the refusal is a clear Hebrew / English error and a
  `denied` audit row.
* 6A - the audit row of a link sent to a system user keeps the recipient's display name (pinned).

Fakes only: the tickets world's public listener, the fake ha-whatsapp transport, the fake Home Assistant user API; invented numbers."""
from __future__ import annotations

import dataclasses
import datetime as dt
import hashlib
import json
import secrets

import pytest
from conftest import as_user
from test_templink_295 import API, PDF, make, public_get, token_of, turn_on, w  # noqa: F401 - the fixture and helpers of the link feature
from test_tempreport_2310_security import _ts, docs, queue, sent_link, user_links
from test_walink_295 import give_number, wl  # noqa: F401 - the fake WhatsApp transport fixture

from smplwise.db import Database, now_iso
from smplwise.services import temperature as t
from smplwise.services import temperature_whatsapp as twa
from smplwise.services.tickets import out_documents as D

UTC = dt.timezone.utc


def _iso(at: dt.datetime) -> str:
    return D.iso(at)


def seed_doc(conn, recipient_id: str, *, kind: str = "user", source_id: str | None = "snd-1", created_by: str | None = "dev-joni",
             created_at: dt.datetime | None = None, hours: float = 24, open_count: int = 0, module: str = "temperature") -> str:
    """A raw `outbound_documents` row (no module key needed): what a mint leaves behind."""
    created = created_at or dt.datetime.now(UTC)
    doc_id = secrets.token_hex(16)
    conn.execute("INSERT INTO outbound_documents(id, key_id, token_hash, module, source_id, recipient_kind, recipient_id, media_type, filename, size_bytes, "
                 "sha256, content, max_opens, open_count, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                 (doc_id, "k1", hashlib.sha256(doc_id.encode()).hexdigest(), module, source_id, kind, recipient_id, "application/pdf", "report.pdf", len(PDF),
                  hashlib.sha256(PDF).hexdigest(), PDF, 10, open_count, created_by, _iso(created), _iso(created + dt.timedelta(hours=hours))))
    return doc_id


def doc_rows(db) -> dict[str, dict]:
    with db.connection(mode="read") as conn:
        return {r["id"]: dict(r) for r in conn.execute("SELECT * FROM outbound_documents").fetchall()}


def audit_rows(db, action: str) -> list[dict]:
    with db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()]


def user_id(db, username: str) -> str:
    with db.connection(mode="read") as conn:
        return conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()[0]


REVOKE_ACTION = "report.document.revoke_user_inactive"


# ---------------------------------------------------------------- 4A: deactivated / deleted users

def test_4a_the_sweep_revokes_only_live_user_links_of_inactive_users_and_audits_a_count(w):
    db = w["db"]
    sam, joni = user_id(db, "sam"), user_id(db, "joni")
    with db.connection() as conn:
        sent = seed_doc(conn, sam)                                   # a link sent to him inside a report
        dialog = seed_doc(conn, sam, source_id=None, created_by=sam)  # a link he made himself in the dialog
        expired = seed_doc(conn, sam, created_at=dt.datetime.now(UTC) - dt.timedelta(hours=30))
        used = seed_doc(conn, sam, open_count=10)
        other = seed_doc(conn, joni)                                 # an active user's link
        vendor = seed_doc(conn, sam, kind="contact")                 # a contact row that happens to carry the same id
        conn.execute("UPDATE users SET active = 0 WHERE id = ?", (sam,))
        n = D.revoke_for_inactive_users_safe(conn, dt.datetime.now(UTC))
    assert n == 2
    rows = doc_rows(db)
    assert rows[sent]["revoked_at"] and rows[dialog]["revoked_at"]
    assert rows[sent]["revoked_reason"] == "contact_erased"
    for keep in (expired, used, other, vendor):
        assert rows[keep]["revoked_at"] is None, keep
    [a] = audit_rows(db, REVOKE_ACTION)
    assert a["decision"] == "allowed" and json.loads(a["details_json"]) == {"revoked": 2}
    assert sam not in json.dumps(a, default=str), "a count only - no user id, no name"
    with db.connection() as conn:
        assert D.revoke_for_inactive_users_safe(conn, dt.datetime.now(UTC)) == 0
    assert len(audit_rows(db, REVOKE_ACTION)) == 1, "nothing revoked, nothing audited"


def test_4a_a_deleted_user_counts_as_inactive(w):
    db = w["db"]
    sam = user_id(db, "sam")
    with db.connection() as conn:
        d = seed_doc(conn, sam)
        conn.execute("UPDATE users SET deleted_at = ? WHERE id = ?", (now_iso(), sam))
        assert D.revoke_for_inactive_users_safe(conn, dt.datetime.now(UTC)) == 1
    assert doc_rows(db)[d]["revoked_at"]


def test_4a_a_sent_link_stops_answering_when_the_recipient_is_deactivated_by_the_directory_push(wl):
    """The Home Assistant directory push (routers/ha.py bridge_directory) is a deactivation path."""
    from smplwise.services import ha_bridge

    user_links(wl)
    give_number(wl)
    queue(wl)
    twa.process(wl["db"], _ts())
    token = token_of(sent_link(wl))
    assert public_get(wl, "doc", token).status_code == 200
    with wl["db"].connection() as conn:
        conn.execute("UPDATE users SET source = 'ingress' WHERE id = ?", (wl["uid"],))
        others = [r[0] for r in conn.execute("SELECT id FROM users WHERE id <> ?", (wl["uid"],)).fetchall()]
    secret = wl["c"].get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    people = [{"id": wl["uid"], "name": "joni", "username": "joni", "is_active": False, "is_admin": False}]
    people += [{"id": u, "name": u, "username": u, "is_active": True, "is_admin": False} for u in others]
    r = wl["c"].post("/api/v1/ha/bridge/directory", json=ha_bridge.sign(secret, {"users": people}))
    assert r.status_code == 200, r.text
    with wl["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT active FROM users WHERE id = ?", (wl["uid"],)).fetchone()[0] == 0
    assert public_get(wl, "doc/file", token).status_code == 404
    assert json.loads(audit_rows(wl["db"], REVOKE_ACTION)[-1]["details_json"]) == {"revoked": 1}


def test_4a_the_janitor_is_the_safety_net_for_any_other_path(w):
    """A user switched off by a path without the hook (or by hand) loses his links at the next tickets janitor pass."""
    from smplwise.services.tickets.messaging import MessagingRuntime

    db = w["db"]
    sam = user_id(db, "sam")
    with db.connection() as conn:
        d = seed_doc(conn, sam)
        conn.execute("UPDATE users SET active = 0 WHERE id = ?", (sam,))
    MessagingRuntime().janitor(db, force=True)
    assert doc_rows(db)[d]["revoked_at"]


# ---- the Arx-only identity paths (routers/local_identity.py)

from test_local_identity import lx  # noqa: E402,F401 - the remote-enabled app with local identities


def _lx_doc(lx, uid: str) -> str:
    with Database(lx.settings.db_path).connection() as conn:
        return seed_doc(conn, uid)


def _lx_rows(lx) -> dict[str, dict]:
    return doc_rows(Database(lx.settings.db_path))


def test_4a_disabling_an_arx_user_revokes_his_links_at_once(lx):
    lx.enable()
    uid = lx.create("maria")["user"]["id"]
    d = _lx_doc(lx, uid)
    assert lx.admin.patch(f"/api/v1/identity/local-users/{uid}", json={"active": False}).status_code == 200
    row = _lx_rows(lx)[d]
    assert row["revoked_at"] and row["revoked_reason"] == "contact_erased"
    assert lx.admin.patch(f"/api/v1/identity/local-users/{uid}", json={"active": True}).status_code == 200
    assert _lx_rows(lx)[d]["revoked_at"], "re-enabling the user never brings a link back"


def test_4a_deleting_an_arx_user_revokes_his_links_at_once(lx):
    lx.enable()
    uid = lx.create("maria")["user"]["id"]
    d = _lx_doc(lx, uid)
    assert lx.admin.delete(f"/api/v1/identity/local-users/{uid}").status_code == 200
    assert _lx_rows(lx)[d]["revoked_at"]
    assert json.loads(audit_rows(Database(lx.settings.db_path), REVOKE_ACTION)[-1]["details_json"]) == {"revoked": 1}


# ---- the Home Assistant users managed from Arx (routers/ha_users.py)

from test_ha_users import _client, _create, fake, ha_settings  # noqa: E402,F401 - the fake Home Assistant user API


def test_4a_deactivating_a_managed_home_assistant_user_revokes_his_links(ha_settings, fake):  # noqa: F811
    c = _client(ha_settings)
    status, body = _create(c)
    assert status == 201, body
    uid = body["user"]["ha_user_id"]
    with Database(ha_settings.db_path).connection() as conn:
        d = seed_doc(conn, uid)
    assert c.post(f"/api/v1/ha-users/{uid}/deactivate", json={"confirm": True}).status_code == 200
    assert doc_rows(Database(ha_settings.db_path))[d]["revoked_at"]


def test_4a_deleting_a_managed_home_assistant_user_revokes_his_links(ha_settings, fake):  # noqa: F811
    c = _client(ha_settings)
    status, body = _create(c)
    assert status == 201, body
    uid = body["user"]["ha_user_id"]
    with Database(ha_settings.db_path).connection() as conn:
        d = seed_doc(conn, uid)
    assert c.post(f"/api/v1/ha-users/{uid}/delete", json={"confirm_username": "dana"}).status_code == 200
    assert doc_rows(Database(ha_settings.db_path))[d]["revoked_at"]


# ---------------------------------------------------------------- 5A: the per-sender mint limit

LIMIT_CODE = "report_link_daily_limit"
LIMIT_ACTION = "infra.temperature.report.link.limit"


def test_5a_the_limit_is_a_setting_default_50_and_0_means_no_limit(w):
    assert t.code_defaults()["report_link_daily_max"] == 50
    rules = w["c"].get(f"{API}/settings").json()
    assert rules["rules"]["report_link_daily_max"] == 50
    assert rules["rule_specs"]["report_link_daily_max"]["min"] == 0
    for bad in (-1, 1001, 2.5, "10"):
        assert w["c"].put(f"{API}/settings", json={"rules": {"report_link_daily_max": bad}}).status_code == 422, bad
    assert w["c"].put(f"{API}/settings", json={"rules": {"report_link_daily_max": 0}}).status_code == 200


def _fill(db, sender: str, n: int, *, hours_ago: float = 1) -> None:
    with db.connection() as conn:
        for _ in range(n):
            seed_doc(conn, sender, source_id=None, created_by=sender, created_at=dt.datetime.now(UTC) - dt.timedelta(hours=hours_ago))


def test_5a_the_dialog_link_stops_exactly_at_the_limit_with_a_clear_error_and_a_denied_audit_row(w):
    turn_on(w, report_link_daily_max=3, report_link_per_hour=200)
    joni = user_id(w["db"], "joni")
    _fill(w["db"], joni, 2)
    assert make(w).status_code == 201, "2 + 1 = the limit: still allowed (the boundary)"
    r = make(w)
    assert r.status_code == 429
    body = r.json()
    assert body["code"] == LIMIT_CODE and "24" in body["user_message"] and "24" in body["details"]["message_en"]
    with w["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM outbound_documents WHERE created_by = ?", (joni,)).fetchone()[0] == 3, "the refusal minted nothing"
    [a] = audit_rows(w["db"], LIMIT_ACTION)
    det = json.loads(a["details_json"])
    assert a["decision"] == "denied" and a["reason"] == LIMIT_CODE and a["resource_id"] == joni
    assert det == {"kind": "dialog", "limit": 3, "minted_24h": 3}
    assert make(w, as_user("sam")).status_code == 201, "the limit is per sender"


def test_5a_the_window_is_a_rolling_24_hours(w):
    turn_on(w, report_link_daily_max=2, report_link_per_hour=200)
    joni = user_id(w["db"], "joni")
    _fill(w["db"], joni, 5, hours_ago=25)  # older than 24 h: not counted
    _fill(w["db"], joni, 1, hours_ago=23)
    assert make(w).status_code == 201
    assert make(w).json()["code"] == LIMIT_CODE


def test_5a_zero_means_no_limit(w):
    turn_on(w, report_link_daily_max=0, report_link_per_hour=200)
    _fill(w["db"], user_id(w["db"], "joni"), 60)
    assert make(w).status_code == 201
    assert audit_rows(w["db"], LIMIT_ACTION) == []


def test_5a_the_default_limit_applies_without_any_setting(w):
    turn_on(w, report_link_per_hour=200)
    joni = user_id(w["db"], "joni")
    _fill(w["db"], joni, 49)
    assert make(w).status_code == 201, "the 50th link of the day"
    assert make(w).json()["code"] == LIMIT_CODE, "the 51st is refused"


def test_5a_a_whatsapp_link_over_the_limit_is_skipped_and_audited_and_nothing_is_sent(wl):
    user_links(wl, report_link_daily_max=2)
    give_number(wl)
    _fill(wl["db"], wl["uid"], 2)  # the sender (joni, sending to himself) already minted 2 today
    queue(wl)
    out = twa.process(wl["db"], _ts())
    assert out["skipped"] == 1 and out["sent"] == 0
    assert wl["fake"].sent_texts() == [], "the text never leaves without the document the mode promises"
    with wl["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT reason FROM infra_temp_report_sends").fetchone()[0] == LIMIT_CODE
    [lim] = audit_rows(wl["db"], LIMIT_ACTION)
    assert lim["decision"] == "denied" and json.loads(lim["details_json"])["kind"] == "user"
    [send] = audit_rows(wl["db"], "infra.temperature.report.document.send")
    assert send["decision"] == "denied" and send["reason"] == LIMIT_CODE


def test_5a_a_vendor_link_counts_against_its_sender_too(wl):
    turn_on(wl, report_attachment="link", report_link_daily_max=1)
    sam = user_id(wl["db"], "sam")
    row = {"id": "snd-v", "recipient_kind": "vendor", "contact_id": "c-vendor", "created_by": sam}
    model = {"zone": "Asia/Jerusalem", "to": 1_800_000_000}
    with wl["db"].connection() as conn:
        assert twa.attachment_for(conn, row, model, pdf=PDF), "the first vendor link of the day"
        with pytest.raises(D.DocumentRefused) as e:
            twa.attachment_for(conn, {**row, "id": "snd-v2"}, model, pdf=PDF)
    assert e.value.code == LIMIT_CODE
    [a] = audit_rows(wl["db"], LIMIT_ACTION)
    assert a["resource_id"] == sam and json.loads(a["details_json"])["kind"] == "vendor"


# ---------------------------------------------------------------- 6A: the recipient's display name stays in the audit row

def test_6a_the_send_audit_row_keeps_the_recipients_display_name(wl):
    user_links(wl)
    give_number(wl)
    with wl["db"].connection() as conn:
        conn.execute("UPDATE users SET display_name = 'Joni Recipient' WHERE id = ?", (wl["uid"],))
    queue(wl)
    twa.process(wl["db"], _ts())
    [a] = audit_rows(wl["db"], "infra.temperature.report.document.send")
    det = json.loads(a["details_json"])
    assert a["decision"] == "allowed" and det["recipient"] == wl["uid"] and det["recipient_label"] == "Joni Recipient"
