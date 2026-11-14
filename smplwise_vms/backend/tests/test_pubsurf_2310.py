"""PUBSURF-2310 (docs/security/PUBLIC_SURFACES_RECHECK_2310.md): the public document links, re-checked before `reports.documents` may be
switched on. Two small gaps closed test-first:

* DOCLINKS review 2026-10-23 L-04 - a document is minted only while the service module (`tickets.enabled`) is on. With the module off the
  public listener answers the uniform 404 for every route, so a link minted then could only be a dead link in a message; the owner rule is
  "no service-request action while the module is off".
* DOCLINKS review 2026-10-23 P4 (optional belt) - the two document answers also tell a CDN not to store them (`CDN-Cache-Control` and
  `Cloudflare-CDN-Cache-Control: no-store`), on top of the origin's `private, no-store`. This does NOT replace the live check of the
  Cloudflare rule (DOCLINKS_CLOUDFLARE_CACHE_RULE.md): an Edge-TTL override that ignores origin headers would still be wrong.

Fakes only; every name and number is invented."""
from __future__ import annotations

import pytest

from smplwise.db import set_setting
from smplwise.services.tickets import out_documents as D
from test_vendorq_294_documents import _get, _mint, _token, s4  # noqa: F401 - s4 is the fixture


def test_l04_no_document_is_minted_while_the_service_module_is_off(s4):
    with s4.db.connection() as conn:
        set_setting(conn, "tickets.enabled", "false")
    with pytest.raises(D.DocumentRefused) as exc:
        _mint(s4)
    assert exc.value.code == "documents_off"
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM outbound_documents").fetchone()[0] == 0
        assert D.config(conn)["enabled"] is False, "the documents switch alone is not enough"
    with s4.db.connection() as conn:
        set_setting(conn, "tickets.enabled", "true")
    assert _mint(s4)["id"], "module on + documents on: minting works again"


def test_p4_both_document_answers_tell_a_cdn_not_to_store_them(s4):
    doc = _mint(s4)
    token = _token(s4, doc["id"])
    client, _app = s4.public()
    for path in ("doc", "doc/file"):
        got = _get(client, path, token)
        assert got.status_code == 200, (path, got.text)
        assert "no-store" in got.headers["cache-control"], path
        assert got.headers.get("cdn-cache-control") == "no-store", path
        assert got.headers.get("cloudflare-cdn-cache-control") == "no-store", path
    miss = _get(client, "doc/file", "A" * 32)
    assert miss.status_code == 404 and miss.content == b'{"code":"link_unavailable"}'
    assert "no-store" in miss.headers["cache-control"]
