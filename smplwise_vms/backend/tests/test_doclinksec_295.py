"""DOCLINKSEC-295 (security review of the public document links, private/planning/SECURITY_REVIEW_DOCLINKS_2026-10-23.md):

* M-02 - the mint-time allow-list is PDF only: a clean, tripwire-passing HTML report and any other type are refused `document_type` at mint,
  not only handed over as opaque bytes at serve time;
* L-01 - `POST /tickets/documents/{id}/revoke` cuts ONE document link: tickets.configure only, idempotent, the public routes answer the
  uniform 404 afterwards, other links stay live, and the audit row carries ids only (never a token or a URL).

M-01 (no document link on the e-mail channel) is in test_vendorq_294_reports.py next to the e-mail tests. Every name is invented."""
from __future__ import annotations

import json

import pytest

from smplwise.services.tickets import out_documents as D
from test_vendorq_294_documents import HTML, PDF, _get, _mint, _token, s4  # noqa: F401 - s4 is the fixture
from tickets_s4_world import API


def test_mint_accepts_pdf_only(s4):  # noqa: F811
    assert D.MEDIA_TYPES == {"application/pdf": ".pdf"}
    for media_type, filename, content in (("text/html", "haccp-2026-09.html", HTML.encode("utf-8")),
                                          ("text/html", "haccp-2026-09.pdf", HTML.encode("utf-8")),
                                          ("image/svg+xml", "haccp-2026-09.svg", b"<svg xmlns='http://www.w3.org/2000/svg'/>"),
                                          ("application/octet-stream", "haccp-2026-09.pdf", PDF)):
        with pytest.raises(D.DocumentRefused) as exc:
            _mint(s4, media_type=media_type, filename=filename, content=content)
        assert exc.value.code == "document_type", media_type
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM outbound_documents").fetchone()[0] == 0
    assert _mint(s4)["media_type"] == "application/pdf"


def _revoke(s4, doc_id, user="joni"):  # noqa: F811
    return s4.c.post(f"{API}/tickets/documents/{doc_id}/revoke", headers=s4.h(user))


def test_an_operator_revokes_one_document_link(s4):  # noqa: F811
    doc, other = _mint(s4), _mint(s4, source_id="send-2")
    token, other_token = _token(s4, doc["id"]), _token(s4, other["id"])
    client, _app = s4.public()
    assert _get(client, "doc", token).status_code == 200

    assert _revoke(s4, doc["id"], user="mona").status_code == 403, "tickets.manage is not enough - tickets.configure"
    assert _revoke(s4, "0" * 32).status_code == 404
    assert _revoke(s4, "not-a-document-id").status_code in (404, 422)

    r = _revoke(s4, doc["id"])
    assert r.status_code == 200, r.text
    assert r.json() == {"id": doc["id"], "revoked": True}
    assert token not in r.text
    assert _get(client, "doc", token).status_code == 404 and _get(client, "doc/file", token).status_code == 404
    assert _get(client, "doc", other_token).status_code == 200, "only the one link dies"
    assert _revoke(s4, doc["id"]).json() == {"id": doc["id"], "revoked": False}, "idempotent"

    with s4.db.connection(mode="read") as conn:
        assert D.row(conn, doc["id"])["revoked_reason"] == "manual"
        rows = [dict(a) for a in conn.execute("SELECT * FROM audit_log WHERE action = 'report.document.revoke' ORDER BY id").fetchall()]
    assert [(a["resource_type"], a["resource_id"], a["decision"]) for a in rows][-2:] == [("outbound_document", doc["id"], "allowed")] * 2
    assert {"module": "temperature", "reason": "manual", "changed": True}.items() <= json.loads(rows[-2]["details_json"]).items()
    dumped = json.dumps(rows, default=str)
    assert token not in dumped and doc["token_hash"] not in dumped and "#d." not in dumped and s4.contact["id"] not in dumped
