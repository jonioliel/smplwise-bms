"""TEMPLINK-295: the temperature report as a TEMPORARY DOWNLOAD LINK made from the report dialog - off by default, the permission, the lifetime
(default 24 h, editable), the hash-only token, the public download without an account, expiry, revocation, the per-user rate limit and the
audit rows (who / when / which document id, never the report or the token). Fakes only: a fake PDF renderer, the tickets world's public
listener driven through an ASGI test client, no Home Assistant, no network."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
from pathlib import Path

import pytest
from conftest import as_user, bind
from tickets_s4_world import BASE_URL, build_s4

from smplwise.db import now_iso
from smplwise.services import ha_sync, temperature_pdf, temperature_runtime as rt
from smplwise.services import temperature_report_link as rl
from smplwise.services.ha_user_auth import RateLimiter
from smplwise.services.tickets import out_documents as D
from smplwise.services.tickets import settings_doc

API = "/api/v1/infra/temperature"
UTC = dt.timezone.utc
PDF = b"%PDF-1.7\n%templink fake report\n"


@pytest.fixture()
def w(settings, monkeypatch):
    s4 = build_s4(settings, monkeypatch)
    monkeypatch.setattr(D, "PAGE_READY", True)
    monkeypatch.setattr(rl, "LIMITER", RateLimiter())
    ha_sync.STATE.connected = True
    rt.reset()
    temperature_pdf.set_renderer(lambda model: PDF)
    c, db = s4.c, s4.db
    at = now_iso()
    with db.connection() as conn:
        conn.execute("""INSERT INTO ha_entities (entity_id, name, domain, device_class, unit, state, available, last_changed, last_updated, first_seen_at, updated_at)
                        VALUES ('sensor.fridge_temp', 'שם fridge', 'sensor', 'temperature', '°C', '4.0', 1, ?, ?, ?, ?)""", (at, at, at, at))
    u1 = c.post(API, json={"name": "מקרר מטבח", "temp_entity_id": "sensor.fridge_temp", "low": 2, "high": 6, "defrost_mode": "none"}).json()["id"]
    bind(c, settings, "sam", "site_admin", "installation", "*")
    yield {"s4": s4, "c": c, "db": db, "u1": u1, "settings": settings}
    temperature_pdf.set_renderer(None)
    ha_sync.STATE.connected = False


def turn_on(w, **rules):
    r = w["c"].put(f"{API}/settings", json={"rules": {"report_link_enabled": True, **rules}})
    assert r.status_code == 200, r.text
    with w["db"].connection() as conn:
        settings_doc.apply_patch(conn, {"reports": {"documents": True}})


def make(w, headers=None, **extra):
    return w["c"].post(f"{API}/report/links", json={"units": [w["u1"]], "range": "24h", **extra}, headers=headers)


def token_of(url: str) -> str:
    assert url.startswith(f"{BASE_URL}/support/#d.")
    return url.split("#d.", 1)[1]


def public_get(w, path, token):
    client, _app = w["s4"].public()
    return client.get(f"/support/api/{path}", headers={"X-Ticket-Token": token})


def when(text: str) -> dt.datetime:
    return dt.datetime.fromisoformat(text.replace("Z", "+00:00"))


# ---------------------------------------------------------------- off by default, permission

def test_off_by_default_even_for_the_administrator(w):
    r = make(w)
    assert r.status_code == 409 and r.json()["code"] == "report_link_off"
    st = w["c"].get(f"{API}/report/links").json()
    assert st["available"] is False and st["hours"] == 24 and st["links"] == []
    assert w["c"].get(f"{API}/settings").json()["rules"]["report_link_enabled"] is False
    with w["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM outbound_documents").fetchone()[0] == 0


def test_the_tickets_documents_switch_is_also_required(w):
    assert w["c"].put(f"{API}/settings", json={"rules": {"report_link_enabled": True}}).status_code == 200
    r = make(w)  # reports.documents is off: the public listener would not serve the file
    assert r.status_code == 409 and r.json()["code"] == "report_link_unavailable"
    assert w["c"].get(f"{API}/report/links").json()["available"] is False


def test_only_holders_of_the_permission_may_create_list_or_revoke(w):
    turn_on(w)
    for user, role in (("opie", "operator"), ("vera", "viewer")):
        bind(w["c"], w["settings"], user, role, "installation", "*")
        h = as_user(user)
        assert make(w, h).status_code == 403
        assert w["c"].get(f"{API}/report/links", headers=h).status_code == 403
        assert w["c"].delete(f"{API}/report/links/{'a' * 32}", headers=h).status_code == 403
    assert make(w, as_user("sam")).status_code == 201  # site_admin holds it by default
    assert make(w).status_code == 201                  # system_admin too


def test_the_settings_are_validated(w):
    for k, bad in (("report_link_hours", 0), ("report_link_hours", 169), ("report_link_max_opens", 21), ("report_link_per_hour", 0), ("report_link_enabled", "yes")):
        assert w["c"].put(f"{API}/settings", json={"rules": {k: bad}}).status_code == 422, k


# ---------------------------------------------------------------- the link: hash only, 24 h default, the public download

def test_a_link_is_created_with_a_24_hour_lifetime_and_only_its_hash_is_stored(w):
    turn_on(w)
    r = make(w)
    assert r.status_code == 201, r.text
    body = r.json()
    token = token_of(body["url"])
    assert when(body["expires_at"]) - when(body["created_at"]) == dt.timedelta(hours=24) and body["state"] == "live" and body["max_opens"] == 10
    with w["db"].connection(mode="read") as conn:
        row = dict(conn.execute("SELECT * FROM outbound_documents WHERE id = ?", (body["id"],)).fetchone())
        audit = json.dumps([dict(a) for a in conn.execute("SELECT * FROM audit_log").fetchall()], default=str)
    everything = json.dumps({k: (v.hex() if isinstance(v, bytes) else v) for k, v in row.items()}) + audit
    assert row["token_hash"] == hashlib.sha256(token.encode()).hexdigest() and row["module"] == "temperature" and row["recipient_kind"] == "user"
    assert token not in everything, "the token is nowhere in the database, the audit included"
    listed = w["c"].get(f"{API}/report/links").json()
    assert listed["available"] is True and [x["id"] for x in listed["links"]] == [body["id"]]
    assert "url" not in listed["links"][0] and token not in json.dumps(listed)


def test_the_lifetime_is_a_setting(w):
    turn_on(w, report_link_hours=2, report_link_max_opens=3)
    body = make(w).json()
    assert when(body["expires_at"]) - when(body["created_at"]) == dt.timedelta(hours=2) and body["max_opens"] == 3


def test_anyone_with_the_link_downloads_only_that_report_without_an_account(w):
    turn_on(w)
    a, b = make(w).json(), make(w, lang="en").json()
    ta, tb = token_of(a["url"]), token_of(b["url"])
    assert ta != tb
    got = public_get(w, "doc/file", ta)  # no session: the public listener, the token only
    assert got.status_code == 200 and got.content == PDF and got.headers["content-type"] == "application/pdf"
    assert got.headers["content-disposition"].startswith("attachment;")
    assert public_get(w, "doc", ta).json()["filename"] == a["filename"]
    assert public_get(w, "doc/file", "A" * 43).status_code == 404
    assert public_get(w, "doc/file", ta[:-1] + ("A" if ta[-1] != "A" else "B")).status_code == 404


def test_expired_links_answer_the_uniform_404(w):
    turn_on(w)
    body = make(w).json()
    token = token_of(body["url"])
    with w["db"].connection() as conn:
        past = dt.datetime.now(UTC) - dt.timedelta(seconds=1)
        conn.execute("UPDATE outbound_documents SET created_at = ?, expires_at = ? WHERE id = ?", (D.iso(past - dt.timedelta(hours=24)), D.iso(past), body["id"]))
    assert public_get(w, "doc/file", token).status_code == 404 and public_get(w, "doc", token).status_code == 404
    assert w["c"].get(f"{API}/report/links").json()["links"][0]["state"] == "expired"


def test_the_downloads_limit_ends_the_link(w):
    turn_on(w, report_link_max_opens=1)
    token = token_of(make(w).json()["url"])
    assert public_get(w, "doc/file", token).status_code == 200
    assert public_get(w, "doc/file", token).status_code == 404


# ---------------------------------------------------------------- revoke

def test_revoking_ends_the_link_at_once(w):
    turn_on(w)
    body = make(w).json()
    token = token_of(body["url"])
    assert public_get(w, "doc", token).status_code == 200
    assert w["c"].delete(f"{API}/report/links/{body['id']}").status_code == 204
    assert public_get(w, "doc/file", token).status_code == 404
    assert w["c"].delete(f"{API}/report/links/{body['id']}").status_code == 204, "revoking twice is not an error"
    assert w["c"].get(f"{API}/report/links").json()["links"][0]["state"] == "revoked"
    assert w["c"].delete(f"{API}/report/links/{'f' * 32}").status_code == 404
    with w["db"].connection(mode="read") as conn:
        actions = [r["action"] for r in conn.execute("SELECT action FROM audit_log WHERE resource_id = ?", (body["id"],)).fetchall()]
    assert actions.count("infra.temperature.report.link.revoke") == 1, "the second revoke wrote nothing"


def test_a_user_with_the_permission_only_sees_and_revokes_his_own_links(w):
    turn_on(w)
    # a custom role holding the new permission and devices.read but not infra.temperature.manage
    with w["db"].connection() as conn:
        conn.execute("INSERT INTO custom_roles(id, name_he, permissions_json, created_at, updated_at) VALUES ('linker', 'linker', ?, ?, ?)",
                     (json.dumps([rl.PERM, "devices.read"]), now_iso(), now_iso()))
    bind(w["c"], w["settings"], "lin", "linker", "installation", "*")
    mine = make(w, as_user("lin")).json()
    theirs = make(w).json()
    assert [x["id"] for x in w["c"].get(f"{API}/report/links", headers=as_user("lin")).json()["links"]] == [mine["id"]]
    assert w["c"].delete(f"{API}/report/links/{theirs['id']}", headers=as_user("lin")).status_code == 404
    assert public_get(w, "doc", token_of(theirs["url"])).status_code == 200, "his attempt changed nothing"
    assert w["c"].delete(f"{API}/report/links/{mine['id']}", headers=as_user("lin")).status_code == 204
    assert w["c"].delete(f"{API}/report/links/{mine['id']}").status_code == 204  # the manager may revoke any link (idempotent)
    assert w["c"].delete(f"{API}/report/links/{theirs['id']}").status_code == 204


# ---------------------------------------------------------------- audit, rate limit

def test_audit_rows_for_create_open_and_revoke_carry_no_contents(w):
    turn_on(w)
    body = make(w).json()
    token = token_of(body["url"])
    assert public_get(w, "doc/file", token).status_code == 200
    assert w["c"].delete(f"{API}/report/links/{body['id']}").status_code == 204
    with w["db"].connection(mode="read") as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE resource_id = ? ORDER BY rowid", (body["id"],)).fetchall()]
    assert [r["action"] for r in rows] == ["report.document.mint", "infra.temperature.report.link.create", "report.document.open", "infra.temperature.report.link.revoke"]
    blob = json.dumps(rows, default=str)
    assert token not in blob and "fake report" not in blob and "מקרר" not in blob and PDF.decode() not in blob


def test_creation_is_rate_limited_per_user(w):
    turn_on(w, report_link_per_hour=2)
    assert [make(w).status_code for _ in range(2)] == [201, 201]
    third = make(w)
    assert third.status_code == 429 and third.json()["code"] == "report_link_rate"
    assert make(w, as_user("sam")).status_code == 201, "another user has his own allowance"
    with w["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM outbound_documents").fetchone()[0] == 3, "the refused request minted nothing"


def test_a_report_the_user_cannot_see_is_not_linkable(w):
    turn_on(w)
    r = w["c"].post(f"{API}/report/links", json={"units": ["no-such-unit"], "range": "24h"})
    assert r.status_code == 404 and r.json()["code"] == "unit_not_found"


def test_an_oversized_pdf_is_refused(w):
    turn_on(w)
    temperature_pdf.set_renderer(lambda model: b"%PDF-" + b"0" * (D.MAX_BYTES + 1))
    r = make(w)
    assert r.status_code == 422 and r.json()["code"] == "report_link_too_large"


def test_only_site_and_system_admin_hold_the_permission_by_default():
    roles = json.loads((Path(rl.__file__).resolve().parents[1] / "roles.json").read_text(encoding="utf-8"))["roles"]
    assert {r["id"] for r in roles if rl.PERM in r["permissions"]} == {"site_admin", "system_admin"}
