"""CR-VENDORQ-294 (docs/changes/CR-VENDORQ-294-DESIGN.md section 5): documents by a temporary link - the mint limits, the token design
(domain `doc`, only its hash stored), the two public routes on the REAL public listener (edge + app) with their headers, the download count,
expiry, revocation (manual, the contact's erase), the documents switch, a lost key, the janitor's purge and the key bookkeeping. The page
itself is frontend/src/public-ticket/doc/ (tests/unit-public-doc.spec.ts). Every name and number is invented."""
from __future__ import annotations

import datetime as dt
import hashlib

import pytest

from smplwise.services.tickets import links, out_documents as D, settings_doc, store_links
from smplwise.services.tickets.keyring import KEYS
from tickets_s4_world import API, build_s4

UTC = dt.timezone.utc
PDF = b"%PDF-1.7\n1 0 obj << >> endobj\n%%EOF\n"
HTML_REINSTATED = {"application/pdf": ".pdf", "text/html": ".html"}  # the pre-DOCLINKSEC-295 allow-list (a reviewed HTML consumer)
HTML = "<!doctype html><html><head><meta charset='utf-8'><style>td{color:#333}</style></head><body><h1>דוח HACCP</h1><img src='data:image/png;base64,AAAA'></body></html>"


@pytest.fixture
def s4(settings, monkeypatch):
    world = build_s4(settings, monkeypatch)
    monkeypatch.setattr(D, "PAGE_READY", True)
    with world.db.connection() as conn:
        settings_doc.apply_patch(conn, {"reports": {"documents": True}})
    return world


def _now() -> dt.datetime:
    return dt.datetime.now(UTC)


def _mint(s4, **kw):
    args = {"module": "temperature", "source_id": "send-1", "recipient_kind": "contact", "recipient_id": s4.contact["id"],
            "media_type": "application/pdf", "filename": "haccp-2026-09.pdf", "content": PDF, "created_by": "u-joni", "now": _now(), **kw}
    with s4.db.connection() as conn:
        return D.mint(conn, **args)


def _token(s4, doc_id):
    with s4.db.connection(mode="read") as conn:
        return D.token_of(D.row(conn, doc_id))


def _get(client, path, token):
    return client.get(f"/support/api/{path}", headers={"X-Ticket-Token": token})


def test_minting_is_off_by_default_and_a_build_without_the_page_refuses(settings, monkeypatch):
    world = build_s4(settings, monkeypatch)
    with pytest.raises(D.DocumentRefused) as exc:
        _mint(world)
    assert exc.value.code == "documents_off"
    assert D.PAGE_READY is True, "the #d. page ships with this branch"
    with world.db.connection() as conn:
        settings_doc.apply_patch(conn, {"reports": {"documents": True}})
    monkeypatch.setattr(D, "PAGE_READY", False)
    with pytest.raises(D.DocumentRefused) as exc:
        _mint(world)
    assert exc.value.code == "document_page_missing", "no link that opens an empty page leaves"


@pytest.mark.parametrize("kw,code", [
    ({"media_type": "image/png", "filename": "x.png"}, "document_type"),
    ({"filename": "../etc/passwd.pdf"}, "document_filename"),
    ({"filename": "report.html"}, "document_filename"),
    ({"filename": "דוח.pdf"}, "document_filename"),
    ({"content": b""}, "document_empty"),
    ({"content": b"MZ\x90\x00"}, "document_type_mismatch"),
    ({"content": b"%PDF-" + b"x" * (2 * 1024 * 1024)}, "document_too_large"),
    ({"media_type": "text/html", "filename": "r.html", "content": b"\xff\xfe"}, "document_type_mismatch"),
    ({"media_type": "text/html", "filename": "r.html", "content": b"<p>x</p><script>alert(1)</script>"}, "document_html_unsafe"),
    ({"media_type": "text/html", "filename": "r.html", "content": b"<img src='https://tracker.example/p.gif'>"}, "document_html_unsafe"),
    ({"media_type": "text/html", "filename": "r.html", "content": b"<a href=//evil.example/x>x</a>"}, "document_html_unsafe"),
    ({"media_type": "text/html", "filename": "r.html", "content": b"<div style=\"background:url(http://x.example/a)\"></div>"}, "document_html_unsafe"),
    ({"media_type": "text/html", "filename": "r.html", "content": b"<meta http-equiv='refresh' content='0'>"}, "document_html_unsafe"),
    ({"media_type": "text/html", "filename": "r.html", "content": b"<a href='javascript:alert(1)'>x</a>"}, "document_html_unsafe"),
    ({"module": "Temperature"}, "document_module"),
    ({"recipient_kind": "group"}, "document_recipient"),
])
def test_mint_limits(s4, monkeypatch, kw, code):
    if kw.get("media_type") == "text/html":  # DOCLINKSEC-295 M-02: HTML is off at mint; the tripwire is kept for a reviewed reinstatement
        monkeypatch.setattr(D, "MEDIA_TYPES", HTML_REINSTATED)
    with pytest.raises(D.DocumentRefused) as exc:
        _mint(s4, **kw)
    assert exc.value.code == code


def test_a_self_contained_html_report_is_accepted_and_the_store_has_a_ceiling(s4, monkeypatch):
    monkeypatch.setattr(D, "MEDIA_TYPES", HTML_REINSTATED)  # DOCLINKSEC-295 M-02: only with HTML reinstated (test_doclinksec_295 has the default)
    doc = _mint(s4, media_type="text/html", filename="haccp-2026-09.html", content=HTML.encode("utf-8"))
    assert doc["sha256"] == hashlib.sha256(HTML.encode("utf-8")).hexdigest() and "content" not in doc
    monkeypatch.setattr(D, "LIVE_TOTAL_MAX", len(HTML.encode("utf-8")) + len(PDF) - 1)
    with pytest.raises(D.DocumentRefused) as exc:
        _mint(s4)
    assert exc.value.code == "document_store_full"


def test_the_token_is_derived_in_its_own_domain_and_only_its_hash_is_stored(s4):
    doc = _mint(s4)
    token = _token(s4, doc["id"])
    assert links.parse_token(token) == token and doc["token_hash"] == links.token_hash(token)
    key = KEYS.get(doc["key_id"])
    assert token not in {links.derive_token(key, doc["id"], 1, domain=d) for d in ("tkt", "rfq", "wac")}
    with s4.db.connection(mode="read") as conn:
        raw = " ".join(str(v) for v in dict(conn.execute("SELECT * FROM outbound_documents").fetchone()).values())
        assert token not in raw
        with s4.db.connection(mode="read") as c2:
            assert doc["key_id"] in store_links.key_ids_in_use(c2) and store_links.any_keyed_row(c2)
        url = D.url(conn, D.row(conn, doc["id"]))
    assert url.endswith(f"/support/#d.{token}")
    with s4.db.connection(mode="read") as conn:
        audit = [r[0] for r in conn.execute("SELECT details_json FROM audit_log WHERE action LIKE 'report.document.%'")]
    assert audit and all(token not in a and "content" not in a for a in audit)


def test_the_public_routes_serve_the_snapshot_and_count_the_downloads(s4):
    with s4.db.connection() as conn:
        settings_doc.apply_patch(conn, {"reports": {"document_max_opens": 2}})
    doc = _mint(s4)
    token = _token(s4, doc["id"])
    client, _app = s4.public()
    meta = _get(client, "doc", token)
    assert meta.status_code == 200, meta.text
    assert meta.json() == {"filename": "haccp-2026-09.pdf", "media_type": "application/pdf", "size": len(PDF), "expires_at": doc["expires_at"],
                           "opens_left": 2, "digest": hashlib.sha256(PDF).hexdigest(), "organization": "מגדלי הדר", "logo": None, "theme": "light"}
    for left in (1, 0):
        got = _get(client, "doc/file", token)
        assert got.status_code == 200 and got.content == PDF
        assert got.headers["content-type"] == "application/pdf"
        assert got.headers["content-disposition"].startswith('attachment; filename="haccp-2026-09.pdf"')
        assert got.headers["x-content-type-options"] == "nosniff" and "no-store" in got.headers["cache-control"]
        assert got.headers["x-document-digest"] == hashlib.sha256(PDF).hexdigest()
        assert "default-src 'none'" in got.headers["content-security-policy"]
    assert _get(client, "doc/file", token).status_code == 404, "the downloads are used up"
    assert _get(client, "doc", token).status_code == 404
    assert _get(client, "doc", "A" * 32).status_code == 404 and client.get("/support/api/doc").status_code == 404


def test_every_dead_document_is_the_same_404(s4):
    client, _app = s4.public()
    expired = _mint(s4, now=_now() - dt.timedelta(hours=73))
    revoked = _mint(s4)
    erased_doc = _mint(s4)
    with s4.db.connection() as conn:
        D.revoke(conn, revoked["id"], "manual", _now())
    r = s4.c.post(f"{API}/tickets/contacts/{s4.contact['id']}/erase", json={"confirm": True})
    assert r.status_code == 200, r.text
    with s4.db.connection(mode="read") as conn:
        assert D.row(conn, erased_doc["id"])["revoked_reason"] == "contact_erased"
    bodies = {_get(client, "doc", _token(s4, d["id"])).text for d in (expired, revoked, erased_doc)}
    assert bodies == {'{"code":"link_unavailable"}'}


def test_switching_documents_off_or_losing_the_key_closes_every_link(s4, monkeypatch):
    doc = _mint(s4)
    token = _token(s4, doc["id"])
    client, _app = s4.public()
    assert _get(client, "doc", token).status_code == 200
    with s4.db.connection() as conn:
        settings_doc.apply_patch(conn, {"reports": {"documents": False}})
    assert _get(client, "doc", token).status_code == 404
    with s4.db.connection() as conn:
        settings_doc.apply_patch(conn, {"reports": {"documents": True}})
    assert _get(client, "doc", token).status_code == 200
    real_get = KEYS.get

    def gone(key_id=None):
        if key_id == doc["key_id"]:
            raise KeyError("retired")
        return real_get(key_id)

    monkeypatch.setattr(KEYS, "get", gone)
    with s4.db.connection(mode="read") as conn:
        assert D.lookup(conn, doc["token_hash"], _now()) is None


def test_the_janitor_drops_the_bytes_then_the_row(s4):
    old = _mint(s4, now=_now() - dt.timedelta(days=100))
    live = _mint(s4)
    with s4.db.connection() as conn:
        assert D.purge(conn, _now()) >= 1
        rows = {r["id"]: dict(r) for r in conn.execute("SELECT id, content IS NULL AS gone, purged_at FROM outbound_documents")}
    assert old["id"] not in rows, "purged and older than 90 days after expiry: the row is gone too"
    assert rows[live["id"]]["gone"] == 0 and rows[live["id"]]["purged_at"] is None
    mid = _mint(s4, now=_now() - dt.timedelta(days=5))
    with s4.db.connection() as conn:
        D.purge(conn, _now())
        r = dict(conn.execute("SELECT content IS NULL AS gone, purged_at FROM outbound_documents WHERE id = ?", (mid["id"],)).fetchone())
    assert r["gone"] == 1 and r["purged_at"], "expired: the bytes go, the row (ids, digest, counts) stays"
    with s4.db.connection(mode="read") as conn:
        assert mid["key_id"] in store_links.key_ids_in_use(conn), "the live document still needs the key"


def test_the_settings_api_takes_the_report_keys_within_their_ranges(s4):
    rev = s4.c.get(f"{API}/tickets/settings").json()["revision"]
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "reports": {"to_contacts": True, "document_hours": 24, "document_max_opens": 3}})
    assert r.status_code == 200, r.text
    assert r.json()["reports"] == {"to_contacts": True, "documents": True, "email": False, "document_hours": 24, "document_max_opens": 3}
    for bad in ({"document_hours": 169}, {"document_max_opens": 21}, {"documents": "yes"}, {"email": "yes"}, {"attach": True}):
        rev = s4.c.get(f"{API}/tickets/settings").json()["revision"]
        assert s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "reports": bad}).status_code == 422, bad


def test_the_settings_api_takes_the_email_switch_off_by_default(s4):
    """VENDORQ2-295: `reports.email` is off by default and is a plain boolean."""
    assert s4.c.get(f"{API}/tickets/settings").json()["reports"]["email"] is False
    rev = s4.c.get(f"{API}/tickets/settings").json()["revision"]
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "reports": {"email": True}})
    assert r.status_code == 200, r.text
    assert r.json()["reports"]["email"] is True and r.json()["reports"]["to_contacts"] is False, "the e-mail switch never opens the master switch"


def test_a_key_rotation_revokes_every_live_document_link(s4):
    if not KEYS.can_rotate():
        pytest.skip("rotation unavailable in this build")
    doc = _mint(s4)
    token = _token(s4, doc["id"])
    r = s4.c.post(f"{API}/tickets/key/rotate", json={"confirm": True})
    assert r.status_code == 200, r.text
    with s4.db.connection(mode="read") as conn:
        assert D.row(conn, doc["id"])["revoked_reason"] == "module_key"
        assert doc["key_id"] not in store_links.key_ids_in_use(conn) or doc["key_id"] in {
            x[0] for x in conn.execute("SELECT key_id FROM ticket_links WHERE revoked_at IS NULL")}
    client, _app = s4.public()
    assert _get(client, "doc", token).status_code == 404
