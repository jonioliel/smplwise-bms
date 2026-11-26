"""CAST-RELAY-HARDEN-2540 (deep review V-03): the generic NVR undo (`POST /nvr/changes/{id}/rollback`, every kind but the stream
encoding and the privacy mask) writes the old document back only while the device still holds what the change left - like the
privacy-mask and encoding undo already did. A later change, or an edit in the recorder's own screens, is never overwritten without
the caller's explicit `force`. Against the fake NVR of test_nvr_write.py (httpx MockTransport); no real device is contacted."""
from __future__ import annotations

import json

from fastapi.testclient import TestClient
from test_nvr_write import FakeNvr

from smplwise.main import create_app
from smplwise.services import nvr_write

PATH = "/ISAPI/Event/triggers/VMD-1"


def _setup(settings, monkeypatch):
    fake = FakeNvr()
    monkeypatch.setattr(nvr_write, "_client", fake.client)
    app = create_app(settings)
    return fake, app


def _change(c) -> dict:
    r = c.put("/api/v1/nvr/notify", json={"channels": [1], "smart": False})
    assert r.status_code == 200, r.text
    ch = next(x for x in c.get("/api/v1/nvr/changes").json()["changes"] if x["target"] == "VMD-1" and x["status"] == "applied")
    return ch


def _rollback_audit(app) -> list[dict]:
    with app.state.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT decision, reason, details_json FROM audit_log WHERE action = 'nvr.rollback' ORDER BY rowid").fetchall()
    return [{"decision": r["decision"], "reason": r["reason"], **json.loads(r["details_json"] or "{}")} for r in rows]


def test_an_undo_after_the_device_changed_again_is_refused_and_writes_nothing(settings, monkeypatch):
    fake, app = _setup(settings, monkeypatch)
    with TestClient(app) as c:
        c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"})
        original = fake.docs[PATH]
        ch = _change(c)
        assert nvr_write.has_center(fake.docs[PATH])
        # someone edits the trigger in the recorder's own screens: the center linkage is gone and another one is there
        edited = original.replace("<id>record-1</id>", "<id>record-1x</id>")
        fake.docs[PATH] = edited
        puts = len(fake.puts)
        r = c.post(f"/api/v1/nvr/changes/{ch['id']}/rollback")
        assert r.status_code == 409 and r.json()["code"] == "changed_since", r.text
        assert r.json()["details"]["force_allowed"] is True
        assert fake.docs[PATH] == edited and len(fake.puts) == puts, "nothing was written to the recorder"
        assert c.get(f"/api/v1/nvr/changes/{ch['id']}").json()["status"] == "applied", "the change is not marked undone"
        denied = [a for a in _rollback_audit(app) if a["decision"] == "denied"]
        assert denied and denied[-1]["reason"] == "changed_since" and denied[-1]["rollback_of"] == ch["id"]
        # the caller confirms: the old document goes back, the audit row says it was forced
        r = c.post(f"/api/v1/nvr/changes/{ch['id']}/rollback", json={"force": True})
        assert r.status_code == 201, r.text
        assert fake.docs[PATH] == original
        assert _rollback_audit(app)[-1]["decision"] == "allowed" and _rollback_audit(app)[-1]["forced"] is True


def test_an_undo_while_the_device_still_holds_the_change_works_as_before(settings, monkeypatch):
    fake, app = _setup(settings, monkeypatch)
    with TestClient(app) as c:
        c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"})
        original = fake.docs[PATH]
        ch = _change(c)
        # whitespace differences only (a device that re-indents its document) are not a change
        fake.docs[PATH] = fake.docs[PATH].replace("><", ">\n  <")
        r = c.post(f"/api/v1/nvr/changes/{ch['id']}/rollback")
        assert r.status_code == 201, r.text
        assert fake.docs[PATH] == original
        assert "forced" not in _rollback_audit(app)[-1]


def test_a_change_undone_already_is_refused_unless_forced(settings, monkeypatch):
    fake, app = _setup(settings, monkeypatch)
    with TestClient(app) as c:
        c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"})
        ch = _change(c)
        assert c.post(f"/api/v1/nvr/changes/{ch['id']}/rollback").status_code == 201
        puts = len(fake.puts)
        r = c.post(f"/api/v1/nvr/changes/{ch['id']}/rollback")
        assert r.status_code == 409 and r.json()["code"] == "already_rolled_back", r.text
        assert len(fake.puts) == puts
        assert c.post(f"/api/v1/nvr/changes/{ch['id']}/rollback", json={"force": True}).status_code == 201


def test_only_the_literal_true_forces(settings, monkeypatch):
    fake, app = _setup(settings, monkeypatch)
    with TestClient(app) as c:
        c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"})
        ch = _change(c)
        fake.docs[PATH] = fake.docs[PATH].replace("<id>record-1</id>", "<id>record-9</id>")
        for body in ({"force": "true"}, {"force": 1}, {"confirm": True}):
            r = c.post(f"/api/v1/nvr/changes/{ch['id']}/rollback", json=body)
            assert (r.status_code, r.json()["code"]) == (409, "changed_since"), body
        r = c.post(f"/api/v1/nvr/changes/{ch['id']}/rollback", content=b"not json", headers={"content-type": "application/json"})
        assert (r.status_code, r.json()["code"]) == (409, "changed_since"), "a body that is not JSON forces nothing"


def test_the_refusal_texts_have_english():
    from smplwise.error_text import english

    assert english(nvr_write.CHANGED_SINCE_TEXT) and english(nvr_write.ALREADY_ROLLED_BACK_TEXT)
